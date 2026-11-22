// Autores:
// Gabriel Scolfaro de Azeredo - 25006194
const mongoose = require('mongoose');

async function conectarBanco() {
  console.log('--- DEBUG MONGODB_URI ---');
  console.log('Valor exato:', JSON.stringify(process.env.MONGODB_URI));
  console.log('-------------------------');

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'NotaDez2'
  });
  console.log('MongoDB conectado com sucesso ao NotaDez!');
}

module.exports = conectarBanco;
