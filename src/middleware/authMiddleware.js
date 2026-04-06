const jwt = require('jsonwebtoken');

const adminCredentials = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
};

// Middleware para autenticação básica
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acesso não autorizado' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
};

// Função para gerar token
const generateToken = (username) => {
    return jwt.sign(
        { username, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );
};

// Função para validar credenciais
const validateCredentials = (username, password) => {
    return username === adminCredentials.username && password === adminCredentials.password;
};

module.exports = { authenticate, generateToken, validateCredentials };
