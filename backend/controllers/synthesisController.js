import synthesisService from '../services/synthesisService.js';
import AgentResponse from '../models/AgentResponse.js';
import SynthesisResult from '../models/SynthesisResult.js';

class SynthesisController {
    async runSynthesis(req, res) {
        const startTime = Date.now();
        
        try {
            const { pairId } = req.params;
            
            if (!pairId) {
                return res.status(400).json({
                    success: false,
                    error: 'pairId parameter is required'
                });
            }
            
            console.log(`🔄 [API] POST /synthesis/run/${pairId} requested`);
            
            // Check if synthesis already exists
            const existingResult = await SynthesisResult.findOne({ synthesisPairId: pairId });
            if (existingResult) {
                console.log(`📋 Synthesis already exists for pair ${pairId}`);
                return res.json({
                    success: true,
                    message: 'Synthesis already exists',
                    result: existingResult.formatForFrontend(),
                    cached: true,
                    processingTime: 0
                });
            }
            
            // Run synthesis
            const result = await synthesisService.synthesizePair(pairId);
            
            res.json({
                success: true,
                message: 'Synthesis completed successfully',
                ...result,
                processingTime: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Synthesis API error:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime
            });
        }
    }

    async getSynthesisResult(req, res) {
        try {
            const { pairId } = req.params;
            
            const result = await synthesisService.getSynthesisResult(pairId);
            
            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Synthesis result not found'
                });
            }
            
            // Format for frontend
            const formattedResult = {
                id: result._id,
                synthesisPairId: result.synthesisPairId,
                verdict: result.verdict,
                confidence: result.confidence,
                confidencePercent: Math.round(result.confidence * 100),
                reasoning: result.reasoning,
                scores: result.mlScores,
                keyEvidence: result.keyEvidence,
                createdAt: result.createdAt,
                processingTime: result.processingMetrics?.totalTimeMs,
                supportResponse: result.supportResponseId ? {
                    id: result.supportResponseId._id,
                    agentType: result.supportResponseId.agentType,
                    reasoning: result.supportResponseId.geminiResponse?.reasoning?.substring(0, 500) + '...'
                } : null,
                opposeResponse: result.opposeResponseId ? {
                    id: result.opposeResponseId._id,
                    agentType: result.opposeResponseId.agentType,
                    reasoning: result.opposeResponseId.geminiResponse?.reasoning?.substring(0, 500) + '...'
                } : null
            };
            
            res.json({
                success: true,
                result: formattedResult
            });
            
        } catch (error) {
            console.error('Error fetching synthesis result:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getRecentSyntheses(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            
            const syntheses = await synthesisService.getRecentSyntheses(limit);
            
            res.json({
                success: true,
                syntheses,
                count: syntheses.length
            });
            
        } catch (error) {
            console.error('Error fetching recent syntheses:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getSynthesisStats(req, res) {
        try {
            const stats = await synthesisService.getSynthesisStats();
            
            res.json({
                success: true,
                stats
            });
            
        } catch (error) {
            console.error('Error fetching synthesis stats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async findPairsForSynthesis(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 20;
            
            // Find agent response pairs that haven't been synthesized yet
            const pairs = await AgentResponse.aggregate([
                {
                    $match: {
                        synthesisPairId: { $exists: true, $ne: null },
                        synthesisStatus: 'pending'
                    }
                },
                {
                    $group: {
                        _id: '$synthesisPairId',
                        responses: { $push: '$$ROOT' },
                        sessionId: { $first: '$sessionId' },
                        subject: { $first: '$subject' },
                        createdAt: { $max: '$createdAt' }
                    }
                },
                {
                    $match: {
                        $expr: { $eq: [{ $size: '$responses' }, 2] }
                    }
                },
                {
                    $project: {
                        pairId: '$_id',
                        sessionId: 1,
                        subject: 1,
                        createdAt: 1,
                        supportResponse: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: '$responses',
                                        as: 'response',
                                        cond: { $eq: ['$$response.agentType', 'support'] }
                                    }
                                },
                                0
                            ]
                        },
                        opposeResponse: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: '$responses',
                                        as: 'response',
                                        cond: { $eq: ['$$response.agentType', 'oppose'] }
                                    }
                                },
                                0
                            ]
                        }
                    }
                },
                { $sort: { createdAt: -1 } },
                { $limit: limit }
            ]);
            
            res.json({
                success: true,
                pairs: pairs.map(pair => ({
                    pairId: pair.pairId,
                    sessionId: pair.sessionId,
                    subject: pair.subject,
                    createdAt: pair.createdAt,
                    readyForSynthesis: true
                })),
                count: pairs.length
            });
            
        } catch (error) {
            console.error('Error finding synthesis pairs:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

export default new SynthesisController();