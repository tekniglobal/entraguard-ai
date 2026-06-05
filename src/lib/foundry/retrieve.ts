import type { RiskSignals } from "@/lib/risk/heuristics";
import type {
  Citation,
  KnowledgeSource,
  RetrievalResult,
} from "@/lib/foundry/types";
import { KNOWLEDGE_BASE } from "@/lib/foundry/sources";

// ----------------------------------------------------------------------------
// Foundry IQ retrieval
//
// Two modes:
//
// 1. **Configured** — when FOUNDRY_IQ_ENDPOINT (Azure AI Search resource URL)
//    and FOUNDRY_IQ_KNOWLEDGE_BASE + FOUNDRY_IQ_API_KEY are set, call the
//    Azure AI Search agentic-retrieval endpoint and surface its citations.
//    Endpoint shape:
//      POST {endpoint}/knowledgebases/{kb}/retrieve?api-version=2026-04-01
//
// 2. **Fallback** — when not configured, score the bundled KNOWLEDGE_BASE
//    against the heuristic signals and return the top matches. Same shape
//    as the real call so the rest of the pipeline doesn't care which path
//    produced the citations. The UI labels the badge so the choice is
//    transparent.
// ----------------------------------------------------------------------------

export function foundryConfigured(): boolean {
  return Boolean(
    process.env.FOUNDRY_IQ_ENDPOINT &&
      process.env.FOUNDRY_IQ_KNOWLEDGE_BASE &&
      process.env.FOUNDRY_IQ_API_KEY
  );
}

export async function retrieveGrounding(
  query: string,
  signals: RiskSignals,
  options: { maxResults?: number; timeoutMs?: number } = {}
): Promise<RetrievalResult> {
  const started = Date.now();
  const max = options.maxResults ?? 4;
  const timeoutMs = options.timeoutMs ?? 6000;

  if (foundryConfigured()) {
    try {
      const citations = await callFoundryIq(query, max, timeoutMs);
      return {
        citations,
        knowledge_source: "foundry-iq",
        query,
        retrieved_at: new Date().toISOString(),
        latency_ms: Date.now() - started,
      };
    } catch (err) {
      // Fall through to bundled fallback rather than failing the whole
      // investigation if the live KB blips.
      console.warn("Foundry IQ call failed, falling back:", err);
    }
  }

  const citations = scoreBundled(signals, max);
  return {
    citations,
    knowledge_source: "bundled-fallback",
    query,
    retrieved_at: new Date().toISOString(),
    latency_ms: Date.now() - started,
  };
}

// ----------------------------------------------------------------------------
// Azure AI Search agentic retrieval (Foundry IQ knowledge base)
// ----------------------------------------------------------------------------

interface AzureSearchRetrieveResponse {
  response?: Array<{
    content?: Array<{ text?: string }>;
  }>;
  references?: Array<{
    id?: string;
    title?: string;
    sourceData?: {
      content?: string;
      title?: string;
      url?: string;
    };
    reranker_score?: number;
  }>;
}

