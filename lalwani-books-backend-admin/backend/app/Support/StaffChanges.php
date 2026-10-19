<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Staff edits held for the owner's approval.
 *
 * When a staff member whose area is set to "needs approval" saves something,
 * the request is not run. It is kept — method, address, the fields sent and
 * any photos — and the owner sees it in admin → Approvals, with what it would
 * change. Approving runs that same request as the owner, so it goes live
 * exactly as if the owner had pressed Save; rejecting closes it.
 *
 * Kept as files in private storage (storage/app/private/staff-changes), not
 * the database: the live database only changes through the admin panel, and
 * a change can carry a long blog post or photos.
 */
final class StaffChanges
{
    private const DIR = 'staff-changes';

    private const MAX_INPUT_BYTES = 1_000_000;

    private const MAX_FILE_BYTES = 10 * 1024 * 1024;

    private const MAX_FILES_BYTES = 25 * 1024 * 1024;

    /** Decided changes are kept this long for the history, then cleared away. */
    private const KEEP_DAYS = 90;

    /** What each part of the admin can hold, and what it is called in a sentence. */
    private const MODELS = [
        'products' => [\App\Models\Product::class, 'name', 'product'],
        'categories' => [\App\Models\Category::class, 'name', 'category'],
        'authors' => [\App\Models\Author::class, 'name', 'author'],
        'publishers' => [\App\Models\Publisher::class, 'name', 'publisher'],
        'banners' => [\App\Models\Banner::class, 'title', 'banner'],
        'blogs' => [\App\Models\Blog::class, 'title', 'blog post'],
        'coupons' => [\App\Models\Coupon::class, 'code', 'coupon'],
        'deals' => [\App\Models\Deal::class, 'heading', 'deal'],
        'testimonials' => [\App\Models\Testimonial::class, 'name', 'testimonial'],
        'reviews' => [\App\Models\Review::class, 'title', 'review'],
        'orders' => [\App\Models\Order::class, 'order_number', 'order'],
        'returns' => [\App\Models\ReturnRequest::class, 'id', 'return'],
        'messages' => [\App\Models\ContactMessage::class, 'name', 'message'],
        'subscribers' => [\App\Models\NewsletterSubscriber::class, 'email', 'subscriber'],
        'abandoned-checkouts' => [\App\Models\AbandonedCheckout::class, 'email', 'abandoned checkout'],
    ];

    /** Fields that are plumbing, not content. */
    private const SKIP_FIELDS = ['_method', '_token', 'clear'];

    /** Keep the request for the owner instead of running it. */
    public static function hold(Request $request, User $staff, string $area): array
    {
        $files = [];
        $total = 0;
        foreach (Arr::dot($request->allFiles()) as $key => $file) {
            if (! $file instanceof UploadedFile || ! $file->isValid()) {
                continue;
            }
            $total += (int) $file->getSize();
            if ($file->getSize() > self::MAX_FILE_BYTES || $total > self::MAX_FILES_BYTES) {
                throw new RuntimeException('That file is too large to send for approval (10 MB each, 25 MB in all).');
            }
            $files[$key] = $file;
        }

        $input = $request->isJson() ? $request->json()->all() : $request->request->all();
        if (strlen((string) json_encode($input)) > self::MAX_INPUT_BYTES) {
            throw new RuntimeException('That change is too large to send for approval.');
        }

        $id = strtolower((string) Str::ulid());
        $path = self::apiPath($request);
        $stored = [];
        foreach ($files as $key => $file) {
            $name = Str::random(16).'.'.($file->guessExtension() ?: 'bin');
            self::disk()->putFileAs(self::dir().'/'.$id.'/files', $file, $name);
            $stored[] = [
                'key' => (string) $key,
                'path' => self::dir().'/'.$id.'/files/'.$name,
                'name' => mb_substr($file->getClientOriginalName(), 0, 120),
                'mime' => (string) $file->getMimeType(),
                'size' => (int) $file->getSize(),
            ];
        }

        $change = [
            'id' => $id,
            'status' => 'pending',
            'area' => $area,
            'method' => $request->method(),
            'path' => $path,
            'query' => $request->query(),
            'json' => $request->isJson(),
            'input' => $input,
            'files' => $stored,
            'title' => self::title($request->method(), $path, $input),
            'staff' => ['id' => $staff->id, 'name' => $staff->name, 'email' => $staff->email],
            'created_at' => now()->toIso8601String(),
            'decided_at' => null,
            'decided_by' => null,
            'reason' => null,
            'error' => null,
        ];
        self::write($change);
        self::prune();

        return $change;
    }

