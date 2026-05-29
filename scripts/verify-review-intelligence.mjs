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

function assertBriefingClassification({
  label,
  reviewReason,
  expectedTitle,
  expectedSummary,
  expectedAction,
}) {
  const briefing = buildReviewBriefing({
    sourceAgent: {
      id: "agent-operations",
      name: "Operations Agent",
      role: "Revenue Operations",
    },
    reviewType: "handoff",
    reviewReason,
    context: {
      lead_id: "lead-classification",
      work_item_id: "work-item-classification",
      source_agent: "Operations Agent",
      owner_agent: "Operations Agent",
      memory_summary: null,
      review_reason: reviewReason,
    },
  });

  assert(
    briefing.review_title === expectedTitle,
    `${label} should generate ${expectedTitle}`
  );
  assert(
    briefing.review_summary === expectedSummary,
    `${label} should generate expected summary`
  );
  assert(
    briefing.recommended_action === expectedAction,
    `${label} should generate expected action`
  );

  return {
    label,
    review_title: briefing.review_title,
    review_summary: briefing.review_summary,
    recommended_action: briefing.recommended_action,
  };
}

function createFakeSupabase() {
  const organizationId = "org-phase-15";
  const leadId = "lead-phase-15";
  const workItemId = "work-item-phase-15";
  const now = new Date().toISOString();
  const state = {
    workItems: [
      {
        id: workItemId,
        organization_id: organizationId,
        lead_id: leadId,
        source_type: "lead",
        source_id: leadId,
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
    leads: [
      {
        id: leadId,
        organization_id: organizationId,
        name: "Avery Patel",
        company: "Northstar Legal",
        email: "avery@example.com",
      },
    ],
    memoryEntries: [
      {
        id: "memory-summary-phase-15",
        organization_id: organizationId,
        lead_id: leadId,
        work_item_id: workItemId,
        content:
          "Lead requested contract review before implementation launch.",
        metadata: {
          memory_type: "summary",
        },
        created_at: now,
      },
    ],
    agentExecutions: [
      {
        id: "execution-phase-15",
        organization_id: organizationId,
        work_item_id: workItemId,
        status: "running",
        created_at: now,
      },
    ],
    humanReviews: [],
    decisions: [],
  };

  function tableRows(table) {
    if (table === "work_items") {
      return state.workItems;
    }

    if (table === "leads") {
      return state.leads;
    }

    if (table === "memory_entries") {
      return state.memoryEntries;
    }

    if (table === "agent_executions") {
      return state.agentExecutions;
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
      rangeFrom: null,
      rangeTo: null,
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
      range(from, to) {
        this.rangeFrom = from;
        this.rangeTo = to;
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
      then(resolve) {
        resolve({
          data: this.getRows(),
          error: null,
          count: this.getRows().length,
        });
      },
      async maybeSingle() {
        const rows = this.getRows();
        return { data: rows[0] ?? null, error: null };
      },
      async single() {
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

        if (this.rangeFrom !== null && this.rangeTo !== null) {
          rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
        }

        return rows;
      },
    };

    return builder;
  }

  return {
    organizationId,
    leadId,
    workItemId,
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

const { buildReviewBriefing, createHumanReview } = loadModule(
  "lib/application/human-reviews/create-human-review.ts"
);
const { listHumanReviews } = loadModule(
  "lib/application/human-reviews/list-human-reviews.ts"
);
const {
  normalizeAgentDecisionForVerification,
  normalizeHumanReviewForVerification,
} = loadModule("lib/application/work-items/list-work-item-timeline.ts");

const { supabase, organizationId, leadId, workItemId, state } =
  createFakeSupabase();

const classificationResults = [
  assertBriefingClassification({
    label: "procurement review",
    reviewReason:
      "Approval from procurement is required for vendor approval.",
    expectedTitle: "Procurement Approval Required",
    expectedSummary:
      "Procurement approval is required before execution can continue.",
    expectedAction:
      "Review and approve or reject the procurement request.",
  }),
  assertBriefingClassification({
    label: "legal review",
    reviewReason:
      "Нужно согласование. Требуется юридическая проверка.",
    expectedTitle: "Contract Approval Required",
    expectedSummary:
      "Legal or contractual approval is required before execution can continue.",
    expectedAction:
      "Review and approve or reject the requested contract action.",
  }),
  assertBriefingClassification({
    label: "contract approval review",
    reviewReason:
      "Contract approval and compliance review are required.",
    expectedTitle: "Contract Approval Required",
    expectedSummary:
      "Legal or contractual approval is required before execution can continue.",
    expectedAction:
      "Review and approve or reject the requested contract action.",
  }),
  assertBriefingClassification({
    label: "generic exception review",
    reviewReason:
      "Execution failed with an unexpected exception in the workflow.",
    expectedTitle: "Exception Review Required",
    expectedSummary:
      "An execution exception requires human review.",
    expectedAction: "Inspect exception and determine next action.",
  }),
];

const created = await createHumanReview({
  supabase,
  organizationId,
  workItemId,
  sourceAgent: {
    id: "agent-operations",
    name: "Operations Agent",
    role: "Revenue Operations",
  },
  reviewType: "handoff",
  reviewReason:
    "Legal approval and contract review are required before execution continues.",
  priority: "high",
  agentExecutionId: "execution-phase-15",
});

const review = state.humanReviews[0];
const reviewDecision = state.decisions.find(
  (decision) => decision.decision_type === "human_review_requested"
);

assert(created.created === true, "Review should be created");
assert(
  created.review.review_title,
  "Returned created review should include a briefing title"
);
assert(
  created.review.review_summary,
  "Returned created review should include a briefing summary"
);
assert(
  created.review.recommended_action,
  "Returned created review should include a recommended action"
);
assert(review.review_title, "Briefing title should be generated");
assert(review.review_summary, "Briefing summary should be generated");
assert(
  review.recommended_action,
  "Briefing recommended action should be generated"
);
assert(
  review.review_title === "Contract Approval Required",
  "Legal approval title should be deterministic"
);
assert(
  review.review_summary ===
    "Legal or contractual approval is required before execution can continue.",
  "Legal approval summary should be deterministic"
);
assert(
  review.recommended_action ===
    "Review and approve or reject the requested contract action.",
  "Legal approval action should be deterministic"
);
assert(
  review.review_context?.lead_id === leadId,
  "Review context should include lead id"
);
assert(
  review.review_context?.work_item_id === workItemId,
  "Review context should include work item id"
);
assert(
  review.review_context?.source_agent === "Operations Agent",
  "Review context should include source agent"
);
assert(
  review.review_context?.owner_agent === "Operations Agent",
  "Review context should include owner agent"
);
assert(
  review.review_context?.memory_summary ===
    "Lead requested contract review before implementation launch.",
  "Review context should include memory summary"
);
assert(
  review.review_context?.review_reason ===
    "Legal approval and contract review are required before execution continues.",
  "Review context should include review reason"
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
  "Human review timeline title should remain requested"
);
assert(
  requestedTimelineItem.message === "Contract Approval Required",
  "Human review timeline should display briefing title"
);
assert(
  decisionTimelineItem.title === "Human Review Requested",
  "Decision timeline title should remain requested"
);
assert(
  decisionTimelineItem.message === "Contract Approval Required",
  "Decision timeline should display briefing title"
);

const inbox = await listHumanReviews({
  supabase,
  organizationId,
  page: 1,
  limit: 25,
});
const inboxReview = inbox.reviews[0];

assert(
  inboxReview.review_title === "Contract Approval Required",
  "Review inbox payload should include briefing title"
);
assert(
  inboxReview.review_summary ===
    "Legal or contractual approval is required before execution can continue.",
  "Review inbox payload should include briefing summary"
);
assert(
  inboxReview.recommended_action ===
    "Review and approve or reject the requested contract action.",
  "Review inbox payload should include recommended action"
);
assert(
  inboxReview.review_context?.lead_id === leadId,
  "Review inbox payload should include review context"
);

const reusedEnvironment = createFakeSupabase();
reusedEnvironment.state.humanReviews.push({
  id: "human-review-existing-null-briefing",
  organization_id: reusedEnvironment.organizationId,
  work_item_id: reusedEnvironment.workItemId,
  agent_execution_id: "execution-phase-15",
  source_agent_id: "agent-operations",
  source_agent_name: "Operations Agent",
  review_type: "handoff",
  review_reason:
    "Legal approval and contract review are required before execution continues.",
  review_title: null,
  review_summary: null,
  review_context: null,
  recommended_action: null,
  status: "pending",
  priority: "high",
  requested_at: new Date().toISOString(),
  reviewed_at: null,
  reviewed_by: null,
  review_outcome: null,
  review_notes: null,
});

const reused = await createHumanReview({
  supabase: reusedEnvironment.supabase,
  organizationId: reusedEnvironment.organizationId,
  workItemId: reusedEnvironment.workItemId,
  sourceAgent: {
    id: "agent-operations",
    name: "Operations Agent",
    role: "Revenue Operations",
  },
  reviewType: "handoff",
  reviewReason:
    "Legal approval and contract review are required before execution continues.",
  priority: "high",
  agentExecutionId: "execution-phase-15",
});
const reusedReview = reusedEnvironment.state.humanReviews[0];

assert(reused.created === false, "Open review should be reused");
assert(
  reusedEnvironment.state.humanReviews.length === 1,
  "Reusing an open review should not create a duplicate"
);
assert(
  reused.review.review_title === "Contract Approval Required",
  "Reused review return value should include generated title"
);
assert(
  reused.review.review_summary,
  "Reused review return value should include generated summary"
);
assert(
  reused.review.recommended_action,
  "Reused review return value should include generated action"
);
assert(
  reusedReview.review_title === "Contract Approval Required",
  "Existing open review should be backfilled with generated title"
);
assert(
  reusedReview.review_summary,
  "Existing open review should be backfilled with generated summary"
);
assert(
  reusedReview.recommended_action,
  "Existing open review should be backfilled with generated action"
);

const reclassifiedEnvironment = createFakeSupabase();
const initialException = await createHumanReview({
  supabase: reclassifiedEnvironment.supabase,
  organizationId: reclassifiedEnvironment.organizationId,
  workItemId: reclassifiedEnvironment.workItemId,
  sourceAgent: {
    id: "agent-operations",
    name: "Operations Agent",
    role: "Revenue Operations",
  },
  reviewType: "handoff",
  reviewReason:
    "Execution failed with an unexpected workflow exception.",
  priority: "high",
  agentExecutionId: "execution-phase-15",
});
const reclassified = await createHumanReview({
  supabase: reclassifiedEnvironment.supabase,
  organizationId: reclassifiedEnvironment.organizationId,
  workItemId: reclassifiedEnvironment.workItemId,
  sourceAgent: {
    id: "agent-operations",
    name: "Operations Agent",
    role: "Revenue Operations",
  },
  reviewType: "handoff",
  reviewReason:
    "Нужно согласование. Требуется юридическая проверка. Approval от procurement.",
  priority: "high",
  agentExecutionId: "execution-phase-15",
});
const reclassifiedReview =
  reclassifiedEnvironment.state.humanReviews[0];

assert(
  initialException.review.review_title === "Exception Review Required",
  "Initial review should start as exception"
);
assert(
  reclassified.created === false,
  "Reclassification should reuse the existing open review"
);
assert(
  reclassifiedEnvironment.state.humanReviews.length === 1,
  "Reclassification should not create a duplicate open review"
);
assert(
  reclassified.review.review_title ===
    "Procurement Approval Required",
  "Returned reused review should be reclassified to procurement"
);
assert(
  reclassifiedReview.review_title ===
    "Procurement Approval Required",
  "Stored reused review should be reclassified to procurement"
);
assert(
  reclassifiedReview.review_summary ===
    "Procurement approval is required before execution can continue.",
  "Stored reused review should get procurement summary"
);
assert(
  reclassifiedReview.recommended_action ===
    "Review and approve or reject the procurement request.",
  "Stored reused review should get procurement action"
);

console.log(
  JSON.stringify(
    {
      briefing_generated: Boolean(review.review_title),
      title: review.review_title,
      summary: review.review_summary,
      recommended_action: review.recommended_action,
      review_context: review.review_context,
      timeline: {
        human_review: `${requestedTimelineItem.title}: ${requestedTimelineItem.message}`,
        decision: `${decisionTimelineItem.title}: ${decisionTimelineItem.message}`,
      },
      inbox_payload: {
        review_title: inboxReview.review_title,
        review_summary: inboxReview.review_summary,
        recommended_action: inboxReview.recommended_action,
        review_context: inboxReview.review_context,
      },
      classification_results: classificationResults,
      reused_open_review: {
        created: reused.created,
        review_title: reusedReview.review_title,
        review_summary: reusedReview.review_summary,
        recommended_action: reusedReview.recommended_action,
      },
      reclassified_open_review: {
        created: reclassified.created,
        before: initialException.review.review_title,
        after: reclassifiedReview.review_title,
        review_summary: reclassifiedReview.review_summary,
        recommended_action: reclassifiedReview.recommended_action,
      },
    },
    null,
    2
  )
);
