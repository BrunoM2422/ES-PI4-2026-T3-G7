package server.cliente_servidor.cliente;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.Socket;
import java.util.concurrent.Semaphore;

import server.cliente_servidor.Comunicado;

public class Parceiro
{
    private Socket             conexao;
    private ObjectInputStream  receptor;
    private ObjectOutputStream transmissor;

    private Comunicado proximoComunicado = null;

    // protege a leitura (espie/envie) e o campo proximoComunicado
    private final Semaphore mutExLeitura = new Semaphore (1, true);

    // protege a escrita no stream (receba)
    private final Object travaEscrita = new Object ();

    public Parceiro (Socket             conexao,
                     ObjectInputStream  receptor,
                     ObjectOutputStream transmissor)
                     throws Exception // se parametros nulos
    {
        if (conexao == null)
            throw new Exception ("Conexao ausente");

        if (receptor == null)
            throw new Exception ("Receptor ausente");

        if (transmissor == null)
            throw new Exception ("Transmissor ausente");

        this.conexao     = conexao;
        this.receptor    = receptor;
        this.transmissor = transmissor;
    }

    public void receba (Comunicado x) throws Exception
    {
        if (x == null)
            throw new Exception ("Comunicado ausente");

        try
        {
            synchronized (this.travaEscrita)
            {
                this.transmissor.writeObject (x);
                this.transmissor.reset ();  // evita reenviar versao antiga de objeto reutilizado
                this.transmissor.flush ();
            }
        }
        catch (IOException erro)
        {
            throw new Exception ("Erro de transmissao", erro);
        }
    }

    public Comunicado espie () throws Exception
    {
        this.mutExLeitura.acquireUninterruptibly ();
        try
        {
            if (this.proximoComunicado == null)
                this.proximoComunicado = (Comunicado) this.receptor.readObject ();

            return this.proximoComunicado;
        }
        catch (Exception erro)
        {
            throw new Exception ("Erro de recepcao", erro);
        }
        finally
        {
            this.mutExLeitura.release (); // sempre libera, mesmo com erro
        }
    }

    public Comunicado envie () throws Exception
    {
        this.mutExLeitura.acquireUninterruptibly ();
        try
        {
            if (this.proximoComunicado == null)
                this.proximoComunicado = (Comunicado) this.receptor.readObject ();

            Comunicado ret         = this.proximoComunicado;
            this.proximoComunicado = null;
            return ret;
        }
        catch (Exception erro)
        {
            throw new Exception ("Erro de recepcao", erro);
        }
        finally
        {
            this.mutExLeitura.release ();
        }
    }

    public void adeus () throws Exception
    {
        boolean falhou = false;

        // tenta fechar tudo, mesmo que algum close() falhe
        try { this.transmissor.close (); } catch (Exception erro) { falhou = true; }
        try { this.receptor   .close (); } catch (Exception erro) { falhou = true; }
        try { this.conexao    .close (); } catch (Exception erro) { falhou = true; }

        if (falhou)
            throw new Exception ("Erro de desconexao");
    }
}