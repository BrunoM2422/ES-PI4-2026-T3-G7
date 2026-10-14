document.querySelector('#login').addEventListener('submit', async event => {
  event.preventDefault();

  const error = document.querySelector('#error');
  const email = document.querySelector('#email').value.trim().toLowerCase();
  const password = document.querySelector('#senha').value;

  try {
    const response = await fetch('usuarios.json');
    if (!response.ok) {
      throw new Error('N\u00e3o foi poss\u00edvel carregar os usu\u00e1rios.');
    }

    const users = await response.json();
    const user = users.find(item => item.email === email && item.senha === password);

    if (!user) {
      error.textContent = 'E-mail ou senha incorretos.';
      return;
    }

    sessionStorage.setItem('notadez_demo_user', JSON.stringify({
      tipo: user.tipo,
      nome: user.nome,
      email: user.email
    }));

    window.location.href = `pages/${user.tipo}/dashboard.html`;
  } catch {
    error.textContent = 'N\u00e3o foi poss\u00edvel carregar usuarios.json. Inicie o servidor local.';
  }
});

document.querySelector('#help').addEventListener('click', event => {
  event.preventDefault();
  const credentials = document.querySelector('#creds');
  credentials.hidden = !credentials.hidden;
});
