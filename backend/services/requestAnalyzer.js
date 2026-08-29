import { getSlaHours } from '../utils/sla.js';

/**
 * Helper function to match keywords with proper word boundary isolation.
 * Prevents false substring matches (e.g. 'ac' matching inside 'replacement').
 * 
 * @param {string} text - Input text (description)
 * @param {string} keyword - Target keyword to search
 * @returns {boolean} True if matched as a whole word or phrase
 */
function isKeywordMatch(text, keyword) {
  const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i');
  return regex.test(text);
}

/**
 * Rule-based Request Analyzer for ResolveAI.
 * Analyzes request descriptions dynamically using keyword and rule matching.
 * 
 * @param {string} description - The student's complaint or inquiry text
 * @returns {Object} Analysis payload matching the schema:
 *   { intent, category, subcategory, priority, priorityReason, department, slaHours, aiConfidence, status }
 */
export function analyzeRequest(description = '') {
  const text = (description || '').toLowerCase();

  // 1. Intent Detection
  let intent = 'COMPLAINT';
  if (
    text.includes('?') ||
    text.startsWith('how') ||
    text.startsWith('what') ||
    text.startsWith('when') ||
    text.startsWith('where') ||
    text.startsWith('is there') ||
    text.includes('inquire') ||
    text.includes('inquiry')
  ) {
    intent = 'INQUIRY';
  } else if (
    text.includes('provide') ||
    text.includes('issue me') ||
    text.includes('request for') ||
    text.includes('need new') ||
    text.includes('apply for') ||
    text.includes('can i get')
  ) {
    intent = 'REQUEST';
  }

  // 2. Rule Definitions for Categories, Subcategories, Departments, Priorities, Reasons & Confidence
  const rules = [
    // --- Electrical Hazards & Power Issues ---
    {
      keywords: ['spark', 'sparking', 'smoke', 'short circuit', 'electrical shock', 'fire hazard', 'exposed wire'],
      category: 'ELECTRICAL',
      subcategory: 'Socket Repair',
      department: 'Maintenance',
      priority: 'CRITICAL',
      reason: 'Electrical sparking or hazards pose an immediate fire and electrical safety risk.',
      confidence: 0.95
    },
    {
      keywords: ['power', 'electricity', 'blackout', 'no power', 'power outage', 'outage', 'power cut', 'socket', 'outlet', 'bulb', 'light', 'fan', 'ac', 'air conditioner', 'fuse', 'breaker', 'switch', 'voltage'],
      category: 'ELECTRICAL',
      subcategory: 'Power Supply',
      department: 'Maintenance',
      priority: (text.includes('no power') || text.includes('blackout') || text.includes('outage') || text.includes('power cut')) ? 'HIGH' : 'MEDIUM',
      reason: (text.includes('no power') || text.includes('blackout') || text.includes('outage') || text.includes('power cut'))
        ? 'Power outage reported affecting facility operations.'
        : 'Electrical component or appliance failure reported.',
      confidence: 0.88
    },

    // --- Plumbing & Water Issues ---
    {
      keywords: ['no water', 'water outage', 'flooding', 'burst pipe', 'sewage overflow', 'sewage leak'],
      category: 'PLUMBING',
      subcategory: 'Water Supply',
      department: 'Maintenance',
      priority: (text.includes('flooding') || text.includes('sewage')) ? 'CRITICAL' : 'HIGH',
      reason: 'Water outage or flooding directly impacts essential hygiene and sanitation.',
      confidence: 0.92
    },
    {
      keywords: ['water', 'leak', 'leaking', 'tap', 'flush', 'toilet', 'sink', 'drain', 'drainage', 'shower', 'washroom', 'pipe', 'plumbing'],
      category: 'PLUMBING',
      subcategory: 'Leakage',
      department: 'Maintenance',
      priority: (text.includes('toilet') || text.includes('flush')) ? 'HIGH' : 'MEDIUM',
      reason: 'Plumbing fixture leakage requires maintenance intervention to prevent water damage.',
      confidence: 0.86
    },

    // --- IT & Network Issues ---
    {
      keywords: ['wifi', 'wi-fi', 'internet', 'network', 'connection', 'ethernet', 'router', 'no internet', 'slow internet'],
      category: 'IT_SERVICES',
      subcategory: 'WiFi & Internet',
      department: 'IT Helpdesk',
      priority: (text.includes('exam') || text.includes('no internet')) ? 'HIGH' : 'MEDIUM',
      reason: 'Network connectivity disruption affects student academic and operational tasks.',
      confidence: 0.90
    },
    {
      keywords: ['portal', 'login', 'password', 'moodle', 'erp', 'email', 'account', 'access', 'forgot password'],
      category: 'IT_SERVICES',
      subcategory: 'Login & Portal',
      department: 'IT Helpdesk',
      priority: 'MEDIUM',
      reason: 'Account access or portal authentication issue reported.',
      confidence: 0.88
    },
    {
      keywords: ['laptop', 'computer', 'pc', 'printer', 'projector', 'lab', 'monitor', 'keyboard', 'mouse', 'software'],
      category: 'IT_SERVICES',
      subcategory: 'Hardware & Lab',
      department: 'IT Helpdesk',
      priority: 'MEDIUM',
      reason: 'IT hardware or software failure in campus facility.',
      confidence: 0.85
    },

    // --- Infrastructure & Carpentry ---
    {
      keywords: ['locked out', 'cannot lock', 'broken door', 'door lock', 'lock broken', 'key stuck'],
      category: 'INFRASTRUCTURE',
      subcategory: 'Door & Lock',
      department: 'Maintenance',
      priority: 'HIGH',
      reason: 'Door lock issue compromises room security and access.',
      confidence: 0.90
    },
    {
      keywords: ['door', 'lock', 'key', 'desk', 'chair', 'table', 'bed', 'cupboard', 'almirah', 'furniture', 'window', 'glass', 'wall', 'ceiling'],
      category: 'INFRASTRUCTURE',
      subcategory: 'Furniture',
      department: 'Maintenance',
      priority: 'MEDIUM',
      reason: 'Infrastructure or furniture repair request.',
      confidence: 0.82
    },

    // --- Hostel & Mess ---
    {
      keywords: ['food poisoning', 'spoiled food', 'insects in food', 'unhygienic food', 'pest infestation', 'cockroach'],
      category: 'HOSTEL',
      subcategory: 'Mess Food',
      department: 'Hostel Management',
      priority: 'CRITICAL',
      reason: 'Severe food quality or sanitation issue poses an immediate student health hazard.',
      confidence: 0.92
    },
    {
      keywords: ['mess', 'food', 'meal', 'breakfast', 'lunch', 'dinner', 'canteen'],
      category: 'HOSTEL',
      subcategory: 'Mess Food',
      department: 'Hostel Management',
      priority: 'MEDIUM',
      reason: 'Mess food service or quality issue reported.',
      confidence: 0.84
    },
    {
      keywords: ['cleaning', 'clean', 'trash', 'dustbin', 'garbage', 'hygiene', 'sweeping', 'dirty', 'bedsheet', 'laundry', 'mattress'],
      category: 'HOSTEL',
      subcategory: 'Room Hygiene',
      department: 'Hostel Management',
      priority: 'MEDIUM',
      reason: 'Hostel room hygiene or housekeeping service request.',
      confidence: 0.85
    },
    {
      keywords: ['roommate', 'noise', 'loud music', 'disturbance', 'warden', 'hostel block', 'room allocation'],
      category: 'HOSTEL',
      subcategory: 'Hostel Amenities',
      department: 'Hostel Management',
      priority: 'LOW',
      reason: 'Hostel living condition or amenity concern.',
      confidence: 0.80
    },

    // --- Academic & Administration ---
    {
      keywords: ['fee', 'payment', 'receipt', 'scholarship', 'finance', 'challan', 'dues'],
      category: 'ACADEMIC_ADMIN',
      subcategory: 'Fee & Finance',
      department: 'Administration',
      priority: (text.includes('penalty') || text.includes('deadline')) ? 'HIGH' : 'MEDIUM',
      reason: 'Student financial or fee administration issue.',
      confidence: 0.88
    },
    {
      keywords: ['certificate', 'transcript', 'id card', 'identity card', 'document', 'mark sheet', 'degree', 'bonafide'],
      category: 'ACADEMIC_ADMIN',
      subcategory: 'Certificates & ID',
      department: 'Administration',
      priority: 'MEDIUM',
      reason: 'Administrative document or identity card issuance request.',
      confidence: 0.87
    },
    {
      keywords: ['library', 'bus', 'transport', 'shuttle', 'admission'],
      category: 'ACADEMIC_ADMIN',
      subcategory: 'General Inquiry',
      department: 'Administration',
      priority: 'LOW',
      reason: 'General administrative or campus facility query.',
      confidence: 0.80
    }
  ];

  // 3. Find First Matching Rule using Word Boundary Isolation
  let matchedRule = null;
  for (const rule of rules) {
    if (rule.keywords.some(kw => isKeywordMatch(text, kw))) {
      matchedRule = rule;
      break;
    }
  }

  // Fallback Rule for unmatched requests
  if (!matchedRule) {
    matchedRule = {
      category: 'GENERAL',
      subcategory: 'General Request',
      department: 'Maintenance',
      priority: 'MEDIUM',
      reason: 'Request categorized under general maintenance after rule processing.',
      confidence: 0.65
    };
  }

  // 4. Urgency Keyword Adjustments (if not already CRITICAL)
  let priority = matchedRule.priority;
  let priorityReason = matchedRule.reason;

  if (priority !== 'CRITICAL') {
    if (isKeywordMatch(text, 'urgent') || isKeywordMatch(text, 'immediately') || isKeywordMatch(text, 'emergency') || isKeywordMatch(text, 'asap')) {
      if (priority === 'LOW') priority = 'MEDIUM';
      else if (priority === 'MEDIUM') priority = 'HIGH';
      priorityReason += ' Priority elevated due to urgency keywords.';
    }
  }

  // 5. Calculate SLA Hours based on final priority
  const slaHours = getSlaHours(priority);

  return {
    intent,
    category: matchedRule.category,
    subcategory: matchedRule.subcategory,
    priority,
    priorityReason,
    department: matchedRule.department,
    slaHours,
    aiConfidence: matchedRule.confidence,
    status: 'TRIAGED'
  };
}
