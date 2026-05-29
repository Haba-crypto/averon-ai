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
  const organizationId = `org-phase-32-${label}`;
  const leadId = `lead-phase-32-${label}`;
  const agentId = `agent-phase-32-${label}`;
  const workItemId = `work-item-phase-32-${label}`;
  const queueItemId = `queue-phase-32-${label}`;
  const reviewId = `review-phase-32-${label}`;
  const now = new Date().toISOString();
  const assignedAgentId =
    options.missingAssignedAgent === true ? null : agentId;
  const assignedAgentName =
    options.missingAssignedAgent === true ? null : "Operations Agent";
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
    workItems:
      options.missingWorkItem === true
        ? []
        : [
            {
              id: workItemId,
              organization_id: organizationId,
              title: "Runtime hardening work",
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
        source_decision_id: `resume-decision-phase-32-${label}`,
        assigned_agent_id: assignedAgentId,
        assigned_agent_name: assignedAgentName,
        status: options.status ?? "ready",
        priority: "high",
        queue_reason: "Approved; continue with operations.",
        failure_reason: null,
        next_action: "Resume operations workflow.",
        metadata: options.queueMetadata ?? {},
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
        agent_execution_id: `execution-before-phase-32-${label}`,
        agent_decision_id: null,
        requested_by: "agent-operations",
        reviewer_user_id: null,
        source_agent_id: agentId,
        source_agent_name: "Operations Agent",
        review_type: "approval",
        review_reason: "Approval required.",
        review_title: "Resume Operations",
        review_summary: "Human reviewed the next execution step.",
        review_context: {},
        recommended_action: "Resume operations workflow.",
        status: "approved",
        priority: "high",
        decision: "approve",
        requested_at: now,
        reviewed_at: now,
        reviewed_by: "user-phase-32",
        review_outcome: "Approved",
        review_notes: "Approved; continue.",
        created_at: now,
        updated_at: now,
      },
    ],
    memoryEntries: [
      {
        id: `memory-phase-32-${label}`,
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
      Object.entries(filters).every(([key, value]) => row[key] === value) &&
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

const runtime = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { processNextExecutionQueueItem, ExecutionQueueEmptyError } = runtime;

const stageNames = [
  "claimQueueItemStage",
  "buildRuntimeContextStage",
  "evaluateGovernanceStage",
  "executeCapabilityStage",
  "applySideEffectsStage",
  "generateWorkStage",
  "createExecutionPlanStage",
  "translatePlanStage",
  "evaluateOutcomeStage",
  "generateReasoningProposalStage",
  "completeQueueItemStage",
  "failQueueItemStage",
];

for (const stageName of stageNames) {
  assert(
    typeof runtime[stageName] === "function",
    `${stageName} is exported`
  );
}

const successful = createFakeSupabase("successful");
const successResult = await processNextExecutionQueueItem({
  supabase: successful.supabase,
  organizationId: successful.organizationId,
  queueItemId: successful.queueItemId,
});
const successQueue = successful.state.executionQueue[0];
const successExecution = successful.state.agentExecutions[0];

assert(successResult.success === true, "successful item passes pipeline");
assert(successQueue.status === "completed", "successful queue completes");
assert(
  Boolean(successResult.idempotency_keys?.queue_claim_key),
  "result exposes queue claim idempotency key"
);
assert(
  Boolean(successExecution.output?.idempotency_keys?.reasoning_key),
  "agent execution output stores reasoning idempotency key"
);
assert(
  Boolean(successQueue.metadata?.queue_claim_key) &&
    Boolean(successQueue.metadata?.queue_completion_key),
  "queue metadata stores idempotency keys"
);
assert(
  Boolean(successQueue.lease_owner) && successQueue.lease_until === null,
  "lease metadata is written and released"
);

const blocked = createFakeSupabase("blocked", {
  missingAssignedAgent: true,
});
const blockedResult = await processNextExecutionQueueItem({
  supabase: blocked.supabase,
  organizationId: blocked.organizationId,
  queueItemId: blocked.queueItemId,
});

assert(blockedResult.result === "policy_blocked", "governance blocks item");
assert(blocked.state.executionQueue[0].status === "failed", "blocked fails");
assert(
  !blocked.state.decisions.some(
    (decision) => decision.decision_type === "capability_executed"
  ),
  "blocked governance stops before capability execution"
);
assert(
  Boolean(blocked.state.executionQueue[0].last_error),
  "blocked failure stores last_error"
);

const failed = createFakeSupabase("missing-work", {
  missingWorkItem: true,
});
let failedError = null;
try {
  await processNextExecutionQueueItem({
    supabase: failed.supabase,
    organizationId: failed.organizationId,
    queueItemId: failed.queueItemId,
  });
} catch (error) {
  failedError = error;
}
assert(Boolean(failedError), "stage failure is surfaced");
assert(failed.state.executionQueue[0].status === "failed", "stage fails queue");
assert(
  failed.state.executionQueue[0].metadata?.failed_stage ===
    "buildRuntimeContextStage",
  "failed stage is recorded"
);
assert(
  failed.state.executionQueue[0].last_error ===
    "Work item not found for execution queue item",
  "stage failure stores last_error"
);

let completedRetryError = null;
try {
  await processNextExecutionQueueItem({
    supabase: successful.supabase,
    organizationId: successful.organizationId,
    queueItemId: successful.queueItemId,
  });
} catch (error) {
  completedRetryError = error;
}
assert(
  completedRetryError instanceof ExecutionQueueEmptyError,
  "completed item cannot be claimed again"
);

let failedRetryError = null;
try {
  await processNextExecutionQueueItem({
    supabase: blocked.supabase,
    organizationId: blocked.organizationId,
    queueItemId: blocked.queueItemId,
  });
} catch (error) {
  failedRetryError = error;
}
assert(
  failedRetryError instanceof ExecutionQueueEmptyError,
  "failed item cannot be claimed again"
);

const sourcePaths = [
  "lib/application/execution-queue/process-next-execution-queue-item.ts",
  "lib/application/agents/reasoning-proposal.ts",
  "lib/application/agents/outcome-evaluation.ts",
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
      runtime_hardening: {
        stages: stageNames.length,
        success_status: successQueue.status,
        blocked_status: blocked.state.executionQueue[0].status,
        failed_stage: failed.state.executionQueue[0].metadata.failed_stage,
        idempotency_keys:
          Object.keys(successExecution.output.idempotency_keys).length,
        openai_called: false,
        autonomous_loop: false,
      },
    },
    null,
    2
  )
);
