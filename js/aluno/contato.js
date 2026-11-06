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
      panel.style.cssText = 'padding: 16px; margin-bottom: 12px; display: grid; gap: 8px; background: #fff; border: 1px solid var(--line); border-radius: 9px;';

      const statusBadge = chamado.status === 'ativo' ? 
        '<span style="background: #eef0ff; color: #5146ee; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 650;">Aguardando / Ativo</span>' : 
        '<span style="background: #ecfdf5; color: #059669; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 650;">Finalizado</span>';

      panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 13px; color: var(--ink);">${escapeHtml(chamado.assunto)}</strong>
          ${statusBadge}
        </div>
        <p style="margin: 0; font-size: 11px; color: #42516b;">${escapeHtml(chamado.descricao)}</p>
        <small style="font-size: 9px; color: var(--muted);">Enviado em ${new Date(chamado.criado_em).toLocaleDateString('pt-BR')}</small>
      `;
      historyContainer.appendChild(panel);
    });
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
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
