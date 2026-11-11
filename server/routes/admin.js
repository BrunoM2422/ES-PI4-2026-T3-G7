const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const Estudante = require('../models/Estudante');
const Docente = require('../models/Docente');
const Curso = require('../models/Curso');
const OpcoesSistema = require('../models/OpcoesSistema');
const Disciplina = require('../models/Disciplina');
const Turma = require('../models/Turma');
const GradeHorario = require('../models/GradeHorario');
const Contador = require('../models/Contador');
const { autenticar } = require('../services/autenticacao');

const router = express.Router();

function normalizarCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

async function proximoRaEstudante() {
  const contadorId = 'ra-estudante-2026';
  const atual = await Contador.findById(contadorId).select('valor').lean();
  let contador;

  if (atual) {
    contador = await Contador.findByIdAndUpdate(contadorId, { $inc: { valor: 1 } }, { new: true });
  } else {
    const estudantes = await Estudante.find({ ra: /^E2026\d+$/ }).select('ra').lean();
    const maiorRa = estudantes.reduce((maior, estudante) => {
      const sequencial = Number(String(estudante.ra).slice(5));
      return Number.isSafeInteger(sequencial) ? Math.max(maior, sequencial) : maior;
    }, 0);

    try {
      await Contador.create({ _id: contadorId, valor: maiorRa });
    } catch (erro) {
      if (erro.code !== 11000) throw erro;
    }
    contador = await Contador.findByIdAndUpdate(contadorId, { $inc: { valor: 1 } }, { new: true });
  }

  if (!contador || !Number.isSafeInteger(contador.valor)) throw new Error('Não foi possível gerar o próximo RA.');
  return `E2026${String(contador.valor).padStart(3, '0')}`;
}

router.post('/matriculas/cancelar', async (req, res) => {
  try {
    const identificador = String(req.body.matricula || '').trim();
    const cpf = normalizarCpf(req.body.cpf);
    if (!identificador || cpf.length !== 11) {
      return res.status(400).json({ mensagem: 'Informe o RA ou e-mail do aluno e um CPF válido.' });
    }

    const estudante = await Estudante.findOne({
      $or: [
        { ra: identificador },
        { email: identificador.toLowerCase() }
      ]
    });
    if (!estudante || normalizarCpf(estudante.cpf) !== cpf) {
      return res.status(404).json({ mensagem: 'Não foi encontrado um aluno com esses dados.' });
    }

    await Turma.updateMany({ alunosIds: estudante._id }, { $pull: { alunosIds: estudante._id } });

    const usuario = await Usuario.findOne({ email: estudante.email, papeis: 'estudante' });
    if (usuario) {
      if (usuario.papeis.length > 1) {
        usuario.papeis = usuario.papeis.filter(papel => papel !== 'estudante');
        usuario.ra = undefined;
        await usuario.save();
      } else {
        await Usuario.deleteOne({ _id: usuario._id });
      }
    }
    await Estudante.deleteOne({ _id: estudante._id });

    return res.json({ mensagem: `A matrícula de ${estudante.nome} foi cancelada e o cadastro de aluno foi removido.` });
  } catch (erro) {
    console.error('Erro ao cancelar matrícula:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível cancelar a matrícula.' });
  }
});

router.post('/matriculas/trancar', async (req, res) => {
  try {
    const identificador = String(req.body.matricula || '').trim();
    const cpf = normalizarCpf(req.body.cpf);
    const inicio = new Date(req.body.inicio);
    const retorno = new Date(req.body.retorno);
    const justificativa = String(req.body.justificativa || '').trim();
    if (
      !identificador || cpf.length !== 11 ||
      Number.isNaN(inicio.getTime()) || Number.isNaN(retorno.getTime()) || inicio >= retorno ||
      !justificativa
    ) {
      return res.status(400).json({ mensagem: 'Informe RA ou e-mail, CPF, período válido e justificativa.' });
    }

    const estudante = await Estudante.findOne({
      $or: [
        { ra: identificador },
        { email: identificador.toLowerCase() }
      ]
    });
    if (!estudante || normalizarCpf(estudante.cpf) !== cpf) {
      return res.status(404).json({ mensagem: 'Não foi encontrado um aluno com esses dados.' });
    }

    estudante.statusAcademico = 'trancado';
    estudante.trancamento = { inicio, retorno, justificativa };
    await estudante.save();

    return res.json({ mensagem: `A matrícula de ${estudante.nome} foi trancada. O acesso do aluno foi limitado.` });
  } catch (erro) {
    console.error('Erro ao trancar matrícula:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível trancar a matrícula.' });
  }
});

router.put('/opcoes', async (req, res) => {
  const campos = ['matricula', 'avaliacao', 'grade', 'gradeCurricular'];
  const atualizacao = {};

  for (const campo of campos) {
    if (typeof req.body[campo] === 'boolean') atualizacao[campo] = req.body[campo];
  }

  if (!Object.keys(atualizacao).length) {
    return res.status(400).json({ mensagem: 'Informe ao menos uma opção válida.' });
  }

  try {
    const opcoes = await OpcoesSistema.findByIdAndUpdate(
      'opcoes-academicas',
      { $set: atualizacao, $setOnInsert: { _id: 'opcoes-academicas' } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ mensagem: 'Opções atualizadas.', opcoes });
  } catch (erro) {
    console.error('Erro ao atualizar opções do sistema:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível atualizar as opções.' });
  }
});

router.put('/opcoes/grade-curso', async (req, res) => {
  try {
    const { cursoId, liberado } = req.body;
    if (!mongoose.isValidObjectId(cursoId) || typeof liberado !== 'boolean') return res.status(400).json({ mensagem: 'Curso ou ação inválida.' });
    if (!await Curso.exists({ _id: cursoId })) return res.status(404).json({ mensagem: 'Curso não encontrado.' });
    const atual = await OpcoesSistema.findById('opcoes-academicas').select('gradeCursosLiberados').lean();
    const liberados = new Set((atual?.gradeCursosLiberados || []).map(String));
    if (liberado) liberados.add(String(cursoId)); else liberados.delete(String(cursoId));
    const opcoes = await OpcoesSistema.findByIdAndUpdate('opcoes-academicas', {
      $set: { gradeCursosLiberados: [...liberados], gradeCurricular: false },
      $setOnInsert: { _id: 'opcoes-academicas' }
    }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean();
    return res.json({ mensagem: liberado ? 'Grade liberada para o curso.' : 'Liberação removida do curso.', opcoes });
  } catch (erro) {
    console.error('Erro ao atualizar liberação da grade por curso:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível atualizar a liberação da grade.' });
  }
});

router.put('/opcoes/fechar-grades', async (_req, res) => {
  try {
    const opcoes = await OpcoesSistema.findByIdAndUpdate('opcoes-academicas', {
      $set: { gradeCursosLiberados: [], gradeCurricular: false },
      $setOnInsert: { _id: 'opcoes-academicas' }
    }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean();
    return res.json({ mensagem: 'Grade Curricular foi fechada para todos os cursos.', opcoes });
  } catch (erro) {
    console.error('Erro ao fechar Grade Curricular de todos os cursos:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível fechar as grades.' });
  }
});

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

