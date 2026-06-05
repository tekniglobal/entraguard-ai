import type { SignInRow, UserRow } from "@/lib/db/types";

export interface RiskSignals {
  user_is_privileged: boolean;
  geo_unusual: boolean;
  geo_country_baseline: string | null;
  geo_observed_country: string | null;
  off_hours: boolean;
  observed_hour_local: number | null;
  device_unmanaged: boolean;
  device_unknown_os: boolean;
  legacy_auth: boolean;
  client_app_observed: string | null;
  tor_or_anon_ip: boolean;
  mfa_satisfied: boolean;
  mfa_detail_observed: string | null;
  failed_auth: boolean;
  is_non_interactive: boolean;
  is_service_principal: boolean;
}

const LEGACY_AUTH_CLIENT_APPS = new Set([
  "POP3",
  "IMAP4",
  "Exchange ActiveSync",
  "Other clients",
  "SMTP",
  "Authenticated SMTP",
  "Exchange Online PowerShell",
]);

export function computeSignals(
  signIn: SignInRow,
  user: UserRow
): RiskSignals {
  const observedDate = new Date(signIn.created_at_event);
  // Approximate "local" hour using UTC since fixtures don't carry tz offsets
  // in the demo; production would compute from city.
  const observedHourLocal = observedDate.getUTCHours();

  const offHours =
    user.usual_hours_start !== null &&
    user.usual_hours_end !== null &&
    (observedHourLocal < user.usual_hours_start ||
      observedHourLocal > user.usual_hours_end);

  const geoUnusual =
    !!signIn.country &&
    !!user.usual_country &&
    signIn.country.toUpperCase() !== user.usual_country.toUpperCase();

  const deviceUnmanaged = signIn.is_managed_device === false;
  const deviceUnknownOs =
    !signIn.device_os ||
    (!!user.usual_device_os &&
      !signIn.device_os
        .toLowerCase()
        .includes(user.usual_device_os.toLowerCase().split(" ")[0]));

  const legacyAuth =
    !!signIn.client_app && LEGACY_AUTH_CLIENT_APPS.has(signIn.client_app);

  const mfaSatisfied = signIn.mfa_detail === "mfaCompleted";

  const failedAuth = (signIn.status_code ?? 0) !== 0;

  return {
    user_is_privileged: user.is_privileged,
    geo_unusual: geoUnusual,
    geo_country_baseline: user.usual_country,
    geo_observed_country: signIn.country,
    off_hours: offHours,
    observed_hour_local: observedHourLocal,
    device_unmanaged: deviceUnmanaged,
    device_unknown_os: deviceUnknownOs,
    legacy_auth: legacyAuth,
    client_app_observed: signIn.client_app,
    tor_or_anon_ip: signIn.is_tor_or_anon,
    mfa_satisfied: mfaSatisfied,
    mfa_detail_observed: signIn.mfa_detail,
    failed_auth: failedAuth,
    is_non_interactive: !signIn.is_interactive,
    is_service_principal: user.display_name.toLowerCase().includes("service"),
  };
}

// Deterministic fallback score when Azure OpenAI is unavailable.
// Weighted-sum across signals, clamped to [0, 100].
export function heuristicScore(signals: RiskSignals): number {
  let score = 0;
  if (signals.tor_or_anon_ip) score += 35;
  if (signals.geo_unusual) score += 20;
  if (signals.device_unmanaged) score += 15;
  if (signals.off_hours) score += 10;
  if (!signals.mfa_satisfied && !signals.is_non_interactive) score += 15;
  if (signals.legacy_auth) score += 20;
  if (signals.user_is_privileged) score *= 1.25; // amplifier
  if (signals.failed_auth) score += 10;
  if (signals.is_non_interactive && signals.geo_unusual) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function verdictFromScore(
  score: number
): "benign" | "suspicious" | "malicious" {
  if (score >= 81) return "malicious";
  if (score >= 51) return "malicious";
  if (score >= 21) return "suspicious";
  return "benign";
}
