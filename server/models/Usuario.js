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
  },
  // cadastro do admin:
  cpf: { type: String, trim: true },
  telefone: { type: String, trim: true },
  endereco: { type: String, trim: true },
  especialidade: { type: String, trim: true }
});

module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
