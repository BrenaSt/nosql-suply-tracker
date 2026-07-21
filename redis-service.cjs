const Redis = require("ioredis");

// Mesmo padrao de conexao unica reutilizavel do MongoService: conecta 1 vez, guarda o client
// e reusa em todas as chamadas. Redis e complementar ao MongoDB (cache + estrutura probabilistica),
// nunca a fonte oficial dos dados — por isso toda falha aqui e tratada como "indisponivel",
// sem nunca derrubar o servidor nem quebrar as rotas que dependem so do Mongo.
class RedisService {
  constructor() {
    this.uri = process.env.REDIS_URL;
    this.client = null;
    this.connecting = null;
  }

  async connect() {
    if (!this.uri) return null;
    if (this.client?.status === "ready") return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      try {
        const client = new Redis(this.uri, {
          lazyConnect: true,
          retryStrategy: () => null,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
        });
        client.on("error", () => {
          // Erros depois da conexao inicial nao devem derrubar o processo Node.
        });
        await client.connect();
        this.client = client;
        return client;
      } catch (error) {
        this.client = null;
        return null;
      } finally {
        this.connecting = null;
      }
    })();

    return this.connecting;
  }

  async status() {
    const client = await this.connect();
    return { available: client?.status === "ready", uri: this.uri ? "configurado" : "nao configurado" };
  }

  // Estrutura comum (String): cache-aside para as aggregation pipelines existentes.
  // Nao recalcula nada sozinho — recebe a funcao que ja faz o trabalho (computeFn) e so
  // decide se busca do cache ou manda calcular de verdade, sem duplicar a logica da pipeline.
  async getOrSetCache(key, ttlSeconds, computeFn) {
    const client = await this.connect();
    if (!client) {
      const value = await computeFn();
      return { hit: false, cacheAvailable: false, ageSeconds: 0, value };
    }

    try {
      const cached = await client.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        const ageSeconds = Math.max(0, Math.round((Date.now() - parsed.cachedAt) / 1000));
        return { hit: true, cacheAvailable: true, ageSeconds, value: parsed.value };
      }
    } catch (error) {
      // Cache ilegivel ou indisponivel no meio do caminho: cai para o calculo normal.
    }

    const value = await computeFn();
    try {
      await client.set(key, JSON.stringify({ cachedAt: Date.now(), value }), "EX", ttlSeconds);
    } catch (error) {
      // Se nao conseguir gravar o cache, a funcionalidade principal (o resultado) ja foi obtida.
    }
    return { hit: false, cacheAvailable: true, ageSeconds: 0, value };
  }

  // Estrutura probabilistica (HyperLogLog): estima quantos codigos de produto DISTINTOS
  // ja foram pesquisados via FIND, sem guardar a lista inteira (uso de memoria constante).
  async trackProductSearch(term) {
    if (!term) return;
    const client = await this.connect();
    if (!client) return;
    try {
      await client.pfadd("buscas:produtos:hll", String(term).trim().toLowerCase());
    } catch (error) {
      // Melhor esforco: uma falha aqui nunca deve afetar a busca de produto em si.
    }
  }

  async estimateUniqueProductSearches() {
    const client = await this.connect();
    if (!client) return { available: false, estimate: 0 };
    try {
      const estimate = await client.pfcount("buscas:produtos:hll");
      return { available: true, estimate };
    } catch (error) {
      return { available: false, estimate: 0 };
    }
  }

  async close() {
    if (this.client?.status === "ready") await this.client.quit();
    this.client = null;
  }
}

module.exports = { RedisService };
