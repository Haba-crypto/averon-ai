import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type { PolicyGovernanceDecision } from "@/lib/application/agents/policy-governance";

export type ReasoningMemorySource =
  | "reasoning_learning"
  | "outcome_evaluation"
  | "reasoning_evaluation";

export type ReasoningStrategyMemoryPattern = {
  memory_entry_id: string;
  source: ReasoningMemorySource;
  key: string | null;
  summary: string;
  agent_name: string | null;
  capability_id: string | null;
  work_item_type: string | null;
  proposal_strategy: string | null;
  outcome_category: string | null;
  signal_type: string | null;
  verdict: string | null;
  score: number;
  priority: "preferred" | "neutral" | "avoid";
};

export type ReasoningStrategyMemoryRetrieval = {
  retrieval_id: string;
  matching_strategies: ReasoningStrategyMemoryPattern[];
  successful_patterns: ReasoningStrategyMemoryPattern[];
  failed_patterns: ReasoningStrategyMemoryPattern[];
  lessons: string[];
  strategy_summary: string;
  retrieval_score: number;
};

export type ReasoningStrategyContext = {
  recommended_strategies: string[];
  strategies_to_avoid: string[];
  lessons_learned: string[];
  adaptation_summary: string;
};

export type PersistStrategyMemoryRetrievedDecisionInput = {
  supabase: SupabaseClient;
  organizationId: string;
  agentExecutionId: string;
  agentId?: string | null;
  workItemId?: string | null;
  retrievedMemory: ReasoningStrategyMemoryRetrieval;
  strategyContext: ReasoningStrategyContext;
  processedAt?: string;
};

type MemoryEntryRow = {
  id: string;
  key: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AgentDecisionRow = {
  id: string;
};

const MEMORY_SOURCES: ReasoningMemorySource[] = [
  "reasoning_learning",
  "outcome_evaluation",
  "reasoning_evaluation",
];
const MAX_MEMORY_ROWS = 80;
const MAX_PATTERNS = 8;
const MAX_LESSONS = 6;

export async function retrieveReasoningStrategyMemory({
  supabase,
  organizationId,
  runtimeContext,
  agentName,
  capabilityId = null,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  runtimeContext: AgentRuntimeContext;
  agentName: string;
  capabilityId?: string | null;
}): Promise<ReasoningStrategyMemoryRetrieval> {
  const { data, error } = await supabase
    .from("memory_entries")
    .select("id, key, content, metadata, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(MAX_MEMORY_ROWS);

  if (error) {
    throw error;
  }

  const patterns = ((data ?? []) as MemoryEntryRow[])
    .map((row) =>
      buildPattern({
        row,
        runtimeContext,
        agentName,
        capabilityId,
      })
    )
    .filter((pattern): pattern is ReasoningStrategyMemoryPattern =>
      Boolean(pattern)
    )
    .sort(comparePatterns)
    .slice(0, MAX_PATTERNS);
  const successfulPatterns = patterns.filter(
    (pattern) => pattern.priority === "preferred"
  );
  const failedPatterns = patterns.filter(
    (pattern) => pattern.priority === "avoid"
  );
  const lessons = dedupeStrings(
    patterns.flatMap((pattern) => extractLessons(pattern))
  ).slice(0, MAX_LESSONS);
  const retrievalScore = calculateRetrievalScore(patterns);

  return {
    retrieval_id: buildRetrievalId({
      runtimeContext,
      agentName,
      capabilityId,
    }),
    matching_strategies: patterns,
    successful_patterns: successfulPatterns,
    failed_patterns: failedPatterns,
    lessons,
    strategy_summary: buildStrategySummary({
      successfulCount: successfulPatterns.length,
      failedCount: failedPatterns.length,
      totalCount: patterns.length,
    }),
    retrieval_score: retrievalScore,
  };
}

export function buildReasoningStrategyContext({
  retrievedMemory,
  runtimeContext,
  governanceResult,
}: {
  retrievedMemory: ReasoningStrategyMemoryRetrieval;
  runtimeContext: AgentRuntimeContext;
  governanceResult: PolicyGovernanceDecision;
}): ReasoningStrategyContext {
  const recommendedStrategies = dedupeStrings(
    retrievedMemory.successful_patterns
      .map((pattern) => pattern.proposal_strategy)
      .filter(isUsefulText)
  ).slice(0, 4);
  const riskyStrategies = dedupeStrings(
    retrievedMemory.failed_patterns
      .map((pattern) => pattern.proposal_strategy)
      .filter(isUsefulText)
  ).slice(0, 4);
  const governanceLessons = governanceResult.blocked
    ? ["Avoid reusing strategies that depend on blocked governance paths."]
    : [];
  const lessonsLearned = dedupeStrings([
    ...retrievedMemory.lessons,
    ...governanceLessons,
  ]).slice(0, MAX_LESSONS);

  return {
    recommended_strategies: recommendedStrategies,
    strategies_to_avoid: riskyStrategies,
    lessons_learned: lessonsLearned,
    adaptation_summary: buildAdaptationSummary({
      agentName: runtimeContext.assigned_agent.name,
      recommendedCount: recommendedStrategies.length,
      avoidedCount: riskyStrategies.length,
      blocked: governanceResult.blocked,
    }),
  };
}

export async function persistStrategyMemoryRetrievedDecision({
  supabase,
  organizationId,
  agentExecutionId,
  agentId = null,
  workItemId = null,
  retrievedMemory,
  strategyContext,
  processedAt = new Date().toISOString(),
}: PersistStrategyMemoryRetrievedDecisionInput) {
  const outcome = {
    retrieval_id: retrievedMemory.retrieval_id,
    retrieval_score: retrievedMemory.retrieval_score,
    matching_strategy_count: retrievedMemory.matching_strategies.length,
    successful_pattern_count: retrievedMemory.successful_patterns.length,
    failed_pattern_count: retrievedMemory.failed_patterns.length,
    strategy_summary: retrievedMemory.strategy_summary,
    adaptation_summary: strategyContext.adaptation_summary,
    recommended_strategies: strategyContext.recommended_strategies,
    strategies_to_avoid: strategyContext.strategies_to_avoid,
  };
  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: agentExecutionId,
      agent_id: agentId,
      work_item_id: workItemId,
      decision_type: "strategy_memory_retrieved",
      decision: {
        outcome,
      },
      rationale: strategyContext.adaptation_summary,
      confidence: retrievedMemory.retrieval_score / 100,
      metadata: {
        source: "reasoning_strategy_memory",
        phase: 36,
        ...outcome,
        lessons_learned: strategyContext.lessons_learned,
        openai_called: false,
      },
      created_at: processedAt,
    })
    .select("id")
    .single<AgentDecisionRow>();

  if (error) {
    throw error;
  }

  return data;
}

