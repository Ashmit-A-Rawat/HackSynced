import express from 'express';
import documentController from '../controllers/documentController.js';

const router = express.Router();

// Test endpoint
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Document routes are working'
    });
});

// Upload endpoint
router.post('/upload', express.json(), async (req, res, next) => {
    try {
        const { file, filename, filetype, sessionId } = req.body;
        
        if (!file || !filename) {
            return res.status(400).json({
                success: false,
                error: 'File data and filename are required'
            });
        }
        
        const matches = file.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (!matches || matches.length !== 3) {
            return res.status(400).json({
                success: false,
                error: 'Invalid base64 file data'
            });
        }
        
        const buffer = Buffer.from(matches[2], 'base64');
        
        req.file = {
            originalname: filename,
            mimetype: matches[1] || filetype || 'application/octet-stream',
            buffer: buffer,
            size: buffer.length
        };
        
        req.body = { sessionId };
        next();
        
    } catch (error) {
        res.status(400).json({
            success: false,
            error: 'Failed to process file upload'
        });
    }
}, documentController.uploadDocument);

// Get evidence endpoint
router.get('/evidence', documentController.getEvidence);

export default router;