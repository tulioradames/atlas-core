/**
 * Web App para receber imagens e arquivos do dashboard, inclusive em lote, criar a estrutura de pastas
 * no Google Drive, devolver os links/IDs para serem salvos no Supabase. O módulo Expansões aceita rootFolderId próprio e organiza por Grupo/Projeto/Subelemento/Tipo de arquivo,
 * excluir arquivos individuais, mover pastas de obra/ativo/subelemento e também pastas de projeto/subelemento de Expansões
 * para a lixeira quando o item correspondente for apagado no dashboard.
 *
 * V 1.3.3.3: Web App exclusivo de Expansões com importação por link/URL/atalho de Drive externo. Use este script na conta proprietária do Drive.
 */

// Pastas raiz oficiais. Cada módulo deve gravar somente na sua própria pasta.
const DOCUMENTACAO_ROOT_FOLDER_ID = ''; // não usado neste Web App
const EXPANSOES_ROOT_FOLDER_ID = '';
const EXPANSOES_EXTERNAL_ROOT_PROP = 'EXPANSOES_EXTERNAL_ROOT_ID';
const EXPANSOES_EXTERNAL_ROOT_URL_PROP = 'EXPANSOES_EXTERNAL_ROOT_URL';

// Legado: mantido apenas para compatibilidade, sempre apontando para Documentação.
const ROOT_FOLDER_ID = EXPANSOES_ROOT_FOLDER_ID;
const ROOT_FOLDER_NAME = 'ATLAS';
const ATNX_DRIVE_MODULE = 'expansoes';

function normalizarModuloAtnx(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function validarModuloPermitidoAtnx(body) {
  const permitido = normalizarModuloAtnx(ATNX_DRIVE_MODULE);
  if (!permitido) return;

  const informado = normalizarModuloAtnx(body && (body.modulo || body.module));

  // Este Web App é exclusivo de Expansões. Quando o dashboard/proxy não envia
  // modulo, não bloqueia a requisição; o módulo efetivo é assumido como Expansões.
  // Quando envia outro módulo explicitamente, bloqueia para evitar gravar no Drive errado.
  if (!informado) return;

  if (informado !== permitido) {
    throw new Error('Este Web App pertence ao módulo ' + permitido + ', mas recebeu uma requisição do módulo ' + informado + '. Configure a URL correta no Atlas.');
  }
}


// Para o dashboard exibir miniaturas sem exigir login no Google,
// deixe true. Se quiser manter privado, coloque false, mas as imagens
// podem não carregar no <img> para todos os usuários.
const COMPARTILHAR_ARQUIVOS_COM_LINK = true;

// Modo rápido para importação: ao reconhecer arquivos já existentes no Drive,
// não altera o compartilhamento de cada imagem individualmente. Isso evita
// demora grande em pastas com muitas fotos. Para que as miniaturas apareçam
// para todos, compartilhe a pasta importada manualmente no Drive.
const COMPARTILHAR_ARQUIVOS_IMPORTADOS_COM_LINK = false;

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const callback = String(params.callback || '').trim();
    const action = String(params.action || params.acao || '').toLowerCase();

    let resultado;
    if (action === 'testarexpansoesdrive' || action === 'teste_expansoes_drive' || action === 'diagnosticoexpansoesdrive') {
      validarModuloPermitidoAtnx(params);
      resultado = testarAcessoDriveExternoExpansoesDados(params);
    } else if (action === 'importarexpansoesobras' || action === 'importar_expansoes_obras' || action === 'expansoes_obras_por_link') {
      validarModuloPermitidoAtnx(params);
      resultado = escanearExpansoesObrasPorLinkDados(params);
    } else if (action === 'scanfolder' || action === 'scan_folder' || action === 'syncdrive' || action === 'sincronizardrive') {
      validarModuloPermitidoAtnx(params);
      resultado = escanearPastaDriveDados(params);
    } else {
      resultado = {
        success: true,
        message: 'Endpoint de upload do Google Drive ativo.',
        module: ATNX_DRIVE_MODULE
      };
    }

    if (callback) return jsonpResponse(resultado, callback);
    return jsonResponse(resultado);
  } catch (err) {
    const erro = {
      success: false,
      error: err.message || String(err)
    };
    const params = e && e.parameter ? e.parameter : {};
    const callback = String(params.callback || '').trim();
    if (callback) return jsonpResponse(erro, callback);
    return jsonResponse(erro);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Nenhum conteúdo recebido no POST.');
    }

    const body = JSON.parse(e.postData.contents);
    validarModuloPermitidoAtnx(body);
    const action = String(body.action || body.acao || 'upload').toLowerCase();

    if (action === 'delete' || action === 'excluir') {
      return excluirArquivoDoDrive(body);
    }

    if (action === 'deletefiles' || action === 'excluirarquivos' || action === 'delete_files') {
      return excluirArquivosDoDrive(body);
    }

    if (action === 'deletefolder' || action === 'excluirpasta' || action === 'delete_folder') {
      return excluirPastaDoDrive(body);
    }

    if (action === 'deleteexpansionentity' || action === 'delete_expansion_entity' || action === 'excluirentidadeexpansao') {
      return excluirEntidadeExpansoesDoDrive(body);
    }

    if (action === 'testarexpansoesdrive' || action === 'teste_expansoes_drive' || action === 'diagnosticoexpansoesdrive') {
      return jsonResponse(testarAcessoDriveExternoExpansoesDados(body));
    }

    if (action === 'importarexpansoesobras' || action === 'importar_expansoes_obras' || action === 'expansoes_obras_por_link') {
      return jsonResponse(escanearExpansoesObrasPorLinkDados(body));
    }

    if (action === 'scanfolder' || action === 'scan_folder' || action === 'syncdrive' || action === 'sincronizardrive') {
      return escanearPastaDrive(body);
    }

    if (action === 'uploadbatch' || action === 'upload_batch' || action === 'enviarlote') {
      return uploadArquivosEmLote(body);
    }

    validarPayload(body);

    const estrutura = obterEstruturaDestino(body);
    const pastaDestino = estrutura.pastaMidia;
    const nomeArquivo = montarNomeArquivo(body.nomeArquivo);
    const bytes = Utilities.base64Decode(body.base64);
    const blob = Utilities.newBlob(bytes, body.mimeType, nomeArquivo);
    const arquivo = pastaDestino.createFile(blob);

    let sharingWarning = '';
    if (COMPARTILHAR_ARQUIVOS_COM_LINK) {
      try {
        arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {
        sharingWarning = err.message || String(err);
      }
    }

    const fileId = arquivo.getId();
    const folderId = pastaDestino.getId();

    return jsonResponse({
      success: true,
      fileId,
      folderId,
      folderIds: {
        obraFolderId: estrutura.pastaObra.getId(),
        tipoFolderId: estrutura.pastaTipo.getId(),
        elementoFolderId: estrutura.pastaElemento.getId(),
        subelementoFolderId: estrutura.pastaSubelemento.getId(),
        midiaFolderId: estrutura.pastaMidia.getId()
      },
      nome: nomeArquivo,
      mimeType: body.mimeType || 'application/octet-stream',
      url: `https://drive.google.com/uc?export=view&id=${fileId}`,
      viewUrl: arquivo.getUrl(),
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
      caminho: montarCaminhoRetorno(body),
      sharingWarning
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message || String(err)
    });
  }
}


