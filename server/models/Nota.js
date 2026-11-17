const mongoose = require('mongoose');

const notaSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudante', required: true },
  turmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', required: true },
  disciplinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina', required: true },
  componenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComponenteNota', required: true },
  valor: { type: Number, min: 0, max: 100, default: null }
}, { timestamps: true, collection: 'notas' });

notaSchema.index({ alunoId: 1, componenteId: 1 }, { unique: true });
module.exports = mongoose.models.Nota || mongoose.model('Nota', notaSchema);
