import React, { useState, useEffect } from 'react';

const EvidenceDisplay = ({ evidence }) => {
    const [sessionEvidence, setSessionEvidence] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const BACKEND_URL = 'http://localhost:5001';

    useEffect(() => {
        if (!evidence || evidence.length === 0) {
            loadStoredEvidence();
        } else {
            setSessionEvidence(null);
        }
    }, [evidence]);

    const loadStoredEvidence = async () => {
        const sessionId = localStorage.getItem('aether_session_id');
        const evidenceId = localStorage.getItem('aether_evidence_id');
        
        if (!sessionId && !evidenceId) {
            return;
        }

        setLoading(true);

        try {
            let url = `${BACKEND_URL}/api/documents/evidence?`;
            if (evidenceId) {
                url += `evidenceId=${evidenceId}`;
            } else if (sessionId) {
                url += `sessionId=${sessionId}`;
            }

            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to load evidence`);
            }

            const data = await response.json();
            
            if (data.success && data.evidence) {
                setSessionEvidence(data.evidence);
            }
        } catch (err) {
            console.error('Error loading evidence:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatEvidenceFromDB = (dbEvidence) => {
        if (!dbEvidence || !dbEvidence.evidenceChunks) return [];
        
        return dbEvidence.evidenceChunks.map((chunk, index) => ({
            id: chunk.chunkId || index,
            text: chunk.text,
            relevance_score: chunk.relevanceScore || 0.8 - (index * 0.1),
            length: chunk.length || chunk.text.split(' ').length
        }));
    };

    const displayEvidence = evidence && evidence.length > 0 
        ? evidence 
        : (sessionEvidence ? formatEvidenceFromDB(sessionEvidence) : []);

    const isFromDB = !evidence && sessionEvidence;

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 text-center">
                <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-200 to-blue-300 flex items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Loading Evidence</h3>
                </div>
            </div>
        );
    }

    if (!displayEvidence || displayEvidence.length === 0) {
        return (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 text-center">
                <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Evidence Extracted Yet</h3>
                    <p className="text-gray-500 mb-4">
                        Upload a document in Step 1 to extract and display key evidence chunks.
                    </p>
                    <button
                        onClick={loadStoredEvidence}
                        className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                    >
                        Reload Evidence
                    </button>
                </div>
            </div>
        );
    }

    const averageRelevance = displayEvidence.length > 0 
        ? Math.round(displayEvidence.reduce((acc, chunk) => acc + (chunk.relevance_score || 0.5), 0) / displayEvidence.length * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* Document Info */}
            {sessionEvidence && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h4 className="font-semibold text-gray-800 text-lg mb-2">Document Analysis</h4>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Type:</span>
                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
                                        {sessionEvidence.documentType || 'Document'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">File:</span>
                                    <span className="text-sm font-medium text-gray-700 truncate max-w-xs">{sessionEvidence.fileName}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Extracted Evidence Chunks</h3>
                <p className="text-gray-600">
                    Top evidence chunks ranked by relevance score.
                </p>
            </div>

            {/* Evidence Cards */}
            <div className="space-y-4">
                {displayEvidence.map((chunk, index) => (
                    <div 
                        key={chunk.id} 
                        className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300"
                    >
                        <div className="p-6">
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-4">
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                                        index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' :
                                        index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white' :
                                        index === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white' :
                                        'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700'
                                    }`}>
                                        #{index + 1}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-700">{chunk.length} words</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200">
                                        <span className="font-bold text-green-700">
                                            {((chunk.relevance_score || 0.5) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <p className="text-gray-700 leading-relaxed">
                                    {chunk.text}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Statistics Summary */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Evidence Statistics</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 mb-1">
                            {displayEvidence.length}
                        </div>
                        <div className="text-sm text-gray-600">Evidence Chunks</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 mb-1">
                            {averageRelevance}%
                        </div>
                        <div className="text-sm text-gray-600">Avg. Relevance</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600 mb-1">
                            {sessionEvidence?.totalChunks || displayEvidence.length}
                        </div>
                        <div className="text-sm text-gray-600">Total Chunks</div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center">
                <button
                    onClick={loadStoredEvidence}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                    Reload Evidence
                </button>
            </div>
        </div>
    );
};

export default EvidenceDisplay;