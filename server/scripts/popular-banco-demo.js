require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Curso = require('../models/Curso');
const Disciplina = require('../models/Disciplina');
const Docente = require('../models/Docente');
const Usuario = require('../models/Usuario');
const GradeHorario = require('../models/GradeHorario');
const Turma = require('../models/Turma');

// Conteúdo de demonstração inspirado no catálogo público da PUC-Campinas.
// As matrizes fora das disciplinas citadas no PPC de Engenharia de Software
// são simuladas e não representam uma transcrição oficial.
const cursosSeed = [
  { codigo: '01', nome: 'Administração', unidade: 'Escola de Economia e Negócios', grau: 'Bacharelado', duracao: 8, modalidade: 'Presencial', disciplinas: [
    ['Fundamentos da Administração', 'Economia e Sociedade', 'Contabilidade Geral', 'Matemática Aplicada à Gestão'],
    ['Comportamento Organizacional', 'Estatística Aplicada', 'Direito Empresarial', 'Fundamentos de Marketing'],
    ['Administração Financeira I', 'Gestão de Operações', 'Contabilidade de Custos', 'Pesquisa de Mercado'],
    ['Gestão de Pessoas', 'Logística Empresarial', 'Estratégia Competitiva', 'Sistemas de Informação Gerencial'],
    ['Finanças Corporativas', 'Marketing Estratégico', 'Empreendedorismo e Inovação', 'Sustentabilidade Empresarial'],
    ['Controladoria', 'Gestão da Cadeia de Suprimentos', 'Análise de Dados para Negócios', 'Gestão de Projetos'],
    ['Mercado de Capitais', 'Comércio Exterior', 'Governança Corporativa', 'Gestão da Inovação'],
    ['Planejamento Estratégico', 'Consultoria Empresarial', 'Negócios Digitais', 'Trabalho de Conclusão de Curso']
  ] },
  { codigo: '02', nome: 'Direito', unidade: 'Escola de Ciências Humanas, Jurídicas e Sociais', grau: 'Bacharelado', duracao: 10, modalidade: 'Presencial', disciplinas: [
    ['Introdução ao Estudo do Direito', 'Teoria do Estado', 'Sociologia Jurídica', 'Antropologia e Direitos Humanos'],
    ['Direito Constitucional I', 'Direito Civil: Parte Geral', 'Direito Penal: Parte Geral I', 'Metodologia da Pesquisa Jurídica'],
    ['Direito Constitucional II', 'Direito das Obrigações', 'Direito Penal: Parte Geral II', 'Teoria Geral do Processo'],
    ['Direito Administrativo I', 'Direito Civil: Contratos', 'Direito do Trabalho I', 'Direito Processual Civil I'],
    ['Direito Empresarial I', 'Direito Penal: Crimes em Espécie I', 'Direito Processual Penal I', 'Direito Processual Civil II'],
    ['Direito Tributário I', 'Direito de Família', 'Direito do Trabalho II', 'Direito Processual Penal II'],
    ['Direito Empresarial II', 'Direito das Sucessões', 'Direito Tributário II', 'Direito Processual do Trabalho'],
    ['Direito Internacional Público', 'Direito Ambiental', 'Prática Jurídica Cível', 'Ética Profissional e Deontologia'],
    ['Direito Administrativo II', 'Direito do Consumidor', 'Prática Jurídica Penal', 'Mediação e Arbitragem'],
    ['Direito Digital', 'Direitos Humanos e Cidadania', 'Prática Jurídica Trabalhista', 'Trabalho de Conclusão de Curso']
  ] },
  { codigo: '03', nome: 'Psicologia', unidade: 'Escola de Ciências Humanas, Jurídicas e Sociais', grau: 'Bacharelado', duracao: 10, modalidade: 'Presencial', disciplinas: [
    ['História da Psicologia', 'Bases Biológicas do Comportamento', 'Processos Psicológicos Básicos I', 'Filosofia e Psicologia'],
    ['Psicologia do Desenvolvimento I', 'Processos Psicológicos Básicos II', 'Estatística em Psicologia', 'Psicologia Social I'],
    ['Psicologia do Desenvolvimento II', 'Teorias da Personalidade I', 'Psicologia Social II', 'Métodos de Pesquisa em Psicologia'],
    ['Psicopatologia I', 'Teorias da Personalidade II', 'Avaliação Psicológica I', 'Psicologia e Educação'],
    ['Psicopatologia II', 'Avaliação Psicológica II', 'Psicologia Organizacional', 'Psicologia e Saúde Coletiva'],
    ['Psicologia Clínica I', 'Psicologia do Trabalho', 'Técnicas de Entrevista', 'Psicologia Comunitária'],
    ['Psicologia Clínica II', 'Neuropsicologia', 'Psicologia Escolar', 'Ética e Prática Profissional'],
    ['Estágio Básico em Psicologia', 'Psicologia Hospitalar', 'Intervenções em Grupos', 'Psicologia Jurídica'],
    ['Estágio Específico I', 'Abordagens Psicoterapêuticas', 'Políticas Públicas em Saúde Mental', 'Pesquisa em Psicologia'],
    ['Estágio Específico II', 'Seminários Integradores', 'Psicologia e Direitos Humanos', 'Trabalho de Conclusão de Curso']
  ] },
  { codigo: '04', nome: 'Engenharia de Software', unidade: 'Escola Politécnica', grau: 'Bacharelado', duracao: 8, modalidade: 'Presencial', disciplinas: [
    ['Algoritmos de Programação, Projetos e Computação', 'Fundamentos de Sistemas de Informação e de Engenharia de Software', 'Experimentos Práticos de Banco de Dados', 'Elementos de Álgebra Linear'],
    ['Métodos de Engenharia de Software', 'Engenharia e Elicitação de Requisitos', 'Estrutura e Recuperação de Dados I', 'Introdução às Tecnologias para Web'],
    ['Engenharia de Processos de Software', 'Análise e Projeto de Sistemas I', 'Fundamentos de Matemática Discreta', 'Projeto de Interação e da Experiência do Usuário de Software'],
    ['Análise e Projeto de Sistemas II', 'Fundamentos e Técnicas de Verificação e Validação de Software', 'Fundamentos de Sistemas Operacionais', 'Paradigmas e Programação Orientada a Objetos'],
    ['Fundamentos de Teoria da Computação e Análise de Algoritmos', 'Noções de Estatística Descritiva e Probabilidade', 'Estrutura e Recuperação de Dados II', 'Projeto Integrador V - Engenharia de Software'],
    ['Normas e Qualidade de Software', 'Fundamentos de Comunicação de Dados e Redes de Computadores', 'Programação Paralela e Distribuída', 'Gerenciamento de Projetos de Engenharia de Software'],
    ['Manutenção e Evolução de Software', 'Visão Computacional e Internet das Coisas', 'Projeto Aplicado I', 'Projeto e Governança de TI'],
    ['Tecnologias Emergentes de TI', 'Projeto Aplicado II', 'Gestão da Segurança em TI', 'Gestão e Governança de TI']
  ] },
  { codigo: '05', nome: 'Ciência de Dados e Inteligência Artificial', unidade: 'Escola Politécnica', grau: 'Bacharelado', duracao: 8, modalidade: 'Presencial', disciplinas: [
    ['Lógica e Algoritmos', 'Matemática para Ciência de Dados I', 'Introdução à Ciência de Dados', 'Fundamentos de Computação'],
    ['Programação para Dados', 'Matemática para Ciência de Dados II', 'Estatística Descritiva', 'Banco de Dados Relacionais'],
    ['Estruturas de Dados', 'Probabilidade e Inferência', 'Coleta e Preparação de Dados', 'Visualização de Dados'],
    ['Aprendizado de Máquina I', 'Álgebra Linear Computacional', 'Engenharia de Dados', 'Ética e Governança de Dados'],
    ['Aprendizado de Máquina II', 'Mineração de Dados', 'Séries Temporais', 'Computação em Nuvem para Dados'],
    ['Redes Neurais', 'Processamento de Linguagem Natural', 'Big Data e Sistemas Distribuídos', 'Experimentação em Ciência de Dados'],
    ['Inteligência Artificial Generativa', 'Visão Computacional', 'MLOps e Implantação de Modelos', 'Projeto Integrador em IA'],
    ['IA Responsável e Explicável', 'Sistemas de Recomendação', 'Projeto Aplicado em Ciência de Dados', 'Trabalho de Conclusão de Curso']
  ] },
  { codigo: '06', nome: 'Engenharia de Computação', unidade: 'Escola Politécnica', grau: 'Bacharelado', duracao: 10, modalidade: 'Presencial', disciplinas: [
    ['Introdução à Engenharia de Computação', 'Cálculo Diferencial e Integral I', 'Física Geral I', 'Algoritmos e Programação'],
    ['Cálculo Diferencial e Integral II', 'Física Geral II', 'Desenho Técnico', 'Circuitos Elétricos I'],
    ['Estruturas de Dados', 'Álgebra Linear', 'Circuitos Elétricos II', 'Eletrônica Digital'],
    ['Cálculo Numérico', 'Organização de Computadores', 'Eletrônica Analógica', 'Probabilidade e Estatística'],
    ['Arquitetura de Computadores', 'Sistemas Operacionais', 'Microcontroladores', 'Sinais e Sistemas'],
    ['Redes de Computadores', 'Banco de Dados', 'Sistemas Embarcados I', 'Eletrônica de Potência'],
    ['Engenharia de Software', 'Sistemas Embarcados II', 'Controle e Automação', 'Comunicação de Dados'],
    ['Internet das Coisas', 'Inteligência Artificial', 'Projeto de Sistemas Digitais', 'Segurança de Sistemas'],
    ['Robótica', 'Sistemas Distribuídos', 'Projeto Integrador de Engenharia', 'Gestão de Projetos Tecnológicos'],
    ['Tópicos Avançados em Computação', 'Empreendedorismo Tecnológico', 'Estágio Supervisionado', 'Trabalho de Conclusão de Curso']
  ] },
  { codigo: '07', nome: 'Sistemas de Informação', unidade: 'Escola Politécnica', grau: 'Bacharelado', duracao: 8, modalidade: 'Presencial', disciplinas: [
    ['Fundamentos de Sistemas de Informação', 'Algoritmos e Programação', 'Matemática Discreta', 'Organizações e Sociedade'],
    ['Programação Orientada a Objetos', 'Estruturas de Dados', 'Contabilidade para TI', 'Comunicação e Expressão'],
    ['Engenharia de Requisitos', 'Banco de Dados I', 'Estatística Aplicada', 'Arquitetura de Computadores'],
    ['Engenharia de Software', 'Banco de Dados II', 'Sistemas Operacionais', 'Gestão de Processos de Negócio'],
    ['Desenvolvimento Web', 'Redes de Computadores', 'Interação Humano-Computador', 'Pesquisa Operacional'],
    ['Governança de TI', 'Desenvolvimento de Aplicações Móveis', 'Segurança da Informação', 'Inteligência de Negócios'],
    ['Gestão de Projetos de TI', 'Ciência de Dados', 'Sistemas Distribuídos', 'Empreendedorismo Digital'],
    ['Arquitetura de Soluções', 'Auditoria de Sistemas', 'Projeto Integrador em Sistemas de Informação', 'Trabalho de Conclusão de Curso']
  ] },
  { codigo: '08', nome: 'Gestão da Tecnologia da Informação', unidade: 'Escola Politécnica', grau: 'Tecnólogo', duracao: 5, modalidade: 'Presencial', disciplinas: [
    ['Fundamentos de Tecnologia da Informação', 'Lógica e Programação', 'Gestão de Organizações', 'Matemática Aplicada'],
    ['Programação para Negócios', 'Banco de Dados', 'Infraestrutura de TI', 'Gestão de Serviços de TI'],
    ['Redes e Segurança da Informação', 'Análise de Sistemas', 'Governança de TI', 'Gestão de Projetos'],
    ['Computação em Nuvem', 'Business Intelligence', 'Gestão de Dados', 'Empreendedorismo e Inovação'],
    ['Arquitetura Corporativa', 'Gestão Estratégica de TI', 'Auditoria e Riscos em TI', 'Projeto Aplicado em Tecnologia']
  ] }
];

