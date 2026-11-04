document.addEventListener('DOMContentLoaded', async () => {
  const root = document.querySelector('#turma-management-content');
  const modalRoot = document.querySelector('#turma-management-modal-root');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível concluir a operação.');
    return data;
  };
  let courses = [];
  let turmas = [];
  let selectedCourse = null;

  const classesForCourse = () => turmas.filter(turma => turma.cursoId === selectedCourse.id);

  async function loadData() {
    const [courseData, turmaData] = await Promise.all([
      request('/api/admin/cursos'), request('/api/admin/turmas')
    ]);
    courses = courseData.cursos;
    turmas = turmaData.turmas;
  }

  function renderCourses() {
    selectedCourse = null;
    root.innerHTML = `<div class="schedule-toolbar"><label class="schedule-search"><span>Buscar curso</span><input type="search" id="turma-course-search" placeholder="Nome ou código do curso"></label></div><div class="schedule-course-grid" id="turma-course-grid"></div>`;
    const search = root.querySelector('#turma-course-search');
    const grid = root.querySelector('#turma-course-grid');
    const draw = () => {
      const term = normalize(search.value);
      const matches = courses.filter(course => normalize(`${course.nome} ${course.codigo} ${course.unidade}`).includes(term));
      grid.innerHTML = matches.length ? matches.map(course => `<button type="button" class="schedule-course-card" data-course="${escapeHtml(course.id)}"><span class="schedule-card-symbol" aria-hidden="true">◇</span><strong>${escapeHtml(course.nome)}</strong><small>${escapeHtml(course.codigo)}</small><span class="schedule-card-action">Ver disciplinas <b aria-hidden="true">→</b></span></button>`).join('') : '<div class="schedule-empty">Nenhum curso encontrado.</div>';
      grid.querySelectorAll('[data-course]').forEach(card => card.addEventListener('click', () => {
        selectedCourse = courses.find(course => course.id === card.dataset.course);
        renderTurmas();
      }));
    };
    search.addEventListener('input', draw);
    draw();
  }

  function renderTurmas() {
    const list = classesForCourse();
    root.innerHTML = `<div class="schedule-breadcrumb"><button class="schedule-back" type="button" data-back-courses>← Cursos</button><span>${escapeHtml(selectedCourse.nome)} · ${escapeHtml(selectedCourse.codigo)}</span></div><div class="catalog-course-summary"><div><h3>Turmas de ${escapeHtml(selectedCourse.nome)}</h3><p>${escapeHtml(selectedCourse.codigo)} · ${escapeHtml(selectedCourse.duracao)} semestres · ${list.length} turma(s)</p></div></div><div class="catalog-section-heading"><div><h3>Todas as turmas do curso</h3><p>Selecione um card para editar os dados da turma.</p></div></div><label class="schedule-search turma-search"><span>Buscar turma</span><input type="search" id="turma-search" placeholder="Código ou semestre"></label><div class="schedule-course-grid" id="turma-grid"></div>`;
    root.querySelector('[data-back-courses]').addEventListener('click', renderCourses);
    const search = root.querySelector('#turma-search');
    const grid = root.querySelector('#turma-grid');
    const draw = () => renderTurmaCards(list.filter(turma => normalize(`${turma.codigo} ${turma.periodoLetivo} ${turma.vagas}`).includes(normalize(search.value))), grid);
    search.addEventListener('input', draw);
    draw();
  }

  function renderTurmaCards(list, grid) {
    grid.innerHTML = list.length ? list.map(turma => {
      const count = (turma.horarios || []).length;
      const subjectsForClass = [...new Set((turma.horarios || []).map(item => typeof item.disciplinaId === 'object' ? item.disciplinaId.nome : '').filter(Boolean))];
      const subjectSummary = subjectsForClass.length ? subjectsForClass.join(', ') : 'Ainda sem disciplina vinculada';
      return `<button type="button" class="schedule-course-card catalog-turma-card" data-turma="${escapeHtml(turma.id)}"><span class="schedule-card-symbol" aria-hidden="true">▦</span><strong>Turma ${escapeHtml(turma.codigo)}</strong><small>${escapeHtml(turma.periodoLetivo)}º semestre · ${escapeHtml(turma.vagas)} vagas</small><small>${escapeHtml(subjectSummary)}</small><span class="schedule-card-action">${count ? `${count} horário(s) vinculado(s)` : 'Sem horários vinculados'} <b aria-hidden="true">→</b></span></button>`;
    }).join('') : '<div class="schedule-empty">Nenhuma turma encontrada neste grupo.</div>';
    grid.querySelectorAll('[data-turma]').forEach(card => card.addEventListener('click', () => openTurmaModal(turmas.find(turma => turma.id === card.dataset.turma))));
  }

  function openTurmaModal(turma) {
    const courseOptions = courses.map(course => `<option value="${escapeHtml(course.id)}"${course.id === turma.cursoId ? ' selected' : ''}>${escapeHtml(course.nome)} (${escapeHtml(course.codigo)})</option>`).join('');
    const periodOptions = course => Array.from({ length: Number(course?.duracao) || 0 }, (_, index) => `<option value="${index + 1}"${Number(turma.periodoLetivo) === index + 1 ? ' selected' : ''}>${index + 1}º semestre</option>`).join('');
    const turmaNumber = /^\d{4}$/.test(turma.codigo) ? Number(turma.codigo.slice(2)) : Number(String(turma.codigo).match(/(\d{1,2})$/)?.[1]) || 1;
    const assigned = (turma.horarios || []).map(item => {
      const subjectName = typeof item.disciplinaId === 'object' ? item.disciplinaId.nome : 'Disciplina';
      return `<li>${escapeHtml(subjectName)} · semestre ${escapeHtml(item.semestre)} · ${escapeHtml(item.dia)} às ${escapeHtml(item.hora)}h</li>`;
    }).join('');
    modalRoot.innerHTML = `<div class="catalog-modal-backdrop" data-modal-backdrop><section class="catalog-modal" role="dialog" aria-modal="true" aria-labelledby="turma-modal-title"><button class="catalog-modal-close" type="button" aria-label="Fechar" data-close>×</button><div class="admin-page-intro"><span class="admin-eyebrow">Editar cadastro</span><h2 id="turma-modal-title">Dados da turma</h2><p>Atualize os dados cadastrados da turma. Turmas com horários vinculados não podem mudar de curso ou semestre, nem ser removidas.</p></div><form id="turma-edit-form"><div class="admin-field-grid"><label class="admin-field"><span>Número da turma</span><div class="admin-discipline-code"><span class="admin-discipline-prefix" data-code-prefix>${String(Number(turma.periodoLetivo)).padStart(2, '0')}</span><input name="numeroTurma" type="number" min="1" max="99" step="1" value="${escapeHtml(turmaNumber)}" required></div><small class="admin-local-note">O código é formado pelo semestre e pelo número da turma.</small></label><label class="admin-field"><span>Curso</span><select name="cursoId" required>${courseOptions}</select></label><label class="admin-field"><span>Período letivo</span><select name="periodoLetivo" required>${periodOptions(courses.find(course => course.id === turma.cursoId))}</select></label><label class="admin-field"><span>Vagas</span><input name="vagas" type="number" min="1" max="300" value="${escapeHtml(turma.vagas)}" required></label>${assigned ? `<div class="admin-field admin-field-wide"><span>Horários vinculados</span><ul class="turma-schedule-list">${assigned}</ul></div>` : ''}</div><p class="catalog-feedback" role="status" aria-live="polite"></p><div class="catalog-modal-actions"><button class="catalog-delete-button" type="button" data-delete${(turma.horarios || []).length ? ' disabled title="Remova os horários vinculados antes de excluir"' : ''}>Remover turma</button><div><button class="admin-button-secondary" type="button" data-close>Cancelar</button><button class="admin-button" type="submit">Salvar alterações</button></div></div></form></section></div>`;
    const close = () => { modalRoot.innerHTML = ''; };
    const courseSelect = modalRoot.querySelector('[name="cursoId"]');
    const periodSelect = modalRoot.querySelector('[name="periodoLetivo"]');
    courseSelect.addEventListener('change', () => {
      const selectedPeriod = Number(periodSelect.value) || 1;
      const selectedCourse = courses.find(course => course.id === courseSelect.value);
      periodSelect.innerHTML = periodOptions(selectedCourse);
      periodSelect.value = String(Math.min(selectedPeriod, Number(selectedCourse?.duracao) || 1));
      modalRoot.querySelector('[data-code-prefix]').textContent = String(Number(periodSelect.value)).padStart(2, '0');
    });
    periodSelect.addEventListener('change', () => {
      modalRoot.querySelector('[data-code-prefix]').textContent = String(Number(periodSelect.value)).padStart(2, '0');
    });
    modalRoot.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', event => { if (event.target === modalRoot.querySelector('[data-modal-backdrop]') || button.tagName === 'BUTTON') close(); }));
    modalRoot.querySelector('#turma-edit-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const values = Object.fromEntries(new FormData(event.currentTarget).entries());
        values.codigo = `${String(Number(values.periodoLetivo)).padStart(2, '0')}${String(Number(values.numeroTurma)).padStart(2, '0')}`;
        delete values.numeroTurma;
        await request(`/api/admin/turmas/${encodeURIComponent(turma.id)}`, { method: 'PUT', body: JSON.stringify(values) });
        await loadData();
        selectedCourse = courses.find(course => course.id === selectedCourse.id);
        close();
        renderTurmas();
      } catch (error) { modalRoot.querySelector('.catalog-feedback').textContent = error.message; button.disabled = false; }
    });
    modalRoot.querySelector('[data-delete]').addEventListener('click', async event => {
      const button = event.currentTarget;
      if (!await confirmRemoval(turma.codigo)) return;
      button.disabled = true;
      try {
        await request(`/api/admin/turmas/${encodeURIComponent(turma.id)}`, { method: 'DELETE' });
        await loadData();
        close();
        renderTurmas();
      } catch (error) { modalRoot.querySelector('.catalog-feedback').textContent = error.message; button.disabled = false; }
    });
  }

  function confirmRemoval(code) {
    return new Promise(resolve => {
      modalRoot.insertAdjacentHTML('beforeend', `<div class="teacher-confirm-backdrop" data-confirm-overlay><section class="teacher-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="turma-confirm-title"><span class="teacher-confirm-icon" aria-hidden="true">!</span><h2 id="turma-confirm-title">Remover turma?</h2><p>A turma <strong>${escapeHtml(code)}</strong> será removida permanentemente.</p><div class="teacher-confirm-actions"><button type="button" class="admin-button-secondary" data-cancel>Cancelar</button><button type="button" class="catalog-delete-button" data-accept>Remover</button></div></section></div>`);
      const overlay = modalRoot.querySelector('[data-confirm-overlay]');
      const done = value => { document.removeEventListener('keydown', onKeyDown); overlay.remove(); resolve(value); };
      const onKeyDown = event => { if (event.key === 'Escape') done(false); };
      overlay.querySelector('[data-cancel]').addEventListener('click', () => done(false));
      overlay.querySelector('[data-accept]').addEventListener('click', () => done(true));
      overlay.addEventListener('click', event => { if (event.target === overlay) done(false); });
      document.addEventListener('keydown', onKeyDown);
      overlay.querySelector('[data-cancel]').focus();
    });
  }

  try { await loadData(); renderCourses(); }
  catch (error) { root.innerHTML = `<div class="schedule-empty">${escapeHtml(error.message)}</div>`; }
});
