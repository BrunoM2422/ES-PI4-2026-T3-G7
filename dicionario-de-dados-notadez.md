# Dicionário de Dados: Sistema Acadêmico NotaDez

## 1. Histórico de versões (ou revisões)

| Data | Autor | Versão | Comentários |
| :---: | :--- | :---: | :--- |
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