router.put('/cursos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nome, unidade, grau, modalidade, duracao, descricao } = req.body;
    const duracaoNumerica = Number(duracao);
    const grausPermitidos = ['Bacharelado', 'Licenciatura', 'Tecnólogo', 'Pós-Graduação', 'Mestrado', 'Pós Doutorado'];
    const modalidadesPermitidas = ['Presencial', 'Semipresencial', 'Ensino a Distância (EAD)'];
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ mensagem: 'Curso inválido.' });
    if (typeof codigo !== 'string' || !/^\d{2}$/.test(codigo.trim()) || ![nome, unidade].every(valor => typeof valor === 'string' && valor.trim()) || !grausPermitidos.includes(grau) || !modalidadesPermitidas.includes(modalidade) || !Number.isInteger(duracaoNumerica) || duracaoNumerica < 1 || duracaoNumerica > 20 || (descricao !== undefined && typeof descricao !== 'string')) {
      return res.status(400).json({ mensagem: 'Preencha os dados do curso com valores válidos.' });
    }
    const cursoAtual = await Curso.findById(id).select('duracao codigo');
    if (!cursoAtual) return res.status(404).json({ mensagem: 'Curso não encontrado.' });
    const codigoNovo = codigo.trim().toUpperCase();
    let atualizacoesCodigosDisciplinas = [];
    if (codigoNovo !== cursoAtual.codigo) {
      if (await Curso.exists({ codigo: codigoNovo, _id: { $ne: id } })) {
        return res.status(409).json({ mensagem: 'Já existe um curso com este código.' });
      }
      const disciplinas = await Disciplina.find({ cursoId: id }).select('_id codigo').lean();
      const codigosConvertidos = new Set();
      atualizacoesCodigosDisciplinas = disciplinas.map(disciplina => {
        const codigoAntigo = String(disciplina.codigo || '').trim().toUpperCase();
        const prefixoAntigo = String(cursoAtual.codigo || '').trim().toUpperCase();
        const complementoOriginal = /^\d{2}$/.test(prefixoAntigo) && codigoAntigo.startsWith(prefixoAntigo)
          ? codigoAntigo.slice(prefixoAntigo.length)
          : codigoAntigo;
        const complemento = complementoOriginal.replace(/[^A-Z0-9]/g, '');
        if (!/^[A-Z0-9]{1,8}$/.test(complemento)) {
          throw Object.assign(new Error('Há disciplina(s) com código incompatível com a migração automática. Corrija esses códigos antes de alterar o curso.'), { status: 409 });
        }
        const codigoConvertido = `${codigoNovo}${complemento}`;
        if (codigosConvertidos.has(codigoConvertido)) {
          throw Object.assign(new Error('A atualização geraria códigos de disciplina duplicados neste curso.'), { status: 409 });
        }
        codigosConvertidos.add(codigoConvertido);
        return { updateOne: { filter: { _id: disciplina._id }, update: { $set: { codigo: codigoConvertido } } } };
      });
    }
    if (duracaoNumerica < cursoAtual.duracao) {
      const [disciplinaForaDaDuracao, gradeForaDaDuracao] = await Promise.all([
        Disciplina.exists({ cursoId: id, semestre: { $gt: duracaoNumerica } }),
        GradeHorario.exists({ cursoId: id, semestre: { $gt: duracaoNumerica } })
      ]);
      if (disciplinaForaDaDuracao || gradeForaDaDuracao) return res.status(409).json({ mensagem: 'A duração não pode ser menor que o semestre de disciplinas ou grades já cadastradas.' });
    }
    if (atualizacoesCodigosDisciplinas.length) await Disciplina.bulkWrite(atualizacoesCodigosDisciplinas);
    const curso = await Curso.findByIdAndUpdate(id, { codigo: codigoNovo, nome: nome.trim(), unidade: unidade.trim(), grau, modalidade, duracao: duracaoNumerica, descricao: String(descricao || '').trim() }, { new: true, runValidators: true });
    if (!curso) return res.status(404).json({ mensagem: 'Curso não encontrado.' });
    return res.json({ mensagem: 'Curso atualizado com sucesso.', curso: { ...curso.toObject(), id: String(curso._id) } });
  } catch (erro) {
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Já existe um curso com este código.' });
    if (erro.status) return res.status(erro.status).json({ mensagem: erro.message });
    console.error('Erro ao atualizar curso:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível atualizar o curso.' });
  }
});

router.delete('/cursos/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ mensagem: 'Curso inválido.' });
    const curso = await Curso.findById(req.params.id);
    if (!curso) return res.status(404).json({ mensagem: 'Curso não encontrado.' });
    if (await Disciplina.exists({ cursoId: curso._id })) return res.status(409).json({ mensagem: 'Remova todas as disciplinas deste curso antes de excluí-lo.' });
    if (await Turma.exists({ cursoId: curso._id })) return res.status(409).json({ mensagem: 'Não é possível excluir um curso que ainda possui turmas cadastradas.' });
    await GradeHorario.deleteMany({ cursoId: curso._id });
    await curso.deleteOne();
    return res.json({ mensagem: 'Curso excluído com sucesso.' });
  } catch (erro) {
    console.error('Erro ao excluir curso:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível excluir o curso.' });
  }
});

function semestreDaTurma(periodoLetivo) {
  const valor = String(periodoLetivo ?? '').trim();
  if (/^\d{1,2}$/.test(valor)) return Number(valor);
  const legado = valor.match(/\.(\d{1,2})$/);
  return legado ? Number(legado[1]) : null;
}

function codigoTurmaValido(codigo, periodoLetivo, cursoCodigo = null) {
  const semestre = Number(periodoLetivo);
  const texto = String(codigo || '');
  if (!Number.isInteger(semestre)) return false;
  const antigo = /^\d{4}$/.test(texto) && texto.startsWith(String(semestre).padStart(2, '0'));
  const novo = /^\d{6}$/.test(texto) && texto.slice(2, 4) === String(semestre).padStart(2, '0');
  const sufixo = Number(texto.slice(-2));
  if (cursoCodigo) return novo && texto.startsWith(String(cursoCodigo)) && sufixo >= 1 && sufixo <= 3;
  return (antigo || novo) && sufixo >= 1 && sufixo <= 99 && texto.slice(-2) === String(sufixo).padStart(2, '0');
}

