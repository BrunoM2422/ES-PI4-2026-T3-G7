// Autores: Bruno Machado — RA: 25008041
const Usuario = require('../models/Usuario');
const Estudante = require('../models/Estudante');
const Docente = require('../models/Docente');

function usuarioNomeado(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(parte => parte.replace(/[^a-z]/g, ''))
    .filter(Boolean);
}

async function sugerirEmail(nome, tipo, excluirId = null) {
  const partes = usuarioNomeado(nome);
  if (!partes.length) throw new Error('Informe um nome para sugerir o e-mail.');
  if (!['estudante', 'docente'].includes(tipo)) throw new Error('Tipo de perfil inválido.');

  const sobrenomes = partes.slice(1).map(parte => parte[0]).join('');
  const base = `${partes[0]}${sobrenomes ? `.${sobrenomes}` : ''}`.slice(0, 60);
  let emailAtual = '';
  if (excluirId) {
    const modelo = tipo === 'estudante' ? Estudante : Docente;
    const perfil = await modelo.findById(excluirId).select('email').lean();
    emailAtual = String(perfil?.email || '').toLowerCase();
  }

  for (let sequencia = 1; sequencia < 100000; sequencia += 1) {
    const sufixo = sequencia === 1 ? '' : String(sequencia);
    const candidato = `${base.slice(0, 64 - '@gmail.com'.length - sufixo.length)}${sufixo}@gmail.com`;
    if (candidato === emailAtual) return candidato;
    const [usuario, estudante, docente] = await Promise.all([
      Usuario.exists({ email: candidato }),
      Estudante.exists({ email: candidato, ...(tipo === 'estudante' && excluirId ? { _id: { $ne: excluirId } } : {}) }),
      Docente.exists({ email: candidato, ...(tipo === 'docente' && excluirId ? { _id: { $ne: excluirId } } : {}) })
    ]);
    if (!usuario && !estudante && !docente) return candidato;
  }
  throw new Error('Não foi possível gerar um e-mail disponível.');
}

module.exports = { sugerirEmail };
