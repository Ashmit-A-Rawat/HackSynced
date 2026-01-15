import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Evidence from '../models/Evidence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback in-memory storage if MongoDB is unavailable
const evidenceStore = new Map();
const evidenceIdStore = new Map();

class DocumentService {
    constructor() {
        this.uploadDir = path.join(__dirname, '../uploads');
        this.ensureUploadDir();
    }

    ensureUploadDir() {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    isMongoDBConnected() {
        return mongoose.connection.readyState === 1;
    }

    async processDocument(file, sessionId) {
        try {
            const currentSessionId = sessionId || uuidv4();
            
            console.log(`📤 Processing document: ${file.originalname} (${file.mimetype})`);
            console.log(`📝 Session ID: ${currentSessionId}`);
            console.log(`📏 File size: ${(file.size / 1024).toFixed(2)} KB`);
            
            // Extract text
            let text = '';
            if (file.mimetype === 'application/pdf') {
                text = await this.extractTextFromPDF(file.buffer);
            } else if (file.mimetype === 'text/plain') {
                text = file.buffer.toString('utf-8');
            } else {
                text = file.buffer.toString('utf-8', 0, Math.min(file.buffer.length, 100000));
            }
            
            if (!text.trim()) {
                throw new Error('No text could be extracted from the document.');
            }
            
            console.log(`📄 Extracted ${text.length} characters, ${text.split(/\s+/).length} words`);
            
            // Analyze document type
            const docType = this.analyzeDocumentType(text);
            console.log(`📋 Document type detected: ${docType}`);
            
            // Process text and extract evidence
            const result = this.processText(text, file.originalname, docType);
            
            // Create evidence object
            const evidenceData = {
                sessionId: currentSessionId,
                fileName: file.originalname,
                fileType: file.mimetype,
                documentType: docType,
                originalTextLength: text.length,
                wordCount: text.split(/\s+/).length,
                totalChunks: result.total_chunks,
                evidenceChunks: result.evidence.map((chunk, index) => ({
                    chunkId: chunk.id || index,
                    text: chunk.text,
                    relevanceScore: chunk.relevance_score || (0.8 - (index * 0.1)),
                    length: chunk.length || chunk.text.split(' ').length,
                    position: chunk.position || 'middle'
                })),
                metadata: {
                    ...result.metadata,
                    documentType: docType,
                    processingStrategy: result.processing_strategy
                },
                summary: this.generateDocumentSummary(text, docType),
                status: 'processed',
                createdAt: new Date()
            };
            
            let savedEvidence;
            
            // Try to save to MongoDB first
            if (this.isMongoDBConnected()) {
                try {
                    savedEvidence = await Evidence.create(evidenceData);
                    console.log(`💾 Evidence saved to MongoDB: ${savedEvidence._id}`);
                } catch (dbError) {
                    console.warn('⚠️  MongoDB save failed, using in-memory storage:', dbError.message);
                    savedEvidence = this.saveToMemory(evidenceData);
                }
            } else {
                console.log('⚠️  MongoDB not connected, using in-memory storage');
                savedEvidence = this.saveToMemory(evidenceData);
            }
            
            console.log(`📊 Extracted ${result.evidence.length} evidence chunks`);
            console.log(`🎯 Processing strategy: ${result.processing_strategy}`);
            
            return {
                success: true,
                sessionId: currentSessionId,
                evidenceId: savedEvidence._id.toString(),
                documentType: docType,
                totalChunks: result.total_chunks,
                evidenceCount: result.evidence.length,
                data: {
                    evidence: result.evidence,
                    summary: evidenceData.summary,
                    metadata: result.metadata
                }
            };

        } catch (error) {
            console.error('❌ Document processing error:', error);
            throw new Error(`Document processing failed: ${error.message}`);
        }
    }

    async extractTextFromPDF(buffer) {
        try {
            // First try: Use pdf-parse library (most reliable for Node.js)
            try {
                const pdfParse = await import('pdf-parse');
                const data = await pdfParse.default(buffer);
                
                if (data.text && data.text.trim()) {
                    console.log(`✅ pdf-parse success: ${data.numpages} pages, ${data.text.length} chars`);
                    return data.text;
                }
            } catch (pdfParseError) {
                console.warn('⚠️ pdf-parse failed:', pdfParseError.message);
            }
            
            // Second try: Use Python RAG processor (for better extraction)
            try {
                const { spawn } = await import('child_process');
                const fs = await import('fs');
                const { promisify } = await import('util');
                const writeFile = promisify(fs.writeFile);
                const unlink = promisify(fs.unlink);
                const path = await import('path');
                const os = await import('os');
                
                // Save buffer to temp file
                const tempDir = os.tmpdir();
                const tempFilePath = path.join(tempDir, `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`);
                await writeFile(tempFilePath, buffer);
                
                // Call Python processor
                const pythonScriptPath = path.join(__dirname, 'rag_processor.py');
                
                return new Promise((resolve, reject) => {
                    const pythonProcess = spawn('python', [pythonScriptPath, tempFilePath]);
                    
                    let output = '';
                    let errorOutput = '';
                    let timeoutId;
                    
                    // Set timeout for Python process
                    timeoutId = setTimeout(() => {
                        pythonProcess.kill();
                        reject(new Error('Python processor timeout'));
                    }, 30000); // 30 second timeout
                    
                    pythonProcess.stdout.on('data', (data) => {
                        output += data.toString();
                    });
                    
                    pythonProcess.stderr.on('data', (data) => {
                        errorOutput += data.toString();
                    });
                    
                    pythonProcess.on('close', async (code) => {
                        clearTimeout(timeoutId);
                        
                        // Clean up temp file
                        try {
                            await unlink(tempFilePath);
                        } catch (e) {
                            console.warn('Could not delete temp file:', e.message);
                        }
                        
                        if (code === 0 && output) {
                            try {
                                // Parse Python output
                                const lines = output.split('\n');
                                for (const line of lines) {
                                    if (line.startsWith('JSON_RESULT:')) {
                                        const jsonStr = line.substring(12);
                                        const result = JSON.parse(jsonStr);
                                        if (result.success && result.text) {
                                            console.log('✅ Python processor extracted text');
                                            resolve(result.text);
                                            return;
                                        }
                                    }
                                }
                                reject(new Error('Python processor returned no valid text'));
                            } catch (e) {
                                reject(new Error(`Failed to parse Python output: ${e.message}`));
                            }
                        } else {
                            reject(new Error(`Python processor failed (code ${code}): ${errorOutput}`));
                        }
                    });
                    
                    pythonProcess.on('error', (err) => {
                        clearTimeout(timeoutId);
                        reject(new Error(`Python process error: ${err.message}`));
                    });
                });
            } catch (pythonError) {
                console.warn('⚠️ Python processor failed:', pythonError.message);
            }
            
            // Third try: Basic binary extraction (fallback)
            console.log('⚠️ Using basic PDF extraction fallback');
            let text = '';
            
            try {
                // Convert buffer to string with different encodings
                const encodings = ['latin1', 'binary', 'utf8', 'ascii'];
                
                for (const encoding of encodings) {
                    try {
                        const bufferStr = buffer.toString(encoding);
                        
                        // Method 1: Extract text between parentheses (common in PDF)
                        const textMatches = bufferStr.match(/\(([^)]+)\)/g);
                        if (textMatches) {
                            textMatches.forEach(match => {
                                const content = match.slice(1, -1);
                                const cleaned = content
                                    .replace(/\\([0-7]{1,3})/g, (match, octal) => {
                                        return String.fromCharCode(parseInt(octal, 8));
                                    })
                                    .replace(/\\[nrt]/g, ' ')
                                    .replace(/\\\\/g, '\\')
                                    .replace(/[^\x20-\x7E\s]/g, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim();
                                
                                if (cleaned.length > 3) {
                                    text += cleaned + ' ';
                                }
                            });
                        }
                        
                        // Method 2: Look for text operators
                        const textOperators = bufferStr.match(/T[dmj]?\s*\(([^)]+)\)/g);
                        if (textOperators) {
                            textOperators.forEach(operator => {
                                const match = operator.match(/\(([^)]+)\)/);
                                if (match) {
                                    const content = match[1];
                                    const cleaned = content
                                        .replace(/\\([0-7]{1,3})/g, (match, octal) => {
                                            return String.fromCharCode(parseInt(octal, 8));
                                        })
                                        .replace(/\\[^\s]/g, ' ')
                                        .replace(/[^\x20-\x7E\s]/g, ' ')
                                        .replace(/\s+/g, ' ')
                                        .trim();
                                    
                                    if (cleaned.length > 3) {
                                        text += cleaned + ' ';
                                    }
                                }
                            });
                        }
                        
                        // Method 3: Look for readable text patterns
                        const words = bufferStr.match(/[A-Za-z][A-Za-z\s]{3,}[A-Za-z]/g);
                        if (words && text.length < 100) {
                            words.forEach(word => {
                                const cleaned = word
                                    .replace(/[^\x20-\x7E\s]/g, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim();
                                
                                if (cleaned.length > 5) {
                                    text += cleaned + ' ';
                                }
                            });
                        }
                        
                        if (text.length > 100) break;
                    } catch (e) {
                        continue; // Try next encoding
                    }
                }
                
                // Clean up the extracted text
                text = text
                    .replace(/\s+/g, ' ')
                    .replace(/\s+\.\s+/g, '. ')
                    .replace(/\s+,\s+/g, ', ')
                    .trim();
                
                // If we have decent text, return it
                if (text.trim() && text.length > 50) {
                    console.log(`⚠️ Basic extraction got ${text.length} characters`);
                    return text;
                }
                
            } catch (fallbackError) {
                console.warn('Basic extraction error:', fallbackError.message);
            }
            
            // Ultimate fallback: Convert buffer to string with replacements
            const fallbackText = buffer.toString('utf8', 0, Math.min(buffer.length, 100000))
                .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            if (!fallbackText.trim() || fallbackText.length < 50) {
                throw new Error('Could not extract readable text from PDF. Please try uploading a text file or a different PDF format.');
            }
            
            console.log(`⚠️ Using utf8 fallback: ${fallbackText.length} characters`);
            return fallbackText;
            
        } catch (error) {
            console.error('❌ All PDF extraction methods failed:', error.message);
            throw new Error(`PDF extraction failed: ${error.message}. Try uploading a .txt file for best results.`);
        }
    }

