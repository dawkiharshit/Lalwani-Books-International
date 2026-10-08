<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Support\GatewayCredentials;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Shiprocket adhoc-order creation, courier assignment and tracking.
 *
 * The login token is valid for 10 days; it is cached for 9 so a burst of
 * dispatches does not re-authenticate on every call.
 */
class Shiprocket
{
    private const TOKEN_KEY = 'shiprocket_token';

    public static function enabled(): bool
    {
        return GatewayCredentials::has('shiprocket_email')
            && GatewayCredentials::has('shiprocket_password');
    }

    private static function base(): string
    {
        $base = trim((string) config('gateways.shiprocket.base'));

        return rtrim($base !== '' ? $base : 'https://apiv2.shiprocket.in/v1/external', '/');
    }

    public static function token(bool $fresh = false): string
    {
        if ($fresh) {
            Cache::forget(self::TOKEN_KEY);
        }

        return Cache::remember(self::TOKEN_KEY, now()->addDays(9), function () {
            $res = Http::acceptJson()->timeout(20)->post(self::base().'/auth/login', [
                'email' => GatewayCredentials::get('shiprocket_email'),
                'password' => GatewayCredentials::get('shiprocket_password'),
            ]);

            if (! $res->successful() || ! $res->json('token')) {
                Log::error('Shiprocket auth failed', ['status' => $res->status(), 'body' => $res->body()]);
                throw new RuntimeException(self::loginFailure($res->status(), $res->json()));
            }

            return (string) $res->json('token');
        });
    }

    /**
     * Why the login failed, in words the admin can act on.
     *
     * Shiprocket answers a wrong login with 403 "Invalid email and password
     * combination", and the usual cause is entering the normal Shiprocket
     * login: its API accepts only an API user's email and password, which the
     * old "check the email and password" never said.
     */
    private static function loginFailure(int $status, ?array $json): string
    {
        $reason = self::readableError($json, '');
        $quoted = $reason !== '' ? ' ("'.rtrim($reason, '.').'")' : '';

        if ($status >= 500) {
            return "Shiprocket is not answering right now ({$status}). Try again in a few minutes.";
        }

        if (in_array($status, [400, 401, 403, 422], true)) {
            return "Shiprocket refused the login{$quoted}. Enter the email and password of a Shiprocket API user, "
                .'not your normal Shiprocket login. To make one, open Shiprocket → Settings → API → Configure → '
                .'Create an API User, using an email that is different from your Shiprocket account email.';
        }

        return "Shiprocket login failed{$quoted}. Try again, or check the API user's email and password.";
    }

    private static function client()
    {
        return Http::withToken(self::token())->acceptJson()->timeout(25);
    }

    /** Is this PIN code deliverable, and what would it cost? */
    public static function serviceability(string $pin, float $weightKg = 0.5, bool $cod = false): array
    {
        $pickup = GatewayCredentials::get('shiprocket_pickup_pin');

        // Without our own PIN the request is malformed, not unserviceable —
        // say so plainly instead of letting it look like "nobody delivers".
        if ($pickup === '') {
            throw new RuntimeException('Set the Shiprocket pickup PIN code before asking for rates.');
        }

        $res = self::client()->get(self::base().'/courier/serviceability/', [
            'pickup_postcode' => $pickup,
            'delivery_postcode' => $pin,
            'weight' => $weightKg,
            'cod' => $cod ? 1 : 0,
        ]);

        // A 4xx means we asked wrongly. Only a successful answer with an empty
        // courier list genuinely means the address cannot be reached.
        if (! $res->successful()) {
            Log::warning('Shiprocket serviceability rejected the request', [
                'status' => $res->status(),
                'body' => $res->body(),
            ]);

            throw new RuntimeException('Shiprocket could not price this shipment.');
        }

        return $res->json() ?? [];
    }

