# Modelagem NoSQL: Hierarquia de Informações e Documentos por Coleção

**Universidade Federal de Uberlândia - Curso de Gestão da Informação**
**Disciplina: Banco de Dados NoSQL**
**Sistema: Rastreamento e Vigilância de Cadeia de Suprimentos**

---

## 1. Hierarquia de Informações e Agregações

A funcionalidade principal do sistema é rastrear a jornada de um produto ao longo de toda a cadeia de suprimentos identificando comportamentos suspeitos que possam indicar fraude, desvio ou perda. O sujeito central de todas as operações é o **produto**: é sobre ele que o sistema faz perguntas, é a partir dele que anomalias são detectadas.

Essa centralidade determina diretamente a hierarquia do modelo. No NoSQL orientado a documentos, a entidade sobre a qual o sistema realiza suas consultas mais frequentes e críticas deve ser o documento raiz. Como a pergunta fundamental do sistema é sempre *"onde está este produto, por onde ele passou e algo está errado?"*, a coleção `PRODUTO` ocupa o topo da hierarquia, e as demais entidades se organizam ao redor dela.

### 1.1 PRODUTO como documento raiz

O documento de produto concentra não apenas seus dados cadastrais, mas também o histórico completo de movimentações. 


### 1.2 Agregação por referência: LOCAL, USUARIO e NOTAS_FISCAIS

As entidades que possuem ciclo de vida independente do produto e são compartilhadas entre múltiplos registros são mantidas em coleções separadas, referenciadas por `ObjectId`:

- **LOCAL**: armazéns, fábricas e pontos de entrega são reutilizados por inúmeros produtos e movimentações. Manter `LOCAL` como referência evita redundância e permite consultas eficientes do tipo *"todos os produtos que passaram pelo armazém X"* sem varredura completa da coleção.

- **USUARIO**: operadores têm atributos que mudam ao longo do tempo — cargo, e-mail, setor. Se os dados do usuário fossem embutidos em cada movimentação, qualquer alteração de perfil exigiria atualização retroativa em todos os documentos históricos. A referência preserva o histórico intacto.

- **NOTAS_FISCAIS**: a detecção de reutilização fraudulenta de uma nota fiscal só é eficiente se essa coleção for independente, com índice único sobre o campo `numero`. Ao registrar uma nova movimentação, o sistema verifica instantaneamente se aquela nota já foi utilizada.

### 1.3 Resumo da hierarquia

| Coleção | Estratégia | Justificativa |
|---|---|---|
| PRODUTO | Documento raiz | Entidade central do sistema |
| MOVIMENTACOES | Coleção independente + agregação com PRODUTO | Tem dados próprios; referencia PRODUTO por `produto_id` |
| ALERTAS | Coleção independente + agregação com MOVIMENTACOES | Tem dados próprios; referencia MOVIMENTACOES por `movimentacao_id` |
| LOCAL | Coleção independente | Reutilizado; ciclo próprio |
| USUARIO | Coleção independente | Atributos mutáveis |
| NOTAS_FISCAIS | Coleção independente | Verificação de unicidade |


---

## 2. Descrição e Exemplo de Documento por Coleção

### Coleção: PRODUTO

Documento raiz do sistema. Concentra os dados cadastrais do produto e seu histórico completo de movimentações, cada uma com seus respectivos alertas embutidos. É a partir deste documento que o sistema responde às perguntas de rastreamento e detecta anomalias. Uma única leitura sobre o documento do produto fornece todo o contexto necessário para análise.

