import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentRuntimeContext } from "@/lib/application/agents/build-agent-runtime-context";
import type { ExecutionQueueItem } from "@/lib/application/execution-queue/create-execution-queue-item";

export type SchedulingBucket = "now" | "next" | "later" | "blocked";

export type PrioritySignal = {
  signal: string;
  score_type: "urgency" | "business_impact" | "risk" | "blocked";
  weight: number;
  reason: string;
};

export type WorkPriorityDecision = {
  priority_score: number;
  urgency_score: number;
  business_impact_score: number;
  risk_score: number;
  scheduling_bucket: SchedulingBucket;
  recommended_execution_order: number;
  rationale: string;
  signals: PrioritySignal[];
};

type CalculateWorkPriorityInput = {
  organizationId: string;
  workItem: WorkPriorityWorkItem | null;
  queueItem?: WorkPriorityQueueItem | null;
  lead?: WorkPriorityLead | null;
  memoryContext?: unknown;
  reviewContext?: WorkPriorityReview | null;
  runtimeContext?: AgentRuntimeContext | null;
};

type PersistWorkPriorityInput = {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ExecutionQueueItem;
  workItem?: WorkPriorityWorkItem | null;
  lead?: WorkPriorityLead | null;
  reviewContext?: WorkPriorityReview | null;
  runtimeContext?: AgentRuntimeContext | null;
  evaluatedAt?: string;
};

type WorkPriorityWorkItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  priority?: string | null;
  ownership_status?: string | null;
  last_owner_change_reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

