const http = require("http");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

const root = path.resolve(__dirname);
const port = Number(process.env.PORT || 4173);
const databaseUrl = process.env.DATABASE_URL || "";
const fallbackFile = path.join(root, "data", "settings.json");
const fallbackUsersFile = path.join(root, "data", "users.json");
const sessions = new Map();
const sessionCookie = "clinic_admin_session";
const csrfHeader = "x-csrf-token";

let pool = null;
if (databaseUrl) {
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
  });
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8"
};

const defaultSettings = {
  clinicName: "Sorri + Vida",
  slogan: "Cuidando do seu sorriso com carinho, tecnologia e confiança.",
  heroTitle: "Sorrisos saudáveis começam com cuidado de verdade.",
  homeText:
    "Na Sorri + Vida, oferecemos atendimento odontológico humanizado para toda a família, unindo profissionais qualificados, estrutura confortável e cuidado em cada detalhe.",
  ctaText: "Agende sua avaliação",
  ctaHref: "https://wa.me/5511999999999?text=Olá!%20Quero%20agendar%20uma%20avaliação.",
  phone: "(11) 9999-9999",
  whatsapp: "(11) 99999-9999",
  email: "contato@clinica.com.br",
  hours: "Segunda a sexta, das 8h às 18h. Sábado, das 8h às 12h.",
  address: "Av. Brasil, 1000 - Centro, São Paulo - SP",
  mapsLink: "https://www.google.com/maps",
  mapsEmbed:
    '<iframe src="https://www.google.com/maps?q=Av.%20Brasil%201000%20Centro%20Sao%20Paulo&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>',
  heroImage: "./assets/clinic-hero.png",
  aboutTitle: "Clínica Sorri + Vida",
  aboutText:
    "Somos uma clínica odontológica focada em acolhimento, prevenção e tratamentos personalizados. Nosso compromisso é tornar cada consulta mais tranquila, clara e segura.",
  mission: "Cuidar da saúde bucal com excelência, respeito e atenção aos detalhes.",
  vision: "Ser referência em odontologia humanizada e acessível na região.",
  values: "Ética, acolhimento, transparência, tecnologia e compromisso com o paciente.",
  aboutImage: "./assets/clinic-hero.png",
  theme: {
    ink: "#17313b",
    muted: "#5c727b",
    line: "#dbe8e9",
    paper: "#ffffff",
    soft: "#f5fbfa",
    aqua: "#35c5b2",
    blue: "#4d8fcb",
    green: "#7acb84",
    coral: "#ff8f70"
  },
  highlights: [
    { title: "Atendimento humanizado", description: "Escuta ativa e orientação clara em cada etapa." },
    { title: "Profissionais qualificados", description: "Equipe preparada para diferentes necessidades." },
    { title: "Tecnologia e conforto", description: "Ambiente moderno para consultas mais tranquilas." },
    { title: "Localização acessível", description: "Fácil acesso para rotina, família e trabalho." }
  ],
  differentials: [
    { title: "Atendimento humanizado", description: "Acolhimento desde o primeiro contato." },
    { title: "Ambiente moderno", description: "Estrutura leve, limpa e confortável." },
    { title: "Especialistas", description: "Planejamento cuidadoso para cada caso." },
    { title: "Tratamentos personalizados", description: "Condutas alinhadas com o seu objetivo." },
    { title: "Fácil acesso", description: "Localização prática para o dia a dia." }
  ],
  carouselImages: [
    { src: "./assets/clinic-hero.png", title: "Recepção acolhedora", description: "Um primeiro contato leve, organizado e confortável." },
    { src: "./assets/clinic-hero.png", title: "Consultórios modernos", description: "Tecnologia e cuidado para tratamentos mais seguros." },
    { src: "./assets/clinic-hero.png", title: "Cuidado para toda a família", description: "Atendimento claro, preventivo e humanizado." }
  ]
};

