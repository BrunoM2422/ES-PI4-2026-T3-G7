const express = require('express');
const mongoose = require('mongoose');
const { autenticar } = require('../services/autenticacao');
const Estudante = require('../models/Estudante');
const Disciplina = require('../models/Disciplina');
const Turma = require('../models/Turma');
const Curso = require('../models/Curso');
const OpcoesSistema = require('../models/OpcoesSistema');

const router = express.Router();
const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

async function estudanteAtivo(req) {
  if (req.usuario.papel !== 'aluno') return { erro: 'Apenas alunos podem acessar a grade curricular.', status: 403 };
  const identificadores = [{ email: req.usuario.email }];
  if (req.usuario.ra) identificadores.push({ ra: req.usuario.ra });
  const estudante = await Estudante.findOne({ $or: identificadores });
  if (!estudante) return { erro: 'Cadastro de aluno não encontrado.', status: 404 };
  if (estudante.statusAcademico === 'trancado') return { erro: 'Alunos com matrícula trancada não podem montar a grade.', status: 403 };
  if (!estudante.cursoId) return { erro: 'Seu cadastro ainda não possui um curso vinculado.', status: 409 };
  const [curso, opcoes] = await Promise.all([
    Curso.findById(estudante.cursoId).select('codigo').lean(),
    OpcoesSistema.findById('opcoes-academicas').select('gradeCursosLiberados gradeEquivalenciasCursosLiberados').lean()
  ]);
  if (!curso) return { erro: 'O curso vinculado ao seu cadastro não foi encontrado.', status: 409 };
  const gradeLiberada = (opcoes?.gradeCursosLiberados || [])
    .some(id => String(id) === String(estudante.cursoId));
  const equivalenciasLiberadas = (opcoes?.gradeEquivalenciasCursosLiberados || [])
    .some(id => String(id) === String(estudante.cursoId));
  if (!gradeLiberada && !equivalenciasLiberadas) {
    return { erro: 'A Grade Curricular e a inserção de matérias equivalentes não estão liberadas para o seu curso.', status: 403 };
  }
  return { estudante, curso, gradeLiberada, equivalenciasLiberadas };
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
    const { estudante, curso, gradeLiberada, equivalenciasLiberadas } = resultado;
    const condicoesDisciplinas = [];
    if (gradeLiberada) condicoesDisciplinas.push({ cursoId: estudante.cursoId });
    if (equivalenciasLiberadas) condicoesDisciplinas.push({ equivale_para: curso.codigo, cursoId: { $ne: estudante.cursoId } });
    const filtroDisciplinas = condicoesDisciplinas.length === 1
      ? condicoesDisciplinas[0]
      : { $or: condicoesDisciplinas };
    const disciplinas = await Disciplina.find(filtroDisciplinas)
      .populate('cursoId', 'codigo nome')
      .sort({ semestre: 1, codigo: 1 })
      .lean();
    const cursoIds = [...new Set(disciplinas.map(disciplina => String(disciplina.cursoId?._id || disciplina.cursoId)))];
    const turmas = cursoIds.length
      ? await Turma.find({ cursoId: { $in: cursoIds }, 'horarios.0': { $exists: true } })
        .populate('horarios.disciplinaId', 'nome codigo')
        .populate('horarios.docenteId', 'nome')
        .populate('cursoId', 'codigo nome')
        .lean()
      : [];
    const matriculasSalvas = (estudante.gradeMatriculas || []).map(item => ({
      turmaId: String(item.turmaId), disciplinaId: String(item.disciplinaId)
    }));
    const matriculasPorDisciplina = new Map(matriculasSalvas.map(item => [item.disciplinaId, item.turmaId]));
    const disciplinasPorId = new Map(disciplinas.map(disciplina => {
      const cursoDisciplina = disciplina.cursoId;
      const cursoDisciplinaId = String(cursoDisciplina?._id || cursoDisciplina);
      return [String(disciplina._id), {
        id: String(disciplina._id), nome: disciplina.nome, codigo: disciplina.codigo,
        semestre: disciplina.semestre, descricao: disciplina.descricao, turmas: [],
        equivalente: cursoDisciplinaId !== String(estudante.cursoId),
        cursoNome: cursoDisciplina?.nome || ''
      }];
    }));

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
    const disciplinasDisponiveis = new Set(listaDisciplinas.map(disciplina => disciplina.id));
    const matriculasDisponiveis = matriculasSalvas.filter(item => disciplinasDisponiveis.has(item.disciplinaId));
    return res.json({ disciplinas: listaDisciplinas, matriculas: matriculasDisponiveis });
  } catch (erro) {
    console.error('Erro ao carregar grade do aluno:', erro);
    return res.status(500).json({ mensagem: 'Não foi possível carregar as disciplinas e turmas.' });
  }
});

