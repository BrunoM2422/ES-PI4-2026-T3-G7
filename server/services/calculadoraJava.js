// Autores: Matheus Antony Lucas Lima
const { spawn } = require('child_process');
const { HOST, PORTA, DIRETORIO_RAIZ } = require('./javaServerService');

const TEMPO_MAX_CALCULO_MS = 15000;

// O Java calcula tudo numa escala de 0 a 10 (a média ponderada divide por 10,
// a soma dos pesos). Com true, cada nota é convertida de [0, valorMaximo]
// para [0, 10] antes do envio. Com false, as notas vão como foram lançadas.
const NORMALIZAR_PARA_10 = true;

function notaParaJava(componente) {
  const valor = Number(componente.valor);
  const maximo = Number(componente.valorMaximo);
  if (!NORMALIZAR_PARA_10 || !Number.isFinite(maximo) || maximo <= 0) return valor;
  return Math.round((valor / maximo) * 10 * 10000) / 10000;
}

/**
 * Calcula as médias chamando o Cliente.java (que fala com o Servidor.java por socket).
 *
 * @param {'aritmetica'|'ponderada'} tipoMedia
 * @param {Array<{id, peso, valorMaximo}>} componentes
 * @param {Array<{id, componentes: Array<{id, valor, valorMaximo}>}>} alunos
 * @returns {Promise<Map<string, number>>} mapa idDoAluno -> média
 */
function calcularMediasNoJava(tipoMedia, componentes, alunos) {
  return new Promise((resolve, reject) => {
    // O Java só aceita ids de aluno inteiros: usamos 1..N e guardamos o mapa de volta
    const indiceParaIdAluno = new Map();

    const linhas = [`TIPO ${tipoMedia === 'ponderada' ? 'Ponderada' : 'Aritmetica'}`];

    componentes.forEach(c => {
      linhas.push(`COMP ${c.id} ${c.peso || 1}`);
    });

    alunos.forEach((aluno, i) => {
      const idNumerico = i + 1;
      indiceParaIdAluno.set(idNumerico, String(aluno.id));
      linhas.push(`ALUNO ${idNumerico}`);

      (aluno.componentes || []).forEach(comp => {
        if (comp.valor === null || comp.valor === undefined) return;
        // A CalculadoraDeMedias procura a nota pela chave "comp_<id>"
        linhas.push(`NOTA comp_${comp.id} ${notaParaJava(comp)}`);
      });
    });

    const processoJava = spawn(
      'java',
      ['server.cliente_servidor.cliente.Cliente', HOST, PORTA],
      { cwd: DIRETORIO_RAIZ }
    );

    let saida = '';
    let erroSaida = '';
    let finalizado = false;

    const finalizar = (fn, valor) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(timer);
      fn(valor);
    };

    const timer = setTimeout(() => {
      processoJava.kill('SIGKILL');
      finalizar(reject, new Error('Tempo esgotado ao calcular as médias no servidor Java.'));
    }, TEMPO_MAX_CALCULO_MS);

    processoJava.stdout.on('data', dados => { saida += dados.toString('utf8'); });
    processoJava.stderr.on('data', dados => { erroSaida += dados.toString('utf8'); });

    // "java" não instalado / não está no PATH
    processoJava.on('error', erro => {
      finalizar(reject, new Error(`Não foi possível executar o Java: ${erro.message}`));
    });

    // evita EPIPE derrubando o Node se o Java morrer antes de ler o stdin
    processoJava.stdin.on('error', () => {});

    processoJava.on('close', codigo => {
      if (codigo !== 0 || saida.startsWith('ERRO')) {
        const detalhe = saida.replace(/^ERRO\s*/, '').trim() || erroSaida.trim();

        if (/Nao foi possivel conectar/i.test(detalhe) || /Connection refused/i.test(detalhe)) {
          return finalizar(reject, new Error('Servidor de cálculo desativado. Peça ao administrador para ativá-lo.'));
        }
        return finalizar(reject, new Error(detalhe || 'Erro ao comunicar com o servidor Java.'));
      }

      const mediasPorAluno = new Map();
      for (const linha of saida.trim().split('\n').filter(Boolean)) {
        const [tag, indiceStr, mediaStr] = linha.trim().split(/\s+/);
        if (tag !== 'MEDIA') continue;
        const idAluno = indiceParaIdAluno.get(Number(indiceStr));
        if (idAluno) mediasPorAluno.set(idAluno, Number(mediaStr));
      }

      finalizar(resolve, mediasPorAluno);
    });

    processoJava.stdin.write(linhas.join('\n') + '\n');
    processoJava.stdin.end();
  });
}

module.exports = { calcularMediasNoJava };