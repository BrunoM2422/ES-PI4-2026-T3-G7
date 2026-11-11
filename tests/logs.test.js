const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Usuario = require('../server/models/Usuario');
const Log = require('../server/models/Log');
const { autenticar, criarToken } = require('../server/services/autenticacao');
const { auditar } = require('../server/services/logs');

test('logs isolam usuários, recusam alunos e registram somente ações concluídas sem senhas', async () => {
  process.env.SESSION_SECRET = 'segredo-exclusivo-do-teste';
  const usuarios = [
    { _id: '000000000000000000000001', email: 'admin@example.com', papeis: ['admin'] },
    { _id: '000000000000000000000002', email: 'docente@example.com', papeis: ['docente'] },
    { _id: '000000000000000000000003', email: 'aluno@example.com', papeis: ['estudante'] }
  ];
  const registros = [];
  const originalFind = Log.find;
  const originalCreate = Log.create;
  const originalUsuario = Usuario.findById;
  Usuario.findById = id => ({ select: () => ({ lean: async () => usuarios.find(user => user._id === id) }) });
  Log.create = async data => { registros.push(data); };
  Log.find = filtro => ({ sort: () => ({ select: () => ({ lean: async () => registros.filter(log => log.usuarioId === filtro.usuarioId) }) }) });
  const app = express();
  app.use(express.json());
  app.use('/api/logs', require('../server/routes/logs'));
  app.put('/api/perfis/senha', autenticar, auditar, (req, res) => res.json({ mensagem: 'Senha alterada.' }));
  app.post('/api/admin/cadastrar', autenticar, auditar, (req, res) => res.status(req.body.falhar ? 400 : 201).json({ mensagem: 'Cadastro.' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = usuario => ({ Authorization: `Bearer ${criarToken(usuario)}`, 'Content-Type': 'application/json' });
  try {
    assert.equal((await fetch(`${base}/api/logs`)).status, 401);
    assert.equal((await fetch(`${base}/api/logs`, { headers: headers(usuarios[2]) })).status, 403);
    await fetch(`${base}/api/admin/cadastrar`, { method: 'POST', headers: headers(usuarios[0]), body: JSON.stringify({ nome: 'Aluno teste', tipo: 'estudante', senha: 'SEGREDO' }) });
    await fetch(`${base}/api/admin/cadastrar`, { method: 'POST', headers: headers(usuarios[0]), body: JSON.stringify({ falhar: true }) });
    await fetch(`${base}/api/perfis/senha`, { method: 'PUT', headers: headers(usuarios[1]), body: JSON.stringify({ novaSenha: 'SEGREDO', confirmaSenha: 'SEGREDO' }) });
    assert.equal(registros.length, 2);
    assert.equal(JSON.stringify(registros).includes('SEGREDO'), false);
    for (const usuario of usuarios.slice(0, 2)) {
      const response = await fetch(`${base}/api/logs?usuarioId=${usuarios[2]._id}`, { headers: headers(usuario) });
      const data = await response.json();
      assert.equal(data.logs.length, 1);
      assert.equal(data.logs[0].usuarioId, usuario._id);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    Log.find = originalFind;
    Log.create = originalCreate;
    Usuario.findById = originalUsuario;
  }
});
