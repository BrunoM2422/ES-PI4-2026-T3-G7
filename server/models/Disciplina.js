const mongoose = require('mongoose');

const disciplinaSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  codigo: { type: String, required: true, trim: true, uppercase: true, match: /^(?:\d{4}|\d{6})$/ },
  cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', required: true },
  equivale_para: { type: [{ type: String, match: /^\d{2}$/ }], default: [] },
  semestre: { type: Number, required: true, min: 1, max: 20 },
  descricao: { type: String, required: true, trim: true }
}, { timestamps: true });

disciplinaSchema.index({ cursoId: 1, codigo: 1 }, { unique: true });
disciplinaSchema.index({ equivale_para: 1 });

module.exports = mongoose.model('Disciplina', disciplinaSchema, 'disciplinas');
