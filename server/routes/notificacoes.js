const express = require('express');
const { autenticar } = require('../services/autenticacao');
const Estudante = require('../models/Estudante');
const Notificacao = require('../models/Notificacao');

const router = express.Router();

router.get('/', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'aluno') return res.status(403).json({ mensagem: 'Acesso exclusivo de alunos.' });
  try {
    const filtros = [{ email: req.usuario.email }];
    if (req.usuario.ra) filtros.push({ ra: req.usuario.ra });
    const aluno = await Estudante.findOne({ $or: filtros }).select('_id').lean();
    if (!aluno) return res.status(404).json({ mensagem: 'Cadastro de aluno não encontrado.' });

    const notificacoes = await Notificacao.find({ alunoId: aluno._id })
      .populate('turmaId', 'codigo')
      .populate('docenteId', 'nome')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ notificacoes: notificacoes.map(item => ({
      id: String(item._id), titulo: item.titulo, mensagem: item.mensagem,
      turma: item.turmaId?.codigo || '', professor: item.docenteId?.nome || '',
      createdAt: item.createdAt, updatedAt: item.updatedAt
    })) });
  } catch (erro) {
    console.error('Erro ao carregar notificações do aluno:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar suas notificações.' });
  }
});

module.exports = router;
