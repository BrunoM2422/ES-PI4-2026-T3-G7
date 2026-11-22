// Autores: Bruno Machado — RA: 25008041
document.addEventListener('DOMContentLoaded', async () => {
  const linhas = document.querySelector('[data-history-rows]');
  const curso = document.querySelector('[data-history-course]');
  const quantidade = document.querySelector('[data-history-count]');
  if (!linhas) return;

  const mostrarMensagem = mensagem => {
    const linha = document.createElement('tr');
    const celula = document.createElement('td');
    celula.className = 'history-message';
    celula.colSpan = 3;
    celula.textContent = mensagem;
    linha.append(celula);
    linhas.replaceChildren(linha);
  };

  try {
    const response = await fetch('/api/aluno/historico');
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar o histórico escolar.');

    const disciplinas = data.disciplinas || [];
    if (curso) curso.textContent = data.curso || 'Curso não informado';
    if (quantidade) quantidade.textContent = `${disciplinas.length} ${disciplinas.length === 1 ? 'disciplina' : 'disciplinas'}`;

    if (!disciplinas.length) {
      mostrarMensagem('Ainda não há disciplinas cadastradas para este curso.');
      return;
    }

    const fragmento = document.createDocumentFragment();
    const matriculadas = disciplinas.filter(disciplina => disciplina.situacao === 'matriculado');
    const porSemestre = new Map();
    disciplinas
      .filter(disciplina => disciplina.situacao !== 'matriculado')
      .forEach(disciplina => {
        const semestre = disciplina.semestre;
        if (!porSemestre.has(semestre)) porSemestre.set(semestre, []);
        porSemestre.get(semestre).push(disciplina);
      });

    let proximoId = 0;
    const adicionarGrupo = (nome, itens, { id, aberto = false, linhaVazia = '' } = {}) => {
      const linhaGrupo = document.createElement('tr');
      linhaGrupo.className = `history-semester-row${id === 'matriculadas' ? ' history-current-row' : ''}`;
      const tituloGrupo = document.createElement('th');
      tituloGrupo.colSpan = 3;
      const botaoGrupo = document.createElement('button');
      botaoGrupo.className = 'history-group-toggle';
      botaoGrupo.type = 'button';
      botaoGrupo.setAttribute('aria-expanded', String(aberto));
      botaoGrupo.textContent = `${nome} (${itens.length})`;

      const linhasDoGrupo = [];
      const numeroGrupo = proximoId++;
      const grupoId = `history-group-${numeroGrupo}`;
      botaoGrupo.id = `${grupoId}-toggle`;
      const adicionarLinhaVazia = mensagem => {
        const linha = document.createElement('tr');
        linha.id = `${grupoId}-row-${proximoId++}`;
        linha.className = 'history-group-empty';
        const celula = document.createElement('td');
        celula.colSpan = 3;
        celula.textContent = mensagem;
        linha.append(celula);
        linhasDoGrupo.push(linha);
      };

      tituloGrupo.append(botaoGrupo);
      linhaGrupo.append(tituloGrupo);
      fragmento.append(linhaGrupo);

      if (!itens.length && linhaVazia) adicionarLinhaVazia(linhaVazia);
      itens.forEach(disciplina => {
        const linha = document.createElement('tr');
        linha.id = `${grupoId}-row-${proximoId++}`;
        const nome = document.createElement('th');
        nome.className = 'history-discipline-name';
        nome.scope = 'row';
        nome.textContent = disciplina.nome;

        const media = document.createElement('td');
        media.className = 'history-average';
        media.textContent = Number.isFinite(Number(disciplina.mediaFinal)) && disciplina.mediaFinal !== null
          ? Number(disciplina.mediaFinal).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
          : '—';

        const situacao = String(disciplina.situacao || 'nc').toLowerCase();
        const rotulosSituacao = {
          aprovado: 'Aprovado',
          reprovado: 'Reprovado',
          matriculado: 'Matriculado',
          nc: 'NC'
        };
        const celulaSituacao = document.createElement('td');
        const etiquetaSituacao = document.createElement('span');
        etiquetaSituacao.className = 'history-status';
        etiquetaSituacao.dataset.status = rotulosSituacao[situacao] ? situacao : 'nc';
        etiquetaSituacao.textContent = rotulosSituacao[situacao] || 'NC';
        if (situacao === 'nc') etiquetaSituacao.title = 'Não cursada';
        celulaSituacao.append(etiquetaSituacao);

        linha.append(nome, media, celulaSituacao);
        linhasDoGrupo.push(linha);
      });

      const linhasIds = linhasDoGrupo.map(linha => linha.id).filter(Boolean);
      if (linhasIds.length) botaoGrupo.setAttribute('aria-controls', linhasIds.join(' '));
      linhasDoGrupo.forEach(linha => {
        linha.hidden = !aberto;
        fragmento.append(linha);
      });
      botaoGrupo.addEventListener('click', () => {
        const expandido = botaoGrupo.getAttribute('aria-expanded') !== 'true';
        botaoGrupo.setAttribute('aria-expanded', String(expandido));
        linhasDoGrupo.forEach(linha => { linha.hidden = !expandido; });
      });
    };

    adicionarGrupo('Matérias matriculadas', matriculadas, {
      id: 'matriculadas',
      aberto: true,
      linhaVazia: 'Nenhuma disciplina matriculada no momento.'
    });
    porSemestre.forEach((itens, semestre) => {
      adicionarGrupo(`${semestre}º semestre`, itens, { id: `semestre-${semestre}` });
    });
    linhas.replaceChildren(fragmento);
  } catch (erro) {
    if (curso) curso.textContent = 'Histórico indisponível';
    if (quantidade) quantidade.textContent = '— disciplinas';
    mostrarMensagem(erro.message || 'Não foi possível carregar o histórico escolar.');
    console.error('Erro ao carregar histórico escolar:', erro);
  }
});
