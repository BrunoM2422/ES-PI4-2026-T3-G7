// Autores: Luca Filippi — RA: 25022556
//Matheus Antony Lucas Lima RA:25013260
// Nícolas Mitjans Nunes - 25005124
const express = require('express');
const mongoose = require('mongoose');
const { autenticar } = require('../services/autenticacao');
const Estudante = require('../models/Estudante');
const Docente = require('../models/Docente');
const Turma = require('../models/Turma');
const ComponenteNota = require('../models/ComponenteNota');
const Nota = require('../models/Nota');
const ConfiguracaoNota = require('../models/ConfiguracaoNota');
const {
  mediasComFallback, calcularEPersistir, marcarDesatualizadas, removerMedias
} = require('../services/mediasNotas');

const router = express.Router();
const id = value => mongoose.isValidObjectId(value);

async function alunoDaSessao(usuario) {
  const filtros = [{ email: usuario.email }];
  if (usuario.ra) filtros.push({ ra: usuario.ra });
  return Estudante.findOne({ $or: filtros }).select('_id nome gradeMatriculas turmaId').lean();
}

async function docenteDaSessao(usuario) {
  const filtros = [{ email: usuario.email }];
  if (usuario.rp) filtros.push({ rp: usuario.rp });
  return Docente.findOne({ $or: filtros }).select('_id').lean();
}

async function turmaAutorizada(turmaId, disciplinaId, docenteId) {
  return Turma.findOne({ _id: turmaId, 'horarios.docenteId': docenteId, 'horarios.disciplinaId': disciplinaId })
    .select('codigo periodoLetivo horarios alunosIds').populate('horarios.disciplinaId', 'nome codigo').lean();
}

function mapearComponentes(componentes, notas = []) {
  const notaPorComponente = new Map(notas.map(nota => [String(nota.componenteId), nota]));
  return componentes.map(componente => {
    const nota = notaPorComponente.get(String(componente._id));
    return {
      id: String(componente._id), titulo: componente.titulo, valorMaximo: componente.valorMaximo,
      peso: componente.peso, tipoMedia: componente.tipoMedia || 'aritmetica', dataAplicacao: componente.dataAplicacao,
      valor: nota ? nota.valor : null,
      notaAtualizadaEm: nota ? (nota.updatedAt || nota.createdAt || null) : null
    };
  });
}

// Campos de média enviados ao front (media continua sendo um número ou null, como antes)
function camposDeMedia(info) {
  return {
    media: info ? info.media : null,
    mediaOrigem: info ? info.origem : null,            // 'java' (calculada agora) ou 'banco' (salva antes)
    mediaDesatualizada: info ? info.desatualizada : false,
    mediaCalculadaEm: info ? info.calculadaEm : null
  };
}

// Recalcula e salva as médias de um diário (turma + disciplina). Lança erro se o Java estiver offline.
async function recalcularMediasDoDiario(turmaId, disciplinaId) {
  const componentes = await ComponenteNota.find({ turmaId, disciplinaId }).sort({ createdAt: 1 }).lean();
  if (!componentes.length) return;

  const alunos = await Estudante.find({
    gradeMatriculas: { $elemMatch: { turmaId, disciplinaId } }
  }).select('_id').lean();
  if (!alunos.length) return;

  const configuracao = await ConfiguracaoNota.findOne({ turmaId, disciplinaId }).lean();
  const notas = await Nota.find({ turmaId, disciplinaId, alunoId: { $in: alunos.map(a => a._id) } }).lean();

  const componentesMapeados = componentes.map(c => ({
    id: String(c._id), titulo: c.titulo, valorMaximo: c.valorMaximo,
    tipoMedia: c.tipoMedia || 'aritmetica', peso: c.peso, dataAplicacao: c.dataAplicacao
  }));
  const alunosMapeados = alunos.map(aluno => ({
    id: String(aluno._id),
    componentes: mapearComponentes(componentes, notas.filter(n => String(n.alunoId) === String(aluno._id)))
  }));

  const tipo = configuracao?.tipoMedia || componentesMapeados[0].tipoMedia;
  await calcularEPersistir(turmaId, disciplinaId, tipo, componentesMapeados, alunosMapeados);
}

