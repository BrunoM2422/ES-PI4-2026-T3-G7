const express = require('express');
const Chamado = require('../models/Chamado');
const Estudante = require('../models/Estudante');

const router = express.Router();


router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    const filtro = email ? { email: email.trim().toLowerCase() } : {};
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


    const estudante = await Estudante.findOne({ email: email.trim().toLowerCase() }).lean();
    if (!estudante) {
      return res.status(404).json({ mensagem: 'Estudante não encontrado.' });
    }

    const novoChamado = new Chamado({
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
    const chamado = await Chamado.findById(req.params.id).lean();
    if (!chamado) {
      return res.status(404).json({ mensagem: 'Chamado não encontrado.' });
    }
    return res.json({ chamado: { ...chamado, id: String(chamado._id) } });
  } catch (erro) {
    console.error('Erro ao buscar chamado:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao buscar chamado.' });
  }
});


router.post('/:id/mensagens', async (req, res) => {
  try {
    const { mensagem, remetente_nome } = req.body;

    if (!mensagem || !mensagem.trim()) {
      return res.status(400).json({ mensagem: 'A mensagem não pode estar vazia.' });
    }

    const chamado = await Chamado.findById(req.params.id);
    if (!chamado) {
      return res.status(404).json({ mensagem: 'Chamado não encontrado.' });
    }

    chamado.mensagens.push({
      remetente_tipo: 'admin',
      remetente_nome: remetente_nome || 'Administrador',
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

    const chamado = await Chamado.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after' });
    if (!chamado) {
      return res.status(404).json({ mensagem: 'Chamado não encontrado.' });
    }

    return res.json({ mensagem: 'Status atualizado com sucesso!', chamado: { ...chamado.toObject(), id: String(chamado._id) } });
  } catch (erro) {
    console.error('Erro ao atualizar status:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao atualizar status.' });
  }
});

module.exports = router;
