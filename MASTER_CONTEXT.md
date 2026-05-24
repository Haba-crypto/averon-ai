# AVERON AI — COMPLETE FOUNDATION PACK

# 0. PROJECT VISION

## What AVERON AI Is

AVERON AI — autonomous AI sales infrastructure.

Это не chatbot.
Это не automation-конструктор.
Это AI-native communication operating system.

Система должна:
- вести клиента по воронке
- понимать контекст
- квалифицировать лидов
- удерживать память
- адаптировать коммуникацию
- управлять persuasion logic
- работать multi-channel
- координировать AI-агентов

---

# 1. CORE ARCHITECTURE

## High-Level System

Frontend (Next.js)
↓
API Layer
↓
AI Orchestration Layer
↓
Agent System
↓
Memory + Context Engine
↓
Database + Redis + Queues

---

# 2. RECOMMENDED STACK

## Frontend
- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- Framer Motion

## Backend
- Node.js
- TypeScript
- Supabase
- PostgreSQL
- Redis

## AI
- OpenAI APIs
- Claude APIs
- Embeddings
- Vector memory

## Infrastructure
- Vercel
- GitHub
- Cursor
- Sentry
- Upstash Redis

---

# 3. MONOREPO STRUCTURE

/apps
/web
/api

/packages
/ui
/shared
/types
/agents
/prompts
/memory
/orchestration
/analytics
/utils

/docs
/architecture
/business
/agents
/prompts
/db
/flows

/infrastructure
/scripts
/tests

---

# 4. REQUIRED DOCS

## Core

/MASTER_CONTEXT.md

/docs/business/overview.md
/docs/business/value-proposition.md

/docs/architecture/system.md
/docs/architecture/frontend.md
/docs/architecture/backend.md
/docs/architecture/security.md
/docs/architecture/queues.md

/docs/db/schema.md

/docs/prompts/
/docs/agents/
/docs/flows/

---

# 5. CURSOR SETUP

## Install
- Cursor
- GitHub Desktop or Git CLI
- Node.js LTS
- pnpm

---

## Cursor Rules Folder

.cursor/rules/

---

## Required Rule Files

architecture.mdc
coding-standards.mdc
frontend.mdc
backend.mdc
security.mdc
ai-behavior.mdc
refactor-policy.mdc

---

# 6. MASTER AI RULES

## AI Must Always

### Analyze first

### Plan before coding

### Preserve architecture

### Reuse abstractions

### Validate edge cases

### Self-review before final output

---

## AI Must Never

- generate random architecture
- create giant files
- duplicate logic
- ignore typing
- create hidden side effects
- bypass existing systems
- hardcode sensitive logic

---

# 7. CODING STANDARDS

## TypeScript Rules

### Forbidden
- any
- giant functions
- deep nesting
- duplicated logic
- magic numbers

### Required
- explicit typing
- modularity
- clean naming
- isolated business logic
- reusable services

---

## File Limits

### Components
< 250 lines

### Services
< 300 lines

### Utils
< 150 lines

---

# 8. DATABASE FOUNDATION

## Core Tables

### users

### organizations

### leads

### conversations

### messages

### memories

### prompts

### workflows

### channels

### events

### analytics

---

# 9. AI ORCHESTRATION SYSTEM

## Core Layers

### Prompt Router

### Context Manager

### Memory Manager

### Agent Router

### Response Validator

---

# 10. MULTI-AGENT SYSTEM

## Architect Agent

## Conversation Agent

## Qualification Agent

## Strategy Agent

## Memory Agent

## Audit Agent

---

# 11. MEMORY SYSTEM

## Memory Types

### Short-Term

### Long-Term

### Strategic

### Behavioral

---

# 12. FRONTEND FOUNDATION

## UI Philosophy

AVERON должен выглядеть:
- premium
- minimalistic
- futuristic
- enterprise-grade
- AI-native

---

# 13. BACKEND FOUNDATION

