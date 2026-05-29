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
  const organizationId = `org-phase-21-${label}`;
  const leadId = `lead-phase-21-${label}`;
  const workItemId = `work-item-phase-21-${label}`;
  const queueItemId = `queue-phase-21-${label}`;
  const agentId = `agent-phase-21-${label}`;
  const reviewId = `review-phase-21-${label}`;
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
        source_decision_id: `resume-decision-phase-21-${label}`,
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
        agent_execution_id: `execution-before-phase-21-${label}`,
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
        reviewed_by: "user-phase-21",
        review_outcome: "Approved",
        review_notes: "Approved; continue.",
        created_at: now,
        updated_at: now,
      },
    ],
    memoryEntries: [
      {
        id: `memory-phase-21-${label}`,
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
        id: `event-phase-21-${label}`,
        organization_id: organizationId,
        lead_id: leadId,
        work_item_id: workItemId,
        type: "review_approved",
        message: "Human review approved.",
        created_at: now,
      },
    ],
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
    state,
    transitions,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

const {
  AGENT_CAPABILITY_REGISTRY,
  executeAgentCapability,
  selectAgentCapability,
} = loadModule("lib/application/agents/agent-capabilities.ts");
const { buildAgentRuntimeContext } = loadModule(
  "lib/application/agents/build-agent-runtime-context.ts"
);
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

assert(
  Array.isArray(AGENT_CAPABILITY_REGISTRY) &&
    AGENT_CAPABILITY_REGISTRY.length >= 10,
  "capability registry exists"
);
assert(
  AGENT_CAPABILITY_REGISTRY.every(
    (capability) =>
      capability.id &&
      capability.name &&
      capability.agent_name &&
      capability.description &&
      capability.input_schema_shape &&
      typeof capability.handler === "function"
  ),
  "every capability should expose required metadata and handler"
);

const environment = createFakeSupabase("execution");
const context = await buildAgentRuntimeContext({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
  workItemId: environment.workItemId,
  assignedAgentName: "Operations Agent",
});
const selectedCapability = selectAgentCapability(context);
const deterministicResult = executeAgentCapability({
  organizationId: environment.organizationId,
  agentExecutionId: "execution-preview-phase-21",
  runtimeContext: context,
  capability: selectedCapability,
});

assert(
  selectedCapability.id === "summarize_review_decision",
  "Operations Agent approved review should select summarize_review_decision"
);
assert(
  deterministicResult.capability_id === "summarize_review_decision",
  "capability should execute deterministic result"
);
assert(
  deterministicResult.recommended_next_action ===
    "Resume operations workflow.",
  "capability should preserve recommended next action"
);
assert(
  deterministicResult.created_tasks.length === 0,
  "capability should not create tasks"
);
assert(
  deterministicResult.created_decisions.length === 0,
  "capability should not create nested decisions"
);

const result = await processNextExecutionQueueItem({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
});
const queueItem = environment.state.executionQueue[0];
const agentExecution = environment.state.agentExecutions[0];
const capabilityDecision = environment.state.decisions.find(
  (decision) => decision.decision_type === "capability_executed"
);
const timeline = await listWorkItemTimeline({
  supabase: environment.supabase,
  workItemId: environment.workItemId,
  organizationId: environment.organizationId,
});
const capabilityTimelineItem = timeline.items.find(
  (item) => item.title === "Capability Executed"
);

assert(result.success === true, "queue processing should succeed");
assert(result.processed_count === 1, "should process exactly one queue item");
assert(queueItem.status === "completed", "queue item should complete");
assert(
  agentExecution?.output?.capability_id ===
    "summarize_review_decision",
  "agent_execution.output includes capability result"
);
assert(
  agentExecution?.output?.capability_result?.summary,
  "agent_execution.output should include deterministic capability summary"
);
assert(
  capabilityDecision,
  "agent_decision capability_executed should be created"
);
assert(
  capabilityDecision.decision.outcome.capability_id ===
    "summarize_review_decision",
  "capability decision should store capability id"
);
assert(
  capabilityTimelineItem?.message ===
    "Operations Agent executed summarize_review_decision.",
  "timeline includes Capability Executed"
);

const sourcePaths = [
  "lib/application/agents/agent-capabilities.ts",
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
      agent_capability_execution: {
        registry_count: AGENT_CAPABILITY_REGISTRY.length,
        selected_capability_id: selectedCapability.id,
        deterministic_result:
          deterministicResult.result.summary,
        agent_execution_output_capability:
          agentExecution.output.capability_id,
        decision_type: capabilityDecision.decision_type,
        timeline_title: capabilityTimelineItem?.title ?? null,
        timeline_message: capabilityTimelineItem?.message ?? null,
        queue_status: queueItem.status,
        openai_called: false,
        autonomous_loop: false,
      },
    },
    null,
    2
  )
);
