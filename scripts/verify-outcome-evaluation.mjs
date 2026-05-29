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
  const organizationId = `org-phase-29-${label}`;
  const leadId = `lead-phase-29-${label}`;
  const agentId = `agent-phase-29-${label}`;
  const workItemId = `work-item-phase-29-${label}`;
  const queueItemId = `queue-phase-29-${label}`;
  const reviewId = `review-phase-29-${label}`;
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
        source_decision_id: `resume-decision-phase-29-${label}`,
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
        agent_execution_id: `execution-before-phase-29-${label}`,
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
        reviewed_by: "user-phase-29",
        review_outcome: "Approved",
        review_notes: "Approved; continue.",
        created_at: now,
        updated_at: now,
      },
    ],
    memoryEntries: [
      {
        id: `memory-phase-29-${label}`,
        organization_id: organizationId,
        agent_id: agentId,
        lead_id: leadId,
        work_item_id: workItemId,
        source_agent_execution_id: null,
        scope: "work_item",
        key: "approval_context",
        content: "Human approved resumed execution.",
        metadata: {
          memory_type: "decision",
        },
        expires_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    aiEvents: [],
    tasks: [],
    agentExecutions: [],
    decisions: [],
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

    return [];
  }

  function matches(row, filters, inFilters, lessThanFilters) {
    return (
      Object.entries(filters).every(
        ([key, value]) => row[key] === value
      ) &&
      Object.entries(inFilters).every(([key, values]) =>
        values.includes(row[key])
      ) &&
      Object.entries(lessThanFilters).every(
        ([key, value]) => row[key] < value
      )
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

const { evaluateExecutionOutcome, persistExecutionOutcomeFeedback } =
  loadModule("lib/application/agents/outcome-evaluation.ts");
const { buildAgentRuntimeContext } = loadModule(
  "lib/application/agents/build-agent-runtime-context.ts"
);
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const baseEnvironment = createFakeSupabase("rules");
const baseRuntimeContext = await buildAgentRuntimeContext({
  supabase: baseEnvironment.supabase,
  organizationId: baseEnvironment.organizationId,
  queueItemId: baseEnvironment.queueItemId,
  workItemId: baseEnvironment.workItemId,
  assignedAgentName: "Operations Agent",
});
const capabilityResult = {
  capability_id: "summarize_review_decision",
  capability_name: "Summarize Review Decision",
  result: {
    summary: "Summarized approved review.",
    evidence: ["Approved"],
    safety_flags: [],
  },
  recommended_next_action: "Resume operations workflow.",
  created_tasks: [],
  created_decisions: [],
};
const sideEffectsResult = {
  created_tasks: ["task-1"],
  created_work_items: [],
  created_decisions: ["decision-1"],
  created_memory_entries: [],
  updated_work_item: false,
  skipped_duplicates: [],
};
const planTranslationResult = {
  created_tasks: ["translated-task-1"],
  created_work_items: [],
  created_queue_items: [],
  skipped_steps: [],
  skipped_duplicates: [],
};
const workGenerationResult = {
  created_work_items: [],
  created_queue_items: [],
  skipped_duplicates: [],
  continuation_policy: {
    allowed: true,
    mode: "manual",
    reason: "Continuation is allowed in manual mode with low risk.",
    risk_level: "low",
    requires_human_review: false,
    max_steps_allowed: 3,
    policy_checks: [],
  },
};
const successful = evaluateExecutionOutcome({
  organizationId: baseEnvironment.organizationId,
  agentExecution: {
    id: "execution-success",
    status: "succeeded",
  },
  runtimeContext: baseRuntimeContext,
  capabilityResult,
  sideEffectsResult,
  planTranslationResult,
  workGenerationResult,
  continuationPolicy: workGenerationResult.continuation_policy,
  queueItem: {
    id: baseEnvironment.queueItemId,
    status: "completed",
  },
  workItem: {
    id: baseEnvironment.workItemId,
    ownership_status: "active",
    metadata: {
      risk_level: "low",
    },
  },
});
const partial = evaluateExecutionOutcome({
  organizationId: baseEnvironment.organizationId,
  agentExecution: {
    id: "execution-partial",
    status: "succeeded",
  },
  runtimeContext: baseRuntimeContext,
  capabilityResult,
  sideEffectsResult: {
    ...sideEffectsResult,
    created_tasks: [],
    created_decisions: [],
    skipped_duplicates: [
      {
        type: "task",
        id: "task-existing",
        reason: "open_task_exists_for_work_item_and_capability",
      },
    ],
  },
  planTranslationResult: {
    ...planTranslationResult,
    skipped_steps: [
      {
        step_id: "step-1",
        title: "External send",
        reason: "external_action_not_allowed",
      },
    ],
  },
  workGenerationResult,
  continuationPolicy: workGenerationResult.continuation_policy,
  queueItem: {
    id: baseEnvironment.queueItemId,
    status: "completed",
  },
});
const failed = evaluateExecutionOutcome({
  organizationId: baseEnvironment.organizationId,
  agentExecution: {
    id: "execution-failed",
    status: "succeeded",
  },
  runtimeContext: baseRuntimeContext,
  capabilityResult,
  sideEffectsResult: null,
  sideEffectsError: "side effect insert failed",
  planTranslationResult,
  workGenerationResult,
  continuationPolicy: workGenerationResult.continuation_policy,
  queueItem: {
    id: baseEnvironment.queueItemId,
    status: "completed",
  },
});
const blocked = evaluateExecutionOutcome({
  organizationId: baseEnvironment.organizationId,
  agentExecution: {
    id: "execution-blocked",
    status: "succeeded",
  },
  runtimeContext: baseRuntimeContext,
  capabilityResult,
  sideEffectsResult,
  planTranslationResult,
  workGenerationResult,
  continuationPolicy: {
    ...workGenerationResult.continuation_policy,
    allowed: false,
    mode: "blocked",
    reason: "External action was detected.",
  },
  queueItem: {
    id: baseEnvironment.queueItemId,
    status: "completed",
  },
});
const needsReview = evaluateExecutionOutcome({
  organizationId: baseEnvironment.organizationId,
  agentExecution: {
    id: "execution-needs-review",
    status: "succeeded",
  },
  runtimeContext: baseRuntimeContext,
  capabilityResult: {
    ...capabilityResult,
    result: {
      ...capabilityResult.result,
      safety_flags: ["missing_human_review"],
    },
  },
  sideEffectsResult,
  planTranslationResult,
  workGenerationResult,
  continuationPolicy: {
    ...workGenerationResult.continuation_policy,
    risk_level: "high",
    requires_human_review: true,
  },
  queueItem: {
    id: baseEnvironment.queueItemId,
    status: "completed",
  },
});

assert(
  successful.outcome_status === "successful" &&
    successful.success_score >= 90,
  "successful execution gets successful status and high score"
);
assert(partial.outcome_status === "partial", "partial status is detected");
assert(
  failed.outcome_status === "failed" &&
    failed.failure_category === "side_effect_failed",
  "failed side effect gets failed status and category"
);
assert(
  blocked.outcome_status === "blocked" &&
    blocked.failure_category === "policy_blocked",
  "blocked policy gets blocked status"
);
assert(
  needsReview.outcome_status === "needs_review" &&
    needsReview.failure_category === "human_review_required",
  "needs-review status is detected"
);

const environment = createFakeSupabase("processing");
const result = await processNextExecutionQueueItem({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
});
const agentExecution = environment.state.agentExecutions[0];
const outcomeDecision = environment.state.decisions.find(
  (decision) => decision.decision_type === "outcome_evaluated"
);
const memoryEntriesBeforeIdempotentRetry =
  environment.state.memoryEntries.filter((entry) =>
    entry.key?.startsWith("outcome:")
  ).length;
await persistExecutionOutcomeFeedback({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  agentExecutionId: agentExecution.id,
  agentId: environment.agentId,
  workItemId: environment.workItemId,
  outcomeEvaluation: agentExecution.output.outcome_evaluation,
});
const memoryEntriesAfterIdempotentRetry =
  environment.state.memoryEntries.filter((entry) =>
    entry.key?.startsWith("outcome:")
  ).length;
const timeline = await listWorkItemTimeline({
  supabase: environment.supabase,
  workItemId: environment.workItemId,
  organizationId: environment.organizationId,
});
const timelineItem = timeline.items.find(
  (item) => item.title === "Outcome Evaluated"
);

assert(result.success === true, "queue processing should succeed");
assert(
  Boolean(outcomeDecision?.decision?.outcome?.outcome_status),
  "outcome_evaluated decision created"
);
assert(
  Boolean(agentExecution?.output?.outcome_evaluation?.outcome_status),
  "agent_execution.output.outcome_evaluation stored"
);
assert(
  memoryEntriesBeforeIdempotentRetry === 1 &&
    memoryEntriesAfterIdempotentRetry === 1,
  "memory entry created idempotently"
);
assert(
  timelineItem?.message?.startsWith("Outcome Evaluated:"),
  "timeline includes Outcome Evaluated"
);
assert(result.openai_called === false, "processing reports no OpenAI call");

const sourcePaths = [
  "lib/application/agents/outcome-evaluation.ts",
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
    !combinedSource.includes("chat.completions"),
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
      outcome_evaluation: {
        statuses: {
          successful: successful.outcome_status,
          partial: partial.outcome_status,
          failed: failed.failure_category,
          blocked: blocked.outcome_status,
          needs_review: needsReview.outcome_status,
        },
        decision_type: outcomeDecision?.decision_type ?? null,
        output_status:
          agentExecution?.output?.outcome_evaluation?.outcome_status ?? null,
        memory_entries: memoryEntriesAfterIdempotentRetry,
        timeline_title: timelineItem?.title ?? null,
        timeline_message: timelineItem?.message ?? null,
        openai_called: false,
        autonomous_loop: false,
      },
    },
    null,
    2
  )
);