    saveToMemory(evidenceData) {
        const evidenceId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const evidence = { _id: evidenceId, ...evidenceData, createdAt: new Date() };
        
        evidenceStore.set(evidenceData.sessionId, evidence);
        evidenceIdStore.set(evidenceId, evidence);
        
        console.log(`💾 Evidence stored in memory: ${evidenceId}`);
        return evidence;
    }

    async getEvidenceBySessionId(sessionId) {
        try {
            console.log(`🔍 Querying evidence for session: ${sessionId}`);
            
            // Try MongoDB first
            if (this.isMongoDBConnected()) {
                const evidence = await Evidence.findOne({ sessionId })
                    .sort({ createdAt: -1 })
                    .lean();
                
                if (evidence) {
                    console.log(`📊 Found evidence in MongoDB: ${evidence._id}`);
                    return evidence;
                }
            }
            
            // Fallback to memory
            const memEvidence = evidenceStore.get(sessionId);
            if (memEvidence) {
                console.log(`📊 Found evidence in memory`);
            }
            
            return memEvidence;
        } catch (error) {
            console.error(`❌ Error fetching evidence:`, error);
            throw new Error(`Failed to fetch evidence: ${error.message}`);
        }
    }

    async getEvidenceById(evidenceId) {
        try {
            console.log(`🔍 Querying evidence by ID: ${evidenceId}`);
            
            // Try MongoDB first
            if (this.isMongoDBConnected()) {
                const evidence = await Evidence.findById(evidenceId).lean();
                
                if (evidence) {
                    console.log(`📊 Found evidence in MongoDB`);
                    return evidence;
                }
            }
            
            // Fallback to memory
            const memEvidence = evidenceIdStore.get(evidenceId);
            if (memEvidence) {
                console.log(`📊 Found evidence in memory`);
            }
            
            return memEvidence;
        } catch (error) {
            console.error(`❌ Error fetching evidence:`, error);
            throw new Error(`Failed to fetch evidence: ${error.message}`);
        }
    }

