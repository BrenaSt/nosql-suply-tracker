# 📦 Sistema de Rastreamento e Vigilância de Cadeia de Suprimentos

> Projeto acadêmico desenvolvido para a disciplina de **Banco de Dados NoSQL**  
> Curso de **Gestão da Informação (GI)** — Universidade Federal de Uberlândia (UFU)

---

## Sobre o Projeto

Este sistema tem como objetivo acompanhar a movimentação de produtos ao longo de toda a cadeia de suprimentos — da fábrica até o cliente final — identificando automaticamente comportamentos suspeitos que possam indicar irregularidades como fraudes, desvios ou perdas.

### Exemplo prático

> Uma caixa de café orgânico sai de uma fábrica em **Minas Gerais**, passa por um armazém em **Uberlândia** e chega a uma loja em **Ribeirão Preto**.  
> Cada etapa é registrada. Se o produto sumir no meio do caminho, aparecer em dois lugares ao mesmo tempo ou seguir um trajeto inconsistente, o sistema **dispara um alerta imediatamente**.

---

## Problema

Em operações logísticas de grande escala, o mapeamento e a verificação manual de movimentações de produtos individuais tornam-se extremamente complexos. Anomalias ocorrem justamente pela dificuldade em rastrear todas as pequenas alterações ao longo de uma cadeia de suprimentos.

Exemplos de irregularidades que passam despercebidas em sistemas tradicionais:

- Funcionário que desvia uma mercadoria
- Nota fiscal utilizada mais de uma vez
- Produto que aparece em localização inesperada
- Saída de estoque fora do horário permitido

---

## Solução

O sistema automatiza a vigilância da cadeia de suprimentos, analisando cada registro e comparando-o com padrões esperados. Quando algo foge do normal, um alarme é emitido em tempo real.

O fluxo de funcionamento ocorre em **3 etapas**:

### 1. Registro de Movimentação
Cada movimentação de um produto é registrada como um documento no banco de dados, contendo:

- Identificação do produto
- Estado atual (em trânsito, armazenado, entregue etc.)
- Localização
- Data e hora do registro
- Responsável pelo registro

### 2. Análise e Verificação
A cada novo registro, o sistema verifica se o dado faz sentido em relação ao histórico do produto. São analisados fatores como:

- Produto em dois lugares ao mesmo tempo
- Deslocamento geograficamente incoerente
- Saída de estoque fora do horário esperado
- Divergência de quantidades
- Reutilização de nota fiscal
- Comportamento atípico de um funcionário

### 3. Emissão de Alertas
Quando uma anomalia é detectada, o sistema:

- Emite um alarme imediato
- Notifica os responsáveis
- Marca o registro como suspeito para auditoria posterior

---

## Por que Banco de Dados NoSQL?

A cadeia de suprimentos lida com informações altamente variadas: produtos diferentes, fornecedores de países distintos, cada um com suas próprias exigências e documentação. O NoSQL foi escolhido por:

- **Flexibilidade de esquema** — adapta-se facilmente a novos tipos de dados sem necessidade de reescrever o sistema
- **Escalabilidade horizontal** — novos servidores podem ser adicionados à medida que o volume de registros cresce, sem grandes ajustes de infraestrutura
- **Alta performance em leitura/escrita** — essencial para análise em tempo real de grandes volumes de movimentações

---

## Público-Alvo

O sistema foi projetado para atender diferentes perfis profissionais:

| Perfil | Benefício Principal |
|---|---|
| Gestores de Logística | Visibilidade completa da cadeia em tempo real |
| Auditores | Histórico detalhado e marcações de suspeita para auditoria |
| Operadores de Armazém | Registros simplificados e alertas de inconsistência |
| Diretores Financeiros | Redução de perdas e prevenção de fraudes |

---

## Estrutura do Projeto (ainda em desenvolvimento)

```
/
├── docs/               # Documentação do projeto
├── src/
│   ├── registro/       # Módulo de registro de movimentações
│   ├── analise/        # Módulo de análise e detecção de anomalias
│   └── alertas/        # Módulo de emissão de alertas e notificações
├── database/           # Configurações e schemas do banco NoSQL
└── README.md
```

---

## Informações Acadêmicas

| | |
|---|---|
| **Instituição** | Universidade Federal de Uberlândia (UFU) |
| **Curso** | Gestão da Informação (GI) |
| **Disciplina** | Banco de Dados NoSQL |

---

## Licença

Este projeto é de caráter acadêmico e desenvolvido exclusivamente para fins educacionais no âmbito da UFU.