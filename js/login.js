document.querySelector('#login').addEventListener('submit', async event => {
  event.preventDefault();

  const error = document.querySelector('#error');
  const email = document.querySelector('#email').value
    .trim()
    .toLowerCase();
  const password = document.querySelector('#senha').value;

  error.textContent = '';

  try {
    const response = await fetch(
      'http://localhost:3000/api/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          senha: password
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      error.textContent = data.mensagem || 'Não foi possível entrar.';
      return;
    }

    const user = data.usuario;

    sessionStorage.setItem('notadez_demo_user', JSON.stringify({
      tipo: user.tipo,
      nome: user.nome,
      email: user.email
    }));

    const dashboards = {
      aluno: 'pages/aluno/dashboard.html',
      professor: 'pages/professor/dashboard.html',
      administrador: 'pages/admin/dashboard.html'
    };

    const destino = dashboards[user.tipo];

    if (!destino) {
      sessionStorage.removeItem('notadez_demo_user');
      error.textContent = 'Tipo de usuário não reconhecido.';
      return;
    }

    window.location.href = destino;
  } catch (erro) {
    error.textContent =
      'Não foi possível conectar ao servidor. Tente novamente.';
  }
});

document.querySelector('#help').addEventListener('click', event => {
  event.preventDefault();

  const credentials = document.querySelector('#creds');
  credentials.hidden = !credentials.hidden;
});
