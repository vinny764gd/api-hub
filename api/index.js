const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
    dailyClicks: { type: Number, default: 0 },
    lastDailyReset: { type: Date, default: Date.now },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Modelo de Usuário
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    banned: { type: Boolean, default: false },
    avatar: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now }
});

// Modelo de Depoimento
const testimonialSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    platformName: { type: String, required: true },
    platformId: { type: mongoose.Schema.Types.ObjectId, ref: 'Platform' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true },
    text: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    helpful: { type: Number, default: 0 },
    notHelpful: { type: Number, default: 0 },
    reported: { type: Boolean, default: false },
    reportReason: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const activitySchema = new mongoose.Schema({
    type: { type: String, enum: ['saque', 'nova_plataforma', 'topo_ranking', 'cadastro', 'novo_depoimento', 'banimento'], required: true },
    user: { type: String, required: true },
    platform: { type: String, default: null },
    amount: { type: Number, default: null },
    details: { type: String, default: null },
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
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Testimonial = mongoose.models.Testimonial || mongoose.model('Testimonial', testimonialSchema);
const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

let isConnected = false;

async function connectDB() {
    if (isConnected) return;
    if (!MONGODB_URI) {
        console.log('⚠️ MONGODB_URI não definida');
        return;
    }
    try {
        await mongoose.connect(MONGODB_URI);
        isConnected = true;
        console.log('✅ MongoDB Atlas Conectado');
        await ensureSettingsExist();
        await createAdminUser();
    } catch (error) {
        console.error('❌ Erro ao conectar MongoDB:', error.message);
    }
}

async function createAdminUser() {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await User.create({
            name: 'Administrador',
            email: ADMIN_USERNAME,
            password: hashedPassword,
            role: 'admin'
        });
        console.log('✅ Usuário admin criado');
    }
}

async function ensureSettingsExist() {
    const defaults = [
        { key: 'site_title', value: 'Hub Premium' },
        { key: 'site_subtitle', value: 'Descubra plataformas que estão pagando agora' },
        { key: 'site_logo_text', value: 'HubPremium' },
        key: 'site_footer_text', value: 'O maior hub de plataformas que pagam do Brasil.' },
        { key: 'hero_title', value: 'Descubra plataformas que <span class="highlight">estão pagando agora</span>' },
        { key: 'hero_subtitle', value: 'Atualizado diariamente com as melhores oportunidades de ganhar dinheiro online. Mais de <strong>50.000 usuários</strong> já estão lucrando!' },
        { key: 'hero_badge_text', value: '+100 Plataformas Verificadas' },
        { key: 'stats_total_users', value: 50234 },
        { key: 'stats_total_payments', value: 1250000 },
        { key: 'stats_daily_updates', value: 12 },
        { key: 'stats_payment_label', value: 'em pagamentos' },
        { key: 'stats_users_label', value: 'usuários ativos' },
        { key: 'stats_updates_label', value: 'atualizações hoje' },
        { key: 'contact_email', value: 'contato@hubpremium.com' },
        { key: 'contact_phone', value: '(11) 99999-9999' },
        { key: 'contact_whatsapp', value: '5511999999999' },
        { key: 'social_instagram', value: '#' },
        { key: 'social_telegram', value: '#' },
        { key: 'social_youtube', value: '#' },
        { key: 'social_tiktok', value: '#' },
        { key: 'whatsapp_group_link', value: 'https://chat.whatsapp.com/SEU_LINK' },
        { key: 'whatsapp_group_text', value: 'Grupo VIP' },
        { key: 'countdown_hours', value: 24 },
        { key: 'footer_disclaimer', value: 'Não somos afiliados às plataformas. Apenas fornecemos informações.' }
    ];
    
    for (const setting of defaults) {
        const existing = await Setting.findOne({ key: setting.key });
        if (!existing) {
            await Setting.create(setting);
            console.log(`✅ Configuração criada: ${setting.key}`);
        }
    }
    console.log('✅ Verificação de configurações concluída');
}

// ========== FUNÇÕES DE AUTENTICAÇÃO ==========
function generateToken(userId, email, role) {
    return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '7d' });
}

async function authenticateUser(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Acesso não autorizado' });
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user || user.banned) {
            return res.status(401).json({ success: false, message: 'Usuário não encontrado ou banido' });
        }
        req.user = user;
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Token inválido' });
    }
}

async function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Acesso não autorizado' });
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado. Área administrativa.' });
        }
        req.user = user;
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Token inválido' });
    }
}

