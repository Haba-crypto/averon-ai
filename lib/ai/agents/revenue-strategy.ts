import type OpenAI from "openai";

import type { LeadRecord } from "@/lib/domain/leads/types";

export type ConversationStage =
  | "new"
  | "discovery"
  | "qualified"
  | "objection"
  | "demo_push"
  | "proposal"
  | "nurture";

export type ConversationPressure = "low" | "medium" | "high";

export type QualificationFocus =
  | "pain"
  | "scale"
  | "timing"
  | "authority"
  | "fit";

export type CtaMode =
  | "none"
  | "qualify"
  | "soft_next_step"
  | "direct_demo"
  | "resolve_objection";

export type ConversationStrategy = {
  stage: ConversationStage;
  pressure: ConversationPressure;
  qualificationFocus: QualificationFocus;
  ctaMode: CtaMode;
};

type StrategyInput = {
  lead: LeadRecord | null;
  latestMessage: string;
  recentConversationTurns: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
};

type QualificationDepth = {
  hasPain: boolean;
  hasOperationalDetail: boolean;
  hasImpact: boolean;
  hasCurrentState: boolean;
};

const OBJECTION_TERMS = [
  "later",
  "not now",
  "budget",
  "expensive",
  "cost",
  "too much",
  "no time",
  "not interested",
  "maybe later",
];

const HIGH_INTENT_TERMS = [
  "demo",
  "pricing",
  "price",
  "contract",
  "integration",
  "buy",
  "purchase",
  "next week",
];

const PAIN_TERMS = [
  "problem",
  "challenge",
  "pain",
  "fix",
  "stuck",
  "bottleneck",
  "manual",
  "slow",
  "delay",
  "delayed",
  "inconsistent",
  "leak",
  "leaking",
  "missed",
  "missing",
  "fall through",
  "falling through",
  "not converting",
  "low response",
  "can't keep up",
  "cannot keep up",
  "struggle",
  "hard to",
  "takes too long",
];

const OPERATIONAL_DETAIL_TERMS = [
  "workflow",
  "process",
  "handoff",
  "routing",
  "follow-up",
  "follow up",
  "response time",
  "speed to lead",
  "sdr",
  "sales team",
  "rep",
  "crm",
  "inbound",
  "outbound",
  "lead queue",
  "pipeline",
  "qualification",
  "volume",
  "team",
  "how many",
];

const IMPACT_TERMS = [
  "revenue",
  "cost",
  "expensive",
  "waste",
  "wasted",
  "lost",
  "losing",
  "churn",
  "conversion",
  "pipeline",
  "quota",
  "roi",
  "hours",
  "time",
  "delay",
  "delays",
  "money",
  "headcount",
  "sla",
];

const CURRENT_STATE_TERMS = [
  "currently",
  "today",
  "right now",
  "using",
  "we use",
  "we have",
  "hubspot",
  "salesforce",
  "crm",
  "spreadsheet",
  "manual",
  "agency",
  "vendor",
  "tool",
  "system",
  "process",
  "team",
  "rep",
];

export function deriveConversationStrategy({
  lead,
  latestMessage,
  recentConversationTurns,
}: StrategyInput): ConversationStrategy {
  const latest = latestMessage.toLowerCase();
  const transcript = recentConversationTurns
    .map((turn) => {
      if (typeof turn.content === "string") {
        return turn.content;
      }

      return "";
    })
    .join("\n")
    .toLowerCase();

  const status = lead?.status?.toLowerCase() ?? "new";
  const intentScore = lead?.intent_score ?? 0;
  const closeProbability = lead?.close_probability ?? 10;
  const urgency = lead?.urgency?.toLowerCase() ?? "low";
  const dealRisk = lead?.deal_risk?.toLowerCase() ?? "low";
  const highIntent = includesAny(latest, HIGH_INTENT_TERMS);
  const hasObjection =
    includesAny(latest, OBJECTION_TERMS) ||
    dealRisk === "medium" ||
    dealRisk === "high";
  const repeatedObjection =
    countMatches(transcript, OBJECTION_TERMS) > 1 &&
    hasObjection;
  const qualificationDepth = deriveQualificationDepth(
    `${transcript}\n${latest}`
  );

  const stage = deriveStage({
    status,
    intentScore,
    closeProbability,
    highIntent,
    hasObjection,
    qualificationDepth,
  });
  const pressure = derivePressure({
    stage,
    intentScore,
    closeProbability,
    urgency,
    highIntent,
    repeatedObjection,
  });

  return {
    stage,
    pressure,
    qualificationFocus: deriveQualificationFocus({
      latest,
      transcript,
      stage,
    }),
    ctaMode: deriveCtaMode({
      stage,
      pressure,
      highIntent,
      hasObjection,
      qualificationDepth,
    }),
  };
}

