// backend/services/geminiService.js
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

class GeminiService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('⚠️ GEMINI_API_KEY not set. Agent functionality will be limited.');
            this.genAI = null;
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
            console.log('✅ Gemini service initialized');
        }
        
        // ✅ CORRECT MODEL NAMES - Current stable Gemini models (Jan 2025)
        this.geminiModels = [
            'gemini-2.5-flash',            // Best price-performance (RECOMMENDED)
            'gemini-2.5-pro',              // Advanced reasoning & thinking
            'gemini-2.0-flash-exp'         // Experimental fallback
        ];
        
        console.log('📋 Using Gemini models:', this.geminiModels);
    }

    async tryModelsWithFallback(operation, evidenceContext, subject, agentType) {
        if (!this.genAI) {
            console.warn('⚠️ No Gemini API key - using mock response');
            return this.getMockResponse(evidenceContext, agentType, 'No API key');
        }

        const errors = [];
        
        for (const modelName of this.geminiModels) {
            try {
                console.log(`🔄 Trying model: ${modelName}`);
                const model = this.genAI.getGenerativeModel({ model: modelName });
                
                const prompt = agentType === 'support' 
                    ? this.buildSupportPrompt(evidenceContext, subject)
                    : this.buildOpposePrompt(evidenceContext, subject);
                
                console.log(`🤖 ${agentType} agent reasoning with ${modelName}...`);
                
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const reasoning = response.text();
                
                console.log(`✅ ${modelName} succeeded!`);
                
                return {
                    success: true,
                    reasoning: reasoning,
                    agent: agentType,
                    modelUsed: modelName,
                    evidenceContext: evidenceContext.document_context,
                    timestamp: new Date().toISOString()
                };
                
            } catch (error) {
                console.warn(`❌ ${modelName} failed:`, error.message);
                errors.push({ model: modelName, error: error.message });
                
                // Wait briefly before trying next model
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        // All models failed
        console.error('❌ All Gemini models failed:', errors);
        return this.getMockResponse(
            evidenceContext, 
            agentType, 
            `All models failed: ${errors.map(e => e.model).join(', ')}`
        );
    }

    async getSupportAgentReasoning(evidenceContext, subject = "the document") {
        return this.tryModelsWithFallback(
            'generateContent',
            evidenceContext,
            subject,
            'support'
        );
    }

    async getOpposeAgentReasoning(evidenceContext, subject = "the document") {
        return this.tryModelsWithFallback(
            'generateContent',
            evidenceContext,
            subject,
            'oppose'
        );
    }

    buildSupportPrompt(evidenceContext, subject) {
        const { document_context, evidence_chunks, metadata } = evidenceContext;
        
        // Ensure metadata has average_relevance
        const avgRelevance = metadata?.average_relevance || 
            (() => {
                const avg = evidence_chunks.reduce((acc, chunk) => {
                    const scoreStr = chunk.relevance_score || '0%';
                    const score = parseFloat(scoreStr) / 100 || 0.5;
                    return acc + score;
                }, 0) / evidence_chunks.length;
                return `${(avg * 100).toFixed(1)}%`;
            })();
        
        return `
ROLE: You are a SUPPORT AGENT in a multi-agent reasoning system.
TASK: Analyze the evidence and construct a compelling argument IN FAVOR of ${subject}.

CRITICAL RULES:
1. Use ONLY the provided evidence chunks. Do NOT add external knowledge.
2. Cite specific evidence chunks by number: [Chunk X]
3. Explain your reasoning step-by-step.
4. Do NOT hallucinate or make assumptions beyond the evidence.
5. Structure your response with clear sections.

DOCUMENT CONTEXT:
- Document: ${document_context.file_name}
- Type: ${document_context.document_type}
- Summary: ${document_context.summary || 'No summary provided'}
- Word Count: ${document_context.word_count}

EVIDENCE CHUNKS (ranked by relevance):
${evidence_chunks.map((chunk, index) => `
[Chunk ${chunk.chunk_number}] Relevance: ${chunk.relevance_score}
Position: ${chunk.position_in_document}
Text: ${chunk.text}
`).join('\n')}

METADATA:
- Total chunks analyzed: ${metadata?.total_chunks_analyzed || evidence_chunks.length}
- Evidence chunks selected: ${metadata?.evidence_chunks_selected || evidence_chunks.length}
- Average relevance: ${avgRelevance}
- Processing strategy: ${metadata?.processing_strategy || 'standard'}

YOUR TASK:
Based on the evidence above, construct a compelling argument SUPPORTING ${subject}.

Your response MUST include:
1. INTRODUCTION: Briefly state your position and main supporting points.
2. EVIDENCE-BASED ARGUMENTS: Use the evidence chunks to build your case.
3. CHAIN OF REASONING: Explain step-by-step how the evidence leads to your conclusion.
4. KEY SUPPORTING POINTS: List 3-5 main points with evidence citations.
5. CONCLUSION: Summarize why the evidence strongly supports ${subject}.

IMPORTANT: Always cite evidence using [Chunk X] format. Be persuasive but factual.
`;
    }

    buildOpposePrompt(evidenceContext, subject) {
        const { document_context, evidence_chunks, metadata } = evidenceContext;
        
        // Ensure metadata has average_relevance
        const avgRelevance = metadata?.average_relevance || 
            (() => {
                const avg = evidence_chunks.reduce((acc, chunk) => {
                    const scoreStr = chunk.relevance_score || '0%';
                    const score = parseFloat(scoreStr) / 100 || 0.5;
                    return acc + score;
                }, 0) / evidence_chunks.length;
                return `${(avg * 100).toFixed(1)}%`;
            })();
        
        return `
ROLE: You are an OPPOSE AGENT in a multi-agent reasoning system.
TASK: Analyze the evidence and construct a critical argument AGAINST ${subject}.

CRITICAL RULES:
1. Use ONLY the provided evidence chunks. Do NOT add external knowledge.
2. Identify weaknesses, contradictions, or missing information.
3. Cite specific evidence chunks by number: [Chunk X]
4. Explain your reasoning step-by-step.
5. Do NOT hallucinate or make assumptions beyond the evidence.

DOCUMENT CONTEXT:
- Document: ${document_context.file_name}
- Type: ${document_context.document_type}
- Summary: ${document_context.summary || 'No summary provided'}
- Word Count: ${document_context.word_count}

EVIDENCE CHUNKS (ranked by relevance):
${evidence_chunks.map((chunk, index) => `
[Chunk ${chunk.chunk_number}] Relevance: ${chunk.relevance_score}
Position: ${chunk.position_in_document}
Text: ${chunk.text}
`).join('\n')}

METADATA:
- Total chunks analyzed: ${metadata?.total_chunks_analyzed || evidence_chunks.length}
- Evidence chunks selected: ${metadata?.evidence_chunks_selected || evidence_chunks.length}
- Average relevance: ${avgRelevance}
- Processing strategy: ${metadata?.processing_strategy || 'standard'}

YOUR TASK:
Based on the evidence above, construct a critical argument OPPOSING ${subject}.

Your response MUST include:
1. INTRODUCTION: Briefly state your skeptical position.
2. EVIDENCE WEAKNESSES: Identify gaps, contradictions, or limitations in the evidence.
3. COUNTER-ARGUMENTS: Use evidence to challenge assumptions or claims.
4. MISSING INFORMATION: Point out what the evidence does NOT show.
5. ALTERNATIVE INTERPRETATIONS: Suggest other ways to interpret the evidence.
6. CONCLUSION: Summarize why caution or skepticism is warranted.

IMPORTANT: Always cite evidence using [Chunk X] format. Be critical but fair.
`;
    }

    getMockResponse(evidenceContext, agentType, error = null) {
        const { document_context, evidence_chunks } = evidenceContext;
        const isSupport = agentType === 'support';
        
        return {
            success: !error,
            reasoning: `
# ${isSupport ? 'SUPPORT' : 'OPPOSE'} AGENT REASONING
**Document:** ${document_context.file_name}
**Position:** ${isSupport ? 'IN FAVOR' : 'CRITICAL'} of the document's main claims
${error ? `\n**Error:** ${error}` : ''}

## INTRODUCTION
${isSupport 
    ? 'Based on the evidence provided, I support the primary assertions in this document.'
    : 'While the document presents its case, several issues warrant skepticism.'}

## ${isSupport ? 'KEY SUPPORTING EVIDENCE' : 'IDENTIFIED WEAKNESSES'}
1. **${isSupport ? 'Strong Opening Argument' : 'Lack of Specificity'}** [Chunk 1]
   - ${isSupport 
        ? 'The document begins with a clear, compelling statement' 
        : 'Claims are general without concrete examples'}

2. **${isSupport ? 'Detailed Supporting Information' : 'Missing Supporting Data'}** [Chunk 2]
   - ${isSupport 
        ? 'Provides specific details that reinforce the main claims' 
        : 'Key assertions lack quantitative evidence'}

3. **${isSupport ? 'Substantive Content' : 'Potential Bias'}** [Chunk 3]
   - ${isSupport 
        ? 'Includes quantifiable or verifiable information' 
        : 'Selective presentation of information'}

## ${isSupport ? 'CHAIN OF REASONING' : 'COUNTER-ARGUMENTS'}
1. ${isSupport 
        ? 'The evidence shows a coherent structure' 
        : 'Alternative interpretations of the evidence exist'}
2. ${isSupport 
        ? 'Key points are supported by specific details' 
        : 'The document may overstate its conclusions'}
3. ${isSupport 
        ? 'The document maintains consistency throughout' 
        : 'Important contextual information may be missing'}

${!isSupport ? `
## MISSING INFORMATION
- No contradictory evidence is presented
- Methodological details are absent
- Limitations are not acknowledged
` : ''}

## CONCLUSION
${isSupport 
    ? 'The evidence strongly supports the document\'s validity and credibility.' 
    : 'Caution is advised when accepting the document\'s claims at face value.'}

${error 
    ? `\n⚠️ Note: Mock response used due to Gemini API error: ${error}` 
    : '⚠️ Note: This is a mock response. Set GEMINI_API_KEY for real AI reasoning.'}
            `.trim(),
            agent: agentType,
            evidenceContext: document_context,
            timestamp: new Date().toISOString(),
            isMock: true,
            modelUsed: 'mock'
        };
    }

    getMockSupportResponse(evidenceContext, error = null) {
        return this.getMockResponse(evidenceContext, 'support', error);
    }

    getMockOpposeResponse(evidenceContext, error = null) {
        return this.getMockResponse(evidenceContext, 'oppose', error);
    }
}

export default new GeminiService();