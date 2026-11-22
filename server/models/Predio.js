// Autores: Luca Filippi — RA: 25022556
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  nome: { type: String, required: true, maxlength: 80 },
  chave: { type: String, required: true, unique: true },
  salas: [{ nome: { type: String, required: true, maxlength: 80 }, chave: String }]
}, { collection: 'predios' });

module.exports = mongoose.model('Predio', schema);
