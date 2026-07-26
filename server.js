const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8000);
const dataDirectory = path.join(root, "data");
const databasePath = path.join(dataDirectory, "kidmath-db.json");
const accessLogPath = path.join(dataDirectory, "access-log.jsonl");
const publicFiles = new Set([
  "/index.html",
  "/styles.css",
  "/app.js",
  "/config.js",
  "/manifest.webmanifest",
  "/sw.js",
  "/icon.svg",
]);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
let databaseQueue = Promise.resolve();

function emptyDatabase() {
  return { users: [], sessions: [] };
}

async function loadDatabase() {
  try {
    const contents = await fs.promises.readFile(databasePath, "utf8");
    const parsed = JSON.parse(contents);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch (error) {
    if (error.code === "ENOENT") return emptyDatabase();
    throw error;
  }
}

async function saveDatabase(database) {
  await fs.promises.mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${databasePath}.tmp`;
  await fs.promises.writeFile(temporaryPath, JSON.stringify(database, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.promises.rename(temporaryPath, databasePath);
}

function updateDatabase(callback) {
  const operation = databaseQueue.then(async () => {
    const database = await loadDatabase();
    const result = await callback(database);
    await saveDatabase(database);
    return result;
  });
  databaseQueue = operation.catch(() => {});
  return operation;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const passwordHash = crypto
    .pbkdf2Sync(password, salt, 210000, 32, "sha256")
    .toString("base64url");
  return { salt, passwordHash };
}

function verifyPassword(password, user) {
  const expected = Buffer.from(user.passwordHash, "base64url");
  const actual = Buffer.from(hashPassword(password, user.salt).passwordHash, "base64url");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    loginCount: user.loginCount || 0,
    usageSeconds: user.usageSeconds || 0,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin || null,
  };
}

function createUser(username, password, role = "user") {
  const credentials = hashPassword(password);
  return {
    id: crypto.randomUUID(),
    username: username.trim(),
    normalizedUsername: username.trim().toLocaleLowerCase(),
    role,
    ...credentials,
    loginCount: 0,
    usageSeconds: 0,
    createdAt: new Date().toISOString(),
    lastLogin: null,
  };
}

function validUsername(username) {
  return /^[\p{L}\p{N}_.-]{2,32}$/u.test(username);
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

async function ensureInitialAdmin() {
  let generatedPassword = "";
  await updateDatabase((database) => {
    if (database.users.length) return;
    const username = process.env.KIDMATH_ADMIN_USERNAME || "admin";
    const password =
      process.env.KIDMATH_ADMIN_PASSWORD ||
      `${crypto.randomBytes(8).toString("base64url")}A7!`;
    database.users.push(createUser(username, password, "admin"));
    if (!process.env.KIDMATH_ADMIN_PASSWORD) generatedPassword = password;
  });
  return generatedPassword;
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function readJson(request, limit = 8192) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function bearerToken(request) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function findSession(database, request) {
  const token = bearerToken(request);
  const now = Date.now();
  database.sessions = database.sessions.filter(
    (session) => new Date(session.expiresAt).getTime() > now
  );
  const session = database.sessions.find((item) => item.token === token);
  if (!session) return null;
  const user = database.users.find((item) => item.id === session.userId);
  return user ? { session, user } : null;
}

function accrueUsage(user, session) {
  const now = Date.now();
  const lastActivity = new Date(session.lastActivity).getTime();
  const elapsed = Math.max(0, Math.floor((now - lastActivity) / 1000));
  if (elapsed <= 90) user.usageSeconds = (user.usageSeconds || 0) + elapsed;
  session.lastActivity = new Date(now).toISOString();
}

function isLoopback(address = "") {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function describeDevice(userAgent) {
  const device = /iPad/i.test(userAgent)
    ? "iPad"
    : /iPhone/i.test(userAgent)
      ? "iPhone"
      : /Macintosh/i.test(userAgent)
        ? "Mac"
        : /Android/i.test(userAgent)
          ? "Android"
          : "其他设备";
  const browser = /CriOS|Chrome/i.test(userAgent)
    ? "Chrome"
    : /Safari/i.test(userAgent)
      ? "Safari"
      : /Firefox/i.test(userAgent)
        ? "Firefox"
        : "其他浏览器";
  return `${device} / ${browser}`;
}

async function writeVisit(request, visitorId) {
  const viaCloudflare = Boolean(request.headers["cf-ray"]);
  const record = {
    time: new Date().toISOString(),
    source: viaCloudflare ? "外网" : "本地网络",
    ip: viaCloudflare
      ? request.headers["cf-connecting-ip"] || "未知"
      : request.socket.remoteAddress || "未知",
    country: viaCloudflare ? request.headers["cf-ipcountry"] || "未知" : "本地",
    device: describeDevice(request.headers["user-agent"] || ""),
    visitorId,
  };
  await fs.promises.mkdir(dataDirectory, { recursive: true });
  await fs.promises.appendFile(accessLogPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function renderAccessLog(response) {
  let contents = "";
  try {
    contents = await fs.promises.readFile(accessLogPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const records = contents
    .trim()
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    })
    .slice(-200)
    .reverse();
  const rows = records
    .map((record) => {
      const time = new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Toronto",
      }).format(new Date(record.time));
      return `<tr><td>${escapeHtml(time)}</td><td>${escapeHtml(record.source)}</td><td>${escapeHtml(record.ip)} / ${escapeHtml(record.country)}</td><td>${escapeHtml(record.device)}</td><td>${escapeHtml(String(record.visitorId).slice(0, 8))}</td></tr>`;
    })
    .join("");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="30"><title>KIDmath 访问记录</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:24px;background:#f4f5f7;color:#17191c}main{max-width:1100px;margin:auto}h1{margin:0 0 8px;font-size:28px}p{color:#5d626b;margin:0 0 20px}.table-wrap{overflow:auto;background:white;border:1px solid #d8dce2;border-radius:8px}table{border-collapse:collapse;width:100%;min-width:760px}th,td{text-align:left;padding:12px 14px;border-bottom:1px solid #e7e9ed;font-size:14px}th{background:#f8f9fa}tr:last-child td{border-bottom:0}.empty{text-align:center;color:#767b84;padding:32px}</style></head><body><main><h1>KIDmath 访问记录</h1><p>最近 ${records.length} 次打开记录，每 30 秒自动刷新。此页面只能在 Mac mini 本机查看。</p><div class="table-wrap"><table><thead><tr><th>时间</th><th>来源</th><th>IP / 地区</th><th>设备</th><th>设备识别码</th></tr></thead><tbody>${rows || '<tr><td class="empty" colspan="5">暂无访问记录</td></tr>'}</tbody></table></div></main></body></html>`;
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(html);
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/auth/login" && request.method === "POST") {
    const input = await readJson(request);
    const username = String(input.username || "").trim();
    const password = String(input.password || "");
    const result = await updateDatabase((database) => {
      const user = database.users.find(
        (item) => item.normalizedUsername === username.toLocaleLowerCase()
      );
      if (!user || !verifyPassword(password, user)) return null;
      const now = new Date();
      user.loginCount = (user.loginCount || 0) + 1;
      user.lastLogin = now.toISOString();
      const session = {
        token: crypto.randomBytes(32).toString("base64url"),
        userId: user.id,
        createdAt: now.toISOString(),
        lastActivity: now.toISOString(),
        expiresAt: new Date(now.getTime() + sessionLifetimeMs).toISOString(),
      };
      database.sessions.push(session);
      return { token: session.token, user: publicUser(user) };
    });
    if (!result) {
      sendJson(response, 401, { error: "INVALID_CREDENTIALS" });
      return true;
    }
    sendJson(response, 200, result);
    return true;
  }

  if (pathname === "/api/visit" && request.method === "POST") {
    const input = await readJson(request, 1024);
    const visitorId = String(input.visitorId || "").slice(0, 64);
    if (visitorId) await writeVisit(request, visitorId);
    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
    return true;
  }

  if (!pathname.startsWith("/api/")) return false;

  if (pathname === "/api/auth/me" && request.method === "GET") {
    const database = await loadDatabase();
    const authentication = findSession(database, request);
    if (!authentication) {
      sendJson(response, 401, { error: "UNAUTHORIZED" });
      return true;
    }
    sendJson(response, 200, { user: publicUser(authentication.user) });
    return true;
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    await updateDatabase((database) => {
      const authentication = findSession(database, request);
      if (authentication) accrueUsage(authentication.user, authentication.session);
      const token = bearerToken(request);
      database.sessions = database.sessions.filter((session) => session.token !== token);
    });
    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
    return true;
  }

  if (pathname === "/api/usage/heartbeat" && request.method === "POST") {
    const authenticated = await updateDatabase((database) => {
      const authentication = findSession(database, request);
      if (!authentication) return false;
      accrueUsage(authentication.user, authentication.session);
      return true;
    });
    if (!authenticated) {
      sendJson(response, 401, { error: "UNAUTHORIZED" });
      return true;
    }
    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
    return true;
  }

  if (pathname === "/api/admin/users" && request.method === "GET") {
    const database = await loadDatabase();
    const authentication = findSession(database, request);
    if (!authentication || authentication.user.role !== "admin") {
      sendJson(response, 403, { error: "FORBIDDEN" });
      return true;
    }
    const users = database.users
      .map(publicUser)
      .sort((left, right) => left.username.localeCompare(right.username));
    sendJson(response, 200, { users });
    return true;
  }

  if (pathname === "/api/admin/users" && request.method === "POST") {
    const input = await readJson(request);
    const username = String(input.username || "").trim();
    const password = String(input.password || "");
    const role = input.role === "admin" ? "admin" : "user";
    if (!validUsername(username) || !validPassword(password)) {
      sendJson(response, 400, { error: "INVALID_USER" });
      return true;
    }
    const result = await updateDatabase((database) => {
      const authentication = findSession(database, request);
      if (!authentication || authentication.user.role !== "admin") {
        return { status: 403, error: "FORBIDDEN" };
      }
      const exists = database.users.some(
        (user) => user.normalizedUsername === username.toLocaleLowerCase()
      );
      if (exists) return { status: 409, error: "USERNAME_EXISTS" };
      const user = createUser(username, password, role);
      database.users.push(user);
      return { status: 201, user: publicUser(user) };
    });
    sendJson(response, result.status, result.user ? { user: result.user } : { error: result.error });
    return true;
  }

  const passwordMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/);
  if (passwordMatch && request.method === "PUT") {
    const input = await readJson(request);
    const password = String(input.password || "");
    if (!validPassword(password)) {
      sendJson(response, 400, { error: "INVALID_PASSWORD" });
      return true;
    }
    const result = await updateDatabase((database) => {
      const authentication = findSession(database, request);
      if (!authentication || authentication.user.role !== "admin") return 403;
      const user = database.users.find((item) => item.id === passwordMatch[1]);
      if (!user) return 404;
      Object.assign(user, hashPassword(password));
      database.sessions = database.sessions.filter((session) => session.userId !== user.id);
      return 204;
    });
    if (result === 204) {
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
    } else {
      sendJson(response, result, { error: result === 403 ? "FORBIDDEN" : "NOT_FOUND" });
    }
    return true;
  }

  const deleteMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (deleteMatch && request.method === "DELETE") {
    const result = await updateDatabase((database) => {
      const authentication = findSession(database, request);
      if (!authentication || authentication.user.role !== "admin") {
        return { status: 403, error: "FORBIDDEN" };
      }
      const user = database.users.find((item) => item.id === deleteMatch[1]);
      if (!user) return { status: 404, error: "NOT_FOUND" };
      if (user.id === authentication.user.id) {
        return { status: 400, error: "CANNOT_DELETE_SELF" };
      }
      if (
        user.role === "admin" &&
        database.users.filter((item) => item.role === "admin").length <= 1
      ) {
        return { status: 400, error: "LAST_ADMIN" };
      }
      database.users = database.users.filter((item) => item.id !== user.id);
      database.sessions = database.sessions.filter((session) => session.userId !== user.id);
      return { status: 204 };
    });
    if (result.status === 204) {
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
    } else {
      sendJson(response, result.status, { error: result.error });
    }
    return true;
  }

  sendJson(response, 404, { error: "NOT_FOUND" });
  return true;
}

const server = http.createServer(async (request, response) => {
  try {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    if (await handleApi(request, response, pathname)) return;

    if (pathname === "/access-log" && request.method === "GET") {
      const isLocalRequest = isLoopback(request.socket.remoteAddress) && !request.headers["cf-ray"];
      if (isLocalRequest) {
        await renderAccessLog(response);
      } else {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
      }
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    if (pathname === "/") pathname = "/index.html";
    if (!publicFiles.has(pathname)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const filePath = path.join(root, pathname);
    const data = await fs.promises.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: "SERVER_ERROR" });
    else response.end();
  }
});

ensureInitialAdmin()
  .then((generatedPassword) => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`KIDmath listening on http://0.0.0.0:${port}`);
      if (generatedPassword) {
        console.log("Initial administrator username: admin");
        console.log(`Initial administrator password: ${generatedPassword}`);
      }
    });
  })
  .catch((error) => {
    console.error("Unable to initialize KIDmath:", error);
    process.exitCode = 1;
  });
