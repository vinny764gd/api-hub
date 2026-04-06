const Platform = require('../models/Platform');
const { validationResult } = require('express-validator');

// @desc    Obter todas as plataformas
// @route   GET /api/platforms
// @access  Public
const getPlatforms = async (req, res) => {
    try {
        const { type, search } = req.query;
        let query = {};
        
        if (type && type !== 'all') {
            if (type === 'destaque') {
                query = { $or: [{ type: 'destaque' }, { hot: true }] };
            } else {
                query.type = type;
            }
        }
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { domain: { $regex: search, $options: 'i' } }
            ];
        }
        
        const platforms = await Platform.find(query).sort({ hot: -1, createdAt: -1 });
        res.json({ success: true, count: platforms.length, data: platforms });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Obter uma plataforma por ID
// @route   GET /api/platforms/:id
// @access  Public
const getPlatformById = async (req, res) => {
    try {
        const platform = await Platform.findById(req.params.id);
        
        if (!platform) {
            return res.status(404).json({ success: false, message: 'Plataforma não encontrada' });
        }
        
        res.json({ success: true, data: platform });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Criar nova plataforma
// @route   POST /api/platforms
// @access  Private (Admin)
const createPlatform = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    try {
        const platform = await Platform.create(req.body);
        res.status(201).json({ success: true, data: platform });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Atualizar plataforma
// @route   PUT /api/platforms/:id
// @access  Private (Admin)
const updatePlatform = async (req, res) => {
    try {
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
};

// @desc    Excluir plataforma
// @route   DELETE /api/platforms/:id
// @access  Private (Admin)
const deletePlatform = async (req, res) => {
    try {
        const platform = await Platform.findById(req.params.id);
        
        if (!platform) {
            return res.status(404).json({ success: false, message: 'Plataforma não encontrada' });
        }
        
        await platform.deleteOne();
        res.json({ success: true, message: 'Plataforma excluída com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Login do admin
// @route   POST /api/platforms/login
// @access  Public
const login = async (req, res) => {
    const { username, password } = req.body;
    const { validateCredentials, generateToken } = require('../middleware/authMiddleware');
    
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
};

// @desc    Obter estatísticas
// @route   GET /api/platforms/stats
// @access  Public
const getStats = async (req, res) => {
    try {
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
};

module.exports = {
    getPlatforms,
    getPlatformById,
    createPlatform,
    updatePlatform,
    deletePlatform,
    login,
    getStats
};
