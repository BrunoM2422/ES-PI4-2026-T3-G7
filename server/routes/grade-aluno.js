const express = require('express');
const mongoose = require('mongoose');
const { autenticar } = require('../services/autenticacao');
const Estudante = require('../models/Estudante');
const Disciplina = require('../models/Disciplina');
const Turma = require('../models/Turma');
const OpcoesSistema = require('../models/OpcoesSistema');

const router = express.Router();
const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

async function estudanteAtivo(req) {
  if (req.usuario.papel !== 'aluno') return { erro: 'Apenas alunos podem acessar a grade curricular.', status: 403 };
  const estudante = await Estudante.findOne({ email: req.usuario.email });
  if (!estudante) return { erro: 'Cadastro de aluno não encontrado.', status: 404 };
  if (estudante.statusAcademico === 'trancado') return { erro: 'Alunos com matrícula trancada não podem montar a grade.', status: 403 };
  if (!estudante.cursoId) return { erro: 'Seu cadastro ainda não possui um curso vinculado.', status: 409 };
  const opcoes = await OpcoesSistema.findById('opcoes-academicas').select('gradeCursosLiberados').lean();
  if (!(opcoes?.gradeCursosLiberados || []).some(id => String(id) === String(estudante.cursoId))) {
    return { erro: 'A Grade Curricular não está liberada para o seu curso.', status: 403 };
  }
  return { estudante };
}

function mapearHorario(item) {
  return {
    dia: item.dia, diaNome: dias[item.dia], hora: item.hora,
    semestre: item.semestre, docente: item.docenteId?.nome || ''
  };
}

router.get('/', autenticar, async (req, res) => {
  try {
    const resultado = await estudanteAtivo(req);
    if (resultado.erro) return res.status(resultado.status).json({ mensagem: resultado.erro });
    const { estudante } = resultado;
    const [disciplinas, turmas] = await Promise.all([
      Disciplina.find({ cursoId: estudante.cursoId }).sort({ semestre: 1, codigo: 1 }).lean(),
      Turma.find({ cursoId: estudante.cursoId, 'horarios.0': { $exists: true } })
        .populate('horarios.disciplinaId', 'nome codigo')
        .populate('horarios.docenteId', 'nome')
        .lean()
    ]);
    const matriculasSalvas = (estudante.gradeMatriculas || []).map(item => ({
      turmaId: String(item.turmaId), disciplinaId: String(item.disciplinaId)
    }));
    const matriculasPorDisciplina = new Map(matriculasSalvas.map(item => [item.disciplinaId, item.turmaId]));
    const disciplinasPorId = new Map(disciplinas.map(disciplina => [String(disciplina._id), {
      id: String(disciplina._id), nome: disciplina.nome, codigo: disciplina.codigo,
      semestre: disciplina.semestre, descricao: disciplina.descricao, turmas: []
    }]));

    for (const turma of turmas) {
      const idsDisciplinas = new Set((turma.horarios || []).map(item => String(item.disciplinaId?._id || item.disciplinaId)));
      for (const disciplinaId of idsDisciplinas) {
        const disciplina = disciplinasPorId.get(disciplinaId);
        if (!disciplina) continue;
        const preenchidas = (turma.alunosIds || []).length;
        const horarios = (turma.horarios || [])
          .filter(horario => String(horario.disciplinaId?._id || horario.disciplinaId) === disciplinaId)
          .map(mapearHorario);
        disciplina.turmas.push({
          id: String(turma._id), codigo: turma.codigo, periodoLetivo: turma.periodoLetivo,
          vagas: turma.vagas, preenchidas,
          vagasDisponiveis: Math.max(0, turma.vagas - preenchidas),
          matriculado: (turma.alunosIds || []).some(id => String(id) === String(estudante._id)),
          selecionada: matriculasPorDisciplina.get(disciplinaId) === String(turma._id),
          horarios
        });
      }
    }

    const listaDisciplinas = [...disciplinasPorId.values()].map(disciplina => ({
      ...disciplina,
      turmas: disciplina.turmas.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
    }));
    return res.json({ disciplinas: listaDisciplinas, matriculas: matriculasSalvas });
  } catch (erro) {
    console.error('Erro ao carregar grade do aluno:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar as disciplinas e turmas.' });
  }
});