    /** Push the order to Shiprocket as an adhoc order. */
    public static function createOrder(Order $order): array
    {
        // Pressing the button twice used to book two shipments for one parcel.
        if ($order->shiprocket_order_id) {
            throw new RuntimeException('This order is already with Shiprocket.');
        }

        if ($order->status === 'cancelled') {
            throw new RuntimeException('This order was cancelled — it cannot be shipped.');
        }

        $order->loadMissing('items.product');

        $items = $order->items->map(fn ($i) => [
            'name' => $i->name,
            'sku' => $i->product?->sku ?: ('ITEM-'.$i->id),
            'units' => (int) $i->quantity,
            'selling_price' => (float) $i->unit_price,
        ])->values()->all();

        if (empty($items)) {
            throw new RuntimeException('This order has no items to ship.');
        }

        $name = trim((string) $order->ship_name);
        $parts = preg_split('/\s+/', $name, 2);

        $payload = [
            'order_id' => $order->order_number,
            'order_date' => optional($order->placed_at ?? $order->created_at)->format('Y-m-d H:i'),
            'pickup_location' => GatewayCredentials::get('shiprocket_pickup_location', 'Primary'),
            'billing_customer_name' => $parts[0] ?: 'Customer',
            'billing_last_name' => $parts[1] ?? '',
            'billing_address' => (string) $order->ship_address1,
            'billing_address_2' => (string) $order->ship_address2,
            'billing_city' => (string) $order->ship_city,
            'billing_pincode' => (string) $order->ship_zip,
            'billing_state' => (string) $order->ship_state,
            'billing_country' => $order->ship_country ?: 'India',
            'billing_email' => (string) $order->email,
            'billing_phone' => substr(preg_replace('/\D/', '', (string) $order->ship_phone), -10),
            'shipping_is_billing' => true,
            'order_items' => $items,
            // What the customer CHOSE, never what has settled yet. Reading
            // payment_status here turned an unconfirmed online order into a
            // COD one, and the courier would collect a second time.
            'payment_method' => $order->payment_method === 'cod' ? 'COD' : 'Prepaid',
            'sub_total' => (float) $order->total,
            // Shiprocket rejects zeroes, so the box stays a sensible default —
            // but the weight is now the real sum of what is in it.
            'length' => 10, 'breadth' => 8, 'height' => 6,
            'weight' => self::parcelWeightKg($order),
        ];

        if ($cid = GatewayCredentials::get('shiprocket_channel_id')) {
            $payload['channel_id'] = $cid;
        }

        $res = self::client()->post(self::base().'/orders/create/adhoc', $payload);
        $data = is_array($res->json()) ? $res->json() : [];

        // Only an order and shipment id mean Shiprocket made the order. It can
        // answer 200 without them — a pickup nickname it does not know comes
        // back that way — and that used to pass as success: nothing was sent,
        // nothing was logged, and the admin saw nothing happen.
        if (! $res->successful() || empty($data['order_id']) || empty($data['shipment_id'])) {
            Log::error('Shiprocket order create failed', [
                'order' => $order->order_number,
                'status' => $res->status(),
                'body' => $res->body(),
            ]);

            $message = self::readableError($data ?: null, 'Shiprocket did not create this order.');

            throw new RuntimeException(self::explainPickupFailure($message, $payload['pickup_location']));
        }

        $order->forceFill([
            'shiprocket_order_id' => $data['order_id'] ?? null,
            'shiprocket_shipment_id' => $data['shipment_id'] ?? null,
        ])->save();

        return $data;
    }

