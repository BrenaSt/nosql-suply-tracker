# Evidências das Aggregation Pipelines

Esta pasta comprova as 2 aggregation pipelines novas (ver [`README.md`](../../README.md#aggregation-pipelines)
na raiz do projeto) e os 2 índices que as sustentam.

## Logs (`logs/`)

Gerados rodando os scripts diretamente contra o Atlas (sem passar pelo navegador):

- `01-criacao-indices.log` — criação dos índices `alertas.status_gravidade` (`produtos`) e
  `ativo_setor` (`usuarios`), com a lista completa de índices de cada coleção depois da criação.
- `02-pipeline1-alertas-ativos.log` — `db.produtos.aggregate(...)` do Pipeline 1, com o pipeline
  completo, a contagem de alertas ativos encontrados e uma amostra do resultado.
- `03-pipeline2-auditoria-amostra.log` — `db.usuarios.aggregate(...)` do Pipeline 2, com o
  pipeline completo e o resultado da amostragem aleatória.
- `04-http-smoke-test.log` — as mesmas 2 pipelines chamadas pelas rotas HTTP reais
  (`GET /mongo/aggregations/alertas-ativos` e `GET /mongo/aggregations/auditoria-amostra`),
  com login autenticado via `/auth/login`, comprovando que o servidor local expõe as pipelines
  corretamente (e que o FIND de `produtos` continua funcionando).

## Telas (`telas/`)

Este ambiente não tinha uma extensão de navegador conectada para capturar screenshots
automaticamente. Para gerar as telas que faltam:

1. Rode `npm start` (ou `iniciar.cmd`) e faça login com a conta de demonstração.
2. Abra `http://127.0.0.1:5500/evidencias.html`.
3. Role até **Laboratório de Agregações** e clique em **Rodar pipeline de alertas** — salve o
   print como `01-agregacoes-alertas.png`.
4. Ajuste o "Tamanho da amostra" se quiser e clique em **Rodar pipeline de auditoria** — salve
   o print como `02-agregacoes-auditoria.png`.

## Índices novos

| Coleção  | Índice                                    | Sustenta                                              |
| -------- | ------------------------------------------ | ------------------------------------------------------ |
| produtos | `{ "alertas.status": 1, "alertas.gravidade": 1 }` | `$match` de pré-filtro e ordenação do Pipeline 1 |
| usuarios | `{ ativo: 1, setor: 1 }`                   | `$match { ativo: true }` inicial do Pipeline 2         |
