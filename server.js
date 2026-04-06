const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/database');
const platformRoutes = require('./src/routes/platformRoutes');
const errorMiddleware = require('./src/middleware/errorMiddleware');

// Carregar variáveis de ambiente
dotenv.config();

// Verificar se a URI do MongoDB está configurada
if (!process.env.MONGODB_URI) {
    console.error('❌ ERRO: MONGODB_URI não está definida no arquivo .env');
    process.exit(1);
}

// Conectar ao MongoDB Atlas
connectDB();

const app = express();

// Middlewares
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend
app.use(express.static('frontend'));

// Rotas da API
app.use('/api/platforms', platformRoutes);

// Rota de teste
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API funcionando!',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Rota para verificar status do banco
app.get('/api/db-status', (req, res) => {
    const mongoose = require('mongoose');
    const state = mongoose.connection.readyState;
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };
    res.json({
        status: states[state],
        message: state === 1 ? 'Banco de dados conectado' : 'Banco de dados desconectado'
    });
});

// Middleware de erro
app.use(errorMiddleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api`);
    console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📊 DB Status: http://localhost:${PORT}/api/db-status\n`);
});