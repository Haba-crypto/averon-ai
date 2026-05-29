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
  const state = {
    agentExecutions: [
      {
        id: "execution-provider-1",
        organization_id: "org-provider-1",
        output: null,
      },
    ],
    decisions: [],
    tasks: [],
    workItems: [],
    executionQueue: [],
    emails: [],
    apiCalls: [],
  };

  function tableRows(table) {
    if (table === "agent_executions") return state.agentExecutions;
    if (table === "agent_decisions") return state.decisions;
    if (table === "tasks") return state.tasks;
    if (table === "work_items") return state.workItems;
    if (table === "execution_queue") return state.executionQueue;
    if (table === "emails") return state.emails;
    if (table === "api_calls") return state.apiCalls;

    return [];
  }

  function createBuilder(table) {
    const builder = {
      filters: {},
      patch: null,
      insertRow: null,
      select() {
        if (this.patch) {
          tableRows(table)
            .filter((row) =>
              Object.entries(this.filters).every(
                ([key, value]) => row[key] === value
              )
            )
            .forEach((row) => Object.assign(row, this.patch));
        }

        return this;
      },
      eq(key, value) {
        this.filters[key] = value;
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
      update(patch) {
        this.patch = patch;
        return this;
      },
      async single() {
        if (this.insertRow) {
          return { data: { ...this.insertRow }, error: null };
        }

        const row = tableRows(table).find((candidate) =>
          Object.entries(this.filters).every(
            ([key, value]) => candidate[key] === value
          )
        );

        return row
          ? { data: { ...row }, error: null }
          : { data: null, error: new Error("Not found") };
      },
      async execute() {
        if (this.patch) {
          tableRows(table)
            .filter((row) =>
              Object.entries(this.filters).every(
                ([key, value]) => row[key] === value
              )
            )
            .forEach((row) => Object.assign(row, this.patch));
        }

        return { data: [], error: null };
      },
      then(resolve, reject) {
        return this.execute().then(resolve, reject);
      },
    };

    return builder;
  }

  return {
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

const {
  OpenAIReasoningProvider,
  selectReasoningProvider,
  generateReasoningProposalWithMetadata,
  evaluateReasoningProposal,
  persistReasoningProposalDecision,
  buildPersistedReasoningProposal,
} = loadModule("lib/application/agents/reasoning-proposal.ts");

const runtimeContext = {
  organization_id: "org-provider-1",
  queue_item: {
    id: "queue-provider-1",
    status: "completed",
    assigned_agent_id: "agent-provider-1",
    assigned_agent_name: "Operations Agent",
    queue_reason: "Approved internal continuation.",
    next_action: "Prepare a human-reviewed internal recommendation.",
    review_id: "review-provider-1",
    source_decision_id: "decision-provider-source",
    metadata: {},
  },
  work_item: {
    id: "work-provider-1",
    type: "lead_acquisition",
    status: "queued",
    owner_type: "ai",
    owner_agent_name: "Operations Agent",
    ownership_status: "ready_to_resume",
    last_owner_change_reason: "approved human review",
  },
  lead: null,
  assigned_agent: {
    id: "agent-provider-1",
    key: "operations",
    name: "Operations Agent",
    description: "Coordinates controlled execution.",
    role: "Revenue Operations",
  },
  ownership: {
    owner_type: "ai",
    owner_agent_name: "Operations Agent",
    ownership_status: "ready_to_resume",
    last_owner_change_reason: "approved human review",
  },
  memory_context: {
    lead_memory: [],
    work_item_memory: [],
    global_memory: [],
    retrieval_summary: "No sensitive memory included.",
  },
  human_review_context: {
    id: "review-provider-1",
    review_title: "Resume Operations",
    review_summary: "Approved internal continuation.",
    recommended_action: "Prepare internal recommendation.",
    status: "approved",
    review_outcome: "Approved",
    review_notes: "Proceed with human-reviewed proposal only.",
    reviewed_at: new Date().toISOString(),
  },
  recent_timeline: [],
  recommended_next_action: "Prepare internal recommendation.",
  safety_flags: [],
};

const governanceResult = {
  allowed: true,
  blocked: false,
  human_review_required: false,
  escalation_required: false,
  autonomy_level: "manual",
  risk_level: "low",
  policy_reason: "Manual proposal-only reasoning is allowed.",
  policy_checks: [],
};

const priorityResult = {
  priority_score: 80,
  urgency_score: 72,
  business_impact_score: 70,
  risk_score: 10,
  scheduling_bucket: "now",
  recommended_execution_order: 1,
  rationale: "Verification fixture.",
  signals: [],
};

const outcomeEvaluation = {
  outcome_status: "successful",
  success_score: 88,
  failure_category: null,
  retry_recommended: false,
  escalation_recommended: false,
  feedback_summary: "Verification outcome.",
  signals: [],
};

const executionPlan = {
  plan_id: "plan-provider-1",
  agent_name: "Operations Agent",
  capability_id: "internal_recommendation",
  steps: [],
  risk_level: "low",
  requires_human_review: false,
  recommended_next_step: "Store proposal only.",
};

const providerInput = {
  runtimeContext,
  governanceResult,
  priorityResult,
  outcomeEvaluation,
  executionPlan,
};

assert(
  selectReasoningProvider({}).name === "deterministic",
  "default provider is deterministic"
);
assert(
  selectReasoningProvider({ AVERON_REASONING_PROVIDER: "openai" }).name ===
    "openai",
  "OpenAI provider is only selected when env flag is set"
);

let openaiCallCount = 0;
const validOpenAIClient = {
  responses: {
    async create() {
      openaiCallCount += 1;

      return {
        output_text: JSON.stringify({
          reasoning_summary: "Use proposal-only internal reasoning.",
          confidence_score: 91,
          recommended_strategy: "Prepare a human-reviewed recommendation.",
          proposed_actions: [
            {
              id: "action-1",
              type: "recommendation",
              title: "Prepare internal recommendation",
              description: "Summarize the safe next step for a human reviewer.",
              risk_level: "low",
              requires_human_review: true,
            },
          ],
          proposed_plan_changes: [],
          proposed_risks: [],
          requires_human_review: true,
        }),
      };
    },
  },
};

const validResult = await generateReasoningProposalWithMetadata({
  ...providerInput,
  provider: new OpenAIReasoningProvider(validOpenAIClient, "test-model"),
});
const validGovernance = evaluateReasoningProposal({
  proposal: validResult.proposal,
  governanceResult,
});

assert(openaiCallCount === 1, "OpenAI provider mock was called once");
assert(validResult.provider === "openai", "valid OpenAI proposal persists provider");
assert(validResult.schema_valid === true, "valid OpenAI proposal is schema-valid");
assert(validResult.fallback_used === false, "valid OpenAI proposal does not fall back");
assert(
  validGovernance.accepted_actions.length === 1 &&
    validGovernance.rejected_actions.length === 0,
  "valid proposal passes governance"
);

const invalidOpenAIClient = {
  responses: {
    async create() {
      return {
        output_text: "{not-json",
      };
    },
  },
};
const fallbackResult = await generateReasoningProposalWithMetadata({
  ...providerInput,
  provider: new OpenAIReasoningProvider(invalidOpenAIClient, "test-model"),
});

assert(
  fallbackResult.provider === "deterministic" &&
    fallbackResult.fallback_used === true &&
    fallbackResult.schema_valid === false &&
    fallbackResult.fallback_reason,
  "invalid LLM JSON falls back to deterministic"
);

const unsafeOpenAIClient = {
  responses: {
    async create() {
      return {
        output_text: JSON.stringify({
          reasoning_summary: "Unsafe action represented as proposal only.",
          confidence_score: 67,
          recommended_strategy: "Flag unsafe external action.",
          proposed_actions: [
            {
              id: "unsafe-1",
              type: "risk_flag",
              title: "Send email to customer",
              description: "Sending email is not allowed in reasoning sandbox.",
              risk_level: "high",
              requires_human_review: true,
            },
          ],
          proposed_plan_changes: [],
          proposed_risks: [],
          requires_human_review: true,
        }),
      };
    },
  },
};
const unsafeResult = await generateReasoningProposalWithMetadata({
  ...providerInput,
  provider: new OpenAIReasoningProvider(unsafeOpenAIClient, "test-model"),
});
const unsafeGovernance = evaluateReasoningProposal({
  proposal: unsafeResult.proposal,
  governanceResult,
});

assert(
  unsafeGovernance.rejected_actions[0]?.title === "Send email to customer",
  "unsafe action is rejected by governance"
);

const environment = createFakeSupabase();
const decision = await persistReasoningProposalDecision({
  supabase: environment.supabase,
  organizationId: "org-provider-1",
  agentExecutionId: "execution-provider-1",
  agentId: "agent-provider-1",
  workItemId: "work-provider-1",
  reasoningResult: validResult,
  proposalGovernance: validGovernance,
  processedAt: new Date().toISOString(),
});
const persistedReasoningProposal = buildPersistedReasoningProposal({
  reasoningResult: validResult,
  proposalGovernance: validGovernance,
});

await environment.supabase
  .from("agent_executions")
  .update({
    output: {
      reasoning_proposal: persistedReasoningProposal,
    },
  })
  .eq("id", "execution-provider-1")
  .eq("organization_id", "org-provider-1");

const persistedDecision = environment.state.decisions.find(
  (item) => item.id === decision.id
);
const persistedExecution = environment.state.agentExecutions[0];

assert(
  persistedDecision?.decision_type === "reasoning_proposal_created",
  "valid proposal persists"
);
assert(
  persistedDecision?.decision?.outcome?.provider === "openai" &&
    persistedDecision?.decision?.outcome?.schema_valid === true &&
    persistedDecision?.decision?.outcome?.fallback_used === false,
  "provider metadata persists on agent_decision"
);
assert(
  persistedExecution.output.reasoning_proposal.provider === "openai" &&
    persistedExecution.output.reasoning_proposal.schema_valid === true &&
    persistedExecution.output.reasoning_proposal.fallback_used === false,
  "provider metadata persists on agent_execution output"
);
assert(
  environment.state.tasks.length === 0 &&
    environment.state.workItems.length === 0 &&
    environment.state.executionQueue.length === 0 &&
    environment.state.emails.length === 0 &&
    environment.state.apiCalls.length === 0,
  "no side effects created"
);
assert(environment.state.executionQueue.length === 0, "no queue processing triggered");
assert(
  environment.state.tasks.length === 0 &&
    environment.state.workItems.length === 0 &&
    environment.state.emails.length === 0 &&
    environment.state.apiCalls.length === 0,
  "no email/API/task/work creation triggered"
);

console.log(
  JSON.stringify(
    {
      reasoning_provider: {
        default_provider: "deterministic",
        env_provider: "openai",
        invalid_json_fallback_provider: fallbackResult.provider,
        unsafe_rejected_actions: unsafeGovernance.rejected_actions.map(
          (action) => action.title
        ),
        decision_type: persistedDecision?.decision_type ?? null,
        execution_provider:
          persistedExecution.output.reasoning_proposal.provider,
        schema_valid: persistedExecution.output.reasoning_proposal.schema_valid,
        fallback_used:
          persistedExecution.output.reasoning_proposal.fallback_used,
        side_effects_created: false,
        queue_processing_triggered: false,
        email_api_task_work_created: false,
      },
    },
    null,
    2
  )
);