function uploadArquivosEmLote(body) {
  const arquivos = Array.isArray(body.arquivos) ? body.arquivos : [];
  if (arquivos.length === 0) {
    throw new Error('Nenhum arquivo recebido para upload em lote.');
  }

  const estrutura = obterEstruturaDestino(Object.assign({}, body, {
    nomeArquivo: arquivos[0].nomeArquivo || 'imagem.jpg',
    mimeType: arquivos[0].mimeType || 'image/jpeg',
    base64: arquivos[0].base64 || ''
  }));

  const pastaDestino = estrutura.pastaMidia;
  const resultados = [];
  const failures = [];

  arquivos.forEach((item, index) => {
    try {
      if (!item || !item.base64) throw new Error('Arquivo sem base64.');
      validarArquivoPermitidoPorTipo(item, body.tipoMidia || 'imagens');

      const nomeArquivo = montarNomeArquivo(item.nomeArquivo || ('arquivo-' + (index + 1)));
      const bytes = Utilities.base64Decode(item.base64);
      const blob = Utilities.newBlob(bytes, item.mimeType || 'image/jpeg', nomeArquivo);
      const arquivo = pastaDestino.createFile(blob);

      let sharingWarning = '';
      if (COMPARTILHAR_ARQUIVOS_COM_LINK) {
        try {
          arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (err) {
          sharingWarning = err.message || String(err);
        }
      }

      const fileId = arquivo.getId();
      resultados.push({
        success: true,
        fileId,
        folderId: pastaDestino.getId(),
        folderIds: {
          obraFolderId: estrutura.pastaObra.getId(),
          tipoFolderId: estrutura.pastaTipo.getId(),
          elementoFolderId: estrutura.pastaElemento.getId(),
          subelementoFolderId: estrutura.pastaSubelemento.getId(),
          midiaFolderId: estrutura.pastaMidia.getId()
        },
        nome: nomeArquivo,
        mimeType: item.mimeType || 'application/octet-stream',
        url: 'https://drive.google.com/uc?export=view&id=' + fileId,
        viewUrl: arquivo.getUrl(),
        thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000',
        caminho: montarCaminhoRetorno(body),
        sharingWarning
      });
    } catch (err) {
      failures.push({
        index,
        nomeArquivo: item && item.nomeArquivo ? item.nomeArquivo : '',
        error: err.message || String(err)
      });
    }
  });

  return jsonResponse({
    success: resultados.length > 0,
    action: 'uploadBatch',
    requestedCount: arquivos.length,
    uploadedCount: resultados.length,
    arquivos: resultados,
    failures,
    message: resultados.length + ' arquivo(s) enviado(s) para o Google Drive.'
  });
}

function excluirArquivoDoDrive(body) {
  if (!body.fileId) {
    throw new Error('Campo obrigatório ausente para exclusão: fileId');
  }

  const arquivo = DriveApp.getFileById(String(body.fileId));
  arquivo.setTrashed(true);

  return jsonResponse({
    success: true,
    action: 'delete',
    fileId: String(body.fileId),
    message: 'Arquivo movido para a lixeira do Google Drive.'
  });
}

function excluirArquivosDoDrive(body) {
  const ids = Array.isArray(body.fileIds) ? body.fileIds : [body.fileId].filter(Boolean);
  const unicos = Array.from(new Set(ids.map(id => String(id || '').trim()).filter(Boolean)));

  if (unicos.length === 0) {
    throw new Error('Nenhum fileId informado para exclusão em lote.');
  }

  const failures = [];
  let deletedCount = 0;

  unicos.forEach(fileId => {
    try {
      const arquivo = DriveApp.getFileById(fileId);
      arquivo.setTrashed(true);
      deletedCount += 1;
    } catch (err) {
      failures.push({ fileId, error: err.message || String(err) });
    }
  });

  return jsonResponse({
    success: deletedCount > 0 || failures.length === 0,
    action: 'deleteFiles',
    requestedCount: unicos.length,
    deletedCount,
    failures,
    message: deletedCount + ' arquivo(s) movido(s) para a lixeira do Google Drive.'
  });
}

function excluirPastaDoDrive(body) {
  const targetType = normalizarTipoAlvo(body.targetType || body.tipo || '');
  let pasta = null;
  let origem = '';

  if (body.folderId) {
    pasta = DriveApp.getFolderById(String(body.folderId));
    origem = 'folderId';
  }

  if (!pasta && Array.isArray(body.fileIds) && body.fileIds.length > 0 && targetType) {
    pasta = obterPastaAncestralPorArquivos(body.fileIds, targetType);
    origem = 'fileIds';
  }

  if (!pasta && body.path) {
    pasta = obterPastaPorCaminho(body.path, targetType, body);
    origem = 'path';
  }

  if (!pasta) {
    return jsonResponse({
      success: true,
      skipped: true,
      action: 'deleteFolder',
      targetType,
      message: 'Nenhuma pasta correspondente foi encontrada no Google Drive. O registro pode ser excluído do Supabase.'
    });
  }

  const folderId = pasta.getId();
  const folderName = pasta.getName();
  pasta.setTrashed(true);

  return jsonResponse({
    success: true,
    action: 'deleteFolder',
    targetType,
    folderId,
    folderName,
    origem,
    message: 'Pasta movida para a lixeira do Google Drive.'
  });
}


function excluirEntidadeExpansoesDoDrive(body) {
  const targetType = String(body.targetType || body.tipo || '').toLowerCase().trim();
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.map(id => String(id || '').trim()).filter(Boolean) : [];
  let pasta = null;
  let origem = '';

  if (body.folderId) {
    try {
      pasta = DriveApp.getFolderById(String(body.folderId));
      origem = 'folderId';
    } catch (err) {
      pasta = null;
    }
  }

  if (!pasta) {
    pasta = obterPastaEntidadeExpansoesPorCaminho(body, targetType);
    if (pasta) origem = 'path';
  }

  if (!pasta && fileIds.length > 0) {
    pasta = obterPastaEntidadeExpansoesPorArquivos(fileIds, targetType);
    if (pasta) origem = 'fileIds';
  }

  const resultadoArquivos = moverArquivosParaLixeira(fileIds);

  if (!pasta) {
    return jsonResponse({
      success: resultadoArquivos.failures.length === 0,
      skippedFolder: true,
      action: 'deleteExpansionEntity',
      targetType,
      deletedFiles: resultadoArquivos.deletedCount,
      failures: resultadoArquivos.failures,
      message: resultadoArquivos.failures.length === 0
        ? 'Arquivos informados foram processados. Nenhuma pasta correspondente de Expansões foi encontrada no Google Drive.'
        : 'Alguns arquivos não puderam ser removidos e nenhuma pasta correspondente de Expansões foi encontrada.'
    });
  }

  const folderId = pasta.getId();
  const folderName = pasta.getName();
  pasta.setTrashed(true);

  return jsonResponse({
    success: true,
    action: 'deleteExpansionEntity',
    targetType,
    folderId,
    folderName,
    origem,
    deletedFiles: resultadoArquivos.deletedCount,
    failures: resultadoArquivos.failures,
    message: 'Pasta/imagens de Expansões movidas para a lixeira do Google Drive.'
  });
}

function moverArquivosParaLixeira(fileIds) {
  const unicos = Array.from(new Set((fileIds || []).map(id => String(id || '').trim()).filter(Boolean)));
  const failures = [];
  let deletedCount = 0;

  unicos.forEach(fileId => {
    try {
      const arquivo = DriveApp.getFileById(fileId);
      arquivo.setTrashed(true);
      deletedCount += 1;
    } catch (err) {
      failures.push({ fileId, error: err.message || String(err) });
    }
  });

  return { deletedCount, failures };
}

function obterPastaEntidadeExpansoesPorCaminho(body, targetType) {
  const raiz = obterPastaRaiz(body);
  const grupoNome = limparNome(body.grupoNome || body.obraNome || 'Projetos em Progresso');
  const projetoNome = limparNome(body.expansaoNome || body.elementoNome || 'Projeto sem nome');
  const subitemNome = limparNome(body.subitemNome || body.subelementoNome || '');

  const pastaGrupo = obterPastaFilhaSeExistir(raiz, grupoNome);
  if (!pastaGrupo) return null;

  const pastaProjeto = obterPastaFilhaSeExistir(pastaGrupo, projetoNome);
  if (!pastaProjeto) return null;

  if (targetType === 'projeto' || targetType === 'expansao' || targetType === 'expansão') {
    return pastaProjeto;
  }

  if (targetType === 'subitem' || targetType === 'subelemento' || targetType === 'item') {
    if (!subitemNome) return null;
    const pastaSubelementos = obterPastaFilhaSeExistir(pastaProjeto, 'Subelementos');
    if (!pastaSubelementos) return null;
    return obterPastaFilhaSeExistir(pastaSubelementos, subitemNome);
  }

  return null;
}

function obterPastaEntidadeExpansoesPorArquivos(fileIds, targetType) {
  // Estrutura esperada:
  // Expansões / Grupo / Projeto / Imagens / arquivo
  // Expansões / Grupo / Projeto / Subelementos / Subelemento / Imagens / arquivo
  for (let i = 0; i < fileIds.length; i++) {
    try {
      const arquivo = DriveApp.getFileById(String(fileIds[i]));
      const paisArquivo = arquivo.getParents();
      if (!paisArquivo.hasNext()) continue;

      const pastaImagens = paisArquivo.next();
      const pastaPaiImagens = obterPrimeiroPai(pastaImagens);
      if (!pastaPaiImagens) continue;

      if (targetType === 'subitem' || targetType === 'subelemento' || targetType === 'item') {
        // Em imagens de subitem, o pai da pasta Imagens é o próprio subitem.
        const talvezSubelementos = obterPrimeiroPai(pastaPaiImagens);
        if (talvezSubelementos && talvezSubelementos.getName && talvezSubelementos.getName() === 'Subelementos') {
          return pastaPaiImagens;
        }
      }

      if (targetType === 'projeto' || targetType === 'expansao' || targetType === 'expansão') {
        // Imagem direta: Imagens -> Projeto. Imagem de subitem: Imagens -> Subitem -> Subelementos -> Projeto.
        const talvezSubelementos = obterPrimeiroPai(pastaPaiImagens);
        if (talvezSubelementos && talvezSubelementos.getName && talvezSubelementos.getName() === 'Subelementos') {
          return obterPrimeiroPai(talvezSubelementos);
        }
        return pastaPaiImagens;
      }
    } catch (err) {
      // Tenta o próximo arquivo caso algum ID esteja inválido ou já inacessível.
    }
  }

  return null;
}


function escanearPastaDrive(body) {
  return jsonResponse(escanearPastaDriveDados(body));
}

function escanearPastaDriveDados(body) {
  const entrada = obterEntradaPastaDriveAtnx_(body, ['folderUrl', 'folderId']);
  const scope = String(body.scope || 'auto').toLowerCase().trim();
  const pastaBase = entrada ? abrirPastaDriveObrigatoriaAtnx_(entrada, 'pasta informada para sincronização/importação') : obterPastaRaiz(body);

  let obras = [];

  // Formatos aceitos agora:
  // 1) Raiz/Obra/POP-CEO-CTO/Ativo/Subelemento/Foto-Diagrama
  // 2) Obra/POP-CEO-CTO/Ativo/Subelemento/Foto-Diagrama
  // 3) Obra/POP-CEO-CTO/Ativo/Foto-Diagrama  (duplica Ativo como Subelemento)
  // 4) POP-CEO-CTO/Ativo/Foto-Diagrama       (usa a pasta pai como Obra)
  if (!entrada || scope === 'root') {
    if (pastaEhTipoRaiz(pastaBase)) {
      obras = [escanearPastaTipoComoObra(pastaBase)];
    } else if (pastaTemPastasTipo(pastaBase)) {
      obras = [escanearPastaObra(pastaBase)];
    } else {
      obras = escanearPastasObraDentroDaRaiz(pastaBase);
    }
  } else if (pastaEhTipoRaiz(pastaBase)) {
    obras = [escanearPastaTipoComoObra(pastaBase)];
  } else if (pastaTemPastasTipo(pastaBase)) {
    obras = [escanearPastaObra(pastaBase)];
  } else {
    obras = escanearPastasObraDentroDaRaiz(pastaBase);
  }

  obras = obras
    .map(obra => limparObraEscaneada(obra))
    .filter(obra => obra && Array.isArray(obra.elementos) && obra.elementos.length > 0);

  return {
    success: true,
    action: 'scanFolder',
    baseFolderId: pastaBase.getId(),
    baseFolderName: pastaBase.getName(),
    obras,
    totais: contarTotaisImportacao(obras),
    modoImportacao: COMPARTILHAR_ARQUIVOS_IMPORTADOS_COM_LINK ? 'com_compartilhamento_individual' : 'rapido_sem_compartilhamento_individual',
    estruturaEsperada: 'Aceita: Obra/POP-CEO-CTO/Ativo/Subelemento/Foto-Diagrama ou Obra/POP-CEO-CTO/Ativo/Foto-Diagrama. Se colar POP, CEO ou CTO direto, a pasta pai vira a Obra.'
  };
}


function escanearExpansoesObrasPorLinkDados(body) {
  const entrada = obterEntradaPastaDriveAtnx_(body, [
    'folderUrl',
    'folderId',
    'driveLink',
    'driveUrl',
    'url',
    'link',
    'externalFolderUrl',
    'externalFolderId',
    'pastaUrl',
    'pastaId',
    'pastaRaizUrl',
    'pastaRaizId',
    'pastaExpansoesUrl',
    'pastaExpansoesId',
    'expansoesFolderUrl',
    'expansoesFolderId'
  ]);

  if (!entrada) {
    throw new Error('Informe o link ou ID da pasta de terceiros para importar. Também é possível salvar EXPANSOES_EXTERNAL_ROOT_ID nas Propriedades do Script.');
  }

  const pastaBase = abrirPastaDriveObrigatoriaAtnx_(entrada, 'pasta externa de Expansões');
  const obras = detectarObrasExpansoesNaPasta(pastaBase)
    .map(function(pastaObra) { return escanearObraExpansoesTerceiros(pastaObra); })
    .filter(function(obra) { return obra && obra.elementos && obra.elementos.length; });

  return {
    success: true,
    action: 'importarExpansoesObras',
    baseFolderId: pastaBase.getId(),
    baseFolderName: pastaBase.getName(),
    baseFolderUrl: pastaBase.getUrl(),
    expansoesObras: obras,
    obras: obras,
    totais: contarTotaisExpansoesObrasImportacao(obras),
    preservarDriveOriginal: true,
    origemEntrada: String(entrada || ''),
    estruturaEsperada: 'Pasta raiz / Obra / Elemento / Fotos / imagens. Também aceita Pasta da Obra / Elemento / Fotos e pastas de fase como KMZ, Lançamento, Fusões e Homologação Final.'
  };
}

function testarAcessoDriveExternoExpansoesDados(body) {
  const entrada = obterEntradaPastaDriveAtnx_(body, [
    'folderUrl',
    'folderId',
    'driveLink',
    'driveUrl',
    'url',
    'link',
    'externalFolderUrl',
    'externalFolderId',
    'pastaUrl',
    'pastaId',
    'pastaRaizUrl',
    'pastaRaizId',
    'pastaExpansoesUrl',
    'pastaExpansoesId',
    'expansoesFolderUrl',
    'expansoesFolderId'
  ]);

  if (!entrada) {
    throw new Error('Nenhum link ou ID de pasta recebido para teste.');
  }

  const folderId = extrairIdPastaDrive(entrada);
  const pasta = abrirPastaDriveObrigatoriaAtnx_(entrada, 'pasta externa de Expansões');
  const subpastas = [];
  const folders = pasta.getFolders();
  let totalSubpastas = 0;

  while (folders.hasNext()) {
    const sub = folders.next();
    totalSubpastas += 1;
    if (subpastas.length < 30) {
      subpastas.push({ id: sub.getId(), nome: sub.getName(), url: sub.getUrl() });
    }
  }

  return {
    success: true,
    action: 'testeExpansoesDrive',
    entrada: String(entrada || ''),
    folderIdExtraido: folderId,
    folderId: pasta.getId(),
    folderName: pasta.getName(),
    folderUrl: pasta.getUrl(),
    totalSubpastas: totalSubpastas,
    primeirasSubpastas: subpastas,
    contaExecucaoEsperada: 'CONFIGURE_A_CONTA_PROPRIETARIA_DO_DRIVE'
  };
}

function detectarObrasExpansoesNaPasta(pastaBase) {
  if (pastaPareceObraExpansoes(pastaBase)) return [pastaBase];

  const obras = [];
  const filhas = pastaBase.getFolders();
  while (filhas.hasNext()) {
    const pasta = filhas.next();
    if (pastaPareceObraExpansoes(pasta)) obras.push(pasta);
  }

  // Se não encontrar obras por heurística, tenta tratar as subpastas como obras mesmo assim.
  if (!obras.length) {
    const todas = pastaBase.getFolders();
    while (todas.hasNext()) obras.push(todas.next());
  }

  return obras;
}

function pastaPareceObraExpansoes(pasta) {
  if (!pasta) return false;
  const filhas = pasta.getFolders();
  while (filhas.hasNext()) {
    const filha = filhas.next();
    if (pastaEhFaseObraExpansoes(filha.getName())) return true;
    if (pastaPareceElementoExpansoes(filha)) return true;
  }
  return false;
}

function pastaPareceElementoExpansoes(pasta) {
  if (!pasta) return false;
  if (pastaPossuiArquivosExpansoes(pasta)) return true;
  const filhas = pasta.getFolders();
  while (filhas.hasNext()) {
    const filha = filhas.next();
    if (pastaEhMidiaExpansoes(filha.getName()) || pastaPossuiArquivosExpansoes(filha)) return true;
  }
  return false;
}

function pastaPossuiArquivosExpansoes(pasta) {
  const arquivos = pasta.getFiles();
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    if (arquivoEhImportavelExpansoes(arquivo)) return true;
  }
  return false;
}