    /**
     * Book a reverse pickup for a return: the customer's address is the pickup,
     * the shop's return address the destination. Needs the shop return address
     * set in admin — without it we can't tell the courier where to drop the box.
     */
    public static function createReturnOrder(Order $order, array $items): array
    {
        $setting = fn (string $key, string $default = '') => (string) \App\Models\Setting::get($key, $default);

        // Prefer the dedicated return address; fall back to invoice/pickup.
        $sellerName = $setting('return_name') ?: ($setting('invoice_seller_name') ?: $setting('site_name', 'Lalwani Books International'));
        $sellerAddr = trim($setting('return_address'))
            ?: trim((string) (preg_split('/\r\n|\r|\n/', $setting('invoice_address') ?: $setting('contact_address'))[0] ?? ''));
        $sellerAddr = trim(str_replace(["\r\n", "\r", "\n"], ', ', $sellerAddr));
        $sellerCity = $setting('return_city');
        $sellerState = $setting('return_state') ?: $setting('invoice_state');
        $sellerPin = $setting('return_pincode') ?: GatewayCredentials::get('shiprocket_pickup_pin');
        // Shiprocket wants a bare 10-digit number — drop a leading 0 or +91.
        $sellerPhone = substr(preg_replace('/\D/', '', $setting('return_phone') ?: ($setting('support_phone') ?: $setting('invoice_phone'))), -10);

        /*
         * Name which fields are actually missing, and where they live.
         *
         * The old message listed all six every time and said only "in admin",
         * so someone who had filled some of them in — or who had set a pickup
         * address in Shiprocket itself, which is a different thing entirely —
         * had no way to tell what it still wanted. It also asked for a name,
         * which is not part of this check at all: it always falls back to the
         * site name.
         */
        $missing = array_keys(array_filter([
            'Address' => $sellerAddr === '',
            'City' => $sellerCity === '',
            'State' => $sellerState === '',
            'PIN code' => $sellerPin === '',
            'Phone' => $sellerPhone === '',
        ]));

        if ($missing !== []) {
            throw new RuntimeException(
                'Cannot book the reverse pickup — the shop return address is missing: '
                .implode(', ', $missing).'. '
                .'Set it in admin → Shipping & Tax → "Return address (reverse pickups)". '
                .'This is separate from the pickup address in your Shiprocket account: '
                .'that is where parcels are collected from, this is where returns come back to.'
            );
        }

        $lines = collect($items)->map(fn ($i) => [
            'name' => $i['name'] ?? 'Item',
            'sku' => $i['sku'] ?? ('ITEM-'.($i['product_id'] ?? 'X')),
            'units' => (int) ($i['quantity'] ?? 1),
            'selling_price' => (float) ($i['price'] ?? 0),
        ])->values()->all();

        $custParts = preg_split('/\s+/', trim((string) $order->ship_name), 2);

        $payload = [
            'order_id' => $order->order_number.'-R'.now()->format('His'),
            'order_date' => now()->format('Y-m-d H:i'),
            // Pickup — from the customer who is returning the parcel.
            'pickup_customer_name' => $custParts[0] ?: 'Customer',
            'pickup_last_name' => $custParts[1] ?? '',
            'pickup_address' => (string) $order->ship_address1,
            'pickup_address_2' => (string) $order->ship_address2,
            'pickup_city' => (string) $order->ship_city,
            'pickup_state' => (string) $order->ship_state,
            'pickup_country' => $order->ship_country ?: 'India',
            'pickup_pincode' => (string) $order->ship_zip,
            'pickup_email' => (string) $order->email,
            'pickup_phone' => substr(preg_replace('/\D/', '', (string) $order->ship_phone), -10),
            // Delivery — back to the shop.
            'shipping_customer_name' => $sellerName,
            'shipping_address' => $sellerAddr,
            'shipping_city' => $sellerCity,
            'shipping_country' => 'India',
            'shipping_pincode' => $sellerPin,
            'shipping_state' => $sellerState,
            'shipping_phone' => $sellerPhone,
            'order_items' => $lines,
            'payment_method' => 'PREPAID',
            'sub_total' => (float) collect($lines)->sum(fn ($l) => $l['selling_price'] * $l['units']),
            'length' => 10, 'breadth' => 8, 'height' => 6,
            'weight' => self::parcelWeightKg($order),
        ];

        if ($cid = GatewayCredentials::get('shiprocket_channel_id')) {
            $payload['channel_id'] = $cid;
        }

        $res = self::client()->post(self::base().'/orders/create/return', $payload);
        $data = is_array($res->json()) ? $res->json() : [];

        // As with orders: no ids means no pickup was booked, whatever the status.
        if (! $res->successful() || empty($data['order_id']) || empty($data['shipment_id'])) {
            Log::error('Shiprocket return create failed', [
                'order' => $order->order_number,
                'status' => $res->status(),
                'body' => $res->body(),
            ]);
            throw new RuntimeException(self::readableError($data ?: null, 'Shiprocket did not book the reverse pickup.'));
        }

        return $data;
    }

    /**
     * Total shipping weight in kilos: every item's own weight times its
     * quantity, plus packaging. A product with no weight entered falls back to
     * the default rather than shipping as zero.
     */
    public static function parcelWeightKg(Order $order): float
    {
        $order->loadMissing('items.product');

        $grams = $order->items->sum(
            fn ($i) => ($i->product?->weight_grams ?: Product::DEFAULT_WEIGHT_GRAMS) * (int) $i->quantity
        );

        // Box, filler and tape.
        $grams += (int) config('gateways.shiprocket.packaging_grams', 100);

        // Shiprocket refuses anything under 0.05 kg.
        return max(round($grams / 1000, 3), 0.05);
    }

