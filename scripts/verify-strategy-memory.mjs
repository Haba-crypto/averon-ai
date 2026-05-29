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
  const organizationId = `org-phase-36-${label}`;
  const otherOrganizationId = `org-phase-36-other-${label}`;
  const leadId = `lead-phase-36-${label}`;
  const agentId = `agent-phase-36-${label}`;
  const workItemId = `work-item-phase-36-${label}`;
  const queueItemId = `queue-phase-36-${label}`;
  const reviewId = `review-phase-36-${label}`;
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
        source_decision_id: `resume-decision-phase-36-${label}`,
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
        lease_owner: null,
        lease_until: null,
        retry_count: 0,
        last_error: null,
        failed_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    humanReviews: [
      {
        id: reviewId,
        organization_id: organizationId,
        work_item_id: workItemId,
        agent_execution_id: `execution-before-phase-36-${label}`,
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
        reviewed_by: "user-phase-36",
        review_outcome: "Approved",
        review_notes: "Approved; continue.",
        created_at: now,
        updated_at: now,
      },
    ],
    memoryEntries: [
      {
        id: `memory-positive-${label}`,
        organization_id: organizationId,
        agent_id: agentId,
        work_item_id: workItemId,
        source_agent_execution_id: null,
        scope: "work_item",
        key: "reasoning_learning:positive",
        content: "Positive strategy memory: verify ownership before continuing.",
        metadata: {
          source: "reasoning_learning",
          signal_type: "positive",
          agent_name: "Operations Agent",
          capability_id: "mark_execution_ready",
          work_item_type: "lead_acquisition",
          proposal_strategy:
            "continue approved operations with ownership verification",
          outcome_status: "successful",
          verdict: "accepted",
          strategy_effectiveness_score: 94,
        },
        created_at: now,
        updated_at: now,
      },
      {
        id: `memory-negative-${label}`,
        organization_id: organizationId,
        agent_id: agentId,
        work_item_id: workItemId,
        source_agent_execution_id: null,
        scope: "work_item",
        key: "reasoning_learning:negative",
        content: "Negative strategy memory: external execution was rejected.",
        metadata: {
          source: "reasoning_learning",
          signal_type: "negative",
          agent_name: "Operations Agent",
          capability_id: "mark_execution_ready",
          work_item_type: "lead_acquisition",
          proposal_strategy: "send an external follow-up during reasoning",
          outcome_status: "blocked",
          verdict: "rejected",
          strategy_effectiveness_score: 12,
        },
        created_at: now,
        updated_at: now,
      },
      {
        id: `memory-other-org-${label}`,
        organization_id: otherOrganizationId,
        agent_id: "other-agent",
        work_item_id: "other-work",
        source_agent_execution_id: null,
        scope: "work_item",
        key: "reasoning_learning:other",
        content: "Other organization memory must not be retrieved.",
        metadata: {
          source: "reasoning_learning",
          signal_type: "positive",
          agent_name: "Operations Agent",
          capability_id: "mark_execution_ready",
          work_item_type: "lead_acquisition",
          proposal_strategy: "other organization strategy",
          outcome_status: "successful",
          verdict: "accepted",
        },
        created_at: now,
        updated_at: now,
      },
    ],
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
    otherOrganizationId,
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
  buildReasoningStrategyContext,
  retrieveReasoningStrategyMemory,
} = loadModule("lib/application/agents/reasoning-strategy-memory.ts");
const { generateReasoningProposalWithMetadata } = loadModule(
  "lib/application/agents/reasoning-proposal.ts"
);
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const environment = createFakeSupabase("processing");
const runtimeContext = {
  organization_id: environment.organizationId,
  queue_item: {
    id: environment.queueItemId,
    status: "ready",
    assigned_agent_id: environment.agentId,
    assigned_agent_name: "Operations Agent",
    queue_reason: "Approved; continue with operations.",
    next_action: "Resume operations workflow.",
    review_id: "review-phase-36-processing",
    source_decision_id: null,
    metadata: {},
  },
  work_item: {
    id: environment.workItemId,
    type: "lead_acquisition",
    status: "queued",
    owner_type: "ai",
    owner_agent_name: "Operations Agent",
    ownership_status: "ready_to_resume",
    last_owner_change_reason: "approved human review; ready to resume",
  },
  lead: null,
  assigned_agent: {
    id: environment.agentId,
    key: "operations",
    name: "Operations Agent",
    description: null,
    role: "Revenue Operations",
  },
  ownership: {
    owner_type: "ai",
    owner_agent_name: "Operations Agent",
    ownership_status: "ready_to_resume",
    last_owner_change_reason: "approved human review; ready to resume",
  },
  memory_context: {
    entries: [],
    summary: null,
    retrieval_id: "none",
    retrieval_score: 0,
  },
  human_review_context: null,
  recent_timeline: [],
  recommended_next_action: "Resume operations workflow.",
  safety_flags: [],
};
const governanceResult = {
  allowed: true,
  blocked: false,
  human_review_required: false,
  escalation_required: false,
  autonomy_level: "supervised",
  risk_level: "low",
  policy_reason: "Allowed.",
  policy_checks: [],
};

