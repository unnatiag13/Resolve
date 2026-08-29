import { Router } from 'express';
import { handleWebhook, verifyWebhook } from '../controllers/whatsappController.js';

const router = Router();

// Dedicated WhatsApp Webhook Endpoints
router.post('/webhook', handleWebhook);
router.get('/webhook', verifyWebhook);

export default router;
