import documentService from '../services/documentService.js';
import geminiService from '../services/geminiService.js';
import responseService from '../services/responseService.js';

class AgentController {
    async getSupportReasoning(req, res) {
        const apiStartTime = Date.now();
        
        try {
            console.log('🟡 [API] GET /support called with:', req.query);
            const { sessionId, evidenceId, subject } = req.query;
            
            if (!sessionId && !evidenceId) {
                return res.status(400).json({
                    success: false,
                    error: 'sessionId or evidenceId required'
                });
            }
            
            // Get evidence
            let evidence;
            if (evidenceId) {
                evidence = await documentService.getEvidenceById(evidenceId);
            } else {
                evidence = await documentService.getEvidenceBySessionId(sessionId);
            }

            if (!evidence) {
                return res.status(404).json({
                    success: false,
                    error: 'Evidence not found'
                });
            }

            // Format evidence for Gemini
            const evidenceContext = await documentService.getEvidenceForGemini(
                evidence.sessionId
            );

            // Get subject
            const reasoningSubject = subject || evidence.documentType || "the document's claims";
            const subjectSource = subject ? 'user_provided' : 'document_inferred';

            // Get support agent reasoning
            const geminiStartTime = Date.now();
            const geminiResult = await geminiService.getSupportAgentReasoning(
                evidenceContext, 
                reasoningSubject
            );
            const geminiTime = Date.now() - geminiStartTime;

            // Add processing time to result
            geminiResult.processingTime = geminiTime;

            // Save COMPLETE response to database
            const dbSaveStartTime = Date.now();
            const savedResponse = await responseService.saveGeminiResponse({
                sessionId: sessionId || evidence.sessionId,
                evidenceId: evidenceId || evidence._id.toString(),
                agentType: 'support',
                geminiResult,
                evidenceContext,
                evidenceStats: {
                    totalChunks: evidence.totalChunks,
                    evidenceChunksUsed: evidence.evidenceChunks.length,
                    averageRelevance: evidence.averageRelevanceScore
                },
                subject: reasoningSubject,
                subjectSource,
                processingMetrics: {
                    totalProcessingTimeMs: Date.now() - apiStartTime,
                    geminiApiTimeMs: geminiTime,
                    databaseSaveTimeMs: Date.now() - dbSaveStartTime
                }
            });

            const totalTime = Date.now() - apiStartTime;
            
            console.log(`✅ Support reasoning completed in ${totalTime}ms`);
            console.log(`   📊 Saved to DB with ID: ${savedResponse._id}`);
            console.log(`   🤖 Gemini model used: ${geminiResult.modelUsed}`);

            // Return response with ALL metadata
            res.json({
                success: true,
                agent: 'support',
                subject: reasoningSubject,
                reasoning: geminiResult.reasoning,
                isMock: geminiResult.isMock || false,
                timestamp: geminiResult.timestamp,
                responseId: savedResponse._id,
                metadata: {
                    geminiModel: geminiResult.modelUsed,
                    processingTime: totalTime,
                    geminiApiTime: geminiTime,
                    dbSaveTime: Date.now() - dbSaveStartTime,
                    citationCount: savedResponse.citationCount,
                    reasoningLength: savedResponse.reasoningLength
                },
                evidenceStats: {
                    totalChunks: evidence.totalChunks,
                    evidenceChunks: evidence.evidenceChunks.length,
                    averageRelevance: evidence.averageRelevanceScore
                }
            });

        } catch (error) {
            console.error('❌ Support agent error:', error);
            console.error('Stack trace:', error.stack);
            
            res.status(500).json({
                success: false,
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    async getOpposeReasoning(req, res) {
        const apiStartTime = Date.now();
        
        try {
            console.log('🟡 [API] GET /oppose called with:', req.query);
            const { sessionId, evidenceId, subject } = req.query;
            
            if (!sessionId && !evidenceId) {
                return res.status(400).json({
                    success: false,
                    error: 'sessionId or evidenceId required'
                });
            }
            
            // Get evidence
            let evidence;
            if (evidenceId) {
                evidence = await documentService.getEvidenceById(evidenceId);
            } else {
                evidence = await documentService.getEvidenceBySessionId(sessionId);
            }

            if (!evidence) {
                return res.status(404).json({
                    success: false,
                    error: 'Evidence not found'
                });
            }

            // Format evidence for Gemini
            const evidenceContext = await documentService.getEvidenceForGemini(
                evidence.sessionId || evidenceId
            );

            // Get subject
            const reasoningSubject = subject || evidence.documentType || "the document's claims";
            const subjectSource = subject ? 'user_provided' : 'document_inferred';

            // Get oppose agent reasoning
            const geminiStartTime = Date.now();
            const geminiResult = await geminiService.getOpposeAgentReasoning(
                evidenceContext, 
                reasoningSubject
            );
            const geminiTime = Date.now() - geminiStartTime;

            // Add processing time to result
            geminiResult.processingTime = geminiTime;

            // Save COMPLETE response to database
            const dbSaveStartTime = Date.now();
            const savedResponse = await responseService.saveGeminiResponse({
                sessionId: sessionId || evidence.sessionId,
                evidenceId: evidenceId || evidence._id.toString(),
                agentType: 'oppose',
                geminiResult,
                evidenceContext,
                evidenceStats: {
                    totalChunks: evidence.totalChunks,
                    evidenceChunksUsed: evidence.evidenceChunks.length,
                    averageRelevance: evidence.averageRelevanceScore
                },
                subject: reasoningSubject,
                subjectSource,
                processingMetrics: {
                    totalProcessingTimeMs: Date.now() - apiStartTime,
                    geminiApiTimeMs: geminiTime,
                    databaseSaveTimeMs: Date.now() - dbSaveStartTime
                }
            });

            const totalTime = Date.now() - apiStartTime;
            
            console.log(`✅ Oppose reasoning completed in ${totalTime}ms`);
            console.log(`   📊 Saved to DB with ID: ${savedResponse._id}`);

            // Return response
            res.json({
                success: true,
                agent: 'oppose',
                subject: reasoningSubject,
                reasoning: geminiResult.reasoning,
                isMock: geminiResult.isMock || false,
                timestamp: geminiResult.timestamp,
                responseId: savedResponse._id,
                metadata: {
                    geminiModel: geminiResult.modelUsed,
                    processingTime: totalTime,
                    geminiApiTime: geminiTime,
                    dbSaveTime: Date.now() - dbSaveStartTime,
                    citationCount: savedResponse.citationCount,
                    reasoningLength: savedResponse.reasoningLength
                },
                evidenceStats: {
                    totalChunks: evidence.totalChunks,
                    evidenceChunks: evidence.evidenceChunks.length,
                    averageRelevance: evidence.averageRelevanceScore
                }
            });

        } catch (error) {
            console.error('❌ Oppose agent error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getBothReasonings(req, res) {
        const apiStartTime = Date.now();
        
        try {
            console.log('🟡 [API] GET /both called with:', req.query);
            const { sessionId, evidenceId, subject } = req.query;
            
            if (!sessionId && !evidenceId) {
                return res.status(400).json({
                    success: false,
                    error: 'sessionId or evidenceId required'
                });
            }
            
            // Get evidence
            let evidence;
            if (evidenceId) {
                evidence = await documentService.getEvidenceById(evidenceId);
            } else {
                evidence = await documentService.getEvidenceBySessionId(sessionId);
            }

            if (!evidence) {
                return res.status(404).json({
                    success: false,
                    error: 'Evidence not found'
                });
            }

            // Format evidence for Gemini
            const evidenceContext = await documentService.getEvidenceForGemini(
                evidence.sessionId || evidenceId
            );

            // Get subject
            const reasoningSubject = subject || evidence.documentType || "the document's claims";
            const subjectSource = subject ? 'user_provided' : 'document_inferred';

            // Get both reasonings in parallel
            const geminiStartTime = Date.now();
            const [supportResult, opposeResult] = await Promise.all([
                geminiService.getSupportAgentReasoning(evidenceContext, reasoningSubject),
                geminiService.getOpposeAgentReasoning(evidenceContext, reasoningSubject)
            ]);
            const geminiTime = Date.now() - geminiStartTime;

            // Add processing times
            supportResult.processingTime = geminiTime;
            opposeResult.processingTime = geminiTime;

            // Save BOTH responses to database
            const dbSaveStartTime = Date.now();
            const savedResponses = await responseService.saveBothGeminiResponses(
                sessionId || evidence.sessionId,
                evidenceId || evidence._id.toString(),
                supportResult,
                opposeResult,
                evidenceContext,
                evidence,
                reasoningSubject
            );

            const totalTime = Date.now() - apiStartTime;
            
            console.log(`✅ Both reasonings completed in ${totalTime}ms`);
            console.log(`   📊 Support ID: ${savedResponses.support._id}`);
            console.log(`   📊 Oppose ID: ${savedResponses.oppose._id}`);

            // Return both responses
            res.json({
                success: true,
                subject: reasoningSubject,
                processingTime: totalTime,
                support: {
                    agent: 'support',
                    reasoning: supportResult.reasoning,
                    isMock: supportResult.isMock || false,
                    timestamp: supportResult.timestamp,
                    responseId: savedResponses.support._id,
                    metadata: {
                        geminiModel: supportResult.modelUsed,
                        reasoningLength: savedResponses.support.reasoningLength,
                        citationCount: savedResponses.support.citationCount
                    }
                },
                oppose: {
                    agent: 'oppose',
                    reasoning: opposeResult.reasoning,
                    isMock: opposeResult.isMock || false,
                    timestamp: opposeResult.timestamp,
                    responseId: savedResponses.oppose._id,
                    metadata: {
                        geminiModel: opposeResult.modelUsed,
                        reasoningLength: savedResponses.oppose.reasoningLength,
                        citationCount: savedResponses.oppose.citationCount
                    }
                },
                evidenceStats: {
                    totalChunks: evidence.totalChunks,
                    evidenceChunks: evidence.evidenceChunks.length,
                    averageRelevance: evidence.averageRelevanceScore
                }
            });

        } catch (error) {
            console.error('❌ Both agents error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

export default new AgentController();