# Evidências CRUD com MongoDB

Os prints desta versão devem ser realizados com o site local conectado ao MongoDB.

## Telas

Salvar em `telas/`:

```text
01-interface-principal.png
02-find-produto.png
03-insert-produto.png
04-update-produto.png
05-delete-produto.png
```

## Coleções

Abrir cada coleção no Laboratório CRUD ou no MongoDB Compass e salvar em `colecoes/`:

```text
01-produtos.png
02-lotes.png
03-movimentacoes.png
04-alertas.png
05-locais.png
06-notas-fiscais.png
07-usuarios.png
```

## Evidência esperada

- `FIND`: retorno de `CAF-TRK-0001`;
- `INSERT`: contagem de produtos muda de 120 para 121;
- `UPDATE`: resultado mostra `before` e `after`;
- `DELETE`: contagem volta de 121 para 120;
- conexão: cabeçalho mostra `MongoDB conectado`;
- código: `mongo-service.cjs` mostra `find`, `insertOne`, `updateOne` e `deleteOne`.
