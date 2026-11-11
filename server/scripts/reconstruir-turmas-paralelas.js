require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Curso = require('../models/Curso');
const Disciplina = require('../models/Disciplina');
const Docente = require('../models/Docente');
const Usuario = require('../models/Usuario');
const Estudante = require('../models/Estudante');
const GradeHorario = require('../models/GradeHorario');
const Turma = require('../models/Turma');
const Evento = require('../models/Evento');

const GRUPOS = 3;
const VAGAS = 40;
const DIAS = [1, 2, 3, 4, 5];
const HORAS = [8, 9, 10, 11];
const ESPECIALIDADES = ['Tecnologia e Sistemas', 'Métodos e Projetos', 'Práticas Profissionais', 'Dados e Pesquisa', 'Inovação e Sociedade', 'Laboratórios Integradores', 'Gestão e Planejamento'];
const senhaPadrao = 'NotaDez2026!';

function codigoTurma(curso, semestre, grupo) {
  return `${curso.codigo}${String(semestre).padStart(2, '0')}${String(grupo).padStart(2, '0')}`;
}

async function fazerBackup(nome, model) {
  const backupNome = `${nome}_backup_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
  await model.collection.aggregate([{ $match: {} }, { $out: backupNome }]).toArray();
  return backupNome;
}

async function garantirDocentes(quantidade) {
  const senha = await bcrypt.hash(senhaPadrao, 10);
  const cadastrados = await Docente.find().sort({ email: 1 });
  const porEmail = new Map(cadastrados.map(docente => [docente.email.toLowerCase(), docente]));
  let novos = 0;
  for (let indice = 1; porEmail.size < quantidade; indice++) {
    const sufixo = String(indice).padStart(3, '0');
    const email = `docente.grade${sufixo}@example.com`;
    if (porEmail.has(email)) continue;
    let docente = await Docente.findOne({ email });
    if (!docente) {
      const rp = `P2026G${sufixo}`;
      const rpExistente = await Docente.findOne({ rp });
      docente = rpExistente || await Docente.create({
        rp, nome: `Docente Demonstrativo ${sufixo}`, email,
        especialidade: ESPECIALIDADES[(indice - 1) % ESPECIALIDADES.length],
        instituicao: { nome: 'Faculdade NotaDez - Campinas', codigo: 'ND' }
      });
      novos++;
    }
    await Usuario.findOneAndUpdate({ email: docente.email }, {
      $setOnInsert: { nome: docente.nome, email: docente.email, senha, papeis: ['docente'], rp: docente.rp }
    }, { upsert: true, setDefaultsOnInsert: true });
    porEmail.set(docente.email.toLowerCase(), docente);
  }
  return { docentes: [...porEmail.values()].slice(0, quantidade), novos };
}

async function executar() {
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI antes de executar a migração.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'NotaDez' });
  const cursos = await Curso.find().sort({ codigo: 1 });
  if (!cursos.length) throw new Error('Nenhum curso foi encontrado.');
  const coortes = cursos.flatMap(curso => Array.from({ length: curso.duracao }, (_, i) => ({ curso, semestre: i + 1 })));
  const quantidadeTurmas = coortes.length * GRUPOS;
  const { docentes, novos: docentesNovos } = await garantirDocentes(quantidadeTurmas);
  const disciplinasPorCoorte = new Map();
  for (const { curso, semestre } of coortes) {
    const disciplinas = await Disciplina.find({ cursoId: curso._id, semestre }).sort({ codigo: 1 });
    if (!disciplinas.length || disciplinas.length > DIAS.length * HORAS.length) {
      throw new Error(`${curso.nome}, ${semestre}º semestre precisa ter entre 1 e 20 disciplinas para a grade matutina.`);
    }
    disciplinasPorCoorte.set(`${curso._id}:${semestre}`, disciplinas);
  }

  const backupTurmas = await fazerBackup('turmas', Turma);
  const backupGrades = await fazerBackup('grades_horarios', GradeHorario);
  const backupEstudantes = await fazerBackup('estudantes', Estudante);
  const backupEventos = await fazerBackup('eventos', Evento);

  const turmasAntigas = await Turma.find().lean();
  const estudantes = await Estudante.find().sort({ ra: 1, _id: 1 });
  const estudantesPorCoorte = new Map();
  for (const estudante of estudantes) {
    for (const matricula of estudante.gradeMatriculas || []) {
      const disciplina = await Disciplina.findById(matricula.disciplinaId).select('cursoId semestre').lean();
      if (!disciplina) continue;
      const chave = `${disciplina.cursoId}:${disciplina.semestre}`;
      if (!estudantesPorCoorte.has(chave)) estudantesPorCoorte.set(chave, new Set());
      estudantesPorCoorte.get(chave).add(String(estudante._id));
    }
  }
  const grupoPorAlunoCoorte = new Map();
  for (const [chave, ids] of estudantesPorCoorte) {
    const ordenados = [...ids].sort();
    if (ordenados.length > GRUPOS * VAGAS) throw new Error(`Há mais de ${GRUPOS * VAGAS} alunos matriculados em ${chave}; aumente as vagas antes da migração.`);
    ordenados.forEach((id, indice) => grupoPorAlunoCoorte.set(`${id}:${chave}`, (indice % GRUPOS) + 1));
  }

  const turmasNovas = new Map();
  for (const { curso, semestre } of coortes) {
    const chave = `${curso._id}:${semestre}`;
    for (let grupo = 1; grupo <= GRUPOS; grupo++) {
      const codigo = codigoTurma(curso, semestre, grupo);
      const turma = await Turma.findOneAndUpdate({ codigo }, {
        $set: { cursoId: curso._id, periodoLetivo: String(semestre), vagas: VAGAS, semestreOrganizacao: semestre, horarios: [], alunosIds: [] },
        $setOnInsert: { codigo }
      }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
      turmasNovas.set(`${chave}:${grupo}`, turma);
    }
  }

  for (const estudante of estudantes) {
    const novasMatriculas = [];
    const vistos = new Set();
    for (const matricula of estudante.gradeMatriculas || []) {
      const disciplina = await Disciplina.findById(matricula.disciplinaId).select('cursoId semestre').lean();
      if (!disciplina) continue;
      const chave = `${disciplina.cursoId}:${disciplina.semestre}`;
      const grupo = grupoPorAlunoCoorte.get(`${estudante._id}:${chave}`) || 1;
      const turma = turmasNovas.get(`${chave}:${grupo}`);
      if (!turma || vistos.has(String(disciplina._id))) continue;
      vistos.add(String(disciplina._id));
      novasMatriculas.push({ turmaId: turma._id, disciplinaId: disciplina._id });
      if (!turma.alunosIds.some(id => String(id) === String(estudante._id))) turma.alunosIds.push(estudante._id);
    }
    estudante.gradeMatriculas = novasMatriculas;
    estudante.turmaId = undefined;
    await estudante.save();
  }

  let globalGrupo = 0;
  let totalAulas = 0;
  const gradesAtuais = [];
  for (const { curso, semestre } of coortes) {
    const chave = `${curso._id}:${semestre}`;
    const disciplinas = disciplinasPorCoorte.get(chave);
    const grade = await GradeHorario.findOneAndUpdate({ cursoId: curso._id, semestre }, {
      $set: { cursoId: curso._id, semestre, aulas: [] }
    }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
    const registrosGrade = [];
    for (let grupo = 1; grupo <= GRUPOS; grupo++) {
      const turma = turmasNovas.get(`${chave}:${grupo}`);
      turma.horarios = [];
      const indiceGrupoGlobal = globalGrupo++;
      let indiceSlot = 0;
      for (const dia of DIAS) for (const hora of HORAS) {
        const disciplina = disciplinas[indiceSlot % disciplinas.length];
        const docente = docentes[(indiceGrupoGlobal + indiceSlot * 37) % docentes.length];
        const aulaId = new mongoose.Types.ObjectId();
        const aula = { _id: aulaId, disciplinaId: disciplina._id, docenteId: docente._id, turmaId: turma._id, dia, hora };
        registrosGrade.push(aula);
        turma.horarios.push({ gradeHorarioId: grade._id, aulaId, disciplinaId: disciplina._id, docenteId: docente._id, dia, hora, semestre });
        indiceSlot++;
      }
      await turma.save();
      totalAulas += turma.horarios.length;
    }
    grade.aulas = registrosGrade;
    await grade.save();
    gradesAtuais.push(grade);
  }

  const idsNovas = [...turmasNovas.values()].map(turma => turma._id);
  const idsAntigas = turmasAntigas.filter(turma => !idsNovas.some(id => String(id) === String(turma._id)));
  const idsRemover = idsAntigas.map(turma => turma._id);
  if (idsRemover.length) {
    const ordemPorCoorte = new Map();
    for (const antiga of [...idsAntigas].sort((a, b) => String(a.cursoId).localeCompare(String(b.cursoId)) || Number(a.periodoLetivo) - Number(b.periodoLetivo) || String(a.codigo).localeCompare(String(b.codigo)))) {
      const semestre = Number.parseInt(antiga.periodoLetivo, 10);
      const chave = `${antiga.cursoId}:${semestre}`;
      const grupoInformado = Number(String(antiga.codigo).slice(-2));
      let grupo = grupoInformado >= 1 && grupoInformado <= GRUPOS ? grupoInformado : null;
      if (!grupo) {
        const indice = ordemPorCoorte.get(chave) || 0;
        grupo = (indice % GRUPOS) + 1;
        ordemPorCoorte.set(chave, indice + 1);
      }
      const nova = turmasNovas.get(`${chave}:${grupo}`);
      if (nova) await Evento.updateMany({ turmaId: antiga._id }, { $set: { turmaId: nova._id, scope: 'turma' } });
      else await Evento.updateMany({ turmaId: antiga._id }, { $unset: { turmaId: 1 }, $set: { scope: 'global' } });
    }
    await Turma.deleteMany({ _id: { $in: idsRemover } });
  }

  const [turmasFinales, gradesFinales, alunosFinais] = await Promise.all([
    Turma.find().select('cursoId periodoLetivo codigo horarios alunosIds').lean(),
    GradeHorario.find().select('cursoId semestre aulas').lean(),
    Estudante.find().select('gradeMatriculas').lean()
  ]);
  const erros = [];
  for (const { curso, semestre } of coortes) {
    const disciplinas = disciplinasPorCoorte.get(`${curso._id}:${semestre}`);
    const idsDisciplina = new Set(disciplinas.map(item => String(item._id)));
    const turmas = turmasFinales.filter(turma => String(turma.cursoId) === String(curso._id) && Number(turma.periodoLetivo) === semestre);
    if (turmas.length !== 3) erros.push(`${curso.codigo}/${semestre}: esperadas 3 turmas, encontradas ${turmas.length}`);
    for (const turma of turmas) {
      const ofertas = new Set(turma.horarios.map(item => String(item.disciplinaId)));
      if ([...idsDisciplina].some(id => !ofertas.has(id))) erros.push(`${turma.codigo}: falta oferta de disciplina`);
      const slots = new Set(turma.horarios.map(item => `${item.dia}:${item.hora}`));
      if (slots.size !== 20 || turma.horarios.length !== 20) erros.push(`${turma.codigo}: grade matutina incompleta ou com conflito`);
      if (turma.alunosIds.length > turma.vagas) erros.push(`${turma.codigo}: excede capacidade`);
    }
  }
  const professoresPorHorario = new Set();
  for (const grade of gradesFinales) for (const aula of grade.aulas) {
    const chave = `${aula.docenteId}:${aula.dia}:${aula.hora}`;
    if (professoresPorHorario.has(chave)) erros.push(`Conflito de docente em ${chave}`);
    professoresPorHorario.add(chave);
  }
  for (const estudante of alunosFinais) {
    const ids = estudante.gradeMatriculas.map(item => String(item.disciplinaId));
    if (new Set(ids).size !== ids.length) erros.push('Aluno com disciplina duplicada após migração');
  }

  console.log(JSON.stringify({
    cursos: cursos.length, semestres: coortes.length, turmasPorSemestre: GRUPOS,
    turmasAtivas: turmasNovas.size, disciplinas: [...disciplinasPorCoorte.values()].reduce((n, itens) => n + itens.length, 0),
    docentes: docentes.length, docentesCriados: docentesNovos, aulas: totalAulas,
    turmasAntigasRemovidas: idsRemover.length, alunosMigrados: estudantes.length,
    erros, backups: [backupTurmas, backupGrades, backupEstudantes, backupEventos], senhaDocentesCriados: senhaPadrao
  }, null, 2));
  if (erros.length) throw new Error('A validação final encontrou inconsistências.');
}

executar()
  .catch(erro => { console.error('Falha ao reconstruir turmas paralelas:', erro.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect().catch(() => {}); });
