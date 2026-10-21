(() => {
  const app = document.querySelector('#app');
  const host = app?.querySelector('.content > .card');
  if (!host) return;

  const user = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
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
    }
  };
  let settings = loadSettings();

  host.classList.remove('card');
  host.classList.add('settings-host');

  const fontSize = host.querySelector('#font-size');
  const fontSizeValue = host.querySelector('#font-size-value');
  fontSize.value = settings.fontSize;

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
      host.querySelector('#settings-saved').textContent =
        'N\u00e3o foi poss\u00edvel salvar as configura\u00e7\u00f5es neste navegador.';
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
