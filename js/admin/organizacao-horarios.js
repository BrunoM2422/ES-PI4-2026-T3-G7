document.addEventListener('DOMContentLoaded', async () => {
  const root = document.querySelector('#schedule-content');
  const modalRoot = document.querySelector('#teacher-modal-root');
  const params = new URLSearchParams(location.search);
  let cursoId = params.get('curso');
  let semestreSelecionado = Number(params.get('semestre')) || 0;
  const chaveGrade = () => `notadez_grade_${cursoId}_${semestreSelecionado}`;
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const disciplinas = [
    { id: 'estudos-bd-1', nome: 'Estudos de Banco de Dados 1', codigo: 'BD101' },
    { id: 'programacao-python-1', nome: 'Programação em Python 1', codigo: 'PY101' }
  ];
  const normalizar = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  let cursos = [];
  let docentes = [];
  let grade = [];
  let cursoAtual;

  const carregarJson = async url => {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar os dados.');
    return data;
  };
  const navegar = (curso, semestre) => {
    cursoId = curso || null;
    semestreSelecionado = Number(semestre) || 0;
    const query = new URLSearchParams();
    if (curso) query.set('curso', curso);
    if (semestre) query.set('semestre', semestre);
    history.pushState({}, '', `${location.pathname}${query.size ? `?${query}` : ''}`);
    renderizar();
  };
  const escapar = texto => String(texto).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  function renderCursos() {
    root.innerHTML = `<div class="schedule-toolbar"><label class="schedule-search"><span>Buscar curso</span><input id="course-search" type="search" placeholder="Nome ou código do curso"></label></div><div id="course-grid" class="schedule-course-grid"></div>`;
    const input = root.querySelector('#course-search');
    const grid = root.querySelector('#course-grid');
    const pintar = () => {
      const termo = normalizar(input.value);
      const filtrados = cursos.filter(curso => normalizar(`${curso.nome} ${curso.codigo}`).includes(termo));
      grid.innerHTML = filtrados.length ? filtrados.map(curso => `<button class="schedule-course-card" data-course="${escapar(curso.id)}"><span class="schedule-card-symbol">&#9671;</span><strong>${escapar(curso.nome)}</strong><small>${escapar(curso.codigo)} · ${curso.duracao} semestres</small><span class="schedule-card-action">Ver semestres <b aria-hidden="true">&#8594;</b></span></button>`).join('') : '<div class="schedule-empty">Nenhum curso encontrado.</div>';
      grid.querySelectorAll('[data-course]').forEach(card => card.addEventListener('click', () => navegar(card.dataset.course)));
    };
    input.addEventListener('input', pintar);
    pintar();
  }

  function renderSemestres() {
    const qtd = Math.max(0, Math.min(20, Number(cursoAtual.duracao) || 0));
    root.innerHTML = `<div class="schedule-breadcrumb"><button class="schedule-back" data-back>← Cursos</button><span>${escapar(cursoAtual.nome)} · ${escapar(cursoAtual.codigo)}</span></div><div class="schedule-step-heading"><h3>Semestres do curso</h3><p>Selecione o semestre que deseja organizar.</p></div><div class="schedule-semester-grid">${Array.from({ length: qtd }, (_, i) => `<button class="schedule-semester-card" data-semester="${i + 1}"><span class="schedule-semester-number">${String(i + 1).padStart(2, '0')}</span><strong>${i + 1}º semestre</strong><small>Organizar grade semanal</small></button>`).join('') || '<div class="schedule-empty">Este curso não informa a duração em semestres.</div>'}</div>`;
    root.querySelector('[data-back]').addEventListener('click', () => navegar());
    root.querySelectorAll('[data-semester]').forEach(card => card.addEventListener('click', () => navegar(cursoId, card.dataset.semester)));
  }

  function renderGrade() {
    root.innerHTML = `<div class="schedule-breadcrumb"><button class="schedule-back" data-back>← Semestres</button><span>${escapar(cursoAtual.nome)} · ${semestreSelecionado}º semestre</span></div><div class="schedule-builder"><aside class="schedule-subject-panel"><div class="schedule-step-heading"><h3>Disciplinas</h3><p>Arraste uma disciplina para um horário.</p></div><label class="schedule-search"><span>Buscar disciplina</span><input id="subject-search" type="search" placeholder="Nome ou código"></label><div id="subject-list" class="schedule-subject-list"></div></aside><section class="schedule-calendar-panel"><div class="schedule-calendar-heading"><div><h3>Grade semanal</h3><p>Arraste disciplinas para os horários de 7h a 23h.</p></div></div><div class="schedule-calendar-scroll"><div class="schedule-calendar"><div class="schedule-time-label">Horário</div>${dias.map((dia, indice) => `<div class="schedule-day-label" data-day="${indice}">${dia}</div>`).join('')}${Array.from({ length: 16 }, (_, row) => { const hora = row + 7; return `<div class="schedule-hour-label">${String(hora).padStart(2, '0')}:00</div>${dias.map((_, dia) => { const aulas = grade.filter(item => item.dia === dia && item.hora === hora); return `<div class="schedule-slot${aulas.length ? ' is-filled' : ''}" data-day="${dia}" data-hour="${hora}" aria-label="${dias[dia]} às ${hora}:00">${aulas.map(aula => `<div class="schedule-lesson" data-lesson="${escapar(aula.id)}"><strong>${escapar(aula.disciplinaNome)}</strong><small>${escapar(aula.disciplinaCodigo)} · ${escapar(aula.docenteNome)}</small><button type="button" class="schedule-remove" aria-label="Remover aula">×</button></div>`).join('')}<span class="schedule-drop-hint">+</span></div>`; }).join('')}`; }).join('')}</div></div></section></div><div class="schedule-savebar"><span id="schedule-status" role="status">${grade.length} aula(s) na grade</span><button class="admin-button" id="save-schedule" type="button">Salvar Alterações</button></div>`;
    root.querySelector('[data-back]').addEventListener('click', () => navegar(cursoId));
    const subjectList = root.querySelector('#subject-list');
    const subjectInput = root.querySelector('#subject-search');
    const drawSubjects = () => {
      const termo = normalizar(subjectInput.value);
      const filtradas = disciplinas.filter(d => normalizar(`${d.nome} ${d.codigo}`).includes(termo));
      subjectList.innerHTML = filtradas.map(d => `<button class="schedule-subject-card" draggable="true" data-subject="${escapar(d.id)}"><span class="schedule-subject-grip">&#8942;&#8942;</span><strong>${escapar(d.nome)}</strong><small>${escapar(d.codigo)}</small></button>`).join('') || '<div class="schedule-empty">Nenhuma disciplina encontrada.</div>';
      subjectList.querySelectorAll('[data-subject]').forEach(card => card.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', card.dataset.subject)));
    };
    subjectInput.addEventListener('input', drawSubjects);
    drawSubjects();
    root.querySelectorAll('.schedule-slot').forEach(slot => {
      slot.addEventListener('dragover', event => {
        event.preventDefault();
        slot.classList.add('is-hover');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('is-hover'));
      slot.addEventListener('drop', event => {
        event.preventDefault(); slot.classList.remove('is-hover');
        const disciplina = disciplinas.find(d => d.id === event.dataTransfer.getData('text/plain'));
        if (disciplina) abrirModalDocente(disciplina, Number(slot.dataset.day), Number(slot.dataset.hour));
      });
    });
    root.querySelectorAll('[data-lesson]').forEach(card => card.querySelector('.schedule-remove').addEventListener('click', () => {
      grade = grade.filter(item => item.id !== card.dataset.lesson);
      renderGrade();
    }));
    root.querySelector('#save-schedule').addEventListener('click', () => {
      try {
        localStorage.setItem(chaveGrade(), JSON.stringify(grade));
        root.querySelector('#schedule-status').textContent = `Grade salva neste navegador · ${grade.length} aula(s)`;
      } catch (erro) { root.querySelector('#schedule-status').textContent = 'Não foi possível salvar a grade neste navegador.'; }
    });
  }

  function abrirModalDocente(disciplina, dia, hora) {
    const disciplinaNoMesmoHorario = grade.some(item =>
      item.disciplinaId === disciplina.id && item.dia === dia && item.hora === hora
    );
    if (disciplinaNoMesmoHorario) {
      alert('Esta disciplina já está neste horário. Escolha outro bloco para adicionar outra aula.');
      return;
    }

    const aulasNoHorario = grade.filter(item => item.dia === dia && item.hora === hora);
    try {
      for (let indice = 0; indice < localStorage.length; indice += 1) {
        const chave = localStorage.key(indice);
        if (!chave?.startsWith('notadez_grade_') || chave === chaveGrade()) continue;
        const gradeSalva = JSON.parse(localStorage.getItem(chave) || '[]');
        aulasNoHorario.push(
          ...gradeSalva.filter(item => item.dia === dia && item.hora === hora)
        );
      }
    } catch (erro) {
      console.warn('Não foi possível conferir todas as grades salvas:', erro);
    }
    const docentesOcupados = new Set(aulasNoHorario.map(item => item.docenteId));
    modalRoot.innerHTML = `<div class="schedule-modal-backdrop"><section class="schedule-modal" role="dialog" aria-modal="true" aria-labelledby="teacher-modal-title"><button type="button" class="schedule-modal-close" aria-label="Fechar">×</button><span class="admin-eyebrow">${dias[dia]} · ${String(hora).padStart(2, '0')}:00–${String(hora + 1).padStart(2, '0')}:00</span><h3 id="teacher-modal-title">Atribuir docente</h3><p>${escapar(disciplina.nome)} (${escapar(disciplina.codigo)})</p><label class="schedule-search"><span>Buscar docente</span><input id="teacher-search" type="search" placeholder="Nome do docente"></label><div id="teacher-options" class="schedule-teacher-options"></div><p class="schedule-modal-note">Um docente não pode estar em duas aulas no mesmo horário.</p></section></div>`;
    const drawTeachers = () => {
      const term = normalizar(modalRoot.querySelector('#teacher-search').value);
      const filtrados = docentes.filter(d => normalizar(`${d.nome} ${d.email}`).includes(term));
      const options = modalRoot.querySelector('#teacher-options');
      options.innerHTML = filtrados.length ? filtrados.map((docente, i) => `<button class="schedule-teacher-option" data-teacher="${i}" ${docentesOcupados.has(docente.id) ? 'disabled' : ''}><strong>${escapar(docente.nome)}</strong><small>${escapar(docente.email || docente.rp || 'Docente')}</small>${docentesOcupados.has(docente.id) ? '<em>Ocupado neste horário</em>' : ''}</button>`).join('') : '<div class="schedule-empty">Nenhum docente encontrado.</div>';
      options.querySelectorAll('[data-teacher]').forEach(button => button.addEventListener('click', () => {
        const docente = filtrados[Number(button.dataset.teacher)];
        if (!docente || docentesOcupados.has(docente.id)) return;
        grade.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, disciplinaId: disciplina.id, disciplinaNome: disciplina.nome, disciplinaCodigo: disciplina.codigo, docenteId: docente.id, docenteNome: docente.nome, dia, hora });
        modalRoot.replaceChildren();
        renderGrade();
      }));
    };
    modalRoot.querySelector('#teacher-search').addEventListener('input', drawTeachers);
    modalRoot.querySelector('.schedule-modal-close').addEventListener('click', () => modalRoot.replaceChildren());
    modalRoot.querySelector('.schedule-modal-backdrop').addEventListener('click', event => { if (event.target === event.currentTarget) modalRoot.replaceChildren(); });
    drawTeachers();
    modalRoot.querySelector('#teacher-search').focus();
  }

  function renderizar() {
    cursoAtual = cursos.find(curso => curso.id === cursoId);
    if (!cursoId) return renderCursos();
    if (!cursoAtual) { root.innerHTML = '<div class="schedule-empty">Curso não encontrado. <button class="schedule-back" data-back>Voltar aos cursos</button></div>'; root.querySelector('[data-back]').addEventListener('click', () => navegar()); return; }
    if (!semestreSelecionado) return renderSemestres();
    if (semestreSelecionado < 1 || semestreSelecionado > Number(cursoAtual.duracao)) { root.innerHTML = '<div class="schedule-empty">Semestre inválido para este curso.</div>'; return; }
    try { grade = JSON.parse(localStorage.getItem(chaveGrade()) || '[]'); } catch { grade = []; }
    renderGrade();
  }
  window.addEventListener('popstate', () => location.reload());
  try {
    const [dataCursos, dataDocentes] = await Promise.all([
      carregarJson('/api/admin/cursos'),
      carregarJson('/api/admin/docentes')
    ]);
    cursos = dataCursos.cursos || [];
    docentes = dataDocentes.docentes || [];
    renderizar();
  } catch (erro) {
    console.error('Falha ao iniciar organização de horários:', erro);
    root.innerHTML = `<div class="schedule-empty">${escapar(erro.message)} Verifique se o servidor está conectado ao banco de dados.</div>`;
  }
});
