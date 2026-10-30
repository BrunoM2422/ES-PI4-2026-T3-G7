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

const router = express.Router();

function normalizarCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '');
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

router.get('/turmas', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.cursoId) {
      if (!mongoose.isValidObjectId(req.query.cursoId)) return res.status(400).json({ mensagem: 'O curso informado é inválido.' });
      filtro.cursoId = req.query.cursoId;
    }
    if (req.query.semestre !== undefined) {
      const semestre = Number(req.query.semestre);
      if (!Number.isInteger(semestre) || semestre < 1 || semestre > 20) return res.status(400).json({ mensagem: 'O semestre informado é inválido.' });
      filtro.$or = [{ semestreOrganizacao: null }, { semestreOrganizacao: semestre }];
    }
    const turmas = await Turma.find(filtro)
      .populate('cursoId', 'codigo nome')
      .populate('horarios.disciplinaId', 'nome codigo')
      .populate('horarios.docenteId', 'nome')
      .sort({ periodoLetivo: -1, codigo: 1 })
      .lean();

    return res.json({
      turmas: turmas.map(turma => ({
        ...turma,
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
      typeof periodoLetivo !== 'string' || !periodoLetivo.trim() ||
      !mongoose.isValidObjectId(cursoId) ||
      !Number.isInteger(vagasNumericas) || vagasNumericas < 1 || vagasNumericas > 300
    ) {
      return res.status(400).json({ mensagem: 'Preencha código, curso, período letivo e vagas com valores válidos.' });
    }

    const curso = await Curso.findById(cursoId).select('_id');
    if (!curso) return res.status(404).json({ mensagem: 'O curso selecionado não foi encontrado.' });

    const turma = await Turma.create({
      codigo: codigo.trim().toUpperCase(),
      cursoId: curso._id,
      periodoLetivo: periodoLetivo.trim(),
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
    const disciplinaHorarioKeys = new Set();
    for (const aula of aulas) {
      const key = `${aula.dia}:${aula.hora}`;
      const disciplinaHorarioKey = `${aula.disciplinaId}:${key}`;
      if (disciplinaHorarioKeys.has(disciplinaHorarioKey)) return res.status(409).json({ mensagem: 'A mesma disciplina não pode ser adicionada duas vezes no mesmo horário.' });
      disciplinaHorarioKeys.add(disciplinaHorarioKey);
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
    if (semestreNumerico > curso.duracao) {
      return res.status(400).json({ mensagem: 'O semestre informado não pertence à duração deste curso.' });
    }

    const disciplina = await Disciplina.create({
      nome: nome.trim(),
      codigo: codigo.trim().toUpperCase(),
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
    const docentes = await Docente.find().select('nome email rp especialidade').sort({ nome: 1 }).lean();
    return res.json({ docentes: docentes.map(docente => ({ ...docente, id: String(docente._id) })) });
  } catch (erro) {
    console.error('Erro ao listar docentes:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar os docentes.' });
  }
});

router.post('/administradores', async (req, res) => {
  try {
    const { nome, email, telefone, nivelPermissao } = req.body;
    const niveisPermitidos = ['admin_mestre', 'admin_2', 'admin_3'];
    if (
      ![nome, email, telefone].every(valor => typeof valor === 'string' && valor.trim()) ||
      !niveisPermitidos.includes(nivelPermissao)
    ) {
      return res.status(400).json({ mensagem: 'Preencha nome, e-mail, telefone e nível de permissão.' });
    }
    const emailTratado = email.trim().toLowerCase();
    const senha = await bcrypt.hash('123456', 10);
    const administrador = new Usuario({
      nome: nome.trim(), email: emailTratado, telefone: telefone.trim(),
      nivelPermissao, senha, papeis: ['admin']
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
