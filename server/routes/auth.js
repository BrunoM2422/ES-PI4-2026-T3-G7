const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const Estudante = require('../models/Estudante');
const enviarEmail = require('../services/email');

const router = express.Router();

const mensagemRecuperacao = 'Se o e-mail estiver vinculado a uma conta válida, você receberá um código de recuperação.';
const papeisValidos = ['estudante', 'docente', 'admin'];

router.post('/recuperacao', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ mensagem: 'Informe um endereço de e-mail válido.' });
  }

  try {
    const usuario = await Usuario.findOne({ email, papeis: { $in: papeisValidos } }).select(
      '+passwordResetRequestedAt'
    );

    if (!usuario) return res.json({ mensagem: mensagemRecuperacao });

    const agora = Date.now();
    if (
      usuario.passwordResetRequestedAt &&
      agora - usuario.passwordResetRequestedAt.getTime() < 60_000
    ) {
      return res.json({ mensagem: mensagemRecuperacao });
    }

    const codigo = String(crypto.randomInt(100000, 1000000));
    usuario.passwordResetCodeHash = await bcrypt.hash(codigo, 10);
    usuario.passwordResetExpiresAt = new Date(agora + 10 * 60_000);
    usuario.passwordResetAttempts = 0;
    usuario.passwordResetRequestedAt = new Date(agora);
    await usuario.save();

    try {
      await enviarEmail({
        to: usuario.email,
        nome: usuario.nome,
        codigo
      });
    } catch (erroEmail) {
      console.error('Falha ao enviar e-mail de recuperação:', erroEmail.message);
      usuario.passwordResetCodeHash = undefined;
      usuario.passwordResetExpiresAt = undefined;
      usuario.passwordResetAttempts = 0;
      await usuario.save();
    }

    return res.json({ mensagem: mensagemRecuperacao });
  } catch (erro) {
    console.error('Erro ao solicitar recuperação de senha:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível processar a solicitação agora.' });
  }
});

router.post('/redefinir-senha', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const codigo = String(req.body.codigo || '').trim();
  const novaSenha = req.body.novaSenha;

  if (!email || !/^\d{6}$/.test(codigo) || typeof novaSenha !== 'string' || novaSenha.length < 8) {
    return res.status(400).json({ mensagem: 'Informe o código de 6 dígitos e uma senha com pelo menos 8 caracteres.' });
  }

  try {
    const usuario = await Usuario.findOne({ email, papeis: { $in: papeisValidos } }).select(
      '+passwordResetCodeHash +passwordResetExpiresAt +passwordResetAttempts'
    );

    if (!usuario || !usuario.passwordResetCodeHash || !usuario.passwordResetExpiresAt) {
      return res.status(400).json({ mensagem: 'Código inválido ou expirado. Solicite um novo código.' });
    }

    if (usuario.passwordResetExpiresAt.getTime() <= Date.now()) {
      usuario.passwordResetCodeHash = undefined;
      usuario.passwordResetExpiresAt = undefined;
      usuario.passwordResetAttempts = 0;
      await usuario.save();
      return res.status(400).json({ mensagem: 'Código inválido ou expirado. Solicite um novo código.' });
    }

    if (usuario.passwordResetAttempts >= 5) {
      usuario.passwordResetCodeHash = undefined;
      usuario.passwordResetExpiresAt = undefined;
      usuario.passwordResetAttempts = 0;
      await usuario.save();
      return res.status(400).json({ mensagem: 'Limite de tentativas atingido. Solicite um novo código.' });
    }

    const codigoValido = await bcrypt.compare(codigo, usuario.passwordResetCodeHash);
    if (!codigoValido) {
      usuario.passwordResetAttempts += 1;
      if (usuario.passwordResetAttempts >= 5) {
        usuario.passwordResetCodeHash = undefined;
        usuario.passwordResetExpiresAt = undefined;
        usuario.passwordResetAttempts = 0;
      }
      await usuario.save();
      return res.status(400).json({ mensagem: 'Código inválido ou expirado. Confira o código e tente novamente.' });
    }

    usuario.senha = await bcrypt.hash(novaSenha, 10);
    usuario.passwordResetCodeHash = undefined;
    usuario.passwordResetExpiresAt = undefined;
    usuario.passwordResetAttempts = 0;
    usuario.passwordResetRequestedAt = undefined;
    await usuario.save();

    return res.json({ mensagem: 'Senha redefinida com sucesso. Você já pode entrar com a nova senha.' });
  } catch (erro) {
    console.error('Erro ao redefinir senha:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível redefinir a senha agora.' });
  }
});

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

    
    const senhaValida = await bcrypt.compare(
      senha,
      usuario.senha
    );
    
    const senhaValida2 = senha === usuario.senha;

    if (!senhaValida && !senhaValida2) {
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

    const estudante = tipo === 'aluno'
      ? await Estudante.findOne({ email: usuario.email }).select('statusAcademico').lean()
      : null;

    return res.json({
      mensagem: 'Login realizado com sucesso!',
      usuario: {
        nome: usuario.nome,
        email: usuario.email,
        tipo,
        papeis,
        statusAcademico: estudante?.statusAcademico || 'ativo',
        nivelPermissao: tipo === 'administrador' &&
          ['admin_mestre', 'admin_2', 'admin_3'].includes(usuario.nivelPermissao)
          ? usuario.nivelPermissao
          : tipo === 'administrador'
            ? 'admin_mestre'
            : null
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
