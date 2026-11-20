// Autores:
// Nícolas Mitjans Nunes - 25005124
const express = require('express');
const mongoose = require('mongoose');
const { autenticar } = require('../services/autenticacao');
const Docente = require('../models/Docente');
const Turma = require('../models/Turma');
const Estudante = require('../models/Estudante');
const Frequencia = require('../models/Frequencia');

const router = express.Router();
const fuso = 'America/Sao_Paulo';
const nomesDias = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function partesLocais(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(({ type, value }) => [type, value]));
}

function docenteQuery(usuario) {
  const filtros = [{ email: usuario.email }];
  if (usuario.rp) filtros.push({ rp: usuario.rp });
  return { $or: filtros };
}

function minutosLocais(parts) { return Number(parts.hour) * 60 + Number(parts.minute); }
function janelaSemestre(parts = partesLocais()) {
  const dataAtual = `${parts.year}-${parts.month}-${parts.day}`;
  const hojeUtc = new Date(`${dataAtual}T00:00:00.000Z`);
  const diasDesdeSegunda = (hojeUtc.getUTCDay() + 6) % 7;
  const inicio = new Date(hojeUtc.getTime() - (diasDesdeSegunda + 56) * 86400000);
  const fimExclusivo = new Date(inicio.getTime() + 112 * 86400000);
  return { inicio: inicio.toISOString().slice(0, 10), fimExclusivo: fimExclusivo.toISOString().slice(0, 10) };
}

function aulaJaTerminou(data, horaFim, agora = partesLocais()) {
  const dataAtual = `${agora.year}-${agora.month}-${agora.day}`;
  return data < dataAtual || (data === dataAtual && minutosLocais(agora) >= horaFim * 60);
}

function dataValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10) === data;
}

async function alunosDaTurma(turma, disciplinaId) {
  if (!disciplinaId) return [];
  return Estudante.find({
    statusAcademico: { $ne: 'trancado' },
    gradeMatriculas: { $elemMatch: { turmaId: turma._id, disciplinaId } }
  }).select('_id nome ra').sort({ nome: 1 }).lean();
}

async function turmaDoDocente(turmaId, docenteId) {
  return Turma.findOne({ _id: turmaId, 'horarios.docenteId': docenteId })
    .populate('horarios.disciplinaId', 'nome codigo').lean();
}

