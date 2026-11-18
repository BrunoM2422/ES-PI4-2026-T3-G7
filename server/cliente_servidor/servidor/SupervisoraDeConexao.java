// Autores:
package server.cliente_servidor.servidor;

import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.Socket;
import java.util.ArrayList;

import server.cliente_servidor.Comunicado;
import server.cliente_servidor.Parceiro;
import server.cliente_servidor.PedidoDeOperacao;
import server.cliente_servidor.PedidoParaSair;

/**
 * Atende um cliente: recebe PedidoDeOperacao, calcula as médias
 * e devolve um Resultado (com as médias ou com a mensagem de erro).
 *
 * Pré-requisito: Parceiro, PedidoDeOperacao, PedidoParaSair e
 * ComunicadoDeDesligamento unificados em server.cliente_servidor.
 */
public class SupervisoraDeConexao extends Thread
{
    private Parceiro            usuario;
    private Socket              conexao;
    private ArrayList<Parceiro> usuarios;

    public SupervisoraDeConexao
    (Socket conexao, ArrayList<Parceiro> usuarios)
    throws Exception
    {
        if (conexao==null)
            throw new Exception ("Conexao ausente");

        if (usuarios==null)
            throw new Exception ("Usuarios ausentes");

        this.conexao  = conexao;
        this.usuarios = usuarios;
    }

    public void run ()
    {
        ObjectOutputStream transmissor;
        try
        {
            transmissor =
            new ObjectOutputStream(
            this.conexao.getOutputStream());
        }
        catch (Exception erro)
        {
            return;
        }

        ObjectInputStream receptor=null;
        try
        {
            receptor=
            new ObjectInputStream(
            this.conexao.getInputStream());
        }
        catch (Exception err0)
        {
            try
            {
                transmissor.close();
            }
            catch (Exception falha)
            {} // so tentando fechar antes de acabar a thread
            return;
        }

        try
        {
            this.usuario =
            new Parceiro (this.conexao,
                          receptor,
                          transmissor);
        }
        catch (Exception erro)
        {
            return; // nao deve acontecer: parametros ja foram validados
        }

        try
        {
            synchronized (this.usuarios)
            {
                this.usuarios.add (this.usuario);
            }

            for(;;)
            {
                Comunicado comunicado = this.usuario.envie ();

                if (comunicado==null)
                    break;

                if (comunicado instanceof PedidoDeOperacao)
                {
                    PedidoDeOperacao pedido = (PedidoDeOperacao)comunicado;

                    Resultado resultado;
                    try
                    {
                        resultado = new Resultado (
                            CalculadoraDeMedias.calcular (
                                pedido.getTipo        (),
                                pedido.getComponentes (),
                                pedido.getAlunos      ()));
                    }
                    catch (Exception erro)
                    {
                        // ex.: tipo invalido, sem componentes, pesos nao somam 10
                        resultado = new Resultado (erro.getMessage ());
                    }

                    this.usuario.receba (resultado);
                }
                else if (comunicado instanceof PedidoParaSair)
                {
                    break;
                }
            }
        }
        catch (Exception erro)
        {} // cliente caiu ou o servidor esta desligando
        finally
        {
            synchronized (this.usuarios)
            {
                this.usuarios.remove (this.usuario);
            }

            try
            {
                this.usuario.adeus ();
            }
            catch (Exception falha)
            {} // so tentando fechar antes de acabar a thread
        }
    }
}