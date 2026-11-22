// Autores: Matheus Antony Lucas Lima RA:25013260
const mongoose = require('mongoose');
const MediaNota = require('../models/MediaNota');
const { calcularMediasNoJava } = require('./calculadoraJava');

/**
 * Grava (ou atualiza) as médias de uma disciplina. Uma média por aluno/turma/disciplina.
 * @param {Map<string, number>} medias idDoAluno -> média
 */
async function salvarMedias(turmaId, disciplinaId, tipoMedia, medias) {
  const agora = new Date();
  const operacoes = [];

  for (const [alunoId, media] of medias) {
    if (!mongoose.isValidObjectId(alunoId) || !Number.isFinite(media)) continue;
    operacoes.push({
      updateOne: {
        filter: { alunoId, turmaId, disciplinaId },
        update: { $set: { tipoMedia, media, desatualizada: false, calculadaEm: agora } },
        upsert: true
      }
    });
  }

  if (operacoes.length) await MediaNota.bulkWrite(operacoes, { ordered: false });
}

/**
 * Lê as médias salvas no banco.
 * @returns {Promise<Map<string, {media:number, desatualizada:boolean, calculadaEm:Date}>>}
 */
async function lerMedias(turmaId, disciplinaId, alunoIds) {
  if (!alunoIds.length) return new Map();
  const docs = await MediaNota.find({ turmaId, disciplinaId, alunoId: { $in: alunoIds } })
    .select('alunoId media desatualizada calculadaEm').lean();

  return new Map(docs.map(doc => [String(doc.alunoId), {
    media: doc.media,
    desatualizada: Boolean(doc.desatualizada),
    calculadaEm: doc.calculadaEm
  }]));
}

// Notas ou componentes mudaram: a média salva continua visível, mas marcada como desatualizada
function marcarDesatualizadas(turmaId, disciplinaId) {
  return MediaNota.updateMany({ turmaId, disciplinaId }, { $set: { desatualizada: true } });
}

// Disciplina ficou sem componentes: não há mais média a guardar
function removerMedias(turmaId, disciplinaId) {
  return MediaNota.deleteMany({ turmaId, disciplinaId });
}

/** Calcula no Java e grava no banco. Lança erro se o Java estiver offline. */
async function calcularEPersistir(turmaId, disciplinaId, tipoMedia, componentes, alunos) {
  const mediasJava = await calcularMediasNoJava(tipoMedia, componentes, alunos);
  await salvarMedias(turmaId, disciplinaId, tipoMedia, mediasJava);
  return mediasJava;
}

/**
 * Tenta calcular no Java (e grava o resultado). Se o Java estiver offline ou falhar,
 * devolve as últimas médias salvas no banco.
 *
 * @returns {Promise<Map<string, {media:number, origem:'java'|'banco', desatualizada:boolean, calculadaEm:Date}>>}
 */
async function mediasComFallback(turmaId, disciplinaId, tipoMedia, componentes, alunos) {
  const resultado = new Map();
  if (!componentes.length || !alunos.length) return resultado;

  try {
    const mediasJava = await calcularMediasNoJava(tipoMedia, componentes, alunos);
    const agora = new Date();

    for (const [alunoId, media] of mediasJava) {
      resultado.set(alunoId, { media, origem: 'java', desatualizada: false, calculadaEm: agora });
    }

    // falha ao gravar não impede de mostrar a média recém-calculada
    try {
      await salvarMedias(turmaId, disciplinaId, tipoMedia, mediasJava);
    } catch (erroBanco) {
      console.error('Erro ao salvar médias no banco:', erroBanco);
    }

    return resultado;
  } catch (errJava) {
    console.warn('Servidor Java offline ou erro no cálculo; usando médias salvas:', errJava.message);
  }

  const salvas = await lerMedias(turmaId, disciplinaId, alunos.map(aluno => String(aluno.id)));
  for (const [alunoId, dados] of salvas) {
    resultado.set(alunoId, { ...dados, origem: 'banco' });
  }
  return resultado;
}

module.exports = { salvarMedias, lerMedias, marcarDesatualizadas, removerMedias, calcularEPersistir, mediasComFallback };