type WorkPriorityQueueItem = {
  id: string;
  work_item_id?: string | null;
  status?: string | null;
  priority?: string | null;
  queue_reason?: string | null;
  next_action?: string | null;
  review_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

type WorkPriorityLead = {
  id?: string | null;
  status?: string | null;
  intent_score?: number | null;
  urgency?: string | null;
};

type WorkPriorityReview = {
  id?: string | null;
  status?: string | null;
  priority?: string | null;
  review_title?: string | null;
  review_summary?: string | null;
  review_reason?: string | null;
  recommended_action?: string | null;
  review_outcome?: string | null;
  review_notes?: string | null;
};

type AgentDecisionRow = {
  id: string;
};

const PRIORITY_QUEUE_METADATA_KEYS = [
  "priority_score",
  "urgency_score",
  "business_impact_score",
  "risk_score",
  "scheduling_bucket",
  "recommended_execution_order",
  "priority_rationale",
  "priority_signals",
];

export async function evaluateAndPersistWorkPriority({
  supabase,
  organizationId,
  queueItem,
  workItem,
  lead,
  reviewContext,
  runtimeContext,
  evaluatedAt = new Date().toISOString(),
}: PersistWorkPriorityInput) {
  const resolvedWorkItem =
    workItem ??
    (await loadPriorityWorkItem({
      supabase,
      organizationId,
      workItemId: queueItem.work_item_id,
    }));
  const resolvedLead =
    lead ??
    runtimeContext?.lead ??
    (await loadPriorityLead({
      supabase,
      organizationId,
      workItem: resolvedWorkItem,
    }));
  const resolvedReview =
    reviewContext ??
    runtimeContext?.human_review_context ??
    (await loadPriorityReview({
      supabase,
      organizationId,
      reviewId: queueItem.review_id,
    }));

  const priority = calculateWorkPriority({
    organizationId,
    workItem: resolvedWorkItem,
    queueItem,
    lead: resolvedLead,
    reviewContext: resolvedReview,
    runtimeContext,
  });

  const updatedQueueItem = await persistQueuePriorityMetadata({
    supabase,
    organizationId,
    queueItem,
    priority,
    evaluatedAt,
  });

  const decision = await createPriorityEvaluatedDecision({
    supabase,
    organizationId,
    queueItem: updatedQueueItem,
    priority,
    evaluatedAt,
  });

  return {
    priority,
    queue_item: updatedQueueItem,
    agent_decision_id: decision.id,
  };
}

export function calculateWorkPriority({
  organizationId,
  workItem,
  queueItem = null,
  lead = null,
  memoryContext = null,
  reviewContext = null,
  runtimeContext = null,
}: CalculateWorkPriorityInput): WorkPriorityDecision {
  const signals: PrioritySignal[] = [];
  const text = buildSearchText({
    organizationId,
    workItem,
    queueItem,
    lead,
    memoryContext,
    reviewContext,
    runtimeContext,
  });

  addReviewSignals({ signals, reviewContext, runtimeContext });
  addQueueSignals({ signals, queueItem, runtimeContext });
  addLeadSignals({ signals, lead, runtimeContext });
  addTextSignals({ signals, text });
  addRiskSignals({ signals, workItem, queueItem, reviewContext, runtimeContext, text });
  addBlockedSignals({ signals, workItem, queueItem, reviewContext, runtimeContext });

  const blocked = signals.some((signal) => signal.score_type === "blocked");
  const urgencyScore = capScore(
    sumSignals(signals, "urgency") + priorityWeight(queueItem?.priority)
  );
  const businessImpactScore = capScore(
    sumSignals(signals, "business_impact") + priorityWeight(workItem?.priority)
  );
  const riskScore = capScore(sumSignals(signals, "risk"));
  const priorityScore = blocked
    ? 0
    : capScore(
        Math.round(
          urgencyScore * 0.45 +
            businessImpactScore * 0.45 +
            riskScore * 0.1
        )
      );
  const schedulingBucket = blocked
    ? "blocked"
    : resolveSchedulingBucket({
        priorityScore,
        urgencyScore,
        queueStatus: queueItem?.status ?? runtimeContext?.queue_item.status,
      });
  const recommendedExecutionOrder =
    schedulingBucket === "now"
      ? 1
      : schedulingBucket === "next"
        ? 2
        : schedulingBucket === "later"
          ? 3
          : 99;

  return {
    priority_score: priorityScore,
    urgency_score: urgencyScore,
    business_impact_score: businessImpactScore,
    risk_score: riskScore,
    scheduling_bucket: schedulingBucket,
    recommended_execution_order: recommendedExecutionOrder,
    rationale: buildPriorityRationale({
      schedulingBucket,
      priorityScore,
      urgencyScore,
      businessImpactScore,
      riskScore,
      blocked,
      signals,
    }),
    signals,
  };
}

export function compareQueueItemsByPriority(
  left: ExecutionQueueItem,
  right: ExecutionQueueItem
) {
  const leftBucketRank = bucketRank(left.metadata?.scheduling_bucket);
  const rightBucketRank = bucketRank(right.metadata?.scheduling_bucket);

  if (leftBucketRank !== rightBucketRank) {
    return leftBucketRank - rightBucketRank;
  }

  const leftScore = getMetadataNumber(left.metadata, "priority_score");
  const rightScore = getMetadataNumber(right.metadata, "priority_score");

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return (
    new Date(left.created_at).getTime() -
    new Date(right.created_at).getTime()
  );
}

export function isBlockedPriority(queueItem: ExecutionQueueItem) {
  return queueItem.metadata?.scheduling_bucket === "blocked";
}

async function persistQueuePriorityMetadata({
  supabase,
  organizationId,
  queueItem,
  priority,
  evaluatedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ExecutionQueueItem;
  priority: WorkPriorityDecision;
  evaluatedAt: string;
}) {
  const metadata = {
    ...(queueItem.metadata ?? {}),
    priority_score: priority.priority_score,
    urgency_score: priority.urgency_score,
    business_impact_score: priority.business_impact_score,
    risk_score: priority.risk_score,
    scheduling_bucket: priority.scheduling_bucket,
    recommended_execution_order: priority.recommended_execution_order,
    priority_rationale: priority.rationale,
    priority_signals: priority.signals,
    priority_evaluated_at: evaluatedAt,
    openai_called: false,
  };

  const { data, error } = await supabase
    .from("execution_queue")
    .update({
      metadata,
      updated_at: evaluatedAt,
    })
    .eq("id", queueItem.id)
    .eq("organization_id", organizationId)
    .select(
      [
        "id",
        "organization_id",
        "work_item_id",
        "review_id",
        "source_decision_id",
        "assigned_agent_id",
        "assigned_agent_name",
        "status",
        "priority",
        "queue_reason",
        "failure_reason",
        "next_action",
        "metadata",
        "created_at",
        "updated_at",
        "started_at",
        "completed_at",
      ].join(", ")
    )
    .single<ExecutionQueueItem>();

  if (error) {
    throw error;
  }

  return data;
}

async function createPriorityEvaluatedDecision({
  supabase,
  organizationId,
  queueItem,
  priority,
  evaluatedAt,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  queueItem: ExecutionQueueItem;
  priority: WorkPriorityDecision;
  evaluatedAt: string;
}) {
  const outcome = {
    queue_item_id: queueItem.id,
    work_item_id: queueItem.work_item_id,
    priority_score: priority.priority_score,
    urgency_score: priority.urgency_score,
    business_impact_score: priority.business_impact_score,
    risk_score: priority.risk_score,
    scheduling_bucket: priority.scheduling_bucket,
    recommended_execution_order: priority.recommended_execution_order,
    rationale: priority.rationale,
    signals: priority.signals,
  };

  const { data, error } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_execution_id: null,
      agent_id: queueItem.assigned_agent_id,
      work_item_id: queueItem.work_item_id,
      decision_type: "priority_evaluated",
      decision: {
        outcome,
      },
      rationale: priority.rationale,
      confidence: 1,
      metadata: {
        source: "priority_scheduling",
        phase: 28,
        ...outcome,
        openai_called: false,
      },
      created_at: evaluatedAt,
    })
    .select("id")
    .single<AgentDecisionRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function loadPriorityWorkItem({
  supabase,
  organizationId,
  workItemId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItemId: string;
}) {
  const { data, error } = await supabase
    .from("work_items")
    .select(
      [
        "id",
        "title",
        "description",
        "type",
        "status",
        "priority",
        "source_type",
        "source_id",
        "lead_id",
        "ownership_status",
        "last_owner_change_reason",
        "metadata",
      ].join(", ")
    )
    .eq("id", workItemId)
    .eq("organization_id", organizationId)
    .maybeSingle<WorkPriorityWorkItem & {
      lead_id?: string | null;
      source_type?: string | null;
      source_id?: string | null;
    }>();

  if (error) {
    throw error;
  }

  return data;
}

