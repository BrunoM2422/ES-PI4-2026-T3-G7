// Autores:
document.addEventListener('DOMContentLoaded', async () => {
  const dias = Array.from(document.querySelectorAll('[data-week-day]'));
  if (!dias.length) return;

  try {
    const response = await fetch('/api/calendario/minhas-aulas');
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar seus horários.');

    const aulasPorDia = new Map(dias.map(dia => [Number(dia.dataset.weekDay), []]));
    (data.aulas || []).forEach(aula => {
      const aulas = aulasPorDia.get(Number(aula.dia));
      if (aulas) aulas.push(aula);
    });

    dias.forEach(dia => {
      const lista = dia.querySelector('.teacher-week-lessons');
      if (!lista) return;
      const aulas = aulasPorDia.get(Number(dia.dataset.weekDay)) || [];
      lista.replaceChildren();

      if (!aulas.length) {
        const vazio = document.createElement('p');
        vazio.className = 'teacher-week-empty';
        vazio.textContent = 'Sem aulas alocadas.';
        lista.append(vazio);
        return;
      }

      aulas.forEach(aula => {
        const cartao = document.createElement('article');
        cartao.className = 'teacher-week-lesson';

        const horario = document.createElement('span');
        horario.className = 'teacher-week-lesson-time';
        const horaInicio = Number(aula.hora);
        horario.textContent = Number.isInteger(horaInicio)
          ? `${String(horaInicio).padStart(2, '0')}:00 – ${String(horaInicio + 1).padStart(2, '0')}:00`
          : 'Horário não informado';

        const materia = document.createElement('strong');
        materia.textContent = aula.materia || 'Matéria não identificada';

        const turma = document.createElement('span');
        turma.className = 'teacher-week-lesson-meta';
        turma.textContent = `Curso: ${aula.turma || 'Não identificado'}`;

        const codigo = document.createElement('span');
        codigo.className = 'teacher-week-lesson-meta';
        codigo.textContent = `Código da turma: ${aula.codigoTurma || '—'}`;

        const local = document.createElement('div');
        local.className = 'teacher-week-lesson-location';
        const localLabel = document.createElement('span');
        localLabel.textContent = 'Local:';
        const localVazio = document.createElement('span');
        localVazio.className = 'teacher-week-lesson-location-value';
        localVazio.setAttribute('aria-label', 'Local não informado');
        local.append(localLabel, localVazio);

        cartao.append(horario, materia, turma, codigo, local);
        lista.append(cartao);
      });
    });
  } catch (erro) {
    dias.forEach(dia => {
      const lista = dia.querySelector('.teacher-week-lessons');
      if (!lista) return;
      const mensagem = document.createElement('p');
      mensagem.className = 'teacher-week-empty';
      mensagem.textContent = 'Não foi possível carregar os horários.';
      lista.replaceChildren(mensagem);
    });
    console.error('Erro ao carregar agenda semanal do docente:', erro);
  }
});
