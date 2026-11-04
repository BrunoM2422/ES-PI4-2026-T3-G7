(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const feedback = form.querySelector('.contact-feedback');
  const fileInput = form.querySelector('#contact-file');
  fileInput.addEventListener('change', () => {
    const attach = form.querySelector('.contact-attach');
    attach.lastChild.textContent = fileInput.files[0]?.name || ' Anexar arquivo';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!window.validateAppForm(form)) return;
    feedback.textContent = 'O envio de mensagens ainda não está disponível.';
  });
})();
