package server.cliente_servidor.cliente;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.PrintStream;
import java.net.Socket;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import server.cliente_servidor.Comunicado;
import server.cliente_servidor.servidor.CalculadoraDeMedias;
import server.cliente_servidor.servidor.PedidoDeOperacao;
import server.cliente_servidor.servidor.Resultado;

/**
 * Cliente do cálculo de médias.
 *
 * Uso (chamado pelo Node via child_process):
 *     java server.cliente_servidor.cliente.Cliente [HOST [PORTA]]
 *
 * Entrada (stdin), uma instrução por linha:
 *     TIPO Ponderada            (ou Aritmetica)
 *     COMP <id|-> <peso>        (um por componente, na ordem; "-" = sem id)
 *     ALUNO <id_estudante>      (inicia um aluno)
 *     NOTA <chave> <valor>      (chave igual à do front, ex.: comp_1)
 *
 * Saída (stdout):
 *     MEDIA <id_estudante> <media>   (uma linha por aluno)
 *     ERRO <mensagem>                (e código de saída 1)
 */
public class Cliente
{
    public static final String HOST_PADRAO  = "localhost";
    public static final int    PORTA_PADRAO = 3000;

    public static void main (String [] args)
    {
        if (args.length > 2)
        {
            System.err.println ("Uso esperado: java Cliente [HOST [PORTA]]\n");
            System.exit (2);
        }

        PrintStream saida = System.out;
        try
        {
            saida = new PrintStream (System.out, true, "UTF-8");

            String host  = args.length > 0  ? args[0] : Cliente.HOST_PADRAO;
            int    porta = args.length == 2 ? Integer.parseInt (args[1]) : Cliente.PORTA_PADRAO;

            PedidoDeOperacao pedido = lerPedido (System.in);
            Resultado resultado = calcularMedias (host, porta, pedido);

            if (resultado.temErro ())
            {
                saida.println ("ERRO " + resultado.getErro ());
                System.exit (1);
            }

            for (CalculadoraDeMedias.MediaDoAluno m : resultado.getMedias ())
                saida.println ("MEDIA " + m.getIdEstudante () + " " + m.getMedia ());
        }
        catch (Exception erro)
        {
            saida.println ("ERRO " + erro.getMessage ());
            System.exit (1);
        }

        System.exit (0);
    }

    /**
     * Conecta no servidor, envia o pedido e espera o resultado.
     * Pode ser chamado direto por outro código Java, sem passar pelo main.
     */
    public static Resultado calcularMedias (String host, int porta,PedidoDeOperacao pedido) throws Exception{
        Socket  conexao  = null;
        Parceiro servidor = null;

        try
        {
            conexao = new Socket (host, porta);

            ObjectOutputStream transmissor = new ObjectOutputStream (conexao.getOutputStream ());
            ObjectInputStream  receptor    = new ObjectInputStream  (conexao.getInputStream  ());

            servidor = new Parceiro (conexao, receptor, transmissor);

            servidor.receba (pedido);

            Comunicado comunicado;
            do
            {
                comunicado = servidor.espie ();

                if (comunicado instanceof ComunicadoDeDesligamento)
                    throw new Exception ("Servidor desligando, tente novamente mais tarde");
            }
            while (!(comunicado instanceof Resultado));

            return (Resultado) servidor.envie ();
        }
        catch (java.io.IOException erro)
        {
            throw new Exception ("Nao foi possivel conectar ao servidor " + host + ":" + porta, erro);
        }
        finally
        {
            if (servidor != null)
            {
                try { servidor.receba (new PedidoParaSair ()); } catch (Exception erro) {}
                try { servidor.adeus (); }                       catch (Exception erro) {}
            }
            else if (conexao != null)
            {
                try { conexao.close (); } catch (Exception erro) {}
            }
        }
    }

    // ---------- leitura do pedido (stdin) ----------

