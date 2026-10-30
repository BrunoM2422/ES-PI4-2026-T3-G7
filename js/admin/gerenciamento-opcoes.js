document.addEventListener('DOMContentLoaded', async () => {
  const status = document.querySelector('[data-options-status]');
  const grupos = [...document.querySelectorAll('.admin-option-actions')];

  const atualizarGrupo = (grupo, ativo) => {
    grupo.querySelectorAll('button[data-state]').forEach(botao => {
      const selecionado = (botao.dataset.state === 'ativar') === ativo;
      botao.setAttribute('aria-pressed', String(selecionado));
      botao.classList.toggle('is-selected', selecionado);
    });
  };

  const aplicarOpcoes = opcoes => {
    grupos.forEach(grupo => {
      atualizarGrupo(grupo, Boolean(opcoes[grupo.dataset.option]));
    });
    status.textContent = 'Configuração global';
  };

  try {
    const resposta = await fetch('/api/opcoes');
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.mensagem || 'Falha ao carregar opções.');
    aplicarOpcoes(dados.opcoes || {});
  } catch (erro) {
    console.error('Erro ao carregar opções:', erro);
    status.textContent = 'Não foi possível carregar';
    grupos.forEach(grupo => {
      grupo.querySelectorAll('button').forEach(botao => {
        botao.disabled = true;
      });
    });
    return;
  }

  grupos.forEach(grupo => {
    grupo.querySelectorAll('button[data-state]').forEach(botao => {
      botao.addEventListener('click', async () => {
        const anterior = botao.getAttribute('aria-pressed') === 'true';
        const ativar = botao.dataset.state === 'ativar';
        const botoes = [...grupo.querySelectorAll('button[data-state]')];
        botoes.forEach(item => { item.disabled = true; });

        try {
          const resposta = await fetch('/api/admin/opcoes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [grupo.dataset.option]: ativar })
          });
          const dados = await resposta.json();
          if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível salvar a opção.');
          aplicarOpcoes(dados.opcoes || {});
        } catch (erro) {
          atualizarGrupo(grupo, anterior);
          status.textContent = erro.message;
        } finally {
          botoes.forEach(item => { item.disabled = false; });
        }
      });
    });
  });
});
