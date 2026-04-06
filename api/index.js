const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();

// Middlewares
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'hub_plataformas_secret_key_2024';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Modelo Platform
const platformSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, uppercase: true },
    domain: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, required: true, enum: ['pagando', 'lancamento', 'destaque'], default: 'pagando' },
    badge: { type: String, default: null },
    hot: { type: Boolean, default: false },
    image: { type: String, default: null },
    link: { type: String, required: true, trim: true }
}, { timestamps: true });

const Platform = mongoose.models.Platform || mongoose.model('Platform', platformSchema);

// Variável de conexão
let isConnected = false;

// Função para conectar ao MongoDB
async function connectDB() {
    if (isConnected) {
        console.log('✅ Usando conexão existente');
        return;
    }
    
    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI não definida');
        throw new Error('MONGODB_URI não configurada');
    }
    
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
        });
        isConnected = true;
        console.log('✅ MongoDB Atlas Conectado');
    } catch (error) {
        console.error('❌ Erro ao conectar:', error.message);
        throw error;
    }
}

// Funções de autenticação
function generateToken(username) {
    return jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
}

function validateCredentials(username, password) {
    return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Acesso não autorizado' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
    }
}

// ============ ROTAS DA API ============

// Health check
app.get('/api/health', async (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API funcionando!',
        timestamp: new Date().toISOString()
    });
});

// Status do banco
app.get('/api/db-status', async (req, res) => {
    try {
        await connectDB();
        res.json({ 
            success: true, 
            status: 'connected',
            database: mongoose.connection.name
        });
    } catch (error) {
        res.json({ 
            success: false, 
            status: 'disconnected',
            error: error.message
        });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (validateCredentials(username, password)) {
        const token = generateToken(username);
        res.json({
            success: true,
            token,
            message: 'Login realizado com sucesso'
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Usuário ou senha inválidos'
        });
    }
});

// Listar plataformas
app.get('/api/platforms', async (req, res) => {
    try {
        await connectDB();
        const { type, search } = req.query;
        let query = {};
        
        if (type && type !== 'all') {
            if (type === 'destaque') {
                query = { $or: [{ type: 'destaque' }, { hot: true }] };
            } else {
                query.type = type;
            }
        }
        
        if (search && search.trim()) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { domain: { $regex: search, $options: 'i' } }
            ];
        }
        
        const platforms = await Platform.find(query).sort({ hot: -1, createdAt: -1 });
        res.json({ success: true, count: platforms.length, data: platforms });
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Buscar plataforma por ID
app.get('/api/platforms/:id', async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.findById(req.params.id);
        
        if (!platform) {
            return res.status(404).json({ success: false, message: 'Plataforma não encontrada' });
        }
        
        res.json({ success: true, data: platform });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Estatísticas
app.get('/api/stats', async (req, res) => {
    try {
        await connectDB();
        const total = await Platform.countDocuments();
        const pagando = await Platform.countDocuments({ type: 'pagando' });
        const lancamento = await Platform.countDocuments({ type: 'lancamento' });
        const destaque = await Platform.countDocuments({ type: 'destaque' });
        const hot = await Platform.countDocuments({ hot: true });
        
        res.json({
            success: true,
            data: { total, pagando, lancamento, destaque, hot }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Criar plataforma (protegido)
app.post('/api/platforms', authenticate, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.create(req.body);
        res.status(201).json({ success: true, data: platform });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Atualizar plataforma (protegido)
app.put('/api/platforms/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.findById(req.params.id);
        
        if (!platform) {
            return res.status(404).json({ success: false, message: 'Plataforma não encontrada' });
        }
        
        const updatedPlatform = await Platform.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        res.json({ success: true, data: updatedPlatform });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Excluir plataforma (protegido)
app.delete('/api/platforms/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.findById(req.params.id);
        
        if (!platform) {
            return res.status(404).json({ success: false, message: 'Plataforma não encontrada' });
        }
        
        await platform.deleteOne();
        res.json({ success: true, message: 'Plataforma excluída com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Seed inicial (protegido)
app.post('/api/seed', authenticate, async (req, res) => {
    try {
        await connectDB();
        const count = await Platform.countDocuments();
        
        if (count === 0) {
            const initialData = [
                { name: "EE44", domain: "EE44.COM", type: "pagando", badge: "💰 PAGANDO AGORA", hot: true, link: "https://ee44.com", image: null },
                { name: "8EEE", domain: "8EEE.COM", type: "pagando", badge: "💵 PAGANDO INSTANTÂNEO", hot: true, link: "https://8eee.com", image: null },
                { name: "84D", domain: "84D.COM", type: "lancamento", badge: "🚀 NOVO LANÇAMENTO", hot: false, link: "https://84d.com", image: null },
                { name: "33X", domain: "33X.COM", type: "destaque", badge: "🏆 TOP PERFORMANCE", hot: true, link: "https://33x.com", image: null },
                { name: "BB22", domain: "BB22.COM", type: "pagando", badge: "💵 PAGANDO AGORA", hot: true, link: "https://bb22.com", image: null },
                { name: "68D", domain: "68D.COM", type: "pagando", badge: "💸 PAGAMENTO RÁPIDO", hot: true, link: "https://68d.com", image: null }
            ];
            
            await Platform.insertMany(initialData);
            res.json({ success: true, message: `${initialData.length} plataformas inseridas` });
        } else {
            res.json({ success: true, message: 'Banco já possui dados', count });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Rota raiz
app.get('/', (req, res) => {
    res.json({
        name: 'Hub Plataformas API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            dbStatus: '/api/db-status',
            platforms: '/api/platforms',
            stats: '/api/stats',
            login: '/api/login',
            seed: '/api/seed (POST - protected)'
        }
    });
});

// Exportar para Vercel
module.exports = app;
