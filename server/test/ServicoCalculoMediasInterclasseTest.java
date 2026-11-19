package server.test;

import static org.junit.jupiter.api.Assertions.*;

import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import server.cliente_servidor.Comunicado;
import server.cliente_servidor.Parceiro;
import server.cliente_servidor.PedidoDeOperacao;
import server.cliente_servidor.PedidoParaSair;
import server.cliente_servidor.servidor.CalculadoraDeMedias.Componente;
import server.cliente_servidor.servidor.CalculadoraDeMedias.NotasDoAluno;
import server.cliente_servidor.servidor.CalculadoraDeMedias;
import server.cliente_servidor.servidor.Resultado;
import server.cliente_servidor.servidor.SupervisoraDeConexao;
/**
 * TESTE INTERCLASSE (item f) do servico principal: "calcular medias".
 *
 * Fluxo real exercitado, com socket de loopback (sem mocks):
 *   cliente (PedidoDeOperacao) -> SupervisoraDeConexao -> Parceiro
 *        -> CalculadoraDeMedias -> Resultado -> Parceiro -> cliente
 *
 * Cenario NORMAL:  calcular media ponderada de 2 alunos e encerrar com PedidoParaSair.
 * Cenario ERRO:    pesos que nao somam 10 -> Resultado com erro; a conexao continua viva.
 */
@Timeout(20)
class ServicoCalculoMediasInterclasseTest
{
    private ServerSocket          serverSocket;
    private Socket                cliente;
    private ObjectOutputStream    out;
    private ObjectInputStream     in;
    private ArrayList<Parceiro>   usuarios;
    private SupervisoraDeConexao  supervisora;

    @BeforeEach
    void conectar() throws Exception
    {
        this.usuarios     = new ArrayList<Parceiro>();
        this.serverSocket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress());

        this.cliente = new Socket(InetAddress.getLoopbackAddress(), this.serverSocket.getLocalPort());
        this.cliente.setSoTimeout(5000);
        Socket ladoServidor = this.serverSocket.accept();

        this.supervisora = new SupervisoraDeConexao(ladoServidor, this.usuarios);
        this.supervisora.start();

