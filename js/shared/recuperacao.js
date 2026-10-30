document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#recovery-request-form');
  const emailInput = document.querySelector('#email');
  const emailField = document.querySelector('#recovery-email-field');
  const requestButton = document.querySelector('#request-code-button');
  const codeStep = document.querySelector('#recovery-code-step');
  const codeInput = document.querySelector('#recovery-code');
  const newPasswordInput = document.querySelector('#new-password');
  const confirmPasswordInput = document.querySelector('#confirm-password');
  const resetButton = document.querySelector('#reset-password-button');
  const resendButton = document.querySelector('#resend-code-button');
  const emailMessage = document.querySelector('#recovery-email-message');
  const status = document.querySelector('#recovery-status');
  let emailRecuperacao = '';
  let segundosAteReenvio = 0;
  let temporizadorReenvio;

  const mostrarStatus = (mensagem, tipo = '') => {
    status.textContent = mensagem;
    status.dataset.state = tipo;
  };

  const iniciarEsperaReenvio = () => {
    clearInterval(temporizadorReenvio);
    segundosAteReenvio = 60;
    const atualizarBotao = () => {
      resendButton.disabled = segundosAteReenvio > 0;
      resendButton.textContent = segundosAteReenvio > 0
        ? `Aguarde ${segundosAteReenvio}s para pedir outro código`
        : 'Enviar outro código';
      segundosAteReenvio -= 1;
      if (segundosAteReenvio < 0) clearInterval(temporizadorReenvio);
    };

    atualizarBotao();
    temporizadorReenvio = setInterval(atualizarBotao, 1000);
  };

  const enviarCodigo = async () => {
    const email = emailRecuperacao || emailInput.value.trim().toLowerCase();
    if (!email) {
      emailInput.reportValidity();
      return false;
    }

    requestButton.disabled = true;
    resendButton.disabled = true;
    mostrarStatus('Enviando código...');

    try {
      const response = await fetch('/api/auth/recuperacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.mensagem || 'Não foi possível enviar o código.');

      emailRecuperacao = email;
      iniciarEsperaReenvio();
      emailMessage.textContent = `Se ${email} estiver vinculado a uma conta válida, enviaremos um código de recuperação.`;
      emailField.hidden = true;
      requestButton.hidden = true;
      codeStep.hidden = false;
      [codeInput, newPasswordInput, confirmPasswordInput].forEach(input => {
        input.disabled = false;
      });
      codeInput.focus();
      mostrarStatus(data.mensagem || 'Confira sua caixa de entrada e a pasta de spam.');
      return true;
    } catch (erro) {
      mostrarStatus(erro.message, 'error');
      return false;
    } finally {
      requestButton.disabled = false;
      resendButton.disabled = segundosAteReenvio > 0;
    }
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!emailInput.reportValidity()) return;
    emailRecuperacao = emailInput.value.trim().toLowerCase();
    enviarCodigo();
  });

  resendButton.addEventListener('click', async () => {
    const enviado = await enviarCodigo();
    if (enviado) {
      mostrarStatus('Se o endereço estiver vinculado a uma conta válida, confira sua caixa de entrada.');
    }
  });

  resetButton.addEventListener('click', async () => {
    if (![codeInput, newPasswordInput, confirmPasswordInput].every(input => input.reportValidity())) return;
    if (newPasswordInput.value !== confirmPasswordInput.value) {
      confirmPasswordInput.setCustomValidity('As senhas não coincidem.');
      confirmPasswordInput.reportValidity();
      confirmPasswordInput.addEventListener('input', () => confirmPasswordInput.setCustomValidity(''), { once: true });
      return;
    }

    resetButton.disabled = true;
    mostrarStatus('Redefinindo senha...');

    try {
      const response = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailRecuperacao,
          codigo: codeInput.value.trim(),
          novaSenha: newPasswordInput.value
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensagem || 'Não foi possível redefinir a senha.');

      mostrarStatus(data.mensagem, 'success');
      codeStep.hidden = true;
      document.querySelector('#recovery-request-form .login-links').innerHTML =
        '<a href="login.html">Ir para o login</a>';
    } catch (erro) {
      mostrarStatus(erro.message, 'error');
    } finally {
      resetButton.disabled = false;
    }
  });

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
  });
});
