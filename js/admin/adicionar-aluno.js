document.addEventListener('DOMContentLoaded', () => {
  const botaoCadastrar = document.querySelector('.admin-button');
  if (!botaoCadastrar) return;

  botaoCadastrar.addEventListener('click', async () => {
    const nome = document.querySelector('input[name="nome"]').value.trim();
    const email = document.querySelector('input[name="email"]').value.trim().toLowerCase();
    const cpf = document.querySelector('input[name="cpf"]').value.trim();
    const telefone = document.querySelector('input[name="telefone"]').value.trim();
    const endereco = document.querySelector('input[name="endereco"]').value.trim();
    const instituicao = document.querySelector('input[name="instituicao"]').value.trim();

    if (!nome || !email || !cpf) {
      alert('Preencha os campos obrigatórios (Nome, E-mail e CPF).');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/admin/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          cpf,
          telefone,
          endereco,
          tipo: 'estudante',
          instituicao
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.mensagem || 'Não foi possível cadastrar o aluno.');
        return;
      }

      alert('Aluno cadastrado com sucesso!');
      window.location.reload();
    } catch (erro) {
      console.error('Erro na requisição:', erro);
      alert('Erro ao conectar com o servidor.');
    }
  });
});
