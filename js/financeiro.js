(() => {
  const app = document.querySelector('#app');
  const host = app?.querySelector('.content > .card');
  if (!host) return;

  host.classList.remove('card');
  host.classList.add('finance-host');

  const dash = value => value || '&mdash;';
  const summaryCard = (label, value, note, accent = '') => `
    <article class="finance-summary ${accent}">
      <span>${label}</span><strong>${dash(value)}</strong><small>${dash(note)}</small>
    </article>`;

  if (app.dataset.role === 'aluno') {
    host.innerHTML = `
      <div class="finance-page">
        <section class="finance-summary-grid student-summary">
          ${summaryCard('Total Pendente', 'R$ &mdash;', 'Referente a mensalidades em aberto')}
          ${summaryCard('Pr&oacute;ximo Vencimento', '&mdash;', 'Valor da pr&oacute;xima mensalidade', 'finance-accent')}
        </section>
        <section class="finance-panel">
          <div class="finance-panel-heading"><h2>Formas de Pagamento R&aacute;pidas</h2></div>
          <div class="payment-options">
            <button type="button" disabled><span aria-hidden="true">▣</span> PIX Copia e Cola</button>
            <button type="button" disabled><span aria-hidden="true">▣</span> Boleto Banc&aacute;rio</button>
          </div>
        </section>
        <section class="finance-panel finance-table-panel">
          <div class="finance-panel-heading"><h2>Hist&oacute;rico de Parcelas</h2></div>
          <div class="finance-table-wrap"><table>
            <thead><tr><th>Refer&ecirc;ncia</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>A&ccedil;&atilde;o</th></tr></thead>
            <tbody><tr><td colspan="5" class="finance-empty">Nenhuma parcela dispon&iacute;vel.</td></tr></tbody>
          </table></div>
        </section>
      </div>`;
    return;
  }

  host.innerHTML = `
    <div class="finance-page">
      <section class="finance-summary-grid professor-summary">
        ${summaryCard('Sal&aacute;rio Base', 'R$ &mdash;', 'Referente &agrave; grade contratual')}
        ${summaryCard('Adicionais &amp; Gratifica&ccedil;&otilde;es', 'R$ &mdash;', 'Coordena&ccedil;&atilde;o e horas extras', 'finance-accent')}
        ${summaryCard('L&iacute;quido M&eacute;dio', 'R$ &mdash;', 'Descontos consolidados aplicados')}
      </section>
      <div class="professor-finance-grid">
        <section class="finance-panel finance-table-panel">
          <div class="finance-panel-heading finance-heading-action"><h2>Demonstrativos de Pagamento</h2><button type="button" disabled>Exportar Todos (PDF)</button></div>
          <div class="finance-table-wrap"><table>
            <thead><tr><th>Refer&ecirc;ncia</th><th>Bruto</th><th>Descontos</th><th>L&iacute;quido</th><th>Data Pago</th><th>Comprovante</th></tr></thead>
            <tbody><tr><td colspan="6" class="finance-empty">Nenhum demonstrativo dispon&iacute;vel.</td></tr></tbody>
          </table></div>
        </section>
        <section class="finance-panel finance-detail">
          <div class="finance-panel-heading"><h2>Demonstrativo Detalhado</h2></div>
          <dl>
            <div><dt>Sal&aacute;rio Base (Horista)</dt><dd>R$ &mdash;</dd></div>
            <div><dt>DSR S&aacute;bado</dt><dd>R$ &mdash;</dd></div>
            <div><dt>Adicional de Titula&ccedil;&atilde;o</dt><dd>R$ &mdash;</dd></div>
            <div class="finance-deduction"><dt>INSS Previd&ecirc;ncia</dt><dd>R$ &mdash;</dd></div>
            <div class="finance-deduction"><dt>IRRF Retido Fonte</dt><dd>R$ &mdash;</dd></div>
            <div class="finance-net"><dt>Valor L&iacute;quido Recebido</dt><dd>R$ &mdash;</dd></div>
          </dl>
        </section>
      </div>
    </div>`;
})();
