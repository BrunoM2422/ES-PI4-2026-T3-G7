const mongoose = require('mongoose');

const contadorSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  valor: { type: Number, required: true, min: 0, default: 0 }
}, { collection: 'contadores' });

module.exports = mongoose.models.Contador || mongoose.model('Contador', contadorSchema);
