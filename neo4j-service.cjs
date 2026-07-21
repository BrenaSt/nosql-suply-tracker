const neo4j = require("neo4j-driver");

const GRAPH_NAME = "supplyGraph";

// Mesmo padrao de conexao unica reutilizavel do MongoService/RedisService: cria 1 driver e
// reusa em todas as chamadas. O Neo4j nunca e a fonte oficial dos dados — ele e alimentado a
// partir do MongoDB via syncFromMongo(); qualquer falha de conexao vira "indisponivel", sem
// derrubar o servidor.
class Neo4jService {
  constructor() {
    this.uri = process.env.NEO4J_URI;
    this.user = process.env.NEO4J_USER;
    this.password = process.env.NEO4J_PASSWORD;
    this.driver = null;
    this.connecting = null;
  }

  async connect() {
    if (!this.uri || !this.user || !this.password) return null;
    if (this.driver) return this.driver;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      try {
        const driver = neo4j.driver(this.uri, neo4j.auth.basic(this.user, this.password), {
          connectionTimeout: 5000,
        });
        await driver.verifyConnectivity();
        this.driver = driver;
        return driver;
      } catch (error) {
        this.driver = null;
        return null;
      } finally {
        this.connecting = null;
      }
    })();

    return this.connecting;
  }

  async status() {
    const driver = await this.connect();
    return { available: Boolean(driver), uri: this.uri ? "configurado" : "nao configurado" };
  }

  // Reconstroi o grafo do zero a partir das 2 colecoes reais do Mongo (produtos, usuarios).
  // O Mongo continua sendo a fonte oficial: isto e so uma projecao para analise de rede.
  async syncFromMongo(mongoService) {
    const driver = await this.connect();
    if (!driver) return { available: false };

    const produtos = await mongoService.list("produtos", { limit: 500 });
    const usuarios = await mongoService.list("usuarios", { limit: 500 });

    const enviou = [];
    const recebeu = [];
    const destinatarioDe = [];
    const registrou = [];
    const auditou = [];

    for (const produto of produtos) {
      const associados = produto.usuarios_associados || {};
      if (associados.remetente?.email) enviou.push({ email: associados.remetente.email, codigo: produto.codigo });
      if (associados.recebedor?.email) recebeu.push({ email: associados.recebedor.email, codigo: produto.codigo });
      if (associados.destinatario?.email) destinatarioDe.push({ email: associados.destinatario.email, codigo: produto.codigo });
      for (const movimentacao of produto.movimentacoes || []) {
        if (movimentacao.usuario_responsavel?.email) {
          registrou.push({ email: movimentacao.usuario_responsavel.email, codigo: produto.codigo });
        }
      }
      for (const alerta of produto.alertas || []) {
        if (alerta.responsavel_auditoria?.email) {
          auditou.push({ email: alerta.responsavel_auditoria.email, codigo: produto.codigo });
        }
      }
    }

    const session = driver.session();
    try {
      await session.executeWrite(async (tx) => {
        await tx.run("MATCH (n) DETACH DELETE n");

        await tx.run(
          `UNWIND $usuarios AS u
           MERGE (n:Usuario {email: u.email})
           SET n.nome = u.nome, n.perfil = u.perfil, n.setor = u.setor, n.cargo = u.cargo`,
          { usuarios: usuarios.map((u) => ({ email: u.email, nome: u.nome, perfil: u.perfil, setor: u.setor, cargo: u.cargo })) },
        );

        await tx.run(
          `UNWIND $produtos AS p
           MERGE (n:Produto {codigo: p.codigo})
           SET n.nome = p.nome, n.categoria = p.categoria, n.status_atual = p.status_atual`,
          { produtos: produtos.map((p) => ({ codigo: p.codigo, nome: p.nome, categoria: p.categoria, status_atual: p.status_atual })) },
        );

        const relationshipQuery = (type) => `
          UNWIND $rows AS row
          MATCH (u:Usuario {email: row.email})
          MATCH (p:Produto {codigo: row.codigo})
          MERGE (u)-[:${type}]->(p)
        `;
        if (enviou.length) await tx.run(relationshipQuery("ENVIOU"), { rows: enviou });
        if (recebeu.length) await tx.run(relationshipQuery("RECEBEU"), { rows: recebeu });
        if (destinatarioDe.length) await tx.run(relationshipQuery("DESTINATARIO_DE"), { rows: destinatarioDe });
        if (registrou.length) await tx.run(relationshipQuery("REGISTROU"), { rows: registrou });
        if (auditou.length) await tx.run(relationshipQuery("AUDITOU"), { rows: auditou });
      });

      return {
        available: true,
        usuarios: usuarios.length,
        produtos: produtos.length,
        relacionamentos: enviou.length + recebeu.length + destinatarioDe.length + registrou.length + auditou.length,
      };
    } finally {
      await session.close();
    }
  }

  // PageRank sobre a rede Usuario<->Produto: identifica os usuarios mais centrais nas
  // operacoes (envio, recebimento, movimentacao, auditoria) — util para priorizar auditoria.
  async topUsuariosPorPageRank(limit = 10) {
    const driver = await this.connect();
    if (!driver) return { available: false, documents: [] };

    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const session = driver.session();
    try {
      await session.run("CALL gds.graph.drop($name, false) YIELD graphName RETURN graphName", { name: GRAPH_NAME }).catch(() => {});
      // Orientation UNDIRECTED: as arestas reais so vao Usuario -> Produto (quem enviou,
      // recebeu, auditou etc.), entao sem isso todo produto acumularia rank e todo usuario
      // ficaria preso no score-base (sem nenhuma aresta de entrada). Tratando como nao
      // direcionado, a centralidade flui nos dois sentidos da rede bipartida.
      await session.run(
        `CALL gds.graph.project(
           $name,
           ['Usuario', 'Produto'],
           {
             ENVIOU: { orientation: 'UNDIRECTED' },
             RECEBEU: { orientation: 'UNDIRECTED' },
             DESTINATARIO_DE: { orientation: 'UNDIRECTED' },
             REGISTROU: { orientation: 'UNDIRECTED' },
             AUDITOU: { orientation: 'UNDIRECTED' }
           }
         ) YIELD graphName`,
        { name: GRAPH_NAME },
      );

      const result = await session.run(
        `CALL gds.pageRank.stream($name)
         YIELD nodeId, score
         WITH gds.util.asNode(nodeId) AS node, score
         WHERE node:Usuario
         RETURN node.email AS email, node.nome AS nome, node.setor AS setor, node.cargo AS cargo, score
         ORDER BY score DESC
         LIMIT ${safeLimit}`,
        { name: GRAPH_NAME },
      );

      const documents = result.records.map((record) => ({
        email: record.get("email"),
        nome: record.get("nome"),
        setor: record.get("setor"),
        cargo: record.get("cargo"),
        score: Number(record.get("score").toFixed(4)),
      }));

      await session.run("CALL gds.graph.drop($name, false) YIELD graphName RETURN graphName", { name: GRAPH_NAME }).catch(() => {});
      return { available: true, documents };
    } catch (error) {
      return { available: false, documents: [], error: error.message };
    } finally {
      await session.close();
    }
  }

  async close() {
    if (this.driver) await this.driver.close();
    this.driver = null;
  }
}

module.exports = { Neo4jService };
