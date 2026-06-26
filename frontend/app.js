const fallback = {
  stats: {
    produtos_rastreados: 0,
    produtos_autenticados: 0,
    alertas_analisados: 0,
    tentativas_fraude_bloqueadas: 0,
  },
  produtos: [],
  alertas: [],
  locais: [],
  lotes: [],
  notas: [],
  movimentacoes: [],
  usuarios: [],
};

let state = {
  tab: "produtos",
  produtos: [],
  alertas: [],
  locais: [],
  lotes: [],
  notas: [],
  movimentacoes: [],
  usuarios: [],
  selected: null,
  selectedAlert: null,
  selectedRecord: null,
  authenticated: false,
  user: null,
  pendingAction: null,
  authMode: "login",
  mongoOnline: true,
  feature: "rastreamento",
  module: "contas",
  moduleAction: "insert",
  baseEntity: "lotes",
  moduleSelectedRecord: null,
  findResults: {},
  findMeta: null,
};

let eventsReady = false;
let revealReady = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const TRACKING_COLLECTIONS = {
  produtos: {
    collection: "produtos",
    placeholder: "Buscar por código, nome ou lote...",
    empty: "Tente outro código, nome ou lote.",
  },
  movimentacoes: {
    collection: "movimentacoes",
    placeholder: "Buscar por código, produto, lote ou tipo...",
    empty: "Tente outro código, produto, lote ou tipo de movimentação.",
  },
  alertas: {
    collection: "alertas",
    placeholder: "Buscar por código, tipo, produto ou lote...",
    empty: "Tente outro código, tipo, produto ou lote.",
  },
  locais: {
    collection: "locais",
    placeholder: "Buscar por nome, cidade ou estado...",
    empty: "Tente outro nome, cidade ou estado.",
  },
  notas: {
    collection: "notas",
    placeholder: "Buscar por número, emissor ou destinatário...",
    empty: "Tente outro número, emissor ou destinatário.",
  },
};

const CRUD_CONFIG = {
  produtos: {
    label: "Produtos",
    endpoint: "produtos",
    stateKey: "produtos",
    keyField: "codigo",
    template: {
      codigo: "PROD-DEMO-0001",
      nome: "Produto Demo 500g",
      categoria: "alimentos",
      lote: "LOTE-DEMO-2026-0001",
      fabricante: "Origem Certa Demo",
      status_atual: "cadastrado",
      localizacao_atual: { nome: "Armazem Demo", cidade: "Uberlandia", estado: "MG" },
      ultima_movimentacao: "produto_cadastrado",
      ultimas_movimentacoes: [
        { tipo: "produto_cadastrado", data_hora: "2026-06-23T09:00:00Z", local: "Armazem Demo" },
      ],
      alertas_ativos: [],
    },
  },
  lotes: {
    label: "Lotes",
    endpoint: "lotes",
    stateKey: "lotes",
    keyField: "codigo",
    template: {
      codigo: "LOTE-DEMO-2026-0001",
      produto_base: "Produto Demo 500g",
      fabricante: "Origem Certa Demo",
      origem: "Fabrica Demo",
      destino_previsto: "Loja Demo",
      quantidade_prevista: 100,
      quantidade_confirmada: 100,
      status: "cadastrado",
      nota_fiscal: "NF-DEMO-00001",
      indicadores_risco: { possui_alerta: false, nivel_risco: "baixo" },
    },
  },
  movimentacoes: {
    label: "Movimentacoes",
    endpoint: "movimentacoes",
    stateKey: "movimentacoes",
    keyField: "codigo",
    template: {
      codigo: "MOV-DEMO-0001",
      produto: "PROD-DEMO-0001",
      lote: "LOTE-DEMO-2026-0001",
      tipo: "saida_fabrica",
      status_resultante: "em_transito",
      data_hora: "2026-06-23T10:00:00Z",
      origem: "Fabrica Demo",
      destino: "Armazem Demo",
      usuario: "Operador Demo",
      nota_fiscal: "NF-DEMO-00001",
      quantidade_informada: 100,
      quantidade_confirmada: 100,
      verificacao: { resultado: "regular", motivos: [] },
    },
  },
  alertas: {
    label: "Alertas",
    endpoint: "alertas",
    stateKey: "alertas",
    keyField: "codigo",
    template: {
      codigo: "ALT-DEMO-0001",
      tipo: "rota_inconsistente",
      descricao: "Produto passou por uma rota diferente da prevista.",
      gravidade: "media",
      status: "em_analise",
      produto: "PROD-DEMO-0001",
      lote: "LOTE-DEMO-2026-0001",
      movimentacao: "saida_fabrica",
      data_emissao: "2026-06-23T11:00:00Z",
      responsavel_auditoria: "Auditor Demo",
    },
  },
  locais: {
    label: "Locais",
    endpoint: "locais",
    stateKey: "locais",
    keyField: "nome",
    template: {
      nome: "Armazem Demo",
      tipo: "armazem",
      cidade: "Uberlandia",
      estado: "MG",
      pais: "Brasil",
      coordenadas: { latitude: -18.9186, longitude: -48.2772 },
    },
  },
  notas: {
    label: "Notas fiscais",
    endpoint: "notas",
    stateKey: "notas",
    keyField: "numero",
    template: {
      numero: "NF-DEMO-00001",
      emissor: "Origem Certa Demo",
      destinatario: "Loja Demo",
      data_emissao: "2026-06-23T08:00:00Z",
      quantidade_declarada: 100,
      valor_total: 1500.5,
      status_validacao: "valida",
    },
  },
  usuarios: {
    label: "Usuarios",
    endpoint: "usuarios",
    stateKey: "usuarios",
    keyField: "email",
    template: {
      email: "operador.demo@origemcerta.com",
      login: "operador.demo",
      senha: "",
      nome: "Operador Demo",
      cargo: "Operador logistico",
      perfil: "operador",
      ativo: true,
      setor: "operacao",
    },
  },
};

const MODULE_CONFIG = {
  contas: {
    number: "02",
    entity: "usuarios",
    eyebrow: "coleção usuarios",
    title: "gestão de contas",
    description: "Crie perfis de operador, auditor e gestor, atualize permissões ou remova acessos antigos.",
    formTitles: {
      insert: "Criar conta",
      update: "Atualizar conta",
      delete: "Excluir conta",
    },
  },
  produtos: {
    number: "03",
    entity: "produtos",
    eyebrow: "agregado produto",
    title: "gestão de produtos",
    description: "Cadastre o item rastreado, mantenha sua localização atual ou exclua um registro pelo código.",
    formTitles: {
      insert: "Inserir produto",
      update: "Atualizar produto",
      delete: "Deletar produto",
    },
  },
  alertas: {
    number: "04",
    entity: "alertas",
    eyebrow: "agregado alerta",
    title: "alertas de risco",
    description: "Associe uma anomalia a um produto, lote e movimentação para iniciar a análise de auditoria.",
    formTitles: {
      insert: "Criar alerta",
      update: "Atualizar investigação",
      delete: "Excluir alerta",
    },
  },
  movimentacoes: {
    number: "05",
    entity: "movimentacoes",
    eyebrow: "agregado movimentação",
    title: "eventos logísticos",
    description: "Registre saídas, entradas, transferências, conferências e entregas no histórico do produto.",
    formTitles: {
      insert: "Registrar movimentação",
      update: "Corrigir movimentação",
      delete: "Excluir movimentação",
    },
  },
  base: {
    number: "06",
    entity: "lotes",
    eyebrow: "coleções auxiliares",
    title: "base logística",
    description: "Prepare lotes, locais e notas fiscais antes de vinculá-los aos produtos e movimentações.",
    formTitles: {
      insert: "Cadastrar registro",
      update: "Atualizar registro",
      delete: "Excluir registro",
    },
  },
};

