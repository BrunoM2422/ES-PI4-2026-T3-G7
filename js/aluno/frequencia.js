// Autores:
// Nícolas Mitjans Nunes - 25005124
document.addEventListener('DOMContentLoaded', async () => {
  const painel = document.querySelector('[data-student-frequency]');
  if (!painel) return;

  const elemento = (tag, classe, texto) => {
    const node = document.createElement(tag);
    if (classe) node.className = classe;
    if (texto !== undefined) node.textContent = texto;
    return node;
  };

  // Resume presenças e faltas e apresenta os detalhes da disciplina.
  function abrirDetalhes(item) {
    const codigoTurma = window.formatarCodigoTurmaDisciplina(item.turma, item.codigo);
    const modal = elemento('dialog', 'frequency-modal');
    modal.setAttribute('aria-labelledby', 'frequency-modal-title');
    const cabecalho = elemento('div', 'frequency-modal-heading');
    const texto = elemento('div');
    texto.append(elemento('span', 'frequency-modal-kicker', `Turma ${codigoTurma}`));
    const titulo = elemento('h3', '', item.nome);
    titulo.id = 'frequency-modal-title';
    texto.append(titulo);
    const fechar = elemento('button', 'frequency-modal-close', '×');
    fechar.type = 'button';
    fechar.setAttribute('aria-label', 'Fechar detalhes');
    fechar.addEventListener('click', () => modal.close());
    cabecalho.append(texto, fechar);

    const percentual = Math.max(0, Math.min(100, Number(item.percentualPresenca) || 0));
    const resumo = elemento('div', 'frequency-modal-summary');
    const donut = elemento('div', 'frequency-donut frequency-modal-donut');
    donut.style.setProperty('--attendance', `${percentual}%`);
    donut.append(elemento('strong', '', `${percentual}%`), elemento('span', '', 'presença'));
    const legenda = elemento('div', 'frequency-modal-legend');
    legenda.append(elemento('strong', '', `${item.presencas} de ${item.aulasNoSemestre} aulas`), elemento('span', '', 'presenças registradas'));
    resumo.append(donut, legenda);

    const dados = elemento('div', 'frequency-modal-stats');
    const restantes = Math.max(0, Number(item.totalPermitido) - Number(item.faltas));
    [[ 'Faltas registradas', item.faltas ], [ 'Limite para aprovação', item.totalPermitido ], [ 'Faltas restantes', restantes ]].forEach(([label, value]) => {
      const bloco = elemento('div', 'frequency-modal-stat');
      bloco.append(elemento('span', '', label), elemento('strong', '', String(value)));
      dados.append(bloco);
    });
    modal.append(cabecalho, resumo, dados);
    modal.addEventListener('click', event => { if (event.target === modal) modal.close(); });
    modal.addEventListener('close', () => modal.remove());
    document.body.append(modal);
    modal.showModal();
    fechar.focus();
  }

  try {
    const response = await fetch('/api/aluno/frequencia');
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar a frequência.');
    painel.replaceChildren();
    const cabecalho = elemento('div', 'student-frequency-heading');
    cabecalho.append(elemento('div', '', ''));
    cabecalho.firstChild.append(elemento('span', 'student-frequency-eyebrow', 'Acompanhamento'), elemento('h2', '', 'Frequência'), elemento('p', '', 'Veja sua presença em cada disciplina. Selecione um card para consultar os detalhes.'));
    painel.append(cabecalho);
    if (!data.disciplinas.length) {
      painel.append(elemento('p', 'student-frequency-empty', 'Nenhuma disciplina registrada.'));
      return;
    }
    const lista = elemento('div', 'student-courses-grid');
    data.disciplinas.forEach(item => {
      const codigoTurma = window.formatarCodigoTurmaDisciplina(item.turma, item.codigo);
      const percentual = Math.max(0, Math.min(100, Number(item.percentualPresenca) || 0));
      const card = elemento('button', 'student-course-card');
      card.type = 'button';
      card.setAttribute('aria-label', `${item.nome}, turma ${codigoTurma}, ${percentual}% de presença. Abrir detalhes.`);
      const topo = elemento('span', 'student-course-card-heading');
      topo.append(elemento('span', 'student-course-card-tag', `Turma ${codigoTurma}`), elemento('span', 'student-course-card-arrow', '↗'));
      const nome = elemento('strong', 'student-course-name', item.nome);
      const donut = elemento('span', 'frequency-donut');
      donut.style.setProperty('--attendance', `${percentual}%`);
      donut.append(elemento('strong', '', `${percentual}%`), elemento('span', '', 'presença'));
      const rodape = elemento('span', 'student-course-card-footer', `${item.presencas} de ${item.aulasNoSemestre} aulas contabilizadas`);
      card.append(topo, nome, donut, rodape);
      card.addEventListener('click', () => abrirDetalhes(item));
      lista.append(card);
    });
    painel.append(lista);
  } catch (erro) {
    painel.replaceChildren();
    painel.append(elemento('p', 'student-frequency-empty', erro.message || 'Não foi possível carregar a frequência.'));
  }
});
