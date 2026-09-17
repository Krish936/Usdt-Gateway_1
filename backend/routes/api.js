const express = require('express');
const User = require('../models/User');
const router = express.Router();
const Transaction = require('../models/Transaction');
const blockchainService = require('../utils/blockchain');

/* ============================================================
   MIDDLEWARE
   ============================================================ */

// Verify API key middleware (for admin routes)
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
        return res.status(401).json({
            success: false,
            message: 'Invalid API key'
        });
    }
    next();
};

// In-memory storage fallback
let memoryTransactions = [];

/* ============================================================
   PUBLIC ROUTES
   ============================================================ */

// Get platform info
router.get('/info', async (req, res) => {
    try {
        let todayCount = 0;
        
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            
            todayCount = await Transaction.countDocuments({
                createdAt: { $gte: todayStart }
            });
        } catch (dbError) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            todayCount = memoryTransactions.filter(tx => 
                tx.createdAt >= todayStart
            ).length;
        }
        
        res.json({
            success: true,
            data: {
                rate: parseFloat(process.env.RATE_PER_USDT),
                minDeposit: parseFloat(process.env.MIN_DEPOSIT),
                maxDeposit: parseFloat(process.env.MAX_DEPOSIT),
                dailyLimit: parseInt(process.env.DAILY_LIMIT),
                todayDeposits: todayCount,
                availableSlots: Math.max(0, parseInt(process.env.DAILY_LIMIT) - todayCount),
                receivingAddress: blockchainService.getReceivingAddress(),
                network: 'BSC (BEP-20)'
            }
        });
    } catch (error) {
        console.error('Error fetching platform info:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching platform info'
        });
    }
});

/* ============================================================
   DEPOSIT — MAIN ROUTE WITH STRICT VERIFICATION
   ============================================================ */

router.post('/deposit', async (req, res) => {
    try {
        const { txHash, amount, userAddress, bankDetails, email, phone } = req.body;
        
        /* ---------- VALIDATION ---------- */
        
        if (!txHash || !amount || !userAddress || !bankDetails || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        
        // Validate wallet address format
        if (!userAddress.startsWith('0x') || userAddress.length !== 42) {
            return res.status(400).json({
                success: false,
                message: 'Invalid BSC wallet address format'
            });
        }
        
        // Validate amount
        if (amount < parseFloat(process.env.MIN_DEPOSIT) || 
            amount > parseFloat(process.env.MAX_DEPOSIT)) {
            return res.status(400).json({
                success: false,
                message: `Amount must be between ${process.env.MIN_DEPOSIT} and ${process.env.MAX_DEPOSIT} USDT`
            });
        }
        
        // Validate bank details
        if (!bankDetails.accountHolderName || !bankDetails.accountNumber || 
            !bankDetails.ifscCode || !bankDetails.bankName) {
            return res.status(400).json({
                success: false,
                message: 'Complete bank details are required'
            });
        }
        
        /* ---------- CHECK 1: DAILY LIMIT ---------- */
        
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        let todayCount = 0;
        try {
            todayCount = await Transaction.countDocuments({
                createdAt: { $gte: todayStart }
            });
        } catch (dbError) {
            todayCount = memoryTransactions.filter(tx => tx.createdAt >= todayStart).length;
        }
        
        if (todayCount >= parseInt(process.env.DAILY_LIMIT)) {
            return res.status(400).json({
                success: false,
                message: 'Daily limit reached. Please try again tomorrow.'
            });
        }
        
        /* ---------- CHECK 2: DUPLICATE TXHASH ---------- */
        
        const normalizedTxHash = txHash.toLowerCase();
        
        const existingTx = await Transaction.findOne({ txHash: normalizedTxHash });
        if (existingTx) {
            console.log(`⚠️  Duplicate TxHash attempt: ${normalizedTxHash}`);
            return res.status(400).json({
                success: false,
                message: 'This transaction hash has already been submitted.'
            });
        }
        
        // Also check memory fallback
        const memoryDup = memoryTransactions.find(tx => tx.txHash === normalizedTxHash);
        if (memoryDup) {
            return res.status(400).json({
                success: false,
                message: 'This transaction hash has already been submitted.'
            });
        }
        
        /* ---------- CALCULATE INR ---------- */
        
        const amountInINR = amount * parseFloat(process.env.RATE_PER_USDT);
        
        /* ---------- CHECK 3-8: BLOCKCHAIN VERIFICATION ---------- */
        
        console.log(`\n🔍 Starting deposit verification...`);
        console.log(`   TxHash: ${normalizedTxHash}`);
        console.log(`   Expected amount: ${amount} USDT`);
        console.log(`   Expected from: ${userAddress}`);
        
        const verification = await blockchainService.verifyTransaction(
            txHash,           // Original case (backend normalizes internally)
            amount,           // Expected amount
            userAddress       // Expected sender
        );
        
        /* ---------- HANDLE VERIFICATION FAILURE ---------- */
        
        if (!verification.success) {
            console.log(`❌ Verification failed: ${verification.message}`);
            
            // Log failed attempt for admin review
            const failedTx = new Transaction({
                txHash: normalizedTxHash,
                userAddress: userAddress.toLowerCase(),
                amount,
                amountInINR,
                rate: parseFloat(process.env.RATE_PER_USDT),
                bankDetails,
                email: email.toLowerCase(),
                phone,
                status: 'failed',
                notes: verification.message
            });
            
            try {
                await failedTx.save();
            } catch (e) {
                console.log('Failed to save failed-tx record:', e.message);
            }
            
            return res.status(400).json({
                success: false,
                message: verification.message
            });
        }
        
        /* ---------- ALL CHECKS PASSED — SAVE TRANSACTION ---------- */
        
        console.log(`✅ All verification checks passed!`);
        
        const transactionData = {
            txHash: normalizedTxHash,
            userAddress: userAddress.toLowerCase(),
            amount,
            amountInINR,
            rate: parseFloat(process.env.RATE_PER_USDT),
            bankDetails,
            email: email.toLowerCase(),
            phone,
            status: 'verified',
            blockchainData: verification.data,
            verifiedAt: new Date(),
            notes: 'All blockchain checks passed',
            createdAt: new Date()
        };
        
        let savedTransaction;
        
        try {
            const transaction = new Transaction(transactionData);
            savedTransaction = await transaction.save();
            console.log(`✅ Transaction saved to DB: ${savedTransaction._id}`);
        } catch (dbError) {
            console.log('⚠️  Database save failed, using memory storage:', dbError.message);
            transactionData._id = Date.now().toString();
            memoryTransactions.push(transactionData);
            savedTransaction = transactionData;
        }
        
        /* ---------- UPDATE USER STATS ---------- */
        
        try {
            const user = await User.findOne({ walletAddress: userAddress.toLowerCase() });
            if (user) {
                user.totalUSDTDeposited = (user.totalUSDTDeposited || 0) + amount;
                user.totalTransactions = (user.totalTransactions || 0) + 1;
                
                // Update bank details if not already set
                if (bankDetails && (!user.bankDetails?.accountNumber || user.bankDetails.accountNumber === '')) {
                    user.bankDetails = bankDetails;
                }
                
                // Also update wallet if it was empty
                if (!user.walletAddress) {
                    user.walletAddress = userAddress.toLowerCase();
                }
                
                await user.save();
                console.log(`✅ Updated stats for user: ${user.email}`);
            } else {
                console.log(`⚠️  No registered user found for wallet: ${userAddress}`);
            }
        } catch (userError) {
            console.log('⚠️  User stats update failed (non-critical):', userError.message);
        }
        
        /* ---------- RESPONSE ---------- */
        
        res.json({
            success: true,
            message: 'Deposit verified and submitted successfully',
            data: {
                transactionId: savedTransaction._id,
                status: savedTransaction.status,
                amountInINR: amountInINR,
                verifiedAmount: verification.data.amount,
                from: verification.data.from,
                to: verification.data.to,
                blockNumber: verification.data.blockNumber,
                message: 'INR will be credited within 24 hours'
            }
        });
        
    } catch (error) {
        console.error('❌ Deposit error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing deposit: ' + error.message
        });
    }
});

