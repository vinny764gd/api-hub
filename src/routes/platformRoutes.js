const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
    getPlatforms,
    getPlatformById,
    createPlatform,
    updatePlatform,
    deletePlatform,
    login,
    getStats
} = require('../controllers/platformController');
const { authenticate } = require('../middleware/authMiddleware');

// Rotas públicas
router.get('/', getPlatforms);
router.get('/stats', getStats);
router.get('/:id', getPlatformById);
router.post('/login', login);

// Rotas protegidas (requerem autenticação)
router.post('/',
    authenticate,
    [
        body('name').notEmpty().withMessage('Nome é obrigatório'),
        body('domain').notEmpty().withMessage('Domínio é obrigatório'),
        body('link').isURL().withMessage('Link inválido')
    ],
    createPlatform
);

router.put('/:id',
    authenticate,
    updatePlatform
);

router.delete('/:id',
    authenticate,
    deletePlatform
);

module.exports = router;
