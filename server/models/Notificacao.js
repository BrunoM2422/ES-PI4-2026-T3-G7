// Autores:
const mongoose = require('mongoose');

const notificacaoSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudante', required: true },
  turmaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', default: null },
  docenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Docente', default: null },
  curso: { type: String, trim: true, maxlength: 90, default: '' },
  tipo: { type: String, enum: ['comunicado', 'sistema'], default: 'comunicado' },
  chave: { type: String, trim: true, default: undefined },
  titulo: { type: String, required: true, trim: true, maxlength: 90 },
  mensagem: { type: String, required: true, trim: true, maxlength: 2000 }
}, { timestamps: true, collection: 'notificacoes' });

notificacaoSchema.index({ alunoId: 1, createdAt: -1 });
notificacaoSchema.index({ alunoId: 1, chave: 1 }, { unique: true, partialFilterExpression: { chave: { $type: 'string' } } });

module.exports = mongoose.models.Notificacao || mongoose.model('Notificacao', notificacaoSchema);
