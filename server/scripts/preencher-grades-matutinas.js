require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Curso = require('../models/Curso');
const Disciplina = require('../models/Disciplina');
const Docente = require('../models/Docente');
const Usuario = require('../models/Usuario');
const GradeHorario = require('../models/GradeHorario');
const Turma = require('../models/Turma');

const temasComplementares = {
  '01': ['Laboratório de Gestão', 'Gestão de Indicadores', 'Oficina de Negociação', 'Análise de Cenários', 'Projeto de Consultoria', 'Seminário de Negócios'],
  '02': ['Oficina de Prática Jurídica', 'Direito e Tecnologia', 'Clínica de Direitos Humanos', 'Estudos de Casos Jurídicos', 'Argumentação e Oratória', 'Seminário Jurídico'],
  '03': ['Laboratório de Observação', 'Psicologia e Cultura', 'Técnicas de Intervenção', 'Prática de Avaliação', 'Estudos de Caso Clínico', 'Seminário de Psicologia'],
  '04': ['Laboratório de Desenvolvimento', 'Arquitetura de Software', 'Testes Automatizados', 'DevOps e Integração Contínua', 'Projeto de Sistemas', 'Seminário de Engenharia'],
  '05': ['Laboratório de Dados', 'Modelagem Estatística', 'Aprendizado Profundo', 'Visualização Avançada', 'Projeto de Inteligência Artificial', 'Seminário de Dados'],
  '06': ['Laboratório de Circuitos', 'Sistemas Digitais', 'Projeto de Hardware', 'Automação e Robótica', 'Laboratório de Sistemas Embarcados', 'Seminário de Engenharia'],
  '07': ['Laboratório de Sistemas', 'Arquitetura de Aplicações', 'Desenvolvimento de APIs', 'Gestão de Produtos Digitais', 'Projeto de Sistemas de Informação', 'Seminário de Tecnologia'],
  '08': ['Laboratório de Infraestrutura', 'Administração de Serviços em Nuvem', 'Automação de Processos', 'Gestão de Portfólio de TI', 'Projeto de Soluções Corporativas', 'Seminário de Gestão de TI']
};
const especialidades = [
  'Tecnologia e Sistemas', 'Métodos e Projetos', 'Práticas Profissionais', 'Dados e Pesquisa',
  'Inovação e Sociedade', 'Laboratórios Integradores', 'Gestão e Planejamento'
];
const diasLetivos = [1, 2, 3, 4, 5]; // domingo = 0 no calendário do sistema
const horasMatutinas = [8, 9, 10, 11]; // blocos que terminam ao meio-dia

function chaveSlot(dia, hora) { return `${dia}:${hora}`; }
function codigoDisciplina(curso, semestre, sequencia) {
  return `${curso.codigo}${String(semestre).padStart(2, '0')}${String(sequencia).padStart(2, '0')}`;
}
function codigoTurma(semestre, sufixo) {
  return `${String(semestre).padStart(2, '0')}${String(sufixo).padStart(2, '0')}`;
}

async function garantirDocentes(quantidade) {
  const existentes = await Docente.find().sort({ nome: 1 });
  const senha = await bcrypt.hash('NotaDez2026!', 10);
  let novos = 0;
  for (let numero = 1; existentes.length < quantidade; numero++) {
    const indice = existentes.length + 1;
    const sufixo = String(indice).padStart(3, '0');
    const email = `docente.grade${sufixo}@example.com`;
    let docente = await Docente.findOne({ email });
    if (!docente) {
      docente = await Docente.create({
        rp: `P2026G${sufixo}`,
        nome: `Docente Demonstrativo ${sufixo}`,
        email,
        especialidade: especialidades[(indice - 1) % especialidades.length],
        instituicao: { nome: 'Faculdade NotaDez - Campinas', codigo: 'ND' }
      });
      novos++;
    }
    await Usuario.findOneAndUpdate({ email }, {
      $setOnInsert: { nome: docente.nome, email, senha, papeis: ['docente'], rp: docente.rp }
    }, { upsert: true, setDefaultsOnInsert: true });
    existentes.push(docente);
  }
  return { docentes: existentes, novos };
}

