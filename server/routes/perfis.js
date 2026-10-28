const express = require('express');
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
    const { email, telefone, endereco} = req.body;
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
        { $set: { telefone, endereco } },
        { returnDocument: 'after'}
      );
    }

    return res.json({ mensagem: 'Perfil atualizado com sucesso!' });
  } catch (erro) {
    console.error('Erro ao atualizar perfil:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao atualizar perfil.' });
  }
});

module.exports = router;
