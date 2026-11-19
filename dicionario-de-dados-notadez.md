# Dicionário de Dados: Sistema Acadêmico NotaDez

## 1. Histórico de versões (ou revisões)

| Data | Autor | Versão | Comentários |
| :---: | :--- | :---: | :--- |
| 18/11/2026 | Gabriel Scolfaro | 1.0.0-alfa2 | Versão inicial completa do dicionário. |
| 18/11/2026 | Gabriel Scolfaro | 1.0.0-alfa1 | Versão inicial do dicionário. |

## 2. Entidades e atributos conceituais

### 2.1. Usuário

Pessoa com credenciais de acesso e um ou mais papéis no sistema. Os perfis de estudante e docente também possuem documentos próprios, ligados pelo e-mail e/ou pelos identificadores institucionais.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Identificador | ObjectId | Sim | Simples | Identificador MongoDB | Identificador malformado | Identidade do usuário. |
| E-mail | Texto | Sim | Simples | `aluno@exemplo.edu.br` | Vazio ou malformado | Único, normalizado em minúsculas. Usado no acesso. |
| Senha | Texto protegido | Sim | Simples | Hash bcrypt | Senha em texto puro | O documento armazena hash e senha original(somente pro admin); entrada deve ter ao menos 6 caracteres. |
| Nome | Texto | Sim | Simples | `Ana Souza` | Vazio | Nome exibido no sistema. |
| Papéis | Lista de texto | Sim | M | `estudante`, `docente`, `admin` | Papel fora da lista | Um usuário pode acumular papéis. |
| Nível de permissão | Texto enumerado | Não | Simples | `admin_mestre`, `admin_2`, `admin_3` | Valor fora da lista | Aplicável ao controle de permissões administrativas; padrão `admin_mestre`. |
| Telefone | Texto | Não | Simples | DDD e número | Texto sem número útil | Contato; mantido como texto para preservar formatação. |
| Preferência financeira | Booleano | Não | Simples | `true`, `false` | `sim` | `showFinanceiro`; indica exibição da área financeira. Padrão `true`. |
| RA / RP | Texto | Não | Simples | `E2026001`, `P20261` | Identificador incompatível com o perfil | RA identifica estudante e RP docente; não existe para administradores. |
| Dados temporários de recuperação | Hash, data e número | Não | C | Hash de código e data de expiração | Código de recuperação em texto puro | Campos de recuperação de senha são internos|

### 2.2. Estudante

Perfil acadêmico do aluno. Além dos dados pessoais, associa curso, turmas e disciplinas em que está matriculado.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Identificador | ObjectId | Sim | Simples | Identificador MongoDB | Identificador malformado | Identificador do perfil. |
| RA, nome, e-mail | Texto | RA/e-mail únicos; nome/e-mail obrigatórios | Simples | `E2026001`; nome; e-mail válido | RA ou e-mail duplicado | RA é o registro acadêmico; e-mail normalizado. |
| CPF, telefone, endereço | Texto | Não | Simples | CPF com 11 dígitos; telefone; endereço | CPF inválido quando submetido à validação | Dados pessoais de contato; a validação ocorre na aplicação. |
| Foto | Texto | Não | Simples | Data URL de imagem ou vazio | Base64 inválido | Pode conter imagem codificada; padrão vazio. |
| Situação acadêmica | Texto enumerado | Não | Simples | `ativo`, `trancado` | Valor fora da lista | Padrão `ativo`. |
| Trancamento | Período, justificativa | Não | C | Data inicial, retorno, justificativa | Datas sem sentido no fluxo | Presente quando aplicável; campos internos são opcionais. |
| Turma e curso | Identificadores e resumo | Não | C | ObjectId e dados resumidos do curso | Referência sem correspondência | `turmaId`/`cursoId` referenciam documentos; `curso` e `instituicao` são resumos embutidos. |
| Matrículas na grade | Lista de vínculos | Não | MC | Pares turma-disciplina | Vínculo sem identificadores | Cada item de `gradeMatriculas` associa uma turma e uma disciplina. |
| Bloqueio da grade | Data | Não | Simples | Data de bloqueio ou `null` | Texto arbitrário | `gradeLockAt` registra o bloqueio/fechamento da grade quando usado. |

