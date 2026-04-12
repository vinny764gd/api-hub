const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();

// Configuração CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.options('*', cors());
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
    link: { type: String, required: true, trim: true },
    clicks: { type: Number, default: 0 },
    lastClickAt: { type: Date, default: null }
}, { timestamps: true });

// Índices
platformSchema.index({ name: 'text', domain: 'text' });
platformSchema.index({ type: 1 });
platformSchema.index({ hot: -1 });
platformSchema.index({ clicks: -1 });

const Platform = mongoose.models.Platform || mongoose.model('Platform', platformSchema);

// Modelo para estatísticas de atividade
const activitySchema = new mongoose.Schema({
    type: { type: String, enum: ['saque', 'nova_plataforma', 'topo_ranking', 'cadastro'], required: true },
    user: { type: String, required: true },
    platform: { type: String, default: null },
    amount: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now }
});

const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);

// Modelo para leads (WhatsApp)
const leadSchema = new mongoose.Schema({
    whatsapp: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);

// Variável de conexão
let isConnected = false;

// Função para conectar ao MongoDB
async function connectDB() {
    if (isConnected) return;
    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI não definida');
        return;
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
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API funcionando!', timestamp: new Date().toISOString() });
});

// Status do banco
app.get('/api/db-status', async (req, res) => {
    try {
        await connectDB();
        res.json({ success: true, status: isConnected ? 'connected' : 'disconnected' });
    } catch (error) {
        res.json({ success: false, status: 'disconnected', error: error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (validateCredentials(username, password)) {
        const token = generateToken(username);
        res.json({ success: true, token, message: 'Login realizado com sucesso' });
    } else {
        res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
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
        
        const platforms = await Platform.find(query).sort({ hot: -1, clicks: -1, createdAt: -1 });
        res.json({ success: true, count: platforms.length, data: platforms });
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Registrar clique em plataforma
app.post('/api/platforms/:id/click', async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.findById(req.params.id);
        if (!platform) {
            return res.status(404).json({ success: false, message: 'Plataforma não encontrada' });
        }
        
        platform.clicks = (platform.clicks || 0) + 1;
        platform.lastClickAt = new Date();
        await platform.save();
        
        res.json({ success: true, clicks: platform.clicks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Estatísticas completas
app.get('/api/stats', async (req, res) => {
    try {
        await connectDB();
        const total = await Platform.countDocuments();
        const pagando = await Platform.countDocuments({ type: 'pagando' });
        const lancamento = await Platform.countDocuments({ type: 'lancamento' });
        const destaque = await Platform.countDocuments({ type: 'destaque' });
        const hot = await Platform.countDocuments({ hot: true });
        
        // Calcular total de pagamentos simulados (baseado em cliques)
        const platforms = await Platform.find();
        const totalClicks = platforms.reduce((sum, p) => sum + (p.clicks || 0), 0);
        const estimatedPayments = totalClicks * 50; // Estimativa de R$50 por clique
        
        // Plataformas atualizadas hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const updatedToday = await Platform.countDocuments({ updatedAt: { $gte: today } });
        
        // Novas plataformas hoje
        const newToday = await Platform.countDocuments({ createdAt: { $gte: today } });
        
        res.json({
            success: true,
            data: { 
                total, pagando, lancamento, destaque, hot,
                totalClicks,
                estimatedPayments,
                updatedToday,
                newToday
            }
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Atividade em tempo real
app.get('/api/activity', async (req, res) => {
    try {
        await connectDB();
        const activities = await Activity.find().sort({ createdAt: -1 }).limit(10);
        
        // Se não houver atividades, gerar algumas simuladas
        if (activities.length === 0) {
            const mockActivities = [
                { type: 'saque', user: 'João S.', amount: 350, platform: 'EE44', createdAt: new Date() },
                { type: 'saque', user: 'Maria F.', amount: 780, platform: '8EEE', createdAt: new Date(Date.now() - 2 * 60000) },
                { type: 'topo_ranking', user: 'Rafael L.', platform: '33X', createdAt: new Date(Date.now() - 5 * 60000) },
                { type: 'nova_plataforma', user: 'Admin', platform: '988K.COM', createdAt: new Date(Date.now() - 15 * 60000) },
                { type: 'saque', user: 'Ana S.', amount: 1200, platform: 'BB22', createdAt: new Date(Date.now() - 12 * 60000) },
            ];
            
            const formatted = mockActivities.map(a => ({
                ...a,
                timeAgo: getTimeAgo(a.createdAt),
                message: formatActivityMessage(a)
            }));
            return res.json({ success: true, data: formatted });
        }
        
        const formatted = activities.map(a => ({
            ...a,
            timeAgo: getTimeAgo(a.createdAt),
            message: formatActivityMessage(a)
        }));
        
        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Ranking das plataformas
app.get('/api/ranking', async (req, res) => {
    try {
        await connectDB();
        const platforms = await Platform.find()
            .sort({ clicks: -1, hot: -1 })
            .limit(10);
        
        const ranking = platforms.map((p, index) => ({
            position: index + 1,
            id: p._id,
            name: p.name,
            domain: p.domain,
            type: p.type,
            hot: p.hot,
            clicks: p.clicks || 0,
            link: p.link
        }));
        
        res.json({ success: true, data: ranking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Criar lead (WhatsApp)
app.post('/api/leads', async (req, res) => {
    try {
        await connectDB();
        const { whatsapp } = req.body;
        
        if (!whatsapp || whatsapp.length < 10) {
            return res.status(400).json({ success: false, message: 'WhatsApp inválido' });
        }
        
        const existingLead = await Lead.findOne({ whatsapp });
        if (!existingLead) {
            await Lead.create({ whatsapp });
        }
        
        res.json({ success: true, message: 'Lead cadastrado com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Contar leads
app.get('/api/leads/count', async (req, res) => {
    try {
        await connectDB();
        const count = await Lead.countDocuments();
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Função auxiliar para formatar mensagem de atividade
function formatActivityMessage(activity) {
    switch (activity.type) {
        case 'saque':
            return `${activity.user} sacou R$ ${activity.amount},00 da plataforma ${activity.platform}`;
        case 'nova_plataforma':
            return `Nova plataforma adicionada: ${activity.platform}`;
        case 'topo_ranking':
            return `${activity.user} atingiu o topo do ranking semanal`;
        case 'cadastro':
            return `${activity.user} se cadastrou no Hub Premium`;
        default:
            return `${activity.user} realizou uma ação na plataforma`;
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'agora mesmo';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    const days = Math.floor(hours / 24);
    return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

// ============ ROTAS PROTEGIDAS (ADMIN) ============

// Criar plataforma
app.post('/api/platforms', authenticate, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.create(req.body);
        
        // Registrar atividade
        await Activity.create({
            type: 'nova_plataforma',
            user: 'Admin',
            platform: platform.name
        });
        
        res.status(201).json({ success: true, data: platform });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Atualizar plataforma
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

// Excluir plataforma
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

// Seed inicial
app.post('/api/seed', authenticate, async (req, res) => {
    try {
        await connectDB();
        const count = await Platform.countDocuments();
        
        if (count === 0) {
            const initialData = [
                { name: "EE44", domain: "EE44.COM", type: "pagando", badge: "💰 PAGANDO AGORA", hot: true, link: "https://ee44.com", image: null, clicks: 1523 },
                { name: "8EEE", domain: "8EEE.COM", type: "pagando", badge: "💵 PAGANDO INSTANTÂNEO", hot: true, link: "https://8eee.com", image: null, clicks: 892 },
                { name: "84D", domain: "84D.COM", type: "lancamento", badge: "🚀 NOVO LANÇAMENTO", hot: false, link: "https://84d.com", image: null, clicks: 234 },
                { name: "33X", domain: "33X.COM", type: "destaque", badge: "🏆 TOP PERFORMANCE", hot: true, link: "https://33x.com", image: null, clicks: 2100 },
                { name: "BB22", domain: "BB22.COM", type: "pagando", badge: "💵 PAGANDO AGORA", hot: true, link: "https://bb22.com", image: null, clicks: 3456 },
                { name: "68D", domain: "68D.COM", type: "pagando", badge: "💸 PAGAMENTO RÁPIDO", hot: true, link: "https://68d.com", image: null, clicks: 567 }
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

// Rota 404
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: 'Rota não encontrada' });
});

connectDB();
module.exports = app;