/* ============================================================
   TRANSACTION STATUS
   ============================================================ */

router.get('/transaction/:txHash', async (req, res) => {
    try {
        let transaction = null;
        const normalizedTxHash = req.params.txHash.toLowerCase();
        
        try {
            transaction = await Transaction.findOne({
                txHash: normalizedTxHash
            });
        } catch (dbError) {
            transaction = memoryTransactions.find(tx => tx.txHash === normalizedTxHash);
        }
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                txHash: transaction.txHash,
                amount: transaction.amount,
                amountInINR: transaction.amountInINR,
                status: transaction.status,
                notes: transaction.notes,
                createdAt: transaction.createdAt,
                verifiedAt: transaction.verifiedAt,
                completedAt: transaction.completedAt
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching transaction'
        });
    }
});

/* ============================================================
   ADMIN ROUTES
   ============================================================ */

// Get all transactions
router.get('/admin/transactions', verifyApiKey, async (req, res) => {
    try {
        let transactions = [];
        
        try {
            transactions = await Transaction.find()
                .sort({ createdAt: -1 })
                .limit(100);
        } catch (dbError) {
            transactions = memoryTransactions
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 100);
        }
        
        res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching transactions'
        });
    }
});

// Update transaction status
router.put('/admin/transaction/:id', verifyApiKey, async (req, res) => {
    try {
        const { status, notes } = req.body;
        let transaction = null;
        
        try {
            transaction = await Transaction.findById(req.params.id);
        } catch (dbError) {
            transaction = memoryTransactions.find(tx => tx._id === req.params.id);
        }
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }
        
        if (typeof transaction === 'object' && !transaction.save) {
            // Memory transaction
            transaction.status = status;
            transaction.notes = notes || transaction.notes;
            if (status === 'completed') {
                transaction.completedAt = new Date();
            }
        } else {
            // Database transaction
            transaction.status = status;
            transaction.notes = notes || transaction.notes;
            if (status === 'completed') {
                transaction.completedAt = new Date();
            }
            await transaction.save();
            
            // Update user stats when transaction is completed
            if (status === 'completed') {
                try {
                    const user = await User.findOne({ 
                        walletAddress: transaction.userAddress.toLowerCase() 
                    });
                    if (user) {
                        user.totalINRReceived = (user.totalINRReceived || 0) + transaction.amountInINR;
                        await user.save();
                        console.log(`✅ Updated INR stats for user: ${user.email}`);
                    }
                } catch (userError) {
                    console.log('⚠️  User INR stats update failed:', userError.message);
                }
            }
        }
        
        res.json({
            success: true,
            data: transaction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating transaction'
        });
    }
});

module.exports = router;