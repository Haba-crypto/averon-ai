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
  const organizationId = `org-phase-23-${label}`;
  const leadId = `lead-phase-23-${label}`;
  const parentWorkItemId = `work-item-phase-23-${label}`;
  const queueItemId = `queue-phase-23-${label}`;
  const agentId = `agent-phase-23-${label}`;
  const reviewId = `review-phase-23-${label}`;
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
        id: parentWorkItemId,
        organization_id: organizationId,
        title: "Lead acquisition for Ada Buyer",
        type: "lead_acquisition",
        status: "queued",
        source_type: "lead",
        source_id: leadId,
        lead_id: leadId,
        parent_work_item_id: null,
        owner_type: "ai",
        owner_agent_id: agentId,
        owner_agent_name: "Operations Agent",
        owner_agent_role: "Revenue Operations",
        ownership_status: "ready_to_resume",
        last_owner_change_reason:
          "approved human review; ready to resume",
        metadata: {},
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
        work_item_id: parentWorkItemId,
        review_id: reviewId,
        source_decision_id: `resume-decision-phase-23-${label}`,
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
        work_item_id: parentWorkItemId,
        agent_execution_id: `execution-before-phase-23-${label}`,
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
        reviewed_by: "user-phase-23",
        review_outcome: "Approved",
        review_notes: "Approved; continue.",
        created_at: now,
        updated_at: now,
      },
    ],
    memoryEntries: [],
    aiEvents: [
      {
        id: `event-phase-23-${label}`,
        organization_id: organizationId,
        lead_id: leadId,
        work_item_id: parentWorkItemId,
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
    parentWorkItemId,
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
const { generateFollowUpWork } = loadModule(
  "lib/application/agents/work-generation.ts"
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
const parentQueueItem = environment.state.executionQueue.find(
  (item) => item.id === environment.queueItemId
);
const followUpWorkItem = environment.state.workItems.find(
  (item) => item.type === "follow_up"
);
const followUpQueueItem = environment.state.executionQueue.find(
  (item) => item.work_item_id === followUpWorkItem?.id
);
const agentExecution = environment.state.agentExecutions[0];
const followUpDecision = environment.state.decisions.find(
  (decision) => decision.decision_type === "follow_up_work_generated"
);
const parentTimeline = await listWorkItemTimeline({
  supabase: environment.supabase,
  workItemId: environment.parentWorkItemId,
  organizationId: environment.organizationId,
});
const parentTimelineItem = parentTimeline.items.find(
  (item) => item.title === "Follow-up Work Generated"
);
const followUpTimeline = await listWorkItemTimeline({
  supabase: environment.supabase,
  workItemId: followUpWorkItem.id,
  organizationId: environment.organizationId,
});
const followUpQueueTimelineItem = followUpTimeline.items.find(
  (item) => item.title === "Execution Queued"
);

assert(result.success === true, "queue processing should succeed");
assert(
  parentQueueItem.status === "completed",
  "original queue item should complete"
);
assert(
  followUpWorkItem,
  "Operations summarize_review_decision should create follow-up work"
);
assert(
  followUpWorkItem.title ===
    "Continue execution after human approval",
  "follow-up work should use the approval continuation title"
);
assert(
  followUpWorkItem.parent_work_item_id ===
    environment.parentWorkItemId,
  "follow-up work item should have parent linkage"
);
assert(
  followUpWorkItem.metadata.parent_work_item_id ===
    environment.parentWorkItemId,
  "follow-up work metadata should preserve parent linkage"
);
assert(
  followUpWorkItem.owner_agent_name === "Operations Agent",
  "follow-up work should be owned by Operations Agent"
);
assert(
  followUpQueueItem?.status === "ready",
  "queue item should be ready for generated follow-up work"
);
assert(
  followUpQueueItem.queue_reason ===
    "follow-up work generated by capability",
  "queue item should record work generation reason"
);
assert(
  followUpQueueItem.next_action === "Resume operations workflow.",
  "queue item should preserve recommended next action"
);
assert(
  followUpDecision,
  "follow_up_work_generated decision should be created"
);
assert(
  followUpDecision.decision.outcome.parent_work_item_id ===
    environment.parentWorkItemId,
  "decision should store parent work item id"
);
assert(
  followUpDecision.decision.outcome.created_work_item_ids.includes(
    followUpWorkItem.id
  ),
  "decision should store created work item ids"
);
assert(
  followUpDecision.decision.outcome.created_queue_item_ids.includes(
    followUpQueueItem.id
  ),
  "decision should store created queue item ids"
);
assert(
  parentTimelineItem?.message ===
    "Operations Agent created follow-up work after human approval.",
  "parent timeline should include Follow-up Work Generated"
);
assert(
  followUpQueueTimelineItem?.metadata?.source_decision_id ===
    followUpDecision.id,
  "follow-up work timeline should show source linkage through queue"
);
assert(
  agentExecution.output.work_generation_result.created_work_items[0] ===
    followUpWorkItem.id,
  "agent_execution.output should include work generation result"
);
assert(
  agentExecution.output.work_generation_error === null,
  "agent_execution.output should not include work generation error"
);

const context = await buildAgentRuntimeContext({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
  workItemId: environment.parentWorkItemId,
  assignedAgentName: "Operations Agent",
});
const selectedCapability = selectAgentCapability(context);
const capabilityResult = executeAgentCapability({
  organizationId: environment.organizationId,
  agentExecutionId: agentExecution.id,
  runtimeContext: context,
  capability: selectedCapability,
});
const repeatResult = await generateFollowUpWork({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  parentWorkItemId: environment.parentWorkItemId,
  agentExecutionId: agentExecution.id,
  capabilityId: capabilityResult.capability_id,
  capabilityResult,
  runtimeContext: context,
});

assert(
  environment.state.workItems.filter((item) => item.type === "follow_up")
    .length === 1,
  "duplicate follow-up work should not be created on repeat"
);
assert(
  environment.state.executionQueue.filter(
    (item) => item.work_item_id === followUpWorkItem.id
  ).length === 1,
  "duplicate queue item should not be created on repeat"
);
assert(
  repeatResult.created_work_items.length === 0 &&
    repeatResult.skipped_duplicates.some(
      (item) => item.type === "work_item"
    ),
  "repeat work generation should report skipped duplicate work"
);
assert(
  followUpQueueItem.status === "ready" &&
    !environment.transitions.some(
      (transition) =>
        transition.id === followUpQueueItem.id &&
        transition.status === "in_progress"
    ),
  "generated queue item should not be processed autonomously"
);

const sourcePaths = [
  "lib/application/agents/work-generation.ts",
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
      work_generation: {
        created_work_item_id: followUpWorkItem.id,
        parent_work_item_id: followUpWorkItem.parent_work_item_id,
        created_queue_item_id: followUpQueueItem.id,
        queue_status: followUpQueueItem.status,
        duplicate_work_created:
          environment.state.workItems.filter(
            (item) => item.type === "follow_up"
          ).length > 1,
        duplicate_queue_created:
          environment.state.executionQueue.filter(
            (item) => item.work_item_id === followUpWorkItem.id
          ).length > 1,
        decision_id: followUpDecision.id,
        timeline_title: parentTimelineItem?.title ?? null,
        timeline_message: parentTimelineItem?.message ?? null,
        follow_up_timeline_source_decision:
          followUpQueueTimelineItem?.metadata?.source_decision_id ?? null,
        repeat_work_generation: repeatResult,
        generated_queue_autonomously_processed: false,
        openai_called: false,
      },
    },
    null,
    2
  )
);
