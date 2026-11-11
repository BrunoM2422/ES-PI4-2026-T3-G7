document.addEventListener('DOMContentLoaded', async () => {
  const cardsRoot = document.querySelector('[data-subject-cards]');
  const status = document.querySelector('[data-grade-status]');
  const search = document.querySelector('[data-search-subject]');
  const semesterFilter = document.querySelector('[data-semester-filter]');
  const weekGrid = document.querySelector('[data-week-grid]');
  const saveButton = document.querySelector('[data-save-grade]');
  const modalRoot = document.querySelector('[data-class-modal-root]');
  const token = sessionStorage.getItem('notadez_token');
  let disciplinas = [];
  let selecionadas = new Map();
  let alterada = false;
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]);
  const cabecalhos = '<div class="curriculum-week-corner">Horário</div>' + dias.map(dia => `<div class="curriculum-week-day">${dia}</div>`).join('');
  weekGrid.innerHTML = cabecalhos + Array.from({ length: 16 }, (_, indice) => {
    const hora = indice + 7;
    return `<div class="curriculum-week-time">${String(hora).padStart(2, '0')}:00</div>${dias.map((_, dia) => `<div class="curriculum-week-cell" data-cell="${dia}:${hora}"></div>`).join('')}`;
  }).join('');

  function disciplinaPorId(id) { return disciplinas.find(disciplina => disciplina.id === id); }
  function turmaDaSelecao(disciplinaId, turmaId) { return disciplinaPorId(disciplinaId)?.turmas.find(turma => turma.id === turmaId); }
  function aulasSelecionadas(excluirDisciplinaId = null) {
    return [...selecionadas.entries()].flatMap(([disciplinaId, turmaId]) => {
      if (disciplinaId === excluirDisciplinaId) return [];
      const disciplina = disciplinaPorId(disciplinaId);
      const turma = turmaDaSelecao(disciplinaId, turmaId);
      return (turma?.horarios || []).map(horario => ({ ...horario, disciplina, turma }));
    });
  }

  function renderGrade() {
    weekGrid.querySelectorAll('.curriculum-week-cell').forEach(cell => { cell.replaceChildren(); cell.classList.remove('has-class'); });
    for (const aula of aulasSelecionadas()) {
      const colunaDia = aula.dia === 0 ? 6 : aula.dia - 1;
      const cell = weekGrid.querySelector(`[data-cell="${colunaDia}:${aula.hora}"]`);
      if (!cell) continue;
      cell.classList.add('has-class');
      const bloco = document.createElement('div');
      bloco.className = 'curriculum-class-block';
      bloco.title = `${aula.disciplina?.nome || 'Matéria'} · Turma ${aula.turma.codigo} · ${aula.docente || 'Docente não informado'}`;
      bloco.innerHTML = `<button type="button" class="curriculum-class-remove" data-remove-class-subject="${escapar(aula.disciplina.id)}" aria-label="Remover ${escapar(aula.disciplina?.nome || 'matéria')} da grade" title="Remover matéria">×</button><strong>${escapar(aula.disciplina?.nome || 'Matéria')}</strong><span>Turma ${escapar(aula.turma.codigo)}</span><small>${escapar(aula.docente || '')}</small>`;
      cell.append(bloco);
    }
    weekGrid.querySelectorAll('[data-remove-class-subject]').forEach(botao => botao.addEventListener('click', () => removerMateria(botao.dataset.removeClassSubject)));
    const quantidade = selecionadas.size;
    document.querySelector('[data-selection-count]').textContent = `${quantidade} ${quantidade === 1 ? 'matéria selecionada' : 'matérias selecionadas'}`;
  }

  function renderDisciplinas() {
    const termo = search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const semestre = semesterFilter.value;
    if (!termo && semestre === 'todos') {
      cardsRoot.innerHTML = '<p class="curriculum-no-results">Pesquise pelo nome ou código da matéria, ou selecione um semestre ou “Matérias Atuais”.</p>';
      return;
    }
    const filtradas = disciplinas.filter(disciplina => {
      const texto = `${disciplina.nome} ${disciplina.codigo}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const correspondeAoFiltro = semestre === 'todos' || (semestre === 'atuais'
        ? selecionadas.has(disciplina.id)
        : String(disciplina.semestre) === semestre);
      return (!termo || texto.includes(termo)) && correspondeAoFiltro;
    });
    cardsRoot.innerHTML = filtradas.length ? filtradas.map(disciplina => {
      const escolhida = selecionadas.has(disciplina.id);
      return `<button type="button" class="curriculum-subject-card${escolhida ? ' is-selected' : ''}" data-subject="${escapar(disciplina.id)}"><span class="curriculum-subject-semester">${disciplina.semestre}º semestre</span><strong>${escapar(disciplina.nome)}</strong><span class="curriculum-subject-code">${escapar(disciplina.codigo)}</span><small>${escolhida ? `Turma ${escapar(turmaDaSelecao(disciplina.id, selecionadas.get(disciplina.id))?.codigo || '')} selecionada` : `${disciplina.turmas.length} turma(s) disponível(is)`}</small></button>`;
    }).join('') : '<p class="curriculum-no-results">Nenhuma matéria encontrada para esse filtro.</p>';
    cardsRoot.querySelectorAll('[data-subject]').forEach(card => card.addEventListener('click', () => abrirModal(disciplinaPorId(card.dataset.subject))));
  }

  function removerMateria(disciplinaId) {
    if (!selecionadas.has(disciplinaId)) return;
    selecionadas.delete(disciplinaId);
    alterada = true;
    saveButton.disabled = false;
    status.textContent = 'Matéria removida da seleção. Salve as alterações para confirmar.';
    renderDisciplinas();
    renderGrade();
  }

  function abrirModal(disciplina) {
    const turmaSelecionada = selecionadas.get(disciplina.id);
    modalRoot.innerHTML = `<div class="curriculum-modal-backdrop" data-modal-backdrop><section class="curriculum-class-modal" role="dialog" aria-modal="true" aria-labelledby="curriculum-modal-title"><button type="button" class="curriculum-modal-close" data-close-modal aria-label="Fechar">×</button><span class="curriculum-subject-semester">${disciplina.semestre}º semestre · ${escapar(disciplina.codigo)}</span><h2 id="curriculum-modal-title">${escapar(disciplina.nome)}</h2><p>${escapar(disciplina.descricao || 'Escolha uma turma para cursar esta matéria.')} A inscrição inclui somente esta matéria.</p><div class="curriculum-class-list" data-class-list></div><div class="curriculum-modal-actions"><button type="button" class="curriculum-remove-button" data-remove-selection ${turmaSelecionada ? '' : 'hidden'}>Remover da minha grade</button><button type="button" class="curriculum-modal-done" data-close-modal>Concluir</button></div></section></div>`;
    const list = modalRoot.querySelector('[data-class-list]');
    list.innerHTML = disciplina.turmas.length ? disciplina.turmas.map(turma => {
      const ativa = selecionadas.get(disciplina.id) === turma.id;
      const jaEstaNaTurma = [...selecionadas.values()].includes(turma.id);
      const cheia = turma.vagasDisponiveis < 1 && !turma.matriculado && !jaEstaNaTurma && !ativa;
      const horario = turma.horarios.map(item => `${item.diaNome} às ${String(item.hora).padStart(2, '0')}:00`).join(' · ');
      return `<button type="button" class="curriculum-class-option${ativa ? ' is-selected' : ''}" data-class="${escapar(turma.id)}" ${cheia ? 'disabled' : ''}><span><strong>Turma ${escapar(turma.codigo)}</strong><small>${escapar(turma.periodoLetivo)}º período${horario ? ` · ${escapar(horario)}` : ''}</small><small>${turma.vagasDisponiveis} vaga(s) disponível(is)</small></span><b>${ativa ? 'Selecionada' : cheia ? 'Lotada' : 'Escolher turma'}</b></button>`;
    }).join('') : '<p class="curriculum-no-results">Ainda não há turmas disponíveis para esta matéria.</p>';
    const fechar = () => modalRoot.replaceChildren();
    modalRoot.querySelectorAll('[data-close-modal]').forEach(botao => botao.addEventListener('click', fechar));
    modalRoot.querySelector('[data-modal-backdrop]').addEventListener('click', event => { if (event.target === event.currentTarget) fechar(); });
    list.querySelectorAll('[data-class]').forEach(botao => botao.addEventListener('click', () => {
      const turmaId = botao.dataset.class;
      if (selecionadas.get(disciplina.id) === turmaId) { fechar(); return; }
      const turma = disciplina.turmas.find(item => item.id === turmaId);
      const conflitos = turma.horarios.flatMap(horario => aulasSelecionadas(disciplina.id).filter(aula => aula.dia === horario.dia && aula.hora === horario.hora));
      if (conflitos.length) {
        const conflito = conflitos[0];
        status.textContent = `Conflito: ${conflito.disciplina.nome} já ocupa ${conflito.diaNome} às ${String(conflito.hora).padStart(2, '0')}:00.`;
        return;
      }
      selecionadas.set(disciplina.id, turmaId);
      alterada = true;
      saveButton.disabled = false;
      status.textContent = 'Seleção atualizada. Clique em “Salvar alterações” para confirmar sua grade.';
      fechar();
      renderDisciplinas(); renderGrade();
    }));
    modalRoot.querySelector('[data-remove-selection]').addEventListener('click', () => {
      fechar();
      removerMateria(disciplina.id);
    });
  }

  search.addEventListener('input', renderDisciplinas);
  semesterFilter.addEventListener('change', renderDisciplinas);
  saveButton.addEventListener('click', async () => {
    saveButton.disabled = true;
    try {
      const matriculas = [...selecionadas.entries()].map(([disciplinaId, turmaId]) => ({ disciplinaId, turmaId }));
      const resposta = await fetch('/api/aluno/grade', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matriculas })
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível salvar a grade.');
      alterada = false;
      await carregarCatalogo();
      status.textContent = dados.mensagem;
    } catch (erro) { status.textContent = erro.message; }
    finally { saveButton.disabled = !alterada; }
  });

  async function carregarCatalogo() {
    const resposta = await fetch('/api/aluno/grade', { headers: { Authorization: `Bearer ${token}` } });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível carregar as matérias.');
    disciplinas = dados.disciplinas || [];
    if (!alterada) selecionadas = new Map((dados.matriculas || []).map(item => [item.disciplinaId, item.turmaId]));
    const semestres = [...new Set(disciplinas.map(item => item.semestre))].sort((a, b) => a - b);
    semesterFilter.replaceChildren(new Option('Escolha um semestre', 'todos'), new Option('Matérias Atuais', 'atuais'));
    semestres.forEach(semestre => semesterFilter.add(new Option(`${semestre}º semestre`, String(semestre))));
    renderDisciplinas(); renderGrade();
    if (!disciplinas.length) status.textContent = 'Não há matérias cadastradas para o seu curso.';
    else if (!alterada) status.textContent = 'Pesquise pelo nome ou código, ou escolha um filtro para ver matérias.';
    saveButton.disabled = !alterada;
  }

  try { await carregarCatalogo(); }
  catch (erro) { status.textContent = erro.message; saveButton.disabled = true; }
});
