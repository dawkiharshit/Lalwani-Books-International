<?php

namespace App\Http\Middleware;

use App\Support\MailLater;
use App\Support\StaffAccess;
use App\Support\StaffChanges;
use Closure;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/**
 * The admin panel's door: the owner (is_admin) goes everywhere; a staff
 * member only into the areas the owner gave them (App\Support\StaffAccess).
 *
 * In an area set to "needs approval" a staff member's save is not run — it is
 * held for the owner (App\Support\StaffChanges) and answered with 202, so the
 * website only changes once the owner approves it.
 */
class AdminOrStaff
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user?->is_admin) {
            return $next($request);
        }

        $staff = StaffAccess::member($user);
        if (! $staff) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $segment = StaffAccess::segment($request);
        $reading = $request->isMethod('GET') || $request->isMethod('HEAD');

        // Their own changes and how they went — always theirs to see.
        if ($segment === 'my-changes' && $reading) {
            return $next($request);
        }
        // The lists every screen reads for its dropdowns.
        if ($reading && in_array($segment, StaffAccess::SHARED_READS, true)) {
            return $next($request);
        }

        $area = StaffAccess::areaFor($segment);
        if ($area === null) {
            return response()->json(['message' => 'Only the shop owner can open this.'], 403);
        }

        $level = $staff['areas'][$area] ?? StaffAccess::NONE;
        $label = StaffAccess::AREAS[$area][0];

        if ($reading) {
            return $level === StaffAccess::NONE
                ? response()->json(['message' => "You don't have access to {$label}."], 403)
                : $next($request);
        }

        return match ($level) {
            StaffAccess::DIRECT => $next($request),
            StaffAccess::APPROVAL => $this->hold($request, $user, $area),
            default => response()->json(['message' => "You can look at {$label}, but not change it."], 403),
        };
    }

    /** Keep the save for the owner instead of running it. */
    private function hold(Request $request, $user, string $area): Response
    {
        try {
            $change = StaffChanges::hold($request, $user, $area);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        // Let the owner know there is something to look at.
        $owner = (string) \App\Models\Setting::get('support_email', '');
        if ($owner !== '') {
            MailLater::raw(
                $owner,
                'Waiting for your approval: '.$change['title'],
                "{$user->name} sent a change for your approval:\n\n{$change['title']}\n\nIt is not live yet. Review it in the admin panel → Approvals.",
                'Approval request'
            );
        }

        return response()->json([
            'pending_approval' => true,
            'message' => 'Sent to the owner for approval — it goes live once they approve it.',
            'change' => ['id' => $change['id'], 'title' => $change['title']],
        ], 202);
    }
}
