// Autores: Bruno Machado — RA: 25008041
document.addEventListener('DOMContentLoaded', async () => {
  const root = document.querySelector('[data-evaluation-root]');
  const token = sessionStorage.getItem('notadez_token');
  if (!root) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let professores = [];
  const avaliacoes = new Map();

  function render() {
    root.innerHTML = '<header class="evaluation-heading"><h2>Avaliar professores</h2><p>Compartilhe sua experiencia e ajude a melhorar as aulas.</p></header><div class="evaluation-grid" data-evaluation-grid></div><p class="evaluation-status" data-evaluation-status role="status"></p>';
    const grid = root.querySelector('[data-evaluation-grid]');
    if (!professores.length) {
      grid.innerHTML = '<div class="evaluation-empty"><span aria-hidden="true">&#9734;</span><strong>Nenhum professor disponivel para avaliacao</strong><p>Os professores das suas disciplinas aparecerao aqui quando a avaliacao estiver aberta.</p></div>';
      return;
    }
    grid.innerHTML = professores.map(professor => `<button type="button" class="evaluation-card" data-teacher="${escapeHtml(professor.id)}"><span class="evaluation-avatar">${professor.foto ? `<img src="${escapeHtml(professor.foto)}" alt="Foto de ${escapeHtml(professor.nome)}">` : `<span aria-hidden="true">${escapeHtml(professor.nome.trim().charAt(0).toLocaleUpperCase('pt-BR'))}</span>`}</span><span class="evaluation-card-copy"><strong>${escapeHtml(professor.nome)}</strong><small>${professor.disciplinas.map(escapeHtml).join(' &middot; ')}</small></span><span class="evaluation-card-arrow" aria-hidden="true">&#8250;</span></button>`).join('');
    grid.querySelectorAll('[data-teacher]').forEach(card => card.addEventListener('click', () => openEvaluation(professores.find(item => item.id === card.dataset.teacher))));
  }

  function openEvaluation(professor) {
    const backdrop = document.createElement('div');
    backdrop.className = 'evaluation-backdrop';
    backdrop.innerHTML = `<section class="evaluation-modal" role="dialog" aria-modal="true" aria-labelledby="evaluation-title"><button class="evaluation-close" type="button" aria-label="Fechar">&times;</button><div class="evaluation-teacher"><span class="evaluation-avatar evaluation-avatar-large">${professor.foto ? `<img src="${escapeHtml(professor.foto)}" alt="">` : `<span aria-hidden="true">${escapeHtml(professor.nome.trim().charAt(0).toLocaleUpperCase('pt-BR'))}</span>`}</span><div><span class="student-page-eyebrow">Sua avaliacao</span><h2 id="evaluation-title">${escapeHtml(professor.nome)}</h2><p>${professor.disciplinas.map(escapeHtml).join(' · ')}</p></div></div><div class="evaluation-categories">${['Ensino', 'Atividades', 'Comunica\u00e7\u00e3o'].map((name,index) => `<fieldset class="evaluation-category"><legend>${name}</legend><div class="evaluation-stars" role="group" aria-label="Nota de ${name}"><button type="button" class="evaluation-zero" data-category="${index}" aria-label="Nota zero" aria-pressed="true">0</button>${[1,2,3,4,5].map(value => `<button type="button" class="evaluation-star" data-category="${index}" data-value="${value}" aria-label="${value} de 5 estrelas" aria-pressed="false">&#9733;</button>`).join('')}</div><small>Escolha uma nota de 0 a 5 estrelas.</small></fieldset>`).join('')}</div><label class="evaluation-comment-label" for="evaluation-comment">Conte mais sobre sua experi\u00eancia</label><textarea class="evaluation-comment" id="evaluation-comment" maxlength="1000" placeholder="Escreva um comentario (opcional)..."></textarea><div class="evaluation-modal-footer"><span class="evaluation-demo-note">Avalia\u00e7\u00e3o demonstrativa: nao sera enviada nem salva.</span><button type="button" class="admin-button evaluation-submit">Concluir avaliacao</button></div></section>`;
    document.body.append(backdrop);
    const state = { stars: [0,0,0], comment: '' };
    const updateStars = category => backdrop.querySelectorAll(`[data-category="${category}"]`).forEach(button => {
      const active = Number(button.dataset.value) <= state.stars[category];
      button.classList.toggle('is-selected', active);
      if (button.hasAttribute('data-value')) button.setAttribute('aria-pressed', String(active));
      else button.setAttribute('aria-pressed', String(state.stars[category] === 0));
    });
    backdrop.querySelectorAll('.evaluation-star').forEach(button => button.addEventListener('click', () => {
      state.stars[Number(button.dataset.category)] = Number(button.dataset.value);
      updateStars(Number(button.dataset.category));
    }));
    backdrop.querySelectorAll('.evaluation-zero').forEach(button => button.addEventListener('click', () => {
      state.stars[Number(button.dataset.category)] = 0;
      updateStars(Number(button.dataset.category));
    }));
    const close = () => backdrop.remove();
    backdrop.querySelector('.evaluation-close').addEventListener('click', close);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
    backdrop.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    backdrop.querySelector('.evaluation-submit').addEventListener('click', () => {
      state.comment = backdrop.querySelector('.evaluation-comment').value.trim();
      avaliacoes.set(professor.id, state);
      root.querySelector('[data-evaluation-status]').textContent = 'Obrigado! Sua avaliacao demonstrativa foi concluida nesta sessao.';
      close();
    });
  }

  try {
    const response = await fetch('/api/aluno/avaliacao-professores', { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Nao foi possivel carregar os professores.');
    professores = data.professores || [];
    render();
  } catch (error) {
    root.innerHTML = `<div class="evaluation-empty"><strong>Nao foi possivel carregar as avaliacoes</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
});
