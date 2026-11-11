const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  usuario: { type: String, required: true },
  tipo: { type: String, required: true },
  acao: { type: String, required: true },
  descricao: String,
  dataHora: { type: Date, default: Date.now }
});
schema.index({ usuarioId: 1, dataHora: -1 });
module.exports = mongoose.model('Log', schema, 'LOGs');
