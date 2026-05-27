import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type OpenAI from "openai";

import type { ConversationStrategy } from "@/lib/ai/agents/revenue-strategy";

export type ObjectionType =
  | "budget"
  | "timing"
  | "authority"
  | "trust"
  | "competitor"
  | "general";

export type ObjectionSubtype =
  | "no_budget"
  | "unclear_roi"
  | "low_priority"
  | "implementation_fear"
  | "existing_vendor_cost"
  | "procurement_friction";

export type PlaybookOverlay = {
  objectionType: ObjectionType | null;
  objectionSubtype: ObjectionSubtype | null;
  emotionalRule: string | null;
  personalityBranch: string | null;
  stageRule: string | null;
  memoryRule: string | null;
  knowledgeFacts: string[];
  instructions: string[];
  selectedRuleIds: string[];
};

type SelectPlaybookOverlayInput = {
  latestMessage: string;
  recentConversationTurns: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  strategy: ConversationStrategy;
};

type RuleKind =
  | "objection"
  | "emotional"
  | "personality"
  | "sales_stage"
  | "deal_stage"
  | "stage_detection"
  | "state_engine"
  | "memory_rule"
  | "memory_block"
  | "knowledge_fact";

type PlaybookRule = {
  id: string;
  kind: RuleKind;
  label: string;
  category: string;
  terms: string[];
  stageTerms: string[];
  instructions: string[];
  fact: string | null;
};

type PlaybookCollections = {
  objections: PlaybookRule[];
  emotionalRules: PlaybookRule[];
  personalityBranches: PlaybookRule[];
  stageRules: PlaybookRule[];
  memoryRules: PlaybookRule[];
  knowledgeFacts: PlaybookRule[];
};

type CsvRow = Record<string, string>;

const PLAYBOOK_DIR = path.join(process.cwd(), "config", "playbooks");
const MAX_TACTICAL_INSTRUCTIONS = 6;

const DATASETS: Array<{ fileName: string; kind: RuleKind }> = [
  { fileName: "ai_objections_rows.csv", kind: "objection" },
  {
    fileName: "ai_emotional_intelligence_rules_rows.csv",
    kind: "emotional",
  },
  {
    fileName: "ai_personality_branches_rows.csv",
    kind: "personality",
  },
  { fileName: "ai_sales_stages_rows.csv", kind: "sales_stage" },
  { fileName: "ai_deal_stages_rows.csv", kind: "deal_stage" },
  {
    fileName: "ai_stage_detection_rules_rows.csv",
    kind: "stage_detection",
  },
  {
    fileName: "ai_state_engine_rules_rows.csv",
    kind: "state_engine",
  },
  { fileName: "ai_memory_rules_rows.csv", kind: "memory_rule" },
  { fileName: "ai_memory_blocks_rows.csv", kind: "memory_block" },
  { fileName: "knowledge_base_rows.csv", kind: "knowledge_fact" },
];

const FALLBACK_OBJECTION_RULES: PlaybookRule[] = [
  createFallbackObjectionRule("budget", [
    "budget",
    "expensive",
    "too expensive",
    "cost too much",
    "too much",
    "can't afford",
    "cannot afford",
    "no money",
    "price is high",
  ], [
    "Acknowledge the cost concern briefly without discounting immediately.",
    "Reframe around business impact, then ask what budget range they had in mind.",
  ]),
  createFallbackObjectionRule("timing", [
    "later",
    "not now",
    "no time",
    "busy",
    "next quarter",
    "next month",
    "too early",
    "circle back",
    "follow up later",
  ], [
    "Acknowledge timing briefly and avoid pushing too hard.",
    "Ask what event, deadline, or priority would make this worth revisiting.",
  ]),
  createFallbackObjectionRule("authority", [
    "need approval",
    "ask my boss",
    "talk to my manager",
    "not my decision",
    "decision maker",
    "procurement",
    "legal needs",
    "board approval",
  ], [
    "Acknowledge the approval path and keep the prospect engaged.",
    "Ask who else needs to be involved and what they will care about most.",
  ]),
  createFallbackObjectionRule("trust", [
    "not sure",
    "skeptical",
    "prove",
    "case study",
    "references",
    "security",
    "compliance",
    "risk",
    "does this work",
    "why should i trust",
  ], [
    "Acknowledge the need for confidence without becoming defensive.",
    "Offer a proof point at a high level, then ask what would reduce the risk for them.",
  ]),
  createFallbackObjectionRule("competitor", [
    "competitor",
    "alternative",
    "already use",
    "using",
    "current vendor",
    "another vendor",
    "other solution",
    "happy with",
    "switched to",
  ], [
    "Acknowledge their current solution without criticizing it.",
    "Ask what they like about it and where it still falls short.",
  ]),
];

