package server.cliente_servidor.servidor;

import server.cliente_servidor.Comunicado;
import java.util.List;
import java.util.ArrayList;

public class PedidoDeOperacao extends Comunicado {
    private static final long serialVersionUID = 1L;
    
    private final String tipo;
    private final List<CalculadoraDeMedias.Componente> componentes;
    private final List<CalculadoraDeMedias.NotasDoAluno> alunos;

    public PedidoDeOperacao(String tipo, 
                            List<CalculadoraDeMedias.Componente> componentes, 
                            List<CalculadoraDeMedias.NotasDoAluno> alunos) {
        this.tipo = tipo;
        this.componentes = new ArrayList<>(componentes);
        this.alunos = new ArrayList<>(alunos);
    }

    public String getTipo() {
        return this.tipo;
    }
    
    public List<CalculadoraDeMedias.Componente> getComponentes() {
        return this.componentes;
    }

    public List<CalculadoraDeMedias.NotasDoAluno> getAlunos() {
        return this.alunos;
    }
}