import { GoogleGenAI } from '@google/genai';
import { createActionLog } from './notionService.js';

/**
 * Returns a fallback suggestion object in case AI services are unavailable or fail.
 */
function getFallbackSuggestions(request) {
  const category = request.Category || request.category || 'General Support';
  const desc = request.Description || request.description || '';
  return {
    summary: `Resolution recommendations for request ${request.id || 'REQ-xxxx'}`,
    possibleCause: `Underlying issue related to ${category}.`,
    suggestedActions: [
      `Review description: "${desc.substring(0, 80)}..."`,
      "Contact requester to gather additional details.",
      `Dispatch appropriate ${category} department personnel.`
    ],
    recommendedNextStep: "Assign to a specific staff member for manual assessment.",
    urgencyNote: `Verify urgency based on ticket description and location.`
  };
}

/**
 * Validates the structure of the AI Suggestions response.
 */
function validateSuggestions(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.summary !== 'string' || !data.summary.trim()) return false;
  if (typeof data.possibleCause !== 'string') return false;
  if (!Array.isArray(data.suggestedActions) || data.suggestedActions.some(s => typeof s !== 'string')) return false;
  if (typeof data.recommendedNextStep !== 'string') return false;
  if (typeof data.urgencyNote !== 'string') return false;
  return true;
}

/**
 * Generate suggestions using Groq API.
 */
async function generateWithGroq(request) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Groq key not configured.');
  }

  const prompt = getSuggestionsPrompt(request);
  const models = ['groq/compound-mini', 'groq/compound', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant helping a university maintenance/support desk resolve student complaints. Respond ONLY in valid JSON conforming strictly to the requested schema. Do not output markdown code blocks or wrapper text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) continue;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(content);
      if (validateSuggestions(parsed)) {
        return { data: parsed, source: 'GROQ' };
      }
    } catch (e) {
      console.warn(`Groq suggestion generation failed with model ${model}:`, e.message);
    }
  }

  throw new Error('All Groq models failed to return valid suggestions.');
}

/**
 * Generate suggestions using Gemini SDK.
 */
async function generateWithGemini(request) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini key not configured.');
  }

  const prompt = getSuggestionsPrompt(request);
  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          systemInstruction: 'You are an AI assistant helping a university maintenance/support desk resolve student complaints. Return resolution suggestions in structured JSON matching the requested schema. Recommendations only, do not assume physical work is finished.'
        }
      });

      const text = response.text;
      if (!text) continue;

      const parsed = JSON.parse(text);
      if (validateSuggestions(parsed)) {
        return { data: parsed, source: 'GEMINI' };
      }
    } catch (e) {
      console.warn(`Gemini suggestion generation failed with model ${model}:`, e.message);
    }
  }

  throw new Error('All Gemini models failed to return valid suggestions.');
}

/**
 * Construct Suggestions System Prompt.
 */
function getSuggestionsPrompt(request) {
  const reqId = request['Request ID'] || request['Name'] || request.id || 'REQ-xxxx';
  return `Analyze this student ticket and generate resolution suggestions:
Ticket Details:
- Request ID: ${reqId}
- Description: "${request.Description || request.description || ''}"
- Category: "${request.Category || request.category || ''}"
- Subcategory: "${request.Subcategory || request.subcategory || ''}"
- Priority: "${request.Priority || request.priority || ''}"
- Location: "${request.Location || request.location || ''}"
- Department: "${request.Department || request.department || ''}"
- Status: "${request.Status || request.status || ''}"
- Existing Resolution Notes: "${request.Resolution || request.resolution || ''}"

Generate a JSON response matching exactly this schema:
{
  "summary": "Brief summary of the issue (string)",
  "possibleCause": "Hypothetical cause of the problem (string)",
  "suggestedActions": ["Action item 1", "Action item 2", "Action item 3"],
  "recommendedNextStep": "Immediate recommended step (string)",
  "urgencyNote": "A note highlighting urgency or safety precautions (string)"
}

Do not include any explanation, code blocks, or markdown formatting. Respond with raw JSON only.`;
}

/**
 * Generates robust resolution suggestions for a request.
 * Falls back safely to default suggestions if AI services fail.
 *
 * @param {Object} request - Notion request object
 * @returns {Promise<Object>} Suggestions report containing AI data
 */
export async function getResolutionSuggestions(request) {
  const requestId = request['Request ID'] || request['Name'] || request.id || 'REQ-xxxx';
  let result = null;

  // Try Groq first
  if (process.env.GROQ_API_KEY) {
    try {
      result = await generateWithGroq(request);
    } catch (e) {
      console.warn('Groq suggestions unavailable. Trying Gemini...', e.message);
    }
  }

  // Try Gemini second
  if (!result && process.env.GEMINI_API_KEY) {
    try {
      result = await generateWithGemini(request);
    } catch (e) {
      console.warn('Gemini suggestions unavailable. Falling back to default suggestions...', e.message);
    }
  }

  // Fallback third
  if (!result) {
    result = {
      data: getFallbackSuggestions(request),
      source: 'RULE_BASED_FALLBACK'
    };
  }

  // Create audit log
  await createActionLog({
    requestId,
    action: 'AI_ANALYZED',
    reason: `AI resolution suggestions generated successfully. (Source: ${result.source})`,
    performedBy: 'GEMINI',
    result: 'SUCCESS'
  });

  return {
    ...result.data,
    suggestionsSource: result.source
  };
}
