package server.test;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import server.cliente_servidor.servidor.CalculadoraDeMedias.Componente;
import server.cliente_servidor.servidor.CalculadoraDeMedias;
import server.cliente_servidor.servidor.CalculadoraDeMedias.MediaDoAluno;
import server.cliente_servidor.servidor.CalculadoraDeMedias.NotasDoAluno;

/**
 * TESTE INTRACLASSE de CalculadoraDeMedias (item e).
 *
 * Particionamentos aplicados:
 *   A) ATRIBUTOS  -> classes de equivalencia de tipo, componentes, pesos, alunos e notas
 *   B) CATEGORIAS DE METODOS -> construtoras, seletoras e modificadora/calculo
 *
 * Os testes do grupo "DefeitosConhecidos" (@Tag("defeito")) afirmam o comportamento
 * CORRETO esperado e, por isso, FALHAM de proposito: cada falha e um defeito documentado.
 * Para rodar sem eles: mvn test -Dgroups='!defeito'
 */
class CalculadoraDeMediasTest
{
    private static final double DELTA = 0.001;

    // ---------- auxiliares ----------

    private static List<Componente> doisComponentesPeso4e6()
    {
        return Arrays.asList(new Componente("1", 4), new Componente("2", 6));
    }

    private static Map<String, Double> notas(Object... paresChaveValor)
    {
        Map<String, Double> mapa = new HashMap<String, Double>();
        for (int i = 0; i < paresChaveValor.length; i += 2)
            mapa.put((String) paresChaveValor[i], (Double) paresChaveValor[i + 1]);
        return mapa;
    }

    private static List<NotasDoAluno> umAluno(int id, Map<String, Double> notas)
    {
        List<NotasDoAluno> lista = new ArrayList<NotasDoAluno>();
        lista.add(new NotasDoAluno(id, notas));
        return lista;
    }

    private static double mediaUnica(String tipo, List<Componente> comps, Map<String, Double> notas)
    {
        List<MediaDoAluno> r = CalculadoraDeMedias.calcular(tipo, comps, umAluno(1, notas));
        assertEquals(1, r.size());
        return r.get(0).getMedia();
    }

    // =====================================================================
    // PARTICIONAMENTO A: ATRIBUTOS
    // =====================================================================
    @Nested
    @DisplayName("A) Particionamento por ATRIBUTOS")
    class PorAtributos
    {
        // ----- atributo: tipo -----

        @Test @DisplayName("tipo=Aritmética valido -> media aritmetica")
        void tipoAritmetica()
        {
            double m = mediaUnica(CalculadoraDeMedias.ARITMETICA, doisComponentesPeso4e6(),
                                  notas("comp_1", 6.0, "comp_2", 8.0));
            assertEquals(7.0, m, DELTA);
        }

        @Test @DisplayName("tipo=Ponderada valido -> (8*4 + 5*6)/10 = 6.2")
        void tipoPonderada()
        {
            double m = mediaUnica(CalculadoraDeMedias.PONDERADA, doisComponentesPeso4e6(),
                                  notas("comp_1", 8.0, "comp_2", 5.0));
            assertEquals(6.2, m, DELTA);
        }

        @Test @DisplayName("tipo=null -> IllegalArgumentException")
        void tipoNulo()
        {
            assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular(null, doisComponentesPeso4e6(), new ArrayList<NotasDoAluno>()));
        }

