import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";

import { selectObjectionPlaybookOverlay } from "@/lib/ai/agents/revenue-playbook";
import { routeRevenueAgent } from "@/lib/ai/agents/revenue-router";
import { deriveConversationStrategy } from "@/lib/ai/agents/revenue-strategy";
import { getOpenAIClient } from "@/lib/ai/openai";
import { buildRevenueChatPrompt } from "@/lib/ai/prompts/revenue-chat";
import type { LeadRecord, RevenueAction } from "@/lib/domain/leads/types";

type RespondToLeadMessageInput = {
  supabase: SupabaseClient;
  leadId: string;
  message: string;
  organizationId: string;
};

type LeadUpdate = {
  intent_score: number;
  status: string;
  ai_notes: string;
  urgency: string;
  recommendation: string;
  deal_risk: string;
  close_probability: number;
};

type ConversationTurn = {
  role: string | null;
  message: string | null;
};

const RECENT_CONVERSATION_LIMIT = 10;

export async function respondToLeadMessage({
  supabase,
  leadId,
  message,
  organizationId,
}: RespondToLeadMessageInput) {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .single<LeadRecord>();

  if (leadError) {
    throw leadError;
  }

  const { error: userMessageError } = await supabase
    .from("conversations")
    .insert({
      lead_id: leadId,
      organization_id: organizationId,
      role: "user",
      message,
    });

  if (userMessageError) {
    throw userMessageError;
  }

  const activeAgent = routeRevenueAgent(message);
  const openai = getOpenAIClient();
  const recentConversationTurns =
    await loadRecentConversationTurns({
      supabase,
      leadId,
      organizationId,
    });
  const strategy = deriveConversationStrategy({
    lead,
    latestMessage: message,
    recentConversationTurns,
  });
  const playbookOverlay = selectObjectionPlaybookOverlay({
    latestMessage: message,
    recentConversationTurns,
    strategy,
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: buildRevenueChatPrompt({
          activeAgent,
          lead,
          strategy,
          playbookOverlay,
        }),
      },
      ...recentConversationTurns,
    ],
  });

  const reply =
    completion.choices?.[0]?.message?.content ||
    "No response";

  const { error: assistantMessageError } = await supabase
    .from("conversations")
    .insert({
      lead_id: leadId,
      organization_id: organizationId,
      role: "assistant",
      message: reply,
    });

  if (assistantMessageError) {
    throw assistantMessageError;
  }

  const actions: RevenueAction[] = [];

  async function logAction(action: RevenueAction) {
    actions.push(action);

    const { error } = await supabase.from("ai_events").insert({
      lead_id: leadId,
      organization_id: organizationId,
      type: action.type,
      message: action.message,
    });

    if (error) {
      throw error;
    }
  }

  const leadUpdate = await analyzeRevenueSignals({
    supabase,
    leadId,
    organizationId,
    lead,
    message,
    activeAgent,
    logAction,
  });

  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update(leadUpdate)
    .eq("id", leadId)
    .eq("organization_id", organizationId);

  if (leadUpdateError) {
    throw leadUpdateError;
  }

  const { data: updatedLead, error: updatedLeadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .single<LeadRecord>();

  if (updatedLeadError) {
    throw updatedLeadError;
  }

  await logAction({
    type: "memory",
    message: "AI memory updated",
  });

  await logAction({
    type: "agent",
    message: `${activeAgent} active`,
  });

  await logAction({
    type: "urgency",
    message: `Urgency level: ${leadUpdate.urgency}`,
  });

  await logAction({
    type: "probability",
    message: `Close probability: ${leadUpdate.close_probability}%`,
  });

  await logAction({
    type: "recommendation",
    message: leadUpdate.recommendation,
  });

  return {
    reply,
    activeAgent,
    lead: updatedLead,
    actions,
  };
}

async function loadRecentConversationTurns({
  supabase,
  leadId,
  organizationId,
}: {
  supabase: SupabaseClient;
  leadId: string;
  organizationId: string;
}): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("role, message")
    .eq("lead_id", leadId)
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(RECENT_CONVERSATION_LIMIT);

  if (error) {
    throw error;
  }

  return ((data ?? []) as ConversationTurn[])
    .reverse()
    .flatMap((turn) => {
      if (
        turn.role !== "user" &&
        turn.role !== "assistant"
      ) {
        return [];
      }

      if (!turn.message) {
        return [];
      }

      return [
        {
          role: turn.role,
          content: turn.message,
        },
      ];
    });
}

async function analyzeRevenueSignals({
  supabase,
  leadId,
  organizationId,
  lead,
  message,
  activeAgent,
  logAction,
}: {
  supabase: SupabaseClient;
  leadId: string;
  organizationId: string;
  lead: LeadRecord | null;
  message: string;
  activeAgent: string;
  logAction: (action: RevenueAction) => Promise<void>;
}): Promise<LeadUpdate> {
  const lower = message.toLowerCase();

  let intentScore = lead?.intent_score ?? 0;
  let status = lead?.status ?? "new";
  let aiNotes = lead?.ai_notes ?? "";
  let urgency = lead?.urgency ?? "low";
  let recommendation =
    lead?.recommendation ?? "Continue qualification.";
  let dealRisk = lead?.deal_risk ?? "low";
  let closeProbability = lead?.close_probability ?? 10;

  if (
    lower.includes("demo") ||
    lower.includes("pricing") ||
    lower.includes("integration")
  ) {
    intentScore += 15;
    closeProbability += 12;
    urgency = "high";
    status = "qualified";
    recommendation = "Schedule enterprise demo immediately.";
    aiNotes += "\nDetected high buying intent.";

    await logAction({
      type: "intent",
      message: "Detected high buying intent",
    });

    await logAction({
      type: "pipeline",
      message: "Pipeline moved to qualified",
    });

    const { error: taskError } = await supabase.from("tasks").insert({
      lead_id: leadId,
      organization_id: organizationId,
      title: "High-intent follow-up",
      description:
        "Lead requested demo/pricing/integration discussion.",
      priority: "high",
    });

    if (taskError) {
      throw taskError;
    }

    await logAction({
      type: "task",
      message: "Created high-intent follow-up task",
    });
  }

  if (
    lower.includes("enterprise") ||
    lower.includes("team") ||
    lower.includes("scale")
  ) {
    intentScore += 10;
    closeProbability += 8;
    urgency = "medium";
    recommendation = "Push enterprise expansion conversation.";
    aiNotes += "\nEnterprise expansion potential detected.";

    await logAction({
      type: "enterprise",
      message: "Enterprise expansion potential detected",
    });
  }

  if (
    lower.includes("later") ||
    lower.includes("not now") ||
    lower.includes("budget")
  ) {
    dealRisk = "medium";
    closeProbability -= 10;
    recommendation = "Address timing and budget objections.";

    await logAction({
      type: "risk",
      message: "Potential deal risk detected",
    });
  }

  if (activeAgent === "Research Agent") {
    aiNotes += "\nResearch agent activated.";

    await logAction({
      type: "research",
      message: "Research agent analyzing company intelligence",
    });
  }

  if (activeAgent === "Customer Success Agent") {
    recommendation = "Focus on onboarding and retention strategy.";

    await logAction({
      type: "cs",
      message: "Customer Success workflow activated",
    });
  }

  closeProbability = Math.max(
    5,
    Math.min(closeProbability, 95)
  );

  return {
    intent_score: intentScore,
    status,
    ai_notes: aiNotes,
    urgency,
    recommendation,
    deal_risk: dealRisk,
    close_probability: closeProbability,
  };
}
