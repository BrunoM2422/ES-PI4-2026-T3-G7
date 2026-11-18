document.addEventListener('DOMContentLoaded', () => {
    NotaDezNotificacoes.iniciar({ perfil: 'professor' });
    iniciarAgendaHoje();
});

function iniciarAgendaHoje() {
    const FUSO = 'America/Sao_Paulo';
    const ROTULOS = {
        feriado: 'Feriado',
        institucional: 'Evento Institucional',
        aula: 'Aula',
        atividade: 'Atividade'
    };

    const lista = document.getElementById('agenda-hoje');
    const rotuloData = document.getElementById('agenda-data');
    if (!lista) return;

    let eventosDeHoje = [];
    let turmasPorId = new Map();
    let dataCarregada = '';
    let falhou = false;

    function agoraSP() {
        const partes = new Intl.DateTimeFormat('en-CA', {
            timeZone: FUSO,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date());
        const v = Object.fromEntries(partes.map(p => [p.type, p.value]));
        return { data: `${v.year}-${v.month}-${v.day}`, hora: `${v.hour}:${v.minute}` };
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }

    async function buscarJson(url) {
        const token = sessionStorage.getItem('notadez_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const resposta = await fetch(url, { headers, credentials: 'same-origin' });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.mensagem || `Erro ao carregar dados (${resposta.status}).`);
        return dados;
    }

    function atualizarTurmasAtivas(resultado) {
        const valor = document.getElementById('stat-turmas-ativas');
        const info = document.getElementById('stat-turmas-ativas-info');
        if (!valor) return;

        if (resultado.status !== 'fulfilled') {
            console.error('Erro ao carregar turmas:', resultado.reason);
            valor.textContent = '—';
            if (info) info.textContent = 'Dados não disponíveis.';
            return;
        }

        const ativas = (resultado.value.turmas || []).filter(t => t.ativa !== false);
        valor.textContent = String(ativas.length);
        if (info) {
            info.textContent = ativas.length === 0
                ? 'Nenhuma turma atribuída.'
                : ativas.length === 1
                    ? '1 turma sob sua responsabilidade.'
                    : `${ativas.length} turmas sob sua responsabilidade.`;
        }
    }

    async function carregar() {
        const hoje = agoraSP().data;
        const jsDay = new Date(`${hoje}T12:00:00`).getDay();
        const diaIso = jsDay === 0 ? 7 : jsDay;

        const [eventos, turmas, aulasRes] = await Promise.allSettled([
            buscarJson('/api/calendario/eventos'),
            buscarJson('/api/calendario/minhas-turmas'),
            buscarJson('/api/calendario/minhas-aulas')
        ]);

        atualizarTurmasAtivas(turmas);

        if (eventos.status === 'rejected' && aulasRes.status === 'rejected') {
            console.error('Erro ao carregar a agenda:', eventos.reason, aulasRes.reason);
            falhou = true;
            renderizar();
            return;
        }

        falhou = false;
        dataCarregada = hoje;

        const listaEventos = eventos.status === 'fulfilled' ? (eventos.value.eventos || []) : [];
        eventosDeHoje = listaEventos.filter(ev => ev.date === hoje);

        const minhasAulas = aulasRes.status === 'fulfilled' ? (aulasRes.value.aulas || []) : [];
        const aulasDeHoje = minhasAulas.filter(aula => Number(aula.dia) === diaIso);

        const aulasConvertidas = aulasDeHoje.map(aula => {
            const horaInicio = Number(aula.hora);
            const startStr = Number.isInteger(horaInicio) ? `${String(horaInicio).padStart(2, '0')}:00` : '';
            const endStr = Number.isInteger(horaInicio) ? `${String(horaInicio + 1).padStart(2, '0')}:00` : '';
            return {
                id: `aula-reg-${aula.codigoTurma}-${aula.hora}`,
                title: aula.materia || 'Aula Regular',
                date: hoje,
                category: 'aula',
                start: startStr,
                end: endStr,
                location: '',
                description: `Curso: ${aula.turma || 'Não identificado'} | Código da turma: ${aula.codigoTurma || '—'}`,
                turmaId: null
            };
        });

        eventosDeHoje = [...eventosDeHoje, ...aulasConvertidas];

        turmasPorId = new Map(
            turmas.status === 'fulfilled'
                ? (turmas.value.turmas || []).map(t => [t.id, t.codigo])
                : []
        );

        renderizar();
    }

    function aindaVisivel(ev, agora) {
        if (!ev.start) return true;
        const fim = ev.end || ev.start;
        return agora.hora < fim;
    }

    function renderizar() {
        const agora = agoraSP();

        if (rotuloData) {
            rotuloData.textContent = new Intl.DateTimeFormat('pt-BR', {
                timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long'
            }).format(new Date());
        }

        lista.replaceChildren();

        if (falhou) {
            lista.innerHTML = '<p class="teacher-empty-message">Não foi possível carregar a agenda.</p>';
            return;
        }

        const visiveis = eventosDeHoje
            .filter(ev => aindaVisivel(ev, agora))
            .sort((a, b) => (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title));

        if (!visiveis.length) {
            lista.innerHTML = '<p class="teacher-empty-message">Nenhuma atividade agendada para hoje.</p>';
            return;
        }

        visiveis.forEach(ev => {
            const emAndamento = Boolean(ev.start) && agora.hora >= ev.start;
            const horario = !ev.start
                ? 'Dia todo'
                : ev.end ? `${ev.start} - ${ev.end}` : ev.start;
            const codigoTurma = ev.turmaId ? turmasPorId.get(ev.turmaId) : '';

            const item = document.createElement('article');
            item.className = `teacher-agenda-item is-${ev.category}${emAndamento ? ' is-ongoing' : ''}`;
            item.innerHTML = `
                <div class="teacher-agenda-time">${escapeHtml(horario)}</div>
                <div class="teacher-agenda-body">
                    <strong>${escapeHtml(ev.title)}</strong>
                    <div class="teacher-agenda-meta">
                        <span class="teacher-agenda-chip">${escapeHtml(ROTULOS[ev.category] || ev.category)}</span>
                        ${codigoTurma ? `<span class="teacher-agenda-chip">Turma ${escapeHtml(codigoTurma)}</span>` : ''}
                        ${ev.location ? `<span class="teacher-agenda-place">${escapeHtml(ev.location)}</span>` : ''}
                        ${emAndamento ? '<span class="teacher-agenda-live">Em andamento</span>' : ''}
                    </div>
                    ${ev.description ? `<p class="teacher-agenda-desc">${escapeHtml(ev.description)}</p>` : ''}
                </div>
            `;
            lista.append(item);
        });
    }

    function atualizar() {
        if (falhou || agoraSP().data !== dataCarregada) {
            carregar();
        } else {
            renderizar();
        }
    }

    function agendarProximoMinuto() {
        const atraso = 60000 - (Date.now() % 60000) + 500;
        setTimeout(() => {
            atualizar();
            agendarProximoMinuto();
        }, atraso);
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) carregar();
    });

    carregar();
    agendarProximoMinuto();
}
