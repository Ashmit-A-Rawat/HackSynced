import express from 'express';
import synthesisController from '../controllers/synthesisController.js';

const router = express.Router();

// Run synthesis for a pair
router.post('/run/:pairId', synthesisController.runSynthesis);

// Get synthesis result
router.get('/result/:pairId', synthesisController.getSynthesisResult);

// Get recent syntheses
router.get('/recent', synthesisController.getRecentSyntheses);

// Get synthesis statistics
router.get('/stats', synthesisController.getSynthesisStats);

// Find pairs ready for synthesis
router.get('/find-pairs', synthesisController.findPairsForSynthesis);

export default router;