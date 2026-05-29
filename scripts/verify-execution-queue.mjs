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
  const organizationId = `org-phase-18-${label}`;
  const workItemId = `work-item-phase-18-${label}`;
  const reviewId = `review-phase-18-${label}`;
  const now = new Date().toISOString();
  const state = {
    workItems: [
      {
        id: workItemId,
        organization_id: organizationId,
        owner_type: "human",
        owner_agent_id: null,
        owner_agent_name: null,
        owner_agent_role: null,
        owner_user_id: null,
        ownership_status: "human_review",
        last_owner_change_at: null,
        last_owner_change_reason: "Approval required",
        updated_at: now,
        created_at: now,
      },
    ],
    humanReviews: [
      {
        id: reviewId,
        organization_id: organizationId,
        work_item_id: workItemId,
        agent_execution_id: `execution-phase-18-${label}`,
        agent_decision_id: null,
        requested_by: "agent-operations",
        reviewer_user_id: null,
        source_agent_id: "agent-operations",
        source_agent_name: "Operations Agent",
        review_type: "approval",
        review_reason: "Approval required before execution continues.",
        review_title: "Approval Required",
        review_summary: "Human approval is required.",
        review_context: null,
        recommended_action: "Resume operations workflow.",
        status: "pending",
        priority: "high",
        decision: null,
        requested_at: now,
        reviewed_at: null,
        reviewed_by: null,
        review_outcome: null,
        review_notes: null,
        created_at: now,
        updated_at: now,
      },
    ],
    decisions: [],
    executionQueue: [],
    aiEvents: [],
    agentExecutions: [],
    memoryEntries: [],
  };

  function tableRows(table) {
    if (table === "work_items") {
      return state.workItems;
    }

    if (table === "human_reviews") {
      return state.humanReviews;
    }

    if (table === "agent_decisions") {
      return state.decisions;
    }

    if (table === "execution_queue") {
      return state.executionQueue;
    }

    if (table === "ai_events") {
      return state.aiEvents;
    }

    if (table === "agent_executions") {
      return state.agentExecutions;
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

  function createBuilder(table) {
    const builder = {
      filters: {},
      inFilters: {},
      lessThanFilters: {},
      patch: null,
      insertRow: null,
      limitCount: null,
      orderKey: null,
      orderAscending: true,
      select() {
        if (this.patch) {
          tableRows(table)
            .filter((row) =>
              matches(row, this.filters, this.inFilters)
            )
            .forEach((row) => Object.assign(row, this.patch));
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
        this.orderKey = key;
        this.orderAscending = options.ascending !== false;
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

        const row = tableRows(table).find((candidate) =>
          matches(candidate, this.filters, this.inFilters)
        );

        return row
          ? { data: { ...row }, error: null }
          : { data: null, error: new Error("Not found") };
      },
      async maybeSingle() {
        const row = tableRows(table).find((candidate) =>
          matches(candidate, this.filters, this.inFilters)
        );

        return { data: row ? { ...row } : null, error: null };
      },
      async execute() {
        let rows = tableRows(table)
          .filter((row) =>
            matches(row, this.filters, this.inFilters)
          )
          .filter((row) =>
            Object.entries(this.lessThanFilters).every(
              ([key, value]) => row[key] < value
            )
          );

        if (this.orderKey) {
          rows = [...rows].sort((left, right) => {
            const result = String(left[this.orderKey]).localeCompare(
              String(right[this.orderKey])
            );

            return this.orderAscending ? result : -result;
          });
        }

        if (this.limitCount !== null) {
          rows = rows.slice(0, this.limitCount);
        }

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
    reviewId,
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

const { updateHumanReviewStatus } = loadModule(
  "lib/application/human-reviews/update-human-review-status.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const environment = createFakeSupabase("approved-review");

await updateHumanReviewStatus({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  reviewId: environment.reviewId,
  status: "approved",
  reviewedBy: "user-phase-18",
  reviewOutcome: "Approved",
  reviewNotes: "Approved; continue with operations.",
});

await updateHumanReviewStatus({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  reviewId: environment.reviewId,
  status: "approved",
  reviewedBy: "user-phase-18",
  reviewOutcome: "Approved again",
  reviewNotes: "Duplicate approval should not duplicate queue.",
});

const workItem = environment.state.workItems[0];
const resumeDecisions = environment.state.decisions.filter(
  (decision) => decision.decision_type === "execution_resume_ready"
);
const queueItems = environment.state.executionQueue;
const queueItem = queueItems[0];
const timeline = await listWorkItemTimeline({
  supabase: environment.supabase,
  workItemId: environment.workItemId,
  organizationId: environment.organizationId,
});
const queuedTimelineItem = timeline.items.find(
  (item) => item.title === "Execution Queued"
);

assert(
  resumeDecisions.length >= 1,
  "approved review should create execution_resume_ready"
);
assert(
  queueItems.length === 1,
  "duplicate queue item should not be created"
);
assert(
  workItem.ownership_status === "ready_to_resume",
  "ownership should remain ready_to_resume"
);
assert(queueItem.status === "ready", "queue status should be ready");
assert(
  queueItem.review_id === environment.reviewId,
  "queue item should preserve review_id"
);
assert(
  queueItem.work_item_id === environment.workItemId,
  "queue item should preserve work_item_id"
);
assert(
  queueItem.assigned_agent_name === "Operations Agent",
  "queue item should preserve assigned agent"
);
assert(
  queueItem.queue_reason === "Approved; continue with operations.",
  "queue item should preserve queue reason"
);
assert(
  queueItem.next_action === "Resume operations workflow.",
  "queue item should preserve next action"
);
assert(
  queuedTimelineItem?.message ===
    "Operations Agent is ready to continue work.",
  "timeline should include Execution Queued"
);
assert(
  queuedTimelineItem?.metadata.review_id === environment.reviewId,
  "timeline should preserve review id"
);

console.log(
  JSON.stringify(
    {
      execution_queue: {
        execution_resume_ready_created: resumeDecisions.length >= 1,
        duplicate_queue_item_created: queueItems.length > 1,
        ownership_status: workItem.ownership_status,
        queue_status: queueItem.status,
        queue_review_id: queueItem.review_id,
        queue_work_item_id: queueItem.work_item_id,
        timeline_title: queuedTimelineItem?.title ?? null,
        timeline_message: queuedTimelineItem?.message ?? null,
      },
    },
    null,
    2
  )
);
