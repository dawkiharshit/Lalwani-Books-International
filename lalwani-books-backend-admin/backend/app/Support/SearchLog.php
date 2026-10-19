<?php

namespace App\Support;

use App\Models\Product;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * What shoppers search for, for admin → Search insights: one line per search
 * in a private file per day. Files, not a table: the live database only
 * changes through the admin panel (see GiftIdeas).
 *
 * A line keeps the words (tidied: lower case, single spaces), how many books
 * they found, how the search ended and the book opened from it — never who
 * searched: no account, no IP address. Words that look like an email
 * address, a phone, card or Aadhaar number are not kept at all.
 */
final class SearchLog
{
    private const DIR = 'search-log';

    /** India time, so a day in the report is the shop's day. */
    public const TZ = 'Asia/Kolkata';

    /** Days kept; the report looks back at most 90. */
    public const KEEP_DAYS = 120;

    /** The periods the report offers. */
    public const PERIODS = [7, 30, 90];

    /** A day's file stops growing here, so a flood can never fill the disk. */
    private const MAX_DAY_BYTES = 5 * 1024 * 1024;

    public const MAX_LENGTH = 80;

    /**
     * How a search ended: on the results page, by choosing a suggestion, or
     * typed and left (the suggestions said enough, or nothing matched).
     * "open" is not a search of its own: a book opened from the results.
     */
    public const WAYS = ['results', 'pick', 'typed', 'open'];

    /** The words as one search: "  Harry   POTTER " and "harry potter" are the same. */
    public static function normalize(string $text): string
    {
        $text = mb_substr($text, 0, 200);
        if (! mb_check_encoding($text, 'UTF-8')) {
            return '';
        }
        if (class_exists(\Normalizer::class)) {
            $text = \Normalizer::normalize($text, \Normalizer::FORM_KC) ?: $text;
        }
        // Invisible characters out, any run of spaces, tabs or line breaks to one space.
        $text = (string) preg_replace('/\p{Cf}+/u', '', $text);
        $text = (string) preg_replace('/[\s\p{Cc}\p{Z}]+/u', ' ', $text);
        // Quotes, brackets and full stops around the words are not part of them
        // (but "c++" and "c#" keep their signs).
        $edge = '[\s"\'“”‘’«».,;:!?¡¿()\[\]{}<>|`*_~-]+';
        $text = mb_strtolower((string) preg_replace("/^{$edge}|{$edge}$/u", '', $text));

        // An ISBN, however it was typed, as its bare digits.
        $compact = (string) preg_replace('/[\s-]/', '', $text);
        if (preg_match('/^(\d{9}[\dx]|\d{13})$/', $compact)) {
            return strtoupper($compact);
        }

        return trim(mb_substr($text, 0, self::MAX_LENGTH));
    }

    /**
     * Worth keeping, and nothing personal: at least two characters, no email
     * address, and no long number other than an ISBN — a run of ten or more
     * digits (in groups of three or more) is a phone, card or Aadhaar number.
     */
    public static function keepable(string $term): bool
    {
        if (mb_strlen($term) < 2 || preg_match('/[^\s@]+@[^\s@]+\.[^\s@]+/u', $term)) {
            return false;
        }
        if (preg_match_all('/(?<!\d)\d{3,}(?:[\s.\-]\d{3,})*(?!\d)/', $term, $runs)) {
            foreach ($runs[0] as $run) {
                $digits = (string) preg_replace('/\D/', '', $run);
                if (strlen($digits) >= 10 && ! Isbn::isValid($digits)) {
                    return false;
                }
            }
        }

        return true;
    }

    /** How many books on sale the shop's search finds for these words. */
    public static function matches(string $term): int
    {
        return Product::active()->search($term)->count();
    }

    /**
     * The same for several searches in one trip to the database (one count
     * each, side by side), so the report stays quick however many there are.
     *
     * @param  string[]  $terms
     * @return array<string, int> term → books found
     */
    public static function matchesEach(array $terms): array
    {
        $terms = array_values(array_unique(array_map('strval', $terms)));
        if (! $terms) {
            return [];
        }

        $query = DB::query();
        foreach ($terms as $i => $term) {
            $query->selectSub(Product::active()->search($term)->selectRaw('count(*)'), 'm'.$i);
        }
        $row = (array) $query->first();

        $out = [];
        foreach ($terms as $i => $term) {
            $out[$term] = (int) ($row['m'.$i] ?? 0);
        }

        return $out;
    }

