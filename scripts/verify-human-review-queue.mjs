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

function createFakeSupabase() {
  const organizationId = "org-phase-13";
  const workItemId = "work-item-phase-13";
  const state = {
    workItems: [
      {
        id: workItemId,
        organization_id: organizationId,
        owner_type: "ai",
        owner_agent_id: "agent-operations",
        owner_agent_name: "Operations Agent",
        owner_agent_role: "Revenue Operations",
        owner_user_id: null,
        ownership_status: "assigned",
        last_owner_change_at: null,
        last_owner_change_reason: null,
      },
    ],
    humanReviews: [],
    decisions: [],
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

    return [];
  }

  function matches(row, filters, inFilters) {
    const eqMatches = Object.entries(filters).every(
      ([key, value]) => row[key] === value
    );
    const inMatches = Object.entries(inFilters).every(
      ([key, values]) => values.includes(row[key])
    );

    return eqMatches && inMatches;
  }

  function createBuilder(table) {
    const builder = {
      filters: {},
      inFilters: {},
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

        if (table === "human_reviews") {
          const duplicate = state.humanReviews.find(
            (review) =>
              review.organization_id === record.organization_id &&
              review.work_item_id === record.work_item_id &&
              review.review_type === record.review_type &&
              ["pending", "in_review"].includes(review.status)
          );

          if (duplicate) {
            this.insertError = new Error("duplicate open review");
            return this;
          }
        }

        tableRows(table).push(record);
        this.insertRow = record;
        return this;
      },
      async maybeSingle() {
        if (this.insertError) {
          return { data: null, error: this.insertError };
        }

        const rows = this.getRows();
        return { data: rows[0] ?? null, error: null };
      },
      async single() {
        if (this.insertError) {
          return { data: null, error: this.insertError };
        }

        if (this.insertRow) {
          return { data: { ...this.insertRow }, error: null };
        }

        const rows = this.getRows();
        return rows[0]
          ? { data: { ...rows[0] }, error: null }
          : { data: null, error: new Error("Not found") };
      },
      getRows() {
        let rows = tableRows(table)
          .filter((row) =>
            matches(row, this.filters, this.inFilters)
          )
          .map((row) => ({ ...row }));

        if (this.orderKey) {
          rows = rows.sort((left, right) => {
            const delta = String(left[this.orderKey]).localeCompare(
              String(right[this.orderKey])
            );

            return this.orderAscending ? delta : -delta;
          });
        }

        if (this.limitCount !== null) {
          rows = rows.slice(0, this.limitCount);
        }

        return rows;
      },
    };

    return builder;
  }

  return {
    organizationId,
    workItemId,
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

const { createHumanReview } = loadModule(
  "lib/application/human-reviews/create-human-review.ts"
);
const { updateHumanReviewStatus } = loadModule(
  "lib/application/human-reviews/update-human-review-status.ts"
);
const {
  normalizeAgentDecisionForVerification,
  normalizeHumanReviewForVerification,
} = loadModule("lib/application/work-items/list-work-item-timeline.ts");

const { supabase, organizationId, workItemId, state } =
  createFakeSupabase();

const sourceAgent = {
  id: "agent-operations",
  name: "Operations Agent",
  role: "Revenue Operations",
};

const created = await createHumanReview({
  supabase,
  organizationId,
  workItemId,
  sourceAgent,
  reviewType: "handoff",
  reviewReason:
    "Approval, exception handling, or legal/contract review is required before execution continues.",
  priority: "high",
  agentExecutionId: "execution-phase-13",
});

const duplicate = await createHumanReview({
  supabase,
  organizationId,
  workItemId,
  sourceAgent,
  reviewType: "handoff",
  reviewReason:
    "Approval, exception handling, or legal/contract review is required before execution continues.",
  priority: "high",
  agentExecutionId: "execution-phase-13",
});

const review = state.humanReviews[0];
const workItem = state.workItems[0];
const reviewDecision = state.decisions.find(
  (decision) => decision.decision_type === "human_review_requested"
);
const ownershipDecision = state.decisions.find(
  (decision) => decision.decision_type === "ownership_change"
);

assert(created.created === true, "First call should create review");
assert(duplicate.created === false, "Second call should reuse open review");
assert(
  state.humanReviews.length === 1,
  "Duplicate open review should not be created"
);
assert(review.work_item_id === workItemId, "Review should link work item");
assert(
  review.source_agent_name === "Operations Agent",
  "Review should name source agent"
);
assert(review.status === "pending", "Review should start pending");
assert(review.priority === "high", "Review should preserve priority");
assert(workItem.owner_type === "human", "Ownership should become human");
assert(
  workItem.ownership_status === "human_review",
  "Ownership status should become human_review"
);
assert(
  reviewDecision?.decision?.outcome?.review_id === review.id,
  "Decision should link to review id"
);
assert(
  reviewDecision?.decision?.outcome?.review_type === "handoff",
  "Decision should preserve review type"
);
assert(
  reviewDecision?.decision?.outcome?.priority === "high",
  "Decision should preserve priority"
);
assert(
  ownershipDecision,
  "Human review creation should log ownership decision"
);

const requestedTimelineItem = normalizeHumanReviewForVerification({
  ...review,
  agent_decision_id: null,
  requested_by: null,
  reviewer_user_id: null,
  decision: null,
});
const decisionTimelineItem = normalizeAgentDecisionForVerification({
  id: reviewDecision.id,
  agent_execution_id: reviewDecision.agent_execution_id,
  agent_id: reviewDecision.agent_id,
  decision_type: reviewDecision.decision_type,
  decision: reviewDecision.decision,
  rationale: reviewDecision.rationale,
  confidence: reviewDecision.confidence,
  metadata: reviewDecision.metadata,
  created_at: reviewDecision.created_at,
});

assert(
  requestedTimelineItem.title === "Human Review Requested",
  "Pending review timeline should show requested title"
);
assert(
  decisionTimelineItem.title === "Human Review Requested",
  "Decision timeline should show requested title"
);

const transitions = [];

for (const status of [
  "in_review",
  "approved",
  "rejected",
  "completed",
]) {
  const updated = await updateHumanReviewStatus({
    supabase,
    organizationId,
    reviewId: review.id,
    status,
    reviewedBy: "user-reviewer",
    reviewOutcome: `${status} outcome`,
    reviewNotes: `${status} notes`,
  });
  const timelineItem = normalizeHumanReviewForVerification({
    ...updated,
    agent_decision_id: null,
    requested_by: null,
    reviewer_user_id: null,
    decision:
      status === "approved"
        ? "approve"
        : status === "rejected"
          ? "reject"
          : status === "completed"
            ? "complete"
            : null,
  });

  transitions.push({
    status,
    timeline_title: timelineItem.title,
    reviewed_at: updated.reviewed_at,
  });
}

assert(
  transitions.some(
    (transition) =>
      transition.status === "approved" &&
      transition.timeline_title === "Human Review Approved"
  ),
  "Approved transition should be visible in timeline"
);
assert(
  transitions.some(
    (transition) =>
      transition.status === "rejected" &&
      transition.timeline_title === "Human Review Rejected"
  ),
  "Rejected transition should be visible in timeline"
);
assert(
  transitions.some(
    (transition) =>
      transition.status === "completed" &&
      transition.timeline_title === "Human Review Completed"
  ),
  "Completed transition should be visible in timeline"
);

console.log(
  JSON.stringify(
    {
      operations_to_human_review_created: created.created,
      duplicate_reviews_created: state.humanReviews.length - 1,
      ownership: {
        owner_type: workItem.owner_type,
        ownership_status: workItem.ownership_status,
      },
      decisions: state.decisions.map((decision) => ({
        type: decision.decision_type,
        work_item_id: decision.work_item_id,
        review_id: decision.decision?.outcome?.review_id ?? null,
      })),
      timeline: [
        requestedTimelineItem.title,
        decisionTimelineItem.title,
        ...transitions.map((transition) => transition.timeline_title),
      ],
      transitions,
    },
    null,
    2
  )
);
