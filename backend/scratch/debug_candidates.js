import { getRequests } from '../services/notionService.js';

function isSimilarLocation(loc1, loc2) {
  const l1 = (loc1 || '').toLowerCase().trim();
  const l2 = (loc2 || '').toLowerCase().trim();

  if (!l1 || !l2) return false;
  if (l1 === l2) return true;

  const keywords = ['block', 'hostel', 'lab', 'room', 'floor', 'library', 'office', 'canteen'];
  for (const kw of keywords) {
    const hasKw1 = l1.includes(kw);
    const hasKw2 = l2.includes(kw);
    if (hasKw1 && hasKw2) {
      const words1 = l1.split(/\s+/);
      const words2 = l2.split(/\s+/);
      const idx1 = words1.findIndex(w => w.includes(kw));
      const idx2 = words2.findIndex(w => w.includes(kw));
      const id1 = words1[idx1 + 1] || '';
      const id2 = words2[idx2 + 1] || '';
      if (id1 && id2 && id1 === id2) return true;
    }
  }

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

async function debugCandidates() {
  const category = 'PLUMBING';
  const location = 'ZoneA999_1787922708102';

  const activeRequests = await getRequests();
  const unresolvedRequests = activeRequests.filter(req => {
    const status = (req['Status'] || req.status || '').toUpperCase();
    const isUnresolved = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'SLA_BREACHED', 'ESCALATED'].includes(status);
    return isUnresolved;
  });

  const candidates = unresolvedRequests.filter(req => {
    const reqCategory = (req['Category'] || req.category || '').toUpperCase();
    const reqLocation = req['Location'] || req.location || '';
    const id = req['Request ID'] || req.Name || req.id;
    const match = isSimilarLocation(location, reqLocation);
    if (reqCategory === category) {
      console.log(`Checking ${id} | location: "${reqLocation}" | match: ${match}`);
    }
    return reqCategory === category && match;
  });

  console.log('Final Candidates list:', candidates.map(c => c['Request ID'] || c.Name));
}

debugCandidates();
