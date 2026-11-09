const crypto = require('crypto');
const Usuario = require('../models/Usuario');

const duracaoTokenMs = 12 * 60 * 60 * 1000;

function chaveAssinatura() {
  const chave = process.env.SESSION_SECRET || process.env.MONGODB_URI;
  if (!chave) throw new Error('Configure SESSION_SECRET para assinar sessões.');
  return chave;
}

function criarToken(usuario) {
  const dados = Buffer.from(JSON.stringify({
    sub: String(usuario._id),
    exp: Date.now() + duracaoTokenMs
  })).toString('base64url');
  const assinatura = crypto.createHmac('sha256', chaveAssinatura()).update(dados).digest('base64url');
  return `${dados}.${assinatura}`;
}

function obterPapel(usuario) {
  if (usuario.papeis.includes('admin')) return 'admin';
  if (usuario.papeis.includes('docente')) return 'professor';
  if (usuario.papeis.includes('estudante')) return 'aluno';
  return null;
}

async function autenticar(req, res, next) {
  try {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token || !token.includes('.')) return res.status(401).json({ mensagem: 'Autenticação necessária.' });

    const [dados, assinaturaRecebida] = token.split('.');
    const assinaturaEsperada = crypto.createHmac('sha256', chaveAssinatura()).update(dados).digest();
    const assinaturaBytes = Buffer.from(assinaturaRecebida, 'base64url');
    if (assinaturaBytes.length !== assinaturaEsperada.length || !crypto.timingSafeEqual(assinaturaBytes, assinaturaEsperada)) {
      return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    }

    const sessao = JSON.parse(Buffer.from(dados, 'base64url').toString('utf8'));
    if (typeof sessao.sub !== 'string' || sessao.exp <= Date.now()) {
      return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    }

    const usuario = await Usuario.findById(sessao.sub).select('_id email papeis ra rp').lean();
    const papel = usuario && obterPapel(usuario);
    if (!usuario || !papel) return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });

    req.usuario = { id: String(usuario._id), email: usuario.email, ra: usuario.ra, rp: usuario.rp, papel };
    return next();
  } catch (erro) {
    if (erro.message?.startsWith('Configure SESSION_SECRET')) {
      console.error(erro.message);
      return res.status(500).json({ mensagem: 'A autenticação do servidor não está configurada.' });
    }
    return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
  }
}

module.exports = { autenticar, criarToken };