router.put('/', autenticar, async (req, res) => {
  try {
    const resultado = await estudanteAtivo(req);
    if (resultado.erro) return res.status(resultado.status).json({ mensagem: resultado.erro });
    const { estudante } = resultado;
    const enviadas = req.body?.matriculas;
    if (!Array.isArray(enviadas) || enviadas.some(item =>
      !item || !mongoose.isValidObjectId(item.turmaId) || !mongoose.isValidObjectId(item.disciplinaId)
    )) return res.status(400).json({ mensagem: 'A lista de matérias e turmas selecionadas é inválida.' });

    const matriculas = enviadas.map(item => ({ turmaId: String(item.turmaId), disciplinaId: String(item.disciplinaId) }));
    const disciplinasSelecionadas = new Set(matriculas.map(item => item.disciplinaId));
    const chavesUnicas = new Set(matriculas.map(item => `${item.disciplinaId}:${item.turmaId}`));
    if (disciplinasSelecionadas.size !== matriculas.length || chavesUnicas.size !== matriculas.length) {
      return res.status(400).json({ mensagem: 'Escolha no máximo uma turma para cada matéria.' });
    }

    const bloqueio = await Estudante.findOneAndUpdate({
      _id: estudante._id,
      $or: [{ gradeLockAt: null }, { gradeLockAt: { $exists: false } }, { gradeLockAt: { $lt: new Date(Date.now() - 120000) } }]
    }, { $set: { gradeLockAt: new Date() } }, { new: true });
    if (!bloqueio) return res.status(409).json({ mensagem: 'Sua grade está sendo salva em outra solicitação. Tente novamente.' });

    const adicionadas = [];
    let gradeAtualizada = false;
    try {
      const idsTurma = [...new Set(matriculas.map(item => item.turmaId))];
      const turmas = idsTurma.length
        ? await Turma.find({ _id: { $in: idsTurma }, cursoId: estudante.cursoId }).populate('horarios.disciplinaId', 'nome codigo').lean()
        : [];
      if (turmas.length !== idsTurma.length) return res.status(400).json({ mensagem: 'Uma ou mais turmas não pertencem ao seu curso ou não estão disponíveis.' });
      const turmasPorId = new Map(turmas.map(turma => [String(turma._id), turma]));
      const disciplinasDoCurso = new Set((await Disciplina.find({ cursoId: estudante.cursoId }).select('_id').lean()).map(item => String(item._id)));
      const horariosOcupados = new Set();

      for (const matricula of matriculas) {
        const turma = turmasPorId.get(matricula.turmaId);
        if (!disciplinasDoCurso.has(matricula.disciplinaId)) return res.status(400).json({ mensagem: 'Uma das matérias não pertence ao seu curso.' });
        const horariosDisciplina = (turma.horarios || []).filter(item => String(item.disciplinaId?._id || item.disciplinaId) === matricula.disciplinaId);
        if (!horariosDisciplina.length) return res.status(409).json({ mensagem: `A turma ${turma.codigo} não está vinculada a essa matéria.` });
        for (const horario of horariosDisciplina) {
          const chave = `${horario.dia}:${horario.hora}`;
          if (horariosOcupados.has(chave)) return res.status(409).json({ mensagem: `Conflito de horário: ${dias[horario.dia]} às ${String(horario.hora).padStart(2, '0')}:00.` });
          horariosOcupados.add(chave);
        }
      }

      const anteriores = (estudante.gradeMatriculas || []).map(item => ({ turmaId: String(item.turmaId), disciplinaId: String(item.disciplinaId) }));
      const classesAnteriores = new Set(anteriores.map(item => item.turmaId));
      const classesNovas = [...new Set(matriculas.map(item => item.turmaId))].filter(id =>
        !classesAnteriores.has(id) && !(turmasPorId.get(id).alunosIds || []).some(alunoId => String(alunoId) === String(estudante._id))
      );
      const classesRemovidas = [...classesAnteriores].filter(id => !matriculas.some(item => item.turmaId === id));

      for (const turmaId of classesNovas) {
        const turmaAtualizada = await Turma.findOneAndUpdate({
          _id: turmaId,
          cursoId: estudante.cursoId,
          $expr: { $lt: [{ $size: { $ifNull: ['$alunosIds', []] } }, '$vagas'] }
        }, { $addToSet: { alunosIds: estudante._id } }, { new: true });
        if (!turmaAtualizada) {
          if (adicionadas.length) await Turma.updateMany({ _id: { $in: adicionadas } }, { $pull: { alunosIds: estudante._id } });
          return res.status(409).json({ mensagem: `A turma ${turmasPorId.get(turmaId)?.codigo || ''} ficou sem vagas. Atualize a página e escolha outra.` });
        }
        adicionadas.push(turmaId);
      }

      await Estudante.updateOne({ _id: estudante._id }, {
        $set: { gradeMatriculas: matriculas.map(item => ({ turmaId: item.turmaId, disciplinaId: item.disciplinaId })) }
      });
      gradeAtualizada = true;
      if (classesRemovidas.length) await Turma.updateMany({ _id: { $in: classesRemovidas } }, { $pull: { alunosIds: estudante._id } });
      return res.json({ mensagem: 'Sua grade curricular foi salva.', matriculas });
    } catch (erro) {
      if (!gradeAtualizada && adicionadas.length) await Turma.updateMany({ _id: { $in: adicionadas } }, { $pull: { alunosIds: estudante._id } });
      throw erro;
    } finally {
      await Estudante.updateOne({ _id: estudante._id }, { $unset: { gradeLockAt: 1 } });
    }
  } catch (erro) {
    console.error('Erro ao salvar grade do aluno:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível salvar a grade curricular.' });
  }
});

module.exports = router;
