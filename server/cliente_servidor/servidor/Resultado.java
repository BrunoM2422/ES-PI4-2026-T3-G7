// Autores: Matheus Antony Lucas Lima RA:25013260
package server.cliente_servidor.servidor;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import server.cliente_servidor.Comunicado;

//Quem manda é o servidor

public class Resultado extends Comunicado {
    private static final long serialVersionUID = 1L;

    private static final String ERRO_PADRAO = "Erro desconhecido";

    private final ArrayList<CalculadoraDeMedias.MediaDoAluno> medias;
    private final String erro; // null quando deu certo

    // resposta de sucesso
    public Resultado (List<CalculadoraDeMedias.MediaDoAluno> medias){
        if (medias == null)
            throw new IllegalArgumentException ("Lista de médias não pode ser nula");

        this.medias = new ArrayList<CalculadoraDeMedias.MediaDoAluno> (medias);
        this.erro   = null;
    }

    // resposta de erro
    public Resultado (String erro){
        this.medias = new ArrayList<CalculadoraDeMedias.MediaDoAluno> ();
        // erro nulo continua sendo uma resposta de erro (nunca vira sucesso)
        this.erro   = (erro == null) ? ERRO_PADRAO : erro;
    }

    public boolean temErro ()
    {
        return this.erro != null;
    }

    public String getErro ()
    {
        return this.erro;
    }

    public List<CalculadoraDeMedias.MediaDoAluno> getMedias ()
    {
        return Collections.unmodifiableList (this.medias);
    }
}