### 2.3. Docente

Perfil do professor, usado para identificar o responsável por turmas, aulas, frequências, notas e comunicados.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Identificador | ObjectId | Sim | Simples | Identificador MongoDB | Identificador malformado | Identificador do perfil. |
| RP | Texto | Não | Simples | `P20261` | RP duplicado | Registro profissional/institucional; único quando informado. |
| Nome e e-mail | Texto | Sim | Simples | Nome completo e e-mail válido | Campos vazios | E-mail único e normalizado em minúsculas. |
| CPF, telefone, endereço | Texto | Não | Simples | CPF, telefone ou endereço | Valor incompatível com formato validado | Dados de contato e identificação. |
| Especialidade e descrição | Texto | Não | Simples | `Engenharia de Software` | — | Área de atuação e apresentação profissional. |
| Foto | Texto | Não | Simples | Data URL de imagem ou vazio | Conteúdo de imagem inválido | Padrão vazio. |
| Instituição | Nome e código | Não | C | Nome e código institucional | — | Dados da instituição embutidos no perfil. |

### 2.4. Curso

Curso superior ou programa acadêmico oferecido pela instituição.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Identificador | ObjectId | Sim | Simples | Identificador MongoDB | — | Identificador do curso. |
| Código | Texto | Sim | Simples | Dois dígitos, como `01` | Mais ou menos de dois dígitos | Único. |
| Nome e unidade | Texto | Sim | Simples | Nome do curso; `Campus 1` | Vazio | Unidade/campus de oferta. |
| Grau | Texto enumerado | Sim | Simples | Bacharelado, Licenciatura, Tecnólogo, Pós-Graduação, Mestrado, Pós Doutorado | Outro valor | Conforme enumeração do schema. |
| Modalidade | Texto enumerado | Sim | Simples | Presencial, Semipresencial, Ensino a Distância (EAD) | Outro valor | Conforme enumeração do schema. |
| Duração | Número inteiro | Sim | Simples | 1 a 20 | Menor que 1 ou maior que 20 | Duração em semestres. |
| Descrição | Texto | Não | Simples | Texto livre ou vazio | — | Padrão vazio. |

### 2.5. Disciplina

Componente curricular pertencente a um curso, possivelmente equivalente a disciplinas de outros cursos.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Identificador | ObjectId | Sim | Simples | Identificador MongoDB | — | Identificador da disciplina. |
| Nome, código e descrição | Texto | Sim | Simples | Código com 4 ou 6 dígitos | Código fora do padrão | Código convertido para maiúsculas; único dentro do curso. |
| Curso | ObjectId | Sim | Simples | Referência a `cursos` | Curso inexistente | Campo `cursoId`. |
| Equivalências | Lista de códigos de curso | Não | M | Códigos de dois dígitos | Código fora do padrão | `equivale_para`; lista vazia por padrão. |
| Semestre | Número inteiro | Sim | Simples | 1 a 20 | Fora do intervalo | Semestre curricular recomendado. |
| Datas de criação e alteração | Data/hora | Geradas | Simples | Data/hora ISO | Texto arbitrário | `createdAt` e `updatedAt` |

### 2.6. Turma

Oferta de curso em determinado período letivo, com estudantes e horários associados.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Identificador e código | ObjectId e texto | Sim | Simples | Código único de turma | Código duplicado | Código armazenado em maiúsculas. |
| Curso | ObjectId | Sim | Simples | Referência a `cursos` | Curso inexistente | `cursoId`. |
| Período letivo | Texto | Sim | Simples | `2026/1` | Vazio ou acima de 30 caracteres | Período/ano letivo. |
| Vagas | Número inteiro | Sim | Simples | 1 a 300 | Fora do intervalo | Capacidade da turma. |
| Estudantes | Lista de ObjectId | Não | M | Lista vazia ou referências | Identificadores malformados | `alunosIds`; lista vazia por padrão. |
| Semestre de organização | Número inteiro | Não | Simples | 1 a 20 ou `null` | Fora do intervalo | Semestre usado na organização curricular. |
| Horários | Lista de horários | Não | MC | Dia e hora com referências | Aula sem disciplina/docente | Subdocumentos resumem os horários associados à turma. |
| Datas de criação e alteração | Data/hora | Geradas | Simples | Data/hora ISO | — | Timestamps |

