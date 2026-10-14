(() => {
  const host = document.querySelector('#app .card');
  const { role } = document.querySelector('#app').dataset;
  const user = JSON.parse(sessionStorage.getItem('notadez_demo_user') || 'null');
  const storageKey = `notadez_calendar_${role}_${user?.email || 'usuario'}`;
  const now = new Date();
  let displayedMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let selectedDate = formatDate(now);
  let editingId = null;
  let events = loadEvents();

  host.classList.add('calendar-host');
  host.innerHTML = `
    <div class="calendar-page">
      <div class="calendar-toolbar">
        <div>
          <p class="calendar-eyebrow">Agenda acad&ecirc;mica</p>
          <h2 id="calendar-month"></h2>
        </div>
        <div class="calendar-actions">
          <button class="calendar-button calendar-today" id="calendar-today" type="button">Hoje</button>
          <button class="calendar-icon-button" id="calendar-prev" type="button" aria-label="M&ecirc;s anterior">&lsaquo;</button>
          <button class="calendar-icon-button" id="calendar-next" type="button" aria-label="Pr&oacute;ximo m&ecirc;s">&rsaquo;</button>
          <button class="calendar-button calendar-add" id="calendar-add" type="button"><span aria-hidden="true">+</span> Novo evento</button>
        </div>
      </div>

      <div class="calendar-layout">
        <section class="calendar-month-view" aria-label="Calend&aacute;rio mensal">
          <div class="calendar-weekdays" aria-hidden="true">
            <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>S&aacute;b</span><span>Dom</span>
          </div>
          <div class="calendar-days" id="calendar-days"></div>
        </section>
        <aside class="calendar-agenda">
          <div class="agenda-heading">
            <div>
              <p class="calendar-eyebrow">Eventos do m&ecirc;s</p>
              <h3 id="agenda-month"></h3>
            </div>
            <span class="agenda-count" id="agenda-count">0</span>
          </div>
          <div class="agenda-list" id="agenda-list"></div>
          <p class="calendar-hint">Selecione um dia para adicionar um evento. Clique em um evento para edit&aacute;-lo.</p>
        </aside>
      </div>
    </div>

    <dialog class="event-modal" id="event-modal" aria-labelledby="event-modal-title">
      <form class="event-form" id="event-form">
        <div class="modal-heading">
          <div>
            <p class="calendar-eyebrow">Agenda acad&ecirc;mica</p>
            <h2 id="event-modal-title">Novo evento</h2>
          </div>
          <button class="modal-close" id="event-close" type="button" aria-label="Fechar">&times;</button>
        </div>
        <label class="event-field event-field-wide">
          <span>Nome do evento</span>
          <input id="event-title" name="title" maxlength="90" placeholder="Ex.: Aula, prova ou reuni&atilde;o" required>
        </label>
        <div class="event-fields-row">
          <label class="event-field">
            <span>Data</span>
            <input id="event-date" name="date" type="date" required>
          </label>
          <label class="event-field">
            <span>Categoria</span>
            <select id="event-category" name="category">
              <option value="purple">Acad&ecirc;mico</option>
              <option value="blue">Aula</option>
              <option value="green">Pessoal</option>
              <option value="orange">Prazo</option>
              <option value="red">Importante</option>
            </select>
          </label>
        </div>
        <div class="event-fields-row">
          <label class="event-field">
            <span>In&iacute;cio</span>
            <input id="event-start" name="start" type="time" required>
          </label>
          <label class="event-field">
            <span>T&eacute;rmino</span>
            <input id="event-end" name="end" type="time" required>
          </label>
        </div>
        <label class="event-field event-field-wide">
          <span>Local</span>
          <input id="event-location" name="location" maxlength="100" placeholder="Sala, bloco ou link">
        </label>
        <label class="event-field event-field-wide">
          <span>Descri&ccedil;&atilde;o</span>
          <textarea id="event-description" name="description" rows="3" maxlength="400" placeholder="Detalhes adicionais (opcional)"></textarea>
        </label>
        <div class="event-form-footer">
          <button class="calendar-delete" id="event-delete" type="button" hidden>Excluir evento</button>
          <div class="event-form-actions">
            <button class="calendar-button" id="event-cancel" type="button">Cancelar</button>
            <button class="calendar-button calendar-add" type="submit">Salvar evento</button>
          </div>
        </div>
      </form>
    </dialog>
  `;

  const modal = host.querySelector('#event-modal');
  const form = host.querySelector('#event-form');
  const fields = {
    title: host.querySelector('#event-title'),
    date: host.querySelector('#event-date'),
    category: host.querySelector('#event-category'),
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

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const record = {
      id: editingId || createId(),
      title: fields.title.value.trim(),
      date: fields.date.value,
      category: fields.category.value,
      start: fields.start.value,
      end: fields.end.value,
      location: fields.location.value.trim(),
      description: fields.description.value.trim()
    };

    const previousEvent = editingId ? events.find(item => item.id === editingId) : null;
    if (record.date < todayKey() && (!previousEvent || previousEvent.date !== record.date)) {
      fields.date.setCustomValidity('N\u00e3o \u00e9 poss\u00edvel criar eventos em datas anteriores a hoje.');
      fields.date.reportValidity();
      fields.date.setCustomValidity('');
      return;
    }

    if (record.end <= record.start) {
      fields.end.setCustomValidity('O t\u00e9rmino precisa ser depois do in\u00edcio.');
      fields.end.reportValidity();
      fields.end.setCustomValidity('');
      return;
    }

    events = events.filter(item => item.id !== record.id);
    events.push(record);
    saveEvents();
    selectedDate = record.date;
    const [year, month] = record.date.split('-').map(Number);
    displayedMonth = new Date(year, month - 1, 1);
    closeEditor();
    render();
  });

  host.querySelector('#event-delete').addEventListener('click', () => {
    if (!editingId) return;
    events = events.filter(item => item.id !== editingId);
    saveEvents();
    closeEditor();
    render();
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
    const dayCells = [];

    for (let index = 0; index < offset; index += 1) {
      dayCells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');
    }

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const date = new Date(year, month, dayNumber);
      const dateKey = formatDate(date);
      const dayEvents = eventsForDate(dateKey);
      const classes = [
        'calendar-day',
        dateKey === today ? 'is-today' : '',
        dateKey < today ? 'is-past' : '',
        dateKey === selectedDate ? 'is-selected' : ''
      ].filter(Boolean).join(' ');
      const eventMarkup = dayEvents.slice(0, 2).map(item => `
        <button class="calendar-event event-${escapeAttribute(item.category)}" type="button" data-event-id="${escapeAttribute(item.id)}" title="${escapeAttribute(item.start)} ${escapeAttribute(item.title)}">
          <span>${escapeHtml(item.title)}</span>
        </button>
      `).join('');
      const extraCount = dayEvents.length > 2
        ? `<span class="calendar-more">+${dayEvents.length - 2} mais</span>`
        : '';

      dayCells.push(`
        <div class="${classes}" data-date="${dateKey}">
          <button class="calendar-date" type="button" aria-label="Adicionar evento em ${dateKey}" ${dateKey < today ? 'disabled' : ''}>${dayNumber}</button>
          <div class="calendar-event-stack">${eventMarkup}${extraCount}</div>
        </div>
      `);
    }

    const remaining = (7 - (dayCells.length % 7)) % 7;
    for (let index = 0; index < remaining; index += 1) {
      dayCells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');
    }
    host.querySelector('#calendar-days').innerHTML = dayCells.join('');
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
      agenda.innerHTML = '<div class="agenda-empty"><span class="agenda-empty-icon">&#10022;</span><strong>Nenhum evento neste m&ecirc;s</strong><small>Adicione um evento clicando em um dia do calend&aacute;rio.</small></div>';
      return;
    }

    agenda.innerHTML = monthEvents.map(item => {
      const date = parseDate(item.date);
      const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '');
      const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date).replace('.', '');
      return `
        <button class="agenda-event" type="button" data-agenda-id="${escapeAttribute(item.id)}">
          <span class="agenda-event-marker event-${escapeAttribute(item.category)}"></span>
          <span class="agenda-event-date"><strong>${dateLabel}</strong><small>${weekday}</small></span>
          <span class="agenda-event-info"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.start)}${item.end ? ` - ${escapeHtml(item.end)}` : ''}${item.location ? ` &middot; ${escapeHtml(item.location)}` : ''}</small></span>
        </button>
      `;
    }).join('');

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
    form.reset();
    fields.title.value = item?.title || '';
    fields.date.value = item?.date || date;
    fields.date.min = item?.date < todayKey() ? item.date : todayKey();
    fields.category.value = item?.category || 'purple';
    fields.start.value = item?.start || '09:00';
    fields.end.value = item?.end || '10:00';
    fields.location.value = item?.location || '';
    fields.description.value = item?.description || '';
    host.querySelector('#event-modal-title').textContent = item ? 'Editar evento' : 'Novo evento';
    host.querySelector('#event-delete').hidden = !item;
    modal.showModal();
    fields.title.focus();
  }

  function closeEditor() {
    if (modal.open) modal.close();
    editingId = null;
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

  function loadEvents() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(saved) ? saved.filter(item => item && item.id && item.date && item.title) : [];
    } catch {
      return [];
    }
  }

  function saveEvents() {
    localStorage.setItem(storageKey, JSON.stringify(events));
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

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  render();
})();
