# Origem Certa — Rastreamento de Cadeia de Suprimentos (MongoDB / NoSQL)

Aplicação **local** de rastreamento de produtos, com **CRUD direto em coleções MongoDB** e,
nesta entrega, **2 aggregation pipelines** para auditoria e detecção de risco. Roda como um
site comum no navegador, servido por um pequeno servidor Node.js que mantém as credenciais
protegidas no computador.

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
- [Índices](#índices)
- [Aggregation Pipelines](#aggregation-pipelines)
- [Painel de Auditoria: Redis e Neo4j](#painel-de-auditoria-redis-e-neo4j)
- [API HTTP](#api-http)
- [Autenticação e segurança](#autenticação-e-segurança)
- [Laboratório CRUD (evidências)](#laboratório-crud-evidências)
- [Roteiro de demonstração](#roteiro-de-demonstração)
- [Escopo atual do CRUD](#escopo-atual-do-crud)
- [Solução de problemas](#solução-de-problemas)

---

## Arquitetura

```text
┌────────────────────┐   requisições apenas    ┌──────────────────────┐   driver oficial   ┌──────────────┐
│  Navegador          │   para o localhost      │  Servidor Node.js     │   mongodb 7.x      │  MongoDB      │
│  HTML / CSS / JS    │ ──────────────────────► │  Express (server.cjs) │ ─────────────────► │  Atlas        │
│  (pasta frontend/)  │ ◄────────────────────── │  + mongo-service.cjs  │ ◄───────────────── │  (nuvem)      │
└────────────────────┘     JSON / cookies       └──────────┬───────────┘                    └──────────────┘
                                                             │ conexão única reutilizável (opcional)
                                                  ┌──────────┴───────────┐
                                                  │ redis-service.cjs     │──► Redis (cache + HyperLogLog)
                                                  │ neo4j-service.cjs     │──► Neo4j (grafo + PageRank/GDS)
                                                  └──────────────────────┘
```

MongoDB é a **única fonte oficial dos dados**. Redis e Neo4j são complementares e opcionais —
sem eles configurados, tudo funciona igual, só os cards do Painel de Auditoria que dependem
deles mostram "não configurado" (ver [Painel de Auditoria](#painel-de-auditoria-redis-e-neo4j)).

**Por que existe um servidor local?** O navegador nunca deve receber a `MONGODB_URI`, pois a
credencial ficaria visível no código-fonte e no DevTools. O `server.cjs` mantém a chave no
computador, autentica o usuário e executa as operações MongoDB solicitadas pela interface.

---

## Tecnologias

| Camada     | Tecnologia                                                            |
| ---------- | --------------------------------------------------------------------- |
| Backend    | Node.js + Express 5 (CommonJS, arquivos `.cjs`), driver `mongodb` 7.x |
| Frontend   | HTML5, CSS3 e JavaScript vanilla (sem framework, sem build)           |
| Banco      | MongoDB Atlas (NoSQL, orientado a documentos) — fonte oficial dos dados |
| Cache/estruturas probabilísticas | Redis (`ioredis`) — complementar, opcional     |
| Grafo e análise de rede | Neo4j + Graph Data Science (`neo4j-driver`) — complementar, opcional |
| Seed       | Python 3 (`motor`, `pymongo`, `python-dotenv`)                        |
| Sessão     | Cookie `HttpOnly` assinado por HMAC-SHA256 (sem dependência externa)  |

---

## Estrutura de diretórios

```text
nosql/
├── server.cjs               # Servidor Express: serve o frontend e expõe as rotas /auth, /mongo, /redis, /neo4j
├── mongo-service.cjs        # Camada de acesso ao MongoDB: conexão, CRUD, auth, aggregation pipelines
├── redis-service.cjs        # Conexão única com Redis: cache-aside (String) + HyperLogLog
├── neo4j-service.cjs        # Conexão única com Neo4j: sync do grafo + PageRank (GDS)
├── package.json              # Metadados e scripts (start, check)
├── iniciar.cmd               # Inicializador para Windows (localiza Node mesmo fora do PATH)
├── .env.example               # Modelo de variáveis de ambiente (copie para .env)
├── .gitignore
├── PLANO_REFATORACAO_FRONTEND.md   # Plano da reforma completa do frontend (CRUD de sub-array aninhado)
│
├── frontend/                # Tudo que é servido estaticamente ao navegador
│   ├── index.html            # Interface principal (hero, indicadores, rastreamento, gestão)
│   ├── styles.css             # Estilos da interface principal
│   ├── app.js                 # Lógica da UI: abas, formulários, sessão, CRUD
│   ├── mongo-web.js            # Cliente HTTP (window.mongoCrud) que fala com o servidor local
│   ├── evidencias.html         # Laboratório de CRUD + Laboratório de Agregações
│   ├── evidencias.css
│   ├── evidencias.js
│   └── (favicon.svg, apple-touch-icon.png, og-image.png, hero-illustration.svg)
│
├── database/                 # Criação e população das coleções
│   ├── seed_data.py            # Gera os documentos embutidos e cria os índices
│   └── requirements.txt        # Dependências Python do seed
│
└── docs/                      # Documentação acadêmica e evidências
    ├── instrucoes.md            # Documentação detalhada de implementação (requisitos)
    ├── evidencias_crud/          # Prints e roteiro do CRUD
    └── evidencias_agregacoes/    # Logs, prints e roteiro das 2 aggregation pipelines
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
| `REDIS_URL`             |     não     | —                            | Conexão do Redis (cache + HyperLogLog); sem ela, essas 2 funcionalidades ficam desativadas |
| `NEO4J_URI`             |     não     | —                            | Conexão Bolt do Neo4j (ex.: `bolt://127.0.0.1:7687`) |
| `NEO4J_USER`            |     não     | —                            | Usuário do Neo4j                                     |
| `NEO4J_PASSWORD`        |     não     | —                            | Senha do Neo4j; sem as 3 variáveis, o painel de rede fica desativado |

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
(use `NO_OPEN=1` para evitar). Ao subir, ele também confirma (idempotentemente) os 2 índices
novos usados pelas aggregation pipelines. Para validar a sintaxe dos arquivos sem executar:

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

O script lê o `.env` da raiz, **recria** as 2 coleções (`delete_many` + `insert_many`) com o
schema embutido descrito abaixo e cria todos os índices (os 10 já existentes + os 2 novos desta
entrega).

---

## Coleções

O schema é **denormalizado por documento** (menos coleções, mais dados embutidos), pensado para
responder rápido "onde está este produto?" e "quais alertas estão em aberto?" sem `$lookup` nas
consultas do dia a dia.

| Coleção (API) | Coleção MongoDB | Chave natural | Quantidade aprox. |
| ------------- | ---------------- | ------------- | ----------------: |
| `produtos`    | `produtos`        | `codigo`      |                 80 |
| `usuarios`    | `usuarios`         | `email`       |                  5+ |

### Documento `produtos` (resumo)

```json
{
  "codigo": "CAF-TRK-0001",
  "nome": "Cafe Organico 500g",
  "categoria": "alimentos",
  "fabricante": "Fazenda Minas Verdes LTDA",
  "status_atual": "em_alerta",
  "nota_fiscal": { "numero": "NF-2026-00001", "emissor": "...", "quantidade_declarada": 80, "valor_total": 1500, "status_validacao": "em_analise" },
  "movimentacoes": [ { "codigo": "MOV-2026-0001-1", "tipo": "produto_cadastrado", "usuario_responsavel": { "email": "...", "nome": "..." }, "verificacao": { "resultado": "regular", "motivos": [] } } ],
  "alertas": [ { "codigo": "ALT-2026-0001", "tipo": "produto_fora_do_local_desejado", "gravidade": "alta", "status": "em_analise", "responsavel_auditoria": { "email": "...", "nome": "..." } } ],
  "locais": { "origem": { "nome": "...", "cidade": "...", "coordenadas": { "latitude": 0, "longitude": 0 } }, "destino": { "...": "..." }, "atual": { "nome": "..." } },
  "usuarios_associados": { "remetente": { "email": "..." }, "destinatario": { "email": "..." }, "recebedor": { "email": "..." } }
}
```

### Documento `usuarios` (resumo)

```json
{
  "email": "joao.silva@origemcerta.com",
  "login": "joao.silva",
  "nome": "Joao da Silva",
  "cargo": "Operador de armazem",
  "perfil": "operador",
  "ativo": true,
  "setor": "operacao",
  "produtos_destinados": [ { "codigo": "SAL-TRK-0003", "nome": "Sal Marinho 500g", "nota_fiscal": "NF-2026-00003" } ],
  "produtos_enviados": [ { "codigo": "CAF-TRK-0001", "nome": "Cafe Organico 500g", "nota_fiscal": "NF-2026-00001" } ]
}
```

---

## Índices

| Coleção  | Índice                                              | Motivo                                                                 |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| produtos | `codigo` (único)                                      | chave natural, usada pelo CRUD e pelo FIND                             |
| produtos | `nota_fiscal.numero` (único)                          | evita nota fiscal duplicada entre produtos                              |
| produtos | `usuarios_associados.destinatario.email`              | consulta de produtos por destinatário                                   |
| produtos | `usuarios_associados.recebedor.email`                 | consulta de produtos por recebedor                                      |
| produtos | `alertas.codigo`                                       | busca direta por um alerta específico                                   |
| produtos | **`alertas.status` + `alertas.gravidade`** *(novo)*    | sustenta o `$match` de pré-filtro e a ordenação do **Pipeline 1**       |
| usuarios | `email` (único), `login` (único)                       | chave natural e autenticação                                            |
| usuarios | `produtos_destinados.codigo`                           | consulta reversa produto → destinatário                                 |
| usuarios | **`ativo` + `setor`** *(novo)*                         | sustenta o `$match { ativo: true }` inicial do **Pipeline 2**            |

Os 2 índices novos foram criados diretamente no Atlas nesta entrega e também são recriados pelo
`database/seed_data.py`.

---

## Aggregation Pipelines

Duas funcionalidades novas, cada uma resolvendo uma pergunta que o CRUD sozinho não responde
(o `mongo-service.cjs` expõe cada uma como um método dedicado, reaproveitado tanto pelas rotas
HTTP quanto pelo Laboratório de Agregações em `evidencias.html`).

### Pipeline 1 — Relatório de alertas ativos por gravidade e tempo em aberto

**Problema que resolve:** hoje os alertas só existem espalhados dentro de cada produto
(`produtos.alertas[]`). Não havia visão consolidada de "quais alertas ainda estão abertos, do
mais grave para o mais antigo". Este pipeline gera esse painel único e, ao encontrar o alerta,
enriquece o auditor responsável com o cadastro **atual** da coleção `usuarios` — porque a cópia
embutida em `alertas.responsavel_auditoria` fica congelada no momento da emissão do alerta.

Rota: `GET /mongo/aggregations/alertas-ativos` · Coleção: `db.produtos`

```js
db.produtos.aggregate([
  { $match: { "alertas.status": { $ne: "resolvido" } } },      // usa o índice alertas.status_gravidade
  { $unwind: "$alertas" },
  { $match: { "alertas.status": { $ne: "resolvido" } } },
  { $lookup: {
      from: "usuarios",
      localField: "alertas.responsavel_auditoria.email",
      foreignField: "email",
      as: "auditor_atual",
  }},
  { $unwind: { path: "$auditor_atual", preserveNullAndEmptyArrays: true } },
  { $set: {
      gravidade_peso: { $switch: { branches: [
        { case: { $eq: ["$alertas.gravidade", "alta"] }, then: 3 },
        { case: { $eq: ["$alertas.gravidade", "media"] }, then: 2 },
      ], default: 1 } },
      dias_em_aberto: { $dateDiff: { startDate: { $toDate: "$alertas.data_emissao" }, endDate: "$$NOW", unit: "day" } },
  }},
  { $project: {
      _id: "$alertas.codigo", produto_codigo: "$codigo", produto_nome: "$nome", categoria: 1,
      alerta_codigo: "$alertas.codigo", tipo: "$alertas.tipo", descricao: "$alertas.descricao",
      gravidade: "$alertas.gravidade", gravidade_peso: 1, status: "$alertas.status",
      dias_em_aberto: 1, local_desejado: "$alertas.local_desejado", local_registrado: "$alertas.local_registrado",
      auditor: { nome: "$auditor_atual.nome", email: "$auditor_atual.email", cargo: "$auditor_atual.cargo", setor: "$auditor_atual.setor" },
  }},
  { $sort: { gravidade_peso: -1, dias_em_aberto: -1 } },
  { $merge: { into: "relatorio_alertas_ativos", whenMatched: "replace", whenNotMatched: "insert" } },
])
```

Estágios: `$match`, `$unwind`, `$lookup`, `$set`, `$project`, `$sort`, `$merge`.

Saída real (rodada contra o Atlas em 2026-07-07 — ver
[`docs/evidencias_agregacoes/logs/02-pipeline1-alertas-ativos.log`](docs/evidencias_agregacoes/logs/02-pipeline1-alertas-ativos.log)):
**10 alertas ativos** encontrados, ordenados por gravidade e dias em aberto. Primeiro resultado:

```json
{
  "produto_codigo": "MEL-TRK-0029",
  "produto_nome": "Mel Silvestre 300g",
  "alerta_codigo": "ALT-2026-0029",
  "gravidade": "media",
  "gravidade_peso": 2,
  "dias_em_aberto": 36,
  "status": "em_analise",
  "local_desejado": "Destino Campinas",
  "local_registrado": "Ponto nao autorizado Campinas",
  "auditor": { "nome": "Beatriz Rocha", "email": "beatriz.rocha@origemcerta.com", "cargo": "Cliente destinataria", "setor": "cliente" }
}
```

### Pipeline 2 — Auditoria por amostragem de exposição a produtos em risco

**Problema que resolve:** `usuarios.produtos_destinados[]` só guarda uma referência leve
(`codigo`, `nome`, `nota_fiscal`) — não dá para saber, sem uma consulta extra, quantos desses
produtos estão hoje "em risco". Este pipeline sorteia aleatoriamente uma amostra de usuários
ativos (técnica real de auditoria por amostragem, para não sempre auditar os mesmos usuários) e
calcula, para cada um, o percentual de produtos destinados a ele que estão em risco (status
`em_alerta` ou com algum alerta ainda não resolvido).

Rota: `GET /mongo/aggregations/auditoria-amostra?tamanho=5` · Coleção: `db.usuarios`

```js
db.usuarios.aggregate([
  { $match: { ativo: true } },                 // usa o índice ativo_setor
  { $sample: { size: 5 } },
  { $unwind: "$produtos_destinados" },
  { $lookup: { from: "produtos", localField: "produtos_destinados.codigo", foreignField: "codigo", as: "produto_info" } },
  { $unwind: "$produto_info" },
  { $set: {
      em_risco: { $or: [
        { $eq: ["$produto_info.status_atual", "em_alerta"] },
        { $gt: [{ $size: { $filter: {
            input: { $ifNull: ["$produto_info.alertas", []] },
            cond: { $ne: ["$$this.status", "resolvido"] },
        } } }, 0] },
      ] },
  }},
  { $group: {
      _id: { email: "$email", nome: "$nome", setor: "$setor", cargo: "$cargo" },
      total_produtos_destinados: { $sum: 1 },
      produtos_em_risco: { $sum: { $cond: ["$em_risco", 1, 0] } },
      produtos_risco_detalhe: { $push: { $cond: ["$em_risco",
        { codigo: "$produto_info.codigo", nome: "$produto_info.nome", status_atual: "$produto_info.status_atual" }, "$$REMOVE"] } },
  }},
  { $set: { percentual_risco: { $round: [{ $multiply: [{ $divide: ["$produtos_em_risco", "$total_produtos_destinados"] }, 100] }, 1] } } },
  { $match: { produtos_em_risco: { $gt: 0 } } },
  { $sort: { percentual_risco: -1 } },
  { $project: { _id: "$_id.email", email: "$_id.email", nome: "$_id.nome", setor: "$_id.setor", cargo: "$_id.cargo",
      total_produtos_destinados: 1, produtos_em_risco: 1, percentual_risco: 1, produtos_risco_detalhe: 1, data_amostragem: "$$NOW" } },
  { $merge: { into: "auditoria_amostras_risco", whenMatched: "replace", whenNotMatched: "insert" } },
])
```

Estágios: `$match`, `$sample`, `$unwind`, `$lookup`, `$unwind`, `$set`, `$group`, `$set`,
`$match`, `$sort`, `$project`, `$merge`.

> Como `$merge` não devolve documentos ao cursor da chamada, o `mongo-service.cjs` limpa a
> coleção materializada (`relatorio_alertas_ativos` / `auditoria_amostras_risco`) antes de cada
> execução e lê de volta o que a própria pipeline acabou de gravar — assim a evidência mostrada
> reflete exatamente aquela execução (essencial no Pipeline 2, que usa `$sample`).

Somando as duas pipelines, os estágios pedidos (`sort`, `match`, `project`, `lookup`, `unwind`,
`merge`, `set`, `sample`) aparecem todos pelo menos uma vez, além de `$group`, `$dateDiff`,
`$switch` e `$round`.

Saída real (ver
[`docs/evidencias_agregacoes/logs/03-pipeline2-auditoria-amostra.log`](docs/evidencias_agregacoes/logs/03-pipeline2-auditoria-amostra.log)):
amostra de 5 usuários ativos, **3 com produtos em risco**, todos em 25% de exposição no momento
da execução.

Mais evidências (criação dos índices, chamadas via HTTP autenticado) em
[`docs/evidencias_agregacoes/`](docs/evidencias_agregacoes/README.md).

---

## Painel de Auditoria: Redis e Neo4j

Aba **"Painel de Auditoria"** no site principal (`index.html`), com 4 cards — cada um com
estado de carregamento, erro e "sem dados", e um botão "Atualizar":

1. **Pipeline 1 (alertas ativos)** e **Pipeline 2 (auditoria por amostragem)** — os mesmos
   endpoints Mongo de sempre, só que agora com um selo indicando se a resposta veio do cache
   Redis ou foi calculada na hora.
2. **Produtos únicos consultados** — estimativa via **HyperLogLog** (Redis).
3. **Usuários mais centrais na rede** — **PageRank** via **Neo4j + Graph Data Science**.

O MongoDB continua sendo a única fonte oficial dos dados; Redis e Neo4j são complementares e
**opcionais** — se `REDIS_URL` ou `NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD` não estiverem
definidos (ou a conexão falhar), o site inteiro continua funcionando normalmente e esses 2 cards
mostram "não configurado" em vez de quebrar.

### Redis — 2 funcionalidades com dados reais

**Estrutura comum (String) — cache-aside das pipelines.** `redis-service.cjs` expõe
`getOrSetCache(key, ttlSeconds, computeFn)`: tenta `GET`; se não achar, chama a pipeline de
verdade (`computeFn`), guarda o resultado com `SET ... EX 60` e devolve. As 2 rotas de
agregação (`/mongo/aggregations/*`) passaram a usar esse cache — a pipeline em si não foi
alterada, só passou a ser chamada por trás de um cache de 60s.

**Estrutura probabilística (HyperLogLog) — estimativa de produtos únicos consultados.** Toda
busca real de produto (`GET /mongo/find/produtos?query=...`) chama, em segundo plano,
`PFADD buscas:produtos:hll <termo>`. A rota `GET /redis/produtos-consultados-estimativa` chama
`PFCOUNT` e devolve a estimativa — um contador aproximado que usa memória constante, ao
contrário de guardar a lista inteira de termos já buscados.

### Neo4j — grafo + PageRank (Graph Data Science)

O grafo é **derivado do MongoDB** (nunca é a fonte oficial): `neo4j-service.cjs` lê `produtos` e
`usuarios` (reaproveitando `mongoService.list(...)`, sem duplicar lógica) e recria os nós e
relacionamentos a cada sincronização.

```text
(:Usuario {email, nome, perfil, setor})
(:Produto {codigo, nome, categoria, status_atual})

(u:Usuario)-[:ENVIOU]->(p:Produto)              -- produtos.usuarios_associados.remetente
(u:Usuario)-[:RECEBEU]->(p:Produto)             -- produtos.usuarios_associados.recebedor
(u:Usuario)-[:DESTINATARIO_DE]->(p:Produto)     -- produtos.usuarios_associados.destinatario
(u:Usuario)-[:REGISTROU]->(p:Produto)           -- 1 por item de produtos.movimentacoes[]
(u:Usuario)-[:AUDITOU]->(p:Produto)             -- 1 por item de produtos.alertas[]
```

**Algoritmo: PageRank.** A rede é bipartida (Usuário↔Produto); a projeção usada para o PageRank
trata as 5 relações como **não direcionadas** (`orientation: 'UNDIRECTED'`), porque as arestas
reais só vão de usuário para produto — sem isso, todo produto acumularia a pontuação e todo
usuário ficaria preso no valor-base, sem nenhum jeito de diferenciar quem é mais central.
Tratando como não direcionado, a centralidade flui nos dois sentidos da rede e o resultado
identifica os usuários que mais aparecem em operações (envio, recebimento, movimentação,
auditoria) — útil para **priorizar quem auditar primeiro**. Testado com os dados reais: os 5
usuários envolvidos nas operações do seed ficaram com score muito acima de contas sem nenhuma
operação registrada (score-base), confirmando que a métrica separa corretamente quem está
"no centro da rede" de quem está isolado.

`POST /neo4j/sync` recria o grafo (idempotente, `MERGE`) e roda automaticamente 1x no boot do
servidor; o botão "Atualizar grafo" no site chama essa mesma rota antes de buscar o ranking.

### Provisionar Redis e Neo4j localmente (sem Docker, sem instalador com admin)

Se você não tem Redis/Neo4j instalados e não pode/quer usar Docker nem um instalador que peça
permissão de administrador, dá para rodar os dois como **binários portáteis** (zip, sem
instalação):

1. **Redis**: baixe o build para Windows em
   [`github.com/tporadowski/redis/releases`](https://github.com/tporadowski/redis/releases)
   (ex.: `Redis-x64-5.0.14.1.zip`), extraia em qualquer pasta e rode
   `redis-server.exe redis.windows.conf --port 6379`. Não instala serviço, não precisa de admin.
2. **Java (necessário para o Neo4j)**: se não tiver Java 21+, baixe um JDK portátil em
   [`adoptium.net`](https://adoptium.net/temurin/releases/) (build "zip", sem instalador) e
   extraia em qualquer pasta.
3. **Neo4j Community + GDS**: baixe o Community Server em
   [`neo4j.com/deployment-center`](https://neo4j.com/deployment-center/) (arquivo `.zip`) e o
   plugin Graph Data Science em
   [`github.com/neo4j/graph-data-science/releases`](https://github.com/neo4j/graph-data-science/releases)
   (arquivo `.jar`). Extraia o Neo4j, copie o `.jar` para a pasta `plugins/`, e adicione ao
   final de `conf/neo4j.conf`:
   ```conf
   server.directories.plugins=plugins
   dbms.security.procedures.unrestricted=gds.*
   dbms.security.procedures.allowlist=gds.*
   ```
   Defina a senha inicial com `bin\neo4j-admin.bat dbms set-initial-password "SUA_SENHA"` e
   suba com `bin\neo4j.bat console` (roda como processo comum, sem instalar serviço).
4. No `.env`, aponte `REDIS_URL=redis://127.0.0.1:6379` e
   `NEO4J_URI=bolt://127.0.0.1:7687` / `NEO4J_USER=neo4j` / `NEO4J_PASSWORD=SUA_SENHA`.

Quem preferir Docker, Memurai/Neo4j Desktop ou um serviço em nuvem próprio pode usar — o código
não muda, só o valor dessas variáveis de ambiente.

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
| -------- | --------------------------------------- | ------------------------------------------ |
| `GET`    | `/mongo/status`                         | Status da conexão (público)               |
| `GET`    | `/mongo/stats`                          | Indicadores do dashboard                  |
| `GET`    | `/mongo/summary`                        | Contagem por coleção                      |
| `GET`    | `/mongo/find/:collection`               | **FIND** com busca textual (`?query=`)    |
| `GET`    | `/mongo/collections/:collection`        | Lista documentos                          |
| `GET`    | `/mongo/collections/:collection/:key`   | **findOne** por chave natural             |
| `POST`   | `/mongo/collections/:collection`        | **INSERT** (`insertOne`)                  |
| `PUT`    | `/mongo/collections/:collection/:key`   | **UPDATE** (`updateOne` + `$set`)         |
| `DELETE` | `/mongo/collections/:collection/:key`   | **DELETE** (`deleteOne`)                  |
| `GET`    | `/mongo/export`                         | Exporta todas as coleções                 |

`:collection` aceita `produtos` ou `usuarios` (as únicas 2 coleções do schema atual).

### Aggregation Pipelines (com cache Redis)

| Método | Rota                                       | Operação                                            |
| ------ | ------------------------------------------- | ----------------------------------------------------- |
| `GET`  | `/mongo/aggregations/alertas-ativos`        | Roda o **Pipeline 1** (relatório de alertas ativos), servido do cache Redis quando disponível |
| `GET`  | `/mongo/aggregations/auditoria-amostra`     | Roda o **Pipeline 2** (`?tamanho=` define a amostra), idem |

### Redis e Neo4j (Painel de Auditoria)

| Método | Rota                                       | Operação                                            |
| ------ | ------------------------------------------- | ----------------------------------------------------- |
| `GET`  | `/redis/produtos-consultados-estimativa`    | Estimativa (HyperLogLog) de produtos únicos consultados |
| `POST` | `/neo4j/sync`                               | Recria o grafo Usuario↔Produto a partir do MongoDB   |
| `GET`  | `/neo4j/usuarios-centrais`                  | PageRank sobre o grafo (`?limite=` define quantos usuários retornar) |

No frontend, essas chamadas são encapsuladas em `window.mongoCrud` (ver `frontend/mongo-web.js`).

---

## Autenticação e segurança

- As funcionalidades de consulta e CRUD exigem **login**.
- O servidor cria uma **sessão por cookie `HttpOnly`** assinado com HMAC-SHA256 (validade de 8h);
  o conteúdo é verificado com comparação em tempo constante (`timingSafeEqual`).
- Sem cookie válido, as rotas de FIND/INSERT/UPDATE/DELETE e as de agregação retornam **HTTP 401**.
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
no UPDATE e histórico da sessão. Logo abaixo, a seção **Laboratório de Agregações** roda as 2
pipelines desta entrega e mostra o pipeline em JSON, a contagem de documentos e uma amostra do
resultado.

---

## Roteiro de demonstração

1. Abra o site e confirme a mensagem **MongoDB conectado**.
2. Faça login (use a conta de demonstração ou uma conta cadastrada).
3. Abra **Laboratório CRUD** (`evidencias.html`).
4. **FIND** por `CAF-TRK-0001`.
5. **INSERT** de `PROD-EVIDENCIA-0001` e confira `produtos` ir de 80 → 81.
6. **UPDATE** e mostre `before` e `after`.
7. **DELETE** e confira `produtos` voltar para 80.
8. Role até **Laboratório de Agregações**, rode o **Pipeline 1** (alertas ativos) e o
   **Pipeline 2** (auditoria por amostragem) e confira o pipeline + resultado exibidos.
9. (Opcional) Confirme os documentos e os índices no MongoDB Atlas ou Compass.

---

## Escopo atual do CRUD

O schema real (2 coleções embutidas) foi confirmado direto no Atlas. Nesta entrega, a camada de
dados (`mongo-service.cjs`, `server.cjs`, `database/seed_data.py`) e o frontend foram corrigidos
para refletir esse schema: as antigas abas de `lotes`/`movimentações`/`alertas`/`locais`/`notas`
como coleções separadas foram removidas (não existem mais no banco). Hoje o CRUD cobre os
documentos de `produtos` e `usuarios` em nível superior; alertas, movimentações e locais
aparecem como **somente leitura** no rastreamento (eles já vêm embutidos no documento do
produto). Editar esses sub-documentos aninhados (adicionar uma movimentação ou resolver um
alerta pela interface) é a próxima etapa — o plano detalhado está em
[`PLANO_REFATORACAO_FRONTEND.md`](PLANO_REFATORACAO_FRONTEND.md).

---

## Solução de problemas

| Sintoma                                   | Causa provável / solução                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `MONGODB_URI nao encontrada`              | Crie o `.env` na raiz a partir do `.env.example`.                                    |
| `MongoDB não conectado` / timeout SRV     | DNS local não resolve o Atlas — defina `MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1`.        |
| Porta 5500 ocupada                        | Defina outra `PORT` no `.env`.                                                       |
| Node não encontrado pelo `iniciar.cmd`    | Instale o Node.js LTS (https://nodejs.org) ou rode `npm start`.                      |
| `401` ao consultar/alterar dados          | Faça login — as rotas de dados e de agregação exigem sessão.                        |

---

> Documentação acadêmica detalhada (mapa de requisitos e implementação) em
> [`docs/instrucoes.md`](docs/instrucoes.md). Modelagem conceitual em
> [`modelagem_nosql.md`](modelagem_nosql.md).
