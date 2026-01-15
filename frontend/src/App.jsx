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
    
    const step4Ref = useRef(null);
    
    const clearBrowserCache = () => {
        console.log('🧹 Clearing browser cache...');
        localStorage.clear();
        console.log('✅ localStorage cleared');
        sessionStorage.clear();
        console.log('✅ sessionStorage cleared');
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

    const handleAgentResponses = (supportResp, opposeResp, pairId) => {
        setSupportResponse(supportResp);
        setOpposeResponse(opposeResp);
        setSynthesisPairId(pairId);
        setActiveStep(4);
        
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

    const renderStepIndicator = () => {
        const steps = [
            { number: 1, label: 'Upload', icon: '📄', enabled: true, color: 'from-cyan-500 to-teal-600' },
            { number: 2, label: 'Evidence', icon: '🔍', enabled: extractionComplete, color: 'from-teal-500 to-emerald-600' },
            { number: 3, label: 'Agents', icon: '🤖', enabled: extractionComplete, color: 'from-emerald-600 to-green-600' },
            { number: 4, label: 'Synthesis', icon: '⚖️', enabled: supportResponse && opposeResponse, color: 'from-green-500 to-lime-600' }
        ];

        return (
            <div className="relative flex items-center justify-center mb-12 py-8">
                {/* Glowing Background */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full max-w-4xl h-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"></div>
                </div>

                <div className="relative flex items-center gap-3">
                    {steps.map((step, index) => (
                        <React.Fragment key={step.number}>
                            {/* Step Button */}
                            <div className="relative group">
                                <button
                                    onClick={() => {
                                        if (step.enabled) {
                                            if (step.number === 1) handleBackToUpload();
                                            else if (step.number === 2) setActiveStep(2);
                                            else if (step.number === 3) setActiveStep(3);
                                            else if (step.number === 4) handleMoveToSynthesis();
                                        }
                                    }}
                                    disabled={!step.enabled}
                                    className={`relative flex flex-col items-center justify-center transition-all duration-500 ${
                                        !step.enabled ? 'cursor-not-allowed' : 'cursor-pointer'
                                    }`}
                                >
                                    {/* Outer Glow Ring */}
                                    {activeStep === step.number && (
                                        <div className={`absolute inset-0 w-20 h-20 rounded-2xl bg-gradient-to-r ${step.color} blur-xl opacity-60 animate-pulse`}></div>
                                    )}
                                    
                                    {/* Main Button */}
                                    <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl transition-all duration-500 transform ${
                                        activeStep >= step.number && step.enabled
                                            ? `bg-gradient-to-br ${step.color} text-white shadow-2xl scale-110 rotate-3`
                                            : 'bg-gray-800 text-gray-600 border-2 border-gray-700'
                                    } ${activeStep === step.number ? 'ring-4 ring-white/30' : ''} ${
                                        step.enabled ? 'hover:scale-105' : 'opacity-50'
                                    }`}>
                                        <span className="transform transition-transform duration-300 group-hover:scale-110">
                                            {step.icon}
                                        </span>
                                        
                                        {/* Step Number Badge */}
                                        <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                            activeStep >= step.number && step.enabled
                                                ? 'bg-white text-gray-900 shadow-lg'
                                                : 'bg-gray-700 text-gray-400'
                                        }`}>
                                            {step.number}
                                        </div>

                                        {/* Checkmark for completed steps */}
                                        {activeStep > step.number && step.enabled && (
                                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Label */}
                                    <span className={`mt-3 text-sm font-semibold transition-all duration-300 ${
                                        activeStep >= step.number && step.enabled
                                            ? 'text-white'
                                            : 'text-gray-500'
                                    }`}>
                                        {step.label}
                                    </span>
                                </button>
                            </div>

                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div className="relative w-16 h-2">
                                    <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
                                        activeStep > step.number
                                            ? `bg-gradient-to-r ${steps[index + 1].color} shadow-lg`
                                            : 'bg-gray-700'
                                    }`}>
                                        {activeStep > step.number && (
                                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/40 to-transparent animate-pulse"></div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-950 to-slate-950 relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            {/* Grid Pattern Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-20" style={{
                backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)',
                backgroundSize: '50px 50px'
            }}></div>

            <header className="relative py-10 px-4 z-10">
                <div className="max-w-7xl mx-auto">
                    {/* Main Header Card */}
                    <div className="relative overflow-hidden">
                        {/* Glowing border effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 rounded-3xl blur-xl opacity-75 animate-pulse"></div>
                        
                        <div className="relative bg-gradient-to-br from-gray-900/95 via-cyan-900/95 to-teal-900/95 backdrop-blur-2xl rounded-3xl p-10 border border-white/10 shadow-2xl">
                            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                                {/* Logo and Title */}
                                <div className="flex items-center gap-6">
                                    {/* Animated Logo */}
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-teal-600 rounded-2xl blur-xl opacity-60 animate-pulse"></div>
                                        <div className="relative w-20 h-20 bg-gradient-to-br from-cyan-500 via-teal-600 to-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl transform hover:rotate-12 transition-transform duration-300">
                                            <span className="text-5xl">⚛️</span>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h1 className="text-6xl font-black bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent mb-2 tracking-tight">
                                            AETHER
                                        </h1>
                                        <p className="text-xl text-gray-300 font-light tracking-wide flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            Multi-Agent AI Reasoning System
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Subtitle Bar */}
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <div className="flex flex-wrap items-center justify-center gap-4 text-gray-400 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                                            <span className="text-cyan-400">📄</span>
                                        </div>
                                        <span>Document Analysis</span>
                                    </div>
                                    <span className="text-gray-600">•</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center">
                                            <span className="text-teal-400">🤖</span>
                                        </div>
                                        <span>AI Debate</span>
                                    </div>
                                    <span className="text-gray-600">•</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                                            <span className="text-emerald-400">⚖️</span>
                                        </div>
                                        <span>AI Synthesis</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative py-8 px-4 z-10">
                <div className="max-w-7xl mx-auto">
                    {/* Clear Cache Button */}
                    <button 
                        onClick={clearBrowserCache}
                        className="fixed top-24 right-6 z-50 group"
                    >
                        <div className="absolute inset-0 bg-red-500 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                        <div className="relative px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold text-sm shadow-2xl border border-red-400/50 flex items-center gap-2 transform group-hover:scale-105 transition-all">
                            <span className="text-lg">🗑️</span>
                            Clear Cache
                        </div>
                    </button>

                    {/* Step Indicator */}
                    {renderStepIndicator()}

                    <div className="space-y-8 mb-8">
                        {/* Step 1: Document Upload */}
                        <div className={`relative transition-all duration-700 transform ${
                            activeStep === 1 ? 'scale-100 opacity-100' : 'scale-95 opacity-60'
                        }`}>
                            {activeStep === 1 && (
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-emerald-500/20 rounded-3xl blur-2xl animate-pulse"></div>
                            )}
                            <div className={`relative bg-gradient-to-br from-gray-900/90 via-cyan-900/50 to-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 transition-all duration-500 overflow-hidden ${
                                activeStep === 1 ? 'border-cyan-500/50 shadow-cyan-500/20' : 'border-gray-800/50'
                            }`}>
                                {/* Animated Border */}
                                {activeStep === 1 && (
                                    <div className="absolute inset-0 rounded-3xl overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent animate-pulse"></div>
                                    </div>
                                )}

                                <div className="relative p-8">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="relative">
                                            <div className={`absolute inset-0 rounded-2xl blur-xl ${
                                                extractionComplete 
                                                    ? 'bg-gradient-to-r from-teal-500 to-emerald-600' 
                                                    : 'bg-gradient-to-r from-cyan-500 to-teal-600'
                                            } opacity-75 animate-pulse`}></div>
                                            <div className={`relative flex items-center justify-center w-16 h-16 rounded-2xl ${
                                                extractionComplete 
                                                    ? 'bg-gradient-to-r from-teal-500 to-emerald-600' 
                                                    : 'bg-gradient-to-r from-cyan-500 to-teal-600'
                                            } text-white font-bold text-2xl shadow-2xl`}>
                                                {extractionComplete ? '✓' : '1'}
                                            </div>
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
                                                Document Ingestion & Evidence Extraction
                                                {extractionComplete && (
                                                    <span className="px-3 py-1 bg-teal-500/20 text-teal-400 rounded-full text-sm font-medium border border-teal-500/30">
                                                        Complete
                                                    </span>
                                                )}
                                            </h2>
                                            <p className="text-gray-400">Upload any document for AI-powered analysis</p>
                                        </div>
                                    </div>
                                    <DocumentUpload onEvidenceExtracted={handleEvidenceExtracted} />
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Evidence Display */}
                        {extractionComplete && (
                            <div className={`relative transition-all duration-700 transform ${
                                activeStep === 2 ? 'scale-100 opacity-100' : 'scale-95 opacity-60'
                            }`}>
                                {activeStep === 2 && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 via-emerald-500/20 to-green-500/20 rounded-3xl blur-2xl animate-pulse"></div>
                                )}
                                <div className={`relative bg-gradient-to-br from-gray-900/90 via-teal-900/30 to-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 transition-all duration-500 ${
                                    activeStep === 2 ? 'border-teal-500/50 shadow-teal-500/20' : 'border-gray-800/50'
                                }`}>
                                    <div className="p-8">
                                        <div className="flex items-center justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-2xl blur-xl opacity-75 animate-pulse"></div>
                                                    <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold text-2xl shadow-2xl">
                                                        2
                                                    </div>
                                                </div>
                                                <div>
                                                    <h2 className="text-3xl font-bold text-white mb-1">
                                                        Extracted Evidence
                                                    </h2>
                                                    <p className="text-gray-400">AI-processed evidence chunks ready for analysis</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={handleBackToUpload}
                                                    className="group relative px-5 py-3 bg-gray-800/80 backdrop-blur-sm text-gray-300 rounded-xl hover:bg-gray-700/80 transition-all border border-gray-700 shadow-lg"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                                                        </svg>
                                                        Upload
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={handleMoveToAgents}
                                                    className="group relative overflow-hidden"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                                                    <div className="relative px-5 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-semibold shadow-lg border border-teal-500/50 transform group-hover:scale-105 transition-all">
                                                        <span className="flex items-center gap-2">
                                                            Agents
                                                            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                            </svg>
                                                        </span>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                        <EvidenceDisplay evidence={evidence} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Agent Reasoning */}
                        {extractionComplete && (
                            <div className={`relative transition-all duration-700 transform ${
                                activeStep === 3 ? 'scale-100 opacity-100' : 'scale-95 opacity-60'
                            }`}>
                                {activeStep === 3 && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-lime-500/20 rounded-3xl blur-2xl animate-pulse"></div>
                                )}
                                <div className={`relative bg-gradient-to-br from-gray-900/90 via-emerald-900/30 to-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 transition-all duration-500 ${
                                    activeStep === 3 ? 'border-emerald-500/50 shadow-emerald-500/20' : 'border-gray-800/50'
                                }`}>
                                    <div className="p-8">
                                        <div className="flex items-center justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 rounded-2xl blur-xl opacity-75 animate-pulse"></div>
                                                    <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold text-2xl shadow-2xl">
                                                        3
                                                    </div>
                                                </div>
                                                <div>
                                                    <h2 className="text-3xl font-bold text-white mb-1">
                                                        Multi-Agent Reasoning
                                                    </h2>
                                                    <p className="text-gray-400">Support vs Oppose AI Debate</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={handleBackToEvidence}
                                                    className="group relative px-5 py-3 bg-gray-800/80 backdrop-blur-sm text-gray-300 rounded-xl hover:bg-gray-700/80 transition-all border border-gray-700 shadow-lg"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                                                        </svg>
                                                        Evidence
                                                    </span>
                                                </button>
                                                {supportResponse && opposeResponse && (
                                                    <button
                                                        onClick={handleMoveToSynthesis}
                                                        className="group relative overflow-hidden animate-pulse"
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                                                        <div className="relative px-5 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold shadow-lg border border-emerald-400/50 transform group-hover:scale-105 transition-all">
                                                            <span className="flex items-center gap-2">
                                                                Synthesis
                                                                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                                </svg>
                                                            </span>
                                                        </div>
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
                                </div>
                            </div>
                        )}

                        {/* Step 4: ML Synthesis */}
                        {extractionComplete && supportResponse && opposeResponse && (
                            <div 
                                ref={step4Ref}
                                className={`relative transition-all duration-700 transform ${
                                    activeStep === 4 ? 'scale-100 opacity-100' : 'scale-95 opacity-60'
                                }`}
                            >
                                {activeStep === 4 && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 via-lime-500/20 to-emerald-500/20 rounded-3xl blur-2xl animate-pulse"></div>
                                )}
                                <div className={`relative bg-gradient-to-br from-gray-900/90 via-green-900/30 to-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 transition-all duration-500 ${
                                    activeStep === 4 ? 'border-green-500/50 shadow-green-500/20' : 'border-gray-800/50'
                                }`}>
                                    <div className="p-8">
                                        <div className="flex items-center justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-lime-600 rounded-2xl blur-xl opacity-75 animate-pulse"></div>
                                                    <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-bold text-2xl shadow-2xl">
                                                        4
                                                    </div>
                                                </div>
                                                <div>
                                                    <h2 className="text-3xl font-bold text-white mb-1">
                                                        AI Synthesis Verdict
                                                    </h2>
                                                    <p className="text-gray-400">ML-powered evidence analysis and verdict</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={handleBackToAgents}
                                                    className="group relative px-5 py-3 bg-gray-800/80 backdrop-blur-sm text-gray-300 rounded-xl hover:bg-gray-700/80 transition-all border border-gray-700 shadow-lg"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                                                        </svg>
                                                        Agents
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={handleNewDocument}
                                                    className="group relative overflow-hidden"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-teal-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                                                    <div className="relative px-5 py-3 bg-gradient-to-r from-cyan-600 to-teal-500 text-white rounded-xl font-semibold shadow-lg border border-cyan-500/50 transform group-hover:scale-105 transition-all">
                                                        <span className="flex items-center gap-2">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                                            </svg>
                                                            New Document
                                                        </span>
                                                    </div>
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
                                </div>
                            </div>
                        )}
                    </div>

                    {/* System Status Dashboard */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-emerald-500/10 rounded-3xl blur-xl"></div>
                        <div className="relative bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
                            {/* Animated top border */}
                            <div className="h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 animate-pulse"></div>
                            
                            <div className="p-8">
                                <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                        <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                                    </div>
                                    System Status Dashboard
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                                    {/* Current Step */}
                                    <div className="group relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all">
                                            <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                                                <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                                                Current Step
                                            </div>
                                            <div className="text-xl font-bold text-white flex items-center gap-2">
                                                {activeStep === 1 && <>📄 <span>Upload</span></>}
                                                {activeStep === 2 && <>🔍 <span>Evidence</span></>}
                                                {activeStep === 3 && <>🤖 <span>Debate</span></>}
                                                {activeStep === 4 && <>⚖️ <span>Synthesis</span></>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Evidence Chunks */}
                                    <div className="group relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all">
                                            <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                                                <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                                                Evidence Chunks
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-3xl font-black text-white">{evidence.length}</div>
                                                <div className={`w-3 h-3 rounded-full ${evidence.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Document Type */}
                                    <div className="group relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all">
                                            <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                Document Type
                                            </div>
                                            <div className="text-xl font-bold text-white capitalize">
                                                {documentType || 'Not detected'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Agents Status */}
                                    <div className="group relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-lime-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all">
                                            <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${supportResponse && opposeResponse ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`}></div>
                                                Agents Status
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-xl font-bold text-white">
                                                    {supportResponse && opposeResponse ? '✅ Ready' : '⏳ Pending'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pipeline Status */}
                                    <div className="group relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-lime-500/20 to-cyan-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all">
                                            <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                Pipeline
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-xl font-bold text-white">🟢 Active</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Progress Bar */}
                                <div className="mt-8">
                                    <div className="flex justify-between text-sm text-gray-400 mb-3">
                                        <span className="font-semibold">Pipeline Progress</span>
                                        <span className="font-bold text-white">{Math.round((activeStep / 4) * 100)}%</span>
                                    </div>
                                    <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700/50">
                                        <div 
                                            className="h-full bg-gradient-to-r from-cyan-500 via-teal-600 to-emerald-500 transition-all duration-1000 ease-out relative overflow-hidden"
                                            style={{ width: `${(activeStep / 4) * 100}%` }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="relative py-12 px-4 mt-16 z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-teal-500/5 to-emerald-500/5 rounded-2xl blur-xl"></div>
                        <div className="relative bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800/50">
                            <div className="text-center space-y-4">
                                <p className="text-gray-400 text-lg font-semibold">
                                    AETHER • Multi-Agent AI Reasoning System
                                </p>
                                <div className="flex flex-wrap justify-center gap-4 text-gray-500 text-sm">
                                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg">
                                        <span className="text-cyan-400">📄</span>
                                        <span>Evidence Extraction</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg">
                                        <span className="text-teal-400">🤖</span>
                                        <span>Agent Debate</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg">
                                        <span className="text-emerald-400">⚖️</span>
                                        <span>AI Synthesis</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default App;