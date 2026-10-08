<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Address;
use Illuminate\Http\Request;

/**
 * A signed-in customer's saved shipping addresses — the address book on the
 * account page, and the list checkout prefills from.
 */
class AddressController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(['data' => $this->listFor($request)]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        if ($user->addresses()->count() >= Address::MAX_PER_USER) {
            return response()->json([
                'message' => 'You can save up to '.Address::MAX_PER_USER.' addresses. Remove one to add another.',
            ], 422);
        }

        $data = $this->validated($request);
        // The first address is the default whether they ticked it or not.
        $makeDefault = ($data['is_default'] ?? false) || ! $user->addresses()->exists();
        unset($data['is_default']);

        $address = $user->addresses()->create($data + ['is_default' => false]);
        if ($makeDefault) {
            $address->makeDefault();
        }

        return response()->json(['data' => $this->listFor($request)], 201);
    }

    public function update(Request $request, Address $address)
    {
        $this->authorizeOwner($request, $address);

        $data = $this->validated($request);
        $makeDefault = $data['is_default'] ?? false;
        unset($data['is_default']);

        $address->update($data);
        if ($makeDefault) {
            $address->makeDefault();
        }

        return response()->json(['data' => $this->listFor($request)]);
    }

    public function makeDefault(Request $request, Address $address)
    {
        $this->authorizeOwner($request, $address);
        $address->makeDefault();

        return response()->json(['data' => $this->listFor($request)]);
    }

    public function destroy(Request $request, Address $address)
    {
        $this->authorizeOwner($request, $address);

        $wasDefault = $address->is_default;
        $address->delete();

        // Never leave someone with addresses but no default: the newest
        // remaining one takes over.
        if ($wasDefault) {
            $request->user()->addresses()->latest('id')->first()?->makeDefault();
        }

        return response()->json(['data' => $this->listFor($request)]);
    }

    /** Default first, then newest — the order checkout and the account page show. */
    private function listFor(Request $request): array
    {
        return $request->user()->addresses()
            ->orderByDesc('is_default')
            ->orderByDesc('id')
            ->get()
            ->map->toApi()
            ->all();
    }

    /** Same rules as checkout, so a saved address always passes at checkout. */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:30', new \App\Rules\IndianMobile],
            'address1' => ['required', 'string', 'max:190'],
            'address2' => ['nullable', 'string', 'max:190'],
            'city' => ['required', 'string', 'max:120'],
            'state' => ['required', 'string', 'max:120'],
            'zip' => ['required', 'string', 'regex:/^\d{6}$/'],
            'country' => ['nullable', 'string', 'max:60'],
            'is_default' => ['sometimes', 'boolean'],
        ], [
            'zip.regex' => 'Enter a 6-digit PIN code.',
        ]);

        $data['country'] = $data['country'] ?? 'India';

        return $data;
    }

    /** 404 rather than 403, so ids of other people's addresses aren't confirmed. */
    private function authorizeOwner(Request $request, Address $address): void
    {
        abort_unless((int) $address->user_id === (int) $request->user()->id, 404);
    }
}