### 2.7. Grade de horário

Grade de aulas de um curso em determinado semestre, contendo subdocumentos de aula.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Identificador | ObjectId | Sim | Simples | Identificador MongoDB | — | Identificador da grade. |
| Curso e semestre | ObjectId e número | Sim | Simples | Curso existente; semestre 1 a 20 | Semestre fora do intervalo | Há uma grade por curso e semestre, conforme índice único. |
| Aulas | Lista de aulas | Não | MC | Lista vazia ou aulas válidas | Dia/hora fora do domínio | Cada aula inclui disciplina, docente, turma opcional, dia da semana e hora. |
| Datas de criação e alteração | Data/hora | Geradas | Simples | Data/hora ISO | — | Timestamps |

### 2.8. Frequência

Registro de presença de uma turma em uma aula e data.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Turma, aula, disciplina e docente | Referências | Sim | Simples | ObjectIds existentes | Referências malformadas | Identificam a aula cuja presença foi registrada. |
| Data | Data textual | Sim | Simples | `AAAA-MM-DD` | Outra forma ou data inválida | Mantida como string no formato ISO de data. |
| Registros | Lista de presenças | Não | MC | alunoId e `presente: true/false` | Presença diferente de booleano | Cada item identifica um estudante; não possui `_id` próprio. |
| Datas de criação e alteração | Data/hora | Geradas | Simples | Data/hora ISO | — | Timestamps |

### 2.9. Componente de nota

Avaliação individual criada para uma turma e disciplina, como prova ou trabalho.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Turma, disciplina e docente | Referências | Sim | Simples | ObjectIds existentes | Referências malformadas | Identificam o contexto da avaliação. |
| Título | Texto | Sim | Simples | `Prova 1` | Vazio ou mais de 80 caracteres | Espaços externos removidos. |
| Valor máximo | Número | Sim | Simples | Maior que 0,01 e até 100 | Fora do intervalo | Limite para notas deste componente. |
| Tipo de média | Texto enumerado | Sim | Simples | `aritmetica`, `ponderada` | Outro valor | Padrão `aritmetica`. |
| Peso | Número | Não | Simples | 0,01 a 100 | Fora do intervalo | Padrão 1; usado na média ponderada. |
| Data de aplicação | Data ou nulo | Não | Simples | Data válida ou `null` | Texto arbitrário | Pode ser definida posteriormente. |
| Datas de criação e alteração | Data/hora | Geradas | Simples | Data/hora ISO | — | Timestamps |

### 2.10. Configuração de nota

Define o método de cálculo da média para uma disciplina em uma turma.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Turma, disciplina e docente | Referências | Sim | Simples | ObjectIds existentes | Referências malformadas | Contexto da configuração. |
| Tipo de média | Texto enumerado | Sim | Simples | `aritmetica`, `ponderada` | Outro valor | Define como as notas são agregadas. |
| Datas de criação e alteração | Data/hora | Geradas | Simples | Data/hora ISO | — | Timestamps |

### 2.11. Nota

Nota atribuída a um estudante em um componente de avaliação.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Estudante, turma, disciplina e componente | Referências | Sim | Simples | ObjectIds existentes | Referências malformadas | A combinação estudante/componente é única. |
| Valor | Número ou nulo | Não | Simples | 0 a 100 ou `null` | Menor que zero ou maior que 100 | `null` representa nota ainda não lançada; o valor máximo específico também é validado pela aplicação. |
| Datas de criação e alteração | Data/hora | Geradas | Simples | Data/hora ISO | — | Timestamps |

### 2.12. Chamado

