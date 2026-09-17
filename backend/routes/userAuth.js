const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');

/* ============================================================
   REGISTER — New user signup (wallet optional)
   ============================================================ */

router.post('/register', async (req, res) => {
    try {
        const { fullName, email, phone, password, walletAddress, bankDetails } = req.body;
        
        console.log('📥 Register request:', {
            fullName,
            email,
            phone,
            walletAddress: walletAddress || '(empty)'
        });
        
        // Convert to safe strings
        const fullNameStr = String(fullName || '').trim();
        const emailStr = String(email || '').trim().toLowerCase();
        const phoneStr = String(phone || '').trim();
        const passwordStr = String(password || '');
        const walletStr = String(walletAddress || '').trim().toLowerCase();
        
        // Validate required fields
        if (!fullNameStr || !emailStr || !phoneStr || !passwordStr) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        
        // Password length
        if (passwordStr.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }
        
        // Email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailStr)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }
        
        // Phone format
        const phoneRegex = /^[0-9+\-\s]{10,15}$/;
        if (!phoneRegex.test(phoneStr)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number (10-15 digits required)'
            });
        }
        
        // Wallet format (only if provided)
        if (walletStr !== '') {
            if (!walletStr.startsWith('0x') || walletStr.length !== 42) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid BSC wallet address'
                });
            }
        }
        
        // Check duplicates
        const existingUser = await User.findOne({
            $or: [
                { email: emailStr },
                { phone: phoneStr }
            ]
        });
        
        if (existingUser) {
            let message = 'User already exists with this ';
            if (existingUser.email === emailStr) message += 'email';
            else message += 'phone number';
            
            return res.status(400).json({
                success: false,
                message
            });
        }
        
        // Create user
        const user = new User({
            fullName: fullNameStr,
            email: emailStr,
            phone: phoneStr,
            walletAddress: walletStr,   // empty string if not provided
            bankDetails: bankDetails || {}
        });
        
        user.setPassword(passwordStr);
        await user.save();
        
        console.log(`✅ New user registered: ${user.email}`);
        
        // Generate token
        const token = authMiddleware.generateToken(user._id);
        
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                token,
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    phone: user.phone,
                    walletAddress: user.walletAddress,
                    kycStatus: user.kycStatus
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error.message);
        console.error('Stack:', error.stack);
        
        // Duplicate key (E11000)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0] || 'field';
            return res.status(400).json({
                success: false,
                message: `This ${field} is already registered`
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error during registration: ' + error.message
        });
    }
});

/* ============================================================
   LOGIN
   ============================================================ */

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        const emailStr = String(email).trim().toLowerCase();
        const passwordStr = String(password);
        
        // Find user
        const user = await User.findOne({ email: emailStr });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Active check
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Contact support.'
            });
        }
        
        // Verify password
        if (!user.verifyPassword(passwordStr)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Generate token
        const token = authMiddleware.generateToken(user._id);
        
        // Update login info
        user.lastLogin = new Date();
        if (!user.loginHistory) user.loginHistory = [];
        user.loginHistory.push({
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: new Date()
        });
        await user.save();
        
        console.log(`✅ User logged in: ${user.email}`);
        
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    phone: user.phone,
                    walletAddress: user.walletAddress,
                    kycStatus: user.kycStatus,
                    bankDetails: user.bankDetails
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error during login'
        });
    }
});

/* ============================================================
   PROFILE — Get current user
   ============================================================ */

router.get('/profile', authMiddleware.verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('-password -salt -loginHistory');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
        
    } catch (error) {
        console.error('Profile error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile'
        });
    }
});

/* ============================================================
   TRANSACTIONS — Get user's deposits
   ============================================================ */

router.get('/transactions', authMiddleware.verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Build query — match by wallet OR email
        const orConditions = [];
        
        if (user.walletAddress && user.walletAddress.trim() !== '') {
            orConditions.push({ userAddress: user.walletAddress.toLowerCase() });
        }
        
        if (user.email) {
            orConditions.push({ email: user.email.toLowerCase() });
        }
        
        if (orConditions.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }
        
        const transactions = await Transaction.find({
            $or: orConditions
        }).sort({ createdAt: -1 }).limit(50);
        
        res.json({
            success: true,
            data: transactions
        });
        
    } catch (error) {
        console.error('Transactions error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching transactions'
        });
    }
});

/* ============================================================
   PROFILE UPDATE
   ============================================================ */

router.put('/profile', authMiddleware.verifyToken, async (req, res) => {
    try {
        const updates = { ...req.body };
        
        // Strip sensitive fields
        delete updates.password;
        delete updates.salt;
        delete updates.totalUSDTDeposited;
        delete updates.totalINRReceived;
        delete updates.totalTransactions;
        delete updates._id;
        delete updates.createdAt;
        
        // Normalize wallet if provided
        if (updates.walletAddress) {
            updates.walletAddress = String(updates.walletAddress).trim().toLowerCase();
            if (updates.walletAddress === '') {
                delete updates.walletAddress;
            }
        }
        
        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password -salt');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Profile updated',
            data: user
        });
        
    } catch (error) {
        console.error('Profile update error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error updating profile: ' + error.message
        });
    }
});

/* ============================================================
   STATS — Dashboard summary
   ============================================================ */

router.get('/stats', authMiddleware.verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Fetch recent transactions
        const orConditions = [];
        if (user.walletAddress && user.walletAddress.trim() !== '') {
            orConditions.push({ userAddress: user.walletAddress.toLowerCase() });
        }
        if (user.email) {
            orConditions.push({ email: user.email.toLowerCase() });
        }
        
        let recentTransactions = [];
        if (orConditions.length > 0) {
            recentTransactions = await Transaction.find({
                $or: orConditions
            }).sort({ createdAt: -1 }).limit(10);
        }
        
        res.json({
            success: true,
            data: {
                totalUSDTDeposited: user.totalUSDTDeposited || 0,
                totalINRReceived: user.totalINRReceived || 0,
                totalTransactions: user.totalTransactions || 0,
                kycStatus: user.kycStatus || 'pending',
                recentTransactions
            }
        });
        
    } catch (error) {
        console.error('Stats error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching stats'
        });
    }
});

/* ============================================================
   LOGOUT
   ============================================================ */

router.post('/logout', authMiddleware.verifyToken, (req, res) => {
    authMiddleware.invalidateToken(req.token);
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = router;