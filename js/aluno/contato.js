document.addEventListener('DOMContentLoaded', async () => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  let user;
  try {
    user = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
  } catch {
    user = null;
  }

  if (!user || !user.email) return;

  const feedback = form.querySelector('.contact-feedback');
  const historyContainer = document.querySelector('.contact-history');
  const fileInput = form.querySelector('#contact-file');

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const attach = form.querySelector('.contact-attach');
      if (attach && attach.lastChild) {
        attach.lastChild.textContent = fileInput.files[0]?.name || ' Anexar arquivo';
      }
    });
  }


  async function carregarHistorico() {
    try {
      const response = await fetch(`http://localhost:3000/api/chamados?email=${encodeURIComponent(user.email)}`);
      const data = await response.json();

      if (response.ok) {
        renderizarHistorico(data.chamados || []);
      }
    } catch (erro) {
      console.error('Erro ao carregar histórico:', erro);
    }
  }


  function renderizarHistorico(chamados) {
    const antigos = historyContainer.querySelectorAll('.student-page-panel');
    antigos.forEach(el => el.remove());

    if (chamados.length === 0) {
      const emptyPanel = document.createElement('article');
      emptyPanel.className = 'student-page-panel contact-history-empty';
      emptyPanel.textContent = 'Nenhum chamado anterior.';
      historyContainer.appendChild(emptyPanel);
      return;
    }

    chamados.forEach(chamado => {
      const panel = document.createElement('article');
      panel.className = 'student-page-panel';
      panel.dataset.ticketId = chamado.id;
      panel.style.cssText = 'padding: 16px; margin-bottom: 12px; display: grid; gap: 8px; background: #fff; border: 1px solid var(--line); border-radius: 9px; cursor: pointer; transition: all 0.15s ease;';
      
      panel.addEventListener('mouseenter', () => panel.style.borderColor = '#5146ee');
      panel.addEventListener('mouseleave', () => panel.style.borderColor = 'var(--line)');

      const statusBadge = chamado.status === 'ativo' ? 
        '<span style="background: #eef0ff; color: #5146ee; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 650;">Ativo / Aguardando</span>' : 
        '<span style="background: #ecfdf5; color: #059669; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 650;">Finalizado</span>';

      panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 13px; color: var(--ink);">${escapeHtml(chamado.assunto)}</strong>
          ${statusBadge}
        </div>
        <p style="margin: 0; font-size: 11px; color: #42516b;">${escapeHtml(chamado.descricao)}</p>
        <small style="font-size: 9px; color: var(--muted);">Enviado em ${new Date(chamado.criado_em).toLocaleDateString('pt-BR')} (Clique para ver conversa)</small>
      `;


      panel.addEventListener('click', () => abrirModalConversa(chamado.id));

      historyContainer.appendChild(panel);
    });
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }


  async function abrirModalConversa(id) {
    try {
      const response = await fetch(`http://localhost:3000/api/chamados/${id}`);
      const data = await response.json();
      if (!response.ok) return alert('Não foi possível carregar o chamado.');

      const chamado = data.chamado;

      let modalOverlay = document.getElementById('student-ticket-modal');
      if (modalOverlay) modalOverlay.remove();

      modalOverlay = document.createElement('div');
      modalOverlay.id = 'student-ticket-modal';
      modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 9999; padding: 20px;
      `;

      let mensagensHtml = `
        <div style="background:#f7f9fc; padding:12px; border-radius:6px; margin-bottom:12px; border:1px solid #e3eaf3;">
          <strong>${escapeHtml(chamado.nome)} (Você):</strong>
          <p style="margin:6px 0 0; color:#42516b;">${escapeHtml(chamado.descricao)}</p>
          <small style="color:#71809b;">Enviado em ${new Date(chamado.criado_em).toLocaleString('pt-BR')}</small>
        </div>
      `;

      if (chamado.mensagens && chamado.mensagens.length > 0) {
        chamado.mensagens.forEach(m => {
          const isOwnerStudent = m.remetente_tipo === 'estudante';
          const bg = isOwnerStudent ? '#f7f9fc' : '#eef0ff';
          mensagensHtml += `
            <div style="background:${bg}; padding:12px; border-radius:6px; margin-bottom:10px; border:1px solid #e3eaf3;">
              <strong>${escapeHtml(m.remetente_nome)} (${m.remetente_tipo === 'admin' ? 'Coordenação / Admin' : 'Você'}):</strong>
              <p style="margin:6px 0 0; color:#172033;">${escapeHtml(m.mensagem)}</p>
              <small style="color:#71809b;">${new Date(m.data_envio).toLocaleString('pt-BR')}</small>
            </div>
          `;
        });
      }

      const isFinalizado = chamado.status === 'finalizado';

      modalOverlay.innerHTML = `
        <div style="background:#fff; width:100%; max-width:700px; max-height:90vh; border-radius:10px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.15);">
          <div style="padding:16px 20px; border-bottom:1px solid #e3eaf3; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:16px; color:#172033;">${escapeHtml(chamado.assunto)}</h3>
            <button id="modal-close" style="border:0; background:transparent; font-size:18px; cursor:pointer; color:#71809b;">&times;</button>
          </div>
          <div style="padding:15px 20px; font-size:12px; border-bottom:1px solid #e3eaf3; background:#fafbfd; display:flex; justify-content:space-between; align-items:center;">
            <div><strong>Status:</strong> <span style="text-transform:uppercase; font-weight:600; color:${isFinalizado ? '#059669' : '#5146ee'}">${chamado.status}</span></div>
            <div><strong>Criado em:</strong> ${new Date(chamado.criado_em).toLocaleDateString('pt-BR')}</div>
          </div>
          <div style="padding:20px; overflow-y:auto; flex:1; max-height:350px;">
            ${mensagensHtml}
          </div>
          <div style="padding:15px 20px; border-top:1px solid #e3eaf3; background:#fff; display:grid; gap:10px;">
            ${isFinalizado ? 
              '<p style="margin:0; text-align:center; color:#71809b; font-size:11px;">Este chamado foi finalizado pela coordenação.</p>' : 
              `
              <textarea id="modal-student-reply" rows="3" placeholder="Digite sua resposta..." style="width:100%; padding:10px; border:1px solid #e3eaf3; border-radius:6px; font:inherit; font-size:11px; resize:vertical;"></textarea>
              <div style="display:flex; justify-content:flex-end;">
                <button type="button" id="modal-send-student-reply" style="padding:8px 16px; border:0; border-radius:6px; background:#5146ee; color:#fff; font-size:11px; font-weight:600; cursor:pointer;">
                  Enviar Resposta
                </button>
              </div>
              `
            }
          </div>
        </div>
      `;

      document.body.appendChild(modalOverlay);

      document.getElementById('modal-close').addEventListener('click', () => modalOverlay.remove());
      modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.remove(); });

      const btnEnviar = document.getElementById('modal-send-student-reply');
      if (btnEnviar) {
        btnEnviar.addEventListener('click', async () => {
          const texto = document.getElementById('modal-student-reply').value.trim();
          if (!texto) return alert('Digite uma mensagem.');

          try {
            const res = await fetch(`http://localhost:3000/api/chamados/${id}/mensagens`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mensagem: texto,
                remetente_nome: user.nome,
                remetente_tipo: 'estudante'
              })
            });

            if (res.ok) {
              alert('Resposta enviada com sucesso!');
              modalOverlay.remove();
              carregarHistorico();
            } else {
              alert('Erro ao enviar resposta.');
            }
          } catch (err) {
            console.error(err);
            alert('Erro de conexão.');
          }
        });
      }

    } catch (err) {
      console.error(err);
      alert('Erro ao abrir o chamado.');
    }
  }


  form.addEventListener('submit', async event => {
    event.preventDefault();

    const inputAssunto = document.querySelector('#contact-subject');
    const textareaMensagem = document.querySelector('#contact-message');

    const assunto = inputAssunto ? inputAssunto.value.trim() : '';
    const descricao = textareaMensagem ? textareaMensagem.value.trim() : '';

    if (!assunto || !descricao) {
      feedback.textContent = 'Preencha o assunto e a mensagem.';
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/chamados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          assunto,
          descricao
        })
      });

      const resultado = await response.json();

      if (response.ok) {
        feedback.textContent = 'Chamado enviado com sucesso! Aguardando resposta da coordenação.';
        inputAssunto.value = '';
        textareaMensagem.value = '';
        carregarHistorico();
      } else {
        feedback.textContent = resultado.mensagem || 'Erro ao enviar chamado.';
      }
    } catch (erro) {
      console.error('Erro na requisição:', erro);
      feedback.textContent = 'Erro ao conectar com o servidor.';
    }
  });


  carregarHistorico();
});
