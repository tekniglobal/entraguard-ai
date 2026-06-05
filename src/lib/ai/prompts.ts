import type { SignInRow } from "@/lib/db/types";
import type { UserBaseline } from "@/lib/risk/baseline";
import type { RiskSignals } from "@/lib/risk/heuristics";

export const SYSTEM_PROMPT = `You are EntraGuard AI, an identity threat analyst for Microsoft Entra ID.

Given a single sign-in event, the user's 30-day baseline, and pre-computed risk signals, you must:

1. Reason step-by-step about whether the sign-in is benign, suspicious, or malicious. Always weigh signals against the user's baseline — a new country alone is not automatically malicious; managed device + MFA + neighboring country can be legitimate travel.

2. Assign a risk_score from 0 to 100 using these anchors:
   - 0-20  benign — no action required
   - 21-50 suspicious — monitor, log, possibly notify the user
   - 51-80 likely compromised — recommend remediation, require human approval
   - 81-100 high-confidence compromise — recommend aggressive remediation immediately

3. Recommend zero or more remediation actions from this exact enum:
   - force_password_reset
   - require_mfa
   - disable_account
   - revoke_sessions
   - review_privileged_activity
   - notify_user
   - no_action

4. For each action, give a one-sentence rationale and a severity (low | medium | high | critical).

Constraints:
- Be concise. Cite specific signals (e.g. "Tor exit node IP, unmanaged Windows 10, MFA bypassed via legacy authentication exemption").
- Never invent facts not present in the input.
- For privileged users (Global Admin, Exchange Admin, etc.), bias toward stricter scoring.
- For service principals / non-interactive sign-ins, focus on geo + legacy auth + protocol patterns; MFA fields are typically null and that is expected.
`;

export function userPrompt(
  signIn: SignInRow,
  baseline: UserBaseline,
  signals: RiskSignals
): string {
  return [
    "SIGN-IN EVENT:",
    JSON.stringify(serialiseSignIn(signIn), null, 2),
    "",
    "USER BASELINE (last 30 days):",
    JSON.stringify(baseline, null, 2),
    "",
    "PRE-COMPUTED SIGNALS:",
    JSON.stringify(signals, null, 2),
  ].join("\n");
}

function serialiseSignIn(s: SignInRow) {
  return {
    graph_id: s.graph_id,
    created_at_event: s.created_at_event,
    is_interactive: s.is_interactive,
    ip_address: s.ip_address,
    country: s.country,
    city: s.city,
    is_tor_or_anon: s.is_tor_or_anon,
    client_app: s.client_app,
    device_os: s.device_os,
    device_browser: s.device_browser,
    is_managed_device: s.is_managed_device,
    is_compliant_device: s.is_compliant_device,
    mfa_detail: s.mfa_detail,
    conditional_access_status: s.conditional_access_status,
    risk_level_aggregated: s.risk_level_aggregated,
    application_display_name: s.application_display_name,
    resource_display_name: s.resource_display_name,
    status_code: s.status_code,
    status_failure_reason: s.status_failure_reason,
  };
}