router.get('/turmas', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.cursoId) {
      if (!mongoose.isValidObjectId(req.query.cursoId)) return res.status(400).json({ mensagem: 'O curso informado é inválido.' });
      filtro.cursoId = req.query.cursoId;
    }
    let semestreFiltro = null;
    if (req.query.semestre !== undefined) {
      const semestre = Number(req.query.semestre);
      if (!Number.isInteger(semestre) || semestre < 1 || semestre > 20) return res.status(400).json({ mensagem: 'O semestre informado é inválido.' });
      semestreFiltro = semestre;
    }
    let turmas = await Turma.find(filtro)
      .populate('cursoId', 'codigo nome')
      .populate('horarios.disciplinaId', 'nome codigo')
      .populate('horarios.docenteId', 'nome')
      .sort({ periodoLetivo: -1, codigo: 1 })
      .lean();
    if (semestreFiltro !== null) {
      turmas = turmas.filter(turma => semestreDaTurma(turma.periodoLetivo) === semestreFiltro);
    }

    return res.json({
      turmas: turmas.map(turma => ({
        ...turma,
        periodoLetivo: semestreDaTurma(turma.periodoLetivo) ?? turma.periodoLetivo,
        id: String(turma._id),
        curso: turma.cursoId
          ? { id: String(turma.cursoId._id), codigo: turma.cursoId.codigo, nome: turma.cursoId.nome }
          : null,
        cursoId: turma.cursoId ? String(turma.cursoId._id) : null
      }))
    });
  } catch (erro) {
    console.error('Erro ao listar turmas:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar as turmas.' });
  }
});

router.post('/turmas', async (req, res) => {
  try {
    const { codigo, cursoId, periodoLetivo, vagas } = req.body;
    const vagasNumericas = Number(vagas);

    if (
      typeof codigo !== 'string' || !codigo.trim() ||
      !Number.isInteger(Number(periodoLetivo)) || Number(periodoLetivo) < 1 ||
      !mongoose.isValidObjectId(cursoId) ||
      !Number.isInteger(vagasNumericas) || vagasNumericas < 1 || vagasNumericas > 300
    ) {
      return res.status(400).json({ mensagem: 'Preencha código, curso, período letivo e vagas com valores válidos.' });
    }
    if (!codigoTurmaValido(codigo.trim(), periodoLetivo)) {
      return res.status(400).json({ mensagem: 'O código deve conter o semestre em dois dígitos seguido do número da turma em dois dígitos. Exemplo: 0201.' });
    }

    const curso = await Curso.findById(cursoId).select('_id duracao codigo');
    if (!curso) return res.status(404).json({ mensagem: 'O curso selecionado não foi encontrado.' });
    if (Number(periodoLetivo) > curso.duracao) return res.status(400).json({ mensagem: 'O semestre da turma deve estar dentro da duração do curso.' });

    if (!codigoTurmaValido(codigo.trim(), periodoLetivo, curso.codigo)) return res.status(400).json({ mensagem: `O código deve começar por ${curso.codigo}, seguido do semestre e de 01, 02 ou 03.` });
    const turma = await Turma.create({
      codigo: codigo.trim().toUpperCase(),
      cursoId: curso._id,
      periodoLetivo: String(Number(periodoLetivo)),
      vagas: vagasNumericas
    });

    return res.status(201).json({ mensagem: 'Turma cadastrada com sucesso.', turma });
  } catch (erro) {
    console.error('Erro ao cadastrar turma:', erro);
    if (erro.code === 11000) {
      return res.status(409).json({ mensagem: 'Já existe uma turma com este código.' });
    }
    return res.status(500).json({ mensagem: 'Não foi possível cadastrar a turma.' });
  }
});

router.put('/turmas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, cursoId, periodoLetivo, vagas } = req.body;
    const vagasNumericas = Number(vagas);
    if (
      !mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(cursoId) ||
      typeof codigo !== 'string' || !codigo.trim() ||
      !Number.isInteger(Number(periodoLetivo)) || Number(periodoLetivo) < 1 ||
      !Number.isInteger(vagasNumericas) || vagasNumericas < 1 || vagasNumericas > 300
    ) return res.status(400).json({ mensagem: 'Preencha código, curso, período letivo e vagas com valores válidos.' });
    if (!codigoTurmaValido(codigo.trim(), periodoLetivo)) {
      return res.status(400).json({ mensagem: 'O código deve conter o semestre em dois dígitos seguido do número da turma em dois dígitos. Exemplo: 0201.' });
    }

    const turmaAtual = await Turma.findById(id).select('cursoId horarios alunosIds codigo');
    if (!turmaAtual) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
    if (vagasNumericas < (turmaAtual.alunosIds || []).length) return res.status(409).json({ mensagem: 'O número de vagas não pode ser menor que a quantidade de alunos matriculados.' });
    if (turmaAtual.horarios.length && String(turmaAtual.cursoId) !== String(cursoId)) {
      return res.status(409).json({ mensagem: 'Remova os horários vinculados antes de transferir esta turma para outro curso.' });
    }
    const curso = await Curso.findById(cursoId).select('_id duracao codigo');
    if (!curso) return res.status(404).json({ mensagem: 'O curso selecionado não foi encontrado.' });
    if (Number(periodoLetivo) > curso.duracao) return res.status(400).json({ mensagem: 'O semestre da turma deve estar dentro da duração do curso.' });
    if (!codigoTurmaValido(codigo.trim(), periodoLetivo, curso.codigo)) return res.status(400).json({ mensagem: `O código deve começar por ${curso.codigo}, seguido do semestre e de 01, 02 ou 03.` });
    if (turmaAtual.horarios.length && Number(periodoLetivo) !== semestreDaTurma(turmaAtual.periodoLetivo)) {
      return res.status(409).json({ mensagem: 'Remova os horários vinculados antes de alterar o semestre desta turma.' });
    }

    const turma = await Turma.findByIdAndUpdate(id, {
      codigo: codigo.trim().toUpperCase(), cursoId: curso._id,
      periodoLetivo: String(Number(periodoLetivo)), vagas: vagasNumericas
    }, { new: true, runValidators: true });
    return res.json({ mensagem: 'Turma atualizada com sucesso.', turma });
  } catch (erro) {
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Já existe uma turma com este código.' });
    console.error('Erro ao atualizar turma:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível atualizar a turma.' });
  }
});

router.delete('/turmas/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ mensagem: 'Turma inválida.' });
    const turma = await Turma.findById(req.params.id);
    if (turma && /^\d{6}$/.test(turma.codigo) && Number(turma.codigo.slice(-2)) >= 1 && Number(turma.codigo.slice(-2)) <= 3) return res.status(409).json({ mensagem: 'Os três grupos de cada semestre são fixos e não podem ser removidos.' });
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
    if (turma.alunosIds?.length) return res.status(409).json({ mensagem: 'Remova as matrículas dos alunos antes de excluir esta turma.' });
    if (turma.horarios.length) return res.status(409).json({ mensagem: 'Remova os horários de aula associados antes de excluir esta turma.' });
    await turma.deleteOne();
    return res.json({ mensagem: 'Turma excluída com sucesso.' });
  } catch (erro) {
    console.error('Erro ao excluir turma:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível excluir a turma.' });
  }
});

