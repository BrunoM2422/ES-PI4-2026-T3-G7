const mongoose = require('mongoose');

const eventoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 90 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  category: {
    type: String,
    required: true,
    enum: ['feriado', 'institucional', 'aula', 'atividade', 'avaliacao', 'compromisso']
  },
  scope: { type: String, required: true, enum: ['global', 'turma', 'privado'], default: 'privado' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  turmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', default: null },
  start: { type: String, default: '' },
  end: { type: String, default: '' },
  location: { type: String, trim: true, maxlength: 100, default: '' },
  description: { type: String, trim: true, maxlength: 400, default: '' },
  legacyKey: { type: String, unique: true, sparse: true, select: false }
}, { timestamps: true, collection: 'eventos' });

module.exports = mongoose.models.Evento || mongoose.model('Evento', eventoSchema);