async function loadPriorityLead({
  supabase,
  organizationId,
  workItem,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  workItem:
    | (WorkPriorityWorkItem & {
        lead_id?: string | null;
        source_type?: string | null;
        source_id?: string | null;
      })
    | null;
}) {
  const leadId =
    workItem?.lead_id ??
    (workItem?.source_type === "lead" ? workItem.source_id : null);

  if (!leadId) {
    return null;
  }

  const { data, error } = await supabase
    .from("leads")
    .select("id, status, intent_score, urgency")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle<WorkPriorityLead>();

  if (error) {
    throw error;
  }

  return data;
}

async function loadPriorityReview({
  supabase,
  organizationId,
  reviewId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  reviewId?: string | null;
}) {
  if (!reviewId) {
    return null;
  }

  const { data, error } = await supabase
    .from("human_reviews")
    .select(
      [
        "id",
        "status",
        "priority",
        "review_title",
        "review_summary",
        "review_reason",
        "recommended_action",
        "review_outcome",
        "review_notes",
      ].join(", ")
    )
    .eq("id", reviewId)
    .eq("organization_id", organizationId)
    .maybeSingle<WorkPriorityReview>();

  if (error) {
    throw error;
  }

  return data;
}

function addReviewSignals({
  signals,
  reviewContext,
  runtimeContext,
}: {
  signals: PrioritySignal[];
  reviewContext: WorkPriorityReview | null | undefined;
  runtimeContext: AgentRuntimeContext | null | undefined;
}) {
  const status =
    reviewContext?.status ?? runtimeContext?.human_review_context?.status;

  if (status === "approved") {
    signals.push({
      signal: "human_approved",
      score_type: "urgency",
      weight: 30,
      reason: "Human review approved the work.",
    });
  }

  if (status === "rejected") {
    signals.push({
      signal: "rejected_review",
      score_type: "blocked",
      weight: 100,
      reason: "Human review rejected the work.",
    });
    signals.push({
      signal: "rejected_review_risk",
      score_type: "risk",
      weight: 35,
      reason: "Rejected review raises execution risk.",
    });
  }
}

