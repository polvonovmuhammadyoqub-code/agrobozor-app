import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'agrobozor_secure_jwt_secret_token_key_2025';
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi (Token yo\'q)' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(403).json({ error: 'Yaroqsiz yoki muddati o\'tgan token' });
    }
};
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Ruxsat berilmagan amal (Role cheklovi)' });
        }
        next();
    };
};
