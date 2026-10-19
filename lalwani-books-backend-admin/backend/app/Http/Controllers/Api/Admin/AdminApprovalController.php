<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\MailLater;
use App\Support\StaffChanges;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Admin → Approvals: staff changes waiting for the owner. Approving runs the
 * change as the owner, so it goes live; rejecting closes it with a reason
 * the staff member sees.
 */
class AdminApprovalController extends Controller
{
    public function index(Request $request)
    {
        $pending = $request->query('status', 'pending') === 'pending';
        $changes = StaffChanges::all(fn ($c) => $pending ? $c['status'] === 'pending' : $c['status'] !== 'pending');

        return response()->json(['data' => array_map(
            [StaffChanges::class, 'describe'],
            array_slice($changes, 0, $pending ? 200 : 60)
        )]);
    }

    public function count()
    {
        return response()->json(['data' => ['pending' => StaffChanges::pendingCount()]]);
    }

    public function approve(Request $request, string $id)
    {
        $change = $this->pending($id);

        try {
            [$ok, $message] = StaffChanges::apply($change, $request);
        } catch (RuntimeException $e) {
            [$ok, $message] = [false, $e->getMessage()];
        }

        if (! $ok) {
            // Stays waiting, with the reason, so it can be rejected or tried again.
            StaffChanges::failed($change, $message);

            return response()->json(['message' => 'Could not make this change: '.$message], 422);
        }

        $change = StaffChanges::decide($change, 'approved', $request->user());
        $this->tellStaff($change, 'approved and is now live on the website.');

        return response()->json(['data' => StaffChanges::describe($change), 'message' => 'Approved — it is live now.']);
    }

    public function reject(Request $request, string $id)
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $change = StaffChanges::decide($this->pending($id), 'rejected', $request->user(), $data['reason'] ?? null);
        $this->tellStaff($change, 'not approved.'.($change['reason'] ? "\n\nReason: {$change['reason']}" : ''));

        return response()->json(['data' => StaffChanges::describe($change), 'message' => 'Rejected — nothing changed on the website.']);
    }

    /** A photo sent with a change, to look at before approving. */
    public function file(string $id, int $index)
    {
        $change = StaffChanges::get($id);
        $file = $change ? StaffChanges::file($change, $index) : null;
        abort_unless($file, 404);

        return response()->file($file['full'], [
            'Content-Type' => $file['mime'],
            'Content-Disposition' => 'inline; filename="photo"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /** A staff member's own changes and how they went (any staff member). */
    public function mine(Request $request)
    {
        $id = $request->user()->id;

        return response()->json(['data' => array_map(
            [StaffChanges::class, 'describe'],
            array_slice(StaffChanges::all(fn ($c) => (int) $c['staff']['id'] === $id), 0, 60)
        )]);
    }

    private function pending(string $id): array
    {
        $change = StaffChanges::get($id);
        abort_unless($change, 404, 'No such change.');
        abort_unless($change['status'] === 'pending', 422, 'This change has already been decided.');

        return $change;
    }

    private function tellStaff(array $change, string $outcome): void
    {
        $staff = User::find((int) $change['staff']['id']);
        if ($staff?->email) {
            MailLater::raw(
                $staff->email,
                'Your change: '.$change['title'],
                "Hi {$staff->name},\n\nYour change “{$change['title']}” was {$outcome}",
                'Approval outcome'
            );
        }
    }
}
