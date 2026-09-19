const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const apiRoutes = require('./routes/api');
const userAuthRoutes = require('./routes/userAuth');

dotenv.config();

console.log('🚀 Starting USDT Gateway Backend...');
console.log('📡 BSC RPC:', process.env.BSC_RPC_URL);
console.log('💼 Wallet:', process.env.YOUR_WALLET_ADDRESS);

const app = express();

// Connect to MongoDB
connectDB();

// Trust proxy (needed for Vercel/Render)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS — allow local + deployed frontends
app.use(cors({
    origin: [
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'https://frontend-deploy-silk.vercel.app',
        'https://krish936.github.io'
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

// ============================================================
// ROUTES
// ============================================================

// User-facing routes (always available)
app.use('/api', apiRoutes);
app.use('/api/user/auth', userAuthRoutes);

// Admin routes — only load if the file exists (private, not on GitHub)
let adminAuthRoutes;
try {
    adminAuthRoutes = require('./routes/adminAuth');
    app.use('/api/admin/auth', adminAuthRoutes);
    console.log('✅ Admin routes loaded');
} catch (error) {
    console.log('⚠️  Admin routes not available — running in user-only mode');
    console.log('   (This is expected on deployed environment)');
}

// ============================================================
// HEALTH CHECK & ROOT ROUTES
// ============================================================

app.get('/', (req, res) => {
    res.json({ 
        message: 'USDT Gateway API is running',
        status: 'active',
        mode: adminAuthRoutes ? 'full' : 'user-only',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// ERROR HANDLING
// ============================================================

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found: ' + req.method + ' ' + req.path
    });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 API URL: http://localhost:${PORT}`);
    console.log(`📊 Mode: ${adminAuthRoutes ? 'Full (User + Admin)' : 'User-only'}`);
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