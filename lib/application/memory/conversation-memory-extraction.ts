import type { SupabaseClient } from "@supabase/supabase-js";

import type { LeadRecord } from "@/lib/domain/leads/types";

export type MemoryType =
  | "fact"
  | "preference"
  | "objection"
  | "risk"
  | "decision"
  | "summary";

type DetectedLanguage = "en" | "ru" | "mixed" | "unknown";

type ConversationMemoryMessage = {
  role: string;
  content: string;
};

export type MemoryCandidate = {
  type: MemoryType;
  content: string;
  confidence: number;
  evidence: string;
  detectedLanguage: DetectedLanguage;
  patternMatched: string;
  sourceMessageExcerpt: string;
};

type ExtractConversationMemoryInput = {
  lead: LeadRecord | null;
  conversationMessages: ConversationMemoryMessage[];
  latestAiResponse: string;
};

type StoreConversationMemoryInput =
  ExtractConversationMemoryInput & {
    supabase: SupabaseClient;
    organizationId: string;
    leadId: string;
    workItemId?: string | null;
    sourceAgentExecutionId?: string | null;
  };

type ExtractionRule = {
  type: Exclude<MemoryType, "summary">;
  language: "en" | "ru";
  patternName: string;
  pattern: RegExp;
  confidence: number;
  buildContent: (match: RegExpMatchArray, lead: LeadRecord | null) => string;
};

const MAX_CANDIDATES = 8;
const SOURCE = "api.chat.memory_extraction";