const ENTITY_FIELDS = {
  usuarios: [
    { name: "email", label: "E-mail institucional", type: "email", required: true, wide: true },
    { name: "login", label: "Nome de usuário", required: true },
    { name: "senha", label: "Senha", type: "password", required: true },
    { name: "nome", label: "Nome completo", required: true },
    { name: "cargo", label: "Cargo", required: true },
    { name: "perfil", label: "Perfil de acesso", type: "select", options: ["operador", "auditor", "gestor"], required: true },
    { name: "setor", label: "Setor", required: true },
    { name: "ativo", label: "Conta ativa", type: "checkbox" },
  ],
  produtos: [
    { name: "codigo", label: "Código do produto", required: true },
    { name: "nome", label: "Nome do produto", required: true },
    { name: "categoria", label: "Categoria", required: true },
    { name: "lote", label: "Lote", source: "lotes", sourceValue: "codigo", required: true },
    { name: "fabricante", label: "Fabricante", required: true, wide: true },
    { name: "status_atual", label: "Status atual", type: "select", options: ["cadastrado", "em_transito", "armazenado", "entregue", "autenticado"], required: true },
    { name: "localizacao_atual.nome", label: "Localização atual", source: "locais", sourceValue: "nome", required: true },
    { name: "localizacao_atual.cidade", label: "Cidade", required: true },
    { name: "localizacao_atual.estado", label: "Estado", maxlength: 2, required: true },
    { name: "ultima_movimentacao", label: "Última movimentação", required: true, wide: true },
  ],
  alertas: [
    { name: "codigo", label: "Código do alerta", required: true },
    { name: "tipo", label: "Tipo", type: "select", options: ["rota_inconsistente", "divergencia_quantidade", "nota_reutilizada", "consulta_duplicada", "produto_suspeito"], required: true },
    { name: "gravidade", label: "Gravidade", type: "select", options: ["baixa", "media", "alta"], required: true },
    { name: "status", label: "Status", type: "select", options: ["aberto", "em_analise", "resolvido", "descartado"], required: true },
    { name: "produto", label: "Produto", source: "produtos", sourceValue: "codigo", required: true },
    { name: "lote", label: "Lote", source: "lotes", sourceValue: "codigo", required: true },
    { name: "movimentacao", label: "Movimentação relacionada", source: "movimentacoes", sourceValue: "codigo", required: true },
    { name: "data_emissao", label: "Data de emissão", type: "datetime-local", dataType: "datetime", required: true },
    { name: "responsavel_auditoria", label: "Responsável pela auditoria", source: "usuarios", sourceValue: "nome", required: true },
    { name: "descricao", label: "Descrição da inconsistência", type: "textarea", required: true, wide: true },
  ],
  movimentacoes: [
    { name: "codigo", label: "Código da movimentação", required: true },
    { name: "produto", label: "Produto", source: "produtos", sourceValue: "codigo", required: true },
    { name: "lote", label: "Lote", source: "lotes", sourceValue: "codigo", required: true },
    { name: "tipo", label: "Tipo de evento", type: "select", options: ["saida_fabrica", "entrada_armazem", "transferencia", "conferencia", "entrega", "devolucao"], required: true },
    { name: "status_resultante", label: "Status resultante", type: "select", options: ["em_transito", "armazenado", "entregue", "devolvido", "em_analise"], required: true },
    { name: "data_hora", label: "Data e hora", type: "datetime-local", dataType: "datetime", required: true },
    { name: "origem", label: "Origem", source: "locais", sourceValue: "nome", required: true },
    { name: "destino", label: "Destino", source: "locais", sourceValue: "nome", required: true },
    { name: "usuario", label: "Usuário responsável", source: "usuarios", sourceValue: "nome", required: true },
    { name: "nota_fiscal", label: "Nota fiscal", source: "notas", sourceValue: "numero", required: true },
    { name: "quantidade_informada", label: "Quantidade informada", type: "number", dataType: "number", required: true },
    { name: "quantidade_confirmada", label: "Quantidade confirmada", type: "number", dataType: "number", required: true },
    { name: "verificacao.resultado", label: "Resultado da verificação", type: "select", options: ["regular", "suspeito", "fraude"], required: true },
    { name: "verificacao.motivos", label: "Motivos, separados por vírgula", dataType: "array", wide: true },
  ],
  lotes: [
    { name: "codigo", label: "Código do lote", required: true },
    { name: "produto_base", label: "Produto base", required: true },
    { name: "fabricante", label: "Fabricante", required: true },
    { name: "origem", label: "Origem", source: "locais", sourceValue: "nome", required: true },
    { name: "destino_previsto", label: "Destino previsto", source: "locais", sourceValue: "nome", required: true },
    { name: "quantidade_prevista", label: "Quantidade prevista", type: "number", dataType: "number", required: true },
    { name: "quantidade_confirmada", label: "Quantidade confirmada", type: "number", dataType: "number", required: true },
    { name: "status", label: "Status", type: "select", options: ["cadastrado", "em_transito", "armazenado", "entregue", "em_analise"], required: true },
    { name: "nota_fiscal", label: "Nota fiscal", source: "notas", sourceValue: "numero", required: true },
    { name: "indicadores_risco.possui_alerta", label: "Possui alerta", type: "checkbox" },
    { name: "indicadores_risco.nivel_risco", label: "Nível de risco", type: "select", options: ["baixo", "medio", "alto"], required: true },
  ],
  locais: [
    { name: "nome", label: "Nome do local", required: true, wide: true },
    { name: "tipo", label: "Tipo", type: "select", options: ["fabrica", "armazem", "transportadora", "centro_distribuicao", "loja", "cliente"], required: true },
    { name: "cidade", label: "Cidade", required: true },
    { name: "estado", label: "Estado", maxlength: 2, required: true },
    { name: "pais", label: "País", required: true },
    { name: "coordenadas.latitude", label: "Latitude", type: "number", step: "any", dataType: "number", required: true },
    { name: "coordenadas.longitude", label: "Longitude", type: "number", step: "any", dataType: "number", required: true },
  ],
  notas: [
    { name: "numero", label: "Número da nota", required: true },
    { name: "emissor", label: "Emissor", required: true },
    { name: "destinatario", label: "Destinatário", required: true },
    { name: "data_emissao", label: "Data de emissão", type: "datetime-local", dataType: "datetime", required: true },
    { name: "quantidade_declarada", label: "Quantidade declarada", type: "number", dataType: "number", required: true },
    { name: "valor_total", label: "Valor total", type: "number", step: "0.01", dataType: "number", required: true },
    { name: "status_validacao", label: "Validação", type: "select", options: ["valida", "em_analise", "invalida"], required: true },
  ],
};

function statusClass(value = "") {
  const normalized = value.toLowerCase();
  if (normalized.includes("alta") || normalized.includes("fraude") || normalized.includes("crit")) return "danger";
  if (normalized.includes("media") || normalized.includes("médio") || normalized.includes("analise") || normalized.includes("trans")) return "warning";
  if (normalized.includes("entreg") || normalized.includes("baixo") || normalized.includes("regular")) return "ok";
  return "neutral";
}