const retrievedMemory = await retrieveReasoningStrategyMemory({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  runtimeContext,
  agentName: "Operations Agent",
  capabilityId: "mark_execution_ready",
});
const adaptation = buildReasoningStrategyContext({
  retrievedMemory,
  runtimeContext,
  governanceResult,
});
let providerReceivedStrategyContext = false;
const provider = {
  name: "deterministic",
  async generateProposal(input) {
    providerReceivedStrategyContext = Boolean(
      input.strategyContext?.recommended_strategies?.length
    );

    return {
      proposal_id: "strategy-memory-provider-check",
      reasoning_summary: "Provider received compact strategy context.",
      confidence_score: 90,
      recommended_strategy: input.strategyContext.recommended_strategies[0],
      proposed_actions: [
        {
          id: "provider-action-1",
          type: "recommendation",
          title: "Use learned safe pattern",
          description: "Use learned safe pattern",
          risk_level: "low",
          requires_human_review: false,
        },
      ],
      proposed_plan_changes: [],
      proposed_risks: [],
      requires_human_review: false,
      reasoning_version: "reasoning_proposal_v1",
    };
  },
};

await generateReasoningProposalWithMetadata({
  runtimeContext,
  governanceResult,
  priorityResult: null,
  outcomeEvaluation: {
    success_score: 94,
    outcome_status: "successful",
    failure_category: null,
    retry_recommended: false,
    escalation_recommended: false,
    feedback_summary: "Outcome successful.",
    signals: [],
  },
  executionPlan: {
    plan_id: "plan-phase-36",
    agent_name: "Operations Agent",
    capability_id: "mark_execution_ready",
    steps: [],
    risk_level: "low",
    requires_human_review: false,
    recommended_next_step: "Resume operations workflow.",
  },
  strategyContext: adaptation,
  provider,
});

const beforeAutonomousState = JSON.stringify({
  emails: environment.state.emails,
  apiCalls: environment.state.apiCalls,
});
const result = await processNextExecutionQueueItem({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
});
const afterAutonomousState = JSON.stringify({
  emails: environment.state.emails,
  apiCalls: environment.state.apiCalls,
});
const agentExecution = environment.state.agentExecutions[0];
const strategyDecision = environment.state.decisions.find(
  (decision) => decision.decision_type === "strategy_memory_retrieved"
);
const timeline = await listWorkItemTimeline({
  supabase: environment.supabase,
  workItemId: environment.workItemId,
  organizationId: environment.organizationId,
});
const timelineItem = timeline.items.find(
  (item) => item.title === "Strategy Memory Retrieved"
);

assert(
  retrievedMemory.successful_patterns.some(
    (pattern) => pattern.signal_type === "positive"
  ),
  "positive learning signals are retrieved"
);
assert(
  retrievedMemory.matching_strategies[0]?.signal_type === "positive" &&
    retrievedMemory.failed_patterns.some(
      (pattern) => pattern.signal_type === "negative"
    ),
  "negative signals are de-prioritized"
);
assert(
  adaptation.recommended_strategies.length > 0 &&
    adaptation.strategies_to_avoid.length > 0,
  "adaptation context is created"
);
assert(providerReceivedStrategyContext, "reasoning receives strategy context");
assert(
  strategyDecision?.decision_type === "strategy_memory_retrieved",
  "strategy_memory_retrieved decision created"
);
assert(
  Boolean(agentExecution?.output?.strategy_memory_context?.retrieval_id),
  "execution output stores strategy memory context"
);
assert(
  timelineItem?.message?.startsWith("Strategy memory retrieved"),
  "timeline includes Strategy Memory Retrieved"
);
assert(
  !JSON.stringify(retrievedMemory).includes("other organization strategy"),
  "organization isolation preserved"
);
assert(result.success === true, "queue processing succeeds");
assert(beforeAutonomousState === afterAutonomousState, "no autonomous actions");

const sourcePaths = [
  "lib/application/agents/reasoning-strategy-memory.ts",
  "lib/application/execution-queue/process-next-execution-queue-item.ts",
  "lib/application/work-items/list-work-item-timeline.ts",
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
  "no OpenAI call required"
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
      strategy_memory: {
        retrieved_positive_patterns:
          retrievedMemory.successful_patterns.length,
        avoided_patterns: retrievedMemory.failed_patterns.length,
        retrieval_score: retrievedMemory.retrieval_score,
        provider_received_context: providerReceivedStrategyContext,
        decision_type: strategyDecision?.decision_type ?? null,
        output_context:
          agentExecution?.output?.strategy_memory_context ?? null,
        timeline_title: timelineItem?.title ?? null,
        timeline_message: timelineItem?.message ?? null,
        openai_called: false,
        autonomous_actions: false,
      },
    },
    null,
    2
  )
);
