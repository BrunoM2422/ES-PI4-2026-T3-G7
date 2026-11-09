(() => {
  const host = document.querySelector('#app .calendar-host');
  const cloneTemplate = id => document.getElementById(id).content.cloneNode(true);
  const { role } = document.querySelector('#app').dataset;
  const user = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
  const legacyStorageKey = `notadez_calendar_${role}_${user?.email || 'usuario'}`;
  const migrationStorageKey = `${legacyStorageKey}_migrated`;
  const categoryLabels = {
    feriado: 'Feriado',
    institucional: 'Evento Institucional',
    aula: 'Alteração de aula',
    atividade: 'Atividade da turma',
    avaliacao: 'Prova ou entrega',
    compromisso: 'Compromisso pessoal'
  };
  const now = new Date();
  let displayedMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let selectedDate = formatDate(now);
  let editingId = null;
  let editorReadOnly = false;
  let events = [];

  host.classList.add('calendar-host');
  

  const modal = host.querySelector('#event-modal');
  const form = host.querySelector('#event-form');
  const fields = {
    title: host.querySelector('#event-title'),
    date: host.querySelector('#event-date'),
    category: host.querySelector('#event-category'),
    turma: host.querySelector('#event-turma'),
    start: host.querySelector('#event-start'),
    end: host.querySelector('#event-end'),
    location: host.querySelector('#event-location'),
    description: host.querySelector('#event-description')
  };

  host.querySelector('#calendar-prev').addEventListener('click', () => changeMonth(-1));
  host.querySelector('#calendar-next').addEventListener('click', () => changeMonth(1));
  host.querySelector('#calendar-today').addEventListener('click', () => {
    const today = new Date();
    displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    selectedDate = formatDate(today);
    render();
  });
  host.querySelector('#calendar-add').addEventListener('click', () => {
    if (selectedDate >= todayKey()) openEditor(selectedDate);
  });
  host.querySelector('#event-close').addEventListener('click', closeEditor);
  host.querySelector('#event-cancel').addEventListener('click', closeEditor);
  fields.category.addEventListener('change', updateCategoryFields);

  host.querySelector('#calendar-days').addEventListener('click', event => {
    const day = event.target.closest('[data-date]');
    if (!day) return;

    if (event.target.closest('[data-event-id]')) {
      openEditor(day.dataset.date, event.target.closest('[data-event-id]').dataset.eventId);
      return;
    }

    if (day.dataset.date < todayKey()) return;
    selectedDate = day.dataset.date;
    render();
    openEditor(selectedDate);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (editorReadOnly) return;
    if (!window.validateAppForm(form)) return;

    const record = {
      id: editingId || createId(),
      title: fields.title.value.trim(),
      date: fields.date.value,
      category: fields.category.value,
      turmaId: fields.turma?.value || '',
      start: fields.category.value === 'feriado' ? '' : fields.start.value,
      end: fields.category.value === 'feriado' ? '' : fields.end.value,
      location: fields.category.value === 'feriado' ? '' : fields.location.value.trim(),
      description: fields.description.value.trim()
    };

    const previousEvent = editingId ? events.find(item => item.id === editingId) : null;
    if (record.date < todayKey() && (!previousEvent || previousEvent.date !== record.date)) {
      fields.date.setCustomValidity('Não é possível criar eventos em datas anteriores a hoje.');
      window.showAppMessage(fields.date.validationMessage, 'error');
      fields.date.focus();
      fields.date.setCustomValidity('');
      return;
    }

    if (record.category !== 'feriado' && record.end <= record.start) {
      fields.end.setCustomValidity('O término precisa ser depois do início.');
      window.showAppMessage(fields.end.validationMessage, 'error');
      fields.end.focus();
      fields.end.setCustomValidity('');
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
      await enviarRequisicao(
        editingId ? `/api/calendario/eventos/${editingId}` : '/api/calendario/eventos',
        editingId ? 'PUT' : 'POST',
        record
      );
      selectedDate = record.date;
      const [year, month] = record.date.split('-').map(Number);
      displayedMonth = new Date(year, month - 1, 1);
      await loadEvents();
      closeEditor();
      render();
    } catch (erro) {
      window.showAppMessage(erro.message || 'Não foi possível salvar o evento.');
    } finally {
      submitButton.disabled = false;
    }
  });

  host.querySelector('#event-delete').addEventListener('click', async () => {
    if (!editingId) return;
    const deleteButton = host.querySelector('#event-delete');
    deleteButton.disabled = true;
    try {
      await enviarRequisicao(`/api/calendario/eventos/${editingId}`, 'DELETE');
      await loadEvents();
      closeEditor();
      render();
    } catch (erro) {
      window.showAppMessage(erro.message || 'Não foi possível excluir o evento.');
    } finally {
      deleteButton.disabled = false;
    }
  });

  modal.addEventListener('click', event => {
    if (event.target === modal) closeEditor();
  });

  function render() {
    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();
    const today = todayKey();
    const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(displayedMonth);
    host.querySelector('#calendar-month').textContent = capitalize(monthLabel);
    host.querySelector('#agenda-month').textContent = capitalize(monthLabel);

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const daysContainer = host.querySelector('#calendar-days');
    daysContainer.replaceChildren();

    for (let index = 0; index < offset; index += 1) {
      daysContainer.append(cloneTemplate('calendar-empty-day-template'));
    }

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const date = new Date(year, month, dayNumber);
      const dateKey = formatDate(date);
      const dayEvents = eventsForDate(dateKey);
      const day = cloneTemplate('calendar-day-template').querySelector('.calendar-day');
      day.classList.toggle('is-today', dateKey === today);
      day.classList.toggle('is-past', dateKey < today);
      day.classList.toggle('is-selected', dateKey === selectedDate);
      day.dataset.date = dateKey;
      const dateButton = day.querySelector('.calendar-date');
      dateButton.setAttribute('aria-label', `Adicionar evento em ${dateKey}`);
      dateButton.disabled = dateKey < today;
      dateButton.textContent = String(dayNumber);
      const stack = day.querySelector('.calendar-event-stack');
      dayEvents.slice(0, 2).forEach(item => {
        const eventButton = cloneTemplate('calendar-event-template').querySelector('.calendar-event');
        eventButton.classList.add(`event-${item.category}`);
        eventButton.dataset.eventId = item.id;
        eventButton.title = item.category === 'feriado' ? item.title : `${item.start} ${item.title}`;
        eventButton.querySelector('span').textContent = item.title;
        stack.append(eventButton);
      });
      if (dayEvents.length > 2) {
        const more = cloneTemplate('calendar-more-template').querySelector('.calendar-more');
        more.textContent = `+${dayEvents.length - 2} mais`;
        stack.append(more);
      }
      daysContainer.append(day);
    }

    const remaining = (7 - (offset + daysInMonth) % 7) % 7;
    for (let index = 0; index < remaining; index += 1) {
      daysContainer.append(cloneTemplate('calendar-empty-day-template'));
    }
    host.querySelector('#calendar-add').disabled = selectedDate < today;
    renderAgenda(month, year);
  }

  function renderAgenda(month, year) {
    const monthEvents = events
      .filter(item => {
        const date = parseDate(item.date);
        return date.getFullYear() === year && date.getMonth() === month;
      })
      .sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
    const agenda = host.querySelector('#agenda-list');
    host.querySelector('#agenda-count').textContent = monthEvents.length;

    if (!monthEvents.length) {
      agenda.replaceChildren(cloneTemplate('agenda-empty-template'));
      return;
    }

    agenda.replaceChildren();
    monthEvents.forEach(item => {
      const date = parseDate(item.date);
      const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '');
      const dateLabel = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short'
      }).format(date).replace('.', '');
      const button = cloneTemplate('agenda-event-template').querySelector('.agenda-event');
      button.dataset.agendaId = item.id;
      button.querySelector('.agenda-event-marker').classList.add(`event-${item.category}`);
      button.querySelector('.agenda-event-date strong').textContent = dateLabel;
      button.querySelector('.agenda-event-date small').textContent = weekday;
      button.querySelector('.agenda-event-info strong').textContent = item.title;
      const categoryLabel = categoryLabels[item.category] || 'Evento';
      const timeDetails = item.category === 'feriado'
        ? categoryLabel
        : [categoryLabel, item.start, item.end ? `- ${item.end}` : '', item.location].filter(Boolean).join(' · ');
      button.querySelector('.agenda-event-info small').textContent = timeDetails;
      agenda.append(button);
    });

    agenda.querySelectorAll('[data-agenda-id]').forEach(button => {
      button.addEventListener('click', () => {
        const item = events.find(event => event.id === button.dataset.agendaId);
        if (item) openEditor(item.date, item.id);
      });
    });
  }

  function openEditor(date, id = null) {
    const item = id ? events.find(event => event.id === id) : null;
    editingId = item?.id || null;
    editorReadOnly = Boolean(item && !item.canManage);
    fields.category.querySelectorAll('[data-readonly-category]').forEach(option => option.remove());
    form.reset();
    fields.title.value = item?.title || '';
    fields.date.value = item?.date || date;
    fields.date.min = item?.date < todayKey() ? item.date : todayKey();
    if (item && !Array.from(fields.category.options).some(option => option.value === item.category)) {
      const categoriaLegada = new Option(categoryLabels[item.category] || 'Evento', item.category);
      categoriaLegada.dataset.readonlyCategory = 'true';
      fields.category.add(categoriaLegada);
    }
    fields.category.value = item?.category || '';
    if (fields.turma) fields.turma.value = item?.turmaId || '';
    fields.start.value = item?.start || '';
    fields.end.value = item?.end || '';
    fields.location.value = item?.location || '';
    fields.description.value = item?.description || '';
    form.querySelectorAll('input, select, textarea').forEach(field => {
      field.disabled = editorReadOnly;
    });
    updateCategoryFields();
    form.querySelector('[type="submit"]').hidden = editorReadOnly;
    host.querySelector('#event-modal-title').textContent = editorReadOnly ? 'Detalhes do evento' : item ? 'Editar evento' : 'Novo evento';
    host.querySelector('#event-delete').hidden = !item || !item.canManage;
    modal.showModal();
    fields.title.focus();
  }

  function closeEditor() {
    if (modal.open) modal.close();
    editingId = null;
  }

  function updateCategoryFields() {
    const feriado = fields.category.value === 'feriado';
    [fields.start, fields.end, fields.location].forEach(field => {
      field.disabled = editorReadOnly || feriado;
      field.closest('.event-field').classList.toggle('is-disabled', feriado);
      if (feriado) field.value = '';
    });
    fields.start.required = !editorReadOnly && !feriado;
    fields.end.required = !editorReadOnly && !feriado;
  }

  function changeMonth(amount) {
    const selectedDay = Number(selectedDate.split('-')[2]) || 1;
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + amount, 1);
    const lastDay = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
    selectedDate = formatDate(new Date(
      displayedMonth.getFullYear(),
      displayedMonth.getMonth(),
      Math.min(selectedDay, lastDay)
    ));
    render();
  }

  function eventsForDate(date) {
    return events
      .filter(item => item.date === date)
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  async function loadEvents() {
    try {
      await migrateLegacyEvents();
      const data = await enviarRequisicao('/api/calendario/eventos', 'GET');
      events = Array.isArray(data.eventos) ? data.eventos : [];
      render();
    } catch (erro) {
      console.error('Erro ao carregar eventos do calendário:', erro);
      events = [];
      render();
      const mensagem = document.createElement('div');
      mensagem.className = 'agenda-empty';
      mensagem.textContent = 'Não foi possível carregar os eventos. Verifique a conexão com o servidor.';
      host.querySelector('#agenda-list').replaceChildren(mensagem);
    }
  }

  async function migrateLegacyEvents() {
    if (localStorage.getItem(migrationStorageKey) === 'true') return;
    try {
      const antigos = JSON.parse(localStorage.getItem(legacyStorageKey) || '[]');
      const eventos = Array.isArray(antigos)
        ? antigos.filter(item => item && item.id && item.date && item.title).map(item => ({
          legacyKey: `${legacyStorageKey}:${item.id}`,
          title: item.title,
          date: item.date,
          category: item.category === 'feriado' ? 'feriado' : 'institucional',
          start: item.start || '',
          end: item.end || '',
          location: item.location || '',
          description: item.description || ''
        }))
        : [];

      if (eventos.length) {
        await enviarRequisicao('/api/calendario/eventos/migrar-legado', 'POST', { eventos });
      }
      localStorage.setItem(migrationStorageKey, 'true');
    } catch (erro) {
      console.error('Não foi possível migrar os eventos locais:', erro);
    }
  }

  async function enviarRequisicao(url, method, body) {
    const token = sessionStorage.getItem('notadez_token');
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (response.status === 401) {
      sessionStorage.removeItem('notadez_user');
      sessionStorage.removeItem('notadez_token');
      window.location.href = '../../login.html';
    }
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível atualizar o calendário.');
    return data;
  }

  function parseDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function todayKey() {
    return formatDate(new Date());
  }

  function createId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function capitalize(value) {
    return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);
  }

  async function carregarTurmasDocente() {
    try {
      const data = await enviarRequisicao('/api/calendario/minhas-turmas', 'GET');
      const turmas = data.turmas || [];
      fields.turma.replaceChildren(new Option(
        turmas.length ? 'Selecione uma turma' : 'Você não está alocado a nenhuma turma',
        ''
      ));
      turmas.forEach(turma => fields.turma.add(new Option(`${turma.codigo} · ${turma.periodoLetivo}`, turma.id)));
      fields.turma.disabled = turmas.length === 0;
    } catch (erro) {
      console.error('Erro ao carregar turmas do docente:', erro);
      fields.turma.replaceChildren(new Option('Não foi possível carregar suas turmas', ''));
      fields.turma.disabled = true;
    }
  }

  carregarTurmasDocente();
  loadEvents();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadEvents();
  });
  window.setInterval(() => {
    if (!document.hidden) loadEvents();
  }, 60000);
})();
