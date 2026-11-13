document.addEventListener('DOMContentLoaded', async () => {
    const contadorElemento = document.getElementById('contador-chamados-ativos');
    const cardChamados = document.getElementById('card-chamados-ativos');
    const notificationList = document.getElementById('admin-notification-list');
    const btnLerTodas = document.getElementById('btn-marcar-todas-lidas');
    let notificacoesVisiveis = [];

    const user = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
    const dismissedKey = `notadez_dismissed_notifs_meta_${user?.email || 'admin'}`;

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

    async function carregarNotificacoes() {
        if (!notificationList) return;

        try {
            const token = sessionStorage.getItem('notadez_token');
            const response = await fetch('/api/calendario/eventos', {
                headers: { Authorization: `Bearer ${token || ''}` }
            });
            const data = await response.json();

            if (!response.ok || !data.eventos) {
                exibirVazio();
                return;
            }

            const hojeStr = obterDataAtualStr();
            const limiteStr = somarDiasDataStr(hojeStr, 5);

            const eventosProximos = data.eventos.filter(ev => {
                return (ev.category === 'feriado' || ev.category === 'institucional') &&
                    ev.date >= hojeStr &&
                    ev.date <= limiteStr;
            });

            let dismissedMap = {};
            try {
                dismissedMap = JSON.parse(localStorage.getItem(dismissedKey) || '{}');
            } catch {
                dismissedMap = {};
            }

            const notificacoesAtivas = eventosProximos.filter(ev => {
                const ultimaDispensa = dismissedMap[ev.id];
                if (!ultimaDispensa) return true;

                const dataAtualizacao = ev.updatedAt || ev.createdAt;
                if (dataAtualizacao && new Date(dataAtualizacao).getTime() > new Date(ultimaDispensa).getTime()) {
                    return true;
                }
                return false;
            });
            notificacoesVisiveis = notificacoesAtivas;
            renderizarNotificacoes(notificacoesAtivas);
        } catch (erro) {
            console.error('Erro ao carregar notificações do calendário:', erro);
            exibirVazio();
        }
    }

    function renderizarNotificacoes(lista) {
        if (!notificationList) return;

        if (!lista.length) {
            exibirVazio();
            return;
        }

        if (btnLerTodas) btnLerTodas.hidden = false;
        notificationList.replaceChildren();

        lista.forEach(ev => {
            const item = document.createElement('article');
            item.className = 'admin-notification-item is-dismissable';

            const dataFormatada = formatarDataPtBr(ev.date);
            const horario = ev.category === 'institucional' && ev.start
                ? ` às ${ev.start}${ev.end ? ` - ${ev.end}` : ''}`
                : '';
            const tipoLabel = ev.category === 'feriado' ? 'Feriado' : 'Evento Institucional';

            item.innerHTML = `
      <div class="admin-notif-main">
        <span class="admin-notification-dot" aria-hidden="true"></span>
        <div class="admin-notif-text">
          <strong>${escapeHtml(ev.title)} (${tipoLabel})</strong>
          <small>${dataFormatada}${horario}</small>
        </div>
      </div>
      <div class="admin-notif-actions">
        <button type="button" class="admin-notif-btn" data-acao="ver">Ver</button>
        <button type="button" class="admin-notif-btn admin-notif-btn-danger" data-acao="dispensar" title="Dispensar notificação" aria-label="Dispensar notificação">&times;</button>
      </div>
    `;

            item.addEventListener('click', (e) => {
                const acao = e.target.closest('button')?.dataset.acao;
                if (acao === 'dispensar') return dispensarNotificacao(ev.id);
                abrirModalDetalhes(ev);
            });

            notificationList.append(item);
        });
    }

    function exibirVazio() {
        notificacoesVisiveis = [];
        if (!notificationList) return;
        notificationList.replaceChildren();
        const item = document.createElement('article');
        item.className = 'admin-notification-item is-empty';
        item.innerHTML = `
      <span class="admin-notification-dot" aria-hidden="true"></span>
      <div>
        <strong>Nenhuma notificação recente.</strong>
        <small>As atualizações aparecerão aqui.</small>
      </div>
    `;
        notificationList.append(item);
        if (btnLerTodas) btnLerTodas.hidden = true;
    }

    function dispensarNotificacao(id) {
        let dismissedMap = {};
        try {
            dismissedMap = JSON.parse(localStorage.getItem(dismissedKey) || '{}');
        } catch {
            dismissedMap = {};
        }
        dismissedMap[id] = new Date().toISOString();
        localStorage.setItem(dismissedKey, JSON.stringify(dismissedMap));
        carregarNotificacoes();
    }

    if (btnLerTodas) {
        btnLerTodas.addEventListener('click', () => {
            let dismissedMap = {};
            try {
                dismissedMap = JSON.parse(localStorage.getItem(dismissedKey) || '{}');
            } catch {
                dismissedMap = {};
            }
            const agora = new Date().toISOString();
            notificacoesVisiveis.forEach(ev => { dismissedMap[ev.id] = agora; });
            localStorage.setItem(dismissedKey, JSON.stringify(dismissedMap));
            carregarNotificacoes();
        });
    }

    function abrirModalDetalhes(ev) {
        document.getElementById('admin-notif-modal')?.remove();

        const tipoLabel = ev.category === 'feriado' ? 'Feriado' : 'Evento Institucional';
        const overlay = document.createElement('div');
        overlay.id = 'admin-notif-modal';
        overlay.className = 'admin-notif-overlay';

        overlay.innerHTML = `
    <div class="admin-notif-modal" role="dialog" aria-modal="true">
      <div class="admin-notif-modal-head">
        <h3>${escapeHtml(ev.title)}</h3>
        <button type="button" class="admin-notif-close" aria-label="Fechar">&times;</button>
      </div>
      <div class="admin-notif-info">
        <div><strong>Tipo:</strong> ${tipoLabel}</div>
        <div><strong>Data:</strong> ${formatarDataPtBr(ev.date)}</div>
        ${ev.start ? `<div><strong>Horário:</strong> ${escapeHtml(ev.start)}${ev.end ? ` - ${escapeHtml(ev.end)}` : ''}</div>` : ''}
        ${ev.location ? `<div><strong>Local:</strong> ${escapeHtml(ev.location)}</div>` : ''}
        ${ev.description ? `<div><strong>Descrição:</strong><p>${escapeHtml(ev.description)}</p></div>` : ''}
      </div>
      <div class="admin-notif-modal-foot">
        <button type="button" class="admin-notif-btn admin-notif-btn-primary" data-fechar>Entendido</button>
      </div>
    </div>
  `;

        document.body.append(overlay);

        const fechar = () => {
            overlay.remove();
            document.removeEventListener('keydown', onEsc);
        };
        const onEsc = (e) => { if (e.key === 'Escape') fechar(); };
        document.addEventListener('keydown', onEsc);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.closest('.admin-notif-close, [data-fechar]')) fechar();
        });
    }

    function obterDataAtualStr() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function somarDiasDataStr(dataStr, dias) {
        const [y, m, d] = dataStr.split('-').map(Number);
        const date = new Date(y, m - 1, d + dias);
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }

    function formatarDataPtBr(dataStr) {
        if (!dataStr && dataStr !== 0) return '';
        const [y, m, d] = String(dataStr).split('-');
        return `${d}/${m}/${y}`;
    }

    function escapeHtml(str) {
        return (str || '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    carregarNotificacoes();
});
