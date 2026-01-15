import mongoose from 'mongoose';

const mlScoreSchema = new mongoose.Schema({
    evidenceStrength: {
        support: { type: Number, min: 0, max: 1 },
        oppose: { type: Number, min: 0, max: 1 }
    },
    citationQuality: {
        support: { type: Number, min: 0, max: 1 },
        oppose: { type: Number, min: 0, max: 1 }
    },
    coverage: {
        support: { type: Number, min: 0, max: 1 },
        oppose: { type: Number, min: 0, max: 1 }
    },
    contradictionScore: { type: Number, min: 0, max: 1 },
    argumentConsistency: {
        support: { type: Number, min: 0, max: 1 },
        oppose: { type: Number, min: 0, max: 1 }
    },
    evidenceDiversity: { type: Number, min: 0, max: 1 }
}, { _id: false });

const keyEvidenceSchema = new mongoose.Schema({
    chunkId: String,
    text: String,
    weight: { type: Number, min: 0, max: 1 },
    usedBy: [{ type: String, enum: ['support', 'oppose'] }],
    verdictImpact: { type: Number, min: -1, max: 1 } // -1 hurts, 0 neutral, 1 helps
}, { _id: false });

const modelMetadataSchema = new mongoose.Schema({
    name: String,
    version: String,
    confidence: Number,
    processingTimeMs: Number
}, { _id: false });

const synthesisResultSchema = new mongoose.Schema({
    // Core identifiers
    synthesisPairId: {
        type: String,  // ⭐ FIXED: Changed from ObjectId to String
        required: true,
        unique: true,
        index: true
    },
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
    
    // Verdict
    verdict: {
        type: String,
        enum: ['support', 'oppose', 'inconclusive', 'mixed'],
        required: true
    },
    confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    
    // Reasoning
    reasoning: {
        type: String,
        required: true
    },
    
    // ML Analysis
    mlScores: mlScoreSchema,
    keyEvidence: [keyEvidenceSchema],
    
    // Model information
    modelsUsed: {
        evidenceJudge: modelMetadataSchema,
        contradictionDetector: modelMetadataSchema,
        confidenceScorer: modelMetadataSchema,
        verdictWriter: modelMetadataSchema
    },
    
    // Processing metadata
    processingMetrics: {
        totalTimeMs: Number,
        mlPipelineTimeMs: Number,
        evidenceAnalysisTimeMs: Number,
        contradictionDetectionTimeMs: Number,
        confidenceScoringTimeMs: Number
    },
    
    // Links to source data
    supportResponseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AgentResponse'
    },
    opposeResponseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AgentResponse'
    },
    
    // Status
    status: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing'
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date
});

// Indexes
synthesisResultSchema.index({ sessionId: 1, createdAt: -1 });
synthesisResultSchema.index({ verdict: 1, confidence: -1 });
synthesisResultSchema.index({ status: 1 });

// Virtual for formatted verdict
synthesisResultSchema.virtual('formattedVerdict').get(function() {
    const confidencePercent = Math.round(this.confidence * 100);
    if (this.verdict === 'support') {
        return `Support wins with ${confidencePercent}% confidence`;
    } else if (this.verdict === 'oppose') {
        return `Oppose wins with ${confidencePercent}% confidence`;
    } else if (this.verdict === 'inconclusive') {
        return `Inconclusive (${confidencePercent}% confidence)`;
    } else {
        return `Mixed verdict (${confidencePercent}% confidence)`;
    }
});

// Method to get verdict color for UI
synthesisResultSchema.methods.getVerdictColor = function() {
    switch(this.verdict) {
        case 'support': return '#10b981'; // green
        case 'oppose': return '#ef4444'; // red
        case 'inconclusive': return '#6b7280'; // gray
        case 'mixed': return '#f59e0b'; // amber
        default: return '#6b7280';
    }
};

// Method to format for frontend
synthesisResultSchema.methods.formatForFrontend = function() {
    return {
        id: this._id,
        synthesisPairId: this.synthesisPairId,
        verdict: this.verdict,
        formattedVerdict: this.formattedVerdict,
        confidence: this.confidence,
        confidencePercent: Math.round(this.confidence * 100),
        reasoning: this.reasoning,
        verdictColor: this.getVerdictColor(),
        scores: this.mlScores,
        keyEvidence: this.keyEvidence,
        processingTime: this.processingMetrics?.totalTimeMs || 0,
        createdAt: this.createdAt,
        models: this.modelsUsed
    };
};

const SynthesisResult = mongoose.models.SynthesisResult || 
    mongoose.model('SynthesisResult', synthesisResultSchema);

export default SynthesisResult;