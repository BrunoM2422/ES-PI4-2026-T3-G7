const express = require('express');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const Estudante = require('../models/Estudante');
const Docente = require('../models/Docente');

const router = express.Router();

router.get('/foto', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ mensagem: 'E-mail não informado.' });

    const usuario = await Usuario.findOne({ email }).select('papeis').lean();
    if (!usuario) return res.status(404).json({ mensagem: 'Perfil não encontrado.' });

    let perfil;
    if (usuario.papeis.includes('estudante')) {
      perfil = await Estudante.findOne({ email }).select('foto').lean();
    } else if (usuario.papeis.includes('docente')) {
      perfil = await Docente.findOne({ email }).select('foto').lean();
    }

    const foto = String(perfil?.foto || '').trim();
    if (!foto) return res.status(404).json({ mensagem: 'Este perfil não possui foto.' });

    const correspondencia = foto.match(/^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/i);
    const tipo = correspondencia?.[1]?.toLowerCase() || 'image/jpeg';
    const base64 = (correspondencia?.[2] || foto).replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return res.status(422).json({ mensagem: 'A foto salva possui um formato inválido.' });

    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length) return res.status(422).json({ mensagem: 'A foto salva está vazia ou inválida.' });

    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.type(tipo).send(bytes);
  } catch (erro) {
    console.error('Erro ao carregar foto de perfil:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar a foto do perfil.' });
  }
});


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
        showFinanceiro: usuario.showFinanceiro !== false,
        nome: usuario.nome,
        email: usuario.email,
        papeis: usuario.papeis,
        ra: usuario.ra,
        rp: usuario.rp,
        statusAcademico: detalhesPerfil?.statusAcademico || 'ativo'
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
    const { email, telefone, endereco, descricao, foto } = req.body;
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
        { $set: { telefone, endereco, foto } },
        { returnDocument: 'after' }
      );
    } else if (usuario.papeis.includes('docente')) {
      await Docente.findOneAndUpdate(
        { email },
        { $set: { telefone, endereco, descricao, foto } },
        { returnDocument: 'after' }
      );
    }

    return res.json({ mensagem: 'Perfil atualizado com sucesso!' });
  } catch (erro) {
    console.error('Erro ao atualizar perfil:', erro);
    return res.status(500).json({ mensagem: 'Erro interno ao atualizar perfil.' });
  }
});


router.put('/financeiro', async (req, res) => {
  if (req.usuario.papel !== 'professor') return res.status(403).json({ mensagem: 'Opção exclusiva de docentes.' });
  if (typeof req.body.showFinanceiro !== 'boolean') return res.status(400).json({ mensagem: 'Informe a preferência do financeiro.' });
  try {
    await Usuario.updateOne({ _id: req.usuario.id }, { $set: { showFinanceiro: req.body.showFinanceiro } });
    return res.json({ mensagem: req.body.showFinanceiro ? 'Financeiro ativado.' : 'Financeiro desativado.' });
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Não foi possível salvar a preferência.' });
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
