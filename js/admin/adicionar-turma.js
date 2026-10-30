document.addEventListener('DOMContentLoaded', () => {
  const cursoSelect = document.querySelector('[name="cursoId"]');
  const codigoInput = document.querySelector('[name="codigo"]');
  const periodoInput = document.querySelector('[name="periodoLetivo"]');
  const vagasInput = document.querySelector('[name="vagas"]');
  const submitButton = document.querySelector('.admin-button');
  const status = document.querySelector('[role="status"]');

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

  submitButton.addEventListener('click', async () => {
    if (!codigoInput.reportValidity() || !cursoSelect.reportValidity() ||
        !periodoInput.reportValidity() || !vagasInput.reportValidity()) return;

    submitButton.disabled = true;
    submitButton.textContent = 'Cadastrando...';
    exibirMensagem('');

    try {
      const resposta = await fetch('/api/admin/turmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: codigoInput.value.trim(),
          cursoId: cursoSelect.value,
          periodoLetivo: periodoInput.value.trim(),
          vagas: Number(vagasInput.value)
        })
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível cadastrar a turma.');

      exibirMensagem(dados.mensagem || 'Turma cadastrada com sucesso.');
      codigoInput.value = '';
      periodoInput.value = '';
      vagasInput.value = '';
      cursoSelect.value = '';
    } catch (erro) {
      exibirMensagem(erro.message, true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Cadastrar turma';
    }
  });

  carregarCursos();
});