        // ambos os lados criam o OutputStream primeiro (evita deadlock de cabecalhos)
        this.out = new ObjectOutputStream(this.cliente.getOutputStream());
        this.out.flush();
        this.in  = new ObjectInputStream(this.cliente.getInputStream());
    }

    @AfterEach
    void desconectar() throws Exception
    {
        try { this.cliente.close(); }       catch (Exception e) {}
        try { this.serverSocket.close(); }  catch (Exception e) {}
        this.supervisora.join(5000);
    }

    // ---------- auxiliares ----------

    private void enviar(Comunicado c) throws Exception
    {
        this.out.writeObject(c);
        this.out.flush();
    }

    private Resultado receber() throws Exception
    {
        return (Resultado) this.in.readObject();
    }

    private static Map<String, Double> notas(double n1, double n2)
    {
        Map<String, Double> m = new HashMap<String, Double>();
        m.put("comp_1", n1);
        m.put("comp_2", n2);
        return m;
    }

    private static List<Componente> pesos(double p1, double p2)
    {
        return Arrays.asList(new Componente("1", p1), new Componente("2", p2));
    }

    private static List<NotasDoAluno> doisAlunos()
    {
        List<NotasDoAluno> l = new ArrayList<NotasDoAluno>();
        l.add(new NotasDoAluno(101, notas(8.0, 5.0)));    // (8*4 + 5*6)/10 = 6.2
        l.add(new NotasDoAluno(102, notas(10.0, 10.0)));  // 10.0
        return l;
    }

    // =====================================================================
    // CENARIO NORMAL
    // =====================================================================
    @Test
    @DisplayName("NORMAL: pedido valido -> Resultado com medias corretas; PedidoParaSair encerra e remove o usuario")
    void cenarioNormal() throws Exception
    {
        enviar(new PedidoDeOperacao(CalculadoraDeMedias.PONDERADA, pesos(4, 6), doisAlunos()));

        Resultado r = receber();

        assertFalse(r.temErro());
        assertNull(r.getErro());
        assertEquals(2, r.getMedias().size());
        assertEquals(101, r.getMedias().get(0).getIdEstudante());
        assertEquals(6.2,  r.getMedias().get(0).getMedia(), 0.001);
        assertEquals(102, r.getMedias().get(1).getIdEstudante());
        assertEquals(10.0, r.getMedias().get(1).getMedia(), 0.001);

        // o usuario foi registrado na lista compartilhada enquanto conectado
        synchronized (this.usuarios) { assertEquals(1, this.usuarios.size()); }

        // encerramento limpo
        enviar(new PedidoParaSair());
        this.supervisora.join(5000);
        assertFalse(this.supervisora.isAlive());
        synchronized (this.usuarios) { assertTrue(this.usuarios.isEmpty()); }
    }

    @Test
    @DisplayName("NORMAL: Aritmética via socket")
    void cenarioNormalAritmetica() throws Exception
    {
        enviar(new PedidoDeOperacao(CalculadoraDeMedias.ARITMETICA, pesos(1, 1), doisAlunos()));
        Resultado r = receber();
        assertFalse(r.temErro());
        assertEquals(6.5, r.getMedias().get(0).getMedia(), 0.001);   // (8+5)/2
        assertEquals(10.0, r.getMedias().get(1).getMedia(), 0.001);
    }

    // =====================================================================
    // CENARIO ALTERNATIVO / ERRO
    // =====================================================================
    @Test
    @DisplayName("ERRO: pesos nao somam 10 -> Resultado com erro (sem medias) e a conexao continua utilizavel")
    void cenarioErroPesosInvalidos() throws Exception
    {
        enviar(new PedidoDeOperacao(CalculadoraDeMedias.PONDERADA, pesos(4, 5), doisAlunos()));

        Resultado erro = receber();

        assertTrue(erro.temErro());
        assertTrue(erro.getErro().contains("soma dos pesos"));
        assertTrue(erro.getMedias().isEmpty());

        // a Supervisora NAO derruba a conexao por causa de erro de negocio
        enviar(new PedidoDeOperacao(CalculadoraDeMedias.PONDERADA, pesos(4, 6), doisAlunos()));
        Resultado ok = receber();
        assertFalse(ok.temErro());
        assertEquals(2, ok.getMedias().size());
    }

    @Test
    @DisplayName("ERRO: tipo de media invalido -> Resultado com erro")
    void cenarioErroTipoInvalido() throws Exception
    {
        enviar(new PedidoDeOperacao("Harmonica", pesos(4, 6), doisAlunos()));
        Resultado r = receber();
        assertTrue(r.temErro());
        assertTrue(r.getErro().contains("Tipo de média inválido"));
    }

    @Test
    @DisplayName("ERRO: pedido sem componentes -> Resultado com erro")
    void cenarioErroSemComponentes() throws Exception
    {
        enviar(new PedidoDeOperacao(CalculadoraDeMedias.ARITMETICA, new ArrayList<Componente>(), doisAlunos()));
        Resultado r = receber();
        assertTrue(r.temErro());
        assertTrue(r.getErro().contains("ao menos um componente"));
    }

    @Test
    @DisplayName("ALTERNATIVO: cliente cai sem enviar PedidoParaSair -> usuario e removido da lista")
    void clienteCaiAbruptamente() throws Exception
    {
        enviar(new PedidoDeOperacao(CalculadoraDeMedias.ARITMETICA, pesos(1, 1), doisAlunos()));
        receber(); // garante que o usuario ja foi registrado

        this.cliente.close();
        this.supervisora.join(5000);

        assertFalse(this.supervisora.isAlive());
        synchronized (this.usuarios) { assertTrue(this.usuarios.isEmpty()); }
    }

    @Test
    @DisplayName("Construtora da Supervisora valida parametros")
    void construtoraValidaParametros() throws Exception
    {
        Exception e1 = assertThrows(Exception.class,
            () -> new SupervisoraDeConexao(null, new ArrayList<Parceiro>()));
        assertEquals("Conexao ausente", e1.getMessage());

        try (Socket qualquer = new Socket())
        {
            Exception e2 = assertThrows(Exception.class,
                () -> new SupervisoraDeConexao(qualquer, null));
            assertEquals("Usuarios ausentes", e2.getMessage());
        }
    }

    // =====================================================================
    // DEFEITOS CONHECIDOS
    // =====================================================================
    @Test
    @Tag("defeito")
    @DisplayName("D11: aluno null no pedido deveria virar erro de negocio amigavel (hoje vaza mensagem interna do JVM/NPE)")
    void alunoNuloVazaExcecaoInterna() throws Exception
    {
        List<NotasDoAluno> alunos = Arrays.asList((NotasDoAluno) null);
        enviar(new PedidoDeOperacao(CalculadoraDeMedias.ARITMETICA, pesos(1, 1), alunos));

        Resultado r = receber();

        assertTrue(r.temErro());                    // JDK < 14: NPE sem mensagem => erro==null => FALHA aqui
        assertNotNull(r.getErro());
        assertFalse(r.getErro().contains("Cannot invoke"),   // JDK >= 15: texto interno do JVM vaza ao cliente
                    "Mensagem interna do JVM nao deveria chegar ao cliente: " + r.getErro());
    }
}