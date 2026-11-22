// Autores: Matheus Antony Lucas Lima RA:25013260
const mongoose = require('mongoose');

// Média calculada (pelo servidor Java) de um aluno em uma disciplina de uma turma.
// Fica salva no banco para poder ser lida mesmo com o servidor Java desativado.
const mediaNotaSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudante', required: true },
  turmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', required: true },
  disciplinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina', required: true },
  tipoMedia: { type: String, enum: ['aritmetica', 'ponderada'], required: true },
  media: { type: Number, min: 0, max: 100, required: true },
  // true quando notas/componentes mudaram depois do último cálculo
  desatualizada: { type: Boolean, default: false },
  calculadaEm: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'medias_notas' });

mediaNotaSchema.index({ alunoId: 1, turmaId: 1, disciplinaId: 1 }, { unique: true });
mediaNotaSchema.index({ turmaId: 1, disciplinaId: 1 });
module.exports = mongoose.models.MediaNota || mongoose.model('MediaNota', mediaNotaSchema);