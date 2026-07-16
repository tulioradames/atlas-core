/* Atlas Core V1.4.2 - Colaboracao e Produtividade */
(function atlasV142Module() {
    'use strict';

    if (window.__ATLAS_V142_MODULE__) return;
    window.__ATLAS_V142_MODULE__ = true;

    const runtime = {
        searchRecords: [],
        searchLoadedAt: 0,
        currentEntity: null,
        collaborationTab: 'comments',
        comments: [],
        history: [],
        mentionProfiles: [],
        notifications: [],
        savedViews: [],
        trash: [],
        templates: [],
        errors: [],
        importRows: [],
        importHeaders: [],
        importFileName: '',
        importTarget: 'manutencao',
        bulkModule: 'manutencao',
        bulkSelected: new Set(),
        loggingError: false
    };

    const SEARCH_TABLES = [
        ['obras', 'obra'],
        ['elementos_principais', 'elemento_documentacao'],
        ['subelementos', 'subelemento_documentacao'],
        ['admin_documentacoes', 'documentacao_rede_geral'],
        ['atlas_expansoes', 'expansao'],
        ['atlas_expansoes_subitems', 'expansao_subitem'],
        ['atlas_pmo_projetos', 'pmo_projeto'],
        ['atlas_pmo_subelementos', 'pmo_subelemento'],
        ['atlas_manutencoes_rede', 'manutencao_rede']
    ];

    const ENTITY_META = {
        obra: { module: 'admin_obras', view: 'obras', label: 'Obra de documentação' },
        elemento_documentacao: { module: 'admin_obras', view: 'obras', label: 'Elemento de documentação' },
        subelemento_documentacao: { module: 'admin_obras', view: 'obras', label: 'Subelemento de documentação' },
        documentacao_rede_geral: { module: 'admin_obras', view: 'status', label: 'Documentação Rede Geral' },
        expansao: { module: 'expansoes', view: 'tabela', label: 'Expansões' },
        expansao_subitem: { module: 'expansoes', view: 'tabela', label: 'Subelemento de Expansões' },
        pmo_projeto: { module: 'pmo', view: 'analise_novos_projetos', label: 'Projeto PMO' },
        pmo_subelemento: { module: 'pmo', view: 'analise_novos_projetos', label: 'Subelemento PMO' },
        pmo_update: { module: 'pmo', view: 'analise_novos_projetos', label: 'Update PMO' },
        manutencao_rede: { module: 'admin_obras', view: 'manutencao_redes', label: 'Manutenção de Redes' }
    };

    function uid(prefix) {
        if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function html(value) {
        if (typeof escaparHtml === 'function') return escaparHtml(value ?? '');
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function jsAttr(value) {
        return String(value ?? '')
            .replaceAll('\\', '\\\\')
            .replaceAll("'", "\\'")
            .replaceAll('\r', ' ')
            .replaceAll('\n', ' ');
    }

    function normalize(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function userId() {
        return state?.usuarioAtual?.id || null;
    }

    function canWrite() {
        return typeof atlasTemPermissao === 'function' && atlasTemPermissao('editar_registro');
    }

    function canDelete() {
        return typeof atlasTemPermissao === 'function' && atlasTemPermissao('excluir_registro');
    }

    function isAdmin() {
        return String(state?.perfilAtual?.role || '') === 'admin';
    }

    function dateTime(value) {
        if (!value) return '-';
        try {
            return new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short'
            }).format(new Date(value));
        } catch (_) {
            return String(value);
        }
    }

    function refreshIcons(root) {
        requestAnimationFrame(() => {
            try {
                if (window.lucide?.createIcons) window.lucide.createIcons({ root: root || document });
            } catch (_) {}
        });
    }

    function operation(message, type = 'info') {
        const color = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-emerald-600' : type === 'warning' ? 'bg-amber-600' : 'bg-[#0073ea]';
        if (typeof exibirStatusTemporario === 'function') exibirStatusTemporario(message, color);
    }

    function modalRoot() {
        let root = document.getElementById('atlas-v142-modal-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'atlas-v142-modal-root';
            document.body.appendChild(root);
        }
        return root;
    }

    function openModal(options) {
        const root = modalRoot();
        root.innerHTML = `<div class="atlas-v142-overlay" onclick="atlasV142FecharModal(event)">
            <section class="atlas-v142-modal ${options.wide ? 'is-wide' : ''}" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
                <header class="atlas-v142-modal-head">
                    <div><div class="atlas-v142-kicker">Atlas V1.4.2</div><h2>${html(options.title || 'Ferramentas')}</h2><p>${html(options.subtitle || '')}</p></div>
                    <button type="button" class="atlas-v142-icon-btn" onclick="atlasV142FecharModal()" title="Fechar" aria-label="Fechar"><i data-lucide="x"></i><span class="atlas-v142-icon-fallback" aria-hidden="true">&times;</span></button>
                </header>
                <div class="atlas-v142-modal-body" id="atlas-v142-modal-body">${options.body || ''}</div>
            </section>
        </div>`;
        document.body.classList.add('atlas-v142-modal-open');
        refreshIcons(root);
    }

    function closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        const root = modalRoot();
        root.innerHTML = '';
        document.body.classList.remove('atlas-v142-modal-open');
    }

    async function captureError(source, operationName, error, context = {}) {
        const message = error?.message || String(error || 'Erro desconhecido');
        console.error(`[Atlas V1.4.2] ${source}/${operationName}`, error);
        if (runtime.loggingError || !supabaseClient || !userId()) return;
        runtime.loggingError = true;
        try {
            await supabaseClient.from('atlas_error_logs').insert([{
                id: uid('error'),
                level: 'error',
                source: String(source || 'frontend'),
                operation: String(operationName || ''),
                message: message.slice(0, 4000),
                context: { ...context, url: location.href, userAgent: navigator.userAgent },
                status: 'pending',
                created_by: userId(),
                updated_at: new Date().toISOString()
            }]);
        } catch (_) {
            // A central ainda pode estar aguardando o SQL da V1.4.2.
        } finally {
            runtime.loggingError = false;
        }
    }

    function recordTitle(entityType, item) {
        if (!item) return 'Registro';
        if (entityType === 'documentacao_rede_geral' || entityType === 'manutencao_rede') return item.cidade || item.localidade || item.protocolo || 'Registro de rede';
        if (entityType === 'expansao_subitem' || entityType === 'pmo_subelemento' || entityType === 'subelemento_documentacao') return item.nome || item.item_name || 'Subelemento';
        return item.nome || item.cidade || item.titulo || item.item_name || item.id || 'Registro';
    }

    function recordSubtitle(entityType, item) {
        const parts = [];
        if (item.regional) parts.push(item.regional);
        if (item.status) parts.push(item.status);
        if (item.prioridade) parts.push(item.prioridade);
        if (item.responsavel || item.tecnico || item.projetista) parts.push(item.responsavel || item.tecnico || item.projetista);
        if (item.obra_nome) parts.push(item.obra_nome);
        if (item.fase) parts.push(item.fase);
        if (item.tipo_manutencao) parts.push(item.tipo_manutencao);
        return parts.filter(Boolean).join(' · ') || ENTITY_META[entityType]?.label || 'Atlas';
    }

    function searchableText(item) {
        if (!item || typeof item !== 'object') return '';
        return Object.entries(item)
            .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
            .map(([key, value]) => `${key} ${value}`)
            .join(' ');
    }

    async function loadSearchIndex(force = false) {
        if (!force && runtime.searchRecords.length && Date.now() - runtime.searchLoadedAt < 120000) return runtime.searchRecords;
        if (!supabaseClient) return [];

        const results = await Promise.allSettled(SEARCH_TABLES.map(async ([table, entityType]) => {
            const { data, error } = await supabaseClient.from(table).select('*').limit(2500);
            if (error) throw error;
            return { table, entityType, data: data || [] };
        }));

        const records = [];
        const rawByTable = {};
        results.forEach(result => {
            if (result.status !== 'fulfilled') return;
            rawByTable[result.value.table] = result.value.data;
        });

        Object.entries(rawByTable).forEach(([table, rows]) => {
            const entityType = SEARCH_TABLES.find(entry => entry[0] === table)?.[1];
            const meta = ENTITY_META[entityType] || {};
            rows.forEach(item => {
                const title = recordTitle(entityType, item);
                records.push({
                    table,
                    entityType,
                    id: String(item.id || ''),
                    title,
                    subtitle: recordSubtitle(entityType, item),
                    module: meta.module,
                    view: meta.view,
                    item,
                    search: normalize(`${title} ${recordSubtitle(entityType, item)} ${searchableText(item)}`)
                });
            });
        });

        const elements = rawByTable.elementos_principais || [];
        records.filter(record => record.entityType === 'subelemento_documentacao').forEach(record => {
            const parent = elements.find(item => item.id === record.item.pai_id || item.id === record.item.elemento_id || item.id === record.item.elemento_principal_id);
            if (parent) record.parent = parent;
        });

        const expansions = rawByTable.atlas_expansoes || [];
        records.filter(record => record.entityType === 'expansao_subitem').forEach(record => {
            const parent = expansions.find(item => item.id === record.item.expansao_id);
            if (parent) record.parent = parent;
        });

        const pmo = rawByTable.atlas_pmo_projetos || [];
        records.filter(record => record.entityType === 'pmo_subelemento').forEach(record => {
            const parent = pmo.find(item => item.id === record.item.projeto_id);
            if (parent) record.parent = parent;
        });

        runtime.searchRecords = records;
        runtime.searchLoadedAt = Date.now();
        return records;
    }

    function renderSearchResults(term = '') {
        const target = document.getElementById('atlas-v142-search-results');
        if (!target) return;
        const query = normalize(term);
        const results = runtime.searchRecords
            .filter(record => !query || record.search.includes(query))
            .slice(0, 80);

        target.innerHTML = results.length ? results.map(record => `<article class="atlas-v142-list-item">
            <div class="atlas-v142-list-copy"><strong>${html(record.title)}</strong><span>${html(record.subtitle)}</span><small>${html(ENTITY_META[record.entityType]?.label || record.entityType)}</small></div>
            <div class="atlas-v142-list-actions">
                <button type="button" class="atlas-v142-btn" onclick="atlasV142NavegarResultado('${jsAttr(record.entityType)}','${jsAttr(record.id)}')"><i data-lucide="arrow-up-right"></i>Abrir</button>
                <button type="button" class="atlas-v142-btn" onclick="atlasV142AbrirColaboracao('${jsAttr(record.entityType)}','${jsAttr(record.id)}','${jsAttr(record.title)}')"><i data-lucide="message-square"></i>Conversa</button>
            </div>
        </article>`).join('') : '<div class="atlas-v142-empty">Nenhum registro corresponde à pesquisa.</div>';
        refreshIcons(target);
    }

    async function openGlobalSearch() {
        openModal({
            title: 'Busca global',
            subtitle: 'Localize registros em todos os módulos do Atlas.',
            wide: true,
            body: `<div class="atlas-v142-search-box"><i data-lucide="search"></i><input id="atlas-v142-global-search-input" class="atlas-v142-input" type="search" placeholder="Cidade, obra, projeto, elemento, ticket ou responsável" oninput="atlasV142FiltrarBusca(this.value)" autocomplete="off"></div><div id="atlas-v142-search-results"><div class="atlas-v142-empty">Carregando índice de pesquisa...</div></div>`
        });
        try {
            await loadSearchIndex(false);
            renderSearchResults('');
            document.getElementById('atlas-v142-global-search-input')?.focus();
        } catch (error) {
            await captureError('busca_global', 'carregar_indice', error);
            const target = document.getElementById('atlas-v142-search-results');
            if (target) target.innerHTML = `<div class="atlas-v142-empty">Não foi possível carregar a busca. Confirme o SQL da V1.4.2 e tente novamente.</div>`;
        }
    }

    function findSearchRecord(entityType, id) {
        return runtime.searchRecords.find(record => record.entityType === entityType && record.id === String(id));
    }

    async function navigateResult(entityType, id) {
        const record = findSearchRecord(entityType, id);
        if (!record) return;
        closeModal();

        state.moduloAtivo = record.module || 'admin_obras';
        if (record.module === 'admin_obras') {
            state.adminVisualizacao = record.view || 'status';
            if (entityType === 'documentacao_rede_geral') state.adminDetalhesAbertos[id] = true;
            if (entityType === 'manutencao_rede') {
                state.adminVisualizacao = 'manutencao_redes';
                state.manutencaoRedeFiltros = { regional: '', cidade: '', documentacao: '', status: '', prioridade: '', responsavel: '', tipo: '', inicio: '', fim: '' };
            }
            if (entityType === 'elemento_documentacao') {
                state.obraAtiva = record.item.obra_id || record.item.obraId || state.obraAtiva;
                state.linhasExpandidas[id] = true;
            }
            if (entityType === 'subelemento_documentacao' && record.parent) {
                state.obraAtiva = record.parent.obra_id || record.parent.obraId || state.obraAtiva;
                state.linhasExpandidas[record.parent.id] = true;
            }
        } else if (record.module === 'expansoes') {
            state.expansoesVisualizacao = record.item.obra_nome ? 'obras' : 'tabela';
            const parentId = record.parent?.id || id;
            state.expansoesProjetosAbertos[parentId] = true;
            if (record.item.obra_nome) state.expansoesObraAtiva = record.item.obra_nome;
        } else if (record.module === 'pmo') {
            state.pmoVisualizacao = 'analise_novos_projetos';
            state.pmoProjetoAberto = record.parent?.id || id;
        }

        if (typeof atualizarVisibilidadeModulos === 'function') atualizarVisibilidadeModulos();
        if (record.module === 'expansoes' && typeof carregarExpansoes === 'function') await carregarExpansoes();
        else if (record.module === 'pmo' && typeof carregarPMO === 'function') await carregarPMO();
        else if (entityType === 'manutencao_rede' && typeof carregarManutencoesRede === 'function') await carregarManutencoesRede();
        else if (record.module === 'admin_obras' && state.adminVisualizacao === 'obras' && typeof inicializarBanco === 'function') await inicializarBanco();
        else if (record.module === 'admin_obras' && typeof carregarAdminObras === 'function') await carregarAdminObras();
        else if (typeof renderApp === 'function') renderApp();
        setTimeout(() => {
            const element = document.querySelector(`[data-atlas-entity-type="${CSS.escape(entityType)}"][data-atlas-entity-id="${CSS.escape(String(id))}"]`);
            if (!element) return;
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            element.classList.add('atlas-v142-highlight');
            setTimeout(() => element.classList.remove('atlas-v142-highlight'), 3200);
        }, 450);
    }

    function collaborationRoot() {
        let root = document.getElementById('atlas-v142-collaboration-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'atlas-v142-collaboration-root';
            document.body.appendChild(root);
        }
        return root;
    }

    async function loadMentionProfiles() {
        if (runtime.mentionProfiles.length) return runtime.mentionProfiles;
        try {
            const { data, error } = await supabaseClient.rpc('atlas_list_mentionable_profiles');
            if (error) throw error;
            runtime.mentionProfiles = data || [];
        } catch (_) {
            runtime.mentionProfiles = (state.usuariosAtlas || []).filter(profile => profile.status === 'ativo');
        }
        return runtime.mentionProfiles;
    }

    async function loadCollaborationData() {
        const entity = runtime.currentEntity;
        if (!entity || !supabaseClient) return;
        const [commentsResult, historyResult] = await Promise.all([
            supabaseClient.from('atlas_comments').select('*').eq('entity_type', entity.type).eq('entity_id', entity.id).order('created_at', { ascending: true }),
            supabaseClient.from('atlas_auditoria').select('*').eq('entidade_tipo', entity.type).eq('entidade_id', entity.id).order('created_at', { ascending: false }).limit(150)
        ]);
        if (commentsResult.error) throw commentsResult.error;
        if (historyResult.error) throw historyResult.error;
        runtime.comments = commentsResult.data || [];
        runtime.history = historyResult.data || [];
        await loadMentionProfiles();
    }

    function profileName(id) {
        const profile = runtime.mentionProfiles.find(item => item.id === id);
        return profile?.nome || profile?.email || 'Usuário Atlas';
    }

    function renderCollaborationBody() {
        const body = document.getElementById('atlas-v142-collab-body');
        const form = document.getElementById('atlas-v142-comment-form');
        if (!body) return;

        if (runtime.collaborationTab === 'history') {
            body.innerHTML = `<div class="atlas-v142-history-list">${runtime.history.length ? runtime.history.map(item => `<article class="atlas-v142-history-item">
                <header><strong>${html(item.usuario_nome || item.usuario || 'Atlas')}</strong><span>${html(dateTime(item.created_at))}</span></header>
                <p><b>${html(item.acao || 'Alteração')}</b> em ${html(item.campo || item.entidade_tipo || 'registro')}</p>
                ${(item.valor_anterior || item.valor_novo) ? `<small>${html(item.valor_anterior || 'vazio')} → ${html(item.valor_novo || 'vazio')}</small>` : ''}
                ${item.detalhe ? `<small>${html(item.detalhe)}</small>` : ''}
            </article>`).join('') : '<div class="atlas-v142-empty">Nenhuma alteração foi registrada para este item.</div>'}</div>`;
            if (form) form.classList.add('hidden');
        } else {
            body.innerHTML = `<div class="atlas-v142-comment-list">${runtime.comments.length ? runtime.comments.map(comment => `<article class="atlas-v142-comment ${comment.resolved_at ? 'is-resolved' : ''}">
                <header><strong>${html(profileName(comment.created_by))}</strong><span>${html(dateTime(comment.created_at))}</span></header>
                <p>${html(comment.body)}</p>
                <div class="atlas-v142-list-actions">
                    ${comment.resolved_at ? '<span class="atlas-v142-pill success">Resolvido</span>' : (canWrite() ? `<button type="button" class="atlas-v142-btn" onclick="atlasV142ResolverComentario('${jsAttr(comment.id)}')"><i data-lucide="check"></i>Resolver</button>` : '')}
                    ${(comment.created_by === userId() || isAdmin()) ? `<button type="button" class="atlas-v142-btn danger" onclick="atlasV142ExcluirComentario('${jsAttr(comment.id)}')"><i data-lucide="trash-2"></i>Excluir</button>` : ''}
                </div>
            </article>`).join('') : '<div class="atlas-v142-empty">Nenhum comentário. Use este espaço para alinhar o trabalho sem perder o contexto do registro.</div>'}</div>`;
            if (form) form.classList.toggle('hidden', !canWrite());
        }
        refreshIcons(body);
    }

    async function openCollaboration(entityType, entityId, entityName) {
        runtime.currentEntity = { type: String(entityType), id: String(entityId), name: String(entityName || 'Registro') };
        runtime.collaborationTab = 'comments';
        const root = collaborationRoot();
        root.innerHTML = `<div class="atlas-v142-collab-overlay" onclick="atlasV142FecharColaboracao(event)">
            <aside class="atlas-v142-collab-drawer" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
                <header class="atlas-v142-modal-head">
                    <div><div class="atlas-v142-kicker">Colaboração</div><h2>${html(runtime.currentEntity.name)}</h2><p>Comentários, menções e histórico deste registro.</p></div>
                    <button type="button" class="atlas-v142-icon-btn" onclick="atlasV142FecharColaboracao()" title="Fechar" aria-label="Fechar"><i data-lucide="x"></i><span class="atlas-v142-icon-fallback" aria-hidden="true">&times;</span></button>
                </header>
                <div class="atlas-v142-tabs"><button id="atlas-v142-tab-comments" class="is-active" onclick="atlasV142MudarAbaColaboracao('comments')">Comentários</button><button id="atlas-v142-tab-history" onclick="atlasV142MudarAbaColaboracao('history')">Histórico</button></div>
                <div class="atlas-v142-collab-body" id="atlas-v142-collab-body"><div class="atlas-v142-empty">Carregando colaboração...</div></div>
                <form class="atlas-v142-comment-form" id="atlas-v142-comment-form" onsubmit="atlasV142EnviarComentario(event)">
                    <textarea class="atlas-v142-textarea" name="body" maxlength="3000" required placeholder="Escreva um comentário objetivo..."></textarea>
                    <div class="atlas-v142-comment-form-actions">
                        <label class="atlas-v142-field"><span>Notificar usuário</span><select class="atlas-v142-select" name="mention"><option value="">Sem menção</option></select></label>
                        <button type="submit" class="atlas-v142-btn primary"><i data-lucide="send"></i>Enviar</button>
                    </div>
                </form>
            </aside>
        </div>`;
        refreshIcons(root);
        try {
            await loadCollaborationData();
            const select = root.querySelector('select[name="mention"]');
            if (select) select.innerHTML = '<option value="">Sem menção</option>' + runtime.mentionProfiles.filter(profile => profile.id !== userId()).map(profile => `<option value="${html(profile.id)}">${html(profile.nome || profile.email)}</option>`).join('');
            renderCollaborationBody();
        } catch (error) {
            await captureError('colaboracao', 'carregar', error, runtime.currentEntity);
            const body = document.getElementById('atlas-v142-collab-body');
            if (body) body.innerHTML = '<div class="atlas-v142-empty">A colaboração está aguardando o SQL da V1.4.2 ou não pôde ser carregada.</div>';
        }
    }

    function closeCollaboration(event) {
        if (event && event.target !== event.currentTarget) return;
        collaborationRoot().innerHTML = '';
        runtime.currentEntity = null;
    }

    function changeCollaborationTab(tab) {
        runtime.collaborationTab = tab === 'history' ? 'history' : 'comments';
        document.getElementById('atlas-v142-tab-comments')?.classList.toggle('is-active', runtime.collaborationTab === 'comments');
        document.getElementById('atlas-v142-tab-history')?.classList.toggle('is-active', runtime.collaborationTab === 'history');
        renderCollaborationBody();
    }

    async function sendComment(event) {
        event?.preventDefault();
        if (!canWrite() || !runtime.currentEntity) return;
        const form = event.target;
        const body = String(form.body?.value || '').trim();
        const mentionId = String(form.mention?.value || '');
        if (!body) return;
        const comment = {
            id: uid('comment'),
            entity_type: runtime.currentEntity.type,
            entity_id: runtime.currentEntity.id,
            entity_name: runtime.currentEntity.name,
            body,
            created_by: userId(),
            updated_at: new Date().toISOString()
        };
        try {
            operation('Salvando comentário...');
            const { error } = await supabaseClient.from('atlas_comments').insert([comment]);
            if (error) throw error;
            if (mentionId) {
                const { error: mentionError } = await supabaseClient.from('atlas_comment_mentions').insert([{
                    id: uid('mention'),
                    comment_id: comment.id,
                    user_id: mentionId
                }]);
                if (mentionError) throw mentionError;
            }
            if (typeof registrarAuditoria === 'function') await registrarAuditoria('comentário', runtime.currentEntity.type, runtime.currentEntity.id, runtime.currentEntity.name, 'comentário', '', body, mentionId ? 'Comentário com menção' : 'Comentário adicionado');
            form.reset();
            await loadCollaborationData();
            renderCollaborationBody();
            operation('Comentário salvo.', 'success');
            await loadNotificationCount();
        } catch (error) {
            await captureError('colaboracao', 'salvar_comentario', error, runtime.currentEntity);
            operation('Erro ao salvar comentário: ' + (error.message || error), 'error');
        }
    }

    async function resolveComment(id) {
        try {
            const { error } = await supabaseClient.from('atlas_comments').update({ resolved_at: new Date().toISOString(), resolved_by: userId(), updated_at: new Date().toISOString() }).eq('id', id);
            if (error) throw error;
            await loadCollaborationData();
            renderCollaborationBody();
        } catch (error) {
            await captureError('colaboracao', 'resolver_comentario', error, { commentId: id });
            operation('Erro ao resolver comentário.', 'error');
        }
    }

    async function deleteComment(id) {
        const confirmed = typeof confirmarVisualAtnx === 'function' ? await confirmarVisualAtnx('Excluir comentário', 'Excluir este comentário e suas menções?', 'Excluir') : confirm('Excluir comentário?');
        if (!confirmed) return;
        try {
            const { error } = await supabaseClient.from('atlas_comments').delete().eq('id', id);
            if (error) throw error;
            await loadCollaborationData();
            renderCollaborationBody();
        } catch (error) {
            await captureError('colaboracao', 'excluir_comentario', error, { commentId: id });
            operation('Erro ao excluir comentário.', 'error');
        }
    }

    function collaborationButton(entityType, entityId, entityName) {
        return `<button type="button" class="atlas-v142-record-action" onclick="event.stopPropagation();atlasV142AbrirColaboracao('${jsAttr(entityType)}','${jsAttr(entityId)}','${jsAttr(entityName)}')" title="Comentários e histórico" aria-label="Abrir comentários e histórico"><i data-lucide="message-square"></i></button>`;
    }

    async function loadNotificationCount() {
        if (!supabaseClient || !userId()) return;
        try {
            const { count, error } = await supabaseClient.from('atlas_notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId()).is('read_at', null);
            if (error) throw error;
            const badge = document.getElementById('atlas-v142-notification-count');
            if (!badge) return;
            const total = Number(count || 0);
            badge.textContent = total > 99 ? '99+' : String(total);
            badge.classList.toggle('hidden', total === 0);
        } catch (_) {
            // O SQL pode ainda nao ter sido executado.
        }
    }

    async function openNotifications() {
        openModal({
            title: 'Notificações',
            subtitle: 'Menções, responsabilidades, prazos e alterações importantes.',
            body: '<div class="atlas-v142-toolbar"><button type="button" class="atlas-v142-btn" onclick="atlasV142MarcarTodasNotificacoes()"><i data-lucide="check-check"></i>Marcar todas como lidas</button></div><div id="atlas-v142-notifications-list"><div class="atlas-v142-empty">Carregando notificações...</div></div>'
        });
        try {
            const { data, error } = await supabaseClient.from('atlas_notifications').select('*').eq('user_id', userId()).order('created_at', { ascending: false }).limit(100);
            if (error) throw error;
            runtime.notifications = data || [];
            renderNotifications();
        } catch (error) {
            await captureError('notificacoes', 'carregar', error);
            const target = document.getElementById('atlas-v142-notifications-list');
            if (target) target.innerHTML = '<div class="atlas-v142-empty">As notificações estão aguardando o SQL da V1.4.2.</div>';
        }
    }

    function renderNotifications() {
        const target = document.getElementById('atlas-v142-notifications-list');
        if (!target) return;
        target.innerHTML = runtime.notifications.length ? `<div class="atlas-v142-list">${runtime.notifications.map(item => `<article class="atlas-v142-list-item ${item.read_at ? '' : 'is-unread'}">
            <div class="atlas-v142-list-copy"><strong>${html(item.title)}</strong><span>${html(item.body || '')}</span><small>${html(item.entity_name || '')} · ${html(dateTime(item.created_at))}</small></div>
            <div class="atlas-v142-list-actions">
                ${item.entity_type && item.entity_id ? `<button type="button" class="atlas-v142-btn" onclick="atlasV142AbrirNotificacao('${jsAttr(item.id)}')"><i data-lucide="arrow-up-right"></i>Abrir</button>` : ''}
                ${item.read_at ? '' : `<button type="button" class="atlas-v142-btn" onclick="atlasV142MarcarNotificacao('${jsAttr(item.id)}')"><i data-lucide="check"></i>Lida</button>`}
            </div>
        </article>`).join('')}</div>` : '<div class="atlas-v142-empty">Você não possui notificações.</div>';
        refreshIcons(target);
    }

    async function markNotification(id, render = true) {
        const { error } = await supabaseClient.from('atlas_notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId());
        if (error) throw error;
        const item = runtime.notifications.find(notification => notification.id === id);
        if (item) item.read_at = new Date().toISOString();
        if (render) renderNotifications();
        await loadNotificationCount();
    }

    async function openNotification(id) {
        const item = runtime.notifications.find(notification => notification.id === id);
        if (!item) return;
        try { await markNotification(id, false); } catch (_) {}
        closeModal();
        if (item.entity_type && item.entity_id) await openCollaboration(item.entity_type, item.entity_id, item.entity_name || 'Registro');
    }

    async function markAllNotifications() {
        try {
            const { error } = await supabaseClient.from('atlas_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId()).is('read_at', null);
            if (error) throw error;
            runtime.notifications.forEach(item => { item.read_at = item.read_at || new Date().toISOString(); });
            renderNotifications();
            await loadNotificationCount();
        } catch (error) {
            await captureError('notificacoes', 'marcar_todas', error);
        }
    }

    function openHub() {
        const adminNote = isAdmin() ? 'A Central de erros está disponível para seu perfil.' : 'A Central de erros é restrita aos administradores.';
        openModal({
            title: 'Ferramentas de produtividade',
            subtitle: 'Organize, importe, recupere e reutilize informações do Atlas.',
            wide: true,
            body: `<div class="atlas-v142-hub-grid">
                <button type="button" class="atlas-v142-hub-action" onclick="atlasV142AbrirVisualizacoes()"><i data-lucide="bookmark"></i><strong>Visualizações salvas</strong><small>Guarde filtros, colunas, posição e contexto por usuário.</small></button>
                <button type="button" class="atlas-v142-hub-action" onclick="atlasV142AbrirAcoesMassa()"><i data-lucide="list-checks"></i><strong>Ações em massa</strong><small>Atualize vários registros com confirmação e auditoria.</small></button>
                <button type="button" class="atlas-v142-hub-action" onclick="atlasV142AbrirImportacao()"><i data-lucide="file-up"></i><strong>Importação assistida</strong><small>Mapeie planilhas, valide e confira antes de salvar.</small></button>
                <button type="button" class="atlas-v142-hub-action" onclick="atlasV142AbrirLixeira()"><i data-lucide="archive-restore"></i><strong>Lixeira</strong><small>Restaure registros excluídos ou remova-os definitivamente.</small></button>
                <button type="button" class="atlas-v142-hub-action" onclick="atlasV142AbrirModelos()"><i data-lucide="copy-plus"></i><strong>Modelos reutilizáveis</strong><small>Reaproveite estruturas sem copiar anexos ou históricos.</small></button>
                <button type="button" class="atlas-v142-hub-action" onclick="atlasV142AbrirErros()" ${isAdmin() ? '' : 'disabled'}><i data-lucide="triangle-alert"></i><strong>Central de erros</strong><small>${html(adminNote)}</small></button>
            </div>`
        });
    }

    function currentViewConfiguration() {
        const scroll = document.getElementById('main-scroll-container');
        const visibleTable = [...document.querySelectorAll('#main-scroll-container table')].find(table => table.offsetParent !== null);
        const columns = visibleTable ? [...visibleTable.querySelectorAll('thead th')].map((th, index) => ({
            index,
            label: String(th.textContent || '').trim(),
            width: Math.round(th.getBoundingClientRect().width)
        })) : [];
        return {
            module: state.moduloAtivo,
            adminView: state.adminVisualizacao,
            expansionsView: state.expansoesVisualizacao,
            pmoView: state.pmoVisualizacao,
            activeWork: state.obraAtiva,
            activeTab: state.abaAtiva,
            expansionWork: state.expansoesObraAtiva,
            searchTerm: state.termoPesquisa,
            maintenanceFilters: { ...(state.manutencaoRedeFiltros || {}) },
            scroll: { top: Number(scroll?.scrollTop || 0), left: Number(scroll?.scrollLeft || 0) },
            columns
        };
    }

    async function openSavedViews() {
        openModal({
            title: 'Visualizações salvas',
            subtitle: 'Salve a organização atual para retornar ao mesmo contexto depois.',
            body: `<form class="atlas-v142-toolbar" onsubmit="atlasV142SalvarVisualizacao(event)"><input class="atlas-v142-input" style="flex:1;min-width:220px" name="name" maxlength="80" required placeholder="Nome da visualização"><label class="atlas-v142-check-row" style="min-height:38px"><input type="checkbox" name="defaultView"><span>Usar como padrão</span></label><button class="atlas-v142-btn primary" type="submit"><i data-lucide="bookmark-plus"></i>Salvar visão atual</button></form><div id="atlas-v142-saved-views"><div class="atlas-v142-empty">Carregando visualizações...</div></div>`
        });
        await loadSavedViews();
    }

    async function loadSavedViews() {
        try {
            const { data, error } = await supabaseClient.from('atlas_saved_views').select('*').eq('user_id', userId()).order('created_at', { ascending: false });
            if (error) throw error;
            runtime.savedViews = data || [];
            renderSavedViews();
        } catch (error) {
            await captureError('visualizacoes', 'carregar', error);
            const target = document.getElementById('atlas-v142-saved-views');
            if (target) target.innerHTML = '<div class="atlas-v142-empty">As visualizações estão aguardando o SQL da V1.4.2.</div>';
        }
    }

    function renderSavedViews() {
        const target = document.getElementById('atlas-v142-saved-views');
        if (!target) return;
        target.innerHTML = runtime.savedViews.length ? `<div class="atlas-v142-list">${runtime.savedViews.map(view => `<article class="atlas-v142-list-item">
            <div class="atlas-v142-list-copy"><strong>${html(view.name)} ${view.is_default ? '<span class="atlas-v142-pill success">Padrão</span>' : ''}</strong><span>${html(view.module)} · ${html(view.context || 'padrao')}</span><small>Atualizada em ${html(dateTime(view.updated_at || view.created_at))}</small></div>
            <div class="atlas-v142-list-actions"><button class="atlas-v142-btn primary" type="button" onclick="atlasV142AplicarVisualizacao('${jsAttr(view.id)}')"><i data-lucide="play"></i>Aplicar</button><button class="atlas-v142-btn danger" type="button" onclick="atlasV142ExcluirVisualizacao('${jsAttr(view.id)}')"><i data-lucide="trash-2"></i>Excluir</button></div>
        </article>`).join('')}</div>` : '<div class="atlas-v142-empty">Nenhuma visualização salva. Organize um módulo e salve o estado atual.</div>';
        refreshIcons(target);
    }

    async function saveView(event) {
        event?.preventDefault();
        const form = event?.currentTarget || event?.target;
        const name = String(form?.elements?.name?.value || '').trim();
        if (!name) return;
        const isDefault = !!form?.elements?.defaultView?.checked;
        const configuration = currentViewConfiguration();
        try {
            operation('Salvando visualização...');
            if (isDefault) await supabaseClient.from('atlas_saved_views').update({ is_default: false, updated_at: new Date().toISOString() }).eq('user_id', userId());
            const { error } = await supabaseClient.from('atlas_saved_views').insert([{
                id: uid('view'),
                user_id: userId(),
                name,
                module: state.moduloAtivo || 'admin_obras',
                context: [state.adminVisualizacao, state.expansoesVisualizacao, state.pmoVisualizacao].filter(Boolean).join(':') || 'padrao',
                configuration,
                is_default: isDefault,
                updated_at: new Date().toISOString()
            }]);
            if (error) throw error;
            form?.reset();
            await loadSavedViews();
            operation('Visualização salva.', 'success');
        } catch (error) {
            await captureError('visualizacoes', 'salvar', error);
            operation('Erro ao salvar visualização.', 'error');
        }
    }

    async function refreshModuleData() {
        if (state.moduloAtivo === 'expansoes' && typeof carregarExpansoes === 'function') return carregarExpansoes();
        if (state.moduloAtivo === 'pmo' && typeof carregarPMO === 'function') return carregarPMO();
        if (state.moduloAtivo === 'admin_obras' && state.adminVisualizacao === 'manutencao_redes' && typeof carregarManutencoesRede === 'function') return carregarManutencoesRede();
        if (state.moduloAtivo === 'admin_obras' && state.adminVisualizacao !== 'obras' && typeof carregarAdminObras === 'function') return carregarAdminObras();
        if (state.moduloAtivo === 'admin_obras' && state.adminVisualizacao === 'obras' && typeof inicializarBanco === 'function') return inicializarBanco();
        if (typeof renderApp === 'function') renderApp();
        return null;
    }

    async function applyView(id) {
        const view = runtime.savedViews.find(item => item.id === id);
        if (!view) return;
        const config = view.configuration || {};
        closeModal();
        state.moduloAtivo = config.module || view.module || 'admin_obras';
        if (config.adminView) state.adminVisualizacao = config.adminView;
        if (config.expansionsView) state.expansoesVisualizacao = config.expansionsView;
        if (config.pmoView) state.pmoVisualizacao = config.pmoView;
        if (config.activeWork !== undefined) state.obraAtiva = config.activeWork;
        if (config.activeTab) state.abaAtiva = config.activeTab;
        if (config.expansionWork !== undefined) state.expansoesObraAtiva = config.expansionWork;
        if (config.searchTerm !== undefined) state.termoPesquisa = config.searchTerm;
        if (config.maintenanceFilters) state.manutencaoRedeFiltros = { ...state.manutencaoRedeFiltros, ...config.maintenanceFilters };
        if (typeof atualizarVisibilidadeModulos === 'function') atualizarVisibilidadeModulos();
        await refreshModuleData();
        setTimeout(() => {
            const scroll = document.getElementById('main-scroll-container');
            if (scroll && config.scroll) {
                scroll.scrollTop = Number(config.scroll.top || 0);
                scroll.scrollLeft = Number(config.scroll.left || 0);
            }
            const table = [...document.querySelectorAll('#main-scroll-container table')].find(item => item.offsetParent !== null);
            (config.columns || []).forEach(column => {
                const th = table?.querySelectorAll('thead th')?.[column.index];
                if (!th || !column.width) return;
                th.style.width = `${column.width}px`;
                th.style.minWidth = `${column.width}px`;
            });
        }, 550);
        operation(`Visualização "${view.name}" aplicada.`, 'success');
    }

    async function deleteView(id) {
        const confirmed = typeof confirmarVisualAtnx === 'function' ? await confirmarVisualAtnx('Excluir visualização', 'Excluir esta visualização salva?', 'Excluir') : confirm('Excluir visualização?');
        if (!confirmed) return;
        const { error } = await supabaseClient.from('atlas_saved_views').delete().eq('id', id).eq('user_id', userId());
        if (error) {
            await captureError('visualizacoes', 'excluir', error, { id });
            return;
        }
        await loadSavedViews();
    }

    const BULK_CONFIG = {
        documentacao_geral: {
            label: 'Documentação Rede Geral',
            table: 'admin_documentacoes',
            entityType: 'documentacao_rede_geral',
            sourceTypes: ['documentacao_rede_geral'],
            fields: {
                status: { label: 'Status', options: ['a_realizar', 'em_andamento', 'parada', 'concluida'] },
                observacao_categoria: { label: 'Categoria da observação' },
                data_previsao_final: { label: 'Previsão final', type: 'date' }
            }
        },
        ativos_documentacao: {
            label: 'Ativos de documentação',
            table: 'elementos_principais',
            entityType: 'elemento_documentacao',
            sourceTypes: ['elemento_documentacao'],
            fields: {
                status: { label: 'Status', options: ['Não iniciado', 'Em andamento', 'Parado', 'Concluído'] },
                tecnico: { label: 'Responsável' },
                data: { label: 'Data', type: 'date' }
            }
        },
        manutencao: {
            label: 'Manutenção de Redes',
            table: 'atlas_manutencoes_rede',
            entityType: 'manutencao_rede',
            sourceTypes: ['manutencao_rede'],
            fields: {
                status: { label: 'Status', options: ['Aberta', 'Em análise', 'Em execução', 'Concluída', 'Cancelada'] },
                prioridade: { label: 'Prioridade', options: ['Baixa', 'Média', 'Alta', 'Crítica'] },
                responsavel: { label: 'Responsável' },
                regional: { label: 'Regional', options: ['Regional PB', 'Regional RN', 'Regional PE', 'Regional BA'] },
                documentacao_status: { label: 'Documentação', options: ['Documentado', 'Não documentado'] },
                data_conclusao: { label: 'Data de conclusão', type: 'date' }
            }
        },
        expansoes: {
            label: 'Expansões',
            table: 'atlas_expansoes',
            entityType: 'expansao',
            sourceTypes: ['expansao'],
            fields: {
                status: { label: 'Status', options: ['', 'Em Progresso', 'Parado', 'Concluído', 'Inviável'] },
                responsavel: { label: 'Responsável' },
                grupo: { label: 'Grupo', options: ['em_progresso', 'grande_porte', 'pequeno_porte', 'concluidos'] },
                fase: { label: 'Fase', options: ['kmz', 'lancamento', 'fusoes', 'homologacao_final'] },
                data_previsao_final: { label: 'Previsão final', type: 'date' }
            }
        },
        pmo: {
            label: 'PMO',
            table: 'atlas_pmo_projetos',
            entityType: 'pmo_projeto',
            sourceTypes: ['pmo_projeto'],
            fields: {
                status: { label: 'Status', options: typeof ATLAS_PMO_STATUS_REFERENCIA !== 'undefined' ? ATLAS_PMO_STATUS_REFERENCIA : ['AVALIAÇÃO INICIAL', 'EXECUTANDO', 'CONCLUÍDO'] },
                projetista: { label: 'Responsável / Projetista' },
                regional: { label: 'Regional' },
                origem: { label: 'Origem' },
                timeline_fim: { label: 'Prazo final', type: 'date' }
            }
        }
    };

    async function openBulkActions() {
        openModal({
            title: 'Ações em massa',
            subtitle: 'Selecione registros e aplique uma alteração auditável.',
            wide: true,
            body: `<div class="atlas-v142-form-grid is-three">
                <label class="atlas-v142-field"><span>Conjunto de dados</span><select class="atlas-v142-select" id="atlas-v142-bulk-module" onchange="atlasV142MudarModuloMassa(this.value)">${Object.entries(BULK_CONFIG).map(([key, cfg]) => `<option value="${key}" ${key === runtime.bulkModule ? 'selected' : ''}>${html(cfg.label)}</option>`).join('')}</select></label>
                <label class="atlas-v142-field"><span>Pesquisar registros</span><input class="atlas-v142-input" id="atlas-v142-bulk-filter" oninput="atlasV142RenderizarItensMassa(this.value)" placeholder="Filtrar lista"></label>
                <label class="atlas-v142-field"><span>Alteração</span><select class="atlas-v142-select" id="atlas-v142-bulk-field" onchange="atlasV142RenderizarValorMassa()"></select></label>
            </div>
            <div id="atlas-v142-bulk-value"></div>
            <div class="atlas-v142-summary"><span class="atlas-v142-pill" id="atlas-v142-bulk-count">0 selecionados</span><button type="button" class="atlas-v142-btn" onclick="atlasV142SelecionarTodosMassa(true)">Selecionar visíveis</button><button type="button" class="atlas-v142-btn" onclick="atlasV142SelecionarTodosMassa(false)">Limpar seleção</button><button type="button" class="atlas-v142-btn primary" onclick="atlasV142AplicarAcaoMassa()"><i data-lucide="check-check"></i>Aplicar alteração</button></div>
            <div class="atlas-v142-check-list" id="atlas-v142-bulk-list"><div class="atlas-v142-empty">Carregando registros...</div></div>`
        });
        runtime.bulkSelected.clear();
        await loadSearchIndex(false);
        renderBulkFields();
        renderBulkItems('');
    }

    function bulkRecords() {
        const cfg = BULK_CONFIG[runtime.bulkModule];
        return runtime.searchRecords.filter(record => cfg?.sourceTypes.includes(record.entityType));
    }

    function changeBulkModule(module) {
        runtime.bulkModule = BULK_CONFIG[module] ? module : 'manutencao';
        runtime.bulkSelected.clear();
        renderBulkFields();
        renderBulkItems(document.getElementById('atlas-v142-bulk-filter')?.value || '');
    }

    function renderBulkFields() {
        const cfg = BULK_CONFIG[runtime.bulkModule];
        const select = document.getElementById('atlas-v142-bulk-field');
        if (!cfg || !select) return;
        select.innerHTML = Object.entries(cfg.fields).map(([key, field]) => `<option value="${html(key)}">${html(field.label)}</option>`).join('') + (canDelete() ? '<option value="__trash__">Mover para a lixeira</option>' : '');
        renderBulkValue();
    }

    function renderBulkValue() {
        const target = document.getElementById('atlas-v142-bulk-value');
        const fieldKey = document.getElementById('atlas-v142-bulk-field')?.value;
        const field = BULK_CONFIG[runtime.bulkModule]?.fields?.[fieldKey];
        if (!target) return;
        if (fieldKey === '__trash__') {
            target.innerHTML = '<div class="atlas-v142-warning">Os registros selecionados serão arquivados por 30 dias antes da exclusão definitiva.</div>';
        } else if (field?.options) {
            target.innerHTML = `<label class="atlas-v142-field"><span>Novo valor</span><select class="atlas-v142-select" id="atlas-v142-bulk-new-value">${field.options.map(value => `<option value="${html(value)}">${html(value || 'Em branco')}</option>`).join('')}</select></label>`;
        } else {
            target.innerHTML = `<label class="atlas-v142-field"><span>Novo valor</span><input class="atlas-v142-input" id="atlas-v142-bulk-new-value" type="${field?.type === 'date' ? 'date' : 'text'}"></label>`;
        }
    }

    function renderBulkItems(filter = '') {
        const target = document.getElementById('atlas-v142-bulk-list');
        if (!target) return;
        const query = normalize(filter);
        const records = bulkRecords().filter(record => !query || record.search.includes(query));
        target.dataset.visibleIds = JSON.stringify(records.map(record => record.id));
        target.innerHTML = records.length ? records.map(record => `<label class="atlas-v142-check-row"><input type="checkbox" value="${html(record.id)}" ${runtime.bulkSelected.has(record.id) ? 'checked' : ''} onchange="atlasV142SelecionarItemMassa('${jsAttr(record.id)}', this.checked)"><span><b>${html(record.title)}</b> · ${html(record.subtitle)}</span></label>`).join('') : '<div class="atlas-v142-empty">Nenhum registro disponível neste conjunto.</div>';
        updateBulkCount();
    }

    function selectBulkItem(id, selected) {
        if (selected) runtime.bulkSelected.add(String(id));
        else runtime.bulkSelected.delete(String(id));
        updateBulkCount();
    }

    function selectAllBulk(selected) {
        const target = document.getElementById('atlas-v142-bulk-list');
        const ids = JSON.parse(target?.dataset.visibleIds || '[]');
        ids.forEach(id => selected ? runtime.bulkSelected.add(String(id)) : runtime.bulkSelected.delete(String(id)));
        target?.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = selected; });
        updateBulkCount();
    }

    function updateBulkCount() {
        const target = document.getElementById('atlas-v142-bulk-count');
        if (target) target.textContent = `${runtime.bulkSelected.size} selecionado(s)`;
    }

    async function notifyAssignment(records, value) {
        if (!value) return;
        await loadMentionProfiles();
        const targetUser = runtime.mentionProfiles.find(profile => normalize(profile.nome) === normalize(value) || normalize(profile.email) === normalize(value));
        if (!targetUser || targetUser.id === userId()) return;
        const rows = records.map(record => ({
            id: uid('notification'),
            user_id: targetUser.id,
            notification_type: 'assignment',
            title: 'Nova responsabilidade',
            body: `Você foi definido como responsável por ${record.title}.`,
            entity_type: record.entityType,
            entity_id: record.id,
            entity_name: record.title,
            dedupe_key: `assignment:${record.entityType}:${record.id}:${targetUser.id}:${Date.now()}`,
            created_by: userId()
        }));
        if (rows.length) {
            const { error } = await supabaseClient.from('atlas_notifications').insert(rows);
            if (error) throw error;
        }
    }

    async function applyBulkAction() {
        if (!canWrite()) {
            operation('Seu perfil possui acesso somente para consulta.', 'warning');
            return;
        }
        const cfg = BULK_CONFIG[runtime.bulkModule];
        const field = document.getElementById('atlas-v142-bulk-field')?.value;
        const value = document.getElementById('atlas-v142-bulk-new-value')?.value ?? '';
        const records = bulkRecords().filter(record => runtime.bulkSelected.has(record.id));
        if (!cfg || !field || !records.length) {
            operation('Selecione ao menos um registro.', 'warning');
            return;
        }
        const confirmed = typeof confirmarVisualAtnx === 'function' ? await confirmarVisualAtnx('Confirmar ação em massa', `${field === '__trash__' ? 'Mover' : 'Alterar'} ${records.length} registro(s)?`, field === '__trash__' ? 'Mover' : 'Aplicar') : confirm('Aplicar ação em massa?');
        if (!confirmed) return;
        try {
            operation('Aplicando alterações em massa...');
            if (field === '__trash__') {
                for (const record of records) {
                    await archiveDeletion(record.entityType, record.item, record.table);
                    const { error } = await supabaseClient.from(record.table).delete().eq('id', record.id);
                    if (error) throw error;
                }
            } else {
                const patch = { [field]: value, updated_at: new Date().toISOString() };
                const { error } = await supabaseClient.from(cfg.table).update(patch).in('id', records.map(record => record.id));
                if (error) throw error;
                for (const record of records) {
                    if (typeof registrarAuditoria === 'function') await registrarAuditoria('alteração em massa', record.entityType, record.id, record.title, field, record.item?.[field] ?? '', value, `${records.length} registros atualizados em conjunto`);
                }
                if (['responsavel', 'tecnico', 'projetista'].includes(field)) await notifyAssignment(records, value);
            }
            runtime.searchLoadedAt = 0;
            await loadSearchIndex(true);
            runtime.bulkSelected.clear();
            renderBulkItems(document.getElementById('atlas-v142-bulk-filter')?.value || '');
            await refreshModuleData();
            operation('Ação em massa concluída.', 'success');
        } catch (error) {
            await captureError('acoes_massa', field, error, { module: runtime.bulkModule, ids: records.map(record => record.id) });
            operation('Erro na ação em massa: ' + (error.message || error), 'error');
        }
    }

    const IMPORT_TARGETS = {
        manutencao: {
            label: 'Manutenção de Redes',
            table: 'atlas_manutencoes_rede',
            entityType: 'manutencao_rede',
            key: 'cidade',
            required: ['cidade'],
            fields: {
                cidade: { label: 'Cidade', aliases: ['cidade', 'localidade', 'municipio'] },
                regional: { label: 'Regional', aliases: ['regional', 'regiao'] },
                data_abertura: { label: 'Data de abertura', type: 'date', aliases: ['data', 'data abertura', 'abertura', 'data solicitacao'] },
                tipo_manutencao: { label: 'Tipo de manutenção', aliases: ['tipo manutencao', 'tipo', 'tipo problema', 'problema'] },
                status: { label: 'Status', aliases: ['status', 'situacao'] },
                prioridade: { label: 'Prioridade', aliases: ['prioridade', 'urgencia'] },
                responsavel: { label: 'Responsável', aliases: ['responsavel', 'tecnico'] },
                local_referencia: { label: 'Local / referência', aliases: ['local', 'referencia', 'local referencia'] },
                ponto_rede: { label: 'Ponto de rede', aliases: ['ponto rede', 'cto ceo poste', 'cto', 'ceo', 'poste'] },
                descricao: { label: 'Descrição', aliases: ['descricao', 'problema', 'ocorrencia'] },
                observacoes: { label: 'Observações', aliases: ['observacoes', 'observacao'] },
                protocolo: { label: 'Protocolo / ticket', aliases: ['protocolo', 'ticket', 'chamado'] },
                documentacao_status: { label: 'Documentação', aliases: ['documentacao', 'status documentacao'] },
                geolocalizacao: { label: 'Geolocalização', aliases: ['geolocalizacao', 'coordenadas', 'localizacao'] },
                ticket_aberto_por: { label: 'Ticket aberto por', aliases: ['aberto por', 'solicitante', 'ticket aberto por'] },
                data_conclusao: { label: 'Data de conclusão', type: 'date', aliases: ['data conclusao', 'conclusao'] }
            },
            defaults: { status: 'Aberta', prioridade: 'Media', documentacao_status: 'Não documentado', origem: 'Importação assistida', dados_originais: {} }
        },
        pmo: {
            label: 'PMO - Análise de Projetos',
            table: 'atlas_pmo_projetos',
            entityType: 'pmo_projeto',
            key: 'nome',
            required: ['nome'],
            fields: {
                nome: { label: 'Projeto', aliases: ['projeto', 'nome', 'nome projeto'] },
                status: { label: 'Status', aliases: ['status', 'situacao'] },
                regional: { label: 'Regional', aliases: ['regional', 'regiao'] },
                projetista: { label: 'Projetista', aliases: ['projetista', 'responsavel'] },
                origem: { label: 'Origem', aliases: ['origem', 'solicitante origem'] },
                solicitante: { label: 'Solicitante', aliases: ['solicitante', 'aberto por'] },
                justificativa: { label: 'Justificativa', aliases: ['justificativa', 'descricao'] },
                data_solicitacao: { label: 'Data de solicitação', type: 'date', aliases: ['data solicitacao', 'data'] },
                timeline_inicio: { label: 'Início', type: 'date', aliases: ['inicio', 'data inicio'] },
                timeline_fim: { label: 'Fim / prazo', type: 'date', aliases: ['fim', 'prazo', 'data fim'] },
                portas_ftth: { label: 'Portas FTTH', type: 'number', aliases: ['portas', 'portas ftth'] },
                valor_projeto: { label: 'Valor do projeto', type: 'number', aliases: ['valor', 'valor projeto'] }
            },
            defaults: { status: 'AVALIAÇÃO INICIAL' }
        },
        expansoes: {
            label: 'Expansões - Projetos e Obras',
            table: 'atlas_expansoes',
            entityType: 'expansao',
            key: 'nome',
            required: ['nome'],
            fields: {
                nome: { label: 'Elemento / projeto', aliases: ['elemento', 'projeto', 'nome'] },
                grupo: { label: 'Grupo', aliases: ['grupo', 'onda', 'porte'] },
                obra_nome: { label: 'Obra', aliases: ['obra', 'nome obra'] },
                fase: { label: 'Fase', aliases: ['fase', 'etapa'] },
                status: { label: 'Status', aliases: ['status', 'situacao'] },
                responsavel: { label: 'Responsável', aliases: ['responsavel', 'tecnico'] },
                data_inicio: { label: 'Data de início', type: 'date', aliases: ['inicio', 'data inicio'] },
                data_previsao_final: { label: 'Previsão final', type: 'date', aliases: ['previsao final', 'prazo', 'data fim'] },
                total_projetado: { label: 'Total projetado', type: 'number', aliases: ['total projetado', 'projetado'] },
                total_lancado: { label: 'Total lançado', type: 'number', aliases: ['total lancado', 'lancado'] }
            },
            defaults: { status: 'Em Progresso', grupo: 'em_progresso', fase: 'lancamento' }
        },
        documentacao: {
            label: 'Documentação Rede Geral',
            table: 'admin_documentacoes',
            entityType: 'documentacao_rede_geral',
            key: 'cidade',
            required: ['cidade'],
            fields: {
                cidade: { label: 'Cidade', aliases: ['cidade', 'localidade', 'municipio'] },
                status: { label: 'Status geral', aliases: ['status', 'situacao'] },
                ctos_total: { label: 'CTO planejado', type: 'number', aliases: ['cto', 'ctos', 'cto total'] },
                ctos_documentadas: { label: 'CTO documentado', type: 'number', aliases: ['cto documentado', 'ctos documentados', 'ctos documentadas'] },
                caixas_total: { label: 'CEO planejado', type: 'number', aliases: ['ceo', 'ceos', 'ceo total'] },
                caixas_documentadas: { label: 'CEO documentado', type: 'number', aliases: ['ceo documentado', 'ceos documentados'] },
                pops_total: { label: 'POP planejado', type: 'number', aliases: ['pop', 'pops', 'pop total'] },
                pops_documentados: { label: 'POP documentado', type: 'number', aliases: ['pop documentado', 'pops documentados'] },
                data_inicio: { label: 'Data de início', type: 'date', aliases: ['inicio', 'data inicio'] },
                data_previsao_final: { label: 'Previsão final', type: 'date', aliases: ['previsao', 'prazo', 'data fim'] },
                observacoes: { label: 'Observações', aliases: ['observacoes', 'observacao'] }
            },
            defaults: { status: 'a_realizar', ctos_status: 'a_realizar', caixas_status: 'a_realizar', pops_status: 'a_realizar' }
        }
    };

    function toIsoDate(value) {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
        if (typeof value === 'number' && window.XLSX?.SSF?.parse_date_code) {
            const parsed = window.XLSX.SSF.parse_date_code(value);
            if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
        }
        const raw = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
        const br = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (br) return `${br[3]}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`;
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
    }

    function convertImportValue(value, definition) {
        if (value === undefined || value === null || value === '') return null;
        if (definition?.type === 'date') return toIsoDate(value);
        if (definition?.type === 'number') {
            const number = Number(String(value).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
            return Number.isFinite(number) ? number : 0;
        }
        return String(value).trim();
    }

    function bestImportHeader(fieldKey, definition) {
        const aliases = [fieldKey, definition.label, ...(definition.aliases || [])].map(normalize);
        return runtime.importHeaders.find(header => aliases.includes(normalize(header))) || runtime.importHeaders.find(header => aliases.some(alias => normalize(header).includes(alias) || alias.includes(normalize(header)))) || '';
    }

    function openImport() {
        runtime.importRows = [];
        runtime.importHeaders = [];
        runtime.importFileName = '';
        runtime.importTarget = 'manutencao';
        openModal({
            title: 'Importação assistida',
            subtitle: 'Importe Excel ou CSV com mapeamento, prévia e validação de duplicidades.',
            wide: true,
            body: `<div class="atlas-v142-form-grid">
                <label class="atlas-v142-field"><span>Destino</span><select class="atlas-v142-select" id="atlas-v142-import-target" onchange="atlasV142MudarDestinoImportacao(this.value)">${Object.entries(IMPORT_TARGETS).map(([key, cfg]) => `<option value="${key}">${html(cfg.label)}</option>`).join('')}</select></label>
                <label class="atlas-v142-field"><span>Arquivo</span><input class="atlas-v142-input" id="atlas-v142-import-file" type="file" accept=".xlsx,.xls,.csv" onchange="atlasV142LerArquivoImportacao(this)"></label>
            </div>
            <div id="atlas-v142-import-work"><div class="atlas-v142-empty">Escolha uma planilha para iniciar o mapeamento.</div></div>`
        });
    }

    function changeImportTarget(target) {
        runtime.importTarget = IMPORT_TARGETS[target] ? target : 'manutencao';
        if (runtime.importRows.length) renderImportWorkspace();
    }

    async function readImportFile(input) {
        const file = input?.files?.[0];
        if (!file) return;
        if (!window.XLSX) {
            operation('Leitor de planilhas indisponível. Recarregue a página.', 'error');
            return;
        }
        try {
            operation('Lendo planilha...');
            const buffer = await file.arrayBuffer();
            const workbook = window.XLSX.read(buffer, { type: 'array', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
            runtime.importRows = rows;
            runtime.importHeaders = rows.length ? Object.keys(rows[0]) : [];
            runtime.importFileName = file.name;
            renderImportWorkspace();
            operation(`${rows.length} linha(s) lida(s).`, 'success');
        } catch (error) {
            await captureError('importacao', 'ler_arquivo', error, { file: file.name });
            operation('Não foi possível ler a planilha.', 'error');
        }
    }

    function renderImportWorkspace() {
        const target = document.getElementById('atlas-v142-import-work');
        const cfg = IMPORT_TARGETS[runtime.importTarget];
        if (!target || !cfg) return;
        if (!runtime.importRows.length) {
            target.innerHTML = '<div class="atlas-v142-empty">A planilha não possui linhas de dados.</div>';
            return;
        }
        const mappingRows = Object.entries(cfg.fields).map(([fieldKey, definition]) => {
            const auto = bestImportHeader(fieldKey, definition);
            return `<tr><td><b>${html(definition.label)}</b>${cfg.required.includes(fieldKey) ? ' <span class="atlas-v142-pill warning">Obrigatório</span>' : ''}</td><td><select class="atlas-v142-select atlas-v142-import-map" data-field="${html(fieldKey)}" onchange="atlasV142AtualizarPreviaImportacao()"><option value="">Não importar</option>${runtime.importHeaders.map(header => `<option value="${html(header)}" ${header === auto ? 'selected' : ''}>${html(header)}</option>`).join('')}</select></td></tr>`;
        }).join('');
        target.innerHTML = `<div class="atlas-v142-summary"><span class="atlas-v142-pill">${html(runtime.importFileName)}</span><span class="atlas-v142-pill">${runtime.importRows.length} linha(s)</span><span class="atlas-v142-pill">${runtime.importHeaders.length} coluna(s)</span></div>
            <div class="atlas-v142-form-grid"><div class="atlas-v142-table-wrap"><table class="atlas-v142-table"><thead><tr><th>Campo no Atlas</th><th>Coluna da planilha</th></tr></thead><tbody>${mappingRows}</tbody></table></div><div id="atlas-v142-import-validation"></div></div>
            <div id="atlas-v142-import-preview"></div>
            <div class="atlas-v142-toolbar" style="margin-top:14px"><button type="button" class="atlas-v142-btn primary" onclick="atlasV142ExecutarImportacao()"><i data-lucide="database-zap"></i>Validar e importar</button></div>`;
        updateImportPreview();
        refreshIcons(target);
    }

    function importMapping() {
        const result = {};
        document.querySelectorAll('.atlas-v142-import-map').forEach(select => {
            if (select.value) result[select.dataset.field] = select.value;
        });
        return result;
    }

    function buildImportPayloads() {
        const cfg = IMPORT_TARGETS[runtime.importTarget];
        const mapping = importMapping();
        const payloads = runtime.importRows.map((row, index) => {
            const payload = { ...cfg.defaults, id: uid(cfg.entityType), updated_at: new Date().toISOString() };
            Object.entries(mapping).forEach(([fieldKey, header]) => {
                const value = convertImportValue(row[header], cfg.fields[fieldKey]);
                if (value !== null) payload[fieldKey] = value;
            });
            return { index, payload, original: row };
        });
        return { cfg, mapping, payloads };
    }

    function importExistingKeys(cfg) {
        const types = Object.entries(IMPORT_TARGETS).find(([, item]) => item === cfg)?.[0];
        const entityType = IMPORT_TARGETS[types]?.entityType;
        return new Set(runtime.searchRecords.filter(record => record.entityType === entityType).map(record => normalize(record.item?.[cfg.key])));
    }

    function validateImport() {
        const { cfg, mapping, payloads } = buildImportPayloads();
        const existing = importExistingKeys(cfg);
        const seen = new Set();
        let valid = 0;
        let invalid = 0;
        let duplicates = 0;
        payloads.forEach(entry => {
            entry.missing = cfg.required.filter(field => !String(entry.payload[field] ?? '').trim());
            const key = normalize(entry.payload[cfg.key]);
            entry.duplicate = !!key && (existing.has(key) || seen.has(key));
            if (key) seen.add(key);
            if (entry.missing.length) invalid += 1;
            else if (entry.duplicate) duplicates += 1;
            else valid += 1;
        });
        return { cfg, mapping, payloads, valid, invalid, duplicates };
    }

    function updateImportPreview() {
        const validation = validateImport();
        const summary = document.getElementById('atlas-v142-import-validation');
        const preview = document.getElementById('atlas-v142-import-preview');
        if (summary) summary.innerHTML = `<div class="atlas-v142-summary"><span class="atlas-v142-pill success">${validation.valid} válidas</span><span class="atlas-v142-pill warning">${validation.duplicates} duplicadas</span><span class="atlas-v142-pill">${validation.invalid} incompletas</span></div><div class="atlas-v142-warning">Linhas duplicadas ou sem campos obrigatórios serão ignoradas. Nenhum registro atual será sobrescrito.</div>`;
        if (preview) {
            const fields = Object.keys(validation.mapping).slice(0, 7);
            const rows = validation.payloads.slice(0, 8);
            preview.innerHTML = `<div class="atlas-v142-table-wrap"><table class="atlas-v142-table"><thead><tr><th>Situação</th>${fields.map(field => `<th>${html(validation.cfg.fields[field]?.label || field)}</th>`).join('')}</tr></thead><tbody>${rows.map(entry => `<tr><td>${entry.missing.length ? '<span class="atlas-v142-pill">Incompleta</span>' : entry.duplicate ? '<span class="atlas-v142-pill warning">Duplicada</span>' : '<span class="atlas-v142-pill success">Pronta</span>'}</td>${fields.map(field => `<td class="atlas-v142-preview">${html(entry.payload[field] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        }
    }

    async function executeImport() {
        if (!canWrite()) {
            operation('Seu perfil possui acesso somente para consulta.', 'warning');
            return;
        }
        await loadSearchIndex(false);
        const validation = validateImport();
        const ready = validation.payloads.filter(entry => !entry.missing.length && !entry.duplicate);
        if (!ready.length) {
            operation('Nenhuma linha válida para importar.', 'warning');
            return;
        }
        const confirmed = typeof confirmarVisualAtnx === 'function' ? await confirmarVisualAtnx('Confirmar importação', `Importar ${ready.length} registro(s) em ${validation.cfg.label}?`, 'Importar') : confirm('Confirmar importação?');
        if (!confirmed) return;
        const batchId = uid('import');
        try {
            operation('Importando dados...');
            const { error: batchError } = await supabaseClient.from('atlas_import_batches').insert([{
                id: batchId,
                target_module: runtime.importTarget,
                file_name: runtime.importFileName,
                mapping: validation.mapping,
                summary: { total: validation.payloads.length, ready: ready.length, duplicates: validation.duplicates, invalid: validation.invalid },
                status: 'processing',
                created_by: userId()
            }]);
            if (batchError) throw batchError;

            let inserted = 0;
            for (let index = 0; index < ready.length; index += 100) {
                const chunk = ready.slice(index, index + 100).map(entry => entry.payload);
                const { error } = await supabaseClient.from(validation.cfg.table).insert(chunk);
                if (error) throw error;
                inserted += chunk.length;
            }

            await supabaseClient.from('atlas_import_batches').update({ status: 'completed', summary: { total: validation.payloads.length, inserted, duplicates: validation.duplicates, invalid: validation.invalid }, finished_at: new Date().toISOString() }).eq('id', batchId);
            if (typeof registrarAuditoria === 'function') await registrarAuditoria('importação', runtime.importTarget, batchId, runtime.importFileName, 'registros', '0', String(inserted), 'Importação assistida V1.4.2');
            runtime.searchLoadedAt = 0;
            await loadSearchIndex(true);
            await refreshModuleData();
            operation(`${inserted} registro(s) importado(s).`, 'success');
            updateImportPreview();
        } catch (error) {
            await supabaseClient.from('atlas_import_batches').update({ status: 'failed', summary: { error: error.message || String(error) }, finished_at: new Date().toISOString() }).eq('id', batchId);
            await captureError('importacao', runtime.importTarget, error, { file: runtime.importFileName, batchId });
            operation('Erro ao importar: ' + (error.message || error), 'error');
        }
    }

    function compactRecord(record) {
        if (!record || typeof record !== 'object') return record;
        const result = {};
        Object.entries(record).forEach(([key, value]) => {
            if (key === 'subelementos') return;
            result[key] = value;
        });
        return result;
    }

    async function archiveDeletion(entityType, item, sourceTable) {
        if (!canDelete()) throw new Error('Seu perfil não possui permissão para usar a lixeira.');
        const table = sourceTable || SEARCH_TABLES.find(entry => entry[1] === entityType)?.[0];
        if (!table || !item?.id) throw new Error('Registro inválido para arquivamento.');
        const records = [{ table, rows: [compactRecord(item)] }];

        if (entityType === 'obra') {
            const { data: parents, error: parentError } = await supabaseClient.from('elementos_principais').select('*').eq('obra_id', item.id);
            if (parentError) throw parentError;
            const parentRows = parents || [];
            const parentIds = parentRows.map(row => row.id);
            let children = [];
            if (parentIds.length) {
                const { data, error } = await supabaseClient.from('subelementos').select('*').in('pai_id', parentIds);
                if (error) throw error;
                children = data || [];
            }
            records.push({ table: 'elementos_principais', rows: parentRows }, { table: 'subelementos', rows: children });
        } else if (entityType === 'elemento_documentacao') {
            const { data, error } = await supabaseClient.from('subelementos').select('*').eq('pai_id', item.id);
            if (error) throw error;
            records.push({ table: 'subelementos', rows: data || [] });
        } else if (entityType === 'expansao') {
            const { data, error } = await supabaseClient.from('atlas_expansoes_subitems').select('*').eq('expansao_id', item.id);
            if (error) throw error;
            records.push({ table: 'atlas_expansoes_subitems', rows: data || [] });
        } else if (entityType === 'pmo_projeto') {
            const [subs, updates] = await Promise.all([
                supabaseClient.from('atlas_pmo_subelementos').select('*').eq('projeto_id', item.id),
                supabaseClient.from('atlas_pmo_updates').select('*').eq('projeto_id', item.id)
            ]);
            if (subs.error) throw subs.error;
            if (updates.error) throw updates.error;
            records.push({ table: 'atlas_pmo_subelementos', rows: subs.data || [] }, { table: 'atlas_pmo_updates', rows: updates.data || [] });
        }

        const entry = {
            id: uid('trash'),
            entity_type: entityType,
            entity_id: String(item.id),
            entity_name: recordTitle(entityType, item),
            source_table: table,
            records,
            deleted_by: userId(),
            status: 'deleted'
        };
        const { error } = await supabaseClient.from('atlas_trash').insert([entry]);
        if (error) throw new Error(`Não foi possível proteger o registro na lixeira. ${error.message || error}`);
        if (typeof registrarAuditoria === 'function') await registrarAuditoria('lixeira', entityType, String(item.id), entry.entity_name, 'registro', 'ativo', 'lixeira', 'Registro protegido por 30 dias antes da exclusão definitiva');
        return entry;
    }

    async function openTrash() {
        if (!canDelete()) {
            operation('Seu perfil não possui permissão para abrir a lixeira.', 'warning');
            return;
        }
        openModal({
            title: 'Lixeira e restauração',
            subtitle: 'Registros excluídos ficam protegidos por 30 dias.',
            wide: true,
            body: '<div class="atlas-v142-toolbar"><button class="atlas-v142-btn" type="button" onclick="atlasV142CarregarLixeira()"><i data-lucide="refresh-cw"></i>Atualizar</button></div><div id="atlas-v142-trash-list"><div class="atlas-v142-empty">Carregando lixeira...</div></div>'
        });
        await loadTrash();
    }

    async function loadTrash() {
        try {
            const { data, error } = await supabaseClient.from('atlas_trash').select('*').eq('status', 'deleted').order('deleted_at', { ascending: false }).limit(250);
            if (error) throw error;
            runtime.trash = data || [];
            renderTrash();
        } catch (error) {
            await captureError('lixeira', 'carregar', error);
            const target = document.getElementById('atlas-v142-trash-list');
            if (target) target.innerHTML = '<div class="atlas-v142-empty">A lixeira está aguardando o SQL da V1.4.2.</div>';
        }
    }

    function renderTrash() {
        const target = document.getElementById('atlas-v142-trash-list');
        if (!target) return;
        target.innerHTML = runtime.trash.length ? `<div class="atlas-v142-list">${runtime.trash.map(item => `<article class="atlas-v142-list-item">
            <div class="atlas-v142-list-copy"><strong>${html(item.entity_name || item.entity_id)}</strong><span>${html(ENTITY_META[item.entity_type]?.label || item.entity_type)} · ${html(item.source_table)}</span><small>Excluído em ${html(dateTime(item.deleted_at))} · proteção até ${html(dateTime(item.expires_at))}</small></div>
            <div class="atlas-v142-list-actions"><button class="atlas-v142-btn success" type="button" onclick="atlasV142RestaurarLixeira('${jsAttr(item.id)}')"><i data-lucide="archive-restore"></i>Restaurar</button><button class="atlas-v142-btn danger" type="button" onclick="atlasV142ExcluirLixeira('${jsAttr(item.id)}')"><i data-lucide="trash-2"></i>Excluir definitivamente</button></div>
        </article>`).join('')}</div>` : '<div class="atlas-v142-empty">A lixeira está vazia.</div>';
        refreshIcons(target);
    }

    async function restoreTrash(id) {
        const item = runtime.trash.find(entry => entry.id === id);
        if (!item) return;
        const confirmed = typeof confirmarVisualAtnx === 'function' ? await confirmarVisualAtnx('Restaurar registro', `Restaurar "${item.entity_name || item.entity_id}" e seus itens vinculados?`, 'Restaurar') : confirm('Restaurar registro?');
        if (!confirmed) return;
        try {
            operation('Restaurando registro...');
            const groups = Array.isArray(item.records) ? item.records : [];
            for (const group of groups) {
                if (!group.table || !Array.isArray(group.rows) || !group.rows.length) continue;
                const { error } = await supabaseClient.from(group.table).upsert(group.rows, { onConflict: 'id' });
                if (error) throw error;
            }
            const { error } = await supabaseClient.from('atlas_trash').update({ status: 'restored', restored_by: userId(), restored_at: new Date().toISOString() }).eq('id', id);
            if (error) throw error;
            if (typeof registrarAuditoria === 'function') await registrarAuditoria('restauração', item.entity_type, item.entity_id, item.entity_name, 'registro', 'lixeira', 'ativo', 'Registro restaurado pela V1.4.2');
            runtime.searchLoadedAt = 0;
            await loadSearchIndex(true);
            await loadTrash();
            await refreshModuleData();
            operation('Registro restaurado.', 'success');
        } catch (error) {
            await captureError('lixeira', 'restaurar', error, { trashId: id });
            operation('Erro ao restaurar: ' + (error.message || error), 'error');
        }
    }

    async function permanentlyDeleteTrash(id) {
        const item = runtime.trash.find(entry => entry.id === id);
        if (!item) return;
        const confirmed = typeof confirmarVisualAtnx === 'function' ? await confirmarVisualAtnx('Exclusão definitiva', `Excluir definitivamente o backup de "${item.entity_name || item.entity_id}"? Esta ação não poderá ser desfeita.`, 'Excluir definitivamente') : confirm('Excluir definitivamente?');
        if (!confirmed) return;
        try {
            const { error } = await supabaseClient.from('atlas_trash').delete().eq('id', id);
            if (error) throw error;
            await loadTrash();
            operation('Backup removido definitivamente.', 'success');
        } catch (error) {
            await captureError('lixeira', 'excluir_definitivo', error, { trashId: id });
            operation('Erro ao excluir backup.', 'error');
        }
    }

    const TEMPLATE_TYPES = ['elemento_documentacao', 'expansao', 'pmo_projeto', 'manutencao_rede', 'documentacao_rede_geral'];
    const TEMPLATE_OMIT = new Set(['id', 'created_at', 'updated_at', 'fotos', 'diagramas', 'imagens', 'anexos', 'diagrama_fusao', 'fotos_olt', 'lista_materiais', 'projeto_link', 'print_area', 'kmz', 'voalle_payload']);

    function sanitizeTemplateRecord(record, extraOmit = []) {
        const omit = new Set([...TEMPLATE_OMIT, ...extraOmit]);
        const result = {};
        Object.entries(record || {}).forEach(([key, value]) => {
            if (!omit.has(key)) result[key] = value;
        });
        return result;
    }

    async function templatePayload(record) {
        const parent = sanitizeTemplateRecord(record.item, ['obra_id', 'pai_id', 'expansao_id', 'projeto_id']);
        const payload = { entityType: record.entityType, parent, children: [] };
        if (record.entityType === 'elemento_documentacao') {
            const { data, error } = await supabaseClient.from('subelementos').select('*').eq('pai_id', record.id);
            if (error) throw error;
            payload.children = (data || []).map(item => sanitizeTemplateRecord(item, ['pai_id']));
        } else if (record.entityType === 'expansao') {
            const { data, error } = await supabaseClient.from('atlas_expansoes_subitems').select('*').eq('expansao_id', record.id);
            if (error) throw error;
            payload.children = (data || []).map(item => sanitizeTemplateRecord(item, ['expansao_id']));
        } else if (record.entityType === 'pmo_projeto') {
            const { data, error } = await supabaseClient.from('atlas_pmo_subelementos').select('*').eq('projeto_id', record.id);
            if (error) throw error;
            payload.children = (data || []).map(item => sanitizeTemplateRecord(item, ['projeto_id']));
        }
        return payload;
    }

    async function openTemplates() {
        openModal({
            title: 'Modelos reutilizáveis',
            subtitle: 'Crie estruturas novas sem copiar anexos, comentários ou histórico.',
            wide: true,
            body: `<div class="atlas-v142-form-grid"><label class="atlas-v142-field"><span>Nome do modelo</span><input class="atlas-v142-input" id="atlas-v142-template-name" maxlength="90" placeholder="Ex.: Obra FTTH padrão"></label><label class="atlas-v142-field"><span>Registro de origem</span><select class="atlas-v142-select" id="atlas-v142-template-source"><option value="">Carregando registros...</option></select></label></div><div class="atlas-v142-toolbar"><button class="atlas-v142-btn primary" type="button" onclick="atlasV142CriarModelo()"><i data-lucide="copy-plus"></i>Criar modelo</button></div><div id="atlas-v142-template-list"><div class="atlas-v142-empty">Carregando modelos...</div></div>`
        });
        try {
            await loadSearchIndex(false);
            const sources = runtime.searchRecords.filter(record => TEMPLATE_TYPES.includes(record.entityType));
            const select = document.getElementById('atlas-v142-template-source');
            if (select) select.innerHTML = '<option value="">Selecione um registro</option>' + sources.map(record => `<option value="${html(record.entityType)}::${html(record.id)}">${html(ENTITY_META[record.entityType]?.label)} · ${html(record.title)}</option>`).join('');
            await loadTemplates();
        } catch (error) {
            await captureError('modelos', 'carregar_fontes', error);
        }
    }

    async function loadTemplates() {
        try {
            const { data, error } = await supabaseClient.from('atlas_templates').select('*').eq('ativo', true).order('created_at', { ascending: false });
            if (error) throw error;
            runtime.templates = data || [];
            renderTemplates();
        } catch (error) {
            await captureError('modelos', 'carregar', error);
            const target = document.getElementById('atlas-v142-template-list');
            if (target) target.innerHTML = '<div class="atlas-v142-empty">Os modelos estão aguardando o SQL da V1.4.2.</div>';
        }
    }

    function renderTemplates() {
        const target = document.getElementById('atlas-v142-template-list');
        if (!target) return;
        target.innerHTML = runtime.templates.length ? `<div class="atlas-v142-list">${runtime.templates.map(item => `<article class="atlas-v142-list-item">
            <div class="atlas-v142-list-copy"><strong>${html(item.nome)}</strong><span>${html(ENTITY_META[item.entity_type]?.label || item.modulo || 'Atlas')}</span><small>Criado em ${html(dateTime(item.created_at))}</small></div>
            <div class="atlas-v142-list-actions"><button class="atlas-v142-btn primary" type="button" onclick="atlasV142AplicarModelo('${jsAttr(item.id)}')"><i data-lucide="play"></i>Usar modelo</button>${item.created_by === userId() || isAdmin() ? `<button class="atlas-v142-btn danger" type="button" onclick="atlasV142ExcluirModelo('${jsAttr(item.id)}')"><i data-lucide="trash-2"></i>Excluir</button>` : ''}</div>
        </article>`).join('')}</div>` : '<div class="atlas-v142-empty">Nenhum modelo foi criado.</div>';
        refreshIcons(target);
    }

    async function createTemplate() {
        if (!canWrite()) {
            operation('Seu perfil possui acesso somente para consulta.', 'warning');
            return;
        }
        const name = String(document.getElementById('atlas-v142-template-name')?.value || '').trim();
        const source = String(document.getElementById('atlas-v142-template-source')?.value || '');
        const [entityType, id] = source.split('::');
        const record = findSearchRecord(entityType, id);
        if (!name || !record) {
            operation('Informe o nome e o registro de origem.', 'warning');
            return;
        }
        try {
            operation('Criando modelo...');
            const configuration = await templatePayload(record);
            const { error } = await supabaseClient.from('atlas_templates').insert([{
                id: uid('template'),
                nome: name,
                modulo: record.module || 'atlas',
                descricao: `Modelo criado a partir de ${record.title}`,
                entity_type: entityType,
                configuracao: configuration,
                ativo: true,
                created_by: userId(),
                updated_by: userId(),
                updated_at: new Date().toISOString()
            }]);
            if (error) throw error;
            document.getElementById('atlas-v142-template-name').value = '';
            await loadTemplates();
            operation('Modelo criado.', 'success');
        } catch (error) {
            await captureError('modelos', 'criar', error, { source });
            operation('Erro ao criar modelo.', 'error');
        }
    }

    async function applyTemplate(id) {
        if (!canWrite()) {
            operation('Seu perfil possui acesso somente para consulta.', 'warning');
            return;
        }
        const template = runtime.templates.find(item => item.id === id);
        if (!template) return;
        const config = template.configuracao || {};
        const defaultName = config.parent?.nome || config.parent?.cidade || template.nome;
        const newName = typeof solicitarTextoAtnx === 'function' ? await solicitarTextoAtnx({ titulo: 'Usar modelo', label: config.entityType === 'manutencao_rede' || config.entityType === 'documentacao_rede_geral' ? 'Cidade / identificação' : 'Nome do novo registro', valor: defaultName, textoConfirmar: 'Criar' }) : prompt('Nome do novo registro', defaultName);
        if (newName === null || !String(newName).trim()) return;
        try {
            operation('Criando registro pelo modelo...');
            const parent = { ...(config.parent || {}), id: uid(config.entityType || 'registro'), updated_at: new Date().toISOString() };
            if ('nome' in parent || !('cidade' in parent)) parent.nome = String(newName).trim();
            if ('cidade' in parent) parent.cidade = String(newName).trim();
            let table = '';
            let childTable = '';
            let foreignKey = '';
            if (config.entityType === 'elemento_documentacao') {
                if (!state.obraAtiva) throw new Error('Selecione uma obra em Documentação Rede Geral antes de usar este modelo.');
                table = 'elementos_principais'; childTable = 'subelementos'; foreignKey = 'pai_id'; parent.obra_id = state.obraAtiva;
            } else if (config.entityType === 'expansao') {
                table = 'atlas_expansoes'; childTable = 'atlas_expansoes_subitems'; foreignKey = 'expansao_id';
            } else if (config.entityType === 'pmo_projeto') {
                table = 'atlas_pmo_projetos'; childTable = 'atlas_pmo_subelementos'; foreignKey = 'projeto_id';
            } else if (config.entityType === 'manutencao_rede') table = 'atlas_manutencoes_rede';
            else if (config.entityType === 'documentacao_rede_geral') table = 'admin_documentacoes';
            if (!table) throw new Error('Tipo de modelo não reconhecido.');
            const { error } = await supabaseClient.from(table).insert([parent]);
            if (error) throw error;
            if (childTable && Array.isArray(config.children) && config.children.length) {
                const children = config.children.map(child => ({ ...child, id: uid('sub'), [foreignKey]: parent.id, updated_at: new Date().toISOString() }));
                const { error: childError } = await supabaseClient.from(childTable).insert(children);
                if (childError) throw childError;
            }
            if (typeof registrarAuditoria === 'function') await registrarAuditoria('modelo', config.entityType, parent.id, String(newName).trim(), 'modelo', template.nome, String(newName).trim(), 'Registro criado a partir de modelo reutilizável');
            runtime.searchLoadedAt = 0;
            await loadSearchIndex(true);
            await refreshModuleData();
            operation('Registro criado pelo modelo.', 'success');
        } catch (error) {
            await captureError('modelos', 'aplicar', error, { templateId: id });
            operation('Erro ao usar modelo: ' + (error.message || error), 'error');
        }
    }

    async function deleteTemplate(id) {
        const confirmed = typeof confirmarVisualAtnx === 'function' ? await confirmarVisualAtnx('Excluir modelo', 'Excluir este modelo reutilizável?', 'Excluir') : confirm('Excluir modelo?');
        if (!confirmed) return;
        const { error } = await supabaseClient.from('atlas_templates').delete().eq('id', id);
        if (error) {
            await captureError('modelos', 'excluir', error, { templateId: id });
            return;
        }
        await loadTemplates();
    }

    async function openErrors() {
        if (!isAdmin()) {
            operation('A Central de erros é restrita ao Admin.', 'warning');
            return;
        }
        openModal({
            title: 'Central de erros',
            subtitle: 'Falhas técnicas registradas com contexto e opção de nova tentativa.',
            wide: true,
            body: '<div class="atlas-v142-toolbar"><button class="atlas-v142-btn" type="button" onclick="atlasV142CarregarErros()"><i data-lucide="refresh-cw"></i>Atualizar</button><button class="atlas-v142-btn" type="button" onclick="atlasV142FiltrarErros(\'pending\')">Pendentes</button><button class="atlas-v142-btn" type="button" onclick="atlasV142FiltrarErros(\'resolved\')">Resolvidos</button><button class="atlas-v142-btn" type="button" onclick="atlasV142FiltrarErros(\'all\')">Todos</button></div><div id="atlas-v142-errors-list"><div class="atlas-v142-empty">Carregando erros...</div></div>'
        });
        await loadErrors();
    }

    async function loadErrors() {
        try {
            const { data, error } = await supabaseClient.from('atlas_error_logs').select('*').order('created_at', { ascending: false }).limit(250);
            if (error) throw error;
            runtime.errors = data || [];
            renderErrors('pending');
        } catch (error) {
            const target = document.getElementById('atlas-v142-errors-list');
            if (target) target.innerHTML = '<div class="atlas-v142-empty">A Central de erros está aguardando o SQL da V1.4.2.</div>';
        }
    }

    function renderErrors(filter = 'pending') {
        const target = document.getElementById('atlas-v142-errors-list');
        if (!target) return;
        const rows = runtime.errors.filter(item => filter === 'all' || item.status === filter || (filter === 'pending' && ['pending', 'retrying'].includes(item.status)));
        target.innerHTML = rows.length ? `<div class="atlas-v142-list">${rows.map(item => `<article class="atlas-v142-list-item">
            <div class="atlas-v142-list-copy"><strong>${html(item.source)} · ${html(item.operation || 'operação')}</strong><span>${html(item.message)}</span><small>${html(dateTime(item.created_at))} · ${html(item.status)} · ${Number(item.attempts || 0)} tentativa(s)</small></div>
            <div class="atlas-v142-list-actions">${item.status !== 'resolved' ? `<button class="atlas-v142-btn primary" type="button" onclick="atlasV142RepetirErro('${jsAttr(item.id)}')"><i data-lucide="rotate-cw"></i>Tentar novamente</button><button class="atlas-v142-btn" type="button" onclick="atlasV142IgnorarErro('${jsAttr(item.id)}')"><i data-lucide="eye-off"></i>Ignorar</button>` : '<span class="atlas-v142-pill success">Resolvido</span>'}</div>
        </article>`).join('')}</div>` : '<div class="atlas-v142-empty">Nenhum erro neste filtro.</div>';
        refreshIcons(target);
    }

    async function retryError(id) {
        const item = runtime.errors.find(error => error.id === id);
        if (!item) return;
        try {
            await supabaseClient.from('atlas_error_logs').update({ status: 'retrying', attempts: Number(item.attempts || 0) + 1, updated_at: new Date().toISOString() }).eq('id', id);
            await refreshModuleData();
            const { error } = await supabaseClient.from('atlas_error_logs').update({ status: 'resolved', resolved_by: userId(), resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
            if (error) throw error;
            await loadErrors();
            operation('Sincronização testada e erro marcado como resolvido.', 'success');
        } catch (error) {
            await supabaseClient.from('atlas_error_logs').update({ status: 'pending', message: `${item.message}\nNova tentativa: ${error.message || error}`, updated_at: new Date().toISOString() }).eq('id', id);
            await loadErrors();
            operation('A tentativa ainda apresentou erro.', 'error');
        }
    }

    async function ignoreError(id) {
        const { error } = await supabaseClient.from('atlas_error_logs').update({ status: 'ignored', resolved_by: userId(), resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
        if (!error) await loadErrors();
    }

    async function generateDeadlineNotifications() {
        const todayKey = new Date().toISOString().slice(0, 10);
        const storageKey = `atlas-v142-deadlines:${userId() || 'anonimo'}`;
        if (localStorage.getItem(storageKey) === todayKey || !userId()) return;
        try {
            await loadSearchIndex(false);
            const currentNames = [state.perfilAtual?.nome, state.perfilAtual?.email].map(normalize).filter(Boolean);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const limit = new Date(now);
            limit.setDate(limit.getDate() + 3);
            const notifications = [];
            runtime.searchRecords.forEach(record => {
                const responsible = normalize(record.item?.responsavel || record.item?.tecnico || record.item?.projetista);
                if (responsible && !currentNames.includes(responsible)) return;
                if (!responsible && !isAdmin()) return;
                const deadlineRaw = record.item?.data_previsao_final || record.item?.timeline_fim;
                const deadline = deadlineRaw ? new Date(`${String(deadlineRaw).slice(0, 10)}T00:00:00`) : null;
                if (!deadline || Number.isNaN(deadline.getTime()) || deadline < now || deadline > limit) return;
                const dateKey = deadline.toISOString().slice(0, 10);
                notifications.push({
                    id: uid('notification'),
                    user_id: userId(),
                    notification_type: 'deadline',
                    title: 'Prazo próximo',
                    body: `${record.title} possui prazo em ${new Intl.DateTimeFormat('pt-BR').format(deadline)}.`,
                    entity_type: record.entityType,
                    entity_id: record.id,
                    entity_name: record.title,
                    dedupe_key: `deadline:${record.entityType}:${record.id}:${dateKey}`,
                    created_by: userId()
                });
            });
            if (notifications.length) {
                const { error } = await supabaseClient.from('atlas_notifications').upsert(notifications, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
                if (error) throw error;
            }
            localStorage.setItem(storageKey, todayKey);
            await loadNotificationCount();
        } catch (_) {}
    }

    async function applyDefaultViewOnce() {
        const key = `atlas-v142-default-view:${userId() || 'anonimo'}`;
        if (!userId() || sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
        try {
            const { data, error } = await supabaseClient
                .from('atlas_saved_views')
                .select('*')
                .eq('user_id', userId())
                .eq('is_default', true)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            if (!data) return;
            runtime.savedViews = [data];
            await applyView(data.id);
        } catch (error) {
            await captureError('visualizacoes', 'aplicar_padrao', error);
        }
    }

    window.atlasV142ArquivarExclusao = archiveDeletion;
    window.atlasV142AbrirLixeira = openTrash;
    window.atlasV142CarregarLixeira = loadTrash;
    window.atlasV142RestaurarLixeira = restoreTrash;
    window.atlasV142ExcluirLixeira = permanentlyDeleteTrash;
    window.atlasV142AbrirModelos = openTemplates;
    window.atlasV142CriarModelo = createTemplate;
    window.atlasV142AplicarModelo = applyTemplate;
    window.atlasV142ExcluirModelo = deleteTemplate;
    window.atlasV142AbrirErros = openErrors;
    window.atlasV142CarregarErros = loadErrors;
    window.atlasV142FiltrarErros = renderErrors;
    window.atlasV142RepetirErro = retryError;
    window.atlasV142IgnorarErro = ignoreError;

    window.atlasV142AbrirImportacao = openImport;
    window.atlasV142MudarDestinoImportacao = changeImportTarget;
    window.atlasV142LerArquivoImportacao = readImportFile;
    window.atlasV142AtualizarPreviaImportacao = updateImportPreview;
    window.atlasV142ExecutarImportacao = executeImport;

    window.atlasV142AbrirVisualizacoes = openSavedViews;
    window.atlasV142SalvarVisualizacao = saveView;
    window.atlasV142AplicarVisualizacao = applyView;
    window.atlasV142ExcluirVisualizacao = deleteView;
    window.atlasV142AbrirAcoesMassa = openBulkActions;
    window.atlasV142MudarModuloMassa = changeBulkModule;
    window.atlasV142RenderizarItensMassa = renderBulkItems;
    window.atlasV142RenderizarValorMassa = renderBulkValue;
    window.atlasV142SelecionarItemMassa = selectBulkItem;
    window.atlasV142SelecionarTodosMassa = selectAllBulk;
    window.atlasV142AplicarAcaoMassa = applyBulkAction;

    window.atlasV142FecharModal = closeModal;
    window.atlasV142AbrirBuscaGlobal = openGlobalSearch;
    window.atlasV142FiltrarBusca = renderSearchResults;
    window.atlasV142NavegarResultado = navigateResult;
    window.atlasV142AbrirColaboracao = openCollaboration;
    window.atlasV142FecharColaboracao = closeCollaboration;
    window.atlasV142MudarAbaColaboracao = changeCollaborationTab;
    window.atlasV142EnviarComentario = sendComment;
    window.atlasV142ResolverComentario = resolveComment;
    window.atlasV142ExcluirComentario = deleteComment;
    window.atlasV142BotaoColaboracao = collaborationButton;
    window.atlasV142AbrirNotificacoes = openNotifications;
    window.atlasV142MarcarNotificacao = markNotification;
    window.atlasV142AbrirNotificacao = openNotification;
    window.atlasV142MarcarTodasNotificacoes = markAllNotifications;
    window.atlasV142AbrirCentral = openHub;

    window.atlasV142Runtime = runtime;
    window.atlasV142CaptureError = captureError;
    window.atlasV142RefreshIcons = refreshIcons;

    function boot() {
        refreshIcons(document);
        let attempts = 0;
        const waitAuth = setInterval(() => {
            attempts += 1;
            if (typeof atlasUsuarioAtivo === 'function' && atlasUsuarioAtivo()) {
                clearInterval(waitAuth);
                loadNotificationCount();
                loadSearchIndex(false).then(generateDeadlineNotifications).catch(() => {});
                setTimeout(applyDefaultViewOnce, 600);
                setInterval(loadNotificationCount, 60000);
            } else if (attempts > 60) {
                clearInterval(waitAuth);
            }
        }, 1000);
    }

    window.addEventListener('error', event => {
        if (!event.error && !event.message) return;
        captureError('window', 'javascript_error', event.error || new Error(event.message), { file: event.filename, line: event.lineno, column: event.colno });
    });

    window.addEventListener('unhandledrejection', event => {
        captureError('window', 'promise_rejection', event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
