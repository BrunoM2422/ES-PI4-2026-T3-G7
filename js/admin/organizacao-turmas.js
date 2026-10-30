document.addEventListener('DOMContentLoaded', async () => {
  const root = document.querySelector('#class-organization-content');
  const params = new URLSearchParams(location.search);
  let cursoId = params.get('curso');
  let semestreSelecionado = Number(params.get('semestre')) || 0;
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const normalizar = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const escapar = texto => String(texto ?? '').replace(/[&<>"']/g, caractere => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]);
  const carregarJson = async url => {
    const resposta = await fetch(url);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível carregar os dados.');
    return dados;
  };

  let cursos = [];
  let turmas = [];
  let grade;
  let cursoAtual;

  function navegar(curso, semestre) {
    cursoId = curso || null;
    semestreSelecionado = Number(semestre) || 0;
    const consulta = new URLSearchParams();
    if (curso) consulta.set('curso', curso);
    if (semestre) consulta.set('semestre', semestre);
    history.pushState({}, '', `${location.pathname}${consulta.size ? `?${consulta}` : ''}`);
    renderizar();
  }

  function renderCursos() {
    root.innerHTML = `<div class="schedule-toolbar"><label class="schedule-search"><span>Buscar curso</span><input id="course-search" type="search" placeholder="Nome ou código do curso"></label></div><div id="course-grid" class="schedule-course-grid"></div>`;
    const input = root.querySelector('#course-search');
    const grid = root.querySelector('#course-grid');
    const desenhar = () => {
      const termo = normalizar(input.value);
      const filtrados = cursos.filter(curso => normalizar(`${curso.nome} ${curso.codigo}`).includes(termo));
      grid.innerHTML = filtrados.length
        ? filtrados.map(curso => `<button class="schedule-course-card" data-course="${escapar(curso.id)}"><span class="schedule-card-symbol">&#9671;</span><strong>${escapar(curso.nome)}</strong><small>${escapar(curso.codigo)} · ${curso.duracao} semestres</small><span class="schedule-card-action">Ver semestres <b aria-hidden="true">&#8594;</b></span></button>`).join('')
        : '<div class="schedule-empty">Nenhum curso encontrado.</div>';
      grid.querySelectorAll('[data-course]').forEach(card => card.addEventListener('click', () => navegar(card.dataset.course)));
    };
    input.addEventListener('input', desenhar);
    desenhar();
  }

  function renderSemestres() {
    const quantidade = Math.max(0, Math.min(20, Number(cursoAtual.duracao) || 0));
    root.innerHTML = `<div class="schedule-breadcrumb"><button class="schedule-back" data-back>&larr; Cursos</button><span>${escapar(cursoAtual.nome)} · ${escapar(cursoAtual.codigo)}</span></div><div class="schedule-step-heading"><h3>Semestres do curso</h3><p>Selecione o semestre para organizar as turmas.</p></div><div class="schedule-semester-grid">${Array.from({ length: quantidade }, (_, indice) => `<button class="schedule-semester-card" data-semester="${indice + 1}"><span class="schedule-semester-number">${String(indice + 1).padStart(2, '0')}</span><strong>${indice + 1}º semestre</strong><small>Associar turmas às aulas</small></button>`).join('') || '<div class="schedule-empty">Este curso não informa a duração em semestres.</div>'}</div>`;
    root.querySelector('[data-back]').addEventListener('click', () => navegar());
    root.querySelectorAll('[data-semester]').forEach(card => card.addEventListener('click', () => navegar(cursoId, card.dataset.semester)));
  }

  function atribuicoes(turma, aula) {
    return (turma.horarios || []).filter(item => String(item.gradeHorarioId) === String(grade.id) && String(item.aulaId) === String(aula.id));
  }

  function turmaDaAula(aula) {
    if (aula.turmaId) return turmas.find(turma => turma.id === String(aula.turmaId)) || null;
    return turmas.find(turma => atribuicoes(turma, aula).length > 0) || null;
  }

  function renderGrade() {
    const aulas = grade?.aulas || [];
    const daysMarkup = dias.map((dia, indice) => `<div class="schedule-day-label" data-day="${indice}">${dia}</div>`).join('');
    const rowsMarkup = Array.from({ length: 16 }, (_, linha) => {
      const hora = linha + 7;
      const slotsMarkup = dias.map((_, dia) => {
        const aulasNoBloco = aulas.filter(aula => aula.dia === dia && aula.hora === hora);
        const lessonsMarkup = aulasNoBloco.map(aula => {
          const turma = turmaDaAula(aula);
          const associacao = turma ? atribuicoes(turma, aula)[0] : null;
          const turmaId = turma?.id || aula.turmaId;
          const assignmentsMarkup = turmaId
            ? `<span class="schedule-class-assignment">${escapar(turma?.codigo || aula.turmaCodigo || 'Turma associada')}<button type="button" data-unassign="${escapar(turmaId)}" data-grade="${escapar(associacao?.gradeHorarioId || grade.id)}" data-aula="${escapar(associacao?.aulaId || aula.id)}" aria-label="Desassociar turma">×</button></span>`
            : '';
          const dropMarkup = turmaId ? '' : '<span class="schedule-class-drop">Solte a turma aqui</span>';
          return `<article class="schedule-lesson schedule-class-target${turmaId ? ' is-assigned' : ''}" data-lesson="${escapar(aula.id)}"><strong>${escapar(aula.disciplinaNome)}</strong><small>${escapar(aula.disciplinaCodigo)} · ${escapar(aula.docenteNome)}</small><div class="schedule-class-assignments">${assignmentsMarkup}</div>${dropMarkup}</article>`;
        }).join('') || '<span class="schedule-empty-slot">—</span>';
        return `<div class="schedule-slot${aulasNoBloco.length ? ' is-filled' : ''}" data-day="${dia}" data-hour="${hora}" aria-label="${dias[dia]} às ${hora}:00">${lessonsMarkup}</div>`;
      }).join('');
      return `<div class="schedule-hour-label">${String(hora).padStart(2, '0')}:00</div>${slotsMarkup}`;
    }).join('');
    root.innerHTML = `<div class="schedule-breadcrumb"><button class="schedule-back" data-back>&larr; Semestres</button><span>${escapar(cursoAtual.nome)} · ${semestreSelecionado}º semestre</span></div><div class="schedule-builder"><aside class="schedule-subject-panel"><div class="schedule-step-heading"><h3>Turmas</h3><p>Arraste uma turma até a aula correspondente.</p></div><label class="schedule-search"><span>Buscar turma</span><input id="class-search" type="search" placeholder="Código ou período letivo"></label><div id="class-list" class="schedule-subject-list"></div></aside><section class="schedule-calendar-panel"><div class="schedule-calendar-heading"><div><h3>Grade semanal</h3><p>As aulas cadastradas em Organização de Horários aparecem aqui.</p></div></div><div class="schedule-calendar-scroll"><div class="schedule-calendar"><div class="schedule-time-label">Horário</div>${daysMarkup}${rowsMarkup}</div></div></section></div><div class="schedule-savebar"><span id="class-organization-status" role="status">${aulas.length} aula(s) disponíveis · ${turmas.length} turma(s) no curso</span></div>`;

    root.querySelector('[data-back]').addEventListener('click', () => navegar(cursoId));
    const list = root.querySelector('#class-list');
    const search = root.querySelector('#class-search');
    const desenharTurmas = () => {
      const termo = normalizar(search.value);
      const filtradas = turmas.filter(turma => normalizar(`${turma.codigo} ${turma.periodoLetivo}`).includes(termo));
      list.innerHTML = filtradas.length
        ? filtradas.map(turma => `<button class="schedule-subject-card" draggable="true" data-turma="${escapar(turma.id)}"><span class="schedule-subject-grip">&#8942;&#8942;</span><strong>Turma ${escapar(turma.codigo)}</strong><small>${escapar(turma.periodoLetivo)} · ${turma.vagas} vagas</small></button>`).join('')
        : '<div class="schedule-empty">Nenhuma turma encontrada para este curso.</div>';
      list.querySelectorAll('[data-turma]').forEach(card => card.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', card.dataset.turma)));
    };
    search.addEventListener('input', desenharTurmas);
    desenharTurmas();

    root.querySelectorAll('.schedule-class-target:not(.is-assigned)').forEach(alvo => {
      alvo.addEventListener('dragover', event => { event.preventDefault(); alvo.classList.add('is-hover'); });
      alvo.addEventListener('dragleave', event => { if (!alvo.contains(event.relatedTarget)) alvo.classList.remove('is-hover'); });
      alvo.addEventListener('drop', async event => {
        event.preventDefault();
        alvo.classList.remove('is-hover');
        const turmaId = event.dataTransfer.getData('text/plain');
        await associarTurma(turmaId, alvo.dataset.lesson);
      });
    });
    root.querySelectorAll('[data-unassign]').forEach(button => button.addEventListener('click', async () => {
      await desassociarTurma(button.dataset.unassign, button.dataset.grade, button.dataset.aula);
    }));
  }

  async function associarTurma(turmaId, aulaId) {
    const status = root.querySelector('#class-organization-status');
    const turma = turmas.find(item => item.id === turmaId);
    const aula = grade.aulas.find(item => item.id === aulaId);
    if (!turma || !aula) {
      status.textContent = 'Não foi possível identificar a turma ou a aula selecionada.';
      return;
    }
    if (turmaDaAula(aula)) {
      status.textContent = 'Esta aula já possui uma turma associada.';
      return;
    }
    const conflito = (turma.horarios || []).find(item =>
      item.semestre === semestreSelecionado && item.dia === aula.dia && item.hora === aula.hora
    );
    if (conflito) {
      status.textContent = `A turma ${turma.codigo} já possui uma aula ${dias[aula.dia]} às ${String(aula.hora).padStart(2, '0')}:00.`;
      return;
    }
    status.textContent = 'Salvando associação...';
    try {
      const resposta = await fetch(`/api/admin/turmas/${encodeURIComponent(turmaId)}/horarios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeHorarioId: grade.id, aulaId })
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível associar a turma.');
      const atualizadas = await carregarJson(`/api/admin/turmas?cursoId=${encodeURIComponent(cursoId)}&semestre=${semestreSelecionado}`);
      turmas = atualizadas.turmas || [];
      renderGrade();
      root.querySelector('#class-organization-status').textContent = dados.mensagem;
    } catch (erro) {
      status.textContent = erro.message;
    }
  }

  async function desassociarTurma(turmaId, gradeId, aulaId) {
    const status = root.querySelector('#class-organization-status');
    status.textContent = 'Removendo associação...';
    try {
      const resposta = await fetch(`/api/admin/turmas/${encodeURIComponent(turmaId)}/horarios/${encodeURIComponent(gradeId)}/${encodeURIComponent(aulaId)}`, { method: 'DELETE' });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível remover a associação.');
      const atualizadas = await carregarJson(`/api/admin/turmas?cursoId=${encodeURIComponent(cursoId)}&semestre=${semestreSelecionado}`);
      turmas = atualizadas.turmas || [];
      renderGrade();
      root.querySelector('#class-organization-status').textContent = dados.mensagem;
    } catch (erro) {
      status.textContent = erro.message;
    }
  }

  async function renderizar() {
    cursoAtual = cursos.find(curso => curso.id === cursoId);
    if (!cursoId) return renderCursos();
    if (!cursoAtual) {
      root.innerHTML = '<div class="schedule-empty">Curso não encontrado. <button class="schedule-back" data-back>Voltar aos cursos</button></div>';
      root.querySelector('[data-back]').addEventListener('click', () => navegar());
      return;
    }
    if (!semestreSelecionado) return renderSemestres();
    if (semestreSelecionado < 1 || semestreSelecionado > Number(cursoAtual.duracao)) {
      root.innerHTML = '<div class="schedule-empty">Semestre inválido para este curso.</div>';
      return;
    }
    root.innerHTML = '<div class="schedule-loading">Carregando grade e turmas...</div>';
    try {
      const consulta = new URLSearchParams({ cursoId, semestre: String(semestreSelecionado) });
      const [dadosGrade, dadosTurmas] = await Promise.all([
        carregarJson(`/api/admin/grades-horarios?${consulta}`),
        carregarJson(`/api/admin/turmas?cursoId=${encodeURIComponent(cursoId)}&semestre=${semestreSelecionado}`)
      ]);
      grade = dadosGrade.grade;
      turmas = dadosTurmas.turmas || [];
      if (!grade) {
        root.innerHTML = `<div class="schedule-breadcrumb"><button class="schedule-back" data-back>&larr; Semestres</button><span>${escapar(cursoAtual.nome)} · ${semestreSelecionado}º semestre</span></div><div class="schedule-empty">Ainda não há aulas cadastradas para este semestre. Organize os horários primeiro.</div>`;
        root.querySelector('[data-back]').addEventListener('click', () => navegar(cursoId));
        return;
      }
      renderGrade();
    } catch (erro) {
      root.innerHTML = `<div class="schedule-empty">${escapar(erro.message)}</div>`;
    }
  }

  async function migrarGradesLocais() {
    const chaves = Array.from({ length: localStorage.length }, (_, indice) => localStorage.key(indice))
      .filter(chave => chave && /^notadez_grade_[a-f\d]{24}_\d+$/i.test(chave));
    for (const chave of chaves) {
      const correspondencia = chave.match(/^notadez_grade_([a-f\d]{24})_(\d+)$/i);
      if (!correspondencia) continue;
      const [, idCurso, semestre] = correspondencia;
      try {
        const consulta = new URLSearchParams({ cursoId: idCurso, semestre });
        const existente = await carregarJson(`/api/admin/grades-horarios?${consulta}`);
        if (existente.grade) {
          localStorage.removeItem(chave);
          continue;
        }
        const aulas = JSON.parse(localStorage.getItem(chave) || '[]');
        if (!Array.isArray(aulas) || !aulas.length) continue;
        const resposta = await fetch('/api/admin/grades-horarios', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursoId: idCurso, semestre: Number(semestre), aulas })
        });
        if (resposta.ok) localStorage.removeItem(chave);
      } catch (erro) {
        console.warn(`Não foi possível migrar a grade local ${chave}:`, erro);
      }
    }
  }

  window.addEventListener('popstate', () => location.reload());
  try {
    const dados = await carregarJson('/api/admin/cursos');
    cursos = dados.cursos || [];
    await migrarGradesLocais();
    await renderizar();
  } catch (erro) {
    root.innerHTML = `<div class="schedule-empty">${escapar(erro.message)}</div>`;
  }
});
