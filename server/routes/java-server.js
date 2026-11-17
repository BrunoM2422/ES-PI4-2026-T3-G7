const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { autenticar } = require('../services/autenticacao');

const router = express.Router();
let processoServidorJava = null;

function apenasAdminMestre(req, res, next) {
  if (req.usuario.papel !== 'admin') {
    return res.status(403).json({ mensagem: 'Acesso exclusivo de administradores.' });
  }
  if (req.usuario.nivelPermissao && req.usuario.nivelPermissao !== 'admin_mestre') {
    return res.status(403).json({ mensagem: 'Apenas o administrador mestre pode controlar o servidor.' });
  }
  return next();
}

// GET /api/java-server/status
router.get('/status', autenticar, apenasAdminMestre, (req, res) => {
  const rodando = Boolean(processoServidorJava && processoServidorJava.exitCode === null && !processoServidorJava.killed);
  return res.json({ rodando });
});

// POST /api/java-server/iniciar
router.post('/iniciar', autenticar, apenasAdminMestre, (req, res) => {
  if (processoServidorJava && processoServidorJava.exitCode === null && !processoServidorJava.killed) {
    return res.json({ success: true, message: 'O servidor Java já está em execução.' });
  }

  const diretorioRaiz = path.join(__dirname, '..', '..');
  
  // Inicia o Servidor.java passando a porta 3001 (caso ele aceite argumento de porta)
  processoServidorJava = spawn('java', ['server.cliente_servidor.servidor.Servidor', '3001'], {
    cwd: diretorioRaiz
  });

  processoServidorJava.stdout.on('data', (dados) => {
    console.log(`[Servidor Java]: ${dados.toString('utf8').trim()}`);
  });

  processoServidorJava.stderr.on('data', (dados) => {
    console.error(`[Servidor Java Erro]: ${dados.toString('utf8').trim()}`);
  });

  processoServidorJava.on('exit', (codigo) => {
    console.log(`[Servidor Java] Encerrado com código ${codigo}`);
    processoServidorJava = null;
  });

  return res.json({ success: true, message: 'Servidor Java iniciado com sucesso.' });
});

// POST /api/java-server/parar
router.post('/parar', autenticar, apenasAdminMestre, (req, res) => {
  if (!processoServidorJava || processoServidorJava.exitCode !== null) {
    processoServidorJava = null;
    return res.json({ success: true, message: 'O servidor Java já estava desligado.' });
  }

  processoServidorJava.kill('SIGTERM');
  processoServidorJava = null;
  return res.json({ success: true, message: 'Servidor Java desativado com sucesso.' });
});

// Garante que o Java feche se o Node.js for encerrado
process.on('exit', () => {
  if (processoServidorJava) processoServidorJava.kill();
});

module.exports = router;