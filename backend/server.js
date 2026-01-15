import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import synthesisService from './services/synthesisService.js';
import documentRoutes from './routes/documentRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import responseRoutes from './routes/responseRoutes.js';
import synthesisRoutes from './routes/synthesisRoutes.js';
import connectDB from './configs/db.js';
connectDB();


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aether';

console.log('🚀 Starting AETHER Backend');
console.log(`🔧 Port: ${PORT}`);
console.log(`🗄️  MongoDB: ${MONGODB_URI}`);

// Middleware
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Health check
app.get('/api/health', async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
        status: 'ok',
        service: 'AETHER Backend',
        database: dbStatus,
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

//routes
app.use('/api/documents', documentRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/synthesis', synthesisRoutes);


// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'AETHER Backend API',
        endpoints: {
            health: 'GET /api/health',
            upload: 'POST /api/documents/upload',
            evidence: 'GET /api/documents/evidence?sessionId=YOUR_ID'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ AETHER backend running on port ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`\n📌 Test endpoints:`);
    console.log(`   curl http://localhost:${PORT}/api/health`);
    console.log(`   curl "http://localhost:${PORT}/api/documents/evidence?sessionId=test123"`);
});