const nomesDocentes = [
  ['Ana Beatriz Lima', 'Engenharia de Software'], ['Bruno Carvalho', 'Banco de Dados'],
  ['Camila Nogueira', 'Direito e Sociedade'], ['Daniel Ferreira', 'Matemática Aplicada'],
  ['Eduarda Martins', 'Psicologia Clínica'], ['Felipe Azevedo', 'Inteligência Artificial'],
  ['Gabriela Souza', 'Gestão Empresarial'], ['Henrique Barros', 'Redes e Sistemas'],
  ['Isabela Costa', 'Direito Civil'], ['João Pedro Ramos', 'Estatística'],
  ['Karina Almeida', 'Psicologia Social'], ['Leonardo Batista', 'Finanças Corporativas'],
  ['Mariana Freitas', 'Aprendizado de Máquina'], ['Nicolas Rocha', 'Arquitetura de Computadores'],
  ['Olivia Mendes', 'Marketing e Inovação'], ['Paulo Henrique Dias', 'Direito Penal'],
  ['Quezia Ribeiro', 'Desenvolvimento Web'], ['Rafael Monteiro', 'Sistemas Distribuídos'],
  ['Sofia Campos', 'Avaliação Psicológica'], ['Thiago Oliveira', 'Contabilidade'],
  ['Ursula Teixeira', 'Gestão de Projetos'], ['Vinicius Moraes', 'Eletrônica Digital'],
  ['Wesley Cardoso', 'Políticas Públicas'], ['Yasmin Duarte', 'Ciência de Dados']
];

