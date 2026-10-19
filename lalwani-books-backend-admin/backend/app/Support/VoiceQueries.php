<?php

namespace App\Support;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\Uid\Ulid;

/**
 * Questions customers record with the website's mic button, for admin →
 * Voice Queries. Each one is a private folder — the recording and a small
 * JSON file — not a table: the live database only changes through the admin
 * panel (see GiftIdeas).
 *
 *   storage/app/private/voice-queries/<db>/<ulid>/query.json
 *                                                 /audio.webm|ogg|m4a
 *                                                 /new      (while unanswered)
 *
 * Folder names are ULIDs, so they sort by time and say when they were made
 * without opening anything; the "new" marker lets the count and the
 * New / Answered lists skip reading every file.
 */
final class VoiceQueries
{
    private const DIR = 'voice-queries';

    /** Longest recording the website allows. */
    public const MAX_SECONDS = 120;

    /** Two minutes at the website's bitrate is about half a megabyte; this is plenty. */
    public const MAX_KB = 3072;

    /** Shop-wide limits, so a flood can never fill the disk. */
    public static int $perDay = 100;

    public static int $kept = 1000;

    /** Older recordings are removed. */
    public const KEEP_DAYS = 180;

    /**
     * The containers browsers record in, told apart by their first bytes —
     * never by the name or type the upload claims.
     */
    public static function sniff(string $path): ?array
    {
        $head = (string) @file_get_contents($path, false, null, 0, 12);

        return match (true) {
            str_starts_with($head, "\x1A\x45\xDF\xA3") => ['webm', 'audio/webm'],
            str_starts_with($head, 'OggS') => ['ogg', 'audio/ogg'],
            substr($head, 4, 4) === 'ftyp' => ['m4a', 'audio/mp4'],
            default => null,
        };
    }

    /** Why the website cannot take another recording right now, or null. */
    public static function full(): ?string
    {
        $ids = self::ids();
        $today = CarbonImmutable::now()->startOfDay();
        $sinceToday = count(array_filter($ids, fn ($id) => self::time($id) >= $today));

        return count($ids) >= self::$kept || $sinceToday >= self::$perDay
            ? 'We can’t take voice messages right now. Please WhatsApp or call us instead.'
            : null;
    }

    /**
     * Keeps a recording with who sent it and from which page.
     *
     * @param  array{phone: ?string, seconds: int, page: ?string}  $meta
     */
    public static function store(UploadedFile $audio, array $kind, array $meta, ?User $user): array
    {
        self::prune();

        $id = (string) Str::ulid();
        [$ext, $type] = $kind;
        $disk = Storage::disk('local');
        $disk->putFileAs(self::dir().'/'.$id, $audio, 'audio.'.$ext);

        $entry = [
            'id' => $id,
            'created_at' => now()->toIso8601String(),
            'phone' => $meta['phone'],
            'user' => $user ? ['id' => $user->id, 'name' => $user->name, 'email' => $user->email] : null,
            'page' => $meta['page'],
            'seconds' => $meta['seconds'],
            'bytes' => (int) $audio->getSize(),
            'type' => $type,
            'file' => 'audio.'.$ext,
            'status' => 'new',
            'answered_at' => null,
        ];
        $disk->put(self::dir().'/'.$id.'/query.json', json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $disk->put(self::dir().'/'.$id.'/new', '');

        return $entry;
    }

    /**
     * A page of recordings, newest first.
     *
     * @return array{data: array<int, array>, total: int}
     */
    public static function list(string $status, int $page, int $perPage = 20): array
    {
        $ids = array_values(array_filter(self::ids(), fn ($id) => match ($status) {
            'new' => self::isNew($id),
            'answered' => ! self::isNew($id),
            default => true,
        }));

        return [
            'data' => array_values(array_filter(array_map(
                fn ($id) => self::get($id),
                array_slice($ids, ($page - 1) * $perPage, $perPage)
            ))),
            'total' => count($ids),
        ];
    }

    public static function newCount(): int
    {
        return count(array_filter(self::ids(), fn ($id) => self::isNew($id)));
    }

    public static function get(string $id): ?array
    {
        if (! self::validId($id)) {
            return null;
        }
        $json = Storage::disk('local')->get(self::dir().'/'.$id.'/query.json');
        $entry = is_string($json) ? json_decode($json, true) : null;

        return is_array($entry) ? $entry : null;
    }

    /** The recording on disk, with the type it is served as. */
    public static function audio(array $entry): ?array
    {
        $disk = Storage::disk('local');
        $file = self::dir().'/'.$entry['id'].'/'.basename((string) ($entry['file'] ?? ''));

        return $disk->exists($file) && in_array($entry['type'] ?? null, ['audio/webm', 'audio/ogg', 'audio/mp4'], true)
            ? ['path' => $disk->path($file), 'type' => $entry['type'], 'ext' => pathinfo($file, PATHINFO_EXTENSION)]
            : null;
    }

    /** Answered or new again. */
    public static function mark(array $entry, bool $answered): array
    {
        $disk = Storage::disk('local');
        $entry['status'] = $answered ? 'answered' : 'new';
        $entry['answered_at'] = $answered ? now()->toIso8601String() : null;
        $disk->put(self::dir().'/'.$entry['id'].'/query.json', json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $answered ? $disk->delete(self::dir().'/'.$entry['id'].'/new') : $disk->put(self::dir().'/'.$entry['id'].'/new', '');

        return $entry;
    }

    public static function delete(string $id): void
    {
        if (self::validId($id)) {
            Storage::disk('local')->deleteDirectory(self::dir().'/'.$id);
        }
    }

    /** Recordings older than KEEP_DAYS go — checked at most once a day. */
    private static function prune(): void
    {
        if (! Cache::add('voice-queries-pruned:'.self::dir().':'.now()->toDateString(), true, 86400)) {
            return;
        }
        $cutoff = CarbonImmutable::now()->subDays(self::KEEP_DAYS);
        foreach (self::ids() as $id) {
            if (self::time($id) < $cutoff) {
                self::delete($id);
            }
        }
    }

    /** @return string[] every recording's id, newest first */
    private static function ids(): array
    {
        $ids = array_values(array_filter(
            array_map('basename', Storage::disk('local')->directories(self::dir())),
            fn ($id) => self::validId($id)
        ));
        rsort($ids, SORT_STRING);

        return $ids;
    }

    private static function isNew(string $id): bool
    {
        return Storage::disk('local')->exists(self::dir().'/'.$id.'/new');
    }

    private static function time(string $id): CarbonImmutable
    {
        return CarbonImmutable::instance(Ulid::fromString($id)->getDateTime());
    }

    private static function validId(string $id): bool
    {
        return (bool) preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $id);
    }

    /** One folder per database, like StaffChanges: the test copy shares this storage. */
    private static function dir(): string
    {
        $database = (string) config('database.connections.'.config('database.default').'.database');

        return self::DIR.'/'.(preg_replace('/[^A-Za-z0-9_-]/', '', basename($database)) ?: 'default');
    }
}
