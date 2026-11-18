document.addEventListener('DOMContentLoaded', async () => {
  const painel = document.querySelector('[data-student-frequency]');
  if (!painel) return;
  try {
    const response = await fetch('/api/aluno/frequencia');
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar a frequência.');
    painel.replaceChildren();
    const titulo = document.createElement('h2'); titulo.textContent = 'Frequência'; painel.append(titulo);
    if (!data.disciplinas.length) { const vazio = document.createElement('p'); vazio.textContent = 'Nenhuma disciplina registrada.'; painel.append(vazio); return; }
    const lista = document.createElement('div'); lista.className = 'student-courses-grid';
    data.disciplinas.forEach(item => {
      const card = document.createElement('article'); card.className = 'student-course-card';
      const nome = document.createElement('h3'); nome.textContent = item.nome;
      const turma = document.createElement('p'); turma.textContent = `Turma ${item.turma}`;
      const limite = document.createElement('p'); limite.textContent = `Limite de faltas para aprovação (75%): ${item.totalPermitido}`;
      const faltas = document.createElement('p'); faltas.textContent = `Faltas registradas: ${item.faltas} · Restantes: ${Math.max(0, item.totalPermitido - item.faltas)}`;
      const presenca = document.createElement('p'); presenca.textContent = `Presença: ${item.percentualPresenca}% (${item.presencas}/${item.aulasNoSemestre} aulas contabilizadas)`;
      card.append(nome, turma, limite, faltas, presenca); lista.append(card);
    });
    painel.append(lista);
  } catch (erro) {
    painel.replaceChildren(); const p = document.createElement('p'); p.textContent = erro.message || 'Não foi possível carregar a frequência.'; painel.append(p);
  }
});
