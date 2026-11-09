package server.cliente_servidor;
import java.io.Serializable;

//Comunicado é o topo da hierarquia
public class Comunicado implements Serializable, Cloneable{
    //É uma classe oca -> corpo vazio, produzindo objetos ocos, sem atributos e métodos
    //raiz, base de todas as classes, por isso é oca

    //objetos devem herdar dessa interface Serializable podem ser transmitidos
    //através de sockets (somente esses podem ser transmitidos por sockets)
    //as vezes serializable transmite objetos ou gravam objetos em 1 arquivo
    //Serializable: nativa do java, vem do java.io
}