    // Format evidence for Gemini agents (human-readable)
    async getEvidenceForGemini(sessionId) {
    try {
        let evidence;
        
        if (this.isMongoDBConnected()) {
            evidence = await Evidence.findOne({ sessionId }).sort({ createdAt: -1 });
            
            if (evidence && evidence.formatForGemini) {
                const formatted = evidence.formatForGemini();
                // Ensure average_relevance is included
                if (!formatted.metadata.average_relevance) {
                    const avgRelevance = evidence.evidenceChunks.reduce((acc, chunk) => acc + chunk.relevanceScore, 0) / evidence.evidenceChunks.length;
                    formatted.metadata.average_relevance = `${(avgRelevance * 100).toFixed(1)}%`;
                }
                return formatted;
            }
        } else {
            evidence = evidenceStore.get(sessionId);
        }
        
        if (!evidence) {
            throw new Error('Evidence not found');
        }
        
        // ✅ FIX: Calculate average relevance
        const avgRelevance = evidence.evidenceChunks.reduce((acc, chunk) => acc + chunk.relevanceScore, 0) / evidence.evidenceChunks.length;
        
        // Manual formatting if not using MongoDB methods
        return {
            document_context: {
                file_name: evidence.fileName,
                document_type: evidence.documentType,
                word_count: evidence.wordCount,
                summary: evidence.summary
            },
            evidence_chunks: evidence.evidenceChunks.map((chunk, index) => ({
                chunk_number: index + 1,
                relevance_score: `${(chunk.relevanceScore * 100).toFixed(1)}%`,
                position_in_document: chunk.position,
                word_count: chunk.length,
                text: chunk.text
            })),
            metadata: {
                total_chunks_analyzed: evidence.totalChunks,
                evidence_chunks_selected: evidence.evidenceChunks.length,
                average_relevance: `${(avgRelevance * 100).toFixed(1)}%`,  // ✅ ADDED
                processing_strategy: evidence.metadata?.processingStrategy
            }
        };
    } catch (error) {
        console.error('❌ Error formatting evidence for Gemini:', error);
        throw error;
    }
}

