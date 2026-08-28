import { GoogleGenAI } from '@google/genai';
import { validateAIResponse } from '../utils/validateAIResponse.js';
import { analyzeRequest as analyzeRequestRuleBased } from './requestAnalyzer.js';
import { getDepartmentForCategory } from '../utils/departmentMapper.js';
import { applySafetyOverride } from '../utils/safetyOverride.js';
import { getSlaHours, calculateDueAt } from '../utils/sla.js';

const ALLOWED_INTENTS = ['COMPLAINT', 'REQUEST', 'QUERY', 'EMERGENCY'];
const ALLOWED_CATEGORIES = [
  'MAINTENANCE',
  'ELECTRICAL',
  'PLUMBING',
  'IT',
  'HOSTEL',
  'ACADEMIC',
  'ADMINISTRATION',
  'ACCOUNTS',
  'DOCUMENT',
  'SECURITY',
  'OTHER'
];
const ALLOWED_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Helper to initialize GoogleGenAI client securely from process.env.GEMINI_API_KEY.
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY environment variable is missing or empty.');
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

/**
 * Test the Gemini API connection by making a minimal request.
 * Returns a clean object detailing status and model response.
 */
export async function testGeminiConnection() {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Respond with the exact word "PONG" if you are online and working.'
    });

    const reply = response.text ? response.text.trim() : '';

    return {
      success: true,
      status: 'REACHABLE',
      message: 'Gemini API connection test successful.',
      model: 'gemini-2.5-flash',
      reply
    };
  } catch (error) {
    let cleanErrorMessage = error.message || 'Unknown Gemini API error';
    if (cleanErrorMessage.includes('GEMINI_API_KEY') || cleanErrorMessage.includes('missing')) {
      cleanErrorMessage = 'GEMINI_API_KEY is missing or invalid in environment variables.';
    }

    return {
      success: false,
      status: 'UNREACHABLE',
      message: 'Gemini API connection failed.',
      error: cleanErrorMessage
    };
  }
}

/**
 * Analyzes request details using Gemini AI and returns structured JSON classification.
 *
 * @param {Object|string} requestData - Object with description, location, requesterName OR description string
 * @returns {Promise<Object>} Classified request JSON payload
 */