const OBJECTION_SUBTYPE_RULES: Array<{
  subtype: ObjectionSubtype;
  latestTerms: string[];
  memoryTerms: string[];
  relatedTypes: ObjectionType[];
  guidance: string;
}> = [
  {
    subtype: "no_budget",
    latestTerms: [
      "no budget",
      "don't have budget",
      "do not have budget",
      "budget is tight",
      "too expensive",
      "expensive",
      "can't afford",
      "cannot afford",
      "no money",
      "cost too much",
      "price is high",
    ],
    memoryTerms: ["budget", "price", "cost", "expensive", "afford"],
    relatedTypes: ["budget", "general"],
    guidance:
      "Diagnose whether this is actual budget timing or unclear ROI before defending price; ask which one is the real concern.",
  },
  {
    subtype: "unclear_roi",
    latestTerms: [
      "roi",
      "return",
      "payback",
      "pay back",
      "worth it",
      "not worth",
      "value",
      "business case",
      "numbers",
      "justify",
      "prove",
      "not convinced",
      "won't pay off",
      "will not pay off",
    ],
    memoryTerms: ["roi", "value", "payback", "business case", "justify"],
    relatedTypes: ["budget", "trust", "general"],
    guidance:
      "Treat the resistance as uncertainty about economic proof; ask what metric would make the ROI believable instead of making broad claims.",
  },
  {
    subtype: "low_priority",
    latestTerms: [
      "not a priority",
      "low priority",
      "not urgent",
      "later",
      "not now",
      "busy",
      "next quarter",
      "next month",
      "circle back",
      "follow up later",
      "back burner",
    ],
    memoryTerms: ["priority", "urgent", "later", "busy", "quarter"],
    relatedTypes: ["timing", "general"],
    guidance:
      "Do not push urgency; identify what would make this operationally important enough to revisit.",
  },
  {
    subtype: "implementation_fear",
    latestTerms: [
      "implementation",
      "implement",
      "integrate",
      "integration",
      "setup",
      "onboarding",
      "migration",
      "too complex",
      "complicated",
      "hard to roll out",
      "disruptive",
      "change management",
      "technical risk",
    ],
    memoryTerms: [
      "implementation",
      "integration",
      "setup",
      "onboarding",
      "migration",
      "complex",
    ],
    relatedTypes: ["timing", "trust", "general"],
    guidance:
      "Reduce uncertainty around rollout; ask whether the fear is integration effort, team adoption, or disruption to the current process.",
  },
  {
    subtype: "existing_vendor_cost",
    latestTerms: [
      "already use",
      "we use",
      "current vendor",
      "another vendor",
      "existing vendor",
      "other tool",
      "another tool",
      "happy with",
      "contract",
      "locked in",
      "switching cost",
      "switch costs",
      "replace",
      "rip and replace",
    ],
    memoryTerms: ["vendor", "tool", "contract", "switching", "replace"],
    relatedTypes: ["competitor", "budget", "general"],
    guidance:
      "Respect the incumbent solution; ask what they like, where it still falls short, and whether switching cost or satisfaction is the real blocker.",
  },
  {
    subtype: "procurement_friction",
    latestTerms: [
      "need approval",
      "approval",
      "procurement",
      "legal",
      "security review",
      "vendor review",
      "buying process",
      "purchase process",
      "committee",
      "board approval",
      "finance approval",
      "ask my boss",
      "not my decision",
      "decision maker",
    ],
    memoryTerms: ["approval", "procurement", "legal", "security", "committee"],
    relatedTypes: ["authority", "trust", "general"],
    guidance:
      "Map the approval path before asking for a CTA; clarify whether the blocker is process friction or lack of an internal champion.",
  },
];

