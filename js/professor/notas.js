// Autores: Luca Filippi — RA: 25022556
// Nícolas Mitjans Nunes - 25005124
document.addEventListener('DOMContentLoaded', async () => {
  const cards = document.querySelector('[data-grade-cards]'); const count = document.querySelector('[data-grade-count]'); const detail = document.querySelector('[data-grade-detail]');
  if (!cards || !detail) return;
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const base = '/api/notas/professor'; let disciplinas = [];
  const formatarMedia = media => (media === null || media === undefined) ? '—' : Number(media).toFixed(2);
  function voltar() { detail.hidden = true; cards.closest('.teacher-classes-panel').hidden = false; }
  async function abrir(disciplina) {
    cards.closest('.teacher-classes-panel').hidden = true; detail.hidden = false; detail.replaceChildren(el('p', 'teacher-empty-message', 'Carregando diário de notas...'));
    try {
      const url = `${base}/${encodeURIComponent(disciplina.turmaId)}/${encodeURIComponent(disciplina.disciplinaId)}`;
      const response = await fetch(url); const data = await response.json(); if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar o diário.');
      renderizar(disciplina, data, url);
    } catch (error) { detail.replaceChildren(el('p', 'teacher-empty-message', error.message || 'Não foi possível carregar o diário.')); const back = el('button', 'teacher-class-action', '← Voltar às disciplinas'); back.type = 'button'; back.addEventListener('click', voltar); detail.append(back); }
  }
  function renderizar(disciplina, data, url) {
    detail.replaceChildren();
    const heading = el('div', 'teacher-class-detail-heading'); const info = el('div');
    const codigoTurma = window.formatarCodigoTurmaDisciplina(disciplina.turma, disciplina.codigo);
    info.append(el('span', 'teacher-classes-eyebrow', `Turma ${codigoTurma} · ${disciplina.periodoLetivo}`), el('h2', '', data.disciplina), el('p', '', 'Configure os componentes e registre as notas da turma.'));
    const back = el('button', 'teacher-class-close', '← Voltar'); back.type = 'button'; back.addEventListener('click', voltar); heading.append(info, back); detail.append(heading);
    const form = document.createElement('form'); form.className = 'teacher-announcement-form grades-component-form';
    const titleLabel = document.createElement('label'); titleLabel.append(el('span', '', 'Nome do componente'));
    const title = document.createElement('input'); title.name = 'titulo'; title.maxLength = 80; title.required = true; title.placeholder = 'Ex.: Prova 1'; titleLabel.append(title);
    const maxLabel = document.createElement('label'); maxLabel.append(el('span', '', 'Valor máximo'));
    const max = document.createElement('input'); max.name = 'valorMaximo'; max.type = 'number'; max.min = '0.01'; max.max = '100'; max.step = '0.01'; max.value = '10'; max.required = true; maxLabel.append(max);
    const mediaLabel = document.createElement('label'); mediaLabel.append(el('span', '', 'Como será calculada a média?'));
    const tipoMedia = document.createElement('select'); tipoMedia.name = 'tipoMedia'; tipoMedia.required = true;
    if (!data.configuracao) { const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Selecione uma opção'; placeholder.selected = true; tipoMedia.append(placeholder); }
    [['aritmetica', 'Aritmética'], ['ponderada', 'Ponderada']].forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; tipoMedia.append(option); });
    if (data.configuracao) { tipoMedia.value = data.configuracao.tipoMedia; tipoMedia.disabled = true; }
    mediaLabel.append(tipoMedia);
    const weightLabel = document.createElement('label'); weightLabel.append(el('span', '', 'Peso da nota'));
    const weight = document.createElement('input'); weight.name = 'peso'; weight.type = 'number'; weight.min = '0.01'; weight.max = '100'; weight.step = '0.01'; weight.value = '1'; weightLabel.append(weight);
    const configFeedback = el('small', 'teacher-class-module-note', data.configuracao
      ? `Tipo de média definido como ${data.configuracao.tipoMedia === 'ponderada' ? 'ponderada' : 'aritmética'} e bloqueado para esta disciplina.`
      : 'Essa escolha será salva e não poderá ser alterada depois.');
    mediaLabel.append(configFeedback);
    const atualizarPeso = () => { const ponderada = tipoMedia.value === 'ponderada'; weight.disabled = !ponderada; weight.required = ponderada; if (!ponderada) weight.value = '1'; };
    atualizarPeso();
    const feedback = el('p', 'teacher-announcement-feedback', ''); const submit = el('button', 'teacher-class-action is-primary', 'Criar componente'); submit.type = 'submit'; submit.disabled = !data.configuracao; form.append(titleLabel, maxLabel, mediaLabel, weightLabel, submit, feedback); detail.append(form);
    tipoMedia.addEventListener('change', async () => {
      if (!tipoMedia.value || tipoMedia.disabled) return;
      const escolha = tipoMedia.value;
      tipoMedia.disabled = true; submit.disabled = true; configFeedback.textContent = 'Salvando a configuração da disciplina...'; atualizarPeso();
      try {
        const response = await fetch(`${url}/configuracao`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipoMedia: escolha }) });
        const result = await response.json();
        if (!response.ok) {
          if (result.configuracao?.tipoMedia) { tipoMedia.value = result.configuracao.tipoMedia; configFeedback.textContent = result.mensagem; }
          else { tipoMedia.disabled = false; tipoMedia.value = ''; configFeedback.textContent = result.mensagem || 'Não foi possível salvar o tipo de média.'; }
          atualizarPeso(); return;
        }
        configFeedback.textContent = 'Tipo de média salvo e bloqueado para esta disciplina.';
      } catch (error) {
        tipoMedia.disabled = false; tipoMedia.value = ''; configFeedback.textContent = error.message || 'Não foi possível salvar o tipo de média.';
      } finally { atualizarPeso(); submit.disabled = !tipoMedia.value; }
    });
    form.addEventListener('submit', async event => { event.preventDefault(); if (!form.reportValidity()) return; submit.disabled = true; feedback.textContent = 'Salvando componente...';
      try { const response = await fetch(`${url}/componentes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: title.value.trim(), valorMaximo: Number(max.value), tipoMedia: tipoMedia.value, peso: tipoMedia.value === 'ponderada' ? Number(weight.value) : 1 }) }); const result = await response.json(); if (!response.ok) throw new Error(result.mensagem || 'Não foi possível criar componente.'); await abrir(disciplina); }
      catch (error) { feedback.textContent = error.message || 'Não foi possível criar componente.'; submit.disabled = false; }
    });
    if (data.componentes.length) {
      const manager = el('section', 'teacher-class-roster grades-component-manager');
      manager.append(el('h3', '', 'Gerenciar componentes'), el('p', 'teacher-class-module-note', 'Você pode editar os dados dos componentes ou excluí-los. Excluir também apaga as notas lançadas para esse componente.'));
      const managerFeedback = el('p', 'teacher-announcement-feedback', '');
      data.componentes.forEach(componente => {
        const editForm = document.createElement('form'); editForm.className = 'grades-component-edit';
        const titleLabel = document.createElement('label'); titleLabel.append(el('span', '', 'Nome'));
        const titleInput = document.createElement('input'); titleInput.name = 'titulo'; titleInput.maxLength = 80; titleInput.required = true; titleInput.value = componente.titulo; titleLabel.append(titleInput);
        const maxLabel = document.createElement('label'); maxLabel.append(el('span', '', 'Valor máximo'));
        const maxInput = document.createElement('input'); maxInput.name = 'valorMaximo'; maxInput.type = 'number'; maxInput.min = '0.01'; maxInput.max = '100'; maxInput.step = '0.01'; maxInput.required = true; maxInput.value = componente.valorMaximo; maxLabel.append(maxInput);
        const weightLabel = document.createElement('label'); weightLabel.append(el('span', '', 'Peso'));
        const weightInput = document.createElement('input'); weightInput.name = 'peso'; weightInput.type = 'number'; weightInput.min = '0.01'; weightInput.max = '100'; weightInput.step = '0.01'; weightInput.required = true; weightInput.value = componente.tipoMedia === 'ponderada' ? componente.peso : 1; weightInput.disabled = componente.tipoMedia !== 'ponderada'; weightLabel.append(weightInput);
        const actions = el('div', 'grades-component-actions');
        const saveComponent = el('button', 'teacher-class-action is-primary', 'Salvar'); saveComponent.type = 'submit';
        const deleteComponent = el('button', 'teacher-class-action is-danger', 'Excluir'); deleteComponent.type = 'button';
        actions.append(saveComponent, deleteComponent); editForm.append(titleLabel, maxLabel, weightLabel, actions);
        editForm.addEventListener('submit', async event => {
          event.preventDefault(); if (!editForm.reportValidity()) return;
          saveComponent.disabled = true; managerFeedback.textContent = 'Salvando componente...';
          try {
            const response = await fetch(`${url}/componentes/${encodeURIComponent(componente.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: titleInput.value.trim(), valorMaximo: Number(maxInput.value), peso: Number(weightInput.value) }) });
            const result = await response.json(); if (!response.ok) throw new Error(result.mensagem || 'Não foi possível atualizar componente.');
            await abrir(disciplina);
          } catch (error) { managerFeedback.textContent = error.message || 'Não foi possível atualizar componente.'; saveComponent.disabled = false; }
        });
        deleteComponent.addEventListener('click', async () => {
          if (!window.confirm(`Excluir "${componente.titulo}" e todas as notas lançadas para esse componente?`)) return;
          deleteComponent.disabled = true; managerFeedback.textContent = 'Excluindo componente...';
          try {
            const response = await fetch(`${url}/componentes/${encodeURIComponent(componente.id)}`, { method: 'DELETE' });
            const result = await response.json(); if (!response.ok) throw new Error(result.mensagem || 'Não foi possível excluir componente.');
            await abrir(disciplina);
          } catch (error) { managerFeedback.textContent = error.message || 'Não foi possível excluir componente.'; deleteComponent.disabled = false; }
        });
        manager.append(editForm);
      });
      manager.append(managerFeedback); detail.append(manager);
    }
    const roster = el('section', 'teacher-class-roster'); roster.append(el('h3', '', `Diário da turma (${data.alunos.length} alunos)`), el('p', 'teacher-class-module-note', 'Notas e componentes ficam salvos no banco de dados. A média é calculada pelo servidor Java.'));
    if (!data.componentes.length) roster.append(el('p', 'teacher-empty-message', 'Crie um componente acima para começar a lançar notas.'));
    else if (!data.alunos.length) roster.append(el('p', 'teacher-empty-message', 'Esta turma ainda não possui alunos matriculados.'));
    else {
      const wrapper = el('div', 'teacher-roster-table-wrap'); const table = el('table', 'teacher-roster-table grades-entry-table'); const thead = document.createElement('thead'); const headRow = document.createElement('tr');
      ['Aluno', 'RA', ...data.componentes.map(c => `${c.titulo} · máx. ${c.valorMaximo}`), 'Média'].forEach(label => headRow.append(el('th', '', label))); thead.append(headRow);
      const tbody = document.createElement('tbody');
      data.alunos.forEach(aluno => { const tr = document.createElement('tr'); tr.append(el('th', 'teacher-roster-name', aluno.nome), el('td', '', aluno.ra || '—'));
        data.componentes.forEach(componente => { const td = document.createElement('td'); const input = document.createElement('input'); input.className = 'grade-value-input'; input.type = 'number'; input.min = '0'; input.max = String(componente.valorMaximo); input.step = '0.01'; input.placeholder = '—';
          // O backend expõe os ids dos componentes também dentro da lista do aluno.
          const valor = aluno.componentes.find(item => item.titulo === componente.titulo)?.valor; input.value = valor ?? '';
          input.dataset.alunoId = aluno.id; input.dataset.componenteId = componente.id; td.append(input); tr.append(td);
        });
        // Média calculada pelo servidor Java (null quando indisponível)
        const celulaMedia = el('td', 'grade-average-cell', formatarMedia(aluno.media)); celulaMedia.dataset.mediaAluno = aluno.id; tr.append(celulaMedia);
        tbody.append(tr);
      });
      table.append(thead, tbody); wrapper.append(table); roster.append(wrapper);
      // Aviso do motivo quando a média não pôde ser calculada (servidor desligado, pesos != 10 etc.)
      const mediaNote = el('p', 'teacher-class-module-note grades-average-note'); roster.append(mediaNote);
      const mostrarAvisoMedia = erro => { mediaNote.textContent = erro ? `Média indisponível: ${erro}` : ''; mediaNote.hidden = !erro; };
      mostrarAvisoMedia(data.erroMedia);
      // Recarrega só as médias (sem redesenhar a tabela, para não perder o que está digitado)
      const atualizarMedias = async () => {
        try {
          const response = await fetch(url); const atualizado = await response.json(); if (!response.ok) return;
          (atualizado.alunos || []).forEach(a => { const celula = roster.querySelector(`[data-media-aluno="${a.id}"]`); if (celula) celula.textContent = formatarMedia(a.media); });
          mostrarAvisoMedia(atualizado.erroMedia);
        } catch (error) { /* mantém as médias atuais */ }
      };
      const save = el('button', 'teacher-class-action is-primary', 'Salvar notas'); save.type = 'button'; const saveFeedback = el('span', 'grades-save-feedback', ''); saveFeedback.setAttribute('role', 'status'); saveFeedback.setAttribute('aria-live', 'polite'); roster.append(save, saveFeedback);
      roster.querySelectorAll('.grade-value-input').forEach(input => input.addEventListener('input', () => {
        save.classList.remove('is-saved'); save.textContent = 'Salvar notas';
        saveFeedback.className = 'grades-save-feedback'; saveFeedback.textContent = 'Alterações não salvas';
      }));
      save.addEventListener('click', async () => { save.disabled = true; saveFeedback.className = 'grades-save-feedback'; saveFeedback.textContent = 'Salvando notas...';
        const notas = [...roster.querySelectorAll('.grade-value-input')].map(input => ({ alunoId: input.dataset.alunoId, componenteId: input.dataset.componenteId, valor: input.value === '' ? null : Number(input.value) }));
        try { const response = await fetch(`${url}/notas`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notas }) }); const result = await response.json(); if (!response.ok) throw new Error(result.mensagem || 'Não foi possível salvar notas.'); saveFeedback.className = 'grades-save-feedback is-success'; saveFeedback.textContent = '✓ Notas salvas com sucesso'; save.classList.add('is-saved'); save.textContent = 'Salvo ✓';
          await atualizarMedias(); }
        catch (error) { saveFeedback.className = 'grades-save-feedback is-error'; saveFeedback.textContent = error.message || 'Não foi possível salvar notas.'; } finally { save.disabled = false; }
      });
    }
    detail.append(roster);
  }
  try {
    const response = await fetch(base); const data = await response.json(); if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar suas disciplinas.');
    disciplinas = data.disciplinas || [];
    const turmaSolicitada = new URLSearchParams(window.location.search).get('turmaId');
    if (turmaSolicitada) disciplinas = disciplinas.filter(disciplina => disciplina.turmaId === turmaSolicitada);
    count.textContent = `${disciplinas.length} ${disciplinas.length === 1 ? 'disciplina' : 'disciplinas'}`; cards.replaceChildren();
    if (!disciplinas.length) { cards.append(el('p', 'teacher-empty-message', 'Você ainda não está vinculado a disciplinas com aulas organizadas.')); return; }
    disciplinas.forEach(disciplina => { const card = el('button', 'teacher-class-card'); card.type = 'button'; const codigoTurma = window.formatarCodigoTurmaDisciplina(disciplina.turma, disciplina.codigo); card.append(el('span', 'teacher-class-card-top', `${disciplina.codigo || 'Disciplina'} · Turma ${codigoTurma}`), el('strong', 'teacher-class-card-course', disciplina.disciplina), el('span', 'teacher-class-card-meta', `${disciplina.periodoLetivo} · abrir diário →`)); card.addEventListener('click', () => abrir(disciplina)); cards.append(card); });
  } catch (error) { count.textContent = '—'; cards.replaceChildren(el('p', 'teacher-empty-message', error.message || 'Não foi possível carregar suas disciplinas.')); }
});
