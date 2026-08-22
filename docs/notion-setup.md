# Notion Integration Setup Guide

This guide helps you set up the three required Notion databases and generate the credentials needed to connect the ResolveAI backend.

---

## Step 1: Create a Notion Integration

1. Go to the [Notion Developers Portal](https://www.notion.so/my-integrations).
2. Click **+ New integration**.
3. Fill in the basic information:
   - **Associated workspace**: Select the workspace where your databases will reside.
   - **Name**: `ResolveAI Internal Integration`
4. Set the **Capabilities** to allow:
   - Read content
   - Update content
   - Insert content
5. Click **Submit**.
6. Copy the **Internal Integration Token** (starts with `secret_...`). Keep this safe! This is your `NOTION_TOKEN` environment variable.

---

## Step 2: Create the Databases

In your Notion workspace, create three separate databases with the exact configurations below.

### 1. Requests Database
Create a database named **Requests** with the following properties:

| Property Name | Type | Description / Options |
|---|---|---|
| **Request ID** | **Title** | The unique identifier (e.g. `REQ-0001`) |
| **Description** | **Text** (Rich Text) | Details of the complaint |
| **Requester Name** | **Text** (Rich Text) | Name of the person making the request |
| **Requester Email**| **Email** | Email address of the requester |
| **Location** | **Text** (Rich Text) | Location details (e.g. `Hostel Block B`) |
| **Source** | **Select** | Options: `Web`, `WhatsApp`, `Google Form`, `Email`, `Manual` |
| **Intent** | **Select** | Options: `COMPLAINT`, `INQUIRY`, `FEEDBACK` |
| **Category** | **Select** | Options: `MAINTENANCE`, `ELECTRICAL`, `PLUMBING`, `IT`, `HOSTEL`, `ACADEMIC`, `ADMINISTRATION`, `ACCOUNTS`, `DOCUMENT`, `SECURITY`, `OTHER` |
| **Subcategory** | **Text** (Rich Text) | Specific subclass (e.g. `Water Supply`) |
| **Priority** | **Select** | Options: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| **Priority Reason**| **Text** (Rich Text) | Rationale for assigned priority |
| **Department** | **Select** | Options: `Maintenance`, `IT Helpdesk`, `Hostel Admin`, `Accounts`, `Academic Dept`, `Security`, `Other` |
| **Assigned To** | **Text** (Rich Text) | Name of the agent working on this request |
| **Status** | **Select** | Options: `NEW`, `TRIAGED`, `ASSIGNED`, `IN_PROGRESS`, `WAITING`, `SLA_BREACHED`, `ESCALATED`, `RESOLVED`, `VERIFIED`, `CLOSED` |
| **SLA Hours** | **Number** | Number of SLA hours (e.g., `12`) |
| **Due At** | **Date** | Deadline for resolving the request |
| **AI Confidence** | **Number** | Confidence level (0.0 to 1.0) |
| **Incident ID** | **Text** (Rich Text) | Associated incident identifier |
| **Resolution** | **Text** (Rich Text) | Description of how the issue was resolved |
| **Created At** | **Date** | Date and time request was created |
| **Updated At** | **Date** | Date and time request was last updated |

---

### 2. Action Logs Database
Create a database named **Action Logs** with the following properties:

| Property Name | Type | Description / Options |
|---|---|---|
| **Log ID** | **Title** | The unique identifier (e.g., `LOG-xxxx`) |
| **Request ID** | **Text** (Rich Text) | Reference to the Request ID |
| **Action** | **Select** | Options: `REQUEST_CREATED`, `AI_ANALYZED`, `PRIORITY_ASSIGNED`, `DEPARTMENT_ASSIGNED`, `STATUS_CHANGED`, `REMINDER_SENT`, `ESCALATED`, `RESOLVED`, `VERIFIED`, `CLOSED` |
| **Reason** | **Text** (Rich Text) | Reason/description of action performed |
| **Performed By** | **Text** (Rich Text) | Agent name, system, or AI agent name |
| **Timestamp** | **Date** | Date/Time of the action |
| **Result** | **Select** | Options: `SUCCESS`, `FAILED`, `PENDING` |

---

### 3. Departments Database
Create a database named **Departments** with the following properties:

| Property Name | Type | Description / Options |
|---|---|---|
| **Department ID** | **Title** | Unique code (e.g., `DEPT-MAINT`) |
| **Department Name**| **Text** (Rich Text) | Full name of the department (e.g., `Maintenance`) |
| **Responsible Person**| **Text** (Rich Text)| Name of the department lead |
| **Email** | **Email** | Contact email for dispatching issues |
| **Default SLA** | **Number** | Default SLA in hours |
| **Escalation Contact**| **Text** (Rich Text)| Supervisor contact |
| **Active** | **Checkbox** | Determines if department receives auto-assigns |

---

## Step 3: Connect Databases to the Integration

To allow your integration to read/write to the databases, you MUST share them with the integration:

1. Open the page/database in Notion.
2. Click **Share** (top-right corner).
3. Type the name of your integration (`ResolveAI Internal Integration`) in the search box.
4. Click **Invite**.
5. Repeat this for **all three databases** (Requests, Action Logs, and Departments).

---

## Step 4: Retrieve Database IDs

To find a database ID:
1. Open the database in Notion in full page view.
2. Copy the URL.
3. The database ID is the 32-digit alphanumeric string in the URL between your workspace name and the query parameter.
   - Example: `https://www.notion.so/workspace-name/8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d?v=...`
   - In this case, `8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d` is the database ID.
4. Assign these IDs to `NOTION_REQUESTS_DATABASE_ID`, `NOTION_DEPARTMENTS_DATABASE_ID`, and `NOTION_ACTION_LOGS_DATABASE_ID` in your `.env` file.
