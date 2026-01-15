import mongoose from 'mongoose';

const citationSchema = new mongoose.Schema({
    chunkNumber: Number,
    context: String,
    timestampInReasoning: Number
}, { _id: false });

const geminiMetadataSchema = new mongoose.Schema({
    modelUsed: String,
    isMock: Boolean,
    success: Boolean,
    timestamp: Date,
    promptTokens: Number,
    completionTokens: Number,
    totalTokens: Number
}, { _id: false });

const evidenceStatsSchema = new mongoose.Schema({
    totalChunks: Number,
    evidenceChunksUsed: Number,
    averageRelevance: Number,
    highRelevanceChunks: Number,
    mediumRelevanceChunks: Number,
    lowRelevanceChunks: Number
}, { _id: false });

const documentContextSchema = new mongoose.Schema({
    fileName: String,
    documentType: String,
    wordCount: Number,
    summary: String,
    originalTextLength: Number
}, { _id: false });

const agentResponseSchema = new mongoose.Schema({
    // ===== CORE IDENTIFIERS =====
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    evidenceId: {
        type: String,
        required: true,
        index: true
    },
    agentType: {
        type: String,
        enum: ['support', 'oppose'],
        required: true,
        index: true
    },
    
    // ===== THE COMPLETE GEMINI RESPONSE =====
    geminiResponse: {
        // The raw reasoning text from Gemini
        reasoning: {
            type: String,
            required: true
        },
        
        // Full Gemini API metadata
        metadata: geminiMetadataSchema,
        
        // The original prompt sent to Gemini (for debugging/reproducibility)
        originalPrompt: String,
        
        // Any errors from Gemini
        error: String,
        
        // Model fallback information
        fallbackModelsTried: [String]
    },
    
    // ===== EVIDENCE CONTEXT (what was sent to Gemini) =====
    evidenceContext: {
        documentContext: documentContextSchema,
        
        evidenceChunks: [{
            chunkNumber: Number,
            relevanceScore: String,
            positionInDocument: String,
            text: String,
            wordCount: Number
        }],
        
        metadata: {
            totalChunksAnalyzed: Number,
            evidenceChunksSelected: Number,
            averageRelevance: String,
            processingStrategy: String
        }
    },
    
    // ===== SUBJECT & DEBATE INFO =====
    subject: {
        type: String,
        required: true
    },
    subjectSource: {
        type: String,
        enum: ['user_provided', 'auto_detected', 'document_inferred'],
        default: 'document_inferred'
    },
    
    // ===== ANALYSIS & METRICS =====
    evidenceStats: evidenceStatsSchema,
    
    citations: [citationSchema],
    citationCount: {
        type: Number,
        default: 0
    },
    
    // ===== PERFORMANCE METRICS =====
    processingMetrics: {
        totalProcessingTimeMs: Number,
        geminiApiTimeMs: Number,
        databaseSaveTimeMs: Number
    },
    
    // ===== SYNTHESIS TRACKING =====
    synthesisStatus: {
        type: String,
        enum: ['pending', 'synthesized', 'archived'],
        default: 'pending',
        index: true
    },
    synthesisPairId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AgentResponse'
    },
    
    // ===== TIMESTAMPS =====
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for easy access to reasoning length
agentResponseSchema.virtual('reasoningLength').get(function() {
    return this.geminiResponse?.reasoning?.length || 0;
});

// Virtual for word count
agentResponseSchema.virtual('wordCount').get(function() {
    return this.geminiResponse?.reasoning?.split(/\s+/)?.length || 0;
});

// Indexes for fast queries
agentResponseSchema.index({ sessionId: 1, agentType: 1 });
agentResponseSchema.index({ 'geminiResponse.metadata.modelUsed': 1 });
agentResponseSchema.index({ createdAt: -1 });
agentResponseSchema.index({ synthesisStatus: 1, createdAt: -1 });

// Method to get the counterpart (support↔oppose)
agentResponseSchema.methods.getCounterpart = async function() {
    const counterpartType = this.agentType === 'support' ? 'oppose' : 'support';
    return this.model('AgentResponse').findOne({
        sessionId: this.sessionId,
        evidenceId: this.evidenceId,
        agentType: counterpartType
    });
};

// Method to format for frontend (clean version)
agentResponseSchema.methods.formatForFrontend = function() {
    return {
        id: this._id,
        agentType: this.agentType,
        subject: this.subject,
        reasoning: this.geminiResponse.reasoning,
        isMock: this.geminiResponse.metadata?.isMock || false,
        modelUsed: this.geminiResponse.metadata?.modelUsed || 'unknown',
        timestamp: this.geminiResponse.metadata?.timestamp || this.createdAt,
        citations: this.citations,
        evidenceStats: this.evidenceStats,
        processingTime: this.processingMetrics?.totalProcessingTimeMs
    };
};

// Method to get raw Gemini response (for debugging)
agentResponseSchema.methods.getRawGeminiResponse = function() {
    return this.geminiResponse;
};

const AgentResponse = mongoose.models.AgentResponse || mongoose.model('AgentResponse', agentResponseSchema);

export default AgentResponse;