function pastaEhFaseObraExpansoes(nome) {
  return !!normalizarFaseExpansoesImportacao(nome);
}

function normalizarFaseExpansoesImportacao(nome) {
  const n = normalizarNomeComparacao(nome).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const compacta = n.replace(/\s+/g, '');
  if (compacta === 'kmz' || n.indexOf('kmz') >= 0) return 'kmz';
  if (compacta.indexOf('lancamento') >= 0 || compacta.indexOf('lançamento') >= 0) return 'lancamento';
  if (compacta.indexOf('fusao') >= 0 || compacta.indexOf('fusoes') >= 0 || compacta.indexOf('fusão') >= 0 || compacta.indexOf('fusões') >= 0) return 'fusoes';
  if (compacta.indexOf('homologacao') >= 0 || compacta.indexOf('homologação') >= 0) return 'homologacao_final';
  return '';
}

function pastaEhMidiaExpansoes(nome) {
  const n = normalizarNomeComparacao(nome).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const compacta = n.replace(/\s+/g, '');
  return ['foto', 'fotos', 'imagem', 'imagens'].indexOf(n) >= 0 || ['foto', 'fotos', 'imagem', 'imagens'].indexOf(compacta) >= 0;
}

function pastaEhDiagramaExpansoes(nome) {
  const n = normalizarNomeComparacao(nome).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const compacta = n.replace(/\s+/g, '');
  return compacta.indexOf('diagrama') >= 0 || compacta.indexOf('diagramafusao') >= 0;
}

