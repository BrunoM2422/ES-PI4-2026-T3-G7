const express = require('express');
const OpcoesSistema = require('../models/OpcoesSistema');
const Estudante = require('../models/Estudante');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const opcoes = await OpcoesSistema.findByIdAndUpdate(
      'opcoes-academicas',
      { $setOnInsert: { _id: 'opcoes-academicas' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const email = String(req.query.email || '').trim().toLowerCase();
    if (email) {
      const estudante = await Estudante.findOne({ email }).select('cursoId statusAcademico').lean();
      if (Array.isArray(opcoes.gradeCursosLiberados)) {
        opcoes.gradeCurricular = Boolean(estudante && estudante.statusAcademico !== 'trancado' && estudante.cursoId && opcoes.gradeCursosLiberados.some(id => String(id) === String(estudante.cursoId)));
      }
    }
    return res.json({ opcoes });
  } catch (erro) {
    console.error('Erro ao carregar opções do sistema:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar as opções do sistema.' });
  }
});

module.exports = router;
