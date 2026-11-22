// Autores: Bruno Machado — RA: 25008041
// Gabriel Scolfaro de Azeredo - 25006194
const mongoose = require('mongoose');

// Define a estrutura e as regras dos dados dos docentes.
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

// Exporta o modelo Docente para ser utilizado em outras partes do sistema.
module.exports = mongoose.model('Docente', docenteSchema, 'docentes');
