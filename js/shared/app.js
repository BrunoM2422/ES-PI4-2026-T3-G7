const originalFetch = window.fetch.bind(window);
window.fetch = (input, options = {}) => {
  const url = new URL(input instanceof Request ? input.url : input, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input, options);
  const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
  const token = sessionStorage.getItem('notadez_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return originalFetch(input, { ...options, headers }).then(response => {
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      response.clone().json().then(data => {
        if (data.avisoLog) window.showAppMessage(data.avisoLog, 'error');
      }).catch(() => {});
    }
    return response;
  });
};

window.showAppMessage = (message, type = 'info') => {
  if (!document.body) return;
  let region = document.querySelector('#app-message-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'app-message-region';
    region.className = 'app-message-region';
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const toast = document.createElement('div');
  toast.className = `app-message app-message-${type === 'error' ? 'error' : 'info'}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = String(message ?? '');
  region.replaceChildren(toast);
  window.clearTimeout(region.dismissTimer);
  region.dismissTimer = window.setTimeout(() => toast.remove(), 6000);
};

window.validateAppField = field => {
  if (!field || field.checkValidity()) return true;
  window.showAppMessage(field.validationMessage || 'Confira este campo.', 'error');
  field.focus();
  return false;
};

window.validateAppFields = fields => {
  for (const field of fields) {
    if (!window.validateAppField(field)) return false;
  }
  return true;
};

window.validateAppForm = form => {
  if (!form || form.checkValidity()) return true;
  return window.validateAppField(form.querySelector(':invalid'));
};

window.confirmAppAction = (message, title = 'Confirmar ação') => new Promise(resolve => {
  const backdrop = document.createElement('div');
  backdrop.className = 'app-confirm-backdrop';
  backdrop.innerHTML = '<section class="app-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-confirm-title" aria-describedby="app-confirm-message"><span class="app-confirm-icon" aria-hidden="true">!</span><h2 id="app-confirm-title"></h2><p id="app-confirm-message"></p><div class="app-confirm-actions"><button type="button" class="admin-button-secondary" data-cancel>Cancelar</button><button type="button" class="catalog-delete-button" data-confirm>Confirmar</button></div></section>';
  backdrop.querySelector('#app-confirm-title').textContent = title;
  backdrop.querySelector('#app-confirm-message').textContent = message;
  document.body.append(backdrop);
  const cancel = backdrop.querySelector('[data-cancel]');
  const finish = value => {
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
    resolve(value);
  };
  const onKeyDown = event => { if (event.key === 'Escape') finish(false); };
  cancel.addEventListener('click', () => finish(false));
  backdrop.querySelector('[data-confirm]').addEventListener('click', () => finish(true));
  backdrop.addEventListener('click', event => { if (event.target === backdrop) finish(false); });
  document.addEventListener('keydown', onKeyDown);
  cancel.focus();
});

(async () => {
  const app = document.querySelector('#app');
  if (!app) return;

  const { role, page } = app.dataset;
  const scriptUrl = document.currentScript.src;
  let user;
  try {
    user = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
  } catch {
    user = null;
  }

  if (!user || user.tipo !== role || !sessionStorage.getItem('notadez_token')) {
    sessionStorage.removeItem('notadez_user');
    sessionStorage.removeItem('notadez_token');
    window.location.href = '../../login.html';
    return;
  }

  const paginasAlunoTrancado = ['perfil', 'contato', 'historico', 'financeiro'];
  if (role === 'aluno') {
    try {
      const response = await fetch(`/api/perfis?email=${encodeURIComponent(user.email || '')}`);
      if (response.ok) {
        const data = await response.json();
        user.statusAcademico = data.usuario?.statusAcademico || 'ativo';
        sessionStorage.setItem('notadez_user', JSON.stringify(user));
      }
    } catch (erro) {
      console.error('Não foi possível atualizar a situação acadêmica do aluno:', erro);
    }

    if (user.statusAcademico === 'trancado' && !paginasAlunoTrancado.includes(page)) {
      window.location.replace('../../pages/aluno/perfil.html');
      return;
    }
  }

  const nivelAdmin = user.nivelPermissao || 'admin_mestre';
  const adminRestrito = role === 'admin' && nivelAdmin !== 'admin_mestre';
  if (adminRestrito && !['dashboard', 'logs'].includes(page)) {
    window.location.replace('../../pages/admin/dashboard.html');
    return;
  }

  let opcoesAluno = { avaliacao: false, gradeCurricular: false };
  if (role === 'aluno') {
    try {
      const response = await fetch('/api/opcoes?email=' + encodeURIComponent(user.email || ''));
      if (!response.ok) throw new Error('Não foi possível carregar as opções do sistema.');
      const data = await response.json();
      opcoesAluno = { ...opcoesAluno, ...(data.opcoes || {}) };
    } catch (erro) {
      console.error('Erro ao verificar liberações para alunos:', erro);
    }

    const opcaoDaPagina = page === 'avaliar'
      ? 'avaliacao'
      : page === 'grade'
        ? 'gradeCurricular'
        : null;
    if (opcaoDaPagina && !opcoesAluno[opcaoDaPagina]) {
      window.location.replace('../../pages/aluno/dashboard.html');
      return;
    }
  }

  const settingsKey = 'notadez_settings_' + (user.email || role);
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
  } catch {
    settings = {};
  }
  if (role === 'professor') {
    try {
      const response = await fetch(`/api/perfis?email=${encodeURIComponent(user.email)}`);
      if (response.ok) {
        const data = await response.json();
        settings.showFinanceiro = data.usuario.showFinanceiro;
        localStorage.setItem(settingsKey, JSON.stringify(settings));
      }
    } catch (erro) { console.error('Falha ao carregar preferência do financeiro.'); }
  }
  if (role === 'professor' && page === 'financeiro' && settings.showFinanceiro === false) {
    window.location.href = '../../pages/professor/dashboard.html';
    return;
  }
  document.body.classList.toggle('theme-dark', settings.theme === 'dark');
  document.body.classList.toggle('reduce-motion', Boolean(settings.reduceMotion));
  document.documentElement.style.setProperty('--font-scale', String(settings.fontSize ? settings.fontSize / 13 : 1));

  const componentBase = new URL('../../components/', scriptUrl);
  Promise.all(['sidebar.html', 'header.html', 'footer.html'].map(async file => {
    const response = await fetch(new URL(file, componentBase));
    if (!response.ok) throw new Error(`Não foi possível carregar ${file}`);
    return response.text();
  })).then(([sidebarMarkup, headerMarkup, footerMarkup]) => {
    const sidebarDocument = new DOMParser().parseFromString(sidebarMarkup, 'text/html');
    const sidebarTemplate = sidebarDocument.getElementById(`sidebar-${role}`);
    const sidebarSlot = app.querySelector('[data-component="sidebar"]');
    if (!sidebarTemplate || !sidebarSlot) throw new Error(`Componente de navegação ausente para ${role}`);
    sidebarSlot.replaceChildren(sidebarTemplate.content.cloneNode(true));

    if (role === 'aluno') {
      const acessos = [
        { page: 'avaliar', opcao: 'avaliacao' },
        { page: 'grade', opcao: 'gradeCurricular' }
      ];
      acessos.forEach(({ page: pagina, opcao }) => {
        const link = app.querySelector(`[data-nav-page="${pagina}"]`);
        if (link && !opcoesAluno[opcao]) {
          link.href = '#';
          link.classList.add('disabled');
          link.setAttribute('aria-disabled', 'true');
          link.tabIndex = -1;
          link.title = 'Indisponível até liberação pelo administrador.';
          link.addEventListener('click', event => event.preventDefault());
        }
      });

      if (user.statusAcademico === 'trancado') {
        app.querySelectorAll('[data-nav-page]').forEach(link => {
          if (paginasAlunoTrancado.includes(link.dataset.navPage)) return;
          link.href = '#';
          link.classList.add('disabled');
          link.setAttribute('aria-disabled', 'true');
          link.tabIndex = -1;
          link.title = 'Acesso indisponível durante o trancamento da matrícula.';
          link.addEventListener('click', event => event.preventDefault());
        });
      }
    }

    if (adminRestrito) {
      app.querySelectorAll('[data-nav-page]').forEach(link => {
        if (['dashboard', 'logs'].includes(link.dataset.navPage)) return;
        link.href = '#';
        link.classList.add('disabled');
        link.setAttribute('aria-disabled', 'true');
        link.tabIndex = -1;
        link.title = 'Esta opção ainda não foi liberada para este nível de administrador.';
        link.addEventListener('click', event => event.preventDefault());
      });
    }

    const insertFragment = (markup, selector) => {
      const parsed = new DOMParser().parseFromString(markup, 'text/html');
      const slot = app.querySelector(`[data-component="${selector}"]`);
      if (!slot) throw new Error(`Espaço do componente ${selector} ausente`);
      slot.replaceWith(...parsed.body.childNodes);
    };
    insertFragment(headerMarkup, 'header');
    insertFragment(footerMarkup, 'footer');

    app.querySelectorAll('[data-user-name]').forEach(element => {
      element.textContent = user.nome || 'Usuário';
    });
    app.querySelectorAll('[data-profile-link]').forEach(link => {
      link.href = role === 'admin' ? '../../pages/admin/dashboard.html' : `../../pages/${role}/perfil.html`;
    });
    const atualizarAvatar = origem => {
      const link = app.querySelector('.header-avatar-link');
      if (!link) return;
      const imagem = link.querySelector('[data-profile-avatar]');
      const padrao = link.querySelector('svg');
      if (!imagem || !padrao) return;
      if (origem) {
        imagem.onerror = () => {
          console.error('A imagem de perfil recebida não pôde ser exibida.');
          atualizarAvatar('');
        };
        imagem.alt = `Foto de ${user.nome || 'perfil'}`;
        imagem.src = origem;
        imagem.hidden = false;
        padrao.hidden = true;
      } else {
        imagem.removeAttribute('src');
        imagem.hidden = true;
        padrao.hidden = false;
      }
    };
    const carregarFotoPerfil = () => {
      if (role !== 'aluno' && role !== 'professor') return;
      const consulta = new URLSearchParams({ email: user.email || '', versao: String(Date.now()) });
      atualizarAvatar(`/api/perfis/foto?${consulta}`);
    };
    document.addEventListener('notadez:foto-perfil-atualizada', carregarFotoPerfil);
    if (role === 'aluno' || role === 'professor') {
      carregarFotoPerfil();
    }
    const pageTitle = app.querySelector('[data-page-title]');
    if (pageTitle) pageTitle.textContent = app.dataset.title || '';
    app.querySelectorAll('[data-nav-page]').forEach(link => {
      if (link.dataset.navPage === page) link.classList.add('active');
    });

    if (role === 'professor') {
      const financeLink = app.querySelector('[data-finance-nav]');
      if (financeLink && settings.showFinanceiro === false) {
        financeLink.href = '#';
        financeLink.classList.add('disabled');
        financeLink.setAttribute('aria-disabled', 'true');
        financeLink.addEventListener('click', event => event.preventDefault());
      }
    }
  }).catch(error => console.error('Erro ao carregar componentes compartilhados:', error));
})();
