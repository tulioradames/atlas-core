'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../js/v2.js'), 'utf8');
const start = source.indexOf('  function locationCoordinates(');
const end = source.indexOf('  function locationPreviewMarkup(', start);
assert.ok(start > 0 && end > start);
const sandbox = {};
vm.runInNewContext(source.slice(start, end) + '\nthis.parse = locationCoordinates; this.url = locationMapUrl;', sandbox);
for (const input of ['-7.12, -35.88', '-7.12; -35.88', '-7.12 -35.88', '-7,12; -35,88']) {
  assert.equal(sandbox.parse(input)?.lat, -7.12);
  assert.equal(sandbox.parse(input)?.lng, -35.88);
}
for (const input of ['', 'Ponto de rede', '91,0', '0,181', '-91,-181', 'NaN,Infinity', '1,2,3', '<script>1,2</script>']) assert.equal(sandbox.parse(input), null);
assert.equal(sandbox.parse('0, 0')?.lat, 0);
assert.equal(sandbox.parse('-90,180')?.lng, 180);
const url = new URL(sandbox.url(sandbox.parse('-7.12,-35.88')));
assert.equal(url.hostname, 'maps.google.com');
assert.equal(url.searchParams.get('q'), '-7.12,-35.88');
assert.equal(url.searchParams.get('output'), 'embed');
console.log('PASS localizacao: coordenadas, limites, zero, texto legado e URL segura');