## Backend Philosophy

Backend должен быть:
- event-driven
- async-first
- scalable
- modular
- observable

---

# 14. QUEUE ARCHITECTURE

## Queues

### Message Queue

### AI Task Queue

### Follow-Up Queue

### Analytics Queue

### Retry Queue

---

# 15. SECURITY FOUNDATION

## Required

- auth validation
- RBAC
- rate limiting
- audit logging
- encrypted secrets
- secure API boundaries
- input validation

---

# 16. ANALYTICS SYSTEM

## Track

### lead conversion

### message effectiveness

### objection patterns

### AI performance

### latency

### token usage

### workflow efficiency

---

# 17. OBSERVABILITY

## Required

### Structured Logging

### Error Tracking

### Tracing

### Performance Metrics

### AI Metrics

---

# 18. TESTING STRATEGY

## Required

### Unit Tests

### Integration Tests

### API Tests

### Edge Case Tests

### Security Validation

---

# 19. DEVELOPMENT WORKFLOW

## Correct Workflow

### 1
Read MASTER_CONTEXT.

### 2
Read architecture docs.

### 3
Analyze current structure.

### 4
Create implementation plan.

### 5
Validate constraints.

### 6
Implement.

### 7
Self-review.

### 8
Refactor pass.

### 9
Audit pass.

---

# 20. FEATURE DEVELOPMENT TEMPLATE

## Before Coding

### What problem is solved?

### What systems are affected?

### What edge cases exist?

### What abstractions already exist?

### Can this scale?

---

# 21. GIT WORKFLOW

## Branch Naming

feature/lead-memory
fix/queue-retry
refactor/conversation-engine

---

## Commit Examples

feat: add memory persistence layer
fix: resolve async queue retry issue
refactor: modularize orchestration service

---

# 22. REFACTOR POLICY

## Refactor Immediately If

- files become too large
- duplication appears
- abstractions leak
- complexity increases
- dependencies become tangled

---

# 23. PROMPT ENGINEERING FOUNDATION

## Prompt Types

### System Prompts

### Planning Prompts

### Validation Prompts

### Task Prompts

---

# 24. LONG CONTEXT STRATEGY

## AI Must

- summarize large contexts
- preserve architectural decisions
- preserve critical business logic
- avoid unnecessary context pollution

---

# 25. RECOMMENDED DAILY WORKFLOW

## Morning

### Research
- architecture
- AI systems
- orchestration

---

## Development

### Small tasks only

### AI planning first

### Human approval second

### AI implementation third

---

## Evening

### Refactor

### Documentation

### Architecture review

---

# 26. FIRST 30 DAYS PLAN

## Week 1

### Setup repo

### Setup Cursor

### Create docs

### Create rules

### Create DB schema

---

## Week 2

### Auth

### Leads

### Conversations

### Memory foundation

---

## Week 3

### AI orchestration

### Prompt system

### Context manager

### Queues

---

## Week 4

### Frontend dashboard

### Analytics

### Monitoring

### Testing

---

# 27. REQUIRED RESEARCH TOPICS

## Architecture
- AI-native SaaS
- event-driven systems
- orchestration

---

## AI
- multi-agent systems
- memory systems
- prompt engineering
- context compression

---

## Infrastructure
- Redis queues
- observability
- distributed systems

---

# 28. MOST IMPORTANT RULE

AVERON нельзя разрабатывать хаотично.

Каждое решение должно:
- усиливать архитектуру
- улучшать масштабируемость
- уменьшать хаос
- повышать AI readability
- улучшать maintainability

---

# 29. FINAL ENGINEERING PRINCIPLE

AI не должен просто генерировать код.

AI должен:
- работать внутри системы
- соблюдать архитектуру
- сохранять стандарты
- усиливать проект
- предотвращать деградацию

Твоя задача как основателя:
не “вайбкодить”,
а строить AI-native engineering ecosystem.