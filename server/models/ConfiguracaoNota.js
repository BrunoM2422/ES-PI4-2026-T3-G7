// Autores:
const mongoose = require('mongoose');

const configuracaoNotaSchema = new mongoose.Schema({
  turmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', required: true },
  disciplinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina', required: true },
  docenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Docente', required: true },
  tipoMedia: { type: String, enum: ['aritmetica', 'ponderada'], required: true }
}, { timestamps: true, collection: 'configuracoes_notas' });

configuracaoNotaSchema.index({ turmaId: 1, disciplinaId: 1 }, { unique: true });
module.exports = mongoose.models.ConfiguracaoNota || mongoose.model('ConfiguracaoNota', configuracaoNotaSchema);
