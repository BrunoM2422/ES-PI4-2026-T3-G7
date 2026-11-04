document.addEventListener('DOMContentLoaded', () => {
  const pagina = document.querySelector('#app')?.dataset.page;

  if (pagina === 'adicionar-administrador') {
    const botao = document.querySelector('.admin-button');

    botao?.addEventListener('click', () => {
      const nome = document.querySelector('[name="nome"]');
      const email = document.querySelector('[name="email"]');
      const telefone = document.querySelector('[name="telefone"]');
      const senha = document.querySelector('[name="senha"]');
      const confirmarSenha = document.querySelector('[name="confirmarSenha"]');
      const permissao = document.querySelector('[name="permissao"]');
      const campos = [nome, email, telefone, senha, confirmarSenha, permissao];

      if (!window.validateAppFields(campos)) return;
      if (senha.value !== confirmarSenha.value) {
        confirmarSenha.setCustomValidity('As senhas não coincidem.');
        window.showAppMessage(confirmarSenha.validationMessage, 'error');
        confirmarSenha.focus();
        confirmarSenha.addEventListener('input', () => confirmarSenha.setCustomValidity(''), { once: true });
        return;
      }

      botao.disabled = true;
      botao.textContent = 'Cadastrando...';

      fetch('/api/admin/administradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.value.trim(),
          email: email.value.trim(),
          telefone: telefone.value.trim(),
          senha: senha.value,
          nivelPermissao: permissao.value
        })
      })
        .then(async response => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.mensagem || 'Não foi possível cadastrar o administrador.');
          }

          document.querySelector('.admin-local-note').textContent =
            'Administrador cadastrado com sucesso.';
          document.querySelectorAll('#app input').forEach(campo => {
            campo.value = '';
          });
          permissao.value = '';
        })
        .catch(erro => window.showAppMessage(erro.message))
        .finally(() => {
          botao.disabled = false;
          botao.textContent = 'Cadastrar administrador';
        });
    });
  }

  if (pagina === 'adicionar-disciplina') {
    const cursosSelect = document.querySelector('[name="curso"]');
    const semestreSelect = document.querySelector('[name="semestre"]');
    const codigoPrefixo = document.querySelector('[data-course-code-prefix]');
    const codigoComplemento = document.querySelector('[name="codigoComplemento"]');
    const botao = document.querySelector('.admin-button');
    const status = document.querySelector('[data-discipline-status]');
    let cursos = [];

    const atualizarSemestres = cursos => {
      const curso = cursos.find(item => item.id === cursosSelect.value);
      const duracao = Number(curso?.duracao || 0);

      semestreSelect.replaceChildren(new Option('Selecione o semestre', ''));
      for (let semestre = 1; semestre <= duracao; semestre += 1) {
        semestreSelect.add(new Option(`${semestre}º semestre`, String(semestre)));
      }
      semestreSelect.disabled = duracao === 0;
    };

    const atualizarPrefixoCodigo = () => {
      const curso = cursos.find(item => item.id === cursosSelect.value);
      const codigoValido = /^\d{2}$/.test(curso?.codigo || '');
      codigoPrefixo.textContent = codigoValido ? curso.codigo : '--';
      codigoComplemento.disabled = !codigoValido;
      codigoComplemento.value = '';
      codigoComplemento.placeholder = codigoValido ? 'Ex.: MAT01' : 'Selecione um curso';
    };

    codigoComplemento.addEventListener('input', () => {
      codigoComplemento.value = codigoComplemento.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    });

    fetch('/api/admin/cursos')
      .then(response => {
        if (!response.ok) throw new Error('Falha ao carregar cursos');
        return response.json();
      })
      .then(data => {
        cursos = data.cursos || [];
        cursosSelect.replaceChildren(new Option('Selecione um curso', ''));
        cursos.forEach(curso => {
          const option = new Option(`${curso.nome} (${curso.codigo})`, curso.id);
          option.disabled = !/^\d{2}$/.test(curso.codigo || '');
          if (option.disabled) option.textContent += ' - código do curso inválido';
          cursosSelect.add(option);
        });
        cursosSelect.disabled = cursos.length === 0;
        cursosSelect.addEventListener('change', () => {
          atualizarSemestres(cursos);
          atualizarPrefixoCodigo();
        });
      })
      .catch(() => {
        cursosSelect.replaceChildren(new Option('Não foi possível carregar cursos', ''));
        cursosSelect.disabled = true;
      });

    document.querySelector('.admin-button')?.addEventListener('click', () => {
      const campos = ['nome', 'codigoComplemento', 'semestre', 'curso', 'descricao'].map(nome =>
        document.querySelector(`[name="${nome}"]`)
      );

      if (!window.validateAppFields(campos)) return;

      const [nome, complemento, semestre, cursoSelect, descricao] = campos;
      const cursoSelecionado = cursos.find(item => item.id === cursoSelect.value);
      if (!/^\d{2}$/.test(cursoSelecionado?.codigo || '')) {
        status.textContent = 'Selecione um curso com código válido de dois dígitos.';
        return;
      }

      const codigo = `${cursoSelecionado.codigo}${complemento.value.trim().toUpperCase()}`;
      botao.disabled = true;
      botao.textContent = 'Cadastrando...';
      status.textContent = '';

      fetch('/api/admin/disciplinas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.value.trim(),
          codigo,
          semestre: Number(semestre.value),
          cursoId: cursoSelect.value,
          descricao: descricao.value.trim()
        })
      })
        .then(async response => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.mensagem || 'Não foi possível cadastrar a disciplina.');

          status.textContent = data.mensagem;
          document.querySelector('[name="nome"]').value = '';
          codigoComplemento.value = '';
          document.querySelector('[name="descricao"]').value = '';
          semestreSelect.value = '';
        })
        .catch(erro => {
          status.textContent = erro.message;
        })
        .finally(() => {
          botao.disabled = false;
          botao.textContent = 'Cadastrar disciplina';
        });
    });
  }
});
