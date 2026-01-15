import express from 'express';
import responseService from '../services/responseService.js';

const router = express.Router();

// Get all responses for a session
router.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const responses = await responseService.getResponsesBySession(sessionId);
        
        res.json({
            success: true,
            sessionId,
            count: responses.length,
            responses
        });
    } catch (error) {
        console.error('Error fetching responses:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get response pair (support + oppose) for a session
router.get('/pair/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const pair = await responseService.getResponsePair(sessionId);
        
        res.json({
            success: true,
            sessionId,
            hasSupport: !!pair.support,
            hasOppose: !!pair.oppose,
            responses: pair
        });
    } catch (error) {
        console.error('Error fetching response pair:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get responses ready for synthesis
router.get('/for-synthesis', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const responses = await responseService.getResponsesForSynthesis(limit);
        
        res.json({
            success: true,
            count: responses.length,
            responses
        });
    } catch (error) {
        console.error('Error fetching responses for synthesis:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Mark response as synthesized
router.patch('/:responseId/synthesized', async (req, res) => {
    try {
        const { responseId } = req.params;
        const response = await responseService.markAsSynthesized(responseId);
        
        res.json({
            success: true,
            message: 'Response marked as synthesized',
            response
        });
    } catch (error) {
        console.error('Error marking response as synthesized:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get a specific response by ID
router.get('/:responseId', async (req, res) => {
    try {
        const { responseId } = req.params;
        const Response = (await import('../models/AgentResponse.js')).default;
        const response = await Response.findById(responseId);
        
        if (!response) {
            return res.status(404).json({
                success: false,
                error: 'Response not found'
            });
        }
        
        res.json({
            success: true,
            response
        });
    } catch (error) {
        console.error('Error fetching response:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;