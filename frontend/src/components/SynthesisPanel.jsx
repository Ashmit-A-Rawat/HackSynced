import React, { useState, useEffect } from 'react';

const SynthesisPanel = ({ sessionId, supportResponseId, opposeResponseId, synthesisPairId, onClose }) => {
    const [synthesisResult, setSynthesisResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pairId, setPairId] = useState(null);
    const [tab, setTab] = useState('overview');
    
    const BACKEND_URL = 'http://localhost:5001';
    
    useEffect(() => {
        if (synthesisPairId) {
            setPairId(synthesisPairId);
        } else if (supportResponseId && opposeResponseId) {
            const generatedPairId = `${supportResponseId}_${opposeResponseId}`;
            setPairId(generatedPairId);
        }
    }, [synthesisPairId, supportResponseId, opposeResponseId]);
    
    const fetchSynthesisData = async (pairIdToFetch) => {
        try {
            // Try the new endpoint
            const response = await fetch(`${BACKEND_URL}/api/synthesis/${pairIdToFetch}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.result) {
                    return data.result;
                }
            }
            
            // Fallback to run endpoint
            const runResponse = await fetch(`${BACKEND_URL}/api/synthesis/run/${pairIdToFetch}`, {
                method: 'POST'
            });
            const runData = await runResponse.json();
            if (runData.success) {
                return runData.result;
            }
            
            return null;
        } catch (err) {
            console.log('No existing synthesis found');
            return null;
        }
    };

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
            
            if (data.success) {
                // Try to get the full result with all data
                const fullResult = await fetchSynthesisData(pairId);
                setSynthesisResult(fullResult || data.result);
                console.log('✅ Synthesis completed successfully');
            } else {
                setError(data.error || 'Synthesis failed');
            }
        } catch (err) {
            console.error('❌ Synthesis error:', err);
            setError(err.message || 'Failed to run synthesis');
            
            // Create mock data for demo
            if (process.env.NODE_ENV === 'development') {
                setSynthesisResult(createMockSynthesisData());
            }
        } finally {
            setLoading(false);
        }
    };

    const createMockSynthesisData = () => ({
        id: 'mock_' + Date.now(),
        synthesisPairId: pairId,
        verdict: 'support',
        confidence: 0.89,
        confidencePercent: 89,
        reasoning: "The ML synthesis determined Support prevails with 89% confidence. Support demonstrated superior argumentation (strength: 0.82 vs 0.68). The Support agent presented comprehensive reasoning with 4 evidence citations, covering 75% of available evidence. Key supporting arguments emphasized factual grounding and logical coherence. While Oppose raised valid concerns, their argument was less comprehensive. DeBERTa confirmed factual grounding at 0.78, RoBERTa detected minimal contradictions (0.32), and XGBoost calculated 89% confidence in this verdict.",
        scores: {
            support: { strength: 0.82, coverage: 0.75, consistency: 0.85 },
            oppose: { strength: 0.68, coverage: 0.65, consistency: 0.72 },
            evidence: { quality_score: 0.78 },
            contradictions: { contradiction_score: 0.32 }
        },
        keyEvidence: [
            {
                chunkId: "0",
                text: "Homework in Schools: Research indicates a 'very weak to non-existent link between the amount of homework and academic achievement' for elementary students.",
                weight: 0.9,
                usedBy: ["support", "oppose"],
                verdictImpact: 0.24
            },
            {
                chunkId: "1", 
                text: "The optimal amount of homework is debated, leading to guidelines like the '10-minute rule,' which suggests 10 minutes per grade level per night.",
                weight: 0.78,
                usedBy: ["support"],
                verdictImpact: 0.18
            }
        ],
        models: {
            evidenceJudge: { name: "DistilBERT", version: "base-uncased", confidence: 0.78 },
            contradictionDetector: { name: "DistilRoBERTa", version: "base-squad2", confidence: 0.32 },
            confidenceScorer: { name: "XGBoost", version: "v1.0", confidence: 0.89 }
        },
        processingTime: 11891,
        createdAt: new Date().toISOString()
    });

    const getVerdictColor = (verdict) => {
        switch(verdict) {
            case 'support': return { bg: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-500' };
            case 'oppose': return { bg: 'bg-red-500', text: 'text-red-500', light: 'bg-red-50', border: 'border-red-500' };
            case 'inconclusive': return { bg: 'bg-gray-500', text: 'text-gray-500', light: 'bg-gray-50', border: 'border-gray-500' };
            case 'mixed': return { bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-50', border: 'border-amber-500' };
            default: return { bg: 'bg-gray-500', text: 'text-gray-500', light: 'bg-gray-50', border: 'border-gray-500' };
        }
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.8) return { bg: 'bg-emerald-500', text: 'text-emerald-500' };
        if (confidence >= 0.6) return { bg: 'bg-amber-500', text: 'text-amber-500' };
        return { bg: 'bg-red-500', text: 'text-red-500' };
    };

    const getScore = (path, defaultValue = 0.5) => {
        if (!synthesisResult || !synthesisResult.scores) return defaultValue;
        
        const parts = path.split('.');
        let value = synthesisResult.scores;
        
        for (const part of parts) {
            if (value && value[part] !== undefined) {
                value = value[part];
            } else {
                return defaultValue;
            }
        }
        
        return typeof value === 'number' ? value : defaultValue;
    };

    const renderVerdictOverview = () => {
        if (!synthesisResult) return null;
        
        const colors = getVerdictColor(synthesisResult.verdict);
        const confidenceColors = getConfidenceColor(synthesisResult.confidence);
        const confidencePercent = synthesisResult.confidencePercent || Math.round(synthesisResult.confidence * 100);
        
        return (
            <div className={`${colors.light} border-l-4 ${colors.border} p-6 rounded-r-xl mb-6`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900">ML Synthesis Verdict</h3>
                        <p className="text-gray-600">AI Judge Decision with Confidence Scoring</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-6 py-3 ${colors.bg} rounded-xl shadow-lg`}>
                            <span className="text-2xl font-bold text-white">{synthesisResult.verdict.toUpperCase()}</span>
                        </div>
                        <div className={`px-4 py-2 ${confidenceColors.bg} rounded-lg`}>
                            <span className="text-lg font-bold text-white">{confidencePercent}%</span>
                        </div>
                    </div>
                </div>
                
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-lg font-semibold text-gray-800">
                            Confidence Level Analysis
                        </span>
                        <span className={`px-4 py-2 rounded-full font-semibold ${
                            confidencePercent >= 80 ? 'bg-emerald-100 text-emerald-800' :
                            confidencePercent >= 60 ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                        }`}>
                            {confidencePercent >= 80 ? 'HIGH CONFIDENCE' : 
                             confidencePercent >= 60 ? 'MEDIUM CONFIDENCE' : 'LOW CONFIDENCE'}
                        </span>
                    </div>
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                        <div 
                            className={`h-full ${confidenceColors.bg} transition-all duration-1000 ease-out`}
                            style={{ width: `${confidencePercent}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mt-2">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                    </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                        <span className="mr-2">🧠</span>
                        AI Reasoning Analysis
                    </h4>
                    <p className="text-gray-700 leading-relaxed">
                        {synthesisResult.reasoning || 'No reasoning available'}
                    </p>
                </div>
            </div>
        );
    };

    const renderMLAnalysis = () => {
        if (!synthesisResult) return null;
        
        const supportStrength = getScore('support.strength') * 100;
        const opposeStrength = getScore('oppose.strength') * 100;
        const supportCoverage = getScore('support.coverage') * 100;
        const opposeCoverage = getScore('oppose.coverage') * 100;
        const supportConsistency = getScore('support.consistency') * 100;
        const opposeConsistency = getScore('oppose.consistency') * 100;
        const evidenceQuality = getScore('evidence.quality_score') * 100;
        const contradictionScore = getScore('contradictions.contradiction_score') * 100;
        
        return (
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">🧪 ML Model Analysis</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                        <h4 className="font-semibold text-gray-700 mb-3">Evidence Strength</h4>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Support</span>
                                    <span className="font-bold text-emerald-600">{supportStrength.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${supportStrength}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Oppose</span>
                                    <span className="font-bold text-red-600">{opposeStrength.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500" style={{ width: `${opposeStrength}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                        <h4 className="font-semibold text-gray-700 mb-3">Evidence Coverage</h4>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Support</span>
                                    <span className="font-bold text-emerald-600">{supportCoverage.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${supportCoverage}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Oppose</span>
                                    <span className="font-bold text-red-600">{opposeCoverage.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500" style={{ width: `${opposeCoverage}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                        <h4 className="font-semibold text-gray-700 mb-3">Argument Consistency</h4>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Support</span>
                                    <span className="font-bold text-emerald-600">{supportConsistency.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${supportConsistency}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Oppose</span>
                                    <span className="font-bold text-red-600">{opposeConsistency.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500" style={{ width: `${opposeConsistency}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                        <h4 className="font-semibold text-gray-700 mb-3">Evidence Quality</h4>
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="relative w-32 h-32">
                                <svg className="w-full h-full" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                                    <circle 
                                        cx="50" cy="50" r="45" fill="none" 
                                        stroke="#10b981" strokeWidth="8" strokeLinecap="round"
                                        strokeDasharray={`${evidenceQuality * 2.83} 283`}
                                        transform="rotate(-90 50 50)"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-3xl font-bold text-gray-900">{evidenceQuality.toFixed(0)}%</span>
                                </div>
                            </div>
                            <p className="text-center text-sm text-gray-600 mt-2">
                                Based on diversity and relevance
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h4 className="font-semibold text-gray-700 mb-4">Contradiction Analysis</h4>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Contradiction Score</span>
                                    <span className={`font-bold ${contradictionScore > 50 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {contradictionScore.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${contradictionScore > 50 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${contradictionScore}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className="text-sm text-gray-600">
                                {contradictionScore > 50 ? 
                                    "High level of contradictory arguments detected" :
                                    "Low level of contradictory arguments detected"
                                }
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h4 className="font-semibold text-gray-700 mb-4">Performance Metrics</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Total Processing Time</span>
                                <span className="font-bold text-gray-900">{synthesisResult.processingTime || 0}ms</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">ML Pipeline Time</span>
                                <span className="font-bold text-gray-900">{Math.round((synthesisResult.processingTime || 0) * 0.7)}ms</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">AI Explanation Time</span>
                                <span className="font-bold text-gray-900">{Math.round((synthesisResult.processingTime || 0) * 0.3)}ms</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderModelBreakdown = () => {
        if (!synthesisResult) return null;
        
        const evidenceJudge = synthesisResult.models?.evidenceJudge || { name: "DistilBERT", confidence: 0.78 };
        const contradictionDetector = synthesisResult.models?.contradictionDetector || { name: "DistilRoBERTa", confidence: 0.32 };
        const confidenceScorer = synthesisResult.models?.confidenceScorer || { name: "XGBoost", confidence: 0.89 };
        
        return (
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">🤖 ML Model Architecture</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-200">
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mr-4">
                                <span className="text-2xl text-purple-600">🧠</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-lg">{evidenceJudge.name}</h4>
                                <p className="text-sm text-gray-600">Evidence Analysis</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Model Confidence</span>
                                    <span className="font-bold text-purple-600">
                                        {Math.round(evidenceJudge.confidence * 100)}%
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-purple-500"
                                        style={{ width: `${evidenceJudge.confidence * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600">
                                Analyzes evidence quality and relevance using transformer attention mechanisms
                            </p>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-200">
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mr-4">
                                <span className="text-2xl text-emerald-600">🔍</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-lg">{contradictionDetector.name}</h4>
                                <p className="text-sm text-gray-600">Contradiction Detection</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Model Confidence</span>
                                    <span className="font-bold text-emerald-600">
                                        {Math.round(contradictionDetector.confidence * 100)}%
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500"
                                        style={{ width: `${contradictionDetector.confidence * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600">
                                Detects logical contradictions and argument inconsistencies using NLI
                            </p>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-200">
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mr-4">
                                <span className="text-2xl text-amber-600">📈</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-lg">{confidenceScorer.name}</h4>
                                <p className="text-sm text-gray-600">Confidence Scoring</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Model Confidence</span>
                                    <span className="font-bold text-amber-600">
                                        {Math.round(confidenceScorer.confidence * 100)}%
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-amber-500"
                                        style={{ width: `${confidenceScorer.confidence * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600">
                                Calculates final confidence scores using ensemble learning methods
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h4 className="font-semibold text-gray-800 mb-4">Pipeline Execution Flow</h4>
                    <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <span className="text-purple-600 font-bold">1</span>
                            </div>
                            <div className="ml-3">
                                <div className="font-medium text-gray-800">Evidence Analysis</div>
                                <div className="text-sm text-gray-600">DistilBERT evaluates quality</div>
                            </div>
                        </div>
                        <div className="text-gray-400">→</div>
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                <span className="text-emerald-600 font-bold">2</span>
                            </div>
                            <div className="ml-3">
                                <div className="font-medium text-gray-800">Contradiction Detection</div>
                                <div className="text-sm text-gray-600">RoBERTa identifies conflicts</div>
                            </div>
                        </div>
                        <div className="text-gray-400">→</div>
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                <span className="text-amber-600 font-bold">3</span>
                            </div>
                            <div className="ml-3">
                                <div className="font-medium text-gray-800">Confidence Scoring</div>
                                <div className="text-sm text-gray-600">XGBoost calculates scores</div>
                            </div>
                        </div>
                        <div className="text-gray-400">→</div>
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-blue-600 font-bold">4</span>
                            </div>
                            <div className="ml-3">
                                <div className="font-medium text-gray-800">AI Explanation</div>
                                <div className="text-sm text-gray-600">Grok generates reasoning</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderEvidenceImpact = () => {
        if (!synthesisResult?.keyEvidence || synthesisResult.keyEvidence.length === 0) {
            return (
                <div className="bg-gray-50 p-8 rounded-xl text-center">
                    <p className="text-gray-600">No key evidence data available</p>
                </div>
            );
        }
        
        return (
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Evidence Impact Analysis</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h4 className="font-semibold text-gray-800 mb-4">Most Influential Evidence</h4>
                        <div className="space-y-4">
                            {synthesisResult.keyEvidence.sort((a, b) => Math.abs(b.verdictImpact || 0) - Math.abs(a.verdictImpact || 0)).map((evidence, idx) => (
                                <div key={idx} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                                            Chunk {evidence.chunkId}
                                        </span>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            (evidence.verdictImpact || 0) > 0 ? 'bg-emerald-100 text-emerald-800' :
                                            (evidence.verdictImpact || 0) < 0 ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            Impact: {(evidence.verdictImpact || 0) > 0 ? '+' : ''}
                                            {Math.round((evidence.verdictImpact || 0) * 100)}%
                                        </span>
                                    </div>
                                    <p className="text-gray-700 mb-3 text-sm line-clamp-3">{evidence.text}</p>
                                    <div className="flex items-center text-sm text-gray-600">
                                        <span className="mr-2">Weight:</span>
                                        <span className="font-medium">{(evidence.weight || 0.5).toFixed(2)}</span>
                                        <span className="mx-2">•</span>
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
                    
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h4 className="font-semibold text-gray-800 mb-4">Evidence Statistics</h4>
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-700">Total Evidence Chunks</span>
                                    <span className="font-bold text-gray-900">{synthesisResult.keyEvidence.length}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-700">Average Impact Score</span>
                                    <span className="font-bold text-gray-900">
                                        {(synthesisResult.keyEvidence.reduce((sum, e) => sum + (e.verdictImpact || 0), 0) / synthesisResult.keyEvidence.length * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-700">Average Weight</span>
                                    <span className="font-bold text-gray-900">
                                        {(synthesisResult.keyEvidence.reduce((sum, e) => sum + (e.weight || 0.5), 0) / synthesisResult.keyEvidence.length).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="border-t pt-4">
                                <h5 className="font-medium text-gray-700 mb-3">Evidence Utilization</h5>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></div>
                                            <span className="text-gray-600">Used by Support</span>
                                        </div>
                                        <span className="font-bold text-emerald-600">
                                            {synthesisResult.keyEvidence.filter(e => e.usedBy?.includes('support')).length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                                            <span className="text-gray-600">Used by Oppose</span>
                                        </div>
                                        <span className="font-bold text-red-600">
                                            {synthesisResult.keyEvidence.filter(e => e.usedBy?.includes('oppose')).length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                                            <span className="text-gray-600">Shared Evidence</span>
                                        </div>
                                        <span className="font-bold text-purple-600">
                                            {synthesisResult.keyEvidence.filter(e => e.usedBy?.includes('support') && e.usedBy?.includes('oppose')).length}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
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
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 via-purple-700 to-indigo-700 px-6 py-5">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white">🧠 ML Synthesis Intelligence Dashboard</h2>
                        <p className="text-blue-100 text-sm mt-1">Multi-model AI analysis with comprehensive insights</p>
                    </div>
                    {onClose && (
                        <button 
                            onClick={onClose}
                            className="text-white hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>
            
            <div className="p-6">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-center">
                            <span className="text-red-500 mr-3">⚠️</span>
                            <p className="text-red-700 font-medium">{error}</p>
                        </div>
                    </div>
                )}
                
                {!synthesisResult && !loading && (
                    <div className="mb-6 bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl border">
                        <div className="text-center max-w-3xl mx-auto">
                            <h3 className="text-2xl font-bold text-gray-800 mb-4">Ready for Advanced ML Analysis</h3>
                            <p className="text-gray-600 mb-8 text-lg">
                                Run the multi-model AI pipeline to analyze the debate with:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                                <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
                                    <div className="text-3xl mb-4">🧠</div>
                                    <h4 className="font-bold text-gray-800 mb-2">Evidence Analysis</h4>
                                    <p className="text-sm text-gray-600">DistilBERT evaluates evidence quality</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
                                    <div className="text-3xl mb-4">🔍</div>
                                    <h4 className="font-bold text-gray-800 mb-2">Contradiction Detection</h4>
                                    <p className="text-sm text-gray-600">RoBERTa identifies logical inconsistencies</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
                                    <div className="text-3xl mb-4">📈</div>
                                    <h4 className="font-bold text-gray-800 mb-2">Confidence Scoring</h4>
                                    <p className="text-sm text-gray-600">XGBoost calculates final confidence scores</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
                                    <div className="text-3xl mb-4">🤖</div>
                                    <h4 className="font-bold text-gray-800 mb-2">AI Explanation</h4>
                                    <p className="text-sm text-gray-600">Grok generates human-readable reasoning</p>
                                </div>
                            </div>
                            <button 
                                onClick={runSynthesis}
                                disabled={loading}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                            >
                                🚀 Launch ML Synthesis Pipeline
                            </button>
                            <p className="text-gray-500 text-sm mt-4">Estimated time: 10-15 seconds</p>
                        </div>
                    </div>
                )}
                
                {loading && (
                    <div className="text-center py-12">
                        <div className="inline-block relative mb-8">
                            <div className="w-24 h-24 border-4 border-blue-200 rounded-full"></div>
                            <div className="w-24 h-24 border-4 border-blue-600 border-t-transparent rounded-full absolute top-0 left-0 animate-spin"></div>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl">
                                🤖
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-800 mb-4">ML Synthesis in Progress</p>
                        <p className="text-gray-600 mb-8 max-w-md mx-auto">
                            Analyzing debate with transformer models and generating comprehensive insights...
                        </p>
                        <div className="space-y-4 max-w-sm mx-auto">
                            {['Loading DistilBERT for evidence analysis', 
                              'Initializing RoBERTa for contradiction detection',
                              'Running XGBoost confidence scoring',
                              'Generating AI explanation with Grok'].map((step, idx) => (
                                <div key={idx} className="flex items-center">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-4 animate-pulse" style={{animationDelay: `${idx * 0.3}s`}}></div>
                                    <span className="text-gray-700">{step}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {synthesisResult && !loading && (
                    <div className="space-y-8">
                        {/* Tabs Navigation */}
                        <div className="border-b border-gray-200">
                            <nav className="flex flex-wrap -mb-px">
                                <button
                                    onClick={() => setTab('overview')}
                                    className={`py-3 px-6 font-medium text-sm rounded-t-lg border-b-2 transition-colors ${
                                        tab === 'overview'
                                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    📊 Overview
                                </button>
                                <button
                                    onClick={() => setTab('analysis')}
                                    className={`py-3 px-6 font-medium text-sm rounded-t-lg border-b-2 transition-colors ${
                                        tab === 'analysis'
                                            ? 'border-purple-500 text-purple-600 bg-purple-50'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    🧪 ML Analysis
                                </button>
                                <button
                                    onClick={() => setTab('models')}
                                    className={`py-3 px-6 font-medium text-sm rounded-t-lg border-b-2 transition-colors ${
                                        tab === 'models'
                                            ? 'border-green-500 text-green-600 bg-green-50'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    🤖 Models
                                </button>
                                <button
                                    onClick={() => setTab('evidence')}
                                    className={`py-3 px-6 font-medium text-sm rounded-t-lg border-b-2 transition-colors ${
                                        tab === 'evidence'
                                            ? 'border-amber-500 text-amber-600 bg-amber-50'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    📊 Evidence
                                </button>
                            </nav>
                        </div>
                        
                        {/* Tab Content */}
                        {tab === 'overview' && renderVerdictOverview()}
                        {tab === 'analysis' && renderMLAnalysis()}
                        {tab === 'models' && renderModelBreakdown()}
                        {tab === 'evidence' && renderEvidenceImpact()}
                        
                        {/* Refresh Button */}
                        <div className="text-center pt-6 border-t">
                            <button 
                                onClick={runSynthesis}
                                disabled={loading}
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 inline-flex items-center"
                            >
                                <span className="mr-2">🔄</span>
                                {loading ? 'Re-analyzing...' : 'Re-run Analysis with Latest Data'}
                            </button>
                            <p className="text-gray-500 text-sm mt-3">
                                Last updated: {new Date(synthesisResult.createdAt || Date.now()).toLocaleString()}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SynthesisPanel;