import { createClient } from '@/utils/supabase/client';

/**
 * Log an important action to the activity_logs table.
 *
 * @param action  Short action label, e.g. "Student Admitted"
 * @param details Free-form JSON payload with context
 * @param branchId  Current branch UUID (nullable — skips log if missing)
 */
export async function logActivity(
  action: string,
  details: Record<string, any>,
  branchId?: string | null
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !branchId) return; // silent no-op

    await supabase.from('activity_logs').insert({
      actor_id: user.id,
      action,
      details,
      branch_id: branchId,
    });
  } catch {
    // Fire-and-forget — never block the main flow
  }
}
