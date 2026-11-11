const router = require('express').Router();
const Log = require('../models/Log');
const { autenticar } = require('../services/autenticacao');

router.get('/', autenticar, async (req, res) => {
  if (!['admin', 'professor'].includes(req.usuario.papel)) return res.status(403).json({ mensagem: 'Acesso não permitido.' });
  try {
    const logs = await Log.find({ usuarioId: req.usuario.id }).sort({ dataHora: -1, _id: -1 }).select('usuario tipo acao descricao dataHora').lean();
    res.set('Cache-Control', 'no-store');
    res.json({ logs });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Não foi possível carregar seus logs.' });
  }
});
module.exports = router;
