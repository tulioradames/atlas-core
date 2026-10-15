'use strict';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { formsDatabase } = require('./helpers/forms-database.cjs');

(async () => {
  const { db, ids, rpc, save, config } = await formsDatabase();
  try {
    const fields = config.fields.map((field) => field.columnId === ids.image ? { ...field, required: true } : field);
    const form = await save({ fields });
    const requestId = randomUUID();
    const attachmentId = randomUUID();
    const accessToken = 'a'.repeat(64);
    const upload = {
      attachmentId,
      columnId: ids.image,
      storagePath: `public-forms/${requestId}/${attachmentId}.png`,
      accessToken,
      name: 'vistoria.png',
      mimeType: 'image/png',
      size: 1024,
      viewUrl: `https://forms.example.test/formularios/imagens/${accessToken}`,
    };
    const answers = { __name__: 'Joao Pessoa', [ids.text]: 'Vistoria recebida' };
    await assert.rejects(
      () => rpc('atlas_v2_submit_public_form', { p_token: form.token, p_request_id: randomUUID(), p_answers: answers, p_uploads: [] }),
      /Envie pelo menos uma imagem/,
    );
    const result = await rpc('atlas_v2_submit_public_form', { p_token: form.token, p_request_id: requestId, p_answers: answers, p_uploads: [upload] });
    assert.equal(result.success, true);
    assert.equal(result.images, 1);
    const attachment = (await db.query('select * from atlas_v2_attachments where id=$1', [attachmentId])).rows[0];
    assert.equal(attachment.file_id, `form-image:${accessToken}`);
    assert.equal(attachment.column_id, ids.image);
    assert.equal(attachment.storage_connection_id, null);
    const metadata = await rpc('atlas_v2_public_form_image_metadata', { p_token: accessToken });
    assert.equal(metadata.storagePath, upload.storagePath);
    const replay = await rpc('atlas_v2_submit_public_form', { p_token: form.token, p_request_id: requestId, p_answers: answers, p_uploads: [{ broken: true }] });
    assert.equal(replay.replayed, true);

    const removed = await rpc('atlas_v2_delete_form_images', { p_attachment_ids: [attachmentId] }, 'authenticated', ids.manager);
    assert.deepEqual(removed, [attachmentId]);
    assert.equal((await db.query('select count(*) n from atlas_v2_attachments where id=$1', [attachmentId])).rows[0].n, 0);
    await db.query("update atlas_v2_form_images set created_at=now()-interval '10 minutes',deleted_at=now()-interval '10 minutes' where access_token=$1", [accessToken]);
    const pending = await rpc('atlas_v2_form_image_cleanup_candidates', { p_limit: 100 });
    assert.equal(pending.length, 1);
    assert.equal(pending[0].storagePath, upload.storagePath);
    assert.equal(await rpc('atlas_v2_finalize_form_image_cleanup', { p_ids: [pending[0].id] }), 1);
    assert.equal((await db.query('select count(*) n from atlas_v2_form_images')).rows[0].n, 0);
    console.log('PASS public form images PostgreSQL: required field, atomic attachment, opaque metadata, replay and cleanup queue');
  } finally {
    await db.close();
  }
})().catch((error) => { console.error(error.message, error.code || '', error.where || ''); process.exitCode = 1; });