let cachedCollections: PlaybookCollections | null = null;

export function selectPlaybookOverlay({
  latestMessage,
  recentConversationTurns,
  strategy,
}: SelectPlaybookOverlayInput): PlaybookOverlay {
  const collections = loadPlaybookCollections();
  const latest = latestMessage.toLowerCase();
  const recentTranscript = getRecentTranscript(recentConversationTurns);

  const selectedObjection = selectBestRule({
    rules:
      collections.objections.length > 0
        ? collections.objections
        : FALLBACK_OBJECTION_RULES,
    latest,
    recentTranscript,
    strategy,
    requireLatestMatch:
      strategy.stage !== "objection" &&
      strategy.ctaMode !== "resolve_objection",
  });
  const selectedEmotional = selectBestRule({
    rules: collections.emotionalRules,
    latest,
    recentTranscript,
    strategy,
  });
  const selectedPersonality = selectBestRule({
    rules: collections.personalityBranches,
    latest,
    recentTranscript,
    strategy,
  });
  const selectedStage = selectBestRule({
    rules: collections.stageRules,
    latest,
    recentTranscript,
    strategy,
  });
  const selectedMemory = selectBestRule({
    rules: collections.memoryRules,
    latest,
    recentTranscript,
    strategy,
  });
  const selectedFacts = selectTopRules({
    rules: collections.knowledgeFacts,
    latest,
    recentTranscript,
    strategy,
    limit: 3,
    requireLatestMatch: true,
  });

  const selectedRules = [
    selectedObjection,
    selectedEmotional,
    selectedPersonality,
    selectedStage,
    selectedMemory,
  ].filter((rule): rule is PlaybookRule => Boolean(rule));
  const objectionType = getObjectionType(selectedObjection);
  const selectedSubtype = selectObjectionSubtype({
    latest,
    recentTranscript,
    objectionType,
    strategy,
  });

  return {
    objectionType,
    objectionSubtype: selectedSubtype?.subtype ?? null,
    emotionalRule: selectedEmotional?.label ?? null,
    personalityBranch: selectedPersonality?.label ?? null,
    stageRule: selectedStage?.label ?? null,
    memoryRule: selectedMemory?.label ?? null,
    knowledgeFacts: selectedFacts
      .map((rule) => rule.fact)
      .filter((fact): fact is string => Boolean(fact))
      .slice(0, 3),
    instructions: selectedRules
      .flatMap((rule) => rule.instructions.slice(0, 1))
      .concat(selectedSubtype?.guidance ?? [])
      .filter(Boolean)
      .slice(0, MAX_TACTICAL_INSTRUCTIONS),
    selectedRuleIds: [...selectedRules, ...selectedFacts].map(
      (rule) => rule.id
    ),
  };
}

function selectObjectionSubtype({
  latest,
  recentTranscript,
  objectionType,
  strategy,
}: {
  latest: string;
  recentTranscript: string;
  objectionType: ObjectionType | null;
  strategy: ConversationStrategy;
}) {
  if (
    !objectionType &&
    strategy.stage !== "objection" &&
    strategy.ctaMode !== "resolve_objection"
  ) {
    return null;
  }

  return OBJECTION_SUBTYPE_RULES.map((rule, index) => {
    const latestMatches = countMatches(latest, rule.latestTerms);
    const recentMatches = countMatches(recentTranscript, rule.memoryTerms);
    const typeMatches =
      objectionType && rule.relatedTypes.includes(objectionType) ? 1 : 0;

    return {
      ...rule,
      index,
      latestMatches,
      score: latestMatches * 5 + recentMatches + typeMatches * 2,
    };
  })
    .filter((candidate) => candidate.score > 0)
    .filter((candidate) => candidate.latestMatches > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    })[0] ?? null;
}

