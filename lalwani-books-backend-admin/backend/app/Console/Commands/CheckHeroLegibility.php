<?php

namespace App\Console\Commands;

use App\Models\Banner;
use Illuminate\Console\Command;

/**
 * Checks that every hero banner is dark enough to carry its copy.
 *
 * The hero puts its text straight on the photograph, over a corner scrim. A
 * pale banner can still swallow the copy, and nothing in the admin panel stops
 * someone uploading one: the failure is silent, because the page still renders
 * and only the words go missing. This is the check that catches it.
 *
 * scrimAlpha() below mirrors the gradient in hero-slider.tsx. Change one and
 * change the other, or this measures a page that no longer exists.
 *
 * Thresholds match the note in frontend/src/components/home/hero-slider.tsx.
 */
class CheckHeroLegibility extends Command
{
    protected $signature = 'hero:check {--frame-width=1376} {--frame-height=520}';

    protected $description = 'Verify every hero banner is dark enough for its overlaid copy';

    /** Relative luminance of #d7a2ae, the rose-300 subtitle. */
    private const L_SUBTITLE = 0.43335;

    /**
     * The copy occupies the left 47% and bottom 55% of the rendered frame.
     *
     * 47% is lg:max-w-[40rem] (640px) over the 1376px frame below. These track
     * the CSS in hero-slider.tsx — widening the copy block there without
     * changing this leaves the check measuring a region the text has already
     * grown out of, and passing banners that are bright under the right-hand
     * half of the sentence.
     */
    private const COPY_WIDTH = 0.47;
    private const COPY_TOP = 0.45;

    /** A pixel brighter than this is too bright to sit white text on. */
    private const GLARE = 0.30;

    /** Share of the copy area allowed to exceed GLARE before we call it a fail. */
    private const GLARE_BUDGET = 0.10;

    public function handle(): int
    {
        $banners = Banner::orderBy('sort_order')->get();

        if ($banners->isEmpty()) {
            $this->warn('No banners to check.');

            return self::SUCCESS;
        }

        $rows = [];
        $failed = 0;

        foreach ($banners as $banner) {
            $stats = $this->measure($banner->image_path);

            if ($stats === null) {
                $rows[] = [$this->label($banner), '—', '—', '—', 'UNREADABLE'];
                $failed++;
                continue;
            }

            ['mean' => $mean, 'glare' => $glare] = $stats;
            $white = $this->contrast(1.0, $mean);
            $subtitle = $this->contrast(self::L_SUBTITLE, $mean);
            $ok = $white >= 4.5 && $subtitle >= 3.0 && $glare <= self::GLARE_BUDGET;

            if (! $ok) {
                $failed++;
            }

            $rows[] = [
                $this->label($banner),
                number_format($mean, 3),
                number_format($white, 1).':1',
                number_format($subtitle, 1).':1',
                $ok ? 'pass' : 'FAIL ('.round($glare * 100).'% blown)',
            ];
        }

        $this->table(['Banner', 'Mean L', 'vs white', 'vs subtitle', 'Verdict'], $rows);

        if ($failed > 0) {
            $this->error("{$failed} banner(s) will not carry their copy. Replace the image with a darker one.");

            return self::FAILURE;
        }

        $this->info('All banners clear the thresholds.');

        return self::SUCCESS;
    }

    private function label(Banner $banner): string
    {
        return trim(($banner->title ?? '').' '.($banner->subtitle ?? '')) ?: "#{$banner->id}";
    }

    /**
     * Mean relative luminance of the corner the copy lands in, plus the share
     * of it that is too bright. Returns null if the image cannot be read.
     *
     * @return array{mean: float, glare: float}|null
     */
    private function measure(?string $path): ?array
    {
        if (! $path) {
            return null;
        }

        $data = str_starts_with($path, 'http')
            ? @file_get_contents($path)
            : @file_get_contents(public_path(ltrim($path, '/')));

        if ($data === false) {
            return null;
        }

        $img = @imagecreatefromstring($data);
        if ($img === false) {
            return null;
        }

        $iw = imagesx($img);
        $ih = imagesy($img);
        $frameW = (float) $this->option('frame-width');
        $frameH = (float) $this->option('frame-height');

        // object-cover: scale to cover the frame, then crop the overflow evenly.
        $scale = max($frameW / $iw, $frameH / $ih);
        $visW = $frameW / $scale;
        $visH = $frameH / $scale;
        $offX = ($iw - $visW) / 2;
        $offY = ($ih - $visH) / 2;

        $x0 = (int) $offX;
        $x1 = (int) ($offX + $visW * self::COPY_WIDTH);
        $y0 = (int) ($offY + $visH * self::COPY_TOP);
        $y1 = (int) ($offY + $visH);

        $sum = 0.0;
        $n = 0;
        $bright = 0;
        $step = max(1, (int) (($x1 - $x0) / 120));

        for ($y = $y0; $y < $y1; $y += $step) {
            for ($x = $x0; $x < $x1; $x += $step) {
                $rgb = imagecolorat($img, $x, $y);

                // Darken by the same scrim the browser paints, or this reports
                // a failure the visitor never sees.
                $k = 1.0 - $this->scrimAlpha(
                    ($x - $offX) / $visW,
                    ($y - $offY) / $visH
                );

                $l = $this->luminance(
                    (int) ((($rgb >> 16) & 0xFF) * $k),
                    (int) ((($rgb >> 8) & 0xFF) * $k),
                    (int) (($rgb & 0xFF) * $k)
                );
                $sum += $l;
                $n++;
                if ($l > self::GLARE) {
                    $bright++;
                }
            }
        }

        imagedestroy($img);

        if ($n === 0) {
            return null;
        }

        return ['mean' => $sum / $n, 'glare' => $bright / $n];
    }

    /**
     * Opacity of the hero's corner scrim at a point, 0..1.
     *
     * Mirrors the `linear-gradient(to top right, …)` in hero-slider.tsx: 0.82
     * at the bottom-left corner, 0.55 at 30% along, clear by 64%. Progress is
     * approximated as the mean of the horizontal and vertical distances from
     * that corner, which is close enough for a threshold check and far closer
     * than ignoring the scrim entirely.
     *
     * @param  float  $fx  0 at the left edge, 1 at the right
     * @param  float  $fy  0 at the top edge, 1 at the bottom
     */
    private function scrimAlpha(float $fx, float $fy): float
    {
        $t = ($fx + (1.0 - $fy)) / 2.0;

        if ($t <= 0.0) {
            return 0.82;
        }
        if ($t < 0.30) {
            return 0.82 + ($t / 0.30) * (0.55 - 0.82);
        }
        if ($t < 0.64) {
            return 0.55 * (1.0 - ($t - 0.30) / (0.64 - 0.30));
        }

        return 0.0;
    }

    private function luminance(int $r, int $g, int $b): float
    {
        $f = static fn (float $c): float => $c <= 0.04045
            ? $c / 12.92
            : pow(($c + 0.055) / 1.055, 2.4);

        return 0.2126 * $f($r / 255) + 0.7152 * $f($g / 255) + 0.0722 * $f($b / 255);
    }

    private function contrast(float $a, float $b): float
    {
        return (max($a, $b) + 0.05) / (min($a, $b) + 0.05);
    }
}
