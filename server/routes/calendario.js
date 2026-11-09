const express = require('express');
const mongoose = require('mongoose');
const Evento = require('../models/Evento');
const Estudante = require('../models/Estudante');
const Docente = require('../models/Docente');
const Turma = require('../models/Turma');
const { autenticar } = require('../services/autenticacao');

const router = express.Router();
const categoriasPorPapel = {
  admin: ['feriado', 'institucional'],
  professor: ['aula', 'atividade'],
  aluno: ['avaliacao', 'compromisso']
};

function filtroPerfil(usuario, papel) {
  const filtros = [{ email: usuario.email }];
  const identificador = papel === 'professor' ? usuario.rp : usuario.ra;
  const campoIdentificador = papel === 'professor' ? 'rp' : 'ra';
  if (identificador) filtros.push({ [campoIdentificador]: identificador });
  return { $or: filtros };
}

function dataAtualDoCalendario() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

function dataValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  const dataUtc = new Date(Date.UTC(ano, mes - 1, dia));
  return dataUtc.toISOString().slice(0, 10) === data;
}

function validarEvento(dados, papel) {
  const { title, date, category, start, end, location, description } = dados;
  const categoriasPermitidas = categoriasPorPapel[papel] || [];
  if (
    typeof title !== 'string' || !title.trim() || title.trim().length > 90 ||
    !dataValida(date) || !categoriasPermitidas.includes(category) ||
    (location !== undefined && (typeof location !== 'string' || location.length > 100)) ||
    (description !== undefined && (typeof description !== 'string' || description.length > 400))
  ) {
    return 'Preencha os campos obrigatórios com valores válidos.';
  }

  if (category === 'institucional') {
    const horarioValido = horario => typeof horario === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(horario);
    if (!horarioValido(start) || !horarioValido(end) || end <= start) {
      return 'Eventos institucionais precisam de início e término válidos, com término posterior ao início.';
    }
  }

  return null;
}

function formatarEvento(evento, usuario) {
  return {
    id: String(evento._id),
    title: evento.title,
    date: evento.date,
    category: evento.category,
    scope: evento.scope,
    turmaId: evento.turmaId ? String(evento.turmaId) : null,
    canManage: evento.scope === 'global'
      ? usuario.papel === 'admin'
      : String(evento.createdBy || '') === usuario.id,
    start: evento.start || '',
    end: evento.end || '',
    location: evento.location || '',
    description: evento.description || ''
  };
}

router.get('/minhas-turmas', autenticar, async (req, res) => {
  if (req.usuario.papel !== 'professor') {
    return res.status(403).json({ mensagem: 'Apenas docentes podem consultar suas turmas.' });
  }
  try {
    const docente = await Docente.findOne(filtroPerfil(req.usuario, 'professor')).select('_id');
    if (!docente) return res.status(404).json({ mensagem: 'Perfil docente não encontrado.' });
    const turmas = await Turma.find({ 'horarios.docenteId': docente._id })
      .select('codigo periodoLetivo')
      .sort({ codigo: 1 })
      .lean();
    return res.json({ turmas: turmas.map(turma => ({ id: String(turma._id), codigo: turma.codigo, periodoLetivo: turma.periodoLetivo })) });
  } catch (erro) {
    console.error('Erro ao carregar turmas do docente:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar suas turmas.' });
  }
});

router.get('/eventos', autenticar, async (req, res) => {
  try {
    let filtro = { scope: 'global' };
    if (req.usuario.papel === 'professor') {
      filtro = { $or: [{ scope: 'global' }, { createdBy: req.usuario.id }] };
    } else if (req.usuario.papel === 'aluno') {
      const estudante = await Estudante.findOne(filtroPerfil(req.usuario, 'aluno')).select('turmaId').lean();
      const permissoes = [{ scope: 'global' }, { scope: 'privado', createdBy: req.usuario.id }];
      if (estudante?.turmaId) permissoes.push({ scope: 'turma', turmaId: estudante.turmaId });
      filtro = { $or: permissoes };
    }
    const eventos = await Evento.find(filtro).sort({ date: 1, start: 1 }).lean();
    return res.json({ eventos: eventos.map(evento => formatarEvento(evento, req.usuario)) });
  } catch (erro) {
    console.error('Erro ao carregar eventos do calendário:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar os eventos.' });
  }
});

