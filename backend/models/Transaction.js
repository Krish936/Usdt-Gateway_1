const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    txHash: {
        type: String,
        required: true,
        unique: true
    },
    userAddress: {
        type: String,
        required: true,
        lowercase: true
    },
    amount: {
        type: Number,
        required: true,
        min: 10,
        max: 1000
    },
    amountInINR: {
        type: Number,
        required: true
    },
    rate: {
        type: Number,
        default: 105
    },
    bankDetails: {
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String,
        bankName: String
    },
    email: {
        type: String,
        required: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'processing', 'completed', 'failed', 'rejected'],
        default: 'pending'
    },
    blockchainData: {
        blockNumber: Number,
        from: String,
        to: String,
        timestamp: Date
    },
    verifiedAt: Date,
    completedAt: Date,
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Check if model exists before creating
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;