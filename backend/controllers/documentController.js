import documentService from '../services/documentService.js';

class DocumentController {
    async uploadDocument(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            const sessionId = req.body.sessionId;
            const result = await documentService.processDocument(req.file, sessionId);

            res.json({
                success: true,
                message: 'Document processed successfully',
                sessionId: result.sessionId,
                evidenceId: result.evidenceId,
                documentType: result.documentType,
                data: result.data
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getEvidence(req, res) {
        try {
            const { sessionId, evidenceId } = req.query;
            
            if (!sessionId && !evidenceId) {
                return res.status(400).json({
                    success: false,
                    error: 'sessionId or evidenceId required'
                });
            }
            
            let evidence;
            if (evidenceId) {
                evidence = await documentService.getEvidenceById(evidenceId);
            } else {
                evidence = await documentService.getEvidenceBySessionId(sessionId);
            }

            if (!evidence) {
                return res.status(404).json({
                    success: false,
                    error: 'Evidence not found'
                });
            }

            res.json({
                success: true,
                evidence
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

export default new DocumentController();