Solicitação de atendimento enviada por estudante e acompanhada por uma conversa entre estudante ou administração.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| RA, nome, e-mail | Texto | Sim | Simples | Dados do solicitante | E-mail vazio ou malformado | Dados do solicitante registrados no chamado. |
| Curso, turma | Texto | Não | Simples | Nome/código ou ausência | — | Contexto acadêmico opcional. |
| Assunto e descrição | Texto | Sim | Simples | Solicitação descrita | Campo vazio | Conteúdo inicial do chamado. |
| Status | Texto enumerado | Não | Simples | `ativo`, `finalizado` | Outro valor | Padrão `ativo`. |
| Mensagens | Lista de mensagens | Não | MC | Remetente, conteúdo e data | Tipo de remetente fora da lista | Remetente: `estudante`, `admin` ou `docente`; data padrão atual. |
| Datas de ciclo de vida | Data/hora | Não | Simples | Criação, atualização, encerramento | Texto arbitrário | `criado_em`, `atualizado_em`, `encerrado_em`; encerramento pode ser nulo. |

### 2.13. Notificação

Mensagem exibida a um estudante, gerada pelo sistema ou enviada por um docente.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Estudante | ObjectId | Sim | Simples | Referência a `estudantes` | Referência inválida | Destinatário da notificação. |
| Turma e docente | ObjectId | Não | Simples | Referências existentes ou `null` | Identificadores malformados | Contexto opcional da comunicação. |
| Curso | Texto | Não | Simples | Nome do curso ou vazio | Mais de 90 caracteres | Resumo opcional. |
| Tipo e chave | Texto | Não | Simples | `comunicado`, `sistema`; chave textual | Tipo não previsto | Tipo padrão `comunicado`; chave permite evitar duplicidade por estudante quando informada. |
| Título e mensagem | Texto | Sim | Simples | Título até 90; mensagem até 2000 caracteres | Vazio ou acima dos limites | Conteúdo apresentado ao estudante. |
| Datas de criação e alteração | Data/hora | Geradas | Simples | Data/hora ISO | — | Timestamps |

### 2.14. Evento

Evento exibido no calendário, podendo ser global, associado a uma turma ou privado.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Título e data | Texto | Sim | Simples | Título até 90; `AAAA-MM-DD` | Data fora do padrão | A data é armazenada como texto. |
| Categoria | Texto enumerado | Sim | Simples | `feriado`, `institucional`, `aula`, `atividade`, `avaliacao`, `compromisso` | Valor fora da lista | Classificação do evento. |
| Escopo | Texto enumerado | Sim | Simples | `global`, `turma`, `privado` | Outro valor | Padrão `privado`. |
| Criador e turma | ObjectId | Não | Simples | Referências a usuário/turma ou nulo | ObjectId malformado | `createdBy` e `turmaId`; turma pode ser nula. |
| Horário, local e descrição | Texto | Não | Simples | Horário, local até 100, descrição até 400 | Texto além do limite | `start` e `end` têm padrão vazio. |
| Chave legada | Texto | Não | Simples | Chave única ou ausente | Chave duplicada | `legacyKey` é opcional, única quando presente e ocultada nas consultas padrão. |
| Datas de criação e alteração | Data/hora | Geradas | Simples | Data/hora ISO | — | Timestamps |

### 2.15. Log de auditoria

Registro de uma ação executada pelo admin ou docente.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Usuário e nome de usuário | ObjectId e texto | Sim | Simples | Identificador e nome/e-mail | Ausência | `usuarioId` permite relacionar o autor; `usuario` preserva identificação textual. |
| Tipo e ação | Texto | Sim | Simples | Categoria e ação executada | Ausência | Classificação e operação registrada. |
| Descrição | Texto | Não | Simples | Detalhes da ação | — | Contexto adicional. |
| Data/hora | Data/hora | Não | Simples | Data/hora atual | — | Padrão atual. |

### 2.16. Opções do sistema

Documento de configuração das funcionalidades acadêmicas habilitadas e dos cursos liberados para cada funcionalidade.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Identificador | Texto | Sim | Simples | `opcoes-academicas` | — | Identificador fixo do documento de configuração. |
| Indicadores | Booleano | Não | Simples | `true`, `false` | Texto | `matricula`, `avaliacao`, `grade`, `gradeCurricular`; padrão `false`. |
| Cursos liberados | Listas de ObjectId | Não | M | Cursos existentes | Identificadores inválidos | Listas para grade, equivalências e avaliação de professores; algumas têm padrão vazio. |
| Datas de criação e alteração | Data/hora | Geradas | Simples | Data/hora ISO | — | Timestamps |

