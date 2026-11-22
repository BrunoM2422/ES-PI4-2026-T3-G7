//Autor Matheus Antony Lucas Lima RA:25013260

const express = require('express');
const { autenticar } = require('../services/autenticacao');
const javaServerService = require('../services/javaServerService');

const router = express.Router();

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
  return res.json(javaServerService.obterStatus());
});

// POST /api/java-server/iniciar
router.post('/iniciar', autenticar, apenasAdminMestre, async (req, res) => {
  try {
    const resultado = await javaServerService.iniciar();
    return res.status(resultado.success ? 200 : 500).json(resultado);
  } catch (erro) {
    console.error('Erro ao iniciar servidor Java:', erro);
    return res.status(500).json({ success: false, message: 'Não foi possível iniciar o servidor Java.' });
  }
});

// POST /api/java-server/parar
router.post('/parar', autenticar, apenasAdminMestre, async (req, res) => {
  try {
    const resultado = await javaServerService.parar();
    return res.json(resultado);
  } catch (erro) {
    console.error('Erro ao parar servidor Java:', erro);
    return res.status(500).json({ success: false, message: 'Não foi possível desativar o servidor Java.' });
  }
});

module.exports = router;