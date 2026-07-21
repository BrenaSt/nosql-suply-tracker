(function () {
  "use strict";

  async function request(path, options = {}) {
    const response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Erro ${response.status}`);
      error.status = response.status;
      error.code = data.code;
      if (response.status === 401) window.dispatchEvent(new CustomEvent("auth-required"));
      throw error;
    }
    return data;
  }

  function collectionUrl(collection, keyValue = "") {
    const base = `/mongo/collections/${encodeURIComponent(collection)}`;
    return keyValue ? `${base}/${encodeURIComponent(keyValue)}` : base;
  }

  window.mongoCrud = {
    session: () => request("/auth/session"),
    login: (login, senha) =>
      request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ login, senha }),
      }),
    register: (document) =>
      request("/auth/register", {
        method: "POST",
        body: JSON.stringify(document),
      }),
    logout: () => request("/auth/logout", { method: "POST" }),
    status: () => request("/mongo/status"),
    stats: () => request("/mongo/stats"),
    summary: () => request("/mongo/summary"),
    list: (collection, options = {}) => {
      const query = new URLSearchParams();
      if (options.query) query.set("query", options.query);
      if (options.product) query.set("product", options.product);
      if (options.limit) query.set("limit", options.limit);
      const suffix = query.toString() ? `?${query}` : "";
      return request(`${collectionUrl(collection)}${suffix}`);
    },
    find: (collection, options = {}) => {
      const query = new URLSearchParams();
      if (options.query) query.set("query", options.query);
      if (options.product) query.set("product", options.product);
      if (options.limit) query.set("limit", options.limit);
      const suffix = query.toString() ? `?${query}` : "";
      return request(`/mongo/find/${encodeURIComponent(collection)}${suffix}`);
    },
    findOne: (collection, keyValue) => request(collectionUrl(collection, keyValue)),
    insert: (collection, document) =>
      request(collectionUrl(collection), {
        method: "POST",
        body: JSON.stringify(document),
      }),
    update: (collection, keyValue, document) =>
      request(collectionUrl(collection, keyValue), {
        method: "PUT",
        body: JSON.stringify(document),
      }),
    remove: (collection, keyValue) =>
      request(collectionUrl(collection, keyValue), {
        method: "DELETE",
      }),
    exportAll: () => request("/mongo/export"),
    aggregateAlertas: () => request("/mongo/aggregations/alertas-ativos"),
    aggregateAuditoria: (tamanho = 5) =>
      request(`/mongo/aggregations/auditoria-amostra?tamanho=${encodeURIComponent(tamanho)}`),
    estimativaProdutosConsultados: () => request("/redis/produtos-consultados-estimativa"),
    syncGrafo: () => request("/neo4j/sync", { method: "POST" }),
    usuariosCentrais: (limite = 10) =>
      request(`/neo4j/usuarios-centrais?limite=${encodeURIComponent(limite)}`),
  };
})();
