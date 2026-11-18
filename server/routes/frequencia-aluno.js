const express = require('express');
const mongoose = require('mongoose');
const { autenticar } = require('../services/autenticacao');
const Estudante = require('../models/Estudante');
const Turma = require('../models/Turma');
const Frequencia = require('../models/Frequencia');

const router = express.Router();
function janelaDeAulas() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const hoje = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
  const diasDesdeSegunda = (hoje.getUTCDay() + 6) % 7;
  const inicio = new Date(hoje.getTime() - (diasDesdeSegunda + 56) * 86400000);
  const fimExclusivo = new Date(inicio.getTime() + 112 * 86400000);
  return { inicio: inicio.toISOString().slice(0, 10), fimExclusivo: fimExclusivo.toISOString().slice(0, 10), semanas: 16 };
}

router.get('/', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'aluno') return res.status(403).json({ mensagem: 'Acesso exclusivo de estudantes.' });
  try {
    const aluno = await Estudante.findOne({ email: req.usuario.email }).select('_id gradeMatriculas turmaId').lean();
    if (!aluno) return res.status(404).json({ mensagem: 'Perfil de estudante não encontrado.' });
    const matriculas = aluno.gradeMatriculas?.length
      ? aluno.gradeMatriculas
      : aluno.turmaId ? [{ turmaId: aluno.turmaId, disciplinaId: null }] : [];
    const turmaIds = [...new Set(matriculas.map(item => String(item.turmaId)))];
    const turmas = turmaIds.length ? await Turma.find({ _id: { $in: turmaIds } }).select('codigo horarios').populate('horarios.disciplinaId', 'nome').lean() : [];
    const disciplinas = new Map();
    for (const matricula of matriculas) {
      const turma = turmas.find(item => String(item._id) === String(matricula.turmaId));
      if (!turma) continue;
      const aulas = turma.horarios.filter(aula => !matricula.disciplinaId || String(aula.disciplinaId?._id || aula.disciplinaId) === String(matricula.disciplinaId));
      for (const aula of aulas) {
        const idDisciplina = String(aula.disciplinaId?._id || aula.disciplinaId);
        if (!disciplinas.has(idDisciplina)) disciplinas.set(idDisciplina, { id: idDisciplina, nome: aula.disciplinaId?.nome || 'Disciplina', turmaId: String(turma._id), turma: turma.codigo, totalAulasSemanais: 0 });
        disciplinas.get(idDisciplina).totalAulasSemanais++;
      }
    }
    const janela = janelaDeAulas();
    const itens = await Promise.all([...disciplinas.values()].map(async disciplina => {
      const registros = await Frequencia.find({
        turmaId: disciplina.turmaId, disciplinaId: disciplina.id,
        data: { $gte: janela.inicio, $lt: janela.fimExclusivo },
        'registros.alunoId': aluno._id
      }).lean();
      const aulasComPresenca = registros.filter(item => item.registros.some(registro => String(registro.alunoId) === String(aluno._id)));
      const faltas = aulasComPresenca.reduce((total, sessao) => total + (sessao.registros.find(registro => String(registro.alunoId) === String(aluno._id))?.presente === false ? 1 : 0), 0);
      const aulasNoSemestre = disciplina.totalAulasSemanais * janela.semanas;
      const presencas = Math.max(0, aulasNoSemestre - faltas);
      const totalPermitido = disciplina.totalAulasSemanais * 4;
      return { ...disciplina, totalPermitido, faltas, presencas, aulasNoSemestre, chamadasRegistradas: aulasComPresenca.length, percentualPresenca: aulasNoSemestre ? Math.round(presencas / aulasNoSemestre * 100) : 100 };
    }));
    res.json({ disciplinas: itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) });
  } catch (erro) {
    console.error('Erro ao carregar frequência do estudante:', erro);
    res.status(500).json({ mensagem: 'Não foi possível carregar sua frequência.' });
  }
});
module.exports = router;
