(function () {
    const FUSO = 'America/Sao_Paulo';

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }

    function hojeStr() {
        const partes = new Intl.DateTimeFormat('en-CA', {
            timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        const v = Object.fromEntries(partes.map(p => [p.type, p.value]));
        return `${v.year}-${v.month}-${v.day}`;
    }

    function somarDias(dataStr, dias) {
        const [y, m, d] = dataStr.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
    }

    function formatarData(dataStr) {
        if (!dataStr) return '';
        const [y, m, d] = String(dataStr).split('-');
        return `${d}/${m}/${y}`;
    }

    const ROTULOS_CATEGORIA = {
        feriado: 'Feriado',
        institucional: 'Evento Institucional'
    };

    function calendario({ dias = 5, categorias = ['feriado', 'institucional'] } = {}) {
        return async () => {
            const token = sessionStorage.getItem('notadez_token');
            const resposta = await fetch('/api/calendario/eventos', {
                headers: { Authorization: `Bearer ${token || ''}` }
            });
            const dados = await resposta.json();
            if (!resposta.ok || !Array.isArray(dados.eventos)) {
                throw new Error(dados.mensagem || 'Não foi possível carregar os eventos.');
            }

            const hoje = hojeStr();
            const limite = somarDias(hoje, dias);

            return dados.eventos
                .filter(ev =>
                    ev.scope === 'global' &&
                    categorias.includes(ev.category) &&
                    ev.date >= hoje &&
                    ev.date <= limite
                )
                .map(ev => {
                    const horario = ev.start ? `${ev.start}${ev.end ? ` - ${ev.end}` : ''}` : '';
                    const detalhes = [
                        { rotulo: 'Tipo', valor: ROTULOS_CATEGORIA[ev.category] || ev.category },
                        { rotulo: 'Data', valor: formatarData(ev.date) }
                    ];
                    if (horario) detalhes.push({ rotulo: 'Horário', valor: horario });
                    if (ev.location) detalhes.push({ rotulo: 'Local', valor: ev.location });

                    return {
                        id: `calendario:${ev.id}`,
                        titulo: ev.title,
                        tipo: ROTULOS_CATEGORIA[ev.category] || ev.category,
                        quando: `${formatarData(ev.date)}${horario ? ` às ${horario}` : ''}`,
                        ordem: `${ev.date} ${ev.start || ''}`,
                        detalhes,
                        descricao: ev.description || '',
                        atualizadoEm: ev.updatedAt || ev.createdAt
                    };
                });
        };
    }

    function iniciar({ perfil, fontes, lista, btnLerTodas } = {}) {
        lista = lista || document.getElementById('notif-list');
        btnLerTodas = btnLerTodas || document.getElementById('btn-marcar-todas-lidas');
        fontes = fontes && fontes.length ? fontes : [calendario()];
        if (!lista) return null;

        let usuario = null;
        try {
            usuario = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
        } catch {
            usuario = null;
        }
        const chaveStorage = `notadez_notifs_dispensadas_${perfil || 'geral'}_${usuario?.email || 'anonimo'}`;

        let visiveis = [];

        function lerDispensadas() {
            try {
                return JSON.parse(localStorage.getItem(chaveStorage) || '{}');
            } catch {
                return {};
            }
        }

        function salvarDispensadas(mapa) {
            try {
                localStorage.setItem(chaveStorage, JSON.stringify(mapa));
            } catch (erro) {
                console.error('Não foi possível salvar as notificações dispensadas:', erro);
            }
        }

        async function carregar() {
            const resultados = await Promise.allSettled(fontes.map(fonte => fonte()));
            const todas = [];
            resultados.forEach(r => {
                if (r.status === 'fulfilled') todas.push(...r.value);
                else console.error('Erro ao carregar notificações:', r.reason);
            });

            const dispensadas = lerDispensadas();
            visiveis = todas
                .filter(n => {
                    const ultima = dispensadas[n.id];
                    if (!ultima) return true;
                    return Boolean(n.atualizadoEm) &&
                        new Date(n.atualizadoEm).getTime() > new Date(ultima).getTime();
                })
                .sort((a, b) => (a.ordem || '').localeCompare(b.ordem || ''));

            renderizar();
        }

        function renderizar() {
            lista.replaceChildren();

            if (!visiveis.length) {
                const vazio = document.createElement('article');
                vazio.className = 'notif-item is-empty';
                vazio.innerHTML = `
                    <div class="notif-main">
                        <span class="notif-dot" aria-hidden="true"></span>
                        <div class="notif-text">
                            <strong>Nenhuma notificação recente.</strong>
                            <small>As atualizações aparecerão aqui.</small>
                        </div>
                    </div>
                `;
                lista.append(vazio);
                if (btnLerTodas) btnLerTodas.hidden = true;
                return;
            }

            if (btnLerTodas) btnLerTodas.hidden = false;

            visiveis.forEach(n => {
                const item = document.createElement('article');
                item.className = 'notif-item';
                item.dataset.id = n.id;
                item.innerHTML = `
                    <div class="notif-main">
                        <span class="notif-dot" aria-hidden="true"></span>
                        <div class="notif-text">
                            <strong>${escapeHtml(n.titulo)} (${escapeHtml(n.tipo)})</strong>
                            <small>${escapeHtml(n.quando)}</small>
                        </div>
                    </div>
                    <div class="notif-actions">
                        <button type="button" class="notif-btn" data-acao="ver">Ver</button>
                        <button type="button" class="notif-btn notif-btn-danger" data-acao="dispensar" title="Dispensar notificação" aria-label="Dispensar notificação">&times;</button>
                    </div>
                `;
                lista.append(item);
            });
        }

        function dispensar(ids) {
            const dispensadas = lerDispensadas();
            const agora = new Date().toISOString();
            ids.forEach(id => { dispensadas[id] = agora; });
            salvarDispensadas(dispensadas);
            carregar();
        }

        function abrirModal(n) {
            document.getElementById('notif-modal')?.remove();

            const overlay = document.createElement('div');
            overlay.id = 'notif-modal';
            overlay.className = 'notif-overlay';

            const linhas = (n.detalhes || [])
                .map(d => `<div><strong>${escapeHtml(d.rotulo)}:</strong> ${escapeHtml(d.valor)}</div>`)
                .join('');
            const descricao = n.descricao
                ? `<div><strong>Descrição:</strong><p>${escapeHtml(n.descricao)}</p></div>`
                : '';

            overlay.innerHTML = `
                <div class="notif-modal" role="dialog" aria-modal="true">
                    <div class="notif-modal-head">
                        <h3>${escapeHtml(n.titulo)}</h3>
                        <button type="button" class="notif-close" aria-label="Fechar">&times;</button>
                    </div>
                    <div class="notif-info">${linhas}${descricao}</div>
                    <div class="notif-modal-foot">
                        <button type="button" class="notif-btn notif-btn-primary" data-fechar>Entendido</button>
                    </div>
                </div>
            `;

            document.body.append(overlay);

            const fechar = () => {
                overlay.remove();
                document.removeEventListener('keydown', aoPressionarEsc);
            };
            const aoPressionarEsc = (e) => { if (e.key === 'Escape') fechar(); };
            document.addEventListener('keydown', aoPressionarEsc);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay || e.target.closest('.notif-close, [data-fechar]')) fechar();
            });
        }

        lista.addEventListener('click', (e) => {
            const item = e.target.closest('.notif-item[data-id]');
            if (!item) return;
            const notificacao = visiveis.find(n => n.id === item.dataset.id);
            if (!notificacao) return;

            if (e.target.closest('[data-acao="dispensar"]')) {
                dispensar([notificacao.id]);
                return;
            }
            abrirModal(notificacao);
        });

        if (btnLerTodas) {
            btnLerTodas.addEventListener('click', () => dispensar(visiveis.map(n => n.id)));
        }

        carregar();
        return { recarregar: carregar };
    }

    window.NotaDezNotificacoes = { iniciar, fontes: { calendario } };
})();
