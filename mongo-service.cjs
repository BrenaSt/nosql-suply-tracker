const path = require("node:path");
const fs = require("node:fs");
const dns = require("node:dns");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

const COLLECTIONS = {
  produtos: { mongoName: "produtos", key: "codigo", sort: { nome: 1 } },
  usuarios: { mongoName: "usuarios", key: "email", sort: { nome: 1 } },
};

const SEARCH_FIELDS = {
  produtos: ["codigo", "nome", "fabricante", "categoria", "status_atual"],
  usuarios: ["email", "login", "nome", "perfil", "setor"],
};

function loadEnvironment(projectDirectory) {
  const projectEnv = path.join(projectDirectory, ".env");
  const fallbackEnv = path.join(projectDirectory, "..", "backend", ".env");

  if (fs.existsSync(projectEnv)) {
    dotenv.config({ path: projectEnv, override: false, quiet: true });
    return [projectEnv];
  }
  if (fs.existsSync(fallbackEnv)) {
    dotenv.config({ path: fallbackEnv, override: false, quiet: true });
    return [fallbackEnv];
  }
  return [];
}

function configureDnsForMongo() {
  const configured = String(process.env.MONGODB_DNS_SERVERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (configured.length) {
    dns.setServers(configured);
    return configured;
  }

  const currentServers = dns.getServers();
  const onlyLoopback =
    currentServers.length === 0 ||
    currentServers.every((server) => ["127.0.0.1", "::1"].includes(server));
  if (!onlyLoopback || process.platform !== "win32") return currentServers;

  try {
    const output = execFileSync("ipconfig", ["/all"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const lines = output.split(/\r?\n/);
    const detected = [];
    let readingDns = false;

    for (const line of lines) {
      if (/DNS Servers|Servidores DNS/i.test(line)) {
        readingDns = true;
      } else if (readingDns && line.trim() && !/^\s+/.test(line)) {
        readingDns = false;
      }
      if (!readingDns) continue;

      const addresses = line.match(
        /(?<![\da-f:])(?:\d{1,3}\.){3}\d{1,3}(?![\da-f:])|(?<![\da-f:])(?:[a-f\d]{0,4}:){2,}[a-f\d:]+/gi,
      );
      for (const address of addresses || []) {
        if (!["127.0.0.1", "::1"].includes(address) && !detected.includes(address)) {
          detected.push(address);
        }
      }
    }

    if (detected.length) dns.setServers(detected);
    return detected.length ? detected : currentServers;
  } catch (error) {
    return currentServers;
  }
}

function serialize(value) {
  if (Array.isArray(value)) return value.map(serialize);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (["_id", "senha", "senha_hash"].includes(key)) continue;
      result[key] = serialize(item);
    }
    return result;
  }
  return value;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash = "") {
  const [salt, expectedHex] = String(storedHash).split(":");
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function safeTextEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

// Pipeline 1: relatorio de alertas ativos (produtos.alertas embutido), enriquecido com o
// cadastro atual do auditor responsavel (a copia embutida no alerta fica congelada no tempo).
function buildAlertasAtivosPipeline() {
  return [
    { $match: { "alertas.status": { $ne: "resolvido" } } },
    { $unwind: "$alertas" },
    { $match: { "alertas.status": { $ne: "resolvido" } } },
    {
      $lookup: {
        from: "usuarios",
        localField: "alertas.responsavel_auditoria.email",
        foreignField: "email",
        as: "auditor_atual",
      },
    },
    { $unwind: { path: "$auditor_atual", preserveNullAndEmptyArrays: true } },
    {
      $set: {
        gravidade_peso: {
          $switch: {
            branches: [
              { case: { $eq: ["$alertas.gravidade", "alta"] }, then: 3 },
              { case: { $eq: ["$alertas.gravidade", "media"] }, then: 2 },
            ],
            default: 1,
          },
        },
        dias_em_aberto: {
          $dateDiff: { startDate: { $toDate: "$alertas.data_emissao" }, endDate: "$$NOW", unit: "day" },
        },
      },
    },
    {
      $project: {
        _id: "$alertas.codigo",
        produto_codigo: "$codigo",
        produto_nome: "$nome",
        categoria: 1,
        alerta_codigo: "$alertas.codigo",
        tipo: "$alertas.tipo",
        descricao: "$alertas.descricao",
        gravidade: "$alertas.gravidade",
        gravidade_peso: 1,
        status: "$alertas.status",
        dias_em_aberto: 1,
        local_desejado: "$alertas.local_desejado",
        local_registrado: "$alertas.local_registrado",
        auditor: {
          nome: "$auditor_atual.nome",
          email: "$auditor_atual.email",
          cargo: "$auditor_atual.cargo",
          setor: "$auditor_atual.setor",
        },
      },
    },
    { $sort: { gravidade_peso: -1, dias_em_aberto: -1 } },
    {
      $merge: {
        into: "relatorio_alertas_ativos",
        whenMatched: "replace",
        whenNotMatched: "insert",
      },
    },
  ];
}

// Pipeline 2: auditoria por amostragem — sorteia usuarios ativos e calcula a exposicao deles
// a produtos "em risco" (status em_alerta ou com alerta nao resolvido).
function buildAuditoriaAmostraPipeline(tamanhoAmostra) {
  return [
    { $match: { ativo: true } },
    { $sample: { size: tamanhoAmostra } },
    { $unwind: "$produtos_destinados" },
    {
      $lookup: {
        from: "produtos",
        localField: "produtos_destinados.codigo",
        foreignField: "codigo",
        as: "produto_info",
      },
    },
    { $unwind: "$produto_info" },
    {
      $set: {
        em_risco: {
          $or: [
            { $eq: ["$produto_info.status_atual", "em_alerta"] },
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $ifNull: ["$produto_info.alertas", []] },
                      cond: { $ne: ["$$this.status", "resolvido"] },
                    },
                  },
                },
                0,
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: { email: "$email", nome: "$nome", setor: "$setor", cargo: "$cargo" },
        total_produtos_destinados: { $sum: 1 },
        produtos_em_risco: { $sum: { $cond: ["$em_risco", 1, 0] } },
        produtos_risco_detalhe: {
          $push: {
            $cond: [
              "$em_risco",
              { codigo: "$produto_info.codigo", nome: "$produto_info.nome", status_atual: "$produto_info.status_atual" },
              "$$REMOVE",
            ],
          },
        },
      },
    },
    {
      $set: {
        percentual_risco: {
          $round: [{ $multiply: [{ $divide: ["$produtos_em_risco", "$total_produtos_destinados"] }, 100] }, 1],
        },
      },
    },
    { $match: { produtos_em_risco: { $gt: 0 } } },
    { $sort: { percentual_risco: -1 } },
    {
      $project: {
        _id: "$_id.email",
        email: "$_id.email",
        nome: "$_id.nome",
        setor: "$_id.setor",
        cargo: "$_id.cargo",
        total_produtos_destinados: 1,
        produtos_em_risco: 1,
        percentual_risco: 1,
        produtos_risco_detalhe: 1,
        data_amostragem: "$$NOW",
      },
    },
    {
      $merge: {
        into: "auditoria_amostras_risco",
        whenMatched: "replace",
        whenNotMatched: "insert",
      },
    },
  ];
}

