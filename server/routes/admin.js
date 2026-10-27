const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const Estudante = require('../models/Estudante');
const Docente = require('../models/Docente');
const Curso = require('../models/Curso');

const router = express.Router();

router.get('/cursos', async (req, res) => {
  try {
    const cursos = await Curso.find()
      .select('codigo nome unidade grau modalidade duracao descricao')
      .sort({ nome: 1 })
      .lean();

    return res.json({
      cursos: cursos.map(curso => ({ ...curso, id: String(curso._id) }))
    });
  } catch (erro) {
    console.error('Erro ao listar cursos:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar os cursos.' });
  }
});

router.post('/cursos', async (req, res) => {
  try {
    const { codigo, nome, unidade, grau, modalidade, duracao, descricao } = req.body;
    const duracaoNumerica = Number(duracao);
    const grausPermitidos = ['Bacharelado', 'Licenciatura', 'Tecnólogo', 'Pós-Graduação', 'Mestrado', 'Pós Doutorado'];
    const modalidadesPermitidas = ['Presencial', 'Semipresencial', 'Ensino a Distância (EAD)'];

    if (!codigo || !nome || !unidade || !grausPermitidos.includes(grau) || !modalidadesPermitidas.includes(modalidade) || !Number.isInteger(duracaoNumerica)) {
      return res.status(400).json({ mensagem: 'Preencha os campos obrigatórios do curso.' });
    }

    if (duracaoNumerica < 1 || duracaoNumerica > 20) {
      return res.status(400).json({ mensagem: 'A duração deve ser de 1 a 20 semestres.' });
    }

    const novoCurso = new Curso({
      codigo: codigo.trim().toUpperCase(),
      nome: nome.trim(),
      unidade: unidade.trim(),
      grau,
      modalidade,
      duracao: duracaoNumerica,
      descricao: typeof descricao === 'string' ? descricao.trim() : ''
    });

    await novoCurso.save();
    return res.status(201).json({ mensagem: 'Curso cadastrado com sucesso!', curso: novoCurso });
  } catch (erro) {
    console.error('Erro ao cadastrar curso:', erro);
    if (erro.code === 11000) {
      return res.status(409).json({ mensagem: 'Já existe um curso com este código.' });
    }
    return res.status(500).json({ mensagem: 'Erro interno ao cadastrar curso.' });
  }
});


async function obterOuCriarCodigoInstituicao(nomeInstituicao) {
  if (!nomeInstituicao) {
    return { nome: 'Universidade 1', codigo: 'UNI-1' };
  }

  const nomeLimpo = nomeInstituicao.trim();

  
  const estudanteExistente = await Estudante.findOne({ 
    'instituicao.nome': new RegExp(`^${nomeLimpo}$`, 'i') 
  });
  if (estudanteExistente && estudanteExistente.instituicao && estudanteExistente.instituicao.codigo) {
    return estudanteExistente.instituicao;
  }

  const docenteExistente = await Docente.findOne({ 
    'instituicao.nome': new RegExp(`^${nomeLimpo}$`, 'i') 
  });
  if (docenteExistente && docenteExistente.instituicao && docenteExistente.instituicao.codigo) {
    return docenteExistente.instituicao;
  }

  
  let prefixo = nomeLimpo
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') 
    .replace(/[^a-zA-Z]/g, '') 
    .substring(0, 4)
    .toUpperCase();

  if (prefixo.length < 3) {
    prefixo = 'UNI';
  }

  let codigoUnico = '';
  let existe = true;

  
  while (existe) {
    const numeroAleatorio = Math.floor(100 + Math.random() * 900);
    codigoUnico = `${prefixo}-${numeroAleatorio}`;

    const checkEstudante = await Estudante.findOne({ 'instituicao.codigo': codigoUnico });
    const checkDocente = await Docente.findOne({ 'instituicao.codigo': codigoUnico });

    if (!checkEstudante && !checkDocente) {
      existe = false;
    }
  }

  return {
    nome: nomeLimpo,
    codigo: codigoUnico
  };
}

router.post('/cadastrar', async (req, res) => {
  try {
    const { nome, email, cpf, telefone, endereco, especialidade, tipo, instituicao, cursoId } = req.body;

    if (!nome || !email || !cpf || !tipo) {
      return res.status(400).json({ mensagem: 'Preencha todos os campos obrigatórios.' });
    }

    const emailTratado = email.trim().toLowerCase();
    
    const senhaTemporaria = '123456';
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);

    
    const dadosInstituicao = await obterOuCriarCodigoInstituicao(instituicao);

    let codigoMatricula = '';

    if (tipo === 'estudante') {
      if (!cursoId || !mongoose.isValidObjectId(cursoId)) {
        return res.status(400).json({ mensagem: 'Selecione um curso válido para o estudante.' });
      }

      const cursoSelecionado = await Curso.findById(cursoId);
      if (!cursoSelecionado) {
        return res.status(404).json({ mensagem: 'O curso selecionado não foi encontrado.' });
      }

      const totalEstudantes = await Estudante.countDocuments();
      const sequencial = String(totalEstudantes).padStart(3, '0');
      codigoMatricula = `E2026${sequencial}`;

      const novoEstudante = new Estudante({
        ra: codigoMatricula,
        nome,
        email: emailTratado,
        cpf,
        telefone,
        endereco,
        cursoId: cursoSelecionado._id,
        curso: {
          codigo: cursoSelecionado.codigo,
          nome: cursoSelecionado.nome,
          unidade: cursoSelecionado.unidade,
          grau: cursoSelecionado.grau,
          modalidade: cursoSelecionado.modalidade,
          duracao: cursoSelecionado.duracao,
          descricao: cursoSelecionado.descricao
        },
        instituicao: dadosInstituicao
      });
      await novoEstudante.save();

      const novoUsuario = new Usuario({
        nome,
        email: emailTratado,
        senha: senhaHash,
        papeis: ['estudante'],
        ra: codigoMatricula
      });
      await novoUsuario.save();

    } else if (tipo === 'professor') {
      const totalDocentes = await Docente.countDocuments();
      const sequencial = String(totalDocentes).padStart(1, '0');
      codigoMatricula = `P2026${sequencial}`;

      const novoDocente = new Docente({
        rp: codigoMatricula,
        nome,
        email: emailTratado,
        cpf,
        telefone,
        especialidade,
        instituicao: dadosInstituicao
      });
      await novoDocente.save();

      const novoUsuario = new Usuario({
        nome,
        email: emailTratado,
        senha: senhaHash,
        papeis: ['docente'],
        rp: codigoMatricula
      });
      await novoUsuario.save();
    } else {
      return res.status(400).json({ mensagem: 'Tipo de usuário inválido.' });
    }

    return res.status(201).json({
      mensagem: 'Cadastro realizado com sucesso!',
      matricula: codigoMatricula,
      instituicao: dadosInstituicao
    });

  } catch (erro) {
    console.error('Erro ao cadastrar:', erro);
    if (erro.code === 11000) {
      return res.status(400).json({ mensagem: 'Este e-mail ou CPF já está cadastrado.' });
    }
    return res.status(500).json({ mensagem: 'Erro interno ao realizar cadastro.' });
  }
});

module.exports = router;
