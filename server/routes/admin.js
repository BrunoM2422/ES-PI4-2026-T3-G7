const express = require('express');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

const router = express.Router();


router.post('/cadastrar', async (req, res) => {
  try {
    const { nome, email, cpf, telefone, endereco, especialidade, tipo } = req.body;

    if (!nome || !email || !cpf || !tipo) {
      return res.status(400).json({ mensagem: 'Preencha todos os campos obrigatórios.' });
    }

    
    const papeis = tipo === 'professor' ? ['docente'] : ['estudante'];

    
    const senhaTemporaria = Math.random().toString(36).slice(2, 10);
    
    const hashCompleto = await bcrypt.hash(senhaTemporaria, 10);

    const senhaHash = hashCompleto.substring(0, 8);
    const novoUsuario = new Usuario({
      nome,
      email: email.trim().toLowerCase(),
      senha: senhaHash,
      papeis,
      cpf,
      telefone,
      endereco,
      especialidade
    });

    await novoUsuario.save();

    return res.status(201).json({
      mensagem: 'Cadastro realizado com sucesso!',
      usuario: { nome: novoUsuario.nome, email: novoUsuario.email }
    });
  } catch (erro) {
    console.error('Erro ao cadastrar usuário:', erro);
    if (erro.code === 11000) {
      return res.status(400).json({ mensagem: 'Este e-mail já está cadastrado.' });
    }
    return res.status(500).json({ mensagem: 'Erro interno ao cadastrar.' });
  }
});

module.exports = router;