const EXTRACTION_RULES: ExtractionRule[] = [
  {
    type: "fact",
    language: "en",
    patternName: "en_fact_uses_tool",
    pattern:
      /\b(?:we\s+(?:use|are using)|currently\s+use|our\s+team\s+uses|our\s+company\s+uses)\s+([^.!?\n,;]+)/gi,
    confidence: 0.86,
    buildContent: (match, lead) =>
      `${formatLeadPrefix(lead)}uses ${cleanEntity(match[1])}`,
  },
  {
    type: "fact",
    language: "ru",
    patternName: "ru_fact_uses_tool",
    pattern:
      /(?:мы\s+(?:используем|пользуемся)|сейчас\s+используем|команда\s+использует|компания\s+использует)\s+([^.!?\n,;]+)/gi,
    confidence: 0.86,
    buildContent: (match, lead) =>
      `${formatLeadPrefix(lead)}uses ${cleanEntity(match[1])}`,
  },
  {
    type: "preference",
    language: "en",
    patternName: "en_preference_need",
    pattern:
      /\b(?:we\s+need|i\s+need|need|we\s+want|i\s+want|looking\s+for|require|requires)\s+([^.!?\n;]+)/gi,
    confidence: 0.84,
    buildContent: (match, lead) =>
      `${formatLeadPrefix(lead)}needs ${cleanEntity(match[1])}`,
  },
  {
    type: "preference",
    language: "ru",
    patternName: "ru_preference_need",
    pattern:
      /(?:нам\s+нужн(?:а|о|ы)|мне\s+нужн(?:а|о|ы)|нужн(?:а|о|ы)|требуется|хотим)\s+([^.!?\n;]+)/gi,
    confidence: 0.84,
    buildContent: (match, lead) =>
      `${formatLeadPrefix(lead)}needs ${cleanEntity(match[1])}`,
  },
  {
    type: "objection",
    language: "en",
    patternName: "en_objection_budget_limited",
    pattern:
      /\b(?:budget\s+is\s+limited\s+to|budget\s+limited\s+to|limited\s+budget\s+of|budget\s+up\s+to)\s+([^.!?\n,;]+)/gi,
    confidence: 0.88,
    buildContent: (match, lead) =>
      `${formatLeadPrefix(lead)}budget limited to ${cleanEntity(match[1])}`,
  },
  {
    type: "objection",
    language: "ru",
    patternName: "ru_objection_budget_limited",
    pattern:
      /(?:бюджет\s+ограничен\s+до|бюджет\s+до|ограниченный\s+бюджет\s+до)\s+([^.!?\n,;]+)/gi,
    confidence: 0.88,
    buildContent: (match, lead) =>
      `${formatLeadPrefix(lead)}budget limited to ${cleanEntity(match[1])}`,
  },
  {
    type: "objection",
    language: "en",
    patternName: "en_objection_too_expensive",
    pattern:
      /\b(too\s+expensive|expensive|price\s+is\s+high|pricing\s+is\s+high)\b/gi,
    confidence: 0.8,
    buildContent: (_match, lead) =>
      `${formatLeadPrefix(lead)}raised price objection: too expensive`,
  },
  {
    type: "objection",
    language: "ru",
    patternName: "ru_objection_expensive",
    pattern: /(дорого|слишком\s+дорого|цена\s+высокая)/gi,
    confidence: 0.8,
    buildContent: (_match, lead) =>
      `${formatLeadPrefix(lead)}raised price objection: too expensive`,
  },
  {
    type: "risk",
    language: "en",
    patternName: "en_risk_needs_approval",
    pattern:
      /\b(needs?\s+approval|requires?\s+approval|approval\s+needed|legal\s+review|procurement\s+review)\b/gi,
    confidence: 0.78,
    buildContent: (match, lead) =>
      `${formatLeadPrefix(lead)}has approval risk: ${cleanEntity(match[1])}`,
  },
  {
    type: "risk",
    language: "ru",
    patternName: "ru_risk_needs_approval",
    pattern:
      /(нужно\s+согласование|требуется\s+согласование|нужно\s+утверждение|юридическая\s+проверка|согласование\s+с\s+закупками)/gi,
    confidence: 0.78,
    buildContent: (match, lead) =>
      `${formatLeadPrefix(lead)}has approval risk: ${cleanEntity(match[1])}`,
  },
  {
    type: "decision",
    language: "en",
    patternName: "en_decision_continue",
    pattern:
      /\b(we\s+decided\s+to\s+continue|decided\s+to\s+continue|go\s+ahead|approved)\b/gi,
    confidence: 0.86,
    buildContent: (match, lead) =>
      `${formatLeadPrefix(lead)}decided to continue: ${cleanEntity(match[1])}`,
  },
  {
    type: "decision",
    language: "ru",
    patternName: "ru_decision_continue",
    pattern:
      /(решили\s+продолжить|продолжаем|одобрено|можно\s+продолжать)/gi,
    confidence: 0.86,
    buildContent: (match, lead) =>
      `${formatLeadPrefix(lead)}decided to continue: ${cleanEntity(match[1])}`,
  },
  {
    type: "decision",
    language: "en",
    patternName: "en_decision_schedule_demo",
    pattern:
      /\b(?:let'?s|lets|let\s+us)\s+schedule\s+a\s+demo\b|\b(?:book|schedule)\s+a\s+demo\b/gi,
    confidence: 0.84,
    buildContent: (_match, lead) =>
      `${formatLeadPrefix(lead)}decided to schedule a demo`,
  },
  {
    type: "decision",
    language: "ru",
    patternName: "ru_decision_schedule_demo",
    pattern:
      /(?:давайте\s+назначим\s+демо|назначим\s+демо|запланируем\s+демо)/gi,
    confidence: 0.84,
    buildContent: (_match, lead) =>
      `${formatLeadPrefix(lead)}decided to schedule a demo`,
  },
];

export async function extractAndStoreConversationMemory({
  supabase,
  organizationId,
  leadId,
  workItemId,
  sourceAgentExecutionId,
  lead,
  conversationMessages,
  latestAiResponse,
}: StoreConversationMemoryInput) {
  const candidates = extractConversationMemory({
    lead,
    conversationMessages,
    latestAiResponse,
  });

  if (candidates.length === 0) {
    return {
      candidates,
      insertedCount: 0,
    };
  }

  const entries = candidates.map((candidate) => ({
    organization_id: organizationId,
    lead_id: leadId,
    work_item_id: workItemId ?? null,
    source_agent_execution_id: sourceAgentExecutionId ?? null,
    scope: workItemId ? "work_item" : "organization",
    key: buildMemoryKey(leadId, candidate),
    content: candidate.content,
    metadata: {
      source: SOURCE,
      memory_type: candidate.type,
      confidence: candidate.confidence,
      evidence: candidate.evidence,
      detected_language: candidate.detectedLanguage,
      pattern_matched: candidate.patternMatched,
      source_message_excerpt: candidate.sourceMessageExcerpt,
      lead_snapshot: {
        id: lead?.id ?? leadId,
        name: lead?.name ?? null,
        company: lead?.company ?? null,
        status: lead?.status ?? null,
      },
    },
  }));

  const keys = entries.map((entry) => entry.key);
  const { data: existingRows, error: lookupError } = await supabase
    .from("memory_entries")
    .select("key")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .in("key", keys);

  if (lookupError) {
    throw lookupError;
  }

  const existingKeys = new Set(
    ((existingRows ?? []) as { key: string | null }[])
      .map((row) => row.key)
      .filter(Boolean)
  );
  const newEntries = entries.filter(
    (entry) => !existingKeys.has(entry.key)
  );

  if (newEntries.length === 0) {
    return {
      candidates,
      insertedCount: 0,
    };
  }

  const { error } = await supabase
    .from("memory_entries")
    .insert(newEntries);

  if (error) {
    if (isDuplicateKeyError(error)) {
      return {
        candidates,
        insertedCount: 0,
      };
    }

    throw error;
  }

  return {
    candidates,
    insertedCount: newEntries.length,
  };
}

export function extractConversationMemory({
  lead,
  conversationMessages,
  latestAiResponse,
}: ExtractConversationMemoryInput): MemoryCandidate[] {
  const latestUserMessage = getLatestMessageByRole(
    conversationMessages,
    "user"
  );
  const candidates: MemoryCandidate[] = [];

  addCandidates(
    candidates,
    extractRuleCandidates(latestUserMessage, lead, "fact")
  );
  addCandidates(
    candidates,
    extractRuleCandidates(latestUserMessage, lead, "preference")
  );
  addCandidates(
    candidates,
    extractRuleCandidates(latestUserMessage, lead, "objection")
  );
  addCandidates(
    candidates,
    extractRuleCandidates(latestUserMessage, lead, "risk")
  );
  addCandidates(
    candidates,
    extractRuleCandidates(latestUserMessage, lead, "decision")
  );
  addCandidate(
    candidates,
    extractSummaryCandidate({
      latestUserMessage,
      latestAiResponse,
      lead,
    })
  );

  return dedupeCandidates(candidates).slice(0, MAX_CANDIDATES);
}

function extractRuleCandidates(
  message: string,
  lead: LeadRecord | null,
  type: Exclude<MemoryType, "summary">
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  const rules = EXTRACTION_RULES.filter((rule) => rule.type === type);

  for (const rule of rules) {
    for (const match of message.matchAll(rule.pattern)) {
      const evidence = cleanSnippet(match[0], 180);

      candidates.push({
        type: rule.type,
        content: cleanSnippet(rule.buildContent(match, lead), 240),
        confidence: rule.confidence,
        evidence,
        detectedLanguage: rule.language,
        patternMatched: rule.patternName,
        sourceMessageExcerpt: evidence,
      });
    }
  }

  return candidates;
}

function extractSummaryCandidate({
  latestUserMessage,
  latestAiResponse,
  lead,
}: {
  latestUserMessage: string;
  latestAiResponse: string;
  lead: LeadRecord | null;
}): MemoryCandidate | null {
  const hasStructuredMemory = EXTRACTION_RULES.some((rule) =>
    latestUserMessage.match(rule.pattern)
  );

  if (latestUserMessage.trim().length < 20 || hasStructuredMemory) {
    return null;
  }

  return {
    type: "summary",
    content: `${formatLeadPrefix(lead)}latest exchange: ${cleanSnippet(
      latestUserMessage,
      180
    )} AI replied: ${cleanSnippet(latestAiResponse, 180)}`,
    confidence: 0.62,
    evidence: latestUserMessage,
    detectedLanguage: detectLanguage(latestUserMessage),
    patternMatched: "summary_latest_exchange",
    sourceMessageExcerpt: cleanSnippet(latestUserMessage, 180),
  };
}

function addCandidate(
  candidates: MemoryCandidate[],
  candidate: MemoryCandidate | null
) {
  if (candidate) {
    candidates.push(candidate);
  }
}

function addCandidates(
  candidates: MemoryCandidate[],
  newCandidates: MemoryCandidate[]
) {
  candidates.push(...newCandidates);
}

function dedupeCandidates(candidates: MemoryCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = normalizeForKey(
      `${candidate.type}:${candidate.content}`
    );

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getLatestMessageByRole(
  messages: ConversationMemoryMessage[],
  role: string
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === role) {
      return message.content;
    }
  }

  return "";
}

function buildMemoryKey(
  leadId: string,
  candidate: MemoryCandidate
) {
  const normalizedContent = normalizeForKey(candidate.content);
  return [
    "lead",
    leadId,
    "chat",
    candidate.type,
    hashText(normalizedContent),
  ].join(":");
}

function normalizeForKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function cleanSnippet(value: string, maxLength = 240) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function cleanEntity(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s:,-]+|[\s:,-]+$/g, "")
    .trim();
}

function detectLanguage(value: string): DetectedLanguage {
  const hasCyrillic = /[а-яё]/i.test(value);
  const hasLatin = /[a-z]/i.test(value);

  if (hasCyrillic && hasLatin) {
    return "mixed";
  }

  if (hasCyrillic) {
    return "ru";
  }

  if (hasLatin) {
    return "en";
  }

  return "unknown";
}

function formatLeadPrefix(lead: LeadRecord | null) {
  if (lead?.company) {
    return `${lead.company} `;
  }

  if (lead?.name) {
    return `${lead.name} `;
  }

  return "Lead ";
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
