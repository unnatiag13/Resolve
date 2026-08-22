# Architecture Documentation - ResolveAI (Phase 1)

This document describes the architectural layers implemented in Phase 1 of ResolveAI, and describes how the future components (Gemini AI, WhatsApp, and monitoring daemons) will integrate in Phase 2.

---

## 1. Phase 1 Architecture (Implemented)

In Phase 1, we establish a robust request resolution pipeline connecting an Express API to Notion as the operational database. All request classifications and assignments are mocked.

### Request Flow Diagram
```
[User Request] 
      ↓
[Express API (server.js)] 
      ↓
[Request Routes (requestRoutes.js)]
      ↓
[Request Controller (requestController.js)]
      ↓
[SLA Utilities (sla.js)]  ← (SLA calculations & validations)
      ↓
[Notion Service (notionService.js)]
      ↓
[Notion Database (Requests, Action Logs, Departments)]
```

### Layer Breakdown

1. **Routing & Server Layer (`server.js`, `routes/`):**
   - Configures middleware (CORS, JSON Parser).
   - Maps URI patterns to controllers.
   - Houses the centralized error handling middleware to gracefully respond to clients.

2. **Controller Layer (`controllers/`):**
   - Validates incoming parameters (ensures non-empty fields, proper email formats).
   - Simulates analysis and structures the Notion document properties.
   - Coordinates multi-action writes (e.g. creating a Request and then logging events).

3. **Business Logic/Utilities Layer (`utils/`):**
   - Implements SLA thresholds (LOW = 72h, MEDIUM = 24h, HIGH = 12h, CRITICAL = 4h).
   - Calculates dynamic due dates (`Due At`).
   - Determines breach statuses.

4. **Database Abstraction / Integration Service (`services/`):**
   - Notion API connection client instantiation.
   - CRUD mappings (fetching next Request ID counter, writing action logs, filtering active departments).
   - Guarantees controllers are decoupled from raw Notion page layouts and object structures.

---

## 2. Phase 2 Architecture (Future State)

In Phase 2, ResolveAI will evolve into a fully autonomous request resolution agent. The architecture is designed to support modular insertion of incoming messaging webhooks, AI-driven understanding, and monitoring workers.

### Dynamic Pipeline Diagram
```
[WhatsApp Message] ────→ [WhatsApp Service (Evolution API)]
                                 ↓
[Web Form Submission] ─→ [Request Routing Controller]
                                 ↓
                         [Gemini AI Service] (Classifies intent, category, priority, department)
                                 ↓
                         [Business Rules Engine] (Validates or overrides suggestions)
                                 ↓
                         [Notion Database Service] (Writes Request & Action Logs)
                                 ↓
[SLA Monitoring Daemon] ← (Runs every 10m, triggers reminders / escalations / notifications)
```

### Implementation Hooks for Phase 2

- **Gemini AI Integration (`services/geminiService.js`):**
  - Will replace the mock analysis block in `requestController.js`.
  - Sends the raw user description to Gemini Pro with structured schema outputs (JSON) to detect Intent, Category, Subcategory, and suggest the responsible Department.
  
- **WhatsApp Webhook Receiver (`routes/whatsappRoutes.js`):**
  - Will receive webhook notifications from the Evolution API when students send complaints.
  - The webhook handler will parse the message text and sender's telephone number, routing it to the core controller just like a web form request.
  
- **Monitoring & Escalation Daemon (`cron` or background worker):**
  - A background process that checks the Requests database hourly for unresolved requests where `Due At` < `now`.
  - Marks status as `SLA_BREACHED` or `ESCALATED`, and dispatches escalation emails or WhatsApp notifications using `whatsappService.js`.