    // All existing helper methods remain the same...
    analyzeDocumentType(text) {
        const lowerText = text.toLowerCase();
        
        const patterns = {
            'resume/cv': [
                'resume', 'curriculum vitae', 'cv', 'experience', 'skills', 'education',
                'work history', 'professional summary', 'objective', 'references'
            ],
            'academic paper': [
                'abstract', 'introduction', 'methodology', 'results', 'discussion',
                'conclusion', 'references', 'citation', 'figure', 'table'
            ],
            'report': [
                'report', 'executive summary', 'findings', 'recommendations',
                'appendix', 'annex', 'to:', 'from:', 'date:', 'subject:'
            ],
            'article/blog': [
                'article', 'blog', 'post', 'by', 'published', 'read more',
                'comments', 'share', 'tags', 'category'
            ],
            'legal document': [
                'whereas', 'hereinafter', 'party', 'agreement', 'contract',
                'clause', 'section', 'subsection', 'witness', 'signature'
            ],
            'technical documentation': [
                'api', 'function', 'parameter', 'returns', 'example',
                'installation', 'configuration', 'usage', 'troubleshooting'
            ],
            'email/letter': [
                'dear', 'sincerely', 'regards', 'to whom it may concern',
                'subject:', 're:', 'fw:', 'cc:', 'bcc:'
            ]
        };
        
        let maxScore = 0;
        let detectedType = 'general document';
        
        for (const [docType, keywords] of Object.entries(patterns)) {
            let score = 0;
            keywords.forEach(keyword => {
                if (lowerText.includes(keyword)) {
                    score += 1;
                    const regex = new RegExp(keyword, 'gi');
                    const matches = lowerText.match(regex);
                    if (matches) score += matches.length * 0.5;
                }
            });
            
            if (score > maxScore) {
                maxScore = score;
                detectedType = docType;
            }
        }
        
        const words = lowerText.split(/\s+/);
        if (words.length < 500) detectedType = 'short document';
        if (words.length > 5000) detectedType = 'long document';
        
        return detectedType;
    }

