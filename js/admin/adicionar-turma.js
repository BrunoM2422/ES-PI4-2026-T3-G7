document.addEventListener('DOMContentLoaded', () => {
  const cursoSelect = document.querySelector('[name="cursoId"]');
  const numeroTurmaInput = document.querySelector('[name="numeroTurma"]');
  const codigoPrefix = document.querySelector('[data-code-prefix]');
  const codigoPreview = document.querySelector('[data-code-preview]');
  const periodoInput = document.querySelector('[name="periodoLetivo"]');
  const vagasInput = document.querySelector('[name="vagas"]');
  const submitButton = document.querySelector('.admin-button');
  const status = document.querySelector('[role="status"]');
  let cursos = [];

  if (!cursoSelect || !submitButton || !status) return;

  const exibirMensagem = (mensagem, erro = false) => {
    status.textContent = mensagem;
    status.classList.toggle('is-error', erro);
  };

  async function carregarCursos() {
    try {
      const resposta = await fetch('/api/admin/cursos');
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível carregar os cursos.');

      cursoSelect.replaceChildren(new Option('Selecione um curso', ''));
      cursos = dados.cursos;
      dados.cursos.forEach(curso => {
        cursoSelect.add(new Option(`${curso.nome} (${curso.codigo})`, curso.id));
      });
      if (!dados.cursos.length) {
        cursoSelect.replaceChildren(new Option('Nenhum curso cadastrado', ''));
        submitButton.disabled = true;
      }
    } catch (erro) {
      cursoSelect.replaceChildren(new Option('Não foi possível carregar os cursos', ''));
      submitButton.disabled = true;
      exibirMensagem(erro.message, true);
    }
  }

  function atualizarSemestres() {
    const curso = cursos.find(item => item.id === cursoSelect.value);
    periodoInput.replaceChildren(new Option(curso ? 'Selecione o semestre' : 'Selecione um curso primeiro', ''));
    periodoInput.disabled = !curso;
    if (!curso) {
      codigoPrefix.textContent = '--';
      codigoPreview.textContent = 'Selecione o semestre para montar o código.';
      return;
    }
    for (let semestre = 1; semestre <= Number(curso.duracao); semestre += 1) {
      periodoInput.add(new Option(`${semestre}º semestre`, String(semestre)));
    }
  }

  cursoSelect.addEventListener('change', atualizarSemestres);
  function atualizarCodigoPreview() {
    const semestre = Number(periodoInput.value);
    const numero = Number(numeroTurmaInput.value);
    codigoPrefix.textContent = semestre ? String(semestre).padStart(2, '0') : '--';
    codigoPreview.textContent = semestre && Number.isInteger(numero) && numero >= 1 && numero <= 99
      ? `Código gerado: ${String(semestre).padStart(2, '0')}${String(numero).padStart(2, '0')}`
      : 'Informe o número da turma entre 1 e 99.';
  }
  periodoInput.addEventListener('change', atualizarCodigoPreview);
  numeroTurmaInput.addEventListener('input', atualizarCodigoPreview);

  submitButton.addEventListener('click', async () => {
    if (!window.validateAppFields([numeroTurmaInput, cursoSelect, periodoInput, vagasInput])) return;

    submitButton.disabled = true;
    submitButton.textContent = 'Cadastrando...';
    exibirMensagem('');

    try {
      const resposta = await fetch('/api/admin/turmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: `${String(Number(periodoInput.value)).padStart(2, '0')}${String(Number(numeroTurmaInput.value)).padStart(2, '0')}`,
          cursoId: cursoSelect.value,
          periodoLetivo: periodoInput.value.trim(),
          vagas: Number(vagasInput.value)
        })
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível cadastrar a turma.');

      exibirMensagem(dados.mensagem || 'Turma cadastrada com sucesso.');
      numeroTurmaInput.value = '';
      periodoInput.value = '';
      vagasInput.value = '';
      cursoSelect.value = '';
      atualizarSemestres();
      atualizarCodigoPreview();
    } catch (erro) {
      exibirMensagem(erro.message, true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Cadastrar turma';
    }
  });

  carregarCursos();
});
