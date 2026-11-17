require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const conectarBanco = require('./config/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const perfisRoutes = require('./routes/perfis');
const opcoesRoutes = require('./routes/opcoes');
const calendarioRoutes = require('./routes/calendario');
const chamadosRoutes = require('./routes/chamados');
const gradeAlunoRoutes = require('./routes/grade-aluno');
const historicoAlunoRoutes = require('./routes/historico-aluno');
const professorTurmasRoutes = require('./routes/professor-turmas');
const frequenciaRoutes = require('./routes/frequencia');
const frequenciaAlunoRoutes = require('./routes/frequencia-aluno');
const notificacoesRoutes = require('./routes/notificacoes');
const notasRoutes = require('./routes/notas');
const Disciplina = require('./models/Disciplina');
const Turma = require('./models/Turma');
const GradeHorario = require('./models/GradeHorario');
const Evento = require('./models/Evento');
const ComponenteNota = require('./models/ComponenteNota');
const Nota = require('./models/Nota');
const ConfiguracaoNota = require('./models/ConfiguracaoNota');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(path.join(__dirname, '..')));

const { autenticar } = require('./services/autenticacao');
const { auditar } = require('./services/logs');
app.use('/api/logs', require('./routes/logs'));
app.use(['/api/admin', '/api/perfis', '/api/chamados', '/api/calendario'], (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  return autenticar(req, res, () => {
    if (req.baseUrl === '/api/admin' && req.usuario.papel !== 'admin') return res.status(403).json({ mensagem: 'Acesso exclusivo de administradores.' });
    if (req.baseUrl === '/api/perfis') req.body.email = req.usuario.email;
    return auditar(req, res, next);
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/perfis',perfisRoutes);
app.use('/api/opcoes', opcoesRoutes);
app.use('/api/calendario', calendarioRoutes);
app.use('/api/chamados', chamadosRoutes);
app.use('/api/aluno/grade', gradeAlunoRoutes);
app.use('/api/aluno/historico', historicoAlunoRoutes);
app.use('/api/professor/turmas', professorTurmasRoutes);
app.use('/api/professor/frequencia', frequenciaRoutes);
app.use('/api/aluno/frequencia', frequenciaAlunoRoutes);
app.use('/api/aluno/notificacoes', notificacoesRoutes);
app.use('/api/notas', notasRoutes);

async function iniciarServidor() {
  try {
    await conectarBanco();
    await require('./models/Log').init();
    await Disciplina.init();
    await Turma.init();
    await GradeHorario.init();
    await Evento.init();
    await ComponenteNota.init();
    await Nota.init();
    await ConfiguracaoNota.init();
    await require('./models/Frequencia').init();
    await Evento.updateMany({ scope: { $exists: false } }, { $set: { scope: 'global' } });

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