    /** Notes one search (or, for "open", a book opened from one). */
    public static function record(string $term, string $way, ?int $bookId = null): void
    {
        $now = CarbonImmutable::now(self::TZ);
        $disk = Storage::disk('local');
        $file = self::dir().'/'.$now->format('Y-m-d').'.jsonl';

        if (! $disk->exists($file)) {
            $disk->makeDirectory(self::dir());
            self::prune();
        } elseif ($disk->size($file) > self::MAX_DAY_BYTES) {
            return;
        }

        $line = array_filter([
            't' => $now->getTimestamp(),
            'q' => $term,
            'w' => $way,
            'n' => $way === 'open' ? null : self::matches($term),
            'b' => $bookId ?: null,
        ], fn ($v) => $v !== null);

        file_put_contents(
            $disk->path($file),
            json_encode($line, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n",
            FILE_APPEND | LOCK_EX
        );
    }

    /**
     * The report for the last $days days (today included): totals, searches
     * per day, the most searched words, searches that found nothing, the books
     * opened from searches, and the latest searches.
     */
    public static function report(int $days): array
    {
        $today = CarbonImmutable::now(self::TZ)->startOfDay();
        $from = $today->subDays($days - 1);

        $daily = [];
        $terms = [];
        $books = [];
        $totals = ['searches' => 0, 'nothing' => 0, 'opened' => 0];

        for ($day = $from; $day <= $today; $day = $day->addDay()) {
            $sum = self::summary($day->format('Y-m-d'), $day->equalTo($today));
            $daily[] = ['date' => $day->format('Y-m-d'), 'searches' => $sum['searches'], 'nothing' => $sum['nothing']];
            foreach (['searches', 'nothing', 'opened'] as $key) {
                $totals[$key] += $sum[$key];
            }
            foreach ($sum['terms'] as $term => $t) {
                $term = (string) $term;
                $into = $terms[$term] ?? ['count' => 0, 'nothing' => 0, 'last' => 0, 'found' => null];
                $into['count'] += $t['count'];
                $into['nothing'] += $t['nothing'];
                if ($t['last'] >= $into['last']) {
                    $into['last'] = $t['last'];
                    $into['found'] = $t['found'];
                }
                $terms[$term] = $into;
            }
            foreach ($sum['books'] as $id => $b) {
                $books[$id]['count'] = ($books[$id]['count'] ?? 0) + $b['count'];
                foreach ($b['terms'] as $term => $n) {
                    $books[$id]['terms'][(string) $term] = ($books[$id]['terms'][(string) $term] ?? 0) + $n;
                }
            }
        }

        $top = $terms;
        uasort($top, fn ($a, $b) => [$b['count'], $b['last']] <=> [$a['count'], $a['last']]);

        // Searches that found nothing at least once — and whether they find a
        // book now, so a book added since shows as found.
        $missing = array_filter($terms, fn ($t) => $t['nothing'] > 0);
        uasort($missing, fn ($a, $b) => [$b['nothing'], $b['last']] <=> [$a['nothing'], $a['last']]);
        $missing = array_slice($missing, 0, 50, true);
        $now = self::matchesEach(array_keys($missing));
        foreach ($missing as $term => $t) {
            $missing[$term]['now'] = $now[(string) $term] ?? 0;
        }
        uasort($missing, fn ($a, $b) => [$a['now'] > 0, $b['nothing'], $b['last']] <=> [$b['now'] > 0, $a['nothing'], $a['last']]);

        uasort($books, fn ($a, $b) => $b['count'] <=> $a['count']);
        $books = array_slice($books, 0, 20, true);

        $recent = self::recent(30);
        $ids = array_unique(array_merge(array_keys($books), array_filter(array_column($recent, 'b'))));
        $products = $ids
            ? Product::query()->whereIn('id', $ids)
                ->get(['id', 'name', 'slug', 'author', 'image', 'is_active', 'color_from', 'color_to', 'accent'])
                ->keyBy('id')
            : collect();

        return [
            'days' => $days,
            'from' => $from->format('Y-m-d'),
            'to' => $today->format('Y-m-d'),
            'totals' => $totals + ['terms' => count($terms)],
            'daily' => $daily,
            'top' => self::termRows(array_slice($top, 0, 25, true)),
            'missing' => self::termRows($missing),
            'books' => collect($books)
                ->filter(fn ($b, $id) => $products->has($id))
                ->map(function ($b, $id) use ($products) {
                    $p = $products[$id];
                    arsort($b['terms']);

                    return [
                        'id' => (int) $id,
                        'name' => $p->name,
                        'slug' => $p->slug,
                        'author' => $p->author,
                        'image' => Product::imageUrl($p->image),
                        'colors' => ['from' => $p->color_from, 'to' => $p->color_to, 'accent' => $p->accent],
                        'on_sale' => (bool) $p->is_active,
                        'opens' => $b['count'],
                        'terms' => array_map('strval', array_slice(array_keys($b['terms']), 0, 3)),
                    ];
                })
                ->values()
                ->all(),
            'recent' => array_map(fn ($e) => [
                'at' => self::time($e['t']),
                'term' => $e['q'],
                'way' => $e['w'],
                'found' => $e['n'] ?? null,
                'book' => isset($e['b'], $products[$e['b']]) ? ['name' => $products[$e['b']]->name, 'slug' => $products[$e['b']]->slug] : null,
            ], $recent),
        ];
    }

    /** @param array<string, array> $terms */
    private static function termRows(array $terms): array
    {
        $rows = [];
        foreach ($terms as $term => $t) {
            $rows[] = [
                'term' => (string) $term,
                'count' => $t['count'],
                'nothing' => $t['nothing'],
                'found' => $t['found'],
                'last' => self::time($t['last']),
            ] + (array_key_exists('now', $t) ? ['now' => $t['now']] : []);
        }

        return $rows;
    }

    /**
     * One day's figures. A past day's never change, so they are worked out
     * once and kept beside its file; today's are read fresh.
     */
    private static function summary(string $date, bool $today): array
    {
        $disk = Storage::disk('local');
        $file = self::dir().'/'.$date.'.jsonl';
        $kept = self::dir().'/'.$date.'.sum.json';

        if (! $disk->exists($file)) {
            return ['searches' => 0, 'nothing' => 0, 'opened' => 0, 'terms' => [], 'books' => []];
        }
        if (! $today && $disk->exists($kept) && $disk->lastModified($kept) >= $disk->lastModified($file)) {
            $sum = json_decode((string) $disk->get($kept), true);
            if (is_array($sum) && isset($sum['searches'], $sum['terms'], $sum['books'])) {
                return $sum;
            }
        }

        $sum = ['searches' => 0, 'nothing' => 0, 'opened' => 0, 'terms' => [], 'books' => []];
        $handle = fopen($disk->path($file), 'rb');
        while ($handle && ($line = fgets($handle)) !== false) {
            $e = self::event($line);
            if (! $e) {
                continue;
            }
            $q = $e['q'];
            if ($e['w'] !== 'open') {
                $n = $e['n'] ?? null;
                $t = $sum['terms'][$q] ?? ['count' => 0, 'nothing' => 0, 'last' => 0, 'found' => null];
                $t['count']++;
                if ($n === 0) {
                    $t['nothing']++;
                    $sum['nothing']++;
                }
                if ($e['t'] >= $t['last']) {
                    $t['last'] = $e['t'];
                    $t['found'] = $n;
                }
                $sum['terms'][$q] = $t;
                $sum['searches']++;
            }
            if (! empty($e['b'])) {
                $id = (int) $e['b'];
                $sum['opened']++;
                $sum['books'][$id]['count'] = ($sum['books'][$id]['count'] ?? 0) + 1;
                $sum['books'][$id]['terms'][$q] = ($sum['books'][$id]['terms'][$q] ?? 0) + 1;
            }
        }
        if ($handle) {
            fclose($handle);
        }

        if (! $today) {
            $disk->put($kept, json_encode($sum, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        return $sum;
    }

    /** The latest events, newest first — from today's file, then the days before. */
    private static function recent(int $count): array
    {
        $disk = Storage::disk('local');
        $out = [];
        $day = CarbonImmutable::now(self::TZ);
        for ($i = 0; $i < 7 && count($out) < $count; $i++, $day = $day->subDay()) {
            $file = self::dir().'/'.$day->format('Y-m-d').'.jsonl';
            if (! $disk->exists($file)) {
                continue;
            }
            // The tail of the file holds the latest lines; no need to read it all.
            $path = $disk->path($file);
            $size = filesize($path) ?: 0;
            $handle = fopen($path, 'rb');
            if (! $handle) {
                continue;
            }
            fseek($handle, max(0, $size - 65536));
            $lines = explode("\n", (string) stream_get_contents($handle));
            fclose($handle);
            if ($size > 65536) {
                array_shift($lines); // cut mid-line
            }
            foreach (array_reverse($lines) as $line) {
                if (($e = self::event($line)) && count($out) < $count) {
                    $out[] = $e;
                }
            }
        }

        return $out;
    }

    /** One line of a day's file, checked — a damaged line is skipped. */
    private static function event(string $line): ?array
    {
        $e = json_decode(trim($line), true);
        if (! is_array($e) || ! is_string($e['q'] ?? null) || ! in_array($e['w'] ?? null, self::WAYS, true)) {
            return null;
        }

        return [
            't' => (int) ($e['t'] ?? 0),
            'q' => $e['q'],
            'w' => $e['w'],
            'n' => isset($e['n']) ? (int) $e['n'] : null,
            'b' => isset($e['b']) ? (int) $e['b'] : null,
        ];
    }

    private static function time(int $timestamp): ?string
    {
        return $timestamp > 0 ? CarbonImmutable::createFromTimestamp($timestamp, self::TZ)->toIso8601String() : null;
    }

    /** Files older than KEEP_DAYS go — checked once a day, on its first search. */
    private static function prune(): void
    {
        $disk = Storage::disk('local');
        $cutoff = CarbonImmutable::now(self::TZ)->subDays(self::KEEP_DAYS)->format('Y-m-d');
        foreach ($disk->files(self::dir()) as $file) {
            if (preg_match('/(\d{4}-\d{2}-\d{2})\.(jsonl|sum\.json)$/', $file, $m) && $m[1] < $cutoff) {
                $disk->delete($file);
            }
        }
    }

    /** One folder per database, like StaffChanges: the test copy shares this storage. */
    private static function dir(): string
    {
        $database = (string) config('database.connections.'.config('database.default').'.database');

        return self::DIR.'/'.(preg_replace('/[^A-Za-z0-9_-]/', '', basename($database)) ?: 'default');
    }
}