router.get('/grades-horarios', async (req, res) => {
  try {
    const { cursoId, semestre } = req.query;
    const semestreNumero = Number(semestre);
    if (!mongoose.isValidObjectId(cursoId) || !Number.isInteger(semestreNumero) || semestreNumero < 1 || semestreNumero > 20) {
      return res.status(400).json({ mensagem: 'Informe um curso e semestre válidos.' });
    }

    const grade = await GradeHorario.findOne({ cursoId, semestre: semestreNumero })
      .populate('aulas.disciplinaId', 'nome codigo')
      .populate('aulas.docenteId', 'nome email rp')
      .populate('aulas.turmaId', 'codigo')
      .lean();

    return res.json({
      grade: grade ? {
        id: String(grade._id),
        cursoId: String(grade.cursoId),
        semestre: grade.semestre,
        aulas: grade.aulas.map(aula => ({
          id: String(aula._id),
          disciplinaId: String(aula.disciplinaId._id),
          disciplinaNome: aula.disciplinaId.nome,
          disciplinaCodigo: aula.disciplinaId.codigo,
          docenteId: String(aula.docenteId._id),
          docenteNome: aula.docenteId.nome,
          turmaId: aula.turmaId ? String(aula.turmaId._id) : null,
          turmaCodigo: aula.turmaId ? aula.turmaId.codigo : null,
          dia: aula.dia,
          hora: aula.hora
        }))
      } : null
    });
  } catch (erro) {
    console.error('Erro ao carregar grade horária:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar a grade horária.' });
  }
});

// Grades independentes por turma, mantendo a coleção de grade como agenda do semestre.
router.get('/turmas/:turmaId/grade', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.turmaId)) return res.status(400).json({ mensagem: 'Turma inválida.' });
    const turma = await Turma.findById(req.params.turmaId)
      .populate('cursoId', 'codigo nome')
      .populate('horarios.disciplinaId', 'nome codigo')
      .populate('horarios.docenteId', 'nome email rp')
      .lean();
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
    const semestre = semestreDaTurma(turma.periodoLetivo);
    const grade = await GradeHorario.findOne({ cursoId: turma.cursoId._id, semestre }).select('_id').lean();
    const aulas = (turma.horarios || []).filter(item => item.semestre === semestre).map(item => ({
      id: String(item.aulaId), disciplinaId: String(item.disciplinaId._id),
      disciplinaNome: item.disciplinaId.nome, disciplinaCodigo: item.disciplinaId.codigo,
      docenteId: String(item.docenteId._id), docenteNome: item.docenteId.nome,
      turmaId: String(turma._id), turmaCodigo: turma.codigo, dia: item.dia, hora: item.hora
    }));
    return res.json({ grade: { id: grade ? String(grade._id) : null, cursoId: String(turma.cursoId._id), semestre, turmaId: String(turma._id), turmaCodigo: turma.codigo, aulas } });
  } catch (erro) {
    console.error('Erro ao carregar grade da turma:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar a grade da turma.' });
  }
});

router.put('/turmas/:turmaId/grade', async (req, res) => {
  try {
    const { turmaId } = req.params;
    const { aulas } = req.body;
    if (!mongoose.isValidObjectId(turmaId) || !Array.isArray(aulas)) return res.status(400).json({ mensagem: 'Turma e lista de aulas são obrigatórias.' });
    const turma = await Turma.findById(turmaId);
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
    const semestre = semestreDaTurma(turma.periodoLetivo);
    const curso = await Curso.findById(turma.cursoId).select('_id duracao');
    if (!curso || !semestre || semestre > curso.duracao) return res.status(409).json({ mensagem: 'A turma não possui um semestre válido.' });
    if (aulas.some(aula => !aula || !mongoose.isValidObjectId(aula.disciplinaId) || !mongoose.isValidObjectId(aula.docenteId) || !Number.isInteger(aula.dia) || aula.dia < 0 || aula.dia > 6 || !Number.isInteger(aula.hora) || aula.hora < 7 || aula.hora > 22)) {
      return res.status(400).json({ mensagem: 'Há uma aula com disciplina, docente ou horário inválido.' });
    }
    const slots = new Set();
    for (const aula of aulas) {
      const slot = `${aula.dia}:${aula.hora}`;
      if (slots.has(slot)) return res.status(409).json({ mensagem: 'A turma não pode ter duas aulas no mesmo dia e horário.' });
      slots.add(slot);
    }
    const disciplinaIds = [...new Set(aulas.map(aula => String(aula.disciplinaId)))];
    const docenteIds = [...new Set(aulas.map(aula => String(aula.docenteId)))];
    const [disciplinas, docentes] = await Promise.all([
      Disciplina.find({ _id: { $in: disciplinaIds }, cursoId: turma.cursoId, semestre }).select('_id nome codigo').lean(),
      Docente.find({ _id: { $in: docenteIds } }).select('_id nome').lean()
    ]);
    if (disciplinas.length !== disciplinaIds.length || docentes.length !== docenteIds.length) return res.status(400).json({ mensagem: 'Uma disciplina ou docente não pertence aos cadastros válidos desta turma.' });
    if (disciplinas.length !== (await Disciplina.countDocuments({ cursoId: turma.cursoId, semestre }))) return res.status(409).json({ mensagem: 'A grade da turma deve oferecer todas as disciplinas do semestre.' });

    const grade = await GradeHorario.findOneAndUpdate({ cursoId: turma.cursoId, semestre }, {
      $setOnInsert: { cursoId: turma.cursoId, semestre }
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const aulasExistentes = await GradeHorario.find({ 'aulas.dia': { $in: [...new Set(aulas.map(aula => aula.dia))] } }).select('aulas').lean();
    for (const aula of aulas) {
      const conflito = aulasExistentes.some(outroGrade => (outroGrade.aulas || []).some(outro =>
        String(outro.docenteId) === String(aula.docenteId) && outro.dia === aula.dia && outro.hora === aula.hora && String(outro.turmaId || '') !== String(turma._id) && !(String(outroGrade._id) === String(grade._id) && String(outro.turmaId || '') === String(turma._id))
      ));
      if (conflito) return res.status(409).json({ mensagem: 'Este docente já está atribuído a outra turma no mesmo horário.' });
    }

    const idsAula = aulas.map(aula => mongoose.isValidObjectId(aula.id) ? new mongoose.Types.ObjectId(aula.id) : new mongoose.Types.ObjectId());
    const aulasDaTurma = aulas.map((aula, index) => ({
      _id: idsAula[index], disciplinaId: aula.disciplinaId, docenteId: aula.docenteId,
      turmaId: turma._id, dia: aula.dia, hora: aula.hora
    }));
    grade.aulas = [...grade.aulas.filter(aula => String(aula.turmaId || '') !== String(turma._id)), ...aulasDaTurma];
    await grade.save();
    turma.semestreOrganizacao = semestre;
    turma.horarios = [...turma.horarios.filter(item => item.semestre !== semestre), ...aulasDaTurma.map(aula => ({
      gradeHorarioId: grade._id, aulaId: aula._id, disciplinaId: aula.disciplinaId,
      docenteId: aula.docenteId, dia: aula.dia, hora: aula.hora, semestre
    }))];
    await turma.save();
    const nomesDisciplinas = new Map(disciplinas.map(item => [String(item._id), item]));
    const nomesDocentes = new Map(docentes.map(item => [String(item._id), item]));
    return res.json({ mensagem: 'Grade da turma salva no banco de dados.', grade: {
      id: String(grade._id), cursoId: String(turma.cursoId), semestre, turmaId: String(turma._id), turmaCodigo: turma.codigo,
      aulas: aulasDaTurma.map(aula => ({ id: String(aula._id), disciplinaId: String(aula.disciplinaId), disciplinaNome: nomesDisciplinas.get(String(aula.disciplinaId)).nome, disciplinaCodigo: nomesDisciplinas.get(String(aula.disciplinaId)).codigo, docenteId: String(aula.docenteId), docenteNome: nomesDocentes.get(String(aula.docenteId)).nome, turmaId: String(turma._id), turmaCodigo: turma.codigo, dia: aula.dia, hora: aula.hora }))
    } });
  } catch (erro) {
    console.error('Erro ao salvar grade da turma:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível salvar a grade da turma.' });
  }
});

router.get('/docentes-ocupados', async (req, res) => {
  try {
    const { cursoId, semestre, dia, hora } = req.query;
    const semestreNumero = Number(semestre);
    const diaNumero = Number(dia);
    const horaNumero = Number(hora);
    if (
      !mongoose.isValidObjectId(cursoId) ||
      !Number.isInteger(semestreNumero) || semestreNumero < 1 || semestreNumero > 20 ||
      !Number.isInteger(diaNumero) || diaNumero < 0 || diaNumero > 6 ||
      !Number.isInteger(horaNumero) || horaNumero < 7 || horaNumero > 22
    ) {
      return res.status(400).json({ mensagem: 'Informe curso, semestre, dia e horário válidos.' });
    }

    const turmaIdAtual = mongoose.isValidObjectId(req.query.turmaId) ? String(req.query.turmaId) : null;
    const grades = await GradeHorario.find({ aulas: { $elemMatch: { dia: diaNumero, hora: horaNumero } } })
      .select('cursoId semestre aulas.docenteId aulas.dia aulas.hora aulas.turmaId').lean();
    const docenteIds = [...new Set(grades.flatMap(grade => grade.aulas
      .filter(aula => aula.dia === diaNumero && aula.hora === horaNumero)
      .filter(aula => turmaIdAtual
        ? String(aula.turmaId || '') !== turmaIdAtual
        : !(String(grade.cursoId) === String(cursoId) && grade.semestre === semestreNumero))
      .map(aula => String(aula.docenteId))))];

    return res.json({ docenteIds });
  } catch (erro) {
    console.error('Erro ao consultar disponibilidade dos docentes:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível consultar a disponibilidade dos docentes.' });
  }
});

