const mongoose = require('mongoose');

const platformSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Nome é obrigatório'],
        trim: true,
        uppercase: true
    },
    domain: {
        type: String,
        required: [true, 'Domínio é obrigatório'],
        trim: true,
        uppercase: true
    },
    type: {
        type: String,
        required: [true, 'Tipo é obrigatório'],
        enum: ['pagando', 'lancamento', 'destaque'],
        default: 'pagando'
    },
    badge: {
        type: String,
        default: null
    },
    hot: {
        type: Boolean,
        default: false
    },
    image: {
        type: String,
        default: null
    },
    link: {
        type: String,
        required: [true, 'Link é obrigatório'],
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Índices para busca
platformSchema.index({ name: 'text', domain: 'text' });

module.exports = mongoose.model('Platform', platformSchema);
