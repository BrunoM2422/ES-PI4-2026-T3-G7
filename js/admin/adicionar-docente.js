// Autores:
// Gabriel Scolfaro de Azeredo - 25006194
document.addEventListener('DOMContentLoaded', () => {
  const botaoCadastrar = document.querySelector('.admin-button');
  if (!botaoCadastrar) return;

  const campoNome = document.querySelector('input[name="nome"]');
  const campoEmail = document.querySelector('input[name="email"]');
  window.NotaDezValidacaoBrasil.vincularCampos(document);
  window.NotaDezEmailSugerido.vincular(campoNome, campoEmail, 'docente');

  botaoCadastrar.addEventListener('click', async () => {
    const nome = document.querySelector('input[name="nome"]').value.trim();
    const email = document.querySelector('input[name="email"]').value.trim().toLowerCase();
    const cpf = document.querySelector('input[name="cpf"]').value.trim();
    const telefone = document.querySelector('input[name="telefone"]').value.trim();
    const especialidade = document.querySelector('input[name="especialidade"]').value.trim();
    const instituicao = document.querySelector('input[name="instituicao"]').value.trim();

    if (!window.NotaDezValidacaoBrasil.validarCpf(cpf)) {
      window.showAppMessage('Informe um CPF válido.');
      document.querySelector('input[name="cpf"]').focus();
      return;
    }
    if (!window.NotaDezValidacaoBrasil.validarTelefone(telefone)) {
      window.showAppMessage('Informe um telefone brasileiro válido com DDD.');
      document.querySelector('input[name="telefone"]').focus();
      return;
    }

    if (!nome || !email || !cpf || !especialidade) {
      window.showAppMessage('Preencha os campos obrigatórios (Nome, E-mail, CPF e Especialidade).');
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
          especialidade,
          telefone,
          tipo: 'professor',
          instituicao
        })
      });

      const data = await response.json();

      if (!response.ok) {
        window.showAppMessage(data.mensagem || 'Não foi possível cadastrar o docente.');
        return;
      }

      window.showAppMessage('Docente cadastrado com sucesso!');
      ['nome', 'email', 'cpf', 'telefone', 'especialidade', 'instituicao'].forEach(name => {
        const field = document.querySelector(`[name="${name}"]`);
        if (field) field.value = '';
      });
    } catch (erro) {
      console.error('Erro na requisição:', erro);
      window.showAppMessage('Erro ao conectar com o servidor.');
    }
  });
});