router.put('/', autenticar, async (req, res) => {
  try {
    const resultado = await estudanteAtivo(req);
    if (resultado.erro) return res.status(resultado.status).json({ mensagem: resultado.erro });
    const { estudante, curso, gradeLiberada, equivalenciasLiberadas } = resultado;
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
      const idsDisciplina = [...new Set(matriculas.map(item => item.disciplinaId))];
      const [turmas, disciplinasValidas] = await Promise.all([
        idsTurma.length
          ? Turma.find({ _id: { $in: idsTurma } }).populate('horarios.disciplinaId', 'nome codigo').lean()
          : [],
        idsDisciplina.length
          ? Disciplina.find({ _id: { $in: idsDisciplina } }).select('_id cursoId equivale_para').lean()
          : []
      ]);
      if (turmas.length !== idsTurma.length) return res.status(400).json({ mensagem: 'Uma ou mais turmas não pertencem ao seu curso ou não estão disponíveis.' });
      const turmasPorId = new Map(turmas.map(turma => [String(turma._id), turma]));
      if (disciplinasValidas.length !== idsDisciplina.length) return res.status(400).json({ mensagem: 'Uma ou mais matérias não foram encontradas.' });
      const disciplinasPorId = new Map(disciplinasValidas.map(disciplina => [String(disciplina._id), disciplina]));
      const horariosOcupados = new Set();

      for (const matricula of matriculas) {
        const turma = turmasPorId.get(matricula.turmaId);
        const disciplina = disciplinasPorId.get(matricula.disciplinaId);
        const disciplinaDoCurso = gradeLiberada && String(disciplina.cursoId) === String(estudante.cursoId);
        const equivalenciaPermitida = equivalenciasLiberadas && (disciplina.equivale_para || []).includes(curso.codigo);
        if (!disciplinaDoCurso && !equivalenciaPermitida) {
          return res.status(400).json({ mensagem: 'Uma das matérias não pertence ao seu curso nem está liberada como equivalente.' });
        }
        if (String(turma.cursoId) !== String(disciplina.cursoId)) {
          return res.status(400).json({ mensagem: 'A turma selecionada não pertence ao curso da matéria.' });
        }
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
      const classesDesejadas = new Set(matriculas.map(item => item.turmaId));
      const turmaBaseId = estudante.turmaId ? String(estudante.turmaId) : null;
      const classesAConservar = new Set([...classesDesejadas, ...(turmaBaseId ? [turmaBaseId] : [])]);
      const turmasComAluno = await Turma.find({ alunosIds: estudante._id }).select('_id').lean();

      // Sincroniza pelo estado real do array da turma, inclusive registros antigos
      // que tenham gradeMatriculas sem o aluno correspondente em alunosIds.
      const classesNovas = [...classesDesejadas].filter(id =>
        !(turmasPorId.get(id).alunosIds || []).some(alunoId => String(alunoId) === String(estudante._id))
      );
      const classesRemovidas = [...new Set([
        ...classesAnteriores,
        ...turmasComAluno.map(turma => String(turma._id))
      ])].filter(id => !classesAConservar.has(id));

      for (const turmaId of classesNovas) {
        const turma = turmasPorId.get(turmaId);
        const turmaAtualizada = await Turma.findOneAndUpdate({
          _id: turmaId,
          cursoId: turma.cursoId,
          $or: [
            { alunosIds: estudante._id },
            { $expr: { $lt: [{ $size: { $ifNull: ['$alunosIds', []] } }, '$vagas'] } }
          ]
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
