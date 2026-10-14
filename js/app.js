const app = document.querySelector('#app');

if (!app) {
  throw new Error('Elemento #app n\u00e3o encontrado.');
}

const { role, page, title } = app.dataset;

const navs = {
  aluno: [
    ['dashboard', '\u25a6', 'Dashboard', 'dashboard'],
    ['notas', '\u25a4', 'Notas', 'notas'],
    ['calendario', '\u25f7', 'Calend\u00e1rio', 'calendario'],
    ['frequencia', '\u2713', 'Frequ\u00eancia', 'frequencia'],
    ['grade', '\u25c7', 'Grade Curricular', 'grade'],
    ['historico', '\u25f4', 'Hist\u00f3rico', 'historico'],
    ['financeiro', '$', 'Financeiro', 'financeiro'],
    ['avaliar', '\u2606', 'Avaliar Professor', 'avaliar'],
    ['contato', '\u2709', 'Contato', 'contato'],
    ['configuracoes', '\u2699', 'Configura\u00e7\u00f5es', 'configuracoes'],
    ['perfil', '\u25cf', 'Meu Perfil', 'perfil']
  ],
  professor: [
    ['dashboard', '\u25a6', 'Dashboard', 'dashboard'],
    ['turmas', '\u2667', 'Minhas Turmas', 'turmas'],
    ['notas', '\u25a4', 'Notas', 'notas'],
    ['calendario', '\u25f7', 'Calend\u00e1rio', 'calendario'],
    ['frequencia', '\u2713', 'Frequ\u00eancia', 'frequencia'],
    ['horarios', '\u25f7', 'Hor\u00e1rios', 'horarios'],
    ['financeiro', '$', 'Financeiro', 'financeiro'],
    ['perfil', '\u25cf', 'Perfil', 'perfil'],
    ['configuracoes', '\u2699', 'Configura\u00e7\u00f5es', 'configuracoes'],
    ['auditoria', '\u25c7', 'Auditoria/Log', 'auditoria']
  ],
  admin: [
    ['dashboard', '\u25a6', 'Dashboard', 'dashboard']
  ]
};

if (!navs[role]) {
  throw new Error(`Papel inv\u00e1lido: ${role || 'n\u00e3o informado'}.`);
}

let storedUser;
try {
  storedUser = JSON.parse(sessionStorage.getItem('notadez_demo_user') || 'null');
} catch {
  storedUser = null;
}

if (!storedUser || storedUser.tipo !== role) {
  window.location.href = '../../login.html';
  throw new Error('Acesso n\u00e3o autorizado.');
}

const settingsKey = `notadez_settings_${storedUser.email || role}`;
let savedSettings = {};
try {
  savedSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
} catch {
  savedSettings = {};
}
document.body.classList.toggle('theme-dark', savedSettings.theme === 'dark');
document.body.classList.toggle('reduce-motion', Boolean(savedSettings.reduceMotion));
document.documentElement.style.setProperty('--font-scale', String(savedSettings.fontSize ? savedSettings.fontSize / 13 : 1));

if (role === 'professor' && page === 'financeiro' && savedSettings.showFinanceiro === false) {
  window.location.href = '../../pages/professor/dashboard.html';
  throw new Error('A aba Financeiro est\u00e1 desabilitada.');
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);
const displayName = escapeHtml(storedUser.nome || 'Usuário');
const displayEmail = escapeHtml(storedUser.email || '');
const profilePath = `../../pages/${role}/perfil.html`;
const avatar = `
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="22" r="12" fill="currentColor" opacity=".78"/>
    <path d="M10 58c1-13 10-21 22-21s21 8 22 21" fill="currentColor" opacity=".56"/>
  </svg>
`;

const navigation = navs[role].map(([id, icon, label, target]) => `
  <a class="${target === page || id === page ? 'active' : ''} ${id === 'financeiro' && role === 'professor' && savedSettings.showFinanceiro === false ? 'disabled' : ''}"
     href="${target && !(id === 'financeiro' && role === 'professor' && savedSettings.showFinanceiro === false) ? `../../pages/${role}/${target}.html` : '#'}"
     ${id === 'financeiro' && role === 'professor' ? 'data-finance-nav="1"' : ''}
     ${target && !(id === 'financeiro' && role === 'professor' && savedSettings.showFinanceiro === false) ? '' : 'data-inactive="1" aria-disabled="true"'}>
    <span class="nav-icon" aria-hidden="true">${icon}</span>
    <span>${label}</span>
  </a>
`).join('');

app.innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand">
        <a class="brand-link" href="../../login.html" aria-label="Ir para o login">
          <i aria-hidden="true">\u2726</i>
        </a>
        <span>NotaDez</span>
      </div>
      <nav class="nav" aria-label="Navega\u00e7\u00e3o principal">${navigation}</nav>
      <div class="user">
        <a class="user-avatar-link" href="${profilePath}" aria-label="Abrir perfil de ${displayName}">${avatar}</a>
        <div class="user-details">
          <b>${displayName}</b>
          <small>${displayEmail}</small>
        </div>
      </div>
    </aside>
    <main class="main">
      <header class="top">
        <div class="page-heading">
          <a class="header-mark" href="../../login.html" aria-label="Voltar para o login">\u2726</a>
          <h1>${title || ''}</h1>
        </div>
        <div class="header-account">
          <span>${displayName}</span>
          <a class="header-avatar-link" href="${profilePath}" aria-label="Abrir perfil de ${displayName}">${avatar}</a>
        </div>
      </header>
      <section class="content">
        <article class="card"></article>
      </section>
      <footer class="footer">\u00a9 2026 NotaDez Academic System.</footer>
    </main>
  </div>
`;

document.querySelectorAll('[data-inactive]').forEach(link => {
  link.addEventListener('click', event => {
    if (link.hasAttribute('data-inactive')) event.preventDefault();
  });
});
