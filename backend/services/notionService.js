import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

// Ensure Notion client is only instantiated if token is present
let notion = null;
if (process.env.NOTION_TOKEN && process.env.MOCK_NOTION !== 'true') {
  notion = new Client({ auth: process.env.NOTION_TOKEN });
}

// In-Memory Database for Mock Mode (Offline Testing)
const mockRequestsDb = [];
const mockActionLogsDb = [];
const mockDepartmentsDb = [
  {
    'Department ID': 'DEPT-MAINT',
    'Department Name': 'Maintenance',
    'Responsible Person': 'John Doe',
    'Email': 'maintenance@example.com',
    'Default SLA': 12,
    'Escalation Contact': 'Jane Smith',
    'Active': true
  },
  {
    'Department ID': 'DEPT-IT',
    'Department Name': 'IT Helpdesk',
    'Responsible Person': 'Alice Brown',
    'Email': 'it@example.com',
    'Default SLA': 24,
    'Escalation Contact': 'Bob White',
    'Active': true
  }
];

/**
 * Validate that all required Notion environment variables are present.
 */
function validateConfig() {
  if (process.env.MOCK_NOTION === 'true' || !process.env.NOTION_TOKEN) {
    process.env.MOCK_NOTION = 'true';
    return; // Bypass config validation in mock mode
  }

  const missing = [];
  if (!process.env.NOTION_TOKEN) missing.push('NOTION_TOKEN');
  if (!process.env.NOTION_REQUESTS_DATABASE_ID) missing.push('NOTION_REQUESTS_DATABASE_ID');
  if (!process.env.NOTION_ACTION_LOGS_DATABASE_ID) missing.push('NOTION_ACTION_LOGS_DATABASE_ID');
  if (!process.env.NOTION_DEPARTMENTS_DATABASE_ID) missing.push('NOTION_DEPARTMENTS_DATABASE_ID');

  if (missing.length > 0) {
    throw new Error(`Missing Notion configuration variables: ${missing.join(', ')}`);
  }

  if (!notion) {
    notion = new Client({ auth: process.env.NOTION_TOKEN });
  }
}

/**
 * Helper to construct Rich Text payload for Notion.
 */
function richText(content) {
  return [
    {
      text: {
        content: content || ''
      }
    }
  ];
}

/**
 * Helper to format property values according to schema type.
 */
function formatPropertyValue(propSchema, value) {
  if (!propSchema || value === undefined || value === null) return null;
  switch (propSchema.type) {
    case 'title':
      return { title: richText(String(value)) };
    case 'rich_text':
      return { rich_text: richText(String(value)) };
    case 'select':
      return { select: { name: String(value) } };
    case 'email':
      return { email: String(value) };
    case 'number':
      return { number: Number(value) };
    case 'date':
      return { date: { start: new Date(value).toISOString() } };
    case 'checkbox':
      return { checkbox: Boolean(value) };
    default:
      return null;
  }
}

/**
 * Helper to parse Notion property values cleanly.
 */
function parseProperties(properties) {
  const result = {};
  for (const [key, value] of Object.entries(properties)) {
    switch (value.type) {
      case 'title':
        result[key] = value.title.map(t => t.plain_text).join('');
        break;
      case 'rich_text':
        result[key] = value.rich_text.map(t => t.plain_text).join('');
        break;
      case 'select':
        result[key] = value.select ? value.select.name : null;
        break;
      case 'email':
        result[key] = value.email;
        break;
      case 'number':
        result[key] = value.number;
        break;
      case 'date':
        result[key] = value.date ? value.date.start : null;
        break;
      case 'checkbox':
        result[key] = value.checkbox;
        break;
      case 'unique_id':
        result[key] = value.unique_id ? (value.unique_id.prefix ? `${value.unique_id.prefix}-${value.unique_id.number}` : String(value.unique_id.number)) : null;
        break;
      default:
        result[key] = null;
    }
  }
  return result;
}

/**
 * Generate the next Request ID by querying the Requests database.
 * If empty, defaults to REQ-0001.
 */
