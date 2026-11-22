// Autores:
(() => {
  const normalizarCpf = valor => String(valor || '').replace(/\D/g, '');
  const validarCpf = valor => {
    const cpf = normalizarCpf(valor);
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
    const digito = tamanho => {
      let soma = 0;
      for (let i = 0; i < tamanho; i += 1) soma += Number(cpf[i]) * (tamanho + 1 - i);
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
    return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
  };
  const normalizarTelefone = valor => {
    let telefone = String(valor || '').replace(/\D/g, '');
    if (telefone.startsWith('55') && [12, 13].includes(telefone.length)) telefone = telefone.slice(2);
    return telefone;
  };
  const ddds = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
  const validarTelefone = (valor, obrigatorio = false) => {
    if (!String(valor || '').trim()) return !obrigatorio;
    const telefone = normalizarTelefone(valor);
    if (![10, 11].includes(telefone.length) || !ddds.has(telefone.slice(0, 2))) return false;
    const assinante = telefone.slice(2);
    return telefone.length === 11 ? assinante.startsWith('9') : /^[2-5]/.test(assinante);
  };
  const formatarCpf = valor => {
    const cpf = normalizarCpf(valor).slice(0, 11);
    return cpf.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };
  const formatarTelefone = valor => {
    const telefone = normalizarTelefone(valor).slice(0, 11);
    if (telefone.length <= 2) return telefone ? `(${telefone}` : '';
    const ddd = telefone.slice(0, 2);
    const assinante = telefone.slice(2);
    const tamanhoInicial = telefone.length > 6 ? (telefone.length === 11 ? 5 : 4) : (telefone.length - 2);
    return `(${ddd}) ${assinante.slice(0, tamanhoInicial)}${assinante.length > tamanhoInicial ? `-${assinante.slice(tamanhoInicial)}` : ''}`;
  };
  const vincularCampos = raiz => {
    raiz.querySelectorAll('input[name="cpf"]').forEach(campo => campo.addEventListener('input', () => { campo.value = formatarCpf(campo.value); }));
    raiz.querySelectorAll('input[name="telefone"]').forEach(campo => campo.addEventListener('input', () => { campo.value = formatarTelefone(campo.value); }));
  };
  window.NotaDezValidacaoBrasil = { normalizarCpf, validarCpf, normalizarTelefone, validarTelefone, vincularCampos };
})();
