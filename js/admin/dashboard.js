// Autores:
// Gabriel Scolfaro de Azeredo - 25006194
document.addEventListener('DOMContentLoaded', async () => {
    const contadorElemento = document.getElementById('contador-chamados-ativos');
    const cardChamados = document.getElementById('card-chamados-ativos');

    if (contadorElemento && cardChamados) {
        try {
            const response = await fetch('/api/chamados');
            const data = await response.json();

            if (response.ok && data.chamados) {
                // Verifica a quantidade de chamados ativos e atualiza o contador na tela.
                const ativos = data.chamados.filter(c => c.status === 'ativo');
                contadorElemento.textContent = ativos.length;
            } else {
                contadorElemento.textContent = '0';
            }
        } catch (erro) {
            console.error('Erro ao carregar contagem de chamados:', erro);
            contadorElemento.textContent = '0';
        }

        // Redireciona o administrador para a página de gerenciamento de chamados.
        cardChamados.addEventListener('click', () => {
            window.location.href = '../../pages/admin/contato.html';
        });
    }

    // Inicializa o sistema de notificações no perfil de administrador.
    NotaDezNotificacoes.iniciar({ perfil: 'admin' });
});