function buildPattern({
  row,
  runtimeContext,
  agentName,
  capabilityId,
}: {
  row: MemoryEntryRow;
  runtimeContext: AgentRuntimeContext;
  agentName: string;
  capabilityId: string | null;
}) {
  const metadata = row.metadata ?? {};
  const source = getString(metadata, "source");

  if (!isMemorySource(source)) {
    return null;
  }

  const pattern: ReasoningStrategyMemoryPattern = {
    memory_entry_id: row.id,
    source,
    key: row.key,
    summary: sanitizeText(row.content),
    agent_name: getString(metadata, "agent_name"),
    capability_id: getString(metadata, "capability_id"),
    work_item_type: getString(metadata, "work_item_type"),
    proposal_strategy: getString(metadata, "proposal_strategy"),
    outcome_category:
      getString(metadata, "outcome_status") ??
      getString(metadata, "outcome_category"),
    signal_type: getString(metadata, "signal_type"),
    verdict: getString(metadata, "verdict"),
    score: 0,
    priority: "neutral",
  };
  const score = calculatePatternScore({
    pattern,
    metadata,
    runtimeContext,
    agentName,
    capabilityId,
  });

  if (score <= 0) {
    return null;
  }

  return {
    ...pattern,
    score,
    priority: resolvePatternPriority(pattern, metadata),
  };
}

function calculatePatternScore({
  pattern,
  metadata,
  runtimeContext,
  agentName,
  capabilityId,
}: {
  pattern: ReasoningStrategyMemoryPattern;
  metadata: Record<string, unknown>;
  runtimeContext: AgentRuntimeContext;
  agentName: string;
  capabilityId: string | null;
}) {
  let score = 10;

  if (pattern.agent_name === agentName) score += 30;
  if (capabilityId && pattern.capability_id === capabilityId) score += 24;
  if (
    pattern.work_item_type &&
    pattern.work_item_type === runtimeContext.work_item.type
  ) {
    score += 18;
  }
  if (pattern.proposal_strategy) score += 8;
  if (pattern.outcome_category) score += 8;
  if (pattern.signal_type) score += 8;

  if (pattern.signal_type === "positive") score += 18;
  if (pattern.verdict === "accepted") score += 14;
  if (pattern.outcome_category === "successful") score += 16;
  if (pattern.signal_type === "negative") score -= 20;
  if (pattern.verdict === "rejected") score -= 16;
  if (pattern.outcome_category === "blocked") score -= 18;
  if (pattern.outcome_category === "failed") score -= 14;

  const effectivenessScore = getNumber(
    metadata,
    "strategy_effectiveness_score"
  );
  const successScore = getNumber(metadata, "success_score");
  const qualityScore = getNumber(metadata, "quality_score");
  const bestScore = Math.max(
    effectivenessScore ?? 0,
    successScore ?? 0,
    qualityScore ?? 0
  );

  if (bestScore > 0) {
    score += Math.round(bestScore / 10);
  }

  return clampScore(score);
}

