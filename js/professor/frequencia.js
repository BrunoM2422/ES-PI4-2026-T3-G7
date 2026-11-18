document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.querySelector('[data-frequency-grid]');
  const details = document.querySelector('[data-frequency-details]');
  const count = document.querySelector('[data-frequency-count]');
  if (!grid || !details) return;

  const criar = (tag, classe, texto) => {
    const node = document.createElement(tag);
    if (classe) node.className = classe;
    if (texto !== undefined) node.textContent = texto;
    return node;
  };
  const query = new URLSearchParams(location.search);
  let turmas = [];

  function renderizar() {
    if (count) count.textContent = `${turmas.length} ${turmas.length === 1 ? 'turma' : 'turmas'}`;
    grid.replaceChildren();
    if (!turmas.length) {
      grid.append(criar('p', 'teacher-empty-message', 'Você ainda não está vinculado a nenhuma turma com aulas organizadas.'));
      return;
    }
    turmas.forEach(turma => {
      const card = criar('button', 'teacher-class-card');
      card.type = 'button';
      card.append(criar('span', 'teacher-class-card-top', `${turma.periodoLetivo}º período`));
      card.append(criar('strong', 'teacher-class-card-course', `Turma ${turma.codigo}`));
      card.append(criar('span', 'teacher-class-card-subjects', turma.materias.map(m => `${m.nome}: até ${m.maxFaltas} faltas`).join(' · ')));
      card.addEventListener('click', () => abrir(turma));
      grid.append(card);
    });
  }

  async function abrir(turma) {
    grid.hidden = true;
    if (count) count.hidden = true;
    details.hidden = false;
    details.replaceChildren(criar('p', 'teacher-empty-message', 'Carregando chamada...'));
    try {
      const response = await fetch(`/api/professor/frequencia/turmas/${encodeURIComponent(turma.id)}/aulas`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar a turma.');
      details.replaceChildren();
      const voltar = criar('button', 'teacher-class-close frequency-back-button', '← Voltar');
      voltar.type = 'button';
      voltar.addEventListener('click', () => { details.hidden = true; grid.hidden = false; if (count) count.hidden = false; query.delete('turmaId'); history.replaceState(null, '', location.pathname); });
      details.append(voltar);
      const telaChamada = criar('div', 'frequency-call-screen');
      details.append(telaChamada);
      const heading = criar('div', 'teacher-class-detail-heading');
      const info = criar('div');
      info.append(criar('span', 'teacher-classes-eyebrow', `Turma ${data.turma.codigo}`));
      info.append(criar('h2', '', 'Chamada e faltas'));
      info.append(criar('p', '', data.materias.map(m => `${m.nome}: ${m.ocorrenciasSemanais * 4} faltas permitidas (75% de presença)`).join(' · ')));
      heading.append(info);
      telaChamada.append(heading);

      const aulaLabel = document.createElement('label');
      aulaLabel.className = 'teacher-announcement-form';
      aulaLabel.append(criar('span', '', 'Aula de hoje'));
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Aula de hoje');
      const agora = new Date();
      const minutos = agora.getHours() * 60 + agora.getMinutes();
      const opcaoInicial = new Option('Selecione uma aula no horário atual', '');
      opcaoInicial.disabled = true;
      opcaoInicial.selected = true;
      select.add(opcaoInicial);
      data.aulasHoje.forEach(aula => {
        const option = new Option(`${aula.disciplina} · ${String(aula.inicio).padStart(2, '0')}:00–${String(aula.fim).padStart(2, '0')}:00`, aula.id);
        option.disabled = minutos < aula.inicio * 60 || minutos >= aula.fim * 60;
        if (!option.disabled && select.value === '') option.selected = true;
        select.add(option);
      });
      aulaLabel.append(select);
      telaChamada.append(aulaLabel);

      const chamada = criar('section', 'teacher-class-roster');
      const mensagem = criar('p', 'teacher-class-module-note', data.aulasHoje.length ? 'A chamada só fica disponível durante o horário da aula.' : 'Não há aulas suas hoje nesta turma.');
      const form = document.createElement('form');
      form.className = 'teacher-roster-table-wrap';
      const tabela = document.createElement('table');
      tabela.className = 'teacher-roster-table';
      tabela.innerHTML = '<thead><tr><th>Aluno</th><th>Presente</th></tr></thead>';
      const corpo = document.createElement('tbody');
      data.alunos.forEach(aluno => {
        const tr = document.createElement('tr');
        const nome = criar('td', 'teacher-roster-name', aluno.nome);
        const presenca = document.createElement('td');
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.dataset.aluno = aluno.id;
        label.append(checkbox, document.createTextNode(' Presente'));
        presenca.append(label);
        tr.append(nome, presenca);
        corpo.append(tr);
      });
      tabela.append(corpo);
      const salvar = criar('button', 'teacher-class-action is-primary', 'Registrar chamada');
      salvar.type = 'submit';
      const feedback = criar('p', 'teacher-announcement-feedback', '');
      feedback.setAttribute('role', 'status');
      form.append(tabela, salvar, feedback);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!select.value) { feedback.textContent = 'Selecione uma aula que esteja acontecendo agora.'; return; }
        salvar.disabled = true;
        const presencas = [...form.querySelectorAll('[data-aluno]')].map(input => ({ alunoId: input.dataset.aluno, presente: input.checked }));
        try {
          const response = await fetch(`/api/professor/frequencia/turmas/${encodeURIComponent(turma.id)}/chamada`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aulaId: select.value, data: `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`, presencas }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.mensagem || 'Não foi possível registrar a chamada.');
          feedback.textContent = result.mensagem;
        } catch (erro) { feedback.textContent = erro.message; }
        finally { salvar.disabled = false; }
      });
      chamada.append(mensagem, form);
      telaChamada.append(chamada);

      const historico = criar('section', 'teacher-class-roster');
      historico.append(criar('h3', '', 'Faltas passadas')); 
      const verSemestre = criar('button', 'teacher-class-action', 'Ver todas as aulas do semestre');
      verSemestre.type = 'button';
      historico.append(verSemestre);
      telaChamada.append(historico);
      verSemestre.addEventListener('click', async () => {
        verSemestre.disabled = true;
        const visaoSemestre = criar('section', 'teacher-class-roster frequency-semester-view');
        visaoSemestre.append(criar('p', 'teacher-empty-message', 'Carregando aulas do semestre...'));
        telaChamada.hidden = true;
        telaChamada.after(visaoSemestre);
        try {
          const response = await fetch(`/api/professor/frequencia/turmas/${encodeURIComponent(turma.id)}/semestre`);
          const dados = await response.json();
          if (!response.ok) throw new Error(dados.mensagem || 'Não foi possível carregar as aulas do semestre.');
          visaoSemestre.replaceChildren();
          const voltarChamada = criar('button', 'teacher-class-close frequency-back-button', '← Voltar à chamada');
          voltarChamada.type = 'button';
          voltarChamada.addEventListener('click', () => { visaoSemestre.remove(); telaChamada.hidden = false; });
          visaoSemestre.append(voltarChamada);
          visaoSemestre.append(criar('h3', '', 'Aulas do semestre'));
          visaoSemestre.append(criar('p', 'teacher-class-module-note', `Período exibido: ${dados.periodo.inicio} a ${dados.periodo.fim}. Só é possível editar aulas que já terminaram.`));
          if (!dados.aulas.length) {
            visaoSemestre.append(criar('p', 'teacher-empty-message', 'Não há aulas programadas para esta turma no período.'));
            return;
          }
          const lista = criar('div', 'frequency-semester-list');
          dados.aulas.forEach(aula => {
            const item = criar('article', 'frequency-semester-item');
            const nomeData = new Date(`${aula.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
            const cabecalhoAula = criar('div', 'frequency-semester-item-heading');
            cabecalhoAula.append(criar('strong', '', `${aula.disciplina} · ${nomeData}`));
            const alternar = criar('button', 'frequency-semester-toggle', '⌄');
            alternar.type = 'button';
            alternar.setAttribute('aria-expanded', 'false');
            alternar.setAttribute('aria-label', 'Mostrar detalhes da aula');
            const conteudo = criar('div', 'frequency-semester-item-content');
            conteudo.hidden = true;
            alternar.addEventListener('click', () => {
              conteudo.hidden = !conteudo.hidden;
              alternar.textContent = conteudo.hidden ? '⌄' : '⌃';
              alternar.setAttribute('aria-expanded', String(!conteudo.hidden));
              alternar.setAttribute('aria-label', conteudo.hidden ? 'Mostrar detalhes da aula' : 'Ocultar detalhes da aula');
            });
            cabecalhoAula.append(alternar);
            item.append(cabecalhoAula);
            conteudo.append(criar('span', 'teacher-class-meta', `${String(aula.inicio).padStart(2, '0')}:00–${String(aula.fim).padStart(2, '0')}:00 · ${aula.chamadaRegistrada ? 'chamada registrada' : 'presença inicial: 100%'}`));
            const ausentes = aula.alunos.filter(aluno => aluno.presente === false);
            const presentes = aula.alunos.filter(aluno => aluno.presente === true);
            presentes.forEach(aluno => conteudo.append(criar('p', 'frequency-attendance-row is-present', `${aluno.nome} · Presente`)));
            if (!aula.passou) {
              conteudo.append(criar('p', 'teacher-class-module-note', 'Aula futura: todos começam com presença.'));
            } else if (!aula.chamadaRegistrada) {
              conteudo.append(criar('p', 'teacher-class-module-note', 'Aula sem chamada; a presença padrão continua em 100%.'));
            } else if (!ausentes.length) {
              conteudo.append(criar('p', 'teacher-class-module-note', 'Não há ausências para reverter. As presenças ficam somente para consulta.'));
            } else {
              ausentes.forEach(aluno => {
                const linhaAusencia = criar('div', 'frequency-attendance-row is-absent');
                linhaAusencia.append(criar('span', '', `${aluno.nome} · Ausente`));
                const reverter = criar('button', 'teacher-class-action', 'Reverter ausência');
                reverter.type = 'button';
                reverter.addEventListener('click', async () => {
                  reverter.disabled = true;
                  try {
                    const resposta = await fetch(`/api/professor/frequencia/turmas/${encodeURIComponent(turma.id)}/semestre/${encodeURIComponent(aula.aulaId)}/${encodeURIComponent(aula.data)}/faltas/${encodeURIComponent(aluno.id)}`, { method: 'PATCH' });
                    const resultado = await resposta.json();
                    if (!resposta.ok) throw new Error(resultado.mensagem || 'Não foi possível reverter a ausência.');
                    aluno.presente = true;
                    linhaAusencia.className = 'frequency-attendance-row is-present';
                    linhaAusencia.replaceChildren(criar('span', '', `${aluno.nome} · Presença restaurada`));
                    if (!conteudo.querySelector('.is-absent')) conteudo.append(criar('p', 'teacher-class-module-note', 'Todas as ausências desta aula foram revertidas.'));
                  } catch (erro) {
                    reverter.disabled = false;
                    window.showAppMessage(erro.message, 'error');
                  }
                });
                linhaAusencia.append(reverter);
                conteudo.append(linhaAusencia);
              });
            }
            item.append(conteudo);
            lista.append(item);
          });
          visaoSemestre.append(lista);
        } catch (erro) {
          visaoSemestre.replaceChildren();
          visaoSemestre.append(criar('p', 'teacher-empty-message', erro.message || 'Não foi possível carregar as aulas do semestre.'));
          const voltarChamada = criar('button', 'teacher-class-close frequency-back-button', '← Voltar à chamada');
          voltarChamada.type = 'button';
          voltarChamada.addEventListener('click', () => { visaoSemestre.remove(); telaChamada.hidden = false; });
          visaoSemestre.prepend(voltarChamada);
        } finally { verSemestre.disabled = false; }
      });
      details.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (erro) {
      details.replaceChildren(criar('p', 'teacher-empty-message', erro.message || 'Não foi possível carregar a frequência.'));
      const voltar = criar('button', 'teacher-class-close frequency-back-button', '← Voltar');
      voltar.type = 'button';
      voltar.addEventListener('click', () => { details.hidden = true; grid.hidden = false; if (count) count.hidden = false; query.delete('turmaId'); history.replaceState(null, '', location.pathname); });
      details.prepend(voltar);
    }
  }

  try {
    const response = await fetch('/api/professor/frequencia/turmas');
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar as turmas.');
    turmas = data.turmas || [];
    renderizar();
    const selecionada = turmas.find(t => t.id === query.get('turmaId'));
    if (selecionada) abrir(selecionada);
  } catch (erro) {
    grid.replaceChildren(criar('p', 'teacher-empty-message', erro.message || 'Não foi possível carregar as turmas.'));
  }
});



