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

loadEnvFile(".env.local");
loadEnvFile(".env");

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

function loadEnvFile(relativePath) {
  const envPath = path.join(rootDir, relativePath);

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    process.env[key] ??= value;
  }
}

assert(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL is required"
);
assert(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  "SUPABASE_SERVICE_ROLE_KEY is required"
);

const { supabaseAdmin } = loadModule("lib/supabase/admin.ts");
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);

const { data: readyItem, error: readyItemError } = await supabaseAdmin
  .from("execution_queue")
  .select(
    [
      "id",
      "organization_id",
      "work_item_id",
      "assigned_agent_name",
      "status",
      "created_at",
    ].join(", ")
  )
  .eq("status", "ready")
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle();

if (readyItemError) {
  throw readyItemError;
}

assert(
  readyItem,
  "No real execution_queue item with status = ready was found"
);

const result = await processNextExecutionQueueItem({
  supabase: supabaseAdmin,
  organizationId: readyItem.organization_id,
  queueItemId: readyItem.id,
});

assert(result.processed_count === 1, "exactly one item must process");
assert(result.openai_called === false, "OpenAI must not be called");
assert(
  result.queue_item.id === readyItem.id,
  "processed queue item id should match selected ready item"
);

const { data: completedQueueItem, error: queueError } =
  await supabaseAdmin
    .from("execution_queue")
    .select("id, status, failure_reason, completed_at")
    .eq("id", readyItem.id)
    .eq("organization_id", readyItem.organization_id)
    .single();

if (queueError) {
  throw queueError;
}

assert(
  completedQueueItem.status === "completed",
  "queue item status should become completed"
);

const { data: agentExecution, error: executionError } =
  await supabaseAdmin
    .from("agent_executions")
    .select("id, status, metadata, output")
    .eq("id", result.agent_execution_id)
    .eq("organization_id", readyItem.organization_id)
    .single();

if (executionError) {
  throw executionError;
}

assert(agentExecution, "agent_execution should be created");
assert(
  agentExecution.status === "succeeded",
  "agent_execution should succeed"
);
assert(
  agentExecution.metadata?.openai_called === false,
  "agent_execution metadata should record openai_called = false"
);

const { data: agentDecision, error: decisionError } =
  await supabaseAdmin
    .from("agent_decisions")
    .select("id, decision_type, decision, metadata")
    .eq("id", result.agent_decision_id)
    .eq("organization_id", readyItem.organization_id)
    .eq("decision_type", "queue_execution_processed")
    .single();

if (decisionError) {
  throw decisionError;
}

assert(
  agentDecision,
  "queue_execution_processed agent_decision should be created"
);
assert(
  agentDecision.decision?.outcome?.queue_item_id === readyItem.id,
  "agent_decision should reference processed queue item"
);
assert(
  agentDecision.decision?.outcome?.result === "processed",
  "agent_decision should store processed result"
);
assert(
  agentDecision.metadata?.openai_called === false,
  "agent_decision metadata should record openai_called = false"
);

console.log(
  JSON.stringify(
    {
      queue_orchestrator_live: {
        processed_count: result.processed_count,
        queue_item_id: readyItem.id,
        organization_id: readyItem.organization_id,
        work_item_id: readyItem.work_item_id,
        assigned_agent_name: readyItem.assigned_agent_name,
        queue_status: completedQueueItem.status,
        agent_execution_id: agentExecution.id,
        agent_execution_status: agentExecution.status,
        agent_decision_id: agentDecision.id,
        agent_decision_type: agentDecision.decision_type,
        openai_called: false,
      },
    },
    null,
    2
  )
);
