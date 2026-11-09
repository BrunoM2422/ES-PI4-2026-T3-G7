package server.cliente_servidor.servidor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Calcula médias de alunos (aritmética ou ponderada).
 * Não depende de sockets: recebe dados e devolve médias.
 */
public class CalculadoraDeMedias
{
    public static final String ARITMETICA = "Aritmética";
    public static final String PONDERADA  = "Ponderada";

    private static final double SOMA_PESOS_ESPERADA = 10.0;
    private static final double TOLERANCIA          = 0.01;

    // ---------- tipos auxiliares ----------

    /** Componente de avaliação (prova, trabalho etc.). */
    public static class Componente
    {
        private final String id;     // pode ser null; nesse caso usa-se o índice
        private final double peso;

        public Componente(String id, double peso)
        {
            this.id   = id;
            this.peso = peso;
        }

        public String getId()   { return this.id; }
        public double getPeso() { return this.peso; }
    }

    /** Notas de um aluno. A chave do mapa é "comp_<id ou índice>". */
    public static class NotasDoAluno
    {
        private final int idEstudante;
        private final Map<String, Double> notas;

        public NotasDoAluno(int idEstudante, Map<String, Double> notas)
        {
            this.idEstudante = idEstudante;
            this.notas       = notas;
        }

        public int getIdEstudante()          { return this.idEstudante; }
        public Map<String, Double> getNotas() { return this.notas; }
    }

    /** Média calculada de um aluno. */
    public static class MediaDoAluno
    {
        private final int idEstudante;
        private final double media;

        public MediaDoAluno(int idEstudante, double media)
        {
            this.idEstudante = idEstudante;
            this.media       = media;
        }

        public int getIdEstudante() { return this.idEstudante; }
        public double getMedia()    { return this.media; }

        @Override
        public String toString()
        {
            return "{id_estudante: " + this.idEstudante + ", media: " + this.media + "}";
        }
    }

    // ---------- cálculo ----------

    /**
     * Calcula a média de todos os alunos.
     *
     * @throws IllegalArgumentException se não houver componentes, se o tipo for
     *         inválido ou se, na ponderada, os pesos não somarem 10.
     */
    public static List<MediaDoAluno> calcular(String tipo,
                                              List<Componente> componentes,
                                              List<NotasDoAluno> alunos)
    {
        if (componentes == null || componentes.isEmpty())
            throw new IllegalArgumentException("Adicione ao menos um componente.");

        if (!ARITMETICA.equals(tipo) && !PONDERADA.equals(tipo))
            throw new IllegalArgumentException("Tipo de média inválido: " + tipo);

        if (PONDERADA.equals(tipo))
            validarPesos(componentes);

        List<MediaDoAluno> resultado = new ArrayList<MediaDoAluno>();

        if (alunos == null)
            return resultado;

        for (NotasDoAluno aluno : alunos)
        {
            double media = ARITMETICA.equals(tipo)
                         ? mediaAritmetica(aluno)
                         : mediaPonderada(aluno, componentes);

            resultado.add(new MediaDoAluno(aluno.getIdEstudante(), arredondar(media)));
        }

        return resultado;
    }

    private static void validarPesos(List<Componente> componentes)
    {
        double total = 0;
        for (Componente c : componentes)
            total += c.getPeso();

        if (Math.abs(total - SOMA_PESOS_ESPERADA) > TOLERANCIA)
            throw new IllegalArgumentException(
                "A soma dos pesos deve ser exatamente 10. Atual: " + total);
    }

    // Soma as notas lançadas e divide pela quantidade de notas (igual ao JS original)
    private static double mediaAritmetica(NotasDoAluno aluno)
    {
        Map<String, Double> notas = aluno.getNotas();
        if (notas == null || notas.isEmpty())
            return 0;

        double soma = 0;
        for (Double nota : notas.values())
            soma += (nota == null ? 0 : nota);

        return soma / notas.size();
    }

    // Nota ausente conta como 0; divide por 10 (soma dos pesos)
    private static double mediaPonderada(NotasDoAluno aluno, List<Componente> componentes)
    {
        Map<String, Double> notas = aluno.getNotas();
        double somaPonderada = 0;

        for (int i = 0; i < componentes.size(); i++)
        {
            Componente comp = componentes.get(i);
            String chave = "comp_" + (comp.getId() != null ? comp.getId() : String.valueOf(i));

            Double nota = (notas == null) ? null : notas.get(chave);
            somaPonderada += (nota == null ? 0 : nota) * comp.getPeso();
        }

        return somaPonderada / SOMA_PESOS_ESPERADA;
    }

    private static double arredondar(double valor)
    {
        return Math.round(valor * 100) / 100.0;
    }
}