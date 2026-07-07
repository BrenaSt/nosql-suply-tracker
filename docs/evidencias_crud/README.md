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

O banco tem hoje só 2 coleções (schema embutido — ver `README.md` da raiz). Abrir cada uma no
Laboratório CRUD ou no MongoDB Compass e salvar em `colecoes/`:

```text
01-produtos.png
02-usuarios.png
```

## Evidência esperada

- `FIND`: retorno de `CAF-TRK-0001`;
- `INSERT`: contagem de produtos muda de 80 para 81;
- `UPDATE`: resultado mostra `before` e `after`;
- `DELETE`: contagem volta de 81 para 80;
- conexão: cabeçalho mostra `MongoDB conectado`;
- código: `mongo-service.cjs` mostra `find`, `insertOne`, `updateOne` e `deleteOne`.

As evidências das 2 aggregation pipelines novas (não fazem parte deste laboratório de CRUD)
ficam em [`../evidencias_agregacoes/`](../evidencias_agregacoes/README.md).