function arquivoEhImportavelExpansoes(arquivo) {
  const mime = String(arquivo.getMimeType() || '').toLowerCase();
  const nome = String(arquivo.getName() || '').toLowerCase();
  return mime.indexOf('image/') === 0 || /\.(jpg|jpeg|png|webp|gif|kmz|kml|xls|xlsx|xlsm|csv)$/i.test(nome);
}

function arquivoEhKmzExpansoes(arquivo) {
  const nome = String(arquivo.getName() || '').toLowerCase();
  const mime = String(arquivo.getMimeType() || '').toLowerCase();
  return nome.endsWith('.kmz') || nome.endsWith('.kml') || mime.indexOf('google-earth') >= 0;
}

function arquivoEhImagemExpansoes(arquivo) {
  const mime = String(arquivo.getMimeType() || '').toLowerCase();
  return mime.indexOf('image/') === 0;
}

function montarMidiaExpansoesImportada(arquivo, pasta, tipo, obra, elemento, subitem) {
  const fileId = arquivo.getId();
  return {
    nome: arquivo.getName(),
    fileId: fileId,
    folderId: pasta.getId(),
    folderIds: {
      obraFolderId: obra.getId(),
      elementoFolderId: elemento.getId(),
      subelementoFolderId: subitem ? subitem.getId() : elemento.getId(),
      midiaFolderId: pasta.getId()
    },
    url: 'https://drive.google.com/uc?export=view&id=' + fileId,
    viewUrl: arquivo.getUrl(),
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000',
    mimeType: arquivo.getMimeType() || '',
    origem: 'drive_terceiros_importado',
    importado: true,
    criadoPeloAtnx: false,
    preservadoNoDriveOriginal: true,
    tipo: tipo || 'imagens',
    criadoEm: formatarDataIso(arquivo.getDateCreated()),
    caminho: [obra.getName(), elemento.getName(), subitem ? subitem.getName() : '', tipo || 'imagens'].filter(Boolean).join('/')
  };
}

function escanearObraExpansoesTerceiros(pastaObra) {
  const obra = {
    nome: pastaObra.getName(),
    folderId: pastaObra.getId(),
    viewUrl: pastaObra.getUrl(),
    elementos: []
  };

  const filhos = pastaObra.getFolders();
  while (filhos.hasNext()) {
    const pasta = filhos.next();
    const fase = normalizarFaseExpansoesImportacao(pasta.getName());
    if (fase) {
      const elementos = pasta.getFolders();
      while (elementos.hasNext()) {
        const pastaElemento = elementos.next();
        obra.elementos.push(escanearElementoExpansoesTerceiros(pastaObra, pastaElemento, fase));
      }
      const arquivosFase = listarArquivosImportaveisExpansoes(pasta);
      if (arquivosFase.length) {
        obra.elementos.push(criarElementoArquivosSoltosExpansoes(pastaObra, pasta, fase, arquivosFase));
      }
    } else {
      obra.elementos.push(escanearElementoExpansoesTerceiros(pastaObra, pasta, 'fusoes'));
    }
  }

  return obra;
}

function listarArquivosImportaveisExpansoes(pasta) {
  const lista = [];
  const arquivos = pasta.getFiles();
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    if (arquivoEhImportavelExpansoes(arquivo)) lista.push(arquivo);
  }
  return lista;
}

function criarElementoArquivosSoltosExpansoes(pastaObra, pastaFase, fase, arquivos) {
  const nome = fase === 'kmz' ? 'KMZ DO PROJETO' : pastaFase.getName();
  const elemento = {
    nome: nome,
    fase: fase,
    folderId: pastaFase.getId(),
    viewUrl: pastaFase.getUrl(),
    kmz: [],
    fotos: [],
    subelementos: []
  };
  arquivos.forEach(function(arquivo) {
    if (arquivoEhKmzExpansoes(arquivo)) elemento.kmz.push(montarMidiaExpansoesImportada(arquivo, pastaFase, 'kmz', pastaObra, pastaFase, null));
    else if (arquivoEhImagemExpansoes(arquivo)) elemento.fotos.push(montarMidiaExpansoesImportada(arquivo, pastaFase, 'imagens', pastaObra, pastaFase, null));
  });
  return elemento;
}

