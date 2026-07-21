const neo4j = require("neo4j-driver");

const GRAPH_NAME = "supplyGraph";
const GRAPH_RELATIONSHIP_TYPES = ["ENVIOU", "RECEBEU", "DESTINATARIO_DE", "REGISTROU", "AUDITOU"];

// Implementacao iterativa do mesmo PageRank usado pelo GDS. Cada relacionamento e tratado
// como nao direcionado e relacionamentos paralelos contam separadamente, como na projecao GDS.
// O valor-base (1 - dampingFactor) preserva a escala dos scores retornados pelo Neo4j GDS.
function calculatePageRank(nodeIds, edges, options = {}) {
  const dampingFactor = Number(options.dampingFactor ?? 0.85);
  const maxIterations = Math.max(1, Number(options.maxIterations ?? 50));
  const tolerance = Math.max(0, Number(options.tolerance ?? 1e-8));
  const ids = [...new Set(nodeIds.map((id) => String(id)))];
  const adjacency = new Map(ids.map((id) => [id, []]));

  for (const edge of edges) {
    const source = String(edge.source);
    const target = String(edge.target);
    if (!adjacency.has(source) || !adjacency.has(target)) continue;
    adjacency.get(source).push(target);
    adjacency.get(target).push(source);
  }

  let scores = new Map(ids.map((id) => [id, 1]));
  let iterations = 0;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    iterations = iteration + 1;
    const nextScores = new Map(ids.map((id) => [id, 1 - dampingFactor]));

    for (const id of ids) {
      const neighbors = adjacency.get(id);
      if (!neighbors.length) continue;
      const contribution = (dampingFactor * scores.get(id)) / neighbors.length;
      for (const neighborId of neighbors) {
        nextScores.set(neighborId, nextScores.get(neighborId) + contribution);
      }
    }

    let difference = 0;
    for (const id of ids) difference += Math.abs(nextScores.get(id) - scores.get(id));
    scores = nextScores;
    if (difference <= tolerance) break;
  }

  return { scores, iterations };
}

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
    this.gdsAvailable = null;
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
  async topUsuariosPorPageRankFallback(session, safeLimit) {
    const nodesResult = await session.run(
      `MATCH (n)
       WHERE n:Usuario OR n:Produto
       RETURN elementId(n) AS id, labels(n) AS labels,
              n.email AS email, n.nome AS nome, n.setor AS setor, n.cargo AS cargo`,
    );
    const relationshipsResult = await session.run(
      `MATCH (source)-[relationship]->(target)
       WHERE type(relationship) IN $types
       RETURN elementId(source) AS source, elementId(target) AS target`,
      { types: GRAPH_RELATIONSHIP_TYPES },
    );

    const nodes = nodesResult.records.map((record) => ({
      id: record.get("id"),
      labels: record.get("labels"),
      email: record.get("email"),
      nome: record.get("nome"),
      setor: record.get("setor"),
      cargo: record.get("cargo"),
    }));
    const edges = relationshipsResult.records.map((record) => ({
      source: record.get("source"),
      target: record.get("target"),
    }));

    if (!nodes.length || !edges.length) {
      return { available: true, documents: [], engine: "nodejs-pagerank", iterations: 0 };
    }

    const pageRank = calculatePageRank(
      nodes.map((node) => node.id),
      edges,
    );
    const documents = nodes
      .filter((node) => node.labels.includes("Usuario"))
      .map((node) => ({ ...node, rawScore: pageRank.scores.get(String(node.id)) || 0 }))
      .sort((first, second) => second.rawScore - first.rawScore || String(first.email).localeCompare(String(second.email)))
      .slice(0, safeLimit)
      .map(({ id, labels, rawScore, ...node }) => ({
        ...node,
        score: Number(rawScore.toFixed(4)),
      }));

    return {
      available: true,
      documents,
      engine: "nodejs-pagerank",
      iterations: pageRank.iterations,
    };
  }

  async topUsuariosPorPageRank(limit = 10) {
    const driver = await this.connect();
    if (!driver) return { available: false, documents: [] };

    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const session = driver.session();
    try {
      if (this.gdsAvailable !== false) {
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
          this.gdsAvailable = true;
          return { available: true, documents, engine: "neo4j-gds" };
        } catch (error) {
          await session.run("CALL gds.graph.drop($name, false) YIELD graphName RETURN graphName", { name: GRAPH_NAME }).catch(() => {});
          this.gdsAvailable = false;
          console.warn(`Neo4j GDS indisponivel (${error.code || error.message}); usando PageRank compativel no Node.js.`);
        }
      }

      return await this.topUsuariosPorPageRankFallback(session, safeLimit);
    } catch (error) {
      return { available: false, documents: [], error: error.message };
    } finally {
      await session.close();
    }
  }

  async close() {
    if (this.driver) await this.driver.close();
    this.driver = null;
    this.gdsAvailable = null;
  }
}

module.exports = { Neo4jService, calculatePageRank };
