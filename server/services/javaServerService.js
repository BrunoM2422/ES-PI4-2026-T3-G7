// Autores:
const { spawn } = require('child_process');
const path = require('path');

// Raiz do projeto: é onde a pasta "server/" (pacote Java compilado) fica.
const DIRETORIO_RAIZ = path.join(__dirname, '..', '..');

// Porta única, usada pelo Servidor.java e pelo Cliente.java (via calculadoraJava.js)
const HOST = 'localhost';
const PORTA = String(process.env.JAVA_SERVER_PORT || '3001');

const TEMPO_MAX_INICIO_MS = 8000;
const TEMPO_MAX_PARADA_MS = 4000;

let processo = null;   // processo do Servidor.java
let iniciando = null;  // promessa de uma inicialização em andamento

function estaRodando() {
  return Boolean(processo && processo.exitCode === null && !processo.killed);
}

function iniciar() {
  if (estaRodando()) {
    return Promise.resolve({ success: true, message: 'O servidor Java já está em execução.' });
  }
  if (iniciando) return iniciando;

  iniciando = new Promise(resolve => {
    let concluido = false;
    let ultimoErro = '';

    const filho = spawn('java', ['server.cliente_servidor.servidor.Servidor', PORTA], {
      cwd: DIRETORIO_RAIZ,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    processo = filho;

    const concluir = resultado => {
      if (concluido) return;
      concluido = true;
      clearTimeout(timer);
      iniciando = null;
      resolve(resultado);
    };

    const timer = setTimeout(() => {
      concluir({ success: false, message: 'O servidor Java não confirmou a inicialização a tempo.' });
      filho.kill('SIGKILL');
    }, TEMPO_MAX_INICIO_MS);

    // evita que um EPIPE ao escrever no stdin derrube o Node
    filho.stdin.on('error', () => {});

    filho.stdout.on('data', dados => {
      const texto = dados.toString('utf8');
      console.log(`[Servidor Java]: ${texto.trim()}`);
      // o Servidor.java imprime SERVIDOR_ATIVO quando já está aceitando conexões
      if (texto.includes('SERVIDOR_ATIVO')) {
        concluir({ success: true, message: 'Servidor Java iniciado com sucesso.' });
      }
    });

    filho.stderr.on('data', dados => {
      const texto = dados.toString('utf8').trim();
      ultimoErro = texto || ultimoErro;
      console.error(`[Servidor Java Erro]: ${texto}`);
    });

    // "java" não instalado / não está no PATH
    filho.on('error', erro => {
      if (processo === filho) processo = null;
      concluir({ success: false, message: `Não foi possível executar o Java: ${erro.message}` });
    });

    filho.on('exit', codigo => {
      console.log(`[Servidor Java] Encerrado com código ${codigo}`);
      if (processo === filho) processo = null;
      concluir({ success: false, message: ultimoErro || `O servidor Java encerrou ao iniciar (código ${codigo}).` });
    });
  });

  return iniciando;
}

function parar() {
  if (!estaRodando()) {
    processo = null;
    return Promise.resolve({ success: true, message: 'O servidor Java já estava desligado.' });
  }

  const filho = processo;

  return new Promise(resolve => {
    // reserva: se o desligamento gracioso travar, força o fim
    const timer = setTimeout(() => filho.kill('SIGKILL'), TEMPO_MAX_PARADA_MS);

    filho.once('exit', () => {
      clearTimeout(timer);
      resolve({ success: true, message: 'Servidor Java desativado com sucesso.' });
    });

    try {
      // "desativar" avisa os clientes conectados e encerra o servidor
      filho.stdin.write('desativar\n');
    } catch (erro) {
      filho.kill('SIGTERM');
    }
  });
}

function obterStatus() {
  return { rodando: estaRodando(), porta: PORTA };
}

// Se o Node encerrar, o Java também encerra (o Servidor.java também sai sozinho
// quando o stdin fecha, então isto é só uma garantia extra).
process.on('exit', () => {
  if (processo) processo.kill();
});

module.exports = { iniciar, parar, obterStatus, estaRodando, HOST, PORTA, DIRETORIO_RAIZ };