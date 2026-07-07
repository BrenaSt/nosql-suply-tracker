# Plano: reforma completa do frontend para o schema embutido

## Contexto

O banco real (Atlas) usa um schema embutido de 2 coleções: `produtos` (com `nota_fiscal`,
`movimentacoes[]`, `alertas[]`, `locais` e `usuarios_associados` dentro do próprio documento) e
`usuarios` (com `produtos_destinados[]` e `produtos_enviados[]`). Ver `README.md` > Coleções
para o schema completo.

Na entrega das 2 aggregation pipelines + 2 índices, a camada de dados (`mongo-service.cjs`,
`server.cjs`, `database/seed_data.py`) e o frontend foram corrigidos para esse schema real, mas
de forma **mínima**: o CRUD cobre os campos de nível superior de `produtos` e `usuarios`;
alertas, movimentações e locais aparecem no rastreamento como **somente leitura** (o formulário
genérico atual, baseado em `ENTITY_FIELDS`, não sabe editar um item dentro de um array
aninhado). Este documento é o plano para fechar essa lacuna — **ainda não implementado**.

## Objetivo

Permitir, pela interface, as operações que hoje só existem via script/Compass:

1. Adicionar uma nova movimentação a um produto (`$push` em `produtos.movimentacoes`).
2. Abrir, atualizar o status (`em_analise` → `resolvido`) ou remover um alerta de um produto
   (`$push` / `arrayFilters` + `$set` / `$pull` em `produtos.alertas`).
3. Editar os sub-documentos `locais` e `nota_fiscal` de um produto (hoje só preenchidos
   automaticamente pelo backend na criação, com valores mínimos).
4. Exibir de forma rica (não só uma lista de código/nome) os `produtos_destinados` e
   `produtos_enviados` de um usuário, com o status atual de cada produto referenciado.

## Por que isso é maior do que parece

`frontend/app.js` (e o par `frontend/index.html`) foi construído em torno de "1 formulário genérico
por coleção" (`ENTITY_FIELDS` + `CRUD_CONFIG` + `createModuleField`). Um item dentro de um array
aninhado não é "mais uma coleção" — é um sub-recurso de um documento pai, com seu próprio ciclo de
vida (criar, listar, editar, remover) dentro do formulário do produto. Isso não encaixa no
formulário genérico atual sem uma UI dedicada por sub-recurso.

## Mudanças necessárias por arquivo

### `mongo-service.cjs`

Adicionar métodos dedicados (o `insert`/`update`/`remove` genéricos continuam para os campos de
nível superior):

- `addMovimentacao(codigoProduto, movimentacao)` → `updateOne({codigo}, { $push: { movimentacoes: {...} } })`.
  Precisa gerar `codigo` da movimentação (`MOV-...`) e validar campos obrigatórios.
- `addAlerta(codigoProduto, alerta)` → `$push` em `alertas`, com `codigo` gerado (`ALT-...`).
- `updateAlertaStatus(codigoProduto, codigoAlerta, novoStatus)` →
  `updateOne({codigo, "alertas.codigo": codigoAlerta}, { $set: { "alertas.$.status": novoStatus } })`
  (operador posicional `$`, não precisa de `arrayFilters` porque só há 1 elemento de match).
- `removeAlerta(codigoProduto, codigoAlerta)` → `$pull` em `alertas`.
- Reaproveitar `serialize()` e o padrão de retorno `{ operation, mongoCommand, ... }` já usado
  pelos outros métodos, para manter a mesma experiência de "evidência" no `evidencias.html`.

### `server.cjs`

Novas rotas (todas `requireAuth`), aninhadas sob o produto:

```text
POST   /mongo/produtos/:codigo/movimentacoes
POST   /mongo/produtos/:codigo/alertas
PUT    /mongo/produtos/:codigo/alertas/:codigoAlerta      (mudar status)
DELETE /mongo/produtos/:codigo/alertas/:codigoAlerta
```

### `frontend/mongo-web.js`

Wrappers equivalentes: `addMovimentacao(codigoProduto, doc)`, `addAlerta(codigoProduto, doc)`,
`updateAlertaStatus(codigoProduto, codigoAlerta, status)`, `removeAlerta(codigoProduto, codigoAlerta)`.

