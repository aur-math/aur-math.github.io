const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hashPassword(password, existingSalt = "") {
  const salt = existingSalt
    ? base64UrlToBytes(existingSalt)
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
    key,
    256
  );
  return {
    salt: bytesToBase64Url(salt),
    passwordHash: bytesToBase64Url(new Uint8Array(bits)),
  };
}

function constantTimeEqual(left, right) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function verifyPassword(password, user) {
  const result = await hashPassword(password, user.password_salt);
  return constantTimeEqual(result.passwordHash, user.password_hash);
}

function normalizeUsername(username) {
  return username.trim().toLocaleLowerCase();
}

function validUsername(username) {
  return /^[\p{L}\p{N}_.-]{2,32}$/u.test(username);
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    loginCount: row.login_count || 0,
    usageSeconds: row.usage_seconds || 0,
    createdAt: row.created_at,
    lastLogin: row.last_login || null,
  };
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = String(
    env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "https://aur-math.github.io"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return origin && allowedOrigins.includes(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      }
    : {};
}

function json(request, env, payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(request, env),
    },
  });
}

function empty(request, env, status = 204) {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store", ...corsHeaders(request, env) },
  });
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 8192) throw new Error("INVALID_JSON");
  return request.json();
}

function bearerToken(request) {
  const authorization = request.headers.get("Authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

async function authenticate(request, env) {
  const token = bearerToken(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT
       s.token, s.last_activity, s.expires_at,
       u.id, u.username, u.role, u.login_count, u.usage_seconds,
       u.created_at, u.last_login
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?1 AND s.expires_at > ?2`
  )
    .bind(token, new Date().toISOString())
    .first();
  return row ? { token, row } : null;
}

async function createInitialAdminIfNeeded(env, username, password) {
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
  if (Number(count.count) > 0) return null;
  const initialUsername = env.INITIAL_ADMIN_USERNAME || "admin";
  if (normalizeUsername(username) !== normalizeUsername(initialUsername)) return null;
  if (!env.INITIAL_ADMIN_PASSWORD || password !== env.INITIAL_ADMIN_PASSWORD) return null;

  const credentials = await hashPassword(password);
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    username: initialUsername,
    normalizedUsername: normalizeUsername(initialUsername),
    role: "admin",
    ...credentials,
    createdAt: now,
  };
  await env.DB.prepare(
    `INSERT INTO users
      (id, username, normalized_username, role, password_salt, password_hash, created_at)
     VALUES (?1, ?2, ?3, 'admin', ?4, ?5, ?6)`
  )
    .bind(
      user.id,
      user.username,
      user.normalizedUsername,
      user.salt,
      user.passwordHash,
      user.createdAt
    )
    .run();
  return env.DB.prepare("SELECT * FROM users WHERE id = ?1").bind(user.id).first();
}

async function login(request, env) {
  const input = await readJson(request);
  const username = String(input.username || "").trim();
  const password = String(input.password || "");
  let user = await env.DB.prepare("SELECT * FROM users WHERE normalized_username = ?1")
    .bind(normalizeUsername(username))
    .first();
  if (!user) user = await createInitialAdminIfNeeded(env, username, password);
  if (!user || !(await verifyPassword(password, user))) {
    return json(request, env, { error: "INVALID_CREDENTIALS" }, 401);
  }

  const now = new Date();
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE users SET login_count = login_count + 1, last_login = ?1 WHERE id = ?2"
    ).bind(now.toISOString(), user.id),
    env.DB.prepare(
      `INSERT INTO sessions (token, user_id, created_at, last_activity, expires_at)
       VALUES (?1, ?2, ?3, ?3, ?4)`
    ).bind(
      token,
      user.id,
      now.toISOString(),
      new Date(now.getTime() + sessionLifetimeMs).toISOString()
    ),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now.toISOString()),
  ]);
  user.login_count = Number(user.login_count || 0) + 1;
  user.last_login = now.toISOString();
  return json(request, env, { token, user: publicUser(user) });
}

async function accrueUsage(env, authentication) {
  const now = new Date();
  const elapsed = Math.max(
    0,
    Math.floor((now.getTime() - new Date(authentication.row.last_activity).getTime()) / 1000)
  );
  const increment = elapsed <= 90 ? elapsed : 0;
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE users SET usage_seconds = usage_seconds + ?1 WHERE id = ?2"
    ).bind(increment, authentication.row.id),
    env.DB.prepare("UPDATE sessions SET last_activity = ?1 WHERE token = ?2").bind(
      now.toISOString(),
      authentication.token
    ),
  ]);
}

async function requireAdmin(request, env) {
  const authentication = await authenticate(request, env);
  return authentication?.row.role === "admin" ? authentication : null;
}

async function handleRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/api/auth/login" && request.method === "POST") {
    return login(request, env);
  }

  if (pathname === "/api/visit" && request.method === "POST") {
    return empty(request, env);
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    const authentication = await authenticate(request, env);
    return authentication
      ? json(request, env, { user: publicUser(authentication.row) })
      : json(request, env, { error: "UNAUTHORIZED" }, 401);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const authentication = await authenticate(request, env);
    if (authentication) await accrueUsage(env, authentication);
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?1")
      .bind(bearerToken(request))
      .run();
    return empty(request, env);
  }

  if (pathname === "/api/usage/heartbeat" && request.method === "POST") {
    const authentication = await authenticate(request, env);
    if (!authentication) return json(request, env, { error: "UNAUTHORIZED" }, 401);
    await accrueUsage(env, authentication);
    return empty(request, env);
  }

  if (pathname === "/api/admin/users" && request.method === "GET") {
    if (!(await requireAdmin(request, env))) {
      return json(request, env, { error: "FORBIDDEN" }, 403);
    }
    const result = await env.DB.prepare(
      `SELECT id, username, role, login_count, usage_seconds, created_at, last_login
       FROM users ORDER BY normalized_username`
    ).all();
    return json(request, env, { users: result.results.map(publicUser) });
  }

  if (pathname === "/api/admin/users" && request.method === "POST") {
    if (!(await requireAdmin(request, env))) {
      return json(request, env, { error: "FORBIDDEN" }, 403);
    }
    const input = await readJson(request);
    const username = String(input.username || "").trim();
    const password = String(input.password || "");
    const role = input.role === "admin" ? "admin" : "user";
    if (!validUsername(username) || !validPassword(password)) {
      return json(request, env, { error: "INVALID_USER" }, 400);
    }
    const exists = await env.DB.prepare(
      "SELECT id FROM users WHERE normalized_username = ?1"
    )
      .bind(normalizeUsername(username))
      .first();
    if (exists) return json(request, env, { error: "USERNAME_EXISTS" }, 409);

    const credentials = await hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      username,
      normalizedUsername: normalizeUsername(username),
      role,
      ...credentials,
      login_count: 0,
      usage_seconds: 0,
      created_at: new Date().toISOString(),
      last_login: null,
    };
    await env.DB.prepare(
      `INSERT INTO users
        (id, username, normalized_username, role, password_salt, password_hash, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
      .bind(
        user.id,
        user.username,
        user.normalizedUsername,
        user.role,
        user.salt,
        user.passwordHash,
        user.created_at
      )
      .run();
    return json(request, env, { user: publicUser(user) }, 201);
  }

  const passwordMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/);
  if (passwordMatch && request.method === "PUT") {
    if (!(await requireAdmin(request, env))) {
      return json(request, env, { error: "FORBIDDEN" }, 403);
    }
    const input = await readJson(request);
    const password = String(input.password || "");
    if (!validPassword(password)) {
      return json(request, env, { error: "INVALID_PASSWORD" }, 400);
    }
    const user = await env.DB.prepare("SELECT id FROM users WHERE id = ?1")
      .bind(passwordMatch[1])
      .first();
    if (!user) return json(request, env, { error: "NOT_FOUND" }, 404);
    const credentials = await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET password_salt = ?1, password_hash = ?2 WHERE id = ?3"
      ).bind(credentials.salt, credentials.passwordHash, user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(user.id),
    ]);
    return empty(request, env);
  }

  const deleteMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (deleteMatch && request.method === "DELETE") {
    const authentication = await requireAdmin(request, env);
    if (!authentication) return json(request, env, { error: "FORBIDDEN" }, 403);
    const user = await env.DB.prepare("SELECT id, role FROM users WHERE id = ?1")
      .bind(deleteMatch[1])
      .first();
    if (!user) return json(request, env, { error: "NOT_FOUND" }, 404);
    if (user.id === authentication.row.id) {
      return json(request, env, { error: "CANNOT_DELETE_SELF" }, 400);
    }
    if (user.role === "admin") {
      const count = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"
      ).first();
      if (Number(count.count) <= 1) {
        return json(request, env, { error: "LAST_ADMIN" }, 400);
      }
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(user.id),
      env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(user.id),
    ]);
    return empty(request, env);
  }

  return json(request, env, { error: "NOT_FOUND" }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(error);
      return json(request, env, { error: "SERVER_ERROR" }, 500);
    }
  },
};