function deriveStage({
  status,
  intentScore,
  closeProbability,
  highIntent,
  hasObjection,
  qualificationDepth,
}: {
  status: string;
  intentScore: number;
  closeProbability: number;
  highIntent: boolean;
  hasObjection: boolean;
  qualificationDepth: QualificationDepth;
}): ConversationStage {
  if (hasObjection) {
    return "objection";
  }

  if (
    status.includes("proposal") ||
    status.includes("demo_scheduled")
  ) {
    return "proposal";
  }

  if (
    hasStrongQualificationDepth(qualificationDepth) &&
    (highIntent || intentScore >= 45 || closeProbability >= 55)
  ) {
    return "demo_push";
  }

  if (
    status.includes("qualified") ||
    intentScore >= 25 ||
    (highIntent && hasMeaningfulQualificationDepth(qualificationDepth))
  ) {
    return "qualified";
  }

  if (status.includes("contacted") || intentScore > 0) {
    return "discovery";
  }

  if (status.includes("nurture")) {
    return "nurture";
  }

  return "new";
}

function derivePressure({
  stage,
  intentScore,
  closeProbability,
  urgency,
  highIntent,
  repeatedObjection,
}: {
  stage: ConversationStage;
  intentScore: number;
  closeProbability: number;
  urgency: string;
  highIntent: boolean;
  repeatedObjection: boolean;
}): ConversationPressure {
  if (
    repeatedObjection ||
    highIntent ||
    urgency === "high" ||
    intentScore >= 45 ||
    closeProbability >= 55 ||
    stage === "demo_push"
  ) {
    return "high";
  }

  if (
    urgency === "medium" ||
    intentScore >= 20 ||
    closeProbability >= 30 ||
    stage === "qualified" ||
    stage === "objection"
  ) {
    return "medium";
  }

  return "low";
}

function deriveQualificationFocus({
  latest,
  transcript,
  stage,
}: {
  latest: string;
  transcript: string;
  stage: ConversationStage;
}): QualificationFocus {
  if (
    stage === "proposal" ||
    includesAny(latest, ["who decides", "decision", "approve"])
  ) {
    return "authority";
  }

  if (includesAny(latest, ["when", "timeline", "next week", "later"])) {
    return "timing";
  }

  if (includesAny(latest, ["team", "scale", "volume", "how many"])) {
    return "scale";
  }

  if (!includesAny(transcript, ["problem", "challenge", "pain", "fix"])) {
    return "pain";
  }

  if (!includesAny(transcript, ["team", "scale", "volume", "how many"])) {
    return "scale";
  }

  if (!includesAny(transcript, ["when", "timeline", "this month", "later"])) {
    return "timing";
  }

  return "fit";
}

function deriveCtaMode({
  stage,
  pressure,
  highIntent,
  hasObjection,
  qualificationDepth,
}: {
  stage: ConversationStage;
  pressure: ConversationPressure;
  highIntent: boolean;
  hasObjection: boolean;
  qualificationDepth: QualificationDepth;
}): CtaMode {
  if (hasObjection || stage === "objection") {
    return "resolve_objection";
  }

  if (
    highIntent &&
    !hasMeaningfulQualificationDepth(qualificationDepth)
  ) {
    return "qualify";
  }

  if (stage === "demo_push" || highIntent) {
    if (!hasStrongQualificationDepth(qualificationDepth)) {
      return "soft_next_step";
    }

    return "direct_demo";
  }

  if (stage === "qualified" && pressure !== "low") {
    return "soft_next_step";
  }

  if (stage === "new" || stage === "discovery") {
    return "qualify";
  }

  return "none";
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function countMatches(value: string, terms: string[]) {
  return terms.reduce((count, term) => {
    return value.includes(term) ? count + 1 : count;
  }, 0);
}

function deriveQualificationDepth(transcript: string): QualificationDepth {
  return {
    hasPain: includesAny(transcript, PAIN_TERMS),
    hasOperationalDetail: includesAny(
      transcript,
      OPERATIONAL_DETAIL_TERMS
    ),
    hasImpact: includesAny(transcript, IMPACT_TERMS),
    hasCurrentState: includesAny(transcript, CURRENT_STATE_TERMS),
  };
}

function hasMeaningfulQualificationDepth({
  hasPain,
  hasOperationalDetail,
  hasImpact,
}: QualificationDepth) {
  return hasPain && (hasOperationalDetail || hasImpact);
}

function hasStrongQualificationDepth({
  hasPain,
  hasOperationalDetail,
  hasImpact,
  hasCurrentState,
}: QualificationDepth) {
  return (
    hasPain &&
    hasOperationalDetail &&
    (hasImpact || hasCurrentState)
  );
}
