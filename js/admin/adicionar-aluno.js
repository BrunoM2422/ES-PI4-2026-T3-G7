document.addEventListener('DOMContentLoaded', () => {
  const botaoCadastrar = document.querySelector('.admin-button');
  if (!botaoCadastrar) return;

  const campoCurso = document.querySelector('input[name="cursoBusca"]');
  const cursoIdInput = document.querySelector('input[name="cursoId"]');
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
    fecharLista();
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

    if (!nome || !email || !cpf) {
      alert('Preencha os campos obrigatórios (Nome, E-mail e CPF).');
      return;
    }

    if (!cursoId) {
      alert('Selecione um curso válido na lista de sugestões.');
      campoCurso.focus();
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
          tipo: 'estudante',
          instituicao
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.mensagem || 'Não foi possível cadastrar o aluno.');
        return;
      }

      alert('Aluno cadastrado com sucesso!');
      window.location.reload();
    } catch (erro) {
      console.error('Erro na requisição:', erro);
      alert('Erro ao conectar com o servidor.');
    }
  });
});