router.put('/grades-horarios', async (req, res) => {
  try {
    const { cursoId, semestre, aulas } = req.body;
    const semestreNumero = Number(semestre);
    if (!mongoose.isValidObjectId(cursoId) || !Number.isInteger(semestreNumero) || semestreNumero < 1 || semestreNumero > 20 || !Array.isArray(aulas)) {
      return res.status(400).json({ mensagem: 'Informe curso, semestre e aulas válidos.' });
    }

    const curso = await Curso.findById(cursoId).select('_id duracao');
    if (!curso || semestreNumero > curso.duracao) return res.status(404).json({ mensagem: 'Curso ou semestre não encontrado.' });

    if (!aulas.every(aula => aula && typeof aula === 'object')) {
      return res.status(400).json({ mensagem: 'A lista de aulas contém um item inválido.' });
    }
    const disciplinaIds = [...new Set(aulas.map(aula => aula.disciplinaId))];
    const docenteIds = [...new Set(aulas.map(aula => aula.docenteId))];
    if (aulas.some(aula => !mongoose.isValidObjectId(aula.disciplinaId) || !mongoose.isValidObjectId(aula.docenteId) || !Number.isInteger(aula.dia) || aula.dia < 0 || aula.dia > 6 || !Number.isInteger(aula.hora) || aula.hora < 7 || aula.hora > 22)) {
      return res.status(400).json({ mensagem: 'Há uma aula com disciplina, docente ou horário inválido.' });
    }

    const docenteKeys = new Set();
    for (const aula of aulas) {
      const key = `${aula.dia}:${aula.hora}`;
      const docenteKey = `${aula.docenteId}:${key}`;
      if (docenteKeys.has(docenteKey)) return res.status(409).json({ mensagem: 'Um docente não pode estar em duas aulas no mesmo horário.' });
      docenteKeys.add(docenteKey);
    }

    const [disciplinasValidas, docentesValidos] = await Promise.all([
      Disciplina.find({ _id: { $in: disciplinaIds }, cursoId, semestre: semestreNumero }).select('_id nome codigo').lean(),
      Docente.find({ _id: { $in: docenteIds } }).select('_id nome').lean()
    ]);
    if (disciplinasValidas.length !== disciplinaIds.length || docentesValidos.length !== docenteIds.length) {
      return res.status(400).json({ mensagem: 'Uma disciplina ou docente não pertence mais aos dados cadastrados para esta grade.' });
    }

    const gradeAtual = await GradeHorario.findOne({ cursoId, semestre: semestreNumero });
    for (const chave of docenteKeys) {
      const [docenteId, diaTexto, horaTexto] = chave.split(':');
      const dia = Number(diaTexto);
      const hora = Number(horaTexto);
      const ocupado = await GradeHorario.findOne({
        ...(gradeAtual ? { _id: { $ne: gradeAtual._id } } : {}),
        aulas: { $elemMatch: { docenteId, dia, hora } }
      }).select('_id');
      if (ocupado) return res.status(409).json({ mensagem: 'Este docente já está atribuído a outra grade no mesmo horário.' });
    }

    const aulaDocs = aulas.map(aula => ({
      ...(mongoose.isValidObjectId(aula.id) ? { _id: aula.id } : {}),
      disciplinaId: aula.disciplinaId,
      docenteId: aula.docenteId,
      turmaId: mongoose.isValidObjectId(aula.id) ? gradeAtual?.aulas.id(aula.id)?.turmaId || null : null,
      dia: aula.dia,
      hora: aula.hora
    }));
    const grade = await GradeHorario.findOneAndUpdate(
      { cursoId, semestre: semestreNumero },
      { $set: { aulas: aulaDocs }, $setOnInsert: { cursoId, semestre: semestreNumero } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const idsAtuais = new Set(grade.aulas.map(aula => String(aula._id)));
    const turmasAssociadas = await Turma.find({ 'horarios.gradeHorarioId': grade._id });
    await Promise.all(turmasAssociadas.map(async turma => {
      let alterada = false;
      turma.horarios = turma.horarios.filter(associacao => {
        const pertenceAGrade = String(associacao.gradeHorarioId) === String(grade._id);
        const existeNaGrade = idsAtuais.has(String(associacao.aulaId));
        if (pertenceAGrade && !existeNaGrade) alterada = true;
        return !pertenceAGrade || existeNaGrade;
      });
      turma.horarios.forEach(associacao => {
        if (String(associacao.gradeHorarioId) !== String(grade._id)) return;
        const aulaAtual = grade.aulas.id(associacao.aulaId);
        if (!aulaAtual) return;
        associacao.disciplinaId = aulaAtual.disciplinaId;
        associacao.docenteId = aulaAtual.docenteId;
        associacao.dia = aulaAtual.dia;
        associacao.hora = aulaAtual.hora;
        alterada = true;
      });
      if (!turma.horarios.some(associacao => associacao.semestre === grade.semestre)) {
        turma.semestreOrganizacao = null;
        alterada = true;
      }
      if (alterada) await turma.save();
    }));

    const carregada = await GradeHorario.findById(grade._id)
      .populate('aulas.disciplinaId', 'nome codigo')
      .populate('aulas.docenteId', 'nome email rp')
      .populate('aulas.turmaId', 'codigo')
      .lean();
    return res.json({ mensagem: 'Grade salva no banco de dados.', grade: {
      id: String(carregada._id), cursoId: String(carregada.cursoId), semestre: carregada.semestre,
      aulas: carregada.aulas.map(aula => ({
        id: String(aula._id), disciplinaId: String(aula.disciplinaId._id), disciplinaNome: aula.disciplinaId.nome,
        disciplinaCodigo: aula.disciplinaId.codigo, docenteId: String(aula.docenteId._id),
        docenteNome: aula.docenteId.nome,
        turmaId: aula.turmaId ? String(aula.turmaId._id) : null,
        turmaCodigo: aula.turmaId ? aula.turmaId.codigo : null,
        dia: aula.dia, hora: aula.hora
      }))
    } });
  } catch (erro) {
    console.error('Erro ao salvar grade horária:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível salvar a grade horária.' });
  }
});

router.get('/turmas/:turmaId/horarios', async (req, res) => {
  try {
    const { turmaId } = req.params;
    if (!mongoose.isValidObjectId(turmaId)) return res.status(400).json({ mensagem: 'Turma inválida.' });
    const turma = await Turma.findById(turmaId).select('horarios').populate('horarios.docenteId', 'nome').populate('horarios.disciplinaId', 'nome codigo').lean();
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
    return res.json({ horarios: turma.horarios.map(item => ({
      gradeHorarioId: String(item.gradeHorarioId), aulaId: String(item.aulaId), disciplinaId: String(item.disciplinaId._id),
      disciplinaNome: item.disciplinaId.nome, disciplinaCodigo: item.disciplinaId.codigo,
      docenteId: String(item.docenteId._id), docenteNome: item.docenteId.nome, dia: item.dia, hora: item.hora, semestre: item.semestre
    })) });
  } catch (erro) {
    console.error('Erro ao carregar horários da turma:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar os horários da turma.' });
  }
});