### `frontend/app.js` + `frontend/index.html`

Este é o grosso do trabalho:

- No painel de detalhe do produto (`renderDetails`), trocar a timeline e o card de alerta
  (hoje somente leitura) por componentes com ações: botão "Registrar movimentação" (abre um
  mini-formulário inline com `tipo`, `origem`, `destino`, `quantidade_informada`,
  `quantidade_confirmada`), e por alerta ativo, botões "Marcar como resolvido" / "Remover".
- Precisa de um mini-formulário novo (não reaproveita `ENTITY_FIELDS`, porque o "documento" aqui
  é o item do array, não o produto inteiro) — algo como `SUBRESOURCE_FIELDS.movimentacao` e
  `SUBRESOURCE_FIELDS.alerta`, com o mesmo `createModuleField` reutilizado se possível.
  Depois de submeter, chamar `loadData()` ou, melhor, só re-buscar aquele produto
  (`window.mongoCrud.findOne("produtos", codigo)`) e re-renderizar o painel de detalhe, para não
  recarregar a lista inteira.
- Na gestão de `usuarios`, trocar a listagem crua de `produtos_destinados`/`produtos_enviados`
  por uma tabela que, para cada item, busca (ou recebe já enriquecido pelo backend) o
  `status_atual` do produto referenciado — reaproveitando a mesma ideia do Pipeline 2 desta
  entrega (join `produtos_destinados.codigo` → `produtos.codigo`). Vale considerar expor isso
  como mais um endpoint de leitura (`GET /mongo/usuarios/:email/produtos-destinados-detalhado`)
  em vez de fazer N chamadas `findOne` no cliente.
- `frontend/styles.css`: novos estilos para os mini-formulários inline e para a tabela de
  produtos destinados/enviados (não deve ser preciso mexer no restante do arquivo).

### `database/seed_data.py`

Nenhuma mudança estrutural — o seed já gera o schema completo (`movimentacoes`, `alertas`,
`locais`, `nota_fiscal`). Só precisa continuar em sincronia se os novos endpoints mudarem o
formato de algum sub-documento.

## Riscos e decisões em aberto

- **Concorrência em `$push`/`$pull`**: como não há transações neste projeto, duas escritas
  simultâneas no mesmo produto podem intercalar sem conflito grave (arrays do MongoDB suportam
  `$push` concorrente), mas o `before`/`after` mostrado na UI pode ficar desatualizado entre a
  leitura e a escrita — aceitável para um projeto acadêmico de único operador por vez.
- **Geração de código do sub-recurso** (`MOV-...`, `ALT-...`): decidir se o código é gerado no
  servidor (mais seguro, evita colisão) ou sugerido no formulário e validado no servidor.
- **Sincronizar `produtos_destinados`/`produtos_enviados`** quando um produto muda de
  destinatário/remetente: hoje esses arrays são só o que o seed gerou; se o CRUD passar a
  permitir editar `usuarios_associados` de um produto, os arrays correspondentes nos documentos
  de `usuarios` ficariam desatualizados. Ou trata isso com uma escrita dupla (produto + os 2
  usuários afetados) ou aceita que esses arrays são apenas um cache "point-in-time" gerado pelo
  seed, recalculável por uma pipeline (poderia até virar uma 3ª aggregation pipeline com
  `$merge`, similar às desta entrega).

## Ordem sugerida de execução

1. `mongo-service.cjs` (métodos de sub-recurso) + `server.cjs` (rotas) — testável via `curl`
   antes de tocar em UI.
2. `frontend/mongo-web.js` (wrappers).
3. UI de alertas dentro do produto (maior valor, menor escopo: só "resolver"/"remover").
4. UI de movimentações dentro do produto (registrar uma nova).
5. Exibição enriquecida de `produtos_destinados`/`produtos_enviados` no usuário.
6. Reavaliar se vale a pena editar `nota_fiscal`/`locais` pela UI ou deixar como
  preenchimento automático do backend (hoje já funciona assim e cobre o caso de uso do INSERT).
