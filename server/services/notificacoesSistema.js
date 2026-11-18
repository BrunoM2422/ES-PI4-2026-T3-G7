// Autores:
const { randomUUID } = require('crypto');
const Curso = require('../models/Curso');
const Estudante = require('../models/Estudante');
const Notificacao = require('../models/Notificacao');

const mensagens = {
  grade: {
    titulo: 'Grade Curricular liberada',
    criar: nome => `A Grade Curricular foi liberada para o curso ${nome}. Acesse a opcao Grade Curricular no menu do aluno.`
  },
  avaliacao: {
    titulo: 'Avaliacao de Professores liberada',
    criar: nome => `A Avalia\u00e7\u00e3o de Professores foi liberada para o curso ${nome}. Acesse a opcao Avaliar Professor no menu do aluno.`
  }
};

async function notificarLiberacao(cursoIds, tipo, alunoIds = null, eventoId = null) {
  const modelo = mensagens[tipo];
  if (!modelo || !cursoIds.length) return;

  try {
    const cursos = await Curso.find({ _id: { $in: cursoIds } }).select('_id nome').lean();
    if (!cursos.length) return;
    const ids = cursos.map(curso => curso._id);
    const filtroAlunos = { cursoId: { $in: ids }, statusAcademico: { $ne: 'trancado' } };
    if (alunoIds) filtroAlunos._id = { $in: alunoIds };
    const alunos = await Estudante.find(filtroAlunos).select('_id cursoId').lean();
    const nomePorCurso = new Map(cursos.map(curso => [String(curso._id), curso.nome]));
    const idEvento = eventoId || randomUUID();
    const chavePorCurso = new Map(cursos.map(curso => [String(curso._id), `liberacao-${tipo}:${curso._id}:${idEvento}`]));
    const chaveAntigaPorCurso = new Map(cursos.map(curso => [String(curso._id), `liberacao-${tipo}:${curso._id}`]));
    const prefixosAntigos = cursos.map(curso => new RegExp(`^liberacao-${tipo}:${curso._id}:`));
    const chaves = [...new Set([
      ...chavePorCurso.values(),
      ...(eventoId === 'recuperacao' ? [...chaveAntigaPorCurso.values(), ...prefixosAntigos] : [])
    ])];
    const existentes = alunos.length
      ? await Notificacao.find({ alunoId: { $in: alunos.map(aluno => aluno._id) }, chave: { $in: chaves } }).select('alunoId chave').lean()
      : [];
    const notificacoes = alunos.filter(aluno => {
      const chaveAtual = chavePorCurso.get(String(aluno.cursoId));
      const chaveAntiga = chaveAntigaPorCurso.get(String(aluno.cursoId));
      const chavesDoAluno = existentes.filter(item => String(item.alunoId) === String(aluno._id)).map(item => item.chave);
      const jaRecebeuEsteEvento = chavesDoAluno.includes(chaveAtual);
      const jaRecebeuUmaLiberacaoAnterior = eventoId === 'recuperacao' &&
        chavesDoAluno.some(chave => chave === chaveAntiga || chave.startsWith(`${chaveAntiga}:`));
      return !jaRecebeuEsteEvento && !jaRecebeuUmaLiberacaoAnterior;
    }).map(aluno => {
      const nomeCurso = nomePorCurso.get(String(aluno.cursoId)) || 'seu curso';
      return {
        alunoId: aluno._id,
        tipo: 'sistema',
        chave: chavePorCurso.get(String(aluno.cursoId)),
        curso: nomeCurso,
        titulo: modelo.titulo,
        mensagem: modelo.criar(nomeCurso)
      };
    });
    if (notificacoes.length) await Notificacao.insertMany(notificacoes, { ordered: false });
  } catch (erro) {
    console.error('Nao foi possivel criar notificacoes de liberacao:', erro);
    const errosDeDuplicidade = erro.writeErrors?.length && erro.writeErrors.every(item => item.code === 11000);
    if (erro.code !== 11000 && !errosDeDuplicidade) throw erro;
  }
}

module.exports = { notificarLiberacao };
