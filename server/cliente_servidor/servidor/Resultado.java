package server.cliente_servidor.servidor;
import java.util.ArrayList;
import java.util.List;

import server.cliente_servidor.Comunicado;

//Quem manda é o servidor

public class Resultado extends Comunicado {
     private static final long serialVersionUID = 1L;
 
    private final ArrayList<CalculadoraDeMedias.MediaDoAluno> medias;
    private final String erro; // null quando deu certo
 
    // resposta de sucesso
    public Resultado (List<CalculadoraDeMedias.MediaDoAluno> medias){
        this.medias = new ArrayList<CalculadoraDeMedias.MediaDoAluno> (medias);
        this.erro   = null;
    }
 
    // resposta de erro
    public Resultado (String erro){
        this.medias = new ArrayList<CalculadoraDeMedias.MediaDoAluno> ();
        this.erro   = erro;
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
        return this.medias;
    }
}
