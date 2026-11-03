document.addEventListener('DOMContentLoaded', async () => {
  const root = document.querySelector('#teachers-content');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Não foi possível concluir a operação.');
    return data;
  };
  let teachers = [];
  let selectedId = null;

  function render() {
    const selected = teachers.find(teacher => teacher.id === selectedId);
    root.innerHTML = `<div class="teacher-management"><aside class="teacher-list-panel"><div class="catalog-section-heading"><div><h3>Docentes cadastrados</h3><p>${teachers.length} perfil(is)</p></div></div><label class="schedule-search"><span>Buscar docente</span><input id="teacher-search" type="search" placeholder="Nome, e-mail ou RP"></label><div class="teacher-list" id="teacher-list"></div></aside><section class="teacher-editor-panel" id="teacher-editor">${selected ? editorMarkup(selected) : '<div class="schedule-empty">Selecione um docente na lista para consultar os dados.</div>'}</section></div>`;
    const search = root.querySelector('#teacher-search');
    const list = root.querySelector('#teacher-list');
    const drawList = () => {
      const term = normalize(search.value);
      const filtered = teachers.filter(teacher => normalize(`${teacher.nome} ${teacher.email} ${teacher.rp}`).includes(term));
      list.innerHTML = filtered.length ? filtered.map(teacher => `<button type="button" class="teacher-list-item${teacher.id === selectedId ? ' is-selected' : ''}" data-teacher="${escapeHtml(teacher.id)}"><span class="teacher-avatar" aria-hidden="true">${escapeHtml((teacher.nome || '?').trim().charAt(0).toLocaleUpperCase('pt-BR'))}</span><span><strong>${escapeHtml(teacher.nome)}</strong><small>${escapeHtml(teacher.email)}</small></span><b aria-hidden="true">&#8250;</b></button>`).join('') : '<div class="schedule-empty">Nenhum docente encontrado.</div>';
      list.querySelectorAll('[data-teacher]').forEach(button => button.addEventListener('click', () => { selectedId = button.dataset.teacher; render(); }));
    };
    search.addEventListener('input', drawList);
    drawList();
    if (selected) bindEditor(selected);
  }

  function editorMarkup(teacher) {
    const fields = [
      ['Nome completo', 'nome', teacher.nome], ['E-mail institucional', 'email', teacher.email, 'email'], ['CPF', 'cpf', teacher.cpf], ['Telefone', 'telefone', teacher.telefone, 'tel'],
      ['Especialidade', 'especialidade', teacher.especialidade], ['Instituição', 'instituicaoNome', teacher.instituicao?.nome], ['Código da instituição', 'instituicaoCodigo', teacher.instituicao?.codigo],
      ['Endereço', 'endereco', teacher.endereco, 'text', true], ['Descrição', 'descricao', teacher.descricao, 'text', true]
    ];
    return `<div class="catalog-section-heading"><div><h3>Perfil do docente</h3><p>Edite os dados e salve as alterações.</p></div><span class="teacher-rp">RP ${escapeHtml(teacher.rp || '—')}</span></div><form id="teacher-form"><div class="admin-field-grid">${fields.map(([label, name, value, type = 'text', wide = false]) => `<label class="admin-field${wide ? ' admin-field-wide' : ''}"><span>${label}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}"${['nome', 'email'].includes(name) ? ' required' : ''}></label>`).join('')}</div><p class="catalog-feedback" role="status" aria-live="polite"></p><div class="teacher-editor-actions"><button class="catalog-delete-button" type="button" data-delete-teacher>Remover docente</button><button class="admin-button" type="submit">Salvar alterações</button></div></form>`;
  }

  function confirmarRemocao(teacher) {
    const dialogRoot = document.createElement('div');
    dialogRoot.className = 'teacher-confirm-backdrop';
    dialogRoot.innerHTML = `<section class="teacher-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="teacher-confirm-title" aria-describedby="teacher-confirm-description"><span class="teacher-confirm-icon" aria-hidden="true">!</span><h2 id="teacher-confirm-title">Remover docente?</h2><p id="teacher-confirm-description">O perfil de <strong>${escapeHtml(teacher.nome)}</strong> será removido. Essa ação não pode ser desfeita.</p><div class="teacher-confirm-actions"><button type="button" class="admin-button-secondary" data-cancel-removal>Cancelar</button><button type="button" class="catalog-delete-button" data-confirm-removal>Remover docente</button></div></section>`;
    root.append(dialogRoot);

    return new Promise(resolve => {
      const finalizar = confirmado => {
        document.removeEventListener('keydown', aoPressionarTecla);
        dialogRoot.remove();
        resolve(confirmado);
      };
      const aoPressionarTecla = event => {
        if (event.key === 'Escape') finalizar(false);
      };
      dialogRoot.addEventListener('click', event => {
        if (event.target === dialogRoot) finalizar(false);
      });
      dialogRoot.querySelector('[data-cancel-removal]').addEventListener('click', () => finalizar(false));
      dialogRoot.querySelector('[data-confirm-removal]').addEventListener('click', () => finalizar(true));
      document.addEventListener('keydown', aoPressionarTecla);
      dialogRoot.querySelector('[data-cancel-removal]').focus();
    });
  }

  function bindEditor(teacher) {
    const form = root.querySelector('#teacher-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]'); button.disabled = true;
      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const result = await request(`/api/admin/docentes/${encodeURIComponent(teacher.id)}`, { method: 'PUT', body: JSON.stringify({ ...payload, emailAnterior: teacher.email }) });
        teachers = teachers.map(item => item.id === teacher.id ? result.docente : item);
        render();
      } catch (error) { root.querySelector('.catalog-feedback').textContent = error.message; button.disabled = false; }
    });
    form.querySelector('[data-delete-teacher]').addEventListener('click', async event => {
      const button = event.currentTarget;
      if (!await confirmarRemocao(teacher)) {
        button.focus();
        return;
      }
      button.disabled = true;
      try { await request(`/api/admin/docentes/${encodeURIComponent(teacher.id)}`, { method: 'DELETE' }); teachers = teachers.filter(item => item.id !== teacher.id); selectedId = null; render(); }
      catch (error) { root.querySelector('.catalog-feedback').textContent = error.message; button.disabled = false; }
    });
  }

  try { teachers = (await request('/api/admin/docentes')).docentes; render(); }
  catch (error) { root.innerHTML = `<div class="schedule-empty">${escapeHtml(error.message)}</div>`; }
});
