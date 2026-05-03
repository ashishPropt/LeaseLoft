import { corsHeaders, json, getUser, serviceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const user = await getUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const sb = serviceClient();
  const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin');
  if (!isAdmin) return json({ error: 'Forbidden' }, 403);

  // Body: { requestIds: string[] } — fetch latest status per (request, template) pair
  let requestIds: string[] = [];
  try {
    const body = await req.json();
    requestIds = Array.isArray(body?.requestIds) ? body.requestIds.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }
  if (requestIds.length === 0) return json({ statuses: {} });

  // Idempotency keys we use:
  //   invite-received-<email>-<ts>  (we cannot key by id — skip)
  //   invite-approved-<requestId>
  //   invite-rejected-<requestId>
  const keys = requestIds.flatMap((id) => [`invite-approved-${id}`, `invite-rejected-${id}`]);

  const { data, error } = await sb
    .from('email_send_log')
    .select('message_id,status,error_message,created_at,template_name')
    .in('message_id', keys)
    .order('created_at', { ascending: false });

  if (error) return json({ error: error.message }, 500);

  // Reduce: latest row per message_id; map back to requestId
  const latest = new Map<string, { status: string; error_message: string | null; created_at: string; template_name: string }>();
  for (const row of data ?? []) {
    if (!latest.has(row.message_id)) latest.set(row.message_id, row);
  }
  const statuses: Record<string, { template: 'approved' | 'rejected'; status: string; error: string | null; at: string }> = {};
  for (const [key, row] of latest) {
    const m = key.match(/^invite-(approved|rejected)-(.+)$/);
    if (!m) continue;
    const [, kind, reqId] = m;
    statuses[reqId] = {
      template: kind as 'approved' | 'rejected',
      status: row.status,
      error: row.error_message,
      at: row.created_at,
    };
  }

  return json({ statuses });
});
