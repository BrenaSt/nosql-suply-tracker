(function () {
  "use strict";

  const collections = {
    produtos: {
      label: "Produtos",
      mongoName: "produtos",
      key: "codigo",
      template: {
        codigo: "PROD-EVIDENCIA-0001",
        nome: "Produto para Evidencia CRUD",
        categoria: "demonstracao",
        lote: "LOTE-CAF-2026-0001",
        fabricante: "Origem Certa",
        status_atual: "cadastrado",
        localizacao_atual: {
          nome: "Fabrica Uberlandia 001",
          cidade: "Uberlandia",
          estado: "MG",
        },
        ultima_movimentacao: "produto_cadastrado",
        ultimas_movimentacoes: [],
        alertas_ativos: [],
      },
    },
    lotes: {
      label: "Lotes",
      mongoName: "lotes",
      key: "codigo",
      template: {
        codigo: "LOTE-EVIDENCIA-0001",
        produto_base: "Produto para Evidencia CRUD",
        fabricante: "Origem Certa",
        origem: "Fabrica Uberlandia 001",
        destino_previsto: "Centro Distribuicao Sao Paulo 008",
        quantidade_prevista: 100,
        quantidade_confirmada: 100,
        status: "cadastrado",
        nota_fiscal: "NF-2026-00001",
        indicadores_risco: { possui_alerta: false, nivel_risco: "baixo" },
      },
    },
    movimentacoes: {
      label: "Movimentações",
      mongoName: "movimentacoes",
      key: "codigo",
      template: {
        codigo: "MOV-EVIDENCIA-0001",
        produto: "CAF-TRK-0001",
        lote: "LOTE-CAF-2026-0001",
        tipo: "conferencia",
        status_resultante: "armazenado",
        data_hora: "2026-06-23T14:00:00Z",
        origem: "Fabrica Uberlandia 001",
        destino: "Centro Distribuicao Sao Paulo 008",
        usuario: "Joao da Silva",
        nota_fiscal: "NF-2026-00001",
        quantidade_informada: 120,
        quantidade_confirmada: 120,
        verificacao: { resultado: "regular", motivos: [] },
      },
    },
    alertas: {
      label: "Alertas",
      mongoName: "alertas",
      key: "codigo",
      template: {
        codigo: "ALT-EVIDENCIA-0001",
        tipo: "rota_inconsistente",
        descricao: "Alerta criado para comprovar a operacao INSERT no MongoDB.",
        gravidade: "media",
        status: "em_analise",
        produto: "CAF-TRK-0001",
        lote: "LOTE-CAF-2026-0001",
        movimentacao: "MOV-2026-0002",
        data_emissao: "2026-06-23T15:00:00Z",
        responsavel_auditoria: "Maria Oliveira",
      },
    },
    locais: {
      label: "Locais",
      mongoName: "locais",
      key: "nome",
      template: {
        nome: "Unidade Evidencia CRUD",
        tipo: "armazem",
        cidade: "Uberlandia",
        estado: "MG",
        pais: "Brasil",
        coordenadas: { latitude: -18.9186, longitude: -48.2772 },
      },
    },
    notas: {
      label: "Notas fiscais",
      mongoName: "notas_fiscais",
      key: "numero",
      template: {
        numero: "NF-EVIDENCIA-00001",
        emissor: "Origem Certa",
        destinatario: "Unidade Evidencia CRUD",
        data_emissao: "2026-06-23T12:00:00Z",
        quantidade_declarada: 100,
        valor_total: 2500,
        status_validacao: "valida",
      },
    },
    usuarios: {
      label: "Usuários",
      mongoName: "usuarios",
      key: "email",
      template: {
        email: "evidencia.crud@origemcerta.local",
        login: "evidencia.crud",
        senha: "TroqueEstaSenha-2026!",
        nome: "Usuario Evidencia CRUD",
        cargo: "Operador de demonstracao",
        perfil: "operador",
        ativo: true,
        setor: "operacao",
      },
    },
  };

  const state = {
    collection: "produtos",
    operation: "find",
    summary: {},
    documents: [],
    log: [],
  };

  const $ = (selector) => document.querySelector(selector);
  const pretty = (value) => JSON.stringify(value, null, 2);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function currentConfig() {
    return collections[state.collection];
  }

  function documentTitle(record) {
    return (
      record.nome ||
      record.produto_base ||
      record.tipo ||
      record.emissor ||
      record.codigo ||
      record.numero ||
      record.email ||
      "Documento"
    );
  }

  function keyValue(record) {
    return record[currentConfig().key] || "";
  }

  function renderCollectionSelect() {
    const select = $("#evidenceCollection");
    select.innerHTML = "";
    Object.entries(collections).forEach(([key, config]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = config.label;
      select.appendChild(option);
    });
    select.value = state.collection;
  }

  function renderSummary() {
    const summary = $("#collectionSummary");
    summary.innerHTML = "";
    Object.entries(collections).forEach(([key, config]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = key === state.collection ? "is-active" : "";
      button.innerHTML = `<strong>${config.label}</strong><span>${state.summary[key] ?? 0}</span>`;
      button.addEventListener("click", async () => {
        state.collection = key;
        $("#evidenceCollection").value = key;
        loadExample();
        await refreshCollection();
        renderAll();
      });
      summary.appendChild(button);
    });
  }

  function renderCollection() {
    $("#collectionTitle").textContent = currentConfig().label;
    $("#collectionCount").textContent = `${state.summary[state.collection] ?? state.documents.length} documentos`;
    const grid = $("#documentsGrid");
    grid.innerHTML = "";
    state.documents.slice(0, 4).forEach((record) => {
      const article = document.createElement("article");
      article.className = "document-card";
      article.innerHTML = `
        <strong>${documentTitle(record)}</strong>
        <span>${keyValue(record)}</span>
        <pre>${pretty(record)}</pre>
      `;
      grid.appendChild(article);
    });
  }

  function mongoCommand() {
    const config = currentConfig();
    const key = $("#evidenceKey").value.trim();
    if (state.operation === "find") {
      return key
        ? `db.${config.mongoName}.find({ $or: [campos contendo ${JSON.stringify(key)}] })`
        : `db.${config.mongoName}.find({})`;
    }
    if (state.operation === "insert") return `db.${config.mongoName}.insertOne(documento)`;
    if (state.operation === "update") {
      return `db.${config.mongoName}.updateOne({ ${config.key}: ${JSON.stringify(key)} }, { $set: documento })`;
    }
    return `db.${config.mongoName}.deleteOne({ ${config.key}: ${JSON.stringify(key)} })`;
  }

  function renderOperation() {
    document.querySelectorAll("[data-operation]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.operation === state.operation);
    });
    const labels = {
      find: ["FIND", "Resultado da consulta"],
      insert: ["INSERT", "Documento inserido"],
      update: ["UPDATE", "Documento atualizado"],
      delete: ["DELETE", "Documento excluído"],
    };
    $("#operationLabel").textContent = labels[state.operation][0];
    $("#resultTitle").textContent = labels[state.operation][1];
    $("#commandMethod").textContent = labels[state.operation][0];
    $("#executeEvidence").textContent = `Executar ${labels[state.operation][0]}`;
    $("#documentField").hidden = ["find", "delete"].includes(state.operation);
    $("#keyLabel").textContent = state.operation === "find" ? "Consulta" : `Chave: ${currentConfig().key}`;
    $("#commandPreview").textContent = mongoCommand();
  }

  function renderLog() {
    const container = $("#operationLog");
    container.innerHTML = "";
    if (!state.log.length) {
      container.innerHTML = '<div class="empty-state">Nenhuma operação executada nesta sessão.</div>';
      return;
    }
    state.log.slice(0, 12).forEach((entry) => {
      const article = document.createElement("article");
      article.className = "log-entry";
      article.innerHTML = `
        <span>${entry.operation}</span>
        <strong>${collections[entry.collection]?.label || entry.collection}</strong>
        <small>${entry.keyValue || entry.query || "consulta geral"}</small>
        <time>${new Date(entry.timestamp).toLocaleString("pt-BR")}</time>
      `;
      container.appendChild(article);
    });
  }

  function renderAll() {
    renderSummary();
    renderCollection();
    renderOperation();
    renderLog();
  }

  function loadExample() {
    const config = currentConfig();
    const template = clone(config.template);
    if (state.operation === "update") {
      if (state.collection === "produtos") {
        template.nome = "Produto para Evidencia CRUD - Atualizado";
        template.status_atual = "em_transito";
      } else {
        const editable = Object.keys(template).find(
          (key) => key !== config.key && typeof template[key] === "string",
        );
        if (editable) template[editable] = `${template[editable]} - atualizado`;
      }
    }
    $("#evidenceKey").value =
      state.operation === "find"
        ? state.collection === "produtos"
          ? "CAF-TRK-0001"
          : ""
        : template[config.key];
    $("#evidenceDocument").value = pretty(template);
    $("#commandPreview").textContent = mongoCommand();
  }

  function showResult(result, isError = false) {
    $("#operationResult").textContent = typeof result === "string" ? result : pretty(result);
    $("#resultState").textContent = isError ? "operação não concluída" : "operação comprovada";
    $("#resultState").className = `result-state ${isError ? "is-error" : "is-success"}`;
    const count =
      result?.count ??
      result?.affected ??
      result?.documents?.length ??
      result?.modified ??
      result?.deleted ??
      0;
    $("#affectedCount").textContent = `${count} documento(s)`;
  }

  async function refreshCollection() {
    state.documents = await window.mongoCrud.list(state.collection, { limit: 4 });
    state.summary = await window.mongoCrud.summary();
  }

  async function executeOperation() {
    const config = currentConfig();
    const key = $("#evidenceKey").value.trim();
    let payload;
    try {
      if (!window.mongoCrud) throw new Error("Abra esta tela pelo site iniciado com iniciar.cmd.");
      if (!["find", "delete"].includes(state.operation)) {
        payload = JSON.parse($("#evidenceDocument").value);
      }
      let result;
      if (state.operation === "find") {
        result = await window.mongoCrud.find(state.collection, { query: key, limit: 20 });
      } else if (state.operation === "insert") {
        result = await window.mongoCrud.insert(state.collection, payload);
      } else if (state.operation === "update") {
        result = await window.mongoCrud.update(
          state.collection,
          key || payload[config.key],
          payload,
        );
      } else {
        result = await window.mongoCrud.remove(state.collection, key);
      }
      state.log.unshift({
        timestamp: new Date().toISOString(),
        operation: result.operation,
        collection: result.collection,
        keyValue: result.keyValue,
        query: result.query,
      });
      await refreshCollection();
      showResult(result);
      renderAll();
    } catch (error) {
      showResult({ erro: error.message }, true);
    }
  }

  async function removeEvidenceProductIfNeeded() {
    try {
      await window.mongoCrud.remove("produtos", "PROD-EVIDENCIA-0001");
    } catch (error) {
      // O documento de evidencia pode ainda nao existir.
    }
  }

  async function runFullDemo() {
    try {
      await removeEvidenceProductIfNeeded();
      state.log = [];
      const inserted = clone(collections.produtos.template);
      const updated = {
        ...clone(inserted),
        nome: "Produto Evidencia CRUD Atualizado",
        status_atual: "em_transito",
      };
      const found = await window.mongoCrud.find("produtos", {
        query: "CAF-TRK-0001",
        limit: 20,
      });
      const results = [
        {
          ...found,
          query: "CAF-TRK-0001",
        },
        await window.mongoCrud.insert("produtos", inserted),
        await window.mongoCrud.update("produtos", inserted.codigo, updated),
        await window.mongoCrud.remove("produtos", inserted.codigo),
      ];
      state.log = results
        .map((result) => ({
          timestamp: new Date().toISOString(),
          operation: result.operation,
          collection: result.collection,
          keyValue: result.keyValue,
          query: result.query,
        }))
        .reverse();
      state.collection = "produtos";
      state.operation = "delete";
      $("#evidenceCollection").value = "produtos";
      loadExample();
      await refreshCollection();
      showResult({
        mensagem: "Demonstração completa executada diretamente no MongoDB.",
        operacoes: results.map((result) => ({
          operacao: result.operation,
          colecao: result.collection,
          documentos_afetados: result.affected ?? result.count,
          comando_mongodb: result.mongoCommand || null,
        })),
      });
      renderAll();
    } catch (error) {
      showResult({ erro: error.message }, true);
    }
  }

  async function verifyConnection() {
    const status = await window.mongoCrud.status();
    $("#mongoConnectionTitle").textContent = status.connected
      ? "MongoDB conectado"
      : "MongoDB não conectado";
    $("#mongoConnectionDetail").textContent = status.connected
      ? `banco ${status.database}`
      : status.error;
    if (!status.connected) throw new Error(status.error);
  }

  function applyQueryParameters() {
    const params = new URLSearchParams(window.location.search);
    if (collections[params.get("collection")]) state.collection = params.get("collection");
    if (["find", "insert", "update", "delete"].includes(params.get("operation"))) {
      state.operation = params.get("operation");
    }
  }

  function setupEvents() {
    $("#evidenceCollection").addEventListener("change", async (event) => {
      state.collection = event.currentTarget.value;
      loadExample();
      await refreshCollection();
      renderAll();
    });
    document.querySelectorAll("[data-operation]").forEach((button) => {
      button.addEventListener("click", () => {
        state.operation = button.dataset.operation;
        loadExample();
        renderOperation();
      });
    });
    $("#evidenceKey").addEventListener("input", () => {
      $("#commandPreview").textContent = mongoCommand();
    });
    $("#executeEvidence").addEventListener("click", executeOperation);
    $("#loadExample").addEventListener("click", loadExample);
    $("#runFullDemo").addEventListener("click", runFullDemo);
    $("#refreshEvidenceData").addEventListener("click", async () => {
      await refreshCollection();
      renderAll();
    });
    $("#clearEvidenceLog").addEventListener("click", () => {
      state.log = [];
      renderLog();
    });
  }

  async function init() {
    const session = await window.mongoCrud.session();
    if (!session.authenticated) {
      window.location.href = "index.html?login=1&next=evidencias.html";
      return;
    }
    applyQueryParameters();
    renderCollectionSelect();
    loadExample();
    setupEvents();
    try {
      await verifyConnection();
      await refreshCollection();
      renderAll();
    } catch (error) {
      showResult({ erro: error.message }, true);
    }
  }

  init();
})();
