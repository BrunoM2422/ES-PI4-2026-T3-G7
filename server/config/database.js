// Autores:
// Gabriel Scolfaro de Azeredo - 25006194
const mongoose = require('mongoose');

// Realiza a conexão com o banco de dados MongoDB.
async function conectarBanco() {
  console.log('--- DEBUG MONGODB_URI ---');
  console.log('Valor exato:', JSON.stringify(process.env.MONGODB_URI));
  console.log('-------------------------');

  // Define a URI de conexão e o nome do banco de dados utilizado.
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'NotaDez3'
  });

  // Confirma que a conexão com o banco foi estabelecida.
  console.log('MongoDB conectado com sucesso ao NotaDez!');
}

module.exports = conectarBanco;
