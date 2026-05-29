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
  const organizationId = `org-phase-17-${label}`;
  const workItemId = `work-item-phase-17-${label}`;
  const reviewId = `review-phase-17-${label}`;
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
        agent_execution_id: `execution-phase-17-${label}`,
        agent_decision_id: null,
        requested_by: "agent-operations",
        reviewer_user_id: null,
        source_agent_id: "agent-operations",
        source_agent_name: "Operations Agent",
        review_type: "handoff",
        review_reason: "Approval required before execution continues.",
        review_title: "Contract Approval Required",
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

  function matches(row, filters, inFilters = {}) {
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

async function runCase({ label, status, expectedOwnershipStatus }) {
  const { updateHumanReviewStatus } = loadModule(
    "lib/application/human-reviews/update-human-review-status.ts"
  );
  const { listWorkItemTimeline } = loadModule(
    "lib/application/work-items/list-work-item-timeline.ts"
  );
  const environment = createFakeSupabase(label);

  const updated = await updateHumanReviewStatus({
    supabase: environment.supabase,
    organizationId: environment.organizationId,
    reviewId: environment.reviewId,
    status,
    reviewedBy: "user-phase-17",
    reviewOutcome: `${status} outcome`,
    reviewNotes: `${status} notes`,
  });
  const workItem = environment.state.workItems[0];
  const resumeDecision = environment.state.decisions.find(
    (decision) => decision.decision_type === "execution_resume_ready"
  );
  const timeline = await listWorkItemTimeline({
    supabase: environment.supabase,
    workItemId: environment.workItemId,
    organizationId: environment.organizationId,
  });
  const resumeTimelineItem = timeline.items.find(
    (item) =>
      item.metadata.decision_type === "execution_resume_ready"
  );

  assert(updated.status === status, `${label} should update status`);
  assert(
    workItem.ownership_status === expectedOwnershipStatus,
    `${label} should set expected ownership status`
  );

  if (status === "approved") {
    assert(
      workItem.owner_type === "ai",
      "approved review should return ownership to AI"
    );
    assert(
      workItem.owner_agent_name === "Operations Agent",
      "approved review should return ownership to source agent"
    );
    assert(
      workItem.last_owner_change_reason ===
        "approved human review; ready to resume",
      "approved review should record resume-ready owner change reason"
    );
    assert(
      resumeDecision,
      "approved review should create execution_resume_ready"
    );
    assert(
      resumeDecision.decision.outcome.review_id ===
        environment.reviewId,
      "resume decision should preserve review_id"
    );
    assert(
      resumeDecision.decision.outcome.work_item_id ===
        environment.workItemId,
      "resume decision should preserve work_item_id"
    );
    assert(
      resumeDecision.decision.outcome.source_review_status ===
        "approved",
      "resume decision should preserve source review status"
    );
    assert(
      resumeDecision.decision.outcome.approved_by ===
        "user-phase-17",
      "resume decision should preserve approver"
    );
    assert(
      resumeDecision.decision.outcome.resume_agent_id ===
        "agent-operations",
      "resume decision should link resume agent id"
    );
    assert(
      resumeDecision.decision.outcome.resume_agent_name ===
        "Operations Agent",
      "resume decision should link resume agent name"
    );
    assert(
      resumeDecision.decision.outcome.recommended_next_action ===
        "Resume operations workflow.",
      "resume decision should preserve recommended action"
    );
    assert(
      resumeTimelineItem?.title === "Execution Resume Ready",
      "timeline should include resume-ready title"
    );
    assert(
      resumeTimelineItem?.message ===
        "Operations Agent can continue after human approval.",
      "timeline should include resume-ready message"
    );
  } else {
    assert(
      !resumeDecision,
      `${label} should not create execution_resume_ready`
    );
    assert(
      !resumeTimelineItem,
      `${label} should not show resume-ready timeline item`
    );
  }

  return {
    label,
    status: updated.status,
    ownership_status: workItem.ownership_status,
    owner_type: workItem.owner_type,
    owner_agent_name: workItem.owner_agent_name,
    execution_resume_ready_created: Boolean(resumeDecision),
    timeline_has_resume_ready: Boolean(resumeTimelineItem),
    review_id:
      resumeDecision?.decision?.outcome?.review_id ?? null,
    work_item_id:
      resumeDecision?.decision?.outcome?.work_item_id ?? null,
  };
}

const results = [
  await runCase({
    label: "approved review",
    status: "approved",
    expectedOwnershipStatus: "ready_to_resume",
  }),
  await runCase({
    label: "rejected review",
    status: "rejected",
    expectedOwnershipStatus: "blocked",
  }),
  await runCase({
    label: "completed review",
    status: "completed",
    expectedOwnershipStatus: "completed",
  }),
];

console.log(
  JSON.stringify(
    {
      execution_resume_cases: results,
    },
    null,
    2
  )
);
