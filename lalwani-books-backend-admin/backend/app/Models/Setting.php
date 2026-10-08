<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    /** One cache entry for the whole table, rather than one per key. */
    private const MAP_KEY = 'settings_map';

    /**
     * The map for the current request.
     *
     * Cache::remember does not memoise: it goes to the cache store on every
     * call. The store here is the database, so each call is its own query, and
     * the public /settings endpoint calls get() once per key — 136 of them.
     * That was 136 cache-table queries per request, ~520ms, on a table of 34
     * rows. This holds the result for the rest of the request instead.
     *
     * Reset by flush(), so a write is still visible immediately. Under a
     * long-lived worker (Octane) this would outlive the request and would need
     * clearing per tick; artisan serve and php-fpm both start clean.
     */
    private static ?array $memo = null;

    /**
     * Every stored setting, as key => value.
     *
     * This used to be cached per key, which meant the public /settings endpoint
     * — 138 keys — did 138 cache reads per request. On the database cache driver
     * every one of those is its own query, so a warm request cost ~138 queries
     * and a cold one closer to 400, taking nearly three seconds. The whole table
     * is 34 rows; reading it in one query and caching that is strictly cheaper.
     */
    public static function map(): array
    {
        return self::$memo ??= Cache::remember(
            self::MAP_KEY,
            300,
            fn () => static::pluck('value', 'key')->all()
        );
    }

    /**
     * Get a setting value by key.
     *
     * The default is resolved from the caller each time and never cached. The
     * per-key version cached it, so a key with no row in the table would serve
     * a stale default for five minutes after the code changed.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $map = self::map();

        return array_key_exists($key, $map) ? $map[$key] : $default;
    }

    /** Set (upsert) a setting value */
    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        self::flush();
    }

    /** Set multiple settings at once */
    public static function setMany(array $data): void
    {
        foreach ($data as $key => $value) {
            static::updateOrCreate(['key' => $key], ['value' => $value]);
        }

        // Once at the end, not once per key.
        self::flush();
    }

    /** Drop the cached map — call after any write that bypasses set(). */
    public static function flush(): void
    {
        self::$memo = null;
        Cache::forget(self::MAP_KEY);
    }
}
