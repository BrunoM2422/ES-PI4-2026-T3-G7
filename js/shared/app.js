// Autores: Bruno Machado — RA: 25008041; Luca Filippi — RA: 25022556
const originalFetch = window.fetch.bind(window);
window.formatarCodigoTurmaDisciplina = (codigoTurma, codigoDisciplina) => {
  const turma = String(codigoTurma ?? '').trim();
  const disciplina = String(codigoDisciplina ?? '').trim();
  const legado = Number(turma.slice(-2));
  const letra = /^[0-9]{4}[ABC]$/i.test(turma) ? turma.slice(-1).toUpperCase()
    : legado >= 1 && legado <= 3 ? String.fromCharCode(64 + legado) : '';
  return turma && disciplina && letra ? `${disciplina}${letra}` : turma;
};
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

  const token = sessionStorage.getItem('notadez_token');
  if (!user || user.tipo !== role || !token) {
    sessionStorage.removeItem('notadez_user');
    sessionStorage.removeItem('notadez_token');
    window.location.href = '../../login.html';
    return;
  }

  try {
    const response = await fetch('/api/auth/sessao', { headers: { Authorization: `Bearer ${token}` } });
    const sessao = response.ok ? await response.json() : null;
    if (!sessao || sessao.usuario?.tipo !== role || sessao.usuario?.email !== user.email) {
      throw new Error('Sessão inválida ou expirada.');
    }
    if (role === 'admin') {
      user.nivelPermissao = sessao.usuario.nivelPermissao || 'admin_mestre';
      user.cursoId = sessao.usuario.cursoId || null;
      sessionStorage.setItem('notadez_user', JSON.stringify(user));
    }
  } catch {
    sessionStorage.removeItem('notadez_user');
    sessionStorage.removeItem('notadez_token');
    window.location.replace('../../login.html');
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
  const cursoAdmin = user.cursoId || null;
  const paginasAdmin3 = ['dashboard', 'chamados', 'contato', 'configuracoes', 'trancar-matricula'];
  const paginasAdmin2 = ['dashboard', 'calendario', 'adicionar-alunos', 'adicionar-docente', 'adicionar-disciplina', 'adicionar-turma', 'gerenciar-turmas', 'gerenciar-docentes', 'gerenciar-cursos-disciplinas', 'organizacao-horarios', 'organizacao-turmas', 'gerenciamento-opcoes', 'logs', 'configuracoes', 'contato', 'chamados'];
  const adminSemAcessoPagina = role === 'admin' && (nivelAdmin === 'admin_3' ? !paginasAdmin3.includes(page) : nivelAdmin === 'admin_2' && (!cursoAdmin || !paginasAdmin2.includes(page)));
  if (adminSemAcessoPagina) {
    window.location.replace('../../pages/admin/dashboard.html');
    return;
  }

  let opcoesAluno = { avaliacaoProfessores: false, gradeCurricular: false };
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
      ? 'avaliacaoProfessores'
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
        { page: 'avaliar', opcao: 'avaliacaoProfessores' },
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

    if (role === 'admin' && nivelAdmin === 'admin_2') {
      const bloqueadas = ['adicionar-curso', 'adicionar-administrador', 'cancelar-matricula', 'servidor'];
      app.querySelectorAll('[data-nav-page]').forEach(link => {
        if (!bloqueadas.includes(link.dataset.navPage)) return;
        link.closest('.nav-group')?.classList.add('admin-nav-hidden');
        link.remove();
      });
      app.querySelector('[data-equivalencia-entry]')?.remove();
    }
    if (role === 'admin' && nivelAdmin === 'admin_3') {
      app.querySelectorAll('[data-nav-page]').forEach(link => {
        if (!['dashboard', 'chamados', 'contato', 'configuracoes', 'trancar-matricula'].includes(link.dataset.navPage)) link.remove();
      });
      app.querySelectorAll('.nav-admin .nav-group').forEach(group => { if (!group.querySelector('[data-nav-page]')) group.remove(); });
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
    const dashboardLink = app.querySelector('[data-dashboard-link]');
    if (dashboardLink) dashboardLink.href = `../../pages/${role}/dashboard.html`;
    app.querySelectorAll('[data-logout]').forEach(button => {
      button.addEventListener('click', () => {
        sessionStorage.removeItem('notadez_user');
        sessionStorage.removeItem('notadez_token');
        window.location.replace('../../login.html');
      });
    });
    app.querySelectorAll('[data-profile-link]').forEach(link => {
      link.href = role === 'admin' ? '../../pages/admin/dashboard.html' : `../../pages/${role}/perfil.html`;
    });
 
    const atualizarAvatar = origem => {
      const imagem = document.querySelector('[data-profile-avatar]');
      const link = imagem ? imagem.closest('a') : null;
      const padrao = link ? link.querySelector('svg') : document.querySelector('.header-avatar-link svg');

      if (!imagem) return;

      if (origem) {
        imagem.onerror = () => {
          console.error('A imagem de perfil recebida não pôde ser exibida.');
          atualizarAvatar(''); // Volta para o padrão se der erro no link
        };
        
        imagem.alt = `Foto de ${user.nome || 'perfil'}`;
        imagem.src = origem;
        
        imagem.style.display = 'block';
        imagem.hidden = false;
        
        if (padrao) {
          padrao.style.display = 'none';
          padrao.hidden = true;
        }
      } else {
        imagem.removeAttribute('src');
        imagem.style.display = 'none';
        imagem.hidden = true;
        
        if (padrao) {
          padrao.style.display = 'block';
          padrao.hidden = false;
        }
      }
    };
    
    window.atualizarAvatarCabecalho = atualizarAvatar;

    const carregarFotoPerfil = (forcarNovo = false) => {
      if (role !== 'aluno' && role !== 'professor') return;
      const versao = forcarNovo ? Date.now() : (sessionStorage.getItem('notadez_foto_versao') || Date.now());
      if (forcarNovo) sessionStorage.setItem('notadez_foto_versao', versao);
      
      const consulta = new URLSearchParams({ email: user.email || '', v: versao });
      atualizarAvatar(`/api/perfis/foto?${consulta}`);
    };

    document.addEventListener('notadez:foto-perfil-atualizada', (event) => {
      if (event.detail && typeof event.detail.foto === 'string' && event.detail.foto.startsWith('data:image')) {
        atualizarAvatar(event.detail.foto);
      } else {
        carregarFotoPerfil(true); // Força recarregar quebrando o cache
      }
    });

    if (role === 'aluno' || role === 'professor') {
      carregarFotoPerfil();
    }
    
    const pageTitle = app.querySelector('[data-page-title]');
    if (pageTitle) pageTitle.textContent = app.dataset.title || '';
    app.querySelectorAll('[data-nav-page]').forEach(link => {
      if (link.dataset.navPage === page) link.classList.add('active');
    });

    if (role === 'admin') {
      app.querySelectorAll('.nav-admin .nav-group').forEach(group => {
        const toggle = group.querySelector('button.nav-section-label');
        const containsCurrentPage = Boolean(group.querySelector(`[data-nav-page="${page}"]`));
        group.classList.toggle('is-open', containsCurrentPage);
        toggle?.setAttribute('aria-expanded', String(containsCurrentPage));
        toggle?.addEventListener('click', () => {
          const isOpen = group.classList.toggle('is-open');
          toggle.setAttribute('aria-expanded', String(isOpen));
        });
      });
    }

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


(() => {
  const CHAVE_ATIVIDADE = 'notadez_atividade';
  const EVENTOS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
  const VERIFICAR_A_CADA = 15000;
  const AVISO_ANTES = 60000;

  const assinatura = () => (sessionStorage.getItem('notadez_token') || '').slice(-12);

  function limiteDeInatividade() {
    let usuario = null;
    try {
      usuario = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
    } catch {
      usuario = null;
    }
    const papel = document.querySelector('#app')?.dataset.role;
    try {
      const salvo = JSON.parse(localStorage.getItem(`notadez_settings_${usuario?.email || papel}`) || '{}');
      const minutos = Number(salvo.sessionTimeout);
      return Number.isFinite(minutos) && minutos > 0 ? minutos * 60000 : 0;
    } catch {
      return 0;
    }
  }

  function lerUltimaAtividade() {
    const [assin, instante] = (sessionStorage.getItem(CHAVE_ATIVIDADE) || '').split(':');
    return assin === assinatura() && Number(instante) ? Number(instante) : Date.now();
  }

  let ultima = lerUltimaAtividade();
  let ultimoRegistro = 0;
  let avisou = false;

  function guardar() {
    sessionStorage.setItem(CHAVE_ATIVIDADE, `${assinatura()}:${ultima}`);
  }

  function registrarAtividade() {
    const agora = Date.now();
    ultima = agora;
    avisou = false;
    if (agora - ultimoRegistro > 5000) {
      ultimoRegistro = agora;
      guardar();
    }
  }

  function encerrar() {
    sessionStorage.removeItem('notadez_user');
    sessionStorage.removeItem('notadez_token');
    sessionStorage.removeItem(CHAVE_ATIVIDADE);
    window.location.replace('../../login.html?motivo=inatividade');
  }

  function verificar() {
    if (!sessionStorage.getItem('notadez_token')) return;
    const limite = limiteDeInatividade();
    if (!limite) return;

    const ocioso = Date.now() - ultima;
    if (ocioso >= limite) {
      encerrar();
    } else if (!avisou && limite - ocioso <= AVISO_ANTES) {
      avisou = true;
      window.showAppMessage?.('Sua sessão será encerrada em 1 minuto por inatividade.', 'error');
    }
  }

  if (sessionStorage.getItem('notadez_token')) guardar();
  EVENTOS.forEach(nome => window.addEventListener(nome, registrarAtividade, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verificar(); });
  window.setInterval(verificar, VERIFICAR_A_CADA);
  verificar();
})();
