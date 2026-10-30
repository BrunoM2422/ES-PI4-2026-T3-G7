const mongoose = require('mongoose');

const disciplinaSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  codigo: { type: String, required: true, trim: true, uppercase: true },
  cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', required: true },
  semestre: { type: Number, required: true, min: 1, max: 20 },
  descricao: { type: String, required: true, trim: true }
}, { timestamps: true });

disciplinaSchema.index({ cursoId: 1, codigo: 1 }, { unique: true });

module.exports = mongoose.model('Disciplina', disciplinaSchema, 'disciplinas');
