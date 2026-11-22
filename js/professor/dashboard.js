// Autores:
// Gabriel Scolfaro de Azeredo - 25006194
document.addEventListener('DOMContentLoaded', () => {
    NotaDezNotificacoes.iniciar({ perfil: 'professor' });
    iniciarAgendaHoje();
});

function iniciarAgendaHoje() {
    const FUSO = 'America/Sao_Paulo';
    const DIAS_ATIVIDADES = 2;
    const ROTULOS = {
        feriado: 'Feriado',
        institucional: 'Evento Institucional',
        aula: 'Aula',
        atividade: 'Atividade'
    };

    const lista = document.getElementById('agenda-hoje');
    const rotuloData = document.getElementById('agenda-data');
    const listaAtividades = document.getElementById('atividades-lista');
    const rotuloJanela = document.getElementById('atividades-janela');
    if (!lista) return;

    let eventosDeHoje = [];
    let atividades = [];
    let turmasPorId = new Map();
    let dataCarregada = '';
    let falhou = false;
    let atividadesFalharam = false;

    if (rotuloJanela) rotuloJanela.textContent = `Hoje e próximos ${DIAS_ATIVIDADES} dias`;

    function agoraSP() {
        const partes = new Intl.DateTimeFormat('en-CA', {
            timeZone: FUSO,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date());
        const v = Object.fromEntries(partes.map(p => [p.type, p.value]));
        return { data: `${v.year}-${v.month}-${v.day}`, hora: `${v.hour}:${v.minute}` };
    }

    function somarDias(dataStr, dias) {
        const [a, m, d] = dataStr.split('-').map(Number);
        return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
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

        const total = (resultado.value.turmas || []).length;
        valor.textContent = String(total);
        if (info) {
            info.textContent = total === 0
                ? 'Nenhuma turma atribuída.'
                : total === 1
                    ? '1 turma sob sua responsabilidade.'
                    : `${total} turmas sob sua responsabilidade.`;
        }
    }

    function atualizarAvaliacoesPendentes(resultado) {
        const valor = document.getElementById('stat-avaliacoes-pendentes');
        const info = document.getElementById('stat-avaliacoes-pendentes-info');
        if (!valor) return;

        if (resultado.status !== 'fulfilled') {
            console.error('Erro ao carregar avaliações pendentes:', resultado.reason);
            valor.textContent = '—';
            if (info) info.textContent = 'Dados não disponíveis.';
            return;
        }

        const { turmasTotal = 0, turmasPendentes = 0 } = resultado.value;
        valor.textContent = String(turmasPendentes);
        if (info) {
            info.textContent = turmasTotal === 0
                ? 'Nenhuma turma com alunos.'
                : turmasPendentes === 0
                    ? 'Nenhuma turma aguardando notas.'
                    : turmasPendentes === 1
                        ? '1 turma com notas a lançar.'
                        : `${turmasPendentes} turmas com notas a lançar.`;
        }
    }

    async function carregar() {
        const hoje = agoraSP().data;
        const limiteAtividades = somarDias(hoje, DIAS_ATIVIDADES);
        const jsDay = new Date(`${hoje}T12:00:00`).getDay();
        const diaIso = jsDay === 0 ? 7 : jsDay;

        const [eventos, turmas, aulasRes, turmasDocente, pendencias] = await Promise.allSettled([
            buscarJson('/api/calendario/eventos'),
            buscarJson('/api/calendario/minhas-turmas'),
            buscarJson('/api/calendario/minhas-aulas'),
            buscarJson('/api/professor/turmas'),
            buscarJson('/api/notas/professor/pendencias')
        ]);

        atualizarTurmasAtivas(turmasDocente);
        atualizarAvaliacoesPendentes(pendencias);
        atividadesFalharam = eventos.status === 'rejected';

        if (eventos.status === 'rejected' && aulasRes.status === 'rejected') {
            console.error('Erro ao carregar a agenda:', eventos.reason, aulasRes.reason);
            falhou = true;
            renderizar();
            return;
        }

        falhou = false;
        dataCarregada = hoje;

        const todos = eventos.status === 'fulfilled' ? (eventos.value.eventos || []) : [];
        eventosDeHoje = todos.filter(ev => ev.date === hoje && ev.category !== 'atividade');
        atividades = todos.filter(ev =>
            ev.category === 'atividade' && ev.date >= hoje && ev.date <= limiteAtividades
        );

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
                description: `Curso: ${aula.turma || 'Não identificado'} | Código da turma: ${window.formatarCodigoTurmaDisciplina(aula.codigoTurma, aula.codigoDisciplina) || '—'}`,
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
        if (ev.date > agora.data) return true;
        if (!ev.start) return true;
        const fim = ev.end || ev.start;
        return agora.hora < fim;
    }

    function criarItem(ev, agora) {
        const emAndamento = Boolean(ev.start) && ev.date === agora.data && agora.hora >= ev.start;
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
        return item;
    }

    function renderizarAgenda(agora) {
        if (rotuloData) {
            const texto = new Intl.DateTimeFormat('pt-BR', {
                timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long'
            }).format(new Date());
            rotuloData.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
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

        visiveis.forEach(ev => lista.append(criarItem(ev, agora)));
    }

    function rotuloDoDia(dataStr, hoje) {
        if (dataStr === hoje) return 'Hoje';
        if (dataStr === somarDias(hoje, 1)) return 'Amanhã';
        const [a, m, d] = dataStr.split('-').map(Number);
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long'
        }).format(new Date(Date.UTC(a, m - 1, d)));
    }

    function renderizarAtividades(agora) {
        if (!listaAtividades) return;
        listaAtividades.replaceChildren();

        if (atividadesFalharam) {
            listaAtividades.innerHTML = '<p class="teacher-empty-message">Não foi possível carregar as atividades.</p>';
            return;
        }

        const visiveis = atividades
            .filter(ev => aindaVisivel(ev, agora))
            .sort((a, b) =>
                a.date.localeCompare(b.date) ||
                (a.start || '').localeCompare(b.start || '') ||
                a.title.localeCompare(b.title));

        if (!visiveis.length) {
            listaAtividades.innerHTML = '<p class="teacher-empty-message">Nenhuma atividade nos próximos dias.</p>';
            return;
        }

        let diaAtual = '';
        visiveis.forEach(ev => {
            if (ev.date !== diaAtual) {
                diaAtual = ev.date;
                const cabecalho = document.createElement('p');
                cabecalho.className = 'teacher-activity-day';
                cabecalho.textContent = rotuloDoDia(ev.date, agora.data);
                listaAtividades.append(cabecalho);
            }
            listaAtividades.append(criarItem(ev, agora));
        });
    }

    function renderizar() {
        const agora = agoraSP();
        renderizarAgenda(agora);
        renderizarAtividades(agora);
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