// Chamado quando notas ou componentes mudam: marca as médias salvas como desatualizadas
// e tenta recalculá-las em segundo plano (sem atrasar a resposta; se o Java estiver
// offline, elas ficam marcadas como desatualizadas até o próximo cálculo).
async function aposAlterarDiario(turmaId, disciplinaId) {
  try {
    await marcarDesatualizadas(turmaId, disciplinaId);
  } catch (erro) {
    console.error('Erro ao marcar médias como desatualizadas:', erro);
  }
  recalcularMediasDoDiario(turmaId, disciplinaId).catch(erro => {
    console.warn('Médias não recalculadas (servidor Java offline?):', erro.message);
  });
}

router.get('/aluno', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'aluno') return res.status(403).json({ mensagem: 'Acesso exclusivo de alunos.' });
  try {
    const aluno = await alunoDaSessao(req.usuario);
    if (!aluno) return res.status(404).json({ mensagem: 'Cadastro de aluno não encontrado.' });
    const matriculas = aluno.gradeMatriculas || [];
    const idsTurmas = matriculas.map(item => item.turmaId);
    const turmas = idsTurmas.length ? await Turma.find({ _id: { $in: idsTurmas } })
      .populate('horarios.disciplinaId', 'nome codigo').lean() : [];
    const disciplinas = matriculas.map(matricula => {
      const turma = turmas.find(item => String(item._id) === String(matricula.turmaId));
      const horario = turma?.horarios?.find(item => String(item.disciplinaId?._id || item.disciplinaId) === String(matricula.disciplinaId));
      return turma && horario ? { turmaId: turma._id, turma: turma.codigo, periodoLetivo: turma.periodoLetivo,
        disciplinaId: horario.disciplinaId._id, disciplina: horario.disciplinaId.nome, codigo: horario.disciplinaId.codigo } : null;
    }).filter(Boolean);

    const resultado = await Promise.all(disciplinas.map(async disciplina => {
      const componentes = await ComponenteNota.find({ turmaId: disciplina.turmaId, disciplinaId: disciplina.disciplinaId }).sort({ createdAt: 1 }).lean();
      const notas = componentes.length ? await Nota.find({ alunoId: aluno._id, componenteId: { $in: componentes.map(item => item._id) } }).lean() : [];
      const componentesMapeados = mapearComponentes(componentes, notas);

      let infoMedia = null;
      if (componentesMapeados.length) {
        try {
          const configuracao = await ConfiguracaoNota.findOne({ turmaId: disciplina.turmaId, disciplinaId: disciplina.disciplinaId }).lean();
          const tipo = configuracao?.tipoMedia || componentesMapeados[0].tipoMedia;
          // tenta o Java (e salva); se estiver offline, usa a média salva no banco
          const medias = await mediasComFallback(
            disciplina.turmaId, disciplina.disciplinaId, tipo, componentesMapeados,
            [{ id: String(aluno._id), componentes: componentesMapeados }]
          );
          infoMedia = medias.get(String(aluno._id)) || null;
        } catch (errMedia) {
          console.warn('Não foi possível obter a média do aluno:', errMedia.message);
        }
      }

      return { 
        id: String(disciplina.disciplinaId), ...disciplina, 
        turmaId: String(disciplina.turmaId), disciplinaId: String(disciplina.disciplinaId), 
        componentes: componentesMapeados,
        ...camposDeMedia(infoMedia)
      };
    }));

    return res.json({ disciplinas: resultado });
  } catch (erro) { 
    console.error('Erro ao carregar notas do aluno:', erro); 
    return res.status(500).json({ mensagem: 'Não foi possível carregar suas notas.' }); 
  }
});

router.get('/professor', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    if (!docente) return res.status(404).json({ mensagem: 'Perfil docente não encontrado.' });
    const turmas = await Turma.find({ 'horarios.docenteId': docente._id }).select('codigo periodoLetivo horarios alunosIds')
      .populate('horarios.disciplinaId', 'nome codigo').lean();
    const disciplinas = turmas.flatMap(turma => [...new Map((turma.horarios || [])
      .filter(item => String(item.docenteId) === String(docente._id))
      .map(item => [String(item.disciplinaId?._id || item.disciplinaId), item.disciplinaId])).values()]
      .map(disciplina => ({ id: String(disciplina._id), disciplinaId: String(disciplina._id), disciplina: disciplina.nome,
        codigo: disciplina.codigo, turmaId: String(turma._id), turma: turma.codigo, periodoLetivo: turma.periodoLetivo })));
    return res.json({ disciplinas });
  } catch (erro) { 
    console.error('Erro ao carregar disciplinas do docente:', erro); 
    return res.status(500).json({ mensagem: 'Não foi possível carregar suas disciplinas.' }); 
  }
});

