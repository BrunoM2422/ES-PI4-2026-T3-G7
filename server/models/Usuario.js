// Autores:
// Gabriel Scolfaro de Azeredo - 25006194
const mongoose = require('mongoose');

// Define a estrutura dos usuários, incluindo dados pessoais e permissões.
const usuarioSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  senha: { type: String, required: true },
  papeis: { type: [String], enum: ['estudante', 'docente', 'admin'], required: true },
  nome: { type: String, required: true },
  telefone: { type: String, trim: true },
  nivelPermissao: {
    type: String,
    enum: ['admin_mestre', 'admin_2', 'admin_3'],
    default: 'admin_mestre'
  },
  cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', default: null },

  // Armazena informações utilizadas no processo de recuperação de senha.
  passwordResetCodeHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  passwordResetAttempts: { type: Number, default: 0, select: false },
  passwordResetRequestedAt: { type: Date, select: false },
  showFinanceiro: { type: Boolean, default: true },
  ra: { type: String },
  rp: { type: String }
});

// Exporta o modelo Usuario para utilização no sistema.
module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
