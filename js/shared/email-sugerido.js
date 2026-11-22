// Autores: Bruno Machado — RA: 25008041
(() => {
  const vincular = (campoNome, campoEmail, tipo, excluirId = '') => {
    if (!campoNome || !campoEmail) return;
    let temporizador;
    let sequencia = 0;
    let editadoManualmente = false;
    campoEmail.addEventListener('input', () => { editadoManualmente = true; });
    campoNome.addEventListener('input', () => {
      const nome = campoNome.value.trim();
      const atual = ++sequencia;
      editadoManualmente = false;
      clearTimeout(temporizador);
      if (!nome) return;
      temporizador = setTimeout(async () => {
        const query = new URLSearchParams({ nome, tipo });
        if (excluirId) query.set('excluirId', excluirId);
        try {
          const response = await fetch(`/api/admin/email-sugerido?${query}`);
          const data = await response.json();
          if (response.ok && atual === sequencia && !editadoManualmente && campoNome.value.trim() === nome) campoEmail.value = data.email;
        } catch (erro) { console.debug('Não foi possível sugerir um e-mail neste momento.', erro); }
      }, 300);
    });
  };
  window.NotaDezEmailSugerido = { vincular };
})();