export async function getNextRequestId() {
  validateConfig();

  if (process.env.MOCK_NOTION === 'true') {
    if (mockRequestsDb.length === 0) {
      return 'REQ-0001';
    }
    const ids = mockRequestsDb.map(r => {
      const match = (r['Request ID'] || r['Name'] || '').match(/REQ-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxVal = Math.max(...ids, 0);
    return `REQ-${String(maxVal + 1).padStart(4, '0')}`;
  }

  try {
    const dbSchema = await notion.databases.retrieve({ database_id: process.env.NOTION_REQUESTS_DATABASE_ID });
    const hasReqIdProp = !!(dbSchema.properties && dbSchema.properties['Request ID']);

    const queryOptions = {
      database_id: process.env.NOTION_REQUESTS_DATABASE_ID,
      page_size: 50
    };

    if (hasReqIdProp) {
      queryOptions.sorts = [
        {
          property: 'Request ID',
          direction: 'descending'
        }
      ];
    }

    const response = await notion.databases.query(queryOptions);

    if (!response || !response.results || response.results.length === 0) {
      return 'REQ-0001';
    }

    let maxNum = 0;
    for (const page of response.results) {
      const titleProp = Object.values(page.properties).find(p => p.type === 'title');
      const titleText = titleProp?.title?.[0]?.plain_text || '';
      const match = titleText.match(/REQ-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    if (maxNum > 0) {
      return `REQ-${String(maxNum + 1).padStart(4, '0')}`;
    }

    return 'REQ-0001';
  } catch (error) {
    console.warn('Warning generating next Request ID from Notion:', error.message);
    return 'REQ-0001';
  }
}

let requestsSchemaVerified = false;

/**
 * Ensure the Escalated At and Resolved At properties exist in the Requests Notion Database schema.
 */
export async function ensureRequestsSchema() {
  if (requestsSchemaVerified) return;
  if (process.env.MOCK_NOTION === 'true') {
    requestsSchemaVerified = true;
    return;
  }
  try {
    const db = await notion.databases.retrieve({ database_id: process.env.NOTION_REQUESTS_DATABASE_ID });
    const schemaProps = db.properties || {};
    const missingProps = {};

    if (!schemaProps['Escalated At']) {
      missingProps['Escalated At'] = { date: {} };
    }
    if (!schemaProps['Resolved At']) {
      missingProps['Resolved At'] = { date: {} };
    }

    if (Object.keys(missingProps).length > 0) {
      console.log('[Notion API] Adding missing properties to Requests database schema...', Object.keys(missingProps));
      await notion.databases.update({
        database_id: process.env.NOTION_REQUESTS_DATABASE_ID,
        properties: missingProps
      });
    }
    requestsSchemaVerified = true;
  } catch (err) {
    console.warn('Requests schema check warning (non-fatal):', err.message);
  }
}

/**
 * Create a new Request in Notion.
 */
export async function createRequest(requestData) {
  validateConfig();
  const {
    requestId,
    description,
    requesterName,
    requesterEmail,
    location,
    source = 'Manual',
    intent = null,
    category = 'OTHER',
    subcategory = '',
    priority = 'MEDIUM',
    priorityReason = '',
    department = 'Other',
    assignedTo = '',
    status = 'NEW',
    slaHours = 24,
    dueAt,
    aiConfidence = 0,
    incidentId = '',
    resolution = '',
    escalatedAt = null,
    resolvedAt = null
  } = requestData;

  const nowIso = new Date().toISOString();

  if (process.env.MOCK_NOTION === 'true') {
    const mockRecord = {
      notionPageId: `mock-page-${Date.now()}-${Math.random()}`,
      'Request ID': requestId,
      'Description': description,
      'Requester Name': requesterName,
      'Requester Email': requesterEmail,
      'Location': location,
      'Source': source,
      'Intent': intent,
      'Category': category,
      'Subcategory': subcategory,
      'Priority': priority,
      'Priority Reason': priorityReason,
      'Department': department,
      'Assigned To': assignedTo,
      'Status': status,
      'SLA Hours': Number(slaHours),
      'Due At': dueAt ? new Date(dueAt).toISOString() : null,
      'AI Confidence': Number(aiConfidence),
      'Incident ID': incidentId,
      'Resolution': resolution,
      'Escalated At': escalatedAt ? new Date(escalatedAt).toISOString() : null,
      'Resolved At': resolvedAt ? new Date(resolvedAt).toISOString() : null,
      'Created At': nowIso,
      'Updated At': nowIso
    };
    mockRequestsDb.push(mockRecord);
    return mockRecord;
  }

  try {
    await ensureRequestsSchema();
    // Dynamically retrieve database schema to map title and existing properties
    const dbSchema = await notion.databases.retrieve({ database_id: process.env.NOTION_REQUESTS_DATABASE_ID });
    const schemaProps = dbSchema.properties || {};
    
    // Find title property name (e.g. 'Request ID' or 'Name')
    const titleKey = Object.keys(schemaProps).find(key => schemaProps[key].type === 'title') || 'Request ID';

    const properties = {
      [titleKey]: { title: richText(requestId) }
    };

    // Safely add other properties if they exist in the target database schema
    if (schemaProps['Description']) properties['Description'] = { rich_text: richText(description) };
    if (schemaProps['Requester Name']) properties['Requester Name'] = { rich_text: richText(requesterName) };
    if (schemaProps['Requester Email']) properties['Requester Email'] = { email: requesterEmail || null };
    if (schemaProps['Location']) properties['Location'] = { rich_text: richText(location) };
    if (schemaProps['Source']) properties['Source'] = { select: { name: source } };
    if (schemaProps['Intent'] && intent) properties['Intent'] = { select: { name: intent } };
    if (schemaProps['Category']) properties['Category'] = { select: { name: category } };
    if (schemaProps['Subcategory']) properties['Subcategory'] = { rich_text: richText(subcategory) };
    if (schemaProps['Priority']) properties['Priority'] = { select: { name: priority } };
    if (schemaProps['Priority Reason']) properties['Priority Reason'] = { rich_text: richText(priorityReason) };
    if (schemaProps['Department']) properties['Department'] = { select: { name: department } };
    if (schemaProps['Assigned To']) properties['Assigned To'] = { rich_text: richText(assignedTo) };
    if (schemaProps['Status']) properties['Status'] = { select: { name: status } };
    if (schemaProps['SLA Hours']) properties['SLA Hours'] = { number: Number(slaHours) };
    if (schemaProps['Due At'] && dueAt) properties['Due At'] = { date: { start: new Date(dueAt).toISOString() } };
    if (schemaProps['AI Confidence']) properties['AI Confidence'] = { number: Number(aiConfidence) };
    if (schemaProps['Incident ID']) properties['Incident ID'] = { rich_text: richText(incidentId) };
    if (schemaProps['Resolution']) properties['Resolution'] = { rich_text: richText(resolution) };
    if (schemaProps['Escalated At'] && escalatedAt) properties['Escalated At'] = { date: { start: new Date(escalatedAt).toISOString() } };
    if (schemaProps['Resolved At'] && resolvedAt) properties['Resolved At'] = { date: { start: new Date(resolvedAt).toISOString() } };
    if (schemaProps['Created At']) properties['Created At'] = { date: { start: nowIso } };
    if (schemaProps['Updated At']) properties['Updated At'] = { date: { start: nowIso } };

    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_REQUESTS_DATABASE_ID },
      properties
    });

    return {
      notionPageId: response.id,
      ...parseProperties(response.properties)
    };
  } catch (error) {
    console.error('Error creating request in Notion:', error.message);
    throw new Error('Notion database operation failed: ' + error.message);
  }
}

/**
 * Get a specific Request by Request ID.
 */
export async function getRequest(requestId) {
  validateConfig();

  if (process.env.MOCK_NOTION === 'true') {
    const found = mockRequestsDb.find(r => r['Request ID'] === requestId);
    return found || null;
  }

  try {
    const dbSchema = await notion.databases.retrieve({ database_id: process.env.NOTION_REQUESTS_DATABASE_ID });
    const schemaProps = dbSchema.properties || {};
    const titleKey = Object.keys(schemaProps).find(key => schemaProps[key].type === 'title') || 'Request ID';

    const response = await notion.databases.query({
      database_id: process.env.NOTION_REQUESTS_DATABASE_ID,
      filter: {
        property: titleKey,
        title: {
          equals: requestId
        }
      },
      page_size: 1
    });

    if (response.results.length === 0) {
      const allRequests = await getRequests();
      const match = allRequests.find(r => r[titleKey] === requestId || r['Request ID'] === requestId || r['Name'] === requestId);
      return match || null;
    }

    const page = response.results[0];
    return {
      notionPageId: page.id,
      ...parseProperties(page.properties)
    };
  } catch (error) {
    console.error(`Error fetching request ${requestId} from Notion:`, error.message);
    try {
      const allRequests = await getRequests();
      const match = allRequests.find(r => r['Request ID'] === requestId || r['Name'] === requestId);
      return match || null;
    } catch (e) {
      throw new Error('Notion database query failed: ' + error.message);
    }
  }
}

/**
 * Get all requests.
 */
export async function getRequests() {
  validateConfig();

  if (process.env.MOCK_NOTION === 'true') {
    return [...mockRequestsDb].sort((a, b) => new Date(b['Created At']) - new Date(a['Created At']));
  }

  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_REQUESTS_DATABASE_ID,
      sorts: [
        {
          property: 'Created At',
          direction: 'descending'
        }
      ]
    });

    return response.results.map(page => ({
      notionPageId: page.id,
      ...parseProperties(page.properties)
    }));
  } catch (error) {
    console.error('Error listing requests from Notion:', error.message);
    throw new Error('Notion database query failed: ' + error.message);
  }
}