router.get('/professor/pendencias', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    if (!docente) return res.status(404).json({ mensagem: 'Perfil docente não encontrado.' });

    const turmas = await Turma.find({ 'horarios.docenteId': docente._id }).select('horarios alunosIds').lean();

    // Diários (turma + disciplina) que o docente leciona e que já têm aluno matriculado
    const diarios = turmas
      .filter(turma => (turma.alunosIds || []).length > 0)
      .flatMap(turma => [...new Set((turma.horarios || [])
        .filter(item => String(item.docenteId) === String(docente._id))
        .map(item => String(item.disciplinaId)))]
        .map(disciplinaId => ({ turmaId: turma._id, disciplinaId })));

    // Diários que já têm pelo menos uma nota lançada
    const comNota = new Set();
    if (diarios.length) {
      const turmaIds = [...new Set(diarios.map(item => String(item.turmaId)))]
        .map(valor => new mongoose.Types.ObjectId(valor));
      const lancadas = await Nota.aggregate([
        { $match: { turmaId: { $in: turmaIds } } },
        { $group: { _id: { turmaId: '$turmaId', disciplinaId: '$disciplinaId' } } }
      ]);
      lancadas.forEach(item => comNota.add(`${item._id.turmaId}:${item._id.disciplinaId}`));
    }

    const pendentes = diarios.filter(item => !comNota.has(`${item.turmaId}:${item.disciplinaId}`));
    return res.json({
      turmasTotal: new Set(diarios.map(item => String(item.turmaId))).size,
      turmasPendentes: new Set(pendentes.map(item => String(item.turmaId))).size
    });
  } catch (erro) {
    console.error('Erro ao calcular avaliações pendentes:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível calcular as avaliações pendentes.' });
  }
});

