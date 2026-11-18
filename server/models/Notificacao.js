// Autores:
const mongoose = require('mongoose');

const notificacaoSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudante', required: true },
  turmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', required: true },
  docenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Docente', required: true },
  titulo: { type: String, required: true, trim: true, maxlength: 90 },
  mensagem: { type: String, required: true, trim: true, maxlength: 2000 }
}, { timestamps: true, collection: 'notificacoes' });

notificacaoSchema.index({ alunoId: 1, createdAt: -1 });

module.exports = mongoose.models.Notificacao || mongoose.model('Notificacao', notificacaoSchema);