export async function analyzeRequestWithAI(requestData = {}) {
  const payload = typeof requestData === 'string' ? { description: requestData } : requestData;
  const { description = '', location = '', requesterName = '' } = payload;

  if (!description || !description.trim()) {
    throw new Error('Description is required for AI request analysis.');
  }

  try {
    const ai = getGeminiClient();

    const systemInstruction = `You are an expert AI Request Classifier for ResolveAI, a campus autonomous ticketing and resolution platform.
Your task is to analyze incoming campus support requests and classify them into structured JSON.

CLASSIFICATION RULES:
1. INTENT must be one of: ${ALLOWED_INTENTS.join(', ')}
   - EMERGENCY: Immediate severe danger, active electrical fire/sparking, gas leak, medical/security crisis.
   - COMPLAINT: Outages, broken appliances, noise, leaks, poor service, failures.
   - REQUEST: Requesting documents, certificates, access, permissions, software installation.
   - QUERY: Asking questions, fee inquiries, deadline questions, general information.

2. CATEGORY must be one of: ${ALLOWED_CATEGORIES.join(', ')}
   - ELECTRICAL: Wiring, sockets, power cuts, fans, lights, circuit breakers, sparks.
   - PLUMBING: Water leaks, pipe bursts, taps, toilets, drainage, no water supply.
   - IT: Wi-Fi, Ethernet, network outage, portal login, software, lab computers.
   - HOSTEL: Room allotment, furniture, bed, key/lock, mess food, hostel amenities.
   - ACADEMIC: Exam timetable, course registration, grades, faculty queries.
   - ACCOUNTS: Fee payments, receipts, refunds, scholarship disbursements.
   - DOCUMENT: Bonafide certificates, transcripts, ID cards, hall tickets.
   - SECURITY: Theft, lost items, unauthorized entry, campus safety.
   - ADMINISTRATION: General office paperwork, campus facilities, management.
   - MAINTENANCE: General civil maintenance, painting, carpentry, doors.
   - OTHER: Anything not fitting the above.

3. PRIORITY must be one of: ${ALLOWED_PRIORITIES.join(', ')}
   - CRITICAL: Active safety hazard (e.g. sparking socket), fire risk, exam blocker right before online test.
   - HIGH: Total water outage, block-wide Wi-Fi cut, urgent security breach.
   - MEDIUM: Single room socket repair, individual Wi-Fi drop, pending fee query, routine maintenance.
   - LOW: Non-urgent document request, general inquiry, feedback.

Carefully evaluate:
- Urgency and safety risk
- Number of people affected
- Academic impact (e.g. exams, assignment deadlines)

IMPORTANT CONSTRAINTS:
- Do NOT generate or include any "department" field.
- Return ONLY a valid, parseable JSON object matching the requested fields.

JSON Output Schema:
{
  "intent": "INTENT_ENUM",
  "category": "CATEGORY_ENUM",
  "subcategory": "string describing subcategory",
  "priority": "PRIORITY_ENUM",
  "priorityReason": "short explanation for assigned priority",
  "aiConfidence": number_between_0_and_1
}`;

    const promptText = `Analyze the following campus request:
Request Description: "${description.trim()}"
Location: "${location ? location.trim() : 'Unspecified'}"
Requester Name: "${requesterName ? requesterName.trim() : 'Student/Staff'}"`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
    let response = null;
    let lastError = null;

    for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
      const modelName = modelsToTry[attempt];
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            systemInstruction,
            responseMimeType: 'application/json'
          }
        });
        if (response && response.text) break;
      } catch (err) {
        lastError = err;
        const shortMsg = err.message ? (err.message.includes('429') || err.message.includes('quota') ? 'Quota/Rate Limit Reached' : 'API Service Unavailable') : 'Unknown Error';
        console.warn(`[AI Service] ${modelName} (${shortMsg}). Trying next model option...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('Gemini API quota/availability limit reached.');
    }

    const rawText = response.text ? response.text.trim() : '{}';
    const parsed = JSON.parse(rawText);

    // Validate and sanitize returned fields against allowed enums
    const validatedIntent = ALLOWED_INTENTS.includes(parsed.intent) ? parsed.intent : 'COMPLAINT';
    const validatedCategory = ALLOWED_CATEGORIES.includes(parsed.category) ? parsed.category : 'OTHER';
    const validatedPriority = ALLOWED_PRIORITIES.includes(parsed.priority) ? parsed.priority : 'MEDIUM';

    return {
      intent: validatedIntent,
      category: validatedCategory,
      subcategory: parsed.subcategory || 'General',
      priority: validatedPriority,
      priorityReason: parsed.priorityReason || 'Analyzed by Gemini AI based on context and urgency.',
      aiConfidence: typeof parsed.aiConfidence === 'number' ? parsed.aiConfidence : 0.95
    };
  } catch (error) {
    throw new Error(error.message.includes('quota') || error.message.includes('429') ? 'Gemini API Free-Tier Quota Limit Reached' : error.message);
  }
}

/**
 * Executes robust request analysis using Gemini AI with strict validation, safety override, department mapping, and SLA logic.
 *
 * @param {Object|string} requestData - Request payload
 * @param {boolean} forceFallback - Debug flag to force rule-based fallback
 * @returns {Promise<Object>} Complete analysis payload
 */
export async function getRobustRequestAnalysis(requestData, forceFallback = false) {
  const payload = typeof requestData === 'string' ? { description: requestData } : requestData;
  const { description = '', createdAt = new Date().toISOString() } = payload;

  let baseAnalysis;

  if (forceFallback) {
    console.warn('[AI Service] Forcing rule-based fallback analysis (Debug mode)');
    const fallback = analyzeRequestRuleBased(description);
    baseAnalysis = {
      ...fallback,
      analysisSource: 'RULE_BASED_FALLBACK',
      fallbackReason: 'Forced via debug flag'
    };
  } else {
    try {
      const rawAiResult = await analyzeRequestWithAI(payload);
      const validation = validateAIResponse(rawAiResult);

      if (validation.isValid) {
        baseAnalysis = {
          ...rawAiResult,
          analysisSource: 'GEMINI'
        };
      } else {
        console.warn('[AI Service] Gemini response validation failed. Falling back to rule-based analyzer.');
        const fallback = analyzeRequestRuleBased(description);
        baseAnalysis = {
          ...fallback,
          analysisSource: 'RULE_BASED_FALLBACK',
          fallbackReason: `Validation failed: ${validation.errors.join('; ')}`
        };
      }
    } catch (error) {
      console.warn(`[AI Service] ${error.message}. Seamlessly using Rule-Based Fallback Analyzer.`);
      const fallback = analyzeRequestRuleBased(description);
      baseAnalysis = {
        ...fallback,
        analysisSource: 'RULE_BASED_FALLBACK',
        fallbackReason: error.message
      };
    }
  }

  // 1. Apply Backend Safety Override Check
  const safety = applySafetyOverride(description, baseAnalysis.priority, baseAnalysis.priorityReason);
  
  const finalPriority = safety.priority;
  const finalPriorityReason = safety.priorityReason;

  // 2. Map Category to Department via Backend Matrix (Gemini does not control department)
  const deptInfo = getDepartmentForCategory(baseAnalysis.category);

  // 3. Calculate SLA Hours and Due At using SLA Utility (Gemini does not calculate SLA)
  const slaHours = getSlaHours(finalPriority);
  const dueAt = calculateDueAt(createdAt, slaHours).toISOString();

  return {
    intent: baseAnalysis.intent,
    category: baseAnalysis.category,
    subcategory: baseAnalysis.subcategory,
    priority: finalPriority,
    priorityReason: finalPriorityReason,
    department: deptInfo.departmentName,
    departmentId: deptInfo.departmentId,
    slaHours,
    dueAt,
    aiConfidence: baseAnalysis.aiConfidence,
    analysisSource: baseAnalysis.analysisSource,
    ...(baseAnalysis.fallbackReason ? { fallbackReason: baseAnalysis.fallbackReason } : {}),
    isSafetyOverride: safety.isSafetyOverride,
    ...(safety.matchedIndicator ? { safetyIndicator: safety.matchedIndicator } : {})
  };
}

/**
 * Placeholder / fallback request analyzer matching expected Phase 2 schema.
 */
export async function analyzeRequest(description) {
  console.warn('Gemini Service called.');
  return analyzeRequestRuleBased(description);
}
