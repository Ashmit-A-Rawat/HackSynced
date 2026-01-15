import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import AgentResponse from '../models/AgentResponse.js';
import SynthesisResult from '../models/SynthesisResult.js';
import Evidence from '../models/Evidence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SynthesisService {
    constructor() {
        console.log('🧠 Synthesis Service initialized');
    }

    async synthesizePair(synthesisPairIdInput) {
        const startTime = Date.now();
        
        try {
            console.log(`🔄 Starting ML synthesis for pair: ${synthesisPairIdInput}`);
            
            // Step 1: Find paired responses
            const { support, oppose } = await this._findPairedResponses(synthesisPairIdInput);
            
            if (!support || !oppose) {
                throw new Error('Could not find both support and oppose responses');
            }
            
            console.log(`✅ Found support (${support._id}) and oppose (${oppose._id})`);
            
            // Step 2: Get evidence
            const evidence = await this._getEvidenceForSession(support.sessionId);
            console.log(`📊 Loaded ${evidence.length} evidence chunks`);
            
            // Step 3: Prepare ML data
            const mlData = this._prepareMLPipelineData(support, oppose, evidence);
            
            // Step 3.5: Run Evidence Judge WITH LIGHTER MODEL
            console.log('🧠 Running Evidence Judge (DistilBERT)...');
            const evidenceJudgment = await this._runEvidenceJudge(evidence);
            
            // Step 3.6: Run Contradiction Detector WITH LIGHTER MODEL
            console.log('🔍 Running Contradiction Detector (DistilRoBERTa)...');
            const contradictionAnalysis = await this._runContradictionDetector(
                support.geminiResponse?.reasoning || '',
                oppose.geminiResponse?.reasoning || ''
            );
            
            // Step 3.7: Inject ML analysis results into data with fallbacks
            mlData.evidence_judgment = evidenceJudgment.success 
                ? evidenceJudgment.evidence_judgment 
                : {
                    overall: { support: 0.5, oppose: 0.5 },
                    dimension_scores: {
                        factual_grounding: 0.5,
                        logical_coherence: 0.5,
                        evidence_integration: 0.5,
                        argument_strength: 0.5,
                        objectivity: 0.5
                    },
                    winner: 'neutral',
                    confidence: 0.5
                };
            
            mlData.contradiction_analysis = contradictionAnalysis.success
                ? contradictionAnalysis.contradiction_analysis
                : {
                    contradiction_score: 0.3,
                    similarity_score: 0.5,
                    entailment_score: 0.3,
                    neutral_score: 0.4,
                    strong_contradictions: [],
                    is_contradictory: false,
                    fallback_used: true
                };
            
            console.log('✅ ML analysis injected with fallbacks');
            
            // Step 4: Run ML synthesis WITH the injected ML results
            console.log('🤖 Running ML synthesis pipeline...');
            const mlStartTime = Date.now();
            const mlResult = await this._runMLSynthesisPipeline(mlData);
            const mlTime = Date.now() - mlStartTime;
            
            if (!mlResult.success) {
                console.warn('⚠️ ML synthesis returned error, using fallback');
            }
            
            // Step 4.5: Generate Grok explanation
            console.log('🤖 Generating Grok explanation...');
            const grokExplanation = await this._generateGrokExplanation(
                mlResult,
                support.geminiResponse?.reasoning || '',
                oppose.geminiResponse?.reasoning || ''
            );
            
            if (grokExplanation && grokExplanation.success) {
                mlResult.grok_explanation = grokExplanation.explanation;
                mlResult.reasoning = grokExplanation.explanation;
                console.log('✅ Grok explanation added');
            }
            
            // Step 5: Save result
            console.log('💾 Saving synthesis result...');
            const synthesisResult = await this._saveSynthesisResult({
                synthesisPairId: synthesisPairIdInput,
                sessionId: support.sessionId,
                evidenceId: support.evidenceId,
                supportResponseId: support._id,
                opposeResponseId: oppose._id,
                mlResult,
                processingMetrics: {
                    totalTimeMs: Date.now() - startTime,
                    mlPipelineTimeMs: mlTime
                }
            });
            
            // Step 6: Update response statuses
            await AgentResponse.updateMany(
                { _id: { $in: [support._id, oppose._id] } },
                { $set: { synthesisStatus: 'synthesized' } }
            );
            
            const totalTime = Date.now() - startTime;
            console.log(`✅ Synthesis completed in ${totalTime}ms`);
            console.log(`   📊 Verdict: ${mlResult.final_verdict} (${Math.round(mlResult.confidence * 100)}% confidence)`);
            
            return {
                success: true,
                result: synthesisResult.formatForFrontend(),
                processingTime: totalTime
            };
            
        } catch (error) {
            console.error('❌ Synthesis failed:', error);
            throw error;
        }
    }

    async _runEvidenceJudge(evidence) {
        console.log('🧠 Running Evidence Judge (DistilBERT - 66MB)...');
        
        return new Promise((resolve) => {
            const pythonScript = path.join(__dirname, 'evidence_judge.py');
            
            // Set cache directory and smaller model
            const env = {
                ...process.env,
                TRANSFORMERS_CACHE: '/tmp/huggingface',
                EVIDENCE_JUDGE_MODEL: 'distilbert-base-uncased' // Lighter: 66MB vs 286MB
            };
            
            const pythonProcess = spawn('python3', [pythonScript], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
                env: env
            });

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (chunk) => {
                output += chunk.toString();
            });

            pythonProcess.stderr.on('data', (chunk) => {
                const msg = chunk.toString();
                if (!msg.includes('UserWarning')) { // Filter warnings
                    console.log('[Evidence Judge]:', msg);
                }
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (parseError) {
                        console.warn('⚠️ Evidence Judge parse error, using fallback');
                        resolve({ 
                            success: false,
                            error: 'Parse error'
                        });
                    }
                } else {
                    console.warn(`⚠️ Evidence Judge exited with code ${code}, using fallback`);
                    resolve({ 
                        success: false,
                        error: `Exit code ${code}`
                    });
                }
            });

            pythonProcess.on('error', (err) => {
                console.warn('⚠️ Evidence Judge process error:', err.message);
                resolve({ 
                    success: false,
                    error: err.message
                });
            });

            try {
                const judgeData = {
                    evidence_chunks: evidence.map((chunk, index) => ({
                        id: chunk.chunkId || index,
                        text: chunk.text || '',
                        relevance: chunk.relevanceScore || 0.5
                    })),
                    use_light_model: true // Tell Python to use light model
                };
                pythonProcess.stdin.write(JSON.stringify(judgeData));
                pythonProcess.stdin.end();
            } catch (err) {
                resolve({ 
                    success: false,
                    error: err.message
                });
            }
            
            // Give it 60 seconds for first-time download, 10 seconds for cached
            setTimeout(() => {
                if (!pythonProcess.killed) {
                    pythonProcess.kill();
                    console.warn('⚠️ Evidence Judge timeout (60s), using fallback');
                    resolve({ 
                        success: false,
                        error: 'Timeout'
                    });
                }
            }, 60000);
        });
    }

    async _runContradictionDetector(supportText, opposeText) {
        console.log('🔍 Running Contradiction Detector (DistilRoBERTa - 307MB)...');
        
        return new Promise((resolve) => {
            const pythonScript = path.join(__dirname, 'contradiction_detector.py');
            
            // Set cache directory and smaller model
            const env = {
                ...process.env,
                TRANSFORMERS_CACHE: '/tmp/huggingface',
                CONTRADICTION_MODEL: 'typeform/distilroberta-base-squad2' // Lighter: 307MB vs 1.43GB
            };
            
            const pythonProcess = spawn('python3', [pythonScript], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
                env: env
            });

            let output = '';

            pythonProcess.stdout.on('data', (chunk) => {
                output += chunk.toString();
            });

            pythonProcess.stderr.on('data', (chunk) => {
                const msg = chunk.toString();
                if (!msg.includes('UserWarning') && !msg.includes('resource_tracker')) {
                    console.log('[Contradiction Detector]:', msg);
                }
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (parseError) {
                        console.warn('⚠️ Contradiction Detector parse error, using fallback');
                        resolve({ 
                            success: false,
                            error: 'Parse error'
                        });
                    }
                } else {
                    console.warn(`⚠️ Contradiction Detector exited with code ${code}, using fallback`);
                    resolve({ 
                        success: false,
                        error: `Exit code ${code}`
                    });
                }
            });

            pythonProcess.on('error', (err) => {
                console.warn('⚠️ Contradiction Detector process error:', err.message);
                resolve({ 
                    success: false,
                    error: err.message
                });
            });

            try {
                const detectorData = {
                    support_text: supportText.substring(0, 500), // Shorter text for faster processing
                    oppose_text: opposeText.substring(0, 500),
                    use_light_model: true // Tell Python to use light model
                };
                pythonProcess.stdin.write(JSON.stringify(detectorData));
                pythonProcess.stdin.end();
            } catch (err) {
                resolve({ 
                    success: false,
                    error: err.message
                });
            }
            
            // Give it 90 seconds for first-time download, 15 seconds for cached
            setTimeout(() => {
                if (!pythonProcess.killed) {
                    pythonProcess.kill();
                    console.warn('⚠️ Contradiction Detector timeout (90s), using fallback');
                    resolve({ 
                        success: false,
                        error: 'Timeout'
                    });
                }
            }, 90000);
        });
    }

    async _findPairedResponses(pairIdInput) {
        console.log(`🔍 Finding paired responses for: ${pairIdInput}`);
        
        // ⭐ PRIMARY STRATEGY: Split "supportId_opposeId" format
        if (typeof pairIdInput === 'string' && pairIdInput.includes('_') && !pairIdInput.startsWith('pair_')) {
            const parts = pairIdInput.split('_');
            
            // Handle format: supportId_opposeId
            if (parts.length === 2) {
                const [supportId, opposeId] = parts;
                
                try {
                    console.log(`🔍 Trying split IDs: support=${supportId}, oppose=${opposeId}`);
                    
                    const [support, oppose] = await Promise.all([
                        AgentResponse.findById(supportId).lean(),
                        AgentResponse.findById(opposeId).lean()
                    ]);
                    
                    if (support && oppose) {
                        console.log('✅ Found pair using split IDs strategy');
                        return { support, oppose };
                    } else {
                        console.warn('⚠️ Split IDs found but one or both responses are null');
                    }
                } catch (err) {
                    console.warn('⚠️ Split ID strategy failed:', err.message);
                }
            }
        }
        
        // Strategy 2: Old format "pair_timestamp_random"
        if (typeof pairIdInput === 'string' && pairIdInput.startsWith('pair_')) {
            console.log('🔍 Detected old pair format, searching by recent responses...');
            
            try {
                // Get most recent support and oppose from same session
                const recentResponses = await AgentResponse.find({})
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .lean();
                
                // Group by sessionId
                const bySession = {};
                for (const response of recentResponses) {
                    if (!bySession[response.sessionId]) {
                        bySession[response.sessionId] = [];
                    }
                    bySession[response.sessionId].push(response);
                }
                
                // Find first complete pair
                for (const sessionId in bySession) {
                    const responses = bySession[sessionId];
                    const support = responses.find(r => r.agentType === 'support');
                    const oppose = responses.find(r => r.agentType === 'oppose');
                    
                    if (support && oppose) {
                        console.log('✅ Found pair using recent session strategy');
                        return { support, oppose };
                    }
                }
            } catch (err) {
                console.warn('⚠️ Recent session strategy failed:', err.message);
            }
        }
        
        // Strategy 3: Find by synthesisPairId field (legacy cross-reference)
        try {
            const responses = await AgentResponse.find({
                synthesisPairId: pairIdInput
            }).lean();
            
            if (responses.length === 2) {
                const support = responses.find(r => r.agentType === 'support');
                const oppose = responses.find(r => r.agentType === 'oppose');
                
                if (support && oppose) {
                    console.log('✅ Found pair using synthesisPairId field');
                    return { support, oppose };
                }
            }
        } catch (err) {
            console.warn('⚠️ synthesisPairId strategy failed:', err.message);
        }
        
        // Strategy 4: Treat as one response ID, find counterpart
        try {
            const mainResponse = await AgentResponse.findById(pairIdInput).lean();
            
            if (mainResponse && mainResponse.synthesisPairId) {
                const counterpart = await AgentResponse.findById(mainResponse.synthesisPairId).lean();
                
                if (counterpart) {
                    console.log('✅ Found pair using counterpart lookup');
                    
                    if (mainResponse.agentType === 'support') {
                        return { support: mainResponse, oppose: counterpart };
                    } else {
                        return { support: counterpart, oppose: mainResponse };
                    }
                }
            }
        } catch (err) {
            console.warn('⚠️ Counterpart lookup strategy failed:', err.message);
        }
        
        throw new Error(`Could not find synthesis pair for: ${pairIdInput}`);
    }

    _prepareMLPipelineData(supportResponse, opposeResponse, evidence) {
        return {
            synthesisPairId: supportResponse.synthesisPairId?.toString() || 'unknown',
            sessionId: supportResponse.sessionId,
            support: {
                reasoning: supportResponse.geminiResponse?.reasoning || '',
                citations: supportResponse.citations || [],
                responseId: supportResponse._id.toString(),
                subject: supportResponse.subject,
                geminiResponse: supportResponse.geminiResponse || {}
            },
            oppose: {
                reasoning: opposeResponse.geminiResponse?.reasoning || '',
                citations: opposeResponse.citations || [],
                responseId: opposeResponse._id.toString(),
                subject: opposeResponse.subject,
                geminiResponse: opposeResponse.geminiResponse || {}
            },
            evidence: evidence.map((chunk, index) => ({
                id: chunk.chunkId || index,
                text: chunk.text || '',
                relevance: chunk.relevanceScore || 0.5
            }))
        };
    }

    async _runMLSynthesisPipeline(data) {
        return new Promise((resolve) => {
            const pythonScript = path.join(__dirname, 'ml_synthesizer.py');
            
            const pythonProcess = spawn('python3', [pythonScript], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (chunk) => {
                output += chunk.toString();
            });

            pythonProcess.stderr.on('data', (chunk) => {
                const msg = chunk.toString();
                console.log('[Python ML]:', msg);
                errorOutput += msg;
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (parseError) {
                        console.error('❌ Failed to parse Python output');
                        resolve(this._getFallbackResult('Parse error'));
                    }
                } else {
                    try {
                        const errorResult = JSON.parse(output);
                        resolve(errorResult);
                    } catch {
                        resolve(this._getFallbackResult(`Python exit code ${code}`));
                    }
                }
            });

            pythonProcess.on('error', (err) => {
                console.error('❌ Python process error:', err);
                resolve(this._getFallbackResult(`Process error: ${err.message}`));
            });

            try {
                pythonProcess.stdin.write(JSON.stringify(data));
                pythonProcess.stdin.end();
            } catch (err) {
                resolve(this._getFallbackResult(`Failed to write to Python: ${err.message}`));
            }
            
            setTimeout(() => {
                pythonProcess.kill();
                resolve(this._getFallbackResult('ML pipeline timeout (60s)'));
            }, 60000);
        });
    }

    async _generateGrokExplanation(mlResult, supportReasoning, opposeReasoning) {
        return new Promise((resolve) => {
            const pythonScript = path.join(__dirname, 'grok_explainer.py');
            
            const pythonProcess = spawn('python3', [pythonScript], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
                    OPENROUTER_MODEL: 'meta-llama/llama-3.2-3b-instruct:free' // Free model
                }
            });

            let output = '';

            pythonProcess.stdout.on('data', (chunk) => {
                output += chunk.toString();
            });

            pythonProcess.stderr.on('data', (chunk) => {
                console.log('[Grok]:', chunk.toString());
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (parseError) {
                        resolve({ success: false });
                    }
                } else {
                    resolve({ success: false });
                }
            });

            pythonProcess.on('error', (err) => {
                console.warn('⚠️ Grok process error:', err.message);
                resolve({ success: false });
            });

            try {
                const grokData = {
                    ml_result: mlResult,
                    support_summary: supportReasoning.substring(0, 300), // Shorter for faster processing
                    oppose_summary: opposeReasoning.substring(0, 300),
                    use_free_model: true // Use free model
                };
                pythonProcess.stdin.write(JSON.stringify(grokData));
                pythonProcess.stdin.end();
            } catch (err) {
                resolve({ success: false });
            }
            
            setTimeout(() => {
                pythonProcess.kill();
                resolve({ success: false });
            }, 15000);
        });
    }

    async _getEvidenceForSession(sessionId) {
        try {
            const evidence = await Evidence.findOne({ sessionId }).lean();
            return evidence?.evidenceChunks || [];
        } catch (error) {
            console.error('❌ Error fetching evidence:', error);
            return [];
        }
    }

    async _saveSynthesisResult(data) {
        const {
            synthesisPairId,
            sessionId,
            evidenceId,
            supportResponseId,
            opposeResponseId,
            mlResult,
            processingMetrics
        } = data;
        
        const synthesisResult = new SynthesisResult({
            synthesisPairId,
            sessionId,
            evidenceId,
            supportResponseId,
            opposeResponseId,
            verdict: mlResult.final_verdict || 'inconclusive',
            confidence: mlResult.confidence || 0.5,
            reasoning: mlResult.reasoning || 'No reasoning provided',
            mlScores: mlResult.scores || {},
            keyEvidence: mlResult.key_evidence || [],
            modelsUsed: {
                evidenceJudge: {
                    name: 'DistilBERT', // Updated to lighter model
                    version: 'base-uncased',
                    confidence: mlResult.scores?.evidence?.quality_score || 0.5
                },
                contradictionDetector: {
                    name: 'DistilRoBERTa', // Updated to lighter model
                    version: 'base-squad2',
                    confidence: mlResult.scores?.contradictions?.contradiction_score || 0.5
                },
                confidenceScorer: {
                    name: 'XGBoost',
                    version: 'v1.0',
                    confidence: mlResult.confidence || 0.5
                }
            },
            processingMetrics: {
                totalTimeMs: processingMetrics.totalTimeMs,
                mlPipelineTimeMs: processingMetrics.mlPipelineTimeMs,
                evidenceAnalysisTimeMs: Math.round(processingMetrics.mlPipelineTimeMs * 0.3),
                contradictionDetectionTimeMs: Math.round(processingMetrics.mlPipelineTimeMs * 0.3),
                confidenceScoringTimeMs: Math.round(processingMetrics.mlPipelineTimeMs * 0.4)
            },
            status: 'completed',
            completedAt: new Date()
        });
        
        return await synthesisResult.save();
    }

    _getFallbackResult(error) {
        return {
            success: false,
            error: error,
            final_verdict: 'inconclusive',
            confidence: 0.5,
            reasoning: `ML synthesis encountered an issue: ${error}. Both arguments have merit but a definitive verdict cannot be determined at this time.`,
            scores: {
                support: { strength: 0.5, coverage: 0.5, consistency: 0.5 },
                oppose: { strength: 0.5, coverage: 0.5, consistency: 0.5 },
                evidence: { quality_score: 0.5 },
                contradictions: { contradiction_score: 0.5 }
            },
            key_evidence: [],
            fallback_used: true
        };
    }

    async getSynthesisResult(synthesisPairId) {
        try {
            const result = await SynthesisResult.findOne({ synthesisPairId })
                .populate('supportResponseId', 'agentType geminiResponse.reasoning subject')
                .populate('opposeResponseId', 'agentType geminiResponse.reasoning subject')
                .lean();
            
            return result;
        } catch (error) {
            console.error('❌ Error fetching synthesis result:', error);
            return null;
        }
    }

    async getRecentSyntheses(limit = 10) {
        try {
            const results = await SynthesisResult.find({})
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate('supportResponseId', 'agentType subject')
                .populate('opposeResponseId', 'agentType subject')
                .lean();
            
            return results.map(result => ({
                id: result._id,
                synthesisPairId: result.synthesisPairId,
                verdict: result.verdict,
                confidence: result.confidence,
                createdAt: result.createdAt,
                processingTime: result.processingMetrics?.totalTimeMs,
                subject: result.supportResponseId?.subject || 'Unknown'
            }));
        } catch (error) {
            console.error('❌ Error fetching recent syntheses:', error);
            return [];
        }
    }

    async getSynthesisStats() {
        try {
            const stats = await SynthesisResult.aggregate([
                {
                    $group: {
                        _id: '$verdict',
                        count: { $sum: 1 },
                        avgConfidence: { $avg: '$confidence' },
                        avgProcessingTime: { $avg: '$processingMetrics.totalTimeMs' }
                    }
                },
                {
                    $project: {
                        verdict: '$_id',
                        count: 1,
                        avgConfidence: { $round: ['$avgConfidence', 2] },
                        avgProcessingTime: { $round: ['$avgProcessingTime', 0] },
                        _id: 0
                    }
                }
            ]);
            
            const total = await SynthesisResult.countDocuments();
            
            return {
                total,
                byVerdict: stats,
                recentCount: await SynthesisResult.countDocuments({
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                })
            };
        } catch (error) {
            console.error('❌ Error getting synthesis stats:', error);
            return { total: 0, byVerdict: [], recentCount: 0 };
        }
    }
}

export default new SynthesisService();