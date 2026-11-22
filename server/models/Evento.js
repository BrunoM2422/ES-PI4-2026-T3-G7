// Autores: Bruno Machado — RA: 25008041
// Nícolas Mitjans Nunes - 25005124
const mongoose = require('mongoose');

// Define os eventos, seus responsáveis, vínculos e níveis de visibilidade.
const eventoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 90 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  category: {
    type: String,
    required: true,
    enum: ['feriado', 'institucional', 'aula', 'atividade', 'avaliacao', 'compromisso']
  },
  scope: { type: String, required: true, enum: ['global', 'curso', 'turma', 'privado'], default: 'privado' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  turmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', default: null },
  disciplinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina', default: null },
  cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', default: null, index: true },
  start: { type: String, default: '' },
  end: { type: String, default: '' },
  location: { type: String, trim: true, maxlength: 100, default: '' },
  description: { type: String, trim: true, maxlength: 400, default: '' },
  legacyKey: { type: String, unique: true, sparse: true, select: false }
}, { timestamps: true, collection: 'eventos' });

eventoSchema.index({ scope: 1, turmaId: 1, disciplinaId: 1, date: 1 });

module.exports = mongoose.models.Evento || mongoose.model('Evento', eventoSchema);
