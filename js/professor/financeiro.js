//Autor: Matheus Antony Lucas Lima
//RA:25013260

document.addEventListener('DOMContentLoaded', async () => {
  const raiz = document.querySelector('[data-finance-professor]');
  if (!raiz) return;

  // ---------- regras do salário ----------
  const VALOR_POR_DISCIPLINA = 2400;     // salário base mensal por disciplina lecionada (R$)
  const ADICIONAL_TITULACAO = 0.10;      // adicional de titulação sobre o salário base
  const GRATIFICACAO_POR_TURMA = 150;    // gratificação mensal por turma em que leciona (R$)
  const ALIQUOTA_INSS = 0.11;            // desconto estimado de INSS sobre o bruto
  const ALIQUOTA_IRRF = 0.075;           // desconto estimado de IRRF sobre o bruto
  const PLANO_DE_SAUDE = 180;            // desconto fixo mensal do plano de saúde (R$)
  const DIA_PAGAMENTO = 5;               // o salário do mês é pago no dia 5 do mês seguinte
  const TOTAL_MESES = 6;                 // quantidade de demonstrativos exibidos
  const ENDPOINT_DISCIPLINAS = '/api/notas/professor'; // devolve { disciplinas: [{ turmaId, ... }] } do professor logado

  // ---------- utilitários ----------
  const q = nome => raiz.querySelector(`[data-fin="${nome}"]`);
  const el = (tag, cls, texto) => {
    const no = document.createElement(tag);
    if (cls) no.className = cls;
    if (texto !== undefined) no.textContent = texto;
    return no;
  };
  const esc = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const moeda = valor => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataCurta = data => data.toLocaleDateString('pt-BR');
  const centavos = valor => Math.round(valor * 100) / 100;
  const plural = (n, singular, pluralTxt) => `${n} ${n === 1 ? singular : pluralTxt}`;
  const percentual = taxa => `${(taxa * 100).toLocaleString('pt-BR')}%`;

  const els = {
    salario: q('salario'), salarioDetalhe: q('salario-detalhe'),
    adicionais: q('adicionais'), adicionaisDetalhe: q('adicionais-detalhe'),
    liquido: q('liquido'), liquidoDetalhe: q('liquido-detalhe'),
    tabela: q('tabela'), exportar: q('exportar'), nota: q('nota'),
    detalheVazio: q('detalhe-vazio'), detalheConteudo: q('detalhe-conteudo')
  };

  // ---------- estado ----------
  const estado = { disciplinas: 0, turmas: 0, demonstrativos: [], selecionadoId: null, erro: null, carregando: true };

  function calcularMes(disciplinas, turmas) {
    const base = centavos(disciplinas * VALOR_POR_DISCIPLINA);
    const titulacao = centavos(base * ADICIONAL_TITULACAO);
    const gratificacao = centavos(turmas * GRATIFICACAO_POR_TURMA);
    const bruto = centavos(base + titulacao + gratificacao);
    const inss = centavos(bruto * ALIQUOTA_INSS);
    const irrf = centavos(bruto * ALIQUOTA_IRRF);
    const plano = bruto > 0 ? PLANO_DE_SAUDE : 0;
    const totalDescontos = centavos(inss + irrf + plano);
    return {
      base, adicionais: centavos(titulacao + gratificacao), bruto, totalDescontos, liquido: centavos(bruto - totalDescontos),
      proventos: [
        { rotulo: `Salário base (${plural(disciplinas, 'disciplina', 'disciplinas')} × ${moeda(VALOR_POR_DISCIPLINA)})`, valor: base },
        { rotulo: `Adicional de titulação (${percentual(ADICIONAL_TITULACAO)})`, valor: titulacao },
        { rotulo: `Gratificação por turma (${plural(turmas, 'turma', 'turmas')} × ${moeda(GRATIFICACAO_POR_TURMA)})`, valor: gratificacao }
      ],
      descontos: [
        { rotulo: `INSS (${percentual(ALIQUOTA_INSS)})`, valor: inss },
        { rotulo: `IRRF (${percentual(ALIQUOTA_IRRF)})`, valor: irrf },
        { rotulo: 'Plano de saúde', valor: plano }
      ]
    };
  }

  function montarDemonstrativos(disciplinas, turmas) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return Array.from({ length: TOTAL_MESES }, (_, i) => {
      const referencia = new Date(hoje.getFullYear(), hoje.getMonth() - (TOTAL_MESES - 1 - i), 1);
      const pagamento = new Date(referencia.getFullYear(), referencia.getMonth() + 1, DIA_PAGAMENTO);
      const mes = String(referencia.getMonth() + 1).padStart(2, '0');
      return {
        id: `${referencia.getFullYear()}${mes}`,
        referencia: `${mes}/${referencia.getFullYear()}`,
        pagamento, pago: pagamento <= hoje,
        ...calcularMes(disciplinas, turmas)
      };
    });
  }

  const demonstrativoPorId = id => estado.demonstrativos.find(d => d.id === id) || null;
  const pagos = () => estado.demonstrativos.filter(d => d.pago);

  // ---------- PDF (impressão do navegador, escolha "Salvar como PDF") ----------
  function htmlDemonstrativo(d) {
    const linhas = lista => lista.map(i => `<tr><td>${esc(i.rotulo)}</td><td class="v">${esc(moeda(i.valor))}</td></tr>`).join('');
    return `<section>
      <h2>Demonstrativo de pagamento ${esc(d.referencia)}</h2>
      <p>${d.pago ? `Pago em ${esc(dataCurta(d.pagamento))}` : `Pagamento previsto para ${esc(dataCurta(d.pagamento))}`}</p>
      <table>
        <tr><th colspan="2">Proventos</th></tr>${linhas(d.proventos)}
        <tr class="t"><td>Total bruto</td><td class="v">${esc(moeda(d.bruto))}</td></tr>
        <tr><th colspan="2">Descontos</th></tr>${linhas(d.descontos)}
        <tr class="t"><td>Total de descontos</td><td class="v">${esc(`-${moeda(d.totalDescontos)}`)}</td></tr>
        <tr class="l"><td>Líquido</td><td class="v">${esc(moeda(d.liquido))}</td></tr>
      </table>
    </section>`;
  }

  function imprimir(lista, titulo) {
    if (!lista.length) return;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:32px}
      h1{font-size:18px;margin:0 0 4px} h2{font-size:15px;margin:0 0 2px} p{margin:0 0 10px;font-size:12px;color:#596b87}
      section{page-break-after:always;margin-bottom:28px} section:last-of-type{page-break-after:auto}
      table{width:100%;border-collapse:collapse;font-size:12px} th{text-align:left;background:#f0f3f8;padding:6px 8px}
      td{padding:6px 8px;border-bottom:1px solid #e1e8f0} .v{text-align:right;white-space:nowrap}
      .t td{font-weight:700} .l td{font-weight:700;font-size:14px;border-bottom:0} small{color:#75849b}
    </style></head><body><h1>NotaDez, ${esc(titulo)}</h1><p><small>Documento simulado para fins acadêmicos.</small></p>${lista.map(htmlDemonstrativo).join('')}</body></html>`;

    const quadro = document.createElement('iframe');
    quadro.setAttribute('aria-hidden', 'true');
    quadro.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    document.body.append(quadro);
    const doc = quadro.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    quadro.contentWindow.addEventListener('afterprint', () => quadro.remove());
    setTimeout(() => quadro.remove(), 120000);
    setTimeout(() => { quadro.contentWindow.focus(); quadro.contentWindow.print(); }, 150);
  }

  // ---------- renderização ----------
  function renderResumo() {
    const sem = '\u00a0';
    if (estado.carregando) {
      els.salario.textContent = '—'; els.salarioDetalhe.textContent = 'Calculando com base nas suas disciplinas...';
      els.adicionais.textContent = '—'; els.adicionaisDetalhe.textContent = sem;
      els.liquido.textContent = '—'; els.liquidoDetalhe.textContent = sem;
      return;
    }
    if (estado.erro) {
      els.salario.textContent = '—'; els.salarioDetalhe.textContent = estado.erro;
      els.adicionais.textContent = '—'; els.adicionaisDetalhe.textContent = sem;
      els.liquido.textContent = '—'; els.liquidoDetalhe.textContent = sem;
      return;
    }
    const atual = estado.demonstrativos[estado.demonstrativos.length - 1] || calcularMes(0, 0);
    els.salario.textContent = moeda(atual.base);
    els.salarioDetalhe.textContent = estado.disciplinas
      ? `${plural(estado.disciplinas, 'disciplina', 'disciplinas')} × ${moeda(VALOR_POR_DISCIPLINA)}`
      : 'Você não leciona nenhuma disciplina.';
    els.adicionais.textContent = moeda(atual.adicionais);
    els.adicionaisDetalhe.textContent = estado.disciplinas
      ? `Titulação de ${percentual(ADICIONAL_TITULACAO)} e ${plural(estado.turmas, 'turma', 'turmas')}`
      : 'Sem adicionais no período.';
    const lista = estado.demonstrativos;
    const media = lista.length ? centavos(lista.reduce((soma, d) => soma + d.liquido, 0) / lista.length) : 0;
    els.liquido.textContent = moeda(media);
    els.liquidoDetalhe.textContent = lista.length ? `Média dos últimos ${plural(lista.length, 'mês', 'meses')}` : 'Sem pagamentos no período.';
  }

  function linhaVazia(texto) {
    const linha = el('tr'); const celula = el('td', 'finance-empty', texto);
    celula.colSpan = 6; linha.append(celula); els.tabela.append(linha);
  }

  function renderTabela() {
    els.tabela.replaceChildren();
    els.nota.hidden = !estado.demonstrativos.length;
    els.exportar.disabled = !pagos().length;
    if (estado.carregando) return linhaVazia('Carregando demonstrativos...');
    if (estado.erro) return linhaVazia(estado.erro);
    if (!estado.demonstrativos.length) return linhaVazia('Você não leciona nenhuma disciplina, por isso não há demonstrativos.');

    [...estado.demonstrativos].reverse().forEach(d => {
      const linha = el('tr', d.id === estado.selecionadoId ? 'is-selected' : '');
      const celulaRef = el('td');
      const botaoRef = el('button', 'finance-link', d.referencia); botaoRef.type = 'button';
      botaoRef.setAttribute('aria-pressed', String(d.id === estado.selecionadoId));
      botaoRef.addEventListener('click', () => { estado.selecionadoId = d.id; render(); });
      celulaRef.append(botaoRef);

      const celulaComprovante = el('td');
      if (d.pago) {
        const botao = el('button', 'finance-btn is-small', 'Baixar PDF'); botao.type = 'button';
        botao.addEventListener('click', () => imprimir([d], `Comprovante de pagamento ${d.referencia}`));
        celulaComprovante.append(botao);
      } else celulaComprovante.textContent = '—';

      linha.append(
        celulaRef, el('td', '', moeda(d.bruto)), el('td', 'finance-negative', `-${moeda(d.totalDescontos)}`),
        el('td', 'finance-strong', moeda(d.liquido)),
        el('td', d.pago ? '' : 'finance-muted', d.pago ? dataCurta(d.pagamento) : `Previsto ${dataCurta(d.pagamento)}`),
        celulaComprovante
      );
      els.tabela.append(linha);
    });
  }

  function listaDl(itens, classe) {
    const dl = el('dl');
    itens.forEach(([rotulo, valor, cls]) => { const linha = el('div', cls || classe || ''); linha.append(el('dt', '', rotulo), el('dd', '', valor)); dl.append(linha); });
    return dl;
  }

  function renderDetalhe() {
    const d = demonstrativoPorId(estado.selecionadoId);
    els.detalheVazio.hidden = Boolean(d);
    els.detalheConteudo.hidden = !d;
    if (!d) {
      els.detalheVazio.textContent = estado.carregando ? 'Carregando demonstrativo...' : 'Dados do demonstrativo não disponíveis.';
      return;
    }
    els.detalheConteudo.replaceChildren(
      el('p', 'finance-detail-ref', `Referência ${d.referencia}, ${d.pago ? 'pago em' : 'previsto para'} ${dataCurta(d.pagamento)}`),
      el('p', 'finance-detail-group', 'Proventos'),
      listaDl([...d.proventos.map(i => [i.rotulo, moeda(i.valor)]), ['Total bruto', moeda(d.bruto), 'finance-total']]),
      el('p', 'finance-detail-group', 'Descontos'),
      listaDl([...d.descontos.map(i => [i.rotulo, `-${moeda(i.valor)}`, 'finance-deduction']), ['Total de descontos', `-${moeda(d.totalDescontos)}`, 'finance-deduction finance-total']]),
      listaDl([['Líquido a receber', moeda(d.liquido), 'finance-net']])
    );
  }

  function render() { renderResumo(); renderTabela(); renderDetalhe(); }

  // ---------- eventos ----------
  els.exportar.addEventListener('click', () => imprimir(pagos(), 'Demonstrativos de pagamento'));

  // ---------- carregamento ----------
  render();
  try {
    const resposta = await fetch(ENDPOINT_DISCIPLINAS);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível carregar suas disciplinas.');
    const disciplinas = dados.disciplinas || [];
    estado.disciplinas = disciplinas.length;
    estado.turmas = new Set(disciplinas.map(d => d.turmaId)).size;
    estado.demonstrativos = estado.disciplinas ? montarDemonstrativos(estado.disciplinas, estado.turmas) : [];
    estado.selecionadoId = estado.demonstrativos.length ? estado.demonstrativos[estado.demonstrativos.length - 1].id : null;
  } catch (erro) {
    estado.erro = erro.message || 'Não foi possível carregar suas disciplinas.';
  }
  estado.carregando = false;
  render();
});