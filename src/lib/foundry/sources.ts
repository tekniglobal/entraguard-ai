// Bundled threat-intelligence knowledge sources used as the Foundry IQ
// fallback when no live KB is configured. Every entry references a real,
// publicly accessible Microsoft / MITRE / CISA document so citations are
// verifiable.
//
// In production this exact same content would live inside an Azure AI
// Search knowledge base behind Foundry IQ. The shape matches what Foundry
// IQ returns so the rest of the app doesn't care which path produced the
// citations.

import type { KnowledgeSource } from "@/lib/foundry/types";

export const KNOWLEDGE_BASE: KnowledgeSource[] = [
  {
    id: "ms-entra-risk-detections",
    title: "Microsoft Entra Identity Protection — Risk detections",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/entra/id-protection/concept-identity-protection-risks",
    snippet:
      "Risk detections include sign-ins from anonymous IP addresses (e.g. Tor exit nodes), atypical travel, malware-linked IPs, leaked credentials, and password spray. Anonymous IP detections on privileged accounts should be treated as high-confidence indicators of compromise.",
    anchor_signals: ["tor_or_anon_ip", "geo_unusual", "user_is_privileged"],
  },
  {
    id: "ms-entra-conditional-access-baseline",
    title: "Conditional Access — Microsoft Entra hardening baseline",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-policies",
    snippet:
      "All privileged role assignments must require multi-factor authentication. Legacy authentication exemptions should be eliminated; any successful sign-in to a privileged account that bypassed MFA via legacy auth fallback warrants immediate investigation and remediation.",
    anchor_signals: [
      "user_is_privileged",
      "legacy_auth",
      "mfa_satisfied",
      "mfa_detail_observed",
    ],
  },
  {
    id: "ms-zero-trust-id",
    title: "Zero Trust deployment guidance — Identity pillar",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/security/zero-trust/deploy/identity",
    snippet:
      "Verify explicitly: every access request must be authenticated and authorized based on all available data points including user identity, location, device health, service or workload, data classification, and anomalies.",
    anchor_signals: [
      "user_is_privileged",
      "device_unmanaged",
      "geo_unusual",
    ],
  },
  {
    id: "mitre-t1078-004",
    title: "MITRE ATT&CK T1078.004 — Valid Accounts: Cloud Accounts",
    publisher: "MITRE ATT&CK",
    url: "https://attack.mitre.org/techniques/T1078/004/",
    snippet:
      "Adversaries may obtain and abuse credentials of a cloud account as a means of gaining Initial Access, Persistence, Privilege Escalation, or Defense Evasion. Cloud accounts may be created and authenticated against in ways that do not generate visible alerts in on-premises tooling.",
    anchor_signals: [
      "user_is_privileged",
      "geo_unusual",
      "is_service_principal",
    ],
  },
  {
    id: "mitre-t1556-009",
    title: "MITRE ATT&CK T1556.009 — Modify Authentication Process: Conditional Access Policies",
    publisher: "MITRE ATT&CK",
    url: "https://attack.mitre.org/techniques/T1556/009/",
    snippet:
      "Adversaries may disable or modify conditional access policies to enable persistent access to compromised accounts. Anomalous successful sign-ins where MFA was 'notRequired' should be cross-checked against recent CA policy changes.",
    anchor_signals: ["mfa_satisfied", "user_is_privileged"],
  },
  {
    id: "ms-block-legacy-auth",
    title: "Block legacy authentication protocols in Microsoft Entra",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-block-legacy-authentication",
    snippet:
      "Legacy authentication protocols (POP3, IMAP4, SMTP AUTH, Exchange ActiveSync, Exchange Online PowerShell) do not support modern security controls such as MFA. Microsoft recommends blocking legacy auth via a conditional access policy; over 99% of password-spray attacks succeed against legacy authentication.",
    anchor_signals: ["legacy_auth", "client_app_observed"],
  },
  {
    id: "cisa-aa22-074a",
    title: "CISA AA22-074A — Russian state-sponsored cyber actors target cleared defense contractors",
    publisher: "CISA",
    url: "https://www.cisa.gov/news-events/cybersecurity-advisories/aa22-074a",
    snippet:
      "Russian state-sponsored actors have used brute-force methods, MFA defeat techniques, and exploitation of misconfigured MFA policies (PrintNightmare, default accounts) to gain initial access and exfiltrate sensitive data via legitimate cloud credentials.",
    anchor_signals: ["geo_observed_country", "user_is_privileged"],
  },
  {
    id: "ms-defender-impossible-travel",
    title: "Microsoft Defender for Cloud Apps — Impossible travel detection",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/defender-cloud-apps/anomaly-detection-policy",
    snippet:
      "Impossible travel detects when a user signs in from two distant locations within a time window that cannot be explained by reasonable travel. A 30-day learning period builds the user's baseline so genuine travel does not generate alerts.",
    anchor_signals: ["geo_unusual"],
  },
  {
    id: "ms-priv-role-monitor",
    title: "Monitor and investigate privileged role assignments",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-how-to-use-audit-log",
    snippet:
      "Global Administrator and Privileged Role Administrator assignments should be reviewed at least monthly; any anomalous sign-in on these accounts should trigger an audit log review covering the prior 7 days for unusual administrative actions.",
    anchor_signals: ["user_is_privileged"],
  },
  {
    id: "ms-service-principal-misuse",
    title: "Investigate and remediate risky service principals",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/entra/id-protection/concept-workload-identity-risk",
    snippet:
      "Service principals with unusual sign-in locations or protocol changes should be considered potentially compromised. Rotate credentials, revoke sessions, and audit assigned API permissions including any directory or mail.send roles.",
    anchor_signals: [
      "is_service_principal",
      "is_non_interactive",
      "geo_unusual",
    ],
  },
  {
    id: "ms-managed-device-policy",
    title: "Require compliant or hybrid Azure AD joined device for access",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-alt-all-users-compliant-hybrid-or-mfa",
    snippet:
      "For privileged users, access from non-managed and non-compliant devices is an explicit policy violation. Combine device compliance with MFA to harden against credential theft.",
    anchor_signals: ["device_unmanaged", "user_is_privileged"],
  },
  {
    id: "ms-off-hours-anomaly",
    title: "Insider risk patterns — Off-hours access",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/purview/insider-risk-management-policies",
    snippet:
      "Single off-hours sign-ins from a managed device in the user's normal geography are low-risk individually. Patterns of repeated off-hours access, especially against sensitive resources, warrant a soft notification rather than immediate enforcement.",
    anchor_signals: ["off_hours"],
  },
  {
    id: "ms-revoke-sessions",
    title: "Revoke user sign-in sessions in Microsoft Entra",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/entra/identity/users/users-revoke-access",
    snippet:
      "Revoking sign-in sessions invalidates all active refresh and access tokens. Combined with a forced password reset, this is the standard remediation for confirmed credential compromise.",
    anchor_signals: [],
  },
  {
    id: "ms-disable-account",
    title: "Block or disable a user in Microsoft Entra",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/entra/identity/users/users-bulk-block",
    snippet:
      "Setting accountEnabled to false immediately prevents new sign-ins and is the recommended first action for high-confidence compromise on privileged accounts pending investigation.",
    anchor_signals: ["user_is_privileged"],
  },
  {
    id: "ms-atypical-travel-rationale",
    title: "Atypical travel risk — investigation guidance",
    publisher: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/entra/id-protection/howto-identity-protection-investigate-risk",
    snippet:
      "A sign-in from an adjacent country during business hours on a previously-seen managed device with successful MFA should typically not be treated as malicious. Validate against the user's recent travel context before recommending enforcement actions.",
    anchor_signals: ["geo_unusual", "mfa_satisfied"],
  },
];
