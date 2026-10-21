(() => {
  const host = document.querySelector('#app .calendar-host');
  const cloneTemplate = id => document.getElementById(id).content.cloneNode(true);
  const { role } = document.querySelector('#app').dataset;
  const user = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
  const storageKey = `notadez_calendar_${role}_${user?.email || 'usuario'}`;
  const now = new Date();
  let displayedMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let selectedDate = formatDate(now);
  let editingId = null;
  let events = loadEvents();

  host.classList.add('calendar-host');
  

  const modal = host.querySelector('#event-modal');
  const form = host.querySelector('#event-form');
  const fields = {
    title: host.querySelector('#event-title'),
    date: host.querySelector('#event-date'),
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
        if (item.category) eventButton.classList.add(`event-${item.category}`);
        eventButton.dataset.eventId = item.id;
        eventButton.title = `${item.start} ${item.title}`;
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
      if (item.category) button.querySelector('.agenda-event-marker').classList.add(`event-${item.category}`);
      button.querySelector('.agenda-event-date strong').textContent = dateLabel;
      button.querySelector('.agenda-event-date small').textContent = weekday;
      button.querySelector('.agenda-event-info strong').textContent = item.title;
      const timeDetails = [
    item.start,
    item.end ? `- ${item.end}` : '',
    item.location ? `· ${item.location}` : ''
  ].filter(Boolean).join(' ');
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
    form.reset();
    fields.title.value = item?.title || '';
    fields.date.value = item?.date || date;
    fields.date.min = item?.date < todayKey() ? item.date : todayKey();
    fields.start.value = item?.start || '';
    fields.end.value = item?.end || '';
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

  render();
})();
