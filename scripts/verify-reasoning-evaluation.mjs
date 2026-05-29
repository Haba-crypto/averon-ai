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

function createFakeSupabase() {
  const now = new Date().toISOString();
  const state = {
    workItems: [
      {
        id: "work-phase-34-1",
        organization_id: "org-phase-34-1",
        status: "in_progress",
        created_at: now,
        updated_at: now,
      },
    ],
    agentExecutions: [
      {
        id: "execution-phase-34-1",
        organization_id: "org-phase-34-1",
        work_item_id: "work-phase-34-1",
        agent_id: "agent-phase-34-1",
        agent_name: "Operations Agent",
        agent_role: "Revenue Operations",
        workflow_run_id: null,
        workflow_step_id: null,
        status: "succeeded",
        metadata: {},
        error: null,
        output: {},
        started_at: now,
        completed_at: now,
        created_at: now,
        updated_at: now,
      },
    ],
    decisions: [],
    executionQueue: [],
    tasks: [],
    aiEvents: [],
    humanReviews: [],
    memoryEntries: [],
    emails: [],
    apiCalls: [],
  };

  function tableRows(table) {
    if (table === "work_items") return state.workItems;
    if (table === "agent_executions") return state.agentExecutions;
    if (table === "agent_decisions") return state.decisions;
    if (table === "execution_queue") return state.executionQueue;
    if (table === "tasks") return state.tasks;
    if (table === "ai_events") return state.aiEvents;
    if (table === "human_reviews") return state.humanReviews;
    if (table === "memory_entries") return state.memoryEntries;
    if (table === "emails") return state.emails;
    if (table === "api_calls") return state.apiCalls;

    return [];
  }

  function matches(row, filters, lessThanFilters) {
    return (
      Object.entries(filters).every(([key, value]) => row[key] === value) &&
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
      lessThanFilters: {},
      patch: null,
      insertRow: null,
      updatedRows: null,
      limitCount: null,
      orders: [],
      select() {
        if (this.patch) {
          this.updatedRows = tableRows(table).filter((row) =>
            matches(row, this.filters, this.lessThanFilters)
          );
          this.updatedRows.forEach((row) => Object.assign(row, this.patch));
        }

        return this;
      },
      eq(key, value) {
        this.filters[key] = value;
        return this;
      },
      lt(key, value) {
        this.lessThanFilters[key] = value;
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
      update(patch) {
        this.patch = patch;
        return this;
      },
      async single() {
        if (this.insertRow) {
          return { data: { ...this.insertRow }, error: null };
        }

        const rows = applySortAndLimit(
          this.updatedRows ??
            tableRows(table).filter((row) =>
              matches(row, this.filters, this.lessThanFilters)
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
            tableRows(table).filter((row) =>
              matches(row, this.filters, this.lessThanFilters)
            ),
          this
        );
        const row = rows[0];

        return { data: row ? { ...row } : null, error: null };
      },
      async execute() {
        if (this.patch && !this.updatedRows) {
          this.updatedRows = tableRows(table).filter((row) =>
            matches(row, this.filters, this.lessThanFilters)
          );
          this.updatedRows.forEach((row) => Object.assign(row, this.patch));
        }

        const rows = applySortAndLimit(
          tableRows(table).filter((row) =>
            matches(row, this.filters, this.lessThanFilters)
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
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

const {
  evaluateReasoningProposalQuality,
  persistReasoningEvaluationDecision,
} = loadModule("lib/application/agents/reasoning-evaluation.ts");
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const runtimeContext = {
  organization_id: "org-phase-34-1",
  queue_item: {
    id: "queue-phase-34-1",
    status: "completed",
    assigned_agent_id: "agent-phase-34-1",
    assigned_agent_name: "Operations Agent",
    queue_reason: "Prepare internal reasoning evaluation.",
    next_action: "Recommend safe internal next step.",
    review_id: null,
    source_decision_id: null,
    metadata: {},
  },
  work_item: {
    id: "work-phase-34-1",
    type: "lead_acquisition",
    status: "in_progress",
    owner_type: "ai",
    owner_agent_name: "Operations Agent",
    ownership_status: "active",
    last_owner_change_reason: "verification",
  },
  lead: null,
  assigned_agent: {
    id: "agent-phase-34-1",
    key: "operations",
    name: "Operations Agent",
    description: "Coordinates controlled execution.",
    role: "Revenue Operations",
  },
  ownership: {
    owner_type: "ai",
    owner_agent_name: "Operations Agent",
    ownership_status: "active",
    last_owner_change_reason: "verification",
  },
  memory_context: {
    lead_memory: [],
    work_item_memory: [],
    global_memory: [],
    retrieval_summary: "No sensitive memory included.",
  },
  human_review_context: null,
  recent_timeline: [],
  recommended_next_action: "Recommend safe internal next step.",
  safety_flags: [],
};

const governanceResult = {
  allowed: true,
  blocked: false,
  human_review_required: false,
  escalation_required: false,
  autonomy_level: "manual",
  risk_level: "low",
  policy_reason: "Proposal-only reasoning remains internal.",
  policy_checks: [],
};

const deterministicProposal = {
  proposal_id: "proposal-deterministic-34",
  reasoning_summary: "Summarize safe internal next step.",
  confidence_score: 82,
  recommended_strategy: "Recommend a safe internal next step for review.",
  proposed_actions: [
    {
      id: "det-1",
      type: "recommendation",
      title: "Recommend internal next step",
      description: "Summarize the current context for a human operator.",
      risk_level: "low",
      requires_human_review: false,
    },
  ],
  proposed_plan_changes: [],
  proposed_risks: [],
  requires_human_review: false,
  reasoning_version: "reasoning_proposal_v1",
};

const safeLlmProposal = {
  ...deterministicProposal,
  proposal_id: "proposal-openai-safe-34",
  reasoning_summary:
    "Recommend one internal next step and call out missing qualification context.",
  confidence_score: 90,
  recommended_strategy:
    "Prepare a concise internal recommendation that identifies missing qualification data and asks for human confirmation.",
  proposed_actions: [
    {
      id: "safe-1",
      type: "recommendation",
      title: "Identify missing qualification field",
      description:
        "Internally note that budget is missing and recommend asking a human reviewer to confirm the next qualification question.",
      risk_level: "low",
      requires_human_review: false,
    },
    {
      id: "safe-2",
      type: "internal_note",
      title: "Document internal context",
      description:
        "Record that the proposal remains internal-only and limited to human-readable recommendation notes.",
      risk_level: "low",
      requires_human_review: false,
    },
  ],
};

const unsafeLlmProposal = {
  ...safeLlmProposal,
  proposal_id: "proposal-openai-unsafe-34",
  proposed_actions: [
    {
      id: "unsafe-1",
      type: "recommendation",
      title: "Send email to customer",
      description: "Send email to customer and create a work item.",
      risk_level: "high",
      requires_human_review: true,
    },
  ],
  requires_human_review: true,
};

const mediumRiskProposal = {
  ...safeLlmProposal,
  proposal_id: "proposal-openai-medium-34",
  proposed_actions: [
    {
      id: "medium-1",
      type: "risk_flag",
      title: "Flag proposal approval risk",
      description:
        "Internally flag that proposal scope is ambiguous and human review should confirm before any follow-up.",
      risk_level: "medium",
      requires_human_review: true,
    },
  ],
  requires_human_review: true,
};

const deterministicEvaluation = evaluateReasoningProposalQuality({
  runtimeContext,
  deterministicProposal,
  governanceResult,
});
assert(
  deterministicEvaluation.evaluated_provider === "deterministic" &&
    deterministicEvaluation.quality_score > 0,
  "deterministic proposal gets evaluated"
);

const safeEvaluation = evaluateReasoningProposalQuality({
  runtimeContext,
  deterministicProposal,
  llmProposal: safeLlmProposal,
  governanceResult,
  outcomeEvaluation: {
    outcome_status: "successful",
    success_score: 90,
    failure_category: null,
    retry_recommended: false,
    escalation_recommended: false,
    feedback_summary: "Successful fixture.",
    signals: [],
  },
});
assert(
  safeEvaluation.verdict === "accepted",
  "safe LLM-like proposal gets accepted"
);

const unsafeEvaluation = evaluateReasoningProposalQuality({
  runtimeContext,
  deterministicProposal,
  llmProposal: unsafeLlmProposal,
  governanceResult,
});
assert(
  unsafeEvaluation.verdict === "rejected",
  "unsafe LLM-like proposal gets rejected"
);

const mediumRiskEvaluation = evaluateReasoningProposalQuality({
  runtimeContext,
  deterministicProposal,
  llmProposal: mediumRiskProposal,
  governanceResult,
});
assert(
  mediumRiskEvaluation.verdict === "needs_review",
  "medium-risk proposal gets needs_review"
);
assert(
  safeEvaluation.comparison_to_deterministic.added_specificity === true,
  "comparison_to_deterministic is calculated"
);

const environment = createFakeSupabase();
const beforeSideEffects = JSON.stringify({
  tasks: environment.state.tasks,
  workItems: environment.state.workItems,
  executionQueue: environment.state.executionQueue,
  emails: environment.state.emails,
  apiCalls: environment.state.apiCalls,
});
const evaluationDecision = await persistReasoningEvaluationDecision({
  supabase: environment.supabase,
  organizationId: "org-phase-34-1",
  agentExecutionId: "execution-phase-34-1",
  agentId: "agent-phase-34-1",
  workItemId: "work-phase-34-1",
  evaluation: safeEvaluation,
  processedAt: new Date().toISOString(),
});

await environment.supabase
  .from("agent_executions")
  .update({
    output: {
      reasoning_evaluation: safeEvaluation,
    },
  })
  .eq("id", "execution-phase-34-1")
  .eq("organization_id", "org-phase-34-1");

const persistedDecision = environment.state.decisions.find(
  (decision) => decision.id === evaluationDecision.id
);
const persistedExecution = environment.state.agentExecutions[0];
const timeline = await listWorkItemTimeline({
  supabase: environment.supabase,
  workItemId: "work-phase-34-1",
  organizationId: "org-phase-34-1",
});
const timelineItem = timeline.items.find(
  (item) => item.title === "Reasoning Evaluated"
);
const afterSideEffects = JSON.stringify({
  tasks: environment.state.tasks,
  workItems: environment.state.workItems,
  executionQueue: environment.state.executionQueue,
  emails: environment.state.emails,
  apiCalls: environment.state.apiCalls,
});

assert(
  persistedDecision?.decision_type === "reasoning_evaluated",
  "reasoning_evaluated decision created"
);
assert(
  persistedDecision?.decision?.outcome?.comparison_to_deterministic,
  "comparison_to_deterministic is stored"
);
assert(
  persistedExecution.output.reasoning_evaluation.evaluation_id ===
    safeEvaluation.evaluation_id,
  "agent_execution.output.reasoning_evaluation stored"
);
assert(
  timelineItem?.message?.startsWith("Reasoning evaluated:"),
  "timeline includes Reasoning Evaluated"
);
assert(beforeSideEffects === afterSideEffects, "no side effects created");
assert(
  environment.state.executionQueue.length === 0,
  "no queue processing triggered"
);

const sourcePaths = [
  "lib/application/agents/reasoning-evaluation.ts",
  "lib/application/execution-queue/process-next-execution-queue-item.ts",
];
const combinedSource = sourcePaths
  .map((relativePath) =>
    fs.readFileSync(path.join(rootDir, relativePath), "utf8")
  )
  .join("\n");

assert(
  !combinedSource.includes("responses.create") &&
    !combinedSource.includes("chat.completions") &&
    !combinedSource.includes("getOpenAIClient"),
  "no OpenAI call required for tests"
);
assert(
  !combinedSource.includes("setInterval") &&
    !combinedSource.includes("setTimeout") &&
    !combinedSource.includes("cron"),
  "should not introduce autonomous loop"
);

console.log(
  JSON.stringify(
    {
      reasoning_evaluation: {
        deterministic_verdict: deterministicEvaluation.verdict,
        safe_llm_verdict: safeEvaluation.verdict,
        unsafe_llm_verdict: unsafeEvaluation.verdict,
        medium_risk_verdict: mediumRiskEvaluation.verdict,
        decision_type: persistedDecision?.decision_type ?? null,
        output_evaluation_id:
          persistedExecution.output.reasoning_evaluation.evaluation_id,
        timeline_title: timelineItem?.title ?? null,
        timeline_message: timelineItem?.message ?? null,
        quality_score: safeEvaluation.quality_score,
        safety_score: safeEvaluation.safety_score,
        provider_comparison_score:
          safeEvaluation.comparison_to_deterministic.added_specificity_score,
        rejected_action_rate_ready: unsafeEvaluation.verdict === "rejected",
        openai_called: false,
        side_effects_created: false,
        queue_processing_triggered: false,
      },
    },
    null,
    2
  )
);
