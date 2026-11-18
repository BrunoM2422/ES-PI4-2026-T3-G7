// Autores:
package server.cliente_servidor.servidor;

import java.util.ArrayList;

import server.cliente_servidor.ComunicadoDeDesligamento;
import server.cliente_servidor.Parceiro;
import server.cliente_servidor.Teclado;

/**
 * Servidor de cálculo de médias.
 *
 * Uso: java server.cliente_servidor.servidor.Servidor [PORTA]
 *
 * Controle (feito pelo Node via stdin):
 *     desativar  -> avisa os clientes conectados e encerra o servidor
 *
 * Saída (stdout):
 *     SERVIDOR_ATIVO   (linha impressa quando o servidor já está aceitando conexões)
 *
 * Se o stdin for fechado (ex.: o processo Node morreu), o servidor
 * também se desativa, para não ficar órfão ocupando a porta.
 */
public class Servidor
{
    public static String PORTA_PADRAO = "5000";

    public static void main (String[] args)
    {
        if (args.length>1)
        {
            System.err.println ("Uso esperado: java Servidor [PORTA]\n");
            System.exit (2);
        }

        String porta=Servidor.PORTA_PADRAO;
        if (args.length==1) porta = args[0];

        ArrayList<Parceiro> usuarios =new ArrayList<Parceiro> ();

        AceitadoraDeConexao aceitadoraDeConexao=null;
        try
        {
            aceitadoraDeConexao = new AceitadoraDeConexao (porta, usuarios);
            aceitadoraDeConexao.start();
        }
        catch (Exception erro)
        {
            System.err.println ("Escolha uma porta apropriada e liberada para uso!\n");
            System.exit (1);
        }

        // o Node espera essa linha para saber que o servidor subiu
        System.out.println ("SERVIDOR_ATIVO");
        System.out.flush ();

        for(;;)
        {
            String comando=null;
            try
            {
                comando = Teclado.getUmString();
            }
            catch (Exception erro)
            {}

            // comando == null -> stdin fechado: desliga tambem
            if (comando==null || comando.trim().equalsIgnoreCase("desativar"))
            {
                synchronized (usuarios)
                {
                    ComunicadoDeDesligamento comunicadoDeDesligamento =
                    new ComunicadoDeDesligamento ();
                    for (Parceiro usuario:usuarios)
                    {
                        try
                        {
                            usuario.receba (comunicadoDeDesligamento);
                            usuario.adeus  ();
                        }
                        catch (Exception erro)
                        {}
                    }
                }

                System.out.println ("O servidor foi desativado!");
                System.out.flush ();
                System.exit(0);
            }
            else
                System.err.println ("Comando invalido!");
        }
    }
}