router.get('/professor/:turmaId/:disciplinaId', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  if (!id(req.params.turmaId) || !id(req.params.disciplinaId)) return res.status(400).json({ mensagem: 'Turma ou disciplina inválida.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    const turma = docente && await turmaAutorizada(req.params.turmaId, req.params.disciplinaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Disciplina não encontrada entre suas turmas.' });
    const alunos = await Estudante.find({
      gradeMatriculas: { $elemMatch: { turmaId: turma._id, disciplinaId: req.params.disciplinaId } }
    }).select('_id nome ra statusAcademico').sort({ nome: 1 }).lean();
    const componentes = await ComponenteNota.find({ turmaId: turma._id, disciplinaId: req.params.disciplinaId }).sort({ createdAt: 1 }).lean();
    let configuracao = await ConfiguracaoNota.findOne({ turmaId: turma._id, disciplinaId: req.params.disciplinaId }).lean();
    if (!configuracao && componentes.length) {
      configuracao = await ConfiguracaoNota.findOneAndUpdate(
        { turmaId: turma._id, disciplinaId: req.params.disciplinaId },
        { $setOnInsert: { docenteId: docente._id, tipoMedia: componentes[0].tipoMedia || 'aritmetica' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
    }
    const notas = componentes.length ? await Nota.find({ turmaId: turma._id, disciplinaId: req.params.disciplinaId, alunoId: { $in: alunos.map(a => a._id) } }).lean() : [];

    const componentesMapeados = componentes.map(c => ({ 
      id: String(c._id), titulo: c.titulo, valorMaximo: c.valorMaximo, 
      tipoMedia: c.tipoMedia || 'aritmetica', peso: c.peso, dataAplicacao: c.dataAplicacao 
    }));

    const alunosMapeados = alunos.map(aluno => ({ 
      id: String(aluno._id), nome: aluno.nome, ra: aluno.ra || '', 
      statusAcademico: aluno.statusAcademico || 'ativo', 
      componentes: mapearComponentes(componentes, notas.filter(n => String(n.alunoId) === String(aluno._id))) 
    }));

    // tenta o Java (e salva no banco); se estiver offline, usa as médias salvas
    let medias = new Map();
    if (componentesMapeados.length && alunosMapeados.length) {
      const tipo = configuracao?.tipoMedia || componentesMapeados[0].tipoMedia;
      medias = await mediasComFallback(turma._id, req.params.disciplinaId, tipo, componentesMapeados, alunosMapeados);
    }

    const alunosComMedia = alunosMapeados.map(aluno => ({
      ...aluno,
      ...camposDeMedia(medias.get(aluno.id))
    }));

    return res.json({ 
      turma: turma.codigo, 
      disciplina: turma.horarios.find(item => String(item.disciplinaId?._id) === req.params.disciplinaId)?.disciplinaId?.nome || '',
      configuracao: configuracao ? { tipoMedia: configuracao.tipoMedia } : null,
      componentes: componentesMapeados,
      mediasDoBanco: alunosComMedia.some(aluno => aluno.mediaOrigem === 'banco'),
      alunos: alunosComMedia 
    });
  } catch (erro) { 
    console.error('Erro ao carregar diário de notas:', erro); 
    return res.status(500).json({ mensagem: 'Não foi possível carregar o diário de notas.' }); 
  }
});

router.post('/professor/:turmaId/:disciplinaId/configuracao', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  if (!id(req.params.turmaId) || !id(req.params.disciplinaId)) return res.status(400).json({ mensagem: 'Turma ou disciplina inválida.' });
  const tipoMedia = ['aritmetica', 'ponderada'].includes(req.body.tipoMedia) ? req.body.tipoMedia : null;
  if (!tipoMedia) return res.status(400).json({ mensagem: 'Escolha média aritmética ou ponderada.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    const turma = docente && await turmaAutorizada(req.params.turmaId, req.params.disciplinaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Disciplina não encontrada entre suas turmas.' });
    const componentes = await ComponenteNota.find({ turmaId: turma._id, disciplinaId: req.params.disciplinaId }).select('tipoMedia').limit(1).lean();
    const valorInicial = componentes[0]?.tipoMedia || tipoMedia;
    try {
      const configuracao = await ConfiguracaoNota.create({ turmaId: turma._id, disciplinaId: req.params.disciplinaId, docenteId: docente._id, tipoMedia: valorInicial });
      if (valorInicial !== tipoMedia) return res.status(409).json({ mensagem: `O tipo de média desta disciplina já está definido como ${valorInicial === 'aritmetica' ? 'aritmética' : 'ponderada'}.`, configuracao: { tipoMedia: valorInicial } });
      return res.status(201).json({ mensagem: 'Tipo de média definido e bloqueado para esta disciplina.', configuracao: { tipoMedia: configuracao.tipoMedia } });
    } catch (erro) {
      if (erro.code !== 11000) throw erro;
      const configuracao = await ConfiguracaoNota.findOne({ turmaId: turma._id, disciplinaId: req.params.disciplinaId }).lean();
      return res.status(409).json({ mensagem: `O tipo de média desta disciplina já está definido como ${configuracao?.tipoMedia === 'ponderada' ? 'ponderada' : 'aritmética'}.`, configuracao: configuracao ? { tipoMedia: configuracao.tipoMedia } : null });
    }
  } catch (erro) { 
    console.error('Erro ao definir tipo de média:', erro); 
    return res.status(500).json({ mensagem: 'Não foi possível definir o tipo de média.' }); 
  }
});

router.post('/professor/:turmaId/:disciplinaId/componentes', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  if (!id(req.params.turmaId) || !id(req.params.disciplinaId)) return res.status(400).json({ mensagem: 'Turma ou disciplina inválida.' });
  const titulo = typeof req.body.titulo === 'string' ? req.body.titulo.trim() : '';
  const valorMaximo = Number(req.body.valorMaximo); const tipoMedia = req.body.tipoMedia === 'ponderada' ? 'ponderada' : req.body.tipoMedia === 'aritmetica' ? 'aritmetica' : null;
  const peso = tipoMedia === 'ponderada' ? Number(req.body.peso) : 1;
  if (!titulo || titulo.length > 80 || !Number.isFinite(valorMaximo) || valorMaximo <= 0 || valorMaximo > 100 || !tipoMedia || !Number.isFinite(peso) || peso <= 0 || peso > 100) return res.status(400).json({ mensagem: 'Informe nome, valor máximo, tipo de média e peso válidos.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    const turma = docente && await turmaAutorizada(req.params.turmaId, req.params.disciplinaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Disciplina não encontrada entre suas turmas.' });
    const configuracao = await ConfiguracaoNota.findOne({ turmaId: turma._id, disciplinaId: req.params.disciplinaId }).lean();
    if (!configuracao || configuracao.tipoMedia !== tipoMedia) return res.status(409).json({ mensagem: 'Defina o tipo de média da disciplina antes de criar componentes. Essa escolha não poderá ser alterada.' });
    const componente = await ComponenteNota.create({ turmaId: turma._id, disciplinaId: req.params.disciplinaId, docenteId: docente._id, titulo, valorMaximo, tipoMedia, peso,
      dataAplicacao: req.body.dataAplicacao ? new Date(req.body.dataAplicacao) : null });
    await aposAlterarDiario(turma._id, req.params.disciplinaId);
    return res.status(201).json({ mensagem: 'Componente criado.', componente: { id: String(componente._id), titulo, valorMaximo, tipoMedia, peso } });
  } catch (erro) {
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Já existe um componente com esse nome nesta disciplina.' });
    console.error('Erro ao criar componente de nota:', erro); 
    return res.status(500).json({ mensagem: 'Não foi possível criar o componente.' });
  }
});

