import { getRequests, updateRequest, createActionLog } from './notionService.js';
import { GoogleGenAI } from '@google/genai';

/**
 * Helper to generate the next unique Incident ID from existing requests in Notion.
 */
export async function getNextIncidentId() {
  try {
    const requests = await getRequests();
    let maxNum = 0;

    for (const req of requests) {
      const incId = req['Incident ID'] || req.incidentId;
      if (incId) {
        const match = incId.match(/INC-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    return `INC-${String(maxNum + 1).padStart(4, '0')}`;
  } catch (error) {
    console.warn('Error generating next Incident ID:', error.message);
    return 'INC-0001';
  }
}

/**
 * Check locations for similarity. Matches room numbers, block names, and building tags.
 */
function isSimilarLocation(loc1, loc2) {
  const l1 = (loc1 || '').toLowerCase().trim();
  const l2 = (loc2 || '').toLowerCase().trim();

  if (!l1 || !l2) return false;
  if (l1 === l2) return true;

  // Check building/block keywords (e.g. 'block b', 'hostel b', 'library')
  const keywords = ['block', 'hostel', 'lab', 'room', 'floor', 'library', 'office', 'canteen'];
  for (const kw of keywords) {
    const hasKw1 = l1.includes(kw);
    const hasKw2 = l2.includes(kw);
    if (hasKw1 && hasKw2) {
      // Extract specific block letter or room number (e.g., 'block b' -> 'b')
      const words1 = l1.split(/\s+/);
      const words2 = l2.split(/\s+/);
      
      // Look for matching alphanumeric identifiers following the keyword
      const idx1 = words1.findIndex(w => w.includes(kw));
      const idx2 = words2.findIndex(w => w.includes(kw));
      
      const id1 = words1[idx1 + 1] || '';
      const id2 = words2[idx2 + 1] || '';
      
      if (id1 && id2 && id1 === id2) return true;
    }
  }

  // Fallback: simple token intersection
  const tokens1 = new Set(l1.split(/[\s,.-]+/));
  const tokens2 = new Set(l2.split(/[\s,.-]+/));
  let intersectionCount = 0;
  for (const t of tokens1) {
    if (t.length > 2 && tokens2.has(t)) {
      intersectionCount++;
    }
  }

  return intersectionCount >= 2;
}

/**
 * Checks for semantic duplicates of an incoming request.
 *
 * @param {Object} newRequest - Request detail containing category, description, location
 * @param {string} newRequestId - Optional request ID to exclude from candidates
 * @returns {Promise<Object>} Object describing match type and parent request details
 */
export async function detectDuplicateRequest(newRequest, newRequestId = null) {
  const category = (newRequest.category || '').toUpperCase();
  const location = newRequest.location || '';
  const description = newRequest.description || '';

  const activeRequests = await getRequests();
  const unresolvedRequests = activeRequests.filter(req => {
    const id = req['Request ID'] || req.Name || req.id;
    if (newRequestId && id === newRequestId) return false;

    const status = (req['Status'] || req.status || '').toUpperCase();
    const isUnresolved = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'SLA_BREACHED', 'ESCALATED'].includes(status);
    return isUnresolved;
  });

  // 1. Filter candidates by category and location similarity to minimize AI load
  const candidates = unresolvedRequests.filter(req => {
    const reqCategory = (req['Category'] || req.category || '').toUpperCase();
    const reqLocation = req['Location'] || req.location || '';
    return reqCategory === category && isSimilarLocation(location, reqLocation);
  });

  if (candidates.length === 0) {
    return { matchType: 'NEW_INCIDENT', matchedRequest: null };
  }

  // 2. Perform semantic verification using AI
  if (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY) {
    const candidatesPrompt = candidates.map((c, i) => `Candidate ${i + 1}:
- Request ID: ${c['Request ID'] || c['Name'] || c.id}
- Description: "${c['Description'] || c.description}"`).join('\n\n');

    const prompt = `You are a ticket duplicate detector. Determine if the new request is a duplicate of any existing candidates.
New Request:
- Description: "${description}"

Candidates:
${candidatesPrompt}

Return a JSON object matching exactly this schema:
{
  "isDuplicate": boolean,
  "matchedRequestId": "Request ID of the match, or null if none",
  "confidence": number between 0 and 1
}

Criteria for duplicate: The descriptions must describe the exact same physical issue/problem occurring at the same place. If they describe different issues in the same building, they are not duplicates.
Do not output markdown code wrapper. Output JSON only.`;

    let contentText = null;
    let source = null;

    // Try Groq first
    if (process.env.GROQ_API_KEY) {
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
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: 'json_object' }
            })
          });

          if (response.ok) {
            const json = await response.json();
            contentText = json.choices?.[0]?.message?.content;
            if (contentText) {
              source = 'GROQ';
              break;
            }
          }
        } catch (e) {
          console.warn(`Groq duplicate check failed with model ${model}:`, e.message);
        }
      }
    }

    // Try Gemini second
    if (!contentText && process.env.GEMINI_API_KEY) {
      const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      for (const model of models) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              systemInstruction: 'You are a ticket duplicate detector. Compare descriptions and output JSON matching the requested schema.'
            }
          });

          if (response.text) {
            contentText = response.text;
            source = 'GEMINI';
            break;
          }
        } catch (e) {
          console.warn(`Gemini duplicate check failed with model ${model}:`, e.message);
        }
      }
    }

    try {
      if (contentText) {
        const parsed = JSON.parse(contentText);
        if (parsed.isDuplicate && parsed.matchedRequestId) {
          const matched = candidates.find(c => (c['Request ID'] || c['Name'] || c.id) === parsed.matchedRequestId);
          if (matched) {
            console.log(`[Duplicate Detector] Match found via ${source}: ${parsed.matchedRequestId} (Confidence: ${parsed.confidence})`);
            return {
              matchType: parsed.confidence > 0.85 ? 'CONFIRMED_DUPLICATE' : 'POSSIBLE_DUPLICATE',
              matchedRequest: matched
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Duplicate Detector] AI verification parsing failed, using keyword fallback:', err.message);
    }
  }

  // 3. Fallback: simple keyword Jaccard similarity
  const newTokens = new Set(description.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  for (const c of candidates) {
    const cDesc = c['Description'] || c.description || '';
    const cTokens = new Set(cDesc.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    let overlap = 0;
    for (const t of newTokens) {
      if (cTokens.has(t)) overlap++;
    }

    const similarity = overlap / Math.max(1, Math.min(newTokens.size, cTokens.size));
    if (similarity >= 0.6) {
      return {
        matchType: similarity >= 0.85 ? 'CONFIRMED_DUPLICATE' : 'POSSIBLE_DUPLICATE',
        matchedRequest: c
      };
    }
  }

  return { matchType: 'NEW_INCIDENT', matchedRequest: null };
}

/**
 * Detects duplicates and links requests under a shared Incident ID in Notion.
 *
 * @param {string} newRequestId - ID of the newly created request (e.g. REQ-0044)
 * @param {Object} newRequestData - Payload containing category, location, description
 */
export async function processRequestIncidentLinking(newRequestId, newRequestData) {
  const check = await detectDuplicateRequest({
    category: newRequestData.category,
    location: newRequestData.location,
    description: newRequestData.description
  }, newRequestId);

  if (check.matchType === 'CONFIRMED_DUPLICATE' || check.matchType === 'POSSIBLE_DUPLICATE') {
    const parent = check.matchedRequest;
    const parentId = parent['Request ID'] || parent['Name'] || parent.id;
    let incidentId = parent['Incident ID'] || parent.incidentId;

    // If parent request does not have an Incident ID, generate one and update parent request
    if (!incidentId) {
      incidentId = await getNextIncidentId();
      console.log(`[Incident Linker] Creating new Incident ID ${incidentId} for parent ticket ${parentId}`);
      await updateRequest(parentId, { incidentId });
      
      // Log Incident Assignment for Parent request
      await createActionLog({
        requestId: parentId,
        action: 'AI_ANALYZED',
        reason: `Parent incident group created with Incident ID: ${incidentId}.`,
        performedBy: 'SYSTEM',
        result: 'SUCCESS'
      });
    }

    // Link new request to the Incident ID
    console.log(`[Incident Linker] Linking duplicate ticket ${newRequestId} to Incident ID ${incidentId}`);
    await updateRequest(newRequestId, { incidentId });

    // Create duplicate Action Log
    await createActionLog({
      requestId: newRequestId,
      action: 'AI_ANALYZED',
      reason: `Request identified as a duplicate of ${parentId}. Linked to Incident ID: ${incidentId}.`,
      performedBy: 'SYSTEM',
      result: 'SUCCESS'
    });

    return { linked: true, incidentId, parentId, matchType: check.matchType };
  }

  return { linked: false, incidentId: null, parentId: null, matchType: 'NEW_INCIDENT' };
}
