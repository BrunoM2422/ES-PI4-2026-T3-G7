require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const conectarBanco = require('./config/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const perfisRoutes = require('./routes/perfis');
const opcoesRoutes = require('./routes/opcoes');
const Disciplina = require('./models/Disciplina');
const Turma = require('./models/Turma');
const GradeHorario = require('./models/GradeHorario');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(path.join(__dirname, '..')));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/perfis',perfisRoutes);
app.use('/api/opcoes', opcoesRoutes);

async function iniciarServidor() {
  try {
    await conectarBanco();
    await Disciplina.init();
    await Turma.init();
    await GradeHorario.init();

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
