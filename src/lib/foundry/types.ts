// Foundry IQ types — citations and retrieval results.
// The shape mirrors what Azure AI Search agentic retrieval returns when used
// as the Foundry IQ knowledge layer behind a Foundry agent.

export interface KnowledgeSource {
  id: string;
  title: string;
  publisher: string;            // e.g. "Microsoft Learn", "MITRE ATT&CK", "CISA"
  url: string;                  // real public URL
  snippet: string;              // the chunk that grounded the reasoning
  anchor_signals: string[];     // which input signals this source addresses
}

export interface Citation {
  source_id: string;
  title: string;
  publisher: string;
  url: string;
  snippet: string;
  score: number;                // 0..1 retrieval relevance
}

export interface RetrievalResult {
  citations: Citation[];
  knowledge_source: "foundry-iq" | "bundled-fallback";
  query: string;
  retrieved_at: string;
  latency_ms: number;
}

export interface PhaseTiming {
  phase:
    | "heuristic_signals"
    | "knowledge_retrieval"
    | "llm_reasoning"
    | "action_synthesis";
  started_at: string;
  duration_ms: number;
  detail?: string;
}
