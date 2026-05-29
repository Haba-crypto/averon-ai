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
  const organizationId = `org-phase-28-${label}`;
  const leadId = `lead-phase-28-${label}`;
  const agentId = `agent-phase-28-${label}`;
  const oldCreatedAt = "2026-05-29T10:00:00.000Z";
  const newCreatedAt = "2026-05-29T10:05:00.000Z";
  const lowWorkItemId = `work-item-phase-28-${label}-low`;
  const highWorkItemId = `work-item-phase-28-${label}-high`;
  const blockedWorkItemId = `work-item-phase-28-${label}-blocked`;
  const lowQueueItemId = `queue-phase-28-${label}-low`;
  const highQueueItemId = `queue-phase-28-${label}-high`;
  const blockedQueueItemId = `queue-phase-28-${label}-blocked`;
  const approvedReviewId = `review-phase-28-${label}-approved`;
  const rejectedReviewId = `review-phase-28-${label}-rejected`;
  const state = {
    leads: [
      {
        id: leadId,
        organization_id: organizationId,
        name: "Ada Enterprise",
        email: "ada@example.com",
        status: "qualified",
        intent_score: 92,
        urgency: "high",
      },
    ],
    workItems: [
      buildWorkItem({
        id: lowWorkItemId,
        organizationId,
        agentId,
        leadId: null,
        title: "Update internal note",
        description: "Low-risk internal housekeeping.",
        priority: "low",
        ownershipStatus: "assigned",
        createdAt: oldCreatedAt,
      }),
      buildWorkItem({
        id: highWorkItemId,
        organizationId,
        agentId,
        leadId,
        title: "Prepare enterprise proposal approval",
        description:
          "Proposal, contract, budget, procurement, and approval are ready.",
        priority: "urgent",
        ownershipStatus: "ready_to_resume",
        createdAt: newCreatedAt,
      }),
      buildWorkItem({
        id: blockedWorkItemId,
        organizationId,
        agentId,
        leadId,
        title: "Legal review rejected",
        description: "Security and compliance concern rejected by review.",
        priority: "high",
        ownershipStatus: "blocked",
        createdAt: newCreatedAt,
      }),
    ],
    agents: [
      {
        id: agentId,
        organization_id: organizationId,
        key: "sdr",
        name: "SDR Agent",
        description: "Phase 28 verification agent.",
        config: {
          role: "Sales Development",
        },
      },
    ],
    executionQueue: [
      buildQueueItem({
        id: lowQueueItemId,
        organizationId,
        workItemId: lowWorkItemId,
        agentId,
        reviewId: null,
        priority: "low",
        queueReason: "Internal note can wait.",
        nextAction: "Record an internal note.",
        createdAt: oldCreatedAt,
      }),
      buildQueueItem({
        id: highQueueItemId,
        organizationId,
        workItemId: highWorkItemId,
        agentId,
        reviewId: approvedReviewId,
        priority: "urgent",
        queueReason: "Approved human review; ready to resume proposal work.",
        nextAction: "Resume enterprise proposal approval.",
        createdAt: newCreatedAt,
      }),
      buildQueueItem({
        id: blockedQueueItemId,
        organizationId,
        workItemId: blockedWorkItemId,
        agentId,
        reviewId: rejectedReviewId,
        priority: "urgent",
        queueReason: "Rejected legal review.",
        nextAction: "Do not continue.",
        createdAt: newCreatedAt,
      }),
    ],
    humanReviews: [
      {
        id: approvedReviewId,
        organization_id: organizationId,
        work_item_id: highWorkItemId,
        agent_execution_id: null,
        agent_decision_id: null,
        requested_by: "system",
        reviewer_user_id: "reviewer",
        source_agent_id: agentId,
        source_agent_name: "SDR Agent",
        status: "approved",
        review_type: "approval",
        review_reason: "Proposal approval",
        review_title: "Approve enterprise proposal",
        review_summary: "Approved proposal continuation.",
        review_context: {},
        recommended_action: "Resume enterprise proposal approval.",
        priority: "urgent",
        decision: "approve",
        requested_at: oldCreatedAt,
        reviewed_at: newCreatedAt,
        reviewed_by: "reviewer",
        review_outcome: "Approved.",
        review_notes: "Continue.",
        created_at: oldCreatedAt,
        updated_at: newCreatedAt,
      },
      {
        id: rejectedReviewId,
        organization_id: organizationId,
        work_item_id: blockedWorkItemId,
        agent_execution_id: null,
        agent_decision_id: null,
        requested_by: "system",
        reviewer_user_id: "reviewer",
        source_agent_id: agentId,
        source_agent_name: "SDR Agent",
        status: "rejected",
        review_type: "legal",
        review_reason: "Legal risk",
        review_title: "Reject compliance-sensitive work",
        review_summary: "Rejected because of compliance risk.",
        review_context: {},
        recommended_action: "Do not continue.",
        priority: "urgent",
        decision: "reject",
        requested_at: oldCreatedAt,
        reviewed_at: newCreatedAt,
        reviewed_by: "reviewer",
        review_outcome: "Rejected.",
        review_notes: "Blocked.",
        created_at: oldCreatedAt,
        updated_at: newCreatedAt,
      },
    ],
    memoryEntries: [
      {
        id: `memory-phase-28-${label}`,
        organization_id: organizationId,
        agent_id: agentId,
        lead_id: leadId,
        work_item_id: highWorkItemId,
        source_agent_execution_id: null,
        scope: "work_item",
        key: "priority_context",
        content: "Urgent enterprise procurement risk signal.",
        metadata: {},
        expires_at: null,
        created_at: newCreatedAt,
        updated_at: newCreatedAt,
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
          this.updatedRows.forEach((row) =>
            Object.assign(row, this.patch)
          );
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
    leadId,
    agentId,
    lowWorkItemId,
    highWorkItemId,
    blockedWorkItemId,
    lowQueueItemId,
    highQueueItemId,
    blockedQueueItemId,
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

function buildWorkItem({
  id,
  organizationId,
  agentId,
  leadId,
  title,
  description,
  priority,
  ownershipStatus,
  createdAt,
}) {
  return {
    id,
    organization_id: organizationId,
    title,
    description,
    type: "follow_up",
    status: "queued",
    priority,
    source_type: leadId ? "lead" : "internal",
    source_id: leadId,
    lead_id: leadId,
    parent_work_item_id: null,
    owner_type: "ai",
    owner_agent_id: agentId,
    owner_agent_name: "SDR Agent",
    owner_agent_role: "Sales Development",
    ownership_status: ownershipStatus,
    last_owner_change_reason:
      ownershipStatus === "ready_to_resume"
        ? "approved human review; ready to resume"
        : "phase 28 verification",
    metadata: {
      source: "phase_28_verification",
      requires_human_review: false,
      openai_called: false,
    },
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function buildQueueItem({
  id,
  organizationId,
  workItemId,
  agentId,
  reviewId,
  priority,
  queueReason,
  nextAction,
  createdAt,
}) {
  return {
    id,
    organization_id: organizationId,
    work_item_id: workItemId,
    review_id: reviewId,
    source_decision_id: null,
    assigned_agent_id: agentId,
    assigned_agent_name: "SDR Agent",
    status: "ready",
    priority,
    queue_reason: queueReason,
    failure_reason: null,
    next_action: nextAction,
    metadata: {
      source: "phase_28_verification",
      continuation_mode: "manual",
      continuation_allowed: true,
      openai_called: false,
    },
    started_at: null,
    completed_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const {
  calculateWorkPriority,
  evaluateAndPersistWorkPriority,
} = loadModule(
  "lib/application/execution-queue/priority-scheduling.ts"
);
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const directHighPriority = calculateWorkPriority({
  organizationId: "org-direct",
  workItem: {
    id: "work-direct-high",
    title: "Enterprise proposal approval",
    description: "Proposal, contract, budget, procurement, approval.",
    priority: "urgent",
    ownership_status: "ready_to_resume",
    metadata: {},
  },
  queueItem: {
    id: "queue-direct-high",
    status: "ready",
    priority: "urgent",
    queue_reason: "Approved human review; ready to resume.",
  },
  lead: {
    intent_score: 94,
    urgency: "high",
  },
  reviewContext: {
    status: "approved",
  },
});

assert(
  directHighPriority.priority_score >= 70 &&
    directHighPriority.scheduling_bucket === "now",
  "approved ready queue item should get high priority / now"
);

const directBlockedPriority = calculateWorkPriority({
  organizationId: "org-direct",
  workItem: {
    id: "work-direct-blocked",
    title: "Legal compliance work",
    ownership_status: "blocked",
    metadata: {},
  },
  queueItem: {
    id: "queue-direct-blocked",
    status: "ready",
    priority: "urgent",
  },
  reviewContext: {
    status: "rejected",
  },
});

assert(
  directBlockedPriority.scheduling_bucket === "blocked" &&
    directBlockedPriority.priority_score === 0,
  "rejected or blocked work should get blocked"
);

const directLowPriority = calculateWorkPriority({
  organizationId: "org-direct",
  workItem: {
    id: "work-direct-low",
    title: "Internal note",
    description: "Routine internal follow up.",
    priority: "low",
    ownership_status: "assigned",
    metadata: {},
  },
  queueItem: {
    id: "queue-direct-low",
    status: "ready",
    priority: "low",
  },
});

assert(
  ["later", "next"].includes(directLowPriority.scheduling_bucket),
  "low-risk low-urgency work should get later or next"
);

const persistenceEnvironment = createFakeSupabase("persist");
const highQueueItem = persistenceEnvironment.state.executionQueue.find(
  (item) => item.id === persistenceEnvironment.highQueueItemId
);
const priorityPersistence = await evaluateAndPersistWorkPriority({
  supabase: persistenceEnvironment.supabase,
  organizationId: persistenceEnvironment.organizationId,
  queueItem: highQueueItem,
});
const persistedHighQueueItem =
  persistenceEnvironment.state.executionQueue.find(
    (item) => item.id === persistenceEnvironment.highQueueItemId
  );
const priorityDecision = persistenceEnvironment.state.decisions.find(
  (decision) => decision.decision_type === "priority_evaluated"
);

assert(
  persistedHighQueueItem.metadata.priority_score ===
    priorityPersistence.priority.priority_score,
  "priority metadata should be stored on queue item"
);
assert(
  persistedHighQueueItem.metadata.scheduling_bucket === "now",
  "queue item metadata should store scheduling bucket"
);
assert(
  priorityDecision?.decision.outcome.queue_item_id ===
    persistenceEnvironment.highQueueItemId,
  "priority_evaluated decision should be created"
);

const selectionEnvironment = createFakeSupabase("selection");
const processResult = await processNextExecutionQueueItem({
  supabase: selectionEnvironment.supabase,
  organizationId: selectionEnvironment.organizationId,
});
const processedHighQueueItem =
  selectionEnvironment.state.executionQueue.find(
    (item) => item.id === selectionEnvironment.highQueueItemId
  );
const untouchedLowQueueItem =
  selectionEnvironment.state.executionQueue.find(
    (item) => item.id === selectionEnvironment.lowQueueItemId
  );
const blockedQueueItem = selectionEnvironment.state.executionQueue.find(
  (item) => item.id === selectionEnvironment.blockedQueueItemId
);

assert(processResult.processed_count === 1, "should process one item only");
assert(
  processedHighQueueItem.status === "completed",
  "queue selection should choose higher priority item first"
);
assert(
  untouchedLowQueueItem.status === "ready",
  "lower priority item should remain ready"
);
assert(
  blockedQueueItem.status === "ready" &&
    blockedQueueItem.metadata.scheduling_bucket === "blocked",
  "blocked item should not be processed"
);

const timeline = await listWorkItemTimeline({
  supabase: selectionEnvironment.supabase,
  workItemId: selectionEnvironment.highWorkItemId,
  organizationId: selectionEnvironment.organizationId,
});
const priorityTimelineItem = timeline.items.find(
  (item) => item.title === "Priority Evaluated"
);

assert(
  priorityTimelineItem?.message ===
    `Priority evaluated: now with score ${processedHighQueueItem.metadata.priority_score}.`,
  "timeline should include Priority Evaluated"
);

const sourcePaths = [
  "lib/application/execution-queue/priority-scheduling.ts",
  "lib/application/execution-queue/create-execution-queue-item.ts",
  "lib/application/execution-queue/process-next-execution-queue-item.ts",
  "lib/application/execution-queue/controlled-continuation.ts",
  "lib/application/work-items/list-work-item-timeline.ts",
  "app/api/execution-queue/process-next/route.ts",
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
      priority_scheduling: {
        approved_ready_bucket: directHighPriority.scheduling_bucket,
        approved_ready_score: directHighPriority.priority_score,
        blocked_bucket: directBlockedPriority.scheduling_bucket,
        low_priority_bucket: directLowPriority.scheduling_bucket,
        persisted_queue_metadata: {
          priority_score: persistedHighQueueItem.metadata.priority_score,
          scheduling_bucket:
            persistedHighQueueItem.metadata.scheduling_bucket,
        },
        decision_type: priorityDecision.decision_type,
        selected_queue_item_id: processedHighQueueItem.id,
        processed_count: processResult.processed_count,
        blocked_queue_status: blockedQueueItem.status,
        timeline_title: priorityTimelineItem?.title ?? null,
        timeline_message: priorityTimelineItem?.message ?? null,
        openai_called: false,
        autonomous_loop: false,
      },
    },
    null,
    2
  )
);