    private static PedidoDeOperacao lerPedido (InputStream entrada) throws Exception
    {
        BufferedReader leitor = new BufferedReader (new InputStreamReader (entrada, "UTF-8"));

        String tipo = null;
        List<CalculadoraDeMedias.Componente>   componentes = new ArrayList<CalculadoraDeMedias.Componente> ();
        List<CalculadoraDeMedias.NotasDoAluno> alunos      = new ArrayList<CalculadoraDeMedias.NotasDoAluno> ();

        Integer             idAtual    = null;
        Map<String, Double> notasAtuais = null;

        String linha;
        while ((linha = leitor.readLine ()) != null)
        {
            linha = linha.trim ();
            if (linha.isEmpty ())
                continue;

            String[] p = linha.split ("\\s+");

            try
            {
                if (p[0].equals ("TIPO"))
                {
                    tipo = normalizarTipo (p[1]);
                }
                else if (p[0].equals ("COMP"))
                {
                    String id = p[1].equals ("-") ? null : p[1];
                    componentes.add (new CalculadoraDeMedias.Componente (id, Double.parseDouble (p[2])));
                }
                else if (p[0].equals ("ALUNO"))
                {
                    if (idAtual != null)
                        alunos.add (new CalculadoraDeMedias.NotasDoAluno (idAtual, notasAtuais));

                    idAtual     = Integer.valueOf (p[1]);
                    notasAtuais = new HashMap<String, Double> ();
                }
                else if (p[0].equals ("NOTA"))
                {
                    if (notasAtuais == null)
                        throw new Exception ("NOTA antes de ALUNO");

                    notasAtuais.put (p[1], Double.valueOf (p[2]));
                }
                else
                    throw new Exception ("Instrucao desconhecida");
            }
            catch (Exception erro)
            {
                throw new Exception ("Linha invalida (" + linha + "): " + erro.getMessage ());
            }
        }

        if (idAtual != null)
            alunos.add (new CalculadoraDeMedias.NotasDoAluno (idAtual, notasAtuais));

        if (tipo == null)
            throw new Exception ("Tipo de media nao informado");

        return new PedidoDeOperacao (tipo, componentes, alunos);
    }

    // aceita "Aritmética", "Aritmetica", "Ponderada" (sem depender de acento/encoding)
    private static String normalizarTipo (String t) throws Exception
    {
        String s = t.toUpperCase ();

        if (s.startsWith ("ARIT"))
            return CalculadoraDeMedias.ARITMETICA;

        if (s.startsWith ("POND"))
            return CalculadoraDeMedias.PONDERADA;

        throw new Exception ("Tipo de media invalido: " + t);
    }
}


//Sockets: viabilizar a comunicação entre cliente e servidor, 
//podem rodar em máquinas diferentes e comunicam através da rede

//Threads: atender simultaneamente os clientes
//Cliente-servidor: servidor deve ser rodado antes,
//deve aguardar conexões dos clientes, qunado clientes rodam
// começam interagir fazendo solicitações ao servidor
//1 servidor -> muitos clientes

//Roda o programa e aguarda as conexões
//"desativar": envia aos clientes que o server esta sendo desligado
//Pode rodar o cliente quantas vezes quiser, sempre se conecta com o servidor

//variável double valendo 0 para o cliente que acabou de se conectar
//cada cliente o terá
//multiplica, soma, subtrai, divide a variavel double
//Cliente pode solicitar a variável double
//Quando roda o cliente tenta se conectar ao server, ele usa o localhost
//e a porta padrão -> tenta se conectar nessa porta dessa máquina
//pode dizer em qual máquina e qual host se conectar

//Tarefas simultâneas que devem ser realizadas no clientes após a
//realização das ações de iniciação listadas acima:
//1) Continuamente interagir com o usuário, mostrando as opções que
//ele têm, solicitando um valor que funcionará como segundo
//operando, como ele tenha optado por fazer um PedidoDeOperação
//ou mostrando Resultado, caso ele tenha optado por fazer um PedidoDeResultado
//e sempre sinalizando erros por mla uso
//2)Continuamente aguardar um Eventual ComunicadoDeDesligamento
//vindo do Servidor, para então tomar as medidas necessárias do lado do cliente

