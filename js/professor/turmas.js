document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.querySelector('[data-class-grid]');
  const details = document.querySelector('[data-class-details]');
  const count = document.querySelector('[data-class-count]');
  if (!grid || !details) return;

  let turmas = [];
  let turmaAtual = null;

  const criar = (tag, classe, texto) => {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  };

  function mostrarErro(container, mensagem) {
    container.replaceChildren(criar('p', 'teacher-empty-message', mensagem));
  }

  function renderizarTurmas() {
    if (count) count.textContent = `${turmas.length} ${turmas.length === 1 ? 'turma' : 'turmas'}`;
    grid.replaceChildren();
    if (!turmas.length) {
      mostrarErro(grid, 'Você ainda não está vinculado a nenhuma turma com aulas organizadas.');
      return;
    }

    turmas.forEach(turma => {
      const card = criar('button', `teacher-class-card${turmaAtual?.id === turma.id ? ' is-selected' : ''}`);
      card.type = 'button';
      card.dataset.turmaId = turma.id;
      const topo = criar('span', 'teacher-class-card-top');
      topo.append(criar('span', 'teacher-class-card-kicker', `${turma.periodoLetivo}º período`));
      topo.append(criar('span', 'teacher-class-card-arrow', '→'));
      card.append(topo);
      card.append(criar('strong', 'teacher-class-card-course', turma.curso));
      const disciplinas = criar('span', 'teacher-class-card-subjects', turma.disciplinas.length
        ? turma.disciplinas.join(' · ')
        : 'Disciplinas não identificadas');
      card.append(disciplinas);
      card.append(criar('span', 'teacher-class-card-code', `Turma ${turma.codigo}`));
      card.append(criar('span', 'teacher-class-card-meta', `${turma.alunos} ${turma.alunos === 1 ? 'aluno' : 'alunos'} · ${turma.vagas} vagas`));
      card.addEventListener('click', () => abrirTurma(turma));
      grid.append(card);
    });
  }

  function abrirTurma(turma) {
    turmaAtual = turma;
    renderizarTurmas();
    details.hidden = false;
    details.replaceChildren();

    const cabecalho = criar('div', 'teacher-class-detail-heading');
    const titulo = criar('div');
    titulo.append(criar('span', 'teacher-classes-eyebrow', `Turma ${turma.codigo} · ${turma.periodoLetivo}º período`));
    titulo.append(criar('h2', '', turma.curso));
    titulo.append(criar('p', '', turma.disciplinas.join(' · ') || 'Disciplinas não identificadas'));
    const fechar = criar('button', 'teacher-class-close', 'Fechar');
    fechar.type = 'button';
    fechar.addEventListener('click', () => {
      details.hidden = true;
      turmaAtual = null;
      renderizarTurmas();
    });
    cabecalho.append(titulo, fechar);
    details.append(cabecalho);

    const acoes = criar('div', 'teacher-class-actions');
    const notas = criar('button', 'teacher-class-action is-primary', 'Lançar notas');
    notas.type = 'button';
    notas.addEventListener('click', () => {
      window.location.href = `notas.html?turmaId=${encodeURIComponent(turma.id)}`;
    });
    const chamada = criar('button', 'teacher-class-action', 'Fazer chamada');
    chamada.type = 'button';
    chamada.addEventListener('click', () => {
      window.location.href = `frequencia.html?turmaId=${encodeURIComponent(turma.id)}`;
    });
    const verAlunos = criar('button', 'teacher-class-action', 'Ver alunos');
    verAlunos.type = 'button';
    const comunicar = criar('button', 'teacher-class-action is-primary', 'Fazer comunicado');
    comunicar.type = 'button';
    acoes.append(notas, chamada, verAlunos, comunicar);
    details.append(acoes);

    const roster = criar('div', 'teacher-class-roster');
    roster.hidden = true;
    const comunicados = criar('div', 'teacher-class-announcement');
    comunicados.hidden = true;
    details.append(roster, comunicados);

    let alunosCarregados = false;
    verAlunos.addEventListener('click', async () => {
      comunicados.hidden = true;
      roster.hidden = !roster.hidden;
      if (!roster.hidden && !alunosCarregados) {
        await carregarAlunos(turma, roster);
        alunosCarregados = true;
      }
    });
    comunicar.addEventListener('click', () => {
      roster.hidden = true;
      comunicados.hidden = !comunicados.hidden;
      if (!comunicados.hidden && !comunicados.childElementCount) montarFormularioComunicado(turma, comunicados);
    });
    details.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function carregarAlunos(turma, container) {
    mostrarErro(container, 'Carregando alunos...');
    try {
      const response = await fetch(`/api/professor/turmas/${encodeURIComponent(turma.id)}/alunos`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar os alunos.');
      container.replaceChildren();
      const titulo = criar('h3', '', `Alunos matriculados (${data.alunos.length})`);
      const descricao = criar('p', 'teacher-class-module-note', 'As médias ainda não foram lançadas.');
      container.append(titulo, descricao);

      if (!data.alunos.length) {
        container.append(criar('p', 'teacher-empty-message', 'Esta turma ainda não possui alunos matriculados.'));
        return;
      }

      const wrapper = criar('div', 'teacher-roster-table-wrap');
      const table = criar('table', 'teacher-roster-table');
      const head = document.createElement('thead');
      const headerRow = document.createElement('tr');
      ['Aluno', 'RA', 'Média atual', 'Situação'].forEach(label => headerRow.append(criar('th', '', label)));
      head.append(headerRow);
      const body = document.createElement('tbody');
      data.alunos.forEach(aluno => {
        const row = document.createElement('tr');
        row.append(criar('th', 'teacher-roster-name', aluno.nome));
        row.append(criar('td', '', aluno.ra || '—'));
        row.append(criar('td', 'teacher-roster-average', aluno.mediaAtual ?? '—'));
        row.append(criar('td', 'teacher-roster-status', aluno.statusAcademico === 'trancado' ? 'Matrícula trancada' : 'Ativo'));
        body.append(row);
      });
      table.append(head, body);
      wrapper.append(table);
      container.append(wrapper);
    } catch (erro) {
      mostrarErro(container, erro.message || 'Não foi possível carregar os alunos.');
    }
  }

  function montarFormularioComunicado(turma, container) {
    const titulo = criar('h3', '', 'Enviar comunicado');
    const instrucao = criar('p', 'teacher-class-module-note', 'O comunicado aparecerá na área de notificações dos alunos ativos desta turma.');
    const form = document.createElement('form');
    form.className = 'teacher-announcement-form';

    const labelTitulo = document.createElement('label');
    labelTitulo.append(criar('span', '', 'Título'));
    const inputTitulo = document.createElement('input');
    inputTitulo.name = 'titulo';
    inputTitulo.maxLength = 90;
    inputTitulo.required = true;
    inputTitulo.placeholder = 'Ex.: Alteração de sala';
    labelTitulo.append(inputTitulo);

    const labelMensagem = document.createElement('label');
    labelMensagem.append(criar('span', '', 'Mensagem'));
    const textarea = document.createElement('textarea');
    textarea.name = 'mensagem';
    textarea.maxLength = 2000;
    textarea.rows = 4;
    textarea.required = true;
    textarea.placeholder = 'Escreva uma mensagem para os alunos...';
    labelMensagem.append(textarea);

    const feedback = criar('p', 'teacher-announcement-feedback', '');
    feedback.setAttribute('role', 'status');
    const enviar = criar('button', 'teacher-class-action is-primary', 'Enviar comunicado');
    enviar.type = 'submit';
    form.append(labelTitulo, labelMensagem, feedback, enviar);
    container.append(titulo, instrucao, form);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      enviar.disabled = true;
      feedback.textContent = 'Enviando...';
      try {
        const response = await fetch(`/api/professor/turmas/${encodeURIComponent(turma.id)}/comunicados`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: inputTitulo.value.trim(), mensagem: textarea.value.trim() })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensagem || 'Não foi possível enviar o comunicado.');
        feedback.textContent = `${data.mensagem} ${data.enviados} ${data.enviados === 1 ? 'aluno notificado.' : 'alunos notificados.'}`;
        inputTitulo.value = '';
        textarea.value = '';
      } catch (erro) {
        feedback.textContent = erro.message || 'Não foi possível enviar o comunicado.';
      } finally {
        enviar.disabled = false;
      }
    });
  }

  try {
    const response = await fetch('/api/professor/turmas');
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar suas turmas.');
    turmas = data.turmas || [];
    renderizarTurmas();
  } catch (erro) {
    if (count) count.textContent = '— turmas';
    mostrarErro(grid, erro.message || 'Não foi possível carregar suas turmas.');
  }
});
