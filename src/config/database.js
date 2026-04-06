const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Timeout após 5 segundos
            socketTimeoutMS: 45000, // Fechar sockets após 45 segundos de inatividade
        });
        
        console.log(`✅ MongoDB Atlas Conectado com sucesso!`);
        console.log(`📊 Database: ${conn.connection.name}`);
        console.log(`🔗 Host: ${conn.connection.host}`);
        
        // Eventos de conexão
        mongoose.connection.on('error', (err) => {
            console.error(`❌ Erro no MongoDB: ${err.message}`);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB desconectado. Tentando reconectar...');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconectado com sucesso!');
        });
        
    } catch (error) {
        console.error(`❌ Erro ao conectar ao MongoDB Atlas: ${error.message}`);
        console.error('Verifique sua senha e se o IP está liberado no MongoDB Atlas');
        process.exit(1);
    }
};

module.exports = connectDB;