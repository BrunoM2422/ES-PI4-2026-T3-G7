const mongoose = require('mongoose');

const docenteSchema = new mongoose.Schema({
  rp: { type: String, unique: true },
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  cpf: { type: String, trim: true },
  telefone: { type: String, trim: true },
  especialidade: { type: String, trim: true },
  endereco: { type: String, trim: true },
  descricao: { type: String, trim: true },
  foto: { type: String, default: '' },
  instituicao: {
    nome: { type: String, trim: true },
    codigo: { type: String, trim: true }
  }
});

module.exports = mongoose.model('Docente', docenteSchema, 'docentes');