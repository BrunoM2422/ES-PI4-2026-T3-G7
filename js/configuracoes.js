(() => {
  const app = document.querySelector('#app');
  const host = app?.querySelector('.content > .card');
  if (!host) return;

  const user = JSON.parse(sessionStorage.getItem('notadez_demo_user') || 'null');
  const storageKey = `notadez_settings_${user?.email || app.dataset.role}`;
  const defaults = {
    theme: 'light',
    fontSize: 14,
    reduceMotion: false,
    showFinanceiro: true,
    notifications: {
      academic: true,
      deadlines: true,
      finance: true,
      email: false,
      access: true,
      online: false
    },
    sessionLength: '8'
  };
  let settings = loadSettings();

  host.classList.remove('card');
  host.classList.add('settings-host');
  host.innerHTML = `
    <div class="settings-page">
      <div class="settings-layout">
        <div class="settings-main-column">
          <section class="settings-card">
            <div class="settings-card-heading">
              <span class="settings-card-icon" aria-hidden="true">&#9681;</span>
              <div><h3>Prefer&ecirc;ncias do Portal</h3><p>Ajuste a apar&ecirc;ncia da plataforma.</p></div>
            </div>
            <div class="settings-row">
              <div class="settings-copy"><strong>Modo de exibi&ccedil;&atilde;o</strong><small>Escolha entre tema claro e escuro.</small></div>
              <div class="settings-segment" role="group" aria-label="Modo de exibi&ccedil;&atilde;o">
                <button type="button" data-theme-choice="light">Claro</button>
                <button type="button" data-theme-choice="dark">Escuro</button>
              </div>
            </div>
            <label class="settings-font-control" for="font-size">
              <span class="settings-copy"><strong>Tamanho da fonte</strong><small>Altere o tamanho do texto nas p&aacute;ginas.</small></span>
              <output id="font-size-value" for="font-size"></output>
              <input id="font-size" type="range" min="12" max="18" step="1">
            </label>
            <div class="settings-row settings-row-last">
              <div class="settings-copy"><strong>Reduzir anima&ccedil;&otilde;es</strong><small>Use menos transi&ccedil;&otilde;es e movimentos.</small></div>
              <button class="settings-switch" type="button" role="switch" data-setting="reduceMotion" aria-label="Reduzir anima&ccedil;&otilde;es"></button>
            </div>
          </section>

          <section class="settings-card">
            <div class="settings-card-heading">
              <span class="settings-card-icon" aria-hidden="true">&#9993;</span>
              <div><h3>Notifica&ccedil;&otilde;es</h3><p>Escolha quais avisos deseja acompanhar.</p></div>
            </div>
            <div class="settings-options">
              <div class="settings-row">
                <div class="settings-copy"><strong>Avisos acad&ecirc;micos</strong><small>Notas, frequ&ecirc;ncia e comunicados.</small></div>
                <button class="settings-switch" type="button" role="switch" data-notification="academic" aria-label="Avisos acad&ecirc;micos"></button>
              </div>
              <div class="settings-row">
                <div class="settings-copy"><strong>Prazos e atividades</strong><small>Lembretes de provas, trabalhos e eventos.</small></div>
                <button class="settings-switch" type="button" role="switch" data-notification="deadlines" aria-label="Prazos e atividades"></button>
              </div>
              <div class="settings-row">
                <div class="settings-copy"><strong>Avisos financeiros</strong><small>Vencimentos e atualiza&ccedil;&otilde;es financeiras.</small></div>
                <button class="settings-switch" type="button" role="switch" data-notification="finance" aria-label="Avisos financeiros"></button>
              </div>
              <div class="settings-row settings-row-last">
                <div class="settings-copy"><strong>Receber avisos por e-mail</strong><small>Envie uma c&oacute;pia das notifica&ccedil;&otilde;es para seu e-mail.</small></div>
                <button class="settings-switch" type="button" role="switch" data-notification="email" aria-label="Receber avisos por e-mail"></button>
              </div>
            </div>
          </section>
        </div>

        <div class="settings-side-column">
          <section class="settings-card">
            <div class="settings-card-heading">
              <span class="settings-card-icon" aria-hidden="true">&#128274;</span>
              <div><h3>Privacidade e acesso</h3><p>Controle a atividade da sua conta.</p></div>
            </div>
            <div class="settings-row">
              <div class="settings-copy"><strong>Alertas de novo acesso</strong><small>Avise-me sobre acessos recentes.</small></div>
              <button class="settings-switch" type="button" role="switch" data-notification="access" aria-label="Alertas de novo acesso"></button>
            </div>
            <div class="settings-row settings-row-last">
              <div class="settings-copy"><strong>Status de atividade</strong><small>Mostrar quando estou usando o portal.</small></div>
              <button class="settings-switch" type="button" role="switch" data-notification="online" aria-label="Status de atividade"></button>
            </div>
            ${app.dataset.role === 'professor' ? `
              <div class="settings-row settings-row-last">
                <div class="settings-copy"><strong>Exibir aba Financeiro</strong><small>Mostrar o acesso financeiro no menu do professor.</small></div>
                <button class="settings-switch" type="button" role="switch" data-setting="showFinanceiro" aria-label="Exibir aba Financeiro"></button>
              </div>
            ` : ''}
          </section>

          <section class="settings-card">
            <div class="settings-card-heading">
              <span class="settings-card-icon" aria-hidden="true">&#9201;</span>
              <div><h3>Sess&atilde;o</h3><p>Defina por quanto tempo deseja permanecer conectado.</p></div>
            </div>
            <label class="settings-select-label" for="session-length">Encerrar sess&atilde;o ap&oacute;s</label>
            <select class="settings-select" id="session-length">
              <option value="1">1 hora</option>
              <option value="4">4 horas</option>
              <option value="8">8 horas</option>
              <option value="24">24 horas</option>
            </select>
            <a class="settings-profile-link" href="perfil.html">Gerenciar dados do perfil <span aria-hidden="true">&rarr;</span></a>
          </section>
        </div>
      </div>
      <p class="settings-saved" id="settings-saved" aria-live="polite"></p>
    </div>
  `;

  const fontSize = host.querySelector('#font-size');
  const fontSizeValue = host.querySelector('#font-size-value');
  const sessionLength = host.querySelector('#session-length');
  fontSize.value = settings.fontSize;
  sessionLength.value = settings.sessionLength;

  host.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.addEventListener('click', () => {
      settings.theme = button.dataset.themeChoice;
      updateControls();
      saveSettings();
    });
  });

  host.querySelectorAll('[data-setting]').forEach(button => {
    button.addEventListener('click', () => {
      settings[button.dataset.setting] = !settings[button.dataset.setting];
      updateControls();
      saveSettings();
    });
  });

  host.querySelectorAll('[data-notification]').forEach(button => {
    button.addEventListener('click', () => {
      const name = button.dataset.notification;
      settings.notifications[name] = !settings.notifications[name];
      updateControls();
      saveSettings();
    });
  });

  fontSize.addEventListener('input', () => {
    settings.fontSize = Number(fontSize.value);
    applySettings();
    updateControls();
    saveSettings();
  });

  sessionLength.addEventListener('change', () => {
    settings.sessionLength = sessionLength.value;
    saveSettings();
  });

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return {
        ...defaults,
        ...saved,
        notifications: { ...defaults.notifications, ...(saved.notifications || {}) }
      };
    } catch {
      return { ...defaults, notifications: { ...defaults.notifications } };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
      host.querySelector('#settings-saved').textContent = 'Configura\u00e7\u00f5es salvas neste navegador.';
    } catch {
      host.querySelector('#settings-saved').textContent = 'N\u00e3o foi poss\u00edvel salvar as configura\u00e7\u00f5es neste navegador.';
    }
    syncFinanceNav();
  }

  function syncFinanceNav() {
    if (app.dataset.role !== 'professor') return;
    const link = document.querySelector('.nav a[href*="financeiro.html"], .nav a[data-finance-nav]');
    if (!link) return;
    link.dataset.financeNav = '1';
    const disabled = settings.showFinanceiro === false;
    link.classList.toggle('disabled', disabled);
    link.href = disabled ? '#' : '../../pages/professor/financeiro.html';
    if (disabled) {
      link.dataset.inactive = '1';
      link.setAttribute('aria-disabled', 'true');
    } else {
      delete link.dataset.inactive;
      link.removeAttribute('aria-disabled');
    }
  }

  function applySettings() {
    document.body.classList.toggle('theme-dark', settings.theme === 'dark');
    document.body.classList.toggle('reduce-motion', settings.reduceMotion);
    document.documentElement.style.setProperty('--font-scale', String(settings.fontSize / 13));
  }

  function updateControls() {
    host.querySelectorAll('[data-theme-choice]').forEach(button => {
      const selected = button.dataset.themeChoice === settings.theme;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    host.querySelectorAll('[data-setting]').forEach(button => {
      const active = Boolean(settings[button.dataset.setting]);
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
    });
    host.querySelectorAll('[data-notification]').forEach(button => {
      const active = Boolean(settings.notifications[button.dataset.notification]);
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
    });
    fontSize.value = settings.fontSize;
    fontSizeValue.textContent = `${settings.fontSize}px`;
    applySettings();
  }

  updateControls();
  syncFinanceNav();
})();
