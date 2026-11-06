document.addEventListener('DOMContentLoaded', async () => {
  const list = document.querySelector('#tickets-list');
  if (!list) return;

  const filters = document.querySelectorAll('.tickets-filter');
  const searchInput = document.querySelector('#ticket-search');
  const emptyMessage = document.querySelector('#tickets-empty');

  let currentFilter = 'todos';
  let todosChamados = [];


  function formatarData(dataStr) {
    if (!dataStr) return '';
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR');
  }


  async function carregarChamados() {
    try {
      const response = await fetch('http://localhost:3000/api/chamados');
      const data = await response.json();
      if (response.ok) {
        todosChamados = data.chamados || [];
        renderizarChamados();
      }
    } catch (erro) {
      console.error('Erro ao carregar chamados:', erro);
    }
  }


  function renderizarChamados() {
    const search = searchInput.value.trim().toLowerCase();
    list.innerHTML = '';

    let visiveis = 0;

    todosChamados.forEach(chamado => {
      const statusMatch =
        currentFilter === 'todos' ||
        (currentFilter === 'ativos' && chamado.status === 'ativo') ||
        (currentFilter === 'finalizados' && chamado.status === 'finalizado');

      const textoBusca = `${chamado.assunto} ${chamado.nome} ${chamado.ra} ${chamado.descricao}`.toLowerCase();
      const searchMatch = textoBusca.includes(search);

      if (statusMatch && searchMatch) {
        visiveis++;
        const item = document.createElement('article');
        item.className = 'ticket-item';
        item.dataset.status = chamado.status;

        const statusBadgeClass = chamado.status === 'ativo' ? 'ticket-status-active' : 'ticket-status-finished';
        const statusTexto = chamado.status === 'ativo' ? 'Ativo' : 'Finalizado';

        item.innerHTML = `
          <div class="ticket-main">
            <div class="ticket-info">
              <div class="ticket-title-row">
                <h3>${escapeHtml(chamado.assunto)}</h3>
              </div>
              <div>
                <span class="ticket-status ${statusBadgeClass}">${statusTexto}</span>
              </div>
              <div>
                <p class="ticket-student">${escapeHtml(chamado.nome)} <small>(RA: ${escapeHtml(chamado.ra || 'N/D')})</small></p>
                <p class="ticket-preview">${escapeHtml(chamado.descricao)}</p>
              </div>
              <div class="ticket-meta">
                <span>Curso: ${escapeHtml(chamado.curso || 'Não informado')}</span>
                <span>${formatarData(chamado.criado_em)}</span>
              </div>
            </div>
          </div>
          <div class="ticket-actions">
            <button type="button" class="ticket-open" data-ticket-id="${chamado.id}">
              Visualizar
            </button>
          </div>
        `;
        list.appendChild(item);
      }
    });

    emptyMessage.hidden = visiveis > 0;
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }


  filters.forEach(button => {
    button.addEventListener('click', () => {
      filters.forEach(f => f.classList.remove('active'));
      button.classList.add('active');
      currentFilter = button.dataset.filter;
      renderizarChamados();
    });
  });


  searchInput.addEventListener('input', renderizarChamados);


  list.addEventListener('click', async event => {
    const button = event.target.closest('.ticket-open');
    if (!button) return;

    const ticketId = button.dataset.ticketId;
    abrirModalDetalhes(ticketId);
  });


  async function abrirModalDetalhes(id) {
    try {
      const response = await fetch(`http://localhost:3000/api/chamados/${id}`);
      const data = await response.json();
      if (!response.ok) return alert('Não foi possível carregar o chamado.');

      const chamado = data.chamado;


      let modalOverlay = document.getElementById('ticket-modal-overlay');
      if (modalOverlay) modalOverlay.remove();

      modalOverlay = document.createElement('div');
      modalOverlay.id = 'ticket-modal-overlay';
      modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 9999; padding: 20px;
      `;

      let mensagensHtml = `
        <div style="background:#f7f9fc; padding:12px; border-radius:6px; margin-bottom:12px;">
          <strong>Dúvida Inicial (${chamado.nome} - ${chamado.email}):</strong>
          <p style="margin:6px 0 0; color:#42516b;">${escapeHtml(chamado.descricao)}</p>
          <small style="color:#71809b;">Enviado em ${new Date(chamado.criado_em).toLocaleString('pt-BR')}</small>
        </div>
      `;

      if (chamado.mensagens && chamado.mensagens.length > 0) {
        chamado.mensagens.forEach(m => {
          const isOwnerAdmin = m.remetente_tipo === 'admin';
          const bg = isOwnerAdmin ? '#eef0ff' : '#fff';
          mensagensHtml += `
            <div style="background:${bg}; padding:12px; border-radius:6px; margin-bottom:10px; border:1px solid #e3eaf3;">
              <strong>${escapeHtml(m.remetente_nome)} (${m.remetente_tipo}):</strong>
              <p style="margin:6px 0 0; color:#172033;">${escapeHtml(m.mensagem)}</p>
              <small style="color:#71809b;">${new Date(m.data_envio).toLocaleString('pt-BR')}</small>
            </div>
          `;
        });
      }

      modalOverlay.innerHTML = `
        <div style="background:#fff; width:100%; max-width:700px; max-height:90vh; border-radius:10px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.15);">
          <div style="padding:16px 20px; border-bottom:1px solid #e3eaf3; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:16px; color:#172033;">${escapeHtml(chamado.assunto)}</h3>
            <button id="modal-close" style="border:0; background:transparent; font-size:18px; cursor:pointer; color:#71809b;">&times;</button>
          </div>
          <div style="padding:15px 20px; font-size:12px; border-bottom:1px solid #e3eaf3; background:#fafbfd;">
            <div><strong>Estudante:</strong> ${escapeHtml(chamado.nome)} | <strong>RA:</strong> ${escapeHtml(chamado.ra)}</div>
            <div><strong>E-mail:</strong> ${escapeHtml(chamado.email)} | <strong>Curso:</strong> ${escapeHtml(chamado.curso || 'N/D')}</div>
            <div><strong>Status atual:</strong> <span style="text-transform:uppercase; font-weight:600; color:${chamado.status === 'ativo' ? '#5146ee' : '#22c55e'}">${chamado.status}</span></div>
          </div>
          <div id="modal-messages-container" style="padding:20px; overflow-y:auto; flex:1; max-height:350px;">
            ${mensagensHtml}
          </div>
          <div style="padding:15px 20px; border-top:1px solid #e3eaf3; background:#fff; display:grid; gap:10px;">
            <textarea id="modal-reply-text" rows="3" placeholder="Digite sua resposta para o estudante..." style="width:100%; padding:10px; border:1px solid #e3eaf3; border-radius:6px; font:inherit; font-size:11px; resize:vertical;"></textarea>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <button type="button" id="modal-toggle-status" style="padding:8px 12px; border:1px solid #e3eaf3; border-radius:6px; background:#fff; font-size:11px; cursor:pointer;">
                ${chamado.status === 'ativo' ? 'Finalizar Chamado' : 'Reativar Chamado'}
              </button>
              <button type="button" id="modal-send-reply" style="padding:8px 16px; border:0; border-radius:6px; background:#5146ee; color:#fff; font-size:11px; font-weight:600; cursor:pointer;">
                Enviar Resposta
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modalOverlay);


      document.getElementById('modal-close').addEventListener('click', () => modalOverlay.remove());
      modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.remove(); });


      document.getElementById('modal-send-reply').addEventListener('click', async () => {
        const texto = document.getElementById('modal-reply-text').value.trim();
        if (!texto) return alert('Digite uma mensagem.');

        const adminUser = JSON.parse(sessionStorage.getItem('notadez_user') || '{}');

        try {
          const res = await fetch(`http://localhost:3000/api/chamados/${id}/mensagens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mensagem: texto,
              remetente_nome: adminUser.nome || 'Administrador'
            })
          });

          if (res.ok) {
            alert('Resposta enviada com sucesso!');
            modalOverlay.remove();
            carregarChamados();
          } else {
            alert('Erro ao enviar resposta.');
          }
        } catch (err) {
          console.error(err);
          alert('Erro de conexão.');
        }
      });


      document.getElementById('modal-toggle-status').addEventListener('click', async () => {
        const novoStatus = chamado.status === 'ativo' ? 'finalizado' : 'ativo';
        try {
          const res = await fetch(`http://localhost:3000/api/chamados/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
          });

          if (res.ok) {
            alert(`Chamado ${novoStatus === 'finalizado' ? 'finalizado' : 'reativado'} com sucesso!`);
            modalOverlay.remove();
            carregarChamados();
          }
        } catch (err) {
          console.error(err);
          alert('Erro ao alterar status.');
        }
      });

    } catch (err) {
      console.error(err);
      alert('Erro ao abrir detalhes do chamado.');
    }
  }


  carregarChamados();
});