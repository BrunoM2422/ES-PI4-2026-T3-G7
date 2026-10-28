document.addEventListener('DOMContentLoaded', async () => {
  let user;
  try {
    user = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
  } catch {
    user = null;
  }

  if (!user || !user.email) return;

  const inputNome = document.querySelector('input[name="nome"]');
  const inputEmail = document.querySelector('input[name="email"]');
  const inputCelular = document.querySelector('input[name="telefone"]');
  const inputCpf = document.querySelector('input[name="cpf"]');
  const inputEndereco = document.querySelector('input[name="endereco"]');
  const inputDescricao = document.querySelector('textarea');


  try {
    const response = await fetch(`http://localhost:3000/api/perfis?email=${encodeURIComponent(user.email)}`);
    const data = await response.json();

    if (response.ok) {
      const { usuario, detalhes } = data;

      if (inputNome) inputNome.value = usuario.nome || '';
      if (inputEmail) inputEmail.value = usuario.email || '';
      if (inputCpf) inputCpf.value = detalhes.cpf || '';
      if (inputCelular) inputCelular.value = detalhes.telefone || '';
      if (inputEndereco) inputEndereco.value = detalhes.endereco || '';
      if (inputDescricao) inputDescricao.value = detalhes.descricao || '';
    }
  } catch (erro) {
    console.error('Erro ao carregar dados do perfil:', erro);
  }


  const botaoSalvar = document.querySelector('.profile-save');
  if (botaoSalvar) {
    botaoSalvar.addEventListener('click', async () => {
      const telefone = inputCelular ? inputCelular.value.trim() : '';
      const endereco = inputEndereco ? inputEndereco.value.trim() : '';
      const descricao = inputDescricao ? inputDescricao.value.trim() : '';

      try {
        const response = await fetch('http://localhost:3000/api/perfis', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            telefone,
            endereco,
            descricao
          })
        });

        const resultado = await response.json();
        if (response.ok) {
          alert('Alterações salvas com sucesso!');
        } else {
          alert(resultado.mensagem || 'Erro ao salvar alterações.');
        }
      } catch (erro) {
        console.error('Erro na requisição:', erro);
        alert('Não foi possível conectar ao servidor.');
      }
    });
  }
});
