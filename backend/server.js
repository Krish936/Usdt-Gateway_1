const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');                    // ← Fixed: lowercase 'm'
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const apiRoutes = require('./routes/api');
const adminAuthRoutes = require('./routes/adminAuth');
const userAuthRoutes = require('./routes/userAuth');

dotenv.config();

console.log('🚀 Starting USDT Gateway Backend...');
console.log('📡 BSC RPC:', process.env.BSC_RPC_URL);
console.log('💼 Wallet:', process.env.YOUR_WALLET_ADDRESS);

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());

// ✅ CORS — allows local + Vercel
app.use(cors({
    origin: [
        'frontend-deploy-silk.vercel.app'         // ← REPLACE THIS
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.use(express.json());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// Routes
app.use('/api', apiRoutes);                    // Core USDT gateway routes
app.use('/api/admin/auth', adminAuthRoutes);   // Admin authentication
app.use('/api/user/auth', userAuthRoutes);     // User authentication

// Test route
app.get('/', (req, res) => {
    res.json({ 
        message: 'USDT Gateway API is running',
        status: 'active'
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 API URL: http://localhost:${PORT}`);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.log(`⚠️  Port ${PORT} is already in use`);
        console.log('🔄 Trying port 5002...');
        
        const newPort = 5002;
        app.listen(newPort, () => {
            console.log(`✅ Server running on port ${newPort}`);
            console.log(`🌐 API URL: http://localhost:${newPort}`);
        });
    } else {
        console.error('❌ Server error:', error);
    }
});