// ========== ROTAS PÚBLICAS ==========
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Registro de usuário
app.post('/api/register', async (req, res) => {
    try {
        await connectDB();
        const { name, email, password } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'E-mail já cadastrado' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword
        });
        
        const token = generateToken(user._id, user.email, user.role);
        
        await Activity.create({
            type: 'cadastro',
            user: user.name,
            details: `Novo usuário cadastrado: ${user.email}`
        });
        
        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Login de usuário
app.post('/api/login', async (req, res) => {
    try {
        await connectDB();
        const { email, password } = req.body;
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }
        
        if (user.banned) {
            return res.status(401).json({ success: false, message: 'Usuário banido. Contate o administrador.' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = generateToken(user._id, user.email, user.role);
        
        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Verificar token (manter sessão)
app.get('/api/verify', authenticateUser, async (req, res) => {
    res.json({
        success: true,
        user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role }
    });
});

// Listar depoimentos aprovados para o site
app.get('/api/testimonials', async (req, res) => {
    try {
        await connectDB();
        const testimonials = await Testimonial.find({ status: 'approved' }).sort({ helpful: -1, createdAt: -1 }).limit(20);
        res.json({ success: true, data: testimonials });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/platforms/:id/click', async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.findById(req.params.id);
        if (!platform) {
            return res.status(404).json({ success: false, message: 'Plataforma não encontrada' });
        }
        platform.clicks = (platform.clicks || 0) + 1;
        await platform.save();
        res.json({ success: true, clicks: platform.clicks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/ranking', async (req, res) => {
    try {
        await connectDB();
        const platforms = await Platform.find().sort({ dailyClicks: -1, hot: -1 }).limit(10);
        const ranking = platforms.map((p, i) => ({
            position: i + 1,
            id: p._id,
            name: p.name,
            domain: p.domain,
            link: p.link,
            dailyClicks: p.dailyClicks || 5000
        }));
        res.json({ success: true, data: ranking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

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
                     a.type === 'novo_depoimento' ? `Novo depoimento de ${a.user} sobre ${a.platform}` :
                     `${a.user} se cadastrou no Hub Premium`
        }));
        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        await connectDB();
        const [total, pagando, lancamento, destaque, hot, settings, totalClicksResult, totalUsers, totalTestimonials] = await Promise.all([
            Platform.countDocuments(),
            Platform.countDocuments({ type: 'pagando' }),
            Platform.countDocuments({ type: 'lancamento' }),
            Platform.countDocuments({ type: 'destaque' }),
            Platform.countDocuments({ hot: true }),
            Setting.find(),
            Platform.aggregate([{ $group: { _id: null, total: { $sum: '$clicks' } } }]),
            User.countDocuments(),
            Testimonial.countDocuments()
        ]);
        
        const totalClicks = totalClicksResult[0]?.total || 0;
        const settingsObj = {};
        settings.forEach(s => settingsObj[s.key] = s.value);
        
        res.json({
            success: true,
            data: {
                total, pagando, lancamento, destaque, hot, totalClicks,
                estimatedPayments: totalClicks * 50,
                updatedToday: await Platform.countDocuments({ updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
                newToday: await Platform.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
                stats_total_users: totalUsers || settingsObj.stats_total_users || 50234,
                stats_total_payments: settingsObj.stats_total_payments || 1250000,
                stats_daily_updates: settingsObj.stats_daily_updates || 12,
                totalTestimonials
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
        res.status(500).json({ success: false, message: error.message });
    }
});

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
            social_instagram: '#',
            social_telegram: '#',
            social_youtube: '#',
            social_tiktok: '#',
            whatsapp_group_link: 'https://chat.whatsapp.com/SEU_LINK',
            whatsapp_group_text: 'Grupo VIP',
            countdown_hours: 24,
            footer_disclaimer: 'Não somos afiliados às plataformas. Apenas fornecemos informações.'
        };
        
        const finalSettings = { ...defaultSettings, ...obj };
        res.json({ success: true, data: finalSettings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== ROTAS DE USUÁRIO AUTENTICADO ==========

// Obter perfil do usuário
app.get('/api/user/profile', authenticateUser, async (req, res) => {
    res.json({ success: true, user: req.user });
});

// Atualizar perfil
app.put('/api/user/profile', authenticateUser, async (req, res) => {
    try {
        const { name, avatar } = req.body;
        if (name) req.user.name = name;
        if (avatar) req.user.avatar = avatar;
        await req.user.save();
        res.json({ success: true, user: req.user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Criar depoimento
app.post('/api/testimonials', authenticateUser, async (req, res) => {
    try {
        await connectDB();
        const { platformName, platformId, rating, title, text } = req.body;
        
        if (req.user.banned) {
            return res.status(403).json({ success: false, message: 'Usuário banido não pode postar depoimentos' });
        }
        
        const testimonial = await Testimonial.create({
            userId: req.user._id,
            userName: req.user.name,
            platformName,
            platformId: platformId || null,
            rating,
            title,
            text,
            status: 'pending'
        });
        
        await Activity.create({
            type: 'novo_depoimento',
            user: req.user.name,
            platform: platformName,
            details: `Novo depoimento aguardando aprovação`
        });
        
        res.json({ success: true, data: testimonial });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Listar meus depoimentos
app.get('/api/user/testimonials', authenticateUser, async (req, res) => {
    try {
        const testimonials = await Testimonial.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, data: testimonials });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Avaliar se um depoimento foi útil
app.post('/api/testimonials/:id/helpful', authenticateUser, async (req, res) => {
    try {
        const testimonial = await Testimonial.findById(req.params.id);
        if (!testimonial) {
            return res.status(404).json({ success: false, message: 'Depoimento não encontrado' });
        }
        testimonial.helpful = (testimonial.helpful || 0) + 1;
        await testimonial.save();
        res.json({ success: true, helpful: testimonial.helpful });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Reportar depoimento
app.post('/api/testimonials/:id/report', authenticateUser, async (req, res) => {
    try {
        const { reason } = req.body;
        const testimonial = await Testimonial.findById(req.params.id);
        if (!testimonial) {
            return res.status(404).json({ success: false, message: 'Depoimento não encontrado' });
        }
        testimonial.reported = true;
        testimonial.reportReason = reason;
        await testimonial.save();
        
        await Activity.create({
            type: 'reporte',
            user: req.user.name,
            platform: testimonial.platformName,
            details: `Depoimento reportado: ${reason}`
        });
        
        res.json({ success: true, message: 'Depoimento reportado com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== ROTAS ADMIN (PROTEGIDAS) ==========

// Configurações
app.put('/api/settings', authenticateAdmin, async (req, res) => {
    try {
        await connectDB();
        for (const [key, value] of Object.entries(req.body)) {
            await Setting.findOneAndUpdate({ key }, { key, value, updatedAt: new Date() }, { upsert: true });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// CRUD Plataformas
app.post('/api/platforms', authenticateAdmin, async (req, res) => {
    try {
        await connectDB();
        const dailyClicks = Math.floor(Math.random() * (50000 - 5000 + 1)) + 5000;
        const platform = await Platform.create({ ...req.body, dailyClicks });
        await Activity.create({ type: 'nova_plataforma', user: 'Admin', platform: platform.name });
        res.json({ success: true, data: platform });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.put('/api/platforms/:id', authenticateAdmin, async (req, res) => {
    try {
        await connectDB();
        const platform = await Platform.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: platform });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.delete('/api/platforms/:id', authenticateAdmin, async (req, res) => {
    try {
        await connectDB();
        await Platform.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// CRUD Depoimentos (Admin)
app.get('/api/admin/testimonials', authenticateAdmin, async (req, res) => {
    try {
        await connectDB();
        const testimonials = await Testimonial.find().sort({ createdAt: -1 });
        res.json({ success: true, data: testimonials });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/testimonials/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const testimonial = await Testimonial.findByIdAndUpdate(
            req.params.id,
            { status, updatedAt: new Date() },
            { new: true }
        );
        res.json({ success: true, data: testimonial });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/testimonials/:id', authenticateAdmin, async (req, res) => {
    try {
        await Testimonial.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// CRUD Usuários (Admin)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        await connectDB();
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/users/:id/ban', authenticateAdmin, async (req, res) => {
    try {
        const { banned } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { banned },
            { new: true }
        ).select('-password');
        
        await Activity.create({
            type: 'banimento',
            user: user.name,
            details: `Usuário ${banned ? 'banido' : 'desbanido'} pelo administrador`
        });
        
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/users/:id/role', authenticateAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password');
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        await Testimonial.deleteMany({ userId: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Atividades (Admin)
app.get('/api/admin/activities', authenticateAdmin, async (req, res) => {
    try {
        const activities = await Activity.find().sort({ createdAt: -1 }).limit(50);
        res.json({ success: true, data: activities });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/activities', authenticateAdmin, async (req, res) => {
    try {
        const activity = await Activity.create(req.body);
        res.json({ success: true, data: activity });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/activities/:id', authenticateAdmin, async (req, res) => {
    try {
        await Activity.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Leads (Admin)
app.get('/api/admin/leads', authenticateAdmin, async (req, res) => {
    try {
        const leads = await Lead.find().sort({ createdAt: -1 });
        res.json({ success: true, data: leads });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/leads/:id', authenticateAdmin, async (req, res) => {
    try {
        await Lead.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Estatísticas admin
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const [totalUsers, totalTestimonials, pendingTestimonials, totalPlatforms, totalLeads] = await Promise.all([
            User.countDocuments(),
            Testimonial.countDocuments(),
            Testimonial.countDocuments({ status: 'pending' }),
            Platform.countDocuments(),
            Lead.countDocuments()
        ]);
        
        res.json({
            success: true,
            data: { totalUsers, totalTestimonials, pendingTestimonials, totalPlatforms, totalLeads }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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