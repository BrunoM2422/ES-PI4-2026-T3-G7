// Autores: Bruno Machado — RA: 25008041
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
      const gradeLiberada = Boolean(estudante?.cursoId && (opcoes.gradeCursosLiberados || [])
        .some(id => String(id) === String(estudante.cursoId)));
      const equivalenciasLiberadas = Boolean(estudante?.cursoId && (opcoes.gradeEquivalenciasCursosLiberados || [])
        .some(id => String(id) === String(estudante.cursoId)));
      opcoes.gradeCurricular = Boolean(estudante && estudante.statusAcademico !== 'trancado' && (gradeLiberada || equivalenciasLiberadas));
      opcoes.avaliacaoProfessores = Boolean(estudante && estudante.statusAcademico !== 'trancado' && estudante.cursoId && (opcoes.avaliacaoProfessoresCursosLiberados || []).some(id => String(id) === String(estudante.cursoId)));
    }
    return res.json({ opcoes });
  } catch (erro) {
    console.error('Erro ao carregar opções do sistema:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar as opções do sistema.' });
  }
});

module.exports = router;
