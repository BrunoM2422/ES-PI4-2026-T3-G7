const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  senha: {
    type: String,
    required: true
  },
  papeis: {
    type: [String],
    enum: ['estudante', 'docente', 'admin'],
    required: true
  },
  nome: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
