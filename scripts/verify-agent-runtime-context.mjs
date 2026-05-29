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
  const organizationId = `org-phase-20-${label}`;
  const leadId = `lead-phase-20-${label}`;
  const workItemId = `work-item-phase-20-${label}`;
  const queueItemId = `queue-phase-20-${label}`;
  const agentId = `agent-phase-20-${label}`;
  const reviewId = `review-phase-20-${label}`;
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
          "Human approved execution resume.",
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
        source_decision_id: `resume-decision-phase-20-${label}`,
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
        agent_execution_id: `execution-before-phase-20-${label}`,
        agent_decision_id: null,
        requested_by: "agent-operations",
        reviewer_user_id: null,
        source_agent_id: agentId,
        source_agent_name: "Operations Agent",
        review_type: "approval",
        review_reason: "Approval required.",
        review_title: "Resume Operations",
        review_summary: "Human approved the next execution step.",
        review_context: {
          unsafe_raw_payload_should_not_be_persisted: true,
        },
        recommended_action: "Resume operations workflow.",
        status: "approved",
        priority: "high",
        decision: "approve",
        requested_at: now,
        reviewed_at: now,
        reviewed_by: "user-phase-20",
        review_outcome: "Approved",
        review_notes: "Approved; continue.",
        created_at: now,
        updated_at: now,
      },
    ],
    memoryEntries: [
      {
        id: `memory-fact-phase-20-${label}`,
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
      {
        id: `memory-risk-phase-20-${label}`,
        organization_id: organizationId,
        agent_id: agentId,
        lead_id: leadId,
        work_item_id: null,
        source_agent_execution_id: null,
        scope: "organization",
        key: "urgency",
        content: "Lead has high urgency and expects a prompt workflow.",
        metadata: {
          memory_type: "risk",
        },
        expires_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    aiEvents: [
      {
        id: `event-phase-20-${label}`,
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

            if (
              table === "execution_queue" &&
              this.patch.status
            ) {
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
    leadId,
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
  buildAgentRuntimeContext,
  summarizeAgentRuntimeContext,
} = loadModule("lib/application/agents/build-agent-runtime-context.ts");
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);

const environment = createFakeSupabase("snapshot");

const context = await buildAgentRuntimeContext({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
  workItemId: environment.workItemId,
  assignedAgentName: "Operations Agent",
});
const contextSummary = summarizeAgentRuntimeContext(context);

assert(
  context.organization_id === environment.organizationId,
  "runtime context should preserve organization id"
);
assert(context.work_item?.id === environment.workItemId, "context includes work item");
assert(context.queue_item?.id === environment.queueItemId, "context includes queue item");
assert(
  context.assigned_agent?.name === "Operations Agent",
  "context includes assigned agent"
);
assert(
  context.lead?.id === environment.leadId,
  "context includes lead resolved from work item"
);
assert(
  contextSummary.memory_count >= 1,
  "context includes grouped memory context"
);
assert(
  context.human_review_context?.id ===
    environment.state.humanReviews[0].id,
  "context includes human review context when review_id exists"
);
assert(
  context.recent_timeline.length > 0 &&
    context.recent_timeline.length <= 10,
  "context includes recent timeline"
);
assert(
  !JSON.stringify(context.recent_timeline).includes(
    "unsafe_raw_payload_should_not_be_persisted"
  ),
  "recent timeline should not persist raw review context payload"
);

const result = await processNextExecutionQueueItem({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
});
const agentExecution = environment.state.agentExecutions[0];
const processedDecision = environment.state.decisions.find(
  (decision) =>
    decision.decision_type === "capability_executed"
);

assert(result.openai_called === false, "processing should not call OpenAI");
assert(result.processed_count === 1, "processing should process exactly one item");
assert(
  agentExecution?.input?.runtime_context_version === "v1",
  "agent_execution.input should store runtime context version"
);
assert(
  agentExecution?.input?.runtime_context?.work_item?.id ===
    environment.workItemId,
  "agent_execution.input.runtime_context should be persisted"
);
assert(
  agentExecution?.input?.runtime_context?.memory_context?.decisions
    ?.length >= 1,
  "persisted runtime context should include grouped memory"
);
assert(
  agentExecution?.metadata?.openai_called === false,
  "agent_execution metadata should record openai_called false"
);
assert(
  processedDecision?.decision?.outcome?.runtime_context_summary
    ?.memory_count >= 1,
  "capability_executed decision should contain runtime_context_summary"
);
assert(
  processedDecision?.metadata?.runtime_context_summary?.timeline_count >=
    1,
  "decision metadata should include runtime_context_summary"
);

const serviceSource = fs.readFileSync(
  path.join(
    rootDir,
    "lib/application/agents/build-agent-runtime-context.ts"
  ),
  "utf8"
);
const orchestratorSource = fs.readFileSync(
  path.join(
    rootDir,
    "lib/application/execution-queue/process-next-execution-queue-item.ts"
  ),
  "utf8"
);
const routeSource = fs.readFileSync(
  path.join(
    rootDir,
    "app/api/execution-queue/process-next/route.ts"
  ),
  "utf8"
);
const combinedSource = `${serviceSource}\n${orchestratorSource}\n${routeSource}`;

assert(
  !combinedSource.includes("@/lib/ai/openai") &&
    !combinedSource.includes("new OpenAI") &&
    !combinedSource.includes("responses.create") &&
    !combinedSource.includes("chat.completions"),
  "should not call OpenAI"
);

console.log(
  JSON.stringify(
    {
      agent_runtime_context: {
        context_built: true,
        work_item_id: context.work_item.id,
        queue_item_id: context.queue_item.id,
        assigned_agent_name: context.assigned_agent.name,
        lead_id: context.lead?.id ?? null,
        memory_count: contextSummary.memory_count,
        human_review_status:
          context.human_review_context?.status ?? null,
        timeline_count: context.recent_timeline.length,
        runtime_context_persisted: Boolean(
          agentExecution?.input?.runtime_context
        ),
        decision_summary_persisted: Boolean(
          processedDecision?.decision?.outcome
            ?.runtime_context_summary
        ),
        openai_called: false,
      },
    },
    null,
    2
  )
);
