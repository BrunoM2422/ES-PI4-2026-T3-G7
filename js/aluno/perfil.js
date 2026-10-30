document.addEventListener('DOMContentLoaded', async () => {
  let user;
  try {
    user = JSON.parse(sessionStorage.getItem('notadez_user') || 'null');
  } catch {
    user = null;
  }

  if (!user || !user.email) return;


  const inputNome = document.querySelector('input[name="nome"]');
  const inputEmail = document.querySelector('input[name="email"]');
  const inputCelular = document.querySelector('input[name="telefone"]');
  const inputCpf = document.querySelector('input[name="cpf"]');
  const inputEndereco = document.querySelector('input[name="endereco"]');
  const statusCard = document.querySelector('#student-status');
  const statusTitle = document.querySelector('#student-status-title');
  const statusDetails = document.querySelector('#student-status-details');

  const avatarImg = document.getElementById('avatar-img');
  const defaultSvg = document.getElementById('default-avatar-svg');
  const btnAlterarFoto = document.getElementById('btn-alterar-foto');
  const inputFileFoto = document.getElementById('input-file-foto');
  const btnRemoverFoto = document.getElementById('btn-remover-foto');

  let fotoBase64 = '';

  function atualizarExibicaoFoto(base64) {
    if (base64) {
      avatarImg.src = base64;
      avatarImg.style.display = 'block';
      if (defaultSvg) defaultSvg.style.display = 'none';
      if (btnRemoverFoto) btnRemoverFoto.hidden = false;
    } else {
      avatarImg.src = '';
      avatarImg.style.display = 'none';
      if (defaultSvg) defaultSvg.style.display = 'block';
      if (btnRemoverFoto) btnRemoverFoto.hidden = true;
    }
  }


  try {
    const response = await fetch(`http://localhost:3000/api/perfis?email=${encodeURIComponent(user.email)}`);
    const data = await response.json();

    if (response.ok) {
      const { usuario, detalhes } = data;

      if (statusCard && statusTitle) {
        const trancado = usuario.statusAcademico === 'trancado';
        statusCard.hidden = false;
        statusCard.classList.toggle('is-locked', trancado);
        statusTitle.textContent = `Situação acadêmica: ${trancado ? 'Matrícula trancada' : 'Ativa'}`;
        if (trancado && detalhes.trancamento) {
          const formatarData = valor => valor
            ? new Date(`${String(valor).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR')
            : '';
          const inicio = formatarData(detalhes.trancamento.inicio);
          const retorno = formatarData(detalhes.trancamento.retorno);
          const periodo = inicio && retorno ? `Período: ${inicio} a ${retorno}. ` : '';
          statusDetails.textContent = `${periodo}${detalhes.trancamento.justificativa || ''}`.trim();
          statusDetails.hidden = !statusDetails.textContent;
        }
      }

      if (inputNome) inputNome.value = usuario.nome || '';
      if (inputEmail) inputEmail.value = usuario.email || '';
      if (inputCpf) inputCpf.value = detalhes.cpf || '';
      if (inputCelular) inputCelular.value = detalhes.telefone || '';
      if (inputEndereco) inputEndereco.value = detalhes.endereco || '';
      
      if (detalhes.foto) {
        fotoBase64 = detalhes.foto;
        atualizarExibicaoFoto(fotoBase64);
      }
    }
  } catch (erro) {
    console.error('Erro ao carregar dados do perfil:', erro);
  }



  const overlay = document.getElementById('crop-overlay');
  const canvas = document.getElementById('crop-canvas');
  const ctx = canvas.getContext('2d');
  const zoomInput = document.getElementById('crop-zoom');
  const SIZE = canvas.width;
  const OUTPUT = 400;

  const crop = { img: null, zoom: 1, rot: 0, x: 0, y: 0 };

  function baseScale() {
    const vertical = crop.rot % 180 !== 0;
    const w = vertical ? crop.img.height : crop.img.width;
    const h = vertical ? crop.img.width : crop.img.height;
    return Math.max(SIZE / w, SIZE / h);
  }

  function clampOffsets() {
    const vertical = crop.rot % 180 !== 0;
    const w = (vertical ? crop.img.height : crop.img.width) * baseScale() * crop.zoom;
    const h = (vertical ? crop.img.width : crop.img.height) * baseScale() * crop.zoom;
    const maxX = Math.max(0, (w - SIZE) / 2);
    const maxY = Math.max(0, (h - SIZE) / 2);
    crop.x = Math.min(maxX, Math.max(-maxX, crop.x));
    crop.y = Math.min(maxY, Math.max(-maxY, crop.y));
  }


  function draw(c, k, mask) {
    const size = SIZE * k;
    c.clearRect(0, 0, size, size);
    c.fillStyle = '#fff';
    c.fillRect(0, 0, size, size);

    c.save();
    c.translate(size / 2 + crop.x * k, size / 2 + crop.y * k);
    c.rotate((crop.rot * Math.PI) / 180);
    const s = baseScale() * crop.zoom * k;
    c.scale(s, s);
    c.drawImage(crop.img, -crop.img.width / 2, -crop.img.height / 2);
    c.restore();

    if (mask) {
      c.save();
      c.fillStyle = 'rgb(0 0 0 / 55%)';
      c.beginPath();
      c.rect(0, 0, size, size);
      c.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2, true);
      c.fill('evenodd');
      c.restore();
    }
  }

  function render() {
    clampOffsets();
    draw(ctx, 1, true);
  }

  function abrirEditor(src) {
    const img = new Image();
    img.onload = () => {
      Object.assign(crop, { img, zoom: 1, rot: 0, x: 0, y: 0 });
      zoomInput.value = 1;
      overlay.hidden = false;
      render();
    };
    img.src = src;
  }

  function fecharEditor() {
    overlay.hidden = true;
    inputFileFoto.value = '';
  }


  zoomInput.addEventListener('input', () => {
    crop.zoom = parseFloat(zoomInput.value);
    render();
  });


  document.getElementById('crop-rotate').addEventListener('click', () => {
    crop.rot = (crop.rot + 90) % 360;
    crop.x = 0;
    crop.y = 0;
    render();
  });


  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const ratio = SIZE / canvas.getBoundingClientRect().width;
    crop.x = drag.x + (e.clientX - drag.px) * ratio;
    crop.y = drag.y + (e.clientY - drag.py) * ratio;
    render();
  });
  const soltar = () => { drag = null; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);


  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const novo = crop.zoom + (e.deltaY < 0 ? 0.08 : -0.08);
    crop.zoom = Math.min(3, Math.max(1, novo));
    zoomInput.value = crop.zoom;
    render();
  }, { passive: false });


  document.getElementById('crop-cancel').addEventListener('click', fecharEditor);
  document.getElementById('crop-close').addEventListener('click', fecharEditor);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) fecharEditor();
  });


  document.getElementById('crop-save').addEventListener('click', () => {
    const out = document.createElement('canvas');
    out.width = OUTPUT;
    out.height = OUTPUT;
    draw(out.getContext('2d'), OUTPUT / SIZE, false);
    fotoBase64 = out.toDataURL('image/jpeg', 0.85);
    atualizarExibicaoFoto(fotoBase64);
    fecharEditor();
  });


  if (btnAlterarFoto && inputFileFoto) {
    btnAlterarFoto.addEventListener('click', () => inputFileFoto.click());

    inputFileFoto.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
        alert('Apenas arquivos nos formatos JPG ou PNG são permitidos (GIF não é aceito).');
        inputFileFoto.value = '';
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('A imagem é muito grande. O tamanho máximo permitido é de 10 MB.');
        inputFileFoto.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => abrirEditor(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  if (btnRemoverFoto) {
    btnRemoverFoto.addEventListener('click', () => {
      if (!confirm('Deseja remover sua foto de perfil?')) return;
      fotoBase64 = '';
      atualizarExibicaoFoto('');
      inputFileFoto.value = '';
    });
  }

  const botaoSalvar = document.querySelector('.profile-save');
  if (botaoSalvar) {
    botaoSalvar.addEventListener('click', async () => {
      const telefone = inputCelular ? inputCelular.value.trim() : '';
      const endereco = inputEndereco ? inputEndereco.value.trim() : '';

      try {
        const response = await fetch('http://localhost:3000/api/perfis', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            telefone,
            endereco,
            foto: fotoBase64
          })
        });

        const resultado = await response.json();
        if (response.ok) {
          alert('Alterações salvas com sucesso!');
        } else {
          alert(resultado.mensagem || 'Erro ao salvar alterações.');
        }
      } catch (erro) {
        console.error('Erro na requisição:', erro);
        alert('Não foi possível conectar ao servidor.');
      }
    });
  }


  const botaoAlterarSenha = document.querySelector('.profile-security-save');
  if (botaoAlterarSenha) {
    botaoAlterarSenha.addEventListener('click', async () => {
      const inputNovaSenha = document.querySelector('input[name="novaSenha"]');
      const inputConfirmaSenha = document.querySelector('input[name="confirmaSenha"]');

      const novaSenha = inputNovaSenha ? inputNovaSenha.value.trim() : '';
      const confirmaSenha = inputConfirmaSenha ? inputConfirmaSenha.value.trim() : '';

      if (!novaSenha || !confirmaSenha) {
        alert('Preencha os campos de nova senha e confirmação.');
        return;
      }

      if (novaSenha !== confirmaSenha) {
        alert('As senhas digitadas não coincidem.');
        return;
      }

      try {
        const response = await fetch('http://localhost:3000/api/perfis/senha', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            novaSenha,
            confirmaSenha
          })
        });

        const resultado = await response.json();
        if (response.ok) {
          alert('Senha alterada com sucesso! Utilize-a no próximo login.');
          if (inputNovaSenha) inputNovaSenha.value = '';
          if (inputConfirmaSenha) inputConfirmaSenha.value = '';
        } else {
          alert(resultado.mensagem || 'Erro ao alterar senha.');
        }
      } catch (erro) {
        console.error('Erro na requisição:', erro);
        alert('Não foi possível conectar ao servidor.');
      }
    });
  }



});