async function garantirDisciplinas(curso, semestre) {
  const disciplinas = await Disciplina.find({ cursoId: curso._id, semestre }).sort({ codigo: 1 });
  let novas = 0;
  const temas = temasComplementares[curso.codigo] || temasComplementares['04'];
  let sequencia = 5;
  while (disciplinas.length < 10 && sequencia <= 99) {
    const codigo = codigoDisciplina(curso, semestre, sequencia);
    sequencia++;
    if (await Disciplina.exists({ cursoId: curso._id, codigo })) continue;
    const tema = temas[(disciplinas.length - 4) % temas.length];
    const disciplina = await Disciplina.create({
      nome: `${tema} ${semestre}`,
      codigo,
      cursoId: curso._id,
      semestre,
      descricao: `Componente curricular complementar demonstrativo de ${curso.nome}, no ${semestre}º semestre.`
    });
    disciplinas.push(disciplina);
    novas++;
  }
  if (disciplinas.length < 10) throw new Error(`Não foi possível completar dez disciplinas em ${curso.nome}, ${semestre}º semestre.`);
  return { disciplinas, novas };
}

async function garantirTurma(curso, semestre, disciplina, indiceDisciplina, indiceCurso, grade) {
  const aulaExistente = grade.aulas.find(aula => String(aula.disciplinaId) === String(disciplina._id) && aula.turmaId);
  if (aulaExistente) {
    const turmaExistente = await Turma.findById(aulaExistente.turmaId);
    if (turmaExistente && String(turmaExistente.cursoId) === String(curso._id)) return { turma: turmaExistente, nova: false };
  }

  let sufixo = 20 + indiceCurso * 6 + Math.max(0, indiceDisciplina - 4);
  while (sufixo <= 99) {
    const codigo = codigoTurma(semestre, sufixo);
    const existente = await Turma.findOne({ codigo });
    if (!existente) {
      const turma = await Turma.create({
        codigo,
        cursoId: curso._id,
        periodoLetivo: String(semestre),
        vagas: 40,
        semestreOrganizacao: semestre,
        horarios: []
      });
      return { turma, nova: true };
    }
    if (String(existente.cursoId) === String(curso._id) && Number(existente.periodoLetivo) === semestre) {
      return { turma: existente, nova: false };
    }
    sufixo++;
  }
  throw new Error(`Não foi possível gerar código de turma para ${curso.nome}, ${semestre}º semestre.`);
}

