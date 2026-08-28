import express from 'express';
import * as departmentController from '../controllers/departmentController.js';

const router = express.Router();

// GET all active departments
router.get('/', departmentController.getDepartments);

// GET requests for a specific department
router.get('/:departmentId/requests', departmentController.getDepartmentRequests);

// GET department overview/summary
router.get('/:departmentId/overview', departmentController.getDepartmentOverview);

export default router;
