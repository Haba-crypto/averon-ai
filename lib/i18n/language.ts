"use client";

import { useEffect, useState } from "react";

export type Language = "en" | "ru";

const storageKey = "averon-language";
const languageChangeEvent = "averon-language-change";

const translations = {
  en: {
    active: "Active",
    activeAgents: "Active Agents",
    affected: "affected",
    aiAgentOwner: "AI agent owner",
    aiAgents: "AI Agents",
    aiOperationsStream: "AI Operations Stream",
    aiTriageCommand: "AI Triage Command",
    archived: "Archived",
    archiveSelected: "Archive Selected",
    approvals: "Approvals",
    approveSelected: "Approve Selected",
    assignment: "Assignment",
    awaitingApproval: "Awaiting Approval",
    blocked: "Blocked",
    close: "Close",
    completedRecently: "Completed Recently",
    confidence: "Confidence",
    conversations: "Conversations",
    coordinationPlan: "Coordination Plan",
    dashboardSubtitle:
      "One operating surface for attention, pipeline movement, and live AI workflow execution.",
    dashboardTitle: "AI Revenue Execution System",
    emptyQueue: "No work currently in this queue.",
    enterWorkspace: "Enter Workspace",
    escalated: "Escalated",
    escalateSelected: "Escalate Selected",
    executeSelected: "Execute Selected",
    executionQueue: "Execution Queue",
    executionRail: "Execution Rail",
    expectedImpact: "Expected Impact",
    filtersAiActive: "AI Active",
    filtersAll: "All",
    filtersHighRisk: "High Risk",
    filtersHotLeads: "Hot Leads",
    filtersNeedsHuman: "Needs Human",
    filtersObjections: "Objections",
    filtersWaiting: "Waiting",
    highestImpact: "Highest Impact",
    humanCommandSubtitle:
      "Direct AI revenue work from approval to delegated execution.",
    humanCommandTitle: "Human-In-The-Loop Command",
    intent: "Intent",
    latestAiContext: "Latest AI Context",
    latestEvent: "Latest event",
    latestRecommendation: "Latest operational recommendation",
    leads: "Leads",
    leadWorkQueue: "Lead Work Queue",
    live: "Live",
    liveSystemState: "Live System State",
    missionControl: "Mission Control",
    noAiEvent: "No AI event recorded yet.",
    openAgent: "Open Agent",
    openLeadQueue: "Open Lead Queue",
    operational: "Operational",
    ownership: "Ownership",
    primaryProblem: "Primary Problem",
    readyToExecute: "Ready To Execute",
    recentlyUpdated: "Recently updated",
    replacedRecommendation: "Replaced by newer recommendation",
    reviewExecutionQueue: "Review Execution Queue",
    revenueAccounts: "Revenue Accounts",
    revenueConversationInbox: "Revenue Conversation Inbox",
    runtimeMemoryActive: "Runtime memory active",
    searchLeads: "Search leads",
    selected: "Selected",
    stalled: "Stalled",
    status: "Status",
    statusReady: "ready",
    superseded: "Superseded",
    systemOperational: "System Operational",
    systemStatus: "System Status",
    tasks: "Tasks",
    temporalTelemetry: "What changed, why it matters",
    topPath: "Top Path",
    triageBrief: "Triage Brief",
    urgency: "Urgency",
    wait: "Wait",
    waiting: "waiting",
    whatIsAffected: "What Is Affected",
    whatToDo: "What To Do",
    why: "Why",
    whyEscalated: "Why AI escalated it",
    workflows: "workflows",
    working: "Working",
  },
  ru: {
    active: "Активно",
    activeAgents: "Активные агенты",
    affected: "затронуто",
    aiAgentOwner: "Ответственный AI-агент",
    aiAgents: "AI-агенты",
    aiOperationsStream: "Поток работы AI",
    aiTriageCommand: "Диалоги",
    archived: "В архиве",
    archiveSelected: "В архив",
    approvals: "Одобрения",
    approveSelected: "Одобрить",
    assignment: "Назначение",
    awaitingApproval: "Ждет одобрения",
    blocked: "Заблокировано",
    close: "Закрытие",
    completedRecently: "Недавно завершено",
    confidence: "Уверенность",
    conversations: "Диалоги",
    coordinationPlan: "План действий",
    dashboardSubtitle:
      "Единый экран для внимания, движения сделок и работы AI.",
    dashboardTitle: "Система выполнения revenue-задач",
    emptyQueue: "В этой очереди сейчас нет задач.",
    enterWorkspace: "Открыть рабочее место",
    escalated: "Передано человеку",
    escalateSelected: "Передать человеку",
    executeSelected: "Запустить",
    executionQueue: "Очередь выполнения",
    executionRail: "Рабочий поток",
    expectedImpact: "Ожидаемый эффект",
    filtersAiActive: "AI работает",
    filtersAll: "Все",
    filtersHighRisk: "Высокий риск",
    filtersHotLeads: "Горячие лиды",
    filtersNeedsHuman: "Нужен человек",
    filtersObjections: "Возражения",
    filtersWaiting: "Ожидание",
    highestImpact: "Главный объект",
    humanCommandSubtitle:
      "Управляйте AI-задачами от одобрения до запуска.",
    humanCommandTitle: "Командный центр оператора",
    intent: "Интент",
    latestAiContext: "Последний контекст AI",
    latestEvent: "Последнее событие",
    latestRecommendation: "Текущая рекомендация",
    leads: "Лиды",
    leadWorkQueue: "Очередь лидов",
    live: "В работе",
    liveSystemState: "Состояние системы",
    missionControl: "Mission Control",
    noAiEvent: "Событий AI пока нет.",
    openAgent: "Открыть агента",
    openLeadQueue: "Список лидов",
    operational: "Работает",
    ownership: "Владелец",
    primaryProblem: "Главная проблема",
    readyToExecute: "Готово к запуску",
    recentlyUpdated: "Недавно обновлено",
    replacedRecommendation: "Заменено новой рекомендацией",
    reviewExecutionQueue: "Открыть очередь",
    revenueAccounts: "Лиды",
    revenueConversationInbox: "Диалоги",
    runtimeMemoryActive: "Память активна",
    searchLeads: "Поиск лидов",
    selected: "Выбрано",
    stalled: "Застряло",
    status: "Статус",
    statusReady: "готово",
    superseded: "Заменено",
    systemOperational: "Система работает",
    systemStatus: "Статус системы",
    tasks: "Задачи",
    temporalTelemetry: "Что изменилось и почему это важно",
    topPath: "Главный путь",
    triageBrief: "Кратко по диалогу",
    urgency: "Срочность",
    wait: "Ожидание",
    waiting: "ждут",
    whatIsAffected: "Что затронуто",
    whatToDo: "Что делать",
    why: "Почему",
    whyEscalated: "Почему AI поднял задачу",
    workflows: "процессы",
    working: "Выполняется",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function translate(language: Language, en: string, ru: string) {
  return language === "ru" ? ru : en;
}

function readLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  const savedLanguage = window.localStorage.getItem(storageKey);

  return savedLanguage === "ru" ? "ru" : "en";
}

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    function handleLanguageChange() {
      setLanguageState(readLanguage());
    }

    handleLanguageChange();

    window.addEventListener(
      languageChangeEvent,
      handleLanguageChange
    );
    window.addEventListener("storage", handleLanguageChange);

    return () => {
      window.removeEventListener(
        languageChangeEvent,
        handleLanguageChange
      );
      window.removeEventListener("storage", handleLanguageChange);
    };
  }, []);

  function setLanguage(nextLanguage: Language) {
    window.localStorage.setItem(storageKey, nextLanguage);
    setLanguageState(nextLanguage);
    window.dispatchEvent(new Event(languageChangeEvent));
  }

  function t(key: TranslationKey) {
    return translations[language][key] || translations.en[key];
  }

  return {
    language,
    setLanguage,
    t,
  };
}
