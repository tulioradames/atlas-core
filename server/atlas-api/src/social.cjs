'use strict';
const fs = require('node:fs/promises');
const { readJson, sendJson } = require('./security.cjs');
const { fileLocation } = require('./storage.cjs');
const uuid = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(value || ''));
const problem = (text, status = 400) => Object.assign(new Error(text), { status });

function createSocial(database, config) {
  const rates = new Map();
  async function run(userId, callback) {
    return database.transaction(async client => {
      const active = await client.query('select public.atlas_v2_is_active_user() as active');
      if (!active.rows[0]?.active) throw problem('Acesso liberado necessario.', 403);
      return callback(client);
    }, userId);
  }
  async function conversation(client, id) {
    if (!uuid(id)) throw problem('Conversa invalida.');
    const result = await client.query('select * from public.atlas_direct_conversations where id=$1', [id]);
    if (!result.rows[0]) throw problem('Conversa indisponivel.', 404);
    return result.rows[0];
  }
  async function handle(req, res, session, url) {
    const userId = session.user.id;
    const route = url.pathname.replace('/atlas-api/v1/social', '');
    if (req.method === 'POST' && route === '/presence') {
      const body = await readJson(req, 2048);
      const state = body.state === 'away' ? 'away' : 'online';
      const visible = typeof body.visible === 'boolean' ? body.visible : null;
      const result = await run(userId, client => client.query(
        `insert into public.atlas_presence(user_id,state,visible,seen_at) values($1,$2,coalesce($3,true),now())
         on conflict(user_id) do update set state=$2,visible=coalesce($3,atlas_presence.visible),seen_at=now() returning visible`,
        [userId, state, visible]));
      return sendJson(res, 200, { visible: result.rows[0].visible });
    }
    if (req.method === 'GET' && route === '/people') {
      const result = await run(userId, client => client.query(
        `select p.id,p.nome as name,p.cargo as title,
          case when pr.visible and pr.seen_at>now()-interval '90 seconds' then pr.state else 'offline' end as status,
          c.id as conversation_id,
          (select count(*)::int from public.atlas_direct_messages m where m.conversation_id=c.id and m.sender_id<>$1
            and m.id>case when c.user_low=$1 then c.read_low else c.read_high end) as unread
         from public.atlas_profiles p left join public.atlas_presence pr on pr.user_id=p.id
         left join public.atlas_direct_conversations c on c.user_low=least(p.id,$1::uuid) and c.user_high=greatest(p.id,$1::uuid)
         where p.status='ativo' and p.id<>$1 order by p.nome,p.id limit 500`, [userId]));
      return sendJson(res, 200, { people: result.rows });
    }
    if (req.method === 'POST' && route === '/conversations') {
      const body = await readJson(req, 2048);
      if (!uuid(body.userId) || body.userId === userId) throw problem('Escolha outra pessoa.');
      const result = await run(userId, client => client.query(
        `insert into public.atlas_direct_conversations(user_low,user_high) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid))
         on conflict(user_low,user_high) do update set user_low=excluded.user_low returning id`, [userId, body.userId]));
      return sendJson(res, 200, { id: result.rows[0].id });
    }
    const match = route.match(/^\/conversations\/([a-f0-9-]{36})\/(messages|read)$/i);
    if (match) {
      const id = match[1];
      if (req.method === 'GET' && match[2] === 'messages') {
        const before = url.searchParams.get('before') || null;
        const after = url.searchParams.get('after') || null;
        if (before && !/^\d{1,19}$/.test(before)) throw problem('Pagina invalida.');
        if ((after && !/^\d{1,19}$/.test(after)) || (after && before)) throw problem('Pagina invalida.');
        const result = await run(userId, async client => {
          const chat = await conversation(client, id);
          const messages = await client.query(`select id::text,sender_id,body,attachments,created_at from public.atlas_direct_messages
            where conversation_id=$1 and ($2::bigint is null or id<$2) and ($3::bigint is null or id>$3)
            order by case when $3::bigint is not null then id end asc,id desc limit 50`, [id, before, after]);
          return { messages: after ? messages.rows : messages.rows.reverse(), peerRead: String(chat.user_low === userId ? chat.read_high : chat.read_low) };
        });
        return sendJson(res, 200, result);
      }
      if (req.method === 'POST' && match[2] === 'read') {
        const body = await readJson(req, 2048);
        if (!/^\d{1,19}$/.test(String(body.messageId || ''))) throw problem('Mensagem invalida.');
        await run(userId, async client => {
          const chat = await conversation(client, id);
          const column = chat.user_low === userId ? 'read_low' : 'read_high';
          await client.query(`update public.atlas_direct_conversations set ${column}=greatest(${column},least($2::bigint,
            coalesce((select max(id) from public.atlas_direct_messages where conversation_id=$1),0))) where id=$1`, [id, body.messageId]);
        });
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'POST' && match[2] === 'messages') {
        const body = await readJson(req, 64 * 1024);
        const text = String(body.text || '').trim();
        const paths = Array.isArray(body.files) ? body.files : [];
        if ((!text && !paths.length) || text.length>8000 || paths.length>5 || !uuid(body.clientId)) throw problem('Mensagem invalida.');
        const now = Date.now();
        if (rates.size > 5000) for (const [key,value] of rates) if (value.until<now) rates.delete(key);
        const rate = rates.get(userId);
        if (rate?.until>now && rate.count>=30) throw problem('Aguarde um minuto antes de enviar mais mensagens.',429);
        rates.set(userId,rate?.until>now ? { ...rate,count:rate.count+1 } : { count:1,until:now+60000 });
        const files = [];
        for (const objectPath of paths) {
          if (typeof objectPath !== 'string' || !objectPath.startsWith(`${id}/${userId}/`)) throw problem('Anexo invalido.',403);
          const file = await database.pool.query(`select id,object_path,mime_type,size_bytes from public.atlas_files
            where bucket='atlas-direct' and object_path=$1 and owner_id=$2 and deleted_at is null`, [objectPath,userId]);
          if (!file.rows[0]) throw problem('Anexo indisponivel.',404);
          const entry = file.rows[0];
          files.push({ id:entry.id,name:entry.object_path.split('/').pop().slice(37),size:Number(entry.size_bytes),type:entry.mime_type });
        }
        const result = await run(userId,async client => {
          await conversation(client,id);
          await client.query(`insert into public.atlas_direct_messages(conversation_id,sender_id,client_id,body,attachments)
            values($1,$2,$3,$4,$5::jsonb) on conflict(sender_id,client_id) do nothing`, [id,userId,body.clientId,text,JSON.stringify(files)]);
          return client.query(`select id::text,sender_id,body,attachments,created_at from public.atlas_direct_messages
            where conversation_id=$1 and sender_id=$2 and client_id=$3`, [id,userId,body.clientId]);
        });
        if (!result.rows[0]) throw problem('Identificador de envio ja utilizado.',409);
        return sendJson(res,200,{ message:result.rows[0] });
      }
    }
    const fileMatch = route.match(/^\/files\/([a-f0-9-]{36})$/i);
    if (req.method === 'GET' && fileMatch) {
      const result = await database.pool.query(`select object_path,mime_type from public.atlas_files where id=$1 and bucket='atlas-direct' and deleted_at is null`,[fileMatch[1]]);
      const file = result.rows[0];
      if (!file) throw problem('Arquivo indisponivel.',404);
      await run(userId, client=>conversation(client,file.object_path.split('/')[0]));
      const bytes = await fs.readFile(fileLocation(config.filesRoot,'atlas-direct',file.object_path));
      res.writeHead(200,{ 'Content-Type':file.mime_type,'Content-Disposition':'attachment','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Length':bytes.length });
      return res.end(bytes);
    }
    throw problem('Endereco nao encontrado.',404);
  }
  return { handle };
}
module.exports = { createSocial, uuid };
