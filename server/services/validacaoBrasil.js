// Autores: Bruno Machado — RA: 25008041
const DDDS_BRASIL = new Set([
  '11','12','13','14','15','16','17','18','19','21','22','24','27','28',
  '31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49',
  '51','53','54','55','61','62','63','64','65','66','67','68','69',
  '71','73','74','75','77','79','81','82','83','84','85','86','87','88','89',
  '91','92','93','94','95','96','97','98','99'
]);

function normalizarCpf(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function validarCpf(valor) {
  const cpf = normalizarCpf(valor);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calcularDigito = tamanho => {
    let soma = 0;
    for (let indice = 0; indice < tamanho; indice += 1) {
      soma += Number(cpf[indice]) * (tamanho + 1 - indice);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
}

function normalizarTelefone(valor) {
  let telefone = String(valor || '').replace(/\D/g, '');
  if (telefone.startsWith('55') && (telefone.length === 12 || telefone.length === 13)) telefone = telefone.slice(2);
  return telefone;
}

function validarTelefone(valor, obrigatorio = false) {
  if (!String(valor || '').trim()) return !obrigatorio;
  const telefone = normalizarTelefone(valor);
  if (!/^\d{10,11}$/.test(telefone) || !DDDS_BRASIL.has(telefone.slice(0, 2))) return false;
  const assinante = telefone.slice(2);
  return telefone.length === 11 ? assinante[0] === '9' : /^[2-5]/.test(assinante);
}

module.exports = { normalizarCpf, validarCpf, normalizarTelefone, validarTelefone };