### 2.17. Contador

Armazena um contador sequencial usado ajudar com a geração dos RAs de estudantes.

| Atributo / dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| Chave do contador | Texto | Sim | Simples | `ra-estudante-2026` | Vazia | É o próprio `_id` do documento. |
| Valor | Número inteiro | Sim | Simples | Inteiro igual ou maior que zero | Negativo | Incrementado para emitir o próximo identificador. |

## 3. Tipos especiais, compostos ou específicos

| Código | Significado |
| :---: | :--- |
| C | Composto: estrutura com partes relacionadas. |
| M | Multivalorado: lista de valores simples. |
| MC | Multivalorado e composto: lista de estruturas. |

### 3.1. Instituição (C)

Estrutura embutida em perfis de estudante e docente.

| Atributo / dado | Tipo conceitual | Obrigatório | Comentários |
| :--- | :--- | :---: | :--- |
| nome | Texto | Não | Nome da instituição de ensino. |
| codigo | Texto | Não | Código institucional. |

### 3.2. Resumo de curso (C)

Estrutura copiada no perfil do estudante para exibição do curso sem depender de consulta imediata à coleção de cursos.

| Atributo / dado | Tipo conceitual | Obrigatório | Comentários |
| :--- | :--- | :---: | :--- |
| codigo, nome, unidade | Texto | Não | Dados de identificação do curso. |
| grau, modalidade | Texto | Não | Características acadêmicas do curso. |
| duracao | Número | Não | Duração em semestres. |
| descricao | Texto | Não | Descrição resumida. |

### 3.3. Matrícula em grade (C/MC)

Cada item de `gradeMatriculas` liga o estudante a uma turma e a uma disciplina.

| Atributo / dado | Tipo conceitual | Obrigatório | Comentários |
| :--- | :--- | :---: | :--- |
| turmaId | ObjectId | Sim | Referência à turma em que ocorre a matrícula. |
| disciplinaId | ObjectId | Sim | Referência à disciplina matriculada. |

### 3.4. Horário de turma e aula de grade (C/MC)

As duas estruturas representam a alocação de uma disciplina em dia e hora. A grade é a fonte de aulas do curso; a turma mantém a programação que será usada em consultas operacionais.

| Atributo / dado | Tipo conceitual | Obrigatório | Comentários |
| :--- | :--- | :---: | :--- |
| gradeHorarioId | ObjectId | Em horário de turma | Referência à grade de origem. |
| aulaId | ObjectId | Sim | Identificador da aula dentro da grade. |
| disciplinaId, docenteId | ObjectId | Sim | Disciplina ministrada e responsável. |
| turmaId | ObjectId | Em aula de grade, pode ser nulo | Turma associada à aula. |
| dia | Número inteiro | Sim | Dia da semana de 0 a 6. |
| hora | Número inteiro | Sim | Hora entre 7 e 22. |
| semestre | Número inteiro | Em horário de turma | Semestre de organização, de 1 a 20. |

### 3.5. Registro de frequência (C/MC)

| Atributo / dado | Tipo conceitual | Obrigatório | Comentários |
| :--- | :--- | :---: | :--- |
| alunoId | ObjectId | Sim | Estudante avaliado. |
| presente | Booleano | Sim | Indica presença (`true`) ou ausência (`false`). |

### 3.6. Mensagem de chamado (C/MC)

| Atributo / dado | Tipo conceitual | Obrigatório | Comentários |
| :--- | :--- | :---: | :--- |
| remetente_tipo | Texto enumerado | Sim | `estudante`, `admin` ou `docente`. |
| remetente_nome | Texto | Sim | Nome exibido do remetente. |
| mensagem | Texto | Sim | Conteúdo enviado. |
| data_envio | Data/hora | Não | Data do envio; padrão atual. |

### 3.7. Dados de recuperação de senha (C)

Campos temporários do usuário, preenchidos durante a recuperação e limpos/expirados pelo fluxo de autenticação.

