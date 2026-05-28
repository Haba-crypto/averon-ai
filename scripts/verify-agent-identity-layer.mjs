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

function createIdentity(profile, agentId) {
  return {
    profile,
    agentId,
    identityContext: buildAgentIdentityContext(profile),
  };
}

function verifyConversationCase({ label, message, expectedAgent }) {
  const activeAgent = routeRevenueAgent(message);
  const profile = getAgentProfileForActiveAgent(activeAgent);

  assert(
    activeAgent === expectedAgent,
    `${label} routed to ${activeAgent}, expected ${expectedAgent}`
  );
  assert(profile, `${label} should resolve an agent profile`);

  const identity = createIdentity(profile, `${profile.key}-uuid`);
  const prompt = buildRevenueChatPrompt({
    activeAgent,
    agentIdentityContext: identity.identityContext,
    lead: null,
    strategy: {
      stage: "discovery",
      pressure: "medium",
      qualificationFocus: "current sales workflow",
      ctaMode: "qualify",
    },
    memoryContext:
      "Retrieved relevant memory:\n- Existing CRM is HubSpot",
  });
  const identityIndex = prompt.indexOf(
    `You are the ${profile.name}.`
  );
  const memoryIndex = prompt.indexOf("Retrieved relevant memory");

  assert(
    identityIndex >= 0,
    `${label} should inject identity context`
  );
  assert(
    memoryIndex < 0 || identityIndex < memoryIndex,
    `${label} identity context should appear before memory context`
  );

  const executionFields =
    buildAgentExecutionIdentityFields(identity);

  assert(
    executionFields.agent_id === `${profile.key}-uuid`,
    `${label} should store agent_id on execution fields`
  );
  assert(
    executionFields.agent_name === profile.name,
    `${label} should store agent_name on execution fields`
  );
  assert(
    executionFields.agent_role === profile.role,
    `${label} should store agent_role on execution fields`
  );

  const timelineItem = normalizeAgentExecutionForVerification({
    id: `${profile.key}-execution`,
    agent_id: executionFields.agent_id,
    agent_name: executionFields.agent_name,
    agent_role: executionFields.agent_role,
    workflow_run_id: null,
    workflow_step_id: null,
    status: "succeeded",
    metadata: executionFields.metadata,
    error: null,
    started_at: "2026-05-29T00:00:00.000Z",
    completed_at: "2026-05-29T00:00:01.000Z",
    created_at: "2026-05-29T00:00:00.000Z",
    updated_at: "2026-05-29T00:00:01.000Z",
  });

  assert(
    timelineItem.title.includes(profile.name),
    `${label} timeline should expose agent name`
  );
  assert(
    timelineItem.metadata.agent_identity?.agent_role ===
      profile.role,
    `${label} timeline should expose agent role`
  );

  return {
    activeAgent,
    injectedIdentity: prompt
      .slice(identityIndex, identityIndex + 140)
      .trim(),
    executionFields,
    timelineTitle: timelineItem.title,
  };
}

const {
  buildAgentIdentityContext,
  getAgentProfileForActiveAgent,
} = loadModule("lib/agents/agent-profiles.ts");
const { routeRevenueAgent } = loadModule(
  "lib/ai/agents/revenue-router.ts"
);
const { buildRevenueChatPrompt } = loadModule(
  "lib/ai/prompts/revenue-chat.ts"
);
const { buildAgentExecutionIdentityFields } = loadModule(
  "lib/application/agents/agent-identity.ts"
);
const { normalizeAgentExecutionForVerification } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const results = {
  sdr: verifyConversationCase({
    label: "SDR conversation",
    message: "Can you tell me if this is useful for our sales team?",
    expectedAgent: "SDR Agent",
  }),
  research: verifyConversationCase({
    label: "Research conversation",
    message: "Can you research our company requirements first?",
    expectedAgent: "Research Agent",
  }),
  closer: verifyConversationCase({
    label: "Closer conversation",
    message: "We are ready to buy, send the contract for approval.",
    expectedAgent: "Closer Agent",
  }),
  operations: verifyConversationCase({
    label: "Operations conversation",
    message: "Can you route this workflow to the right owner?",
    expectedAgent: "Operations Agent",
  }),
};

const fallbackPrompt = buildRevenueChatPrompt({
  activeAgent: "SDR Agent",
  lead: null,
  strategy: {
    stage: "discovery",
    pressure: "low",
    qualificationFocus: "current sales workflow",
    ctaMode: "qualify",
  },
  memoryContext: "Retrieved relevant memory:\n- No identity found",
});

assert(
  !fallbackPrompt.includes("Agent identity context:"),
  "Missing agent fallback should omit identity context"
);
assert(
  fallbackPrompt.includes("Current active agent:"),
  "Missing agent fallback should preserve base prompt behavior"
);

console.log(
  JSON.stringify(
    {
      ...results,
      missingAgentFallback: {
        identityContextInjected: false,
        basePromptPreserved: true,
      },
    },
    null,
    2
  )
);
