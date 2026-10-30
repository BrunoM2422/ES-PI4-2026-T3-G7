const mongoose = require('mongoose');

const opcoesSistemaSchema = new mongoose.Schema({
  _id: { type: String, default: 'opcoes-academicas' },
  matricula: { type: Boolean, default: false },
  avaliacao: { type: Boolean, default: false },
  grade: { type: Boolean, default: false },
  gradeCurricular: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('OpcoesSistema', opcoesSistemaSchema, 'opcoes_sistema');
