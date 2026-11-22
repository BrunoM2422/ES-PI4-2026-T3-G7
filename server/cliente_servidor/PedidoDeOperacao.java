//Autor Matheus Antony Lucas Lima RA:25013260
package server.cliente_servidor;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import server.cliente_servidor.servidor.CalculadoraDeMedias;

//cliente manda essa classe
// indiretamente herda de serializable
public class PedidoDeOperacao extends Comunicado {
    private static final long serialVersionUID = 1L;

    private final String tipo;
    private final ArrayList<CalculadoraDeMedias.Componente>  componentes;
    private final ArrayList<CalculadoraDeMedias.NotasDoAluno> alunos;

    public PedidoDeOperacao (String tipo, List<CalculadoraDeMedias.Componente> componentes, List<CalculadoraDeMedias.NotasDoAluno> alunos) throws Exception{
        if (tipo == null)
            throw new Exception ("Tipo ausente");
        if (componentes == null)
            throw new Exception ("Componentes ausentes");
        if (alunos == null)
            throw new Exception ("Alunos ausentes");

        this.tipo        = tipo;
        this.componentes = new ArrayList<CalculadoraDeMedias.Componente>  (componentes);
        this.alunos      = new ArrayList<CalculadoraDeMedias.NotasDoAluno> (alunos);
    }

    public String getTipo ()
    {
        return this.tipo;
    }

    public List<CalculadoraDeMedias.Componente> getComponentes ()
    {
        return Collections.unmodifiableList (this.componentes);
    }

    public List<CalculadoraDeMedias.NotasDoAluno> getAlunos ()
    {
        return Collections.unmodifiableList (this.alunos);
    }
}

//se o cliente manda o pedidodeoperacao o servidor a recebe
//no servidor precisa dessa classe para receber e usar objetos dessa