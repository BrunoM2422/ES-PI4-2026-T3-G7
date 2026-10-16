const express = require('express');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();

    const senha = req.body.senha;

    if (!email || typeof senha !== 'string' || !senha) {
      return res.status(400).json({
        mensagem: 'Informe o e-mail e a senha.'
      });
    }

    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(401).json({
        mensagem: 'E-mail ou senha incorretos.'
      });
    }

    /*
    const senhaValida = await bcrypt.compare(
      senha,
      usuario.senha
    );
    */
    const senhaValida = senha === usuario.senha;

    if (!senhaValida) {
      return res.status(401).json({
        mensagem: 'E-mail ou senha incorretos.'
      });
    }

    const papeis = usuario.papeis || [];

    let tipo;

    if (papeis.includes('admin')) {
      tipo = 'administrador';
    } else if (papeis.includes('docente')) {
      tipo = 'professor';
    } else if (papeis.includes('estudante')) {
      tipo = 'aluno';
    }

    if (!tipo) {
      return res.status(403).json({
        mensagem: 'Usuário sem um papel de acesso válido.'
      });
    }

    return res.json({
      mensagem: 'Login realizado com sucesso!',
      usuario: {
        nome: usuario.nome,
        email: usuario.email,
        tipo,
        papeis
      }
    });
  } catch (erro) {
    console.error('Erro no login:', erro);

    return res.status(500).json({
      mensagem: 'Erro interno ao realizar login.'
    });
  }
});

module.exports = router;
