const mongoose = require('mongoose');

const estudanteSchema = new mongoose.Schema({
  ra: { type: String, unique: true },
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  cpf: { type: String, trim: true },
  telefone: { type: String, trim: true },
  endereco: { type: String, trim: true },
  instituicao: {
    nome: { type: String, trim: true },
    codigo: { type: String, trim: true }
  }
});

module.exports = mongoose.model('Estudante', estudanteSchema, 'estudantes');