    processText(text, fileName, docType) {
        const words = text.split(/\s+/);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        
        console.log(`📊 Text stats: ${words.length} words, ${sentences.length} sentences`);
        
        let processingStrategy = 'balanced';
        let chunkSize = 400;
        let overlap = 40;
        
        switch(docType) {
            case 'resume/cv':
                processingStrategy = 'key_sections';
                chunkSize = 300;
                overlap = 30;
                break;
            case 'academic paper':
            case 'technical documentation':
                processingStrategy = 'conceptual';
                chunkSize = 500;
                overlap = 100;
                break;
            case 'short document':
                processingStrategy = 'whole_document';
                chunkSize = Math.min(800, words.length);
                overlap = Math.floor(chunkSize / 4);
                break;
            case 'email/letter':
            case 'article/blog':
                processingStrategy = 'paragraph_based';
                chunkSize = 600;
                overlap = 50;
                break;
            default:
                processingStrategy = 'balanced';
                chunkSize = 400;
                overlap = 40;
        }
        
        const chunks = [];
        for (let i = 0; i < words.length; i += chunkSize - overlap) {
            const chunkWords = words.slice(i, i + chunkSize);
            if (chunkWords.length === 0) break;
            
            const chunk = chunkWords.join(' ');
            const position = this.getChunkPosition(i, words.length, chunkSize);
            
            chunks.push({
                id: chunks.length,
                text: chunk,
                relevance_score: this.calculateRelevance(chunk, chunks.length, docType, position),
                length: chunkWords.length,
                position: position,
                startWord: i,
                endWord: i + chunkWords.length
            });
        }
        
        console.log(`✂️ Created ${chunks.length} chunks using ${processingStrategy} strategy`);
        
        let evidence = [];
        const topK = Math.min(7, Math.ceil(chunks.length * 0.3));
        
        if (processingStrategy === 'key_sections') {
            evidence = this.extractKeySections(chunks, docType);
        } else if (processingStrategy === 'conceptual') {
            evidence = this.extractConcepts(chunks, docType);
        } else {
            evidence = this.extractDiverseChunks(chunks, topK, docType);
        }
        
        if (evidence.length === 0 && chunks.length > 0) {
            evidence = chunks.slice(0, Math.min(5, chunks.length)).map((chunk, index) => ({
                ...chunk,
                relevance_score: Math.max(0.1, 0.9 - (index * 0.15))
            }));
        }
        
        return {
            original_text_length: text.length,
            total_chunks: chunks.length,
            evidence: evidence,
            metadata: {
                model: "universal_processor",
                chunk_size: chunkSize,
                chunk_overlap: overlap,
                processor: "adaptive_text_analyzer",
                document_type: docType
            },
            processing_strategy: processingStrategy
        };
    }

    getChunkPosition(startIndex, totalWords, chunkSize) {
        const progress = startIndex / totalWords;
        if (progress < 0.2) return 'beginning';
        if (progress > 0.8) return 'end';
        return 'middle';
    }

