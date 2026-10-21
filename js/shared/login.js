document.querySelector('#login').addEventListener('submit', async event => {
  event.preventDefault();

  const error = document.querySelector('#error');
  const email = document.querySelector('#email').value.trim().toLowerCase();
  const password = document.querySelector('#senha').value;
  error.textContent = '';

  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha: password })
    });
    const data = await response.json();

    if (!response.ok) {
      error.textContent = data.mensagem || 'N\u00e3o foi poss\u00edvel entrar.';
      return;
    }

    const user = data.usuario;
    const roles = { aluno: 'aluno', professor: 'professor', administrador: 'admin' };
    const role = roles[user.tipo];
    if (!role) {
      error.textContent = 'Tipo de usu\u00e1rio n\u00e3o reconhecido.';
      return;
    }

    sessionStorage.setItem('notadez_user', JSON.stringify({
      tipo: role,
      nome: user.nome,
      email: user.email
    }));

    const dashboards = {
      aluno: 'pages/aluno/dashboard.html',
      professor: 'pages/professor/dashboard.html',
      admin: 'pages/admin/dashboard.html'
    };
    window.location.href = dashboards[role];
  } catch {
    error.textContent = 'N\u00e3o foi poss\u00edvel conectar ao servidor. Tente novamente.';
  }
});
