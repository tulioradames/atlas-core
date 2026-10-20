const assert = require('node:assert/strict');
const gallery = require('../js/icon-gallery.js');
const lucide = require('../assets/vendor/lucide.min.js');
assert.equal(gallery.icons.length, 80);
assert.equal(new Set(gallery.icons.map(icon => icon.name)).size, 80);
for (const icon of gallery.icons) {
  const pascal = icon.name.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('');
  assert(lucide.icons[pascal], `Icone inexistente: ${icon.name}`);
}
assert(gallery.valid('building-2'));
assert(!gallery.valid('<script>'));
const html = gallery.markup('database');
assert(html.includes('value="database" checked'));
assert(html.includes('data-icon-search') && html.includes('data-icon-category'));
assert(!html.includes('type="color"'));
console.log('Galeria: 80 icones reais, categorias, selecao e validacao aprovados.');
