const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], credentials: true }));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'hub_plataformas_secret_key_2024';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ========== MODELOS ==========
const platformSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, uppercase: true },
    domain: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, required: true, enum: ['pagando', 'lancamento', 'destaque'], default: 'pagando' },
    badge: { type: String, default: null },
    hot: { type: Boolean, default: false },
    image: { type: String, default: null },
    link: { type: String, required: true, trim: true },
    clicks: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const testimonialSchema = new mongoose.Schema({
    name: { type: String, required: true },
    text: { type: String, required: true },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const activitySchema = new mongoose.Schema({
    type: { type: String, enum: ['saque', 'nova_plataforma', 'topo_ranking', 'cadastro'], required: true },
    user: { type: String, required: true },
    platform: { type: String, default: null },
    amount: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now }
});

const leadSchema = new mongoose.Schema({
    whatsapp: { type: String, required: true },
    name: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

const settingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const Platform = mongoose.models.Platform || mongoose.model('Platform', platformSchema);
const Testimonial = mongoose.models.Testimonial || mongoose.model('Testimonial', testimonialSchema);
const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

let isConnected = false;

async function connectDB() {
    if (isConnected) return;
    if (!MONGODB_URI) {
        console.log('⚠️ MONGODB_URI não definida, usando dados mock');
        return;
    }
    try {
        await mongoose.connect(MONGODB_URI);
        isConnected = true;
        console.log('✅ MongoDB Atlas Conectado');
        await initializeDefaultSettings();
        await seedInitialData();
    } catch (error) {
        console.error('❌ Erro ao conectar MongoDB:', error.message);
    }
}

async function initializeDefaultSettings() {
    const defaults = [
        // Configurações do Site
        { key: 'site_title', value: 'Hub Premium' },
        { key: 'site_subtitle', value: 'Descubra plataformas que estão pagando agora' },
        { key: 'site_logo_text', value: 'HubPremium' },
        { key: 'site_footer_text', value: 'O maior hub de plataformas que pagam do Brasil.' },
        
        // Configurações do Hero
        { key: 'hero_title', value: 'Descubra plataformas que <span class="highlight">estão pagando agora</span>' },
        { key: 'hero_subtitle', value: 'Atualizado diariamente com as melhores oportunidades de ganhar dinheiro online. Mais de <strong>50.000 usuários</strong> já estão lucrando!' },
        { key: 'hero_badge_text', value: '+100 Plataformas Verificadas' },
        
        // Estatísticas (valores reais)
        { key: 'stats_total_users', value: 50234 },
        { key: 'stats_total_payments', value: 1250000 },
        { key: 'stats_daily_updates', value: 12 },
        { key: 'stats_payment_label', value: 'em pagamentos' },
        { key: 'stats_users_label', value: 'usuários ativos' },
        { key: 'stats_updates_label', value: 'atualizações hoje' },
        
        // Contato e Redes Sociais
        { key: 'contact_email', value: 'contato@hubpremium.com' },
        { key: 'contact_phone', value: '(11) 99999-9999' },
        { key: 'contact_whatsapp', value: '5511999999999' },
        { key: 'social_instagram', value: 'https://instagram.com/hubpremium' },
        { key: 'social_telegram', value: 'https://t.me/hubpremium' },
        { key: 'social_youtube', value: 'https://youtube.com/@hubpremium' },
        { key: 'social_tiktok', value: 'https://tiktok.com/@hubpremium' },
        
        // WhatsApp Group
        { key: 'whatsapp_group_link', value: 'https://chat.whatsapp.com/SEU_LINK' },
        { key: 'whatsapp_group_text', value: 'Grupo VIP' },
        
        // Outros
        { key: 'countdown_hours', value: 24 },
        { key: 'maintenance_mode', value: false },
        { key: 'footer_disclaimer', value: 'Não somos afiliados às plataformas. Apenas fornecemos informações.' }
    ];
    for (const setting of defaults) {
        await Setting.findOneAndUpdate({ key: setting.key }, setting, { upsert: true });
    }
}

async function seedInitialData() {
    const platformCount = await Platform.countDocuments();
    if (platformCount === 0) {
        await Platform.insertMany([
            { name: "EE44", domain: "EE44.COM", type: "pagando", badge: "💰 PAGANDO AGORA", hot: true, link: "https://ee44.com", clicks: 1523 },
            { name: "8EEE", domain: "8EEE.COM", type: "pagando", badge: "💵 PAGANDO INSTANTÂNEO", hot: true, link: "https://8eee.com", clicks: 892 },
            { name: "84D", domain: "84D.COM", type: "lancamento", badge: "🚀 NOVO LANÇAMENTO", hot: false, link: "https://84d.com", clicks: 234 },
            { name: "33X", domain: "33X.COM", type: "destaque", badge: "🏆 TOP PERFORMANCE", hot: true, link: "https://33x.com", clicks: 2100 },
            { name: "BB22", domain: "BB22.COM", type: "pagando", badge: "💵 PAGANDO AGORA", hot: true, link: "https://bb22.com", clicks: 3456 },
            { name: "68D", domain: "68D.COM", type: "pagando", badge: "💸 PAGAMENTO RÁPIDO", hot: true, link: "https://68d.com", clicks: 567 }
        ]);
    }
    
    const testimonialCount = await Testimonial.countDocuments();
    if (testimonialCount === 0) {
        await Testimonial.insertMany([
            { name: "Carlos Mendes", text: "Conheci o Hub Premium há 2 meses e já consegui mais de R$ 2.000 em pagamentos! As plataformas realmente pagam.", rating: 5, active: true },
            { name: "Ana Paula Silva", text: "Indico para todos que buscam uma renda extra. As atualizações diárias são muito úteis e as plataformas são confiáveis.", rating: 5, active: true },
            { name: "Rafael Oliveira", text: "Já testei várias plataformas e as que estão aqui realmente funcionam. O grupo VIP no WhatsApp é sensacional!", rating: 4, active: true }
        ]);
    }
    
    const activityCount = await Activity.countDocuments();
    if (activityCount === 0) {
        await Activity.insertMany([
            { type: "saque", user: "João S.", platform: "EE44", amount: 350, createdAt: new Date() },
            { type: "saque", user: "Maria F.", platform: "8EEE", amount: 780, createdAt: new Date(Date.now() - 120000) },
            { type: "topo_ranking", user: "Rafael L.", platform: "33X", createdAt: new Date(Date.now() - 300000) },
            { type: "nova_plataforma", user: "Admin", platform: "988K.COM", createdAt: new Date(Date.now() - 900000) }
        ]);
    }
}

function generateToken(username) {
    return jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Acesso não autorizado' });
    }
    try {
        jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Token inválido' });
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'agora mesmo';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    return `há ${Math.floor(hours / 24)} d`;
}

// ========== ROTAS PÚBLICAS ==========
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, token: generateToken(username) });
    } else {
        res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
});

// Configurações do site
app.get('/api/settings', async (req, res) => {
    try {
        await connectDB();
        const settings = await Setting.find();
        const obj = {};
        settings.forEach(s => obj[s.key] = s.value);
        
        const defaultSettings = {
            site_title: 'Hub Premium',
            site_subtitle: 'Descubra plataformas que estão pagando agora',
            site_logo_text: 'HubPremium',
            site_footer_text: 'O maior hub de plataformas que pagam do Brasil.',
            hero_title: 'Descubra plataformas que <span class="highlight">estão pagando agora</span>',
            hero_subtitle: 'Atualizado diariamente com as melhores oportunidades de ganhar dinheiro online. Mais de <strong>50.000 usuários</strong> já estão lucrando!',
            hero_badge_text: '+100 Plataformas Verificadas',
            stats_total_users: 50234,
            stats_total_payments: 1250000,
            stats_daily_updates: 12,
            stats_payment_label: 'em pagamentos',
            stats_users_label: 'usuários ativos',
            stats_updates_label: 'atualizações hoje',
            contact_email: 'contato@hubpremium.com',
            contact_phone: '(11) 99999-9999',
            contact_whatsapp: '5511999999999',
            social_instagram: 'https://instagram.com/hubpremium',
            social_telegram: 'https://t.me/hubpremium',
            social_youtube: 'https://youtube.com/@hubpremium',
            social_tiktok: 'https://tiktok.com/@hubpremium',
            whatsapp_group_link: 'https://chat.whatsapp.com/SEU_LINK',
            whatsapp_group_text: 'Grupo VIP',
            countdown_hours: 24,
            maintenance_mode: false,
            footer_disclaimer: 'Não somos afiliados às plataformas. Apenas fornecemos informações.'
        };
        
        const finalSettings = { ...defaultSettings, ...obj };
        res.json({ success: true, data: finalSettings });
    } catch (error) {
        res.json({ success: true, data: {
            site_title: 'Hub Premium',
            site_subtitle: 'Descubra plataformas que estão pagando agora',
            site_logo_text: 'HubPremium',
            site_footer_text: 'O maior hub de plataformas que pagam do Brasil.',
            hero_title: 'Descubra plataformas que <span class="highlight">estão pagando agora</span>',
            hero_subtitle: 'Atualizado diariamente com as melhores oportunidades de ganhar dinheiro online. Mais de <strong>50.000 usuários</strong> já estão lucrando!',
            hero_badge_text: '+100 Plataformas Verificadas',
            stats_total_users: 50234,
            stats_total_payments: 1250000,
            stats_daily_updates: 12,
            stats_payment_label: 'em pagamentos',
            stats_users_label: 'usuários ativos',
            stats_updates_label: 'atualizações hoje',
            contact_email: 'contato@hubpremium.com',
            contact_phone: '(11) 99999-9999',
            contact_whatsapp: '5511999999999',
            social_instagram: '#',
            social_telegram: '#',
            social_youtube: '#',
            social_tiktok: '#',
            whatsapp_group_link: 'https://chat.whatsapp.com/SEU_LINK',
            whatsapp_group_text: 'Grupo VIP',
            countdown_hours: 24,
            maintenance_mode: false,
            footer_disclaimer: 'Não somos afiliados às plataformas. Apenas fornecemos informações.'
        }});
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
        const platforms = await Platform.find(query).sort({ hot: -1, order: 1, clicks: -1 });
        res.json({ success: true, data: platforms });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// Ranking

app.get('/api/ranking', async (req, res) => {
    try {
        await connectDB();
        const platforms = await Platform.find().sort({ hot: -1, clicks: -1 }).limit(10);
        
        // Gerar acessos diários aleatórios entre 1000 e 10000
        const ranking = platforms.map((p, i) => ({
            position: i + 1,
            id: p._id,
            name: p.name,
            domain: p.domain,
            link: p.link,
            // Acessos diários aleatórios (não salvos no banco)
            dailyClicks: Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000
        }));
        
        res.json({ success: true, data: ranking });
    } catch (error) {
        // Dados mock para fallback
        const mockPlatforms = [
            { name: "EE44", domain: "EE44.COM", link: "https://ee44.com", dailyClicks: 8452 },
            { name: "33X", domain: "33X.COM", link: "https://33x.com", dailyClicks: 7231 },
            { name: "8EEE", domain: "8EEE.COM", link: "https://8eee.com", dailyClicks: 5678 },
            { name: "BB22", domain: "BB22.COM", link: "https://bb22.com", dailyClicks: 4321 },
            { name: "68D", domain: "68D.COM", link: "https://68d.com", dailyClicks: 3210 }
        ];
        const ranking = mockPlatforms.map((p, i) => ({ ...p, position: i + 1 }));
        res.json({ success: true, data: ranking });
    }
});

// Depoimentos (ativos)
app.get('/api/testimonials', async (req, res) => {
    try {
        await connectDB();
        const testimonials = await Testimonial.find({ active: true }).sort({ order: 1, createdAt: -1 });
        res.json({ success: true, data: testimonials });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// Atividades em tempo real
app.get('/api/activity', async (req, res) => {
    try {
        await connectDB();
        const activities = await Activity.find().sort({ createdAt: -1 }).limit(10);
        const formatted = activities.map(a => ({
            ...a._doc,
            timeAgo: getTimeAgo(a.createdAt),
            message: a.type === 'saque' ? `${a.user} sacou R$ ${a.amount},00 da plataforma ${a.platform}` :
                     a.type === 'nova_plataforma' ? `Nova plataforma adicionada: ${a.platform}` :
                     a.type === 'topo_ranking' ? `${a.user} atingiu o topo do ranking` :
                     `${a.user} se cadastrou no Hub Premium`
        }));
        res.json({ success: true, data: formatted });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// Estatísticas
app.get('/api/stats', async (req, res) => {
    try {
        await connectDB();
        const [total, pagando, lancamento, destaque, hot, settings, totalClicksResult] = await Promise.all([
            Platform.countDocuments(),
            Platform.countDocuments({ type: 'pagando' }),
            Platform.countDocuments({ type: 'lancamento' }),
            Platform.countDocuments({ type: 'destaque' }),
            Platform.countDocuments({ hot: true }),
            Setting.find(),
            Platform.aggregate([{ $group: { _id: null, total: { $sum: '$clicks' } } }])
        ]);
        
        const totalClicks = totalClicksResult[0]?.total || 0;
        const settingsObj = {};
        settings.forEach(s => settingsObj[s.key] = s.value);
        
        // Calcular pagamentos estimados baseado nos cliques (cada clique = R$50 em média)
        const estimatedPayments = totalClicks * 50;
        
        res.json({
            success: true,
            data: {
                total, pagando, lancamento, destaque, hot, totalClicks,
                estimatedPayments: estimatedPayments,
                updatedToday: await Platform.countDocuments({ updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
                newToday: await Platform.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
                stats_total_users: settingsObj.stats_total_users || 50234,
                stats_total_payments: settingsObj.stats_total_payments || 1250000,
                stats_daily_updates: settingsObj.stats_daily_updates || 12
            }
        });
    } catch (error) {
        res.json({ success: true, data: {
            total: 0, pagando: 0, lancamento: 0, destaque: 0, hot: 0, totalClicks: 0,
            estimatedPayments: 1250000, updatedToday: 0, newToday: 0,
            stats_total_users: 50234, stats_total_payments: 1250000, stats_daily_updates: 12
        }});
    }
});

// Leads (cadastro WhatsApp)
app.post('/api/leads', async (req, res) => {
    try {
        await connectDB();
        const { whatsapp, name } = req.body;
        if (!whatsapp || whatsapp.length < 10) return res.status(400).json({ success: false });
        await Lead.findOneAndUpdate({ whatsapp }, { whatsapp, name }, { upsert: true });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: true });
    }
});

// ========== ROTAS ADMIN (PROTEGIDAS) ==========

// Configurações (admin)
app.put('/api/settings', authenticate, async (req, res) => {
    try {
        await connectDB();
        for (const [key, value] of Object.entries(req.body)) {
            await Setting.findOneAndUpdate({ key }, { key, value, updatedAt: new Date() }, { upsert: true });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Plataformas CRUD
app.post('/api/platforms', authenticate, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.create(req.body);
        await Activity.create({ type: 'nova_plataforma', user: 'Admin', platform: platform.name });
        res.json({ success: true, data: platform });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.put('/api/platforms/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: platform });
    } catch (error) {
        res.status(400).json({ success: false });
    }
});

app.delete('/api/platforms/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        await Platform.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Depoimentos CRUD (admin)
app.get('/api/admin/testimonials', authenticate, async (req, res) => {
    try {
        await connectDB();
        const testimonials = await Testimonial.find().sort({ createdAt: -1 });
        res.json({ success: true, data: testimonials });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/testimonials', authenticate, async (req, res) => {
    try {
        await connectDB();
        const testimonial = await Testimonial.create(req.body);
        res.json({ success: true, data: testimonial });
    } catch (error) {
        res.status(400).json({ success: false });
    }
});

app.put('/api/admin/testimonials/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: testimonial });
    } catch (error) {
        res.status(400).json({ success: false });
    }
});

app.delete('/api/admin/testimonials/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        await Testimonial.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Atividades CRUD (admin)
app.get('/api/admin/activities', authenticate, async (req, res) => {
    try {
        await connectDB();
        const activities = await Activity.find().sort({ createdAt: -1 });
        res.json({ success: true, data: activities });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/activities', authenticate, async (req, res) => {
    try {
        await connectDB();
        const activity = await Activity.create(req.body);
        res.json({ success: true, data: activity });
    } catch (error) {
        res.status(400).json({ success: false });
    }
});

app.put('/api/admin/activities/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        const activity = await Activity.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: activity });
    } catch (error) {
        res.status(400).json({ success: false });
    }
});

app.delete('/api/admin/activities/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        await Activity.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Leads CRUD (admin)
app.get('/api/admin/leads', authenticate, async (req, res) => {
    try {
        await connectDB();
        const leads = await Lead.find().sort({ createdAt: -1 });
        res.json({ success: true, data: leads });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/admin/leads/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        await Lead.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Rota 404 para rotas não encontradas
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: 'Rota não encontrada' });
});

connectDB();
module.exports = app;