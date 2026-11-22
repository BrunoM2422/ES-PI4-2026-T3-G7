//Autor: Matheus Antony Lucas Lima
//RA:25013260

document.addEventListener('DOMContentLoaded', async () => {
  const raiz = document.querySelector('[data-finance-student]');
  if (!raiz) return;

  // ---------- regras da mensalidade ----------
  const VALOR_POR_DISCIPLINA = 350;   // valor mensal de cada disciplina cursada (R$)
  const DIA_VENCIMENTO = 10;          // dia do mês em que a parcela vence
  const TOTAL_PARCELAS = 6;           // quantidade de parcelas exibidas
  const ENDPOINT_DISCIPLINAS = '/api/notas/aluno'; // devolve { disciplinas: [...] } do aluno logado

  // ---------- utilitários ----------
  const q = nome => raiz.querySelector(`[data-fin="${nome}"]`);
  const el = (tag, cls, texto) => {
    const no = document.createElement(tag);
    if (cls) no.className = cls;
    if (texto !== undefined) no.textContent = texto;
    return no;
  };
  const svgEl = (tag, atributos) => {
    const no = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(atributos).forEach(([chave, valor]) => no.setAttribute(chave, valor));
    return no;
  };
  const moeda = valor => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataCurta = data => data.toLocaleDateString('pt-BR');
  const dataHora = data => data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const plural = (n, singular, pluralTxt) => `${n} ${n === 1 ? singular : pluralTxt}`;

  const els = {
    mensalidade: q('mensalidade'), mensalidadeDetalhe: q('mensalidade-detalhe'),
    pendente: q('pendente'), pendenteDetalhe: q('pendente-detalhe'),
    vencimento: q('vencimento'), vencimentoDetalhe: q('vencimento-detalhe'),
    painel: q('painel-pagamento'), vazio: q('pagamento-vazio'), conteudo: q('pagamento-conteudo'),
    escolha: q('escolha'), parcelaRef: q('parcela-ref'), parcelaValor: q('parcela-valor'), parcelaVenc: q('parcela-venc'),
    gerar: q('gerar'), saida: q('saida'), validarBloco: q('validar-bloco'), validar: q('validar'),
    sucesso: q('sucesso'), tabela: q('tabela')
  };
  const radios = raiz.querySelectorAll('input[name="metodo"]');

  // ---------- estado ----------
  // fase: 'escolha' (escolhendo/gerar) | 'gerado' (QR Code ou boleto na tela) | 'validado' (pagamento confirmado)
  const estado = { disciplinas: 0, mensalidade: 0, parcelas: [], selecionadaId: null, metodo: 'pix', fase: 'escolha', erro: null, carregando: true };

  function montarParcelas(valor) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const mesInicial = hoje.getMonth() + (hoje.getDate() > DIA_VENCIMENTO ? 1 : 0);
    return Array.from({ length: TOTAL_PARCELAS }, (_, i) => {
      const vencimento = new Date(hoje.getFullYear(), mesInicial + i, DIA_VENCIMENTO);
      const mes = String(vencimento.getMonth() + 1).padStart(2, '0');
      return {
        id: `${vencimento.getFullYear()}${mes}`,
        referencia: `Mensalidade ${mes}/${vencimento.getFullYear()}`,
        valor, vencimento, paga: false, pagoEm: null, metodo: null, protocolo: null
      };
    });
  }

  const parcelaPorId = id => estado.parcelas.find(p => p.id === id) || null;
  const pendentes = () => estado.parcelas.filter(p => !p.paga);
  const proximaPendente = () => pendentes()[0] || null;

  // ---------- códigos de pagamento (simulação visual) ----------
  function hash(texto) {
    let h = 2166136261;
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function gerador(semente) { // mulberry32: sequência pseudoaleatória repetível
    let s = semente >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Pix copia e cola no formato EMV (BR Code), com CRC16 real
  function tlv(id, valor) { return id + String(valor.length).padStart(2, '0') + valor; }
  function crc16(texto) {
    let crc = 0xFFFF;
    for (let i = 0; i < texto.length; i++) {
      crc ^= texto.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  function payloadPix(p) {
    const conta = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', 'financeiro@notadez.edu.br');
    const corpo = tlv('00', '01') + tlv('01', '12') + tlv('26', conta) + tlv('52', '0000') + tlv('53', '986')
      + tlv('54', p.valor.toFixed(2)) + tlv('58', 'BR') + tlv('59', 'NOTADEZ') + tlv('60', 'SAO PAULO')
      + tlv('62', tlv('05', `NDZ${p.id}`)) + '6304';
    return corpo + crc16(corpo);
  }

  // Desenho do QR Code: padrão visual com os três marcadores de canto (não é um QR legível por câmera)
  function desenharQr(payload) {
    const N = 33;
    const rnd = gerador(hash(payload));
    const modulo = Array.from({ length: N }, () => Array.from({ length: N }, () => rnd() > 0.52));
    const reservado = (x, y) => (x < 9 && y < 9) || (x > N - 10 && y < 9) || (x < 9 && y > N - 10);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (reservado(x, y)) modulo[y][x] = false;
    for (let i = 8; i < N - 8; i++) { modulo[6][i] = i % 2 === 0; modulo[i][6] = i % 2 === 0; }
    [[0, 0], [N - 7, 0], [0, N - 7]].forEach(([ox, oy]) => {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const borda = x === 0 || y === 0 || x === 6 || y === 6;
        const centro = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        modulo[oy + y][ox + x] = borda || centro;
      }
    });
    let caminho = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (modulo[y][x]) caminho += `M${x} ${y}h1v1h-1z`;
    const svg = svgEl('svg', { viewBox: `-3 -3 ${N + 6} ${N + 6}`, class: 'finance-qr', role: 'img', 'aria-label': 'QR Code Pix' });
    svg.append(svgEl('rect', { x: -3, y: -3, width: N + 6, height: N + 6, fill: '#fff' }), svgEl('path', { d: caminho, fill: '#000' }));
    return svg;
  }

  // Boleto: código de barras (44 dígitos) e linha digitável (47 dígitos) no padrão FEBRABAN
  function mod10(numero) {
    let soma = 0, peso = 2;
    for (let i = numero.length - 1; i >= 0; i--) {
      const r = Number(numero[i]) * peso;
      soma += r > 9 ? r - 9 : r;
      peso = peso === 2 ? 1 : 2;
    }
    return String((10 - (soma % 10)) % 10);
  }
  function mod11(numero) {
    let soma = 0, peso = 2;
    for (let i = numero.length - 1; i >= 0; i--) {
      soma += Number(numero[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const r = 11 - (soma % 11);
    return (r === 0 || r === 10 || r === 11) ? '1' : String(r);
  }
  function fatorVencimento(data) {
    const dias = Math.round((Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) - Date.UTC(1997, 9, 7)) / 86400000);
    return String(dias > 9999 ? 1000 + (dias - 10000) : dias).padStart(4, '0');
  }
  function dadosBoleto(p) {
    const banco = '999', moeda9 = '9';
    const fator = fatorVencimento(p.vencimento);
    const valor = String(Math.round(p.valor * 100)).padStart(10, '0');
    const livre = (`0001${p.id}${String(hash(p.id)).padStart(10, '0')}`).padEnd(25, '0').slice(0, 25);
    const dv = mod11(banco + moeda9 + fator + valor + livre);
    const codigoBarras = banco + moeda9 + dv + fator + valor + livre;
    const c1 = banco + moeda9 + livre.slice(0, 5), c2 = livre.slice(5, 15), c3 = livre.slice(15, 25);
    const linhaDigitavel = `${c1.slice(0, 5)}.${c1.slice(5)}${mod10(c1)} ${c2.slice(0, 5)}.${c2.slice(5)}${mod10(c2)} `
      + `${c3.slice(0, 5)}.${c3.slice(5)}${mod10(c3)} ${dv} ${fator}${valor}`;
    return { codigoBarras, linhaDigitavel };
  }
  const ITF = ['nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw', 'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn'];
  function desenharCodigoBarras(codigo) { // padrão Intercalado 2 de 5, usado nos boletos
    const FINA = 1, LARGA = 3, ALTURA = 64, MARGEM = 10;
    let x = MARGEM; const barras = [];
    const avancar = (largura, escuro) => { if (escuro) barras.push([x, largura]); x += largura; };
    [FINA, FINA, FINA, FINA].forEach((l, i) => avancar(l, i % 2 === 0));
    for (let i = 0; i < codigo.length; i += 2) {
      const a = ITF[Number(codigo[i])], b = ITF[Number(codigo[i + 1])];
      for (let k = 0; k < 5; k++) { avancar(a[k] === 'w' ? LARGA : FINA, true); avancar(b[k] === 'w' ? LARGA : FINA, false); }
    }
    [LARGA, FINA, FINA].forEach((l, i) => avancar(l, i % 2 === 0));
    const largura = x + MARGEM;
    const svg = svgEl('svg', { viewBox: `0 0 ${largura} ${ALTURA + 20}`, class: 'finance-barcode', role: 'img', 'aria-label': 'Código de barras do boleto', preserveAspectRatio: 'none' });
    svg.append(svgEl('rect', { x: 0, y: 0, width: largura, height: ALTURA + 20, fill: '#fff' }));
    barras.forEach(([bx, bl]) => svg.append(svgEl('rect', { x: bx, y: 10, width: bl, height: ALTURA, fill: '#000' })));
    return svg;
  }

  // ---------- montagem das saídas ----------
  async function copiar(texto, aviso) {
    try { await navigator.clipboard.writeText(texto); }
    catch (erro) {
      const area = document.createElement('textarea');
      area.value = texto; area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.append(area); area.select();
      try { document.execCommand('copy'); } catch (falha) { /* sem suporte */ }
      area.remove();
    }
    aviso.textContent = 'Copiado';
    setTimeout(() => { aviso.textContent = ''; }, 2000);
  }
  function caixaDeCodigo(texto, rotulo) {
    const caixa = el('div', 'finance-code-box');
    const codigo = el('code', 'finance-code', texto);
    const barra = el('div', 'finance-code-actions');
    const botao = el('button', 'finance-btn is-small', rotulo); botao.type = 'button';
    const aviso = el('span', 'finance-copy-feedback'); aviso.setAttribute('role', 'status');
    botao.addEventListener('click', () => copiar(texto, aviso));
    barra.append(botao, aviso); caixa.append(codigo, barra);
    return caixa;
  }
  function montarPix(p) {
    const bloco = el('div', 'finance-output-pix');
    const info = el('div', 'finance-output-info');
    info.append(
      el('h3', '', 'Pague com Pix'),
      el('p', '', 'No app do seu banco, escolha Pix e leia o QR Code, ou cole o código copia e cola.'),
      caixaDeCodigo(payloadPix(p), 'Copiar código Pix'),
      el('small', 'finance-note', `Valor de ${moeda(p.valor)}. Simulação acadêmica: este código não gera cobrança real.`)
    );
    bloco.append(desenharQr(payloadPix(p)), info);
    return bloco;
  }
  function montarBoleto(p) {
    const { codigoBarras, linhaDigitavel } = dadosBoleto(p);
    const bloco = el('div', 'finance-output-boleto');
    const dados = el('dl', 'finance-boleto-dados');
    [['Beneficiário', 'NotaDez Instituição de Ensino'], ['Referência', p.referencia], ['Vencimento', dataCurta(p.vencimento)], ['Valor do documento', moeda(p.valor)]]
      .forEach(([rotulo, valor]) => { const linha = el('div'); linha.append(el('dt', '', rotulo), el('dd', '', valor)); dados.append(linha); });
    bloco.append(
      el('h3', '', 'Boleto bancário'), dados, desenharCodigoBarras(codigoBarras),
      caixaDeCodigo(linhaDigitavel, 'Copiar linha digitável'),
      el('small', 'finance-note', 'Simulação acadêmica: este boleto não gera cobrança real.')
    );
    return bloco;
  }

  // ---------- renderização ----------
  function renderResumo() {
    if (estado.carregando) {
      els.mensalidade.textContent = '—'; els.mensalidadeDetalhe.textContent = 'Calculando com base nas suas disciplinas...';
      els.pendente.textContent = '—'; els.pendenteDetalhe.textContent = '\u00a0';
      els.vencimento.textContent = '—'; els.vencimentoDetalhe.textContent = '\u00a0';
      return;
    }
    if (estado.erro) {
      els.mensalidade.textContent = '—'; els.mensalidadeDetalhe.textContent = estado.erro;
      els.pendente.textContent = '—'; els.pendenteDetalhe.textContent = '\u00a0';
      els.vencimento.textContent = '—'; els.vencimentoDetalhe.textContent = '\u00a0';
      return;
    }
    els.mensalidade.textContent = moeda(estado.mensalidade);
    els.mensalidadeDetalhe.textContent = estado.disciplinas
      ? `${plural(estado.disciplinas, 'disciplina', 'disciplinas')} × ${moeda(VALOR_POR_DISCIPLINA)}`
      : 'Você não está matriculado em nenhuma disciplina.';
    const abertas = pendentes();
    const total = abertas.reduce((soma, p) => soma + p.valor, 0);
    els.pendente.textContent = moeda(total);
    els.pendenteDetalhe.textContent = abertas.length ? plural(abertas.length, 'parcela em aberto', 'parcelas em aberto') : 'Nenhuma parcela em aberto';
    const proxima = abertas[0];
    els.vencimento.textContent = proxima ? dataCurta(proxima.vencimento) : '—';
    els.vencimentoDetalhe.textContent = proxima ? proxima.referencia : 'Tudo em dia';
  }

  function renderTabela() {
    els.tabela.replaceChildren();
    if (!estado.parcelas.length) {
      const linha = el('tr'); const celula = el('td', 'finance-empty', estado.carregando ? 'Carregando parcelas...' : (estado.erro || 'Nenhuma parcela disponível.'));
      celula.colSpan = 5; linha.append(celula); els.tabela.append(linha); return;
    }
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const primeira = proximaPendente();
    estado.parcelas.forEach(p => {
      let status = { texto: 'A vencer', classe: 'is-upcoming' };
      if (p.paga) status = { texto: 'Pago', classe: 'is-paid' };
      else if (p.vencimento < hoje) status = { texto: 'Vencida', classe: 'is-overdue' };
      else if (p === primeira) status = { texto: 'Em aberto', classe: 'is-open' };

      const linha = el('tr');
      const acao = el('td');
      if (p.paga) acao.append(el('span', 'finance-paid-info', `Pago em ${dataCurta(p.pagoEm)} via ${p.metodo === 'pix' ? 'Pix' : 'boleto'}`));
      else {
        const botao = el('button', 'finance-btn is-small', 'Pagar'); botao.type = 'button';
        botao.addEventListener('click', () => {
          estado.selecionadaId = p.id; estado.fase = 'escolha'; render();
          els.painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        acao.append(botao);
      }
      const celulaStatus = el('td'); celulaStatus.append(el('span', `finance-badge ${status.classe}`, status.texto));
      linha.append(el('td', '', p.referencia), el('td', '', moeda(p.valor)), el('td', '', dataCurta(p.vencimento)), celulaStatus, acao);
      els.tabela.append(linha);
    });
  }

  function renderSucesso(p) {
    const texto = el('div', 'finance-success-text');
    texto.append(
      el('strong', '', 'Pagamento validado'),
      el('p', '', `${p.referencia}, ${moeda(p.valor)}, pago via ${p.metodo === 'pix' ? 'Pix' : 'boleto'} em ${dataHora(p.pagoEm)}.`),
      el('small', '', `Protocolo ${p.protocolo}`)
    );
    const proxima = proximaPendente();
    const botao = el('button', 'finance-btn is-small', proxima ? 'Pagar próxima parcela' : 'Concluir'); botao.type = 'button';
    botao.addEventListener('click', () => { estado.selecionadaId = proxima ? proxima.id : null; estado.fase = 'escolha'; render(); });
    els.sucesso.replaceChildren(el('span', 'finance-success-icon', '✓'), texto, botao);
  }

  function renderCheckout() {
    const p = parcelaPorId(estado.selecionadaId);
    const semMensalidade = !estado.carregando && !estado.erro && !estado.mensalidade;
    const semPendencia = !estado.carregando && !estado.erro && estado.mensalidade && !p;
    const bloqueado = estado.carregando || Boolean(estado.erro) || semMensalidade || semPendencia;

    els.vazio.hidden = !bloqueado;
    els.conteudo.hidden = bloqueado;
    if (estado.carregando) els.vazio.textContent = 'Carregando suas informações financeiras...';
    else if (estado.erro) els.vazio.textContent = 'Não foi possível carregar suas informações financeiras. Atualize a página para tentar de novo.';
    else if (semMensalidade) els.vazio.textContent = 'Você não está matriculado em nenhuma disciplina, por isso não há mensalidade a pagar.';
    else if (semPendencia) els.vazio.textContent = 'Todas as parcelas estão pagas. Não há cobrança pendente.';
    if (bloqueado) return;

    els.parcelaRef.textContent = p.referencia;
    els.parcelaValor.textContent = moeda(p.valor);
    els.parcelaVenc.textContent = dataCurta(p.vencimento);
    els.gerar.textContent = estado.metodo === 'pix' ? 'Gerar QR Code' : 'Gerar boleto';

    els.escolha.hidden = estado.fase === 'validado';
    els.saida.hidden = estado.fase !== 'gerado';
    els.validarBloco.hidden = estado.fase !== 'gerado';
    els.sucesso.hidden = estado.fase !== 'validado';
    if (estado.fase === 'validado') renderSucesso(p);
  }

  function render() { renderResumo(); renderTabela(); renderCheckout(); }

  // ---------- eventos ----------
  radios.forEach(radio => radio.addEventListener('change', () => {
    estado.metodo = radio.value;
    if (estado.fase === 'gerado') { estado.fase = 'escolha'; els.saida.replaceChildren(); }
    render();
  }));

  els.gerar.addEventListener('click', () => {
    const p = parcelaPorId(estado.selecionadaId);
    if (!p || p.paga) return;
    els.saida.replaceChildren(estado.metodo === 'pix' ? montarPix(p) : montarBoleto(p));
    estado.fase = 'gerado'; render();
  });

  els.validar.addEventListener('click', () => {
    const p = parcelaPorId(estado.selecionadaId);
    if (!p || p.paga) return;
    p.paga = true; p.pagoEm = new Date(); p.metodo = estado.metodo;
    p.protocolo = `NDZ-${hash(`${p.id}${p.pagoEm.getTime()}`).toString(36).toUpperCase().padStart(8, '0').slice(0, 8)}`;
    estado.fase = 'validado'; els.saida.replaceChildren(); render();
    if (typeof window.showAppMessage === 'function') window.showAppMessage('Pagamento validado com sucesso.');
  });

  // ---------- carregamento ----------
  render();
  try {
    const resposta = await fetch(ENDPOINT_DISCIPLINAS);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível carregar suas disciplinas.');
    estado.disciplinas = (dados.disciplinas || []).length;
    estado.mensalidade = estado.disciplinas * VALOR_POR_DISCIPLINA;
    estado.parcelas = estado.mensalidade ? montarParcelas(estado.mensalidade) : [];
    estado.selecionadaId = proximaPendente()?.id ?? null;
  } catch (erro) {
    estado.erro = erro.message || 'Não foi possível carregar suas disciplinas.';
  }
  estado.carregando = false;
  render();
});