router.post('/turmas/:turmaId/horarios', async (req, res) => {
  try {
    const { turmaId } = req.params;
    const { gradeHorarioId, aulaId } = req.body;
    if (![turmaId, gradeHorarioId, aulaId].every(valor => mongoose.isValidObjectId(valor))) return res.status(400).json({ mensagem: 'Turma, grade ou aula inválida.' });

    const turma = await Turma.findById(turmaId);
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
    const grade = await GradeHorario.findById(gradeHorarioId);
    if (!grade || String(grade.cursoId) !== String(turma.cursoId)) return res.status(400).json({ mensagem: 'A turma deve pertencer ao mesmo curso da grade.' });
    if (semestreDaTurma(turma.periodoLetivo) !== grade.semestre) return res.status(409).json({ mensagem: 'A turma só pode ser associada a aulas do semestre letivo cadastrado para ela.' });
    if (turma.semestreOrganizacao && turma.semestreOrganizacao !== grade.semestre) {
      return res.status(409).json({ mensagem: 'Esta turma já está organizada em outro semestre do curso.' });
    }
    const aula = grade.aulas.id(aulaId);
    if (!aula) return res.status(404).json({ mensagem: 'Aula não encontrada na grade.' });
    if (turma.horarios.some(item => String(item.gradeHorarioId) === String(grade._id) && String(item.aulaId) === String(aula._id))) {
      return res.status(409).json({ mensagem: 'Esta turma já está associada a essa aula.' });
    }
    if (turma.horarios.some(item => item.semestre === grade.semestre && item.dia === aula.dia && item.hora === aula.hora)) {
      return res.status(409).json({ mensagem: 'Esta turma já possui uma aula neste dia e horário.' });
    }

    const associacaoExistente = await Turma.findOne({
      horarios: { $elemMatch: { gradeHorarioId: grade._id, aulaId: aula._id } }
    }).select('_id codigo');
    if (aula.turmaId || associacaoExistente) {
      return res.status(409).json({ mensagem: 'Esta aula já possui uma turma associada.' });
    }

    const gradeReservada = await GradeHorario.findOneAndUpdate({
      _id: grade._id,
      aulas: { $elemMatch: { _id: aula._id, $or: [{ turmaId: null }, { turmaId: { $exists: false } }] } }
    }, { $set: { 'aulas.$.turmaId': turma._id } }, { new: true });
    if (!gradeReservada) return res.status(409).json({ mensagem: 'Esta aula já possui uma turma associada.' });

    const turmaAtualizada = await Turma.findOneAndUpdate({
      _id: turma._id,
      cursoId: grade.cursoId,
      $and: [
        { $or: [{ semestreOrganizacao: null }, { semestreOrganizacao: grade.semestre }] },
        { $nor: [{ horarios: { $elemMatch: { semestre: grade.semestre, dia: aula.dia, hora: aula.hora } } }] }
      ]
    }, {
      $set: { semestreOrganizacao: grade.semestre },
      $push: { horarios: { gradeHorarioId: grade._id, aulaId: aula._id, disciplinaId: aula.disciplinaId, docenteId: aula.docenteId, dia: aula.dia, hora: aula.hora, semestre: grade.semestre } }
    }, { new: true, runValidators: true });
    if (!turmaAtualizada) {
      await GradeHorario.updateOne({ _id: grade._id, aulas: { $elemMatch: { _id: aula._id, turmaId: turma._id } } }, { $unset: { 'aulas.$.turmaId': 1 } });
      return res.status(409).json({ mensagem: 'Esta turma já possui uma aula neste dia e horário, ou está organizada em outro semestre.' });
    }
    return res.status(201).json({ mensagem: 'Turma associada à aula; docente fixado no cadastro da turma.' });
  } catch (erro) {
    console.error('Erro ao associar turma à aula:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível associar a turma à aula.' });
  }
});

router.delete('/turmas/:turmaId/horarios/:gradeHorarioId/:aulaId', async (req, res) => {
  try {
    const { turmaId, gradeHorarioId, aulaId } = req.params;
    if (![turmaId, gradeHorarioId, aulaId].every(mongoose.isValidObjectId)) return res.status(400).json({ mensagem: 'Turma, grade ou aula inválida.' });
    const [turma, grade] = await Promise.all([Turma.findById(turmaId), GradeHorario.findById(gradeHorarioId).select('semestre')]);
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
    const associacao = turma.horarios.find(item => String(item.gradeHorarioId) === String(gradeHorarioId) && String(item.aulaId) === String(aulaId));
    if (associacao && !turma.horarios.some(item => String(item.gradeHorarioId) === String(gradeHorarioId) && String(item.aulaId) !== String(aulaId) && String(item.disciplinaId) === String(associacao.disciplinaId))) {
      return res.status(409).json({ mensagem: 'Cada turma precisa manter ao menos um horário de cada disciplina do semestre.' });
    }
    turma.horarios.pull({ gradeHorarioId, aulaId });
    if (grade && !turma.horarios.some(item => item.semestre === grade.semestre)) turma.semestreOrganizacao = null;
    await turma.save();
    if (grade) {
      await GradeHorario.updateOne(
        { _id: gradeHorarioId, aulas: { $elemMatch: { _id: aulaId, turmaId } } },
        { $unset: { 'aulas.$.turmaId': 1 } }
      );
    }
    return res.json({ mensagem: 'Associação removida.' });
  } catch (erro) {
    console.error('Erro ao remover associação de turma:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível remover a associação.' });
  }
});

