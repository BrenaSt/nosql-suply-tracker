const path = require("node:path");
const fs = require("node:fs");
const dns = require("node:dns");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

const COLLECTIONS = {
  produtos: { mongoName: "produtos", key: "codigo", sort: { nome: 1 } },
  lotes: { mongoName: "lotes", key: "codigo", sort: { codigo: 1 } },
  movimentacoes: { mongoName: "movimentacoes", key: "codigo", sort: { data_hora: -1 } },
  alertas: { mongoName: "alertas", key: "codigo", sort: { data_emissao: -1 } },
  locais: { mongoName: "locais", key: "nome", sort: { nome: 1 } },
  notas: { mongoName: "notas_fiscais", key: "numero", sort: { numero: 1 } },
  usuarios: { mongoName: "usuarios", key: "email", sort: { nome: 1 } },
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
    if (collectionName !== "usuarios") return serialize(payload);

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
    return payload;
  }

  async stats() {
    const database = await this.connect();
    const [produtos, autenticados, lotes, alertas, movimentacoes, fraudes] = await Promise.all([
      database.collection("produtos").countDocuments({}),
      database.collection("produtos").countDocuments({
        status_atual: { $in: ["entregue", "autenticado"] },
      }),
      database.collection("lotes").countDocuments({}),
      database.collection("alertas").countDocuments({}),
      database.collection("movimentacoes").countDocuments({}),
      database.collection("alertas").countDocuments({ gravidade: "alta", status: "resolvido" }),
    ]);
    return {
      produtos_rastreados: produtos,
      produtos_autenticados: autenticados,
      lotes_ativos: lotes,
      alertas_analisados: alertas,
      movimentacoes_hoje: movimentacoes,
      tentativas_fraude_bloqueadas: fraudes,
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

    if (options.product && collectionName === "movimentacoes") {
      filter.produto = options.product;
    }

    if (options.query) {
      const escaped = String(options.query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: escaped, $options: "i" };
      const fields = {
        produtos: ["codigo", "nome", "lote"],
        lotes: ["codigo", "produto_base", "fabricante"],
        movimentacoes: ["codigo", "produto", "lote", "tipo"],
        alertas: ["codigo", "tipo", "produto", "lote"],
        locais: ["nome", "cidade", "estado"],
        notas: ["numero", "emissor", "destinatario"],
        usuarios: ["email", "nome", "perfil"],
      }[collectionName];
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

    const result = serialize(document);
    if (collectionName === "produtos") {
      const database = await this.connect();
      result.movimentacoes = serialize(
        await database.collection("movimentacoes").find({ produto: keyValue }).sort({ data_hora: 1 }).toArray(),
      );
      result.alertas = serialize(
        await database.collection("alertas").find({ produto: keyValue }).sort({ data_emissao: -1 }).toArray(),
      );
    }
    return result;
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

  async close() {
    if (this.client) await this.client.close();
    this.client = null;
    this.database = null;
  }
}

module.exports = { MongoService, COLLECTIONS };
