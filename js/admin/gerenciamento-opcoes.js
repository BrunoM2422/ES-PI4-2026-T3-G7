// Autores:
document.addEventListener('DOMContentLoaded', async () => {
  const $ = selector => document.querySelector(selector);
  const buttons = { grade: $('[data-continue]'), equivalencias: $('[data-continue-equivalencias]'), avaliacao: $('[data-continue-avaliacao]') };
  const grid = $('[data-course-grid]');
  const status = $('[data-course-status]');
  const screen = $('[data-course-screen]');
  const toolbar = $('[data-course-toolbar]');
  const menu = $('.admin-options-card');
  const currentUser = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
  const isCoordinator = currentUser?.nivelPermissao === 'admin_2';
  if (isCoordinator) {
    $('[data-continue-equivalencias]')?.closest('[data-equivalencia-entry]')?.remove();
    $('[data-open-all]')?.closest('.grade-admin-actions')?.remove();
  }
  const intro = $('.admin-page-intro');
  const title = $('[data-course-screen-title]');
  const description = $('[data-course-screen-description]');
  const openAll = $('[data-open-all]');
  const closeAll = $('[data-close-all]');
  const apiHeaders = json => ({ Authorization: `Bearer ${sessionStorage.getItem('notadez_token') || ''}`, ...(json ? { 'Content-Type': 'application/json' } : {}) });
  const modes = {
    grade: { ids: 'gradeCursosLiberados', label: 'Grade Curricular', one: '/api/admin/opcoes/grade-curso', open: '/api/admin/opcoes/abrir-grades', close: '/api/admin/opcoes/fechar-grades' },
    equivalencias: { ids: 'gradeEquivalenciasCursosLiberados', label: 'Materias equivalentes', one: '/api/admin/opcoes/grade-equivalencias-curso', open: '/api/admin/opcoes/abrir-grade-equivalencias', close: '/api/admin/opcoes/fechar-grade-equivalencias' },
    avaliacao: { ids: 'avaliacaoProfessoresCursosLiberados', label: 'Avalia\u00e7\u00e3o de Professores', one: '/api/admin/opcoes/avaliacao-professores-curso', open: '/api/admin/opcoes/abrir-avaliacao-professores', close: '/api/admin/opcoes/fechar-avaliacao-professores' }
  };
  let mode = 'grade';
  let courses = [];
  let released = {};
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const applyOptions = options => { released = Object.fromEntries(Object.values(modes).map(item => [item.ids, (options[item.ids] || []).map(String)])); renderCourses(); };

  function renderCourses() {
    if (!grid) return;
    const config = modes[mode];
    const ids = released[config.ids] || [];
    grid.innerHTML = courses.map(course => {
      const isReleased = ids.includes(String(course.id));
      const state = isReleased ? 'liberada' : 'fechada';
      const lock = isReleased ? '<path d="M7 11V7a5 5 0 0 1 9.9-1"/>' : '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
      return `<button class="admin-course-card" type="button" data-course-id="${escapeHtml(course.id)}"><span class="admin-course-lock ${isReleased ? 'is-open' : 'is-closed'}" role="img" aria-label="${config.label} ${state}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"></rect>${lock}<circle cx="12" cy="16" r="1"></circle></svg></span><span class="admin-course-code">${escapeHtml(course.codigo || '')}</span><strong>${escapeHtml(course.nome)}</strong><small>${config.label} ${state}</small></button>`;
    }).join('');
    grid.querySelectorAll('[data-course-id]').forEach(card => card.addEventListener('click', () => openCourse(courses.find(course => String(course.id) === card.dataset.courseId))));
  }

  function openCourse(course) {
    const config = modes[mode];
    const isReleased = (released[config.ids] || []).includes(String(course.id));
    const backdrop = document.createElement('div');
    backdrop.className = 'app-confirm-backdrop';
    backdrop.innerHTML = `<section class="app-confirm-dialog grade-course-dialog" role="dialog" aria-modal="true"><button class="grade-modal-close" type="button" aria-label="Fechar">&times;</button><span class="admin-eyebrow">Menu do aluno</span><h2>${escapeHtml(course.nome)}</h2><p>${mode === 'avaliacao' ? 'Escolha se os alunos deste curso poderao avaliar os professores.' : `Escolha se os alunos deste curso poderao usar ${config.label}.`}</p><div class="app-confirm-actions"><button class="admin-button-secondary" type="button" data-release="false">Fechar ${config.label}</button><button class="admin-button" type="button" data-release="true">Liberar ${config.label}</button></div></section>`;
    const close = () => backdrop.remove();
    document.body.append(backdrop);
    backdrop.querySelector('.grade-modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
    backdrop.querySelectorAll('[data-release]').forEach(button => {
      button.disabled = button.dataset.release === String(isReleased);
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const response = await fetch(config.one, { method: 'PUT', headers: apiHeaders(true), body: JSON.stringify({ cursoId: course.id, liberado: button.dataset.release === 'true' }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.mensagem || 'Nao foi possivel atualizar a liberacao.');
          applyOptions(data.opcoes || {});
          status.textContent = data.mensagem;
          close();
        } catch (error) { status.textContent = error.message; button.disabled = false; }
      });
    });
  }

  async function openMode(nextMode, trigger) {
    buttons.grade.disabled = buttons.equivalencias.disabled = buttons.avaliacao.disabled = true;
    mode = nextMode;
    const config = modes[mode];
    title.textContent = `${config.label} por curso`;
    description.textContent = mode === 'avaliacao' ? 'Selecione os cursos cujos alunos poderao avaliar seus professores.' : `Selecione os cursos para liberar ou fechar ${config.label}.`;
    $('[data-open-all-label]').textContent = `Liberar ${config.label} para todos`;
    $('[data-close-all-label]').textContent = `Fechar ${config.label} para todos`;
    try {
      const response = await fetch('/api/admin/cursos');
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensagem || 'Nao foi possivel carregar os cursos.');
      courses = (data.cursos || []).filter(course => !isCoordinator || String(course.id) === String(currentUser.cursoId));
      menu.hidden = intro.hidden = true;
      toolbar.hidden = screen.hidden = false;
      renderCourses();
      status.textContent = courses.length ? '' : 'Nenhum curso cadastrado.';
    } catch (error) { status.textContent = error.message; buttons[nextMode].disabled = false; }
    finally { if (!screen.hidden) buttons[nextMode].disabled = false; }
    trigger.blur();
  }

  Object.entries(buttons).forEach(([key, button]) => button?.addEventListener('click', () => openMode(key, button)));
  $('[data-back-options]')?.addEventListener('click', () => {
    screen.hidden = true;
    toolbar.hidden = true;
    intro.hidden = menu.hidden = false;
    Object.values(buttons).forEach(button => { button.disabled = false; });
  });

  async function changeAll(release) {
    const config = modes[mode];
    const confirmed = await window.confirmAppAction(`A opcao ${config.label} sera ${release ? 'liberada' : 'fechada'} para todos os cursos. Deseja continuar?`, `${release ? 'Liberar' : 'Fechar'} ${config.label} para todos`);
    if (!confirmed) return;
    const button = release ? openAll : closeAll;
    button.disabled = true;
    try {
      const response = await fetch(config[release ? 'open' : 'close'], { method: 'PUT', headers: apiHeaders(false) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensagem || 'Nao foi possivel atualizar as liberacoes.');
      applyOptions(data.opcoes || {});
      status.textContent = data.mensagem;
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  }
  openAll?.addEventListener('click', () => changeAll(true));
  closeAll?.addEventListener('click', () => changeAll(false));

  try {
    const response = await fetch('/api/opcoes');
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Falha ao carregar opcoes.');
    applyOptions(data.opcoes || {});
  } catch (error) { console.error('Erro ao carregar opcoes:', error); status.textContent = error.message; buttons.grade.disabled = true; }
});
