<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * The book lists people attach to "Books for Institutions → Request a quote":
 * a CSV of titles, or a PDF of their requirement. Each message's files live in
 * a private folder — never in the website's public folder — not in a table:
 * the live database only changes through the admin panel (see GiftIdeas).
 *
 *   storage/app/private/quote-files/<db>/<message id>/files.json
 *                                                    /1.csv
 *                                                    /2.pdf
 *                                   /total.json   (how much is stored in all)
 *
 * The folder is the message's own id, so admin → Messages finds a message's
 * attachments without an index. What a file claims to be is never trusted:
 * the kind is read from its first bytes, and that is also the only type it is
 * ever served as.
 */
final class QuoteFiles
{
    private const DIR = 'quote-files';

    /** Attachments per request, and how big each may be. */
    public const MAX_FILES = 3;

    public const MAX_KB = 3072;

    /** Everything ever attached, together: a cap the shared server can hold. */
    public const MAX_TOTAL_MB = 400;

    /**
     * What a file really is, from its first bytes — never from its name or the
     * type the browser claimed. A PDF says so; anything else has to read as
     * plain text to pass as a list.
     *
     * @return array{0: string, 1: string}|null  [extension, type to serve it as]
     */
    public static function sniff(string $path): ?array
    {
        $head = (string) @file_get_contents($path, false, null, 0, 8192);
        if ($head === '') {
            return null;
        }
        if (str_starts_with($head, '%PDF-')) {
            return ['pdf', 'application/pdf'];
        }

        // Text, in any encoding: nothing but tab and the line breaks below the
        // space. That lets through a CSV saved by Excel and keeps out images,
        // zips and programs, whatever they are named.
        $binary = (bool) preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $head);

        return $binary ? null : ['csv', 'text/csv'];
    }

    /** Why no more files can be kept right now, or null. */
    public static function full(): ?string
    {
        return self::totals()['bytes'] >= self::MAX_TOTAL_MB * 1024 * 1024
            ? 'We can’t take an attached file right now — please send your list to us by email instead.'
            : null;
    }

    /**
     * Keeps the files sent with one quote request.
     *
     * @param  array<int, UploadedFile>  $uploads
     * @param  array<int, array{0: string, 1: string}>  $kinds  what each one was sniffed as
     * @return array<int, array<string, mixed>>  what was kept, for the message text
     */
    public static function store(int $messageId, array $uploads, array $kinds): array
    {
        $disk = Storage::disk('local');
        $entries = [];
        $added = 0;

        foreach (array_values($uploads) as $i => $upload) {
            [$ext, $type] = $kinds[$i];
            $id = (string) ($i + 1);
            $disk->putFileAs(self::dir().'/'.$messageId, $upload, $id.'.'.$ext);
            $entries[] = [
                'id' => $id,
                'name' => self::safeName($upload->getClientOriginalName(), $ext),
                'bytes' => (int) $upload->getSize(),
                'type' => $type,
                'ext' => $ext,
            ];
            $added += (int) $upload->getSize();
        }

        $disk->put(self::dir().'/'.$messageId.'/files.json', json_encode($entries, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        self::addToTotals(count($entries), $added);

        return $entries;
    }

    /**
     * A message's attachments, as admin → Messages lists them.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function for(int $messageId): array
    {
        $json = Storage::disk('local')->get(self::dir().'/'.$messageId.'/files.json');
        $entries = is_string($json) ? json_decode($json, true) : null;

        return is_array($entries) ? $entries : [];
    }

    /**
     * One file on disk, with the type it is served as — or null when the id is
     * not one of this message's own files.
     *
     * @return array{path: string, type: string, name: string}|null
     */
    public static function file(int $messageId, string $id): ?array
    {
        $entry = collect(self::for($messageId))->firstWhere('id', $id);
        if (! $entry || ! preg_match('/^[1-9][0-9]?$/', $id)) {
            return null;
        }
        $disk = Storage::disk('local');
        $path = self::dir().'/'.$messageId.'/'.$id.'.'.($entry['ext'] === 'pdf' ? 'pdf' : 'csv');

        return $disk->exists($path)
            ? ['path' => $disk->path($path), 'type' => $entry['type'], 'name' => self::safeName((string) $entry['name'], (string) $entry['ext'])]
            : null;
    }

    /** Called when the message itself is deleted. */
    public static function forget(int $messageId): void
    {
        $bytes = array_sum(array_map(fn ($e) => (int) ($e['bytes'] ?? 0), self::for($messageId)));
        $files = count(self::for($messageId));
        Storage::disk('local')->deleteDirectory(self::dir().'/'.$messageId);
        self::addToTotals(-$files, -$bytes);
    }

    /**
     * A name safe to put in a download header and to save on any computer:
     * letters, digits, spaces and . _ - only, and always the real extension.
     */
    public static function safeName(string $name, string $ext): string
    {
        $base = pathinfo($name, PATHINFO_FILENAME);
        $base = trim((string) preg_replace('/[^A-Za-z0-9 ._-]+/', '-', $base), ' .-');
        $base = mb_substr($base !== '' ? $base : 'book-list', 0, 60);

        return $base.'.'.($ext === 'pdf' ? 'pdf' : 'csv');
    }

    /** @return array{files: int, bytes: int} */
    private static function totals(): array
    {
        $json = Storage::disk('local')->get(self::dir().'/total.json');
        $totals = is_string($json) ? json_decode($json, true) : null;

        return [
            'files' => max(0, (int) ($totals['files'] ?? 0)),
            'bytes' => max(0, (int) ($totals['bytes'] ?? 0)),
        ];
    }

    private static function addToTotals(int $files, int $bytes): void
    {
        $totals = self::totals();
        Storage::disk('local')->put(self::dir().'/total.json', json_encode([
            'files' => max(0, $totals['files'] + $files),
            'bytes' => max(0, $totals['bytes'] + $bytes),
        ]));
    }

    /** One folder per database, like VoiceQueries: the test copy shares this storage. */
    private static function dir(): string
    {
        $database = (string) config('database.connections.'.config('database.default').'.database');

        return self::DIR.'/'.(preg_replace('/[^A-Za-z0-9_-]/', '', basename($database)) ?: 'default');
    }
}
