const express = require('express');
const mongoose = require('mongoose');
const { autenticar } = require('../services/autenticacao');
const Estudante = require('../models/Estudante');
const Docente = require('../models/Docente');
const Turma = require('../models/Turma');
const ComponenteNota = require('../models/ComponenteNota');
const Nota = require('../models/Nota');
const ConfiguracaoNota = require('../models/ConfiguracaoNota');
const { calcularMediasNoJava } = require('../services/calculadoraJava');

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
  const notaPorComponente = new Map(notas.map(nota => [String(nota.componenteId), nota.valor]));
  return componentes.map(componente => ({
    id: String(componente._id), titulo: componente.titulo, valorMaximo: componente.valorMaximo,
    peso: componente.peso, tipoMedia: componente.tipoMedia || 'aritmetica', dataAplicacao: componente.dataAplicacao,
    valor: notaPorComponente.has(String(componente._id)) ? notaPorComponente.get(String(componente._id)) : null
  }));
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

      let mediaAluno = null;
      if (componentesMapeados.length) {
        try {
          const configuracao = await ConfiguracaoNota.findOne({ turmaId: disciplina.turmaId, disciplinaId: disciplina.disciplinaId }).lean();
          const tipo = configuracao?.tipoMedia || componentesMapeados[0].tipoMedia;
          const mediasJava = await calcularMediasNoJava(tipo, componentesMapeados, [{ id: String(aluno._id), componentes: componentesMapeados }]);
          mediaAluno = mediasJava.get(String(aluno._id)) ?? null;
        } catch (errJava) {
          console.warn('Servidor Java offline ou erro no cálculo do aluno:', errJava.message);
        }
      }

      return { 
        id: String(disciplina.disciplinaId), ...disciplina, 
        turmaId: String(disciplina.turmaId), disciplinaId: String(disciplina.disciplinaId), 
        componentes: componentesMapeados,
        media: mediaAluno
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

router.get('/professor/:turmaId/:disciplinaId', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Acesso exclusivo de docentes.' });
  if (!id(req.params.turmaId) || !id(req.params.disciplinaId)) return res.status(400).json({ mensagem: 'Turma ou disciplina inválida.' });
  try {
    const docente = await docenteDaSessao(req.usuario);
    const turma = docente && await turmaAutorizada(req.params.turmaId, req.params.disciplinaId, docente._id);
    if (!turma) return res.status(404).json({ mensagem: 'Disciplina não encontrada entre suas turmas.' });
    const idsAlunos = new Set((turma.alunosIds || []).map(item => String(item._id || item)));
    const matriculados = await Estudante.find({ 'gradeMatriculas.turmaId': turma._id }).select('_id nome ra statusAcademico').sort({ nome: 1 }).lean();
    matriculados.forEach(aluno => idsAlunos.add(String(aluno._id)));
    const alunos = idsAlunos.size ? await Estudante.find({ _id: { $in: [...idsAlunos] } }).select('_id nome ra statusAcademico').sort({ nome: 1 }).lean() : [];
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

    let mediasJava = new Map();
    if (componentesMapeados.length && alunosMapeados.length) {
      try {
        const tipo = configuracao?.tipoMedia || componentesMapeados[0].tipoMedia;
        mediasJava = await calcularMediasNoJava(tipo, componentesMapeados, alunosMapeados);
      } catch (errJava) {
        console.warn('Servidor Java offline ou erro no cálculo:', errJava.message);
      }
    }

    const alunosComMedia = alunosMapeados.map(aluno => ({
      ...aluno,
      media: mediasJava.has(aluno.id) ? mediasJava.get(aluno.id) : null
    }));

    return res.json({ 
      turma: turma.codigo, 
      disciplina: turma.horarios.find(item => String(item.disciplinaId?._id) === req.params.disciplinaId)?.disciplinaId?.nome || '',
      configuracao: configuracao ? { tipoMedia: configuracao.tipoMedia } : null,
      componentes: componentesMapeados,
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
    return res.status(201).json({ mensagem: 'Componente criado.', componente: { id: String(componente._id), titulo, valorMaximo, tipoMedia, peso } });
  } catch (erro) {
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Já existe um componente com esse nome nesta disciplina.' });
    console.error('Erro ao criar componente de nota:', erro); 
    return res.status(500).json({ mensagem: 'Não foi possível criar o componente.' });
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
    const alunos = await Estudante.find({ 'gradeMatriculas.turmaId': turma._id }).select('_id').lean();
    const idsPermitidos = new Set(alunos.map(a => String(a._id)));
    (turma.alunosIds || []).forEach(aluno => idsPermitidos.add(String(aluno._id || aluno)));
    const componentes = await ComponenteNota.find({ turmaId: turma._id, disciplinaId: req.params.disciplinaId }).select('_id valorMaximo').lean();
    const maximos = new Map(componentes.map(c => [String(c._id), c.valorMaximo]));
    const operacoes = [];
    for (const item of req.body.notas) {
      const maximo = maximos.get(String(item.componenteId));
      if (!id(item.alunoId) || maximo === undefined || !idsPermitidos.has(String(item.alunoId))) return res.status(400).json({ mensagem: 'Uma nota referencia aluno ou componente inválido.' });
      if (item.valor !== null && item.valor !== '' && (!Number.isFinite(Number(item.valor)) || Number(item.valor) < 0 || Number(item.valor) > maximo)) return res.status(400).json({ mensagem: `As notas devem estar entre 0 e ${maximo}.` });
      const filtro = { alunoId: item.alunoId, componenteId: item.componenteId };
      const valor = item.valor === null || item.valor === '' ? null : Number(item.valor);
      if (valor === null) operacoes.push({ deleteOne: { filter: filtro } });
      else operacoes.push({ updateOne: { filter: filtro, update: { $set: { ...filtro, turmaId: turma._id, disciplinaId: req.params.disciplinaId, valor } }, upsert: true } });
    }
    if (operacoes.length) await Nota.bulkWrite(operacoes, { ordered: true });
    return res.json({ mensagem: 'Notas salvas no banco de dados.', salvas: req.body.notas.length });
  } catch (erro) { 
    console.error('Erro ao salvar notas:', erro); 
    return res.status(500).json({ mensagem: 'Não foi possível salvar as notas.' }); 
  }
});

module.exports = router;