function addQueueSignals({
  signals,
  queueItem,
  runtimeContext,
}: {
  signals: PrioritySignal[];
  queueItem: WorkPriorityQueueItem | null | undefined;
  runtimeContext: AgentRuntimeContext | null | undefined;
}) {
  const status = queueItem?.status ?? runtimeContext?.queue_item.status;

  if (status === "ready") {
    signals.push({
      signal: "queue_ready",
      score_type: "urgency",
      weight: 25,
      reason: "Queue item is ready.",
    });
  }

  if (
    runtimeContext?.work_item.ownership_status === "ready_to_resume" ||
    runtimeContext?.ownership.ownership_status === "ready_to_resume"
  ) {
    signals.push({
      signal: "ready_to_resume",
      score_type: "urgency",
      weight: 25,
      reason: "Work is ready to resume.",
    });
  }
}

function addLeadSignals({
  signals,
  lead,
  runtimeContext,
}: {
  signals: PrioritySignal[];
  lead: WorkPriorityLead | null | undefined;
  runtimeContext: AgentRuntimeContext | null | undefined;
}) {
  const intentScore =
    lead?.intent_score ?? runtimeContext?.lead?.intent_score ?? null;
  const urgency = lead?.urgency ?? runtimeContext?.lead?.urgency ?? null;

  if (typeof intentScore === "number" && intentScore >= 80) {
    signals.push({
      signal: "high_intent_score",
      score_type: "urgency",
      weight: 20,
      reason: `Lead intent score is ${intentScore}.`,
    });
  }

  if (urgency === "high" || urgency === "urgent") {
    signals.push({
      signal: "lead_urgency",
      score_type: "urgency",
      weight: 15,
      reason: `Lead urgency is ${urgency}.`,
    });
  }
}

function addTextSignals({
  signals,
  text,
}: {
  signals: PrioritySignal[];
  text: string;
}) {
  addKeywordSignal({
    signals,
    text,
    keywords: ["proposal", "contract", "enterprise", "budget", "procurement", "approval"],
    signal: "business_impact_terms",
    score_type: "business_impact",
    weight: 35,
    reason: "Commercial impact terms were detected.",
  });

  addKeywordSignal({
    signals,
    text,
    keywords: ["urgent", "asap", "deadline", "risk signal", "escalated"],
    signal: "urgent_terms",
    score_type: "urgency",
    weight: 15,
    reason: "Urgency terms were detected.",
  });
}

function addRiskSignals({
  signals,
  workItem,
  queueItem,
  reviewContext,
  runtimeContext,
  text,
}: {
  signals: PrioritySignal[];
  workItem: WorkPriorityWorkItem | null;
  queueItem: WorkPriorityQueueItem | null | undefined;
  reviewContext: WorkPriorityReview | null | undefined;
  runtimeContext: AgentRuntimeContext | null | undefined;
  text: string;
}) {
  const combinedMetadata = {
    ...(workItem?.metadata ?? {}),
    ...(queueItem?.metadata ?? {}),
  };

  addKeywordSignal({
    signals,
    text,
    keywords: ["legal", "compliance", "security"],
    signal: "risk_terms",
    score_type: "risk",
    weight: 30,
    reason: "Legal, compliance, or security signal detected.",
  });

  if (combinedMetadata.risk_level === "high") {
    signals.push({
      signal: "high_risk_metadata",
      score_type: "risk",
      weight: 30,
      reason: "Metadata marks the work as high risk.",
    });
  }

  if (
    reviewContext?.status === "rejected" ||
    runtimeContext?.human_review_context?.status === "rejected"
  ) {
    signals.push({
      signal: "rejected_review_risk",
      score_type: "risk",
      weight: 30,
      reason: "Rejected human review increases risk.",
    });
  }
}

