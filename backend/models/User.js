const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        required: true
    },
    walletAddress: {
     type: String,
     lowercase: true,
     default: ''
    },
    bankDetails: {
        accountHolderName: {
            type: String,
            default: ''
        },
        accountNumber: {
            type: String,
            default: ''
        },
        ifscCode: {
            type: String,
            default: ''
        },
        bankName: {
            type: String,
            default: ''
        }
    },
    kycStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    totalUSDTDeposited: {
        type: Number,
        default: 0
    },
    totalINRReceived: {
        type: Number,
        default: 0
    },
    totalTransactions: {
        type: Number,
        default: 0
    },
    lastLogin: {
        type: Date
    },
    loginHistory: [{
        ip: String,
        userAgent: String,
        timestamp: Date
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Method to set password
userSchema.methods.setPassword = function(password) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.password = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512').toString('hex');
};

// Method to verify password
userSchema.methods.verifyPassword = function(password) {
    const hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512').toString('hex');
    return this.password === hash;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;