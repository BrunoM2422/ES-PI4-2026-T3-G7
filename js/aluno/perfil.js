(() => {
  const host = document.querySelector('#app .profile-host');
  if (!host) return;

  host.querySelectorAll('[data-password-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const input = button.parentElement.querySelector('input');
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(showPassword));
      button.setAttribute('aria-label', showPassword ? 'Ocultar senha atual' : 'Mostrar senha atual');
      button.title = showPassword ? 'Ocultar senha' : 'Mostrar senha';
    });
  });
})();
