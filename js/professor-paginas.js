(() => {
  const app = document.querySelector('#app');
  const host = app?.querySelector('.content > .card');
  if (!app || !host || app.dataset.role !== 'professor') return;

  const page = app.dataset.page;
  const blankPanel = (title, message) => `
    <section class="teacher-panel teacher-empty-panel">
      <h2>${title}</h2>
      <p>${message}</p>
    </section>`;

  host.classList.remove('card');
  host.classList.add('teacher-host');

  if (page === 'dashboard') {
    host.innerHTML = `
      <div class="teacher-dashboard">
        <section class="teacher-stat-grid">
          <article class="teacher-stat"><span>Turmas Ativas</span><strong>&mdash;</strong><small>&nbsp;</small><i aria-hidden="true">&#127891;</i></article>
          <article class="teacher-stat teacher-stat-review"><span>Avalia&ccedil;&otilde;es Pendentes</span><strong>&mdash;</strong><small>&nbsp;</small><i aria-hidden="true">&#9998;</i></article>
        </section>
        <div class="teacher-dashboard-grid">
          <section class="teacher-panel teacher-agenda">
            <h2>Hoje - Agenda Acad&ecirc;mica</h2>
            <p class="teacher-empty-message">Nenhuma atividade agendada para hoje.</p>
          </section>
          <section class="teacher-panel teacher-activity">
            <h2>Registro de Atividades</h2>
            <p class="teacher-empty-message">Nenhuma atividade recente.</p>
          </section>
          <section class="teacher-panel teacher-notifications">
            <h2>Notifica&ccedil;&otilde;es Recentes</h2>
            <p class="teacher-empty-message">Nenhuma notifica&ccedil;&atilde;o recente.</p>
          </section>
        </div>
      </div>`;
    return;
  }

  if (page === 'turmas') {
    host.innerHTML = `<div class="teacher-page">${blankPanel('Minhas Turmas', 'Nenhuma turma cadastrada.')}</div>`;
    return;
  }

  if (page === 'notas') {
    host.innerHTML = `<div class="teacher-page">${blankPanel('Notas', 'Nenhuma turma cadastrada.')}</div>`;
    return;
  }

  if (page === 'frequencia') {
    host.innerHTML = `<div class="teacher-page">${blankPanel('Frequ&ecirc;ncia', 'Nenhuma turma cadastrada.')}</div>`;
    return;
  }

  if (page === 'auditoria') {
    host.innerHTML = `<div class="teacher-page">${blankPanel('Log de Auditoria', 'Nenhuma mudan&ccedil;a recente.')}</div>`;
    return;
  }

  if (page === 'horarios') {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mondayOffset = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - mondayOffset);
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
      return { date, name: new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date) };
    });
    const format = date => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
    const start = format(week[0].date);
    const end = format(week[6].date);
    const days = week.map(({ date, name }) => `
      <article class="teacher-week-day ${date.toDateString() === now.toDateString() ? 'is-today' : ''}">
        <div><span>${name}</span><strong>${date.getDate()}</strong></div>
        <p>Nenhum hor&aacute;rio cadastrado.</p>
      </article>`).join('');

    host.innerHTML = `
      <div class="teacher-page">
        <section class="teacher-panel teacher-week-panel">
          <div class="teacher-week-heading"><div><h2>Hor&aacute;rios da Semana</h2><p>Semana de ${start} a ${end}</p></div></div>
          <div class="teacher-week-grid">${days}</div>
        </section>
      </div>`;
  }
})();
