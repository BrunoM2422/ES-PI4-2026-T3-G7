const { spawn } = require('child_process');
const path = require('path');

// Variável global para manter o processo do Java na memória
let javaProcess = null;

const javaServerService = {
    iniciar: () => {
        if (javaProcess) return { success: false, message: 'O servidor Java já está rodando.' };

        try {
            // Ajuste o cwd para o diretório raiz onde a pasta "server" (pacote java) está compilada
            const diretorioClasses = path.join(__dirname, '../../caminho/para/classes/java'); 

            // Roda: java server.cliente_servidor.servidor.Servidor
            javaProcess = spawn('java', ['server.cliente_servidor.servidor.Servidor'], {
                cwd: diretorioClasses
            });

            // Captura logs do Java para o console do Node
            javaProcess.stdout.on('data', (data) => console.log(`[Java Server]: ${data}`));
            javaProcess.stderr.on('data', (data) => console.error(`[Java Error]: ${data}`));
            
            // Se o processo morrer ou for fechado
            javaProcess.on('close', (code) => {
                console.log(`[Java Server] Encerrado com código ${code}`);
                javaProcess = null;
            });

            return { success: true, message: 'Servidor Java iniciado com sucesso.' };
        } catch (error) {
            return { success: false, message: `Erro ao iniciar: ${error.message}` };
        }
    },

    parar: () => {
        if (!javaProcess) return { success: false, message: 'O servidor Java não está rodando.' };
        
        javaProcess.kill(); // Mata o processo do S.O.
        javaProcess = null;
        return { success: true, message: 'Servidor Java desligado.' };
    },

    obterStatus: () => {
        return { rodando: javaProcess !== null };
    }
};

module.exports = javaServerService;