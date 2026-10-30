document.addEventListener('DOMContentLoaded', () => {
  const pagina = document.querySelector('#app')?.dataset.page;

  if (pagina === 'adicionar-administrador') {
    const botao = document.querySelector('.admin-button');

    botao?.addEventListener('click', () => {
      const nome = document.querySelector('[name="nome"]');
      const email = document.querySelector('[name="email"]');
      const telefone = document.querySelector('[name="telefone"]');
      const permissao = document.querySelector('[name="permissao"]');
      const campos = [nome, email, telefone, permissao];

      if (!campos.every(campo => campo.reportValidity())) return;

      botao.disabled = true;
      botao.textContent = 'Cadastrando...';

      fetch('/api/admin/administradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.value.trim(),
          email: email.value.trim(),
          telefone: telefone.value.trim(),
          nivelPermissao: permissao.value
        })
      })
        .then(async response => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.mensagem || 'Não foi possível cadastrar o administrador.');
          }

          alert(data.mensagem);
          document.querySelector('.admin-local-note').textContent =
            'Administrador cadastrado com sucesso.';
          document.querySelectorAll('#app input').forEach(campo => {
            campo.value = '';
          });
          permissao.value = '';
        })
        .catch(erro => alert(erro.message))
        .finally(() => {
          botao.disabled = false;
          botao.textContent = 'Cadastrar administrador';
        });
    });
  }

  if (pagina === 'adicionar-disciplina') {
    const cursosSelect = document.querySelector('[name="curso"]');
    const semestreSelect = document.querySelector('[name="semestre"]');
    const atualizarSemestres = cursos => {
      const curso = cursos.find(item => item.id === cursosSelect.value);
      const duracao = Number(curso?.duracao || 0);

      semestreSelect.replaceChildren(new Option('Selecione o semestre', ''));
      for (let semestre = 1; semestre <= duracao; semestre += 1) {
        semestreSelect.add(new Option(`${semestre}º semestre`, String(semestre)));
      }
      semestreSelect.disabled = duracao === 0;
    };

    fetch('/api/admin/cursos')
      .then(response => {
        if (!response.ok) throw new Error('Falha ao carregar cursos');
        return response.json();
      })
      .then(data => {
        const cursos = data.cursos || [];
        cursosSelect.replaceChildren(new Option('Selecione um curso', ''));
        cursos.forEach(curso => {
          cursosSelect.add(new Option(`${curso.nome} (${curso.codigo})`, curso.id));
        });
        cursosSelect.disabled = cursos.length === 0;
        cursosSelect.addEventListener('change', () => atualizarSemestres(cursos));
      })
      .catch(() => {
        cursosSelect.replaceChildren(new Option('Não foi possível carregar cursos', ''));
        cursosSelect.disabled = true;
      });

    document.querySelector('.admin-button')?.addEventListener('click', () => {
      const campos = ['nome', 'codigo', 'semestre', 'curso', 'descricao'].map(nome =>
        document.querySelector(`[name="${nome}"]`)
      );

      if (!campos.every(campo => campo.reportValidity())) return;

      alert('Disciplina conferida. Ela ainda não será salva no banco de dados.');
      document.querySelector('.admin-local-note').textContent =
        'Disciplina pronta para ser conectada ao catálogo quando a persistência for implementada.';
    });
  }
});
