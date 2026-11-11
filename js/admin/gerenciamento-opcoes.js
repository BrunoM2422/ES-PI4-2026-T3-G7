document.addEventListener('DOMContentLoaded', async () => {
  const continuar = document.querySelector('[data-continue]');
  const gradeGrid = document.querySelector('[data-course-grid]');
  const cursoStatus = document.querySelector('[data-course-status]');
  const fecharTodas = document.querySelector('[data-close-all]');
  const toolbar = document.querySelector('[data-course-toolbar]');
  const telaCursos = document.querySelector('[data-course-screen]');
  const menuOpcoes = document.querySelector('.admin-options-card');
  const introducao = document.querySelector('.admin-page-intro');
  let cursos = [];
  let gradesLiberadas = [];

  const aplicarOpcoes = opcoes => {
    gradesLiberadas = (opcoes.gradeCursosLiberados || []).map(String);
    renderCursos();
  };

  const renderCursos = () => {
    if (!gradeGrid) return;
    gradeGrid.innerHTML = cursos.map(curso => `<button class="admin-course-card" type="button" data-course-id="${curso.id}"><span class="admin-course-code">${curso.codigo || ''}</span><strong>${curso.nome}</strong><small>${gradesLiberadas.includes(String(curso.id)) ? 'Grade Curricular liberada' : 'Grade Curricular fechada'}</small></button>`).join('');
    gradeGrid.querySelectorAll('[data-course-id]').forEach(card => card.addEventListener('click', () => abrirModal(cursos.find(curso => String(curso.id) === card.dataset.courseId))));
  };

  const abrirModal = curso => {
    const backdrop = document.createElement('div');
    backdrop.className = 'app-confirm-backdrop';
    backdrop.innerHTML = '<section class="app-confirm-dialog grade-course-dialog" role="dialog" aria-modal="true"><button class="grade-modal-close" type="button" aria-label="Fechar">×</button><span class="admin-eyebrow">Menu do aluno</span><h2></h2><p>Escolha se os alunos com matrícula ativa deste curso poderão acessar Grade Curricular no menu.</p><div class="app-confirm-actions"><button class="admin-button-secondary" type="button" data-state="false">Fechar Grade Curricular</button><button class="admin-button" type="button" data-state="true">Abrir Grade Curricular</button></div></section>';
    backdrop.querySelector('h2').textContent = curso.nome;
    document.body.append(backdrop);
    const fechar = () => backdrop.remove();
    backdrop.querySelector('.grade-modal-close').addEventListener('click', fechar);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) fechar(); });
    backdrop.querySelectorAll('[data-state]').forEach(botao => botao.addEventListener('click', async () => {
      botao.disabled = true;
      try {
        const resposta = await fetch('/api/admin/opcoes/grade-curso', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cursoId: curso.id, liberado: botao.dataset.state === 'true' }) });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível atualizar a grade.');
        aplicarOpcoes(dados.opcoes || {});
        cursoStatus.textContent = dados.mensagem;
        fechar();
      } catch (erro) { cursoStatus.textContent = erro.message; botao.disabled = false; }
    }));
  };

  continuar?.addEventListener('click', async () => {
    continuar.disabled = true;
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
    } catch (erro) { cursoStatus.textContent = erro.message; continuar.disabled = false; }
  });

  document.querySelector('[data-back-options]')?.addEventListener('click', () => {
    telaCursos.hidden = true;
    toolbar.hidden = true;
    introducao.hidden = false;
    menuOpcoes.hidden = false;
    continuar.disabled = false;
  });

  fecharTodas?.addEventListener('click', async () => {
    const confirmado = await window.confirmAppAction('O acesso a Grade Curricular será fechado para todos os cursos. Deseja continuar?', 'Fechar todas as matrículas');
    if (!confirmado) return;
    fecharTodas.disabled = true;
    try {
      const resposta = await fetch('/api/admin/opcoes/fechar-grades', { method: 'PUT' });
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
