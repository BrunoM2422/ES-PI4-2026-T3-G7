const mongoose = require('mongoose');

async function conectarBanco() {
  await mongoose.connect(process.env.MONGODB_URI,{
    dbName: 'NotaDez'
  });
  console.log('MongoDB conectado com sucesso ao NotaDez!');
}

module.exports = conectarBanco;
