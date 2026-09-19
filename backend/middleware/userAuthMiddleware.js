const crypto = require('crypto');

const validTokens = new Map();

const userAuthMiddleware = {
    generateToken(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        validTokens.set(token, {
            userId: userId,
            adminId: userId,
            createdAt: Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000)
        });
        return token;
    },
    
    verifyToken(req, res, next) {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'Access denied. No token provided.'
                });
            }
            
            const tokenData = validTokens.get(token);
            
            if (!tokenData) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }
            
            if (tokenData.expiresAt < Date.now()) {
                validTokens.delete(token);
                return res.status(401).json({
                    success: false,
                    message: 'Token expired. Please login again.'
                });
            }
            
            req.userId = tokenData.userId;
            req.adminId = tokenData.adminId;
            req.token = token;
            next();
        } catch (error) {
            console.error('Auth error:', error);
            res.status(500).json({
                success: false,
                message: 'Authentication error'
            });
        }
    },
    
    invalidateToken(token) {
        validTokens.delete(token);
    },
    
    getActiveTokens() {
        return validTokens.size;
    }
};

module.exports = userAuthMiddleware;