init()
  .then(() => {
    http.createServer(handleRequest).listen(port, "0.0.0.0", () => {
      console.log(`Sorri + Vida rodando em http://0.0.0.0:${port}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao iniciar o servidor", error);
    process.exit(1);
  });

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);

    if (req.method === "GET" && url.pathname === "/config.js") {
      sendText(res, 200, "application/javascript; charset=utf-8", `window.CLINIC_ADMIN_CONFIG = ${JSON.stringify({ ADMIN_USER: process.env.ADMIN_USER || "admin" })};`);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      if (pool) await pool.query("select 1");
      sendJson(res, 200, { ok: true, database: Boolean(pool) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const session = getSession(req);
      sendJson(res, 200, {
        authenticated: Boolean(session),
        user: session ? { username: session.username } : null,
        csrfToken: session?.csrfToken || null
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readJson(req);
      const user = await findUserByUsername(body.user || "");
      if (!user || !(await verifyPassword(body.password || "", user.password_hash))) {
        sendJson(res, 401, { ok: false, error: "Credenciais inválidas." });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      const csrfToken = crypto.randomBytes(32).toString("hex");
      sessions.set(token, { username: user.username, csrfToken, createdAt: Date.now() });
      res.setHeader("Set-Cookie", serializeCookie(sessionCookie, token));
      sendJson(res, 200, { ok: true, csrfToken, user: { username: user.username, displayName: user.display_name } });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      const token = getCookie(req, sessionCookie);
      if (token) sessions.delete(token);
      res.setHeader("Set-Cookie", `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/settings") {
      sendJson(res, 200, await readSettings());
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/settings") {
      if (!requireAdmin(req, res) || !requireCsrf(req, res)) return;
      const nextSettings = normalizeSettings(await readJson(req));
      await writeSettings(nextSettings);
      sendJson(res, 200, { ok: true, settings: nextSettings });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      if (!requireAdmin(req, res)) return;
      sendJson(res, 200, { users: await listUsers() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/users") {
      if (!requireAdmin(req, res) || !requireCsrf(req, res)) return;
      const body = await readJson(req);
      const created = await createUser(body.username, body.password, body.displayName);
      sendJson(res, 201, { ok: true, user: created });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/users/")) {
      if (!requireAdmin(req, res) || !requireCsrf(req, res)) return;
      const username = decodeURIComponent(url.pathname.replace("/api/users/", ""));
      await deleteUser(username);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      if (getSession(req)) {
        redirect(res, "/admin/painel");
        return;
      }
      await sendFile(res, path.join(root, "admin-login.html"));
      return;
    }

    if (url.pathname === "/admin/painel") {
      if (!getSession(req)) {
        redirect(res, "/admin/");
        return;
      }
      await sendFile(res, path.join(root, "admin-panel.html"));
      return;
    }

    const staticPath = resolveStaticPath(url.pathname);
    if (staticPath) {
      await sendFile(res, staticPath);
      return;
    }

    await sendFile(res, path.join(root, "index.html"));
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
}

function resolveStaticPath(urlPath) {
  const requested = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath);
  const filePath = path.resolve(path.join(root, requested));
  return filePath.startsWith(root) ? filePath : "";
}

async function sendFile(res, filePath) {
  try {
    const stat = await fs.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const content = await fs.readFile(finalPath);
    sendText(res, 200, mime[path.extname(finalPath)] || "application/octet-stream", content);
  } catch {
    const fallback = await fs.readFile(path.join(root, "index.html"));
    sendText(res, 200, mime[".html"], fallback);
  }
}

function sendJson(res, status, data) {
  sendText(res, status, "application/json; charset=utf-8", JSON.stringify(data));
}

function sendText(res, status, contentType, content) {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(content);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Payload muito grande."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
    req.on("error", reject);
  });
}

async function init() {
  if (!pool) {
    await fs.mkdir(path.dirname(fallbackFile), { recursive: true });
    try {
      await fs.access(fallbackFile);
    } catch {
      await fs.writeFile(fallbackFile, JSON.stringify(defaultSettings, null, 2));
    }
    await ensureDefaultUser();
    return;
  }

  await pool.query(`
    create table if not exists site_settings (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists admin_users (
      username text primary key,
      display_name text not null default '',
      password_hash text not null,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(
    `
    insert into site_settings (id, data)
    values ('main', $1::jsonb)
    on conflict (id) do nothing
    `,
    [JSON.stringify(defaultSettings)]
  );

  await ensureDefaultUser();
}

async function readSettings() {
  if (!pool) {
    try {
      return normalizeSettings(JSON.parse(await fs.readFile(fallbackFile, "utf8")));
    } catch {
      return defaultSettings;
    }
  }

  const result = await pool.query("select data from site_settings where id = 'main'");
  return normalizeSettings(result.rows[0]?.data || {});
}

async function writeSettings(settings) {
  if (!pool) {
    await fs.mkdir(path.dirname(fallbackFile), { recursive: true });
    await fs.writeFile(fallbackFile, JSON.stringify(settings, null, 2));
    return;
  }

  await pool.query(
    `
    insert into site_settings (id, data, updated_at)
    values ('main', $1::jsonb, now())
    on conflict (id) do update
      set data = excluded.data,
          updated_at = now()
    `,
    [JSON.stringify(settings)]
  );
}

function normalizeSettings(input = {}) {
  return {
    ...defaultSettings,
    ...input,
    theme: normalizeTheme(input.theme),
    highlights: Array.isArray(input.highlights) ? input.highlights : defaultSettings.highlights,
    differentials: Array.isArray(input.differentials) ? input.differentials : defaultSettings.differentials,
    carouselImages: Array.isArray(input.carouselImages) ? input.carouselImages : defaultSettings.carouselImages
  };
}

function normalizeTheme(theme = {}) {
  return Object.fromEntries(
    Object.entries(defaultSettings.theme).map(([key, fallback]) => {
      const value = String(theme[key] || fallback).trim();
      return [key, /^#[0-9a-f]{6}$/i.test(value) ? value : fallback];
    })
  );
}

function requireAdmin(req, res) {
  if (!getSession(req)) {
    sendJson(res, 401, { ok: false, error: "Login obrigatório." });
    return false;
  }
  return true;
}

function requireCsrf(req, res) {
  const session = getSession(req);
  if (!session || req.headers[csrfHeader] !== session.csrfToken) {
    sendJson(res, 403, { ok: false, error: "Token de segurança inválido." });
    return false;
  }
  return true;
}

function getSession(req) {
  const token = getCookie(req, sessionCookie);
  return token ? sessions.get(token) : null;
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";").map((cookie) => cookie.trim());
  const prefix = `${name}=`;
  const found = cookies.find((cookie) => cookie.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : "";
}

function serializeCookie(name, value) {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${secure}`;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

async function ensureDefaultUser() {
  const rawAdminUser = process.env.ADMIN_USER || "admin";
  const adminUser = normalizeUsername(rawAdminUser) || "admin";
  let adminPassword = String(process.env.ADMIN_PASSWORD || "Admin@12345");

  if (adminUser !== rawAdminUser) {
    console.warn(`ADMIN_USER inválido ou normalizado. Usando "${adminUser}".`);
  }

  if (adminPassword.length < 8) {
    adminPassword = crypto.randomBytes(12).toString("base64url");
    console.warn(`ADMIN_PASSWORD inválido ou curto. Senha temporária gerada para "${adminUser}": ${adminPassword}`);
  }

  const existing = await findUserByUsername(adminUser);
  if (!existing) {
    await createUser(adminUser, adminPassword, "Administrador");
    console.log(`Usuário admin inicial criado: ${adminUser}`);
    return;
  }

  if (process.env.RESET_ADMIN_PASSWORD_ON_START === "true") {
    await createUser(adminUser, adminPassword, existing.display_name || "Administrador");
    console.log(`Senha do usuário admin redefinida via RESET_ADMIN_PASSWORD_ON_START: ${adminUser}`);
    return;
  }

  console.log(`Usuário admin inicial já existe: ${adminUser}`);
}

async function findUserByUsername(username) {
  const safeUsername = normalizeUsername(username);
  if (!safeUsername) return null;
  if (pool) {
    const result = await pool.query(
      "select username, display_name, password_hash, created_at from admin_users where username = $1",
      [safeUsername]
    );
    return result.rows[0] || null;
  }
  const users = await readUsersFile();
  return users.find((user) => user.username === safeUsername) || null;
}

async function listUsers() {
  if (pool) {
    const result = await pool.query(
      "select username, display_name, created_at from admin_users order by created_at asc"
    );
    return result.rows.map((user) => ({
      username: user.username,
      displayName: user.display_name,
      createdAt: user.created_at
    }));
  }
  const users = await readUsersFile();
  return users.map((user) => ({
    username: user.username,
    displayName: user.display_name,
    createdAt: user.created_at
  }));
}

async function createUser(username, password, displayName = "") {
  const safeUsername = normalizeUsername(username);
  if (!safeUsername || safeUsername.length < 3) throw new Error("Usuário inválido.");
  if (!password || String(password).length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const passwordHash = await hashPassword(String(password));
  const safeDisplayName = String(displayName || "");

  if (pool) {
    await pool.query(
      `
      insert into admin_users (username, display_name, password_hash)
      values ($1, $2, $3)
      on conflict (username) do update
        set display_name = excluded.display_name,
            password_hash = excluded.password_hash
      `,
      [safeUsername, safeDisplayName, passwordHash]
    );
    return { username: safeUsername, displayName: safeDisplayName };
  }

  const users = await readUsersFile();
  const nextUsers = users.filter((user) => user.username !== safeUsername);
  nextUsers.push({
    username: safeUsername,
    display_name: safeDisplayName,
    password_hash: passwordHash,
    created_at: new Date().toISOString()
  });
  await writeUsersFile(nextUsers);
  return { username: safeUsername, displayName: safeDisplayName };
}

async function deleteUser(username) {
  const safeUsername = normalizeUsername(username);
  const users = await listUsers();
  if (users.length <= 1) throw new Error("Não é possível remover o último usuário.");

  if (pool) {
    await pool.query("delete from admin_users where username = $1", [safeUsername]);
    return;
  }

  await writeUsersFile((await readUsersFile()).filter((user) => user.username !== safeUsername));
}

async function readUsersFile() {
  try {
    return JSON.parse(await fs.readFile(fallbackUsersFile, "utf8"));
  } catch {
    return [];
  }
}

async function writeUsersFile(users) {
  await fs.mkdir(path.dirname(fallbackUsersFile), { recursive: true });
  await fs.writeFile(fallbackUsersFile, JSON.stringify(users, null, 2));
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const digest = "sha512";
  const hash = await pbkdf2(password, salt, iterations, 64, digest);
  return `pbkdf2$${digest}$${iterations}$${salt}$${hash}`;
}

async function verifyPassword(password, stored) {
  const [scheme, digest, iterationText, salt, hash] = String(stored || "").split("$");
  if (scheme !== "pbkdf2" || !digest || !iterationText || !salt || !hash) return false;
  const candidate = await pbkdf2(password, salt, Number(iterationText), Buffer.from(hash, "hex").length, digest);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

function pbkdf2(password, salt, iterations, keylen, digest) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keylen, digest, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey.toString("hex"));
    });
  });
}
