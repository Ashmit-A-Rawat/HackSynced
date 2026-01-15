// backend/routes/agentRoutes.js
import express from 'express';
import agentController from '../controllers/agentController.js';

const router = express.Router();

// Support agent endpoint
router.get('/support', agentController.getSupportReasoning);

// Oppose agent endpoint
router.get('/oppose', agentController.getOpposeReasoning);

// Both agents endpoint
router.get('/both', agentController.getBothReasonings);

export default router;