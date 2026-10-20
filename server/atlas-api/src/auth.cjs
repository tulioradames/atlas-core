'use strict';

const bcrypt = require('bcryptjs');
const { createMailer } = require('./mailer.cjs');
const {
  sha256,
  hmac,
  safeEqual,
  randomToken,
  bearerToken,
  sessionCookie,
  expiredSessionCookie,
  readJson,
  sendJson,
} = require('./security.cjs');

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    email_confirmed_at: row.email_confirmed_at,
    created_at: row.created_at,
    user_metadata: { name: row.nome || row.user_metadata?.name || '' },
  };
}

function authError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function createAuth(database, config) {
  const maxAgeSeconds = config.sessionDays * 24 * 60 * 60;
  const mailer = createMailer(config);
  const attempts = new Map();

  function enforceRate(req, action, maximum, windowMs) {
    const address = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const key = `${sha256(address).slice(0, 20)}:${action}`;
    const now = Date.now();
    let entry = attempts.get(key);
    if (!entry || entry.until <= now) entry = { count: 0, until: now + windowMs };
    entry.count += 1;
    attempts.set(key, entry);
    if (attempts.size > 5000) for (const [id, value] of attempts) if (value.until <= now) attempts.delete(id);
    if (entry.count > maximum) throw authError('Muitas tentativas. Aguarde alguns minutos.', 429);
  }

  async function createSession(client, account, req) {
    const token = randomToken(36);
    const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
    const userAgentHash = sha256(req.headers['user-agent'] || '').slice(0, 32);
    const forwarded = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const ipHash = sha256(forwarded).slice(0, 32);
    await client.query(
      `insert into public.atlas_sessions (user_id, token_hash, expires_at, user_agent_hash, ip_hash)
       values ($1, $2, $3, $4, $5)`,
      [account.id, sha256(token), expiresAt, userAgentHash, ipHash],
    );
    return { token, expiresAt };
  }

  function sessionPayload(session, account) {
    const user = publicUser(account);
    return {
      access_token: session.token,
      expires_at: Math.floor(new Date(session.expiresAt).getTime() / 1000),
      user,
    };
  }

  async function sessionFromRequest(req, options = {}) {
    const token = bearerToken(req);
    if (!token) return null;
    const result = await database.pool.query(
      `select a.id, a.email, a.email_confirmed_at, a.status as account_status, a.created_at,
              s.id as session_id, s.expires_at
         from public.atlas_sessions s
         join public.atlas_accounts a on a.id = s.user_id
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
        limit 1`,
      [sha256(token)],
    );
    const row = result.rows[0];
    if (!row || row.account_status === 'blocked') return null;
    const profile = await readOwnProfile(row.id);
    if (!profile || profile.status === 'bloqueado') return null;
    Object.assign(row, { nome: profile.nome, role: profile.role, profile_status: profile.status });
    if (options.touch !== false) {
      void database.pool.query('update public.atlas_sessions set last_seen_at = now() where id = $1', [row.session_id]).catch(() => {});
    }
    return { token, user: publicUser(row), profile: row, sessionId: row.session_id, expiresAt: row.expires_at };
  }

  async function readOwnProfile(userId) {
    return database.transaction(async (client) => {
      const result = await client.query('select nome, role, status from public.atlas_profiles where id = $1', [userId]);
      return result.rows[0] || null;
    }, userId);
  }

  async function requireSession(req) {
    const session = await sessionFromRequest(req);
    if (session) return session;
    throw authError('Sessao ausente ou expirada. Entre novamente.', 401);
  }

  async function issueCode(client, email, purpose, payload = {}) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = hmac(config.linkSecret, `${purpose}:${normalizeEmail(email)}:${code}`);
    await client.query(
      `update public.atlas_one_time_codes set consumed_at = now()
        where lower(email) = $1 and purpose = $2 and consumed_at is null`,
      [normalizeEmail(email), purpose],
    );
    await client.query(
      `insert into public.atlas_one_time_codes (user_id, email, purpose, code_hash, payload, expires_at)
       values ($1, $2, $3, $4, $5::jsonb, now() + interval '15 minutes')`,
      [payload.userId || null, normalizeEmail(email), purpose, codeHash, JSON.stringify(payload)],
    );
    return code;
  }

  async function consumeCode(client, email, purpose, code) {
    const expected = hmac(config.linkSecret, `${purpose}:${normalizeEmail(email)}:${String(code || '')}`);
    const result = await client.query(
      `select * from public.atlas_one_time_codes
        where lower(email) = $1 and purpose = $2 and consumed_at is null and expires_at > now()
        order by created_at desc limit 1 for update`,
      [normalizeEmail(email), purpose],
    );
    const row = result.rows[0];
    if (!row || row.attempts >= 6 || !safeEqual(row.code_hash, expected)) {
      if (row) await client.query('update public.atlas_one_time_codes set attempts = attempts + 1 where id = $1', [row.id]);
      throw authError('Codigo incorreto ou vencido.', 400);
    }
    await client.query('update public.atlas_one_time_codes set consumed_at = now() where id = $1', [row.id]);
    return row;
  }

  async function login(req, res) {
    enforceRate(req, 'login', 12, 15 * 60 * 1000);
    const body = await readJson(req, 64 * 1024);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    if (!email || password.length < 8) throw authError('E-mail ou senha incorretos.', 401);
    const result = await database.pool.query(
      `select a.*
         from public.atlas_accounts a
        where lower(a.email) = $1 limit 1`,
      [email],
    );
    const account = result.rows[0];
    const valid = account?.password_hash && await bcrypt.compare(password, account.password_hash);
    if (!valid || account.status === 'blocked') {
      throw authError('E-mail ou senha incorretos.', 401);
    }
    const profile = await readOwnProfile(account.id);
    if (!profile || profile.status === 'bloqueado') throw authError('Acesso bloqueado. Fale com o administrador.', 403);
    Object.assign(account, { nome: profile.nome, role: profile.role, profile_status: profile.status });
    const session = await database.transaction((client) => createSession(client, account, req));
    sendJson(res, 200, { data: { session: sessionPayload(session, account), user: publicUser(account) }, error: null }, {
      'Set-Cookie': sessionCookie(session.token, maxAgeSeconds),
    });
  }

  async function signup(req, res) {
    enforceRate(req, 'signup', 5, 60 * 60 * 1000);
    const body = await readJson(req, 64 * 1024);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const name = String(body.options?.data?.nome || body.name || '').trim().slice(0, 120);
    if (!/^\S+@\S+\.\S+$/.test(email)) throw authError('E-mail invalido.');
    if (password.length < 8) throw authError('A senha precisa ter pelo menos 8 caracteres.');
    if (!name) throw authError('Informe seu nome.');
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await database.transaction(async (client) => {
      const duplicate = await client.query('select 1 from public.atlas_accounts where lower(email) = $1', [email]);
      if (duplicate.rowCount) throw authError('Este e-mail ja foi cadastrado.', 409);
      const accountResult = await client.query(
        'select * from public.atlas_api_create_pending_account($1, $2, $3)',
        [email, passwordHash, name],
      );
      const account = accountResult.rows[0];
      const session = await createSession(client, { ...account, nome: name }, req);
      return { account: { ...account, nome: name }, session };
    });
    sendJson(res, 200, { data: { session: sessionPayload(result.session, result.account), user: publicUser(result.account) }, error: null }, {
      'Set-Cookie': sessionCookie(result.session.token, maxAgeSeconds),
    });
  }

  async function requestRecovery(req, res) {
    enforceRate(req, 'recovery', 5, 60 * 60 * 1000);
    const body = await readJson(req, 32 * 1024);
    const email = normalizeEmail(body.email);
    const accountResult = await database.pool.query('select id, email from public.atlas_accounts where lower(email) = $1 limit 1', [email]);
    const account = accountResult.rows[0];
    if (account) {
      const code = await database.transaction((client) => issueCode(client, account.email, 'recovery', { userId: account.id }));
      await mailer.sendCode({ to: account.email, code, purpose: 'recovery' });
    }
    sendJson(res, 200, { data: {}, error: null });
  }

  async function verifyOtp(req, res) {
    enforceRate(req, 'verify', 12, 15 * 60 * 1000);
    const body = await readJson(req, 32 * 1024);
    const email = normalizeEmail(body.email);
    const purpose = String(body.type || '');
    if (!['recovery', 'email_change'].includes(purpose)) throw authError('Tipo de codigo invalido.');
    const result = await database.transaction(async (client) => {
      const code = await consumeCode(client, email, purpose, body.token);
      if (purpose === 'recovery') {
        const accountResult = await client.query('select * from public.atlas_accounts where id = $1', [code.user_id]);
        const account = accountResult.rows[0];
        if (!account) throw authError('Conta nao encontrada.', 404);
        const session = await createSession(client, account, req);
        return { account, session };
      }
      const pairId = code.payload?.pairId;
      const newEmail = normalizeEmail(code.payload?.newEmail);
      const userId = code.user_id;
      const pair = await client.query(
        `select count(*)::integer as total from public.atlas_one_time_codes
          where user_id = $1 and purpose = 'email_change' and payload->>'pairId' = $2 and consumed_at is not null`,
        [userId, pairId],
      );
      if (pair.rows[0]?.total >= 2 && newEmail) {
        const duplicate = await client.query('select 1 from public.atlas_accounts where lower(email) = $1 and id <> $2', [newEmail, userId]);
        if (duplicate.rowCount) throw authError('Ja existe uma conta com esse e-mail.', 409);
        await client.query('update public.atlas_accounts set email = $1, updated_at = now() where id = $2', [newEmail, userId]);
        await client.query('update public.atlas_profiles set email = $1, updated_at = now() where id = $2', [newEmail, userId]);
      }
      return {};
    });
    sendJson(res, 200, { data: result.session ? { session: sessionPayload(result.session, result.account), user: publicUser(result.account) } : {}, error: null }, result.session ? {
      'Set-Cookie': sessionCookie(result.session.token, maxAgeSeconds),
    } : {});
  }

  async function updateUser(req, res) {
    const session = await requireSession(req);
    const body = await readJson(req, 64 * 1024);
    if (body.password !== undefined) {
      const password = String(body.password || '');
      if (password.length < 8) throw authError('A senha precisa ter pelo menos 8 caracteres.');
      const hash = await bcrypt.hash(password, 12);
      await database.transaction(async (client) => {
        await client.query('update public.atlas_accounts set password_hash = $1, updated_at = now() where id = $2', [hash, session.user.id]);
        await client.query('update public.atlas_sessions set revoked_at = now() where user_id = $1 and id <> $2', [session.user.id, session.sessionId]);
      });
      return sendJson(res, 200, { data: { user: session.user }, error: null });
    }
    if (body.email !== undefined) {
      enforceRate(req, 'email-change', 4, 60 * 60 * 1000);
      const newEmail = normalizeEmail(body.email);
      if (!/^\S+@\S+\.\S+$/.test(newEmail) || newEmail === normalizeEmail(session.user.email)) throw authError('Informe um e-mail novo e valido.');
      const pairId = randomToken(16);
      const codes = await database.transaction(async (client) => ({
        current: await issueCode(client, session.user.email, 'email_change', { userId: session.user.id, pairId, newEmail }),
        next: await issueCode(client, newEmail, 'email_change', { userId: session.user.id, pairId, newEmail }),
      }));
      await Promise.all([
        mailer.sendCode({ to: session.user.email, code: codes.current, purpose: 'email_change', newEmail }),
        mailer.sendCode({ to: newEmail, code: codes.next, purpose: 'email_change', newEmail }),
      ]);
      return sendJson(res, 200, { data: { user: session.user }, error: null });
    }
    throw authError('Nenhuma alteracao foi informada.');
  }

  async function getSession(req, res) {
    const session = await sessionFromRequest(req);
    sendJson(res, 200, { data: { session: session ? sessionPayload(session, session.user) : null }, error: null });
  }

  async function logout(req, res) {
    const token = bearerToken(req);
    if (token) await database.pool.query('update public.atlas_sessions set revoked_at = now() where token_hash = $1', [sha256(token)]);
    sendJson(res, 200, { data: {}, error: null }, { 'Set-Cookie': expiredSessionCookie() });
  }

  return {
    login,
    signup,
    requestRecovery,
    verifyOtp,
    updateUser,
    getSession,
    logout,
    requireSession,
    sessionFromRequest,
    normalizeEmail,
    publicUser,
  };
}

module.exports = { createAuth, normalizeEmail, publicUser };
