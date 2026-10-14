require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const conectarBanco = require('./config/database');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..')));

app.use('/api/auth', authRoutes);

async function iniciarServidor() {
  try {
    await conectarBanco();

    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'login.html'));
    });
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (erro) {
    console.error('Erro ao iniciar o servidor:', erro.message);
    process.exit(1);
  }
}

iniciarServidor();