| Atributo / dado | Tipo conceitual | Obrigatório | Comentários |
| :--- | :--- | :---: | :--- |
| passwordResetCodeHash | Texto protegido | Não | Hash do código de recuperação; nunca armazenar o código em texto puro. |
| passwordResetExpiresAt | Data/hora | Não | Limite de validade do código. |
| passwordResetAttempts | Número inteiro | Não | Contador de tentativas; padrão zero. |
| passwordResetRequestedAt | Data/hora | Não | Momento da solicitação. |

## 4. Desdobramento físico ou tecnológico

### 4.1. Desdobramento para banco orientado a documentos: MongoDB

O projeto usa MongoDB por meio do Mongoose. Os nomes abaixo correspondem às coleções usadas pelos modelos. Os campos `_id` são `ObjectId`, exceto quando indicado; datas Mongoose são BSON Date. Campos com `ref` guardam o ObjectId referenciado. Subdocumentos e arrays indicam dados embutidos.

| Entidade conceitual | Coleção | Estratégia |
| :--- | :--- | :--- |
| Usuário | `usuarios` | Documento próprio; perfil e credenciais de acesso. |
| Estudante | `estudantes` | Documento próprio; embute resumo do curso, instituição, trancamento e matrículas na grade; referencia curso/turma. |
| Docente | `docentes` | Documento próprio; embute instituição. |
| Curso | `cursos` | Documento próprio, referenciado por disciplinas, turmas e grades. |
| Disciplina | `disciplinas` | Documento próprio; referencia curso; equivalências em array de códigos. |
| Turma | `turmas` | Documento próprio; referencia curso e estudantes; embute horários. |
| Grade de horário | `grades_horarios` | Documento próprio; embute aulas e referencia curso, turma, disciplina e docente. |
| Frequência | `frequencias` | Documento próprio por turma/aula/data; embute registros de presença. |
| Componente de nota | `componentes_notas` | Documento próprio; referencia turma, disciplina e docente. |
| Configuração de nota | `configuracoes_notas` | Documento próprio por turma/disciplina; referencia docente. |
| Nota | `notas` | Documento próprio; referencia estudante, turma, disciplina e componente. |
| Chamado | `chamados` | Documento próprio; embute histórico de mensagens e dados do solicitante. |
| Notificação | `notificacoes` | Documento próprio por destinatário; referencia estudante, turma e docente. |
| Evento | `eventos` | Documento próprio; referencia criador e turma. |
| Log de auditoria | `LOGs` | Documento próprio; referencia usuário e indexa autor/data. O nome está capitalizado assim no model. |
| Opções do sistema | `opcoes_sistema` | Documento de configuração; listas de cursos liberados guardam ObjectIds. |
| Contador | `contadores` | Documento próprio com `_id` textual e valor numérico. |

#### Exemplo de documento da coleção `estudantes`

```json
{
  "_id": {
    "$oid": "6afcd0e802db8dbd35db5ae9"
  },
  "ra": "E2026001",
  "nome": "A Luno",
  "email": "aluno@aluno.com",
  "cpf": "123456",
  "telefone": "654321",
  "endereco": "Rua Aqui",
  "foto": "",
  "statusAcademico": "ativo",
  "cursoId": {
    "$oid": "6afcd0c502db8dbd35db5ae7"
  },
  "curso": {
    "codigo": "01",
    "nome": "Engenharia de Software",
    "unidade": "Campus 1",
    "grau": "Bacharelado",
    "modalidade": "Presencial",
    "duracao": 8,
    "descricao": "Curso de Eng. De Software"
  },
  "instituicao": {
    "nome": "PUC-Campinas",
    "codigo": "PUCC-834"
  },
  "gradeMatriculas": [
    {
      "turmaId": {
        "$oid": "6afcd11b02db8dbd35db5aee"
      },
      "disciplinaId": {
        "$oid": "6afd014da28ee04ac06d17f4"
      }
    },
    {
      "turmaId": {
        "$oid": "6afd00fda28ee04ac06d17f2"
      },
      "disciplinaId": {
        "$oid": "6afcd10e02db8dbd35db5aec"
      }
    }
  ],
}
```