function criarCodigoDisciplina(cursoCodigo, semestre, sequencia) {
  return `${cursoCodigo}${String(semestre).padStart(2, '0')}${String(sequencia).padStart(2, '0')}`;
}

function alocarHorario(docente, horariosDaTurma) {
  for (let dia = 1; dia <= 5; dia++) {
    for (let hora = 8; hora <= 20; hora++) {
      const chave = `${dia}-${hora}`;
      if (horariosDaTurma.has(chave) || docente.horarios.has(chave)) continue;
      horariosDaTurma.add(chave);
      docente.horarios.add(chave);
      docente.aulas++;
      return { dia, hora };
    }
  }
  throw new Error(`Não há horário disponível para ${docente.nome}.`);
}

async function obterDocentes() {
  const existentes = await Docente.find().sort({ nome: 1 });
  const docentes = existentes.map(docente => ({ id: docente._id, nome: docente.nome, aulas: 0, horarios: new Set() }));
  const senha = await bcrypt.hash('NotaDez2026!', 10);

  for (let indice = 0; indice < nomesDocentes.length; indice++) {
    const numero = String(indice + 1).padStart(2, '0');
    const email = `docente.seed${numero}@example.com`;
    let docente = await Docente.findOne({ email });
    if (!docente) {
      docente = await Docente.create({
        rp: `P2026D${String(indice + 1).padStart(3, '0')}`,
        nome: nomesDocentes[indice][0],
        email,
        especialidade: nomesDocentes[indice][1],
        instituicao: { nome: 'Faculdade NotaDez - Campinas', codigo: 'ND' }
      });
    }
    await Usuario.findOneAndUpdate({ email }, {
      $setOnInsert: {
        nome: docente.nome,
        email,
        senha,
        papeis: ['docente'],
        rp: docente.rp
      }
    }, { upsert: true, setDefaultsOnInsert: true });
    if (!docentes.some(item => String(item.id) === String(docente._id))) {
      docentes.push({ id: docente._id, nome: docente.nome, aulas: 0, horarios: new Set() });
    }
  }
  return docentes;
}

