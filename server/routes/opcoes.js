const express = require('express');
const OpcoesSistema = require('../models/OpcoesSistema');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const opcoes = await OpcoesSistema.findByIdAndUpdate(
      'opcoes-academicas',
      { $setOnInsert: { _id: 'opcoes-academicas' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ opcoes });
  } catch (erro) {
    console.error('Erro ao carregar opções do sistema:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar as opções do sistema.' });
  }
});

module.exports = router;