/**
 * Update a Request in Notion.
 */
export async function updateRequest(requestId, updates) {
  validateConfig();

  if (process.env.MOCK_NOTION === 'true') {
    const index = mockRequestsDb.findIndex(r => r['Request ID'] === requestId);
    if (index === -1) {
      throw new Error(`Request with ID ${requestId} not found`);
    }

    const current = mockRequestsDb[index];
    const updatedRecord = {
      ...current,
      'Updated At': new Date().toISOString()
    };

    if (updates.description !== undefined) updatedRecord['Description'] = updates.description;
    if (updates.requesterName !== undefined) updatedRecord['Requester Name'] = updates.requesterName;
    if (updates.requesterEmail !== undefined) updatedRecord['Requester Email'] = updates.requesterEmail;
    if (updates.location !== undefined) updatedRecord['Location'] = updates.location;
    if (updates.source !== undefined) updatedRecord['Source'] = updates.source;
    if (updates.intent !== undefined) updatedRecord['Intent'] = updates.intent;
    if (updates.category !== undefined) updatedRecord['Category'] = updates.category;
    if (updates.subcategory !== undefined) updatedRecord['Subcategory'] = updates.subcategory;
    if (updates.priority !== undefined) updatedRecord['Priority'] = updates.priority;
    if (updates.priorityReason !== undefined) updatedRecord['Priority Reason'] = updates.priorityReason;
    if (updates.department !== undefined) updatedRecord['Department'] = updates.department;
    if (updates.assignedTo !== undefined) updatedRecord['Assigned To'] = updates.assignedTo;
    if (updates.status !== undefined) updatedRecord['Status'] = updates.status;
    if (updates.slaHours !== undefined) updatedRecord['SLA Hours'] = Number(updates.slaHours);
    if (updates.dueAt !== undefined) updatedRecord['Due At'] = updates.dueAt ? new Date(updates.dueAt).toISOString() : null;
    if (updates.aiConfidence !== undefined) updatedRecord['AI Confidence'] = Number(updates.aiConfidence);
    if (updates.incidentId !== undefined) updatedRecord['Incident ID'] = updates.incidentId;
    if (updates.resolution !== undefined) updatedRecord['Resolution'] = updates.resolution;
    if (updates.escalatedAt !== undefined) updatedRecord['Escalated At'] = updates.escalatedAt ? new Date(updates.escalatedAt).toISOString() : null;
    if (updates.resolvedAt !== undefined) updatedRecord['Resolved At'] = updates.resolvedAt ? new Date(updates.resolvedAt).toISOString() : null;

    mockRequestsDb[index] = updatedRecord;
    return updatedRecord;
  }

  try {
    await ensureRequestsSchema();
    // 1. Find the page ID of the request
    const existing = await getRequest(requestId);
    if (!existing) {
      throw new Error(`Request with ID ${requestId} not found`);
    }

    const properties = {};
    
    if (updates.description !== undefined) properties['Description'] = { rich_text: richText(updates.description) };
    if (updates.requesterName !== undefined) properties['Requester Name'] = { rich_text: richText(updates.requesterName) };
    if (updates.requesterEmail !== undefined) properties['Requester Email'] = { email: updates.requesterEmail || null };
    if (updates.location !== undefined) properties['Location'] = { rich_text: richText(updates.location) };
    if (updates.source !== undefined) properties['Source'] = { select: { name: updates.source } };
    if (updates.intent !== undefined) properties['Intent'] = updates.intent ? { select: { name: updates.intent } } : { select: null };
    if (updates.category !== undefined) properties['Category'] = { select: { name: updates.category } };
    if (updates.subcategory !== undefined) properties['Subcategory'] = { rich_text: richText(updates.subcategory) };
    if (updates.priority !== undefined) properties['Priority'] = { select: { name: updates.priority } };
    if (updates.priorityReason !== undefined) properties['Priority Reason'] = { rich_text: richText(updates.priorityReason) };
    if (updates.department !== undefined) properties['Department'] = { select: { name: updates.department } };
    if (updates.assignedTo !== undefined) properties['Assigned To'] = { rich_text: richText(updates.assignedTo) };
    if (updates.status !== undefined) properties['Status'] = { select: { name: updates.status } };
    if (updates.slaHours !== undefined) properties['SLA Hours'] = { number: Number(updates.slaHours) };
    if (updates.dueAt !== undefined) properties['Due At'] = updates.dueAt ? { date: { start: new Date(updates.dueAt).toISOString() } } : { date: null };
    if (updates.aiConfidence !== undefined) properties['AI Confidence'] = { number: Number(updates.aiConfidence) };
    if (updates.incidentId !== undefined) properties['Incident ID'] = { rich_text: richText(updates.incidentId) };
    if (updates.resolution !== undefined) properties['Resolution'] = { rich_text: richText(updates.resolution) };
    if (updates.escalatedAt !== undefined) {
      properties['Escalated At'] = updates.escalatedAt ? { date: { start: new Date(updates.escalatedAt).toISOString() } } : { date: null };
    }
    if (updates.resolvedAt !== undefined) {
      properties['Resolved At'] = updates.resolvedAt ? { date: { start: new Date(updates.resolvedAt).toISOString() } } : { date: null };
    }
    
    // Always update the 'Updated At' timestamp
    properties['Updated At'] = { date: { start: new Date().toISOString() } };

    const response = await notion.pages.update({
      page_id: existing.notionPageId,
      properties
    });

    return {
      notionPageId: response.id,
      ...parseProperties(response.properties)
    };
  } catch (error) {
    console.error(`Error updating request ${requestId} in Notion:`, error.message);
    throw new Error('Notion database update failed: ' + error.message);
  }
}