function escanearElementoExpansoesTerceiros(pastaObra, pastaElemento, fase) {
  const elemento = {
    nome: pastaElemento.getName(),
    fase: fase || 'fusoes',
    folderId: pastaElemento.getId(),
    viewUrl: pastaElemento.getUrl(),
    kmz: [],
    fotos: [],
    subelementos: []
  };

  const arquivosDiretos = listarArquivosImportaveisExpansoes(pastaElemento);
  arquivosDiretos.forEach(function(arquivo) {
    if (arquivoEhKmzExpansoes(arquivo)) elemento.kmz.push(montarMidiaExpansoesImportada(arquivo, pastaElemento, 'kmz', pastaObra, pastaElemento, null));
    else if (arquivoEhImagemExpansoes(arquivo)) elemento.fotos.push(montarMidiaExpansoesImportada(arquivo, pastaElemento, 'imagens', pastaObra, pastaElemento, null));
  });

  const filhos = pastaElemento.getFolders();
  const subpastasNormais = [];
  while (filhos.hasNext()) {
    const pastaFilha = filhos.next();
    if (pastaEhMidiaExpansoes(pastaFilha.getName())) {
      const fotos = listarArquivosImportaveisExpansoes(pastaFilha)
        .filter(arquivoEhImagemExpansoes)
        .map(function(arquivo) { return montarMidiaExpansoesImportada(arquivo, pastaFilha, 'imagens', pastaObra, pastaElemento, pastaElemento); });
      if (fotos.length) {
        elemento.subelementos.push({
          nome: pastaElemento.getName(),
          folderId: pastaElemento.getId(),
          viewUrl: pastaElemento.getUrl(),
          fotos: fotos,
          diagrama_fusao: []
        });
      }
    } else if (pastaEhDiagramaExpansoes(pastaFilha.getName())) {
      const diagramas = listarArquivosImportaveisExpansoes(pastaFilha)
        .filter(arquivoEhImagemExpansoes)
        .map(function(arquivo) { return montarMidiaExpansoesImportada(arquivo, pastaFilha, 'diagrama_fusao', pastaObra, pastaElemento, pastaElemento); });
      if (diagramas.length) {
        elemento.subelementos.push({
          nome: pastaElemento.getName(),
          folderId: pastaElemento.getId(),
          viewUrl: pastaElemento.getUrl(),
          fotos: [],
          diagrama_fusao: diagramas
        });
      }
    } else {
      subpastasNormais.push(pastaFilha);
    }
  }

  subpastasNormais.forEach(function(pastaSub) {
    elemento.subelementos.push(escanearSubitemExpansoesTerceiros(pastaObra, pastaElemento, pastaSub));
  });

  if (!elemento.subelementos.length && elemento.fotos.length) {
    elemento.subelementos.push({
      nome: pastaElemento.getName(),
      folderId: pastaElemento.getId(),
      viewUrl: pastaElemento.getUrl(),
      fotos: elemento.fotos,
      diagrama_fusao: []
    });
    elemento.fotos = [];
  }

  return elemento;
}

function escanearSubitemExpansoesTerceiros(pastaObra, pastaElemento, pastaSub) {
  const sub = {
    nome: pastaSub.getName(),
    folderId: pastaSub.getId(),
    viewUrl: pastaSub.getUrl(),
    fotos: [],
    diagrama_fusao: []
  };

  listarArquivosImportaveisExpansoes(pastaSub).forEach(function(arquivo) {
    if (arquivoEhImagemExpansoes(arquivo)) sub.fotos.push(montarMidiaExpansoesImportada(arquivo, pastaSub, 'imagens', pastaObra, pastaElemento, pastaSub));
  });

  const filhos = pastaSub.getFolders();
  while (filhos.hasNext()) {
    const pastaFilha = filhos.next();
    const isDiag = pastaEhDiagramaExpansoes(pastaFilha.getName());
    const isFotos = pastaEhMidiaExpansoes(pastaFilha.getName());
    if (!isDiag && !isFotos) continue;
    listarArquivosImportaveisExpansoes(pastaFilha)
      .filter(arquivoEhImagemExpansoes)
      .forEach(function(arquivo) {
        const midia = montarMidiaExpansoesImportada(arquivo, pastaFilha, isDiag ? 'diagrama_fusao' : 'imagens', pastaObra, pastaElemento, pastaSub);
        if (isDiag) sub.diagrama_fusao.push(midia);
        else sub.fotos.push(midia);
      });
  }

  return sub;
}

function contarTotaisExpansoesObrasImportacao(obras) {
  const totais = { obras: obras.length, elementos: 0, subelementos: 0, arquivos: 0 };
  obras.forEach(function(obra) {
    (obra.elementos || []).forEach(function(el) {
      totais.elementos += 1;
      totais.arquivos += (el.kmz || []).length + (el.fotos || []).length;
      (el.subelementos || []).forEach(function(sub) {
        totais.subelementos += 1;
        totais.arquivos += (sub.fotos || []).length + (sub.diagrama_fusao || []).length;
      });
    });
  });
  return totais;
}

function limparObraEscaneada(obra) {
  if (!obra) return null;
  obra.elementos = (obra.elementos || [])
    .filter(elemento => elemento && Array.isArray(elemento.subelementos) && elemento.subelementos.length > 0);
  return obra;
}

function extrairIdPastaDrive(valor) {
  let texto = String(valor || '').trim();
  if (!texto) throw new Error('Link ou ID da pasta não informado.');

  texto = texto
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/[<>]/g, '')
    .trim();

  try {
    texto = decodeURIComponent(texto);
  } catch (err) {
    // Mantém o texto original se não for uma URL codificada válida.
  }

  const padroes = [
    /\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{10,})/,
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /\/d\/([a-zA-Z0-9_-]{10,})/,
    /^([a-zA-Z0-9_-]{10,})$/
  ];

  for (let i = 0; i < padroes.length; i++) {
    const match = texto.match(padroes[i]);
    if (match && match[1]) return match[1];
  }

  // Última tentativa: captura um ID longo do Drive dentro de um texto maior.
  const solto = texto.match(/([a-zA-Z0-9_-]{20,})/);
  if (solto && solto[1]) return solto[1];

  throw new Error('Não foi possível identificar o ID da pasta do Google Drive a partir do valor recebido: ' + texto.slice(0, 160));
}

function obterEntradaPastaDriveAtnx_(body, chavesPreferenciais) {
  const payload = normalizarBodyObjetoAtnx_(body);
  const chaves = chavesPreferenciais || [];
  const candidatos = [];
  const grupos = [
    payload,
    payload && payload.config,
    payload && payload.drive,
    payload && payload.googleDrive,
    payload && payload.expansoes,
    payload && payload.payload,
    payload && payload.data,
    payload && payload.params
  ];

  grupos.forEach(function(grupo) {
    if (!grupo || typeof grupo !== 'object') return;
    chaves.forEach(function(chave) {
      if (grupo[chave] !== undefined && grupo[chave] !== null && String(grupo[chave]).trim()) {
        candidatos.push(String(grupo[chave]).trim());
      }
    });
  });

  try {
    const props = PropertiesService.getScriptProperties();
    candidatos.push(props.getProperty(EXPANSOES_EXTERNAL_ROOT_PROP));
    candidatos.push(props.getProperty(EXPANSOES_EXTERNAL_ROOT_URL_PROP));
    candidatos.push(props.getProperty('PASTA_EXPANSOES_EXTERNA_ID'));
    candidatos.push(props.getProperty('PASTA_EXPANSOES_EXTERNA_URL'));
    candidatos.push(props.getProperty('EXPANSOES_ROOT_FOLDER_ID'));
    candidatos.push(props.getProperty('EXPANSOES_ROOT_FOLDER_URL'));
  } catch (err) {
    // Propriedades indisponíveis não impedem a importação via payload.
  }

  const limpos = candidatos
    .map(function(item) { return String(item || '').trim(); })
    .filter(Boolean);

  return limpos.length ? limpos[0] : '';
}

function normalizarBodyObjetoAtnx_(body) {
  if (!body) return {};

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (err) {
      return {};
    }
  }

  if (body.postData && body.postData.contents) {
    try {
      return JSON.parse(body.postData.contents);
    } catch (err) {
      return {};
    }
  }

  return body;
}

function abrirPastaDriveObrigatoriaAtnx_(valorOuId, descricao) {
  const folderId = extrairIdPastaDrive(valorOuId);
  let ultimoErro = '';

  try {
    const pasta = DriveApp.getFolderById(folderId);
    pasta.getName(); // força a validação real de permissão
    return pasta;
  } catch (err) {
    ultimoErro = err && err.message ? err.message : String(err);
  }

  // Alguns usuários colam o link de um atalho do Drive. Neste caso, tenta resolver
  // o alvo do atalho para a pasta real.
  try {
    const arquivo = DriveApp.getFileById(folderId);
    if (arquivo && typeof arquivo.getTargetId === 'function') {
      const targetId = arquivo.getTargetId();
      if (targetId) {
        const pastaAtalho = DriveApp.getFolderById(targetId);
        pastaAtalho.getName();
        Logger.log('[ATNX Expansões] Link recebido era atalho. ID alvo resolvido: ' + targetId);
        return pastaAtalho;
      }
    }
  } catch (errAtalho) {
    ultimoErro += ' | Atalho: ' + (errAtalho && errAtalho.message ? errAtalho.message : String(errAtalho));
  }

  throw new Error(
    'Não consegui acessar a ' + (descricao || 'pasta do Drive') + '. ' +
    'Confirme se o link/ID é da pasta principal real, se ela foi compartilhada com a conta proprietária do Drive, ' +
    'e se a implantação do Apps Script está executando como essa mesma conta. ' +
    'ID extraído: ' + folderId + '. Detalhe: ' + ultimoErro
  );
}

