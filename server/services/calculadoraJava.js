const { spawn } = require('child_process');
const path = require('path');

function calcularMediasNoJava(tipoMedia, componentes, alunos) {
  return new Promise((resolve, reject) => {
    // Aponta para a raiz do projeto onde o pacote 'server.cliente_servidor...' está compilado
    const diretorioRaiz = path.join(__dirname, '..', '..'); 

    // Chama o Cliente.java apontando para a porta 3001 do Servidor.java
    const processoJava = spawn('java', [
      'server.cliente_servidor.cliente.Cliente',
      'localhost',
      '3001'
    ], { cwd: diretorioRaiz });

    let saida = '';
    let erroSaida = '';

    processoJava.stdout.on('data', (dados) => { saida += dados.toString('utf8'); });
    processoJava.stderr.on('data', (dados) => { erroSaida += dados.toString('utf8'); });

    // Mapeia ObjectId (String) <-> Índice Inteiro para o Java aceitar
    const mapaIndiceParaObjectId = new Map();

    processoJava.on('close', (codigo) => {
      if (codigo !== 0 || saida.startsWith('ERRO')) {
        return reject(new Error(saida.replace('ERRO ', '').trim() || erroSaida || 'Erro ao comunicar com o servidor Java.'));
      }

      const mediasPorAluno = new Map();
      const linhas = saida.trim().split('\n').filter(Boolean);

      for (const linha of linhas) {
        const [, indiceStr, mediaStr] = linha.split(' ');
        const objectId = mapaIndiceParaObjectId.get(Number(indiceStr));
        if (objectId) {
          mediasPorAluno.set(objectId, Number(mediaStr));
        }
      }

      resolve(mediasPorAluno);
    });

    // Monta o protocolo de entrada (stdin) esperado pelo Cliente.java
    const tipoFormatado = tipoMedia === 'ponderada' ? 'Ponderada' : 'Aritmetica';
    let payload = `TIPO ${tipoFormatado}\n`;

    componentes.forEach(c => {
      payload += `COMP ${c.id} ${c.peso || 1}\n`;
    });

    alunos.forEach((aluno, index) => {
      const idNumerico = index + 1;
      mapaIndiceParaObjectId.set(idNumerico, String(aluno.id));
      
      payload += `ALUNO ${idNumerico}\n`;
      aluno.componentes.forEach(comp => {
        if (comp.valor !== null && comp.valor !== undefined) {
          payload += `NOTA ${comp.id} ${comp.valor}\n`;
        }
      });
    });

    processoJava.stdin.write(payload);
    processoJava.stdin.end();
  });
}

module.exports = { calcularMediasNoJava };