#### Exemplo de documento da coleção `frequencias`

```json
{
  "_id": { "$oid": "6afd8ee002ece12a799b33ac" },
  "turmaId": { "$oid": "6afcd11b02db8dbd35db5aee" },
  "aulaId": { "$oid": "6afcfcf809938203277a562b" },
  "disciplinaId": { "$oid": "6afcd10e02db8dbd35db5aec" },
  "docenteId": { "$oid": "6afcd13b02db8dbd35db5af0" },
  "data": "2026-11-18",
  "registros": [
    { "alunoId": { "$oid": "6afcd0e802db8dbd35db5ae9" }, "presente": false }
  ],
  "createdAt": { "$date": "2026-11-18T11:41:20.954Z" },
  "updatedAt": { "$date": "2026-11-18T11:56:52.198Z" }
}
```

#### Exemplo de documento da coleção `chamados`

```json
{
  "_id": { "$oid": "6afcd22e4c61b5fe51d85dbe" },
  "ra": "E2026001",
  "nome": "Ana Souza",
  "email": "ana@exemplo.edu.br",
  "assunto": "Emissão de documentos",
  "descricao": "Preciso de uma declaração.",
  "status": "ativo",
  "mensagens": [
    {
      "remetente_tipo": "estudante",
      "remetente_nome": "Ana Souza",
      "mensagem": "Preciso de uma declaração.",
      "data_envio": { "$date": "2026-11-17T22:16:14.148Z" }
    }
  ],
  "criado_em": { "$date": "2026-11-17T22:16:14.152Z" },
  "encerrado_em": null
}
```

#### Justificativa da modelagem documental

Entidades consultadas e atualizadas de forma independente, como estudantes, docentes, cursos, disciplinas, turmas, notas e eventos, permanecem em coleções próprias e se relacionam por `ObjectId`. Estruturas pequenas que são lidas junto do documento pai — como mensagens de um chamado, registros de uma frequência, aulas de uma grade e matrículas em uma grade — são subdocumentos embutidos. Resumos de curso/instituição no perfil do estudante atendem à exibição do perfil, mas podem ficar desatualizados em relação ao cadastro de curso; o `cursoId` é a referência canônica. A duplicidade de vínculos turma/horário em `turmas.horarios` e `grades_horarios.aulas` deve ser mantida consistente pela aplicação.

#### Índices declarados nos schemas

| Coleção | Campos do índice | Regra/finalidade |
| :--- | :--- | :--- |
| `usuarios` | `email` | Único. |
| `estudantes` | `ra`, `email` | Únicos quando existentes; email obrigatório. |
| `docentes` | `rp`, `email` | Únicos quando informados; email obrigatório. |
| `cursos` | `codigo` | Único. |
| `disciplinas` | `cursoId + codigo` , `equivale_para` | Índice composto único; Único. |
| `turmas` | `codigo` | Único. |
| `grades_horarios` | `cursoId + semestre` | Índice composto único. |
| `frequencias` | `turmaId + aulaId + data` | Índice composto único, evita duplicar chamada para a mesma aula/data. |
| `componentes_notas` | `turmaId + disciplinaId + titulo` | Índice composto único. |
| `configuracoes_notas` | `turmaId + disciplinaId` | Índice composto único. |
| `notas` | `alunoId + componenteId` | Índice composto único. |
| `notificacoes` | `alunoId + createdAt` | Ordenação das notificações mais recentes; `alunoId + chave` único parcial quando chave é textual. |
| `eventos` | `legacyKey` | Único e esparso. |
| `LOGs` | `usuarioId + dataHora` | Apoia histórico de auditoria por usuário, em ordem decrescente de data. |

### 4.2. Tipos físicos usados

| Tipo no MongoDB/Mongoose | Uso no NotaDez |
| :--- | :--- |
| `ObjectId` | `_id` e referências entre documentos. |
| `String` | Nomes, códigos, estados, documentos e datas textuais `AAAA-MM-DD`. |
| `Number` | Valores de notas, pesos, duração, vagas, horas e contadores. |
| `Boolean` | Preferências, estados de presença e opções de sistema. |
| `Date` | Timestamps, datas de aplicação, expiração e eventos com data/hora. |
| Array de tipos/subdocumentos | Papéis, estudantes, equivalências, horários, aulas, presenças, mensagens e listas de cursos. |
| Subdocumento | Dados compostos embutidos em perfil, turma, grade, frequência ou chamado. |

