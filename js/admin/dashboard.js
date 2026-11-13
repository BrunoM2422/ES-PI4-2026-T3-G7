document.addEventListener('DOMContentLoaded', async () => {
    const contadorElemento = document.getElementById('contador-chamados-ativos');
    const cardChamados = document.getElementById('card-chamados-ativos');

    if (contadorElemento && cardChamados) {
        try {
            const response = await fetch('/api/chamados');
            const data = await response.json();

            if (response.ok && data.chamados) {
                const ativos = data.chamados.filter(c => c.status === 'ativo');
                contadorElemento.textContent = ativos.length;
            } else {
                contadorElemento.textContent = '0';
            }
        } catch (erro) {
            console.error('Erro ao carregar contagem de chamados:', erro);
            contadorElemento.textContent = '0';
        }

        cardChamados.addEventListener('click', () => {
            window.location.href = '../../pages/admin/contato.html';
        });
    }

    NotaDezNotificacoes.iniciar({ perfil: 'admin' });
});