function docenteDisponivel(docentes, ocupacoes, chave) {
  const disponiveis = docentes.filter(docente => !ocupacoes.has(`${String(docente._id)}:${chave}`));
  if (!disponiveis.length) throw new Error(`Faltam docentes para preencher o horário ${chave}.`);
  disponiveis.sort((a, b) => (a.aulasNovas || 0) - (b.aulasNovas || 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const escolhido = disponiveis[0];
  escolhido.aulasNovas = (escolhido.aulasNovas || 0) + 1;
  ocupacoes.add(`${String(escolhido._id)}:${chave}`);
  return escolhido;
}

async function executar() {
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI antes de executar a carga.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'NotaDez' });
  const cursos = await Curso.find().sort({ codigo: 1 });
  if (!cursos.length) throw new Error('Nenhum curso foi encontrado para preencher.');
  const totalCoortes = cursos.reduce((total, curso) => total + curso.duracao, 0);
  const { docentes, novos: docentesNovos } = await garantirDocentes(totalCoortes);
  const idsCursos = cursos.map(curso => curso._id);
  const gradesParaOcupacoes = await GradeHorario.find({ cursoId: { $in: idsCursos } }).select('aulas').lean();
  const ocupacoesDocentes = new Set();
  for (const grade of gradesParaOcupacoes) {
    for (const aula of grade.aulas || []) {
      if (aula.docenteId) ocupacoesDocentes.add(`${String(aula.docenteId)}:${chaveSlot(aula.dia, aula.hora)}`);
    }
  }

  let disciplinasNovas = 0;
  let turmasNovas = 0;
  let aulasNovas = 0;
  let gradesCompletadas = 0;
  let slotsManhaPreenchidos = 0;
  const erros = [];

  for (let indiceCurso = 0; indiceCurso < cursos.length; indiceCurso++) {
    const curso = cursos[indiceCurso];
    for (let semestre = 1; semestre <= curso.duracao; semestre++) {
      const { disciplinas, novas } = await garantirDisciplinas(curso, semestre);
      disciplinasNovas += novas;
      let grade = await GradeHorario.findOne({ cursoId: curso._id, semestre });
      if (!grade) grade = await GradeHorario.create({ cursoId: curso._id, semestre, aulas: [] });

      const disciplinasPorId = new Map(disciplinas.map((disciplina, indice) => [String(disciplina._id), { disciplina, indice }]));
      const horariosExistentes = new Map();
      const contagemPorDisciplina = new Map();
      for (const aula of grade.aulas) {
        if (aula.dia < 1 || aula.dia > 5 || aula.hora < 8 || aula.hora > 11) continue;
        const slot = chaveSlot(aula.dia, aula.hora);
        horariosExistentes.set(slot, (horariosExistentes.get(slot) || 0) + 1);
        const disciplinaId = String(aula.disciplinaId);
        if (disciplinasPorId.has(disciplinaId)) contagemPorDisciplina.set(disciplinaId, (contagemPorDisciplina.get(disciplinaId) || 0) + 1);
      }
      const aulasManhaExistentes = [...horariosExistentes.values()].reduce((total, quantidade) => total + quantidade, 0);
      if (aulasManhaExistentes > 20) throw new Error(`${curso.nome}, ${semestre}º semestre já tem mais de 20 aulas entre 8h e 12h.`);
      for (const [slot, quantidade] of horariosExistentes) {
        if (quantidade > 1) throw new Error(`${curso.nome}, ${semestre}º semestre tem mais de uma aula no horário ${slot}.`);
      }

      const livres = [];
      for (const dia of diasLetivos) for (const hora of horasMatutinas) {
        const slot = chaveSlot(dia, hora);
        if (!horariosExistentes.has(slot)) livres.push({ dia, hora, slot });
      }
      const turmasPorDisciplina = new Map();
      const turmasCarregadasPorId = new Map();
      for (let indice = 0; indice < disciplinas.length; indice++) {
        const { turma: encontrada, nova } = await garantirTurma(curso, semestre, disciplinas[indice], indice, indiceCurso, grade);
        const idTurma = String(encontrada._id);
        const turma = turmasCarregadasPorId.get(idTurma) || encontrada;
        turmasCarregadasPorId.set(idTurma, turma);
        turmasPorDisciplina.set(String(disciplinas[indice]._id), turma);
        if (nova) turmasNovas++;
      }

      let indiceSlot = 0;
      while (indiceSlot < livres.length) {
        const candidatos = disciplinas
          .map((disciplina, indice) => ({ disciplina, indice, quantidade: contagemPorDisciplina.get(String(disciplina._id)) || 0 }))
          .sort((a, b) => a.quantidade - b.quantidade || a.indice - b.indice);
        const { disciplina, quantidade } = candidatos[0];
        const { dia, hora } = livres[indiceSlot++];
        const chave = chaveSlot(dia, hora);
        const docente = docenteDisponivel(docentes, ocupacoesDocentes, chave);
        const turma = turmasPorDisciplina.get(String(disciplina._id));
        const aulaId = new mongoose.Types.ObjectId();
        grade.aulas.push({ _id: aulaId, disciplinaId: disciplina._id, docenteId: docente._id, turmaId: turma._id, dia, hora });
        turma.horarios.push({
          gradeHorarioId: grade._id, aulaId, disciplinaId: disciplina._id,
          docenteId: docente._id, dia, hora, semestre
        });
        contagemPorDisciplina.set(String(disciplina._id), quantidade + 1);
        aulasNovas++;
      }

      for (const aula of grade.aulas) {
        if (aula.dia < 1 || aula.dia > 5 || aula.hora < 8 || aula.hora > 11) continue;
        if (!aula.turmaId) throw new Error(`Aula sem turma em ${curso.nome}, ${semestre}º semestre.`);
        const turma = turmasPorDisciplina.get(String(aula.disciplinaId)) || await Turma.findById(aula.turmaId);
        if (!turma) throw new Error(`Turma ausente em ${curso.nome}, ${semestre}º semestre.`);
        const associada = turma.horarios.some(item => String(item.gradeHorarioId) === String(grade._id) && String(item.aulaId) === String(aula._id));
        if (!associada) {
          turma.horarios.push({
            gradeHorarioId: grade._id, aulaId: aula._id, disciplinaId: aula.disciplinaId,
            docenteId: aula.docenteId, dia: aula.dia, hora: aula.hora, semestre
          });
        }
      }

      await Promise.all([
        grade.save(),
        ...[...new Map([...turmasPorDisciplina.values()].map(turma => [String(turma._id), turma])).values()].map(turma => turma.save())
      ]);
      gradesCompletadas++;
      slotsManhaPreenchidos += 20;
    }
  }

  const gradesFinales = await GradeHorario.find({ cursoId: { $in: idsCursos } }).select('cursoId semestre aulas').lean();
  const turmasFinales = await Turma.find({ cursoId: { $in: idsCursos } }).select('cursoId periodoLetivo horarios').lean();
  const turmasPorId = new Map(turmasFinales.map(turma => [String(turma._id), turma]));
  const docentesIds = new Set(docentes.map(docente => String(docente._id)));
  let horariosVazios = 0;
  let referenciasQuebradas = 0;
  let docenteOuTurmaAusente = 0;
  let associacaoDeAulaAusente = 0;
  let conflitosDocente = 0;
  const ocupacoesProfessor = new Set();
  for (const grade of gradesFinales) {
    const slots = new Set();
    for (const aula of grade.aulas || []) {
      if (!aula.docenteId || !docentesIds.has(String(aula.docenteId)) || !aula.turmaId) {
        referenciasQuebradas++;
        docenteOuTurmaAusente++;
      }
      const turma = turmasPorId.get(String(aula.turmaId));
      const associada = turma?.horarios?.some(item => String(item.gradeHorarioId) === String(grade._id) && String(item.aulaId) === String(aula._id));
      if (!associada) {
        referenciasQuebradas++;
        associacaoDeAulaAusente++;
      }
      if (aula.dia < 1 || aula.dia > 5 || aula.hora < 8 || aula.hora > 11) continue;
      const slot = chaveSlot(aula.dia, aula.hora);
      slots.add(slot);
      const chaveProfessor = `${String(aula.docenteId)}:${slot}`;
      if (ocupacoesProfessor.has(chaveProfessor)) conflitosDocente++;
      ocupacoesProfessor.add(chaveProfessor);
    }
    if (slots.size !== 20) horariosVazios += 20 - slots.size;
  }

  const [disciplinasTotais, turmasTotais, docentesTotais] = await Promise.all([
    Disciplina.countDocuments({ cursoId: { $in: idsCursos } }),
    Turma.countDocuments({ cursoId: { $in: idsCursos } }),
    Docente.countDocuments()
  ]);
  const aulasTotais = gradesFinales.reduce((total, grade) => total + (grade.aulas || []).length, 0);

  console.log(JSON.stringify({
    cursos: cursos.length,
    grades: gradesCompletadas,
    disciplinasTotais,
    turmasTotais,
    docentesTotais,
    aulasTotais,
    disciplinasCriadas: disciplinasNovas,
    turmasCriadas: turmasNovas,
    docentesExistentes: docentes.length - docentesNovos,
    docentesCriados: docentesNovos,
    aulasCriadas: aulasNovas,
    horariosMatutinosPreenchidos: slotsManhaPreenchidos,
    gradesComHorarioIncompleto: horariosVazios,
    referenciasQuebradas,
    docenteOuTurmaAusente,
    associacaoDeAulaAusente,
    conflitosDocente,
    acessoDocentesNovos: 'NotaDez2026!'
  }, null, 2));

  if (horariosVazios || referenciasQuebradas || conflitosDocente) {
    throw new Error('A validação final encontrou horários incompletos ou associações inconsistentes.');
  }
}

executar()
  .catch(erro => {
    console.error('Falha ao completar grades matutinas:', erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
