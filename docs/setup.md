# Setup Guide - ResolveAI Backend (Phase 1)

This guide walks you through setting up and running the ResolveAI backend server locally.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- A [Notion account](https://www.notion.so/) to set up databases and integrations.

## Installation Steps

1. **Clone/Navigate to the workspace**:
   ```bash
   cd ResolveAI
   ```

2. **Navigate to the backend directory and install dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Configure Environment Variables**:
   - Duplicate `.env.example` and name the new file `.env`:
     ```bash
     cp .env.example .env
     ```
   - Open `.env` and fill in the values:
     - `NOTION_TOKEN`: Your Notion Internal Integration Token (Secret).
     - `NOTION_REQUESTS_DATABASE_ID`: The ID of your Notion "Requests" database.
     - `NOTION_DEPARTMENTS_DATABASE_ID`: The ID of your Notion "Departments" database.
     - `NOTION_ACTION_LOGS_DATABASE_ID`: The ID of your Notion "Action Logs" database.
     - `PORT`: Port to run the server on (default: `5000`).

## Running the Application

To start the server in development mode with auto-reload:
```bash
npm run dev
```

To start the server in production mode:
```bash
npm start
```

The server will start, listening on the port configured in `.env` (default is `http://localhost:5000`).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API Information / Status |
| `GET` | `/health` | Server Healthcheck |
| `POST` | `/api/requests` | Create a request (simulates AI analysis and creates Notion entries) |
| `GET` | `/api/requests` | List all requests |
| `GET` | `/api/requests/:id` | Fetch request by Request ID (e.g. `REQ-0001`) |
| `PATCH`| `/api/requests/:id` | Update request status, assignee, department, resolution |
| `GET` | `/api/analytics/overview` | Fetch analytics counts from Notion requests |
