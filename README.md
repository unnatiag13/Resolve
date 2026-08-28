# 🤖 ResolveAI

### Autonomous Request Resolution & Escalation System

> **From "Complaint Received" to "Problem Resolved."**

**Team:** SHEAUTOMATES  
**Status:** 🚧 Prototype / Active Development  
**Stage:** Building Phase — Hackathon Prototype

---

## 🚨 The Problem

In colleges, hostels, societies, offices and other institutions, thousands of requests are reported every day:

- "There is no water in Hostel B."
- "The Wi-Fi has stopped working."
- "The classroom projector isn't working."
- "My document request is still pending."
- "The electricity problem hasn't been fixed."

The problem isn't always the lack of a reporting channel.

The real problem is what happens **after the complaint is submitted.**

Requests often get buried in:

- WhatsApp groups
- Emails
- Google Forms
- Spreadsheets
- Paper registers
- Informal conversations

As a result:

```text
Complaint
   ↓
Someone receives it
   ↓
Maybe someone assigns it
   ↓
Follow-up is forgotten
   ↓
SLA is missed
   ↓
User complains again
```
### The missing layer is accountability.

Most existing systems are designed to **record tickets**.

ResolveAI is being built to help **drive them toward resolution.**

---

# 💡 What is ResolveAI?

**ResolveAI is an AI-powered autonomous request management and resolution system.**

It takes an unstructured request written in natural language and transforms it into an actionable workflow.

Instead of simply storing:

> "Hostel B mein subah se paani nahi aa raha."

ResolveAI aims to understand:

```text
Intent       → Complaint
Category     → Plumbing
Location     → Hostel Block B
Priority     → High
Department   → Maintenance
SLA          → 12 Hours
Status       → Triaged
````

It then stores the request, tracks its lifecycle, and is designed to monitor unresolved requests and trigger appropriate follow-up or escalation actions.

---

# 🎯 Our Core Idea

ResolveAI follows one simple principle:

> **Don't just create a ticket. Make sure the ticket moves toward resolution.**

### Our Resolution Loop

```text
UNDERSTAND
     ↓
PRIORITIZE
     ↓
ASSIGN
     ↓
MONITOR
     ↓
REMIND
     ↓
ESCALATE
     ↓
RESOLVE
     ↓
VERIFY
     ↓
CLOSE
```

---

# 🧠 How ResolveAI Works

## 1. Request Comes In

A user submits a complaint through an available input channel.

Potential channels include:

* WhatsApp
* Web Form
* Google Form
* Email
* API

### Example

> "The projector in Lab 3 is not working and we have a presentation tomorrow."

---

## 2. AI Understands the Request

Gemini AI analyzes the natural-language request.

It extracts structured information such as:

```text
Intent
Category
Location
Priority
Department
Reason
Confidence
```

### Example

```text
Category      → IT / Equipment
Location      → Lab 3
Priority      → HIGH
Department    → IT Support
Reason        → Presentation scheduled tomorrow
```

---

## 3. Intelligent Triage

ResolveAI applies business rules along with AI analysis.

The system determines:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

The AI is not treated as the final authority.

Rule-based safeguards can override unsafe or inappropriate AI decisions.

### Example

```text
"Exposed electrical wire in Hostel B"
                ↓
             CRITICAL
```

This creates a safer **AI + deterministic rules** architecture.

---

# ⏱️ 4. SLA Calculation

Different problems require different response times.

ResolveAI calculates an expected resolution deadline based on priority and department.

### Example

| Priority | Example SLA |
| -------- | ----------- |
| LOW      | 72 hours    |
| MEDIUM   | 24 hours    |
| HIGH     | 12 hours    |
| CRITICAL | 4 hours     |

> The actual SLA configuration can be changed according to the organization.

---

# 🗃️ 5. Notion as Operational Memory

For the current prototype, **Notion is used as the operational database and system memory.**

ResolveAI maintains three core databases:

### 📋 Requests

Stores:

* Request ID
* Description
* Requester
* Location
* Category
* Priority
* Department
* Status
* SLA
* Due Date
* Resolution
* Incident ID

### 🏢 Departments

Stores:

* Department
* Responsible person
* Contact information
* Default SLA
* Escalation contact

### 📝 Action Logs

Records the request lifecycle:

```text
Request Created
      ↓
