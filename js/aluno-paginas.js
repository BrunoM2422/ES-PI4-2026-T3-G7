(() => {
  const app = document.querySelector('#app');
  const host = app?.querySelector('.content > .card');
  if (!app || !host || app.dataset.role !== 'aluno') return;

  const page = app.dataset.page;
  const emptyPanel = (heading, message) => `
    <section class="student-page-panel student-empty-panel">
      <h2>${heading}</h2>
      <p>${message}</p>
    </section>`;

  host.classList.remove('card');
  host.classList.add('student-page-host');

  if (page === 'dashboard') {
    host.innerHTML = `
      <div class="student-dashboard">
        <section class="student-page-panel student-dashboard-notifications">
          <div class="student-dashboard-heading">
            <h2>Notifica&ccedil;&otilde;es Recentes</h2>
            <button type="button" disabled>Marcar todas como lidas</button>
          </div>
          <p class="student-dashboard-empty">Nenhuma notifica&ccedil;&atilde;o recente.</p>
        </section>
        <div class="student-dashboard-side">
          <section class="student-page-panel student-dashboard-section">
            <h2>Pr&oacute;ximas Atividades</h2>
            <p class="student-dashboard-empty">Nenhuma atividade pr&oacute;xima.</p>
          </section>
          <section class="student-page-panel student-dashboard-section">
            <h2>Agenda Geral</h2>
            <p class="student-dashboard-empty">Nenhum evento na agenda.</p>
          </section>
        </div>
      </div>`;
    return;
  }

  if (page === 'notas') {
    host.innerHTML = `<div class="student-page-layout">${emptyPanel('Notas', 'Nenhuma disciplina registrada.')}</div>`;
    return;
  }

  if (page === 'frequencia') {
    host.innerHTML = `<div class="student-page-layout">${emptyPanel('Frequ&ecirc;ncia', 'Nenhuma disciplina registrada.')}</div>`;
    return;
  }

  if (page === 'historico') {
    host.innerHTML = `<div class="student-page-layout">${emptyPanel('Hist&oacute;rico Escolar', 'Nenhuma disciplina no hist&oacute;rico.')}</div>`;
    return;
  }

  if (page === 'avaliar') {
    host.innerHTML = `<div class="student-page-layout">${emptyPanel('Avaliar Professor', 'Nenhum docente para ser avaliado.')}</div>`;
    return;
  }

  if (page === 'contato') {
    host.innerHTML = `
      <div class="contact-layout">
        <section class="student-page-panel contact-compose">
          <h2>Nova Mensagem</h2>
          <form id="contact-form">
            <label for="contact-category">Assunto / Categoria</label>
            <select id="contact-category" required>
              <option value="" selected disabled>Selecione uma categoria</option>
              <option>D&uacute;vida acad&ecirc;mica</option>
              <option>Solicita&ccedil;&atilde;o</option>
              <option>Problema no portal</option>
              <option>Outro assunto</option>
            </select>
            <label for="contact-message">Mensagem</label>
            <textarea id="contact-message" required placeholder="Escreva detalhadamente sua solicita&ccedil;&atilde;o..."></textarea>
            <div class="contact-actions">
              <label class="contact-attach" for="contact-file"><span aria-hidden="true">&#128206;</span> Anexar arquivo</label>
              <input id="contact-file" type="file">
              <button type="submit" class="contact-submit">Enviar Mensagem</button>
            </div>
            <p class="contact-feedback" aria-live="polite"></p>
          </form>
        </section>
        <section class="contact-history">
          <h2>Chamados e Mensagens Anteriores</h2>
          <article class="student-page-panel contact-history-empty">Nenhum chamado anterior.</article>
        </section>
      </div>`;
    const form = host.querySelector('#contact-form');
    const feedback = host.querySelector('.contact-feedback');
    const fileInput = host.querySelector('#contact-file');
    fileInput.addEventListener('change', () => {
      const attach = host.querySelector('.contact-attach');
      attach.lastChild.textContent = fileInput.files[0]?.name || ' Anexar arquivo';
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      feedback.textContent = 'O envio de mensagens ainda não está disponível.';
    });
    return;
  }

  if (page !== 'grade') return;

  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    return { date, label: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '') };
  });
  const dateLabel = date => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
  const hourSlots = Array.from({ length: 16 }, (_, index) => index + 7);
  const header = `<div class="curriculum-corner" aria-hidden="true"></div>${weekdays.map(({ date, label }) => `
    <div class="curriculum-day-heading ${date.toDateString() === today.toDateString() ? 'is-today' : ''}">
      <span>${label}</span><strong>${date.getDate()}</strong>
    </div>`).join('')}`;
  const rows = hourSlots.map(hour => `
    <div class="curriculum-time">${String(hour).padStart(2, '0')}:00</div>
    ${weekdays.map(({ date, label }) => `<div class="curriculum-slot" aria-label="${label}, ${dateLabel(date)}, ${String(hour).padStart(2, '0')}:00 a ${String(hour + 1).padStart(2, '0')}:00"></div>`).join('')}
  `).join('');
  host.innerHTML = `
    <div class="student-page-layout curriculum-page">
      <div class="curriculum-toolbar">
        <div><h2>Grade Curricular</h2></div>
        <button type="button" class="curriculum-add-button">Adicionar mat&eacute;rias</button>
      </div>
      <section class="student-page-panel curriculum-panel" aria-label="Grade semanal">
        <div class="curriculum-grid">
          ${header}
          ${rows}
        </div>
      </section>
    </div>`;
})();
