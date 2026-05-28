import type { SupabaseClient } from "@supabase/supabase-js";

export type RetrievedMemoryType =
  | "fact"
  | "preference"
  | "objection"
  | "risk"
  | "decision"
  | "summary";

export type RetrievedMemoryEntry = {
  id: string;
  type: RetrievedMemoryType;
  content: string;
  score: number;
  keyword_overlap: string[];
  lead_id: string | null;
  work_item_id: string | null;
  created_at: string;
};

export type RelevantMemory = {
  facts: RetrievedMemoryEntry[];
  preferences: RetrievedMemoryEntry[];
  objections: RetrievedMemoryEntry[];
  risks: RetrievedMemoryEntry[];
  decisions: RetrievedMemoryEntry[];
  summaries: RetrievedMemoryEntry[];
};

type RetrieveRelevantMemoryInput = {
  supabase: SupabaseClient;
  organizationId: string;
  leadId: string;
  workItemId?: string | null;
  latestUserMessage: string;
};

type MemoryEntryRow = {
  id: string;
  lead_id: string | null;
  work_item_id: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ScoredMemoryEntry = RetrievedMemoryEntry & {
  priority: number;
};

const MEMORY_TYPES: RetrievedMemoryType[] = [
  "fact",
  "preference",
  "objection",
  "risk",
  "decision",
  "summary",
];

const MAX_ROWS_PER_SCOPE = 40;
const MAX_ENTRIES_PER_TYPE = 4;
const MIN_RELEVANCE_SCORE = 0;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "can",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "the",
  "to",
  "use",
  "we",
  "what",
  "with",
  "you",
]);

export async function retrieveRelevantMemory({
  supabase,
  organizationId,
  leadId,
  workItemId,
  latestUserMessage,
}: RetrieveRelevantMemoryInput): Promise<RelevantMemory> {
  const rows = await loadCandidateMemoryRows({
    supabase,
    organizationId,
    leadId,
    workItemId,
  });
  const queryTokens = tokenize(latestUserMessage);
  const scoredEntries = scoreMemoryRows({
    rows,
    leadId,
    workItemId: workItemId ?? null,
    queryTokens,
  });

  return groupMemoryEntries(scoredEntries);
}

export function formatRelevantMemoryForPrompt(memory: RelevantMemory) {
  const sections = [
    formatMemorySection("Known facts", memory.facts),
    formatMemorySection("Known preferences", memory.preferences),
    formatMemorySection("Known objections", memory.objections),
    formatMemorySection("Known risks", memory.risks),
    formatMemorySection("Known decisions", memory.decisions),
    formatMemorySection("Known summaries", memory.summaries),
  ].filter(Boolean);

  if (sections.length === 0) {
    return "";
  }

  return [
    "Retrieved memory context:",
    sections.join("\n\n"),
    "Use this information when responding, but do not explicitly say you retrieved or remember it.",
  ].join("\n\n");
}

export function getRelevantMemoryEntryIds(memory: RelevantMemory) {
  return Object.values(memory)
    .flat()
    .map((entry) => entry.id)
    .filter((id, index, ids) => ids.indexOf(id) === index);
}

export function countRelevantMemoryEntries(memory: RelevantMemory) {
  return Object.values(memory).reduce(
    (count, entries) => count + entries.length,
    0
  );
}

export function createEmptyRelevantMemory(): RelevantMemory {
  return {
    facts: [],
    preferences: [],
    objections: [],
    risks: [],
    decisions: [],
    summaries: [],
  };
}

export function rankMemoryRowsForVerification({
  rows,
  leadId,
  workItemId,
  latestUserMessage,
}: {
  rows: MemoryEntryRow[];
  leadId: string;
  workItemId?: string | null;
  latestUserMessage: string;
}) {
  return groupMemoryEntries(
    scoreMemoryRows({
      rows,
      leadId,
      workItemId: workItemId ?? null,
      queryTokens: tokenize(latestUserMessage),
    })
  );
}

async function loadCandidateMemoryRows({
  supabase,
  organizationId,
  leadId,
  workItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  leadId: string;
  workItemId?: string | null;
}) {
  const [leadRows, workItemRows] = await Promise.all([
    loadLeadMemoryRows({
      supabase,
      organizationId,
      leadId,
    }),
    workItemId
      ? loadWorkItemMemoryRows({
          supabase,
          organizationId,
          workItemId,
        })
      : Promise.resolve([]),
  ]);

  const byId = new Map<string, MemoryEntryRow>();

  for (const row of [...leadRows, ...workItemRows]) {
    byId.set(row.id, row);
  }

  return [...byId.values()];
}

