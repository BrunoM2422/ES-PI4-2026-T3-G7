// Autores:
document.addEventListener('DOMContentLoaded', () => {
  const cursoSelect = document.querySelector('[name="cursoId"]');
  const letraTurmaInput = document.querySelector('[name="letraTurma"]');
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
    letraTurmaInput.disabled = !curso || !periodoInput.value;
    if (!curso) {
      codigoPrefix.textContent = '--';
      codigoPreview.textContent = 'Selecione o semestre para montar o código.';
      return;
    }
    codigoPrefix.textContent = curso.codigo;
    for (let semestre = 1; semestre <= Number(curso.duracao); semestre += 1) {
      periodoInput.add(new Option(`${semestre}º semestre`, String(semestre)));
    }
    letraTurmaInput.disabled = true;
    atualizarCodigoPreview();
  }

  cursoSelect.addEventListener('change', atualizarSemestres);
  function atualizarCodigoPreview() {
    const semestre = Number(periodoInput.value);
    const curso = cursos.find(item => item.id === cursoSelect.value);
    letraTurmaInput.disabled = !curso || !semestre;
    codigoPrefix.textContent = curso ? `${curso.codigo}${semestre ? String(semestre).padStart(2, '0') : ''}` : '--';
    codigoPreview.textContent = curso && semestre && letraTurmaInput.value
      ? `Código gerado: ${curso.codigo}${String(semestre).padStart(2, '0')}${letraTurmaInput.value}`
      : 'Selecione o grupo A, B ou C.';
  }
  periodoInput.addEventListener('change', atualizarCodigoPreview);
  letraTurmaInput.addEventListener('change', atualizarCodigoPreview);

  submitButton.addEventListener('click', async () => {
    if (!window.validateAppFields([letraTurmaInput, cursoSelect, periodoInput, vagasInput])) return;

    submitButton.disabled = true;
    submitButton.textContent = 'Cadastrando...';
    exibirMensagem('');

    try {
      const resposta = await fetch('/api/admin/turmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: `${cursos.find(item => item.id === cursoSelect.value).codigo}${String(Number(periodoInput.value)).padStart(2, '0')}${letraTurmaInput.value}`,
          cursoId: cursoSelect.value,
          periodoLetivo: periodoInput.value.trim(),
          vagas: Number(vagasInput.value)
        })
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível cadastrar a turma.');

      exibirMensagem(dados.mensagem || 'Turma cadastrada com sucesso.');
      letraTurmaInput.value = '';
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
