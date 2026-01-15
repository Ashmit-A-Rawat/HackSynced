import AgentResponse from '../models/AgentResponse.js';

class ResponseService {
    constructor() {
        console.log('📊 Response Service initialized');
    }
    
    async saveGeminiResponse(saveData) {
        const startTime = Date.now();
        
        try {
            const {
                sessionId,
                evidenceId,
                agentType,
                geminiResult,      // The COMPLETE result from geminiService.js
                evidenceContext,   // The evidence sent to Gemini
                evidenceStats,
                subject,
                subjectSource = 'document_inferred',
                processingMetrics = {}
            } = saveData;
            
            // Extract citations from reasoning
            const citations = this.extractCitations(geminiResult.reasoning);
            
            // Create the complete response document
            const responseDoc = new AgentResponse({
                sessionId,
                evidenceId,
                agentType,
                
                // Save the ENTIRE Gemini response
                geminiResponse: {
                    reasoning: geminiResult.reasoning,
                    metadata: {
                        modelUsed: geminiResult.modelUsed || 'unknown',
                        isMock: geminiResult.isMock || false,
                        success: geminiResult.success !== false,
                        timestamp: geminiResult.timestamp ? new Date(geminiResult.timestamp) : new Date(),
                        promptTokens: geminiResult.usage?.promptTokens,
                        completionTokens: geminiResult.usage?.completionTokens,
                        totalTokens: geminiResult.usage?.totalTokens
                    },
                    originalPrompt: geminiResult.promptUsed,
                    error: geminiResult.error,
                    fallbackModelsTried: geminiResult.fallbackModels || []
                },
                
                // Save the evidence that was sent to Gemini
                evidenceContext: evidenceContext ? {
                    documentContext: evidenceContext.document_context,
                    evidenceChunks: evidenceContext.evidence_chunks?.map(chunk => ({
                        chunkNumber: chunk.chunk_number,
                        relevanceScore: chunk.relevance_score,
                        positionInDocument: chunk.position_in_document,
                        text: chunk.text.substring(0, 500), // Store snippet
                        wordCount: chunk.word_count
                    })),
                    metadata: evidenceContext.metadata
                } : null,
                
                subject,
                subjectSource,
                evidenceStats,
                citations,
                citationCount: citations.length,
                
                processingMetrics: {
                    ...processingMetrics,
                    databaseSaveTimeMs: Date.now() - startTime
                }
            });
            
            const savedResponse = await responseDoc.save();
            const totalTime = Date.now() - startTime;
            
            console.log(`💾 Saved ${agentType} response for session ${sessionId}`);
            console.log(`   📝 Reasoning length: ${savedResponse.reasoningLength} chars`);
            console.log(`   ⏱️  Total save time: ${totalTime}ms`);
            console.log(`   🆔 MongoDB ID: ${savedResponse._id}`);
            
            return savedResponse;
            
        } catch (error) {
            console.error('❌ Error saving Gemini response to database:', error);
            console.error('Save data received:', JSON.stringify(saveData, null, 2).substring(0, 500));
            throw error;
        }
    }
    
    async saveBothGeminiResponses(sessionId, evidenceId, supportResult, opposeResult, evidenceContext, evidence, subject) {
        try {
            console.log(`💾 Saving BOTH Gemini responses for session ${sessionId}...`);
            
            const evidenceStats = {
                totalChunks: evidence.totalChunks,
                evidenceChunksUsed: evidence.evidenceChunks.length,
                averageRelevance: evidence.averageRelevanceScore,
                highRelevanceChunks: Math.floor(evidence.evidenceChunks.filter(c => c.relevanceScore > 0.7).length),
                mediumRelevanceChunks: Math.floor(evidence.evidenceChunks.filter(c => c.relevanceScore >= 0.4 && c.relevanceScore <= 0.7).length),
                lowRelevanceChunks: Math.floor(evidence.evidenceChunks.filter(c => c.relevanceScore < 0.4).length)
            };
            
            // Save support response
            const supportResponse = await this.saveGeminiResponse({
                sessionId,
                evidenceId,
                agentType: 'support',
                geminiResult: supportResult,
                evidenceContext,
                evidenceStats,
                subject,
                processingMetrics: {
                    totalProcessingTimeMs: supportResult.processingTime || 0
                }
            });
            
            // Save oppose response
            const opposeResponse = await this.saveGeminiResponse({
                sessionId,
                evidenceId,
                agentType: 'oppose',
                geminiResult: opposeResult,
                evidenceContext,
                evidenceStats,
                subject,
                processingMetrics: {
                    totalProcessingTimeMs: opposeResult.processingTime || 0
                }
            });
            
            // Link them as synthesis pairs
            supportResponse.synthesisPairId = opposeResponse._id;
            opposeResponse.synthesisPairId = supportResponse._id;
            
            await Promise.all([
                supportResponse.save(),
                opposeResponse.save()
            ]);
            
            console.log(`🔗 Paired responses saved for synthesis`);
            console.log(`   Support ID: ${supportResponse._id}`);
            console.log(`   Oppose ID: ${opposeResponse._id}`);
            
            return {
                support: supportResponse,
                oppose: opposeResponse
            };
            
        } catch (error) {
            console.error('❌ Error saving both Gemini responses:', error);
            throw error;
        }
    }
    