class MongoService {
  constructor(projectDirectory) {
    this.envPaths = loadEnvironment(projectDirectory);
    this.dnsServers = configureDnsForMongo();
    this.uri = process.env.MONGODB_URI;
    this.databaseName = process.env.MONGODB_DB || "origem-certa";
    this.client = null;
    this.database = null;
  }

  config(collectionName) {
    const config = COLLECTIONS[collectionName];
    if (!config) throw new Error(`Colecao nao permitida: ${collectionName}`);
    return config;
  }

  async connect() {
    if (this.database) return this.database;
    if (!this.uri) {
      throw new Error(
        "MONGODB_URI nao encontrada. Crie origem-certa-mongodb/.env ou mantenha backend/.env no projeto original.",
      );
    }
    this.client = new MongoClient(this.uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    await this.client.connect();
    this.database = this.client.db(this.databaseName);
    await this.database.command({ ping: 1 });
    return this.database;
  }

  async collection(collectionName) {
    const database = await this.connect();
    const config = this.config(collectionName);
    return database.collection(config.mongoName);
  }

  async status() {
    try {
      await this.connect();
      return {
        connected: true,
        database: this.databaseName,
        source: this.envPaths.length
          ? this.envPaths.map((item) => path.basename(path.dirname(item)) + "/.env").join(", ")
          : "variavel de ambiente",
        dns: this.dnsServers,
      };
    } catch (error) {
      return { connected: false, database: this.databaseName, error: error.message };
    }
  }

  // Cria (de forma idempotente) os indices que sustentam as 2 aggregation pipelines novas.
  // Os demais indices (codigo, email, login, etc.) ja existem no Atlas e sao recriados pelo
  // database/seed_data.py quando o banco e populado do zero.
  async ensureIndexes() {
    const database = await this.connect();
    await database.collection("produtos").createIndex(
      { "alertas.status": 1, "alertas.gravidade": 1 },
      { name: "alertas.status_gravidade" },
    );
    await database.collection("usuarios").createIndex(
      { ativo: 1, setor: 1 },
      { name: "ativo_setor" },
    );
  }

  async authenticateUser(identifier, password) {
    const demoLogin = process.env.DEMO_ADMIN_USER || "admin";
    const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
    const normalized = String(identifier || "").trim().toLowerCase();
    if (
      demoPassword &&
      safeTextEqual(normalized, demoLogin.toLowerCase()) &&
      safeTextEqual(password, demoPassword)
    ) {
      return {
        login: demoLogin,
        email: process.env.DEMO_ADMIN_EMAIL || "admin@origemcerta.local",
        nome: "Administrador Origem Certa",
        cargo: "Administrador do sistema",
        perfil: "gestor",
        ativo: true,
        setor: "administracao",
      };
    }

    const database = await this.connect();
    const user = await database.collection("usuarios").findOne({
      $or: [{ login: normalized }, { email: normalized }],
    });

    if (!user || user.ativo === false || !verifyPassword(password, user.senha_hash)) {
      return null;
    }
    return serialize(user);
  }

  async registerUser(data) {
    const login = String(data.login || "").trim().toLowerCase();
    const email = String(data.email || "").trim().toLowerCase();
    const nome = String(data.nome || "").trim();
    const senha = String(data.senha || "");

    if (!/^[\p{L}\p{N}._-]{2,50}$/u.test(login)) {
      throw new Error("O usuário deve ter de 2 a 50 caracteres, sem espaços.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Informe um e-mail válido.");
    }
    if (nome.length < 3) {
      throw new Error("Informe o nome completo.");
    }
    if (senha.length < 4) {
      throw new Error("A senha deve ter pelo menos 4 caracteres.");
    }

    return this.insert("usuarios", {
      login,
      email,
      nome,
      senha,
      cargo: "Usuário da plataforma",
      perfil: "operador",
      ativo: true,
      setor: "operacao",
    });
  }

  prepareDocument(collectionName, document, existing = null) {
    const payload = { ...document };

    if (collectionName === "usuarios") {
      const password = String(payload.senha || "").trim();
      delete payload.senha;
      delete payload.senha_hash;
      if (password) {
        payload.senha_hash = hashPassword(password);
      } else if (existing?.senha_hash) {
        payload.senha_hash = existing.senha_hash;
      }
      if (payload.login) payload.login = String(payload.login).trim().toLowerCase();
      if (payload.email) payload.email = String(payload.email).trim().toLowerCase();
      if (!existing) {
        payload.produtos_destinados = payload.produtos_destinados || [];
        payload.produtos_enviados = payload.produtos_enviados || [];
      }
      return payload;
    }

    if (collectionName === "produtos" && !existing) {
      // Um produto novo precisa de nota_fiscal.numero (indice unico) e das estruturas
      // embutidas do schema atual, mesmo quando o formulario so envia os campos basicos.
      const codigo = String(payload.codigo || `PROD-${Date.now()}`).toUpperCase();
      payload.nota_fiscal = payload.nota_fiscal || {
        numero: `NF-${codigo}`,
        emissor: payload.fabricante || "",
        destinatario: "",
        data_emissao: new Date().toISOString(),
        quantidade_declarada: 0,
        valor_total: 0,
        status_validacao: "em_analise",
      };
      payload.locais = payload.locais || {
        origem: null,
        destino: null,
        local_desejado: null,
        atual: null,
      };
      payload.usuarios_associados = payload.usuarios_associados || {};
      payload.movimentacoes = payload.movimentacoes || [];
      payload.alertas = payload.alertas || [];
    }

    return serialize(payload);
  }

  async stats() {
    const produtos = await this.collection("produtos");
    const [produtosRastreados, produtosAutenticados, alertasResolvidos, fraudesBloqueadas] = await Promise.all([
      produtos.countDocuments({}),
      produtos.countDocuments({ status_atual: "autenticado" }),
      produtos
        .aggregate([{ $unwind: "$alertas" }, { $match: { "alertas.status": "resolvido" } }, { $count: "total" }])
        .toArray()
        .then((rows) => rows[0]?.total || 0),
      produtos
        .aggregate([
          { $unwind: "$alertas" },
          { $match: { "alertas.status": "resolvido", "alertas.gravidade": "alta" } },
          { $count: "total" },
        ])
        .toArray()
        .then((rows) => rows[0]?.total || 0),
    ]);
    return {
      produtos_rastreados: produtosRastreados,
      produtos_autenticados: produtosAutenticados,
      alertas_analisados: alertasResolvidos,
      tentativas_fraude_bloqueadas: fraudesBloqueadas,
    };
  }

  async summary() {
    const database = await this.connect();
    const entries = await Promise.all(
      Object.entries(COLLECTIONS).map(async ([name, config]) => [
        name,
        await database.collection(config.mongoName).countDocuments({}),
      ]),
    );
    return Object.fromEntries(entries);
  }

  async findDocuments(collectionName, options = {}) {
    const config = this.config(collectionName);
    const collection = await this.collection(collectionName);
    const limit = Math.min(Math.max(Number(options.limit || 200), 1), 500);
    let filter = {};

    if (options.query) {
      const escaped = String(options.query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: escaped, $options: "i" };
      const fields = SEARCH_FIELDS[collectionName] || [];
      filter.$or = fields.map((field) => ({ [field]: regex }));
    }

    const documents = await collection.find(filter).sort(config.sort).limit(limit).toArray();
    const serializedDocuments = serialize(documents);
    return {
      operation: "FIND",
      mongoCommand: `db.${config.mongoName}.find(${JSON.stringify(filter)})`,
      collection: collectionName,
      filter: serialize(filter),
      count: serializedDocuments.length,
      documents: serializedDocuments,
    };
  }

  async findProduct(query = "", limit = 200) {
    return this.findDocuments("produtos", { query, limit });
  }

  async list(collectionName, options = {}) {
    const result = await this.findDocuments(collectionName, options);
    return result.documents;
  }

  async findOne(collectionName, keyValue) {
    const config = this.config(collectionName);
    const collection = await this.collection(collectionName);
    const document = await collection.findOne({ [config.key]: keyValue });
    if (!document) throw new Error(`Documento nao encontrado: ${keyValue}`);
    return serialize(document);
  }

  async insert(collectionName, document) {
    const config = this.config(collectionName);
    const collection = await this.collection(collectionName);
    const payload = this.prepareDocument(collectionName, document);
    const keyValue = payload[config.key];
    if (!keyValue) throw new Error(`O campo ${config.key} e obrigatorio.`);
    if (collectionName === "usuarios" && (!payload.login || !payload.senha_hash)) {
      throw new Error("Login e senha sao obrigatorios para criar uma conta.");
    }
    const result = await collection.insertOne(payload);
    return {
      operation: "INSERT",
      mongoCommand: `db.${config.mongoName}.insertOne(documento)`,
      collection: collectionName,
      keyField: config.key,
      keyValue,
      acknowledged: result.acknowledged,
      insertedId: String(result.insertedId),
      document: serialize(payload),
      affected: result.insertedCount || 1,
    };
  }

  async update(collectionName, keyValue, document) {
    const config = this.config(collectionName);
    const collection = await this.collection(collectionName);
    const existing = await collection.findOne({ [config.key]: keyValue });
    if (!existing) throw new Error(`Documento nao encontrado: ${keyValue}`);
    const before = serialize(existing);
    const payload = {
      ...this.prepareDocument(collectionName, document, existing),
      [config.key]: keyValue,
    };
    const result = await collection.updateOne({ [config.key]: keyValue }, { $set: payload });
    const after = serialize(await collection.findOne({ [config.key]: keyValue }));
    return {
      operation: "UPDATE",
      mongoCommand: `db.${config.mongoName}.updateOne({ ${config.key}: chave }, { $set: documento })`,
      collection: collectionName,
      keyField: config.key,
      keyValue,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      before,
      after,
      affected: result.modifiedCount,
    };
  }

  async remove(collectionName, keyValue) {
    const config = this.config(collectionName);
    const collection = await this.collection(collectionName);
    const deleted = serialize(await collection.findOne({ [config.key]: keyValue }));
    if (!deleted) throw new Error(`Documento nao encontrado: ${keyValue}`);
    const result = await collection.deleteOne({ [config.key]: keyValue });
    return {
      operation: "DELETE",
      mongoCommand: `db.${config.mongoName}.deleteOne({ ${config.key}: chave })`,
      collection: collectionName,
      keyField: config.key,
      keyValue,
      deleted,
      affected: result.deletedCount,
    };
  }

  async exportAll() {
    const result = {};
    for (const name of Object.keys(COLLECTIONS)) {
      result[name] = await this.list(name, { limit: 500 });
    }
    return result;
  }

  // $merge nao devolve documentos para o cursor (a saida vai direto para a colecao de
  // destino). Por isso limpamos a colecao materializada antes de rodar e, na sequencia,
  // lemos de volta o que a propria pipeline acabou de gravar — assim a evidencia mostrada
  // reflete exatamente esta execucao (importante no Pipeline 2, que usa $sample).
  async aggregateAlertasAtivos() {
    const database = await this.connect();
    const pipeline = buildAlertasAtivosPipeline();
    await database.collection("relatorio_alertas_ativos").deleteMany({});
    await database.collection("produtos").aggregate(pipeline).toArray();
    const documents = await database
      .collection("relatorio_alertas_ativos")
      .find({})
      .sort({ gravidade_peso: -1, dias_em_aberto: -1 })
      .toArray();
    return {
      operation: "AGGREGATE",
      mongoCommand: `db.produtos.aggregate(${JSON.stringify(pipeline, null, 2)})`,
      collection: "produtos",
      pipeline,
      count: documents.length,
      documents: serialize(documents),
    };
  }

  async aggregateAuditoriaAmostraRisco(tamanhoAmostra = 5) {
    const database = await this.connect();
    const tamanho = Math.min(Math.max(Number(tamanhoAmostra) || 5, 1), 20);
    const pipeline = buildAuditoriaAmostraPipeline(tamanho);
    await database.collection("auditoria_amostras_risco").deleteMany({});
    await database.collection("usuarios").aggregate(pipeline).toArray();
    const documents = await database
      .collection("auditoria_amostras_risco")
      .find({})
      .sort({ percentual_risco: -1 })
      .toArray();
    return {
      operation: "AGGREGATE",
      mongoCommand: `db.usuarios.aggregate(${JSON.stringify(pipeline, null, 2)})`,
      collection: "usuarios",
      pipeline,
      count: documents.length,
      documents: serialize(documents),
    };
  }

  async close() {
    if (this.client) await this.client.close();
    this.client = null;
    this.database = null;
  }
}

module.exports = { MongoService, COLLECTIONS };
