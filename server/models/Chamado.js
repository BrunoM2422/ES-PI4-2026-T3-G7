// Autores: Bruno Machado — RA: 25008041
// Gabriel Scolfaro de Azeredo - 25006194
const mongoose = require('mongoose');

// Define a estrutura das mensagens trocadas dentro de um chamado.
const mensagemSchema = new mongoose.Schema({
  remetente_tipo: { type: String, enum: ['estudante', 'admin', 'docente'], required: true },
  remetente_nome: { type: String, required: true },
  mensagem: { type: String, required: true },
  data_envio: { type: Date, default: Date.now }
});

// Define os dados, o status e o histórico de cada chamado.
const chamadoSchema = new mongoose.Schema({
  ra: { type: String, required: true },
  nome: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  curso: { type: String, trim: true },
  cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', default: null, index: true },
  turma: { type: String, trim: true },
  assunto: { type: String, required: true },
  descricao: { type: String, required: true },
  status: { type: String, enum: ['ativo', 'finalizado'], default: 'ativo' },
  mensagens: [mensagemSchema],
  criado_em: { type: Date, default: Date.now },
  atualizado_em: { type: Date, default: Date.now },
  encerrado_em: { type: Date, default: null }
});

// Registra o modelo Chamado e define a coleção utilizada no MongoDB.
module.exports = mongoose.model('Chamado', chamadoSchema, 'chamados');
