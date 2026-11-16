const express = require('express');
const mongoose = require('mongoose');
const { autenticar } = require('../services/autenticacao');
const Docente = require('../models/Docente');
const Turma = require('../models/Turma');
const Estudante = require('../models/Estudante');
const Notificacao = require('../models/Notificacao');

const router = express.Router();

async function docenteDaSessao(usuario) {
  const filtros = [{ email: usuario.email }];
  if (usuario.rp) filtros.push({ rp: usuario.rp });
  return Docente.findOne({ $or: filtros }).select('_id nome').lean();
}

function aulasDoDocente(turma, docenteId) {
  return (turma.horarios || [])
    .filter(item => String(item.docenteId?._id || item.docenteId) === String(docenteId))
    .map(item => item.disciplinaId?.nome)
    .filter(Boolean);
}

async function idsDosAlunos(turma) {
  const ids = new Set((turma.alunosIds || []).map(id => String(id?._id || id)));
  const matriculadosNaGrade = await Estudante.find({ 'gradeMatriculas.turmaId': turma._id })
    .select('_id')
    .lean();
  matriculadosNaGrade.forEach(aluno => ids.add(String(aluno._id)));
  return [...ids];
}

async function idsDosAlunosPorTurma(turmas) {
  const mapa = new Map(turmas.map(turma => [
    String(turma._id), new Set((turma.alunosIds || []).map(id => String(id?._id || id)))
  ]));
  if (!turmas.length) return mapa;
  const matriculas = await Estudante.find({ 'gradeMatriculas.turmaId': { $in: turmas.map(turma => turma._id) } })
    .select('_id gradeMatriculas')
    .lean();
  matriculas.forEach(aluno => (aluno.gradeMatriculas || []).forEach(item => {
    const ids = mapa.get(String(item.turmaId));
    if (ids) ids.add(String(aluno._id));
  }));
  return mapa;
}

router.get('/', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    if (!docente) return res.status(404).json({ mensagem: 'Perfil docente não encontrado.' });

    const turmas = await Turma.find({ 'horarios.docenteId': docente._id })
      .select('codigo periodoLetivo vagas cursoId horarios alunosIds')
      .populate('cursoId', 'nome')
      .populate('horarios.disciplinaId', 'nome')
      .sort({ codigo: 1 })
      .lean();

    const idsPorTurma = await idsDosAlunosPorTurma(turmas);
    return res.json({ turmas: turmas.map(turma => ({
      id: String(turma._id),
      codigo: turma.codigo,
      curso: turma.cursoId?.nome || 'Curso não informado',
      periodoLetivo: turma.periodoLetivo,
      vagas: turma.vagas,
      alunos: idsPorTurma.get(String(turma._id)).size,
      disciplinas: [...new Set(aulasDoDocente(turma, docente._id))]
    })) });
  } catch (erro) {
    console.error('Erro ao carregar turmas do docente:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar suas turmas.' });
  }
});

router.get('/:turmaId/alunos', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  if (!mongoose.isValidObjectId(req.params.turmaId)) return res.status(400).json({ mensagem: 'Turma inválida.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    if (!docente) return res.status(404).json({ mensagem: 'Perfil docente não encontrado.' });
    const turma = await Turma.findOne({ _id: req.params.turmaId, 'horarios.docenteId': docente._id })
      .select('codigo periodoLetivo cursoId horarios alunosIds')
      .populate('cursoId', 'nome')
      .populate('horarios.disciplinaId', 'nome')
      .lean();
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada entre suas turmas.' });

    const ids = await idsDosAlunos(turma);
    const alunos = ids.length
      ? await Estudante.find({ _id: { $in: ids } }).select('nome ra statusAcademico').sort({ nome: 1 }).lean()
      : [];
    return res.json({
      turma: {
        id: String(turma._id),
        codigo: turma.codigo,
        curso: turma.cursoId?.nome || 'Curso não informado',
        periodoLetivo: turma.periodoLetivo,
        disciplinas: [...new Set(aulasDoDocente(turma, docente._id))]
      },
      alunos: alunos.map(aluno => ({
        id: String(aluno._id), nome: aluno.nome, ra: aluno.ra || '',
        statusAcademico: aluno.statusAcademico || 'ativo', mediaAtual: null
      }))
    });
  } catch (erro) {
    console.error('Erro ao carregar alunos da turma:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar os alunos desta turma.' });
  }
});

router.post('/:turmaId/comunicados', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  if (!mongoose.isValidObjectId(req.params.turmaId)) return res.status(400).json({ mensagem: 'Turma inválida.' });

  const titulo = typeof req.body.titulo === 'string' ? req.body.titulo.trim() : '';
  const mensagem = typeof req.body.mensagem === 'string' ? req.body.mensagem.trim() : '';
  if (titulo.length < 3 || titulo.length > 90 || !mensagem || mensagem.length > 2000) {
    return res.status(400).json({ mensagem: 'Informe um título (3 a 90 caracteres) e uma mensagem (até 2000 caracteres).' });
  }

  try {
    const docente = await docenteDaSessao(req.usuario);
    if (!docente) return res.status(404).json({ mensagem: 'Perfil docente não encontrado.' });
    const turma = await Turma.findOne({ _id: req.params.turmaId, 'horarios.docenteId': docente._id })
      .select('alunosIds')
      .lean();
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada entre suas turmas.' });

    const ids = await idsDosAlunos(turma);
    const alunos = ids.length
      ? await Estudante.find({ _id: { $in: ids }, statusAcademico: { $ne: 'trancado' } }).select('_id').lean()
      : [];
    if (!alunos.length) return res.status(409).json({ mensagem: 'Esta turma ainda não possui alunos ativos para receber o comunicado.' });

    await Notificacao.insertMany(alunos.map(aluno => ({
      alunoId: aluno._id,
      turmaId: turma._id,
      docenteId: docente._id,
      titulo,
      mensagem
    })));
    return res.status(201).json({ mensagem: 'Comunicado enviado aos alunos da turma.', enviados: alunos.length });
  } catch (erro) {
    console.error('Erro ao enviar comunicado da turma:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível enviar o comunicado.' });
  }
});

module.exports = router;