    calculateRelevance(chunk, position, docType, chunkPosition) {
        let relevance = 0.3;
        
        if (chunkPosition === 'beginning') relevance += 0.3;
        if (chunkPosition === 'end') relevance += 0.2;
        
        const wordCount = chunk.split(' ').length;
        if (wordCount > 50 && wordCount < 300) relevance += 0.1;
        
        const uniqueWords = new Set(chunk.toLowerCase().split(' '));
        const uniqueRatio = uniqueWords.size / wordCount;
        if (uniqueRatio > 0.7) relevance += 0.1;
        
        return Math.min(0.98, Math.max(0.1, relevance));
    }

    extractKeySections(chunks, docType) {
        const sectionKeywords = {
            'experience': ['experience', 'work', 'employment', 'career'],
            'skills': ['skills', 'technologies', 'tools', 'competencies'],
            'education': ['education', 'degree', 'university', 'college'],
            'projects': ['project', 'portfolio', 'work sample'],
            'summary': ['summary', 'objective', 'profile', 'about']
        };
        
        const sectionChunks = [];
        
        for (const [section, keywords] of Object.entries(sectionKeywords)) {
            const sectionChunk = chunks.find(chunk => {
                const lowerChunk = chunk.text.toLowerCase();
                return keywords.some(keyword => lowerChunk.includes(keyword));
            });
            
            if (sectionChunk) {
                sectionChunks.push({
                    ...sectionChunk,
                    section: section,
                    relevance_score: Math.max(sectionChunk.relevance_score, 0.8)
                });
            }
        }
        
        if (sectionChunks.length < 3) {
            const beginningChunks = chunks
                .filter(chunk => chunk.position === 'beginning')
                .slice(0, 3 - sectionChunks.length);
            
            beginningChunks.forEach(chunk => {
                sectionChunks.push({
                    ...chunk,
                    section: 'introduction',
                    relevance_score: Math.max(chunk.relevance_score, 0.7)
                });
            });
        }
        
        return sectionChunks.slice(0, 5);
    }

    extractConcepts(chunks, docType) {
        return chunks
            .filter(chunk => {
                const hasConcepts = chunk.text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g);
                const hasDefinitions = chunk.text.includes('defined as') || chunk.text.includes('means');
                const hasImportantMarkers = chunk.text.match(/\bimportant\b|\bkey\b|\bcritical\b|\bsignificant\b/i);
                
                return hasConcepts || hasDefinitions || hasImportantMarkers;
            })
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 5)
            .map((chunk, index) => ({
                ...chunk,
                relevance_score: Math.max(0.1, 0.9 - (index * 0.15))
            }));
    }

    extractDiverseChunks(chunks, topK, docType) {
        const selected = [];
        const positions = ['beginning', 'middle', 'end'];
        
        for (const position of positions) {
            const positionChunks = chunks.filter(c => c.position === position);
            if (positionChunks.length > 0) {
                const bestChunk = positionChunks.reduce((best, current) => 
                    current.relevance_score > best.relevance_score ? current : best
                );
                selected.push(bestChunk);
            }
        }
        
        const remainingSlots = topK - selected.length;
        if (remainingSlots > 0) {
            const sortedChunks = chunks
                .filter(c => !selected.includes(c))
                .sort((a, b) => b.relevance_score - a.relevance_score)
                .slice(0, remainingSlots);
            
            selected.push(...sortedChunks);
        }
        
        return selected.map((chunk, index) => ({
            ...chunk,
            relevance_score: Math.max(0.1, 0.9 - (index * 0.12))
        }));
    }

    generateDocumentSummary(text, docType) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length === 0) return 'No summary available';
        
        const summarySentences = sentences.slice(0, Math.min(3, sentences.length));
        let summary = summarySentences.join('. ') + '.';
        
        if (summary.length > 300) {
            summary = summary.substring(0, 297) + '...';
        }
        
        return summary;
    }

    getAllEvidence() {
        return Array.from(evidenceStore.values());
    }
}

export default new DocumentService();