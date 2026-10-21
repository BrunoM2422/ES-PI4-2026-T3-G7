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
    feedback.textContent = 'O envio de mensagens ainda n\u00e3o est\u00e1 dispon\u00edvel.';
  });
})();