function formatDate(value) {
  if (!value) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function parseMongoSource(source) {
  const [collection, ...keyParts] = String(source).split("/");
  return {
    collection,
    key: keyParts.length ? decodeURIComponent(keyParts.join("/")) : "",
  };
}

async function getJson(source, fallbackValue) {
  try {
    if (!window.mongoCrud) throw new Error("Inicie o site pelo arquivo iniciar.cmd.");
    if (source === "stats") return await window.mongoCrud.stats();
    const { collection, key } = parseMongoSource(source);
    if (key) return await window.mongoCrud.findOne(collection, key);
    return await window.mongoCrud.list(collection, { limit: 500 });
  } catch (error) {
    state.mongoOnline = false;
    return fallbackValue;
  }
}

async function mongoRequest(source, options = {}) {
  if (!window.mongoCrud) throw new Error("Inicie o site pelo arquivo iniciar.cmd.");
  const { collection, key } = parseMongoSource(source);
  const method = (options.method || "GET").toUpperCase();
  const payload = options.body ? JSON.parse(options.body) : undefined;

  if (method === "POST") return window.mongoCrud.insert(collection, payload);
  if (method === "PUT") return window.mongoCrud.update(collection, key, payload);
  if (method === "DELETE") return window.mongoCrud.remove(collection, key);
  return window.mongoCrud.list(collection, { limit: 500 });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function renderStats(stats) {
  Object.entries(stats).forEach(([key, value]) => {
    const target = document.querySelector(`[data-stat="${key}"]`);
    if (target) target.textContent = Number(value || 0).toLocaleString("pt-BR");
  });
}

function productCard(produto) {
  const alert = produto.alertas_ativos?.[0];
  const status = alert?.gravidade || produto.status_atual;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `record-card ${state.selected?.codigo === produto.codigo ? "is-selected" : ""}`;
  button.innerHTML = `
    <span class="delivery-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h8.3A2.5 2.5 0 0 1 16 7.5V9h1.9c.7 0 1.35.33 1.76.9l1.84 2.56c.32.45.5.99.5 1.55V17a2 2 0 0 1-2 2h-.35a2.85 2.85 0 0 1-5.3 0H9.65a2.85 2.85 0 0 1-5.3 0H4a1 1 0 0 1-1-1V7.2Zm13 3.8v4h4v-.76a.7.7 0 0 0-.13-.41L17.83 11H16ZM7 20.2A1.2 1.2 0 1 0 7 17.8a1.2 1.2 0 0 0 0 2.4Zm10 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z" />
      </svg>
    </span>
    <div>
      <h3>${produto.nome}</h3>
      <p>${produto.codigo} · ${produto.lote}</p>
      <small>${produto.localizacao_atual?.nome || "Local não informado"}</small>
    </div>
    <div>
      <span class="status-pill ${statusClass(status)}">${produto.status_atual.replaceAll("_", " ")}</span>
      <br><br>
      <span class="status-pill ${alert ? statusClass(alert.gravidade) : "neutral"}">${alert ? "alerta ativo" : "sem alertas"}</span>
    </div>
  `;
  button.addEventListener("click", () => {
    state.selected = produto;
    state.selectedAlert = null;
    state.selectedRecord = null;
    renderList();
    renderDetails(produto);
  });
  return button;
}

function findProductByAlert(alerta) {
  return state.produtos.find((produto) => {
    return produto.codigo === alerta.produto || produto.lote === alerta.lote;
  });
}

function alertCard(alerta) {
  const produto = findProductByAlert(alerta);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `record-card alert-record ${state.selectedAlert === alerta ? "is-selected" : ""}`;
  button.innerHTML = `
    <span class="delivery-icon delivery-icon-alert" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M12 2.4 22 20H2L12 2.4Zm0 5.6c-.55 0-1 .45-1 1v5.2c0 .55.45 1 1 1s1-.45 1-1V9c0-.55-.45-1-1-1Zm0 10.6a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
      </svg>
    </span>
    <div>
      <h3>${alerta.tipo.replaceAll("_", " ")}</h3>
      <p>${alerta.produto} · ${alerta.lote}</p>
      <small>${alerta.descricao}</small>
    </div>
    <div>
      <span class="status-pill ${statusClass(alerta.gravidade)}">${alerta.gravidade}</span>
      <br><br>
      <span class="status-pill neutral">${produto ? "ver produto" : "sem produto"}</span>
    </div>
  `;
  button.addEventListener("click", () => {
    state.selected = produto || null;
    state.selectedAlert = alerta;
    state.selectedRecord = null;
    renderList();
    renderDetails(produto || null, alerta);
  });
  return button;
}

function findProductsByLocal(local) {
  return state.produtos.filter((produto) => {
    const atual = produto.localizacao_atual || {};
    return atual.nome === local.nome || (atual.cidade === local.cidade && atual.estado === local.estado);
  });
}

function findLoteByNota(nota) {
  return state.lotes.find((lote) => lote.nota_fiscal === nota.numero);
}

function findProductByLote(lote) {
  if (!lote) return null;
  return state.produtos.find((produto) => produto.lote === lote.codigo);
}

function localCard(local) {
  const produtosNoLocal = findProductsByLocal(local);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `record-card local-record ${state.selectedRecord?.item === local ? "is-selected" : ""}`;
  button.innerHTML = `
    <span class="delivery-icon delivery-icon-location" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M12 2.5a7 7 0 0 0-7 7c0 5.2 7 12 7 12s7-6.8 7-12a7 7 0 0 0-7-7Zm0 9.8a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6Z" />
      </svg>
    </span>
    <div>
      <h3>${local.nome}</h3>
      <p>${local.tipo.replaceAll("_", " ")} · ${local.cidade}/${local.estado}</p>
      <small>${produtosNoLocal.length} produto(s) relacionado(s)</small>
    </div>
    <span class="status-pill neutral">ver local</span>
  `;
  button.addEventListener("click", () => {
    state.selected = null;
    state.selectedAlert = null;
    state.selectedRecord = { type: "local", item: local };
    renderList();
    renderRecordDetails("local", local);
  });
  return button;
}

function notaCard(nota) {
  const lote = findLoteByNota(nota);
  const produto = findProductByLote(lote);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `record-card nota-record ${state.selectedRecord?.item === nota ? "is-selected" : ""}`;
  button.innerHTML = `
    <span class="delivery-icon delivery-icon-note" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M6 2.8h8.6L19 7.2v14H6a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Zm8 1.8V8h3.4L14 4.6ZM7 11h10v1.7H7V11Zm0 4h10v1.7H7V15Zm0-8h4v1.7H7V7Z" />
      </svg>
    </span>
    <div>
      <h3>${nota.numero}</h3>
      <p>${nota.emissor} · ${nota.destinatario}</p>
      <small>${produto ? produto.nome : lote ? lote.produto_base : "sem produto vinculado"}</small>
    </div>
    <span class="status-pill ${statusClass(nota.status_validacao)}">${nota.status_validacao}</span>
  `;
  button.addEventListener("click", () => {
    state.selected = produto || null;
    state.selectedAlert = null;
    state.selectedRecord = { type: "nota", item: nota };
    renderList();
    renderRecordDetails("nota", nota);
  });
  return button;
}

function movementCard(movimentacao) {
  const produto = state.produtos.find((item) => item.codigo === movimentacao.produto);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `record-card movement-record ${
    state.selectedRecord?.item === movimentacao ? "is-selected" : ""
  }`;
  button.innerHTML = `
    <span class="delivery-icon delivery-icon-movement" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M4 5h11v3h3.6L22 12v5h-2.1a3 3 0 0 1-5.8 0H9.9a3 3 0 0 1-5.8 0H2V7a2 2 0 0 1 2-2Zm12 5v3h3.7l-2.5-3H16ZM7 19a1.3 1.3 0 1 0 0-2.6A1.3 1.3 0 0 0 7 19Zm10 0a1.3 1.3 0 1 0 0-2.6A1.3 1.3 0 0 0 17 19ZM6 9h6v2H6V9Z" />
      </svg>
    </span>
    <div>
      <h3>${escapeHtml(movimentacao.tipo?.replaceAll("_", " ") || "movimentação")}</h3>
      <p>${escapeHtml(movimentacao.codigo || "")} · ${escapeHtml(movimentacao.produto || "")}</p>
      <small>${escapeHtml(movimentacao.origem || "origem não informada")} → ${escapeHtml(movimentacao.destino || "destino não informado")}</small>
    </div>
    <span class="status-pill ${statusClass(movimentacao.verificacao?.resultado || movimentacao.status_resultante)}">
      ${escapeHtml(movimentacao.verificacao?.resultado || movimentacao.status_resultante || "registro")}
    </span>
  `;
  button.addEventListener("click", () => {
    state.selected = produto || null;
    state.selectedAlert = null;
    state.selectedRecord = { type: "movimentacao", item: movimentacao };
    renderList();
    renderRecordDetails("movimentacao", movimentacao);
  });
  return button;
}

function simpleCard(title, subtitle, badge = "registro") {
  const article = document.createElement("article");
  article.className = "record-card";
  article.innerHTML = `
    <span class="delivery-icon delivery-icon-muted" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5V9h1.8c.75 0 1.46.35 1.9.96l1.82 2.52c.31.43.48.96.48 1.49V18h-2.1a2.9 2.9 0 0 1-5.8 0H9.9a2.9 2.9 0 0 1-5.8 0H3V7.5c0-.55.45-1 1-1Zm12 4.5v3h4l-2.16-3H16Z" />
      </svg>
    </span>
    <div>
      <h3>${title}</h3>
      <p>${subtitle}</p>
    </div>
    <span class="status-pill neutral">${badge}</span>
  `;
  return article;
}

function renderList() {
  const list = $("#recordList");
  const recordCount = $("#recordCount");
  const recordSummaryTitle = $("#recordSummaryTitle");
  const tabConfig = TRACKING_COLLECTIONS[state.tab];
  list.innerHTML = "";
  if (recordCount) recordCount.textContent = "0";
  if (recordSummaryTitle) {
    recordSummaryTitle.textContent =
      state.tab === "produtos" ? "Rastreios disponíveis" : `Registros de ${state.tab}`;
  }

  if (!state.mongoOnline) {
    list.appendChild(
      simpleCard(
        "MongoDB não conectado",
        "Inicie o aplicativo com npm start e confira a MONGODB_URI no arquivo .env.",
        "offline",
      ),
    );
    renderDetails(null);
    return;
  }

  if (!state.authenticated && ["alertas", "notas"].includes(state.tab)) {
    list.appendChild(simpleCard("Acesso restrito", "Entre como operador autorizado para consultar dados sensíveis.", "bloqueado"));
    renderDetails(null);
    return;
  }

  const sourceItems = state.findResults[state.tab] || state[state.tab] || [];
  let items = sourceItems;

  if (state.tab === "produtos") {
    items.forEach((produto) => list.appendChild(productCard(produto)));
  }

  if (state.tab === "movimentacoes") {
    items.forEach((movimentacao) => list.appendChild(movementCard(movimentacao)));
  }

  if (state.tab === "alertas") {
    items.forEach((alerta) => list.appendChild(alertCard(alerta)));
  }

  if (state.tab === "locais") {
    items.forEach((local) => list.appendChild(localCard(local)));
  }

  if (state.tab === "notas") {
    items.forEach((nota) => list.appendChild(notaCard(nota)));
  }

  if (!items.length) {
    list.appendChild(
      simpleCard("Nenhum registro encontrado", tabConfig?.empty || "Tente outra consulta.", "vazio"),
    );
  }

  if (recordCount) recordCount.textContent = String(items.length);
}

function renderRecordDetails(type, item) {
  const panel = $("#detailPanel");
  if (!state.authenticated && type === "nota") {
    renderDetails(null);
    return;
  }

  if (type === "local") {
    const produtosNoLocal = findProductsByLocal(item);
    const produtos = produtosNoLocal
      .slice(0, 5)
      .map((produto) => `<li>${produto.nome} <span>${produto.codigo}</span></li>`)
      .join("");

    panel.innerHTML = `
      <span class="status-pill neutral">${item.tipo.replaceAll("_", " ")}</span>
      <h3>${item.nome}</h3>
      <p>${item.cidade}/${item.estado} · ${item.pais}</p>
      <p><strong>Produtos vinculados:</strong> ${produtosNoLocal.length}</p>
      <p><strong>Latitude:</strong> ${item.coordenadas?.latitude ?? "não informada"}</p>
      <p><strong>Longitude:</strong> ${item.coordenadas?.longitude ?? "não informada"}</p>
      <div class="alert-detail-card">
        <h4>Produtos neste local</h4>
        ${
          produtos
            ? `<ul class="linked-list">${produtos}</ul>`
            : "<p>Nenhum produto está registrado neste local no momento.</p>"
        }
      </div>
    `;
    return;
  }

  if (type === "movimentacao") {
    const produto = state.produtos.find((registro) => registro.codigo === item.produto);
    panel.innerHTML = `
      <span class="status-pill ${statusClass(item.verificacao?.resultado || item.status_resultante)}">
        ${escapeHtml(item.verificacao?.resultado || item.status_resultante || "movimentação")}
      </span>
      <h3>${escapeHtml(item.tipo?.replaceAll("_", " ") || "movimentação logística")}</h3>
      <p>${escapeHtml(item.codigo || "")} · ${formatDate(item.data_hora)}</p>
      <div class="alert-detail-card">
        <h4>Rota registrada</h4>
        <dl>
          <div><dt>Produto</dt><dd>${escapeHtml(produto?.nome || item.produto || "não informado")}</dd></div>
          <div><dt>Lote</dt><dd>${escapeHtml(item.lote || "não informado")}</dd></div>
          <div><dt>Origem</dt><dd>${escapeHtml(item.origem || "não informada")}</dd></div>
          <div><dt>Destino</dt><dd>${escapeHtml(item.destino || "não informado")}</dd></div>
          <div><dt>Responsável</dt><dd>${escapeHtml(item.usuario || "não informado")}</dd></div>
          <div><dt>Nota fiscal</dt><dd>${escapeHtml(item.nota_fiscal || "não informada")}</dd></div>
          <div><dt>Quantidade informada</dt><dd>${Number(item.quantidade_informada || 0).toLocaleString("pt-BR")}</dd></div>
          <div><dt>Quantidade confirmada</dt><dd>${Number(item.quantidade_confirmada || 0).toLocaleString("pt-BR")}</dd></div>
        </dl>
      </div>
    `;
    return;
  }

  if (type === "nota") {
    const lote = findLoteByNota(item);
    const produto = findProductByLote(lote);
    panel.innerHTML = `
      <span class="status-pill ${statusClass(item.status_validacao)}">${item.status_validacao}</span>
      <h3>${item.numero}</h3>
      <p>${item.emissor} → ${item.destinatario}</p>
      <p><strong>Emissão:</strong> ${formatDate(item.data_emissao)}</p>
      <p><strong>Quantidade declarada:</strong> ${Number(item.quantidade_declarada || 0).toLocaleString("pt-BR")}</p>
      <p><strong>Valor total:</strong> ${Number(item.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
      <div class="alert-detail-card">
        <h4>Vínculo com a cadeia</h4>
        <dl>
          <div><dt>Lote</dt><dd>${lote?.codigo || "não encontrado"}</dd></div>
          <div><dt>Produto</dt><dd>${produto?.nome || lote?.produto_base || "não encontrado"}</dd></div>
          <div><dt>Fabricante</dt><dd>${produto?.fabricante || lote?.fabricante || "não informado"}</dd></div>
          <div><dt>Origem</dt><dd>${lote?.origem || "não informada"}</dd></div>
          <div><dt>Destino</dt><dd>${lote?.destino_previsto || item.destinatario}</dd></div>
          <div><dt>Risco</dt><dd>${lote?.indicadores_risco?.nivel_risco || "não informado"}</dd></div>
        </dl>
      </div>
    `;
  }
}

function renderDetails(produto = state.selected, selectedAlert = state.selectedAlert) {
  const panel = $("#detailPanel");
  if (!state.authenticated) {
    panel.innerHTML = `
      <span class="status-pill warning">acesso limitado</span>
      <h3>Autenticação necessária</h3>
      <p>A busca pública pode validar um produto. Dados operacionais, alertas e auditoria exigem acesso autorizado e são consultados diretamente no MongoDB pelo aplicativo desktop.</p>
      <div class="timeline">
        <div class="timeline-item"><strong>Visitante</strong><span>Consulta status básico do produto</span></div>
        <div class="timeline-item"><strong>Operador</strong><span>Registra movimentações e acompanha lotes</span></div>
        <div class="timeline-item"><strong>Auditor</strong><span>Analisa alertas, fraudes e inconsistências</span></div>
      </div>
    `;
    return;
  }

  if (!produto) {
    if (selectedAlert) {
      panel.innerHTML = `
        <span class="status-pill ${statusClass(selectedAlert.gravidade)}">${selectedAlert.gravidade}</span>
        <h3>${selectedAlert.tipo.replaceAll("_", " ")}</h3>
        <p>${selectedAlert.descricao}</p>
        <p><strong>Produto:</strong> ${selectedAlert.produto}</p>
        <p><strong>Lote:</strong> ${selectedAlert.lote}</p>
        <p><strong>Movimentação:</strong> ${selectedAlert.movimentacao || "não informada"}</p>
        <p><strong>Auditoria:</strong> ${selectedAlert.responsavel_auditoria || "não informada"}</p>
        <p><strong>Emissão:</strong> ${formatDate(selectedAlert.data_emissao)}</p>
      `;
      return;
    }
    panel.innerHTML = "<h3>Selecione um produto</h3><p>Os detalhes de rastreamento e alertas aparecem aqui.</p>";
    return;
  }

  const timeline = produto.ultimas_movimentacoes
    .map(
      (item) => `
        <div class="timeline-item">
          <strong>${item.tipo.replaceAll("_", " ")}</strong>
          <span>${formatDate(item.data_hora)} · ${item.local}</span>
        </div>
      `,
    )
    .join("");

  const alert = selectedAlert || produto.alertas_ativos?.[0];
  panel.innerHTML = `
    <span class="status-pill ${statusClass(produto.status_atual)}">${produto.status_atual.replaceAll("_", " ")}</span>
    <h3>${produto.nome}</h3>
    <p>${produto.codigo} · ${produto.lote}</p>
    <p><strong>Fabricante:</strong> ${produto.fabricante}</p>
    <p><strong>Categoria:</strong> ${produto.categoria || "não informada"}</p>
    <p><strong>Status atual:</strong> ${produto.status_atual.replaceAll("_", " ")}</p>
    <p><strong>Local atual:</strong> ${produto.localizacao_atual?.nome || "Não informado"}</p>
    <div class="timeline">${timeline}</div>
    <div class="alert-detail-card">
      <span class="status-pill ${alert ? statusClass(alert.gravidade) : "neutral"}">${alert ? alert.gravidade : "sem alerta"}</span>
      <h4>${alert ? alert.tipo.replaceAll("_", " ") : "Sem alertas ativos"}</h4>
      <p>${alert ? alert.descricao || "Alerta associado ao produto selecionado." : "Nenhuma inconsistência vinculada a este produto no momento."}</p>
      ${
        alert
          ? `<dl>
              <div><dt>Lote</dt><dd>${alert.lote || produto.lote}</dd></div>
              <div><dt>Movimentação</dt><dd>${alert.movimentacao || produto.ultima_movimentacao}</dd></div>
              <div><dt>Status</dt><dd>${alert.status || "em análise"}</dd></div>
              <div><dt>Auditoria</dt><dd>${alert.responsavel_auditoria || "não informada"}</dd></div>
              <div><dt>Emissão</dt><dd>${formatDate(alert.data_emissao)}</dd></div>
            </dl>`
          : ""
      }
    </div>
  `;
}

function renderFindEvidence(result = state.findMeta, isError = false) {
  const evidence = $("#findEvidence");
  if (!evidence) return;

  if (!result) {
    const collection = TRACKING_COLLECTIONS[state.tab]?.collection || state.tab;
    evidence.dataset.state = "idle";
    evidence.querySelector("strong").textContent = "Consulta pronta";
    evidence.querySelector("code").textContent = `db.${collection}.find({})`;
    return;
  }

  evidence.dataset.state = isError ? "error" : "success";
  evidence.querySelector("strong").textContent = isError
    ? "FIND não concluído"
    : `${result.count} documento(s) encontrado(s)`;
  evidence.querySelector("code").textContent = isError
    ? result.message
    : result.mongoCommand;
}

async function executeFind(query = $("#productSearch")?.value.trim() || "", tab = state.tab) {
  const config = TRACKING_COLLECTIONS[tab];
  if (!config) return;
  if (!state.authenticated) {
    state.pendingAction = () => executeFind(query, tab);
    openLogin();
    return;
  }

  const findButton = $(".find-button");
  if (findButton) {
    findButton.disabled = true;
    findButton.textContent = "Consultando...";
  }

  try {
    const result = await window.mongoCrud.find(config.collection, {
      query,
      limit: 500,
    });
    state.findResults[tab] = result.documents;
    state.findMeta = result;

    if (tab === "produtos") {
      state.selected = result.documents[0] || null;
      state.selectedAlert = null;
      state.selectedRecord = null;
      renderDetails(state.selected);
    } else if (tab === "movimentacoes" && result.documents[0]) {
      state.selectedRecord = { type: "movimentacao", item: result.documents[0] };
      renderRecordDetails("movimentacao", result.documents[0]);
    } else if (tab === "locais" && result.documents[0]) {
      state.selectedRecord = { type: "local", item: result.documents[0] };
      renderRecordDetails("local", result.documents[0]);
    }

    renderList();
    renderFindEvidence(result);
  } catch (error) {
    state.findResults[tab] = [];
    renderList();
    renderFindEvidence({ message: error.message }, true);
  } finally {
    if (findButton) {
      findButton.disabled = false;
      findButton.textContent = "Executar FIND";
    }
  }
}

async function selectTrackingTab(tab, shouldScroll = true) {
  if (!TRACKING_COLLECTIONS[tab]) return;
  if (!state.authenticated) {
    state.pendingAction = () => selectTrackingTab(tab, shouldScroll);
    openLogin();
    return;
  }
  state.tab = tab;
  state.findMeta = null;
  $$(".tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tab);
  });

  const search = $("#productSearch");
  if (search) {
    search.value = "";
    search.placeholder = TRACKING_COLLECTIONS[tab].placeholder;
  }

  setFeature("rastreamento");
  $("#trackingBranch").hidden = true;
  $('[data-feature="rastreamento"]')?.classList.remove("is-expanded");
  renderFindEvidence();
  await executeFind("", tab);

  if (shouldScroll) {
    $("#rastreamento")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function currentModule() {
  return MODULE_CONFIG[state.module] || MODULE_CONFIG.contas;
}

function currentEntityKey() {
  return state.module === "base" ? state.baseEntity : currentModule().entity;
}

function currentEntity() {
  return CRUD_CONFIG[currentEntityKey()] || CRUD_CONFIG.usuarios;
}

function moduleRecords() {
  const config = currentEntity();
  return state[config.stateKey] || [];
}

function getNestedValue(record, path) {
  return path.split(".").reduce((value, key) => value?.[key], record);
}

function setNestedValue(target, path, value) {
  const keys = path.split(".");
  let current = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value;
      return;
    }
    current[key] = current[key] || {};
    current = current[key];
  });
}

function localDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function moduleRecordTitle(record) {
  return record.nome || record.produto_base || record.tipo || record.emissor || record.codigo || record.numero || record.email;
}

function renderModuleResponse(value = {}, isError = false) {
  const response = $("#moduleResponse");
  const status = $("#moduleResponseStatus");
  if (!response) return;
  response.textContent = typeof value === "string" ? value : prettyJson(value);
  response.dataset.state = isError ? "error" : "ok";
  if (status) {
    status.textContent = isError ? "operação não concluída" : "pronto";
    status.dataset.state = isError ? "error" : "ok";
  }
}

function setFeature(feature, shouldScroll = false) {
  if (!state.authenticated) {
    state.pendingAction = () => setFeature(feature, shouldScroll);
    openLogin(feature === "contas" ? "register" : "login");
    return;
  }
  state.feature = feature;
  if (feature !== "rastreamento") state.module = feature;
  if (feature !== "rastreamento") {
    $("#trackingBranch").hidden = true;
    $('[data-feature="rastreamento"]')?.classList.remove("is-expanded");
  }

  $$(".feature-tab").forEach((button) => {
    const active = button.dataset.feature === feature;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  $$("[data-feature-panel]").forEach((panel) => {
    const active =
      (feature === "rastreamento" && panel.dataset.featurePanel === "rastreamento") ||
      (feature !== "rastreamento" && panel.dataset.featurePanel === "modulo");
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });

  if (feature !== "rastreamento") {
    state.moduleAction = "insert";
    state.moduleSelectedRecord = null;
    renderModule();
  }

  if (shouldScroll) {
    (feature === "rastreamento" ? $("#rastreamento") : $("#gestao"))?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

function setModuleAction(action) {
  state.moduleAction = action;
  state.moduleSelectedRecord = null;
  renderModule();
  renderModuleResponse({
    operacao: action.toUpperCase(),
    colecao: currentEntity().label,
    dica: action === "insert" ? "Preencha os campos para criar um documento." : "Escolha um registro existente na lista.",
  });
}

function renderModuleActions() {
  const container = $("#moduleActions");
  if (!container) return;
  const labels = { insert: "Criar", update: "Atualizar", delete: "Excluir" };
  container.innerHTML = "";
  ["insert", "update", "delete"].forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `module-action ${action === state.moduleAction ? "is-active" : ""} ${action === "delete" ? "is-danger" : ""}`;
    button.dataset.moduleAction = action;
    button.textContent = labels[action];
    button.addEventListener("click", () => setModuleAction(action));
    container.appendChild(button);
  });
}

function sourceOptions(field) {
  if (!field.source) return [];
  const sourceConfig = CRUD_CONFIG[field.source];
  const records = sourceConfig ? state[sourceConfig.stateKey] || [] : [];
  return records
    .map((record) => record[field.sourceValue])
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function createModuleField(field, record) {
  const wrapper = document.createElement("label");
  wrapper.className = `module-field ${field.wide ? "is-wide" : ""} ${field.type === "checkbox" ? "is-checkbox" : ""}`;
  const label = document.createElement("span");
  label.textContent = field.label;
  wrapper.appendChild(label);

  const currentValue = getNestedValue(record, field.name);
  let control;

  if (field.type === "select") {
    control = document.createElement("select");
    (field.options || []).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.replaceAll("_", " ");
      option.selected = String(currentValue ?? "") === value;
      control.appendChild(option);
    });
  } else if (field.type === "textarea") {
    control = document.createElement("textarea");
    control.rows = 4;
    control.value = currentValue ?? "";
  } else {
    control = document.createElement("input");
    control.type = field.type || "text";
    if (field.type === "checkbox") {
      control.checked = Boolean(currentValue);
    } else if (field.dataType === "datetime") {
      control.value = localDateTimeValue(currentValue || new Date().toISOString());
    } else if (field.dataType === "array" && Array.isArray(currentValue)) {
      control.value = currentValue.join(", ");
    } else {
      control.value = currentValue ?? "";
    }
  }

  control.name = field.name;
  if (field.required && !(field.name === "senha" && state.moduleAction === "update")) {
    control.required = true;
  }
  if (field.name === "senha" && state.moduleAction === "update") {
    control.placeholder = "Deixe em branco para manter a senha atual";
  }
  if (field.step) control.step = field.step;
  if (field.maxlength) control.maxLength = field.maxlength;

  const options = sourceOptions(field);
  if (options.length && control.tagName === "INPUT") {
    const listId = `options-${field.name.replaceAll(".", "-")}`;
    control.setAttribute("list", listId);
    const dataList = document.createElement("datalist");
    dataList.id = listId;
    options.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      dataList.appendChild(option);
    });
    wrapper.appendChild(dataList);
  }

  wrapper.appendChild(control);
  return wrapper;
}

