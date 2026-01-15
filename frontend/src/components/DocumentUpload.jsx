import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const DocumentUpload = ({ onEvidenceExtracted }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [sessionId, setSessionId] = useState('');
    const [backendStatus, setBackendStatus] = useState('checking');

    const BACKEND_URL = 'http://localhost:5001';

    useEffect(() => {
        const storedSession = localStorage.getItem('aether_session_id');
        if (storedSession) {
            setSessionId(storedSession);
        } else {
            const newSessionId = uuidv4();
            setSessionId(newSessionId);
            localStorage.setItem('aether_session_id', newSessionId);
        }

        checkBackendHealth();
    }, []);

    const checkBackendHealth = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/health`);
            if (response.ok) {
                setBackendStatus('connected');
            } else {
                setBackendStatus('disconnected');
            }
        } catch (err) {
            setBackendStatus('disconnected');
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.type === 'application/pdf' || 
                selectedFile.type === 'text/plain' ||
                selectedFile.name.endsWith('.txt') ||
                selectedFile.name.endsWith('.pdf')) {
                setFile(selectedFile);
                setError('');
            } else {
                setError('Please upload a PDF or text file');
                setFile(null);
            }
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        if (backendStatus !== 'connected') {
            setError('Backend server is not connected. Please make sure backend is running on port 5001.');
            return;
        }

        setUploading(true);
        setError('');
        
        try {
            // Convert file to base64
            const reader = new FileReader();
            
            const uploadPromise = new Promise((resolve, reject) => {
                reader.onload = async (event) => {
                    try {
                        const base64Data = event.target.result;
                        
                        const uploadData = {
                            file: base64Data,
                            filename: file.name,
                            filetype: file.type,
                            sessionId: sessionId
                        };
                        
                        const response = await fetch(`${BACKEND_URL}/api/documents/upload`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(uploadData)
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        const data = await response.json();
                        resolve(data);
                        
                    } catch (err) {
                        reject(err);
                    }
                };
                
                reader.onerror = (error) => {
                    reject(new Error('Failed to read file'));
                };
                
                reader.readAsDataURL(file);
            });
            
            const data = await uploadPromise;

            if (data.success) {
                setResult({
                    ...data.data,
                    sessionId: data.sessionId,
                    evidenceId: data.evidenceId,
                    documentType: data.documentType
                });
                
                if (onEvidenceExtracted) {
                    onEvidenceExtracted({
    evidence: data.data.evidence,
    sessionId: data.sessionId,
    evidenceId: data.evidenceId,
    documentType: data.documentType
});

                }

                localStorage.setItem('aether_evidence_id', data.evidenceId);
            } else {
                setError(data.error || 'Upload failed');
            }
        } catch (err) {
            setError(`Failed to process document: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            if (droppedFile.type === 'application/pdf' || 
                droppedFile.type === 'text/plain' ||
                droppedFile.name.endsWith('.txt') ||
                droppedFile.name.endsWith('.pdf')) {
                setFile(droppedFile);
                setError('');
            } else {
                setError('Please upload a PDF or text file');
            }
        }
    };

    const handleNewSession = () => {
        const newSessionId = uuidv4();
        setSessionId(newSessionId);
        localStorage.setItem('aether_session_id', newSessionId);
        setResult(null);
        setFile(null);
        setError('');
    };

    return (
        <div className="space-y-6">
            {/* Connection Status */}
            <div className={`border-l-4 p-4 rounded-lg ${backendStatus === 'connected' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                <div className="flex items-center">
                    {backendStatus === 'connected' ? (
                        <svg className="w-6 h-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    ) : (
                        <svg className="w-6 h-6 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    )}
                    <div>
                        <p className={`font-medium ${backendStatus === 'connected' ? 'text-green-700' : 'text-red-700'}`}>
                            Backend {backendStatus === 'connected' ? 'Connected' : 'Disconnected'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Session Management */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                        <svg className="w-6 h-6 text-purple-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                        </svg>
                        <div>
                            <p className="text-purple-700 font-medium">Session Management</p>
                            <p className="text-purple-600 text-sm">Evidence is stored under this session ID</p>
                        </div>
                    </div>
                    <button
                        onClick={handleNewSession}
                        className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                    >
                        New Session
                    </button>
                </div>
                <div className="mt-2 p-3 bg-white/50 rounded-lg">
                    <p className="text-sm text-gray-600 break-all font-mono">
                        {sessionId}
                    </p>
                </div>
            </div>

            {/* Upload Area */}
            <div className="space-y-4">
                <div 
                    className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'} ${uploading ? 'opacity-50' : ''}`}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center">
                            {uploading ? (
                                <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                                </svg>
                            )}
                        </div>
                        
                        <p className="text-gray-700 mb-2">
                            {file ? file.name : 'Drag & drop your document here'}
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                            Supports PDF and TXT files
                        </p>
                        
                        <label className="cursor-pointer">
                            <input
                                type="file"
                                id="document-upload"
                                accept=".pdf,.txt"
                                onChange={handleFileChange}
                                disabled={uploading || backendStatus !== 'connected'}
                                className="hidden"
                            />
                            <span className={`inline-block px-6 py-3 font-medium rounded-lg transition-all duration-300 ${uploading || backendStatus !== 'connected' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'}`}>
                                {file ? 'Change File' : 'Choose File'}
                            </span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-center">
                    <button 
                        onClick={handleUpload} 
                        disabled={!file || uploading || backendStatus !== 'connected'}
                        className={`px-8 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all duration-300 ${
                            !file || uploading || backendStatus !== 'connected'
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                        }`}
                    >
                        {uploading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            'Extract Evidence'
                        )}
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                    <div className="flex items-center">
                        <svg className="w-6 h-6 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div>
                            <p className="text-red-700 font-medium">Error</p>
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Summary */}
            {result && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800">Extraction Results</h3>
                        <div className="flex items-center gap-2 text-green-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span className="font-semibold">Complete</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">Document Type</div>
                            <div className="text-xl font-bold text-blue-600 capitalize">
                                {result.documentType || 'Document'}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">Original Length</div>
                            <div className="text-2xl font-bold text-purple-600">
                                {result.original_text_length?.toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">Total Chunks</div>
                            <div className="text-2xl font-bold text-green-600">
                                {result.total_chunks}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">Evidence Chunks</div>
                            <div className="text-2xl font-bold text-indigo-600">
                                {result.evidence?.length || 0}
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-blue-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-2">
                                    Evidence stored in memory under session:
                                </p>
                                <p className="text-xs text-gray-500 font-mono break-all bg-white p-2 rounded">
                                    {sessionId}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-2">
                                    Ready for next agents:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Support Agent</span>
                                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full">Oppose Agent</span>
                                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Synthesis Agent</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentUpload;