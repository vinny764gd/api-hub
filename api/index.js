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

// Modelos
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

const activitySchema = new mongoose.Schema({
    type: { type: String, enum: ['saque', 'nova_plataforma', 'topo_ranking', 'cadastro'], required: true },
    user: { type: String, required: true },
    platform: { type: String, default: null },
    amount: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now }
});

const testimonialSchema = new mongoose.Schema({
    name: { type: String, required: true },
    avatar: { type: String, default: null },
    text: { type: String, required: true },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
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
const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
const Testimonial = mongoose.models.Testimonial || mongoose.model('Testimonial', testimonialSchema);
const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

let isConnected = false;

async function connectDB() {
    if (isConnected) return;
    if (!MONGODB_URI) return;
    try {
        await mongoose.connect(MONGODB_URI);
        isConnected = true;
        console.log('✅ MongoDB Atlas Conectado');
        await initializeDefaultSettings();
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

async function initializeDefaultSettings() {
    const defaults = [
        { key: 'site_title', value: 'Hub Premium' },
        { key: 'site_subtitle', value: 'Descubra plataformas que estão pagando agora' },
        { key: 'hero_title', value: 'Descubra plataformas que <span class="highlight">estão pagando agora</span>' },
        { key: 'hero_subtitle', value: 'Atualizado diariamente com as melhores oportunidades de ganhar dinheiro online.' },
        { key: 'stats_total_users', value: 50234 },
        { key: 'stats_total_payments', value: 1250000 },
        { key: 'stats_daily_updates', value: 12 },
        { key: 'whatsapp_group_link', value: 'https://chat.whatsapp.com/SEU_LINK' },
        { key: 'countdown_hours', value: 24 }
    ];
    for (const setting of defaults) {
        await Setting.findOneAndUpdate({ key: setting.key }, setting, { upsert: true });
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

// Rotas Públicas
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, token: generateToken(username) });
    } else {
        res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
});

app.get('/api/settings/public', async (req, res) => {
    try {
        await connectDB();
        const settings = await Setting.find();
        const obj = {};
        settings.forEach(s => obj[s.key] = s.value);
        res.json({ success: true, data: obj });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/platforms', async (req, res) => {
    try {
        await connectDB();
        const { type, search } = req.query;
        let query = {};
        if (type && type !== 'all') {
            query = type === 'destaque' ? { $or: [{ type: 'destaque' }, { hot: true }] } : { type };
        }
        if (search?.trim()) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { domain: { $regex: search, $options: 'i' } }
            ];
        }
        const platforms = await Platform.find(query).sort({ hot: -1, order: 1, clicks: -1 });
        res.json({ success: true, count: platforms.length, data: platforms });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/platforms/:id/click', async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.findById(req.params.id);
        if (!platform) return res.status(404).json({ success: false });
        platform.clicks = (platform.clicks || 0) + 1;
        await platform.save();
        res.json({ success: true, clicks: platform.clicks });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        await connectDB();
        const [total, pagando, lancamento, destaque, hot, settings] = await Promise.all([
            Platform.countDocuments(),
            Platform.countDocuments({ type: 'pagando' }),
            Platform.countDocuments({ type: 'lancamento' }),
            Platform.countDocuments({ type: 'destaque' }),
            Platform.countDocuments({ hot: true }),
            Setting.find()
        ]);
        const totalClicks = (await Platform.aggregate([{ $group: { _id: null, total: { $sum: '$clicks' } } }]))[0]?.total || 0;
        const settingsObj = {};
        settings.forEach(s => settingsObj[s.key] = s.value);
        res.json({
            success: true,
            data: {
                total, pagando, lancamento, destaque, hot,
                totalClicks,
                estimatedPayments: totalClicks * 50,
                updatedToday: await Platform.countDocuments({ updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
                newToday: await Platform.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
                stats_total_users: settingsObj.stats_total_users || 50234,
                stats_total_payments: settingsObj.stats_total_payments || 1250000,
                stats_daily_updates: settingsObj.stats_daily_updates || 12
            }
        });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/ranking', async (req, res) => {
    try {
        await connectDB();
        const platforms = await Platform.find().sort({ clicks: -1, hot: -1 }).limit(10);
        const ranking = platforms.map((p, i) => ({
            position: i + 1, id: p._id, name: p.name, domain: p.domain, type: p.type, hot: p.hot, clicks: p.clicks || 0, link: p.link
        }));
        res.json({ success: true, data: ranking });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/activity', async (req, res) => {
    try {
        await connectDB();
        let activities = await Activity.find().sort({ createdAt: -1 }).limit(10);
        if (activities.length === 0) {
            activities = [
                { type: 'saque', user: 'João S.', amount: 350, platform: 'EE44', createdAt: new Date() },
                { type: 'saque', user: 'Maria F.', amount: 780, platform: '8EEE', createdAt: new Date(Date.now() - 120000) },
                { type: 'topo_ranking', user: 'Rafael L.', platform: '33X', createdAt: new Date(Date.now() - 300000) }
            ];
        }
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
        res.status(500).json({ success: false });
    }
});

app.get('/api/testimonials', async (req, res) => {
    try {
        await connectDB();
        const testimonials = await Testimonial.find({ active: true }).sort({ order: 1, createdAt: -1 }).limit(6);
        res.json({ success: true, data: testimonials });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/leads', async (req, res) => {
    try {
        await connectDB();
        const { whatsapp, name } = req.body;
        if (!whatsapp || whatsapp.length < 10) return res.status(400).json({ success: false });
        await Lead.findOneAndUpdate({ whatsapp }, { whatsapp, name }, { upsert: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Rotas Admin
app.get('/api/admin/stats/full', authenticate, async (req, res) => {
    try {
        await connectDB();
        const [platforms, activities, leads, testimonials] = await Promise.all([
            Platform.countDocuments(),
            Activity.countDocuments(),
            Lead.countDocuments(),
            Testimonial.countDocuments()
        ]);
        res.json({ success: true, data: { platforms, activities, leads, testimonials } });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/admin/settings', authenticate, async (req, res) => {
    try {
        await connectDB();
        const settings = await Setting.find();
        const obj = {};
        settings.forEach(s => obj[s.key] = s.value);
        res.json({ success: true, data: obj });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/admin/settings', authenticate, async (req, res) => {
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

app.get('/api/admin/platforms', authenticate, async (req, res) => {
    await connectDB();
    const platforms = await Platform.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data: platforms });
});

app.post('/api/admin/platforms', authenticate, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.create(req.body);
        await Activity.create({ type: 'nova_plataforma', user: 'Admin', platform: platform.name });
        res.json({ success: true, data: platform });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/platforms/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: platform });
    } catch (error) {
        res.status(400).json({ success: false });
    }
});

app.delete('/api/admin/platforms/:id', authenticate, async (req, res) => {
    try {
        await connectDB();
        await Platform.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/admin/testimonials', authenticate, async (req, res) => {
    await connectDB();
    const testimonials = await Testimonial.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data: testimonials });
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

app.post('/api/admin/activities', authenticate, async (req, res) => {
    try {
        await connectDB();
        const activity = await Activity.create(req.body);
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

app.get('/api/admin/leads', authenticate, async (req, res) => {
    await connectDB();
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json({ success: true, data: leads, count: leads.length });
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

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'agora mesmo';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    return `há ${Math.floor(hours / 24)} d`;
}

connectDB();
module.exports = app;