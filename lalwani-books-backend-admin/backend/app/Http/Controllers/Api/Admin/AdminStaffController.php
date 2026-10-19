<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\StaffAccess;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Admin → Staff: the people the owner lets into the admin panel, and what
 * each may see or change. The owner's alone.
 */
class AdminStaffController extends Controller
{
    public function index()
    {
        return response()->json(['data' => $this->payload()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            // A new account: never an existing customer's, who would suddenly be let in.
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')],
            'password' => ['required', 'string', Password::min(8)],
        ] + $this->areaRules(), [
            'email.unique' => 'There is already an account with this email. Use another email for the staff member.',
        ]);

        $user = new User;
        $user->forceFill([
            'name' => trim($data['name']),
            'email' => strtolower(trim($data['email'])),
            'password' => $data['password'],
            'is_admin' => false,
            'email_verified_at' => now(),
        ])->save();

        StaffAccess::save($user->id, [
            'active' => true,
            'areas' => $data['areas'] ?? [],
            'added_at' => now()->toIso8601String(),
        ]);

        return response()->json(['data' => $this->payload(), 'message' => "{$user->name} can now sign in to the admin panel."], 201);
    }

    public function update(Request $request, User $user)
    {
        abort_unless(isset(StaffAccess::all()[$user->id]) && ! $user->is_admin, 404, 'No such staff member.');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'active' => ['sometimes', 'boolean'],
            'password' => ['nullable', 'string', Password::min(8)],
        ] + $this->areaRules());

        if (isset($data['name'])) {
            $user->forceFill(['name' => trim($data['name'])])->save();
        }
        if (! empty($data['password'])) {
            $user->forceFill(['password' => $data['password']])->save();
        }

        $entry = StaffAccess::all()[$user->id];
        StaffAccess::save($user->id, [
            'active' => $data['active'] ?? $entry['active'],
            'areas' => $data['areas'] ?? $entry['areas'],
        ]);

        // A paused staff member, or one with a new password, signs in again.
        if (($data['active'] ?? true) === false || ! empty($data['password'])) {
            $user->tokens()->delete();
        }

        return response()->json(['data' => $this->payload(), 'message' => 'Saved.']);
    }

    public function destroy(User $user)
    {
        abort_unless(isset(StaffAccess::all()[$user->id]) && ! $user->is_admin, 404, 'No such staff member.');

        StaffAccess::remove($user->id);
        $user->tokens()->delete();
        // The account goes too, unless it has orders of its own to keep.
        if (! \App\Models\Order::where('user_id', $user->id)->exists()) {
            $user->delete();
        }

        return response()->json(['data' => $this->payload(), 'message' => 'Removed.']);
    }

    /** One level per area; areas left out stay as they were (or "no access"). */
    private function areaRules(): array
    {
        return [
            'areas' => ['sometimes', 'array'],
            'areas.*' => ['string', Rule::in(StaffAccess::LEVELS)],
        ];
    }

    private function payload(): array
    {
        $entries = StaffAccess::all();
        $users = User::whereIn('id', array_keys($entries))->get()->keyBy('id');

        return [
            'areas' => StaffAccess::areas(),
            'staff' => collect($entries)
                ->filter(fn ($entry, $id) => $users->has($id))
                ->map(fn ($entry, $id) => [
                    'id' => $id,
                    'name' => $users[$id]->name,
                    'email' => $users[$id]->email,
                    'active' => $entry['active'],
                    'areas' => $entry['areas'],
                    'added_at' => $entry['added_at'],
                ])
                ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
                ->all(),
        ];
    }
}