export const selectObjectionPlaybookOverlay = selectPlaybookOverlay;

function loadPlaybookCollections(): PlaybookCollections {
  if (cachedCollections) {
    return cachedCollections;
  }

  const rules = DATASETS.flatMap(({ fileName, kind }) => {
    const filePath = path.join(PLAYBOOK_DIR, fileName);

    if (!existsSync(filePath)) {
      return [];
    }

    return parseCsv(readFileSync(filePath, "utf8")).map((row, index) =>
      normalizeRow({
        row,
        kind,
        id: `${fileName}:${index + 1}`,
      })
    );
  });

  cachedCollections = {
    objections: rules.filter((rule) => rule.kind === "objection"),
    emotionalRules: rules.filter((rule) => rule.kind === "emotional"),
    personalityBranches: rules.filter(
      (rule) => rule.kind === "personality"
    ),
    stageRules: rules.filter((rule) =>
      [
        "sales_stage",
        "deal_stage",
        "stage_detection",
        "state_engine",
      ].includes(rule.kind)
    ),
    memoryRules: rules.filter((rule) =>
      ["memory_rule", "memory_block"].includes(rule.kind)
    ),
    knowledgeFacts: rules.filter((rule) => rule.kind === "knowledge_fact"),
  };

  return cachedCollections;
}

function normalizeRow({
  row,
  kind,
  id,
}: {
  row: CsvRow;
  kind: RuleKind;
  id: string;
}): PlaybookRule {
  const label = firstValue(row, [
    "name",
    "title",
    "label",
    "type",
    "stage",
    "rule",
    "category",
  ]);
  const category = firstValue(row, [
    "category",
    "type",
    "segment",
    "persona",
    "stage",
  ]);
  const triggerText = valuesForKeys(row, [
    "keyword",
    "keywords",
    "trigger",
    "triggers",
    "condition",
    "conditions",
    "signal",
    "signals",
    "matcher",
    "match",
  ]);
  const stageText = valuesForKeys(row, [
    "stage",
    "sales_stage",
    "deal_stage",
    "state",
  ]);
  const instructionText = valuesForKeys(row, [
    "instruction",
    "instructions",
    "guidance",
    "playbook",
    "response",
    "recommended_response",
    "action",
    "next_action",
    "talk_track",
    "rule",
  ]);
  const fact = firstValue(row, [
    "fact",
    "content",
    "answer",
    "description",
    "summary",
    "body",
    "value",
  ]);
  const searchableText = [
    label,
    category,
    ...triggerText,
    ...stageText,
    kind === "knowledge_fact" ? fact : "",
  ].join(" ");

  return {
    id,
    kind,
    label: compactText(label || category || kind),
    category: compactText(category),
    terms: extractTerms(searchableText),
    stageTerms: extractTerms(stageText.join(" ")),
    instructions: normalizeInstructions(instructionText, fact, kind),
    fact:
      kind === "knowledge_fact"
        ? compactText(fact || instructionText.join(" "))
        : null,
  };
}

function selectBestRule({
  rules,
  latest,
  recentTranscript,
  strategy,
  requireLatestMatch = false,
}: {
  rules: PlaybookRule[];
  latest: string;
  recentTranscript: string;
  strategy: ConversationStrategy;
  requireLatestMatch?: boolean;
}) {
  return selectTopRules({
    rules,
    latest,
    recentTranscript,
    strategy,
    limit: 1,
    requireLatestMatch,
  })[0] ?? null;
}

