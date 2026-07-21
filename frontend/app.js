const fallback = {
  stats: {
    produtos_rastreados: 0,
    produtos_autenticados: 0,
    alertas_analisados: 0,
    tentativas_fraude_bloqueadas: 0,
  },
  produtos: [],
  usuarios: [],
};

let state = {
  tab: "produtos",
  produtos: [],
  usuarios: [],
  selected: null,
  selectedAlert: null,
  authenticated: false,
  user: null,
  pendingAction: null,
  authMode: "login",
  mongoOnline: true,
  feature: "rastreamento",
  module: "contas",
  moduleAction: "insert",
  moduleSelectedRecord: null,
  findResults: {},
  findMeta: null,
  auditoriaLoaded: false,
};

let eventsReady = false;
let revealReady = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const TRACKING_COLLECTIONS = {
  produtos: {
    collection: "produtos",
    placeholder: "Buscar por código, nome, categoria ou fabricante...",
    empty: "Tente outro código, nome, categoria ou fabricante.",
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
      fabricante: "Origem Certa Demo",
      status_atual: "recebido",
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
    eyebrow: "coleção produtos",
    title: "gestão de produtos",
    description:
      "Cadastre o item rastreado ou atualize seu status atual. Alertas, movimentações e locais já vêm embutidos no documento e aparecem como somente leitura no rastreamento.",
    formTitles: {
      insert: "Inserir produto",
      update: "Atualizar produto",
      delete: "Deletar produto",
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
    {
      name: "perfil",
      label: "Perfil de acesso",
      type: "select",
      options: ["operador", "auditor", "gestor", "cliente"],
      required: true,
    },
    { name: "setor", label: "Setor", required: true },
    { name: "ativo", label: "Conta ativa", type: "checkbox" },
  ],
  produtos: [
    { name: "codigo", label: "Código do produto", required: true },
    { name: "nome", label: "Nome do produto", required: true },
    { name: "categoria", label: "Categoria", required: true },
    { name: "fabricante", label: "Fabricante", required: true, wide: true },
    {
      name: "status_atual",
      label: "Status atual",
      type: "select",
      options: ["recebido", "em_transito", "em_alerta", "autenticado"],
      required: true,
    },
  ],
};

function statusClass(value = "") {
  const normalized = value.toLowerCase();
  if (normalized.includes("alta") || normalized.includes("fraude") || normalized.includes("crit") || normalized.includes("alerta"))
    return "danger";
  if (normalized.includes("media") || normalized.includes("médio") || normalized.includes("analise") || normalized.includes("trans"))
    return "warning";
  if (normalized.includes("entreg") || normalized.includes("baixo") || normalized.includes("regular") || normalized.includes("autentic"))
    return "ok";
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
  const alertasAtivos = (produto.alertas || []).filter((item) => item.status !== "resolvido");
  const alert = alertasAtivos[0];
  const status = alert?.gravidade || produto.status_atual;
  const localAtual = produto.locais?.atual;
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
      <h3>${escapeHtml(produto.nome)}</h3>
      <p>${escapeHtml(produto.codigo)} · ${escapeHtml(produto.fabricante || "fabricante não informado")}</p>
      <small>${escapeHtml(localAtual?.nome || "Local não informado")}</small>
    </div>
    <div>
      <span class="status-pill ${statusClass(status)}">${escapeHtml((produto.status_atual || "").replaceAll("_", " "))}</span>
      <br><br>
      <span class="status-pill ${alert ? statusClass(alert.gravidade) : "neutral"}">${alert ? `${alertasAtivos.length} alerta(s) ativo(s)` : "sem alertas"}</span>
    </div>
  `;
  button.addEventListener("click", () => {
    state.selected = produto;
    state.selectedAlert = null;
    renderList();
    renderDetails(produto);
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
  list.innerHTML = "";
  if (recordCount) recordCount.textContent = "0";
  if (recordSummaryTitle) recordSummaryTitle.textContent = "Rastreios disponíveis";

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

  const items = state.findResults.produtos || state.produtos || [];
  items.forEach((produto) => list.appendChild(productCard(produto)));

  if (!items.length) {
    list.appendChild(
      simpleCard("Nenhum registro encontrado", TRACKING_COLLECTIONS.produtos.empty, "vazio"),
    );
  }

  if (recordCount) recordCount.textContent = String(items.length);
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
        <div class="timeline-item"><strong>Operador</strong><span>Registra movimentações e acompanha produtos</span></div>
        <div class="timeline-item"><strong>Auditor</strong><span>Analisa alertas, fraudes e inconsistências</span></div>
      </div>
    `;
    return;
  }

  if (!produto) {
    if (selectedAlert) {
      panel.innerHTML = `
        <span class="status-pill ${statusClass(selectedAlert.gravidade)}">${escapeHtml(selectedAlert.gravidade || "")}</span>
        <h3>${escapeHtml((selectedAlert.tipo || "").replaceAll("_", " "))}</h3>
        <p>${escapeHtml(selectedAlert.descricao || "")}</p>
        <p><strong>Status:</strong> ${escapeHtml(selectedAlert.status || "em análise")}</p>
        <p><strong>Movimentação:</strong> ${escapeHtml(selectedAlert.movimentacao || "não informada")}</p>
        <p><strong>Auditoria:</strong> ${escapeHtml(selectedAlert.responsavel_auditoria?.nome || "não informada")}</p>
        <p><strong>Emissão:</strong> ${formatDate(selectedAlert.data_emissao)}</p>
      `;
      return;
    }
    panel.innerHTML = "<h3>Selecione um produto</h3><p>Os detalhes de rastreamento e alertas aparecem aqui.</p>";
    return;
  }

  const movimentacoes = produto.movimentacoes || [];
  const timeline = movimentacoes
    .slice(-5)
    .map(
      (item) => `
        <div class="timeline-item">
          <strong>${escapeHtml((item.tipo || "").replaceAll("_", " "))}</strong>
          <span>${formatDate(item.data_hora)} · ${escapeHtml(item.destino || item.origem || "local não informado")}</span>
        </div>
      `,
    )
    .join("");

  const alertasProduto = produto.alertas || [];
  const alert = selectedAlert || alertasProduto.find((item) => item.status !== "resolvido") || alertasProduto[0];
  const localAtual = produto.locais?.atual;

  panel.innerHTML = `
    <span class="status-pill ${statusClass(produto.status_atual)}">${escapeHtml((produto.status_atual || "").replaceAll("_", " "))}</span>
    <h3>${escapeHtml(produto.nome)}</h3>
    <p>${escapeHtml(produto.codigo)}</p>
    <p><strong>Fabricante:</strong> ${escapeHtml(produto.fabricante || "não informado")}</p>
    <p><strong>Categoria:</strong> ${escapeHtml(produto.categoria || "não informada")}</p>
    <p><strong>Local atual:</strong> ${escapeHtml(localAtual?.nome || "Não informado")}</p>
    <div class="timeline">${timeline || "<p>Sem movimentações registradas.</p>"}</div>
    <div class="alert-detail-card">
      <span class="status-pill ${alert ? statusClass(alert.gravidade) : "neutral"}">${alert ? escapeHtml(alert.gravidade) : "sem alerta"}</span>
      <h4>${alert ? escapeHtml((alert.tipo || "").replaceAll("_", " ")) : "Sem alertas ativos"}</h4>
      <p>${alert ? escapeHtml(alert.descricao || "Alerta associado ao produto selecionado.") : "Nenhuma inconsistência vinculada a este produto no momento."}</p>
      ${
        alert
          ? `<dl>
              <div><dt>Movimentação</dt><dd>${escapeHtml(alert.movimentacao || "não informada")}</dd></div>
              <div><dt>Status</dt><dd>${escapeHtml(alert.status || "em análise")}</dd></div>
              <div><dt>Auditoria</dt><dd>${escapeHtml(alert.responsavel_auditoria?.nome || "não informada")}</dd></div>
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

async function executeFind(query = $("#productSearch")?.value.trim() || "", tab = "produtos") {
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
    state.selected = result.documents[0] || null;
    state.selectedAlert = null;
    renderDetails(state.selected);
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
  return currentModule().entity;
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
  return record.nome || record.codigo || record.email;
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

function setAuditStatus(elementId, dataState, message) {
  const element = $(`#${elementId}`);
  if (!element) return;
  element.dataset.state = dataState;
  element.textContent = message;
}

function cacheNote(cache) {
  if (!cache) return "";
  if (cache.hit) return ` · atualizado há ${cache.ageSeconds}s`;
  return " · atualizado agora";
}

function renderAuditList(elementId, items) {
  const container = $(`#${elementId}`);
  if (!container) return;
  container.innerHTML = "";
  items.forEach(({ title, subtitle, badgeText, badgeClass }) => {
    const item = document.createElement("div");
    item.className = "audit-list-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(subtitle || "")}</small>
      </div>
      ${badgeText ? `<span class="status-pill ${badgeClass || "neutral"}">${escapeHtml(badgeText)}</span>` : ""}
    `;
    container.appendChild(item);
  });
}

async function loadAuditAlertas() {
  setAuditStatus("auditAlertasStatus", "loading", "Consultando pipeline...");
  $("#auditAlertasList").innerHTML = "";
  try {
    const result = await window.mongoCrud.aggregateAlertas();
    const note = cacheNote(result.cache);
    if (!result.documents.length) {
      setAuditStatus("auditAlertasStatus", "empty", `Nenhum alerta ativo no momento.${note}`);
      return;
    }
    setAuditStatus("auditAlertasStatus", "ok", `${result.count} alerta(s) ativo(s)${note}`);
    renderAuditList(
      "auditAlertasList",
      result.documents.slice(0, 8).map((item) => ({
        title: `${item.produto_nome} · ${item.produto_codigo}`,
        subtitle: `${item.dias_em_aberto} dia(s) em aberto · auditor: ${item.auditor?.nome || "não informado"}`,
        badgeText: item.gravidade,
        badgeClass: statusClass(item.gravidade),
      })),
    );
  } catch (error) {
    setAuditStatus("auditAlertasStatus", "error", error.message);
  }
}

async function loadAuditAmostra() {
  const tamanho = Number($("#auditAmostraTamanho")?.value || 5);
  setAuditStatus("auditAmostraStatus", "loading", "Sorteando amostra...");
  $("#auditAmostraList").innerHTML = "";
  try {
    const result = await window.mongoCrud.aggregateAuditoria(tamanho);
    const note = cacheNote(result.cache);
    if (!result.documents.length) {
      setAuditStatus("auditAmostraStatus", "empty", `Nenhum usuário da amostra tem produto em risco agora.${note}`);
      return;
    }
    setAuditStatus("auditAmostraStatus", "ok", `${result.count} usuário(s) com produtos em risco${note}`);
    renderAuditList(
      "auditAmostraList",
      result.documents.map((item) => ({
        title: `${item.nome} · ${item.percentual_risco}% em risco`,
        subtitle: `${item.setor || "setor não informado"} · ${item.produtos_em_risco}/${item.total_produtos_destinados} produtos destinados`,
        badgeText: `${item.percentual_risco}%`,
        badgeClass: statusClass(item.percentual_risco >= 30 ? "alta" : "media"),
      })),
    );
  } catch (error) {
    setAuditStatus("auditAmostraStatus", "error", error.message);
  }
}

async function loadAuditRedis() {
  setAuditStatus("auditRedisStatus", "loading", "Calculando alcance...");
  const numberEl = $("#auditRedisNumber");
  if (numberEl) numberEl.textContent = "";
  try {
    const result = await window.mongoCrud.estimativaProdutosConsultados();
    if (!result.available) {
      setAuditStatus("auditRedisStatus", "empty", "Indicador temporariamente indisponível.");
      return;
    }
    setAuditStatus("auditRedisStatus", "ok", "Estimativa em tempo real, sem impacto na performance da busca.");
    if (numberEl) numberEl.textContent = `~${result.estimate}`;
  } catch (error) {
    setAuditStatus("auditRedisStatus", "error", error.message);
  }
}

async function loadAuditNeo4j() {
  setAuditStatus("auditNeo4jStatus", "loading", "Atualizando rede e recalculando influência...");
  $("#auditNeo4jList").innerHTML = "";
  try {
    const sync = await window.mongoCrud.syncGrafo();
    if (!sync.available) {
      setAuditStatus("auditNeo4jStatus", "empty", "Indicador temporariamente indisponível.");
      return;
    }
    const rank = await window.mongoCrud.usuariosCentrais(8);
    if (!rank.available || !rank.documents.length) {
      setAuditStatus("auditNeo4jStatus", "empty", "Sem dados suficientes para calcular a rede ainda.");
      return;
    }
    const rankingMode =
      rank.engine === "nodejs-pagerank" ? "PageRank compatível com AuraDB Free" : "PageRank via Neo4j GDS";
    setAuditStatus(
      "auditNeo4jStatus",
      "ok",
      `Rede atualizada: ${sync.usuarios} pessoas, ${sync.produtos} produtos, ${sync.relacionamentos} interações · ${rankingMode}.`,
    );
    renderAuditList(
      "auditNeo4jList",
      rank.documents.map((item) => ({
        title: item.nome || item.email,
        subtitle: `${item.setor || "setor não informado"} · ${item.cargo || ""}`,
        badgeText: `influência ${item.score}`,
        badgeClass: "neutral",
      })),
    );
  } catch (error) {
    setAuditStatus("auditNeo4jStatus", "error", error.message);
  }
}

function renderAuditoriaPanel() {
  if (state.auditoriaLoaded) return;
  state.auditoriaLoaded = true;
  loadAuditAlertas();
  loadAuditAmostra();
  loadAuditRedis();
  loadAuditNeo4j();
}

function setFeature(feature, shouldScroll = false) {
  if (!state.authenticated) {
    state.pendingAction = () => setFeature(feature, shouldScroll);
    openLogin(feature === "contas" ? "register" : "login");
    return;
  }
  state.feature = feature;
  const isModuleFeature = feature === "contas" || feature === "produtos";
  if (isModuleFeature) state.module = feature;
  if (feature !== "rastreamento") {
    $("#trackingBranch").hidden = true;
    $('[data-feature="rastreamento"]')?.classList.remove("is-expanded");
  }

  $$(".feature-tab").forEach((button) => {
    const active = button.dataset.feature === feature;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  const panelTarget = feature === "rastreamento" ? "rastreamento" : feature === "auditoria" ? "auditoria" : "modulo";
  $$("[data-feature-panel]").forEach((panel) => {
    const active = panel.dataset.featurePanel === panelTarget;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });

  if (isModuleFeature) {
    state.moduleAction = "insert";
    state.moduleSelectedRecord = null;
    renderModule();
  }

  if (feature === "auditoria") {
    renderAuditoriaPanel();
  }

  if (shouldScroll) {
    (feature === "rastreamento" ? $("#rastreamento") : feature === "auditoria" ? $("#auditoria") : $("#gestao"))?.scrollIntoView({
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

  wrapper.appendChild(control);
  return wrapper;
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
  state.usuarios = [];
  state.findResults = {};
  state.auditoriaLoaded = false;
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

  $("#moduleSearch")?.addEventListener("input", renderModuleRecords);
  $("#moduleRefresh")?.addEventListener("click", loadData);
  $("#moduleForm")?.addEventListener("submit", handleModuleSubmit);
  $("#auditAlertasRefresh")?.addEventListener("click", loadAuditAlertas);
  $("#auditAmostraRefresh")?.addEventListener("click", loadAuditAmostra);
  $("#auditRedisRefresh")?.addEventListener("click", loadAuditRedis);
  $("#auditNeo4jRefresh")?.addEventListener("click", loadAuditNeo4j);
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
  const [connection, stats, produtos, usuarios] = await Promise.all([
    window.mongoCrud?.status() || Promise.resolve({ connected: false }),
    getJson("stats", fallback.stats),
    getJson("produtos", fallback.produtos),
    getJson("usuarios", fallback.usuarios),
  ]);

  state.produtos = produtos;
  state.usuarios = usuarios;
  state.findResults = { produtos };
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