router.put('/professor/:turmaId/:disciplinaId/componentes/:componenteId', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  if (![req.params.turmaId, req.params.disciplinaId, req.params.componenteId].every(id)) return res.status(400).json({ mensagem: 'Turma, disciplina ou componente inválido.' });
  const titulo = typeof req.body.titulo === 'string' ? req.body.titulo.trim() : '';
  const valorMaximo = Number(req.body.valorMaximo);
  const peso = Number(req.body.peso);
  if (!titulo || titulo.length > 80 || !Number.isFinite(valorMaximo) || valorMaximo <= 0 || valorMaximo > 100 || !Number.isFinite(peso) || peso <= 0 || peso > 100) return res.status(400).json({ mensagem: 'Informe nome, valor máximo e peso válidos.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    const turma = docente && await turmaAutorizada(req.params.turmaId, req.params.disciplinaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Disciplina não encontrada entre suas turmas.' });
    const componente = await ComponenteNota.findOne({ _id: req.params.componenteId, turmaId: turma._id, disciplinaId: req.params.disciplinaId });
    if (!componente) return res.status(404).json({ mensagem: 'Componente não encontrado.' });
    const notaAcimaDoNovoMaximo = await Nota.exists({ componenteId: componente._id, valor: { $gt: valorMaximo } });
    if (notaAcimaDoNovoMaximo) return res.status(409).json({ mensagem: 'O valor máximo não pode ser menor que uma nota já lançada.' });
    componente.titulo = titulo;
    componente.valorMaximo = valorMaximo;
    componente.peso = peso;
    await componente.save();
    await aposAlterarDiario(turma._id, req.params.disciplinaId);
    return res.json({ mensagem: 'Componente atualizado.', componente: { id: String(componente._id), titulo, valorMaximo, peso, tipoMedia: componente.tipoMedia } });
  } catch (erro) {
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Já existe um componente com esse nome nesta disciplina.' });
    console.error('Erro ao atualizar componente de nota:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível atualizar o componente.' });
  }
});

router.delete('/professor/:turmaId/:disciplinaId/componentes/:componenteId', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  if (![req.params.turmaId, req.params.disciplinaId, req.params.componenteId].every(id)) return res.status(400).json({ mensagem: 'Turma, disciplina ou componente inválido.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    const turma = docente && await turmaAutorizada(req.params.turmaId, req.params.disciplinaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Disciplina não encontrada entre suas turmas.' });
    const componente = await ComponenteNota.findOneAndDelete({ _id: req.params.componenteId, turmaId: turma._id, disciplinaId: req.params.disciplinaId });
    if (!componente) return res.status(404).json({ mensagem: 'Componente não encontrado.' });
    await Nota.deleteMany({ componenteId: componente._id, turmaId: turma._id, disciplinaId: req.params.disciplinaId });
    const componentesRestantes = await ComponenteNota.exists({ turmaId: turma._id, disciplinaId: req.params.disciplinaId });
    if (!componentesRestantes) {
      await ConfiguracaoNota.deleteOne({ turmaId: turma._id, disciplinaId: req.params.disciplinaId });
      await removerMedias(turma._id, req.params.disciplinaId);
    } else {
      await aposAlterarDiario(turma._id, req.params.disciplinaId);
    }
    return res.json({ mensagem: 'Componente e notas associadas excluídos.' });
  } catch (erro) {
    console.error('Erro ao excluir componente de nota:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível excluir o componente.' });
  }
});

