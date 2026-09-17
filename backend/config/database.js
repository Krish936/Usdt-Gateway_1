const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const connectDB = async () => {
    try {
        let mongoURI = process.env.MONGODB_URI;
        
        // Ensure data directory exists
        const dataDir = path.join(__dirname, '..', 'data', 'mongodb');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Check if we should use in-memory MongoDB
        const useMemoryDB = !mongoURI || 
                           mongoURI.includes('127.0.0.1') || 
                           mongoURI.includes('localhost') ||
                           process.env.USE_MEMORY_DB === 'true';
        
        if (useMemoryDB) {
            console.log('📦 Starting persistent MongoDB...');
            const { MongoMemoryServer } = require('mongodb-memory-server');
            
            const mongod = await MongoMemoryServer.create({
                instance: {
                    dbPath: dataDir,
                    storageEngine: 'wiredTiger'
                }
            });
            
            mongoURI = mongod.getUri();
            console.log('✅ Persistent MongoDB started');
            console.log('💾 Data directory:', dataDir);
        }
        
        const conn = await mongoose.connect(mongoURI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        
        global.mongooseConnection = conn;
        
    } catch (error) {
        console.error(`❌ MongoDB Error: ${error.message}`);
        console.log('⚠️  Continuing without database');
        global.mongooseConnection = null;
    }
};

module.exports = connectDB;