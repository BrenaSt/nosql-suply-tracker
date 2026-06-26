const path = require("node:path");
const crypto = require("node:crypto");
const { exec } = require("node:child_process");
const express = require("express");
const { MongoService } = require("./mongo-service.cjs");

const PORT = Number(process.env.PORT || 5500);
const HOST = process.env.HOST || "127.0.0.1";
const app = express();
const mongoService = new MongoService(__dirname);
const SESSION_COOKIE = "origem_certa_session";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "frontend")));

function asyncRoute(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response);
    } catch (error) {
      next(error);
    }
  };
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=");
        return [
          decodeURIComponent(item.slice(0, separator)),
          decodeURIComponent(item.slice(separator + 1)),
        ];
      }),
  );
}

function signSession(user) {
  const payload = Buffer.from(
    JSON.stringify({
      email: user.email,
      login: user.login,
      nome: user.nome,
      perfil: user.perfil,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    }),
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSession(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return user.expiresAt > Date.now() ? user : null;
  } catch (error) {
    return null;
  }
}

function sessionCookie(token, maxAge = SESSION_DURATION_MS) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${secure}`;
}

function requireAuth(request, response, next) {
  const user = readSession(request);
  if (!user) {
    response.status(401).json({
      error: "Faça login para acessar esta funcionalidade.",
      code: "AUTH_REQUIRED",
    });
    return;
  }
  request.user = user;
  next();
}

app.get("/auth/session", (request, response) => {
  const user = readSession(request);
  response.json({ authenticated: Boolean(user), user });
});

app.post(
  "/auth/login",
  asyncRoute(async (request, response) => {
    const user = await mongoService.authenticateUser(request.body.login, request.body.senha);
    if (!user) {
      response.status(401).json({ error: "Usuário ou senha inválidos.", code: "INVALID_LOGIN" });
      return;
    }
    response.setHeader("Set-Cookie", sessionCookie(signSession(user)));
    response.json({ authenticated: true, user });
  }),
);

app.post(
  "/auth/register",
  asyncRoute(async (request, response) => {
    const result = await mongoService.registerUser(request.body);
    const user = await mongoService.authenticateUser(request.body.login, request.body.senha);
    response.setHeader("Set-Cookie", sessionCookie(signSession(user)));
    response.status(201).json({
      authenticated: true,
      user,
      registration: {
        operation: result.operation,
        collection: result.collection,
        keyValue: result.keyValue,
      },
    });
  }),
);

app.post("/auth/logout", (request, response) => {
  response.setHeader("Set-Cookie", sessionCookie("", 0));
  response.json({ authenticated: false });
});

app.get(
  "/mongo/status",
  asyncRoute(async (_, response) => {
    response.json(await mongoService.status());
  }),
);

app.get(
  "/mongo/stats",
  requireAuth,
  asyncRoute(async (_, response) => {
    response.json(await mongoService.stats());
  }),
);

app.get(
  "/mongo/summary",
  requireAuth,
  asyncRoute(async (_, response) => {
    response.json(await mongoService.summary());
  }),
);

app.get(
  "/mongo/find/:collection",
  requireAuth,
  asyncRoute(async (request, response) => {
    const options = {
      query: request.query.query || "",
      product: request.query.product || "",
      limit: request.query.limit || 200,
    };
    const result =
      request.params.collection === "produtos"
        ? await mongoService.findProduct(options.query, options.limit)
        : await mongoService.findDocuments(request.params.collection, options);
    response.json(result);
  }),
);

app.get(
  "/mongo/collections/:collection",
  requireAuth,
  asyncRoute(async (request, response) => {
    response.json(
      await mongoService.list(request.params.collection, {
        query: request.query.query || "",
        product: request.query.product || "",
        limit: request.query.limit || 200,
      }),
    );
  }),
);

app.get(
  "/mongo/collections/:collection/:key",
  requireAuth,
  asyncRoute(async (request, response) => {
    response.json(await mongoService.findOne(request.params.collection, request.params.key));
  }),
);

app.post(
  "/mongo/collections/:collection",
  requireAuth,
  asyncRoute(async (request, response) => {
    response.status(201).json(await mongoService.insert(request.params.collection, request.body));
  }),
);

app.put(
  "/mongo/collections/:collection/:key",
  requireAuth,
  asyncRoute(async (request, response) => {
    response.json(
      await mongoService.update(request.params.collection, request.params.key, request.body),
    );
  }),
);

app.delete(
  "/mongo/collections/:collection/:key",
  requireAuth,
  asyncRoute(async (request, response) => {
    response.json(await mongoService.remove(request.params.collection, request.params.key));
  }),
);

app.get(
  "/mongo/export",
  requireAuth,
  asyncRoute(async (_, response) => {
    response.json(await mongoService.exportAll());
  }),
);

app.use((error, _, response, next) => {
  if (response.headersSent) return next(error);
  const duplicate = error?.code === 11000;
  response.status(error?.status || (duplicate ? 409 : 500)).json({
    error: duplicate ? "Chave duplicada no MongoDB." : error.message,
    code: error?.code || null,
  });
});

const server = app.listen(PORT, HOST, async () => {
  const browserHost = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
  const url = `http://${browserHost}:${PORT}`;
  const status = await mongoService.status();
  console.log(`Origem Certa disponível em ${url}`);
  console.log(
    status.connected
      ? `MongoDB conectado: banco ${status.database}`
      : `MongoDB não conectado: ${status.error}`,
  );
  if (process.env.DEMO_ADMIN_PASSWORD) {
    console.log(`Conta de demonstração pronta: ${process.env.DEMO_ADMIN_USER || "admin"}`);
  }
  if (process.env.NO_OPEN !== "1") {
    exec(`start "" "${url}"`);
  }
});

async function shutdown() {
  server.close();
  await mongoService.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
