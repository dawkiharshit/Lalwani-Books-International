<?php

namespace App\Support;

/**
 * The 11-character id of a YouTube video, from any link a person might paste:
 * youtube.com/watch?v=…, youtu.be/…, /shorts/…, /live/…, /embed/…, mobile and
 * music links, with or without share extras (?si=…, &t=…). Null for anything
 * that is not a YouTube video link. Mirrors src/lib/youtube.ts in the shop.
 */
final class YouTube
{
    public static function id(?string $link): ?string
    {
        $link = trim((string) $link);
        if ($link === '') {
            return null;
        }

        $parts = parse_url(preg_match('#^https?://#i', $link) ? $link : 'https://'.$link);
        if (! is_array($parts) || empty($parts['host'])) {
            return null;
        }

        $host = (string) preg_replace('/^(www|m|music)\./', '', strtolower($parts['host']));
        $path = array_values(array_filter(explode('/', $parts['path'] ?? ''), 'strlen'));
        $ok = fn (mixed $id): ?string => is_string($id) && preg_match('/^[\w-]{11}$/', $id) ? $id : null;

        if ($host === 'youtu.be') {
            return $ok($path[0] ?? null);
        }
        if (! in_array($host, ['youtube.com', 'youtube-nocookie.com'], true)) {
            return null;
        }

        parse_str($parts['query'] ?? '', $query);
        if (isset($query['v'])) {
            return $ok($query['v']);
        }

        return in_array($path[0] ?? '', ['embed', 'shorts', 'live', 'v'], true) ? $ok($path[1] ?? null) : null;
    }
}