AI Analyzed
      ↓
Priority Assigned
      ↓
Department Assigned
      ↓
Reminder Sent
      ↓
Escalated
      ↓
Resolved
      ↓
Verified
      ↓
Closed
```

This creates a transparent **accountability trail**.

---

# 🤖 6. Autonomous Monitoring

One of the major goals of ResolveAI is to move beyond passive ticket management.

Instead of:

> "Ticket created. Good luck."

ResolveAI is designed to continuously monitor request states.

### Example

```text
Request Created
      ↓
Assigned to Maintenance
      ↓
SLA: 12 Hours
      ↓
No progress
      ↓
Reminder
      ↓
Still unresolved
      ↓
SLA Breach
      ↓
Escalation
```

The objective is to ensure that unresolved requests don't silently disappear.

---

# 🔎 7. Context & Incident Intelligence

A major future capability is understanding that multiple complaints may represent **one underlying problem**.

### Example

```text
REQ-001
"No water in Hostel B"

REQ-017
"Very low water pressure in Hostel B"

REQ-031
"No water supply since morning"
```

Instead of treating these as three unrelated tickets, ResolveAI can identify a possible common incident:

```text
             INCIDENT-001
                  │
          Water Supply Failure
                  │
        ┌─────────┼─────────┐
        ↓         ↓         ↓
     REQ-001   REQ-017   REQ-031
```

This can help institutions identify recurring infrastructure problems instead of repeatedly solving symptoms.

---

# ⭐ Key Features

## 🧠 AI-Powered Request Understanding

Converts natural-language complaints into structured, actionable requests.

## ⚡ Intelligent Triage + SLA Engine

Combines AI classification with deterministic business rules to prioritize requests and calculate deadlines.

## 🤖 Autonomous Monitoring & Escalation

Tracks unresolved requests and enables reminder and escalation workflows when SLAs are approaching or breached.

## 🔎 Context & Incident Intelligence

Identifies similar complaints and potential recurring incidents.

## 📋 Complete Accountability Trail

Records the complete lifecycle of a request from creation to closure.

---

# 🏗️ System Architecture

### Current Prototype Architecture

```text
                USER REQUEST
                     │
                     ▼
            ┌─────────────────┐
            │   Input Layer   │
            │ Web / API /     │
            │ Future WhatsApp │
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  Node.js API    │
            │    Express      │
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ Business Logic  │
            │ Validation      │
            │ SLA Rules       │
            └────────┬────────┘
                     │
              ┌──────┴───────┐
              │              │
              ▼              ▼
        ┌───────────┐   ┌────────────┐
        │  Gemini   │   │   Notion   │
        │ AI Layer  │   │ Operational│
        └─────┬─────┘   │   Memory   │
              │         └──────┬─────┘
              └────────┬──────┘
                       ▼
              Request Lifecycle
                       │
                       ▼
             Monitoring / Actions
                       │
                       ▼
             Reminder / Escalation
```

---

# 🛠️ Technology Stack

## Backend

* Node.js
* Express.js
* JavaScript / ES Modules

## AI

* Google Gemini API

### Used for:

* Natural-language understanding
* Request classification
* Priority reasoning
* Context extraction
* Future incident intelligence

## Operational Database

* Notion API
* Notion Databases

### Used for:

* Request storage
* Department information
* Action logs
* Operational memory

## Future Integrations

* WhatsApp
* Web Application
* Notification services
* Autonomous monitoring workers
* Admin dashboard

---

# 🔄 End-to-End Example

### 👤 User

> "Hostel B mein subah se paani nahi aa raha. Kal bhi complaint ki thi."

### 🤖 ResolveAI

```text
Natural Language
      ↓
