const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const connectorPath = path.resolve(__dirname, '..', 'appscript', 'GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs');
const source = fs.readFileSync(connectorPath, 'utf8');

const iterator = (values) => {
  let index = 0;
  return {
    hasNext: () => index < values.length,
    next: () => values[index++],
  };
};

class Folder {
  constructor(id, name, parent = null) {
    this.id = id;
    this.name = name;
    this.parent = parent;
    this.children = [];
  }

  getId() { return this.id; }
  getName() { return this.name; }
  getParents() { return iterator(this.parent ? [this.parent] : []); }
  getFoldersByName(name) { return iterator(this.children.filter((entry) => entry.name === name)); }
  createFolder(name) {
    const folder = new Folder(`folder-${this.children.length + 1}-${name}`, name, this);
    this.children.push(folder);
    return folder;
  }
}

class File {
  constructor(id, parent) {
    this.id = id;
    this.parent = parent;
    this.trashed = false;
  }

  getId() { return this.id; }
  getParents() { return iterator(this.parent ? [this.parent] : []); }
  setTrashed(value) { this.trashed = Boolean(value); }
  moveTo(folder) { this.parent = folder; }
}

const root = new Folder('root', 'Obras');
const loose = root.createFolder('Arquivos soltos');
const files = new Map([
  ['file-a', new File('file-a', loose)],
  ['file-b', new File('file-b', loose)],
]);

const context = {
  console,
  DriveApp: {
    getFileById: (id) => {
      if (!files.has(id)) throw new Error('Arquivo inexistente.');
      return files.get(id);
    },
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: () => true,
      releaseLock: () => {},
    }),
  },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (content) => ({
      content,
      setMimeType() { return this; },
    }),
  },
};

vm.createContext(context);
vm.runInContext(source, context, { filename: connectorPath });

const parse = (response) => JSON.parse(response.content);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const normalized = context.atlasNormalizePath_(['Ceara Mirim - RN', 'POP', 'POP', 'Fotos']);
assert(JSON.stringify(normalized) === JSON.stringify(['Ceara Mirim - RN', 'POP', 'Fotos']), 'O caminho nao removeu duplicacao consecutiva.');

let result = parse(context.atlasDelete_({ fileIds: ['file-a', 'file-b'] }, root));
assert(result.success && result.fileIds.length === 2, 'A exclusao em lote falhou.');
assert(files.get('file-a').trashed && files.get('file-b').trashed, 'Os arquivos nao foram para a lixeira.');

result = parse(context.atlasRestore_({ fileIds: ['file-a', 'file-b'] }, root));
assert(result.success, 'A restauracao em lote falhou.');
assert(!files.get('file-a').trashed && !files.get('file-b').trashed, 'Os arquivos nao foram restaurados.');

result = parse(context.atlasMoveFiles_({
  moves: [{
    fileId: 'file-a',
    folderPath: ['Ceara Mirim - RN', 'POP', 'POP - CEARA MIRIM - RN', 'Fotos'],
  }],
}, root));
assert(result.success && result.movedCount === 1, 'A organizacao do arquivo falhou.');
assert(files.get('file-a').parent.name === 'Fotos', 'O arquivo nao chegou a pasta final.');
assert(files.get('file-a').parent.parent.name === 'POP - CEARA MIRIM - RN', 'A pasta do registro nao foi criada.');
assert(files.get('file-a').parent.parent.parent.name === 'POP', 'A pasta do setor nao foi criada.');
assert(files.get('file-a').parent.parent.parent.parent.name === 'Ceara Mirim - RN', 'A pasta da cidade nao foi criada.');

console.log('Atlas V2.3.1: conector do Drive aprovado.');