function addBlockedSignals({
  signals,
  workItem,
  queueItem,
  reviewContext,
  runtimeContext,
}: {
  signals: PrioritySignal[];
  workItem: WorkPriorityWorkItem | null;
  queueItem: WorkPriorityQueueItem | null | undefined;
  reviewContext: WorkPriorityReview | null | undefined;
  runtimeContext: AgentRuntimeContext | null | undefined;
}) {
  const metadata = {
    ...(workItem?.metadata ?? {}),
    ...(queueItem?.metadata ?? {}),
    ...(runtimeContext?.queue_item.metadata ?? {}),
  };
  const ownershipStatus =
    workItem?.ownership_status ??
    runtimeContext?.ownership.ownership_status ??
    runtimeContext?.work_item.ownership_status;
  const reviewStatus =
    reviewContext?.status ?? runtimeContext?.human_review_context?.status;
  const requiresHumanReview =
    metadata.requires_human_review === true ||
    metadata.continuation_requires_human_review === true;
  const continuationPolicy = metadata.continuation_policy_snapshot;
  const continuationBlocked =
    metadata.continuation_mode === "blocked" ||
    (continuationPolicy &&
      typeof continuationPolicy === "object" &&
      "allowed" in continuationPolicy &&
      (continuationPolicy as { allowed?: unknown }).allowed === false);

  if (ownershipStatus === "blocked") {
    signals.push({
      signal: "blocked_ownership",
      score_type: "blocked",
      weight: 100,
      reason: "Work ownership is blocked.",
    });
  }

  if (reviewStatus === "rejected") {
    signals.push({
      signal: "rejected_human_review",
      score_type: "blocked",
      weight: 100,
      reason: "Human review rejected the work.",
    });
  }

  if (requiresHumanReview && reviewStatus !== "approved") {
    signals.push({
      signal: "requires_unapproved_human_review",
      score_type: "blocked",
      weight: 100,
      reason: "Human review is required but not approved.",
    });
  }

  if (continuationBlocked) {
    signals.push({
      signal: "continuation_policy_blocked",
      score_type: "blocked",
      weight: 100,
      reason: "Continuation policy blocks execution.",
    });
  }
}

function addKeywordSignal({
  signals,
  text,
  keywords,
  signal,
  score_type,
  weight,
  reason,
}: {
  signals: PrioritySignal[];
  text: string;
  keywords: string[];
  signal: string;
  score_type: PrioritySignal["score_type"];
  weight: number;
  reason: string;
}) {
  if (keywords.some((keyword) => text.includes(keyword))) {
    signals.push({
      signal,
      score_type,
      weight,
      reason,
    });
  }
}

function buildSearchText(input: CalculateWorkPriorityInput) {
  return JSON.stringify(input)
    .toLowerCase()
    .replace(/[_-]/g, " ");
}

function sumSignals(
  signals: PrioritySignal[],
  scoreType: PrioritySignal["score_type"]
) {
  return signals
    .filter((signal) => signal.score_type === scoreType)
    .reduce((sum, signal) => sum + signal.weight, 0);
}

function capScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function priorityWeight(priority: string | null | undefined) {
  if (priority === "urgent") {
    return 20;
  }

  if (priority === "high") {
    return 12;
  }

  if (priority === "low") {
    return -5;
  }

  return 0;
}

function resolveSchedulingBucket({
  priorityScore,
  urgencyScore,
  queueStatus,
}: {
  priorityScore: number;
  urgencyScore: number;
  queueStatus?: string | null;
}): SchedulingBucket {
  if (priorityScore >= 70 && urgencyScore >= 50 && queueStatus === "ready") {
    return "now";
  }

  if (priorityScore >= 40) {
    return "next";
  }

  return "later";
}

function buildPriorityRationale({
  schedulingBucket,
  priorityScore,
  urgencyScore,
  businessImpactScore,
  riskScore,
  blocked,
  signals,
}: {
  schedulingBucket: SchedulingBucket;
  priorityScore: number;
  urgencyScore: number;
  businessImpactScore: number;
  riskScore: number;
  blocked: boolean;
  signals: PrioritySignal[];
}) {
  if (blocked) {
    const blocker = signals.find((signal) => signal.score_type === "blocked");

    return `Priority evaluated as blocked because ${blocker?.reason ?? "execution is not allowed"}`;
  }

  return `Priority evaluated as ${schedulingBucket} with score ${priorityScore} (urgency ${urgencyScore}, impact ${businessImpactScore}, risk ${riskScore}).`;
}

function bucketRank(value: unknown) {
  if (value === "now") {
    return 0;
  }

  if (value === "next") {
    return 1;
  }

  if (value === "later") {
    return 2;
  }

  return 3;
}

function getMetadataNumber(
  metadata: Record<string, unknown> | null,
  key: string
) {
  const value = metadata?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function hasPriorityMetadata(queueItem: ExecutionQueueItem) {
  const metadata = queueItem.metadata ?? {};

  return PRIORITY_QUEUE_METADATA_KEYS.every((key) => key in metadata);
}
