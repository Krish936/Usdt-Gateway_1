const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const dataDir = path.join(__dirname, 'data', 'mongodb');
console.log('📂 Data directory:', dataDir);

async function clearTestData() {
    let mongod;
    
    try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        
        mongod = await MongoMemoryServer.create({
            instance: {
                dbPath: dataDir,
                storageEngine: 'wiredTiger'
            }
        });
        
        const uri = mongod.getUri();
        console.log('🔗 Connected to:', uri);
        
        await mongoose.connect(uri);
        console.log('✅ MongoDB connected');
        
        const arg = process.argv[2] || 'all';
        
        const User = require('./models/User');
        const Transaction = require('./models/Transaction');
        const Admin = require('./models/Admin');
        
        console.log('\n📊 Current data:');
        console.log('   Users:', await User.countDocuments());
        console.log('   Transactions:', await Transaction.countDocuments());
        console.log('   Admins:', await Admin.countDocuments());
        
        const users = await User.find().select('email fullName');
        if (users.length > 0) {
            console.log('\n👥 Users:');
            users.forEach(u => console.log(`   - ${u.email} | ${u.fullName}`));
        }
        
        console.log(`\n🗑️  Deleting: ${arg}`);
        
        if (arg === 'all') {
            const userResult = await User.deleteMany({});
            const txResult = await Transaction.deleteMany({});
            console.log(`✅ Deleted ${userResult.deletedCount} users`);
            console.log(`✅ Deleted ${txResult.deletedCount} transactions`);
            console.log(`ℹ️  Admins kept`);
        } else if (arg === 'users') {
            const result = await User.deleteMany({});
            console.log(`✅ Deleted ${result.deletedCount} users`);
        } else if (arg === 'transactions') {
            const result = await Transaction.deleteMany({});
            console.log(`✅ Deleted ${result.deletedCount} transactions`);
        } else if (arg === 'admins') {
            const result = await Admin.deleteMany({});
            console.log(`✅ Deleted ${result.deletedCount} admins`);
        } else if (arg.includes('@')) {
            const email = arg.toLowerCase();
            const userResult = await User.deleteMany({ email });
            const txResult = await Transaction.deleteMany({ email });
            console.log(`✅ Deleted ${userResult.deletedCount} user(s): ${email}`);
            console.log(`✅ Deleted ${txResult.deletedCount} transaction(s): ${email}`);
        } else {
            console.log('❌ Unknown argument. Use:');
            console.log('   node clear-test-data.js all');
            console.log('   node clear-test-data.js users');
            console.log('   node clear-test-data.js transactions');
            console.log('   node clear-test-data.js admins');
            console.log('   node clear-test-data.js user@email.com');
        }
        
        console.log('\n📊 Final data:');
        console.log('   Users:', await User.countDocuments());
        console.log('   Transactions:', await Transaction.countDocuments());
        console.log('   Admins:', await Admin.countDocuments());
        
        await mongoose.disconnect();
        await mongod.stop();
        
        console.log('\n✅ Done!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (mongod) await mongod.stop();
        process.exit(1);
    }
}

clearTestData();