```json
{
  "_id": ObjectId("664a1f3c8b2e4d001a3c7e01"),
  "nome": "Café Orgânico 500g",
  "categoria": "alimentos",
  "fabricante": "Fazenda Minas Verdes LTDA",
  "movimentacoes": [
    {
      "local_id": ObjectId("664a1f3c8b2e4d001a3c7e20"),
      "usuario_id": ObjectId("664a1f3c8b2e4d001a3c7e40"),
      "nota_fiscal_id": ObjectId("664a1f3c8b2e4d001a3c7e55"),
      "data_hora": ISODate("2024-05-10T14:30:00Z"),
      "tipo": "saida",
      "status": "em_transito",
      "alertas": [
        {
          "tipo": "localizacao_suspeita",
          "descricao": "Produto saiu de rota esperada em 80 km",
          "data_hora": ISODate("2024-05-10T14:31:05Z"),
          "gravidade": "alta"
        }
      ]
    },
    {
      "local_id": ObjectId("664a1f3c8b2e4d001a3c7e21"),
      "usuario_id": ObjectId("664a1f3c8b2e4d001a3c7e41"),
      "nota_fiscal_id": ObjectId("664a1f3c8b2e4d001a3c7e56"),
      "data_hora": ISODate("2024-05-11T09:15:00Z"),
      "tipo": "entrada",
      "status": "armazenado",
      "alertas": []
    }
  ]
}
```

---

### Coleção: LOCAL

Registra os pontos físicos da cadeia de suprimentos: fábricas, armazéns, centros de distribuição e pontos de entrega. É referenciado pelo campo `local_id` dentro de cada subdocumento de movimentação. A separação em coleção própria permite consultas eficientes sobre todas as movimentações de um local específico e evita a duplicação de dados geográficos em cada evento registrado.

```json
{
  "_id": ObjectId("664a1f3c8b2e4d001a3c7e20"),
  "nome": "Armazém Central Uberlândia",
  "cidade": "Uberlândia",
  "estado": "MG",
  "tipo": "armazem"
}
```

---

### Coleção: USUARIO

Contém os dados dos operadores e responsáveis que registram movimentações no sistema. Mantida como coleção independente para que alterações de perfil, como mudança de cargo, e-mail ou setor, não exijam atualização retroativa nos documentos históricos de produtos. 

```json
{
  "_id": ObjectId("664a1f3c8b2e4d001a3c7e40"),
  "nome": "João da Silva",
  "cargo": "operador_armazem",
  "email": "joao.silva@empresa.com"
}
```

---

### Coleção: NOTAS_FISCAIS

Armazena os documentos fiscais vinculados às movimentações. A existência como coleção independente é essencial para uma das detecções centrais do sistema: a reutilização fraudulenta de uma nota fiscal. 

```json
{
  "_id": ObjectId("664a1f3c8b2e4d001a3c7e55"),
  "numero": "NF-2024-00187",
  "emissor": "Fazenda Minas Verdes LTDA",
  "data_emissao": ISODate("2024-05-09T08:00:00Z")
}
```

---

###Coleção: MOVIMENTACOES

A agregação acontece na consulta: quando o sistema precisa do histórico completo de um produto, ele busca todas as movimentações cujo produto_id bate com o produto em questão. PRODUTO continua sendo o documento raiz funcionalmente.

```json
{
  "local_id": ObjectId("664a1f3c8b2e4d001a3c7e20"),
  "usuario_id": ObjectId("664a1f3c8b2e4d001a3c7e40"),
  "nota_fiscal_id": ObjectId("664a1f3c8b2e4d001a3c7e55"),
  "data_hora": ISODate("2024-05-10T14:30:00Z"),
  "tipo": "saida",
  "status": "em_transito",
  "alertas": []
}
```

---

### Subdocumento: ALERTA (embutido em MOVIMENTACAO)

A agregação acontece na consulta: quando o sistema precisa do histórico completo de uma movimentação, que terá um alerta embutido por causa da agregação com a coleção ALERTAS.

```json
{
  "tipo": "nota_fiscal_duplicada",
  "descricao": "Nota NF-2024-00187 já utilizada na movimentação de 2024-05-08",
  "data_hora": ISODate("2024-05-10T14:31:05Z"),
  "gravidade": "critica"
}
```
