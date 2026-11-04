const express = require('express');
const mongoose = require('mongoose');
const Evento = require('../models/Evento');

const router = express.Router();
const categoriasValidas = ['feriado', 'institucional'];

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

function validarEvento(dados) {
  const { title, date, category, start, end, location, description } = dados;
  if (
    typeof title !== 'string' || !title.trim() || title.trim().length > 90 ||
    !dataValida(date) || !categoriasValidas.includes(category) ||
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

function formatarEvento(evento) {
  return {
    id: String(evento._id),
    title: evento.title,
    date: evento.date,
    category: evento.category,
    start: evento.start || '',
    end: evento.end || '',
    location: evento.location || '',
    description: evento.description || ''
  };
}

router.get('/eventos', async (req, res) => {
  try {
    const eventos = await Evento.find().sort({ date: 1, start: 1 }).lean();
    return res.json({ eventos: eventos.map(formatarEvento) });
  } catch (erro) {
    console.error('Erro ao carregar eventos do calendário:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar os eventos.' });
  }
});

router.post('/eventos/migrar-legado', async (req, res) => {
  try {
    const eventosLegados = req.body.eventos;
    if (!Array.isArray(eventosLegados) || eventosLegados.length > 200) {
      return res.status(400).json({ mensagem: 'A lista de eventos antigos é inválida.' });
    }

    let importados = 0;
    for (const legado of eventosLegados) {
      if (typeof legado.legacyKey !== 'string' || !legado.legacyKey || legado.legacyKey.length > 250) continue;
      if (validarEvento(legado)) continue;

      const feriado = legado.category === 'feriado';
      await Evento.findOneAndUpdate(
        { legacyKey: legado.legacyKey },
        { $setOnInsert: {
          legacyKey: legado.legacyKey,
          title: legado.title.trim(),
          date: legado.date,
          category: legado.category,
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

router.post('/eventos', async (req, res) => {
  try {
    const erroValidacao = validarEvento(req.body);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    if (req.body.date < dataAtualDoCalendario()) {
      return res.status(400).json({ mensagem: 'Não é possível criar eventos em datas passadas.' });
    }

    const feriado = req.body.category === 'feriado';
    const evento = await Evento.create({
      title: req.body.title.trim(),
      date: req.body.date,
      category: req.body.category,
      start: feriado ? '' : req.body.start,
      end: feriado ? '' : req.body.end,
      location: feriado ? '' : (req.body.location || '').trim(),
      description: (req.body.description || '').trim()
    });
    return res.status(201).json({ mensagem: 'Evento salvo no calendário.', evento: formatarEvento(evento) });
  } catch (erro) {
    console.error('Erro ao criar evento de calendário:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível salvar o evento.' });
  }
});

router.put('/eventos/:eventoId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventoId)) {
      return res.status(400).json({ mensagem: 'O evento informado é inválido.' });
    }
    const existente = await Evento.findById(req.params.eventoId);
    if (!existente) return res.status(404).json({ mensagem: 'Evento não encontrado.' });

    const erroValidacao = validarEvento(req.body);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    if (req.body.date < dataAtualDoCalendario() && req.body.date !== existente.date) {
      return res.status(400).json({ mensagem: 'Não é possível mover um evento para uma data passada.' });
    }

    const feriado = req.body.category === 'feriado';
    existente.title = req.body.title.trim();
    existente.date = req.body.date;
    existente.category = req.body.category;
    existente.start = feriado ? '' : req.body.start;
    existente.end = feriado ? '' : req.body.end;
    existente.location = feriado ? '' : (req.body.location || '').trim();
    existente.description = (req.body.description || '').trim();
    await existente.save();

    return res.json({ mensagem: 'Evento atualizado.', evento: formatarEvento(existente) });
  } catch (erro) {
    console.error('Erro ao atualizar evento de calendário:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível atualizar o evento.' });
  }
});

router.delete('/eventos/:eventoId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventoId)) {
      return res.status(400).json({ mensagem: 'O evento informado é inválido.' });
    }
    const resultado = await Evento.findByIdAndDelete(req.params.eventoId);
    if (!resultado) return res.status(404).json({ mensagem: 'Evento não encontrado.' });
    return res.json({ mensagem: 'Evento excluído do calendário.' });
  } catch (erro) {
    console.error('Erro ao excluir evento de calendário:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível excluir o evento.' });
  }
});

module.exports = router;
