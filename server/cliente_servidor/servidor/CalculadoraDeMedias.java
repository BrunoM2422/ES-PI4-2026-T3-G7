// Autores: Matheus Antony Lucas Lima RA:25013260
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
    private static final double NOTA_MINIMA         = 0.0;
    private static final double NOTA_MAXIMA         = 10.0;

    // ---------- tipos auxiliares ----------

    /** Componente de avaliação (prova, trabalho etc.). */
    public static class Componente implements java.io.Serializable
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
    public static class NotasDoAluno implements java.io.Serializable
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
    public static class MediaDoAluno implements java.io.Serializable
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
     *         inválido, se algum componente for nulo ou tiver peso inválido
     *         (negativo, NaN ou infinito), se algum aluno for nulo, se alguma
     *         nota for inválida (NaN, negativa ou acima de 10) ou, na
     *         ponderada, se os pesos não somarem 10.
     */
    public static List<MediaDoAluno> calcular(String tipo,
                                              List<Componente> componentes,
                                              List<NotasDoAluno> alunos)
    {
        if (componentes == null || componentes.isEmpty())
            throw new IllegalArgumentException("Adicione ao menos um componente.");

        if (!ARITMETICA.equals(tipo) && !PONDERADA.equals(tipo))
            throw new IllegalArgumentException("Tipo de média inválido: " + tipo);

        validarComponentes(componentes);

        if (PONDERADA.equals(tipo))
            validarPesos(componentes);

        List<MediaDoAluno> resultado = new ArrayList<MediaDoAluno>();

        if (alunos == null)
            return resultado;

        for (NotasDoAluno aluno : alunos)
        {
            validarAluno(aluno);

            double media = ARITMETICA.equals(tipo)
                         ? mediaAritmetica(aluno)
                         : mediaPonderada(aluno, componentes);

            resultado.add(new MediaDoAluno(aluno.getIdEstudante(), arredondar(media)));
        }

        return resultado;
    }

    // ---------- validações ----------

    private static void validarComponentes(List<Componente> componentes)
    {
        for (Componente c : componentes)
        {
            if (c == null)
                throw new IllegalArgumentException("Componente não pode ser nulo.");

            double peso = c.getPeso();
            if (Double.isNaN(peso) || Double.isInfinite(peso) || peso < 0)
                throw new IllegalArgumentException("Peso inválido: " + peso);
        }
    }

    private static void validarAluno(NotasDoAluno aluno)
    {
        if (aluno == null)
            throw new IllegalArgumentException("Aluno não pode ser nulo.");

        if (aluno.getNotas() == null)
            return; // sem notas: tratado como 0 nas médias

        for (Double nota : aluno.getNotas().values())
        {
            if (nota == null)
                continue; // nota ausente continua contando como 0

            if (Double.isNaN(nota) || nota < NOTA_MINIMA || nota > NOTA_MAXIMA)
                throw new IllegalArgumentException(
                    "Nota inválida para o aluno " + aluno.getIdEstudante()
                    + ": " + nota + " (use valores de 0 a 10).");
        }
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

    // ---------- médias ----------

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