## 5. Consultas, índices e observações de arquitetura

### 5.1. Consultas esperadas

| Consulta esperada | Campos envolvidos | Índices sugeridos | Observações |
| :--- | :--- | :--- | :--- |
| Autenticar usuário | `usuarios.email` | Único em `email` | A senha é comparada usando o hash armazenado. |
| Abrir perfil de estudante/docente | `email`, `ra` ou `rp` | Índices únicos de perfil | Perfil de acesso e perfil acadêmico são documentos separados. |
| Listar disciplinas de curso | `disciplinas.cursoId` | Composto `cursoId + codigo` | Usar o curso e ordenar/filtrar pelo código. |
| Encontrar turmas por código/curso | `turmas.codigo`, `turmas.cursoId` | Único em `codigo`; considerar índice em `cursoId` | Consultas administrativas e do docente. |
| Obter grade de curso e semestre | `grades_horarios.cursoId`, `semestre` | Composto único | Identifica a grade do período curricular. |
| Consultar matrícula do estudante | `estudantes.gradeMatriculas.turmaId`, `disciplinaId` | Considerar índices multikey conforme volume | `alunosIds` da turma também é consultado; manter os dois lados coerentes. |
| Registrar/listar frequência | `turmaId`, `aulaId`, `data` | Composto único existente | Registros de presença ficam embutidos no documento da chamada. |
| Listar notas do aluno/componente | `notas.alunoId`, `componenteId` | Composto único existente | Uma nota por estudante e componente. |
| Listar componentes/configuração de nota | `turmaId`, `disciplinaId` | Compostos únicos existentes | Configuração única por turma/disciplina; títulos únicos entre componentes desse contexto. |
| Buscar chamados por solicitante/status | `ra`, `email`, `status` | Avaliar índices conforme volume | Coleção não declara índices específicos no schema atual. |
| Listar notificações recentes do aluno | `alunoId`, `createdAt` | Composto existente | Limitada às notificações do destinatário. |
| Consultar eventos por data, escopo ou turma | `date`, `scope`, `turmaId` | Avaliar índice composto conforme filtros reais | O schema declara índice apenas para `legacyKey`. |
| Consultar auditoria de usuário | `usuarioId`, `dataHora` | Composto existente, data descendente | Índice declarado em `LOGs`. |
| Carregar configurações acadêmicas | `_id` | Chave primária | Documento de chave fixa `opcoes-academicas`. |
| Obter próximo RA | `contadores._id`, `valor` | Chave primária textual | Incremento atômico do contador. |

### 5.2. Regras e Observações

- As regras de validação descritas derivam principalmente dos schemas Mongoose e das rotas da aplicação.
- Campos opcionais com valor ausente não são necessariamente persistidos como `null`; a presença depende do fluxo de gravação e dos valores padrão do schema.
- O exemplo fornecido para `usuarios` mostra `showFinanceiro`, `nivelPermissao`, `ra`/`rp` e hashes de senha. Nenhum hash ou senha de exemplo deve ser reutilizado como credencial em documentação pública.
- A coleção de notas foi indicada como sujeita a ajuste. Sua documentação aqui descreve o schema atual (`alunoId`, `turmaId`, `disciplinaId`, `componenteId`, `valor`); alterações futuras no modelo exigirão revisão desta seção.
- O campo `data` de frequência e `date` de evento é texto `AAAA-MM-DD`; já timestamps e datas como `dataAplicacao` são BSON Date. Não tratar os dois formatos como equivalentes na persistência.
- As referências `ref` do Mongoose não criam, por si só, integridade referencial automática no MongoDB. A aplicação deve garantir que as entidades relacionadas existam e que exclusões/alterações não deixem referências incoerentes.
- Os índices adicionais sugeridos na tabela 5.1 devem ser avaliados com dados.
