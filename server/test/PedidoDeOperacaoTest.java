package server.test;

import static org.junit.jupiter.api.Assertions.*;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;


import server.cliente_servidor.PedidoDeOperacao;
import server.cliente_servidor.servidor.CalculadoraDeMedias;
import server.cliente_servidor.servidor.CalculadoraDeMedias.Componente;
import server.cliente_servidor.servidor.CalculadoraDeMedias.NotasDoAluno;
import server.cliente_servidor.Comunicado;
/**
 * TESTE INTRACLASSE de PedidoDeOperacao (extra do item e).
 *
 * Particionamentos aplicados:
 *   A) ATRIBUTOS (tipo, componentes, alunos: nulo x valido)
 *   B) CATEGORIAS DE METODOS (construtora validadora, seletoras, serializacao)
 */
class PedidoDeOperacaoTest
{
    private static List<Componente> comps()
    {
        List<Componente> l = new ArrayList<Componente>();
        l.add(new Componente("1", 10));
        return l;
    }

    private static List<NotasDoAluno> alunos()
    {
        Map<String, Double> m = new HashMap<String, Double>();
        m.put("comp_1", 8.0);
        List<NotasDoAluno> l = new ArrayList<NotasDoAluno>();
        l.add(new NotasDoAluno(1, m));
        return l;
    }

    @Nested
    @DisplayName("A) Particionamento por ATRIBUTOS")
    class PorAtributos
    {
        @Test @DisplayName("todos os atributos validos -> objeto criado e seletoras corretas")
        void valido() throws Exception
        {
            PedidoDeOperacao p = new PedidoDeOperacao(CalculadoraDeMedias.PONDERADA, comps(), alunos());
            assertEquals(CalculadoraDeMedias.PONDERADA, p.getTipo());
            assertEquals(1, p.getComponentes().size());
            assertEquals(1, p.getAlunos().size());
        }

        @Test @DisplayName("tipo null -> Exception 'Tipo ausente'")
        void tipoNulo()
        {
            Exception e = assertThrows(Exception.class, () -> new PedidoDeOperacao(null, comps(), alunos()));
            assertEquals("Tipo ausente", e.getMessage());
        }

        @Test @DisplayName("componentes null -> Exception 'Componentes ausentes'")
        void componentesNulo()
        {
            Exception e = assertThrows(Exception.class,
                () -> new PedidoDeOperacao(CalculadoraDeMedias.ARITMETICA, null, alunos()));
            assertEquals("Componentes ausentes", e.getMessage());
        }

        @Test @DisplayName("alunos null -> Exception 'Alunos ausentes'")
        void alunosNulo()
        {
            Exception e = assertThrows(Exception.class,
                () -> new PedidoDeOperacao(CalculadoraDeMedias.ARITMETICA, comps(), null));
            assertEquals("Alunos ausentes", e.getMessage());
        }

        @Test @DisplayName("listas vazias sao aceitas pela construtora (validacao fica na Calculadora)")
        void listasVazias() throws Exception
        {
            PedidoDeOperacao p = new PedidoDeOperacao("qualquer", new ArrayList<Componente>(),
                                                      new ArrayList<NotasDoAluno>());
            assertTrue(p.getComponentes().isEmpty());
            assertTrue(p.getAlunos().isEmpty());
        }

        @Test @DisplayName("ordem de validacao: tipo -> componentes -> alunos")
        void ordemDeValidacao()
        {
            Exception e = assertThrows(Exception.class, () -> new PedidoDeOperacao(null, null, null));
            assertEquals("Tipo ausente", e.getMessage());
        }
    }

    @Nested
    @DisplayName("B) Particionamento por CATEGORIAS DE METODOS")
    class PorCategoriasDeMetodos
    {
        @Test @DisplayName("Construtora faz copia defensiva das listas recebidas")
        void copiaDefensiva() throws Exception
        {
            List<Componente> c = comps();
            List<NotasDoAluno> a = alunos();
            PedidoDeOperacao p = new PedidoDeOperacao(CalculadoraDeMedias.ARITMETICA, c, a);
            c.clear();
            a.clear();
            assertEquals(1, p.getComponentes().size());
            assertEquals(1, p.getAlunos().size());
        }

        @Test @DisplayName("Heranca: e um Comunicado")
        void heranca() throws Exception
        {
            assertTrue(new PedidoDeOperacao("t", comps(), alunos()) instanceof Comunicado);
        }

        @Test @DisplayName("Serializacao: ciclo write/read preserva os dados enviados ao servidor")
        void serializacao() throws Exception
        {
            PedidoDeOperacao p = new PedidoDeOperacao(CalculadoraDeMedias.PONDERADA, comps(), alunos());

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            try (ObjectOutputStream o = new ObjectOutputStream(bos)) { o.writeObject(p); }
            PedidoDeOperacao volta;
            try (ObjectInputStream i = new ObjectInputStream(new ByteArrayInputStream(bos.toByteArray())))
            { volta = (PedidoDeOperacao) i.readObject(); }

            assertEquals(CalculadoraDeMedias.PONDERADA, volta.getTipo());
            assertEquals("1", volta.getComponentes().get(0).getId());
            assertEquals(10.0, volta.getComponentes().get(0).getPeso(), 0.001);
            assertEquals(8.0, volta.getAlunos().get(0).getNotas().get("comp_1"), 0.001);
        }
    }

    @Nested
    @Tag("defeito")
    @DisplayName("DEFEITOS CONHECIDOS (falham de proposito)")
    class DefeitosConhecidos
    {
        @Test @DisplayName("D9: getComponentes() deveria devolver lista nao modificavel")
        void getComponentesExpoeLista() throws Exception
        {
            PedidoDeOperacao p = new PedidoDeOperacao("t", comps(), alunos());
            assertThrows(UnsupportedOperationException.class, () -> p.getComponentes().clear());
        }

        @Test @DisplayName("D10: getAlunos() deveria devolver lista nao modificavel")
        void getAlunosExpoeLista() throws Exception
        {
            PedidoDeOperacao p = new PedidoDeOperacao("t", comps(), alunos());
            assertThrows(UnsupportedOperationException.class, () -> p.getAlunos().clear());
        }
    }
}