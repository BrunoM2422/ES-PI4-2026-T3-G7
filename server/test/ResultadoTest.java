//Autor Matheus Antony Lucas Lima RA:25013260


package server.test;

import static org.junit.jupiter.api.Assertions.*;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;


import server.cliente_servidor.servidor.Resultado;
import server.cliente_servidor.Comunicado;
import server.cliente_servidor.servidor.CalculadoraDeMedias.MediaDoAluno;

/**
 * TESTE INTRACLASSE de Resultado (item e).
 *
 * Particionamentos aplicados:
 *   A) ESTADOS  -> SUCESSO (erro == null) e ERRO (erro != null)
 *   B) CATEGORIAS DE METODOS -> construtoras, seletoras, heranca/serializacao
 */
class ResultadoTest
{
    private static List<MediaDoAluno> duasMedias()
    {
        List<MediaDoAluno> l = new ArrayList<MediaDoAluno>();
        l.add(new MediaDoAluno(1, 7.0));
        l.add(new MediaDoAluno(2, 4.5));
        return l;
    }

    @SuppressWarnings("unchecked")
    private static <T> T ciclo(T obj) throws Exception
    {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (ObjectOutputStream o = new ObjectOutputStream(bos)) { o.writeObject(obj); }
        try (ObjectInputStream i = new ObjectInputStream(new ByteArrayInputStream(bos.toByteArray())))
        { return (T) i.readObject(); }
    }

    // =====================================================================
    // A) ESTADOS
    // =====================================================================
    @Nested
    @DisplayName("A) Particionamento por ESTADOS")
    class PorEstados
    {
        @Test @DisplayName("Estado SUCESSO com medias")
        void sucessoComMedias()
        {
            Resultado r = new Resultado(duasMedias());
            assertFalse(r.temErro());
            assertNull(r.getErro());
            assertEquals(2, r.getMedias().size());
            assertEquals(1, r.getMedias().get(0).getIdEstudante());
            assertEquals(4.5, r.getMedias().get(1).getMedia(), 0.001);
        }

        @Test @DisplayName("Estado SUCESSO com lista vazia (turma sem alunos) continua sendo sucesso")
        void sucessoComListaVazia()
        {
            Resultado r = new Resultado(new ArrayList<MediaDoAluno>());
            assertFalse(r.temErro());
            assertTrue(r.getMedias().isEmpty());
        }

        @Test @DisplayName("Estado ERRO: mensagem preservada e lista de medias vazia")
        void erroComMensagem()
        {
            Resultado r = new Resultado("A soma dos pesos deve ser exatamente 10.");
            assertTrue(r.temErro());
            assertEquals("A soma dos pesos deve ser exatamente 10.", r.getErro());
            assertNotNull(r.getMedias());
            assertTrue(r.getMedias().isEmpty());
        }

        @Test @DisplayName("Estado ERRO com string vazia ainda e erro")
        void erroComStringVazia()
        {
            assertTrue(new Resultado("").temErro());
        }

        @Test @DisplayName("Resultado e imutavel quanto ao estado: alterar a lista ORIGINAL nao muda o Resultado")
        void copiaDefensivaNoConstrutor()
        {
            List<MediaDoAluno> original = duasMedias();
            Resultado r = new Resultado(original);
            original.clear();
            assertEquals(2, r.getMedias().size());
        }
    }

    // =====================================================================
    // B) CATEGORIAS DE METODOS
    // =====================================================================
    @Nested
    @DisplayName("B) Particionamento por CATEGORIAS DE METODOS")
    class PorCategoriasDeMetodos
    {
        @Test @DisplayName("Heranca: Resultado e um Comunicado e e Serializable")
        void heranca()
        {
            Resultado r = new Resultado("x");
            assertTrue(r instanceof Comunicado);
            assertTrue(r instanceof Serializable);
        }

        @Test @DisplayName("Serializacao (usada no socket): estado SUCESSO sobrevive ao ciclo write/read")
        void serializacaoSucesso() throws Exception
        {
            Resultado volta = ciclo(new Resultado(duasMedias()));
            assertFalse(volta.temErro());
            assertEquals(2, volta.getMedias().size());
            assertEquals(2, volta.getMedias().get(1).getIdEstudante());
            assertEquals(4.5, volta.getMedias().get(1).getMedia(), 0.001);
        }

        @Test @DisplayName("Serializacao: estado ERRO sobrevive ao ciclo write/read")
        void serializacaoErro() throws Exception
        {
            Resultado volta = ciclo(new Resultado("falhou"));
            assertTrue(volta.temErro());
            assertEquals("falhou", volta.getErro());
            assertTrue(volta.getMedias().isEmpty());
        }

        @Test @DisplayName("Seletora getMedias nunca retorna null")
        void getMediasNuncaNulo()
        {
            assertNotNull(new Resultado("e").getMedias());
            assertNotNull(new Resultado(new ArrayList<MediaDoAluno>()).getMedias());
        }
    }

    // =====================================================================
    // DEFEITOS CONHECIDOS
    // =====================================================================
    @Nested
    @Tag("defeito")
    @DisplayName("DEFEITOS CONHECIDOS (falham de proposito)")
    class DefeitosConhecidos
    {
        @Test @DisplayName("D6: Resultado((String) null) deveria ser ERRO (hoje temErro()==false => parece sucesso)")
        void erroNuloViraSucesso()
        {
            Resultado r = new Resultado((String) null);
            assertTrue(r.temErro());
        }

        @Test @DisplayName("D7: construtor com lista null deveria lancar excecao controlada (hoje: NullPointerException)")
        void listaNula()
        {
            assertThrows(IllegalArgumentException.class, () -> new Resultado((List<MediaDoAluno>) null));
        }

        @Test @DisplayName("D8: getMedias() deveria devolver lista nao modificavel (hoje expoe a lista interna)")
        void getMediasExpoeRepresentacaoInterna()
        {
            Resultado r = new Resultado(duasMedias());
            assertThrows(UnsupportedOperationException.class, () -> r.getMedias().clear());
        }
    }
}