function wireModuleReferences() {
  const entityKey = currentEntityKey();
  const findControl = (name) => document.querySelector(`#moduleForm [name="${name}"]`);

  if (["alertas", "movimentacoes"].includes(entityKey)) {
    const productControl = findControl("produto");
    productControl?.addEventListener("change", () => {
      const produto = state.produtos.find((item) => item.codigo === productControl.value);
      const lotControl = findControl("lote");
      if (produto && lotControl) lotControl.value = produto.lote || "";
    });
  }

  if (entityKey === "produtos") {
    const locationControl = findControl("localizacao_atual.nome");
    locationControl?.addEventListener("change", () => {
      const local = state.locais.find((item) => item.nome === locationControl.value);
      const cityControl = findControl("localizacao_atual.cidade");
      const stateControl = findControl("localizacao_atual.estado");
      if (local && cityControl) cityControl.value = local.cidade || "";
      if (local && stateControl) stateControl.value = local.estado || "";
    });
  }
}

function renderModuleForm() {
  const form = $("#moduleForm");
  if (!form) return;
  const entityKey = currentEntityKey();
  const config = currentEntity();
  const fields = ENTITY_FIELDS[entityKey] || [];
  const sourceRecord =
    state.moduleSelectedRecord || (state.moduleAction === "insert" ? structuredClone(config.template) : {});
  form.innerHTML = "";

  if (state.moduleAction === "delete") {
    const keyField = fields.find((field) => field.name === config.keyField) || {
      name: config.keyField,
      label: `Chave ${config.keyField}`,
      required: true,
    };
    form.appendChild(createModuleField(keyField, sourceRecord));
    const warning = document.createElement("p");
    warning.className = "module-delete-warning";
    warning.textContent = "Esta operação remove definitivamente o documento selecionado da coleção.";
    form.appendChild(warning);
  } else {
    fields.forEach((field) => form.appendChild(createModuleField(field, sourceRecord)));
  }

  const actions = document.createElement("div");
  actions.className = "module-form-actions";
  const submit = document.createElement("button");
  submit.className = state.moduleAction === "delete" ? "danger-button" : "primary-link";
  submit.type = "submit";
  submit.textContent =
    state.moduleAction === "insert"
      ? "Salvar novo registro"
      : state.moduleAction === "update"
        ? "Salvar alterações"
        : "Confirmar exclusão";
  actions.appendChild(submit);

  if (state.moduleAction !== "insert") {
    const clear = document.createElement("button");
    clear.className = "secondary-link";
    clear.type = "button";
    clear.textContent = "Limpar seleção";
    clear.addEventListener("click", () => {
      state.moduleSelectedRecord = null;
      renderModule();
    });
    actions.appendChild(clear);
  }
  form.appendChild(actions);
  wireModuleReferences();
}

