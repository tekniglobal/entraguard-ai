import type { SignInRow, UserRow } from "@/lib/db/types";
import type { UserBaseline } from "@/lib/risk/baseline";
import {
  computeSignals,
  heuristicScore,
  verdictFromScore,
} from "@/lib/risk/heuristics";
import type { InvestigationOutput } from "@/lib/ai/schema";

// Deterministic investigation builder. Produces output in the same shape as
// the AI would, derived purely from the signal weights. Used when Azure OpenAI
// is unavailable, errors out, or times out.

export function heuristicInvestigation(
  signIn: SignInRow,
  user: UserRow,
  baseline: UserBaseline
): InvestigationOutput {
  const signals = computeSignals(signIn, user);
  const score = heuristicScore(signals);
  const verdict = verdictFromScore(score);

  const reasoningParts: string[] = [];
  if (signals.user_is_privileged) {
    reasoningParts.push(
      `**${user.display_name}** is a **${
        user.privileged_role ?? "privileged account"
      }** with a baseline of ${baseline.sign_ins_observed_last_30d} sign-ins from ${
        baseline.countries_last_30d.join(", ") || "no recorded country"
      } over the last 30 days.`
    );
  } else {
    reasoningParts.push(
      `**${user.display_name}** has a baseline of ${baseline.sign_ins_observed_last_30d} sign-ins from ${
        baseline.countries_last_30d.join(", ") || "no recorded country"
      } over the last 30 days.`
    );
  }

  const observations: string[] = [];
  if (signals.geo_unusual)
    observations.push(
      `the sign-in originated from **${signIn.city ?? signIn.country}**, outside the baseline (${baseline.typical_country})`
    );
  if (signals.tor_or_anon_ip)
    observations.push(
      `the IP address ${signIn.ip_address} is a known Tor exit node`
    );
  if (signals.device_unmanaged)
    observations.push(`the device is **unmanaged** (${signIn.device_os})`);
  if (signals.off_hours)
    observations.push(
      `the access occurred at ${pad(signals.observed_hour_local)}:00 UTC, outside the user's typical hours (${baseline.typical_hours_local})`
    );
  if (signals.legacy_auth)
    observations.push(
      `authentication used a **legacy protocol** (${signIn.client_app}) which bypasses modern conditional access`
    );
  if (!signals.mfa_satisfied && !signals.is_non_interactive)
    observations.push(
      `MFA was **${signIn.mfa_detail ?? "not enforced"}** despite a privileged context`
    );

  if (observations.length === 0) {
    reasoningParts.push(
      "All observed signals match the user's baseline. This sign-in is consistent with normal activity."
    );
  } else {
    reasoningParts.push("Observed deviations: " + observations.join("; ") + ".");
  }

  if (verdict === "malicious") {
    reasoningParts.push(
      "Combined, these signals match a classic account-compromise pattern and warrant immediate remediation."
    );
  } else if (verdict === "suspicious") {
    reasoningParts.push(
      "Individually these signals are weak, but the combination merits review."
    );
  } else {
    reasoningParts.push(
      "No remediation is recommended; continue routine monitoring."
    );
  }

  const reasoning = reasoningParts.join("\n\n");

  const signalsCited: InvestigationOutput["signals_cited"] = [];
  if (signals.tor_or_anon_ip)
    signalsCited.push({
      name: "Anonymized IP",
      value: `${signIn.ip_address} (Tor exit node)`,
      weight: "high",
    });
  if (signals.geo_unusual)
    signalsCited.push({
      name: "Unusual geography",
      value: `${signIn.city ?? signIn.country} vs baseline ${baseline.typical_country}`,
      weight: "high",
    });
  if (signals.device_unmanaged)
    signalsCited.push({
      name: "Unmanaged device",
      value: `${signIn.device_os ?? "Unknown OS"}`,
      weight: "medium",
    });
  if (signals.off_hours)
    signalsCited.push({
      name: "Off-hours access",
      value: `${pad(signals.observed_hour_local)}:00 UTC`,
      weight: "medium",
    });
  if (!signals.mfa_satisfied && !signals.is_non_interactive)
    signalsCited.push({
      name: "MFA not satisfied",
      value: signIn.mfa_detail ?? "absent",
      weight: "high",
    });
  if (signals.legacy_auth)
    signalsCited.push({
      name: "Legacy authentication",
      value: signIn.client_app ?? "legacy protocol",
      weight: "high",
    });
  if (signals.user_is_privileged)
    signalsCited.push({
      name: "Privileged account",
      value: user.privileged_role ?? "privileged",
      weight: "high",
    });

  const recommended: InvestigationOutput["recommended_actions"] = [];
  if (verdict === "malicious") {
    recommended.push({
      action_type: "disable_account",
      rationale:
        "Privileged account shows multiple compromise indicators; suspend access pending investigation.",
      severity: "critical",
    });
    recommended.push({
      action_type: "revoke_sessions",
      rationale:
        "Active tokens may have been issued during the suspicious sign-in window.",
      severity: "high",
    });
    recommended.push({
      action_type: "force_password_reset",
      rationale: "Rotate credentials before reactivating the account.",
      severity: "high",
    });
  } else if (verdict === "suspicious") {
    recommended.push({
      action_type: "review_privileged_activity",
      rationale:
        "Review the user's recent actions to confirm the activity is intended.",
      severity: "medium",
    });
    recommended.push({
      action_type: "notify_user",
      rationale: "Contact the user to confirm this sign-in was theirs.",
      severity: "medium",
    });
    if (!signals.mfa_satisfied && !signals.is_non_interactive)
      recommended.push({
        action_type: "require_mfa",
        rationale:
          "Enforce MFA on the next sign-in to close the authentication gap.",
        severity: "medium",
      });
  } else {
    recommended.push({
      action_type: "no_action",
      rationale: "Sign-in matches the user's baseline; routine monitoring only.",
      severity: "low",
    });
  }

  const summary =
    verdict === "malicious"
      ? `Likely compromise of ${user.display_name} — immediate remediation recommended`
      : verdict === "suspicious"
        ? `Anomalous sign-in for ${user.display_name} — review recommended`
        : `Normal sign-in for ${user.display_name}`;

  return {
    risk_score: score,
    verdict,
    summary,
    reasoning,
    signals_cited: signalsCited,
    recommended_actions: recommended,
  };
}

function pad(n: number | null | undefined): string {
  if (n === null || n === undefined) return "--";
  return n.toString().padStart(2, "0");
}
