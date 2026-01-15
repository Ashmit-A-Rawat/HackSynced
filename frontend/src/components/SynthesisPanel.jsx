import React, { useState, useEffect } from 'react';

const SynthesisPanel = ({ sessionId, supportResponseId, opposeResponseId, synthesisPairId, onClose }) => {
    const [synthesisResult, setSynthesisResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pairId, setPairId] = useState(null);
    
    const BACKEND_URL = 'http://localhost:5001';
    
    useEffect(() => {
        if (synthesisPairId) {
            setPairId(synthesisPairId);
        } else if (supportResponseId && opposeResponseId) {
            const generatedPairId = `${supportResponseId}_${opposeResponseId}`;
            setPairId(generatedPairId);
        }
    }, [synthesisPairId, supportResponseId, opposeResponseId]);
    
    const runSynthesis = async () => {
        if (!pairId) {
            setError('No synthesis pair available');
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            console.log('🔄 Running synthesis for pair:', pairId);
            
            const response = await fetch(`${BACKEND_URL}/api/synthesis/run/${pairId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            console.log('📊 Synthesis response:', data);
            
            if (data.success) {
                setSynthesisResult(data.result);
                console.log('✅ Synthesis completed successfully');
            } else {
                setError(data.error || 'Synthesis failed');
            }
        } catch (err) {
            console.error('❌ Synthesis error:', err);
            setError(err.message || 'Failed to run synthesis');
        } finally {
            setLoading(false);
        }
    };
    
    const getVerdictColor = (verdict) => {
        switch(verdict) {
            case 'support': return 'bg-emerald-500 border-emerald-500';
            case 'oppose': return 'bg-red-500 border-red-500';
            case 'inconclusive': return 'bg-gray-500 border-gray-500';
            case 'mixed': return 'bg-amber-500 border-amber-500';
            default: return 'bg-gray-500 border-gray-500';
        }
    };
    
    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.8) return 'bg-emerald-500';
        if (confidence >= 0.6) return 'bg-amber-500';
        return 'bg-red-500';
    };
    
    // ⭐ HELPER: Get score safely from either scores or mlScores
    const getScore = (path) => {
        if (!synthesisResult) return 0.5;
        
        // Try scores first (from formatForFrontend)
        const parts = path.split('.');
        let value = synthesisResult.scores;
        for (const part of parts) {
            if (value && value[part] !== undefined) {
                value = value[part];
            } else {
                break;
            }
        }
        
        if (typeof value === 'number') return value;
        
        // Fallback to mlScores (from MongoDB)
        value = synthesisResult.mlScores;
        for (const part of parts) {
            if (value && value[part] !== undefined) {
                value = value[part];
            } else {
                break;
            }
        }
        
        return typeof value === 'number' ? value : 0.5;
    };
    
    if (!pairId) {
        return (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">🧠 AI Synthesis</h2>
                        {onClose && (
                            <button 
                                onClick={onClose}
                                className="text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>
                <div className="p-6 text-center text-gray-500">
                    <p>Waiting for agent responses to synthesize...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">🧠 AI Synthesis Verdict</h2>
                    {onClose && (
                        <button 
                            onClick={onClose}
                            className="text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>
            
            <div className="p-6">
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700">{error}</p>
                    </div>
                )}
                
                {!synthesisResult && !loading && (
                    <div className="mb-6 p-6 bg-gray-50 rounded-lg">
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">Ready for ML Synthesis</h3>
                            <p className="text-gray-600 mb-4">
                                Analyze the debate using ML models:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-2xl mb-2">🤖</div>
                                    <h4 className="font-medium text-gray-800">DeBERTa</h4>
                                    <p className="text-sm text-gray-600">Evidence strength analysis</p>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-2xl mb-2">🔍</div>
                                    <h4 className="font-medium text-gray-800">RoBERTa MNLI</h4>
                                    <p className="text-sm text-gray-600">Contradiction detection</p>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <div className="text-2xl mb-2">📈</div>
                                    <h4 className="font-medium text-gray-800">XGBoost + Grok</h4>
                                    <p className="text-sm text-gray-600">Confidence & Explanation</p>
                                </div>
                            </div>
                            <button 
                                onClick={runSynthesis}
                                disabled={loading}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                Run ML Synthesis
                            </button>
                        </div>
                    </div>
                )}
                
                {loading && (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-700 font-medium mb-4">Running ML synthesis pipeline...</p>
                        <div className="space-y-2 max-w-md mx-auto">
                            <div className="flex items-center text-sm text-gray-600">
                                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 animate-pulse"></div>
                                Analyzing evidence with DeBERTa
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <div className="w-3 h-3 bg-purple-500 rounded-full mr-3 animate-pulse" style={{animationDelay: '0.2s'}}></div>
                                Detecting contradictions with RoBERTa
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse" style={{animationDelay: '0.4s'}}></div>
                                Calculating confidence with XGBoost
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <div className="w-3 h-3 bg-amber-500 rounded-full mr-3 animate-pulse" style={{animationDelay: '0.6s'}}></div>
                                Generating AI explanation
                            </div>
                        </div>
                    </div>
                )}
                
                {synthesisResult && (
                    <div className="space-y-6">
                        {/* VERDICT CARD */}
                        <div className={`border-l-4 ${getVerdictColor(synthesisResult.verdict).split(' ')[1]} bg-white rounded-r-lg shadow-sm p-6`}>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold text-gray-800">Final Verdict</h3>
                                <span className={`px-4 py-1.5 rounded-full text-white font-medium ${getVerdictColor(synthesisResult.verdict).split(' ')[0]}`}>
                                    {synthesisResult.verdict.toUpperCase()}
                                </span>
                            </div>
                            
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-700 font-medium">
                                        Confidence: {Math.round(synthesisResult.confidence * 100)}%
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                        synthesisResult.confidence >= 0.8 ? 'bg-emerald-100 text-emerald-800' :
                                        synthesisResult.confidence >= 0.6 ? 'bg-amber-100 text-amber-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {synthesisResult.confidence >= 0.8 ? 'High' : 
                                         synthesisResult.confidence >= 0.6 ? 'Medium' : 'Low'}
                                    </span>
                                </div>
                                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${getConfidenceColor(synthesisResult.confidence)} transition-all duration-500`}
                                        style={{ width: `${synthesisResult.confidence * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-2">AI Reasoning (Grok Enhanced)</h4>
                                <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">
                                    {synthesisResult.reasoning}
                                </p>
                            </div>
                        </div>
                        
                        {/* ML SCORES GRID */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-4">ML Analysis Scores</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Evidence Strength */}
                                <div className="bg-white border rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-700 mb-3">Evidence Strength</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-600">Support</span>
                                                <span className="font-medium text-emerald-600">
                                                    {Math.round(getScore('support.strength') * 100)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500"
                                                    style={{ width: `${getScore('support.strength') * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-600">Oppose</span>
                                                <span className="font-medium text-red-600">
                                                    {Math.round(getScore('oppose.strength') * 100)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-red-500"
                                                    style={{ width: `${getScore('oppose.strength') * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Evidence Coverage */}
                                <div className="bg-white border rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-700 mb-3">Evidence Coverage</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-600">Support</span>
                                                <span className="font-medium text-emerald-600">
                                                    {Math.round(getScore('support.coverage') * 100)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500"
                                                    style={{ width: `${getScore('support.coverage') * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-600">Oppose</span>
                                                <span className="font-medium text-red-600">
                                                    {Math.round(getScore('oppose.coverage') * 100)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-red-500"
                                                    style={{ width: `${getScore('oppose.coverage') * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Argument Consistency */}
                                <div className="bg-white border rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-700 mb-3">Argument Consistency</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-600">Support</span>
                                                <span className="font-medium text-emerald-600">
                                                    {Math.round(getScore('support.consistency') * 100)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500"
                                                    style={{ width: `${getScore('support.consistency') * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-600">Oppose</span>
                                                <span className="font-medium text-red-600">
                                                    {Math.round(getScore('oppose.consistency') * 100)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-red-500"
                                                    style={{ width: `${getScore('oppose.consistency') * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Evidence Quality */}
                                <div className="bg-white border rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-700 mb-3">Evidence Quality</h4>
                                    <div className="flex items-center justify-center">
                                        <div className="relative">
                                            <svg className="w-24 h-24" viewBox="0 0 100 100">
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r="45"
                                                    fill="none"
                                                    stroke="#e5e7eb"
                                                    strokeWidth="8"
                                                />
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r="45"
                                                    fill="none"
                                                    stroke="#10b981"
                                                    strokeWidth="8"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${getScore('evidence.quality_score') * 283} 283`}
                                                    transform="rotate(-90 50 50)"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-2xl font-bold text-gray-800">
                                                    {Math.round(getScore('evidence.quality_score') * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-center text-sm text-gray-600 mt-2">
                                        Based on diversity and relevance
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* KEY EVIDENCE */}
                        {synthesisResult.keyEvidence && synthesisResult.keyEvidence.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Key Evidence</h3>
                                <div className="space-y-4">
                                    {synthesisResult.keyEvidence.map((evidence, index) => (
                                        <div key={index} className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                                                    Chunk {evidence.chunkId}
                                                </span>
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                    evidence.verdictImpact > 0 ? 'bg-emerald-100 text-emerald-800' :
                                                    evidence.verdictImpact < 0 ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    Impact: {evidence.verdictImpact > 0 ? '+' : ''}
                                                    {Math.round(evidence.verdictImpact * 100)}%
                                                </span>
                                            </div>
                                            <p className="text-gray-700 mb-3">{evidence.text}</p>
                                            <div className="flex items-center text-sm text-gray-600">
                                                <span className="mr-2">Used by:</span>
                                                {evidence.usedBy && evidence.usedBy.map(agent => (
                                                    <span 
                                                        key={agent}
                                                        className={`px-2 py-1 rounded text-xs font-medium mr-2 ${
                                                            agent === 'support' ? 'bg-emerald-100 text-emerald-800' :
                                                            'bg-red-100 text-red-800'
                                                        }`}
                                                    >
                                                        {agent}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* PROCESSING INFO */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-700 mb-3">Processing Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Total Time</p>
                                    <p className="font-medium text-gray-800">{synthesisResult.processingTime || 0}ms</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Models Used</p>
                                    <p className="font-medium text-gray-800">DeBERTa, RoBERTa, XGBoost, Grok</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Pipeline</p>
                                    <p className="font-medium text-gray-800">ML-first synthesis</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-center pt-4">
                            <button 
                                onClick={runSynthesis}
                                disabled={loading}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : 'Re-run Synthesis'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SynthesisPanel;