function renderModuleRecords() {
  const list = $("#moduleRecordList");
  const counter = $("#moduleRecordCount");
  if (!list) return;
  const config = currentEntity();
  const query = ($("#moduleSearch")?.value || "").trim().toLowerCase();
  const records = moduleRecords().filter((record) => prettyJson(record).toLowerCase().includes(query));
  list.innerHTML = "";
  if (counter) counter.textContent = String(records.length);

  if (!records.length) {
    list.innerHTML = '<p class="module-empty">Nenhum registro encontrado.</p>';
    return;
  }

  records.slice(0, 60).forEach((record) => {
    const key = record[config.keyField];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `module-record ${state.moduleSelectedRecord === record ? "is-selected" : ""}`;
    button.innerHTML = `
      <span>${escapeHtml(moduleRecordTitle(record) || "Documento")}</span>
      <strong>${escapeHtml(key || "")}</strong>
    `;
    button.addEventListener("click", () => {
      state.moduleSelectedRecord = record;
      if (state.moduleAction === "insert") state.moduleAction = "update";
      renderModule();
      renderModuleResponse(record);
    });
    list.appendChild(button);
  });
}

function renderModule() {
  const module = currentModule();
  const entity = currentEntity();
  const title = module.formTitles[state.moduleAction] || "Gerenciar registro";
  const descriptions = {
    insert: `Preencha os dados para inserir um documento em ${entity.label}.`,
    update: `Selecione um registro existente e altere somente os dados necessários.`,
    delete: `Selecione o documento que deve ser removido usando a chave ${entity.keyField}.`,
  };

  if ($("#moduleNumber")) $("#moduleNumber").textContent = module.number;
  if ($("#moduleEyebrow")) $("#moduleEyebrow").textContent = module.eyebrow;
  if ($("#module-title")) $("#module-title").textContent = module.title;
  if ($("#moduleDescription")) $("#moduleDescription").textContent = module.description;
  if ($("#moduleFormTitle")) $("#moduleFormTitle").textContent = title;
  if ($("#moduleFormDescription")) $("#moduleFormDescription").textContent = descriptions[state.moduleAction];
  if ($("#moduleOperationBadge")) $("#moduleOperationBadge").textContent = state.moduleAction.toUpperCase();

  const baseField = $("#baseEntityField");
  if (baseField) baseField.hidden = state.module !== "base";
  if ($("#baseEntitySelect")) $("#baseEntitySelect").value = state.baseEntity;

  renderModuleActions();
  renderModuleRecords();
  renderModuleForm();
}

