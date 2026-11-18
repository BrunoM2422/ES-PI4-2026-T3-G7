// Autores:
document.addEventListener('DOMContentLoaded', () => {
  const statusIcon = document.getElementById('status-icon');
  const statusTexto = document.getElementById('status-texto');
  const statusDesc = document.getElementById('status-desc');
  const btnToggle = document.getElementById('btn-toggle');
  const serverCard = btnToggle.closest('.server-card');

  const INTERVALO_STATUS_MS = 10000;

  let servidorRodando = false;
  let ocupado = false; // true enquanto inicia/para, para o polling não interferir

  function atualizarInterface(rodando, porta) {
    servidorRodando = rodando;
    btnToggle.disabled = false;

    if (rodando) {
      statusIcon.textContent = '🟢';
      statusTexto.textContent = 'Servidor Online';
      statusDesc.textContent = porta
        ? `O motor de cálculo de médias em Java está ativo e aceitando conexões na porta ${porta}.`
        : 'O motor de cálculo de médias em Java está ativo e aceitando conexões.';
      btnToggle.textContent = 'Desativar Servidor';
      serverCard.classList.add('is-online');
      serverCard.classList.remove('is-error');
    } else {
      statusIcon.textContent = '🔴';
      statusTexto.textContent = 'Servidor Offline';
      statusDesc.textContent = 'O servidor de cálculo está desligado. Ative-o para processar médias.';
      btnToggle.textContent = 'Ativar Servidor';
      serverCard.classList.remove('is-online', 'is-error');
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
      atualizarInterface(Boolean(data.rodando), data.porta);
    } catch (erro) {
      statusIcon.textContent = '⚠️';
      statusTexto.textContent = 'Erro de Comunicação';
      statusDesc.textContent = erro.message || 'Não foi possível consultar o status do servidor.';
      btnToggle.disabled = true;
      btnToggle.textContent = 'Indisponível';
    }
  }

  btnToggle.addEventListener('click', async () => {
    if (ocupado) return;
    const acao = servidorRodando ? 'parar' : 'iniciar';
    if (servidorRodando) {
      const confirmado = await window.confirmAppAction(
        'Deseja realmente desligar o servidor Java? O cálculo de médias ficará indisponível até que ele seja reativado.',
        'Desativar Servidor'
      );
      if (!confirmado) return;
    }

    ocupado = true;
    btnToggle.disabled = true;
    btnToggle.textContent = servidorRodando ? 'Desativando...' : 'Ativando...';

    try {
      // iniciar pode levar alguns segundos: o Node só responde quando o Java confirma que subiu
      const res = await fetch(`/api/java-server/${acao}`, { method: 'POST' });
      const data = await lerResposta(res);

      if (res.ok && data?.success) {
        window.showAppMessage(data.message || `Servidor ${acao === 'parar' ? 'desativado' : 'ativado'} com sucesso.`);
      } else {
        window.showAppMessage(data?.mensagem || data?.message || 'Erro ao alterar estado do servidor.', 'error');
      }
    } catch {
      window.showAppMessage('Falha de rede ao tentar comunicar com a API.', 'error');
    } finally {
      ocupado = false;
      // sempre sincroniza com o estado real, em vez de supor o resultado
      await verificarStatus();
    }
  });

  verificarStatus();

  // Se o Java cair sozinho (ou for ligado/desligado em outra aba), a tela acompanha
  setInterval(() => { if (!ocupado) verificarStatus(); }, INTERVALO_STATUS_MS);
});