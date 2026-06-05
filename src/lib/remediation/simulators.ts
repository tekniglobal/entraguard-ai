// Simulated remediation actions. In production these would call Microsoft
// Graph endpoints; here they return plausible response payloads so the audit
// log shows structured "API responses" the judges can read.

import type { ActionType, UserRow } from "@/lib/db/types";

export interface SimulationResult {
  ok: boolean;
  simulated: true;
  action_type: ActionType;
  graph_endpoint: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  completed_at: string;
}

export function simulate(
  actionType: ActionType,
  user: UserRow
): SimulationResult {
  const now = new Date().toISOString();
  switch (actionType) {
    case "force_password_reset":
      return {
        ok: true,
        simulated: true,
        action_type: actionType,
        graph_endpoint: `POST /users/${user.id}/authentication/methods/{methodId}/resetPassword`,
        request: { newPassword: null, requireChangeOnNextSignIn: true },
        response: { temporaryPassword: "Sm0kE-Sw4rD-2026!", expiresInMinutes: 60 },
        completed_at: now,
      };
    case "require_mfa":
      return {
        ok: true,
        simulated: true,
        action_type: actionType,
        graph_endpoint: `POST /identity/conditionalAccess/policies/{policyId}/userOverrides`,
        request: { userId: user.id, requireMfa: true, durationMinutes: 1440 },
        response: { policyId: "EntraGuard-AI-AdHoc", appliedAt: now },
        completed_at: now,
      };
    case "disable_account":
      return {
        ok: true,
        simulated: true,
        action_type: actionType,
        graph_endpoint: `PATCH /users/${user.id}`,
        request: { accountEnabled: false },
        response: {
          id: user.id,
          userPrincipalName: user.upn,
          accountEnabled: false,
          "@odata.context":
            "https://graph.microsoft.com/v1.0/$metadata#users/$entity",
        },
        completed_at: now,
      };
    case "revoke_sessions":
      return {
        ok: true,
        simulated: true,
        action_type: actionType,
        graph_endpoint: `POST /users/${user.id}/revokeSignInSessions`,
        request: {},
        response: { value: true, revokedSessions: 4, completedAt: now },
        completed_at: now,
      };
    case "review_privileged_activity":
      return {
        ok: true,
        simulated: true,
        action_type: actionType,
        graph_endpoint: `GET /auditLogs/directoryAudits?$filter=initiatedBy/user/id eq '${user.id}'`,
        request: { lookbackDays: 7 },
        response: {
          ticketCreated: "INC-2026-06-05-0142",
          assignedTo: "soc-team@contoso.com",
        },
        completed_at: now,
      };
    case "notify_user":
      return {
        ok: true,
        simulated: true,
        action_type: actionType,
        graph_endpoint: `POST /users/${user.id}/sendMail`,
        request: {
          subject: "Suspicious sign-in detected on your account",
          to: user.upn,
        },
        response: { messageId: "AAMkAGI2...", sentAt: now },
        completed_at: now,
      };
    case "no_action":
      return {
        ok: true,
        simulated: true,
        action_type: actionType,
        graph_endpoint: "(none)",
        request: {},
        response: { result: "logged-only" },
        completed_at: now,
      };
  }
}
