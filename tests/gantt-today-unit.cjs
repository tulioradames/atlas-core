const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/v2.js'), 'utf8');
const expression = source.match(/const todayLeft = ([\s\S]*?);/)[1];
for (const dayWidth of [3.8, 13.5, 36, 180]) {
  const context = { timelineStart: new Date('2026-10-20T00:00:00Z'), timelineEnd: new Date('2026-10-25T00:00:00Z'), today: new Date('2026-10-23T00:00:00Z'), dayWidth, timelineDayDiff: (a, b) => Math.round((b - a) / 86400000) };
  assert.equal(vm.runInNewContext(expression, context), 4 * dayWidth);
  context.today = context.timelineStart;
  assert.equal(vm.runInNewContext(expression, context), dayWidth);
  context.today = context.timelineEnd;
  assert.equal(vm.runInNewContext(expression, context), 6 * dayWidth);
  context.today = new Date('2026-10-26T00:00:00Z');
  assert.equal(vm.runInNewContext(expression, context), null);
}
console.log('Gantt: Hoje no final do dia, em todas as larguras e limites.');