router.post('/eventos/migrar-legado', autenticar, async (req, res) => {
  try {
    const eventosLegados = req.body.eventos;
    if (!Array.isArray(eventosLegados) || eventosLegados.length > 200) {
      return res.status(400).json({ mensagem: 'A lista de eventos antigos é inválida.' });
    }

    let importados = 0;
    for (const legado of eventosLegados) {
      if (typeof legado.legacyKey !== 'string' || !legado.legacyKey || legado.legacyKey.length > 250) continue;
      const categoriaLegada = req.usuario.papel === 'admin'
        ? (legado.category === 'feriado' ? 'feriado' : 'institucional')
        : req.usuario.papel === 'professor'
          ? 'atividade'
          : 'compromisso';
      const eventoLegado = { ...legado, category: categoriaLegada };
      if (validarEvento(eventoLegado, req.usuario.papel)) continue;

      const feriado = categoriaLegada === 'feriado';
      await Evento.findOneAndUpdate(
        { legacyKey: legado.legacyKey },
        { $setOnInsert: {
          legacyKey: legado.legacyKey,
          scope: req.usuario.papel === 'admin' ? 'global' : 'privado',
          createdBy: req.usuario.id,
          title: legado.title.trim(),
          date: legado.date,
          category: categoriaLegada,
          start: feriado ? '' : legado.start,
          end: feriado ? '' : legado.end,
          location: feriado ? '' : (legado.location || '').trim(),
          description: (legado.description || '').trim()
        } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      importados += 1;
    }

    return res.json({ mensagem: 'Migração dos eventos antigos concluída.', importados });
  } catch (erro) {
    console.error('Erro ao migrar eventos antigos:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível migrar os eventos antigos.' });
  }
});

router.post('/eventos', autenticar, async (req, res) => {
  try {
    const erroValidacao = validarEvento(req.body, req.usuario.papel);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    if (req.body.date < dataAtualDoCalendario()) {
      return res.status(400).json({ mensagem: 'Não é possível criar eventos em datas passadas.' });
    }

    let scope;
    let turmaId = null;
    if (req.usuario.papel === 'admin') {
      scope = 'global';
    } else if (req.usuario.papel === 'professor') {
      if (!mongoose.isValidObjectId(req.body.turmaId)) {
        return res.status(400).json({ mensagem: 'Selecione uma turma válida para compartilhar o evento.' });
      }
      const docente = await Docente.findOne(filtroPerfil(req.usuario, 'professor')).select('_id');
      if (!docente) return res.status(404).json({ mensagem: 'Perfil docente não encontrado.' });
      const turma = await Turma.findOne({ _id: req.body.turmaId, 'horarios.docenteId': docente._id }).select('_id');
      if (!turma) return res.status(403).json({ mensagem: 'Você não está alocado a essa turma.' });
      scope = 'turma';
      turmaId = turma._id;
    } else {
      scope = 'privado';
    }

    const feriado = req.body.category === 'feriado';
    const evento = await Evento.create({
      title: req.body.title.trim(),
      date: req.body.date,
      category: req.body.category,
      scope,
      createdBy: req.usuario.id,
      turmaId,
      start: feriado ? '' : req.body.start,
      end: feriado ? '' : req.body.end,
      location: feriado ? '' : (req.body.location || '').trim(),
      description: (req.body.description || '').trim()
    });
    return res.status(201).json({ mensagem: 'Evento salvo no calendário.', evento: formatarEvento(evento, req.usuario) });
  } catch (erro) {
    console.error('Erro ao criar evento de calendário:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível salvar o evento.' });
  }
});

router.put('/eventos/:eventoId', autenticar, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventoId)) {
      return res.status(400).json({ mensagem: 'O evento informado é inválido.' });
    }
    const existente = await Evento.findById(req.params.eventoId);
    if (!existente) return res.status(404).json({ mensagem: 'Evento não encontrado.' });
    const podeGerenciar = existente.scope === 'global'
      ? req.usuario.papel === 'admin'
      : String(existente.createdBy || '') === req.usuario.id;
    if (!podeGerenciar) return res.status(403).json({ mensagem: 'Você não tem permissão para editar este evento.' });

    const erroValidacao = validarEvento(req.body, req.usuario.papel);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    if (req.body.date < dataAtualDoCalendario() && req.body.date !== existente.date) {
      return res.status(400).json({ mensagem: 'Não é possível mover um evento para uma data passada.' });
    }

    let turmaId = existente.turmaId || null;
    if (existente.scope === 'turma' && req.usuario.papel === 'professor') {
      const turmaSolicitada = req.body.turmaId || turmaId;
      if (!mongoose.isValidObjectId(turmaSolicitada)) {
        return res.status(400).json({ mensagem: 'Selecione uma turma válida para o evento.' });
      }
      const docente = await Docente.findOne(filtroPerfil(req.usuario, 'professor')).select('_id');
      const turma = docente && await Turma.findOne({ _id: turmaSolicitada, 'horarios.docenteId': docente._id }).select('_id');
      if (!turma) return res.status(403).json({ mensagem: 'Você não está alocado a essa turma.' });
      turmaId = turma._id;
    }

    const feriado = req.body.category === 'feriado';
    existente.title = req.body.title.trim();
    existente.date = req.body.date;
    existente.category = req.body.category;
    existente.turmaId = turmaId;
    existente.start = feriado ? '' : req.body.start;
    existente.end = feriado ? '' : req.body.end;
    existente.location = feriado ? '' : (req.body.location || '').trim();
    existente.description = (req.body.description || '').trim();
    await existente.save();

    return res.json({ mensagem: 'Evento atualizado.', evento: formatarEvento(existente, req.usuario) });
  } catch (erro) {
    console.error('Erro ao atualizar evento de calendário:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível atualizar o evento.' });
  }
});

router.delete('/eventos/:eventoId', autenticar, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventoId)) {
      return res.status(400).json({ mensagem: 'O evento informado é inválido.' });
    }
    const evento = await Evento.findById(req.params.eventoId);
    if (!evento) return res.status(404).json({ mensagem: 'Evento não encontrado.' });
    const podeGerenciar = evento.scope === 'global'
      ? req.usuario.papel === 'admin'
      : String(evento.createdBy || '') === req.usuario.id;
    if (!podeGerenciar) return res.status(403).json({ mensagem: 'Você não tem permissão para excluir este evento.' });
    await evento.deleteOne();
    return res.json({ mensagem: 'Evento excluído do calendário.' });
  } catch (erro) {
    console.error('Erro ao excluir evento de calendário:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível excluir o evento.' });
  }
});

module.exports = router;
