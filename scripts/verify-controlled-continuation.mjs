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
  const organizationId = `org-phase-25-${label}`;
  const agentId = `agent-phase-25-${label}`;
  const now = new Date().toISOString();
  const primaryWorkItemId = `work-item-phase-25-${label}-primary`;
  const secondWorkItemId = `work-item-phase-25-${label}-second`;
  const primaryQueueItemId = `queue-phase-25-${label}-primary`;
  const secondQueueItemId = `queue-phase-25-${label}-second`;
  const transitions = [];
  const state = {
    workItems: [
      buildWorkItem({
        id: primaryWorkItemId,
        organizationId,
        agentId,
        now,
      }),
      buildWorkItem({
        id: secondWorkItemId,
        organizationId,
        agentId,
        now,
      }),
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
      buildQueueItem({
        id: primaryQueueItemId,
        organizationId,
        workItemId: primaryWorkItemId,
        agentId,
        now,
        queueReason:
          options.blocked === true
            ? "Approved internally, but now requests an external action."
            : "Approved internal follow-up step.",
        nextAction:
          options.blocked === true
            ? "Send an email externally."
            : "Resume internal operations workflow.",
        depth: options.depth ?? 2,
      }),
      ...(options.includeSecond === false
        ? []
        : [
            buildQueueItem({
              id: secondQueueItemId,
              organizationId,
              workItemId: secondWorkItemId,
              agentId,
              now,
              queueReason: "Second eligible internal follow-up step.",
              nextAction: "Prepare internal note.",
              depth: 1,
            }),
          ]),
    ],
    aiEvents: [],
    agentExecutions: [],
    decisions: [],
    humanReviews: [],
    memoryEntries: [
      {
        id: `memory-phase-25-${label}`,
        organization_id: organizationId,
        agent_id: agentId,
        work_item_id: primaryWorkItemId,
        source_agent_execution_id: null,
        scope: "work_item",
        key: "continuation_context",
        content: "Continuation is approved for an internal step.",
        expires_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    leads: [],
  };

  function tableRows(table) {
    if (table === "work_items") return state.workItems;
    if (table === "agents") return state.agents;
    if (table === "execution_queue") return state.executionQueue;
    if (table === "agent_decisions") return state.decisions;
    if (table === "ai_events") return state.aiEvents;
    if (table === "agent_executions") return state.agentExecutions;
    if (table === "human_reviews") return state.humanReviews;
    if (table === "memory_entries") return state.memoryEntries;
    if (table === "leads") return state.leads;

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

            if (table === "execution_queue" && this.patch.status) {
              transitions.push({
                id: row.id,
                status: this.patch.status,
              });
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
          this.updatedRows.forEach((row) => {
            Object.assign(row, this.patch);

            if (table === "execution_queue" && this.patch.status) {
              transitions.push({
                id: row.id,
                status: this.patch.status,
              });
            }
          });
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
    primaryQueueItemId,
    secondQueueItemId,
    primaryWorkItemId,
    state,
    transitions,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

function buildWorkItem({ id, organizationId, agentId, now }) {
  return {
    id,
    organization_id: organizationId,
    title: "Continue execution after human approval",
    description: "Follow-up work created after approval.",
    type: "follow_up",
    status: "queued",
    priority: "high",
    source_type: "capability",
    source_id: "agent-execution-source",
    lead_id: null,
    parent_work_item_id: null,
    owner_type: "ai",
    owner_agent_id: agentId,
    owner_agent_name: "Operations Agent",
    owner_agent_role: "Revenue Operations",
    ownership_status: "assigned",
    last_owner_change_at: now,
    last_owner_change_reason: "follow-up work generated by capability",
    metadata: {
      source: "capability_work_generation",
      risk_level: "low",
      openai_called: false,
    },
    created_at: now,
    updated_at: now,
  };
}

function buildQueueItem({
  id,
  organizationId,
  workItemId,
  agentId,
  now,
  queueReason,
  nextAction,
  depth,
}) {
  return {
    id,
    organization_id: organizationId,
    work_item_id: workItemId,
    review_id: null,
    source_decision_id: null,
    assigned_agent_id: agentId,
    assigned_agent_name: "Operations Agent",
    status: "ready",
    priority: "high",
    queue_reason: queueReason,
    failure_reason: null,
    next_action: nextAction,
    metadata: {
      source: "capability_work_generation",
      phase: 24,
      continuation_allowed: true,
      continuation_mode: "manual",
      continuation_reason:
        "Continuation is allowed in manual mode with low risk.",
      continuation_depth: depth,
      openai_called: false,
    },
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
}

const { processControlledContinuation } = loadModule(
  "lib/application/execution-queue/controlled-continuation.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const successEnvironment = createFakeSupabase("success");
const successResult = await processControlledContinuation({
  supabase: successEnvironment.supabase,
  organizationId: successEnvironment.organizationId,
});
const processedQueueItem = successEnvironment.state.executionQueue.find(
  (item) => item.id === successEnvironment.primaryQueueItemId
);
const untouchedQueueItem = successEnvironment.state.executionQueue.find(
  (item) => item.id === successEnvironment.secondQueueItemId
);
const processedDecision = successEnvironment.state.decisions.find(
  (decision) =>
    decision.decision_type === "controlled_continuation_processed"
);
const completedQueueItems = successEnvironment.state.executionQueue.filter(
  (item) => item.status === "completed"
);

assert(successResult.processed_count === 1, "should process one item");
assert(
  completedQueueItems.length === 1,
  "should complete exactly one queue item"
);
assert(
  processedQueueItem?.status === "completed",
  "eligible queue item should complete"
);
assert(
  untouchedQueueItem?.status === "ready",
  "second eligible queue item should remain ready"
);
assert(
  processedDecision,
  "controlled_continuation_processed decision should be created"
);
assert(
  processedDecision.decision.outcome.queue_item_id ===
    successEnvironment.primaryQueueItemId,
  "processed decision should store queue item id"
);
assert(
  processedDecision.decision.outcome.policy_snapshot.allowed === true,
  "processed decision should store policy snapshot"
);
assert(
  processedQueueItem.metadata.continuation_processed_by === "manual_api",
  "processed queue metadata should record manual API"
);
assert(
  processedQueueItem.metadata.continuation_policy_snapshot.allowed === true,
  "processed queue metadata should store policy snapshot"
);
assert(
  processedQueueItem.metadata.continuation_depth === 2,
  "processed queue item should preserve continuation depth"
);
assert(
  successEnvironment.state.executionQueue.filter(
    (item) => item.status === "in_progress"
  ).length === 0,
  "no queue item should remain in progress"
);

const timeline = await listWorkItemTimeline({
  supabase: successEnvironment.supabase,
  workItemId: successEnvironment.primaryWorkItemId,
  organizationId: successEnvironment.organizationId,
});
const continuationTimelineItem = timeline.items.find(
  (item) => item.title === "Controlled Continuation Processed"
);
assert(
  continuationTimelineItem?.message ===
    "Operations Agent continued one approved follow-up step.",
  "timeline should include controlled continuation event"
);

const blockedEnvironment = createFakeSupabase("blocked", {
  blocked: true,
  includeSecond: false,
});
const blockedResult = await processControlledContinuation({
  supabase: blockedEnvironment.supabase,
  organizationId: blockedEnvironment.organizationId,
});
const blockedQueueItem = blockedEnvironment.state.executionQueue[0];
const blockedDecision = blockedEnvironment.state.decisions.find(
  (decision) => decision.decision_type === "continuation_blocked"
);

assert(blockedResult.result === "blocked", "blocked case should return blocked");
assert(
  blockedResult.processed_count === 0,
  "blocked case should not process an item"
);
assert(
  blockedQueueItem.status === "ready",
  "blocked queue item should remain ready when no blocked status exists"
);
assert(
  blockedDecision,
  "blocked case should create continuation_blocked decision"
);
assert(
  blockedDecision.decision.outcome.policy_snapshot.allowed === false,
  "blocked decision should store rejected policy snapshot"
);
assert(
  blockedEnvironment.state.agentExecutions.length === 0,
  "blocked case should not create an agent execution"
);

const sourcePaths = [
  "lib/application/execution-queue/controlled-continuation.ts",
  "app/api/execution-queue/continue-once/route.ts",
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
      controlled_continuation: {
        processed_count: successResult.processed_count,
        completed_queue_items: completedQueueItems.length,
        processed_decision_id: processedDecision.id,
        policy_reevaluated_before_processing:
          successResult.policy_snapshot.allowed === true,
        queue_status: processedQueueItem.status,
        continuation_depth: processedQueueItem.metadata.continuation_depth,
        blocked_result: blockedResult.result,
        blocked_decision_id: blockedDecision.id,
        blocked_queue_status: blockedQueueItem.status,
        openai_called: false,
        loop_detected: false,
        timeline_title: continuationTimelineItem?.title ?? null,
      },
    },
    null,
    2
  )
);