function selectTopRules({
  rules,
  latest,
  recentTranscript,
  strategy,
  limit,
  requireLatestMatch = false,
}: {
  rules: PlaybookRule[];
  latest: string;
  recentTranscript: string;
  strategy: ConversationStrategy;
  limit: number;
  requireLatestMatch?: boolean;
}) {
  return rules
    .map((rule, index) => {
      const latestMatches = countMatches(latest, rule.terms);
      const recentMatches = countMatches(recentTranscript, rule.terms);
      const stageMatches = countMatches(
        `${strategy.stage} ${strategy.qualificationFocus} ${strategy.ctaMode}`,
        [...rule.stageTerms, rule.category]
      );

      return {
        rule,
        index,
        latestMatches,
        score: latestMatches * 3 + recentMatches + stageMatches * 2,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .filter(
      (candidate) => !requireLatestMatch || candidate.latestMatches > 0
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .map((candidate) => candidate.rule);
}

function parseCsv(csv: string): CsvRow[] {
  const rows = parseCsvRows(csv);
  const [headers, ...body] = rows;

  if (!headers) {
    return [];
  }

  const normalizedHeaders = headers.map((header, index) => {
    const normalized = normalizeKey(header);
    return normalized || `column_${index + 1}`;
  });

  return body
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      return normalizedHeaders.reduce<CsvRow>((record, header, index) => {
        record[header] = row[index]?.trim() ?? "";
        return record;
      }, {});
    });
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows;
}

function valuesForKeys(row: CsvRow, keys: string[]) {
  return Object.entries(row)
    .filter(([key]) => keys.some((candidate) => key.includes(candidate)))
    .map(([, value]) => value)
    .filter(Boolean);
}

function firstValue(row: CsvRow, keys: string[]) {
  return valuesForKeys(row, keys)[0] ?? "";
}

function extractTerms(value: string) {
  const normalized = value.toLowerCase();
  const explicitTerms = normalized
    .split(/[|;,\n]/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);
  const phraseTerms = normalized.match(/[a-z0-9][a-z0-9' -]{2,}/g) ?? [];

  return [...new Set([...explicitTerms, ...phraseTerms])]
    .map((term) => term.replace(/\s+/g, " ").trim())
    .filter((term) => term.length >= 3)
    .slice(0, 16);
}

function normalizeInstructions(
  instructionText: string[],
  fact: string,
  kind: RuleKind
) {
  const sourceText = instructionText.length > 0 ? instructionText : [fact];
  const prefixByKind: Record<RuleKind, string> = {
    objection: "Handle objection",
    emotional: "Match emotional tone",
    personality: "Adapt personality",
    sales_stage: "Use sales stage",
    deal_stage: "Use deal stage",
    stage_detection: "Respect detected stage",
    state_engine: "Respect conversation state",
    memory_rule: "Use memory guidance",
    memory_block: "Use memory block",
    knowledge_fact: "Use relevant fact",
  };

  return sourceText
    .flatMap((value) => value.split(/\n|(?:\s-\s)/))
    .map((instruction) => compactText(instruction))
    .filter(Boolean)
    .map((instruction) => {
      if (instruction.length <= 180) {
        return instruction;
      }

      return `${prefixByKind[kind]}: ${instruction.slice(0, 160).trim()}.`;
    })
    .slice(0, 3);
}

function getRecentTranscript(
  recentConversationTurns: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
) {
  return recentConversationTurns
    .map((turn) => {
      if (typeof turn.content === "string") {
        return turn.content;
      }

      return "";
    })
    .join("\n")
    .toLowerCase();
}

function getObjectionType(rule: PlaybookRule | null): ObjectionType | null {
  if (!rule) {
    return null;
  }

  const label = `${rule.label} ${rule.category}`.toLowerCase();
  const matched = [
    "budget",
    "timing",
    "authority",
    "trust",
    "competitor",
  ].find((type) => label.includes(type));

  return (matched as ObjectionType | undefined) ?? "general";
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function countMatches(value: string, terms: string[]) {
  return terms.reduce((count, term) => {
    return value.includes(term) ? count + 1 : count;
  }, 0);
}

function createFallbackObjectionRule(
  type: ObjectionType,
  terms: string[],
  instructions: string[]
): PlaybookRule {
  return {
    id: `fallback:${type}`,
    kind: "objection",
    label: type,
    category: type,
    terms,
    stageTerms: [],
    instructions,
    fact: null,
  };
}