function buildModulePayload() {
  const entityKey = currentEntityKey();
  const fields = ENTITY_FIELDS[entityKey] || [];
  const payload =
    state.moduleAction === "update" && state.moduleSelectedRecord
      ? structuredClone(state.moduleSelectedRecord)
      : {};

  fields.forEach((field) => {
    const control = document.querySelector(`#moduleForm [name="${field.name}"]`);
    if (!control) return;
    let value;
    if (field.type === "checkbox") {
      value = control.checked;
    } else if (field.dataType === "number") {
      value = Number(control.value);
    } else if (field.dataType === "array") {
      value = control.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (field.dataType === "datetime") {
      value = new Date(control.value).toISOString();
    } else {
      value = control.value.trim();
    }
    setNestedValue(payload, field.name, value);
  });

  if (entityKey === "produtos") {
    payload.ultimas_movimentacoes = payload.ultimas_movimentacoes || [];
    payload.alertas_ativos = payload.alertas_ativos || [];
  }
  return payload;
}

async function handleModuleSubmit(event) {
  event.preventDefault();
  const config = currentEntity();
  const action = state.moduleAction;

  if (!state.authenticated) {
    renderModuleResponse(
      {
        erro: "Acesso administrativo bloqueado",
        solucao: "Faça login para executar esta operação.",
      },
      true,
    );
    return;
  }

  try {
    const payload = buildModulePayload();
    const selectedKey = state.moduleSelectedRecord?.[config.keyField];
    const key = selectedKey || payload[config.keyField];
    let data;

    if (action === "insert") {
      data = await mongoRequest(config.endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } else if (action === "update") {
      if (!key) throw new Error(`Selecione um registro com a chave ${config.keyField}.`);
      payload[config.keyField] = key;
      data = await mongoRequest(`${config.endpoint}/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      if (!key) throw new Error(`Selecione um registro com a chave ${config.keyField}.`);
      const confirmed = window.confirm(`Excluir ${config.label}: ${key}?`);
      if (!confirmed) return;
      data = await mongoRequest(`${config.endpoint}/${encodeURIComponent(key)}`, { method: "DELETE" });
    }

    const safePayload = structuredClone(payload);
    delete safePayload.senha;
    const result = {
      operacao: action.toUpperCase(),
      colecao: config.label,
      chave: key || payload[config.keyField],
      resposta: data,
      documento: action === "delete" ? undefined : safePayload,
    };
    state.moduleSelectedRecord = null;
    await loadData();
    renderModuleResponse(result);
  } catch (error) {
    renderModuleResponse(error.message, true);
  }
}

function syncAuthenticationUI() {
  document.body.classList.toggle("is-authenticated", state.authenticated);
  document.body.classList.toggle("is-guest", !state.authenticated);
  const sessionButton = $("#sessionButton");
  if (sessionButton) {
    sessionButton.textContent = state.authenticated
      ? `${state.user?.login || state.user?.nome || "Usuário"} · sair`
      : "Entrar";
    sessionButton.classList.toggle("is-online", state.authenticated);
  }
}

function openLogin(mode = "login") {
  setAuthMode(mode);
  const dialog = $("#loginDialog");
  if (!dialog?.open) dialog?.showModal();
  $("#loginError").textContent = "";
  window.setTimeout(() => $("#loginUser")?.focus(), 60);
}

function closeLogin() {
  const dialog = $("#loginDialog");
  if (dialog?.open) dialog.close();
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

function setAuthMode(mode) {
  state.authMode = mode === "register" ? "register" : "login";
  const registering = state.authMode === "register";
  $("#loginDialog").dataset.authMode = state.authMode;
  $$("[data-auth-mode]").forEach((button) => {
    const active = button.dataset.authMode === state.authMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $$(".register-field").forEach((field) => {
    const input = field.querySelector("input");
    field.hidden = !registering;
    input.required = registering;
    input.disabled = !registering;
  });
  $("#authDialogTitle").textContent = registering
    ? "criar uma conta"
    : "entrar na origem certa";
  $("#authDialogDescription").textContent = registering
    ? "Cadastre uma conta de operador para consultar e registrar dados da cadeia."
    : "Use uma conta autorizada para consultar e modificar as coleções.";
  $("#loginUserLabel").textContent = registering ? "Nome de usuário" : "Usuário ou e-mail";
  $("#authSubmit").textContent = registering ? "Criar conta" : "Entrar";
  $("#loginError").textContent = "";
}

async function handleAuthentication(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  const errorTarget = $("#loginError");
  const registering = state.authMode === "register";
  submit.disabled = true;
  submit.textContent = registering ? "Criando..." : "Entrando...";
  errorTarget.textContent = "";

  try {
    const result = registering
      ? await window.mongoCrud.register({
          nome: $("#registerName").value.trim(),
          email: $("#registerEmail").value.trim(),
          login: $("#loginUser").value.trim(),
          senha: $("#loginPassword").value,
        })
      : await window.mongoCrud.login(
          $("#loginUser").value.trim(),
          $("#loginPassword").value,
        );
    state.authenticated = result.authenticated;
    state.user = result.user;
    syncAuthenticationUI();
    closeLogin();

    const pendingAction = state.pendingAction;
    state.pendingAction = null;
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.endsWith(".html")) {
      window.location.href = next;
      return;
    }

    if (pendingAction) {
      Promise.resolve(pendingAction()).catch((error) => {
        $("#mongoStatus").textContent = error.message;
      });
    }
    loadData().catch((error) => {
      $("#mongoStatus").textContent = `Não foi possível carregar os dados: ${error.message}`;
      $("#mongoStatus").dataset.state = "offline";
    });
  } catch (error) {
    errorTarget.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.textContent = registering ? "Criar conta" : "Entrar";
  }
}

async function logout() {
  await window.mongoCrud.logout();
  state.authenticated = false;
  state.user = null;
  state.pendingAction = null;
  state.produtos = [];
  state.alertas = [];
  state.locais = [];
  state.lotes = [];
  state.notas = [];
  state.movimentacoes = [];
  state.usuarios = [];
  state.findResults = {};
  renderStats(fallback.stats);
  syncAuthenticationUI();
  renderList();
  renderDetails();
  renderModule();
  $("#mongoStatus").textContent = "Faça login para carregar os dados do MongoDB.";
  $("#mongoStatus").dataset.state = "offline";
}

function setupEvents() {
  if (eventsReady) return;
  eventsReady = true;

  const closeHeaderMenus = () => {
    $("#navLinks")?.classList.remove("is-open");
    $(".menu-toggle")?.setAttribute("aria-expanded", "false");
    $("#trackingNavMenu")?.classList.remove("is-open");
    $("#trackingMenuToggle")?.setAttribute("aria-expanded", "false");
  };

  $(".menu-toggle").addEventListener("click", (event) => {
    const open = event.currentTarget.getAttribute("aria-expanded") === "true";
    event.currentTarget.setAttribute("aria-expanded", String(!open));
    $("#navLinks").classList.toggle("is-open", !open);
    if (open) {
      $("#trackingNavMenu")?.classList.remove("is-open");
      $("#trackingMenuToggle")?.setAttribute("aria-expanded", "false");
    }
  });

  $("#trackingMenuToggle")?.addEventListener("click", (event) => {
    const open = event.currentTarget.getAttribute("aria-expanded") === "true";
    event.currentTarget.setAttribute("aria-expanded", String(!open));
    $("#trackingNavMenu")?.classList.toggle("is-open", !open);
  });

  $$("#navLinks a").forEach((link) => {
    link.addEventListener("click", closeHeaderMenus);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".nav-tracking")) {
      $("#trackingNavMenu")?.classList.remove("is-open");
      $("#trackingMenuToggle")?.setAttribute("aria-expanded", "false");
    }
  });

  window.addEventListener("scroll", () => {
    $(".site-header").dataset.elevated = String(window.scrollY > 10);
  });

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      selectTrackingTab(tab.dataset.tab, false);
    });
  });

  $("#trackingFindForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    executeFind();
  });

  $("#heroSearch").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.authenticated) {
      const query = $("#heroCode").value;
      state.pendingAction = () => {
        $("#productSearch").value = query;
        return selectTrackingTab("produtos");
      };
      openLogin();
      return;
    }
    setFeature("rastreamento");
    state.tab = "produtos";
    $$(".tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.tab === "produtos");
    });
    $("#productSearch").value = $("#heroCode").value;
    $("#productSearch").placeholder = TRACKING_COLLECTIONS.produtos.placeholder;
    $("#rastreamento").scrollIntoView({ behavior: "smooth" });
    executeFind($("#heroCode").value, "produtos");
  });

  $("#simulateAlert").addEventListener("click", () => {
    if (state.authenticated) loadData();
    else openLogin();
  });

  $$(".feature-tab").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.dashboard !== undefined) {
        if (!state.authenticated) {
          state.pendingAction = () =>
            $("#resumo-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
          openLogin();
          return;
        }
        $("#resumo-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (button.dataset.feature === "rastreamento") {
        const branch = $("#trackingBranch");
        const opening = branch?.hidden;
        if (branch) branch.hidden = !opening;
        $$(".feature-tab").forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-selected", String(active));
        });
        button.classList.toggle("is-expanded", opening);
        if (opening) {
          window.setTimeout(
            () => branch?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
            40,
          );
        }
        return;
      }
      setFeature(button.dataset.feature, true);
    });
  });

  $$("[data-open-feature]").forEach((link) => {
    link.addEventListener("click", () => {
      const action = link.dataset.moduleAction;
      if (!state.authenticated) {
        state.pendingAction = () => {
          setFeature(link.dataset.openFeature, true);
          if (action) setModuleAction(action);
        };
        openLogin(link.dataset.openFeature === "contas" ? "register" : "login");
        closeHeaderMenus();
        return;
      }
      setFeature(link.dataset.openFeature, true);
      if (action) setModuleAction(action);
      closeHeaderMenus();
    });
  });

  $$("[data-track-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      selectTrackingTab(button.dataset.trackTab);
      closeHeaderMenus();
    });
  });

  $("#closeTrackingBranch")?.addEventListener("click", () => {
    $("#trackingBranch").hidden = true;
    $('[data-feature="rastreamento"]')?.classList.remove("is-expanded");
  });

  $(".nav-dashboard")?.addEventListener("click", (event) => {
    if (!state.authenticated) {
      event.preventDefault();
      state.pendingAction = () =>
        $("#resumo-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
      openLogin();
      closeHeaderMenus();
    }
  });

  $("#baseEntitySelect")?.addEventListener("change", (event) => {
    state.baseEntity = event.currentTarget.value;
    state.moduleSelectedRecord = null;
    $("#moduleSearch").value = "";
    renderModule();
    renderModuleResponse({ colecao: currentEntity().label, operacao: state.moduleAction.toUpperCase() });
  });

  $("#moduleSearch")?.addEventListener("input", renderModuleRecords);
  $("#moduleRefresh")?.addEventListener("click", loadData);
  $("#moduleForm")?.addEventListener("submit", handleModuleSubmit);
  $$(".open-login").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = "login";
      openLogin();
    });
  });
  $$("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
  });
  $("#loginForm")?.addEventListener("submit", handleAuthentication);
  $("#loginClose")?.addEventListener("click", closeLogin);
  $("#loginDialog")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeLogin();
  });
  $("#sessionButton")?.addEventListener("click", () => {
    if (state.authenticated) logout();
    else {
      state.authMode = "login";
      openLogin();
    }
  });
  window.addEventListener("auth-required", () => {
    if (!state.authenticated) openLogin();
  });

  document.addEventListener("pointermove", (event) => {
    document.querySelectorAll(".record-card").forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        card.style.setProperty("--mx", `${x}%`);
        card.style.setProperty("--my", `${y}%`);
      }
    });
  });
}

function setupReveal() {
  if (revealReady) return;
  revealReady = true;

  document
    .querySelectorAll(".reveal-section, .metric-card, .app-panel, .feature-tab, .module-layout")
    .forEach((item, index) => {
      item.classList.add("reveal");
      item.style.transitionDelay = `${Math.min(index % 4, 3) * 90}ms`;
    });

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  $$(".hero .reveal").forEach((item) => item.classList.add("is-visible"));

  if (prefersReduced) {
    $$(".reveal").forEach((item) => item.classList.add("is-visible"));
    return;
  }

  document.documentElement.classList.add("reveal-enabled");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
  );
  $$(".reveal").forEach((item) => observer.observe(item));
}

async function loadData() {
  state.mongoOnline = true;
  const [connection, stats, produtos, alertas, locais, lotes, notas, movimentacoes, usuarios] = await Promise.all([
    window.mongoCrud?.status() || Promise.resolve({ connected: false }),
    getJson("stats", fallback.stats),
    getJson("produtos", fallback.produtos),
    getJson("alertas", fallback.alertas),
    getJson("locais", fallback.locais),
    getJson("lotes", fallback.lotes),
    getJson("notas", fallback.notas),
    getJson("movimentacoes", fallback.movimentacoes),
    getJson("usuarios", fallback.usuarios),
  ]);

  state.produtos = produtos;
  state.alertas = alertas;
  state.locais = locais;
  state.lotes = lotes;
  state.notas = notas;
  state.movimentacoes = movimentacoes;
  state.usuarios = usuarios;
  state.findResults = {
    produtos,
    alertas,
    locais,
    notas,
    movimentacoes,
  };
  state.selected = produtos[0];
  renderStats(stats);
  const mongoStatus = $("#mongoStatus");
  if (mongoStatus) {
    state.mongoOnline = state.mongoOnline && Boolean(connection.connected);
    mongoStatus.textContent = state.mongoOnline
      ? `MongoDB conectado diretamente: banco ${connection.database}`
      : `MongoDB não conectado: ${connection.error || "inicie pelo comando npm start"}`;
    mongoStatus.dataset.state = state.mongoOnline ? "online" : "offline";
  }
  if ($("#alertCount")) $("#alertCount").textContent = alertas.length;
  renderList();
  renderDetails();
  renderFindEvidence();
  renderModule();
  syncAuthenticationUI();
}

async function loadGuestState() {
  const connection = await window.mongoCrud.status();
  state.mongoOnline = Boolean(connection.connected);
  renderStats(fallback.stats);
  const mongoStatus = $("#mongoStatus");
  if (mongoStatus) {
    mongoStatus.textContent = connection.connected
      ? "MongoDB disponível. Faça login para carregar os indicadores."
      : `MongoDB não conectado: ${connection.error || "verifique o arquivo .env"}`;
    mongoStatus.dataset.state = connection.connected ? "online" : "offline";
  }
  if ($("#alertCount")) $("#alertCount").textContent = "0";
  renderList();
  renderDetails();
  renderFindEvidence();
  renderModule();
}

async function init() {
  setupEvents();
  setupReveal();
  try {
    const session = await window.mongoCrud.session();
    state.authenticated = session.authenticated;
    state.user = session.user;
  } catch (error) {
    state.authenticated = false;
    state.user = null;
  }
  syncAuthenticationUI();
  if (state.authenticated) await loadData();
  else await loadGuestState();

  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "1") openLogin();
}

init();
