const mongoose = require('mongoose');

const cursoSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
  nome: { type: String, required: true, trim: true },
  unidade: { type: String, required: true, trim: true },
  grau: {
    type: String,
    required: true,
    enum: ['Bacharelado', 'Licenciatura', 'Tecnólogo', 'Pós-Graduação', 'Mestrado', 'Pós Doutorado']
  },
  modalidade: {
    type: String,
    required: true,
    enum: ['Presencial', 'Semipresencial', 'Ensino a Distância (EAD)']
  },
  duracao: { type: Number, required: true, min: 1, max: 20 },
  descricao: { type: String, trim: true, default: '' }
});

module.exports = mongoose.model('Curso', cursoSchema, 'cursos');