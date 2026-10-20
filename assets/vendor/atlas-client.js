(function atlasClientFactory(global) {
  'use strict';

  function apiError(payload, status) {
    const message = typeof payload?.error === 'string'
      ? payload.error
      : payload?.error?.message || payload?.message || `Falha HTTP ${status}`;
    return { message, status, code: payload?.code || String(status) };
  }

  function createClient(baseUrl) {
    const base = String(baseUrl || '').replace(/\/+$/, '');
    let currentSession = null;
    const listeners = new Set();

    async function request(route, options = {}) {
      try {
        const headers = new Headers(options.headers || {});
        if (currentSession?.access_token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${currentSession.access_token}`);
        }
        if (options.json !== undefined) headers.set('Content-Type', 'application/json');
        const response = await fetch(`${base}${route}`, {
          method: options.method || 'GET',
          credentials: 'include',
          headers,
          body: options.json === undefined ? options.body : JSON.stringify(options.json),
          signal: options.signal,
        });
        const type = String(response.headers.get('content-type') || '');
        const payload = type.includes('application/json') ? await response.json() : await response.text();
        if (!response.ok) return { data: null, error: apiError(payload, response.status), count: null };
        return payload;
      } catch (error) {
        return { data: null, error: { message: error?.message || 'Nao foi possivel alcancar o servidor Atlas.', status: 0 }, count: null };
      }
    }

    function emit(event, session) {
      for (const listener of listeners) queueMicrotask(() => listener(event, session));
    }

    class QueryBuilder {
      constructor(table) {
        this.request = { table, operation: 'select', select: '*', filters: [], orders: [] };
      }
      select(columns = '*', options = {}) {
        if (this.request.operation === 'select') this.request.select = columns;
        else this.request.returning = columns;
        if (options.head) this.request.head = true;
        if (options.count) this.request.count = options.count;
        return this;
      }
      insert(values) { this.request.operation = 'insert'; this.request.values = values; return this; }
      upsert(values, options = {}) { this.request.operation = 'upsert'; this.request.values = values; this.request.onConflict = options.onConflict; return this; }
      update(values) { this.request.operation = 'update'; this.request.values = values; return this; }
      delete() { this.request.operation = 'delete'; return this; }
      eq(column, value) { return this.filter(column, 'eq', value); }
      gt(column, value) { return this.filter(column, 'gt', value); }
      gte(column, value) { return this.filter(column, 'gte', value); }
      is(column, value) { return this.filter(column, 'is', value); }
      in(column, value) { return this.filter(column, 'in', value); }
      filter(column, operator, value) { this.request.filters.push({ column, operator, value }); return this; }
      or(expression) { this.request.or = expression; return this; }
      order(column, options = {}) { this.request.orders.push({ column, ascending: options.ascending !== false, nullsFirst: options.nullsFirst === true }); return this; }
      range(from, to) { this.request.offset = Math.max(0, Number(from) || 0); this.request.limit = Math.max(0, Number(to) - this.request.offset + 1); return this; }
      limit(value) { this.request.limit = Number(value); return this; }
      single() { this.request.single = true; return this; }
      maybeSingle() { this.request.single = true; this.request.maybeSingle = true; return this; }
      async execute() { return request('/atlas-api/v1/data/query', { method: 'POST', json: this.request }); }
      then(resolve, reject) { return this.execute().then(resolve, reject); }
      catch(reject) { return this.execute().catch(reject); }
      finally(callback) { return this.execute().finally(callback); }
    }

    class RpcBuilder {
      constructor(name, parameters) {
        this.name = name;
        this.parameters = parameters;
        this.mode = 'many';
        this.pending = null;
      }
      single() { this.mode = 'single'; return this; }
      maybeSingle() { this.mode = 'maybe'; return this; }
      execute() {
        // Lazy, memoized execution avoids registering an attachment twice.
        if (!this.pending) {
          const mode = this.mode;
          this.pending = request(`/atlas-api/v1/rpc/${encodeURIComponent(this.name)}`, {
            method: 'POST', json: this.parameters,
          }).then(result => {
            if (result.error || mode === 'many') return result;
            const rows = Array.isArray(result.data) ? result.data : result.data == null ? [] : [result.data];
            if (rows.length === 1) return { ...result, data: rows[0] };
            if (rows.length === 0 && mode === 'maybe') return { ...result, data: null };
            return { ...result, data: null, error: {
              message: 'A operacao nao retornou exatamente um registro.', code: 'PGRST116', status: 406,
            } };
          });
        }
        return this.pending;
      }
      then(resolve, reject) { return this.execute().then(resolve, reject); }
      catch(reject) { return this.execute().catch(reject); }
      finally(callback) { return this.execute().finally(callback); }
    }

    function storageBucket(bucket) {
      return {
        async upload(objectPath, file, options = {}) {
          const headers = {
            'X-Atlas-Bucket': bucket,
            'X-Atlas-Path': encodeURIComponent(objectPath),
            'X-Atlas-Content-Type': options.contentType || file?.type || 'application/octet-stream',
            'X-Atlas-Upsert': options.upsert ? '1' : '0',
          };
          return request('/atlas-api/v1/storage/upload', { method: 'POST', headers, body: file });
        },
        remove(paths) {
          return request('/atlas-api/v1/storage/remove', { method: 'POST', json: { bucket, paths } });
        },
        async createSignedUrl(objectPath, expiresIn) {
          const result = await request('/atlas-api/v1/storage/sign', { method: 'POST', json: { bucket, path: objectPath, expiresIn } });
          if (result?.data?.signedUrl?.startsWith('/')) result.data.signedUrl = `${base}${result.data.signedUrl}`;
          return result;
        },
      };
    }

    const auth = {
      async getSession() {
        const result = await request('/atlas-api/v1/auth/session');
        if (!result.error) currentSession = result.data?.session || null;
        return result;
      },
      async signInWithPassword(credentials) {
        const result = await request('/atlas-api/v1/auth/login', { method: 'POST', json: credentials });
        if (!result.error) { currentSession = result.data?.session || null; emit('SIGNED_IN', currentSession); }
        return result;
      },
      async signUp(payload) {
        const result = await request('/atlas-api/v1/auth/signup', { method: 'POST', json: payload });
        if (!result.error) { currentSession = result.data?.session || null; emit('SIGNED_IN', currentSession); }
        return result;
      },
      async resetPasswordForEmail(email) {
        return request('/atlas-api/v1/auth/recovery', { method: 'POST', json: { email } });
      },
      async verifyOtp(payload) {
        const result = await request('/atlas-api/v1/auth/verify', { method: 'POST', json: payload });
        if (!result.error && result.data?.session) { currentSession = result.data.session; emit('SIGNED_IN', currentSession); }
        return result;
      },
      async updateUser(payload) {
        const result = await request('/atlas-api/v1/auth/user', { method: 'PATCH', json: payload });
        if (!result.error) emit('USER_UPDATED', currentSession);
        return result;
      },
      async signOut() {
        const result = await request('/atlas-api/v1/auth/logout', { method: 'POST', json: {} });
        currentSession = null;
        emit('SIGNED_OUT', null);
        return result;
      },
      onAuthStateChange(callback) {
        listeners.add(callback);
        queueMicrotask(() => callback('INITIAL_SESSION', currentSession));
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
      },
    };

    return {
      from: (table) => new QueryBuilder(table),
      rpc: (name, parameters = {}) => new RpcBuilder(name, parameters),
      auth,
      storage: { from: storageBucket },
      removeChannel: () => Promise.resolve('ok'),
      channel: () => ({ on() { return this; }, subscribe(callback) { callback?.('SUBSCRIBED'); return this; } }),
    };
  }

  global.AtlasDatabase = Object.freeze({ createClient });
})(globalThis);