async function callFoundryIq(
  query: string,
  max: number,
  timeoutMs: number
): Promise<Citation[]> {
  const endpoint = process.env.FOUNDRY_IQ_ENDPOINT!.replace(/\/$/, "");
  const kb = encodeURIComponent(process.env.FOUNDRY_IQ_KNOWLEDGE_BASE!);
  const apiVersion =
    process.env.FOUNDRY_IQ_API_VERSION || "2026-04-01";
  const url = `${endpoint}/knowledgebases/${kb}/retrieve?api-version=${apiVersion}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "api-key": process.env.FOUNDRY_IQ_API_KEY!,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: query }],
          },
        ],
        knowledgeSourceParams: [
          {
            knowledgeSourceName:
              process.env.FOUNDRY_IQ_KNOWLEDGE_BASE!,
            kind: "searchIndex",
            includeReferenceSourceData: true,
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Foundry IQ ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const data = (await res.json()) as AzureSearchRetrieveResponse;
    const refs = data.references ?? [];
    return refs.slice(0, max).map((r, i) => ({
      source_id: r.id ?? `ref-${i}`,
      title: r.sourceData?.title ?? r.title ?? "Untitled source",
      publisher: hostnameFrom(r.sourceData?.url) ?? "Foundry IQ knowledge base",
      url: r.sourceData?.url ?? "",
      snippet: (r.sourceData?.content ?? "").slice(0, 320),
      score: r.reranker_score ?? 0.5,
    }));
  } finally {
    clearTimeout(timer);
  }
}

function hostnameFrom(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Bundled-fallback scoring: pick sources whose anchor_signals overlap with
// the active heuristic signals, weighted by source specificity.
// ----------------------------------------------------------------------------

function scoreBundled(signals: RiskSignals, max: number): Citation[] {
  const active = activeSignalNames(signals);
  const scored = KNOWLEDGE_BASE.map((source) => {
    const hits = source.anchor_signals.filter((s) => active.has(s)).length;
    if (source.anchor_signals.length === 0 && hits === 0) {
      // generic sources (e.g. remediation procedures) only included if we
      // have very little to cite otherwise
      return { source, score: 0.18 };
    }
    if (hits === 0) return { source, score: 0 };
    // Score: hit ratio (more anchors matched → higher score), plus a small
    // boost for sources with fewer anchors (more specific).
    const ratio = hits / Math.max(1, source.anchor_signals.length);
    const specificity = 1 / source.anchor_signals.length;
    return { source, score: ratio * 0.8 + specificity * 0.2 };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, max).map(({ source, score }) => sourceToCitation(source, score));
}

function activeSignalNames(signals: RiskSignals): Set<string> {
  const names = new Set<string>();
  // Boolean flags
  if (signals.user_is_privileged) names.add("user_is_privileged");
  if (signals.geo_unusual) names.add("geo_unusual");
  if (signals.off_hours) names.add("off_hours");
  if (signals.device_unmanaged) names.add("device_unmanaged");
  if (signals.device_unknown_os) names.add("device_unknown_os");
  if (signals.legacy_auth) names.add("legacy_auth");
  if (signals.tor_or_anon_ip) names.add("tor_or_anon_ip");
  if (!signals.mfa_satisfied && !signals.is_non_interactive)
    names.add("mfa_satisfied");
  if (signals.failed_auth) names.add("failed_auth");
  if (signals.is_non_interactive) names.add("is_non_interactive");
  if (signals.is_service_principal) names.add("is_service_principal");
  // Carry through observed-value channels (so anchor=client_app_observed,
  // mfa_detail_observed etc. can match too)
  if (signals.client_app_observed) names.add("client_app_observed");
  if (signals.mfa_detail_observed) names.add("mfa_detail_observed");
  if (signals.geo_observed_country) names.add("geo_observed_country");
  return names;
}

function sourceToCitation(source: KnowledgeSource, score: number): Citation {
  return {
    source_id: source.id,
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    snippet: source.snippet,
    score: Number(score.toFixed(2)),
  };
}

// Build a natural-language query the model would send to Foundry IQ, derived
// from the active signals. Surfaced in the audit log so the retrieval call is
// reproducible and explainable.
export function buildRetrievalQuery(
  userDisplayName: string,
  privilegedRole: string | null,
  signals: RiskSignals
): string {
  const parts: string[] = [];
  parts.push(
    `Identify Microsoft and MITRE guidance relevant to investigating a sign-in by ${userDisplayName}` +
      (privilegedRole ? ` (${privilegedRole})` : "") +
      "."
  );
  const cues: string[] = [];
  if (signals.tor_or_anon_ip) cues.push("anonymized / Tor IP");
  if (signals.geo_unusual)
    cues.push(
      `sign-in from ${signals.geo_observed_country ?? "an unusual country"} vs baseline ${signals.geo_country_baseline ?? "unknown"}`
    );
  if (signals.device_unmanaged) cues.push("unmanaged device");
  if (signals.legacy_auth)
    cues.push(`legacy authentication (${signals.client_app_observed})`);
  if (!signals.mfa_satisfied && !signals.is_non_interactive)
    cues.push(`MFA ${signals.mfa_detail_observed ?? "not satisfied"}`);
  if (signals.off_hours) cues.push("off-hours access");
  if (signals.is_service_principal) cues.push("non-interactive service principal");
  if (cues.length > 0) {
    parts.push("Observed signals: " + cues.join(", ") + ".");
  }
  parts.push(
    "Return relevant identity-protection guidance, applicable MITRE ATT&CK techniques, and remediation procedures."
  );
  return parts.join(" ");
}
