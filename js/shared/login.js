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
      error.textContent = data.mensagem || 'Não foi possível entrar.';
      return;
    }

    const user = data.usuario;
    const roles = { aluno: 'aluno', professor: 'professor', administrador: 'admin' };
    const role = roles[user.tipo];
    if (!role) {
      error.textContent = 'Tipo de usuário não reconhecido.';
      return;
    }

    sessionStorage.setItem('notadez_user', JSON.stringify({
      tipo: role,
      nome: user.nome,
      email: user.email,
      nivelPermissao: user.nivelPermissao || null,
      statusAcademico: user.statusAcademico || 'ativo'
    }));

    const dashboards = {
      aluno: 'pages/aluno/dashboard.html',
      professor: 'pages/professor/dashboard.html',
      admin: 'pages/admin/dashboard.html'
    };
    window.location.href = role === 'aluno' && user.statusAcademico === 'trancado'
      ? 'pages/aluno/perfil.html'
      : dashboards[role];
  } catch {
    error.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
  }
});
