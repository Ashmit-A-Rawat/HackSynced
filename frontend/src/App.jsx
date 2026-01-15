import React, { useState, useEffect, useRef } from "react";
import DocumentUpload from "./components/DocumentUpload.jsx";
import EvidenceDisplay from "./components/EvidenceDisplay.jsx";
import AgentReasoning from "./components/AgentReasoning.jsx";
import SynthesisPanel from "./components/SynthesisPanel.jsx";

function App() {
    const [evidence, setEvidence] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [evidenceId, setEvidenceId] = useState(null);
    const [documentType, setDocumentType] = useState(null);
    const [extractionComplete, setExtractionComplete] = useState(false);
    const [activeStep, setActiveStep] = useState(1);
    const [supportResponse, setSupportResponse] = useState(null);
    const [opposeResponse, setOpposeResponse] = useState(null);
    const [synthesisPairId, setSynthesisPairId] = useState(null);
    
    // ⭐ NEW: Ref for Step 4 auto-scroll
    const step4Ref = useRef(null);
    const clearBrowserCache = () => {
  console.log('🧹 Clearing browser cache...');
  
  // 1. Clear localStorage
  localStorage.clear();
  console.log('✅ localStorage cleared');
  
  // 2. Clear sessionStorage
  sessionStorage.clear();
  console.log('✅ sessionStorage cleared');
  
  // 3. Force hard reload
  window.location.href = window.location.href + '?nocache=' + Date.now();
};

    const handleEvidenceExtracted = (extractedData) => {
        setEvidence(extractedData.evidence || []);
        setSessionId(extractedData.sessionId);
        setEvidenceId(extractedData.evidenceId);
        setDocumentType(extractedData.documentType);
        setExtractionComplete(true);
        setActiveStep(2);
    };

    // ⭐ UPDATED: Auto-scroll to Step 4 when synthesis is ready
    const handleAgentResponses = (supportResp, opposeResp, pairId) => {
        setSupportResponse(supportResp);
        setOpposeResponse(opposeResp);
        setSynthesisPairId(pairId);
        setActiveStep(4);
        
        // ⭐ Auto-scroll to Step 4 after a short delay
        setTimeout(() => {
            if (step4Ref.current) {
                step4Ref.current.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
        }, 500);
    };

    const handleMoveToAgents = () => {
        setActiveStep(3);
    };

    const handleMoveToSynthesis = () => {
        setActiveStep(4);
        setTimeout(() => {
            if (step4Ref.current) {
                step4Ref.current.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
        }, 100);
    };

    const handleBackToEvidence = () => {
        setActiveStep(2);
    };

    const handleBackToAgents = () => {
        setActiveStep(3);
    };

    const handleBackToUpload = () => {
        setActiveStep(1);
    };

    const handleNewDocument = () => {
        setEvidence([]);
        setSessionId(null);
        setEvidenceId(null);
        setDocumentType(null);
        setExtractionComplete(false);
        setSupportResponse(null);
        setOpposeResponse(null);
        setSynthesisPairId(null);
        setActiveStep(1);
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center mb-8">
            <div className="flex items-center">
                <button
                    onClick={handleBackToUpload}
                    className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg transition-all ${
                        activeStep >= 1 
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                            : 'bg-gray-200 text-gray-500'
                    }`}
                >
                    1
                </button>
                <div className={`w-16 h-1 ${activeStep >= 2 ? 'bg-gradient-to-r from-purple-600 to-green-500' : 'bg-gray-300'}`}></div>
                
                <button
                    onClick={() => extractionComplete && setActiveStep(2)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg transition-all ${
                        activeStep >= 2 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                            : 'bg-gray-200 text-gray-500'
                    } ${!extractionComplete && 'cursor-not-allowed'}`}
                >
                    2
                </button>
                <div className={`w-16 h-1 ${activeStep >= 3 ? 'bg-gradient-to-r from-emerald-600 to-purple-600' : 'bg-gray-300'}`}></div>
                
                <button
                    onClick={() => extractionComplete && setActiveStep(3)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg transition-all ${
                        activeStep >= 3 
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                            : 'bg-gray-200 text-gray-500'
                    } ${!extractionComplete && 'cursor-not-allowed'}`}
                >
                    3
                </button>
                <div className={`w-16 h-1 ${activeStep >= 4 ? 'bg-gradient-to-r from-pink-600 to-orange-500' : 'bg-gray-300'}`}></div>
                
                <button
                    onClick={() => supportResponse && opposeResponse && handleMoveToSynthesis()}
                    className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg transition-all ${
                        activeStep >= 4 
                            ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg animate-pulse' 
                            : 'bg-gray-200 text-gray-500'
                    } ${(!supportResponse || !opposeResponse) && 'cursor-not-allowed'}`}
                >
                    4
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            <header className="py-8 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-lg rounded-2xl p-8 border border-gray-700/50 shadow-2xl">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="text-5xl">⚛️</div>
                                <div>
                                    <h1 className="text-5xl font-bold text-white">AETHER</h1>
                                    <p className="text-xl text-gray-300 font-light mt-1">
                                        Multi-Agent AI Reasoning with ML Synthesis
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/30">Gemini AI</span>
                                <span className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30">DeBERTa v3</span>
                                <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-full text-sm border border-emerald-500/30">RoBERTa MNLI</span>
                                <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-full text-sm border border-amber-500/30">XGBoost</span>
                                <span className="px-3 py-1.5 bg-pink-500/20 text-pink-300 rounded-full text-sm border border-pink-500/30">Grok</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="py-8 px-4">
                <div className="max-w-7xl mx-auto">
                    <button 
  onClick={clearBrowserCache}
  style={{
    position: 'fixed',
    top: '100px',
    right: '20px',
    zIndex: 1000,
    padding: '8px 12px',
    backgroundColor: '#ff4444',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    boxShadow: '0 2px 8px rgba(255, 68, 68, 0.3)'
  }}
  title="Clear browser cache if seeing old evidence"
>
  🗑️ Clear Cache
</button>

                    {renderStepIndicator()}

                    <div className="space-y-8 mb-8">
                        {/* Step 1: Document Upload */}
                        <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl p-8 border-2 transition-all duration-300 ${
                            activeStep === 1 ? 'border-blue-500 shadow-blue-500/20' : 'border-gray-700 opacity-80'
                        }`}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`flex items-center justify-center w-12 h-12 rounded-full ${
                                    extractionComplete 
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                                        : 'bg-gradient-to-r from-blue-500 to-purple-600'
                                } text-white font-bold text-xl shadow-lg`}>
                                    1
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">
                                        Document Ingestion & Evidence Extraction
                                    </h2>
                                    <p className="text-gray-400">Upload any document for analysis</p>
                                </div>
                            </div>
                            <DocumentUpload onEvidenceExtracted={handleEvidenceExtracted} />
                        </div>

                        {/* Step 2: Evidence Display */}
                        {extractionComplete && (
                            <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl p-8 border-2 transition-all duration-300 ${
                                activeStep === 2 ? 'border-green-500 shadow-green-500/20' : 'border-gray-700 opacity-80'
                            }`}>
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl shadow-lg">
                                            2
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">
                                                Extracted Evidence
                                            </h2>
                                            <p className="text-gray-400">AI-processed evidence chunks</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleBackToUpload}
                                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all border border-gray-600"
                                        >
                                            ← Upload
                                        </button>
                                        <button
                                            onClick={handleMoveToAgents}
                                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
                                        >
                                            Agents →
                                        </button>
                                    </div>
                                </div>
                                <EvidenceDisplay evidence={evidence} />
                            </div>
                        )}

                        {/* Step 3: Agent Reasoning */}
                        {extractionComplete && (
                            <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl p-8 border-2 transition-all duration-300 ${
                                activeStep === 3 ? 'border-purple-500 shadow-purple-500/20' : 'border-gray-700 opacity-80'
                            }`}>
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xl shadow-lg">
                                            3
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">
                                                Multi-Agent Reasoning
                                            </h2>
                                            <p className="text-gray-400">Support vs Oppose AI Debate</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleBackToEvidence}
                                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all border border-gray-600"
                                        >
                                            ← Evidence
                                        </button>
                                        {supportResponse && opposeResponse && (
                                            <button
                                                onClick={handleMoveToSynthesis}
                                                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-600 hover:to-red-700 transition-all shadow-lg animate-pulse"
                                            >
                                                Synthesis →
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <AgentReasoning 
                                    sessionId={sessionId}
                                    evidenceId={evidenceId}
                                    documentType={documentType}
                                    onResponsesReady={handleAgentResponses}
                                />
                            </div>
                        )}

                        {/* Step 4: ML Synthesis - ⭐ WITH REF FOR AUTO-SCROLL */}
                        {extractionComplete && supportResponse && opposeResponse && (
                            <div 
                                ref={step4Ref}
                                className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl p-8 border-2 transition-all duration-300 ${
                                    activeStep === 4 ? 'border-orange-500 shadow-orange-500/20' : 'border-gray-700 opacity-80'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-xl shadow-lg">
                                            4
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">
                                                ML Synthesis Verdict
                                            </h2>
                                            <p className="text-gray-400">AI Judge with DeBERTa, RoBERTa, XGBoost + Grok</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleBackToAgents}
                                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all border border-gray-600"
                                        >
                                            ← Agents
                                        </button>
                                        <button
                                            onClick={handleNewDocument}
                                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:to-cyan-600 transition-all shadow-lg"
                                        >
                                            New Document
                                        </button>
                                    </div>
                                </div>
                                <SynthesisPanel 
                                    sessionId={sessionId}
                                    synthesisPairId={synthesisPairId}
                                    supportResponseId={supportResponse?.responseId}
                                    opposeResponseId={opposeResponse?.responseId}
                                />
                            </div>
                        )}
                    </div>

                    {/* System Status Dashboard */}
                    <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 shadow-xl">
                        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            System Status
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                                <div className="text-sm text-gray-400 mb-1">Current Step</div>
                                <div className="text-lg font-semibold text-white">
                                    {activeStep === 1 && '📄 Upload Document'}
                                    {activeStep === 2 && '🔍 Evidence Review'}
                                    {activeStep === 3 && '🤖 Agent Debate'}
                                    {activeStep === 4 && '⚖️ ML Synthesis'}
                                </div>
                            </div>
                            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                                <div className="text-sm text-gray-400 mb-1">Evidence Chunks</div>
                                <div className="flex items-center gap-2">
                                    <div className="text-2xl font-bold text-white">{evidence.length}</div>
                                    <div className={`w-2 h-2 rounded-full ${evidence.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                </div>
                            </div>
                            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                                <div className="text-sm text-gray-400 mb-1">Document Type</div>
                                <div className="text-lg font-semibold text-white capitalize">
                                    {documentType || 'Not detected'}
                                </div>
                            </div>
                            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                                <div className="text-sm text-gray-400 mb-1">Agents Status</div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${supportResponse && opposeResponse ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                                    <div className="text-lg font-semibold text-white">
                                        {supportResponse && opposeResponse ? '✅ Ready' : '⏳ Pending'}
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                                <div className="text-sm text-gray-400 mb-1">ML Models</div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    <div className="text-lg font-semibold text-white">Ready</div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-6">
                            <div className="flex justify-between text-sm text-gray-400 mb-2">
                                <span>Pipeline Progress</span>
                                <span>{Math.round((activeStep / 4) * 100)}%</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-blue-500 via-purple-600 to-orange-500 transition-all duration-500"
                                    style={{ width: `${(activeStep / 4) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="py-6 px-4 mt-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center space-y-2">
                        <p className="text-gray-500 text-sm">
                            AETHER • ML Synthesis with Grok • Hackathon Build
                        </p>
                        <div className="flex justify-center gap-6 text-gray-600 text-sm">
                            <span>Step 1: Evidence Extraction</span>
                            <span>•</span>
                            <span>Step 2: Agent Reasoning</span>
                            <span>•</span>
                            <span>Step 3: ML Synthesis</span>
                            <span>•</span>
                            <span>Step 4: Grok Explanation</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default App;