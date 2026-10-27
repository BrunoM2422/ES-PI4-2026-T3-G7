document.addEventListener('DOMContentLoaded', () => {
  const botaoCadastrar = document.querySelector('.admin-button');
  if (!botaoCadastrar) return;

  botaoCadastrar.addEventListener('click', async () => {
    const codigoInput = document.querySelector('input[name="codigo"]');
    const nomeInput = document.querySelector('input[name="nome"]');
    const unidadeInput = document.querySelector('input[name="unidade"]');
    const grauInput = document.querySelector('select[name="grau"]');
    const modalidadeInput = document.querySelector('select[name="modalidade"]');
    const duracaoInput = document.querySelector('input[name="duracao"]');
    const descricaoInput = document.querySelector('textarea[name="descricao"]');

    const codigo = codigoInput.value.trim();
    const nome = nomeInput.value.trim();
    const unidade = unidadeInput.value.trim();
    const grau = grauInput.value;
    const modalidade = modalidadeInput.value;
    const duracao = Number(duracaoInput.value);

    if (!codigo || !nome || !unidade || !grau || !modalidade || !duracaoInput.value) {
      alert('Preencha os campos obrigatórios do curso.');
      return;
    }

    if (!duracaoInput.checkValidity()) {
      duracaoInput.reportValidity();
      return;
    }

    botaoCadastrar.disabled = true;
    botaoCadastrar.textContent = 'Cadastrando...';

    try {
      const response = await fetch('/api/admin/cursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          nome,
          unidade,
          grau,
          modalidade,
          duracao,
          descricao: descricaoInput.value.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.mensagem || 'Não foi possível cadastrar o curso.');
        return;
      }

      alert(data.mensagem || 'Curso cadastrado com sucesso!');
      window.location.reload();
    } catch (erro) {
      console.error('Erro na requisição:', erro);
      alert('Erro ao conectar com o servidor.');
    } finally {
      botaoCadastrar.disabled = false;
      botaoCadastrar.textContent = 'Cadastrar curso';
    }
  });
});