    /** One change, or null for an unknown or malformed id. */
    public static function get(string $id): ?array
    {
        if (! preg_match('/^[0-9a-z]{26}$/', $id)) {
            return null;
        }

        $json = self::disk()->get(self::dir().'/'.$id.'/change.json');
        $change = $json ? json_decode($json, true) : null;

        return is_array($change) ? $change : null;
    }

    /** @return array<int, array> newest first */
    public static function all(?callable $filter = null): array
    {
        $out = [];
        foreach (self::disk()->directories(self::dir()) as $dir) {
            $change = self::get(basename($dir));
            if ($change && (! $filter || $filter($change))) {
                $out[] = $change;
            }
        }
        usort($out, fn ($a, $b) => strcmp((string) $b['created_at'], (string) $a['created_at']));

        return $out;
    }

    public static function pendingCount(): int
    {
        return count(self::all(fn ($c) => $c['status'] === 'pending'));
    }

    /**
     * Run a held change as the owner who approved it — through the whole API,
     * exactly as their own Save would. Returns [ok, message].
     *
     * @return array{0: bool, 1: string}
     */
    public static function apply(array $change, Request $current): array
    {
        // Only what a staff member could have been allowed to change.
        $path = (string) $change['path'];
        $segment = explode('/', $path)[1] ?? '';
        if (! preg_match('#^admin/[a-z0-9-]+(/[A-Za-z0-9_.-]+)*$#', $path) || StaffAccess::areaFor($segment) !== $change['area']) {
            throw new RuntimeException('This change points somewhere staff cannot make changes.');
        }

        $files = [];
        foreach ($change['files'] as $file) {
            if (! self::disk()->exists($file['path'])) {
                throw new RuntimeException('A photo sent with this change is missing.');
            }
            Arr::set($files, $file['key'], new UploadedFile(self::disk()->path($file['path']), $file['name'], $file['mime'], null, true));
        }

        $uri = '/api/v1/'.$path.($change['query'] ? '?'.http_build_query($change['query']) : '');
        $server = ['HTTP_ACCEPT' => 'application/json', 'HTTP_AUTHORIZATION' => (string) $current->header('Authorization')];

        $sub = $files === [] && $change['json']
            ? Request::create($uri, $change['method'], [], [], [], $server + ['CONTENT_TYPE' => 'application/json'], (string) json_encode($change['input']))
            : Request::create($uri, $change['method'], $change['input'], [], $files, $server);

        try {
            $response = app(HttpKernel::class)->handle($sub);
        } finally {
            // Back to the owner's own request for the rest of this one.
            app()->instance('request', $current);
            Facade::clearResolvedInstance('request');
        }

        $status = $response->getStatusCode();
        $body = json_decode((string) $response->getContent(), true);
        $message = is_array($body) ? (string) ($body['message'] ?? '') : '';
        if ($status >= 300 && is_array($body['errors'] ?? null)) {
            $message = implode(' ', Arr::flatten($body['errors'])) ?: $message;
        }

        return [$status < 300, $message !== '' ? $message : ($status < 300 ? 'Done.' : "The shop refused it ({$status}).")];
    }

    /** Close a change as approved or rejected. */
    public static function decide(array $change, string $status, User $owner, ?string $reason = null): array
    {
        $change['status'] = $status;
        $change['decided_at'] = now()->toIso8601String();
        $change['decided_by'] = ['id' => $owner->id, 'name' => $owner->name];
        $change['reason'] = $reason !== null && trim($reason) !== '' ? mb_substr(trim($reason), 0, 500) : null;
        $change['error'] = null;
        self::write($change);

        // The photos were only needed until now.
        self::disk()->deleteDirectory(self::dir().'/'.$change['id'].'/files');

        return $change;
    }

    /** Note why an approval could not be applied; it stays pending. */
    public static function failed(array $change, string $error): array
    {
        $change['error'] = mb_strimwidth($error, 0, 500, '…');
        self::write($change);

        return $change;
    }

    /** A held photo, for the owner to look at before approving. */
    public static function file(array $change, int $index): ?array
    {
        $file = $change['files'][$index] ?? null;

        return $file && self::disk()->exists($file['path']) ? $file + ['full' => self::disk()->path($file['path'])] : null;
    }

