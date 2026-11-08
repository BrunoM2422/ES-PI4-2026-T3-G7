document.addEventListener('DOMContentLoaded', () => {
  const associacao = document.querySelector('[data-associar-estudante]');
  if (associacao) {
    const estudanteSelect = associacao.querySelector('[name="estudanteExistente"]');
    const turmaExistenteSelect = associacao.querySelector('[name="turmaExistente"]');
    const botaoVincular = associacao.querySelector('[data-vincular-turma]');
    const statusVinculo = associacao.querySelector('[data-vinculo-status]');
    let estudantes = [];

    const carregarEstudantes = async () => {
      try {
        const response = await fetch('/api/admin/estudantes/turmas', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('notadez_token') || ''}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar os alunos.');
        estudantes = data.estudantes || [];
        estudanteSelect.replaceChildren(new Option('Selecione um aluno', ''));
        estudantes.forEach(estudante => {
          estudanteSelect.add(new Option(`${estudante.nome} (${estudante.email})`, estudante.id));
        });
        estudanteSelect.disabled = estudantes.length === 0;
      } catch (erro) {
        statusVinculo.textContent = erro.message;
        estudanteSelect.replaceChildren(new Option('Não foi possível carregar alunos', ''));
        estudanteSelect.disabled = true;
      }
    };

    estudanteSelect.addEventListener('change', async () => {
      const estudante = estudantes.find(item => item.id === estudanteSelect.value);
      turmaExistenteSelect.disabled = true;
      turmaExistenteSelect.replaceChildren(new Option('Carregando turmas...', ''));
      if (!estudante?.cursoId) {
        turmaExistenteSelect.replaceChildren(new Option('Aluno sem curso associado', ''));
        return;
      }
      try {
        const response = await fetch(`/api/admin/turmas?cursoId=${encodeURIComponent(estudante.cursoId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar as turmas.');
        const turmas = data.turmas || [];
        turmaExistenteSelect.replaceChildren(new Option('Selecione uma turma', ''));
        turmas.forEach(turma => turmaExistenteSelect.add(new Option(`${turma.codigo} · ${turma.periodoLetivo}`, turma.id)));
        turmaExistenteSelect.value = estudante.turmaId || '';
        turmaExistenteSelect.disabled = turmas.length === 0;
      } catch (erro) {
        turmaExistenteSelect.replaceChildren(new Option(erro.message, ''));
      }
    });

    botaoVincular.addEventListener('click', async () => {
      if (!estudanteSelect.reportValidity() || !turmaExistenteSelect.reportValidity()) return;
      botaoVincular.disabled = true;
      statusVinculo.textContent = '';
      try {
        const response = await fetch(`/api/admin/estudantes/${estudanteSelect.value}/turma`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionStorage.getItem('notadez_token') || ''}`
          },
          body: JSON.stringify({ turmaId: turmaExistenteSelect.value })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensagem || 'Não foi possível vincular o aluno.');
        statusVinculo.textContent = data.mensagem;
        const estudante = estudantes.find(item => item.id === estudanteSelect.value);
        if (estudante) estudante.turmaId = turmaExistenteSelect.value;
      } catch (erro) {
        statusVinculo.textContent = erro.message;
      } finally {
        botaoVincular.disabled = false;
      }
    });

    carregarEstudantes();
  }

  const botaoCadastrar = document.querySelector('[data-cadastrar-aluno]');
  if (!botaoCadastrar) return;

  const campoCurso = document.querySelector('input[name="cursoBusca"]');
  const cursoIdInput = document.querySelector('input[name="cursoId"]');
  const turmaSelect = document.querySelector('select[name="turmaId"]');
  const listaCursos = document.querySelector('#curso-opcoes');
  const statusCursos = document.querySelector('#curso-status');
  let cursos = [];
  let indiceAtivo = -1;

  const normalizarTexto = texto => texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

  const fecharLista = () => {
    listaCursos.hidden = true;
    campoCurso.setAttribute('aria-expanded', 'false');
    campoCurso.removeAttribute('aria-activedescendant');
    indiceAtivo = -1;
  };

  const selecionarCurso = curso => {
    campoCurso.value = curso.nome;
    cursoIdInput.value = curso.id;
    statusCursos.textContent = `Curso selecionado: ${curso.nome} (${curso.codigo}).`;
    carregarTurmas(curso.id);
    fecharLista();
  };

  const carregarTurmas = async cursoId => {
    turmaSelect.disabled = true;
    turmaSelect.replaceChildren(new Option('Carregando turmas...', ''));
    try {
      const response = await fetch(`/api/admin/turmas?cursoId=${encodeURIComponent(cursoId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar as turmas.');
      const turmas = data.turmas || [];
      turmaSelect.replaceChildren(new Option(
        turmas.length ? 'Selecione uma turma' : 'Nenhuma turma cadastrada para este curso',
        ''
      ));
      turmas.forEach(turma => {
        turmaSelect.add(new Option(`${turma.codigo} · ${turma.periodoLetivo}`, turma.id));
      });
      turmaSelect.disabled = turmas.length === 0;
    } catch (erro) {
      console.error('Erro ao carregar turmas:', erro);
      turmaSelect.replaceChildren(new Option('Não foi possível carregar turmas', ''));
    }
  };

  const renderizarCursos = (termo = '') => {
    const consulta = normalizarTexto(termo.trim());
    const filtrados = cursos.filter(curso => {
      const textoCurso = normalizarTexto(`${curso.nome} ${curso.codigo} ${curso.unidade}`);
      return !consulta || textoCurso.includes(consulta);
    });

    listaCursos.replaceChildren();
    indiceAtivo = -1;

    if (!filtrados.length) {
      const vazio = document.createElement('div');
      vazio.className = 'admin-course-option';
      vazio.textContent = 'Nenhum curso compatível encontrado.';
      listaCursos.append(vazio);
    } else {
      filtrados.forEach((curso, indice) => {
        const opcao = document.createElement('button');
        opcao.type = 'button';
        opcao.id = `curso-opcao-${indice}`;
        opcao.className = 'admin-course-option';
        opcao.setAttribute('role', 'option');
        opcao.setAttribute('aria-selected', 'false');

        const nome = document.createElement('span');
        nome.textContent = curso.nome;
        const detalhes = document.createElement('small');
        detalhes.textContent = `${curso.codigo} · ${curso.unidade}`;
        opcao.append(nome, detalhes);
        opcao.addEventListener('click', () => selecionarCurso(curso));
        listaCursos.append(opcao);
      });
    }

    listaCursos.hidden = false;
    campoCurso.setAttribute('aria-expanded', 'true');
    campoCurso.removeAttribute('aria-activedescendant');
  };

  const atualizarOpcaoAtiva = novoIndice => {
    const opcoes = listaCursos.querySelectorAll('[role="option"]');
    if (!opcoes.length) return;

    indiceAtivo = (novoIndice + opcoes.length) % opcoes.length;
    opcoes.forEach((opcao, indice) => {
      const ativa = indice === indiceAtivo;
      opcao.setAttribute('aria-selected', String(ativa));
      if (ativa) {
        campoCurso.setAttribute('aria-activedescendant', opcao.id);
        opcao.scrollIntoView({ block: 'nearest' });
      }
    });
  };

  const carregarCursos = async () => {
    try {
      const response = await fetch('/api/admin/cursos');
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar os cursos.');

      cursos = data.cursos || [];
      statusCursos.textContent = cursos.length
        ? `${cursos.length} curso(s) disponível(is).`
        : 'Nenhum curso cadastrado.';
      campoCurso.disabled = cursos.length === 0;
    } catch (erro) {
      console.error('Erro ao carregar cursos:', erro);
      statusCursos.textContent = 'Não foi possível carregar os cursos.';
      campoCurso.disabled = true;
    }
  };

  campoCurso.addEventListener('focus', () => renderizarCursos(campoCurso.value));
  campoCurso.addEventListener('input', () => {
    cursoIdInput.value = '';
    turmaSelect.value = '';
    turmaSelect.replaceChildren(new Option('Selecione um curso primeiro', ''));
    turmaSelect.disabled = true;
    renderizarCursos(campoCurso.value);
    statusCursos.textContent = campoCurso.value.trim()
      ? 'Escolha um curso na lista de sugestões.'
      : `${cursos.length} curso(s) disponível(is).`;
  });

  campoCurso.addEventListener('keydown', event => {
    const opcoes = listaCursos.querySelectorAll('[role="option"]');
    if (event.key === 'ArrowDown' && !listaCursos.hidden) {
      event.preventDefault();
      atualizarOpcaoAtiva(indiceAtivo + 1);
    } else if (event.key === 'ArrowUp' && !listaCursos.hidden) {
      event.preventDefault();
      atualizarOpcaoAtiva(indiceAtivo - 1);
    } else if (event.key === 'Enter' && indiceAtivo >= 0 && opcoes[indiceAtivo]) {
      event.preventDefault();
      opcoes[indiceAtivo].click();
    } else if (event.key === 'Escape') {
      fecharLista();
    }
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.admin-course-field')) fecharLista();
  });

  carregarCursos();

  botaoCadastrar.addEventListener('click', async () => {
    const nome = document.querySelector('input[name="nome"]').value.trim();
    const email = document.querySelector('input[name="email"]').value.trim().toLowerCase();
    const cpf = document.querySelector('input[name="cpf"]').value.trim();
    const telefone = document.querySelector('input[name="telefone"]').value.trim();
    const endereco = document.querySelector('input[name="endereco"]').value.trim();
    const instituicao = document.querySelector('input[name="instituicao"]').value.trim();
    const cursoId = cursoIdInput.value;
    const turmaId = turmaSelect.value;

    if (!nome || !email || !cpf) {
      window.showAppMessage('Preencha os campos obrigatórios (Nome, E-mail e CPF).');
      return;
    }

    if (!cursoId) {
      window.showAppMessage('Selecione um curso válido na lista de sugestões.');
      campoCurso.focus();
      return;
    }

    if (!turmaId) {
      window.showAppMessage('Selecione a turma do aluno.');
      turmaSelect.focus();
      return;
    }

    try {
      const response = await fetch('/api/admin/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          cpf,
          telefone,
          endereco,
          cursoId,
          turmaId,
          tipo: 'estudante',
          instituicao
        })
      });

      const data = await response.json();

      if (!response.ok) {
        window.showAppMessage(data.mensagem || 'Não foi possível cadastrar o aluno.');
        return;
      }

      window.showAppMessage('Aluno cadastrado com sucesso!');
      ['nome', 'email', 'cpf', 'telefone', 'endereco', 'instituicao'].forEach(name => {
        const field = document.querySelector(`[name="${name}"]`);
        if (field) field.value = '';
      });
      campoCurso.value = '';
      cursoIdInput.value = '';
      turmaSelect.value = '';
      turmaSelect.replaceChildren(new Option('Selecione um curso primeiro', ''));
      turmaSelect.disabled = true;
      statusCursos.textContent = '';
    } catch (erro) {
      console.error('Erro na requisição:', erro);
      window.showAppMessage('Erro ao conectar com o servidor.');
    }
  });
});
