document.addEventListener('DOMContentLoaded', async () => {
  const cards = document.querySelector('[data-grade-cards]');
  const count = document.querySelector('[data-grade-count]');
  const detail = document.querySelector('[data-grade-detail]');
  if (!cards || !detail) return;
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // media vem do servidor Java; null quando o cálculo não está disponível
  const temMedia = media => media !== null && media !== undefined;
  const formatarMedia = media => temMedia(media) ? Number(media).toFixed(2) : '—';
  let disciplinas = [];
  function fechar() { detail.hidden = true; cards.closest('.grades-panel').hidden = false; }
  function abrir(disciplina) {
    cards.closest('.grades-panel').hidden = true;
    detail.hidden = false;
    detail.replaceChildren();
    const head = el('div', 'grades-detail-heading');
    const infos = el('div'); infos.append(el('span', 'grades-eyebrow', `Turma ${disciplina.turma} · ${disciplina.periodoLetivo}`), el('h2', '', disciplina.disciplina), el('p', '', 'Notas registradas pelos seus professores.'));
    const back = el('button', 'grades-back', '← Voltar'); back.type = 'button'; back.addEventListener('click', fechar); head.append(infos, back); detail.append(head);
    if (!disciplina.componentes.length) { detail.append(el('p', 'grades-empty', 'Ainda não há componentes ou notas lançadas nesta disciplina.')); return; }

    // Média da disciplina (calculada pelo servidor Java)
    const resumo = el('div', 'grades-average');
    resumo.append(el('span', 'grades-average-label', 'Média'), el('strong', 'grades-average-value', formatarMedia(disciplina.media)));
    if (!temMedia(disciplina.media)) resumo.append(el('small', 'grades-average-note', 'Ainda não disponível. Ela aparece quando o cálculo estiver ativo e as notas estiverem lançadas.'));
    detail.append(resumo);

    const wrapper = el('div', 'grades-table-wrap'); const table = el('table', 'grades-table');
    const thead = document.createElement('thead'); const row = document.createElement('tr');
    ['Componente', 'Nota', 'Valor máximo', 'Peso'].forEach(label => row.append(el('th', '', label))); thead.append(row);
    const tbody = document.createElement('tbody');
    disciplina.componentes.forEach(componente => { const tr = document.createElement('tr');
      tr.append(el('th', '', componente.titulo), el('td', '', componente.valor === null ? '—' : String(componente.valor)), el('td', '', String(componente.valorMaximo)), el('td', '', String(componente.peso)));
      tbody.append(tr);
    });
    table.append(thead, tbody); wrapper.append(table); detail.append(wrapper);
  }
  try {
    const response = await fetch('/api/notas/aluno'); const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar suas notas.');
    disciplinas = data.disciplinas || []; count.textContent = `${disciplinas.length} ${disciplinas.length === 1 ? 'disciplina' : 'disciplinas'}`;
    cards.replaceChildren();
    if (!disciplinas.length) { cards.append(el('p', 'student-dashboard-empty', 'Você ainda não possui disciplinas matriculadas.')); return; }
    disciplinas.forEach(disciplina => {
      const card = el('button', 'grades-card'); card.type = 'button';
      const quantidade = `${disciplina.componentes.length} ${disciplina.componentes.length === 1 ? 'componente lançado' : 'componentes lançados'}`;
      const rodape = temMedia(disciplina.media) ? `Média ${formatarMedia(disciplina.media)} · ${quantidade}  →` : `${quantidade}  →`;
      card.append(el('span', 'grades-card-top', `${disciplina.codigo || 'Disciplina'} · Turma ${disciplina.turma}`), el('strong', '', disciplina.disciplina), el('span', 'grades-card-bottom', rodape));
      card.addEventListener('click', () => abrir(disciplina)); cards.append(card);
    });
  } catch (error) { count.textContent = '—'; cards.replaceChildren(el('p', 'student-dashboard-empty', error.message || 'Não foi possível carregar suas disciplinas.')); }
});