        @Test @DisplayName("tipo desconhecido -> IllegalArgumentException com o tipo na mensagem")
        void tipoDesconhecido()
        {
            IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular("Geometrica", doisComponentesPeso4e6(), new ArrayList<NotasDoAluno>()));
            assertTrue(e.getMessage().contains("Geometrica"));
        }

        @Test @DisplayName("tipo e sensivel a maiusculas/acentos ('aritmética' e invalido)")
        void tipoCaseSensitive()
        {
            assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular("aritmética", doisComponentesPeso4e6(), new ArrayList<NotasDoAluno>()));
        }

        // ----- atributo: componentes -----

        @Test @DisplayName("componentes=null -> IllegalArgumentException")
        void componentesNulo()
        {
            IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular(CalculadoraDeMedias.ARITMETICA, null, new ArrayList<NotasDoAluno>()));
            assertTrue(e.getMessage().contains("ao menos um componente"));
        }

        @Test @DisplayName("componentes vazio -> IllegalArgumentException")
        void componentesVazio()
        {
            assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular(CalculadoraDeMedias.ARITMETICA,
                                             new ArrayList<Componente>(), new ArrayList<NotasDoAluno>()));
        }

        @Test @DisplayName("componente com id=null usa o indice (comp_0, comp_1)")
        void componenteSemIdUsaIndice()
        {
            List<Componente> comps = Arrays.asList(new Componente(null, 4), new Componente(null, 6));
            double m = mediaUnica(CalculadoraDeMedias.PONDERADA, comps, notas("comp_0", 10.0, "comp_1", 0.0));
            assertEquals(4.0, m, DELTA);
        }

        // ----- atributo: pesos (so na Ponderada) -----

        @Test @DisplayName("Ponderada com soma dos pesos < 10 -> IllegalArgumentException")
        void pesosSomamMenosQue10()
        {
            List<Componente> comps = Arrays.asList(new Componente("1", 4), new Componente("2", 5));
            IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular(CalculadoraDeMedias.PONDERADA, comps, new ArrayList<NotasDoAluno>()));
            assertTrue(e.getMessage().contains("soma dos pesos"));
        }

        @Test @DisplayName("Ponderada com soma dos pesos > 10 -> IllegalArgumentException")
        void pesosSomamMaisQue10()
        {
            List<Componente> comps = Arrays.asList(new Componente("1", 6), new Componente("2", 5));
            assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular(CalculadoraDeMedias.PONDERADA, comps, new ArrayList<NotasDoAluno>()));
        }

        @Test @DisplayName("Fronteira: soma 10.005 (dentro da tolerancia 0.01) e aceita; 10.02 e rejeitada")
        void pesosFronteiraDaTolerancia()
        {
            List<Componente> dentro = Arrays.asList(new Componente("1", 5.005), new Componente("2", 5));
            assertDoesNotThrow(() ->
                CalculadoraDeMedias.calcular(CalculadoraDeMedias.PONDERADA, dentro, new ArrayList<NotasDoAluno>()));

            List<Componente> fora = Arrays.asList(new Componente("1", 5.02), new Componente("2", 5));
            assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular(CalculadoraDeMedias.PONDERADA, fora, new ArrayList<NotasDoAluno>()));
        }

        @Test @DisplayName("Aritmética NAO valida pesos (soma 3 e aceita)")
        void aritmeticaIgnoraPesos()
        {
            List<Componente> comps = Arrays.asList(new Componente("1", 1), new Componente("2", 2));
            assertEquals(7.0, mediaUnica(CalculadoraDeMedias.ARITMETICA, comps,
                                         notas("comp_1", 6.0, "comp_2", 8.0)), DELTA);
        }

        // ----- atributo: alunos -----

        @Test @DisplayName("alunos=null -> lista vazia (sem excecao)")
        void alunosNulo()
        {
            List<MediaDoAluno> r = CalculadoraDeMedias.calcular(CalculadoraDeMedias.ARITMETICA,
                                                                doisComponentesPeso4e6(), null);
            assertNotNull(r);
            assertTrue(r.isEmpty());
        }

        @Test @DisplayName("alunos vazio -> lista vazia")
        void alunosVazio()
        {
            assertTrue(CalculadoraDeMedias.calcular(CalculadoraDeMedias.PONDERADA,
                       doisComponentesPeso4e6(), new ArrayList<NotasDoAluno>()).isEmpty());
        }

        @Test @DisplayName("varios alunos -> uma media por aluno, mesma ordem e ids preservados")
        void variosAlunosPreservaOrdemEIds()
        {
            List<NotasDoAluno> alunos = new ArrayList<NotasDoAluno>();
            alunos.add(new NotasDoAluno(30, notas("comp_1", 10.0, "comp_2", 10.0)));
            alunos.add(new NotasDoAluno(10, notas("comp_1", 0.0,  "comp_2", 0.0)));
            alunos.add(new NotasDoAluno(20, notas("comp_1", 5.0,  "comp_2", 5.0)));

            List<MediaDoAluno> r = CalculadoraDeMedias.calcular(CalculadoraDeMedias.PONDERADA,
                                                                doisComponentesPeso4e6(), alunos);
            assertEquals(3, r.size());
            assertEquals(30, r.get(0).getIdEstudante());
            assertEquals(10.0, r.get(0).getMedia(), DELTA);
            assertEquals(10, r.get(1).getIdEstudante());
            assertEquals(0.0, r.get(1).getMedia(), DELTA);
            assertEquals(20, r.get(2).getIdEstudante());
            assertEquals(5.0, r.get(2).getMedia(), DELTA);
        }

        // ----- atributo: notas -----

        @Test @DisplayName("Ponderada: nota ausente conta como 0 -> 8*4/10 = 3.2")
        void ponderadaNotaAusenteVale0()
        {
            assertEquals(3.2, mediaUnica(CalculadoraDeMedias.PONDERADA, doisComponentesPeso4e6(),
                                         notas("comp_1", 8.0)), DELTA);
        }

        @Test @DisplayName("Aritmética: nota ausente e IGNORADA (divide so pelas notas lancadas) -> 8.0")
        void aritmeticaNotaAusenteIgnorada()
        {
            // caracterizacao do comportamento atual (ver anomalia A3 no relatorio)
            assertEquals(8.0, mediaUnica(CalculadoraDeMedias.ARITMETICA, doisComponentesPeso4e6(),
                                         notas("comp_1", 8.0)), DELTA);
        }

        @Test @DisplayName("Aritmética: valor null dentro do mapa conta como 0 -> (0+8)/2 = 4.0")
        void aritmeticaNotaNulaNoMapa()
        {
            assertEquals(4.0, mediaUnica(CalculadoraDeMedias.ARITMETICA, doisComponentesPeso4e6(),
                                         notas("comp_1", null, "comp_2", 8.0)), DELTA);
        }

        @Test @DisplayName("mapa de notas null ou vazio -> media 0.0 nos dois tipos")
        void notasNulasOuVazias()
        {
            assertEquals(0.0, mediaUnica(CalculadoraDeMedias.ARITMETICA, doisComponentesPeso4e6(), null), DELTA);
            assertEquals(0.0, mediaUnica(CalculadoraDeMedias.ARITMETICA, doisComponentesPeso4e6(),
                                         new HashMap<String, Double>()), DELTA);
            assertEquals(0.0, mediaUnica(CalculadoraDeMedias.PONDERADA, doisComponentesPeso4e6(), null), DELTA);
        }

        @Test @DisplayName("arredondamento para 2 casas: (7+8+8)/3 = 7.67")
        void arredondamentoDuasCasas()
        {
            List<Componente> tres = Arrays.asList(new Componente("1", 1), new Componente("2", 1), new Componente("3", 1));
            assertEquals(7.67, mediaUnica(CalculadoraDeMedias.ARITMETICA, tres,
                                          notas("comp_1", 7.0, "comp_2", 8.0, "comp_3", 8.0)), 0.0001);
        }

        @Test @DisplayName("limites validos: todas as notas 0 -> 0.0; todas 10 -> 10.0")
        void limitesDeNota()
        {
            assertEquals(0.0,  mediaUnica(CalculadoraDeMedias.PONDERADA, doisComponentesPeso4e6(),
                                          notas("comp_1", 0.0,  "comp_2", 0.0)),  DELTA);
            assertEquals(10.0, mediaUnica(CalculadoraDeMedias.PONDERADA, doisComponentesPeso4e6(),
                                          notas("comp_1", 10.0, "comp_2", 10.0)), DELTA);
        }
    }

    // =====================================================================
    // PARTICIONAMENTO B: CATEGORIAS DE METODOS
    // =====================================================================
    @Nested
    @DisplayName("B) Particionamento por CATEGORIAS DE METODOS")
    class PorCategoriasDeMetodos
    {
        // ----- construtoras + seletoras -----

        @Test @DisplayName("Construtora/seletora: Componente")
        void componente()
        {
            Componente c = new Componente("P1", 3.5);
            assertEquals("P1", c.getId());
            assertEquals(3.5, c.getPeso(), DELTA);
            assertNull(new Componente(null, 1).getId());
        }

        @Test @DisplayName("Construtora/seletora: NotasDoAluno")
        void notasDoAluno()
        {
            Map<String, Double> mapa = notas("comp_1", 9.0);
            NotasDoAluno n = new NotasDoAluno(7, mapa);
            assertEquals(7, n.getIdEstudante());
            assertSame(mapa, n.getNotas());
        }

        @Test @DisplayName("Construtora/seletora/toString: MediaDoAluno")
        void mediaDoAluno()
        {
            MediaDoAluno m = new MediaDoAluno(3, 7.5);
            assertEquals(3, m.getIdEstudante());
            assertEquals(7.5, m.getMedia(), DELTA);
            assertEquals("{id_estudante: 3, media: 7.5}", m.toString());
        }

        // ----- modificadora / calculo -----

        @Test @DisplayName("calcular NAO altera os dados de entrada")
        void calcularNaoAlteraEntradas()
        {
            List<Componente> comps = new ArrayList<Componente>(doisComponentesPeso4e6());
            Map<String, Double> mapa = notas("comp_1", 8.0, "comp_2", 5.0);
            List<NotasDoAluno> alunos = umAluno(1, mapa);

            CalculadoraDeMedias.calcular(CalculadoraDeMedias.PONDERADA, comps, alunos);

            assertEquals(2, comps.size());
            assertEquals(1, alunos.size());
            assertEquals(2, mapa.size());
            assertEquals(8.0, mapa.get("comp_1"), DELTA);
        }

        @Test @DisplayName("calcular e deterministico/idempotente (2 chamadas = mesmo resultado)")
        void calcularIdempotente()
        {
            List<NotasDoAluno> alunos = umAluno(1, notas("comp_1", 8.0, "comp_2", 5.0));
            double a = CalculadoraDeMedias.calcular(CalculadoraDeMedias.PONDERADA,
                                                    doisComponentesPeso4e6(), alunos).get(0).getMedia();
            double b = CalculadoraDeMedias.calcular(CalculadoraDeMedias.PONDERADA,
                                                    doisComponentesPeso4e6(), alunos).get(0).getMedia();
            assertEquals(a, b, 0.0);
        }

        @Test @DisplayName("Ordem das validacoes: componentes vazio e checado ANTES do tipo")
        void ordemDasValidacoes()
        {
            IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular("tipo-invalido", new ArrayList<Componente>(), null));
            assertTrue(e.getMessage().contains("componente"));
        }
    }

    // =====================================================================
    // DEFEITOS CONHECIDOS: afirmam o comportamento CORRETO e hoje FALHAM
    // =====================================================================
    @Nested
    @Tag("defeito")
    @DisplayName("DEFEITOS CONHECIDOS (falham de proposito)")
    class DefeitosConhecidos
    {
        @Test @DisplayName("D1: nota acima de 10 deveria ser rejeitada")
        void notaAcimaDe10()
        {
            assertThrows(IllegalArgumentException.class, () ->
                mediaUnica(CalculadoraDeMedias.ARITMETICA, doisComponentesPeso4e6(),
                           notas("comp_1", 15.0, "comp_2", 8.0)));
        }

        @Test @DisplayName("D2: nota negativa deveria ser rejeitada")
        void notaNegativa()
        {
            assertThrows(IllegalArgumentException.class, () ->
                mediaUnica(CalculadoraDeMedias.PONDERADA, doisComponentesPeso4e6(),
                           notas("comp_1", -3.0, "comp_2", 8.0)));
        }

        @Test @DisplayName("D3: peso negativo (15 + -5 = 10) deveria ser rejeitado")
        void pesoNegativo()
        {
            List<Componente> comps = Arrays.asList(new Componente("1", 15), new Componente("2", -5));
            assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular(CalculadoraDeMedias.PONDERADA, comps, new ArrayList<NotasDoAluno>()));
        }

        @Test @DisplayName("D4: aluno null na lista deveria gerar IllegalArgumentException (hoje: NullPointerException)")
        void alunoNuloNaLista()
        {
            List<NotasDoAluno> alunos = Arrays.asList((NotasDoAluno) null);
            assertThrows(IllegalArgumentException.class, () ->
                CalculadoraDeMedias.calcular(CalculadoraDeMedias.ARITMETICA, doisComponentesPeso4e6(), alunos));
        }

        @Test @DisplayName("D5: nota NaN deveria ser rejeitada (hoje vira media 0.0 em silencio)")
        void notaNaN()
        {
            assertThrows(IllegalArgumentException.class, () ->
                mediaUnica(CalculadoraDeMedias.ARITMETICA, doisComponentesPeso4e6(),
                           notas("comp_1", Double.NaN, "comp_2", 8.0)));
        }
    }
}