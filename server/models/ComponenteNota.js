const mongoose = require('mongoose');

const componenteNotaSchema = new mongoose.Schema({
  turmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', required: true },
  disciplinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina', required: true },
  docenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Docente', required: true },
  titulo: { type: String, required: true, trim: true, maxlength: 80 },
  valorMaximo: { type: Number, required: true, min: 0.01, max: 100 },
  tipoMedia: { type: String, enum: ['aritmetica', 'ponderada'], default: 'aritmetica', required: true },
  peso: { type: Number, default: 1, min: 0.01, max: 100 },
  dataAplicacao: { type: Date, default: null }
}, { timestamps: true, collection: 'componentes_notas' });

componenteNotaSchema.index({ turmaId: 1, disciplinaId: 1, titulo: 1 }, { unique: true });
module.exports = mongoose.models.ComponenteNota || mongoose.model('ComponenteNota', componenteNotaSchema);