    /** Book the cheapest recommended courier and get an AWB. */
    public static function assignAwb(Order $order, ?int $courierId = null): array
    {
        if (! $order->shiprocket_shipment_id) {
            throw new RuntimeException('Send this order to Shiprocket first.');
        }

        // Captured before the write so the notifier can tell a real move from
        // a re-run on an order that is already shipped.
        $was = $order->status;

        $body = ['shipment_id' => (int) $order->shiprocket_shipment_id];
        if ($courierId) {
            $body['courier_id'] = $courierId;
        }

        $res = self::client()->post(self::base().'/courier/assign/awb', $body);

        if (! $res->successful()) {
            Log::error('Shiprocket AWB failed', ['order' => $order->order_number, 'body' => $res->body()]);
            throw new RuntimeException(self::readableError($res->json(), 'Could not assign a courier.'));
        }

        $awb = $res->json('response.data') ?? [];

        $order->forceFill([
            'awb_code' => $awb['awb_code'] ?? null,
            'courier_name' => $awb['courier_name'] ?? null,
            'tracking_url' => isset($awb['awb_code'])
                ? 'https://shiprocket.co/tracking/'.$awb['awb_code']
                : null,
            'shipped_at' => now(),
            'status' => 'shipped',
        ])->save();

        // Booking a courier is the moment the customer wants to hear from us,
        // and the AWB is now on the order for the tracking link.
        \App\Support\OrderNotifier::statusChanged($order, $was, 'shipped');

        return $awb;
    }

    /** Live tracking for an AWB. */
    public static function track(string $awb): array
    {
        $res = self::client()->get(self::base().'/courier/track/awb/'.$awb);

        return $res->json() ?? [];
    }

    /**
     * The pickup addresses registered on the Shiprocket account, by nickname.
     *
     * @return array<int, string>
     */
    public static function pickupLocations(): array
    {
        $res = self::client()->get(self::base().'/settings/company/pickup');

        if (! $res->successful()) {
            return [];
        }

        // The key is null (not []) on an account with none registered.
        $rows = data_get($res->json(), 'data.shipping_address') ?: [];

        return array_values(array_filter(array_map(
            fn ($a) => is_array($a) ? ($a['pickup_location'] ?? null) : null,
            $rows
        )));
    }

    /**
     * Turns Shiprocket's pickup errors into one an admin can act on.
     *
     * "Please add billing/shipping address first" is returned when the
     * `pickup_location` nickname does not match a registered pickup address —
     * nothing to do with the customer's billing address, which the payload
     * always carries. Taken at face value it sends people to check the order.
     * A wrong nickname can also come back as "Wrong Pickup location entered".
     *
     * So when we see it, we ask the account what pickup addresses it actually
     * has and say precisely what is wrong. The extra call only happens on this
     * specific failure, and if it fails too we fall back to the original text
     * rather than swallowing the real error.
     */
    private static function explainPickupFailure(string $message, string $configured): string
    {
        if (! preg_match('/add (billing|shipping)|pickup location/i', $message)) {
            return $message;
        }

        try {
            $found = self::pickupLocations();
        } catch (\Throwable) {
            return $message;
        }

        if ($found === []) {
            return 'Shiprocket has no pickup address on this account yet, so it will not accept orders. '
                .'Add one in Shiprocket under Settings → Company → Pickup Addresses and complete the phone '
                ."verification, then make sure its nickname matches the one set here (\"{$configured}\").";
        }

        if (! in_array($configured, $found, true)) {
            return "Shiprocket has no pickup address nicknamed \"{$configured}\", which is what this store sends. "
                .'Registered nicknames are: '.implode(', ', array_map(fn ($n) => "\"{$n}\"", $found)).'. '
                .'Change the pickup location in admin → Delivery to match one of those, or rename it in Shiprocket.';
        }

        // The nickname matches, so it is the address itself Shiprocket is
        // unhappy with — usually pending phone verification or KYC.
        return "Shiprocket rejected the pickup address \"{$configured}\". It is registered but not usable yet — "
            .'check in Shiprocket that its phone number is verified and KYC is complete.';
    }

    private static function readableError(?array $json, string $fallback): string
    {
        if (! $json) {
            return $fallback;
        }

        // The field errors are the useful ones ("shipping phone must be 10
        // digits"); the generic "message" ("Oops! Invalid Data") says nothing.
        if (! empty($json['errors']) && is_array($json['errors'])) {
            $first = reset($json['errors']);

            return is_array($first) ? (string) reset($first) : (string) $first;
        }

        if (! empty($json['message']) && is_string($json['message'])) {
            return $json['message'];
        }

        return $fallback;
    }
}
