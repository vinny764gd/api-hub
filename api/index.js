const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

const app = express();

// Middlewares
app.use(cors({
    origin: ['*'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Importar modelos e controladores
const Platform = require('../src/models/Platform');
const { validateCredentials, generateToken } = require('../src/middleware/authMiddleware');

// Variável para controlar conexão do banco
let isConnected = false;

// Função para conectar ao MongoDB
const connectDB = async () => {
    if (isConnected) {
        console.log('✅ Usando conexão existente');
        return;
    }
    
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
        });
        
        isConnected = true;
        console.log(`✅ MongoDB Atlas Conectado: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Erro ao conectar: ${error.message}`);
        throw error;
    }
};

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await connectDB();
        res.json({ 
            status: 'ok', 
            message: 'API funcionando!',
            mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Rota para estatísticas
app.get('/api/platforms/stats', async (req, res) => {
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

// Rota para listar plataformas
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

// Rota para buscar uma plataforma
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

// Rota de login
app.post('/api/platforms/login', async (req, res) => {
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

// Middleware de autenticação
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acesso não autorizado' });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
};

// Rotas protegidas
app.post('/api/platforms', authenticate, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.create(req.body);
        res.status(201).json({ success: true, data: platform });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.put('/api/platforms/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.findById(req.params.id);
        
        if (!platform) {
            return res.status(404).json({ success: false, message: 'Plataforma não encontrada' });
        }
        
        const updatedPlatform = await Platform.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );
        
        res.json({ success: true, data: updatedPlatform });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

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

// Rota para dados iniciais (seed)
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
            res.json({ success: true, message: 'Banco já possui dados' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Rota padrão
app.get('*', (req, res) => {
    res.json({ message: 'API Hub Plataformas - Versão 1.0' });
});

// Exportar para Vercel
module.exports = app;
