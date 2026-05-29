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
  const organizationId = `org-phase-19-${label}`;
  const workItemId = `work-item-phase-19-${label}`;
  const queueItemId = `queue-phase-19-${label}`;
  const agentId = `agent-phase-19-${label}`;
  const now = new Date().toISOString();
  const transitions = [];
  const state = {
    workItems: options.missingWorkItem
      ? []
      : [
          {
            id: workItemId,
            organization_id: organizationId,
            status: "queued",
            owner_type: "ai",
            owner_agent_id: agentId,
            owner_agent_name: "Operations Agent",
            owner_agent_role: "Revenue Operations",
            owner_user_id: null,
            ownership_status: "ready_to_resume",
            last_owner_change_at: null,
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
        review_id: `review-phase-19-${label}`,
        source_decision_id: `resume-decision-phase-19-${label}`,
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
    decisions: [],
    aiEvents: [],
    agentExecutions: [],
    humanReviews: [
      {
        id: `review-phase-19-${label}`,
        organization_id: organizationId,
        work_item_id: workItemId,
        agent_execution_id: `execution-before-phase-19-${label}`,
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
        reviewed_by: "user-phase-19",
        review_outcome: "Approved",
        review_notes: "Approved; continue.",
        created_at: now,
        updated_at: now,
      },
    ],
    memoryEntries: [
      {
        id: `memory-phase-19-${label}`,
        organization_id: organizationId,
        agent_id: agentId,
        work_item_id: workItemId,
        source_agent_execution_id: null,
        scope: "work_item",
        key: "approval_context",
        content: "Human approved resumed execution.",
        expires_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
  };

  function tableRows(table) {
    if (table === "work_items") {
      return state.workItems;
    }

    if (table === "agents") {
      return state.agents;
    }

    if (table === "execution_queue") {
      return state.executionQueue;
    }

    if (table === "agent_decisions") {
      return state.decisions;
    }

    if (table === "ai_events") {
      return state.aiEvents;
    }

    if (table === "agent_executions") {
      return state.agentExecutions;
    }

    if (table === "human_reviews") {
      return state.humanReviews;
    }

    if (table === "memory_entries") {
      return state.memoryEntries;
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
        if (
          table === "agent_decisions" &&
          options.failDecisionInsert
        ) {
          this.insertError = new Error("Simulated decision failure");
          return this;
        }

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
        if (this.insertError) {
          return { data: null, error: this.insertError };
        }

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
          this.updatedRows.forEach((row) => {
            Object.assign(row, this.patch);

            if (table === "execution_queue" && this.patch.status) {
              transitions.push(this.patch.status);
            }
          });
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

const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const successEnvironment = createFakeSupabase("success");
const result = await processNextExecutionQueueItem({
  supabase: successEnvironment.supabase,
  organizationId: successEnvironment.organizationId,
});
const queueItem = successEnvironment.state.executionQueue[0];
const agentExecution = successEnvironment.state.agentExecutions[0];
const processedDecision = successEnvironment.state.decisions.find(
  (decision) =>
    decision.decision_type === "capability_executed"
);
const workItem = successEnvironment.state.workItems[0];
const timeline = await listWorkItemTimeline({
  supabase: successEnvironment.supabase,
  workItemId: successEnvironment.workItemId,
  organizationId: successEnvironment.organizationId,
});
const processedTimelineItem = timeline.items.find(
  (item) => item.title === "Capability Executed"
);

assert(result.success === true, "processing should succeed");
assert(
  successEnvironment.transitions.includes("in_progress"),
  "ready queue item should become in_progress"
);
assert(
  successEnvironment.transitions.includes("completed"),
  "ready queue item should become completed"
);
assert(queueItem.status === "completed", "queue item should complete");
assert(
  agentExecution?.status === "succeeded",
  "agent_execution should be created and succeeded"
);
assert(
  agentExecution?.input?.source === "execution_queue",
  "agent_execution should be tied to execution queue"
);
assert(
  processedDecision,
  "capability_executed decision should be created"
);
assert(
  processedDecision.decision.outcome.queue_item_id ===
    successEnvironment.queueItemId,
  "processed decision should store queue_item_id"
);
assert(
  processedDecision.decision.outcome.work_item_id ===
    successEnvironment.workItemId,
  "processed decision should store work_item_id"
);
assert(
  processedDecision.decision.outcome.assigned_agent_name ===
    "Operations Agent",
  "processed decision should store assigned agent name"
);
assert(
  processedDecision.decision.outcome.capability_id ===
    "summarize_review_decision",
  "processed decision should store capability result"
);
assert(
  workItem.status === "in_progress",
  "work item status should become active/in_progress"
);
assert(
  workItem.ownership_status === "active",
  "work item ownership should become active"
);
assert(
  processedTimelineItem?.message ===
    "Operations Agent executed summarize_review_decision.",
  "timeline should include processed event"
);

const failureEnvironment = createFakeSupabase("failure", {
  missingWorkItem: true,
});
let failureMessage = null;

try {
  await processNextExecutionQueueItem({
    supabase: failureEnvironment.supabase,
    organizationId: failureEnvironment.organizationId,
  });
} catch (error) {
  failureMessage =
    error instanceof Error ? error.message : String(error);
}

const failedQueueItem = failureEnvironment.state.executionQueue[0];

assert(failureMessage, "failed processing should return an error");
assert(
  failureEnvironment.transitions.includes("in_progress"),
  "failed processing should still claim ready item"
);
assert(
  failedQueueItem.status === "failed",
  "failed processing should mark queue item failed"
);
assert(
  failedQueueItem.failure_reason ===
    "Work item not found for execution queue item",
  "failed processing should store failure reason"
);

const serviceSource = fs.readFileSync(
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
const combinedSource = `${serviceSource}\n${routeSource}`;

assert(
  !combinedSource.includes("chat.completions"),
  "should not use chat completions"
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
      queue_orchestrator: {
        success_result: result.result,
        processed_count: result.processed_count,
        status_transitions: successEnvironment.transitions,
        queue_status: queueItem.status,
        agent_execution_status: agentExecution.status,
        decision_type: processedDecision.decision_type,
        failed_queue_status: failedQueueItem.status,
        failed_queue_reason: failedQueueItem.failure_reason,
        timeline_title: processedTimelineItem?.title ?? null,
        timeline_message: processedTimelineItem?.message ?? null,
        openai_called: false,
        autonomous_loop: false,
      },
    },
    null,
    2
  )
);