function configurarDriveExternoExpansoes() {
  const urlOuId = 'COLE_AQUI_O_LINK_OU_ID_DA_PASTA_PRINCIPAL_EXTERNA';
  if (urlOuId.indexOf('COLE_AQUI') >= 0) {
    throw new Error('Cole o link ou ID da pasta principal externa dentro da função configurarDriveExternoExpansoes.');
  }

  const pasta = abrirPastaDriveObrigatoriaAtnx_(urlOuId, 'pasta externa de Expansões');
  PropertiesService.getScriptProperties().setProperty(EXPANSOES_EXTERNAL_ROOT_PROP, pasta.getId());
  PropertiesService.getScriptProperties().setProperty(EXPANSOES_EXTERNAL_ROOT_URL_PROP, pasta.getUrl());

  Logger.log('Pasta externa de Expansões configurada com sucesso.');
  Logger.log('ID: ' + pasta.getId());
  Logger.log('Nome: ' + pasta.getName());
  Logger.log('URL: ' + pasta.getUrl());
}

function testeDriveExternoExpansoes() {
  const resultado = testarAcessoDriveExternoExpansoesDados({});
  Logger.log(JSON.stringify(resultado, null, 2));
}

function escanearPastasObraDentroDaRaiz(pastaRaiz) {
  const obras = [];
  const pastas = pastaRaiz.getFolders();

  while (pastas.hasNext()) {
    const pasta = pastas.next();

    if (pastaEhTipoRaiz(pasta)) {
      obras.push(escanearPastaTipoComoObra(pasta));
      continue;
    }

    if (!pastaTemPastasTipo(pasta)) continue;
    obras.push(escanearPastaObra(pasta));
  }

  return obras;
}

function normalizarTipoRaiz(nome) {
  const texto = normalizarNomeComparacao(nome).toUpperCase();
  if (texto === 'POP' || texto === 'CEO' || texto === 'CTO') return texto;
  return '';
}

function pastaEhTipoRaiz(pasta) {
  if (!pasta || !pasta.getName) return false;
  return !!normalizarTipoRaiz(pasta.getName());
}

function escanearPastaTipoComoObra(pastaTipo) {
  const tipo = normalizarTipoRaiz(pastaTipo.getName());
  const pastaPai = obterPrimeiroPai(pastaTipo);
  const pastaObra = pastaPai || pastaTipo;

  return {
    nome: pastaObra.getName(),
    folderId: pastaObra.getId(),
    viewUrl: pastaObra.getUrl(),
    elementos: escanearElementosDaPastaTipo(pastaObra, pastaTipo, tipo)
  };
}

function escanearElementosDaPastaTipo(pastaObra, pastaTipo, tipo) {
  const elementosEscaneados = [];
  const elementos = pastaTipo.getFolders();

  while (elementos.hasNext()) {
    const pastaElemento = elementos.next();
    if (pastaEhMidia(pastaElemento)) continue;
    elementosEscaneados.push(escanearPastaElemento(pastaObra, pastaTipo, pastaElemento, tipo));
  }

  return elementosEscaneados;
}

function pastaTemPastasTipo(pasta) {
  return ['POP', 'CEO', 'CTO'].some(tipo => !!obterPastaTipoSeExistir(pasta, tipo));
}

function obterPastaTipoSeExistir(pastaPai, tipo) {
  if (!pastaPai || !tipo) return null;

  const tipoNormalizado = normalizarNomeComparacao(tipo).toUpperCase();
  const pastas = pastaPai.getFolders();
  while (pastas.hasNext()) {
    const pasta = pastas.next();
    if (normalizarNomeComparacao(pasta.getName()).toUpperCase() === tipoNormalizado) {
      return pasta;
    }
  }

  return null;
}

function normalizarTipoMidiaPasta(nomePasta) {
  const nome = normalizarNomeComparacao(nomePasta)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const compacto = nome.replace(/\s+/g, '');

  if (['foto', 'fotos'].indexOf(nome) >= 0 || ['foto', 'fotos'].indexOf(compacto) >= 0) {
    return 'fotos';
  }

  if ([
    'diagrama',
    'diagramas',
    'diagrama fusao',
    'diagramas fusao',
    'fusao',
    'fusão'
  ].indexOf(nome) >= 0 || [
    'diagrama',
    'diagramas',
    'diagramafusao',
    'diagramasfusao',
    'fusao',
    'fusão'
  ].indexOf(compacto) >= 0) {
    return 'diagramas';
  }

  return '';
}

function pastaEhMidia(pasta) {
  return !!normalizarTipoMidiaPasta(pasta && pasta.getName ? pasta.getName() : pasta);
}

function obterPastasMidia(pastaPai, tipoMidia) {
  const resultado = [];
  if (!pastaPai) return resultado;

  const tipoEsperado = String(tipoMidia || '').toLowerCase() === 'diagramas' ? 'diagramas' : 'fotos';
  const pastas = pastaPai.getFolders();

  while (pastas.hasNext()) {
    const pasta = pastas.next();
    if (normalizarTipoMidiaPasta(pasta.getName()) === tipoEsperado) {
      resultado.push(pasta);
    }
  }

  return resultado;
}

function pastaPossuiMidiaDireta(pasta) {
  if (!pasta) return false;

  const arquivos = pasta.getFiles();
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    const mimeType = arquivo.getMimeType() || '';
    if (mimeType.toLowerCase().startsWith('image/')) return true;
  }

  const pastas = pasta.getFolders();
  while (pastas.hasNext()) {
    const filha = pastas.next();
    if (pastaEhMidia(filha)) return true;
  }

  return false;
}

function escanearPastaObra(pastaObra) {
  const obra = {
    nome: pastaObra.getName(),
    folderId: pastaObra.getId(),
    viewUrl: pastaObra.getUrl(),
    elementos: []
  };

  ['POP', 'CEO', 'CTO'].forEach(tipo => {
    const pastaTipo = obterPastaTipoSeExistir(pastaObra, tipo);
    if (!pastaTipo) return;
    obra.elementos.push.apply(obra.elementos, escanearElementosDaPastaTipo(pastaObra, pastaTipo, tipo));
  });

  return obra;
}

function escanearPastaElemento(pastaObra, pastaTipo, pastaElemento, tipo) {
  const tipoNormalizado = String(tipo || '').toUpperCase();
  const elemento = {
    nome: pastaElemento.getName(),
    tipo: tipoNormalizado,
    folderId: pastaElemento.getId(),
    viewUrl: pastaElemento.getUrl(),
    subelementos: []
  };

  // Formato direto aceito para POP, CTO e CEO:
  // Obra/Tipo/Ativo/Foto ou Fotos/...
  // Obra/Tipo/Ativo/Diagrama, Diagramas ou Diagrama_Fusao/...
  // Como o ATNX trabalha com Elemento + Subelemento, o nome do Ativo é duplicado no Subelemento.
  if (pastaPossuiMidiaDireta(pastaElemento)) {
    elemento.subelementos.push(escanearPastaSubelemento(pastaObra, pastaTipo, pastaElemento, pastaElemento, tipoNormalizado));
  }

  // Formato tradicional:
  // Obra/Tipo/Ativo/Subelemento/Foto ou Fotos/...
  // Obra/Tipo/Ativo/Subelemento/Diagrama, Diagramas ou Diagrama_Fusao/...
  const pastasSub = pastaElemento.getFolders();
  while (pastasSub.hasNext()) {
    const pastaSub = pastasSub.next();
    if (pastaEhMidia(pastaSub)) continue;

    elemento.subelementos.push(escanearPastaSubelemento(pastaObra, pastaTipo, pastaElemento, pastaSub, tipoNormalizado));
  }

  // Se o ativo não tiver fotos/diagramas nem subpastas, ainda assim cria um subelemento vazio
  // com o mesmo nome. Isso permite reconhecer a estrutura visual do Drive no ATNX.
  if (elemento.subelementos.length === 0) {
    elemento.subelementos.push(escanearPastaSubelemento(pastaObra, pastaTipo, pastaElemento, pastaElemento, tipoNormalizado));
  }

  return elemento;
}

