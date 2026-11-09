package server.cliente_servidor.servidor;
import server.cliente_servidor.Comunicado;
//Quem manda é o servidor
//objetos dessa classe são usados quando no servidor 
//escrever "desativar"
//manda objetos dessa classe para todos os clientes
//para que eles saibam que o servidor está desligando

//Quem manda essa classe é o servidor com o comando
//desativar

//Servidor apenas atende aos clientes
//O servidor só quer algo quando é digitado o desativar
//ele quer informar aos clientes que está desligando

public class ComunicadoDeDesligamento extends Comunicado {
    //classe oca -> sem atributo e método
}
