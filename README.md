
# NotaDez




## Como executar o Projeto

## Pré-requisitos

- Node.js instalado (Versão mais recente)


## 1. Clone o repositório

```bash
git clone https://github.com/BrunoM2422/ES-PI4-2026-T3-G7.git
```

## 2. Acesse a pasta do projeto

```bash
cd ES-PI4-2026-T3-G7
```

## 3. Configure as variáveis de ambiente
Abra o terminal e rode:
```bash
copy .env.example .env
```

Em seguida, abra o arquivo .env e substitua o valor de MONGODB_URI pela sua string de conexão do MongoDB.
```bash
PORT=3000
MONGODB_URI=adicione_aqui_a_string_de_conexao_do_mongodb
```

---

Instale as dependências:
```bash
npm install
```

Inicie o servidor:
```bash
npm run start
```

Acesse:
```bash
http://localhost:3000
```
