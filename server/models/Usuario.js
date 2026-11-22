// Autores: Luca Filippi — RA: 25022556
// Gabriel Scolfaro de Azeredo - 25006194
const mongoose = require('mongoose');

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
  passwordResetCodeHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  passwordResetAttempts: { type: Number, default: 0, select: false },
  passwordResetRequestedAt: { type: Date, select: false },
  showFinanceiro: { type: Boolean, default: true },
  ra: { type: String },
  rp: { type: String }
});

module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
