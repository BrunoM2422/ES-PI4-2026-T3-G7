// Autores: Luca Filippi — RA: 25022556
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#cadastro');
  const tipo = form.querySelector('#tipo');
  const predio = form.querySelector('#predio');
  const nome = form.querySelector('#nome');
  const status = form.querySelector('#status');
  function atualizarCampos() {
    const sala = tipo.value === 'sala';
    form.querySelector('#campo-predio').hidden = !sala;
    predio.disabled = !sala;
    predio.required = sala;
    form.querySelector('#rotulo').textContent = sala ? 'Nome ou número da sala' : 'Nome do prédio';
    nome.placeholder = sala ? 'Ex.: 202' : 'Ex.: H-15';
  }
  async function carregar() {
    const resposta = await fetch('/api/admin/predios');
    if (!resposta.ok) throw new Error('Não foi possível carregar os prédios.');
    const { predios } = await resposta.json();
    const lista = document.querySelector('#locais');
    const anterior = predio.value;
    predio.replaceChildren(new Option('Selecione o prédio', ''));
    lista.replaceChildren();
    if (!predios.length) lista.textContent = 'Cadastre o primeiro prédio para adicionar salas.';
    for (const item of predios) {
      predio.add(new Option(item.nome, item._id));
      const linha = document.createElement('p');
      const titulo = document.createElement('strong');
      titulo.textContent = item.nome;
      linha.append(titulo, ' · ', item.salas.map(s => s.nome).join(', ') || 'Sem salas cadastradas');
      lista.append(linha);
    }
    predio.value = anterior;
  }
  tipo.onchange = atualizarCampos;
  form.onsubmit = async event => {
    event.preventDefault();
    const botao = form.querySelector('button');
    botao.disabled = true;
    try {
      const body = { nome: nome.value.trim() };
      if (tipo.value === 'sala') body.predioId = predio.value;
      const resposta = await fetch('/api/admin/predios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || 'Cadastro indisponível.');
      nome.value = '';
      status.textContent = dados.mensagem;
      await carregar();
    } catch (erro) { status.textContent = erro.message; }
    finally { botao.disabled = false; }
  };
  atualizarCampos();
  document.querySelector('[data-importacao-csv]').addEventListener('importacao-concluida', () => {
    carregar().catch(erro => { status.textContent = erro.message; });
  });
  carregar().catch(erro => { status.textContent = erro.message; });
});
