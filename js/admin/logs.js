(() => {
  const rows = document.querySelector('#logs-rows');
  if (!rows) return;

  const search = document.querySelector('#logs-search');
  const type = document.querySelector('#logs-type');
  const date = document.querySelector('#logs-date');
  const empty = document.querySelector('#logs-empty');
  const footer = document.querySelector('#logs-footer');
  const dialog = document.querySelector('#logs-dialog');
  const pageSize = 10;
  const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  let logs = [];
  let page = 1;

  function formatDate(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : dateTimeFormatter.format(parsed);
  }

  function dateKey(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  function addCell(row, value, className = '') {
    const cell = document.createElement('td');
    cell.textContent = value || '—';
    if (className) cell.className = className;
    row.append(cell);
    return cell;
  }

  function showDetails(log) {
    const details = document.querySelector('#logs-details');
    details.replaceChildren();
    const fields = [
      ['Data e hora', formatDate(log.dataHora)],
      ['Ação', log.acao],
      ['Usuário', log.usuario],
      ['Tipo', log.tipo],
      ['Descrição', log.descricao],
    ];
    fields.forEach(([label, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value || '—';
      details.append(term, description);
    });
    dialog.showModal();
  }

  function render() {
    const query = search.value.trim().toLocaleLowerCase('pt-BR');
    const filtered = logs.filter(log => {
      const matchesText = [log.acao, log.usuario, log.descricao].some(value =>
        String(value || '').toLocaleLowerCase('pt-BR').includes(query));
      return matchesText && (!type.value || log.tipo === type.value) && (!date.value || dateKey(log.dataHora) === date.value);
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, totalPages);
    rows.replaceChildren();
    filtered.slice((page - 1) * pageSize, page * pageSize).forEach(log => {
      const row = document.createElement('tr');
      addCell(row, formatDate(log.dataHora));
      addCell(row, log.acao, 'logs-action');
      addCell(row, log.usuario);
      const typeCell = addCell(row, '');
      const badge = document.createElement('span');
      badge.className = 'logs-type';
      badge.textContent = log.tipo || '—';
      typeCell.replaceChildren(badge);
      const actionCell = addCell(row, '');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'logs-detail-button';
      button.textContent = 'Ver detalhes';
      button.setAttribute('aria-label', `Ver detalhes de ${log.acao || 'registro'}`);
      button.addEventListener('click', () => showDetails(log));
      actionCell.replaceChildren(button);
      rows.append(row);
    });

    document.querySelector('#logs-total').textContent = `${logs.length} ${logs.length === 1 ? 'registro' : 'registros'}`;
    empty.hidden = filtered.length > 0;
    document.querySelector('#logs-empty-title').textContent = logs.length ? 'Nenhum resultado encontrado' : 'Nenhum registro disponível';
    document.querySelector('#logs-empty-description').textContent = logs.length
      ? 'Ajuste a busca ou os filtros para encontrar outros registros.'
      : 'Os registros aparecerão aqui quando forem fornecidos pelo sistema.';
    footer.hidden = filtered.length === 0;
    document.querySelector('#logs-range').textContent = `Exibindo ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} de ${filtered.length}`;
    document.querySelector('#logs-page-number').textContent = `Página ${page} de ${totalPages}`;
    document.querySelector('#logs-prev').disabled = page === 1;
    document.querySelector('#logs-next').disabled = page === totalPages;
  }

  // Ponto de integração para os dados que serão obtidos pelo backend.
  // Campos esperados: dataHora, acao, usuario, tipo e descricao.
  window.renderAdminLogs = records => {
    logs = Array.isArray(records) ? records.filter(record => record && typeof record === 'object') : [];
    logs.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
    const selectedType = type.value;
    type.replaceChildren(new Option('Todos os tipos', ''));
    [...new Set(logs.map(log => log.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .forEach(value => type.add(new Option(value, value)));
    type.value = selectedType;
    page = 1;
    render();
  };

  [search, type, date].forEach(control => control.addEventListener('input', () => { page = 1; render(); }));
  document.querySelector('#logs-prev').addEventListener('click', () => { page--; render(); });
  document.querySelector('#logs-next').addEventListener('click', () => { page++; render(); });
  document.querySelector('#logs-close').addEventListener('click', () => dialog.close());
  window.renderAdminLogs([]);
})();
