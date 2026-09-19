const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        
        // Debug output
        console.log('📋 MONGODB_URI starts with:', uri ? uri.substring(0, 30) + '...' : 'NOT SET');
        
        // Validate the URI format
        if (!uri) {
            throw new Error('MONGODB_URI is not set in .env file');
        }
        
        if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
            throw new Error(
                'Invalid MONGODB_URI format. Must start with "mongodb://" or "mongodb+srv://"\n' +
                'Current value starts with: ' + uri.substring(0, 30)
            );
        }
        
        // Connect to MongoDB
        const conn = await mongoose.connect(uri);
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        
    } catch (error) {
        console.error(`❌ MongoDB Error: ${error.message}`);
        
        // Don't crash in dev mode — let the server run for debugging
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        } else {
            console.log('⚠️  Continuing without database (development mode)');
        }
    }
};

module.exports = connectDB;