async function loadLeadMemoryRows({
  supabase,
  organizationId,
  leadId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  leadId: string;
}) {
  const { data, error } = await baseMemoryQuery(supabase)
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("created_at", {
      ascending: false,
    })
    .limit(MAX_ROWS_PER_SCOPE);

  if (error) {
    throw error;
  }

  return (data ?? []) as MemoryEntryRow[];
}

async function loadWorkItemMemoryRows({
  supabase,
  organizationId,
  workItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
}) {
  const { data, error } = await baseMemoryQuery(supabase)
    .eq("organization_id", organizationId)
    .eq("work_item_id", workItemId)
    .order("created_at", {
      ascending: false,
    })
    .limit(MAX_ROWS_PER_SCOPE);

  if (error) {
    throw error;
  }

  return (data ?? []) as MemoryEntryRow[];
}

function baseMemoryQuery(supabase: SupabaseClient) {
  return supabase
    .from("memory_entries")
    .select(
      "id, lead_id, work_item_id, content, metadata, created_at"
    )
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
}

function scoreMemoryRows({
  rows,
  leadId,
  workItemId,
  queryTokens,
}: {
  rows: MemoryEntryRow[];
  leadId: string;
  workItemId: string | null;
  queryTokens: Set<string>;
}) {
  return rows
    .map((row) =>
      scoreMemoryRow({
        row,
        leadId,
        workItemId,
        queryTokens,
      })
    )
    .filter((entry): entry is ScoredMemoryEntry => Boolean(entry))
    .filter((entry) => entry.score >= MIN_RELEVANCE_SCORE)
    .sort(compareScoredMemoryEntries);
}

function scoreMemoryRow({
  row,
  leadId,
  workItemId,
  queryTokens,
}: {
  row: MemoryEntryRow;
  leadId: string;
  workItemId: string | null;
  queryTokens: Set<string>;
}) {
  const type = getMemoryType(row);

  if (!type) {
    return null;
  }

  const memoryTokens = tokenize(row.content);
  const keywordOverlap = [...queryTokens].filter((token) =>
    memoryTokens.has(token)
  );
  const sameLeadBoost = row.lead_id === leadId ? 1000 : 0;
  const sameWorkItemBoost =
    workItemId && row.work_item_id === workItemId ? 500 : 0;
  const keywordBoost = keywordOverlap.length * 40;
  const priority = sameLeadBoost + sameWorkItemBoost;

  return {
    id: row.id,
    type,
    content: row.content,
    score: priority + keywordBoost,
    priority,
    keyword_overlap: keywordOverlap,
    lead_id: row.lead_id,
    work_item_id: row.work_item_id,
    created_at: row.created_at,
  };
}

function groupMemoryEntries(entries: ScoredMemoryEntry[]) {
  const grouped = createEmptyRelevantMemory();

  for (const type of MEMORY_TYPES) {
    grouped[toGroupKey(type)] = entries
      .filter((entry) => entry.type === type)
      .slice(0, MAX_ENTRIES_PER_TYPE);
  }

  return grouped;
}

function compareScoredMemoryEntries(
  left: ScoredMemoryEntry,
  right: ScoredMemoryEntry
) {
  const priorityDelta = right.priority - left.priority;

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const scoreDelta = right.score - left.score;

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return (
    new Date(right.created_at).getTime() -
    new Date(left.created_at).getTime()
  );
}

function getMemoryType(row: MemoryEntryRow) {
  const rawType = row.metadata?.memory_type;

  if (
    typeof rawType === "string" &&
    MEMORY_TYPES.includes(rawType as RetrievedMemoryType)
  ) {
    return rawType as RetrievedMemoryType;
  }

  return null;
}

function toGroupKey(type: RetrievedMemoryType) {
  if (type === "summary") {
    return "summaries";
  }

  return `${type}s` as keyof RelevantMemory;
}

function formatMemorySection(
  title: string,
  entries: RetrievedMemoryEntry[]
): string {
  if (entries.length === 0) {
    return "";
  }

  const lines = entries.map((entry) => `- ${entry.content}`);

  return `${title}:\n${lines.join("\n")}`;
}

function tokenize(value: string) {
  const tokens = new Set<string>();
  const normalized = value.toLowerCase().normalize("NFKC");
  const matches = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];

  for (const match of matches) {
    if (match.length < 2 || STOP_WORDS.has(match)) {
      continue;
    }

    tokens.add(match);
  }

  return tokens;
}
