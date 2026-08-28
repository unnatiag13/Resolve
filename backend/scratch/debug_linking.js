import { detectDuplicateRequest } from '../services/duplicateDetectionService.js';

async function debugDetect() {
  const result = await detectDuplicateRequest({
    category: 'PLUMBING',
    location: 'ZoneA999_1787922708102',
    description: 'Fitted faucet leak in bathroom.'
  });
  console.log('Duplicate Detection Result:', JSON.stringify(result, null, 2));
}

debugDetect();
