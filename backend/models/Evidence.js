import mongoose from 'mongoose';

const evidenceChunkSchema = new mongoose.Schema({
    chunkId: {
        type: Number,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    relevanceScore: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    length: {
        type: Number,
        required: true
    },
    position: {
        type: String,
        enum: ['beginning', 'middle', 'end'],
        default: 'middle'
    },
    // Optional: Store embeddings for future vector search
    embedding: {
        type: [Number],
        required: false
    }
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true,
        description: 'Unique session identifier for grouping evidence'
    },
    fileName: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        default: 'text/plain'
    },
    documentType: {
        type: String,
        default: 'general document',
        description: 'Detected document type (resume, academic paper, report, etc.)'
    },
    originalTextLength: {
        type: Number,
        required: true,
        description: 'Length of original document in characters'
    },
    wordCount: {
        type: Number,
        required: true,
        description: 'Total word count of original document'
    },
    totalChunks: {
        type: Number,
        required: true,
        description: 'Total number of chunks created from document'
    },
    evidenceChunks: {
        type: [evidenceChunkSchema],
        required: true,
        validate: {
            validator: function(chunks) {
                return chunks.length > 0;
            },
            message: 'Evidence must contain at least one chunk'
        }
    },
    metadata: {
        model: {
            type: String,
            default: 'universal_processor'
        },
        chunkSize: {
            type: Number,
            default: 500
        },
        chunkOverlap: {
            type: Number,
            default: 50
        },
        processor: {
            type: String,
            default: 'adaptive_text_analyzer'
        },
        documentType: String,
        processingStrategy: String
    },
    summary: {
        type: String,
        default: '',
        description: 'Brief summary of the document for context'
    },
    status: {
        type: String,
        enum: ['processing', 'processed', 'error'],
        default: 'processed'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '24h' // Auto-delete after 24 hours (hackathon data)
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for average relevance score
evidenceSchema.virtual('averageRelevanceScore').get(function() {
    if (!this.evidenceChunks || this.evidenceChunks.length === 0) return 0;
    
    const sum = this.evidenceChunks.reduce((acc, chunk) => acc + chunk.relevanceScore, 0);
    return (sum / this.evidenceChunks.length).toFixed(3);
});

// Method to get top N chunks
evidenceSchema.methods.getTopChunks = function(n = 3) {
    return this.evidenceChunks
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, n);
};

// Method to format for Gemini API (human-readable)
evidenceSchema.methods.formatForGemini = function() {
    return {
        document_context: {
            file_name: this.fileName,
            document_type: this.documentType,
            word_count: this.wordCount,
            summary: this.summary
        },
        evidence_chunks: this.evidenceChunks.map((chunk, index) => ({
            chunk_number: index + 1,
            relevance_score: `${(chunk.relevanceScore * 100).toFixed(1)}%`,
            position_in_document: chunk.position,
            word_count: chunk.length,
            text: chunk.text
        })),
        metadata: {
            total_chunks_analyzed: this.totalChunks,
            evidence_chunks_selected: this.evidenceChunks.length,
            average_relevance: `${(parseFloat(this.averageRelevanceScore) * 100).toFixed(1)}%`,
            processing_strategy: this.metadata.processingStrategy
        }
    };
};

// Method to get concise context for agents
evidenceSchema.methods.getConciseContext = function() {
    return `Document: ${this.fileName} (${this.documentType})
Word Count: ${this.wordCount}
Summary: ${this.summary}

Top Evidence Chunks (${this.evidenceChunks.length} total):
${this.evidenceChunks.map((chunk, i) => `
[Chunk ${i + 1}] (Relevance: ${(chunk.relevanceScore * 100).toFixed(1)}%)
${chunk.text}
`).join('\n')}`;
};

// Index for faster queries
evidenceSchema.index({ sessionId: 1, createdAt: -1 });

// Prevent model overwrite error
const Evidence = mongoose.models.Evidence || mongoose.model('Evidence', evidenceSchema);

export default Evidence;