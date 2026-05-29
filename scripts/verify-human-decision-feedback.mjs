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
  const organizationId = `org-phase-16-${label}`;
  const workItemId = `work-item-phase-16-${label}`;
  const reviewId = `review-phase-16-${label}`;
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
      },
    ],
    humanReviews: [
      {
        id: reviewId,
        organization_id: organizationId,
        work_item_id: workItemId,
        agent_execution_id: `execution-phase-16-${label}`,
        source_agent_id: "agent-operations",
        source_agent_name: "Operations Agent",
        review_type: "handoff",
        review_reason: "Approval required before execution continues.",
        status: "pending",
        priority: "high",
        requested_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        review_outcome: null,
        review_notes: null,
      },
    ],
    decisions: [],
    executionQueue: [],
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
      patch: null,
      insertRow: null,
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

async function runCase({ label, status, expected }) {
  const { updateHumanReviewStatus } = loadModule(
    "lib/application/human-reviews/update-human-review-status.ts"
  );
  const { normalizeAgentDecisionForVerification } = loadModule(
    "lib/application/work-items/list-work-item-timeline.ts"
  );
  const environment = createFakeSupabase(label);
  const updated = await updateHumanReviewStatus({
    supabase: environment.supabase,
    organizationId: environment.organizationId,
    reviewId: environment.reviewId,
    status,
    reviewedBy: "user-phase-16",
    reviewOutcome: `${status} outcome`,
    reviewNotes: `${status} notes`,
  });
  const workItem = environment.state.workItems[0];
  const feedbackDecision = environment.state.decisions.find(
    (decision) => decision.decision_type === "human_review_decision"
  );
  const ownershipDecision = environment.state.decisions.find(
    (decision) => decision.decision_type === "ownership_change"
  );
  const feedbackTimelineItem = normalizeAgentDecisionForVerification({
    id: feedbackDecision.id,
    agent_execution_id: feedbackDecision.agent_execution_id,
    agent_id: feedbackDecision.agent_id,
    decision_type: feedbackDecision.decision_type,
    decision: feedbackDecision.decision,
    rationale: feedbackDecision.rationale,
    confidence: feedbackDecision.confidence,
    metadata: feedbackDecision.metadata,
    created_at: feedbackDecision.created_at,
  });
  const ownershipTimelineItem = normalizeAgentDecisionForVerification({
    id: ownershipDecision.id,
    agent_execution_id: ownershipDecision.agent_execution_id ?? null,
    agent_id: ownershipDecision.agent_id,
    decision_type: ownershipDecision.decision_type,
    decision: ownershipDecision.decision,
    rationale: ownershipDecision.rationale,
    confidence: ownershipDecision.confidence,
    metadata: ownershipDecision.metadata,
    created_at: ownershipDecision.created_at,
  });

  assert(updated.status === status, `${label} should update status`);
  assert(updated.reviewed_at, `${label} should set reviewed_at`);
  assert(feedbackDecision, `${label} should log feedback decision`);
  assert(ownershipDecision, `${label} should log ownership decision`);
  assert(
    feedbackDecision.decision.outcome.review_id === environment.reviewId,
    `${label} feedback should link review id`
  );
  assert(
    feedbackDecision.decision.outcome.review_status === status,
    `${label} feedback should store review status`
  );
  assert(
    workItem.owner_type === expected.owner_type,
    `${label} should set expected owner type`
  );
  assert(
    workItem.ownership_status === expected.ownership_status,
    `${label} should set expected ownership status`
  );
  assert(
    feedbackTimelineItem.title === expected.feedback_title,
    `${label} feedback timeline title mismatch`
  );
  assert(
    ownershipTimelineItem.title === expected.ownership_title,
    `${label} ownership timeline title mismatch`
  );

  if (expected.owner_agent_name) {
    assert(
      workItem.owner_agent_name === expected.owner_agent_name,
      `${label} should assign expected owner agent`
    );
  }

  return {
    label,
    status: updated.status,
    owner_type: workItem.owner_type,
    owner_agent_name: workItem.owner_agent_name,
    ownership_status: workItem.ownership_status,
    feedback_decision_logged: Boolean(feedbackDecision),
    ownership_decision_logged: Boolean(ownershipDecision),
    timeline: [
      feedbackTimelineItem.title,
      ownershipTimelineItem.title,
    ],
  };
}