AI Understanding
      ↓
────────────────────────────
Category: PLUMBING
Location: Hostel B
Priority: HIGH
Department: Maintenance
SLA: 12 Hours
────────────────────────────
      ↓
Notion Request Created
      ↓
Action Log Created
      ↓
Monitoring
      ↓
No Progress?
      ↓
Reminder
      ↓
Still No Progress?
      ↓
Escalation
```

The objective is to transform a simple message into a **managed resolution workflow**.

---

# 🔐 AI Safety & Reliability

ResolveAI is designed around a **hybrid AI + rules architecture**.

We do not blindly trust AI output.

The backend validates:

* Allowed categories
* Valid priorities
* Department mappings
* SLA rules
* Required fields
* Safety-critical conditions

This reduces the risk of an AI making an unreasonable operational decision.

---

# 📊 Why ResolveAI?

### Traditional Workflow

```text
REPORT
  ↓
STORE
  ↓
WAIT
```

### ResolveAI Vision

```text
REPORT
  ↓
UNDERSTAND
  ↓
PRIORITIZE
  ↓
ASSIGN
  ↓
MONITOR
  ↓
ESCALATE
  ↓
VERIFY
  ↓
RESOLVE
```

### The Difference

> **A ticketing system records work.**

> **ResolveAI is designed to drive work toward completion.**

---

# 🌍 Real-World Applications

Although the prototype focuses on institutional requests, the architecture can be adapted to:

## 🎓 Colleges & Universities

* Hostel complaints
* IT issues
* Academic requests
* Administrative requests
* Maintenance

## 🏢 Organizations

* Internal support requests
* IT helpdesk
* Facility management
* Employee requests

## 🏘️ Housing & Societies

* Plumbing
* Electrical
* Security
* Maintenance

## 🏥 Service Organizations

* Internal operational requests
* Facility issues
* Support workflows

## 🏪 Small Businesses

* Maintenance
* Supplier issues
* Operational requests

---

# 💰 Feasibility

ResolveAI is designed to be lightweight and deployable using modern cloud infrastructure.

### Prototype Infrastructure

```text
Frontend       → Future Phase
Backend        → Node.js / Express
AI             → Gemini
Database       → Notion
Input          → API / Web Form
```

The prototype can be developed with minimal infrastructure cost and can later migrate to dedicated databases and scalable infrastructure if required.

---

# 🚧 Current Status

## THIS IS CURRENTLY A PROTOTYPE

ResolveAI is **actively being built as a hackathon prototype.**

### Current Development Focus

```text
✅ System Architecture
✅ Notion Database Design
✅ Backend API
✅ Request Management
✅ SLA Logic

🔄 Gemini AI Integration
🔄 Autonomous Monitoring
🔄 Escalation Workflows
🔄 Incident Intelligence
🔄 WhatsApp Integration
🔄 Frontend Dashboard
```

> **Note:** Some features shown in the overall architecture represent the planned system vision and are not yet production-ready.

We intentionally follow an incremental development approach:

```text
PHASE 1
Backend + Notion
       ↓
PHASE 2
Gemini AI
       ↓
PHASE 3
Monitoring + Escalation
       ↓
PHASE 4
Incident Intelligence
       ↓
PHASE 5
WhatsApp Integration
       ↓
PHASE 6
Frontend + Admin Dashboard
```

---

# 🚀 Future Vision

The long-term goal is to evolve ResolveAI from a request management tool into an **autonomous operational resolution agent.**

### The Vision

> **A system that doesn't wait for humans to remember what needs to happen next.**

Instead, it continuously understands:

```text
What happened?
      ↓
Who should handle it?
      ↓
How urgent is it?
      ↓
When should it be resolved?
      ↓
Is anyone working on it?
      ↓
Is the SLA at risk?
      ↓
Who should be notified?
      ↓
Was the issue actually resolved?
```