/**
 * Generate the next Log ID by querying the Action Logs database.
 * If empty, defaults to LOG-0001.
 */
export async function getNextLogId() {
  validateConfig();

  if (process.env.MOCK_NOTION === 'true') {
    if (mockActionLogsDb.length === 0) {
      return 'LOG-0001';
    }
    const ids = mockActionLogsDb.map(l => {
      const match = (l['Log ID'] || l['Name'] || '').match(/LOG-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxVal = Math.max(...ids, 0);
    return `LOG-${String(maxVal + 1).padStart(4, '0')}`;
  }

  try {
    const dbSchema = await notion.databases.retrieve({ database_id: process.env.NOTION_ACTION_LOGS_DATABASE_ID });
    const schemaProps = dbSchema.properties || {};
    const titleKey = Object.keys(schemaProps).find(key => schemaProps[key].type === 'title') || 'Log ID';

    const response = await notion.databases.query({
      database_id: process.env.NOTION_ACTION_LOGS_DATABASE_ID,
      page_size: 100
    });

    if (response.results.length === 0) {
      return 'LOG-0001';
    }

    const ids = response.results.map(page => {
      const parsed = parseProperties(page.properties);
      const titleVal = parsed[titleKey] || '';
      const match = titleVal.match(/LOG-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });

    const maxVal = Math.max(...ids, 0);
    return `LOG-${String(maxVal + 1).padStart(4, '0')}`;
  } catch (error) {
    return `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

/**
 * Create an action log entry.
 */
let actionLogsSchemaVerified = false;

/**
 * Ensure all 7 required properties exist in the Action Logs Notion Database schema.
 */
async function ensureActionLogsSchema() {
  if (actionLogsSchemaVerified) return;
  try {
    const db = await notion.databases.retrieve({ database_id: process.env.NOTION_ACTION_LOGS_DATABASE_ID });
    const schemaProps = db.properties || {};
    const missingProps = {};

    const titlePropName = Object.keys(schemaProps).find(k => schemaProps[k].type === 'title') || 'Log ID';
    if (titlePropName !== 'Log ID') {
      missingProps[titlePropName] = { name: 'Log ID' };
    }
    if (!schemaProps['Request ID']) missingProps['Request ID'] = { rich_text: {} };
    if (!schemaProps['Action']) missingProps['Action'] = { select: {} };
    if (!schemaProps['Reason']) missingProps['Reason'] = { rich_text: {} };
    if (!schemaProps['Performed By']) missingProps['Performed By'] = { rich_text: {} };
    if (!schemaProps['Timestamp']) missingProps['Timestamp'] = { date: {} };
    if (!schemaProps['Result']) missingProps['Result'] = { select: {} };

    if (Object.keys(missingProps).length > 0) {
      await notion.databases.update({
        database_id: process.env.NOTION_ACTION_LOGS_DATABASE_ID,
        properties: missingProps
      });
    }
    actionLogsSchemaVerified = true;
  } catch (err) {
    console.warn('Action Logs schema check warning (non-fatal):', err.message);
  }
}

/**
 * Create an action log entry.
 */
export async function createActionLog(logData) {
  validateConfig();
  const {
    requestId,
    action,
    reason = '',
    performedBy = 'SYSTEM',
    result = 'SUCCESS'
  } = logData;

  const logId = logData.logId || await getNextLogId();
  const timestamp = new Date().toISOString();

  if (process.env.MOCK_NOTION === 'true') {
    const mockLog = {
      notionPageId: `mock-log-${Date.now()}-${Math.random()}`,
      'Log ID': logId,
      'Request ID': requestId,
      'Action': action,
      'Reason': reason,
      'Performed By': performedBy,
      'Timestamp': timestamp,
      'Result': result
    };
    mockActionLogsDb.push(mockLog);
    return mockLog;
  }

  try {
    await ensureActionLogsSchema();

    // Dynamically retrieve Action Logs database schema to adapt to existing columns
    const dbSchema = await notion.databases.retrieve({ database_id: process.env.NOTION_ACTION_LOGS_DATABASE_ID });
    const schemaProps = dbSchema.properties || {};

    // Find title property name (e.g. 'Log ID' or 'Name')
    const titleKey = Object.keys(schemaProps).find(key => schemaProps[key].type === 'title') || 'Log ID';

    const properties = {
      [titleKey]: { title: richText(logId) }
    };

    if (schemaProps['Request ID']) properties['Request ID'] = formatPropertyValue(schemaProps['Request ID'], requestId);
    if (schemaProps['Action']) properties['Action'] = formatPropertyValue(schemaProps['Action'], action);
    if (schemaProps['Reason']) properties['Reason'] = formatPropertyValue(schemaProps['Reason'], reason);
    if (schemaProps['Performed By']) properties['Performed By'] = formatPropertyValue(schemaProps['Performed By'], performedBy);
    if (schemaProps['Timestamp']) properties['Timestamp'] = formatPropertyValue(schemaProps['Timestamp'], timestamp);
    if (schemaProps['Result']) properties['Result'] = formatPropertyValue(schemaProps['Result'], result);

    // Clean up any null property values
    Object.keys(properties).forEach(k => {
      if (properties[k] === null) delete properties[k];
    });

    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_ACTION_LOGS_DATABASE_ID },
      properties
    });

    return {
      notionPageId: response.id,
      ...parseProperties(response.properties)
    };
  } catch (error) {
    console.warn('Action log creation warning (non-fatal):', error.message);
    return {
      notionPageId: null,
      'Log ID': logId
    };
  }
}

/**
 * Get action logs for a request or all logs.
 */
export async function getActionLogs(requestId = null) {
  validateConfig();

  if (process.env.MOCK_NOTION === 'true') {
    if (requestId) {
      return mockActionLogsDb.filter(l => l['Request ID'] === requestId);
    }
    return [...mockActionLogsDb];
  }

  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_ACTION_LOGS_DATABASE_ID,
      page_size: 100
    });

    const parsedLogs = response.results.map(page => ({
      notionPageId: page.id,
      ...parseProperties(page.properties)
    }));

    if (requestId) {
      return parsedLogs.filter(log => log['Request ID'] === requestId || log['Name'] === requestId || log['Log ID'] === requestId);
    }

    return parsedLogs;
  } catch (error) {
    console.error('Error fetching action logs from Notion:', error.message);
    return [];
  }
}

/**
 * Get all active departments.
 */
export async function getDepartments() {
  validateConfig();

  if (process.env.MOCK_NOTION === 'true') {
    return [...mockDepartmentsDb];
  }

  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DEPARTMENTS_DATABASE_ID,
      filter: {
        property: 'Active',
        checkbox: {
          equals: true
        }
      }
    });

    return response.results.map(page => ({
      notionPageId: page.id,
      ...parseProperties(page.properties)
    }));
  } catch (error) {
    console.error('Error fetching departments from Notion:', error.message);
    throw new Error('Notion database query failed: ' + error.message);
  }
}

/**
 * Create a new department record in Notion Departments database with duplicate prevention.
 */
export async function createDepartment(deptData) {
  validateConfig();
  const {
    id,
    name,
    responsiblePerson = 'Not Assigned',
    email = '',
    defaultSla = 24,
    escalationContact = 'Not Assigned',
    active = true
  } = deptData;

  if (process.env.MOCK_NOTION === 'true') {
    const existing = mockDepartmentsDb.find(d => (d['Department ID'] && d['Department ID'].toLowerCase() === id.toLowerCase()) || (d['Name'] && d['Name'].toLowerCase() === id.toLowerCase()));
    if (existing) {
      return { added: false, departmentId: id, name, reason: 'Duplicate found in mock database' };
    }
    const mockDept = {
      notionPageId: `mock-dept-${Date.now()}`,
      'Name': id,
      'Department ID': id,
      'Department Name': name,
      'Responsible Person': responsiblePerson,
      'Email': email,
      'Default SLA': Number(defaultSla),
      'Escalation Contact': escalationContact,
      'Active': active
    };
    mockDepartmentsDb.push(mockDept);
    return { added: true, departmentId: id, name, department: mockDept };
  }

  try {
    // 1. Fetch existing departments to check for duplicates
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DEPARTMENTS_DATABASE_ID
    });

    const existingPages = response.results.map(page => {
      const parsed = parseProperties(page.properties);
      return {
        notionPageId: page.id,
        id: parsed.Name || parsed['Department ID'] || '',
        name: parsed['Department Name'] || ''
      };
    });

    const duplicate = existingPages.find(d => 
      (d.id && d.id.toLowerCase() === id.toLowerCase()) || 
      (d.name && d.name.toLowerCase() === name.toLowerCase())
    );

    if (duplicate) {
      return { added: false, departmentId: id, name, reason: 'Duplicate found in Notion database' };
    }

    // 2. Map properties matching Notion schema
    const properties = {
      'Name': { title: richText(id) },
      'Department Name': { rich_text: richText(name) },
      'Responsible Person': { rich_text: richText(responsiblePerson) },
      'Email': { email: email || null },
      'Default SLA': { number: Number(defaultSla) },
      'Escalation Contact': { rich_text: richText(escalationContact) },
      'Active': { checkbox: Boolean(active) }
    };

    const newPage = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DEPARTMENTS_DATABASE_ID },
      properties
    });

    return {
      added: true,
      departmentId: id,
      name,
      notionPageId: newPage.id,
      ...parseProperties(newPage.properties)
    };
  } catch (error) {
    console.error(`Error creating department ${id} in Notion:`, error.message);
    throw new Error(`Failed to create department ${id}: ` + error.message);
  }
}

/**
 * Seed missing departments into Notion Departments database.
 */
export async function seedDepartments(departmentsList) {
  const results = [];
  for (const dept of departmentsList) {
    const res = await createDepartment(dept);
    results.push(res);
  }
  return results;
}