async function executar() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'NotaDez' });
  const codigos = cursosSeed.map(curso => curso.codigo);
  const cursosExistentes = await Curso.find({ codigo: { $in: codigos } }).select('codigo').lean();
  if (cursosExistentes.length && cursosExistentes.length !== codigos.length) {
    throw new Error('Carga parcial detectada nos cursos seed; interrompi para preservar os registros atuais.');
  }

  const cursos = [];
  for (const definicao of cursosSeed) {
    const curso = await Curso.findOneAndUpdate({ codigo: definicao.codigo }, {
      $set: {
        nome: definicao.nome,
        unidade: definicao.unidade,
        grau: definicao.grau,
        modalidade: definicao.modalidade,
        duracao: definicao.duracao,
        descricao: 'Registro de demonstração inspirado no catálogo público da PUC-Campinas.'
      }
    }, { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true });
    cursos.push({ ...definicao, id: curso._id });
  }

  const disciplinasPorCurso = new Map();
  let totalDisciplinas = 0;
  for (const curso of cursos) {
    const lista = [];
    for (let semestre = 1; semestre <= curso.duracao; semestre++) {
      for (let indice = 0; indice < 4; indice++) {
        const codigo = criarCodigoDisciplina(curso.codigo, semestre, indice + 1);
        const disciplina = await Disciplina.findOneAndUpdate({ cursoId: curso.id, codigo }, {
          $set: {
            nome: curso.disciplinas[semestre - 1][indice],
            codigo,
            cursoId: curso.id,
            semestre,
            descricao: `Componente curricular demonstrativo de ${curso.nome}, no ${semestre}º semestre.`
          }
        }, { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true });
        lista.push(disciplina);
        totalDisciplinas++;
      }
    }
    disciplinasPorCurso.set(String(curso.id), lista);
  }

  const docentes = await obterDocentes();
  let indiceDocente = 0;
  let totalGrades = 0;
  let totalTurmas = 0;
  let totalAulas = 0;

  for (let indiceCurso = 0; indiceCurso < cursos.length; indiceCurso++) {
    const curso = cursos[indiceCurso];
    const disciplinas = disciplinasPorCurso.get(String(curso.id));
    for (let semestre = 1; semestre <= curso.duracao; semestre++) {
      const sequenciaTurma = String(indiceCurso + 1).padStart(2, '0');
      const codigoTurma = `${String(semestre).padStart(2, '0')}${sequenciaTurma}`;
      const [turmaAtual, gradeAtual] = await Promise.all([
        Turma.findOne({ codigo: codigoTurma }).select('_id').lean(),
        GradeHorario.findOne({ cursoId: curso.id, semestre }).select('_id').lean()
      ]);
      const turmaId = turmaAtual?._id || new mongoose.Types.ObjectId();
      const gradeId = gradeAtual?._id || new mongoose.Types.ObjectId();
      const aulas = [];
      const horariosDaTurma = new Set();

      for (const disciplina of disciplinas.filter(item => item.semestre === semestre)) {
        const docente = [...docentes].sort((a, b) => a.aulas - b.aulas)[indiceDocente % docentes.length];
        indiceDocente++;
        const horario = alocarHorario(docente, horariosDaTurma);
        const aulaId = new mongoose.Types.ObjectId();
        aulas.push({
          _id: aulaId,
          disciplinaId: disciplina._id,
          docenteId: docente.id,
          turmaId,
          dia: horario.dia,
          hora: horario.hora
        });
      }

      const horariosTurma = aulas.map(aula => ({
        gradeHorarioId: gradeId,
        aulaId: aula._id,
        disciplinaId: aula.disciplinaId,
        docenteId: aula.docenteId,
        dia: aula.dia,
        hora: aula.hora,
        semestre
      }));

      await Turma.findOneAndUpdate({ codigo: codigoTurma }, {
        $set: {
          codigo: codigoTurma,
          cursoId: curso.id,
          periodoLetivo: String(semestre),
          vagas: 40,
          semestreOrganizacao: semestre,
          horarios: horariosTurma
        },
        $setOnInsert: { _id: turmaId }
      }, { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true });

      await GradeHorario.findOneAndUpdate({ cursoId: curso.id, semestre }, {
        $set: { cursoId: curso.id, semestre, aulas },
        $setOnInsert: { _id: gradeId }
      }, { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true });
      totalGrades++;
      totalTurmas++;
      totalAulas += aulas.length;
    }
  }

  const idsCursos = cursos.map(curso => curso.id);
  const [gradesSalvas, turmasSalvas, disciplinasSalvas, docentesSalvos] = await Promise.all([
    GradeHorario.find({ cursoId: { $in: idsCursos } }).lean(),
    Turma.find({ codigo: { $in: cursos.flatMap((curso, indice) => Array.from({ length: curso.duracao }, (_, semestre) => `${String(semestre + 1).padStart(2, '0')}${String(indice + 1).padStart(2, '0')}`)) } }).lean(),
    Disciplina.find({ cursoId: { $in: idsCursos } }).select('_id').lean(),
    Docente.find().select('_id').lean()
  ]);
  const disciplinasIds = new Set(disciplinasSalvas.map(item => String(item._id)));
  const docentesIds = new Set(docentesSalvos.map(item => String(item._id)));
  const turmasPorId = new Map(turmasSalvas.map(turma => [String(turma._id), turma]));
  const referenciasTurma = new Set(turmasSalvas.flatMap(turma => turma.horarios.map(item => `${String(item.gradeHorarioId)}:${String(item.aulaId)}`)));
  let referenciasQuebradas = 0;
  for (const grade of gradesSalvas) {
    for (const aula of grade.aulas) {
      const turma = turmasPorId.get(String(aula.turmaId));
      const parGradeAula = `${String(grade._id)}:${String(aula._id)}`;
      if (!disciplinasIds.has(String(aula.disciplinaId)) || !docentesIds.has(String(aula.docenteId)) || !turma || !referenciasTurma.has(parGradeAula)) referenciasQuebradas++;
    }
  }
  const contagens = {
    cursos: await Curso.countDocuments({ _id: { $in: idsCursos } }),
    disciplinas: await Disciplina.countDocuments({ cursoId: { $in: idsCursos } }),
    grades: gradesSalvas.length,
    turmas: turmasSalvas.length,
    docentes: docentesSalvos.length,
    aulas: gradesSalvas.reduce((total, grade) => total + grade.aulas.length, 0)
  };

  console.log(JSON.stringify({
    ...contagens,
    docentesComAula: new Set(gradesSalvas.flatMap(grade => grade.aulas.map(aula => String(aula.docenteId)))).size,
    gradesComReferenciasAusentes: referenciasQuebradas,
    senhaDemoDocentesNovos: 'NotaDez2026!'
  }, null, 2));
  if (referenciasQuebradas || contagens.cursos !== cursos.length || contagens.disciplinas !== totalDisciplinas || contagens.grades !== totalGrades || contagens.turmas !== totalTurmas || contagens.aulas !== totalAulas) {
    throw new Error('A validação final encontrou contagens ou associações inconsistentes.');
  }
}

executar()
  .catch(erro => {
    console.error('Falha ao popular o banco:', erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
