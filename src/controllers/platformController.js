const Platform = require('../models/Platform');
const { validationResult } = require('express-validator');

// @desc    Obter todas as plataformas
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
        
        if (search && search.trim()) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { domain: { $regex: search, $options: 'i' } }
            ];
        }
        
        const platforms = await Platform.find(query).sort({ hot: -1, createdAt: -1 });
        res.json({ success: true, count: platforms.length, data: platforms });
    } catch (error) {
        console.error('Erro ao buscar plataformas:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar plataformas' });
    }
};

// @desc    Obter uma plataforma por ID
const getPlatformById = async (req, res) => {
    try {
        const platform = await Platform.findById(req.params.id);
        
        if (!platform) {
            return res.status(404).json({ success: false, message: 'Plataforma não encontrada' });
        }
        
        res.json({ success: true, data: platform });
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ success: false, message: 'ID inválido' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Criar nova plataforma
const createPlatform = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    try {
        const platform = await Platform.create(req.body);
        res.status(201).json({ success: true, data: platform });
    } catch (error) {
        console.error('Erro ao criar plataforma:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Atualizar plataforma
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
        console.error('Erro ao atualizar plataforma:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Excluir plataforma
const deletePlatform = async (req, res) => {
    try {
        const platform = await Platform.findById(req.params.id);
        
        if (!platform) {
            return res.status(404).json({ success: false, message: 'Plataforma não encontrada' });
        }
        
        await platform.deleteOne();
        res.json({ success: true, message: 'Plataforma excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir plataforma:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Login do admin
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
        console.error('Erro ao buscar estatísticas:', error);
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