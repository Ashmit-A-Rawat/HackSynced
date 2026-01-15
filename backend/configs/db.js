import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        // Try multiple environment variable names
        const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
        
        if (!mongoURI) {
            console.log('📝 No MongoDB URI found, using in-memory storage only');
            console.log('💡 Add MONGODB_URI to .env for persistent storage');
            return;
        }
        
        console.log('🔗 Attempting to connect to MongoDB...');
        
        // For Mongoose 9+, use simpler connection options
        await mongoose.connect(mongoURI);
        
        console.log('✅ MongoDB Connected Successfully!');
        console.log(`📊 Database: ${mongoose.connection.name}`);
        console.log(`🏠 Host: ${mongoose.connection.host}`);
        
        // Test the connection
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`📁 Collections: ${collections.map(c => c.name).join(', ') || 'None'}`);
        
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        console.log('\n🎯 For hackathon, using in-memory storage instead');
        console.log('💡 Persistent storage disabled, but app will still work');
    }
};

// Connection events
mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.log('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('🔌 Mongoose disconnected');
});

export default connectDB;