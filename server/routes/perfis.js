const express = require('express');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const Estudante = require('../models/Estudante');
const Docente = require('../models/Docente');

const router = express.Router();


router.get('/', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ mensagem: 'E-mail não informado.' });
    }

    const usuario = await Usuario.findOne({ email }).lean();
    if (!usuario) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    let detalhesPerfil = null;
    if (usuario.papeis.includes('estudante')) {
      detalhesPerfil = await Estudante.findOne({ email }).lean();
    } else if (usuario.papeis.includes('docente')) {
      detalhesPerfil = await Docente.findOne({ email }).lean();
    }

    return res.json({
      usuario: {
        nome: usuario.nome,
        email: usuario.email,
        papeis: usuario.papeis,
        ra: usuario.ra,
        rp: usuario.rp
      },
      detalhes: detalhesPerfil || {}
    });
  } catch (erro) {
    console.error('Erro ao buscar perfil:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao buscar perfil.' });
  }
});


router.put('/', async (req, res) => {
  try {
    const { email, telefone, endereco, descricao } = req.body;
    if (!email) {
      return res.status(400).json({ mensagem: 'E-mail não informado.' });
    }

    const usuario = await Usuario.findOne({ email }).lean();
    if (!usuario) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    if (usuario.papeis.includes('estudante')) {
      await Estudante.findOneAndUpdate(
        { email },
        { $set: { telefone, endereco } },
        { returnDocument: 'after' }
      );
    } else if (usuario.papeis.includes('docente')) {
      await Docente.findOneAndUpdate(
        { email },
        { $set: { telefone, endereco, descricao } },
        { returnDocument: 'after' }
      );
    }

    return res.json({ mensagem: 'Perfil atualizado com sucesso!' });
  } catch (erro) {
    console.error('Erro ao atualizar perfil:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao atualizar perfil.' });
  }
});


router.put('/senha', async (req, res) => {
  try {
    const { email, novaSenha, confirmaSenha } = req.body;

    if (!email || !novaSenha || !confirmaSenha) {
      return res.status(400).json({ mensagem: 'Preencha todos os campos de senha.' });
    }

    if (novaSenha !== confirmaSenha) {
      return res.status(400).json({ mensagem: 'As senhas não coincidem.' });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ mensagem: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }


    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await Usuario.findOneAndUpdate(
      { email },
      { $set: { senha: senhaHash } },
      { returnDocument: 'after' }
    );

    return res.json({ mensagem: 'Senha alterada com sucesso!' });
  } catch (erro) {
    console.error('Erro ao alterar senha:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao alterar senha.' });
  }
});


module.exports = router;