function escanearPastaSubelemento(pastaObra, pastaTipo, pastaElemento, pastaSub, tipo) {
  const pastasFotos = obterPastasMidia(pastaSub, 'fotos');
  const pastasDiagramas = obterPastasMidia(pastaSub, 'diagramas');

  const folderIdsBase = {
    obraFolderId: pastaObra.getId(),
    tipoFolderId: pastaTipo.getId(),
    elementoFolderId: pastaElemento.getId(),
    subelementoFolderId: pastaSub.getId()
  };

  const fotos = [];
  const diagramas = [];

  // Imagens soltas diretamente na pasta do subelemento entram como Fotos.
  fotos.push.apply(fotos, escanearArquivosMidia(pastaSub, 'fotos', Object.assign({}, folderIdsBase, { midiaFolderId: pastaSub.getId() }), tipo, pastaObra, pastaTipo, pastaElemento, pastaSub));

  pastasFotos.forEach(pastaFotos => {
    fotos.push.apply(fotos, escanearArquivosMidia(pastaFotos, 'fotos', Object.assign({}, folderIdsBase, { midiaFolderId: pastaFotos.getId() }), tipo, pastaObra, pastaTipo, pastaElemento, pastaSub));
  });

  pastasDiagramas.forEach(pastaDiagramas => {
    diagramas.push.apply(diagramas, escanearArquivosMidia(pastaDiagramas, 'diagramas', Object.assign({}, folderIdsBase, { midiaFolderId: pastaDiagramas.getId() }), tipo, pastaObra, pastaTipo, pastaElemento, pastaSub));
  });

  return {
    nome: pastaSub.getName(),
    folderId: pastaSub.getId(),
    viewUrl: pastaSub.getUrl(),
    fotos,
    diagramas
  };
}

function escanearArquivosMidia(pastaMidia, tipoMidia, folderIds, tipo, pastaObra, pastaTipo, pastaElemento, pastaSub) {
  const midias = [];
  const arquivos = pastaMidia.getFiles();

  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    const mimeType = arquivo.getMimeType() || '';
    if (!mimeType.toLowerCase().startsWith('image/')) continue;

    if (COMPARTILHAR_ARQUIVOS_IMPORTADOS_COM_LINK) {
      try {
        arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {
        // Mantém a importação mesmo se algum arquivo não puder ter o compartilhamento alterado.
      }
    }

    const fileId = arquivo.getId();
    midias.push({
      nome: arquivo.getName(),
      fileId,
      folderId: pastaMidia.getId(),
      folderIds,
      url: `https://drive.google.com/uc?export=view&id=${fileId}`,
      viewUrl: arquivo.getUrl(),
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
      mimeType,
      origem: 'google_drive_importado',
      criadoEm: formatarDataIso(arquivo.getDateCreated()),
      caminho: [
        ROOT_FOLDER_NAME,
        pastaObra.getName(),
        tipo,
        pastaElemento.getName(),
        pastaSub.getName(),
        tipoMidia === 'diagramas' ? 'Diagramas' : 'Fotos'
      ].join('/')
    });
  }

  return midias;
}

function contarTotaisImportacao(obras) {
  const totais = { obras: obras.length, elementos: 0, subelementos: 0, midias: 0 };

  obras.forEach(obra => {
    (obra.elementos || []).forEach(elemento => {
      totais.elementos += 1;
      (elemento.subelementos || []).forEach(sub => {
        totais.subelementos += 1;
        totais.midias += (sub.fotos || []).length + (sub.diagramas || []).length;
      });
    });
  });

  return totais;
}

