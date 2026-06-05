import { z } from "zod";

export const investigationSchema = z.object({
  risk_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "0 = definitely safe, 100 = definitely compromised. Use anchors: 0-20 benign, 21-50 suspicious, 51-80 likely compromised, 81-100 high-confidence compromise."
    ),
  verdict: z
    .enum(["benign", "suspicious", "malicious"])
    .describe("Categorical verdict derived from the risk_score."),
  summary: z
    .string()
    .max(200)
    .describe("One-line summary suitable for a Teams card title."),
  reasoning: z
    .string()
    .describe(
      "3-6 sentence plain-English analysis. Reference the user's baseline and cite specific signals. Markdown allowed."
    ),
  signals_cited: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "Short signal name e.g. 'Anonymized IP', 'Unmanaged device'."
          ),
        value: z
          .string()
          .describe("Concrete observed value e.g. 'Tor exit node 185.220.101.42'."),
        weight: z.enum(["low", "medium", "high"]),
      })
    )
    .describe("Discrete signals the model considered, ordered by importance."),
  recommended_actions: z
    .array(
      z.object({
        action_type: z.enum([
          "force_password_reset",
          "require_mfa",
          "disable_account",
          "revoke_sessions",
          "review_privileged_activity",
          "notify_user",
          "no_action",
        ]),
        rationale: z
          .string()
          .describe("One-sentence reason this action is recommended."),
        severity: z.enum(["low", "medium", "high", "critical"]),
      })
    )
    .describe(
      "Ordered list of remediations. Pick zero or more from the fixed enum. Use no_action only for clearly benign sign-ins."
    ),
});

export type InvestigationOutput = z.infer<typeof investigationSchema>;
