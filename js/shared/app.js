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

  if (!user || user.tipo !== role) {
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
      console.error('N\u00e3o foi poss\u00edvel atualizar a situa\u00e7\u00e3o acad\u00eamica do aluno:', erro);
    }

    if (user.statusAcademico === 'trancado' && !paginasAlunoTrancado.includes(page)) {
      window.location.replace('../../pages/aluno/perfil.html');
      return;
    }
  }

  const nivelAdmin = user.nivelPermissao || 'admin_mestre';
  const adminRestrito = role === 'admin' && nivelAdmin !== 'admin_mestre';
  if (adminRestrito && page !== 'dashboard') {
    window.location.replace('../../pages/admin/dashboard.html');
    return;
  }

  let opcoesAluno = { avaliacao: false, gradeCurricular: false };
  if (role === 'aluno') {
    try {
      const response = await fetch('/api/opcoes');
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
    if (!response.ok) throw new Error(`N\u00e3o foi poss\u00edvel carregar ${file}`);
    return response.text();
  })).then(([sidebarMarkup, headerMarkup, footerMarkup]) => {
    const sidebarDocument = new DOMParser().parseFromString(sidebarMarkup, 'text/html');
    const sidebarTemplate = sidebarDocument.getElementById(`sidebar-${role}`);
    const sidebarSlot = app.querySelector('[data-component="sidebar"]');
    if (!sidebarTemplate || !sidebarSlot) throw new Error(`Componente de navega\u00e7\u00e3o ausente para ${role}`);
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
          link.title = 'Acesso indispon\u00edvel durante o trancamento da matr\u00edcula.';
          link.addEventListener('click', event => event.preventDefault());
        });
      }
    }

    if (adminRestrito) {
      app.querySelectorAll('[data-nav-page]').forEach(link => {
        if (link.dataset.navPage === 'dashboard') return;
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
      if (!slot) throw new Error(`Espa\u00e7o do componente ${selector} ausente`);
      slot.replaceWith(...parsed.body.childNodes);
    };
    insertFragment(headerMarkup, 'header');
    insertFragment(footerMarkup, 'footer');

    app.querySelectorAll('[data-user-name]').forEach(element => {
      element.textContent = user.nome || 'Usu\u00e1rio';
    });
    app.querySelectorAll('[data-user-email]').forEach(element => {
      element.textContent = user.email || '';
    });
    app.querySelectorAll('[data-profile-link]').forEach(link => {
      link.href = role === 'admin' ? '../../pages/admin/dashboard.html' : `../../pages/${role}/perfil.html`;
    });
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