router.use(autenticar, (req, res, next) => req.usuario.papel === 'professor'
  ? next() : res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' }));

router.get('/turmas', async (req, res) => {
  try {
    const docente = await Docente.findOne(docenteQuery(req.usuario)).select('_id').lean();
    if (!docente) return res.status(404).json({ mensagem: 'Perfil docente não encontrado.' });
    const turmas = await Turma.find({ 'horarios.docenteId': docente._id }).select('codigo periodoLetivo horarios').populate('horarios.disciplinaId', 'nome codigo').sort({ codigo: 1 }).lean();
    const hoje = partesLocais();
    const dia = nomesDias.indexOf(hoje.weekday);
    const agora = minutosLocais(hoje);
    const chamadas = await Promise.all(turmas.map(async turma => {
      const minhasAulas = turma.horarios.filter(item => String(item.docenteId) === String(docente._id));
      const materias = [...new Map(minhasAulas.map(item => [String(item.disciplinaId?._id || item.disciplinaId), { id: String(item.disciplinaId?._id || item.disciplinaId), nome: item.disciplinaId?.nome || 'Disciplina', codigo: item.disciplinaId?.codigo || '', maxFaltas: minhasAulas.filter(a => String(a.disciplinaId?._id || a.disciplinaId) === String(item.disciplinaId?._id || item.disciplinaId)).length * 4 }])).values()];
      const aulasHoje = minhasAulas.filter(item => item.dia === dia).map(item => ({
        id: String(item.aulaId), disciplinaId: String(item.disciplinaId?._id || item.disciplinaId),
        disciplina: item.disciplinaId?.nome || 'Disciplina', codigoDisciplina: item.disciplinaId?.codigo || '', dia: item.dia, inicio: item.hora,
        fim: item.hora + 1, disponivel: agora >= item.hora * 60 && agora < (item.hora + 1) * 60
      }));
      const registros = await Frequencia.find({ turmaId: turma._id, docenteId: docente._id }).lean();
      const faltasPorAlunoMateria = new Map();
      registros.forEach(sessao => sessao.registros.filter(registro => !registro.presente).forEach(registro => {
        const chave = `${registro.alunoId}:${sessao.disciplinaId}`;
        faltasPorAlunoMateria.set(chave, (faltasPorAlunoMateria.get(chave) || 0) + 1);
      }));
      return { id: String(turma._id), codigo: turma.codigo, periodoLetivo: turma.periodoLetivo, materias,
        aulasHoje, faltasPorAlunoMateria: Object.fromEntries(faltasPorAlunoMateria) };
    }));
    res.json({ turmas: chamadas });
  } catch (erro) {
    console.error('Erro ao carregar frequências:', erro);
    res.status(500).json({ mensagem: 'Não foi possível carregar as turmas de frequência.' });
  }
});

router.get('/turmas/:turmaId/aulas', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.turmaId)) return res.status(400).json({ mensagem: 'Turma inválida.' });
  try {
    const docente = await Docente.findOne(docenteQuery(req.usuario)).select('_id').lean();
    const turma = docente && await turmaDoDocente(req.params.turmaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada entre suas turmas.' });
    const minhas = turma.horarios.filter(item => String(item.docenteId) === String(docente._id));
    const materias = [...new Map(minhas.map(item => [String(item.disciplinaId?._id), { id: String(item.disciplinaId?._id), nome: item.disciplinaId?.nome || 'Disciplina', codigo: item.disciplinaId?.codigo || '', ocorrenciasSemanais: minhas.filter(a => String(a.disciplinaId?._id) === String(item.disciplinaId?._id)).length }])).values()];
    const disciplinas = [...new Set(minhas.map(item => String(item.disciplinaId?._id || item.disciplinaId)))];
    const alunosPorDisciplina = Object.fromEntries(await Promise.all(disciplinas.map(async disciplinaId => [
      disciplinaId,
      (await alunosDaTurma(turma, disciplinaId)).map(aluno => ({ id: String(aluno._id), nome: aluno.nome, ra: aluno.ra || '' }))
    ])));
    const aulas = minhas.map(item => ({ id: String(item.aulaId), disciplinaId: String(item.disciplinaId?._id || item.disciplinaId), disciplina: item.disciplinaId?.nome || 'Disciplina', codigoDisciplina: item.disciplinaId?.codigo || '', dia: item.dia, inicio: item.hora, fim: item.hora + 1 }));
    const diaAtual = nomesDias.indexOf(partesLocais().weekday);
    res.json({ turma: { id: String(turma._id), codigo: turma.codigo }, materias, aulasHoje: aulas.filter(item => item.dia === diaAtual), aulasHistorico: aulas, alunosPorDisciplina });
  } catch (erro) {
    console.error('Erro ao carregar chamada:', erro);
    res.status(500).json({ mensagem: 'Não foi possível carregar a chamada.' });
  }
});

router.get('/turmas/:turmaId/semestre', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.turmaId)) return res.status(400).json({ mensagem: 'Turma inválida.' });
  try {
    const docente = await Docente.findOne(docenteQuery(req.usuario)).select('_id').lean();
    const turma = docente && await turmaDoDocente(req.params.turmaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada entre suas turmas.' });
    const janela = janelaSemestre();
    const inicioUtc = new Date(`${janela.inicio}T00:00:00.000Z`);
    const fimUtc = new Date(`${janela.fimExclusivo}T00:00:00.000Z`);
    const minhasAulas = turma.horarios.filter(aula => String(aula.docenteId) === String(docente._id));
    const registros = await Frequencia.find({
      turmaId: turma._id,
      aulaId: { $in: minhasAulas.map(aula => aula.aulaId) },
      data: { $gte: janela.inicio, $lt: janela.fimExclusivo }
    }).lean();
    const registrosPorChave = new Map(registros.map(item => [`${item.aulaId}:${item.data}`, item]));
    const agora = partesLocais();
    const alunosPorDisciplina = new Map();
    const aulas = [];
    for (let cursor = inicioUtc; cursor < fimUtc; cursor = new Date(cursor.getTime() + 86400000)) {
      const data = cursor.toISOString().slice(0, 10);
      const dia = cursor.getUTCDay();
      minhasAulas.filter(aula => aula.dia === dia).forEach(aula => {
        const frequencia = registrosPorChave.get(`${aula.aulaId}:${data}`);
        aulas.push({
          aulaId: String(aula.aulaId), disciplina: aula.disciplinaId?.nome || 'Disciplina',
          data, dia, inicio: aula.hora, fim: aula.hora + 1,
          passou: aulaJaTerminou(data, aula.hora + 1, agora),
          chamadaRegistrada: Boolean(frequencia),
          disciplinaId: String(aula.disciplinaId?._id || aula.disciplinaId),
          alunos: []
        });
      });
    }
    for (const disciplinaId of new Set(minhasAulas.map(aula => String(aula.disciplinaId?._id || aula.disciplinaId)))) {
      alunosPorDisciplina.set(disciplinaId, await alunosDaTurma(turma, disciplinaId));
    }
    aulas.forEach(aula => {
      const frequencia = registrosPorChave.get(`${aula.aulaId}:${aula.data}`);
      const porAluno = new Map((frequencia?.registros || []).map(item => [String(item.alunoId), item.presente]));
      aula.alunos = (alunosPorDisciplina.get(aula.disciplinaId) || []).map(aluno => ({
        id: String(aluno._id), nome: aluno.nome,
        presente: porAluno.has(String(aluno._id)) ? porAluno.get(String(aluno._id)) : true
      }));
    });
    aulas.sort((a, b) => a.data.localeCompare(b.data) || a.inicio - b.inicio || a.disciplina.localeCompare(b.disciplina, 'pt-BR'));
    res.json({ periodo: { inicio: janela.inicio, fim: new Date(fimUtc.getTime() - 86400000).toISOString().slice(0, 10) }, aulas });
  } catch (erro) {
    console.error('Erro ao carregar aulas do semestre:', erro);
    res.status(500).json({ mensagem: 'Não foi possível carregar as aulas do semestre.' });
  }
});

