document.addEventListener('DOMContentLoaded', () => {
  const statusIcon = document.getElementById('status-icon');
  const statusTexto = document.getElementById('status-texto');
  const statusDesc = document.getElementById('status-desc');
  const btnToggle = document.getElementById('btn-toggle');

  let servidorRodando = false;

  function atualizarInterface(rodando) {
    servidorRodando = rodando;
    btnToggle.disabled = false;

    if (rodando) {
      statusIcon.textContent = '🟢';
      statusTexto.textContent = 'Servidor Online';
      statusDesc.textContent = 'O motor de cálculo de médias em Java está ativo e aceitando conexões.';
      btnToggle.textContent = 'Desativar Servidor';
      btnToggle.classList.add('is-online');
    } else {
      statusIcon.textContent = '🔴';
      statusTexto.textContent = 'Servidor Offline';
      statusDesc.textContent = 'O servidor de cálculo está desligado. Ative-o para processar médias.';
      btnToggle.textContent = 'Ativar Servidor';
      btnToggle.classList.remove('is-online');
    }
  }

  async function lerResposta(res) {
    const isJson = res.headers.get('content-type')?.includes('application/json');
    return isJson ? await res.json() : null;
  }

  async function verificarStatus() {
    try {
      const res = await fetch('/api/java-server/status');
      const data = await lerResposta(res);
      if (!res.ok || !data) {
        throw new Error(data?.mensagem || data?.message || `Rota indisponível (HTTP ${res.status}).`);
      }
      atualizarInterface(Boolean(data.rodando));
    } catch (erro) {
      statusIcon.textContent = '⚠️';
      statusTexto.textContent = 'Erro de Comunicação';
      statusDesc.textContent = erro.message || 'Não foi possível consultar o status do servidor.';
      btnToggle.disabled = true;
      btnToggle.textContent = 'Indisponível';
    }
  }

  btnToggle.addEventListener('click', async () => {
    const acao = servidorRodando ? 'parar' : 'iniciar';
    if (servidorRodando) {
      const confirmado = await window.confirmAppAction(
        'Deseja realmente desligar o servidor Java? O cálculo de médias ficará indisponível até que ele seja reativado.',
        'Desativar Servidor'
      );
      if (!confirmado) return;
    }

    btnToggle.disabled = true;
    btnToggle.textContent = servidorRodando ? 'Desativando...' : 'Ativando...';

    try {
      const res = await fetch(`/api/java-server/${acao}`, { method: 'POST' });
      const data = await lerResposta(res);

      if (res.ok && data?.success) {
        window.showAppMessage(data.message || `Servidor ${servidorRodando ? 'desativado' : 'ativado'} com sucesso.`);
        atualizarInterface(!servidorRodando);
      } else {
        window.showAppMessage(data?.mensagem || data?.message || 'Erro ao alterar estado do servidor.', 'error');
        atualizarInterface(servidorRodando);
      }
    } catch {
      window.showAppMessage('Falha de rede ao tentar comunicar com a API.', 'error');
      atualizarInterface(servidorRodando);
    }
  });

  verificarStatus();
});