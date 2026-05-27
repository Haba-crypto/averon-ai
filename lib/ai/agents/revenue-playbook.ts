import type OpenAI from "openai";

import type { ConversationStrategy } from "@/lib/ai/agents/revenue-strategy";

export type ObjectionType =
  | "budget"
  | "timing"
  | "authority"
  | "trust"
  | "competitor";

export type PlaybookOverlay = {
  objectionType: ObjectionType | null;
  instructions: string[];
};

type SelectObjectionPlaybookOverlayInput = {
  latestMessage: string;
  recentConversationTurns: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  strategy: ConversationStrategy;
};

type ObjectionRule = {
  type: ObjectionType;
  terms: string[];
  instructions: string[];
};

const OBJECTION_RULES: ObjectionRule[] = [
  {
    type: "budget",
    terms: [
      "budget",
      "expensive",
      "too expensive",
      "cost too much",
      "too much",
      "can't afford",
      "cannot afford",
      "no money",
      "price is high",
    ],
    instructions: [
      "Acknowledge the cost concern briefly without discounting immediately.",
      "Reframe around business impact, then ask what budget range they had in mind.",
    ],
  },
  {
    type: "timing",
    terms: [
      "later",
      "not now",
      "no time",
      "busy",
      "next quarter",
      "next month",
      "too early",
      "circle back",
      "follow up later",
    ],
    instructions: [
      "Acknowledge timing briefly and avoid pushing too hard.",
      "Ask what event, deadline, or priority would make this worth revisiting.",
    ],
  },
  {
    type: "authority",
    terms: [
      "need approval",
      "ask my boss",
      "talk to my manager",
      "not my decision",
      "decision maker",
      "procurement",
      "legal needs",
      "board approval",
    ],
    instructions: [
      "Acknowledge the approval path and keep the prospect engaged.",
      "Ask who else needs to be involved and what they will care about most.",
    ],
  },
  {
    type: "trust",
    terms: [
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
    ],
    instructions: [
      "Acknowledge the need for confidence without becoming defensive.",
      "Offer a proof point at a high level, then ask what would reduce the risk for them.",
    ],
  },
  {
    type: "competitor",
    terms: [
      "competitor",
      "alternative",
      "already use",
      "using",
      "current vendor",
      "another vendor",
      "other solution",
      "happy with",
      "switched to",
    ],
    instructions: [
      "Acknowledge their current solution without criticizing it.",
      "Ask what they like about it and where it still falls short.",
    ],
  },
];

export function selectObjectionPlaybookOverlay({
  latestMessage,
  recentConversationTurns,
  strategy,
}: SelectObjectionPlaybookOverlayInput): PlaybookOverlay {
  const latest = latestMessage.toLowerCase();
  const recentTranscript = recentConversationTurns
    .map((turn) => {
      if (typeof turn.content === "string") {
        return turn.content;
      }

      return "";
    })
    .join("\n")
    .toLowerCase();

  const selectedRule = OBJECTION_RULES.map((rule, index) => {
    const latestMatches = countMatches(latest, rule.terms);
    const recentMatches = countMatches(recentTranscript, rule.terms);

    return {
      rule,
      index,
      score: latestMatches * 3 + recentMatches,
    };
  })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    })[0]?.rule;

  if (!selectedRule) {
    return {
      objectionType: null,
      instructions: [],
    };
  }

  if (
    strategy.stage !== "objection" &&
    strategy.ctaMode !== "resolve_objection" &&
    !includesAny(latest, selectedRule.terms)
  ) {
    return {
      objectionType: null,
      instructions: [],
    };
  }

  return {
    objectionType: selectedRule.type,
    instructions: selectedRule.instructions.slice(0, 3),
  };
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function countMatches(value: string, terms: string[]) {
  return terms.reduce((count, term) => {
    return value.includes(term) ? count + 1 : count;
  }, 0);
}
