package server.cliente_servidor.servidor;

import server.cliente_servidor.Comunicado;

//cliente manda essa classe
//indiretamente herda de serializable
public class PedidoDeOperacao  extends Comunicado{
    private char operacao;
    private double valor;

    public PedidoDeOperacao (char operacao, double valor){
        this.operacao = operacao;
        this.valor = valor;
    }

    public char getOperacao(){
        return this.operacao;
    }
    
    public double getValor(){
        return this.valor;
    }

    @Override 
    public String toString(){
        return (""+this.getOperacao()+this.getValor());
    }
}

//se o cliente manda o pedidodeoperacao o servidor a recebe
//no servidor precisa dessa classe para receber e usar objetos dessa
