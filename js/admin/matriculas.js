document.addEventListener('DOMContentLoaded', () => {
  const app = document.querySelector('#app');
  const button = document.querySelector('.admin-button');
  const status = document.querySelector('[role="status"]');
  const campos = {
    matricula: document.querySelector('[name="matricula"]'),
    cpf: document.querySelector('[name="cpf"]'),
    confirmacao: document.querySelector('[name="confirmacao"]')
  };

  if (!app || !button || !status) return;
  const cancelar = app.dataset.page === 'cancelar-matricula';
  const url = cancelar ? '/api/admin/matriculas/cancelar' : '/api/admin/matriculas/trancar';
  const dadosExtras = cancelar ? [] : [
    document.querySelector('[name="inicio"]'),
    document.querySelector('[name="retorno"]'),
    document.querySelector('[name="justificativa"]')
  ];

  button.addEventListener('click', async () => {
    const entradas = [...Object.values(campos), ...dadosExtras].filter(Boolean);
    let valido = true;
    entradas.forEach(entrada => {
      if (!entrada.reportValidity()) valido = false;
    });
    if (!valido) return;

    button.disabled = true;
    const textoOriginal = button.textContent;
    button.textContent = cancelar ? 'Cancelando...' : 'Trancando...';
    status.textContent = '';

    const body = {
      matricula: campos.matricula.value.trim(),
      cpf: campos.cpf.value.trim()
    };
    if (!cancelar) {
      body.inicio = dadosExtras[0].value;
      body.retorno = dadosExtras[1].value;
      body.justificativa = dadosExtras[2].value.trim();
    }

    try {
      const resposta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível concluir a operação.');

      status.textContent = dados.mensagem;
      document.querySelector('form')?.reset();
      entradas.forEach(entrada => {
        if (entrada.type !== 'checkbox') entrada.value = '';
      });
      campos.confirmacao.checked = false;
    } catch (erro) {
      status.textContent = erro.message;
    } finally {
      button.disabled = false;
      button.textContent = textoOriginal;
    }
  });
});
