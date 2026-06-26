# Instruções de implementação - site Origem Certa com MongoDB

## 1. Arquitetura

O projeto é executado como site local:

```text
Navegador
-> http://127.0.0.1:5500
-> servidor Node.js local
-> driver mongodb
-> MongoDB Atlas
```

O usuário acessa o sistema pelo navegador. O servidor local é necessário para impedir que a senha do MongoDB fique exposta no HTML ou no JavaScript público.

O servidor também controla a autenticação. Depois do login, ele cria um cookie de sessão `HttpOnly`.
Sem esse cookie, as rotas das coleções retornam o código HTTP `401` e não permitem consultar ou
modificar os documentos.

Não são utilizados:

- FastAPI;
- Render;
- Electron;
- hospedagem externa para o backend.

## 2. Protótipo da interface

Arquivos:

```text
frontend/index.html
frontend/styles.css
frontend/app.js
```

A interface possui abas para:

- rastreamento;
- contas;
- produtos;
- alertas;
- movimentações;
- lotes;
- locais;
- notas fiscais.

Os campos dos formulários são definidos no objeto `ENTITY_FIELDS` de `app.js`.

```js
produtos: [
  { name: "codigo", label: "Código do produto", required: true },
  { name: "nome", label: "Nome do produto", required: true },
  { name: "lote", label: "Lote", source: "lotes", required: true }
]
```

A função `renderModuleForm()` cria os inputs conforme a coleção e a função `handleModuleSubmit()` envia INSERT, UPDATE ou DELETE.

## 3. Criação e população das coleções

Arquivo:

```text
database/seed_data.py
```

Conexão:

```python
client = AsyncIOMotorClient(MONGODB_URI)
db = client[MONGODB_DB]
```

População:

```python
collection = db[collection_name]
await collection.delete_many({})
await collection.insert_many(documents)
```

Coleções criadas:

| Coleção | Quantidade | Chave |
|---|---:|---|
| produtos | 120 | codigo |
| lotes | 120 | codigo |
| movimentacoes | 240 | codigo |
| alertas | 120 | codigo |
| locais | 120 | nome |
| notas_fiscais | 120 | numero |
| usuarios | 5 | email |

Índices:

```python
await db.produtos.create_index("codigo", unique=True)
await db.lotes.create_index("codigo", unique=True)
await db.movimentacoes.create_index("codigo", unique=True)
await db.alertas.create_index("codigo", unique=True)
await db.locais.create_index("nome", unique=True)
await db.notas_fiscais.create_index("numero", unique=True)
await db.usuarios.create_index("email", unique=True)
```

## 4. Servidor local do site

Arquivo:

```text
server.cjs
```

O servidor publica a pasta `frontend`:

```js
app.use(express.static(path.join(__dirname, "frontend")));
```

O navegador é aberto em:

```text
http://127.0.0.1:5500
```

Os caminhos `/mongo/...` só existem no computador local e encaminham as operações para `mongo-service.cjs`.

## 5. Conexão do site

O arquivo:

```text
frontend/mongo-web.js
```

expõe à interface:

```js
window.mongoCrud = {
  list,
  findOne,
  insert,
  update,
  remove
};
```

Exemplo:

```js
window.mongoCrud.insert("produtos", documento);
```

O código envia o documento ao servidor local:

```js
fetch("/mongo/collections/produtos", {
  method: "POST",
  body: JSON.stringify(documento)
});
```

## 6. FIND

Implementação real em `mongo-service.cjs`:

```js
async findDocuments(collectionName, options = {}) {
  const collection = await this.collection(collectionName);
  const documents = await collection
    .find(filter)
    .sort(config.sort)
    .limit(limit)
    .toArray();

  return {
    operation: "FIND",
    mongoCommand: `db.${config.mongoName}.find(${JSON.stringify(filter)})`,
    count: documents.length,
    documents
  };
}
```

Na tela de rastreamento, o navegador chama explicitamente:

```js
const result = await window.mongoCrud.find("produtos", {
  query: codigoNomeOuLote,
  limit: 500
});
```

Consulta por chave:

```js
const document = await collection.findOne({
  [config.key]: keyValue
});
```

## 7. INSERT

```js
const result = await collection.insertOne(payload);
```

O retorno apresenta:

- `acknowledged`;
- `insertedId`;
- documento inserido;
- chave natural;
- quantidade afetada.

## 8. UPDATE

Documento anterior:

```js
const before = await collection.findOne({
  [config.key]: keyValue
});
```

Atualização:

```js
const result = await collection.updateOne(
  { [config.key]: keyValue },
  { $set: payload }
);
```

Documento posterior:

```js
const after = await collection.findOne({
  [config.key]: keyValue
});
```

A tela exibe `before`, `after`, `matched` e `modified`.

## 9. DELETE

```js
const result = await collection.deleteOne({
  [config.key]: keyValue
});
```

O documento é consultado antes da exclusão para aparecer como evidência.

## 10. Laboratório CRUD

Arquivos:

```text
frontend/evidencias.html
frontend/evidencias.css
frontend/evidencias.js
```

A tela apresenta:

- status da conexão;
- contagem das coleções;
- seletor da coleção;
- FIND, INSERT, UPDATE e DELETE;
- comando MongoDB correspondente;
- JSON retornado;
- documentos da coleção;
- histórico da sessão.

## 11. Como executar

```cmd
cd "C:\Users\jessi\OneDrive\Documentos\prova bdnosql\origem-certa-mongodb"
npm install
npm start
```

Ou abra:

```text
iniciar.cmd
```

O inicializador não depende de `npm` estar disponível no `PATH`. Ele procura automaticamente o executável Node existente no ambiente do Codex.

## 12. Como demonstrar

1. Abra o site.
2. Confirme a mensagem `MongoDB conectado`.
3. Abra `Laboratório CRUD`.
4. Execute FIND para `CAF-TRK-0001`.
5. Execute INSERT de `PROD-EVIDENCIA-0001`.
6. Confira que produtos passa de 120 para 121.
7. Execute UPDATE e mostre `before` e `after`.
8. Execute DELETE.
9. Confira que produtos volta para 120.
10. Mostre os documentos também no MongoDB Atlas ou Compass.

## 13. Arquivos que comprovam os requisitos

| Requisito | Arquivos |
|---|---|
| Protótipo | `frontend/index.html`, `frontend/styles.css`, `frontend/app.js` |
| População | `database/seed_data.py` |
| Conexão | `server.cjs`, `mongo-service.cjs`, `frontend/mongo-web.js` |
| CRUD | `mongo-service.cjs` |
| Tela de comprovação | `frontend/evidencias.html`, `frontend/evidencias.js` |