function resolvePatternPriority(
  pattern: ReasoningStrategyMemoryPattern,
  metadata: Record<string, unknown>
): ReasoningStrategyMemoryPattern["priority"] {
  const successScore = getNumber(metadata, "success_score") ?? 0;
  const qualityScore = getNumber(metadata, "quality_score") ?? 0;
  const effectivenessScore =
    getNumber(metadata, "strategy_effectiveness_score") ?? 0;

  if (
    pattern.signal_type === "negative" ||
    pattern.verdict === "rejected" ||
    pattern.outcome_category === "blocked" ||
    pattern.outcome_category === "failed"
  ) {
    return "avoid";
  }

  if (
    pattern.signal_type === "positive" ||
    pattern.verdict === "accepted" ||
    pattern.outcome_category === "successful" ||
    successScore >= 85 ||
    qualityScore >= 85 ||
    effectivenessScore >= 85
  ) {
    return "preferred";
  }

  return "neutral";
}

function extractLessons(pattern: ReasoningStrategyMemoryPattern) {
  if (pattern.priority === "preferred") {
    return [
      pattern.proposal_strategy
        ? `Reuse strategy: ${pattern.proposal_strategy}.`
        : `Reuse ${pattern.source} pattern for similar safe context.`,
    ];
  }

  if (pattern.priority === "avoid") {
    return [
      pattern.proposal_strategy
        ? `Avoid strategy: ${pattern.proposal_strategy}.`
        : `Avoid ${pattern.source} pattern for similar risky context.`,
    ];
  }

  return [`Review ${pattern.source} pattern before adapting strategy.`];
}

function calculateRetrievalScore(
  patterns: ReasoningStrategyMemoryPattern[]
) {
  if (patterns.length === 0) {
    return 0;
  }

  return clampScore(
    Math.round(
      patterns.reduce((total, pattern) => total + pattern.score, 0) /
        patterns.length
    )
  );
}

function buildStrategySummary({
  successfulCount,
  failedCount,
  totalCount,
}: {
  successfulCount: number;
  failedCount: number;
  totalCount: number;
}) {
  if (totalCount === 0) {
    return "Strategy memory retrieval found no matching reasoning patterns.";
  }

  if (successfulCount > 0 && failedCount > 0) {
    return `Strategy memory retrieved ${successfulCount} successful pattern(s) and ${failedCount} risky pattern(s).`;
  }

  if (successfulCount > 0) {
    return `Strategy memory retrieved ${successfulCount} matching successful pattern(s).`;
  }

  if (failedCount > 0) {
    return `Strategy memory retrieved ${failedCount} risky pattern(s) to avoid.`;
  }

  return `Strategy memory retrieved ${totalCount} neutral pattern(s).`;
}

function buildAdaptationSummary({
  agentName,
  recommendedCount,
  avoidedCount,
  blocked,
}: {
  agentName: string;
  recommendedCount: number;
  avoidedCount: number;
  blocked: boolean;
}) {
  if (blocked) {
    return `${agentName} strategy adaptation kept governance-blocked context proposal-only.`;
  }

  if (recommendedCount > 0 && avoidedCount > 0) {
    return `${agentName} strategy adaptation recommends ${recommendedCount} learned pattern(s) and avoids ${avoidedCount} risky pattern(s).`;
  }

  if (recommendedCount > 0) {
    return `${agentName} strategy adaptation recommends ${recommendedCount} learned pattern(s).`;
  }

  if (avoidedCount > 0) {
    return `${agentName} strategy adaptation avoids ${avoidedCount} risky pattern(s).`;
  }

  return `${agentName} strategy adaptation found no prior pattern to apply.`;
}

function buildRetrievalId({
  runtimeContext,
  agentName,
  capabilityId,
}: {
  runtimeContext: AgentRuntimeContext;
  agentName: string;
  capabilityId: string | null;
}) {
  return [
    "strategy_memory",
    slugify(agentName),
    slugify(capabilityId ?? "no_capability"),
    runtimeContext.queue_item.id,
  ].join("_");
}

function comparePatterns(
  left: ReasoningStrategyMemoryPattern,
  right: ReasoningStrategyMemoryPattern
) {
  const priorityWeight = { preferred: 2, neutral: 1, avoid: 0 };
  const priorityDelta =
    priorityWeight[right.priority] - priorityWeight[left.priority];

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return right.score - left.score;
}

function isMemorySource(value: string | null): value is ReasoningMemorySource {
  return MEMORY_SOURCES.includes(value as ReasoningMemorySource);
}

function sanitizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

function isUsefulText(value: string | null): value is string {
  return Boolean(value && value.trim().length > 0);
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getString(value: Record<string, unknown>, key: string) {
  const rawValue = value[key];

  return typeof rawValue === "string" ? rawValue : null;
}

function getNumber(value: Record<string, unknown>, key: string) {
  const rawValue = value[key];

  return typeof rawValue === "number" && Number.isFinite(rawValue)
    ? rawValue
    : null;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
