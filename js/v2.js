(function atlasV2Official() {
  'use strict';

window.__ATLAS_VERSION__ = '2.4.1 OFICIAL';

  // ---------------------------------------------------------------------------
  // VERSAO DOS ARQUIVOS WEB - fonte unica.
  //
  // Ao publicar uma versao nova, altere ATLAS_BUILD aqui e use exatamente a
  // mesma string nas querystrings ?v= do index.html (css/v2.css, js/v2.js e
  // config/config.js) e nos icones do manifest.webmanifest.
  //
  // O service-worker.js NAO precisa ser editado: ele le a versao do proprio
  // parametro ?v= do registro e deriva dela o nome do cache e as URLs do
  // pre-cache. tests/static-audit.cjs falha se index.html e ATLAS_BUILD
  // divergirem, que era a causa dos casos de "publiquei mas continua igual".
  // ---------------------------------------------------------------------------
  const ATLAS_BUILD = '2.4.1-secure-preview-official';
  window.__ATLAS_BUILD__ = ATLAS_BUILD;

  // Changelog exibido na tela de Inicio. Toda alteracao funcional ou correcao
  // publicada precisa ser registrada aqui antes do deploy.
  // Ordem: mais recente primeiro.
  const CHANGELOG = [
    {
      version: 'V2.4.1 Oficial',
      date: '2026-08-24',
      notes: [
        'Pipeline: nova tabela interna de rastreio de migrations (registra, por ambiente, quais dos arquivos supabase/*.sql já foram aplicados e com qual hash) - facilita conferir se homologação e produção estão com o mesmo schema aplicado.',
        'Segurança: conexão de armazenamento do tipo "servidor local" não aceita mais apontar para o endereço link-local (169.254.0.0/16 e fe80::/10) usado pelos serviços de metadados de nuvem (AWS/GCP/Azure); IPs privados de rede interna (10.x, 172.16-31.x, 192.168.x) e localhost continuam permitidos normalmente.',
        'Segurança: anexos de conversa (chat) agora seguem a mesma allowlist de formato dos anexos do elemento (documentos, planilhas, imagens, PDF, compactados) - antes só existia validação no aplicativo, agora também é aplicada diretamente no armazenamento, então nem uma chamada direta à API consegue subir HTML, SVG ou script disfarçado de anexo.',
        'Segurança: sair da conta (logout) agora limpa o backup local salvo no navegador (localStorage e cache offline), evitando que dados do usuário anterior fiquem visíveis para a próxima pessoa que logar no mesmo computador.',
        'Excluir um grupo agora pede confirmação antes de mover para a lixeira - mesma proteção que já existia para obra e itens/subitens.',
        'Quadro sem nenhum grupo ganhou um botão "Criar grupo" na própria tela vazia, em vez de só uma mensagem informativa.',
        'Correção: ao testar uma conexão de armazenamento duas vezes seguidas (ex.: corrigir a URL e testar de novo antes da primeira resposta chegar), uma resposta antiga e atrasada podia sobrescrever o resultado do teste mais recente e marcar a conexão como validada mesmo depois de um teste mais novo ter falhado.',
        'Correção: excluir uma obra ou itens/subitens, quando o Supabase não confirmava os dados mais recentes antes de mandar para a lixeira, continuava a exclusão silenciosamente (só um aviso no console); agora aborta e avisa a pessoa, sem risco de perder dado da lixeira.',
        'Correção: a prévia privada de imagens (introduzida nesta versão) tinha a permissão liberada no banco, mas o conector do Google Drive não implementava a ação que ela chama - a funcionalidade não funcionava. Os 3 conectores setoriais agora implementam a prévia, restrita a quem pode ver o quadro dono do arquivo.',
        'Correção: uma conexão de armazenamento do tipo "servidor local" (Fase 0.1 de self-hosting) sincronizada pelo lote normal de sincronização perdia esse tipo silenciosamente e voltava a ser tratada como Google Drive; a sincronização agora preserva o tipo da conexão.',
        'Correção: a Agenda em modo mobile exibia texto corrompido no cabeçalho (mês anterior, mês atual e próximo mês).',
        'Correção: excluir um item, ou vários itens selecionados de uma vez, agora pede confirmação antes de mover para a lixeira - mesma proteção que já existia para excluir uma Obra.',
        'Correção: o redirecionamento de v2.html (URL antiga do Atlas) deixou de ser bloqueado silenciosamente pela política de segurança do navegador.',
        'Manual: limite de importação corrigido para refletir o valor real (15 MB) e rótulo de versão do manual alinhado ao rodapé do aplicativo.',
        'Prévia privada de imagens: fotos do Drive passam a abrir dentro do Atlas sem depender de cookies do Google no navegador; a leitura continua restrita às pessoas com acesso ao quadro.',
        'Campos de arquivo podem controlar versões: ao editar a coluna, marque "Controlar versões" e cada envio novo passa a virar V1, V2, V3 em vez de outro anexo solto.',
        'O visualizador ganhou um painel de Histórico, com as versões do documento, download de qualquer uma delas e o botão "Adicionar versão".',
        'Cada versão aceita um rótulo livre (ex.: "revisão do cliente"), e a célula do quadro passa a mostrar a versão vigente.',
        'O limite de 12 arquivos por campo passa a contar documentos: as versões de cada um não ocupam o limite.',
        'Conversas: cada elemento e subelemento agora possui um chat próprio, disponível na Tabela, no Kanban e no modo de campo.',
        'Menções: digite @ para localizar usuários; a pessoa mencionada recebe uma notificação no Atlas que abre diretamente a conversa correta.',
        'Anexos do chat: cada mensagem aceita até 5 arquivos privados, com validação de tamanho, progresso de envio e limpeza automática em caso de falha.',
        'Tempo real: novas mensagens, exclusões, contadores de conversa e notificações são atualizados sem recarregar o quadro inteiro.',
        'Segurança: o chat respeita as permissões do quadro, restringe os arquivos ao elemento e ao usuário autenticado e limpa notificações de mensagens excluídas.',
        'Acessibilidade: os botões de conversa mantêm uma identificação clara mesmo quando exibem o contador de mensagens.',
        'Movimentação entre módulos: elementos podem ser enviados para qualquer quadro e setor permitido, individualmente ou por seleção em massa, sempre junto com seus subelementos.',
        'Preservação de dados: valores, anexos, histórico, conversas e notificações acompanham o elemento; campos equivalentes são associados por nome e tipo e os ausentes podem ser criados no destino.',
        'Automações entre módulos: regras podem mover o item para outro quadro e o destino pode reagir com o novo gatilho “item recebido de outro quadro”.',
        'Tempo real entre quadros: a origem recebe a remoção e o destino recebe o elemento movido sem depender de uma recarga completa da aplicação.',
        'Fórmulas de coluna: SOMA_COLUNA, MEDIA_COLUNA, MINIMO_COLUNA, MAXIMO_COLUNA e CONT_COLUNA calculam todos os elementos ativos do quadro, sem misturar os subelementos.',
        'Cálculo ao vivo: ao editar um valor, as fórmulas que dependem da coluna inteira são atualizadas em todas as linhas visíveis antes mesmo de sair do campo.',
        'Tabelas extensas: o título das colunas acompanha a rolagem vertical somente enquanto o setor correspondente estiver na tela.',
        'Navegação da tabela: a roda do mouse passa a mover o quadro para os lados quando o ponteiro está sobre o setor; fora dele, a página continua rolando para baixo normalmente.',
        'Interface mais compacta: compartilhamento, configurações e ferramentas foram reunidos em uma única barra minimalista, liberando mais espaço para os dados.',
        'Menu lateral: o Atlas passa a iniciar com a navegação recolhida e o cabeçalho do quadro acompanha o fluxo normal da página.',
        'Barra de ferramentas: os comandos ganharam mais respiro e separação visual para evitar ícones amontoados.',
        'Colunas congeladas: seleção e Registro permanecem juntas à esquerda durante a rolagem horizontal.',
        'Identidade visual: o menu lateral e o visualizador de arquivos acompanham a cor ativa do Atlas com superfícies translúcidas e leitura preservada nos modos claro e escuro.',
        'Página inicial: as novidades da versão foram reunidas por assunto em tópicos expansíveis, mantendo todas as informações sem ocupar a tela inteira.',
        'Correção visual: no modo claro, o visualizador de arquivos e o Histórico agora usam superfícies claras; o acabamento escuro fica restrito ao tema escuro.',
        'Ações por registro: os comandos deixaram a coluna separada e agora ficam em ícones compactos dentro do nome do elemento ou subelemento, com o contador do chat sempre visível.',
        'Proteção de arquivos: excluir, restaurar ou organizar no Drive agora valida cada arquivo contra o quadro autorizado antes de executar qualquer alteração.',
        'Exclusões confirmadas: o Atlas só conclui uma remoção depois que o servidor confirma todas as linhas afetadas; bloqueios de permissão deixam de parecer sucesso.',
        'Lixeira confiável: exclusões em lote são preparadas em uma única operação e grupos ou colunas são carregados por inteiro antes de serem guardados para restauração.',
        'Recuperação administrativa: o banco ganhou uma rota restrita de emergência para recuperar registros apagados a partir do histórico de alterações.',
        'Sincronização robusta: anexos, atualizações em tempo real e automações em lotes grandes deixam de perder registros por limite, cursor ou carregamento parcial.',
        'Uploads protegidos: arquivos que falharem ao registrar no Atlas são removidos do Drive com comprovante temporário e confirmação do resultado.',
        'Publicação segura: homologação agora bloqueia pacotes incompletos, aplica cabeçalhos de segurança e oferece resposta clara quando um recurso não existe no cache offline.',
        'Privacidade de homologação: páginas de teste passam a solicitar que buscadores não indexem nem arquivem o ambiente.',
        'Automações agendadas: regras por data e horário passam a ser processadas pelo servidor mesmo quando ninguém está com o Atlas aberto.',
        'Sincronização atômica: alterações relacionadas agora são confirmadas juntas pelo banco; se uma etapa falhar, nenhuma parte do lote fica salva pela metade.',
        'Movimentação protegida: um subelemento só pode ser movido junto com seu elemento principal, evitando mudanças acidentais na hierarquia.',
        'Lixeira protegida: o servidor confere a origem real de cada arquivo e deixa de aceitar IDs informados apenas pelo navegador.',
        'Publicação verificada: o processo de homologação bloqueia destino ou banco incompatível e só conclui depois de validar a versão realmente disponível no endereço de teste.',
      ],
    },
    {
      version: 'V2.3.3 Homologação',
      date: '2026-08-11',
      notes: [
        'Fórmulas: agora aceitam SE(condição;então;senão), com comparadores (> < >= <= = <>) e aninhamento.',
        'Fórmulas: novas funções de agregação sobre subitens - SOMA, MEDIA, MINIMO, MAXIMO, CONT.',
        'Cada versão aceita uma descrição livre (ex.: "revisão do cliente"), editável a qualquer momento pelo próprio histórico.',
        'Correção: subitens recolhidos deixavam de carregar seus valores, aparecendo em branco e zerando as fórmulas que dependiam deles.',
        'Correção: as atualizações em tempo real paravam de ser aplicadas de forma leve depois do primeiro salvamento da sessão, obrigando o quadro a recarregar por inteiro a cada alteração.',
        'Automações: alterações passam a atualizar apenas a lista de automações, sem recarregar o quadro todo.',
      ],
    },
    {
      version: 'V2.3.2 Oficial',
      date: '2026-08-11',
      notes: [
        'Correção: campos do quadro perdiam o foco e o que estava sendo digitado quando uma atualização em tempo real chegava enquanto a pessoa editava - sobretudo ao voltar para a aba depois de estar fora dela.',
        'Correção: automações que movem um item de grupo agora colocam o item ao final do grupo de destino, em vez de numa posição arbitrária.',
        'Correção: campos de data não descartam mais o que estava sendo digitado quando a janela perde o foco no meio do preenchimento.',
        'Correção: uma atualização completa do quadro não descarta mais, sem necessidade, valores já carregados de outros quadros ou subitens.',
      ],
    },
    {
      version: 'V2.3.1 Oficial',
      date: '2026-08-10',
      notes: [
        'Correção: fórmulas que referenciam outra coluna de fórmula (ex.: uma fórmula usada dentro de outra) agora calculam corretamente, em vez de ficar sempre em branco.',
      ],
    },
    {
      version: 'V2.3.0 Oficial',
      date: '2026-08-06',
      notes: [
        'Tela de Início: saudação por horário, versão atual e histórico de atualizações.',
        'Controle de acesso por obra: administradores podem liberar ou bloquear o acesso de um usuário a um item específico de um quadro.',
        'Correção: reordenar grupos e colunas de um quadro agora é salvo de verdade (antes revertia ao atualizar o site).',
        'Correção: falso "conflito de atualização" que travava a sincronização de colunas mais antigas.',
        'Campo de moeda com máscara automática em R$ (centavos para cima) e cálculo correto em fórmulas.',
        'Ícones de módulo personalizáveis, com um pequeno acervo de opções.',
        'Fórmulas atualizam em tempo real enquanto os campos referenciados são preenchidos.',
        'Limite de upload de arquivos aumentado de 15 MB para 30 MB.',
      ],
    },
    {
      version: 'V2.2.0 Desenvolvimento',
      date: '2026-07-30',
      notes: [
        'Correção crítica: sincronização em segundo plano podia apagar valores e anexos de itens ainda não abertos na sessão.',
        'Correção crítica: restaurar itens da lixeira podia perder valores de subitens nunca abertos antes da exclusão.',
        'Revisão completa do código-fonte, com dezenas de correções de dados, permissões e importação.',
        'Ambiente de homologação separado da produção para testar mudanças com segurança.',
      ],
    },
  ];

  function greetingForHour(hour) {
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function formatChangelogDate(value) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  const CHANGELOG_TOPICS = [
    {
      id: 'files',
      title: 'Arquivos e versões',
      icon: 'files',
      summary: 'Histórico, visualização e controle dos documentos.',
      prefixes: ['Campos de arquivo', 'O visualizador', 'Cada versão', 'O limite de 12 arquivos'],
    },
    {
      id: 'chat',
      title: 'Conversas e notificações',
      icon: 'messages-square',
      summary: 'Chat, menções, anexos e atualizações em tempo real.',
      prefixes: ['Conversas:', 'Menções:', 'Anexos do chat:', 'Tempo real: novas mensagens', 'Segurança: o chat', 'Acessibilidade: os botões de conversa'],
    },
    {
      id: 'flow',
      title: 'Fluxos entre módulos',
      icon: 'workflow',
      summary: 'Movimentação de itens, dados e automações entre quadros.',
      prefixes: ['Movimentação entre módulos:', 'Preservação de dados:', 'Automações entre módulos:', 'Tempo real entre quadros:'],
    },
    {
      id: 'formulas',
      title: 'Fórmulas e cálculos',
      icon: 'calculator',
      summary: 'Cálculos sobre colunas e atualização imediata dos resultados.',
      prefixes: ['Fórmulas de coluna:', 'Cálculo ao vivo:'],
    },
    {
      id: 'security',
      title: 'Segurança e integridade',
      icon: 'shield-check',
      summary: 'Proteção do Drive, exclusões verificadas, recuperação e publicação segura.',
      prefixes: ['Proteção de arquivos:', 'Exclusões confirmadas:', 'Lixeira confiável:', 'Recuperação administrativa:', 'Sincronização robusta:', 'Uploads protegidos:', 'Publicação segura:', 'Privacidade de homologação:', 'Automações agendadas:'],
    },
    {
      id: 'interface',
      title: 'Interface e navegação',
      icon: 'layout-dashboard',
      summary: 'Mais espaço útil, navegação fluida e aparência integrada.',
      prefixes: ['Tabelas extensas:', 'Navegação da tabela:', 'Interface mais compacta:', 'Menu lateral:', 'Barra de ferramentas:', 'Colunas congeladas:', 'Identidade visual:', 'Página inicial:', 'Correção visual:', 'Ações por registro:'],
    },
  ];

  function groupChangelogNotes(notes) {
    const groups = new Map(CHANGELOG_TOPICS.map((topic) => [topic.id, { ...topic, notes: [] }]));
    const fallback = { id: 'other', title: 'Outras melhorias', icon: 'sparkles', summary: 'Ajustes complementares desta versão.', notes: [] };
    (Array.isArray(notes) ? notes : []).forEach((note) => {
      const text = String(note || '');
      const topic = CHANGELOG_TOPICS.find((entry) => entry.prefixes.some((prefix) => text.startsWith(prefix)));
      (topic ? groups.get(topic.id) : fallback).notes.push(text);
    });
    const result = [...groups.values()].filter((group) => group.notes.length);
    if (fallback.notes.length) result.push(fallback);
    return result;
  }

  const STORAGE_KEY = 'atlas-v2-official-data';
  const THEME_KEY = 'atlas-v2-theme';
  const SIDEBAR_KEY = 'atlas-v2-sidebar-collapsed';
  const GANTT_SCALE_KEY = 'atlas-v2-gantt-scale';
  const GANTT_ZOOM_KEY = 'atlas-v2-gantt-zoom';
  const FIELD_MODE_KEY = 'atlas-v2-field-mode';
  const SAVED_SEARCHES_KEY = 'atlas-v2-saved-searches';
  const BOOTSTRAP_CACHE_DB = 'atlas-v2-bootstrap-cache';
  const BOOTSTRAP_CACHE_STORE = 'snapshots';
  // v2 acrescentou o store de previas de imagem. Mesmo banco, outro store: a
  // previa segura passa pelo Apps Script e tem cota, entao perder o cache a cada
  // recarregamento (o Map em memoria fazia isso) queimava a cota de novo.
  const IMAGE_PREVIEW_STORE = 'imagePreviews';
  const BOOTSTRAP_CACHE_VERSION = 2;
  // Teto do store: uma previa e a imagem INTEIRA em base64 (o conector nao
  // redimensiona), entao sem poda o IndexedDB cresce sem limite.
  const IMAGE_PREVIEW_CACHE_MAX = 300;
  // O conector limita 'preview' a 20 chamadas por janela
  // (atlasEnforceRateLimit_). Concorrencia baixa e recuo longo evitam gastar a
  // cota inteira num quadro cheio de fotos e deixar o resto sem miniatura.
  const IMAGE_PREVIEW_CONCURRENCY = 2;
  const IMAGE_PREVIEW_COOLDOWN_MS = 90_000;
  const LOCAL_BACKUP_VERSION = 2;
  const LOCAL_BACKUP_MAX_CHARS = 3_200_000;

  const ACCESS = {
    main: { label: 'Organizacional', icon: 'building-2' },
    private: { label: 'Restrito', icon: 'lock' },
    shareable: { label: 'Compartilhável', icon: 'users' },
  };

  const ROLE_DEFINITIONS = {
    admin: { label: 'Admin', description: 'Controle total do Atlas.', permissions: ['view', 'create', 'edit', 'delete', 'share', 'configure', 'admin'] },
    supervisor: { label: 'Supervisor', description: 'Gestão operacional e exclusão de registros.', permissions: ['view', 'create', 'edit', 'delete', 'share'] },
    operador: { label: 'Operador', description: 'Operação diária, criação e edição.', permissions: ['view', 'create', 'edit'] },
    visualizador: { label: 'Visualizador', description: 'Consulta sem alteração de dados.', permissions: ['view'] },
  };

  const ACCESS_LEVELS = {
    viewer: { label: 'Visualização', permissions: ['view'] },
    editor: { label: 'Edição', permissions: ['view', 'create', 'edit'] },
    manager: { label: 'Gestão', permissions: ['view', 'create', 'edit', 'delete', 'share', 'configure'] },
    blocked: { label: 'Bloqueado', permissions: [] },
  };

  const USER_STATUSES = {
    active: 'Ativo',
    pending: 'Aguardando liberação',
    blocked: 'Bloqueado',
  };

  const PROFILE_STATUS_FROM_DATABASE = {
    ativo: 'active',
    pendente: 'pending',
    bloqueado: 'blocked',
  };

  const PROFILE_STATUS_TO_DATABASE = {
    active: 'ativo',
    pending: 'pendente',
    blocked: 'bloqueado',
  };

  const VIEW_TYPES = {
    table: { label: 'Tabela', icon: 'table-2' },
    works: { label: 'Obras', icon: 'hard-hat' },
    kanban: { label: 'Kanban', icon: 'columns-3' },
    gantt: { label: 'Gantt', icon: 'chart-gantt' },
    calendar: { label: 'Calendário', icon: 'calendar-days' },
    dashboard: { label: 'Painel', icon: 'layout-dashboard' },
  };

  // Visoes que todo quadro tem por padrao. Fonte unica: usada pela fabrica
  // board() e pela hidratacao remota, que precisa GARANTIR estas tres mesmo
  // quando nao existe linha correspondente em atlas_v2_views (ver BUG-03).
  const DEFAULT_BOARD_VIEWS = ['table', 'kanban', 'gantt'];

  // Tipos de armazenamento de uma conexao de setor.
  //   drive -> Google Drive via Web App do Apps Script (o unico que existia)
  //   local -> servidor proprio que implementa o MESMO contrato de 9 acoes
  //            (testconnection, upload, delete, restore, move, driveprobe,
  //            drivepin, driverevision, driveupdate)
  // Conexao legada, sem tipo gravado, conta como 'drive'. E esse padrao que
  // garante que nada muda de comportamento para as conexoes que ja existem.
  const STORAGE_TYPES = {
    drive: {
      label: 'Google Drive (Apps Script)',
      rootLabel: 'Link da pasta raiz',
      rootPlaceholder: 'https://drive.google.com/drive/folders/...',
      urlLabel: 'Web App do Apps Script',
      urlPlaceholder: 'https://script.google.com/macros/s/.../exec',
    },
    local: {
      label: 'Servidor local',
      rootLabel: 'Pasta raiz do setor no servidor',
      rootPlaceholder: 'documentacao/rede-geral',
      urlLabel: 'Endpoint do conector local',
      urlPlaceholder: 'https://atlas.suaempresa.com.br/conector',
    },
  };
  const DEFAULT_STORAGE_TYPE = 'drive';

  function storageType(connection) {
    const tipo = String(connection?.type || '').trim().toLowerCase();
    return STORAGE_TYPES[tipo] ? tipo : DEFAULT_STORAGE_TYPE;
  }

  function storageIsDrive(connection) {
    return storageType(connection) === 'drive';
  }

  const COLUMN_TYPES = {
    text: { label: 'Texto', icon: 'type', width: 190 },
    number: { label: 'Número', icon: 'hash', width: 130 },
    status: { label: 'Status', icon: 'circle-dot', width: 160 },
    select: { label: 'Lista', icon: 'list', width: 160 },
    person: { label: 'Responsável', icon: 'user-round', width: 170 },
    date: { label: 'Data', icon: 'calendar-days', width: 145 },
    period: { label: 'Período', icon: 'calendar-range', width: 170 },
    checkbox: { label: 'Checkbox', icon: 'square-check-big', width: 110 },
    link: { label: 'Link', icon: 'link-2', width: 200 },
    location: { label: 'Localização', icon: 'map-pin', width: 190 },
    file: { label: 'Arquivo', icon: 'paperclip', width: 170 },
    image: { label: 'Imagem', icon: 'image', width: 210 },
    percentage: { label: 'Porcentagem', icon: 'percent', width: 135 },
    currency: { label: 'Moeda', icon: 'badge-dollar-sign', width: 140 },
    formula: { label: 'Fórmula', icon: 'calculator', width: 160 },
  };

  const STATUS_OPTIONS = [
    { label: 'Não iniciado', color: '#657084', background: '#edf0f4' },
    { label: 'Em análise', color: '#9a5b00', background: '#fff0d7' },
    { label: 'Em andamento', color: '#0f6cbd', background: '#e3f1fc' },
    { label: 'Concluído', color: '#08784f', background: '#ddf4e9' },
    { label: 'Bloqueado', color: '#b42335', background: '#fbe4e7' },
  ];


  const STATUS_FALLBACK_BACKGROUNDS = [
    '#e3f1fc', '#fff0d7', '#ddf4e9', '#fbe4e7', '#eee8f4', '#e2f5f6', '#f3e8ff', '#fff1e6',
  ];

  const PRIORITY_OPTIONS = [
    { label: 'Baixa', color: '#356e54', background: '#e7f4ed' },
    { label: 'Média', color: '#875914', background: '#fff0d8' },
    { label: 'Alta', color: '#a23a45', background: '#fae4e7' },
    { label: 'Crítica', color: '#ffffff', background: '#b42335' },
  ];

  const runtime = {
    data: null,
    appInitialized: false,
    remoteMode: false,
    remoteRows: null,
    remoteSyncTimer: null,
    remoteSyncing: false,
    remoteSyncQueued: false,
    remoteReady: false,
    remoteRefreshQueued: false,
    authClient: null,
    authSession: null,
    authProfile: null,
    authListenerRegistered: false,
    authUsersLoading: false,
    bootstrapRefreshing: false,
    deferredHydration: false,
    deferredHydrated: false,
    bootstrapCacheTimer: null,
    localBackupTimer: null,
    automationMonitorTimer: null,
    automationMonitorStartedAt: '',
    lastAutomationRunAt: '',
    realtimeChannel: null,
    realtimePollingActive: false,
    realtimeStatus: 'waiting',
    realtimeRefreshTimer: null,
    realtimeRefreshFull: false,
    realtimePendingTables: new Set(),
    realtimePayloads: new Map(),
    realtimePayloadTimer: null,
    realtimeRenderTimer: null,
    realtimeDirtyBoards: new Set(),
    realtimeLocalIds: new Set(),
    realtimeAttachmentPollTimer: null,
    realtimeAttachmentCursor: '',
    realtimeChangePollTimer: null,
    realtimeChangePollBusy: false,
    realtimeChangeCursor: null,
    realtimeLastAppliedChange: 0,
    realtimeReconnectTimer: null,
    realtimeReconnectAttempts: 0,
    realtimeLastEventAt: 0,
    realtimeBroadcastBusy: false,
    realtimeBroadcastQueue: [],
    itemPersistQueues: new Map(),
    loadedBoardData: new Set(),
    loadedItemValues: new Set(),
    // Quadros cujos subitens ja foram buscados para alimentar formulas de
    // agregacao - ver ensureBoardViewData. Trava de uma-vez-por-sessao para
    // essa busca forcada nao repetir a cada render.
    aggregationHydratedBoards: new Set(),
    // V2.4 - conversa do elemento. chatMessages guarda as conversas ja abertas
    // (texto completo); chatCounts guarda so o numero de mensagens por item do
    // quadro aberto, para o contador do icone aparecer sem abrir nada.
    chatMessages: new Map(),
    chatCounts: new Map(),
    chatCountsBoard: null,
    chatItemId: null,
    chatUsersByItem: new Map(),
    chatMentionIds: new Set(),
    // V2.4 - sondagem do Drive atras de edicao feita fora do Atlas.
    driveProbe: null,
    driveProbeTimer: null,
    boardDataLoading: new Map(),
    boardSearchTimer: null,
    navSearchTimer: null,
    auditQueue: Promise.resolve(),
    trashQueue: Promise.resolve(),
    boardUiStates: new Map(),
    pendingBoardUiState: null,
    boardUiRestoreToken: 0,
    notificationsLoading: false,
    notificationFilter: 'all',
    dataRevision: 0,
    page: 'home',
    adminTab: 'overview',
    selectedItems: new Set(),
    boardSearch: '',
    navSearch: '',
    searchFilters: {},
    savedSearches: [],
    workFilter: '',
    expandedWorkSectors: new Set(),
    ganttZoom: Math.min(5, Math.max(1, Number(localStorage.getItem(GANTT_ZOOM_KEY)) || 1)),
    ganttScale: ['days', 'weeks', 'months'].includes(localStorage.getItem(GANTT_SCALE_KEY)) ? localStorage.getItem(GANTT_SCALE_KEY) : 'weeks',
    drag: null,
    horizontalDrag: null,
    suppressContextMenuUntil: 0,
    resizeTimer: null,
    imageViewer: null,
    imageViewerGesture: null,
    secureImagePreviews: new Map(),
    // Fila da previa segura de imagem (ver enqueueSecureImagePreview).
    imagePreviewQueue: [],
    imagePreviewActive: 0,
    imagePreviewBlockedUntil: 0,
    fieldMode: localStorage.getItem(FIELD_MODE_KEY) === null
      ? window.innerWidth <= 820
      : localStorage.getItem(FIELD_MODE_KEY) === '1',
    calendarCursor: new Map(),
    importPreview: null,
    operationProgress: null,
    operationProgressTimer: null,
    assetLoads: new Map(),
    offlineQueue: [],
    healthChecks: [],
  };

  function id(prefix) {
    if (runtime.remoteMode) {
      if (window.crypto?.randomUUID) return window.crypto.randomUUID();
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadAssetScript(source, ready) {
    if (typeof ready === 'function' && ready()) return Promise.resolve();
    if (runtime.assetLoads.has(source)) return runtime.assetLoads.get(source);
    const operation = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Não foi possível carregar ${source}.`));
      document.head.appendChild(script);
    });
    runtime.assetLoads.set(source, operation);
    operation.catch(() => runtime.assetLoads.delete(source));
    return operation;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function setOperationProgress(label, percent = 0, detail = '') {
    clearTimeout(runtime.operationProgressTimer);
    const normalizedPercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    runtime.operationProgress = { label: String(label || 'Processando'), percent: normalizedPercent, detail: String(detail || '') };
    const root = document.getElementById('atlas-v2-operation-progress');
    if (!root) return;
    root.hidden = false;
    const labelNode = document.getElementById('atlas-v2-operation-label');
    const percentNode = document.getElementById('atlas-v2-operation-percent');
    const meter = document.getElementById('atlas-v2-operation-meter');
    const detailNode = document.getElementById('atlas-v2-operation-detail');
    if (labelNode) labelNode.textContent = runtime.operationProgress.label;
    if (percentNode) percentNode.textContent = `${normalizedPercent}%`;
    if (meter) meter.value = normalizedPercent;
    if (detailNode) {
      detailNode.textContent = runtime.operationProgress.detail;
      detailNode.hidden = !runtime.operationProgress.detail;
    }
    root.classList.toggle('is-complete', normalizedPercent >= 100);
  }

  function clearOperationProgress(delay = 700) {
    clearTimeout(runtime.operationProgressTimer);
    runtime.operationProgressTimer = setTimeout(() => {
      runtime.operationProgress = null;
      const root = document.getElementById('atlas-v2-operation-progress');
      if (root) {
        root.hidden = true;
        root.classList.remove('is-complete');
      }
    }, Math.max(0, Number(delay) || 0));
  }

  function compactImageReference(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const reference = {
      id: entry.id || '',
      name: entry.name || entry.nome || '',
      mimeType: entry.mimeType || entry.mime_type || '',
      size: Number(entry.size || entry.tamanho || 0),
      fileId: entry.fileId || entry.file_id || '',
      folderId: entry.folderId || entry.folder_id || '',
      url: entry.url || '',
      viewUrl: entry.viewUrl || entry.view_url || entry.webViewLink || '',
      thumbnailUrl: entry.thumbnailUrl || entry.thumbnail_url || '',
      storageConnectionId: entry.storageConnectionId || '',
      uploadedAt: entry.uploadedAt || '',
      localOnly: Boolean(entry.localOnly),
      migrated: Boolean(entry.migrated),
      attachmentBacked: Boolean(entry.attachmentBacked || entry._attachmentSource),
    };
    if (!reference.fileId && !reference.url && !reference.viewUrl && !reference.thumbnailUrl) return null;
    return reference;
  }

  function sanitizeItemForLocalBackup(itemEntry, attachmentColumnIds, structureOnly = false) {
    const copy = {
      ...itemEntry,
      values: {},
      subitemsExpanded: itemEntry.subitemsExpanded !== false,
      subitems: [],
    };
    if (!structureOnly) {
      Object.entries(itemEntry.values || {}).forEach(([columnId, value]) => {
        if (!attachmentColumnIds.has(columnId)) {
          copy.values[columnId] = value;
          return;
        }
        if (runtime.remoteMode) return;
        const references = normalizeImageEntries(value).map(compactImageReference).filter(Boolean);
        if (references.length) copy.values[columnId] = references;
      });
    }
    copy.subitems = (itemEntry.subitems || []).map((child) => sanitizeItemForLocalBackup(child, attachmentColumnIds, structureOnly));
    return copy;
  }

  function localBackupSnapshot(data, structureOnly = false) {
    const snapshot = {
      ...data,
      localBackupVersion: LOCAL_BACKUP_VERSION,
      auditLog: (data.auditLog || []).slice(0, structureOnly ? 10 : 80),
      errors: (data.errors || []).slice(0, 20),
      trash: structureOnly ? [] : (data.trash || []).slice(0, 20),
      templates: structureOnly ? [] : (data.templates || []),
      fieldTemplates: structureOnly ? [] : (data.fieldTemplates || []),
      workspaces: [],
    };
    snapshot.workspaces = (data.workspaces || []).map((workspace) => ({
      ...workspace,
      modules: (workspace.modules || []).map((moduleEntry) => ({
        ...moduleEntry,
        open: Boolean(moduleEntry.open),
        boards: (moduleEntry.boards || []).map((boardEntry) => {
          const attachmentColumnIds = new Set((boardEntry.columns || []).filter((columnEntry) => ['image', 'file'].includes(columnEntry.type)).map((columnEntry) => columnEntry.id));
          return {
            ...boardEntry,
            groups: (boardEntry.groups || []).map((groupEntry) => ({
              ...groupEntry,
              collapsed: Boolean(groupEntry.collapsed),
              items: structureOnly ? [] : (groupEntry.items || []).map((itemEntry) => sanitizeItemForLocalBackup(itemEntry, attachmentColumnIds, false)),
            })),
          };
        }),
      })),
    }));
    return snapshot;
  }

  function serializeLocalBackup(data) {
    let snapshot = localBackupSnapshot(data, runtime.remoteMode);
    let serialized = JSON.stringify(snapshot);
    if (serialized.length > LOCAL_BACKUP_MAX_CHARS) {
      snapshot = localBackupSnapshot(data, true);
      serialized = JSON.stringify(snapshot);
    }
    return serialized;
  }

  function persistLocalBackup(data) {
    try {
      const serialized = serializeLocalBackup(data);
      localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    } catch (error) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localBackupSnapshot(data, true)));
        return true;
      } catch (_) {
        console.warn('Atlas V2: backup local indisponível; o Supabase e o IndexedDB permanecem como fontes de recuperação.', error);
        return false;
      }
    }
  }

  // Logout nunca limpava isto: o backup local (dados completos dos quadros)
  // e o cache de previa de imagem no IndexedDB continuavam no dispositivo
  // mesmo depois de sair explicitamente - problema real em computador
  // compartilhado, onde o proximo usuario a fazer login veria por um
  // instante (ou em modo offline) os dados do usuario anterior. Preferencias
  // de interface (tema, sidebar, zoom do Gantt) NAO sao limpas aqui de
  // proposito: nao sao dado de negocio e resetar isso a cada logout seria
  // uma regressao de UX sem ganho de privacidade real.
  async function clearLocalUserData() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    try { localStorage.removeItem(`${STORAGE_KEY}-recuperacao`); } catch (_) {}
    try {
      if (window.indexedDB?.deleteDatabase) {
        await new Promise((resolve) => {
          const request = window.indexedDB.deleteDatabase(BOOTSTRAP_CACHE_DB);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        });
      }
    } catch (_) {}
  }

  function scheduleLocalBackupCompaction(delay = 220) {
    clearTimeout(runtime.localBackupTimer);
    runtime.localBackupTimer = setTimeout(() => {
      runtime.localBackupTimer = null;
      const run = () => {
        if (runtime.data) persistLocalBackup(runtime.data);
      };
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1200 });
      else setTimeout(run, 0);
    }, delay);
  }

  function openBootstrapCache() {
    if (!window.indexedDB) return Promise.resolve(null);
    return new Promise((resolve) => {
      const request = window.indexedDB.open(BOOTSTRAP_CACHE_DB, BOOTSTRAP_CACHE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(BOOTSTRAP_CACHE_STORE)) {
          database.createObjectStore(BOOTSTRAP_CACHE_STORE, { keyPath: 'userId' });
        }
        if (!database.objectStoreNames.contains(IMAGE_PREVIEW_STORE)) {
          const store = database.createObjectStore(IMAGE_PREVIEW_STORE, { keyPath: 'key' });
          store.createIndex('savedAt', 'savedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  function isRemoteBootstrapSnapshot(data) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const workspaces = Array.isArray(data?.workspaces) ? data.workspaces : [];
    if (data?.schemaVersion !== 2 || !workspaces.length) return false;
    const identifiers = [];
    workspaces.forEach((workspace) => {
      identifiers.push(workspace?.id);
      (workspace?.modules || []).forEach((moduleEntry) => {
        identifiers.push(moduleEntry?.id);
        (moduleEntry?.boards || []).forEach((boardEntry) => {
          identifiers.push(boardEntry?.id);
          (boardEntry?.groups || []).forEach((groupEntry) => {
            identifiers.push(groupEntry?.id);
            const visit = (items = []) => items.forEach((itemEntry) => {
              identifiers.push(itemEntry?.id);
              visit(itemEntry?.subitems || []);
            });
            visit(groupEntry?.items || []);
          });
        });
      });
    });
    return identifiers.length > 0
      && identifiers.every((value) => uuidPattern.test(String(value || '')))
      && !identifiers.some((value) => /(?:^|-)demo(?:-|$)/i.test(String(value || '')));
  }

  async function deleteBootstrapCache(userId) {
    if (!userId) return;
    const database = await openBootstrapCache();
    if (!database) return;
    await new Promise((resolve) => {
      const transaction = database.transaction(BOOTSTRAP_CACHE_STORE, 'readwrite');
      transaction.objectStore(BOOTSTRAP_CACHE_STORE).delete(userId);
      transaction.oncomplete = resolve;
      transaction.onerror = resolve;
      transaction.onabort = resolve;
    });
    database.close();
  }

  async function readBootstrapCache(userId) {
    if (!userId) return null;
    const database = await openBootstrapCache();
    if (!database) return null;
    return new Promise((resolve) => {
      const transaction = database.transaction(BOOTSTRAP_CACHE_STORE, 'readonly');
      const request = transaction.objectStore(BOOTSTRAP_CACHE_STORE).get(userId);
      request.onsuccess = () => {
        const cached = request.result?.data;
        if (isRemoteBootstrapSnapshot(cached)) {
          resolve(cached);
          return;
        }
        if (cached) void deleteBootstrapCache(userId);
        resolve(null);
      };
      request.onerror = () => resolve(null);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => database.close();
    });
  }

  async function writeBootstrapCache(userId, data) {
    if (!userId || !isRemoteBootstrapSnapshot(data)) return;
    const database = await openBootstrapCache();
    if (!database) return;
    await new Promise((resolve) => {
      const transaction = database.transaction(BOOTSTRAP_CACHE_STORE, 'readwrite');
      transaction.objectStore(BOOTSTRAP_CACHE_STORE).put({ userId, savedAt: new Date().toISOString(), data });
      transaction.oncomplete = resolve;
      transaction.onerror = resolve;
      transaction.onabort = resolve;
    });
    database.close();
  }

  function scheduleBootstrapCacheWrite(data = runtime.data, delay = 700) {
    const userId = runtime.authSession?.user?.id;
    if (!userId || !isRemoteBootstrapSnapshot(data)) return;
    clearTimeout(runtime.bootstrapCacheTimer);
    runtime.bootstrapCacheTimer = setTimeout(() => {
      writeBootstrapCache(userId, data).catch((error) => console.warn('Atlas V2: cache local indisponível.', error));
    }, Math.max(300, Number(delay) || 700));
  }

  function option(label, color, background) {
    return { label, color, background };
  }

  function column(key, name, type, extra = {}) {
    const rawOptions = extra.options || [];
    return {
      id: key,
      name,
      type,
      width: extra.width || COLUMN_TYPES[type]?.width || 160,
      required: Boolean(extra.required),
      options: type === 'status' ? normalizeStatusOptions(rawOptions) : rawOptions,
      formula: type === 'formula' ? String(extra.formula || '') : '',
      format: type === 'formula' ? String(extra.format || 'number') : '',
      decimals: type === 'formula' ? Number(extra.decimals ?? 2) : 0,
      versioned: type === 'file' && extra.versioned === true,
    };
  }

  function item(key, groupId, name, values = {}) {
    return { id: key, groupId, name, values, order: 0, subitems: [], subitemsExpanded: false };
  }

  function nextItemOrder(collection = []) {
    return (collection || []).reduce((highest, entry, index) => {
      const current = Number(entry?.order);
      return Math.max(highest, Number.isFinite(current) ? current : index);
    }, -1) + 1;
  }

  function group(key, name, color, items = []) {
    return { id: key, name, color, collapsed: false, items };
  }

  function cityWorksColumns() {
    return [
      column('obra-tipo', 'Tipo', 'select', {
        width: 125,
        options: [
          option('CTO', '#176ead', '#e4f0f7'),
          option('CEO', '#73568f', '#eee8f4'),
          option('POP', '#a96510', '#fff0d9'),
        ],
      }),
      column('obra-status', 'Status', 'status', { options: STATUS_OPTIONS }),
      column('obra-responsavel', 'Responsável', 'person', { width: 175 }),
      column('obra-inicio', 'Início', 'date'),
      column('obra-final', 'Final', 'date'),
      column('obra-progresso', 'Progresso', 'percentage'),
      column('obra-evidencias', 'Evidências', 'file', { width: 175 }),
      column('obra-diagrama', 'Diagrama de fusão', 'file', { width: 185 }),
    ];
  }

  function cityWorksGroups() {
    const campinaGrande = item('obra-demo-campina', 'doc-execucao', 'Campina Grande - PB', {
      'obra-tipo': '',
      'obra-status': 'Em andamento',
      'obra-responsavel': 'Equipe de documentação',
      'obra-inicio': '2026-07-01',
      'obra-final': '2026-07-31',
      'obra-progresso': 55,
      'obra-evidencias': '',
      'obra-diagrama': '',
    });
    campinaGrande.subitems = [
      item('obra-demo-cto-01', 'doc-execucao', 'CTO-CG-001 · Centro', {
        'obra-tipo': 'CTO', 'obra-status': 'Concluído', 'obra-responsavel': 'Equipe A',
        'obra-inicio': '2026-07-01', 'obra-final': '2026-07-10', 'obra-progresso': 100,
        'obra-evidencias': 'Fotos_CTO_001.zip', 'obra-diagrama': 'Diagrama_CTO_001.pdf',
      }),
      item('obra-demo-cto-02', 'doc-execucao', 'CTO-CG-002 · Malvinas', {
        'obra-tipo': 'CTO', 'obra-status': 'Em andamento', 'obra-responsavel': 'Equipe B',
        'obra-inicio': '2026-07-08', 'obra-final': '2026-07-20', 'obra-progresso': 60,
        'obra-evidencias': 'Fotos_CTO_002.zip', 'obra-diagrama': '',
      }),
      item('obra-demo-ceo-01', 'doc-execucao', 'CEO-CG-001 · Centro', {
        'obra-tipo': 'CEO', 'obra-status': 'Em análise', 'obra-responsavel': 'Equipe de fusão',
        'obra-inicio': '2026-07-10', 'obra-final': '2026-07-25', 'obra-progresso': 30,
        'obra-evidencias': 'Fotos_CEO_001.zip', 'obra-diagrama': 'Diagrama_CEO_001.pdf',
      }),
      item('obra-demo-pop-01', 'doc-execucao', 'POP-CG-Principal', {
        'obra-tipo': 'POP', 'obra-status': 'Não iniciado', 'obra-responsavel': 'Equipe POP',
        'obra-inicio': '2026-07-22', 'obra-final': '2026-07-31', 'obra-progresso': 0,
        'obra-evidencias': '', 'obra-diagrama': '',
      }),
    ];
    const joaoPessoa = item('obra-demo-joao-pessoa', 'doc-planejamento', 'João Pessoa - PB', {
      'obra-tipo': '',
      'obra-status': 'Em análise',
      'obra-responsavel': 'Equipe de planejamento',
      'obra-inicio': '2026-08-01',
      'obra-final': '2026-08-31',
      'obra-progresso': 20,
      'obra-evidencias': '',
      'obra-diagrama': '',
    });
    joaoPessoa.subitems = [
      item('obra-demo-jp-cto-01', 'doc-planejamento', 'CTO-JP-001 · Bancários', {
        'obra-tipo': 'CTO', 'obra-status': 'Em análise', 'obra-responsavel': 'Equipe A',
        'obra-inicio': '2026-08-01', 'obra-final': '2026-08-12', 'obra-progresso': 25,
        'obra-evidencias': '', 'obra-diagrama': '',
      }),
      item('obra-demo-jp-ceo-01', 'doc-planejamento', 'CEO-JP-001 · Centro', {
        'obra-tipo': 'CEO', 'obra-status': 'Não iniciado', 'obra-responsavel': 'Equipe de fusão',
        'obra-inicio': '2026-08-10', 'obra-final': '2026-08-22', 'obra-progresso': 0,
        'obra-evidencias': '', 'obra-diagrama': '',
      }),
      item('obra-demo-jp-pop-01', 'doc-planejamento', 'POP-JP-Sul', {
        'obra-tipo': 'POP', 'obra-status': 'Não iniciado', 'obra-responsavel': 'Equipe POP',
        'obra-inicio': '2026-08-20', 'obra-final': '2026-08-31', 'obra-progresso': 0,
        'obra-evidencias': '', 'obra-diagrama': '',
      }),
    ];
    return [
      group('doc-planejamento', 'A realizar', '#7554a3', [joaoPessoa]),
      group('doc-execucao', 'Em andamento', '#0f6cbd', [campinaGrande]),
      group('doc-parada', 'Parada', '#bf4652', []),
      group('doc-finalizado', 'Concluídas', '#168a5b', []),
    ];
  }

  function board(config) {
    return {
      id: config.id,
      name: config.name,
      description: config.description || '',
      icon: config.icon || 'table-2',
      access: config.access || 'main',
      official: Boolean(config.official),
      views: config.views || [...DEFAULT_BOARD_VIEWS],
      activeView: config.activeView || 'table',
      exampleVersion: Number(config.exampleVersion || 0),
      settings: config.settings || {},
      columns: config.columns || [],
      groups: config.groups || [],
      storageConnectionId: config.storageConnectionId || null,
    };
  }

  function seedData() {
    const redeColumns = [
      column('col-status', 'Status', 'status', { options: STATUS_OPTIONS }),
      column('col-regional', 'Regional', 'select', { options: ['PB', 'RN', 'PE', 'BA'].map((label) => option(label, '#4a5568', '#edf0f4')) }),
      column('col-responsavel', 'Responsável', 'person'),
      column('col-data', 'Previsão', 'date'),
      column('col-progresso', 'Progresso', 'percentage'),
    ];

    const manutencaoColumns = [
      column('mnt-status', 'Status', 'status', { options: STATUS_OPTIONS }),
      column('mnt-prioridade', 'Prioridade', 'select', { options: PRIORITY_OPTIONS }),
      column('mnt-regional', 'Regional', 'select', { options: ['PB', 'RN', 'PE', 'BA'].map((label) => option(label, '#4a5568', '#edf0f4')) }),
      column('mnt-responsavel', 'Responsável', 'person'),
      column('mnt-data', 'Abertura', 'date'),
      column('mnt-local', 'Local', 'location'),
    ];

    const projetoColumns = [
      column('prj-status', 'Status', 'status', { options: STATUS_OPTIONS }),
      column('prj-responsavel', 'Responsável', 'person'),
      column('prj-periodo', 'Período', 'period'),
      column('prj-progresso', 'Progresso', 'percentage'),
      column('prj-kmz', 'KMZ', 'file'),
    ];

    return {
      schemaVersion: 2,
      activeWorkspaceId: 'ws-operacoes',
      activeBoardId: 'board-rede-status',
      currentUserId: 'user-admin',
      users: [
        { id: 'user-admin', name: 'Túlio Radamés', email: 'admin@atlas.local', role: 'admin', status: 'active', title: 'Administrador do sistema', lastActivity: new Date().toISOString() },
        { id: 'user-supervisor', name: 'Equipe Supervisora', email: 'supervisor@atlas.local', role: 'supervisor', status: 'active', title: 'Supervisão operacional', lastActivity: '2026-07-19T16:30:00.000Z' },
        { id: 'user-pending', name: 'Novo acesso', email: 'novo.usuario@atlas.local', role: 'visualizador', status: 'pending', title: '', lastActivity: null },
      ],
      accessRules: [],
      boardMembers: [],
      storageConnections: [
        { id: 'storage-documentacao', name: 'Drive de Documentação', sector: 'Documentação Rede Geral', accountEmail: '', folderUrl: '', folderId: '', appScriptUrl: '', status: 'inherited', module: 'documentacao', verifiedAt: null, createdAt: '2026-07-20T09:00:00.000Z' },
        { id: 'storage-expansoes', name: 'Drive de Expansões', sector: 'Expansões', accountEmail: '', folderUrl: '', folderId: '', appScriptUrl: '', status: 'inherited', module: 'expansoes', verifiedAt: null, createdAt: '2026-07-20T09:00:00.000Z' },
      ],
      templates: [],
      automations: [],
      notifications: [],
      automationRuns: [],
      fieldTemplates: [
        { ...deepClone(redeColumns[0]), id: 'field-template-status', source: 'Atlas 2.0' },
        { ...deepClone(redeColumns[2]), id: 'field-template-responsavel', source: 'Atlas 2.0' },
        { ...deepClone(redeColumns[3]), id: 'field-template-data', source: 'Atlas 2.0' },
        { ...deepClone(projetoColumns[4]), id: 'field-template-arquivo', source: 'Atlas 2.0' },
        { ...column('field-template-imagem', 'Imagens', 'image'), source: 'Atlas 2.0' },
      ],
      auditLog: [
        { id: 'audit-initial', userId: 'user-admin', action: 'Estrutura inicial do Atlas criada', scope: 'system', createdAt: '2026-07-20T09:00:00.000Z' },
      ],
      itemHistory: [],
      trash: [],
      errors: [],
      system: {
        storageHistory: [],
        integrations: [
          { id: 'supabase', name: 'Supabase', status: 'connected', detail: 'Persistência, autenticação e políticas conectadas.' },
          { id: 'drive', name: 'Google Drive', status: 'connected', detail: 'Arquivos e imagens ligados às conexões dos setores.' },
          { id: 'realtime', name: 'Tempo real', status: 'connected', detail: 'Atualizações operacionais e automações acompanhadas em segundo plano.' },
          { id: 'automations', name: 'Automações', status: 'connected', detail: 'Gatilhos, ações, notificações e histórico ativos.' },
        ],
      },
      workspaces: [
        {
          id: 'ws-operacoes',
          name: 'Operações',
          color: '#0f6cbd',
          access: 'main',
          storageConnectionId: null,
          modules: [
            {
              id: 'mod-rede',
              name: 'Documentação Rede Geral',
              icon: 'network',
              open: false,
              storageConnectionId: 'storage-documentacao',
              boards: [
                board({
                  id: 'board-rede-status',
                  name: 'Status da Rede',
                  description: 'Cidades, etapas de documentação e progresso operacional.',
                  icon: 'activity',
                  official: true,
                  columns: deepClone(redeColumns),
                  groups: [
                    group('rede-a-realizar', 'Documentações para realizar', '#4d89d8', [
                      item('rede-demo-1', 'rede-a-realizar', 'Cidade piloto A', {
                        'col-status': 'Não iniciado', 'col-regional': 'PB', 'col-responsavel': 'Equipe de documentação', 'col-data': '', 'col-progresso': 0,
                      }),
                    ]),
                    group('rede-andamento', 'Documentações em andamento', '#d68a1f', [
                      item('rede-demo-2', 'rede-andamento', 'Cidade piloto B', {
                        'col-status': 'Em andamento', 'col-regional': 'RN', 'col-responsavel': 'Analista responsável', 'col-data': '2026-08-15', 'col-progresso': 64,
                      }),
                    ]),
                    group('rede-concluido', 'Documentação concluída', '#168a5b', []),
                  ],
                }),
                board({
                  id: 'board-rede-obras',
                  name: 'Obras de Documentação',
                  description: 'Cidades como elementos e estruturas de rede como subelementos.',
                  icon: 'hard-hat',
                  official: true,
                  exampleVersion: 3,
                  views: ['table', 'works', 'kanban', 'gantt'],
                  settings: {
                    works_mode: 'sectorized',
                    works_sector_column_id: 'obra-tipo',
                    works_sector_order: ['POP', 'CEO', 'CTO'],
                    works_sector_colors: {
                      POP: '#a96510',
                      CEO: '#73568f',
                      CTO: '#176ead',
                    },
                  },
                  columns: cityWorksColumns(),
                  groups: cityWorksGroups(),
                }),
                board({
                  id: 'board-manutencao',
                  name: 'Manutenção de Redes',
                  description: 'Ocorrências, documentação, responsáveis e evidências.',
                  icon: 'wrench',
                  official: true,
                  columns: manutencaoColumns,
                  groups: [
                    group('mnt-abertas', 'Chamados abertos', '#c33d4b', [
                      item('mnt-demo-1', 'mnt-abertas', 'Ocorrência inicial', {
                        'mnt-status': 'Em análise', 'mnt-prioridade': 'Alta', 'mnt-regional': 'PE', 'mnt-responsavel': 'Equipe de rede', 'mnt-data': '2026-07-17', 'mnt-local': 'Ponto de rede',
                      }),
                    ]),
                    group('mnt-execucao', 'Em execução', '#d68a1f', []),
                    group('mnt-concluidas', 'Concluídas', '#168a5b', []),
                  ],
                }),
              ],
            },
            {
              id: 'mod-expansoes',
              name: 'Expansões',
              icon: 'route',
              open: false,
              storageConnectionId: 'storage-expansoes',
              boards: [
                board({
                  id: 'board-exp-projetos',
                  name: 'Projetos',
                  description: 'Projetos, subelementos, períodos e acompanhamento.',
                  icon: 'folder-kanban',
                  official: true,
                  columns: deepClone(projetoColumns),
                  groups: [
                    group('exp-analise', 'Projetos em análise', '#7554a3', []),
                    group('exp-progresso', 'Projetos em progresso', '#0f6cbd', [
                      item('exp-demo-1', 'exp-progresso', 'Projeto inicial', {
                        'prj-status': 'Em andamento', 'prj-responsavel': 'Equipe de expansão', 'prj-periodo': 'Jul - Ago/2026', 'prj-progresso': 35, 'prj-kmz': '',
                      }),
                    ]),
                    group('exp-concluidos', 'Concluídos', '#168a5b', []),
                  ],
                }),
                board({
                  id: 'board-exp-obras',
                  name: 'Obras',
                  description: 'Obras de expansão organizadas por fase.',
                  icon: 'construction',
                  official: true,
                  columns: deepClone(projetoColumns),
                  groups: [
                    group('obra-kmz', 'KMZ', '#0f9dbd', []),
                    group('obra-lancamento', 'Lançamento', '#d14b78', []),
                    group('obra-fusoes', 'Fusões', '#d8782f', []),
                    group('obra-homologacao', 'Homologação final', '#168a5b', []),
                  ],
                }),
              ],
            },
            {
              id: 'mod-pmo',
              name: 'PMO',
              icon: 'briefcase-business',
              open: false,
              storageConnectionId: null,
              boards: [
                board({
                  id: 'board-pmo',
                  name: 'Análise de Novos Projetos',
                  description: 'Avaliação, priorização e acompanhamento de novos projetos.',
                  icon: 'chart-no-axes-combined',
                  official: true,
                  columns: [
                    column('pmo-status', 'Status', 'status', { options: STATUS_OPTIONS }),
                    column('pmo-responsavel', 'Responsável', 'person'),
                    column('pmo-valor', 'Valor estimado', 'currency'),
                    column('pmo-data', 'Previsão', 'date'),
                    column('pmo-aprovado', 'Aprovado', 'checkbox'),
                  ],
                  groups: [
                    group('pmo-entrada', 'Novas solicitações', '#7554a3', []),
                    group('pmo-avaliacao', 'Em avaliação', '#d68a1f', []),
                    group('pmo-aprovados', 'Aprovados', '#168a5b', []),
                  ],
                }),
              ],
            },
          ],
        },
      ],
    };
  }

  function authenticatedShellData() {
    const data = seedData();
    (data.workspaces || []).forEach((workspace) => (workspace.modules || []).forEach((moduleEntry) => {
      (moduleEntry.boards || []).forEach((boardEntry) => {
        (boardEntry.groups || []).forEach((groupEntry) => { groupEntry.items = []; });
      });
    }));
    return data;
  }

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return seedData();
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed?.workspaces)) return seedData();
      const defaults = seedData();
      parsed.schemaVersion = 2;
      parsed.currentUserId = parsed.currentUserId || defaults.currentUserId;
      parsed.users = Array.isArray(parsed.users) && parsed.users.length ? parsed.users : defaults.users;
      parsed.accessRules = Array.isArray(parsed.accessRules) ? parsed.accessRules : [];
      parsed.boardMembers = Array.isArray(parsed.boardMembers) ? parsed.boardMembers : [];
      parsed.storageConnections = Array.isArray(parsed.storageConnections) && parsed.storageConnections.length
        ? parsed.storageConnections
        : defaults.storageConnections;
      parsed.templates = Array.isArray(parsed.templates) ? parsed.templates : [];
      parsed.automations = Array.isArray(parsed.automations) ? parsed.automations : [];
      parsed.notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
      parsed.automationRuns = Array.isArray(parsed.automationRuns) ? parsed.automationRuns : [];
      parsed.fieldTemplates = Array.isArray(parsed.fieldTemplates) ? parsed.fieldTemplates : [];
      parsed.auditLog = Array.isArray(parsed.auditLog) ? parsed.auditLog : defaults.auditLog;
      parsed.trash = Array.isArray(parsed.trash) ? parsed.trash : [];
      parsed.errors = Array.isArray(parsed.errors) ? parsed.errors : [];
      parsed.system = parsed.system && typeof parsed.system === 'object' ? parsed.system : defaults.system;
      parsed.workspaces.forEach((workspace) => {
        if (workspace.storageConnectionId === undefined) workspace.storageConnectionId = null;
        if (!Array.isArray(workspace.modules)) workspace.modules = [];
        workspace.modules.forEach((module) => {
          if (module.open === undefined) module.open = false;
          if (module.storageConnectionId === undefined) {
            module.storageConnectionId = module.id === 'mod-rede'
              ? 'storage-documentacao'
              : module.id === 'mod-expansoes' ? 'storage-expansoes' : null;
          }
          if (!Array.isArray(module.boards)) module.boards = [];
          module.boards.forEach((boardEntry) => {
        boardEntry.columns = Array.isArray(boardEntry.columns) ? boardEntry.columns.map((entry) => ({
          ...entry,
          options: entry.type === 'status' ? normalizeStatusOptions(entry.options || []) : (entry.options || []),
        })) : [];
        boardEntry.views = Array.isArray(boardEntry.views) ? boardEntry.views : ['table', 'kanban'];
        if (!boardEntry.views.includes('gantt')) boardEntry.views.push('gantt');
        if (!Array.isArray(boardEntry.groups)) boardEntry.groups = [];
        if (boardEntry.id === 'board-rede-obras' && Number(boardEntry.exampleVersion || 0) < 3) {
          const currentItems = boardEntry.groups.flatMap((groupEntry) => groupEntry.items || []);
          if (currentItems.some((entry) => entry.id === 'obra-demo-campina') && !currentItems.some((entry) => entry.id === 'obra-demo-joao-pessoa')) {
            const demoGroups = cityWorksGroups();
            const joaoPessoa = demoGroups.flatMap((groupEntry) => groupEntry.items).find((entry) => entry.id === 'obra-demo-joao-pessoa');
            const targetGroup = boardEntry.groups.find((groupEntry) => groupEntry.id === 'doc-planejamento') || boardEntry.groups[0];
            if (joaoPessoa && targetGroup) targetGroup.items.push(joaoPessoa);
          }
          const groupNames = {
            'doc-planejamento': 'A realizar',
            'doc-execucao': 'Em andamento',
            'doc-finalizado': 'Concluídas',
          };
          boardEntry.groups.forEach((groupEntry) => {
            if (groupNames[groupEntry.id]) groupEntry.name = groupNames[groupEntry.id];
          });
          if (!boardEntry.groups.some((groupEntry) => groupEntry.id === 'doc-parada')) {
            const stoppedGroup = group('doc-parada', 'Parada', '#bf4652', []);
            const completedIndex = boardEntry.groups.findIndex((groupEntry) => groupEntry.id === 'doc-finalizado');
            if (completedIndex >= 0) boardEntry.groups.splice(completedIndex, 0, stoppedGroup);
            else boardEntry.groups.push(stoppedGroup);
          }
          boardEntry.views = ['table', 'works', 'kanban', 'gantt'];
          boardEntry.exampleVersion = 3;
        }
          });
        });
      });
      if (!parsed.fieldTemplates.length) {
        const knownFields = new Set();
        parsed.workspaces.forEach((workspace) => workspace.modules.forEach((module) => module.boards.forEach((boardEntry) => {
          boardEntry.columns.forEach((entry) => {
            const key = `${String(entry.name || '').toLowerCase()}::${entry.type}`;
            if (knownFields.has(key)) return;
            knownFields.add(key);
            parsed.fieldTemplates.push({ ...deepClone(entry), id: id('field-template'), source: boardEntry.name });
          });
        })));
      }
      if (!parsed.fieldTemplates.some((entry) => entry.type === 'image')) {
        parsed.fieldTemplates.push({ ...column(id('field-template'), 'Imagens', 'image'), source: 'Atlas 2.0' });
      }
      return parsed;
    } catch (error) {
      // Nunca descartar em silencio: o conteudo original e preservado em uma
      // chave de recuperacao antes de cair para a estrutura inicial, e a falha
      // fica visivel em Administracao > Sistema > Central de erros.
      console.error('Atlas V2: falha ao ler os dados locais. O conteudo anterior foi preservado para recuperacao.', error);
      let preservedAt = '';
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          preservedAt = `${STORAGE_KEY}-recuperacao`;
          localStorage.setItem(preservedAt, raw);
        }
      } catch (storageError) {
        console.error('Atlas V2: nao foi possivel preservar a copia de recuperacao.', storageError);
        preservedAt = '';
      }
      const fallback = seedData();
      fallback.errors = Array.isArray(fallback.errors) ? fallback.errors : [];
      fallback.errors.unshift({
        id: id('error'),
        title: 'Os dados locais não puderam ser lidos',
        detail: preservedAt
          ? `O Atlas iniciou com a estrutura inicial. O conteúdo anterior foi preservado em ${preservedAt} e pode ser recuperado. Detalhe técnico: ${error?.message || error}`
          : `O Atlas iniciou com a estrutura inicial e não foi possível preservar uma cópia do conteúdo anterior. Detalhe técnico: ${error?.message || error}`,
        createdAt: new Date().toISOString(),
      });
      runtime.localDataRecovery = { key: preservedAt, message: error?.message || String(error) };
      return fallback;
    }
  }

  function collapseItemTree(items) {
    (items || []).forEach((entry) => {
      entry.subitemsExpanded = false;
      collapseItemTree(entry.subitems);
    });
  }

  function collapseAllBoardItems(boardEntry) {
    (boardEntry?.groups || []).forEach((groupEntry) => collapseItemTree(groupEntry.items));
  }

  async function readRemoteTable(table, options = {}) {
    const pageSize = 1000;
    const rows = [];
    const orders = Array.isArray(options.order) ? options.order : (options.order ? [options.order] : []);
    const selectedColumns = options.select || '*';
    const maxRows = Math.max(0, Number(options.maxRows || 0));
    let offset = 0;
    while (true) {
      const currentPageSize = maxRows ? Math.min(pageSize, maxRows - rows.length) : pageSize;
      if (currentPageSize <= 0) break;
      let query = runtime.authClient.from(table).select(selectedColumns).range(offset, offset + currentPageSize - 1);
      Object.entries(options.eq || {}).forEach(([columnName, value]) => { query = query.eq(columnName, value); });
      if (options.in?.column && Array.isArray(options.in.values) && options.in.values.length) {
        query = query.in(options.in.column, options.in.values);
      }
      orders.forEach((columnName) => { query = query.order(columnName, { ascending: options.ascending !== false, nullsFirst: false }); });
      const { data, error } = await query;
      if (error) throw error;
      const page = data || [];
      rows.push(...page);
      if (page.length < currentPageSize || (maxRows && rows.length >= maxRows)) break;
      offset += currentPageSize;
    }
    return rows;
  }

  async function readRemoteAccessRulesLegacy(commonOptions) {
    try {
      const rows = await readRemoteTable('atlas_v2_access_rules', {
        ...commonOptions,
        select: 'id,user_id,workspace_id,module_id,board_id,group_id,column_id,nivel',
      });
      runtime.accessRuleScopeColumnsSupported = true;
      return rows;
    } catch (error) {
      const message = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`;
      if (!/42703|group_id|column_id/i.test(message)) throw error;
      runtime.accessRuleScopeColumnsSupported = false;
      console.warn('Atlas V2: permissões por grupo/coluna ainda não estão no banco; usando compatibilidade por área, módulo e quadro.');
      return readRemoteTable('atlas_v2_access_rules', {
        ...commonOptions,
        select: 'id,user_id,workspace_id,module_id,board_id,nivel',
      });
    }
  }

  async function readRemoteAccessRules() {
    const commonOptions = { order: ['user_id', 'id'] };
    try {
      const rows = await readRemoteTable('atlas_v2_access_rules', {
        ...commonOptions,
        select: 'id,user_id,workspace_id,module_id,board_id,group_id,column_id,item_id,nivel',
      });
      runtime.accessRuleScopeColumnsSupported = true;
      runtime.accessRuleItemColumnSupported = true;
      return rows;
    } catch (error) {
      const message = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`;
      if (!/42703/.test(message) || !/item_id/i.test(message)) {
        if (!/42703|group_id|column_id/i.test(message)) throw error;
        runtime.accessRuleScopeColumnsSupported = false;
        runtime.accessRuleItemColumnSupported = false;
        console.warn('Atlas V2: permissões por grupo/coluna ainda não estão no banco; usando compatibilidade por área, módulo e quadro.');
        return readRemoteTable('atlas_v2_access_rules', {
          ...commonOptions,
          select: 'id,user_id,workspace_id,module_id,board_id,nivel',
        });
      }
      runtime.accessRuleItemColumnSupported = false;
      console.warn('Atlas V2: permissões por obra (item) ainda não estão no banco; usando compatibilidade por área, módulo, quadro, grupo e coluna.');
      return readRemoteAccessRulesLegacy(commonOptions);
    }
  }

  async function readRemoteTableByIds(table, itemIds, options = {}) {
    const ids = [...new Set((itemIds || []).filter(Boolean))];
    if (!ids.length) return [];
    const chunks = [];
    for (let index = 0; index < ids.length; index += 100) {
      chunks.push(ids.slice(index, index + 100));
    }
    const results = new Array(chunks.length);
    let cursor = 0;
    const concurrency = Math.min(5, chunks.length);
    const worker = async () => {
      while (cursor < chunks.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await readRemoteTable(table, {
          ...options,
          in: { column: options.itemColumn || 'item_id', values: chunks[index] },
        });
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return results.flat();
  }

  function mapRemoteStorage(entry) {
    const connectorVersion = entry.connector_version || '';
    const compatibleLegacy = /^V1\.4-compatible/i.test(connectorVersion);
    return {
      id: entry.id,
      name: entry.nome,
      sector: entry.setor,
      accountEmail: entry.account_email,
      folderId: entry.folder_id,
      folderUrl: entry.folder_url,
      appScriptUrl: entry.app_script_url,
      // Coluna `tipo` chegou na Fase 0.1 do self-hosting. Linha antiga (ou banco
      // ainda sem a coluna) volta undefined e storageType() resolve como 'drive'.
      type: storageType({ type: entry.tipo }),
      status: compatibleLegacy && entry.status === 'inherited' ? 'connected' : entry.status,
      connectorVersion,
      verifiedAt: entry.verificado_em || null,
      createdAt: entry.created_at,
    };
  }

  function mapRemoteColumn(entry) {
    const settings = entry.configuracoes && typeof entry.configuracoes === 'object' ? entry.configuracoes : {};
    return {
      id: entry.id,
      name: entry.nome,
      type: entry.tipo,
      width: Number(entry.largura || COLUMN_TYPES[entry.tipo]?.width || 160),
      required: Boolean(entry.obrigatorio),
      options: entry.tipo === 'status'
        ? normalizeStatusOptions(Array.isArray(settings.options) ? settings.options : [])
        : (Array.isArray(settings.options) ? settings.options : []),
      formula: String(settings.formula || ''),
      format: String(settings.format || 'number'),
      decimals: Number(settings.decimals ?? 2),
      // V2.4: ligado por coluna em Admin > coluna do tipo Arquivo.
      versioned: settings.versionado === true,
      settings,
      order: Number(entry.ordem || 0),
      active: entry.ativo !== false,
    };
  }

  function mapRemoteItemTree(itemRows, valueRows) {
    const values = new Map();
    valueRows.forEach((entry) => {
      if (!values.has(entry.item_id)) values.set(entry.item_id, {});
      values.get(entry.item_id)[entry.column_id] = entry.valor;
    });
    const items = new Map(itemRows.map((entry) => [entry.id, {
      id: entry.id,
      groupId: entry.group_id,
      parentId: entry.parent_item_id || null,
      name: entry.nome,
      values: values.get(entry.id) || {},
      subitems: [],
      subitemsExpanded: false,
      order: Number(entry.ordem || 0),
      archived: Boolean(entry.arquivado),
      createdBy: entry.criado_por || null,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    }]));
    items.forEach((entry) => {
      if (entry.parentId && !entry.archived && items.has(entry.parentId)) items.get(entry.parentId).subitems.push(entry);
    });
    items.forEach((entry) => entry.subitems.sort((a, b) => a.order - b.order));
    return items;
  }

  function remoteAttachmentEntry(entry) {
    const fileId = String(entry?.file_id || '').trim();
    const viewUrl = String(entry?.view_url || (fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view` : '')).trim();
    const thumbnailUrl = String(entry?.thumbnail_url || (fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200` : viewUrl)).trim();
    return {
      name: entry?.nome || 'Arquivo importado',
      nome: entry?.nome || 'Arquivo importado',
      fileId,
      folderId: entry?.folder_id || '',
      mimeType: entry?.mime_type || '',
      size: Number(entry?.tamanho || 0),
      url: viewUrl,
      viewUrl,
      thumbnailUrl,
      migrated: true,
      attachmentId: entry?.id || '',
      storageConnectionId: entry?.storage_connection_id || '',
      // Versionamento (V2.4): documentId agrupa as versoes de um mesmo
      // documento; version e o numero dado pelo servidor; versionLabel e o
      // rotulo livre opcional. Anexo antigo (antes da migracao) nao tem
      // documentId - vira documento proprio na versao 1, ver attachmentDocuments.
      documentId: entry?.documento_id || '',
      version: Number(entry?.versao || 1),
      versionLabel: entry?.rotulo || '',
      // Versao automatica (V2.4): em coluna versionada o arquivo do Drive e UM
      // so, e cada versao aponta para uma revisao dele. `origin` diz se a versao
      // veio de um envio pelo Atlas ou de uma edicao feita direto no Drive;
      // `pinnedRevision` diz se aquela revisao foi fixada (sem fixar, o Google
      // descarta o conteudo e nao ha o que baixar).
      origin: entry?.origem || 'upload',
      originRevision: entry?.origem_revisao || '',
      originAuthor: entry?.origem_autor || '',
      driveVersion: entry?.drive_version || null,
      driveModifiedAt: entry?.drive_modified_at || '',
      pinnedRevision: Boolean(entry?.revisao_fixada),
      pinPending: Boolean(entry?.revisao_fixacao_pendente),
      reviewedAt: entry?.conferida_em || '',
      createdAt: entry?.created_at || '',
      attachmentBacked: true,
      _attachmentSource: true,
    };
  }

  // Agrupa os anexos de uma celula em DOCUMENTOS. Cada documento tem a lista
  // de versoes da mais nova para a mais antiga, e `current` (a versao vigente,
  // que e a que aparece na celula do quadro). Anexos sem documentId - os
  // enviados antes da V2.4, e os locais ainda nao sincronizados - viram cada
  // um o seu proprio documento de versao unica, entao a tela continua igual
  // para quem nunca usou versionamento.
  function attachmentDocuments(entries = []) {
    const documents = [];
    const byId = new Map();
    entries.forEach((entry, index) => {
      const key = entry?.documentId ? String(entry.documentId) : `__solo_${index}`;
      if (!byId.has(key)) {
        const created = { documentId: entry?.documentId || '', versions: [], current: null, firstIndex: index };
        byId.set(key, created);
        documents.push(created);
      }
      // Anexo local (ainda nao enviado) e anexo antigo lido de item_values nao
      // passam por remoteAttachmentEntry, entao chegam aqui sem `version`.
      // Normalizar para 1 evita que o historico mostre "Vundefined".
      const version = Number(entry?.version);
      byId.get(key).versions.push({ ...entry, version: Number.isFinite(version) && version > 0 ? version : 1, _index: index });
    });
    documents.forEach((document) => {
      document.versions.sort((a, b) => (Number(b.version || 1) - Number(a.version || 1)) || (b._index - a._index));
      document.current = document.versions[0] || null;
    });
    return documents;
  }

  // A celula do quadro mostra so a versao vigente de cada documento - as
  // anteriores vivem no historico, dentro do visualizador.
  function currentAttachmentEntries(entries = []) {
    return attachmentDocuments(entries).map((document) => document.current).filter(Boolean);
  }

  function columnIsVersioned(columnEntry) {
    return columnEntry?.type === 'file' && Boolean(columnEntry?.versioned);
  }

  function mergeRemoteAttachments(itemTree, attachmentRows, columnRows) {
    const attachmentColumns = new Set(columnRows.filter((entry) => ['image', 'file'].includes(entry.tipo)).map((entry) => entry.id));
    (attachmentRows || []).forEach((entry) => {
      if (!attachmentColumns.has(entry.column_id)) return;
      const itemEntry = itemTree.get(entry.item_id);
      if (!itemEntry) return;
      const current = normalizeImageEntries(itemEntry.values?.[entry.column_id]);
      const incoming = remoteAttachmentEntry(entry);
      const signature = (value) => String(value?.fileId || value?.viewUrl || value?.url || value?.thumbnailUrl || '').trim();
      if (!signature(incoming) || current.some((value) => signature(value) === signature(incoming))) return;
      itemEntry.values[entry.column_id] = [...current, incoming];
    });
  }

  function mapRemoteAuditEntry(entry) {
    const details = entry?.detalhes && typeof entry.detalhes === 'object' ? entry.detalhes : {};
    return {
      id: String(entry?.id || id('audit')),
      userId: entry?.user_id || '',
      action: entry?.acao || 'Atividade registrada',
      workspaceId: details.workspaceId || details.workspace_id || '',
      moduleId: details.moduleId || details.module_id || '',
      boardId: entry?.board_id || details.boardId || details.board_id || '',
      itemId: entry?.item_id || details.itemId || details.item_id || '',
      scope: details.scope || (entry?.board_id ? 'board' : 'system'),
      createdAt: entry?.created_at || new Date().toISOString(),
      remote: true,
    };
  }

  function mapRemoteTrashEntry(entry) {
    const storedPayload = entry?.payload && typeof entry.payload === 'object' ? entry.payload : {};
    return {
      id: entry?.id || id('trash'),
      type: entry?.tipo_entidade || 'item',
      name: entry?.nome || 'Item removido',
      payload: deepClone(storedPayload.entity ?? storedPayload.payload ?? storedPayload),
      parent: deepClone(storedPayload.parent || {}),
      deletedAt: entry?.excluido_em || new Date().toISOString(),
      deletedBy: entry?.excluido_por || '',
      expiresAt: entry?.expira_em || null,
      remote: true,
    };
  }

  async function hydrateBoardRemoteData(boardId, options = {}) {
    const normalizedBoardId = String(boardId || '');
    if (!normalizedBoardId || !runtime.authClient || !runtime.remoteMode) return false;
    const boardItemRows = (runtime.remoteRows?.atlas_v2_items || []).filter((entry) => String(entry.board_id) === normalizedBoardId);
    const boardItemIds = boardItemRows.map((entry) => String(entry.id));
    const requestedIds = [...new Set((Array.isArray(options.itemIds) ? options.itemIds : boardItemIds).map(String).filter(Boolean))];
    const itemIds = options.force ? requestedIds : requestedIds.filter((itemId) => !runtime.loadedItemValues.has(itemId));
    if (!itemIds.length) {
      if (boardItemIds.every((itemId) => runtime.loadedItemValues.has(itemId))) runtime.loadedBoardData.add(normalizedBoardId);
      return true;
    }
    if (runtime.boardDataLoading.has(normalizedBoardId)) {
      await runtime.boardDataLoading.get(normalizedBoardId);
      return hydrateBoardRemoteData(normalizedBoardId, options);
    }
    if (runtime.data?.activeBoardId === normalizedBoardId) document.body.classList.add('atlas-v2-board-loading');

    const operation = (async () => {
      const [valueRows, attachmentRows] = await Promise.all([
        readRemoteTableByIds('atlas_v2_item_values', itemIds, {
          select: 'id,item_id,column_id,valor,updated_by,created_at,updated_at',
          order: ['item_id', 'column_id', 'id'],
        }),
        readRemoteTableByIds('atlas_v2_attachments', itemIds, {
          order: ['item_id', 'column_id', 'ordem', 'id'],
        }),
      ]);
      const context = findBoard(normalizedBoardId);
      if (!context) return false;
      const itemMap = new Map();
      const visit = (items = []) => items.forEach((itemEntry) => {
        itemMap.set(itemEntry.id, itemEntry);
        visit(itemEntry.subitems || []);
      });
      (context.board.groups || []).forEach((groupEntry) => visit(groupEntry.items || []));
      itemIds.forEach((itemId) => {
        const itemEntry = itemMap.get(itemId);
        if (itemEntry) itemEntry.values = {};
      });
      valueRows.forEach((entry) => {
        const itemEntry = itemMap.get(entry.item_id);
        if (itemEntry) itemEntry.values[entry.column_id] = entry.valor;
      });
      mergeRemoteAttachments(itemMap, attachmentRows, (context.board.columns || []).map((entry) => ({ id: entry.id, tipo: entry.type })));
      runtime.remoteRows = runtime.remoteRows || {};
      const itemIdSet = new Set(itemIds.map(String));
      const projectedValueRows = valueRows.map(projectRealtimeValueRow);
      runtime.remoteRows.atlas_v2_item_values = [
        ...(runtime.remoteRows.atlas_v2_item_values || []).filter((entry) => !itemIdSet.has(String(entry.item_id))),
        ...projectedValueRows,
      ];
      runtime.remoteRows.atlas_v2_attachments = [
        ...(runtime.remoteRows.atlas_v2_attachments || []).filter((entry) => !itemIdSet.has(String(entry.item_id))),
        ...attachmentRows,
      ];
      itemIds.forEach((itemId) => runtime.loadedItemValues.add(String(itemId)));
      if (boardItemIds.every((itemId) => runtime.loadedItemValues.has(itemId))) runtime.loadedBoardData.add(normalizedBoardId);
      scheduleBootstrapCacheWrite(runtime.data);
      if (options.renderAfter !== false && runtime.data.activeBoardId === normalizedBoardId) {
        renderBoardContent(context.board);
        renderSelection(context.board);
        applyPermissionUi(context);
        refreshIcons(document.getElementById('atlas-v2-board-content'));
      }
      return true;
    })().catch((error) => {
      console.error('Atlas V2: falha ao carregar os registros do quadro.', error);
      toast(`Não foi possível carregar todos os dados deste quadro: ${error.message || error}`, true);
      return false;
    }).finally(() => {
      runtime.boardDataLoading.delete(normalizedBoardId);
      if (runtime.data?.activeBoardId === normalizedBoardId) document.body.classList.remove('atlas-v2-board-loading');
    });

    runtime.boardDataLoading.set(normalizedBoardId, operation);
    return operation;
  }

  function applyRealtimeIntegrationStatus(integrations = []) {
    return (integrations || []).map((entry) => {
      if (entry.id !== 'realtime') return entry;
      const status = runtime.realtimeStatus || 'waiting';
      const detail = status === 'connected'
        ? 'Canal ativo. Alterações dos quadros são recebidas automaticamente.'
        : status === 'error'
          ? 'O canal perdeu a conexão. O Atlas tentará reconectar automaticamente.'
          : 'Conectando ao canal de atualizações do Supabase.';
      return { ...entry, status, detail };
    });
  }

  function setRealtimeStatus(status, detail = '') {
    runtime.realtimeStatus = status;
    const integrations = runtime.data?.system?.integrations;
    if (!Array.isArray(integrations)) return;
    const target = integrations.find((entry) => entry.id === 'realtime');
    if (!target) return;
    target.status = status;
    target.detail = detail || (status === 'connected'
      ? 'Canal ativo. Alterações dos quadros são recebidas automaticamente.'
      : status === 'error'
        ? 'O canal perdeu a conexão. O Atlas tentará reconectar automaticamente.'
        : 'Conectando ao canal de atualizações do Supabase.');
    // Não reconstruir a aplicação apenas para atualizar o indicador do canal.
    // O estado será refletido no próximo render natural, preservando scroll e foco.
  }

  function stopRealtime() {
    clearTimeout(runtime.realtimeRefreshTimer);
    clearTimeout(runtime.realtimePayloadTimer);
    clearTimeout(runtime.realtimeRenderTimer);
    clearTimeout(runtime.realtimeAttachmentPollTimer);
    clearTimeout(runtime.realtimeChangePollTimer);
    clearTimeout(runtime.realtimeReconnectTimer);
    runtime.realtimeRefreshTimer = null;
    runtime.realtimePayloadTimer = null;
    runtime.realtimeRenderTimer = null;
    runtime.realtimeAttachmentPollTimer = null;
    runtime.realtimeChangePollTimer = null;
    runtime.realtimeReconnectTimer = null;
    runtime.realtimeAttachmentCursor = '';
    runtime.realtimeChangeCursor = null;
    runtime.realtimeLastAppliedChange = 0;
    runtime.realtimeChangePollBusy = false;
    runtime.realtimeReconnectAttempts = 0;
    runtime.realtimeLastEventAt = 0;
    runtime.realtimeBroadcastBusy = false;
    runtime.realtimeBroadcastQueue = [];
    runtime.realtimeRefreshFull = false;
    runtime.realtimePendingTables.clear();
    runtime.realtimePayloads.clear();
    runtime.realtimeDirtyBoards.clear();
    runtime.realtimeLocalIds.clear();
    if (runtime.realtimeChannel && runtime.authClient) {
      try { runtime.authClient.removeChannel(runtime.realtimeChannel); } catch (_) {}
    }
    runtime.realtimeChannel = null;
    runtime.realtimePollingActive = false;
    runtime.realtimeStatus = 'waiting';
  }

  function realtimeRowKey(payload = {}) {
    const table = String(payload.table || '').trim();
    const row = payload.new && Object.keys(payload.new).length ? payload.new : (payload.old || {});
    const key = row.id || (row.item_id && row.column_id ? `${row.item_id}:${row.column_id}` : row.item_id || row.board_id || payload.commit_timestamp || Date.now());
    return `${table}:${key}`;
  }

  function projectRealtimeItemRow(row = {}) {
    return {
      id: row.id,
      board_id: row.board_id,
      group_id: row.group_id || null,
      parent_item_id: row.parent_item_id || null,
      nome: row.nome || 'Novo item',
      ordem: Number(row.ordem || 0),
      arquivado: Boolean(row.arquivado),
    };
  }

  function projectRealtimeValueRow(row = {}) {
    return { item_id: row.item_id, column_id: row.column_id, valor: row.valor };
  }

  function removeRemoteBaselineRow(table, row = {}) {
    if (!runtime.remoteRows || !Array.isArray(runtime.remoteRows[table])) return;
    const key = remoteKey(table, row);
    runtime.remoteRows[table] = runtime.remoteRows[table].filter((entry) => remoteKey(table, entry) !== key);
  }

  function findItemContextById(itemId) {
    for (const context of allBoards()) {
      const found = findItem(context.board, itemId);
      if (found) return { ...context, found };
    }
    return null;
  }

  function realtimeImageSignature(entry) {
    return String(entry?.attachmentId || entry?.fileId || entry?.viewUrl || entry?.url || entry?.thumbnailUrl || '').trim();
  }

  function patchRealtimeImageCell(context, columnId) {
    if (!context?.board || !context?.found?.item || runtime.page !== 'board') return false;
    if (String(runtime.data?.activeBoardId || '') !== String(context.board.id || '')) return false;
    if (!['table', 'works'].includes(String(context.board.activeView || 'table'))) return false;
    const columnEntry = context.board.columns.find((entry) => String(entry.id) === String(columnId));
    if (!columnEntry || !['image', 'file'].includes(columnEntry.type)) return false;
    const rows = [...document.querySelectorAll('tr[data-item-id]')].filter((row) => String(row.dataset.itemId || '') === String(context.found.item.id));
    let patched = false;
    rows.forEach((row) => {
      const input = [...row.querySelectorAll('input[type="file"][data-item-value][data-column-id]')].find((entry) =>
        String(entry.dataset.itemValue || '') === String(context.found.item.id) && String(entry.dataset.columnId || '') === String(columnId));
      const cell = input?.closest('td');
      if (!cell) return;
      cell.innerHTML = renderCell(columnEntry, context.found.item);
      refreshIcons(cell);
      patched = true;
    });
    if (patched) scheduleBootstrapCacheWrite(runtime.data);
    return patched;
  }

  function patchRealtimeValueCell(context, columnId) {
    if (!context?.board || !context?.found?.item || runtime.page !== 'board') return false;
    if (String(runtime.data?.activeBoardId || '') !== String(context.board.id || '')) return false;
    if (String(context.board.activeView || '') === 'gantt') return false;
    if (!['table', 'works'].includes(String(context.board.activeView || 'table'))) return false;
    const columnEntry = context.board.columns.find((entry) => String(entry.id) === String(columnId));
    if (!columnEntry) return false;
    if (['image', 'file'].includes(columnEntry.type)) return patchRealtimeImageCell(context, columnId);

    const value = context.found.item.values?.[columnEntry.id] ?? '';
    const rows = [...document.querySelectorAll('tr[data-item-id]')].filter((row) => String(row.dataset.itemId || '') === String(context.found.item.id));
    let patched = false;
    rows.forEach((row) => {
      const control = [...row.querySelectorAll('[data-item-value][data-column-id]')].find((entry) =>
        String(entry.dataset.itemValue || '') === String(context.found.item.id)
        && String(entry.dataset.columnId || '') === String(columnId));
      if (!control) return;
      if (control === document.activeElement && ['text', 'url', 'number', 'date'].includes(String(control.type || '').toLowerCase())) {
        patched = true;
        return;
      }
      if (control.type === 'checkbox') control.checked = Boolean(value);
      else if (columnEntry.type === 'currency') control.value = formatCurrencyDisplay(value);
      else control.value = value ?? '';
      if (columnEntry.type === 'status') {
        const details = optionDetails(columnEntry, value);
        if (details.background) {
          control.style.setProperty('--status-bg', details.background);
          control.style.setProperty('--status-color', details.color || '#171c26');
        } else {
          control.style.removeProperty('--status-bg');
          control.style.removeProperty('--status-color');
        }
      }
      patched = true;
    });
    if (patched) scheduleBootstrapCacheWrite(runtime.data);
    return patched;
  }

  function initializeAttachmentCursor() {
    if (runtime.realtimeAttachmentCursor) return;
    const rows = runtime.remoteRows?.atlas_v2_attachments || [];
    runtime.realtimeAttachmentCursor = rows.reduce((latest, row) => {
      const value = String(row.updated_at || row.created_at || '');
      return value > latest ? value : latest;
    }, '') || new Date(Date.now() - 5000).toISOString();
  }

  async function pollRecentAttachments() {
    clearTimeout(runtime.realtimeAttachmentPollTimer);
    clearTimeout(runtime.realtimeChangePollTimer);
    runtime.realtimeAttachmentPollTimer = null;
    if (!runtime.authClient || !runtime.authSession?.user || !runtime.remoteMode) return;
    initializeAttachmentCursor();
    try {
      let page = [];
      do {
        const cursor = runtime.realtimeAttachmentCursor;
        const cursorId = String(runtime.realtimeAttachmentCursorId || '00000000-0000-0000-0000-000000000000');
        const { data, error } = await runtime.authClient
          .from('atlas_v2_attachments')
          .select('*')
          .or(`updated_at.gt.${cursor},and(updated_at.eq.${cursor},id.gt.${cursorId})`)
          .order('updated_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(500);
        if (error) throw error;
        page = data || [];
        for (const row of page) {
          runtime.realtimeAttachmentCursor = String(row.updated_at || row.created_at || runtime.realtimeAttachmentCursor);
          runtime.realtimeAttachmentCursorId = String(row.id || runtime.realtimeAttachmentCursorId || '');
          if (!runtime.realtimeLocalIds.has(row.id)) {
            await applyRealtimeAttachmentPayload({ table: 'atlas_v2_attachments', eventType: 'INSERT', new: row, old: {} });
          }
        }
      } while (page.length === 500);
    } catch (error) {
      console.warn('Atlas V2: verificação complementar de anexos falhou.', error);
    } finally {
      runtime.realtimeAttachmentPollTimer = setTimeout(pollRecentAttachments, document.hidden ? 5000 : 1800);
    }
  }

  function globalRealtimePollDelay() {
    if (document.hidden) return 15000;
    // O feed autenticado e o caminho principal entre as sessoes do Atlas.
    return runtime.realtimeStatus === 'connected' ? 1500 : 1000;
  }

  async function pollGlobalRealtimeChanges() {
    clearTimeout(runtime.realtimeChangePollTimer);
    runtime.realtimeChangePollTimer = null;
    if (!runtime.authClient || !runtime.authSession?.user || !runtime.remoteMode) return;
    if (runtime.realtimeChangePollBusy) {
      runtime.realtimeChangePollTimer = setTimeout(pollGlobalRealtimeChanges, globalRealtimePollDelay());
      return;
    }

    runtime.realtimeChangePollBusy = true;
    try {
      const { data, error } = await runtime.authClient.rpc('atlas_v2_get_changes_since', {
        p_after: runtime.realtimeChangeCursor,
        p_limit: 500,
      });
      if (error) throw error;
      const changes = Array.isArray(data?.changes) ? data.changes : [];
      changes.forEach((change) => {
        const changeId = Number(change?.id || 0);
        if (changeId && changeId <= Number(runtime.realtimeLastAppliedChange || 0)) return;
        const payload = {
          table: String(change?.table || ''),
          eventType: String(change?.eventType || '').toUpperCase(),
          new: change?.new || {},
          old: change?.old || {},
          commit_timestamp: change?.changedAt || '',
          _changeFeedId: changeId,
        };
        // Automacoes nao aparecem na tabela do quadro (so no modal de
        // "Automacoes", lido sob demanda de runtime.data.automations) - por
        // isso entram no caminho leve (patch direto no array em memoria), em
        // vez do caminho pesado (queueRealtimeRefresh: refaz TODO o
        // loadRemoteData e re-renderiza a pagina inteira por causa de uma
        // automacao editada em algum canto).
        if (['atlas_v2_items', 'atlas_v2_item_values', 'atlas_v2_attachments', 'atlas_v2_item_messages', 'atlas_v2_automations'].includes(payload.table)) {
          queueRealtimePayload(payload);
        } else {
          queueRealtimeRefresh(payload);
        }
        if (changeId) runtime.realtimeLastAppliedChange = Math.max(Number(runtime.realtimeLastAppliedChange || 0), changeId);
      });
      const cursor = Number(data?.cursor || 0);
      if (cursor) runtime.realtimeChangeCursor = Math.max(Number(runtime.realtimeChangeCursor || 0), cursor);
    } catch (error) {
      console.warn('Atlas V2: verificação global complementar do Realtime falhou.', error);
    } finally {
      runtime.realtimeChangePollBusy = false;
      runtime.realtimeChangePollTimer = setTimeout(pollGlobalRealtimeChanges, globalRealtimePollDelay());
    }
  }

  // renderBoardContent (chamada tanto por markRealtimeBoardDirty quanto pelo
  // render() geral apos uma recarga completa) reconstroi o HTML inteiro da
  // tabela do quadro (root.innerHTML = ...). Fazer isso enquanto a pessoa
  // esta com um campo do quadro em foco destroi esse input, perdendo o foco
  // e o que estava sendo digitado - a tela "pisca" e muda de lugar do nada.
  // Acontecia sobretudo ao voltar o foco para a aba depois de estar fora
  // dela: o retorno de foco dispara pollGlobalRealtimeChanges, que encontra
  // mudancas acumuladas (proprias ou de outra pessoa) e cai numa renderizacao
  // completa no meio de uma edicao em andamento.
  function isEditingBoardField() {
    if (runtime.page !== 'board') return false;
    const root = document.getElementById('atlas-v2-board-content');
    return Boolean(root?.contains(document.activeElement))
      && Boolean(document.activeElement?.matches?.('[data-item-value], [data-item-name]'));
  }

  // Chama render() agora, ou adia se a pessoa estiver com outro campo do
  // quadro em foco (ver isEditingBoardField). Usado nos pontos em que render()
  // seria disparado por algo fora do proprio campo que a pessoa esta editando
  // no momento - uma atualizacao de tempo real, ou o tratamento de erro de um
  // OUTRO campo cujo envio falhou depois que a pessoa ja tinha seguido para
  // este - para nao destruir a edicao em andamento por causa de algo nao
  // relacionado a ela.
  function renderSoon() {
    if (document.hidden) return;
    if (isEditingBoardField()) { setTimeout(renderSoon, 400); return; }
    render();
  }

  function markRealtimeBoardDirty(boardId) {
    if (boardId) runtime.realtimeDirtyBoards.add(String(boardId));
    clearTimeout(runtime.realtimeRenderTimer);
    runtime.realtimeRenderTimer = setTimeout(() => {
      runtime.realtimeRenderTimer = null;
      const activeBoardId = String(runtime.data?.activeBoardId || '');
      const shouldRender = runtime.realtimeDirtyBoards.has(activeBoardId);
      if (shouldRender && document.hidden) {
        runtime.realtimeRenderTimer = setTimeout(() => markRealtimeBoardDirty(null), 1500);
        return;
      }
      // Reagenda em vez de renderizar; o quadro continua marcado como sujo e
      // a atualizacao aparece assim que o campo perder o foco normalmente.
      if (shouldRender && isEditingBoardField()) {
        runtime.realtimeRenderTimer = setTimeout(() => markRealtimeBoardDirty(null), 400);
        return;
      }
      runtime.realtimeDirtyBoards.clear();
      scheduleBootstrapCacheWrite(runtime.data);
      if (!shouldRender || runtime.page !== 'board') return;
      const root = document.getElementById('atlas-v2-board-content');
      const context = findBoard(activeBoardId);
      if (!context) return;
      renderBoardContent(context.board);
      renderSelection(context.board);
      applyPermissionUi(context);
      refreshIcons(root || document);
    }, 70);
  }

  async function fetchRealtimeItemBundle(itemId) {
    const [itemResult, valueResult, attachmentResult] = await Promise.all([
      runtime.authClient.from('atlas_v2_items').select('*').eq('id', itemId).maybeSingle(),
      runtime.authClient.from('atlas_v2_item_values').select('*').eq('item_id', itemId),
      runtime.authClient.from('atlas_v2_attachments').select('*').eq('item_id', itemId).order('column_id').order('ordem').order('id'),
    ]);
    if (itemResult.error) throw itemResult.error;
    if (valueResult.error) throw valueResult.error;
    if (attachmentResult.error) throw attachmentResult.error;
    if (!itemResult.data) return null;
    return { item: itemResult.data, values: valueResult.data || [], attachments: attachmentResult.data || [] };
  }

  function detachLocalItem(itemId) {
    const context = findItemContextById(itemId);
    if (!context) return null;
    const index = context.found.collection.findIndex((entry) => entry.id === itemId);
    if (index >= 0) context.found.collection.splice(index, 1);
    return context;
  }

  function placeRealtimeItem(bundle) {
    const itemRow = bundle?.item;
    if (!itemRow?.id) return '';
    const boardContext = findBoard(itemRow.board_id);
    if (!boardContext) return '';
    const mapped = mapRemoteItemTree([itemRow], bundle.values || []).get(itemRow.id);
    if (!mapped) return boardContext.board.id;
    const mappedTree = new Map([[mapped.id, mapped]]);
    mergeRemoteAttachments(mappedTree, bundle.attachments || [], allRemoteColumns());

    const existingContext = findItemContextById(mapped.id);
    const existingChildren = existingContext?.found?.item?.subitems || [];
    mapped.subitems = existingChildren;
    mapped.subitemsExpanded = existingContext?.found?.item?.subitemsExpanded || false;
    if (existingContext) detachLocalItem(mapped.id);

    if (itemRow.arquivado) {
      replaceRemoteBaselineRow('atlas_v2_items', projectRealtimeItemRow(itemRow));
      if (runtime.remoteRows) runtime.remoteRows.atlas_v2_item_values = (runtime.remoteRows.atlas_v2_item_values || []).filter((entry) => entry.item_id !== mapped.id);
      return boardContext.board.id;
    }

    if (itemRow.parent_item_id) {
      const parentContext = findItemContextById(itemRow.parent_item_id);
      if (parentContext) {
        mapped.parentId = itemRow.parent_item_id;
        mapped.groupId = itemRow.group_id || parentContext.found.item.groupId;
        parentContext.found.item.subitems = parentContext.found.item.subitems || [];
        parentContext.found.item.subitems.push(mapped);
        parentContext.found.item.subitems.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      } else {
        runtime.remoteRefreshQueued = true;
      }
    } else {
      const targetGroup = boardContext.board.groups.find((entry) => entry.id === itemRow.group_id) || boardContext.board.groups[0];
      if (targetGroup) {
        mapped.parentId = null;
        mapped.groupId = targetGroup.id;
        targetGroup.items.push(mapped);
        targetGroup.items.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      }
    }

    replaceRemoteBaselineRow('atlas_v2_items', projectRealtimeItemRow(itemRow));
    if (runtime.remoteRows) runtime.remoteRows.atlas_v2_item_values = (runtime.remoteRows.atlas_v2_item_values || []).filter((entry) => entry.item_id !== mapped.id);
    if (runtime.remoteRows) (bundle.values || []).forEach((entry) => replaceRemoteBaselineRow('atlas_v2_item_values', projectRealtimeValueRow(entry)));
    return boardContext.board.id;
  }

  async function applyRealtimeItemPayload(payload) {
    const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    const itemId = row?.id;
    if (!itemId) return;
    if (payload.eventType === 'DELETE') {
      const context = detachLocalItem(itemId);
      removeRemoteBaselineRow('atlas_v2_items', projectRealtimeItemRow(row));
      if (runtime.remoteRows) runtime.remoteRows.atlas_v2_item_values = (runtime.remoteRows.atlas_v2_item_values || []).filter((entry) => entry.item_id !== itemId);
      if (context?.board?.id) markRealtimeBoardDirty(context.board.id);
      return;
    }
    const bundle = await fetchRealtimeItemBundle(itemId);
    if (!bundle) return;
    const boardId = placeRealtimeItem(bundle);
    if (boardId) markRealtimeBoardDirty(boardId);
  }

  async function applyRealtimeValuePayload(payload) {
    const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    if (!row?.item_id || !row?.column_id) {
      if (payload.eventType === 'DELETE') runtime.remoteRefreshQueued = true;
      return;
    }
    let context = findItemContextById(row.item_id);
    if (!context) {
      const bundle = await fetchRealtimeItemBundle(row.item_id);
      if (bundle) {
        const boardId = placeRealtimeItem(bundle);
        if (boardId) markRealtimeBoardDirty(boardId);
      }
      return;
    }
    const columnEntry = context.board.columns.find((entry) => entry.id === row.column_id);
    if (payload.eventType === 'DELETE') {
      if (['image', 'file'].includes(columnEntry?.type)) {
        const backed = normalizeImageEntries(context.found.item.values?.[row.column_id]).filter((entry) => entry._attachmentSource || entry.attachmentBacked);
        if (backed.length) context.found.item.values[row.column_id] = backed;
        else delete context.found.item.values[row.column_id];
      } else {
        delete context.found.item.values[row.column_id];
      }
      removeRemoteBaselineRow('atlas_v2_item_values', projectRealtimeValueRow(row));
    } else {
      if (['image', 'file'].includes(columnEntry?.type)) {
        const backed = normalizeImageEntries(context.found.item.values?.[row.column_id]).filter((entry) => entry._attachmentSource || entry.attachmentBacked);
        const editable = normalizeImageEntries(row.valor).filter((entry) => !(entry._attachmentSource || entry.attachmentBacked));
        context.found.item.values[row.column_id] = [...editable, ...backed.filter((entry) => !editable.some((candidate) => realtimeImageSignature(candidate) === realtimeImageSignature(entry)))];
      } else {
        context.found.item.values[row.column_id] = row.valor;
      }
      replaceRemoteBaselineRow('atlas_v2_item_values', projectRealtimeValueRow(row));
    }
    if (!patchRealtimeValueCell(context, row.column_id)) markRealtimeBoardDirty(context.board.id);
  }

  async function applyRealtimeAttachmentPayload(payload) {
    const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    if (!row?.id) return;
    if (runtime.realtimeLocalIds.has(row.id)) return;
    let context = row.item_id ? findItemContextById(row.item_id) : null;
    if (!context && row.item_id) {
      const bundle = await fetchRealtimeItemBundle(row.item_id);
      if (bundle) {
        const boardId = placeRealtimeItem(bundle);
        if (boardId) markRealtimeBoardDirty(boardId);
      }
      return;
    }
    if (!context) {
      for (const candidate of allBoards()) {
        for (const groupEntry of candidate.board.groups || []) {
          const visit = (items) => {
            for (const itemEntry of items || []) {
              for (const [columnId, value] of Object.entries(itemEntry.values || {})) {
                if (normalizeImageEntries(value).some((entry) => entry.attachmentId === row.id)) return { candidate, itemEntry, columnId };
              }
              const child = visit(itemEntry.subitems);
              if (child) return child;
            }
            return null;
          };
          const found = visit(groupEntry.items);
          if (found) {
            const images = normalizeImageEntries(found.itemEntry.values?.[found.columnId]).filter((entry) => entry.attachmentId !== row.id);
            found.itemEntry.values[found.columnId] = images;
            markRealtimeBoardDirty(found.candidate.board.id);
            return;
          }
        }
      }
      return;
    }
    const columnId = row.column_id;
    const images = normalizeImageEntries(context.found.item.values?.[columnId]);
    if (payload.eventType === 'DELETE') {
      context.found.item.values[columnId] = images.filter((entry) => entry.attachmentId !== row.id);
      removeRemoteBaselineRow('atlas_v2_attachments', row);
    } else {
      const incoming = remoteAttachmentEntry(row);
      const index = images.findIndex((entry) => entry.attachmentId === row.id || (realtimeImageSignature(entry) && realtimeImageSignature(entry) === realtimeImageSignature(incoming)));
      if (index >= 0) images[index] = incoming;
      else images.push(incoming);
      context.found.item.values[columnId] = images;
      replaceRemoteBaselineRow('atlas_v2_attachments', row);
      const timestamp = String(row.updated_at || row.created_at || '');
      if (timestamp > runtime.realtimeAttachmentCursor) runtime.realtimeAttachmentCursor = timestamp;
    }
    if (!patchRealtimeImageCell(context, columnId)) markRealtimeBoardDirty(context.board.id);
  }

  // Automacoes nao aparecem na tabela do quadro - basta o patch direto no
  // array em memoria, lido sob demanda pelo modal de Automacoes via
  // boardAutomations(). Nao dispara renderBoardContent/markRealtimeBoardDirty
  // (nada da tabela depende disso), mas SE o modal de Automacoes estiver
  // aberto na hora, ele e re-renderizado - senao a pessoa ficaria olhando um
  // dado velho sem nenhum sinal de que mudou.
  function applyRealtimeAutomationPayload(payload) {
    const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    if (!row?.id) return;
    runtime.data.automations = runtime.data.automations || [];
    if (payload.eventType === 'DELETE') {
      runtime.data.automations = runtime.data.automations.filter((entry) => entry.id !== row.id);
      refreshOpenAutomationsPanel();
      return;
    }
    const mapped = {
      id: row.id,
      boardId: row.board_id,
      name: row.nome || 'Automação',
      trigger: row.gatilho || {},
      conditions: Array.isArray(row.condicoes) ? row.condicoes : [],
      actions: Array.isArray(row.acoes) ? row.acoes : [],
      active: row.ativo !== false,
      createdBy: row.criado_por || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    const index = runtime.data.automations.findIndex((entry) => entry.id === row.id);
    if (index >= 0) runtime.data.automations[index] = mapped;
    else runtime.data.automations.push(mapped);
    refreshOpenAutomationsPanel();
  }

  async function flushRealtimePayloads() {
    runtime.realtimePayloadTimer = null;
    if (!runtime.authSession?.user || !runtime.remoteMode) return;
    if (document.hidden || runtime.remoteSyncing || runtime.remoteSyncTimer || runtime.bootstrapRefreshing) {
      runtime.realtimePayloadTimer = setTimeout(flushRealtimePayloads, document.hidden ? 500 : 120);
      return;
    }
    const payloads = [...runtime.realtimePayloads.values()];
    runtime.realtimePayloads.clear();
    for (const payload of payloads) {
      try {
        if (payload.table === 'atlas_v2_items') await applyRealtimeItemPayload(payload);
        else if (payload.table === 'atlas_v2_item_values') await applyRealtimeValuePayload(payload);
        else if (payload.table === 'atlas_v2_attachments') await applyRealtimeAttachmentPayload(payload);
        else if (payload.table === 'atlas_v2_item_messages') await applyRealtimeMessagePayload(payload);
        else if (payload.table === 'atlas_v2_automations') applyRealtimeAutomationPayload(payload);
      } catch (error) {
        console.warn(`Atlas V2: atualização incremental de ${payload.table} falhou.`, error);
        runtime.remoteRefreshQueued = true;
      }
    }
    if (runtime.remoteRefreshQueued && !runtime.remoteSyncing && !runtime.remoteSyncTimer) {
      runtime.remoteRefreshQueued = false;
      setTimeout(() => refreshRemoteApplication(runtime.authProfile, runtime.authSession?.user, { full: false, silent: true }), 120);
    }
  }

  function queueRealtimePayload(payload = {}) {
    runtime.realtimePayloads.set(realtimeRowKey(payload), payload);
    clearTimeout(runtime.realtimePayloadTimer);
    runtime.realtimePayloadTimer = setTimeout(flushRealtimePayloads, 45);
  }

  function queueRealtimeRefresh(payload = {}) {
    const table = String(payload.table || '').trim();
    if (table) runtime.realtimePendingTables.add(table);
    if (['atlas_v2_field_templates', 'atlas_v2_integrations', 'atlas_v2_columns', 'atlas_v2_groups', 'atlas_v2_boards', 'atlas_v2_views', 'atlas_v2_automations'].includes(table)) {
      runtime.realtimeRefreshFull = runtime.realtimeRefreshFull || ['atlas_v2_field_templates', 'atlas_v2_integrations'].includes(table);
    }
    if (table === 'atlas_v2_notifications') refreshNotifications();
    if (table === 'atlas_profiles' && runtime.authProfile?.role === 'admin') {
      syncAuthUsersFromSupabase({ renderAfter: false, notify: false });
    }
    clearTimeout(runtime.realtimeRefreshTimer);
    runtime.realtimeRefreshTimer = setTimeout(async () => {
      runtime.realtimeRefreshTimer = null;
      if (!runtime.authSession?.user || !runtime.remoteMode || document.hidden) {
        runtime.realtimeRefreshTimer = setTimeout(() => queueRealtimeRefresh({}), 500);
        return;
      }
      if (runtime.remoteSyncing || runtime.remoteSyncTimer || runtime.bootstrapRefreshing) {
        runtime.remoteRefreshQueued = true;
        runtime.realtimeRefreshTimer = setTimeout(() => queueRealtimeRefresh({}), 180);
        return;
      }
      const full = runtime.realtimeRefreshFull;
      runtime.realtimeRefreshFull = false;
      runtime.realtimePendingTables.clear();
      await refreshRemoteApplication(runtime.authProfile, runtime.authSession.user, { full, silent: true });
    }, 180);
  }

  function scheduleRealtimeReconnect(reason = 'Canal desconectado.') {
    clearTimeout(runtime.realtimeReconnectTimer);
    const channel = runtime.realtimeChannel;
    runtime.realtimeChannel = null;
    if (channel && runtime.authClient) {
      try { runtime.authClient.removeChannel(channel); } catch (_) {}
    }
    runtime.realtimeReconnectAttempts += 1;
    const delay = Math.min(5000, 250 * (2 ** Math.min(runtime.realtimeReconnectAttempts, 4)));
    setRealtimeStatus('waiting', `${reason} Reconectando...`);
    runtime.realtimeReconnectTimer = setTimeout(startRealtime, delay);
  }

  async function fetchAndApplyLiveHint(hint = {}) {
    const table = String(hint.table || '').trim();
    const eventType = String(hint.eventType || '').toUpperCase();
    const recordId = String(hint.recordId || '').trim();
    const itemId = String(hint.itemId || '').trim();
    const columnId = String(hint.columnId || '').trim();
    if (!table || !runtime.authClient || !runtime.authSession?.user || !runtime.remoteMode) return;

    if (table === 'atlas_v2_items') {
      const targetId = itemId || recordId;
      if (!targetId) return;
      if (eventType === 'DELETE') {
        await applyRealtimeItemPayload({ table, eventType: 'DELETE', new: {}, old: { id: targetId, board_id: hint.boardId || '' } });
        return;
      }
      const { data, error } = await runtime.authClient.from(table).select('*').eq('id', targetId).maybeSingle();
      if (error) throw error;
      if (!data || data.arquivado) {
        await applyRealtimeItemPayload({ table, eventType: 'DELETE', new: {}, old: { id: targetId, board_id: hint.boardId || '' } });
      } else {
        await applyRealtimeItemPayload({ table, eventType: eventType || 'UPDATE', new: data, old: {} });
      }
      return;
    }

    if (table === 'atlas_v2_item_values') {
      if (!itemId || !columnId) return;
      const { data, error } = await runtime.authClient
        .from(table)
        .select('*')
        .eq('item_id', itemId)
        .eq('column_id', columnId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        await applyRealtimeValuePayload({ table, eventType: 'DELETE', new: {}, old: { item_id: itemId, column_id: columnId } });
      } else {
        await applyRealtimeValuePayload({ table, eventType: eventType || 'UPDATE', new: data, old: {} });
      }
      return;
    }

    if (table === 'atlas_v2_attachments') {
      if (!recordId) return;
      const { data, error } = await runtime.authClient.from(table).select('*').eq('id', recordId).maybeSingle();
      if (error) throw error;
      if (!data) {
        await applyRealtimeAttachmentPayload({
          table,
          eventType: 'DELETE',
          new: {},
          old: { id: recordId, item_id: itemId, column_id: columnId },
        });
      } else {
        await applyRealtimeAttachmentPayload({ table, eventType: eventType || 'UPDATE', new: data, old: {} });
      }
      return;
    }

    queueRealtimeRefresh({ table, eventType, new: {}, old: {} });
  }

  async function flushLiveBroadcastQueue() {
    if (runtime.realtimeBroadcastBusy) return;
    runtime.realtimeBroadcastBusy = true;
    try {
      while (runtime.realtimeBroadcastQueue.length) {
        const hint = runtime.realtimeBroadcastQueue.shift();
        try {
          await fetchAndApplyLiveHint(hint);
        } catch (error) {
          console.warn('Atlas V2: falha ao aplicar Broadcast em tempo real.', hint, error);
          runtime.remoteRefreshQueued = true;
        }
      }
    } finally {
      runtime.realtimeBroadcastBusy = false;
      if (runtime.remoteRefreshQueued && !runtime.remoteSyncing && !runtime.bootstrapRefreshing) {
        runtime.remoteRefreshQueued = false;
        setTimeout(() => refreshRemoteApplication(runtime.authProfile, runtime.authSession?.user, { full: false, silent: true }), 80);
      }
    }
  }

  function handleLiveBroadcast(message = {}) {
    const hint = message?.payload || message || {};
    if (!hint?.table) return;
    runtime.realtimeLastEventAt = Date.now();
    const key = `${hint.table}:${hint.recordId || hint.itemId || ''}:${hint.columnId || ''}:${hint.eventType || ''}`;
    const index = runtime.realtimeBroadcastQueue.findIndex((entry) =>
      `${entry.table}:${entry.recordId || entry.itemId || ''}:${entry.columnId || ''}:${entry.eventType || ''}` === key);
    if (index >= 0) runtime.realtimeBroadcastQueue[index] = hint;
    else runtime.realtimeBroadcastQueue.push(hint);
    void flushLiveBroadcastQueue();
  }

  function startRealtime() {
    if (!runtime.authClient || !runtime.authSession?.user || runtime.realtimePollingActive) return;
    clearTimeout(runtime.realtimeReconnectTimer);
    runtime.realtimeReconnectTimer = null;
    runtime.realtimePollingActive = true;
    runtime.realtimeReconnectAttempts = 0;
    setRealtimeStatus('connected', 'Sincronização autenticada ativa. Alterações confirmadas no banco aparecem automaticamente.');

    initializeAttachmentCursor();
    if (!runtime.realtimeChangePollTimer) void pollGlobalRealtimeChanges();
    clearTimeout(runtime.realtimeAttachmentPollTimer);
    runtime.realtimeAttachmentPollTimer = null;
    // Sondagem do Drive: alteracao feita no arquivo la fora nao gera evento
    // nenhum no Supabase, entao o unico jeito de perceber e perguntar.
    scheduleDriveVersionPolling();
  }

  async function loadRemoteData(options = {}) {
    if (!runtime.authClient || !runtime.authSession?.user) return null;
    const includeAttachments = options.includeAttachments !== false;
    const includeExtras = options.includeExtras !== false;
    // Instantaneo ANTES de qualquer await: esta funcao roda a cada atualizacao
    // completa (bootstrap E qualquer eco de tempo real de grupos/colunas/
    // quadros/automacoes em QUALQUER quadro), mas so busca item_values do
    // quadro "preferido" da vez. Sem preservar o que ja estava carregado, um
    // eco de tempo real vindo de outro quadro reiniciava loadedItemValues e
    // zerava os valores em memoria de itens/subitens ja carregados noutro
    // quadro - obrigando a rebuscar tudo de novo a cada eco, na contramao da
    // otimizacao de carregamento sob demanda da V2.2.0.
    const previouslyLoadedItemIds = new Set(runtime.loadedItemValues);
    const [
      workspaceRows, moduleRows, boardRows, groupRows, columnRows, itemRows,
      viewRows, storageRows, accessRows, memberRows, automationRows, fieldRows, integrationRows,
    ] = await Promise.all([
      readRemoteTable('atlas_v2_workspaces', { select: 'id,nome,descricao,cor,tipo_acesso,ativo,ordem,storage_connection_id', order: ['ordem', 'id'] }),
      readRemoteTable('atlas_v2_modules', { select: 'id,workspace_id,parent_module_id,nome,descricao,icone,ordem,ativo,storage_connection_id', order: ['workspace_id', 'ordem', 'id'] }),
      readRemoteTable('atlas_v2_boards', { select: 'id,module_id,nome,descricao,icone,tipo_acesso,origem,configuracoes,oficial,ativo,ordem,storage_connection_id', order: ['module_id', 'ordem', 'id'] }),
      readRemoteTable('atlas_v2_groups', { select: 'id,board_id,nome,cor,recolhido,ordem', order: ['board_id', 'ordem', 'id'] }),
      readRemoteTable('atlas_v2_columns', { select: 'id,board_id,nome,tipo,configuracoes,largura,obrigatorio,ativo,ordem', order: ['board_id', 'ordem', 'id'] }),
      readRemoteTable('atlas_v2_items', { select: 'id,board_id,group_id,parent_item_id,nome,ordem,arquivado,criado_por,created_at,updated_at', order: ['board_id', 'group_id', 'parent_item_id', 'ordem', 'id'] }),
      readRemoteTable('atlas_v2_views', { select: 'id,board_id,nome,tipo,configuracoes,padrao,ordem', order: ['board_id', 'ordem', 'id'] }),
      readRemoteTable('atlas_v2_storage_connections', { order: ['nome', 'id'] }),
      readRemoteAccessRules(),
      readRemoteTable('atlas_v2_board_members', { select: 'board_id,user_id,role', order: ['board_id', 'user_id'] }),
      readRemoteTable('atlas_v2_automations', { order: ['board_id', 'created_at', 'id'] }),
      includeExtras ? readRemoteTable('atlas_v2_field_templates', { order: ['nome', 'id'] }) : Promise.resolve([]),
      includeExtras ? readRemoteTable('atlas_v2_integrations', { order: ['id'] }) : Promise.resolve([]),
    ]);
    if (!workspaceRows.length) return null;

    const local = runtime.data?.workspaces?.length ? runtime.data : loadData();
    // O fallback precisa ser o MESMO quadro que activeBoardId vai receber mais
    // abaixo: o primeiro quadro ativo, do primeiro modulo ativo, da primeira
    // area ativa. Usar boardRows[0] (lista plana ordenada por module_id, um uuid)
    // podia escolher um quadro diferente do que a interface acabaria abrindo, e o
    // prefetch de valores era feito para o quadro errado.
    const firstVisibleBoardId = (() => {
      for (const workspace of workspaceRows.filter((entry) => entry.ativo)) {
        const modules = moduleRows.filter((entry) => entry.ativo && entry.workspace_id === workspace.id);
        for (const module of modules) {
          const board = boardRows.find((entry) => entry.ativo && entry.module_id === module.id);
          if (board) return board.id;
        }
      }
      return boardRows.find((entry) => entry.ativo)?.id || boardRows[0]?.id;
    })();
    const preferredBoardId = boardRows.some((entry) => entry.id === local.activeBoardId)
      ? local.activeBoardId
      : firstVisibleBoardId;
    const activeItemIds = itemRows
      .filter((entry) => entry.board_id === preferredBoardId && !entry.parent_item_id)
      .map((entry) => entry.id);
    const [valueRows, attachmentRows] = await Promise.all([
      readRemoteTableByIds('atlas_v2_item_values', activeItemIds, {
        select: 'id,item_id,column_id,valor,updated_by,created_at,updated_at',
        order: ['item_id', 'column_id', 'id'],
      }),
      includeAttachments
        ? readRemoteTableByIds('atlas_v2_attachments', activeItemIds, {
          order: ['item_id', 'column_id', 'ordem', 'id'],
        })
        : Promise.resolve([]),
    ]);
    const previousAttachmentRows = Array.isArray(runtime.remoteRows?.atlas_v2_attachments) ? runtime.remoteRows.atlas_v2_attachments : [];
    const itemTree = mapRemoteItemTree(itemRows, valueRows);
    const localItems = new Map();
    const visitLocalItems = (items = []) => items.forEach((itemEntry) => {
      localItems.set(itemEntry.id, itemEntry);
      visitLocalItems(itemEntry.subitems || []);
    });
    (local.workspaces || []).forEach((workspace) => (workspace.modules || []).forEach((module) => (module.boards || []).forEach((boardEntry) => (boardEntry.groups || []).forEach((groupEntry) => visitLocalItems(groupEntry.items || [])))));
    // Item ja carregado antes, mas FORA do quadro preferido desta busca (esta
    // rodada nao pediu atlas_v2_item_values dele, entao mapRemoteItemTree o
    // deixou com values={} sem isso refletir o estado real do servidor):
    // recupera do estado local anterior. So itens de fora de activeItemIds -
    // um item QUE FEZ parte desta busca e voltou vazio ficou vazio de
    // verdade (removido), e nao deve ser restaurado - ver comentario no topo
    // da funcao.
    const activeItemIdSet = new Set(activeItemIds.map(String));
    const preservedItemIds = new Set();
    itemTree.forEach((itemEntry, itemId) => {
      if (activeItemIdSet.has(itemId) || !previouslyLoadedItemIds.has(itemId)) return;
      const localItem = localItems.get(itemId);
      if (!localItem) return;
      itemEntry.values = { ...(localItem.values || {}) };
      preservedItemIds.add(itemId);
    });
    if (includeAttachments) {
      mergeRemoteAttachments(itemTree, attachmentRows, columnRows);
    } else {
      const attachmentColumnIds = new Set(columnRows.filter((entry) => ['image', 'file'].includes(entry.tipo)).map((entry) => entry.id));
      itemTree.forEach((itemEntry, itemId) => {
        const localItem = localItems.get(itemId);
        if (!localItem) return;
        attachmentColumnIds.forEach((columnId) => {
          const images = normalizeImageEntries(localItem.values?.[columnId]);
          if (images.length) itemEntry.values[columnId] = images;
        });
      });
    }
    itemTree.forEach((entry) => { entry.subitemsExpanded = false; });
    const indexRows = (rows, keySelector) => {
      const index = new Map();
      rows.forEach((entry) => {
        const key = keySelector(entry);
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(entry);
      });
      return index;
    };
    const viewsByBoard = indexRows(viewRows, (entry) => entry.board_id);
    const columnsByBoard = indexRows(columnRows, (entry) => entry.board_id);
    const groupsByBoard = indexRows(groupRows, (entry) => entry.board_id);
    const topItemsByGroup = indexRows(
      itemRows.filter((entry) => !entry.parent_item_id && !entry.arquivado),
      (entry) => `${entry.board_id}:${entry.group_id}`,
    );
    const modulesByWorkspace = indexRows(
      moduleRows.filter((entry) => entry.ativo !== false),
      (entry) => entry.workspace_id,
    );
    const boardsByModule = indexRows(
      boardRows.filter((entry) => entry.ativo !== false),
      (entry) => entry.module_id,
    );
    // Decide quais visoes um quadro tem, a partir das linhas de atlas_v2_views
    // (remoteViews) e do que estava em configuracoes.views (settingsViews).
    //
    // As visoes padrao (DEFAULT_BOARD_VIEWS) existiam apenas como fallback
    // LOCAL: quadro criado antes da V2.4 nunca ganhou linha em atlas_v2_views
    // para elas. Trocar a lista pela remota, como era feito antes, APAGAVA
    // Tabela/Kanban/Gantt no primeiro sync depois de alguem adicionar qualquer
    // visao nova - e o quadro ficava sem Tabela, aparentando 0 registros, de
    // forma permanente (BUG-03 do QA de 17/08/2026).
    //
    // Unir em vez de substituir e seguro HOJE porque nao existe acao de REMOVER
    // visao - so 'add-view'. Portanto nada aqui pode resucitar uma visao que
    // alguem tenha tirado de proposito.
    // ATENCAO: se algum dia existir "remover visao", esta uniao passa a ser
    // errada. Nesse momento as visoes padrao precisam ganhar linha real em
    // atlas_v2_views na criacao do quadro, e aqui volta a valer a lista remota.
    //
    // Coberto por tests/board-views-unit.cjs.
    function resolveBoardViews(boardViews = [], settings = {}) {
      const remoteViews = boardViews
        .map((view) => view.tipo)
        .filter((type, index, list) => VIEW_TYPES[type] && list.indexOf(type) === index);
      const settingsViews = Array.isArray(settings.views)
        ? settings.views.filter((type) => VIEW_TYPES[type])
        : [];
      const views = [...new Set([...DEFAULT_BOARD_VIEWS, ...settingsViews, ...remoteViews])];
      const marcadaComoPadrao = boardViews.find((view) => view.padrao && VIEW_TYPES[view.tipo])?.tipo;
      // Sem nenhuma linha marcada como `padrao`, cair em views[0] abria o quadro
      // numa visao arbitraria - foi assim que o BUG-03 passou a abrir no
      // Calendario. Tabela e o padrao de board() e a unica visao que lista todos
      // os registros, entao e o destino certo quando nao ha padrao definido.
      const activeView = marcadaComoPadrao || (views.includes('table') ? 'table' : views[0]) || 'table';
      return { views, activeView };
    }

    const boards = new Map(boardRows.map((entry) => {
      const settings = entry.configuracoes && typeof entry.configuracoes === 'object' ? entry.configuracoes : {};
      const boardViews = viewsByBoard.get(entry.id) || [];
      const { views, activeView: resolvedActiveView } = resolveBoardViews(boardViews, settings);
      const boardEntry = board({
        id: entry.id,
        name: entry.nome,
        description: entry.descricao,
        icon: entry.icone,
        access: entry.tipo_acesso,
        official: entry.oficial,
        views,
        activeView: resolvedActiveView,
        columns: (columnsByBoard.get(entry.id) || []).filter((columnEntry) => columnEntry.ativo !== false).map(mapRemoteColumn),
        groups: (groupsByBoard.get(entry.id) || []).map((groupEntry) => ({
          id: groupEntry.id,
          name: groupEntry.nome,
          color: groupEntry.cor,
          collapsed: Boolean(groupEntry.recolhido),
          order: Number(groupEntry.ordem || 0),
          items: (topItemsByGroup.get(`${entry.id}:${groupEntry.id}`) || [])
            .map((itemEntry) => itemTree.get(itemEntry.id))
            .filter(Boolean),
        })),
      });
      boardEntry.origin = entry.origem;
      boardEntry.settings = settings;
      boardEntry.order = Number(entry.ordem || 0);
      boardEntry.active = entry.ativo !== false;
      boardEntry.storageConnectionId = entry.storage_connection_id || null;
      boardEntry.viewIds = Object.fromEntries(boardViews.map((view) => [view.tipo, view.id]));
      return [entry.id, boardEntry];
    }));

    const localBoards = new Map();
    const localModules = new Map();
    (local.workspaces || []).forEach((workspace) => (workspace.modules || []).forEach((module) => {
      localModules.set(module.id, module);
      (module.boards || []).forEach((boardEntry) => localBoards.set(boardEntry.id, boardEntry));
    }));
    const preserveItemExpansion = (remoteItems = [], localItems = []) => {
      const localMap = new Map((localItems || []).map((entry) => [entry.id, entry]));
      (remoteItems || []).forEach((entry) => {
        const localItem = localMap.get(entry.id);
        if (localItem) entry.subitemsExpanded = Boolean(localItem.subitemsExpanded);
        preserveItemExpansion(entry.subitems || [], localItem?.subitems || []);
      });
    };
    boards.forEach((remoteBoard, boardId) => {
      const localBoard = localBoards.get(boardId);
      if (!localBoard) return;
      if ((remoteBoard.views || []).includes(localBoard.activeView)) remoteBoard.activeView = localBoard.activeView;
      const localGroups = new Map((localBoard.groups || []).map((entry) => [entry.id, entry]));
      (remoteBoard.groups || []).forEach((groupEntry) => {
        const localGroup = localGroups.get(groupEntry.id);
        if (localGroup) groupEntry.collapsed = Boolean(localGroup.collapsed);
        preserveItemExpansion(groupEntry.items || [], localGroup?.items || []);
      });
    });

    const workspaces = workspaceRows.map((entry) => ({
      id: entry.id,
      name: entry.nome,
      description: entry.descricao,
      color: entry.cor,
      access: entry.tipo_acesso,
      order: Number(entry.ordem || 0),
      active: entry.ativo !== false,
      storageConnectionId: entry.storage_connection_id || null,
      modules: (modulesByWorkspace.get(entry.id) || []).map((moduleEntry) => ({
        id: moduleEntry.id,
        name: moduleEntry.nome,
        description: moduleEntry.descricao,
        icon: moduleEntry.icone,
        open: Boolean(localModules.get(moduleEntry.id)?.open),
        parentId: moduleEntry.parent_module_id || null,
        order: Number(moduleEntry.ordem || 0),
        active: moduleEntry.ativo !== false,
        storageConnectionId: moduleEntry.storage_connection_id || null,
        boards: (boardsByModule.get(moduleEntry.id) || []).map((boardEntry) => boards.get(boardEntry.id)).filter(Boolean),
      })),
    }));

    const remote = {
      ...local,
      schemaVersion: 2,
      activeWorkspaceId: workspaces.some((entry) => entry.id === local.activeWorkspaceId) ? local.activeWorkspaceId : workspaces[0]?.id,
      // Mantido alinhado com preferredBoardId (acima) para que o prefetch de
      // valores seja feito exatamente para o quadro que sera aberto.
      activeBoardId: boards.has(local.activeBoardId)
        ? local.activeBoardId
        : (boards.has(preferredBoardId) ? preferredBoardId : workspaces[0]?.modules?.[0]?.boards?.[0]?.id),
      workspaces,
      storageConnections: storageRows.map(mapRemoteStorage),
      accessRules: accessRows.map((entry) => ({
        id: entry.id,
        userId: entry.user_id,
        scopeType: entry.item_id ? 'item' : entry.column_id ? 'column' : entry.group_id ? 'group' : entry.board_id ? 'board' : entry.module_id ? 'module' : 'workspace',
        scopeId: entry.item_id || entry.column_id || entry.group_id || entry.board_id || entry.module_id || entry.workspace_id,
        level: entry.nivel,
      })),
      boardMembers: memberRows.map((entry) => ({ boardId: entry.board_id, userId: entry.user_id, role: entry.role })),
      automations: automationRows.map((entry) => ({ id: entry.id, boardId: entry.board_id, name: entry.nome, trigger: entry.gatilho || {}, conditions: Array.isArray(entry.condicoes) ? entry.condicoes : [], actions: Array.isArray(entry.acoes) ? entry.acoes : [], active: entry.ativo !== false, createdBy: entry.criado_por || '', createdAt: entry.created_at, updatedAt: entry.updated_at })),
      fieldTemplates: includeExtras ? fieldRows.map((entry) => ({
        id: entry.id,
        name: entry.nome,
        type: entry.tipo,
        width: Number(entry.largura || 160),
        required: false,
        options: Array.isArray(entry.configuracoes?.options) ? entry.configuracoes.options : [],
        source: entry.categoria || 'Atlas',
        settings: entry.configuracoes || {},
      })) : (local.fieldTemplates || []),
      system: {
        ...(local.system || {}),
        integrations: includeExtras
          ? applyRealtimeIntegrationStatus(integrationRows.map((entry) => ({ id: entry.id, name: entry.nome, status: entry.status, detail: entry.configuracoes?.detail || '' })))
          : applyRealtimeIntegrationStatus(local.system?.integrations || []),
      },
    };
    runtime.remoteMode = true;
    runtime.data = remote;
    runtime.remoteRows = remoteRows(remote);
    runtime.remoteRows.atlas_v2_attachments = includeAttachments ? (attachmentRows || []) : previousAttachmentRows;
    runtime.loadedItemValues = new Set([...activeItemIds.map(String), ...preservedItemIds]);
    // loadedItemValues acabou de ser refeito: os subitens buscados para as
    // formulas de agregacao podem ter saido dele, entao a trava tem de ser
    // liberada para que ensureBoardViewData os busque de novo.
    runtime.aggregationHydratedBoards.clear();
    // Conversa tambem some do cache: outra pessoa pode ter escrito ou
    // apagado mensagem enquanto os dados eram recarregados.
    runtime.chatMessages.clear();
    runtime.chatCounts.clear();
    runtime.chatCountsBoard = null;
    const preferredBoardItemIds = itemRows.filter((entry) => entry.board_id === preferredBoardId).map((entry) => String(entry.id));
    runtime.loadedBoardData = new Set(
      preferredBoardId && preferredBoardItemIds.every((itemId) => runtime.loadedItemValues.has(itemId))
        ? [preferredBoardId]
        : [],
    );
    scheduleBootstrapCacheWrite(remote);
    return remote;
  }

  function allRemoteItems(data = runtime.data) {
    const items = new Map();
    (data?.workspaces || []).forEach((workspace) => (workspace.modules || []).forEach((module) => (module.boards || []).forEach((boardEntry) => {
      (boardEntry.groups || []).forEach((groupEntry) => {
        const visit = (collection) => (collection || []).forEach((itemEntry) => {
          items.set(itemEntry.id, itemEntry);
          visit(itemEntry.subitems);
        });
        visit(groupEntry.items);
      });
    })));
    return items;
  }

  function allRemoteColumns(data = runtime.data) {
    const columns = [];
    (data?.workspaces || []).forEach((workspace) => (workspace.modules || []).forEach((module) => (module.boards || []).forEach((boardEntry) => {
      (boardEntry.columns || []).forEach((columnEntry) => columns.push({ id: columnEntry.id, tipo: columnEntry.type }));
    })));
    return columns;
  }

  async function hydrateDeferredRemoteData() {
    if (!runtime.authClient || !runtime.authSession?.user || runtime.deferredHydration) return;
    runtime.deferredHydration = true;
    try {
      const [fieldRows, integrationRows, activityRows, trashRows] = await Promise.all([
        readRemoteTable('atlas_v2_field_templates', { order: ['nome', 'id'] }),
        readRemoteTable('atlas_v2_integrations', { order: ['id'] }),
        readRemoteTable('atlas_v2_activity', { order: ['created_at', 'id'], ascending: false, maxRows: 400 }),
        readRemoteTable('atlas_v2_trash', { order: ['excluido_em', 'id'], ascending: false, maxRows: 200 }),
      ]);
      runtime.data.fieldTemplates = fieldRows.map((entry) => ({
        id: entry.id,
        name: entry.nome,
        type: entry.tipo,
        width: Number(entry.largura || 160),
        required: false,
        options: Array.isArray(entry.configuracoes?.options) ? entry.configuracoes.options : [],
        source: entry.categoria || 'Atlas',
        settings: entry.configuracoes || {},
      }));
      runtime.data.system = runtime.data.system || {};
      runtime.data.system.integrations = applyRealtimeIntegrationStatus(integrationRows.map((entry) => ({ id: entry.id, name: entry.nome, status: entry.status, detail: entry.configuracoes?.detail || '' })));
      runtime.data.auditLog = activityRows.map(mapRemoteAuditEntry);
      runtime.data.trash = trashRows.map(mapRemoteTrashEntry);
      runtime.deferredHydrated = true;
      runtime.deferredHydrationAttempts = 0;
      scheduleBootstrapCacheWrite(runtime.data);
      render();
    } catch (error) {
      // Falhar aqui deixava histórico, lixeira, integrações e modelos de campo
      // vazios pelo resto da sessão, sem nenhum aviso: o usuário via "não há
      // nada" em vez de "não foi possível carregar". Agora há nova tentativa
      // com espera crescente e um aviso quando as tentativas se esgotam.
      console.error('Atlas V2: falha ao carregar histórico, lixeira e complementos.', error);
      runtime.deferredHydrationAttempts = Number(runtime.deferredHydrationAttempts || 0) + 1;
      if (runtime.deferredHydrationAttempts <= 4) {
        const delay = Math.min(30000, 1500 * (2 ** (runtime.deferredHydrationAttempts - 1)));
        clearTimeout(runtime.deferredHydrationTimer);
        runtime.deferredHydrationTimer = setTimeout(() => { void hydrateDeferredRemoteData(); }, delay);
      } else if (!runtime.deferredHydrationNotified) {
        runtime.deferredHydrationNotified = true;
        toast('Não foi possível carregar histórico, lixeira e integrações. Atualize a página para tentar novamente.', true);
      }
    } finally {
      runtime.deferredHydration = false;
    }
  }

  function flattenRemoteItems(boardEntry) {
    const rows = [];
    const visit = (itemEntry, parentId = null, inheritedGroupId = null, order = 0) => {
      rows.push({ item: itemEntry, parentId, groupId: itemEntry.groupId || inheritedGroupId, order });
      (itemEntry.subitems || []).forEach((child, index) => visit(child, itemEntry.id, itemEntry.groupId || inheritedGroupId, index));
    };
    boardEntry.groups.forEach((groupEntry) => (groupEntry.items || []).forEach((itemEntry, index) => visit(itemEntry, null, groupEntry.id, index)));
    return rows;
  }

  function remoteRows(data = runtime.data) {
    const rows = {
      atlas_v2_storage_connections: [], atlas_v2_workspaces: [], atlas_v2_modules: [], atlas_v2_boards: [],
      atlas_v2_groups: [], atlas_v2_columns: [], atlas_v2_items: [], atlas_v2_item_values: [], atlas_v2_views: [],
      atlas_v2_access_rules: [], atlas_v2_board_members: [], atlas_v2_automations: [], atlas_v2_field_templates: [],
    };
    (data.storageConnections || []).forEach((entry) => rows.atlas_v2_storage_connections.push({
      id: entry.id, nome: entry.name || 'Drive do setor', setor: entry.sector || 'Geral', account_email: entry.accountEmail || '',
      folder_id: entry.folderId || '', folder_url: entry.folderUrl || '', app_script_url: entry.appScriptUrl || '',
      status: entry.status || 'pending', connector_version: entry.connectorVersion || '', verificado_em: entry.verifiedAt || null,
      tipo: storageType(entry),
    }));
    (data.workspaces || []).forEach((workspace, workspaceOrder) => {
      rows.atlas_v2_workspaces.push({ id: workspace.id, nome: workspace.name, descricao: workspace.description || '', cor: workspace.color || '#0f6cbd', tipo_acesso: workspace.access || 'main', ativo: workspace.active !== false, ordem: workspace.order ?? workspaceOrder, storage_connection_id: workspace.storageConnectionId || null });
      (workspace.modules || []).forEach((module, moduleOrder) => {
        rows.atlas_v2_modules.push({ id: module.id, workspace_id: workspace.id, parent_module_id: module.parentId || null, nome: module.name, descricao: module.description || '', icone: module.icon || 'folder', ordem: module.order ?? moduleOrder, ativo: module.active !== false, storage_connection_id: module.storageConnectionId || null });
        (module.boards || []).forEach((boardEntry, boardOrder) => {
          rows.atlas_v2_boards.push({ id: boardEntry.id, module_id: module.id, nome: boardEntry.name, descricao: boardEntry.description || '', icone: boardEntry.icon || 'table-2', tipo_acesso: boardEntry.access || 'main', origem: boardEntry.origin || (boardEntry.official ? 'official' : 'custom'), configuracoes: boardEntry.settings || {}, oficial: Boolean(boardEntry.official), ativo: boardEntry.active !== false, ordem: boardEntry.order ?? boardOrder, storage_connection_id: boardEntry.storageConnectionId || null });
          (boardEntry.groups || []).forEach((groupEntry, groupOrder) => rows.atlas_v2_groups.push({ id: groupEntry.id, board_id: boardEntry.id, nome: groupEntry.name, cor: groupEntry.color || '#0f6cbd', recolhido: Boolean(groupEntry.collapsed), ordem: groupEntry.order ?? groupOrder }));
          (boardEntry.columns || []).forEach((columnEntry, columnOrder) => rows.atlas_v2_columns.push({ id: columnEntry.id, board_id: boardEntry.id, nome: columnEntry.name, tipo: columnEntry.type, configuracoes: { ...(columnEntry.settings || {}), options: columnEntry.options || [], formula: columnEntry.formula || '', format: columnEntry.format || 'number', decimals: Number(columnEntry.decimals ?? 2), versionado: columnEntry.versioned === true }, largura: Number(columnEntry.width || 160), obrigatorio: Boolean(columnEntry.required), ativo: columnEntry.active !== false, ordem: columnEntry.order ?? columnOrder }));
          const columnTypes = new Map((boardEntry.columns || []).map((columnEntry) => [columnEntry.id, columnEntry.type]));
          flattenRemoteItems(boardEntry).forEach(({ item: itemEntry, parentId, groupId, order }) => {
            rows.atlas_v2_items.push({ id: itemEntry.id, board_id: boardEntry.id, group_id: groupId || null, parent_item_id: parentId, nome: itemEntry.name || 'Novo item', ordem: itemEntry.order ?? order, arquivado: Boolean(itemEntry.archived) });
            Object.entries(itemEntry.values || {}).forEach(([columnId, value]) => {
              let remoteValue = value;
              if (['image', 'file'].includes(columnTypes.get(columnId))) {
                const originalEntries = parseImageValue(value);
                const editableEntries = originalEntries.filter((entry) => !(entry && typeof entry === 'object' && (entry._attachmentSource || entry.attachmentBacked || entry.migrated)));
                if (originalEntries.length && !editableEntries.length) return;
                remoteValue = editableEntries;
              }
              if (remoteValue === undefined || remoteValue === null || remoteValue === '' || (Array.isArray(remoteValue) && !remoteValue.length)) return;
              rows.atlas_v2_item_values.push({ item_id: itemEntry.id, column_id: columnId, valor: remoteValue });
            });
          });
          (boardEntry.views || []).forEach((type, viewOrder) => {
            boardEntry.viewIds = boardEntry.viewIds || {};
            boardEntry.viewIds[type] = boardEntry.viewIds[type] || id('view');
            rows.atlas_v2_views.push({ id: boardEntry.viewIds[type], board_id: boardEntry.id, nome: VIEW_TYPES[type]?.label || type, tipo: type, configuracoes: {}, padrao: type === boardEntry.views[0], ordem: viewOrder });
          });
        });
      });
    });
    (data.accessRules || []).forEach((entry) => {
      if (runtime.accessRuleScopeColumnsSupported === false && ['group', 'column', 'item'].includes(entry.scopeType)) return;
      if (runtime.accessRuleItemColumnSupported === false && entry.scopeType === 'item') return;
      const rule = {
        id: entry.id,
        user_id: entry.userId,
        workspace_id: entry.scopeType === 'workspace' ? entry.scopeId : null,
        module_id: entry.scopeType === 'module' ? entry.scopeId : null,
        board_id: entry.scopeType === 'board' ? entry.scopeId : null,
        nivel: entry.level,
      };
      if (runtime.accessRuleScopeColumnsSupported !== false) {
        rule.group_id = entry.scopeType === 'group' ? entry.scopeId : null;
        rule.column_id = entry.scopeType === 'column' ? entry.scopeId : null;
      }
      if (runtime.accessRuleItemColumnSupported !== false) {
        rule.item_id = entry.scopeType === 'item' ? entry.scopeId : null;
      }
      rows.atlas_v2_access_rules.push(rule);
    });
    (data.boardMembers || []).forEach((entry) => rows.atlas_v2_board_members.push({ board_id: entry.boardId, user_id: entry.userId, role: entry.role }));
    (data.automations || []).forEach((entry) => rows.atlas_v2_automations.push({ id: entry.id, board_id: entry.boardId, nome: entry.name || 'Automação', gatilho: entry.trigger || {}, condicoes: Array.isArray(entry.conditions) ? entry.conditions : [], acoes: Array.isArray(entry.actions) ? entry.actions : [], ativo: entry.active !== false, criado_por: entry.createdBy || runtime.data.currentUserId || null }));
    (data.fieldTemplates || []).filter((entry) => /^[0-9a-f-]{36}$/i.test(entry.id)).forEach((entry) => rows.atlas_v2_field_templates.push({ id: entry.id, nome: entry.name, tipo: entry.type, categoria: entry.source || 'Geral', configuracoes: { ...(entry.settings || {}), options: entry.options || [] }, largura: Number(entry.width || 160), publico: true, ativo: true }));
    return rows;
  }

  function remoteKey(table, row) {
    if (table === 'atlas_v2_item_values') return `${row.item_id}:${row.column_id}`;
    if (table === 'atlas_v2_board_members') return `${row.board_id}:${row.user_id}`;
    return row.id;
  }

  function remoteMap(table, rows) {
    return new Map((rows || []).map((row) => [remoteKey(table, row), JSON.stringify(row)]));
  }

  function scheduleRemoteSync() {
    if (!runtime.remoteMode || !runtime.authClient) return;
    clearTimeout(runtime.remoteSyncTimer);
    // O timer precisa voltar a null AO DISPARAR. setTimeout devolve um id
    // truthy, e varios pontos leem runtime.remoteSyncTimer como "ha um envio
    // pendente" - flushRealtimePayloads, refreshRemoteApplication e o proprio
    // reagendamento pos-flush. Sem zerar aqui, o id de um timer JA CONSUMIDO
    // ficava para sempre em runtime.remoteSyncTimer depois do primeiro envio
    // da sessao, e essas guardas passavam a valer para sempre: o caminho leve
    // de tempo real (patch incremental de itens, valores, anexos) era adiado
    // de 120 em 120ms indefinidamente e NUNCA aplicava, deixando tudo cair no
    // caminho pesado (recarga completa) - justamente o que ele existe para
    // evitar.
    runtime.remoteSyncTimer = setTimeout(() => {
      runtime.remoteSyncTimer = null;
      void syncRemoteData();
    }, 70);
  }

  function replaceRemoteBaselineRow(table, row) {
    if (!runtime.remoteRows || !Array.isArray(runtime.remoteRows[table]) || !row) return;
    const key = remoteKey(table, row);
    const index = runtime.remoteRows[table].findIndex((entry) => remoteKey(table, entry) === key);
    if (index >= 0) runtime.remoteRows[table][index] = row;
    else runtime.remoteRows[table].push(row);
  }

  function updateRemoteBaselineFromItemContext(itemContext) {
    if (!itemContext?.itemId || !runtime.remoteRows) return;
    const itemId = String(itemContext.itemId);
    const existingItem = (runtime.remoteRows.atlas_v2_items || []).find((entry) => entry.id === itemId) || {};
    replaceRemoteBaselineRow('atlas_v2_items', {
      ...existingItem,
      id: itemId,
      board_id: String(itemContext.boardId || existingItem.board_id || ''),
      group_id: itemContext.groupId ? String(itemContext.groupId) : null,
      parent_item_id: itemContext.parentItemId ? String(itemContext.parentItemId) : null,
      nome: String(itemContext.name || existingItem.nome || 'Novo item'),
      ordem: Number(itemContext.order ?? existingItem.ordem ?? 0),
      arquivado: Boolean(itemContext.archived),
    });

    runtime.remoteRows.atlas_v2_item_values = (runtime.remoteRows.atlas_v2_item_values || []).filter((entry) => entry.item_id !== itemId);
    Object.entries(itemContext.values || {}).forEach(([columnId, value]) => {
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return;
      const boardEntry = findBoard(itemContext.boardId || existingItem.board_id || '')?.board;
      const columnEntry = boardEntry?.columns?.find((entry) => entry.id === columnId);
      const storedValue = ['image', 'file'].includes(columnEntry?.type)
        ? normalizeImageEntries(value).filter((entry) => !(entry?._attachmentSource || entry?.attachmentBacked))
        : value;
      if (storedValue === '' || (Array.isArray(storedValue) && !storedValue.length)) return;
      runtime.remoteRows.atlas_v2_item_values.push({ item_id: itemId, column_id: columnId, valor: storedValue });
    });
  }

  function mergeContextValues(boardEntry, itemEntry, values = {}) {
    Object.entries(values || {}).forEach(([columnId, value]) => {
      const columnEntry = boardEntry.columns.find((entry) => entry.id === columnId);
      if (['image', 'file'].includes(columnEntry?.type)) {
        const current = normalizeImageEntries(itemEntry.values?.[columnId]);
        const incoming = normalizeImageEntries(value);
        const signature = (entry) => String(entry?.fileId || entry?.viewUrl || entry?.url || entry?.thumbnailUrl || entry || '');
        itemEntry.values[columnId] = [...current, ...incoming.filter((entry) => !current.some((candidate) => signature(candidate) === signature(entry)))];
      } else {
        itemEntry.values[columnId] = value;
      }
    });
  }

  function applyRemoteItemContext(boardEntry, itemContext, childContexts = []) {
    if (!boardEntry || !itemContext?.itemId) return;
    const itemId = String(itemContext.itemId);
    let found = findItem(boardEntry, itemId);
    if (!found) return;

    if (itemContext.archived) {
      const index = found.collection.indexOf(found.item);
      if (index >= 0) found.collection.splice(index, 1);
      updateRemoteBaselineFromItemContext(itemContext);
      return;
    }

    const targetGroupId = String(itemContext.groupId || found.item.groupId || '');
    if (!found.parent && targetGroupId && found.group.id !== targetGroupId) {
      const targetGroup = boardEntry.groups.find((entry) => entry.id === targetGroupId);
      if (targetGroup) {
        const index = found.collection.indexOf(found.item);
        if (index >= 0) found.collection.splice(index, 1);
        found.item.groupId = targetGroupId;
        targetGroup.items.push(found.item);
        found = findItem(boardEntry, itemId) || found;
      }
    }

    found.item.groupId = targetGroupId;
    found.item.name = String(itemContext.name || found.item.name || 'Novo item');
    found.item.order = Number(itemContext.order ?? found.item.order ?? 0);
    found.item.archived = false;
    mergeContextValues(boardEntry, found.item, itemContext.values || {});

    if (Array.isArray(childContexts)) {
      const existingChildren = new Map((found.item.subitems || []).map((entry) => [entry.id, entry]));
      found.item.subitems = childContexts.map((childContext) => {
        const childId = String(childContext.itemId || '');
        const child = existingChildren.get(childId) || item(childId, targetGroupId, String(childContext.name || 'Novo subitem'), {});
        child.groupId = String(childContext.groupId || targetGroupId);
        child.parentId = itemId;
        child.name = String(childContext.name || child.name || 'Novo subitem');
        child.order = Number(childContext.order ?? child.order ?? 0);
        child.archived = Boolean(childContext.archived);
        mergeContextValues(boardEntry, child, childContext.values || {});
        updateRemoteBaselineFromItemContext(childContext);
        return child;
      }).filter((entry) => !entry.archived);
    }

    updateRemoteBaselineFromItemContext(itemContext);
  }

  async function commitRemoteItemValueChange(context, found, columnEntry, previousValue, nextValue) {
    if (!runtime.authClient || !runtime.remoteMode) return false;
    // Havia uma sincronizacao geral agendada? Ela e cancelada aqui de proposito,
    // para nao reenviar o quadro inteiro junto com esta RPC. Mas precisa ser
    // reagendada no final: outras alteracoes pendentes (renomear grupo, mover
    // coluna, reordenar) ficariam sem nenhum timer ativo e seriam perdidas se a
    // aba fosse fechada antes de outro evento agendar um novo envio.
    // Reagendar e seguro porque applyRemoteItemContext atualiza a baseline
    // remota com o resultado da RPC, entao o diff deste item fica vazio.
    const hadPendingSync = Boolean(runtime.remoteSyncTimer);
    clearTimeout(runtime.remoteSyncTimer);
    runtime.remoteSyncTimer = null;
    try {
      return await runCommitRemoteItemValueChange(context, found, columnEntry, previousValue, nextValue);
    } finally {
      if (hadPendingSync || runtime.remoteSyncQueued) {
        runtime.remoteSyncQueued = false;
        scheduleRemoteSync();
      }
    }
  }

  async function runCommitRemoteItemValueChange(context, found, columnEntry, previousValue, nextValue) {
    for (let attempt = 0; runtime.remoteSyncing && attempt < 100; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (runtime.remoteSyncing) throw new Error('A sincronização anterior ainda está em andamento. Tente novamente.');

    const beforeGroupId = String(found.item.groupId || '');
    const beforeParentId = String(found.item.parentId || '');
    const beforeName = String(found.item.name || '');
    const beforeChildren = (found.item.subitems || []).map((entry) => String(entry.id)).join('|');

    const { data, error } = await runtime.authClient.rpc('atlas_v2_apply_item_value_change', {
      target_item: found.item.id,
      target_column: columnEntry.id,
      target_value: nextValue,
    });
    if (error) throw error;
    if (!data?.success) {
      const automationError = data?.automation_result?.error || data?.error || 'A alteração não pôde ser aplicada.';
      throw new Error(automationError);
    }

    applyRemoteItemContext(context.board, data.item_context, data.children || []);
    recordAudit('Campo atualizado', { boardId: context.board.id });
    saveData('', { remote: false, audit: false });

    const refreshed = findItem(context.board, found.item.id);
    const executed = Number(data.automation_result?.executed || 0);
    const failed = Number(data.automation_result?.failed || 0);
    const afterGroupId = String(refreshed?.item?.groupId || data.item_context?.groupId || '');
    const afterParentId = String(refreshed?.item?.parentId || data.item_context?.parentItemId || '');
    const afterName = String(refreshed?.item?.name || data.item_context?.name || '');
    const afterChildren = (refreshed?.item?.subitems || []).map((entry) => String(entry.id)).join('|');
    const structuralChange = beforeGroupId !== afterGroupId
      || beforeParentId !== afterParentId
      || beforeName !== afterName
      || beforeChildren !== afterChildren
      || executed > 0;

    const patchContext = refreshed ? { ...context, found: refreshed } : context;
    if (structuralChange || !patchRealtimeValueCell(patchContext, columnEntry.id)) {
      renderBoardContent(context.board);
      renderSelection(context.board);
      applyPermissionUi(context);
      refreshIcons(document.getElementById('atlas-v2-board-content') || document);
    }

    const finalGroupId = String(data.item_context?.groupId || '');
    const finalGroupName = context.board.groups.find((entry) => entry.id === finalGroupId)?.name || '';
    if (failed > 0) toast('O campo foi salvo, mas uma ação da automação falhou. Consulte o histórico.', true);
    else if (executed > 0) toast(finalGroupName ? `Automação aplicada: item movido para ${finalGroupName}.` : 'Automação aplicada ao item.');

    // A RPC já gravou o campo e as ações de forma atômica. Não reenviar o
    // quadro inteiro, pois um snapshot antigo poderia restaurar o setor anterior.
    return true;
  }

  async function refreshAutomationEffectsAfterSync(changes, syncStartedAt) {
    if (!runtime.authClient || !runtime.authSession?.user) return false;
    const itemIds = [...new Set([
      ...(changes.atlas_v2_item_values || []).map((entry) => entry.item_id),
      ...(changes.atlas_v2_items || []).map((entry) => entry.id),
    ].filter(Boolean))];
    if (!itemIds.length) return false;

    try {
      const since = new Date(Math.max(0, syncStartedAt.getTime() - 5000)).toISOString();
      const data = [];
      for (let index = 0; index < itemIds.length; index += 100) {
        const { data: page, error } = await runtime.authClient
          .from('atlas_v2_automation_runs')
          .select('id,item_id,status,error_message,created_at')
          .in('item_id', itemIds.slice(index, index + 100))
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        data.push(...(page || []));
      }
      data.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      if (!data.length) return false;

      const newest = data[0]?.created_at ? String(data[0].created_at) : '';
      if (newest) runtime.lastAutomationRunAt = newest;
      const failedRun = data.find((entry) => entry.status === 'failed');
      const successfulRun = data.find((entry) => entry.status === 'success');

      if (failedRun) {
        toast(`Falha na automação: ${failedRun.error_message || 'ação não concluída'}`, true);
      }
      if (!successfulRun) return false;

      await refreshRemoteApplication(runtime.authProfile, runtime.authSession?.user, { full: false, silent: true });
      toast('Automação aplicada ao quadro.');
      return true;
    } catch (error) {
      console.warn('Atlas V2: não foi possível atualizar imediatamente o resultado da automação.', error);
      return false;
    }
  }


  function stableRemoteValue(value) {
    if (Array.isArray(value)) return value.map(stableRemoteValue);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((result, key) => {
        result[key] = stableRemoteValue(value[key]);
        return result;
      }, {});
    }
    return value;
  }

  function stableRemoteString(value) {
    return JSON.stringify(stableRemoteValue(value));
  }

  function projectRemoteRow(template, row) {
    if (!template || !row) return null;
    return Object.keys(template).reduce((result, key) => {
      result[key] = row[key] === undefined ? null : row[key];
      return result;
    }, {});
  }

  async function fetchCurrentRemoteRows(table, templateRows) {
    const rows = (templateRows || []).filter(Boolean);
    if (!rows.length) return [];
    const output = [];
    if (table === 'atlas_v2_item_values') {
      const itemIds = [...new Set(rows.map((row) => row.item_id).filter(Boolean))];
      for (let index = 0; index < itemIds.length; index += 75) {
        const { data, error } = await runtime.authClient.from(table).select('*').in('item_id', itemIds.slice(index, index + 75));
        if (error) throw error;
        output.push(...(data || []));
      }
      const keys = new Set(rows.map((row) => remoteKey(table, row)));
      return output.filter((row) => keys.has(remoteKey(table, row)));
    }
    if (table === 'atlas_v2_board_members') {
      const boardIds = [...new Set(rows.map((row) => row.board_id).filter(Boolean))];
      for (let index = 0; index < boardIds.length; index += 75) {
        const { data, error } = await runtime.authClient.from(table).select('*').in('board_id', boardIds.slice(index, index + 75));
        if (error) throw error;
        output.push(...(data || []));
      }
      const keys = new Set(rows.map((row) => remoteKey(table, row)));
      return output.filter((row) => keys.has(remoteKey(table, row)));
    }
    const ids = [...new Set(rows.map((row) => row.id).filter(Boolean))];
    for (let index = 0; index < ids.length; index += 75) {
      const { data, error } = await runtime.authClient.from(table).select('*').in('id', ids.slice(index, index + 75));
      if (error) throw error;
      output.push(...(data || []));
    }
    return output;
  }

  async function verifyRemoteSyncConflicts(table, changedRows, removalKeys, previousRows) {
    const previousByKey = new Map((previousRows || []).map((row) => [remoteKey(table, row), row]));
    const templates = [
      ...(changedRows || []),
      ...(removalKeys || []).map((key) => previousByKey.get(key)).filter(Boolean),
    ];
    if (!templates.length) return [];
    const currentRows = await fetchCurrentRemoteRows(table, templates);
    if (table === 'atlas_v2_columns') {
      // Colunas antigas foram gravadas com "configuracoes" enxuto (ex.: {}),
      // mas remoteRows() sempre reconstroi esse campo com os valores padrao
      // que mapRemoteColumn aplicaria (options/formula/format/decimals -
      // inclusive as 5 opcoes padrao de status quando a coluna e do tipo
      // "status" e nao tem opcoes salvas). Sem reaplicar exatamente essa
      // mesma reconstrucao aqui, a comparacao abaixo comparava o "{}" cru do
      // banco com a versao expandida e ACHAVA um conflito em toda edicao
      // dessas colunas antigas (renomear, reordenar, etc.), mesmo sem
      // ninguem mais ter alterado nada - cancelando a sincronizacao inteira.
      currentRows.forEach((row) => {
        const mapped = mapRemoteColumn(row);
      row.configuracoes = {
          ...(mapped.settings || {}),
          options: mapped.options || [],
          formula: mapped.formula || '',
          format: mapped.format || 'number',
          decimals: Number(mapped.decimals ?? 2),
          versionado: mapped.versioned === true,
        };
      });
    }
    const currentByKey = new Map(currentRows.map((row) => [remoteKey(table, row), row]));
    const conflicts = [];

    (changedRows || []).forEach((desired) => {
      const key = remoteKey(table, desired);
      const baseline = previousByKey.get(key);
      const current = currentByKey.get(key);
      if (!baseline) {
        if (current && stableRemoteString(projectRemoteRow(desired, current)) !== stableRemoteString(desired)) conflicts.push(key);
        return;
      }
      if (!current) {
        conflicts.push(key);
        return;
      }
      const currentProjected = projectRemoteRow(baseline, current);
      const serverMatchesBaseline = stableRemoteString(currentProjected) === stableRemoteString(baseline);
      const serverAlreadyMatchesDesired = stableRemoteString(projectRemoteRow(desired, current)) === stableRemoteString(desired);
      if (!serverMatchesBaseline && !serverAlreadyMatchesDesired) conflicts.push(key);
    });

    (removalKeys || []).forEach((key) => {
      const baseline = previousByKey.get(key);
      const current = currentByKey.get(key);
      if (!current || !baseline) return;
      if (stableRemoteString(projectRemoteRow(baseline, current)) !== stableRemoteString(baseline)) conflicts.push(key);
    });
    return conflicts;
  }

  async function syncRemoteData() {
    if (!runtime.remoteMode || !runtime.authClient || !runtime.data) return false;
    if (runtime.bootstrapRefreshing || !runtime.remoteReady) {
      runtime.remoteSyncQueued = true;
      return false;
    }
    if (runtime.remoteSyncing) { runtime.remoteSyncQueued = true; return false; }
    const syncStartedAt = new Date();
    const next = remoteRows(runtime.data);
    const previous = runtime.remoteRows || {};
    const changes = {};
    const removals = {};
    Object.keys(next).forEach((table) => {
      const before = remoteMap(table, previous[table]);
      const after = remoteMap(table, next[table]);
      changes[table] = next[table].filter((row) => before.get(remoteKey(table, row)) !== JSON.stringify(row));
      removals[table] = [...before.keys()].filter((key) => {
        if (after.has(key)) return false;
        // CRITICO: remoteRows(runtime.data) percorre TODA a arvore de dados em
        // memoria, mas o carregamento sob demanda (V2.2.0) deixa os valores de
        // itens nao abertos nesta sessao vazios ({}) ate serem hidratados. Sem
        // esta guarda, um sync disparado por QUALQUER acao (duplicar, mover,
        // restaurar da lixeira) apagava de verdade, no Supabase, os valores de
        // itens que o usuario simplesmente nunca abriu nesta sessao -
        // confundindo "nao carregado" com "usuario apagou o campo". So um item
        // presente em runtime.loadedItemValues teve seus valores efetivamente
        // buscados do servidor, e so nesse caso a ausencia de uma chave aqui
        // reflete uma remocao real feita pelo usuario.
        if (table === 'atlas_v2_item_values') {
          const itemId = key.split(':')[0];
          if (!runtime.loadedItemValues.has(itemId)) return false;
        }
        return true;
      });
    });
    if (runtime.authProfile?.role !== 'admin') {
      ['atlas_v2_storage_connections', 'atlas_v2_access_rules', 'atlas_v2_board_members', 'atlas_v2_field_templates'].forEach((table) => {
        changes[table] = [];
        removals[table] = [];
      });
    }
    if (!Object.values(changes).some((entries) => entries.length) && !Object.values(removals).some((entries) => entries.length)) return true;

    runtime.remoteSyncing = true;
    const indicator = document.getElementById('atlas-v2-save-state');
    if (indicator) indicator.innerHTML = '<i data-lucide="loader-circle"></i>Validando alterações';
    const totalUnits = Math.max(1, Object.values(changes).flat().length + Object.values(removals).flat().length);
    let completedUnits = 0;
    const advanceSyncProgress = (label, units = 0) => {
      completedUnits += Number(units) || 0;
      const percent = 8 + (completedUnits / totalUnits) * 84;
      setOperationProgress(label, percent, `${Math.min(completedUnits, totalUnits)} de ${totalUnits} alteração(ões)`);
    };
    setOperationProgress('Validando alterações', 4, `${totalUnits} alteração(ões) na fila`);
    let conflictDetected = false;
    try {
      const conflictResults = await Promise.all(Object.keys(next)
        .filter((table) => changes[table]?.length || removals[table]?.length)
        .map(async (table) => ({
          table,
          conflicts: await verifyRemoteSyncConflicts(table, changes[table], removals[table], previous[table]),
        })));
      const conflictEntries = conflictResults.flatMap(({ table, conflicts }) => conflicts.map((key) => `${table}:${key}`));
      if (conflictEntries.length) {
        conflictDetected = true;
        runtime.remoteReady = false;
        runtime.remoteRefreshQueued = true;
        if (indicator) indicator.innerHTML = '<i data-lucide="shield-alert"></i>Atualização concorrente detectada';
        setOperationProgress('Atualização concorrente detectada', 100, 'Os dados mais recentes do servidor serão carregados.');
        clearOperationProgress(2500);
        toast('Outro usuário atualizou esses dados antes do seu salvamento. A versão mais recente foi preservada; aguarde a atualização e refaça somente a sua alteração.', true);
        return false;
      }

      if (indicator) indicator.innerHTML = '<i data-lucide="loader-circle"></i>Sincronizando';
      const { data: batchResult, error: batchError } = await runtime.authClient.rpc('atlas_v2_apply_sync_batch', {
        p_changes: changes,
        p_removals: removals,
      });
      if (batchError) throw batchError;
      if (!batchResult?.success || Number(batchResult.applied) !== totalUnits) {
        throw new Error('O servidor não confirmou o lote completo. Nenhuma alteração foi aplicada.');
      }
      advanceSyncProgress('Aplicando lote atômico', totalUnits);
      const attachmentBaseline = Array.isArray(runtime.remoteRows?.atlas_v2_attachments)
        ? runtime.remoteRows.atlas_v2_attachments
        : [];
      runtime.remoteRows = next;
      runtime.remoteRows.atlas_v2_attachments = attachmentBaseline;
      const automationApplied = await refreshAutomationEffectsAfterSync(changes, syncStartedAt);
      // "cloud-check" nao existe na versao do Lucide empacotada: o icone nao era
      // desenhado e o console acusava o nome invalido a cada sincronizacao.
      if (indicator) indicator.innerHTML = `<i data-lucide="circle-check-big"></i>${automationApplied ? 'Automação aplicada' : 'Alterações sincronizadas'}`;
      setOperationProgress('Sincronização concluída', 100, `${totalUnits} alteração(ões) enviada(s)`);
      clearOperationProgress();
      return true;
    } catch (error) {
      console.error('Atlas V2: falha ao sincronizar dados operacionais.', error);
      if (indicator) indicator.innerHTML = '<i data-lucide="cloud-alert"></i>Falha ao sincronizar';
      setOperationProgress('Falha na sincronização', 100, error.message || String(error));
      clearOperationProgress(2500);
      toast(`Falha ao sincronizar com o Supabase: ${error.message || error}`, true);
      return false;
    } finally {
      runtime.remoteSyncing = false;
      refreshIcons(indicator || document);
      if (conflictDetected) {
        runtime.remoteSyncQueued = false;
        runtime.remoteRefreshQueued = false;
        setTimeout(() => refreshRemoteApplication(runtime.authProfile, runtime.authSession?.user, { full: false, silent: true }), 150);
      } else if (runtime.remoteSyncQueued) {
        runtime.remoteSyncQueued = false;
        scheduleRemoteSync();
      } else if (runtime.remoteRefreshQueued && runtime.remoteReady) {
        runtime.remoteRefreshQueued = false;
        setTimeout(() => refreshRemoteApplication(runtime.authProfile, runtime.authSession?.user, { full: false, silent: true }), 250);
      }
    }
  }

  function persistAuditEntry(entry) {
    if (!runtime.authClient || !runtime.remoteMode || !runtime.authSession?.user || !entry) return Promise.resolve(null);
    const row = {
      board_id: entry.boardId || null,
      item_id: null,
      user_id: runtime.authSession.user.id,
      acao: entry.action,
      detalhes: {
        workspaceId: entry.workspaceId || '',
        moduleId: entry.moduleId || '',
        boardId: entry.boardId || '',
        itemId: entry.itemId || '',
        scope: entry.scope || 'system',
      },
    };
    runtime.auditQueue = runtime.auditQueue
      .catch(() => null)
      .then(async () => {
        const { data, error } = await runtime.authClient
          .from('atlas_v2_activity')
          .insert(row)
          .select('*')
          .single();
        if (error) throw error;
        if (data) Object.assign(entry, mapRemoteAuditEntry(data));
        return data;
      })
      .catch((error) => {
        console.error('Atlas V2: falha ao persistir auditoria.', error);
        runtime.data.errors = Array.isArray(runtime.data.errors) ? runtime.data.errors : [];
        runtime.data.errors.unshift({
          id: id('error'),
          title: 'Auditoria pendente',
          detail: error.message || String(error),
          createdAt: new Date().toISOString(),
        });
        return null;
      });
    return runtime.auditQueue;
  }

  function recordAudit(action, details = {}) {
    if (!runtime.data || !action) return null;
    const context = findBoard();
    runtime.data.auditLog = Array.isArray(runtime.data.auditLog) ? runtime.data.auditLog : [];
    const entry = {
      id: id('audit'),
      userId: runtime.data.currentUserId || '',
      action,
      workspaceId: details.workspaceId || context?.workspace?.id || '',
      moduleId: details.moduleId || context?.module?.id || '',
      boardId: details.boardId || context?.board?.id || '',
      itemId: details.itemId || '',
      scope: details.scope || (context?.board ? 'board' : 'system'),
      createdAt: new Date().toISOString(),
    };
    runtime.data.auditLog.unshift(entry);
    runtime.data.auditLog = runtime.data.auditLog.slice(0, 400);
    void persistAuditEntry(entry);
    return entry;
  }

  function captureItemHistory(boardEntry, itemEntry, columnId, beforeValue, afterValue, label = 'Campo atualizado') {
    if (!runtime.data || !boardEntry || !itemEntry || stableRemoteString(beforeValue) === stableRemoteString(afterValue)) return null;
    runtime.data.itemHistory = Array.isArray(runtime.data.itemHistory) ? runtime.data.itemHistory : [];
    const entry = {
      id: id('history'),
      boardId: boardEntry.id,
      itemId: itemEntry.id,
      columnId: columnId || '__name__',
      beforeValue: deepClone(beforeValue ?? null),
      afterValue: deepClone(afterValue ?? null),
      label,
      userId: currentUser()?.id || '',
      createdAt: new Date().toISOString(),
    };
    runtime.data.itemHistory.unshift(entry);
    runtime.data.itemHistory = runtime.data.itemHistory.slice(0, 1000);
    if (runtime.remoteMode && runtime.authClient && isUuid(boardEntry.id) && isUuid(itemEntry.id)) {
      void runtime.authClient.from('atlas_v2_item_history').insert({
        id: isUuid(entry.id) ? entry.id : undefined,
        board_id: boardEntry.id,
        item_id: itemEntry.id,
        column_id: isUuid(columnId) ? columnId : null,
        field_key: columnId || '__name__',
        before_value: beforeValue ?? null,
        after_value: afterValue ?? null,
        action_label: label,
      }).then(({ data, error }) => {
        if (error) console.warn('Atlas V2.1: histórico remoto pendente.', error);
        return data;
      });
    }
    return entry;
  }

  // ---------------------------------------------------------------------------
  // V2.4 - Conversa do elemento.
  //
  // As mensagens ficam em runtime.chatMessages (por item) e sao buscadas do
  // Supabase ao abrir a conversa. Nao entram em runtime.data porque nao fazem
  // parte do "documento" do quadro: nao vao para o backup local nem para o
  // diff de sincronizacao, sao apenas conversa.
  // ---------------------------------------------------------------------------
  function itemChatCount(itemId) {
    const key = String(itemId);
    // Se a conversa ja foi aberta nesta sessao, o valor exato vem dela (fica
    // certo na hora em que a pessoa envia ou apaga). Senao cai no contador do
    // quadro, carregado uma vez por abertura - sem ele o numero sumia do icone
    // a cada recarga, ate abrir cada conversa uma por uma.
    if (runtime.chatMessages?.has(key)) return runtime.chatMessages.get(key).length;
    return runtime.chatCounts?.get(key) || 0;
  }

  async function applyRealtimeMessagePayload(payload = {}) {
    const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    const itemId = String(row?.item_id || '');
    const boardId = String(row?.board_id || '');
    if (!itemId) return;

    if (runtime.chatMessages?.has(itemId)) {
      await loadItemChat(itemId);
      if (String(runtime.chatItemId || '') === itemId) renderItemChat(itemId);
    } else {
      const current = Number(runtime.chatCounts?.get(itemId) || 0);
      const next = payload.eventType === 'DELETE'
        ? Math.max(0, current - 1)
        : payload.eventType === 'INSERT' ? current + 1 : current;
      runtime.chatCounts.set(itemId, next);
    }
    if (payload.eventType === 'INSERT') void refreshNotifications();
    if (runtime.page === 'board' && boardId === String(runtime.data?.activeBoardId || '')) {
      renderBoardContent(findBoard()?.board);
    }
  }

  // Uma consulta por quadro trazendo so o item_id de cada mensagem: o suficiente
  // para o contador do icone, sem baixar o texto das conversas.
  async function loadBoardChatCounts(boardId) {
    if (!runtime.authClient || !runtime.remoteMode || !isUuid(boardId)) return;
    if (runtime.chatCountsBoard === boardId) return;
    runtime.chatCountsBoard = boardId;
    const { data, error } = await runtime.authClient
      .from('atlas_v2_item_messages')
      .select('item_id')
      .eq('board_id', boardId)
      .limit(5000);
    if (error) {
      runtime.chatCountsBoard = null;
      return;
    }
    const contagem = new Map();
    (data || []).forEach((entry) => {
      const key = String(entry.item_id);
      contagem.set(key, (contagem.get(key) || 0) + 1);
    });
    runtime.chatCounts = contagem;
    if (runtime.data?.activeBoardId === boardId) renderBoardContent(findBoard()?.board);
  }

  function chatUsers(itemId = runtime.chatItemId) {
    const scoped = runtime.chatUsersByItem?.get(String(itemId || ''));
    if (scoped) return scoped;
    return (runtime.data?.users || []).filter((entry) => ['active', 'ativo'].includes(String(entry.status || '').toLowerCase()));
  }

  function chatUserName(userId) {
    const user = chatUsers().find((entry) => entry.id === userId)
      || (runtime.data?.users || []).find((entry) => entry.id === userId);
    return user?.name || user?.email || 'Usuário';
  }

  function chatMentionAliases(user) {
    const nome = String(user?.name || '').trim();
    const email = String(user?.email || '').trim();
    return [...new Set([nome, email.split('@')[0]].filter(Boolean))].sort((a, b) => b.length - a.length);
  }

  function chatMentionRanges(texto, users) {
    const source = String(texto || '');
    const lowerSource = source.toLocaleLowerCase('pt-BR');
    const aliases = (users || []).flatMap((user) => chatMentionAliases(user).map((alias) => ({ user, alias })))
      .sort((a, b) => b.alias.length - a.alias.length);
    const ranges = [];
    aliases.forEach(({ user, alias }) => {
      const needle = `@${alias}`;
      const lowerNeedle = needle.toLocaleLowerCase('pt-BR');
      let cursor = 0;
      while ((cursor = lowerSource.indexOf(lowerNeedle, cursor)) >= 0) {
        const end = cursor + needle.length;
        const boundary = source[end];
        const overlaps = ranges.some((range) => cursor < range.end && end > range.start);
        if ((!boundary || /[\s.,;:!?)]/.test(boundary)) && !overlaps) ranges.push({ start: cursor, end, user });
        cursor = end;
      }
    });
    return ranges.sort((a, b) => a.start - b.start);
  }

  function chatTextHasAlias(texto, user) {
    return chatMentionRanges(texto, [user]).length > 0;
  }

  function chatTextMarkup(entry) {
    const source = String(entry.mensagem || '');
    const mentionedUsers = (entry.mencoes || [])
      .map((userId) => chatUsers(entry.itemId).find((user) => user.id === userId)
        || (runtime.data?.users || []).find((user) => user.id === userId))
      .filter(Boolean);
    const ranges = chatMentionRanges(source, mentionedUsers);
    if (!ranges.length) return escapeHtml(source);
    let cursor = 0;
    return ranges.map(({ start, end }) => {
      const prefix = escapeHtml(source.slice(cursor, start));
      const mark = `<mark>${escapeHtml(source.slice(start, end))}</mark>`;
      cursor = end;
      return prefix + mark;
    }).join('') + escapeHtml(source.slice(cursor));
  }

  // Converte "@Fulano" em destaque visual. A lista de mencionados que vale e a
  // guardada na linha (mencoes), nao o texto - se a pessoa trocar de nome, a
  // notificacao antiga continua apontando para o usuario certo.
  function chatMessageMarkup(entry) {
    const autor = chatUserName(entry.autorId);
    const proprio = entry.autorId === runtime.authSession?.user?.id;
    const podeApagar = proprio || runtime.authProfile?.role === 'admin';
    const texto = chatTextMarkup(entry);
    const anexos = (entry.anexos || []).map((anexo) => `<button class="atlas-v2-chat-file" type="button" data-action="chat-open-file" data-path="${attr(anexo.path)}" title="Abrir ${attr(anexo.nome)}"><i data-lucide="paperclip"></i>${escapeHtml(anexo.nome || 'arquivo')}</button>`).join('');
    return `<article class="atlas-v2-chat-message ${proprio ? 'is-own' : ''}">
      <header><strong>${escapeHtml(autor)}</strong><time>${escapeHtml(formatDateTime(entry.createdAt))}</time>
        ${podeApagar ? `<button class="atlas-v2-icon-button is-danger" type="button" data-action="chat-delete" data-message-id="${attr(entry.id)}" title="Apagar mensagem"><i data-lucide="trash-2"></i></button>` : ''}
      </header>
      ${texto ? `<p>${texto}</p>` : ''}
      ${anexos ? `<div class="atlas-v2-chat-files">${anexos}</div>` : ''}
    </article>`;
  }

  function renderItemChat(itemId) {
    const lista = document.getElementById('atlas-v2-chat-list');
    if (!lista) return;
    const mensagens = runtime.chatMessages?.get(String(itemId)) || [];
    lista.innerHTML = mensagens.length
      ? mensagens.map(chatMessageMarkup).join('')
      : '<div class="atlas-v2-empty-view"><div><i data-lucide="message-square"></i><strong>Nenhuma mensagem ainda</strong><span>Use @ para chamar alguém do time.</span></div></div>';
    refreshIcons(lista);
    lista.scrollTop = lista.scrollHeight;
  }

  async function loadItemChat(itemId) {
    runtime.chatMessages = runtime.chatMessages || new Map();
    if (!runtime.authClient || !runtime.remoteMode || !isUuid(itemId)) return;
    const { data, error } = await runtime.authClient
      .from('atlas_v2_item_messages')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true })
      .limit(300);
    if (error) {
      toast(`Não foi possível carregar a conversa: ${error.message || error}`, true);
      return;
    }
    runtime.chatMessages.set(String(itemId), (data || []).map((entry) => ({
      id: entry.id,
      itemId: entry.item_id,
      autorId: entry.autor_id,
      mensagem: entry.mensagem || '',
      mencoes: entry.mencoes || [],
      anexos: Array.isArray(entry.anexos) ? entry.anexos : [],
      createdAt: entry.created_at,
    })));
  }

  async function loadChatUsers(itemId) {
    runtime.chatUsersByItem = runtime.chatUsersByItem || new Map();
    if (!runtime.authClient || !runtime.remoteMode || !isUuid(itemId)) return;
    const { data, error } = await runtime.authClient.rpc('atlas_v2_list_item_mention_users', { p_item_id: itemId });
    if (error) {
      console.warn('Atlas V2.4: usuários mencionáveis indisponíveis.', error);
      return;
    }
    runtime.chatUsersByItem.set(String(itemId), (data || []).map((entry) => ({
      id: entry.user_id,
      name: entry.nome || entry.email || 'Usuário',
      email: entry.email || '',
      status: 'active',
    })));
  }

  async function openItemChat(itemId) {
    const context = findBoard();
    const found = context && findItem(context.board, itemId);
    if (!context || !found) return;
    runtime.chatItemId = itemId;
    runtime.chatMentionIds = new Set();
    const podeEscrever = hasPermission('edit', { ...context, itemId });
    openDrawer({
      title: 'Conversa',
      subtitle: found.item.name || 'Elemento',
      body: `<div class="atlas-v2-chat"><div class="atlas-v2-chat-list" id="atlas-v2-chat-list"><div class="atlas-v2-empty-view"><span>Carregando...</span></div></div>
        ${podeEscrever ? `<form class="atlas-v2-chat-form" id="atlas-v2-chat-form">
          <textarea name="mensagem" rows="2" placeholder="Escreva e use @ para mencionar" maxlength="2000"></textarea>
          <div class="atlas-v2-chat-suggestions" id="atlas-v2-chat-suggestions" hidden></div>
          <div class="atlas-v2-chat-form-actions">
            <label class="atlas-v2-icon-button" title="Anexar até 5 arquivos (ficam salvos no Atlas)"><i data-lucide="paperclip"></i><input type="file" id="atlas-v2-chat-file" multiple hidden></label>
            <span id="atlas-v2-chat-file-name"></span>
            <button class="atlas-v2-button atlas-v2-button-primary" type="submit"><i data-lucide="send"></i>Enviar</button>
          </div>
          <small id="atlas-v2-chat-mentions">Digite @ e escolha uma pessoa para notificá-la.</small>
        </form>` : '<p class="atlas-v2-chat-readonly">Você pode ler a conversa, mas não tem permissão para escrever neste elemento.</p>'}
      </div>`,
      actions: '',
    });
    await Promise.all([loadItemChat(itemId), loadChatUsers(itemId)]);
    renderItemChat(itemId);
  }

  function chatMentionContext(textarea) {
    const caret = textarea?.selectionStart ?? String(textarea?.value || '').length;
    const before = String(textarea?.value || '').slice(0, caret);
    const match = before.match(/@([^@\n,;:]*)$/);
    if (!match) return null;
    return { start: caret - match[0].length, end: caret, query: match[1].trim() };
  }

  function renderChatMentionSuggestions(textarea) {
    const root = document.getElementById('atlas-v2-chat-suggestions');
    if (!root) return;
    const context = chatMentionContext(textarea);
    if (!context) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    const normalize = (value) => String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const query = normalize(context.query);
    const users = chatUsers().filter((user) => chatMentionAliases(user).some((alias) => normalize(alias).includes(query))).slice(0, 6);
    root.innerHTML = users.map((user) => `<button type="button" data-action="chat-mention-select" data-user-id="${attr(user.id)}"><span class="atlas-v2-avatar">${escapeHtml((user.name || user.email || 'U').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase())}</span><span><strong>${escapeHtml(user.name || user.email)}</strong><small>${escapeHtml(user.email || '')}</small></span></button>`).join('') || '<p>Nenhum usuário com acesso a este elemento.</p>';
    root.hidden = false;
  }

  function selectChatMention(userId) {
    const textarea = document.querySelector('#atlas-v2-chat-form textarea[name="mensagem"]');
    const user = chatUsers().find((entry) => String(entry.id) === String(userId));
    const context = chatMentionContext(textarea);
    if (!textarea || !user || !context) return;
    const token = `@${user.name || user.email}`;
    textarea.value = `${textarea.value.slice(0, context.start)}${token} ${textarea.value.slice(context.end)}`;
    runtime.chatMentionIds.add(user.id);
    const caret = context.start + token.length + 1;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
    renderChatMentionSuggestions(textarea);
  }

  // Casa cada "@nome" digitado com um usuario real. Só vira mencao (e
  // notificacao) quem for encontrado - "@" solto vira texto comum.
  function resolveChatMentions(texto, selectedIds = runtime.chatMentionIds) {
    const encontrados = [];
    const usuarios = chatUsers();
    const selecionados = selectedIds instanceof Set ? [...selectedIds] : Array.isArray(selectedIds) ? selectedIds : [];
    selecionados.forEach((userId) => {
      const user = usuarios.find((entry) => String(entry.id) === String(userId));
      if (user && chatTextHasAlias(texto, user) && !encontrados.includes(user.id)) encontrados.push(user.id);
    });
    chatMentionRanges(texto, usuarios).forEach(({ user }) => {
      if (!encontrados.includes(user.id)) encontrados.push(user.id);
    });
    return encontrados;
  }

  // Mesma allowlist do conector do Drive (atlasValidateFile_ em
  // GoogleDriveUpload_AppsScript_V2_CONECTOR_*.gs), reaplicada aqui porque o
  // bucket do chat (atlas-chat) e um caminho de upload separado que nunca
  // teve essa checagem: sem ela, dava para anexar .html/.svg na conversa e
  // abrir em outra aba a partir do link assinado do proprio Supabase.
  const CHAT_ATTACHMENT_ALLOWED_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'odt', 'ods', 'ppt', 'pptx',
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff',
    'mp4', 'mov', 'zip', 'rar', '7z', 'kmz', 'kml', 'dwg', 'dxf',
  ];
  const CHAT_ATTACHMENT_FORBIDDEN_MIME_TYPES = ['text/html', 'application/javascript', 'text/javascript', 'image/svg+xml'];

  function chatAttachmentTypeAllowed(arquivo) {
    const nome = String(arquivo?.name || '');
    const extensao = nome.includes('.') ? nome.split('.').pop().toLowerCase() : '';
    if (!CHAT_ATTACHMENT_ALLOWED_EXTENSIONS.includes(extensao)) return false;
    if (CHAT_ATTACHMENT_FORBIDDEN_MIME_TYPES.includes(String(arquivo?.type || '').toLowerCase())) return false;
    return true;
  }

  async function submitItemChat(form) {
    const itemId = runtime.chatItemId;
    if (!itemId) return;
    const campo = form.elements.mensagem;
    const mensagem = String(campo.value || '').trim();
    const input = document.getElementById('atlas-v2-chat-file');
    const arquivos = [...(input?.files || [])];
    if (!mensagem && !arquivos.length) return;
    if (arquivos.length > 5) return toast('Envie no máximo 5 arquivos por mensagem.', true);
    if (arquivos.some((arquivo) => arquivo.size > 10 * 1024 * 1024)) return toast('Cada anexo pode ter no máximo 10 MB.', true);
    if (arquivos.reduce((total, arquivo) => total + arquivo.size, 0) > 25 * 1024 * 1024) return toast('Os anexos da mensagem podem somar no máximo 25 MB.', true);
    const arquivoNaoPermitido = arquivos.find((arquivo) => !chatAttachmentTypeAllowed(arquivo));
    if (arquivoNaoPermitido) return toast(`Formato não permitido: ${arquivoNaoPermitido.name}. O bucket do chat aceita os mesmos formatos dos anexos do elemento (documentos, planilhas, imagens, PDF, compactados) - nunca HTML, SVG ou script.`, true);
    const botao = form.querySelector('button[type="submit"]');
    if (botao) botao.disabled = true;
    const uploadedChatPaths = [];
    try {
      const anexos = [];
      for (let index = 0; index < arquivos.length; index += 1) {
        const arquivo = arquivos[index];
        // Anexo do chat NAO vai para o Drive - fica no bucket privado do
        // Supabase, separado dos documentos oficiais do elemento.
        setOperationProgress('Enviando anexos da conversa', Math.max(5, Math.round((index / Math.max(arquivos.length, 1)) * 70)), `${index + 1} de ${arquivos.length}`);
        const ownerId = runtime.authSession?.user?.id || 'usuario';
        const uniqueId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}`;
        const caminho = `${itemId}/${ownerId}/${uniqueId}-${arquivo.name.replace(/[^\w.\-]+/g, '_')}`;
        const { error } = await runtime.authClient.storage.from('atlas-chat').upload(caminho, arquivo, { upsert: false });
        if (error) throw new Error(error.message || 'falha ao enviar o anexo');
        uploadedChatPaths.push(caminho);
        anexos.push({ path: caminho, nome: arquivo.name, mime: arquivo.type || '', tamanho: arquivo.size });
      }
      setOperationProgress('Salvando mensagem', 82, 'Validando conversa e menções');
      const { error } = await runtime.authClient.rpc('atlas_v2_send_item_message', {
        p_item_id: itemId,
        p_mensagem: mensagem,
        p_mencoes: resolveChatMentions(mensagem),
        p_anexos: anexos,
      });
      if (error) throw new Error(error.message || error);
      campo.value = '';
      if (input) input.value = '';
      runtime.chatMentionIds.clear();
      const nome = document.getElementById('atlas-v2-chat-file-name');
      if (nome) nome.textContent = '';
      await loadItemChat(itemId);
      renderItemChat(itemId);
      renderBoardContent(findBoard()?.board);
      setOperationProgress('Mensagem enviada', 100, `${anexos.length} anexo(s)`);
    } catch (error) {
      // Se o arquivo chegou ao Storage, mas a mensagem falhou na RPC, nao
      // deixar um objeto orfao ocupando espaco para sempre.
      if (uploadedChatPaths.length) {
        try { await runtime.authClient.storage.from('atlas-chat').remove(uploadedChatPaths); } catch (_) {}
      }
      toast(`Não foi possível enviar: ${error.message || error}`, true);
    } finally {
      if (botao) botao.disabled = false;
      clearOperationProgress();
    }
  }

  async function deleteChatMessage(messageId) {
    const itemId = runtime.chatItemId;
    if (!messageId || !itemId) return;
    const cachedMessage = (runtime.chatMessages?.get(String(itemId)) || [])
      .find((entry) => String(entry.id) === String(messageId));
    const attachmentPaths = (cachedMessage?.anexos || []).map((entry) => entry?.path).filter(Boolean);
    const { error } = await runtime.authClient.from('atlas_v2_item_messages').delete().eq('id', messageId);
    if (error) {
      toast(`Não foi possível apagar: ${error.message || error}`, true);
      return;
    }
    if (attachmentPaths.length) {
      await runtime.authClient.storage.from('atlas-chat').remove(attachmentPaths).catch(() => {});
    }
    await loadItemChat(itemId);
    renderItemChat(itemId);
    renderBoardContent(findBoard()?.board);
  }

  // Bucket privado: o arquivo so abre por URL assinada, valida por 5 minutos.
  async function openChatFile(path) {
    if (!path) return;
    const { data, error } = await runtime.authClient.storage.from('atlas-chat').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast(`Não foi possível abrir o anexo: ${error?.message || 'link não gerado'}`, true);
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function openItemHistory(itemId) {
    const context = findBoard();
    const found = context && findItem(context.board, itemId);
    if (!context || !found) return;
    let entries = (runtime.data.itemHistory || []).filter((entry) => entry.itemId === itemId);
    if (runtime.remoteMode && runtime.authClient && isUuid(itemId)) {
      const { data, error } = await runtime.authClient.from('atlas_v2_item_history').select('*').eq('item_id', itemId).order('created_at', { ascending: false }).limit(100);
      if (!error && data) {
        const remoteEntries = data.map((entry) => ({
          id: entry.id,
          boardId: entry.board_id,
          itemId: entry.item_id,
          columnId: entry.field_key || entry.column_id || '__name__',
          beforeValue: entry.before_value,
          afterValue: entry.after_value,
          label: entry.action_label || 'Campo atualizado',
          userId: entry.changed_by || '',
          createdAt: entry.created_at,
        }));
        const byId = new Map([...remoteEntries, ...entries].map((entry) => [entry.id, entry]));
        entries = [...byId.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        runtime.data.itemHistory = [...entries.filter((entry) => !runtime.data.itemHistory.some((existing) => existing.id === entry.id)), ...runtime.data.itemHistory];
      }
    }
    openDrawer({
      title: 'Histórico do registro',
      subtitle: found.item.name,
      body: `<div class="atlas-v2-item-history">${entries.map((entry) => {
        const columnEntry = context.board.columns.find((column) => column.id === entry.columnId);
        const user = runtime.data.users.find((candidate) => candidate.id === entry.userId);
        return `<article><span><i data-lucide="history"></i></span><div><strong>${escapeHtml(columnEntry?.name || (entry.columnId === '__name__' ? 'Nome do registro' : entry.label))}</strong><small>${formatDateTime(entry.createdAt)} · ${escapeHtml(user?.name || 'Usuário')}</small><p><del>${escapeHtml(typeof entry.beforeValue === 'object' ? JSON.stringify(entry.beforeValue) : String(entry.beforeValue ?? ''))}</del><i data-lucide="arrow-right"></i><ins>${escapeHtml(typeof entry.afterValue === 'object' ? JSON.stringify(entry.afterValue) : String(entry.afterValue ?? ''))}</ins></p></div>${hasPermission('edit', context) ? `<button type="button" data-action="history-restore" data-history-id="${attr(entry.id)}" title="Restaurar valor anterior"><i data-lucide="undo-2"></i></button>` : ''}</article>`;
      }).join('') || '<div class="atlas-v2-empty-view"><div><i data-lucide="history"></i><strong>Nenhuma alteração registrada</strong></div></div>'}</div>`,
      actions: '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Fechar</button>',
    });
  }

  function restoreItemHistory(historyId) {
    const context = findBoard();
    const entry = (runtime.data.itemHistory || []).find((candidate) => candidate.id === historyId);
    const found = entry && context ? findItem(context.board, entry.itemId) : null;
    if (!context || !entry || !found || !requirePermission('edit', context, 'restaurar este valor')) return;
    const current = entry.columnId === '__name__' ? found.item.name : found.item.values?.[entry.columnId];
    if (entry.columnId === '__name__') found.item.name = String(entry.beforeValue || 'Item sem nome');
    else found.item.values[entry.columnId] = deepClone(entry.beforeValue);
    captureItemHistory(context.board, found.item, entry.columnId, current, entry.beforeValue, 'Valor restaurado');
    closeOverlay();
    saveData('Valor anterior restaurado', { itemId: found.item.id });
    render();
  }

  function saveData(message = '', options = {}) {
    if (options.revision !== false) runtime.dataRevision += 1;
    if (message && options.audit !== false) recordAudit(message, options);

    const shouldPersistImmediately = !runtime.remoteMode || navigator.onLine === false || options.localImmediate === true;
    const localBackupSaved = shouldPersistImmediately ? persistLocalBackup(runtime.data) : true;
    if (!shouldPersistImmediately) scheduleLocalBackupCompaction();
    scheduleBootstrapCacheWrite(runtime.data);
    if (options.remote !== false) {
      if (!runtime.remoteMode || runtime.remoteReady) scheduleRemoteSync();
      else runtime.remoteSyncQueued = true;
    }

    if (!localBackupSaved && !runtime.remoteMode) {
      runtime.data.errors = Array.isArray(runtime.data.errors) ? runtime.data.errors : [];
      runtime.data.errors.unshift({ id: id('error'), title: 'Backup local reduzido indisponível', detail: 'Os dados continuam nesta sessão, mas o navegador não conseguiu criar a cópia local.', createdAt: new Date().toISOString() });
      toast('O navegador não conseguiu criar o backup local. As alterações continuam nesta sessão.', true);
    }

    const indicator = document.getElementById('atlas-v2-save-state');
    if (indicator) {
      indicator.innerHTML = '<i data-lucide="loader-circle"></i>Salvando';
      setTimeout(() => {
        if (navigator.onLine === false) {
          indicator.innerHTML = '<i data-lucide="cloud-off"></i>Offline · alterações na fila';
          refreshIcons(indicator);
          return;
        }
        indicator.innerHTML = `<i data-lucide="${runtime.remoteMode ? 'cloud-upload' : 'hard-drive'}"></i>${runtime.remoteMode ? 'Alterações enviadas para sincronização' : 'Alterações salvas'}`;
        refreshIcons(indicator);
      }, 240);
    }
    if (message) toast(message);
    return true;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function attr(value) {
    return escapeHtml(value);
  }

  function currentUser() {
    return runtime.data?.users?.find((entry) => entry.id === runtime.data.currentUserId) || runtime.data?.users?.[0] || null;
  }

  function roleLabel(role) {
    return ROLE_DEFINITIONS[role]?.label || ROLE_DEFINITIONS.visualizador.label;
  }

  function scopeMatches(rule, context) {
    if (!rule || !context) return false;
    if (rule.scopeType === 'workspace') return rule.scopeId === context.workspace?.id;
    if (rule.scopeType === 'module') return rule.scopeId === context.module?.id;
    if (rule.scopeType === 'board') return rule.scopeId === context.board?.id;
    if (rule.scopeType === 'group') return rule.scopeId === context.groupId;
    if (rule.scopeType === 'column') return rule.scopeId === context.columnId;
    if (rule.scopeType === 'item') return rule.scopeId === context.itemId;
    return false;
  }

  function ruleSpecificity(rule) {
    return { workspace: 1, module: 2, board: 3, group: 4, column: 5, item: 6 }[rule?.scopeType] || 0;
  }

  function permissionRule(userId, context) {
    return (runtime.data?.accessRules || [])
      .filter((entry) => entry.userId === userId && scopeMatches(entry, context))
      .sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a))[0] || null;
  }

  function boardMembership(userId, boardId) {
    return (runtime.data?.boardMembers || []).find((entry) => entry.userId === userId && entry.boardId === boardId) || null;
  }

  function membershipLevel(role) {
    return { owner: 'manager', admin: 'manager', editor: 'editor', viewer: 'viewer' }[role] || 'viewer';
  }

  function hasPermission(permission, context = findBoard()) {
    const user = currentUser();
    if (!user || user.status !== 'active') return false;
    if (user.role === 'admin') return true;
    if (permission === 'admin') return false;

    const rule = permissionRule(user.id, context);
    if (rule) return (ACCESS_LEVELS[rule.level]?.permissions || []).includes(permission);

    const member = context?.board && boardMembership(user.id, context.board.id);
    if (member) return (ACCESS_LEVELS[membershipLevel(member.role)]?.permissions || []).includes(permission);

    if (context?.board && context.board.access !== 'main') return false;
    return (ROLE_DEFINITIONS[user.role]?.permissions || ROLE_DEFINITIONS.visualizador.permissions).includes(permission);
  }

  function requirePermission(permission, context = findBoard(), label = 'executar esta ação') {
    // A leitura inicial do Supabase acontece em segundo plano quando existe cache.
    // Não bloqueamos a interface durante essa etapa: os salvamentos ficam na fila
    // e a validação de conflitos é executada imediatamente antes da gravação.
    if (hasPermission(permission, context)) return true;
    toast(`Sem permissão para ${label}`, true);
    return false;
  }

  function renderIdentity() {
    const user = currentUser();
    if (!user) return;
    const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((entry) => entry[0]).join('').toUpperCase() || 'AT';
    const avatar = document.getElementById('atlas-v2-user-avatar');
    const name = document.getElementById('atlas-v2-user-name');
    const role = document.getElementById('atlas-v2-user-role');
    if (avatar) avatar.textContent = initials;
    if (name) name.textContent = user.name || user.email;
    if (role) role.textContent = roleLabel(user.role);
    const footerVersion = document.getElementById('atlas-v2-footer-version');
    if (footerVersion) footerVersion.textContent = window.ATNX_CONFIG?.V2_VERSION || ATLAS_BUILD;
    renderNotificationDot();
  }

  function refreshIcons(root = document) {
    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 }, nameAttr: 'data-lucide', root });
    }
  }

  function authTestMode() {
    const requested = new URLSearchParams(window.location.search).get('atlasTest') === '1';
    const local = window.location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    return requested && local;
  }

  function authVersion() {
    return window.ATNX_CONFIG?.V2_VERSION || 'V2.4.1 Oficial';
  }

  function authFeatureList() {
    return [
      ['layout-dashboard', 'Painéis configuráveis', 'Indicadores, totais, médias e distribuições criados pela própria equipe.'],
      ['calendar-days', 'Calendário e SLA', 'Prazos organizados por mês, alertas preventivos e registros vencidos.'],
      ['sigma', 'Fórmulas operacionais', 'Colunas calculadas automaticamente a partir dos dados do quadro.'],
      ['history', 'Histórico restaurável', 'Consulte alterações e recupere valores anteriores de cada registro.'],
      ['shield-check', 'Permissões granulares', 'Controle de acesso por área, módulo, quadro, grupo e coluna.'],
      ['file-search-2', 'Importador universal', 'Detecta abas, cabeçalhos, colunas, grupos e hierarquias antes de enviar os dados.'],
      ['list-checks', 'Edição em massa', 'Selecione elementos e subelementos para atualizar todos de uma só vez.'],
      ['cloud-upload', 'Sincronização com progresso', 'Envios mais rápidos com acompanhamento em porcentagem de dados e arquivos.'],
      ['image', 'Imagens com controle completo', 'Zoom, rotação, tela cheia e navegação entre anexos no Atlas.'],
      ['smartphone', 'Modo campo e PWA', 'Experiência direta no celular, câmera, localização e trabalho offline.'],
    ];
  }

  function authIntroMarkup() {
    return `<section class="atlas-v2-auth-intro">
      <header class="atlas-v2-auth-brandline">
        <img src="assets/brand/atnx-logo-horizontal.svg" alt="Atlas">
        <span>${escapeHtml(authVersion())}</span>
      </header>
      <div class="atlas-v2-auth-intro-copy">
        <span class="atlas-v2-auth-kicker">SMART FIELD MANAGEMENT</span>
        <h1>Controle operacional.<br><em>Do seu jeito.</em></h1>
        <p>A nova geração do Atlas transforma áreas, módulos e rotinas em uma estrutura única, configurável e segura.</p>
      </div>
      <div class="atlas-v2-auth-feature-list">
        ${authFeatureList().map(([icon, title, copy]) => `<article><i data-lucide="${icon}"></i><span><strong>${title}</strong><small>${copy}</small></span></article>`).join('')}
      </div>
      <footer><span><i data-lucide="radio-tower"></i>Supabase em tempo real</span><span><i data-lucide="shield"></i>Acesso por perfil</span><span><i data-lucide="code-2"></i>Criado por Túlio Radamés</span></footer>
    </section>`;
  }

  function authNotice(message, type = 'info') {
    if (!message) return '';
    const icon = type === 'error' ? 'circle-alert' : type === 'success' ? 'circle-check' : 'info';
    return `<div class="atlas-v2-auth-notice is-${type}" role="alert"><i data-lucide="${icon}"></i><span>${escapeHtml(message)}</span></div>`;
  }

  function authPasswordField(name, label, autocomplete, placeholder = 'Mínimo de 8 caracteres') {
    return `<label class="atlas-v2-auth-field"><span>${label}</span><div class="atlas-v2-auth-password"><i data-lucide="lock-keyhole"></i><input id="atlas-v2-auth-${name}" name="${name}" type="password" autocomplete="${autocomplete}" minlength="8" required placeholder="${placeholder}"><button type="button" data-auth-action="toggle-password" data-target="atlas-v2-auth-${name}" title="Mostrar senha" aria-label="Mostrar senha"><i data-lucide="eye"></i></button></div></label>`;
  }

  function authPanelMarkup(mode, message = '') {
    if (mode === 'loading') {
      return `<section class="atlas-v2-auth-panel atlas-v2-auth-state-panel" role="status">
        <span class="atlas-v2-auth-loader" aria-hidden="true"></span>
        <span class="atlas-v2-auth-kicker">CONEXÃO SEGURA</span>
        <h2>Validando seu acesso</h2>
        <p>Estamos verificando sua sessão, perfil e permissões.</p>
        <div class="atlas-v2-auth-progress"><span></span></div>
      </section>`;
    }

    if (mode === 'pending' || mode === 'blocked') {
      const pending = mode === 'pending';
      return `<section class="atlas-v2-auth-panel atlas-v2-auth-state-panel is-${mode}">
        <span class="atlas-v2-auth-state-icon"><i data-lucide="${pending ? 'clock-3' : 'shield-x'}"></i></span>
        <span class="atlas-v2-auth-kicker">${pending ? 'SOLICITAÇÃO RECEBIDA' : 'ACESSO BLOQUEADO'}</span>
        <h2>${pending ? 'Aguardando liberação' : 'Seu acesso está bloqueado'}</h2>
        <p>${pending ? 'Seu cadastro está pronto. Um administrador precisa definir seu perfil e liberar as áreas autorizadas.' : 'Um administrador suspendeu este perfil. Seus dados permanecem protegidos.'}</p>
        <div class="atlas-v2-auth-account"><i data-lucide="user-round"></i><span><small>Conta conectada</small><strong>${escapeHtml(runtime.authProfile?.email || runtime.authSession?.user?.email || '')}</strong></span></div>
        ${authNotice(message, pending ? 'info' : 'error')}
        <button class="atlas-v2-auth-secondary" type="button" data-auth-action="logout"><i data-lucide="log-out"></i>Sair desta conta</button>
      </section>`;
    }

    if (mode === 'config-error') {
      return `<section class="atlas-v2-auth-panel atlas-v2-auth-state-panel is-error">
        <span class="atlas-v2-auth-state-icon"><i data-lucide="database-zap"></i></span>
        <span class="atlas-v2-auth-kicker">CONFIGURAÇÃO</span>
        <h2>Não foi possível validar o perfil</h2>
        <p>Confira a instalação oficial do banco e a configuração do Supabase antes de tentar novamente.</p>
        ${authNotice(message || 'Perfil de acesso indisponível.', 'error')}
        <button class="atlas-v2-auth-primary" type="button" data-auth-action="retry"><i data-lucide="refresh-cw"></i>Tentar novamente</button>
        <button class="atlas-v2-auth-secondary" type="button" data-auth-action="logout"><i data-lucide="log-out"></i>Voltar ao login</button>
      </section>`;
    }

    if (mode === 'recovery-sent') {
      return `<section class="atlas-v2-auth-panel atlas-v2-auth-state-panel is-success">
        <span class="atlas-v2-auth-state-icon"><i data-lucide="mail-check"></i></span>
        <span class="atlas-v2-auth-kicker">RECUPERAÇÃO</span>
        <h2>Verifique seu e-mail</h2>
        <p>Enviamos o link seguro para redefinir sua senha.</p>
        ${authNotice(message, 'success')}
        <button class="atlas-v2-auth-primary" type="button" data-auth-action="show-login"><i data-lucide="arrow-left"></i>Voltar para entrar</button>
      </section>`;
    }

    if (mode === 'signup-sent') {
      return `<section class="atlas-v2-auth-panel atlas-v2-auth-state-panel is-success">
        <span class="atlas-v2-auth-state-icon"><i data-lucide="user-round-check"></i></span>
        <span class="atlas-v2-auth-kicker">CADASTRO CRIADO</span>
        <h2>Solicitação registrada</h2>
        <p>Seu cadastro aguarda somente a liberação de um administrador. Não é necessário confirmar o e-mail.</p>
        ${authNotice(message, 'success')}
        <button class="atlas-v2-auth-primary" type="button" data-auth-action="show-login"><i data-lucide="log-in"></i>Ir para o login</button>
      </section>`;
    }

    if (mode === 'reset-password') {
      return `<section class="atlas-v2-auth-panel">
        <span class="atlas-v2-auth-kicker">NOVA SENHA</span>
        <h2>Redefinir acesso</h2>
        <p>Escolha uma nova senha para continuar no Atlas.</p>
        ${authNotice(message, message ? 'error' : 'info')}
        <form id="atlas-v2-auth-reset-form" class="atlas-v2-auth-form">
          ${authPasswordField('password', 'Nova senha', 'new-password')}
          ${authPasswordField('passwordConfirm', 'Confirmar nova senha', 'new-password', 'Repita a nova senha')}
          <button class="atlas-v2-auth-primary" type="submit"><i data-lucide="key-round"></i>Atualizar senha</button>
        </form>
      </section>`;
    }

    const signup = mode === 'signup';
    const forgot = mode === 'forgot';
    return `<section class="atlas-v2-auth-panel">
      <span class="atlas-v2-auth-kicker">${signup ? 'NOVO ACESSO' : forgot ? 'RECUPERAR CONTA' : 'ACESSO SEGURO'}</span>
      <h2>${signup ? 'Solicitar acesso' : forgot ? 'Recuperar senha' : 'Entrar no Atlas'}</h2>
      <p>${signup ? 'O cadastro começa como Visualizador e depende da liberação de um administrador.' : forgot ? 'Informe seu e-mail para receber o link de redefinição.' : 'Use suas credenciais corporativas para continuar.'}</p>
      ${authNotice(message, 'error')}
      <form id="atlas-v2-auth-${signup ? 'signup' : forgot ? 'forgot' : 'login'}-form" class="atlas-v2-auth-form">
        ${signup ? '<label class="atlas-v2-auth-field"><span>Nome</span><div><i data-lucide="user-round"></i><input name="name" autocomplete="name" required maxlength="80" placeholder="Seu nome completo"></div></label>' : ''}
        <label class="atlas-v2-auth-field"><span>E-mail</span><div><i data-lucide="mail"></i><input name="email" type="email" autocomplete="email" required placeholder="nome@empresa.com"></div></label>
        ${forgot ? '' : authPasswordField('password', 'Senha', signup ? 'new-password' : 'current-password')}
        ${!signup && !forgot ? '<button class="atlas-v2-auth-link" type="button" data-auth-action="show-forgot">Esqueci minha senha</button>' : ''}
        <button class="atlas-v2-auth-primary" type="submit"><i data-lucide="${signup ? 'user-plus' : forgot ? 'send' : 'log-in'}"></i>${signup ? 'Criar solicitação' : forgot ? 'Enviar link seguro' : 'Entrar'}</button>
      </form>
      <div class="atlas-v2-auth-switch">
        <span>${signup ? 'Já possui acesso?' : forgot ? 'Lembrou sua senha?' : 'Primeiro acesso?'}</span>
        <button type="button" data-auth-action="${signup || forgot ? 'show-login' : 'show-signup'}">${signup || forgot ? 'Entrar' : 'Solicitar cadastro'}</button>
      </div>
      <footer class="atlas-v2-auth-security"><i data-lucide="lock-keyhole"></i>Sessão protegida pelo Supabase Auth</footer>
    </section>`;
  }

  function renderAuth(mode = 'login', message = '') {
    const root = document.getElementById('atlas-v2-auth-root');
    const app = document.getElementById('atlas-v2-app');
    if (!root || !app) return;
    app.hidden = true;
    root.hidden = false;
    document.body.classList.add('atlas-v2-auth-locked');
    root.innerHTML = `<main class="atlas-v2-auth-shell">${authIntroMarkup()}${authPanelMarkup(mode, message)}</main><span class="atlas-v2-auth-version">${escapeHtml(authVersion())}</span>`;
    refreshIcons(root);
    requestAnimationFrame(() => root.querySelector('input:not([type="hidden"])')?.focus());
  }

  function unlockApplication() {
    const root = document.getElementById('atlas-v2-auth-root');
    const app = document.getElementById('atlas-v2-app');
    if (root) {
      root.hidden = true;
      root.innerHTML = '';
    }
    if (app) app.hidden = false;
    document.body.classList.remove('atlas-v2-auth-locked');
    // Se os dados locais nao puderam ser lidos no boot, avisar agora que a
    // interface existe. O detalhe completo fica em Sistema > Central de erros.
    if (runtime.localDataRecovery && !runtime.localDataRecoveryNotified) {
      runtime.localDataRecoveryNotified = true;
      const recoveryKey = runtime.localDataRecovery.key;
      setTimeout(() => toast(
        recoveryKey
          ? 'Os dados locais não puderam ser lidos e o Atlas iniciou com a estrutura inicial. Uma cópia do conteúdo anterior foi preservada. Veja Sistema > Central de erros.'
          : 'Os dados locais não puderam ser lidos e o Atlas iniciou com a estrutura inicial. Veja Sistema > Central de erros.',
        true,
      ), 400);
    }
  }

  function authErrorMessage(error) {
    const message = String(error?.message || error || '').trim();
    const normalized = message.toLowerCase();
    if (normalized.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (normalized.includes('email not confirmed')) return 'Seu acesso ainda aguarda liberação do administrador.';
    if (normalized.includes('user already registered')) return 'Este e-mail já possui cadastro.';
    if (normalized.includes('password should be') || normalized.includes('weak password')) return 'A senha precisa ter pelo menos 8 caracteres e não pode estar em listas de senhas vazadas.';
    if (normalized.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    if (normalized.includes('failed to fetch') || normalized.includes('network')) return 'Não foi possível alcançar o Supabase. A configuração foi carregada, mas a conexão de rede falhou.';
    return message || 'Não foi possível concluir a autenticação.';
  }

  function databaseProfileToUser(profile, authUser = null) {
    return {
      id: profile.id,
      name: profile.nome || profile.email || authUser?.email || 'Usuário Atlas',
      email: profile.email || authUser?.email || '',
      role: ROLE_DEFINITIONS[profile.role] ? profile.role : 'visualizador',
      status: PROFILE_STATUS_FROM_DATABASE[profile.status] || 'pending',
      title: profile.cargo || '',
      lastActivity: profile.last_sign_in_at || profile.updated_at || null,
    };
  }

  function upsertAuthenticatedUser(profile, authUser) {
    if (!runtime.data || !profile) return;
    const mapped = databaseProfileToUser(profile, authUser);
    const index = runtime.data.users.findIndex((entry) => entry.id === mapped.id);
    if (index >= 0) runtime.data.users[index] = { ...runtime.data.users[index], ...mapped };
    else runtime.data.users.unshift(mapped);
    runtime.data.currentUserId = mapped.id;
    runtime.authProfile = profile;
  }

  async function loadCurrentProfile(session) {
    if (!runtime.authClient || !session?.user) return null;
    const readProfile = () => runtime.authClient
      .from('atlas_profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    let response = await readProfile();
    if (response.error) throw response.error;
    if (response.data) return response.data;
    try { await runtime.authClient.rpc('atlas_sync_current_profile'); } catch (_) {}
    response = await readProfile();
    if (response.error) throw response.error;
    return response.data || null;
  }

  async function refreshRemoteApplication(profile, authUser, options = {}) {
    if (runtime.bootstrapRefreshing || runtime.remoteSyncing || runtime.remoteSyncTimer) {
      runtime.remoteRefreshQueued = true;
      return;
    }
    runtime.bootstrapRefreshing = true;
    document.body.classList.add('atlas-v2-bootstrap-refreshing');
    const localBeforeRefresh = runtime.data;
    const baselineBeforeRefresh = runtime.remoteRows;
    const revisionBeforeRefresh = runtime.dataRevision;
    try {
      const remoteData = await loadRemoteData({
        includeAttachments: options.full === true,
        includeExtras: options.full === true,
      });
      if (!remoteData) throw new Error('O Supabase não retornou a estrutura operacional do Atlas.');
      if (runtime.dataRevision !== revisionBeforeRefresh && localBeforeRefresh?.workspaces?.length) {
        // Uma edição ocorreu enquanto a leitura do Supabase estava em andamento.
        // Preservamos o estado local e a linha de base anterior. Nunca usamos a
        // resposta recém-carregada como base para reenviar um snapshot antigo.
        runtime.data = localBeforeRefresh;
        runtime.remoteRows = baselineBeforeRefresh;
        runtime.remoteMode = true;
        runtime.remoteRefreshQueued = true;
      }
      runtime.remoteReady = true;
      if (options.full === true) runtime.deferredHydrated = true;
      if (profile) upsertAuthenticatedUser(profile, authUser);
      // Os dados em memoria (runtime.data) ja estao atualizados nesse ponto -
      // renderSoon so adia a atualizacao VISUAL enquanto a pessoa estiver com
      // um campo do quadro em foco, para nao destruir o input e perder o que
      // ela esta digitando (ver comentario junto de isEditingBoardField).
      renderSoon();
      if (options.full !== true && !runtime.deferredHydrated) hydrateDeferredRemoteData();
    } catch (error) {
      runtime.remoteMode = Boolean(runtime.data?.workspaces?.length && runtime.remoteRows);
      runtime.remoteReady = false;
      console.error('Atlas V2: falha ao atualizar a base operacional.', error);
      if (!options.silent) toast('O Atlas abriu em modo de consulta com o último cache. A edição será liberada após reconectar ao Supabase.', true);
    } finally {
      runtime.bootstrapRefreshing = false;
      document.body.classList.remove('atlas-v2-bootstrap-refreshing');
      if (runtime.remoteSyncQueued && runtime.remoteReady) {
        runtime.remoteSyncQueued = false;
        scheduleRemoteSync();
      } else if (runtime.remoteRefreshQueued && runtime.remoteReady && !runtime.remoteSyncing && !runtime.remoteSyncTimer) {
        runtime.remoteRefreshQueued = false;
        setTimeout(() => refreshRemoteApplication(runtime.authProfile, runtime.authSession?.user, { full: false, silent: true }), 250);
      }
    }
  }

  function updateOnlineState() {
    const offline = navigator.onLine === false;
    document.body.classList.toggle('atlas-v2-offline', offline);
    const indicator = document.getElementById('atlas-v2-save-state');
    if (indicator && offline) {
      indicator.innerHTML = '<i data-lucide="cloud-off"></i>Offline · alterações na fila';
      refreshIcons(indicator);
    }
  }

  function registerAtlasPwa() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(window.location.protocol)) return;
    // ATLAS_BUILD e a unica fonte da versao dos arquivos web. O Service Worker
    // deriva dele o nome do cache e as URLs do pre-cache. As querystrings do
    // index.html usam a mesma string, e tests/static-audit.cjs falha se
    // divergirem.
    navigator.serviceWorker.register(`./service-worker.js?v=${ATLAS_BUILD}`, { scope: './' }).catch((error) => {
      console.warn('Atlas V2.2: PWA indisponível.', error);
    });
    // Um Service Worker novo assume o controle desta aba imediatamente
    // (skipWaiting + clients.claim), mas o JavaScript em memoria continua sendo
    // o antigo. Avisar em vez de deixar a aba em estado misto e silencioso.
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type !== 'atlas-sw-activated') return;
      if (event.data.build === ATLAS_BUILD) return;
      toast('Uma versão nova do Atlas foi publicada. Recarregue a página para usá-la.', true);
    });
  }


  async function initializeApplication(profile = null, authUser = null) {
    if (!runtime.appInitialized) {
      runtime.data = profile ? authenticatedShellData() : loadData();
      // Cada nova abertura começa com o menu recolhido para priorizar o quadro.
      // A pessoa ainda pode abri-lo normalmente durante a sessão.
      document.body.classList.toggle('atlas-v2-sidebar-collapsed', window.innerWidth > 820);
      document.body.classList.remove('atlas-v2-sidebar-open');
      document.addEventListener('click', handleClick);
      document.addEventListener('change', handleChange);
      document.addEventListener('input', handleInput);
      document.addEventListener('focusout', handleFocusOut);
      document.addEventListener('submit', handleSubmit);
      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('pointermove', handlePointerMove, { passive: false });
      document.addEventListener('pointerup', finishHorizontalDrag);
      document.addEventListener('pointercancel', finishHorizontalDrag);
      document.addEventListener('wheel', handleWheel, { passive: false });
      document.addEventListener('scroll', handleBoardTableScroll, true);
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('dragstart', handleDragStart);
      document.addEventListener('dragover', handleDragOver);
      document.addEventListener('drop', handleDrop);
      document.addEventListener('dragend', handleDragEnd);
      document.addEventListener('keydown', handleKeydown);
      document.addEventListener('error', handleImageLoadError, true);
      window.addEventListener('resize', handleResize);
      window.addEventListener('online', () => {
        updateOnlineState();
        if (runtime.authSession?.user) {
          startRealtime();
          void pollGlobalRealtimeChanges();
          if (runtime.remoteSyncQueued) scheduleRemoteSync();
        }
      });
      window.addEventListener('offline', updateOnlineState);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && runtime.authSession?.user) void pollGlobalRealtimeChanges();
      });
      runtime.appInitialized = true;
      updateOnlineState();
      registerAtlasPwa();
    }
    if (profile) upsertAuthenticatedUser(profile, authUser);

    if (profile && runtime.authClient && runtime.authSession?.user) {
      const cached = await readBootstrapCache(runtime.authSession.user.id);
      if (cached) {
        runtime.data = cached;
        // Mantem o estado visual do usuario: modulos, setores e subitens abertos.
        runtime.remoteMode = true;
        runtime.remoteReady = false;
        runtime.remoteRows = remoteRows(cached);
        runtime.remoteRows.atlas_v2_attachments = [];
        const cachedBoard = findBoard(cached.activeBoardId)?.board;
        const cachedItemIds = cachedBoard ? flatBoardItems(cachedBoard).map(({ item }) => String(item.id)) : [];
        runtime.loadedItemValues = new Set(cachedItemIds);
        // Atencao: cachedItemIds vem de flatBoardItems, ou seja, marca ate os
        // SUBITENS como "valores carregados" mesmo quando o cache nao traz os
        // valores deles - por isso as formulas de agregacao nao podem confiar
        // em loadedItemValues (ver ensureBoardViewData).
        runtime.aggregationHydratedBoards.clear();
        // Conversa tambem some do cache: outra pessoa pode ter escrito ou
        // apagado mensagem enquanto os dados eram recarregados.
        runtime.chatMessages.clear();
        runtime.chatCounts.clear();
        runtime.chatCountsBoard = null;
        runtime.loadedBoardData = new Set(cached.activeBoardId && cachedItemIds.length ? [cached.activeBoardId] : []);
        upsertAuthenticatedUser(profile, authUser);
        unlockApplication();
        render();
        scheduleLocalBackupCompaction();
        refreshRemoteApplication(profile, authUser, { full: false, silent: true });
        if (profile.role === 'admin') syncAuthUsersFromSupabase({ renderAfter: false, notify: false });
        startAutomationMonitor();
        refreshNotifications();
        startRealtime();
        return;
      }
      try {
        const remoteData = await loadRemoteData({ includeAttachments: false, includeExtras: false });
        if (!remoteData) throw new Error('O Supabase não retornou a estrutura operacional do Atlas.');
        runtime.remoteReady = true;
        upsertAuthenticatedUser(profile, authUser);
      } catch (error) {
        runtime.remoteMode = false;
        runtime.remoteReady = false;
        runtime.remoteRows = null;
        console.error('Atlas V2: falha ao carregar a base operacional.', error);
      }
    }

    unlockApplication();
    render();
    scheduleLocalBackupCompaction();
    if (profile && !runtime.remoteMode) toast('A estrutura V2 ainda não foi carregada do Supabase. Execute o SQL completo da versão.', true);
    if (profile && runtime.remoteMode) hydrateDeferredRemoteData();
    if (profile?.role === 'admin') syncAuthUsersFromSupabase({ renderAfter: false });
    if (profile) { startAutomationMonitor(); refreshNotifications(); startRealtime(); }
  }

  async function applyAuthSession(session) {
    runtime.authSession = session || null;
    runtime.authProfile = null;
    if (!session?.user) {
      stopRealtime();
      renderAuth('login');
      return;
    }
    renderAuth('loading');
    try {
      const profile = await loadCurrentProfile(session);
      if (!profile) {
        renderAuth('config-error', 'Perfil não encontrado na tabela atlas_profiles.');
        return;
      }
      runtime.authProfile = profile;
      if (profile.status === 'pendente') {
        renderAuth('pending');
        return;
      }
      if (profile.status === 'bloqueado') {
        renderAuth('blocked');
        return;
      }
      await initializeApplication(profile, session.user);
    } catch (error) {
      console.error('Atlas V2: falha ao validar perfil.', error);
      renderAuth('config-error', authErrorMessage(error));
    }
  }

  async function currentAuthAccessToken() {
    if (!runtime.authClient) throw new Error('Sessao do Supabase indisponivel.');
    const { data, error } = await runtime.authClient.auth.getSession();
    if (error) throw new Error(`Nao foi possivel renovar a sessao do Atlas: ${authErrorMessage(error)}`);
    const session = data?.session || null;
    if (!session?.access_token) throw new Error('Sua sessao expirou. Entre novamente no Atlas.');
    runtime.authSession = session;
    return session.access_token;
  }

  async function syncAuthUsersFromSupabase(options = {}) {
    if (!runtime.authClient || runtime.authUsersLoading || runtime.authProfile?.role !== 'admin') return;
    runtime.authUsersLoading = true;
    try {
      const { data, error } = await runtime.authClient.from('atlas_profiles').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      runtime.data.users = (data || []).map((profile) => databaseProfileToUser(profile, profile.id === runtime.authSession?.user?.id ? runtime.authSession.user : null));
      if (!runtime.data.users.some((entry) => entry.id === runtime.data.currentUserId) && runtime.authProfile) {
        runtime.data.users.unshift(databaseProfileToUser(runtime.authProfile, runtime.authSession?.user));
      }
      saveData('', { audit: false, revision: false, remote: false });
      if (options.renderAfter !== false) render();
    } catch (error) {
      console.error('Atlas V2: falha ao sincronizar usuários.', error);
      if (options.notify !== false) toast('Não foi possível atualizar os usuários do Supabase.', true);
    } finally {
      runtime.authUsersLoading = false;
    }
  }

  function authRedirectUrl() {
    if (!['http:', 'https:'].includes(window.location.protocol)) return undefined;
    const url = new URL(window.location.href);
    url.search = '?recovery=1';
    url.hash = '';
    return url.toString();
  }

  async function submitAuthLogin(form) {
    renderAuth('loading');
    const { data, error } = await runtime.authClient.auth.signInWithPassword({
      email: String(form.elements.email.value || '').trim(),
      password: String(form.elements.password.value || ''),
    });
    if (error) return renderAuth('login', authErrorMessage(error));
    await applyAuthSession(data?.session || null);
  }

  async function submitAuthSignup(form) {
    renderAuth('loading');
    const options = { data: { nome: String(form.elements.name.value || '').trim() } };
    const { data, error } = await runtime.authClient.auth.signUp({
      email: String(form.elements.email.value || '').trim(),
      password: String(form.elements.password.value || ''),
      options,
    });
    if (error) return renderAuth('signup', authErrorMessage(error));
    if (data?.session) return applyAuthSession(data.session);
    renderAuth('signup-sent', 'O administrador verá sua solicitação na Central de Administração.');
  }

  async function submitAuthForgot(form) {
    renderAuth('loading');
    const payload = {};
    const redirectTo = authRedirectUrl();
    if (redirectTo) payload.redirectTo = redirectTo;
    const { error } = await runtime.authClient.auth.resetPasswordForEmail(String(form.elements.email.value || '').trim(), payload);
    if (error) return renderAuth('forgot', authErrorMessage(error));
    renderAuth('recovery-sent', 'O link será válido somente durante o período definido no Supabase.');
  }

  async function submitAuthReset(form) {
    const password = String(form.elements.password.value || '');
    const confirmation = String(form.elements.passwordConfirm.value || '');
    if (password !== confirmation) return renderAuth('reset-password', 'As duas senhas precisam ser iguais.');
    renderAuth('loading');
    const { error } = await runtime.authClient.auth.updateUser({ password });
    if (error) return renderAuth('reset-password', authErrorMessage(error));
    await runtime.authClient.auth.signOut();
    renderAuth('login', 'Senha atualizada. Entre novamente com sua nova senha.');
  }

  async function handleAuthSubmit(event) {
    const form = event.target;
    const handlers = {
      'atlas-v2-auth-login-form': submitAuthLogin,
      'atlas-v2-auth-signup-form': submitAuthSignup,
      'atlas-v2-auth-forgot-form': submitAuthForgot,
      'atlas-v2-auth-reset-form': submitAuthReset,
    };
    if (!handlers[form.id]) return;
    event.preventDefault();
    try {
      await handlers[form.id](form);
    } catch (error) {
      renderAuth(form.id.includes('signup') ? 'signup' : form.id.includes('forgot') ? 'forgot' : 'login', authErrorMessage(error));
    }
  }

  async function handleAuthClick(event) {
    const target = event.target.closest('[data-auth-action]');
    if (!target) return;
    const action = target.dataset.authAction;
    if (action === 'show-login') renderAuth('login');
    if (action === 'show-signup') renderAuth('signup');
    if (action === 'show-forgot') renderAuth('forgot');
    if (action === 'retry') await bootstrapAuthentication();
    if (action === 'logout') {
      stopAutomationMonitor();
      try { await runtime.authClient?.auth?.signOut(); } catch (_) {}
      runtime.authSession = null;
      runtime.authProfile = null;
      await clearLocalUserData();
      closeOverlay();
      renderAuth('login');
    }
    if (action === 'toggle-password') {
      const input = document.getElementById(target.dataset.target || '');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      target.title = input.type === 'password' ? 'Mostrar senha' : 'Ocultar senha';
      target.setAttribute('aria-label', target.title);
      target.innerHTML = `<i data-lucide="${input.type === 'password' ? 'eye' : 'eye-off'}"></i>`;
      refreshIcons(target);
      input.focus();
    }
  }

  async function bootstrapAuthentication() {
    const preview = new URLSearchParams(window.location.search).get('authPreview');
    if (preview && (window.location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(window.location.hostname))) {
      renderAuth(preview);
      return;
    }
    if (authTestMode()) {
      await initializeApplication();
      return;
    }
    const library = window.supabase || window.Supabase;
    const config = window.ATNX_CONFIG || {};
    const configUrl = String(config.SUPABASE_URL || '').trim();
    const configKey = String(config.SUPABASE_KEY || '').trim();
    const configIsExample = !configUrl
      || !configKey
      || /SEU-PROJETO|YOUR-PROJECT|example/i.test(configUrl)
      || /SUA_CHAVE|YOUR_KEY|ANON_KEY/i.test(configKey);
    if (!library?.createClient || configIsExample) {
      renderAuth('config-error', 'O arquivo config/config.js está ausente ou contém dados de exemplo. Restaure a configuração da última versão funcional.');
      return;
    }
    if (!runtime.authClient) runtime.authClient = library.createClient(configUrl, configKey);
    renderAuth('loading');
    if (!runtime.authListenerRegistered) {
      runtime.authListenerRegistered = true;
      runtime.authClient.auth.onAuthStateChange((event, session) => {
        if (session && ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
          runtime.authSession = session;
        }
        if (event === 'PASSWORD_RECOVERY') {
          runtime.authSession = session || null;
          renderAuth('reset-password');
          return;
        }
        if (event === 'SIGNED_OUT') {
          stopRealtime();
          stopAutomationMonitor();
          // Limpar sessao e perfil tambem aqui. Este evento dispara em qualquer
          // encerramento vindo do Supabase (token de renovacao expirado, logout
          // em outra aba), e nao apenas no botao Sair. Sem a limpeza, um perfil
          // antigo (possivelmente admin) continuava em runtime depois da tela de
          // login voltar.
          runtime.authSession = null;
          runtime.authProfile = null;
          renderAuth('login');
        }
      });
    }
    const { data, error } = await runtime.authClient.auth.getSession();
    if (error) {
      renderAuth('login', authErrorMessage(error));
      return;
    }
    if (new URLSearchParams(window.location.search).get('recovery') === '1' && data?.session) {
      runtime.authSession = data.session;
      renderAuth('reset-password');
      return;
    }
    await applyAuthSession(data?.session || null);
  }

  function currentWorkspace() {
    return runtime.data.workspaces.find((entry) => entry.id === runtime.data.activeWorkspaceId) || runtime.data.workspaces[0];
  }

  function storageConnection(connectionId) {
    return (runtime.data.storageConnections || []).find((entry) => entry.id === connectionId) || null;
  }

  function normalizedStorageScopeName(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function storageForContext(context = findBoard()) {
    if (!context) return null;
    const direct = storageConnection(context.board?.storageConnectionId || context.module?.storageConnectionId || context.workspace?.storageConnectionId);
    if (direct) return direct;
    const scopeNames = [context.module?.name, context.workspace?.name, context.board?.name]
      .map(normalizedStorageScopeName)
      .filter(Boolean);
    return (runtime.data.storageConnections || []).find((entry) => {
      if (entry.status === 'disabled') return false;
      const connectionNames = [entry.sector, entry.name].map(normalizedStorageScopeName).filter(Boolean);
      return connectionNames.some((name) => scopeNames.includes(name));
    }) || null;
  }

  function assignStorageConnectionToMatchingScope(connection) {
    if (!connection?.id) return '';
    const sectorName = normalizedStorageScopeName(connection.sector);
    const nameWithoutDrive = normalizedStorageScopeName(String(connection.name || '').replace(/^drive\s+(do|da|de)\s+/i, ''));
    const targetNames = [sectorName, nameWithoutDrive].filter(Boolean);
    let matchedWorkspace = null;
    let matchedModule = null;
    runtime.data.workspaces.some((workspace) => {
      if (!workspace.storageConnectionId && targetNames.includes(normalizedStorageScopeName(workspace.name))) matchedWorkspace = workspace;
      matchedModule = (workspace.modules || []).find((module) => (
        !module.storageConnectionId
        && targetNames.includes(normalizedStorageScopeName(module.name))
      )) || null;
      return Boolean(matchedModule);
    });
    const context = findBoard();
    const targetModule = matchedModule || (!context?.module?.storageConnectionId ? context?.module : null);
    if (targetModule) {
      targetModule.storageConnectionId = connection.id;
      return `módulo ${targetModule.name}`;
    }
    if (matchedWorkspace) {
      matchedWorkspace.storageConnectionId = connection.id;
      return `área ${matchedWorkspace.name}`;
    }
    if (context?.workspace && !context.workspace.storageConnectionId) {
      context.workspace.storageConnectionId = connection.id;
      return `área ${context.workspace.name}`;
    }
    return '';
  }

  function storageStatusLabel(status) {
    return { connected: 'Conectado', inherited: 'Configurado', pending: 'Aguardando teste', error: 'Falha na conexão', disabled: 'Desativado' }[status] || 'Não configurado';
  }

  function normalizedStorageModule(value) {
    const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    if (normalized.includes('expans')) return 'expansoes';
    if (normalized.includes('document') || normalized.includes('obra')) return 'documentacao';
    return '';
  }

  function storageModule(connection = {}, context = null) {
    const candidates = [
      connection.module,
      connection.connectorVersion,
      connection.sector,
      connection.name,
      connection.accountEmail,
      context?.module?.name,
      context?.board?.name,
    ];
    for (const candidate of candidates) {
      const moduleName = normalizedStorageModule(candidate);
      if (moduleName) return moduleName;
    }
    return 'documentacao';
  }

  function legacyMediaType(columnEntry = {}) {
    const label = String(columnEntry.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (label.includes('diagrama')) return 'diagramas';
    if (label.includes('kmz') || label.includes('kml')) return 'kmz';
    if (label.includes('material') || label.includes('planilha') || label.includes('excel')) return 'lista_materiais';
    return 'imagens';
  }

  function extractDriveFolderId(value) {
    const input = String(value || '').trim();
    const match = input.match(/\/folders\/([a-zA-Z0-9_-]{10,})/) || input.match(/^([a-zA-Z0-9_-]{20,})$/);
    return match?.[1] || '';
  }

  // Raiz do setor num conector local: identificador livre, mas confinado. Recusa
  // '..', segmento vazio e caractere fora da lista branca, para o Atlas nao
  // conseguir nem PEDIR um caminho fora da pasta do setor. A defesa real fica no
  // servidor (equivalente ao atlasFileBelongsToRoot_ do Apps Script) - isto aqui
  // so evita gravar uma raiz invalida.
  function normalizeLocalStorageRoot(value) {
    const input = String(value || '').trim().replace(/^\/+|\/+$/g, '');
    if (!input || input.length > 200) return '';
    if (input.split('/').some((part) => !part || part === '.' || part === '..')) return '';
    return /^[A-Za-z0-9._\-/]+$/.test(input) ? input : '';
  }

  function normalizeStorageRoot(value, type) {
    return storageType({ type }) === 'local' ? normalizeLocalStorageRoot(value) : extractDriveFolderId(value);
  }

  function normalizeAppsScriptUrl(value) {
    const input = String(value || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec(?:\?.*)?$/i.test(input)) return '';
    return input.split('?')[0];
  }

  // Endpoint de um conector local. Exige HTTPS porque o Atlas e servido por HTTPS
  // e o navegador BLOQUEIA requisicao para http:// por mixed content - a unica
  // excecao e localhost/127.0.0.1, que o navegador trata como origem confiavel
  // (serve para desenvolver antes de existir certificado). Credencial embutida na
  // URL e recusada: ela iria no corpo de toda requisicao e vazaria no banco.
  function normalizeLocalConnectorUrl(value) {
    const input = String(value || '').trim();
    if (!input) return '';
    let url;
    try { url = new URL(input); } catch (_) { return ''; }
    const ehLocalhost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ehLocalhost)) return '';
    if (url.username || url.password) return '';
    // Bloqueia o endereco link-local (169.254.0.0/16 e fe80::/10): e a faixa
    // usada pelos servicos de metadados de nuvem (ex.: 169.254.169.254 na
    // AWS/GCP/Azure). Nenhum conector de armazenamento legitimo precisa
    // apontar para ai - permitir isso deixaria uma porta aberta para SSRF se
    // um admin for enganado a colar essa URL num "servidor local".
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(url.hostname) || /^\[?fe80:/i.test(url.hostname)) return '';
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  }

  function normalizeConnectorUrl(value, type) {
    return storageType({ type }) === 'local' ? normalizeLocalConnectorUrl(value) : normalizeAppsScriptUrl(value);
  }

  function storageDraftFromForm(form) {
    const data = new FormData(form);
    const type = storageType({ type: data.get('driveType') });
    return {
      type,
      name: String(data.get('driveName') || '').trim(),
      sector: String(data.get('driveSector') || data.get('name') || '').trim(),
      accountEmail: String(data.get('driveEmail') || '').trim(),
      folderUrl: String(data.get('driveFolderUrl') || '').trim(),
      folderId: normalizeStorageRoot(data.get('driveFolderUrl'), type),
      appScriptUrl: normalizeConnectorUrl(data.get('driveAppScriptUrl'), type),
      connectorVersion: String(data.get('connectorVersion') || '').trim(),
    };
  }

  function validateStorageDraft(draft, ignoreId = '') {
    const ehLocal = storageType(draft) === 'local';
    if (!draft.name) return 'Informe um nome para a conexão.';
    if (!draft.sector) return 'Informe o setor responsável.';
    // Conta Google só existe no Drive; conector local não tem conta associada.
    if (!ehLocal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.accountEmail)) return 'Informe o e-mail da conta Google do setor.';
    if (!draft.folderId) {
      return ehLocal
        ? 'Informe a pasta raiz do setor no servidor (ex.: documentacao/rede-geral). Sem "..", sem caminho absoluto.'
        : 'Informe um link válido de pasta do Google Drive.';
    }
    if (!draft.appScriptUrl) {
      return ehLocal
        ? 'Informe a URL HTTPS do conector no servidor local. http:// só é aceito em localhost, e a URL não pode conter usuário ou senha.'
        : 'Informe a URL /exec válida do Apps Script implantado nessa conta.';
    }
    const duplicate = (runtime.data.storageConnections || []).find((entry) => entry.id !== ignoreId && entry.folderId && entry.folderId === draft.folderId);
    if (duplicate) return `Esta pasta já pertence à conexão ${duplicate.name}.`;
    return '';
  }

  function findBoard(boardId = runtime.data.activeBoardId) {
    for (const workspace of runtime.data.workspaces) {
      for (const module of workspace.modules) {
        const found = module.boards.find((entry) => entry.id === boardId);
        if (found) return { workspace, module, board: found };
      }
    }
    return null;
  }

  function findItem(boardEntry, itemId) {
    for (const groupEntry of boardEntry.groups) {
      const visit = (collection, parent = null) => {
        for (const entry of collection || []) {
          if (entry.id === itemId) return { group: groupEntry, item: entry, parent, collection };
          const child = visit(entry.subitems, entry);
          if (child) return child;
        }
        return null;
      };
      const found = visit(groupEntry.items);
      if (found) return found;
    }
    return null;
  }

  function normalizedStatusLabel(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  function statusFallbackIndex(label) {
    const text = normalizedStatusLabel(label);
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) hash = ((hash * 31) + text.charCodeAt(index)) >>> 0;
    return hash % STATUS_FALLBACK_BACKGROUNDS.length;
  }

  function defaultStatusOption(label, index = null) {
    const normalized = normalizedStatusLabel(label);
    const known = STATUS_OPTIONS.find((entry) => normalizedStatusLabel(entry.label) === normalized);
    if (known) return { ...known, label: String(label || known.label) };
    const fallbackIndex = Number.isInteger(index) ? index % STATUS_FALLBACK_BACKGROUNDS.length : statusFallbackIndex(label);
    const background = STATUS_FALLBACK_BACKGROUNDS[fallbackIndex];
    return { label: String(label || ''), color: readableTextColor(background), background };
  }

  function normalizeStatusOptions(options = []) {
    const source = Array.isArray(options) && options.length ? options : STATUS_OPTIONS;
    return source.map((entry, index) => {
      const label = typeof entry === 'string' ? entry : String(entry?.label || '');
      const defaults = defaultStatusOption(label, index);
      if (!entry || typeof entry === 'string') return defaults;
      return {
        ...defaults,
        ...entry,
        label,
        color: normalizedHexColor(entry.color, defaults.color),
        background: normalizedHexColor(entry.background, defaults.background),
      };
    });
  }

  function optionDetails(columnEntry, value) {
    const options = columnEntry?.type === 'status'
      ? normalizeStatusOptions(columnEntry.options || [])
      : (columnEntry?.options || []);
    const normalizedValue = columnEntry?.type === 'status' ? normalizedStatusLabel(value) : String(value ?? '');
    const found = options.find((entry) => {
      const label = typeof entry === 'string' ? entry : entry.label;
      return columnEntry?.type === 'status'
        ? normalizedStatusLabel(label) === normalizedValue
        : label === value;
    });
    if (!found) return columnEntry?.type === 'status' && value
      ? defaultStatusOption(value)
      : { label: value || '', color: '', background: '' };
    if (typeof found === 'string') return columnEntry?.type === 'status'
      ? defaultStatusOption(found)
      : { label: found, color: '', background: '' };
    return found;
  }

  function itemStatusAppearance(boardEntry, itemEntry) {
    const statusColumns = (boardEntry.columns || [])
      .filter((entry) => entry.type === 'status')
      .sort((a, b) => {
        const score = (entry) => {
          const name = normalizedStatusLabel(entry.name);
          if (name === 'status' || name === 'situacao') return 100;
          if (name.includes('status')) return 80;
          if (name.includes('situacao')) return 70;
          if (name.includes('fase') || name.includes('etapa')) return 50;
          return 0;
        };
        return score(b) - score(a) || Number(a.order || 0) - Number(b.order || 0);
      });
    const columnEntry = statusColumns.find((entry) => {
      const value = itemEntry?.values?.[entry.id];
      return value !== null && value !== undefined && String(value).trim() !== '';
    }) || statusColumns[0] || null;
    if (!columnEntry) return null;
    const value = itemEntry?.values?.[columnEntry.id];
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const details = optionDetails(columnEntry, value);
    return {
      column: columnEntry,
      value,
      label: details.label || String(value),
      color: normalizedHexColor(details.color, readableTextColor(details.background || '#e3f1fc')),
      background: normalizedHexColor(details.background, defaultStatusOption(value).background),
    };
  }

  function normalizedHexColor(value, fallback = '#0f6cbd') {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
  }

  function readableTextColor(background) {
    const color = normalizedHexColor(background, '#e3f1fc').slice(1);
    const red = parseInt(color.slice(0, 2), 16);
    const green = parseInt(color.slice(2, 4), 16);
    const blue = parseInt(color.slice(4, 6), 16);
    const luminance = ((red * 299) + (green * 587) + (blue * 114)) / 1000;
    return luminance >= 150 ? '#17202b' : '#ffffff';
  }

  function formatDateTime(value) {
    if (!value) return 'Sem atividade';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
  }

  function allBoards() {
    const entries = [];
    (runtime.data?.workspaces || []).forEach((workspace) => workspace.modules.forEach((module) => module.boards.forEach((boardEntry) => {
      entries.push({ workspace, module, board: boardEntry });
    })));
    return entries;
  }

  function scopeOptions() {
    const options = [];
    runtime.data.workspaces.forEach((workspace) => {
      options.push({ value: `workspace:${workspace.id}`, label: `Área · ${workspace.name}` });
      workspace.modules.forEach((module) => {
        options.push({ value: `module:${module.id}`, label: `Módulo · ${module.name}` });
        module.boards.forEach((boardEntry) => {
          options.push({ value: `board:${boardEntry.id}`, label: `Quadro · ${boardEntry.name}` });
          boardEntry.groups.forEach((groupEntry) => {
            options.push({ value: `group:${groupEntry.id}`, label: `Grupo · ${boardEntry.name} / ${groupEntry.name}` });
            const visitItems = (entries, depth) => (entries || []).forEach((itemEntry) => {
              options.push({ value: `item:${itemEntry.id}`, label: `Obra · ${boardEntry.name} / ${'—'.repeat(depth)}${depth ? ' ' : ''}${itemEntry.name || 'Sem nome'}` });
              visitItems(itemEntry.subitems, depth + 1);
            });
            visitItems(groupEntry.items, 0);
          });
          boardEntry.columns.forEach((columnEntry) => options.push({ value: `column:${columnEntry.id}`, label: `Coluna · ${boardEntry.name} / ${columnEntry.name}` }));
        });
      });
    });
    return options;
  }

  function scopeName(scopeType, scopeId) {
    if (scopeType === 'item') {
      const found = findItemContextById(scopeId);
      return found ? `${found.board.name} / ${found.found.item.name || 'Sem nome'}` : 'Obra removida';
    }
    if (scopeType === 'workspace') return runtime.data.workspaces.find((entry) => entry.id === scopeId)?.name || 'Área removida';
    for (const workspace of runtime.data.workspaces) {
      const module = workspace.modules.find((entry) => entry.id === scopeId);
      if (scopeType === 'module' && module) return module.name;
      for (const moduleEntry of workspace.modules) {
        const boardEntry = moduleEntry.boards.find((entry) => entry.id === scopeId);
        if (scopeType === 'board' && boardEntry) return boardEntry.name;
        for (const candidateBoard of moduleEntry.boards) {
          const groupEntry = candidateBoard.groups.find((entry) => entry.id === scopeId);
          if (scopeType === 'group' && groupEntry) return `${candidateBoard.name} / ${groupEntry.name}`;
          const columnEntry = candidateBoard.columns.find((entry) => entry.id === scopeId);
          if (scopeType === 'column' && columnEntry) return `${candidateBoard.name} / ${columnEntry.name}`;
        }
      }
    }
    return 'Estrutura removida';
  }

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'usuário';
  }

  function renderHomePage() {
    document.body.classList.add('atlas-v2-home-page');
    const breadcrumb = document.getElementById('atlas-v2-breadcrumb');
    const root = document.getElementById('atlas-v2-board-content');
    const selection = document.getElementById('atlas-v2-selection-bar');
    if (breadcrumb) breadcrumb.innerHTML = '<span>Atlas</span><span><i data-lucide="chevron-right"></i><b>Início</b></span>';
    if (selection) selection.hidden = true;
    if (!root) return;
    root.className = 'atlas-v2-board-content atlas-v2-home-content';
    const user = currentUser();
    const greeting = greetingForHour(new Date().getHours());
    const version = window.ATNX_CONFIG?.V2_VERSION || ATLAS_BUILD;
    const latest = CHANGELOG[0];
    const updateTopics = groupChangelogNotes(latest?.notes);
    root.innerHTML = `<section class="atlas-v2-home-shell">
      <header class="atlas-v2-home-hero">
        <span class="atlas-v2-home-kicker">ATLAS</span>
        <h1>${escapeHtml(greeting)}, ${escapeHtml(firstName(user?.name))}</h1>
        <p>Escolha uma área, módulo ou quadro no menu ao lado para começar a trabalhar.</p>
      </header>
      <div class="atlas-v2-home-grid">
        <section class="atlas-v2-home-card atlas-v2-home-version-card">
          <header><i data-lucide="rocket"></i><h2>Versão atual</h2></header>
          <strong class="atlas-v2-home-version">${escapeHtml(version)}</strong>
          <small>Última atualização em ${latest ? escapeHtml(formatChangelogDate(latest.date)) : '—'}</small>
        </section>
        <section class="atlas-v2-home-card atlas-v2-home-changelog">
          <header><i data-lucide="sparkles"></i><h2>Atualizações desta versão</h2></header>
          <div class="atlas-v2-home-changelog-list" data-update-count="${latest?.notes?.length || 0}">
            ${updateTopics.map((topic) => `<details class="atlas-v2-update-topic" data-update-topic="${attr(topic.id)}">
              <summary>
                <span class="atlas-v2-update-topic-icon"><i data-lucide="${attr(topic.icon)}"></i></span>
                <span class="atlas-v2-update-topic-copy"><strong>${escapeHtml(topic.title)}</strong><small>${escapeHtml(topic.summary)}</small></span>
                <span class="atlas-v2-update-topic-count">${topic.notes.length}</span>
                <i class="atlas-v2-update-topic-chevron" data-lucide="chevron-down"></i>
              </summary>
              <ul>${topic.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
            </details>`).join('')}
          </div>
        </section>
      </div>
    </section>`;
  }

  function renderAdminPage() {
    document.body.classList.add('atlas-v2-admin-page');
    renderIdentity();
    const breadcrumb = document.getElementById('atlas-v2-breadcrumb');
    const root = document.getElementById('atlas-v2-board-content');
    const selection = document.getElementById('atlas-v2-selection-bar');
    if (breadcrumb) breadcrumb.innerHTML = '<span>Atlas</span><span><i data-lucide="chevron-right"></i><b>Administração</b></span>';
    if (selection) selection.hidden = true;
    if (!root) return;
    root.className = 'atlas-v2-board-content atlas-v2-admin-content';
    const tabs = [
      ['overview', 'Visão geral', 'layout-dashboard'],
      ['users', 'Usuários', 'users'],
      ['permissions', 'Permissões', 'shield-check'],
      ['structure', 'Estrutura', 'network'],
      ['content', 'Campos e modelos', 'blocks'],
      ['audit', 'Auditoria', 'history'],
      ['system', 'Sistema', 'settings'],
    ];
    const tab = tabs.some(([key]) => key === runtime.adminTab) ? runtime.adminTab : 'overview';
    const renderers = {
      overview: renderAdminOverview,
      users: renderAdminUsers,
      permissions: renderAdminPermissions,
      structure: renderAdminStructure,
      content: renderAdminContent,
      audit: renderAdminAudit,
      system: renderAdminSystem,
    };
    root.innerHTML = `<section class="atlas-v2-admin-shell">
      <header class="atlas-v2-admin-hero">
        <span class="atlas-v2-admin-hero-icon"><i data-lucide="shield"></i></span>
        <div><span class="atlas-v2-admin-kicker">CENTRAL DE CONTROLE · V2</span><h1>Administração</h1><p>Usuários, acessos, estrutura e segurança em um único lugar.</p></div>
        <span class="atlas-v2-admin-security"><i data-lucide="shield-check"></i>Admin ativo</span>
      </header>
      <nav class="atlas-v2-admin-tabs" aria-label="Seções administrativas">${tabs.map(([key, label, icon]) => `<button type="button" class="${tab === key ? 'is-active' : ''}" data-action="admin-tab" data-admin-tab="${key}"><i data-lucide="${icon}"></i><span>${label}</span></button>`).join('')}</nav>
      <div class="atlas-v2-admin-panel">${renderers[tab]()}</div>
    </section>`;
  }

  async function openAdminTab(tab) {
    // Mesma guarda das outras acoes administrativas. Hoje so e acionada por uma
    // interface ja protegida, mas esta funcao faz uma leitura direta no Supabase
    // e nao deve depender apenas de quem a chama.
    if (!requirePermission('admin', null, 'abrir a administração')) return;
    runtime.adminTab = tab || 'overview';
    if (runtime.adminTab === 'system' && runtime.remoteMode && runtime.authClient) {
      const { data, error } = await runtime.authClient
        .from('atlas_v2_storage_health')
        .select('id,connection_id,status,latency_ms,detail,created_at')
        .order('created_at', { ascending: false })
        .limit(60);
      if (!error && data) {
        runtime.data.system = runtime.data.system || {};
        runtime.data.system.storageHistory = data.map((entry) => ({
          id: entry.id,
          connectionId: entry.connection_id,
          name: storageConnection(entry.connection_id)?.name || 'Drive removido',
          status: entry.status === 'healthy' ? 'success' : 'error',
          latency: entry.latency_ms,
          detail: entry.detail || '',
          createdAt: entry.created_at,
        }));
      }
    }
    render();
  }


  function renderAdminOverview() {
    const activeUsers = runtime.data.users.filter((entry) => entry.status === 'active').length;
    const pendingUsers = runtime.data.users.filter((entry) => entry.status === 'pending');
    const boards = allBoards();
    const restricted = boards.filter((entry) => entry.board.access !== 'main').length;
    return `<div class="atlas-v2-admin-section-head"><div><span>RESUMO</span><h2>Controle operacional</h2><p>Visão consolidada do ambiente e dos acessos da plataforma.</p></div><div class="atlas-v2-admin-head-actions"><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="admin-sync-users"><i data-lucide="refresh-cw"></i>Atualizar usuários</button></div></div>
      <div class="atlas-v2-admin-metrics">
        ${adminMetric('Usuários ativos', activeUsers, 'users', '#20d6f2')}
        ${adminMetric('Aguardando liberação', pendingUsers.length, 'user-round-check', '#c6ff32')}
        ${adminMetric('Áreas de trabalho', runtime.data.workspaces.length, 'layout-grid', '#ffb020')}
        ${adminMetric('Quadros restritos', restricted, 'lock-keyhole', '#ff4f91')}
      </div>
      <div class="atlas-v2-admin-split">
        <section class="atlas-v2-admin-block"><header><div><span>ENTRADA</span><h3>Solicitações pendentes</h3></div><button type="button" data-action="admin-tab" data-admin-tab="users">Ver usuários</button></header>
          <div class="atlas-v2-admin-list">${pendingUsers.length ? pendingUsers.map((user) => `<div><span class="atlas-v2-avatar">${escapeHtml(user.name.slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></span><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="admin-approve-user" data-user-id="${attr(user.id)}">Liberar</button></div>`).join('') : '<p class="atlas-v2-admin-empty">Nenhum acesso aguardando liberação.</p>'}</div>
        </section>
        <section class="atlas-v2-admin-block"><header><div><span>SEGURANÇA</span><h3>Estado do ambiente</h3></div><button type="button" data-action="admin-tab" data-admin-tab="system">Abrir sistema</button></header>
          <div class="atlas-v2-admin-health"><div><i data-lucide="database"></i><span><strong>Base operacional</strong><small>${runtime.remoteMode ? 'Quadros e registros sincronizados com o Supabase.' : 'Modo local; aplique o SQL completo para conectar a base.'}</small></span><b>${runtime.remoteMode ? 'ONLINE' : 'LOCAL'}</b></div><div><i data-lucide="workflow"></i><span><strong>Automações</strong><small>${(runtime.data.automations || []).filter((entry) => entry.active !== false).length} regra(s) ativa(s) nos quadros.</small></span><b>ATIVAS</b></div><div><i data-lucide="scroll-text"></i><span><strong>Auditoria</strong><small>${runtime.data.auditLog.length} atividade(s) registrada(s).</small></span><b>ATIVA</b></div></div>
        </section>
      </div>`;
  }

  function adminMetric(label, value, icon, color) {
    return `<article class="atlas-v2-admin-metric" style="--metric-color:${color}"><span><i data-lucide="${icon}"></i></span><div><strong>${Number(value)}</strong><small>${escapeHtml(label)}</small></div></article>`;
  }

  function renderAdminUsers() {
    const activeAdmins = runtime.data.users.filter((entry) => entry.role === 'admin' && entry.status === 'active').length;
    const rows = runtime.data.users.map((user) => {
      const protectedAccount = user.id === runtime.data.currentUserId || (user.role === 'admin' && user.status === 'active' && activeAdmins <= 1);
      return `<tr data-admin-user-row="${attr(user.id)}"><td><div class="atlas-v2-admin-user"><span class="atlas-v2-avatar">${escapeHtml(user.name.split(/\s+/).slice(0, 2).map((entry) => entry[0]).join('').toUpperCase())}</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></span></div></td><td>${escapeHtml(user.title || 'Sem cargo')}</td><td><select data-action="admin-user-role" data-user-id="${attr(user.id)}">${Object.entries(ROLE_DEFINITIONS).map(([key, value]) => `<option value="${key}" ${user.role === key ? 'selected' : ''}>${value.label}</option>`).join('')}</select></td><td><select data-action="admin-user-status" data-user-id="${attr(user.id)}">${Object.entries(USER_STATUSES).map(([key, label]) => `<option value="${key}" ${user.status === key ? 'selected' : ''}>${label}</option>`).join('')}</select></td><td>${formatDateTime(user.lastActivity)}</td><td><div class="atlas-v2-admin-actions">${user.status !== 'active' ? `<button type="button" data-action="admin-approve-user" data-user-id="${attr(user.id)}" title="Liberar acesso"><i data-lucide="user-check"></i></button>` : ''}<button class="is-danger" type="button" data-action="admin-delete-user" data-user-id="${attr(user.id)}" title="${protectedAccount ? 'Conta protegida' : 'Excluir usuário'}" ${protectedAccount ? 'disabled' : ''}><i data-lucide="trash-2"></i></button></div></td></tr>`;
    }).join('');
    return `<div class="atlas-v2-admin-section-head"><div><span>IDENTIDADES</span><h2>Usuários e acessos</h2><p>Novos cadastros entram como Visualizador e aguardam liberação.</p></div><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="admin-sync-users"><i data-lucide="refresh-cw"></i>Atualizar usuários</button></div><div class="atlas-v2-admin-table-wrap"><table class="atlas-v2-admin-table"><thead><tr><th>Usuário</th><th>Cargo</th><th>Perfil</th><th>Status</th><th>Última atividade</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderAdminPermissions() {
    const permissions = [['view', 'Visualizar'], ['create', 'Criar'], ['edit', 'Editar'], ['delete', 'Excluir'], ['share', 'Compartilhar'], ['configure', 'Configurar'], ['admin', 'Administrar']];
    const matrix = Object.entries(ROLE_DEFINITIONS).map(([key, role]) => `<tr><td><strong>${role.label}</strong><small>${role.description}</small></td>${permissions.map(([permission]) => `<td>${role.permissions.includes(permission) ? '<i class="is-allowed" data-lucide="check"></i>' : '<i class="is-denied" data-lucide="minus"></i>'}</td>`).join('')}</tr>`).join('');
    const userOptions = runtime.data.users.filter((entry) => entry.status !== 'blocked').map((entry) => `<option value="${attr(entry.id)}">${escapeHtml(entry.name)} · ${roleLabel(entry.role)}</option>`).join('');
    const scopes = scopeOptions().map((entry) => `<option value="${attr(entry.value)}">${escapeHtml(entry.label)}</option>`).join('');
    const rules = runtime.data.accessRules.map((rule) => { const user = runtime.data.users.find((entry) => entry.id === rule.userId); return `<tr><td>${escapeHtml(user?.name || 'Usuário removido')}</td><td>${escapeHtml({ workspace: 'Área', module: 'Módulo', board: 'Quadro', group: 'Grupo', column: 'Coluna', item: 'Obra' }[rule.scopeType] || rule.scopeType)}</td><td>${escapeHtml(scopeName(rule.scopeType, rule.scopeId))}</td><td><span class="atlas-v2-admin-level is-${attr(rule.level)}">${escapeHtml(ACCESS_LEVELS[rule.level]?.label || rule.level)}</span></td><td><button class="atlas-v2-admin-icon-danger" type="button" data-action="admin-delete-rule" data-rule-id="${attr(rule.id)}" title="Remover regra"><i data-lucide="x"></i></button></td></tr>`; }).join('');
    return `<div class="atlas-v2-admin-section-head"><div><span>AUTORIZAÇÃO</span><h2>Perfis e permissões</h2><p>O perfil define a base; regras específicas ajustam uma área, módulo ou quadro.</p></div></div>
      <section class="atlas-v2-admin-block"><header><div><span>MATRIZ</span><h3>Permissões por perfil</h3></div></header><div class="atlas-v2-admin-table-wrap"><table class="atlas-v2-admin-table atlas-v2-permission-matrix"><thead><tr><th>Perfil</th>${permissions.map(([, label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${matrix}</tbody></table></div></section>
      <section class="atlas-v2-admin-block"><header><div><span>EXCEÇÕES</span><h3>Acesso granular</h3></div></header><form id="atlas-v2-admin-permission-form" class="atlas-v2-admin-rule-form"><label><span>Usuário</span><select name="userId">${userOptions}</select></label><label><span>Estrutura</span><select name="scope">${scopes}</select></label><label><span>Nível</span><select name="level">${Object.entries(ACCESS_LEVELS).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join('')}</select></label><button class="atlas-v2-button atlas-v2-button-primary" type="submit"><i data-lucide="plus"></i>Aplicar regra</button></form><div class="atlas-v2-admin-table-wrap"><table class="atlas-v2-admin-table"><thead><tr><th>Usuário</th><th>Escopo</th><th>Destino</th><th>Nível</th><th></th></tr></thead><tbody>${rules || '<tr><td colspan="5">Nenhuma regra específica. Os perfis padrão estão sendo utilizados.</td></tr>'}</tbody></table></div></section>`;
  }

  function structureActions(type, targetId, index, length, canOpen = false) {
    return `<div class="atlas-v2-admin-actions">${canOpen ? `<button type="button" data-action="admin-open-structure" data-structure-type="${type}" data-structure-id="${attr(targetId)}" title="Abrir"><i data-lucide="arrow-up-right"></i></button>` : ''}<button type="button" data-action="admin-move-structure" data-structure-type="${type}" data-structure-id="${attr(targetId)}" data-direction="-1" title="Mover para cima" ${index === 0 ? 'disabled' : ''}><i data-lucide="arrow-up"></i></button><button type="button" data-action="admin-move-structure" data-structure-type="${type}" data-structure-id="${attr(targetId)}" data-direction="1" title="Mover para baixo" ${index === length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down"></i></button><button type="button" data-action="admin-rename-structure" data-structure-type="${type}" data-structure-id="${attr(targetId)}" title="Renomear"><i data-lucide="pencil"></i></button><button class="is-danger" type="button" data-action="admin-delete-structure" data-structure-type="${type}" data-structure-id="${attr(targetId)}" title="Mover para lixeira"><i data-lucide="trash-2"></i></button></div>`;
  }

  function renderAdminStructure() {
    const rows = runtime.data.workspaces.map((workspace, workspaceIndex) => {
      const boardCount = workspace.modules.reduce((total, module) => total + module.boards.length, 0);
      const modules = workspace.modules.map((module, moduleIndex) => {
        const boards = module.boards.map((boardEntry, boardIndex) => `<div class="atlas-v2-admin-structure-row is-board"><span class="atlas-v2-admin-tree-line"></span><i data-lucide="${attr(boardEntry.icon || 'table-2')}"></i><span><strong>${escapeHtml(boardEntry.name)}</strong><small>${escapeHtml(ACCESS[boardEntry.access]?.label || 'Organizacional')} · ${boardEntry.columns.length} coluna(s)</small></span>${structureActions('board', boardEntry.id, boardIndex, module.boards.length, true)}</div>`).join('');
        return `<div class="atlas-v2-admin-structure-row is-module"><span class="atlas-v2-admin-tree-line"></span><i data-lucide="${attr(module.icon || 'boxes')}"></i><span><strong>${escapeHtml(module.name)}</strong><small>${module.boards.length} quadro(s)${module.parentId ? ' · Submódulo' : ''}</small></span>${structureActions('module', module.id, moduleIndex, workspace.modules.length)}</div>${boards}`;
      }).join('');
      return `<section class="atlas-v2-admin-workspace"><div class="atlas-v2-admin-structure-row is-workspace"><span class="atlas-v2-workspace-mark" style="background:${attr(workspace.color || '#0f6cbd')}">${escapeHtml(workspace.name.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(workspace.name)}</strong><small>${workspace.modules.length} módulo(s) · ${boardCount} quadro(s) · ${escapeHtml(ACCESS[workspace.access]?.label || 'Organizacional')}</small></span>${structureActions('workspace', workspace.id, workspaceIndex, runtime.data.workspaces.length)}</div>${modules}</section>`;
    }).join('');
    return `<div class="atlas-v2-admin-section-head"><div><span>ARQUITETURA</span><h2>Áreas, módulos e quadros</h2><p>Organize a estrutura sem alterar código ou SQL.</p></div><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="admin-create-structure"><i data-lucide="plus"></i>Criar estrutura</button></div><div class="atlas-v2-admin-structure">${rows}</div>`;
  }

  function renderAdminContent() {
    const context = findBoard();
    const columns = context?.board?.columns || [];
    const customTemplates = runtime.data.templates || [];
    const fields = runtime.data.fieldTemplates || [];
    const columnRows = columns.map((entry) => `<div class="atlas-v2-admin-content-row"><i data-lucide="${attr(COLUMN_TYPES[entry.type]?.icon || 'type')}"></i><span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(COLUMN_TYPES[entry.type]?.label || entry.type)} · ${Number(entry.width || 160)} px</small></span><div class="atlas-v2-admin-actions"><button type="button" data-action="admin-save-field" data-column-id="${attr(entry.id)}" title="Salvar na biblioteca"><i data-lucide="bookmark-plus"></i></button><button type="button" data-action="edit-column" data-column-id="${attr(entry.id)}" title="Editar campo"><i data-lucide="pencil"></i></button></div></div>`).join('');
    const fieldRows = fields.map((entry) => `<div class="atlas-v2-admin-content-row"><i data-lucide="${attr(COLUMN_TYPES[entry.type]?.icon || 'type')}"></i><span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(COLUMN_TYPES[entry.type]?.label || entry.type)}${entry.source ? ` · ${escapeHtml(entry.source)}` : ''}</small></span><div class="atlas-v2-admin-actions"><button type="button" data-action="admin-use-field" data-field-id="${attr(entry.id)}" title="Adicionar ao quadro atual"><i data-lucide="plus"></i></button><button class="is-danger" type="button" data-action="admin-delete-field" data-field-id="${attr(entry.id)}" title="Remover da biblioteca"><i data-lucide="trash-2"></i></button></div></div>`).join('');
    const templateRows = customTemplates.map((entry) => `<div class="atlas-v2-admin-content-row"><i data-lucide="layout-template"></i><span><strong>${escapeHtml(entry.name)}</strong><small>${entry.columns?.length || 0} coluna(s) · ${entry.groups?.length || 0} grupo(s)</small></span><div class="atlas-v2-admin-actions"><button class="is-danger" type="button" data-action="admin-delete-template" data-template-id="${attr(entry.id)}" title="Excluir modelo"><i data-lucide="trash-2"></i></button></div></div>`).join('');
    return `<div class="atlas-v2-admin-section-head"><div><span>REUTILIZAÇÃO</span><h2>Campos e modelos</h2><p>Padronize estruturas e reaproveite configurações em novos quadros.</p></div><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="admin-save-template"><i data-lucide="layout-template"></i>Salvar quadro como modelo</button></div>
      <div class="atlas-v2-admin-split"><section class="atlas-v2-admin-block"><header><div><span>QUADRO ATUAL</span><h3>${escapeHtml(context?.board?.name || 'Nenhum quadro')}</h3></div><button type="button" data-action="add-column">Nova coluna</button></header><div class="atlas-v2-admin-content-list">${columnRows || '<p class="atlas-v2-admin-empty">Nenhuma coluna configurada.</p>'}</div></section><section class="atlas-v2-admin-block"><header><div><span>BIBLIOTECA</span><h3>Campos reutilizáveis</h3></div></header><div class="atlas-v2-admin-content-list">${fieldRows || '<p class="atlas-v2-admin-empty">Salve uma coluna para reutilizá-la.</p>'}</div></section></div>
      <section class="atlas-v2-admin-block"><header><div><span>MODELOS DE QUADRO</span><h3>Estruturas disponíveis</h3></div></header><div class="atlas-v2-admin-template-grid"><div><i data-lucide="folder-kanban"></i><span><strong>Gestão de projetos</strong><small>Modelo padrão do sistema</small></span></div><div><i data-lucide="wrench"></i><span><strong>Manutenção operacional</strong><small>Modelo padrão do sistema</small></span></div>${templateRows || ''}</div></section>`;
  }

  function renderAdminAudit() {
    const rows = (runtime.data.auditLog || []).map((entry) => { const user = runtime.data.users.find((candidate) => candidate.id === entry.userId); const boardEntry = allBoards().find((candidate) => candidate.board.id === entry.boardId); return `<tr><td>${formatDateTime(entry.createdAt)}</td><td>${escapeHtml(user?.name || 'Sistema')}</td><td><strong>${escapeHtml(entry.action)}</strong></td><td>${escapeHtml(boardEntry?.board?.name || (entry.scope === 'system' ? 'Sistema' : 'Estrutura removida'))}</td></tr>`; }).join('');
    return `<div class="atlas-v2-admin-section-head"><div><span>RASTREABILIDADE</span><h2>Auditoria</h2><p>Histórico das alterações realizadas nesta estrutura oficial.</p></div><span class="atlas-v2-admin-count">${runtime.data.auditLog.length} evento(s)</span></div><div class="atlas-v2-admin-table-wrap"><table class="atlas-v2-admin-table"><thead><tr><th>Data e hora</th><th>Usuário</th><th>Ação</th><th>Contexto</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nenhuma atividade registrada.</td></tr>'}</tbody></table></div>`;
  }

  function storageUsageCount(connectionId) {
    let count = 0;
    runtime.data.workspaces.forEach((workspace) => {
      if (workspace.storageConnectionId === connectionId) count += 1;
      workspace.modules.forEach((module) => {
        if (module.storageConnectionId === connectionId) count += 1;
        module.boards.forEach((boardEntry) => { if (boardEntry.storageConnectionId === connectionId) count += 1; });
      });
    });
    return count;
  }

  function renderAdminSystem() {
    const statusLabels = { prepared: 'Preparado', inherited: 'Herdado', waiting: 'Aguardando', connected: 'Conectado' };
    const integrations = (runtime.data.system?.integrations || []).map((entry) => `<div class="atlas-v2-admin-integration"><span class="is-${attr(entry.status)}"><i data-lucide="${entry.id === 'supabase' ? 'database' : entry.id === 'drive' ? 'hard-drive' : 'radio'}"></i></span><span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.detail)}</small></span><b class="is-${attr(entry.status)}">${escapeHtml(statusLabels[entry.status] || entry.status)}</b></div>`).join('');
    const storageRows = (runtime.data.storageConnections || []).map((entry) => {
      const usage = storageUsageCount(entry.id);
      const ageDays = entry.verifiedAt ? Math.floor((Date.now() - new Date(entry.verifiedAt).getTime()) / 86400000) : null;
      const warning = entry.status !== 'connected' ? ' · ATENÇÃO: conexão não validada' : ageDays !== null && ageDays > 30 ? ` · Teste antigo (${ageDays} dias)` : '';
      const detail = entry.accountEmail || entry.folderId
        ? `${entry.accountEmail || 'Conta setorial'}${entry.folderId ? ` · Pasta ${entry.folderId.slice(0, 10)}...` : ''}`
        : 'Conexão existente; abra para revisar ou completar os dados.';
      return `<div class="atlas-v2-admin-storage-row"><span><i data-lucide="hard-drive"></i></span><span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.sector)} · ${escapeHtml(detail)} · ${usage} uso(s)${escapeHtml(warning)}</small></span><b class="is-${attr(entry.status)}">${escapeHtml(storageStatusLabel(entry.status))}</b><button type="button" data-action="admin-organize-storage" data-storage-id="${attr(entry.id)}" title="Organizar arquivos existentes"><i data-lucide="folder-tree"></i></button><button type="button" data-action="admin-edit-storage" data-storage-id="${attr(entry.id)}" title="Configurar conexão"><i data-lucide="settings-2"></i></button></div>`;
    }).join('');
    const trash = (runtime.data.trash || []).map((entry) => `<div class="atlas-v2-admin-trash-row"><i data-lucide="trash-2"></i><span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.type)} · ${formatDateTime(entry.deletedAt)}</small></span><button type="button" data-action="admin-restore-trash" data-trash-id="${attr(entry.id)}" title="Restaurar"><i data-lucide="undo-2"></i></button><button class="is-danger" type="button" data-action="admin-purge-trash" data-trash-id="${attr(entry.id)}" title="Excluir definitivamente"><i data-lucide="x"></i></button></div>`).join('');
    const errors = (runtime.data.errors || []).map((entry) => `<div class="atlas-v2-admin-trash-row"><i data-lucide="triangle-alert"></i><span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.detail || '')}</small></span></div>`).join('');
    const health = runtime.healthChecks.map((entry) => `<div class="atlas-v2-health-check is-${attr(entry.status)}"><i data-lucide="${entry.status === 'ok' ? 'circle-check-big' : entry.status === 'running' ? 'loader-circle' : 'circle-alert'}"></i><span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.detail)}</small></span><b>${entry.latency === null ? '--' : `${entry.latency} ms`}</b></div>`).join('');
    const storageHistory = (runtime.data.system?.storageHistory || []).slice(0, 12).map((entry) => `<tr><td>${formatDateTime(entry.createdAt)}</td><td>${escapeHtml(entry.name)}</td><td>${escapeHtml(entry.status === 'success' ? 'Sucesso' : 'Falha')}</td><td>${entry.latency ?? '--'} ms</td><td>${escapeHtml(entry.detail || '')}</td></tr>`).join('');
    return `<div class="atlas-v2-admin-section-head"><div><span>AMBIENTE</span><h2>Sistema e integrações</h2><p>Diagnóstico, armazenamento setorial, backup e recuperação do Atlas V2.</p></div><div class="atlas-v2-admin-head-actions"><button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="admin-health-check"><i data-lucide="activity"></i>Executar diagnóstico</button><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="admin-export"><i data-lucide="download"></i>Exportar backup</button></div></div>${health ? `<section class="atlas-v2-admin-block"><header><div><span>SAÚDE DO SISTEMA</span><h3>Verificação em tempo real</h3></div></header><div class="atlas-v2-health-grid">${health}</div></section>` : ''}<div class="atlas-v2-admin-split"><section class="atlas-v2-admin-block"><header><div><span>CONEXÕES</span><h3>Integrações</h3></div></header><div class="atlas-v2-admin-integrations">${integrations}</div></section><section class="atlas-v2-admin-block"><header><div><span>DIAGNÓSTICO</span><h3>Central de erros</h3></div></header>${errors || '<p class="atlas-v2-admin-empty">Nenhuma falha registrada.</p>'}</section></div><section class="atlas-v2-admin-block atlas-v2-admin-storage"><header><div><span>GOOGLE DRIVE POR SETOR</span><h3>Contas e pastas conectadas</h3></div><button type="button" data-action="admin-new-storage"><i data-lucide="plus"></i>Nova conexão</button></header><div>${storageRows || '<p class="atlas-v2-admin-empty">Nenhum Drive cadastrado.</p>'}</div></section>${storageHistory ? `<section class="atlas-v2-admin-block"><header><div><span>HISTÓRICO DO DRIVE</span><h3>Últimos testes de conexão</h3></div></header><div class="atlas-v2-admin-table-wrap"><table class="atlas-v2-admin-table"><thead><tr><th>Data</th><th>Conexão</th><th>Resultado</th><th>Latência</th><th>Detalhe</th></tr></thead><tbody>${storageHistory}</tbody></table></div></section>` : ''}<section class="atlas-v2-admin-block"><header><div><span>RECUPERAÇÃO</span><h3>Lixeira</h3></div><b>${runtime.data.trash.length} item(ns)</b></header><div class="atlas-v2-admin-trash">${trash || '<p class="atlas-v2-admin-empty">A lixeira está vazia.</p>'}</div></section>`;
  }

  async function runSystemHealthCheck() {
    if (!requirePermission('admin', null, 'executar o diagnóstico')) return;
    const checks = [
      { id: 'browser', name: 'Navegador e cache local', status: 'running', detail: 'Verificando armazenamento...', latency: null },
      { id: 'supabase', name: 'Supabase e autenticação', status: 'running', detail: 'Consultando a base...', latency: null },
      { id: 'realtime', name: 'Atualizações em tempo real', status: 'running', detail: 'Verificando o canal...', latency: null },
      ...(runtime.data.storageConnections || []).map((entry) => ({ id: `drive:${entry.id}`, name: entry.name, connection: entry, status: 'running', detail: 'Testando o Drive setorial...', latency: null })),
    ];
    runtime.healthChecks = checks;
    renderAdminPage();
    refreshIcons(document.getElementById('atlas-v2-board-content'));
    const measure = async (entry, operation) => {
      const started = performance.now();
      try {
        const detail = await operation();
        Object.assign(entry, { status: 'ok', detail: detail || 'Operação normal.', latency: Math.round(performance.now() - started) });
      } catch (error) {
        Object.assign(entry, { status: 'error', detail: error.message || String(error), latency: Math.round(performance.now() - started) });
      }
    };
    await measure(checks[0], async () => {
      localStorage.setItem('atlas-v2-health-probe', String(Date.now()));
      localStorage.removeItem('atlas-v2-health-probe');
      return navigator.onLine ? 'Cache disponível e navegador online.' : 'Cache disponível; navegador offline.';
    });
    await measure(checks[1], async () => {
      if (!runtime.authClient || !runtime.authSession) throw new Error('Sessão do Supabase indisponível.');
      const { error } = await runtime.authClient.from('atlas_profiles').select('id', { head: true, count: 'exact' }).limit(1);
      if (error) throw error;
      return 'Autenticação e Data API respondendo.';
    });
    await measure(checks[2], async () => {
      if (runtime.realtimeStatus !== 'connected') throw new Error(`Canal em estado ${runtime.realtimeStatus}.`);
      return 'Canal conectado e monitor ativo.';
    });
    for (const entry of checks.filter((candidate) => candidate.connection)) {
      await measure(entry, async () => {
        const connection = entry.connection;
        if (!connection.appScriptUrl || !connection.folderId) throw new Error('Conexão incompleta.');
        await testStorageEndpoint(connection.appScriptUrl, connection.folderId, storageModule(connection));
        return `${connection.sector} disponível para gravação.`;
      });
    }
    renderAdminPage();
    refreshIcons(document.getElementById('atlas-v2-board-content'));
  }

  function openStorageConnectionModal(connectionId = '') {
    if (!requirePermission('admin', null, 'configurar o Google Drive')) return;
    const connection = storageConnection(connectionId);
    const tipo = storageType(connection);
    const preset = STORAGE_TYPES[tipo];
    // A raiz do Drive e um LINK; a do servidor local e um caminho relativo. Por
    // isso o campo nao pode ser type="url" fixo, senao o navegador recusa
    // "documentacao/rede-geral" antes do nosso proprio validador rodar.
    const rootValue = connection?.folderUrl
      || (connection?.folderId ? (tipo === 'local' ? connection.folderId : `https://drive.google.com/drive/folders/${connection.folderId}`) : '');
    openModal({
      title: connection ? 'Configurar armazenamento do setor' : 'Nova conexão de armazenamento',
      subtitle: 'Google Drive via Apps Script, ou um servidor próprio que implemente o mesmo contrato do conector.',
      body: `<form id="atlas-v2-storage-form" class="atlas-v2-form-grid">
        <input type="hidden" name="connectionId" value="${attr(connection?.id || '')}">
        <input type="hidden" name="driveVerified" value="${connection?.status === 'connected' ? '1' : '0'}">
        <input type="hidden" name="connectorVersion" value="${attr(connection?.connectorVersion || '')}">
        <label class="atlas-v2-field is-wide"><span>Tipo de armazenamento</span><select name="driveType">${Object.entries(STORAGE_TYPES).map(([key, value]) => `<option value="${key}" ${key === tipo ? 'selected' : ''}>${escapeHtml(value.label)}</option>`).join('')}</select></label>
        <label class="atlas-v2-field"><span>Nome da conexão</span><input name="driveName" required maxlength="70" value="${attr(connection?.name || '')}" placeholder="Ex.: Drive do PMO"></label>
        <label class="atlas-v2-field"><span>Setor responsável</span><input name="driveSector" required maxlength="70" value="${attr(connection?.sector || '')}" placeholder="Ex.: PMO"></label>
        <label class="atlas-v2-field is-wide" data-storage-field="email" ${tipo === 'local' ? 'hidden' : ''}><span>Conta Google do setor</span><input name="driveEmail" type="email" ${tipo === 'local' ? '' : 'required'} value="${attr(connection?.accountEmail || '')}" placeholder="setor@empresa.com"></label>
        <label class="atlas-v2-field is-wide"><span data-storage-label="root">${escapeHtml(preset.rootLabel)}</span><input name="driveFolderUrl" required value="${attr(rootValue)}" placeholder="${attr(preset.rootPlaceholder)}"></label>
        <label class="atlas-v2-field is-wide"><span data-storage-label="url">${escapeHtml(preset.urlLabel)}</span><input name="driveAppScriptUrl" type="url" required value="${attr(connection?.appScriptUrl || '')}" placeholder="${attr(preset.urlPlaceholder)}"></label>
        <div class="atlas-v2-storage-test is-wide"><button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="test-admin-storage"><i data-lucide="plug-zap"></i>Testar conexão</button><span id="atlas-v2-admin-storage-status">${connection?.status === 'connected' ? 'Conexão validada. Teste novamente se alterar algum dado.' : 'O teste confirma a conta, o conector e a permissão de escrita.'}</span></div>
      </form>`,
      actions: '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-storage-form"><i data-lucide="save"></i>Salvar conexão</button>',
    });
  }

  // Reaplica rotulo, dica e obrigatoriedade dos campos do formulario de conexao
  // conforme o tipo escolhido. Serve para os dois formularios que existem (o do
  // Admin e o do assistente de criacao), por isso trabalha sobre o form recebido
  // e nao sobre ids fixos.
  function applyStorageTypeToForm(form) {
    if (!form) return;
    const tipo = storageType({ type: form.elements?.driveType?.value });
    const preset = STORAGE_TYPES[tipo];
    const rootLabel = form.querySelector('[data-storage-label="root"]');
    const urlLabel = form.querySelector('[data-storage-label="url"]');
    const rootInput = form.elements?.driveFolderUrl;
    const urlInput = form.elements?.driveAppScriptUrl;
    const emailField = form.querySelector('[data-storage-field="email"]');
    if (rootLabel) rootLabel.textContent = preset.rootLabel;
    if (urlLabel) urlLabel.textContent = preset.urlLabel;
    if (rootInput) rootInput.placeholder = preset.rootPlaceholder;
    if (urlInput) urlInput.placeholder = preset.urlPlaceholder;
    if (emailField) {
      // Conta Google nao se aplica ao conector local. Esconder sem tirar o
      // `required` deixaria o formulario impossivel de enviar, sem dizer por que.
      emailField.hidden = tipo === 'local';
      const emailInput = form.elements?.driveEmail;
      if (emailInput) emailInput.required = tipo !== 'local';
    }
  }

  function setAdminStorageStatus(message, state = '') {
    const status = document.getElementById('atlas-v2-admin-storage-status');
    if (!status) return;
    status.className = state ? `is-${state}` : '';
    status.textContent = message;
  }

  function recordStorageTest(connectionId, name, status, latency, detail) {
    runtime.data.system = runtime.data.system || {};
    runtime.data.system.storageHistory = runtime.data.system.storageHistory || [];
    runtime.data.system.storageHistory.unshift({ id: id('storage-test'), connectionId, name, status, latency, detail, createdAt: new Date().toISOString() });
    runtime.data.system.storageHistory = runtime.data.system.storageHistory.slice(0, 60);
    if (runtime.remoteMode && runtime.authClient && isUuid(connectionId)) {
      void runtime.authClient.from('atlas_v2_storage_health').insert({
        connection_id: connectionId,
        status: status === 'success' ? 'healthy' : 'error',
        latency_ms: Number.isFinite(Number(latency)) ? Number(latency) : null,
        detail: String(detail || ''),
      });
    }
  }

  async function testAdminStorageConnection() {
    const form = document.getElementById('atlas-v2-storage-form');
    if (!form) return;
    // Cada chamada tem sua propria "vez" (requestToken). Se o usuario clicar
    // em testar de novo antes desta terminar, a resposta desta chamada -
    // mesmo que chegue depois - e descartada: sem isso, um teste antigo e
    // lento podia sobrescrever driveVerified de volta para "1" depois que um
    // teste mais recente ja tinha marcado a conexao como invalida.
    const requestToken = (form._atlasStorageTestToken = (form._atlasStorageTestToken || 0) + 1);
    const connectionId = String(form.elements.connectionId.value || '');
    const draft = storageDraftFromForm(form);
    const error = validateStorageDraft(draft, connectionId);
    form.elements.driveVerified.value = '0';
    if (error) return setAdminStorageStatus(error, 'error');
    setAdminStorageStatus('Testando acesso de escrita na pasta...', 'testing');
    const started = performance.now();
    try {
      const result = await testStorageEndpoint(draft.appScriptUrl, draft.folderId, storageModule(draft));
      if (form._atlasStorageTestToken !== requestToken) return;
      form.elements.driveVerified.value = '1';
      form.elements.connectorVersion.value = String(result.connectorVersion || result.version || '').trim();
      const connection = storageConnection(connectionId);
      if (connection) {
        connection.verifiedAt = new Date().toISOString();
        connection.connectorVersion = form.elements.connectorVersion.value || connection.connectorVersion || '';
      }
      recordStorageTest(connectionId, draft.name, 'success', Math.round(performance.now() - started), result.folderName || 'Pasta validada para gravação.');
      setAdminStorageStatus(result.legacy ? 'Conector V1.4 compatível validado para este setor.' : `Conexão validada${result.folderName ? `: ${result.folderName}` : ''}.`, 'success');
    } catch (error) {
      if (form._atlasStorageTestToken !== requestToken) return;
      recordStorageTest(connectionId, draft.name, 'error', Math.round(performance.now() - started), error.message || 'Falha ao validar a conexão.');
      setAdminStorageStatus(error.message || 'Falha ao validar a conexão.', 'error');
    }
    persistLocalBackup(runtime.data);
  }

  function submitStorageConnection(form) {
    if (!requirePermission('admin', null, 'salvar a conexão do Google Drive')) return;
    const connectionId = String(form.elements.connectionId.value || '');
    const draft = storageDraftFromForm(form);
    const error = validateStorageDraft(draft, connectionId);
    if (error) return setAdminStorageStatus(error, 'error');
    if (form.elements.driveVerified.value !== '1') return setAdminStorageStatus('Teste a conexão antes de salvar.', 'error');
    const existing = storageConnection(connectionId);
    const payload = { ...draft, status: 'connected', module: existing?.module || 'custom', verifiedAt: new Date().toISOString() };
    const savedConnection = existing || { id: id('storage'), ...payload, createdAt: new Date().toISOString() };
    if (existing) Object.assign(existing, payload);
    else runtime.data.storageConnections.push(savedConnection);
    const linkedScope = storageUsageCount(savedConnection.id) ? '' : assignStorageConnectionToMatchingScope(savedConnection);
    closeOverlay();
    saveData(`${existing ? 'Conexão de Drive atualizada' : 'Conexão de Drive cadastrada'}${linkedScope ? ` e vinculada ao ${linkedScope}` : ''}`);
    render();
  }

  function openAdministration(tab = 'overview') {
    if (!requirePermission('admin', null, 'abrir a Administração')) return;
    runtime.page = 'admin';
    runtime.adminTab = tab;
    runtime.selectedItems.clear();
    closeOverlay();
    closeSidebar();
    render();
    syncAuthUsersFromSupabase({ notify: false });
  }

  function openHome() {
    runtime.page = 'home';
    runtime.selectedItems.clear();
    closeOverlay();
    closeSidebar();
    render();
  }

  function openUserMenu() {
    const user = currentUser();
    openModal({
      title: 'Conta',
      subtitle: `${user?.name || 'Usuário'} · ${roleLabel(user?.role)}`,
      body: `<div class="atlas-v2-settings-list">${hasPermission('admin', null) ? '<button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="open-administration"><i data-lucide="shield"></i>Central de Administração</button>' : ''}<button class="atlas-v2-button atlas-v2-button-danger" type="button" data-auth-action="logout"><i data-lucide="log-out"></i>Sair do Atlas</button></div>`,
      actions: '<button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="close-overlay">Fechar</button>',
    });
  }

  function openAdminUserModal() {
    // Com o Supabase conectado, a conta precisa nascer no Auth. Isso so acontece
    // quando a propria pessoa usa "Solicitar cadastro" na tela de entrada: o
    // frontend nao tem (e nao deve ter) credencial administrativa para criar
    // contas. Cadastrar aqui criaria apenas uma linha local, que desapareceria
    // na proxima sincronizacao de perfis.
    if (runtime.remoteMode) {
      openModal({
        title: 'Como liberar um novo acesso',
        subtitle: 'A conta é criada pela própria pessoa e liberada aqui por um administrador.',
        body: '<div class="atlas-v2-admin-note"><p>Peça para a pessoa abrir o Atlas e usar <strong>Primeiro acesso? Solicitar cadastro</strong> na tela de entrada, com o e-mail corporativo dela.</p><p>Assim que o cadastro for enviado, ela aparece nesta aba como <strong>Pendente</strong>. Use então o botão <strong>Liberar</strong> e defina o perfil de acesso.</p><p>O Atlas não cria contas a partir daqui por segurança: a criação de contas exige credencial administrativa do banco, que nunca fica disponível no navegador.</p></div>',
        actions: '<button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="close-overlay">Entendi</button>',
      });
      return;
    }
    openModal({
      title: 'Cadastrar acesso',
      subtitle: 'O usuário será criado como Visualizador aguardando liberação.',
      body: '<form id="atlas-v2-admin-user-form" class="atlas-v2-form-grid"><label class="atlas-v2-field is-wide"><span>Nome</span><input name="name" required maxlength="80" autofocus placeholder="Nome do usuário"></label><label class="atlas-v2-field is-wide"><span>E-mail</span><input name="email" type="email" required maxlength="160" placeholder="nome@empresa.com"></label><label class="atlas-v2-field is-wide"><span>Cargo</span><input name="title" maxlength="100" placeholder="Ex.: Analista de documentação"></label></form>',
      actions: '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-admin-user-form"><i data-lucide="user-plus"></i>Criar solicitação</button>',
    });
  }

  function submitAdminUser(form) {
    if (!requirePermission('admin', null, 'cadastrar usuários')) return;
    if (runtime.remoteMode) {
      // Guarda extra: nao criar registro fantasma se este formulario for
      // acionado com o Supabase conectado. Ver openAdminUserModal.
      toast('Com o Supabase conectado, a conta precisa ser criada pela própria pessoa em "Solicitar cadastro". Depois libere o acesso aqui.', true);
      return;
    }
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim().toLowerCase();
    if (runtime.data.users.some((entry) => entry.email.toLowerCase() === email)) {
      toast('Já existe um usuário com este e-mail', true);
      return;
    }
    runtime.data.users.push({ id: id('user'), name: String(data.get('name') || '').trim(), email, role: 'visualizador', status: 'pending', title: String(data.get('title') || '').trim(), lastActivity: null });
    closeOverlay();
    runtime.adminTab = 'users';
    saveData('Solicitação de acesso criada', { scope: 'system' });
    render();
  }

  function activeAdminCount() {
    return runtime.data.users.filter((entry) => entry.role === 'admin' && entry.status === 'active').length;
  }

  async function updateAdminUser(userId, field, value) {
    if (!requirePermission('admin', null, 'gerenciar usuários')) return;
    const user = runtime.data.users.find((entry) => entry.id === userId);
    if (!user || !['role', 'status'].includes(field)) return;
    const removesLastAdmin = user.role === 'admin' && user.status === 'active' && activeAdminCount() <= 1 && ((field === 'role' && value !== 'admin') || (field === 'status' && value !== 'active'));
    if (removesLastAdmin) {
      toast('Ative outro Admin antes de alterar o último administrador', true);
      render();
      return;
    }
    const previous = user[field];
    user[field] = value;
    render();
    try {
      if (runtime.authClient && runtime.authSession) {
        const databaseValue = field === 'status' ? PROFILE_STATUS_TO_DATABASE[value] : value;
        const { error } = await runtime.authClient.rpc('atlas_admin_update_profile_access', {
          p_user_id: userId,
          p_role: field === 'role' ? databaseValue : null,
          p_status: field === 'status' ? databaseValue : null,
        });
        if (error) throw error;
      }
      if (field === 'status' && value === 'active') user.lastActivity = new Date().toISOString();
      saveData(`${field === 'role' ? 'Perfil' : 'Status'} de ${user.name} atualizado`, { scope: 'system' });
      toast(`${field === 'role' ? 'Perfil' : 'Status'} atualizado no Supabase`);
      render();
    } catch (error) {
      user[field] = previous;
      render();
      toast(authErrorMessage(error), true);
    }
  }

  async function approveAdminUser(userId) {
    await updateAdminUser(userId, 'status', 'active');
  }

  function openDeleteAdminUser(userId) {
    const user = runtime.data.users.find((entry) => entry.id === userId);
    if (!user || user.id === runtime.data.currentUserId || (user.role === 'admin' && user.status === 'active' && activeAdminCount() <= 1)) return;
    openModal({
      title: 'Excluir usuário',
      subtitle: user.name,
      body: `<div class="atlas-v2-confirm-card"><i data-lucide="triangle-alert"></i><div><strong>A conta será removida permanentemente.</strong><p>Os registros operacionais e o histórico atribuídos a ${escapeHtml(user.name)} serão preservados.</p></div></div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-action="admin-confirm-delete-user" data-user-id="${attr(user.id)}"><i data-lucide="trash-2"></i>Excluir usuário</button>`,
    });
  }

  async function deleteAdminUser(userId) {
    if (!requirePermission('admin', null, 'excluir usuários')) return;
    const user = runtime.data.users.find((entry) => entry.id === userId);
    if (!user || user.id === runtime.data.currentUserId || (user.role === 'admin' && user.status === 'active' && activeAdminCount() <= 1)) return;
    try {
      if (runtime.authClient && runtime.authSession) {
        const { error } = await runtime.authClient.rpc('atlas_delete_user', { p_user_id: userId });
        if (error) throw error;
      }
      runtime.data.users = runtime.data.users.filter((entry) => entry.id !== userId);
      runtime.data.accessRules = runtime.data.accessRules.filter((entry) => entry.userId !== userId);
      runtime.data.boardMembers = runtime.data.boardMembers.filter((entry) => entry.userId !== userId);
      closeOverlay();
      saveData(`Usuário ${user.name} excluído`, { scope: 'system' });
      render();
    } catch (error) {
      toast(authErrorMessage(error), true);
    }
  }

  function submitAdminPermission(form) {
    if (!requirePermission('admin', null, 'configurar permissões')) return;
    const data = new FormData(form);
    const [scopeType, scopeId] = String(data.get('scope') || '').split(':');
    const userId = String(data.get('userId') || '');
    const level = String(data.get('level') || 'viewer');
    if (!userId || !scopeId || !ACCESS_LEVELS[level]) return;
    const existing = runtime.data.accessRules.find((entry) => entry.userId === userId && entry.scopeType === scopeType && entry.scopeId === scopeId);
    if (existing) existing.level = level;
    else runtime.data.accessRules.push({ id: id('rule'), userId, scopeType, scopeId, level });
    saveData('Regra granular de acesso atualizada', { scope: 'system' });
    render();
  }

  function deleteAdminRule(ruleId) {
    if (!requirePermission('admin', null, 'remover permissões')) return;
    runtime.data.accessRules = runtime.data.accessRules.filter((entry) => entry.id !== ruleId);
    saveData('Regra granular de acesso removida', { scope: 'system' });
    render();
  }

  function findStructure(type, targetId) {
    if (type === 'workspace') {
      const index = runtime.data.workspaces.findIndex((entry) => entry.id === targetId);
      return index >= 0 ? { entry: runtime.data.workspaces[index], collection: runtime.data.workspaces, index } : null;
    }
    for (const workspace of runtime.data.workspaces) {
      if (type === 'module') {
        const index = workspace.modules.findIndex((entry) => entry.id === targetId);
        if (index >= 0) return { entry: workspace.modules[index], collection: workspace.modules, index, workspace };
      }
      for (const module of workspace.modules) {
        if (type === 'board') {
          const index = module.boards.findIndex((entry) => entry.id === targetId);
          if (index >= 0) return { entry: module.boards[index], collection: module.boards, index, workspace, module };
        }
      }
    }
    return null;
  }

  // Acervo pequeno e fixo de icones para modulos - todos ja existentes no
  // pacote do Lucide usado pelo Atlas, entao nao ha risco de escolher um
  // nome de icone que nao renderize.
  const MODULE_ICON_CHOICES = [
    ['folder', 'Pasta'],
    ['boxes', 'Módulos'],
    ['folder-tree', 'Estrutura'],
    ['layout-grid', 'Grade'],
    ['layout-dashboard', 'Painel'],
    ['table-2', 'Tabela'],
    ['briefcase-business', 'Operação'],
    ['route', 'Rota'],
    ['network', 'Rede'],
    ['list-tree', 'Hierarquia'],
    ['layers-3', 'Camadas'],
    ['database', 'Dados'],
  ];

  function openRenameStructure(type, targetId) {
    const found = findStructure(type, targetId);
    if (!found) return;
    const iconPicker = type === 'module'
      ? `<div class="atlas-v2-field is-wide"><span>Ícone do módulo</span><div class="atlas-v2-choice-grid">${MODULE_ICON_CHOICES.map(([iconName, label]) => choice('icon', iconName, iconName, label, (found.entry.icon || 'folder') === iconName)).join('')}</div></div>`
      : '';
    openModal({ title: `Renomear ${{ workspace: 'área', module: 'módulo', board: 'quadro' }[type] || 'estrutura'}`, subtitle: found.entry.name, body: `<form id="atlas-v2-admin-structure-form" class="atlas-v2-form-grid"><input type="hidden" name="type" value="${attr(type)}"><input type="hidden" name="targetId" value="${attr(targetId)}"><label class="atlas-v2-field"><span>Novo nome</span><input name="name" value="${attr(found.entry.name)}" maxlength="80" required autofocus></label>${iconPicker}</form>`, actions: '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-admin-structure-form">Salvar</button>' });
  }

  function submitRenameStructure(form) {
    if (!requirePermission('admin', null, 'renomear estruturas')) return;
    const data = new FormData(form);
    const type = String(data.get('type') || '');
    const found = findStructure(type, String(data.get('targetId') || ''));
    const name = String(data.get('name') || '').trim();
    if (!found || !name) return;
    found.entry.name = name;
    if (type === 'module') {
      const icon = String(data.get('icon') || '').trim();
      if (icon) found.entry.icon = icon;
    }
    closeOverlay();
    saveData('Estrutura renomeada', { scope: 'system' });
    render();
  }

  function moveAdminStructure(type, targetId, direction) {
    if (!requirePermission('admin', null, 'reordenar estruturas')) return;
    const found = findStructure(type, targetId);
    const destination = found ? found.index + Number(direction) : -1;
    if (!found || destination < 0 || destination >= found.collection.length) return;
    const [entry] = found.collection.splice(found.index, 1);
    found.collection.splice(destination, 0, entry);
    saveData('Estrutura reorganizada', { scope: 'system' });
    render();
  }

  function openDeleteStructure(type, targetId) {
    const found = findStructure(type, targetId);
    if (!found) return;
    const labels = { workspace: 'área e todo o seu conteúdo', module: 'módulo e seus quadros', board: 'quadro e seus registros' };
    openModal({ title: 'Mover para a lixeira', subtitle: found.entry.name, body: `<div class="atlas-v2-confirm-card"><i data-lucide="triangle-alert"></i><div><strong>Esta ${labels[type] || 'estrutura'} será removida.</strong><p>Um Admin poderá restaurá-la pela aba Sistema.</p></div></div>`, actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-action="admin-confirm-delete-structure" data-structure-type="${attr(type)}" data-structure-id="${attr(targetId)}"><i data-lucide="trash-2"></i>Mover para lixeira</button>` });
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function addTrashEntry(type, name, payload, parent = {}) {
    const entry = {
      id: id('trash'),
      type,
      name,
      payload: deepClone(payload),
      parent: deepClone(parent),
      deletedAt: new Date().toISOString(),
      deletedBy: runtime.data.currentUserId,
      expiresAt: new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)).toISOString(),
    };
    runtime.data.trash.unshift(entry);
    return entry;
  }

  function trashBoardId(entry) {
    if (!entry || ['workspace', 'module', 'board'].includes(entry.type)) return null;
    const candidate = entry.parent?.boardId || '';
    return isUuid(candidate) ? candidate : null;
  }

  function persistRemoteTrashEntry(entry) {
    if (!runtime.authClient || !runtime.remoteMode || !runtime.authSession?.user) return Promise.resolve(entry);
    const row = {
      id: entry.id,
      tipo_entidade: entry.type,
      entidade_id: isUuid(entry.payload?.id) ? entry.payload.id : null,
      nome: entry.name,
      board_id: trashBoardId(entry),
      payload: { entity: entry.payload, parent: entry.parent },
      excluido_por: runtime.authSession.user.id,
      excluido_em: entry.deletedAt,
      expira_em: entry.expiresAt,
    };
    const operation = runtime.trashQueue
      .catch(() => null)
      .then(async () => {
        const { data, error } = await runtime.authClient
          .from('atlas_v2_trash')
          .upsert(row, { onConflict: 'id' })
          .select('*')
          .single();
        if (error) throw error;
        if (data) Object.assign(entry, mapRemoteTrashEntry(data));
        return entry;
      });
    runtime.trashQueue = operation.catch(() => null);
    return operation;
  }

  async function removeRemoteTrashEntry(trashId) {
    if (!runtime.authClient || !runtime.remoteMode) return;
    const { error } = await runtime.authClient.from('atlas_v2_trash').delete().eq('id', trashId);
    if (error) throw error;
  }

  async function stageTrashEntries(entries) {
    try {
      if (runtime.authClient && runtime.remoteMode && runtime.authSession?.user) {
        const payload = entries.map((entry) => ({
          id: entry.id,
          tipo_entidade: entry.type,
          entidade_id: isUuid(entry.payload?.id) ? entry.payload.id : null,
          nome: entry.name,
          board_id: trashBoardId(entry),
          payload: { entity: entry.payload, parent: entry.parent },
          excluido_em: entry.deletedAt,
          expira_em: entry.expiresAt,
        }));
        const { data, error } = await runtime.authClient.rpc('atlas_v2_stage_trash_entries', { p_entries: payload });
        if (error) throw error;
        const byId = new Map((data || []).map((row) => [row.id, row]));
        entries.forEach((entry) => { if (byId.has(entry.id)) Object.assign(entry, mapRemoteTrashEntry(byId.get(entry.id))); });
      }
      return true;
    } catch (error) {
      const ids = new Set(entries.map((entry) => entry.id));
      runtime.data.trash = runtime.data.trash.filter((entry) => !ids.has(entry.id));
      toast(`A exclusão foi cancelada porque a lixeira não pôde ser sincronizada: ${error.message || error}`, true);
      return false;
    }
  }

  async function deleteAdminStructure(type, targetId) {
    if (!requirePermission('admin', null, 'excluir estruturas')) return;
    const found = findStructure(type, targetId);
    if (!found) return;
    if (type === 'workspace' && runtime.data.workspaces.length <= 1) { toast('A última área de trabalho não pode ser excluída', true); closeOverlay(); return; }
    if (type === 'board' && allBoards().length <= 1) { toast('O último quadro do Atlas não pode ser excluído', true); closeOverlay(); return; }
    const parent = { index: found.index, workspaceId: found.workspace?.id || '', moduleId: found.module?.id || '' };
    const trashEntry = addTrashEntry(type, found.entry.name, found.entry, parent);
    if (!await stageTrashEntries([trashEntry])) return;
    try {
      await syncTrashEntriesWithDrive([trashEntry], 'delete');
    } catch (error) {
      await rollbackStagedTrash([trashEntry], `A exclusão foi cancelada porque o Drive não confirmou a remoção: ${error.message || error}`);
      return;
    }
    found.collection.splice(found.index, 1);
    const first = allBoards()[0];
    if (first && (!findBoard(runtime.data.activeBoardId) || runtime.data.activeBoardId === targetId)) {
      runtime.data.activeWorkspaceId = first.workspace.id;
      runtime.data.activeBoardId = first.board.id;
    }
    closeOverlay();
    saveData(`${found.entry.name} movido para a lixeira`, { scope: 'system' });
    render();
  }

  function collectTrashAttachmentRows(entry) {
    const rows = [];
    const seen = new Set();
    const fallbackBoardId = entry?.type === 'board'
      ? entry.payload?.id
      : entry?.parent?.boardId;
    const addValues = (itemId, values = {}, boardId = fallbackBoardId) => {
      Object.entries(values || {}).forEach(([columnId, value]) => {
        const rawEntries = parseImageValue(value);
        rawEntries.forEach((raw, order) => {
          const attachment = normalizeImageEntries([raw])[0];
          if (!attachment) return;
          const durableAttachment = raw && typeof raw === 'object'
            && (raw.attachmentId || raw.attachment_id || raw._attachmentSource || raw.attachmentBacked || raw.fileId || raw.file_id);
          if (!durableAttachment) return;
          if (!attachment?.fileId || !isUuid(itemId) || !isUuid(columnId)) return;
          const attachmentId = isUuid(attachment.attachmentId) ? attachment.attachmentId : id('attachment');
          if (seen.has(attachmentId)) return;
          seen.add(attachmentId);
          rows.push({
            id: attachmentId,
            item_id: itemId,
            column_id: columnId,
            storage_connection_id: isUuid(attachment.storageConnectionId) ? attachment.storageConnectionId : null,
            file_id: attachment.fileId,
            folder_id: attachment.folderId || '',
            nome: attachment.name || 'Arquivo restaurado',
            mime_type: attachment.mimeType || 'application/octet-stream',
            tamanho: Number(attachment.size || 0),
            view_url: attachment.viewUrl || attachment.url || '',
            thumbnail_url: attachment.thumbnailUrl || attachment.viewUrl || attachment.url || '',
            ordem: order,
            criado_por: runtime.authSession?.user?.id || null,
            atlasBoardId: boardId || '',
          });
        });
      });
    };
    const visit = (node, boardId = fallbackBoardId) => {
      if (!node || typeof node !== 'object') return;
      const activeBoardId = Array.isArray(node.groups) && Array.isArray(node.columns) && isUuid(node.id)
        ? node.id
        : boardId;
      if (isUuid(node.id) && node.values && typeof node.values === 'object') addValues(node.id, node.values, activeBoardId);
      (node.subitems || []).forEach((child) => visit(child, activeBoardId));
      (node.items || []).forEach((child) => visit(child, activeBoardId));
      (node.groups || []).forEach((child) => visit(child, activeBoardId));
      (node.boards || []).forEach((child) => visit(child, child?.id || activeBoardId));
      (node.modules || []).forEach((child) => visit(child, activeBoardId));
    };
    visit(entry?.payload, fallbackBoardId);
    if (entry?.type === 'column' && isUuid(entry.payload?.id)) {
      (entry.parent?.values || []).forEach((savedValue) => {
        addValues(savedValue.itemId, { [entry.payload.id]: savedValue.value }, entry.parent?.boardId);
      });
    }
    return rows;
  }

  function databaseAttachmentRows(rows = []) {
    return rows.map(({ atlasBoardId, ...row }) => row);
  }

  async function syncDriveAttachmentRows(rows = [], action = 'delete') {
    const durableRows = rows.filter((row) => row?.file_id);
    if (!durableRows.length) return;
    const authToken = await currentAuthAccessToken();
    const batches = new Map();

    durableRows.forEach((row) => {
      const boardId = row.atlasBoardId || '';
      const context = boardId ? findBoard(boardId) : null;
      const connection = storageConnection(row.storage_connection_id)
        || (context ? storageForContext(context) : null);
      if (!connection?.id || !connection?.appScriptUrl || !connection?.folderId) {
        throw new Error(`A conexão do Drive não foi encontrada para ${row.nome || 'um arquivo'}.`);
      }
      const key = `${connection.id}::${boardId}`;
      if (!batches.has(key)) batches.set(key, { connection, boardId, fileIds: [] });
      batches.get(key).fileIds.push(row.file_id);
    });

    const runBatch = async (batch, batchAction) => {
      const response = await fetch(batch.connection.appScriptUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: batchAction,
          rootFolderId: batch.connection.folderId,
          connectionId: batch.connection.id,
          boardId: batch.boardId || null,
          authToken,
          fileIds: [...new Set(batch.fileIds.filter(Boolean))],
        }),
        redirect: 'follow',
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        const detail = result?.failures?.[0]?.error || result?.error || 'O conector não confirmou a operação.';
        throw new Error(detail);
      }
    };

    // Quando os anexos estao espalhados por mais de uma conta de Drive, uma
    // falha na segunda conta deixava os arquivos da primeira ja excluidos, sem
    // nenhuma compensacao: o Atlas cancelava a exclusao e o Drive ficava num
    // estado diferente do declarado. Agora as contas ja concluidas sao
    // revertidas antes de propagar o erro.
    const inverseAction = action === 'delete' ? 'undodelete' : (action === 'undodelete' ? 'delete' : '');
    const completed = [];
    for (const batch of batches.values()) {
      try {
        await runBatch(batch, action);
        completed.push(batch);
      } catch (error) {
        if (completed.length && inverseAction) {
          const failedToCompensate = [];
          for (const done of completed) {
            try { await runBatch(done, inverseAction); }
            catch (compensationError) {
              failedToCompensate.push(`${done.connection.name || done.connection.id}: ${compensationError.message || compensationError}`);
            }
          }
          if (failedToCompensate.length) {
            runtime.data.errors = Array.isArray(runtime.data.errors) ? runtime.data.errors : [];
            runtime.data.errors.unshift({
              id: id('error'),
              title: 'Arquivos do Drive ficaram em estado inconsistente',
              detail: `A operação falhou em uma conta de Drive e não foi possível reverter as contas já processadas. Verifique manualmente: ${failedToCompensate.join(' · ')}`,
              createdAt: new Date().toISOString(),
            });
            throw new Error(`${error.message || error} Além disso, alguns arquivos já processados não puderam ser revertidos: ${failedToCompensate.join(' · ')}`);
          }
        }
        throw error;
      }
    }
  }

  async function rollbackStagedTrash(entries, message) {
    const ids = new Set(entries.map((entry) => entry.id));
    for (const entry of entries) {
      try { await removeRemoteTrashEntry(entry.id); } catch (_) {}
    }
    runtime.data.trash = runtime.data.trash.filter((entry) => !ids.has(entry.id));
    toast(message, true);
  }

  async function syncTrashEntriesWithDrive(entries, action = 'delete') {
    const rows = entries.flatMap((entry) => collectTrashAttachmentRows(entry));
    await syncDriveAttachmentRows(rows, action);
  }

  async function restoreTrashAttachments(entry) {
    if (!runtime.authClient || !runtime.remoteMode) return;
    const rows = collectTrashAttachmentRows(entry);
    if (!rows.length) return;
    const storedRows = databaseAttachmentRows(rows);
    const { data, error } = await runtime.authClient
      .from('atlas_v2_attachments')
      .upsert(storedRows, { onConflict: 'id' })
      .select('*');
    if (error) throw error;
    runtime.remoteRows = runtime.remoteRows || {};
    const restoredIds = new Set(rows.map((row) => row.id));
    runtime.remoteRows.atlas_v2_attachments = [
      ...(runtime.remoteRows.atlas_v2_attachments || []).filter((row) => !restoredIds.has(row.id)),
      ...(data || storedRows),
    ];
  }

  // Marca como "carregados" todos os itens dentro do que acabou de ser
  // restaurado da lixeira. O payload da lixeira ja traz os valores completos
  // (era o item real no momento da exclusao), mas sem isso o proximo sync
  // completo trataria esses itens como "nao carregados nesta sessao" e a
  // guarda de syncRemoteData descartaria justamente as mudancas que deveriam
  // ser reenviadas ao Supabase - ou, pior, uma futura hidratacao os trataria
  // como vazios.
  function markRestoredValuesLoaded(node) {
    if (!node || typeof node !== 'object') return;
    if (isUuid(node.id) && node.values && typeof node.values === 'object') {
      runtime.loadedItemValues.add(String(node.id));
    }
    (node.subitems || []).forEach(markRestoredValuesLoaded);
    (node.items || []).forEach(markRestoredValuesLoaded);
    (node.groups || []).forEach(markRestoredValuesLoaded);
    (node.boards || []).forEach(markRestoredValuesLoaded);
    (node.modules || []).forEach(markRestoredValuesLoaded);
  }

  function restoreTrashLocally(entry) {
    let collection = null;
    if (entry.type === 'workspace') collection = runtime.data.workspaces;
    if (entry.type === 'module') collection = runtime.data.workspaces.find((candidate) => candidate.id === entry.parent.workspaceId)?.modules;
    if (entry.type === 'board') collection = findStructure('module', entry.parent.moduleId)?.entry?.boards;
    if (entry.type === 'group') collection = findBoard(entry.parent.boardId)?.board?.groups;
    if (entry.type === 'item') {
      const boardContext = findBoard(entry.parent.boardId);
      if (!boardContext) { toast('O quadro pai também precisa ser restaurado', true); return false; }
      const parentItem = entry.parent.parentItemId ? findItem(boardContext.board, entry.parent.parentItemId)?.item : null;
      collection = parentItem ? (parentItem.subitems = parentItem.subitems || []) : boardContext?.board?.groups.find((candidate) => candidate.id === entry.parent.groupId)?.items;
    }
    if (entry.type === 'column') {
      const boardContext = findBoard(entry.parent.boardId);
      if (!boardContext) { toast('O quadro pai também precisa ser restaurado', true); return false; }
      boardContext.board.columns.splice(Math.min(Number(entry.parent.index || 0), boardContext.board.columns.length), 0, deepClone(entry.payload));
      (entry.parent.values || []).forEach((savedValue) => {
        const found = findItem(boardContext.board, savedValue.itemId);
        if (found) {
          found.item.values[entry.payload.id] = deepClone(savedValue.value);
          runtime.loadedItemValues.add(String(savedValue.itemId));
        }
      });
      return true;
    }
    if (!collection) { toast('A estrutura pai também precisa ser restaurada', true); return false; }
    const restored = deepClone(entry.payload);
    collection.splice(Math.min(Number(entry.parent.index || 0), collection.length), 0, restored);
    markRestoredValuesLoaded(restored);
    return true;
  }

  async function restoreTrash(trashId) {
    if (!requirePermission('admin', null, 'restaurar a lixeira')) return;
    const entry = runtime.data.trash.find((candidate) => candidate.id === trashId);
    if (!entry) return;
    const snapshot = deepClone(runtime.data);
    if (!restoreTrashLocally(entry)) return;
    let driveRestored = false;
    try {
      await syncTrashEntriesWithDrive([entry], 'restore');
      driveRestored = true;
      saveData('', { remote: false, audit: false });
      if (runtime.remoteMode && !await syncRemoteData()) throw new Error('A estrutura não pôde ser recriada no Supabase.');
      await restoreTrashAttachments(entry);
      await removeRemoteTrashEntry(trashId);
      runtime.data.trash = runtime.data.trash.filter((candidate) => candidate.id !== trashId);
      saveData(`${entry.name} restaurado`, { scope: 'system', remote: false });
      render();
    } catch (error) {
      let driveRollbackFailed = null;
      if (driveRestored) {
        // Se o "re-excluir" tambem falhar, o Drive fica em um estado diferente do
        // que a estrutura local passa a declarar. Isso precisa ficar visivel.
        try { await syncTrashEntriesWithDrive([entry], 'trash'); }
        catch (rollbackError) { driveRollbackFailed = rollbackError; }
      }
      runtime.data = snapshot;
      persistLocalBackup(runtime.data);
      // Reagendar a gravacao do cache de bootstrap com o snapshot revertido.
      // Sem isso, um timer agendado antes da falha ainda gravaria a versao
      // "restaurada" por cima, e o proximo login mostraria um item inexistente.
      scheduleBootstrapCacheWrite(runtime.data, 0);
      if (driveRollbackFailed) {
        runtime.data.errors = Array.isArray(runtime.data.errors) ? runtime.data.errors : [];
        runtime.data.errors.unshift({
          id: id('error'),
          title: 'O Drive não voltou ao estado anterior',
          detail: `A restauração de "${entry.name}" foi desfeita no Atlas, mas os arquivos no Drive não puderam ser movidos de volta para a lixeira. Verifique o Drive deste setor. Detalhe técnico: ${driveRollbackFailed.message || driveRollbackFailed}`,
          createdAt: new Date().toISOString(),
        });
        persistLocalBackup(runtime.data);
      }
      render();
      toast(
        driveRollbackFailed
          ? `A restauração foi desfeita, mas os arquivos no Drive não voltaram ao estado anterior. Veja Sistema > Central de erros. Detalhe: ${error.message || error}`
          : `A restauração foi desfeita para preservar os dados: ${error.message || error}`,
        true,
      );
    }
  }

  async function purgeTrash(trashId) {
    if (!requirePermission('admin', null, 'esvaziar a lixeira')) return;
    const entry = runtime.data.trash.find((candidate) => candidate.id === trashId);
    if (!entry) return;
    try {
      await removeRemoteTrashEntry(trashId);
    } catch (error) {
      toast(`Não foi possível excluir definitivamente: ${error.message || error}`, true);
      return;
    }
    runtime.data.trash = runtime.data.trash.filter((candidate) => candidate.id !== trashId);
    saveData(`${entry.name} excluído definitivamente`, { scope: 'system', remote: false });
    render();
  }

  function exportAdminBackup() {
    if (!requirePermission('admin', null, 'exportar o backup')) return;
    const blob = new Blob([JSON.stringify(runtime.data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `atlas-v2-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 500);
    recordAudit('Backup da estrutura exportado', { scope: 'system' });
    persistLocalBackup(runtime.data);
    scheduleBootstrapCacheWrite(runtime.data);
    toast('Backup exportado');
  }

  function openSaveTemplateModal() {
    const context = findBoard();
    if (!context) return;
    openModal({ title: 'Salvar pacote operacional', subtitle: context.board.name, body: `<form id="atlas-v2-admin-template-form" class="atlas-v2-form-grid"><label class="atlas-v2-field is-wide"><span>Nome do modelo</span><input name="name" value="${attr(context.board.name)}" maxlength="80" required autofocus></label><label class="atlas-v2-check-row"><input name="includeViews" type="checkbox" checked><span><strong>Incluir visualizações</strong><small>Tabela, Obras, Kanban, Gantt, Calendário e Painel.</small></span></label><label class="atlas-v2-check-row"><input name="includeAutomations" type="checkbox" checked><span><strong>Incluir automações</strong><small>As regras serão copiadas desativadas.</small></span></label></form>`, actions: '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-admin-template-form"><i data-lucide="bookmark-plus"></i>Salvar pacote</button>' });
  }

  function submitAdminTemplate(form) {
    if (!requirePermission('configure', findBoard(), 'criar modelos')) return;
    const context = findBoard();
    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    if (!context || !name) return;
    runtime.data.templates.push({
      id: id('template'),
      name,
      icon: context.board.icon,
      columns: deepClone(context.board.columns),
      groups: context.board.groups.map((entry) => ({ id: id('group-template'), name: entry.name, color: entry.color })),
      views: formData.get('includeViews') ? deepClone(context.board.views) : ['table'],
      settings: deepClone(context.board.settings || {}),
      automations: formData.get('includeAutomations') ? deepClone(boardAutomations(context.board.id)).map((entry) => ({ ...entry, id: '', boardId: '', active: false })) : [],
    });
    closeOverlay();
    saveData(`Modelo ${name} criado`, { scope: 'system' });
    render();
  }

  function deleteAdminTemplate(templateId) {
    if (!requirePermission('configure', findBoard(), 'excluir modelos')) return;
    const template = runtime.data.templates.find((entry) => entry.id === templateId);
    runtime.data.templates = runtime.data.templates.filter((entry) => entry.id !== templateId);
    saveData(`Modelo ${template?.name || ''} removido`, { scope: 'system' });
    render();
  }

  function saveFieldTemplate(columnId) {
    if (!requirePermission('configure', findBoard(), 'salvar campos reutilizáveis')) return;
    const context = findBoard();
    const columnEntry = context?.board.columns.find((entry) => entry.id === columnId);
    if (!columnEntry) return;
    const duplicate = runtime.data.fieldTemplates.some((entry) => entry.name.toLowerCase() === columnEntry.name.toLowerCase() && entry.type === columnEntry.type);
    if (duplicate) { toast('Este campo já existe na biblioteca', true); return; }
    runtime.data.fieldTemplates.push({ ...deepClone(columnEntry), id: id('field-template'), source: context.board.name });
    saveData(`Campo ${columnEntry.name} salvo na biblioteca`, { scope: 'system' });
    render();
  }

  function useFieldTemplate(fieldId) {
    if (!requirePermission('configure', findBoard(), 'adicionar campos')) return;
    const context = findBoard();
    const template = runtime.data.fieldTemplates.find((entry) => entry.id === fieldId);
    if (!context || !template) return;
    const newColumn = { ...deepClone(template), id: id('col') };
    delete newColumn.source;
    context.board.columns.push(newColumn);
    context.board.groups.forEach((groupEntry) => groupEntry.items.forEach((itemEntry) => {
      itemEntry.values[newColumn.id] = newColumn.type === 'checkbox' ? false : '';
      (itemEntry.subitems || []).forEach((subitem) => { subitem.values[newColumn.id] = newColumn.type === 'checkbox' ? false : ''; });
    }));
    saveData(`Campo ${template.name} adicionado ao quadro`);
    render();
  }

  function deleteFieldTemplate(fieldId) {
    if (!requirePermission('admin', null, 'remover campos da biblioteca')) return;
    const template = runtime.data.fieldTemplates.find((entry) => entry.id === fieldId);
    runtime.data.fieldTemplates = runtime.data.fieldTemplates.filter((entry) => entry.id !== fieldId);
    saveData(`Campo ${template?.name || ''} removido da biblioteca`, { scope: 'system' });
    render();
  }

  function render() {
    if (runtime.page === 'home') {
      document.body.classList.remove('atlas-v2-admin-page', 'atlas-v2-mobile-card-view');
      renderIdentity();
      const workspace = currentWorkspace();
      if (workspace) renderWorkspace(workspace);
      renderNavigation();
      renderHomePage();
      refreshIcons();
      return;
    }

    const context = findBoard();
    if (!context) {
      const firstWorkspace = runtime.data.workspaces[0];
      const firstBoard = firstWorkspace?.modules?.[0]?.boards?.[0];
      if (!firstBoard) return;
      runtime.data.activeWorkspaceId = firstWorkspace.id;
      runtime.data.activeBoardId = firstBoard.id;
      return render();
    }

    renderIdentity();
    renderWorkspace(context.workspace);
    renderNavigation();
    if (runtime.page === 'admin') {
      document.body.classList.remove('atlas-v2-mobile-card-view', 'atlas-v2-home-page');
      renderAdminPage();
      refreshIcons();
      return;
    }
    document.body.classList.remove('atlas-v2-admin-page', 'atlas-v2-home-page');
    const content = document.getElementById('atlas-v2-board-content');
    if (content) content.className = 'atlas-v2-board-content';
    renderBoardHeader(context);
    const boardSearch = document.getElementById('atlas-v2-board-search');
    if (boardSearch) {
      const isWorks = context.board.activeView === 'works';
      boardSearch.placeholder = isWorks ? 'Pesquisar cidade, setor, obra ou item' : 'Filtrar setor, item ou subitem';
      boardSearch.setAttribute('aria-label', isWorks ? 'Pesquisar cidade, setor, obra ou item na visualização atual' : 'Filtrar setor, item ou subitem do quadro atual');
    }
    renderViewTabs(context.board);
    renderBoardContent(context.board);
    renderSelection(context.board);
    applyPermissionUi(context);
    refreshIcons();
  }

  function updateActiveNavigation(boardId) {
    document.querySelectorAll('.atlas-v2-board-row[data-board-id]').forEach((entry) => {
      entry.classList.toggle('is-active', entry.dataset.boardId === String(boardId));
    });
  }

  function renderBoardRoute(context, options = {}) {
    if (!context) return;
    document.body.classList.remove('atlas-v2-admin-page', 'atlas-v2-home-page');
    if (options.workspaceChanged) {
      renderWorkspace(context.workspace);
      renderNavigation();
    } else {
      updateActiveNavigation(context.board.id);
    }
    const content = document.getElementById('atlas-v2-board-content');
    if (content) content.className = 'atlas-v2-board-content';
    renderBoardHeader(context);
    const boardSearch = document.getElementById('atlas-v2-board-search');
    if (boardSearch) {
      const isWorks = context.board.activeView === 'works';
      boardSearch.value = runtime.boardSearch;
      boardSearch.placeholder = isWorks ? 'Pesquisar cidade, setor, obra ou item' : 'Filtrar setor, item ou subitem';
      boardSearch.setAttribute('aria-label', isWorks ? 'Pesquisar cidade, setor, obra ou item na visualiza\u00e7\u00e3o atual' : 'Filtrar setor, item ou subitem do quadro atual');
    }
    renderViewTabs(context.board);
    renderBoardContent(context.board);
    renderSelection(context.board);
    applyPermissionUi(context);
    [
      document.getElementById('atlas-v2-breadcrumb'),
      document.getElementById('atlas-v2-board-icon'),
      document.getElementById('atlas-v2-view-tabs'),
      document.getElementById('atlas-v2-board-content'),
      document.getElementById('atlas-v2-selection-bar'),
      options.workspaceChanged ? document.getElementById('atlas-v2-navigation') : null,
    ].filter(Boolean).forEach(refreshIcons);
  }

  function applyPermissionUi(context) {
    const canCreate = hasPermission('create', context);
    const canEdit = hasPermission('edit', context);
    const canDelete = hasPermission('delete', context);
    const canConfigure = hasPermission('configure', context);
    const canShare = hasPermission('share', context);
    if (canCreate && canEdit && canDelete && canConfigure && canShare) return;
    const groups = [
      [canCreate, ['add-item', 'add-item-to-group', 'add-subitem', 'add-work-element', 'duplicate-item', 'import']],
      [canEdit, ['bulk-move', 'bulk-move-board', 'item-move-board', 'sort']],
      [canDelete, ['delete-item', 'bulk-delete', 'delete-work']],
      [canConfigure, ['add-group', 'add-column', 'group-menu', 'board-settings', 'automations']],
      [canShare, ['share-board']],
    ];
    groups.forEach(([allowed, actions]) => actions.forEach((action) => document.querySelectorAll(`[data-action="${action}"]`).forEach((entry) => { entry.disabled = !allowed; })));
    document.querySelectorAll('[data-item-name], [data-item-value]').forEach((entry) => { entry.disabled = !canEdit; });
  }

  function renderWorkspace(workspace) {
    const mark = document.getElementById('atlas-v2-workspace-mark');
    const name = document.getElementById('atlas-v2-workspace-name');
    if (mark) {
      mark.textContent = workspace.name.trim().slice(0, 1).toUpperCase() || 'A';
      mark.style.background = workspace.color || '#0f6cbd';
    }
    if (name) name.textContent = workspace.name;
  }

  function renderNavigation() {
    const root = document.getElementById('atlas-v2-navigation');
    const workspace = currentWorkspace();
    if (!root || !workspace) return;
    const query = runtime.navSearch.trim().toLowerCase();

    const moduleIds = new Set(workspace.modules.map((entry) => entry.id));
    const roots = workspace.modules.filter((entry) => !entry.parentId || !moduleIds.has(entry.parentId));
    const renderModule = (module, depth = 0) => {
      const accessibleBoards = module.boards.filter((boardEntry) => hasPermission('view', { workspace, module, board: boardEntry }));
      const matchingBoards = accessibleBoards.filter((boardEntry) => !query || `${module.name} ${boardEntry.name}`.toLowerCase().includes(query));
      const children = workspace.modules.filter((entry) => entry.parentId === module.id);
      const matchingChildren = children.map((entry) => renderModule(entry, depth + 1)).filter(Boolean);
      if (query && !matchingBoards.length && !matchingChildren.length) return '';
      const visibleBoards = query ? matchingBoards : accessibleBoards;
      return `<section class="atlas-v2-nav-module" style="--module-depth:${depth}">
        <button class="atlas-v2-module-row" type="button" data-action="toggle-module" data-module-id="${attr(module.id)}" aria-expanded="${module.open || Boolean(query)}" title="${attr(module.name)}">
          <i class="atlas-v2-module-caret" data-lucide="chevron-right"></i>
          <i data-lucide="${attr(module.icon || 'folder')}"></i>
          <span>${escapeHtml(module.name)}</span>
          <i data-lucide="grip-vertical"></i>
        </button>
        <div class="atlas-v2-board-list" ${module.open || query ? '' : 'hidden'}>
          ${visibleBoards.map((boardEntry) => `<button class="atlas-v2-board-row ${boardEntry.id === runtime.data.activeBoardId ? 'is-active' : ''}" type="button" data-action="open-board" data-board-id="${attr(boardEntry.id)}" title="${attr(boardEntry.name)}">
            <i data-lucide="${attr(boardEntry.icon || 'table-2')}"></i>
            <span>${escapeHtml(boardEntry.name)}</span>
            ${boardEntry.official ? '<i data-lucide="badge-check"></i>' : '<i data-lucide="more-horizontal"></i>'}
          </button>`).join('')}
          ${matchingChildren.join('')}
        </div>
      </section>`;
    };
    const modules = roots.map((entry) => renderModule(entry)).join('');

    root.innerHTML = `<div class="atlas-v2-nav-section-title"><span>Rotas de trabalho</span><button type="button" data-action="open-create" title="Criar estrutura" aria-label="Criar estrutura"><i data-lucide="plus"></i></button></div>${modules || '<div class="atlas-v2-empty-view"><span>Nenhuma rota encontrada</span></div>'}`;
  }

  function boardCode(boardId) {
    const hash = String(boardId || 'atlas').split('').reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 17);
    return `AT-${String(hash % 10000).padStart(4, '0')}`;
  }

  function renderBoardHeader(context) {
    const { workspace, module, board: boardEntry } = context;
    const title = document.getElementById('atlas-v2-board-title');
    const description = document.getElementById('atlas-v2-board-description');
    const icon = document.getElementById('atlas-v2-board-icon');
    const badge = document.getElementById('atlas-v2-access-badge');
    const code = document.getElementById('atlas-v2-board-code');
    const breadcrumb = document.getElementById('atlas-v2-breadcrumb');
    if (title) title.textContent = boardEntry.name;
    if (description) description.textContent = boardEntry.description || 'Quadro operacional configurável.';
    if (icon) icon.innerHTML = `<i data-lucide="${attr(boardEntry.icon || 'table-2')}"></i>`;
    if (badge) badge.textContent = ACCESS[boardEntry.access]?.label || 'Organizacional';
    if (code) code.textContent = boardCode(boardEntry.id);
    if (breadcrumb) breadcrumb.innerHTML = `<span>${escapeHtml(workspace.name)}</span><span><i data-lucide="chevron-right"></i>${escapeHtml(module.name)}</span><span><i data-lucide="chevron-right"></i><b>${escapeHtml(boardEntry.name)}</b></span>`;
  }

  function renderViewTabs(boardEntry) {
    const root = document.getElementById('atlas-v2-view-tabs');
    if (!root) return;
    root.innerHTML = boardEntry.views.map((view) => {
      const definition = VIEW_TYPES[view];
      if (!definition) return '';
      return `<button class="atlas-v2-view-tab ${boardEntry.activeView === view ? 'is-active' : ''}" type="button" data-action="change-view" data-view="${attr(view)}"><i data-lucide="${attr(definition.icon)}"></i><span>${escapeHtml(definition.label)}</span></button>`;
    }).join('') + '<button class="atlas-v2-view-tab" type="button" data-action="add-view" title="Adicionar visualização"><i data-lucide="plus"></i></button>';
  }

  function visibleSubitems(boardEntry, itemEntry) {
    return (itemEntry.subitems || []).filter((entry) => !entry.archived);
  }

  function normalizeSearchText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .trim();
  }

  function boardWorkEntries(boardEntry) {
    return boardEntry.groups
      .flatMap((groupEntry) => groupEntry.items.map((itemEntry) => ({ item: itemEntry, group: groupEntry })))
      .sort((a, b) => a.item.name.localeCompare(b.item.name, 'pt-BR'));
  }

  function workSearchMatch(boardEntry, rawQuery = runtime.boardSearch) {
    if (boardEntry.activeView !== 'works') return null;
    const needle = normalizeSearchText(rawQuery);
    if (!needle) return null;
    const ranked = boardWorkEntries(boardEntry)
      .map((entry) => {
        const name = normalizeSearchText(entry.item.name);
        let rank = Number.MAX_SAFE_INTEGER;
        if (name === needle) rank = 0;
        else if (name.startsWith(needle)) rank = 1;
        else if (name.split(/\s+/).some((part) => part.startsWith(needle))) rank = 2;
        else if (name.includes(needle)) rank = 3;
        return { ...entry, rank };
      })
      .filter((entry) => Number.isFinite(entry.rank) && entry.rank < Number.MAX_SAFE_INTEGER)
      .sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name, 'pt-BR'));
    return ranked[0] || null;
  }

  function contextualItemSearch(boardEntry) {
    const query = normalizeSearchText(runtime.boardSearch);
    if (!query) return '';
    const workMatch = workSearchMatch(boardEntry, query);
    if (workMatch && workMatch.item.id === runtime.workFilter) return '';
    return query;
  }

  function contextualSectorMatch(sectorName, rawQuery = runtime.boardSearch) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return false;
    return normalizeSearchText(sectorName).includes(query);
  }

  function selectWorkFromContextSearch(boardEntry) {
    const match = workSearchMatch(boardEntry);
    if (!match) return null;
    if (runtime.workFilter !== match.item.id) {
      runtime.workFilter = match.item.id;
      runtime.expandedWorkSectors.clear();
      collapseItemTree(match.item.subitems);
    }
    return match;
  }

  function revealContextSearchWork(boardEntry, smooth = true) {
    const match = workSearchMatch(boardEntry);
    if (!match || match.item.id !== runtime.workFilter) return;
    requestAnimationFrame(() => {
      const tab = [...document.querySelectorAll('.atlas-v2-work-tab')]
        .find((entry) => entry.dataset.workId === runtime.workFilter);
      tab?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest', inline: 'center' });
    });
  }

  function filteredItems(boardEntry, groupEntry) {
    const query = contextualItemSearch(boardEntry);
    const sectorMatches = query && contextualSectorMatch(groupEntry.name, query);
    return groupEntry.items.filter((entry) => {
      // Itens arquivados ficam fora das visualizacoes, mas continuam nos dados
      // (e no Supabase, com arquivado=true), portanto sao recuperaveis.
      if (entry.archived) return false;
      if (boardEntry.activeView === 'works' && runtime.workFilter && entry.id !== runtime.workFilter) return false;
      if (!itemMatchesAdvancedFilters(boardEntry, groupEntry, entry)) return false;
      const children = visibleSubitems(boardEntry, entry);
      if (!query || sectorMatches) return true;
      const ownText = normalizeSearchText(`${entry.name} ${Object.values(entry.values || {}).join(' ')}`);
      const subitemText = normalizeSearchText(children.map((subitem) => `${subitem.name} ${Object.values(subitem.values || {}).join(' ')}`).join(' '));
      return `${ownText} ${subitemText}`.includes(query);
    });
  }

  function itemMatchesAdvancedFilters(boardEntry, groupEntry, itemEntry) {
    const filters = runtime.searchFilters?.[boardEntry.id] || {};
    if (filters.groupId && groupEntry.id !== filters.groupId) return false;
    if (filters.columnId && filters.value && String(itemEntry.values?.[filters.columnId] || '') !== String(filters.value)) return false;
    if (filters.attachmentsOnly) {
      const hasAttachment = boardEntry.columns.some((columnEntry) => ['image', 'file'].includes(columnEntry.type) && normalizeImageEntries(itemEntry.values?.[columnEntry.id]).length);
      if (!hasAttachment) return false;
    }
    if (filters.dateColumnId && (filters.dateFrom || filters.dateTo)) {
      const value = String(itemEntry.values?.[filters.dateColumnId] || '');
      if (!value || (filters.dateFrom && value < filters.dateFrom) || (filters.dateTo && value > filters.dateTo)) return false;
    }
    return true;
  }

  function openAdvancedFilters() {
    const context = findBoard();
    if (!context) return;
    const filters = runtime.searchFilters?.[context.board.id] || {};
    const filterColumns = context.board.columns.filter((entry) => ['status', 'select', 'person'].includes(entry.type));
    const selectedColumn = context.board.columns.find((entry) => entry.id === filters.columnId);
    const values = selectedColumn?.options?.map((entry) => typeof entry === 'string' ? entry : entry.label) || [];
    const saved = context.board.settings?.savedSearches || [];
    openDrawer({
      title: 'Filtros avançados',
      subtitle: 'Combine critérios e salve consultas frequentes.',
      body: `<form id="atlas-v2-filter-form" class="atlas-v2-form-grid"><label class="atlas-v2-field"><span>Grupo</span><select name="groupId"><option value="">Todos</option>${context.board.groups.map((entry) => `<option value="${attr(entry.id)}" ${filters.groupId === entry.id ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select></label><label class="atlas-v2-field"><span>Campo</span><select name="columnId"><option value="">Qualquer campo</option>${filterColumns.map((entry) => `<option value="${attr(entry.id)}" ${filters.columnId === entry.id ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select></label><label class="atlas-v2-field is-wide"><span>Valor exato</span><input name="value" list="atlas-v2-filter-values" value="${attr(filters.value || '')}" placeholder="Ex.: Em andamento"><datalist id="atlas-v2-filter-values">${values.map((entry) => `<option value="${attr(entry)}"></option>`).join('')}</datalist></label><label class="atlas-v2-field"><span>Coluna de data</span><select name="dateColumnId"><option value="">Sem período</option>${context.board.columns.filter((entry) => entry.type === 'date').map((entry) => `<option value="${attr(entry.id)}" ${filters.dateColumnId === entry.id ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select></label><label class="atlas-v2-field"><span>Data inicial</span><input name="dateFrom" type="date" value="${attr(filters.dateFrom || '')}"></label><label class="atlas-v2-field"><span>Data final</span><input name="dateTo" type="date" value="${attr(filters.dateTo || '')}"></label><label class="atlas-v2-check-row"><input name="attachmentsOnly" type="checkbox" ${filters.attachmentsOnly ? 'checked' : ''}><span><strong>Somente com anexos</strong><small>Imagens ou arquivos.</small></span></label><label class="atlas-v2-field is-wide"><span>Salvar esta pesquisa como</span><input name="saveName" maxlength="60" placeholder="Ex.: Atrasados com evidências"></label></form><div class="atlas-v2-saved-searches">${saved.map((entry) => `<button type="button" data-action="filter-use-saved" data-search-id="${attr(entry.id)}"><i data-lucide="bookmark"></i><span>${escapeHtml(entry.name)}</span><b>${escapeHtml(entry.query || '')}</b></button>`).join('') || '<p>Nenhuma pesquisa salva neste quadro.</p>'}</div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="filter-clear"><i data-lucide="filter-x"></i>Limpar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-filter-form"><i data-lucide="list-filter"></i>Aplicar filtros</button>`,
    });
  }

  function submitAdvancedFilters(form) {
    const context = findBoard();
    if (!context) return;
    const data = new FormData(form);
    const filters = {
      groupId: String(data.get('groupId') || ''),
      columnId: String(data.get('columnId') || ''),
      value: String(data.get('value') || '').trim(),
      dateColumnId: String(data.get('dateColumnId') || ''),
      dateFrom: String(data.get('dateFrom') || ''),
      dateTo: String(data.get('dateTo') || ''),
      attachmentsOnly: Boolean(data.get('attachmentsOnly')),
    };
    runtime.searchFilters[context.board.id] = filters;
    const saveName = String(data.get('saveName') || '').trim();
    if (saveName) {
      context.board.settings = context.board.settings || {};
      context.board.settings.savedSearches = context.board.settings.savedSearches || [];
      context.board.settings.savedSearches.push({ id: id('search'), name: saveName, query: runtime.boardSearch, filters: deepClone(filters) });
      saveData('Pesquisa salva');
    }
    closeOverlay();
    render();
  }

  function clearAdvancedFilters() {
    const context = findBoard();
    if (!context) return;
    delete runtime.searchFilters[context.board.id];
    runtime.boardSearch = '';
    const input = document.getElementById('atlas-v2-board-search');
    if (input) input.value = '';
    closeOverlay();
    render();
  }

  function useSavedSearch(searchId) {
    const context = findBoard();
    const saved = context?.board.settings?.savedSearches?.find((entry) => entry.id === searchId);
    if (!context || !saved) return;
    runtime.searchFilters[context.board.id] = deepClone(saved.filters || {});
    runtime.boardSearch = saved.query || '';
    closeOverlay();
    render();
  }

  function renderWorkTabs(boardEntry) {
    const works = boardWorkEntries(boardEntry);
    if (!works.length) return '';
    const searchMatch = workSearchMatch(boardEntry);
    const button = (label, value, count, color) => `<button class="atlas-v2-work-tab ${runtime.workFilter === value ? 'is-active' : ''} ${searchMatch?.item.id === value ? 'is-search-match' : ''}" type="button" data-action="filter-work" data-work-id="${attr(value)}" style="--work-color:${attr(color || '#176ead')}" title="${attr(label)}"><span class="atlas-v2-work-dot"></span><strong>${escapeHtml(label)}</strong><small>${count}</small></button>`;
    return `<nav class="atlas-v2-work-tabs" aria-label="Selecionar obra">${works.map(({ item: itemEntry, group: groupEntry }) => button(itemEntry.name, itemEntry.id, itemEntry.subitems?.length || 0, groupEntry.color)).join('')}<span class="atlas-v2-work-actions"><button class="atlas-v2-work-rename" type="button" data-action="rename-work" title="Renomear obra" aria-label="Renomear obra selecionada"><i data-lucide="pencil"></i></button><button class="atlas-v2-work-delete" type="button" data-action="delete-work" title="Excluir obra" aria-label="Excluir obra selecionada"><i data-lucide="trash-2"></i></button></span></nav>`;
  }

  function visibleGroups(boardEntry) {
    let groups = boardEntry.groups;
    if (boardEntry.activeView === 'works' && runtime.workFilter) {
      groups = groups.filter((groupEntry) => groupEntry.items.some((itemEntry) => itemEntry.id === runtime.workFilter));
    }
    const query = contextualItemSearch(boardEntry);
    if (!query) return groups;
    return groups.filter((groupEntry) => contextualSectorMatch(groupEntry.name, query) || filteredItems(boardEntry, groupEntry).length > 0);
  }

  function selectedWork(boardEntry) {
    return boardEntry.groups
      .flatMap((groupEntry) => groupEntry.items.map((itemEntry) => ({ item: itemEntry, group: groupEntry })))
      .find(({ item: itemEntry }) => itemEntry.id === runtime.workFilter) || null;
  }

  function ensureWorkSelection(boardEntry) {
    const works = boardWorkEntries(boardEntry);
    if (!works.length) {
      runtime.workFilter = '';
      return null;
    }
    selectWorkFromContextSearch(boardEntry);
    if (!works.some(({ item: itemEntry }) => itemEntry.id === runtime.workFilter)) {
      runtime.workFilter = works[0].item.id;
    }
    return selectedWork(boardEntry);
  }

  function sectorizedWorkItems(boardEntry, workItem, sectorName) {
    const columnId = boardEntry.settings?.works_sector_column_id;
    const query = contextualItemSearch(boardEntry);
    const sectorMatches = query && contextualSectorMatch(sectorName, query);
    return visibleSubitems(boardEntry, workItem).filter((entry) => {
      if (String(entry.values?.[columnId] || '').trim() !== sectorName) return false;
      if (!query || sectorMatches) return true;
      const ownText = normalizeSearchText(`${entry.name} ${Object.values(entry.values || {}).join(' ')}`);
      const childrenText = normalizeSearchText(visibleSubitems(boardEntry, entry).map((child) => `${child.name} ${Object.values(child.values || {}).join(' ')}`).join(' '));
      return `${ownText} ${childrenText}`.includes(query);
    });
  }

  function workSectorStateKey(boardId, workId, sectorName) {
    return `${String(boardId || '')}::${String(workId || '')}::${String(sectorName || '')}`;
  }

  function renderWorkSectorTable(boardEntry, workItem, sectorName, sectorIndex) {
    const items = sectorizedWorkItems(boardEntry, workItem, sectorName);
    const subitemCount = items.reduce((total, entry) => total + visibleSubitems(boardEntry, entry).length, 0);
    const columnsWidth = boardEntry.columns.reduce((total, entry) => total + Number(entry.width || 160), 0);
    const tableWidth = 40 + 500 + columnsWidth + 42;
    const tableHead = `<thead><tr>
      <th class="atlas-v2-select-cell"></th>
      <th class="atlas-v2-item-cell"><div class="atlas-v2-column-head"><i data-lucide="scan-line"></i><span>Registro</span></div></th>
      ${boardEntry.columns.map((columnEntry) => `<th style="width:${Number(columnEntry.width || 160)}px;min-width:${Number(columnEntry.width || 160)}px"><div class="atlas-v2-column-head"><i data-lucide="${attr(COLUMN_TYPES[columnEntry.type]?.icon || 'type')}"></i><span>${escapeHtml(columnEntry.name)}</span></div></th>`).join('')}
      <th class="atlas-v2-end-spacer" aria-hidden="true"></th>
    </tr></thead>`;
    const sectorColors = boardEntry.settings?.works_sector_colors || {};
    const color = sectorColors[sectorName] || ['#a96510', '#73568f', '#176ead', '#168a5b'][sectorIndex % 4];
    const stateKey = workSectorStateKey(boardEntry.id, workItem.id, sectorName);
    const expanded = runtime.expandedWorkSectors.has(stateKey) || contextualSectorMatch(sectorName, contextualItemSearch(boardEntry));
    return `<section class="atlas-v2-group atlas-v2-work-sector ${expanded ? 'is-expanded' : 'is-collapsed'}" style="--group-color:${attr(color)}" data-work-sector="${attr(sectorName)}">
      <header class="atlas-v2-group-head atlas-v2-work-sector-head">
        <span class="atlas-v2-group-index">${String(sectorIndex + 1).padStart(2, '0')}</span>
        <button type="button" data-action="toggle-work-sector" data-work-id="${attr(workItem.id)}" data-work-sector="${attr(sectorName)}" title="${expanded ? 'Recolher setor' : 'Expandir setor'}" aria-expanded="${expanded}"><i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}"></i></button>
        <div class="atlas-v2-group-title"><span>${escapeHtml(sectorName)}</span></div>
        <span class="atlas-v2-group-count">${items.length} ${items.length === 1 ? 'elemento' : 'elementos'}${subitemCount ? ` · ${subitemCount} ${subitemCount === 1 ? 'subelemento' : 'subelementos'}` : ''}</span>
        <span class="atlas-v2-group-head-spacer" aria-hidden="true"></span>
      </header>
      ${expanded ? `<div class="atlas-v2-table-sticky-head" data-sticky-work-sector="${attr(sectorName)}">
        <table class="atlas-v2-table" style="width:${tableWidth}px;min-width:${tableWidth}px">${tableHead}</table>
      </div><div class="atlas-v2-table-wrap">
        <table class="atlas-v2-table" style="width:${tableWidth}px;min-width:${tableWidth}px">
          <tbody>${items.map((itemEntry) => renderItemRows(boardEntry, itemEntry)).join('') || `<tr><td colspan="${boardEntry.columns.length + 3}" class="atlas-v2-empty-cell">Nenhum registro em ${escapeHtml(sectorName)}.</td></tr>`}</tbody>
        </table>
        <button class="atlas-v2-add-row" type="button" data-action="add-work-element" data-item-id="${attr(workItem.id)}" data-work-sector="${attr(sectorName)}"><i data-lucide="plus"></i><span>Adicionar elemento em ${escapeHtml(sectorName)}</span></button>
      </div>` : ''}
    </section>`;
  }

  function renderSectorizedWorks(boardEntry) {
    const selected = selectedWork(boardEntry);
    if (!selected) return renderEmptyBoard();
    const columnId = boardEntry.settings?.works_sector_column_id;
    const configured = Array.isArray(boardEntry.settings?.works_sector_order) ? boardEntry.settings.works_sector_order : [];
    const discovered = visibleSubitems(boardEntry, selected.item)
      .map((entry) => String(entry.values?.[columnId] || '').trim())
      .filter(Boolean);
    const sectors = [...new Set([...configured, ...discovered])];
    if (!sectors.length) return renderEmptyBoard();
    const query = contextualItemSearch(boardEntry);
    const visibleSectors = query
      ? sectors.filter((sectorName) => contextualSectorMatch(sectorName, query) || sectorizedWorkItems(boardEntry, selected.item, sectorName).length > 0)
      : sectors;
    if (!visibleSectors.length) return `<div class="atlas-v2-empty-view"><div><i data-lucide="search-x"></i><strong>Nenhum setor, item ou subitem encontrado</strong></div></div>`;
    return visibleSectors.map((sectorName) => renderWorkSectorTable(boardEntry, selected.item, sectorName, sectors.indexOf(sectorName))).join('');
  }

  function boardScrollerKey(element, index = 0) {
    if (!element) return `scroller:${index}`;
    if (element.id) return `id:${element.id}`;
    if (element.classList.contains('atlas-v2-work-tabs')) return 'work-tabs';
    if (element.classList.contains('atlas-v2-gantt-scroll')) return 'gantt';
    const workSector = element.closest('[data-work-sector]');
    if (workSector) return `work-sector:${workSector.getAttribute('data-work-sector') || index}`;
    const group = element.closest('[data-group-id]');
    if (group) return `group:${group.getAttribute('data-group-id') || index}`;
    return `${[...element.classList].sort().join('.')}:${index}`;
  }

  function focusDescriptor(element) {
    if (!element || !['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) return null;
    const descriptor = {
      itemValue: element.dataset.itemValue || '',
      columnId: element.dataset.columnId || '',
      itemName: element.dataset.itemName || '',
      type: element.type || '',
      value: element.value,
      checked: Boolean(element.checked),
      selectionStart: null,
      selectionEnd: null,
    };
    try {
      if (typeof element.selectionStart === 'number') descriptor.selectionStart = element.selectionStart;
      if (typeof element.selectionEnd === 'number') descriptor.selectionEnd = element.selectionEnd;
    } catch (_) {}
    return descriptor.itemValue || descriptor.itemName ? descriptor : null;
  }

  function captureBoardUiState() {
    const boardScroll = document.getElementById('atlas-v2-board-scroll');
    const root = document.getElementById('atlas-v2-board-content');
    const boardId = String(root?.dataset?.boardId || runtime.data?.activeBoardId || '');
    if (runtime.pendingBoardUiState?.boardId === boardId) {
      // Ha uma restauracao pendente para este mesmo quadro (render em rajada).
      // Reaproveitar o snapshot evita perder a posicao original, mas ele nao pode
      // ser propagado cru: se o usuario digitou depois da captura anterior, o
      // valor/cursor atuais do campo em foco precisam substituir os antigos, ou a
      // restauracao reescreveria o texto antigo por cima do que foi digitado.
      const pendingState = runtime.pendingBoardUiState.state;
      if (pendingState && root && root.contains(document.activeElement)) {
        const liveFocus = focusDescriptor(document.activeElement);
        if (liveFocus) pendingState.focus = liveFocus;
      }
      return pendingState;
    }
    if (!boardScroll || !root) return runtime.boardUiStates.get(boardId) || null;
    const scrollers = [...root.querySelectorAll('.atlas-v2-table-wrap, .atlas-v2-work-tabs, .atlas-v2-gantt-scroll')]
      .map((element, index) => ({
        key: boardScrollerKey(element, index),
        left: element.scrollLeft,
        top: element.scrollTop,
      }));
    const state = {
      boardId,
      boardLeft: boardScroll.scrollLeft,
      boardTop: boardScroll.scrollTop,
      scrollers,
      focus: root.contains(document.activeElement) ? focusDescriptor(document.activeElement) : null,
    };
    runtime.boardUiStates.set(boardId, state);
    return state;
  }

  function restoreBoardUiState(state, token) {
    if (!state || state.boardId !== String(runtime.data?.activeBoardId || '')) return;
    const apply = () => {
      if (token !== runtime.boardUiRestoreToken) return;
      const boardScroll = document.getElementById('atlas-v2-board-scroll');
      const root = document.getElementById('atlas-v2-board-content');
      if (!boardScroll || !root) return;
      boardScroll.scrollLeft = Number(state.boardLeft || 0);
      boardScroll.scrollTop = Number(state.boardTop || 0);
      const candidates = [...root.querySelectorAll('.atlas-v2-table-wrap, .atlas-v2-work-tabs, .atlas-v2-gantt-scroll')];
      (state.scrollers || []).forEach((saved) => {
        const element = candidates.find((candidate, index) => boardScrollerKey(candidate, index) === saved.key);
        if (!element) return;
        element.scrollLeft = Number(saved.left || 0);
        element.scrollTop = Number(saved.top || 0);
      });
      const focus = state.focus;
      if (focus) {
        const target = [...root.querySelectorAll('[data-item-value], [data-item-name]')].find((element) => {
          if (focus.itemName) return String(element.dataset.itemName || '') === String(focus.itemName);
          return String(element.dataset.itemValue || '') === String(focus.itemValue)
            && String(element.dataset.columnId || '') === String(focus.columnId);
        });
        if (target && !target.disabled) {
          if (focus.type === 'checkbox') target.checked = Boolean(focus.checked);
          else if (focus.value !== undefined) target.value = focus.value;
          try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
          try {
            if (focus.selectionStart !== null && typeof target.setSelectionRange === 'function') {
              target.setSelectionRange(focus.selectionStart, focus.selectionEnd ?? focus.selectionStart);
            }
          } catch (_) {}
        }
      }
      runtime.boardUiStates.set(state.boardId, state);
      if (runtime.pendingBoardUiState?.token === token) runtime.pendingBoardUiState = null;
    };
    requestAnimationFrame(() => requestAnimationFrame(apply));
  }

  function renderBoardContent(boardEntry) {
    // Uma agregacao de coluna e igual em todas as linhas. O cache vale apenas
    // durante esta renderizacao e evita recalcular o quadro inteiro para cada
    // celula de formula exibida.
    if (boardHasColumnAggregation(boardEntry)) boardFormulaAggregateCache(boardEntry, true);
    const capturedState = captureBoardUiState();
    const targetBoardId = String(boardEntry?.id || runtime.data?.activeBoardId || '');
    const uiState = capturedState?.boardId === targetBoardId
      ? capturedState
      : (runtime.boardUiStates.get(targetBoardId) || null);
    const restoreToken = ++runtime.boardUiRestoreToken;
    runtime.pendingBoardUiState = uiState ? { boardId: targetBoardId, state: uiState, token: restoreToken } : null;
    const root = document.getElementById('atlas-v2-board-content');
    if (!root) return;
    root.dataset.boardId = targetBoardId;
    const mobileVertical = window.innerWidth <= 820;
    document.body.classList.toggle('atlas-v2-mobile-card-view', mobileVertical && ['table', 'works'].includes(boardEntry.activeView));
    root.classList.toggle('is-mobile-vertical-view', mobileVertical);
    root.classList.toggle('is-gantt-view', boardEntry.activeView === 'gantt' && !mobileVertical);
    const fieldModeActive = mobileVertical && boardEntry.activeView === 'table';
    root.classList.toggle('is-field-mode-view', fieldModeActive);
    if (boardEntry.activeView === 'works') {
      ensureWorkSelection(boardEntry);
      if (mobileVertical) {
        root.innerHTML = renderMobileWorks(boardEntry);
      } else {
        const content = boardEntry.settings?.works_mode === 'sectorized'
          ? renderSectorizedWorks(boardEntry)
          : (visibleGroups(boardEntry).map((groupEntry, groupIndex) => renderGroupTable(boardEntry, groupEntry, groupIndex)).join('') || renderEmptyBoard());
        root.innerHTML = renderWorkTabs(boardEntry) + content;
      }
      revealContextSearchWork(boardEntry, false);
    } else if (boardEntry.activeView === 'gantt') {
      if (mobileVertical) {
        root.innerHTML = renderMobileGantt(boardEntry);
      } else {
        const labelWidth = 500;
        const availableTimelineWidth = Math.max(720, (root.clientWidth || 1098) - 48 - labelWidth);
        root.innerHTML = renderGantt(boardEntry, availableTimelineWidth, labelWidth);
      }
    } else if (boardEntry.activeView === 'calendar') {
      root.innerHTML = mobileVertical ? renderMobileCalendar(boardEntry) : renderCalendar(boardEntry);
    } else if (boardEntry.activeView === 'dashboard') {
      root.innerHTML = renderDashboard(boardEntry);
    } else if (boardEntry.activeView === 'kanban') {
      root.innerHTML = renderKanban(boardEntry);
    } else if (fieldModeActive) {
      root.innerHTML = renderFieldMode(boardEntry);
    } else {
      root.innerHTML = visibleGroups(boardEntry).map((groupEntry) => renderGroupTable(boardEntry, groupEntry, boardEntry.groups.indexOf(groupEntry))).join('') || `<div class="atlas-v2-empty-view"><div><i data-lucide="search-x"></i><strong>Nenhum setor, item ou subitem encontrado</strong></div></div>`;
    }
    restoreBoardUiState(uiState, restoreToken);
    void ensureBoardViewData(boardEntry);
  }

  function renderEmptyBoard() {
    // Antes era so icone + frase - as demais telas vazias do app
    // (Automacoes, Notificacoes) ja orientam o proximo passo com texto e
    // botao; o quadro vazio, que e a tela que mais gente ve logo apos criar
    // um quadro novo, ficava para tras nesse padrao.
    return `<div class="atlas-v2-empty-view"><div><i data-lucide="table-properties"></i><strong>O quadro ainda não possui grupos</strong><span>Crie o primeiro grupo para começar a adicionar itens.</span><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="add-group"><i data-lucide="plus"></i>Criar grupo</button></div></div>`;
  }

  function renderGroupTable(boardEntry, groupEntry, groupIndex = 0) {
    const items = filteredItems(boardEntry, groupEntry);
    const searchOpensSector = contextualSectorMatch(groupEntry.name, contextualItemSearch(boardEntry));
    const groupCollapsed = groupEntry.collapsed && !searchOpensSector;
    const selectableIds = items.flatMap((entry) => itemTreeIds(entry, []));
    const allSelected = selectableIds.length > 0 && selectableIds.every((itemId) => runtime.selectedItems.has(itemId));
    const subitemCount = items.reduce((total, entry) => total + visibleSubitems(boardEntry, entry).length, 0);
    const columnsWidth = boardEntry.columns.reduce((total, entry) => total + Number(entry.width || 160), 0);
    const tableWidth = 40 + 500 + columnsWidth + 42;
    const tableHead = `<thead><tr>
      <th class="atlas-v2-select-cell"><input class="atlas-v2-checkbox" type="checkbox" data-action="select-group" data-group-id="${attr(groupEntry.id)}" ${allSelected ? 'checked' : ''} aria-label="Selecionar grupo"></th>
      <th class="atlas-v2-item-cell"><div class="atlas-v2-column-head"><i data-lucide="scan-line"></i><span>Registro</span></div></th>
      ${boardEntry.columns.map((columnEntry) => `<th style="width:${Number(columnEntry.width || 160)}px;min-width:${Number(columnEntry.width || 160)}px" draggable="true" data-column-id="${attr(columnEntry.id)}"><div class="atlas-v2-column-head"><i data-lucide="${attr(COLUMN_TYPES[columnEntry.type]?.icon || 'type')}"></i><span>${escapeHtml(columnEntry.name)}</span></div></th>`).join('')}
      <th class="atlas-v2-end-spacer" aria-hidden="true"></th>
    </tr></thead>`;
    return `<section class="atlas-v2-group" style="--group-color:${attr(groupEntry.color || '#0f6cbd')}" data-group-id="${attr(groupEntry.id)}" draggable="true">
      <header class="atlas-v2-group-head">
        <span class="atlas-v2-group-index">${String(groupIndex + 1).padStart(2, '0')}</span>
        <button type="button" data-action="toggle-group" data-group-id="${attr(groupEntry.id)}" title="${groupCollapsed ? 'Expandir grupo' : 'Recolher grupo'}"><i data-lucide="${groupCollapsed ? 'chevron-right' : 'chevron-down'}"></i></button>
        <div class="atlas-v2-group-title"><span>${escapeHtml(groupEntry.name)}</span></div>
        <span class="atlas-v2-group-count">${items.length} ${items.length === 1 ? 'item' : 'itens'}${subitemCount ? ` · ${subitemCount} ${subitemCount === 1 ? 'subitem' : 'subitens'}` : ''}</span>
        <button type="button" data-action="group-menu" data-group-id="${attr(groupEntry.id)}" title="Opções do grupo"><i data-lucide="more-horizontal"></i></button>
      </header>
      ${groupCollapsed ? '' : `<div class="atlas-v2-table-sticky-head" data-sticky-group="${attr(groupEntry.id)}">
        <table class="atlas-v2-table" style="width:${tableWidth}px;min-width:${tableWidth}px">${tableHead}</table>
      </div><div class="atlas-v2-table-wrap" data-drop-group="${attr(groupEntry.id)}">
        <table class="atlas-v2-table" style="width:${tableWidth}px;min-width:${tableWidth}px">
          <tbody>
            ${items.map((itemEntry) => renderItemRows(boardEntry, itemEntry)).join('')}
          </tbody>
        </table>
        <button class="atlas-v2-add-row" type="button" data-action="add-item-to-group" data-group-id="${attr(groupEntry.id)}"><i data-lucide="plus"></i><span>Adicionar item</span></button>
      </div>`}
    </section>`;
  }

  function renderItemRows(boardEntry, itemEntry, parentItem = null, depth = 0) {
    const expanded = itemEntry.subitemsExpanded !== false;
    const mainRow = renderItemRow(boardEntry, itemEntry, parentItem, expanded, depth);
    const subitems = visibleSubitems(boardEntry, itemEntry);
    if (!expanded || !subitems.length) return mainRow;
    return mainRow + subitems.map((subitem) => renderItemRows(boardEntry, subitem, itemEntry, depth + 1)).join('');
  }

  function renderItemRow(boardEntry, itemEntry, parentItem = null, expanded = true, depth = 0) {
    const isSubitem = Boolean(parentItem);
    const sla = boardSlaState(boardEntry, itemEntry);
    return `<tr class="atlas-v2-item-row ${isSubitem ? 'is-subitem' : ''} ${runtime.selectedItems.has(itemEntry.id) ? 'is-selected' : ''}" data-item-id="${attr(itemEntry.id)}" style="--item-depth:${Math.max(0, depth)}" draggable="true">
      <td class="atlas-v2-select-cell"><input class="atlas-v2-checkbox" type="checkbox" data-action="select-item" data-item-id="${attr(itemEntry.id)}" ${runtime.selectedItems.has(itemEntry.id) ? 'checked' : ''} aria-label="Selecionar item"></td>
      <td class="atlas-v2-item-cell"><div class="atlas-v2-item-name-wrap ${isSubitem ? 'is-subitem' : ''}">
        ${isSubitem ? '<span class="atlas-v2-subitem-branch" aria-hidden="true"></span>' : `<button class="atlas-v2-subitem-toggle" type="button" data-action="toggle-subitems" data-item-id="${attr(itemEntry.id)}" title="${expanded ? 'Recolher subitens' : 'Expandir subitens'}"><i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}"></i><span>${visibleSubitems(boardEntry, itemEntry).length}</span></button>`}
        <span class="atlas-v2-drag-handle"><i data-lucide="grip-vertical"></i></span><input class="atlas-v2-cell-input" data-item-name="${attr(itemEntry.id)}" value="${attr(itemEntry.name)}" aria-label="Nome do ${isSubitem ? 'subitem' : 'item'}"><span class="atlas-v2-row-actions atlas-v2-row-actions-inline">${isSubitem ? '' : `<button type="button" data-action="add-subitem" data-item-id="${attr(itemEntry.id)}" title="Adicionar subitem"><i data-lucide="list-tree"></i></button>`}<button type="button" data-action="item-chat" data-item-id="${attr(itemEntry.id)}" title="Conversa" aria-label="Conversa"><i data-lucide="message-square"></i>${itemChatCount(itemEntry.id) ? `<b>${itemChatCount(itemEntry.id)}</b>` : ''}</button><button type="button" data-action="item-history" data-item-id="${attr(itemEntry.id)}" title="Histórico"><i data-lucide="history"></i></button><button type="button" data-action="item-move-board" data-item-id="${attr(itemEntry.id)}" title="Mover para outro módulo" aria-label="Mover para outro módulo"><i data-lucide="arrow-right-left"></i></button><button type="button" data-action="duplicate-item" data-item-id="${attr(itemEntry.id)}" title="Duplicar"><i data-lucide="copy"></i></button><button class="is-danger" type="button" data-action="delete-item" data-item-id="${attr(itemEntry.id)}" title="Excluir"><i data-lucide="trash-2"></i></button></span>${sla ? `<span class="atlas-v2-sla-chip is-${sla.level}" title="SLA por ${attr(sla.dateColumn.name)}">${escapeHtml(sla.label)}</span>` : ''}</div></td>
      ${boardEntry.columns.map((columnEntry) => `<td style="width:${Number(columnEntry.width || 160)}px;min-width:${Number(columnEntry.width || 160)}px">${renderCell(columnEntry, itemEntry)}</td>`).join('')}
      <td class="atlas-v2-end-spacer" aria-hidden="true"></td>
    </tr>`;
  }

  // Nucleo comum do calculo da formula, em numero puro (sem formatacao) -
  // usado tanto para o resultado final quanto para resolver, recursivamente,
  // uma coluna-fonte que e ela mesma uma formula (o resultado de uma formula
  // nunca fica salvo em item.values, so e calculado na hora, entao nao tem
  // como resolveValue encontra-lo la - precisa ser recalculado aqui).
  // Retorna undefined para formula com sintaxe invalida (ou referencia
  // circular: A depende de B que depende de A) - um sentinela dedicado, pois
  // NaN tambem e um resultado ARITMETICO legitimo (ex.: 0/0) e nao pode ser
  // usado para sinalizar "sintaxe invalida" sem colidir com esse caso. Para
  // resultado numerico (finito ou nao - Infinity, -Infinity, NaN de calculo)
  // retorna o numero normalmente; quem chama decide o texto exibido.
  // Resolve um operando de condicao do SE(): ou uma referencia {Coluna}
  // (mesma resolucao usada no corpo da formula, incluindo colunas-formula
  // encadeadas) ou um numero literal. NaN sinaliza operando invalido.
  function resolveFormulaOperand(boardEntry, columnEntry, itemEntry, resolveValue, visited, raw) {
    const trimmed = String(raw || '').trim();
    const refMatch = trimmed.match(/^\{([^}]+)\}$/);
    if (!refMatch) {
      const numeric = Number(trimmed.replace(',', '.'));
      return Number.isFinite(numeric) ? numeric : NaN;
    }
    const name = refMatch[1].trim().toLowerCase();
    const source = boardEntry.columns.find((entry) => entry.id !== columnEntry.id && entry.name.toLowerCase() === name);
    if (!source) return 0;
    let value;
    if (source.type === 'formula') {
      const nested = evaluateFormulaNumeric(boardEntry, source, itemEntry, resolveValue, visited);
      value = Number.isFinite(nested) ? nested : 0;
    } else {
      value = resolveValue(source);
    }
    const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  // Avalia a condicao de um SE(condicao;entao;senao) - um unico comparador
  // entre dois operandos (referencia {Coluna} ou numero literal). undefined
  // sinaliza condicao malformada (formula invalida).
  function evaluateFormulaCondition(boardEntry, columnEntry, itemEntry, resolveValue, visited, condition) {
    const match = String(condition || '').match(/^(.+?)(<>|>=|<=|=|>|<)(.+)$/);
    if (!match) return undefined;
    const left = resolveFormulaOperand(boardEntry, columnEntry, itemEntry, resolveValue, visited, match[1]);
    const right = resolveFormulaOperand(boardEntry, columnEntry, itemEntry, resolveValue, visited, match[3]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return undefined;
    switch (match[2]) {
      case '>': return left > right;
      case '<': return left < right;
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '=': return left === right;
      case '<>': return left !== right;
      default: return undefined;
    }
  }

  // SOMA/MEDIA/MINIMO/MAXIMO/CONT({Coluna}) somam/agregam o valor daquela
  // coluna entre os SUBITENS diretos do item sendo calculado (rollup, como
  // em Monday/Excel). CONT conta os subitens, ignorando a coluna informada.
  function aggregateSubitemColumn(boardEntry, itemEntry, operator, columnName) {
    const subitems = Array.isArray(itemEntry?.subitems) ? itemEntry.subitems : [];
    if (operator === 'CONT') return subitems.length;
    const name = String(columnName || '').trim().toLowerCase();
    const source = boardEntry.columns.find((entry) => entry.name.toLowerCase() === name);
    if (!source || !subitems.length) return 0;
    const values = subitems.map((subitem) => {
      const value = source.type === 'formula'
        ? evaluateFormulaNumeric(boardEntry, source, subitem, (col) => subitem.values?.[col.id], new Set())
        : subitem.values?.[source.id];
      // Celula vazia e IGNORADA, nao contada como zero (mesma convencao de
      // planilha): senao um subitem em branco puxaria a MEDIA para baixo e
      // zeraria o MINIMO. So vale para valor realmente ausente - um zero
      // digitado de proposito continua entrando na conta.
      if (value === '' || value === null || value === undefined) return null;
      const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : Number(String(value).replace(',', '.'));
      return Number.isFinite(numeric) ? numeric : null;
    }).filter((entry) => entry !== null);
    if (!values.length) return 0;
    switch (operator) {
      case 'SOMA': return values.reduce((total, entry) => total + entry, 0);
      case 'MEDIA': return values.reduce((total, entry) => total + entry, 0) / values.length;
      case 'MINIMO': return Math.min(...values);
      case 'MAXIMO': return Math.max(...values);
      default: return 0;
    }
  }

  // SOMA_COLUNA/MEDIA_COLUNA/MINIMO_COLUNA/MAXIMO_COLUNA/CONT_COLUNA
  // agregam a coluna entre os ELEMENTOS principais ativos de todos os grupos
  // do quadro. Subitens ficam de fora de proposito: o rollup deles continua
  // sendo responsabilidade de SOMA/MEDIA/... no contexto de cada elemento.
  // CONT_COLUNA conta celulas preenchidas, inclusive texto e o numero zero.
  function boardFormulaAggregateCache(boardEntry, reset = false) {
    const revision = typeof runtime === 'undefined' ? 0 : Number(runtime.dataRevision || 0);
    let state = boardEntry?.__atlasFormulaAggregateCache;
    if (reset || !state || state.revision !== revision || !(state.values instanceof Map)) {
      state = { revision, values: new Map() };
      try {
        Object.defineProperty(boardEntry, '__atlasFormulaAggregateCache', {
          value: state,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      } catch (_) {
        boardEntry.__atlasFormulaAggregateCache = state;
      }
    }
    return state.values;
  }

  function aggregateBoardColumn(boardEntry, columnEntry, operator, columnName, visited) {
    const name = String(columnName || '').trim().toLowerCase();
    const source = (boardEntry.columns || []).find((entry) => entry.id !== columnEntry.id && entry.name.toLowerCase() === name);
    if (!source) return 0;
    const cache = boardFormulaAggregateCache(boardEntry);
    const cacheKey = `${columnEntry.id}\u0000${operator}\u0000${source.id}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const items = (boardEntry.groups || [])
      .flatMap((groupEntry) => groupEntry.items || [])
      .filter((entry) => !entry.archived);
    if (!items.length) {
      cache.set(cacheKey, 0);
      return 0;
    }
    const rawValues = items.map((entry) => source.type === 'formula'
      ? evaluateFormulaNumeric(boardEntry, source, entry, (col) => entry.values?.[col.id], new Set(visited))
      : entry.values?.[source.id]);
    const filled = rawValues.filter((value) => value !== '' && value !== null && value !== undefined);
    if (operator === 'CONT_COLUNA') {
      const count = source.type === 'formula'
        ? filled.filter((value) => Number.isFinite(value)).length
        : rawValues.filter((value) => value !== '' && value !== null && value !== undefined).length;
      cache.set(cacheKey, count);
      return count;
    }
    const values = filled.map((value) => {
      const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : Number(String(value).replace(',', '.'));
      return Number.isFinite(numeric) ? numeric : null;
    }).filter((entry) => entry !== null);
    if (!values.length) {
      cache.set(cacheKey, 0);
      return 0;
    }
    let result = 0;
    switch (operator) {
      case 'SOMA_COLUNA': result = values.reduce((total, entry) => total + entry, 0); break;
      case 'MEDIA_COLUNA': result = values.reduce((total, entry) => total + entry, 0) / values.length; break;
      case 'MINIMO_COLUNA': result = Math.min(...values); break;
      case 'MAXIMO_COLUNA': result = Math.max(...values); break;
      default: result = 0;
    }
    cache.set(cacheKey, result);
    return result;
  }

  // Divide os argumentos de uma chamada (separados por ";") respeitando
  // parenteses internos - "SE(1;(A+B);2)" nao pode quebrar no ";" de dentro
  // de um argumento que, por sua vez, contem parenteses de aritmetica.
  function splitFormulaArgs(argsText) {
    const parts = [];
    let depth = 0;
    let last = 0;
    for (let i = 0; i < argsText.length; i += 1) {
      const ch = argsText[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      else if (ch === ';' && depth === 0) {
        parts.push(argsText.slice(last, i));
        last = i + 1;
      }
    }
    parts.push(argsText.slice(last));
    return parts;
  }

  // Encontra a chamada NOME(...) mais interna da expressao - isto e, cujo
  // argumento nao contem nenhuma outra chamada SE/agregacao ainda pendente.
  // Usa contagem de profundidade de parenteses (nao um
  // regex "sem parenteses dentro"), porque o proprio texto substituido de um
  // SE aninhado ou de um argumento aritmetico como "({A}+{B})" pode conter
  // parenteses legitimos - so a presenca de outra chamada de formula pendente
  // dentro do argumento importa para decidir se e "mais interna" ou nao.
  function findInnermostFormulaCall(expression, namePattern) {
    const re = new RegExp(`\\b(${namePattern})\\(`, 'gi');
    let match;
    while ((match = re.exec(expression))) {
      let depth = 1;
      let i = match.index + match[0].length;
      while (i < expression.length && depth > 0) {
        if (expression[i] === '(') depth += 1;
        else if (expression[i] === ')') depth -= 1;
        i += 1;
      }
      if (depth !== 0) continue; // parenteses desbalanceados - formula invalida, ignora
      const argsText = expression.slice(match.index + match[0].length, i - 1);
      if (/\b(SE|SOMA_COLUNA|MEDIA_COLUNA|MINIMO_COLUNA|MAXIMO_COLUNA|CONT_COLUNA|SOMA|MEDIA|MINIMO|MAXIMO|CONT)\(/i.test(argsText)) continue; // ha chamada mais interna ainda por resolver
      return { name: match[1].toUpperCase(), start: match.index, end: i, argsText };
    }
    return null;
  }

  // Resolve, numa unica passada, o SE(...) ou agregacao MAIS INTERNO da
  // expressao. Repetir essa passada de fora resolve o aninhamento de dentro
  // para fora. Retorna null quando nao ha mais nada para resolver.
  function resolveInnermostFormulaCall(boardEntry, columnEntry, itemEntry, resolveValue, visited, expression) {
    const aggregateCall = findInnermostFormulaCall(expression, 'SOMA_COLUNA|MEDIA_COLUNA|MINIMO_COLUNA|MAXIMO_COLUNA|CONT_COLUNA|SOMA|MEDIA|MINIMO|MAXIMO|CONT');
    if (aggregateCall) {
      const colMatch = aggregateCall.argsText.trim().match(/^\{([^{}]+)\}$/);
      const result = colMatch
        ? (aggregateCall.name.endsWith('_COLUNA')
          ? aggregateBoardColumn(boardEntry, columnEntry, aggregateCall.name, colMatch[1], visited)
          : aggregateSubitemColumn(boardEntry, itemEntry, aggregateCall.name, colMatch[1]))
        : 'ERRO';
      return expression.slice(0, aggregateCall.start) + String(result) + expression.slice(aggregateCall.end);
    }
    const seCall = findInnermostFormulaCall(expression, 'SE');
    if (seCall) {
      const args = splitFormulaArgs(seCall.argsText);
      const replacement = args.length === 3
        ? (() => {
          const condition = evaluateFormulaCondition(boardEntry, columnEntry, itemEntry, resolveValue, visited, args[0]);
          if (condition === undefined) return null;
          return condition ? args[1].trim() : args[2].trim();
        })()
        : null;
      if (replacement === null) return expression.slice(0, seCall.start) + 'ERRO' + expression.slice(seCall.end);
      return expression.slice(0, seCall.start) + `(${replacement})` + expression.slice(seCall.end);
    }
    return null;
  }

  // Avaliador aritmetico pequeno e deterministico. Formula antes usava
  // Function(), que o CSP correto do Atlas bloqueia no navegador. Alem de
  // recuperar os calculos, este parser aceita somente numeros, operadores e
  // parenteses - sem executar codigo vindo de uma coluna.
  function evaluateFormulaArithmetic(expression) {
    const compact = String(expression || '').replace(/\s+/g, '');
    if (!compact || !/^[\d+\-*/().%]+$/.test(compact)) return undefined;

    const tokens = compact.match(/\d+(?:\.\d+)?|[()+\-*/%]/g);
    if (!tokens || tokens.join('') !== compact) return undefined;

    const INVALID = Symbol('formula-invalida');
    let cursor = 0;
    const peek = () => tokens[cursor];
    const take = () => tokens[cursor++];

    const parseFactor = () => {
      const token = peek();
      if (token === '+' || token === '-') {
        take();
        const value = parseFactor();
        if (value === INVALID) return INVALID;
        return token === '-' ? -value : value;
      }
      if (token === '(') {
        take();
        const value = parseExpression();
        if (value === INVALID || take() !== ')') return INVALID;
        return value;
      }
      if (!/^\d/.test(token || '')) return INVALID;
      take();
      const value = Number(token);
      return Number.isFinite(value) ? value : INVALID;
    };

    const parseTerm = () => {
      let value = parseFactor();
      while (value !== INVALID && ['*', '/', '%'].includes(peek())) {
        const operator = take();
        const right = parseFactor();
        if (right === INVALID) return INVALID;
        if (operator === '*') value *= right;
        if (operator === '/') value /= right;
        if (operator === '%') value %= right;
      }
      return value;
    };

    const parseExpression = () => {
      let value = parseTerm();
      while (value !== INVALID && ['+', '-'].includes(peek())) {
        const operator = take();
        const right = parseTerm();
        if (right === INVALID) return INVALID;
        value = operator === '+' ? value + right : value - right;
      }
      return value;
    };

    const result = parseExpression();
    return result === INVALID || cursor !== tokens.length ? undefined : result;
  }

  function evaluateFormulaNumeric(boardEntry, columnEntry, itemEntry, resolveValue, visited) {
    let expression = String(columnEntry.formula || '').trim();
    if (!expression) return null;
    if (visited.has(columnEntry.id)) return undefined;
    visited.add(columnEntry.id);
    // O `visited` existe para barrar referencia CIRCULAR (A depende de B que
    // depende de A), e por isso a coluna tem de continuar marcada durante toda a
    // sua propria subarvore de dependencias.
    //
    // Mas ela precisa ser LIBERADA ao sair do escopo (backtracking). Sem o
    // finally abaixo, duas referencias IRMAS a mesma coluna-formula caiam no
    // `visited.has` e virava 0 silenciosamente - numero errado na tela, sem
    // nenhum aviso. Dois casos reais que quebravam:
    //   {Total} + {Total}            -> devolvia {Total}, nao o dobro
    //   SE({Total}>1;{Total};0)      -> a condicao "gastava" {Total} e o
    //                                   resultado virava 0
    // O segundo e exatamente o formato sugerido no placeholder do campo Formula.
    // Coberto por tests/formula-engine-unit.cjs.
    try {
      // Limite de seguranca contra formula malformada que nunca estabiliza
      // (ex.: parenteses desbalanceados) - qualquer formula real resolve em
      // poucas passadas mesmo com varios niveis de SE/agregacao aninhados.
      for (let guard = 0; guard < 30; guard += 1) {
        const next = resolveInnermostFormulaCall(boardEntry, columnEntry, itemEntry, resolveValue, visited, expression);
        if (next === null) break;
        expression = next;
      }
      const replaced = expression.replace(/\{([^}]+)\}/g, (_, rawName) => {
        const name = String(rawName || '').trim().toLowerCase();
        const source = boardEntry.columns.find((entry) => entry.id !== columnEntry.id && entry.name.toLowerCase() === name);
        let value;
        if (!source) {
          value = 0;
        } else if (source.type === 'formula') {
          const nested = evaluateFormulaNumeric(boardEntry, source, itemEntry, resolveValue, visited);
          value = Number.isFinite(nested) ? nested : 0;
        } else {
          value = resolveValue(source);
        }
        // Valor de checkbox e booleano (true/false); String(true) vira "true",
        // que Number() nao converte (fica NaN e cairia sempre em '0', mesmo
        // marcado). Precisa virar 1/0 antes de tentar converter como numero.
        const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : Number(String(value ?? '').replace(',', '.'));
        return Number.isFinite(numeric) ? String(numeric) : '0';
      });
      return evaluateFormulaArithmetic(replaced);
    } finally {
      visited.delete(columnEntry.id);
    }
  }

  // resolveValue decide de onde vem o valor de cada coluna referenciada - do
  // modelo (found.item.values, o dado ja confirmado) ou do proprio campo em
  // tela (para a previa ao vivo, enquanto o usuario ainda esta digitando e o
  // valor ainda nao foi salvo).
  function evaluateFormula(boardEntry, columnEntry, itemEntry, resolveValue) {
    if (!String(columnEntry.formula || '').trim()) return '';
    const result = evaluateFormulaNumeric(boardEntry, columnEntry, itemEntry, resolveValue, new Set());
    if (result === undefined) return 'Fórmula inválida';
    if (!Number.isFinite(result)) return '';
    const decimals = Math.min(6, Math.max(0, Number(columnEntry.decimals ?? 2)));
    if (columnEntry.format === 'currency') return result.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: decimals });
    if (columnEntry.format === 'percentage') return `${result.toLocaleString('pt-BR', { maximumFractionDigits: decimals })}%`;
    return result.toLocaleString('pt-BR', { maximumFractionDigits: decimals });
  }

  function formulaColumnValue(boardEntry, itemEntry, columnEntry) {
    return evaluateFormula(boardEntry, columnEntry, itemEntry, (source) => itemEntry.values?.[source.id]);
  }

  // Formata um numero guardado (ex.: 1500.5) como "R$ 1.500,50" para exibir
  // no campo. Vazio/invalido mostra vazio, nao "R$ 0,00", para nao sugerir
  // que o campo ja tem um valor quando na verdade esta em branco.
  function formatCurrencyDisplay(rawValue) {
    if (rawValue === '' || rawValue === null || rawValue === undefined) return '';
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return '';
    return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Mascara "de centavos para cima", igual a maioria dos apps bancarios BR:
  // cada digito novo entra pela direita, os dois ultimos digitos sempre sao
  // os centavos. Recebe o texto atual do campo (ja formatado ou nao) e
  // devolve o texto formatado a partir dos digitos nele contidos.
  function maskCurrencyInput(rawText) {
    const digits = String(rawText || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (!digits) return '';
    const cents = parseInt(digits, 10);
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Converte o texto exibido ("R$ 1.500,50") de volta para um numero simples
  // (1500.5), que e o que fica guardado em item.values - formulas, filtros e
  // ordenacao continuam enxergando um numero comum, sem saber da mascara.
  function parseCurrencyInput(displayText) {
    const digits = String(displayText || '').replace(/\D/g, '');
    if (!digits) return '';
    return (parseInt(digits, 10) / 100).toFixed(2);
  }

  // Mesmo calculo, mas lendo cada coluna referenciada direto do campo em tela
  // (se ele existir e ainda nao tiver sido substituido pelo valor confirmado).
  // Usado para atualizar a formula a cada tecla digitada, sem esperar o
  // usuario sair do campo ou apertar Enter.
  function formulaColumnValueLive(boardEntry, itemEntry, columnEntry) {
    return evaluateFormula(boardEntry, columnEntry, itemEntry, (source) => {
      const field = document.querySelector(`[data-item-value="${cssAttrValue(itemEntry.id)}"][data-column-id="${cssAttrValue(source.id)}"]`);
      if (!field) return itemEntry.values?.[source.id];
      if (field.matches('select')) return field.value;
      if (field.type === 'checkbox') return field.checked ? 1 : 0;
      if (source.type === 'currency') return parseCurrencyInput(field.value);
      return field.value;
    });
  }

  // Escapa um valor para uso dentro de um seletor de atributo CSS.
  function cssAttrValue(value) {
    const text = String(value ?? '');
    return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(text) : text.replace(/["\\]/g, '\\$&');
  }

  function updateFormulaCellsLive(itemId, changedField = null) {
    const context = findBoard();
    const found = context && findItem(context.board, itemId);
    if (!found) return;
    const hasColumnAggregation = boardHasColumnAggregation(context.board);
    if (hasColumnAggregation) boardFormulaAggregateCache(context.board, true);
    const changedColumn = changedField && context.board.columns.find((entry) => entry.id === changedField.dataset.columnId);
    const hadValue = changedColumn && Object.prototype.hasOwnProperty.call(found.item.values || {}, changedColumn.id);
    const previousValue = changedColumn ? found.item.values?.[changedColumn.id] : undefined;
    if (changedColumn) {
      if (!found.item.values) found.item.values = {};
      found.item.values[changedColumn.id] = changedField.type === 'checkbox'
        ? changedField.checked
        : (changedColumn.type === 'currency' ? parseCurrencyInput(changedField.value) : changedField.value);
    }
    try {
      const selector = hasColumnAggregation
        ? '.atlas-v2-formula-cell[data-item-value]'
        : `.atlas-v2-formula-cell[data-item-value="${cssAttrValue(itemId)}"]`;
      document.querySelectorAll(selector).forEach((output) => {
        const outputItem = findItem(context.board, output.dataset.itemValue)?.item;
        const columnEntry = context.board.columns.find((entry) => entry.id === output.dataset.columnId);
        if (!outputItem || !columnEntry) return;
        output.textContent = formulaColumnValueLive(context.board, outputItem, columnEntry);
      });
    } finally {
      if (changedColumn) {
        if (hadValue) found.item.values[changedColumn.id] = previousValue;
        else delete found.item.values[changedColumn.id];
      }
      if (hasColumnAggregation) boardFormulaAggregateCache(context.board, true);
    }
  }

  function renderCell(columnEntry, itemEntry) {
    const value = itemEntry.values?.[columnEntry.id] ?? '';
    const common = `data-item-value="${attr(itemEntry.id)}" data-column-id="${attr(columnEntry.id)}"`;
    if (columnEntry.type === 'formula') {
      const context = findBoard();
      return `<output class="atlas-v2-formula-cell" ${common} title="${attr(columnEntry.formula || '')}">${escapeHtml(formulaColumnValue(context?.board || { columns: [] }, itemEntry, columnEntry))}</output>`;
    }
    if (columnEntry.type === 'status' || columnEntry.type === 'select') {
      const details = optionDetails(columnEntry, value);
      const style = details.background ? `--status-bg:${attr(details.background)};--status-color:${attr(details.color || '#171c26')}` : '';
      return `<select class="atlas-v2-cell-select ${columnEntry.type === 'status' ? 'atlas-v2-status' : ''}" ${common} style="${style}"><option value=""></option>${(columnEntry.options || []).map((entry) => {
        const label = typeof entry === 'string' ? entry : entry.label;
        return `<option value="${attr(label)}" ${label === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
      }).join('')}</select>`;
    }
    if (columnEntry.type === 'checkbox') {
      return `<input class="atlas-v2-checkbox" type="checkbox" ${common} ${value ? 'checked' : ''} aria-label="${attr(columnEntry.name)}">`;
    }
    if (columnEntry.type === 'date') {
      return `<input class="atlas-v2-cell-input" type="date" ${common} data-date-field="true" min="1000-01-01" max="9999-12-31" value="${attr(value)}">`;
    }
    if (columnEntry.type === 'period') {
      const range = parseTimelinePeriod(value);
      const periodValue = range
        ? `${range.start.toISOString().slice(0, 10)} - ${range.end.toISOString().slice(0, 10)}`
        : (typeof value === 'object' ? JSON.stringify(value) : value);
      return `<input class="atlas-v2-cell-input" type="text" ${common} value="${attr(periodValue)}" placeholder="AAAA-MM-DD - AAAA-MM-DD">`;
    }
    if (columnEntry.type === 'currency') {
      // Campo de texto (nao "number"): o navegador nunca deixaria digitar
      // "R$" ou separadores num input number. O valor guardado no item
      // continua sendo um numero simples (para formulas, ordenacao e
      // filtros funcionarem sem mudanca); so a tela mostra formatado.
      return `<input class="atlas-v2-cell-input" type="text" inputmode="decimal" ${common} value="${attr(formatCurrencyDisplay(value))}" placeholder="R$ 0,00">`;
    }
    if (['number', 'percentage'].includes(columnEntry.type)) {
      return `<input class="atlas-v2-cell-input" type="number" ${common} value="${attr(value)}" step="1">`;
    }
    if (columnEntry.type === 'file') {
      const allFiles = normalizeImageEntries(value);
      // Coluna versionada mostra so a versao vigente de cada documento - as
      // anteriores ficam no historico, dentro do visualizador.
      const files = columnIsVersioned(columnEntry) ? currentAttachmentEntries(allFiles) : allFiles;
      const first = files[0];
      const firstVersion = columnIsVersioned(columnEntry) && Number(first?.version || 1) > 1 ? `<em class="atlas-v2-file-version">v${Number(first.version)}</em>` : '';
      return `<div class="atlas-v2-file-cell">
        ${first ? `<button type="button" data-action="open-attachment-viewer" data-item-id="${attr(itemEntry.id)}" data-column-id="${attr(columnEntry.id)}" data-image-index="0" title="Visualizar arquivos"><i data-lucide="file-check-2"></i><span>${escapeHtml(first.name || 'Arquivo')}</span>${firstVersion}${files.length > 1 ? `<b>+${files.length - 1}</b>` : ''}</button>` : '<span><i data-lucide="paperclip"></i>Sem arquivos</span>'}
        <label title="Adicionar arquivos"><i data-lucide="plus"></i><input type="file" accept=".pdf,.kmz,.kml,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.zip,image/*" multiple ${common} hidden></label>
      </div>`;
    }
    if (columnEntry.type === 'image') {
      const images = normalizeImageEntries(value);
      const previews = images.slice(0, 3).map((entry, index) => {
        const source = imageElementAttributes(entry, 480);
        // data-preview-* alimenta a previa autenticada quando as URLs publicas
        // do Google falharem (arquivo privado do setor). O loading="lazy" ja faz
        // a preguica por viewport: imagem fora da tela nem tenta carregar, entao
        // nao entra na fila e nao gasta cota do conector.
        return `<button type="button" data-action="open-attachment-viewer" data-item-id="${attr(itemEntry.id)}" data-column-id="${attr(columnEntry.id)}" data-image-index="${index}" title="Abrir ${attr(entry.name || `imagem ${index + 1}`)}"><img src="${attr(source.src)}" data-image-fallbacks="${attr(source.fallbacks)}" data-preview-file-id="${attr(entry.fileId || '')}" data-preview-connection-id="${attr(entry.storageConnectionId || '')}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></button>`;
      }).join('');
      const remaining = images.length > 3 ? `<button class="atlas-v2-image-more" type="button" data-action="open-attachment-viewer" data-item-id="${attr(itemEntry.id)}" data-column-id="${attr(columnEntry.id)}" data-image-index="3" title="Ver todas">+${images.length - 3}</button>` : '';
      return `<div class="atlas-v2-image-cell">${previews}${remaining}${runtime.fieldMode && window.innerWidth <= 820 ? `<label title="Fotografar agora"><i data-lucide="camera"></i><input type="file" accept="image/*" capture="environment" ${common} hidden></label>` : ''}<label title="Adicionar imagens da galeria"><i data-lucide="plus"></i><input type="file" accept="image/*" multiple ${common} hidden></label>${images.length ? `<span>${images.length}</span>` : '<small>Imagens</small>'}</div>`;
    }
    if (columnEntry.type === 'location') {
      return `<div class="atlas-v2-location-cell"><input class="atlas-v2-cell-input" type="text" ${common} value="${attr(value)}" placeholder="Local ou coordenadas">${runtime.fieldMode && window.innerWidth <= 820 ? `<button type="button" data-action="capture-location" data-item-id="${attr(itemEntry.id)}" data-column-id="${attr(columnEntry.id)}" title="Usar localização atual"><i data-lucide="locate-fixed"></i></button>` : ''}</div>`;
    }
    if (columnEntry.type === 'link') {
      return `<input class="atlas-v2-cell-input" type="url" ${common} value="${attr(value)}" placeholder="https://">`;
    }
    return `<input class="atlas-v2-cell-input" type="text" ${common} value="${attr(value)}">`;
  }

  function isUsableDriveFileId(value) {
    const text = String(value || '').trim();
    return /^[a-zA-Z0-9_-]{20,}$/.test(text) && !/^[a-f0-9]{32}$/i.test(text);
  }

  function driveFileId(value) {
    const text = String(value || '').trim();
    const pathMatch = text.match(/\/file\/d\/([^/?#]+)/i) || text.match(/\/d\/([^/?#]+)/i);
    if (pathMatch?.[1] && isUsableDriveFileId(pathMatch[1])) return pathMatch[1];
    const queryMatch = text.match(/[?&]id=([^&#]+)/i);
    const candidate = queryMatch?.[1] ? decodeURIComponent(queryMatch[1]) : '';
    return isUsableDriveFileId(candidate) ? candidate : '';
  }

  function imageUrlCandidates(entry, size = 1600) {
    const candidates = [];
    const add = (value) => {
      const url = String(value || '').trim();
      if (!url || candidates.includes(url)) return;
      candidates.push(url);
    };
    const fileId = isUsableDriveFileId(entry?.fileId)
      ? String(entry.fileId)
      : driveFileId(entry?.thumbnailUrl || entry?.url || entry?.viewUrl || '');
    add(entry?.dataUrl);
    if (fileId) {
      add(`https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${Number(size) || 1600}`);
      add(`https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w${Number(size) || 1600}`);
    }
    add(entry?.thumbnailUrl);
    add(entry?.thumbnail_url);
    add(entry?.thumbnail);
    add(entry?.thumb);
    if (fileId) add(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`);
    const directUrl = String(entry?.url || entry?.webContentLink || '').trim();
    if (directUrl && !/\/file\/d\/[^/?#]+\/(?:view|preview)(?:[?#]|$)/i.test(directUrl)) add(directUrl);
    const viewUrl = String(entry?.viewUrl || entry?.webViewLink || '').trim();
    if (/^(?:data:|blob:)/i.test(viewUrl) || /\.(?:png|jpe?g|webp|gif|bmp|svg)(?:[?#]|$)/i.test(viewUrl)) add(viewUrl);
    return candidates;
  }

  function imageElementAttributes(entry, size = 1600) {
    const candidates = imageUrlCandidates(entry, size);
    return {
      src: candidates[0] || '',
      fallbacks: JSON.stringify(candidates.slice(1)),
    };
  }

  // ---------------------------------------------------------------------------
  // Previa segura de imagem
  //
  // As URLs publicas do Google (drive.google.com/thumbnail, lh3.googleusercontent,
  // uc?export=view) NAO servem arquivo privado: respondem HTTP 200 com a pagina
  // HTML de login. O navegador tenta decodificar HTML como imagem, falha, e a
  // miniatura fica quebrada. E o conector nunca compartilha arquivo publicamente,
  // de proposito - entao para arquivo de setor essas URLs nunca vao funcionar.
  //
  // O caminho que funciona e a acao 'preview' do conector, que devolve os bytes
  // em base64 autenticando pelo Apps Script. Isto aqui e a fila que alimenta
  // TANTO a miniatura do quadro quanto o visualizador.
  //
  // Custa caro (imagem inteira em base64, cota de 20 por janela no conector),
  // por isso: so dispara depois que as URLs publicas falharam, cache em memoria
  // e em IndexedDB, concorrencia 2, e recuo longo quando a cota estoura.
  // ---------------------------------------------------------------------------

  async function readImagePreviewCache(key) {
    const database = await openBootstrapCache();
    if (!database || !database.objectStoreNames.contains(IMAGE_PREVIEW_STORE)) { database?.close(); return null; }
    return new Promise((resolve) => {
      const transaction = database.transaction(IMAGE_PREVIEW_STORE, 'readonly');
      const request = transaction.objectStore(IMAGE_PREVIEW_STORE).get(key);
      request.onsuccess = () => resolve(request.result?.dataUrl || null);
      request.onerror = () => resolve(null);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => database.close();
    });
  }

  async function writeImagePreviewCache(key, dataUrl) {
    if (!key || !dataUrl) return;
    const database = await openBootstrapCache();
    if (!database || !database.objectStoreNames.contains(IMAGE_PREVIEW_STORE)) { database?.close(); return; }
    await new Promise((resolve) => {
      const transaction = database.transaction(IMAGE_PREVIEW_STORE, 'readwrite');
      const store = transaction.objectStore(IMAGE_PREVIEW_STORE);
      store.put({ key, dataUrl, savedAt: new Date().toISOString() });
      // Poda as mais antigas assim que passar do teto - o store guarda imagem
      // inteira, entao deixar crescer estoura a cota de disco do navegador.
      const counter = store.count();
      counter.onsuccess = () => {
        const excedente = Number(counter.result || 0) - IMAGE_PREVIEW_CACHE_MAX;
        if (excedente <= 0) return;
        let apagadas = 0;
        store.index('savedAt').openCursor().onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor || apagadas >= excedente) return;
          cursor.delete();
          apagadas += 1;
          cursor.continue();
        };
      };
      transaction.oncomplete = resolve;
      transaction.onerror = resolve;
      transaction.onabort = resolve;
    });
    database.close();
  }

  // Resolve a conexao de um anexo. Anexo antigo pode ter storage_connection_id
  // nulo (em producao a maioria esta assim), e nesse caso o unico palpite
  // possivel e a conexao do contexto do quadro.
  function connectionForAttachmentPreview(connectionId) {
    return storageConnection(connectionId) || storageForContext(findBoard());
  }

  function securePreviewCacheKey(connection, fileId) {
    return `${connection?.id || 'sem-conexao'}:${fileId}`;
  }

  // Busca (ou reaproveita) a previa de um arquivo. Uma promessa por chave, para
  // duas celulas do mesmo arquivo nao gerarem duas chamadas ao conector.
  function securePreviewDataUrl(connection, boardId, fileId) {
    const cacheKey = securePreviewCacheKey(connection, fileId);
    const cached = runtime.secureImagePreviews.get(cacheKey);
    if (cached) return cached;
    const pending = (async () => {
      const doDisco = await readImagePreviewCache(cacheKey);
      if (doDisco) return doDisco;
      const authToken = await currentAuthAccessToken();
      const result = await postJsonWithUploadProgress(connection.appScriptUrl, {
        action: 'preview',
        rootFolderId: connection.folderId,
        connectionId: connection.id,
        boardId: boardId || null,
        authToken,
        fileId,
      });
      if (!result?.success) throw new Error(result?.error || 'A prévia privada não foi disponibilizada.');
      const dataUrl = secureImagePreviewDataUrl(result);
      if (!dataUrl) throw new Error('O conector não retornou uma imagem válida para prévia.');
      void writeImagePreviewCache(cacheKey, dataUrl);
      return dataUrl;
    })();
    runtime.secureImagePreviews.set(cacheKey, pending);
    pending.catch(() => runtime.secureImagePreviews.delete(cacheKey));
    return pending;
  }

  // A mensagem de cota do conector vem como texto; sem esta deteccao a fila
  // continuaria batendo no limite e nenhuma miniatura apareceria.
  function ehErroDeCota(error) {
    return /limite|limit|cota|quota|muitas|too many|rate/i.test(String(error?.message || error || ''));
  }

  function pumpImagePreviewQueue() {
    const fila = runtime.imagePreviewQueue;
    while (fila.length && runtime.imagePreviewActive < IMAGE_PREVIEW_CONCURRENCY) {
      if (Date.now() < runtime.imagePreviewBlockedUntil) return;
      const job = fila.shift();
      if (!job?.image?.isConnected) continue;
      runtime.imagePreviewActive += 1;
      securePreviewDataUrl(job.connection, job.boardId, job.fileId)
        .then((dataUrl) => {
          if (!job.image.isConnected) return;
          job.image.src = dataUrl;
          job.image.dataset.imageFallbacks = '[]';
          job.image.classList.remove('is-broken');
          job.image.closest('.atlas-v2-image-stage, .atlas-v2-image-cell')?.classList.remove('has-broken-image');
        })
        .catch((error) => {
          if (ehErroDeCota(error)) {
            // Cota estourada: parar de pedir por um tempo e descartar a fila.
            // Insistir so gastaria a janela seguinte tambem.
            runtime.imagePreviewBlockedUntil = Date.now() + IMAGE_PREVIEW_COOLDOWN_MS;
            runtime.imagePreviewQueue.length = 0;
          }
          console.warn('Atlas V2: prévia privada indisponível.', error);
        })
        .finally(() => {
          runtime.imagePreviewActive -= 1;
          pumpImagePreviewQueue();
        });
    }
  }

  // Enfileira a previa de uma imagem que ja falhou em todas as URLs publicas.
  function enqueueSecureImagePreview(image) {
    const fileId = String(image?.dataset?.previewFileId || '').trim();
    if (!fileId || image.dataset.previewRequested === '1') return false;
    if (!runtime.authClient || !runtime.remoteMode) return false;
    const connection = connectionForAttachmentPreview(image.dataset.previewConnectionId);
    if (!connection?.appScriptUrl || !connection.folderId || connection.status === 'disabled') return false;
    image.dataset.previewRequested = '1';
    runtime.imagePreviewQueue.push({ image, fileId, connection, boardId: findBoard()?.board?.id || null });
    pumpImagePreviewQueue();
    return true;
  }

  function handleImageLoadError(event) {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-image-fallbacks')) return;
    let fallbacks = [];
    try { fallbacks = JSON.parse(image.dataset.imageFallbacks || '[]'); } catch (_) { fallbacks = []; }
    const next = fallbacks.shift();
    image.dataset.imageFallbacks = JSON.stringify(fallbacks);
    if (next) {
      image.src = next;
      return;
    }
    // Esgotou o publico. Antes de desistir, tenta a previa autenticada pelo
    // conector - e o unico caminho que funciona para arquivo privado do setor.
    if (enqueueSecureImagePreview(image)) return;
    image.classList.add('is-broken');
    image.closest('.atlas-v2-image-stage, .atlas-v2-image-cell')?.classList.add('has-broken-image');
  }

  function secureImagePreviewDataUrl(result) {
    const base64 = String(result?.base64 || '').trim();
    const mimeType = String(result?.mimeType || 'image/jpeg').toLowerCase();
    if (!base64 || !/^image\/[a-z0-9.+-]+$/i.test(mimeType)) return '';
    return `data:${mimeType};base64,${base64}`;
  }

  async function hydrateSecureViewerImage(data) {
    const entry = data?.entry;
    const fileId = String(entry?.fileId || '').trim();
    const connection = storageConnection(entry?.storageConnectionId) || storageForContext(data?.context);
    if (!fileId || entry?.dataUrl || !connection?.appScriptUrl || !connection?.folderId) return;

    try {
      // Mesma fonte usada pela miniatura do quadro: uma promessa por arquivo,
      // cache em memoria e em IndexedDB. Abrir o visualizador depois de ver a
      // miniatura nao gera uma segunda chamada ao conector.
      const dataUrl = await securePreviewDataUrl(connection, data.context?.board?.id, fileId);
      const current = viewerAttachment();
      if (String(current?.entry?.fileId || '') !== fileId) return;
      const image = document.querySelector('.atlas-v2-viewer-image[data-viewer-file-id]');
      if (!image) return;
      image.src = dataUrl;
      image.dataset.imageFallbacks = '[]';
      image.classList.remove('is-broken');
      image.closest('.atlas-v2-image-stage')?.classList.remove('has-broken-image');
    } catch (error) {
      console.warn('Atlas V2: prévia privada indisponível.', error);
    }
  }

  function parseImageValue(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return [value];
    const text = String(value || '').trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (parsed !== text) return parseImageValue(parsed);
    } catch (_) { /* valor legado pode ser apenas um link */ }
    return [text];
  }

  function normalizeImageEntries(value) {
    return parseImageValue(value).map((raw, index) => {
      const entry = typeof raw === 'string' ? { url: raw, viewUrl: raw, name: `Imagem ${index + 1}` } : raw;
      const sourceUrl = entry.url || entry.viewUrl || entry.webViewLink || entry.link || entry.thumbnailUrl || entry.thumbnail_url || '';
      const rawFileId = entry.fileId || entry.file_id || entry.idArquivo || '';
      const fileId = isUsableDriveFileId(rawFileId) ? String(rawFileId) : (driveFileId(sourceUrl) || '');
      const viewUrl = entry.viewUrl || entry.webViewLink || entry.link || (fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view` : sourceUrl);
      const thumbnailUrl = entry.thumbnailUrl || entry.thumbnail_url || entry.thumbnail || entry.thumb || (fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200` : sourceUrl || viewUrl);
      return {
        ...entry,
        name: entry.name || entry.nome || entry.nomeArquivo || entry.filename || `Imagem ${index + 1}`,
        url: entry.url || entry.webContentLink || viewUrl || thumbnailUrl,
        viewUrl,
        thumbnailUrl,
        fileId,
        folderId: entry.folderId || entry.folder_id || entry.pastaId || '',
        mimeType: entry.mimeType || entry.mime_type || entry.tipoMime || '',
      };
    }).filter((entry) => entry && (entry.dataUrl || entry.url || entry.viewUrl || entry.thumbnailUrl || entry.fileId));
  }

  function readFileDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  function uploadLimitMb() {
    return Math.max(1, Math.min(50, Number(window.ATNX_CONFIG?.LIMITE_UPLOAD_MB || 15)));
  }

  function validateAttachmentFile(file) {
    const extension = String(file?.name || '').split('.').pop().toLowerCase();
    const forbiddenExtensions = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'js', 'mjs', 'html', 'htm', 'svg']);
    const forbiddenMimeTypes = new Set(['text/html', 'application/javascript', 'text/javascript', 'image/svg+xml']);
    if (!file?.name || file.size <= 0) throw new Error('O arquivo selecionado está vazio.');
    if (file.size > uploadLimitMb() * 1024 * 1024) throw new Error(`${file.name} ultrapassa o limite de ${uploadLimitMb()} MB.`);
    if (forbiddenExtensions.has(extension) || forbiddenMimeTypes.has(String(file.type || '').toLowerCase())) {
      throw new Error(`${file.name} possui um formato bloqueado por segurança.`);
    }
  }

  async function prepareImageForAtlas(file) {
    validateAttachmentFile(file);
    if (!String(file.type || '').startsWith('image/')) throw new Error(`${file.name} não é uma imagem válida.`);
    const original = await readFileDataUrl(file);
    if (['image/gif', 'image/webp'].includes(String(file.type || '').toLowerCase())) {
      return { name: file.name, mimeType: file.type, size: file.size, dataUrl: original, base64: original.split(',')[1] || '' };
    }
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const maxSide = 1400;
        const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const mimeType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, 0.78);
        resolve({ name: file.name, mimeType, size: file.size, dataUrl, base64: dataUrl.split(',')[1] || '' });
      };
      image.onerror = () => resolve({ name: file.name, mimeType: file.type || 'image/jpeg', size: file.size, dataUrl: original, base64: original.split(',')[1] || '' });
      image.src = original;
    });
  }

  async function prepareFileForAtlas(file, columnType = 'file') {
    validateAttachmentFile(file);
    if (columnType === 'image') return prepareImageForAtlas(file);
    const dataUrl = await readFileDataUrl(file);
    return {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl,
      base64: dataUrl.split(',')[1] || '',
    };
  }

  function remoteItemRowForAttachment(context, found) {
    const collection = found.collection || [];
    return {
      id: found.item.id,
      board_id: context.board.id,
      group_id: found.group?.id || found.item.groupId || null,
      parent_item_id: found.parent?.id || null,
      nome: found.item.name || (found.parent ? 'Novo subitem' : 'Novo item'),
      ordem: Math.max(0, collection.findIndex((entry) => entry.id === found.item.id)),
      arquivado: Boolean(found.item.archived),
    };
  }

  function attachmentItemChain(context, itemId) {
    const chain = [];
    let currentId = String(itemId || '');
    const visited = new Set();
    while (currentId && !visited.has(currentId) && chain.length < 12) {
      visited.add(currentId);
      const currentFound = findItem(context.board, currentId);
      if (!currentFound) break;
      chain.unshift(currentFound);
      currentId = currentFound.parent?.id || '';
    }
    return chain;
  }

  async function ensureRemoteItemBeforeAttachment(context, found) {
    if (!runtime.authClient || !runtime.remoteMode) return;
    const chain = attachmentItemChain(context, found.item.id);
    if (!chain.length) throw new Error('O elemento não está mais disponível neste quadro. Atualize a página e tente novamente.');

    for (const currentFound of chain) {
      const itemId = String(currentFound.item.id || '');
      const baseline = (runtime.remoteRows?.atlas_v2_items || []).find((entry) => String(entry.id) === itemId);
      const lookup = await runtime.authClient
        .from('atlas_v2_items')
        .select('*')
        .eq('id', itemId)
        .maybeSingle();
      if (lookup.error) throw lookup.error;

      if (lookup.data) {
        if (lookup.data.arquivado) throw new Error('Este elemento foi arquivado em outra sessão. Atualize a página antes de enviar arquivos.');
        replaceRemoteBaselineRow('atlas_v2_items', lookup.data);
        continue;
      }

      // Um item que já fazia parte da linha de base e desapareceu foi removido
      // por outra sessão. Não o recriar silenciosamente.
      if (baseline) {
        runtime.remoteRefreshQueued = true;
        throw new Error('Este elemento foi removido em outra sessão. Atualize a página antes de enviar arquivos.');
      }

      // Item recém-criado localmente: persisti-lo antes de iniciar o upload.
      // A cadeia é processada da raiz para o filho para respeitar a FK parent_item_id.
      const row = remoteItemRowForAttachment(context, currentFound);
      const persisted = await runtime.authClient
        .from('atlas_v2_items')
        .upsert(row, { onConflict: 'id' })
        .select('*')
        .single();
      if (persisted.error) throw persisted.error;
      replaceRemoteBaselineRow('atlas_v2_items', persisted.data || row);
    }
  }

  async function persistRemoteItemNow(context, itemId) {
    if (!runtime.authClient || !runtime.remoteMode || !context?.board) return null;
    const found = findItem(context.board, itemId);
    if (!found) throw new Error('O item não está mais disponível no quadro.');
    const wasKnown = Boolean((runtime.remoteRows?.atlas_v2_items || []).some((entry) => String(entry.id) === String(itemId)));
    await ensureRemoteItemBeforeAttachment(context, found);
    const row = remoteItemRowForAttachment(context, found);
    const { data, error } = await runtime.authClient
      .from('atlas_v2_items')
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) throw error;
    replaceRemoteBaselineRow('atlas_v2_items', data || row);

    if (!wasKnown) {
      const valueRows = Object.entries(found.item.values || {}).flatMap(([columnId, value]) => {
        const columnEntry = context.board.columns.find((entry) => entry.id === columnId);
        let storedValue = value;
        if (['image', 'file'].includes(columnEntry?.type)) {
          storedValue = normalizeImageEntries(value).filter((entry) => !(entry?._attachmentSource || entry?.attachmentBacked));
        }
        if (storedValue === undefined || storedValue === null || storedValue === '' || storedValue === false || (Array.isArray(storedValue) && !storedValue.length)) return [];
        return [{ item_id: found.item.id, column_id: columnId, valor: storedValue }];
      });
      if (valueRows.length) {
        const valueResult = await runtime.authClient
          .from('atlas_v2_item_values')
          .upsert(valueRows, { onConflict: 'item_id,column_id' })
          .select('*');
        if (valueResult.error) throw valueResult.error;
        (valueResult.data || valueRows).forEach((valueRow) => replaceRemoteBaselineRow('atlas_v2_item_values', projectRealtimeValueRow(valueRow)));
      }
    }

    scheduleBootstrapCacheWrite(runtime.data);
    return data || row;
  }

  function enqueueRemoteItemPersistence(context, itemId) {
    const key = String(itemId || '');
    if (!key) return Promise.resolve(null);
    const previous = runtime.itemPersistQueues.get(key) || Promise.resolve();
    const next = previous
      .catch(() => null)
      .then(() => persistRemoteItemNow(context, key))
      .finally(() => {
        if (runtime.itemPersistQueues.get(key) === next) runtime.itemPersistQueues.delete(key);
      });
    runtime.itemPersistQueues.set(key, next);
    return next;
  }

  function persistRemoteItemsSoon(context, itemIds = []) {
    if (!runtime.remoteMode || !runtime.authClient) return Promise.resolve([]);
    const ids = [...new Set(itemIds.filter(Boolean))];
    const task = (async () => {
      try {
        const results = [];
        for (let offset = 0; offset < ids.length; offset += 4) {
          const batch = ids.slice(offset, offset + 4);
          results.push(...await Promise.all(batch.map((itemId) => enqueueRemoteItemPersistence(context, itemId))));
        }
        return results;
      } catch (error) {
        console.error('Atlas V2: persistência direta de item falhou.', error);
        runtime.remoteSyncQueued = true;
        scheduleRemoteSync();
        toast(`O Atlas tentará sincronizar novamente: ${error.message || error}`, true);
        throw error;
      }
    })();
    void task.catch(() => null);
    return task;
  }

  function itemLineage(collection, targetId, ancestors = []) {
    for (const entry of collection || []) {
      const lineage = [...ancestors, entry];
      if (String(entry.id) === String(targetId)) return lineage;
      const nested = itemLineage(entry.subitems, targetId, lineage);
      if (nested.length) return nested;
    }
    return [];
  }

  /**
   * Decide, de forma unica, se o anexo pertence a hierarquia de Obras
   * (Cidade > Setor > Registro > Campo). Antes storageFolderPath e
   * uploadAttachmentToStorage usavam critérios diferentes para a mesma
   * pergunta, e podiam discordar: um calculava o caminho como obra e o outro
   * enviava os campos legados como se nao fosse, produzindo pastas diferentes
   * para arquivos do mesmo item.
   */
  function storageSectorization(context, found) {
    const lineage = itemLineage(found.group?.items, found.item.id);
    const sectorColumnId = context.board.settings?.works_sector_column_id;
    const rootId = lineage[0]?.id;
    // A raiz da linhagem precisa ser de fato um item de primeiro nivel do grupo
    // (uma "obra"/cidade). Nao basta o quadro ter uma coluna de setor.
    const rootIsWorkItem = Boolean(rootId && (found.group?.items || []).some((entry) => entry.id === rootId));
    return {
      lineage,
      sectorColumnId,
      isSectorizedWork: Boolean(sectorColumnId && lineage.length && rootIsWorkItem),
    };
  }

  function storageFolderPath(context, found, columnEntry) {
    const { lineage, sectorColumnId, isSectorizedWork } = storageSectorization(context, found);

    if (isSectorizedWork) {
      const city = lineage[0]?.name || found.parent?.name || found.item.name || 'Sem cidade';
      const sector = lineage
        .slice(1)
        .map((entry) => String(entry.values?.[sectorColumnId] || '').trim())
        .find(Boolean);
      const recordNames = lineage.slice(1).map((entry) => entry.name).filter(Boolean);
      return [
        city,
        sector || found.group?.name || 'Sem setor',
        ...recordNames,
        columnEntry.name || 'Arquivos',
      ];
    }

    return [
      context.workspace.name,
      context.module.name,
      context.board.name,
      found.group?.name || 'Sem grupo',
      ...(lineage.length ? lineage.map((entry) => entry.name) : [found.item.name]),
      columnEntry.name || 'Arquivos',
    ];
  }

  function storageOrganizationMoves(connectionId) {
    const seen = new Set();
    const moves = [];
    const boardContexts = allBoards();
    (runtime.remoteRows?.atlas_v2_attachments || []).forEach((row) => {
      const fileId = String(row?.file_id || '').trim();
      if (!fileId || seen.has(fileId)) return;
      let resolved = null;
      for (const context of boardContexts) {
        const found = findItem(context.board, row.item_id);
        if (!found) continue;
        resolved = { context, found };
        break;
      }
      if (!resolved) return;
      const effectiveConnection = storageConnection(row.storage_connection_id)
        || storageForContext(resolved.context);
      if (String(effectiveConnection?.id || '') !== String(connectionId || '')) return;
      const columnEntry = resolved.context.board.columns.find((entry) => String(entry.id) === String(row.column_id));
      if (!columnEntry) return;
      seen.add(fileId);
      moves.push({
        fileId,
        folderPath: storageFolderPath(resolved.context, resolved.found, columnEntry),
        row,
      });
    });
    return moves;
  }

  async function hydrateStorageBoards(connectionId) {
    if (!runtime.authClient || !runtime.remoteMode) return;
    const contexts = allBoards().filter((context) => String(storageForContext(context)?.id || '') === String(connectionId || ''));
    for (const context of contexts) {
      await hydrateBoardRemoteData(context.board.id, { force: true, renderAfter: false });
    }
  }

  async function openOrganizeStorageModal(connectionId) {
    if (!requirePermission('admin', null, 'organizar os arquivos do Drive')) return;
    const connection = storageConnection(connectionId);
    if (!connection) return;
    toast('Mapeando os arquivos vinculados a esta conexão...');
    await hydrateStorageBoards(connectionId);
    const count = storageOrganizationMoves(connectionId).length;
    openModal({
      title: 'Organizar arquivos do Drive',
      subtitle: connection.name,
      body: `<div class="atlas-v2-confirm-card"><i data-lucide="folder-tree"></i><div><strong>${count} ${count === 1 ? 'arquivo será reorganizado' : 'arquivos serão reorganizados'}.</strong><p>Em Obras, a estrutura será Cidade / Setor / Registro / Campo. Os arquivos serão movidos, sem duplicação.</p></div></div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="admin-confirm-organize-storage" data-storage-id="${attr(connectionId)}" ${count ? '' : 'disabled'}><i data-lucide="folder-tree"></i>Organizar agora</button>`,
    });
  }

  function attachmentStorageUpdate(row, folderId) {
    return {
      id: row.id,
      item_id: row.item_id,
      column_id: row.column_id,
      storage_connection_id: row.storage_connection_id || null,
      file_id: row.file_id,
      folder_id: folderId || '',
      nome: row.nome || 'Arquivo',
      mime_type: row.mime_type || '',
      tamanho: Number(row.tamanho || 0),
      view_url: row.view_url || '',
      thumbnail_url: row.thumbnail_url || '',
      ordem: Number(row.ordem || 0),
      criado_por: row.criado_por || null,
    };
  }

  async function organizeStorageConnection(connectionId) {
    if (!requirePermission('admin', null, 'organizar os arquivos do Drive')) return;
    const connection = storageConnection(connectionId);
    if (!connection?.appScriptUrl || !connection?.folderId) return;
    await hydrateStorageBoards(connectionId);
    const moves = storageOrganizationMoves(connectionId);
    if (!moves.length) {
      closeOverlay();
      toast('Nenhum arquivo vinculado precisa ser organizado.');
      return;
    }

    closeOverlay();
    const authToken = await currentAuthAccessToken();
    let movedCount = 0;
    const failures = [];
    for (let offset = 0; offset < moves.length; offset += 50) {
      const batch = moves.slice(offset, offset + 50);
      toast(`Organizando arquivos no Drive: ${Math.min(offset + batch.length, moves.length)} de ${moves.length}...`);
      try {
        const response = await fetch(connection.appScriptUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: 'move',
            rootFolderId: connection.folderId,
            connectionId: connection.id,
            authToken,
            moves: batch.map(({ fileId, folderPath }) => ({ fileId, folderPath })),
          }),
          redirect: 'follow',
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result) throw new Error('O conector não retornou uma resposta válida.');

        const movedById = new Map((result.files || []).map((entry) => [String(entry.fileId), entry.folderId]));
        const updates = batch
          .filter((entry) => movedById.has(String(entry.fileId)))
          .map((entry) => attachmentStorageUpdate(entry.row, movedById.get(String(entry.fileId))));
        if (updates.length && runtime.authClient && runtime.remoteMode) {
          const { data, error } = await runtime.authClient
            .from('atlas_v2_attachments')
            .upsert(updates, { onConflict: 'id' })
            .select('*');
          if (error) throw error;
          (data || updates).forEach((row) => replaceRemoteBaselineRow('atlas_v2_attachments', row));
        }
        movedCount += updates.length;
        failures.push(...(result.failures || []));
      } catch (error) {
        failures.push({ error: error.message || String(error) });
      }
    }

    recordAudit('Arquivos do Drive reorganizados', {
      scope: 'system',
      connectionId,
      movedCount,
      failureCount: failures.length,
    });
    saveData('', { scope: 'system', remote: false, audit: false });
    if (failures.length) {
      toast(`${movedCount} arquivo(s) organizados; ${failures.length} não puderam ser movidos.`, true);
    } else {
      toast(`${movedCount} arquivo(s) organizados por cidade e setor.`);
    }
    render();
  }

  function postJsonWithUploadProgress(url, payload, onProgress) {
    let estimatedProgress = 3;
    if (typeof onProgress === 'function') onProgress(estimatedProgress);
    const progressTimer = setInterval(() => {
      estimatedProgress = Math.min(92, estimatedProgress + Math.max(0.5, (92 - estimatedProgress) * 0.08));
      if (typeof onProgress === 'function') onProgress(estimatedProgress);
    }, 500);
    let endpoint = url;
    try {
      const requestUrl = new URL(url);
      requestUrl.searchParams.set('atlasRequest', `${Date.now()}`);
      endpoint = requestUrl.toString();
    } catch (_) {}
    const operation = new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', endpoint, true);
      request.timeout = 180000;
      request.onerror = () => reject(new Error('Não foi possível acessar o conector do Google Drive.'));
      request.ontimeout = () => reject(new Error('O envio demorou além do limite e foi interrompido.'));
      request.onload = () => {
        let result = null;
        try { result = JSON.parse(request.responseText || ''); } catch (_) {}
        if (request.status < 200 || request.status >= 400 || !result) {
          reject(new Error(result?.error || 'O conector não retornou uma resposta válida.'));
          return;
        }
        if (typeof onProgress === 'function') onProgress(100);
        resolve(result);
      };
      request.send(JSON.stringify(payload));
    });
    return operation.finally(() => {
      clearInterval(progressTimer);
    });
  }

  async function uploadAttachmentToStorage(fileEntry, connection, context, found, columnEntry, onProgress) {
    const authToken = await currentAuthAccessToken();
    const moduleName = storageModule(connection, context);
    const mediaType = legacyMediaType(columnEntry);
    const parentName = found.parent?.name || found.item.name;
    const isSubitem = Boolean(found.parent);
    const folderPath = storageFolderPath(context, found, columnEntry);
    // Mesmo critério usado por storageFolderPath, para que o caminho calculado e
    // os campos legados enviados ao conector nunca discordem.
    const { isSectorizedWork } = storageSectorization(context, found);
    const cityName = isSectorizedWork ? folderPath[0] : '';
    const sectorName = isSectorizedWork ? folderPath[1] : (found.group?.name || context.module.name || 'Itens');
    const payload = {
      action: 'upload',
      rootFolderId: connection.folderId,
      connectionId: connection.id,
      boardId: context.board.id,
      authToken,
      nomeArquivo: fileEntry.name,
      mimeType: fileEntry.mimeType,
      base64: fileEntry.base64,
      // Coluna versionada: pede ao conector a revisao do arquivo recem-criado.
      // Sem esse valor a V1 nasceria sem revisao conhecida e a primeira
      // sondagem registraria uma V2 fantasma logo depois de todo upload.
      versioned: columnIsVersioned(columnEntry),
      workspaceName: context.workspace.name,
      moduleName: context.module.name,
      boardName: context.board.name,
      groupName: found.group?.name || 'Sem grupo',
      itemName: found.item.name,
      columnName: columnEntry.name,
      cityName,
      sectorName,
      folderPath,

      // Compatibilidade com os conectores oficiais da V1.4.
      modulo: moduleName,
      module: moduleName,
      obraNome: cityName || context.board.name || context.workspace.name,
      elementoTipo: sectorName,
      elementoNome: parentName,
      subelementoNome: found.item.name,
      tipoMidia: mediaType,
      grupoNome: found.group?.name || 'Sem grupo',
      expansaoNome: parentName,
      subitemNome: isSubitem ? found.item.name : '',
      pastaMidiaNome: columnEntry.name || '',
    };
    const result = await postJsonWithUploadProgress(connection.appScriptUrl, payload, onProgress);
    if (!result?.success) throw new Error(result?.error || 'Falha ao enviar o arquivo para o Drive.');
    return {
      id: id('attachment'),
      name: result.name || result.nome || fileEntry.name,
      mimeType: result.mimeType || fileEntry.mimeType,
      size: fileEntry.size,
      fileId: result.fileId || '',
      folderId: result.folderId || '',
      url: result.url || result.viewUrl || '',
      viewUrl: result.viewUrl || result.webViewUrl || result.url || '',
      thumbnailUrl: result.thumbnailUrl || result.url || result.viewUrl || '',
      storageConnectionId: connection.id,
      uploadedAt: new Date().toISOString(),
      revision: result.revision || '',
      driveVersion: result.driveVersion || '',
      modifiedTime: result.modifiedTime || '',
      cleanupToken: result.cleanupToken || '',
    };
  }

  async function registerUploadedAttachment(uploaded, connection, context, found, columnEntry, order = 0, documentId = null, versionLabel = null) {
    if (!runtime.authClient || !runtime.remoteMode) return uploaded;
    const row = {
      id: id('attachment'),
      item_id: found.item.id,
      column_id: columnEntry.id,
      storage_connection_id: connection?.id || null,
      file_id: uploaded.fileId || '',
      folder_id: uploaded.folderId || '',
      nome: uploaded.name || 'Arquivo',
      mime_type: uploaded.mimeType || '',
      tamanho: Number(uploaded.size || 0),
      view_url: uploaded.viewUrl || uploaded.url || '',
      thumbnail_url: uploaded.thumbnailUrl || uploaded.viewUrl || uploaded.url || '',
      ordem: Number(order || 0),
      criado_por: runtime.authSession?.user?.id || null,
    };
    // Usado so no fallback de insert direto (banco sem a RPC da V2.4). Pela
    // RPC quem numera a versao e o servidor; aqui nao da para saber o proximo
    // numero com seguranca, entao o fallback so preserva o agrupamento e
    // deixa o default da tabela cuidar de `versao`.
    if (documentId) row.documento_id = documentId;
    if (versionLabel) row.rotulo = versionLabel;
    let data = null;
    let error = null;
    const rpcResult = await runtime.authClient
      .rpc('atlas_v2_register_attachment', {
        p_item_id: row.item_id,
        p_column_id: row.column_id,
        p_storage_connection_id: row.storage_connection_id,
        p_file_id: row.file_id,
        p_folder_id: row.folder_id,
        p_nome: row.nome,
        p_mime_type: row.mime_type,
        p_tamanho: row.tamanho,
        p_view_url: row.view_url,
        p_thumbnail_url: row.thumbnail_url,
        p_ordem: row.ordem,
        // V2.4: nulo = documento novo (versao 1); com valor = nova versao
        // daquele documento, numerada pelo servidor.
        p_documento_id: documentId || null,
        p_rotulo: versionLabel || null,
        // Proveniencia (V2.4): a revisao so vem preenchida em coluna versionada.
        // `revisao_fixada` fica false aqui; a fixacao acontece logo depois, ja
        // com o id do anexo em maos.
        p_origem: 'upload',
        p_origem_revisao: uploaded.revision || null,
        p_drive_version: uploaded.driveVersion ? Number(uploaded.driveVersion) : null,
        p_drive_modified_at: uploaded.modifiedTime || null,
      })
      .single();
    data = rpcResult.data;
    error = rpcResult.error;

    if (error && /function .*atlas_v2_register_attachment/i.test(String(error.message || error))) {
      runtime.realtimeLocalIds.add(row.id);
      const fallback = await runtime.authClient
        .from('atlas_v2_attachments')
        .insert(row)
        .select('*')
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data?.id) {
      runtime.realtimeLocalIds.delete(row.id);
      if (uploaded.fileId && connection?.appScriptUrl) {
        try {
          const authToken = await currentAuthAccessToken();
          const cleanupResponse = await fetch(connection.appScriptUrl, {
            method: 'POST',
            body: JSON.stringify({
              action: 'cleanup',
              rootFolderId: connection.folderId,
              connectionId: connection.id,
              boardId: context.board.id,
              authToken,
              fileId: uploaded.fileId,
              cleanupToken: uploaded.cleanupToken || '',
              modulo: storageModule(connection, context),
              module: storageModule(connection, context),
            }),
            redirect: 'follow',
          });
          const cleanupResult = await cleanupResponse.json().catch(() => null);
          if (!cleanupResponse.ok || !cleanupResult?.success) throw new Error(cleanupResult?.error || 'limpeza nao confirmada');
        } catch (cleanupError) {
          runtime.data.errors = Array.isArray(runtime.data.errors) ? runtime.data.errors : [];
          runtime.data.errors.unshift({ id: id('error'), title: 'Arquivo órfão no Drive', detail: `${uploaded.name || uploaded.fileId}: ${cleanupError.message || cleanupError}`, createdAt: new Date().toISOString() });
          throw new Error(`O arquivo chegou ao Drive, não foi registrado no Atlas e a limpeza automática também falhou. O incidente foi registrado: ${cleanupError.message || cleanupError}`);
        }
      }
      throw new Error(`O arquivo chegou ao Drive, mas o Atlas não conseguiu registrar a referência no Supabase: ${error?.message || error || 'registro não retornado'}`);
    }
    runtime.realtimeLocalIds.add(data.id);
    setTimeout(() => {
      runtime.realtimeLocalIds.delete(row.id);
      runtime.realtimeLocalIds.delete(data.id);
    }, 2000);
    // Coluna versionada: fixa a revisao logo apos registrar. Sem fixar, o Google
    // descarta o conteudo desta versao em 30 dias e o botao de baixar dela
    // passaria a falhar. A falha aqui nao invalida o upload - o arquivo esta no
    // Drive e a versao esta registrada; so o download historico fica indisponivel.
    if (uploaded.revision && connection?.appScriptUrl && connectorSupportsVersions(connection)) {
      const fixacao = await pinDriveRevision(connection, context.board.id, uploaded.fileId, uploaded.revision);
      try {
        await runtime.authClient.rpc('atlas_v2_set_attachment_revision', {
          p_attachment_id: data.id,
          p_revisao_fixada: fixacao.pinned,
          p_revisao_fixacao_pendente: !fixacao.pinned && fixacao.retry,
        });
      } catch (_) {}
      data.revisao_fixada = fixacao.pinned;
      data.revisao_fixacao_pendente = !fixacao.pinned && fixacao.retry;
    }
    return remoteAttachmentEntry(data);
  }

  async function addAttachmentsToCell(target, context, found, columnEntry) {
    const files = [...(target.files || [])];
    if (!files.length) return;
    const current = normalizeImageEntries(found.item.values[columnEntry.id]);
    // O teto vale para DOCUMENTOS distintos, nao para versoes: um campo
    // versionado com 12 planilhas revisadas varias vezes continua valido,
    // senao o historico consumiria o limite e travaria o envio.
    const currentCount = columnIsVersioned(columnEntry) ? attachmentDocuments(current).length : current.length;
    if (currentCount + files.length > 12) {
      toast(columnIsVersioned(columnEntry) ? 'Cada campo aceita até 12 documentos (as versões de cada um não contam).' : 'Cada campo aceita até 12 arquivos.', true);
      target.value = '';
      return;
    }
    const connection = storageForContext(context);
    const connected = Boolean(connection?.appScriptUrl && connection.folderId && connection.status !== 'disabled');
    const imageColumn = columnEntry.type === 'image';
    if (!connected && (runtime.remoteMode || !imageColumn)) {
      toast('Conecte e valide o Google Drive deste setor antes de anexar arquivos.', true);
      target.value = '';
      return;
    }
    toast(connected ? 'Confirmando o elemento no Supabase...' : 'Preparando imagens no modo local...');
    setOperationProgress(imageColumn ? 'Enviando imagens' : 'Enviando arquivos', 2, `${files.length} arquivo(s)`);
    const added = [];
    target.disabled = true;
    try {
      if (connected) {
        await ensureRemoteItemBeforeAttachment(context, found);
        setOperationProgress(imageColumn ? 'Enviando imagens' : 'Enviando arquivos', 7, 'Registro confirmado no servidor');
        toast('Enviando arquivos para o Drive e registrando no Supabase...');
      }
      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        const file = files[fileIndex];
        const fileBase = 8 + (fileIndex / files.length) * 88;
        const fileShare = 88 / files.length;
        setOperationProgress(`Preparando ${file.name}`, fileBase + (fileShare * 0.08), `${fileIndex + 1} de ${files.length}`);
        const prepared = await prepareFileForAtlas(file, columnEntry.type);
        if (connected) {
          const uploaded = await uploadAttachmentToStorage(prepared, connection, context, found, columnEntry, (uploadPercent) => {
            setOperationProgress(`Enviando ${file.name}`, fileBase + (fileShare * (0.12 + (uploadPercent / 100) * 0.7)), `${fileIndex + 1} de ${files.length}`);
          });
          setOperationProgress(`Registrando ${file.name}`, fileBase + (fileShare * 0.88), `${fileIndex + 1} de ${files.length}`);
          const registered = await registerUploadedAttachment(uploaded, connection, context, found, columnEntry, current.length + added.length);
          added.push(registered);
        } else {
          added.push({ id: id('image'), name: prepared.name, mimeType: prepared.mimeType, size: prepared.size, dataUrl: prepared.dataUrl, localOnly: true, uploadedAt: new Date().toISOString() });
        }
        // Gravar na celula a cada arquivo concluido, e nao so no final: assim uma
        // falha no meio do lote nao apaga da tela o que ja foi enviado de fato.
        found.item.values[columnEntry.id] = [...current, ...added];
        setOperationProgress(`${file.name} concluído`, fileBase + fileShare, `${fileIndex + 1} de ${files.length}`);
      }
      if (connected) {
        saveData(`${imageColumn ? 'Imagens' : 'Arquivos'} enviados e sincronizados`, { remote: false, itemId: found.item.id });
      } else {
        saveData('Imagens mantidas no armazenamento local');
        toast('Configure uma conexão validada para enviar os originais ao Google Drive.');
      }
      if (!patchRealtimeImageCell({ ...context, found }, columnEntry.id)) render();
      setOperationProgress(`${imageColumn ? 'Imagens' : 'Arquivos'} enviados`, 100, `${added.length} arquivo(s) concluído(s)`);
    } catch (error) {
      // Falhar no meio do lote nao pode descartar o que ja subiu: os arquivos
      // anteriores estao no Drive e ja foram gravados em atlas_v2_attachments.
      // Eles sao mantidos na celula e o erro informa quantos falharam.
      const pendingCount = files.length - added.length;
      runtime.data.errors.unshift({
        id: id('error'),
        title: 'Falha no envio de arquivo',
        detail: added.length
          ? `${added.length} de ${files.length} arquivo(s) foram enviados e mantidos. Falha a partir do arquivo ${added.length + 1}: ${error.message || String(error)}`
          : (error.message || String(error)),
        createdAt: new Date().toISOString(),
      });
      if (added.length) {
        if (connected) saveData('Envio parcial de arquivos', { remote: false, itemId: found.item.id });
        else saveData('Envio parcial de arquivos');
        if (!patchRealtimeImageCell({ ...context, found }, columnEntry.id)) render();
        toast(`${added.length} arquivo(s) foram enviados. ${pendingCount} falharam: ${error.message || error}`, true);
      } else {
        toast(error.message || 'Não foi possível enviar os arquivos.', true);
      }
      setOperationProgress('Falha no envio', 100, error.message || String(error));
    } finally {
      target.disabled = false;
      target.value = '';
      clearOperationProgress(connected ? 900 : 500);
    }
  }

  async function addImagesToCell(target, context, found, columnEntry) {
    return addAttachmentsToCell(target, context, found, columnEntry);
  }

  function viewerAttachment() {
    const state = runtime.imageViewer;
    const context = findBoard();
    const found = state && context ? findItem(context.board, state.itemId) : null;
    const allEntries = found ? normalizeImageEntries(found.item.values[state.columnId]) : [];
    if (!allEntries.length) return null;
    const column = context?.board?.columns?.find((entry) => entry.id === state.columnId);
    const versioned = columnIsVersioned(column);
    // Em coluna versionada as setas navegam entre DOCUMENTOS (uma versao
    // vigente de cada); as versoes anteriores aparecem no painel de historico.
    // `allEntries` continua sendo a lista crua da celula, que e o que as
    // operacoes de escrita (remover, acrescentar) precisam manipular.
    const documents = versioned ? attachmentDocuments(allEntries) : [];
    const attachments = versioned ? documents.map((document) => document.current).filter(Boolean) : allEntries;
    if (!attachments.length) return null;
    state.index = Math.min(Math.max(0, state.index), attachments.length - 1);
    const currentEntry = attachments[state.index];
    const document = versioned ? (documents[state.index] || null) : null;
    // O painel de historico permite abrir uma versao ANTERIOR sem sair do
    // documento: versionEntryIndex aponta para a entrada crua escolhida. Se
    // apontar para fora deste documento (troca de documento, remocao), e
    // ignorado e volta para a versao vigente.
    const chosen = versioned && Number.isInteger(state.versionEntryIndex)
      ? (document?.versions || []).find((version) => version._index === state.versionEntryIndex)
      : null;
    const entry = chosen || currentEntry;
    return {
      context, found, column, attachments, images: attachments, entry,
      allEntries, versioned, documents, document,
      versions: document ? document.versions : [],
      viewingOldVersion: Boolean(chosen && chosen._index !== currentEntry._index),
    };
  }

  function attachmentPreviewMarkup(entry, column) {
    const mimeType = String(entry?.mimeType || '').toLowerCase();
    const imageLike = column?.type === 'image' || mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(entry?.name || '');
    if (imageLike) {
      const source = imageElementAttributes(entry, 2200);
      return `<img class="atlas-v2-viewer-image" src="${attr(source.src)}" data-viewer-file-id="${attr(entry.fileId || '')}" data-image-fallbacks="${attr(source.fallbacks)}" alt="${attr(entry.name || 'Imagem anexada')}" decoding="async" referrerpolicy="no-referrer">`;
    }
    const previewUrl = entry?.dataUrl
      || (entry?.fileId ? `https://drive.google.com/file/d/${encodeURIComponent(entry.fileId)}/preview` : entry?.viewUrl || entry?.url || '');
    if (previewUrl && (mimeType === 'application/pdf' || entry?.fileId)) {
      return `<iframe src="${attr(previewUrl)}" title="${attr(entry.name || 'Visualização do arquivo')}" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
    }
    return `<div class="atlas-v2-file-preview"><i data-lucide="file"></i><strong>${escapeHtml(entry?.name || 'Arquivo anexado')}</strong><span>${escapeHtml(mimeType || 'Formato sem visualização interna')}</span><small>${entry?.size ? `${Math.max(1, Math.round(Number(entry.size) / 1024))} KB` : 'Use Abrir original para consultar o conteúdo.'}</small></div>`;
  }

  function openAttachmentViewer(itemId, columnId, index = 0) {
    const nextIndex = Number(index) || 0;
    const sameAttachment = runtime.imageViewer
      && runtime.imageViewer.itemId === itemId
      && runtime.imageViewer.columnId === columnId
      && runtime.imageViewer.index === nextIndex;
    runtime.imageViewer = {
      itemId,
      columnId,
      index: nextIndex,
      zoom: sameAttachment ? runtime.imageViewer.zoom : 1,
      rotation: sameAttachment ? runtime.imageViewer.rotation : 0,
      x: sameAttachment ? runtime.imageViewer.x : 0,
      y: sameAttachment ? runtime.imageViewer.y : 0,
      // Trocar de documento sempre volta para a versao vigente; reabrir o
      // MESMO anexo (ex.: apos enviar uma versao) preserva o que estava aberto.
      versionEntryIndex: sameAttachment ? runtime.imageViewer.versionEntryIndex : null,
    };
    const data = viewerAttachment();
    if (!data) return;
    const { entry, attachments, column } = data;
    const mimeType = String(entry?.mimeType || '').toLowerCase();
    const imageLike = column?.type === 'image' || mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(entry?.name || '');
    const imageControls = imageLike ? `<div class="atlas-v2-viewer-tools" aria-label="Controles da imagem">
      <button type="button" data-action="viewer-zoom-out" title="Diminuir zoom"><i data-lucide="zoom-out"></i></button>
      <button class="atlas-v2-viewer-zoom-value" type="button" data-action="viewer-reset" title="Ajustar à tela">${Math.round(runtime.imageViewer.zoom * 100)}%</button>
      <button type="button" data-action="viewer-zoom-in" title="Aumentar zoom"><i data-lucide="zoom-in"></i></button>
      <button type="button" data-action="viewer-rotate" title="Girar imagem"><i data-lucide="rotate-cw"></i></button>
      <button type="button" data-action="viewer-fullscreen" title="Tela cheia"><i data-lucide="maximize-2"></i></button>
    </div>` : '';
    const root = document.getElementById('atlas-v2-overlay-root');
    const historyPanel = attachmentHistoryMarkup(data);
    root.innerHTML = `<div class="atlas-v2-overlay atlas-v2-image-overlay" data-action="overlay-backdrop"><section class="atlas-v2-image-viewer ${historyPanel ? 'has-history' : ''}" role="dialog" aria-modal="true" aria-label="Visualizador de anexos"><header><span><strong>${escapeHtml(entry.name || 'Arquivo')}</strong><small>${runtime.imageViewer.index + 1} de ${attachments.length}</small></span>${imageControls}<button type="button" data-action="close-overlay" title="Fechar"><i data-lucide="x"></i></button></header><div class="atlas-v2-image-stage atlas-v2-attachment-stage ${imageLike ? 'is-image' : ''}"><button type="button" data-action="viewer-previous" title="Arquivo anterior" ${attachments.length < 2 ? 'disabled' : ''}><i data-lucide="chevron-left"></i></button><div class="atlas-v2-viewer-media">${attachmentPreviewMarkup(entry, column)}</div><button type="button" data-action="viewer-next" title="Próximo arquivo" ${attachments.length < 2 ? 'disabled' : ''}><i data-lucide="chevron-right"></i></button></div><footer><span>${entry.localOnly ? 'Prévia local · será enviada quando houver um Drive validado' : 'Armazenado no Google Drive do setor'}</span>${entry.viewUrl ? `<a class="atlas-v2-button atlas-v2-button-quiet" href="${attr(entry.viewUrl)}" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i>Abrir original</a>` : ''}${hasPermission('edit', data.context) ? '<button class="atlas-v2-button atlas-v2-button-danger" type="button" data-action="viewer-remove"><i data-lucide="trash-2"></i>Remover</button>' : ''}</footer></section>${historyPanel}</div>`;
    applyImageViewerTransform();
    refreshIcons(root);
    if (imageLike) void hydrateSecureViewerImage(data);
  }

  // Link de download direto do Drive. O viewUrl abre a pagina de preview do
  // Drive; para BAIXAR e preciso o endpoint uc?export=download.
  function attachmentDownloadUrl(entry) {
    if (entry?.dataUrl) return entry.dataUrl;
    const fileId = String(entry?.fileId || '').trim();
    if (fileId) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
    return entry?.url || entry?.viewUrl || '';
  }

  // Painel lateral de historico do documento aberto. So aparece em coluna
  // marcada como versionada (ver columnIsVersioned) - nas demais o
  // visualizador continua exatamente como era.
  function attachmentHistoryMarkup(data) {
    if (!data?.versioned || !data.document) return '';
    const podeEditar = hasPermission('edit', data.context);
    const versions = data.versions || [];
    const vigente = data.document.current;
    const cards = versions.map((version) => {
      const numero = Number(version.version || 1);
      const rotulo = version.versionLabel ? `<small>${escapeHtml(version.versionLabel)}</small>` : '';
      const quando = version.createdAt ? `<time>${escapeHtml(formatDateTime(version.createdAt))}</time>` : '';
      // Versao vinda de edicao feita no Drive: quem editou nao e quem por acaso
      // abriu o quadro, entao o autor mostrado tem de ser o do Drive.
      const doDrive = version.origin === 'drive_sync';
      const autoria = doDrive
        ? `<em class="atlas-v2-version-origin"><i data-lucide="cloud-download"></i>Detectada no Drive${version.originAuthor ? ` · ${escapeHtml(version.originAuthor)}` : ''}</em>`
        : '';
      const pendente = doDrive && !version.reviewedAt
        ? `<em class="atlas-v2-version-flag" title="Alteração feita fora do Atlas, ainda não conferida por ninguém">não conferida</em>`
        : '';
      // A versao VIGENTE e o proprio arquivo do Drive, entao o link direto
      // serve. As anteriores so existem como revisao: o conteudo tem de vir
      // pelo conector, e so se a revisao tiver sido fixada.
      const ehVigente = vigente && version._index === vigente._index;
      const linkDireto = ehVigente ? attachmentDownloadUrl(version) : '';
      const baixarAntiga = !ehVigente && version.originRevision;
      return `<article class="atlas-v2-version-card ${version._index === data.entry._index ? 'is-current' : ''} ${pendente ? 'is-unreviewed' : ''}">
        <button class="atlas-v2-version-open" type="button" data-action="viewer-open-version" data-version-index="${attr(version._index)}" title="Ver esta versão">
          <strong>V${numero}</strong>${rotulo}${quando}${autoria}${pendente}
        </button>
        <span class="atlas-v2-version-actions">
          ${linkDireto ? `<a class="atlas-v2-icon-button" href="${attr(linkDireto)}" target="_blank" rel="noopener noreferrer" title="Baixar V${numero}" download><i data-lucide="download"></i></a>` : ''}
          ${baixarAntiga && podeEditar ? (version.pinnedRevision
            ? `<button class="atlas-v2-icon-button" type="button" data-action="viewer-download-version" data-version-index="${attr(version._index)}" title="Baixar V${numero}"><i data-lucide="download"></i></button>`
            : version.pinPending
              ? `<span class="atlas-v2-icon-button is-muted" title="Proteção desta revisão pendente; o Atlas tentará novamente"><i data-lucide="clock-3"></i></span>`
              : `<span class="atlas-v2-icon-button is-muted" title="O Google não permite recuperar o conteúdo desta versão; restam o registro e o rótulo"><i data-lucide="download-cloud"></i></span>`) : ''}
          ${podeEditar && doDrive && !version.reviewedAt && version.attachmentId ? `<button class="atlas-v2-icon-button" type="button" data-action="viewer-review-version" data-attachment-id="${attr(version.attachmentId)}" title="Marcar como conferida"><i data-lucide="check"></i></button>` : ''}
          ${podeEditar && version.attachmentId ? `<button class="atlas-v2-icon-button" type="button" data-action="viewer-label-version" data-version-index="${attr(version._index)}" title="${version.versionLabel ? 'Editar a descrição desta versão' : 'Dar um nome a esta versão'}"><i data-lucide="pencil"></i></button>` : ''}
          ${podeEditar && versions.length > 1 ? `<button class="atlas-v2-icon-button is-danger" type="button" data-action="viewer-remove-version" data-version-index="${attr(version._index)}" title="Remover V${numero} do histórico"><i data-lucide="trash-2"></i></button>` : ''}
        </span>
      </article>`;
    }).join('');
    const arquivoVivo = String(vigente?.fileId || '').trim();
    return `<aside class="atlas-v2-version-history" aria-label="Histórico de versões">
      <header><strong>Histórico</strong><small>${versions.length} versão(ões)</small>
        <button class="atlas-v2-icon-button" type="button" data-action="viewer-check-drive" title="Procurar alterações feitas no Drive agora"><i data-lucide="refresh-cw"></i></button>
      </header>
      ${arquivoVivo ? `<a class="atlas-v2-version-edit" href="https://drive.google.com/file/d/${attr(arquivoVivo)}/view" target="_blank" rel="noopener noreferrer" title="Abrir o arquivo no Drive para editar"><i data-lucide="external-link"></i>Editar no Drive</a>` : ''}
      <div class="atlas-v2-version-list">${cards}</div>
      ${podeEditar ? `<label class="atlas-v2-button atlas-v2-button-primary atlas-v2-version-add" title="Enviar uma versão nova deste documento">
        <i data-lucide="plus"></i>Adicionar versão
        <input type="file" accept=".pdf,.kmz,.kml,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.zip,image/*" data-action="viewer-add-version" hidden>
      </label>` : ''}
    </aside>`;
  }

  function openImageViewer(itemId, columnId, index = 0) {
    openAttachmentViewer(itemId, columnId, index);
  }

  function moveImageViewer(direction) {
    const data = viewerAttachment();
    if (!data || data.attachments.length < 2) return;
    runtime.imageViewer.index = (runtime.imageViewer.index + direction + data.attachments.length) % data.attachments.length;
    runtime.imageViewer.zoom = 1;
    runtime.imageViewer.rotation = 0;
    runtime.imageViewer.x = 0;
    runtime.imageViewer.y = 0;
    openAttachmentViewer(runtime.imageViewer.itemId, runtime.imageViewer.columnId, runtime.imageViewer.index);
  }

  function applyImageViewerTransform() {
    const image = document.querySelector('.atlas-v2-viewer-image');
    const state = runtime.imageViewer;
    if (!image || !state) return;
    image.style.transform = `translate3d(${Number(state.x || 0)}px, ${Number(state.y || 0)}px, 0) scale(${Number(state.zoom || 1)}) rotate(${Number(state.rotation || 0)}deg)`;
    const output = document.querySelector('.atlas-v2-viewer-zoom-value');
    if (output) output.textContent = `${Math.round(Number(state.zoom || 1) * 100)}%`;
    image.closest('.atlas-v2-viewer-media')?.classList.toggle('is-zoomed', Number(state.zoom || 1) > 1.01);
  }

  function setImageViewerZoom(nextZoom) {
    if (!runtime.imageViewer) return;
    runtime.imageViewer.zoom = Math.min(5, Math.max(0.5, Number(nextZoom || 1)));
    if (runtime.imageViewer.zoom <= 1) {
      runtime.imageViewer.x = 0;
      runtime.imageViewer.y = 0;
    }
    applyImageViewerTransform();
  }

  function resetImageViewer() {
    if (!runtime.imageViewer) return;
    Object.assign(runtime.imageViewer, { zoom: 1, rotation: 0, x: 0, y: 0 });
    applyImageViewerTransform();
  }

  function rotateImageViewer() {
    if (!runtime.imageViewer) return;
    runtime.imageViewer.rotation = (Number(runtime.imageViewer.rotation || 0) + 90) % 360;
    applyImageViewerTransform();
  }

  function toggleImageViewerFullscreen() {
    const viewer = document.querySelector('.atlas-v2-image-viewer');
    if (!viewer) return;
    if (document.fullscreenElement === viewer) document.exitFullscreen?.();
    else viewer.requestFullscreen?.();
  }

  // O numero da versao e sempre do servidor; o rotulo e o texto livre que a
  // pessoa usa para se localizar ("revisao do cliente", "v1.2 aprovada").
  function openVersionLabelModal(entryIndex) {
    const data = viewerAttachment();
    if (!data?.versioned) return;
    const index = Number(entryIndex);
    const version = data.allEntries[index];
    if (!version?.attachmentId) return;
    if (!requirePermission('edit', data.context, 'renomear esta versão')) return;
    openModal({
      title: `Descrição da V${Number(version.version || 1)}`,
      subtitle: version.name || 'Arquivo',
      body: `<form id="atlas-v2-version-label-form"><input type="hidden" name="entryIndex" value="${attr(index)}"><label class="atlas-v2-field"><span>Descrição da versão</span><input name="rotulo" value="${attr(version.versionLabel || '')}" maxlength="120" placeholder="Ex.: revisão do cliente" autofocus><small>Aparece no histórico ao lado do número da versão. Deixe em branco para remover.</small></label></form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-version-label-form"><i data-lucide="check"></i>Salvar</button>`,
    });
  }

  async function submitVersionLabel(form) {
    const formData = new FormData(form);
    const index = Number(formData.get('entryIndex'));
    const rotulo = String(formData.get('rotulo') || '').trim();
    const data = viewerAttachment();
    const version = data?.allEntries?.[index];
    // closeOverlay zera runtime.imageViewer, entao o alvo do visualizador
    // precisa ser guardado ANTES de fechar o modal - senao a reabertura
    // acontece sem referencia e o painel simplesmente nao volta.
    const alvo = { ...runtime.imageViewer };
    if (!version?.attachmentId) { closeOverlay(); return; }
    if (runtime.authClient && runtime.remoteMode) {
      runtime.realtimeLocalIds.add(version.attachmentId);
      const { error } = await runtime.authClient
        .from('atlas_v2_attachments')
        .update({ rotulo: rotulo || null })
        .eq('id', version.attachmentId);
      setTimeout(() => runtime.realtimeLocalIds.delete(version.attachmentId), 2000);
      if (error) {
        toast(`Não foi possível salvar a descrição: ${error.message || error}`, true);
        return;
      }
    }
    const atualizados = data.allEntries.map((entry, position) => (
      position === index ? { ...entry, versionLabel: rotulo } : entry
    ));
    data.found.item.values[alvo.columnId] = atualizados;
    saveData('Descrição da versão atualizada', { remote: false, itemId: data.found.item.id });
    closeOverlay();
    openAttachmentViewer(alvo.itemId, alvo.columnId, alvo.index);
    if (Number.isInteger(alvo.versionEntryIndex)) openAttachmentVersion(alvo.versionEntryIndex);
  }

  function openAttachmentVersion(entryIndex) {
    const index = Number(entryIndex);
    if (!Number.isInteger(index)) return;
    runtime.imageViewer.versionEntryIndex = index;
    runtime.imageViewer.zoom = 1;
    runtime.imageViewer.rotation = 0;
    runtime.imageViewer.x = 0;
    runtime.imageViewer.y = 0;
    // Reabrir com o MESMO item/coluna/indice conta como sameAttachment, entao
    // o versionEntryIndex acima e preservado e a versao escolhida aparece.
    openAttachmentViewer(runtime.imageViewer.itemId, runtime.imageViewer.columnId, runtime.imageViewer.index);
  }

  // Remove UMA versao do historico. Diferente de removeViewerImage, aqui o
  // arquivo NAO e mandado para a lixeira do Drive: ele continua na pasta do
  // setor, so deixa de aparecer no Atlas (decisao de produto da V2.4). A
  // versao vigente so pode ser removida se houver outra para assumir o lugar.
  async function removeAttachmentVersion(entryIndex) {
    const data = viewerAttachment();
    if (!data || !data.versioned) return;
    if (!requirePermission('delete', data.context, 'remover esta versão')) return;
    const index = Number(entryIndex);
    const removed = data.allEntries[index];
    if (!removed) return;
    if ((data.versions || []).length < 2) {
      toast('Esta é a única versão do documento. Use Remover para excluir o arquivo inteiro.', true);
      return;
    }
    if (removed.attachmentId && runtime.authClient && runtime.remoteMode) {
      runtime.realtimeLocalIds.add(removed.attachmentId);
      const { data: deletedRows, error } = await runtime.authClient.from('atlas_v2_attachments').delete().eq('id', removed.attachmentId).select('id');
      if (error || deletedRows?.length !== 1) {
        runtime.realtimeLocalIds.delete(removed.attachmentId);
        toast(`Não foi possível remover a versão: ${error?.message || 'o servidor não confirmou a exclusão'}`, true);
        return;
      }
      setTimeout(() => runtime.realtimeLocalIds.delete(removed.attachmentId), 2000);
    }
    const restante = data.allEntries.filter((_, position) => position !== index);
    data.found.item.values[runtime.imageViewer.columnId] = restante;
    runtime.imageViewer.versionEntryIndex = null;
    saveData('Versão removida do histórico', { remote: removed.attachmentId ? false : true, itemId: data.found.item.id });
    toast(`V${Number(removed.version || 1)} saiu do histórico. O arquivo continua no Google Drive do setor.`);
    if (!restante.length) {
      closeOverlay();
      render();
      return;
    }
    openAttachmentViewer(runtime.imageViewer.itemId, runtime.imageViewer.columnId, runtime.imageViewer.index);
  }

  // Envia um arquivo como NOVA VERSAO do documento aberto: mesmo caminho de
  // upload de sempre, mas passando o documento_id para o servidor numerar a
  // versao (ver atlas_v2_register_attachment na V2.4.0).
  // ---------------------------------------------------------------------------
  // V2.4 - versao automatica: a planilha e editada DENTRO do Drive, no mesmo
  // arquivo, e o Atlas registra V2, V3... sozinho.
  //
  // Nao existe copia por versao: o arquivo do Drive e sempre o mesmo e cada
  // versao aponta para uma REVISAO dele. Ver
  // supabase/ATLAS_V2_4_0_VERSAO_AUTOMATICA_DRIVE.sql para o modelo completo.
  // ---------------------------------------------------------------------------
  const DRIVE_PROBE_INTERVAL_MS = 180000;  // sondagem periodica com o quadro aberto
  const DRIVE_PROBE_BACKOFF_MS = 300000;   // espera depois de o conector falhar
  // Arquivo salvo agora ha pouco provavelmente ainda esta sendo editado. Esperar
  // um pouco evita transformar cada Ctrl+S de uma mesma sessao de trabalho numa
  // versao separada.
  const DRIVE_PROBE_MIN_AGE_MS = 60000;

  // O conector antigo nao conhece as acoes de versao e responderia "Acao nao
  // suportada" a cada abertura de quadro. Setor ainda nao reimplantado
  // simplesmente nao e sondado - em silencio, sem erro na cara de ninguem.
  function connectorSupportsVersions(connection) {
    const parts = String(connection?.connectorVersion || '').match(/^(\d+)\.(\d+)/);
    if (!parts) return false;
    const maior = Number(parts[1]);
    const menor = Number(parts[2]);
    return maior > 2 || (maior === 2 && menor >= 5);
  }

  async function callDriveConnector(connection, boardId, payload) {
    const authToken = await currentAuthAccessToken();
    const result = await postJsonWithUploadProgress(connection.appScriptUrl, {
      rootFolderId: connection.folderId,
      connectionId: connection.id,
      boardId: boardId || null,
      authToken,
      ...payload,
    });
    if (!result?.success) throw new Error(result?.error || 'O conector do Drive não confirmou a operação.');
    return result;
  }

  // Quem sondar: a versao vigente de cada documento de coluna versionada. Vem
  // da RPC (e nao da memoria) porque so o servidor sabe com certeza quais
  // colunas estao marcadas como versionadas.
  async function driveVersionTargets(boardEntry) {
    if (!runtime.authClient || !runtime.remoteMode || !boardEntry) return [];
    const itemIds = flatBoardItems(boardEntry).map(({ item }) => item.id).filter((entry) => isUuid(entry));
    if (!itemIds.length) return [];
    const { data, error } = await runtime.authClient.rpc('atlas_v2_versioned_documents', { p_item_ids: itemIds });
    if (error) throw new Error(error.message || error);
    return data || [];
  }

  function driveProbeState() {
    runtime.driveProbe = runtime.driveProbe || { at: new Map(), busy: false, failedAt: new Map(), missing: new Set() };
    return runtime.driveProbe;
  }

  async function pinDriveRevision(connection, boardId, fileId, revisionId) {
    try {
      const result = await callDriveConnector(connection, boardId, { action: 'drivepin', fileId, revisionId });
      return { pinned: Boolean(result.pinned), reason: result.reason || '', retry: Boolean(result.retry) };
    } catch (error) {
      return { pinned: false, reason: String(error?.message || error), retry: true };
    }
  }

  // Uma edicao detectada vira uma versao. A ordem importa: fixa a revisao no
  // Drive ANTES de registrar, porque e o resultado da fixacao que decide se
  // aquela versao vai poder ser baixada depois - o Google so entrega o conteudo
  // de revisao fixada.
  async function registerDriveVersion(connection, context, target, hit) {
    const pin = await pinDriveRevision(connection, context.board.id, target.file_id, hit.revision);
    const { data, error } = await runtime.authClient
      .rpc('atlas_v2_register_attachment', {
        p_item_id: target.item_id,
        p_column_id: target.column_id,
        p_storage_connection_id: connection.id,
        p_file_id: target.file_id,
        p_folder_id: '',
        p_nome: target.nome || hit.name || 'Arquivo',
        p_mime_type: hit.mimeType || '',
        p_tamanho: Number(hit.size || 0),
        p_view_url: `https://drive.google.com/file/d/${encodeURIComponent(target.file_id)}/view`,
        p_thumbnail_url: `https://drive.google.com/thumbnail?id=${encodeURIComponent(target.file_id)}&sz=w1600`,
        p_ordem: 0,
        p_documento_id: target.documento_id,
        p_rotulo: null,
        p_origem: 'drive_sync',
        p_origem_revisao: hit.revision,
        p_origem_autor: hit.author || '',
        p_drive_version: hit.driveVersion ? Number(hit.driveVersion) : null,
        p_drive_modified_at: hit.modifiedTime || null,
        p_revisao_fixada: pin.pinned,
        p_revisao_fixacao_pendente: !pin.pinned && pin.retry,
      })
      .single();
    if (error) throw new Error(error.message || error);
    return { row: data, pin };
  }

  // Anexo que existe desde antes desta funcionalidade nao tem revisao gravada.
  // A primeira sondagem so anota a revisao atual (e tenta fixa-la), sem criar
  // versao: o que ja estava la nao e "alteracao nova".
  async function recordDriveBaseline(connection, context, target, hit) {
    const pin = await pinDriveRevision(connection, context.board.id, target.file_id, hit.revision);
    await runtime.authClient.rpc('atlas_v2_set_attachment_revision', {
      p_attachment_id: target.attachment_id,
      p_origem_revisao: hit.revision,
      p_drive_version: hit.driveVersion ? Number(hit.driveVersion) : null,
      p_drive_modified_at: hit.modifiedTime || null,
      p_revisao_fixada: pin.pinned,
      p_revisao_fixacao_pendente: !pin.pinned && pin.retry,
    });
  }

  // Falha temporaria de rede/cota nao pode condenar a versao historica. O
  // servidor marca a fixacao como pendente e esta rotina tenta novamente nas
  // proximas sondagens ate obter uma resposta definitiva do Google.
  async function retryPendingDrivePin(connection, context, target) {
    if (!target.revisao_fixacao_pendente || !target.origem_revisao) return null;
    const pin = await pinDriveRevision(connection, context.board.id, target.file_id, target.origem_revisao);
    const { error } = await runtime.authClient.rpc('atlas_v2_set_attachment_revision', {
      p_attachment_id: target.attachment_id,
      p_revisao_fixada: pin.pinned,
      p_revisao_fixacao_pendente: !pin.pinned && pin.retry,
    });
    if (error) throw new Error(error.message || error);
    return pin;
  }

  async function ensureDriveVersionCheck(boardEntry, options = {}) {
    const estado = driveProbeState();
    if (estado.busy || !runtime.remoteMode || !runtime.authClient || !boardEntry?.id) return 0;
    const agora = Date.now();
    if (!options.force && (agora - (estado.at.get(boardEntry.id) || 0)) < DRIVE_PROBE_INTERVAL_MS) return 0;
    const context = findBoard(boardEntry.id);
    // Sondar e registrar sao escrita no elemento. Quem so visualiza le o
    // historico, mas nao alimenta ele - e nao dispara chamada ao Drive.
    if (!context || !hasPermission('edit', context)) return 0;

    estado.busy = true;
    estado.at.set(boardEntry.id, agora);
    let criadas = 0;
    const falhas = [];
    try {
      const alvos = await driveVersionTargets(boardEntry);
      if (!alvos.length) return 0;
      const porConexao = new Map();
      alvos.forEach((alvo) => {
        const chave = alvo.storage_connection_id || '';
        if (!porConexao.has(chave)) porConexao.set(chave, []);
        porConexao.get(chave).push(alvo);
      });

      for (const [connectionId, lista] of porConexao) {
        const connection = storageConnection(connectionId) || storageForContext(context);
        if (!connection?.appScriptUrl || !connection.folderId || connection.status === 'disabled') continue;
        if (!connectorSupportsVersions(connection)) continue;
        const falhouEm = estado.failedAt.get(connection.id) || 0;
        if (!options.force && (agora - falhouEm) < DRIVE_PROBE_BACKOFF_MS) continue;

        let resposta = null;
        try {
          resposta = await callDriveConnector(connection, boardEntry.id, {
            action: 'driveprobe',
            files: lista.map((alvo) => ({ fileId: alvo.file_id, revision: alvo.origem_revisao || '' })),
          });
          estado.failedAt.delete(connection.id);
        } catch (error) {
          // Conector fora do ar nao pode virar erro na tela de quem so abriu o
          // quadro. Nada se perde: a fonte da verdade e a revisao gravada na
          // tabela contra a revisao atual no Drive, entao a proxima sondagem
          // que der certo detecta tudo que ficou para tras.
          estado.failedAt.set(connection.id, Date.now());
          falhas.push(`Conexão ${connection.name || connection.nome || connection.id}: ${error.message || error}`);
          continue;
        }

        (resposta.missing || []).forEach((fileId) => estado.missing.add(String(fileId)));
        (resposta.outside || []).forEach((fileId) => estado.missing.add(String(fileId)));
        const porArquivo = new Map(lista.map((alvo) => [String(alvo.file_id), alvo]));

        for (const hit of (resposta.files || [])) {
          const alvo = porArquivo.get(String(hit.fileId));
          if (!alvo) continue;
          estado.missing.delete(String(hit.fileId));
          try {
            if (alvo.revisao_fixacao_pendente && alvo.origem_revisao) {
              const retriedPin = await retryPendingDrivePin(connection, context, alvo);
              if (retriedPin?.pinned && options.force) {
                toast(`Versão histórica de ${alvo.nome} protegida no Drive.`);
              }
            }
            if (hit.baseline) {
              await recordDriveBaseline(connection, context, alvo, hit);
              continue;
            }
            if (!hit.changed) continue;
            const editadoHa = hit.modifiedTime ? (Date.now() - new Date(hit.modifiedTime).getTime()) : Infinity;
            if (editadoHa < DRIVE_PROBE_MIN_AGE_MS) continue;
            const { row, pin } = await registerDriveVersion(connection, context, alvo, hit);
            // A RPC devolve a linha existente quando outra aba registrou a mesma
            // revisao primeiro. Nesse caso nao ha versao nova para anunciar.
            if (!row || Number(row.versao) <= Number(alvo.versao)) continue;
            criadas += 1;
            toast(pin.pinned
              ? `Nova versão detectada no Drive: ${alvo.nome} (V${Number(row.versao)}).`
              : pin.retry
                ? `Nova versão detectada no Drive: ${alvo.nome} (V${Number(row.versao)}). A proteção da revisão está pendente e será tentada novamente.`
                : `Nova versão detectada no Drive: ${alvo.nome} (V${Number(row.versao)}). O Google não permite preservar esta revisão para download histórico.`);
          } catch (error) {
            falhas.push(`${alvo.nome}: ${error.message || error}`);
          }
        }
      }
    } finally {
      estado.busy = false;
    }

    if (criadas) {
      await hydrateBoardRemoteData(boardEntry.id, {
        itemIds: flatBoardItems(boardEntry).map(({ item }) => item.id),
        force: true,
        renderAfter: true,
      });
      if (runtime.imageViewer) {
        openAttachmentViewer(runtime.imageViewer.itemId, runtime.imageViewer.columnId, runtime.imageViewer.index);
      }
    }
    if (options.force && falhas.length) {
      const complemento = falhas.length > 1 ? ` (+${falhas.length - 1} falha(s))` : '';
      throw new Error(`${falhas[0]}${complemento}`);
    }
    return criadas;
  }

  // Sondagem periodica com o quadro aberto (escolha do produto: a versao aparece
  // sozinha, sem reabrir nada). So roda com a aba visivel - aba em segundo plano
  // gastaria cota do Apps Script sem ninguem olhando.
  function scheduleDriveVersionPolling() {
    clearInterval(runtime.driveProbeTimer);
    runtime.driveProbeTimer = setInterval(() => {
      if (document.hidden) return;
      const context = findBoard();
      if (context?.board) void ensureDriveVersionCheck(context.board);
    }, DRIVE_PROBE_INTERVAL_MS);
  }

  async function checkDriveVersionsNow() {
    const context = findBoard();
    if (!context?.board) return;
    toast('Verificando o Drive...');
    try {
      const criadas = await ensureDriveVersionCheck(context.board, { force: true });
      if (!criadas) toast('Nenhuma alteração nova no Drive.');
    } catch (error) {
      toast(`Não foi possível verificar novas versões: ${error.message || error}`, true);
    }
  }

  // Baixar uma versao ANTERIOR nao pode usar o link direto do Drive: todas as
  // versoes compartilham o mesmo arquivo, entao aquele link entregaria sempre o
  // conteudo atual. O conteudo antigo so sai pela revisao, e revisao exige
  // cabecalho OAuth - por isso o byte vem pelo conector e vira download aqui.
  async function downloadAttachmentVersion(entryIndex) {
    const data = viewerAttachment();
    if (!data) return;
    const versao = (data.versions || []).find((entry) => entry._index === Number(entryIndex));
    if (!versao) return;
    if (!versao.originRevision || !versao.pinnedRevision) {
      toast(versao.pinPending
        ? 'A proteção desta revisão ainda está pendente. O Atlas tentará novamente na próxima verificação do Drive.'
        : 'Esta versão não pôde ser preservada pelo Google. Restam o registro e o rótulo.', true);
      return;
    }
    const connection = storageForContext(data.context);
    if (!connection?.appScriptUrl) {
      toast('Conecte o Google Drive deste setor para baixar versões anteriores.', true);
      return;
    }
    setOperationProgress('Recuperando versão', 10, `V${Number(versao.version || 1)}`);
    try {
      const result = await callDriveConnector(connection, data.context.board.id, {
        action: 'driverevision',
        fileId: versao.fileId,
        revisionId: versao.originRevision,
      });
      const bytes = Uint8Array.from(atob(result.base64), (caractere) => caractere.charCodeAt(0));
      const blob = new Blob([bytes], { type: result.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `V${Number(versao.version || 1)} - ${result.name || versao.name || 'arquivo'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setOperationProgress('Versão recuperada', 100, link.download);
    } catch (error) {
      setOperationProgress('Falha ao recuperar versão', 100, String(error?.message || error));
      toast(`Não foi possível baixar esta versão: ${error.message || error}`, true);
    }
  }

  async function confirmAttachmentVersion(attachmentId) {
    if (!attachmentId || !runtime.authClient || !runtime.remoteMode) return;
    const data = viewerAttachment();
    if (!data || !requirePermission('edit', data.context, 'conferir esta versão')) return;
    const { error } = await runtime.authClient.rpc('atlas_v2_confirm_attachment_version', { p_attachment_id: attachmentId });
    if (error) {
      toast(`Não foi possível conferir: ${error.message || error}`, true);
      return;
    }
    const alvo = data.allEntries.find((entry) => entry.attachmentId === attachmentId);
    if (alvo) alvo.reviewedAt = new Date().toISOString();
    toast('Versão conferida.');
    render();
    openAttachmentViewer(runtime.imageViewer.itemId, runtime.imageViewer.columnId, runtime.imageViewer.index);
  }

  async function addAttachmentVersion(input) {
    const file = [...(input.files || [])][0];
    input.value = '';
    if (!file) return;
    const data = viewerAttachment();
    if (!data || !data.versioned || !data.document) return;
    if (!requirePermission('edit', data.context, 'enviar uma versão nova')) return;
    const documentId = data.document.documentId;
    if (!documentId) {
      toast('Este arquivo foi enviado antes do controle de versões e não aceita versões novas. Envie-o novamente pelo campo para começar um histórico.', true);
      return;
    }
    const connection = storageForContext(data.context);
    if (!(connection?.appScriptUrl && connection.folderId && connection.status !== 'disabled')) {
      toast('Conecte e valide o Google Drive deste setor antes de enviar versões.', true);
      return;
    }
    const arquivoVivo = String(data.document.current?.fileId || '').trim();
    if (!arquivoVivo) {
      toast('Este documento não tem arquivo no Drive para receber uma versão nova.', true);
      return;
    }
    if (!connectorSupportsVersions(connection)) {
      toast('O conector do Drive deste setor ainda é a versão antiga. Reimplante-o para enviar versões.', true);
      return;
    }
    setOperationProgress('Enviando versão', 4, file.name);
    try {
      await ensureRemoteItemBeforeAttachment(data.context, data.found);
      const prepared = await prepareFileForAtlas(file, data.column.type);
      // Grava POR CIMA do arquivo vivo, gerando uma revisao - e nao um arquivo
      // novo na pasta. E o que faz "Adicionar versao" pelo Atlas se comportar
      // igual a uma edicao feita direto no Drive: um documento, um arquivo.
      setOperationProgress(`Enviando ${file.name}`, 30, 'Nova versão');
      const gravado = await callDriveConnector(connection, data.context.board.id, {
        action: 'driveupdate',
        fileId: arquivoVivo,
        nomeArquivo: prepared.name,
        mimeType: prepared.mimeType,
        base64: prepared.base64,
      });
      setOperationProgress(`Registrando ${file.name}`, 88, 'Nova versão');
      const fixacao = await pinDriveRevision(connection, data.context.board.id, arquivoVivo, gravado.revision);
      const { data: linha, error: erroRegistro } = await runtime.authClient
        .rpc('atlas_v2_register_attachment', {
          p_item_id: data.found.item.id,
          p_column_id: data.column.id,
          p_storage_connection_id: connection.id,
          p_file_id: arquivoVivo,
          p_folder_id: gravado.folderId || '',
          p_nome: gravado.name || prepared.name,
          p_mime_type: gravado.mimeType || prepared.mimeType,
          p_tamanho: Number(gravado.size || prepared.size || 0),
          p_view_url: gravado.webViewUrl || gravado.url || '',
          p_thumbnail_url: gravado.thumbnailUrl || '',
          p_ordem: data.allEntries.length,
          p_documento_id: documentId,
          p_rotulo: null,
          p_origem: 'upload',
          p_origem_revisao: gravado.revision || null,
          p_origem_autor: null,
          p_drive_version: gravado.driveVersion ? Number(gravado.driveVersion) : null,
          p_drive_modified_at: gravado.modifiedTime || null,
          p_revisao_fixada: fixacao.pinned,
          p_revisao_fixacao_pendente: !fixacao.pinned && fixacao.retry,
        })
        .single();
      if (erroRegistro) throw new Error(erroRegistro.message || erroRegistro);
      const registered = remoteAttachmentEntry(linha);
      if (!fixacao.pinned) {
        toast(fixacao.retry
          ? 'A versão foi gravada. A proteção da revisão está pendente e será tentada novamente.'
          : 'A versão foi gravada, mas o Google não permite preservar esta revisão para download histórico.', true);
      }
      data.found.item.values[runtime.imageViewer.columnId] = [...data.allEntries, registered];
      runtime.imageViewer.versionEntryIndex = null;
      saveData('Nova versão enviada', { remote: false, itemId: data.found.item.id });
      setOperationProgress('Versão enviada', 100, `V${Number(registered.version || '')}`.replace('Vundefined', 'Concluído'));
      toast(`Versão V${Number(registered.version || 1)} adicionada ao histórico.`);
      render();
      openAttachmentViewer(runtime.imageViewer.itemId, runtime.imageViewer.columnId, runtime.imageViewer.index);
    } catch (error) {
      setOperationProgress('Falha ao enviar versão', 100, String(error?.message || error));
      toast(`Não foi possível enviar a versão: ${error.message || error}`, true);
    }
  }

  async function removeViewerImage() {
    const data = viewerAttachment();
    if (!data || !requirePermission('delete', data.context, 'remover este arquivo')) return;
    const removed = data.attachments[runtime.imageViewer.index];
    if (!removed) return;

    const removedEntries = data.versioned && data.document
      ? data.document.versions
      : [removed];
    const removedIndexes = new Set(removedEntries.map((entry) => Number(entry._index)).filter(Number.isInteger));
    if (!data.versioned) removedIndexes.add(runtime.imageViewer.index);
    const attachmentIds = [...new Set(removedEntries.map((entry) => entry.attachmentId).filter(Boolean))];
    const driveFiles = [...new Map(removedEntries.filter((entry) => entry.fileId).map((entry) => [entry.fileId, {
      file_id: entry.fileId,
      storage_connection_id: entry.storageConnectionId || null,
      nome: entry.name || 'Arquivo',
      atlasBoardId: data.context.board.id,
    }])).values()];

    let driveTrashed = false;
    if (driveFiles.length) {
      try {
        await syncDriveAttachmentRows(driveFiles, 'delete');
        driveTrashed = true;
      } catch (error) {
        toast(`O arquivo não foi removido porque o Drive não confirmou a exclusão: ${error.message || error}`, true);
        return;
      }
    }

    if (attachmentIds.length && runtime.authClient && runtime.remoteMode) {
      attachmentIds.forEach((attachmentId) => runtime.realtimeLocalIds.add(attachmentId));
      const { data: deletedRows, error } = await runtime.authClient.from('atlas_v2_attachments').delete().in('id', attachmentIds).select('id');
      if (error || deletedRows?.length !== attachmentIds.length) {
        attachmentIds.forEach((attachmentId) => runtime.realtimeLocalIds.delete(attachmentId));
        if (driveTrashed) {
          try {
            await syncDriveAttachmentRows(driveFiles, 'undodelete');
          } catch (rollbackError) {
            runtime.data.errors = Array.isArray(runtime.data.errors) ? runtime.data.errors : [];
            runtime.data.errors.unshift({ id: id('error'), title: 'Arquivo requer recuperação no Drive', detail: rollbackError.message || String(rollbackError), createdAt: new Date().toISOString() });
            toast('O Atlas não confirmou a exclusão e também não conseguiu restaurar o arquivo no Drive. O incidente foi registrado para um administrador.', true);
            return;
          }
        }
        toast(`Não foi possível remover o arquivo do Atlas: ${error?.message || 'o servidor não confirmou todas as exclusões'}`, true);
        return;
      }
      setTimeout(() => attachmentIds.forEach((attachmentId) => runtime.realtimeLocalIds.delete(attachmentId)), 2000);
    }

    const remainingEntries = data.allEntries.filter((_, index) => !removedIndexes.has(index));
    data.found.item.values[runtime.imageViewer.columnId] = remainingEntries;
    saveData('Arquivo removido', { remote: attachmentIds.length ? false : true, itemId: data.found.item.id });
    const remainingDocuments = data.versioned ? currentAttachmentEntries(remainingEntries) : remainingEntries;
    if (!remainingDocuments.length) {
      closeOverlay();
      render();
      return;
    }
    runtime.imageViewer.index = Math.min(runtime.imageViewer.index, remainingDocuments.length - 1);
    runtime.imageViewer.versionEntryIndex = null;
    openAttachmentViewer(runtime.imageViewer.itemId, runtime.imageViewer.columnId, runtime.imageViewer.index);
  }

  function flatBoardItems(boardEntry) {
    const rows = [];
    // Um admin pode restringir o acesso de um usuario a uma obra (item)
    // especifica via Admin > Permissoes. Filtrar aqui, na funcao central de
    // onde toda a UI (tabela/kanban/gantt/selecao em massa) le a lista de
    // itens, garante que a obra bloqueada some de toda a interface de uma vez
    // so, em vez de precisar repetir o filtro em cada tela. Se o item pai
    // esta bloqueado, os subitens dele tambem ficam ocultos (nao visitamos).
    const boardContext = findBoard(boardEntry.id) || { board: boardEntry };
    const visit = (entries, groupEntry, parent = null) => (entries || []).forEach((itemEntry) => {
      if (!hasPermission('view', { ...boardContext, groupId: groupEntry.id, itemId: itemEntry.id })) return;
      rows.push({ item: itemEntry, group: groupEntry, parent });
      visit(itemEntry.subitems, groupEntry, itemEntry);
    });
    (boardEntry.groups || []).forEach((groupEntry) => visit(groupEntry.items, groupEntry));
    return rows;
  }

  // Um quadro com coluna-formula de agregacao (SOMA/MEDIA/MINIMO/MAXIMO/CONT)
  // precisa dos valores dos SUBITENS para calcular, mesmo os recolhidos - ver
  // boardViewItemIds.
  function boardHasSubitemAggregation(boardEntry) {
    return (boardEntry?.columns || []).some((entry) => entry.type === 'formula'
      && /\b(SOMA|MEDIA|MINIMO|MAXIMO|CONT)\s*\(/i.test(String(entry.formula || '')));
  }

  function boardHasColumnAggregation(boardEntry) {
    return (boardEntry?.columns || []).some((entry) => entry.type === 'formula'
      && /\b(SOMA_COLUNA|MEDIA_COLUNA|MINIMO_COLUNA|MAXIMO_COLUNA|CONT_COLUNA)\s*\(/i.test(String(entry.formula || '')));
  }

  function boardViewItemIds(boardEntry) {
    if (!boardEntry) return [];
    const allIds = () => flatBoardItems(boardEntry).map(({ item }) => item.id);
    if (Object.keys(runtime.searchFilters?.[boardEntry.id] || {}).length) return allIds();
    // Sem os valores dos subitens recolhidos, uma formula de agregacao
    // calcularia 0 silenciosamente (subitem.values vazio vira 0), mostrando um
    // numero plausivel e ERRADO - por isso esses quadros carregam a arvore
    // inteira, nao so o que esta visivel.
    if (boardHasSubitemAggregation(boardEntry) || boardHasColumnAggregation(boardEntry)) return allIds();
    if (boardEntry.activeView === 'works') {
      const selected = ensureWorkSelection(boardEntry);
      return selected ? itemTreeIds(selected.item, []) : [];
    }
    if (!['table'].includes(boardEntry.activeView)) return allIds();
    const ids = [];
    const visitExpanded = (itemEntry) => {
      ids.push(itemEntry.id);
      if (itemEntry.subitemsExpanded) (itemEntry.subitems || []).forEach(visitExpanded);
    };
    (boardEntry.groups || []).forEach((groupEntry) => (groupEntry.items || []).forEach(visitExpanded));
    return ids;
  }

  async function ensureBoardViewData(boardEntry, options = {}) {
    if (!runtime.remoteMode || !runtime.authClient || !boardEntry?.id) return true;
    void loadBoardChatCounts(boardEntry.id);
    // Dispara-e-esquece de proposito: conector do Drive fora do ar NAO pode
    // impedir o quadro de abrir. A propria funcao cuida do intervalo minimo e
    // de nao rodar duas vezes ao mesmo tempo.
    void ensureDriveVersionCheck(boardEntry);
    // Formula de agregacao (SOMA/MEDIA/...) le os valores dos SUBITENS, e
    // loadedItemValues NAO e confiavel para eles: ao restaurar do cache de
    // bootstrap o app marca a arvore inteira como "carregada" mesmo sem ter
    // os valores dos filhos, entao a busca normal abaixo seria pulada e a
    // agregacao somaria zeros silenciosamente. Aqui a busca e forcada uma
    // unica vez por quadro/sessao (a trava evita repetir a cada render, ja
    // que hydrate re-renderiza e cairia de volta aqui).
    if (boardHasSubitemAggregation(boardEntry) && !runtime.aggregationHydratedBoards.has(boardEntry.id)) {
      runtime.aggregationHydratedBoards.add(boardEntry.id);
      return hydrateBoardRemoteData(boardEntry.id, {
        itemIds: flatBoardItems(boardEntry).map(({ item }) => item.id),
        force: true,
        renderAfter: options.renderAfter !== false,
      });
    }
    const itemIds = options.full
      ? flatBoardItems(boardEntry).map(({ item }) => item.id)
      : boardViewItemIds(boardEntry);
    if (!itemIds.some((itemId) => !runtime.loadedItemValues.has(String(itemId)))) {
      if (runtime.data?.activeBoardId === boardEntry.id) document.body.classList.remove('atlas-v2-board-loading');
      return true;
    }
    return hydrateBoardRemoteData(boardEntry.id, {
      itemIds,
      renderAfter: options.renderAfter !== false,
    });
  }

  function itemIsCompleted(boardEntry, itemEntry) {
    const statusColumn = boardEntry.columns.find((entry) => entry.type === 'status');
    const value = statusColumn ? String(itemEntry.values?.[statusColumn.id] || '') : '';
    return /conclu|finaliz|documentado|feito/i.test(value);
  }

  function boardSlaState(boardEntry, itemEntry) {
    const configured = boardEntry.settings?.slaDateColumnId;
    const dateColumn = boardEntry.columns.find((entry) => entry.id === configured)
      || boardEntry.columns.find((entry) => entry.type === 'date' && /prazo|previs|limite|venc/i.test(entry.name))
      || boardEntry.columns.find((entry) => entry.type === 'date');
    if (!dateColumn || itemIsCompleted(boardEntry, itemEntry)) return null;
    const date = parseTimelineDate(itemEntry.values?.[dateColumn.id]);
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((date.getTime() - today.getTime()) / 86400000);
    if (days < 0) return { level: 'late', label: `${Math.abs(days)}d atrasado`, days, dateColumn };
    if (days <= Number(boardEntry.settings?.slaWarningDays ?? 2)) return { level: 'warning', label: days === 0 ? 'Vence hoje' : `${days}d restante`, days, dateColumn };
    return { level: 'ok', label: `${days}d restante`, days, dateColumn };
  }

  function dashboardWidgets(boardEntry) {
    const configured = Array.isArray(boardEntry.settings?.dashboardWidgets) ? boardEntry.settings.dashboardWidgets : [];
    if (configured.length) return configured;
    const statusColumn = boardEntry.columns.find((entry) => entry.type === 'status');
    return [
      { id: 'default-total', type: 'total', title: 'Total de registros' },
      { id: 'default-completed', type: 'completed', title: 'Concluídos' },
      { id: 'default-overdue', type: 'overdue', title: 'Fora do prazo' },
      ...(statusColumn ? [{ id: 'default-status', type: 'status_distribution', title: `Por ${statusColumn.name}`, columnId: statusColumn.id }] : []),
    ];
  }

  function dashboardMetricValue(boardEntry, rows, widget) {
    if (widget.type === 'total') return rows.length;
    if (widget.type === 'completed') return rows.filter((entry) => itemIsCompleted(boardEntry, entry.item)).length;
    if (widget.type === 'overdue') return rows.filter((entry) => boardSlaState(boardEntry, entry.item)?.level === 'late').length;
    const columnEntry = boardEntry.columns.find((entry) => entry.id === widget.columnId);
    const values = rows.map((entry) => {
      const raw = columnEntry?.type === 'formula' ? formulaColumnValue(boardEntry, entry.item, columnEntry) : entry.item.values?.[widget.columnId];
      return Number(String(raw ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    }).filter(Number.isFinite);
    const total = values.reduce((sum, value) => sum + value, 0);
    if (widget.type === 'average') return values.length ? (total / values.length).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '0';
    if (widget.type === 'sum') return total.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return 0;
  }

  function renderDashboardWidget(boardEntry, rows, widget) {
    if (widget.type === 'status_distribution') {
      const columnEntry = boardEntry.columns.find((entry) => entry.id === widget.columnId);
      const counts = new Map();
      rows.forEach((entry) => {
        const value = String(entry.item.values?.[widget.columnId] || 'Sem valor');
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      const maximum = Math.max(1, ...counts.values());
      return `<article class="atlas-v2-dashboard-widget is-wide"><header><span><i data-lucide="chart-no-axes-column-increasing"></i></span><div><small>DISTRIBUIÇÃO</small><strong>${escapeHtml(widget.title || columnEntry?.name || 'Status')}</strong></div></header><div class="atlas-v2-dashboard-bars">${[...counts.entries()].map(([label, count]) => {
        const details = optionDetails(columnEntry || {}, label);
        return `<div><span>${escapeHtml(label)}</span><b>${count}</b><i style="--bar:${attr(details.background || '#20d6f2')};--size:${Math.round((count / maximum) * 100)}%"></i></div>`;
      }).join('') || '<p>Nenhum dado disponível.</p>'}</div></article>`;
    }
    const icons = { total: 'rows-3', completed: 'circle-check-big', overdue: 'alarm-clock', sum: 'sigma', average: 'chart-no-axes-combined' };
    return `<article class="atlas-v2-dashboard-widget"><header><span><i data-lucide="${icons[widget.type] || 'gauge'}"></i></span><div><small>INDICADOR</small><strong>${escapeHtml(widget.title || 'Indicador')}</strong></div></header><b class="atlas-v2-dashboard-number">${escapeHtml(dashboardMetricValue(boardEntry, rows, widget))}</b><small>${rows.length} registro(s) considerados</small></article>`;
  }

  function renderDashboard(boardEntry) {
    const rows = flatBoardItems(boardEntry).filter((entry) => !entry.item.archived);
    const widgets = dashboardWidgets(boardEntry);
    return `<section class="atlas-v2-dashboard"><header class="atlas-v2-view-heading"><div><span>PAINEL OPERACIONAL</span><h2>${escapeHtml(boardEntry.name)}</h2><p>Indicadores atualizados com os dados do quadro.</p></div>${hasPermission('configure', findBoard()) ? '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="dashboard-config"><i data-lucide="sliders-horizontal"></i>Configurar</button>' : ''}</header><div class="atlas-v2-dashboard-grid">${widgets.map((widget) => renderDashboardWidget(boardEntry, rows, widget)).join('')}</div></section>`;
  }

  function openDashboardBuilder() {
    const context = findBoard();
    if (!context) return;
    const widgets = Array.isArray(context.board.settings?.dashboardWidgets) ? context.board.settings.dashboardWidgets : [];
    const numericColumns = context.board.columns.filter((entry) => ['number', 'percentage', 'currency', 'formula'].includes(entry.type));
    const statusColumns = context.board.columns.filter((entry) => ['status', 'select'].includes(entry.type));
    openModal({
      title: 'Configurar painel',
      subtitle: 'Escolha os indicadores mais úteis para este quadro.',
      body: `<form id="atlas-v2-dashboard-widget-form" class="atlas-v2-form-grid"><label class="atlas-v2-field is-wide"><span>Título</span><input name="title" maxlength="70" required placeholder="Ex.: Total projetado"></label><label class="atlas-v2-field"><span>Indicador</span><select name="type"><option value="total">Total de registros</option><option value="completed">Registros concluídos</option><option value="overdue">Registros fora do prazo</option><option value="sum">Soma de uma coluna</option><option value="average">Média de uma coluna</option><option value="status_distribution">Distribuição por status/lista</option></select></label><label class="atlas-v2-field"><span>Coluna</span><select name="columnId"><option value="">Automático</option><optgroup label="Numéricas">${numericColumns.map((entry) => `<option value="${attr(entry.id)}">${escapeHtml(entry.name)}</option>`).join('')}</optgroup><optgroup label="Status e listas">${statusColumns.map((entry) => `<option value="${attr(entry.id)}">${escapeHtml(entry.name)}</option>`).join('')}</optgroup></select></label></form><div class="atlas-v2-dashboard-builder-list">${widgets.map((widget) => `<div><i data-lucide="grip-vertical"></i><span><strong>${escapeHtml(widget.title)}</strong><small>${escapeHtml(widget.type)}</small></span><button type="button" data-action="dashboard-remove-widget" data-widget-id="${attr(widget.id)}" title="Remover"><i data-lucide="trash-2"></i></button></div>`).join('') || '<p>O painel está usando os indicadores automáticos. Adicione um para personalizar.</p>'}</div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Fechar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-dashboard-widget-form"><i data-lucide="plus"></i>Adicionar indicador</button>`,
    });
  }

  function submitDashboardWidget(form) {
    const context = findBoard();
    if (!context) return;
    const data = new FormData(form);
    context.board.settings = context.board.settings || {};
    context.board.settings.dashboardWidgets = Array.isArray(context.board.settings.dashboardWidgets) ? context.board.settings.dashboardWidgets : [];
    context.board.settings.dashboardWidgets.push({
      id: id('widget'),
      title: String(data.get('title') || '').trim() || 'Indicador',
      type: String(data.get('type') || 'total'),
      columnId: String(data.get('columnId') || ''),
    });
    saveData('Indicador adicionado ao painel');
    openDashboardBuilder();
  }

  function removeDashboardWidget(widgetId) {
    const context = findBoard();
    if (!context) return;
    context.board.settings.dashboardWidgets = (context.board.settings?.dashboardWidgets || []).filter((entry) => entry.id !== widgetId);
    saveData('Indicador removido do painel');
    openDashboardBuilder();
  }

  function calendarMonth(boardEntry) {
    const stored = runtime.calendarCursor.get(boardEntry.id);
    const date = stored ? new Date(stored) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function setCalendarMonth(offset = 0, reset = false) {
    const context = findBoard();
    if (!context) return;
    const current = reset ? new Date() : calendarMonth(context.board);
    runtime.calendarCursor.set(context.board.id, new Date(current.getFullYear(), current.getMonth() + Number(offset || 0), 1).toISOString());
    renderBoardContent(context.board);
    refreshIcons(document.getElementById('atlas-v2-board-content'));
  }

  function renderCalendar(boardEntry) {
    const month = calendarMonth(boardEntry);
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    const rows = flatBoardItems(boardEntry).map((entry) => ({ ...entry, range: itemTimelineRange(boardEntry, entry.item) })).filter((entry) => entry.range);
    const days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
    const todayKey = new Date().toISOString().slice(0, 10);
    return `<section class="atlas-v2-calendar"><header class="atlas-v2-view-heading"><div><span>AGENDA DO QUADRO</span><h2>${month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2><p>${rows.length} registro(s) com data ou período.</p></div><div class="atlas-v2-calendar-controls"><button type="button" data-action="calendar-prev" title="Mês anterior"><i data-lucide="chevron-left"></i></button><button type="button" data-action="calendar-today">Hoje</button><button type="button" data-action="calendar-next" title="Próximo mês"><i data-lucide="chevron-right"></i></button></div></header><div class="atlas-v2-calendar-week">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => `<span>${day}</span>`).join('')}</div><div class="atlas-v2-calendar-grid">${days.map((date) => {
      const key = date.toISOString().slice(0, 10);
      const entries = rows.filter((entry) => entry.range.start <= date && entry.range.end >= date);
      return `<article class="${date.getMonth() !== month.getMonth() ? 'is-outside' : ''} ${key === todayKey ? 'is-today' : ''}"><header><b>${date.getDate()}</b>${key === todayKey ? '<span>HOJE</span>' : ''}</header><div>${entries.slice(0, 4).map((entry) => `<button type="button" data-action="calendar-open-item" data-item-id="${attr(entry.item.id)}" style="--event-color:${attr(entry.group.color || '#20d6f2')}"><strong>${escapeHtml(entry.item.name)}</strong><small>${escapeHtml(entry.group.name)}</small></button>`).join('')}${entries.length > 4 ? `<span class="atlas-v2-calendar-more">+${entries.length - 4}</span>` : ''}</div></article>`;
    }).join('')}</div></section>`;
  }

  function mobileRowsMatchingSearch(boardEntry, sourceRows) {
    const query = normalizeSearchText(runtime.boardSearch);
    return sourceRows.filter((entry) => {
      if (!query) return true;
      return normalizeSearchText(`${entry.item.name} ${entry.group.name} ${Object.values(entry.item.values || {}).join(' ')}`).includes(query);
    });
  }

  function renderMobileCalendar(boardEntry) {
    const month = calendarMonth(boardEntry);
    const monthStart = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1));
    const monthEnd = new Date(Date.UTC(month.getFullYear(), month.getMonth() + 1, 0));
    const rows = mobileRowsMatchingSearch(boardEntry, flatBoardItems(boardEntry))
      .map((entry) => ({ ...entry, range: itemTimelineRange(boardEntry, entry.item) }))
      .filter((entry) => entry.range && entry.range.end >= monthStart && entry.range.start <= monthEnd)
      .sort((a, b) => a.range.start - b.range.start || a.item.name.localeCompare(b.item.name, 'pt-BR'));
    return `<section class="atlas-v2-mobile-agenda">
      <header class="atlas-v2-mobile-view-head">
        <div><small>AGENDA DO QUADRO</small><strong>${escapeHtml(month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</strong><span>${rows.length} registro(s) neste mês</span></div>
        <div class="atlas-v2-calendar-controls"><button type="button" data-action="calendar-prev" title="Mês anterior"><i data-lucide="chevron-left"></i></button><button type="button" data-action="calendar-today">Hoje</button><button type="button" data-action="calendar-next" title="Próximo mês"><i data-lucide="chevron-right"></i></button></div>
      </header>
      <div class="atlas-v2-mobile-agenda-list">${rows.map((entry) => `<button type="button" data-action="calendar-open-item" data-item-id="${attr(entry.item.id)}" style="--event-color:${attr(entry.group.color || '#20d6f2')}">
        <span class="atlas-v2-mobile-agenda-date">${escapeHtml(formatTimelineCompact(entry.range))}</span>
        <span><strong>${escapeHtml(entry.item.name)}</strong><small>${escapeHtml(entry.parent?.name || entry.group.name)}</small></span>
        <i data-lucide="chevron-right"></i>
      </button>`).join('') || '<div class="atlas-v2-empty-view"><div><i data-lucide="calendar-x"></i><strong>Nenhum registro neste mês</strong></div></div>'}</div>
    </section>`;
  }

  function renderFieldMode(boardEntry, options = {}) {
    const rows = mobileRowsMatchingSearch(boardEntry, options.rows || flatBoardItems(boardEntry));
    const visibleColumns = (boardEntry.columns || []).filter((entry) => entry?.id);
    return `<section class="atlas-v2-field-mode"><header><span><i data-lucide="${attr(options.icon || 'smartphone')}"></i></span><div><small>${escapeHtml(options.kicker || 'MODO DE CAMPO')}</small><strong>${rows.length} registro(s)</strong></div></header><div class="atlas-v2-field-list">${rows.map(({ item: itemEntry, group }) => {
      const sla = boardSlaState(boardEntry, itemEntry);
      return `<article class="atlas-v2-field-card" data-item-id="${attr(itemEntry.id)}"><header><span style="--field-color:${attr(group.color || '#20d6f2')}"></span><div><small>${escapeHtml(group.name)}</small><strong>${escapeHtml(itemEntry.name)}</strong></div>${sla ? `<b class="is-${sla.level}">${escapeHtml(sla.label)}</b>` : ''}<button class="atlas-v2-icon-button atlas-v2-field-chat" type="button" data-action="item-chat" data-item-id="${attr(itemEntry.id)}" title="Conversa" aria-label="Conversa"><i data-lucide="message-square"></i>${itemChatCount(itemEntry.id) ? `<b>${itemChatCount(itemEntry.id)}</b>` : ''}</button></header><div class="atlas-v2-field-card-fields">${visibleColumns.map((columnEntry) => `<label class="is-${attr(columnEntry.type)}"><span>${escapeHtml(columnEntry.name)}</span>${renderCell(columnEntry, itemEntry)}</label>`).join('')}</div></article>`;
    }).join('') || '<div class="atlas-v2-empty-view"><div><i data-lucide="search-x"></i><strong>Nenhum registro encontrado</strong></div></div>'}</div><nav class="atlas-v2-field-actions"><button type="button" data-action="add-item"><i data-lucide="plus"></i><span>Novo</span></button><button type="button" data-action="import"><i data-lucide="file-up"></i><span>Importar</span></button><button type="button" data-action="filter"><i data-lucide="search"></i><span>Buscar</span></button><button type="button" data-action="notifications"><i data-lucide="bell"></i><span>Avisos</span></button></nav></section>`;
  }

  function renderMobileWorks(boardEntry) {
    const tabs = renderWorkTabs(boardEntry);
    const selected = selectedWork(boardEntry);
    if (!selected) return tabs + renderEmptyBoard();
    const rows = [];
    const visit = (entries, parent = selected.item) => (entries || []).forEach((itemEntry) => {
      rows.push({ item: itemEntry, group: selected.group, parent });
      visit(itemEntry.subitems, itemEntry);
    });
    visit(selected.item.subitems);
    return tabs + renderFieldMode(boardEntry, { rows, kicker: selected.item.name, icon: 'hard-hat' });
  }

  function captureCurrentLocation(itemId, columnId) {
    const context = findBoard();
    const found = context && findItem(context.board, itemId);
    if (!context || !found || !navigator.geolocation) return toast('A geolocalização não está disponível neste aparelho.', true);
    toast('Obtendo localização...');
    navigator.geolocation.getCurrentPosition((position) => {
      const previous = found.item.values?.[columnId] || '';
      const next = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
      found.item.values[columnId] = next;
      captureItemHistory(context.board, found.item, columnId, previous, next, 'Geolocalização capturada');
      saveData('Localização adicionada', { itemId });
      render();
    }, (error) => toast(error.message || 'Não foi possível obter a localização.', true), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function renderKanban(boardEntry) {
    return `<div class="atlas-v2-kanban">${visibleGroups(boardEntry).map((groupEntry) => {
      const items = filteredItems(boardEntry, groupEntry);
      return `<section class="atlas-v2-kanban-column" style="--group-color:${attr(groupEntry.color || '#0f6cbd')}" data-drop-group="${attr(groupEntry.id)}">
        <header class="atlas-v2-kanban-head"><strong>${escapeHtml(groupEntry.name)}</strong><span class="atlas-v2-pill">${items.length}</span></header>
        ${items.map((itemEntry) => `<article class="atlas-v2-kanban-card" draggable="true" data-item-id="${attr(itemEntry.id)}"><strong>${escapeHtml(itemEntry.name)}</strong><div class="atlas-v2-kanban-meta"><span>${escapeHtml(primaryStatus(boardEntry, itemEntry))}</span><button class="atlas-v2-icon-button" type="button" data-action="item-chat" data-item-id="${attr(itemEntry.id)}" title="Conversa" aria-label="Conversa"><i data-lucide="message-square"></i>${itemChatCount(itemEntry.id) ? `<b>${itemChatCount(itemEntry.id)}</b>` : ''}</button><button class="atlas-v2-icon-button" type="button" data-action="delete-item" data-item-id="${attr(itemEntry.id)}" title="Excluir"><i data-lucide="trash-2"></i></button></div></article>`).join('')}
        <button class="atlas-v2-add-row" type="button" data-action="add-item-to-group" data-group-id="${attr(groupEntry.id)}"><i data-lucide="plus"></i><span>Adicionar item</span></button>
      </section>`;
    }).join('')}</div>`;
  }

  function renderMobileGantt(boardEntry) {
    const blocks = timelineBlocks(boardEntry);
    const childCount = blocks.reduce((total, block) => total + block.children.length, 0);
    return `<section class="atlas-v2-mobile-timeline">
      <header class="atlas-v2-mobile-view-head"><div><small>CRONOGRAMA VERTICAL</small><strong>Gantt operacional</strong><span>${blocks.length} elemento(s) Â· ${childCount} subelemento(s)</span></div><i data-lucide="chart-gantt"></i></header>
      <div class="atlas-v2-mobile-timeline-list">${blocks.map((block) => `<article class="atlas-v2-mobile-timeline-block" style="--timeline-color:${attr(block.group.color || '#20d6f2')}">
        <button type="button" data-action="calendar-open-item" data-item-id="${attr(block.item.id)}"><span><small>${escapeHtml(block.group.name)}</small><strong>${escapeHtml(block.item.name)}</strong></span><b>${escapeHtml(formatTimelineRange(block.range))}</b></button>
        ${block.children.map((child) => `<button class="is-child" type="button" data-action="calendar-open-item" data-item-id="${attr(child.item.id)}"><i data-lucide="corner-down-right"></i><span><small>Subelemento</small><strong>${escapeHtml(child.item.name)}</strong></span><b>${escapeHtml(formatTimelineRange(child.range))}</b></button>`).join('')}
      </article>`).join('') || '<div class="atlas-v2-empty-view"><div><i data-lucide="calendar-x"></i><strong>Nenhum item com cronograma</strong></div></div>'}</div>
    </section>`;
  }

  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  const PERIOD_MONTHS = {
    jan: 0, janeiro: 0, fev: 1, fevereiro: 1, mar: 2, marco: 2, abr: 3, abril: 3,
    mai: 4, maio: 4, jun: 5, junho: 5, jul: 6, julho: 6, ago: 7, agosto: 7,
    set: 8, setembro: 8, out: 9, outubro: 9, nov: 10, novembro: 10, dez: 11, dezembro: 11,
  };

  function utcDate(year, month, day) {
    return new Date(Date.UTC(Number(year), Number(month), Number(day)));
  }

  function parseTimelineDate(value) {
    const match = String(value || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const parsed = utcDate(match[1], Number(match[2]) - 1, match[3]);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function parseTimelinePeriod(value) {
    if (!value) return null;
    if (Array.isArray(value) && value.length) {
      const start = parseTimelineDate(value[0]);
      const end = parseTimelineDate(value[1] || value[0]);
      return start && end ? normalizeTimelineRange(start, end) : null;
    }
    if (typeof value === 'object') {
      const start = parseTimelineDate(value.start || value.inicio || value.from);
      const end = parseTimelineDate(value.end || value.fim || value.to || value.start || value.inicio || value.from);
      return start && end ? normalizeTimelineRange(start, end) : null;
    }
    const text = String(value).trim();
    const isoDates = text.match(/\d{4}-\d{2}-\d{2}/g) || [];
    if (isoDates.length) {
      const start = parseTimelineDate(isoDates[0]);
      const end = parseTimelineDate(isoDates[1] || isoDates[0]);
      return start && end ? normalizeTimelineRange(start, end) : null;
    }
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const monthRange = normalized.match(/^([a-z]+)\s*-\s*([a-z]+)\s*\/\s*(\d{4})$/);
    if (!monthRange) return null;
    const startMonth = PERIOD_MONTHS[monthRange[1]];
    const endMonth = PERIOD_MONTHS[monthRange[2]];
    if (startMonth === undefined || endMonth === undefined) return null;
    const start = utcDate(monthRange[3], startMonth, 1);
    const endYear = Number(monthRange[3]) + (endMonth < startMonth ? 1 : 0);
    const end = utcDate(endYear, endMonth + 1, 0);
    return { start, end };
  }

  function normalizeTimelineRange(start, end) {
    return start.getTime() <= end.getTime() ? { start, end } : { start: end, end: start };
  }

  function timelineColumnScore(columnEntry, mode) {
    const name = `${columnEntry.id} ${columnEntry.name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const terms = mode === 'start'
      ? ['inicio', 'abertura', 'solicitacao', 'start', 'data']
      : ['fim', 'final', 'conclusao', 'previsao', 'entrega', 'end'];
    return terms.reduce((score, term, index) => score + (name.includes(term) ? terms.length - index : 0), 0);
  }

  function itemTimelineRange(boardEntry, itemEntry) {
    const periodColumns = boardEntry.columns.filter((entry) => entry.type === 'period');
    for (const columnEntry of periodColumns) {
      const range = parseTimelinePeriod(itemEntry.values?.[columnEntry.id]);
      if (range) return range;
    }
    const dateColumns = boardEntry.columns.filter((entry) => entry.type === 'date');
    if (!dateColumns.length) return null;
    const startColumn = [...dateColumns].sort((a, b) => timelineColumnScore(b, 'start') - timelineColumnScore(a, 'start'))[0];
    const endColumn = [...dateColumns]
      .filter((entry) => entry.id !== startColumn.id)
      .sort((a, b) => timelineColumnScore(b, 'end') - timelineColumnScore(a, 'end'))[0] || startColumn;
    const fallbackDates = dateColumns.map((entry) => parseTimelineDate(itemEntry.values?.[entry.id])).filter(Boolean);
    const start = parseTimelineDate(itemEntry.values?.[startColumn.id]) || fallbackDates[0];
    const end = parseTimelineDate(itemEntry.values?.[endColumn.id]) || fallbackDates[fallbackDates.length - 1] || start;
    return start && end ? normalizeTimelineRange(start, end) : null;
  }

  function mergeTimelineRanges(ranges) {
    const valid = ranges.filter(Boolean);
    if (!valid.length) return null;
    return {
      start: new Date(Math.min(...valid.map((entry) => entry.start.getTime()))),
      end: new Date(Math.max(...valid.map((entry) => entry.end.getTime()))),
    };
  }

  function timelineDayDiff(start, end) {
    return Math.round((end.getTime() - start.getTime()) / DAY_IN_MS);
  }

  function addTimelineDays(date, amount) {
    return new Date(date.getTime() + (amount * DAY_IN_MS));
  }

  function formatTimelineDate(date) {
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
  }

  function formatTimelineRange(range) {
    if (!range) return 'Sem período';
    if (range.start.getTime() === range.end.getTime()) return formatTimelineDate(range.start);
    return `${formatTimelineDate(range.start)} - ${formatTimelineDate(range.end)}`;
  }

  function formatTimelineCompact(range) {
    if (!range) return 'Sem período';
    const part = (date) => {
      const month = date.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'short' }).replace('.', '').toLowerCase();
      return `${month} ${date.getUTCDate()}`;
    };
    const start = part(range.start);
    const end = part(range.end);
    if (range.start.getUTCFullYear() !== range.end.getUTCFullYear()) {
      return `${start}/${String(range.start.getUTCFullYear()).slice(-2)} - ${end}/${String(range.end.getUTCFullYear()).slice(-2)}`;
    }
    return range.start.getTime() === range.end.getTime() ? start : `${start} - ${end}`;
  }

  function timelineBlocks(boardEntry) {
    const blocks = [];
    visibleGroups(boardEntry).forEach((groupEntry) => {
      filteredItems(boardEntry, groupEntry).forEach((itemEntry) => {
        const children = visibleSubitems(boardEntry, itemEntry).map((subitem) => ({
          item: subitem,
          range: itemTimelineRange(boardEntry, subitem),
        })).sort((a, b) => (a.range?.start.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.range?.start.getTime() ?? Number.MAX_SAFE_INTEGER));
        const ownRange = itemTimelineRange(boardEntry, itemEntry);
        blocks.push({
          item: itemEntry,
          group: groupEntry,
          ownRange,
          range: ownRange || mergeTimelineRanges(children.map((entry) => entry.range)),
          children,
        });
      });
    });
    return blocks.sort((a, b) => {
      const dateOrder = (a.range?.start.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.range?.start.getTime() ?? Number.MAX_SAFE_INTEGER);
      return dateOrder || a.item.name.localeCompare(b.item.name, 'pt-BR');
    });
  }

  function timelineMonths(start, end, dayWidth) {
    const entries = [];
    let cursor = utcDate(start.getUTCFullYear(), start.getUTCMonth(), 1);
    while (cursor.getTime() <= end.getTime()) {
      const nextMonth = utcDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
      const segmentStart = new Date(Math.max(cursor.getTime(), start.getTime()));
      const segmentEnd = new Date(Math.min(addTimelineDays(nextMonth, -1).getTime(), end.getTime()));
      const width = (timelineDayDiff(segmentStart, segmentEnd) + 1) * dayWidth;
      const shortMonth = cursor.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'short' }).replace('.', '');
      entries.push({
        label: `${shortMonth} ${cursor.getUTCFullYear()}`,
        compactLabel: shortMonth,
        left: timelineDayDiff(start, segmentStart) * dayWidth,
        width,
      });
      cursor = nextMonth;
    }
    return entries;
  }

  function timelineYears(start, end, dayWidth) {
    const entries = [];
    let cursor = utcDate(start.getUTCFullYear(), 0, 1);
    while (cursor.getTime() <= end.getTime()) {
      const nextYear = utcDate(cursor.getUTCFullYear() + 1, 0, 1);
      const segmentStart = new Date(Math.max(cursor.getTime(), start.getTime()));
      const segmentEnd = new Date(Math.min(addTimelineDays(nextYear, -1).getTime(), end.getTime()));
      entries.push({
        label: String(cursor.getUTCFullYear()),
        left: timelineDayDiff(start, segmentStart) * dayWidth,
        width: (timelineDayDiff(segmentStart, segmentEnd) + 1) * dayWidth,
      });
      cursor = nextYear;
    }
    return entries;
  }

  function timelineWeekStart(date) {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    return addTimelineDays(date, -mondayOffset);
  }

  function timelineWeeks(start, end, dayWidth) {
    const entries = [];
    let cursor = timelineWeekStart(start);
    while (cursor.getTime() <= end.getTime()) {
      const weekEnd = addTimelineDays(cursor, 6);
      const segmentStart = new Date(Math.max(cursor.getTime(), start.getTime()));
      const segmentEnd = new Date(Math.min(weekEnd.getTime(), end.getTime()));
      const startDay = String(cursor.getUTCDate()).padStart(2, '0');
      const endDay = String(weekEnd.getUTCDate()).padStart(2, '0');
      const month = weekEnd.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'short' }).replace('.', '');
      entries.push({
        label: `${startDay} – ${endDay} ${month}`,
        left: timelineDayDiff(start, segmentStart) * dayWidth,
        width: (timelineDayDiff(segmentStart, segmentEnd) + 1) * dayWidth,
      });
      cursor = addTimelineDays(cursor, 7);
    }
    return entries;
  }

  function timelineDays(start, end, dayWidth) {
    const entries = [];
    let cursor = new Date(start.getTime());
    while (cursor.getTime() <= end.getTime()) {
      entries.push({
        label: String(cursor.getUTCDate()).padStart(2, '0'),
        sublabel: cursor.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short' }).replace('.', '').slice(0, 3),
        left: timelineDayDiff(start, cursor) * dayWidth,
        width: dayWidth,
      });
      cursor = addTimelineDays(cursor, 1);
    }
    return entries;
  }

  function timelineScaleDefinition(scale, start, end, dayWidth) {
    if (scale === 'days') {
      return {
        primary: timelineMonths(start, end, dayWidth).map((entry) => ({ ...entry, label: entry.label })),
        secondary: timelineDays(start, end, dayWidth),
        grid: timelineDays(start, end, dayWidth),
      };
    }
    if (scale === 'months') {
      return {
        primary: timelineYears(start, end, dayWidth),
        secondary: timelineMonths(start, end, dayWidth).map((entry) => ({ ...entry, label: entry.compactLabel })),
        grid: timelineMonths(start, end, dayWidth),
      };
    }
    return {
      primary: timelineMonths(start, end, dayWidth).map((entry) => ({ ...entry, label: entry.label })),
      secondary: timelineWeeks(start, end, dayWidth),
      grid: timelineWeeks(start, end, dayWidth),
    };
  }

  function ganttDayWidth(scale, totalDays, availableTimelineWidth) {
    const preferred = scale === 'days' ? 36 : scale === 'months' ? 5.2 : 13.5;
    const fitted = availableTimelineWidth / Math.max(totalDays, 1);
    const baseWidth = Math.max(scale === 'months' ? 3.8 : 7, fitted, preferred);
    const zoom = Math.min(5, Math.max(1, Number(runtime.ganttZoom) || 1));
    return baseWidth * zoom;
  }

  function timelineBarColor(boardEntry, itemEntry, fallback) {
    const appearance = itemStatusAppearance(boardEntry, itemEntry);
    return appearance?.background || normalizedHexColor(fallback, '#0f6cbd');
  }

  function renderTimelineRow(boardEntry, row, timelineStart, dayWidth, timelineWidth, options = {}) {
    const range = row.range;
    const left = range ? timelineDayDiff(timelineStart, range.start) * dayWidth : 0;
    const width = range ? Math.max(dayWidth, (timelineDayDiff(range.start, range.end) + 1) * dayWidth) : 0;
    const captionLeft = Math.min(timelineWidth - 24, left + width + 8);
    const captionWidth = Math.max(0, timelineWidth - captionLeft - 8);
    const color = timelineBarColor(boardEntry, row.item, options.color || '#0f6cbd');
    const label = options.isChild ? `<span class="atlas-v2-gantt-branch" aria-hidden="true"></span><i data-lucide="corner-down-right"></i>` : '<i data-lucide="layers-3"></i>';
    const tooltip = range
      ? `${row.item.name}: ${formatTimelineRange(range)}`
      : `${row.item.name}: sem período definido`;
    return `<div class="atlas-v2-gantt-row ${options.isChild ? 'is-child' : 'is-parent'}" data-item-id="${attr(row.item.id)}" style="--timeline-width:${timelineWidth}px;--bar-color:${attr(color)}">
      <div class="atlas-v2-gantt-label"><div class="atlas-v2-gantt-name">${label}<span><strong>${escapeHtml(row.item.name)}</strong><small>${escapeHtml(options.meta || '')}</small></span></div><span class="atlas-v2-gantt-period">${escapeHtml(formatTimelineCompact(range))}</span></div>
      <div class="atlas-v2-gantt-track">${range ? `<span class="atlas-v2-gantt-bar" style="left:${left}px;width:${width}px" title="${attr(tooltip)}" aria-label="${attr(tooltip)}"></span><span class="atlas-v2-gantt-bar-caption" style="left:${captionLeft}px;max-width:${captionWidth}px">${escapeHtml(formatTimelineCompact(range))}</span>` : '<span class="atlas-v2-gantt-no-date">Sem período definido</span>'}</div>
    </div>`;
  }

  function ganttLegendEntries(boardEntry, blocks) {
    const entries = [];
    const seen = new Set();
    blocks.forEach((block) => [block.item, ...block.children.map((entry) => entry.item)].forEach((itemEntry) => {
      const appearance = itemStatusAppearance(boardEntry, itemEntry);
      if (!appearance) return;
      const key = normalizedStatusLabel(appearance.label);
      if (!key || seen.has(key)) return;
      seen.add(key);
      entries.push({ label: appearance.label, color: appearance.background });
    }));
    if (entries.length) return entries;
    return boardEntry.groups
      .filter((groupEntry) => blocks.some((block) => block.group.id === groupEntry.id))
      .map((groupEntry) => ({ label: groupEntry.name, color: groupEntry.color || '#20d6f2' }));
  }

  function renderGanttScaleEntries(entries, scale) {
    return entries.map((entry) => `<span class="${entry.sublabel ? 'has-sublabel' : ''}" style="left:${entry.left}px;width:${entry.width}px"><b>${escapeHtml(entry.label)}</b>${entry.sublabel ? `<small>${escapeHtml(entry.sublabel)}</small>` : ''}</span>`).join('');
  }

  function renderGantt(boardEntry, availableTimelineWidth = 720, labelWidth = 480) {
    const blocks = timelineBlocks(boardEntry);
    if (!blocks.length) return renderEmptyBoard();
    const allRanges = blocks.flatMap((block) => [block.range, ...block.children.map((entry) => entry.range)]).filter(Boolean);
    const today = parseTimelineDate(new Date().toISOString().slice(0, 10));
    const dataRange = mergeTimelineRanges(allRanges) || { start: addTimelineDays(today, -7), end: addTimelineDays(today, 28) };
    const scale = ['days', 'weeks', 'months'].includes(runtime.ganttScale) ? runtime.ganttScale : 'weeks';
    const startPadding = scale === 'months' ? 14 : scale === 'days' ? 2 : 7;
    const endPadding = scale === 'months' ? 31 : scale === 'days' ? 4 : 14;
    const timelineStart = addTimelineDays(dataRange.start, -startPadding);
    const timelineEnd = addTimelineDays(dataRange.end, endPadding);
    const totalDays = timelineDayDiff(timelineStart, timelineEnd) + 1;
    const dayWidth = ganttDayWidth(scale, totalDays, availableTimelineWidth);
    const timelineWidth = Math.ceil(Math.max(availableTimelineWidth, totalDays * dayWidth));
    const scaleDefinition = timelineScaleDefinition(scale, timelineStart, timelineEnd, dayWidth);
    const todayLeft = today.getTime() >= timelineStart.getTime() && today.getTime() <= timelineEnd.getTime()
      ? timelineDayDiff(timelineStart, today) * dayWidth
      : null;
    const dateColumns = boardEntry.columns.filter((entry) => entry.type === 'date' || entry.type === 'period');
    const childCount = blocks.reduce((total, block) => total + block.children.length, 0);
    const legend = ganttLegendEntries(boardEntry, blocks);
    return `<section class="atlas-v2-gantt" aria-label="Cronograma do quadro" data-gantt-scale="${attr(scale)}">
      <header class="atlas-v2-gantt-summary"><span class="atlas-v2-gantt-summary-copy"><i data-lucide="chart-gantt"></i><span><strong>Gantt operacional</strong><small>${blocks.length} ${blocks.length === 1 ? 'elemento' : 'elementos'} · ${childCount} ${childCount === 1 ? 'subelemento' : 'subelementos'} · ${escapeHtml(dateColumns.map((entry) => entry.name).join(' + ') || 'sem datas')}</small></span></span><div class="atlas-v2-gantt-controls"><button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="gantt-today"><i data-lucide="crosshair"></i><span>Hoje</span></button><button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="gantt-fit"><i data-lucide="scan-line"></i><span>Ajustar</span></button><span class="atlas-v2-gantt-zoom" aria-label="Zoom horizontal da linha do tempo"><button type="button" data-action="gantt-zoom-out" title="Diminuir a largura da linha do tempo"><i data-lucide="minus"></i></button><output title="Zoom aplicado somente ao gráfico">${String(Number(runtime.ganttZoom.toFixed(2))).replace('.', ',')}×</output><button type="button" data-action="gantt-zoom-in" title="Aumentar a largura das barras"><i data-lucide="plus"></i></button></span><span class="atlas-v2-gantt-scale-toggle" aria-label="Escala do Gantt"><button type="button" data-action="gantt-scale" data-scale="days" class="${scale === 'days' ? 'is-active' : ''}">Dias</button><button type="button" data-action="gantt-scale" data-scale="weeks" class="${scale === 'weeks' ? 'is-active' : ''}">Semanas</button><button type="button" data-action="gantt-scale" data-scale="months" class="${scale === 'months' ? 'is-active' : ''}">Meses</button></span></div></header>
      <div class="atlas-v2-gantt-scroll">
        <div class="atlas-v2-gantt-canvas" data-timeline-start="${timelineStart.toISOString().slice(0, 10)}" data-day-width="${dayWidth}" style="--timeline-width:${timelineWidth}px;--gantt-label-width:${labelWidth}px;--gantt-period-width:${window.innerWidth <= 560 ? 98 : 112}px;--day-width:${dayWidth}px;--week-width:${dayWidth * 7}px">
          <div class="atlas-v2-gantt-header">
            <div class="atlas-v2-gantt-label-head"><span class="atlas-v2-gantt-name-head"><i data-lucide="list-tree"></i><span>Projeto / subelemento</span></span><span class="atlas-v2-gantt-period-head">Período</span></div>
            <div class="atlas-v2-gantt-scale"><div class="atlas-v2-gantt-primary-scale">${renderGanttScaleEntries(scaleDefinition.primary, scale)}</div><div class="atlas-v2-gantt-secondary-scale">${renderGanttScaleEntries(scaleDefinition.secondary, scale)}</div></div>
          </div>
          <div class="atlas-v2-gantt-grid-lines" aria-hidden="true" style="left:${labelWidth}px;width:${timelineWidth}px">${scaleDefinition.grid.map((entry) => `<span style="left:${entry.left}px"></span>`).join('')}</div>
          <div class="atlas-v2-gantt-body">${blocks.map((block) => `<section class="atlas-v2-gantt-block" style="--group-color:${attr(block.group.color || '#0f6cbd')}">
            ${renderTimelineRow(boardEntry, { item: block.item, range: block.range }, timelineStart, dayWidth, timelineWidth, { color: block.group.color, children: block.children, meta: `${block.group.name} · ${block.children.length} ${block.children.length === 1 ? 'subelemento' : 'subelementos'}` })}
            ${block.children.map((child) => renderTimelineRow(boardEntry, child, timelineStart, dayWidth, timelineWidth, { isChild: true, color: block.group.color, meta: block.item.name })).join('')}
          </section>`).join('')}</div>
          ${todayLeft === null ? '' : `<span class="atlas-v2-gantt-today" style="left:${labelWidth + todayLeft}px"><b>Hoje</b></span>`}
        </div>
      </div>
      <footer class="atlas-v2-gantt-legend">${legend.map((entry) => `<span><i style="--legend-color:${attr(entry.color)}"></i>${escapeHtml(entry.label)}</span>`).join('')}</footer>
    </section>`;
  }

  function primaryStatus(boardEntry, itemEntry) {
    return itemStatusAppearance(boardEntry, itemEntry)?.label || ((boardEntry.columns || []).some((entry) => entry.type === 'status') ? 'Sem status' : 'Item');
  }

  function renderSelection(boardEntry) {
    const root = document.getElementById('atlas-v2-selection-bar');
    if (!root) return;
    const count = runtime.selectedItems.size;
    if (!count) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    const selected = flatBoardItems(boardEntry).filter((entry) => runtime.selectedItems.has(entry.item.id));
    const subitems = selected.filter((entry) => entry.parent).length;
    const elements = selected.length - subitems;
    root.hidden = false;
    root.innerHTML = `<i data-lucide="list-checks"></i><strong>${count} selecionado(s)<small>${elements} elemento(s) · ${subitems} subelemento(s)</small></strong><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="bulk-edit"><i data-lucide="square-pen"></i>Editar em massa</button><select class="atlas-v2-cell-select" id="atlas-v2-bulk-group" aria-label="Grupo de destino"><option value="">Mover para...</option>${boardEntry.groups.map((entry) => `<option value="${attr(entry.id)}">${escapeHtml(entry.name)}</option>`).join('')}</select><button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="bulk-move"><i data-lucide="move-right"></i>Mover</button><button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="bulk-move-board"><i data-lucide="arrow-right-left"></i>Outro módulo</button><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-action="bulk-delete"><i data-lucide="trash-2"></i>Excluir</button><button class="atlas-v2-icon-button" type="button" data-action="clear-selection" title="Limpar seleção"><i data-lucide="x"></i></button>`;
  }

  function refreshSelectionUi(boardEntry) {
    document.querySelectorAll('[data-action="select-item"]').forEach((checkbox) => {
      const selected = runtime.selectedItems.has(checkbox.dataset.itemId);
      checkbox.checked = selected;
      checkbox.closest('[data-item-id]')?.classList.toggle('is-selected', selected);
    });
    document.querySelectorAll('[data-action="select-group"]').forEach((checkbox) => {
      const groupEntry = boardEntry.groups.find((entry) => entry.id === checkbox.dataset.groupId);
      const ids = (groupEntry?.items || []).flatMap((entry) => itemTreeIds(entry, []));
      const selectedCount = ids.filter((itemId) => runtime.selectedItems.has(itemId)).length;
      checkbox.checked = ids.length > 0 && selectedCount === ids.length;
      checkbox.indeterminate = selectedCount > 0 && selectedCount < ids.length;
    });
    const selectAll = document.querySelector('[data-action="select-all-items"]');
    if (selectAll instanceof HTMLInputElement) {
      const ids = flatBoardItems(boardEntry).map(({ item }) => item.id);
      const selectedCount = ids.filter((itemId) => runtime.selectedItems.has(itemId)).length;
      selectAll.checked = ids.length > 0 && selectedCount === ids.length;
      selectAll.indeterminate = selectedCount > 0 && selectedCount < ids.length;
    }
    renderSelection(boardEntry);
    refreshIcons(document.getElementById('atlas-v2-selection-bar'));
  }

  function bulkEditableColumns(boardEntry) {
    return (boardEntry?.columns || []).filter((entry) => !['formula', 'image', 'file'].includes(entry.type));
  }

  function bulkValueControl(boardEntry, fieldId, operation = 'set') {
    if (operation === 'clear') return '<div class="atlas-v2-bulk-clear-note"><i data-lucide="eraser"></i>O campo será limpo em todos os registros selecionados.</div>';
    if (fieldId === '__name__') return '<label class="atlas-v2-field is-wide"><span>Novo nome</span><input name="value" maxlength="160" required placeholder="Digite o nome que será aplicado"></label>';
    const columnEntry = boardEntry?.columns?.find((entry) => entry.id === fieldId);
    if (!columnEntry) return '<div class="atlas-v2-bulk-clear-note">Selecione um campo para continuar.</div>';
    if (['status', 'select'].includes(columnEntry.type)) {
      return `<label class="atlas-v2-field is-wide"><span>Novo valor</span><select name="value" required><option value="">Selecione...</option>${(columnEntry.options || []).map((entry) => {
        const label = typeof entry === 'string' ? entry : entry.label;
        return `<option value="${attr(label)}">${escapeHtml(label)}</option>`;
      }).join('')}</select></label>`;
    }
    if (columnEntry.type === 'checkbox') {
      return '<label class="atlas-v2-field is-wide"><span>Novo valor</span><select name="value"><option value="true">Marcado</option><option value="false">Desmarcado</option></select></label>';
    }
    const inputType = columnEntry.type === 'date' ? 'date' : ['number', 'currency', 'percentage'].includes(columnEntry.type) ? 'number' : columnEntry.type === 'link' ? 'url' : 'text';
    const step = ['number', 'currency', 'percentage'].includes(columnEntry.type) ? ' step="any"' : '';
    return `<label class="atlas-v2-field is-wide"><span>Novo valor</span><input name="value" type="${inputType}"${step} ${columnEntry.type === 'date' ? '' : 'maxlength="500"'} required></label>`;
  }

  function updateBulkEditorValue() {
    const form = document.getElementById('atlas-v2-bulk-edit-form');
    const context = findBoard();
    const root = document.getElementById('atlas-v2-bulk-value');
    if (!form || !context || !root) return;
    root.innerHTML = bulkValueControl(context.board, form.elements.fieldId?.value, form.elements.operation?.value);
    refreshIcons(root);
  }

  function openBulkEditModal() {
    const context = findBoard();
    if (!context || !runtime.selectedItems.size) return;
    const columns = bulkEditableColumns(context.board);
    openModal({
      title: 'Editar registros em massa',
      subtitle: `${runtime.selectedItems.size} elemento(s) e subelemento(s) selecionado(s)`,
      body: `<form id="atlas-v2-bulk-edit-form" class="atlas-v2-form-grid"><label class="atlas-v2-field"><span>Campo</span><select name="fieldId"><option value="__name__">Nome do registro</option>${columns.map((entry) => `<option value="${attr(entry.id)}">${escapeHtml(entry.name)}</option>`).join('')}</select></label><label class="atlas-v2-field"><span>Ação</span><select name="operation"><option value="set">Definir valor</option><option value="clear">Limpar campo</option></select></label><div class="is-wide" id="atlas-v2-bulk-value">${bulkValueControl(context.board, '__name__', 'set')}</div><div class="atlas-v2-bulk-warning is-wide"><i data-lucide="info"></i><span>A alteração será aplicada somente aos registros selecionados, incluindo subelementos marcados.</span></div></form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-bulk-edit-form"><i data-lucide="check-check"></i>Aplicar em todos</button>`,
    });
  }

  function bulkNormalizedValue(columnEntry, rawValue, operation) {
    if (operation === 'clear') return columnEntry?.type === 'checkbox' ? false : '';
    if (columnEntry?.type === 'checkbox') return String(rawValue) === 'true';
    if (['number', 'currency', 'percentage'].includes(columnEntry?.type)) {
      const number = Number(String(rawValue).replace(',', '.'));
      return Number.isFinite(number) ? number : '';
    }
    return rawValue;
  }

  async function submitBulkEdit(form) {
    const context = findBoard();
    if (!context || !runtime.selectedItems.size) return;
    // Reverificar no envio, como fazem as edicoes de campo individuais. A guarda
    // do clique acontece ao abrir o modal; a permissao pode ter mudado (ou o
    // quadro ativo pode ser outro) entre abrir e confirmar.
    if (!requirePermission('edit', context, 'editar vários registros')) return;
    const data = new FormData(form);
    const fieldId = String(data.get('fieldId') || '');
    const operation = String(data.get('operation') || 'set');
    const rawValue = operation === 'clear' ? '' : data.get('value');
    const columnEntry = context.board.columns.find((entry) => entry.id === fieldId);
    const selected = flatBoardItems(context.board).filter((entry) => runtime.selectedItems.has(entry.item.id));
    if (!selected.length) return;
    if (fieldId !== '__name__' && !columnEntry) return toast('O campo selecionado não está mais disponível.', true);

    closeOverlay();
    setOperationProgress('Aplicando alteração em massa', 5, `0 de ${selected.length}`);
    selected.forEach((entry, index) => {
      if (fieldId === '__name__') {
        const previous = entry.item.name;
        entry.item.name = operation === 'clear' ? 'Item sem nome' : String(rawValue || '').trim() || 'Item sem nome';
        captureItemHistory(context.board, entry.item, '__name__', previous, entry.item.name, 'Nome atualizado em massa');
      } else {
        const previous = entry.item.values?.[fieldId];
        const next = bulkNormalizedValue(columnEntry, rawValue, operation);
        entry.item.values = entry.item.values || {};
        entry.item.values[fieldId] = next;
        captureItemHistory(context.board, entry.item, fieldId, previous, next, 'Campo atualizado em massa');
        runLocalAutomations('field_changed', context.board, entry.item, { columnId: fieldId, oldValue: previous, newValue: next });
      }
      setOperationProgress('Aplicando alteração em massa', 10 + ((index + 1) / selected.length) * 45, `${index + 1} de ${selected.length}`);
    });

    saveData('', { remote: false });
    render();
    try {
      if (runtime.remoteMode && runtime.authClient) {
        setOperationProgress('Sincronizando alteração em massa', 60, `${selected.length} registro(s)`);
        await persistRemoteItemsSoon(context, selected.map((entry) => entry.item.id));
      } else {
        saveData();
      }
      recordAudit('Edição em massa aplicada', { scope: 'board', count: selected.length, fieldId });
      setOperationProgress('Alteração concluída', 100, `${selected.length} registro(s) atualizados`);
      toast(`${selected.length} registro(s) atualizados em massa.`);
    } catch (error) {
      setOperationProgress('Sincronização pendente', 100, error.message || String(error));
    } finally {
      clearOperationProgress();
    }
  }

  function openBoard(boardId) {
    const context = findBoard(boardId);
    if (!context || !hasPermission('view', context)) return;
    const workspaceChanged = runtime.data.activeWorkspaceId !== context.workspace.id;
    runtime.page = 'board';
    runtime.data.activeWorkspaceId = context.workspace.id;
    runtime.data.activeBoardId = boardId;
    runtime.selectedItems.clear();
    runtime.expandedWorkSectors.clear();
    runtime.boardSearch = '';
    runtime.workFilter = '';
    const needsRemoteData = runtime.remoteMode
      && boardViewItemIds(context.board).some((itemId) => !runtime.loadedItemValues.has(String(itemId)));
    document.body.classList.toggle('atlas-v2-board-loading', needsRemoteData);
    const search = document.getElementById('atlas-v2-board-search');
    if (search) search.value = '';
    scheduleBootstrapCacheWrite(runtime.data, 4000);
    renderBoardRoute(context, { workspaceChanged });
    closeSidebar();
  }

  function addItem(groupId) {
    const context = findBoard();
    const groupEntry = context?.board.groups.find((entry) => entry.id === groupId) || context?.board.groups[0];
    if (!groupEntry) {
      openGroupModal(true);
      return;
    }
    const newItem = item(id('item'), groupEntry.id, 'Novo item', {});
    newItem.order = nextItemOrder(groupEntry.items);
    context.board.columns.forEach((columnEntry) => {
      newItem.values[columnEntry.id] = columnEntry.type === 'checkbox' ? false : '';
    });
    groupEntry.items.push(newItem);
    runtime.loadedItemValues.add(String(newItem.id));
    runLocalAutomations('item_created', context.board, newItem);
    if (context.board.activeView === 'works') runtime.workFilter = newItem.id;
    saveData('Item criado', { remote: false });
    persistRemoteItemsSoon(context, [newItem.id]);
    render();
    if (context.board.activeView === 'works') {
      requestAnimationFrame(() => openRenameWorkModal(newItem.id));
      return;
    }
    requestAnimationFrame(() => {
      const input = document.querySelector(`[data-item-name="${newItem.id}"]`);
      input?.focus();
      input?.select();
    });
  }

  function openRenameWorkModal(itemId = runtime.workFilter) {
    const context = findBoard();
    const found = context && findItem(context.board, itemId);
    if (!found || found.parent) return;
    openModal({
      title: 'Renomear obra',
      subtitle: found.item.name,
      body: `<form id="atlas-v2-rename-work-form"><input type="hidden" name="itemId" value="${attr(found.item.id)}"><label class="atlas-v2-field"><span>Nome da obra ou cidade</span><input name="name" value="${attr(found.item.name)}" maxlength="120" required autofocus></label></form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-rename-work-form"><i data-lucide="check"></i>Salvar nome</button>`,
    });
  }

  async function submitRenameWork(form) {
    const data = new FormData(form);
    const context = findBoard();
    const found = context && findItem(context.board, String(data.get('itemId') || ''));
    const name = String(data.get('name') || '').trim();
    if (!found || found.parent || !name) return;
    found.item.name = name;
    closeOverlay();
    if (runtime.remoteMode && runtime.authClient) {
      saveData('Obra renomeada', { remote: false });
      try { await enqueueRemoteItemPersistence(context, found.item.id); }
      catch (error) { runtime.remoteSyncQueued = true; scheduleRemoteSync(); toast(`Falha ao salvar o nome imediatamente: ${error.message || error}`, true); }
    } else {
      saveData('Obra renomeada');
    }
    render();
  }

  function openDeleteWorkModal(itemId = runtime.workFilter) {
    const context = findBoard();
    const found = context && findItem(context.board, itemId);
    if (!found || found.parent) return;
    const structureCount = found.item.subitems?.length || 0;
    openModal({
      title: 'Excluir obra',
      subtitle: found.item.name,
      body: `<div class="atlas-v2-confirm-card"><i data-lucide="triangle-alert"></i><div><strong>A obra completa será movida para a lixeira.</strong><p>${structureCount ? `${structureCount} ${structureCount === 1 ? 'estrutura vinculada acompanhará a obra' : 'estruturas vinculadas acompanharão a obra'}.` : 'A obra ainda não possui estruturas vinculadas.'}</p></div></div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-action="confirm-delete-work" data-item-id="${attr(found.item.id)}"><i data-lucide="trash-2"></i>Mover para lixeira</button>`,
    });
  }

  async function deleteWork(itemId) {
    const context = findBoard();
    const found = context && findItem(context.board, itemId);
    if (!found || found.parent) return;
    // Mesma razao de deleteItems: garantir que os subitens desta obra estejam
    // com os valores carregados antes de fotografar o item para a lixeira.
    if (runtime.remoteMode && runtime.authClient) {
      try { await hydrateBoardRemoteData(context.board.id, { itemIds: itemTreeIds(found.item, []) }); }
      catch (error) { toast(`Não foi possível confirmar todos os dados antes de excluir: ${error.message || error}`, true); return; }
    }
    const workName = found.item.name;
    const index = found.collection.indexOf(found.item);
    const trashEntry = addTrashEntry('item', workName, found.item, { boardId: context.board.id, groupId: found.group.id, parentItemId: '', index });
    if (!await stageTrashEntries([trashEntry])) return;
    try {
      await syncTrashEntriesWithDrive([trashEntry], 'delete');
    } catch (error) {
      await rollbackStagedTrash([trashEntry], `A obra não foi excluída porque o Drive não confirmou a remoção dos arquivos: ${error.message || error}`);
      return;
    }
    found.collection.splice(index, 1);
    runtime.selectedItems.delete(found.item.id);
    runtime.workFilter = '';
    const remoteDeleteIds = itemTreeIds(found.item, []);
    closeOverlay();
    saveData(`Obra ${workName} movida para a lixeira`, { remote: false });
    render();
    if (runtime.remoteMode && runtime.authClient) {
      try { await deleteRemoteItemsNow(remoteDeleteIds); }
      catch (error) { runtime.remoteSyncQueued = true; scheduleRemoteSync(); toast(`Falha ao excluir imediatamente: ${error.message || error}`, true); }
    }
  }

  function addSubitem(parentItemId, workSector = '', options = {}) {
    const context = findBoard();
    const found = context && findItem(context.board, parentItemId);
    if (!found) return;
    const isWorkElement = Boolean(options.workElement && workSector);
    const newSubitem = item(id(isWorkElement ? 'element' : 'subitem'), found.group.id, isWorkElement ? 'Novo elemento' : 'Novo subitem', {});
    context.board.columns.forEach((columnEntry) => {
      newSubitem.values[columnEntry.id] = columnEntry.type === 'checkbox' ? false : '';
    });
    const sectorColumnId = context.board.settings?.works_sector_column_id;
    if (workSector && sectorColumnId) newSubitem.values[sectorColumnId] = workSector;
    found.item.subitems = found.item.subitems || [];
    newSubitem.order = nextItemOrder(found.item.subitems);
    found.item.subitems.push(newSubitem);
    runtime.loadedItemValues.add(String(newSubitem.id));
    runLocalAutomations('item_created', context.board, newSubitem);
    found.item.subitemsExpanded = true;
    if (isWorkElement) {
      runtime.expandedWorkSectors.add(workSectorStateKey(context.board.id, found.item.id, workSector));
    }
    saveData(isWorkElement ? 'Elemento criado' : 'Subitem criado', { remote: false });
    persistRemoteItemsSoon(context, [newSubitem.id]);
    render();
    requestAnimationFrame(() => {
      const input = document.querySelector(`[data-item-name="${newSubitem.id}"]`);
      input?.focus();
      input?.select();
    });
  }

  function addWorkElement(workItemId, workSector) {
    addSubitem(workItemId, workSector, { workElement: true });
  }

  function itemTreeIds(itemEntry, result = []) {
    if (!itemEntry?.id) return result;
    result.push(itemEntry.id);
    (itemEntry.subitems || []).forEach((child) => itemTreeIds(child, result));
    return result;
  }

  async function deleteRemoteItemsNow(itemIds = []) {
    if (!runtime.authClient || !runtime.remoteMode || !itemIds.length) return;
    const ids = [...new Set(itemIds.filter(Boolean))];
    for (const itemId of ids) {
      const pending = runtime.itemPersistQueues.get(String(itemId));
      if (pending) { try { await pending; } catch (_) {} }
    }
    const { data: deletedRows, error } = await runtime.authClient.from('atlas_v2_items').delete().in('id', ids).select('id');
    if (error) throw error;
    if ((deletedRows || []).length !== ids.length) throw new Error(`O servidor confirmou apenas ${(deletedRows || []).length} de ${ids.length} exclusão(ões).`);
    if (runtime.remoteRows) {
      runtime.remoteRows.atlas_v2_items = (runtime.remoteRows.atlas_v2_items || []).filter((entry) => !ids.includes(entry.id));
      runtime.remoteRows.atlas_v2_item_values = (runtime.remoteRows.atlas_v2_item_values || []).filter((entry) => !ids.includes(entry.item_id));
      runtime.remoteRows.atlas_v2_attachments = (runtime.remoteRows.atlas_v2_attachments || []).filter((entry) => !ids.includes(entry.item_id));
    }
  }

  function openDeleteItemsModal(itemIds = []) {
    const context = findBoard();
    if (!context || !itemIds.length) return;
    const found = itemIds.map((itemId) => findItem(context.board, itemId)).filter(Boolean);
    if (!found.length) return;
    const subitemTotal = found.reduce((total, entry) => total + (entry.item.subitems?.length || 0), 0);
    const single = found.length === 1;
    const singleName = single ? found[0].item.name : '';
    const parts = [];
    if (subitemTotal) parts.push(`${subitemTotal} ${subitemTotal === 1 ? 'subitem acompanhará' : 'subitens acompanharão'} a exclusão`);
    openModal({
      title: single ? 'Excluir item' : `Excluir ${found.length} itens`,
      subtitle: single ? singleName : `${found.length} itens selecionados`,
      body: `<div class="atlas-v2-confirm-card"><i data-lucide="triangle-alert"></i><div><strong>${single ? 'O item será movido' : 'Os itens serão movidos'} para a lixeira.</strong><p>${parts.length ? escapeHtml(parts.join('; ')) + '.' : (single ? 'Este item ainda não possui subitens.' : 'Nenhum dos itens possui subitens.')}</p></div></div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-action="confirm-delete-items" data-item-ids="${attr(JSON.stringify(found.map((entry) => entry.item.id)))}"><i data-lucide="trash-2"></i>Mover para lixeira</button>`,
    });
  }

  async function deleteItems(itemIds) {
    const context = findBoard();
    if (!context) return;
    // Um admin pode bloquear o acesso de um usuario a uma obra especifica.
    // Numa exclusao em massa, so removemos as obras que o usuario realmente
    // tem permissao de excluir; as demais ficam de fora, com um aviso.
    const evaluatedIds = itemIds.map((itemId) => {
      const found = findItem(context.board, itemId);
      return { itemId, allowed: Boolean(found) && hasPermission('delete', { ...context, groupId: found.group.id, itemId }) };
    });
    const deniedCount = evaluatedIds.filter((entry) => !entry.allowed).length;
    itemIds = evaluatedIds.filter((entry) => entry.allowed).map((entry) => entry.itemId);
    if (deniedCount) toast(`Sem permissão para excluir ${deniedCount} obra(s); a ação foi aplicada apenas ao restante.`, true);
    if (!itemIds.length) return;
    const parentIds = new Set(itemIds.filter((itemId) => { const found = findItem(context.board, itemId); return found && !found.parent; }));
    // O retrato salvo na lixeira e montado a partir do que ja esta na memoria
    // do navegador. Subitens nunca abertos nesta sessao ficam com valores
    // vazios ({}) por conta do carregamento sob demanda - sem esta hidratacao,
    // o botao "Restaurar" da lixeira nunca traria de volta esses valores,
    // mesmo que o dado real continuasse existindo no Supabase ate o instante
    // da exclusao.
    if (runtime.remoteMode && runtime.authClient) {
      const idsToHydrate = itemIds.flatMap((itemId) => {
        const found = findItem(context.board, itemId);
        return found ? itemTreeIds(found.item, []) : [];
      });
      if (idsToHydrate.length) {
        try { await hydrateBoardRemoteData(context.board.id, { itemIds: idsToHydrate }); }
        catch (error) { toast(`Não foi possível confirmar todos os dados antes de excluir: ${error.message || error}`, true); return; }
      }
    }
    const remoteDeleteIds = [];
    const trashEntries = [];
    itemIds.forEach((itemId) => {
      const found = findItem(context.board, itemId);
      if (!found || (found.parent && parentIds.has(found.parent.id))) return;
      itemTreeIds(found.item, remoteDeleteIds);
      trashEntries.push(addTrashEntry('item', found.item.name, found.item, { boardId: context.board.id, groupId: found.group.id, parentItemId: found.parent?.id || '', index: found.collection.indexOf(found.item) }));
    });
    if (!await stageTrashEntries(trashEntries)) return;
    try {
      await syncTrashEntriesWithDrive(trashEntries, 'delete');
    } catch (error) {
      await rollbackStagedTrash(trashEntries, `Os itens não foram excluídos porque o Drive não confirmou a remoção dos arquivos: ${error.message || error}`);
      return;
    }
    context.board.groups.forEach((groupEntry) => {
      groupEntry.items = groupEntry.items.filter((entry) => !itemIds.includes(entry.id));
      groupEntry.items.forEach((entry) => {
        entry.subitems = (entry.subitems || []).filter((subitem) => !itemIds.includes(subitem.id));
      });
    });
    itemIds.forEach((itemId) => runtime.selectedItems.delete(itemId));
    saveData(itemIds.length === 1 ? 'Item movido para a lixeira' : 'Itens movidos para a lixeira', { remote: false });
    render();
    if (runtime.remoteMode && runtime.authClient) {
      try { await deleteRemoteItemsNow(remoteDeleteIds); }
      catch (error) { runtime.remoteSyncQueued = true; scheduleRemoteSync(); toast(`Falha ao excluir imediatamente: ${error.message || error}`, true); }
    }
  }

  function duplicateItemTree(source, parentId = null, root = true) {
    const copy = deepClone(source);
    copy.id = id(parentId ? 'subitem' : 'item');
    copy.parentId = parentId;
    if (root) copy.name = `${copy.name} - cópia`;
    copy.subitems = (source.subitems || []).map((child) => duplicateItemTree(child, copy.id, false));
    return copy;
  }

  function duplicateItem(itemId) {
    const context = findBoard();
    const found = context && findItem(context.board, itemId);
    if (!found) return;
    if (!requirePermission('create', { ...context, groupId: found.group.id, itemId }, 'duplicar esta obra')) return;
    const copy = duplicateItemTree(found.item, found.parent?.id || null, true);
    if (found.parent) copy.subitems = [];
    const index = found.collection.findIndex((entry) => entry.id === itemId);
    found.collection.splice(index + 1, 0, copy);
    const ids = itemTreeIds(copy, []);
    // Registrar as copias como "valores ja carregados", igual addItem/addSubitem
    // fazem. Sem isso a hidratacao remota disparada pelo render logo abaixo trata
    // os itens novos como nao carregados e zera os valores recem-copiados.
    ids.forEach((newId) => runtime.loadedItemValues.add(String(newId)));
    saveData('Item duplicado', { remote: false });
    persistRemoteItemsSoon(context, ids);
    render();
  }

  function crossBoardDestinationOptions(sourceBoardId, selectedBoardId = '', selectedGroupId = '') {
    const options = allBoards()
      .filter((entry) => entry.board.id !== sourceBoardId && hasPermission('create', entry) && entry.board.groups.length)
      .map((entry) => {
        const label = `${entry.workspace.name} · ${entry.module.name} · ${entry.board.name}`;
        const groups = entry.board.groups.map((groupEntry) => {
          const selected = entry.board.id === selectedBoardId && groupEntry.id === selectedGroupId ? 'selected' : '';
          return `<option value="${attr(`${entry.board.id}|${groupEntry.id}`)}" ${selected}>${escapeHtml(groupEntry.name)}</option>`;
        }).join('');
        return `<optgroup label="${attr(label)}">${groups}</optgroup>`;
      }).join('');
    return options || '<option value="" disabled>Nenhum outro quadro disponível</option>';
  }

  function moveItemTreeToBoardLocal(itemEntry, sourceBoard, targetBoard, targetGroup, columnMap) {
    const remappedValues = {};
    Object.entries(itemEntry.values || {}).forEach(([columnId, value]) => {
      const targetColumnId = columnMap.get(columnId);
      if (targetColumnId) remappedValues[targetColumnId] = value;
    });
    itemEntry.values = remappedValues;
    itemEntry.groupId = targetGroup.id;
    (itemEntry.subitems || []).forEach((child) => moveItemTreeToBoardLocal(child, sourceBoard, targetBoard, targetGroup, columnMap));
  }

  function isolatedMoveSubitems(boardEntry, itemIds) {
    const selected = new Set((itemIds || []).map(String));
    return (itemIds || []).map((itemId) => findItem(boardEntry, itemId)).filter((found) => {
      if (!found?.parent) return false;
      let parent = found.parent;
      while (parent) {
        if (selected.has(String(parent.id))) return false;
        parent = findItem(boardEntry, parent.id)?.parent || null;
      }
      return true;
    });
  }

  function validateMoveSelection(boardEntry, itemIds) {
    const isolated = isolatedMoveSubitems(boardEntry, itemIds);
    if (!isolated.length) return true;
    toast('Para mover um subelemento, selecione também o elemento principal.', true);
    return false;
  }

  function moveItemsBetweenBoardsLocal(itemIds, targetContext, targetGroupId, createMissingColumns = true) {
    const sourceContext = findBoard();
    const targetGroup = targetContext?.board.groups.find((entry) => entry.id === targetGroupId);
    if (!sourceContext || !targetContext || !targetGroup) return 0;
    if (!validateMoveSelection(sourceContext.board, itemIds)) return 0;
    const selected = new Set(itemIds.map(String));
    const roots = itemIds.map((itemId) => findItem(sourceContext.board, itemId)).filter(Boolean).filter((found) => {
      let parent = found.parent;
      while (parent) {
        if (selected.has(String(parent.id))) return false;
        parent = findItem(sourceContext.board, parent.id)?.parent || null;
      }
      return true;
    });
    const columnMap = new Map();
    const usedTargets = new Set();
    sourceContext.board.columns.forEach((sourceColumn) => {
      let targetColumn = targetContext.board.columns.find((candidate) => !usedTargets.has(candidate.id)
        && candidate.type === sourceColumn.type
        && normalizedStatusLabel(candidate.name) === normalizedStatusLabel(sourceColumn.name));
      if (!targetColumn && createMissingColumns && hasPermission('configure', targetContext)) {
        targetColumn = { ...deepClone(sourceColumn), id: id('column'), order: targetContext.board.columns.length, required: false };
        targetContext.board.columns.push(targetColumn);
      }
      if (targetColumn) {
        if (['status', 'select'].includes(sourceColumn.type)) {
          targetColumn.options = targetColumn.options || [];
          (sourceColumn.options || []).forEach((sourceOption) => {
            const sourceLabel = typeof sourceOption === 'string' ? sourceOption : sourceOption.label;
            const alreadyExists = targetColumn.options.some((targetOption) => {
              const targetLabel = typeof targetOption === 'string' ? targetOption : targetOption.label;
              return normalizedStatusLabel(targetLabel) === normalizedStatusLabel(sourceLabel);
            });
            if (!alreadyExists) targetColumn.options.push(deepClone(sourceOption));
          });
        }
        usedTargets.add(targetColumn.id);
        columnMap.set(sourceColumn.id, targetColumn.id);
      }
    });
    roots.forEach((found) => {
      found.collection.splice(found.collection.indexOf(found.item), 1);
      found.item.parentId = null;
      found.item.order = nextItemOrder(targetGroup.items);
      moveItemTreeToBoardLocal(found.item, sourceContext.board, targetContext.board, targetGroup, columnMap);
      targetGroup.items.push(found.item);
    });
    return roots.length;
  }

  function openCrossBoardMoveModal(itemIds = [...runtime.selectedItems]) {
    const context = findBoard();
    const ids = [...new Set(itemIds.filter(Boolean))];
    if (!context || !ids.length) return;
    if (!validateMoveSelection(context.board, ids)) return;
    const options = crossBoardDestinationOptions(context.board.id);
    if (!allBoards().some((entry) => entry.board.id !== context.board.id && hasPermission('create', entry) && entry.board.groups.length)) {
      toast('Nenhum outro quadro disponível para receber estes elementos.', true);
      return;
    }
    runtime.crossBoardMoveItemIds = ids;
    const names = ids.map((itemId) => findItem(context.board, itemId)?.item?.name).filter(Boolean);
    openModal({
      title: 'Mover para outro módulo',
      subtitle: `${ids.length} elemento(s) selecionado(s)`,
      body: `<form id="atlas-v2-cross-board-move-form" class="atlas-v2-form-grid">
        <label class="atlas-v2-field is-wide"><span>Quadro e setor de destino</span><select name="destination" required>${options}</select><small>O elemento e todos os seus subelementos serão movidos juntos.</small></label>
        <label class="atlas-v2-check-row is-wide"><input type="checkbox" name="createMissingColumns" checked><span><strong>Criar campos ausentes automaticamente</strong><small>Campos com o mesmo nome e tipo serão reaproveitados; os demais serão criados sem perder os dados.</small></span></label>
        <label class="atlas-v2-check-row is-wide"><input type="checkbox" name="openDestination" checked><span><strong>Abrir o quadro de destino após mover</strong><small>Você confere imediatamente o resultado da movimentação.</small></span></label>
        <div class="atlas-v2-selection-preview is-wide"><i data-lucide="arrow-right-left"></i><span><strong>${ids.length} elemento(s)</strong><small>${escapeHtml(names.slice(0, 4).join(' · '))}${names.length > 4 ? ` · +${names.length - 4}` : ''}</small></span></div>
      </form>`,
      actions: '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-cross-board-move-form"><i data-lucide="arrow-right-left"></i>Mover elementos</button>',
    });
  }

  async function submitCrossBoardMove(form) {
    const sourceContext = findBoard();
    const data = new FormData(form);
    const [targetBoardId, targetGroupId] = String(data.get('destination') || '').split('|');
    const itemIds = [...new Set(runtime.crossBoardMoveItemIds || [])];
    const targetContext = findBoard(targetBoardId);
    if (!sourceContext || !targetContext || !targetGroupId || !itemIds.length) {
      toast('Destino ou elementos inválidos.', true);
      return;
    }
    if (!validateMoveSelection(sourceContext.board, itemIds)) return;
    if (!requirePermission('create', targetContext, 'mover elementos para este quadro')) return;
    const openDestination = Boolean(data.get('openDestination'));
    const createMissingColumns = Boolean(data.get('createMissingColumns'));
    const submit = form.closest('.atlas-v2-overlay')?.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    setOperationProgress('Movendo elementos', 8, 'Validando quadros e permissões');
    try {
      if (runtime.remoteMode && runtime.authClient) {
        await Promise.allSettled([...runtime.itemPersistQueues.values()]);
        setOperationProgress('Movendo elementos', 35, 'Associando campos e subelementos');
        const { data: result, error } = await runtime.authClient.rpc('atlas_v2_move_items_between_boards', {
          p_item_ids: itemIds,
          p_target_board_id: targetBoardId,
          p_target_group_id: targetGroupId,
          p_create_missing_columns: createMissingColumns,
        });
        if (error) throw error;
        if (openDestination) {
          runtime.data.activeWorkspaceId = targetContext.workspace.id;
          runtime.data.activeBoardId = targetBoardId;
        }
        runtime.selectedItems.clear();
        runtime.crossBoardMoveItemIds = [];
        closeOverlay();
        setOperationProgress('Atualizando quadros', 78, `${Number(result?.moved || itemIds.length)} elemento(s) movido(s)`);
        await refreshRemoteApplication(runtime.authProfile, runtime.authSession?.user, { full: false, silent: true });
        if (openDestination) await hydrateBoardRemoteData(targetBoardId, { force: true, renderAfter: true });
      } else {
        const moved = moveItemsBetweenBoardsLocal(itemIds, targetContext, targetGroupId, createMissingColumns);
        if (openDestination) {
          runtime.data.activeWorkspaceId = targetContext.workspace.id;
          runtime.data.activeBoardId = targetBoardId;
        }
        runtime.selectedItems.clear();
        runtime.crossBoardMoveItemIds = [];
        closeOverlay();
        saveData(`${moved} elemento(s) movido(s) entre quadros`, { scope: 'board' });
        render();
      }
      setOperationProgress('Movimentação concluída', 100, 'Dados, anexos e conversas preservados');
      toast('Elementos movidos para o novo módulo.');
    } catch (error) {
      console.error('Atlas V2.4: falha ao mover elementos entre quadros.', error);
      toast(`Não foi possível mover: ${error.message || error}`, true);
    } finally {
      if (submit) submit.disabled = false;
      clearOperationProgress();
    }
  }

  function moveItemsWithinBoardLocal(itemIds, targetGroupId) {
    const context = findBoard();
    const target = context?.board.groups.find((entry) => entry.id === targetGroupId);
    if (!target) return;
    if (!validateMoveSelection(context.board, itemIds)) return;
    itemIds = itemIds.filter((itemId) => {
      const found = findItem(context.board, itemId);
      return found && hasPermission('edit', { ...context, groupId: found.group.id, itemId });
    });
    if (!itemIds.length) return;
    const moving = [];
    context.board.groups.forEach((groupEntry) => {
      groupEntry.items = groupEntry.items.filter((entry) => {
        if (itemIds.includes(entry.id)) {
          moving.push(entry);
          return false;
        }
        return true;
      });
      groupEntry.items.forEach((entry) => {
        entry.subitems = (entry.subitems || []).filter((subitem) => {
          if (itemIds.includes(subitem.id)) {
            moving.push(subitem);
            return false;
          }
          return true;
        });
      });
    });
    moving.forEach((entry) => {
      const oldGroupId = entry.groupId;
      entry.groupId = targetGroupId;
      // Recalcular a ordem no grupo de destino. Mantendo a ordem antiga, um item
      // com valor menor que os existentes "pulava" para o topo na proxima
      // ordenacao vinda do realtime, em vez de ficar onde foi solto.
      entry.parentId = null;
      entry.order = nextItemOrder(target.items);
      target.items.push(entry);
      runLocalAutomations('group_changed', context.board, entry, { oldGroupId, newGroupId: targetGroupId });
    });
    runtime.selectedItems.clear();
    saveData('Itens movidos', { remote: false });
    persistRemoteItemsSoon(context, moving.map((entry) => entry.id));
    render();
  }

  async function moveItems(itemIds, targetGroupId) {
    const context = findBoard();
    const target = context?.board.groups.find((entry) => entry.id === targetGroupId);
    if (!context || !target) return;
    if (!runtime.remoteMode || !runtime.authClient) {
      moveItemsWithinBoardLocal(itemIds, targetGroupId);
      return;
    }
    const allowed = itemIds.filter((itemId) => {
      const found = findItem(context.board, itemId);
      return found && hasPermission('edit', { ...context, groupId: found.group.id, itemId });
    });
    if (!allowed.length) return;
    if (!validateMoveSelection(context.board, allowed)) return;
    setOperationProgress('Movendo elementos', 20, `Destino: ${target.name}`);
    try {
      await Promise.allSettled([...runtime.itemPersistQueues.values()]);
      const { error } = await runtime.authClient.rpc('atlas_v2_move_items_between_boards', {
        p_item_ids: allowed,
        p_target_board_id: context.board.id,
        p_target_group_id: targetGroupId,
        p_create_missing_columns: false,
      });
      if (error) throw error;
      runtime.selectedItems.clear();
      setOperationProgress('Movimentação concluída', 100, `${allowed.length} elemento(s)`);
      await refreshRemoteApplication(runtime.authProfile, runtime.authSession?.user, { full: false, silent: true });
    } catch (error) {
      console.error('Atlas V2.4: falha ao mover elementos.', error);
      toast(`Não foi possível mover: ${error.message || error}`, true);
    } finally {
      clearOperationProgress();
    }
  }

  function openCreateModal(defaultType = 'board') {
    if (!requirePermission('configure', findBoard(), 'criar estruturas')) return;
    const workspace = currentWorkspace();
    const moduleOptions = workspace.modules.map((entry) => `<option value="${attr(entry.id)}">${escapeHtml(entry.name)}</option>`).join('');
    const customTemplates = (runtime.data.templates || []).map((entry) => `<option value="custom:${attr(entry.id)}">${escapeHtml(entry.name)}</option>`).join('');
    const availableStorage = (runtime.data.storageConnections || []).filter((entry) => entry.status !== 'disabled');
    const storageOptions = availableStorage.map((entry) => `<option value="${attr(entry.id)}">${escapeHtml(entry.name)} · ${escapeHtml(entry.sector)} · ${escapeHtml(storageStatusLabel(entry.status))}</option>`).join('');
    const defaultStorageMode = availableStorage.length ? 'existing' : 'new';
    openModal({
      title: 'Criar no Atlas',
      subtitle: 'Monte a estrutura sem código ou SQL.',
      body: `<form id="atlas-v2-create-form" class="atlas-v2-form-grid">
        <div class="atlas-v2-field is-wide"><span>O que deseja criar?</span><div class="atlas-v2-choice-grid">
          ${choice('create-type', 'workspace', 'layout-grid', 'Área', defaultType === 'workspace')}
          ${choice('create-type', 'module', 'boxes', 'Módulo', defaultType === 'module')}
          ${choice('create-type', 'submodule', 'folder-tree', 'Submódulo', defaultType === 'submodule')}
          ${choice('create-type', 'board', 'table-2', 'Quadro', defaultType === 'board')}
        </div></div>
        <label class="atlas-v2-field is-wide"><span>Nome</span><input name="name" maxlength="80" required autofocus placeholder="Ex.: Planejamento de Rede"></label>
        <label class="atlas-v2-field" data-create-parent="module"><span>Área de trabalho</span><select name="workspaceId">${runtime.data.workspaces.map((entry) => `<option value="${attr(entry.id)}" ${entry.id === workspace.id ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select></label>
        <label class="atlas-v2-field" data-create-parent="submodule"><span>Módulo principal</span><select name="parentModuleId">${moduleOptions}</select></label>
        <label class="atlas-v2-field" data-create-parent="board"><span>Módulo</span><select name="moduleId">${moduleOptions}</select></label>
        <label class="atlas-v2-field" data-create-board><span>Modelo inicial</span><select name="template"><option value="blank">Em branco</option><option value="project">Gestão de projetos</option><option value="maintenance">Manutenção operacional</option><option value="field-inspection">Inspeção em campo</option><option value="sla-service">Chamados e SLA</option><option value="portfolio">Portfólio executivo</option>${customTemplates}</select></label>
        <label class="atlas-v2-field" data-create-access><span>Acesso</span><select name="access">${Object.entries(ACCESS).map(([key, value]) => `<option value="${key}">${escapeHtml(value.label)}</option>`).join('')}</select></label>
        <label class="atlas-v2-field is-wide" data-create-board><span>Descrição</span><textarea name="description" maxlength="180" placeholder="Objetivo deste quadro"></textarea></label>
        <section class="atlas-v2-storage-setup is-wide" data-create-storage>
          <header><span><i data-lucide="hard-drive"></i></span><div><strong>Armazenamento da área</strong><small>Escolha uma conta setorial já conectada ou cadastre um novo Google Drive.</small></div></header>
          <div class="atlas-v2-storage-choice-grid">
            ${choice('storage-mode', 'existing', 'database', 'Usar Drive existente', defaultStorageMode === 'existing')}
            ${choice('storage-mode', 'new', 'cloud-cog', 'Cadastrar novo Drive', defaultStorageMode === 'new')}
          </div>
          <label class="atlas-v2-field" data-storage-mode="existing"><span>Conexão disponível</span><select name="driveExistingId"><option value="">Selecione um Drive</option>${storageOptions}</select></label>
          <div class="atlas-v2-storage-new-fields" data-storage-mode="new">
            <label class="atlas-v2-field is-wide"><span>Tipo de armazenamento</span><select name="driveType">${Object.entries(STORAGE_TYPES).map(([key, value]) => `<option value="${key}">${escapeHtml(value.label)}</option>`).join('')}</select></label>
            <label class="atlas-v2-field"><span>Nome da conexão</span><input name="driveName" maxlength="70" placeholder="Ex.: Drive do PMO"></label>
            <label class="atlas-v2-field"><span>Setor responsável</span><input name="driveSector" maxlength="70" placeholder="Ex.: PMO"></label>
            <label class="atlas-v2-field" data-storage-field="email"><span>Conta Google do setor</span><input name="driveEmail" type="email" placeholder="setor@empresa.com"></label>
            <label class="atlas-v2-field is-wide"><span data-storage-label="root">${escapeHtml(STORAGE_TYPES[DEFAULT_STORAGE_TYPE].rootLabel)}</span><input name="driveFolderUrl" placeholder="${attr(STORAGE_TYPES[DEFAULT_STORAGE_TYPE].rootPlaceholder)}"></label>
            <label class="atlas-v2-field is-wide"><span data-storage-label="url">${escapeHtml(STORAGE_TYPES[DEFAULT_STORAGE_TYPE].urlLabel)}</span><input name="driveAppScriptUrl" type="url" placeholder="${attr(STORAGE_TYPES[DEFAULT_STORAGE_TYPE].urlPlaceholder)}"></label>
            <input name="driveVerified" type="hidden" value="0">
            <input name="connectorVersion" type="hidden" value="">
            <div class="atlas-v2-storage-test is-wide"><button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="test-create-storage"><i data-lucide="plug-zap"></i>Testar conexão</button><span id="atlas-v2-create-storage-status">O teste confirma o Apps Script e o acesso à pasta.</span></div>
          </div>
        </section>
      </form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-create-form"><i data-lucide="plus"></i>Criar</button>`,
    });
    updateCreateFields(defaultType);
    updateStorageFields(defaultStorageMode, defaultType === 'workspace');
  }

  function choice(name, value, icon, label, checked) {
    return `<label class="atlas-v2-choice"><input type="radio" name="${attr(name)}" value="${attr(value)}" ${checked ? 'checked' : ''}><span><i data-lucide="${attr(icon)}"></i><b>${escapeHtml(label)}</b></span></label>`;
  }

  function updateCreateFields(type) {
    document.querySelectorAll('[data-create-parent="module"]').forEach((entry) => { entry.hidden = type !== 'module'; });
    document.querySelectorAll('[data-create-parent="submodule"]').forEach((entry) => { entry.hidden = type !== 'submodule'; });
    document.querySelectorAll('[data-create-parent="board"]').forEach((entry) => { entry.hidden = type !== 'board'; });
    document.querySelectorAll('[data-create-board]').forEach((entry) => { entry.hidden = type !== 'board'; });
    document.querySelectorAll('[data-create-access]').forEach((entry) => { entry.hidden = type === 'module' || type === 'submodule'; });
    document.querySelectorAll('[data-create-storage]').forEach((entry) => { entry.hidden = type !== 'workspace'; });
    const selectedMode = document.querySelector('input[name="storage-mode"]:checked')?.value || 'existing';
    updateStorageFields(selectedMode, type === 'workspace');
  }

  function updateStorageFields(mode, enabled = true) {
    document.querySelectorAll('[data-storage-mode]').forEach((entry) => {
      const active = enabled && entry.dataset.storageMode === mode;
      entry.hidden = !active;
      entry.querySelectorAll('input, select, button').forEach((control) => { control.disabled = !active; });
    });
    const existing = document.querySelector('[name="driveExistingId"]');
    if (existing) existing.required = enabled && mode === 'existing';
    ['driveName', 'driveSector', 'driveEmail', 'driveFolderUrl', 'driveAppScriptUrl'].forEach((name) => {
      const control = document.querySelector(`[name="${name}"]`);
      if (control) control.required = enabled && mode === 'new';
    });
  }

  function setStorageTestStatus(message, state = '') {
    const status = document.getElementById('atlas-v2-create-storage-status');
    if (!status) return;
    status.className = state ? `is-${state}` : '';
    status.textContent = message;
  }

  async function testStorageEndpoint(appScriptUrl, folderId, expectedModule = '') {
    const authToken = await currentAuthAccessToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(appScriptUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'testconnection',
          rootFolderId: folderId,
          authToken,
          module: expectedModule,
        }),
        redirect: 'follow',
        signal: controller.signal,
      });
      const payload = await response.json();
      const expected = normalizedStorageModule(expectedModule);
      const actual = normalizedStorageModule(payload?.module);
      const valid = Boolean(response.ok && payload?.success && payload?.writable && payload?.folderId === folderId && (!expected || !actual || expected === actual));
      if (!valid) throw new Error(payload?.error || 'A pasta não foi validada para gravação.');
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('O Apps Script não respondeu dentro do tempo esperado.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function testCreateStorageConnection() {
    const form = document.getElementById('atlas-v2-create-form');
    if (!form) return;
    // Mesmo token de requisicao usado em testAdminStorageConnection: descarta
    // a resposta desta chamada se um clique mais recente ja tiver comecado
    // outro teste, evitando que um teste antigo e lento reative
    // driveVerified depois que um teste mais novo ja tinha falhado.
    const requestToken = (form._atlasStorageTestToken = (form._atlasStorageTestToken || 0) + 1);
    const draft = storageDraftFromForm(form);
    const error = validateStorageDraft(draft);
    form.elements.driveVerified.value = '0';
    if (error) {
      setStorageTestStatus(error, 'error');
      return;
    }
    setStorageTestStatus('Testando acesso de escrita na pasta...', 'testing');
    try {
      const result = await testStorageEndpoint(draft.appScriptUrl, draft.folderId, storageModule(draft));
      if (form._atlasStorageTestToken !== requestToken) return;
      form.elements.driveVerified.value = '1';
      form.elements.connectorVersion.value = String(result.connectorVersion || result.version || '').trim();
      setStorageTestStatus(result.legacy ? 'Conector V1.4 compatível validado para este setor.' : `Conexão validada${result.folderName ? `: ${result.folderName}` : ''}.`, 'success');
    } catch (error) {
      if (form._atlasStorageTestToken !== requestToken) return;
      setStorageTestStatus(error.message || 'Falha ao validar a conexão.', 'error');
    }
  }

  function submitCreate(form) {
    if (!requirePermission('configure', findBoard(), 'criar estruturas')) return;
    const data = new FormData(form);
    const type = data.get('create-type') || 'board';
    const name = String(data.get('name') || '').trim();
    if (!name) return;
    if (type === 'workspace') {
      const storageMode = data.get('storage-mode') || 'existing';
      let storageConnectionId = '';
      if (storageMode === 'existing') {
        const selected = storageConnection(String(data.get('driveExistingId') || ''));
        if (!selected || selected.status === 'disabled') {
          toast('Selecione uma conexão de Drive disponível.', true);
          return;
        }
        storageConnectionId = selected.id;
      } else {
        const draft = storageDraftFromForm(form);
        const storageError = validateStorageDraft(draft);
        if (storageError) {
          setStorageTestStatus(storageError, 'error');
          return;
        }
        if (data.get('driveVerified') !== '1') {
          setStorageTestStatus('Teste a conexão antes de criar a área.', 'error');
          return;
        }
        const connection = {
          id: id('storage'),
          ...draft,
          status: 'connected',
          module: 'custom',
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        runtime.data.storageConnections.push(connection);
        storageConnectionId = connection.id;
      }
      const workspace = { id: id('ws'), name, color: '#7554a3', access: data.get('access') || 'main', storageConnectionId, modules: [] };
      runtime.data.workspaces.push(workspace);
      runtime.data.activeWorkspaceId = workspace.id;
      const initialModule = { id: id('module'), name: 'Geral', icon: 'boxes', open: false, storageConnectionId, boards: [] };
      workspace.modules.push(initialModule);
      const initialBoard = createBoardFromTemplate('Primeiro quadro', 'blank', data.get('access') || 'main', '', storageConnectionId);
      initialModule.boards.push(initialBoard);
      runtime.data.activeBoardId = initialBoard.id;
    } else if (type === 'module') {
      const workspace = runtime.data.workspaces.find((entry) => entry.id === data.get('workspaceId')) || currentWorkspace();
      const workspaceConnectionId = workspace.storageConnectionId || null;
      const newModule = { id: id('module'), name, icon: 'boxes', open: false, storageConnectionId: workspaceConnectionId, boards: [] };
      workspace.modules.push(newModule);
      const initialBoard = createBoardFromTemplate('Primeiro quadro', 'blank', 'main', '', workspaceConnectionId);
      newModule.boards.push(initialBoard);
      runtime.data.activeWorkspaceId = workspace.id;
      runtime.data.activeBoardId = initialBoard.id;
    } else if (type === 'submodule') {
      const workspace = currentWorkspace();
      const parent = workspace.modules.find((entry) => entry.id === data.get('parentModuleId')) || workspace.modules[0];
      const inheritedStorageConnectionId = parent?.storageConnectionId || workspace.storageConnectionId || null;
      const newModule = { id: id('module'), parentId: parent?.id || null, name, icon: 'folder-tree', open: false, storageConnectionId: inheritedStorageConnectionId, boards: [] };
      workspace.modules.push(newModule);
      const initialBoard = createBoardFromTemplate('Primeiro quadro', 'blank', 'main', '', inheritedStorageConnectionId);
      newModule.boards.push(initialBoard);
      if (parent) parent.open = true;
      runtime.data.activeWorkspaceId = workspace.id;
      runtime.data.activeBoardId = initialBoard.id;
    } else {
      const workspace = currentWorkspace();
      const module = workspace.modules.find((entry) => entry.id === data.get('moduleId')) || workspace.modules[0];
      const inheritedStorageConnectionId = module?.storageConnectionId || workspace.storageConnectionId || null;
      const newBoard = createBoardFromTemplate(name, data.get('template') || 'blank', data.get('access') || 'main', String(data.get('description') || ''), inheritedStorageConnectionId);
      module.boards.push(newBoard);
      module.open = true;
      runtime.data.activeBoardId = newBoard.id;
    }
    closeOverlay();
    saveData(`${type === 'workspace' ? 'Área' : type === 'module' ? 'Módulo' : type === 'submodule' ? 'Submódulo' : 'Quadro'} criado`);
    render();
  }

  function createBoardFromTemplate(name, template, access, description, storageConnectionId = null) {
    const boardId = id('board');
    if (String(template).startsWith('custom:')) {
      const saved = runtime.data.templates.find((entry) => entry.id === String(template).slice(7));
      if (saved) {
        const columnIds = new Map();
        const groupIds = new Map();
        const columns = deepClone(saved.columns || []).map((entry) => {
          const nextId = id('col');
          columnIds.set(entry.id, nextId);
          return { ...entry, id: nextId };
        });
        const groups = (saved.groups || []).map((entry) => {
          const nextId = id('group');
          groupIds.set(entry.id, nextId);
          return group(nextId, entry.name, entry.color || '#0f6cbd', []);
        });
        const created = board({ id: boardId, name, description, access, icon: saved.icon || 'layout-template', views: deepClone(saved.views || ['table']), settings: deepClone(saved.settings || {}), columns, groups, storageConnectionId });
        created.settings.slaDateColumnId = columnIds.get(created.settings.slaDateColumnId) || created.settings.slaDateColumnId || '';
        created.settings.dashboardWidgets = (created.settings.dashboardWidgets || []).map((entry) => ({ ...entry, id: id('widget'), columnId: columnIds.get(entry.columnId) || entry.columnId || '' }));
        (saved.automations || []).forEach((automation) => runtime.data.automations.push({
          ...deepClone(automation),
          id: id('automation'),
          boardId,
          active: false,
          trigger: { ...(automation.trigger || {}), columnId: columnIds.get(automation.trigger?.columnId) || automation.trigger?.columnId, groupId: groupIds.get(automation.trigger?.groupId) || automation.trigger?.groupId },
          conditions: (automation.conditions || []).map((entry) => ({ ...entry, columnId: columnIds.get(entry.columnId) || entry.columnId })),
          actions: (automation.actions || []).map((entry) => ({ ...entry, columnId: columnIds.get(entry.columnId) || entry.columnId, groupId: groupIds.get(entry.groupId) || entry.groupId })),
        }));
        return created;
      }
    }
    if (template === 'project') {
      return board({
        id: boardId, name, description, access, icon: 'folder-kanban', columns: [
          column(id('col'), 'Status', 'status', { options: STATUS_OPTIONS }),
          column(id('col'), 'Responsável', 'person'),
          column(id('col'), 'Data', 'date'),
          column(id('col'), 'Progresso', 'percentage'),
        ], groups: [group(id('group'), 'Planejamento', '#7554a3', []), group(id('group'), 'Em execução', '#0f6cbd', []), group(id('group'), 'Concluído', '#168a5b', [])], storageConnectionId,
      });
    }
    if (template === 'maintenance') {
      return board({
        id: boardId, name, description, access, icon: 'wrench', columns: [
          column(id('col'), 'Status', 'status', { options: STATUS_OPTIONS }),
          column(id('col'), 'Prioridade', 'select', { options: PRIORITY_OPTIONS }),
          column(id('col'), 'Responsável', 'person'),
          column(id('col'), 'Abertura', 'date'),
          column(id('col'), 'Local', 'location'),
        ], groups: [group(id('group'), 'Abertas', '#c33d4b', []), group(id('group'), 'Em execução', '#d68a1f', []), group(id('group'), 'Concluídas', '#168a5b', [])], storageConnectionId,
      });
    }
    if (template === 'field-inspection') {
      const status = column(id('col'), 'Status', 'status', { options: STATUS_OPTIONS });
      const date = column(id('col'), 'Data da visita', 'date');
      return board({
        id: boardId,
        name,
        description,
        access,
        icon: 'map-pinned',
        views: ['table', 'calendar', 'dashboard'],
        settings: { slaDateColumnId: date.id, slaWarningDays: 1 },
        columns: [
          status,
          column(id('col'), 'Responsável', 'person'),
          date,
          column(id('col'), 'Geolocalização', 'location'),
          column(id('col'), 'Imagens', 'image'),
          column(id('col'), 'Arquivos', 'file'),
        ],
        groups: [group(id('group'), 'Programadas', '#7554a3', []), group(id('group'), 'Em campo', '#d68a1f', []), group(id('group'), 'Finalizadas', '#168a5b', [])], storageConnectionId,
      });
    }
    if (template === 'sla-service') {
      const due = column(id('col'), 'Prazo', 'date');
      return board({
        id: boardId,
        name,
        description,
        access,
        icon: 'timer-reset',
        views: ['table', 'kanban', 'calendar', 'dashboard'],
        settings: { slaDateColumnId: due.id, slaWarningDays: 2 },
        columns: [
          column(id('col'), 'Status', 'status', { options: STATUS_OPTIONS }),
          column(id('col'), 'Prioridade', 'select', { options: PRIORITY_OPTIONS }),
          column(id('col'), 'Responsável', 'person'),
          column(id('col'), 'Abertura', 'date'),
          due,
          column(id('col'), 'Evidências', 'image'),
        ],
        groups: [group(id('group'), 'Entrada', '#7554a3', []), group(id('group'), 'Atendimento', '#0f6cbd', []), group(id('group'), 'Bloqueados', '#bf4652', []), group(id('group'), 'Resolvidos', '#168a5b', [])], storageConnectionId,
      });
    }
    if (template === 'portfolio') {
      const budget = column(id('col'), 'Orçamento', 'currency');
      const realized = column(id('col'), 'Realizado', 'currency');
      const variance = column(id('col'), 'Variação', 'formula', { formula: `{${budget.name}} - {${realized.name}}`, format: 'currency', decimals: 2 });
      return board({
        id: boardId,
        name,
        description,
        access,
        icon: 'chart-spline',
        views: ['table', 'gantt', 'calendar', 'dashboard'],
        columns: [
          column(id('col'), 'Status', 'status', { options: STATUS_OPTIONS }),
          column(id('col'), 'Responsável', 'person'),
          column(id('col'), 'Período', 'period'),
          budget,
          realized,
          variance,
        ],
        groups: [group(id('group'), 'Planejado', '#7554a3', []), group(id('group'), 'Em execução', '#0f6cbd', []), group(id('group'), 'Concluído', '#168a5b', [])], storageConnectionId,
      });
    }
    return board({
      id: boardId, name, description, access, icon: 'table-2', columns: [column(id('col'), 'Status', 'status', { options: STATUS_OPTIONS })], groups: [group(id('group'), 'Novo grupo', '#0f6cbd', [])], storageConnectionId,
    });
  }

  function openGroupModal(create = false, groupId = '') {
    const context = findBoard();
    const existing = context?.board.groups.find((entry) => entry.id === groupId);
    openModal({
      title: existing ? 'Editar grupo' : 'Novo grupo',
      subtitle: 'Organize os itens por etapa, equipe ou categoria.',
      body: `<form id="atlas-v2-group-form" class="atlas-v2-form-grid"><input type="hidden" name="groupId" value="${attr(groupId)}"><label class="atlas-v2-field is-wide"><span>Nome do grupo</span><input name="name" maxlength="80" required autofocus value="${attr(existing?.name || '')}" placeholder="Ex.: Em execução"></label><label class="atlas-v2-field"><span>Cor</span><input name="color" type="color" value="${attr(existing?.color || '#0f6cbd')}"></label></form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-group-form">Salvar</button>`,
    });
  }

  function submitGroup(form) {
    const context = findBoard();
    if (!context) return;
    const data = new FormData(form);
    const groupId = data.get('groupId');
    const name = String(data.get('name') || '').trim();
    const color = String(data.get('color') || '#0f6cbd');
    if (groupId) {
      const existing = context.board.groups.find((entry) => entry.id === groupId);
      if (existing) Object.assign(existing, { name, color });
    } else {
      context.board.groups.push(group(id('group'), name, color, []));
    }
    closeOverlay();
    saveData(groupId ? 'Grupo atualizado' : 'Grupo criado');
    render();
  }

  function openColumnModal(columnId = '') {
    const context = findBoard();
    const existing = context?.board.columns.find((entry) => entry.id === columnId);
    const formulaHelp = context?.board.columns
      .filter((entry) => entry.id !== columnId && ['number', 'percentage', 'currency'].includes(entry.type))
      .map((entry) => `{${entry.name}}`)
      .join(', ');
    openModal({
      title: existing ? 'Editar coluna' : 'Nova coluna',
      subtitle: 'Escolha como o dado será preenchido e exibido.',
      body: `<form id="atlas-v2-column-form" class="atlas-v2-form-grid"><input type="hidden" name="columnId" value="${attr(columnId)}"><label class="atlas-v2-field is-wide"><span>Nome</span><input name="name" maxlength="70" required autofocus value="${attr(existing?.name || '')}" placeholder="Ex.: Responsável"></label><label class="atlas-v2-field"><span>Tipo</span><select name="type">${Object.entries(COLUMN_TYPES).map(([key, value]) => `<option value="${key}" ${existing?.type === key ? 'selected' : ''}>${escapeHtml(value.label)}</option>`).join('')}</select></label><label class="atlas-v2-field"><span>Largura</span><input name="width" type="number" min="90" max="420" step="10" value="${Number(existing?.width || 160)}"></label><label class="atlas-v2-field is-wide" data-column-options><span>Opções separadas por vírgula</span><input name="options" value="${attr((existing?.options || []).map((entry) => typeof entry === 'string' ? entry : entry.label).join(', '))}" placeholder="Ex.: Pendente, Em andamento, Concluído"></label><label class="atlas-v2-field is-wide" data-column-formula><span>Fórmula</span><input name="formula" value="${attr(existing?.formula || '')}" placeholder="Ex.: SOMA_COLUNA({Total lançado})"><small>Utilize os nomes das colunas entre chaves. Disponíveis: ${escapeHtml(formulaHelp || 'crie primeiro uma coluna numérica')}. Também aceita <strong>SE(condição;então;senão)</strong> (comparadores &gt; &lt; &gt;= &lt;= = &lt;&gt;), agregações dos subitens com <strong>SOMA</strong>, <strong>MEDIA</strong>, <strong>MINIMO</strong>, <strong>MAXIMO</strong>, <strong>CONT</strong> e da coluna inteira com <strong>SOMA_COLUNA</strong>, <strong>MEDIA_COLUNA</strong>, <strong>MINIMO_COLUNA</strong>, <strong>MAXIMO_COLUNA</strong>, <strong>CONT_COLUNA</strong>.</small></label><label class="atlas-v2-field" data-column-formula><span>Formato do resultado</span><select name="format"><option value="number" ${existing?.format === 'number' || !existing?.format ? 'selected' : ''}>Número</option><option value="percentage" ${existing?.format === 'percentage' ? 'selected' : ''}>Porcentagem</option><option value="currency" ${existing?.format === 'currency' ? 'selected' : ''}>Moeda</option></select></label><label class="atlas-v2-field" data-column-formula><span>Casas decimais</span><input name="decimals" type="number" min="0" max="6" value="${Number(existing?.decimals ?? 2)}"></label><label class="atlas-v2-field is-wide atlas-v2-field-check" data-column-versioned><input name="versioned" type="checkbox" ${existing?.versioned ? 'checked' : ''}><span>Controlar versões</span><small>Ao enviar um arquivo novo por cima de um existente, o anterior vira histórico (V1, V2, V3...) em vez de virar outro anexo. Indicado para documentos que são revisados, como planilhas e projetos.</small></label></form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-column-form">Salvar</button>`,
    });
    requestAnimationFrame(updateColumnEditorVisibility);
  }

  function updateColumnEditorVisibility() {
    const form = document.getElementById('atlas-v2-column-form');
    if (!form) return;
    const type = String(form.elements.type?.value || 'text');
    form.querySelectorAll('[data-column-options]').forEach((entry) => { entry.hidden = !['status', 'select'].includes(type); });
    form.querySelectorAll('[data-column-formula]').forEach((entry) => { entry.hidden = type !== 'formula'; });
    form.querySelectorAll('[data-column-versioned]').forEach((entry) => { entry.hidden = type !== 'file'; });
  }

  function submitColumn(form) {
    const context = findBoard();
    if (!context) return;
    const data = new FormData(form);
    const columnId = String(data.get('columnId') || '');
    const type = String(data.get('type') || 'text');
    const labels = String(data.get('options') || '').split(',').map((entry) => entry.trim()).filter(Boolean);
    const colors = ['#0f6cbd', '#7554a3', '#d68a1f', '#168a5b', '#c33d4b'];
    const backgrounds = ['#e3f1fc', '#eee8f7', '#fff0d7', '#ddf4e9', '#fbe4e7'];
    const options = labels.map((label, index) => option(label, colors[index % colors.length], backgrounds[index % backgrounds.length]));
    const payload = {
      name: String(data.get('name') || '').trim(),
      type,
      width: Number(data.get('width') || COLUMN_TYPES[type]?.width || 160),
      options: ['status', 'select'].includes(type) ? (options.length ? options : deepClone(STATUS_OPTIONS)) : [],
      formula: type === 'formula' ? String(data.get('formula') || '').trim() : '',
      format: type === 'formula' ? String(data.get('format') || 'number') : '',
      decimals: type === 'formula' ? Math.min(6, Math.max(0, Number(data.get('decimals') || 0))) : 0,
      versioned: type === 'file' && data.get('versioned') === 'on',
    };
    if (columnId) {
      const existing = context.board.columns.find((entry) => entry.id === columnId);
      if (existing) Object.assign(existing, payload);
    } else {
      const newColumn = column(id('col'), payload.name, payload.type, payload);
      context.board.columns.push(newColumn);
      context.board.groups.forEach((groupEntry) => groupEntry.items.forEach((itemEntry) => { itemEntry.values[newColumn.id] = type === 'checkbox' ? false : ''; }));
    }
    closeOverlay();
    saveData(columnId ? 'Coluna atualizada' : 'Coluna criada');
    render();
  }

  function openStatusColorsModal(columnId) {
    const context = findBoard();
    const columnEntry = context?.board.columns.find((entry) => entry.id === columnId && entry.type === 'status');
    if (!columnEntry) return;
    const palette = ['#657084', '#d68a1f', '#0f6cbd', '#168a5b', '#c33d4b', '#73568f'];
    const options = (columnEntry.options?.length ? columnEntry.options : deepClone(STATUS_OPTIONS)).map((entry, index) => {
      const details = typeof entry === 'string' ? { label: entry } : entry;
      return {
        label: String(details.label || `Status ${index + 1}`),
        background: normalizedHexColor(details.background || details.color, palette[index % palette.length]),
      };
    });
    openModal({
      title: `Cores de ${columnEntry.name}`,
      subtitle: 'Escolha uma cor para cada status. A alteração vale para todos os itens deste quadro.',
      body: `<form id="atlas-v2-status-colors-form" class="atlas-v2-status-colors-form"><input type="hidden" name="columnId" value="${attr(columnId)}">${options.map((entry) => {
        const foreground = readableTextColor(entry.background);
        return `<div class="atlas-v2-status-color-row" data-status-color-row><input type="hidden" name="statusLabel" value="${attr(entry.label)}"><span class="atlas-v2-status-color-preview" data-status-color-preview style="--status-bg:${attr(entry.background)};--status-color:${attr(foreground)}">${escapeHtml(entry.label)}</span><label><span>Cor</span><input type="color" name="statusBackground" value="${attr(entry.background)}" data-status-color-input></label></div>`;
      }).join('')}</form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-status-colors-form">Salvar cores</button>`,
    });
  }

  function submitStatusColors(form) {
    const context = findBoard();
    if (!context) return;
    const columnId = String(new FormData(form).get('columnId') || '');
    const columnEntry = context.board.columns.find((entry) => entry.id === columnId && entry.type === 'status');
    if (!columnEntry) return;
    const rows = [...form.querySelectorAll('[data-status-color-row]')];
    columnEntry.options = rows.map((row) => {
      const label = String(row.querySelector('[name="statusLabel"]')?.value || '').trim();
      const background = normalizedHexColor(row.querySelector('[name="statusBackground"]')?.value, '#e3f1fc');
      return option(label, readableTextColor(background), background);
    }).filter((entry) => entry.label);
    closeOverlay();
    saveData('Cores dos status atualizadas');
    render();
  }

  function openBoardSettings() {
    const context = findBoard();
    if (!context) return;
    const boardEntry = context.board;
    const dateOptions = boardEntry.columns.filter((entry) => entry.type === 'date').map((entry) => `<option value="${attr(entry.id)}" ${boardEntry.settings?.slaDateColumnId === entry.id ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('');
    openDrawer({
      title: 'Configurar quadro',
      subtitle: boardEntry.name,
      body: `<form id="atlas-v2-board-settings-form" class="atlas-v2-form-grid"><label class="atlas-v2-field is-wide"><span>Nome</span><input name="name" maxlength="80" required value="${attr(boardEntry.name)}"></label><label class="atlas-v2-field is-wide"><span>Descrição</span><textarea name="description" maxlength="180">${escapeHtml(boardEntry.description)}</textarea></label><label class="atlas-v2-field"><span>Acesso</span><select name="access">${Object.entries(ACCESS).map(([key, value]) => `<option value="${key}" ${boardEntry.access === key ? 'selected' : ''}>${escapeHtml(value.label)}</option>`).join('')}</select></label><label class="atlas-v2-field"><span>Coluna de prazo/SLA</span><select name="slaDateColumnId"><option value="">Detecção automática</option>${dateOptions}</select></label><label class="atlas-v2-field"><span>Alerta antecipado</span><input name="slaWarningDays" type="number" min="0" max="90" value="${Number(boardEntry.settings?.slaWarningDays ?? 2)}"><small>Dias antes do vencimento.</small></label></form><h3>Colunas</h3><div class="atlas-v2-settings-list">${boardEntry.columns.map((entry, index) => `<div class="atlas-v2-settings-row"><i data-lucide="${attr(COLUMN_TYPES[entry.type]?.icon || 'type')}"></i><span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(COLUMN_TYPES[entry.type]?.label || entry.type)} · ${Number(entry.width || 160)} px</small></span><div class="atlas-v2-settings-actions"><button class="atlas-v2-icon-button" type="button" data-action="move-column" data-column-id="${attr(entry.id)}" data-direction="-1" title="Mover para esquerda" ${index === 0 ? 'disabled' : ''}><i data-lucide="arrow-left"></i></button><button class="atlas-v2-icon-button" type="button" data-action="move-column" data-column-id="${attr(entry.id)}" data-direction="1" title="Mover para direita" ${index === boardEntry.columns.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-right"></i></button>${entry.type === 'status' ? `<button class="atlas-v2-icon-button" type="button" data-action="edit-status-colors" data-column-id="${attr(entry.id)}" title="Alterar cores dos status"><i data-lucide="palette"></i></button>` : ''}<button class="atlas-v2-icon-button" type="button" data-action="edit-column" data-column-id="${attr(entry.id)}" title="Editar"><i data-lucide="pencil"></i></button><button class="atlas-v2-icon-button" type="button" data-action="delete-column" data-column-id="${attr(entry.id)}" title="Excluir"><i data-lucide="trash-2"></i></button></div></div>`).join('')}</div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Fechar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-board-settings-form">Salvar quadro</button>`,
    });
  }

  function submitBoardSettings(form) {
    const context = findBoard();
    if (!context) return;
    const data = new FormData(form);
    context.board.name = String(data.get('name') || context.board.name).trim();
    context.board.description = String(data.get('description') || '').trim();
    context.board.access = String(data.get('access') || 'main');
    context.board.settings = context.board.settings || {};
    context.board.settings.slaDateColumnId = String(data.get('slaDateColumnId') || '');
    context.board.settings.slaWarningDays = Math.min(90, Math.max(0, Number(data.get('slaWarningDays') || 0)));
    closeOverlay();
    saveData('Quadro atualizado');
    render();
  }

  function moveColumn(columnId, direction) {
    const context = findBoard();
    const columns = context?.board.columns;
    if (!columns) return;
    const from = columns.findIndex((entry) => entry.id === columnId);
    const to = from + Number(direction);
    if (from < 0 || to < 0 || to >= columns.length) return;
    const [entry] = columns.splice(from, 1);
    columns.splice(to, 0, entry);
    columns.forEach((columnEntry, index) => { columnEntry.order = index; });
    saveData('Coluna reorganizada');
    openBoardSettings();
  }

  async function deleteColumn(columnId) {
    const context = findBoard();
    if (!context) return;
    if (!requirePermission('configure', context, 'excluir esta coluna')) return;
    const target = context.board.columns.find((entry) => entry.id === columnId);
    if (!target) return;
    if (runtime.remoteMode && runtime.authClient) {
      const itemIds = flatBoardItems(context.board).map(({ item }) => item.id);
      try { await hydrateBoardRemoteData(context.board.id, { itemIds }); }
      catch (error) { toast(`Não foi possível confirmar todos os valores da coluna: ${error.message || error}`, true); return; }
    }
    const values = [];
    flatBoardItems(context.board).forEach(({ item: itemEntry }) => {
      const itemValue = itemEntry.values[columnId];
      values.push({ itemId: itemEntry.id, value: itemValue === undefined ? null : deepClone(itemValue) });
    });
    const trashEntry = addTrashEntry('column', target.name, target, { boardId: context.board.id, index: context.board.columns.indexOf(target), values });
    if (!await stageTrashEntries([trashEntry])) return;
    try {
      await syncTrashEntriesWithDrive([trashEntry], 'delete');
    } catch (error) {
      await rollbackStagedTrash([trashEntry], `A coluna não foi excluída porque o Drive não confirmou a remoção dos arquivos: ${error.message || error}`);
      return;
    }
    context.board.columns = context.board.columns.filter((entry) => entry.id !== columnId);
    flatBoardItems(context.board).forEach(({ item }) => { delete item.values[columnId]; });
    saveData('Coluna movida para a lixeira');
    openBoardSettings();
  }

  function openGroupMenu(groupId) {
    const context = findBoard();
    const groupEntry = context?.board.groups.find((entry) => entry.id === groupId);
    if (!groupEntry) return;
    openModal({
      title: groupEntry.name,
      subtitle: 'Gerencie a estrutura deste grupo.',
      body: `<div class="atlas-v2-settings-list"><button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="edit-group" data-group-id="${attr(groupId)}"><i data-lucide="pencil"></i>Editar nome e cor</button><button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="duplicate-group" data-group-id="${attr(groupId)}"><i data-lucide="copy"></i>Duplicar grupo</button><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-action="delete-group" data-group-id="${attr(groupId)}"><i data-lucide="trash-2"></i>Excluir grupo</button></div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Fechar</button>`,
    });
  }

  function openDeleteGroupModal(groupId) {
    const context = findBoard();
    const target = context?.board.groups.find((entry) => entry.id === groupId);
    if (!context || !target) return;
    if (context.board.groups.length <= 1) { toast('O último grupo do quadro não pode ser excluído', true); return; }
    const itemCount = (target.items || []).length;
    const subitemTotal = (target.items || []).reduce((total, entry) => total + (entry.subitems?.length || 0), 0);
    const parts = [];
    if (itemCount) parts.push(`${itemCount} ${itemCount === 1 ? 'item' : 'itens'} acompanhará${itemCount === 1 ? '' : 'ão'} o grupo`);
    if (subitemTotal) parts.push(`${subitemTotal} ${subitemTotal === 1 ? 'subitem' : 'subitens'}`);
    openModal({
      title: 'Excluir grupo',
      subtitle: target.name,
      // Um grupo pode carregar muito mais dado do que uma obra sozinha - a
      // confirmacao aqui precisa ser pelo menos tao clara quanto a de obra
      // (openDeleteWorkModal), nunca mais fraca, dado o raio de impacto maior.
      body: `<div class="atlas-v2-confirm-card"><i data-lucide="triangle-alert"></i><div><strong>O grupo inteiro será movido para a lixeira.</strong><p>${parts.length ? escapeHtml(parts.join(', ')) + '.' : 'Este grupo ainda não possui itens.'}</p></div></div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-action="confirm-delete-group" data-group-id="${attr(target.id)}"><i data-lucide="trash-2"></i>Mover para lixeira</button>`,
    });
  }

  async function deleteGroup(groupId) {
    const context = findBoard();
    if (!context) return;
    if (!requirePermission('delete', { ...context, groupId }, 'excluir este grupo')) return;
    const target = context.board.groups.find((entry) => entry.id === groupId);
    if (!target) return;
    if (context.board.groups.length <= 1) { toast('O último grupo do quadro não pode ser excluído', true); closeOverlay(); return; }
    if (runtime.remoteMode && runtime.authClient) {
      const itemIds = (target.items || []).flatMap((entry) => itemTreeIds(entry, []));
      try { await hydrateBoardRemoteData(context.board.id, { itemIds }); }
      catch (error) { toast(`Não foi possível confirmar todos os dados do grupo: ${error.message || error}`, true); return; }
    }
    if (!requirePermission('delete', { ...context, groupId }, 'excluir este grupo')) return;
    const trashEntry = addTrashEntry('group', target.name, target, { boardId: context.board.id, index: context.board.groups.indexOf(target) });
    if (!await stageTrashEntries([trashEntry])) return;
    try {
      await syncTrashEntriesWithDrive([trashEntry], 'delete');
    } catch (error) {
      await rollbackStagedTrash([trashEntry], `O grupo não foi excluído porque o Drive não confirmou a remoção dos arquivos: ${error.message || error}`);
      return;
    }
    context.board.groups = context.board.groups.filter((entry) => entry.id !== groupId);
    closeOverlay();
    saveData('Grupo movido para a lixeira');
    render();
  }

  function duplicateGroup(groupId) {
    const context = findBoard();
    const source = context?.board.groups.find((entry) => entry.id === groupId);
    if (!source) return;
    if (!requirePermission('create', { ...context, groupId }, 'duplicar este grupo')) return;
    const copy = deepClone(source);
    copy.id = id('group');
    copy.name = `${copy.name} - cópia`;
    // Regenerar o ID de toda a arvore, nao apenas dos itens de primeiro nivel.
    // Trocar so o pai deixava os subitens da copia com o MESMO id dos subitens
    // originais, o que fazia findItem devolver o item errado e provocava
    // conflito de chave ao gravar no Supabase.
    copy.items = (Array.isArray(copy.items) ? copy.items : []).map((entry) => {
      const itemCopy = duplicateItemTree(entry, null, false);
      const setGroup = (node) => {
        node.groupId = copy.id;
        (node.subitems || []).forEach(setGroup);
      };
      setGroup(itemCopy);
      return itemCopy;
    });
    const newIds = copy.items.flatMap((entry) => itemTreeIds(entry, []));
    // Mesma protecao de duplicateItem: sem isso a hidratacao remota zera os
    // valores copiados logo depois do render.
    newIds.forEach((newId) => runtime.loadedItemValues.add(String(newId)));
    const index = context.board.groups.findIndex((entry) => entry.id === groupId);
    context.board.groups.splice(index + 1, 0, copy);
    closeOverlay();
    saveData('Grupo duplicado', { remote: false });
    persistRemoteItemsSoon(context, newIds);
    render();
  }

  function openWorkspaceMenu() {
    const visibleWorkspaces = runtime.data.workspaces.filter((workspace) => workspace.modules.some((module) => module.boards.some((boardEntry) => hasPermission('view', { workspace, module, board: boardEntry }))));
    openModal({
      title: 'Áreas de trabalho',
      subtitle: 'Escolha, renomeie ou crie uma área de trabalho.',
      body: `<div class="atlas-v2-settings-list">${visibleWorkspaces.map((entry) => `<div class="atlas-v2-workspace-menu-row"><button class="atlas-v2-settings-row atlas-v2-workspace-select" type="button" data-action="select-workspace" data-workspace-id="${attr(entry.id)}"><span class="atlas-v2-workspace-mark" style="background:${attr(entry.color || '#0f6cbd')}">${escapeHtml(entry.name.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(entry.name)}</strong><small>${entry.modules.length} ${entry.modules.length === 1 ? 'módulo' : 'módulos'} · ${escapeHtml(ACCESS[entry.access]?.label || 'Organizacional')}</small></span><i data-lucide="chevron-right"></i></button>${hasPermission('configure', findBoard()) ? `<button class="atlas-v2-icon-button atlas-v2-workspace-edit" type="button" data-action="edit-workspace" data-workspace-id="${attr(entry.id)}" title="Renomear ${attr(entry.name)}" aria-label="Renomear ${attr(entry.name)}"><i data-lucide="pencil"></i></button>` : ''}</div>`).join('')}</div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Fechar</button><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="create-workspace"><i data-lucide="plus"></i>Nova área</button>`,
    });
  }

  function openRenameWorkspaceModal(workspaceId) {
    const workspace = runtime.data.workspaces.find((entry) => entry.id === workspaceId);
    if (!workspace) return;
    openModal({
      title: 'Renomear área de trabalho',
      subtitle: workspace.name,
      body: `<form id="atlas-v2-workspace-form"><input type="hidden" name="workspaceId" value="${attr(workspace.id)}"><label class="atlas-v2-field"><span>Nome da área</span><input name="name" value="${attr(workspace.name)}" maxlength="80" required autofocus></label></form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="workspace-menu">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-workspace-form"><i data-lucide="check"></i>Salvar nome</button>`,
    });
  }

  function submitWorkspace(form) {
    const data = new FormData(form);
    const workspace = runtime.data.workspaces.find((entry) => entry.id === data.get('workspaceId'));
    const name = String(data.get('name') || '').trim();
    if (!workspace || !name) return;
    workspace.name = name;
    closeOverlay();
    saveData('Área de trabalho renomeada');
    render();
  }

  function selectWorkspace(workspaceId) {
    const workspace = runtime.data.workspaces.find((entry) => entry.id === workspaceId);
    const firstBoard = workspace?.modules?.flatMap((entry) => entry.boards).find((entry) => {
      const module = workspace.modules.find((moduleEntry) => moduleEntry.boards.includes(entry));
      return hasPermission('view', { workspace, module, board: entry });
    });
    if (!workspace || !firstBoard) return;
    runtime.page = 'board';
    runtime.data.activeWorkspaceId = workspace.id;
    runtime.data.activeBoardId = firstBoard.id;
    runtime.selectedItems.clear();
    runtime.expandedWorkSectors.clear();
    runtime.boardSearch = '';
    runtime.workFilter = '';
    const context = findBoard(firstBoard.id);
    const needsRemoteData = runtime.remoteMode && context
      && boardViewItemIds(context.board).some((itemId) => !runtime.loadedItemValues.has(String(itemId)));
    document.body.classList.toggle('atlas-v2-board-loading', Boolean(needsRemoteData));
    closeOverlay();
    scheduleBootstrapCacheWrite(runtime.data, 4000);
    renderBoardRoute(context, { workspaceChanged: true });
    closeSidebar();
  }

  function openShareDrawer() {
    const context = findBoard();
    if (!context || !requirePermission('share', context, 'compartilhar este quadro')) return;
    const members = runtime.data.boardMembers.filter((entry) => entry.boardId === context.board.id);
    const availableUsers = runtime.data.users.filter((entry) => entry.status === 'active' && entry.id !== runtime.data.currentUserId).map((entry) => `<option value="${attr(entry.id)}">${escapeHtml(entry.name)} · ${roleLabel(entry.role)}</option>`).join('');
    const memberRows = members.map((entry) => { const user = runtime.data.users.find((candidate) => candidate.id === entry.userId); return `<div class="atlas-v2-settings-row"><span class="atlas-v2-avatar">${escapeHtml((user?.name || 'U').slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(user?.name || 'Usuário removido')}</strong><small>${escapeHtml(ACCESS_LEVELS[membershipLevel(entry.role)]?.label || 'Visualização')}</small></span><button class="atlas-v2-admin-icon-danger" type="button" data-action="remove-board-member" data-user-id="${attr(entry.userId)}" title="Remover acesso"><i data-lucide="x"></i></button></div>`; }).join('');
    openDrawer({
      title: 'Compartilhar quadro',
      subtitle: context.board.name,
      body: `<form id="atlas-v2-share-form" class="atlas-v2-form-grid"><label class="atlas-v2-field is-wide"><span>Tipo de acesso</span><select name="access">${Object.entries(ACCESS).map(([key, value]) => `<option value="${key}" ${context.board.access === key ? 'selected' : ''}>${escapeHtml(value.label)}</option>`).join('')}</select></label><label class="atlas-v2-field"><span>Adicionar usuário</span><select name="userId"><option value="">Somente alterar o tipo</option>${availableUsers}</select></label><label class="atlas-v2-field"><span>Nível no quadro</span><select name="memberRole"><option value="viewer">Visualização</option><option value="editor">Edição</option><option value="admin">Gestão</option></select></label></form><h3>Membros do quadro</h3><div class="atlas-v2-settings-list">${memberRows || '<p class="atlas-v2-admin-empty">Nenhum membro específico. O acesso segue o perfil organizacional.</p>'}</div>`,
      actions: '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-share-form"><i data-lucide="shield-check"></i>Salvar acesso</button>',
    });
  }

  function submitShareBoard(form) {
    const context = findBoard();
    if (!context || !requirePermission('share', context, 'alterar o compartilhamento')) return;
    const data = new FormData(form);
    context.board.access = String(data.get('access') || context.board.access);
    const userId = String(data.get('userId') || '');
    const role = String(data.get('memberRole') || 'viewer');
    if (userId) {
      const existing = runtime.data.boardMembers.find((entry) => entry.boardId === context.board.id && entry.userId === userId);
      if (existing) existing.role = role;
      else runtime.data.boardMembers.push({ boardId: context.board.id, userId, role });
    }
    closeOverlay();
    saveData('Acesso do quadro atualizado');
    render();
  }

  function removeBoardMember(userId) {
    const context = findBoard();
    if (!context || !requirePermission('share', context, 'remover membros')) return;
    runtime.data.boardMembers = runtime.data.boardMembers.filter((entry) => !(entry.boardId === context.board.id && entry.userId === userId));
    saveData('Membro removido do quadro');
    openShareDrawer();
  }

  function openGlobalSearch() {
    openModal({
      title: 'Busca global',
      subtitle: 'Quadros e itens desta estrutura oficial.',
      body: `<label class="atlas-v2-field"><span>Pesquisar</span><input id="atlas-v2-global-search-input" type="search" autofocus placeholder="Digite um quadro ou item"></label><div id="atlas-v2-global-results" class="atlas-v2-settings-list" style="margin-top:14px"></div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Fechar</button>`,
    });
    renderGlobalResults('');
  }

  function renderGlobalResults(query) {
    const root = document.getElementById('atlas-v2-global-results');
    if (!root) return;
    const needle = String(query || '').trim().toLowerCase();
    const results = [];
    runtime.data.workspaces.forEach((workspace) => workspace.modules.forEach((module) => module.boards.forEach((boardEntry) => {
      if (!hasPermission('view', { workspace, module, board: boardEntry })) return;
      if (!needle || `${workspace.name} ${module.name} ${boardEntry.name}`.toLowerCase().includes(needle)) results.push({ type: 'Quadro', title: boardEntry.name, subtitle: `${workspace.name} · ${module.name}`, boardId: boardEntry.id });
      flatBoardItems(boardEntry).forEach(({ item: itemEntry, group: groupEntry, parent }) => {
        const attachmentText = boardEntry.columns.filter((entry) => ['image', 'file'].includes(entry.type)).flatMap((entry) => normalizeImageEntries(itemEntry.values?.[entry.id]).map((file) => `${file.name || ''} ${file.mimeType || ''}`)).join(' ');
        const valueText = Object.values(itemEntry.values || {}).map((value) => typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')).join(' ');
        if (needle && normalizeSearchText(`${itemEntry.name} ${valueText} ${attachmentText}`).includes(normalizeSearchText(needle))) results.push({ type: parent ? 'Subitem' : 'Item', title: itemEntry.name, subtitle: `${boardEntry.name} · ${groupEntry.name}${attachmentText ? ' · contém anexo' : ''}`, boardId: boardEntry.id });
      });
    })));
    root.innerHTML = results.slice(0, 20).map((entry) => `<button class="atlas-v2-settings-row" type="button" data-action="search-open-board" data-board-id="${attr(entry.boardId)}"><i data-lucide="${entry.type === 'Quadro' ? 'table-2' : 'circle-dot'}"></i><span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.type)} · ${escapeHtml(entry.subtitle)}</small></span><i data-lucide="arrow-up-right"></i></button>`).join('') || '<div class="atlas-v2-empty-view"><span>Nenhum resultado</span></div>';
    refreshIcons(root);
  }

  function openImportModal() {
    const context = findBoard();
    const batches = Array.isArray(context?.board?.settings?.import_batches) ? context.board.settings.import_batches : [];
    const reversibleBatch = [...batches].reverse().find((entry) => !entry.rolledBackAt && Array.isArray(entry.itemIds) && entry.itemIds.length);
    openModal({
      title: 'Importador universal',
      subtitle: 'O Atlas identifica a aba, o cabeçalho, os tipos de dados e a hierarquia antes de importar.',
      body: `<form id="atlas-v2-import-form" class="atlas-v2-form-grid"><label class="atlas-v2-field is-wide"><span>Planilha</span><input name="file" type="file" accept=".csv,.xlsx,.xls,.xlsm,.ods" required><small>CSV, Excel ou OpenDocument · até 15 MB e 5.000 registros</small></label><label class="atlas-v2-field is-wide"><span>Grupo padrão</span><select name="groupId">${context.board.groups.map((entry) => `<option value="${attr(entry.id)}">${escapeHtml(entry.name)}</option>`).join('')}</select><small>Será usado quando a planilha não tiver uma coluna de grupo ou setor.</small></label><label class="atlas-v2-check-row is-wide"><input name="skipDuplicates" type="checkbox" checked><span><strong>Ignorar possíveis duplicados</strong><small>Compara nome, grupo e elemento pai antes de criar o registro.</small></span></label>${reversibleBatch ? `<div class="atlas-v2-import-rollback is-wide"><i data-lucide="history"></i><span><strong>Último lote: ${escapeHtml(reversibleBatch.fileName || 'Importação')}</strong><small>${reversibleBatch.itemIds.length} registro(s) importado(s) em ${formatDateTime(reversibleBatch.createdAt)}</small></span><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-action="rollback-import" data-batch-id="${attr(reversibleBatch.id)}"><i data-lucide="undo-2"></i>Desfazer lote</button></div>` : ''}</form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-import-form"><i data-lucide="scan-search"></i>Analisar arquivo</button>`,
    });
  }

  function importHeaderScore(matrix, rowIndex) {
    const row = matrix[rowIndex] || [];
    const nonEmpty = row.map((value) => String(value ?? '').trim()).filter(Boolean);
    if (nonEmpty.length < 2) return -1;
    const unique = new Set(nonEmpty.map(normalizeSearchText)).size;
    const textCount = nonEmpty.filter((value) => /[a-zÀ-ÿ]/i.test(value)).length;
    const following = matrix.slice(rowIndex + 1, rowIndex + 6);
    const density = following.reduce((total, nextRow) => total + nextRow.filter((value) => String(value ?? '').trim() !== '').length, 0);
    return (unique * 4) + (textCount * 2) + Math.min(20, density) - rowIndex;
  }

  function importUniqueHeaders(row = []) {
    const used = new Map();
    return row.map((rawHeader, index) => {
      const safe = String(rawHeader ?? '').trim().slice(0, 120) || `Coluna ${index + 1}`;
      const key = normalizeSearchText(safe);
      const count = (used.get(key) || 0) + 1;
      used.set(key, count);
      return count === 1 ? safe : `${safe} (${count})`;
    });
  }

  function importDateValue(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (!match) return '';
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    return `${String(year).padStart(4, '0')}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  }

  /**
   * Converte um numero de planilha respeitando o formato usado no arquivo.
   * O parser anterior assumia sempre o formato brasileiro e removia todos os
   * pontos, o que transformava "1,234.56" em 1.23456 e "1.5" em 15 — valores
   * plausiveis e errados, importados sem nenhum aviso.
   * Retorna null quando o texto nao representa um numero.
   */
  function parseImportNumber(rawValue) {
    if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : null;
    const cleaned = String(rawValue ?? '').trim().replace(/[^\d.,+-]/g, '');
    if (!cleaned || !/\d/.test(cleaned)) return null;
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const digitsAfter = (position) => cleaned.length - position - 1;
    const occurrences = (character) => cleaned.split(character).length - 1;
    let normalized = cleaned;
    if (lastComma >= 0 && lastDot >= 0) {
      // Os dois separadores presentes: o ultimo a aparecer e o decimal.
      normalized = lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
    } else if (lastComma >= 0) {
      // Apenas virgula: decimal no padrao brasileiro, exceto quando ha varias
      // virgulas (milhar) ou exatamente tres casas apos uma unica virgula.
      normalized = occurrences(',') === 1 && digitsAfter(lastComma) !== 3
        ? cleaned.replace(',', '.')
        : cleaned.replace(/,/g, '');
    } else if (lastDot >= 0) {
      // Apenas ponto: decimal se for um unico ponto sem grupo de tres casas.
      normalized = occurrences('.') === 1 && digitsAfter(lastDot) !== 3
        ? cleaned
        : cleaned.replace(/\./g, '');
    }
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function inferImportType(header, rows) {
    const key = normalizeSearchText(header);
    const values = rows.map((row) => String(row[header] ?? '').trim()).filter(Boolean).slice(0, 100);
    if (/imagem|foto|anexo|arquivo|documento/.test(key)) return /imagem|foto/.test(key) ? 'image' : 'file';
    if (/responsavel|equipe|colaborador|tecnico|aberto por/.test(key)) return 'person';
    if (/localizacao|geolocalizacao|coordenada|latitude|longitude/.test(key)) return 'location';
    if (/link|url|site/.test(key) || (values.length && values.filter((value) => /^https?:\/\//i.test(value)).length / values.length >= 0.7)) return 'link';
    if (/data|inicio|fim|conclusao|previsao|prazo/.test(key) || (values.length && values.filter(importDateValue).length / values.length >= 0.75)) return 'date';
    if (values.length && values.filter((value) => /^(sim|nao|não|true|false|yes|no|0|1)$/i.test(value)).length / values.length >= 0.85) return 'checkbox';
    if (/percent|progresso|andamento/.test(key)) return 'percentage';
    if (/valor|custo|preco|preço|orcamento|orçamento/.test(key)) return 'currency';
    if (/quantidade|total|numero|número|km|metragem/.test(key) || (values.length && values.filter((value) => parseImportNumber(value) !== null).length / values.length >= 0.8)) return 'number';
    const unique = new Set(values.map(normalizeSearchText));
    if (/status|situacao|situação|prioridade/.test(key)) return 'status';
    if (values.length >= 3 && unique.size <= Math.min(20, Math.ceil(values.length * 0.35))) return 'select';
    return 'text';
  }

  function autoImportMapping(context, header, index, inferredType) {
    const key = normalizeSearchText(header).replace(/\s+/g, '');
    if (/^(item|nome|elemento|registro|titulo|título|cidade|obra|projeto)$/.test(key)) return '__name__';
    if (/^(grupo|setor|fase|categoria|etapa|statusdogrupo)$/.test(key)) return '__group__';
    if (/^(pai|elementopai|itempai|registropai|obrapai|projetopai|parent)$/.test(key)) return '__parent__';
    const normalizedName = (value) => normalizeSearchText(value).replace(/\s+/g, '');
    const exact = context.board.columns.find((entry) => normalizedName(entry.name) === key);
    const close = context.board.columns.find((entry) => {
      const columnKey = normalizedName(entry.name);
      return key.length > 3 && columnKey.length > 3 && (columnKey.includes(key) || key.includes(columnKey));
    });
    return (exact || close)?.id || `__new__:${inferredType}`;
  }

  async function submitImport(form) {
    const formData = new FormData(form);
    const file = formData.get('file');
    const groupId = formData.get('groupId');
    if (!(file instanceof File) || !file.size) return;
    try {
      setOperationProgress('Lendo planilha', 5, file.name);
      if (file.size > 15 * 1024 * 1024) throw new Error('A planilha ultrapassa o limite de 15 MB.');
      await loadAssetScript('./assets/vendor/xlsx.full.min.js', () => Boolean(window.XLSX?.read && window.XLSX?.utils));
      if (!window.XLSX?.read || !window.XLSX?.utils) throw new Error('O leitor seguro de planilhas não foi carregado.');
      const buffer = await file.arrayBuffer();
      setOperationProgress('Analisando estrutura', 25, 'Localizando a melhor aba e o cabeçalho');
      const workbook = window.XLSX.read(buffer, { type: 'array', cellFormula: false, cellHTML: false, cellStyles: false });
      const context = findBoard();
      const target = context?.board?.groups.find((entry) => entry.id === groupId);
      if (!target) throw new Error('O grupo de destino não está mais disponível.');

      const candidates = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
        let headerRow = 0;
        let score = -1;
        matrix.slice(0, 25).forEach((_, rowIndex) => {
          const current = importHeaderScore(matrix, rowIndex);
          if (current > score) { score = current; headerRow = rowIndex; }
        });
        const populatedRows = matrix.slice(headerRow + 1).filter((row) => row.some((value) => String(value ?? '').trim() !== ''));
        return { sheetName, matrix, headerRow, score: score + Math.min(100, populatedRows.length), populatedRows };
      }).filter((entry) => entry.matrix.length);
      const selectedSheet = candidates.sort((a, b) => b.score - a.score)[0];
      if (!selectedSheet) throw new Error('A planilha não possui uma aba legível.');
      const headers = importUniqueHeaders(selectedSheet.matrix[selectedSheet.headerRow]);
      if (headers.length > 100) throw new Error('A importação aceita no máximo 100 colunas por arquivo.');
      const rows = selectedSheet.populatedRows.slice(0, 5000).map((rawRow) => headers.reduce((result, header, index) => {
        result[header] = rawRow[index] ?? '';
        return result;
      }, {}));
      if (!headers.length || !rows.length) throw new Error('A planilha não possui registros para importar.');
      const inferredTypes = {};
      const mapping = {};
      headers.forEach((header, index) => {
        inferredTypes[header] = inferImportType(header, rows);
        mapping[header] = autoImportMapping(context, header, index, inferredTypes[header]);
      });
      if (!headers.some((header) => mapping[header] === '__name__')) mapping[headers[0]] = '__name__';
      runtime.importPreview = {
        fileName: file.name,
        groupId: String(groupId),
        sheetName: selectedSheet.sheetName,
        headerRow: selectedSheet.headerRow + 1,
        rows,
        headers,
        mapping,
        inferredTypes,
        availableSheets: candidates.map((entry) => entry.sheetName),
        skipDuplicates: Boolean(formData.get('skipDuplicates')),
      };
      setOperationProgress('Planilha analisada', 100, `${selectedSheet.sheetName} · ${rows.length} registro(s)`);
      clearOperationProgress();
      openImportPreview();
    } catch (error) {
      clearOperationProgress(0);
      toast(error.message || 'Não foi possível ler o arquivo', true);
    }
  }

  function importMappingOptions(context, header, selected, inferredType) {
    const options = [
      ['', 'Ignorar coluna'],
      ['__name__', 'Nome do registro'],
      ['__group__', 'Grupo / setor'],
      ['__parent__', 'Elemento pai'],
      ...context.board.columns.map((entry) => [entry.id, `${entry.name} (${COLUMN_TYPES[entry.type]?.label || entry.type})`]),
      [`__new__:${inferredType}`, `Criar coluna "${header}" (${COLUMN_TYPES[inferredType]?.label || inferredType})`],
    ];
    return options.map(([value, label]) => `<option value="${attr(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
  }

  function openImportPreview() {
    const context = findBoard();
    const preview = runtime.importPreview;
    if (!context || !preview) return;
    const existingNames = new Set(flatBoardItems(context.board).map((entry) => normalizeSearchText(entry.item.name)));
    const duplicateCount = preview.rows.filter((row) => {
      const nameHeader = preview.headers.find((header) => preview.mapping[header] === '__name__') || preview.headers[0];
      return existingNames.has(normalizeSearchText(row[nameHeader]));
    }).length;
    const samples = preview.rows.slice(0, 5);
    openModal({
      title: 'Revisar importação',
      subtitle: `${preview.fileName} · aba ${preview.sheetName} · cabeçalho na linha ${preview.headerRow}`,
      body: `<div class="atlas-v2-import-summary"><div><i data-lucide="sheet"></i><span><strong>${preview.headers.length}</strong><small>colunas detectadas</small></span></div><div><i data-lucide="rows-3"></i><span><strong>${preview.rows.length}</strong><small>linhas válidas</small></span></div><div><i data-lucide="copy-check"></i><span><strong>${duplicateCount}</strong><small>possíveis duplicados</small></span></div></div><form id="atlas-v2-import-confirm-form"><div class="atlas-v2-import-mapping">${preview.headers.map((header) => `<label><span><strong>${escapeHtml(header)}</strong><small>${escapeHtml(String(preview.rows[0]?.[header] ?? '').slice(0, 60))} · ${escapeHtml(COLUMN_TYPES[preview.inferredTypes[header]]?.label || preview.inferredTypes[header])}</small></span><i data-lucide="arrow-right"></i><select name="map:${attr(header)}">${importMappingOptions(context, header, preview.mapping[header], preview.inferredTypes[header])}</select></label>`).join('')}</div><div class="atlas-v2-import-sample"><strong>Prévia do que foi lido</strong><div><table><thead><tr>${preview.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${samples.map((row) => `<tr>${preview.headers.map((header) => `<td>${escapeHtml(String(row[header] ?? '').slice(0, 80))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div><label class="atlas-v2-check-row"><input name="skipDuplicates" type="checkbox" ${preview.skipDuplicates ? 'checked' : ''}><span><strong>Ignorar ${duplicateCount} possível(is) duplicado(s)</strong><small>Revise o mapeamento acima antes de confirmar.</small></span></label></form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="import">Voltar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-import-confirm-form"><i data-lucide="file-check-2"></i>Confirmar importação</button>`,
    });
  }

  function importedColumnValue(columnEntry, rawValue) {
    const value = String(rawValue ?? '').trim();
    if (columnEntry.type === 'checkbox') return /^(sim|true|yes|1|x|ok)$/i.test(value);
    if (columnEntry.type === 'date') return importDateValue(value);
    if (['number', 'currency', 'percentage'].includes(columnEntry.type)) {
      const number = parseImportNumber(rawValue);
      return number === null ? '' : number;
    }
    return rawValue ?? '';
  }

  // Com create=false apenas localiza, sem criar nada. Usado para montar a chave
  // de duplicidade antes de decidir se a linha sera realmente importada, para
  // nao deixar grupos vazios criados por linhas que acabam ignoradas.
  function importGroupForValue(boardEntry, fallbackGroup, value, { create = true } = {}) {
    const name = String(value ?? '').trim();
    if (!name) return fallbackGroup;
    const existing = boardEntry.groups.find((entry) => normalizeSearchText(entry.name) === normalizeSearchText(name));
    if (existing) return existing;
    if (!create) return null;
    const colors = ['#0f6cbd', '#7a5aa6', '#b87503', '#07846c', '#b42335', '#4573c4'];
    const created = group(id('group'), name, colors[boardEntry.groups.length % colors.length], []);
    created.order = boardEntry.groups.length;
    boardEntry.groups.push(created);
    return created;
  }

  // Chave de duplicidade usada tanto para os itens que ja existem no quadro
  // quanto para as linhas da planilha, com o mesmo formato nos dois lados.
  function importDuplicateKey(groupKey, parentName, itemName) {
    return normalizeSearchText(`${groupKey}|${parentName || ''}|${itemName || ''}`);
  }

  async function confirmImport(form) {
    const context = findBoard();
    const preview = runtime.importPreview;
    if (!context || !preview) return;
    const fallbackGroup = context.board.groups.find((entry) => entry.id === preview.groupId);
    if (!fallbackGroup) return toast('O grupo de destino não está mais disponível.', true);
    const data = new FormData(form);
    const mapping = {};
    preview.headers.forEach((header) => { mapping[header] = String(data.get(`map:${header}`) || ''); });
    const nameHeader = preview.headers.find((header) => mapping[header] === '__name__') || preview.headers[0];
    const groupHeader = preview.headers.find((header) => mapping[header] === '__group__');
    const parentHeader = preview.headers.find((header) => mapping[header] === '__parent__');
    const initialGroupCount = context.board.groups.length;
    const createdColumnIds = [];
    preview.headers.forEach((header) => {
      if (!mapping[header].startsWith('__new__:')) return;
      const inferredType = mapping[header].slice('__new__:'.length);
      const values = preview.rows.map((row) => String(row[header] ?? '').trim()).filter(Boolean);
      const options = ['status', 'select'].includes(inferredType)
        ? [...new Set(values)].slice(0, 50).map((label) => inferredType === 'status' ? { label, background: STATUS_FALLBACK_BACKGROUNDS[createdColumnIds.length % STATUS_FALLBACK_BACKGROUNDS.length] } : label)
        : [];
      const newColumn = column(id('column'), header, inferredType, { options });
      newColumn.order = context.board.columns.length;
      context.board.columns.push(newColumn);
      createdColumnIds.push(newColumn.id);
      mapping[header] = newColumn.id;
    });
    // A chave dos itens que ja existem precisa ter exatamente o mesmo formato da
    // chave calculada por linha (grupo|pai|nome). Antes o conjunto guardava
    // apenas o nome, entao a comparacao nunca casava: subitens jamais eram
    // checados e itens de primeiro nivel eram ignorados so por existir outro
    // item com o mesmo nome em qualquer outro grupo.
    const existingNames = new Set(flatBoardItems(context.board)
      .map((entry) => importDuplicateKey(entry.group?.id || '', entry.parent?.name || '', entry.item.name)));
    const skipDuplicates = Boolean(data.get('skipDuplicates'));
    const createdIds = [];
    const importedParents = new Map();
    const groupIdsBeforeImport = new Set(context.board.groups.map((entry) => entry.id));
    let skipped = 0;
    closeOverlay();
    setOperationProgress('Organizando dados da planilha', 5, `0 de ${preview.rows.length}`);
    preview.rows.forEach((row, rowIndex) => {
      const name = String(row[nameHeader] || 'Item importado').trim() || 'Item importado';
      const groupValue = groupHeader ? row[groupHeader] : '';
      const parentName = parentHeader ? String(row[parentHeader] ?? '').trim() : '';
      // Localizar o grupo sem criar: se a linha for ignorada como duplicada, um
      // grupo novo nao deve ficar para tras vazio.
      const existingTarget = importGroupForValue(context.board, fallbackGroup, groupValue, { create: false });
      const groupKey = existingTarget ? existingTarget.id : `novo:${normalizeSearchText(String(groupValue ?? ''))}`;
      const duplicateKey = importDuplicateKey(groupKey, parentName, name);
      if (skipDuplicates && existingNames.has(duplicateKey)) {
        skipped += 1;
        return;
      }
      const target = existingTarget || importGroupForValue(context.board, fallbackGroup, groupValue);
      const newItem = item(id('item'), target.id, name, {});
      context.board.columns.forEach((columnEntry) => { newItem.values[columnEntry.id] = columnEntry.type === 'checkbox' ? false : ''; });
      preview.headers.forEach((header) => {
        const columnId = mapping[header];
        const columnEntry = context.board.columns.find((entry) => entry.id === columnId);
        if (columnEntry) newItem.values[columnId] = importedColumnValue(columnEntry, row[header]);
      });
      if (parentName) {
        const parentKey = `${target.id}:${normalizeSearchText(parentName)}`;
        let parent = importedParents.get(parentKey)
          || target.items.find((entry) => normalizeSearchText(entry.name) === normalizeSearchText(parentName));
        if (!parent) {
          parent = item(id('item'), target.id, parentName, {});
          parent.order = nextItemOrder(target.items);
          context.board.columns.forEach((columnEntry) => { parent.values[columnEntry.id] = columnEntry.type === 'checkbox' ? false : ''; });
          target.items.push(parent);
          createdIds.push(parent.id);
        }
        importedParents.set(parentKey, parent);
        parent.subitems = parent.subitems || [];
        newItem.order = nextItemOrder(parent.subitems);
        parent.subitems.push(newItem);
        parent.subitemsExpanded = true;
      } else {
        newItem.order = nextItemOrder(target.items);
        target.items.push(newItem);
      }
      createdIds.push(newItem.id);
      existingNames.add(duplicateKey);
      setOperationProgress('Organizando dados da planilha', 8 + ((rowIndex + 1) / preview.rows.length) * 42, `${rowIndex + 1} de ${preview.rows.length}`);
    });
    // Grupos criados automaticamente durante esta importacao, para que o
    // "desfazer lote" tambem possa remove-los quando ficarem vazios.
    const createdGroupIds = context.board.groups
      .filter((entry) => !groupIdsBeforeImport.has(entry.id))
      .map((entry) => entry.id);
    // Mesma protecao usada em addItem/duplicateItem: sem isso a hidratacao
    // remota disparada pelo render trata os itens importados como nao
    // carregados e limpa os valores que acabaram de ser preenchidos.
    createdIds.forEach((newId) => runtime.loadedItemValues.add(String(newId)));
    context.board.settings = context.board.settings || {};
    context.board.settings.import_batches = Array.isArray(context.board.settings.import_batches) ? context.board.settings.import_batches : [];
    context.board.settings.import_batches.push({
      id: id('import'),
      fileName: preview.fileName,
      groupId: fallbackGroup.id,
      itemIds: createdIds,
      columnIds: createdColumnIds,
      groupIds: createdGroupIds,
      createdAt: new Date().toISOString(),
      rolledBackAt: null,
    });
    context.board.settings.import_batches = context.board.settings.import_batches.slice(-20);
    runtime.importPreview = null;
    saveData('', { remote: false });
    render();
    try {
      setOperationProgress('Enviando importação ao servidor', 55, `${createdIds.length} registro(s)`);
      if (runtime.remoteMode && runtime.authClient) {
        const structureChanged = createdColumnIds.length > 0 || context.board.groups.length !== initialGroupCount;
        if (structureChanged) await syncRemoteData();
        else await persistRemoteItemsSoon(context, createdIds);
      }
      else saveData();
      setOperationProgress('Importação concluída', 100, `${createdIds.length} registro(s) · ${createdColumnIds.length} nova(s) coluna(s)`);
      toast(`${createdIds.length} item(ns) importado(s)${skipped ? ` · ${skipped} duplicado(s) ignorado(s)` : ''}`);
    } catch (error) {
      setOperationProgress('Importação salva localmente', 100, 'A sincronização será repetida automaticamente.');
    } finally {
      clearOperationProgress();
    }
  }

  function removeImportedItems(collection, ids) {
    let removed = 0;
    for (let index = collection.length - 1; index >= 0; index -= 1) {
      const entry = collection[index];
      removed += removeImportedItems(entry.subitems || [], ids);
      if (ids.has(entry.id)) {
        collection.splice(index, 1);
        removed += 1;
      }
    }
    return removed;
  }

  function rollbackImport(batchId) {
    const context = findBoard();
    const batches = Array.isArray(context?.board?.settings?.import_batches) ? context.board.settings.import_batches : [];
    const batch = batches.find((entry) => entry.id === batchId && !entry.rolledBackAt);
    if (!batch || !requirePermission('delete', context, 'desfazer esta importação')) return;
    const ids = new Set(batch.itemIds || []);
    const removed = context.board.groups.reduce((total, groupEntry) => total + removeImportedItems(groupEntry.items, ids), 0);

    // Desfazer tambem a estrutura criada pelo lote. Antes so os itens eram
    // removidos: as colunas novas e os grupos criados automaticamente ficavam
    // no quadro para sempre, mesmo com a interface dizendo que o lote foi
    // revertido por completo.
    const columnIds = new Set((batch.columnIds || []).filter(Boolean));
    let removedColumns = 0;
    if (columnIds.size) {
      const before = context.board.columns.length;
      context.board.columns = context.board.columns.filter((entry) => !columnIds.has(entry.id));
      removedColumns = before - context.board.columns.length;
      const clearValues = (entries = []) => entries.forEach((entry) => {
        columnIds.forEach((columnId) => { delete entry.values?.[columnId]; });
        clearValues(entry.subitems || []);
      });
      context.board.groups.forEach((groupEntry) => clearValues(groupEntry.items));
    }

    const groupIds = new Set((batch.groupIds || []).filter(Boolean));
    let removedGroups = 0;
    if (groupIds.size) {
      const before = context.board.groups.length;
      // Preservar grupos que receberam conteudo depois da importacao.
      context.board.groups = context.board.groups.filter((entry) => !(groupIds.has(entry.id) && !(entry.items || []).length));
      removedGroups = before - context.board.groups.length;
    }

    batch.rolledBackAt = new Date().toISOString();
    closeOverlay();
    const details = [`${removed} registro(s)`];
    if (removedColumns) details.push(`${removedColumns} coluna(ns)`);
    if (removedGroups) details.push(`${removedGroups} grupo(s) vazio(s)`);
    saveData(`Importação revertida: ${details.join(' · ')} removido(s)`, { scope: 'board' });
    render();
  }

  function openAddViewModal() {
    const availableViews = Object.entries(VIEW_TYPES);
    openModal({
      title: 'Adicionar visualização',
      subtitle: 'Escolha outra forma de trabalhar com o mesmo quadro.',
      body: `<div class="atlas-v2-choice-grid">${availableViews.map(([key, value]) => `<button class="atlas-v2-choice" type="button" data-action="enable-view" data-view="${key}"><span><i data-lucide="${value.icon}"></i><b>${escapeHtml(value.label)}</b></span></button>`).join('')}</div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Fechar</button>`,
    });
  }

  function boardAutomations(boardId = runtime.data.activeBoardId) {
    return (runtime.data?.automations || []).filter((entry) => entry.boardId === boardId);
  }

  function automationColumnLabel(boardEntry, columnId) {
    if (columnId === '__name__') return 'Nome do item';
    if (columnId === '__group__') return 'Setor';
    return boardEntry?.columns?.find((entry) => entry.id === columnId)?.name || 'Campo';
  }

  function automationTriggerLabel(boardEntry, trigger = {}) {
    const type = trigger.type || 'item_created';
    if (type === 'item_created') return 'Quando um item for criado';
    if (type === 'field_changed') {
      const column = automationColumnLabel(boardEntry, trigger.columnId);
      return trigger.value !== undefined && String(trigger.value) !== ''
        ? `Quando ${column} mudar para “${String(trigger.value)}”`
        : `Quando ${column} for alterado`;
    }
    if (type === 'group_changed') {
      const groupEntry = boardEntry?.groups?.find((entry) => entry.id === trigger.groupId);
      return groupEntry ? `Quando o item for movido para ${groupEntry.name}` : 'Quando o item mudar de setor';
    }
    if (type === 'item_moved_in') return 'Quando um item chegar de outro quadro';
    if (type === 'date_reached') {
      const column = automationColumnLabel(boardEntry, trigger.columnId);
      const offset = Number(trigger.offsetDays || 0);
      return offset === 0 ? `Quando chegar a data de ${column}` : `${Math.abs(offset)} dia(s) ${offset < 0 ? 'antes' : 'depois'} de ${column}`;
    }
    if (type === 'scheduled') return `Em agenda ${trigger.frequency === 'hourly' ? 'a cada hora' : trigger.frequency === 'weekly' ? 'semanal' : 'diária'}${trigger.time ? ` às ${trigger.time}` : ''}`;
    return 'Quando o item for alterado';
  }

  function automationActionLabel(boardEntry, action = {}) {
    if (action.type === 'set_value') return `definir ${automationColumnLabel(boardEntry, action.columnId)} como “${String(action.value ?? '')}”`;
    if (action.type === 'move_group') return `mover para ${boardEntry?.groups?.find((entry) => entry.id === action.groupId)?.name || 'outro setor'}`;
    if (action.type === 'move_board') {
      const destination = findBoard(action.boardId);
      const groupEntry = destination?.board.groups.find((entry) => entry.id === action.groupId);
      return `mover para ${destination?.board.name || 'outro quadro'}${groupEntry ? ` / ${groupEntry.name}` : ''}`;
    }
    if (action.type === 'notify') return `enviar notificação: ${action.title || 'Atualização do item'}`;
    if (action.type === 'create_subitem') return `criar subitem “${action.name || 'Novo subitem'}”`;
    if (action.type === 'rename_item') return `renomear o item para “${action.value || ''}”`;
    if (action.type === 'archive_item') return 'arquivar o item';
    return 'executar ação configurada';
  }

  function automationSummary(boardEntry, automation) {
    const condition = automation.conditions?.[0];
    const conditionText = condition
      ? `, se ${automationColumnLabel(boardEntry, condition.columnId)} ${({ equals: 'for igual a', not_equals: 'for diferente de', contains: 'contiver', is_empty: 'estiver vazio', not_empty: 'não estiver vazio', greater_than: 'for maior que', less_than: 'for menor que' })[condition.operator] || 'atender à condição'} ${condition.value !== undefined && condition.value !== '' ? `“${condition.value}”` : ''}`
      : '';
    const actions = (automation.actions || []).map((entry) => automationActionLabel(boardEntry, entry)).join(' e ');
    return `${automationTriggerLabel(boardEntry, automation.trigger)}${conditionText}, ${actions || 'sem ação configurada'}.`;
  }

  function automationColumnOptions(boardEntry, selected = '', includeSpecial = false) {
    const special = includeSpecial ? `<option value="__name__" ${selected === '__name__' ? 'selected' : ''}>Nome do item</option><option value="__group__" ${selected === '__group__' ? 'selected' : ''}>Setor</option>` : '';
    return `${special}${(boardEntry?.columns || []).map((entry) => `<option value="${attr(entry.id)}" ${entry.id === selected ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}`;
  }

  function automationGroupOptions(boardEntry, selected = '') {
    return (boardEntry?.groups || []).map((entry) => `<option value="${attr(entry.id)}" ${entry.id === selected ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('');
  }

  function openAutomationsDrawer() {
    const context = findBoard();
    if (!context) return;
    const entries = boardAutomations(context.board.id);
    const cards = entries.map((entry) => `<article class="atlas-v2-automation-card ${entry.active === false ? 'is-disabled' : ''}">
      <div class="atlas-v2-automation-state"><i data-lucide="${entry.active === false ? 'pause-circle' : 'zap'}"></i></div>
      <div class="atlas-v2-automation-copy"><strong>${escapeHtml(entry.name)}</strong><p>${escapeHtml(automationSummary(context.board, entry))}</p><small>${entry.active === false ? 'Pausada' : 'Ativa'}</small></div>
      <div class="atlas-v2-automation-actions">
        <button class="atlas-v2-icon-button" type="button" data-action="automation-run" data-automation-id="${attr(entry.id)}" title="Executar em um item"><i data-lucide="play"></i></button>
        <button class="atlas-v2-icon-button" type="button" data-action="automation-toggle" data-automation-id="${attr(entry.id)}" title="${entry.active === false ? 'Ativar' : 'Pausar'}"><i data-lucide="${entry.active === false ? 'toggle-left' : 'toggle-right'}"></i></button>
        <button class="atlas-v2-icon-button" type="button" data-action="automation-edit" data-automation-id="${attr(entry.id)}" title="Editar"><i data-lucide="pencil"></i></button>
        <button class="atlas-v2-icon-button is-danger" type="button" data-action="automation-delete" data-automation-id="${attr(entry.id)}" title="Excluir"><i data-lucide="trash-2"></i></button>
      </div>
    </article>`).join('');
    openDrawer({
      title: 'Automações',
      subtitle: `${context.board.name} · ${entries.length} regra(s)`,
      body: `<div class="atlas-v2-automation-intro"><i data-lucide="workflow"></i><div><strong>Regras sem código</strong><p>Os gatilhos são executados no Supabase, inclusive quando a alteração vier de outro usuário.</p></div></div><div class="atlas-v2-automation-list">${cards || '<div class="atlas-v2-empty-view"><div><i data-lucide="workflow"></i><strong>Nenhuma automação neste quadro</strong><span>Crie uma regra para mover, preencher ou avisar automaticamente.</span></div></div>'}</div>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="automation-history"><i data-lucide="history"></i>Histórico</button><button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="automation-templates"><i data-lucide="layout-template"></i>Modelos</button><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-action="automation-new"><i data-lucide="plus"></i>Nova automação</button>`,
    });
  }

  // Redesenha a lista de Automações se (e somente se) ela estiver aberta na
  // tela neste momento. Chamado quando uma automação muda em tempo real: o
  // patch em memória sozinho nao adianta se a pessoa esta justamente olhando
  // a lista - ela ficaria vendo um dado velho. Nao redesenha se houver um
  // formulario de automacao aberto por cima: isso apagaria o que a pessoa
  // esta preenchendo, exatamente o tipo de "jumpscare" corrigido na V2.3.2.
  function refreshOpenAutomationsPanel() {
    const root = document.getElementById('atlas-v2-overlay-root');
    if (!root?.querySelector('.atlas-v2-automation-list')) return;
    if (root.querySelector('#atlas-v2-automation-form')) return;
    openAutomationsDrawer();
  }

  function automationEditorVisibility() {
    const form = document.getElementById('atlas-v2-automation-form');
    if (!form) return;
    const triggerType = form.elements.triggerType?.value || 'item_created';
    const actionType = form.elements.actionType?.value || 'set_value';
    const action2Type = form.elements.action2Type?.value || 'set_value';
    form.querySelectorAll('[data-trigger-field]').forEach((entry) => { entry.hidden = entry.dataset.triggerField !== triggerType; });
    form.querySelectorAll('[data-action-field]').forEach((entry) => { entry.hidden = entry.dataset.actionField !== actionType; });
    form.querySelectorAll('[data-action2-field]').forEach((entry) => { entry.hidden = entry.dataset.action2Field !== action2Type; });
    form.querySelector('[data-action2-fields]')?.toggleAttribute('hidden', !form.elements.action2Enabled?.checked);
    const conditionEnabled = Boolean(form.elements.conditionEnabled?.checked);
    form.querySelector('[data-condition-fields]')?.toggleAttribute('hidden', !conditionEnabled);
    const recipient = form.elements.notifyRecipient?.value || 'current_user';
    form.querySelector('[data-notify-user]')?.toggleAttribute('hidden', recipient !== 'user');
    form.querySelector('[data-notify-column]')?.toggleAttribute('hidden', recipient !== 'responsible');
  }

  function openAutomationEditor(automationId = '', preset = null) {
    const context = findBoard();
    if (!context) return;
    const existing = boardAutomations(context.board.id).find((entry) => entry.id === automationId) || preset || null;
    const trigger = existing?.trigger || { type: 'item_created' };
    const condition = existing?.conditions?.[0] || {};
    const secondCondition = existing?.conditions?.[1] || {};
    const action = existing?.actions?.[0] || { type: 'set_value' };
    const secondAction = existing?.actions?.[1] || {};
    const users = (runtime.data.users || []).filter((entry) => entry.status === 'active');
    const firstColumn = context.board.columns[0]?.id || '';
    const firstGroup = context.board.groups[0]?.id || '';
    openModal({
      title: existing?.id ? 'Editar automação' : 'Nova automação',
      subtitle: context.board.name,
      body: `<form id="atlas-v2-automation-form" class="atlas-v2-automation-form">
        <input type="hidden" name="automationId" value="${attr(existing?.id || '')}">
        <label class="atlas-v2-field is-wide"><span>Nome da regra</span><input name="name" maxlength="100" required autofocus value="${attr(existing?.name || '')}" placeholder="Ex.: Concluir e mover automaticamente"></label>
        <section class="atlas-v2-rule-block"><header><b>1</b><span>Quando isto acontecer</span></header>
          <label class="atlas-v2-field is-wide"><span>Gatilho</span><select name="triggerType">
            <option value="item_created" ${trigger.type === 'item_created' ? 'selected' : ''}>Um item for criado</option>
            <option value="field_changed" ${trigger.type === 'field_changed' ? 'selected' : ''}>Um campo for alterado</option>
            <option value="group_changed" ${trigger.type === 'group_changed' ? 'selected' : ''}>O item mudar de setor</option>
            <option value="item_moved_in" ${trigger.type === 'item_moved_in' ? 'selected' : ''}>Um item chegar de outro quadro</option>
            <option value="date_reached" ${trigger.type === 'date_reached' ? 'selected' : ''}>Uma data chegar</option>
            <option value="scheduled" ${trigger.type === 'scheduled' ? 'selected' : ''}>Em um horário agendado</option>
          </select></label>
          <div class="atlas-v2-rule-grid" data-trigger-field="field_changed"><label class="atlas-v2-field"><span>Campo</span><select name="triggerColumnId">${automationColumnOptions(context.board, trigger.columnId || firstColumn)}</select></label><label class="atlas-v2-field"><span>Valor de destino (opcional)</span><input name="triggerValue" value="${attr(trigger.value ?? '')}" placeholder="Ex.: Concluído"></label></div>
          <div class="atlas-v2-rule-grid" data-trigger-field="group_changed"><label class="atlas-v2-field is-wide"><span>Setor de destino</span><select name="triggerGroupId"><option value="">Qualquer setor</option>${automationGroupOptions(context.board, trigger.groupId || '')}</select></label></div>
          <div class="atlas-v2-rule-grid" data-trigger-field="date_reached"><label class="atlas-v2-field"><span>Coluna de data</span><select name="triggerDateColumnId">${automationColumnOptions(context.board, trigger.columnId || firstColumn)}</select></label><label class="atlas-v2-field"><span>Deslocamento em dias</span><input name="triggerOffsetDays" type="number" min="-365" max="365" value="${Number(trigger.offsetDays || 0)}"><small>-1 = um dia antes; 0 = no dia</small></label></div>
          <div class="atlas-v2-rule-grid" data-trigger-field="scheduled"><label class="atlas-v2-field"><span>Frequência</span><select name="triggerFrequency"><option value="hourly" ${trigger.frequency === 'hourly' ? 'selected' : ''}>A cada hora</option><option value="daily" ${trigger.frequency === 'daily' || !trigger.frequency ? 'selected' : ''}>Diariamente</option><option value="weekly" ${trigger.frequency === 'weekly' ? 'selected' : ''}>Semanalmente</option></select></label><label class="atlas-v2-field"><span>Horário</span><input name="triggerTime" type="time" value="${attr(trigger.time || '08:00')}"></label></div>
        </section>
        <section class="atlas-v2-rule-block"><header><b>2</b><span>Somente se</span><label class="atlas-v2-switch"><input type="checkbox" name="conditionEnabled" ${existing?.conditions?.length ? 'checked' : ''}><span></span></label></header>
          <div class="atlas-v2-rule-grid" data-condition-fields ${existing?.conditions?.length ? '' : 'hidden'}><label class="atlas-v2-field"><span>Campo</span><select name="conditionColumnId">${automationColumnOptions(context.board, condition.columnId || firstColumn, true)}</select></label><label class="atlas-v2-field"><span>Operador</span><select name="conditionOperator"><option value="equals" ${condition.operator === 'equals' ? 'selected' : ''}>Igual a</option><option value="not_equals" ${condition.operator === 'not_equals' ? 'selected' : ''}>Diferente de</option><option value="contains" ${condition.operator === 'contains' ? 'selected' : ''}>Contém</option><option value="is_empty" ${condition.operator === 'is_empty' ? 'selected' : ''}>Está vazio</option><option value="not_empty" ${condition.operator === 'not_empty' ? 'selected' : ''}>Não está vazio</option><option value="greater_than" ${condition.operator === 'greater_than' ? 'selected' : ''}>Maior que</option><option value="less_than" ${condition.operator === 'less_than' ? 'selected' : ''}>Menor que</option></select></label><label class="atlas-v2-field is-wide"><span>Valor</span><input name="conditionValue" value="${attr(condition.value ?? '')}"></label></div>
        </section>
        <section class="atlas-v2-rule-block"><header><b>3</b><span>Então executar</span></header>
          <label class="atlas-v2-field is-wide"><span>Ação</span><select name="actionType"><option value="set_value" ${action.type === 'set_value' ? 'selected' : ''}>Preencher ou alterar um campo</option><option value="move_group" ${action.type === 'move_group' ? 'selected' : ''}>Mover o item para um setor</option><option value="move_board" ${action.type === 'move_board' ? 'selected' : ''}>Mover o item para outro quadro</option><option value="notify" ${action.type === 'notify' ? 'selected' : ''}>Enviar uma notificação</option><option value="create_subitem" ${action.type === 'create_subitem' ? 'selected' : ''}>Criar um subitem</option><option value="rename_item" ${action.type === 'rename_item' ? 'selected' : ''}>Renomear o item</option><option value="archive_item" ${action.type === 'archive_item' ? 'selected' : ''}>Arquivar o item</option></select></label>
          <div class="atlas-v2-rule-grid" data-action-field="set_value"><label class="atlas-v2-field"><span>Campo</span><select name="actionColumnId">${automationColumnOptions(context.board, action.columnId || firstColumn)}</select></label><label class="atlas-v2-field"><span>Novo valor</span><input name="actionValue" value="${attr(action.value ?? '')}"></label></div>
          <div class="atlas-v2-rule-grid" data-action-field="move_group"><label class="atlas-v2-field is-wide"><span>Setor de destino</span><select name="actionGroupId">${automationGroupOptions(context.board, action.groupId || firstGroup)}</select></label></div>
          <div class="atlas-v2-rule-grid" data-action-field="move_board"><label class="atlas-v2-field is-wide"><span>Quadro e setor de destino</span><select name="actionBoardDestination"><option value="">Selecione...</option>${crossBoardDestinationOptions(context.board.id, action.boardId || '', action.groupId || '')}</select><small>Os campos serão associados por nome e tipo; campos ausentes serão criados no destino.</small></label></div>
          <div class="atlas-v2-rule-grid" data-action-field="notify"><label class="atlas-v2-field"><span>Destinatário</span><select name="notifyRecipient"><option value="current_user" ${action.recipient === 'current_user' ? 'selected' : ''}>Usuário que fez a alteração</option><option value="responsible" ${action.recipient === 'responsible' ? 'selected' : ''}>Responsável indicado em um campo</option><option value="user" ${action.recipient === 'user' ? 'selected' : ''}>Usuário específico</option><option value="board_members" ${action.recipient === 'board_members' ? 'selected' : ''}>Membros do quadro</option><option value="admins" ${action.recipient === 'admins' ? 'selected' : ''}>Administradores</option></select></label><label class="atlas-v2-field" data-notify-user><span>Usuário</span><select name="notifyUserId">${users.map((entry) => `<option value="${attr(entry.id)}" ${entry.id === action.userId ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select></label><label class="atlas-v2-field" data-notify-column><span>Campo responsável</span><select name="notifyColumnId">${automationColumnOptions(context.board, action.columnId || firstColumn)}</select></label><label class="atlas-v2-field is-wide"><span>Título</span><input name="notifyTitle" maxlength="120" value="${attr(action.title || 'Atualização em {{item}}')}"></label><label class="atlas-v2-field is-wide"><span>Mensagem</span><textarea name="notifyMessage" maxlength="500">${escapeHtml(action.message || 'A automação “{{automation}}” foi executada no quadro {{board}}.')}</textarea><small>Variáveis: {{item}}, {{board}}, {{automation}}, {{value}}</small></label></div>
          <div class="atlas-v2-rule-grid" data-action-field="create_subitem"><label class="atlas-v2-field is-wide"><span>Nome do subitem</span><input name="subitemName" maxlength="120" value="${attr(action.name || 'Novo subitem')}"></label></div>
          <div class="atlas-v2-rule-grid" data-action-field="rename_item"><label class="atlas-v2-field is-wide"><span>Novo nome</span><input name="renameValue" maxlength="160" value="${attr(action.value || '')}"></label></div>
        </section>
        <section class="atlas-v2-rule-block"><header><b>4</b><span>Condição e ação adicionais</span></header>
          <label class="atlas-v2-check-row"><input type="checkbox" name="condition2Enabled" ${existing?.conditions?.[1] ? 'checked' : ''}><span><strong>Exigir uma segunda condição</strong><small>As duas condições precisam ser verdadeiras.</small></span></label>
          <div class="atlas-v2-rule-grid"><label class="atlas-v2-field"><span>Campo da condição</span><select name="condition2ColumnId">${automationColumnOptions(context.board, secondCondition.columnId || firstColumn, true)}</select></label><label class="atlas-v2-field"><span>Operador</span><select name="condition2Operator"><option value="equals" ${secondCondition.operator === 'equals' ? 'selected' : ''}>Igual a</option><option value="not_equals" ${secondCondition.operator === 'not_equals' ? 'selected' : ''}>Diferente de</option><option value="contains" ${secondCondition.operator === 'contains' ? 'selected' : ''}>Contém</option><option value="is_empty" ${secondCondition.operator === 'is_empty' ? 'selected' : ''}>Está vazio</option><option value="not_empty" ${secondCondition.operator === 'not_empty' ? 'selected' : ''}>Não está vazio</option></select></label><label class="atlas-v2-field is-wide"><span>Valor</span><input name="condition2Value" value="${attr(secondCondition.value ?? '')}"></label></div>
          <label class="atlas-v2-check-row"><input type="checkbox" name="action2Enabled" ${existing?.actions?.[1] ? 'checked' : ''}><span><strong>Executar uma segunda ação</strong><small>Executada logo após a ação principal.</small></span></label>
          <div data-action2-fields ${existing?.actions?.[1] ? '' : 'hidden'}><div class="atlas-v2-rule-grid"><label class="atlas-v2-field is-wide"><span>Ação adicional</span><select name="action2Type"><option value="set_value" ${secondAction.type === 'set_value' ? 'selected' : ''}>Preencher campo</option><option value="move_group" ${secondAction.type === 'move_group' ? 'selected' : ''}>Mover para grupo</option><option value="move_board" ${secondAction.type === 'move_board' ? 'selected' : ''}>Mover para outro quadro</option><option value="create_subitem" ${secondAction.type === 'create_subitem' ? 'selected' : ''}>Criar subitem</option><option value="rename_item" ${secondAction.type === 'rename_item' ? 'selected' : ''}>Renomear item</option></select></label></div><div class="atlas-v2-rule-grid" data-action2-field="set_value"><label class="atlas-v2-field"><span>Campo</span><select name="action2ColumnId">${automationColumnOptions(context.board, secondAction.columnId || firstColumn)}</select></label><label class="atlas-v2-field"><span>Valor</span><input name="action2SetValue" value="${attr(secondAction.value ?? '')}"></label></div><div class="atlas-v2-rule-grid" data-action2-field="move_group"><label class="atlas-v2-field is-wide"><span>Grupo</span><select name="action2GroupId">${automationGroupOptions(context.board, secondAction.groupId || firstGroup)}</select></label></div><div class="atlas-v2-rule-grid" data-action2-field="move_board"><label class="atlas-v2-field is-wide"><span>Quadro e setor de destino</span><select name="action2BoardDestination"><option value="">Selecione...</option>${crossBoardDestinationOptions(context.board.id, secondAction.boardId || '', secondAction.groupId || '')}</select></label></div><div class="atlas-v2-rule-grid" data-action2-field="create_subitem"><label class="atlas-v2-field is-wide"><span>Nome do subitem</span><input name="action2CreateName" value="${attr(secondAction.name ?? '')}"></label></div><div class="atlas-v2-rule-grid" data-action2-field="rename_item"><label class="atlas-v2-field is-wide"><span>Novo nome</span><input name="action2RenameValue" value="${attr(secondAction.value ?? '')}"></label></div></div>
        </section>
        <label class="atlas-v2-check-row"><input type="checkbox" name="active" ${existing?.active === false ? '' : 'checked'}><span><strong>Automação ativa</strong><small>A regra começa a funcionar assim que for salva.</small></span></label>
      </form>`,
      actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="automations">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-automation-form"><i data-lucide="workflow"></i>Salvar automação</button>`,
    });
    automationEditorVisibility();
  }

  async function submitAutomation(form) {
    const context = findBoard();
    if (!context || !requirePermission('configure', context, 'salvar automações')) return;
    const data = new FormData(form);
    const automationId = String(data.get('automationId') || '');
    const triggerType = String(data.get('triggerType') || 'item_created');
    const trigger = { type: triggerType };
    if (triggerType === 'field_changed') {
      trigger.columnId = String(data.get('triggerColumnId') || '');
      const value = String(data.get('triggerValue') || '').trim();
      if (value) trigger.value = value;
    } else if (triggerType === 'group_changed') {
      trigger.groupId = String(data.get('triggerGroupId') || '');
    } else if (triggerType === 'date_reached') {
      trigger.columnId = String(data.get('triggerDateColumnId') || '');
      trigger.offsetDays = Number(data.get('triggerOffsetDays') || 0);
    } else if (triggerType === 'scheduled') {
      trigger.frequency = String(data.get('triggerFrequency') || 'daily');
      trigger.time = String(data.get('triggerTime') || '08:00');
    }
    const conditions = [];
    if (data.get('conditionEnabled')) conditions.push({ columnId: String(data.get('conditionColumnId') || ''), operator: String(data.get('conditionOperator') || 'equals'), value: String(data.get('conditionValue') || '') });
    if (data.get('condition2Enabled')) conditions.push({ columnId: String(data.get('condition2ColumnId') || ''), operator: String(data.get('condition2Operator') || 'equals'), value: String(data.get('condition2Value') || '') });
    const actionType = String(data.get('actionType') || 'set_value');
    const action = { type: actionType };
    if (actionType === 'set_value') { action.columnId = String(data.get('actionColumnId') || ''); action.value = String(data.get('actionValue') || ''); }
    if (actionType === 'move_group') action.groupId = String(data.get('actionGroupId') || '');
    if (actionType === 'move_board') {
      [action.boardId, action.groupId] = String(data.get('actionBoardDestination') || '').split('|');
      action.createMissingColumns = true;
      if (!action.boardId || !action.groupId) { toast('Selecione o quadro e o setor de destino.', true); return; }
    }
    if (actionType === 'notify') { action.recipient = String(data.get('notifyRecipient') || 'current_user'); action.userId = String(data.get('notifyUserId') || ''); action.columnId = String(data.get('notifyColumnId') || ''); action.title = String(data.get('notifyTitle') || '').trim(); action.message = String(data.get('notifyMessage') || '').trim(); }
    if (actionType === 'create_subitem') action.name = String(data.get('subitemName') || 'Novo subitem').trim();
    if (actionType === 'rename_item') action.value = String(data.get('renameValue') || '').trim();
    const actions = [action];
    if (data.get('action2Enabled')) {
      const secondType = String(data.get('action2Type') || 'set_value');
      const second = { type: secondType };
      if (secondType === 'set_value') { second.columnId = String(data.get('action2ColumnId') || ''); second.value = String(data.get('action2SetValue') || ''); }
      if (secondType === 'move_group') second.groupId = String(data.get('action2GroupId') || '');
      if (secondType === 'move_board') {
        [second.boardId, second.groupId] = String(data.get('action2BoardDestination') || '').split('|');
        second.createMissingColumns = true;
        if (!second.boardId || !second.groupId) { toast('Selecione o destino da segunda ação.', true); return; }
      }
      if (secondType === 'create_subitem') second.name = String(data.get('action2CreateName') || 'Novo subitem').trim();
      if (secondType === 'rename_item') second.value = String(data.get('action2RenameValue') || '').trim();
      actions.push(second);
    }
    const entry = {
      id: automationId || id('automation'), boardId: context.board.id, name: String(data.get('name') || '').trim() || 'Automação sem nome', trigger, conditions, actions, active: Boolean(data.get('active')), createdBy: currentUser()?.id || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    runtime.data.automations = runtime.data.automations || [];
    const index = runtime.data.automations.findIndex((candidate) => candidate.id === automationId);
    const previousEntry = index >= 0 ? deepClone(runtime.data.automations[index]) : null;
    if (index >= 0) entry.createdAt = runtime.data.automations[index].createdAt || entry.createdAt;
    if (index >= 0) runtime.data.automations[index] = entry; else runtime.data.automations.push(entry);
    const message = index >= 0 ? 'Automação atualizada' : 'Automação criada';

    if (!runtime.remoteMode || !runtime.authClient) {
      closeOverlay();
      saveData(message);
      openAutomationsDrawer();
      return;
    }

    const submitButton = document.querySelector('[type="submit"][form="atlas-v2-automation-form"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<i data-lucide="loader-circle"></i>Salvando regra';
      refreshIcons(submitButton);
    }

    recordAudit(message);
    saveData('', { remote: false, audit: false });
    clearTimeout(runtime.remoteSyncTimer);
    let synced = false;
    try {
      for (let attempt = 0; runtime.remoteSyncing && attempt < 80; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      synced = !runtime.remoteSyncing && await syncRemoteData();
    } catch (error) {
      console.error('Atlas V2: falha inesperada ao salvar automação.', error);
    }
    if (!synced) {
      if (previousEntry) runtime.data.automations[index] = previousEntry;
      else runtime.data.automations = runtime.data.automations.filter((candidate) => candidate.id !== entry.id);
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i data-lucide="workflow"></i>Salvar automação';
        refreshIcons(submitButton);
      }
      toast('A automação não foi salva no Supabase. Revise a conexão e tente novamente.', true);
      return;
    }

    closeOverlay();
    toast(message);
    openAutomationsDrawer();
  }

  function toggleAutomation(automationId) {
    const entry = (runtime.data.automations || []).find((candidate) => candidate.id === automationId);
    if (!entry) return;
    entry.active = entry.active === false;
    entry.updatedAt = new Date().toISOString();
    saveData(entry.active ? 'Automação ativada' : 'Automação pausada');
    openAutomationsDrawer();
  }

  function deleteAutomation(automationId) {
    const entry = (runtime.data.automations || []).find((candidate) => candidate.id === automationId);
    if (!entry) return;
    openModal({ title: 'Excluir automação', subtitle: entry.name, body: '<div class="atlas-v2-confirm-card"><i data-lucide="triangle-alert"></i><div><strong>A regra deixará de ser executada.</strong><p>O histórico de execuções será preservado para auditoria.</p></div></div>', actions: `<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="automations">Cancelar</button><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-action="automation-confirm-delete" data-automation-id="${attr(entry.id)}"><i data-lucide="trash-2"></i>Excluir</button>` });
  }

  function confirmDeleteAutomation(automationId) {
    runtime.data.automations = (runtime.data.automations || []).filter((entry) => entry.id !== automationId);
    closeOverlay();
    saveData('Automação excluída');
    openAutomationsDrawer();
  }

  function automationTemplates() {
    const context = findBoard();
    const statusColumn = context?.board.columns.find((entry) => entry.type === 'status');
    const dateColumn = context?.board.columns.find((entry) => entry.type === 'date');
    const completedGroup = context?.board.groups.find((entry) => /conclu|finaliz/i.test(entry.name));
    openModal({
      title: 'Modelos de automação', subtitle: 'Comece com uma regra pronta e ajuste os campos.',
      body: `<div class="atlas-v2-choice-grid"><button class="atlas-v2-choice" type="button" data-action="automation-use-template" data-template="complete-move"><span><i data-lucide="circle-check-big"></i><b>Concluir e mover</b></span><small>Quando o status mudar para Concluído, mover ao setor final.</small></button><button class="atlas-v2-choice" type="button" data-action="automation-use-template" data-template="due-notify"><span><i data-lucide="calendar-clock"></i><b>Aviso de prazo</b></span><small>Na data prevista, enviar uma notificação.</small></button><button class="atlas-v2-choice" type="button" data-action="automation-use-template" data-template="new-default"><span><i data-lucide="sparkles"></i><b>Valor inicial</b></span><small>Ao criar um item, preencher o status padrão.</small></button></div>`,
      actions: '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="automations">Voltar</button>',
    });
    runtime.automationTemplateContext = { statusColumnId: statusColumn?.id || context?.board.columns[0]?.id || '', dateColumnId: dateColumn?.id || context?.board.columns[0]?.id || '', completedGroupId: completedGroup?.id || context?.board.groups.at(-1)?.id || '' };
  }

  function useAutomationTemplate(template) {
    const context = findBoard();
    const meta = runtime.automationTemplateContext || {};
    let preset = null;
    if (template === 'complete-move') preset = { name: 'Concluir e mover automaticamente', trigger: { type: 'field_changed', columnId: meta.statusColumnId, value: 'Concluído' }, conditions: [], actions: [{ type: 'move_group', groupId: meta.completedGroupId }], active: true };
    if (template === 'due-notify') preset = { name: 'Avisar quando o prazo chegar', trigger: { type: 'date_reached', columnId: meta.dateColumnId, offsetDays: 0 }, conditions: [], actions: [{ type: 'notify', recipient: 'admins', title: 'Prazo de {{item}}', message: 'O prazo do item {{item}} chegou no quadro {{board}}.' }], active: true };
    if (template === 'new-default') preset = { name: 'Definir status inicial', trigger: { type: 'item_created' }, conditions: [], actions: [{ type: 'set_value', columnId: meta.statusColumnId, value: 'Não iniciado' }], active: true };
    closeOverlay();
    openAutomationEditor('', preset);
  }

  function openAutomationRunModal(automationId) {
    const context = findBoard();
    const automation = boardAutomations(context?.board.id).find((entry) => entry.id === automationId);
    if (!context || !automation) return;
    const items = context.board.groups.flatMap((groupEntry) => groupEntry.items.flatMap((itemEntry) => [itemEntry, ...(itemEntry.subitems || [])]));
    openModal({ title: 'Executar automação', subtitle: automation.name, body: `<form id="atlas-v2-automation-run-form"><input type="hidden" name="automationId" value="${attr(automation.id)}"><label class="atlas-v2-field"><span>Item</span><select name="itemId" required>${items.map((entry) => `<option value="${attr(entry.id)}">${escapeHtml(entry.name)}</option>`).join('')}</select></label></form>`, actions: '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="automations">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-v2-automation-run-form"><i data-lucide="play"></i>Executar agora</button>' });
  }

  async function submitAutomationRun(form) {
    const data = new FormData(form);
    const automationId = String(data.get('automationId') || '');
    const itemId = String(data.get('itemId') || '');
    if (!automationId || !itemId) return;
    if (runtime.remoteMode && runtime.authClient) {
      try {
        await syncRemoteData();
        const { data: result, error } = await runtime.authClient.rpc('atlas_v2_run_automation_manual', { target_automation: automationId, target_item: itemId });
        if (error) throw error;
        if (!result || result.success !== true) throw new Error(result?.error || 'A automação não confirmou nenhuma execução.');
        closeOverlay();
        toast('Automação executada');
        await refreshRemoteApplication(runtime.authProfile, runtime.authSession?.user, { full: true, silent: true });
        await refreshNotifications();
      } catch (error) { toast(`Falha ao executar automação: ${error.message || error}`, true); }
      return;
    }
    const context = findBoard();
    const found = context && findItem(context.board, itemId);
    const automation = boardAutomations(context?.board.id).find((entry) => entry.id === automationId);
    const executed = Boolean(found && automation && executeLocalAutomation(automation, context.board, found.item, { eventType: 'manual' }));
    closeOverlay(); saveData(executed ? 'Automação executada' : 'Automação não aplicada'); render();
    if (!executed) toast('A automação não foi aplicada a este item.', true);
  }

  function templateText(value, context = {}) {
    return String(value || '').replace(/\{\{item\}\}/g, context.item || '').replace(/\{\{board\}\}/g, context.board || '').replace(/\{\{automation\}\}/g, context.automation || '').replace(/\{\{value\}\}/g, context.value ?? '');
  }

  function localConditionValue(boardEntry, itemEntry, columnId) {
    if (columnId === '__name__') return itemEntry.name || '';
    if (columnId === '__group__') return itemEntry.groupId || '';
    return itemEntry.values?.[columnId] ?? '';
  }

  function localConditionMatches(boardEntry, itemEntry, condition) {
    const actual = localConditionValue(boardEntry, itemEntry, condition.columnId);
    const expected = condition.value ?? '';
    const operator = condition.operator || 'equals';
    if (operator === 'equals') return String(actual) === String(expected);
    if (operator === 'not_equals') return String(actual) !== String(expected);
    if (operator === 'contains') return String(actual).toLowerCase().includes(String(expected).toLowerCase());
    if (operator === 'is_empty') return actual === '' || actual === null || actual === undefined;
    if (operator === 'not_empty') return !(actual === '' || actual === null || actual === undefined);
    if (operator === 'greater_than') return Number(actual) > Number(expected);
    if (operator === 'less_than') return Number(actual) < Number(expected);
    return true;
  }

  function localTriggerMatches(automation, payload) {
    const trigger = automation.trigger || {};
    if (trigger.type === 'item_created') return payload.eventType === 'item_created';
    if (trigger.type === 'field_changed') return payload.eventType === 'field_changed' && payload.columnId === trigger.columnId && (trigger.value === undefined || String(payload.newValue) === String(trigger.value));
    if (trigger.type === 'group_changed') return payload.eventType === 'group_changed' && (!trigger.groupId || payload.newGroupId === trigger.groupId);
    if (trigger.type === 'item_moved_in') return payload.eventType === 'item_moved_in';
    if (trigger.type === 'scheduled') return payload.eventType === 'scheduled';
    return payload.eventType === 'manual';
  }

  function executeLocalAutomation(automation, boardEntry, itemEntry, payload = {}) {
    if (automation.active === false || !localTriggerMatches(automation, payload)) return false;
    if (!(automation.conditions || []).every((condition) => localConditionMatches(boardEntry, itemEntry, condition))) return false;
    const context = { item: itemEntry.name, board: boardEntry.name, automation: automation.name, value: payload.newValue ?? '' };
    const orderedActions = [...(automation.actions || [])].sort((left, right) => Number(left.type === 'move_board') - Number(right.type === 'move_board'));
    const initialFound = findItem(boardEntry, itemEntry.id);
    if (initialFound?.parent && orderedActions.some((action) => action.type === 'move_group')) return false;
    orderedActions.forEach((action) => {
      if (action.type === 'set_value' && action.columnId) itemEntry.values[action.columnId] = action.value ?? '';
      if (action.type === 'move_group' && action.groupId) {
        const found = findItem(boardEntry, itemEntry.id); const target = boardEntry.groups.find((entry) => entry.id === action.groupId);
        if (found && target && !found.parent) { found.collection.splice(found.collection.indexOf(found.item), 1); found.item.groupId = target.id; target.items.push(found.item); }
      }
      if (action.type === 'move_board' && action.boardId && action.groupId) {
        const targetContext = findBoard(action.boardId);
        if (targetContext) {
          moveItemsBetweenBoardsLocal([itemEntry.id], targetContext, action.groupId, action.createMissingColumns !== false);
          boardAutomations(targetContext.board.id).forEach((destinationAutomation) => executeLocalAutomation(destinationAutomation, targetContext.board, itemEntry, {
            eventType: 'item_moved_in', oldBoardId: boardEntry.id, newBoardId: targetContext.board.id, newGroupId: action.groupId,
          }));
        }
      }
      if (action.type === 'rename_item') itemEntry.name = templateText(action.value, context) || itemEntry.name;
      if (action.type === 'create_subitem') { const child = item(id('subitem'), itemEntry.groupId, templateText(action.name || 'Novo subitem', context), {}); boardEntry.columns.forEach((columnEntry) => { child.values[columnEntry.id] = columnEntry.type === 'checkbox' ? false : ''; }); itemEntry.subitems = itemEntry.subitems || []; itemEntry.subitems.push(child); }
      // Arquivar precisa ser reversivel, como no resto do Atlas e como o motor
      // remoto faz (update arquivado=true). Antes o item era removido do array
      // na hora, sem flag e sem lixeira: nao havia nenhuma forma de recuperar.
      if (action.type === 'archive_item') { const found = findItem(boardEntry, itemEntry.id); if (found) found.item.archived = true; }
      if (action.type === 'notify') {
        runtime.data.notifications = runtime.data.notifications || [];
        runtime.data.notifications.unshift({ id: id('notification'), userId: action.userId || currentUser()?.id || '', boardId: boardEntry.id, itemId: itemEntry.id, title: templateText(action.title || 'Atualização automática', context), message: templateText(action.message || '', context), type: 'automation', readAt: null, createdAt: new Date().toISOString() });
      }
    });
    return true;
  }

  function runLocalAutomations(eventType, boardEntry, itemEntry, payload = {}) {
    if (runtime.remoteMode) return;
    boardAutomations(boardEntry.id).forEach((automation) => executeLocalAutomation(automation, boardEntry, itemEntry, { ...payload, eventType }));
  }

  async function refreshNotifications() {
    if (!runtime.authClient || !runtime.authSession?.user || runtime.notificationsLoading) return;
    runtime.notificationsLoading = true;
    try {
      const { data, error } = await runtime.authClient.from('atlas_v2_notifications').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      runtime.data.notifications = (data || []).map((entry) => ({ id: entry.id, userId: entry.user_id, boardId: entry.board_id, itemId: entry.item_id, title: entry.titulo, message: entry.mensagem, type: entry.tipo, data: entry.dados || {}, readAt: entry.lida_em, createdAt: entry.created_at }));
      renderNotificationDot();
    } catch (_) {
      runtime.data.notifications = runtime.data.notifications || [];
      renderNotificationDot();
    } finally { runtime.notificationsLoading = false; }
  }

  function renderNotificationDot() {
    const dot = document.querySelector('.atlas-v2-notification-dot');
    if (!dot) return;
    const unread = (runtime.data?.notifications || []).filter((entry) => !entry.readAt).length;
    dot.hidden = unread === 0;
    dot.dataset.count = String(unread);
    const button = dot.closest('button');
    if (button) button.title = unread ? `Notificações · ${unread} não lida(s)` : 'Notificações';
  }

  async function openNotificationsDrawer() {
    await refreshNotifications();
    const notifications = runtime.data.notifications || [];
    const filtered = notifications.filter((entry) => runtime.notificationFilter === 'unread' ? !entry.readAt : runtime.notificationFilter === 'automation' ? entry.type === 'automation' : runtime.notificationFilter === 'mention' ? entry.type === 'mention' : true);
    const rows = filtered.map((entry) => `<article class="atlas-v2-notification-card ${entry.readAt ? 'is-read' : ''}"><button type="button" data-action="notification-open" data-notification-id="${attr(entry.id)}" data-board-id="${attr(entry.boardId || '')}"><span class="atlas-v2-notification-icon"><i data-lucide="${entry.type === 'automation' ? 'workflow' : entry.type === 'sla' ? 'alarm-clock' : 'bell'}"></i></span><span><strong>${escapeHtml(entry.title || 'Notificação')}</strong><p>${escapeHtml(entry.message || '')}</p><small>${formatDateTime(entry.createdAt)}</small></span></button>${entry.readAt ? '' : `<button class="atlas-v2-icon-button" type="button" data-action="notification-read" data-notification-id="${attr(entry.id)}" title="Marcar como lida"><i data-lucide="check"></i></button>`}</article>`).join('');
    const filters = [['all', 'Todas'], ['unread', 'Não lidas'], ['mention', 'Menções'], ['automation', 'Automações']].map(([key, label]) => `<button class="${runtime.notificationFilter === key ? 'is-active' : ''}" type="button" data-action="notification-filter" data-notification-filter="${key}">${label}</button>`).join('');
    openDrawer({ title: 'Notificações', subtitle: `${notifications.filter((entry) => !entry.readAt).length} não lida(s)`, body: `<nav class="atlas-v2-notification-filters">${filters}</nav><div class="atlas-v2-notification-list">${rows || '<div class="atlas-v2-empty-view"><div><i data-lucide="bell-off"></i><strong>Nenhuma notificação neste filtro</strong><span>Alertas de SLA e automações aparecerão aqui.</span></div></div>'}</div>`, actions: notifications.some((entry) => !entry.readAt) ? '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="notifications-read-all"><i data-lucide="check-check"></i>Marcar todas como lidas</button>' : '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="close-overlay">Fechar</button>' });
  }

  async function markNotificationRead(notificationId, openBoardId = '') {
    const entry = (runtime.data.notifications || []).find((candidate) => candidate.id === notificationId);
    if (entry && !entry.readAt) entry.readAt = new Date().toISOString();
    if (runtime.remoteMode && runtime.authClient) {
      try {
        const { error } = await runtime.authClient.from('atlas_v2_notifications').update({ lida_em: new Date().toISOString() }).eq('id', notificationId);
        if (error) throw error;
      } catch (error) {
        console.warn('Atlas V2: não foi possível sincronizar a leitura da notificação.', error);
        toast('A notificação foi marcada apenas neste dispositivo. A sincronização será tentada novamente.', true);
      }
    }
    renderNotificationDot();
    closeOverlay();
    if (openBoardId) {
      openBoard(openBoardId);
      if (entry?.type === 'mention' && entry.itemId) requestAnimationFrame(() => { void openItemChat(entry.itemId); });
    }
  }

  async function markAllNotificationsRead() {
    const now = new Date().toISOString();
    (runtime.data.notifications || []).forEach((entry) => { if (!entry.readAt) entry.readAt = now; });
    if (runtime.remoteMode && runtime.authClient) {
      try {
        const { error } = await runtime.authClient.from('atlas_v2_notifications').update({ lida_em: now }).is('lida_em', null);
        if (error) throw error;
      } catch (error) {
        console.warn('Atlas V2: não foi possível sincronizar a leitura das notificações.', error);
        toast('As notificações foram marcadas apenas neste dispositivo.', true);
      }
    }
    renderNotificationDot();
    openNotificationsDrawer();
  }

  async function scanSlaNotifications() {
    if (!runtime.data || !currentUser()) return;
    const today = new Date().toISOString().slice(0, 10);
    const markKey = `atlas-v2-sla-marks:${currentUser().id}:${today}`;
    const marks = new Set(JSON.parse(localStorage.getItem(markKey) || '[]'));
    const created = [];
    runtime.data.workspaces.forEach((workspace) => workspace.modules.forEach((module) => module.boards.forEach((boardEntry) => {
      if (!hasPermission('view', { workspace, module, board: boardEntry })) return;
      flatBoardItems(boardEntry).forEach(({ item: itemEntry }) => {
        const state = boardSlaState(boardEntry, itemEntry);
        if (!state || !['late', 'warning'].includes(state.level)) return;
        const signature = `${boardEntry.id}:${itemEntry.id}:${state.level}`;
        if (marks.has(signature)) return;
        marks.add(signature);
        created.push({
          id: id('notification'),
          userId: currentUser().id,
          boardId: boardEntry.id,
          itemId: itemEntry.id,
          title: state.level === 'late' ? `Prazo vencido: ${itemEntry.name}` : `Prazo próximo: ${itemEntry.name}`,
          message: `${state.label} no quadro ${boardEntry.name}.`,
          type: 'sla',
          readAt: null,
          createdAt: new Date().toISOString(),
        });
      });
    })));
    if (!created.length) return;
    runtime.data.notifications = [...created, ...(runtime.data.notifications || [])];
    localStorage.setItem(markKey, JSON.stringify([...marks]));
    if (runtime.remoteMode && runtime.authClient && isUuid(currentUser().id)) {
      const rows = created.filter((entry) => isUuid(entry.boardId) && isUuid(entry.itemId)).map((entry) => ({
        user_id: currentUser().id,
        board_id: entry.boardId,
        item_id: entry.itemId,
        titulo: entry.title,
        mensagem: entry.message,
        tipo: 'sla',
        dados: { source: 'atlas-v2.1' },
      }));
      if (rows.length) {
        const { error } = await runtime.authClient.from('atlas_v2_notifications').insert(rows);
        if (error) console.warn('Atlas V2.1: avisos de SLA ficaram na fila local.', error);
      }
    }
    renderNotificationDot();
  }

  function runLocalScheduledAutomations() {
    if (runtime.remoteMode) return;
    const now = new Date();
    runtime.data.workspaces.forEach((workspace) => workspace.modules.forEach((module) => module.boards.forEach((boardEntry) => {
      boardAutomations(boardEntry.id).filter((entry) => entry.active !== false && entry.trigger?.type === 'scheduled').forEach((automation) => {
        const frequency = automation.trigger.frequency || 'daily';
        const [hour, minute] = String(automation.trigger.time || '08:00').split(':').map(Number);
        if (frequency !== 'hourly' && (now.getHours() < hour || (now.getHours() === hour && now.getMinutes() < minute))) return;
        const slot = frequency === 'hourly'
          ? now.toISOString().slice(0, 13)
          : frequency === 'weekly'
            ? `${now.getFullYear()}-W${Math.ceil((((now - new Date(now.getFullYear(), 0, 1)) / 86400000) + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)}`
            : now.toISOString().slice(0, 10);
        const key = `atlas-v2-schedule:${automation.id}:${slot}`;
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, '1');
        flatBoardItems(boardEntry).forEach(({ item: itemEntry }) => executeLocalAutomation(automation, boardEntry, itemEntry, { eventType: 'scheduled' }));
      });
    })));
  }

  function stopAutomationMonitor() {
    clearInterval(runtime.automationMonitorTimer);
    runtime.automationMonitorTimer = null;
    runtime.automationMonitorStartedAt = '';
  }

  function startAutomationMonitor() {
    if (!runtime.authClient || !runtime.authSession?.user || runtime.automationMonitorTimer) return;
    runtime.automationMonitorStartedAt = new Date().toISOString();
    const check = async () => {
      if (document.hidden || runtime.bootstrapRefreshing || !runtime.authClient) return;
      try {
        runLocalScheduledAutomations();
        const rpcResults = await Promise.all([
          runtime.authClient.rpc('atlas_v2_process_due_automations'),
          runtime.authClient.rpc('atlas_v2_process_scheduled_automations'),
        ]);
        const rpcFailure = rpcResults.find((result) => result?.error)?.error;
        if (rpcFailure) throw rpcFailure;
        const { data, error } = await runtime.authClient.from('atlas_v2_automation_runs').select('created_at,status').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!error && data?.created_at) {
          const current = String(data.created_at);
          const currentTime = new Date(current).getTime();
          const previousTime = runtime.lastAutomationRunAt ? new Date(runtime.lastAutomationRunAt).getTime() : 0;
          const monitorStartTime = runtime.automationMonitorStartedAt ? new Date(runtime.automationMonitorStartedAt).getTime() : 0;
          const isNewRun = currentTime > previousTime && (!previousTime ? currentTime >= monitorStartTime - 1000 : true);
          runtime.lastAutomationRunAt = current;
          if (isNewRun && data.status === 'success') {
            await refreshRemoteApplication(runtime.authProfile, runtime.authSession?.user, { full: false, silent: true });
            toast('Uma automação atualizou o quadro.');
          }
        }
        await refreshNotifications();
        await scanSlaNotifications();
      } catch (error) {
        console.warn('Atlas V2: monitor de automações indisponível.', error);
      }
    };
    setTimeout(check, 5000);
    runtime.automationMonitorTimer = setInterval(check, 15000);
  }


  async function openAutomationHistory() {
    const context = findBoard();
    if (!context) return;
    let runs = [];
    if (runtime.remoteMode && runtime.authClient) {
      try {
        const { data, error } = await runtime.authClient.from('atlas_v2_automation_runs').select('*').eq('board_id', context.board.id).order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        runs = data || [];
      } catch (error) { toast('Não foi possível carregar o histórico das automações.', true); }
    }
    const cards = runs.map((entry) => {
      const automation = (runtime.data.automations || []).find((candidate) => candidate.id === entry.automation_id);
      const found = entry.item_id ? findItem(context.board, entry.item_id) : null;
      return `<article class="atlas-v2-automation-run is-${attr(entry.status)}"><span><i data-lucide="${entry.status === 'success' ? 'circle-check' : entry.status === 'failed' ? 'circle-x' : entry.status === 'skipped' ? 'circle-minus' : 'loader-circle'}"></i></span><div><strong>${escapeHtml(automation?.name || 'Automação removida')}</strong><p>${escapeHtml(found?.item?.name || 'Item não disponível')} · ${escapeHtml(entry.event_type || 'evento')}</p><small>${formatDateTime(entry.created_at)}${entry.error_message ? ` · ${escapeHtml(entry.error_message)}` : ''}</small></div></article>`;
    }).join('');
    openDrawer({ title: 'Histórico das automações', subtitle: `${context.board.name} · últimas ${runs.length} execuções`, body: `<div class="atlas-v2-automation-runs">${cards || '<div class="atlas-v2-empty-view"><div><i data-lucide="history"></i><strong>Nenhuma execução registrada</strong><span>O histórico será preenchido quando uma regra for acionada.</span></div></div>'}</div>`, actions: '<button class="atlas-v2-button atlas-v2-button-quiet" type="button" data-action="automations"><i data-lucide="arrow-left"></i>Voltar</button>' });
  }


  function openModal({ title, subtitle, body, actions }) {
    const root = document.getElementById('atlas-v2-overlay-root');
    root.innerHTML = `<div class="atlas-v2-overlay" data-action="overlay-backdrop"><section class="atlas-v2-modal" role="dialog" aria-modal="true"><header class="atlas-v2-modal-head"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div><button class="atlas-v2-icon-button" type="button" data-action="close-overlay" title="Fechar"><i data-lucide="x"></i></button></header><div class="atlas-v2-modal-body">${body}</div><footer class="atlas-v2-modal-foot">${actions || ''}</footer></section></div>`;
    refreshIcons(root);
    requestAnimationFrame(() => root.querySelector('[autofocus]')?.focus());
  }

  function openDrawer({ title, subtitle, body, actions }) {
    const root = document.getElementById('atlas-v2-overlay-root');
    root.innerHTML = `<div class="atlas-v2-overlay" data-action="overlay-backdrop"><aside class="atlas-v2-drawer" role="dialog" aria-modal="true"><header class="atlas-v2-drawer-head"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div><button class="atlas-v2-icon-button" type="button" data-action="close-overlay" title="Fechar"><i data-lucide="x"></i></button></header><div class="atlas-v2-drawer-body">${body}</div><footer class="atlas-v2-drawer-foot">${actions || ''}</footer></aside></div>`;
    refreshIcons(root);
  }

  function closeOverlay() {
    const root = document.getElementById('atlas-v2-overlay-root');
    if (root) root.innerHTML = '';
    runtime.imageViewer = null;
  }

  function toast(message, error = false) {
    const region = document.getElementById('atlas-v2-toast-region');
    if (!region) return;
    const signature = `${error ? 'error' : 'ok'}:${String(message || '')}`;
    const duplicate = [...region.querySelectorAll('.atlas-v2-toast')]
      .find((entry) => entry.dataset.signature === signature);
    if (duplicate) return;
    const entry = document.createElement('div');
    entry.className = `atlas-v2-toast ${error ? 'is-error' : ''}`;
    entry.dataset.signature = signature;
    entry.innerHTML = `<i data-lucide="${error ? 'triangle-alert' : 'circle-check'}"></i><span>${escapeHtml(message)}</span>`;
    region.appendChild(entry);
    refreshIcons(entry);
    setTimeout(() => entry.remove(), 2600);
  }

  function openSidebar() {
    if (window.innerWidth <= 820) {
      document.body.classList.add('atlas-v2-sidebar-open');
      return;
    }
    document.body.classList.remove('atlas-v2-sidebar-collapsed');
    localStorage.setItem(SIDEBAR_KEY, 'false');
  }

  function closeSidebar() {
    document.body.classList.remove('atlas-v2-sidebar-open');
  }

  function toggleSidebar() {
    if (window.innerWidth <= 820) {
      document.body.classList.toggle('atlas-v2-sidebar-open');
      return;
    }
    const collapsed = document.body.classList.toggle('atlas-v2-sidebar-collapsed');
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  }

  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    refreshIcons();
  }

  function setGanttScale(nextScale) {
    if (!['days', 'weeks', 'months'].includes(nextScale)) return;
    runtime.ganttScale = nextScale;
    localStorage.setItem(GANTT_SCALE_KEY, nextScale);
    const context = findBoard();
    if (!context || context.board.activeView !== 'gantt') return;
    renderBoardContent(context.board);
    refreshIcons(document.getElementById('atlas-v2-board-content'));
  }

  function ganttZoomAnchor() {
    const scroll = document.querySelector('.atlas-v2-gantt-scroll');
    const canvas = scroll?.querySelector('.atlas-v2-gantt-canvas');
    if (!scroll || !canvas) return null;
    const labelWidth = Number.parseFloat(getComputedStyle(canvas).getPropertyValue('--gantt-label-width')) || 0;
    const dayWidth = Number(canvas.dataset.dayWidth || 1) || 1;
    const visibleTimelineWidth = Math.max(1, scroll.clientWidth - labelWidth);
    return {
      dayIndex: Math.max(0, (scroll.scrollLeft + (visibleTimelineWidth / 2)) / dayWidth),
      top: scroll.scrollTop,
    };
  }

  function restoreGanttZoomAnchor(anchor) {
    if (!anchor) return;
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      const scroll = document.querySelector('.atlas-v2-gantt-scroll');
      const canvas = scroll?.querySelector('.atlas-v2-gantt-canvas');
      if (!scroll || !canvas) return;
      const labelWidth = Number.parseFloat(getComputedStyle(canvas).getPropertyValue('--gantt-label-width')) || 0;
      const dayWidth = Number(canvas.dataset.dayWidth || 1) || 1;
      const visibleTimelineWidth = Math.max(1, scroll.clientWidth - labelWidth);
      const desiredLeft = (anchor.dayIndex * dayWidth) - (visibleTimelineWidth / 2);
      scroll.scrollLeft = Math.max(0, Math.min(scroll.scrollWidth - scroll.clientWidth, desiredLeft));
      scroll.scrollTop = anchor.top;
    })));
  }

  function setGanttZoom(nextZoom) {
    const anchor = ganttZoomAnchor();
    runtime.ganttZoom = Math.min(5, Math.max(1, Number(Number(nextZoom).toFixed(2))));
    localStorage.setItem(GANTT_ZOOM_KEY, String(runtime.ganttZoom));
    const context = findBoard();
    if (!context || context.board.activeView !== 'gantt') return;
    renderBoardContent(context.board);
    refreshIcons(document.getElementById('atlas-v2-board-content'));
    restoreGanttZoomAnchor(anchor);
  }

  function fitGantt() {
    runtime.ganttZoom = 1;
    localStorage.setItem(GANTT_ZOOM_KEY, String(runtime.ganttZoom));
    const context = findBoard();
    if (!context || context.board.activeView !== 'gantt') return;
    renderBoardContent(context.board);
    refreshIcons(document.getElementById('atlas-v2-board-content'));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const scroll = document.querySelector('.atlas-v2-gantt-scroll');
      if (scroll) scroll.scrollLeft = 0;
    }));
  }

  function scrollGanttToToday() {
    const scroll = document.querySelector('.atlas-v2-gantt-scroll');
    const marker = document.querySelector('.atlas-v2-gantt-today');
    if (!scroll || !marker) {
      toast('A data de hoje está fora do período exibido', true);
      return;
    }
    scroll.scrollTo({ left: Math.max(0, marker.offsetLeft - (scroll.clientWidth / 2)), behavior: 'smooth' });
  }


  function handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'overlay-backdrop' && event.target !== target) return;
    const context = findBoard();
    const protectedActions = {
      'add-item': 'create', 'add-item-to-group': 'create', 'add-subitem': 'create', 'add-work-element': 'create', 'duplicate-item': 'create', import: 'create',
      'bulk-move': 'edit', 'bulk-move-board': 'edit', 'item-move-board': 'edit', 'bulk-edit': 'edit', sort: 'edit', 'rename-work': 'edit',
      'delete-item': 'delete', 'bulk-delete': 'delete', 'delete-work': 'delete', 'confirm-delete-work': 'delete', 'confirm-delete-items': 'delete', 'confirm-delete-group': 'delete',
      'add-group': 'configure', 'add-column': 'configure', 'group-menu': 'configure', 'edit-group': 'configure', 'duplicate-group': 'configure', 'delete-group': 'configure',
      'board-settings': 'configure', 'edit-column': 'configure', 'edit-status-colors': 'configure', 'move-column': 'configure', 'delete-column': 'configure', 'edit-workspace': 'configure', automations: 'configure', 'automation-new': 'configure', 'automation-edit': 'configure', 'automation-toggle': 'configure', 'automation-delete': 'configure', 'automation-confirm-delete': 'configure', 'automation-templates': 'configure', 'automation-use-template': 'configure', 'automation-run': 'configure', 'automation-history': 'configure',
    };
    if (protectedActions[action] && !requirePermission(protectedActions[action], context, 'executar esta ação')) return;

    const actions = {
      'go-home': () => { event.preventDefault(); openHome(); },
      'open-sidebar': openSidebar,
      'close-sidebar': closeSidebar,
      'toggle-sidebar': toggleSidebar,
      'close-overlay': closeOverlay,
      'overlay-backdrop': closeOverlay,
      'test-create-storage': testCreateStorageConnection,
      'test-admin-storage': testAdminStorageConnection,
      'open-image-viewer': () => openImageViewer(target.dataset.itemId, target.dataset.columnId, target.dataset.imageIndex),
      'open-attachment-viewer': () => openAttachmentViewer(target.dataset.itemId, target.dataset.columnId, target.dataset.imageIndex),
      'rollback-import': () => rollbackImport(target.dataset.batchId),
      'viewer-previous': () => moveImageViewer(-1),
      'viewer-next': () => moveImageViewer(1),
      'viewer-zoom-out': () => setImageViewerZoom((runtime.imageViewer?.zoom || 1) - 0.25),
      'viewer-zoom-in': () => setImageViewerZoom((runtime.imageViewer?.zoom || 1) + 0.25),
      'viewer-reset': resetImageViewer,
      'viewer-rotate': rotateImageViewer,
      'viewer-fullscreen': toggleImageViewerFullscreen,
      'viewer-remove': removeViewerImage,
      'viewer-open-version': () => openAttachmentVersion(target.dataset.versionIndex),
      'viewer-label-version': () => openVersionLabelModal(target.dataset.versionIndex),
      'viewer-remove-version': () => { void removeAttachmentVersion(target.dataset.versionIndex); },
      'viewer-download-version': () => { void downloadAttachmentVersion(target.dataset.versionIndex); },
      'viewer-review-version': () => { void confirmAttachmentVersion(target.dataset.attachmentId); },
      'viewer-check-drive': () => { void checkDriveVersionsNow(); },
      'field-mode-toggle': () => {
        runtime.fieldMode = !runtime.fieldMode;
        localStorage.setItem(FIELD_MODE_KEY, runtime.fieldMode ? '1' : '0');
        if (runtime.fieldMode && context?.board) context.board.activeView = 'table';
        render();
      },
      'capture-location': () => captureCurrentLocation(target.dataset.itemId, target.dataset.columnId),
      'dashboard-config': openDashboardBuilder,
      'dashboard-remove-widget': () => removeDashboardWidget(target.dataset.widgetId),
      'calendar-prev': () => setCalendarMonth(-1),
      'calendar-next': () => setCalendarMonth(1),
      'calendar-today': () => setCalendarMonth(0, true),
      'calendar-open-item': () => {
        const found = context && findItem(context.board, target.dataset.itemId);
        if (!found) return;
        context.board.activeView = 'table';
        runtime.boardSearch = found.item.name;
        const search = document.getElementById('atlas-v2-board-search');
        if (search) search.value = runtime.boardSearch;
        render();
      },
      'item-chat': () => { void openItemChat(target.dataset.itemId); },
      'chat-mention-select': () => selectChatMention(target.dataset.userId),
      'chat-delete': () => { void deleteChatMessage(target.dataset.messageId); },
      'chat-open-file': () => { void openChatFile(target.dataset.path); },
      'item-history': () => openItemHistory(target.dataset.itemId),
      'history-restore': () => restoreItemHistory(target.dataset.historyId),
      'open-create': () => openCreateModal('board'),
      'create-workspace': () => { closeOverlay(); openCreateModal('workspace'); },
      'workspace-menu': openWorkspaceMenu,
      'edit-workspace': () => openRenameWorkspaceModal(target.dataset.workspaceId),
      'open-board': () => openBoard(target.dataset.boardId),
      'search-open-board': () => { closeOverlay(); openBoard(target.dataset.boardId); },
      'toggle-module': () => {
        const workspace = currentWorkspace();
        const module = workspace.modules.find((entry) => entry.id === target.dataset.moduleId);
        if (module) { module.open = !module.open; renderNavigation(); refreshIcons(document.getElementById('atlas-v2-navigation')); }
      },
      'select-workspace': () => selectWorkspace(target.dataset.workspaceId),
      'change-view': () => {
        context.board.activeView = target.dataset.view;
        runtime.boardUiStates.delete(String(context.board.id));
        runtime.pendingBoardUiState = null;
        const boardScroll = document.getElementById('atlas-v2-board-scroll');
        if (boardScroll) {
          boardScroll.scrollTop = 0;
          boardScroll.scrollLeft = 0;
        }
        saveData('', { remote: false, audit: false, revision: false });
        render();
      },
      'filter-work': () => {
        runtime.workFilter = target.dataset.workId || '';
        runtime.expandedWorkSectors.clear();
        const selected = selectedWork(context.board);
        if (selected) collapseItemTree(selected.item.subitems);
        const search = document.getElementById('atlas-v2-board-search');
        if (workSearchMatch(context.board)?.item.id !== runtime.workFilter) {
          runtime.boardSearch = '';
          if (search) search.value = '';
        }
        renderBoardContent(context.board);
        refreshIcons(document.getElementById('atlas-v2-board-content'));
      },
      'rename-work': () => openRenameWorkModal(runtime.workFilter),
      'delete-work': () => openDeleteWorkModal(runtime.workFilter),
      'confirm-delete-work': () => deleteWork(target.dataset.itemId),
      'add-view': openAddViewModal,
      'enable-view': () => {
        const view = target.dataset.view;
        if (!context.board.views.includes(view)) context.board.views.push(view);
        context.board.activeView = view;
        closeOverlay(); saveData('Visualização adicionada'); render();
      },
      'add-item': () => addItem(context.board.groups[0]?.id),
      'add-item-to-group': () => addItem(target.dataset.groupId),
      'add-subitem': () => addSubitem(target.dataset.itemId, target.dataset.workSector || ''),
      'add-work-element': () => addWorkElement(target.dataset.itemId, target.dataset.workSector || ''),
      'toggle-subitems': () => {
        const found = findItem(context.board, target.dataset.itemId);
        if (found && visibleSubitems(context.board, found.item).length) {
          found.item.subitemsExpanded = found.item.subitemsExpanded === false;
          renderBoardContent(context.board);
          refreshIcons(document.getElementById('atlas-v2-board-content'));
        }
      },
      'toggle-work-sector': () => {
        const stateKey = workSectorStateKey(context.board.id, target.dataset.workId || runtime.workFilter, target.dataset.workSector || '');
        if (runtime.expandedWorkSectors.has(stateKey)) runtime.expandedWorkSectors.delete(stateKey);
        else runtime.expandedWorkSectors.add(stateKey);
        renderBoardContent(context.board);
        refreshIcons(document.getElementById('atlas-v2-board-content'));
      },
      'add-group': () => openGroupModal(true),
      'add-column': () => openColumnModal(),
      'toggle-group': () => {
        const groupEntry = context.board.groups.find((entry) => entry.id === target.dataset.groupId);
        if (groupEntry) { groupEntry.collapsed = !groupEntry.collapsed; saveData('', { remote: false, audit: false, revision: false }); render(); }
      },
      'group-menu': () => openGroupMenu(target.dataset.groupId),
      'edit-group': () => { const groupId = target.dataset.groupId; closeOverlay(); openGroupModal(false, groupId); },
      'duplicate-group': () => duplicateGroup(target.dataset.groupId),
      'delete-group': () => openDeleteGroupModal(target.dataset.groupId),
      'confirm-delete-group': () => { const groupId = target.dataset.groupId; closeOverlay(); void deleteGroup(groupId); },
      'duplicate-item': () => duplicateItem(target.dataset.itemId),
      'item-move-board': () => openCrossBoardMoveModal([target.dataset.itemId]),
      'delete-item': () => openDeleteItemsModal([target.dataset.itemId]),
      'confirm-delete-items': () => { const ids = JSON.parse(target.dataset.itemIds || '[]'); closeOverlay(); void deleteItems(ids); },
      'select-all-items': () => {
        const allIds = flatBoardItems(context.board).map((entry) => entry.item.id);
        const everySelected = allIds.length > 0 && allIds.every((itemId) => runtime.selectedItems.has(itemId));
        runtime.selectedItems.clear();
        if (!everySelected) allIds.forEach((itemId) => runtime.selectedItems.add(itemId));
        refreshSelectionUi(context.board);
      },
      'clear-selection': () => { runtime.selectedItems.clear(); refreshSelectionUi(context.board); },
      'bulk-edit': openBulkEditModal,
      'bulk-move': () => {
        const destination = document.getElementById('atlas-v2-bulk-group')?.value;
        if (destination) moveItems([...runtime.selectedItems], destination);
      },
      'bulk-move-board': () => openCrossBoardMoveModal([...runtime.selectedItems]),
      'bulk-delete': () => openDeleteItemsModal([...runtime.selectedItems]),
      'board-settings': openBoardSettings,
      'edit-column': () => { const columnId = target.dataset.columnId; closeOverlay(); openColumnModal(columnId); },
      'edit-status-colors': () => { const columnId = target.dataset.columnId; closeOverlay(); openStatusColorsModal(columnId); },
      'move-column': () => moveColumn(target.dataset.columnId, target.dataset.direction),
      'delete-column': () => deleteColumn(target.dataset.columnId),
      'share-board': openShareDrawer,
      'global-search': openGlobalSearch,
      'notifications': openNotificationsDrawer,
      'toggle-theme': toggleTheme,
      'gantt-today': scrollGanttToToday,
      'gantt-fit': fitGantt,
      'gantt-scale': () => setGanttScale(target.dataset.scale),
      'gantt-zoom-out': () => setGanttZoom(runtime.ganttZoom - 0.25),
      'gantt-zoom-in': () => setGanttZoom(runtime.ganttZoom + 0.25),
      'import': openImportModal,
      'automations': openAutomationsDrawer,
      'automation-new': () => { closeOverlay(); openAutomationEditor(); },
      'automation-edit': () => { const automationId = target.dataset.automationId; closeOverlay(); openAutomationEditor(automationId); },
      'automation-toggle': () => toggleAutomation(target.dataset.automationId),
      'automation-delete': () => deleteAutomation(target.dataset.automationId),
      'automation-confirm-delete': () => confirmDeleteAutomation(target.dataset.automationId),
      'automation-templates': automationTemplates,
      'automation-history': openAutomationHistory,
      'automation-use-template': () => useAutomationTemplate(target.dataset.template),
      'automation-run': () => openAutomationRunModal(target.dataset.automationId),
      'notification-read': () => markNotificationRead(target.dataset.notificationId),
      'notification-open': () => markNotificationRead(target.dataset.notificationId, target.dataset.boardId),
      'notification-filter': () => {
        runtime.notificationFilter = target.dataset.notificationFilter || 'all';
        openNotificationsDrawer();
      },
      'notifications-read-all': markAllNotificationsRead,
      'filter': () => {
        if (runtime.fieldMode && window.innerWidth <= 820) document.getElementById('atlas-v2-board-search')?.focus();
        else openAdvancedFilters();
      },
      'filter-clear': clearAdvancedFilters,
      'filter-use-saved': () => useSavedSearch(target.dataset.searchId),
      'sort': () => {
        context.board.groups.forEach((groupEntry) => groupEntry.items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
        saveData('Itens ordenados'); render();
      },
      'fullscreen': () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
      },
      'user-menu': openUserMenu,
      'open-administration': () => openAdministration('overview'),
      'admin-tab': () => { void openAdminTab(target.dataset.adminTab || 'overview'); },
      'admin-sync-users': () => syncAuthUsersFromSupabase(),
      'admin-health-check': runSystemHealthCheck,
      'admin-new-storage': () => openStorageConnectionModal(),
      'admin-edit-storage': () => openStorageConnectionModal(target.dataset.storageId),
      'admin-organize-storage': () => { void openOrganizeStorageModal(target.dataset.storageId); },
      'admin-confirm-organize-storage': () => organizeStorageConnection(target.dataset.storageId),
      'admin-new-user': openAdminUserModal,
      'admin-approve-user': () => approveAdminUser(target.dataset.userId),
      'admin-delete-user': () => openDeleteAdminUser(target.dataset.userId),
      'admin-confirm-delete-user': () => deleteAdminUser(target.dataset.userId),
      'admin-delete-rule': () => deleteAdminRule(target.dataset.ruleId),
      'admin-create-structure': () => openCreateModal('board'),
      'admin-open-structure': () => { if (target.dataset.structureType === 'board') openBoard(target.dataset.structureId); },
      'admin-move-structure': () => moveAdminStructure(target.dataset.structureType, target.dataset.structureId, target.dataset.direction),
      'admin-rename-structure': () => openRenameStructure(target.dataset.structureType, target.dataset.structureId),
      'admin-delete-structure': () => openDeleteStructure(target.dataset.structureType, target.dataset.structureId),
      'admin-confirm-delete-structure': () => deleteAdminStructure(target.dataset.structureType, target.dataset.structureId),
      'admin-save-template': openSaveTemplateModal,
      'admin-delete-template': () => deleteAdminTemplate(target.dataset.templateId),
      'admin-save-field': () => saveFieldTemplate(target.dataset.columnId),
      'admin-use-field': () => useFieldTemplate(target.dataset.fieldId),
      'admin-delete-field': () => deleteFieldTemplate(target.dataset.fieldId),
      'admin-restore-trash': () => restoreTrash(target.dataset.trashId),
      'admin-purge-trash': () => purgeTrash(target.dataset.trashId),
      'admin-export': exportAdminBackup,
      'remove-board-member': () => removeBoardMember(target.dataset.userId),
    };
    actions[action]?.();
  }

  async function handleChange(event) {
    const target = event.target;
    // Upload de nova versao vem do painel de historico do visualizador, e nao
    // de uma celula do quadro - por isso e tratado antes de tudo.
    if (target.dataset?.action === 'viewer-add-version') {
      await addAttachmentVersion(target);
      return;
    }
    // Anexos do chat: so mostra os nomes escolhidos; o envio acontece no submit.
    if (target.id === 'atlas-v2-chat-file') {
      const nome = document.getElementById('atlas-v2-chat-file-name');
      if (nome) nome.textContent = [...(target.files || [])].map((entry) => entry.name).join(', ');
      return;
    }
    if (target.matches('input[name="create-type"]')) {
      updateCreateFields(target.value);
      return;
    }
    if (target.matches('input[name="storage-mode"]')) {
      updateStorageFields(target.value, true);
      return;
    }
    if (target.closest('#atlas-v2-column-form') && target.name === 'type') {
      updateColumnEditorVisibility();
      return;
    }
    if (target.closest('#atlas-v2-bulk-edit-form') && (target.name === 'fieldId' || target.name === 'operation')) {
      updateBulkEditorValue();
      return;
    }
    if (target.matches('[name="driveType"], [name="driveName"], [name="driveSector"], [name="driveEmail"], [name="driveFolderUrl"], [name="driveAppScriptUrl"]')) {
      const form = target.closest('form');
      // Trocar o tipo muda o significado dos dois campos seguintes (link do Drive
      // vs caminho no servidor), entao rotulo, dica e obrigatoriedade acompanham.
      if (target.name === 'driveType') applyStorageTypeToForm(form);
      if (form?.elements?.driveVerified) form.elements.driveVerified.value = '0';
      if (form?.id === 'atlas-v2-storage-form') setAdminStorageStatus('Dados alterados. Teste novamente a conexão.');
      else setStorageTestStatus('Dados alterados. Teste novamente a conexão.');
      return;
    }
    if (target.closest('#atlas-v2-automation-form') && (target.name === 'triggerType' || target.name === 'actionType' || target.name === 'action2Type' || target.name === 'action2Enabled' || target.name === 'conditionEnabled' || target.name === 'notifyRecipient')) {
      automationEditorVisibility();
      return;
    }
    const context = findBoard();
    if (!context) return;
    if (target.matches('[data-action="admin-user-role"]')) {
      updateAdminUser(target.dataset.userId, 'role', target.value);
      return;
    }
    if (target.matches('[data-action="admin-user-status"]')) {
      updateAdminUser(target.dataset.userId, 'status', target.value);
      return;
    }
    if (target.matches('[data-action="select-item"]')) {
      if (target.checked) runtime.selectedItems.add(target.dataset.itemId); else runtime.selectedItems.delete(target.dataset.itemId);
      refreshSelectionUi(context.board);
      return;
    }
    if (target.matches('[data-action="select-group"]')) {
      const groupEntry = context.board.groups.find((entry) => entry.id === target.dataset.groupId);
      groupEntry?.items.forEach((entry) => itemTreeIds(entry, []).forEach((itemId) => {
        if (target.checked) runtime.selectedItems.add(itemId);
        else runtime.selectedItems.delete(itemId);
      }));
      refreshSelectionUi(context.board);
      return;
    }
    if (target.matches('[data-item-value]')) {
      if (!requirePermission('edit', context, 'editar registros')) { render(); return; }
      const found = findItem(context.board, target.dataset.itemValue);
      if (!found) return;
      const columnEntry = context.board.columns.find((entry) => entry.id === target.dataset.columnId);
      if (!requirePermission('edit', { ...context, groupId: found.item.groupId, columnId: target.dataset.columnId, itemId: found.item.id }, 'editar este campo')) {
        render();
        return;
      }
      // Inputs nativos de data podem disparar `change` enquanto o usuário ainda
      // está preenchendo o ano. Salvar e renderizar nesse momento interrompe a
      // digitação. A data é confirmada somente no focusout (ou após seleção no
      // calendário seguida de saída do campo).
      if (columnEntry?.type === 'date' && target.type === 'date') {
        target.dataset.dateDirty = 'true';
        return;
      }
      if (target.type === 'file' && ['image', 'file'].includes(columnEntry?.type)) {
        await addAttachmentsToCell(target, context, found, columnEntry);
        return;
      }
      const previousValue = found.item.values[target.dataset.columnId];
      if (target.type === 'checkbox') {
        found.item.values[target.dataset.columnId] = target.checked;
      } else if (columnEntry?.type === 'currency') {
        found.item.values[target.dataset.columnId] = parseCurrencyInput(target.value);
      } else {
        found.item.values[target.dataset.columnId] = target.value;
      }
      const nextValue = found.item.values[target.dataset.columnId];
      captureItemHistory(context.board, found.item, target.dataset.columnId, previousValue, nextValue);
      if (runtime.remoteMode && runtime.authClient && columnEntry) {
        try {
          target.disabled = true;
          await commitRemoteItemValueChange(context, found, columnEntry, previousValue, nextValue);
        } catch (error) {
          found.item.values[target.dataset.columnId] = previousValue;
          toast(`Falha ao aplicar a alteração: ${error.message || error}`, true);
          renderSoon();
        } finally {
          if (target?.isConnected) target.disabled = false;
        }
        return;
      }
      runLocalAutomations('field_changed', context.board, found.item, { columnId: target.dataset.columnId, oldValue: previousValue, newValue: nextValue });
      saveData();
      if (columnEntry?.type === 'status' || target.type === 'file') render();
      return;
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (target.matches('#atlas-v2-chat-form textarea[name="mensagem"]')) {
      renderChatMentionSuggestions(target);
    } else if (target.id === 'atlas-v2-nav-search') {
      runtime.navSearch = target.value;
      clearTimeout(runtime.navSearchTimer);
      runtime.navSearchTimer = setTimeout(() => {
        renderNavigation();
        refreshIcons(document.getElementById('atlas-v2-navigation'));
      }, 90);
    } else if (target.id === 'atlas-v2-board-search') {
      runtime.boardSearch = target.value;
      clearTimeout(runtime.boardSearchTimer);
      runtime.boardSearchTimer = setTimeout(() => {
        const context = findBoard();
        if (!context) return;
        if (context.board.activeView === 'works') selectWorkFromContextSearch(context.board);
        renderBoardContent(context.board);
        refreshIcons(document.getElementById('atlas-v2-board-content'));
        if (context.board.activeView === 'works') revealContextSearchWork(context.board, true);
      }, 90);
    } else if (target.matches('[data-status-color-input]')) {
      const preview = target.closest('[data-status-color-row]')?.querySelector('[data-status-color-preview]');
      if (preview) {
        const background = normalizedHexColor(target.value, '#e3f1fc');
        preview.style.setProperty('--status-bg', background);
        preview.style.setProperty('--status-color', readableTextColor(background));
      }
    } else if (target.id === 'atlas-v2-global-search-input') {
      clearTimeout(runtime.globalSearchTimer);
      runtime.globalSearchTimer = setTimeout(() => renderGlobalResults(target.value), 120);
    } else if (target.matches('[data-item-value][data-column-id]') && target.dataset.itemValue) {
      const liveContext = findBoard();
      const liveColumn = liveContext?.board?.columns?.find((entry) => entry.id === target.dataset.columnId);
      if (liveColumn?.type === 'currency') {
        const cursorFromEnd = target.value.length - (target.selectionEnd ?? target.value.length);
        target.value = maskCurrencyInput(target.value);
        const newPos = Math.max(0, target.value.length - cursorFromEnd);
        target.setSelectionRange(newPos, newPos);
      }
      // Atualiza colunas de formula a cada tecla digitada, sem esperar o
      // usuario sair do campo ou apertar Enter. Isso e so uma previa visual:
      // o valor so e de fato salvo (e a formula recalculada "para valer") no
      // commit normal do campo, no focusout/change de sempre.
      updateFormulaCellsLive(target.dataset.itemValue, target);
    }
  }

  function nativeDateIsComplete(target) {
    const value = String(target?.value || '').trim();
    if (!value) return !target?.validity?.badInput;
    if (target?.validity?.badInput || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const parsed = new Date(`${value}T00:00:00`);
    return !Number.isNaN(parsed.getTime())
      && parsed.getFullYear() === year
      && parsed.getMonth() + 1 === month
      && parsed.getDate() === day;
  }

  async function commitDateFieldOnBlur(target) {
    if (target.dataset.dateCommitting === 'true') return;
    // O input nativo de data reporta "badInput" quando o usuario ainda esta
    // no meio de digitar (ex.: preencheu dia/mes mas nao o ano). Se o motivo
    // do blur foi a JANELA perder o foco (trocar de aba, de app, clicar em
    // outra coisa fora do site) - e nao uma escolha deliberada de sair deste
    // campo dentro do proprio Atlas - validar aqui reverte o que a pessoa
    // estava digitando e dispara um toast vermelho de erro do nada, mesmo
    // sem ela ter terminado ou desistido do campo. So faz sentido validar
    // quando o blur aconteceu com a janela ainda em foco (ou seja, o usuario
    // realmente moveu o foco para outro elemento da pagina).
    if (document.hidden || !document.hasFocus()) return;
    const context = findBoard();
    if (!context) return;
    if (!requirePermission('edit', context, 'editar registros')) { render(); return; }
    const found = findItem(context.board, target.dataset.itemValue);
    const columnEntry = context.board.columns.find((entry) => entry.id === target.dataset.columnId);
    if (!found || columnEntry?.type !== 'date') return;
    if (!requirePermission('edit', { ...context, groupId: found.item.groupId, columnId: columnEntry.id, itemId: found.item.id }, 'editar este campo')) {
      render();
      return;
    }

    const previousValue = found.item.values?.[columnEntry.id] ?? '';
    const nextValue = String(target.value || '').trim();
    delete target.dataset.dateDirty;

    if (!nativeDateIsComplete(target)) {
      target.value = previousValue || '';
      toast('Digite a data completa, incluindo os quatro dígitos do ano.', true);
      return;
    }
    if (String(previousValue || '') === nextValue) return;

    found.item.values[columnEntry.id] = nextValue;
    captureItemHistory(context.board, found.item, columnEntry.id, previousValue, nextValue);
    if (runtime.remoteMode && runtime.authClient) {
      try {
        target.dataset.dateCommitting = 'true';
        target.disabled = true;
        await commitRemoteItemValueChange(context, found, columnEntry, previousValue, nextValue);
      } catch (error) {
        found.item.values[columnEntry.id] = previousValue;
        toast(`Falha ao aplicar a data: ${error.message || error}`, true);
        renderSoon();
      } finally {
        if (target?.isConnected) {
          target.disabled = false;
          delete target.dataset.dateCommitting;
        }
      }
      return;
    }

    runLocalAutomations('field_changed', context.board, found.item, {
      columnId: columnEntry.id,
      oldValue: previousValue,
      newValue: nextValue,
    });
    saveData();
  }

  async function handleFocusOut(event) {
    const target = event.target;
    if (target.matches('[data-item-value][data-date-field]')) {
      void commitDateFieldOnBlur(target);
      return;
    }
    if (!target.matches('[data-item-name]')) return;
    const context = findBoard();
    if (!requirePermission('edit', context, 'editar registros')) { render(); return; }
    const found = context && findItem(context.board, target.dataset.itemName);
    if (!found) return;
    if (!requirePermission('edit', { ...context, groupId: found.item.groupId, itemId: found.item.id }, 'editar este registro')) {
      render();
      return;
    }
    const value = target.value.trim();
    const previousName = found.item.name;
    found.item.name = value || 'Item sem nome';
    target.value = found.item.name;
    captureItemHistory(context.board, found.item, '__name__', previousName, found.item.name, 'Nome atualizado');
    if (runtime.remoteMode && runtime.authClient) {
      saveData('', { remote: false });
      try {
        await enqueueRemoteItemPersistence(context, found.item.id);
      } catch (error) {
        found.item.name = previousName;
        target.value = previousName;
        saveData('', { remote: false, audit: false });
        toast(`O nome anterior foi restaurado porque o servidor não confirmou a alteração: ${error.message || error}`, true);
      }
    } else {
      saveData();
    }
  }

  function handleSubmit(event) {
    const form = event.target;
    if (!form.id?.startsWith('atlas-v2-')) return;
    event.preventDefault();
    if (form.id === 'atlas-v2-create-form') submitCreate(form);
    if (form.id === 'atlas-v2-group-form') submitGroup(form);
    if (form.id === 'atlas-v2-column-form') submitColumn(form);
    if (form.id === 'atlas-v2-status-colors-form') submitStatusColors(form);
    if (form.id === 'atlas-v2-board-settings-form') submitBoardSettings(form);
    if (form.id === 'atlas-v2-import-form') submitImport(form);
    if (form.id === 'atlas-v2-import-confirm-form') confirmImport(form);
    if (form.id === 'atlas-v2-bulk-edit-form') submitBulkEdit(form);
    if (form.id === 'atlas-v2-cross-board-move-form') { void submitCrossBoardMove(form); }
    if (form.id === 'atlas-v2-dashboard-widget-form') submitDashboardWidget(form);
    if (form.id === 'atlas-v2-filter-form') submitAdvancedFilters(form);
    if (form.id === 'atlas-v2-rename-work-form') submitRenameWork(form);
    if (form.id === 'atlas-v2-version-label-form') { void submitVersionLabel(form); }
    if (form.id === 'atlas-v2-chat-form') { void submitItemChat(form); }
    if (form.id === 'atlas-v2-workspace-form') submitWorkspace(form);
    if (form.id === 'atlas-v2-admin-user-form') submitAdminUser(form);
    if (form.id === 'atlas-v2-admin-permission-form') submitAdminPermission(form);
    if (form.id === 'atlas-v2-admin-structure-form') submitRenameStructure(form);
    if (form.id === 'atlas-v2-admin-template-form') submitAdminTemplate(form);
    if (form.id === 'atlas-v2-share-form') submitShareBoard(form);
    if (form.id === 'atlas-v2-storage-form') submitStorageConnection(form);
    if (form.id === 'atlas-v2-automation-form') submitAutomation(form);
    if (form.id === 'atlas-v2-automation-run-form') submitAutomationRun(form);
  }

  const HORIZONTAL_DRAG_SCROLL_SELECTOR = '.atlas-v2-table-wrap, .atlas-v2-work-tabs, .atlas-v2-gantt-scroll';

  function horizontalDragContainer(target) {
    if (window.innerWidth <= 820) return null;
    const direct = target?.closest?.(HORIZONTAL_DRAG_SCROLL_SELECTOR);
    const groupTable = direct || target?.closest?.('.atlas-v2-group')?.querySelector('.atlas-v2-table-wrap');
    if (!groupTable || groupTable.scrollWidth <= groupTable.clientWidth + 2) return null;
    return groupTable;
  }

  function handlePointerDown(event) {
    const viewerImage = event.target.closest?.('.atlas-v2-viewer-image');
    if (viewerImage && event.button === 0 && runtime.imageViewer) {
      event.preventDefault();
      const media = viewerImage.closest('.atlas-v2-viewer-media');
      const gesture = runtime.imageViewerGesture || {
        media,
        pointers: new Map(),
        startZoom: runtime.imageViewer.zoom || 1,
        startDistance: 0,
        startX: runtime.imageViewer.x || 0,
        startY: runtime.imageViewer.y || 0,
        originX: event.clientX,
        originY: event.clientY,
      };
      gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
      if (gesture.pointers.size === 2) {
        const points = [...gesture.pointers.values()];
        gesture.startDistance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) || 1;
        gesture.startZoom = runtime.imageViewer.zoom || 1;
      }
      runtime.imageViewerGesture = gesture;
      media?.classList.add('is-dragging');
      try { viewerImage.setPointerCapture?.(event.pointerId); } catch (_) {}
      return;
    }
    if (event.button !== 2) return;
    const container = horizontalDragContainer(event.target);
    if (!container) return;
    event.preventDefault();
    runtime.horizontalDrag = {
      container,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
    };
    container.classList.add('is-right-dragging');
    document.body.classList.add('atlas-v2-right-dragging');
    try { container.setPointerCapture?.(event.pointerId); } catch (_) {}
  }

  function handlePointerMove(event) {
    const gesture = runtime.imageViewerGesture;
    if (gesture?.pointers?.has(event.pointerId) && runtime.imageViewer) {
      const point = gesture.pointers.get(event.pointerId);
      point.x = event.clientX;
      point.y = event.clientY;
      if (gesture.pointers.size >= 2) {
        const points = [...gesture.pointers.values()].slice(0, 2);
        const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) || 1;
        runtime.imageViewer.zoom = Math.min(5, Math.max(0.5, gesture.startZoom * (distance / gesture.startDistance)));
      } else if ((runtime.imageViewer.zoom || 1) > 1.01) {
        runtime.imageViewer.x = gesture.startX + (event.clientX - gesture.originX);
        runtime.imageViewer.y = gesture.startY + (event.clientY - gesture.originY);
      }
      applyImageViewerTransform();
      event.preventDefault();
      return;
    }
    const drag = runtime.horizontalDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 2) drag.moved = true;
    drag.container.scrollLeft = drag.startScrollLeft - distance;
    event.preventDefault();
  }

  function finishHorizontalDrag(event) {
    const gesture = runtime.imageViewerGesture;
    if (gesture?.pointers?.has(event.pointerId)) {
      const point = gesture.pointers.get(event.pointerId);
      const swipe = point ? point.x - point.startX : 0;
      gesture.pointers.delete(event.pointerId);
      if (!gesture.pointers.size) {
        gesture.media?.classList.remove('is-dragging');
        runtime.imageViewerGesture = null;
        if ((runtime.imageViewer?.zoom || 1) <= 1.01 && Math.abs(swipe) > 70) moveImageViewer(swipe < 0 ? 1 : -1);
      } else {
        const remaining = [...gesture.pointers.values()][0];
        gesture.originX = remaining.x;
        gesture.originY = remaining.y;
        gesture.startX = runtime.imageViewer?.x || 0;
        gesture.startY = runtime.imageViewer?.y || 0;
      }
      return;
    }
    const drag = runtime.horizontalDrag;
    if (!drag || (event.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
    drag.container.classList.remove('is-right-dragging');
    document.body.classList.remove('atlas-v2-right-dragging');
    try { drag.container.releasePointerCapture?.(drag.pointerId); } catch (_) {}
    if (drag.moved) runtime.suppressContextMenuUntil = Date.now() + 600;
    runtime.horizontalDrag = null;
  }

  function handleContextMenu(event) {
    if (horizontalDragContainer(event.target) || Date.now() < runtime.suppressContextMenuUntil) event.preventDefault();
  }

  function handleDragStart(event) {
    const itemElement = event.target.closest('[data-item-id]');
    const columnElement = event.target.closest('[data-column-id]');
    const groupElement = event.target.closest('.atlas-v2-group');
    if (itemElement) {
      if (!hasPermission('edit', findBoard())) { event.preventDefault(); return; }
      runtime.drag = { type: 'item', id: itemElement.dataset.itemId };
      itemElement.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      return;
    }
    if (columnElement?.tagName === 'TH') {
      if (!hasPermission('configure', findBoard())) { event.preventDefault(); return; }
      runtime.drag = { type: 'column', id: columnElement.dataset.columnId };
      event.dataTransfer.effectAllowed = 'move';
      return;
    }
    if (groupElement) {
      if (!hasPermission('configure', findBoard())) { event.preventDefault(); return; }
      runtime.drag = { type: 'group', id: groupElement.dataset.groupId };
      groupElement.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(event) {
    if (event.target.closest('[data-drop-group], .atlas-v2-group, [data-column-id]')) event.preventDefault();
  }

  function handleDrop(event) {
    event.preventDefault();
    const context = findBoard();
    if (!context || !runtime.drag) return;
    if (runtime.drag.type === 'item') {
      const dropTarget = event.target.closest('[data-drop-group], .atlas-v2-group');
      const groupId = dropTarget?.dataset.dropGroup || dropTarget?.dataset.groupId;
      if (groupId) moveItems([runtime.drag.id], groupId);
    } else if (runtime.drag.type === 'group') {
      const target = event.target.closest('.atlas-v2-group');
      const from = context.board.groups.findIndex((entry) => entry.id === runtime.drag.id);
      const to = context.board.groups.findIndex((entry) => entry.id === target?.dataset.groupId);
      if (from >= 0 && to >= 0 && from !== to) {
        const [entry] = context.board.groups.splice(from, 1);
        context.board.groups.splice(to, 0, entry);
        context.board.groups.forEach((groupEntry, index) => { groupEntry.order = index; });
        saveData('Grupo reorganizado');
        render();
      }
    } else if (runtime.drag.type === 'column') {
      const target = event.target.closest('[data-column-id]');
      const from = context.board.columns.findIndex((entry) => entry.id === runtime.drag.id);
      const to = context.board.columns.findIndex((entry) => entry.id === target?.dataset.columnId);
      if (from >= 0 && to >= 0 && from !== to) {
        const [entry] = context.board.columns.splice(from, 1);
        context.board.columns.splice(to, 0, entry);
        context.board.columns.forEach((columnEntry, index) => { columnEntry.order = index; });
        saveData('Coluna reorganizada');
        render();
      }
    }
    runtime.drag = null;
  }

  function handleDragEnd() {
    document.querySelectorAll('.is-dragging').forEach((entry) => entry.classList.remove('is-dragging'));
    runtime.drag = null;
  }

  function handleKeydown(event) {
    if (document.body.classList.contains('atlas-v2-auth-locked')) return;
    if (runtime.imageViewer && event.key === 'ArrowLeft') {
      event.preventDefault();
      moveImageViewer(-1);
      return;
    }
    if (runtime.imageViewer && event.key === 'ArrowRight') {
      event.preventDefault();
      moveImageViewer(1);
      return;
    }
    if (runtime.imageViewer && ['+', '='].includes(event.key)) {
      event.preventDefault();
      setImageViewerZoom((runtime.imageViewer.zoom || 1) + 0.25);
      return;
    }
    if (runtime.imageViewer && event.key === '-') {
      event.preventDefault();
      setImageViewerZoom((runtime.imageViewer.zoom || 1) - 0.25);
      return;
    }
    if (runtime.imageViewer && event.key === '0') {
      event.preventDefault();
      resetImageViewer();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openGlobalSearch();
    }
    if (event.key === 'Escape') {
      closeOverlay();
      closeSidebar();
    }
  }

  function handleResize() {
    clearTimeout(runtime.resizeTimer);
    runtime.resizeTimer = setTimeout(() => {
      const context = findBoard();
      if (context?.board.activeView !== 'gantt') return;
      renderBoardContent(context.board);
      refreshIcons(document.getElementById('atlas-v2-board-content'));
    }, 120);
  }

  function handleWheel(event) {
    if (runtime.imageViewer && event.target.closest?.('.atlas-v2-viewer-media')) {
      event.preventDefault();
      setImageViewerZoom((runtime.imageViewer.zoom || 1) + (event.deltaY < 0 ? 0.2 : -0.2));
      return;
    }
    if (window.innerWidth <= 820 || event.ctrlKey || event.metaKey) return;
    const table = event.target.closest?.('.atlas-v2-table-wrap')
      || event.target.closest?.('.atlas-v2-group')?.querySelector('.atlas-v2-table-wrap');
    if (!table || table.scrollWidth <= table.clientWidth + 2) return;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!delta) return;
    event.preventDefault();
    table.scrollLeft += delta;
    syncBoardTableHeader(table);
  }

  function syncBoardTableHeader(table) {
    const stickyHead = table?.closest?.('.atlas-v2-group')?.querySelector('.atlas-v2-table-sticky-head');
    if (stickyHead) stickyHead.scrollLeft = table.scrollLeft;
  }

  function handleBoardTableScroll(event) {
    const table = event.target?.matches?.('.atlas-v2-table-wrap') ? event.target : null;
    if (table) syncBoardTableHeader(table);
  }

  window.__ATLAS_REALTIME_STATUS__ = () => ({
    version: window.__ATLAS_VERSION__,
    status: runtime.realtimeStatus,
    channelState: runtime.realtimePollingActive ? 'authenticated-polling' : 'closed',
    lastEventAt: runtime.realtimeLastEventAt ? new Date(runtime.realtimeLastEventAt).toISOString() : null,
    reconnectAttempts: runtime.realtimeReconnectAttempts,
    pendingBroadcasts: runtime.realtimeBroadcastQueue.length,
  });

  function init() {
    if (authTestMode()) {
      window.__ATLAS_TEST__ = {
        isRemoteBootstrapSnapshot,
        activeBoardColumnCount: () => findBoard()?.board?.columns?.length || 0,
        // So existe no modo de teste (authTestMode): permite montar um cenario
        // de anexos - inclusive versoes - sem depender do Google Drive.
        setCellValue: (itemId, columnId, value) => {
          const context = findBoard();
          const found = context && findItem(context.board, itemId);
          if (!found) return false;
          found.item.values[columnId] = value;
          render();
          return true;
        },
        columnIdByName: (name) => findBoard()?.board?.columns?.find((entry) => entry.name === name)?.id || '',
        firstItemId: () => {
          const context = findBoard();
          const groups = context?.board?.groups || [];
          for (const group of groups) if (group.items?.length) return group.items[0].id;
          return '';
        },
      };
    }
    document.documentElement.dataset.theme = localStorage.getItem(THEME_KEY) || 'dark';
    document.addEventListener('click', handleAuthClick);
    document.addEventListener('submit', handleAuthSubmit);
    bootstrapAuthentication();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
