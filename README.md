# Origem Certa — Rastreamento de Cadeia de Suprimentos (MongoDB / NoSQL)

Aplicação **local** de rastreamento de produtos, lotes, movimentações, alertas, locais e
notas fiscais, com **CRUD direto em coleções MongoDB**. Roda como um site comum no navegador,
servido por um pequeno servidor Node.js que mantém as credenciais protegidas no computador.

> Projeto acadêmico de Banco de Dados NoSQL. Não usa FastAPI, Render, Electron nem hospedagem
> externa para o backend.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Estrutura de diretórios](#estrutura-de-diretórios)
- [Pré-requisitos](#pré-requisitos)
- [Configuração (.env)](#configuração-env)
- [Instalação](#instalação)
- [Como executar](#como-executar)
- [Popular o banco (seed)](#popular-o-banco-seed)
- [Coleções](#coleções)
- [API HTTP](#api-http)
- [Autenticação e segurança](#autenticação-e-segurança)
- [Laboratório CRUD (evidências)](#laboratório-crud-evidências)
- [Roteiro de demonstração](#roteiro-de-demonstração)
- [Solução de problemas](#solução-de-problemas)

---

## Arquitetura

```text
┌────────────────────┐   requisições apenas    ┌──────────────────────┐   driver oficial   ┌──────────────┐
│  Navegador          │   para o localhost      │  Servidor Node.js     │   mongodb 7.x      │  MongoDB      │
│  HTML / CSS / JS    │ ──────────────────────► │  Express (server.cjs) │ ─────────────────► │  Atlas        │
│  (pasta frontend/)  │ ◄────────────────────── │  + mongo-service.cjs  │ ◄───────────────── │  (nuvem)      │
└────────────────────┘     JSON / cookies       └──────────────────────┘                    └──────────────┘
```

**Por que existe um servidor local?** O navegador nunca deve receber a `MONGODB_URI`, pois a
credencial ficaria visível no código-fonte e no DevTools. O `server.cjs` mantém a chave no
computador, autentica o usuário e executa as operações MongoDB solicitadas pela interface.

---

## Tecnologias

| Camada     | Tecnologia                                                            |
| ---------- | --------------------------------------------------------------------- |
| Backend    | Node.js + Express 5 (CommonJS, arquivos `.cjs`), driver `mongodb` 7.x |
| Frontend   | HTML5, CSS3 e JavaScript vanilla (sem framework, sem build)           |
| Banco      | MongoDB Atlas (NoSQL, orientado a documentos)                         |
| Seed       | Python 3 (`motor`, `pymongo`, `python-dotenv`)                        |
| Sessão     | Cookie `HttpOnly` assinado por HMAC-SHA256 (sem dependência externa)  |

---

## Estrutura de diretórios

```text
nosql/
├── server.cjs              # Servidor Express: serve o frontend e expõe as rotas /auth e /mongo
├── mongo-service.cjs       # Camada de acesso ao MongoDB: conexão, CRUD, auth e (de)serialização
├── package.json            # Metadados e scripts (start, check)
├── iniciar.cmd             # Inicializador para Windows (localiza Node mesmo fora do PATH)
├── .env.example            # Modelo de variáveis de ambiente (copie para .env)
├── .gitignore
│
├── frontend/               # Tudo que é servido estaticamente ao navegador
│   ├── index.html          # Interface principal (hero, indicadores, rastreamento, gestão)
│   ├── styles.css          # Estilos da interface principal
│   ├── app.js              # Lógica da UI: abas, formulários, sessão, CRUD
│   ├── mongo-web.js        # Cliente HTTP (window.mongoCrud) que fala com o servidor local
│   ├── evidencias.html     # Laboratório CRUD (tela de comprovação)
│   ├── evidencias.css
│   ├── evidencias.js
│   └── (favicon.svg, apple-touch-icon.png, og-image.png, hero-illustration.svg)
│
├── database/               # Criação e população das coleções
│   ├── seed_data.py        # Gera e insere os documentos; cria índices únicos
│   └── requirements.txt    # Dependências Python do seed
│
└── docs/                   # Documentação acadêmica e evidências
    ├── instrucoes.md       # Documentação detalhada de implementação (requisitos)
    └── evidencias_crud/    # Prints de telas e coleções para comprovação
```

---

## Pré-requisitos

- **Node.js LTS** (18+). O `iniciar.cmd` também localiza o Node do ambiente Codex automaticamente.
- **Conta/cluster MongoDB Atlas** com uma `MONGODB_URI` válida.
- **Python 3.10+** apenas se for rodar o seed (`database/seed_data.py`).

---

## Configuração (.env)

Copie o modelo e preencha com valores reais:

```cmd
copy .env.example .env
```

Variáveis reconhecidas:

| Variável                | Obrigatória | Padrão                       | Função                                               |
| ----------------------- | :---------: | ---------------------------- | ---------------------------------------------------- |
| `MONGODB_URI`           |     sim     | —                            | String de conexão do Atlas                           |
| `MONGODB_DB`            |     não     | `origem-certa`               | Nome do banco                                        |
| `DEMO_ADMIN_USER`       |     não     | `admin`                      | Login da conta de demonstração                       |
| `DEMO_ADMIN_PASSWORD`   |     não     | —                            | Senha da conta de demonstração (habilita a conta)    |
| `DEMO_ADMIN_EMAIL`      |     não     | `admin@origemcerta.local`    | E-mail da conta de demonstração                      |
| `SESSION_SECRET`        |     não     | aleatório por execução       | Chave HMAC que assina o cookie de sessão             |
| `HOST` / `PORT`         |     não     | `127.0.0.1` / `5500`         | Endereço e porta do servidor                         |
| `NO_OPEN`               |     não     | —                            | `1` impede abrir o navegador automaticamente         |
| `MONGODB_DNS_SERVERS`   |     não     | detectado                    | DNS para resolver SRV do Atlas (ex.: `8.8.8.8`)      |
| `NODE_ENV`              |     não     | —                            | `production` marca o cookie como `Secure`            |

> O `.env` **não deve** ser enviado ao GitHub (já está no `.gitignore`). Use o `.env.example`
> apenas como modelo, sem credenciais reais.

---

## Instalação

```cmd
cd caminho\para\nosql
npm install
```

---

## Como executar

**Windows (recomendado):** dê duplo clique em `iniciar.cmd`. Ele localiza o Node mesmo quando
`npm` não está no `PATH`, instala dependências se faltarem e sobe o servidor.

**Qualquer plataforma com Node no PATH:**

```cmd
npm start
```

O servidor sobe em `http://127.0.0.1:5500` e abre o navegador automaticamente
(use `NO_OPEN=1` para evitar). Para validar a sintaxe dos arquivos sem executar:

```cmd
npm run check
```

---

## Popular o banco (seed)

```cmd
cd database
pip install -r requirements.txt
python seed_data.py
```

O script lê o `.env` da raiz, **recria** as coleções (`delete_many` + `insert_many`) e cria
índices únicos pelas chaves naturais.

---

## Coleções

| Coleção (API)   | Coleção MongoDB  | Chave natural | Quantidade aprox. |
| --------------- | ---------------- | ------------- | ----------------: |
| `produtos`      | `produtos`       | `codigo`      |               120 |
| `lotes`         | `lotes`          | `codigo`      |               120 |
| `movimentacoes` | `movimentacoes`  | `codigo`      |               240 |
| `alertas`       | `alertas`        | `codigo`      |               120 |
| `locais`        | `locais`         | `nome`        |               120 |
| `notas`         | `notas_fiscais`  | `numero`      |               120 |
| `usuarios`      | `usuarios`       | `email`       |                 5 |

---

## API HTTP

Todas as rotas `/mongo/*` (exceto `/mongo/status`) exigem sessão autenticada.

### Autenticação

| Método | Rota             | Descrição                                              |
| ------ | ---------------- | ------------------------------------------------------ |
| `GET`  | `/auth/session`  | Retorna se há sessão válida e o usuário                |
| `POST` | `/auth/login`    | Login com `{ login, senha }`; emite cookie de sessão   |
| `POST` | `/auth/register` | Cria conta e já autentica                              |
| `POST` | `/auth/logout`   | Encerra a sessão                                       |

### Dados e CRUD

| Método   | Rota                                   | Operação                                  |
| -------- | -------------------------------------- | ----------------------------------------- |
| `GET`    | `/mongo/status`                        | Status da conexão (público)               |
| `GET`    | `/mongo/stats`                         | Indicadores do dashboard                  |
| `GET`    | `/mongo/summary`                       | Contagem por coleção                      |
| `GET`    | `/mongo/find/:collection`              | **FIND** com busca textual (`?query=`)    |
| `GET`    | `/mongo/collections/:collection`       | Lista documentos                          |
| `GET`    | `/mongo/collections/:collection/:key`  | **findOne** por chave natural             |
| `POST`   | `/mongo/collections/:collection`       | **INSERT** (`insertOne`)                  |
| `PUT`    | `/mongo/collections/:collection/:key`  | **UPDATE** (`updateOne` + `$set`)         |
| `DELETE` | `/mongo/collections/:collection/:key`  | **DELETE** (`deleteOne`)                  |
| `GET`    | `/mongo/export`                        | Exporta todas as coleções                 |

No frontend, essas chamadas são encapsuladas em `window.mongoCrud` (ver `frontend/mongo-web.js`).

---

## Autenticação e segurança

- As funcionalidades de consulta e CRUD exigem **login**.
- O servidor cria uma **sessão por cookie `HttpOnly`** assinado com HMAC-SHA256 (validade de 8h);
  o conteúdo é verificado com comparação em tempo constante (`timingSafeEqual`).
- Sem cookie válido, as rotas de FIND/INSERT/UPDATE/DELETE retornam **HTTP 401**.
- Senhas de usuários são armazenadas com `scrypt` + salt (campo `senha_hash`); os campos
  `_id`, `senha` e `senha_hash` nunca são enviados ao navegador.
- A `MONGODB_URI` permanece somente no servidor.

---

## Laboratório CRUD (evidências)

Abra:

```text
http://127.0.0.1:5500/evidencias.html
```

A tela permite executar e comprovar, exibindo o comando MongoDB e o JSON retornado:

```js
db.produtos.find(...)
db.produtos.insertOne(documento)
db.produtos.updateOne(filtro, { $set: documento })
db.produtos.deleteOne(filtro)
```

Mostra também: status da conexão, contagem das coleções, seletor de coleção, `before`/`after`
no UPDATE e histórico da sessão.

---

## Roteiro de demonstração

1. Abra o site e confirme a mensagem **MongoDB conectado**.
2. Faça login (use a conta de demonstração ou uma conta cadastrada).
3. Abra **Laboratório CRUD** (`evidencias.html`).
4. **FIND** por `CAF-TRK-0001`.
5. **INSERT** de `PROD-EVIDENCIA-0001` e confira `produtos` ir de 120 → 121.
6. **UPDATE** e mostre `before` e `after`.
7. **DELETE** e confira `produtos` voltar para 120.
8. (Opcional) Confirme os documentos no MongoDB Atlas ou Compass.

---

## Solução de problemas

| Sintoma                                   | Causa provável / solução                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `MONGODB_URI nao encontrada`              | Crie o `.env` na raiz a partir do `.env.example`.                                    |
| `MongoDB não conectado` / timeout SRV     | DNS local não resolve o Atlas — defina `MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1`.        |
| Porta 5500 ocupada                        | Defina outra `PORT` no `.env`.                                                       |
| Node não encontrado pelo `iniciar.cmd`    | Instale o Node.js LTS (https://nodejs.org) ou rode `npm start`.                      |
| `401` ao consultar/alterar dados          | Faça login — as rotas de dados exigem sessão.                                        |

---

> Documentação acadêmica detalhada (mapa de requisitos e implementação) em
> [`docs/instrucoes.md`](docs/instrucoes.md).
