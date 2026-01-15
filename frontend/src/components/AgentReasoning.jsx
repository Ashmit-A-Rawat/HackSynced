import React, { useState, useEffect } from 'react';

const AgentReasoning = ({ sessionId, evidenceId, documentType, onResponsesReady }) => {
    const [supportReasoning, setSupportReasoning] = useState(null);
    const [opposeReasoning, setOpposeReasoning] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('support');
    const [subject, setSubject] = useState(documentType || "the document");
    const [synthesisPairId, setSynthesisPairId] = useState(null);
    
    const BACKEND_URL = 'http://localhost:5001';

    const hasRequiredIds = () => {
        return sessionId || evidenceId;
    };

    const fetchAgentReasoning = async (agentType) => {
        if (!hasRequiredIds()) {
            console.warn('No sessionId or evidenceId provided. Waiting for evidence extraction...');
            return;
        }

        setLoading(true);
        
        try {
            let url = `${BACKEND_URL}/api/agents/${agentType}?`;
            if (evidenceId) {
                url += `evidenceId=${evidenceId}`;
            } else {
                url += `sessionId=${sessionId}`;
            }
            
            if (subject) {
                url += `&subject=${encodeURIComponent(subject)}`;
            }

            console.log(`Fetching ${agentType} reasoning from:`, url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch ${agentType} reasoning: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                console.log(`${agentType} reasoning received:`, data);
                if (agentType === 'support') {
                    setSupportReasoning(data);
                } else if (agentType === 'oppose') {
                    setOpposeReasoning(data);
                }
            }
        } catch (err) {
            console.error(`Error fetching ${agentType} reasoning:`, err);
            if (agentType === 'support') {
                setSupportReasoning({
                    success: false,
                    error: err.message,
                    reasoning: `# Support Agent Error\n\nUnable to generate reasoning: ${err.message}\n\nPlease try again.`,
                    isMock: true
                });
            } else {
                setOpposeReasoning({
                    success: false,
                    error: err.message,
                    reasoning: `# Oppose Agent Error\n\nUnable to generate reasoning: ${err.message}\n\nPlease try again.`,
                    isMock: true
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchBothReasonings = async () => {
        if (!hasRequiredIds()) {
            console.warn('No sessionId or evidenceId provided. Cannot fetch reasoning.');
            return;
        }

        setLoading(true);
        
        try {
            let url = `${BACKEND_URL}/api/agents/both?`;
            if (evidenceId) {
                url += `evidenceId=${evidenceId}`;
            } else {
                url += `sessionId=${sessionId}`;
            }
            
            if (subject) {
                url += `&subject=${encodeURIComponent(subject)}`;
            }

            console.log('Fetching both reasonings from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch both reasonings: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                console.log('Both reasonings received:', data);
                setSupportReasoning({
                    ...data.support,
                    documentContext: data.documentContext,
                    subject: data.subject,
                    evidenceStats: data.evidenceStats
                });
                setOpposeReasoning({
                    ...data.oppose,
                    documentContext: data.documentContext,
                    subject: data.subject,
                    evidenceStats: data.evidenceStats
                });
                
                // ⭐ FIXED: Use actual MongoDB response IDs instead of random string
                const pairId = `${data.support.responseId}_${data.oppose.responseId}`;
                setSynthesisPairId(pairId);
                
                // Store in localStorage
                localStorage.setItem('synthesisPairId', pairId);
                localStorage.setItem('supportResponseId', data.support.responseId);
                localStorage.setItem('opposeResponseId', data.oppose.responseId);
                localStorage.setItem('sessionId', sessionId);
                localStorage.setItem('subject', subject || documentType);
                
                console.log('✅ Synthesis pair created:', pairId);
                
                // ⭐ CRITICAL: Call onResponsesReady to trigger Step 4
                if (onResponsesReady) {
                    console.log('⭐ Calling onResponsesReady with:', {
                        support: data.support,
                        oppose: data.oppose,
                        pairId
                    });
                    onResponsesReady(data.support, data.oppose, pairId);
                }
            }
        } catch (err) {
            console.error(`Error fetching both reasonings:`, err);
            setSupportReasoning({
                success: false,
                error: err.message,
                reasoning: `# Support Agent Error\n\nUnable to generate reasoning: ${err.message}\n\nPlease try again.`,
                isMock: true
            });
            setOpposeReasoning({
                success: false,
                error: err.message,
                reasoning: `# Oppose Agent Error\n\nUnable to generate reasoning: ${err.message}\n\nPlease try again.`,
                isMock: true
            });
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateBoth = () => {
        if (!hasRequiredIds()) {
            alert('Please extract evidence from a document first!');
            return;
        }
        fetchBothReasonings();
    };

    const handleGenerateSupport = () => {
        if (!hasRequiredIds()) {
            alert('Please extract evidence from a document first!');
            return;
        }
        fetchAgentReasoning('support');
    };

    const handleGenerateOppose = () => {
        if (!hasRequiredIds()) {
            alert('Please extract evidence from a document first!');
            return;
        }
        fetchAgentReasoning('oppose');
    };

    const renderMarkdown = (text) => {
        if (!text) return null;
        
        return text.split('\n').map((line, index) => {
            if (line.startsWith('# ')) {
                return <h1 key={index} className="text-2xl font-bold text-gray-900 mt-4 mb-2">{line.substring(2)}</h1>;
            }
            if (line.startsWith('## ')) {
                return <h2 key={index} className="text-xl font-bold text-gray-800 mt-3 mb-2">{line.substring(3)}</h2>;
            }
            if (line.startsWith('### ')) {
                return <h3 key={index} className="text-lg font-semibold text-gray-700 mt-2 mb-1">{line.substring(4)}</h3>;
            }
            
            const boldRegex = /\*\*(.*?)\*\*/g;
            let elements = [];
            let lastIndex = 0;
            let match;
            
            while ((match = boldRegex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    elements.push(<span key={`${index}-${lastIndex}`}>{line.substring(lastIndex, match.index)}</span>);
                }
                elements.push(<strong key={`${index}-${match.index}`} className="font-bold text-gray-900">{match[1]}</strong>);
                lastIndex = match.index + match[0].length;
            }
            
            if (lastIndex < line.length) {
                elements.push(<span key={`${index}-${lastIndex}`}>{line.substring(lastIndex)}</span>);
            }
            
            if (elements.length > 0) {
                return <p key={index} className="mb-3 text-gray-700 leading-relaxed">{elements}</p>;
            }
            
            if (line.startsWith('- ') || line.startsWith('* ')) {
                return <li key={index} className="ml-4 mb-1 text-gray-700">{line.substring(2)}</li>;
            }
            
            if (/^\d+\.\s/.test(line)) {
                return <li key={index} className="ml-4 mb-1 text-gray-700">{line}</li>;
            }
            
            if (line.trim()) {
                return <p key={index} className="mb-3 text-gray-700 leading-relaxed">{line}</p>;
            }
            
            return null;
        });
    };

    const renderReasoningCard = (reasoningData, agentType) => {
        if (!reasoningData) return null;
        
        const isSupport = agentType === 'support';
        const bgColor = isSupport ? 'from-green-50 to-emerald-50' : 'from-red-50 to-rose-50';
        const borderColor = isSupport ? 'border-green-200' : 'border-red-200';
        const headerColor = isSupport ? 'text-green-700' : 'text-red-700';
        const badgeColor = isSupport ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        
        return (
            <div className={`bg-gradient-to-br ${bgColor} rounded-xl border ${borderColor} shadow-sm`}>
                <div className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isSupport ? 'bg-green-100' : 'bg-red-100'}`}>
                                {isSupport ? (
                                    <span className="text-xl">👍</span>
                                ) : (
                                    <span className="text-xl">👎</span>
                                )}
                            </div>
                            <div>
                                <h3 className={`text-xl font-bold ${headerColor}`}>
                                    {isSupport ? 'Support Agent' : 'Oppose Agent'}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {reasoningData.subject ? `Reasoning about: ${reasoningData.subject}` : 'Analyzing document evidence'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 text-sm rounded-full ${badgeColor}`}>
                                {isSupport ? 'SUPPORT' : 'OPPOSE'}
                            </span>
                            {reasoningData.isMock && (
                                <span className="px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-800">
                                    {reasoningData.error ? 'Error' : 'Mock Response'}
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <div className="prose prose-gray max-w-none">
                        {renderMarkdown(reasoningData.reasoning)}
                    </div>
                    
                    {reasoningData.documentContext && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                                    <div className="text-sm text-gray-600">Document</div>
                                    <div className="font-medium text-gray-800 truncate">
                                        {reasoningData.documentContext?.file_name || 'N/A'}
                                    </div>
                                </div>
                                <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                                    <div className="text-sm text-gray-600">Type</div>
                                    <div className="font-medium text-gray-800">
                                        {reasoningData.documentContext?.document_type || 'N/A'}
                                    </div>
                                </div>
                                <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                                    <div className="text-sm text-gray-600">Evidence Chunks</div>
                                    <div className="font-medium text-gray-800">
                                        {reasoningData.evidenceStats?.evidenceChunks || 'N/A'}
                                    </div>
                                </div>
                                <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                                    <div className="text-sm text-gray-600">Generated</div>
                                    <div className="font-medium text-gray-800">
                                        {reasoningData.timestamp ? 
                                            new Date(reasoningData.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
                                            'N/A'
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (!hasRequiredIds()) {
        return (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 text-center">
                <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Waiting for Evidence</h3>
                    <p className="text-gray-500 mb-4">
                        Please extract evidence from a document in Step 2 first.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 text-center">
                <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-200 to-purple-300 flex items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">AI Agents Reasoning</h3>
                    <p className="text-gray-500 mb-4">
                        Support and Oppose agents are analyzing the evidence...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Multi-Agent Reasoning</h3>
                <p className="text-gray-600">
                    Support and Oppose agents analyze evidence from different perspectives.
                </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Session:</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded font-mono">
                            {sessionId ? sessionId.substring(0, 8) + '...' : evidenceId?.substring(0, 8) + '...'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Document:</span>
                        <span className="text-sm font-medium text-gray-700">{documentType || 'Not specified'}</span>
                    </div>
                </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subject for Analysis
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                            placeholder="What should the agents analyze?"
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
                <button
                    onClick={handleGenerateBoth}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
                    disabled={loading}
                >
                    <span className="text-xl">🤖</span>
                    <span>Generate Both Agents</span>
                </button>
                
                <button
                    onClick={handleGenerateSupport}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
                    disabled={loading}
                >
                    <span className="text-xl">👍</span>
                    <span>Support Agent Only</span>
                </button>
                
                <button
                    onClick={handleGenerateOppose}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg hover:from-red-600 hover:to-rose-600 transition-all font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
                    disabled={loading}
                >
                    <span className="text-xl">👎</span>
                    <span>Oppose Agent Only</span>
                </button>
            </div>

            {(supportReasoning || opposeReasoning) && (
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-4">
                        <button
                            onClick={() => setActiveTab('support')}
                            className={`py-2 px-4 font-medium rounded-t-lg transition-colors ${
                                activeTab === 'support'
                                    ? 'text-green-700 border-b-2 border-green-500 bg-green-50'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Support Agent {supportReasoning && '✅'}
                        </button>
                        <button
                            onClick={() => setActiveTab('oppose')}
                            className={`py-2 px-4 font-medium rounded-t-lg transition-colors ${
                                activeTab === 'oppose'
                                    ? 'text-red-700 border-b-2 border-red-500 bg-red-50'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Oppose Agent {opposeReasoning && '✅'}
                        </button>
                        <button
                            onClick={() => setActiveTab('both')}
                            className={`py-2 px-4 font-medium rounded-t-lg transition-colors ${
                                activeTab === 'both'
                                    ? 'text-purple-700 border-b-2 border-purple-500 bg-purple-50'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Side-by-Side
                        </button>
                    </nav>
                </div>
            )}

            {activeTab === 'support' && renderReasoningCard(supportReasoning, 'support')}
            {activeTab === 'oppose' && renderReasoningCard(opposeReasoning, 'oppose')}
            {activeTab === 'both' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>{renderReasoningCard(supportReasoning, 'support')}</div>
                    <div>{renderReasoningCard(opposeReasoning, 'oppose')}</div>
                </div>
            )}

            {!supportReasoning && !opposeReasoning && !loading && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 text-center">
                    <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">Ready for Agent Reasoning</h3>
                        <p className="text-gray-500 mb-4">
                            Click any button above to generate AI agent reasoning.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentReasoning;