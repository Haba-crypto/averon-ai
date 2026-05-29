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
  const organizationId = `org-phase-27-${label}`;
  const leadId = `lead-phase-27-${label}`;
  const workItemId = `work-item-phase-27-${label}`;
  const queueItemId = `queue-phase-27-${label}`;
  const agentId = `agent-phase-27-${label}`;
  const now = new Date().toISOString();
  const agentName = options.agentName ?? "SDR Agent";
  const state = {
    leads: [
      {
        id: leadId,
        organization_id: organizationId,
        name: "Ada Buyer",
        email: "ada@example.com",
        status: "qualified",
        intent_score: 91,
        urgency: "high",
      },
    ],
    workItems: [
      {
        id: workItemId,
        organization_id: organizationId,
        title: `${agentName} phase 27 work`,
        description: "Plan translation verification work item.",
        type: "lead_acquisition",
        status: "queued",
        priority: "normal",
        source_type: "lead",
        source_id: leadId,
        lead_id: leadId,
        parent_work_item_id: null,
        owner_type: "ai",
        owner_agent_id: agentId,
        owner_agent_name: agentName,
        owner_agent_role: options.agentRole ?? "Sales Development",
        ownership_status: "assigned",
        last_owner_change_reason: "phase 27 verification",
        metadata: {},
        updated_at: now,
        created_at: now,
      },
    ],
    agents: [
      {
        id: agentId,
        organization_id: organizationId,
        key: options.agentKey ?? "sdr",
        name: agentName,
        description: "Phase 27 verification agent.",
        config: {
          role: options.agentRole ?? "Sales Development",
        },
      },
    ],
    executionQueue: [
      {
        id: queueItemId,
        organization_id: organizationId,
        work_item_id: workItemId,
        review_id: null,
        source_decision_id: null,
        assigned_agent_id: agentId,
        assigned_agent_name: agentName,
        status: "ready",
        priority: "normal",
        queue_reason:
          options.queueReason ??
          "Lead qualification requires the next internal step.",
        failure_reason: null,
        next_action:
          options.nextAction ??
          "Ask one focused qualification question.",
        metadata: {
          openai_called: false,
        },
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    humanReviews: [],
    memoryEntries: [
      {
        id: `memory-phase-27-${label}`,
        organization_id: organizationId,
        agent_id: agentId,
        lead_id: leadId,
        work_item_id: workItemId,
        source_agent_execution_id: null,
        scope: "work_item",
        key: "qualification_context",
        content: "Lead has high intent and needs one focused question.",
        metadata: {
          memory_type: "qualification",
        },
        expires_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    aiEvents: [
      {
        id: `event-phase-27-${label}`,
        organization_id: organizationId,
        lead_id: leadId,
        work_item_id: workItemId,
        type: "phase_27_context",
        message: "Phase 27 plan translation verification context.",
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
          this.updatedRows.forEach((row) =>
            Object.assign(row, this.patch)
          );
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

const { buildAgentRuntimeContext } = loadModule(
  "lib/application/agents/build-agent-runtime-context.ts"
);
const { translateExecutionPlanToWork } = loadModule(
  "lib/application/agents/plan-translation.ts"
);
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const directEnvironment = createFakeSupabase("direct");
const runtimeContext = await buildAgentRuntimeContext({
  supabase: directEnvironment.supabase,
  organizationId: directEnvironment.organizationId,
  queueItemId: directEnvironment.queueItemId,
  workItemId: directEnvironment.workItemId,
  assignedAgentName: "SDR Agent",
});
const directPlan = {
  plan_id: "plan_phase_27_direct",
  agent_name: "SDR Agent",
  capability_id: "qualify_lead_next_step",
  objective: "Verify direct plan translation.",
  recommended_next_step: "Create internal plan work.",
  stop_condition: "Stop after translation.",
  risk_level: "low",
  requires_human_review: false,
  steps: [
    {
      id: "step_low",
      title: "Low risk task",
      description: "Create one safe internal task.",
      status: "pending",
      risk_level: "low",
      requires_human_review: false,
    },
    {
      id: "step_queue",
      title: "Queue follow-up work",
      description: "Create an internal follow-up queue item.",
      status: "pending",
      risk_level: "medium",
      requires_human_review: false,
    },
    {
      id: "step_high",
      title: "High risk step",
      description: "Do not translate this high risk step.",
      status: "pending",
      risk_level: "high",
      requires_human_review: false,
    },
    {
      id: "step_review",
      title: "Human review step",
      description: "Do not translate this review-gated step.",
      status: "pending",
      risk_level: "low",
      requires_human_review: true,
    },
  ],
};

const directResult = await translateExecutionPlanToWork({
  supabase: directEnvironment.supabase,
  organizationId: directEnvironment.organizationId,
  parentWorkItemId: directEnvironment.workItemId,
  agentExecutionId: "agent-execution-phase-27-direct",
  executionPlan: directPlan,
  runtimeContext,
});
const duplicateResult = await translateExecutionPlanToWork({
  supabase: directEnvironment.supabase,
  organizationId: directEnvironment.organizationId,
  parentWorkItemId: directEnvironment.workItemId,
  agentExecutionId: "agent-execution-phase-27-direct",
  executionPlan: directPlan,
  runtimeContext,
});

assert(
  directResult.created_tasks.length === 2,
  "low and medium pending steps should create tasks"
);
assert(
  directResult.skipped_steps.some(
    (step) =>
      step.step_id === "step_high" && step.reason === "high_risk_step"
  ),
  "high-risk step should be skipped"
);
assert(
  directResult.skipped_steps.some(
    (step) =>
      step.step_id === "step_review" &&
      step.reason === "human_review_required"
  ),
  "human-review-required step should be skipped"
);
assert(
  directResult.created_work_items.length === 1 &&
    directResult.created_queue_items.length === 1,
  "explicit queue follow-up step should create follow-up work and queue item"
);
assert(
  directEnvironment.state.tasks.length === 2,
  "direct translation should create exactly two tasks"
);
assert(
  duplicateResult.created_tasks.length === 0 &&
    duplicateResult.skipped_duplicates.some(
      (item) => item.type === "task" && item.step_id === "step_low"
    ),
  "duplicate translation should not create duplicate tasks"
);
assert(
  directEnvironment.state.tasks.length === 2,
  "duplicate translation should preserve task count"
);

const persistedEnvironment = createFakeSupabase("persisted");
const processResult = await processNextExecutionQueueItem({
  supabase: persistedEnvironment.supabase,
  organizationId: persistedEnvironment.organizationId,
  queueItemId: persistedEnvironment.queueItemId,
});
const agentExecution = persistedEnvironment.state.agentExecutions[0];
const translatedDecision = persistedEnvironment.state.decisions.find(
  (decision) => decision.decision_type === "execution_plan_translated"
);
const timeline = await listWorkItemTimeline({
  supabase: persistedEnvironment.supabase,
  workItemId: persistedEnvironment.workItemId,
  organizationId: persistedEnvironment.organizationId,
});
const translationTimelineItem = timeline.items.find(
  (item) => item.title === "Execution Plan Translated"
);

assert(processResult.success === true, "queue processing should succeed");
assert(
  translatedDecision,
  "execution_plan_translated decision should be created"
);
assert(
  translatedDecision.decision.outcome.created_task_ids.length === 3,
  "translation decision should store created task ids"
);
assert(
  agentExecution.output.plan_translation_result.created_tasks.length === 3,
  "agent_execution.output should include plan_translation_result"
);
assert(
  !agentExecution.output.plan_translation_error,
  "agent_execution.output should not include translation error on success"
);
assert(
  translationTimelineItem?.message ===
    "SDR Agent translated 3 plan steps into internal work.",
  "timeline should include Execution Plan Translated"
);
assert(
  processResult.processed_count === 1,
  "queue orchestrator should process one item only"
);

const sourcePaths = [
  "lib/application/agents/plan-translation.ts",
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
  !combinedSource.includes("resend") &&
    !combinedSource.includes("sendEmail") &&
    !combinedSource.includes("emails.send"),
  "should not send email"
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
      plan_translation: {
        direct_created_tasks: directResult.created_tasks.length,
        direct_created_work_items: directResult.created_work_items.length,
        direct_created_queue_items: directResult.created_queue_items.length,
        direct_skipped_steps: directResult.skipped_steps,
        duplicate_skips: duplicateResult.skipped_duplicates.length,
        persisted_created_tasks:
          agentExecution.output.plan_translation_result.created_tasks,
        decision_type: translatedDecision.decision_type,
        timeline_title: translationTimelineItem?.title ?? null,
        timeline_message: translationTimelineItem?.message ?? null,
        openai_called: false,
        autonomous_loop: false,
        processed_count: processResult.processed_count,
      },
    },
    null,
    2
  )
);