    /** The change as the admin screens show it, with what it changes. */
    public static function describe(array $change): array
    {
        return [
            'id' => $change['id'],
            'status' => $change['status'],
            'area' => $change['area'],
            'area_label' => StaffAccess::AREAS[$change['area']][0] ?? $change['area'],
            'title' => $change['title'],
            'staff' => $change['staff'],
            'created_at' => $change['created_at'],
            'decided_at' => $change['decided_at'],
            'decided_by' => $change['decided_by']['name'] ?? null,
            'reason' => $change['reason'],
            'error' => $change['error'] ?? null,
            'fields' => $change['status'] === 'pending' ? self::fields($change) : [],
            'files' => collect($change['files'])->map(fn ($f, $i) => [
                'index' => $i,
                'name' => $f['name'],
                'size' => $f['size'],
                'image' => str_starts_with((string) $f['mime'], 'image/'),
            ])->values()->all(),
        ];
    }

    /**
     * What the change would change: each field sent, beside its value now.
     * Fields that would stay the same are left out.
     *
     * @return array<int, array{label: string, before: ?string, after: ?string}>
     */
    private static function fields(array $change): array
    {
        if ($change['method'] === 'DELETE') {
            return [];
        }

        $current = self::currentValues($change);
        $out = [];
        foreach (Arr::dot($change['input']) as $key => $after) {
            $root = explode('.', (string) $key)[0];
            if (in_array($root, self::SKIP_FIELDS, true)) {
                continue;
            }
            $before = Arr::get($current, $key);
            // A form sends "1" for a ticked box and "299" for 299.00.
            if (is_bool($before)) {
                $after = filter_var($after, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $after;
            }
            $sameNumber = is_numeric($before) && is_numeric($after) && (float) $before === (float) $after;
            if ($sameNumber || self::show($before) === self::show($after)) {
                continue;
            }
            $out[] = ['label' => self::label((string) $key), 'before' => self::show($before), 'after' => self::show($after)];
            if (count($out) >= 60) {
                break;
            }
        }

        return $out;
    }

    /** Today's values of whatever the change touches, keyed like its fields. */
    private static function currentValues(array $change): array
    {
        $parts = explode('/', (string) $change['path']);
        $segment = $parts[1] ?? '';

        if ($segment === 'settings' && count($parts) === 2) {
            return collect(array_keys($change['input']))
                ->mapWithKeys(fn ($key) => [$key => Setting::get((string) $key)])
                ->all();
        }

        $model = self::model($segment, $parts[2] ?? null);
        if (! $model) {
            return [];
        }

        $values = $model->attributesToArray();
        // Kept in settings, not on the product (see GiftIdeas).
        if ($segment === 'products') {
            $values['is_gift_idea'] = GiftIdeas::has((int) $model->getKey());
        }

        return $values;
    }

    private static function model(string $segment, ?string $id)
    {
        [$class] = self::MODELS[$segment] ?? [null];

        return $class && $id !== null && ctype_digit($id) ? $class::find((int) $id) : null;
    }

    /** A short sentence for the change, using today's names. */
    private static function title(string $method, string $path, array $input): string
    {
        $parts = explode('/', $path);
        $segment = $parts[1] ?? '';
        $id = $parts[2] ?? null;
        $sub = implode('/', array_slice($parts, 3));

        if ($segment === 'settings') {
            return count($parts) === 2
                ? 'Change website settings'
                : ($method === 'DELETE' ? 'Remove the picture “' : 'Change the picture “').str_replace('_', ' ', (string) $id).'”';
        }
        if ($segment === 'branding') {
            return ($method === 'DELETE' ? 'Remove the ' : 'Change the ').str_replace('_', ' ', (string) $id);
        }
        if ($segment === 'content') {
            $type = str_replace('-', ' ', (string) $id);

            return match (true) {
                count($parts) === 3 => 'Add to '.$type,
                $method === 'DELETE' => 'Delete from '.$type,
                default => 'Edit '.$type,
            };
        }

        if ($segment === 'voice-queries') {
            return match (true) {
                $method === 'DELETE' => 'Delete a voice query',
                filter_var($input['answered'] ?? false, FILTER_VALIDATE_BOOLEAN) => 'Mark a voice query as answered',
                default => 'Mark a voice query as new',
            };
        }

        [, $field, $noun] = self::MODELS[$segment] ?? [null, null, str_replace('-', ' ', $segment)];
        $name = ($model = self::model($segment, $id)) ? (string) $model->{$field} : '';
        if ($segment === 'returns' && $model) {
            $name = 'order '.($model->order?->order_number ?? '#'.$model->id);
        }
        $named = $name !== '' ? ($segment === 'returns' ? $name : '“'.mb_strimwidth($name, 0, 60, '…').'”') : '';

        if ($id === null) {
            $new = $input['name'] ?? $input['title'] ?? $input['code'] ?? $input['heading'] ?? null;

            return 'Add a '.$noun.(is_string($new) && $new !== '' ? ' “'.mb_strimwidth($new, 0, 60, '…').'”' : '');
        }

        return match (true) {
            $sub === '' && $method === 'DELETE' => 'Delete the '.$noun.' '.$named,
            $sub === '' => 'Edit the '.$noun.' '.$named,
            $sub === 'image' => ($method === 'DELETE' ? 'Remove the main photo of ' : 'Change the main photo of ').$named,
            $sub === 'gallery' => 'Add photos to '.$named,
            str_starts_with($sub, 'gallery/') => 'Remove a photo from '.$named,
            $sub === 'video' => ($method === 'DELETE' ? 'Remove the video of ' : 'Change the video of ').$named,
            in_array($sub, ['photo', 'logo'], true) => 'Remove the '.$sub.' of '.$named,
            $sub === 'seo' => 'Edit the search-engine details of '.$named,
            $sub === 'status' => 'Mark order '.$name.' as '.(is_string($input['status'] ?? null) ? $input['status'] : 'changed'),
            $sub === 'shiprocket' => 'Send order '.$name.' to Shiprocket',
            $sub === 'shiprocket/awb' => 'Assign a courier to order '.$name,
            $sub === 'awb' => 'Add AWB '.(is_string($input['awb_code'] ?? null) ? $input['awb_code'].' ' : '').'to order '.$name,
            in_array($sub, ['approve', 'reject', 'complete', 'book-pickup'], true) => match ($sub) {
                'approve' => 'Approve the return for '.$name,
                'reject' => 'Reject the return for '.$name,
                'complete' => 'Complete the return for '.$name,
                default => 'Book the pickup for the return of '.$name,
            },
            default => ($method === 'DELETE' ? 'Delete' : 'Change').' the '.$noun.' '.$named.' ('.str_replace('/', ' ', $sub).')',
        };
    }

    /** A field's name as a person would say it: "compare_at_price" → "Compare at price". */
    private static function label(string $key): string
    {
        return ['awb_code' => 'AWB number', 'courier_name' => 'Courier'][$key]
            ?? ucfirst(str_replace(['_', '.'], [' ', ' › '], $key));
    }

    /** One short line for a value; null when there is nothing. */
    private static function show(mixed $value): ?string
    {
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        if (is_array($value)) {
            $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        if ($value === null) {
            return null;
        }

        $text = trim(preg_replace('/\s+/u', ' ', strip_tags((string) $value)) ?? '');

        return $text === '' ? null : mb_strimwidth($text, 0, 300, '…');
    }

    private static function apiPath(Request $request): string
    {
        return preg_replace('#^api/v\d+/#', '', trim($request->path(), '/')) ?? '';
    }

    private static function write(array $change): void
    {
        self::disk()->put(
            self::dir().'/'.$change['id'].'/change.json',
            (string) json_encode($change, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
        );
    }

    /** Clear away changes decided long ago. */
    private static function prune(): void
    {
        $cutoff = now()->subDays(self::KEEP_DAYS)->toIso8601String();
        foreach (self::all(fn ($c) => $c['status'] !== 'pending' && (string) $c['decided_at'] < $cutoff) as $old) {
            self::disk()->deleteDirectory(self::dir().'/'.$old['id']);
        }
    }

    private static function disk()
    {
        return Storage::disk('local');
    }

    /**
     * One folder per database: the owner's computer runs a test copy beside the
     * real shop from the same files, and a test change must never be approved
     * into the real shop.
     */
    private static function dir(): string
    {
        $database = (string) config('database.connections.'.config('database.default').'.database');

        return self::DIR.'/'.(preg_replace('/[^A-Za-z0-9_-]/', '', basename($database)) ?: 'default');
    }
}
