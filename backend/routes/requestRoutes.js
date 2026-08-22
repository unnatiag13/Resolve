import express from 'express';
import * as requestController from '../controllers/requestController.js';

const router = express.Router();

// Request Routing
router.post('/', requestController.createRequest);
router.get('/', requestController.getRequests);
router.get('/:id', requestController.getRequestById);
router.patch('/:id', requestController.updateRequest);

export default router;
