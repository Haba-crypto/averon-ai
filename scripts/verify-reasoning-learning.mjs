import fs from "fs";
import Module from "module";
import { createRequire } from "module";
import path from "path";
import ts from "typescript";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAveronAlias(
  request,
  parent,
  isMain,
  options
) {
  if (request.startsWith("@/")) {
    return path.join(rootDir, request.slice(2)) + ".ts";
  }

  return originalResolveFilename.call(
    this,
    request,
    parent,
    isMain,
    options
  );
};

Module._extensions[".ts"] = function compileTypescriptModule(
  mod,
  filename
) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;

  mod._compile(compiled, filename);
};

function loadModule(relativePath) {
  return require(path.join(rootDir, relativePath));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createFakeSupabase(label) {
  const organizationId = `org-phase-35-${label}`;
  const leadId = `lead-phase-35-${label}`;
  const agentId = `agent-phase-35-${label}`;
  const workItemId = `work-item-phase-35-${label}`;
  const queueItemId = `queue-phase-35-${label}`;
  const reviewId = `review-phase-35-${label}`;
  const now = new Date().toISOString();
  const state = {
    leads: [
      {
        id: leadId,
        organization_id: organizationId,
        name: "Ada Buyer",
        email: "ada@example.com",
        status: "qualified",
        intent_score: 84,
        urgency: "medium",
      },
    ],
    workItems: [
      {
        id: workItemId,
        organization_id: organizationId,
        title: "Lead acquisition for Ada Buyer",
        type: "lead_acquisition",
        status: "queued",
        source_type: "lead",
        source_id: leadId,
        lead_id: leadId,
        owner_type: "ai",
        owner_agent_id: agentId,
        owner_agent_name: "Operations Agent",
        owner_agent_role: "Revenue Operations",
        ownership_status: "ready_to_resume",
        last_owner_change_reason:
          "approved human review; ready to resume",
        metadata: {
          risk_level: "low",
        },
        updated_at: now,
        created_at: now,
      },
    ],
    agents: [
      {
        id: agentId,
        organization_id: organizationId,
        key: "operations",
        name: "Operations Agent",
        description: "Coordinates controlled execution.",
        config: {
          role: "Revenue Operations",
        },
      },
    ],
    executionQueue: [
      {
        id: queueItemId,
        organization_id: organizationId,
        work_item_id: workItemId,
        review_id: reviewId,
        source_decision_id: `resume-decision-phase-35-${label}`,
        assigned_agent_id: agentId,
        assigned_agent_name: "Operations Agent",
        status: "ready",
        priority: "high",
        queue_reason: "Approved; continue with operations.",
        failure_reason: null,
        next_action: "Resume operations workflow.",
        metadata: {},
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    humanReviews: [
      {
        id: reviewId,
        organization_id: organizationId,
        work_item_id: workItemId,
        agent_execution_id: `execution-before-phase-35-${label}`,
        agent_decision_id: null,
        requested_by: "agent-operations",
        reviewer_user_id: null,
        source_agent_id: agentId,
        source_agent_name: "Operations Agent",
        review_type: "approval",
        review_reason: "Approval required.",
        review_title: "Resume Operations",
        review_summary: "Human approved the next execution step.",
        review_context: {},
        recommended_action: "Resume operations workflow.",
        status: "approved",
        priority: "high",
        decision: "approve",
        requested_at: now,
        reviewed_at: now,
        reviewed_by: "user-phase-35",
        review_outcome: "Approved",
        review_notes: "Approved; continue.",
        created_at: now,
        updated_at: now,
      },
    ],
    memoryEntries: [],
    aiEvents: [],
    tasks: [],
    agentExecutions: [],
    decisions: [],
    emails: [],
    apiCalls: [],
  };

  function tableRows(table) {
    if (table === "leads") return state.leads;
    if (table === "work_items") return state.workItems;
    if (table === "agents") return state.agents;
    if (table === "execution_queue") return state.executionQueue;
    if (table === "human_reviews") return state.humanReviews;
    if (table === "memory_entries") return state.memoryEntries;
    if (table === "ai_events") return state.aiEvents;
    if (table === "tasks") return state.tasks;
    if (table === "agent_executions") return state.agentExecutions;
    if (table === "agent_decisions") return state.decisions;
    if (table === "emails") return state.emails;
    if (table === "api_calls") return state.apiCalls;

    return [];
  }

  function matches(row, filters, inFilters, lessThanFilters) {
    return (
      Object.entries(filters).every(([key, value]) => row[key] === value) &&
      Object.entries(inFilters).every(([key, values]) =>
        values.includes(row[key])
      ) &&
      Object.entries(lessThanFilters).every(([key, value]) => row[key] < value)
    );
  }

  function applySortAndLimit(rows, builder) {
    let result = [...rows];

    for (const order of builder.orders) {
      result = result.sort((left, right) => {
        const comparison = String(left[order.key]).localeCompare(
          String(right[order.key])
        );

        return order.ascending ? comparison : -comparison;
      });
    }

    return builder.limitCount === null
      ? result
      : result.slice(0, builder.limitCount);
  }

  function createBuilder(table) {
    const builder = {
      filters: {},
      inFilters: {},
      lessThanFilters: {},
      patch: null,
      insertRow: null,
      updatedRows: null,
      limitCount: null,
      orders: [],
      select() {
        if (this.patch) {
          this.updatedRows = tableRows(table).filter((row) =>
            matches(
              row,
              this.filters,
              this.inFilters,
              this.lessThanFilters
            )
          );
          this.updatedRows.forEach((row) => Object.assign(row, this.patch));
        }

        return this;
      },
      eq(key, value) {
        this.filters[key] = value;
        return this;
      },
      in(key, values) {
        this.inFilters[key] = values;
        return this;
      },
      lt(key, value) {
        this.lessThanFilters[key] = value;
        return this;
      },
      or() {
        return this;
      },
      order(key, options = {}) {
        this.orders.push({
          key,
          ascending: options.ascending !== false,
        });
        return this;
      },
      limit(count) {
        this.limitCount = count;
        return this;
      },
      update(patch) {
        this.patch = patch;
        return this;
      },
      insert(row) {
        const record = {
          id: `${table}-${tableRows(table).length + 1}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...row,
        };

        tableRows(table).push(record);
        this.insertRow = record;
        return this;
      },
      async single() {
        if (this.insertRow) {
          return { data: { ...this.insertRow }, error: null };
        }

        const rows = applySortAndLimit(
          this.updatedRows ??
            tableRows(table).filter((candidate) =>
              matches(
                candidate,
                this.filters,
                this.inFilters,
                this.lessThanFilters
              )
            ),
          this
        );
        const row = rows[0];

        return row
          ? { data: { ...row }, error: null }
          : { data: null, error: new Error("Not found") };
      },
      async maybeSingle() {
        const rows = applySortAndLimit(
          this.updatedRows ??
            tableRows(table).filter((candidate) =>
              matches(
                candidate,
                this.filters,
                this.inFilters,
                this.lessThanFilters
              )
            ),
          this
        );
        const row = rows[0];

        return { data: row ? { ...row } : null, error: null };
      },
      async execute() {
        if (this.patch && !this.updatedRows) {
          this.updatedRows = tableRows(table).filter((row) =>
            matches(
              row,
              this.filters,
              this.inFilters,
              this.lessThanFilters
            )
          );
          this.updatedRows.forEach((row) => Object.assign(row, this.patch));
        }

        const rows = applySortAndLimit(
          tableRows(table).filter((row) =>
            matches(
              row,
              this.filters,
              this.inFilters,
              this.lessThanFilters
            )
          ),
          this
        );

        return { data: rows.map((row) => ({ ...row })), error: null };
      },
      then(resolve, reject) {
        return this.execute().then(resolve, reject);
      },
    };

    return builder;
  }

  return {
    organizationId,
    workItemId,
    queueItemId,
    agentId,
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

const {
  deriveReasoningLearningSignal,
  persistReasoningLearningSignal,
} = loadModule("lib/application/agents/reasoning-learning.ts");
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const runtimeContext = {
  queue_item: {
    id: "queue-phase-35-rules",
  },
};
const proposal = {
  proposal_id: "proposal-phase-35-rules",
  reasoning_summary: "Recommend an internal next step.",
  confidence_score: 88,
  recommended_strategy: "Keep the next step internal and reviewable.",
  proposed_actions: [
    {
      id: "action-1",
      type: "recommendation",
      title: "Recommend internal next step",
      description: "Summarize the safe internal next step.",
      risk_level: "low",
      requires_human_review: false,
    },
  ],
  proposed_plan_changes: [],
  proposed_risks: [],
  requires_human_review: false,
  reasoning_version: "reasoning_proposal_v1",
};
const acceptedEvaluation = {
  evaluation_id: "evaluation-phase-35-accepted",
  evaluated_provider: "deterministic",
  quality_score: 90,
  safety_score: 96,
  usefulness_score: 88,
  specificity_score: 84,
  policy_alignment_score: 95,
  risk_score: 4,
  verdict: "accepted",
  rationale: "Accepted fixture.",
  comparison_to_deterministic: {
    deterministic_action_count: 1,
    evaluated_action_count: 1,
    added_specificity: true,
    added_specificity_score: 8,
    introduced_unsafe_actions: false,
    increased_risk: false,
    preserved_internal_boundaries: true,
    recommendation: "Safe fixture.",
  },
  evaluation_signals: [],
};
const successfulOutcome = {
  success_score: 94,
  outcome_status: "successful",
  failure_category: null,
  retry_recommended: false,
  escalation_recommended: false,
  feedback_summary: "Outcome successful.",
  signals: [],
};
const partialOutcome = {
  ...successfulOutcome,
  success_score: 74,
  outcome_status: "partial",
  feedback_summary: "Outcome partial.",
};
const unsafeEvaluation = {
  ...acceptedEvaluation,
  evaluation_id: "evaluation-phase-35-unsafe",
  safety_score: 20,
  usefulness_score: 25,
  verdict: "rejected",
  comparison_to_deterministic: {
    ...acceptedEvaluation.comparison_to_deterministic,
    introduced_unsafe_actions: true,
    preserved_internal_boundaries: false,
  },
  evaluation_signals: [
    {
      signal: "unsafe_action",
      severity: "critical",
      reason: "Unsafe action proposed.",
    },
  ],
};
const failedOutcome = {
  ...successfulOutcome,
  success_score: 30,
  outcome_status: "failed",
  failure_category: "side_effect_failed",
  retry_recommended: true,
  feedback_summary: "Outcome failed.",
};

const positive = deriveReasoningLearningSignal({
  reasoningProposal: proposal,
  reasoningEvaluation: acceptedEvaluation,
  outcomeEvaluation: successfulOutcome,
  humanReviewContext: null,
  runtimeContext,
});
const neutral = deriveReasoningLearningSignal({
  reasoningProposal: proposal,
  reasoningEvaluation: acceptedEvaluation,
  outcomeEvaluation: partialOutcome,
  runtimeContext,
});
const negative = deriveReasoningLearningSignal({
  reasoningProposal: proposal,
  reasoningEvaluation: unsafeEvaluation,
  outcomeEvaluation: failedOutcome,
  humanReviewContext: {
    status: "rejected",
    review_outcome: "Rejected",
    review_notes: "Human overrode recommendation.",
  },
  runtimeContext,
});
const needsMoreData = deriveReasoningLearningSignal({
  reasoningProposal: proposal,
  reasoningEvaluation: acceptedEvaluation,
  outcomeEvaluation: null,
  runtimeContext,
});

assert(positive.signal_type === "positive", "successful accepted signal is positive");
assert(neutral.signal_type === "neutral", "partial outcome signal is neutral");
assert(negative.signal_type === "negative", "rejected unsafe signal is negative");
assert(
  needsMoreData.signal_type === "needs_more_data",
  "missing outcome signal needs more data"
);

const environment = createFakeSupabase("processing");
const result = await processNextExecutionQueueItem({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
});
const agentExecution = environment.state.agentExecutions[0];
const learningDecision = environment.state.decisions.find(
  (decision) =>
    decision.decision_type === "reasoning_learning_signal_created"
);
const memoryEntriesBeforeIdempotentRetry =
  environment.state.memoryEntries.filter((entry) =>
    entry.key?.startsWith("reasoning_learning:")
  ).length;
const beforeLearningRetrySideEffects = JSON.stringify({
  tasks: environment.state.tasks,
  workItems: environment.state.workItems,
  executionQueue: environment.state.executionQueue,
  emails: environment.state.emails,
  apiCalls: environment.state.apiCalls,
});
await persistReasoningLearningSignal({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  agentExecutionId: agentExecution.id,
  agentId: environment.agentId,
  workItemId: environment.workItemId,
  learningSignal: agentExecution.output.reasoning_learning_signal,
});
const memoryEntriesAfterIdempotentRetry =
  environment.state.memoryEntries.filter((entry) =>
    entry.key?.startsWith("reasoning_learning:")
  ).length;
const memoryEntry = environment.state.memoryEntries.find((entry) =>
  entry.key?.startsWith("reasoning_learning:")
);
const timeline = await listWorkItemTimeline({
  supabase: environment.supabase,
  workItemId: environment.workItemId,
  organizationId: environment.organizationId,
});
const timelineItem = timeline.items.find(
  (item) => item.title === "Reasoning Learning Signal Created"
);
const afterLearningRetrySideEffects = JSON.stringify({
  tasks: environment.state.tasks,
  workItems: environment.state.workItems,
  executionQueue: environment.state.executionQueue,
  emails: environment.state.emails,
  apiCalls: environment.state.apiCalls,
});

assert(result.success === true, "queue processing fixture succeeds");
assert(
  learningDecision?.decision?.outcome?.learning_signal_id,
  "agent_decision created"
);
assert(
  agentExecution?.output?.reasoning_learning_signal?.learning_signal_id,
  "agent_execution.output.reasoning_learning_signal stored"
);
assert(
  memoryEntriesBeforeIdempotentRetry === 1 &&
    memoryEntriesAfterIdempotentRetry === 1,
  "memory entry created idempotently"
);
assert(
  memoryEntry?.metadata?.source === "reasoning_learning" &&
    memoryEntry?.metadata?.proposal_id,
  "memory entry has reasoning learning metadata"
);
assert(
  timelineItem?.message?.startsWith("Reasoning learning signal:"),
  "timeline includes learning signal"
);
assert(
  beforeLearningRetrySideEffects === afterLearningRetrySideEffects,
  "learning persistence creates no autonomous side effects"
);

const sourcePaths = [
  "lib/application/agents/reasoning-learning.ts",
  "lib/application/execution-queue/process-next-execution-queue-item.ts",
  "lib/application/work-items/list-work-item-timeline.ts",
];
const combinedSource = sourcePaths
  .map((relativePath) =>
    fs.readFileSync(path.join(rootDir, relativePath), "utf8")
  )
  .join("\n");

assert(
  !combinedSource.includes("@/lib/ai/openai") &&
    !combinedSource.includes("new OpenAI") &&
    !combinedSource.includes("responses.create") &&
    !combinedSource.includes("chat.completions") &&
    !combinedSource.includes("getOpenAIClient"),
  "should not call OpenAI"
);
assert(
  !combinedSource.includes("setInterval") &&
    !combinedSource.includes("setTimeout") &&
    !combinedSource.includes("cron") &&
    !combinedSource.includes("while (") &&
    !combinedSource.includes("while("),
  "should not introduce autonomous loop"
);

console.log(
  JSON.stringify(
    {
      reasoning_learning: {
        signals: {
          accepted_successful: positive.signal_type,
          partial: neutral.signal_type,
          rejected_unsafe: negative.signal_type,
          missing_outcome: needsMoreData.signal_type,
        },
        decision_type: learningDecision?.decision_type ?? null,
        output_signal:
          agentExecution?.output?.reasoning_learning_signal?.signal_type ??
          null,
        memory_entries: memoryEntriesAfterIdempotentRetry,
        timeline_title: timelineItem?.title ?? null,
        timeline_message: timelineItem?.message ?? null,
        openai_called: false,
        autonomous_action: false,
      },
    },
    null,
    2
  )
);