router.put('/professor/:turmaId/:disciplinaId/notas', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  if (!id(req.params.turmaId) || !id(req.params.disciplinaId)) return res.status(400).json({ mensagem: 'Turma ou disciplina inválida.' });
  if (!Array.isArray(req.body.notas) || req.body.notas.length > 5000) return res.status(400).json({ mensagem: 'Lista de notas inválida.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    const turma = docente && await turmaAutorizada(req.params.turmaId, req.params.disciplinaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Disciplina não encontrada entre suas turmas.' });
    const alunos = await Estudante.find({
      gradeMatriculas: { $elemMatch: { turmaId: turma._id, disciplinaId: req.params.disciplinaId } }
    }).select('_id nome').lean();
    const alunosPorId = new Map(alunos.map(aluno => [String(aluno._id), aluno]));
    const componentes = await ComponenteNota.find({ turmaId: turma._id, disciplinaId: req.params.disciplinaId }).select('_id titulo valorMaximo').lean();
    const componentesPorId = new Map(componentes.map(componente => [String(componente._id), componente]));
    const existentes = await Nota.find({ turmaId: turma._id, disciplinaId: req.params.disciplinaId }).select('alunoId componenteId valor').lean();
    const valoresAtuais = new Map(existentes.map(n => [`${n.alunoId}:${n.componenteId}`, n.valor]));
    const operacoes = [];
    const detalhes = [];
    const formatoNota = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 20 });
    const exibirNota = valor => valor == null ? 'sem nota' : formatoNota.format(valor);
    for (const item of req.body.notas) {
      const aluno = alunosPorId.get(String(item.alunoId));
      const componente = componentesPorId.get(String(item.componenteId));
      if (!id(item.alunoId) || !aluno || !componente) return res.status(400).json({ mensagem: 'Uma nota referencia aluno ou componente inválido.' });
      const maximo = componente.valorMaximo;
      if (item.valor !== null && item.valor !== '' && (!Number.isFinite(Number(item.valor)) || Number(item.valor) < 0 || Number(item.valor) > maximo)) return res.status(400).json({ mensagem: `As notas devem estar entre 0 e ${maximo}.` });
      const filtro = { alunoId: item.alunoId, componenteId: item.componenteId };
      const valor = item.valor === null || item.valor === '' ? null : Number(item.valor);
      const chave = `${item.alunoId}:${item.componenteId}`;
      const atual = valoresAtuais.get(chave) ?? null;
      if (valor === atual) continue;
      if (valor === null) operacoes.push({ deleteOne: { filter: filtro } });
      else operacoes.push({ updateOne: { filter: filtro, update: { $set: { ...filtro, turmaId: turma._id, disciplinaId: req.params.disciplinaId, valor } }, upsert: true } });
      detalhes.push(`${aluno.nome} — ${componente.titulo}: ${exibirNota(atual)} → ${exibirNota(valor)}`);
      valoresAtuais.set(chave, valor);
    }
    const dados = { mensagem: 'Notas salvas no banco de dados.', salvas: req.body.notas.length, alteracoes: 0 };
    if (!operacoes.length) return res.json(dados);
    const resultado = await Nota.bulkWrite(operacoes, { ordered: true });
    dados.alteracoes = resultado.upsertedCount + resultado.modifiedCount + resultado.deletedCount;
    if (!dados.alteracoes) return res.json(dados);
    await aposAlterarDiario(turma._id, req.params.disciplinaId);
    const disciplina = turma.horarios.find(item => String(item.disciplinaId?._id || item.disciplinaId) === req.params.disciplinaId)?.disciplinaId;
    return responderComLog(req, res, dados, 'Notas', [
      `Turma: ${turma.codigo || turma._id}`,
      `Disciplina: ${disciplina?.nome || req.params.disciplinaId}`,
      `Notas lançadas: ${resultado.upsertedCount}`,
      `Notas atualizadas: ${resultado.modifiedCount}`,
      `Notas removidas: ${resultado.deletedCount}`,
      ...detalhes
    ], 'Lançamento de notas salvo');
  } catch (erro) { 
    console.error('Erro ao salvar notas:', erro); 
    return res.status(500).json({ mensagem: 'Não foi possível salvar as notas.' }); 
  }
});

module.exports = router;