router.patch('/turmas/:turmaId/semestre/:aulaId/:data/faltas/:alunoId', async (req, res) => {
  const { turmaId, aulaId, data, alunoId } = req.params;
  if (![turmaId, aulaId, alunoId].every(mongoose.isValidObjectId) || !dataValida(data)) return res.status(400).json({ mensagem: 'Dados da ausência inválidos.' });
  try {
    const docente = await Docente.findOne(docenteQuery(req.usuario)).select('_id').lean();
    const turma = docente && await turmaDoDocente(turmaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada entre suas turmas.' });
    const aula = turma.horarios.find(item => String(item.aulaId) === aulaId && String(item.docenteId) === String(docente._id));
    const agora = partesLocais();
    const janela = janelaSemestre();
    if (!aula || data < janela.inicio || data >= janela.fimExclusivo) return res.status(404).json({ mensagem: 'Aula não encontrada no semestre desta turma.' });
    if (new Date(`${data}T00:00:00.000Z`).getUTCDay() !== aula.dia) return res.status(400).json({ mensagem: 'A data informada não corresponde ao dia da aula.' });
    if (!aulaJaTerminou(data, aula.hora + 1, agora)) return res.status(403).json({ mensagem: 'Só é possível alterar a presença de aulas que já terminaram.' });
    const resultado = await Frequencia.updateOne({
      turmaId: turma._id, aulaId: aula.aulaId, data, docenteId: docente._id,
      registros: { $elemMatch: { alunoId, presente: false } }
    }, { $set: { 'registros.$.presente': true } });
    if (!resultado.modifiedCount) return res.status(409).json({ mensagem: 'Só é possível reverter uma ausência registrada; presenças não podem ser alteradas.' });
    res.json({ mensagem: 'Ausência revertida; a presença foi restaurada.' });
  } catch (erro) {
    console.error('Erro ao reverter ausência de aula passada:', erro);
    res.status(500).json({ mensagem: 'Não foi possível reverter a ausência.' });
  }
});

router.post('/turmas/:turmaId/chamada', async (req, res) => {
  const { aulaId, data, presencas } = req.body || {};
  if (!mongoose.isValidObjectId(req.params.turmaId) || !mongoose.isValidObjectId(aulaId) || !dataValida(data) || !Array.isArray(presencas)) return res.status(400).json({ mensagem: 'Dados da chamada inválidos.' });
  try {
    const docente = await Docente.findOne(docenteQuery(req.usuario)).select('_id').lean();
    const turma = docente && await turmaDoDocente(req.params.turmaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada entre suas turmas.' });
    const agora = partesLocais();
    if (data !== `${agora.year}-${agora.month}-${agora.day}`) return res.status(403).json({ mensagem: 'A chamada só pode ser registrada no dia da aula.' });
    const aula = turma.horarios.find(item => String(item.aulaId) === String(aulaId) && String(item.docenteId) === String(docente._id));
    const diaHoje = nomesDias.indexOf(agora.weekday);
    if (!aula || aula.dia !== diaHoje || minutosLocais(agora) < aula.hora * 60 || minutosLocais(agora) >= (aula.hora + 1) * 60) return res.status(403).json({ mensagem: 'A chamada só pode ser lançada durante o horário da aula.' });
    const alunos = await alunosDaTurma(turma, String(aula.disciplinaId?._id || aula.disciplinaId));
    const idsPermitidos = new Set(alunos.map(a => String(a._id)));
    if (presencas.some(item => !item || !mongoose.isValidObjectId(item.alunoId) || !idsPermitidos.has(String(item.alunoId)) || typeof item.presente !== 'boolean') || new Set(presencas.map(item => String(item.alunoId))).size !== presencas.length || presencas.length !== alunos.length) return res.status(400).json({ mensagem: 'Informe a presença de todos os alunos da turma.' });
    await Frequencia.findOneAndUpdate({ turmaId: turma._id, aulaId: aula.aulaId, data }, { $set: { docenteId: docente._id, disciplinaId: aula.disciplinaId._id || aula.disciplinaId, registros: presencas.map(item => ({ alunoId: item.alunoId, presente: item.presente })) } }, { upsert: true, new: true, runValidators: true });
    res.json({ mensagem: 'Chamada registrada.' });
  } catch (erro) {
    console.error('Erro ao registrar chamada:', erro);
    res.status(500).json({ mensagem: 'Não foi possível registrar a chamada.' });
  }
});

router.get('/turmas/:turmaId/aulas/:aulaId/historico', async (req, res) => {
  if (![req.params.turmaId, req.params.aulaId].every(mongoose.isValidObjectId)) return res.status(400).json({ mensagem: 'Turma ou aula inválida.' });
  try {
    const docente = await Docente.findOne(docenteQuery(req.usuario)).select('_id').lean();
    const turma = docente && await turmaDoDocente(req.params.turmaId, docente._id);
    if (!turma || !turma.horarios.some(item => String(item.aulaId) === req.params.aulaId && String(item.docenteId) === String(docente._id))) return res.status(404).json({ mensagem: 'Aula não encontrada entre suas aulas.' });
    const aula = turma.horarios.find(item => String(item.aulaId) === req.params.aulaId && String(item.docenteId) === String(docente._id));
    if (!aula) return res.status(404).json({ mensagem: 'Aula não encontrada entre suas aulas.' });
    const alunos = await alunosDaTurma(turma, String(aula.disciplinaId?._id || aula.disciplinaId));
    const registros = await Frequencia.find({ turmaId: turma._id, aulaId: req.params.aulaId, docenteId: docente._id, data: { $lt: partesLocais().year + '-' + partesLocais().month + '-' + partesLocais().day } }).sort({ data: -1 }).lean();
    res.json({ alunos: alunos.map(aluno => ({ id: String(aluno._id), nome: aluno.nome, faltas: registros.filter(s => s.registros.some(r => String(r.alunoId) === String(aluno._id) && !r.presente)).map(s => ({ data: s.data, aulaId: String(s.aulaId) })) })) });
  } catch (erro) {
    console.error('Erro ao carregar histórico de presença:', erro);
    res.status(500).json({ mensagem: 'Não foi possível carregar o histórico.' });
  }
});

router.delete('/turmas/:turmaId/aulas/:aulaId/faltas/:alunoId/:data', async (req, res) => {
  if (![req.params.turmaId, req.params.aulaId, req.params.alunoId].every(mongoose.isValidObjectId) || !dataValida(req.params.data)) return res.status(400).json({ mensagem: 'Dados da falta inválidos.' });
  try {
    const docente = await Docente.findOne(docenteQuery(req.usuario)).select('_id').lean();
    const turma = docente && await turmaDoDocente(req.params.turmaId, docente._id);
    if (!turma || !turma.horarios.some(item => String(item.aulaId) === req.params.aulaId && String(item.docenteId) === String(docente._id))) return res.status(404).json({ mensagem: 'Aula não encontrada entre suas aulas.' });
    const hoje = partesLocais();
    if (req.params.data >= `${hoje.year}-${hoje.month}-${hoje.day}`) return res.status(403).json({ mensagem: 'Só é possível remover faltas de aulas passadas.' });
    const resultado = await Frequencia.updateOne({ turmaId: turma._id, aulaId: req.params.aulaId, data: req.params.data, docenteId: docente._id }, { $pull: { registros: { alunoId: req.params.alunoId, presente: false } } });
    if (!resultado.modifiedCount) return res.status(404).json({ mensagem: 'Falta não encontrada.' });
    res.json({ mensagem: 'Ausência removida.' });
  } catch (erro) {
    console.error('Erro ao remover ausência:', erro);
    res.status(500).json({ mensagem: 'Não foi possível remover a ausência.' });
  }
});

module.exports = router;

