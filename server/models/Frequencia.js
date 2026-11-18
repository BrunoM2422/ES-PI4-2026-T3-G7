// Autores:
const mongoose = require('mongoose');

const registroSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudante', required: true },
  presente: { type: Boolean, required: true }
}, { _id: false });

const frequenciaSchema = new mongoose.Schema({
  turmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', required: true },
  aulaId: { type: mongoose.Schema.Types.ObjectId, required: true },
  disciplinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina', required: true },
  docenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Docente', required: true },
  data: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  registros: { type: [registroSchema], default: [] }
}, { timestamps: true, collection: 'frequencias' });

frequenciaSchema.index({ turmaId:  1, aulaId: 1, data: 1 }, { unique: true });

module.exports = mongoose.models.Frequencia || mongoose.model('Frequencia', frequenciaSchema);
