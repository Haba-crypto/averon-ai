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

function verifyRoutingCase({ label, message, expectedAgent, fallback }) {
  const decision = routeRevenueAgentDecision(message);

  assert(
    decision.selected_agent === expectedAgent,
    `${label} routed to ${decision.selected_agent}, expected ${expectedAgent}`
  );
  assert(
    routeRevenueAgent(message) === expectedAgent,
    `${label} legacy routeRevenueAgent should return ${expectedAgent}`
  );
  assert(
    typeof decision.confidence === "number" &&
      decision.confidence >= 0 &&
      decision.confidence <= 1,
    `${label} should expose normalized confidence`
  );
  assert(
    decision.scores[expectedAgent] >= 0,
    `${label} should expose score for ${expectedAgent}`
  );
  assert(
    Array.isArray(decision.matched_signals[expectedAgent]),
    `${label} should expose matched signals for ${expectedAgent}`
  );
  assert(
    decision.rationale.includes(expectedAgent),
    `${label} rationale should name selected agent`
  );

  if (fallback) {
    assert(
      decision.confidence <= 0.35,
      `${label} fallback confidence should be low`
    );
    assert(
      decision.rationale.toLowerCase().includes("defaulted"),
      `${label} fallback rationale should explain default`
    );
  } else {
    assert(
      decision.matched_signals[expectedAgent].length > 0,
      `${label} should include at least one matched signal`
    );
    assert(
      decision.confidence > 0.35,
      `${label} deterministic match should have higher confidence than fallback`
    );
  }

  return {
    message,
    selected_agent: decision.selected_agent,
    confidence: decision.confidence,
    scores: decision.scores,
    matched_signals: decision.matched_signals,
    rationale: decision.rationale,
  };
}

const { routeRevenueAgent, routeRevenueAgentDecision } = loadModule(
  "lib/ai/agents/revenue-router.ts"
);

const cases = [
  {
    label: "Russian SDR",
    message: "Сколько стоит внедрение?",
    expectedAgent: "SDR Agent",
  },
  {
    label: "Russian Research",
    message: "Изучи требования к интеграции Salesforce",
    expectedAgent: "Research Agent",
  },
  {
    label: "Russian Closer",
    message: "Отправьте коммерческое предложение",
    expectedAgent: "Closer Agent",
  },
  {
    label: "Russian Operations",
    message: "Создай задачу для команды внедрения",
    expectedAgent: "Operations Agent",
  },
  {
    label: "Russian fallback",
    message: "Привет",
    expectedAgent: "SDR Agent",
    fallback: true,
  },
  {
    label: "English SDR",
    message: "How much does it cost to implement?",
    expectedAgent: "SDR Agent",
  },
  {
    label: "English Research",
    message: "Research requirements and integration details for Salesforce",
    expectedAgent: "Research Agent",
  },
  {
    label: "English Closer",
    message: "Send proposal and contract terms, approved to move forward",
    expectedAgent: "Closer Agent",
  },
  {
    label: "English Operations",
    message: "Create task and assign next step for the implementation team",
    expectedAgent: "Operations Agent",
  },
  {
    label: "English fallback",
    message: "Hello",
    expectedAgent: "SDR Agent",
    fallback: true,
  },
];

const results = Object.fromEntries(
  cases.map((testCase) => [
    testCase.label,
    verifyRoutingCase(testCase),
  ])
);

console.log(JSON.stringify(results, null, 2));
