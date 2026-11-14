document.addEventListener('DOMContentLoaded', async () => {
  const continuar = document.querySelector('[data-continue]');
  const continuarEquivalencias = document.querySelector('[data-continue-equivalencias]');
  const gradeGrid = document.querySelector('[data-course-grid]');
  const cursoStatus = document.querySelector('[data-course-status]');
  const tituloTelaCursos = document.querySelector('[data-course-screen-title]');
  const descricaoTelaCursos = document.querySelector('[data-course-screen-description]');
  const liberarTodas = document.querySelector('[data-open-all]');
  const liberarTodasLabel = document.querySelector('[data-open-all-label]');
  const fecharTodas = document.querySelector('[data-close-all]');
  const fecharTodasLabel = document.querySelector('[data-close-all-label]');
  const toolbar = document.querySelector('[data-course-toolbar]');
  const telaCursos = document.querySelector('[data-course-screen]');
  const menuOpcoes = document.querySelector('.admin-options-card');
  const introducao = document.querySelector('.admin-page-intro');
  let cursos = [];
  let modoAtual = 'grade';
  let gradesLiberadas = [];
  let equivalenciasLiberadas = [];
  const cabecalhosAutenticados = json => ({
    Authorization: `Bearer ${sessionStorage.getItem('notadez_token') || ''}`,
    ...(json ? { 'Content-Type': 'application/json' } : {})
  });

  const aplicarOpcoes = opcoes => {
    gradesLiberadas = (opcoes.gradeCursosLiberados || []).map(String);
    equivalenciasLiberadas = (opcoes.gradeEquivalenciasCursosLiberados || []).map(String);
    renderCursos();
  };

  const atualizarTextos = () => {
    const equivalencias = modoAtual === 'equivalencias';
    tituloTelaCursos.textContent = equivalencias ? 'Matérias equivalentes por curso' : 'Grade Curricular por curso';
    descricaoTelaCursos.textContent = equivalencias
      ? 'Selecione os cursos cujos alunos poderão incluir matérias equivalentes de outros cursos.'
      : 'Selecione um curso para liberar ou fechar o acesso dos alunos.';
    liberarTodasLabel.textContent = equivalencias ? 'Liberar equivalências para todos' : 'Liberar todas as grades';
    fecharTodasLabel.textContent = equivalencias ? 'Fechar equivalências para todos' : 'Fechar todas as matrículas';
  };

  const renderCursos = () => {
    if (!gradeGrid) return;
    const liberadas = modoAtual === 'equivalencias' ? equivalenciasLiberadas : gradesLiberadas;
    const nomeLiberacao = modoAtual === 'equivalencias' ? 'Inserção de equivalências' : 'Grade Curricular';
    gradeGrid.innerHTML = cursos.map(curso => {
      const liberado = liberadas.includes(String(curso.id));
      const estado = liberado ? 'liberada' : 'fechada';
      const iconeCadeado = liberado
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path><circle cx="12" cy="16" r="1"></circle><path d="M12 17v1"></path></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path><circle cx="12" cy="16" r="1"></circle><path d="M12 17v1"></path></svg>';
      return `<button class="admin-course-card" type="button" data-course-id="${curso.id}"><span class="admin-course-lock ${liberado ? 'is-open' : 'is-closed'}" role="img" aria-label="${nomeLiberacao} ${estado}" title="${nomeLiberacao} ${estado}">${iconeCadeado}</span><span class="admin-course-code">${curso.codigo || ''}</span><strong>${curso.nome}</strong><small>${nomeLiberacao} ${estado}</small></button>`;
    }).join('');
    gradeGrid.querySelectorAll('[data-course-id]').forEach(card => card.addEventListener('click', () => abrirModal(cursos.find(curso => String(curso.id) === card.dataset.courseId))));
  };

  const abrirModal = curso => {
    const equivalencias = modoAtual === 'equivalencias';
    const backdrop = document.createElement('div');
    backdrop.className = 'app-confirm-backdrop';
    backdrop.innerHTML = '<section class="app-confirm-dialog grade-course-dialog" role="dialog" aria-modal="true"><button class="grade-modal-close" type="button" aria-label="Fechar">×</button><span class="admin-eyebrow">Menu do aluno</span><h2></h2><p>Escolha se os alunos com matrícula ativa deste curso poderão acessar Grade Curricular no menu.</p><div class="app-confirm-actions"><button class="admin-button-secondary" type="button" data-state="false">Fechar Grade Curricular</button><button class="admin-button" type="button" data-state="true">Abrir Grade Curricular</button></div></section>';
    backdrop.querySelector('h2').textContent = curso.nome;
    backdrop.querySelector('p').textContent = equivalencias
      ? 'Escolha se os alunos com matrícula ativa deste curso poderão incluir matérias equivalentes de outros cursos.'
      : 'Escolha se os alunos com matrícula ativa deste curso poderão acessar Grade Curricular no menu.';
    backdrop.querySelector('[data-state="false"]').textContent = equivalencias ? 'Fechar equivalências' : 'Fechar Grade Curricular';
    backdrop.querySelector('[data-state="true"]').textContent = equivalencias ? 'Liberar equivalências' : 'Abrir Grade Curricular';
    document.body.append(backdrop);
    const fechar = () => backdrop.remove();
    backdrop.querySelector('.grade-modal-close').addEventListener('click', fechar);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) fechar(); });
    backdrop.querySelectorAll('[data-state]').forEach(botao => botao.addEventListener('click', async () => {
      botao.disabled = true;
      try {
        const rota = equivalencias ? '/api/admin/opcoes/grade-equivalencias-curso' : '/api/admin/opcoes/grade-curso';
        const resposta = await fetch(rota, { method: 'PUT', headers: cabecalhosAutenticados(true), body: JSON.stringify({ cursoId: curso.id, liberado: botao.dataset.state === 'true' }) });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível atualizar a grade.');
        aplicarOpcoes(dados.opcoes || {});
        cursoStatus.textContent = dados.mensagem;
        fechar();
      } catch (erro) { cursoStatus.textContent = erro.message; botao.disabled = false; }
    }));
  };

  const abrirTelaCursos = async (modo, botao) => {
    continuar.disabled = true;
    continuarEquivalencias.disabled = true;
    modoAtual = modo;
    atualizarTextos();
    try {
      const resposta = await fetch('/api/admin/cursos');
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível carregar os cursos.');
      cursos = dados.cursos || [];
      menuOpcoes.hidden = true;
      introducao.hidden = true;
      toolbar.hidden = false;
      telaCursos.hidden = false;
      renderCursos();
      cursoStatus.textContent = cursos.length ? '' : 'Nenhum curso cadastrado.';
    } catch (erro) {
      cursoStatus.textContent = erro.message;
      continuar.disabled = false;
      continuarEquivalencias.disabled = false;
      botao.disabled = false;
    }
  };

  continuar?.addEventListener('click', () => abrirTelaCursos('grade', continuar));
  continuarEquivalencias?.addEventListener('click', () => abrirTelaCursos('equivalencias', continuarEquivalencias));

  document.querySelector('[data-back-options]')?.addEventListener('click', () => {
    telaCursos.hidden = true;
    toolbar.hidden = true;
    introducao.hidden = false;
    menuOpcoes.hidden = false;
    continuar.disabled = false;
    continuarEquivalencias.disabled = false;
  });

  liberarTodas?.addEventListener('click', async () => {
    const equivalencias = modoAtual === 'equivalencias';
    const confirmado = await window.confirmAppAction(
      equivalencias
        ? 'A inserção de matérias equivalentes será liberada para todos os cursos. Deseja continuar?'
        : 'A Grade Curricular será liberada para todos os cursos. Deseja continuar?',
      equivalencias ? 'Liberar equivalências para todos' : 'Liberar todas as grades'
    );
    if (!confirmado) return;
    liberarTodas.disabled = true;
    try {
      const rota = equivalencias ? '/api/admin/opcoes/abrir-grade-equivalencias' : '/api/admin/opcoes/abrir-grades';
      const resposta = await fetch(rota, { method: 'PUT', headers: cabecalhosAutenticados(false) });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível liberar as grades.');
      aplicarOpcoes(dados.opcoes || {});
      cursoStatus.textContent = dados.mensagem;
    } catch (erro) {
      cursoStatus.textContent = erro.message;
    } finally {
      liberarTodas.disabled = false;
    }
  });

  fecharTodas?.addEventListener('click', async () => {
    const equivalencias = modoAtual === 'equivalencias';
    const confirmado = await window.confirmAppAction(
      equivalencias
        ? 'A inserção de matérias equivalentes será bloqueada para todos os cursos. Deseja continuar?'
        : 'O acesso a Grade Curricular será fechado para todos os cursos. Deseja continuar?',
      equivalencias ? 'Fechar equivalências para todos' : 'Fechar todas as matrículas'
    );
    if (!confirmado) return;
    fecharTodas.disabled = true;
    try {
      const rota = equivalencias ? '/api/admin/opcoes/fechar-grade-equivalencias' : '/api/admin/opcoes/fechar-grades';
      const resposta = await fetch(rota, { method: 'PUT', headers: cabecalhosAutenticados(false) });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível fechar as grades.');
      aplicarOpcoes(dados.opcoes || {});
      cursoStatus.textContent = dados.mensagem;
    } catch (erro) { cursoStatus.textContent = erro.message; }
    finally { fecharTodas.disabled = false; }
  });

  try {
    const resposta = await fetch('/api/opcoes');
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.mensagem || 'Falha ao carregar opções.');
    aplicarOpcoes(dados.opcoes || {});
  } catch (erro) {
    console.error('Erro ao carregar opções:', erro);
    cursoStatus.textContent = erro.message;
    continuar.disabled = true;
  }
});