const results = [
  await runCase({
    label: "approve review",
    status: "approved",
    expected: {
      owner_type: "ai",
      owner_agent_name: "Operations Agent",
      ownership_status: "ready_to_resume",
      feedback_title: "Work returned to Operations Agent",
      ownership_title:
        "Work ready to resume with Operations Agent",
    },
  }),
  await runCase({
    label: "reject review",
    status: "rejected",
    expected: {
      owner_type: "human",
      ownership_status: "blocked",
      feedback_title: "Work blocked by human decision",
      ownership_title: "Work blocked by human decision",
    },
  }),
  await runCase({
    label: "complete review",
    status: "completed",
    expected: {
      owner_type: "human",
      ownership_status: "completed",
      feedback_title: "Human Review Completed",
      ownership_title: "Human review completed",
    },
  }),
];

async function runPatchApproveCase() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

  const { patchHumanReviewAction } = loadModule(
    "app/api/human-reviews/[id]/route.ts"
  );
  const { normalizeAgentDecisionForVerification } = loadModule(
    "lib/application/work-items/list-work-item-timeline.ts"
  );
  const environment = createFakeSupabase("patch-approve");
  const response = await patchHumanReviewAction({
    supabase: environment.supabase,
    organizationId: environment.organizationId,
    reviewId: environment.reviewId,
    userId: "user-phase-16",
    body: {
      status: "approved",
      review_outcome: "approved",
      review_notes: "Approved in Review Inbox",
    },
  });
  const payload = await response.json();
  const review = environment.state.humanReviews[0];
  const feedbackDecision = environment.state.decisions.find(
    (decision) => decision.decision_type === "human_review_decision"
  );
  assert(
    feedbackDecision,
    "PATCH approve should create human_review_decision"
  );
  const feedbackTimelineItem = normalizeAgentDecisionForVerification({
    id: feedbackDecision.id,
    agent_execution_id: feedbackDecision.agent_execution_id,
    agent_id: feedbackDecision.agent_id,
    decision_type: feedbackDecision.decision_type,
    decision: feedbackDecision.decision,
    rationale: feedbackDecision.rationale,
    confidence: feedbackDecision.confidence,
    metadata: feedbackDecision.metadata,
    created_at: feedbackDecision.created_at,
  });

  assert(response.status === 200, "PATCH approve should return 200");
  assert(payload.success === true, "PATCH approve should return success");
  assert(
    payload.review.status === "approved",
    "PATCH approve response should show approved status"
  );
  assert(
    review.status === "approved",
    "PATCH approve should update stored review status"
  );
  assert(
    review.review_outcome === "approved",
    "PATCH approve should update review outcome"
  );
  assert(
    review.review_notes === "Approved in Review Inbox",
    "PATCH approve should preserve review notes"
  );
  assert(review.reviewed_at, "PATCH approve should set reviewed_at");
  assert(
    review.reviewed_by === "user-phase-16",
    "PATCH approve should set reviewed_by"
  );
  assert(
    feedbackTimelineItem.title === "Work returned to Operations Agent",
    "PATCH approve feedback should be visible in timeline"
  );

  return {
    status: payload.review.status,
    review_outcome: review.review_outcome,
    reviewed_at_set: Boolean(review.reviewed_at),
    reviewed_by: review.reviewed_by,
    human_review_decision_created: Boolean(feedbackDecision),
    timeline_title: feedbackTimelineItem.title,
  };
}

const patchApprove = await runPatchApproveCase();

console.log(
  JSON.stringify(
    {
      feedback_cases: results,
      patch_approve: patchApprove,
    },
    null,
    2
  )
);
