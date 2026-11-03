document.addEventListener('DOMContentLoaded', async () => {
  const root = document.querySelector('#catalog-content');
  const modalRoot = document.querySelector('#catalog-modal-root');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível concluir a operação.');
    return data;
  };
  let courses = [];
  let subjects = [];
  let selectedCourse = null;
  let selectedSemester = 0;
  const selectOptions = (values, selected) => values.map(value => `<option value="${escapeHtml(value)}"${String(value) === String(selected) ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');

  async function loadCourses() {
    courses = (await request('/api/admin/cursos')).cursos;
  }

  function renderCourses() {
    root.innerHTML = `<div class="schedule-toolbar"><label class="schedule-search"><span>Buscar curso</span><input id="catalog-course-search" type="search" placeholder="Nome ou código do curso"></label></div><div class="schedule-course-grid" id="catalog-course-grid"></div>`;
    const search = root.querySelector('#catalog-course-search');
    const grid = root.querySelector('#catalog-course-grid');
    const draw = () => {
      const term = normalize(search.value);
      const matches = courses.filter(course => normalize(`${course.nome} ${course.codigo} ${course.unidade}`).includes(term));
      grid.innerHTML = matches.length ? matches.map(course => `<button type="button" class="schedule-course-card" data-course="${escapeHtml(course.id)}"><span class="schedule-card-symbol" aria-hidden="true">&#9671;</span><strong>${escapeHtml(course.nome)}</strong><small>${escapeHtml(course.codigo)} · ${course.duracao} semestres</small><span class="schedule-card-action">Ver semestres <b aria-hidden="true">&#8594;</b></span></button>`).join('') : '<div class="schedule-empty">Nenhum curso encontrado.</div>';
      grid.querySelectorAll('[data-course]').forEach(card => card.addEventListener('click', () => { selectedCourse = courses.find(course => course.id === card.dataset.course); selectedSemester = 0; renderSemesters(); }));
    };
    search.addEventListener('input', draw);
    draw();
  }

  function renderSemesters() {
    root.innerHTML = `<div class="schedule-breadcrumb"><button class="schedule-back" type="button" data-back>← Cursos</button><span>${escapeHtml(selectedCourse.nome)} · ${escapeHtml(selectedCourse.codigo)}</span></div><div class="catalog-course-summary"><div><h3>${escapeHtml(selectedCourse.nome)}</h3><p>${escapeHtml(selectedCourse.unidade)} · ${escapeHtml(selectedCourse.grau)} · ${escapeHtml(selectedCourse.modalidade)}</p></div><button class="admin-button catalog-edit-button" type="button" data-edit-course>Editar curso</button></div><div class="schedule-step-heading"><h3>Semestres do curso</h3><p>Selecione um semestre para consultar e editar as disciplinas.</p></div><div class="schedule-semester-grid">${Array.from({ length: Number(selectedCourse.duracao) || 0 }, (_, index) => `<button type="button" class="schedule-semester-card${selectedSemester === index + 1 ? ' is-selected' : ''}" data-semester="${index + 1}"><span class="schedule-semester-number">${String(index + 1).padStart(2, '0')}</span><strong>${index + 1}º semestre</strong><small>${subjects.filter(subject => subject.semestre === index + 1).length} disciplina(s)</small></button>`).join('')}</div>${selectedSemester ? renderSubjects() : ''}`;
    root.querySelector('[data-back]').addEventListener('click', () => { selectedCourse = null; selectedSemester = 0; renderCourses(); });
    root.querySelector('[data-edit-course]').addEventListener('click', () => openCourseModal(selectedCourse));
    root.querySelectorAll('[data-semester]').forEach(card => card.addEventListener('click', () => { selectedSemester = Number(card.dataset.semester); renderSemesters(); }));
    if (selectedSemester) bindSubjectSearch();
  }

  function renderSubjects() {
    const list = subjects.filter(subject => subject.semestre === selectedSemester);
    return `<section class="catalog-subject-section"><div class="catalog-section-heading"><div><h3>Disciplinas · ${selectedSemester}º semestre</h3><p>Selecione um card para editar seus dados.</p></div></div><label class="schedule-search"><span>Buscar disciplina</span><input id="catalog-subject-search" type="search" placeholder="Nome ou código da disciplina"></label><div class="schedule-subject-list" id="catalog-subject-grid">${subjectCards(list)}</div></section>`;
  }

  function subjectCards(list) {
    return list.length ? list.map(subject => `<button type="button" class="schedule-course-card catalog-subject-card" data-subject="${escapeHtml(subject.id)}"><span class="schedule-card-symbol" aria-hidden="true">&#9670;</span><strong>${escapeHtml(subject.nome)}</strong><small>${escapeHtml(subject.codigo)} · ${subject.semestre}º semestre</small><span class="schedule-card-action">Editar disciplina <b aria-hidden="true">&#8594;</b></span></button>`).join('') : '<div class="schedule-empty">Nenhuma disciplina encontrada neste semestre.</div>';
  }

  function bindSubjectSearch() {
    const search = root.querySelector('#catalog-subject-search');
    const grid = root.querySelector('#catalog-subject-grid');
    const draw = () => {
      const term = normalize(search.value);
      grid.innerHTML = subjectCards(subjects.filter(subject => subject.semestre === selectedSemester && normalize(`${subject.nome} ${subject.codigo} ${subject.descricao}`).includes(term)));
      grid.querySelectorAll('[data-subject]').forEach(card => card.addEventListener('click', () => openSubjectModal(subjects.find(subject => subject.id === card.dataset.subject))));
    };
    search.addEventListener('input', draw);
    draw();
  }

  function showModal(title, description, fields, onSave, onDelete) {
    modalRoot.innerHTML = `<div class="catalog-modal-backdrop" data-close><section class="catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title"><button class="catalog-modal-close" type="button" aria-label="Fechar" data-close>×</button><div class="admin-page-intro"><span class="admin-eyebrow">Editar cadastro</span><h2 id="catalog-modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><form id="catalog-edit-form"><div class="admin-field-grid">${fields}</div><p class="catalog-feedback" role="status" aria-live="polite"></p><div class="catalog-modal-actions"><button class="catalog-delete-button" type="button" data-delete>Excluir</button><div><button class="admin-button-secondary" type="button" data-close>Cancelar</button><button class="admin-button" type="submit">Salvar alterações</button></div></div></form></section></div>`;
    const backdrop = modalRoot.querySelector('.catalog-modal-backdrop');
    modalRoot.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', event => { if (event.target === backdrop || button.tagName === 'BUTTON') modalRoot.innerHTML = ''; }));
    modalRoot.querySelector('#catalog-edit-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      try { await onSave(new FormData(event.currentTarget)); modalRoot.innerHTML = ''; }
      catch (error) { modalRoot.querySelector('.catalog-feedback').textContent = error.message; button.disabled = false; }
    });
    modalRoot.querySelector('[data-delete]').addEventListener('click', async () => {
      if (!confirm(`Excluir ${title.toLocaleLowerCase('pt-BR')}? Esta ação não pode ser desfeita.`)) return;
      const button = modalRoot.querySelector('[data-delete]');
      button.disabled = true;
      try { await onDelete(); modalRoot.innerHTML = ''; }
      catch (error) { modalRoot.querySelector('.catalog-feedback').textContent = error.message; button.disabled = false; }
    });
  }

  function field(label, name, value, type = 'text', wide = false, required = true) {
    const requiredAttribute = required ? ' required' : '';
    const control = type === 'textarea' ? `<textarea name="${name}" rows="4"${requiredAttribute}>${escapeHtml(value)}</textarea>` : `<input name="${name}" type="${type}" value="${escapeHtml(value)}"${type === 'number' ? ' min="1" max="20"' : ''}${requiredAttribute}>`;
    return `<label class="admin-field${wide ? ' admin-field-wide' : ''}"><span>${label}</span>${control}</label>`;
  }

  function selectField(label, name, options, selected) {
    return `<label class="admin-field"><span>${label}</span><select name="${name}" required>${selectOptions(options, selected)}</select></label>`;
  }

  function openCourseModal(course) {
    const grades = ['Bacharelado', 'Licenciatura', 'Tecnólogo', 'Pós-Graduação', 'Mestrado', 'Pós Doutorado'];
    const modalities = ['Presencial', 'Semipresencial', 'Ensino a Distância (EAD)'];
    const fields = field('Código do curso', 'codigo', course.codigo) + field('Nome do curso', 'nome', course.nome) + field('Unidade acadêmica', 'unidade', course.unidade) + selectField('Grau acadêmico', 'grau', grades, course.grau) + field('Duração (semestres)', 'duracao', course.duracao, 'number') + selectField('Modalidade', 'modalidade', modalities, course.modalidade) + field('Descrição', 'descricao', course.descricao, 'textarea', true, false);
    showModal('Dados do curso', 'Atualize as informações do curso. Cursos com disciplinas não podem ser excluídos.', fields, async form => {
      const values = Object.fromEntries(form.entries());
      const result = await request(`/api/admin/cursos/${encodeURIComponent(course.id)}`, { method: 'PUT', body: JSON.stringify(values) });
      await loadCourses(); selectedCourse = courses.find(item => item.id === course.id) || result.curso; renderSemesters();
    }, async () => {
      await request(`/api/admin/cursos/${encodeURIComponent(course.id)}`, { method: 'DELETE' });
      await loadCourses(); selectedCourse = null; selectedSemester = 0; renderCourses();
    });
  }

  function openSubjectModal(subject) {
    const initialCourse = courses.find(course => course.id === subject.cursoId);
    const semesterOptions = Array.from({ length: initialCourse?.duracao || 1 }, (_, index) => index + 1);
    const courseOptions = courses.map(course => `<option value="${escapeHtml(course.id)}"${course.id === subject.cursoId ? ' selected' : ''}>${escapeHtml(course.nome)} (${escapeHtml(course.codigo)})</option>`).join('');
    const fields = field('Nome', 'nome', subject.nome) + field('Código', 'codigo', subject.codigo) + `<label class="admin-field"><span>Curso</span><select name="cursoId" required>${courseOptions}</select></label>` + selectField('Semestre', 'semestre', semesterOptions, subject.semestre) + field('Descrição', 'descricao', subject.descricao, 'textarea', true);
    showModal('Dados da disciplina', 'Disciplinas com aulas em grades de horário não podem ser excluídas.', fields, async form => {
      await request(`/api/admin/disciplinas/${encodeURIComponent(subject.id)}`, { method: 'PUT', body: JSON.stringify(Object.fromEntries(form.entries())) });
      await reloadSubjects();
    }, async () => {
      await request(`/api/admin/disciplinas/${encodeURIComponent(subject.id)}`, { method: 'DELETE' });
      await reloadSubjects();
    });
    const courseSelect = modalRoot.querySelector('[name="cursoId"]');
    courseSelect.addEventListener('change', () => {
      const duration = Number(courses.find(course => course.id === courseSelect.value)?.duracao) || 1;
      const semesterSelect = modalRoot.querySelector('[name="semestre"]');
      const current = Number(semesterSelect.value);
      semesterSelect.innerHTML = Array.from({ length: duration }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join('');
      semesterSelect.value = String(Math.min(current || 1, duration));
    });
  }

  async function reloadSubjects() {
    subjects = (await request(`/api/admin/disciplinas?cursoId=${encodeURIComponent(selectedCourse.id)}`)).disciplinas;
    renderSemesters();
  }

  try {
    const [courseData, subjectData] = await Promise.all([request('/api/admin/cursos'), request('/api/admin/disciplinas')]);
    courses = courseData.cursos;
    subjects = subjectData.disciplinas;
    renderCourses();
  } catch (error) { root.innerHTML = `<div class="schedule-empty">${escapeHtml(error.message)}</div>`; }
});
