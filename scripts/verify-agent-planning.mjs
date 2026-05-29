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

function createFakeSupabase(label, options = {}) {
  const organizationId = `org-phase-26-${label}`;
  const leadId = `lead-phase-26-${label}`;
  const workItemId = `work-item-phase-26-${label}`;
  const queueItemId = `queue-phase-26-${label}`;
  const agentId = `agent-phase-26-${label}`;
  const reviewId = `review-phase-26-${label}`;
  const now = new Date().toISOString();
  const agentName = options.agentName ?? "Operations Agent";
  const state = {
    leads: [
      {
        id: leadId,
        organization_id: organizationId,
        name: "Ada Buyer",
        email: "ada@example.com",
        status: options.leadStatus ?? "qualified",
        intent_score: 91,
        urgency: "high",
      },
    ],
    workItems: [
      {
        id: workItemId,
        organization_id: organizationId,
        title: `${agentName} phase 26 work`,
        type: options.workItemType ?? "lead_acquisition",
        status: "queued",
        source_type: "lead",
        source_id: leadId,
        lead_id: leadId,
        parent_work_item_id: null,
        owner_type: "ai",
        owner_agent_id: agentId,
        owner_agent_name: agentName,
        owner_agent_role: options.agentRole ?? "Revenue Operations",
        ownership_status: options.ownershipStatus ?? "ready_to_resume",
        last_owner_change_reason:
          options.ownerReason ?? "approved human review; ready to resume",
        metadata: {},
        updated_at: now,
        created_at: now,
      },
    ],
    agents: [
      {
        id: agentId,
        organization_id: organizationId,
        key: options.agentKey ?? "operations",
        name: agentName,
        description: "Phase 26 verification agent.",
        config: {
          role: options.agentRole ?? "Revenue Operations",
        },
      },
      {
        id: `operations-agent-phase-26-${label}`,
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
        review_id: options.withReview === false ? null : reviewId,
        source_decision_id: `resume-decision-phase-26-${label}`,
        assigned_agent_id: agentId,
        assigned_agent_name: agentName,
        status: "ready",
        priority: "high",
        queue_reason:
          options.queueReason ?? "Approved; continue with operations.",
        failure_reason: null,
        next_action:
          options.nextAction ?? "Resume operations workflow.",
        metadata: options.queueMetadata ?? {},
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    humanReviews:
      options.withReview === false
        ? []
        : [
            {
              id: reviewId,
              organization_id: organizationId,
              work_item_id: workItemId,
              agent_execution_id: `execution-before-phase-26-${label}`,
              agent_decision_id: null,
              requested_by: "agent-operations",
              reviewer_user_id: null,
              source_agent_id: agentId,
              source_agent_name: agentName,
              review_type: "approval",
              review_reason: "Approval required.",
              review_title: "Resume Operations",
              review_summary: "Human approved the next execution step.",
              review_context: {},
              recommended_action:
                options.nextAction ?? "Resume operations workflow.",
              status: options.reviewStatus ?? "approved",
              priority: "high",
              decision: "approve",
              requested_at: now,
              reviewed_at: now,
              reviewed_by: "user-phase-26",
              review_outcome: "Approved",
              review_notes:
                options.reviewNotes ?? "Approved; continue.",
              created_at: now,
              updated_at: now,
            },
          ],
    memoryEntries: buildMemoryEntries({
      label,
      organizationId,
      leadId,
      workItemId,
      agentId,
      now,
      memory: options.memory ?? [],
    }),
    aiEvents: [
      {
        id: `event-phase-26-${label}`,
        organization_id: organizationId,
        lead_id: leadId,
        work_item_id: workItemId,
        type: "phase_26_context",
        message: "Phase 26 planning verification context.",
        created_at: now,
      },
    ],
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
          this.updatedRows.forEach((row) => {
            Object.assign(row, this.patch);
          });
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
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

function buildMemoryEntries({
  label,
  organizationId,
  leadId,
  workItemId,
  agentId,
  now,
  memory,
}) {
  return memory.map((entry, index) => ({
    id: `memory-phase-26-${label}-${index + 1}`,
    organization_id: organizationId,
    agent_id: agentId,
    lead_id: leadId,
    work_item_id: workItemId,
    source_agent_execution_id: null,
    scope: "work_item",
    key: entry.type,
    content: entry.content,
    metadata: {
      memory_type: entry.type,
    },
    expires_at: null,
    created_at: now,
    updated_at: now,
  }));
}

const {
  executeAgentCapability,
  selectAgentCapability,
} = loadModule("lib/application/agents/agent-capabilities.ts");
const { buildAgentRuntimeContext } = loadModule(
  "lib/application/agents/build-agent-runtime-context.ts"
);
const { buildAgentExecutionPlan } = loadModule(
  "lib/application/agents/agent-planning.ts"
);
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

async function previewPlan(label, options) {
  const environment = createFakeSupabase(label, options);
  const runtimeContext = await buildAgentRuntimeContext({
    supabase: environment.supabase,
    organizationId: environment.organizationId,
    queueItemId: environment.queueItemId,
    workItemId: environment.workItemId,
    assignedAgentName: options.agentName,
  });
  const selectedCapability = selectAgentCapability(runtimeContext);
  const capabilityResult = executeAgentCapability({
    organizationId: environment.organizationId,
    agentExecutionId: `execution-preview-phase-26-${label}`,
    runtimeContext,
    capability: selectedCapability,
  });
  const plan = buildAgentExecutionPlan({
    runtimeContext,
    selectedCapability,
    capabilityResult,
    continuationPolicy: options.continuationPolicy ?? null,
  });

  return { environment, plan, selectedCapability };
}

const operationsPreview = await previewPlan("operations-preview", {
  agentName: "Operations Agent",
  continuationPolicy: {
    allowed: true,
    mode: "manual",
    reason: "Continuation is allowed in manual mode with low risk.",
    risk_level: "low",
    requires_human_review: true,
    max_steps_allowed: 3,
    policy_checks: [],
  },
});
assert(
  operationsPreview.plan.steps.length === 4,
  "Operations approved-review context creates 4-step plan"
);
assert(
  operationsPreview.plan.steps[0].title === "Resume approved work" &&
    operationsPreview.plan.steps[3].title ===
      "Wait for controlled continuation",
  "Operations plan should follow approved-review rule"
);

const sdrPreview = await previewPlan("sdr-preview", {
  agentName: "SDR Agent",
  agentKey: "sdr",
  agentRole: "Sales Development",
  withReview: false,
  queueReason: "Lead qualification requires the next discovery question.",
  nextAction: "Ask one focused qualification question.",
});
assert(
  sdrPreview.plan.steps.map((step) => step.title).join("|") ===
    "Qualify lead|Ask next qualification question|Update lead state",
  "SDR context creates qualification plan"
);

const researchPreview = await previewPlan("research-preview", {
  agentName: "Research Agent",
  agentKey: "research",
  agentRole: "Account Research",
  withReview: false,
  queueReason: "Missing account requirements need research.",
  nextAction: "Collect missing account context.",
});
assert(
  researchPreview.plan.steps.map((step) => step.title).join("|") ===
    "Identify missing info|Summarize account context|Queue research follow-up",
  "Research context creates research plan"
);

const closerPreview = await previewPlan("closer-preview", {
  agentName: "Closer Agent",
  agentKey: "closer",
  agentRole: "Sales Closer",
  withReview: false,
  queueReason: "Prepare proposal next step and review risk.",
  nextAction: "Confirm proposal scope.",
  memory: [
    {
      type: "risk",
      content: "Budget approval risk may block the proposal.",
    },
  ],
});
assert(
  closerPreview.plan.steps.map((step) => step.title).join("|") ===
    "Prepare proposal next step|Identify deal risk|Request approval if risk exists",
  "Closer context creates proposal plan"
);
assert(
  closerPreview.plan.requires_human_review === true,
  "Closer risk context should require human review"
);

const persistedEnvironment = createFakeSupabase("persisted", {
  agentName: "Operations Agent",
});
const result = await processNextExecutionQueueItem({
  supabase: persistedEnvironment.supabase,
  organizationId: persistedEnvironment.organizationId,
  queueItemId: persistedEnvironment.queueItemId,
});
const agentExecution = persistedEnvironment.state.agentExecutions[0];
const planningDecision = persistedEnvironment.state.decisions.find(
  (decision) =>
    decision.decision_type === "agent_execution_plan_created"
);
const timeline = await listWorkItemTimeline({
  supabase: persistedEnvironment.supabase,
  workItemId: persistedEnvironment.workItemId,
  organizationId: persistedEnvironment.organizationId,
});
const planningTimelineItem = timeline.items.find(
  (item) => item.title === "Agent Execution Plan Created"
);

assert(result.success === true, "queue processing should succeed");
assert(
  agentExecution.output.execution_plan.steps.length === 4,
  "plan stored in agent_executions.output"
);
assert(
  planningDecision,
  "agent_execution_plan_created decision created"
);
assert(
  planningDecision.decision.outcome.plan_id ===
    agentExecution.output.execution_plan.plan_id,
  "planning decision should store plan id"
);
assert(
  planningDecision.decision.outcome.step_count === 4,
  "planning decision should store step count"
);
assert(
  planningTimelineItem?.message ===
    "Operations Agent created a 4-step execution plan.",
  "timeline includes planning event"
);

const sourcePaths = [
  "lib/application/agents/agent-planning.ts",
  "lib/application/execution-queue/process-next-execution-queue-item.ts",
  "lib/application/work-items/list-work-item-timeline.ts",
  "app/api/execution-queue/process-next/route.ts",
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
      agent_planning: {
        operations_step_count: operationsPreview.plan.steps.length,
        sdr_steps: sdrPreview.plan.steps.map((step) => step.title),
        research_steps: researchPreview.plan.steps.map((step) => step.title),
        closer_steps: closerPreview.plan.steps.map((step) => step.title),
        persisted_plan_id: agentExecution.output.execution_plan.plan_id,
        decision_type: planningDecision.decision_type,
        timeline_title: planningTimelineItem?.title ?? null,
        openai_called: false,
        autonomous_loop: false,
      },
    },
    null,
    2
  )
);