router.get('/disciplinas', async (req, res) => {
  try {
    const { cursoId, semestre } = req.query;
    const filtro = {};

    if (cursoId) {
      if (!mongoose.isValidObjectId(cursoId)) {
        return res.status(400).json({ mensagem: 'O curso informado é inválido.' });
      }
      filtro.cursoId = cursoId;
    }
    if (semestre !== undefined) {
      const semestreNumerico = Number(semestre);
      if (!Number.isInteger(semestreNumerico) || semestreNumerico < 1) {
        return res.status(400).json({ mensagem: 'Informe um semestre válido.' });
      }
      filtro.semestre = semestreNumerico;
    }

    const disciplinas = await Disciplina.find(filtro)
      .populate('cursoId', 'codigo nome')
      .sort({ nome: 1 })
      .lean();

    return res.json({
      disciplinas: disciplinas.map(disciplina => ({
        ...disciplina,
        id: String(disciplina._id),
        curso: disciplina.cursoId
          ? { id: String(disciplina.cursoId._id), codigo: disciplina.cursoId.codigo, nome: disciplina.cursoId.nome }
          : null,
        cursoId: disciplina.cursoId ? String(disciplina.cursoId._id) : null
      }))
    });
  } catch (erro) {
    console.error('Erro ao listar disciplinas:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar as disciplinas.' });
  }
});

router.put('/disciplinas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, codigo, cursoId, semestre, descricao } = req.body;
    const semestreNumero = Number(semestre);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(cursoId) || ![nome, codigo, descricao].every(valor => typeof valor === 'string' && valor.trim()) || !Number.isInteger(semestreNumero) || semestreNumero < 1) {
      return res.status(400).json({ mensagem: 'Preencha os dados da disciplina com valores válidos.' });
    }
    const curso = await Curso.findById(cursoId).select('codigo duracao');
    if (!curso) return res.status(404).json({ mensagem: 'Curso não encontrado.' });
    if (semestreNumero > curso.duracao) return res.status(400).json({ mensagem: 'O semestre deve estar dentro da duração do curso.' });
    const codigoCompleto = codigo.trim();
    const disciplinaAtual = await Disciplina.findById(id).select('codigo semestre');
    if (!disciplinaAtual) return res.status(404).json({ mensagem: 'Disciplina não encontrada.' });
    const sufixoSemestre = String(semestreNumero).padStart(2, '0');
    const prefixoEsperado = `${curso.codigo}${sufixoSemestre}`;
    const codigoNovoValido = /^\d{2}$/.test(curso.codigo) && new RegExp(`^${prefixoEsperado}\\d{2}$`).test(codigoCompleto);
    const codigoLegadoPreservado = codigoCompleto === disciplinaAtual.codigo && semestreNumero === disciplinaAtual.semestre;
    if (!codigoNovoValido && !codigoLegadoPreservado) {
      return res.status(400).json({ mensagem: `O código deve seguir o padrão ${prefixoEsperado}XX, com sequência de dois dígitos.` });
    }
    if (await Disciplina.exists({ codigo: codigoCompleto, _id: { $ne: id } })) {
      return res.status(409).json({ mensagem: 'Este código de disciplina já está cadastrado.' });
    }
    const disciplina = await Disciplina.findByIdAndUpdate(id, { nome: nome.trim(), codigo: codigoCompleto, cursoId: curso._id, semestre: semestreNumero, descricao: descricao.trim() }, { new: true, runValidators: true });
    if (!disciplina) return res.status(404).json({ mensagem: 'Disciplina não encontrada.' });
    return res.json({ mensagem: 'Disciplina atualizada com sucesso.', disciplina: { id: String(disciplina._id), nome: disciplina.nome, codigo: disciplina.codigo, cursoId: String(disciplina.cursoId), semestre: disciplina.semestre, descricao: disciplina.descricao } });
  } catch (erro) {
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Já existe uma disciplina com este código neste curso.' });
    console.error('Erro ao atualizar disciplina:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível atualizar a disciplina.' });
  }
});

router.delete('/disciplinas/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ mensagem: 'Disciplina inválida.' });
    const disciplina = await Disciplina.findById(req.params.id);
    if (!disciplina) return res.status(404).json({ mensagem: 'Disciplina não encontrada.' });
    const [grade, turma] = await Promise.all([
      GradeHorario.exists({ 'aulas.disciplinaId': disciplina._id }),
      Turma.exists({ 'horarios.disciplinaId': disciplina._id })
    ]);
    if (grade || turma) return res.status(409).json({ mensagem: 'Remova os horários de aula associados antes de excluir esta disciplina.' });
    await disciplina.deleteOne();
    return res.json({ mensagem: 'Disciplina excluída com sucesso.' });
  } catch (erro) {
    console.error('Erro ao excluir disciplina:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível excluir a disciplina.' });
  }
});

router.post('/disciplinas', async (req, res) => {
  try {
    const { nome, codigo, cursoId, semestre, descricao } = req.body;
    const semestreNumerico = Number(semestre);

    if (
      typeof nome !== 'string' || !nome.trim() ||
      typeof codigo !== 'string' || !codigo.trim() ||
      typeof descricao !== 'string' || !descricao.trim() ||
      !mongoose.isValidObjectId(cursoId) ||
      !Number.isInteger(semestreNumerico) || semestreNumerico < 1
    ) {
      return res.status(400).json({ mensagem: 'Preencha todos os campos com valores válidos.' });
    }

    const curso = await Curso.findById(cursoId).select('codigo nome duracao');
    if (!curso) return res.status(404).json({ mensagem: 'O curso selecionado não foi encontrado.' });
    if (!/^\d{2}$/.test(curso.codigo)) {
      return res.status(400).json({ mensagem: 'O curso precisa ter um código de dois dígitos antes do cadastro da disciplina.' });
    }
    if (semestreNumerico > curso.duracao) {
      return res.status(400).json({ mensagem: 'O semestre informado não pertence à duração deste curso.' });
    }

    const codigoComplemento = codigo.trim();
    const sufixoSemestre = String(semestreNumerico).padStart(2, '0');
    const prefixoEsperado = `${curso.codigo}${sufixoSemestre}`;
    if (!new RegExp(`^${prefixoEsperado}\\d{2}$`).test(codigoComplemento)) {
      return res.status(400).json({ mensagem: `O código deve seguir o padrão ${prefixoEsperado}XX, com sequência de dois dígitos.` });
    }
    const codigoCompleto = codigoComplemento;
    if (await Disciplina.exists({ codigo: codigoCompleto })) {
      return res.status(409).json({ mensagem: 'Este código de disciplina já está cadastrado.' });
    }

    const disciplina = await Disciplina.create({
      nome: nome.trim(),
      codigo: codigoCompleto,
      cursoId: curso._id,
      semestre: semestreNumerico,
      descricao: descricao.trim()
    });

    return res.status(201).json({
      mensagem: 'Disciplina cadastrada com sucesso.',
      disciplina: {
        id: String(disciplina._id),
        nome: disciplina.nome,
        codigo: disciplina.codigo,
        cursoId: String(disciplina.cursoId),
        semestre: disciplina.semestre,
        descricao: disciplina.descricao
      }
    });
  } catch (erro) {
    console.error('Erro ao cadastrar disciplina:', erro);
    if (erro.code === 11000) {
      return res.status(409).json({ mensagem: 'Já existe uma disciplina com este código neste curso.' });
    }
    return res.status(500).json({ mensagem: 'Não foi possível cadastrar a disciplina.' });
  }
});