function normalizarNomeComparacao(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatarDataIso(data) {
  return Utilities.formatDate(data || new Date(), 'GMT', "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function validarPayload(body) {
  const obrigatorios = [
    'nomeArquivo',
    'mimeType',
    'base64',
    'obraNome',
    'elementoTipo',
    'elementoNome',
    'subelementoNome',
    'tipoMidia'
  ];

  obrigatorios.forEach(campo => {
    if (!body[campo]) throw new Error(`Campo obrigatório ausente: ${campo}`);
  });

  validarArquivoPermitidoPorTipo(body, body.tipoMidia);
}

function validarArquivoPermitidoPorTipo(item, tipoMidia) {
  const tipo = String(tipoMidia || 'imagens').toLowerCase().trim();
  const mime = String(item.mimeType || '').toLowerCase();
  const nome = String(item.nomeArquivo || item.name || '').toLowerCase();

  if (tipo === 'imagens' || tipo === 'imagem' || tipo === 'fotos' || tipo === 'foto' || tipo === 'diagramas' || tipo === 'diagrama') {
    if (!mime.startsWith('image/')) throw new Error('Somente imagens são permitidas para este campo.');
    return true;
  }

  if (tipo === 'kmz' || tipo === 'kml') {
    if (nome.endsWith('.kmz') || nome.endsWith('.kml') || mime.indexOf('google-earth') >= 0 || mime === 'application/octet-stream') return true;
    throw new Error('O campo KMZ aceita apenas arquivos .KMZ ou .KML.');
  }

  if (tipo === 'lista_materiais' || tipo === 'lista-de-materiais' || tipo === 'excel' || tipo === 'planilha') {
    if (/\.(xls|xlsx|xlsm|csv)$/.test(nome) || mime.indexOf('spreadsheet') >= 0 || mime.indexOf('excel') >= 0 || mime === 'text/csv' || mime === 'application/vnd.ms-excel') return true;
    throw new Error('A Lista de Materiais aceita apenas Excel ou CSV.');
  }

  return true;
}

function obterEstruturaDestino(body) {
  if (String(body.modulo || '').toLowerCase() === 'expansoes') {
    return obterEstruturaDestinoExpansoes(body);
  }

  const raiz = obterPastaRaiz(body);
  const pastaObra = obterOuCriarPasta(raiz, limparNome(body.obraNome));
  const pastaTipo = obterOuCriarPasta(pastaObra, limparNome(body.elementoTipo));
  const pastaElemento = obterOuCriarPasta(pastaTipo, limparNome(body.elementoNome));
  const pastaSubelemento = obterOuCriarPasta(pastaElemento, limparNome(body.subelementoNome));
  const pastaMidia = obterOuCriarPasta(
    pastaSubelemento,
    body.tipoMidia === 'diagramas' ? 'Diagramas' : body.tipoMidia === 'imagens' ? 'Imagens' : 'Fotos'
  );

  return {
    raiz,
    pastaObra,
    pastaTipo,
    pastaElemento,
    pastaSubelemento,
    pastaMidia
  };
}

function obterEstruturaDestinoExpansoes(body) {
  const raiz = obterPastaRaiz(body);

  // Organização espelhada ao módulo Obras, mas com nomes próprios de Expansões:
  // Expansões / Grupo / Projeto / Imagens
  // Expansões / Grupo / Projeto / KMZ
  // Expansões / Grupo / Projeto / Lista de Materiais
  // Expansões / Grupo / Projeto / Subelementos / Subelemento / Imagens
  const pastaGrupo = obterOuCriarPasta(raiz, limparNome(body.grupoNome || body.obraNome || 'Projetos em Progresso'));
  const pastaProjeto = obterOuCriarPasta(pastaGrupo, limparNome(body.expansaoNome || body.elementoNome || 'Projeto sem nome'));
  const pastaSubRaiz = body.subitemNome && String(body.tipoMidia || '').toLowerCase() === 'imagens' ? obterOuCriarPasta(pastaProjeto, 'Subelementos') : pastaProjeto;
  const pastaSubelemento = body.subitemNome && String(body.tipoMidia || '').toLowerCase() === 'imagens'
    ? obterOuCriarPasta(pastaSubRaiz, limparNome(body.subitemNome))
    : pastaProjeto;
  const pastaMidia = obterOuCriarPasta(pastaSubelemento, obterNomePastaMidiaExpansoes(body));

  return {
    raiz,
    pastaObra: pastaGrupo,
    pastaTipo: pastaProjeto,
    pastaElemento: pastaSubRaiz,
    pastaSubelemento,
    pastaMidia
  };
}

function obterNomePastaMidiaExpansoes(body) {
  const informado = String(body && body.pastaMidiaNome ? body.pastaMidiaNome : '').trim();
  if (informado) return limparNome(informado);
  const tipo = String(body && body.tipoMidia ? body.tipoMidia : 'imagens').toLowerCase().trim();
  if (tipo === 'kmz' || tipo === 'kml') return 'KMZ';
  if (tipo === 'lista_materiais' || tipo === 'lista-de-materiais' || tipo === 'excel' || tipo === 'planilha') return 'Lista de Materiais';
  if (tipo === 'diagramas') return 'Diagramas';
  if (tipo === 'fotos') return 'Fotos';
  return 'Imagens';
}

function obterPastaRaiz(body) {
  const moduloInformado = body && (body.modulo || body.module) ? (body.modulo || body.module) : ATNX_DRIVE_MODULE;
  const modulo = normalizarModuloAtnx(moduloInformado);
  const rootFolderId = body && (body.rootFolderId || body.rootFolderUrl) ? String(body.rootFolderId || body.rootFolderUrl).trim() : '';

  // 1) O dashboard pode enviar explicitamente a pasta correta do módulo.
  if (rootFolderId) {
    return obterPastaRaizObrigatoria(rootFolderId, 'pasta raiz informada pelo dashboard');
  }

  // 2) Separação oficial por módulo.
  if (modulo === 'expansoes' || modulo === 'expansões') {
    if (!EXPANSOES_ROOT_FOLDER_ID) {
      throw new Error('Pasta raiz de Expansões não configurada no Apps Script. Configure EXPANSOES_ROOT_FOLDER_ID.');
    }
    return obterPastaRaizObrigatoria(EXPANSOES_ROOT_FOLDER_ID, 'pasta raiz de Expansões');
  }

  if (modulo === 'documentacao' || modulo === 'documentação' || modulo === 'obras' || !modulo) {
    if (!DOCUMENTACAO_ROOT_FOLDER_ID) {
      throw new Error('Pasta raiz de Documentação não configurada no Apps Script. Configure DOCUMENTACAO_ROOT_FOLDER_ID.');
    }
    return obterPastaRaizObrigatoria(DOCUMENTACAO_ROOT_FOLDER_ID, 'pasta raiz de Documentação');
  }

  throw new Error('Módulo de Drive não reconhecido: ' + modulo + '. Use documentacao ou expansoes.');
}

function obterPastaRaizObrigatoria(folderId, descricao) {
  return abrirPastaDriveObrigatoriaAtnx_(folderId, descricao);
}

function obterOuCriarPasta(pastaPai, nome) {
  const nomeSeguro = limparNome(nome);
  const encontradas = pastaPai.getFoldersByName(nomeSeguro);

  if (encontradas.hasNext()) {
    return encontradas.next();
  }

  return pastaPai.createFolder(nomeSeguro);
}

function obterPastaFilhaSeExistir(pastaPai, nome) {
  if (!pastaPai || !nome) return null;

  const nomeSeguro = limparNome(nome);
  const encontradas = pastaPai.getFoldersByName(nomeSeguro);
  return encontradas.hasNext() ? encontradas.next() : null;
}

function obterPastaPorCaminho(path, targetType, body) {
  if (!path || !path.obraNome) return null;

  let pasta = obterPastaFilhaSeExistir(obterPastaRaiz(body), path.obraNome);
  if (!pasta || targetType === 'obra') return pasta;

  pasta = obterPastaFilhaSeExistir(pasta, path.elementoTipo);
  if (!pasta || targetType === 'tipo') return pasta;

  pasta = obterPastaFilhaSeExistir(pasta, path.elementoNome);
  if (!pasta || targetType === 'elemento') return pasta;

  pasta = obterPastaFilhaSeExistir(pasta, path.subelementoNome);
  if (!pasta || targetType === 'subelemento') return pasta;

  return pasta;
}

function obterPastaAncestralPorArquivos(fileIds, targetType) {
  for (let i = 0; i < fileIds.length; i++) {
    try {
      const arquivo = DriveApp.getFileById(String(fileIds[i]));
      const paisArquivo = arquivo.getParents();
      if (!paisArquivo.hasNext()) continue;

      // Arquivo → Fotos/Diagramas → Subelemento → Elemento → Tipo → Obra
      const pastaMidia = paisArquivo.next();
      if (targetType === 'midia') return pastaMidia;

      const pastaSubelemento = obterPrimeiroPai(pastaMidia);
      if (targetType === 'subelemento') return pastaSubelemento;

      const pastaElemento = obterPrimeiroPai(pastaSubelemento);
      if (targetType === 'elemento') return pastaElemento;

      const pastaTipo = obterPrimeiroPai(pastaElemento);
      if (targetType === 'tipo') return pastaTipo;

      const pastaObra = obterPrimeiroPai(pastaTipo);
      if (targetType === 'obra') return pastaObra;
    } catch (err) {
      // Tenta o próximo arquivo caso algum ID esteja inválido ou já inacessível.
    }
  }

  return null;
}

function obterPrimeiroPai(pasta) {
  if (!pasta) return null;
  const pais = pasta.getParents();
  return pais.hasNext() ? pais.next() : null;
}

function normalizarTipoAlvo(valor) {
  const texto = String(valor || '').toLowerCase().trim();
  if (['obra', 'cidade'].indexOf(texto) >= 0) return 'obra';
  if (['tipo', 'categoria'].indexOf(texto) >= 0) return 'tipo';
  if (['elemento', 'ativo', 'ativo principal'].indexOf(texto) >= 0) return 'elemento';
  if (['projeto', 'expansao', 'expansão'].indexOf(texto) >= 0) return 'tipo';
  if (['subelemento', 'porta', 'sub', 'subitem', 'item'].indexOf(texto) >= 0) return 'subelemento';
  if (['midia', 'mídia', 'fotos', 'diagramas', 'imagens'].indexOf(texto) >= 0) return 'midia';
  return texto;
}

function limparNome(valor) {
  return String(valor || 'Sem nome')
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120) || 'Sem nome';
}

function montarNomeArquivo(nomeOriginal) {
  const limpo = limparNome(nomeOriginal);
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  return `${timestamp}-${limpo}`;
}

function montarCaminhoRetorno(body) {
  if (String(body.modulo || '').toLowerCase() === 'expansoes') {
    return [
      body.rootFolderName || 'Expansões',
      limparNome(body.grupoNome || body.obraNome || 'Projetos em Progresso'),
      limparNome(body.expansaoNome || body.elementoNome || 'Projeto sem nome'),
      body.subitemNome && String(body.tipoMidia || '').toLowerCase() === 'imagens' ? 'Subelementos' : '',
      body.subitemNome && String(body.tipoMidia || '').toLowerCase() === 'imagens' ? limparNome(body.subitemNome) : '',
      obterNomePastaMidiaExpansoes(body)
    ].filter(Boolean).join('/');
  }

  return [
    ROOT_FOLDER_NAME,
    limparNome(body.obraNome),
    limparNome(body.elementoTipo),
    limparNome(body.elementoNome),
    limparNome(body.subelementoNome),
    body.tipoMidia === 'diagramas' ? 'Diagramas' : body.tipoMidia === 'imagens' ? 'Imagens' : 'Fotos'
  ].join('/');
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpResponse(obj, callback) {
  const nomeCallback = String(callback || 'callback').replace(/[^a-zA-Z0-9_.$]/g, '');
  const conteudo = nomeCallback + '(' + JSON.stringify(obj) + ');';
  return ContentService
    .createTextOutput(conteudo)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
