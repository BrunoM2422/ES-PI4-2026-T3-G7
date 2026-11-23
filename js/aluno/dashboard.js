// Autores: Bruno Machado — RA: 25008041 (Alterações menores)
// Gabriel Scolfaro de Azeredo - 25006194
document.addEventListener('DOMContentLoaded', () => {
    const FUSO = 'America/Sao_Paulo';
    const DIAS_RECENTES = 15;
    const JANELA_AGENDA = 30;
    const ROTULOS_EVENTO = {
        feriado: 'Feriado',
        institucional: 'Evento Institucional',
        aula: 'Alteração de aula',
        atividade: 'Atividade da turma'
    };

    let gradeEmCache = null;
    let gradeBuscadaEm = 0;

    // Inicializa as notificações do aluno e carrega a agenda e a grade de aulas.
    NotaDezNotificacoes.iniciar({
        perfil: 'aluno',
        fontes: [
            NotaDezNotificacoes.fontes.comunicados(),
            chamadosRespondidos,
            notasLiberadas
        ]
    });
    iniciarAgendaGeral();
    iniciarGradeDoDia();

    function lerUsuario() {
        try {
            return JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
        } catch {
            return null;
        }
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }

    function pad(n) {
        return String(n).padStart(2, '0');
    }

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

    function formatarData(dataStr) {
        const [a, m, d] = String(dataStr).split('-');
        return `${d}/${m}/${a}`;
    }

    function formatarDataHora(iso) {
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: FUSO, dateStyle: 'short', timeStyle: 'short'
        }).format(new Date(iso));
    }

    async function buscarJson(url) {
        const token = sessionStorage.getItem('notadez_token');
        const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token || ''}` } });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || 'Erro ao carregar dados.');
        return dados;
    }

    function obterGrade() {
        if (gradeEmCache && Date.now() - gradeBuscadaEm < 30000) return gradeEmCache;
        gradeBuscadaEm = Date.now();
        gradeEmCache = buscarJson('/api/aluno/grade');
        gradeEmCache.catch(() => { gradeEmCache = null; });
        return gradeEmCache;
    }

    function turmasDaGrade(dados) {
        const porTurma = new Map();
        (dados.disciplinas || []).forEach(disciplina => {
            (disciplina.turmas || []).filter(turma => turma.selecionada).forEach(turma => {
                const item = porTurma.get(turma.id) || {
                    codigo: window.formatarCodigoTurmaDisciplina(turma.codigo, disciplina.codigo),
                    nomes: []
                };
                item.nomes.push(disciplina.nome);
                porTurma.set(turma.id, item);
            });
        });
        return new Map([...porTurma].map(([id, item]) => [id, `${item.nomes.join(', ')} · Turma ${item.codigo}`]));
    }


    function aoVirarMinuto(callback) {
        const agendar = () => setTimeout(() => {
            callback();
            agendar();
        }, 60000 - (Date.now() % 60000) + 500);
        agendar();
    }

    async function chamadosRespondidos() {
        const usuario = lerUsuario();
        if (!usuario?.email) return [];

        const dados = await buscarJson(`/api/chamados?email=${encodeURIComponent(usuario.email)}`);
        const limite = Date.now() - DIAS_RECENTES * 86400000;

        return (dados.chamados || []).flatMap(chamado => {
            const mensagens = chamado.mensagens || [];
            const ultima = mensagens[mensagens.length - 1];
            if (!ultima || ultima.remetente_tipo !== 'admin') return [];
            if (!(new Date(ultima.data_envio).getTime() >= limite)) return [];

            return [{
                id: `chamado:${chamado.id}`,
                categoria: 'chamados',
                titulo: chamado.assunto,
                tipo: 'Chamado respondido',
                quando: formatarDataHora(ultima.data_envio),
                ordem: ultima.data_envio,
                detalhes: [
                    { rotulo: 'Assunto', valor: chamado.assunto },
                    { rotulo: 'Respondido por', valor: ultima.remetente_nome || 'Administração' },
                    { rotulo: 'Situação', valor: chamado.status === 'finalizado' ? 'Finalizado' : 'Em andamento' },
                    { rotulo: 'Resposta', valor: ultima.mensagem }
                ],
                atualizadoEm: ultima.data_envio
            }];
        });
    }

    async function notasLiberadas() {
        const dados = await buscarJson('/api/notas/aluno');
        const limite = Date.now() - DIAS_RECENTES * 86400000;

        return (dados.disciplinas || []).flatMap(disciplina => {
            const recentes = (disciplina.componentes || []).filter(c =>
                c.valor !== null &&
                c.notaAtualizadaEm &&
                new Date(c.notaAtualizadaEm).getTime() >= limite
            );
            if (!recentes.length) return [];

            const maisRecente = recentes.map(c => c.notaAtualizadaEm).sort().pop();

            return [{
                id: `nota:${disciplina.turmaId}:${disciplina.disciplinaId}`,
                categoria: 'notas',
                titulo: disciplina.disciplina,
                tipo: recentes.length > 1 ? 'Novas notas' : 'Nova nota',
                quando: formatarDataHora(maisRecente),
                ordem: maisRecente,
                detalhes: [
                    { rotulo: 'Disciplina', valor: disciplina.disciplina },
                    { rotulo: 'Turma', valor: disciplina.turma },
                    ...recentes.map(c => ({ rotulo: c.titulo, valor: `${c.valor} de ${c.valorMaximo}` }))
                ],
                atualizadoEm: maisRecente
            }];
        });
    }

    function iniciarAgendaGeral() {
        const lista = document.getElementById('agenda-geral');
        if (!lista) return;

        let eventos = [];
        let turmasDoAluno = new Map();
        let dataCarregada = '';
        let falhou = false;

        function entraNaAgenda(ev) {
            const geral = ev.scope === 'global' && (ev.category === 'feriado' || ev.category === 'institucional');
            const daTurma = ev.scope === 'turma' && (ev.category === 'aula' || ev.category === 'atividade');
            return geral || daTurma;
        }

        // Busca os eventos da agenda e as turmas selecionadas do aluno.
        async function carregar() {
            const hoje = agoraSP().data;
            const limite = somarDias(hoje, JANELA_AGENDA);
            const [resEventos, resGrade] = await Promise.allSettled([
                buscarJson('/api/calendario/eventos'),
                obterGrade()
            ]);

            if (resEventos.status === 'rejected') {
                console.error('Erro ao carregar a agenda geral:', resEventos.reason);
                falhou = true;
                renderizar();
                return;
            }

            eventos = (resEventos.value.eventos || []).filter(ev =>
                entraNaAgenda(ev) && ev.date >= hoje && ev.date <= limite
            );
            turmasDoAluno = resGrade.status === 'fulfilled' ? turmasDaGrade(resGrade.value) : new Map();
            dataCarregada = hoje;
            falhou = false;
            renderizar();
        }

        function aindaVisivel(ev, agora) {
            if (ev.date > agora.data) return true;
            if (!ev.start) return true;
            return agora.hora < (ev.end || ev.start);
        }

        function renderizar() {
            const agora = agoraSP();
            lista.replaceChildren();

            if (falhou) {
                lista.innerHTML = '<p class="student-dashboard-empty">Não foi possível carregar a agenda.</p>';
                return;
            }

            const visiveis = eventos
                .filter(ev => aindaVisivel(ev, agora))
                .sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''));

            if (!visiveis.length) {
                lista.innerHTML = '<p class="student-dashboard-empty">Nenhum evento na agenda.</p>';
                return;
            }

            visiveis.forEach(ev => {
                const [a, m, d] = ev.date.split('-').map(Number);
                const mes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short' })
                    .format(new Date(Date.UTC(a, m - 1, d))).replace('.', '');
                const horario = ev.start ? `${ev.start}${ev.end ? ` - ${ev.end}` : ''}` : 'Dia todo';
                const turma = ev.turmaId ? turmasDoAluno.get(ev.turmaId) : '';

                const item = document.createElement('article');
                item.className = `student-agenda-item is-${ev.category}`;
                item.innerHTML = `
                    <div class="student-agenda-date">
                        <strong>${pad(d)}</strong>
                        <small>${escapeHtml(mes)}</small>
                    </div>
                    <div class="student-agenda-body">
                        <strong>${escapeHtml(ev.title)}</strong>
                        <div class="student-agenda-meta">
                            <span class="student-agenda-chip">${escapeHtml(ROTULOS_EVENTO[ev.category] || ev.category)}</span>
                            ${ev.date === agora.data ? '<span class="student-agenda-chip">Hoje</span>' : ''}
                            <span>${escapeHtml(horario)}</span>
                            ${turma ? `<span>${escapeHtml(turma)}</span>` : ''}
                            ${ev.location ? `<span>${escapeHtml(ev.location)}</span>` : ''}
                        </div>
                        ${ev.description ? `<p class="student-agenda-desc">${escapeHtml(ev.description)}</p>` : ''}
                    </div>
                `;
                lista.append(item);
            });
        }

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) carregar();
        });

        aoVirarMinuto(() => {
            if (falhou || agoraSP().data !== dataCarregada) carregar();
            else renderizar();
        });

        carregar();
    }

    function iniciarGradeDoDia() {
        const lista = document.getElementById('aulas-lista');
        const rotuloDia = document.getElementById('aulas-dia-semana');
        const rotuloData = document.getElementById('aulas-data');
        const btnAnterior = document.getElementById('aulas-anterior');
        const btnProximo = document.getElementById('aulas-proximo');
        const btnHoje = document.getElementById('aulas-hoje');
        if (!lista) return;

        let aulas = [];
        let carregada = false;
        let mensagemErro = '';
        let dataSelecionada = agoraSP().data;

        function diaDaSemana(dataStr) {
            const [a, m, d] = dataStr.split('-').map(Number);
            return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
        }

        function montarAulas(dados) {
            return (dados.disciplinas || []).flatMap(disciplina =>
                (disciplina.turmas || [])
                    .filter(turma => turma.selecionada)
                    .flatMap(turma => (turma.horarios || []).map(horario => ({
                        chave: `${disciplina.id}:${turma.id}`,
                        dia: horario.dia,
                        hora: Number(horario.hora),
                        disciplina: disciplina.nome,
                        turma: window.formatarCodigoTurmaDisciplina(turma.codigo, disciplina.codigo),
                        docente: horario.docente || '',
                        local: horario.local || ''
                    })))
            );
        }

        function blocosDoDia(dia) {
            const doDia = aulas
                .filter(aula => aula.dia === dia)
                .sort((a, b) => a.hora - b.hora || a.disciplina.localeCompare(b.disciplina, 'pt-BR'));

            const blocos = [];
            doDia.forEach(aula => {
                const anterior = blocos.find(b => b.chave === aula.chave && b.fim === aula.hora);
                if (anterior) anterior.fim = aula.hora + 1;
                else blocos.push({ ...aula, inicio: aula.hora, fim: aula.hora + 1 });
            });
            return blocos.sort((a, b) => a.inicio - b.inicio);
        }

        // Monta a lista de aulas do dia selecionado, destacando as aulas em andamento.
        function renderizar() {
            const agora = agoraSP();
            const ehHoje = dataSelecionada === agora.data;
            const [a, m, d] = dataSelecionada.split('-').map(Number);
            const nomeDia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' })
                .format(new Date(Date.UTC(a, m - 1, d)));

            rotuloDia.textContent = nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1);
            rotuloData.textContent = `${formatarData(dataSelecionada)}${ehHoje ? ' · Hoje' : ''}`;
            btnHoje.hidden = ehHoje;

            lista.replaceChildren();

            if (!carregada) {
                lista.innerHTML = '<p class="student-dashboard-empty">Carregando aulas...</p>';
                return;
            }

            if (mensagemErro) {
                lista.innerHTML = `<p class="student-dashboard-empty">${escapeHtml(mensagemErro)}</p>`;
                return;
            }

            const blocos = blocosDoDia(diaDaSemana(dataSelecionada));
            if (!blocos.length) {
                lista.innerHTML = `<p class="student-dashboard-empty">${aulas.length
                    ? 'Nenhuma aula neste dia.'
                    : 'Você ainda não tem aulas na sua grade curricular.'}</p>`;
                return;
            }

            blocos.forEach(bloco => {
                const inicio = `${pad(bloco.inicio)}:00`;
                const fim = `${pad(bloco.fim)}:00`;
                const emAndamento = ehHoje && agora.hora >= inicio && agora.hora < fim;
                const encerrada = ehHoje && agora.hora >= fim;

                const item = document.createElement('article');
                item.className = `student-class-item${emAndamento ? ' is-ongoing' : ''}${encerrada ? ' is-past' : ''}`;
                item.innerHTML = `
                    <div class="student-class-time">${inicio} - ${fim}</div>
                    <div class="student-class-body">
                        <strong>${escapeHtml(bloco.disciplina)}</strong>
                        <small>Turma ${escapeHtml(bloco.turma)}${bloco.docente ? ` · ${escapeHtml(bloco.docente)}` : ''}${bloco.local ? ` · ${escapeHtml(bloco.local)}` : ''}</small>
                        ${emAndamento ? '<span class="student-class-live">Em andamento</span>' : ''}
                    </div>
                `;
                lista.append(item);
            });
        }

        async function carregar() {
            try {
                const dados = await obterGrade();
                aulas = montarAulas(dados);
                mensagemErro = '';
            } catch (erro) {
                console.error('Erro ao carregar as aulas:', erro);
                aulas = [];
                mensagemErro = erro.message || 'Não foi possível carregar suas aulas.';
            }
            carregada = true;
            renderizar();
        }

        btnAnterior.addEventListener('click', () => {
            dataSelecionada = somarDias(dataSelecionada, -1);
            renderizar();
        });
        btnProximo.addEventListener('click', () => {
            dataSelecionada = somarDias(dataSelecionada, 1);
            renderizar();
        });
        btnHoje.addEventListener('click', () => {
            dataSelecionada = agoraSP().data;
            renderizar();
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) carregar();
        });

        aoVirarMinuto(renderizar);

        renderizar();
        carregar();
    }
});