router.get('/docentes', async (req, res) => {
  try {
    const docentes = await Docente.find().select('nome email rp cpf telefone especialidade endereco descricao instituicao').sort({ nome: 1 }).lean();
    return res.json({ docentes: docentes.map(docente => ({ ...docente, id: String(docente._id) })) });
  } catch (erro) {
    console.error('Erro ao listar docentes:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar os docentes.' });
  }
});

router.put('/docentes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const campos = ['nome', 'email', 'cpf', 'telefone', 'especialidade', 'endereco', 'descricao'];
    if (!mongoose.isValidObjectId(id) || !['nome', 'email'].every(campo => typeof req.body[campo] === 'string' && req.body[campo].trim())) return res.status(400).json({ mensagem: 'Informe nome e e-mail válidos.' });
    const atualizacao = {};
    for (const campo of campos) if (req.body[campo] !== undefined) atualizacao[campo] = String(req.body[campo]).trim();
    atualizacao.email = atualizacao.email.toLowerCase();
    for (const campo of ['instituicaoNome', 'instituicaoCodigo']) if (req.body[campo] !== undefined) atualizacao[campo === 'instituicaoNome' ? 'instituicao.nome' : 'instituicao.codigo'] = String(req.body[campo]).trim();
    const docenteAtual = await Docente.findById(id).select('rp email');
    if (!docenteAtual) return res.status(404).json({ mensagem: 'Docente não encontrado.' });
    const usuarioEmailEmUso = atualizacao.email !== docenteAtual.email
      ? await Usuario.exists({ email: atualizacao.email })
      : false;
    if (usuarioEmailEmUso) return res.status(409).json({ mensagem: 'Este e-mail já está vinculado a outro usuário docente.' });
    const docente = await Docente.findByIdAndUpdate(id, { $set: atualizacao }, { new: true, runValidators: true });
    if (!docente) return res.status(404).json({ mensagem: 'Docente não encontrado.' });
    const filtrosUsuario = [{ email: req.body.emailAnterior || docenteAtual.email }];
    if (docente.rp) filtrosUsuario.push({ rp: docente.rp });
    await Usuario.updateMany({ $or: filtrosUsuario, papeis: 'docente' }, { $set: { nome: docente.nome, email: docente.email, telefone: docente.telefone || '' } });
    return res.json({ mensagem: 'Docente atualizado com sucesso.', docente: { ...docente.toObject(), id: String(docente._id) } });
  } catch (erro) {
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Este e-mail ou RP já está cadastrado.' });
    console.error('Erro ao atualizar docente:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível atualizar o docente.' });
  }
});

router.delete('/docentes/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ mensagem: 'Docente inválido.' });
    const docente = await Docente.findById(req.params.id);
    if (!docente) return res.status(404).json({ mensagem: 'Docente não encontrado.' });
    const [aulaEmGrade, horarioEmTurma] = await Promise.all([
      GradeHorario.exists({ 'aulas.docenteId': docente._id }),
      Turma.exists({ 'horarios.docenteId': docente._id })
    ]);
    if (aulaEmGrade || horarioEmTurma) return res.status(409).json({ mensagem: 'Remova as aulas atribuídas a este docente antes de excluí-lo.' });
    const usuarioFiltro = { papeis: 'docente', $or: [{ email: docente.email }, ...(docente.rp ? [{ rp: docente.rp }] : [])] };
    const usuarios = await Usuario.find(usuarioFiltro).select('_id papeis');
    for (const usuario of usuarios) {
      if (usuario.papeis.length > 1) { usuario.papeis = usuario.papeis.filter(papel => papel !== 'docente'); usuario.rp = undefined; await usuario.save(); }
      else await Usuario.deleteOne({ _id: usuario._id });
    }
    await docente.deleteOne();
    return res.json({ mensagem: 'Docente removido com sucesso.' });
  } catch (erro) {
    console.error('Erro ao remover docente:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível remover o docente.' });
  }
});

router.post('/administradores', async (req, res) => {
  try {
    const { nome, email, telefone, senha, nivelPermissao } = req.body;
    const niveisPermitidos = ['admin_mestre', 'admin_2', 'admin_3'];
    if (
      ![nome, email, telefone].every(valor => typeof valor === 'string' && valor.trim()) ||
      typeof senha !== 'string' || senha.length < 8 ||
      !niveisPermitidos.includes(nivelPermissao)
    ) {
      return res.status(400).json({ mensagem: 'Preencha os campos obrigatórios e informe uma senha com pelo menos 8 caracteres.' });
    }
    const emailTratado = email.trim().toLowerCase();
    const senhaHash = await bcrypt.hash(senha, 10);
    const administrador = new Usuario({
      nome: nome.trim(), email: emailTratado, telefone: telefone.trim(),
      nivelPermissao, senha: senhaHash, papeis: ['admin']
    });
    await administrador.save();
    return res.status(201).json({ mensagem: 'Administrador cadastrado com sucesso.' });
  } catch (erro) {
    console.error('Erro ao cadastrar administrador:', erro);
    if (erro.code === 11000) return res.status(409).json({ mensagem: 'Este e-mail já está cadastrado.' });
    return res.status(500).json({ mensagem: 'Não foi possível cadastrar o administrador.' });
  }
});

router.post('/cursos', async (req, res) => {
  try {
    const { codigo, nome, unidade, grau, modalidade, duracao, descricao } = req.body;
    const duracaoNumerica = Number(duracao);
    const grausPermitidos = ['Bacharelado', 'Licenciatura', 'Tecnólogo', 'Pós-Graduação', 'Mestrado', 'Pós Doutorado'];
    const modalidadesPermitidas = ['Presencial', 'Semipresencial', 'Ensino a Distância (EAD)'];

    if (typeof codigo !== 'string' || !/^\d{2}$/.test(codigo.trim()) || !nome || !unidade || !grausPermitidos.includes(grau) || !modalidadesPermitidas.includes(modalidade) || !Number.isInteger(duracaoNumerica)) {
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

      codigoMatricula = await proximoRaEstudante();

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
