(() => {
  const painel = document.querySelector('[data-importacao-csv]');
  if (!painel) return;

  const configuracoes = {
    alunos: ['cadastrar', 'nome email cpf instituicao telefone endereco curso turma', '', 'estudante'],
    docentes: ['cadastrar', 'nome email cpf instituicao especialidade', 'telefone', 'professor'],
    disciplinas: ['disciplinas', 'nome codigo semestre curso descricao', ''],
    cursos: ['cursos', 'codigo nome unidade grau modalidade duracao', 'descricao'],
    turmas: ['turmas', 'codigo curso periodoLetivo vagas', '']
  };
  const [rota, obrigatorios, opcionais, tipo] = configuracoes[painel.dataset.importacaoCsv];
  const entidade = painel.dataset.importacaoCsv;
  const camposObrigatorios = obrigatorios.split(' ');
  const campos = [...camposObrigatorios, ...opcionais.split(' ').filter(Boolean)];
  const arquivo = painel.querySelector('input');
  const importar = painel.querySelector('button');
  const status = painel.querySelector('[role="status"]');
  const tabela = painel.querySelector('table');
  const normalizar = valor => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  let registros = [];

  function adicionarCelulas(linha, valores, tag) {
    for (const valor of valores) {
      const celula = document.createElement(tag);
      celula.textContent = valor;
      linha.append(celula);
    }
  }

  painel.querySelector('small').textContent =
    'Colunas obrigatórias: ' + camposObrigatorios.join(', ') +
    (opcionais ? '. Opcional: ' + opcionais : '') +
    (campos.includes('curso') ? '. Informe o código ou nome exato do curso.' : '') +
    (entidade === 'disciplinas' ? ' Para disciplinas, codigo deve conter exatamente os dois dígitos finais.' : '') +
    (campos.includes('turma') ? ' Informe o código exato da turma.' : '') +
    ' Use UTF-8 e vírgula ou ponto e vírgula como separador.';
  adicionarCelulas(tabela.tHead.rows[0], ['Registro', ...campos, 'Resultado'], 'th');

  function lerCSV(texto) {
    texto = texto.replace(/^\uFEFF/, '');
    const cabecalho = texto.split(/\r?\n/, 1)[0];
    const separador = cabecalho.includes(';') ? ';' : ',';
    const linhas = [];
    let linha = [];
    let valor = '';
    let entreAspas = false;
    let aspasFechadas = false;

    for (let i = 0; i <= texto.length; i++) {
      const caractere = texto[i];
      if (entreAspas) {
        if (caractere === undefined) throw new Error('Há um campo com aspas abertas.');
        if (caractere === '"' && texto[i + 1] === '"') {
          valor += '"';
          i++;
        } else if (caractere === '"') {
          entreAspas = false;
          aspasFechadas = true;
        } else {
          valor += caractere;
        }
      } else if (caractere === separador || caractere === '\r' || caractere === '\n' || caractere === undefined) {
        linha.push(valor.trim());
        valor = '';
        aspasFechadas = false;
        if (caractere !== separador) {
          if (linha.some(Boolean)) linhas.push(linha);
          linha = [];
          if (caractere === '\r' && texto[i + 1] === '\n') i++;
        }
      } else if (aspasFechadas && (caractere === ' ' || caractere === '\t')) {
        continue;
      } else if (caractere === '"' && !valor.trim() && !aspasFechadas) {
        valor = '';
        entreAspas = true;
      } else if (aspasFechadas || caractere === '"') {
        throw new Error('Há aspas em posição inválida no CSV.');
      } else {
        valor += caractere;
      }
    }
    return linhas;
  }

  function prepararRegistro(dados, cursos, turmas) {
    for (const campo of camposObrigatorios) {
      if (!dados[campo]) throw new Error('Preencha ' + campo + '.');
    }

    const envio = { ...dados };
    let cursoSelecionado = null;
    for (const campo of campos) {
      if (campo === 'curso' || campo === 'semestre' || (entidade === 'turmas' && campo === 'periodoLetivo')) continue;
      const controle = document.querySelector('[name="' + campo + '"]');
      if (!controle) continue;
      const teste = controle.cloneNode(true);
      teste.value = dados[campo];
      if ((dados[campo] && !teste.value) || !teste.checkValidity()) {
        throw new Error('Valor inválido em ' + campo + '.');
      }
    }

    if (dados.curso) {
      const referencia = normalizar(dados.curso);
      const porCodigo = cursos.filter(curso => normalizar(curso.codigo) === referencia);
      const encontrados = porCodigo.length ? porCodigo : cursos.filter(curso => normalizar(curso.nome) === referencia);
      if (encontrados.length !== 1) {
        throw new Error(encontrados.length ? 'Nome de curso ambíguo. Use o código.' : 'Curso não encontrado.');
      }
      const [curso] = encontrados;
      cursoSelecionado = curso;
      envio.cursoId = curso.id;
      delete envio.curso;
      if (dados.semestre && (!Number.isInteger(Number(dados.semestre)) ||
          Number(dados.semestre) < 1 || Number(dados.semestre) > curso.duracao)) {
        throw new Error('Semestre fora da duração do curso.');
      }
      if (entidade === 'turmas') {
        const periodo = Number(dados.periodoLetivo);
        if (!Number.isInteger(periodo) || periodo < 1 || periodo > curso.duracao) {
          throw new Error('Período letivo fora da duração do curso.');
        }
      }
    }
    if (entidade === 'disciplinas') {
      const semestre = Number(dados.semestre);
      const sequencia = String(dados.codigo || '').trim();
      if (!cursoSelecionado || !/^\d{2}$/.test(cursoSelecionado.codigo || '')) {
        throw new Error('Disciplina precisa de um curso com código de dois dígitos.');
      }
      if (!Number.isInteger(semestre) || semestre < 1 || semestre > cursoSelecionado.duracao) {
        throw new Error('Semestre fora da duração do curso.');
      }
      if (!/^\d{2}$/.test(sequencia)) {
        throw new Error('Informe exatamente dois dígitos finais em codigo.');
      }
      envio.codigo = `${cursoSelecionado.codigo}${String(semestre).padStart(2, '0')}${sequencia}`;
    }
    if (entidade === 'turmas') {
      const codigo = String(dados.codigo || '').trim();
      const periodo = String(Number(dados.periodoLetivo)).padStart(2, '0');
      const numeroTurma = codigo.slice(2);
      if (
        !/^\d{4}$/.test(codigo) || !codigo.startsWith(periodo) ||
        !/^\d{2}$/.test(numeroTurma) || Number(numeroTurma) < 1 || Number(numeroTurma) > 99 ||
        String(Number(numeroTurma)).padStart(2, '0') !== numeroTurma
      ) {
        throw new Error('O código da turma deve usar o semestre em dois dígitos e um número de turma de 01 a 99.');
      }
    }
    if (dados.turma) {
      const turmaReferencia = normalizar(dados.turma);
      const turmasEncontradas = turmas.filter(turma =>
        normalizar(turma.codigo) === turmaReferencia && turma.cursoId === envio.cursoId
      );
      if (turmasEncontradas.length !== 1) {
        throw new Error(turmasEncontradas.length ? 'Código de turma ambíguo para este curso.' : 'Turma não encontrada para o curso informado.');
      }
      envio.turmaId = turmasEncontradas[0].id;
      delete envio.turma;
    }
    if (tipo) envio.tipo = tipo;
    return envio;
  }

  arquivo.addEventListener('change', async () => {
    registros = [];
    tabela.tBodies[0].replaceChildren();
    importar.disabled = true;
    status.textContent = '';
    const [selecionado] = arquivo.files;
    if (!selecionado) return;

    arquivo.disabled = true;
    try {
      if (selecionado.size > 2 * 1024 * 1024) throw new Error('O arquivo deve ter até 2 MB.');
      const [cabecalho, ...linhas] = lerCSV(await selecionado.text());
      if (!linhas.length) throw new Error('Inclua o cabeçalho e pelo menos um registro.');
      if (linhas.length > 500) throw new Error('Divida o CSV em arquivos de até 500 registros.');
      const colunas = cabecalho.map(normalizar);
      if (new Set(colunas).size !== colunas.length) throw new Error('Há colunas repetidas.');
      const faltantes = camposObrigatorios.filter(campo => !colunas.includes(normalizar(campo)));
      if (faltantes.length) throw new Error('Colunas ausentes: ' + faltantes.join(', ') + '.');

      let cursos = [];
      if (campos.includes('curso')) {
        const resposta = await fetch('/api/admin/cursos');
        if (!resposta.ok) throw new Error('Não foi possível carregar os cursos.');
        ({ cursos } = await resposta.json());
      }
      let turmas = [];
      if (campos.includes('turma')) {
        const resposta = await fetch('/api/admin/turmas');
        if (!resposta.ok) throw new Error('Não foi possível carregar as turmas.');
        ({ turmas } = await resposta.json());
      }

      registros = linhas.map((linha, indice) => {
        const dados = Object.fromEntries(campos.map(campo => [campo, linha[colunas.indexOf(normalizar(campo))] ?? '']));
        const tr = tabela.tBodies[0].insertRow();
        adicionarCelulas(tr, [indice + 1, ...campos.map(campo => dados[campo]), ''], 'td');
        const resultado = tr.lastElementChild;
        try {
          if (linha.length !== colunas.length) throw new Error('Número de campos diferente do cabeçalho.');
          const envio = prepararRegistro(dados, cursos, turmas);
          resultado.textContent = 'Pronto';
          return { envio, resultado };
        } catch (erro) {
          resultado.textContent = erro.message;
          return { resultado };
        }
      });
      const validos = registros.filter(registro => registro.envio).length;
      status.textContent = validos + ' de ' + registros.length + ' registros prontos para importar.';
      importar.disabled = !validos;
    } catch (erro) {
      status.textContent = erro.message;
    } finally {
      arquivo.disabled = false;
      arquivo.value = '';
    }
  });

  importar.addEventListener('click', async () => {
    importar.disabled = true;
    arquivo.disabled = true;
    let salvos = 0;
    let falhas = 0;
    status.textContent = 'Importando registros…';

    for (const { envio, resultado } of registros) {
      if (!envio) continue;
      try {
        const resposta = await fetch('/api/admin/' + rota, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(envio)
        });
        if (!resposta.ok) {
          const dados = await resposta.json().catch(() => ({}));
          throw new Error(dados.mensagem || 'O servidor retornou HTTP ' + resposta.status + '.');
        }
        resultado.textContent = 'Importado';
        salvos++;
      } catch (erro) {
        resultado.textContent = erro instanceof TypeError ? 'Conexão interrompida. Confira se o registro foi salvo.' : erro.message;
        falhas++;
      }
    }

    const invalidos = registros.length - salvos - falhas;
    status.textContent = salvos + ' importado(s), ' + falhas + ' com falha e ' + invalidos + ' inválido(s).';
    arquivo.disabled = false;
  });
})();
