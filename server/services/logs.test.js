// Autores: Luca Filippi — RA: 25022556
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Log = require('../models/Log');
const Evento = require('../models/Evento');
const { auditar } = require('./logs');

test('audita alterações do calendário do professor somente após sucesso', async () => {
  const criarLog = Log.create;
  const buscarEvento = Evento.findById;
  const registros = [];
  Log.create = async registro => { registros.push(registro); };
  Evento.findById = () => ({ select: () => ({ lean: async () => ({ title: 'Prova' }) }) });

  async function responder(method, caminho, statusCode = 200) {
    const req = {
      method,
      originalUrl: caminho,
      usuario: { id: '507f1f77bcf86cd799439011', email: 'professor@exemplo.com', papel: 'professor' },
      body: { title: 'Prova', date: '2026-12-01', category: 'atividade' }
    };
    let resposta;
    const res = {
      statusCode,
      json(dados) { resposta = dados; return dados; }
    };
    await auditar(req, res, () => {});
    await res.json({ mensagem: 'Evento salvo no calendário.', evento: { id: '507f1f77bcf86cd799439012', title: 'Prova' } });
    return resposta;
  }

  try {
    const base = '/api/calendario/eventos';
    const id = '/507f1f77bcf86cd799439012';
    await responder('POST', base, 201);
    await responder('PUT', base + id);
    await responder('DELETE', base + id);
    assert.equal(registros.length, 3);
    assert.ok(registros.every(registro => registro.tipo === 'Calendário'));
    assert.match(registros[0].descricao, /title: Prova/);
    await responder('POST', base, 400);
    await responder('POST', '/api/calendario/eventos/migrar-legado');
    assert.equal(registros.length, 3);
  } finally {
    Log.create = criarLog;
    Evento.findById = buscarEvento;
  }
});
