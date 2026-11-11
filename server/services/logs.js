const Log = require('../models/Log');
const mongoose = require('mongoose');

async function registrar(usuario, tipo, acao, descricao) {
  if (!['admin', 'professor'].includes(usuario.papel)) return;
  await Log.create({ usuarioId: usuario.id, usuario: usuario.email, tipo, acao, descricao });
}

// Capture referências antes da ação, inclusive para registros que serão excluídos.
async function auditar(req, res, next) {
  const usuario = req.usuario;
  const caminho = req.originalUrl.split('?')[0];
  if (!usuario || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (usuario.papel !== 'admin' && !(usuario.papel === 'professor' && caminho.startsWith('/api/perfis'))) return next();
  try {
    const detalhes = [];
    const body = req.body || {};
    detalhes.push(`Operação: ${req.method} ${caminho}`);
    if (caminho === '/api/perfis') detalhes.push(`Campos atualizados: ${['telefone', 'endereco', 'descricao', 'foto'].filter(campo => body[campo] !== undefined).join(', ')}`);
    const campos = ['nome', 'email', 'codigo', 'tipo', 'matricula', 'status', 'inicio', 'retorno', 'titulo', 'title', 'date', 'category', 'start', 'end', 'location', 'periodoLetivo', 'semestre', 'vagas', 'duracao', 'unidade', 'grau', 'modalidade', 'instituicao', 'especialidade', 'nivelPermissao', 'gradeHorarioId', 'aulaId', 'gradeCurricular', 'avaliacao', 'grade', 'showFinanceiro'];
    for (const campo of new Set(campos)) {
      if (['string', 'boolean', 'number'].includes(typeof body[campo])) detalhes.push(`${campo}: ${String(body[campo]).slice(0, 500)}`);
    }
    const referencias = [
      ['cursoId', 'Curso'], ['turmaId', 'Turma'], ['estudanteId', 'Estudante'],
      ['docenteId', 'Docente'], ['disciplinaId', 'Disciplina']
    ];
    if (typeof body.matricula === 'string' && caminho.includes('/matriculas/')) {
      const estudante = await mongoose.model('Estudante').findOne({ $or: [{ ra: body.matricula.trim() }, { email: body.matricula.trim().toLowerCase() }] }).select('nome ra curso turmaId').lean();
      if (estudante) detalhes.push(`Aluno: ${estudante.nome} (${estudante.ra}); curso: ${estudante.curso?.nome || 'Não informado'}; turma: ${estudante.turmaId || 'Não informada'}`);
    }
    const recursos = { cursos: 'Curso', turmas: 'Turma', estudantes: 'Estudante', docentes: 'Docente', disciplinas: 'Disciplina', chamados: 'Chamado', eventos: 'Evento' };
    const partes = caminho.split('/');
    for (let i = 0; i < partes.length - 1; i++) {
      if (recursos[partes[i]] && mongoose.isValidObjectId(partes[i + 1])) referencias.push([partes[i + 1], recursos[partes[i]]]);
    }
    for (const [campo, modelo] of referencias) {
      const id = body[campo] || campo;
      if (!mongoose.isValidObjectId(id)) continue;
      const entidade = await mongoose.model(modelo).findById(id).select('nome codigo ra rp titulo title assunto curso').lean();
      if (entidade) detalhes.push(`${modelo}: ${entidade.nome || entidade.title || entidade.titulo || entidade.assunto || entidade.codigo || id} (${entidade.ra || entidade.rp || entidade.codigo || id})${entidade.curso?.nome ? ` — curso: ${entidade.curso.nome}` : ''}`);
    }
    const enviar = res.json.bind(res);
    res.json = function (dados) {
      res.json = enviar;
      if (res.statusCode >= 400) return enviar(dados);
      const tipo = caminho.startsWith('/api/perfis') ? 'Conta' : caminho.includes('/calendario') ? 'Calendário' : caminho.includes('/chamados') ? 'Chamados' : 'Administração';
      let acao = dados.mensagem || `${req.method} ${caminho}`;
      if (caminho.endsWith('/status')) acao = body.status === 'finalizado' ? 'Chamado finalizado' : 'Chamado reaberto';
      if (dados.matricula) detalhes.push(`Matrícula gerada: ${dados.matricula}`);
      for (const recurso of ['curso', 'turma', 'disciplina', 'docente', 'evento', 'chamado']) {
        const entidade = dados[recurso];
        if (entidade) detalhes.push(`${recurso}: ${entidade.nome || entidade.title || entidade.assunto || entidade.codigo || ''} (${entidade.id || entidade._id || ''})`);
      }
      return registrar(usuario, tipo, acao, detalhes.join('\n')).then(() => enviar(dados)).catch(erro => {
        console.error('Falha ao registrar log:', erro.message);
        return enviar({ ...dados, avisoLog: 'A ação foi concluída, mas o registro de atividade falhou.' });
      });
    };
    next();
  } catch (erro) {
    console.error('Falha ao preparar log:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível preparar o registro de atividade. Tente novamente.' });
  }
}
module.exports = { registrar, auditar };
