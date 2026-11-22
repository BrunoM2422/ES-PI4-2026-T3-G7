// Autores: Bruno Machado — RA: 25008041
const express = require('express');
const { autenticar } = require('../services/autenticacao');
const Estudante = require('../models/Estudante');
const Turma = require('../models/Turma');
const OpcoesSistema = require('../models/OpcoesSistema');

const router = express.Router();

router.get('/', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'aluno') return res.status(403).json({ mensagem: 'Acesso exclusivo de alunos.' });
  try {
    const aluno = await Estudante.findOne({ email: req.usuario.email }).select('_id cursoId turmaId gradeMatriculas statusAcademico').lean();
    if (!aluno || aluno.statusAcademico === 'trancado') return res.json({ professores: [] });
    const opcoes = await OpcoesSistema.findById('opcoes-academicas').select('avaliacaoProfessoresCursosLiberados').lean();
    const liberados = (opcoes?.avaliacaoProfessoresCursosLiberados || []).some(id => String(id) === String(aluno.cursoId));
    if (!liberados) return res.status(403).json({ mensagem: 'A avaliacao de professores nao esta liberada para este curso.' });

    const turmasIds = [...new Set([...(aluno.gradeMatriculas || []).map(item => String(item.turmaId)), ...(aluno.turmaId ? [String(aluno.turmaId)] : [])])];
    const pertencimento = [];
    if (turmasIds.length) pertencimento.push({ _id: { $in: turmasIds } });
    pertencimento.push({ alunosIds: aluno._id });
    const turmas = await Turma.find({ $or: pertencimento })
      .populate('horarios.disciplinaId', 'nome')
      .populate('horarios.docenteId', 'nome foto')
      .lean();
    const disciplinasPorTurma = new Map();
    for (const item of aluno.gradeMatriculas || []) {
      const id = String(item.turmaId);
      if (!disciplinasPorTurma.has(id)) disciplinasPorTurma.set(id, new Set());
      disciplinasPorTurma.get(id).add(String(item.disciplinaId));
    }
    const professores = new Map();
    for (const turma of turmas) {
      const selecionadas = disciplinasPorTurma.get(String(turma._id));
      for (const aula of turma.horarios || []) {
        const docente = aula.docenteId;
        const disciplina = aula.disciplinaId;
        if (!docente?._id || !disciplina?._id || (selecionadas?.size && !selecionadas.has(String(disciplina._id)))) continue;
        const id = String(docente._id);
        if (!professores.has(id)) professores.set(id, { id, nome: docente.nome, foto: docente.foto || '', disciplinas: new Set() });
        professores.get(id).disciplinas.add(disciplina.nome);
      }
    }
    return res.json({ professores: [...professores.values()].map(item => ({ ...item, disciplinas: [...item.disciplinas].sort((a, b) => a.localeCompare(b, 'pt-BR')) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) });
  } catch (erro) {
    console.error('Erro ao carregar docentes para avaliacao:', erro);
    return res.status(500).json({ mensagem: 'Nao foi possivel carregar os docentes.' });
  }
});

module.exports = router;
