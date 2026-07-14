const SUPABASE_URL = window.ATNX_CONFIG.SUPABASE_URL;
        const SUPABASE_KEY = window.ATNX_CONFIG.SUPABASE_KEY;
        // Cole aqui a URL do Google Apps Script publicado como Web App.
        // As imagens serão enviadas para esse endpoint, salvas no Google Drive
        // e somente os metadados/link serão registrados no Supabase.
        const GOOGLE_DRIVE_DOCUMENTACAO_UPLOAD_URL = window.ATNX_CONFIG.GOOGLE_DRIVE_DOCUMENTACAO_UPLOAD_URL || window.ATNX_CONFIG.GOOGLE_DRIVE_UPLOAD_URL || '';
        const GOOGLE_DRIVE_EXPANSOES_UPLOAD_URL = window.ATNX_CONFIG.GOOGLE_DRIVE_EXPANSOES_UPLOAD_URL || window.ATNX_CONFIG.GOOGLE_DRIVE_UPLOAD_URL || '';
        const GOOGLE_DRIVE_UPLOAD_URL = window.ATNX_CONFIG.GOOGLE_DRIVE_UPLOAD_URL || GOOGLE_DRIVE_DOCUMENTACAO_UPLOAD_URL || GOOGLE_DRIVE_EXPANSOES_UPLOAD_URL || '';
        // Proxy interno do Cloudflare. Evita bloqueios de navegador contra script.google.com.
        const GOOGLE_DRIVE_PROXY_URL = window.ATNX_CONFIG.GOOGLE_DRIVE_PROXY_URL || ''; // V1.3.3.7: direto por JSONP; proxy só se configurado
        const GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_URL = window.ATNX_CONFIG.GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_URL || window.ATNX_CONFIG.GOOGLE_DRIVE_FOLDER_URL || '';
        const GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID = window.ATNX_CONFIG.GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID || window.ATNX_CONFIG.GOOGLE_DRIVE_FOLDER_ID || '';
        const GOOGLE_DRIVE_EXPANSOES_FOLDER_URL = window.ATNX_CONFIG.GOOGLE_DRIVE_EXPANSOES_FOLDER_URL || '';
        const GOOGLE_DRIVE_EXPANSOES_FOLDER_ID = window.ATNX_CONFIG.GOOGLE_DRIVE_EXPANSOES_FOLDER_ID || '';
        const LIMITE_UPLOAD_MB = window.ATNX_CONFIG.LIMITE_UPLOAD_MB;
        const ATNX_EXPANSOES_URLS_OBSOLETAS = new Set();
        let atlasOperacaoTimer = null;

        function atlasEscaparHtmlOperacao(valor) {
            return String(valor ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        function atlasClassificarOperacao(mensagem, classe = '') {
            const texto = String(mensagem || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const estilo = String(classe || '').toLowerCase();
            if (estilo.includes('red') || /(erro|falha|nao foi possivel)/.test(texto)) return { tipo: 'erro', titulo: 'Não foi possível concluir', final: true };
            if (estilo.includes('emerald') || /(concluid|salvo|atualizado|cadastrad|copiad|removid|excluid|carregado|sincronizado)/.test(texto)) return { tipo: 'sucesso', titulo: 'Operação concluída', final: true };
            if (estilo.includes('amber') || /(aviso|atencao|cancelad|indisponivel)/.test(texto)) return { tipo: 'aviso', titulo: 'Atenção', final: true };
            if (/(baix|download|export)/.test(texto)) return { tipo: 'baixando', titulo: 'Baixando arquivo', final: false };
            if (/(exclu|remov|apag|lixeira)/.test(texto)) return { tipo: 'excluindo', titulo: 'Excluindo', final: false };
            if (/(envi|upload|anex|otimiz)/.test(texto)) return { tipo: 'enviando', titulo: 'Enviando arquivos', final: false };
            if (/(salv|cadastr|criando|duplic)/.test(texto)) return { tipo: 'salvando', titulo: 'Salvando alterações', final: false };
            if (/(sincron|nuvem|drive|import)/.test(texto)) return { tipo: 'sincronizando', titulo: 'Sincronizando', final: false };
            return { tipo: 'carregando', titulo: 'Carregando', final: false };
        }

        function atlasExibirOperacao(mensagem, classe = 'bg-[#0073ea]') {
            const root = document.getElementById('atlas-operation-root');
            if (!root || !mensagem) return;
            const operacao = atlasClassificarOperacao(mensagem, classe);
            clearTimeout(atlasOperacaoTimer);
            root.className = `atlas-operation-root is-visible atlas-operation-${operacao.tipo}`;
            root.setAttribute('aria-hidden', 'false');
            root.innerHTML = `<div class="atlas-operation-panel" role="status">
                <span class="atlas-operation-icon" aria-hidden="true"></span>
                <span class="atlas-operation-copy"><strong>${atlasEscaparHtmlOperacao(operacao.titulo)}</strong><small>${atlasEscaparHtmlOperacao(mensagem)}</small></span>
                ${operacao.final ? '' : '<span class="atlas-operation-progress" aria-hidden="true"></span>'}
            </div>`;
            if (operacao.final) atlasOperacaoTimer = setTimeout(atlasOcultarOperacao, operacao.tipo === 'aviso' ? 4500 : 3000);
        }

        function atlasOcultarOperacao() {
            const root = document.getElementById('atlas-operation-root');
            if (!root) return;
            root.classList.remove('is-visible');
            root.setAttribute('aria-hidden', 'true');
        }

        let supabaseClient;
        
        try {
            const lib = window.supabase || window.Supabase;
            supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_KEY);
        } catch(e) {
            document.getElementById('status-banco-alerta').className = "bg-red-600 text-white text-center py-2 font-semibold text-xs z-50";
            document.getElementById('status-banco-alerta').innerText = "❌ Falha crítica ao carregar as dependências.";
        }

        let state = { sidebarAberta: true, moduloAtivo: 'admin_obras', obraAtiva: '', abaAtiva: 'CTO', termoPesquisa: '', linhasExpandidas: {}, obras: [], elementos: [], selecionados: { elementos: {}, subelementos: {} }, cacheElementosPorObra: {}, carregandoObra: false, adminObras: [], adminCarregando: false, adminErro: '', adminSecoesAbertas: { a_realizar: true, em_andamento: true, parada: true, concluida: true }, adminDetalhesAbertos: {}, adminVisualizacao: 'status', adminGanttFullscreen: false, adminGanttZoom: 1, adminGanttFiltro: '', adminGanttEscala: 'meses', adminGanttModoApresentacao: false, executivoCarregando: false, executivoErro: '', historicoSemanal: [], expansoes: [], expansoesSubitems: [], expansoesCarregando: false, expansoesErro: '', expansoesAbertas: { em_progresso: true, grande_porte: true, pequeno_porte: true, concluidos: true }, expansoesProjetosAbertos: {}, expansoesProjetosSelecionados: {}, expansoesVisualizacao: 'tabela', expansoesObraAtiva: '', expansoesObraNovaAberta: false, expansoesObrasFasesAbertas: {}, expansoesObrasSelecionados: { elementos: {}, subitems: {} }, expansoesGanttZoom: 1, expansoesGanttEscala: 'meses', expansoesGanttFiltro: '', expansoesGanttStatus: [], expansoesGanttGrupo: [], expansoesGanttFullscreen: false, expansaoFormularioAberto: false, expansaoFormularioEditandoId: null, expansaoLinhaNovaGrupo: null, expansaoSubitemNovoProjetoId: null, pmoVisualizacao: 'analise_novos_projetos', pmoProjetos: [], pmoSubelementos: [], pmoUpdates: [], pmoCarregando: false, pmoErro: '', pmoProjetoAberto: '', pmoFormularioAberto: false, pmoEditandoId: null, pmoSubitemNovoProjetoId: null, pmoUpdateNovoProjetoId: null, pmoUltimaEdicaoLocal: 0, pmoEstruturaAbertas: { projetos: true, subelementos: true, updates: true }, manutencoesRede: [], manutencaoRedeCarregando: false, manutencaoRedeErro: '', manutencaoRedeFiltros: { regional: '', cidade: '', documentacao: '', status: '', prioridade: '', responsavel: '', tipo: '', inicio: '' }, auditoria: [], auditoriaCarregando: false, auditoriaErro: '', auditoriaAberta: false, auditoriaTermo: '', authCarregando: true, authSession: null, usuarioAtual: null, perfilAtual: null, usuariosAtlas: [], usuariosCarregando: false, usuariosErro: '', adminCentralAba: 'usuarios', camposPersonalizados: [], camposCarregando: false, camposErro: '', tema: localStorage.getItem('atnx-tema') || 'light' };
        window.state = state;

        const ATNX_COR_OFICIAL = '#0073ea';

        const ATLAS_SCROLL_SELECTORS = [
            '#main-scroll-container',
            '#sidebar-obras',
            '#painel-documentacao',
            '#painel-admin-obras',
            '#painel-expansoes',
            '#painel-pmo',
            '#painel-manutencao-redes',
            '.atnx-gantt-scroll',
            '.atlas-exp-gantt-scroll',
            '.atlas-exp-table-wrap',
            '.atlas-exp-sub-table-wrap',
            '.atlas-exp-obra-table-wrap',
            '.atlas-exp-obras-shell',
            '.atlas-module-table-wrap',
            '.atlas-pmo-table-wrap'
        ];
        let atlasContextoUltimaRenderizacao = '';

        function obterContextoVisualAtlas() {
            return [
                state.moduloAtivo || '',
                state.adminVisualizacao || '',
                state.expansoesVisualizacao || '',
                state.pmoVisualizacao || '',
                state.manutencaoRedeFiltros?.status || '',
                state.obraAtiva || '',
                state.abaAtiva || '',
                state.expansoesObraAtiva || ''
            ].join('|');
        }

        function capturarEstadoVisualAtlas() {
            const estado = { seletores: {}, foco: null };
            ATLAS_SCROLL_SELECTORS.forEach(selector => {
                estado.seletores[selector] = Array.from(document.querySelectorAll(selector)).map(el => ({
                    top: Number(el.scrollTop || 0),
                    left: Number(el.scrollLeft || 0)
                }));
            });
            const ativo = document.activeElement;
            if (ativo && ativo.id) estado.foco = { id: ativo.id, start: ativo.selectionStart ?? null, end: ativo.selectionEnd ?? null };
            return estado;
        }

        function restaurarEstadoVisualAtlas(estado) {
            if (!estado || !estado.seletores) return;
            const aplicar = () => {
                Object.entries(estado.seletores).forEach(([selector, posicoes]) => {
                    Array.from(document.querySelectorAll(selector)).forEach((el, idx) => {
                        const pos = posicoes[idx];
                        if (!pos) return;
                        el.scrollTop = pos.top || 0;
                        el.scrollLeft = pos.left || 0;
                    });
                });
                if (estado.foco?.id) {
                    const el = document.getElementById(estado.foco.id);
                    if (el && typeof el.focus === 'function') {
                        el.focus({ preventScroll: true });
                        if (estado.foco.start !== null && typeof el.setSelectionRange === 'function') {
                            try { el.setSelectionRange(estado.foco.start, estado.foco.end ?? estado.foco.start); } catch (_) {}
                        }
                    }
                }
            };
            requestAnimationFrame(() => {
                aplicar();
                setTimeout(aplicar, 0);
            });
        }

        function iniciarRenderPreservandoEstadoVisual() {
            const contexto = obterContextoVisualAtlas();
            const devePreservar = contexto && contexto === atlasContextoUltimaRenderizacao;
            return { contexto, estado: devePreservar ? capturarEstadoVisualAtlas() : null };
        }

        function finalizarRenderPreservandoEstadoVisual(snapshot) {
            atlasContextoUltimaRenderizacao = snapshot?.contexto || obterContextoVisualAtlas();
            if (snapshot?.estado) restaurarEstadoVisualAtlas(snapshot.estado);
            setTimeout(aplicarPermissoesInterativasAtlas, 0);
        }

        function aplicarTemaAtnx() {
            const tema = state.tema === 'light' ? 'light' : 'dark';
            document.body.classList.toggle('atnx-theme-light', tema === 'light');
            document.body.classList.toggle('atnx-theme-dark', tema !== 'light');
            const btn = document.getElementById('btn-theme-atnx');
            if (btn) {
                btn.innerHTML = tema === 'light' ? 'Claro' : 'Escuro';
                btn.title = tema === 'light' ? 'Alternar para modo escuro' : 'Alternar para modo claro';
            }
        }

        function alternarTemaAtnx() {
            state.tema = state.tema === 'light' ? 'dark' : 'light';
            localStorage.setItem('atnx-tema', state.tema);
            aplicarTemaAtnx();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', aplicarTemaAtnx);
        } else {
            aplicarTemaAtnx();
        }

        const ATLAS_ROLES = {
            admin: { label: 'Admin', permissoes: ['gerenciar_usuarios', 'configurar_sistema', 'criar_registro', 'editar_registro', 'excluir_registro', 'anexar_arquivo', 'ver_dashboard', 'ver_auditoria'] },
            supervisor: { label: 'Supervisor', permissoes: ['criar_registro', 'editar_registro', 'excluir_registro', 'anexar_arquivo', 'ver_dashboard', 'ver_auditoria'] },
            operador: { label: 'Operador', permissoes: ['criar_registro', 'editar_registro', 'anexar_arquivo', 'ver_dashboard'] },
            visualizador: { label: 'Visualizador', permissoes: ['ver_dashboard'] }
        };
        const ATLAS_STATUS_USUARIO = ['ativo', 'pendente', 'bloqueado'];
        let atlasBancoInicializado = false;
        let atlasAuthListenerRegistrado = false;

        function obterRoleAtualAtlas() {
            return String(state.perfilAtual?.role || 'visualizador').toLowerCase();
        }

        function obterLabelRoleAtlas(role) {
            return ATLAS_ROLES[String(role || '').toLowerCase()]?.label || 'Visualizador';
        }

        function atlasUsuarioAtivo() {
            return !!state.usuarioAtual && state.perfilAtual?.status === 'ativo';
        }

        function atlasTemPermissao(permissao) {
            if (!atlasUsuarioAtivo()) return false;
            const role = obterRoleAtualAtlas();
            return role === 'admin' || (ATLAS_ROLES[role]?.permissoes || []).includes(permissao);
        }

        async function exigirPermissaoAtlas(permissao, acao = 'executar esta ação') {
            if (atlasTemPermissao(permissao)) return true;
            await alertaVisualAtnx('Acesso restrito', `Seu perfil não tem permissão para ${acao}.`);
            return false;
        }

        function aplicarPermissoesInterativasAtlas() {
            if (!atlasUsuarioAtivo()) return;
            const areas = ['#main-scroll-container', '#header-conteudo'];
            const aplicar = (selector, modo = 'hide') => {
                areas.forEach(area => {
                    document.querySelectorAll(`${area} ${selector}`).forEach(el => {
                        if (el.closest('.atlas-admin-tabs')) return;
                        if (modo === 'disable') {
                            el.disabled = true;
                            el.classList.add('atlas-permission-disabled');
                        } else {
                            el.classList.add('hidden');
                        }
                    });
                });
            };
            if (!atlasTemPermissao('criar_registro')) {
                aplicar('[onclick*="criar"], [onclick*="abrirCadastro"], [onclick*="alternarFormulario"], [onclick*="Nova"]');
            }
            if (!atlasTemPermissao('editar_registro')) {
                aplicar('[onclick*="alterar"], [onclick*="editar"], [onclick*="salvar"], [onclick*="duplicar"], [onclick*="alternarEncerramento"]');
                aplicar('select[onchange*="alterar"], select[onchange*="atualizarManutencaoRedeCampo"], select[onchange*="atualizarCampo"], input[onchange*="alterar"], input[onchange*="atualizarManutencaoRedeCampo"], input[onchange*="salvar"]', 'disable');
            }
            if (!atlasTemPermissao('excluir_registro')) {
                aplicar('[onclick*="excluir"], [onclick*="remover"]');
            }
            if (!atlasTemPermissao('anexar_arquivo')) {
                aplicar('[onclick*="Upload"], [onclick*="upload"], [onclick*="anexar"], [onclick*="Anexar"]');
            }
        }

        function usuarioAuditoriaAtlas() {
            const user = state.usuarioAtual || {};
            const perfil = state.perfilAtual || {};
            return {
                user_id: user.id || null,
                usuario: perfil.nome || user.email || 'Atlas Web',
                usuario_email: perfil.email || user.email || '',
                usuario_nome: perfil.nome || '',
                usuario_role: perfil.role || ''
            };
        }

        function atualizarIdentidadeUsuarioAtlas() {
            const chip = document.getElementById('atlas-user-chip');
            const logout = document.getElementById('btn-logout-atlas');
            const perfil = state.perfilAtual;
            if (!chip || !logout) return;
            if (!state.usuarioAtual || !perfil) {
                chip.classList.add('hidden');
                logout.classList.add('hidden');
                return;
            }
            chip.textContent = `${perfil.nome || perfil.email || state.usuarioAtual.email} · ${obterLabelRoleAtlas(perfil.role)}`;
            chip.classList.remove('hidden');
            logout.classList.remove('hidden');
        }

        function renderAuthScreenAtlas(modo = 'login', mensagem = '') {
            const root = document.getElementById('atlas-auth-root');
            if (!root) return;
            if (modo === 'desbloqueado') {
                root.innerHTML = '';
                root.classList.add('hidden');
                document.body?.classList.remove('atlas-auth-locked');
                return;
            }
            root.classList.remove('hidden');
            document.body?.classList.add('atlas-auth-locked');
            if (modo === 'loading') {
                root.innerHTML = `<div class="atlas-auth-card atlas-auth-loading-card" role="status">
                    <span class="atlas-auth-loader" aria-hidden="true"></span>
                    <div><div class="atlas-auth-brand">Atlas</div><h1>Carregando acesso...</h1><p>Validando sessão, perfil e permissões.</p></div>
                </div>`;
                return;
            }
            if (modo === 'pendente') {
                const perfil = state.perfilAtual || {};
                root.innerHTML = `<div class="atlas-auth-card">
                    <div class="atlas-auth-brand">Atlas</div>
                    <h1>Acesso aguardando liberação</h1>
                    <p>Seu usuário ${escaparHtml(perfil.email || state.usuarioAtual?.email || '')} existe, mas ainda não está ativo para usar o Atlas.</p>
                    <div class="atlas-auth-alert">Peça para um Admin liberar seu perfil na tela Administração &gt; Usuários.</div>
                    <button type="button" class="atlas-auth-secondary" onclick="sairAtlas()">Sair</button>
                </div>`;
                return;
            }
            if (modo === 'erro') {
                root.innerHTML = `<div class="atlas-auth-card">
                    <div class="atlas-auth-brand">Atlas</div>
                    <h1>Login aguardando SQL</h1>
                    <p>${escaparHtml(mensagem || 'Execute o SQL da V1.4 no Supabase para ativar perfis e permissões.')}</p>
                    <button type="button" class="atlas-auth-secondary" onclick="sairAtlas()">Voltar</button>
                </div>`;
                return;
            }
            const cadastro = modo === 'cadastro';
            root.innerHTML = `<div class="atlas-auth-shell">
                <section class="atlas-auth-card atlas-auth-card-main">
                    <div class="atlas-auth-brand">Atlas</div>
                    <h1>${cadastro ? 'Criar acesso' : 'Entrar no Atlas'}</h1>
                    <p>${cadastro ? 'Seu acesso será criado como Visualizador pendente. Um Admin precisa liberar sua entrada.' : 'A V1.4.1 protege os dados com usuário autenticado e acesso liberado.'}</p>
                    ${mensagem ? `<div class="atlas-auth-alert">${escaparHtml(mensagem)}</div>` : ''}
                    <form class="atlas-auth-form" onsubmit="${cadastro ? 'criarAcessoAtlas(event)' : 'entrarAtlas(event)'}">
                        ${cadastro ? '<label><span>Nome</span><input name="nome" autocomplete="name" placeholder="Seu nome"></label>' : ''}
                        <label><span>E-mail</span><input name="email" type="email" autocomplete="email" required placeholder="nome@empresa.com"></label>
                        <label><span>Senha</span><input name="senha" type="password" autocomplete="${cadastro ? 'new-password' : 'current-password'}" required minlength="6" placeholder="Mínimo 6 caracteres"></label>
                        <button type="submit">${cadastro ? 'Criar acesso' : 'Entrar'}</button>
                    </form>
                    <button type="button" class="atlas-auth-secondary" onclick="renderAuthScreenAtlas('${cadastro ? 'login' : 'cadastro'}')">${cadastro ? 'Já tenho acesso' : 'Criar acesso / solicitar liberação'}</button>
                </section>
                <aside class="atlas-auth-side">
                    <div class="atlas-auth-release-head">
                        <span class="atlas-auth-release-kicker">Lançamento oficial</span>
                        <b>Atlas V1.4.1 Oficial</b>
                        <p>Controle operacional com status mais flexíveis e experiência adaptada a computadores, tablets e celulares.</p>
                    </div>
                    <div class="atlas-auth-feature-grid">
                        <div class="atlas-auth-feature"><i>1</i><span><strong>Login e liberação</strong><small>Novos usuários aguardam aprovação do Admin.</small></span></div>
                        <div class="atlas-auth-feature"><i>2</i><span><strong>Perfis e permissões</strong><small>Admin, Supervisor, Operador e Visualizador.</small></span></div>
                        <div class="atlas-auth-feature"><i>3</i><span><strong>Administração</strong><small>Ative, edite ou exclua usuários com proteção.</small></span></div>
                        <div class="atlas-auth-feature"><i>4</i><span><strong>Auditoria real</strong><small>Ações vinculadas ao usuário autenticado.</small></span></div>
                        <div class="atlas-auth-feature"><i>5</i><span><strong>Campos configuráveis</strong><small>Estrutura flexível para módulos e registros.</small></span></div>
                        <div class="atlas-auth-feature"><i>6</i><span><strong>Manutenção de Redes</strong><small>Regionais, chamados, documentação e anexos.</small></span></div>
                        <div class="atlas-auth-feature"><i>7</i><span><strong>Status opcional</strong><small>CTO, CEO ou POP podem ficar sem status quando não se aplicarem.</small></span></div>
                        <div class="atlas-auth-feature"><i>8</i><span><strong>Layout responsivo</strong><small>Navegação adaptada para computadores, tablets e celulares.</small></span></div>
                    </div>
                    <div class="atlas-auth-release-foot">Modo claro e escuro · Supabase em tempo real · Google Drive integrado</div>
                </aside>
            </div>`;
        }

        async function carregarPerfilAtualAtlas() {
            if (!supabaseClient || !state.usuarioAtual) return null;
            try {
                if (typeof supabaseClient.rpc === 'function') {
                    await supabaseClient.rpc('atlas_sync_current_profile');
                }
            } catch (_) {}
            const { data, error } = await supabaseClient
                .from('atlas_profiles')
                .select('*')
                .eq('id', state.usuarioAtual.id)
                .maybeSingle();
            if (error) throw error;
            state.perfilAtual = data || null;
            atualizarIdentidadeUsuarioAtlas();
            return data || null;
        }

        async function aplicarSessaoAtlas(session, opcoes = {}) {
            state.authSession = session || null;
            state.usuarioAtual = session?.user || null;
            state.perfilAtual = null;
            atualizarIdentidadeUsuarioAtlas();
            if (!state.usuarioAtual) {
                atlasBancoInicializado = false;
                renderAuthScreenAtlas('login', opcoes.mensagem || '');
                return;
            }
            renderAuthScreenAtlas('loading');
            try {
                const perfil = await carregarPerfilAtualAtlas();
                if (!perfil) {
                    renderAuthScreenAtlas('erro', 'Perfil não encontrado. Execute o SQL supabase/ATLAS_V1_4_SCHEMA_OFICIAL.sql e entre novamente.');
                    return;
                }
                if (perfil.status !== 'ativo') {
                    renderAuthScreenAtlas('pendente');
                    return;
                }
                renderAuthScreenAtlas('desbloqueado');
                atualizarIdentidadeUsuarioAtlas();
                if (!atlasBancoInicializado) {
                    atlasBancoInicializado = true;
                    await inicializarBanco();
                } else {
                    renderApp();
                }
                setTimeout(() => window.atlasV14IniciarRealtime?.(), 500);
                await registrarAuditoria('login', 'auth', state.usuarioAtual.id, perfil.email || state.usuarioAtual.email, 'sessao', '', 'ativa', 'Usuário autenticado no Atlas V1.4');
            } catch (err) {
                console.error('Erro ao aplicar sessão:', err);
                renderAuthScreenAtlas('erro', err.message || String(err));
            }
        }

        async function inicializarAtlasV14Auth() {
            aplicarTemaAtnx();
            if (!supabaseClient || !supabaseClient.auth) {
                renderAuthScreenAtlas('erro', 'Supabase Auth indisponível. Confira as dependências do Supabase.');
                return;
            }
            renderAuthScreenAtlas('loading');
            if (!atlasAuthListenerRegistrado) {
                atlasAuthListenerRegistrado = true;
                supabaseClient.auth.onAuthStateChange((_event, session) => {
                    if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') aplicarSessaoAtlas(session);
                    if (_event === 'SIGNED_OUT') aplicarSessaoAtlas(null);
                });
            }
            const { data, error } = await supabaseClient.auth.getSession();
            if (error) {
                renderAuthScreenAtlas('login', error.message || String(error));
                return;
            }
            await aplicarSessaoAtlas(data?.session || null);
        }

        async function entrarAtlas(event) {
            event?.preventDefault();
            if (!supabaseClient?.auth) return;
            const form = event.target;
            const email = String(form.email?.value || '').trim();
            const senha = String(form.senha?.value || '');
            renderAuthScreenAtlas('loading');
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
            if (error) {
                renderAuthScreenAtlas('login', error.message || 'Falha ao entrar.');
                return;
            }
            await aplicarSessaoAtlas(data?.session || null);
        }

        async function criarAcessoAtlas(event) {
            event?.preventDefault();
            if (!supabaseClient?.auth) return;
            const form = event.target;
            const nome = String(form.nome?.value || '').trim();
            const email = String(form.email?.value || '').trim();
            const senha = String(form.senha?.value || '');
            renderAuthScreenAtlas('loading');
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password: senha,
                options: { data: { nome } }
            });
            if (error) {
                renderAuthScreenAtlas('cadastro', error.message || 'Falha ao criar acesso.');
                return;
            }
            if (data?.session) {
                await aplicarSessaoAtlas(data.session);
                return;
            }
            renderAuthScreenAtlas('login', 'Acesso criado. Se a confirmação por e-mail estiver ativa no Supabase, confirme o e-mail antes de entrar.');
        }

        async function sairAtlas() {
            try {
                await supabaseClient?.auth?.signOut();
            } finally {
                state.authSession = null;
                state.usuarioAtual = null;
                state.perfilAtual = null;
                state.usuariosAtlas = [];
                state.camposPersonalizados = [];
                atlasBancoInicializado = false;
                atualizarIdentidadeUsuarioAtlas();
                renderAuthScreenAtlas('login');
            }
        }

        async function carregarAdminCentral() {
            if (!atlasTemPermissao('gerenciar_usuarios') && !atlasTemPermissao('configurar_sistema')) {
                renderAdminCentral();
                return;
            }
            state.usuariosCarregando = true;
            state.camposCarregando = true;
            state.usuariosErro = '';
            state.camposErro = '';
            renderAdminCentral();
            atlasExibirOperacao('Carregando Administração...', 'bg-[#0073ea]');
            try {
                const [usuariosRes, camposRes] = await Promise.all([
                    supabaseClient.from('atlas_profiles').select('*').order('created_at', { ascending: true }),
                    supabaseClient.from('atlas_custom_fields').select('*').order('modulo', { ascending: true }).order('ordem', { ascending: true })
                ]);
                if (usuariosRes.error) throw usuariosRes.error;
                if (camposRes.error) throw camposRes.error;
                state.usuariosAtlas = usuariosRes.data || [];
                state.camposPersonalizados = camposRes.data || [];
                atlasExibirOperacao('Administração carregada.', 'bg-emerald-600');
            } catch (err) {
                const msg = err.message || String(err);
                state.usuariosErro = msg;
                state.camposErro = msg;
                atlasExibirOperacao('Erro ao carregar Administração: ' + msg, 'bg-red-600');
            } finally {
                state.usuariosCarregando = false;
                state.camposCarregando = false;
                renderAdminCentral();
            }
        }

        function alternarAbaAdminCentral(aba) {
            state.adminCentralAba = ['usuarios', 'permissoes', 'campos'].includes(aba) ? aba : 'usuarios';
            renderAdminCentral();
        }

        async function atualizarUsuarioAtlas(id, campo, valor) {
            if (!await exigirPermissaoAtlas('gerenciar_usuarios', 'gerenciar usuários')) return;
            if (!['role', 'status', 'nome'].includes(campo)) return;
            const item = (state.usuariosAtlas || []).find(u => u.id === id);
            const anterior = item?.[campo] || '';
            const patch = { [campo]: valor, updated_at: new Date().toISOString() };
            try {
                const { error } = await supabaseClient.from('atlas_profiles').update(patch).eq('id', id);
                if (error) throw error;
                await registrarAuditoria('permissão', 'usuario', id, item?.email || id, campo, anterior, valor, 'Perfil de usuário atualizado na Central de Administração');
                await carregarAdminCentral();
                if (id === state.usuarioAtual?.id) await carregarPerfilAtualAtlas();
            } catch (err) {
                await alertaVisualAtnx('Erro ao atualizar usuário', err.message || String(err));
            }
        }

        async function editarNomeUsuarioAtlas(id) {
            if (!await exigirPermissaoAtlas('gerenciar_usuarios', 'renomear usuários')) return;
            const item = (state.usuariosAtlas || []).find(u => u.id === id);
            if (!item) return;
            const nome = await solicitarTextoAtnx({
                titulo: 'Nome do usuário',
                label: 'Nome',
                valor: item.nome || '',
                placeholder: 'Nome da pessoa',
                textoConfirmar: 'Salvar'
            });
            if (nome === null) return;
            await atualizarUsuarioAtlas(id, 'nome', nome.trim());
        }

        async function excluirUsuarioAtlas(id) {
            if (!await exigirPermissaoAtlas('gerenciar_usuarios', 'excluir usuários')) return;
            const item = (state.usuariosAtlas || []).find(u => u.id === id);
            if (!item) return;
            if (id === state.usuarioAtual?.id) {
                await alertaVisualAtnx('Exclusão bloqueada', 'Você não pode excluir a própria conta enquanto está conectado.');
                return;
            }
            const adminsAtivos = (state.usuariosAtlas || []).filter(u => u.role === 'admin' && u.status === 'ativo').length;
            if (item.role === 'admin' && item.status === 'ativo' && adminsAtivos <= 1) {
                await alertaVisualAtnx('Exclusão bloqueada', 'O último administrador ativo não pode ser excluído. Ative outro Admin primeiro.');
                return;
            }
            const identificacao = item.nome || item.email || id;
            const confirmado = await confirmarVisualAtnx(
                'Excluir usuário',
                `Excluir permanentemente "${identificacao}"? A conta será removida do Atlas e do Supabase Auth. Os registros operacionais criados por essa pessoa serão preservados.`,
                'Excluir'
            );
            if (!confirmado) return;
            try {
                exibirStatusTemporario('Excluindo usuário...', 'bg-[#0073ea]');
                const { error } = await supabaseClient.rpc('atlas_delete_user', { p_user_id: id });
                if (error) throw error;
                await registrarAuditoria('exclusão', 'usuario', id, identificacao, 'conta', item.email || '', '', 'Usuário removido do Atlas e do Supabase Auth');
                await carregarAdminCentral();
                exibirStatusTemporario('Usuário excluído.', 'bg-emerald-600');
            } catch (err) {
                exibirStatusTemporario('Erro ao excluir usuário: ' + (err.message || String(err)), 'bg-red-600');
                await alertaVisualAtnx('Erro ao excluir usuário', err.message || String(err));
            }
        }

        async function criarCampoPersonalizadoAtlas(event) {
            event?.preventDefault();
            if (!await exigirPermissaoAtlas('configurar_sistema', 'configurar campos personalizados')) return;
            const form = event.target;
            const modulo = String(form.modulo?.value || '').trim();
            const nome = String(form.nome?.value || '').trim();
            const tipo = String(form.tipo?.value || 'texto').trim();
            const opcoes = String(form.opcoes?.value || '').split(',').map(v => v.trim()).filter(Boolean);
            if (!modulo || !nome) return;
            const payload = {
                id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                modulo,
                nome,
                chave: nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
                tipo,
                opcoes,
                obrigatorio: !!form.obrigatorio?.checked,
                ativo: true,
                ordem: Number(form.ordem?.value || 0),
                created_by: state.usuarioAtual?.id || null,
                updated_at: new Date().toISOString()
            };
            try {
                const { error } = await supabaseClient.from('atlas_custom_fields').insert([payload]);
                if (error) throw error;
                await registrarAuditoria('configuração', 'campo_personalizado', payload.id, payload.nome, 'campo', '', `${payload.modulo}/${payload.tipo}`, 'Campo personalizado criado na Central de Administração');
                form.reset();
                await carregarAdminCentral();
            } catch (err) {
                await alertaVisualAtnx('Erro ao criar campo', err.message || String(err));
            }
        }

        async function alternarCampoPersonalizadoAtlas(id, ativo) {
            if (!await exigirPermissaoAtlas('configurar_sistema', 'ativar ou desativar campos')) return;
            const item = (state.camposPersonalizados || []).find(c => c.id === id);
            try {
                const { error } = await supabaseClient.from('atlas_custom_fields').update({ ativo: !!ativo, updated_at: new Date().toISOString() }).eq('id', id);
                if (error) throw error;
                await registrarAuditoria('configuração', 'campo_personalizado', id, item?.nome || id, 'ativo', item?.ativo, !!ativo, 'Campo personalizado ativado/desativado');
                await carregarAdminCentral();
            } catch (err) {
                await alertaVisualAtnx('Erro ao atualizar campo', err.message || String(err));
            }
        }

        async function removerCampoPersonalizadoAtlas(id) {
            if (!await exigirPermissaoAtlas('configurar_sistema', 'remover campos personalizados')) return;
            const item = (state.camposPersonalizados || []).find(c => c.id === id);
            const ok = await confirmarVisualAtnx('Remover campo', `Remover o campo "${item?.nome || id}" da Central? Os valores já salvos em registros não serão apagados automaticamente.`, 'Remover');
            if (!ok) return;
            try {
                const { error } = await supabaseClient.from('atlas_custom_fields').delete().eq('id', id);
                if (error) throw error;
                await registrarAuditoria('configuração', 'campo_personalizado', id, item?.nome || id, 'campo', item?.nome || '', '', 'Campo personalizado removido da Central de Administração');
                await carregarAdminCentral();
            } catch (err) {
                await alertaVisualAtnx('Erro ao remover campo', err.message || String(err));
            }
        }

        function renderAdminCentral() {
            atualizarVisibilidadeModulos();
            const painel = document.getElementById('painel-admin-central');
            const titulo = document.getElementById('txt-nome-obra');
            if (!painel || !titulo) return;
            titulo.innerText = 'Administração do Atlas';
            document.getElementById('txt-grupo-ativo').innerHTML = '';
            const podeUsuarios = atlasTemPermissao('gerenciar_usuarios');
            const podeConfig = atlasTemPermissao('configurar_sistema');
            const aba = state.adminCentralAba || 'usuarios';
            const tabs = `<div class="atlas-admin-tabs">
                <button class="${aba === 'usuarios' ? 'active' : ''}" onclick="alternarAbaAdminCentral('usuarios')">Usuários</button>
                <button class="${aba === 'permissoes' ? 'active' : ''}" onclick="alternarAbaAdminCentral('permissoes')">Permissões</button>
                <button class="${aba === 'campos' ? 'active' : ''}" onclick="alternarAbaAdminCentral('campos')">Campos</button>
            </div>`;
            let conteudo = '';
            if (!podeUsuarios && !podeConfig) {
                conteudo = `<div class="atlas-admin-empty"><h3>Acesso restrito</h3><p>Somente Admin pode abrir a Central de Administração.</p></div>`;
            } else if (aba === 'usuarios') {
                const adminsAtivos = (state.usuariosAtlas || []).filter(user => user.role === 'admin' && user.status === 'ativo').length;
                const linhas = state.usuariosCarregando
                    ? '<tr><td colspan="6">Carregando usuários...</td></tr>'
                    : (state.usuariosAtlas || []).map(user => {
                        const id = escaparAtributoJs(user.id);
                        const role = String(user.role || 'visualizador');
                        const status = String(user.status || 'pendente');
                        const contaAtual = user.id === state.usuarioAtual?.id;
                        const ultimoAdminAtivo = role === 'admin' && status === 'ativo' && adminsAtivos <= 1;
                        const exclusaoBloqueada = !podeUsuarios || contaAtual || ultimoAdminAtivo;
                        const motivoBloqueio = contaAtual
                            ? 'Você não pode excluir a própria conta.'
                            : (ultimoAdminAtivo ? 'Ative outro Admin antes de excluir este usuário.' : 'Sem permissão para excluir usuários.');
                        return `<tr>
                            <td><b>${escaparHtml(user.nome || '-')}</b><span>${escaparHtml(user.email || '')}</span></td>
                            <td>${formatarDataHoraAtnx(user.last_sign_in_at || user.updated_at || user.created_at)}</td>
                            <td><select onchange="atualizarUsuarioAtlas('${id}', 'role', this.value)" ${podeUsuarios ? '' : 'disabled'}>${Object.keys(ATLAS_ROLES).map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${obterLabelRoleAtlas(r)}</option>`).join('')}</select></td>
                            <td><select onchange="atualizarUsuarioAtlas('${id}', 'status', this.value)" ${podeUsuarios ? '' : 'disabled'}>${ATLAS_STATUS_USUARIO.map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
                            <td><span class="atlas-role-pill atlas-role-${escaparHtml(role)}">${obterLabelRoleAtlas(role)}</span></td>
                            <td><div class="atlas-admin-user-actions"><button onclick="editarNomeUsuarioAtlas('${id}')" ${podeUsuarios ? '' : 'disabled'}>Nome</button><button class="danger" onclick="excluirUsuarioAtlas('${id}')" ${exclusaoBloqueada ? 'disabled' : ''} title="${escaparHtml(exclusaoBloqueada ? motivoBloqueio : 'Excluir usuário')}">Excluir</button></div></td>
                        </tr>`;
                    }).join('');
                conteudo = `<div class="atlas-admin-card">
                    <div class="atlas-admin-card-head"><div><h3>Usuários e Acessos</h3><p>Controle quem entra no Atlas e qual nível cada pessoa possui.</p></div><button onclick="carregarAdminCentral()">Atualizar</button></div>
                    ${state.usuariosErro ? `<div class="atlas-module-warning">${escaparHtml(state.usuariosErro)}</div>` : ''}
                    <div class="atlas-admin-table-wrap"><table class="atlas-admin-table"><thead><tr><th>Usuário</th><th>Última atividade</th><th>Perfil</th><th>Status</th><th>Nível</th><th>Ação</th></tr></thead><tbody>${linhas || '<tr><td colspan="6">Nenhum usuário encontrado.</td></tr>'}</tbody></table></div>
                </div>`;
            } else if (aba === 'permissoes') {
                const permissoes = [
                    ['gerenciar_usuarios', 'Gerenciar usuários'],
                    ['configurar_sistema', 'Configurar sistema/campos'],
                    ['criar_registro', 'Criar registros'],
                    ['editar_registro', 'Editar registros'],
                    ['excluir_registro', 'Excluir registros'],
                    ['anexar_arquivo', 'Anexar arquivos'],
                    ['ver_dashboard', 'Ver dashboards'],
                    ['ver_auditoria', 'Ver auditoria']
                ];
                conteudo = `<div class="atlas-admin-role-grid">${Object.entries(ATLAS_ROLES).map(([role, cfg]) => `<article class="atlas-admin-role-card"><h3>${cfg.label}</h3>${permissoes.map(([key, label]) => `<span class="${cfg.permissoes.includes(key) || role === 'admin' ? 'on' : ''}">${label}</span>`).join('')}</article>`).join('')}</div>`;
            } else {
                const linhas = state.camposCarregando
                    ? '<tr><td colspan="7">Carregando campos...</td></tr>'
                    : (state.camposPersonalizados || []).map(campo => {
                        const id = escaparAtributoJs(campo.id);
                        return `<tr>
                            <td><b>${escaparHtml(campo.nome || '')}</b><span>${escaparHtml(campo.chave || '')}</span></td>
                            <td>${escaparHtml(campo.modulo || '')}</td>
                            <td>${escaparHtml(campo.tipo || '')}</td>
                            <td>${(campo.opcoes || []).map(op => `<span class="atlas-field-option">${escaparHtml(op)}</span>`).join('') || '-'}</td>
                            <td>${campo.obrigatorio ? 'Sim' : 'Não'}</td>
                            <td><label class="atlas-admin-switch"><input type="checkbox" ${campo.ativo ? 'checked' : ''} onchange="alternarCampoPersonalizadoAtlas('${id}', this.checked)"><span></span></label></td>
                            <td><button class="danger" onclick="removerCampoPersonalizadoAtlas('${id}')">Remover</button></td>
                        </tr>`;
                    }).join('');
                conteudo = `<div class="atlas-admin-card">
                    <div class="atlas-admin-card-head"><div><h3>Campos Personalizados</h3><p>Base para deixar módulos e ambientes configuráveis sem mexer no código.</p></div></div>
                    ${state.camposErro ? `<div class="atlas-module-warning">${escaparHtml(state.camposErro)}</div>` : ''}
                    <form class="atlas-field-form" onsubmit="criarCampoPersonalizadoAtlas(event)">
                        <label><span>Módulo</span><select name="modulo"><option value="documentacao">Documentação Rede Geral</option><option value="manutencao_redes">Manutenção de Redes</option><option value="expansoes">Expansões</option><option value="pmo">PMO</option></select></label>
                        <label><span>Nome do campo</span><input name="nome" placeholder="Ex.: SLA, Causa raiz, KMZ" required></label>
                        <label><span>Tipo</span><select name="tipo"><option value="texto">Texto</option><option value="numero">Número</option><option value="data">Data</option><option value="lista">Lista</option><option value="status">Status colorido</option><option value="arquivo">Arquivo/anexo</option><option value="checkbox">Checkbox</option><option value="link">Link</option></select></label>
                        <label><span>Opções</span><input name="opcoes" placeholder="Separar por vírgula"></label>
                        <label><span>Ordem</span><input name="ordem" type="number" value="0"></label>
                        <label class="atlas-field-check"><input name="obrigatorio" type="checkbox"> Obrigatório</label>
                        <button type="submit">Criar campo</button>
                    </form>
                    <div class="atlas-admin-table-wrap"><table class="atlas-admin-table"><thead><tr><th>Campo</th><th>Módulo</th><th>Tipo</th><th>Opções</th><th>Obrigatório</th><th>Ativo</th><th>Ação</th></tr></thead><tbody>${linhas || '<tr><td colspan="7">Nenhum campo personalizado criado.</td></tr>'}</tbody></table></div>
                </div>`;
            }
            painel.innerHTML = `<div class="atlas-admin-shell">
                <div class="atlas-module-titlebar">
                    <div><div class="atlas-module-kicker">Sistema</div><h2>Central de Administração</h2><p>Login, perfis, permissões e campos configuráveis.</p></div>
                    <div class="atlas-module-actions"><button class="atlas-action-btn" onclick="carregarAdminCentral()">Atualizar</button></div>
                </div>
                ${tabs}
                ${conteudo}
            </div>`;
            setTimeout(aplicarPermissoesInterativasAtlas, 0);
        }

        let tokenCarregamentoObra = 0;
        let preCarregamentoObrasEmExecucao = false;

        function aplicarEstadoSidebarAtlas() {
            const sb = document.getElementById('sidebar-container');
            const btnAbrir = document.getElementById('btn-abrir-sidebar');
            const header = document.getElementById('header-conteudo');
            const backdrop = document.getElementById('atlas-sidebar-backdrop');
            if (!sb || !btnAbrir || !header) return;

            if (state.sidebarAberta) {
                sb.classList.remove('w-0', 'border-r-0');
                sb.classList.add('w-72');
                btnAbrir.classList.add('hidden');
                header.classList.remove('pl-16');
                document.body.classList.add('atlas-sidebar-open');
                document.body.classList.remove('atlas-sidebar-closed');
            } else {
                sb.classList.remove('w-72');
                sb.classList.add('w-0', 'border-r-0');
                btnAbrir.classList.remove('hidden');
                header.classList.add('pl-16');
                document.body.classList.remove('atlas-sidebar-open');
                document.body.classList.add('atlas-sidebar-closed');
            }
            sb.setAttribute('aria-hidden', state.sidebarAberta ? 'false' : 'true');
            btnAbrir.setAttribute('aria-expanded', state.sidebarAberta ? 'true' : 'false');
            if (backdrop) backdrop.setAttribute('aria-hidden', state.sidebarAberta ? 'false' : 'true');
        }

        function toggleSidebar(forcarAberta) {
            state.sidebarAberta = typeof forcarAberta === 'boolean' ? forcarAberta : !state.sidebarAberta;
            aplicarEstadoSidebarAtlas();
            window.dispatchEvent(new CustomEvent('atlas-layout-change'));
            setTimeout(() => window.dispatchEvent(new CustomEvent('atlas-layout-change')), 180);
            setTimeout(() => window.dispatchEvent(new CustomEvent('atlas-layout-change')), 420);
        }

        function fecharSidebarResponsiva() {
            if (window.matchMedia('(max-width: 900px)').matches && state.sidebarAberta) {
                toggleSidebar(false);
            }
        }

        async function inicializarBanco() {
            const alerta = document.getElementById('status-banco-alerta');
            const badge = document.getElementById('badge-status');
            if (!supabaseClient) return;

            atlasExibirOperacao('Carregando dados do Atlas...', 'bg-[#0073ea]');
            try {
                const { data: dataObras, error: errObras } = await supabaseClient.from('obras').select('*').order('created_at', { ascending: true });
                if(errObras) throw errObras;
                state.obras = dataObras || [];

                alerta.style.display = 'none';
                badge.className = "px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
                badge.innerText = "Nuvem Ativa";

                if (state.obras.length > 0 && !state.obraAtiva) {
                    state.obraAtiva = state.obras[0].id;
                }

                if (state.obraAtiva) {
                    state.carregandoObra = true;
                    renderApp();
                    const elementos = await carregarElementosDaObra(state.obraAtiva, { usarCache: false, salvarNoState: false });
                    state.elementos = elementos;
                    state.carregandoObra = false;
                } else {
                    state.elementos = [];
                    state.carregandoObra = false;
                }
                atlasExibirOperacao('Atlas carregado e sincronizado.', 'bg-emerald-600');
            } catch (err) {
                console.error(err);
                alerta.className = "bg-red-600 text-white text-center py-2 font-semibold text-xs z-50";
                alerta.innerText = "⚠️ Erro de sincronização: " + err.message;
                state.carregandoObra = false;
                atlasExibirOperacao('Erro de sincronização: ' + err.message, 'bg-red-600');
            }
            renderApp();
            if (state.moduloAtivo === 'admin_obras' && (state.adminVisualizacao || 'status') !== 'obras' && state.adminObras.length === 0 && !state.adminCarregando) {
                carregarAdminObras();
            }
            iniciarPreCarregamentoObras();
        }

        async function carregarElementosDaObra(obraId, opcoes = {}) {
            const usarCache = opcoes.usarCache !== false;
            const salvarNoState = opcoes.salvarNoState === true;

            if (usarCache && state.cacheElementosPorObra[obraId]) {
                const elementosCache = state.cacheElementosPorObra[obraId];
                if (salvarNoState && state.obraAtiva === obraId) state.elementos = elementosCache;
                return elementosCache;
            }

            const { data: dataElementos, error: errEl } = await supabaseClient
                .from('elementos_principais')
                .select('*')
                .eq('obra_id', obraId)
                .order('created_at', { ascending: true });
            if (errEl) throw errEl;

            const elementosBase = dataElementos || [];
            const idsElementos = elementosBase.map(el => el.id).filter(Boolean);
            let dataSubs = [];

            if (idsElementos.length > 0) {
                const { data, error: errSub } = await supabaseClient
                    .from('subelementos')
                    .select('*')
                    .in('pai_id', idsElementos)
                    .order('created_at', { ascending: true });
                if (errSub) throw errSub;
                dataSubs = data || [];
            }

            const elementos = elementosBase.map(el => ({
                ...el,
                subelementos: dataSubs.filter(s => s.pai_id === el.id)
            }));

            state.cacheElementosPorObra[obraId] = elementos;
            if (salvarNoState && state.obraAtiva === obraId) state.elementos = elementos;
            return elementos;
        }

        async function iniciarPreCarregamentoObras() {
            if (preCarregamentoObrasEmExecucao || !state.obras || state.obras.length <= 1) return;
            preCarregamentoObrasEmExecucao = true;

            setTimeout(async () => {
                try {
                    for (const obra of state.obras) {
                        if (!obra || !obra.id || obra.id === state.obraAtiva || state.cacheElementosPorObra[obra.id]) continue;
                        await carregarElementosDaObra(obra.id, { usarCache: false, salvarNoState: false });
                        await new Promise(resolve => setTimeout(resolve, 80));
                    }
                } catch (err) {
                    console.warn('Pré-carregamento de obras interrompido:', err);
                } finally {
                    preCarregamentoObrasEmExecucao = false;
                }
            }, 250);
        }

        function invalidarCacheObra(obraId = state.obraAtiva) {
            if (!obraId) return;
            delete state.cacheElementosPorObra[obraId];
        }

        async function criarNovaObra() {
            const nome = await solicitarTextoAtnx({ titulo: 'Nova obra/cidade', label: 'Nome da obra/cidade', placeholder: 'Ex.: Poço Branco - RN', obrigatorio: true, textoConfirmar: 'Criar' });
            if (!nome || !nome.trim()) return;
            const id = 'obra-' + Date.now();
            try {
                const { error } = await supabaseClient.from('obras').insert([{ id, nome: nome.trim() }]);
                if (error) throw error;
                state.obraAtiva = id; 
                await inicializarBanco();
            } catch (err) { await alertaVisualAtnx('Erro ao criar obra', err.message); }
        }

        async function excluirObra(id, e) {
            if (e) e.stopPropagation();

            const obra = state.obras.find(o => o.id === id);
            const nomeObra = obra ? obra.nome : 'esta Cidade/Obra';

            const confirmado = await confirmarVisualAtnx('Remover obra', `Remover ${nomeObra} do site?

Itens importados do Google Drive serão preservados no Drive. A exclusão remove apenas os registros do Atlas/Supabase.`, 'Remover');
            if (!confirmado) return;

            try {
                exibirStatusTemporario('🗑️ Removendo obra do site...', 'bg-[#0073ea]');

                const estrutura = await carregarEstruturaCompletaObra(id);
                const contextoExclusao = { obra: estrutura.obra, elementos: estrutura.elementos };
                const preservarDrive = devePreservarDriveAoExcluirEntidade('obra', contextoExclusao);
                let avisoDrive = '';

                try {
                    const removidos = await excluirMidiasCriadasPeloAtnxNoDrive('obra', contextoExclusao);
                    if (removidos > 0) avisoDrive += ` ${removidos} arquivo(s) criado(s) pelo Atlas foram removidos do Drive.`;
                } catch (driveErr) {
                    console.warn('Falha ao remover arquivos novos criados pelo Atlas:', driveErr);
                    avisoDrive += ' Alguns arquivos novos podem não ter sido removidos do Drive.';
                }

                if (!preservarDrive) {
                    try {
                        exibirStatusTemporario('🗑️ Removendo obra do site e tentando limpar a pasta no Drive...', 'bg-[#0073ea]');
                        await excluirPastaEntidadeNoGoogleDrive('obra', contextoExclusao);
                        avisoDrive += ' Pasta criada pelo Atlas enviada para a lixeira do Drive.';
                    } catch (driveErr) {
                        console.warn('A obra será removida do site, mas a pasta do Drive não foi alterada:', driveErr);
                        avisoDrive += ' A pasta do Drive não foi alterada.';
                    }
                } else {
                    avisoDrive += ' Conteúdo importado via link foi preservado no Google Drive.';
                }

                const { error } = await supabaseClient.from('obras').delete().eq('id', id);
                if (error) throw error;

                if (state.obraAtiva === id) state.obraAtiva = '';
                exibirStatusTemporario('✅ Obra removida do site.' + avisoDrive, 'bg-emerald-600');
                await inicializarBanco();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao apagar cidade: ' + err.message, 'bg-red-600');
                await alertaVisualAtnx('Erro ao apagar cidade', err.message);
            }
        }

        async function alterarNomeObra(id, e) {
            if (e) e.stopPropagation();
            const obra = state.obras.find(o => o.id === id);
            const atual = obra ? obra.nome : '';
            const nome = await solicitarTextoAtnx({ titulo: 'Editar obra/cidade', label: 'Nome da obra/cidade', valor: atual, obrigatorio: true, textoConfirmar: 'Salvar' });

            if (nome === null) return;
            const novoNome = nome.trim();
            if (!novoNome) { await alertaVisualAtnx('Campo obrigatório', 'O nome da obra não pode ficar vazio.'); return; }

            try {
                const { error } = await supabaseClient
                    .from('obras')
                    .update({ nome: novoNome })
                    .eq('id', id);

                if (error) throw error;
                await inicializarBanco();
            } catch (err) {
                await alertaVisualAtnx('Erro ao editar obra', err.message);
            }
        }

        async function criarElementoPai() {
            if (!state.obraAtiva) { await alertaVisualAtnx('Selecione uma cidade', 'Selecione uma Cidade primeiro.'); return; }
            const nome = await solicitarTextoAtnx({ titulo: `Novo Ativo Principal (${state.abaAtiva})`, label: 'Nome do ativo principal', placeholder: 'Ex.: RT01, OLT, CEO FTTH 01', obrigatorio: true, textoConfirmar: 'Criar' });
            if (!nome || !nome.trim()) return;
            const id = 'el-' + Date.now();
            try {
                const { error } = await supabaseClient.from('elementos_principais').insert([{
                    id, obra_id: state.obraAtiva, nome: nome.trim(), tipo: state.abaAtiva, status: 'Não iniciado',
                    data: obterDataHojeISO(), tecnico: 'Não Atribuído'
                }]);
                if (error) throw error;
                state.linhasExpandidas[id] = true; 
                await inicializarBanco();
            } catch(err) { await alertaVisualAtnx('Erro ao criar ativo', err.message); }
        }

        async function alterarNomeElementoPai(id, e) {
            if (e) e.stopPropagation();
            const elemento = state.elementos.find(el => el.id === id);
            const atual = elemento ? elemento.nome : '';
            const nome = await solicitarTextoAtnx({ titulo: 'Editar ativo principal', label: 'Nome do ativo', valor: atual, obrigatorio: true, textoConfirmar: 'Salvar' });

            if (nome === null) return;
            const novoNome = nome.trim();
            if (!novoNome) { await alertaVisualAtnx('Campo obrigatório', 'O nome do ativo não pode ficar vazio.'); return; }

            try {
                const { error } = await supabaseClient
                    .from('elementos_principais')
                    .update({ nome: novoNome })
                    .eq('id', id);

                if (error) throw error;
                await inicializarBanco();
            } catch (err) {
                await alertaVisualAtnx('Erro ao editar ativo', err.message);
            }
        }

        async function alterarTecnicoPai(id, atual) {
            const nome = await solicitarTextoAtnx({ titulo: 'Responsável pelo ativo', label: 'Nome do responsável', valor: atual === 'Não Atribuído' ? '' : atual, placeholder: 'Não Atribuído', textoConfirmar: 'Aplicar' });
            if (nome === null) return;
            const novoValor = nome.trim() || 'Não Atribuído';
            try {
                const { error: erroPai } = await supabaseClient
                    .from('elementos_principais')
                    .update({ tecnico: novoValor })
                    .eq('id', id);
                if (erroPai) throw erroPai;

                const { error: erroSubs } = await supabaseClient
                    .from('subelementos')
                    .update({ tecnico: novoValor })
                    .eq('pai_id', id);
                if (erroSubs) throw erroSubs;

                exibirStatusTemporario('✅ Responsável aplicado ao ativo e aos subelementos.', 'bg-emerald-600');
                await inicializarBanco();
            } catch (err) { await alertaVisualAtnx('Erro ao salvar', err.message); }
        }

        async function alterarStatusPai(id, novoStatus, selectEl) {
            await alterarStatusComSelecao('pai', id, novoStatus, selectEl);
        }

        async function excluirElementoPai(id) {
            const elemento = state.elementos.find(el => el.id === id);
            const obra = state.obras.find(o => o.id === state.obraAtiva);
            const nomeElemento = elemento ? elemento.nome : 'este ativo principal';

            const confirmado = await confirmarVisualAtnx('Remover ativo', `Remover ${nomeElemento} e todas as suas portas do site?

Itens importados do Google Drive serão preservados no Drive. A exclusão remove apenas os registros do Atlas/Supabase.`, 'Remover');
            if (!confirmado) return;

            try {
                exibirStatusTemporario('🗑️ Removendo ativo do site...', 'bg-[#0073ea]');

                const contextoExclusao = { obra, elemento };
                const preservarDrive = devePreservarDriveAoExcluirEntidade('elemento', contextoExclusao);
                let avisoDrive = '';

                try {
                    const removidos = await excluirMidiasCriadasPeloAtnxNoDrive('elemento', contextoExclusao);
                    if (removidos > 0) avisoDrive += ` ${removidos} arquivo(s) criado(s) pelo Atlas foram removidos do Drive.`;
                } catch (driveErr) {
                    console.warn('Falha ao remover arquivos novos criados pelo Atlas:', driveErr);
                    avisoDrive += ' Alguns arquivos novos podem não ter sido removidos do Drive.';
                }

                if (elemento && obra && !preservarDrive) {
                    try {
                        exibirStatusTemporario('🗑️ Removendo ativo do site e tentando limpar a pasta no Drive...', 'bg-[#0073ea]');
                        await excluirPastaEntidadeNoGoogleDrive('elemento', contextoExclusao);
                        avisoDrive += ' Pasta criada pelo Atlas enviada para a lixeira do Drive.';
                    } catch (driveErr) {
                        console.warn('O ativo será removido do site, mas a pasta do Drive não foi alterada:', driveErr);
                        avisoDrive += ' A pasta do Drive não foi alterada.';
                    }
                } else if (preservarDrive) {
                    avisoDrive += ' Conteúdo importado via link foi preservado no Google Drive.';
                }

                const { error } = await supabaseClient.from('elementos_principais').delete().eq('id', id);
                if (error) throw error;

                exibirStatusTemporario('✅ Ativo removido do site.' + avisoDrive, 'bg-emerald-600');
                await inicializarBanco();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao excluir ativo: ' + err.message, 'bg-red-600');
                await alertaVisualAtnx('Erro ao excluir ativo', err.message);
            }
        }

        async function criarSubelemento(paiId) {
            const nome = await solicitarTextoAtnx({ titulo: 'Nova porta/subelemento', label: 'Identificação', placeholder: 'Ex.: Porta 01', obrigatorio: true, textoConfirmar: 'Continuar' });
            if (!nome || !nome.trim()) return;
            const sinal = await solicitarTextoAtnx({ titulo: 'Sinal Power Meter', label: 'Sinal (dBm)', valor: '-16.00', placeholder: '-16.00', textoConfirmar: 'Criar' });
            const elementoPai = state.elementos.find(el => el.id === paiId);
            const tecnicoPadrao = elementoPai?.tecnico || 'Não Atribuído';
            try {
                const { error } = await supabaseClient.from('subelementos').insert([{
                    id: 'sub-' + Date.now(), pai_id: paiId, nome: nome.trim(), status: 'Não iniciado',
                    sinal: sinal ? sinal.trim() : '---', data: obterDataHojeISO(),
                    tecnico: tecnicoPadrao, fotos: [], diagramas: []
                }]);
                if (error) throw error;
                await inicializarBanco();
            } catch(err) { await alertaVisualAtnx('Erro ao criar porta/subelemento', err.message); }
        }

        async function alterarNomeSubelemento(subId, e) {
            if (e) e.stopPropagation();
            let subelementoAtual = null;

            for (const elemento of state.elementos) {
                subelementoAtual = elemento.subelementos?.find(s => s.id === subId);
                if (subelementoAtual) break;
            }

            const atual = subelementoAtual ? subelementoAtual.nome : '';
            const nome = await solicitarTextoAtnx({ titulo: 'Editar porta/subelemento', label: 'Nome da porta/subelemento', valor: atual, obrigatorio: true, textoConfirmar: 'Salvar' });

            if (nome === null) return;
            const novoNome = nome.trim();
            if (!novoNome) { await alertaVisualAtnx('Campo obrigatório', 'O nome da porta/subelemento não pode ficar vazio.'); return; }

            try {
                const { error } = await supabaseClient
                    .from('subelementos')
                    .update({ nome: novoNome })
                    .eq('id', subId);

                if (error) throw error;
                await inicializarBanco();
            } catch (err) {
                await alertaVisualAtnx('Erro ao editar porta/subelemento', err.message);
            }
        }

        async function alterarTecnicoSub(subId, atual) {
            const nome = await solicitarTextoAtnx({ titulo: 'Técnico responsável', label: 'Nome do técnico', valor: atual === 'Não Atribuído' ? '' : atual, placeholder: 'Não Atribuído', textoConfirmar: 'Salvar' });
            if (nome === null) return;
            const novoValor = nome.trim() || 'Não Atribuído';
            try {
                await supabaseClient.from('subelementos').update({ tecnico: novoValor }).eq('id', subId);
                await inicializarBanco();
            } catch (err) { await alertaVisualAtnx('Erro ao salvar', err.message); }
        }

        async function alterarSinalSub(subId, atual) {
            const sinal = await solicitarTextoAtnx({ titulo: 'Alterar sinal Power Meter', label: 'Sinal (dBm)', valor: atual, placeholder: '-16.00', textoConfirmar: 'Salvar' });
            if (sinal === null) return;
            try {
                await supabaseClient.from('subelementos').update({ sinal: sinal.trim() || '---' }).eq('id', subId);
                await inicializarBanco();
            } catch (err) { await alertaVisualAtnx('Erro ao salvar', err.message); }
        }

        async function alterarStatusSub(subId, novoStatus, selectEl) {
            await alterarStatusComSelecao('sub', subId, novoStatus, selectEl);
        }


        function obterDataHojeISO() {
            const hoje = new Date();
            const ano = hoje.getFullYear();
            const mes = String(hoje.getMonth() + 1).padStart(2, '0');
            const dia = String(hoje.getDate()).padStart(2, '0');
            return `${ano}-${mes}-${dia}`;
        }

        function converterDataParaInput(valor) {
            if (!valor) return obterDataHojeISO();

            const texto = String(valor).trim();

            // Já está no formato aceito pelo input date: YYYY-MM-DD
            const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

            // Formato brasileiro: DD/MM/YYYY
            const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (br) {
                const dia = br[1].padStart(2, '0');
                const mes = br[2].padStart(2, '0');
                return `${br[3]}-${mes}-${dia}`;
            }

            return obterDataHojeISO();
        }

        function formatarDataParaExibicao(valor) {
            if (!valor) return 'Sem data';

            const texto = String(valor).trim();
            const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

            if (iso) {
                return `${iso[3]}/${iso[2]}/${iso[1]}`;
            }

            return texto;
        }

        async function alterarDataPai(id, novaData) {
            if (!novaData) return;

            try {
                const { error } = await supabaseClient
                    .from('elementos_principais')
                    .update({ data: novaData })
                    .eq('id', id);

                if (error) throw error;
                await inicializarBanco();
            } catch (err) {
                await alertaVisualAtnx('Erro ao alterar data', err.message);
            }
        }

        async function alterarDataSub(subId, novaData) {
            if (!novaData) return;

            try {
                const { error } = await supabaseClient
                    .from('subelementos')
                    .update({ data: novaData })
                    .eq('id', subId);

                if (error) throw error;
                await inicializarBanco();
            } catch (err) {
                await alertaVisualAtnx('Erro ao alterar data', err.message);
            }
        }

        function escaparHtml(valor) {
            return String(valor ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        function escaparAtributoJs(valor) {
            return String(valor ?? '')
                .replaceAll('\\', '\\\\')
                .replaceAll("'", "\\'")
                .replaceAll('\n', ' ')
                .replaceAll('\r', ' ');
        }

        const atlasAnexosVisualizadorCache = new Map();
        let atlasVisualizadorAnexosAtual = { lista: [], indice: 0, titulo: 'Anexos' };

        function atlasUrlAnexo(anexo) {
            if (typeof anexo === 'string') return anexo;
            return anexo?.viewUrl || anexo?.webViewLink || anexo?.url || anexo?.webContentLink || anexo?.thumbnailUrl || '';
        }

        function atlasThumbAnexo(anexo) {
            if (typeof anexo === 'string') return anexo;
            return anexo?.thumbnailUrl || anexo?.thumbUrl || anexo?.webContentLink || anexo?.url || anexo?.viewUrl || anexo?.webViewLink || '';
        }

        function atlasExtrairFileIdDrive(url) {
            const texto = String(url || '');
            const porPath = texto.match(/\/file\/d\/([^/?#]+)/i) || texto.match(/\/d\/([^/?#]+)/i);
            if (porPath?.[1]) return porPath[1];
            const porQuery = texto.match(/[?&]id=([^&#]+)/i);
            return porQuery?.[1] ? decodeURIComponent(porQuery[1]) : '';
        }

        function atlasEhImagemAnexo(anexo) {
            const mime = String(anexo?.mimeType || anexo?.tipoMime || '').toLowerCase();
            const tipo = String(anexo?.tipo || anexo?.tipoMidia || '').toLowerCase();
            const url = atlasUrlAnexo(anexo).toLowerCase();
            return mime.startsWith('image/') || tipo.includes('imagem') || tipo.includes('image') || /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(url);
        }

        function atlasNormalizarAnexoVisual(anexo, indice = 0) {
            if (typeof anexo === 'string') {
                const url = anexo.trim();
                return { nome: `Anexo ${indice + 1}`, url, viewUrl: url, thumbnailUrl: url, origem: 'link' };
            }
            const url = atlasUrlAnexo(anexo);
            return {
                ...(anexo || {}),
                nome: anexo?.nome || anexo?.name || anexo?.filename || `Anexo ${indice + 1}`,
                url,
                viewUrl: anexo?.viewUrl || anexo?.webViewLink || url,
                thumbnailUrl: atlasThumbAnexo(anexo)
            };
        }

        function atlasRegistrarAnexosVisualizador(chave, anexos) {
            const lista = (Array.isArray(anexos) ? anexos : [anexos])
                .map((anexo, indice) => atlasNormalizarAnexoVisual(anexo, indice))
                .filter(anexo => atlasUrlAnexo(anexo));
            atlasAnexosVisualizadorCache.set(String(chave), lista);
            return String(chave);
        }

        function atlasPreviewUrlAnexo(anexo) {
            const url = atlasUrlAnexo(anexo);
            const fileId = anexo?.fileId || atlasExtrairFileIdDrive(url);
            if (atlasEhImagemAnexo(anexo) && fileId) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
            if (!atlasEhImagemAnexo(anexo) && fileId) return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
            return atlasEhImagemAnexo(anexo) ? (atlasThumbAnexo(anexo) || url) : url;
        }

        function atlasAbrirVisualizadorAnexoUnico(url, nome = 'Anexo', event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const chave = `avulso:${Date.now()}:${Math.random().toString(36).slice(2)}`;
            atlasRegistrarAnexosVisualizador(chave, [{ nome, url, viewUrl: url }]);
            atlasAbrirVisualizadorRegistrado(chave, 0, null, nome);
        }

        function atlasAbrirVisualizadorRegistrado(chave, indice = 0, event, titulo = 'Anexos') {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const lista = atlasAnexosVisualizadorCache.get(String(chave)) || [];
            if (!lista.length) return;
            atlasVisualizadorAnexosAtual = {
                lista,
                indice: Math.max(0, Math.min(Number(indice) || 0, lista.length - 1)),
                titulo
            };
            atlasExibirOperacao('Carregando arquivo no visualizador...', 'bg-[#0073ea]');
            atlasRenderizarVisualizadorAnexos();
        }

        function atlasFecharVisualizadorAnexos() {
            const root = document.getElementById('atlas-attachment-viewer-root');
            if (root) root.remove();
            document.removeEventListener('keydown', atlasAtalhoVisualizadorAnexos);
        }

        function atlasMoverVisualizadorAnexos(delta) {
            const atual = atlasVisualizadorAnexosAtual;
            if (!atual.lista.length) return;
            atual.indice = (atual.indice + delta + atual.lista.length) % atual.lista.length;
            atlasRenderizarVisualizadorAnexos();
        }

        function atlasAbrirAnexoNovaGuia(event) {
            event?.stopPropagation?.();
            const anexo = atlasVisualizadorAnexosAtual.lista[atlasVisualizadorAnexosAtual.indice];
            const url = atlasUrlAnexo(anexo);
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
        }

        function atlasConcluirCarregamentoAnexo() {
            atlasExibirOperacao('Arquivo carregado no Atlas.', 'bg-emerald-600');
        }

        function atlasFalhaCarregamentoAnexo(elemento) {
            elemento?.classList?.add('is-broken');
            atlasExibirOperacao('Não foi possível carregar a prévia deste arquivo.', 'bg-red-600');
        }

        function atlasBaixarAnexoAtual(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const anexo = atlasVisualizadorAnexosAtual.lista[atlasVisualizadorAnexosAtual.indice];
            if (!anexo) return;
            const origem = anexo.webContentLink || anexo.downloadUrl || atlasUrlAnexo(anexo);
            const fileId = anexo.fileId || atlasExtrairFileIdDrive(origem);
            const url = fileId ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}` : origem;
            if (!url) {
                atlasExibirOperacao('Link de download indisponível.', 'bg-red-600');
                return;
            }
            atlasExibirOperacao(`Baixando ${anexo.nome || 'arquivo'}...`, 'bg-[#0073ea]');
            const link = document.createElement('a');
            link.href = url;
            link.download = anexo.nome || 'arquivo';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => atlasExibirOperacao('Download iniciado.', 'bg-emerald-600'), 500);
        }

        function atlasAtalhoVisualizadorAnexos(event) {
            if (event.key === 'Escape') atlasFecharVisualizadorAnexos();
            if (event.key === 'ArrowLeft') atlasMoverVisualizadorAnexos(-1);
            if (event.key === 'ArrowRight') atlasMoverVisualizadorAnexos(1);
        }

        function atlasRenderizarVisualizadorAnexos() {
            const atual = atlasVisualizadorAnexosAtual;
            const anexo = atual.lista[atual.indice];
            if (!anexo) return;
            let root = document.getElementById('atlas-attachment-viewer-root');
            if (!root) {
                root = document.createElement('div');
                root.id = 'atlas-attachment-viewer-root';
                document.body.appendChild(root);
            }
            const nome = anexo.nome || `Anexo ${atual.indice + 1}`;
            const previewUrl = atlasPreviewUrlAnexo(anexo);
            const contador = atual.lista.length > 1 ? `${atual.indice + 1} de ${atual.lista.length}` : '1 arquivo';
            const conteudo = atlasEhImagemAnexo(anexo)
                ? `<div class="atlas-attachment-viewer-image-stage"><img class="atlas-attachment-viewer-image" src="${escaparHtml(previewUrl)}" alt="${escaparHtml(nome)}" onload="atlasConcluirCarregamentoAnexo()" onerror="atlasFalhaCarregamentoAnexo(this)"></div>`
                : `<iframe class="atlas-attachment-viewer-frame" src="${escaparHtml(previewUrl)}" title="${escaparHtml(nome)}" onload="atlasConcluirCarregamentoAnexo()" onerror="atlasFalhaCarregamentoAnexo(this)"></iframe>`;
            root.innerHTML = `<div class="atlas-attachment-viewer-backdrop" onclick="atlasFecharVisualizadorAnexos()">
                <section class="atlas-attachment-viewer-panel" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
                    <header class="atlas-attachment-viewer-head">
                        <div><span>${escaparHtml(atual.titulo || 'Anexos')}</span><strong>${escaparHtml(nome)}</strong></div>
                        <div class="atlas-attachment-viewer-actions">
                            <em>${escaparHtml(contador)}</em>
                            <button type="button" onclick="atlasBaixarAnexoAtual(event)">Baixar</button>
                            <button type="button" onclick="atlasAbrirAnexoNovaGuia(event)">Nova guia</button>
                            <button type="button" class="atlas-attachment-viewer-close" onclick="atlasFecharVisualizadorAnexos()" aria-label="Fechar">×</button>
                        </div>
                    </header>
                    <div class="atlas-attachment-viewer-body">
                        ${atual.lista.length > 1 ? `<button type="button" class="atlas-attachment-viewer-nav prev" onclick="atlasMoverVisualizadorAnexos(-1)" aria-label="Anexo anterior">‹</button>` : ''}
                        ${conteudo}
                        ${atual.lista.length > 1 ? `<button type="button" class="atlas-attachment-viewer-nav next" onclick="atlasMoverVisualizadorAnexos(1)" aria-label="Próximo anexo">›</button>` : ''}
                    </div>
                </section>
            </div>`;
            document.removeEventListener('keydown', atlasAtalhoVisualizadorAnexos);
            document.addEventListener('keydown', atlasAtalhoVisualizadorAnexos);
        }

        function renderBotaoAnexoAtlas(chave, indice, rotulo = 'Abrir', classe = 'atlas-attachment-link', titulo = 'Anexos') {
            return `<button type="button" class="${escaparHtml(classe)}" onclick="atlasAbrirVisualizadorRegistrado('${escaparAtributoJs(chave)}', ${Number(indice) || 0}, event, '${escaparAtributoJs(titulo)}')">${escaparHtml(rotulo)}</button>`;
        }


        const STATUS_OPCOES = ['Não iniciado', 'Em andamento', 'Parado', 'Concluído'];

        function normalizarStatus(valor) {
            const texto = String(valor || '').trim();
            if (!texto || texto === 'Pendente') return 'Não iniciado';
            if (texto === 'Em Andamento') return 'Em andamento';
            if (STATUS_OPCOES.includes(texto)) return texto;
            return 'Não iniciado';
        }

        function obterChaveStatusVisual(status) {
            const statusNormalizado = normalizarStatus(status);
            if (statusNormalizado === 'Concluído') return 'concluido';
            if (statusNormalizado === 'Em andamento') return 'em_andamento';
            if (statusNormalizado === 'Parado') return 'parado';
            return 'nao_iniciado';
        }

        function obterClasseStatus(status) {
            return `atnx-status-select-${obterChaveStatusVisual(status)}`;
        }

        const STATUS_CLASSES = ['atnx-status-select-concluido', 'atnx-status-select-em_andamento', 'atnx-status-select-parado', 'atnx-status-select-nao_iniciado'];
        const STATUS_CONTROLE_CLASSES = [
            'atnx-status-control-concluido',
            'atnx-status-control-em_andamento',
            'atnx-status-control-parado',
            'atnx-status-control-nao_iniciado',
            'atnx-status-control-admin_concluida',
            'atnx-status-control-admin_em_andamento',
            'atnx-status-control-admin_parada',
            'atnx-status-control-admin_a_realizar',
            'atnx-status-control-admin_vazio'
        ];

        function aplicarChaveStatusControle(elemento, chaveStatus) {
            if (!elemento) return;
            STATUS_CONTROLE_CLASSES.forEach(classe => elemento.classList.remove(classe));
            elemento.classList.add(`atnx-status-control-${chaveStatus}`);
            elemento.dataset.statusKey = chaveStatus;
        }

        function aplicarStatusNoSelect(selectEl, status, salvando = false) {
            if (!selectEl) return;

            STATUS_CLASSES.forEach(classe => selectEl.classList.remove(classe));
            const statusNormalizado = normalizarStatus(status);
            const chaveStatus = obterChaveStatusVisual(statusNormalizado);
            selectEl.classList.add(obterClasseStatus(statusNormalizado));
            selectEl.dataset.statusKey = chaveStatus;
            selectEl.value = statusNormalizado;
            selectEl.disabled = !!salvando;
            selectEl.title = salvando ? 'Salvando status...' : 'Status salvo';
            const controle = selectEl.closest('.atnx-status-control');
            aplicarChaveStatusControle(controle, chaveStatus);
            const label = controle?.querySelector('.atnx-status-label');
            if (label) label.textContent = statusNormalizado;
        }

        function renderizarSelectStatus(tipo, id, statusAtual, largura) {
            const statusNormalizado = normalizarStatus(statusAtual);
            const funcao = tipo === 'pai' ? 'alterarStatusPai' : 'alterarStatusSub';
            const opcoes = STATUS_OPCOES.map(status => {
                const selecionado = status === statusNormalizado ? 'selected' : '';
                return `<option value="${escaparHtml(status)}" ${selecionado}>${escaparHtml(status)}</option>`;
            }).join('');

            const chaveStatus = obterChaveStatusVisual(statusNormalizado);
            return `<span onclick="event.stopPropagation()" data-status-key="${chaveStatus}" class="atnx-status-control atnx-status-control-${chaveStatus} atnx-status-control-inline mx-auto ${largura}">
                <span class="atnx-status-dot" aria-hidden="true"></span>
                <span class="atnx-status-label">${escaparHtml(statusNormalizado)}</span>
                <select aria-label="Alterar status" onchange="${funcao}('${id}', this.value, this)" data-status-key="${chaveStatus}" class="${obterClasseStatus(statusNormalizado)} status-select-inline atnx-status-native block">${opcoes}</select>
                <span class="atnx-status-arrow" aria-hidden="true">▾</span>
            </span>`;
        }

        function normalizarListaMidias(lista) {
            return Array.isArray(lista) ? lista : [];
        }

        function renderizarMidias(lista, classeBorda, subId, campo) {
            const midias = normalizarListaMidias(lista);
            if (midias.length === 0) return '<span class="text-gray-600">Nenhuma</span>';
            const chaveAnexos = atlasRegistrarAnexosVisualizador(`documentacao:${subId}:${campo}`, midias);

            let html = '<div class="flex gap-1 justify-center flex-wrap">';
            midias.forEach((midia, index) => {
                const nome = escaparHtml(midia.nome || midia.name || 'Imagem');
                const imgUrl = escaparHtml(midia.thumbnailUrl || midia.url || midia.webContentLink || '');

                if (!imgUrl) return;

                html += `
                    <div class="media-item relative inline-block" onclick="event.stopPropagation()" title="${nome}">
                        <button type="button" class="atlas-attachment-thumb-button" onclick="atlasAbrirVisualizadorRegistrado('${escaparAtributoJs(chaveAnexos)}', ${index}, event, 'Documentação')">
                            <img src="${imgUrl}" class="w-6 h-6 object-cover rounded ${classeBorda}" onerror="this.style.opacity='0.35'; this.title='Imagem salva, mas miniatura indisponível';">
                        </button>
                        <button type="button" class="media-delete-btn" onclick="excluirMidia('${subId}', '${campo}', ${index}, event)" title="Remover imagem do site; imagens importadas do Drive serão preservadas">×</button>
                    </div>`;
            });
            html += '</div>';
            return html;
        }

        function exibirStatusTemporario(mensagem, classe = 'bg-[#0073ea]') {
            const alerta = document.getElementById('status-banco-alerta');
            atlasExibirOperacao(mensagem, classe);
            if (!alerta) return;
            alerta.style.display = 'block';
            alerta.className = `${classe} text-white text-center py-2 font-semibold text-xs z-50 transition-all`;
            alerta.innerText = mensagem;
        }

        function encontrarContextoSubelemento(subId) {
            const obra = state.obras.find(o => o.id === state.obraAtiva);

            for (const elemento of state.elementos) {
                const subelemento = elemento.subelementos?.find(s => s.id === subId);
                if (subelemento) {
                    return { obra, elemento, subelemento };
                }
            }

            return null;
        }

        async function converterArquivoParaBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();

                reader.onload = () => {
                    const resultado = String(reader.result || '');
                    const base64Limpo = resultado.includes(',') ? resultado.split(',')[1] : resultado;
                    resolve(base64Limpo);
                };

                reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
                reader.readAsDataURL(file);
            });
        }

        async function otimizarImagemParaUpload(file) {
            try {
                const tipo = String(file.type || '').toLowerCase();
                const podeOtimizar = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(tipo);
                if (!podeOtimizar || file.size < 150 * 1024 || typeof createImageBitmap !== 'function') return file;

                const bitmap = await createImageBitmap(file);
                const maxLado = 1024;
                const qualidadeJpeg = 0.55;
                let { width, height } = bitmap;
                const maior = Math.max(width, height);

                if (maior <= maxLado && file.size < 220 * 1024) {
                    bitmap.close?.();
                    return file;
                }

                const escala = Math.min(1, maxLado / maior);
                width = Math.max(1, Math.round(width * escala));
                height = Math.max(1, Math.round(height * escala));

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.drawImage(bitmap, 0, 0, width, height);
                bitmap.close?.();

                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', qualidadeJpeg));
                if (!blob || blob.size >= file.size) return file;

                const nome = String(file.name || 'imagem.jpg').replace(/\.[^.]+$/, '') + '.jpg';
                return new File([blob], nome, { type: 'image/jpeg', lastModified: Date.now() });
            } catch (err) {
                console.warn('Otimização de imagem ignorada:', err);
                return file;
            }
        }

        async function executarComConcorrencia(itens, limite, callback) {
            const resultados = new Array(itens.length);
            let proximo = 0;

            const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
                while (proximo < itens.length) {
                    const indice = proximo++;
                    resultados[indice] = await callback(itens[indice], indice);
                }
            });

            await Promise.all(trabalhadores);
            return resultados;
        }

        function normalizarUrlAppsScriptGoogleDrive(url) {
            const texto = String(url || '').trim();
            if (!texto) return '';
            return texto.replace(/\?.*$/, '').replace(/\/$/, '').replace(/\/dev$/, '/exec');
        }

        function obterChaveUrlAppsScriptGoogleDrive(modulo) {
            const mod = String(modulo || 'documentacao').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            return mod === 'expansoes' ? 'atnx_google_drive_expansoes_upload_url' : 'atnx_google_drive_documentacao_upload_url';
        }

        function obterUrlAppsScriptGoogleDrive(modulo, overrideUrl) {
            const mod = String(modulo || 'documentacao').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            const chaveStorage = obterChaveUrlAppsScriptGoogleDrive(mod);
            let urlSalva = normalizarUrlAppsScriptGoogleDrive(localStorage.getItem(chaveStorage));
            const urlConfig = normalizarUrlAppsScriptGoogleDrive(mod === 'expansoes' ? GOOGLE_DRIVE_EXPANSOES_UPLOAD_URL : GOOGLE_DRIVE_DOCUMENTACAO_UPLOAD_URL);
            const urlOverride = normalizarUrlAppsScriptGoogleDrive(overrideUrl);

            // V1.3.3.7: corrige automaticamente o caso que estava acontecendo no Atlas:
            // a implantação nova estava certa no Apps Script, mas o navegador ainda guardava
            // a URL antiga de Expansões no localStorage e continuava tentando nela.
            if (mod === 'expansoes' && urlConfig && (!urlSalva || ATNX_EXPANSOES_URLS_OBSOLETAS.has(urlSalva))) {
                try { localStorage.setItem(chaveStorage, urlConfig); } catch (e) {}
                urlSalva = urlConfig;
            }

            const url = urlOverride || urlSalva || urlConfig;
            if (!url || url.includes('COLE_AQUI')) {
                throw new Error(mod === 'expansoes'
                    ? 'Configure GOOGLE_DRIVE_EXPANSOES_UPLOAD_URL com o Web App da conta do Drive de Expansões.'
                    : 'Configure GOOGLE_DRIVE_DOCUMENTACAO_UPLOAD_URL com o Web App da conta do Drive de Documentação.');
            }
            if (!/^https:\/\/script\.google\.com\/macros\/s\//i.test(url) || !/\/exec$/i.test(url)) {
                throw new Error('A URL do Apps Script precisa ser a URL pública da implantação Web App terminando em /exec. URL atual: ' + url);
            }
            return url;
        }

        function salvarUrlAppsScriptGoogleDrive(modulo, url) {
            const normalizada = normalizarUrlAppsScriptGoogleDrive(url);
            if (!/^https:\/\/script\.google\.com\/macros\/s\//i.test(normalizada) || !/\/exec$/i.test(normalizada)) {
                throw new Error('URL inválida. Cole a URL da implantação do Apps Script que termina em /exec.');
            }
            localStorage.setItem(obterChaveUrlAppsScriptGoogleDrive(modulo), normalizada);
            return normalizada;
        }

        async function solicitarUrlAppsScriptExpansoesAtual(erroOriginal) {
            let atual = '';
            try { atual = obterUrlAppsScriptGoogleDrive('expansoes'); } catch (e) { atual = ''; }
            const entradaUrl = await solicitarTextoAtnx({
                titulo: 'Corrigir URL do Apps Script de Expansões',
                mensagem: `A importação chegou no Atlas, mas a URL do Web App de Expansões parece antiga ou inacessível.

Erro técnico: ${erroOriginal?.message || String(erroOriginal || '')}

Cole a URL NOVA da implantação ativa do Apps Script de Expansões. Ela precisa terminar com /exec.`,
                label: 'URL /exec da implantação ativa',
                placeholder: 'https://script.google.com/macros/s/AKfy.../exec',
                valor: atual,
                obrigatorio: true,
                textoConfirmar: 'Salvar e tentar novamente'
            });
            if (!entradaUrl) return '';
            return salvarUrlAppsScriptGoogleDrive('expansoes', entradaUrl);
        }

        async function lerRespostaJsonGoogleDrive(resposta, mensagemErroJson) {
            const texto = await resposta.text();
            let resultado;
            try {
                resultado = JSON.parse(texto);
            } catch (e) {
                const previa = String(texto || '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 260);
                const status = resposta && resposta.status ? ` HTTP ${resposta.status}` : '';
                throw new Error((mensagemErroJson || 'O endpoint do Google Drive não retornou JSON válido.') + `${status}. Resposta recebida: ${previa || 'vazia'}`);
            }

            if (!resposta.ok || !resultado.success) {
                throw new Error(resultado?.error || resultado?.message || 'Erro ao comunicar com o Google Drive.');
            }

            return resultado;
        }

        async function chamarProxyGoogleDrive(payload, mensagemErroJson, timeoutMs = 360000) {
            if (!GOOGLE_DRIVE_PROXY_URL) {
                throw new Error('Proxy interno do Google Drive não configurado.');
            }

            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

            try {
                const resposta = await fetch(GOOGLE_DRIVE_PROXY_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload || {}),
                    redirect: 'follow',
                    signal: controller ? controller.signal : undefined
                });
                return await lerRespostaJsonGoogleDrive(resposta, mensagemErroJson);
            } catch (err) {
                if (err?.name === 'AbortError') {
                    throw new Error('Tempo limite excedido no proxy interno do Google Drive.');
                }
                throw err;
            } finally {
                if (timer) clearTimeout(timer);
            }
        }

        async function chamarAppsScriptDiretoGoogleDrive(payload, mensagemErroJson) {
            const url = obterUrlAppsScriptGoogleDrive(payload?.modulo || 'documentacao', payload?.appsScriptUrlOverride || payload?.appsScriptUrl);

            const resposta = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(payload || {}),
                redirect: 'follow'
            });

            return await lerRespostaJsonGoogleDrive(resposta, mensagemErroJson || 'O Apps Script não retornou JSON válido. Verifique a implantação do Web App correto do módulo.');
        }


        async function chamarAppsScriptJsonpGoogleDrive(payload, mensagemErroJson, timeoutMs = 360000) {
            const url = obterUrlAppsScriptGoogleDrive(payload?.modulo || 'documentacao', payload?.appsScriptUrlOverride || payload?.appsScriptUrl);
            const callbackName = 'ATNX_JSONP_' + Date.now() + '_' + Math.random().toString(36).slice(2);

            return await new Promise((resolve, reject) => {
                let finalizado = false;
                const script = document.createElement('script');
                const limpar = () => {
                    if (finalizado) return;
                    finalizado = true;
                    clearTimeout(timer);
                    try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
                    if (script && script.parentNode) script.parentNode.removeChild(script);
                };

                const timer = setTimeout(() => {
                    limpar();
                    reject(new Error('Tempo limite excedido ao chamar o Apps Script de Expansões diretamente.'));
                }, timeoutMs);

                window[callbackName] = resultado => {
                    limpar();
                    if (!resultado || resultado.success === false) {
                        reject(new Error(resultado?.error || resultado?.message || mensagemErroJson || 'Erro retornado pelo Apps Script de Expansões.'));
                        return;
                    }
                    resolve(resultado);
                };

                try {
                    const target = new URL(url);
                    target.searchParams.set('callback', callbackName);
                    Object.entries(payload || {}).forEach(([key, value]) => {
                        if (value === undefined || value === null) return;
                        if (typeof value === 'object') {
                            target.searchParams.set(key, JSON.stringify(value));
                        } else {
                            target.searchParams.set(key, String(value));
                        }
                    });
                    script.onerror = () => {
                        limpar();
                        reject(new Error('Não foi possível carregar o Apps Script de Expansões direto por JSONP. Confira se GOOGLE_DRIVE_EXPANSOES_UPLOAD_URL aponta para a implantação /exec atual.'));
                    };
                    script.src = target.toString();
                    document.head.appendChild(script);
                } catch (err) {
                    limpar();
                    reject(err);
                }
            });
        }

        async function enviarImagemParaGoogleDrive(file, subId, campo, contextoOpcional) {
            // Documentação usa Web App próprio, publicado pela conta dona do Drive de Documentação.
            obterUrlAppsScriptGoogleDrive('documentacao');

            const tamanhoMb = file.size / 1024 / 1024;
            if (tamanhoMb > LIMITE_UPLOAD_MB) {
                throw new Error(`Arquivo muito grande. Limite atual: ${LIMITE_UPLOAD_MB} MB.`);
            }

            const contexto = contextoOpcional || encontrarContextoSubelemento(subId);
            if (!contexto || !contexto.obra) {
                throw new Error('Não foi possível identificar a obra, ativo e porta para organizar a pasta no Drive.');
            }

            const base64 = await converterArquivoParaBase64(file);

            const payload = {
                nomeArquivo: file.name,
                mimeType: file.type || 'application/octet-stream',
                base64,
                obraId: contexto.obra.id,
                obraNome: contexto.obra.nome,
                elementoId: contexto.elemento.id,
                elementoNome: contexto.elemento.nome,
                elementoTipo: contexto.elemento.tipo,
                subelementoId: contexto.subelemento.id,
                subelementoNome: contexto.subelemento.nome,
                modulo: 'documentacao',
                rootFolderId: GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID,
                tipoMidia: campo
            };

            return await chamarEndpointGoogleDrive(payload, 'O endpoint do Google Drive não retornou JSON válido no upload individual.');
        }


        async function enviarImagensParaGoogleDriveEmLote(arquivos, subId, campo, contextoOpcional) {
            if (!Array.isArray(arquivos) || arquivos.length === 0) return [];
            obterUrlAppsScriptGoogleDrive('documentacao');

            const contexto = contextoOpcional || encontrarContextoSubelemento(subId);
            if (!contexto || !contexto.obra) {
                throw new Error('Não foi possível identificar a obra, ativo e porta para organizar a pasta no Drive.');
            }

            const arquivosPayload = [];
            for (const file of arquivos) {
                const tamanhoMb = file.size / 1024 / 1024;
                if (tamanhoMb > LIMITE_UPLOAD_MB) {
                    throw new Error(`Arquivo muito grande: ${file.name}. Limite atual: ${LIMITE_UPLOAD_MB} MB.`);
                }
                arquivosPayload.push({
                    nomeArquivo: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    base64: await converterArquivoParaBase64(file)
                });
            }

            const payload = {
                action: 'uploadBatch',
                arquivos: arquivosPayload,
                obraId: contexto.obra.id,
                obraNome: contexto.obra.nome,
                elementoId: contexto.elemento.id,
                elementoNome: contexto.elemento.nome,
                elementoTipo: contexto.elemento.tipo,
                subelementoId: contexto.subelemento.id,
                subelementoNome: contexto.subelemento.nome,
                modulo: 'documentacao',
                rootFolderId: GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID,
                tipoMidia: campo
            };

            const resultado = await chamarEndpointGoogleDrive(payload, 'O endpoint do Google Drive não retornou JSON válido no upload em lote. Verifique se o Apps Script foi atualizado.');
            return Array.isArray(resultado.arquivos) ? resultado.arquivos : [];
        }

        async function fazerUploadMidia(subId, campo) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;

            input.onchange = async e => {
                const arquivosOriginais = Array.from(e.target.files || []);
                if (arquivosOriginais.length === 0) return;

                try {
                    exibirStatusTemporario(`📤 Otimizando ${arquivosOriginais.length} imagem(ns)...`, 'bg-[#0073ea]');

                    const { data, error: erroBusca } = await supabaseClient
                        .from('subelementos')
                        .select(campo)
                        .eq('id', subId)
                        .single();

                    if (erroBusca) throw erroBusca;

                    const listaAtual = normalizarListaMidias(data && data[campo] ? data[campo] : []);
                    const contextoUpload = encontrarContextoSubelemento(subId);
                    const arquivosOtimizado = [];

                    for (let i = 0; i < arquivosOriginais.length; i++) {
                        exibirStatusTemporario(`📤 Otimizando imagem ${i + 1}/${arquivosOriginais.length}...`, 'bg-[#0073ea]');
                        arquivosOtimizado.push(await otimizarImagemParaUpload(arquivosOriginais[i]));
                    }

                    const novasMidias = [];
                    const tamanhoLote = 4;
                    let enviadas = 0;

                    for (let inicio = 0; inicio < arquivosOtimizado.length; inicio += tamanhoLote) {
                        const lote = arquivosOtimizado.slice(inicio, inicio + tamanhoLote);
                        const originaisLote = arquivosOriginais.slice(inicio, inicio + tamanhoLote);
                        exibirStatusTemporario(`📤 Enviando lote ${Math.floor(inicio / tamanhoLote) + 1}/${Math.ceil(arquivosOtimizado.length / tamanhoLote)}...`, 'bg-[#0073ea]');

                        let resultadosLote = [];
                        try {
                            resultadosLote = await enviarImagensParaGoogleDriveEmLote(lote, subId, campo, contextoUpload);
                        } catch (batchErr) {
                            console.warn('Upload em lote falhou; usando envio individual sequencial:', batchErr);
                            resultadosLote = [];
                            for (let j = 0; j < lote.length; j++) {
                                resultadosLote.push(await enviarImagemParaGoogleDrive(lote[j], subId, campo, contextoUpload));
                            }
                        }

                        resultadosLote.forEach((resultadoDrive, j) => {
                            const original = originaisLote[j] || lote[j];
                            const arquivoOtimizado = lote[j];
                            if (!resultadoDrive || !resultadoDrive.fileId) return;
                            novasMidias.push({
                                nome: original.name,
                                nomeUpload: arquivoOtimizado.name,
                                tamanhoOriginal: original.size,
                                tamanhoUpload: arquivoOtimizado.size,
                                url: resultadoDrive.url,
                                thumbnailUrl: resultadoDrive.thumbnailUrl || resultadoDrive.url,
                                viewUrl: resultadoDrive.viewUrl || resultadoDrive.url,
                                fileId: resultadoDrive.fileId,
                                folderId: resultadoDrive.folderId,
                                folderIds: resultadoDrive.folderIds || {},
                                origem: 'atnx_upload',
                                importado: false,
                                criadoPeloAtnx: true,
                                tipo: campo,
                                criadoEm: new Date().toISOString()
                            });
                        });

                        enviadas += resultadosLote.filter(r => r && r.fileId).length;
                        exibirStatusTemporario(`📤 Enviando imagens... ${enviadas}/${arquivosOriginais.length}`, 'bg-[#0073ea]');
                    }

                    if (novasMidias.length === 0) {
                        throw new Error('Nenhuma imagem foi enviada ao Google Drive.');
                    }

                    const { error } = await supabaseClient
                        .from('subelementos')
                        .update({ [campo]: [...listaAtual, ...novasMidias] })
                        .eq('id', subId);

                    if (error) throw error;

                    const faltantes = arquivosOriginais.length - novasMidias.length;
                    exibirStatusTemporario(
                        faltantes > 0
                            ? `⚠️ ${novasMidias.length} imagem(ns) enviada(s). ${faltantes} não retornaram ID do Drive.`
                            : `✅ ${novasMidias.length} imagem(ns) enviada(s) e registrada(s).`,
                        faltantes > 0 ? 'bg-amber-600' : 'bg-emerald-600'
                    );
                    await inicializarBanco();
                } catch(err) {
                    console.error(err);
                    exibirStatusTemporario('⚠️ Erro no upload: ' + err.message, 'bg-red-600');
                    await alertaVisualAtnx('Erro no upload', err.message);
                }
            };

            input.click();
        }

        async function excluirArquivoNoGoogleDrive(fileId, modulo = 'documentacao') {
            if (!fileId) return;
            obterUrlAppsScriptGoogleDrive(modulo);

            const rootFolderId = modulo === 'expansoes' ? GOOGLE_DRIVE_EXPANSOES_FOLDER_ID : GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID;
            await chamarEndpointGoogleDrive({ action: 'delete', fileId, modulo, rootFolderId }, 'O endpoint do Google Drive não retornou JSON válido ao excluir a imagem.');
        }

        async function excluirArquivosNoGoogleDrive(fileIds, modulo = 'documentacao') {
            const ids = [...new Set((fileIds || []).filter(Boolean).map(String))];
            if (ids.length === 0) return { success: true, deletedCount: 0 };
            if (ids.length === 1) {
                await excluirArquivoNoGoogleDrive(ids[0], modulo);
                return { success: true, deletedCount: 1 };
            }

            obterUrlAppsScriptGoogleDrive(modulo);

            const rootFolderId = modulo === 'expansoes' ? GOOGLE_DRIVE_EXPANSOES_FOLDER_ID : GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID;
            return await chamarEndpointGoogleDrive({ action: 'deleteFiles', fileIds: ids, modulo, rootFolderId }, 'O endpoint do Google Drive não retornou JSON válido ao excluir imagens em lote.');
        }

        function extrairMidiasSubelemento(subelemento) {
            if (!subelemento) return [];
            return [
                ...normalizarListaMidias(subelemento.fotos),
                ...normalizarListaMidias(subelemento.diagramas)
            ].filter(Boolean);
        }

        function extrairMidiasElemento(elemento) {
            if (!elemento || !Array.isArray(elemento.subelementos)) return [];
            return elemento.subelementos.flatMap(sub => extrairMidiasSubelemento(sub));
        }


        function ehIdImportadoDoDrive(id) {
            return String(id || '').includes('-drive-');
        }

        function ehMidiaImportadaDoDrive(midia) {
            if (!midia) return false;
            const origem = String(midia.origem || '').toLowerCase();
            if (origem.includes('importado')) return true;
            if (midia.importado === true || midia.importada === true) return true;

            // Algumas versões antigas guardavam `caminho` também em uploads novos.
            // Por isso o caminho só indica importação quando a origem não informa que foi criado pelo Atlas.
            if (!origem && midia.caminho && midia.folderIds) return true;
            return false;
        }

        function ehMidiaCriadaPeloAtnxNoDrive(midia) {
            if (!midia || !midia.fileId) return false;
            return !ehMidiaImportadaDoDrive(midia);
        }

        function coletarMidiasCriadasPeloAtnxNoDrive(tipo, contexto) {
            let midias = [];

            if (tipo === 'obra') {
                midias = (contexto?.elementos || []).flatMap(extrairMidiasElemento);
            } else if (tipo === 'elemento') {
                midias = extrairMidiasElemento(contexto?.elemento);
            } else if (tipo === 'subelemento') {
                midias = extrairMidiasSubelemento(contexto?.subelemento);
            }

            return midias.filter(ehMidiaCriadaPeloAtnxNoDrive);
        }

        async function excluirMidiasCriadasPeloAtnxNoDrive(tipo, contexto) {
            const midias = coletarMidiasCriadasPeloAtnxNoDrive(tipo, contexto);
            const fileIds = midias.map(m => m.fileId).filter(Boolean);
            if (fileIds.length === 0) return 0;
            const resultado = await excluirArquivosNoGoogleDrive(fileIds);
            return Number(resultado.deletedCount || fileIds.length || 0);
        }

        function subelementoEhImportadoDoDrive(subelemento) {
            if (!subelemento) return false;
            if (ehIdImportadoDoDrive(subelemento.id)) return true;
            return extrairMidiasSubelemento(subelemento).some(ehMidiaImportadaDoDrive);
        }

        function elementoEhImportadoDoDrive(elemento) {
            if (!elemento) return false;
            if (ehIdImportadoDoDrive(elemento.id)) return true;
            if (extrairMidiasElemento(elemento).some(ehMidiaImportadaDoDrive)) return true;
            return Array.isArray(elemento.subelementos) && elemento.subelementos.some(subelementoEhImportadoDoDrive);
        }

        function devePreservarDriveAoExcluirEntidade(tipo, contexto) {
            if (tipo === 'obra') {
                if (ehIdImportadoDoDrive(contexto?.obra?.id)) return true;
                return (contexto?.elementos || []).some(elementoEhImportadoDoDrive);
            }

            if (tipo === 'elemento') {
                return elementoEhImportadoDoDrive(contexto?.elemento);
            }

            if (tipo === 'subelemento') {
                return subelementoEhImportadoDoDrive(contexto?.subelemento);
            }

            return false;
        }

        function obterFolderIdPorNivel(midia, nivel) {
            if (!midia) return '';

            const folderIds = midia.folderIds || midia.pastas || {};
            const mapa = {
                obra: ['obraFolderId', 'obra', 'pastaObraId'],
                tipo: ['tipoFolderId', 'tipo', 'pastaTipoId'],
                elemento: ['elementoFolderId', 'elemento', 'pastaElementoId'],
                subelemento: ['subelementoFolderId', 'subelemento', 'pastaSubelementoId'],
                midia: ['midiaFolderId', 'midia', 'pastaMidiaId']
            };

            for (const chave of (mapa[nivel] || [])) {
                if (folderIds[chave]) return folderIds[chave];
                if (midia[chave]) return midia[chave];
            }

            if (nivel === 'midia' && midia.folderId) return midia.folderId;
            return '';
        }

        function montarPayloadExclusaoPastaDrive(tipo, contexto) {
            let midias = [];
            let path = {};

            if (tipo === 'obra') {
                midias = (contexto.elementos || []).flatMap(el => extrairMidiasElemento(el));
                path = { obraNome: contexto.obra?.nome || '' };
            }

            if (tipo === 'elemento') {
                midias = extrairMidiasElemento(contexto.elemento);
                path = {
                    obraNome: contexto.obra?.nome || '',
                    elementoTipo: contexto.elemento?.tipo || '',
                    elementoNome: contexto.elemento?.nome || ''
                };
            }

            if (tipo === 'subelemento') {
                midias = extrairMidiasSubelemento(contexto.subelemento);
                path = {
                    obraNome: contexto.obra?.nome || '',
                    elementoTipo: contexto.elemento?.tipo || '',
                    elementoNome: contexto.elemento?.nome || '',
                    subelementoNome: contexto.subelemento?.nome || ''
                };
            }

            const folderId = midias.map(midia => obterFolderIdPorNivel(midia, tipo)).find(Boolean) || '';
            const fileIds = [...new Set(midias.map(midia => midia.fileId).filter(Boolean))];

            return {
                action: 'deleteFolder',
                modulo: 'documentacao',
                rootFolderId: GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID,
                targetType: tipo,
                folderId,
                fileIds,
                path
            };
        }

        async function excluirPastaNoGoogleDrive(payload) {
            obterUrlAppsScriptGoogleDrive(payload?.modulo || 'documentacao');

            return await chamarEndpointGoogleDrive(payload, 'O endpoint do Google Drive não retornou JSON válido ao excluir a pasta.');
        }

        async function excluirPastaEntidadeNoGoogleDrive(tipo, contexto) {
            const payload = montarPayloadExclusaoPastaDrive(tipo, contexto);

            if (!payload.folderId && (!payload.fileIds || payload.fileIds.length === 0) && !payload.path?.obraNome) {
                return { success: true, skipped: true, message: 'Sem referência de pasta no Drive para excluir.' };
            }

            return await excluirPastaNoGoogleDrive(payload);
        }


        async function chamarEndpointGoogleDrive(payload, mensagemErroJson) {
            const erros = [];

            // 1ª rota: proxy interno no mesmo domínio do Atlas. É a forma mais compatível entre navegadores,
            // porque o Opera GX e outros bloqueadores não enxergam mais script.google.com como script/terceiro.
            if (GOOGLE_DRIVE_PROXY_URL) {
                try {
                    return await chamarProxyGoogleDrive(payload, mensagemErroJson);
                } catch (proxyErr) {
                    erros.push('Proxy interno: ' + (proxyErr?.message || String(proxyErr)));
                    console.warn('Proxy interno do Drive falhou; tentando Apps Script direto:', proxyErr);
                }
            }

            // 2ª rota: fallback antigo. Mantém compatibilidade caso o pacote seja publicado em ambiente sem _worker.js.
            try {
                return await chamarAppsScriptDiretoGoogleDrive(payload, mensagemErroJson);
            } catch (diretoErr) {
                const detalhe = [diretoErr?.message || String(diretoErr), ...erros].filter(Boolean).join(' | ');
                throw new Error(detalhe || 'Erro ao comunicar com o Google Drive.');
            }
        }

        function criarIdImportado(prefixo, valor) {
            const base = String(valor || `${Date.now()}-${Math.random()}`)
                .replace(/[^a-zA-Z0-9_-]/g, '')
                .slice(0, 72);
            return `${prefixo}-drive-${base}`;
        }

        function compararNome(a, b) {
            return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
        }

        async function buscarObraPorNome(nome) {
            const local = state.obras.find(o => compararNome(o.nome, nome));
            if (local) return local;

            const { data, error } = await supabaseClient
                .from('obras')
                .select('*')
                .ilike('nome', String(nome || '').trim())
                .limit(1);

            if (error) throw error;
            return data && data.length ? data[0] : null;
        }

        async function buscarElementoPorNome(obraId, tipo, nome) {
            const { data, error } = await supabaseClient
                .from('elementos_principais')
                .select('*')
                .eq('obra_id', obraId)
                .eq('tipo', tipo)
                .ilike('nome', String(nome || '').trim())
                .limit(1);

            if (error) throw error;
            return data && data.length ? data[0] : null;
        }

        async function buscarSubelementoPorNome(paiId, nome) {
            const { data, error } = await supabaseClient
                .from('subelementos')
                .select('*')
                .eq('pai_id', paiId)
                .ilike('nome', String(nome || '').trim())
                .limit(1);

            if (error) throw error;
            return data && data.length ? data[0] : null;
        }

        async function obterOuCriarObraImportada(obra, resumo) {
            const nome = String(obra?.nome || '').trim();
            if (!nome) throw new Error('A pasta de obra importada não possui nome.');

            const existente = await buscarObraPorNome(nome);
            if (existente) return existente.id;

            const id = criarIdImportado('obra', obra.folderId);
            const { error } = await supabaseClient
                .from('obras')
                .insert([{ id, nome }]);

            if (error) throw error;
            resumo.obrasCriadas += 1;
            return id;
        }

        async function obterOuCriarElementoImportado(obraId, elemento, resumo) {
            const nome = String(elemento?.nome || '').trim();
            const tipo = ['POP', 'CEO', 'CTO'].includes(String(elemento?.tipo || '').toUpperCase())
                ? String(elemento.tipo).toUpperCase()
                : state.abaAtiva;

            if (!nome) throw new Error('Uma pasta de ativo importada está sem nome.');

            const existente = await buscarElementoPorNome(obraId, tipo, nome);
            if (existente) return existente.id;

            const id = criarIdImportado('el', elemento.folderId);
            const { error } = await supabaseClient
                .from('elementos_principais')
                .insert([{
                    id,
                    obra_id: obraId,
                    nome,
                    tipo,
                    status: 'Não iniciado',
                    data: obterDataHojeISO(),
                    tecnico: 'Não Atribuído'
                }]);

            if (error) throw error;
            resumo.elementosCriados += 1;
            return id;
        }

        function mesclarMidiasImportadas(listaExistente, listaImportada, resumo) {
            const existentes = normalizarListaMidias(listaExistente);
            const importadas = normalizarListaMidias(listaImportada);
            const fileIds = new Set(existentes.map(m => m && m.fileId).filter(Boolean));
            const assinaturas = new Set(existentes.map(m => `${m?.nome || ''}|${m?.url || ''}`));
            const resultado = [...existentes];

            importadas.forEach(midia => {
                if (!midia) return;
                const assinatura = `${midia.nome || ''}|${midia.url || ''}`;
                if ((midia.fileId && fileIds.has(midia.fileId)) || assinaturas.has(assinatura)) return;

                resultado.push({
                    nome: midia.nome || 'Imagem importada',
                    url: midia.url || '',
                    thumbnailUrl: midia.thumbnailUrl || midia.url || '',
                    viewUrl: midia.viewUrl || midia.url || '',
                    fileId: midia.fileId || '',
                    folderId: midia.folderId || '',
                    folderIds: midia.folderIds || {},
                    origem: midia.origem || 'google_drive_importado',
                    criadoEm: midia.criadoEm || new Date().toISOString(),
                    caminho: midia.caminho || ''
                });

                if (midia.fileId) fileIds.add(midia.fileId);
                assinaturas.add(assinatura);
                resumo.midiasAdicionadas += 1;
            });

            return resultado;
        }

        async function obterOuAtualizarSubelementoImportado(paiId, subelemento, resumo) {
            const nome = String(subelemento?.nome || '').trim();
            if (!nome) throw new Error('Uma pasta de porta/subelemento importada está sem nome.');

            const existente = await buscarSubelementoPorNome(paiId, nome);
            const fotosImportadas = normalizarListaMidias(subelemento.fotos);
            const diagramasImportados = normalizarListaMidias(subelemento.diagramas);

            if (existente) {
                const fotos = mesclarMidiasImportadas(existente.fotos, fotosImportadas, resumo);
                const diagramas = mesclarMidiasImportadas(existente.diagramas, diagramasImportados, resumo);

                const { error } = await supabaseClient
                    .from('subelementos')
                    .update({ fotos, diagramas })
                    .eq('id', existente.id);

                if (error) throw error;
                return existente.id;
            }

            const resumoAntes = resumo.midiasAdicionadas;
            const fotos = mesclarMidiasImportadas([], fotosImportadas, resumo);
            const diagramas = mesclarMidiasImportadas([], diagramasImportados, resumo);
            const id = criarIdImportado('sub', subelemento.folderId);

            const { error } = await supabaseClient
                .from('subelementos')
                .insert([{
                    id,
                    pai_id: paiId,
                    nome,
                    status: 'Não iniciado',
                    sinal: '---',
                    data: obterDataHojeISO(),
                    tecnico: 'Não Atribuído',
                    fotos,
                    diagramas
                }]);

            if (error) throw error;
            resumo.subelementosCriados += 1;
            resumo.midiasAdicionadas = Math.max(resumo.midiasAdicionadas, resumoAntes + fotos.length + diagramas.length);
            return id;
        }

        function contarEstruturaDrive(resultado) {
            const obras = Array.isArray(resultado?.obras) ? resultado.obras : [];
            const total = { obras: obras.length, elementos: 0, subelementos: 0, midias: 0 };

            obras.forEach(obra => {
                normalizarListaMidias(obra.elementos).forEach(elemento => {
                    total.elementos += 1;
                    normalizarListaMidias(elemento.subelementos).forEach(sub => {
                        total.subelementos += 1;
                        total.midias += normalizarListaMidias(sub.fotos).length + normalizarListaMidias(sub.diagramas).length;
                    });
                });
            });

            return total;
        }

        async function registrarEstruturaDriveNoSupabase(resultado) {
            const obras = Array.isArray(resultado?.obras) ? resultado.obras : [];
            const resumo = {
                obrasCriadas: 0,
                elementosCriados: 0,
                subelementosCriados: 0,
                midiasAdicionadas: 0
            };

            let primeiraObraId = '';

            for (const obra of obras) {
                const obraId = await obterOuCriarObraImportada(obra, resumo);
                if (!primeiraObraId) primeiraObraId = obraId;

                for (const elemento of normalizarListaMidias(obra.elementos)) {
                    const elementoId = await obterOuCriarElementoImportado(obraId, elemento, resumo);

                    for (const subelemento of normalizarListaMidias(elemento.subelementos)) {
                        await obterOuAtualizarSubelementoImportado(elementoId, subelemento, resumo);
                    }
                }
            }

            return { ...resumo, primeiraObraId };
        }


        // ==============================
        // Atlas V1.3.5 — Importação de Obras de Expansões por link de Drive externo
        // ==============================
        function gerarIdImportacaoExpansao(prefixo, valor) {
            return `${prefixo}-imp-${String(valor || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 72)}-${Math.random().toString(36).slice(2, 6)}`;
        }

        function normalizarArquivoDriveParaExpansao(item, campo = 'fotos', indice = 0) {
            const normalizado = campo === 'kmz'
                ? normalizarArquivoExpansao(item, 'kmz', indice)
                : normalizarMidiaExpansao(item, indice);
            if (!normalizado) return null;
            return {
                ...normalizado,
                origem: normalizado.origem || 'drive_terceiros_importado',
                importado: true,
                criadoPeloAtnx: false,
                preservadoNoDriveOriginal: true,
                tipo: normalizado.tipo || (campo === 'kmz' ? 'kmz' : 'imagens')
            };
        }

        function serializarListaDriveExpansao(lista, campo = 'fotos') {
            const normalizados = (Array.isArray(lista) ? lista : [])
                .map((item, indice) => normalizarArquivoDriveParaExpansao(item, campo, indice))
                .filter(Boolean);
            if (campo === 'kmz') return serializarArquivosExpansao(normalizados, 'kmz');
            return serializarMidiasExpansao(normalizados);
        }

        function contarEstruturaObrasExpansoesDrive(resultado) {
            const obras = Array.isArray(resultado?.expansoesObras) ? resultado.expansoesObras : [];
            const total = { obras: obras.length, elementos: 0, subelementos: 0, arquivos: 0 };
            obras.forEach(obra => {
                (obra.elementos || []).forEach(el => {
                    total.elementos += 1;
                    total.arquivos += Array.isArray(el.kmz) ? el.kmz.length : 0;
                    total.arquivos += Array.isArray(el.fotos) ? el.fotos.length : 0;
                    (el.subelementos || []).forEach(sub => {
                        total.subelementos += 1;
                        total.arquivos += Array.isArray(sub.fotos) ? sub.fotos.length : 0;
                        total.arquivos += Array.isArray(sub.diagrama_fusao) ? sub.diagrama_fusao.length : 0;
                    });
                });
            });
            return total;
        }

        async function buscarElementoExpansaoImportado(obraNome, fase, nome) {
            const { data, error } = await supabaseClient
                .from('atlas_expansoes')
                .select('*')
                .eq('obra_nome', obraNome)
                .eq('fase', fase)
                .ilike('nome', String(nome || '').trim())
                .limit(1);
            if (error) throw error;
            return data && data.length ? data[0] : null;
        }

        async function buscarSubitemExpansaoImportado(expansaoId, nome) {
            const { data, error } = await supabaseClient
                .from('atlas_expansoes_subitems')
                .select('*')
                .eq('expansao_id', expansaoId)
                .ilike('nome', String(nome || '').trim())
                .limit(1);
            if (error) throw error;
            return data && data.length ? data[0] : null;
        }

        function mesclarJsonMidiasExpansao(valorAtual, novas, campo = 'fotos') {
            const atuais = campo === 'kmz' ? normalizarArquivosExpansao(valorAtual, 'kmz') : normalizarMidiasExpansao(valorAtual);
            const importadas = (Array.isArray(novas) ? novas : [])
                .map((item, indice) => normalizarArquivoDriveParaExpansao(item, campo, atuais.length + indice))
                .filter(Boolean);
            const todas = [...atuais, ...importadas];
            return campo === 'kmz' ? serializarArquivosExpansao(todas, 'kmz') : serializarMidiasExpansao(todas);
        }

        async function obterOuCriarElementoObraExpansaoImportado(obraNome, elemento, resumo) {
            const nome = String(elemento?.nome || '').trim();
            if (!nome) return null;
            const fase = normalizarFaseObraExpansao(elemento?.fase || 'fusoes', nome);
            const existente = await buscarElementoExpansaoImportado(obraNome, fase, nome);
            const kmz = mesclarJsonMidiasExpansao(existente?.kmz, elemento.kmz || [], 'kmz');
            const fotosOlt = mesclarJsonMidiasExpansao(existente?.fotos_olt || existente?.imagens, elemento.fotos || [], 'fotos');
            if (existente) {
                const patch = { updated_at: new Date().toISOString() };
                if (kmz) patch.kmz = kmz;
                if (fotosOlt) patch.fotos_olt = fotosOlt;
                const { error } = await supabaseClient.from('atlas_expansoes').update(patch).eq('id', existente.id);
                if (error) throw error;
                return existente.id;
            }
            const id = gerarIdImportacaoExpansao('exp', elemento.folderId || `${obraNome}-${nome}`);
            const payload = {
                id,
                obra_nome: obraNome,
                fase,
                grupo: obterGrupoPadraoPorFaseExpansao(fase),
                nome,
                status: fase === 'homologacao_final' || fase === 'kmz' ? null : 'Em Progresso',
                kmz: kmz || null,
                fotos_olt: fotosOlt || null,
                updated_at: new Date().toISOString()
            };
            const { error } = await supabaseClient.from('atlas_expansoes').insert([payload]);
            if (error) throw error;
            resumo.elementosCriados += 1;
            return id;
        }

        async function obterOuAtualizarSubitemObraExpansaoImportado(expansaoId, subitem, resumo) {
            const nome = String(subitem?.nome || '').trim();
            if (!nome) return null;
            const existente = await buscarSubitemExpansaoImportado(expansaoId, nome);
            const fotos = mesclarJsonMidiasExpansao(existente?.fotos, subitem.fotos || [], 'fotos');
            const diagramas = mesclarJsonMidiasExpansao(existente?.diagrama_fusao, subitem.diagrama_fusao || subitem.diagramas || [], 'fotos');
            if (existente) {
                const { error } = await supabaseClient
                    .from('atlas_expansoes_subitems')
                    .update({ fotos: fotos || null, diagrama_fusao: diagramas || null, updated_at: new Date().toISOString() })
                    .eq('id', existente.id);
                if (error) throw error;
                return existente.id;
            }
            const id = gerarIdImportacaoExpansao('subexp', subitem.folderId || `${expansaoId}-${nome}`);
            const { error } = await supabaseClient.from('atlas_expansoes_subitems').insert([{
                id,
                expansao_id: expansaoId,
                nome,
                status: 'Em Progresso',
                fotos: fotos || null,
                diagrama_fusao: diagramas || null,
                data: obterDataHojeISO(),
                responsavel: null,
                updated_at: new Date().toISOString()
            }]);
            if (error) throw error;
            resumo.subelementosCriados += 1;
            return id;
        }

        async function registrarObrasExpansoesImportadasNoSupabase(resultado) {
            const obras = Array.isArray(resultado?.expansoesObras) ? resultado.expansoesObras : [];
            const resumo = { obrasCriadas: 0, elementosCriados: 0, subelementosCriados: 0, arquivosReferenciados: 0, primeiraObraNome: '' };
            for (const obra of obras) {
                const obraNome = String(obra?.nome || '').trim();
                if (!obraNome) continue;
                if (!resumo.primeiraObraNome) resumo.primeiraObraNome = obraNome;
                const jaExistia = (state.expansoes || []).some(p => ehElementoObraExpansao(p) && obterObraNomeExpansao(p) === obraNome);
                if (!jaExistia) resumo.obrasCriadas += 1;
                for (const elemento of (obra.elementos || [])) {
                    resumo.arquivosReferenciados += (elemento.kmz || []).length + (elemento.fotos || []).length;
                    const expansaoId = await obterOuCriarElementoObraExpansaoImportado(obraNome, elemento, resumo);
                    if (!expansaoId) continue;
                    for (const sub of (elemento.subelementos || [])) {
                        resumo.arquivosReferenciados += (sub.fotos || []).length + (sub.diagrama_fusao || sub.diagramas || []).length;
                        await obterOuAtualizarSubitemObraExpansaoImportado(expansaoId, sub, resumo);
                    }
                }
            }
            return resumo;
        }

        async function importarObraExpansoesPorLinkDrive() {
            const entrada = await solicitarTextoAtnx({
                titulo: 'Importar obra de Expansões pelo Drive',
                mensagem: 'Cole o link da pasta compartilhada de terceiros. O Atlas vai criar a obra e salvar apenas links/metadados. Os arquivos continuam no Drive original.',
                label: 'Link da pasta do Google Drive',
                placeholder: 'https://drive.google.com/drive/folders/...',
                obrigatorio: true,
                textoConfirmar: 'Importar'
            });
            if (!entrada) return;
            try {
                exibirStatusTemporario('☁️ Lendo pasta externa de Expansões...', 'bg-[#0073ea]');
                const payloadImportacao = {
                    modulo: 'expansoes',
                    action: 'importarExpansoesObras',
                    folderUrl: entrada.trim(),
                    folderId: entrada.trim(),
                    driveLink: entrada.trim(),
                    externalFolderUrl: entrada.trim(),
                    estrutura: 'expansoes_obras_por_link',
                    preservarDriveOriginal: true
                };

                let resultado;
                let erroProxy = null;
                try {
                    resultado = await chamarProxyGoogleDrive(payloadImportacao, 'Não foi possível ler a pasta externa de Expansões pelo proxy interno.', 360000);
                } catch (errProxy) {
                    erroProxy = errProxy;
                    console.warn('Proxy de Drive falhou. Tentando Apps Script direto por JSONP:', errProxy);
                    exibirStatusTemporario('☁️ Proxy não respondeu JSON. Tentando Apps Script direto...', 'bg-amber-600');
                    try {
                        resultado = await chamarAppsScriptJsonpGoogleDrive(payloadImportacao, 'Não foi possível ler a pasta externa de Expansões pelo Apps Script direto.', 360000);
                    } catch (errDireto) {
                        console.warn('Apps Script direto falhou. Solicitando URL /exec atual de Expansões:', errDireto);
                        const novaUrl = await solicitarUrlAppsScriptExpansoesAtual(errDireto);
                        if (!novaUrl) {
                            throw new Error('Falha na importação de Expansões. Proxy: ' + (erroProxy?.message || String(erroProxy)) + ' | Direto: ' + (errDireto?.message || String(errDireto)));
                        }
                        const payloadRetry = { ...payloadImportacao, appsScriptUrlOverride: novaUrl };
                        try {
                            resultado = await chamarAppsScriptJsonpGoogleDrive(payloadRetry, 'Não foi possível ler a pasta externa de Expansões pelo Apps Script direto com a URL corrigida.', 360000);
                        } catch (errRetry) {
                            const urlTeste = montarUrlGoogleDriveJsonp(payloadRetry, 'ATNX_TESTE', true);
                            resultado = await solicitarColagemJsonpDrive(urlTeste, errRetry);
                            if (!resultado) {
                                throw new Error('Falha na importação de Expansões. Proxy: ' + (erroProxy?.message || String(erroProxy)) + ' | Direto: ' + (errDireto?.message || String(errDireto)) + ' | URL corrigida: ' + (errRetry?.message || String(errRetry)));
                            }
                        }
                    }
                }
                const total = contarEstruturaObrasExpansoesDrive(resultado);
                if (!total.obras || !total.elementos) {
                    throw new Error('Nenhuma obra/elemento foi encontrado. Estrutura esperada: Pasta raiz / Obra / Elemento / Fotos / imagens. Exemplo: FOTOS EXECUÇÃO BNDS / Bananeiras_PB / 144FO-BNN-R1-CD1 / Fotos.');
                }
                const ok = await confirmarVisualAtnx('Importar obra de Expansões', `Encontrado no Drive externo:\n\n• ${total.obras} obra(s)\n• ${total.elementos} elemento(s)\n• ${total.subelementos} subelemento(s)\n• ${total.arquivos} arquivo(s) referenciado(s)\n\nOs arquivos serão preservados no Drive original. Deseja criar/atualizar os registros no Atlas?`, 'Importar');
                if (!ok) return;
                exibirStatusTemporario('☁️ Criando referências no Atlas...', 'bg-[#0073ea]');
                const resumo = await registrarObrasExpansoesImportadasNoSupabase(resultado);
                if (resumo.primeiraObraNome) {
                    state.expansoesVisualizacao = 'obras';
                    state.expansoesObraAtiva = resumo.primeiraObraNome;
                }
                await registrarAuditoria('importação', 'expansao_obra', resumo.primeiraObraNome, resumo.primeiraObraNome, 'drive_externo', '', entrada, 'Importação por link de Drive externo; arquivos preservados no Drive original');
                exibirStatusTemporario(`✅ Importação concluída: ${resumo.obrasCriadas} obra(s), ${resumo.elementosCriados} elemento(s), ${resumo.subelementosCriados} subelemento(s).`, 'bg-emerald-600');
                await carregarExpansoes();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao importar Drive de Expansões: ' + (err.message || String(err)), 'bg-red-600');
                await alertaVisualAtnx('Erro ao importar Drive de Expansões', `${err.message || String(err)}

Checklist rápido:
1) A URL do Apps Script de Expansões precisa ser a implantação ativa que termina em /exec.
2) Se aparecer a janela para corrigir a URL, cole a URL /exec nova da implantação V16/V17/V18 do Apps Script.
3) A pasta externa precisa estar compartilhada com a conta proprietária do Apps Script.
4) O proxy /api/drive é opcional nesta versão; a importação funciona direto por JSONP.`);
            }
        }


        function limparPayloadGoogleDrive(payload) {
            const limpo = {};
            Object.entries(payload || {}).forEach(([key, value]) => {
                if (value === undefined || value === null) return;
                const texto = String(value).trim();
                if (texto === '') return;
                limpo[key] = texto;
            });
            return limpo;
        }

        function obterPastaRaizPadraoDriveAtnx() {
            return GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_URL || (GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID ? `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID}` : '');
        }

        function obterPastaDriveExpansoesAtnx() {
            return GOOGLE_DRIVE_EXPANSOES_FOLDER_URL || (GOOGLE_DRIVE_EXPANSOES_FOLDER_ID ? `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_EXPANSOES_FOLDER_ID}` : '');
        }

        function obterPastaDrivePadraoModuloAtivo() {
            return state.moduloAtivo === 'expansoes' ? obterPastaDriveExpansoesAtnx() : obterPastaRaizPadraoDriveAtnx();
        }

        function abrirDriveExpansoes(event) {
            if (event) event.stopPropagation();
            const url = obterPastaDriveExpansoesAtnx();
            if (!url) {
                exibirStatusTemporario('⚠️ Pasta de Expansões não configurada.', 'bg-amber-600');
                return;
            }
            window.open(url, '_blank', 'noopener,noreferrer');
        }

        async function copiarLinkDriveExpansoes(event) {
            if (event) event.stopPropagation();
            const url = obterPastaDriveExpansoesAtnx();
            if (!url) {
                exibirStatusTemporario('⚠️ Pasta de Expansões não configurada.', 'bg-amber-600');
                return;
            }
            try {
                await navigator.clipboard.writeText(url);
                exibirStatusTemporario('✅ Link do Drive de Expansões copiado.', 'bg-emerald-600');
            } catch (err) {
                abrirDriveExpansoes(event);
            }
        }

        function extrairIdPastaDriveEntrada(valor) {
            const texto = String(valor || '').trim();
            if (!texto) return '';
            const matchFolder = texto.match(/\/folders\/([a-zA-Z0-9_-]+)/);
            if (matchFolder) return matchFolder[1];
            const matchId = texto.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (matchId) return matchId[1];
            const matchSolto = texto.match(/^[a-zA-Z0-9_-]{20,}$/);
            return matchSolto ? matchSolto[0] : '';
        }

        function montarUrlGoogleDriveJsonp(payload, callbackName = 'ATNX_TESTE', incluirCache = false) {
            const params = new URLSearchParams();
            params.set('callback', callbackName);
            Object.entries(limparPayloadGoogleDrive(payload)).forEach(([key, value]) => params.set(key, value));
            if (incluirCache) params.set('_', Date.now().toString());
            const urlModulo = obterUrlAppsScriptGoogleDrive(payload?.modulo || state.moduloAtivo || 'documentacao', payload?.appsScriptUrlOverride || payload?.appsScriptUrl);
            const separador = urlModulo.includes('?') ? '&' : '?';
            return urlModulo + separador + params.toString();
        }

        function extrairObjetoDeRetornoJsonp(texto) {
            const bruto = String(texto || '').trim();
            if (!bruto) throw new Error('Nenhum retorno foi colado.');

            if (bruto.startsWith('{')) {
                return JSON.parse(bruto);
            }

            const inicio = bruto.indexOf('(');
            const fim = bruto.lastIndexOf(')');
            if (inicio < 0 || fim <= inicio) {
                throw new Error('O retorno colado não parece ser JSONP. Ele precisa começar com ATNX_TESTE(...).');
            }

            const json = bruto.slice(inicio + 1, fim).trim().replace(/;\s*$/, '');
            return JSON.parse(json);
        }

        function solicitarColagemJsonpDrive(urlTeste, erroOriginal) {
            return new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.className = 'atnx-modal-overlay';
                overlay.innerHTML = `<div class="atnx-modal-card atnx-modal-card-wide" role="dialog" aria-modal="true">
                    <div class="atnx-modal-header">
                        <div>
                            <div class="atnx-modal-title">Importação do Drive — modo seguro</div>
                            <div class="atnx-modal-subtitle">O navegador bloqueou a leitura automática por JSONP. Abra o teste, copie o retorno completo e cole abaixo para o Atlas importar mesmo assim.</div>
                        </div>
                        <button type="button" class="atnx-modal-close" data-cancel>✕</button>
                    </div>
                    <div class="atnx-drive-fallback-box">
                        <div class="atnx-drive-fallback-alert">
                            Detalhe técnico: ${escaparHtml(erroOriginal?.message || String(erroOriginal || 'falha no JSONP'))}
                        </div>
                        <label class="atnx-form-field atnx-form-field-full">
                            <span>URL de teste</span>
                            <textarea class="atnx-drive-url" readonly>${escaparHtml(urlTeste)}</textarea>
                        </label>
                        <div class="atnx-drive-fallback-actions-inline">
                            <button type="button" class="atnx-btn-secondary" data-copy>Copiar URL</button>
                            <button type="button" class="atnx-btn-primary" data-open>Abrir teste em nova aba</button>
                        </div>
                        <label class="atnx-form-field atnx-form-field-full">
                            <span>Cole aqui o retorno que começa com ATNX_TESTE( ... )</span>
                            <textarea class="atnx-drive-jsonp-input" placeholder="ATNX_TESTE({&quot;success&quot;:true,...});"></textarea>
                        </label>
                        <div class="atnx-form-error" data-error></div>
                    </div>
                    <div class="atnx-modal-actions">
                        <button type="button" class="atnx-btn-secondary" data-cancel>Cancelar</button>
                        <button type="button" class="atnx-btn-primary" data-import>Usar retorno colado</button>
                    </div>
                </div>`;
                document.body.appendChild(overlay);

                const finalizar = valor => {
                    removerModalAtnx(overlay);
                    resolve(valor);
                };

                const textarea = overlay.querySelector('.atnx-drive-jsonp-input');
                const urlTextarea = overlay.querySelector('.atnx-drive-url');
                const erro = overlay.querySelector('[data-error]');
                overlay.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', () => finalizar(null)));
                overlay.querySelector('[data-open]')?.addEventListener('click', () => window.open(urlTeste, '_blank', 'noopener,noreferrer'));
                overlay.querySelector('[data-copy]')?.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(urlTeste);
                        exibirStatusTemporario('URL de teste copiada.', 'bg-emerald-600');
                    } catch (e) {
                        urlTextarea?.focus();
                        urlTextarea?.select();
                    }
                });
                overlay.querySelector('[data-import]')?.addEventListener('click', () => {
                    try {
                        const obj = extrairObjetoDeRetornoJsonp(textarea.value);
                        if (!obj || obj.success === false) {
                            throw new Error((obj && obj.error) || 'O retorno colado informou falha.');
                        }
                        finalizar(obj);
                    } catch (e) {
                        erro.textContent = e.message || String(e);
                    }
                });
                overlay.addEventListener('click', e => {
                    if (e.target === overlay) finalizar(null);
                });
                setTimeout(() => textarea?.focus(), 80);
            });
        }

        function chamarEndpointGoogleDriveJsonp(payload, mensagemErro, timeoutMs = 240000) {
            try {
                obterUrlAppsScriptGoogleDrive(payload?.modulo || state.moduloAtivo || 'documentacao', payload?.appsScriptUrlOverride || payload?.appsScriptUrl);
            } catch (err) {
                return Promise.reject(err);
            }

            const executarTentativa = (payloadTentativa, callbackName, indiceTentativa, incluirCache = false) => new Promise((resolve, reject) => {
                const script = document.createElement('script');
                let encerrado = false;
                let timer = null;

                const finalizar = (fn, valor) => {
                    if (encerrado) return;
                    encerrado = true;
                    clearTimeout(timer);
                    // Não remove instantaneamente: alguns navegadores disparam eventos do script depois de executar o callback.
                    setTimeout(() => {
                        try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
                        if (script.parentNode) script.parentNode.removeChild(script);
                    }, 250);
                    fn(valor);
                };

                window[callbackName] = (resultado) => {
                    if (!resultado || resultado.success === false) {
                        finalizar(reject, new Error((resultado && resultado.error) || mensagemErro || 'Erro ao ler a pasta do Google Drive.'));
                        return;
                    }
                    finalizar(resolve, resultado);
                };

                timer = setTimeout(() => {
                    finalizar(reject, new Error('Tempo limite excedido ao ler a pasta do Google Drive. Teste com uma pasta menor ou divida a importação em partes.'));
                }, timeoutMs);

                script.async = true;
                script.onerror = () => {
                    // Em alguns ambientes o evento de erro chega antes do callback do Apps Script.
                    // Aguarda um pouco antes de considerar a tentativa perdida.
                    setTimeout(() => {
                        if (!encerrado) {
                            finalizar(reject, new Error('Falha ao carregar o retorno JSONP do Apps Script.'));
                        }
                    }, 1800);
                };

                script.src = montarUrlGoogleDriveJsonp(payloadTentativa, callbackName, incluirCache);
                (document.head || document.body || document.documentElement).appendChild(script);
            });

            const base = limparPayloadGoogleDrive(payload || {});
            const folderEntrada = base.folderUrl || base.folderId || '';
            const folderId = extrairIdPastaDriveEntrada(folderEntrada);
            const tentativas = [];

            if (String(base.action || '').toLowerCase().includes('scan') || String(base.action || '').toLowerCase().includes('sync')) {
                // Primeira tentativa replica o teste manual que funcionou no navegador: callback=ATNX_TESTE&action=scanfolder&folderUrl=...
                tentativas.push({ payload: { action: 'scanfolder', folderUrl: folderEntrada }, callback: 'ATNX_TESTE', cache: false });
                if (folderId) tentativas.push({ payload: { action: 'scanfolder', folderId }, callback: 'ATNX_TESTE_ID', cache: false });
                tentativas.push({ payload: { ...base, action: 'scan_folder' }, callback: 'ATNX_SCAN_FOLDER', cache: true });
                tentativas.push({ payload: { ...base, action: 'syncdrive' }, callback: 'ATNX_SYNC_DRIVE', cache: true });
            } else {
                tentativas.push({ payload: base, callback: 'ATNX_TESTE', cache: false });
            }

            return tentativas.reduce((promise, tentativa, index) => {
                return promise.catch(() => executarTentativa(tentativa.payload, tentativa.callback || ('ATNX_IMPORT_DRIVE_' + index), index + 1, tentativa.cache));
            }, Promise.reject()).catch(err => {
                throw new Error((mensagemErro || 'Falha ao chamar o Apps Script por JSONP.') + ' Detalhe: ' + err.message);
            });
        }

        async function importarPastaDrive() {
            const pastaModuloAtual = obterPastaDrivePadraoModuloAtivo();
            const nomeModuloDrive = state.moduloAtivo === 'expansoes' ? 'Expansões' : 'Documentação Rede Geral';
            const entrada = await solicitarTextoAtnx({
                titulo: 'Reconhecer pasta do Google Drive',
                mensagem: `Cole o link ou ID da pasta. Para usar a pasta configurada de ${nomeModuloDrive}, deixe em branco e clique em Reconhecer.`,
                label: 'Link ou ID da pasta',
                placeholder: pastaModuloAtual || 'https://drive.google.com/drive/folders/...',
                value: '',
                textoConfirmar: 'Reconhecer'
            });
            if (entrada === null) return;

            try {
                exibirStatusTemporario('☁️ Lendo estrutura do Google Drive...', 'bg-[#0073ea]');

                const entradaLimpa = entrada.trim();
                const pastaRaizPadrao = pastaModuloAtual || obterPastaRaizPadraoDriveAtnx();
                const payloadLeituraDrive = {
                    action: 'scanfolder',
                    folderUrl: entradaLimpa || pastaRaizPadrao
                };

                let resultado;
                try {
                    // Primeiro tenta pelo proxy interno do Cloudflare, que é independente do navegador.
                    resultado = await chamarProxyGoogleDrive(payloadLeituraDrive, 'Erro ao ler a pasta do Google Drive.', 240000);
                } catch (erroProxy) {
                    console.warn('Proxy interno do Drive falhou; tentando JSONP direto:', erroProxy);
                    try {
                        resultado = await chamarEndpointGoogleDriveJsonp(payloadLeituraDrive, 'Erro ao ler a pasta do Google Drive.');
                    } catch (erroJsonp) {
                        const urlTeste = montarUrlGoogleDriveJsonp(payloadLeituraDrive, 'ATNX_TESTE', false);
                        resultado = await solicitarColagemJsonpDrive(urlTeste, erroJsonp);
                        if (!resultado) throw new Error((erroJsonp?.message || 'Falha no JSONP') + ' | Proxy interno: ' + (erroProxy?.message || String(erroProxy)));
                    }
                }

                const total = contarEstruturaDrive(resultado);
                if (total.obras === 0) {
                    throw new Error('Nenhuma estrutura válida foi encontrada. Use: Obra / POP-CEO-CTO / Ativo / Foto-Diagrama ou Obra / POP-CEO-CTO / Ativo / Subelemento / Foto-Diagrama.');
                }

                const confirmar = await confirmarVisualAtnx('Importar estrutura do Drive', `O Atlas encontrou no Google Drive:

• ${total.obras} obra(s)
• ${total.elementos} ativo(s)
• ${total.subelementos} porta(s)/subelemento(s)
• ${total.midias} imagem(ns)

Deseja importar/reconhecer essa estrutura no site?`, 'Importar');

                if (!confirmar) {
                    exibirStatusTemporario('Importação cancelada.', 'bg-amber-600');
                    return;
                }

                exibirStatusTemporario('☁️ Registrando estrutura do Drive no Supabase...', 'bg-[#0073ea]');
                const resumo = await registrarEstruturaDriveNoSupabase(resultado);

                if (resumo.primeiraObraId) {
                    state.obraAtiva = resumo.primeiraObraId;
                }

                exibirStatusTemporario(`✅ Drive sincronizado: ${resumo.obrasCriadas} obra(s), ${resumo.elementosCriados} ativo(s), ${resumo.subelementosCriados} porta(s) e ${resumo.midiasAdicionadas} imagem(ns) nova(s).`, 'bg-emerald-600');
                await inicializarBanco();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao reconhecer pasta do Drive: ' + err.message, 'bg-red-600');
                await alertaVisualAtnx('Erro ao reconhecer pasta do Drive', err.message + '\n\nTeste recomendado: abra a URL /exec?callback=ATNX_TESTE no navegador e depois force Ctrl+F5 no Atlas.');
            }
        }

        async function carregarEstruturaCompletaObra(obraId) {
            const obra = state.obras.find(o => o.id === obraId) || { id: obraId, nome: '' };

            const { data: elementos, error: erroElementos } = await supabaseClient
                .from('elementos_principais')
                .select('*')
                .eq('obra_id', obraId)
                .order('created_at', { ascending: true });

            if (erroElementos) throw erroElementos;

            const idsElementos = (elementos || []).map(el => el.id);
            let subelementos = [];

            if (idsElementos.length > 0) {
                const { data: subs, error: erroSubs } = await supabaseClient
                    .from('subelementos')
                    .select('*')
                    .in('pai_id', idsElementos)
                    .order('created_at', { ascending: true });

                if (erroSubs) throw erroSubs;
                subelementos = subs || [];
            }

            return {
                obra,
                elementos: (elementos || []).map(el => ({
                    ...el,
                    subelementos: subelementos.filter(sub => sub.pai_id === el.id)
                }))
            };
        }

        async function excluirMidia(subId, campo, index, e) {
            if (e) e.stopPropagation();

            try {
                const { data, error: erroBusca } = await supabaseClient
                    .from('subelementos')
                    .select(campo)
                    .eq('id', subId)
                    .single();

                if (erroBusca) throw erroBusca;

                const listaAtual = normalizarListaMidias(data && data[campo] ? data[campo] : []);
                const midia = listaAtual[index];

                if (!midia) {
                    throw new Error('Imagem não encontrada no registro. Atualize a página e tente novamente.');
                }

                const nome = midia.nome || midia.name || 'esta imagem';
                const midiaImportada = ehMidiaImportadaDoDrive(midia);
                const mensagem = midiaImportada
                    ? `Remover ${nome} apenas do site?\n\nO arquivo original importado será preservado no Google Drive.`
                    : `Excluir ${nome}?\n\nA referência será removida do site e o arquivo criado pelo Atlas será enviado para a lixeira do Google Drive.`;

                const confirmado = await confirmarVisualAtnx('Remover imagem', mensagem, 'Remover');
                if (!confirmado) return;

                exibirStatusTemporario('🗑️ Removendo imagem...', 'bg-[#0073ea]');

                if (midia.fileId && !midiaImportada) {
                    await excluirArquivoNoGoogleDrive(midia.fileId);
                }

                listaAtual.splice(index, 1);

                const { error } = await supabaseClient
                    .from('subelementos')
                    .update({ [campo]: listaAtual })
                    .eq('id', subId);

                if (error) throw error;

                exibirStatusTemporario(
                    midiaImportada
                        ? '✅ Imagem removida do site. Arquivo preservado no Google Drive.'
                        : '✅ Imagem excluída do Google Drive e removida do site.',
                    'bg-emerald-600'
                );
                await inicializarBanco();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao excluir imagem: ' + err.message, 'bg-red-600');
                await alertaVisualAtnx('Erro ao excluir imagem', err.message);
            }
        }

        async function excluirSubelemento(subId) {
            const contexto = encontrarContextoSubelemento(subId);
            const nomeSub = contexto?.subelemento?.nome || 'esta porta/subelemento';

            const confirmado = await confirmarVisualAtnx('Remover porta/subelemento', `Remover ${nomeSub} do site?

Itens importados do Google Drive serão preservados no Drive. A exclusão remove apenas os registros do Atlas/Supabase.`, 'Remover');
            if (!confirmado) return;

            try {
                exibirStatusTemporario('🗑️ Removendo porta/subelemento do site...', 'bg-[#0073ea]');

                const preservarDrive = devePreservarDriveAoExcluirEntidade('subelemento', contexto);
                let avisoDrive = '';

                try {
                    const removidos = await excluirMidiasCriadasPeloAtnxNoDrive('subelemento', contexto);
                    if (removidos > 0) avisoDrive += ` ${removidos} arquivo(s) criado(s) pelo Atlas foram removidos do Drive.`;
                } catch (driveErr) {
                    console.warn('Falha ao remover arquivos novos criados pelo Atlas:', driveErr);
                    avisoDrive += ' Alguns arquivos novos podem não ter sido removidos do Drive.';
                }

                if (contexto && !preservarDrive) {
                    try {
                        exibirStatusTemporario('🗑️ Removendo porta/subelemento do site e tentando limpar a pasta no Drive...', 'bg-[#0073ea]');
                        await excluirPastaEntidadeNoGoogleDrive('subelemento', contexto);
                        avisoDrive += ' Pasta criada pelo Atlas enviada para a lixeira do Drive.';
                    } catch (driveErr) {
                        console.warn('A porta/subelemento será removida do site, mas a pasta do Drive não foi alterada:', driveErr);
                        avisoDrive += ' A pasta do Drive não foi alterada.';
                    }
                } else if (preservarDrive) {
                    avisoDrive += ' Conteúdo importado via link foi preservado no Google Drive.';
                }

                const { error } = await supabaseClient.from('subelementos').delete().eq('id', subId);
                if (error) throw error;

                exibirStatusTemporario('✅ Porta/subelemento removido do site.' + avisoDrive, 'bg-emerald-600');
                await inicializarBanco();
            } catch(err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao excluir porta/subelemento: ' + err.message, 'bg-red-600');
                await alertaVisualAtnx('Erro ao excluir porta/subelemento', err.message);
            }
        }

        async function selecionarObra(id) {
            if (!id || id === state.obraAtiva) return;

            const token = ++tokenCarregamentoObra;
            state.obraAtiva = id;
            state.selecionados = { elementos: {}, subelementos: {} };

            if (state.cacheElementosPorObra[id]) {
                state.elementos = state.cacheElementosPorObra[id];
                state.carregandoObra = false;
                renderApp();
            } else {
                state.elementos = [];
                state.carregandoObra = true;
                renderApp();
            }

            try {
                const elementosAtualizados = await carregarElementosDaObra(id, { usarCache: false, salvarNoState: false });
                if (token === tokenCarregamentoObra && state.obraAtiva === id) {
                    state.elementos = elementosAtualizados;
                    state.carregandoObra = false;
                    renderApp();
                }
            } catch (err) {
                console.error(err);
                if (token === tokenCarregamentoObra && state.obraAtiva === id) {
                    state.carregandoObra = false;
                    renderApp();
                    exibirStatusTemporario('⚠️ Erro ao abrir obra: ' + err.message, 'bg-red-600');
                }
            }
        }
        function selecionarAba(aba) { state.abaAtiva = aba; renderApp(); }
        function toggleLinhaExpansion(id) { state.linhasExpandidas[id] = !state.linhasExpandidas[id]; renderApp(); }

        function idsElementosFiltrados() {
            return state.elementos
                .filter(el => el.tipo === state.abaAtiva && String(el.nome || '').toLowerCase().includes(state.termoPesquisa.toLowerCase()))
                .map(el => el.id);
        }

        function subIdsDoElemento(elemento) {
            return (elemento?.subelementos || []).map(sub => sub.id);
        }

        function elementoSelecionado(id) {
            return !!state.selecionados.elementos[id];
        }

        function subelementoSelecionado(id) {
            return !!state.selecionados.subelementos[id];
        }

        function definirSelecaoElemento(elementoId, marcado, incluirSubs = true) {
            if (marcado) state.selecionados.elementos[elementoId] = true;
            else delete state.selecionados.elementos[elementoId];

            if (incluirSubs) {
                const elemento = state.elementos.find(el => el.id === elementoId);
                subIdsDoElemento(elemento).forEach(subId => {
                    if (marcado) state.selecionados.subelementos[subId] = true;
                    else delete state.selecionados.subelementos[subId];
                });
            }
        }

        function atualizarSelecaoPaiAPartirDosSubs(elementoId) {
            const elemento = state.elementos.find(el => el.id === elementoId);
            const subIds = subIdsDoElemento(elemento);
            if (subIds.length > 0 && subIds.every(id => subelementoSelecionado(id))) {
                state.selecionados.elementos[elementoId] = true;
            } else {
                delete state.selecionados.elementos[elementoId];
            }
        }

        function toggleSelecaoElemento(elementoId, marcado) {
            definirSelecaoElemento(elementoId, marcado, true);
            renderApp();
        }

        function toggleSelecaoSubelemento(elementoId, subId, marcado) {
            if (marcado) state.selecionados.subelementos[subId] = true;
            else delete state.selecionados.subelementos[subId];
            atualizarSelecaoPaiAPartirDosSubs(elementoId);
            renderApp();
        }

        function toggleSelecaoTodos(marcado) {
            idsElementosFiltrados().forEach(id => definirSelecaoElemento(id, marcado, true));
            renderApp();
        }

        function limparSelecoesInvalidas() {
            const idsElementosValidos = new Set(state.elementos.map(el => el.id));
            const idsSubsValidos = new Set(state.elementos.flatMap(el => subIdsDoElemento(el)));

            Object.keys(state.selecionados.elementos).forEach(id => {
                if (!idsElementosValidos.has(id)) delete state.selecionados.elementos[id];
            });
            Object.keys(state.selecionados.subelementos).forEach(id => {
                if (!idsSubsValidos.has(id)) delete state.selecionados.subelementos[id];
            });
        }

        function existeSelecaoAtiva() {
            return Object.keys(state.selecionados.elementos).length > 0 || Object.keys(state.selecionados.subelementos).length > 0;
        }

        function obterSelecaoParaStatus(idOrigem, tipoOrigem) {
            if (!existeSelecaoAtiva()) {
                if (tipoOrigem === 'pai') {
                    return { elementos: [idOrigem], subelementos: [] };
                }
                return { elementos: [], subelementos: [idOrigem] };
            }

            const elementos = new Set(Object.keys(state.selecionados.elementos));
            const subelementos = new Set(Object.keys(state.selecionados.subelementos));

            // Quando o ativo está selecionado, todos os seus subelementos acompanham o status.
            elementos.forEach(elementoId => {
                const elemento = state.elementos.find(el => el.id === elementoId);
                subIdsDoElemento(elemento).forEach(subId => subelementos.add(subId));
            });

            return { elementos: Array.from(elementos), subelementos: Array.from(subelementos) };
        }

        async function alterarStatusEmLote(statusFinal, selecao) {
            const atualizacoes = [];

            if (selecao.elementos.length > 0) {
                atualizacoes.push(
                    supabaseClient
                        .from('elementos_principais')
                        .update({ status: statusFinal })
                        .in('id', selecao.elementos)
                );
            }

            if (selecao.subelementos.length > 0) {
                atualizacoes.push(
                    supabaseClient
                        .from('subelementos')
                        .update({ status: statusFinal })
                        .in('id', selecao.subelementos)
                );
            }

            const resultados = await Promise.all(atualizacoes);
            const erro = resultados.find(r => r.error)?.error;
            if (erro) throw erro;
        }

        function aplicarStatusLocal(statusFinal, selecao) {
            const setElementos = new Set(selecao.elementos);
            const setSubs = new Set(selecao.subelementos);

            state.elementos.forEach(el => {
                if (setElementos.has(el.id)) el.status = statusFinal;
                (el.subelementos || []).forEach(sub => {
                    if (setSubs.has(sub.id)) sub.status = statusFinal;
                });
            });
        }

        async function alterarStatusComSelecao(tipoOrigem, idOrigem, novoStatus, selectEl) {
            const statusFinal = normalizarStatus(novoStatus);
            const selecao = obterSelecaoParaStatus(idOrigem, tipoOrigem);

            aplicarStatusNoSelect(selectEl, statusFinal, true);
            aplicarStatusLocal(statusFinal, selecao);
            renderApp();
            exibirStatusTemporario('💾 Salvando status selecionado...', 'bg-[#0073ea]');

            try {
                await alterarStatusEmLote(statusFinal, selecao);
                exibirStatusTemporario('✅ Status atualizado.', 'bg-emerald-600');
                await inicializarBanco();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao alterar status: ' + err.message, 'bg-red-600');
                await alertaVisualAtnx('Erro ao alterar status', err.message);
                await inicializarBanco();
            }
        }

        function atualizarSelecaoVisualCabecalho(totalFiltrados) {
            const checkTodos = document.getElementById('check-todos-elementos');
            if (!checkTodos) return;
            const ids = idsElementosFiltrados();
            const marcados = ids.filter(id => elementoSelecionado(id)).length;
            checkTodos.checked = totalFiltrados > 0 && marcados === totalFiltrados;
            checkTodos.indeterminate = marcados > 0 && marcados < totalFiltrados;
        }



        // ==============================
        // ATNX V1.1.4 — Documentação Rede Geral
        // ==============================
        const ADMIN_OBRAS_TABELA = 'admin_documentacoes';
        const ADMIN_STATUS = [
            { id: 'a_realizar', titulo: 'Documentações para ser realizada', cor: '#3b82f6' },
            { id: 'em_andamento', titulo: 'Documentações em Andamento', cor: '#f59e0b' },
            { id: 'parada', titulo: 'Obras Paradas', cor: '#ef4444' },
            { id: 'concluida', titulo: 'Documentação concluída', cor: '#10b981' }
        ];
        const ADMIN_STATUS_PARADA = { id: 'parada', titulo: 'Obras Paradas', cor: '#ef4444' };
        const ADMIN_STATUS_TODOS = ADMIN_STATUS;


        function normalizarStatusAdminValor(statusId, fallback = 'a_realizar') {
            return ADMIN_STATUS_TODOS.some(st => st.id === statusId) ? statusId : fallback;
        }

        function obterStatusCategoriaAdmin(item, categoria) {
            const campo = categoria === 'cto' ? 'ctos_status' : categoria === 'ceo' ? 'caixas_status' : 'pops_status';
            return normalizarStatusAdminValor(String(item?.[campo] ?? '').trim(), '');
        }

        function obterDatasCategoriaAdmin(item, categoria, opcoes = {}) {
            const prefixo = categoria === 'cto' ? 'ctos' : categoria === 'ceo' ? 'caixas' : 'pops';
            const inicioCategoria = item?.[`${prefixo}_data_inicio`] || null;
            const previsaoCategoria = item?.[`${prefixo}_data_previsao_final`] || null;
            if (opcoes.somenteCategoria) {
                return { inicio: inicioCategoria, previsao: previsaoCategoria };
            }
            const inicio = inicioCategoria || item?.data_inicio || null;
            const previsao = previsaoCategoria || item?.data_previsao_final || null;
            return { inicio, previsao };
        }

        function renderOpcoesStatusAdmin(statusAtual, permitirVazio = false) {
            const vazio = permitirVazio
                ? `<option value="" ${statusAtual === '' ? 'selected' : ''}></option>`
                : '';
            return vazio + ADMIN_STATUS_TODOS.map(st => `<option value="${st.id}" ${st.id === statusAtual ? 'selected' : ''}>${escaparHtml(st.titulo)}</option>`).join('');
        }

        function obterTituloStatusAdmin(statusAtual) {
            if (String(statusAtual ?? '').trim() === '') return '';
            const status = normalizarStatusAdminValor(statusAtual, '');
            const itemStatus = ADMIN_STATUS_TODOS.find(st => st.id === status) || ADMIN_STATUS_TODOS[0];
            return itemStatus?.titulo || '';
        }

        function chaveStatusAdminVisual(statusAtual) {
            if (String(statusAtual ?? '').trim() === '') return 'admin_vazio';
            const status = normalizarStatusAdminValor(statusAtual, '');
            if (status === 'concluida') return 'admin_concluida';
            if (status === 'em_andamento') return 'admin_em_andamento';
            if (status === 'parada') return 'admin_parada';
            return 'admin_a_realizar';
        }

        function classeStatusAdminSelect(statusAtual) {
            const status = String(statusAtual ?? '').trim() === '' ? '' : normalizarStatusAdminValor(statusAtual, '');
            return `atnx-admin-status-select status-${status} atnx-status-select-${chaveStatusAdminVisual(status)}`;
        }

        function renderizarSelectStatusAdmin(statusAtual, onchange, pequeno = false, permitirVazio = false) {
            const valorAtual = String(statusAtual ?? '').trim();
            const status = permitirVazio
                ? normalizarStatusAdminValor(valorAtual, '')
                : normalizarStatusAdminValor(valorAtual || 'a_realizar');
            const chave = chaveStatusAdminVisual(status);
            const classeTamanho = pequeno ? 'atnx-status-control-sm' : 'atnx-status-control-md';
            const classeSelect = pequeno ? 'atnx-admin-select-sm' : '';
            return `<span data-status-key="${chave}" class="atnx-status-control atnx-admin-status-control atnx-status-control-${chave} ${classeTamanho}">
                <span class="atnx-status-dot" aria-hidden="true"></span>
                <span class="atnx-status-label">${escaparHtml(obterTituloStatusAdmin(status))}</span>
                <select aria-label="Alterar status" data-status-key="${chave}" class="atnx-admin-select ${classeSelect} ${classeStatusAdminSelect(status)} atnx-status-native" onchange="${onchange}">${renderOpcoesStatusAdmin(status, permitirVazio)}</select>
                <span class="atnx-status-arrow" aria-hidden="true">▾</span>
            </span>`;
        }

        const SQL_ATLAS_SCHEMA_OFICIAL = 'supabase/ATLAS_V1_4_SCHEMA_OFICIAL.sql';

        function atualizarVisibilidadeModulos() {
            const admin = state.moduloAtivo === 'admin_obras';
            const adminVisualizacao = state.adminVisualizacao || 'status';
            const adminObrasInternas = admin && adminVisualizacao === 'obras';
            const executivo = false;
            const expansoes = state.moduloAtivo === 'expansoes';
            const expVisualizacao = state.expansoesVisualizacao || 'tabela';
            const expObrasInternas = expansoes && expVisualizacao === 'obras';
            const pmo = state.moduloAtivo === 'pmo';
            const adminCentral = state.moduloAtivo === 'admin_central';
            const manutencaoRedes = admin && adminVisualizacao === 'manutencao_redes';
            const modoEspecial = (admin && !adminObrasInternas) || executivo || expansoes || pmo || manutencaoRedes || adminCentral;
            document.body?.classList.toggle('atnx-admin-mode', admin && !adminObrasInternas);
            document.body?.classList.toggle('atlas-expansoes-mode', expansoes);
            document.body?.classList.toggle('atlas-exp-projetos-scroll-mode', expansoes && expVisualizacao === 'tabela');
            document.body?.classList.toggle('atlas-pmo-mode', pmo);
            document.body?.classList.toggle('atlas-admin-central-mode', adminCentral);
            document.body?.classList.toggle('atlas-manutencao-mode', manutencaoRedes);
            document.body?.classList.toggle('atlas-executivo-mode', executivo);
            document.body?.classList.toggle('atnx-documentacao-obras-interna', adminObrasInternas);
            document.body?.classList.toggle('atlas-expansoes-obras-interna', expObrasInternas);
            const painelDoc = document.getElementById('painel-documentacao');
            const painelAdmin = document.getElementById('painel-admin-obras');
            const painelExecutivo = document.getElementById('painel-executivo');
            const painelExpansoes = document.getElementById('painel-expansoes');
            const painelPMO = document.getElementById('painel-pmo');
            const painelManutencao = document.getElementById('painel-manutencao-redes');
            const painelAdminCentral = document.getElementById('painel-admin-central');
            const painelAuditoria = document.getElementById('painel-auditoria');
            const tabs = document.getElementById('tabs-container');
            const btnAtivo = document.getElementById('btn-adicionar-ativo');
            const btnCidadeAdmin = document.getElementById('btn-adicionar-cidade-admin');
            const btnAdicionarExpansao = document.getElementById('btn-adicionar-expansao');
            const btnSnapshot = document.getElementById('btn-snapshot-semanal');
            const btnImportarDriveExpIcon = document.getElementById('btn-importar-drive-expansoes-icon');
            const btnImportarDriveSidebar = document.getElementById('btn-importar-drive-sidebar');
            const btnDoc = document.getElementById('btn-modulo-documentacao');
            const btnAdmin = document.getElementById('btn-modulo-admin-obras');
            const btnExpansoes = document.getElementById('btn-modulo-expansoes');
            const btnPMO = document.getElementById('btn-modulo-pmo');
            const btnAdminCentral = document.getElementById('btn-modulo-admin-central');
            const btnManutencao = document.getElementById('btn-modulo-manutencao-redes');
            const submenuAdmin = document.getElementById('submenu-admin-obras');
            const submenuExp = document.getElementById('submenu-expansoes');
            const submenuPMO = document.getElementById('submenu-pmo');
            const submenuManutencao = document.getElementById('submenu-manutencao-redes');
            const search = document.getElementById('search-input');
            const sidebarObrasSection = document.getElementById('sidebar-obras-section');
            const sidebarObrasTitle = document.getElementById('sidebar-obras-title');

            painelDoc?.classList.toggle('hidden', !adminObrasInternas && modoEspecial);
            painelAdmin?.classList.toggle('hidden', !admin || adminObrasInternas || manutencaoRedes);
            painelExpansoes?.classList.toggle('hidden', !expansoes);
            painelPMO?.classList.toggle('hidden', !pmo);
            painelManutencao?.classList.toggle('hidden', !manutencaoRedes);
            painelAdminCentral?.classList.toggle('hidden', !adminCentral);
            painelAuditoria?.classList.add('hidden');
            tabs?.classList.toggle('hidden', modoEspecial && !adminObrasInternas);
            if (tabs && modoEspecial && !adminObrasInternas) tabs.innerHTML = '';
            btnAtivo?.classList.toggle('hidden', modoEspecial && !adminObrasInternas);
            btnAtivo?.classList.toggle('flex', !modoEspecial || adminObrasInternas);
            btnCidadeAdmin?.classList.toggle('hidden', !admin || adminObrasInternas || manutencaoRedes);
            btnCidadeAdmin?.classList.toggle('flex', admin && !adminObrasInternas && !manutencaoRedes);
            btnAdicionarExpansao?.classList.toggle('hidden', !expansoes || expObrasInternas);
            btnAdicionarExpansao?.classList.toggle('flex', expansoes && !expObrasInternas);
            btnImportarDriveExpIcon?.classList.toggle('hidden', !expansoes || !expObrasInternas);
            btnImportarDriveExpIcon?.classList.toggle('flex', expansoes && expObrasInternas);
            btnImportarDriveSidebar?.classList.toggle('hidden', expansoes || pmo || manutencaoRedes || adminCentral || !atlasTemPermissao('anexar_arquivo'));
            const painelAtivo = admin && !adminObrasInternas && adminVisualizacao === 'painel';
            btnSnapshot?.classList.toggle('hidden', !painelAtivo);
            btnSnapshot?.classList.toggle('flex', painelAtivo);
            if (btnCidadeAdmin) btnCidadeAdmin.innerHTML = '➕ Cadastrar Cidade';
            const podeCriar = atlasTemPermissao('criar_registro');
            [btnAtivo, btnCidadeAdmin, btnAdicionarExpansao].forEach(btn => {
                if (!btn || podeCriar) return;
                btn.classList.add('hidden');
                btn.classList.remove('flex');
            });

            btnDoc?.classList.toggle('active', adminObrasInternas);
            btnAdmin?.classList.toggle('active', admin);
            btnExpansoes?.classList.toggle('active', expansoes);
            btnPMO?.classList.toggle('active', pmo);
            btnAdminCentral?.classList.toggle('active', adminCentral);
            btnAdminCentral?.classList.toggle('hidden', !atlasTemPermissao('gerenciar_usuarios') && !atlasTemPermissao('configurar_sistema'));
            btnManutencao?.classList.toggle('active', false);
            submenuAdmin?.classList.remove('hidden');
            submenuExp?.classList.remove('hidden');
            submenuPMO?.classList.remove('hidden');
            submenuManutencao?.classList.remove('hidden');
            submenuAdmin?.classList.toggle('is-open', admin);
            submenuExp?.classList.toggle('is-open', expansoes);
            submenuPMO?.classList.toggle('is-open', pmo);
            submenuManutencao?.classList.toggle('is-open', false);
            atualizarAtivoSidebarSubmodulos();

            const mostrarSidebarObras = adminObrasInternas || expObrasInternas;
            sidebarObrasSection?.classList.toggle('hidden', !mostrarSidebarObras);
            if (sidebarObrasTitle) sidebarObrasTitle.textContent = expObrasInternas ? 'Obras de Expansões' : 'Obras cadastradas';

            if (search) {
                search.placeholder = admin
                    ? (adminObrasInternas ? 'Pesquisar obra...' : (manutencaoRedes ? 'Pesquisar manutenção, cidade, CTO, CEO, poste...' : (adminVisualizacao === 'painel' ? 'Pesquisar no painel...' : 'Pesquisar cidade...')))
                    : expansoes
                        ? (expObrasInternas ? 'Pesquisar obra de expansão...' : 'Pesquisar expansão...')
                    : pmo
                            ? 'Pesquisar no PMO...'
                            : adminCentral
                                ? 'Pesquisar usuário ou campo...'
                                : 'Pesquisar...';
            }
        }

        function atualizarAtivoSidebarSubmodulos() {
            const adminAtivo = state.moduloAtivo === 'admin_obras';
            const expAtivo = state.moduloAtivo === 'expansoes';
            const pmoAtivo = state.moduloAtivo === 'pmo';
            const adminVisao = state.adminVisualizacao || 'status';
            const expVisao = state.expansoesVisualizacao || 'tabela';
            const pmoVisao = state.pmoVisualizacao || 'analise_novos_projetos';
            const manutencaoAtiva = adminAtivo && adminVisao === 'manutencao_redes';
            const mapaAdmin = { status: 'btn-sub-admin-status', gantt: 'btn-sub-admin-gantt', obras: 'btn-sub-admin-obras', painel: 'btn-sub-admin-painel', manutencao_redes: 'btn-sub-admin-manutencao-redes' };
            const mapaExp = { tabela: 'btn-sub-exp-projetos', gantt: 'btn-sub-exp-gantt', obras: 'btn-sub-exp-obras' };
            const mapaPMO = { analise_novos_projetos: 'btn-sub-pmo-analise' };
            Object.entries(mapaAdmin).forEach(([visao, id]) => document.getElementById(id)?.classList.toggle('active', adminAtivo && adminVisao === visao));
            Object.entries(mapaExp).forEach(([visao, id]) => document.getElementById(id)?.classList.toggle('active', expAtivo && expVisao === visao));
            Object.entries(mapaPMO).forEach(([visao, id]) => document.getElementById(id)?.classList.toggle('active', pmoAtivo && pmoVisao === visao));
            document.getElementById('btn-sub-manutencao-redes')?.classList.toggle('active', manutencaoAtiva);
        }

        async function definirSubmoduloAdmin(tipo) {
            state.moduloAtivo = 'admin_obras';
            state.adminVisualizacao = ['status', 'gantt', 'obras', 'painel', 'manutencao_redes'].includes(tipo) ? tipo : 'status';
            if (state.adminVisualizacao !== 'gantt') state.adminGanttFullscreen = false;
            atualizarVisibilidadeModulos();
            if (state.adminVisualizacao === 'manutencao_redes') {
                if ((state.manutencoesRede || []).length === 0 && !state.manutencaoRedeCarregando) await carregarManutencoesRede();
                else renderManutencaoRedes();
                return;
            }
            if (state.adminVisualizacao === 'obras') {
                renderApp();
                return;
            }
            if (state.adminObras.length === 0 && !state.adminCarregando) await carregarAdminObras();
            else if (state.adminVisualizacao === 'painel') await carregarDadosExecutivo();
            else renderAdminObras();
        }

        async function definirSubmoduloExpansoes(tipo) {
            state.moduloAtivo = 'expansoes';
            state.expansoesVisualizacao = ['tabela', 'gantt', 'obras'].includes(tipo) ? tipo : 'tabela';
            atualizarVisibilidadeModulos();
            if (state.expansoes.length === 0 && !state.expansoesCarregando) await carregarExpansoes();
            else renderExpansoes();
            if (state.expansoesVisualizacao === 'gantt') setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        async function definirSubmoduloPMO(tipo) {
            state.moduloAtivo = 'pmo';
            state.pmoVisualizacao = ['analise_novos_projetos'].includes(tipo) ? tipo : 'analise_novos_projetos';
            atualizarVisibilidadeModulos();
            if ((state.pmoProjetos || []).length === 0 && !state.pmoCarregando) await carregarPMO();
            else renderPMO();
        }

        function criarNovoItemSidebar() {
            if (!atlasTemPermissao('criar_registro')) {
                exigirPermissaoAtlas('criar_registro', 'criar registros');
                return;
            }
            const admin = state.moduloAtivo === 'admin_obras';
            const exp = state.moduloAtivo === 'expansoes';
            const pmo = state.moduloAtivo === 'pmo';
            const manutencaoRedes = admin && (state.adminVisualizacao || 'status') === 'manutencao_redes';
            if (admin && (state.adminVisualizacao || 'status') === 'obras') return criarNovaObra();
            if (manutencaoRedes) return criarManutencaoRedeRapida();
            if (exp && (state.expansoesVisualizacao || 'tabela') === 'obras') return criarObraExpansoes();
            if (admin) return abrirCadastroCidadeAdmin();
            if (exp) return alternarFormularioExpansaoInline();
            if (pmo) return abrirFormularioPMO();
            return criarNovaObra();
        }

        async function alternarModulo(modulo) {
            if (modulo === 'admin_central') {
                if (!atlasTemPermissao('gerenciar_usuarios') && !atlasTemPermissao('configurar_sistema')) {
                    await exigirPermissaoAtlas('configurar_sistema', 'abrir a Central de Administração');
                    return;
                }
                state.moduloAtivo = 'admin_central';
                atualizarVisibilidadeModulos();
                await carregarAdminCentral();
                return;
            }
            if (modulo === 'documentacao') {
                state.moduloAtivo = 'admin_obras';
                state.adminVisualizacao = 'obras';
            } else if (modulo === 'manutencao_redes') {
                return definirSubmoduloAdmin('manutencao_redes');
            } else {
                const modulosValidos = ['admin_obras', 'expansoes', 'pmo', 'admin_central'];
                state.moduloAtivo = modulosValidos.includes(modulo) ? modulo : 'admin_obras';
                if (state.moduloAtivo === 'admin_obras' && (state.adminVisualizacao || '') === 'obras') state.adminVisualizacao = 'status';
            }
            atualizarVisibilidadeModulos();

            if (state.moduloAtivo === 'admin_obras') {
                if ((state.adminVisualizacao || 'status') === 'obras') {
                    renderApp();
                    return;
                }
                if (state.adminObras.length === 0 && !state.adminCarregando) await carregarAdminObras();
                else renderApp();
                return;
            }
            if (state.moduloAtivo === 'expansoes') {
                await carregarExpansoes();
                return;
            }
            if (state.moduloAtivo === 'pmo') {
                if ((state.pmoProjetos || []).length === 0 && !state.pmoCarregando) await carregarPMO();
                else renderPMO();
                return;
            }
            if (state.moduloAtivo === 'admin_central') {
                await carregarAdminCentral();
                return;
            }
            renderApp();
        }

        let pmoSearchTimer = 0;

        function handleSearch(valor) {
            state.termoPesquisa = String(valor || '');
            if (state.moduloAtivo === 'expansoes') renderExpansoes();
            else if (state.moduloAtivo === 'admin_obras' && (state.adminVisualizacao || 'status') === 'manutencao_redes') renderManutencaoRedes();
            else if (state.moduloAtivo === 'admin_central') renderAdminCentral();
            else if (state.moduloAtivo === 'pmo') {
                clearTimeout(pmoSearchTimer);
                pmoSearchTimer = setTimeout(() => {
                    const estavaNaBusca = document.activeElement && document.activeElement.id === 'input-pmo-search';
                    const posicao = estavaNaBusca ? Number(document.activeElement.selectionStart || state.termoPesquisa.length) : state.termoPesquisa.length;
                    renderPMO();
                    if (estavaNaBusca) {
                        requestAnimationFrame(() => {
                            const input = document.getElementById('input-pmo-search');
                            if (!input) return;
                            input.focus({ preventScroll: true });
                            try { input.setSelectionRange(posicao, posicao); } catch (err) {}
                        });
                    }
                }, 180);
            }
            else renderApp();
        }

        function normalizarNumeroAdmin(valor) {
            const n = Number(String(valor ?? '0').replace(',', '.'));
            return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
        }

        function valorDataAdmin(valor, fallback = '') {
            if (!valor) return fallback;
            return converterDataParaInput(valor);
        }

        function valorTextoAdmin(valor, fallback = '') {
            return String(valor ?? fallback ?? '').trim();
        }

        function criarInputAdmin({ label, name, type = 'text', value = '', placeholder = '', min = '', required = false }) {
            return `<label class="atnx-form-field">
                <span>${escaparHtml(label)}</span>
                <input name="${escaparHtml(name)}" type="${escaparHtml(type)}" value="${escaparHtml(value)}" placeholder="${escaparHtml(placeholder)}" ${min !== '' ? `min="${escaparHtml(min)}"` : ''} ${required ? 'required' : ''}>
            </label>`;
        }

        function criarTextareaAdmin({ label, name, value = '', placeholder = '' }) {
            return `<label class="atnx-form-field atnx-form-field-full">
                <span>${escaparHtml(label)}</span>
                <textarea name="${escaparHtml(name)}" placeholder="${escaparHtml(placeholder)}">${escaparHtml(value)}</textarea>
            </label>`;
        }

        function removerModalAtnx(overlay) {
            if (!overlay) return;
            overlay.classList.add('atnx-modal-saindo');
            setTimeout(() => overlay.remove(), 120);
        }

        function abrirFormularioCidadeAdmin(itemAtual = null) {
            return new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.className = 'atnx-modal-overlay';
                const editando = !!itemAtual;
                const inicioDefault = valorDataAdmin(itemAtual?.data_inicio, obterDataHojeISO());
                const previsaoDefault = valorDataAdmin(itemAtual?.data_previsao_final, '');
                const conclusaoDefault = valorDataAdmin(itemAtual?.data_conclusao, '');
                const ctoInicioDefault = valorDataAdmin(itemAtual?.ctos_data_inicio, '');
                const ctoPrevisaoDefault = valorDataAdmin(itemAtual?.ctos_data_previsao_final, '');
                const ceoInicioDefault = valorDataAdmin(itemAtual?.caixas_data_inicio, '');
                const ceoPrevisaoDefault = valorDataAdmin(itemAtual?.caixas_data_previsao_final, '');
                const popInicioDefault = valorDataAdmin(itemAtual?.pops_data_inicio, '');
                const popPrevisaoDefault = valorDataAdmin(itemAtual?.pops_data_previsao_final, '');

                overlay.innerHTML = `<div class="atnx-modal-card atnx-modal-card-wide" role="dialog" aria-modal="true">
                    <div class="atnx-modal-header">
                        <div>
                            <div class="atnx-modal-title">${editando ? 'Editar cidade' : 'Cadastrar cidade'}</div>
                            <div class="atnx-modal-subtitle">Documentação Rede Geral</div>
                        </div>
                        <button type="button" class="atnx-modal-close" data-cancel>✕</button>
                    </div>
                    <form class="atnx-admin-form" id="form-admin-cidade">
                        <div class="atnx-form-grid">
                            ${criarInputAdmin({ label: 'Cidade / obra', name: 'cidade', value: valorTextoAdmin(itemAtual?.cidade), placeholder: 'Ex: Cachoeirinha', required: true })}
                            ${criarInputAdmin({ label: 'Data de início', name: 'data_inicio', type: 'date', value: inicioDefault })}
                            ${criarInputAdmin({ label: 'Data prevista para final', name: 'data_previsao_final', type: 'date', value: previsaoDefault })}
                            ${criarInputAdmin({ label: 'Data de conclusão', name: 'data_conclusao', type: 'date', value: conclusaoDefault })}
                            ${criarInputAdmin({ label: "Total de CTO's", name: 'ctos_total', type: 'number', value: normalizarNumeroAdmin(itemAtual?.ctos_total), min: '0' })}
                            ${criarInputAdmin({ label: "CTO's documentadas", name: 'ctos_documentadas', type: 'number', value: normalizarNumeroAdmin(itemAtual?.ctos_documentadas), min: '0' })}
                            ${criarInputAdmin({ label: 'Total de CEO', name: 'caixas_total', type: 'number', value: normalizarNumeroAdmin(itemAtual?.caixas_total), min: '0' })}
                            ${criarInputAdmin({ label: 'CEO documentadas', name: 'caixas_documentadas', type: 'number', value: normalizarNumeroAdmin(itemAtual?.caixas_documentadas), min: '0' })}
                            ${criarInputAdmin({ label: 'Total de POP', name: 'pops_total', type: 'number', value: normalizarNumeroAdmin(itemAtual?.pops_total), min: '0' })}
                            ${criarInputAdmin({ label: 'POP documentados', name: 'pops_documentados', type: 'number', value: normalizarNumeroAdmin(itemAtual?.pops_documentados), min: '0' })}
                            ${criarInputAdmin({ label: 'Início CTO', name: 'ctos_data_inicio', type: 'date', value: ctoInicioDefault })}
                            ${criarInputAdmin({ label: 'Previsão final CTO', name: 'ctos_data_previsao_final', type: 'date', value: ctoPrevisaoDefault })}
                            ${criarInputAdmin({ label: 'Início CEO', name: 'caixas_data_inicio', type: 'date', value: ceoInicioDefault })}
                            ${criarInputAdmin({ label: 'Previsão final CEO', name: 'caixas_data_previsao_final', type: 'date', value: ceoPrevisaoDefault })}
                            ${criarInputAdmin({ label: 'Início POP', name: 'pops_data_inicio', type: 'date', value: popInicioDefault })}
                            ${criarInputAdmin({ label: 'Previsão final POP', name: 'pops_data_previsao_final', type: 'date', value: popPrevisaoDefault })}
                            ${criarSelectAtnx({ label: 'Categoria da observação', name: 'observacao_categoria', value: itemAtual?.observacao_categoria || 'Sem categoria', options: ATLAS_OBSERVACAO_CATEGORIAS })}
                            ${criarTextareaAdmin({ label: 'Observações', name: 'observacoes', value: valorTextoAdmin(itemAtual?.observacoes), placeholder: 'Detalhes importantes da documentação...' })}
                        </div>
                        <div class="atnx-form-error" id="form-admin-erro"></div>
                        <div class="atnx-modal-actions">
                            <button type="button" class="atnx-btn-secondary" data-cancel>Cancelar</button>
                            <button type="submit" class="atnx-btn-primary">${editando ? 'Salvar alterações' : 'Cadastrar cidade'}</button>
                        </div>
                    </form>
                </div>`;

                document.body.appendChild(overlay);
                const form = overlay.querySelector('#form-admin-cidade');
                const erro = overlay.querySelector('#form-admin-erro');
                const inputCidade = form.querySelector('[name="cidade"]');
                inputCidade?.focus();

                const cancelar = () => {
                    removerModalAtnx(overlay);
                    resolve(null);
                };

                overlay.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', cancelar));
                overlay.addEventListener('click', e => {
                    if (e.target === overlay) cancelar();
                });

                form.addEventListener('submit', e => {
                    e.preventDefault();
                    const fd = new FormData(form);
                    const cidade = valorTextoAdmin(fd.get('cidade'));
                    if (!cidade) {
                        erro.textContent = 'Informe o nome da cidade.';
                        return;
                    }

                    const ctosTotal = normalizarNumeroAdmin(fd.get('ctos_total'));
                    const ctosDoc = normalizarNumeroAdmin(fd.get('ctos_documentadas'));
                    const caixasTotal = normalizarNumeroAdmin(fd.get('caixas_total'));
                    const caixasDoc = normalizarNumeroAdmin(fd.get('caixas_documentadas'));
                    const popsTotal = normalizarNumeroAdmin(fd.get('pops_total'));
                    const popsDoc = normalizarNumeroAdmin(fd.get('pops_documentados'));

                    const payload = {
                        cidade,
                        data_inicio: valorTextoAdmin(fd.get('data_inicio')) || null,
                        data_previsao_final: valorTextoAdmin(fd.get('data_previsao_final')) || null,
                        data_conclusao: valorTextoAdmin(fd.get('data_conclusao')) || null,
                        ctos_total: ctosTotal,
                        ctos_documentadas: ctosDoc,
                        ctos_data_inicio: valorTextoAdmin(fd.get('ctos_data_inicio')) || null,
                        ctos_data_previsao_final: valorTextoAdmin(fd.get('ctos_data_previsao_final')) || null,
                        caixas_total: caixasTotal,
                        caixas_documentadas: caixasDoc,
                        caixas_data_inicio: valorTextoAdmin(fd.get('caixas_data_inicio')) || null,
                        caixas_data_previsao_final: valorTextoAdmin(fd.get('caixas_data_previsao_final')) || null,
                        pops_total: popsTotal,
                        pops_documentados: popsDoc,
                        pops_data_inicio: valorTextoAdmin(fd.get('pops_data_inicio')) || null,
                        pops_data_previsao_final: valorTextoAdmin(fd.get('pops_data_previsao_final')) || null,
                        observacao_categoria: valorTextoAdmin(fd.get('observacao_categoria')) || 'Sem categoria',
                        observacoes: valorTextoAdmin(fd.get('observacoes')),
                        updated_at: new Date().toISOString()
                    };

                    removerModalAtnx(overlay);
                    resolve(payload);
                });
            });
        }


        function formatarMensagemModalAtnx(mensagem) {
            return escaparHtml(mensagem || '').replace(/\n/g, '<br>');
        }

        function alertaVisualAtnx(titulo, mensagem, textoBotao = 'Entendi') {
            return new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.className = 'atnx-modal-overlay';
                overlay.innerHTML = `<div class="atnx-modal-card atnx-modal-card-soft" role="dialog" aria-modal="true">
                    <div class="atnx-modal-header">
                        <div>
                            <div class="atnx-modal-title">${escaparHtml(titulo || 'Aviso')}</div>
                            <div class="atnx-modal-subtitle">${formatarMensagemModalAtnx(mensagem || '')}</div>
                        </div>
                        <button type="button" class="atnx-modal-close" data-close>✕</button>
                    </div>
                    <div class="atnx-modal-actions">
                        <button type="button" class="atnx-btn-primary" data-close>${escaparHtml(textoBotao)}</button>
                    </div>
                </div>`;
                document.body.appendChild(overlay);
                const finalizar = () => { removerModalAtnx(overlay); resolve(true); };
                overlay.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', finalizar));
                overlay.addEventListener('click', e => { if (e.target === overlay) finalizar(); });
            });
        }

        function solicitarTextoAtnx({ titulo = 'Preencher informação', mensagem = '', label = 'Valor', valor = '', placeholder = '', obrigatorio = false, textoConfirmar = 'Salvar' } = {}) {
            return new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.className = 'atnx-modal-overlay';
                overlay.innerHTML = `<div class="atnx-modal-card atnx-modal-card-soft" role="dialog" aria-modal="true">
                    <div class="atnx-modal-header">
                        <div>
                            <div class="atnx-modal-title">${escaparHtml(titulo)}</div>
                            ${mensagem ? `<div class="atnx-modal-subtitle">${formatarMensagemModalAtnx(mensagem)}</div>` : ''}
                        </div>
                        <button type="button" class="atnx-modal-close" data-cancel>✕</button>
                    </div>
                    <form class="atnx-smart-form" data-form>
                        <label class="atnx-form-field atnx-form-field-full">
                            <span>${escaparHtml(label)}</span>
                            <input name="valor" type="text" value="${escaparHtml(valor)}" placeholder="${escaparHtml(placeholder)}" ${obrigatorio ? 'required' : ''}>
                        </label>
                        <div class="atnx-form-error" data-error></div>
                        <div class="atnx-modal-actions">
                            <button type="button" class="atnx-btn-secondary" data-cancel>Cancelar</button>
                            <button type="submit" class="atnx-btn-primary">${escaparHtml(textoConfirmar)}</button>
                        </div>
                    </form>
                </div>`;
                document.body.appendChild(overlay);
                const input = overlay.querySelector('input[name="valor"]');
                const erro = overlay.querySelector('[data-error]');
                const finalizar = valorFinal => { removerModalAtnx(overlay); resolve(valorFinal); };
                overlay.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', () => finalizar(null)));
                overlay.addEventListener('click', e => { if (e.target === overlay) finalizar(null); });
                overlay.querySelector('[data-form]')?.addEventListener('submit', e => {
                    e.preventDefault();
                    const valorFinal = String(input?.value || '').trim();
                    if (obrigatorio && !valorFinal) {
                        if (erro) erro.textContent = 'Preencha este campo para continuar.';
                        input?.focus();
                        return;
                    }
                    finalizar(valorFinal);
                });
                setTimeout(() => { input?.focus(); input?.select(); }, 30);
            });
        }

        function confirmarVisualAtnx(titulo, mensagem, textoConfirmar = 'Confirmar') {
            return new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.className = 'atnx-modal-overlay';
                overlay.innerHTML = `<div class="atnx-modal-card" role="dialog" aria-modal="true">
                    <div class="atnx-modal-header">
                        <div>
                            <div class="atnx-modal-title">${escaparHtml(titulo)}</div>
                            <div class="atnx-modal-subtitle">${formatarMensagemModalAtnx(mensagem)}</div>
                        </div>
                        <button type="button" class="atnx-modal-close" data-cancel>✕</button>
                    </div>
                    <div class="atnx-modal-actions">
                        <button type="button" class="atnx-btn-secondary" data-cancel>Cancelar</button>
                        <button type="button" class="atnx-btn-danger" data-confirm>${escaparHtml(textoConfirmar)}</button>
                    </div>
                </div>`;
                document.body.appendChild(overlay);
                const finalizar = valor => {
                    removerModalAtnx(overlay);
                    resolve(valor);
                };
                overlay.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', () => finalizar(false)));
                overlay.querySelector('[data-confirm]')?.addEventListener('click', () => finalizar(true));
                overlay.addEventListener('click', e => {
                    if (e.target === overlay) finalizar(false);
                });
            });
        }

        async function carregarAdminObras() {
            if (!supabaseClient) return;
            state.adminCarregando = true;
            state.adminErro = '';
            renderAdminObras();
            atlasExibirOperacao('Carregando Documentação Rede Geral...', 'bg-[#0073ea]');

            try {
                const { data, error } = await supabaseClient
                    .from(ADMIN_OBRAS_TABELA)
                    .select('*')
                    .order('created_at', { ascending: true });

                if (error) throw error;
                state.adminObras = data || [];
                state.adminErro = '';
                atlasExibirOperacao('Documentação Rede Geral carregada.', 'bg-emerald-600');
            } catch (err) {
                console.error('Erro ao carregar documentação rede geral:', err);
                state.adminErro = err.message || String(err);
                atlasExibirOperacao('Erro ao carregar Documentação Rede Geral: ' + state.adminErro, 'bg-red-600');
            } finally {
                state.adminCarregando = false;
                renderAdminObras();
            }
        }

        async function abrirCadastroCidadeAdmin() {
            const payload = await abrirFormularioCidadeAdmin();
            if (!payload) return;

            try {
                const statusInicial = 'a_realizar';
                exibirStatusTemporario('💾 Cadastrando cidade na documentação geral...', 'bg-[#0073ea]');
                const id = 'adm-' + Date.now();
                const { error } = await supabaseClient
                    .from(ADMIN_OBRAS_TABELA)
                    .insert([{ id, status: statusInicial, ctos_status: statusInicial, caixas_status: statusInicial, pops_status: statusInicial, ...payload }]);
                if (error) throw error;
                await registrarAuditoria('criação', 'documentacao_rede_geral', id, payload.cidade, 'cidade', '', payload.cidade, 'Cidade cadastrada na Documentação Rede Geral');
                exibirStatusTemporario('✅ Cidade cadastrada na documentação geral.', 'bg-emerald-600');
                await carregarAdminObras();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao cadastrar cidade: ' + err.message, 'bg-red-600');
            }
        }

        async function editarCidadeAdmin(id) {
            const item = state.adminObras.find(o => o.id === id);
            if (!item) return;
            const payload = await abrirFormularioCidadeAdmin(item);
            if (!payload) return;

            try {
                exibirStatusTemporario('💾 Salvando documentação geral da cidade...', 'bg-[#0073ea]');
                const { error } = await supabaseClient
                    .from(ADMIN_OBRAS_TABELA)
                    .update(payload)
                    .eq('id', id);
                if (error) throw error;
                await registrarAuditoria('edição', 'documentacao_rede_geral', id, payload.cidade, 'dados da cidade', item.cidade, payload.cidade, 'Cadastro da cidade atualizado');
                exibirStatusTemporario('✅ Cidade atualizada.', 'bg-emerald-600');
                await carregarAdminObras();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao editar cidade: ' + err.message, 'bg-red-600');
            }
        }

        async function alterarStatusCidadeAdmin(id, novoStatus) {
            const status = ADMIN_STATUS_TODOS.some(s => s.id === novoStatus) ? novoStatus : 'a_realizar';
            const item = state.adminObras.find(o => o.id === id);
            if (!item) return;
            const statusAnterior = item.status;
            const conclusaoAnterior = item.data_conclusao;
            const payload = { status, updated_at: new Date().toISOString() };

            if (status === 'concluida' && !item.data_conclusao) {
                payload.data_conclusao = obterDataHojeISO();
            }

            item.status = status;
            if (payload.data_conclusao) item.data_conclusao = payload.data_conclusao;
            renderAdminObras();

            try {
                const { error } = await supabaseClient
                    .from(ADMIN_OBRAS_TABELA)
                    .update(payload)
                    .eq('id', id);
                if (error) throw error;
                await registrarAuditoria('status', 'documentacao_rede_geral', id, item.cidade, 'status geral', statusAnterior, status, 'Status geral atualizado');
                exibirStatusTemporario(status === 'concluida' ? '✅ Obra concluída e data de conclusão registrada.' : '✅ Etapa da documentação atualizada.', 'bg-emerald-600');
            } catch (err) {
                item.status = statusAnterior;
                item.data_conclusao = conclusaoAnterior;
                renderAdminObras();
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao alterar etapa: ' + err.message, 'bg-red-600');
            }
        }


        async function alterarStatusCategoriaAdmin(id, categoria, novoStatus) {
            const valorRecebido = String(novoStatus ?? '').trim();
            const status = valorRecebido === '' ? '' : normalizarStatusAdminValor(valorRecebido, '');
            if (valorRecebido !== '' && status === '') return;
            const item = state.adminObras.find(o => o.id === id);
            if (!item) return;
            const campo = categoria === 'cto' ? 'ctos_status' : categoria === 'ceo' ? 'caixas_status' : 'pops_status';
            const statusAnterior = item[campo];
            item[campo] = status;
            renderAdminObras();

            try {
                const { error } = await supabaseClient
                    .from(ADMIN_OBRAS_TABELA)
                    .update({ [campo]: status, updated_at: new Date().toISOString() })
                    .eq('id', id);
                if (error) throw error;
                const nome = categoria === 'cto' ? 'CTO' : categoria === 'ceo' ? 'CEO' : 'POP';
                await registrarAuditoria('status', 'documentacao_rede_geral', id, item.cidade, `status ${nome}`, statusAnterior, status, `Status de ${nome} atualizado`);
                exibirStatusTemporario(`✅ Status de ${nome} atualizado.`, 'bg-emerald-600');
            } catch (err) {
                item[campo] = statusAnterior;
                renderAdminObras();
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao alterar status do item: ' + err.message, 'bg-red-600');
            }
        }

        async function excluirCidadeAdmin(id) {
            const item = state.adminObras.find(o => o.id === id);
            if (!item) return;
            const confirmado = await confirmarVisualAtnx('Remover cidade', `Remover ${item.cidade} da Documentação Rede Geral? Isso não apaga a obra/documentação da aba Obras.`, 'Remover');
            if (!confirmado) return;

            try {
                const { error } = await supabaseClient
                    .from(ADMIN_OBRAS_TABELA)
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                state.adminObras = state.adminObras.filter(o => o.id !== id);
                await registrarAuditoria('remoção', 'documentacao_rede_geral', id, item.cidade, 'cidade', item.cidade, '', 'Cidade removida da Documentação Rede Geral');
                renderAdminObras();
                exibirStatusTemporario('✅ Cidade removida da documentação geral.', 'bg-emerald-600');
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao remover cidade: ' + err.message, 'bg-red-600');
            }
        }

        const PESOS_DOCUMENTACAO_ADMIN = Object.freeze({
            cto: 1,
            ceo: 4,
            pop: 8
        });

        function calcularPercentualAdmin(feito, total) {
            const feitoNum = normalizarNumeroAdmin(feito);
            const totalNum = normalizarNumeroAdmin(total);
            if (totalNum > 0) return Math.round((feitoNum / totalNum) * 100);
            return feitoNum > 0 ? 100 : 0;
        }

        function montarBaseProgressoAdmin(item) {
            const ctosTotal = normalizarNumeroAdmin(item.ctos_total);
            const ctosFeito = normalizarNumeroAdmin(item.ctos_documentadas);
            const ceosTotal = normalizarNumeroAdmin(item.caixas_total);
            const ceosFeito = normalizarNumeroAdmin(item.caixas_documentadas);
            const popsTotal = normalizarNumeroAdmin(item.pops_total);
            const popsFeito = normalizarNumeroAdmin(item.pops_documentados);
            const total = ctosTotal + ceosTotal + popsTotal;
            const feito = ctosFeito + ceosFeito + popsFeito;
            const totalPonderado =
                (ctosTotal * PESOS_DOCUMENTACAO_ADMIN.cto) +
                (ceosTotal * PESOS_DOCUMENTACAO_ADMIN.ceo) +
                (popsTotal * PESOS_DOCUMENTACAO_ADMIN.pop);
            const feitoPonderado =
                (ctosFeito * PESOS_DOCUMENTACAO_ADMIN.cto) +
                (ceosFeito * PESOS_DOCUMENTACAO_ADMIN.ceo) +
                (popsFeito * PESOS_DOCUMENTACAO_ADMIN.pop);
            return { total, feito, totalPonderado, feitoPonderado };
        }

        function calcularProgressoAdmin(item) {
            // V1.2.3 — STATUS volta a usar percentual real, sem peso.
            const base = montarBaseProgressoAdmin(item || {});
            const percentual = calcularPercentualAdmin(base.feito, base.total);
            const percentualBarra = Math.min(100, Math.max(0, percentual));
            const acimaDoPlanejado = base.total > 0 && base.feito > base.total;
            return { ...base, percentual, percentualSimples: percentual, percentualCorrigido: calcularPercentualAdmin(base.feitoPonderado, base.totalPonderado), percentualBarra, acimaDoPlanejado };
        }

        function calcularProgressoAdminPonderado(item) {
            // Gantt mantém o percentual corrigido por esforço operacional:
            // CTO = 1, CEO = 4 e POP = 8.
            const base = montarBaseProgressoAdmin(item || {});
            const percentual = calcularPercentualAdmin(base.feitoPonderado, base.totalPonderado);
            const percentualBarra = Math.min(100, Math.max(0, percentual));
            const acimaDoPlanejado = base.totalPonderado > 0 && base.feitoPonderado > base.totalPonderado;
            return { ...base, percentual, percentualSimples: calcularPercentualAdmin(base.feito, base.total), percentualCorrigido: percentual, percentualBarra, acimaDoPlanejado };
        }

        function calcularProgressoCategoriaAdmin(item, categoria) {
            const mapa = {
                pop: {
                    label: 'POP',
                    total: normalizarNumeroAdmin(item.pops_total),
                    feito: normalizarNumeroAdmin(item.pops_documentados)
                },
                ceo: {
                    label: 'CEO',
                    total: normalizarNumeroAdmin(item.caixas_total),
                    feito: normalizarNumeroAdmin(item.caixas_documentadas)
                },
                cto: {
                    label: 'CTO',
                    total: normalizarNumeroAdmin(item.ctos_total),
                    feito: normalizarNumeroAdmin(item.ctos_documentadas)
                }
            };
            const base = mapa[categoria] || mapa.pop;
            const percentual = base.total > 0 ? Math.round((base.feito / base.total) * 100) : (base.feito > 0 ? 100 : 0);
            const percentualBarra = Math.min(100, Math.max(0, percentual));
            const acimaDoPlanejado = base.total > 0 && base.feito > base.total;
            return { ...base, percentual, percentualBarra, acimaDoPlanejado };
        }

        function toggleSecaoAdmin(statusId) {
            if (!state.adminSecoesAbertas) {
                state.adminSecoesAbertas = { a_realizar: true, em_andamento: true, parada: true, concluida: true };
            }
            state.adminSecoesAbertas[statusId] = state.adminSecoesAbertas[statusId] === false ? true : false;
            renderAdminObras();
        }

        function renderKpiAdmin(label, feito, total) {
            const feitoNum = normalizarNumeroAdmin(feito);
            const totalNum = normalizarNumeroAdmin(total);
            const acima = totalNum > 0 && feitoNum > totalNum;
            return `<div class="atnx-admin-kpi ${acima ? 'atnx-admin-kpi-over' : ''}">
                <div class="atnx-admin-kpi-label">${escaparHtml(label)}</div>
                <div class="atnx-admin-kpi-value">${feitoNum}/${totalNum}</div>
                ${acima ? '<div class="atnx-admin-kpi-extra">acima do planejado</div>' : '<div class="atnx-admin-kpi-extra">documentado / planejado</div>'}
            </div>`;
        }

        function alternarDetalhesCidadeAdmin(id) {
            if (!state.adminDetalhesAbertos) state.adminDetalhesAbertos = {};
            state.adminDetalhesAbertos[id] = state.adminDetalhesAbertos[id] === true ? false : true;
            renderAdminObras();
        }

        function renderCardCidadeAdmin(item) {
            const progresso = calcularProgressoAdmin(item);
            const statusAtual = normalizarStatusAdminValor(item.status || 'a_realizar');
            const statusInfo = obterStatusAdminInfo(statusAtual);
            const opcoesStatus = renderOpcoesStatusAdmin(statusAtual);
            const statusCto = obterStatusCategoriaAdmin(item, 'cto');
            const statusCeo = obterStatusCategoriaAdmin(item, 'ceo');
            const statusPop = obterStatusCategoriaAdmin(item, 'pop');
            const obs = String(item.observacoes || '').trim();
            const obsCategoria = String(item.observacao_categoria || 'Sem categoria').trim();
            const dataInicio = item.data_inicio ? formatarDataParaExibicao(item.data_inicio) : 'Não definida';
            const dataPrevisao = item.data_previsao_final ? formatarDataParaExibicao(item.data_previsao_final) : 'Não definida';
            const dataConclusao = item.data_conclusao ? formatarDataParaExibicao(item.data_conclusao) : 'Não definida';
            const aberto = state.adminDetalhesAbertos?.[item.id] === true;

            return `<div class="atnx-admin-card ${aberto ? 'is-open' : 'is-collapsed'}">
                <button type="button" class="atnx-admin-card-toggle" onclick="alternarDetalhesCidadeAdmin('${item.id}')" aria-expanded="${aberto ? 'true' : 'false'}">
                    <div class="atnx-admin-card-toggle-main">
                        <div class="atnx-admin-card-title">
                            <span>${escaparHtml(item.cidade || 'Cidade sem nome')}</span>
                            <span class="text-[10px] text-gray-500">${progresso.percentual}%</span>
                        </div>
                        <div class="atnx-admin-card-summary"><span class="atnx-admin-status-dot-inline atnx-admin-status-${statusAtual}" aria-hidden="true"></span>${escaparHtml(statusInfo.titulo)} · ${progresso.feito} itens documentados</div>
                    </div>
                    <span class="atnx-admin-card-chevron">${aberto ? '▾' : '▸'}</span>
                </button>
                ${aberto ? `
                <div class="atnx-admin-card-body">
                    <div class="atnx-admin-dates">
                        <span>📅 Início: ${escaparHtml(dataInicio)}</span>
                        <span>🏁 Previsão: ${escaparHtml(dataPrevisao)}</span>
                        <span>✅ Conclusão: ${escaparHtml(dataConclusao)}</span>
                    </div>
                    ${(obs || obsCategoria !== 'Sem categoria') ? `<div class="atlas-smart-note"><strong>${escaparHtml(obsCategoria)}</strong>${obs ? `<span>${escaparHtml(obs)}</span>` : ''}</div>` : ''}
                    <div class="atnx-admin-kpis">
                        ${renderKpiAdmin('CTO', item.ctos_documentadas, item.ctos_total)}
                        ${renderKpiAdmin('CEO', item.caixas_documentadas, item.caixas_total)}
                        ${renderKpiAdmin('POP', item.pops_documentados, item.pops_total)}
                    </div>
                    <div class="atnx-admin-item-status-list">
                        <div class="atnx-admin-item-status-row">
                            <span class="atnx-admin-item-status-label">CTO</span>
                            ${renderizarSelectStatusAdmin(statusCto, `alterarStatusCategoriaAdmin('${item.id}', 'cto', this.value)`, true, true)}
                        </div>
                        <div class="atnx-admin-item-status-row">
                            <span class="atnx-admin-item-status-label">CEO</span>
                            ${renderizarSelectStatusAdmin(statusCeo, `alterarStatusCategoriaAdmin('${item.id}', 'ceo', this.value)`, true, true)}
                        </div>
                        <div class="atnx-admin-item-status-row">
                            <span class="atnx-admin-item-status-label">POP</span>
                            ${renderizarSelectStatusAdmin(statusPop, `alterarStatusCategoriaAdmin('${item.id}', 'pop', this.value)`, true, true)}
                        </div>
                    </div>
                    <div class="atnx-admin-progress-wrap">
                        <div class="atnx-admin-progress-label"><span>Progresso documentado</span><span>${progresso.feito} itens · ${progresso.percentual}%</span></div>
                        <div class="atnx-admin-progress-bar ${progresso.acimaDoPlanejado ? 'atnx-admin-progress-over' : ''}"><div class="atnx-admin-progress-fill" style="width:${progresso.percentualBarra}%"></div></div>
                    </div>
                    <div class="atnx-admin-actions">
                        ${renderizarSelectStatusAdmin(statusAtual, `alterarStatusCidadeAdmin('${item.id}', this.value)`, false)}
                        <button class="atnx-admin-icon-btn" onclick="editarCidadeAdmin('${item.id}')" title="Editar cidade">✏️</button>
                        <button class="atnx-admin-icon-btn" onclick="excluirCidadeAdmin('${item.id}')" title="Remover da documentação geral">🗑️</button>
                    </div>
                </div>` : ''}
            </div>`;
        }

        function renderAdminSetup() {
            const painel = document.getElementById('painel-admin-obras');
            if (!painel) return;
            painel.innerHTML = `<div class="atnx-admin-setup">
                <div class="text-white text-lg font-bold mb-2">Configuração necessária no Supabase</div>
                <div class="text-gray-400 text-xs leading-relaxed">
                    A aba de Documentação Rede Geral precisa da tabela <strong>admin_documentacoes</strong>.
                    Abra o SQL Editor do Supabase, execute o arquivo oficial unificado e recarregue o Atlas.
                </div>
                <pre>${escaparHtml(SQL_ATLAS_SCHEMA_OFICIAL)}</pre>
                <button class="bg-[#0073ea] hover:bg-[#0073ea] text-white px-4 py-2 rounded text-xs font-medium" onclick="navigator.clipboard?.writeText(SQL_ATLAS_SCHEMA_OFICIAL); exibirStatusTemporario('📋 Nome do SQL copiado.', 'bg-[#0073ea]')">Copiar nome do SQL</button>
                <button class="ml-2 bg-[#2f314e] hover:bg-[#3d4066] text-white px-4 py-2 rounded text-xs font-medium" onclick="carregarAdminObras()">Tentar novamente</button>
                <div class="text-red-300 text-[10px] mt-3">Erro recebido: ${escaparHtml(state.adminErro)}</div>
            </div>`;
        }


        function definirVisualizacaoAdmin(tipo) {
            state.adminVisualizacao = ['status', 'obras', 'gantt', 'painel', 'manutencao_redes'].includes(tipo) ? tipo : 'status';
            if (state.adminVisualizacao !== 'gantt') {
                state.adminGanttFullscreen = false;
            }
            atualizarVisibilidadeModulos();
            if (state.adminVisualizacao === 'manutencao_redes') {
                carregarManutencoesRede();
                return;
            }
            if (state.adminVisualizacao === 'painel') {
                carregarDadosExecutivo();
                return;
            }
            renderAdminObras();
        }

        function alternarTelaCheiaGantt() {
            state.adminGanttFullscreen = !state.adminGanttFullscreen;
            renderAdminObras();
        }

        function ajustarZoomGantt(delta) {
            const atual = Number(state.adminGanttZoom || 1);
            const proximo = Math.max(0.5, Math.min(1.8, Math.round((atual + delta) * 100) / 100));
            state.adminGanttZoom = proximo;
            renderAdminObras();
        }

        function resetarZoomGantt() {
            state.adminGanttZoom = 1;
            renderAdminObras();
        }

        function centralizarHojeGantt() {
            const scroll = document.querySelector('#painel-admin-obras .atnx-gantt-scroll');
            const grid = scroll?.querySelector('.atnx-gantt-grid');
            if (!scroll || !grid) return;
            const leftWidth = Number(grid.dataset.leftWidth || 320);
            const todayLeft = Number(grid.dataset.todayLeft || 0);
            const alvo = Math.max(0, (leftWidth + todayLeft) - (scroll.clientWidth / 2));
            scroll.scrollLeft = alvo;
        }

        function obterClasseZoomGantt(zoom) {
            if (zoom <= 0.6) return 'atnx-gantt-zoom-xs';
            if (zoom <= 0.8) return 'atnx-gantt-zoom-sm';
            if (zoom >= 1.35) return 'atnx-gantt-zoom-lg';
            return '';
        }

        function obterStatusAdminInfo(statusId) {
            return ADMIN_STATUS_TODOS.find(st => st.id === statusId) || ADMIN_STATUS_TODOS[0];
        }

        function dataAdminParaDate(valor) {
            if (!valor) return null;
            const iso = converterDataParaInput(valor);
            if (!iso) return null;
            const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!partes) return null;
            const data = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
            return Number.isNaN(data.getTime()) ? null : data;
        }

        function inicioDoMes(data) {
            return new Date(data.getFullYear(), data.getMonth(), 1);
        }

        function fimDoMes(data) {
            return new Date(data.getFullYear(), data.getMonth() + 1, 0);
        }

        function adicionarMeses(data, quantidade) {
            return new Date(data.getFullYear(), data.getMonth() + quantidade, 1);
        }

        function diferencaDias(inicio, fim) {
            const msDia = 24 * 60 * 60 * 1000;
            const a = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
            const b = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
            return Math.round((b - a) / msDia);
        }

        function nomeMesCurto(data) {
            return data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        }

        function dataParaISOAdmin(data) {
            const ano = data.getFullYear();
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            const dia = String(data.getDate()).padStart(2, '0');
            return `${ano}-${mes}-${dia}`;
        }

        function inicioSemanaAdmin(data) {
            const base = new Date(data.getFullYear(), data.getMonth(), data.getDate());
            const diaSemana = base.getDay();
            const ajuste = diaSemana === 0 ? -6 : 1 - diaSemana;
            base.setDate(base.getDate() + ajuste);
            return base;
        }

        function fimSemanaAdmin(data) {
            const inicio = inicioSemanaAdmin(data);
            return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
        }

        function obterReferenciaSemanaGantt() {
            return dataAdminParaDate(state.adminGanttSemanaRef) || new Date();
        }

        function definirSemanaGantt(valor) {
            state.adminGanttSemanaRef = converterDataParaInput(valor || obterDataHojeISO());
            renderAdminObras();
            setTimeout(() => centralizarHojeGantt(), 80);
        }

        function moverSemanaGantt(delta) {
            const ref = obterReferenciaSemanaGantt();
            ref.setDate(ref.getDate() + (delta * 7));
            state.adminGanttSemanaRef = dataParaISOAdmin(ref);
            renderAdminObras();
        }

        function voltarSemanaAtualGantt() {
            state.adminGanttSemanaRef = obterDataHojeISO();
            renderAdminObras();
            setTimeout(() => centralizarHojeGantt(), 80);
        }

        function alterarFiltroGantt(valor, manterFoco = false) {
            state.adminGanttFiltro = String(valor || '');
            renderAdminObras();
            if (manterFoco) {
                setTimeout(() => {
                    const input = document.getElementById('atnx-gantt-filter-input');
                    if (input) {
                        input.focus();
                        const pos = input.value.length;
                        try { input.setSelectionRange(pos, pos); } catch (e) {}
                    }
                }, 0);
            } else {
                setTimeout(() => centralizarHojeGantt(), 80);
            }
        }

        function definirEscalaGantt(valor) {
            const permitido = ['dias', 'semanas', 'meses'];
            state.adminGanttEscala = permitido.includes(valor) ? valor : 'meses';
            renderAdminObras();
            setTimeout(() => centralizarHojeGantt(), 80);
        }

        function ajustarAutomaticoGantt() {
            state.adminGanttZoom = 1;
            renderAdminObras();
            setTimeout(() => centralizarHojeGantt(), 120);
        }

        function alternarModoApresentacaoGantt() {
            state.adminGanttModoApresentacao = !state.adminGanttModoApresentacao;
            renderAdminObras();
            setTimeout(() => centralizarHojeGantt(), 80);
        }

        function obterPxPorDiaGantt(escala, zoom) {
            const z = Number(zoom || 1);
            if (escala === 'dias') return Math.max(8, Math.round(16 * z));
            if (escala === 'semanas') return Math.max(5, Math.round(10 * z));
            return Math.max(3, Math.round(7 * z));
        }

        function formatarDataGanttCurta(data) {
            if (!data) return 's/d';
            return `${nomeMesCurto(data)} ${data.getDate()}`;
        }

        function formatarPeriodoGantt(inicio, fim) {
            if (!inicio && !fim) return 's/d';
            if (inicio && fim) {
                if (dataParaISOAdmin(inicio) === dataParaISOAdmin(fim)) return formatarDataGanttCurta(inicio);
                return `${formatarDataGanttCurta(inicio)} - ${formatarDataGanttCurta(fim)}`;
            }
            return formatarDataGanttCurta(inicio || fim);
        }

        function obterQtdGantt(valor) {
            const numero = Number(valor || 0);
            return Number.isFinite(numero) ? numero : 0;
        }

        function renderAdminViewTabs() {
            return '';
        }

        function renderAdminGantt(lista) {
            const semanaReferencia = new Date();
            const semanaInicio = inicioSemanaAdmin(semanaReferencia);
            const semanaFim = fimSemanaAdmin(semanaReferencia);
            const semanaInicioIso = dataParaISOAdmin(semanaInicio);
            const semanaFimIso = dataParaISOAdmin(semanaFim);
            const semanaTexto = `${formatarDataParaExibicao(semanaInicioIso)} → ${formatarDataParaExibicao(semanaFimIso)}`;
            const filtroTexto = String(state.adminGanttFiltro || '').trim().toLowerCase();
            const escalaGantt = state.adminGanttEscala || 'meses';
            const zoomGantt = Number(state.adminGanttZoom || 1);
            const ganttFullscreen = !!state.adminGanttFullscreen;
            const modoApresentacao = !!state.adminGanttModoApresentacao;
            const classeZoomGantt = obterClasseZoomGantt(zoomGantt);
            const percentualZoomGantt = Math.round(zoomGantt * 100);

            const obrasVisiveis = (lista || [])
                .filter(item => {
                    const status = item.status || 'a_realizar';
                    if (status === 'em_andamento') return true;
                    if (status !== 'concluida') return false;
                    const conclusao = dataAdminParaDate(item.data_conclusao);
                    return !!conclusao && conclusao >= semanaInicio && conclusao <= semanaFim;
                })
                .filter(item => {
                    if (!filtroTexto) return true;
                    const alvo = [
                        item.cidade,
                        item.status,
                        item.observacoes,
                        'pop', 'ceo', 'cto'
                    ].join(' ').toLowerCase();
                    return alvo.includes(filtroTexto);
                });

            const itensComDatas = obrasVisiveis
                .map(item => {
                    const inicio = dataAdminParaDate(item.data_inicio);
                    const fimOriginal = dataAdminParaDate(item.data_previsao_final);
                    const fim = fimOriginal && inicio && fimOriginal < inicio ? inicio : fimOriginal;
                    return { item, inicio, fim };
                })
                .filter(reg => reg.inicio && reg.fim)
                .sort((a, b) => a.inicio - b.inicio || String(a.item.cidade || '').localeCompare(String(b.item.cidade || '')));

            const hoje = new Date();
            const anoAtual = hoje.getFullYear();
            const periodoInicio = new Date(anoAtual, 0, 1);
            const periodoFim = new Date(anoAtual, 11, 31);
            const pxPorDia = obterPxPorDiaGantt(escalaGantt, zoomGantt);
            const totalDias = Math.max(1, diferencaDias(periodoInicio, periodoFim) + 1);
            const timelineWidth = Math.max(620, totalDias * pxPorDia);
            const leftWidth = Math.max(340, Math.round(430 * zoomGantt));
            const rowHeight = Math.max(32, Math.round(46 * zoomGantt));
            const childRowHeight = Math.max(28, Math.round(38 * zoomGantt));
            const leftPaddingX = Math.max(10, Math.round(18 * zoomGantt));
            const cityFont = Math.max(10, Math.round(13 * zoomGantt));
            const metaFont = Math.max(9, Math.round(11 * zoomGantt));
            const barFont = Math.max(9, Math.round(11 * zoomGantt));
            const barHeight = Math.max(16, Math.round(22 * zoomGantt));
            const barChildHeight = Math.max(13, Math.round(18 * zoomGantt));
            const styleVars = `--gantt-row-height:${rowHeight}px;--gantt-child-row-height:${childRowHeight}px;--gantt-left-padding-x:${leftPaddingX}px;--gantt-city-font:${cityFont}px;--gantt-meta-font:${metaFont}px;--gantt-bar-font:${barFont}px;--gantt-bar-height:${barHeight}px;--gantt-bar-child-height:${barChildHeight}px;`;

            function montarMarcadoresTempoGantt() {
                const marcadores = [];
                if (escalaGantt === 'dias') {
                    let cursorDia = new Date(periodoInicio);
                    while (cursorDia <= periodoFim) {
                        const label = String(cursorDia.getDate()).padStart(2, '0');
                        const titulo = `${formatarDataGanttCurta(cursorDia)} ${nomeMesCurto(cursorDia)}`;
                        const fimDeSemana = cursorDia.getDay() === 0 || cursorDia.getDay() === 6;
                        marcadores.push(`<div class="atnx-gantt-time-cell atnx-gantt-day ${fimDeSemana ? 'is-weekend' : ''}" style="width:${pxPorDia}px" title="${escaparHtml(titulo)}">${label}</div>`);
                        cursorDia.setDate(cursorDia.getDate() + 1);
                    }
                    return { html: marcadores.join(''), classe: 'dias', grid: pxPorDia };
                }

                if (escalaGantt === 'semanas') {
                    let cursorSemana = new Date(periodoInicio);
                    let semana = 1;
                    while (cursorSemana <= periodoFim) {
                        const inicioSemana = new Date(cursorSemana);
                        const fimSemana = new Date(cursorSemana.getFullYear(), cursorSemana.getMonth(), cursorSemana.getDate() + 6);
                        const fimVisivel = fimSemana > periodoFim ? periodoFim : fimSemana;
                        const diasSemana = Math.max(1, diferencaDias(inicioSemana, fimVisivel) + 1);
                        const titulo = `${formatarDataGanttCurta(inicioSemana)} - ${formatarDataGanttCurta(fimVisivel)}`;
                        marcadores.push(`<div class="atnx-gantt-time-cell atnx-gantt-week" style="width:${diasSemana * pxPorDia}px" title="${escaparHtml(titulo)}">S${String(semana).padStart(2, '0')}</div>`);
                        cursorSemana.setDate(cursorSemana.getDate() + 7);
                        semana++;
                    }
                    return { html: marcadores.join(''), classe: 'semanas', grid: pxPorDia * 7 };
                }

                let cursorMes = new Date(periodoInicio);
                while (cursorMes <= periodoFim) {
                    const iniMes = new Date(cursorMes);
                    const fimMes = fimDoMes(iniMes);
                    const iniVisivel = iniMes < periodoInicio ? periodoInicio : iniMes;
                    const fimVisivel = fimMes > periodoFim ? periodoFim : fimMes;
                    const diasMes = Math.max(1, diferencaDias(iniVisivel, fimVisivel) + 1);
                    marcadores.push(`<div class="atnx-gantt-time-cell atnx-gantt-month" style="width:${diasMes * pxPorDia}px">${nomeMesCurto(iniMes)}</div>`);
                    cursorMes = adicionarMeses(cursorMes, 1);
                }
                return { html: marcadores.join(''), classe: 'meses', grid: pxPorDia * 30 };
            }

            const marcadoresTempo = montarMarcadoresTempoGantt();

            const hojeDentro = hoje >= periodoInicio && hoje <= periodoFim;
            const hojeLeft = hojeDentro ? Math.max(0, diferencaDias(periodoInicio, hoje) * pxPorDia) : 0;
            const todayLineFull = hojeDentro ? `<div class="atnx-gantt-today-full" style="left:${leftWidth + hojeLeft}px"><span></span></div>` : '';

            function calcularPosicaoGantt(inicio, fim) {
                const inicioVisivel = inicio < periodoInicio ? periodoInicio : inicio;
                const fimVisivel = fim > periodoFim ? periodoFim : fim;
                if (fimVisivel < periodoInicio || inicioVisivel > periodoFim) {
                    return { left: 0, width: 0, fora: true };
                }
                const left = Math.max(0, diferencaDias(periodoInicio, inicioVisivel) * pxPorDia);
                const width = Math.max(10, (diferencaDias(inicioVisivel, fimVisivel) + 1) * pxPorDia);
                return { left, width, fora: false };
            }

            function renderBarraGantt(statusId, left, width, label, titulo, filha = false) {
                if (width <= 0) return '';
                const classeFilha = filha ? ' atnx-gantt-bar-child' : '';
                return `<div class="atnx-gantt-bar ${escaparHtml(statusId)}${classeFilha}" style="left:${left}px; width:${width}px" aria-label="${escaparHtml(titulo || label)}"></div>
                    <div class="atnx-gantt-bar-label-outside ${filha ? 'child' : 'parent'}" style="left:${left + width + 8}px" aria-label="${escaparHtml(label)}">${escaparHtml(label)}</div>`;
            }

            const totalEmAndamento = itensComDatas.filter(reg => (reg.item.status || 'a_realizar') === 'em_andamento').length;
            const totalConcluidasSemana = itensComDatas.filter(reg => (reg.item.status || 'a_realizar') === 'concluida').length;
            const textoFiltroResultado = filtroTexto ? `${itensComDatas.length} resultado(s)` : `${itensComDatas.length} obra(s)`;
            const toolbarGantt = `<div class="atnx-gantt-pro-toolbar ${modoApresentacao ? 'is-presentation' : ''}">
                <div class="atnx-gantt-filter-box ${filtroTexto ? 'is-active' : ''}">
                    <span>⌕</span>
                    <input id="atnx-gantt-filter-input" type="search" value="${escaparHtml(state.adminGanttFiltro || '')}" placeholder="Filtrar obra, item ou status" oninput="alterarFiltroGantt(this.value, true)" />
                </div>
                <span class="atnx-gantt-filter-count">${escaparHtml(textoFiltroResultado)}</span>
                ${filtroTexto ? `<button type="button" class="atnx-gantt-tool-btn" onclick="alterarFiltroGantt('')" title="Limpar filtro">Limpar</button>` : ''}
                <div class="atnx-gantt-toolbar-spacer"></div>
                <button type="button" class="atnx-gantt-tool-btn strong" onclick="ajustarAutomaticoGantt()" title="Voltar zoom para 100% e centralizar hoje">Ajuste automático</button>
                <select class="atnx-gantt-scale-select" onchange="definirEscalaGantt(this.value)" title="Escala do cronograma">
                    <option value="meses" ${escalaGantt === 'meses' ? 'selected' : ''}>Meses</option>
                    <option value="semanas" ${escalaGantt === 'semanas' ? 'selected' : ''}>Semanas</option>
                    <option value="dias" ${escalaGantt === 'dias' ? 'selected' : ''}>Dias</option>
                </select>
                <div class="atnx-gantt-zoom-group">
                    <button type="button" onclick="ajustarZoomGantt(-0.15)" title="Diminuir zoom">−</button>
                    <span>${percentualZoomGantt}%</span>
                    <button type="button" onclick="ajustarZoomGantt(0.15)" title="Aumentar zoom">+</button>
                </div>
                <button type="button" class="atnx-gantt-tool-btn icon" onclick="alternarModoApresentacaoGantt()" title="Modo apresentação">${modoApresentacao ? '◉' : '◌'}</button>
            </div>`;

            const legenda = [
                { id: 'concluida', titulo: 'Concluído', cor: '#10b981' },
                { id: 'em_andamento', titulo: 'Em Progresso', cor: '#f5a623' },
                { id: 'parada', titulo: 'Parado', cor: '#e11d48' }
            ].map(st => `<span><i class="atnx-gantt-dot ${escaparHtml(st.id)}" style="background:${st.cor}"></i>${escaparHtml(st.titulo)}</span>`).join('');

            if (!itensComDatas.length) {
                return `<div class="atnx-gantt-wrap atnx-gantt-v12 ${ganttFullscreen ? 'atnx-gantt-fullscreen' : ''} ${modoApresentacao ? 'atnx-gantt-presentation-mode' : ''}">
                    <div class="atnx-gantt-v12-titlebar">
                        <div>
                            <div class="atnx-gantt-v12-title">RESUMO</div>
                            <div class="atnx-gantt-v12-subtitle">Semana atual: ${escaparHtml(semanaTexto)}</div>
                        </div>
                    </div>
                    ${toolbarGantt}
                    <div class="atnx-gantt-empty">Nenhuma obra em andamento ou concluída na semana atual com datas suficientes para montar o cronograma.</div>
                    <div class="atnx-gantt-v12-legend">${legenda}</div>
                </div>`;
            }

            const linhas = itensComDatas.map(reg => {
                const item = reg.item;
                const progresso = calcularProgressoAdminPonderado(item);
                const statusInfo = obterStatusAdminInfo(item.status || 'a_realizar');
                const infoConclusao = item.status === 'concluida' && item.data_conclusao ? `Concluída em ${formatarDataParaExibicao(item.data_conclusao)}` : statusInfo.titulo;
                const pos = calcularPosicaoGantt(reg.inicio, reg.fim);
                const statusId = item.status || 'a_realizar';
                const detalhes = [
                    { categoria: 'pop', ...calcularProgressoCategoriaAdmin(item, 'pop') },
                    { categoria: 'ceo', ...calcularProgressoCategoriaAdmin(item, 'ceo') },
                    { categoria: 'cto', ...calcularProgressoCategoriaAdmin(item, 'cto') }
                ];

                const linhasDetalhe = detalhes
                    .filter(det => {
                        // V1.2.3 — não exibir POP/CEO/CTO sem preenchimento no Gantt.
                        // Considera preenchido quando há quantidade planejada/documentada
                        // ou quando a categoria recebeu data própria. Datas herdadas da obra
                        // não fazem um item vazio aparecer no cronograma.
                        const datasDiretas = obterDatasCategoriaAdmin(item, det.categoria, { somenteCategoria: true });
                        const possuiQuantidade = obterQtdGantt(det.total) > 0 || obterQtdGantt(det.feito) > 0;
                        const possuiDataPropria = !!(datasDiretas.inicio || datasDiretas.previsao);
                        return possuiQuantidade || possuiDataPropria;
                    })
                    .map(det => {
                    const statusDet = obterStatusCategoriaAdmin(item, det.categoria);
                    const datasDet = obterDatasCategoriaAdmin(item, det.categoria);
                    const inicioDet = dataAdminParaDate(datasDet.inicio) || reg.inicio;
                    const fimBaseDet = dataAdminParaDate(datasDet.previsao) || reg.fim;
                    const fimDet = fimBaseDet && inicioDet && fimBaseDet < inicioDet ? inicioDet : fimBaseDet;
                    const posDet = calcularPosicaoGantt(inicioDet, fimDet);
                    const qtd = obterQtdGantt(det.feito);
                    const labelBase = `${det.label}${qtd > 0 ? ` (${qtd} UND)` : ''}`;
                    const labelBarra = `${labelBase} | ${item.cidade || 'Cidade sem nome'}`;
                    return `<div class="atnx-gantt-row atnx-gantt-row-child">
                        <div class="atnx-gantt-left atnx-gantt-left-child">
                            <div class="atnx-gantt-left-main">
                                <div class="atnx-gantt-city atnx-gantt-city-child">${escaparHtml(labelBase)}</div>
                            </div>
                            <div class="atnx-gantt-left-period">${escaparHtml(formatarPeriodoGantt(inicioDet, fimDet))}</div>
                        </div>
                        <div class="atnx-gantt-timeline atnx-gantt-timeline-child" style="width:${timelineWidth}px; background-size:${marcadoresTempo.grid}px 100%;">
                            ${renderBarraGantt(statusDet, posDet.left, posDet.width, labelBarra, `${labelBase} · ${formatarPeriodoGantt(inicioDet, fimDet)}`, true)}
                        </div>
                    </div>`;
                }).join('');

                const nomeObra = item.cidade || 'Cidade sem nome';
                return `<div class="atnx-gantt-group">
                    <div class="atnx-gantt-row atnx-gantt-row-parent">
                        <div class="atnx-gantt-left">
                            <div class="atnx-gantt-left-main">
                                <div class="atnx-gantt-city">${escaparHtml(nomeObra)}</div>
                                <div class="atnx-gantt-meta">${escaparHtml(infoConclusao)} · ${progresso.percentual}% documentado</div>
                            </div>
                            <div class="atnx-gantt-left-period">${escaparHtml(formatarPeriodoGantt(reg.inicio, reg.fim))}</div>
                        </div>
                        <div class="atnx-gantt-timeline" style="width:${timelineWidth}px; background-size:${marcadoresTempo.grid}px 100%;">
                            ${renderBarraGantt(statusId, pos.left, pos.width, nomeObra, `${nomeObra} · ${formatarPeriodoGantt(reg.inicio, reg.fim)}`, false)}
                        </div>
                    </div>
                    ${linhasDetalhe}
                </div>`;
            }).join('');

            return `<div class="atnx-gantt-wrap atnx-gantt-v12 ${ganttFullscreen ? 'atnx-gantt-fullscreen' : ''} ${classeZoomGantt} ${modoApresentacao ? 'atnx-gantt-presentation-mode' : ''}" style="${styleVars}">
                <div class="atnx-gantt-v12-titlebar">
                    <div>
                        <div class="atnx-gantt-v12-title">RESUMO</div>
                        <div class="atnx-gantt-v12-subtitle">Semana atual: ${escaparHtml(semanaTexto)} · ${totalEmAndamento} em andamento · ${totalConcluidasSemana} concluída(s) na semana</div>
                    </div>
                    <button type="button" class="atnx-gantt-v12-close" onclick="alternarTelaCheiaGantt()" title="Tela cheia / sair">${ganttFullscreen ? '×' : '⛶'}</button>
                </div>
                ${toolbarGantt}
                <div class="atnx-gantt-scroll">
                    <div class="atnx-gantt-grid" data-left-width="${leftWidth}" data-today-left="${hojeLeft}" style="width:${leftWidth + timelineWidth}px; --gantt-left-width:${leftWidth}px;">
                        ${todayLineFull}
                        <div class="atnx-gantt-header-row">
                            <div class="atnx-gantt-left-head"><span>Obra / item</span><span>Período</span></div>
                            <div class="atnx-gantt-timeline-head" style="width:${timelineWidth}px">
                                <div class="atnx-gantt-year-band">${anoAtual}</div>
                                <div class="atnx-gantt-months is-${marcadoresTempo.classe}" style="width:${timelineWidth}px">${marcadoresTempo.html}</div>
                            </div>
                        </div>
                        ${linhas}
                    </div>
                </div>
                <div class="atnx-gantt-v12-legend">${legenda}</div>
            </div>`;
        }


        // ==============================
        // Atlas V1.3 — Painel, Expansões por campos e Auditoria
        // ==============================
        const ATLAS_OBSERVACAO_CATEGORIAS = [
            'Sem categoria',
            'Pendência de campo',
            'Pendência de imagem',
            'Pendência de diagrama',
            'Aguardando validação',
            'Divergência de contagem',
            'Obra travada'
        ];

        const ATLAS_EXP_GRUPOS = [
            { id: 'em_progresso', titulo: 'Projetos em Progresso', cor: '#f6c700', icone: '›' },
            { id: 'grande_porte', titulo: 'Projetos Grande Porte', cor: '#8b5e4b', icone: '›' },
            { id: 'pequeno_porte', titulo: 'Projetos Pequeno Porte', cor: '#38bdf8', icone: '›' },
            { id: 'concluidos', titulo: 'Projetos Concluídos', cor: '#00c875', icone: '›' }
        ];

        const ATLAS_EXP_OBRA_FASES = [
            { id: 'kmz', titulo: 'KMZ', cor: '#0ea5e9' },
            { id: 'lancamento', titulo: 'LANÇAMENTO', cor: '#ec4899' },
            { id: 'fusoes', titulo: 'FUSÕES', cor: '#fb5a2d' },
            { id: 'homologacao_final', titulo: 'HOMOLOGAÇÃO FINAL', cor: '#f6c700' }
        ];

        function normalizarFaseObraExpansao(valor, nome = '') {
            const base = String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            const nomeNorm = String(nome || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            if (base === 'kmz' || nomeNorm.includes('kmz')) return 'kmz';
            if (base.includes('fus')) return 'fusoes';
            if (base.includes('homolog')) return 'homologacao_final';
            if (base.includes('lanc')) return 'lancamento';
            return 'lancamento';
        }

        function obterTituloFaseObraExpansao(faseId) {
            return (ATLAS_EXP_OBRA_FASES.find(f => f.id === faseId) || ATLAS_EXP_OBRA_FASES[1]).titulo;
        }

        function obterGrupoPadraoPorFaseExpansao(faseId) {
            if (faseId === 'homologacao_final') return 'concluidos';
            if (faseId === 'kmz') return 'em_progresso';
            return 'grande_porte';
        }

        function obterSemanaAtual() {
            const hoje = new Date();
            const dia = hoje.getDay();
            const diffSegunda = dia === 0 ? -6 : 1 - dia;
            const inicio = new Date(hoje);
            inicio.setHours(0, 0, 0, 0);
            inicio.setDate(hoje.getDate() + diffSegunda);
            const fim = new Date(inicio);
            fim.setDate(inicio.getDate() + 6);
            return { inicio: formatarDataISO(inicio), fim: formatarDataISO(fim) };
        }

        function formatarDataISO(data) {
            if (!(data instanceof Date) || Number.isNaN(data.getTime())) return '';
            return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
        }

        function dataEstaEntreISO(data, inicio, fim) {
            if (!data || !inicio || !fim) return false;
            return String(data).slice(0, 10) >= inicio && String(data).slice(0, 10) <= fim;
        }

        function formatarDataCurtaBr(valor) {
            if (!valor) return '-';
            const d = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
            if (Number.isNaN(d.getTime())) return escaparHtml(valor);
            return d.toLocaleDateString('pt-BR');
        }

        async function registrarAuditoria(acao, entidadeTipo, entidadeId, entidadeNome, campo = '', valorAnterior = '', valorNovo = '', detalhe = '') {
            if (!supabaseClient) return;
            try {
                const usuarioInfo = usuarioAuditoriaAtlas();
                await supabaseClient.from('atlas_auditoria').insert([{
                    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    acao: String(acao || ''),
                    entidade_tipo: String(entidadeTipo || ''),
                    entidade_id: String(entidadeId || ''),
                    entidade_nome: String(entidadeNome || ''),
                    campo: String(campo || ''),
                    valor_anterior: valorAnterior === null || valorAnterior === undefined ? '' : String(valorAnterior),
                    valor_novo: valorNovo === null || valorNovo === undefined ? '' : String(valorNovo),
                    detalhe: String(detalhe || ''),
                    usuario: usuarioInfo.usuario,
                    user_id: usuarioInfo.user_id,
                    usuario_email: usuarioInfo.usuario_email,
                    usuario_nome: usuarioInfo.usuario_nome,
                    usuario_role: usuarioInfo.usuario_role,
                    created_at: new Date().toISOString()
                }]);
            } catch (err) {
                console.warn('Auditoria não registrada:', err?.message || err);
            }
        }

        async function carregarAuditoria() {
            if (!supabaseClient) return;
            state.auditoriaCarregando = true;
            state.auditoriaErro = '';
            renderAuditoria();
            try {
                const { data, error } = await supabaseClient
                    .from('atlas_auditoria')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(150);
                if (error) throw error;
                state.auditoria = data || [];
            } catch (err) {
                state.auditoriaErro = err.message || String(err);
                state.auditoria = [];
            } finally {
                state.auditoriaCarregando = false;
                renderAuditoria();
            }
        }

        function abrirAuditoria() {
            if (!atlasTemPermissao('ver_auditoria')) {
                exigirPermissaoAtlas('ver_auditoria', 'abrir auditoria');
                return;
            }
            state.auditoriaAberta = true;
            state.auditoriaTermo = '';
            const overlay = document.getElementById('atlas-auditoria-overlay');
            const input = document.getElementById('atlas-auditoria-search');
            overlay?.classList.remove('hidden');
            document.body?.classList.add('atlas-auditoria-open');
            if (input) input.value = '';
            if (!state.auditoria?.length && !state.auditoriaCarregando) carregarAuditoria();
            else renderAuditoria();
            setTimeout(() => input?.focus(), 80);
        }

        function fecharAuditoria(event) {
            if (event && event.target && event.currentTarget && event.target !== event.currentTarget) return;
            state.auditoriaAberta = false;
            const overlay = document.getElementById('atlas-auditoria-overlay');
            overlay?.classList.add('hidden');
            document.body?.classList.remove('atlas-auditoria-open');
        }

        function filtrarAuditoria(valor) {
            state.auditoriaTermo = String(valor || '');
            renderAuditoria();
        }

        function renderAuditoria() {
            const drawerBody = document.getElementById('atlas-auditoria-body');
            const painelLegado = document.getElementById('painel-auditoria');
            const destino = state.auditoriaAberta && drawerBody ? drawerBody : painelLegado;
            if (!destino) return;

            if (painelLegado) painelLegado.classList.add('hidden');

            if (state.auditoriaCarregando) {
                destino.innerHTML = `<div class="atlas-auditoria-state">Carregando auditoria...</div>`;
                return;
            }
            if (state.auditoriaErro) {
                destino.innerHTML = `<div class="atlas-auditoria-state atlas-auditoria-state-warn"><h3>Auditoria aguardando SQL</h3><p>${escaparHtml(state.auditoriaErro)}</p><p>Rode o SQL da V1.3 no Supabase para ativar o histórico de alterações.</p></div>`;
                return;
            }
            const termo = String(state.auditoriaTermo || '').toLowerCase();
            const itens = (state.auditoria || []).filter(item => [item.acao, item.entidade_tipo, item.entidade_nome, item.campo, item.valor_anterior, item.valor_novo, item.detalhe, item.usuario].join(' ').toLowerCase().includes(termo));

            if (!itens.length) {
                destino.innerHTML = `<div class="atlas-auditoria-state">Nenhuma alteração encontrada.</div>`;
                return;
            }

            const cards = itens.map(item => {
                const acao = escaparHtml(item.acao || '-');
                const tipo = escaparHtml(item.entidade_tipo || '');
                const nome = escaparHtml(item.entidade_nome || '-');
                const campo = escaparHtml(item.campo || '-');
                const antes = escaparHtml(item.valor_anterior || '-');
                const depois = escaparHtml(item.valor_novo || '-');
                const detalhe = escaparHtml(item.detalhe || '');
                const usuario = escaparHtml(item.usuario_nome || item.usuario || item.usuario_email || 'Atlas');
                const usuarioRole = escaparHtml(obterLabelRoleAtlas(item.usuario_role || ''));
                return `<article class="atlas-auditoria-item">
                    <div class="atlas-auditoria-item-top">
                        <span class="atlas-auditoria-action">${acao}</span>
                        <time>${formatarDataHoraAtnx(item.created_at)}</time>
                    </div>
                    <div class="atlas-auditoria-entity">${nome}</div>
                    <div class="atlas-auditoria-meta"><span>${tipo}</span><span>${campo}</span><span>${usuario}</span><span>${usuarioRole}</span></div>
                    <div class="atlas-auditoria-change">
                        <div><small>Antes</small><strong>${antes}</strong></div>
                        <div><small>Depois</small><strong>${depois}</strong></div>
                    </div>
                    ${detalhe ? `<p class="atlas-auditoria-detail">${detalhe}</p>` : ''}
                </article>`;
            }).join('');

            destino.innerHTML = `<div class="atlas-auditoria-count">${itens.length} registro(s)</div>${cards}`;
        }

        function formatarDataHoraAtnx(valor) {
            if (!valor) return '-';
            const d = new Date(valor);
            if (Number.isNaN(d.getTime())) return escaparHtml(valor);
            return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        }

        function renderPainelExecutivoAtual() {
            if (state.moduloAtivo === 'admin_obras' && (state.adminVisualizacao || 'status') === 'painel') renderAdminObras();
            else renderExecutivo();
        }

        async function carregarDadosExecutivo() {
            if (!supabaseClient) return;
            state.executivoCarregando = true;
            state.executivoErro = '';
            renderPainelExecutivoAtual();
            try {
                if (!state.adminObras || state.adminObras.length === 0) await carregarAdminObras();
                const { data, error } = await supabaseClient
                    .from('atlas_historico_semanal')
                    .select('*')
                    .order('semana_inicio', { ascending: false })
                    .order('cidade', { ascending: true })
                    .limit(500);
                if (error) throw error;
                state.historicoSemanal = data || [];
            } catch (err) {
                state.executivoErro = err.message || String(err);
            } finally {
                state.executivoCarregando = false;
                renderPainelExecutivoAtual();
            }
        }

        function obterMetricasExecutivas() {
            const semana = obterSemanaAtual();
            const obras = state.adminObras || [];
            const acc = obras.reduce((total, item) => {
                const prog = calcularProgressoAdmin(item || {});
                total.totalCidades += 1;
                total.totalItens += prog.total;
                total.feitoItens += prog.feito;
                total.ctos += normalizarNumeroAdmin(item.ctos_documentadas);
                total.ceos += normalizarNumeroAdmin(item.caixas_documentadas);
                total.pops += normalizarNumeroAdmin(item.pops_documentados);
                if ((item.status || 'a_realizar') === 'em_andamento') total.emAndamento += 1;
                if ((item.status || '') === 'parada') total.paradas += 1;
                if ((item.status || '') === 'concluida' && dataEstaEntreISO(item.data_conclusao, semana.inicio, semana.fim)) total.concluidasSemana += 1;
                return total;
            }, { totalCidades: 0, totalItens: 0, feitoItens: 0, ctos: 0, ceos: 0, pops: 0, emAndamento: 0, paradas: 0, concluidasSemana: 0 });
            acc.percentual = acc.totalItens > 0 ? Math.round((acc.feitoItens / acc.totalItens) * 100) : 0;
            acc.semana = semana;
            return acc;
        }

        function calcularEvolucaoHistorico() {
            const hist = state.historicoSemanal || [];
            const semanas = [...new Set(hist.map(h => h.semana_inicio).filter(Boolean))].sort().reverse();
            if (!semanas.length) return { atual: null, anterior: null, delta: null };
            const media = semana => {
                const linhas = hist.filter(h => h.semana_inicio === semana);
                const total = linhas.reduce((acc, h) => acc + Number(h.percentual_real || 0), 0);
                return linhas.length ? Math.round(total / linhas.length) : 0;
            };
            const atual = media(semanas[0]);
            const anterior = semanas[1] ? media(semanas[1]) : null;
            return { atual, anterior, delta: anterior === null ? null : atual - anterior, semanaAtual: semanas[0], semanaAnterior: semanas[1] || null };
        }

        function renderPainelExecutivoConteudo() {
            if (state.executivoCarregando) {
                return `<div class="atlas-v13-card atlas-v13-empty">Carregando painel...</div>`;
            }

            const m = obterMetricasExecutivas();
            const evol = calcularEvolucaoHistorico();
            const erroSql = state.executivoErro ? `<div class="atlas-v13-warning">Histórico semanal ainda não ativo: ${escaparHtml(state.executivoErro)}. Rode o SQL da V1.3 para ativar snapshots.</div>` : '';
            const evolTexto = evol.delta === null ? 'Sem histórico anterior' : `${evol.delta >= 0 ? '+' : ''}${evol.delta}%`;
            const historicoLinhas = (state.historicoSemanal || []).slice(0, 12).map(h => `<tr>
                <td>${formatarDataCurtaBr(h.semana_inicio)} - ${formatarDataCurtaBr(h.semana_fim)}</td>
                <td>${escaparHtml(h.cidade || '-')}</td>
                <td>${escaparHtml(obterStatusAdminInfo(h.status || 'a_realizar').titulo)}</td>
                <td>${normalizarNumeroAdmin(h.ctos_documentadas)}</td>
                <td>${normalizarNumeroAdmin(h.caixas_documentadas)}</td>
                <td>${normalizarNumeroAdmin(h.pops_documentados)}</td>
                <td><strong>${normalizarNumeroAdmin(h.percentual_real)}%</strong></td>
            </tr>`).join('') || `<tr><td colspan="7" class="atlas-v13-empty-cell">Nenhum snapshot semanal registrado ainda.</td></tr>`;

            return `${erroSql}
            <div class="atlas-v13-toolbar atlas-v13-toolbar-inline">
                <div><div class="atlas-v13-kicker">Semana atual: ${formatarDataCurtaBr(m.semana.inicio)} - ${formatarDataCurtaBr(m.semana.fim)}</div><h2>Painel</h2><p>Resumo semanal da Documentação Rede Geral, evolução e volume documentado.</p></div>
                <div class="atlas-v13-summary"><span>${m.totalCidades} cidade(s)</span><span>${m.feitoItens} itens documentados</span><span>${m.percentual}% geral</span></div>
            </div>
            <div class="atlas-v13-kpis">
                <div class="atlas-v13-kpi"><span>Em andamento</span><strong>${m.emAndamento}</strong></div>
                <div class="atlas-v13-kpi"><span>Concluídas na semana</span><strong>${m.concluidasSemana}</strong></div>
                <div class="atlas-v13-kpi"><span>Paradas</span><strong>${m.paradas}</strong></div>
                <div class="atlas-v13-kpi"><span>Evolução semanal</span><strong>${escaparHtml(evolTexto)}</strong></div>
                <div class="atlas-v13-kpi"><span>CTO documentadas</span><strong>${m.ctos}</strong></div>
                <div class="atlas-v13-kpi"><span>CEO documentadas</span><strong>${m.ceos}</strong></div>
                <div class="atlas-v13-kpi"><span>POP documentados</span><strong>${m.pops}</strong></div>
                <div class="atlas-v13-kpi"><span>% real geral</span><strong>${m.percentual}%</strong></div>
            </div>
            <div class="atlas-v13-card atlas-v13-table-card">
                <div class="atlas-v13-card-head"><h3>Histórico semanal de evolução</h3><p>Use “Registrar Semana” para salvar a fotografia da semana atual.</p></div>
                <table class="atlas-v13-table"><thead><tr><th>Semana</th><th>Cidade</th><th>Status</th><th>CTO</th><th>CEO</th><th>POP</th><th>% real</th></tr></thead><tbody>${historicoLinhas}</tbody></table>
            </div>`;
        }

        function renderExecutivo() {
            atualizarVisibilidadeModulos();
            const painel = document.getElementById('painel-executivo');
            const titulo = document.getElementById('txt-nome-obra');
            if (!painel || !titulo) return;
            titulo.innerText = 'Painel';
            document.getElementById('txt-grupo-ativo').innerHTML = '';
            painel.innerHTML = renderPainelExecutivoConteudo();
        }

        async function registrarSnapshotSemanal() {
            const semana = obterSemanaAtual();
            if (!state.adminObras || state.adminObras.length === 0) await carregarAdminObras();
            const obras = state.adminObras || [];
            if (!obras.length) {
                await alertaVisualAtnx('Sem cidades cadastradas', 'Cadastre cidades na Documentação Rede Geral antes de registrar a semana.');
                return;
            }
            const confirmado = await confirmarVisualAtnx('Registrar snapshot semanal', `Salvar a evolução de ${obras.length} cidade(s) para a semana ${formatarDataCurtaBr(semana.inicio)} - ${formatarDataCurtaBr(semana.fim)}?`, 'Registrar');
            if (!confirmado) return;
            try {
                const payload = obras.map(item => {
                    const progReal = calcularProgressoAdmin(item || {});
                    const progCorrigido = calcularProgressoAdminPonderado(item || {});
                    return {
                        id: `his-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        semana_inicio: semana.inicio,
                        semana_fim: semana.fim,
                        obra_id: item.id,
                        cidade: item.cidade || '',
                        status: item.status || 'a_realizar',
                        percentual_real: progReal.percentual,
                        percentual_corrigido: progCorrigido.percentual,
                        ctos_documentadas: normalizarNumeroAdmin(item.ctos_documentadas),
                        caixas_documentadas: normalizarNumeroAdmin(item.caixas_documentadas),
                        pops_documentados: normalizarNumeroAdmin(item.pops_documentados),
                        total_documentado: progReal.feito,
                        created_at: new Date().toISOString()
                    };
                });
                const { error } = await supabaseClient.from('atlas_historico_semanal').insert(payload);
                if (error) throw error;
                await registrarAuditoria('snapshot', 'historico_semanal', semana.inicio, 'Painel', 'semana', '', `${semana.inicio} - ${semana.fim}`, `${payload.length} cidade(s) registradas`);
                exibirStatusTemporario('✅ Snapshot semanal registrado.', 'bg-emerald-600');
                await carregarDadosExecutivo();
            } catch (err) {
                await alertaVisualAtnx('Erro ao registrar semana', err.message || String(err));
            }
        }

        function normalizarStatusExpansao(valor) {
            const texto = String(valor || '').trim().toLowerCase();
            if (texto.includes('conclu')) return 'concluido';
            if (texto.includes('progres') || texto.includes('andamento')) return 'em_progresso';
            if (texto.includes('parado')) return 'parado';
            if (texto.includes('invi')) return 'inviavel';
            return 'neutro';
        }

        function tituloStatusExpansao(valor) {
            const texto = String(valor || '').trim();
            return texto || 'Sem status';
        }

        function formatarNumeroExpansao(valor, casas = 0) {
            const n = Number(valor);
            if (!Number.isFinite(n)) return '-';
            return n.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });
        }

        function formatarDuracaoExpansao(valor) {
            const n = Number(valor);
            if (!Number.isFinite(n)) return '<span class="atlas-exp-na">N/A</span>';
            return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3, minimumFractionDigits: 3 })} dias`;
        }

        function formatarDataCurtaExpansao(valor) {
            return formatarDataCurtaBr(valor);
        }

        function formatarCampoExpansao(valor) {
            if (valor === null || valor === undefined || valor === '') return '-';
            return escaparHtml(valor);
        }

        function formatarMetragemExpansao(valor) {
            const n = Number(valor);
            if (!Number.isFinite(n)) return '-';
            return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m`;
        }

        function renderDuracaoCompletaExpansao(valor) {
            const texto = formatarDuracaoCompletaRangeExpansao(valor);
            return texto ? `<span class="atlas-exp-duration-pill">${escaparHtml(texto)}</span>` : '<span class="atlas-exp-muted">-</span>';
        }

        function renderLinkExpansao(valor, rotulo = 'abrir') {
            const link = String(valor || '').trim();
            if (!link) return '-';
            return `<button type="button" class="atlas-link atlas-exp-file-link atlas-attachment-inline-btn" onclick="atlasAbrirVisualizadorAnexoUnico('${escaparAtributoJs(link)}', '${escaparAtributoJs(rotulo)}', event)">${escaparHtml(rotulo)}</button>`;
        }

        function renderTextoExpansao(valor) {
            return formatarCampoExpansao(valor);
        }

        function renderDataConclusaoGrupoExpansao(projetos) {
            const datas = (projetos || []).map(p => String(p.data_conclusao || '').slice(0, 10)).filter(Boolean).sort();
            if (!datas.length) return '<strong class="atlas-exp-date-pill">-</strong>';
            const texto = datas.length === 1
                ? formatarDataCurtaExpansao(datas[0])
                : `${formatarDataCurtaExpansao(datas[0])} - ${formatarDataCurtaExpansao(datas[datas.length - 1])}`;
            return `<strong class="atlas-exp-date-pill is-filled">${escaparHtml(texto)}</strong>`;
        }

        function obterGrupoExpansao(id) {
            return ATLAS_EXP_GRUPOS.find(g => g.id === id) || ATLAS_EXP_GRUPOS[0];
        }

        function resolverGrupoExpansaoPorStatus(grupoAtual, status) {
            if (normalizarStatusExpansao(status) === 'concluido') return 'concluidos';
            return grupoAtual || 'em_progresso';
        }

        function aplicarGrupoAutomaticoExpansaoPorStatus(payload) {
            if (!payload || typeof payload !== 'object') return payload;
            payload.grupo = resolverGrupoExpansaoPorStatus(payload.grupo, payload.status);
            return payload;
        }

        async function carregarExpansoes() {
            if (!supabaseClient) return;
            state.expansoesCarregando = true;
            state.expansoesErro = '';
            renderExpansoes();
            atlasExibirOperacao('Carregando Expansões...', 'bg-[#0073ea]');
            try {
                const { data, error } = await supabaseClient
                    .from('atlas_expansoes')
                    .select('*')
                    .order('created_at', { ascending: true });
                if (error) throw error;
                state.expansoes = data || [];
                const ids = state.expansoes.map(p => p.id).filter(Boolean);
                if (ids.length) {
                    const { data: subs, error: subErr } = await supabaseClient
                        .from('atlas_expansoes_subitems')
                        .select('*')
                        .in('expansao_id', ids)
                        .order('created_at', { ascending: true });
                    if (subErr) throw subErr;
                    state.expansoesSubitems = subs || [];
                } else {
                    state.expansoesSubitems = [];
                }
                atlasExibirOperacao('Expansões carregadas.', 'bg-emerald-600');
            } catch (err) {
                state.expansoesErro = err.message || String(err);
                state.expansoes = [];
                state.expansoesSubitems = [];
                atlasExibirOperacao('Erro ao carregar Expansões: ' + state.expansoesErro, 'bg-red-600');
            } finally {
                state.expansoesCarregando = false;
                renderExpansoes();
            }
        }

        function filtrarProjetoExpansao(projeto, termo) {
            if (!termo) return true;
            const subs = (state.expansoesSubitems || []).filter(s => s.expansao_id === projeto.id);
            const alvo = [
                projeto.nome, projeto.status, projeto.empresa_fusao, projeto.empresa_lancamento,
                projeto.rotulo, projeto.novos_projetos, projeto.dependencia, projeto.numeros,
                ...subs.flatMap(sub => [sub.nome, sub.status, sub.equipe, sub.responsavel, sub.pessoas])
            ].join(' ').toLowerCase();
            return alvo.includes(termo);
        }

        const ATLAS_EXP_STATUS_OPTIONS = ['', 'Em Progresso', 'Parado', 'Concluído', 'Inviável'];
        const ATLAS_EXP_EMPRESA_OPTIONS = ['', 'Própria', 'Terceirizada'];
        const ATLAS_EXP_EMPRESA_FIELDS = new Set(['empresa_fusao', 'empresa_lancamento']);
        const ATLAS_EXP_FILE_FIELDS = new Set(['kmz', 'lista_materiais']);
        const ATLAS_EXP_FILE_CONFIG = {
            kmz: { label: 'KMZ', tipoMidia: 'kmz', pasta: 'KMZ', icon: 'KMZ', accept: '.kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml,application/octet-stream' },
            lista_materiais: { label: 'Lista de Materiais', tipoMidia: 'lista_materiais', pasta: 'Lista de Materiais', icon: 'XLS', accept: '.xls,.xlsx,.xlsm,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv' }
        };
        const ATLAS_EXP_NUMBER_FIELDS = new Set(['subelementos', 'duracao_lancamento', 'duracao_fusao', 'qtde_ctos', 'metragem_cabo', 'qtde_ceos', 'duracao_cto', 'duracao_ceo', 'equipes_lancamento', 'equipes_fusao', 'duracao', 'total_projetado', 'total_lancado', 'projetado', 'lancado', 'diferenca', 'slot', 'portas']);
        const ATLAS_EXP_DATE_FIELDS = new Set(['data_conclusao', 'timeline_inicio', 'timeline_fim', 'data_inicio', 'data_previsao_final', 'data']);
        const ATLAS_EXP_INT_FIELDS = new Set(['subelementos', 'qtde_ctos', 'qtde_ceos', 'total_projetado', 'total_lancado', 'projetado', 'lancado', 'slot', 'portas']);

        function renderBadgeStatusExpansao(status) {
            const chave = normalizarStatusExpansao(status);
            return `<span class="atlas-exp-status atlas-exp-status-${chave}">${escaparHtml(tituloStatusExpansao(status))}</span>`;
        }

        function classeStatusExpansao(valor) {
            return `atlas-exp-status-${normalizarStatusExpansao(valor)}`;
        }

        function normalizarValorCampoExpansao(campo, valor) {
            if (valor === undefined || valor === null) return null;
            const texto = String(valor).trim();
            if (texto === '') return null;
            if (campo === 'duracao_completa') return normalizarDuracaoCompletaExpansao(texto);
            if (ATLAS_EXP_EMPRESA_FIELDS.has(campo)) return normalizarEmpresaExpansao(texto) || null;
            if (ATLAS_EXP_NUMBER_FIELDS.has(campo)) {
                const n = Number(texto.replace(',', '.'));
                if (Number.isNaN(n)) return null;
                return ATLAS_EXP_INT_FIELDS.has(campo) ? Math.round(n) : n;
            }
            if (ATLAS_EXP_DATE_FIELDS.has(campo)) return texto || null;
            return texto;
        }

        function valorParaInputExpansao(valor) {
            if (valor === null || valor === undefined) return '';
            return String(valor);
        }

        function renderSelectStatusExpansao(valor, attrs = '') {
            const atual = valor || '';
            return `<select class="atlas-exp-cell-control atlas-exp-cell-select atlas-exp-status-select ${classeStatusExpansao(atual)}" ${attrs}>${ATLAS_EXP_STATUS_OPTIONS.map(op => `<option value="${escaparHtml(op)}" ${String(atual) === String(op) ? 'selected' : ''}>${escaparHtml(op || '-')}</option>`).join('')}</select>`;
        }

        function atualizarClasseSelectStatusExpansao(select) {
            if (!select) return;
            select.classList.remove('atlas-exp-status-concluido', 'atlas-exp-status-em_progresso', 'atlas-exp-status-parado', 'atlas-exp-status-inviavel', 'atlas-exp-status-neutro');
            select.classList.add(classeStatusExpansao(select.value));
        }

        function normalizarEmpresaExpansao(valor) {
            const texto = String(valor ?? '').trim();
            if (!texto) return '';
            const chave = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (chave === 'propria') return 'Própria';
            if (chave === 'terceirizada') return 'Terceirizada';
            return '';
        }

        function classeEmpresaExpansao(valor) {
            const normalizada = normalizarEmpresaExpansao(valor);
            if (normalizada === 'Própria') return 'atlas-exp-empresa-propria';
            if (normalizada === 'Terceirizada') return 'atlas-exp-empresa-terceirizada';
            return 'atlas-exp-empresa-vazio';
        }

        function atualizarClasseSelectEmpresaExpansao(select) {
            if (!select) return;
            select.classList.remove('atlas-exp-empresa-propria', 'atlas-exp-empresa-terceirizada', 'atlas-exp-empresa-vazio');
            select.classList.add(classeEmpresaExpansao(select.value));
        }

        function renderSelectEmpresaExpansao(valor, attrs = '') {
            const atual = normalizarEmpresaExpansao(valor);
            return `<select class="atlas-exp-cell-control atlas-exp-cell-select atlas-exp-empresa-select ${classeEmpresaExpansao(atual)}" ${attrs}>${ATLAS_EXP_EMPRESA_OPTIONS.map(op => `<option value="${escaparHtml(op)}" ${String(atual) === String(op) ? 'selected' : ''}>${escaparHtml(op)}</option>`).join('')}</select>`;
        }

        function dataIsoValidaExpansao(valor) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return false;
            const data = new Date(`${valor}T00:00:00`);
            return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
        }

        function isoDeDataBrExpansao(dia, mes, ano) {
            const dd = String(dia || '').padStart(2, '0');
            const mm = String(mes || '').padStart(2, '0');
            const yyyy = String(ano || '').padStart(4, '0');
            const iso = `${yyyy}-${mm}-${dd}`;
            return dataIsoValidaExpansao(iso) ? iso : '';
        }

        function extrairPeriodoDuracaoCompletaExpansao(valor) {
            const texto = String(valor || '').trim();
            if (!texto) return { inicio: '', fim: '', texto: '' };
            const iso = [...texto.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]);
            if (iso.length >= 2) return { inicio: dataIsoValidaExpansao(iso[0]) ? iso[0] : '', fim: dataIsoValidaExpansao(iso[1]) ? iso[1] : '', texto };
            if (iso.length === 1) return { inicio: dataIsoValidaExpansao(iso[0]) ? iso[0] : '', fim: '', texto };
            const br = [...texto.matchAll(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/g)];
            if (br.length >= 2) return { inicio: isoDeDataBrExpansao(br[0][1], br[0][2], br[0][3]), fim: isoDeDataBrExpansao(br[1][1], br[1][2], br[1][3]), texto };
            if (br.length === 1) return { inicio: isoDeDataBrExpansao(br[0][1], br[0][2], br[0][3]), fim: '', texto };
            return { inicio: '', fim: '', texto };
        }

        function formatarDataIsoCurtaExpansao(iso, incluirAno = false) {
            if (!dataIsoValidaExpansao(iso)) return '';
            const data = new Date(`${iso}T00:00:00`);
            const partes = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', ...(incluirAno ? { year: 'numeric' } : {}) }).formatToParts(data);
            const dia = partes.find(p => p.type === 'day')?.value || '';
            const mes = (partes.find(p => p.type === 'month')?.value || '').replace('.', '');
            const ano = partes.find(p => p.type === 'year')?.value || '';
            return incluirAno ? `${dia} ${mes} ${ano}` : `${dia} ${mes}`;
        }

        function montarValorDuracaoCompletaExpansao(inicio, fim) {
            const ini = dataIsoValidaExpansao(inicio) ? inicio : '';
            const end = dataIsoValidaExpansao(fim) ? fim : '';
            if (ini && end) return `${ini} - ${end}`;
            return ini || end || '';
        }

        function normalizarDuracaoCompletaExpansao(valor) {
            const periodo = extrairPeriodoDuracaoCompletaExpansao(valor);
            return montarValorDuracaoCompletaExpansao(periodo.inicio, periodo.fim) || valorTextoAdmin(valor) || null;
        }

        function formatarDuracaoCompletaRangeExpansao(valor) {
            const periodo = extrairPeriodoDuracaoCompletaExpansao(valor);
            if (periodo.inicio && periodo.fim) {
                const mesmoAno = periodo.inicio.slice(0, 4) === periodo.fim.slice(0, 4);
                return `${formatarDataIsoCurtaExpansao(periodo.inicio, !mesmoAno)} - ${formatarDataIsoCurtaExpansao(periodo.fim, true)}`;
            }
            if (periodo.inicio) return formatarDataIsoCurtaExpansao(periodo.inicio, true);
            return periodo.texto || '';
        }

        function renderControleDuracaoCompletaExpansao(valor, attrs = '', opcoes = {}) {
            const uid = `atlas-dr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
            const normalizado = normalizarDuracaoCompletaExpansao(valor) || '';
            const texto = formatarDuracaoCompletaRangeExpansao(normalizado) || opcoes.placeholder || 'Selecionar período';
            const vazio = normalizado ? '' : ' is-empty';
            return `<div class="atlas-exp-date-range${opcoes.form ? ' atlas-exp-date-range-form' : ''}" id="${uid}">
                <input type="hidden" value="${escaparHtml(normalizado)}" ${attrs} data-exp-date-range-value>
                <button type="button" class="atlas-exp-date-range-trigger${vazio}" onclick="abrirCalendarioDuracaoCompleta('${uid}', this)" title="Selecionar data de início e fim">
                    <span class="atlas-exp-date-range-text">${escaparHtml(texto)}</span>
                    <span class="atlas-exp-date-range-icon">▾</span>
                </button>
            </div>`;
        }

        function criarCampoPeriodoDuracaoCompletaExpansao({ label = 'Duração Completa', name = 'duracao_completa', value = '', placeholder = 'Selecionar início e fim' } = {}) {
            return `<label class="atnx-form-field atlas-exp-date-range-field"><span>${escaparHtml(label)}</span>${renderControleDuracaoCompletaExpansao(value, `name="${escaparHtml(name)}"`, { placeholder, form: true })}</label>`;
        }

        function obterPopoverDuracaoCompletaExpansao() {
            let popover = document.getElementById('atlas-date-range-popover');
            if (!popover) {
                popover = document.createElement('div');
                popover.id = 'atlas-date-range-popover';
                popover.className = 'atlas-date-range-popover hidden';
                document.body.appendChild(popover);
            }
            return popover;
        }

        function fecharCalendarioDuracaoCompleta() {
            const popover = document.getElementById('atlas-date-range-popover');
            if (popover) {
                popover.classList.add('hidden');
                popover.dataset.targetId = '';
            }
            document.removeEventListener('mousedown', fecharCalendarioDuracaoCompletaAoClicarFora, true);
        }

        function fecharCalendarioDuracaoCompletaAoClicarFora(event) {
            const popover = document.getElementById('atlas-date-range-popover');
            const targetId = popover?.dataset.targetId;
            const wrapper = targetId ? document.getElementById(targetId) : null;
            if (!popover || popover.classList.contains('hidden')) return;
            if (popover.contains(event.target) || wrapper?.contains(event.target)) return;
            fecharCalendarioDuracaoCompleta();
        }

        function atualizarPreviewCalendarioDuracaoCompleta() {
            const popover = document.getElementById('atlas-date-range-popover');
            if (!popover) return;
            const inicio = popover.querySelector('[data-range-start]')?.value || '';
            const fim = popover.querySelector('[data-range-end]')?.value || '';
            const preview = popover.querySelector('[data-range-preview]');
            const erro = popover.querySelector('[data-range-error]');
            const fimInput = popover.querySelector('[data-range-end]');
            if (fimInput && inicio) fimInput.min = inicio;
            if (erro) erro.textContent = '';
            if (!preview) return;
            const valor = montarValorDuracaoCompletaExpansao(inicio, fim);
            preview.textContent = formatarDuracaoCompletaRangeExpansao(valor) || 'Selecione as duas datas';
        }

        function posicionarPopoverDuracaoCompleta(trigger, popover) {
            const rect = trigger.getBoundingClientRect();
            popover.style.visibility = 'hidden';
            popover.classList.remove('hidden');
            const largura = popover.offsetWidth || 320;
            const altura = popover.offsetHeight || 220;
            let left = Math.min(Math.max(12, rect.left), window.innerWidth - largura - 12);
            let top = rect.bottom + 8;
            if (top + altura > window.innerHeight - 12) top = Math.max(12, rect.top - altura - 8);
            popover.style.left = `${left}px`;
            popover.style.top = `${top}px`;
            popover.style.visibility = 'visible';
        }

        function abrirCalendarioDuracaoCompleta(wrapperId, trigger) {
            const wrapper = document.getElementById(wrapperId);
            const hidden = wrapper?.querySelector('[data-exp-date-range-value]');
            if (!wrapper || !hidden) return;
            const popover = obterPopoverDuracaoCompletaExpansao();
            if (!popover.classList.contains('hidden') && popover.dataset.targetId === wrapperId) {
                fecharCalendarioDuracaoCompleta();
                return;
            }
            const periodo = extrairPeriodoDuracaoCompletaExpansao(hidden.value);
            popover.dataset.targetId = wrapperId;
            popover.innerHTML = `<div class="atlas-date-range-popover-head">
                    <strong>Duração completa</strong>
                    <button type="button" onclick="fecharCalendarioDuracaoCompleta()" aria-label="Fechar calendário">×</button>
                </div>
                <div class="atlas-date-range-popover-grid">
                    <label><span>Início</span><input type="date" data-range-start value="${escaparHtml(periodo.inicio)}" onchange="atualizarPreviewCalendarioDuracaoCompleta()"></label>
                    <label><span>Fim</span><input type="date" data-range-end value="${escaparHtml(periodo.fim)}" onchange="atualizarPreviewCalendarioDuracaoCompleta()"></label>
                </div>
                <div class="atlas-date-range-preview" data-range-preview>${escaparHtml(formatarDuracaoCompletaRangeExpansao(hidden.value) || 'Selecione as duas datas')}</div>
                <div class="atlas-date-range-error" data-range-error></div>
                <div class="atlas-date-range-actions">
                    <button type="button" class="atlas-date-range-clear" onclick="limparCalendarioDuracaoCompleta()">Limpar</button>
                    <button type="button" class="atlas-date-range-apply" onclick="aplicarCalendarioDuracaoCompleta()">Aplicar</button>
                </div>`;
            posicionarPopoverDuracaoCompleta(trigger || wrapper, popover);
            atualizarPreviewCalendarioDuracaoCompleta();
            setTimeout(() => {
                document.addEventListener('mousedown', fecharCalendarioDuracaoCompletaAoClicarFora, true);
                popover.querySelector('[data-range-start]')?.focus();
            }, 0);
        }

        function atualizarControleDuracaoCompletaExpansao(wrapper, valor) {
            const hidden = wrapper?.querySelector('[data-exp-date-range-value]');
            const textoEl = wrapper?.querySelector('.atlas-exp-date-range-text');
            const trigger = wrapper?.querySelector('.atlas-exp-date-range-trigger');
            if (hidden) hidden.value = valor || '';
            if (textoEl) textoEl.textContent = formatarDuracaoCompletaRangeExpansao(valor) || 'Selecionar período';
            if (trigger) trigger.classList.toggle('is-empty', !valor);
        }

        async function aplicarValorDuracaoCompletaExpansao(valor) {
            const popover = document.getElementById('atlas-date-range-popover');
            const wrapper = popover?.dataset.targetId ? document.getElementById(popover.dataset.targetId) : null;
            const hidden = wrapper?.querySelector('[data-exp-date-range-value]');
            if (!wrapper || !hidden) return;
            atualizarControleDuracaoCompletaExpansao(wrapper, valor);
            const id = hidden.getAttribute('data-exp-id');
            const campo = hidden.getAttribute('data-exp-campo');
            const tipo = hidden.getAttribute('data-exp-tipo') || 'projeto';
            const tabela = hidden.getAttribute('data-exp-tabela') || (tipo === 'subitem' ? 'atlas_expansoes_subitems' : 'atlas_expansoes');
            fecharCalendarioDuracaoCompleta();
            if (id && campo) await salvarCampoExpansao(tabela, id, campo, valor, tipo);
        }

        async function aplicarCalendarioDuracaoCompleta() {
            const popover = document.getElementById('atlas-date-range-popover');
            if (!popover) return;
            const inicio = popover.querySelector('[data-range-start]')?.value || '';
            const fim = popover.querySelector('[data-range-end]')?.value || '';
            const erro = popover.querySelector('[data-range-error]');
            if (inicio && fim && fim < inicio) {
                if (erro) erro.textContent = 'A data final não pode ser anterior à data inicial.';
                return;
            }
            await aplicarValorDuracaoCompletaExpansao(montarValorDuracaoCompletaExpansao(inicio, fim));
        }

        async function limparCalendarioDuracaoCompleta() {
            await aplicarValorDuracaoCompletaExpansao('');
        }

        window.addEventListener('resize', fecharCalendarioDuracaoCompleta);
        window.addEventListener('scroll', fecharCalendarioDuracaoCompleta, true);

        function calcularDiasUteisExpansao(inicio, fim) {
            if (!inicio || !fim) return null;
            const ini = new Date(`${inicio}T00:00:00`);
            const end = new Date(`${fim}T00:00:00`);
            if (Number.isNaN(ini.getTime()) || Number.isNaN(end.getTime()) || end < ini) return null;
            let dias = 0;
            const atual = new Date(ini);
            while (atual <= end) {
                const dia = atual.getDay();
                if (dia !== 0 && dia !== 6) dias += 1;
                atual.setDate(atual.getDate() + 1);
            }
            return dias;
        }

        function renderDuracaoAutomaticaExpansao(sub) {
            const calculada = calcularDiasUteisExpansao(sub?.timeline_inicio, sub?.timeline_fim);
            const valor = calculada ?? sub?.duracao ?? null;
            return `<span class="atlas-exp-cell-control atlas-exp-readonly" data-exp-duracao-id="${escaparHtml(sub?.id || '')}">${valor === null || valor === undefined || valor === '' ? '-' : escaparHtml(valor)}</span>`;
        }

        function extrairFileIdDriveExpansao(valor) {
            const texto = String(valor || '').trim();
            if (!texto) return '';
            const padroes = [
                /\/d\/([a-zA-Z0-9_-]{20,})/,
                /[?&]id=([a-zA-Z0-9_-]{20,})/,
                /\/folders\/([a-zA-Z0-9_-]{20,})/,
                /^([a-zA-Z0-9_-]{20,})$/
            ];
            for (const padrao of padroes) {
                const match = texto.match(padrao);
                if (match && match[1]) return match[1];
            }
            return '';
        }

        function montarThumbnailDriveExpansao(fileId) {
            return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000` : '';
        }

        function montarUrlVisualizacaoDriveExpansao(fileId) {
            return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view` : '';
        }

        function montarUrlDiretaDriveExpansao(fileId) {
            return fileId ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}` : '';
        }

        function normalizarMidiaExpansao(item, indice = 0) {
            if (item === null || item === undefined) return null;

            if (typeof item === 'string') {
                const link = item.trim();
                if (!link || /^\d+\s+imagens?\s+no\s+drive$/i.test(link)) return null;
                const fileId = extrairFileIdDriveExpansao(link);
                return {
                    nome: `Imagem ${indice + 1}`,
                    url: fileId ? montarUrlDiretaDriveExpansao(fileId) : link,
                    thumbnailUrl: fileId ? montarThumbnailDriveExpansao(fileId) : link,
                    viewUrl: fileId ? montarUrlVisualizacaoDriveExpansao(fileId) : link,
                    fileId,
                    mimeType: '',
                    origem: 'link_manual',
                    importado: true,
                    criadoPeloAtnx: false,
                    tipo: 'imagens'
                };
            }

            if (typeof item !== 'object') return null;

            const fileId = String(item.fileId || item.idArquivo || extrairFileIdDriveExpansao(item.viewUrl || item.webViewLink || item.url || item.link || item.thumbnailUrl || '') || '').trim();
            const viewUrl = String(item.viewUrl || item.webViewLink || item.link || (fileId ? montarUrlVisualizacaoDriveExpansao(fileId) : item.url || '') || '').trim();
            const url = String(item.url || item.webContentLink || (fileId ? montarUrlDiretaDriveExpansao(fileId) : viewUrl) || '').trim();
            const thumbnailUrl = String(item.thumbnailUrl || item.thumbnail || item.thumb || (fileId ? montarThumbnailDriveExpansao(fileId) : url || viewUrl) || '').trim();

            if (!fileId && !viewUrl && !url && !thumbnailUrl) return null;

            return {
                ...item,
                nome: item.nome || item.name || `Imagem ${indice + 1}`,
                url,
                thumbnailUrl,
                viewUrl: viewUrl || url || thumbnailUrl,
                fileId,
                mimeType: item.mimeType || item.tipoMime || '',
                folderId: item.folderId || item.folderIds?.midiaFolderId || item.pastaId || '',
                folderIds: item.folderIds || item.pastas || {},
                origem: item.origem || item.origin || 'google_drive',
                importado: item.importado === undefined ? false : !!item.importado,
                criadoPeloAtnx: item.criadoPeloAtnx === undefined ? item.origem === 'atnx_upload' : !!item.criadoPeloAtnx,
                tipo: item.tipo || 'imagens'
            };
        }

        function normalizarMidiasExpansao(valor) {
            if (!valor) return [];

            if (Array.isArray(valor)) {
                return valor.map((item, indice) => normalizarMidiaExpansao(item, indice)).filter(Boolean);
            }

            if (typeof valor === 'object') {
                return [normalizarMidiaExpansao(valor, 0)].filter(Boolean);
            }

            const texto = String(valor || '').trim();
            if (!texto) return [];

            try {
                const parsed = JSON.parse(texto);
                return normalizarMidiasExpansao(parsed);
            } catch (err) {
                return texto
                    .split(/[\n,;]+/)
                    .map((link, indice) => normalizarMidiaExpansao(link, indice))
                    .filter(Boolean);
            }
        }

        function chaveMidiaExpansao(midia) {
            return String(midia?.fileId || midia?.viewUrl || midia?.url || midia?.thumbnailUrl || '').trim();
        }

        function deduplicarMidiasExpansao(midias) {
            const vistos = new Set();
            const resultado = [];
            (midias || []).forEach((midia, indice) => {
                const normalizada = normalizarMidiaExpansao(midia, indice);
                const chave = chaveMidiaExpansao(normalizada);
                if (!normalizada || !chave || vistos.has(chave)) return;
                vistos.add(chave);
                resultado.push(normalizada);
            });
            return resultado;
        }

        function serializarMidiasExpansao(midias) {
            const lista = deduplicarMidiasExpansao(midias);
            return lista.length ? JSON.stringify(lista) : null;
        }

        function obterLinksImagensExpansao(valor) {
            return normalizarMidiasExpansao(valor)
                .map(item => String(item.viewUrl || item.url || item.link || '').trim())
                .filter(Boolean);
        }

        function montarTextoLinksImagensExpansao(valorAtual, novosLinks) {
            const midiasAtuais = normalizarMidiasExpansao(valorAtual);
            const novasMidias = (novosLinks || []).map((link, indice) => normalizarMidiaExpansao(link, midiasAtuais.length + indice)).filter(Boolean);
            return serializarMidiasExpansao([...midiasAtuais, ...novasMidias]);
        }

        function resumoImagensExpansao(valor) {
            const midias = normalizarMidiasExpansao(valor);
            if (midias.length === 0) return '';
            if (midias.length === 1) return midias[0].nome || '1 imagem';
            return `${midias.length} imagens`;
        }

        function obterConfigArquivoExpansao(campo) {
            return ATLAS_EXP_FILE_CONFIG[campo] || { label: 'Arquivo', tipoMidia: campo || 'arquivo', pasta: 'Arquivos', icon: 'ARQ', accept: '' };
        }

        function normalizarArquivoExpansao(item, campo = 'arquivo', indice = 0) {
            const cfg = obterConfigArquivoExpansao(campo);
            if (item === null || item === undefined) return null;

            if (typeof item === 'string') {
                const link = item.trim();
                if (!link) return null;
                const fileId = extrairFileIdDriveExpansao(link);
                return {
                    nome: `${cfg.label} ${indice + 1}`,
                    url: fileId ? montarUrlDiretaDriveExpansao(fileId) : link,
                    thumbnailUrl: fileId ? montarThumbnailDriveExpansao(fileId) : '',
                    viewUrl: fileId ? montarUrlVisualizacaoDriveExpansao(fileId) : link,
                    fileId,
                    mimeType: '',
                    origem: 'link_manual',
                    importado: true,
                    criadoPeloAtnx: false,
                    tipo: cfg.tipoMidia
                };
            }

            const midia = normalizarMidiaExpansao(item, indice);
            if (!midia) return null;
            return {
                ...midia,
                nome: midia.nome || midia.name || `${cfg.label} ${indice + 1}`,
                tipo: midia.tipo || cfg.tipoMidia,
                thumbnailUrl: midia.thumbnailUrl || (midia.fileId ? montarThumbnailDriveExpansao(midia.fileId) : '')
            };
        }

        function normalizarArquivosExpansao(valor, campo = 'arquivo') {
            if (!valor) return [];
            if (Array.isArray(valor)) return valor.map((item, indice) => normalizarArquivoExpansao(item, campo, indice)).filter(Boolean);
            if (typeof valor === 'object') return [normalizarArquivoExpansao(valor, campo, 0)].filter(Boolean);

            const texto = String(valor || '').trim();
            if (!texto) return [];
            try {
                const parsed = JSON.parse(texto);
                return normalizarArquivosExpansao(parsed, campo);
            } catch (err) {
                return texto.split(/[\n,;]+/).map((link, indice) => normalizarArquivoExpansao(link, campo, indice)).filter(Boolean);
            }
        }

        function serializarArquivosExpansao(arquivos, campo = 'arquivo') {
            const vistos = new Set();
            const lista = [];
            (arquivos || []).forEach((arquivo, indice) => {
                const normalizado = normalizarArquivoExpansao(arquivo, campo, indice);
                const chave = String(normalizado?.fileId || normalizado?.viewUrl || normalizado?.url || '').trim();
                if (!normalizado || !chave || vistos.has(chave)) return;
                vistos.add(chave);
                lista.push(normalizado);
            });
            return lista.length ? JSON.stringify(lista) : null;
        }

        function resumoArquivosExpansao(valor, campo = 'arquivo') {
            const arquivos = normalizarArquivosExpansao(valor, campo);
            if (arquivos.length === 0) return '';
            if (arquivos.length === 1) return arquivos[0].nome || obterConfigArquivoExpansao(campo).label;
            return `${arquivos.length} arquivos`;
        }

        function obterUrlImagemExpansao(midia) {
            return String(midia?.thumbnailUrl || midia?.url || midia?.viewUrl || '').trim();
        }

        function obterUrlAbrirImagemExpansao(midia) {
            return String(midia?.viewUrl || midia?.url || midia?.thumbnailUrl || '#').trim();
        }

        function obterFolderIdImagemExpansao(midia) {
            return String(midia?.folderId || midia?.folderIds?.midiaFolderId || midia?.folderIds?.subelementoFolderId || '').trim();
        }

        function coletarFileIdsMidiasExpansao(midias) {
            const ids = [];
            const vistos = new Set();
            (midias || []).forEach(midia => {
                const normalizada = normalizarMidiaExpansao(midia);
                const id = String(normalizada?.fileId || '').trim();
                if (!id || vistos.has(id)) return;
                vistos.add(id);
                ids.push(id);
            });
            return ids;
        }

        function obterFolderIdEntidadeExpansao(tipo, midias) {
            const lista = (midias || []).map(midia => normalizarMidiaExpansao(midia)).filter(Boolean);
            const candidatos = [];
            lista.forEach(midia => {
                const pastas = midia.folderIds || {};
                if (tipo === 'projeto') {
                    // No Apps Script de Expansões, tipoFolderId representa a pasta do projeto.
                    candidatos.push(pastas.tipoFolderId, pastas.expansaoFolderId, pastas.projetoFolderId);
                    // Para imagens diretas do projeto, subelementoFolderId também aponta para o projeto.
                    if (!pastas.subitemFolderId && !pastas.subitemId) candidatos.push(pastas.subelementoFolderId);
                } else {
                    candidatos.push(pastas.subelementoFolderId, pastas.subitemFolderId, pastas.itemFolderId);
                }
            });
            return String(candidatos.find(Boolean) || '').trim();
        }

        function obterSubitemsDaExpansao(expansaoId) {
            return (state.expansoesSubitems || []).filter(sub => sub.expansao_id === expansaoId);
        }

        function coletarMidiasEntidadeExpansao(tipo, item) {
            if (!item) return [];
            if (tipo === 'subitem') return normalizarMidiasExpansao(item.imagens);
            const midiasProjeto = normalizarMidiasExpansao(item.imagens);
            const arquivosProjeto = [
                ...normalizarArquivosExpansao(item.kmz, 'kmz'),
                ...normalizarArquivosExpansao(item.lista_materiais, 'lista_materiais')
            ];
            const midiasSubitems = obterSubitemsDaExpansao(item.id)
                .flatMap(sub => normalizarMidiasExpansao(sub.imagens));
            return [...midiasProjeto, ...arquivosProjeto, ...midiasSubitems];
        }

        async function excluirEntidadeExpansaoNoGoogleDrive(tipo, item, midiasOpcional = null) {
            const midias = midiasOpcional || coletarMidiasEntidadeExpansao(tipo, item);
            const fileIds = coletarFileIdsMidiasExpansao(midias);
            const folderId = obterFolderIdEntidadeExpansao(tipo === 'subitem' ? 'subitem' : 'projeto', midias);
            const projeto = tipo === 'subitem'
                ? (state.expansoes || []).find(p => p.id === item?.expansao_id)
                : item;
            const grupo = obterGrupoExpansao(projeto?.grupo || 'em_progresso');

            const payload = {
                action: 'deleteExpansionEntity',
                modulo: 'expansoes',
                rootFolderId: GOOGLE_DRIVE_EXPANSOES_FOLDER_ID,
                targetType: tipo === 'subitem' ? 'subitem' : 'projeto',
                folderId,
                fileIds,
                grupoId: projeto?.grupo || 'em_progresso',
                grupoNome: grupo?.titulo || 'Projetos em Progresso',
                expansaoId: projeto?.id || '',
                expansaoNome: projeto?.nome || item?.nome || 'Projeto sem nome',
                subitemId: tipo === 'subitem' ? item?.id || '' : '',
                subitemNome: tipo === 'subitem' ? item?.nome || '' : ''
            };

            return await chamarEndpointGoogleDrive(
                payload,
                'O endpoint do Google Drive não retornou JSON válido ao excluir item de Expansões. Atualize o Apps Script do pacote.'
            );
        }

        function abrirPastaImagensExpansao(tipo, id, campo, event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const lista = tipo === 'subitem' ? state.expansoesSubitems : state.expansoes;
            const item = (lista || []).find(reg => reg.id === id);
            const midias = normalizarMidiasExpansao(item?.[campo]);
            const folderId = midias.map(obterFolderIdImagemExpansao).find(Boolean);
            if (folderId) {
                window.open(`https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`, '_blank', 'noopener,noreferrer');
                return;
            }
            abrirDriveExpansoes(event);
        }

        async function excluirImagemExpansao(tipo, id, campo, index, event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();

            const tabela = tipo === 'subitem' ? 'atlas_expansoes_subitems' : 'atlas_expansoes';
            const lista = tipo === 'subitem' ? state.expansoesSubitems : state.expansoes;
            const item = (lista || []).find(reg => reg.id === id);
            const midias = normalizarMidiasExpansao(item?.[campo]);
            const midia = midias[index];
            if (!item || !midia) return;

            const nome = midia.nome || `Imagem ${index + 1}`;
            const fileId = String(midia.fileId || extrairFileIdDriveExpansao(midia.viewUrl || midia.url || midia.thumbnailUrl || '') || '').trim();
            const mensagem = fileId
                ? `Excluir ${nome}?

A imagem será removida do sistema e também enviada para a lixeira no Google Drive.`
                : `Remover ${nome} do sistema?

Não encontrei o ID do arquivo no Drive. O Atlas removerá apenas o registro do sistema porque não consegue localizar o arquivo no Google Drive.`;
            const confirmado = await confirmarVisualAtnx('Remover imagem de Expansões', mensagem, 'Remover');
            if (!confirmado) return;

            try {
                exibirStatusTemporario('🗑️ Removendo imagem de Expansões...', 'bg-[#0073ea]');
                if (fileId) {
                    await excluirArquivoNoGoogleDrive(fileId, 'expansoes');
                }

                midias.splice(index, 1);
                const novoValor = serializarMidiasExpansao(midias);
                const { error } = await supabaseClient
                    .from(tabela)
                    .update({ [campo]: novoValor, updated_at: new Date().toISOString() })
                    .eq('id', id);
                if (error) throw error;

                atualizarEstadoLocalExpansao(tipo, id, campo, novoValor);
                await registrarAuditoria(
                    'edição',
                    tipo === 'subitem' ? 'expansao_subitem' : 'expansao',
                    id,
                    item?.nome || id,
                    campo,
                    nome,
                    'removida',
                    fileId ? 'Imagem de Expansões excluída do Google Drive e do sistema' : 'Imagem de Expansões removida do sistema; sem fileId para excluir no Drive'
                );
                exibirStatusTemporario(fileId ? '✅ Imagem removida do sistema e do Google Drive.' : '✅ Imagem removida do sistema. Sem ID para excluir no Drive.', 'bg-emerald-600');
                renderExpansoes();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao remover imagem: ' + (err.message || String(err)), 'bg-red-600');
                await alertaVisualAtnx('Erro ao remover imagem', err.message || String(err));
            }
        }

        function renderMiniaturasImagensExpansao(tipo, id, campo, valor) {
            const midias = normalizarMidiasExpansao(valor);
            const chaveAnexos = atlasRegistrarAnexosVisualizador(`expansoes:${tipo}:${id}:${campo}:imagens`, midias);
            const thumbs = midias.map((midia, index) => {
                const imgUrl = escaparHtml(obterUrlImagemExpansao(midia));
                const nome = escaparHtml(midia.nome || `Imagem ${index + 1}`);
                if (!imgUrl) return '';
                return `<div class="atlas-exp-media-item" title="${nome}">
                    <button type="button" class="atlas-attachment-thumb-button" onclick="atlasAbrirVisualizadorRegistrado('${escaparAtributoJs(chaveAnexos)}', ${index}, event, 'Imagens de Expansões')">
                        <img src="${imgUrl}" alt="${nome}" loading="lazy" onerror="this.closest('.atlas-exp-media-item')?.classList.add('is-broken'); this.style.display='none';">
                        <span class="atlas-exp-media-fallback">IMG</span>
                    </button>
                    <button type="button" class="atlas-exp-media-delete" onclick="excluirImagemExpansao('${tipo}', '${escaparHtml(id)}', '${escaparHtml(campo)}', ${index}, event)" title="Remover imagem do sistema e do Google Drive">×</button>
                </div>`;
            }).join('');

            const contador = midias.length ? `<span class="atlas-exp-media-count">${midias.length}</span>` : '';
            const vazio = midias.length ? '' : '<span class="atlas-exp-media-empty">Sem imagens</span>';

            return `<div class="atlas-exp-media-cell" data-exp-id="${escaparHtml(id)}" data-exp-tipo="${tipo}" data-exp-campo="${escaparHtml(campo)}">
                <div class="atlas-exp-media-thumbs">${thumbs || vazio}</div>
                <div class="atlas-exp-media-actions-inline">
                    ${contador}
                    <button type="button" class="atlas-exp-media-action" onclick="fazerUploadImagemExpansao('${tipo}', '${escaparHtml(id)}', '${escaparHtml(campo)}', event)" title="Enviar imagens para a pasta organizada no Drive">＋</button>
                    <button type="button" class="atlas-exp-media-action" onclick="abrirPastaImagensExpansao('${tipo}', '${escaparHtml(id)}', '${escaparHtml(campo)}', event)" title="Abrir pasta organizada no Drive">↗</button>
                </div>
            </div>`;
        }

        function buscarContextoUploadExpansao(tipo, id) {
            if (tipo === 'subitem') {
                const subitem = (state.expansoesSubitems || []).find(s => s.id === id);
                const projeto = subitem ? (state.expansoes || []).find(p => p.id === subitem.expansao_id) : null;
                if (!subitem || !projeto) return null;
                return { projeto, subitem, entidadeNome: subitem.nome || 'Subelemento' };
            }
            const projeto = (state.expansoes || []).find(p => p.id === id);
            if (!projeto) return null;
            return { projeto, subitem: null, entidadeNome: projeto.nome || 'Projeto' };
        }

        async function enviarImagensExpansaoParaDriveEmLote(arquivos, tipo, id, campo, contexto) {
            if (!Array.isArray(arquivos) || arquivos.length === 0) return [];
            obterUrlAppsScriptGoogleDrive('expansoes');
            if (!GOOGLE_DRIVE_EXPANSOES_FOLDER_ID) {
                throw new Error('Configure a pasta de Expansões no Google Drive.');
            }

            const arquivosPayload = [];
            for (const file of arquivos) {
                const tamanhoMb = file.size / 1024 / 1024;
                if (tamanhoMb > LIMITE_UPLOAD_MB) {
                    throw new Error(`Arquivo muito grande: ${file.name}. Limite atual: ${LIMITE_UPLOAD_MB} MB.`);
                }
                arquivosPayload.push({
                    nomeArquivo: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    base64: await converterArquivoParaBase64(file)
                });
            }

            const grupo = obterGrupoExpansao(contexto.projeto.grupo || 'em_progresso');
            const payload = {
                action: 'uploadBatch',
                modulo: 'expansoes',
                rootFolderId: GOOGLE_DRIVE_EXPANSOES_FOLDER_ID,
                rootFolderName: 'Expansões',
                arquivos: arquivosPayload,
                grupoId: contexto.projeto.grupo || 'em_progresso',
                grupoNome: grupo?.titulo || 'Projetos em Progresso',
                expansaoId: contexto.projeto.id,
                expansaoNome: contexto.projeto.nome || 'Projeto sem nome',
                subitemId: contexto.subitem?.id || '',
                subitemNome: contexto.subitem?.nome || '',
                entidadeTipo: tipo,
                entidadeId: id,
                tipoMidia: 'imagens',
                // Campos legados mantidos para compatibilidade com o fluxo de Obras.
                obraNome: grupo?.titulo || 'Expansões',
                elementoTipo: 'Projeto',
                elementoNome: contexto.projeto.nome || 'Projeto sem nome',
                subelementoNome: contexto.subitem?.nome || 'Imagens do projeto'
            };

            const resultado = await chamarEndpointGoogleDrive(payload, 'O endpoint do Google Drive não retornou JSON válido ao enviar imagens de Expansões. Atualize o Apps Script do pacote.');
            return Array.isArray(resultado.arquivos) ? resultado.arquivos : [];
        }

        async function fazerUploadImagemExpansao(tipo, id, campo, event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const contexto = buscarContextoUploadExpansao(tipo, id);
            if (!contexto) {
                await alertaVisualAtnx('Upload indisponível', 'Salve o projeto/subelemento antes de enviar imagens.');
                return;
            }

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            input.onchange = async e => {
                const arquivosOriginais = Array.from(e.target.files || []);
                if (arquivosOriginais.length === 0) return;
                try {
                    exibirStatusTemporario(`📤 Preparando ${arquivosOriginais.length} imagem(ns) para o Drive de Expansões...`, 'bg-[#0073ea]');
                    const arquivosOtimizado = [];
                    for (let i = 0; i < arquivosOriginais.length; i++) {
                        exibirStatusTemporario(`📤 Otimizando imagem ${i + 1}/${arquivosOriginais.length}...`, 'bg-[#0073ea]');
                        arquivosOtimizado.push(await otimizarImagemParaUpload(arquivosOriginais[i]));
                    }

                    const enviados = await enviarImagensExpansaoParaDriveEmLote(arquivosOtimizado, tipo, id, campo, contexto);
                    const novasMidias = enviados.map((item, indice) => {
                        const original = arquivosOriginais[indice] || arquivosOtimizado[indice] || {};
                        const otimizado = arquivosOtimizado[indice] || original;
                        return normalizarMidiaExpansao({
                            nome: original.name || item?.nome || `Imagem ${indice + 1}`,
                            nomeUpload: otimizado.name || item?.nome || '',
                            tamanhoOriginal: original.size || null,
                            tamanhoUpload: otimizado.size || null,
                            url: item?.url || '',
                            thumbnailUrl: item?.thumbnailUrl || item?.url || '',
                            viewUrl: item?.viewUrl || item?.url || '',
                            fileId: item?.fileId || '',
                            folderId: item?.folderId || '',
                            folderIds: item?.folderIds || {},
                            caminho: item?.caminho || '',
                            origem: 'atnx_upload',
                            importado: false,
                            criadoPeloAtnx: true,
                            tipo: 'imagens',
                            criadoEm: new Date().toISOString()
                        }, indice);
                    }).filter(Boolean);

                    if (novasMidias.length === 0) throw new Error('Nenhuma imagem retornou ID ou link do Google Drive.');

                    const tabela = tipo === 'subitem' ? 'atlas_expansoes_subitems' : 'atlas_expansoes';
                    const lista = tipo === 'subitem' ? state.expansoesSubitems : state.expansoes;
                    const itemAtual = (lista || []).find(reg => reg.id === id);
                    const antigo = itemAtual?.[campo] || '';
                    const novoValor = serializarMidiasExpansao([...normalizarMidiasExpansao(antigo), ...novasMidias]);
                    const { error } = await supabaseClient.from(tabela).update({ [campo]: novoValor, updated_at: new Date().toISOString() }).eq('id', id);
                    if (error) throw error;
                    atualizarEstadoLocalExpansao(tipo, id, campo, novoValor);
                    await registrarAuditoria('edição', tipo === 'subitem' ? 'expansao_subitem' : 'expansao', id, contexto.entidadeNome, campo, resumoImagensExpansao(antigo), resumoImagensExpansao(novoValor), 'Imagens salvas em pasta organizada no Google Drive; metadados registrados no Supabase para exibição no sistema');
                    exibirStatusTemporario(`✅ ${novasMidias.length} imagem(ns) salva(s) no Drive e exibida(s) no sistema.`, 'bg-emerald-600');
                    renderExpansoes();
                } catch (err) {
                    console.error(err);
                    exibirStatusTemporario('⚠️ Erro no upload de Expansões: ' + (err.message || String(err)), 'bg-red-600');
                    await alertaVisualAtnx('Erro no upload de Expansões', err.message || String(err));
                }
            };
            input.click();
        }

        function validarArquivoExpansaoPorCampo(file, campo) {
            const nome = String(file?.name || '').toLowerCase();
            const mime = String(file?.type || '').toLowerCase();
            if (campo === 'kmz') {
                if (nome.endsWith('.kmz') || nome.endsWith('.kml')) return true;
                return mime.includes('google-earth') || mime === 'application/octet-stream';
            }
            if (campo === 'lista_materiais') {
                if (/\.(xls|xlsx|xlsm|csv)$/i.test(nome)) return true;
                return mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv' || mime === 'application/vnd.ms-excel';
            }
            return true;
        }

        async function enviarArquivosExpansaoParaDriveEmLote(arquivos, tipo, id, campo, contexto) {
            if (!Array.isArray(arquivos) || arquivos.length === 0) return [];
            obterUrlAppsScriptGoogleDrive('expansoes');
            if (!GOOGLE_DRIVE_EXPANSOES_FOLDER_ID) {
                throw new Error('Configure a pasta de Expansões no Google Drive.');
            }

            const cfg = obterConfigArquivoExpansao(campo);
            const arquivosPayload = [];
            for (const file of arquivos) {
                const tamanhoMb = file.size / 1024 / 1024;
                if (tamanhoMb > LIMITE_UPLOAD_MB) throw new Error(`Arquivo muito grande: ${file.name}. Limite atual: ${LIMITE_UPLOAD_MB} MB.`);
                if (!validarArquivoExpansaoPorCampo(file, campo)) throw new Error(`${cfg.label}: formato inválido para ${file.name}.`);
                arquivosPayload.push({
                    nomeArquivo: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    base64: await converterArquivoParaBase64(file)
                });
            }

            const grupo = obterGrupoExpansao(contexto.projeto.grupo || 'em_progresso');
            const payload = {
                action: 'uploadBatch',
                modulo: 'expansoes',
                rootFolderId: GOOGLE_DRIVE_EXPANSOES_FOLDER_ID,
                rootFolderName: 'Expansões',
                arquivos: arquivosPayload,
                grupoId: contexto.projeto.grupo || 'em_progresso',
                grupoNome: grupo?.titulo || 'Projetos em Progresso',
                expansaoId: contexto.projeto.id,
                expansaoNome: contexto.projeto.nome || 'Projeto sem nome',
                subitemId: contexto.subitem?.id || '',
                subitemNome: contexto.subitem?.nome || '',
                entidadeTipo: tipo,
                entidadeId: id,
                tipoMidia: cfg.tipoMidia,
                pastaMidiaNome: cfg.pasta,
                obraNome: grupo?.titulo || 'Expansões',
                elementoTipo: 'Projeto',
                elementoNome: contexto.projeto.nome || 'Projeto sem nome',
                subelementoNome: contexto.subitem?.nome || cfg.pasta
            };

            const resultado = await chamarEndpointGoogleDrive(payload, `O endpoint do Google Drive não retornou JSON válido ao enviar ${cfg.label} de Expansões. Atualize o Apps Script do pacote.`);
            return Array.isArray(resultado.arquivos) ? resultado.arquivos : [];
        }

        async function fazerUploadArquivoExpansao(tipo, id, campo, event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const cfg = obterConfigArquivoExpansao(campo);
            const contexto = buscarContextoUploadExpansao(tipo, id);
            if (!contexto) {
                await alertaVisualAtnx('Upload indisponível', 'Salve o projeto antes de enviar arquivos para o Drive.');
                return;
            }

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = cfg.accept || '';
            input.multiple = false;
            input.onchange = async e => {
                const arquivosOriginais = Array.from(e.target.files || []);
                if (arquivosOriginais.length === 0) return;
                try {
                    exibirStatusTemporario(`📤 Enviando ${cfg.label} para o Drive de Expansões...`, 'bg-[#0073ea]');
                    const enviados = await enviarArquivosExpansaoParaDriveEmLote(arquivosOriginais, tipo, id, campo, contexto);
                    const novosArquivos = enviados.map((item, indice) => {
                        const original = arquivosOriginais[indice] || {};
                        return normalizarArquivoExpansao({
                            nome: original.name || item?.nome || cfg.label,
                            tamanhoOriginal: original.size || null,
                            tamanhoUpload: original.size || null,
                            url: item?.url || '',
                            thumbnailUrl: item?.thumbnailUrl || '',
                            viewUrl: item?.viewUrl || item?.url || '',
                            fileId: item?.fileId || '',
                            folderId: item?.folderId || '',
                            folderIds: item?.folderIds || {},
                            caminho: item?.caminho || '',
                            mimeType: item?.mimeType || original.type || '',
                            origem: 'atnx_upload',
                            importado: false,
                            criadoPeloAtnx: true,
                            tipo: cfg.tipoMidia,
                            criadoEm: new Date().toISOString()
                        }, campo, indice);
                    }).filter(Boolean);

                    if (novosArquivos.length === 0) throw new Error(`${cfg.label} não retornou ID ou link do Google Drive.`);

                    const tabela = tipo === 'subitem' ? 'atlas_expansoes_subitems' : 'atlas_expansoes';
                    const lista = tipo === 'subitem' ? state.expansoesSubitems : state.expansoes;
                    const itemAtual = (lista || []).find(reg => reg.id === id);
                    const antigo = itemAtual?.[campo] || '';
                    const antigosArquivos = normalizarArquivosExpansao(antigo, campo);
                    const antigosFileIds = coletarFileIdsMidiasExpansao(antigosArquivos);

                    const novoValor = serializarArquivosExpansao(novosArquivos, campo);
                    const { error } = await supabaseClient.from(tabela).update({ [campo]: novoValor, updated_at: new Date().toISOString() }).eq('id', id);
                    if (error) throw error;
                    atualizarEstadoLocalExpansao(tipo, id, campo, novoValor);
                    if (antigosFileIds.length) {
                        try {
                            await excluirArquivosNoGoogleDrive(antigosFileIds, 'expansoes');
                        } catch (deleteErr) {
                            console.warn(`Arquivo anterior de ${cfg.label} não foi removido do Drive:`, deleteErr);
                        }
                    }
                    await registrarAuditoria('edição', tipo === 'subitem' ? 'expansao_subitem' : 'expansao', id, contexto.entidadeNome, campo, resumoArquivosExpansao(antigo, campo), resumoArquivosExpansao(novoValor, campo), `${cfg.label} salvo em pasta organizada no Google Drive; metadados registrados no Supabase`);
                    exibirStatusTemporario(`✅ ${cfg.label} salvo no Drive e registrado no sistema.`, 'bg-emerald-600');
                    renderExpansoes();
                } catch (err) {
                    console.error(err);
                    exibirStatusTemporario(`⚠️ Erro no upload de ${cfg.label}: ` + (err.message || String(err)), 'bg-red-600');
                    await alertaVisualAtnx(`Erro no upload de ${cfg.label}`, err.message || String(err));
                }
            };
            input.click();
        }

        function abrirPastaArquivoExpansao(tipo, id, campo, event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const lista = tipo === 'subitem' ? state.expansoesSubitems : state.expansoes;
            const item = (lista || []).find(reg => reg.id === id);
            const arquivos = normalizarArquivosExpansao(item?.[campo], campo);
            const folderId = arquivos.map(obterFolderIdImagemExpansao).find(Boolean);
            if (folderId) {
                window.open(`https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`, '_blank', 'noopener,noreferrer');
                return;
            }
            abrirDriveExpansoes(event);
        }

        async function excluirArquivoExpansao(tipo, id, campo, index, event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const cfg = obterConfigArquivoExpansao(campo);
            const tabela = tipo === 'subitem' ? 'atlas_expansoes_subitems' : 'atlas_expansoes';
            const lista = tipo === 'subitem' ? state.expansoesSubitems : state.expansoes;
            const item = (lista || []).find(reg => reg.id === id);
            const arquivos = normalizarArquivosExpansao(item?.[campo], campo);
            const arquivo = arquivos[index];
            if (!item || !arquivo) return;

            const nome = arquivo.nome || cfg.label;
            const fileId = String(arquivo.fileId || extrairFileIdDriveExpansao(arquivo.viewUrl || arquivo.url || '') || '').trim();
            const mensagem = fileId
                ? `Excluir ${nome}?\n\nO arquivo será removido do sistema e também enviado para a lixeira no Google Drive.`
                : `Remover ${nome} do sistema?\n\nNão encontrei o ID no Drive. O Atlas removerá apenas o registro do sistema.`;
            const confirmado = await confirmarVisualAtnx(`Remover ${cfg.label}`, mensagem, 'Remover');
            if (!confirmado) return;

            try {
                exibirStatusTemporario(`🗑️ Removendo ${cfg.label}...`, 'bg-[#0073ea]');
                if (fileId) await excluirArquivoNoGoogleDrive(fileId, 'expansoes');
                arquivos.splice(index, 1);
                const novoValor = serializarArquivosExpansao(arquivos, campo);
                const { error } = await supabaseClient.from(tabela).update({ [campo]: novoValor, updated_at: new Date().toISOString() }).eq('id', id);
                if (error) throw error;
                atualizarEstadoLocalExpansao(tipo, id, campo, novoValor);
                await registrarAuditoria('edição', tipo === 'subitem' ? 'expansao_subitem' : 'expansao', id, item?.nome || id, campo, nome, 'removido', fileId ? `${cfg.label} excluído do Google Drive e do sistema` : `${cfg.label} removido do sistema; sem fileId para excluir no Drive`);
                exibirStatusTemporario(fileId ? `✅ ${cfg.label} removido do sistema e do Google Drive.` : `✅ ${cfg.label} removido do sistema. Sem ID para excluir no Drive.`, 'bg-emerald-600');
                renderExpansoes();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario(`⚠️ Erro ao remover ${cfg.label}: ` + (err.message || String(err)), 'bg-red-600');
                await alertaVisualAtnx(`Erro ao remover ${cfg.label}`, err.message || String(err));
            }
        }

        function renderCampoArquivoExpansao(tipo, id, campo, valor) {
            const cfg = obterConfigArquivoExpansao(campo);
            const arquivos = normalizarArquivosExpansao(valor, campo);
            const chaveAnexos = atlasRegistrarAnexosVisualizador(`expansoes:${tipo}:${id}:${campo}:arquivos`, arquivos);
            const conteudo = arquivos.length ? arquivos.map((arquivo, index) => {
                const nome = escaparHtml(arquivo.nome || cfg.label);
                return `<div class="atlas-exp-file-pill" title="${nome}">
                    <button type="button" onclick="atlasAbrirVisualizadorRegistrado('${escaparAtributoJs(chaveAnexos)}', ${index}, event, '${escaparAtributoJs(cfg.label)}')"><span>${escaparHtml(cfg.icon)}</span><strong>${nome}</strong></button>
                    <button type="button" onclick="excluirArquivoExpansao('${tipo}', '${escaparHtml(id)}', '${escaparHtml(campo)}', ${index}, event)" title="Remover ${escaparHtml(cfg.label)} do sistema e do Drive">×</button>
                </div>`;
            }).join('') : `<span class="atlas-exp-file-empty">Sem ${escaparHtml(cfg.label)}</span>`;

            return `<div class="atlas-exp-file-cell" data-exp-id="${escaparHtml(id)}" data-exp-tipo="${tipo}" data-exp-campo="${escaparHtml(campo)}">
                <div class="atlas-exp-file-list">${conteudo}</div>
                <div class="atlas-exp-media-actions-inline">
                    <button type="button" class="atlas-exp-media-action" onclick="fazerUploadArquivoExpansao('${tipo}', '${escaparHtml(id)}', '${escaparHtml(campo)}', event)" title="Enviar ${escaparHtml(cfg.label)} para o Drive">⇧</button>
                    <button type="button" class="atlas-exp-media-action" onclick="abrirPastaArquivoExpansao('${tipo}', '${escaparHtml(id)}', '${escaparHtml(campo)}', event)" title="Abrir pasta do ${escaparHtml(cfg.label)} no Drive">↗</button>
                </div>
            </div>`;
        }

        function renderCampoNovoArquivoExpansao(campo) {
            const cfg = obterConfigArquivoExpansao(campo);
            return `<div class="atlas-exp-file-cell atlas-exp-file-cell-new">
                <span class="atlas-exp-file-empty">Salve primeiro</span>
                <div class="atlas-exp-media-actions-inline">
                    <button type="button" class="atlas-exp-media-action is-disabled" onclick="event.stopPropagation();alertaVisualAtnx('Salve primeiro', 'Salve o projeto antes de enviar ${escaparHtml(cfg.label)} para o Drive.')" title="Salve antes de enviar">⇧</button>
                    <button type="button" class="atlas-exp-media-action" onclick="abrirDriveExpansoes(event)" title="Abrir Drive de Expansões">↗</button>
                </div>
            </div>`;
        }

        function abrirPrimeiroLinkImagemExpansao(valor, event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            const links = obterLinksImagensExpansao(valor);
            if (links.length > 0) {
                const chave = atlasRegistrarAnexosVisualizador(`expansoes:links:${Date.now()}`, links);
                atlasAbrirVisualizadorRegistrado(chave, 0, null, 'Imagens de Expansões');
            }
            else abrirDriveExpansoes(event);
        }

        function renderCampoImagemExpansao(tipo, id, campo, valor, opcoes = {}) {
            return renderMiniaturasImagensExpansao(tipo, id, campo, valor);
        }

        function renderCampoNovoImagemExpansao(campo, opcoes = {}) {
            const renderBase = opcoes.subitem ? renderCampoNovoSubitemExpansao : renderCampoNovoExpansao;
            const campoHtml = renderBase(campo, { ...opcoes, placeholder: opcoes.placeholder || 'Cole links do Drive após salvar' });
            return `<div class="atlas-exp-drive-cell atlas-exp-drive-cell-new">${campoHtml}<button type="button" class="atlas-exp-drive-open atlas-exp-drive-upload is-disabled" onclick="event.stopPropagation();alertaVisualAtnx('Salve primeiro', 'Salve o projeto ou subelemento antes de enviar imagens para o Drive.')" title="Salve antes de enviar imagens">⇧</button><button type="button" class="atlas-exp-drive-open" onclick="abrirDriveExpansoes(event)" title="Abrir Drive de Expansões">↗</button></div>`;
        }

        function renderCampoEditavelExpansao(tipo, id, campo, valor, opcoes = {}) {
            const tabela = tipo === 'subitem' ? 'atlas_expansoes_subitems' : 'atlas_expansoes';
            const inputType = opcoes.type || (ATLAS_EXP_DATE_FIELDS.has(campo) ? 'date' : ATLAS_EXP_NUMBER_FIELDS.has(campo) ? 'number' : 'text');
            const comum = `data-exp-id="${escaparHtml(id)}" data-exp-tipo="${tipo}" data-exp-campo="${escaparHtml(campo)}"`;
            const salvar = `salvarCampoExpansao('${tabela}', '${escaparHtml(id)}', '${escaparHtml(campo)}', this.value, '${tipo}')`;
            if (opcoes.status) {
                return renderSelectStatusExpansao(valor, `${comum} onchange="salvarStatusExpansaoComSelecao('${tabela}', '${escaparHtml(id)}', '${escaparHtml(campo)}', this.value, '${tipo}', this)"`);
            }
            if (campo === 'duracao_completa') {
                return renderControleDuracaoCompletaExpansao(valor, `${comum} data-exp-tabela="${tabela}"`, { placeholder: opcoes.placeholder || 'Selecionar período' });
            }
            if (ATLAS_EXP_EMPRESA_FIELDS.has(campo)) {
                return renderSelectEmpresaExpansao(valor, `${comum} onchange="atualizarClasseSelectEmpresaExpansao(this);${salvar}"`);
            }
            if (ATLAS_EXP_FILE_FIELDS.has(campo)) {
                return renderCampoArquivoExpansao(tipo, id, campo, valor);
            }
            const step = inputType === 'number' ? ` step="${opcoes.step || 'any'}"` : '';
            const min = inputType === 'number' ? ' min="0"' : '';
            const valorInput = inputType === 'date' ? valorDataAdmin(valor, '') : valorParaInputExpansao(valor);
            return `<input class="atlas-exp-cell-control" type="${inputType}" value="${escaparHtml(valorInput)}" ${step}${min} ${comum} onblur="${salvar}" onchange="${salvar}" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" placeholder="${escaparHtml(opcoes.placeholder || '')}">`;
        }

        function renderCampoNovoExpansao(campo, opcoes = {}) {
            const inputType = opcoes.type || (ATLAS_EXP_DATE_FIELDS.has(campo) ? 'date' : ATLAS_EXP_NUMBER_FIELDS.has(campo) ? 'number' : 'text');
            if (opcoes.status) return renderSelectStatusExpansao(opcoes.value || '', `data-new-exp-campo="${escaparHtml(campo)}" onchange="atualizarClasseSelectStatusExpansao(this)"`);
            if (campo === 'duracao_completa') return renderControleDuracaoCompletaExpansao(opcoes.value || '', `data-new-exp-campo="${escaparHtml(campo)}"`, { placeholder: opcoes.placeholder || 'Selecionar período' });
            if (ATLAS_EXP_EMPRESA_FIELDS.has(campo)) return renderSelectEmpresaExpansao(opcoes.value || '', `data-new-exp-campo="${escaparHtml(campo)}" onchange="atualizarClasseSelectEmpresaExpansao(this)"`);
            if (ATLAS_EXP_FILE_FIELDS.has(campo)) return renderCampoNovoArquivoExpansao(campo);
            const step = inputType === 'number' ? ` step="${opcoes.step || 'any'}"` : '';
            const min = inputType === 'number' ? ' min="0"' : '';
            return `<input class="atlas-exp-cell-control" type="${inputType}" value="${escaparHtml(opcoes.value || '')}" ${step}${min} data-new-exp-campo="${escaparHtml(campo)}" placeholder="${escaparHtml(opcoes.placeholder || '')}" onkeydown="if(event.key==='Enter'){event.preventDefault();}">`;
        }

        function renderCampoNovoSubitemExpansao(campo, opcoes = {}) {
            const inputType = opcoes.type || (ATLAS_EXP_DATE_FIELDS.has(campo) ? 'date' : ATLAS_EXP_NUMBER_FIELDS.has(campo) ? 'number' : 'text');
            if (opcoes.status) return renderSelectStatusExpansao(opcoes.value || '', `data-new-sub-campo="${escaparHtml(campo)}" onchange="atualizarClasseSelectStatusExpansao(this)"`);
            const step = inputType === 'number' ? ` step="${opcoes.step || 'any'}"` : '';
            const min = inputType === 'number' ? ' min="0"' : '';
            const oninput = opcoes.oninput ? ` oninput="${opcoes.oninput}"` : '';
            const readonly = opcoes.readonly ? ' readonly' : '';
            return `<input class="atlas-exp-cell-control${opcoes.readonly ? ' atlas-exp-cell-readonly' : ''}" type="${inputType}" value="${escaparHtml(opcoes.value || '')}" ${step}${min}${readonly} data-new-sub-campo="${escaparHtml(campo)}" placeholder="${escaparHtml(opcoes.placeholder || '')}"${oninput}>`;
        }

        function atualizarEstadoLocalExpansao(tipo, id, campo, valor) {
            const lista = tipo === 'subitem' ? state.expansoesSubitems : state.expansoes;
            const item = (lista || []).find(reg => reg.id === id);
            if (item) item[campo] = valor;
        }

        function obterProjetoPaiSubitemExpansao(subitem) {
            if (!subitem) return null;
            return (state.expansoes || []).find(p => p.id === subitem.expansao_id) || null;
        }

        function calcularDiferencaLancamentoExpansao(projetado, lancado) {
            const temProjetado = projetado !== null && projetado !== undefined && String(projetado).trim() !== '';
            const temLancado = lancado !== null && lancado !== undefined && String(lancado).trim() !== '';
            if (!temProjetado && !temLancado) return null;
            const p = Number(String(projetado ?? 0).replace(',', '.')) || 0;
            const l = Number(String(lancado ?? 0).replace(',', '.')) || 0;
            return Math.round(p - l);
        }

        function deveAutomatizarDiferencaSubitemExpansao(subitemOuProjetoId) {
            let projeto = null;
            if (typeof subitemOuProjetoId === 'string') projeto = (state.expansoes || []).find(p => p.id === subitemOuProjetoId) || null;
            else projeto = obterProjetoPaiSubitemExpansao(subitemOuProjetoId);
            return normalizarFaseObraExpansao(projeto?.fase, projeto?.nome) === 'lancamento';
        }

        function obterValorDiferencaSubitemExpansao(subitem) {
            if (deveAutomatizarDiferencaSubitemExpansao(subitem)) {
                return calcularDiferencaLancamentoExpansao(subitem?.projetado, subitem?.lancado);
            }
            return normalizarValorCampoExpansao('diferenca', subitem?.diferenca);
        }

        function renderValorAutomaticoExpansao(valor, attrs = '') {
            const texto = valor === null || valor === undefined || valor === '' ? '-' : String(valor);
            return `<span class="atlas-exp-auto-value" ${attrs}>${escaparHtml(texto)}</span>`;
        }

        function atualizarDiferencaNovaLinhaObraExpansao(input) {
            const linha = input?.closest?.('tr');
            if (!linha) return;
            const projetado = linha.querySelector('[data-new-sub-campo="projetado"]')?.value;
            const lancado = linha.querySelector('[data-new-sub-campo="lancado"]')?.value;
            const diferenca = calcularDiferencaLancamentoExpansao(projetado, lancado);
            const destino = linha.querySelector('[data-new-sub-campo="diferenca"]');
            if (destino) destino.value = diferenca ?? '';
            const display = linha.querySelector('[data-exp-auto-diferenca-new]');
            if (display) display.textContent = diferenca === null || diferenca === undefined ? '-' : String(diferenca);
        }

        async function salvarCampoExpansao(tabela, id, campo, valor, tipo = 'projeto') {
            const normalizado = normalizarValorCampoExpansao(campo, valor);
            const lista = tipo === 'subitem' ? state.expansoesSubitems : state.expansoes;
            const item = (lista || []).find(reg => reg.id === id);
            const antigo = item ? item[campo] : '';
            const antigoNorm = normalizarValorCampoExpansao(campo, antigo);
            if (String(antigoNorm ?? '') === String(normalizado ?? '')) return;
            atualizarEstadoLocalExpansao(tipo, id, campo, normalizado);
            const updatePayload = { [campo]: normalizado, updated_at: new Date().toISOString() };
            if (tipo === 'projeto' && campo === 'status' && normalizarStatusExpansao(normalizado) === 'concluido') {
                updatePayload.grupo = 'concluidos';
                atualizarEstadoLocalExpansao(tipo, id, 'grupo', 'concluidos');
                state.expansoesAbertas.concluidos = true;
            }
            if (tipo === 'subitem' && (campo === 'timeline_inicio' || campo === 'timeline_fim')) {
                const inicio = campo === 'timeline_inicio' ? normalizado : item?.timeline_inicio;
                const fim = campo === 'timeline_fim' ? normalizado : item?.timeline_fim;
                const duracaoAuto = calcularDiasUteisExpansao(inicio, fim);
                updatePayload.duracao = duracaoAuto;
                atualizarEstadoLocalExpansao(tipo, id, 'duracao', duracaoAuto);
            }
            if (tipo === 'subitem' && (campo === 'projetado' || campo === 'lancado') && deveAutomatizarDiferencaSubitemExpansao(item)) {
                const projetadoAtual = campo === 'projetado' ? normalizado : item?.projetado;
                const lancadoAtual = campo === 'lancado' ? normalizado : item?.lancado;
                const diferencaAuto = calcularDiferencaLancamentoExpansao(projetadoAtual, lancadoAtual);
                updatePayload.diferenca = diferencaAuto;
                atualizarEstadoLocalExpansao(tipo, id, 'diferenca', diferencaAuto);
            }
            try {
                const { error } = await supabaseClient.from(tabela).update(updatePayload).eq('id', id);
                if (error) throw error;
                await registrarAuditoria('edição', tipo === 'subitem' ? 'expansao_subitem' : 'expansao', id, item?.nome || id, campo, antigo ?? '', normalizado ?? '', 'Edição direta na tabela de Expansões');
                exibirStatusTemporario('✅ Salvo.', 'bg-emerald-600');
                const el = document.querySelector(`[data-exp-id="${CSS.escape(id)}"][data-exp-campo="${CSS.escape(campo)}"]`);
                if (campo === 'status' && el) el.className = `atlas-exp-cell-control atlas-exp-cell-select atlas-exp-status-select ${classeStatusExpansao(normalizado)}`;
                if (ATLAS_EXP_EMPRESA_FIELDS.has(campo) && el) el.className = `atlas-exp-cell-control atlas-exp-cell-select atlas-exp-empresa-select ${classeEmpresaExpansao(normalizado)}`;
                if (Object.prototype.hasOwnProperty.call(updatePayload, 'duracao')) {
                    const durEl = document.querySelector(`[data-exp-duracao-id="${CSS.escape(id)}"]`);
                    if (durEl) durEl.textContent = updatePayload.duracao === null || updatePayload.duracao === undefined ? '-' : String(updatePayload.duracao);
                }
                if (Object.prototype.hasOwnProperty.call(updatePayload, 'diferenca')) {
                    const diffEl = document.querySelector(`[data-exp-id="${CSS.escape(id)}"][data-exp-campo="diferenca"]`);
                    if (diffEl) {
                        if ('value' in diffEl) diffEl.value = updatePayload.diferenca ?? '';
                        else diffEl.textContent = updatePayload.diferenca === null || updatePayload.diferenca === undefined ? '-' : String(updatePayload.diferenca);
                    }
                }
                if (tipo === 'projeto' && updatePayload.grupo === 'concluidos') {
                    exibirStatusTemporario('✅ Projeto concluído movido para Projetos Concluídos.', 'bg-emerald-600');
                    renderExpansoes();
                }
            } catch (err) {
                await alertaVisualAtnx('Erro ao salvar campo', err.message || String(err));
                await carregarExpansoes();
            }
        }

        function renderSubitemExpansao(sub) {
            return `<tr class="atlas-exp-sub-row">
                <td class="atlas-exp-check"><input type="checkbox" aria-label="Selecionar subitem" /></td>
                <td class="atlas-exp-sub-name-cell">${renderCampoEditavelExpansao('subitem', sub.id, 'nome', sub.nome || '', { placeholder: 'Subelemento' })}</td>
                <td class="atlas-exp-comment-cell atlas-exp-mini-actions"><button type="button" title="Duplicar subelemento" onclick="duplicarSubitemExpansao('${sub.id}')">⧉</button><button type="button" title="Remover subitem" onclick="excluirSubitemExpansao('${sub.id}')">🗑</button></td>
                <td>${renderCampoEditavelExpansao('subitem', sub.id, 'status', sub.status || '', { status: true })}</td>
                <td>${renderCampoEditavelExpansao('subitem', sub.id, 'timeline_inicio', sub.timeline_inicio, { type: 'date' })}</td>
                <td>${renderCampoEditavelExpansao('subitem', sub.id, 'timeline_fim', sub.timeline_fim, { type: 'date' })}</td>
                <td>${renderDuracaoAutomaticaExpansao(sub)}</td>
                <td>${renderCampoEditavelExpansao('subitem', sub.id, 'equipe', sub.equipe)}</td>
                <td>${renderCampoEditavelExpansao('subitem', sub.id, 'responsavel', sub.responsavel)}</td>
                <td>${renderCampoImagemExpansao('subitem', sub.id, 'imagens', sub.imagens)}</td>
                <td>${renderCampoEditavelExpansao('subitem', sub.id, 'pessoas', sub.pessoas)}</td>
                <td>${renderCampoEditavelExpansao('subitem', sub.id, 'depende_de', sub.depende_de)}</td>
            </tr>`;
        }

        function renderNovaLinhaSubitemExpansao(expansaoId) {
            return `<tr class="atlas-exp-sub-row atlas-exp-new-row" data-new-sub-expansao="${escaparHtml(expansaoId)}">
                <td class="atlas-exp-check"><input type="checkbox" disabled /></td>
                <td>${renderCampoNovoSubitemExpansao('nome', { placeholder: 'Novo subelemento' })}</td>
                <td class="atlas-exp-row-actions"><button type="button" onclick="salvarNovoSubitemLinha('${expansaoId}')">Salvar</button><button type="button" onclick="cancelarNovoSubitemExpansao()">Cancelar</button></td>
                <td>${renderCampoNovoSubitemExpansao('status', { status: true, value: 'Em Progresso' })}</td>
                <td>${renderCampoNovoSubitemExpansao('timeline_inicio', { type: 'date' })}</td>
                <td>${renderCampoNovoSubitemExpansao('timeline_fim', { type: 'date' })}</td>
                <td><span class="atlas-exp-cell-control atlas-exp-readonly">Auto</span></td>
                <td>${renderCampoNovoSubitemExpansao('equipe')}</td>
                <td>${renderCampoNovoSubitemExpansao('responsavel')}</td>
                <td>${renderCampoNovoImagemExpansao('imagens', { subitem: true })}</td>
                <td>${renderCampoNovoSubitemExpansao('pessoas')}</td>
                <td>${renderCampoNovoSubitemExpansao('depende_de')}</td>
            </tr>`;
        }

        function renderLinhaAdicionarSubitemExpansao(expansaoId) {
            return `<tr class="atlas-exp-add-row" onclick="abrirCadastroSubitemExpansao('${expansaoId}')"><td class="atlas-exp-check"><input type="checkbox" disabled /></td><td colspan="11">+ Adicionar subelemento</td></tr>`;
        }

        function renderTabelaSubitemsExpansao(subs, expansaoId) {
            const novaLinha = state.expansaoSubitemNovoProjetoId === expansaoId ? renderNovaLinhaSubitemExpansao(expansaoId) : renderLinhaAdicionarSubitemExpansao(expansaoId);
            return `<tr class="atlas-exp-sub-table-row"><td colspan="24">
                <div class="atlas-exp-sub-table-wrap">
                    <table class="atlas-exp-sub-table">
                        <thead><tr>
                            <th class="atlas-exp-check"><input type="checkbox" disabled /></th><th>Subelemento</th><th></th><th>Status</th><th>Timeline - Start</th><th>Timeline - End</th>
                            <th>Duração</th><th>Equipe</th><th>Responsável</th><th>Imagens</th><th>Pessoas</th><th>Depende de</th>
                        </tr></thead>
                        <tbody>${subs.map(renderSubitemExpansao).join('')}${novaLinha}</tbody>
                    </table>
                </div>
            </td></tr>`;
        }

        function obterSelecaoProjetosExpansoes() {
            state.expansoesProjetosSelecionados = state.expansoesProjetosSelecionados || {};
            return state.expansoesProjetosSelecionados;
        }

        function projetoExpansaoSelecionado(id) {
            return !!obterSelecaoProjetosExpansoes()[id];
        }

        function toggleSelecaoProjetoExpansao(id, marcado) {
            const selecao = obterSelecaoProjetosExpansoes();
            if (marcado) selecao[id] = true;
            else delete selecao[id];
            renderExpansoes();
        }

        function toggleSelecaoGrupoProjetosExpansoes(grupoId, marcado) {
            const termo = String(state.termoPesquisa || '').trim().toLowerCase();
            const selecao = obterSelecaoProjetosExpansoes();
            (state.expansoes || [])
                .filter(ehProjetoManualExpansao)
                .filter(projeto => (projeto.grupo || 'em_progresso') === grupoId)
                .filter(projeto => filtrarProjetoExpansao(projeto, termo))
                .forEach(projeto => {
                    if (marcado) selecao[projeto.id] = true;
                    else delete selecao[projeto.id];
                });
            renderExpansoes();
        }

        function limparSelecaoProjetosExpansoes() {
            state.expansoesProjetosSelecionados = {};
            renderExpansoes();
        }

        function idsProjetosExpansoesSelecionados() {
            const idsValidos = new Set((state.expansoes || []).filter(ehProjetoManualExpansao).map(projeto => projeto.id));
            return Object.keys(obterSelecaoProjetosExpansoes()).filter(id => idsValidos.has(id));
        }

        function renderBarraMoverProjetosExpansoes() {
            const ids = idsProjetosExpansoesSelecionados();
            if (!ids.length) return '';
            const opcoes = ATLAS_EXP_GRUPOS.map(grupo => `<option value="${escaparHtml(grupo.id)}">${escaparHtml(grupo.titulo)}</option>`).join('');
            return `<div class="atlas-exp-move-toolbar" role="region" aria-label="Mover elementos selecionados">
                <div class="atlas-exp-move-summary"><span class="atlas-exp-move-icon" aria-hidden="true">↪</span><strong>${ids.length}</strong><span>elemento(s) selecionado(s)</span></div>
                <div class="atlas-exp-move-controls">
                    <label title="Escolher grupo de destino"><select id="atlas-exp-projetos-destino" aria-label="Grupo de destino" style="background-color:var(--atlas-exp-move-select-bg)!important;color:var(--atlas-exp-move-select-text)!important;border-color:var(--atlas-exp-move-select-border)!important"><option value="">Mover para...</option>${opcoes}</select></label>
                    <button type="button" class="atlas-exp-move-confirm" onclick="moverProjetosExpansoesSelecionados()" title="Mover elementos para o grupo escolhido">↪ <span>Mover</span></button>
                    <button type="button" class="atlas-exp-move-clear" onclick="limparSelecaoProjetosExpansoes()" title="Limpar seleção" aria-label="Limpar seleção">×</button>
                </div>
            </div>`;
        }

        async function moverProjetosExpansoesSelecionados() {
            if (!await exigirPermissaoAtlas('editar_registro', 'mover elementos entre grupos')) return;
            const destino = document.getElementById('atlas-exp-projetos-destino')?.value || '';
            const grupoDestino = ATLAS_EXP_GRUPOS.find(grupo => grupo.id === destino);
            if (!grupoDestino) {
                await alertaVisualAtnx('Escolha o destino', 'Selecione o grupo para onde os elementos devem ser movidos.');
                return;
            }
            const ids = idsProjetosExpansoesSelecionados();
            if (!ids.length) return;
            const anteriores = new Map();
            (state.expansoes || []).forEach(projeto => {
                if (ids.includes(projeto.id)) {
                    anteriores.set(projeto.id, projeto.grupo || 'em_progresso');
                    projeto.grupo = grupoDestino.id;
                }
            });
            state.expansoesAbertas[grupoDestino.id] = true;
            state.expansoesProjetosSelecionados = {};
            renderExpansoes();
            exibirStatusTemporario(`Movendo ${ids.length} elemento(s) para ${grupoDestino.titulo}...`, 'bg-[#0073ea]');
            try {
                const { error } = await supabaseClient.from('atlas_expansoes').update({ grupo: grupoDestino.id, updated_at: new Date().toISOString() }).in('id', ids);
                if (error) throw error;
                await registrarAuditoria('edição', 'expansao', ids.join(','), `${ids.length} elemento(s)`, 'grupo', 'grupos anteriores', grupoDestino.titulo, 'Elementos movidos entre grupos em Expansões > Projetos');
                exibirStatusTemporario(`✅ ${ids.length} elemento(s) movido(s) para ${grupoDestino.titulo}.`, 'bg-emerald-600');
            } catch (err) {
                (state.expansoes || []).forEach(projeto => {
                    if (anteriores.has(projeto.id)) projeto.grupo = anteriores.get(projeto.id);
                });
                renderExpansoes();
                await alertaVisualAtnx('Erro ao mover elementos', err.message || String(err));
            }
        }

        function renderProjetoExpansao(projeto) {
            const aberto = !!state.expansoesProjetosAbertos[projeto.id];
            const subs = (state.expansoesSubitems || []).filter(s => s.expansao_id === projeto.id);
            const subitemsHtml = aberto ? renderTabelaSubitemsExpansao(subs, projeto.id) : '';
            return `<tr class="atlas-exp-row atlas-exp-row-projeto ${projetoExpansaoSelecionado(projeto.id) ? 'is-selected' : ''}">
                <td class="atlas-exp-check"><input type="checkbox" aria-label="Selecionar ${escaparHtml(projeto.nome || 'projeto')}" ${projetoExpansaoSelecionado(projeto.id) ? 'checked' : ''} onclick="event.stopPropagation();toggleSelecaoProjetoExpansao('${escaparAtributoJs(projeto.id)}', this.checked)" /></td>
                <td class="atlas-exp-elemento-cell">
                    <div class="atlas-exp-elemento-inline">
                        <button class="atlas-exp-caret-btn" type="button" onclick="alternarProjetoExpansoes('${projeto.id}')">${aberto ? '⌄' : '›'}</button>
                        ${renderCampoEditavelExpansao('projeto', projeto.id, 'nome', projeto.nome || '', { placeholder: 'Elemento' })}
                        <span class="atlas-exp-sub-count">${subs.length}</span>
                    </div>
                </td>
                <td class="atlas-exp-comment-cell"><button type="button" title="Adicionar subitem" onclick="abrirCadastroSubitemExpansao('${projeto.id}')">＋</button></td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'duracao_completa', projeto.duracao_completa, { placeholder: 'Selecionar período' })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'data_conclusao', projeto.data_conclusao, { type: 'date' })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'duracao_lancamento', projeto.duracao_lancamento, { type: 'number' })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'duracao_fusao', projeto.duracao_fusao, { type: 'number' })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'status', projeto.status || '', { status: true })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'empresa_fusao', projeto.empresa_fusao)}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'empresa_lancamento', projeto.empresa_lancamento)}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'qtde_ctos', projeto.qtde_ctos, { type: 'number' })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'metragem_cabo', projeto.metragem_cabo, { type: 'number' })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'qtde_ceos', projeto.qtde_ceos, { type: 'number' })}</td>
                <td>${renderCampoImagemExpansao('projeto', projeto.id, 'imagens', projeto.imagens)}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'rotulo', projeto.rotulo)}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'novos_projetos', projeto.novos_projetos)}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'duracao_cto', projeto.duracao_cto, { type: 'number' })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'duracao_ceo', projeto.duracao_ceo, { type: 'number' })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'equipes_lancamento', projeto.equipes_lancamento, { type: 'number' })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'equipes_fusao', projeto.equipes_fusao, { type: 'number' })}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'dependencia', projeto.dependencia)}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'numeros', projeto.numeros)}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'kmz', projeto.kmz)}</td>
                <td>${renderCampoEditavelExpansao('projeto', projeto.id, 'lista_materiais', projeto.lista_materiais)}</td>
                <td class="atlas-exp-row-remove atlas-exp-mini-actions"><button type="button" title="Duplicar elemento" onclick="duplicarExpansao('${projeto.id}')">⧉</button><button type="button" title="Remover projeto" onclick="excluirExpansao('${projeto.id}')">🗑</button></td>
            </tr>${subitemsHtml}`;
        }

        function renderNovaLinhaProjetoExpansao(grupoId) {
            return `<tr class="atlas-exp-row atlas-exp-new-row" data-new-exp-grupo="${escaparHtml(grupoId)}">
                <td class="atlas-exp-check"><input type="checkbox" disabled /></td>
                <td class="atlas-exp-elemento-cell">${renderCampoNovoExpansao('nome', { placeholder: 'Novo projeto' })}</td>
                <td class="atlas-exp-row-actions"><button type="button" onclick="salvarNovaExpansaoLinha('${grupoId}')">Salvar</button><button type="button" onclick="cancelarNovaExpansaoLinha()">Cancelar</button></td>
                <td>${renderCampoNovoExpansao('duracao_completa', { placeholder: 'Selecionar período' })}</td>
                <td>${renderCampoNovoExpansao('data_conclusao', { type: 'date' })}</td>
                <td>${renderCampoNovoExpansao('duracao_lancamento', { type: 'number' })}</td>
                <td>${renderCampoNovoExpansao('duracao_fusao', { type: 'number' })}</td>
                <td>${renderCampoNovoExpansao('status', { status: true, value: 'Em Progresso' })}</td>
                <td>${renderCampoNovoExpansao('empresa_fusao')}</td>
                <td>${renderCampoNovoExpansao('empresa_lancamento')}</td>
                <td>${renderCampoNovoExpansao('qtde_ctos', { type: 'number' })}</td>
                <td>${renderCampoNovoExpansao('metragem_cabo', { type: 'number' })}</td>
                <td>${renderCampoNovoExpansao('qtde_ceos', { type: 'number' })}</td>
                <td>${renderCampoNovoImagemExpansao('imagens')}</td>
                <td>${renderCampoNovoExpansao('rotulo')}</td>
                <td>${renderCampoNovoExpansao('novos_projetos')}</td>
                <td>${renderCampoNovoExpansao('duracao_cto', { type: 'number' })}</td>
                <td>${renderCampoNovoExpansao('duracao_ceo', { type: 'number' })}</td>
                <td>${renderCampoNovoExpansao('equipes_lancamento', { type: 'number' })}</td>
                <td>${renderCampoNovoExpansao('equipes_fusao', { type: 'number' })}</td>
                <td>${renderCampoNovoExpansao('dependencia')}</td>
                <td>${renderCampoNovoExpansao('numeros')}</td>
                <td>${renderCampoNovoExpansao('kmz')}</td>
                <td>${renderCampoNovoExpansao('lista_materiais')}</td>
                <td></td>
            </tr>`;
        }

        function renderLinhaAdicionarProjetoExpansao(grupoId) {
            return `<tr class="atlas-exp-add-row" onclick="abrirCadastroExpansao('${grupoId}')"><td class="atlas-exp-check"><input type="checkbox" disabled /></td><td colspan="23">+ Adicionar projeto</td></tr>`;
        }

        function renderGrupoExpansao(grupo, projetos, termo) {
            const aberto = state.expansoesAbertas[grupo.id] !== false;
            const filtrados = projetos.filter(projeto => filtrarProjetoExpansao(projeto, termo));
            const subs = state.expansoesSubitems || [];
            const resumo = filtrados.reduce((acc, p) => {
                acc.elementos += 1;
                acc.subelementos += subs.filter(s => s.expansao_id === p.id).length;
                acc.duracaoLancamento += Number(p.duracao_lancamento || 0);
                acc.duracaoFusao += Number(p.duracao_fusao || 0);
                return acc;
            }, { elementos: 0, subelementos: 0, duracaoLancamento: 0, duracaoFusao: 0 });
            const header = `<button class="atlas-exp-group-head" onclick="alternarGrupoExpansoes('${grupo.id}')" style="--atlas-exp-color:${grupo.cor}">
                <div class="atlas-exp-group-main"><div class="atlas-exp-group-title"><span>${aberto ? '⌄' : '›'}</span>${escaparHtml(grupo.titulo)}</div><div class="atlas-exp-group-count">${resumo.elementos} Elementos / ${resumo.subelementos} subelementos</div></div>
                <div class="atlas-exp-group-cell"><span>Data de Conclusão</span>${renderDataConclusaoGrupoExpansao(filtrados)}</div>
                <div class="atlas-exp-group-cell"><span>duração do lançame...</span><strong>${formatarDuracaoExpansao(resumo.duracaoLancamento)}</strong><small>Total</small></div>
                <div class="atlas-exp-group-cell"><span>duração da fusão</span><strong>${formatarDuracaoExpansao(resumo.duracaoFusao)}</strong><small>Total</small></div>
            </button>`;
            const linhasProjetos = filtrados.map(renderProjetoExpansao).join('');
            const selecionadosGrupo = filtrados.filter(projeto => projetoExpansaoSelecionado(projeto.id)).length;
            const grupoSelecionado = filtrados.length > 0 && selecionadosGrupo === filtrados.length;
            const linhaNova = state.expansaoLinhaNovaGrupo === grupo.id ? renderNovaLinhaProjetoExpansao(grupo.id) : renderLinhaAdicionarProjetoExpansao(grupo.id);
            const table = `<div class="atlas-exp-table-wrap">
                <table class="atlas-exp-table">
                    <thead><tr>
                        <th class="atlas-exp-check"><input type="checkbox" aria-label="Selecionar elementos de ${escaparHtml(grupo.titulo)}" ${grupoSelecionado ? 'checked' : ''} ${filtrados.length ? '' : 'disabled'} onchange="event.stopPropagation();toggleSelecaoGrupoProjetosExpansoes('${escaparAtributoJs(grupo.id)}', this.checked)" /></th>
                        <th>Elemento</th>
                        <th></th>
                        <th>Duração Completa</th>
                        <th>Data de Conclusão</th>
                        <th>duração do lançamento</th>
                        <th>duração da fusão</th>
                        <th>Status</th>
                        <th>Empresa Fusão</th>
                        <th>Empresa Lançamento</th>
                        <th>Qtde. de CTO'S</th>
                        <th>Metragem de Cabo</th>
                        <th>Qtde de CEO's</th>
                        <th>Imagens</th>
                        <th>Rótulo</th>
                        <th>NOVOS PROJETOS</th>
                        <th>duração da cto</th>
                        <th>duração da ceo</th>
                        <th>Equipes Lanç.</th>
                        <th>Equipes - Fusão</th>
                        <th>Dependência</th>
                        <th>Números</th>
                        <th>KMZ</th>
                        <th>Lista de Materiais</th>
                        <th>Ações</th>
                    </tr></thead>
                    <tbody>${linhasProjetos}${linhaNova}</tbody>
                </table>
            </div>`;
            const body = aberto ? `<div class="atlas-exp-group-body">${table}</div>` : '';
            return `<section class="atlas-exp-group" data-exp-grupo="${escaparHtml(grupo.id)}">${header}${body}</section>`;
        }

        function alternarGrupoExpansoes(id) {
            state.expansoesAbertas[id] = state.expansoesAbertas[id] === false ? true : false;
            renderExpansoes();
        }

        function alternarProjetoExpansoes(id) {
            state.expansoesProjetosAbertos[id] = !state.expansoesProjetosAbertos[id];
            renderExpansoes();
        }


        function definirVisualizacaoExpansoes(tipo) {
            state.expansoesVisualizacao = ['tabela', 'obras', 'gantt'].includes(tipo) ? tipo : 'tabela';
            atualizarVisibilidadeModulos();
            renderExpansoes();
            if (state.expansoesVisualizacao === 'gantt') setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        function ajustarZoomGanttExpansoes(delta) {
            const atual = Number(state.expansoesGanttZoom || 1);
            state.expansoesGanttZoom = Math.max(0.55, Math.min(1.65, Math.round((atual + delta) * 100) / 100));
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        function ajustarAutomaticoGanttExpansoes() {
            state.expansoesGanttZoom = 1;
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 100);
        }

        function definirEscalaGanttExpansoes(valor) {
            const permitidas = ['dias', 'semanas', 'meses'];
            state.expansoesGanttEscala = permitidas.includes(valor) ? valor : 'meses';
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        function alterarFiltroGanttExpansoes(valor, manterFoco = false) {
            state.expansoesGanttFiltro = String(valor || '');
            renderExpansoes();
            if (manterFoco) {
                setTimeout(() => {
                    const input = document.getElementById('atlas-exp-gantt-filter-input');
                    if (input) {
                        input.focus();
                        const pos = input.value.length;
                        try { input.setSelectionRange(pos, pos); } catch (e) {}
                    }
                }, 0);
            } else {
                setTimeout(() => centralizarHojeGanttExpansoes(), 80);
            }
        }

        function normalizarListaFiltroGanttExpansoes(valor, normalizador = v => String(v || '').trim()) {
            const origem = Array.isArray(valor) ? valor : (valor ? [valor] : []);
            return [...new Set(origem.map(normalizador).filter(v => v && v !== 'neutro'))];
        }

        function obterFiltrosStatusGanttExpansoes() {
            return normalizarListaFiltroGanttExpansoes(state.expansoesGanttStatus || [], normalizarStatusExpansao);
        }

        function obterFiltrosGrupoGanttExpansoes() {
            return normalizarListaFiltroGanttExpansoes(state.expansoesGanttGrupo || [], v => String(v || '').trim());
        }

        function alternarFiltroStatusGanttExpansoes(valor) {
            const status = normalizarStatusExpansao(valor || '');
            const atuais = obterFiltrosStatusGanttExpansoes();
            if (!status || status === 'neutro') {
                state.expansoesGanttStatus = [];
            } else if (atuais.includes(status)) {
                state.expansoesGanttStatus = atuais.filter(item => item !== status);
            } else {
                state.expansoesGanttStatus = [...atuais, status];
            }
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        function alternarFiltroGrupoGanttExpansoes(valor) {
            const grupo = String(valor || '').trim();
            const atuais = obterFiltrosGrupoGanttExpansoes();
            if (!grupo) {
                state.expansoesGanttGrupo = [];
            } else if (atuais.includes(grupo)) {
                state.expansoesGanttGrupo = atuais.filter(item => item !== grupo);
            } else {
                state.expansoesGanttGrupo = [...atuais, grupo];
            }
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        function definirFiltroStatusGanttExpansoes(valor) {
            const status = normalizarStatusExpansao(valor || '');
            state.expansoesGanttStatus = status && status !== 'neutro' ? [status] : [];
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        function definirFiltroGrupoGanttExpansoes(valor) {
            const grupo = String(valor || '').trim();
            state.expansoesGanttGrupo = grupo ? [grupo] : [];
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        function limparFiltrosGanttExpansoes() {
            state.expansoesGanttFiltro = '';
            state.expansoesGanttStatus = [];
            state.expansoesGanttGrupo = [];
            state.termoPesquisa = '';
            const buscaGlobal = document.getElementById('search-input');
            if (buscaGlobal) buscaGlobal.value = '';
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        function alternarTelaCheiaGanttExpansoes() {
            state.expansoesGanttFullscreen = !state.expansoesGanttFullscreen;
            document.body.classList.toggle('atlas-exp-gantt-is-fullscreen', !!state.expansoesGanttFullscreen);
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        function fecharTelaCheiaGanttExpansoes() {
            if (!state.expansoesGanttFullscreen) return;
            state.expansoesGanttFullscreen = false;
            document.body.classList.remove('atlas-exp-gantt-is-fullscreen');
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 80);
        }

        if (!window.__atlasExpGanttEscapeHandler) {
            window.__atlasExpGanttEscapeHandler = true;
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && state.expansoesGanttFullscreen) {
                    fecharTelaCheiaGanttExpansoes();
                }
            });
        }

        function centralizarHojeGanttExpansoes() {
            const scroll = document.querySelector('#painel-expansoes .atlas-exp-gantt-scroll');
            const grid = scroll?.querySelector('.atlas-exp-gantt-grid');
            if (!scroll || !grid) return;
            const leftWidth = Number(grid.dataset.leftWidth || 320);
            const todayLeft = Number(grid.dataset.todayLeft || 0);
            const alvo = Math.max(0, (leftWidth + todayLeft) - (scroll.clientWidth / 2));
            scroll.scrollLeft = alvo;
        }

        function obterPeriodoProjetoGanttExpansao(projeto, subsProjeto = []) {
            const periodo = extrairPeriodoDuracaoCompletaExpansao(projeto?.duracao_completa);
            let inicio = periodo.inicio || '';
            let fim = periodo.fim || '';
            const iniciosSub = subsProjeto.map(s => String(s.timeline_inicio || '').slice(0, 10)).filter(dataIsoValidaExpansao).sort();
            const finsSub = subsProjeto.map(s => String(s.timeline_fim || '').slice(0, 10)).filter(dataIsoValidaExpansao).sort();
            if (!inicio && iniciosSub.length) inicio = iniciosSub[0];
            if (!fim && finsSub.length) fim = finsSub[finsSub.length - 1];
            const conclusao = String(projeto?.data_conclusao || '').slice(0, 10);
            if (!inicio && dataIsoValidaExpansao(conclusao)) inicio = conclusao;
            if (!fim && dataIsoValidaExpansao(conclusao)) fim = conclusao;
            if (inicio && !fim) fim = inicio;
            if (fim && !inicio) inicio = fim;
            if (inicio && fim && fim < inicio) fim = inicio;
            return { inicio, fim };
        }

        function montarLinhasGanttExpansoes(projetosBase, termo = '') {
            const termoFiltro = String(termo || '').trim().toLowerCase();
            const filtrosStatus = obterFiltrosStatusGanttExpansoes();
            const filtrosGrupo = obterFiltrosGrupoGanttExpansoes();
            const semanaAtual = obterSemanaAtual();
            const subsTodos = state.expansoesSubitems || [];
            const linhas = [];

            function passaFiltrosGanttExpansoes(linha) {
                if (filtrosGrupo.length && !filtrosGrupo.includes(linha.grupoId)) return false;
                const statusLinha = normalizarStatusExpansao(linha.status);
                if (filtrosStatus.length && !filtrosStatus.includes(statusLinha)) return false;
                if (statusLinha === 'concluido' && filtrosStatus.includes('concluido')) {
                    const dataConclusao = String(linha.conclusao || linha.fim || '').slice(0, 10);
                    return dataEstaEntreISO(dataConclusao, semanaAtual.inicio, semanaAtual.fim);
                }
                return true;
            }

            ATLAS_EXP_GRUPOS.forEach(grupo => {
                const projetosGrupo = (projetosBase || [])
                    .filter(p => (p.grupo || 'em_progresso') === grupo.id)
                    .filter(p => filtrarProjetoExpansao(p, termoFiltro));
                projetosGrupo.forEach(projeto => {
                    const subsProjeto = subsTodos.filter(s => s.expansao_id === projeto.id);
                    const periodo = obterPeriodoProjetoGanttExpansao(projeto, subsProjeto);
                    if (periodo.inicio && periodo.fim) {
                        linhas.push({
                            tipo: 'projeto',
                            id: projeto.id,
                            grupoId: grupo.id,
                            grupo: grupo.titulo,
                            nome: projeto.nome || 'Projeto sem nome',
                            status: projeto.status || 'Em Progresso',
                            inicio: periodo.inicio,
                            fim: periodo.fim,
                            conclusao: String(projeto.data_conclusao || '').slice(0, 10),
                            meta: `${grupo.titulo}${subsProjeto.length ? ` · ${subsProjeto.length} subelemento(s)` : ''}`,
                            projetoNome: projeto.nome || ''
                        });
                    }
                    subsProjeto.forEach(sub => {
                        let inicio = String(sub.timeline_inicio || '').slice(0, 10);
                        let fim = String(sub.timeline_fim || '').slice(0, 10);
                        if (!dataIsoValidaExpansao(inicio) && dataIsoValidaExpansao(fim)) inicio = fim;
                        if (!dataIsoValidaExpansao(fim) && dataIsoValidaExpansao(inicio)) fim = inicio;
                        if (!dataIsoValidaExpansao(inicio) || !dataIsoValidaExpansao(fim)) return;
                        if (fim < inicio) fim = inicio;
                        linhas.push({
                            tipo: 'subitem',
                            id: sub.id,
                            grupoId: grupo.id,
                            grupo: grupo.titulo,
                            nome: sub.nome || 'Subelemento sem nome',
                            status: sub.status || projeto.status || 'Em Progresso',
                            inicio,
                            fim,
                            conclusao: String(sub.data_conclusao || sub.concluido_em || (normalizarStatusExpansao(sub.status || projeto.status) === 'concluido' ? fim : '') || '').slice(0, 10),
                            meta: projeto.nome || 'Projeto sem nome',
                            projetoNome: projeto.nome || ''
                        });
                    });
                });
            });
            return linhas
                .filter(passaFiltrosGanttExpansoes)
                .sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)) || (a.tipo === 'projeto' ? -1 : 1));
        }


        function obterObraNomeExpansao(projeto) {
            return valorTextoAdmin(projeto?.obra_nome) || 'Obra padrão';
        }

        function ehObraPadraoExpansao(nomeObra) {
            const nome = valorTextoAdmin(nomeObra) || 'Obra padrão';
            return !nome || nome === 'Obra padrão';
        }

        function ehElementoObraExpansao(projeto) {
            return !!projeto && !ehObraPadraoExpansao(projeto.obra_nome);
        }

        function ehProjetoManualExpansao(projeto) {
            return !!projeto && !ehElementoObraExpansao(projeto);
        }

        function obterProjetosPorObraExpansao(projetos) {
            const grupos = new Map();
            (projetos || []).forEach(projeto => {
                const nomeObra = obterObraNomeExpansao(projeto);
                if (!grupos.has(nomeObra)) grupos.set(nomeObra, []);
                grupos.get(nomeObra).push(projeto);
            });
            return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        }

        function selecionarObraExpansoes(nomeObra) {
            state.moduloAtivo = 'expansoes';
            state.expansoesVisualizacao = 'obras';
            state.expansoesObraAtiva = nomeObra || '';
            state.expansoesObrasSelecionados = { elementos: {}, subitems: {} };
            atualizarVisibilidadeModulos();
            renderExpansoes();
        }

        function obterSelecaoObrasExpansoes() {
            if (!state.expansoesObrasSelecionados) {
                state.expansoesObrasSelecionados = { elementos: {}, subitems: {} };
            }
            state.expansoesObrasSelecionados.elementos = state.expansoesObrasSelecionados.elementos || {};
            state.expansoesObrasSelecionados.subitems = state.expansoesObrasSelecionados.subitems || {};
            return state.expansoesObrasSelecionados;
        }

        function elementoObraExpansaoSelecionado(id) {
            return !!obterSelecaoObrasExpansoes().elementos[id];
        }

        function subitemObraExpansaoSelecionado(id) {
            return !!obterSelecaoObrasExpansoes().subitems[id];
        }

        function subIdsDoElementoObraExpansao(projeto) {
            return obterSubitemsDaExpansao(projeto?.id).map(sub => sub.id).filter(Boolean);
        }

        function definirSelecaoElementoObraExpansao(elementoId, marcado, incluirSubs = true) {
            const selecao = obterSelecaoObrasExpansoes();
            if (marcado) selecao.elementos[elementoId] = true;
            else delete selecao.elementos[elementoId];

            if (incluirSubs) {
                const projeto = (state.expansoes || []).find(p => p.id === elementoId);
                subIdsDoElementoObraExpansao(projeto).forEach(subId => {
                    if (marcado) selecao.subitems[subId] = true;
                    else delete selecao.subitems[subId];
                });
            }
        }

        function atualizarSelecaoElementoObraAPartirDosSubs(elementoId) {
            const projeto = (state.expansoes || []).find(p => p.id === elementoId);
            const subIds = subIdsDoElementoObraExpansao(projeto);
            const selecao = obterSelecaoObrasExpansoes();
            if (subIds.length > 0 && subIds.every(id => subitemObraExpansaoSelecionado(id))) {
                selecao.elementos[elementoId] = true;
            } else {
                delete selecao.elementos[elementoId];
            }
        }

        function toggleSelecaoElementoObraExpansao(elementoId, marcado) {
            definirSelecaoElementoObraExpansao(elementoId, marcado, true);
            renderExpansoes();
        }

        function toggleSelecaoSubitemObraExpansao(elementoId, subId, marcado) {
            const selecao = obterSelecaoObrasExpansoes();
            if (marcado) selecao.subitems[subId] = true;
            else delete selecao.subitems[subId];
            atualizarSelecaoElementoObraAPartirDosSubs(elementoId);
            renderExpansoes();
        }

        function textoBuscaObraExpansao(projeto) {
            const subs = obterSubitemsDaExpansao(projeto?.id);
            return [
                projeto?.obra_nome, projeto?.nome, projeto?.status, projeto?.responsavel, projeto?.kmz,
                ...subs.flatMap(sub => [sub.nome, sub.status, sub.responsavel, sub.tipo_cabo, sub.validacao])
            ].join(' ').toLowerCase();
        }

        function obterElementosObrasExpansoesVisiveis(base = null, filtroTexto = null) {
            const filtro = filtroTexto === null ? String(state.termoPesquisa || '').trim().toLowerCase() : String(filtroTexto || '').trim().toLowerCase();
            const lista = Array.isArray(base) ? base : (state.expansoes || []).filter(ehElementoObraExpansao);
            return lista.filter(p => {
                const mesmaObra = !state.expansoesObraAtiva || obterObraNomeExpansao(p) === state.expansoesObraAtiva;
                const passaTexto = !filtro || textoBuscaObraExpansao(p).includes(filtro);
                return mesmaObra && passaTexto;
            });
        }

        function limparSelecoesInvalidasObrasExpansoes(base = null) {
            const lista = Array.isArray(base) ? base : (state.expansoes || []).filter(ehElementoObraExpansao);
            const idsElementos = new Set(lista.map(p => p.id).filter(Boolean));
            const idsSubitems = new Set(lista.flatMap(p => subIdsDoElementoObraExpansao(p)));
            const selecao = obterSelecaoObrasExpansoes();
            Object.keys(selecao.elementos).forEach(id => { if (!idsElementos.has(id)) delete selecao.elementos[id]; });
            Object.keys(selecao.subitems).forEach(id => { if (!idsSubitems.has(id)) delete selecao.subitems[id]; });
        }

        function existeSelecaoObrasExpansoes() {
            const selecao = obterSelecaoObrasExpansoes();
            return Object.keys(selecao.elementos).length > 0 || Object.keys(selecao.subitems).length > 0;
        }

        function idsElementosObrasExpansoesSelecionados() {
            const idsValidos = new Set((state.expansoes || []).filter(ehElementoObraExpansao).map(projeto => projeto.id));
            return Object.keys(obterSelecaoObrasExpansoes().elementos).filter(id => idsValidos.has(id));
        }

        function limparSelecaoObrasExpansoes() {
            state.expansoesObrasSelecionados = { elementos: {}, subitems: {} };
            renderExpansoes();
        }

        function renderBarraMoverObrasExpansoes() {
            const ids = idsElementosObrasExpansoesSelecionados();
            if (!ids.length) return '';
            const opcoes = ATLAS_EXP_OBRA_FASES.map(fase => `<option value="${escaparHtml(fase.id)}">${escaparHtml(fase.titulo)}</option>`).join('');
            return `<div class="atlas-exp-move-toolbar atlas-exp-obras-move-toolbar" role="region" aria-label="Mover elementos selecionados da obra">
                <div class="atlas-exp-move-summary"><span class="atlas-exp-move-icon" aria-hidden="true">↪</span><strong>${ids.length}</strong><span>elemento(s) selecionado(s)</span></div>
                <div class="atlas-exp-move-controls">
                    <label title="Escolher grupo de destino"><select id="atlas-exp-obras-destino" aria-label="Grupo de destino" style="background-color:var(--atlas-exp-move-select-bg)!important;color:var(--atlas-exp-move-select-text)!important;border-color:var(--atlas-exp-move-select-border)!important"><option value="">Mover para o grupo...</option>${opcoes}</select></label>
                    <button type="button" class="atlas-exp-move-confirm" onclick="moverElementosObrasExpansoesSelecionados()" title="Mover elementos para o grupo escolhido">↪ <span>Mover</span></button>
                    <button type="button" class="atlas-exp-move-clear" onclick="limparSelecaoObrasExpansoes()" title="Limpar seleção" aria-label="Limpar seleção">×</button>
                </div>
            </div>`;
        }

        async function moverElementosObrasExpansoesSelecionados() {
            if (!await exigirPermissaoAtlas('editar_registro', 'mover elementos entre os grupos da obra')) return;
            const faseId = document.getElementById('atlas-exp-obras-destino')?.value || '';
            const fase = ATLAS_EXP_OBRA_FASES.find(item => item.id === faseId);
            if (!fase) {
                await alertaVisualAtnx('Escolha o destino', 'Selecione o grupo para onde os elementos devem ser movidos.');
                return;
            }
            const ids = idsElementosObrasExpansoesSelecionados();
            if (!ids.length) return;
            const primeiroElemento = (state.expansoes || []).find(projeto => ids.includes(projeto.id));
            const nomeObra = obterObraNomeExpansao(primeiroElemento);
            const anteriores = new Map();
            const grupoDestino = obterGrupoPadraoPorFaseExpansao(fase.id);
            (state.expansoes || []).forEach(projeto => {
                if (ids.includes(projeto.id)) {
                    anteriores.set(projeto.id, { fase: projeto.fase, grupo: projeto.grupo });
                    projeto.fase = fase.id;
                    projeto.grupo = grupoDestino;
                }
            });
            state.expansoesObraAtiva = nomeObra;
            state.expansoesObrasFasesAbertas[`${nomeObra}::${fase.id}`] = true;
            state.expansoesObrasSelecionados = { elementos: {}, subitems: {} };
            renderExpansoes();
            exibirStatusTemporario(`Movendo ${ids.length} elemento(s) para ${nomeObra} · ${fase.titulo}...`, 'bg-[#0073ea]');
            try {
                const { error } = await supabaseClient.from('atlas_expansoes').update({ fase: fase.id, grupo: grupoDestino, updated_at: new Date().toISOString() }).in('id', ids);
                if (error) throw error;
                await registrarAuditoria('edição', 'expansao', ids.join(','), `${ids.length} elemento(s)`, 'fase', 'grupos anteriores', fase.titulo, `Elementos movidos entre grupos da obra ${nomeObra}`);
                exibirStatusTemporario(`✅ ${ids.length} elemento(s) movido(s) para ${nomeObra} · ${fase.titulo}.`, 'bg-emerald-600');
            } catch (err) {
                (state.expansoes || []).forEach(projeto => {
                    const anterior = anteriores.get(projeto.id);
                    if (anterior) Object.assign(projeto, anterior);
                });
                renderExpansoes();
                await alertaVisualAtnx('Erro ao mover elementos', err.message || String(err));
            }
        }

        function obterSelecaoParaStatusObraExpansao(tipoOrigem, idOrigem) {
            if (!existeSelecaoObrasExpansoes()) {
                return tipoOrigem === 'subitem'
                    ? { elementos: [], subitems: [idOrigem] }
                    : { elementos: [idOrigem], subitems: [] };
            }

            const selecao = obterSelecaoObrasExpansoes();
            const elementos = new Set(Object.keys(selecao.elementos));
            const subitems = new Set(Object.keys(selecao.subitems));
            elementos.forEach(elementoId => {
                const projeto = (state.expansoes || []).find(p => p.id === elementoId);
                subIdsDoElementoObraExpansao(projeto).forEach(subId => subitems.add(subId));
            });
            return { elementos: Array.from(elementos), subitems: Array.from(subitems) };
        }

        function aplicarStatusLocalObraExpansao(statusFinal, selecao) {
            const elementos = new Set(selecao.elementos || []);
            const subitems = new Set(selecao.subitems || []);
            (state.expansoes || []).forEach(p => { if (elementos.has(p.id)) p.status = statusFinal; });
            (state.expansoesSubitems || []).forEach(s => { if (subitems.has(s.id)) s.status = statusFinal; });
        }

        async function alterarStatusObraExpansaoEmLote(statusFinal, selecao) {
            const atualizacoes = [];
            if ((selecao.elementos || []).length) {
                atualizacoes.push(supabaseClient.from('atlas_expansoes').update({ status: statusFinal, updated_at: new Date().toISOString() }).in('id', selecao.elementos));
            }
            if ((selecao.subitems || []).length) {
                atualizacoes.push(supabaseClient.from('atlas_expansoes_subitems').update({ status: statusFinal, updated_at: new Date().toISOString() }).in('id', selecao.subitems));
            }
            if (!atualizacoes.length) return;
            const resultados = await Promise.all(atualizacoes);
            const erro = resultados.find(r => r.error)?.error;
            if (erro) throw erro;
        }

        async function salvarStatusExpansaoComSelecao(tabela, id, campo, valor, tipo = 'projeto', selectEl = null) {
            atualizarClasseSelectStatusExpansao(selectEl);
            if (campo !== 'status' || state.moduloAtivo !== 'expansoes' || state.expansoesVisualizacao !== 'obras') {
                return salvarCampoExpansao(tabela, id, campo, valor, tipo);
            }
            const statusFinal = normalizarValorCampoExpansao('status', valor);
            const selecao = obterSelecaoParaStatusObraExpansao(tipo, id);
            aplicarStatusLocalObraExpansao(statusFinal, selecao);
            renderExpansoes();
            exibirStatusTemporario('💾 Salvando status selecionado em Expansões...', 'bg-[#0073ea]');
            try {
                await alterarStatusObraExpansaoEmLote(statusFinal, selecao);
                await registrarAuditoria('edição', tipo === 'subitem' ? 'expansao_subitem' : 'expansao', id, 'status em lote', 'status', '', statusFinal ?? '', `Alteração de status em lote em Obras de Expansões: ${selecao.elementos.length} elemento(s), ${selecao.subitems.length} subelemento(s)`);
                exibirStatusTemporario(`✅ Status atualizado: ${selecao.elementos.length} elemento(s), ${selecao.subitems.length} subelemento(s).`, 'bg-emerald-600');
                await carregarExpansoes();
            } catch (err) {
                console.error(err);
                exibirStatusTemporario('⚠️ Erro ao alterar status de Expansões: ' + (err.message || String(err)), 'bg-red-600');
                await alertaVisualAtnx('Erro ao alterar status em Expansões', err.message || String(err));
                await carregarExpansoes();
            }
        }

        function toggleSelecaoTodosObrasExpansoes(marcado) {
            const visiveis = obterElementosObrasExpansoesVisiveis();
            visiveis.forEach(projeto => definirSelecaoElementoObraExpansao(projeto.id, marcado, true));
            renderExpansoes();
        }

        function obterElementosGrupoFaseObraExpansao(nomeObra, faseId, base = null) {
            const fase = normalizarFaseObraExpansao(faseId);
            const lista = Array.isArray(base) ? base : obterElementosObrasExpansoesVisiveis();
            return lista.filter(projeto => {
                return obterObraNomeExpansao(projeto) === nomeObra
                    && normalizarFaseObraExpansao(projeto.fase, projeto.nome) === fase;
            });
        }

        function obterResumoSelecaoGrupoFaseObraExpansao(nomeObra, faseId, base = null) {
            const elementos = obterElementosGrupoFaseObraExpansao(nomeObra, faseId, base);
            let total = 0;
            let marcados = 0;
            elementos.forEach(projeto => {
                total += 1;
                if (elementoObraExpansaoSelecionado(projeto.id)) marcados += 1;
                const subIds = subIdsDoElementoObraExpansao(projeto);
                total += subIds.length;
                subIds.forEach(subId => {
                    if (subitemObraExpansaoSelecionado(subId)) marcados += 1;
                });
            });
            return {
                elementos,
                total,
                marcados,
                checked: total > 0 && marcados === total,
                indeterminate: marcados > 0 && marcados < total
            };
        }

        function textoResumoSelecaoGrupoFaseObraExpansao(resumo) {
            if (!resumo || !resumo.total) return 'Sem itens';
            if (!resumo.marcados) return 'Selecionar grupo';
            if (resumo.checked) return 'Grupo selecionado';
            return `${resumo.marcados}/${resumo.total} selecionados`;
        }

        function toggleSelecaoGrupoFaseObraExpansao(nomeObra, faseId, marcado) {
            const elementos = obterElementosGrupoFaseObraExpansao(nomeObra, faseId);
            elementos.forEach(projeto => definirSelecaoElementoObraExpansao(projeto.id, marcado, true));
            renderExpansoes();
        }

        function atualizarSelecaoGruposObrasExpansoesVisual() {
            document.querySelectorAll('input[data-exp-select-grupo]').forEach(input => {
                const nomeObra = input.getAttribute('data-obra') || '';
                const faseId = input.getAttribute('data-fase') || '';
                const resumo = obterResumoSelecaoGrupoFaseObraExpansao(nomeObra, faseId);
                input.checked = !!resumo.checked;
                input.indeterminate = !!resumo.indeterminate;
                input.disabled = resumo.total === 0;
                const label = input.closest('.atlas-exp-obras-select-group');
                const texto = label?.querySelector('[data-exp-select-grupo-text]');
                if (texto) texto.textContent = textoResumoSelecaoGrupoFaseObraExpansao(resumo);
            });
        }

        function atualizarSelecaoTodosObrasExpansoesVisual() {
            const check = document.getElementById('check-todos-expansoes-obras');
            if (!check) return;
            const visiveis = obterElementosObrasExpansoesVisiveis();
            const total = visiveis.length;
            const marcados = visiveis.filter(p => elementoObraExpansaoSelecionado(p.id)).length;
            check.checked = total > 0 && marcados === total;
            check.indeterminate = marcados > 0 && marcados < total;
            check.disabled = total === 0;
        }

        function inicializarScrollHorizontalExpansoesObras() {
            const wrappers = document.querySelectorAll('.atlas-exp-obra-table-wrap, .atlas-exp-sub-table-wrap');
            wrappers.forEach(wrap => {
                if (wrap.dataset.hscrollBottomReady === 'true') return;
                wrap.dataset.hscrollBottomReady = 'true';
                wrap.addEventListener('wheel', event => {
                    if (!event.shiftKey) return;
                    const dy = Math.abs(Number(event.deltaY || 0));
                    const dx = Math.abs(Number(event.deltaX || 0));
                    if (dy > dx) {
                        wrap.scrollLeft += event.deltaY;
                        event.preventDefault();
                    }
                }, { passive: false });
            });
        }

        function renderSidebarObrasExpansoes(projetos = state.expansoes) {
            const sidebar = document.getElementById('sidebar-obras');
            if (!sidebar) return;
            const grupos = obterProjetosPorObraExpansao(projetos || []);
            sidebar.innerHTML = '';
            if (!grupos.length) {
                state.expansoesObraAtiva = '';
                sidebar.innerHTML = `<div class="text-[11px] text-gray-600 italic p-3 text-center">Nenhuma obra de expansão criada. Clique no botão “+” acima.</div>`;
                return;
            }
            if (!state.expansoesObraAtiva || !grupos.some(([nome]) => nome === state.expansoesObraAtiva)) {
                state.expansoesObraAtiva = grupos[0][0];
            }
            sidebar.innerHTML = grupos.map(([nome, itens]) => {
                const ativo = nome === state.expansoesObraAtiva;
                const totalSub = itens.reduce((acc, p) => acc + obterSubitemsDaExpansao(p.id).length, 0);
                const nomeJs = escaparAtributoJs(nome);
                return `<div class="atlas-sidebar-folder group ${ativo ? 'active' : ''}">
                    <button onclick="selecionarObraExpansoes('${nomeJs}')" class="atlas-sidebar-folder-main" title="${escaparHtml(nome)}">
                        <span class="atlas-sidebar-folder-icon">📁</span>
                        <span class="atlas-sidebar-folder-text">${escaparHtml(nome)}</span>
                        <span class="atlas-sidebar-folder-count">${itens.length}</span>
                    </button>
                    <button onclick="renomearObraExpansoes('${nomeJs}')" class="atlas-sidebar-folder-action" title="Renomear obra">✏️</button>
                    <button onclick="excluirObraExpansoes('${nomeJs}', event)" class="atlas-sidebar-folder-action danger" title="Apagar obra">🗑️</button>
                    <div class="atlas-sidebar-folder-meta">${totalSub} subelemento(s)</div>
                </div>`;
            }).join('');
        }

        async function excluirObraExpansoes(nomeObra, e) {
            if (e) e.stopPropagation();
            const projetos = (state.expansoes || []).filter(p => obterObraNomeExpansao(p) === nomeObra);
            if (!projetos.length) return;
            const totalSub = projetos.reduce((acc, p) => acc + obterSubitemsDaExpansao(p.id).length, 0);
            const confirmado = await confirmarVisualAtnx(
                'Remover obra de Expansões',
                `Remover a obra ${nomeObra}?

Serão removidos ${projetos.length} elemento(s) e ${totalSub} subelemento(s). Os arquivos vinculados serão enviados para a lixeira do Google Drive de Expansões.`,
                'Remover obra'
            );
            if (!confirmado) return;
            try {
                exibirStatusTemporario('🗑️ Removendo obra de Expansões...', 'bg-[#0073ea]');
                for (const projeto of projetos) {
                    await excluirEntidadeExpansaoNoGoogleDrive('projeto', projeto);
                }
                const ids = projetos.map(p => p.id).filter(Boolean);
                if (ids.length) {
                    const { error: errSubs } = await supabaseClient.from('atlas_expansoes_subitems').delete().in('expansao_id', ids);
                    if (errSubs) throw errSubs;
                    const { error } = await supabaseClient.from('atlas_expansoes').delete().in('id', ids);
                    if (error) throw error;
                }
                await registrarAuditoria('remoção', 'expansao_obra', ids.join(','), nomeObra, 'obra', nomeObra, '', 'Obra de Expansões removida com limpeza no Drive');
                state.expansoesObraAtiva = '';
                exibirStatusTemporario('✅ Obra de Expansões removida.', 'bg-emerald-600');
                await carregarExpansoes();
            } catch (err) {
                console.error(err);
                await alertaVisualAtnx('Erro ao remover obra de Expansões', (err.message || String(err)) + '\n\nA remoção foi interrompida para evitar arquivos órfãos no Google Drive.');
            }
        }

        function obterColunasElementoObraExpansao(faseId) {
            const fase = normalizarFaseObraExpansao(faseId);
            const colunas = [
                { key: 'check', label: '', classe: 'atlas-exp-check' },
                { key: 'elemento', label: 'Elemento' },
                { key: 'comentario', label: '' }
            ];
            if (fase !== 'fusoes') {
                colunas.push(
                    { key: 'total_projetado', label: 'Total Projetado' },
                    { key: 'total_lancado', label: 'Total Lançado' }
                );
            }
            colunas.push(
                { key: 'status', label: 'Status' },
                { key: 'responsavel', label: 'Responsável' },
                { key: 'kmz', label: 'KMZ' },
                { key: 'data', label: 'Data' },
                { key: 'validacao', label: 'Validação' }
            );
            if (fase !== 'fusoes') {
                colunas.push(
                    { key: 'slot', label: 'Slot' },
                    { key: 'portas', label: 'Portas' },
                    { key: 'fotos_olt', label: 'Fotos da OLT' }
                );
            }
            colunas.push({ key: 'acoes', label: 'Ações' });
            return colunas;
        }

        function obterColunasSubitemObraExpansao(faseId) {
            const fase = normalizarFaseObraExpansao(faseId);
            const colunas = [
                { key: 'check', label: '', classe: 'atlas-exp-check' },
                { key: 'subelemento', label: 'Subelemento' },
                { key: 'comentario', label: '' },
                { key: 'status', label: 'Status' }
            ];

            if (fase === 'fusoes') {
                // Fusões fica enxuto, mas mantém Fotos no subelemento conforme solicitado.
                colunas.push(
                    { key: 'fotos', label: 'Fotos' },
                    { key: 'diagrama_fusao', label: 'Diagrama de Fusão' }
                );
            } else {
                // Em Lançamento, Diferença fica imediatamente ao lado de Lançado.
                colunas.push(
                    { key: 'tipo_cabo', label: 'Tipo de Cabo' },
                    { key: 'projetado', label: 'Projetado' },
                    { key: 'lancado', label: 'Lançado' },
                    { key: 'diferenca', label: 'Diferença' },
                    { key: 'fotos', label: 'Fotos' },
                    { key: 'diagrama_fusao', label: 'Diagrama de Fusão' }
                );
            }

            colunas.push(
                { key: 'validacao', label: 'Validação' },
                { key: 'data', label: 'Data' },
                { key: 'responsavel', label: 'Responsável' }
            );
            return colunas;
        }

        function renderCabecalhoColunasObraExpansao(colunas) {
            return colunas.map(col => `<th class="${col.classe || ''}">${escaparHtml(col.label || '')}</th>`).join('');
        }

        function renderCelulaSubitemObraExpansao(sub, coluna, projeto) {
            const fase = normalizarFaseObraExpansao(projeto?.fase, projeto?.nome);
            const attrsDiff = `data-exp-id="${escaparHtml(sub.id)}" data-exp-tipo="subitem" data-exp-campo="diferenca"`;
            switch (coluna.key) {
                case 'check': return `<td class="atlas-exp-check"><input type="checkbox" aria-label="Selecionar subelemento" ${subitemObraExpansaoSelecionado(sub.id) ? 'checked' : ''} onclick="event.stopPropagation();toggleSelecaoSubitemObraExpansao('${escaparHtml(projeto?.id || '')}', '${escaparHtml(sub.id)}', this.checked)" /></td>`;
                case 'subelemento': return `<td class="atlas-exp-sub-name-cell">${renderCampoEditavelExpansao('subitem', sub.id, 'nome', sub.nome || '', { placeholder: 'Subelemento' })}</td>`;
                case 'comentario': return '<td class="atlas-exp-comment-cell"><button type="button" title="Remover subitem" onclick="excluirSubitemExpansao(\'' + escaparHtml(sub.id) + '\')">🗑</button></td>';
                case 'status': return `<td>${renderCampoEditavelExpansao('subitem', sub.id, 'status', sub.status || '', { status: true })}</td>`;
                case 'tipo_cabo': return `<td>${renderCampoEditavelExpansao('subitem', sub.id, 'tipo_cabo', sub.tipo_cabo || '', { placeholder: '2FO / 6FO' })}</td>`;
                case 'projetado': return `<td>${renderCampoEditavelExpansao('subitem', sub.id, 'projetado', sub.projetado, { type: 'number' })}</td>`;
                case 'lancado': return `<td>${renderCampoEditavelExpansao('subitem', sub.id, 'lancado', sub.lancado, { type: 'number' })}</td>`;
                case 'fotos': return `<td>${renderCampoImagemExpansao('subitem', sub.id, 'fotos', sub.fotos || sub.imagens)}</td>`;
                case 'diagrama_fusao': return `<td>${renderCampoImagemExpansao('subitem', sub.id, 'diagrama_fusao', sub.diagrama_fusao)}</td>`;
                case 'diferenca': {
                    const valor = obterValorDiferencaSubitemExpansao(sub);
                    if (fase === 'lancamento') return `<td>${renderValorAutomaticoExpansao(valor, attrsDiff)}</td>`;
                    return `<td>${renderCampoEditavelExpansao('subitem', sub.id, 'diferenca', sub.diferenca, { type: 'number' })}</td>`;
                }
                case 'validacao': return `<td>${renderCampoEditavelExpansao('subitem', sub.id, 'validacao', sub.validacao)}</td>`;
                case 'data': return `<td>${renderCampoEditavelExpansao('subitem', sub.id, 'data', sub.data, { type: 'date' })}</td>`;
                case 'responsavel': return `<td>${renderCampoEditavelExpansao('subitem', sub.id, 'responsavel', sub.responsavel)}</td>`;
                default: return '<td></td>';
            }
        }

        function renderSubitemObraExpansao(sub, projeto) {
            const colunas = obterColunasSubitemObraExpansao(projeto?.fase);
            return `<tr class="atlas-exp-sub-row atlas-exp-obra-sub-row ${subitemObraExpansaoSelecionado(sub.id) ? 'is-selected' : ''}">${colunas.map(col => renderCelulaSubitemObraExpansao(sub, col, projeto)).join('')}</tr>`;
        }

        function renderCelulaNovaSubitemObraExpansao(coluna, projeto) {
            const fase = normalizarFaseObraExpansao(projeto?.fase, projeto?.nome);
            const isLancamento = fase === 'lancamento';
            switch (coluna.key) {
                case 'check': return '<td class="atlas-exp-check"><input type="checkbox" disabled /></td>';
                case 'subelemento': return `<td>${renderCampoNovoSubitemExpansao('nome', { placeholder: 'Novo subelemento' })}</td>`;
                case 'comentario': return `<td class="atlas-exp-row-actions"><button type="button" onclick="salvarNovoSubitemLinha('${escaparHtml(projeto.id)}')">Salvar</button><button type="button" onclick="cancelarNovoSubitemExpansao()">Cancelar</button></td>`;
                case 'status': return `<td>${renderCampoNovoSubitemExpansao('status', { status: true, value: 'Em Progresso' })}</td>`;
                case 'tipo_cabo': return `<td>${renderCampoNovoSubitemExpansao('tipo_cabo')}</td>`;
                case 'projetado': return `<td>${renderCampoNovoSubitemExpansao('projetado', { type: 'number', oninput: isLancamento ? 'atualizarDiferencaNovaLinhaObraExpansao(this)' : '' })}</td>`;
                case 'lancado': return `<td>${renderCampoNovoSubitemExpansao('lancado', { type: 'number', oninput: isLancamento ? 'atualizarDiferencaNovaLinhaObraExpansao(this)' : '' })}</td>`;
                case 'fotos': return `<td>${renderCampoNovoImagemExpansao('fotos', { subitem: true })}</td>`;
                case 'diagrama_fusao': return `<td>${renderCampoNovoImagemExpansao('diagrama_fusao', { subitem: true })}</td>`;
                case 'diferenca': return isLancamento
                    ? `<td>${renderValorAutomaticoExpansao(null, 'data-exp-auto-diferenca-new="true"')}</td>`
                    : `<td>${renderCampoNovoSubitemExpansao('diferenca', { type: 'number' })}</td>`;
                case 'validacao': return `<td>${renderCampoNovoSubitemExpansao('validacao')}</td>`;
                case 'data': return `<td>${renderCampoNovoSubitemExpansao('data', { type: 'date' })}</td>`;
                case 'responsavel': return `<td>${renderCampoNovoSubitemExpansao('responsavel')}</td>`;
                default: return '<td></td>';
            }
        }

        function renderSubitemsObraExpansao(projeto) {
            const subs = obterSubitemsDaExpansao(projeto.id);
            const colunas = obterColunasSubitemObraExpansao(projeto.fase);
            const novaLinha = state.expansaoSubitemNovoProjetoId === projeto.id
                ? `<tr class="atlas-exp-sub-row atlas-exp-new-row" data-new-sub-expansao="${escaparHtml(projeto.id)}">${colunas.map(col => renderCelulaNovaSubitemObraExpansao(col, projeto)).join('')}</tr>`
                : `<tr class="atlas-exp-add-row" onclick="abrirCadastroSubitemExpansao('${projeto.id}')"><td class="atlas-exp-check"><input type="checkbox" disabled /></td><td colspan="${Math.max(1, colunas.length - 1)}">+ Adicionar subelemento</td></tr>`;
            return `<tr class="atlas-exp-sub-table-row atlas-exp-obra-sub-table-row"><td colspan="${obterColunasElementoObraExpansao(projeto.fase).length}"><div class="atlas-exp-sub-table-wrap"><table class="atlas-exp-sub-table atlas-exp-obra-sub-table">
                <thead><tr>${renderCabecalhoColunasObraExpansao(colunas)}</tr></thead>
                <tbody>${subs.map(sub => renderSubitemObraExpansao(sub, projeto)).join('')}${novaLinha}</tbody></table></div></td></tr>`;
        }

        function renderCelulaElementoObraExpansao(projeto, coluna, aberto) {
            const subs = obterSubitemsDaExpansao(projeto.id);
            switch (coluna.key) {
                case 'check': return `<td class="atlas-exp-check"><input type="checkbox" aria-label="Selecionar ${escaparHtml(projeto.nome || 'elemento')}" ${elementoObraExpansaoSelecionado(projeto.id) ? 'checked' : ''} onclick="event.stopPropagation();toggleSelecaoElementoObraExpansao('${escaparHtml(projeto.id)}', this.checked)" /></td>`;
                case 'elemento': return `<td class="atlas-exp-elemento-cell"><div class="atlas-exp-elemento-inline"><button class="atlas-exp-caret-btn" type="button" onclick="alternarProjetoExpansoes('${projeto.id}')">${aberto ? '⌄' : '›'}</button>${renderCampoEditavelExpansao('projeto', projeto.id, 'nome', projeto.nome || '', { placeholder: 'Elemento' })}<span class="atlas-exp-sub-count">${subs.length}</span></div></td>`;
                case 'comentario': return `<td class="atlas-exp-comment-cell"><button type="button" title="Adicionar subitem" onclick="abrirCadastroSubitemExpansao('${projeto.id}')">＋</button></td>`;
                case 'total_projetado': return `<td>${renderCampoEditavelExpansao('projeto', projeto.id, 'total_projetado', projeto.total_projetado, { type: 'number' })}</td>`;
                case 'total_lancado': return `<td>${renderCampoEditavelExpansao('projeto', projeto.id, 'total_lancado', projeto.total_lancado, { type: 'number' })}</td>`;
                case 'status': return `<td>${renderCampoEditavelExpansao('projeto', projeto.id, 'status', projeto.status || '', { status: true })}</td>`;
                case 'responsavel': return `<td>${renderCampoEditavelExpansao('projeto', projeto.id, 'responsavel', projeto.responsavel)}</td>`;
                case 'kmz': return `<td>${renderCampoEditavelExpansao('projeto', projeto.id, 'kmz', projeto.kmz)}</td>`;
                case 'data': return `<td>${renderControleDuracaoCompletaExpansao(projeto.duracao_completa || montarValorDuracaoCompletaExpansao(projeto.data_inicio, projeto.data_previsao_final), `data-exp-id="${escaparHtml(projeto.id)}" data-exp-tipo="projeto" data-exp-campo="duracao_completa" data-exp-tabela="atlas_expansoes"`, { placeholder: 'Selecionar período' })}</td>`;
                case 'validacao': return `<td>${renderCampoEditavelExpansao('projeto', projeto.id, 'validacao', projeto.validacao)}</td>`;
                case 'slot': return `<td>${renderCampoEditavelExpansao('projeto', projeto.id, 'slot', projeto.slot, { type: 'number' })}</td>`;
                case 'portas': return `<td>${renderCampoEditavelExpansao('projeto', projeto.id, 'portas', projeto.portas, { type: 'number' })}</td>`;
                case 'fotos_olt': return `<td>${renderCampoImagemExpansao('projeto', projeto.id, 'fotos_olt', projeto.fotos_olt || projeto.imagens)}</td>`;
                case 'acoes': return `<td class="atlas-exp-row-remove"><button type="button" title="Remover elemento" onclick="excluirExpansao('${projeto.id}')">🗑</button></td>`;
                default: return '<td></td>';
            }
        }

        function renderLinhaObraExpansao(projeto) {
            const aberto = !!state.expansoesProjetosAbertos[projeto.id];
            const colunas = obterColunasElementoObraExpansao(projeto.fase);
            const subitemsHtml = aberto ? renderSubitemsObraExpansao(projeto) : '';
            return `<tr class="atlas-exp-row atlas-exp-obra-row ${elementoObraExpansaoSelecionado(projeto.id) ? 'is-selected' : ''}">${colunas.map(col => renderCelulaElementoObraExpansao(projeto, col, aberto)).join('')}</tr>${subitemsHtml}`;
        }

        function chaveFaseObraExpansao(nomeObra, faseId) {
            return `${nomeObra || ''}::${faseId || ''}`;
        }

        function faseObraExpansaoAberta(nomeObra, faseId) {
            state.expansoesObrasFasesAbertas = state.expansoesObrasFasesAbertas || {};
            return state.expansoesObrasFasesAbertas[chaveFaseObraExpansao(nomeObra, faseId)] !== false;
        }

        function alternarFaseObraExpansao(nomeObra, faseId) {
            const chave = chaveFaseObraExpansao(nomeObra, faseId);
            state.expansoesObrasFasesAbertas = state.expansoesObrasFasesAbertas || {};
            state.expansoesObrasFasesAbertas[chave] = !faseObraExpansaoAberta(nomeObra, faseId);
            renderExpansoes();
        }

        function renderGrupoFaseObraExpansao(nomeObra, fase, projetos) {
            const filtrados = projetos.filter(p => normalizarFaseObraExpansao(p.fase, p.nome) === fase.id);
            const totalSub = filtrados.reduce((acc, p) => acc + obterSubitemsDaExpansao(p.id).length, 0);
            const linhas = filtrados.map(renderLinhaObraExpansao).join('');
            const colunas = obterColunasElementoObraExpansao(fase.id);
            const nomeJs = escaparAtributoJs(nomeObra);
            const faseJs = escaparAtributoJs(fase.id);
            const aberto = faseObraExpansaoAberta(nomeObra, fase.id);
            const resumoSelecao = obterResumoSelecaoGrupoFaseObraExpansao(nomeObra, fase.id, filtrados);
            const textoSelecaoGrupo = textoResumoSelecaoGrupoFaseObraExpansao(resumoSelecao);
            return `<section class="atlas-exp-obra-fase ${aberto ? '' : 'is-collapsed'}" style="--atlas-exp-color:${fase.cor}">
                <div class="atlas-exp-obra-fase-head">
                    <button class="atlas-exp-obra-fase-toggle" type="button" aria-expanded="${aberto ? 'true' : 'false'}" onclick="alternarFaseObraExpansao('${nomeJs}','${faseJs}')"><span class="atlas-exp-fase-caret">⌄</span><strong>${escaparHtml(fase.titulo)}</strong></button>
                    <small>${filtrados.length} Elementos / ${totalSub} subelementos</small>
                    <label class="atlas-exp-obras-select-group" onclick="event.stopPropagation()" title="Selecionar todos os itens deste grupo">
                        <input type="checkbox" data-exp-select-grupo data-obra="${escaparHtml(nomeObra)}" data-fase="${escaparHtml(fase.id)}" ${resumoSelecao.checked ? 'checked' : ''} ${resumoSelecao.total ? '' : 'disabled'} onchange="event.stopPropagation();toggleSelecaoGrupoFaseObraExpansao('${nomeJs}','${faseJs}',this.checked)">
                        <span data-exp-select-grupo-text>${escaparHtml(textoSelecaoGrupo)}</span>
                    </label>
                </div>
                <div class="atlas-exp-table-wrap atlas-exp-obra-table-wrap"><table class="atlas-exp-table atlas-exp-obra-table"><thead><tr>${renderCabecalhoColunasObraExpansao(colunas)}</tr></thead><tbody>${linhas}<tr class="atlas-exp-add-row" onclick="adicionarElementoObraExpansao('${nomeJs}','${faseJs}')"><td class="atlas-exp-check"><input type="checkbox" disabled /></td><td colspan="${Math.max(1, colunas.length - 1)}">+ Adicionar elemento</td></tr></tbody></table></div>
            </section>`;
        }

        function renderObraExpansao(nomeObra, projetos) {
            const totalSub = projetos.reduce((acc, p) => acc + obterSubitemsDaExpansao(p.id).length, 0);
            return `<section class="atlas-exp-obra-card">
                <div class="atlas-exp-obra-head"><div><div class="atlas-exp-kicker">Obra de expansão</div><h3>${escaparHtml(nomeObra)}</h3><p>${projetos.length} elemento(s) · ${totalSub} subelemento(s)</p></div><button type="button" onclick="renomearObraExpansoes('${escaparHtml(nomeObra)}')">Renomear obra</button></div>
                ${ATLAS_EXP_OBRA_FASES.map(fase => renderGrupoFaseObraExpansao(nomeObra, fase, projetos)).join('')}
            </section>`;
        }

        function renderExpansoesObras(projetos, termo) {
            const filtro = String(termo || '').trim().toLowerCase();
            const base = (projetos || []).filter(ehElementoObraExpansao);
            limparSelecoesInvalidasObrasExpansoes(base);
            renderSidebarObrasExpansoes(base);
            const filtrados = obterElementosObrasExpansoesVisiveis(base, filtro);
            const grupos = obterProjetosPorObraExpansao(filtrados);
            const obraSelecionada = state.expansoesObraAtiva || (grupos[0] ? grupos[0][0] : '');
            const grupoSelecionado = grupos.find(([nome]) => nome === obraSelecionada) || grupos[0];
            const conteudo = grupoSelecionado
                ? renderObraExpansao(grupoSelecionado[0], grupoSelecionado[1])
                : `<div class="atlas-v13-card atlas-v13-empty">Nenhuma obra de Expansões cadastrada. Clique em “Criar obra” para começar.</div>`;
            return `<div class="atlas-exp-obras-shell">${renderBarraMoverObrasExpansoes()}${conteudo}</div>`;
        }

        async function criarObraExpansoes() {
            const nome = await solicitarTextoAtnx({ titulo: 'Criar obra de Expansões', label: 'Nome da obra', placeholder: 'Ex: FTTH - Senador Georgino Avelino - RN', obrigatorio: true, textoConfirmar: 'Criar obra' });
            if (!nome) return;
            const id = `exp-${Date.now()}`;
            const payload = { id, obra_nome: nome, fase: 'kmz', grupo: 'em_progresso', nome: 'KMZ DO PROJETO', status: null, updated_at: new Date().toISOString() };
            try {
                const { error } = await supabaseClient.from('atlas_expansoes').insert([payload]);
                if (error) throw error;
                await registrarAuditoria('criação', 'expansao_obra', id, nome, 'obra', '', nome, 'Obra de Expansões criada no layout de obra');
                state.expansoesVisualizacao = 'obras';
                state.expansoesObraAtiva = nome;
                exibirStatusTemporario('✅ Obra de Expansões criada.', 'bg-emerald-600');
                await carregarExpansoes();
            } catch (err) {
                await alertaVisualAtnx('Erro ao criar obra de Expansões', `${err.message || String(err)}\n\nSe a coluna obra_nome/fase não existir, rode o SQL da V1.3.2 no Supabase.`);
            }
        }

        async function adicionarElementoObraExpansao(nomeObra, faseId) {
            const fase = normalizarFaseObraExpansao(faseId);
            const nome = await solicitarTextoAtnx({ titulo: `Adicionar elemento em ${obterTituloFaseObraExpansao(fase)}`, label: 'Nome do elemento', placeholder: fase === 'kmz' ? 'KMZ DO PROJETO' : 'Ex: NSF - ROTA 49', obrigatorio: true, textoConfirmar: 'Adicionar' });
            if (!nome) return;
            const id = `exp-${Date.now()}`;
            const payload = { id, obra_nome: nomeObra, fase, grupo: obterGrupoPadraoPorFaseExpansao(fase), nome, status: fase === 'homologacao_final' ? null : 'Em Progresso', updated_at: new Date().toISOString() };
            try {
                const { error } = await supabaseClient.from('atlas_expansoes').insert([payload]);
                if (error) throw error;
                await registrarAuditoria('criação', 'expansao', id, nome, 'elemento', '', nome, `Elemento criado na obra ${nomeObra}`);
                exibirStatusTemporario('✅ Elemento cadastrado.', 'bg-emerald-600');
                await carregarExpansoes();
            } catch (err) {
                await alertaVisualAtnx('Erro ao adicionar elemento', err.message || String(err));
            }
        }

        async function renomearObraExpansoes(nomeAtual) {
            const novo = await solicitarTextoAtnx({ titulo: 'Renomear obra de Expansões', label: 'Novo nome', valor: nomeAtual, obrigatorio: true, textoConfirmar: 'Renomear' });
            if (!novo || novo === nomeAtual) return;
            const ids = (state.expansoes || []).filter(p => obterObraNomeExpansao(p) === nomeAtual).map(p => p.id);
            if (!ids.length) return;
            try {
                const { error } = await supabaseClient.from('atlas_expansoes').update({ obra_nome: novo, updated_at: new Date().toISOString() }).in('id', ids);
                if (error) throw error;
                await registrarAuditoria('edição', 'expansao_obra', ids.join(','), novo, 'obra_nome', nomeAtual, novo, 'Obra de Expansões renomeada');
                if (state.expansoesObraAtiva === nomeAtual) state.expansoesObraAtiva = novo;
                exibirStatusTemporario('✅ Obra renomeada.', 'bg-emerald-600');
                await carregarExpansoes();
            } catch (err) {
                await alertaVisualAtnx('Erro ao renomear obra', err.message || String(err));
            }
        }

        function renderExpansoesViewTabs() {
            return '';
        }

        function renderGanttExpansoes(projetos, termo) {
            const termoGantt = String(state.expansoesGanttFiltro || termo || '').trim().toLowerCase();
            const linhas = montarLinhasGanttExpansoes(projetos, termoGantt);
            const zoom = Number(state.expansoesGanttZoom || 1);
            const escala = state.expansoesGanttEscala || 'meses';
            const fullscreen = !!state.expansoesGanttFullscreen;
            document.body.classList.toggle('atlas-exp-gantt-is-fullscreen', fullscreen);
            const pxPorDia = obterPxPorDiaGantt(escala, zoom);
            const percentualZoom = Math.round(zoom * 100);
            const classeZoom = obterClasseZoomGantt(zoom);
            const agora = new Date();
            const semanaAtual = obterSemanaAtual();
            const semanaTexto = `${formatarDataCurtaBr(semanaAtual.inicio)} → ${formatarDataCurtaBr(semanaAtual.fim)}`;
            const filtrosStatusAtuais = obterFiltrosStatusGanttExpansoes();
            const filtrosGrupoAtuais = obterFiltrosGrupoGanttExpansoes();
            const filtrosAtivos = !!(termoGantt || filtrosStatusAtuais.length || filtrosGrupoAtuais.length);
            const agoraTexto = agora.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            const legenda = [
                { id: 'concluido', titulo: 'Concluído' },
                { id: 'em_progresso', titulo: 'Em Progresso' },
                { id: 'parado', titulo: 'Parado' },
                { id: 'inviavel', titulo: 'Inviável' }
            ].map(st => `<span><i class="atlas-exp-gantt-dot atlas-exp-gantt-${st.id}"></i>${escaparHtml(st.titulo)}</span>`).join('');

            const statusFiltros = [
                { valor: 'Em Progresso', id: 'em_progresso', titulo: 'Em Progresso' },
                { valor: 'Parado', id: 'parado', titulo: 'Parado' },
                { valor: 'Concluído', id: 'concluido', titulo: 'Concluído na semana' },
                { valor: 'Inviável', id: 'inviavel', titulo: 'Inviável' }
            ].map(st => `<button type="button" class="atlas-exp-gantt-filter-chip atlas-exp-gantt-filter-status ${filtrosStatusAtuais.includes(st.id) ? 'active' : ''}" onclick="alternarFiltroStatusGanttExpansoes('${st.valor}')" title="${st.id === 'concluido' ? 'Mostra somente concluídos na semana atual' : `Filtrar ${st.titulo}`}"><i class="atlas-exp-gantt-dot atlas-exp-gantt-${st.id}"></i>${escaparHtml(st.titulo)}</button>`).join('');
            const grupoFiltros = ATLAS_EXP_GRUPOS.map(g => `<button type="button" class="atlas-exp-gantt-filter-chip ${filtrosGrupoAtuais.includes(g.id) ? 'active' : ''}" onclick="alternarFiltroGrupoGanttExpansoes('${escaparHtml(g.id)}')">${escaparHtml(g.titulo)}</button>`).join('');

            const ferramentas = `<div class="atlas-exp-gantt-tools">
                <div class="atlas-exp-gantt-tools-main">
                    <div class="atlas-exp-gantt-filter-box ${termoGantt ? 'is-active' : ''}">
                        <span>⌕</span>
                        <input id="atlas-exp-gantt-filter-input" type="search" value="${escaparHtml(state.expansoesGanttFiltro || '')}" placeholder="Filtrar projeto, subelemento ou status" oninput="alterarFiltroGanttExpansoes(this.value, true)" />
                    </div>
                    ${filtrosAtivos ? `<button type="button" class="atlas-exp-gantt-tool-action" onclick="limparFiltrosGanttExpansoes()" title="Limpar filtros do Gantt">Limpar filtros</button>` : ''}
                    <button type="button" class="atlas-exp-gantt-tool-action" onclick="ajustarAutomaticoGanttExpansoes()">Ajuste automático</button>
                    <select class="atlas-exp-gantt-scale-select" onchange="definirEscalaGanttExpansoes(this.value)" title="Escala do Gantt">
                        <option value="meses" ${escala === 'meses' ? 'selected' : ''}>Meses</option>
                        <option value="semanas" ${escala === 'semanas' ? 'selected' : ''}>Semanas</option>
                        <option value="dias" ${escala === 'dias' ? 'selected' : ''}>Dias</option>
                    </select>
                    <div class="atlas-exp-gantt-zoom"><button type="button" onclick="ajustarZoomGanttExpansoes(-0.15)">−</button><span>${percentualZoom}%</span><button type="button" onclick="ajustarZoomGanttExpansoes(0.15)">+</button></div>
                    <button type="button" class="atlas-exp-gantt-tool-action" onclick="alternarTelaCheiaGanttExpansoes()" title="Tela cheia / sair">${fullscreen ? 'Sair' : 'Tela cheia'}</button>
                </div>
                <div class="atlas-exp-gantt-filter-fixed" aria-label="Filtros do Gantt de Expansões">
                    <div class="atlas-exp-gantt-filter-group"><span>Abas</span><button type="button" class="atlas-exp-gantt-filter-chip ${!filtrosGrupoAtuais.length ? 'active' : ''}" onclick="alternarFiltroGrupoGanttExpansoes('')">Todas</button>${grupoFiltros}</div>
                    <div class="atlas-exp-gantt-filter-group"><span>Status</span><button type="button" class="atlas-exp-gantt-filter-chip ${!filtrosStatusAtuais.length ? 'active' : ''}" onclick="alternarFiltroStatusGanttExpansoes('')">Todos</button>${statusFiltros}</div>
                </div>
            </div>`;

            if (!linhas.length) {
                return `<div class="atlas-exp-gantt-shell ${fullscreen ? 'atlas-exp-gantt-fullscreen' : ''}">
                    <div class="atlas-exp-gantt-titlebar atlas-exp-gantt-titlebar-minimal"><div class="atlas-exp-gantt-compact-title"><span>Gantt</span><small>Semana ${escaparHtml(semanaTexto)}</small></div>${ferramentas}</div>
                    <div class="atlas-v13-card atlas-v13-empty">Nenhum projeto de Expansões encontrado para os filtros aplicados ou com datas suficientes para montar o Gantt.</div>
                    <div class="atlas-exp-gantt-legend">${legenda}</div>
                </div>`;
            }

            const datasInicio = linhas.map(l => dataAdminParaDate(l.inicio)).filter(Boolean);
            const datasFim = linhas.map(l => dataAdminParaDate(l.fim)).filter(Boolean);
            const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            const minTime = Math.min(hoje.getTime(), ...datasInicio.map(d => d.getTime()));
            const maxTime = Math.max(hoje.getTime(), ...datasFim.map(d => d.getTime()));
            const periodoInicio = adicionarMeses(inicioDoMes(new Date(minTime)), -1);
            const periodoFim = fimDoMes(adicionarMeses(new Date(maxTime), 1));
            const totalDias = Math.max(1, diferencaDias(periodoInicio, periodoFim) + 1);
            const timelineWidth = totalDias * pxPorDia;
            const leftWidth = Math.max(300, Math.round(380 * zoom));
            const rowHeight = Math.max(34, Math.round(42 * zoom));
            const childRowHeight = Math.max(30, Math.round(36 * zoom));
            const barHeight = Math.max(14, Math.round(19 * zoom));
            const fontSize = Math.max(10, Math.round(12 * zoom));
            const styleVars = `--exp-gantt-left-width:${leftWidth}px;--exp-gantt-row-height:${rowHeight}px;--exp-gantt-child-row-height:${childRowHeight}px;--exp-gantt-bar-height:${barHeight}px;--exp-gantt-font-size:${fontSize}px;`;

            function montarBandasTrimestre() {
                const bandas = [];
                let cursor = new Date(periodoInicio.getFullYear(), periodoInicio.getMonth(), 1);
                while (cursor <= periodoFim) {
                    const trimestre = Math.floor(cursor.getMonth() / 3);
                    const iniTri = new Date(cursor.getFullYear(), trimestre * 3, 1);
                    const fimTri = new Date(cursor.getFullYear(), trimestre * 3 + 3, 0);
                    const iniVis = iniTri < periodoInicio ? periodoInicio : iniTri;
                    const fimVis = fimTri > periodoFim ? periodoFim : fimTri;
                    const dias = Math.max(1, diferencaDias(iniVis, fimVis) + 1);
                    bandas.push(`<div class="atlas-exp-gantt-quarter" style="width:${dias * pxPorDia}px">Q${trimestre + 1} ${cursor.getFullYear()}</div>`);
                    cursor = new Date(cursor.getFullYear(), trimestre * 3 + 3, 1);
                }
                return bandas.join('');
            }

            function montarMarcadoresTempo() {
                const marcadores = [];
                if (escala === 'dias') {
                    let cursor = new Date(periodoInicio);
                    while (cursor <= periodoFim) {
                        const fimDeSemana = cursor.getDay() === 0 || cursor.getDay() === 6;
                        marcadores.push(`<div class="atlas-exp-gantt-time-cell atlas-exp-gantt-day ${fimDeSemana ? 'is-weekend' : ''}" style="width:${pxPorDia}px" title="${escaparHtml(formatarDataGanttCurta(cursor))}">${cursor.getDate()}</div>`);
                        cursor.setDate(cursor.getDate() + 1);
                    }
                    return { html: marcadores.join(''), classe: 'dias', grid: pxPorDia };
                }
                if (escala === 'semanas') {
                    let cursor = inicioSemanaAdmin(periodoInicio);
                    while (cursor <= periodoFim) {
                        const fimSemana = fimSemanaAdmin(cursor);
                        const iniVis = cursor < periodoInicio ? periodoInicio : cursor;
                        const fimVis = fimSemana > periodoFim ? periodoFim : fimSemana;
                        const dias = Math.max(1, diferencaDias(iniVis, fimVis) + 1);
                        marcadores.push(`<div class="atlas-exp-gantt-time-cell atlas-exp-gantt-week" style="width:${dias * pxPorDia}px">${formatarDataGanttCurta(iniVis)}</div>`);
                        cursor.setDate(cursor.getDate() + 7);
                    }
                    return { html: marcadores.join(''), classe: 'semanas', grid: pxPorDia * 7 };
                }
                let cursor = new Date(periodoInicio.getFullYear(), periodoInicio.getMonth(), 1);
                while (cursor <= periodoFim) {
                    const iniMes = cursor < periodoInicio ? periodoInicio : cursor;
                    const fimMes = fimDoMes(cursor) > periodoFim ? periodoFim : fimDoMes(cursor);
                    const dias = Math.max(1, diferencaDias(iniMes, fimMes) + 1);
                    marcadores.push(`<div class="atlas-exp-gantt-time-cell atlas-exp-gantt-month" style="width:${dias * pxPorDia}px">${nomeMesCurto(cursor)}</div>`);
                    cursor = adicionarMeses(cursor, 1);
                }
                return { html: marcadores.join(''), classe: 'meses', grid: pxPorDia * 30 };
            }

            function calcularPosicao(inicioIso, fimIso) {
                const inicio = dataAdminParaDate(inicioIso);
                const fim = dataAdminParaDate(fimIso);
                if (!inicio || !fim) return { left: 0, width: 0 };
                const inicioVis = inicio < periodoInicio ? periodoInicio : inicio;
                const fimVis = fim > periodoFim ? periodoFim : fim;
                const left = Math.max(0, diferencaDias(periodoInicio, inicioVis) * pxPorDia);
                const width = Math.max(12, (diferencaDias(inicioVis, fimVis) + 1) * pxPorDia);
                return { left, width };
            }

            function renderBarra(linha) {
                const pos = calcularPosicao(linha.inicio, linha.fim);
                const status = normalizarStatusExpansao(linha.status);
                const label = linha.tipo === 'subitem' ? `${linha.nome} | ${linha.projetoNome || linha.meta}` : linha.nome;
                const titulo = `${linha.nome} · ${formatarPeriodoGantt(dataAdminParaDate(linha.inicio), dataAdminParaDate(linha.fim))} · ${tituloStatusExpansao(linha.status)}`;
                return `<div class="atlas-exp-gantt-bar atlas-exp-gantt-bar-${status}" style="left:${pos.left}px;width:${pos.width}px" aria-label="${escaparHtml(titulo)}"></div>
                    <div class="atlas-exp-gantt-bar-label ${linha.tipo === 'subitem' ? 'is-child' : ''}" style="left:${pos.left + pos.width + 8}px" aria-label="${escaparHtml(label)}">${escaparHtml(label)}</div>`;
            }

            const marcadores = montarMarcadoresTempo();
            const hojeDentro = hoje >= periodoInicio && hoje <= periodoFim;
            const hojeLeft = hojeDentro ? Math.max(0, diferencaDias(periodoInicio, hoje) * pxPorDia) : 0;
            const todayLine = hojeDentro ? `<div class="atlas-exp-gantt-today" style="left:${leftWidth + hojeLeft}px"><span>hoje</span></div>` : '';
            const linhasHtml = linhas.map(linha => {
                const periodo = formatarPeriodoGantt(dataAdminParaDate(linha.inicio), dataAdminParaDate(linha.fim));
                return `<div class="atlas-exp-gantt-row ${linha.tipo === 'subitem' ? 'is-child' : 'is-project'}">
                    <div class="atlas-exp-gantt-left">
                        <div><strong>${linha.tipo === 'subitem' ? '↳ ' : ''}${escaparHtml(linha.nome)}</strong><span>${escaparHtml(linha.meta || '')}</span></div>
                        <em>${escaparHtml(periodo)}</em>
                    </div>
                    <div class="atlas-exp-gantt-timeline" style="width:${timelineWidth}px;background-size:${marcadores.grid}px 100%">${renderBarra(linha)}</div>
                </div>`;
            }).join('');

            const concluidos = linhas.filter(l => normalizarStatusExpansao(l.status) === 'concluido').length;
            const emProgresso = linhas.filter(l => normalizarStatusExpansao(l.status) === 'em_progresso').length;
            const parados = linhas.filter(l => normalizarStatusExpansao(l.status) === 'parado').length;

            return `<div class="atlas-exp-gantt-shell ${fullscreen ? 'atlas-exp-gantt-fullscreen' : ''} ${classeZoom}" style="${styleVars}">
                <div class="atlas-exp-gantt-titlebar atlas-exp-gantt-titlebar-minimal">
                    <div class="atlas-exp-gantt-compact-title"><span>Gantt</span><small>Semana ${escaparHtml(semanaTexto)} · ${linhas.length} linha(s)</small></div>
                    ${ferramentas}
                </div>
                <div class="atlas-exp-gantt-scroll">
                    <div class="atlas-exp-gantt-grid" data-left-width="${leftWidth}" data-today-left="${hojeLeft}" style="width:${leftWidth + timelineWidth}px">
                        ${todayLine}
                        <div class="atlas-exp-gantt-head-row">
                            <div class="atlas-exp-gantt-left-head"><span>Projeto / subelemento</span><span>Período</span></div>
                            <div class="atlas-exp-gantt-head-timeline" style="width:${timelineWidth}px">
                                <div class="atlas-exp-gantt-quarters" style="width:${timelineWidth}px">${montarBandasTrimestre()}</div>
                                <div class="atlas-exp-gantt-months is-${marcadores.classe}" style="width:${timelineWidth}px">${marcadores.html}</div>
                            </div>
                        </div>
                        ${linhasHtml}
                    </div>
                </div>
                <div class="atlas-exp-gantt-legend">${legenda}</div>
            </div>`;
        }


        const ATLAS_PMO_STORAGE_KEY = 'atlas-pmo-v135-local';
        const ATLAS_PMO_TABELA_PROJETOS = 'atlas_pmo_projetos';
        const ATLAS_PMO_TABELA_SUBELEMENTOS = 'atlas_pmo_subelementos';
        const ATLAS_PMO_TABELA_UPDATES = 'atlas_pmo_updates';

        const ATLAS_PMO_STATUS_REFERENCIA = [
            'PARADO',
            'AVALIAÇÃO INICIAL',
            'LEVANTAMENTO EM CAMPO',
            'PROJETO EM DESENHO',
            'PROJETO CONCLUÍDO',
            'AVALIAÇÃO DO SUPERVISOR',
            'AVALIAÇÃO DA GERÊNCIA',
            'AVALIAÇÃO DA DIRETORIA',
            'AVALIAÇÃO DE VALORES',
            'AGUARDANDO INFORMAÇÃO',
            'AGUARDANDO MATERIAL',
            'AGUARDANDO CARTA',
            'AGUARDANDO CARTAS',
            'AGUARDANDO EXPANSÃO',
            'AGUARDANDO CONSTRUÇÃO',
            'AGUARDANDO CAPEX',
            'AGUARDANDO DEFINIÇÃO',
            'AGUARDANDO POP',
            'POP DEFINIDO',
            'PRONTO PARA EXECUTAR',
            'EXECUTANDO',
            'FAZER PROJETO',
            'CONCLUÍDO',
            'CANCELADO',
            'REPROVADO'
        ];
        const ATLAS_PMO_ORIGEM_OPCOES = [
            'DIRETORIA',
            'CONSULTOR CORPORATIVO',
            'SOLICITAÇÕES VOALLE',
            'PREDIAL',
            'SOLICITAÇÕES / TERCEIROS',
            'SUBGERENTE REGIONAL',
            'TORRES',
            'GERENTE REGIONAL'
        ];
        const ATLAS_PMO_LABEL_CORES = {
            'PARADO': '#e2445c',
            'AVALIAÇÃO INICIAL': '#66ccff',
            'LEVANTAMENTO EM CAMPO': '#ff5ac4',
            'PROJETO EM DESENHO': '#00854d',
            'PROJETO CONCLUÍDO': '#007eb5',
            'AVALIAÇÃO DO SUPERVISOR': '#106b72',
            'AVALIAÇÃO DA GERÊNCIA': '#579bfc',
            'AVALIAÇÃO DA DIRETORIA': '#a25ddc',
            'AVALIAÇÃO DE VALORES': '#bb3354',
            'AGUARDANDO INFORMAÇÃO': '#cab641',
            'AGUARDANDO MATERIAL': '#fdab3d',
            'AGUARDANDO CARTA': '#ff9da1',
            'AGUARDANDO CARTAS': '#ff9da1',
            'AGUARDANDO EXPANSÃO': '#7f5347',
            'AGUARDANDO CONSTRUÇÃO': '#ff158a',
            'AGUARDANDO CAPEX': '#ff6d75',
            'AGUARDANDO DEFINIÇÃO': '#784bd1',
            'AGUARDANDO POP': '#1f78dc',
            'POP DEFINIDO': '#e573bd',
            'PRONTO PARA EXECUTAR': '#9cd326',
            'EXECUTANDO': '#ffcb00',
            'FAZER PROJETO': '#ff8bd1',
            'CONCLUÍDO': '#00c875',
            'CANCELADO': '#c4ae90',
            'REPROVADO': '#333333',
            'DIRETORIA': '#cab641',
            'CONSULTOR CORPORATIVO': '#635bff',
            'SOLICITAÇÕES VOALLE': '#007eb5',
            'PREDIAL': '#00854d',
            'SOLICITAÇÕES / TERCEIROS': '#e2445c',
            'SUBGERENTE REGIONAL': '#bdbdbd',
            'TORRES': '#a25ddc',
            'GERENTE REGIONAL': '#ff5ac4'
        };

        const ATLAS_PMO_PROJETO_DEFS = [
            { key: 'nome', label: 'Elemento', type: 'text', required: true, width: 280 },
            { key: 'status', label: 'Status', type: 'label', options: ATLAS_PMO_STATUS_REFERENCIA, width: 190 },
            { key: 'cabos_projetados', label: 'Cabos Projetados', type: 'number', width: 130 },
            { key: 'ceos_projetadas', label: "CEO's Projetadas", type: 'number', width: 130 },
            { key: 'cto_1x8', label: "CTO'S de 1x8", type: 'number', width: 120 },
            { key: 'cto_1x16', label: "CTO'S de 1x16", type: 'number', width: 120 },
            { key: 'total_ctos_projetadas', label: "Total de CTO's Projetadas", type: 'number', width: 150 },
            { key: 'portas_ftth', label: 'Portas FTTH', type: 'number', width: 120 },
            { key: 'valor_projeto', label: 'Valor do Projeto', type: 'money', width: 140 },
            { key: 'valor_por_porta', label: 'Valor por Porta', type: 'money', width: 130 },
            { key: 'valor_metro_cabo', label: 'Valor metro de Cabo', type: 'money', width: 145 },
            { key: 'timeline_inicio', label: 'Timeline início', type: 'date', width: 130 },
            { key: 'timeline_fim', label: 'Timeline fim', type: 'date', width: 130 },
            { key: 'origem', label: 'Origem', type: 'label', options: ATLAS_PMO_ORIGEM_OPCOES, width: 190 },
            { key: 'projetista', label: 'Projetista', type: 'text', width: 160 },
            { key: 'lista_materiais', label: 'Lista de Materiais', type: 'material', width: 160 },
            { key: 'projeto_link', label: 'Projeto / KMZ', type: 'kmz', width: 150 },
            { key: 'link', label: 'Link', type: 'url', width: 150 },
            { key: 'solicitante', label: 'Solicitante', type: 'text', width: 160 },
            { key: 'regional', label: 'Regional', type: 'text', width: 150 },
            { key: 'justificativa', label: 'Justificativa', type: 'textarea', width: 260 },
            { key: 'print_area', label: 'Print da área', type: 'image', width: 170 },
            { key: 'data_solicitacao', label: 'Data da solicitação', type: 'date', width: 145 },
            { key: 'log_criacao', label: 'Log de criação', type: 'text', width: 170 },
            { key: 'email', label: 'E-mail', type: 'email', width: 180 },
            { key: 'data_conclusao', label: 'Data da Conclusão', type: 'date', width: 145 }
        ];
        const ATLAS_PMO_SUBELEMENTO_DEFS = [
            { key: 'nome', label: 'Nome da etapa/subelemento', type: 'text', required: true },
            { key: 'responsavel', label: 'Responsável', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ATLAS_PMO_STATUS_REFERENCIA },
            { key: 'cabos_projetados', label: 'Cabos Projetados', type: 'number' },
            { key: 'ceos_projetadas', label: "CEO's Projetadas", type: 'number' },
            { key: 'ctos_projetadas', label: "CTO's Projetadas", type: 'number' },
            { key: 'portas_ftth', label: 'Portas FTTH', type: 'number' },
            { key: 'valor_projeto', label: 'Valor do Projeto', type: 'money' },
            { key: 'valor_por_porta', label: 'Valor por Porta', type: 'money' },
            { key: 'valor_metro_cabo', label: 'Valor metro de Cabo', type: 'money' },
            { key: 'estimativa_postes', label: 'Estimativa de postes', type: 'number' },
            { key: 'pon_livre', label: 'PON livre', type: 'text' },
            { key: 'lista_materiais', label: 'Lista de Materiais', type: 'url' },
            { key: 'projeto_link', label: 'Projeto', type: 'url' },
            { key: 'link', label: 'Link', type: 'url' },
            { key: 'kmz', label: 'KMZ', type: 'url' },
            { key: 'item_id', label: 'Item ID', type: 'text' }
        ];
        const ATLAS_PMO_UPDATE_DEFS = [
            { key: 'item_id', label: 'Item ID', type: 'text' },
            { key: 'item_name', label: 'Item Name', type: 'text' },
            { key: 'tipo_conteudo', label: 'Tipo de conteúdo', type: 'select', options: ['Update', 'Reply'] },
            { key: 'usuario', label: 'Usuário', type: 'text' },
            { key: 'data_criacao', label: 'Data de criação', type: 'date' },
            { key: 'conteudo', label: 'Conteúdo da atualização', type: 'textarea' },
            { key: 'likes_count', label: 'Likes Count', type: 'number' },
            { key: 'asset_ids', label: 'Asset IDs', type: 'text' },
            { key: 'post_id', label: 'Post ID', type: 'text' },
            { key: 'parent_post_id', label: 'Parent Post ID', type: 'text' }
        ];
        const ATLAS_PMO_PROJETO_CAMPOS = ATLAS_PMO_PROJETO_DEFS.map(c => c.label);
        const ATLAS_PMO_SUBELEMENTO_CAMPOS = ATLAS_PMO_SUBELEMENTO_DEFS.map(c => c.label);
        const ATLAS_PMO_UPDATE_CAMPOS = ATLAS_PMO_UPDATE_DEFS.map(c => c.label);
        const ATLAS_PMO_NUMERICOS = new Set(['cabos_projetados', 'ceos_projetadas', 'cto_1x8', 'cto_1x16', 'total_ctos_projetadas', 'portas_ftth', 'valor_projeto', 'valor_por_porta', 'valor_metro_cabo', 'ctos_projetadas', 'estimativa_postes', 'likes_count']);
        const ATLAS_PMO_MOEDA = new Set(['valor_projeto', 'valor_por_porta', 'valor_metro_cabo']);

        function pmoGerarId(prefixo = 'pmo') {
            if (window.crypto?.randomUUID) return `${prefixo}_${window.crypto.randomUUID()}`;
            return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        }

        function pmoLerLocal() {
            try {
                const dados = JSON.parse(localStorage.getItem(ATLAS_PMO_STORAGE_KEY) || '{}');
                return {
                    projetos: Array.isArray(dados.projetos) ? dados.projetos : [],
                    subelementos: Array.isArray(dados.subelementos) ? dados.subelementos : [],
                    updates: Array.isArray(dados.updates) ? dados.updates : []
                };
            } catch (err) {
                return { projetos: [], subelementos: [], updates: [] };
            }
        }

        function pmoSalvarLocal() {
            try {
                localStorage.setItem(ATLAS_PMO_STORAGE_KEY, JSON.stringify({
                    projetos: state.pmoProjetos || [],
                    subelementos: state.pmoSubelementos || [],
                    updates: state.pmoUpdates || []
                }));
            } catch (err) {
                console.warn('Não foi possível salvar PMO localmente:', err);
            }
        }

        function pmoMarcarEdicaoLocal() {
            state.pmoUltimaEdicaoLocal = Date.now();
        }

        function pmoEdicaoLocalRecente(janelaMs = 8000) {
            return Boolean(state.pmoUltimaEdicaoLocal && (Date.now() - state.pmoUltimaEdicaoLocal) < janelaMs);
        }

        function pmoNormalizarNumero(valor) {
            const texto = String(valor ?? '').trim().replace(/\./g, '').replace(',', '.');
            if (!texto) return 0;
            const n = Number(texto);
            return Number.isFinite(n) ? n : 0;
        }

        function pmoNormalizarLabel(valor) {
            return String(valor || '').trim().toUpperCase();
        }

        function pmoDefCampo(campo, lista = ATLAS_PMO_PROJETO_DEFS) {
            return lista.find(def => def.key === campo) || { key: campo, label: campo, type: 'text' };
        }

        function pmoNormalizarValorCampo(campo, valor, lista = ATLAS_PMO_PROJETO_DEFS) {
            const def = pmoDefCampo(campo, lista);
            if (ATLAS_PMO_NUMERICOS.has(campo)) return pmoNormalizarNumero(valor);
            if (def.type === 'date') {
                const texto = String(valor || '').trim();
                return texto || null;
            }
            if (def.type === 'label' || def.type === 'select') return pmoNormalizarLabel(valor);
            return String(valor ?? '').trim();
        }

        function pmoValorFormulario(form, def) {
            const el = form?.elements?.[def.key];
            if (!el) return def.type === 'select' ? (def.options?.[0] || '') : (def.type === 'date' ? null : '');
            return pmoNormalizarValorCampo(def.key, el.value, ATLAS_PMO_SUBELEMENTO_DEFS.concat(ATLAS_PMO_UPDATE_DEFS));
        }

        function pmoPayloadFormulario(form, defs) {
            return defs.reduce((acc, def) => {
                acc[def.key] = pmoValorFormulario(form, def);
                return acc;
            }, {});
        }

        function pmoFormInput(def, valor = '') {
            const v = escaparHtml(valor ?? '');
            const obrigatorio = def.required ? 'required' : '';
            if (def.type === 'select') {
                const options = (def.options || []).map(op => `<option value="${escaparHtml(op)}" ${String(valor || '').toUpperCase() === String(op).toUpperCase() ? 'selected' : ''}>${escaparHtml(op)}</option>`).join('');
                return `<label><span>${escaparHtml(def.label)}</span><select name="${escaparHtml(def.key)}" ${obrigatorio}>${options}</select></label>`;
            }
            if (def.type === 'textarea') {
                return `<label class="atlas-pmo-field-wide"><span>${escaparHtml(def.label)}</span><textarea name="${escaparHtml(def.key)}" ${obrigatorio}>${v}</textarea></label>`;
            }
            const type = def.type === 'money' ? 'text' : def.type;
            const step = def.type === 'number' ? ' step="1"' : '';
            return `<label><span>${escaparHtml(def.label)}</span><input name="${escaparHtml(def.key)}" type="${escaparHtml(type)}" value="${v}" ${step} ${obrigatorio}></label>`;
        }

        function pmoFormatarMoeda(valor) {
            const numero = Number(valor || 0);
            return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        function pmoFormatarNumero(valor) {
            const numero = Number(valor || 0);
            return numero.toLocaleString('pt-BR');
        }

        function pmoInputDate(valor) {
            if (!valor) return '';
            return String(valor).slice(0, 10);
        }

        function pmoValorCelula(item, key) {
            const valor = item?.[key];
            if (ATLAS_PMO_MOEDA.has(key)) return pmoFormatarMoeda(valor);
            if (ATLAS_PMO_NUMERICOS.has(key)) return pmoFormatarNumero(valor);
            if (String(key).includes('data') || String(key).includes('timeline')) return valor ? formatarDataParaExibicao(valor) : '—';
            if (['link', 'projeto_link', 'lista_materiais', 'print_area', 'kmz'].includes(key) && valor) return `<button type="button" class="atlas-attachment-link" onclick="atlasAbrirVisualizadorAnexoUnico('${escaparAtributoJs(valor)}', '${escaparAtributoJs(key)}', event)">Abrir</button>`;
            return escaparHtml(valor || '—');
        }

        function pmoCorLabel(valor) {
            const texto = pmoNormalizarLabel(valor || 'AGUARDANDO DEFINIÇÃO');
            return ATLAS_PMO_LABEL_CORES[texto] || '#0073ea';
        }

        function pmoStatusPill(status) {
            const texto = pmoNormalizarLabel(status || 'AGUARDANDO DEFINIÇÃO');
            return `<span class="atlas-status-pill atlas-status-pill-pmo atlas-pmo-color-label" style="--pmo-label-color:${pmoCorLabel(texto)}">${escaparHtml(texto)}</span>`;
        }

        function pmoLabelBotao(projetoId, campo, valor, tipo) {
            const texto = pmoNormalizarLabel(valor || (campo === 'status' ? 'AGUARDANDO DEFINIÇÃO' : 'SELECIONAR'));
            return `<button type="button" class="atlas-pmo-label-btn atlas-pmo-color-label" style="--pmo-label-color:${pmoCorLabel(texto)}" onclick="abrirMenuCampoPMO(event, '${escaparAtributoJs(projetoId)}', '${escaparAtributoJs(campo)}', '${escaparAtributoJs(tipo)}')">${escaparHtml(texto)}</button>`;
        }

        function fecharMenuCampoPMO() {
            document.querySelectorAll('.atlas-pmo-label-popover').forEach(el => el.remove());
            document.removeEventListener('click', pmoFecharMenuClickFora, true);
        }

        function pmoFecharMenuClickFora(event) {
            if (event.target?.closest?.('.atlas-pmo-label-popover') || event.target?.closest?.('.atlas-pmo-label-btn')) return;
            fecharMenuCampoPMO();
        }

        function abrirMenuCampoPMO(event, projetoId, campo, tipo = 'status') {
            event?.stopPropagation?.();
            fecharMenuCampoPMO();
            const opcoes = tipo === 'origem' ? ATLAS_PMO_ORIGEM_OPCOES : ATLAS_PMO_STATUS_REFERENCIA;
            const popover = document.createElement('div');
            popover.className = 'atlas-pmo-label-popover';
            popover.innerHTML = `<div class="atlas-pmo-label-popover-grid">${opcoes.map(op => `<button type="button" class="atlas-pmo-label-option atlas-pmo-color-label" style="--pmo-label-color:${pmoCorLabel(op)}" onclick="selecionarOpcaoCampoPMO('${escaparAtributoJs(projetoId)}', '${escaparAtributoJs(campo)}', '${escaparAtributoJs(op)}')">${escaparHtml(op)}</button>`).join('')}</div><button type="button" class="atlas-pmo-label-edit" onclick="fecharMenuCampoPMO()">✎ Editar etiquetas</button>`;
            document.body.appendChild(popover);
            const alvo = event.currentTarget || event.target;
            const rect = alvo.getBoundingClientRect();
            const largura = Math.min(tipo === 'status' ? 860 : 360, window.innerWidth - 24);
            popover.style.width = largura + 'px';
            let left = rect.left + rect.width / 2 - largura / 2;
            left = Math.max(12, Math.min(left, window.innerWidth - largura - 12));
            const top = Math.min(rect.bottom + 8, window.innerHeight - popover.offsetHeight - 12);
            popover.style.left = left + 'px';
            popover.style.top = Math.max(12, top) + 'px';
            setTimeout(() => document.addEventListener('click', pmoFecharMenuClickFora, true), 0);
        }

        async function selecionarOpcaoCampoPMO(projetoId, campo, valor) {
            fecharMenuCampoPMO();
            await atualizarCampoProjetoPMO(projetoId, campo, valor);
        }

        function renderPMOListaCampos(titulo, descricao, campos) {
            return `<section class="atlas-module-card atlas-pmo-fields-card">
                <div class="atlas-pmo-section-head">
                    <div><h3>${escaparHtml(titulo)}</h3><p>${escaparHtml(descricao)}</p></div>
                    <span>${campos.length} campos</span>
                </div>
                <div class="atlas-pmo-field-grid">${campos.map(campo => `<span>${escaparHtml(campo)}</span>`).join('')}</div>
            </section>`;
        }

        function pmoProjetosFiltrados() {
            const termo = String(state.termoPesquisa || '').trim().toLowerCase();
            let lista = [...(state.pmoProjetos || [])];
            if (!termo) return lista;
            return lista.filter(projeto => {
                const subs = (state.pmoSubelementos || []).filter(s => s.projeto_id === projeto.id);
                const updates = (state.pmoUpdates || []).filter(u => u.projeto_id === projeto.id);
                const alvo = [projeto, ...subs, ...updates].map(obj => Object.values(obj || {}).join(' ')).join(' ').toLowerCase();
                return alvo.includes(termo);
            });
        }

        async function carregarPMO(opcoes = {}) {
            const silencioso = opcoes.silencioso === true;
            if (!silencioso) {
                state.pmoCarregando = true;
                state.pmoErro = '';
                renderPMO();
                atlasExibirOperacao('Carregando PMO...', 'bg-[#0073ea]');
            }
            try {
                if (!supabaseClient) throw new Error('Supabase indisponível, usando armazenamento local.');
                const { data: projetos, error: errProjetos } = await supabaseClient.from(ATLAS_PMO_TABELA_PROJETOS).select('*').order('created_at', { ascending: false });
                if (errProjetos) throw errProjetos;
                const { data: subelementos, error: errSubs } = await supabaseClient.from(ATLAS_PMO_TABELA_SUBELEMENTOS).select('*').order('created_at', { ascending: true });
                if (errSubs) throw errSubs;
                const { data: updates, error: errUpdates } = await supabaseClient.from(ATLAS_PMO_TABELA_UPDATES).select('*').order('created_at', { ascending: false });
                if (errUpdates) throw errUpdates;
                state.pmoProjetos = projetos || [];
                state.pmoSubelementos = subelementos || [];
                state.pmoUpdates = updates || [];
                state.pmoErro = '';
                if (!silencioso) atlasExibirOperacao('PMO carregado.', 'bg-emerald-600');
            } catch (err) {
                const local = pmoLerLocal();
                state.pmoProjetos = local.projetos;
                state.pmoSubelementos = local.subelementos;
                state.pmoUpdates = local.updates;
                state.pmoErro = `PMO em modo local. Para uso oficial compartilhado, execute o SQL supabase/ATLAS_V1_4_SCHEMA_OFICIAL.sql. Detalhe: ${err.message || err}`;
                if (!silencioso) atlasExibirOperacao('PMO aberto em modo local.', 'bg-amber-600');
            } finally {
                state.pmoCarregando = false;
                renderPMO();
            }
        }

        async function criarProjetoPMOLinha() {
            const agora = new Date().toISOString();
            const id = pmoGerarId('pmo_proj');
            const novo = {
                id,
                nome: 'Novo projeto PMO',
                status: 'AGUARDANDO DEFINIÇÃO',
                origem: '',
                created_at: agora,
                updated_at: agora
            };
            state.moduloAtivo = 'pmo';
            state.pmoFormularioAberto = false;
            state.pmoEditandoId = null;
            state.pmoProjetos = [novo, ...(state.pmoProjetos || []).filter(p => p.id !== id)];
            state.pmoProjetoAberto = '';
            pmoMarcarEdicaoLocal();
            pmoSalvarLocal();
            renderPMO();
            try {
                if (!supabaseClient) throw new Error('Supabase indisponível');
                const { data, error } = await supabaseClient.from(ATLAS_PMO_TABELA_PROJETOS).insert([novo]).select();
                if (error) throw error;
                const salvo = Array.isArray(data) ? data[0] : data;
                if (salvo) state.pmoProjetos = (state.pmoProjetos || []).map(p => p.id === id ? { ...novo, ...salvo } : p);
                state.pmoErro = '';
                pmoSalvarLocal();
                renderPMO();
            } catch (err) {
                state.pmoErro = `Linha criada localmente. Para salvar na nuvem, execute o SQL do PMO no Supabase. Detalhe: ${err.message || err}`;
                pmoSalvarLocal();
                renderPMO();
            }
        }

        function abrirFormularioPMO(id = '') {
            if (id) {
                state.moduloAtivo = 'pmo';
                state.pmoProjetoAberto = id;
                state.pmoFormularioAberto = false;
                state.pmoEditandoId = null;
                renderPMO();
                return;
            }
            criarProjetoPMOLinha();
        }

        function fecharFormularioPMO() {
            state.pmoFormularioAberto = false;
            state.pmoEditandoId = null;
            renderPMO();
        }


        function pmoIdCopiaExpansao(projetoId) {
            return `pmo_exp_${String(projetoId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        }

        function pmoIdCopiaSubitemExpansao(subitemId) {
            return `pmo_exp_sub_${String(subitemId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        }

        function pmoStatusParaStatusExpansao(status) {
            const texto = pmoNormalizarLabel(status);
            if (texto.includes('CONCLU')) return 'Concluído';
            if (texto === 'PARADO') return 'Parado';
            if (texto === 'REPROVADO' || texto === 'CANCELADO') return 'Inviável';
            return 'Em Progresso';
        }

        function pmoGrupoCopiaExpansao(status) {
            // PMO sempre espelha em Expansões > Projetos em Progresso/Execução.
            // O status visual continua sendo copiado, mas não deve mover a cópia para Projetos Concluídos.
            return 'em_progresso';
        }

        function pmoCopiaExpansaoExiste(projetoId) {
            const idCopia = pmoIdCopiaExpansao(projetoId);
            return (state.expansoes || []).some(p => p.id === idCopia);
        }

        function pmoPayloadCopiaExpansao(projeto) {
            const statusExpansao = pmoStatusParaStatusExpansao(projeto?.status);
            const grupo = pmoGrupoCopiaExpansao(projeto?.status);
            const totalCtos = pmoNormalizarNumero(projeto?.total_ctos_projetadas)
                || (pmoNormalizarNumero(projeto?.cto_1x8) + pmoNormalizarNumero(projeto?.cto_1x16));
            return {
                id: pmoIdCopiaExpansao(projeto?.id),
                grupo,
                nome: projeto?.nome || 'Projeto PMO',
                subelementos: (state.pmoSubelementos || []).filter(s => s.projeto_id === projeto?.id).length,
                duracao_completa: '',
                data_conclusao: projeto?.data_conclusao || null,
                duracao_lancamento: null,
                duracao_fusao: null,
                status: statusExpansao,
                empresa_fusao: '',
                empresa_lancamento: '',
                qtde_ctos: totalCtos || null,
                metragem_cabo: pmoNormalizarNumero(projeto?.cabos_projetados) || null,
                qtde_ceos: pmoNormalizarNumero(projeto?.ceos_projetadas) || null,
                imagens: projeto?.print_area || '',
                rotulo: 'PMO',
                novos_projetos: projeto?.origem || '',
                duracao_cto: null,
                duracao_ceo: null,
                equipes_lancamento: null,
                equipes_fusao: null,
                dependencia: projeto?.justificativa || projeto?.solicitante || '',
                numeros: projeto?.link || projeto?.regional || '',
                kmz: projeto?.projeto_link || '',
                lista_materiais: projeto?.lista_materiais || '',
                responsavel: projeto?.projetista || projeto?.solicitante || '',
                data_inicio: projeto?.timeline_inicio || projeto?.data_solicitacao || null,
                data_previsao_final: projeto?.timeline_fim || null,
                portas: pmoNormalizarNumero(projeto?.portas_ftth) || null,
                updated_at: new Date().toISOString()
            };
        }

        function pmoPayloadSubitemsCopiaExpansao(projeto) {
            const expansaoId = pmoIdCopiaExpansao(projeto?.id);
            return (state.pmoSubelementos || [])
                .filter(sub => sub.projeto_id === projeto?.id)
                .map(sub => ({
                    id: pmoIdCopiaSubitemExpansao(sub.id),
                    expansao_id: expansaoId,
                    nome: sub.nome || 'Subelemento PMO',
                    status: pmoStatusParaStatusExpansao(sub.status || projeto?.status),
                    timeline_inicio: null,
                    timeline_fim: null,
                    duracao: null,
                    equipe: '',
                    responsavel: sub.responsavel || '',
                    imagens: sub.link || sub.projeto_link || sub.kmz || sub.lista_materiais || '',
                    pessoas: sub.pon_livre || '',
                    depende_de: sub.link || '',
                    updated_at: new Date().toISOString()
                }));
        }

        function pmoAtualizarCopiaExpansaoLocal(payload, subPayloads, idsSubRemover = []) {
            state.expansoes = Array.isArray(state.expansoes) ? state.expansoes : [];
            state.expansoesSubitems = Array.isArray(state.expansoesSubitems) ? state.expansoesSubitems : [];
            const antigo = state.expansoes.find(p => p.id === payload.id) || {};
            state.expansoes = [
                { ...antigo, ...payload },
                ...state.expansoes.filter(p => p.id !== payload.id)
            ];
            if (idsSubRemover.length) {
                const remover = new Set(idsSubRemover);
                state.expansoesSubitems = state.expansoesSubitems.filter(s => !remover.has(s.id));
            }
            const mapaSubs = new Map(state.expansoesSubitems.map(s => [s.id, s]));
            subPayloads.forEach(sub => mapaSubs.set(sub.id, { ...(mapaSubs.get(sub.id) || {}), ...sub }));
            state.expansoesSubitems = Array.from(mapaSubs.values());
            state.expansoesAbertas[payload.grupo || 'em_progresso'] = true;
        }

        async function sincronizarProjetoPMOParaExpansoes(projetoId, opcoes = {}) {
            const projeto = (state.pmoProjetos || []).find(p => p.id === projetoId);
            if (!projeto) return false;
            const payload = pmoPayloadCopiaExpansao(projeto);
            const subPayloads = pmoPayloadSubitemsCopiaExpansao(projeto);
            const existentes = (state.expansoesSubitems || []).filter(s => s.expansao_id === payload.id && String(s.id || '').startsWith('pmo_exp_sub_'));
            const idsNovos = new Set(subPayloads.map(s => s.id));
            const idsRemover = existentes.filter(s => !idsNovos.has(s.id)).map(s => s.id);

            try {
                if (!supabaseClient) throw new Error('Supabase indisponível');
                const { error } = await supabaseClient.from('atlas_expansoes').upsert([payload], { onConflict: 'id' });
                if (error) throw error;
                if (subPayloads.length) {
                    const { error: subError } = await supabaseClient.from('atlas_expansoes_subitems').upsert(subPayloads, { onConflict: 'id' });
                    if (subError) throw subError;
                }
                if (idsRemover.length) {
                    const { error: delError } = await supabaseClient.from('atlas_expansoes_subitems').delete().in('id', idsRemover);
                    if (delError) throw delError;
                }
                pmoAtualizarCopiaExpansaoLocal(payload, subPayloads, idsRemover);
                if (!opcoes.silencioso) exibirStatusTemporario('✅ Cópia enviada para Expansões > Projetos.', 'bg-emerald-600');
                return true;
            } catch (err) {
                state.pmoErro = `PMO salvo, mas não consegui copiar para Expansões. Detalhe: ${err.message || err}`;
                pmoSalvarLocal();
                if (!opcoes.silencioso) exibirStatusTemporario('⚠️ PMO salvo, mas a cópia para Expansões falhou.', 'bg-red-600');
                return false;
            }
        }

        async function atualizarCampoProjetoPMO(id, campo, valor, opcoes = {}) {
            if (!id || !campo) return;
            const renderizar = opcoes.render !== false;
            const atual = (state.pmoProjetos || []).find(p => p.id === id);
            if (!atual) return;
            const valorNormalizado = pmoNormalizarValorCampo(campo, valor, ATLAS_PMO_PROJETO_DEFS);
            if (String(atual[campo] ?? '') === String(valorNormalizado ?? '')) return;
            const agora = new Date().toISOString();
            const atualizado = { ...atual, [campo]: valorNormalizado, updated_at: agora };
            state.pmoProjetos = (state.pmoProjetos || []).map(p => p.id === id ? atualizado : p);
            pmoMarcarEdicaoLocal();
            pmoSalvarLocal();
            if (renderizar) renderPMO();
            try {
                if (!supabaseClient) throw new Error('Supabase indisponível');
                const { data, error } = await supabaseClient
                    .from(ATLAS_PMO_TABELA_PROJETOS)
                    .update({ [campo]: valorNormalizado, updated_at: agora })
                    .eq('id', id)
                    .select();
                if (error) throw error;
                const salvo = Array.isArray(data) ? data[0] : data;
                if (salvo) state.pmoProjetos = (state.pmoProjetos || []).map(p => p.id === id ? { ...atualizado, ...salvo } : p);
                state.pmoErro = '';
                pmoSalvarLocal();
                if (campo === 'status' || pmoCopiaExpansaoExiste(id)) {
                    await sincronizarProjetoPMOParaExpansoes(id, { silencioso: campo !== 'status' });
                }
            } catch (err) {
                state.pmoErro = `Alteração mantida localmente. Para salvar na nuvem, confira o SQL do PMO no Supabase. Detalhe: ${err.message || err}`;
                pmoSalvarLocal();
            } finally {
                if (renderizar) renderPMO();
            }
        }

        async function salvarProjetoPMO(event) {
            event?.preventDefault?.();
            const form = event?.target;
            const payload = pmoPayloadFormulario(form, ATLAS_PMO_PROJETO_DEFS);
            const idEditando = state.pmoEditandoId;
            if (!idEditando) return criarProjetoPMOLinha();
            for (const [campo, valor] of Object.entries(payload)) await atualizarCampoProjetoPMO(idEditando, campo, valor, { render: false });
            state.pmoFormularioAberto = false;
            state.pmoEditandoId = null;
            renderPMO();
        }

        async function excluirProjetoPMO(id) {
            if (!id || !window.confirm('Excluir este projeto do PMO?')) return;
            try {
                if (!supabaseClient) throw new Error('Supabase indisponível');
                await supabaseClient.from(ATLAS_PMO_TABELA_UPDATES).delete().eq('projeto_id', id);
                await supabaseClient.from(ATLAS_PMO_TABELA_SUBELEMENTOS).delete().eq('projeto_id', id);
                const { error } = await supabaseClient.from(ATLAS_PMO_TABELA_PROJETOS).delete().eq('id', id);
                if (error) throw error;
            } catch (err) {
                state.pmoErro = `Exclusão aplicada localmente. Detalhe: ${err.message || err}`;
            } finally {
                state.pmoProjetos = (state.pmoProjetos || []).filter(p => p.id !== id);
                state.pmoSubelementos = (state.pmoSubelementos || []).filter(s => s.projeto_id !== id);
                state.pmoUpdates = (state.pmoUpdates || []).filter(u => u.projeto_id !== id);
                pmoMarcarEdicaoLocal();
                pmoSalvarLocal();
                renderPMO();
            }
        }

        function alternarProjetoPMO(id) {
            state.pmoProjetoAberto = state.pmoProjetoAberto === id ? '' : id;
            renderPMO();
        }

        function alternarGrupoPMO(status) {
            const chave = `status:${pmoNormalizarLabel(status || 'AGUARDANDO DEFINIÇÃO')}`;
            state.pmoEstruturaAbertas = state.pmoEstruturaAbertas || {};
            state.pmoEstruturaAbertas[chave] = state.pmoEstruturaAbertas[chave] === false ? true : false;
            renderPMO();
        }

        function grupoPMOAberto(status) {
            const chave = `status:${pmoNormalizarLabel(status || 'AGUARDANDO DEFINIÇÃO')}`;
            return (state.pmoEstruturaAbertas || {})[chave] !== false;
        }

        function alternarFormularioSubPMO(projetoId) {
            state.pmoSubitemNovoProjetoId = state.pmoSubitemNovoProjetoId === projetoId ? null : projetoId;
            state.pmoUpdateNovoProjetoId = null;
            renderPMO();
        }

        function alternarFormularioUpdatePMO(projetoId) {
            state.pmoUpdateNovoProjetoId = state.pmoUpdateNovoProjetoId === projetoId ? null : projetoId;
            state.pmoSubitemNovoProjetoId = null;
            renderPMO();
        }

        async function salvarSubelementoPMO(event, projetoId) {
            event?.preventDefault?.();
            const payload = { projeto_id: projetoId, ...pmoPayloadFormulario(event.target, ATLAS_PMO_SUBELEMENTO_DEFS) };
            const agora = new Date().toISOString();
            const id = pmoGerarId('pmo_sub');
            let registroFinal = { id, ...payload, created_at: agora, updated_at: agora };
            try {
                if (!supabaseClient) throw new Error('Supabase indisponível');
                const { data, error } = await supabaseClient.from(ATLAS_PMO_TABELA_SUBELEMENTOS).insert([{ id, ...payload }]).select();
                if (error) throw error;
                const salvo = Array.isArray(data) ? data[0] : data;
                registroFinal = { ...registroFinal, ...(salvo || {}) };
                state.pmoErro = '';
            } catch (err) {
                state.pmoErro = `Subelemento salvo localmente. Detalhe: ${err.message || err}`;
            } finally {
                state.pmoSubelementos = [...(state.pmoSubelementos || []).filter(s => s.id !== id), registroFinal];
                state.pmoSubitemNovoProjetoId = null;
                state.pmoProjetoAberto = projetoId;
                pmoMarcarEdicaoLocal();
                pmoSalvarLocal();
                renderPMO();
            }
        }

        async function excluirSubelementoPMO(id) {
            if (!id || !window.confirm('Excluir este subelemento do PMO?')) return;
            try {
                if (!supabaseClient) throw new Error('Supabase indisponível');
                const { error } = await supabaseClient.from(ATLAS_PMO_TABELA_SUBELEMENTOS).delete().eq('id', id);
                if (error) throw error;
            } catch (err) {
                state.pmoErro = `Subelemento excluído localmente. Detalhe: ${err.message || err}`;
            } finally {
                state.pmoSubelementos = (state.pmoSubelementos || []).filter(s => s.id !== id);
                pmoMarcarEdicaoLocal();
                pmoSalvarLocal();
                renderPMO();
            }
        }

        async function salvarUpdatePMO(event, projetoId) {
            event?.preventDefault?.();
            const payload = { projeto_id: projetoId, ...pmoPayloadFormulario(event.target, ATLAS_PMO_UPDATE_DEFS) };
            const agora = new Date().toISOString();
            const id = pmoGerarId('pmo_upd');
            let registroFinal = { id, ...payload, created_at: agora, updated_at: agora };
            try {
                if (!supabaseClient) throw new Error('Supabase indisponível');
                const { data, error } = await supabaseClient.from(ATLAS_PMO_TABELA_UPDATES).insert([{ id, ...payload }]).select();
                if (error) throw error;
                const salvo = Array.isArray(data) ? data[0] : data;
                registroFinal = { ...registroFinal, ...(salvo || {}) };
                state.pmoErro = '';
            } catch (err) {
                state.pmoErro = `Update salvo localmente. Detalhe: ${err.message || err}`;
            } finally {
                state.pmoUpdates = [registroFinal, ...(state.pmoUpdates || []).filter(u => u.id !== id)];
                state.pmoUpdateNovoProjetoId = null;
                state.pmoProjetoAberto = projetoId;
                pmoMarcarEdicaoLocal();
                pmoSalvarLocal();
                renderPMO();
            }
        }

        async function excluirUpdatePMO(id) {
            if (!id || !window.confirm('Excluir este update do PMO?')) return;
            try {
                if (!supabaseClient) throw new Error('Supabase indisponível');
                const { error } = await supabaseClient.from(ATLAS_PMO_TABELA_UPDATES).delete().eq('id', id);
                if (error) throw error;
            } catch (err) {
                state.pmoErro = `Update excluído localmente. Detalhe: ${err.message || err}`;
            } finally {
                state.pmoUpdates = (state.pmoUpdates || []).filter(u => u.id !== id);
                pmoMarcarEdicaoLocal();
                pmoSalvarLocal();
                renderPMO();
            }
        }

        function renderPMOFormularioProjeto() {
            return '';
        }

        function renderPMOSubForm(projetoId) {
            if (state.pmoSubitemNovoProjetoId !== projetoId) return '';
            return `<form class="atlas-pmo-nested-form" onsubmit="salvarSubelementoPMO(event, '${escaparAtributoJs(projetoId)}')">
                <h4>Novo subelemento</h4>
                <div class="atlas-pmo-form-grid compact">${ATLAS_PMO_SUBELEMENTO_DEFS.map(def => pmoFormInput(def, '')).join('')}</div>
                <div class="atlas-pmo-form-actions"><button type="submit" class="atlas-action-btn primary">Salvar subelemento</button><button type="button" class="atlas-action-btn" onclick="alternarFormularioSubPMO('${escaparAtributoJs(projetoId)}')">Cancelar</button></div>
            </form>`;
        }

        function renderPMOUpdateForm(projetoId) {
            if (state.pmoUpdateNovoProjetoId !== projetoId) return '';
            return `<form class="atlas-pmo-nested-form" onsubmit="salvarUpdatePMO(event, '${escaparAtributoJs(projetoId)}')">
                <h4>Novo update/comentário</h4>
                <div class="atlas-pmo-form-grid compact">${ATLAS_PMO_UPDATE_DEFS.map(def => pmoFormInput(def, '')).join('')}</div>
                <div class="atlas-pmo-form-actions"><button type="submit" class="atlas-action-btn primary">Salvar update</button><button type="button" class="atlas-action-btn" onclick="alternarFormularioUpdatePMO('${escaparAtributoJs(projetoId)}')">Cancelar</button></div>
            </form>`;
        }

        function pmoRenderCampoProjeto(projeto, def) {
            const id = escaparAtributoJs(projeto.id);
            const campo = escaparAtributoJs(def.key);
            const valor = projeto?.[def.key] ?? '';
            if (def.type === 'label') {
                const tipo = def.key === 'origem' ? 'origem' : 'status';
                return pmoLabelBotao(projeto.id, def.key, valor, tipo);
            }
            if (def.type === 'date') {
                return `<input class="atlas-pmo-inline-input atlas-pmo-inline-date" type="date" value="${escaparHtml(pmoInputDate(valor))}" onchange="atualizarCampoProjetoPMO('${id}', '${campo}', this.value)">`;
            }
            if (def.type === 'number' || def.type === 'money') {
                const exibicao = valor === null || valor === undefined || valor === '' ? '' : String(valor);
                return `<input class="atlas-pmo-inline-input atlas-pmo-inline-number" type="text" value="${escaparHtml(exibicao)}" onblur="atualizarCampoProjetoPMO('${id}', '${campo}', this.value)" onkeydown="if(event.key==='Enter'){this.blur()}">`;
            }
            if (def.type === 'textarea') {
                return `<textarea class="atlas-pmo-inline-input atlas-pmo-inline-textarea" onblur="atualizarCampoProjetoPMO('${id}', '${campo}', this.value)">${escaparHtml(valor || '')}</textarea>`;
            }
            if (def.type === 'kmz' || def.type === 'material' || def.type === 'image') {
                const temArquivo = Boolean(valor);
                const configArquivo = def.type === 'kmz'
                    ? { abrir: 'Abrir KMZ', anexar: 'Anexar KMZ', accept: '.kmz,.kml' }
                    : def.type === 'material'
                        ? { abrir: 'Abrir planilha', anexar: 'Anexar planilha', accept: '.xlsx,.xls,.xlsm,.csv,.ods' }
                        : { abrir: 'Abrir imagem', anexar: 'Anexar imagem', accept: 'image/*,.jpg,.jpeg,.png,.webp' };
                return `<div class="atlas-pmo-file-cell">
                    ${temArquivo ? `<button type="button" class="atlas-attachment-link" onclick="atlasAbrirVisualizadorAnexoUnico('${escaparAtributoJs(valor)}', '${escaparAtributoJs(configArquivo.abrir)}', event)">${escaparHtml(configArquivo.abrir)}</button>` : `<span>Sem anexo</span>`}
                    <button type="button" class="atlas-pmo-mini-btn" onclick="pmoAnexarArquivoProjeto('${id}', '${campo}', '${escaparAtributoJs(configArquivo.accept)}')">${temArquivo ? 'Trocar' : configArquivo.anexar}</button>
                </div>`;
            }
            if (def.type === 'url') {
                const aberto = valor ? `<button type="button" class="atlas-attachment-link" onclick="atlasAbrirVisualizadorAnexoUnico('${escaparAtributoJs(valor)}', '${escaparAtributoJs(campo)}', event)">Abrir</button>` : '';
                return `<div class="atlas-pmo-url-cell">${aberto}<input class="atlas-pmo-inline-input" type="url" value="${escaparHtml(valor || '')}" placeholder="https://" onblur="atualizarCampoProjetoPMO('${id}', '${campo}', this.value)" onkeydown="if(event.key==='Enter'){this.blur()}"></div>`;
            }
            if (def.key === 'nome') {
                return `<div class="atlas-pmo-name-cell"><button type="button" class="atlas-pmo-name-toggle" onclick="alternarProjetoPMO('${id}')" title="Abrir subelementos e updates">↕</button><input class="atlas-pmo-inline-input atlas-pmo-name-input" type="text" value="${escaparHtml(valor || '')}" onblur="atualizarCampoProjetoPMO('${id}', '${campo}', this.value)" onkeydown="if(event.key==='Enter'){this.blur()}" placeholder="Nome do elemento"></div>`;
            }
            return `<input class="atlas-pmo-inline-input" type="${escaparHtml(def.type === 'email' ? 'email' : 'text')}" value="${escaparHtml(valor || '')}" onblur="atualizarCampoProjetoPMO('${id}', '${campo}', this.value)" onkeydown="if(event.key==='Enter'){this.blur()}">`;
        }

        async function pmoAnexarArquivoProjeto(projetoId, campo, accept = '') {
            const projeto = (state.pmoProjetos || []).find(p => p.id === projetoId);
            if (!projeto) return;
            const input = document.createElement('input');
            input.type = 'file';
            const configCampoArquivo = {
                projeto_link: { accept: '.kmz,.kml', tipoMidia: 'kmz', pastaMidiaNome: 'KMZ', statusNome: 'KMZ' },
                lista_materiais: { accept: '.xlsx,.xls,.xlsm,.csv,.ods', tipoMidia: 'lista_materiais', pastaMidiaNome: 'Lista de Materiais', statusNome: 'planilha' },
                print_area: { accept: 'image/*,.jpg,.jpeg,.png,.webp', tipoMidia: 'imagens', pastaMidiaNome: 'Print da área', statusNome: 'imagem' }
            };
            const cfgArquivo = configCampoArquivo[campo] || { accept: '', tipoMidia: campo || 'arquivo', pastaMidiaNome: 'Arquivos', statusNome: 'arquivo' };
            input.accept = accept || cfgArquivo.accept;
            input.onchange = async () => {
                const file = input.files && input.files[0];
                if (!file) return;
                try {
                    const tamanhoMb = file.size / 1024 / 1024;
                    if (tamanhoMb > LIMITE_UPLOAD_MB) throw new Error(`Arquivo muito grande. Limite atual: ${LIMITE_UPLOAD_MB} MB.`);
                    const { tipoMidia, pastaMidiaNome, statusNome } = cfgArquivo;
                    exibirStatusTemporario(`⏳ Enviando ${statusNome}: ${file.name} para o Drive...`, 'bg-[#0073ea]');
                    const resultado = await chamarEndpointGoogleDrive({
                        nomeArquivo: file.name,
                        mimeType: file.type || 'application/octet-stream',
                        base64: await converterArquivoParaBase64(file),
                        obraNome: 'PMO',
                        elementoTipo: 'Análise de Novos Projetos',
                        elementoNome: projeto.nome || 'Projeto PMO',
                        subelementoNome: pastaMidiaNome,
                        tipoMidia,
                        modulo: 'expansoes',
                        rootFolderId: GOOGLE_DRIVE_EXPANSOES_FOLDER_ID,
                        grupoNome: 'PMO',
                        expansaoNome: projeto.nome || 'Projeto PMO',
                        pastaMidiaNome
                    }, 'O endpoint do Google Drive não retornou JSON válido no anexo do PMO.');
                    const url = resultado.viewUrl || resultado.url || resultado.thumbnailUrl || '';
                    if (!url) throw new Error('O Drive não retornou link do arquivo.');
                    await atualizarCampoProjetoPMO(projetoId, campo, url, { render: false });
                    exibirStatusTemporario('✅ Arquivo anexado ao PMO.', 'bg-emerald-600');
                    renderPMO();
                } catch (err) {
                    await alertaVisualAtnx('Erro ao anexar arquivo no PMO', err.message || String(err));
                }
            };
            input.click();
        }

        function renderPMODetalhesProjeto(projeto) {
            const subs = (state.pmoSubelementos || []).filter(s => s.projeto_id === projeto.id);
            const updates = (state.pmoUpdates || []).filter(u => u.projeto_id === projeto.id);
            const subRows = subs.length ? subs.map(sub => `<tr>
                <td>${escaparHtml(sub.nome || '—')}</td><td>${escaparHtml(sub.responsavel || '—')}</td><td>${pmoStatusPill(sub.status)}</td><td>${pmoFormatarNumero(sub.portas_ftth)}</td><td>${pmoFormatarMoeda(sub.valor_projeto)}</td><td>${pmoValorCelula(sub, 'link')}</td>
                <td><button class="atlas-pmo-mini-btn danger" onclick="excluirSubelementoPMO('${escaparAtributoJs(sub.id)}')">Excluir</button></td>
            </tr>`).join('') : `<tr><td colspan="7" class="atlas-module-empty-row">Nenhum subelemento cadastrado para este projeto.</td></tr>`;
            const updateCards = updates.length ? updates.map(upd => `<article class="atlas-pmo-update-card">
                <div><strong>${escaparHtml(upd.usuario || 'Usuário não informado')}</strong><span>${escaparHtml(upd.tipo_conteudo || 'Update')} • ${upd.data_criacao ? formatarDataParaExibicao(upd.data_criacao) : 'Sem data'}</span></div>
                <p>${escaparHtml(upd.conteudo || 'Sem conteúdo')}</p>
                <footer>Post ID: ${escaparHtml(upd.post_id || '—')} • Likes: ${pmoFormatarNumero(upd.likes_count)}</footer>
                <button class="atlas-pmo-mini-btn danger" onclick="excluirUpdatePMO('${escaparAtributoJs(upd.id)}')">Excluir</button>
            </article>`).join('') : `<div class="atlas-module-empty-row">Nenhum update/comentário cadastrado para este projeto.</div>`;
            return `<tr class="atlas-pmo-detail-row"><td colspan="${ATLAS_PMO_PROJETO_DEFS.length + 2}">
                <div class="atlas-pmo-detail-card">
                    <div class="atlas-pmo-detail-actions">
                        <button class="atlas-action-btn" onclick="alternarFormularioSubPMO('${escaparAtributoJs(projeto.id)}')">+ Subelemento</button>
                        <button class="atlas-action-btn" onclick="alternarFormularioUpdatePMO('${escaparAtributoJs(projeto.id)}')">+ Update</button>
                    </div>
                    ${renderPMOSubForm(projeto.id)}
                    ${renderPMOUpdateForm(projeto.id)}
                    <h4>Subelementos</h4>
                    <div class="atlas-module-table-wrap"><table class="atlas-module-table atlas-pmo-nested-table"><thead><tr><th>Nome</th><th>Responsável</th><th>Status</th><th>Portas FTTH</th><th>Valor</th><th>Link</th><th>Ações</th></tr></thead><tbody>${subRows}</tbody></table></div>
                    <h4>Updates e comentários</h4>
                    <div class="atlas-pmo-updates-list">${updateCards}</div>
                </div>
            </td></tr>`;
        }

        function renderPMOProjetoLinha(projeto) {
            const aberto = state.pmoProjetoAberto === projeto.id;
            const cells = ATLAS_PMO_PROJETO_DEFS.map(def => `<td class="atlas-pmo-editable-cell atlas-pmo-col-${escaparHtml(def.key)}" style="min-width:${Number(def.width || 140)}px">${pmoRenderCampoProjeto(projeto, def)}</td>`).join('');
            const row = `<tr class="atlas-pmo-project-row ${aberto ? 'is-open' : ''}">
                <td class="atlas-pmo-toggle-cell"><button class="atlas-pmo-mini-btn" onclick="alternarProjetoPMO('${escaparAtributoJs(projeto.id)}')">${aberto ? '−' : '+'}</button></td>
                ${cells}
                <td class="atlas-pmo-row-actions"><button class="atlas-pmo-mini-btn danger" onclick="excluirProjetoPMO('${escaparAtributoJs(projeto.id)}')">Excluir</button></td>
            </tr>`;
            return aberto ? row + renderPMODetalhesProjeto(projeto) : row;
        }

        function pmoAgruparProjetosPorStatus(projetos) {
            const mapa = new Map();
            (projetos || []).forEach(projeto => {
                const status = pmoNormalizarLabel(projeto.status || 'AGUARDANDO DEFINIÇÃO') || 'AGUARDANDO DEFINIÇÃO';
                if (!mapa.has(status)) mapa.set(status, []);
                mapa.get(status).push(projeto);
            });
            const statusExtras = [...mapa.keys()].filter(s => !ATLAS_PMO_STATUS_REFERENCIA.includes(s)).sort((a,b) => a.localeCompare(b));
            const ordem = [...ATLAS_PMO_STATUS_REFERENCIA, ...statusExtras].filter(status => mapa.has(status));
            return ordem.map(status => ({ status, projetos: mapa.get(status) || [] }));
        }

        function renderPMOProjetoRows(projetos) {
            const colunas = ATLAS_PMO_PROJETO_DEFS.length + 2;
            if (state.pmoCarregando) return `<tr><td colspan="${colunas}" class="atlas-module-empty-row">Carregando PMO...</td></tr>`;
            if (!projetos.length && (state.pmoProjetos || []).length) return `<tr><td colspan="${colunas}" class="atlas-module-empty-row">Nenhum projeto encontrado com a pesquisa atual. Limpe a busca para visualizar todos os projetos cadastrados.</td></tr>`;
            if (!projetos.length) return `<tr><td colspan="${colunas}" class="atlas-module-empty-row">Nenhum projeto cadastrado. Clique em “Nova linha PMO” para criar diretamente na tabela, sem tela de cadastro.</td></tr>`;
            return pmoAgruparProjetosPorStatus(projetos).map(grupo => {
                const aberto = grupoPMOAberto(grupo.status);
                const totalPortas = grupo.projetos.reduce((acc, p) => acc + Number(p.portas_ftth || 0), 0);
                const totalValor = grupo.projetos.reduce((acc, p) => acc + Number(p.valor_projeto || 0), 0);
                const header = `<tr class="atlas-pmo-group-row">
                    <td colspan="${colunas}">
                        <button type="button" onclick="alternarGrupoPMO('${escaparAtributoJs(grupo.status)}')">${aberto ? '▾' : '▸'}</button>
                        ${pmoStatusPill(grupo.status)}
                        <span>${grupo.projetos.length} elemento(s)</span>
                        <span>${pmoFormatarNumero(totalPortas)} portas</span>
                        <span>${pmoFormatarMoeda(totalValor)}</span>
                    </td>
                </tr>`;
                return header + (aberto ? grupo.projetos.map(renderPMOProjetoLinha).join('') : '');
            }).join('');
        }

        function renderPMO() {
            const __atlasRender = iniciarRenderPreservandoEstadoVisual();
            try {
                atualizarVisibilidadeModulos();
                const painel = document.getElementById('painel-pmo');
                const titulo = document.getElementById('txt-nome-obra');
                if (!painel || !titulo) return;
                titulo.innerText = 'PMO';
                document.getElementById('txt-grupo-ativo').innerHTML = '';
                const termo = String(state.termoPesquisa || '').trim();
                const projetos = pmoProjetosFiltrados();
                const totalProjetos = (state.pmoProjetos || []).length;
                const totalUpdates = (state.pmoUpdates || []).length;
                const totalSubelementos = (state.pmoSubelementos || []).length;
                const valorTotal = (state.pmoProjetos || []).reduce((acc, p) => acc + Number(p.valor_projeto || 0), 0);
                const portas = (state.pmoProjetos || []).reduce((acc, p) => acc + Number(p.portas_ftth || 0), 0);
                const cabos = (state.pmoProjetos || []).reduce((acc, p) => acc + Number(p.cabos_projetados || 0), 0);
                const cabecalhos = `<th></th>${ATLAS_PMO_PROJETO_DEFS.map(def => `<th style="min-width:${Number(def.width || 140)}px">${escaparHtml(def.label)}</th>`).join('')}<th>Ações</th>`;
                painel.innerHTML = `<div class="atlas-module-shell atlas-pmo-shell">
                    <div class="atlas-module-titlebar">
                        <div>
                            <div class="atlas-module-kicker">Gestão de projetos</div>
                            <h2>PMO</h2>
                            <p>Análise de Novos Projetos.</p>
                        </div>
                        <div class="atlas-module-actions">
                            <button class="atlas-module-pill atlas-pmo-new-line-pill" onclick="criarProjetoPMOLinha()">+ Nova linha PMO</button>
                        </div>
                    </div>
                    ${state.pmoErro ? `<div class="atlas-module-warning">${escaparHtml(state.pmoErro)}</div>` : ''}
                    <div class="atlas-module-toolbar">
                        <div class="atlas-module-search"><span>🔎</span><input id="input-pmo-search" value="${escaparHtml(termo)}" oninput="handleSearch(this.value)" placeholder="Pesquisar projeto, status, origem, regional, solicitante, update..." aria-label="Pesquisar no PMO" autocomplete="off"></div>
                        <button class="atlas-action-btn" onclick="carregarPMO()">Atualizar</button>
                    </div>
                    <div class="atlas-module-kpis">
                        <div><strong>${totalProjetos}</strong><span>Projetos cadastrados</span></div>
                        <div><strong>${pmoFormatarMoeda(valorTotal)}</strong><span>Valor total</span></div>
                        <div><strong>${pmoFormatarNumero(portas)}</strong><span>Portas FTTH</span></div>
                        <div><strong>${pmoFormatarNumero(cabos)}</strong><span>Cabos projetados</span></div>
                        <div><strong>${totalSubelementos}</strong><span>Subelementos</span></div>
                        <div><strong>${totalUpdates}</strong><span>Updates</span></div>
                    </div>
                    ${totalProjetos === 0 ? `<div class="atlas-pmo-empty-state"><div class="atlas-pmo-empty-icon">PMO</div><h3>Nenhum projeto cadastrado ainda</h3><p>A estrutura está pronta para cadastrar direto na tabela. A planilha foi usada apenas como referência de campos, sem importar os dados existentes.</p><button class="atlas-action-btn primary" onclick="criarProjetoPMOLinha()">Criar primeira linha</button></div>` : ''}
                    <div class="atlas-pmo-table-wrap atlas-module-table-wrap">
                        <table class="atlas-module-table atlas-pmo-table atlas-pmo-inline-table">
                            <thead><tr>${cabecalhos}</tr></thead>
                            <tbody>${renderPMOProjetoRows(projetos)}</tbody>
                        </table>
                    </div>
                </div>`;
            } finally {
                finalizarRenderPreservandoEstadoVisual(__atlasRender);
            }
        }

        const ATLAS_MANUTENCAO_TABELA = 'atlas_manutencoes_rede';
        const ATLAS_MANUTENCAO_STATUS = ['Aberta', 'Em análise', 'Em execução', 'Concluída', 'Cancelada'];
        const ATLAS_MANUTENCAO_PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Crítica'];
        const ATLAS_MANUTENCAO_DOC_STATUS = ['Documentado', 'Não documentado'];
        const ATLAS_MANUTENCAO_REGIONAIS = ['Regional PB', 'Regional RN', 'Regional PE', 'Regional BA'];

        function normalizarStatusManutencao(valor) {
            const texto = String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (texto.includes('exec')) return 'Em execução';
            if (texto.includes('analise') || texto.includes('análise')) return 'Em análise';
            if (texto.includes('concl') || texto.includes('final')) return 'Concluída';
            if (texto.includes('cancel')) return 'Cancelada';
            return valor ? String(valor).trim() : 'Aberta';
        }

        function normalizarPrioridadeManutencao(valor) {
            const texto = String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (texto.includes('critic')) return 'Crítica';
            if (texto.includes('alta') || texto === 'urgente') return 'Alta';
            if (texto.includes('baixa')) return 'Baixa';
            return valor ? String(valor).trim() : 'Média';
        }

        function normalizarRegionalManutencao(valor) {
            const texto = String(valor || '').trim().toUpperCase();
            if (texto.includes('PB')) return 'Regional PB';
            if (texto.includes('RN')) return 'Regional RN';
            if (texto.includes('PE')) return 'Regional PE';
            if (texto.includes('BA')) return 'Regional BA';
            return '';
        }

        function normalizarDocumentacaoManutencao(valor) {
            const texto = String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (texto.includes('documentado') && !texto.includes('nao')) return 'Documentado';
            return 'Não documentado';
        }

        function classeRegionalManutencao(regional) {
            const chave = normalizarRegionalManutencao(regional).replace('Regional ', '').toLowerCase() || 'sem-regional';
            return `atlas-maint-regional-${chave}`;
        }

        function classeDocumentacaoManutencao(valor) {
            return normalizarDocumentacaoManutencao(valor) === 'Documentado' ? 'atlas-maint-doc-ok' : 'atlas-maint-doc-no';
        }

        function formatarDataManutencao(valor) {
            if (!valor) return '-';
            const data = new Date(String(valor).includes('T') ? valor : `${valor}T00:00:00`);
            if (Number.isNaN(data.getTime())) return String(valor);
            return data.toLocaleDateString('pt-BR');
        }

        function manutencaoRedeLocalStorageKey() {
            return 'atlas_manutencoes_rede_local_v1';
        }

        function lerManutencoesRedeLocal() {
            try {
                const salvo = localStorage.getItem(manutencaoRedeLocalStorageKey());
                if (salvo !== null) {
                    const lista = JSON.parse(salvo || '[]');
                    return Array.isArray(lista) ? lista : [];
                }
                return [];
            } catch (err) {
                return [];
            }
        }

        function salvarManutencoesRedeLocal(lista) {
            localStorage.setItem(manutencaoRedeLocalStorageKey(), JSON.stringify(lista || []));
        }

        function normalizarAnexosManutencao(valor) {
            if (!valor) return [];
            if (Array.isArray(valor)) return valor.filter(Boolean);
            if (typeof valor === 'string') {
                try {
                    const parsed = JSON.parse(valor);
                    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
                } catch (err) {
                    return valor.trim() ? [{ nome: 'Link informado', viewUrl: valor.trim(), url: valor.trim(), origem: 'texto' }] : [];
                }
            }
            return [];
        }

        function erroSchemaManutencaoRede(err) {
            const texto = String(err?.message || err || '').toLowerCase();
            return texto.includes('schema cache') || texto.includes('could not find') || texto.includes('column');
        }

        function mensagemErroManutencaoRede(err) {
            if (erroSchemaManutencaoRede(err)) {
                return 'O Supabase ainda não reconheceu as colunas novas da tabela atlas_manutencoes_rede. Execute novamente o arquivo supabase/ATLAS_V1_4_SCHEMA_OFICIAL.sql e aguarde o reload do schema. Detalhe: ' + (err?.message || err);
            }
            return err?.message || String(err);
        }

        async function carregarManutencoesRede(opcoes = {}) {
            const silencioso = opcoes.silencioso === true;
            if (!silencioso) {
                state.manutencaoRedeCarregando = true;
                state.manutencaoRedeErro = '';
                renderManutencaoRedes();
                atlasExibirOperacao('Carregando Manutenção de Redes...', 'bg-[#0073ea]');
            }
            try {
                if (!supabaseClient) throw new Error('Supabase indisponível.');
                const { data, error } = await supabaseClient
                    .from(ATLAS_MANUTENCAO_TABELA)
                    .select('*')
                    .order('data_abertura', { ascending: false })
                    .order('created_at', { ascending: false });
                if (error) throw error;
                state.manutencoesRede = (data || []).map(item => ({
                    ...item,
                    status: normalizarStatusManutencao(item.status),
                    prioridade: normalizarPrioridadeManutencao(item.prioridade),
                    regional: normalizarRegionalManutencao(item.regional),
                    documentacao_status: normalizarDocumentacaoManutencao(item.documentacao_status)
                }));
                state.manutencaoRedeErro = '';
                if (!silencioso) atlasExibirOperacao('Manutenção de Redes carregada.', 'bg-emerald-600');
            } catch (err) {
                state.manutencoesRede = lerManutencoesRedeLocal();
                state.manutencaoRedeErro = `Manutenção de Redes em modo local. Para uso compartilhado, execute o SQL supabase/ATLAS_V1_4_SCHEMA_OFICIAL.sql. Detalhe: ${mensagemErroManutencaoRede(err)}`;
                if (!silencioso) atlasExibirOperacao('Manutenção de Redes aberta em modo local.', 'bg-amber-600');
            } finally {
                state.manutencaoRedeCarregando = false;
                renderManutencaoRedes();
            }
        }

        async function atualizarManutencaoRedeCampo(id, campo, valor) {
            if (!await exigirPermissaoAtlas('editar_registro', 'editar manutenção de redes')) return;
            const item = (state.manutencoesRede || []).find(reg => reg.id === id);
            if (!item) return;
            if (['data_abertura', 'data_solicitacao', 'data_conclusao'].includes(campo) && !valor) valor = null;
            item[campo] = valor;
            item.updated_at = new Date().toISOString();
            try {
                if (supabaseClient && !state.manutencaoRedeErro) {
                    const { error } = await supabaseClient.from(ATLAS_MANUTENCAO_TABELA).update({ [campo]: valor, updated_at: item.updated_at }).eq('id', id);
                    if (error) throw error;
                } else {
                    salvarManutencoesRedeLocal(state.manutencoesRede);
                }
                renderManutencaoRedes();
            } catch (err) {
                state.manutencaoRedeErro = mensagemErroManutencaoRede(err);
                renderManutencaoRedes();
                await alertaVisualAtnx('Erro ao salvar manutenção', state.manutencaoRedeErro);
            }
        }

        async function excluirManutencaoRede(id) {
            if (!await exigirPermissaoAtlas('excluir_registro', 'excluir chamados')) return;
            const item = (state.manutencoesRede || []).find(reg => reg.id === id);
            if (!item) return;
            const titulo = item.cidade || item.localidade || item.voalle_ticket_id || item.protocolo || 'este chamado';
            const ok = await confirmarVisualAtnx(
                'Excluir chamado',
                `Excluir "${titulo}" da Manutenção de Redes? Os anexos já enviados ao Drive de Documentação serão preservados.`,
                'Excluir'
            );
            if (!ok) return;
            try {
                exibirStatusTemporario('Removendo chamado...', 'bg-[#0073ea]');
                if (supabaseClient && !state.manutencaoRedeErro) {
                    const { error } = await supabaseClient.from(ATLAS_MANUTENCAO_TABELA).delete().eq('id', id);
                    if (error) throw error;
                }
                state.manutencoesRede = (state.manutencoesRede || []).filter(reg => reg.id !== id);
                if (!supabaseClient || state.manutencaoRedeErro) salvarManutencoesRedeLocal(state.manutencoesRede);
                exibirStatusTemporario('Chamado excluído.', 'bg-emerald-600');
                renderManutencaoRedes();
            } catch (err) {
                state.manutencaoRedeErro = mensagemErroManutencaoRede(err);
                renderManutencaoRedes();
                await alertaVisualAtnx('Erro ao excluir chamado', state.manutencaoRedeErro);
            }
        }

        async function editarEvidenciasManutencao(id) {
            const item = (state.manutencoesRede || []).find(reg => reg.id === id);
            if (!item) return;
            const valor = await solicitarTextoAtnx({
                titulo: 'Evidências da manutenção',
                mensagem: 'Cole links de imagens, diagramas de fusão, pasta do Drive ou uma observação curta.',
                label: 'Evidências',
                valor: item.evidencias || '',
                placeholder: 'Ex.: link do Drive, print, diagrama de fusão...',
                textoConfirmar: 'Salvar'
            });
            if (valor === null) return;
            await atualizarManutencaoRedeCampo(id, 'evidencias', valor);
        }

        async function editarCampoManutencaoRede(id, campo, label, placeholder = '') {
            const item = (state.manutencoesRede || []).find(reg => reg.id === id);
            if (!item) return;
            const valor = await solicitarTextoAtnx({
                titulo: `Editar ${label}`,
                mensagem: 'Atualize a informação da manutenção de rede.',
                label,
                valor: item[campo] || '',
                placeholder,
                textoConfirmar: 'Salvar'
            });
            if (valor === null) return;
            await atualizarManutencaoRedeCampo(id, campo, valor);
        }

        async function anexarArquivoManutencao(id) {
            if (!await exigirPermissaoAtlas('anexar_arquivo', 'anexar arquivos')) return;
            const item = (state.manutencoesRede || []).find(reg => reg.id === id);
            if (!item) return;
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'image/*,.jpg,.jpeg,.png,.webp,.kmz,.kml,.xlsx,.xls,.xlsm,.csv,.ods,.pdf';
            input.onchange = async event => {
                const arquivos = Array.from(event.target.files || []);
                if (!arquivos.length) return;
                try {
                    obterUrlAppsScriptGoogleDrive('documentacao');
                    const anexos = normalizarAnexosManutencao(item.anexos);
                    for (let i = 0; i < arquivos.length; i++) {
                        const file = arquivos[i];
                        const tamanhoMb = file.size / 1024 / 1024;
                        if (tamanhoMb > LIMITE_UPLOAD_MB) throw new Error(`Arquivo muito grande: ${file.name}. Limite atual: ${LIMITE_UPLOAD_MB} MB.`);
                        exibirStatusTemporario(`Enviando anexo ${i + 1}/${arquivos.length} para o Drive de Documentação...`, 'bg-[#0073ea]');
                        const resultado = await chamarEndpointGoogleDrive({
                            nomeArquivo: file.name,
                            mimeType: file.type || 'application/octet-stream',
                            base64: await converterArquivoParaBase64(file),
                            obraId: 'manutencao-redes',
                            obraNome: 'Manutenção de Redes',
                            elementoId: item.id,
                            elementoTipo: 'Ocorrência de Rede',
                            elementoNome: item.cidade || item.localidade || 'Sem cidade',
                            subelementoId: item.id,
                            subelementoNome: item.voalle_ticket_id || item.protocolo || item.tipo_manutencao || 'Manutenção',
                            tipoMidia: 'manutencao_rede',
                            pastaMidiaNome: 'Evidências',
                            modulo: 'documentacao',
                            rootFolderId: GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID
                        }, 'O endpoint do Google Drive não retornou JSON válido no upload de Manutenção de Redes.');
                        anexos.push({
                            nome: file.name,
                            url: resultado.url || resultado.viewUrl || resultado.thumbnailUrl || '',
                            viewUrl: resultado.viewUrl || resultado.url || resultado.thumbnailUrl || '',
                            thumbnailUrl: resultado.thumbnailUrl || resultado.url || '',
                            fileId: resultado.fileId || '',
                            folderId: resultado.folderId || '',
                            folderIds: resultado.folderIds || {},
                            mimeType: file.type || 'application/octet-stream',
                            tamanho: file.size,
                            origem: 'atnx_upload_documentacao',
                            modulo: 'documentacao',
                            criadoEm: new Date().toISOString()
                        });
                    }
                    await salvarPatchManutencaoRede(id, { anexos, updated_at: new Date().toISOString() });
                    exibirStatusTemporario('Anexo(s) enviado(s) para o Drive de Documentação.', 'bg-emerald-600');
                } catch (err) {
                    await alertaVisualAtnx('Erro ao anexar arquivo', err.message || String(err));
                }
            };
            input.click();
        }

        async function removerAnexoManutencao(id, indice) {
            if (!await exigirPermissaoAtlas('anexar_arquivo', 'remover anexos')) return;
            const item = (state.manutencoesRede || []).find(reg => reg.id === id);
            if (!item) return;
            const anexos = normalizarAnexosManutencao(item.anexos);
            const idx = Number(indice);
            if (idx < 0 || idx >= anexos.length) return;
            const ok = await confirmarVisualAtnx('Remover anexo', 'Remover este link do Atlas? O arquivo no Drive de Documentação será preservado.', 'Remover');
            if (!ok) return;
            anexos.splice(idx, 1);
            await salvarPatchManutencaoRede(id, { anexos, updated_at: new Date().toISOString() });
        }

        async function editarTicketVoalleManutencao(id) {
            const item = (state.manutencoesRede || []).find(reg => reg.id === id);
            if (!item) return;
            const valor = await solicitarTextoAtnx({
                titulo: 'Ticket do Voalle',
                mensagem: 'Informe o número/protocolo do ticket aberto no Voalle.',
                label: 'Número do ticket',
                valor: item.voalle_ticket_id || item.protocolo || '',
                placeholder: 'Ex.: 123456',
                textoConfirmar: 'Salvar'
            });
            if (valor === null) return;
            const patch = {
                voalle_ticket_id: valor,
                protocolo: valor || item.protocolo || '',
                voalle_status: item.encerrado_no_voalle_em ? 'Encerrado manualmente' : (valor ? 'Aberto' : ''),
                updated_at: new Date().toISOString()
            };
            await salvarPatchManutencaoRede(id, patch);
        }

        async function alternarEncerramentoVoalleManual(id) {
            const item = (state.manutencoesRede || []).find(reg => reg.id === id);
            if (!item) return;
            const encerrado = !!item.voalle_encerrado_manual || !!item.encerrado_no_voalle_em;
            if (encerrado) {
                const okReabrir = await confirmarVisualAtnx('Reabrir controle de ticket', 'Marcar este ticket como ainda não encerrado no Voalle?', 'Reabrir');
                if (!okReabrir) return;
                const patch = { voalle_encerrado_manual: false, voalle_status: 'Aberto', encerrado_no_voalle_em: null, voalle_encerrado_por: '', updated_at: new Date().toISOString() };
                await salvarPatchManutencaoRede(id, patch);
                return;
            }
            const responsavel = await solicitarTextoAtnx({
                titulo: 'Encerramento manual no Voalle',
                mensagem: `Informe quem encerrou o ticket ${item.voalle_ticket_id || item.protocolo || ''} no Voalle.`,
                label: 'Responsável pelo encerramento',
                valor: item.voalle_encerrado_por || item.responsavel || '',
                placeholder: 'Nome do responsável',
                obrigatorio: true,
                textoConfirmar: 'Marcar encerrado'
            });
            if (!responsavel) return;
            const ok = await confirmarVisualAtnx('Confirmar encerramento', 'Confirmar que o ticket já foi encerrado manualmente no Voalle?', 'Confirmar');
            if (!ok) return;
            const patch = {
                voalle_encerrado_manual: true,
                voalle_status: 'Encerrado manualmente',
                encerrado_no_voalle_em: new Date().toISOString(),
                voalle_encerrado_por: responsavel,
                status: 'Concluída',
                data_conclusao: new Date().toISOString().slice(0, 10),
                updated_at: new Date().toISOString()
            };
            await salvarPatchManutencaoRede(id, patch);
        }

        async function salvarPatchManutencaoRede(id, patch) {
            if (!await exigirPermissaoAtlas('editar_registro', 'editar manutenção de redes')) return;
            const item = (state.manutencoesRede || []).find(reg => reg.id === id);
            if (!item) return;
            Object.assign(item, patch);
            try {
                if (supabaseClient && !state.manutencaoRedeErro) {
                    const { error } = await supabaseClient.from(ATLAS_MANUTENCAO_TABELA).update(patch).eq('id', id);
                    if (error) throw error;
                } else {
                    salvarManutencoesRedeLocal(state.manutencoesRede);
                }
                exibirStatusTemporario('Manutenção atualizada.', 'bg-emerald-600');
                renderManutencaoRedes();
            } catch (err) {
                state.manutencaoRedeErro = mensagemErroManutencaoRede(err);
                renderManutencaoRedes();
                await alertaVisualAtnx('Erro ao salvar manutenção', state.manutencaoRedeErro);
            }
        }

        function obterOpcoesManutencao(campo) {
            return [...new Set((state.manutencoesRede || []).map(item => item[campo]).filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        }

        function manutencoesRedeFiltradas() {
            const termo = String(state.termoPesquisa || '').trim().toLowerCase();
            const filtros = state.manutencaoRedeFiltros || {};
            return (state.manutencoesRede || []).filter(item => {
                if (filtros.regional && normalizarRegionalManutencao(item.regional) !== filtros.regional) return false;
                if (filtros.cidade && item.cidade !== filtros.cidade) return false;
                if (filtros.documentacao && normalizarDocumentacaoManutencao(item.documentacao_status) !== filtros.documentacao) return false;
                if (filtros.status && normalizarStatusManutencao(item.status) !== filtros.status) return false;
                if (filtros.prioridade && normalizarPrioridadeManutencao(item.prioridade) !== filtros.prioridade) return false;
                if (filtros.responsavel && item.responsavel !== filtros.responsavel) return false;
                if (filtros.tipo && item.tipo_manutencao !== filtros.tipo) return false;
                const dataBase = item.data_abertura || item.data_solicitacao || item.created_at || '';
                if (filtros.inicio && dataBase && String(dataBase).slice(0, 10) < filtros.inicio) return false;
                if (!termo) return true;
                const alvo = [
                    item.regional, item.cidade, item.localidade, item.local_referencia, item.tipo_manutencao, item.status,
                    item.prioridade, item.responsavel, item.ponto_rede, item.cto, item.ceo, item.poste,
                    item.geolocalizacao, item.diagrama_fusao, item.ticket_aberto_por, item.descricao, item.observacoes, item.protocolo, item.origem
                ].join(' ').toLowerCase();
                return alvo.includes(termo);
            });
        }

        function atualizarFiltroManutencao(campo, valor) {
            state.manutencaoRedeFiltros = { ...(state.manutencaoRedeFiltros || {}), [campo]: valor };
            renderManutencaoRedes();
        }

        function selecionarRegionalManutencao(regional) {
            state.manutencaoRedeFiltros = { regional, cidade: '', documentacao: '', status: '', prioridade: '', responsavel: '', tipo: '', inicio: '' };
            state.termoPesquisa = '';
            const search = document.getElementById('search-input');
            if (search) search.value = '';
            renderManutencaoRedes();
        }

        function limparFiltrosManutencao() {
            state.manutencaoRedeFiltros = { regional: '', cidade: '', documentacao: '', status: '', prioridade: '', responsavel: '', tipo: '', inicio: '' };
            state.termoPesquisa = '';
            const search = document.getElementById('search-input');
            if (search) search.value = '';
            renderManutencaoRedes();
        }

        function classeStatusManutencao(status) {
            const chave = normalizarStatusManutencao(status).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
            return `atlas-maint-status-${chave}`;
        }

        function renderSelectFiltroManutencao(campo, label, opcoes) {
            const atual = state.manutencaoRedeFiltros?.[campo] || '';
            return `<label><span>${escaparHtml(label)}</span><select onchange="atualizarFiltroManutencao('${campo}', this.value)"><option value="">Todos</option>${opcoes.map(op => `<option value="${escaparHtml(op)}" ${op === atual ? 'selected' : ''}>${escaparHtml(op)}</option>`).join('')}</select></label>`;
        }

        function renderAnexosManutencao(itemId, anexos) {
            const lista = normalizarAnexosManutencao(anexos);
            if (!lista.length) return '<span class="atlas-maint-no-attachment">Sem anexos no Drive.</span>';
            const chaveAnexos = atlasRegistrarAnexosVisualizador(`manutencao:${itemId}:anexos`, lista);
            return lista.map((anexo, indice) => {
                const nome = anexo.nome || `Anexo ${indice + 1}`;
                return `<span class="atlas-maint-attachment"><button type="button" onclick="atlasAbrirVisualizadorRegistrado('${escaparAtributoJs(chaveAnexos)}', ${indice}, event, 'Anexos da manutenção')">${escaparHtml(nome)}</button><button type="button" onclick="removerAnexoManutencao('${itemId}', ${indice})" title="Remover link do Atlas">×</button></span>`;
            }).join('');
        }

        function renderCardManutencao(item) {
            const status = normalizarStatusManutencao(item.status);
            const prioridade = normalizarPrioridadeManutencao(item.prioridade);
            const podeEditar = atlasTemPermissao('editar_registro');
            const podeExcluir = atlasTemPermissao('excluir_registro');
            const podeAnexar = atlasTemPermissao('anexar_arquivo');
            const finalizada = status === 'Concluída' || status === 'Cancelada';
            const ponto = item.ponto_rede || [item.cto, item.ceo, item.poste].filter(Boolean).join(' / ');
            const itemId = escaparAtributoJs(item.id);
            const ticket = item.voalle_ticket_id || item.protocolo || '';
            const regional = normalizarRegionalManutencao(item.regional);
            const docStatus = normalizarDocumentacaoManutencao(item.documentacao_status);
            const geogridStatus = item.geogrid_status || 'Pendente';
            const encerradoVoalle = !!item.voalle_encerrado_manual || !!item.encerrado_no_voalle_em;
            const opcoesDoc = ATLAS_MANUTENCAO_DOC_STATUS.map(op => `<option value="${escaparHtml(op)}" ${op === docStatus ? 'selected' : ''}>${escaparHtml(op)}</option>`).join('');
            const opcoesRegional = [''].concat(ATLAS_MANUTENCAO_REGIONAIS).map(op => `<option value="${escaparHtml(op)}" ${op === regional ? 'selected' : ''}>${escaparHtml(op || 'Sem regional')}</option>`).join('');
            const anexosHtml = renderAnexosManutencao(itemId, item.anexos);
            return `<article class="atlas-maint-card ${finalizada ? 'is-finalizada' : ''}">
                <div class="atlas-maint-card-head">
                    <div><strong>${escaparHtml(item.cidade || item.localidade || 'Sem cidade')}</strong><span>${escaparHtml(item.tipo_manutencao || item.tipo_problema || 'Manutenção')}${ticket ? ` · Ticket ${escaparHtml(ticket)}` : ''}</span></div>
                    <div class="atlas-maint-badge-wrap"><div class="atlas-maint-badges"><span class="atlas-maint-regional ${classeRegionalManutencao(regional)}">${escaparHtml(regional || 'Sem regional')}</span><span class="atlas-maint-doc ${classeDocumentacaoManutencao(docStatus)}">${escaparHtml(docStatus)}</span><span class="atlas-maint-status ${classeStatusManutencao(status)}">${escaparHtml(status)}</span><span class="atlas-maint-priority">${escaparHtml(prioridade)}</span></div>${podeExcluir ? `<button type="button" class="atlas-maint-danger-btn" onclick="excluirManutencaoRede('${itemId}')">Excluir</button>` : ''}</div>
                </div>
                <div class="atlas-maint-flow atlas-maint-flow-regional">
                    <label><span>Regional</span><select onchange="atualizarManutencaoRedeCampo('${itemId}', 'regional', this.value)" ${podeEditar ? '' : 'disabled'}>${opcoesRegional}</select></label>
                    <label><span>Documentação</span><select onchange="atualizarManutencaoRedeCampo('${itemId}', 'documentacao_status', this.value)" ${podeEditar ? '' : 'disabled'}>${opcoesDoc}</select></label>
                </div>
                <div class="atlas-maint-grid">
                    <div><span>Cidade</span><b>${escaparHtml(item.cidade || item.localidade || '-')}</b>${podeEditar ? `<button type="button" onclick="editarCampoManutencaoRede('${itemId}', 'cidade', 'Cidade', 'Ex.: João Pessoa')">Editar</button>` : ''}</div>
                    <div><span>Abertura</span><b>${formatarDataManutencao(item.data_abertura || item.data_solicitacao || item.created_at)}</b>${podeEditar ? `<input class="atlas-maint-date-input" type="date" value="${escaparHtml(String(item.data_abertura || item.data_solicitacao || '').slice(0, 10))}" onchange="atualizarManutencaoRedeCampo('${itemId}', 'data_abertura', this.value)">` : ''}</div>
                    <div><span>Aberto por</span><b>${escaparHtml(item.ticket_aberto_por || '-')}</b>${podeEditar ? `<button type="button" onclick="editarCampoManutencaoRede('${itemId}', 'ticket_aberto_por', 'Responsável por abrir o ticket', 'Ex.: Redes / NOC / Nome')">Editar</button>` : ''}</div>
                    <div><span>Responsável</span><b>${escaparHtml(item.responsavel || '-')}</b>${podeEditar ? `<button type="button" onclick="editarCampoManutencaoRede('${itemId}', 'responsavel', 'Responsável', 'Ex.: Documentação')">Editar</button>` : ''}</div>
                    <div><span>Local</span><b>${escaparHtml(item.local_referencia || item.local || '-')}</b>${podeEditar ? `<button type="button" onclick="editarCampoManutencaoRede('${itemId}', 'local_referencia', 'Local/referência', 'Ex.: Rua, bairro, POP')">Editar</button>` : ''}</div>
                    <div><span>Geolocalização</span><b>${escaparHtml(item.geolocalizacao || '-')}</b>${podeEditar ? `<button type="button" onclick="editarCampoManutencaoRede('${itemId}', 'geolocalizacao', 'Geolocalização', 'Ex.: -7.1153,-34.8610')">Editar</button>` : ''}</div>
                    <div><span>Ponto de rede</span><b>${escaparHtml(ponto || '-')}</b>${podeEditar ? `<button type="button" onclick="editarCampoManutencaoRede('${itemId}', 'ponto_rede', 'CTO/CEO/Poste/Ponto', 'Ex.: CTO 042 / Poste 18')">Editar</button>` : ''}</div>
                    <div><span>Diagrama de fusão</span><b>${escaparHtml(item.diagrama_fusao || '-')}</b>${podeEditar ? `<button type="button" onclick="editarCampoManutencaoRede('${itemId}', 'diagrama_fusao', 'Diagrama de fusão', 'Cole link ou referência')">Editar</button>` : ''}</div>
                    <div><span>Conclusão</span><b>${formatarDataManutencao(item.data_conclusao)}</b></div>
                    <div><span>Origem</span><b>${escaparHtml(item.origem || 'Forms / Planilha')}</b></div>
                </div>
                <div class="atlas-maint-flow">
                    ${podeEditar ? `<button type="button" onclick="editarCampoManutencaoRede('${itemId}', 'geogrid_status', 'Status no Geogrid', 'Ex.: Registrado / Não localizado')">Geogrid</button>` : '<span></span>'}
                    <div><span>Voalle</span><b>${encerradoVoalle ? `Encerrado por ${escaparHtml(item.voalle_encerrado_por || '-')}` : escaparHtml(ticket ? 'Pendente de encerramento' : 'Sem número informado')}</b></div>
                    ${podeEditar ? `<button type="button" onclick="editarTicketVoalleManutencao('${itemId}')">Editar ticket</button><button type="button" onclick="alternarEncerramentoVoalleManual('${itemId}')">${encerradoVoalle ? 'Reabrir Voalle' : 'Marcar encerrado'}</button>` : ''}
                </div>
                <div class="atlas-maint-evidence">
                    <span>Evidências</span>
                    <div><b>${escaparHtml(item.evidencias || 'Sem observação de evidência.')}</b><div class="atlas-maint-attachments">${anexosHtml}</div></div>
                    <div class="atlas-maint-evidence-actions">${podeAnexar ? `<button type="button" onclick="anexarArquivoManutencao('${itemId}')">Anexar arquivo</button>` : ''}${podeEditar ? `<button type="button" onclick="editarEvidenciasManutencao('${itemId}')">Editar texto</button>` : ''}</div>
                </div>
                <p>${escaparHtml(item.observacoes || item.descricao || 'Sem observações.')}</p>
            </article>`;
        }

        async function criarManutencaoRedeRapida() {
            if (!await exigirPermissaoAtlas('criar_registro', 'criar manutenção de redes')) return;
            const nova = {
                id: 'mnt-local-' + Date.now(),
                regional: '',
                cidade: 'Nova cidade',
                data_abertura: new Date().toISOString().slice(0, 10),
                tipo_manutencao: 'Ocorrência de rede',
                status: 'Aberta',
                prioridade: 'Média',
                responsavel: '',
                ticket_aberto_por: '',
                local_referencia: '',
                geolocalizacao: '',
                ponto_rede: '',
                diagrama_fusao: '',
                observacoes: '',
                voalle_ticket_id: '',
                voalle_status: 'Aberto',
                voalle_encerrado_manual: false,
                documentacao_status: 'Não documentado',
                geogrid_status: 'Pendente',
                evidencias: '',
                anexos: []
            };
            try {
                if (supabaseClient && !state.manutencaoRedeErro) {
                    const { error } = await supabaseClient.from(ATLAS_MANUTENCAO_TABELA).insert([nova]);
                    if (error) throw error;
                    await carregarManutencoesRede();
                    return;
                }
                throw new Error('modo local');
            } catch (err) {
                const lista = [nova, ...(state.manutencoesRede || lerManutencoesRedeLocal())];
                state.manutencoesRede = lista;
                salvarManutencoesRedeLocal(lista);
                renderManutencaoRedes();
            }
        }

        function renderManutencaoRedes() {
            atualizarVisibilidadeModulos();
            const painel = document.getElementById('painel-manutencao-redes');
            const titulo = document.getElementById('txt-nome-obra');
            if (!painel || !titulo) return;
            titulo.innerText = 'Documentação Rede Geral — Manutenção de Redes';
            document.getElementById('txt-grupo-ativo').innerHTML = '';
            const itens = state.manutencoesRede || [];
            const filtrados = manutencoesRedeFiltradas();
            const contar = status => itens.filter(item => normalizarStatusManutencao(item.status) === status).length;
            const contarDoc = valor => itens.filter(item => normalizarDocumentacaoManutencao(item.documentacao_status) === valor).length;
            const porCidade = obterOpcoesManutencao('cidade').slice(0, 5).map(cidade => `<span>${escaparHtml(cidade)} <b>${itens.filter(i => i.cidade === cidade).length}</b></span>`).join('');
            const regionais = ATLAS_MANUTENCAO_REGIONAIS.map(regional => {
                const lista = itens.filter(item => normalizarRegionalManutencao(item.regional) === regional);
                const doc = lista.filter(item => normalizarDocumentacaoManutencao(item.documentacao_status) === 'Documentado').length;
                const nao = lista.filter(item => normalizarDocumentacaoManutencao(item.documentacao_status) !== 'Documentado').length;
                const ativo = state.manutencaoRedeFiltros?.regional === regional;
                return `<button type="button" class="atlas-maint-regional-card ${classeRegionalManutencao(regional)} ${ativo ? 'is-active' : ''}" onclick="selecionarRegionalManutencao('${escaparAtributoJs(regional)}')" title="Ver chamados de ${escaparHtml(regional)}"><b>${escaparHtml(regional)}</b><strong>${lista.length}</strong><span class="atlas-maint-doc-ok">Documentado ${doc}</span><span class="atlas-maint-doc-no">Não documentado ${nao}</span></button>`;
            }).join('');
            const filtros = `<div class="atlas-maint-filters">
                ${renderSelectFiltroManutencao('regional', 'Regional', ATLAS_MANUTENCAO_REGIONAIS)}
                ${renderSelectFiltroManutencao('cidade', 'Cidade', obterOpcoesManutencao('cidade'))}
                ${renderSelectFiltroManutencao('documentacao', 'Documentação', ATLAS_MANUTENCAO_DOC_STATUS)}
                ${renderSelectFiltroManutencao('status', 'Status', ATLAS_MANUTENCAO_STATUS)}
                ${renderSelectFiltroManutencao('prioridade', 'Prioridade', ATLAS_MANUTENCAO_PRIORIDADES)}
                ${renderSelectFiltroManutencao('responsavel', 'Responsável', obterOpcoesManutencao('responsavel'))}
                ${renderSelectFiltroManutencao('tipo', 'Tipo', obterOpcoesManutencao('tipo_manutencao'))}
                <label><span>Início</span><input type="date" value="${escaparHtml(state.manutencaoRedeFiltros?.inicio || '')}" onchange="atualizarFiltroManutencao('inicio', this.value)"></label>
                <button onclick="limparFiltrosManutencao()">Limpar</button>
            </div>`;
            painel.innerHTML = `<div class="atlas-maint-shell">
                <div class="atlas-module-titlebar">
                    <div><div class="atlas-module-kicker">Documentação Rede Geral</div><h2>Manutenção de Redes</h2><p>Controle operacional de ocorrências, chamados e anexos no mesmo Drive de documentação.</p></div>
                    <div class="atlas-module-actions">${atlasTemPermissao('criar_registro') ? '<button class="atlas-module-pill" onclick="criarManutencaoRedeRapida()">+ Nova manutenção</button>' : ''}<button class="atlas-action-btn" onclick="carregarManutencoesRede()">Atualizar</button></div>
                </div>
                ${state.manutencaoRedeErro ? `<div class="atlas-module-warning">${escaparHtml(state.manutencaoRedeErro)}</div>` : ''}
                ${filtros}
                <div class="atlas-maint-kpis">
                    <div><strong>${itens.length}</strong><span>Total</span></div>
                    <div><strong>${contarDoc('Documentado')}</strong><span>Documentadas</span></div>
                    <div><strong>${contarDoc('Não documentado')}</strong><span>Não documentadas</span></div>
                    <div><strong>${contar('Aberta')}</strong><span>Abertas</span></div>
                    <div><strong>${contar('Em análise')}</strong><span>Em análise</span></div>
                    <div><strong>${contar('Em execução')}</strong><span>Em execução</span></div>
                </div>
                <div class="atlas-maint-regional-board">${regionais}</div>
                <div class="atlas-maint-insights"><div><b>Por cidade</b>${porCidade || '<span>Sem dados</span>'}</div><div><b>Exibindo</b><span>${filtrados.length} de ${itens.length} registros</span></div></div>
                <div class="atlas-maint-list-head"><b>Chamados</b><span>${filtrados.length} registro(s)</span></div>
                <div class="atlas-maint-list">${state.manutencaoRedeCarregando ? '<div class="atlas-module-empty-row">Carregando manutenções...</div>' : filtrados.length ? filtrados.map(renderCardManutencao).join('') : '<div class="atlas-module-empty-row">Nenhuma manutenção encontrada.</div>'}</div>
            </div>`;
        }

        function renderExpansoes() {
            const __atlasRender = iniciarRenderPreservandoEstadoVisual();
            try {
            atualizarVisibilidadeModulos();
            const painel = document.getElementById('painel-expansoes');
            const titulo = document.getElementById('txt-nome-obra');
            if (!painel || !titulo) return;
            titulo.innerText = 'Expansões';
            document.getElementById('txt-grupo-ativo').innerHTML = '';

            if (state.expansoesCarregando) {
                painel.innerHTML = `<div class="atlas-v13-card atlas-v13-empty">Carregando expansões...</div>`;
                return;
            }
            if (state.expansoesErro) {
                painel.innerHTML = `<div class="atlas-v13-card atlas-v13-setup"><h2>Expansões aguardando SQL</h2><p>${escaparHtml(state.expansoesErro)}</p><p>Rode o SQL da V1.3 no Supabase para criar os campos da planilha.</p></div>`;
                return;
            }
            const termo = String(state.termoPesquisa || '').trim().toLowerCase();
            const projetos = state.expansoes || [];
            const projetosManuais = projetos.filter(ehProjetoManualExpansao);
            const elementosObras = projetos.filter(ehElementoObraExpansao);
            const nomesObras = new Set(elementosObras.map(obterObraNomeExpansao).filter(Boolean));
            const idsManuais = new Set(projetosManuais.map(p => p.id));
            const idsObras = new Set(elementosObras.map(p => p.id));
            const subitemsManuais = (state.expansoesSubitems || []).filter(sub => idsManuais.has(sub.expansao_id));
            const subitemsObras = (state.expansoesSubitems || []).filter(sub => idsObras.has(sub.expansao_id));
            const totais = { grupos: ATLAS_EXP_GRUPOS.length, projetos: projetosManuais.length, obras: nomesObras.size, elementosObras: elementosObras.length, subelementos: subitemsManuais.length, subelementosObras: subitemsObras.length };
            const toolbar = `<div class="atlas-exp-toolbar atlas-exp-toolbar-minimal">
                <div><div class="atlas-exp-kicker">Gestão de expansões</div><h2>Expansões</h2><p>Projetos, Gantt e Obras.</p></div>
                <div class="atlas-exp-toolbar-right">
                    <div class="atlas-exp-summary"><span>${totais.grupos} grupos</span><span>${totais.projetos} projetos</span><span>${totais.obras} obras</span><span>${totais.subelementos + totais.subelementosObras} subelementos</span></div>
                    <div class="atlas-exp-drive-actions">
                        <button type="button" onclick="abrirDriveExpansoes(event)" title="Abrir pasta de Expansões no Google Drive">Drive de Expansões</button>
                        <button type="button" onclick="copiarLinkDriveExpansoes(event)" title="Copiar link do Drive de Expansões">Copiar link</button>
                    </div>
                </div>
            </div>`;
            if (state.expansoesVisualizacao !== 'gantt') {
                state.expansoesGanttFullscreen = false;
                document.body.classList.remove('atlas-exp-gantt-is-fullscreen');
            }
            const board = state.expansoesVisualizacao === 'gantt'
                ? renderGanttExpansoes(projetosManuais, termo)
                : state.expansoesVisualizacao === 'obras'
                    ? renderExpansoesObras(elementosObras, termo)
                    : `<div class="atlas-exp-board">${renderBarraMoverProjetosExpansoes()}${ATLAS_EXP_GRUPOS.map(grupo => renderGrupoExpansao(grupo, projetosManuais.filter(p => (p.grupo || 'em_progresso') === grupo.id), termo)).join('')}</div>`;
            painel.innerHTML = `${toolbar}${board}`;
            if (state.expansoesVisualizacao === 'obras') {
                setTimeout(() => {
                    atualizarSelecaoTodosObrasExpansoesVisual();
                    atualizarSelecaoGruposObrasExpansoesVisual();
                    inicializarScrollHorizontalExpansoesObras();
                }, 0);
            }
            } finally {
                finalizarRenderPreservandoEstadoVisual(__atlasRender);
            }
        }

        function criarSelectAtnx({ label, name, value = '', options = [], required = false }) {
            const nomeCampo = String(name || '');
            const valorAtual = nomeCampo === 'empresa_fusao' || nomeCampo === 'empresa_lancamento' ? normalizarEmpresaExpansao(value) : (value || '');
            let classeExtra = '';
            let eventoExtra = '';
            if (nomeCampo === 'status') {
                classeExtra = ` atlas-exp-status-select ${classeStatusExpansao(valorAtual)}`;
                eventoExtra = ' onchange="atualizarClasseSelectStatusExpansao(this)"';
            } else if (ATLAS_EXP_EMPRESA_FIELDS.has(nomeCampo)) {
                classeExtra = ` atlas-exp-empresa-select ${classeEmpresaExpansao(valorAtual)}`;
                eventoExtra = ' onchange="atualizarClasseSelectEmpresaExpansao(this)"';
            }
            return `<label class="atnx-form-field"><span>${escaparHtml(label)}</span><select class="atlas-exp-form-select${classeExtra}" name="${escaparHtml(name)}" ${required ? 'required' : ''}${eventoExtra}>${options.map(op => {
                const val = typeof op === 'string' ? op : op.value;
                const txt = typeof op === 'string' ? op : op.label;
                const valorOpcao = ATLAS_EXP_EMPRESA_FIELDS.has(nomeCampo) ? normalizarEmpresaExpansao(val) : val;
                return `<option value="${escaparHtml(valorOpcao)}" ${String(valorAtual || '') === String(valorOpcao) ? 'selected' : ''}>${escaparHtml(txt || (nomeCampo === 'status' ? '-' : ''))}</option>`;
            }).join('')}</select></label>`;
        }

        function obterExpansaoEditandoInline() {
            if (!state.expansaoFormularioEditandoId) return null;
            return (state.expansoes || []).find(item => item.id === state.expansaoFormularioEditandoId) || null;
        }

        function renderFormularioExpansaoInline() {
            if (!state.expansaoFormularioAberto) {
                return `<div class="atlas-exp-inline-hint">
                    <div><strong>Cadastro rápido de expansões</strong><span>Use o botão “Preencher Projeto” para abrir os campos diretamente nesta tela.</span></div>
                    <button type="button" onclick="alternarFormularioExpansaoInline()">+ Preencher projeto</button>
                </div>`;
            }
            const itemAtual = obterExpansaoEditandoInline();
            const editando = !!itemAtual;
            return `<section class="atlas-exp-inline-form-card" id="formulario-expansao-inline-card">
                <div class="atlas-exp-inline-form-head">
                    <div>
                        <div class="atlas-exp-kicker">${editando ? 'Editando expansão' : 'Novo cadastro'}</div>
                        <h3>${editando ? 'Editar projeto de expansão' : 'Preencher projeto de expansão'}</h3>
                        <p>Campos baseados na planilha EXPANSÕES. O preenchimento acontece dentro da própria tela para evitar janelas grandes.</p>
                    </div>
                    <button type="button" class="atlas-exp-inline-close" onclick="cancelarFormularioExpansaoInline()">Fechar</button>
                </div>
                <form class="atnx-admin-form atlas-exp-inline-form" id="form-expansao-inline" onsubmit="salvarExpansaoInline(event)">
                    <input type="hidden" name="id" value="${escaparHtml(itemAtual?.id || '')}">
                    <div class="atnx-form-grid atlas-exp-inline-form-grid">
                        ${criarInputAdmin({ label: 'Elemento', name: 'nome', value: valorTextoAdmin(itemAtual?.nome), required: true })}
                        ${criarSelectAtnx({ label: 'Grupo', name: 'grupo', value: itemAtual?.grupo || 'em_progresso', options: ATLAS_EXP_GRUPOS.map(g => ({ value: g.id, label: g.titulo })) })}
                        ${criarInputAdmin({ label: 'Subelementos', name: 'subelementos', type: 'number', value: normalizarNumeroAdmin(itemAtual?.subelementos), min: '0' })}
                        ${criarCampoPeriodoDuracaoCompletaExpansao({ label: 'Duração Completa', name: 'duracao_completa', value: itemAtual?.duracao_completa })}
                        ${criarInputAdmin({ label: 'Data de Conclusão', name: 'data_conclusao', type: 'date', value: valorDataAdmin(itemAtual?.data_conclusao, '') })}
                        ${criarInputAdmin({ label: 'duração do lançamento', name: 'duracao_lancamento', type: 'number', value: itemAtual?.duracao_lancamento ?? '', min: '0', step: '0.001' })}
                        ${criarInputAdmin({ label: 'duração da fusão', name: 'duracao_fusao', type: 'number', value: itemAtual?.duracao_fusao ?? '', min: '0', step: '0.001' })}
                        ${criarSelectAtnx({ label: 'Status', name: 'status', value: itemAtual?.status || '', options: ['', 'Em Progresso', 'Parado', 'Concluído', 'Inviável'] })}
                        ${criarSelectAtnx({ label: 'Empresa Fusão', name: 'empresa_fusao', value: normalizarEmpresaExpansao(itemAtual?.empresa_fusao), options: ATLAS_EXP_EMPRESA_OPTIONS })}
                        ${criarSelectAtnx({ label: 'Empresa Lançamento', name: 'empresa_lancamento', value: normalizarEmpresaExpansao(itemAtual?.empresa_lancamento), options: ATLAS_EXP_EMPRESA_OPTIONS })}
                        ${criarInputAdmin({ label: "Qtde. de CTO'S", name: 'qtde_ctos', type: 'number', value: itemAtual?.qtde_ctos ?? '', min: '0' })}
                        ${criarInputAdmin({ label: 'Metragem de Cabo', name: 'metragem_cabo', type: 'number', value: itemAtual?.metragem_cabo ?? '', min: '0' })}
                        ${criarInputAdmin({ label: "Qtde de CEO's", name: 'qtde_ceos', type: 'number', value: itemAtual?.qtde_ceos ?? '', min: '0' })}
                        ${criarInputAdmin({ label: 'Imagens', name: 'imagens', value: valorTextoAdmin(itemAtual?.imagens), placeholder: 'Drive de Expansões / URL' })}
                        ${criarInputAdmin({ label: 'Rótulo', name: 'rotulo', value: valorTextoAdmin(itemAtual?.rotulo) })}
                        ${criarInputAdmin({ label: 'NOVOS PROJETOS', name: 'novos_projetos', value: valorTextoAdmin(itemAtual?.novos_projetos) })}
                        ${criarInputAdmin({ label: 'duração da cto', name: 'duracao_cto', type: 'number', value: itemAtual?.duracao_cto ?? '', min: '0', step: '0.001' })}
                        ${criarInputAdmin({ label: 'duração da ceo', name: 'duracao_ceo', type: 'number', value: itemAtual?.duracao_ceo ?? '', min: '0', step: '0.001' })}
                        ${criarInputAdmin({ label: 'Equipes Lanç.', name: 'equipes_lancamento', type: 'number', value: itemAtual?.equipes_lancamento ?? '', min: '0' })}
                        ${criarInputAdmin({ label: 'Equipes - Fusão', name: 'equipes_fusao', type: 'number', value: itemAtual?.equipes_fusao ?? '', min: '0' })}
                        ${criarInputAdmin({ label: 'Dependência', name: 'dependencia', value: valorTextoAdmin(itemAtual?.dependencia) })}
                        ${criarInputAdmin({ label: 'Números', name: 'numeros', value: valorTextoAdmin(itemAtual?.numeros) })}
                        ${criarInputAdmin({ label: 'KMZ', name: 'kmz', value: valorTextoAdmin(itemAtual?.kmz), placeholder: 'Link do KMZ' })}
                        ${criarInputAdmin({ label: 'Lista de Materiais', name: 'lista_materiais', value: valorTextoAdmin(itemAtual?.lista_materiais), placeholder: 'Link da lista' })}
                    </div>
                    <div class="atnx-form-error" data-error></div>
                    <div class="atlas-exp-inline-form-actions">
                        <button type="button" class="atnx-btn-secondary" onclick="cancelarFormularioExpansaoInline()">Cancelar</button>
                        <button type="submit" class="atnx-btn-primary">${editando ? 'Salvar alterações' : 'Cadastrar projeto'}</button>
                    </div>
                </form>
            </section>`;
        }

        function focarFormularioExpansaoInline() {
            setTimeout(() => {
                const card = document.getElementById('formulario-expansao-inline-card');
                card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                card?.querySelector('[name="nome"]')?.focus();
            }, 60);
        }

        function alternarFormularioExpansaoInline() {
            abrirCadastroExpansao();
        }

        function cancelarFormularioExpansaoInline() {
            state.expansaoFormularioAberto = false;
            state.expansaoFormularioEditandoId = null;
            renderExpansoes();
        }

        function montarPayloadExpansaoDoFormulario(form) {
            const fd = new FormData(form);
            const nome = valorTextoAdmin(fd.get('nome'));
            if (!nome) throw new Error('Informe o nome do projeto.');
            const num = key => {
                const raw = fd.get(key);
                return raw === '' || raw === null ? null : Number(String(raw).replace(',', '.'));
            };
            const payload = {
                nome,
                grupo: valorTextoAdmin(fd.get('grupo')) || 'em_progresso',
                subelementos: normalizarNumeroAdmin(fd.get('subelementos')),
                duracao_completa: normalizarDuracaoCompletaExpansao(fd.get('duracao_completa')) || null,
                data_conclusao: valorTextoAdmin(fd.get('data_conclusao')) || null,
                duracao_lancamento: num('duracao_lancamento'),
                duracao_fusao: num('duracao_fusao'),
                status: valorTextoAdmin(fd.get('status')) || null,
                empresa_fusao: normalizarEmpresaExpansao(fd.get('empresa_fusao')) || null,
                empresa_lancamento: normalizarEmpresaExpansao(fd.get('empresa_lancamento')) || null,
                qtde_ctos: num('qtde_ctos'),
                metragem_cabo: num('metragem_cabo'),
                qtde_ceos: num('qtde_ceos'),
                imagens: valorTextoAdmin(fd.get('imagens')) || null,
                rotulo: valorTextoAdmin(fd.get('rotulo')) || null,
                novos_projetos: valorTextoAdmin(fd.get('novos_projetos')) || null,
                duracao_cto: num('duracao_cto'),
                duracao_ceo: num('duracao_ceo'),
                equipes_lancamento: num('equipes_lancamento'),
                equipes_fusao: num('equipes_fusao'),
                dependencia: valorTextoAdmin(fd.get('dependencia')) || null,
                numeros: valorTextoAdmin(fd.get('numeros')) || null,
                kmz: valorTextoAdmin(fd.get('kmz')) || null,
                lista_materiais: valorTextoAdmin(fd.get('lista_materiais')) || null,
                updated_at: new Date().toISOString()
            };
            return aplicarGrupoAutomaticoExpansaoPorStatus(payload);
        }

        async function salvarExpansaoInline(event) {
            event.preventDefault();
            const form = event.currentTarget;
            const erro = form.querySelector('[data-error]');
            if (erro) erro.textContent = '';
            try {
                const payload = montarPayloadExpansaoDoFormulario(form);
                const idEditando = state.expansaoFormularioEditandoId;
                if (idEditando) {
                    const item = (state.expansoes || []).find(p => p.id === idEditando);
                    const { error } = await supabaseClient.from('atlas_expansoes').update(payload).eq('id', idEditando);
                    if (error) throw error;
                    await registrarAuditoria('edição', 'expansao', idEditando, payload.nome, 'projeto', item?.nome || '', payload.nome, 'Projeto de expansão editado');
                    exibirStatusTemporario('✅ Expansão atualizada.', 'bg-emerald-600');
                } else {
                    const id = `exp-${Date.now()}`;
                    const { error } = await supabaseClient.from('atlas_expansoes').insert([{ id, ...payload }]);
                    if (error) throw error;
                    await registrarAuditoria('criação', 'expansao', id, payload.nome, 'projeto', '', payload.nome, 'Projeto de expansão criado');
                    exibirStatusTemporario('✅ Projeto de expansão cadastrado.', 'bg-emerald-600');
                }
                state.expansaoFormularioAberto = false;
                state.expansaoFormularioEditandoId = null;
                await carregarExpansoes();
            } catch (err) {
                if (erro) erro.textContent = err.message || String(err);
                else await alertaVisualAtnx('Erro ao salvar expansão', err.message || String(err));
            }
        }

        function abrirFormularioExpansao(itemAtual = null) {
            return new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.className = 'atnx-modal-overlay';
                const editando = !!itemAtual;
                overlay.innerHTML = `<div class="atnx-modal-card atnx-modal-card-wide" role="dialog" aria-modal="true">
                    <div class="atnx-modal-header"><div><div class="atnx-modal-title">${editando ? 'Editar expansão' : 'Novo projeto de expansão'}</div><div class="atnx-modal-subtitle">Campos baseados na planilha EXPANSÕES</div></div><button type="button" class="atnx-modal-close" data-cancel>✕</button></div>
                    <form class="atnx-admin-form" id="form-expansao">
                        <div class="atnx-form-grid">
                            ${criarInputAdmin({ label: 'Elemento', name: 'nome', value: valorTextoAdmin(itemAtual?.nome), required: true })}
                            ${criarSelectAtnx({ label: 'Grupo', name: 'grupo', value: itemAtual?.grupo || 'em_progresso', options: ATLAS_EXP_GRUPOS.map(g => ({ value: g.id, label: g.titulo })) })}
                            ${criarInputAdmin({ label: 'Subelementos', name: 'subelementos', type: 'number', value: normalizarNumeroAdmin(itemAtual?.subelementos), min: '0' })}
                            ${criarCampoPeriodoDuracaoCompletaExpansao({ label: 'Duração Completa', name: 'duracao_completa', value: itemAtual?.duracao_completa })}
                            ${criarInputAdmin({ label: 'Data de Conclusão', name: 'data_conclusao', type: 'date', value: valorDataAdmin(itemAtual?.data_conclusao, '') })}
                            ${criarInputAdmin({ label: 'duração do lançamento', name: 'duracao_lancamento', type: 'number', value: itemAtual?.duracao_lancamento ?? '', min: '0' })}
                            ${criarInputAdmin({ label: 'duração da fusão', name: 'duracao_fusao', type: 'number', value: itemAtual?.duracao_fusao ?? '', min: '0' })}
                            ${criarSelectAtnx({ label: 'Status', name: 'status', value: itemAtual?.status || '', options: ['', 'Em Progresso', 'Parado', 'Concluído', 'Inviável'] })}
                            ${criarSelectAtnx({ label: 'Empresa Fusão', name: 'empresa_fusao', value: normalizarEmpresaExpansao(itemAtual?.empresa_fusao), options: ATLAS_EXP_EMPRESA_OPTIONS })}
                            ${criarSelectAtnx({ label: 'Empresa Lançamento', name: 'empresa_lancamento', value: normalizarEmpresaExpansao(itemAtual?.empresa_lancamento), options: ATLAS_EXP_EMPRESA_OPTIONS })}
                            ${criarInputAdmin({ label: "Qtde. de CTO'S", name: 'qtde_ctos', type: 'number', value: itemAtual?.qtde_ctos ?? '', min: '0' })}
                            ${criarInputAdmin({ label: 'Metragem de Cabo', name: 'metragem_cabo', type: 'number', value: itemAtual?.metragem_cabo ?? '', min: '0' })}
                            ${criarInputAdmin({ label: "Qtde de CEO's", name: 'qtde_ceos', type: 'number', value: itemAtual?.qtde_ceos ?? '', min: '0' })}
                            ${criarInputAdmin({ label: 'Imagens', name: 'imagens', value: valorTextoAdmin(itemAtual?.imagens), placeholder: 'Drive de Expansões / URL' })}
                            ${criarInputAdmin({ label: 'Rótulo', name: 'rotulo', value: valorTextoAdmin(itemAtual?.rotulo) })}
                            ${criarInputAdmin({ label: 'NOVOS PROJETOS', name: 'novos_projetos', value: valorTextoAdmin(itemAtual?.novos_projetos) })}
                            ${criarInputAdmin({ label: 'duração da cto', name: 'duracao_cto', type: 'number', value: itemAtual?.duracao_cto ?? '', min: '0' })}
                            ${criarInputAdmin({ label: 'duração da ceo', name: 'duracao_ceo', type: 'number', value: itemAtual?.duracao_ceo ?? '', min: '0' })}
                            ${criarInputAdmin({ label: 'Equipes Lanç.', name: 'equipes_lancamento', type: 'number', value: itemAtual?.equipes_lancamento ?? '', min: '0' })}
                            ${criarInputAdmin({ label: 'Equipes - Fusão', name: 'equipes_fusao', type: 'number', value: itemAtual?.equipes_fusao ?? '', min: '0' })}
                            ${criarInputAdmin({ label: 'Dependência', name: 'dependencia', value: valorTextoAdmin(itemAtual?.dependencia) })}
                            ${criarInputAdmin({ label: 'Números', name: 'numeros', value: valorTextoAdmin(itemAtual?.numeros) })}
                            ${criarInputAdmin({ label: 'KMZ', name: 'kmz', value: valorTextoAdmin(itemAtual?.kmz), placeholder: 'Link do KMZ' })}
                            ${criarInputAdmin({ label: 'Lista de Materiais', name: 'lista_materiais', value: valorTextoAdmin(itemAtual?.lista_materiais), placeholder: 'Link da lista' })}
                        </div>
                        <div class="atnx-form-error" data-error></div>
                        <div class="atnx-modal-actions"><button type="button" class="atnx-btn-secondary" data-cancel>Cancelar</button><button type="submit" class="atnx-btn-primary">${editando ? 'Salvar alterações' : 'Cadastrar projeto'}</button></div>
                    </form>
                </div>`;
                document.body.appendChild(overlay);
                const form = overlay.querySelector('#form-expansao');
                const erro = overlay.querySelector('[data-error]');
                const cancelar = () => { removerModalAtnx(overlay); resolve(null); };
                overlay.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', cancelar));
                overlay.addEventListener('click', e => { if (e.target === overlay) cancelar(); });
                form.addEventListener('submit', e => {
                    e.preventDefault();
                    const fd = new FormData(form);
                    const nome = valorTextoAdmin(fd.get('nome'));
                    if (!nome) { erro.textContent = 'Informe o nome do projeto.'; return; }
                    const num = key => { const raw = fd.get(key); return raw === '' || raw === null ? null : Number(String(raw).replace(',', '.')); };
                    const payload = {
                        nome,
                        grupo: valorTextoAdmin(fd.get('grupo')) || 'em_progresso',
                        subelementos: normalizarNumeroAdmin(fd.get('subelementos')),
                        duracao_completa: normalizarDuracaoCompletaExpansao(fd.get('duracao_completa')) || null,
                        data_conclusao: valorTextoAdmin(fd.get('data_conclusao')) || null,
                        duracao_lancamento: num('duracao_lancamento'),
                        duracao_fusao: num('duracao_fusao'),
                        status: valorTextoAdmin(fd.get('status')) || null,
                        empresa_fusao: normalizarEmpresaExpansao(fd.get('empresa_fusao')) || null,
                        empresa_lancamento: normalizarEmpresaExpansao(fd.get('empresa_lancamento')) || null,
                        qtde_ctos: num('qtde_ctos'),
                        metragem_cabo: num('metragem_cabo'),
                        qtde_ceos: num('qtde_ceos'),
                        imagens: valorTextoAdmin(fd.get('imagens')) || null,
                        rotulo: valorTextoAdmin(fd.get('rotulo')) || null,
                        novos_projetos: valorTextoAdmin(fd.get('novos_projetos')) || null,
                        duracao_cto: num('duracao_cto'),
                        duracao_ceo: num('duracao_ceo'),
                        equipes_lancamento: num('equipes_lancamento'),
                        equipes_fusao: num('equipes_fusao'),
                        dependencia: valorTextoAdmin(fd.get('dependencia')) || null,
                        numeros: valorTextoAdmin(fd.get('numeros')) || null,
                        kmz: valorTextoAdmin(fd.get('kmz')) || null,
                        lista_materiais: valorTextoAdmin(fd.get('lista_materiais')) || null,
                                updated_at: new Date().toISOString()
                    };
                    aplicarGrupoAutomaticoExpansaoPorStatus(payload);
                    removerModalAtnx(overlay);
                    resolve(payload);
                });
                setTimeout(() => form.querySelector('[name="nome"]')?.focus(), 40);
            });
        }

        function coletarCamposLinhaNovaExpansao(grupoId) {
            const linha = document.querySelector(`[data-new-exp-grupo="${CSS.escape(grupoId)}"]`);
            if (!linha) throw new Error('Linha de cadastro não encontrada.');
            const payload = { grupo: grupoId, updated_at: new Date().toISOString() };
            linha.querySelectorAll('[data-new-exp-campo]').forEach(el => {
                const campo = el.getAttribute('data-new-exp-campo');
                payload[campo] = normalizarValorCampoExpansao(campo, el.value);
            });
            payload.nome = valorTextoAdmin(payload.nome);
            if (!payload.nome) throw new Error('Informe o nome do projeto no campo Elemento.');
            if (!payload.status) payload.status = 'Em Progresso';
            if (payload.subelementos === null) payload.subelementos = 0;
            aplicarGrupoAutomaticoExpansaoPorStatus(payload);
            return payload;
        }

        function cancelarNovaExpansaoLinha() {
            state.expansaoLinhaNovaGrupo = null;
            renderExpansoes();
        }

        async function salvarNovaExpansaoLinha(grupoId) {
            try {
                const payload = coletarCamposLinhaNovaExpansao(grupoId);
                const id = `exp-${Date.now()}`;
                const { error } = await supabaseClient.from('atlas_expansoes').insert([{ id, ...payload }]);
                if (error) throw error;
                await registrarAuditoria('criação', 'expansao', id, payload.nome, 'projeto', '', payload.nome, 'Projeto de expansão criado direto na tabela');
                state.expansaoLinhaNovaGrupo = null;
                exibirStatusTemporario('✅ Projeto cadastrado.', 'bg-emerald-600');
                await carregarExpansoes();
            } catch (err) {
                await alertaVisualAtnx('Erro ao cadastrar projeto', err.message || String(err));
            }
        }

        async function abrirCadastroExpansao(grupoId = 'em_progresso') {
            state.expansaoFormularioAberto = false;
            state.expansaoFormularioEditandoId = null;
            state.expansaoLinhaNovaGrupo = grupoId || 'em_progresso';
            state.expansoesAbertas[state.expansaoLinhaNovaGrupo] = true;
            renderExpansoes();
            setTimeout(() => {
                const linha = document.querySelector(`[data-new-exp-grupo="${CSS.escape(state.expansaoLinhaNovaGrupo)}"]`);
                linha?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                linha?.querySelector('[data-new-exp-campo="nome"]')?.focus();
            }, 60);
        }

        async function editarExpansao(id) {
            const item = (state.expansoes || []).find(p => p.id === id);
            if (!item) return;
            state.expansoesProjetosAbertos[id] = true;
            renderExpansoes();
            setTimeout(() => document.querySelector(`[data-exp-id="${CSS.escape(id)}"][data-exp-campo="nome"]`)?.focus(), 60);
        }

        async function excluirExpansao(id) {
            const item = (state.expansoes || []).find(p => p.id === id);
            if (!item) return;
            const subitems = obterSubitemsDaExpansao(id);
            const totalImagens = coletarMidiasEntidadeExpansao('projeto', item).length;
            const detalhe = `${subitems.length} subelemento(s) e ${totalImagens} arquivo(s)/imagem(ns)`;
            const confirmado = await confirmarVisualAtnx(
                'Remover expansão',
                `Remover ${item.nome}?

O projeto será removido do sistema e a pasta/imagens correspondentes serão enviadas para a lixeira no Google Drive.

Itens afetados: ${detalhe}.`,
                'Remover'
            );
            if (!confirmado) return;
            try {
                exibirStatusTemporario('🗑️ Removendo expansão e limpando Google Drive...', 'bg-[#0073ea]');
                await excluirEntidadeExpansaoNoGoogleDrive('projeto', item);

                const { error } = await supabaseClient.from('atlas_expansoes').delete().eq('id', id);
                if (error) throw error;
                await registrarAuditoria('remoção', 'expansao', id, item.nome, 'projeto', item.nome, '', 'Projeto de expansão removido do sistema; pasta/imagens enviadas para a lixeira no Google Drive');
                exibirStatusTemporario('✅ Expansão removida do sistema e do Google Drive.', 'bg-emerald-600');
                await carregarExpansoes();
            } catch (err) {
                console.error(err);
                await alertaVisualAtnx('Erro ao remover expansão', (err.message || String(err)) + '\n\nA remoção no sistema foi interrompida para evitar deixar arquivos órfãos no Google Drive.');
            }
        }


        function limparPayloadDuplicacaoExpansao(item, camposPermitidos) {
            const payload = {};
            camposPermitidos.forEach(campo => {
                if (Object.prototype.hasOwnProperty.call(item || {}, campo)) {
                    payload[campo] = item[campo] === undefined ? null : item[campo];
                }
            });
            payload.updated_at = new Date().toISOString();
            return payload;
        }

        function nomeDuplicadoExpansao(nome, tipo = 'cópia') {
            const base = valorTextoAdmin(nome) || (tipo === 'subelemento' ? 'Subelemento' : 'Elemento');
            return `${base} - cópia`;
        }

        async function duplicarExpansao(id) {
            const item = (state.expansoes || []).find(p => p.id === id);
            if (!item) return;
            const subitemsOriginais = obterSubitemsDaExpansao(id);
            const novoId = `exp-${Date.now()}`;
            const camposProjeto = [
                'grupo', 'nome', 'subelementos', 'duracao_completa', 'data_conclusao', 'duracao_lancamento', 'duracao_fusao',
                'status', 'empresa_fusao', 'empresa_lancamento', 'qtde_ctos', 'metragem_cabo', 'qtde_ceos', 'imagens',
                'rotulo', 'novos_projetos', 'duracao_cto', 'duracao_ceo', 'equipes_lancamento', 'equipes_fusao',
                'dependencia', 'numeros', 'kmz', 'lista_materiais', 'obra_nome', 'fase', 'total_projetado', 'total_lancado',
                'responsavel', 'data_inicio', 'data_previsao_final', 'validacao', 'slot', 'portas', 'fotos_olt'
            ];
            const payloadProjeto = limparPayloadDuplicacaoExpansao(item, camposProjeto);
            payloadProjeto.id = novoId;
            payloadProjeto.nome = nomeDuplicadoExpansao(item.nome, 'elemento');
            payloadProjeto.subelementos = subitemsOriginais.length || Number(item.subelementos || 0) || 0;
            const camposSub = [
                'nome', 'status', 'timeline_inicio', 'timeline_fim', 'duracao', 'equipe', 'responsavel', 'imagens', 'pessoas',
                'depende_de', 'tipo_cabo', 'projetado', 'lancado', 'fotos', 'diagrama_fusao', 'diferenca', 'validacao', 'data'
            ];
            const agoraBase = Date.now();
            const payloadSubs = subitemsOriginais.map((sub, indice) => {
                const novoSub = limparPayloadDuplicacaoExpansao(sub, camposSub);
                novoSub.id = `expsub-${agoraBase}-${indice}`;
                novoSub.expansao_id = novoId;
                novoSub.nome = nomeDuplicadoExpansao(sub.nome, 'subelemento');
                return novoSub;
            });
            try {
                exibirStatusTemporario('⧉ Duplicando elemento...', 'bg-[#0073ea]');
                const { error } = await supabaseClient.from('atlas_expansoes').insert([payloadProjeto]);
                if (error) throw error;
                if (payloadSubs.length) {
                    const { error: errSubs } = await supabaseClient.from('atlas_expansoes_subitems').insert(payloadSubs);
                    if (errSubs) throw errSubs;
                }
                state.expansoes = [...(state.expansoes || []), payloadProjeto];
                state.expansoesSubitems = [...(state.expansoesSubitems || []), ...payloadSubs];
                state.expansoesAbertas[payloadProjeto.grupo || 'em_progresso'] = true;
                state.expansoesProjetosAbertos[novoId] = payloadSubs.length > 0;
                await registrarAuditoria('criação', 'expansao', novoId, payloadProjeto.nome, 'duplicação', item.nome || '', payloadProjeto.nome, `Elemento duplicado com ${payloadSubs.length} subelemento(s)`);
                exibirStatusTemporario('✅ Elemento duplicado.', 'bg-emerald-600');
                renderExpansoes();
                setTimeout(() => document.querySelector(`[data-exp-id="${CSS.escape(novoId)}"][data-exp-campo="nome"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
            } catch (err) {
                console.error(err);
                await alertaVisualAtnx('Erro ao duplicar elemento', err.message || String(err));
                await carregarExpansoes();
            }
        }

        async function duplicarSubitemExpansao(id) {
            const item = (state.expansoesSubitems || []).find(s => s.id === id);
            if (!item) return;
            const projeto = (state.expansoes || []).find(p => p.id === item.expansao_id);
            const camposSub = [
                'expansao_id', 'nome', 'status', 'timeline_inicio', 'timeline_fim', 'duracao', 'equipe', 'responsavel', 'imagens',
                'pessoas', 'depende_de', 'tipo_cabo', 'projetado', 'lancado', 'fotos', 'diagrama_fusao', 'diferenca', 'validacao', 'data'
            ];
            const payload = limparPayloadDuplicacaoExpansao(item, camposSub);
            const novoId = `expsub-${Date.now()}`;
            payload.id = novoId;
            payload.nome = nomeDuplicadoExpansao(item.nome, 'subelemento');
            payload.expansao_id = item.expansao_id;
            try {
                exibirStatusTemporario('⧉ Duplicando subelemento...', 'bg-[#0073ea]');
                const { error } = await supabaseClient.from('atlas_expansoes_subitems').insert([payload]);
                if (error) throw error;
                state.expansoesSubitems = [...(state.expansoesSubitems || []), payload];
                state.expansoesProjetosAbertos[item.expansao_id] = true;
                await registrarAuditoria('criação', 'expansao_subitem', novoId, payload.nome, 'duplicação', item.nome || '', payload.nome, projeto ? `Subelemento duplicado de ${projeto.nome}` : 'Subelemento duplicado');
                exibirStatusTemporario('✅ Subelemento duplicado.', 'bg-emerald-600');
                renderExpansoes();
                setTimeout(() => document.querySelector(`[data-exp-id="${CSS.escape(novoId)}"][data-exp-campo="nome"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
            } catch (err) {
                console.error(err);
                await alertaVisualAtnx('Erro ao duplicar subelemento', err.message || String(err));
                await carregarExpansoes();
            }
        }

        function abrirFormularioSubitemExpansao(expansaoId, itemAtual = null) {
            return new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.className = 'atnx-modal-overlay';
                overlay.innerHTML = `<div class="atnx-modal-card atnx-modal-card-wide" role="dialog" aria-modal="true">
                    <div class="atnx-modal-header"><div><div class="atnx-modal-title">Subitem da expansão</div><div class="atnx-modal-subtitle">Campos de subitem da planilha</div></div><button type="button" class="atnx-modal-close" data-cancel>✕</button></div>
                    <form class="atnx-admin-form" id="form-exp-subitem"><div class="atnx-form-grid">
                        ${criarInputAdmin({ label: 'Name', name: 'nome', value: valorTextoAdmin(itemAtual?.nome), required: true })}
                        ${criarSelectAtnx({ label: 'Status', name: 'status', value: itemAtual?.status || '', options: ['', 'Em Progresso', 'Parado', 'Concluído', 'Inviável'] })}
                        ${criarInputAdmin({ label: 'Timeline - Start', name: 'timeline_inicio', type: 'date', value: valorDataAdmin(itemAtual?.timeline_inicio, '') })}
                        ${criarInputAdmin({ label: 'Timeline - End', name: 'timeline_fim', type: 'date', value: valorDataAdmin(itemAtual?.timeline_fim, '') })}
                        <label class="atnx-form-field"><span>Duração</span><div class="atlas-exp-readonly atlas-exp-readonly-form">Automática pelo timeline</div></label>
                        ${criarInputAdmin({ label: 'Equipe', name: 'equipe', value: valorTextoAdmin(itemAtual?.equipe) })}
                        ${criarInputAdmin({ label: 'Responsável', name: 'responsavel', value: valorTextoAdmin(itemAtual?.responsavel) })}
                        ${criarInputAdmin({ label: 'Imagens', name: 'imagens', value: valorTextoAdmin(itemAtual?.imagens), placeholder: 'Drive de Expansões / URL' })}
                        ${criarInputAdmin({ label: 'Pessoas', name: 'pessoas', value: valorTextoAdmin(itemAtual?.pessoas) })}
                        ${criarInputAdmin({ label: 'Depende de', name: 'depende_de', value: valorTextoAdmin(itemAtual?.depende_de) })}
                    </div><div class="atnx-form-error" data-error></div><div class="atnx-modal-actions"><button type="button" class="atnx-btn-secondary" data-cancel>Cancelar</button><button type="submit" class="atnx-btn-primary">Salvar subitem</button></div></form></div>`;
                document.body.appendChild(overlay);
                const form = overlay.querySelector('#form-exp-subitem');
                const erro = overlay.querySelector('[data-error]');
                const cancelar = () => { removerModalAtnx(overlay); resolve(null); };
                overlay.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', cancelar));
                overlay.addEventListener('click', e => { if (e.target === overlay) cancelar(); });
                form.addEventListener('submit', e => {
                    e.preventDefault();
                    const fd = new FormData(form);
                    const nome = valorTextoAdmin(fd.get('nome'));
                    if (!nome) { erro.textContent = 'Informe o nome do subitem.'; return; }
                    const timelineInicio = valorTextoAdmin(fd.get('timeline_inicio')) || null;
                    const timelineFim = valorTextoAdmin(fd.get('timeline_fim')) || null;
                    const payload = {
                        expansao_id: expansaoId,
                        nome,
                        status: valorTextoAdmin(fd.get('status')) || null,
                        timeline_inicio: timelineInicio,
                        timeline_fim: timelineFim,
                        duracao: calcularDiasUteisExpansao(timelineInicio, timelineFim),
                        equipe: valorTextoAdmin(fd.get('equipe')) || null,
                        responsavel: valorTextoAdmin(fd.get('responsavel')) || null,
                        imagens: valorTextoAdmin(fd.get('imagens')) || null,
                        pessoas: valorTextoAdmin(fd.get('pessoas')) || null,
                        depende_de: valorTextoAdmin(fd.get('depende_de')) || null,
                                updated_at: new Date().toISOString()
                    };
                    removerModalAtnx(overlay); resolve(payload);
                });
            });
        }

        function coletarCamposLinhaNovaSubitem(expansaoId) {
            const linha = document.querySelector(`[data-new-sub-expansao="${CSS.escape(expansaoId)}"]`) || document.querySelector('.atlas-exp-new-row [data-new-sub-campo]')?.closest('tr');
            if (!linha) throw new Error('Linha de subelemento não encontrada.');
            const payload = { expansao_id: expansaoId, updated_at: new Date().toISOString() };
            linha.querySelectorAll('[data-new-sub-campo]').forEach(el => {
                const campo = el.getAttribute('data-new-sub-campo');
                payload[campo] = normalizarValorCampoExpansao(campo, el.value);
            });
            payload.nome = valorTextoAdmin(payload.nome);
            if (!payload.nome) throw new Error('Informe o nome do subelemento.');
            if (!payload.status) payload.status = 'Em Progresso';
            if (deveAutomatizarDiferencaSubitemExpansao(expansaoId)) {
                payload.diferenca = calcularDiferencaLancamentoExpansao(payload.projetado, payload.lancado);
            }
            return payload;
        }

        function cancelarNovoSubitemExpansao() {
            state.expansaoSubitemNovoProjetoId = null;
            renderExpansoes();
        }

        async function salvarNovoSubitemLinha(expansaoId) {
            const projeto = (state.expansoes || []).find(p => p.id === expansaoId);
            try {
                const payload = coletarCamposLinhaNovaSubitem(expansaoId);
                const id = `expsub-${Date.now()}`;
                const { error } = await supabaseClient.from('atlas_expansoes_subitems').insert([{ id, ...payload }]);
                if (error) throw error;
                await registrarAuditoria('criação', 'expansao_subitem', id, payload.nome, 'subitem', '', payload.nome, projeto ? `Subitem de ${projeto.nome}` : 'Subitem criado');
                state.expansaoSubitemNovoProjetoId = null;
                state.expansoesProjetosAbertos[expansaoId] = true;
                exibirStatusTemporario('✅ Subelemento cadastrado.', 'bg-emerald-600');
                await carregarExpansoes();
            } catch (err) {
                await alertaVisualAtnx('Erro ao cadastrar subelemento', err.message || String(err));
            }
        }

        async function abrirCadastroSubitemExpansao(expansaoId) {
            state.expansoesProjetosAbertos[expansaoId] = true;
            state.expansaoSubitemNovoProjetoId = expansaoId;
            renderExpansoes();
            setTimeout(() => {
                const linha = document.querySelector('.atlas-exp-sub-table .atlas-exp-new-row');
                linha?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                linha?.querySelector('[data-new-sub-campo="nome"]')?.focus();
            }, 60);
        }

        async function excluirSubitemExpansao(id) {
            const item = (state.expansoesSubitems || []).find(s => s.id === id);
            if (!item) return;
            const totalImagens = normalizarMidiasExpansao(item.imagens).length;
            const confirmado = await confirmarVisualAtnx(
                'Remover subelemento',
                `Remover ${item.nome || 'este subelemento'}?

O subelemento será removido do sistema e a pasta/imagens correspondentes serão enviadas para a lixeira no Google Drive.

Imagens afetadas: ${totalImagens}.`,
                'Remover'
            );
            if (!confirmado) return;
            try {
                exibirStatusTemporario('🗑️ Removendo subelemento e limpando Google Drive...', 'bg-[#0073ea]');
                await excluirEntidadeExpansaoNoGoogleDrive('subitem', item);

                const { error } = await supabaseClient.from('atlas_expansoes_subitems').delete().eq('id', id);
                if (error) throw error;
                await registrarAuditoria('remoção', 'expansao_subitem', id, item.nome || id, 'subitem', item.nome || '', '', 'Subelemento removido do sistema; pasta/imagens enviadas para a lixeira no Google Drive');
                exibirStatusTemporario('✅ Subelemento removido do sistema e do Google Drive.', 'bg-emerald-600');
                await carregarExpansoes();
            } catch (err) {
                console.error(err);
                await alertaVisualAtnx('Erro ao remover subelemento', (err.message || String(err)) + '\n\nA remoção no sistema foi interrompida para evitar deixar arquivos órfãos no Google Drive.');
            }
        }




        function renderAdminObras() {
            const __atlasRender = iniciarRenderPreservandoEstadoVisual();
            try {
            if ((state.adminVisualizacao || 'status') === 'obras') {
                renderObrasDocumentacaoInterna();
                return;
            }
            atualizarVisibilidadeModulos();
            const painel = document.getElementById('painel-admin-obras');
            const titulo = document.getElementById('txt-nome-obra');
            if (!painel || !titulo) return;

            titulo.innerText = 'Documentação Rede Geral';
            document.getElementById('txt-grupo-ativo').innerHTML = '';

            if (state.adminCarregando) {
                painel.innerHTML = `<div class="bg-[#1c1d30] border border-[#2f314e] rounded p-12 text-center text-gray-500 italic">Carregando documentação rede geral...</div>`;
                return;
            }

            if (state.adminErro) {
                renderAdminSetup();
                return;
            }

            const termo = String(state.termoPesquisa || '').toLowerCase();
            const lista = (state.adminObras || [])
                .filter(item => String(item.cidade || '').toLowerCase().includes(termo));

            const totalCidades = lista.length;
            const totaisAdmin = lista.reduce((acc, item) => {
                const progresso = calcularProgressoAdmin(item);
                acc.totalItens += progresso.total;
                acc.feitoItens += progresso.feito;
                return acc;
            }, { totalItens: 0, feitoItens: 0 });
            const totalEstruturas = totaisAdmin.totalItens;
            const totalFeitas = totaisAdmin.feitoItens;
            const progressoGeral = totalEstruturas > 0 ? Math.round((totalFeitas / totalEstruturas) * 100) : 0;

            const toolbar = `<div class="atnx-admin-toolbar">
                <div>
                    <div class="text-white text-sm font-bold">Gestão geral da documentação de rede</div>
                    <div class="text-gray-500 text-[10px] mt-1">Cadastre cidades, datas e acompanhe a documentação de rede por etapa e cronograma.</div>
                </div>
                <div class="atnx-admin-summary">
                    <span class="atnx-admin-summary-pill">${totalCidades} cidade(s)</span>
                    <span class="atnx-admin-summary-pill">${totaisAdmin.feitoItens} itens documentados</span>
                    <span class="atnx-admin-summary-pill">${progressoGeral}% geral</span>
                    ${renderAdminViewTabs()}
                </div>
            </div>`;

            if ((state.adminVisualizacao || 'status') === 'gantt') {
                painel.innerHTML = `${toolbar}${renderAdminGantt(lista)}`;
                setTimeout(centralizarHojeGantt, 0);
                return;
            }

            if ((state.adminVisualizacao || 'status') === 'painel') {
                painel.innerHTML = `${toolbar}${renderPainelExecutivoConteudo()}`;
                return;
            }

            const colunas = ADMIN_STATUS.map(status => {
                const itens = lista.filter(item => (item.status || 'a_realizar') === status.id);
                const aberta = !state.adminSecoesAbertas || state.adminSecoesAbertas[status.id] !== false;
                const body = itens.length
                    ? itens.map(renderCardCidadeAdmin).join('')
                    : `<div class="atnx-admin-empty">Nenhuma cidade nesta etapa.</div>`;

                return `<div class="atnx-admin-column atnx-admin-column-${status.id} ${aberta ? '' : 'is-collapsed'}">
                    <div class="atnx-admin-column-header atnx-admin-column-header-clickable" onclick="toggleSecaoAdmin('${status.id}')" role="button" title="Abrir/fechar etapa">
                        <div class="atnx-admin-column-title"><span class="atnx-admin-caret">${aberta ? '▾' : '▸'}</span><span class="atnx-admin-status-marker atnx-admin-status-${status.id}" aria-hidden="true"></span>${escaparHtml(status.titulo)}</div>
                        <div class="atnx-admin-count atnx-admin-count-${status.id}">${itens.length}</div>
                    </div>
                    <div class="atnx-admin-column-body ${aberta ? '' : 'hidden'}">${body}</div>
                </div>`;
            }).join('');

            painel.innerHTML = `${toolbar}<div class="atnx-admin-board atnx-admin-board-vertical">${colunas}</div>`;
            } finally {
                finalizarRenderPreservandoEstadoVisual(__atlasRender);
            }
        }

        function renderObrasDocumentacaoInterna() {
            const __atlasRender = iniciarRenderPreservandoEstadoVisual();
            try {
            atualizarVisibilidadeModulos();
            const obraObj = state.obras.find(o => o.id === state.obraAtiva);
            document.getElementById('txt-nome-obra').innerText = obraObj ? `Documentação Rede Geral › ${obraObj.nome}` : "Documentação Rede Geral › Obras";
            document.getElementById('txt-grupo-ativo').innerHTML = `<div class="atnx-doc-internal-head"><div>${renderAdminViewTabs()}</div><div class="atnx-doc-internal-category"><span>▼</span> Categoria Ativa: <span class="text-white">${state.abaAtiva}</span></div></div>`;

            const sidebar = document.getElementById('sidebar-obras');
            sidebar.innerHTML = '';
            if(state.obras.length === 0) {
                sidebar.innerHTML = `<div class="text-[11px] text-gray-600 italic p-3 text-center">Nenhuma cidade criada. Clique no botão "+" acima.</div>`;
            } else {
                state.obras.forEach(o => {
                    const ativo = o.id === state.obraAtiva;
                    sidebar.innerHTML += `
                        <div class="group flex items-center justify-between mx-1 rounded ${ativo ? 'bg-[#0073ea] text-white' : 'hover:bg-[#292c4d] text-gray-400'}">
                            <button onclick="selecionarObra('${o.id}')" class="flex-1 text-left px-3 py-2 text-xs truncate">📁 ${escaparHtml(o.nome)}</button>
                            <button onclick="alterarNomeObra('${o.id}', event)" class="p-2 text-gray-500 hover:text-[#0073ea] opacity-0 group-hover:opacity-100 font-bold" title="Editar Cidade/Obra">✏️</button>
                            <button onclick="excluirObra('${o.id}', event)" class="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 font-bold" title="Apagar Cidade">🗑️</button>
                        </div>`;
                });
            }

            const tabs = document.getElementById('tabs-container');
            tabs.innerHTML = '';
            ['POP', 'CEO', 'CTO'].forEach(aba => {
                const ativa = aba === state.abaAtiva;
                tabs.innerHTML += `<button onclick="selecionarAba('${aba}')" class="atnx-doc-tab ${ativa ? 'is-active' : ''}" aria-pressed="${ativa ? 'true' : 'false'}">${aba}</button>`;
            });

            const tbody = document.getElementById('tabela-elementos');
            tbody.innerHTML = '';

            if(!state.obraAtiva) {
                tbody.innerHTML = `<tr><td colSpan="6" class="text-center p-12 text-gray-500 italic">Crie ou selecione uma cidade na barra lateral.</td></tr>`;
                return;
            }

            if (state.carregandoObra && (!state.elementos || state.elementos.length === 0)) {
                tbody.innerHTML = `<tr><td colSpan="6" class="text-center p-12 text-gray-500 italic">Carregando ativos desta obra...</td></tr>`;
                return;
            }

            limparSelecoesInvalidas();
            const filtrados = state.elementos.filter(el => el.tipo === state.abaAtiva && String(el.nome || '').toLowerCase().includes(state.termoPesquisa.toLowerCase()));
            atualizarSelecaoVisualCabecalho(filtrados.length);

            if(filtrados.length === 0) {
                tbody.innerHTML = `<tr><td colSpan="6" class="text-center p-12 text-gray-500 italic">Nenhum ativo cadastrado nesta categoria.</td></tr>`;
                return;
            }

            filtrados.forEach(el => {
                const exp = !!state.linhasExpandidas[el.id];
                const statusPai = normalizarStatus(el.status);
                const elSelecionado = elementoSelecionado(el.id);
                const classeSelecaoElemento = elSelecionado ? 'bg-[#0073ea]/10' : '';
                
                tbody.innerHTML += `
                    <tr class="border-b border-[#2f314e] h-10 text-gray-300 hover:bg-[#242746]/10 ${classeSelecaoElemento}">
                        <td class="text-center"><input type="checkbox" class="rounded accent-[#0073ea]" ${elSelecionado ? 'checked' : ''} onclick="event.stopPropagation(); toggleSelecaoElemento('${el.id}', this.checked)" title="Selecionar ativo e seus subelementos"></td>
                        <td class="px-2 font-medium text-white border-r border-[#2f314e]">
                            <div class="flex items-center gap-2">
                                <span class="cursor-pointer p-1 text-gray-500 hover:text-white" onclick="toggleLinhaExpansion('${el.id}')">${exp ? '▼' : '►'}</span>
                                <span class="text-emerald-400 text-sm cursor-pointer ml-1 font-bold" onclick="criarSubelemento('${el.id}')" title="Adicionar Porta Interna">💬+</span>
                                <span class="font-semibold text-[13px] ml-1 cursor-pointer hover:text-[#0073ea]" onclick="alterarNomeElementoPai('${el.id}', event)" title="Editar nome do ativo principal">${escaparHtml(el.nome)} <span class="text-[9px] text-gray-500">✏️</span></span>
                            </div>
                        </td>
                        <td class="p-1 border-r border-[#2f314e] text-center">
                            ${renderizarSelectStatus('pai', el.id, statusPai, 'w-32')}
                        </td>
                        <td class="px-4 text-center border-r border-[#2f314e] text-gray-400" title="Clique no calendário para alterar a data">
                            <input type="date" value="${converterDataParaInput(el.data)}" onchange="alterarDataPai('${el.id}', this.value)" class="date-input-inline text-center" title="Alterar data do ativo principal">
                        </td>
                        <td class="px-4 border-r border-[#2f314e] cursor-pointer hover:text-[#0073ea] font-medium" onclick="alterarTecnicoPai('${el.id}', '${el.tecnico}')">👤 ${el.tecnico} <span class="text-[9px] text-gray-500">✏️</span></td>
                        <td class="text-center">
                            <button onclick="excluirElementoPai('${el.id}')" class="text-gray-500 hover:text-red-400 font-bold" title="Remover Ativo">🗑️</button>
                        </td>
                    </tr>`;
                
                if(exp) {
                    let subRows = '';
                    if(!el.subelementos || el.subelementos.length === 0) {
                        subRows = `<tr><td colSpan="10" class="p-4 text-center text-gray-600 italic">Nenhuma porta interna mapeada. Clique em 💬+ para adicionar.</td></tr>`;
                    } else {
                        el.subelementos.forEach(sub => {
                            const statusSub = normalizarStatus(sub.status);
                            const subSelecionado = subelementoSelecionado(sub.id);
                            const classeSelecaoSub = subSelecionado ? 'bg-[#0073ea]/10' : '';
                            
                            const fHtml = renderizarMidias(sub.fotos, 'border border-gray-600', sub.id, 'fotos');
                            const dHtml = renderizarMidias(sub.diagramas, 'border border-[#0073ea]', sub.id, 'diagramas');

                            subRows += `
                            <tr class="border-b border-[#2f314e]/40 text-center h-9 hover:bg-[#242746]/20 ${classeSelecaoSub}">
                                <td><input type="checkbox" class="rounded accent-[#0073ea]" ${subSelecionado ? 'checked' : ''} onclick="event.stopPropagation(); toggleSelecaoSubelemento('${el.id}', '${sub.id}', this.checked)" title="Selecionar subelemento"></td>
                                <td class="px-4 text-left text-white font-medium"><span class="cursor-pointer hover:text-[#0073ea]" onclick="alterarNomeSubelemento('${sub.id}', event)" title="Editar nome da porta/subelemento">${escaparHtml(sub.nome)} <span class="text-[9px] text-gray-500">✏️</span></span></td>
                                <td class="text-gray-500">💬</td>
                                <td class="p-1">
                                    ${renderizarSelectStatus('sub', sub.id, statusSub, 'w-24')}
                                </td>
                                <td class="cursor-pointer hover:bg-gray-800/40 p-1" onclick="fazerUploadMidia('${sub.id}', 'fotos')" title="Clique para fazer upload de Foto">${fHtml}</td>
                                <td class="cursor-pointer hover:bg-gray-800/40 p-1" onclick="fazerUploadMidia('${sub.id}', 'diagramas')" title="Clique para fazer upload de Diagrama">${dHtml}</td>
                                <td class="text-[#0073ea] font-bold font-mono cursor-pointer hover:bg-gray-800/40" onclick="alterarSinalSub('${sub.id}', '${sub.sinal}')">${sub.sinal} dBm ✏️</td>
                                <td class="text-gray-500" title="Clique no calendário para alterar a data">
                                    <input type="date" value="${converterDataParaInput(sub.data)}" onchange="alterarDataSub('${sub.id}', this.value)" class="date-input-inline text-center" title="Alterar data da porta/subelemento">
                                </td>
                                <td class="px-4 text-left text-gray-400 cursor-pointer hover:text-[#0073ea] font-medium" onclick="alterarTecnicoSub('${sub.id}', '${sub.tecnico}')">👤 ${sub.tecnico} ✏️</td>
                                <td>
                                    <button onclick="excluirSubelemento('${sub.id}')" class="text-gray-600 hover:text-red-500 font-bold">❌</button>
                                </td>
                            </tr>`;
                        });
                    }
                    tbody.innerHTML += `
                        <tr>
                            <td colSpan="6" class="bg-[#141524] p-3">
                                <table class="w-full text-left text-[11px] border border-[#2f314e]">
                                    <thead>
                                        <tr class="bg-[#1c1d30] text-gray-400 h-7 text-center select-none border-b border-[#2f314e]">
                                            <th class="w-10"></th>
                                            <th class="px-4 text-left font-normal">Subelemento / Porta</th>
                                            <th class="w-8"></th>
                                            <th class="w-28 font-normal">Status</th>
                                            <th class="w-32 font-normal">Fotos (Upload)</th>
                                            <th class="w-32 font-normal">Diagrama Fusão</th>
                                            <th class="w-32 font-normal">Sinal Power Meter</th>
                                            <th class="w-24 font-normal">Data</th>
                                            <th class="text-left px-4 font-normal">Responsável</th>
                                            <th class="w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody class="text-gray-400">${subRows}</tbody>
                                </table>
                            </td>
                        </tr>`;
                }
            });
            } finally {
                finalizarRenderPreservandoEstadoVisual(__atlasRender);
            }
        }

        function renderApp() {
            if (state.moduloAtivo === 'admin_obras' && (state.adminVisualizacao || 'status') === 'manutencao_redes') {
                renderManutencaoRedes();
                return;
            }
            if (state.moduloAtivo === 'admin_obras') {
                renderAdminObras();
                return;
            }
            if (state.moduloAtivo === 'expansoes') {
                renderExpansoes();
                return;
            }
            if (state.moduloAtivo === 'pmo') {
                renderPMO();
                return;
            }
            if (state.moduloAtivo === 'admin_central') {
                renderAdminCentral();
                return;
            }
            renderObrasDocumentacaoInterna();
        }

        document.addEventListener('keydown', event => {
            if (!(event.key === 'Escape' || event.key === 'Esc')) return;
            if (state.auditoriaAberta) {
                fecharAuditoria();
                return;
            }
            if (state.adminGanttFullscreen) {
                state.adminGanttFullscreen = false;
                renderAdminObras();
            }
            if (state.expansoesGanttFullscreen) {
                state.expansoesGanttFullscreen = false;
                renderExpansoes();
            }
        });

        let atlasViewportCompacto = null;

        function aplicarLayoutResponsivoAtlas() {
            const compacto = window.matchMedia('(max-width: 900px)').matches;
            document.body.classList.toggle('atlas-viewport-compacto', compacto);
            if (atlasViewportCompacto === null || atlasViewportCompacto !== compacto) {
                state.sidebarAberta = !compacto;
                atlasViewportCompacto = compacto;
            }
            aplicarEstadoSidebarAtlas();
        }

        document.addEventListener('click', event => {
            if (!window.matchMedia('(max-width: 900px)').matches) return;
            if (event.target.closest('#sidebar-container .atnx-sidebar-submodule, #sidebar-obras button, #btn-modulo-admin-central')) {
                setTimeout(fecharSidebarResponsiva, 0);
            }
        });

        let atlasResizeTimer = 0;
        window.addEventListener('resize', () => {
            clearTimeout(atlasResizeTimer);
            atlasResizeTimer = setTimeout(aplicarLayoutResponsivoAtlas, 120);
        }, { passive: true });

        window.onload = () => {
            aplicarLayoutResponsivoAtlas();
            inicializarAtlasV14Auth();
        };


/* ATNX V1.3.2.4 — neutralizador de hover/tooltips das barras do Gantt
   Remove atributos que podem disparar tooltip nativo e fixa estilos críticos após cada render. */
(function neutralizadorHoverGanttAtlas(){
    const seletor = [
        '.atlas-exp-gantt-bar',
        '.atlas-exp-gantt-bar-label',
        '.atlas-exp-gantt-today',
        '.atlas-exp-gantt-today span',
        '.atnx-gantt-bar',
        '.atnx-gantt-bar-label',
        '.atnx-gantt-bar-label-outside',
        '.atnx-gantt-today',
        '.atnx-gantt-today-badge'
    ].join(',');
    let agendado = false;
    function aplicar(){
        agendado = false;
        document.querySelectorAll(seletor).forEach((el) => {
            el.removeAttribute('title');
            el.removeAttribute('data-title');
            el.removeAttribute('data-tooltip');
            el.setAttribute('draggable', 'false');
            el.style.pointerEvents = 'none';
            el.style.userSelect = 'none';
            el.style.transition = 'none';
            el.style.animation = 'none';
            el.style.filter = 'none';
            if (el.classList.contains('atlas-exp-gantt-bar') || el.classList.contains('atnx-gantt-bar')) {
                el.style.transform = 'translate3d(0, -50%, 0)';
                el.style.top = '50%';
            }
            if (el.classList.contains('atlas-exp-gantt-bar-label') || el.classList.contains('atnx-gantt-bar-label') || el.classList.contains('atnx-gantt-bar-label-outside')) {
                el.style.transform = 'translate3d(0, -50%, 0)';
                el.style.top = '50%';
            }
        });
    }
    function agendar(){
        if (agendado) return;
        agendado = true;
        requestAnimationFrame(aplicar);
    }
    document.addEventListener('mouseover', function(event){
        if (event.target && event.target.closest && event.target.closest(seletor)) {
            agendar();
        }
    }, true);
    document.addEventListener('DOMContentLoaded', function(){
        aplicar();
        if (document.body) {
            const observer = new MutationObserver(agendar);
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });
    window.addEventListener('load', aplicar);
})();


/* ATNX V1.3.2.9 — Scroll em Obras de Expansões + sincronização em tempo real */
(function atlasV1329ScrollObrasExpansoes(){
    const AREA_OBRAS = '.atlas-exp-obras-shell, .atlas-exp-obra-card, .atlas-exp-obra-table-wrap, .atlas-exp-sub-table-wrap';

    function encontrarScrollPrincipal() {
        const direto = document.getElementById('main-scroll-container');
        if (direto) return direto;
        return document.querySelector('.flex-1.overflow-auto.p-6') || document.scrollingElement || document.documentElement;
    }

    document.addEventListener('wheel', function(event) {
        const alvo = event.target;
        if (!alvo || !alvo.closest || !alvo.closest(AREA_OBRAS)) return;
        if (state.moduloAtivo !== 'expansoes' || state.expansoesVisualizacao !== 'obras') return;

        const deltaY = Number(event.deltaY || 0);
        const deltaX = Number(event.deltaX || 0);
        if (!deltaY || Math.abs(deltaX) > Math.abs(deltaY)) return;

        // Shift + roda continua reservado para rolagem horizontal da tabela.
        if (event.shiftKey) return;

        // Dentro dos subelementos, deixa a lista consumir a roda enquanto
        // ainda houver conteúdo acima ou abaixo. A página assume apenas nas bordas.
        const subWrap = alvo.closest('#painel-expansoes .atlas-exp-obras-shell .atlas-exp-sub-table-wrap');
        if (subWrap) {
            const maxTop = Math.max(0, Number(subWrap.scrollHeight || 0) - Number(subWrap.clientHeight || 0));
            const atual = Number(subWrap.scrollTop || 0);
            const podeRolarInterno = maxTop > 2 && ((deltaY < 0 && atual > 0) || (deltaY > 0 && atual < maxTop - 1));
            if (podeRolarInterno) return;
        }

        const scroller = encontrarScrollPrincipal();
        if (!scroller) return;

        const antes = scroller.scrollTop;
        scroller.scrollTop += deltaY;
        if (scroller.scrollTop !== antes) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, { passive: false, capture: true });
})();



/* ATNX V1.3.3 Oficial — Corrige roda do mouse em Expansões > Projetos.
   A tabela horizontal não deve prender a rolagem vertical da página. */
(function atlasV133OficialScrollProjetosExpansoes(){
    if (window.__ATNX_SCROLL_PROJETOS_EXPANSOES_V133__) return;
    window.__ATNX_SCROLL_PROJETOS_EXPANSOES_V133__ = true;
    const AREA_PROJETOS = '.atlas-exp-board .atlas-exp-table-wrap, .atlas-exp-board .atlas-exp-sub-table-wrap, .atlas-exp-group-body';

    function encontrarScrollPrincipalProjetos() {
        return document.getElementById('main-scroll-container') || document.querySelector('.flex-1.overflow-auto.p-6') || document.scrollingElement || document.documentElement;
    }

    document.addEventListener('wheel', function(event) {
        const alvo = event.target;
        if (!alvo || !alvo.closest || !alvo.closest(AREA_PROJETOS)) return;
        if (!window.state || state.moduloAtivo !== 'expansoes' || (state.expansoesVisualizacao || 'tabela') !== 'tabela') return;
        if (event.shiftKey || event.ctrlKey || event.metaKey) return;

        const deltaY = Number(event.deltaY || 0);
        const deltaX = Number(event.deltaX || 0);
        if (!deltaY || Math.abs(deltaX) > Math.abs(deltaY)) return;

        // V1.3.5: subelementos possuem rolagem vertical própria. Quando o mouse
        // está em cima da lista de subelementos, este handler antigo não deve
        // puxar a página principal antes da lista interna chegar ao topo/fim.
        const subWrap = alvo.closest('#painel-expansoes .atlas-exp-board .atlas-exp-sub-table-wrap');
        if (subWrap) {
            const maxTop = Math.max(0, Number(subWrap.scrollHeight || 0) - Number(subWrap.clientHeight || 0));
            const atual = Number(subWrap.scrollTop || 0);
            const podeRolarInterno = maxTop > 2 && ((deltaY < 0 && atual > 0) || (deltaY > 0 && atual < maxTop - 1));
            if (podeRolarInterno) return;
        }

        const scroller = encontrarScrollPrincipalProjetos();
        if (!scroller) return;

        const antes = scroller.scrollTop;
        scroller.scrollTop += deltaY;
        if (scroller.scrollTop !== antes) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, { passive: false, capture: true });
})();

(function atlasV1329RealtimeSupabase(){
    if (window.__ATNX_REALTIME_V1329__) return;
    window.__ATNX_REALTIME_V1329__ = true;

    const TABELAS_OBRAS = new Set(['obras', 'elementos_principais', 'subelementos']);
    const TABELAS_ADMIN = new Set(['admin_documentacoes']);
    const TABELAS_EXPANSOES = new Set(['atlas_expansoes', 'atlas_expansoes_subitems']);
    const TABELAS_PMO = new Set(['atlas_pmo_projetos', 'atlas_pmo_subelementos', 'atlas_pmo_updates']);
    const TABELAS_MANUTENCAO = new Set(['atlas_manutencoes_rede']);
    const TABELAS_CONFIG = new Set(['atlas_profiles', 'atlas_custom_fields']);
    const TABELAS_TODAS = [...TABELAS_OBRAS, ...TABELAS_ADMIN, ...TABELAS_EXPANSOES, ...TABELAS_PMO, ...TABELAS_MANUTENCAO, ...TABELAS_CONFIG];
    const tabelasPendentes = new Set();
    let timerRealtime = null;
    let realtimeAtivo = false;
    let sincronizando = false;
    let intervaloFallback = null;

    function edicaoAtiva() {
        if (window.state?.pmoFormularioAberto || window.state?.pmoSubitemNovoProjetoId || window.state?.pmoUpdateNovoProjetoId) return true;
        if (document.querySelector('#form-pmo-projeto, .atlas-pmo-nested-form')) return true;
        const el = document.activeElement;
        if (!el) return false;
        if (el.isContentEditable) return true;
        const tag = String(el.tagName || '').toUpperCase();
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return false;
        if (el.disabled || el.readOnly) return false;
        const tipo = String(el.type || '').toLowerCase();
        if (['checkbox', 'radio', 'button', 'submit', 'reset', 'file'].includes(tipo)) return false;
        return true;
    }

    function atualizarBadgeRealtime(texto, classeExtra = '') {
        const badge = document.getElementById('badge-status');
        if (!badge) return;
        if (!texto) return;
        badge.textContent = texto;
        if (classeExtra) badge.className = classeExtra;
    }

    async function carregarDocumentacaoSilencioso() {
        if (!supabaseClient || !atlasUsuarioAtivo()) return;
        const obraAtualAntes = state.obraAtiva;
        const { data: dataObras, error: errObras } = await supabaseClient
            .from('obras')
            .select('*')
            .order('created_at', { ascending: true });
        if (errObras) throw errObras;

        state.obras = dataObras || [];
        state.cacheElementosPorObra = {};
        if (!state.obraAtiva || !state.obras.some(o => o.id === state.obraAtiva)) {
            state.obraAtiva = state.obras[0]?.id || '';
        }
        if (state.obraAtiva) {
            state.elementos = await carregarElementosDaObra(state.obraAtiva, { usarCache: false, salvarNoState: false });
        } else {
            state.elementos = [];
        }
        if (state.moduloAtivo === 'admin_obras' && (state.adminVisualizacao || 'status') === 'obras') {
            renderObrasDocumentacaoInterna();
        } else if (obraAtualAntes !== state.obraAtiva && state.moduloAtivo === 'admin_obras') {
            renderAdminObras();
        }
    }

    async function carregarAdminSilencioso() {
        if (!supabaseClient || !atlasUsuarioAtivo()) return;
        const { data, error } = await supabaseClient
            .from(ADMIN_OBRAS_TABELA)
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        state.adminObras = data || [];
        state.adminErro = '';
        if (state.moduloAtivo === 'admin_obras' && (state.adminVisualizacao || 'status') !== 'obras') {
            renderAdminObras();
        }
    }

    async function carregarExpansoesSilencioso() {
        if (!supabaseClient || !atlasUsuarioAtivo()) return;
        const { data, error } = await supabaseClient
            .from('atlas_expansoes')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        state.expansoes = data || [];
        const ids = state.expansoes.map(p => p.id).filter(Boolean);
        if (ids.length) {
            const { data: subs, error: subErr } = await supabaseClient
                .from('atlas_expansoes_subitems')
                .select('*')
                .in('expansao_id', ids)
                .order('created_at', { ascending: true });
            if (subErr) throw subErr;
            state.expansoesSubitems = subs || [];
        } else {
            state.expansoesSubitems = [];
        }
        state.expansoesErro = '';
        if (state.moduloAtivo === 'expansoes') renderExpansoes();
    }

    async function carregarPMOSilencioso() {
        if (!supabaseClient || !atlasUsuarioAtivo() || typeof carregarPMO !== 'function') return;
        if (typeof pmoEdicaoLocalRecente === 'function' && pmoEdicaoLocalRecente(10000)) return;
        await carregarPMO({ silencioso: true });
    }

    async function sincronizarPendencias(origem = 'realtime') {
        if (sincronizando || !supabaseClient || !atlasUsuarioAtivo()) return;
        if (edicaoAtiva()) {
            agendarSincronizacao(origem, 1800);
            return;
        }
        sincronizando = true;
        const pendentes = new Set(tabelasPendentes);
        tabelasPendentes.clear();
        try {
            const deveObras = [...pendentes].some(t => TABELAS_OBRAS.has(t)) || origem === 'fallback';
            const deveAdmin = [...pendentes].some(t => TABELAS_ADMIN.has(t)) || origem === 'fallback';
            const deveExpansoes = [...pendentes].some(t => TABELAS_EXPANSOES.has(t)) || origem === 'fallback';
            const devePMO = [...pendentes].some(t => TABELAS_PMO.has(t));
            const deveManutencao = [...pendentes].some(t => TABELAS_MANUTENCAO.has(t));
            const deveConfig = [...pendentes].some(t => TABELAS_CONFIG.has(t));

            if (deveObras) await carregarDocumentacaoSilencioso();
            if (deveAdmin) await carregarAdminSilencioso();
            if (deveExpansoes) await carregarExpansoesSilencioso();
            if (devePMO && state.moduloAtivo === 'pmo') await carregarPMOSilencioso();
            if (deveManutencao && state.moduloAtivo === 'admin_obras' && (state.adminVisualizacao || 'status') === 'manutencao_redes') await carregarManutencoesRede({ silencioso: true });
            if (deveConfig && state.moduloAtivo === 'admin_central') await carregarAdminCentral();

            atualizarBadgeRealtime(realtimeAtivo ? 'Nuvem Ativa • Tempo real' : 'Nuvem Ativa');
        } catch (err) {
            console.warn('Sincronização em tempo real não aplicada:', err);
            tabelasPendentes.clear();
        } finally {
            sincronizando = false;
        }
    }

    function agendarSincronizacao(tabelaOuOrigem = 'fallback', atraso = 650) {
        if (TABELAS_TODAS.includes(tabelaOuOrigem)) tabelasPendentes.add(tabelaOuOrigem);
        if (timerRealtime) clearTimeout(timerRealtime);
        timerRealtime = setTimeout(() => sincronizarPendencias(TABELAS_TODAS.includes(tabelaOuOrigem) ? 'realtime' : tabelaOuOrigem), atraso);
    }

    function iniciarFallbackLeve() {
        if (intervaloFallback) return;
        intervaloFallback = setInterval(() => {
            if (document.hidden || !atlasUsuarioAtivo()) return;
            // Backup leve para ambientes onde o Realtime do Supabase ainda não esteja habilitado na publicação.
            if (state.moduloAtivo === 'expansoes') {
                TABELAS_EXPANSOES.forEach(t => tabelasPendentes.add(t));
                agendarSincronizacao('fallback', 900);
            } else if (state.moduloAtivo === 'admin_obras') {
                TABELAS_ADMIN.forEach(t => tabelasPendentes.add(t));
                if ((state.adminVisualizacao || 'status') === 'manutencao_redes') TABELAS_MANUTENCAO.forEach(t => tabelasPendentes.add(t));
                if ((state.adminVisualizacao || 'status') === 'obras') TABELAS_OBRAS.forEach(t => tabelasPendentes.add(t));
                agendarSincronizacao('fallback', 900);
            } else if (state.moduloAtivo === 'admin_central') {
                TABELAS_CONFIG.forEach(t => tabelasPendentes.add(t));
                agendarSincronizacao('fallback', 900);
            }
        }, 30000);
    }

    function iniciarRealtime() {
        if (!supabaseClient || !atlasUsuarioAtivo() || typeof supabaseClient.channel !== 'function') return;
        try {
            const canal = supabaseClient.channel('atlas-core-v1329-' + Date.now());
            TABELAS_TODAS.forEach(tabela => {
                canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, payload => {
                    const tabelaPayload = payload?.table || tabela;
                    agendarSincronizacao(tabelaPayload, 500);
                });
            });
            canal.subscribe(status => {
                realtimeAtivo = status === 'SUBSCRIBED';
                if (realtimeAtivo) atualizarBadgeRealtime('Nuvem Ativa • Tempo real');
                iniciarFallbackLeve();
            });
        } catch (err) {
            console.warn('Realtime indisponível, usando fallback leve:', err);
            iniciarFallbackLeve();
        }
    }
    window.atlasV14IniciarRealtime = iniciarRealtime;

    window.addEventListener('load', () => {
        setTimeout(iniciarRealtime, 900);
        setTimeout(iniciarFallbackLeve, 1200);
    });
    window.addEventListener('focus', () => agendarSincronizacao('fallback', 650));
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) agendarSincronizacao('fallback', 650);
    });
})();


/* ATLAS V1.3.5 Oficial — Barra horizontal global inteligente.
   A barra fica fora dos elementos e controla somente o bloco largo em uso.
   O restante da tela permanece fixo. */
(function atlasV135BarraHorizontalGlobalInteligente(){
    if (window.__ATLAS_V135_HSCROLL_INTELIGENTE__) return;
    window.__ATLAS_V135_HSCROLL_INTELIGENTE__ = true;

    const TARGET_SELECTOR = [
        '.atlas-pmo-table-wrap',
        '.atlas-module-table-wrap',
        '.atlas-exp-table-wrap',
        '.atlas-exp-sub-table-wrap',
        '.atlas-exp-obra-table-wrap',
        '.atlas-exp-gantt-shell:not(.atlas-exp-gantt-fullscreen) .atlas-exp-gantt-scroll'
    ].join(',');

    let bar = null;
    let inner = null;
    let activeTarget = null;
    let syncing = false;
    let raf = 0;

    function ensureBar(){
        if (bar && inner) return;
        bar = document.getElementById('atlas-page-hscroll');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'atlas-page-hscroll';
            bar.className = 'atlas-page-hscroll';
            bar.setAttribute('aria-label', 'Rolagem horizontal do conteúdo da tabela ativa');
            inner = document.createElement('div');
            inner.className = 'atlas-page-hscroll-inner';
            bar.appendChild(inner);
            document.body.appendChild(bar);
        } else {
            inner = bar.querySelector('.atlas-page-hscroll-inner') || document.createElement('div');
            inner.className = 'atlas-page-hscroll-inner';
            if (!inner.parentElement) bar.appendChild(inner);
        }
        bar.addEventListener('scroll', function(){
            if (!activeTarget || syncing) return;
            syncing = true;
            activeTarget.scrollLeft = bar.scrollLeft;
            requestAnimationFrame(function(){ syncing = false; });
        }, { passive: true });
    }

    function mainScroller(){
        return document.getElementById('main-scroll-container') || document.querySelector('.flex-1.overflow-auto.p-6') || document.documentElement;
    }

    function isVisible(el){
        if (!el || !el.isConnected) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 20 && rect.height > 10 && rect.bottom > 0 && rect.top < window.innerHeight;
    }

    function isScrollableX(el){
        return isVisible(el) && (Number(el.scrollWidth || 0) - Number(el.clientWidth || 0) > 6);
    }

    function visibleScore(el){
        const rect = el.getBoundingClientRect();
        const top = Math.max(rect.top, 0);
        const bottom = Math.min(rect.bottom, window.innerHeight);
        const visible = Math.max(0, bottom - top);
        const centerPenalty = Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2) / 1000;
        return visible - centerPenalty;
    }

    function normalizeTarget(el){
        if (!el) return null;
        if (el.matches?.('#painel-expansoes .atlas-exp-board .atlas-exp-sub-table-wrap')) {
            return el.closest('.atlas-exp-table-wrap') || el;
        }
        return el;
    }

    function candidateFromEventTarget(target){
        const el = normalizeTarget(target?.closest?.(TARGET_SELECTOR));
        return isScrollableX(el) ? el : null;
    }

    function findBestTarget(){
        const normalizedActive = normalizeTarget(activeTarget);
        if (isScrollableX(normalizedActive)) {
            activeTarget = normalizedActive;
            return normalizedActive;
        }
        const focused = normalizeTarget(document.activeElement?.closest?.(TARGET_SELECTOR));
        if (isScrollableX(focused)) return focused;
        const list = [...new Set(Array.from(document.querySelectorAll(TARGET_SELECTOR)).map(normalizeTarget))].filter(isScrollableX);
        if (!list.length) return null;
        return list.sort((a, b) => visibleScore(b) - visibleScore(a))[0];
    }

    function footerOffset(){
        const footer = document.getElementById('atlas-footer');
        if (!footer || !footer.getBoundingClientRect) return 42;
        const rect = footer.getBoundingClientRect();
        const visibleHeight = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
        const offset = Math.max(34, Math.ceil(visibleHeight));
        document.documentElement.style.setProperty('--atlas-footer-h', offset + 'px');
        return offset + 8;
    }

    function positionBar(){
        ensureBar();
        const scroller = mainScroller();
        const rect = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { left: 0, right: window.innerWidth };
        const left = Math.max(8, rect.left + 12);
        const right = Math.max(8, window.innerWidth - rect.right + 12);
        bar.style.left = left + 'px';
        bar.style.right = right + 'px';
        bar.style.bottom = footerOffset() + 'px';
    }

    function refresh(){
        ensureBar();
        positionBar();
        const target = findBestTarget();
        activeTarget = target;
        if (!target) {
            bar.classList.remove('is-visible');
            return;
        }
        const width = Math.max(target.scrollWidth, target.clientWidth + 1);
        inner.style.width = width + 'px';
        if (bar.scrollLeft !== target.scrollLeft) bar.scrollLeft = target.scrollLeft;
        bar.classList.add('is-visible');
    }

    function scheduleRefresh(){
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function(){ raf = 0; refresh(); });
    }

    function bindTargetScroll(el){
        if (!el || el.__atlasHscrollBound) return;
        el.__atlasHscrollBound = true;
        el.addEventListener('scroll', function(){
            if (activeTarget !== el || syncing || !bar) return;
            syncing = true;
            bar.scrollLeft = el.scrollLeft;
            requestAnimationFrame(function(){ syncing = false; });
        }, { passive: true });
    }

    function bindAllTargets(){
        document.querySelectorAll(TARGET_SELECTOR).forEach(bindTargetScroll);
    }

    document.addEventListener('pointerdown', function(event){
        const target = candidateFromEventTarget(event.target);
        if (target) {
            activeTarget = target;
            bindTargetScroll(target);
            scheduleRefresh();
        }
    }, true);

    document.addEventListener('focusin', function(event){
        const target = candidateFromEventTarget(event.target);
        if (target) {
            activeTarget = target;
            bindTargetScroll(target);
            scheduleRefresh();
        }
    }, true);

    document.addEventListener('wheel', function(event){
        const target = candidateFromEventTarget(event.target);
        if (!target) return;
        activeTarget = target;
        bindTargetScroll(target);
        if (event.shiftKey && Math.abs(event.deltaY || 0) >= Math.abs(event.deltaX || 0)) {
            const before = target.scrollLeft;
            target.scrollLeft += event.deltaY;
            if (target.scrollLeft !== before) {
                event.preventDefault();
                event.stopPropagation();
                scheduleRefresh();
            }
            return;
        }
        scheduleRefresh();
    }, { passive: false, capture: true });

    window.addEventListener('resize', scheduleRefresh, { passive: true });
    window.addEventListener('scroll', scheduleRefresh, { passive: true });
    document.addEventListener('scroll', function(event){
        if (event.target === mainScroller()) scheduleRefresh();
    }, true);

    const observer = new MutationObserver(function(){
        bindAllTargets();
        bindResizeObserver();
        scheduleRefresh();
    });
    let resizeObserver = null;

    function bindResizeObserver(){
        if (!window.ResizeObserver) return;
        if (!resizeObserver) resizeObserver = new ResizeObserver(scheduleRefresh);
        const scroller = mainScroller();
        if (scroller && !scroller.__atlasHscrollResizeBound) {
            scroller.__atlasHscrollResizeBound = true;
            resizeObserver.observe(scroller);
        }
        document.querySelectorAll(TARGET_SELECTOR).forEach(el => {
            if (!el.__atlasHscrollResizeBound) {
                el.__atlasHscrollResizeBound = true;
                resizeObserver.observe(el);
            }
        });
        if (document.body && !document.body.__atlasHscrollResizeBound) {
            document.body.__atlasHscrollResizeBound = true;
            resizeObserver.observe(document.body);
        }
    }

    window.addEventListener('atlas-layout-change', function(){
        bindAllTargets();
        bindResizeObserver();
        scheduleRefresh();
        setTimeout(scheduleRefresh, 120);
        setTimeout(scheduleRefresh, 320);
    }, { passive: true });
    document.addEventListener('transitionend', function(){ scheduleRefresh(); }, true);

    function init(){
        ensureBar();
        bindAllTargets();
        bindResizeObserver();
        scheduleRefresh();
        if (document.body) observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();


/* V1.3.5 — Expansões: rolagem vertical inteligente dos subelementos.
   Com o mouse em cima dos subelementos, primeiro rola a lista interna; no topo/fim, a página volta a rolar. */
(function atlasV135ScrollVerticalSubelementosExpansoes(){
    window.__ATLAS_V135_SUBELEMENT_SCROLL__ = 'v2';

    function mainScroller(){
        return document.getElementById('main-scroll-container') || document.querySelector('.flex-1.overflow-auto.p-6') || document.scrollingElement || document.documentElement;
    }

    document.addEventListener('wheel', function(event){
        if (event.shiftKey || event.ctrlKey || event.metaKey) return;
        const deltaY = Number(event.deltaY || 0);
        const deltaX = Number(event.deltaX || 0);
        if (!deltaY || Math.abs(deltaX) > Math.abs(deltaY)) return;
        if (!window.state || state.moduloAtivo !== 'expansoes' || (state.expansoesVisualizacao || 'tabela') !== 'tabela') return;

        const wrap = event.target?.closest?.('#painel-expansoes .atlas-exp-board .atlas-exp-sub-table-wrap');
        if (!wrap) return;

        const maxTop = Math.max(0, Number(wrap.scrollHeight || 0) - Number(wrap.clientHeight || 0));
        if (maxTop <= 2) return;

        const atual = Number(wrap.scrollTop || 0);
        const proximo = Math.max(0, Math.min(maxTop, atual + deltaY));
        const podeRolarInterno = proximo !== atual;

        if (podeRolarInterno) {
            wrap.scrollTop = proximo;
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
            return;
        }

        // No topo/fim: libera a página principal para continuar a rolagem.
        const scroller = mainScroller();
        if (!scroller) return;
        const antes = scroller.scrollTop;
        scroller.scrollTop += deltaY;
        if (scroller.scrollTop !== antes) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
    }, { passive: false, capture: true });
})();


/* V1.3.5 — Expansões: barra vertical fixa para subelementos.
   Mantém a barra na lateral visível da área principal mesmo quando o usuário move o conteúdo na horizontal. */
(function atlasV135ExpansoesSubelementosBarraVerticalFixa(){
    if (window.__ATLAS_V135_EXP_SUB_VSCROLL_FIXED__) return;
    window.__ATLAS_V135_EXP_SUB_VSCROLL_FIXED__ = true;

    const TARGET_SELECTOR = '#painel-expansoes .atlas-exp-board .atlas-exp-sub-table-wrap';
    let bar = null;
    let inner = null;
    let activeTarget = null;
    let syncing = false;
    let raf = 0;
    let hideTimer = 0;

    function ensureBar(){
        if (bar && inner) return;
        bar = document.getElementById('atlas-exp-sub-vscroll-fixed');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'atlas-exp-sub-vscroll-fixed';
            bar.className = 'atlas-exp-sub-vscroll-fixed';
            bar.setAttribute('aria-label', 'Rolagem vertical dos subelementos');
            inner = document.createElement('div');
            inner.className = 'atlas-exp-sub-vscroll-inner';
            bar.appendChild(inner);
            document.body.appendChild(bar);
        } else {
            inner = bar.querySelector('.atlas-exp-sub-vscroll-inner');
            if (!inner) {
                inner = document.createElement('div');
                inner.className = 'atlas-exp-sub-vscroll-inner';
                bar.appendChild(inner);
            }
        }
        bar.addEventListener('scroll', function(){
            if (!activeTarget || syncing) return;
            syncing = true;
            activeTarget.scrollTop = bar.scrollTop;
            requestAnimationFrame(function(){ syncing = false; });
        }, { passive: true });
        bar.addEventListener('pointerenter', function(){ clearTimeout(hideTimer); }, { passive: true });
        bar.addEventListener('pointerleave', function(){ scheduleHide(1400); }, { passive: true });
    }

    function mainScroller(){
        return document.getElementById('main-scroll-container') || document.querySelector('.flex-1.overflow-auto.p-6') || document.documentElement;
    }

    function footerOffset(){
        const footer = document.getElementById('atlas-footer');
        if (!footer || !footer.getBoundingClientRect) return 34;
        const rect = footer.getBoundingClientRect();
        return Math.max(34, Math.ceil(Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top))));
    }

    function canScrollY(el){
        return !!el && el.isConnected && (Number(el.scrollHeight || 0) - Number(el.clientHeight || 0) > 4);
    }

    function isTargetVisible(el){
        if (!el || !el.isConnected) return false;
        const rect = el.getBoundingClientRect();
        const footer = footerOffset() + 14;
        return rect.height > 40 && rect.bottom > 0 && rect.top < (window.innerHeight - footer);
    }

    function findTargetFromEventTarget(node){
        const target = node?.closest?.(TARGET_SELECTOR);
        return canScrollY(target) ? target : null;
    }

    function scheduleHide(delay){
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function(){
            if (!bar) return;
            if (bar.matches(':hover')) return;
            if (activeTarget && activeTarget.matches(':hover')) return;
            bar.classList.remove('is-visible');
        }, delay || 900);
    }

    function positionBar(){
        ensureBar();
        if (!activeTarget || !isTargetVisible(activeTarget) || !canScrollY(activeTarget)) {
            bar.classList.remove('is-visible');
            return;
        }

        const targetRect = activeTarget.getBoundingClientRect();
        const main = mainScroller();
        const mainRect = main && main.getBoundingClientRect ? main.getBoundingClientRect() : { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight };
        const footer = footerOffset();
        const topLimit = Math.max(8, mainRect.top + 8);
        const bottomLimit = Math.min(window.innerHeight - footer - 28, mainRect.bottom - 8);
        const top = Math.max(topLimit, Math.min(targetRect.top + 4, bottomLimit - 72));
        const bottom = Math.min(bottomLimit, Math.max(targetRect.bottom - 4, top + 72));
        const height = Math.max(72, bottom - top);
        const right = Math.max(8, window.innerWidth - mainRect.right + 10);

        bar.style.top = top + 'px';
        bar.style.right = right + 'px';
        bar.style.height = height + 'px';
        // A altura interna é calculada para que o scrollTop do proxy seja 1:1 com o scrollTop real.
        const maxTop = Math.max(0, Number(activeTarget.scrollHeight || 0) - Number(activeTarget.clientHeight || 0));
        inner.style.height = Math.max(height + maxTop, height + 1) + 'px';
        if (bar.scrollTop !== activeTarget.scrollTop) bar.scrollTop = activeTarget.scrollTop;
        bar.classList.add('is-visible');
    }

    function scheduleRefresh(){
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function(){ raf = 0; positionBar(); });
    }

    function activate(target){
        if (!canScrollY(target)) return;
        ensureBar();
        activeTarget = target;
        if (!target.__atlasExpSubVscrollBound) {
            target.__atlasExpSubVscrollBound = true;
            target.addEventListener('scroll', function(){
                if (activeTarget !== target || syncing || !bar) return;
                syncing = true;
                bar.scrollTop = target.scrollTop;
                requestAnimationFrame(function(){ syncing = false; scheduleRefresh(); });
            }, { passive: true });
            target.addEventListener('pointerleave', function(){ scheduleHide(1800); }, { passive: true });
            target.addEventListener('pointerenter', function(){ clearTimeout(hideTimer); activate(target); }, { passive: true });
        }
        clearTimeout(hideTimer);
        scheduleRefresh();
    }

    document.addEventListener('pointermove', function(event){
        const target = findTargetFromEventTarget(event.target);
        if (target) activate(target);
    }, { passive: true, capture: true });

    document.addEventListener('pointerdown', function(event){
        const target = findTargetFromEventTarget(event.target);
        if (target) activate(target);
    }, { passive: true, capture: true });

    document.addEventListener('focusin', function(event){
        const target = findTargetFromEventTarget(event.target);
        if (target) activate(target);
    }, { passive: true, capture: true });

    document.addEventListener('wheel', function(event){
        const target = findTargetFromEventTarget(event.target);
        if (target) activate(target);
    }, { passive: true, capture: true });

    document.addEventListener('scroll', function(){
        if (activeTarget) scheduleRefresh();
    }, true);
    window.addEventListener('resize', scheduleRefresh, { passive: true });
    window.addEventListener('atlas-layout-change', function(){ setTimeout(scheduleRefresh, 60); setTimeout(scheduleRefresh, 260); }, { passive: true });
    document.addEventListener('transitionend', function(){ scheduleRefresh(); }, true);

    const observer = new MutationObserver(function(){
        if (!activeTarget || !activeTarget.isConnected || !canScrollY(activeTarget)) {
            if (bar) bar.classList.remove('is-visible');
            activeTarget = null;
        }
        scheduleRefresh();
    });

    function init(){
        ensureBar();
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* V1.3.5 — PMO copia para Expansões: ao mudar status, cria/atualiza o projeto espelhado em Expansões > Projetos. */

/* Atlas V1.4.1 - bloqueio de zoom em telas moveis. */
(function atlasV141BloqueioZoomMobile(){
    if (window.__ATLAS_V141_ZOOM_MOBILE__) return;
    window.__ATLAS_V141_ZOOM_MOBILE__ = true;
    const mobile = window.matchMedia('(max-width: 900px)');

    function bloquearGesto(event){
        if (mobile.matches) event.preventDefault();
    }

    ['gesturestart', 'gesturechange', 'gestureend'].forEach(tipo => {
        document.addEventListener(tipo, bloquearGesto, { passive: false, capture: true });
    });
    document.addEventListener('touchmove', function(event){
        if (mobile.matches && event.touches?.length > 1) event.preventDefault();
    }, { passive: false, capture: true });
    document.addEventListener('wheel', function(event){
        if (mobile.matches && event.ctrlKey) event.preventDefault();
    }, { passive: false, capture: true });
})();

/* Atlas V1.4.1 - uma unica posicao horizontal por grupo em Expansoes > Projetos. */
(function atlasV141SincronizarScrollProjetosExpansoes(){
    if (window.__ATLAS_V141_EXP_PROJETOS_SCROLL__) return;
    window.__ATLAS_V141_EXP_PROJETOS_SCROLL__ = true;
    const GROUP_SELECTOR = '#painel-expansoes .atlas-exp-board .atlas-exp-group';
    const posicoesPorGrupo = new Map();
    let raf = 0;

    function maxLeft(elemento){
        return Math.max(0, Number(elemento?.scrollWidth || 0) - Number(elemento?.clientWidth || 0));
    }

    function targetsDoGrupo(grupo){
        const principal = grupo?.querySelector('.atlas-exp-table-wrap');
        if (!principal) return [];
        return [principal, ...grupo.querySelectorAll('.atlas-exp-sub-table-wrap')];
    }

    function chaveDoGrupo(grupo){
        return String(grupo?.dataset?.expGrupo || grupo?.querySelector('.atlas-exp-group-title')?.textContent || '').trim();
    }

    function aplicarProporcao(grupo, proporcao, origem = null){
        grupo.__atlasExpScrollSyncing = true;
        targetsDoGrupo(grupo).forEach(destino => {
            if (destino === origem) return;
            const proximo = Math.round(maxLeft(destino) * proporcao);
            destino.__atlasExpLastHorizontal = proximo;
            if (Math.abs(Number(destino.scrollLeft || 0) - proximo) > 1) destino.scrollLeft = proximo;
        });
        requestAnimationFrame(() => {
            grupo.__atlasExpScrollSyncing = false;
        });
    }

    function sincronizar(grupo, origem){
        if (!grupo || grupo.__atlasExpScrollSyncing) return;
        const maxOrigem = maxLeft(origem);
        const proporcao = maxOrigem > 0 ? Math.max(0, Math.min(1, Number(origem.scrollLeft || 0) / maxOrigem)) : 0;
        const chave = chaveDoGrupo(grupo);
        if (chave) posicoesPorGrupo.set(chave, proporcao);
        aplicarProporcao(grupo, proporcao, origem);
    }

    function vincularAlvo(grupo, alvo){
        if (!alvo || alvo.__atlasExpHorizontalBound) return;
        alvo.__atlasExpHorizontalBound = true;
        alvo.__atlasExpLastHorizontal = Number(alvo.scrollLeft || 0);
        alvo.addEventListener('scroll', function(){
            const atual = Number(alvo.scrollLeft || 0);
            if (Math.abs(atual - Number(alvo.__atlasExpLastHorizontal || 0)) <= 1) return;
            alvo.__atlasExpLastHorizontal = atual;
            sincronizar(grupo, alvo);
        }, { passive: true });
    }

    function vincularGrupo(grupo){
        const alvos = targetsDoGrupo(grupo);
        if (!alvos.length) return;
        alvos.forEach(alvo => vincularAlvo(grupo, alvo));
        const principal = alvos[0];
        const chave = chaveDoGrupo(grupo);
        if (chave && posicoesPorGrupo.has(chave)) {
            aplicarProporcao(grupo, posicoesPorGrupo.get(chave));
        } else if (alvos.length > 1) {
            sincronizar(grupo, principal);
        }
    }

    function atualizar(){
        raf = 0;
        document.querySelectorAll(GROUP_SELECTOR).forEach(vincularGrupo);
    }

    function agendar(){
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(atualizar);
    }

    document.addEventListener('pointerdown', function(event){
        const grupo = event.target?.closest?.(GROUP_SELECTOR);
        if (grupo) vincularGrupo(grupo);
    }, { passive: true, capture: true });
    window.addEventListener('resize', agendar, { passive: true });
    window.addEventListener('atlas-layout-change', agendar, { passive: true });

    const observer = new MutationObserver(agendar);
    function iniciar(){
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
        agendar();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();

    window.atlasV141AtualizarScrollProjetosExpansoes = agendar;
})();

