// Autores:
(() => {
  const app = document.querySelector('#app');
  const host = app?.querySelector('.content > .card');
  if (!host) return;

  const user = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
  const storageKey = `notadez_settings_${user?.email || app.dataset.role}`;
  const defaults = {
    theme: 'light',
    sessionTimeout: 0,
    notifications: {
      comunicados: true,
      notas: true,
      sistema: true,
      chamados: true
    }
  };
  let settings = loadSettings();

  const sessionSelect = host.querySelector('[data-session-timeout]');

  host.classList.remove('card');
  host.classList.add('settings-host');

  host.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.addEventListener('click', () => {
      settings.theme = button.dataset.themeChoice;
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

  if (sessionSelect) {
    sessionSelect.addEventListener('change', () => {
      settings.sessionTimeout = Number(sessionSelect.value);
      updateControls();
      saveSettings();
    });
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const notifications = { ...defaults.notifications };
      Object.keys(notifications).forEach(key => {
        if (typeof saved.notifications?.[key] === 'boolean') notifications[key] = saved.notifications[key];
      });
      return { ...defaults, ...saved, notifications };
    } catch {
      return { ...defaults, notifications: { ...defaults.notifications } };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
      host.querySelector('#settings-saved').textContent = 'Configurações salvas neste navegador.';
    } catch {
      host.querySelector('#settings-saved').textContent =
        'Não foi possível salvar as configurações neste navegador.';
    }
  }

  function applySettings() {
    document.body.classList.toggle('theme-dark', settings.theme === 'dark');
  }

  function updateControls() {
    host.querySelectorAll('[data-theme-choice]').forEach(button => {
      const selected = button.dataset.themeChoice === settings.theme;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    host.querySelectorAll('[data-notification]').forEach(button => {
      const active = Boolean(settings.notifications[button.dataset.notification]);
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
    });
    if (sessionSelect) {
      const valor = String(settings.sessionTimeout);
      const existe = [...sessionSelect.options].some(option => option.value === valor);
      sessionSelect.value = existe ? valor : '0';
    }
    applySettings();
  }

  updateControls();
})();
