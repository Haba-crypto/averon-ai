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
  const organizationId = `org-phase-22-${label}`;
  const leadId = `lead-phase-22-${label}`;
  const workItemId = `work-item-phase-22-${label}`;
  const queueItemId = `queue-phase-22-${label}`;
  const agentId = `agent-phase-22-${label}`;
  const reviewId = `review-phase-22-${label}`;
  const now = new Date().toISOString();
  const transitions = [];
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
        source_decision_id: `resume-decision-phase-22-${label}`,
        assigned_agent_id: agentId,
        assigned_agent_name: "Operations Agent",
        status: "ready",
        priority: "high",
        queue_reason: "Approved; continue with operations.",
        failure_reason: null,
        next_action: "Resume operations workflow.",
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
        agent_execution_id: `execution-before-phase-22-${label}`,
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
        reviewed_by: "user-phase-22",
        review_outcome: "Approved",
        review_notes: "Approved; continue.",
        created_at: now,
        updated_at: now,
      },
    ],
    memoryEntries: [
      {
        id: `memory-phase-22-${label}`,
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
    aiEvents: [
      {
        id: `event-phase-22-${label}`,
        organization_id: organizationId,
        lead_id: leadId,
        work_item_id: workItemId,
        type: "review_approved",
        message: "Human review approved.",
        created_at: now,
      },
    ],
    tasks: [],
    agentExecutions: [],
    decisions: [],
  };

  function tableRows(table) {
    if (table === "leads") {
      return state.leads;
    }

    if (table === "work_items") {
      return state.workItems;
    }

    if (table === "agents") {
      return state.agents;
    }

    if (table === "execution_queue") {
      return state.executionQueue;
    }

    if (table === "human_reviews") {
      return state.humanReviews;
    }

    if (table === "memory_entries") {
      return state.memoryEntries;
    }

    if (table === "ai_events") {
      return state.aiEvents;
    }

    if (table === "tasks") {
      return state.tasks;
    }

    if (table === "agent_executions") {
      return state.agentExecutions;
    }

    if (table === "agent_decisions") {
      return state.decisions;
    }

    return [];
  }

  function matches(row, filters, inFilters) {
    return (
      Object.entries(filters).every(
        ([key, value]) => row[key] === value
      ) &&
      Object.entries(inFilters).every(([key, values]) =>
        values.includes(row[key])
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

    if (builder.limitCount !== null) {
      result = result.slice(0, builder.limitCount);
    }

    return result;
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
            matches(row, this.filters, this.inFilters)
          );
          this.updatedRows.forEach((row) => {
            Object.assign(row, this.patch);

            if (table === "execution_queue" && this.patch.status) {
              transitions.push(this.patch.status);
            }
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
              matches(candidate, this.filters, this.inFilters)
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
              matches(candidate, this.filters, this.inFilters)
            ),
          this
        );
        const row = rows[0];

        return { data: row ? { ...row } : null, error: null };
      },
      async execute() {
        if (this.patch && !this.updatedRows) {
          this.updatedRows = tableRows(table).filter((row) =>
            matches(row, this.filters, this.inFilters)
          );
          this.updatedRows.forEach((row) => Object.assign(row, this.patch));
        }

        let rows = tableRows(table)
          .filter((row) =>
            matches(row, this.filters, this.inFilters)
          )
          .filter((row) =>
            Object.entries(this.lessThanFilters).every(
              ([key, value]) => row[key] < value
            )
          );

        rows = applySortAndLimit(rows, this);

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
    transitions,
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
const { executeAgentCapability, selectAgentCapability } = loadModule(
  "lib/application/agents/agent-capabilities.ts"
);
const { applyCapabilitySideEffects } = loadModule(
  "lib/application/agents/capability-side-effects.ts"
);
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const environment = createFakeSupabase("operations");
const result = await processNextExecutionQueueItem({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
});
const queueItem = environment.state.executionQueue[0];
const agentExecution = environment.state.agentExecutions[0];
const createdTask = environment.state.tasks[0];
const sideEffectsDecision = environment.state.decisions.find(
  (decision) =>
    decision.decision_type === "capability_side_effects_applied"
);
const capabilityDecision = environment.state.decisions.find(
  (decision) => decision.decision_type === "capability_executed"
);
const timeline = await listWorkItemTimeline({
  supabase: environment.supabase,
  workItemId: environment.workItemId,
  organizationId: environment.organizationId,
});
const sideEffectsTimelineItem = timeline.items.find(
  (item) => item.title === "Capability Side Effects Applied"
);

assert(result.success === true, "queue processing should succeed");
assert(queueItem.status === "completed", "queue item should complete");
assert(
  environment.state.tasks.length === 1,
  "Operations capability should create one internal task"
);
assert(
  createdTask.title === "Continue execution after human approval",
  "Operations capability should create the approval continuation task"
);
assert(
  createdTask.metadata.capability_id === "summarize_review_decision",
  "created task should be tagged with capability id"
);
assert(
  sideEffectsDecision,
  "side effects decision should be created"
);
assert(
  sideEffectsDecision.decision.outcome.created_task_ids.includes(
    createdTask.id
  ),
  "side effects decision should store created task ids"
);
assert(
  sideEffectsDecision.decision.outcome.created_decision_ids.includes(
    sideEffectsDecision.id
  ),
  "side effects decision should store created decision ids"
);
assert(
  capabilityDecision,
  "capability execution decision should still be created"
);
assert(
  agentExecution.output.capability_result.summary,
  "agent_execution.output should include capability_result"
);
assert(
  agentExecution.output.side_effects_result.created_tasks[0] ===
    createdTask.id,
  "agent_execution.output should include side_effects_result"
);
assert(
  sideEffectsTimelineItem?.message ===
    "Operations Agent created an internal task after summarize_review_decision.",
  "timeline should include side effects event"
);

const context = await buildAgentRuntimeContext({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
  workItemId: environment.workItemId,
  assignedAgentName: "Operations Agent",
});
const selectedCapability = selectAgentCapability(context);
const capabilityResult = executeAgentCapability({
  organizationId: environment.organizationId,
  agentExecutionId: agentExecution.id,
  runtimeContext: context,
  capability: selectedCapability,
});
const repeatResult = await applyCapabilitySideEffects({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  workItemId: environment.workItemId,
  agentExecutionId: agentExecution.id,
  capabilityResult,
  runtimeContext: context,
  agentId: environment.agentId,
  agentName: "Operations Agent",
});

assert(
  environment.state.tasks.length === 1,
  "duplicate open task should not be created on repeat"
);
assert(
  repeatResult.created_tasks.length === 0 &&
    repeatResult.skipped_duplicates.length === 1,
  "repeat side effects should report skipped duplicate task"
);

const sourcePaths = [
  "lib/application/agents/capability-side-effects.ts",
  "lib/application/execution-queue/process-next-execution-queue-item.ts",
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
      capability_side_effects: {
        queue_status: queueItem.status,
        created_task_id: createdTask.id,
        duplicate_task_created: environment.state.tasks.length > 1,
        side_effects_decision_id: sideEffectsDecision.id,
        capability_decision_id: capabilityDecision.id,
        agent_execution_side_effects:
          agentExecution.output.side_effects_result,
        repeat_side_effects: repeatResult,
        timeline_title: sideEffectsTimelineItem?.title ?? null,
        timeline_message: sideEffectsTimelineItem?.message ?? null,
        openai_called: false,
        external_calls: false,
        processed_count: result.processed_count,
      },
    },
    null,
    2
  )
);
