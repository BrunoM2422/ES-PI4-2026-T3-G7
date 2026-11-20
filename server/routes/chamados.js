// Autores:
const express = require('express');
const mongoose = require('mongoose');
const Chamado = require('../models/Chamado');
const Usuario = require('../models/Usuario');
const Estudante = require('../models/Estudante');
const Curso = require('../models/Curso');
const { autenticar } = require('../services/autenticacao');

const router = express.Router();
router.use(autenticar);

async function filtroDoAdministrador(req) {
  if (req.usuario.nivelPermissao !== 'admin_2') return {};
  if (!req.usuario.cursoId) return { _id: null };
  const curso = await Curso.findById(req.usuario.cursoId).select('nome').lean();
  const pertencentes = [{ cursoId: req.usuario.cursoId }];
  if (curso?.nome) pertencentes.push({ cursoId: null, curso: curso.nome });
  return { $or: pertencentes };
}

async function chamadoDoEscopo(req, id, { lean = false } = {}) {
  if (!mongoose.isValidObjectId(id)) return null;
  const filtro = req.usuario.papel === 'admin' ? await filtroDoAdministrador(req) : { email: req.usuario.email };
  const consulta = Chamado.findOne({ _id: id, ...filtro });
  return lean ? consulta.lean() : consulta;
}

async function nomeDoAdministrador(req) {
  if (req.usuario.nome) return req.usuario.nome;
  if (mongoose.isValidObjectId(req.usuario.id)) {
    const usuario = await Usuario.findById(req.usuario.id).select('nome').lean();
    if (usuario?.nome) return usuario.nome;
  }
  return 'Administrador';
}

router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    const filtro = req.usuario.papel === 'admin'
      ? await filtroDoAdministrador(req)
      : { email: req.usuario.email };
    if (req.usuario.papel === 'admin' && req.usuario.nivelPermissao !== 'admin_2' && email) filtro.email = email.trim().toLowerCase();
    const chamados = await Chamado.find(filtro).sort({ criado_em: -1 }).lean();
    return res.json({
      chamados: chamados.map(c => ({ ...c, id: String(c._id) }))
    });
  } catch (erro) {
    console.error('Erro ao listar chamados:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao listar chamados.' });
  }
});


router.post('/', async (req, res) => {
  try {
    const { email, assunto, descricao } = req.body;

    if (!email || !assunto || !descricao) {
      return res.status(400).json({ mensagem: 'Preencha todos os campos obrigatórios.' });
    }
    if (req.usuario.papel !== 'admin' && email.trim().toLowerCase() !== req.usuario.email) return res.status(403).json({ mensagem: 'Só é possível abrir chamados para sua própria conta.' });


    const estudante = await Estudante.findOne({ email: email.trim().toLowerCase() }).lean();
    if (!estudante) {
      return res.status(404).json({ mensagem: 'Estudante não encontrado.' });
    }

    const novoChamado = new Chamado({
      cursoId: estudante.cursoId || null,
      ra: estudante.ra || 'E2026000',
      nome: estudante.nome,
      email: estudante.email,
      curso: estudante.curso?.nome || 'Não informado',
      assunto: assunto.trim(),
      descricao: descricao.trim(),
      status: 'ativo',
      mensagens: [
        {
          remetente_tipo: 'estudante',
          remetente_nome: estudante.nome,
          mensagem: descricao.trim(),
          data_envio: new Date()
        }
      ]
    });

    await novoChamado.save();

    return res.status(201).json({
      mensagem: 'Chamado enviado com sucesso!',
      chamado: { ...novoChamado.toObject(), id: String(novoChamado._id) }
    });
  } catch (erro) {
    console.error('Erro ao criar chamado:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao criar chamado.' });
  }
});


router.get('/:id', async (req, res) => {
  try {
    const chamado = await chamadoDoEscopo(req, req.params.id, { lean: true });
    if (!chamado) {
      return res.status(404).json({ mensagem: 'Chamado não encontrado.' });
    }
    if (req.usuario.papel !== 'admin' && chamado.email !== req.usuario.email) return res.status(403).json({ mensagem: 'Acesso não permitido a este chamado.' });
    return res.json({ chamado: { ...chamado, id: String(chamado._id) } });
  } catch (erro) {
    console.error('Erro ao buscar chamado:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao buscar chamado.' });
  }
});


router.post('/:id/mensagens', async (req, res) => {
  try {
    const { mensagem } = req.body;

    if (!mensagem || !mensagem.trim()) {
      return res.status(400).json({ mensagem: 'A mensagem não pode estar vazia.' });
    }

    const chamado = await chamadoDoEscopo(req, req.params.id);
    if (!chamado) {
      return res.status(404).json({ mensagem: 'Chamado não encontrado.' });
    }
    if (req.usuario.papel !== 'admin' && chamado.email !== req.usuario.email) return res.status(403).json({ mensagem: 'Acesso não permitido a este chamado.' });

    const tipo = req.usuario.papel === 'admin' ? 'admin' : 'estudante';
    const nome = tipo === 'admin' ? await nomeDoAdministrador(req) : chamado.nome;

    chamado.mensagens.push({
      remetente_tipo: tipo,
      remetente_nome: nome,
      mensagem: mensagem.trim(),
      data_envio: new Date()
    });
    chamado.atualizado_em = new Date();

    await chamado.save();

    return res.json({
      mensagem: 'Resposta enviada com sucesso!',
      chamado: { ...chamado.toObject(), id: String(chamado._id) }
    });
  } catch (erro) {
    console.error('Erro ao enviar resposta:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao enviar resposta.' });
  }
});


router.patch('/:id/status', async (req, res) => {
  try {
    if (req.usuario.papel !== 'admin') return res.status(403).json({ mensagem: 'Somente administradores podem atualizar chamados.' });
    const { status } = req.body;

    if (!['ativo', 'finalizado'].includes(status)) {
      return res.status(400).json({ mensagem: 'Status inválido.' });
    }

    const updateData = { status, atualizado_em: new Date() };
    if (status === 'finalizado') {
      updateData.encerrado_em = new Date();
    } else {
      updateData.encerrado_em = null;
    }

    const chamado = await chamadoDoEscopo(req, req.params.id);
    if (!chamado) {
      return res.status(404).json({ mensagem: 'Chamado não encontrado.' });
    }

    Object.assign(chamado, updateData);
    await chamado.save();
    return res.json({ mensagem: 'Status atualizado com sucesso!', chamado: { ...chamado.toObject(), id: String(chamado._id) } });
  } catch (erro) {
    console.error('Erro ao atualizar status:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao atualizar status.' });
  }
});

module.exports = router;
