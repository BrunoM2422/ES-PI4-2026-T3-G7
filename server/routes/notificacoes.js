// Autores: Bruno Machado — RA: 25008041
const express = require('express');
const { autenticar } = require('../services/autenticacao');
const Estudante = require('../models/Estudante');
const Notificacao = require('../models/Notificacao');
const OpcoesSistema = require('../models/OpcoesSistema');
const { notificarLiberacao } = require('../services/notificacoesSistema');
const router = express.Router();

router.get('/', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'aluno') return res.status(403).json({ mensagem: 'Acesso exclusivo de alunos.' });
  res.set('Cache-Control', 'private, no-store');
  try {
    const filtros = [{ email: req.usuario.email }];
    if (req.usuario.ra) filtros.push({ ra: req.usuario.ra });
    const aluno = await Estudante.findOne({ $or: filtros }).select('_id cursoId turmaId gradeMatriculas statusAcademico').lean();
    if (!aluno) return res.status(404).json({ mensagem: 'Cadastro de aluno não encontrado.' });

    if (aluno.cursoId && aluno.statusAcademico !== 'trancado') {
      const opcoes = await OpcoesSistema.findById('opcoes-academicas')
        .select('gradeCursosLiberados avaliacaoProfessoresCursosLiberados')
        .lean();
      const cursoId = String(aluno.cursoId);
      if ((opcoes?.gradeCursosLiberados || []).some(id => String(id) === cursoId)) {
        await notificarLiberacao([aluno.cursoId], 'grade', [aluno._id], 'recuperacao');
      }
      if ((opcoes?.avaliacaoProfessoresCursosLiberados || []).some(id => String(id) === cursoId)) {
        await notificarLiberacao([aluno.cursoId], 'avaliacao', [aluno._id], 'recuperacao');
      }
    }

    const notificacoes = await Notificacao.find({ alunoId: aluno._id })
      .populate('turmaId', 'codigo')
      .populate('docenteId', 'nome')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const matriculas = aluno.gradeMatriculas || [];
    const chavesMatricula = new Set(matriculas.map(item => `${item.turmaId}:${item.disciplinaId}`));
    const notificacoesVisiveis = notificacoes.filter(item => {
      if (!item.turmaId || item.tipo === 'sistema') return true;
      if (item.disciplinaId) return chavesMatricula.has(`${item.turmaId._id || item.turmaId}:${item.disciplinaId}`);
      // Notificações antigas não têm disciplina de origem, então não podem ser
      // exibidas com segurança para alunos matriculados por disciplina.
      if (matriculas.length) return false;
      return String(item.turmaId._id || item.turmaId) === String(aluno.turmaId || '');
    });
    return res.json({ notificacoes: notificacoesVisiveis.map(item => ({
      id: String(item._id), titulo: item.titulo, mensagem: item.mensagem,
      tipo: item.tipo || 'comunicado', curso: item.curso || '',
      turma: item.turmaId?.codigo || '', professor: item.docenteId?.nome || '',
      createdAt: item.createdAt, updatedAt: item.updatedAt
    })) });
  } catch (erro) {
    console.error('Erro ao carregar notificações do aluno:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar suas notificações.' });
  }
});

module.exports = router;