    extractCitations(reasoning) {
        const citations = [];
        const citationRegex = /\[Chunk\s*(\d+)\]/g;
        let match;
        let position = 0;
        
        while ((match = citationRegex.exec(reasoning)) !== null) {
            const chunkNumber = parseInt(match[1]);
            
            // Get context around the citation
            const start = Math.max(0, match.index - 100);
            const end = Math.min(reasoning.length, match.index + match[0].length + 100);
            const context = reasoning.substring(start, end)
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            // Only add if not already in citations
            if (!citations.find(c => c.chunkNumber === chunkNumber)) {
                citations.push({
                    chunkNumber,
                    context,
                    timestampInReasoning: match.index
                });
            }
        }
        
        return citations;
    }
    
    // ===== QUERY METHODS =====
    
    async getResponsesBySession(sessionId, limit = 50) {
        try {
            const responses = await AgentResponse.find({ sessionId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();
            
            return responses;
        } catch (error) {
            console.error('Error fetching responses by session:', error);
            return [];
        }
    }
    
    async getResponsePair(sessionId, evidenceId = null) {
        try {
            const query = { sessionId };
            if (evidenceId) {
                query.evidenceId = evidenceId;
            }
            
            const responses = await AgentResponse.find(query)
                .sort({ agentType: 1, createdAt: -1 })
                .limit(2)
                .lean();
            
            const support = responses.find(r => r.agentType === 'support');
            const oppose = responses.find(r => r.agentType === 'oppose');
            
            return { support, oppose };
        } catch (error) {
            console.error('Error fetching response pair:', error);
            return { support: null, oppose: null };
        }
    }
    
    async getResponseById(responseId) {
        try {
            const response = await AgentResponse.findById(responseId).lean();
            return response;
        } catch (error) {
            console.error('Error fetching response by ID:', error);
            return null;
        }
    }
    
    async getResponsesForSynthesis(limit = 20) {
        try {
            const responses = await AgentResponse.find({
                synthesisStatus: 'pending',
                synthesisPairId: { $exists: true, $ne: null }
            })
            .populate('synthesisPairId', 'agentType geminiResponse.reasoning subject')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
            
            return responses;
        } catch (error) {
            console.error('Error fetching responses for synthesis:', error);
            return [];
        }
    }
    
    async markAsSynthesized(responseId) {
        try {
            const response = await AgentResponse.findByIdAndUpdate(
                responseId,
                { 
                    synthesisStatus: 'synthesized',
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            return response;
        } catch (error) {
            console.error('Error marking response as synthesized:', error);
            throw error;
        }
    }
    
    async getResponseStats(sessionId = null) {
        try {
            const matchStage = sessionId ? { $match: { sessionId } } : { $match: {} };
            
            const stats = await AgentResponse.aggregate([
                matchStage,
                {
                    $group: {
                        _id: '$agentType',
                        count: { $sum: 1 },
                        avgReasoningLength: { $avg: { $strLenCP: '$geminiResponse.reasoning' } },
                        avgCitations: { $avg: '$citationCount' },
                        latest: { $max: '$createdAt' }
                    }
                }
            ]);
            
            return stats;
        } catch (error) {
            console.error('Error getting response stats:', error);
            return [];
        }
    }
}

export default new ResponseService();