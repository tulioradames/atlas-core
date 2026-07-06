const SUPABASE_URL = window.ATNX_CONFIG.SUPABASE_URL;
        const SUPABASE_KEY = window.ATNX_CONFIG.SUPABASE_KEY;
        // Cole aqui a URL do Google Apps Script publicado como Web App.
        // As imagens serão enviadas para esse endpoint, salvas no Google Drive
        // e somente os metadados/link serão registrados no Supabase.
        const GOOGLE_DRIVE_UPLOAD_URL = window.ATNX_CONFIG.GOOGLE_DRIVE_UPLOAD_URL;
        // Proxy interno do Cloudflare. Evita bloqueios de navegador contra script.google.com.
        const GOOGLE_DRIVE_PROXY_URL = window.ATNX_CONFIG.GOOGLE_DRIVE_PROXY_URL || '/api/drive';
        const GOOGLE_DRIVE_EXPANSOES_FOLDER_URL = window.ATNX_CONFIG.GOOGLE_DRIVE_EXPANSOES_FOLDER_URL || '';
        const GOOGLE_DRIVE_EXPANSOES_FOLDER_ID = window.ATNX_CONFIG.GOOGLE_DRIVE_EXPANSOES_FOLDER_ID || '';
        const LIMITE_UPLOAD_MB = window.ATNX_CONFIG.LIMITE_UPLOAD_MB;
        let supabaseClient;
        
        try {
            const lib = window.supabase || window.Supabase;
            supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_KEY);
        } catch(e) {
            document.getElementById('status-banco-alerta').className = "bg-red-600 text-white text-center py-2 font-semibold text-xs z-50";
            document.getElementById('status-banco-alerta').innerText = "❌ Falha crítica ao carregar as dependências.";
        }

        let state = { sidebarAberta: true, moduloAtivo: 'documentacao', obraAtiva: '', abaAtiva: 'CTO', termoPesquisa: '', linhasExpandidas: {}, obras: [], elementos: [], selecionados: { elementos: {}, subelementos: {} }, cacheElementosPorObra: {}, carregandoObra: false, adminObras: [], adminCarregando: false, adminErro: '', adminSecoesAbertas: { a_realizar: true, em_andamento: true, parada: true, concluida: true }, adminDetalhesAbertos: {}, adminVisualizacao: 'status', adminGanttFullscreen: false, adminGanttZoom: 1, adminGanttFiltro: '', adminGanttEscala: 'meses', adminGanttModoApresentacao: false, executivoCarregando: false, executivoErro: '', historicoSemanal: [], expansoes: [], expansoesSubitems: [], expansoesCarregando: false, expansoesErro: '', expansoesAbertas: { em_progresso: true, grande_porte: true, concluidos: true }, expansoesProjetosAbertos: {}, expansoesVisualizacao: 'tabela', expansoesGanttZoom: 1, expansoesGanttEscala: 'meses', expansoesGanttFullscreen: false, expansaoFormularioAberto: false, expansaoFormularioEditandoId: null, expansaoLinhaNovaGrupo: null, expansaoSubitemNovoProjetoId: null, auditoria: [], auditoriaCarregando: false, auditoriaErro: '', auditoriaAberta: false, auditoriaTermo: '', tema: localStorage.getItem('atnx-tema') || 'light' };

        const ATNX_COR_OFICIAL = '#0073ea';

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

        let tokenCarregamentoObra = 0;
        let preCarregamentoObrasEmExecucao = false;

        function toggleSidebar() {
            state.sidebarAberta = !state.sidebarAberta;
            const sb = document.getElementById('sidebar-container');
            const btnAbrir = document.getElementById('btn-abrir-sidebar');
            const header = document.getElementById('header-conteudo');

            if (state.sidebarAberta) {
                sb.classList.remove('w-0', 'border-r-0');
                sb.classList.add('w-72');
                btnAbrir.classList.add('hidden');
                header.classList.remove('pl-16');
            } else {
                sb.classList.remove('w-72');
                sb.classList.add('w-0', 'border-r-0');
                btnAbrir.classList.remove('hidden');
                header.classList.add('pl-16');
            }
        }

        async function inicializarBanco() {
            const alerta = document.getElementById('status-banco-alerta');
            const badge = document.getElementById('badge-status');
            if (!supabaseClient) return;

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
            } catch (err) {
                console.error(err);
                alerta.className = "bg-red-600 text-white text-center py-2 font-semibold text-xs z-50";
                alerta.innerText = "⚠️ Erro de sincronização: " + err.message;
                state.carregandoObra = false;
            }
            renderApp();
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
            'atnx-status-control-admin_a_realizar'
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

            let html = '<div class="flex gap-1 justify-center flex-wrap">';
            midias.forEach((midia, index) => {
                const nome = escaparHtml(midia.nome || midia.name || 'Imagem');
                const imgUrl = escaparHtml(midia.thumbnailUrl || midia.url || midia.webContentLink || '');
                const linkUrl = escaparHtml(midia.viewUrl || midia.webViewLink || midia.url || '#');

                if (!imgUrl) return;

                html += `
                    <div class="media-item relative inline-block" onclick="event.stopPropagation()" title="${nome}">
                        <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
                            <img src="${imgUrl}" class="w-6 h-6 object-cover rounded ${classeBorda}" onerror="this.style.opacity='0.35'; this.title='Imagem salva, mas miniatura indisponível';">
                        </a>
                        <button type="button" class="media-delete-btn" onclick="excluirMidia('${subId}', '${campo}', ${index}, event)" title="Remover imagem do site; imagens importadas do Drive serão preservadas">×</button>
                    </div>`;
            });
            html += '</div>';
            return html;
        }

        function exibirStatusTemporario(mensagem, classe = 'bg-[#0073ea]') {
            const alerta = document.getElementById('status-banco-alerta');
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

        async function lerRespostaJsonGoogleDrive(resposta, mensagemErroJson) {
            const texto = await resposta.text();
            let resultado;
            try {
                resultado = JSON.parse(texto);
            } catch (e) {
                throw new Error(mensagemErroJson || 'O endpoint do Google Drive não retornou JSON válido.');
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
            if (!GOOGLE_DRIVE_UPLOAD_URL || GOOGLE_DRIVE_UPLOAD_URL.includes('COLE_AQUI')) {
                throw new Error('Configure a constante GOOGLE_DRIVE_UPLOAD_URL com a URL do Apps Script publicado como Web App.');
            }

            const resposta = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
                method: 'POST',
                body: JSON.stringify(payload || {}),
                redirect: 'follow'
            });

            return await lerRespostaJsonGoogleDrive(resposta, mensagemErroJson || 'O Apps Script não retornou JSON válido. Verifique a implantação do Web App.');
        }

        async function enviarImagemParaGoogleDrive(file, subId, campo, contextoOpcional) {
            if (!GOOGLE_DRIVE_UPLOAD_URL || GOOGLE_DRIVE_UPLOAD_URL.includes('COLE_AQUI')) {
                throw new Error('Configure a constante GOOGLE_DRIVE_UPLOAD_URL com a URL do Apps Script publicado como Web App.');
            }

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
                tipoMidia: campo
            };

            return await chamarEndpointGoogleDrive(payload, 'O endpoint do Google Drive não retornou JSON válido no upload individual.');
        }


        async function enviarImagensParaGoogleDriveEmLote(arquivos, subId, campo, contextoOpcional) {
            if (!Array.isArray(arquivos) || arquivos.length === 0) return [];
            if (!GOOGLE_DRIVE_UPLOAD_URL || GOOGLE_DRIVE_UPLOAD_URL.includes('COLE_AQUI')) {
                throw new Error('Configure a constante GOOGLE_DRIVE_UPLOAD_URL com a URL do Apps Script publicado como Web App.');
            }

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

        async function excluirArquivoNoGoogleDrive(fileId) {
            if (!fileId) return;
            if (!GOOGLE_DRIVE_UPLOAD_URL || GOOGLE_DRIVE_UPLOAD_URL.includes('COLE_AQUI')) {
                throw new Error('Configure a constante GOOGLE_DRIVE_UPLOAD_URL para excluir arquivos do Google Drive.');
            }

            await chamarEndpointGoogleDrive({ action: 'delete', fileId }, 'O endpoint do Google Drive não retornou JSON válido ao excluir a imagem.');
        }

        async function excluirArquivosNoGoogleDrive(fileIds) {
            const ids = [...new Set((fileIds || []).filter(Boolean).map(String))];
            if (ids.length === 0) return { success: true, deletedCount: 0 };
            if (ids.length === 1) {
                await excluirArquivoNoGoogleDrive(ids[0]);
                return { success: true, deletedCount: 1 };
            }

            if (!GOOGLE_DRIVE_UPLOAD_URL || GOOGLE_DRIVE_UPLOAD_URL.includes('COLE_AQUI')) {
                throw new Error('Configure a constante GOOGLE_DRIVE_UPLOAD_URL para excluir arquivos do Google Drive.');
            }

            return await chamarEndpointGoogleDrive({ action: 'deleteFiles', fileIds: ids }, 'O endpoint do Google Drive não retornou JSON válido ao excluir imagens em lote.');
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
                targetType: tipo,
                folderId,
                fileIds,
                path
            };
        }

        async function excluirPastaNoGoogleDrive(payload) {
            if (!GOOGLE_DRIVE_UPLOAD_URL || GOOGLE_DRIVE_UPLOAD_URL.includes('COLE_AQUI')) {
                throw new Error('Configure a constante GOOGLE_DRIVE_UPLOAD_URL para excluir pastas do Google Drive.');
            }

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
            return window.ATNX_CONFIG.GOOGLE_DRIVE_FOLDER_URL || (window.ATNX_CONFIG.GOOGLE_DRIVE_FOLDER_ID ? `https://drive.google.com/drive/folders/${window.ATNX_CONFIG.GOOGLE_DRIVE_FOLDER_ID}` : '');
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
            const separador = GOOGLE_DRIVE_UPLOAD_URL.includes('?') ? '&' : '?';
            return GOOGLE_DRIVE_UPLOAD_URL + separador + params.toString();
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
            if (!GOOGLE_DRIVE_UPLOAD_URL || GOOGLE_DRIVE_UPLOAD_URL.includes('COLE_AQUI')) {
                return Promise.reject(new Error('Configure a constante GOOGLE_DRIVE_UPLOAD_URL com a URL do Apps Script publicado como Web App.'));
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
            const nomeModuloDrive = state.moduloAtivo === 'expansoes' ? 'Expansões' : 'Atlas';
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
            { id: 'a_realizar', titulo: 'Documentações para ser realizada', icone: '📝' },
            { id: 'em_andamento', titulo: 'Documentações em Andamento', icone: '🚧' },
            { id: 'parada', titulo: 'Obras Paradas', icone: '⛔' },
            { id: 'concluida', titulo: 'Documentação concluída', icone: '✅' }
        ];
        const ADMIN_STATUS_PARADA = { id: 'parada', titulo: 'Obras Paradas', icone: '⛔' };
        const ADMIN_STATUS_TODOS = ADMIN_STATUS;


        function normalizarStatusAdminValor(statusId, fallback = 'a_realizar') {
            return ADMIN_STATUS_TODOS.some(st => st.id === statusId) ? statusId : fallback;
        }

        function obterStatusCategoriaAdmin(item, categoria) {
            const campo = categoria === 'cto' ? 'ctos_status' : categoria === 'ceo' ? 'caixas_status' : 'pops_status';
            return normalizarStatusAdminValor(item?.[campo], normalizarStatusAdminValor(item?.status || 'a_realizar'));
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

        function renderOpcoesStatusAdmin(statusAtual) {
            return ADMIN_STATUS_TODOS.map(st => `<option value="${st.id}" ${st.id === statusAtual ? 'selected' : ''}>${st.icone} ${escaparHtml(st.titulo)}</option>`).join('');
        }

        function obterTituloStatusAdmin(statusAtual) {
            const status = normalizarStatusAdminValor(statusAtual || 'a_realizar');
            const itemStatus = ADMIN_STATUS_TODOS.find(st => st.id === status) || ADMIN_STATUS_TODOS[0];
            return itemStatus?.titulo || 'Documentações para ser realizada';
        }

        function chaveStatusAdminVisual(statusAtual) {
            const status = normalizarStatusAdminValor(statusAtual || 'a_realizar');
            if (status === 'concluida') return 'admin_concluida';
            if (status === 'em_andamento') return 'admin_em_andamento';
            if (status === 'parada') return 'admin_parada';
            return 'admin_a_realizar';
        }

        function classeStatusAdminSelect(statusAtual) {
            const status = normalizarStatusAdminValor(statusAtual || 'a_realizar');
            return `atnx-admin-status-select status-${status} atnx-status-select-${chaveStatusAdminVisual(status)}`;
        }

        function renderizarSelectStatusAdmin(statusAtual, onchange, pequeno = false) {
            const status = normalizarStatusAdminValor(statusAtual || 'a_realizar');
            const chave = chaveStatusAdminVisual(status);
            const classeTamanho = pequeno ? 'atnx-status-control-sm' : 'atnx-status-control-md';
            const classeSelect = pequeno ? 'atnx-admin-select-sm' : '';
            return `<span data-status-key="${chave}" class="atnx-status-control atnx-admin-status-control atnx-status-control-${chave} ${classeTamanho}">
                <span class="atnx-status-dot" aria-hidden="true"></span>
                <span class="atnx-status-label">${escaparHtml(obterTituloStatusAdmin(status))}</span>
                <select aria-label="Alterar status" data-status-key="${chave}" class="atnx-admin-select ${classeSelect} ${classeStatusAdminSelect(status)} atnx-status-native" onchange="${onchange}">${renderOpcoesStatusAdmin(status)}</select>
                <span class="atnx-status-arrow" aria-hidden="true">▾</span>
            </span>`;
        }

        const SQL_ADMIN_OBRAS = `CREATE TABLE IF NOT EXISTS public.admin_documentacoes (
  id text PRIMARY KEY,
  cidade text NOT NULL,
  status text NOT NULL DEFAULT 'a_realizar',
  ctos_total integer NOT NULL DEFAULT 0,
  ctos_documentadas integer NOT NULL DEFAULT 0,
  ctos_status text NOT NULL DEFAULT 'a_realizar',
  ctos_data_inicio date,
  ctos_data_previsao_final date,
  caixas_total integer NOT NULL DEFAULT 0,
  caixas_documentadas integer NOT NULL DEFAULT 0,
  caixas_status text NOT NULL DEFAULT 'a_realizar',
  caixas_data_inicio date,
  caixas_data_previsao_final date,
  pops_total integer NOT NULL DEFAULT 0,
  pops_documentados integer NOT NULL DEFAULT 0,
  pops_status text NOT NULL DEFAULT 'a_realizar',
  pops_data_inicio date,
  pops_data_previsao_final date,
  data_inicio date,
  data_previsao_final date,
  data_conclusao date,
  observacao_categoria text DEFAULT 'Sem categoria',
  observacoes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS data_inicio date;

ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS data_previsao_final date;

ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS data_conclusao date;

ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS ctos_status text NOT NULL DEFAULT 'a_realizar';
ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS ctos_data_inicio date;
ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS ctos_data_previsao_final date;

ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS caixas_status text NOT NULL DEFAULT 'a_realizar';
ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS caixas_data_inicio date;
ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS caixas_data_previsao_final date;

ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS pops_status text NOT NULL DEFAULT 'a_realizar';
ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS pops_data_inicio date;
ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS pops_data_previsao_final date;

ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS observacao_categoria text DEFAULT 'Sem categoria';

ALTER TABLE public.admin_documentacoes
DROP CONSTRAINT IF EXISTS admin_documentacoes_status_check;

ALTER TABLE public.admin_documentacoes
ADD CONSTRAINT admin_documentacoes_status_check
CHECK (
  status IN ('a_realizar', 'em_andamento', 'concluida', 'parada') AND
  ctos_status IN ('a_realizar', 'em_andamento', 'concluida', 'parada') AND
  caixas_status IN ('a_realizar', 'em_andamento', 'concluida', 'parada') AND
  pops_status IN ('a_realizar', 'em_andamento', 'concluida', 'parada')
);

ALTER TABLE public.admin_documentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ATNX admin_documentacoes public read" ON public.admin_documentacoes;
CREATE POLICY "ATNX admin_documentacoes public read"
ON public.admin_documentacoes FOR SELECT
USING (true);

DROP POLICY IF EXISTS "ATNX admin_documentacoes public insert" ON public.admin_documentacoes;
CREATE POLICY "ATNX admin_documentacoes public insert"
ON public.admin_documentacoes FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "ATNX admin_documentacoes public update" ON public.admin_documentacoes;
CREATE POLICY "ATNX admin_documentacoes public update"
ON public.admin_documentacoes FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "ATNX admin_documentacoes public delete" ON public.admin_documentacoes;
CREATE POLICY "ATNX admin_documentacoes public delete"
ON public.admin_documentacoes FOR DELETE
USING (true);`;

        function atualizarVisibilidadeModulos() {
            const admin = state.moduloAtivo === 'admin_obras';
            const executivo = false;
            const expansoes = state.moduloAtivo === 'expansoes';
            const modoEspecial = admin || executivo || expansoes;
            document.body?.classList.toggle('atnx-admin-mode', admin);
            document.body?.classList.toggle('atlas-expansoes-mode', expansoes);
            document.body?.classList.toggle('atlas-executivo-mode', executivo);
            const painelDoc = document.getElementById('painel-documentacao');
            const painelAdmin = document.getElementById('painel-admin-obras');
            const painelExecutivo = document.getElementById('painel-executivo');
            const painelExpansoes = document.getElementById('painel-expansoes');
            const painelAuditoria = document.getElementById('painel-auditoria');
            const tabs = document.getElementById('tabs-container');
            const btnAtivo = document.getElementById('btn-adicionar-ativo');
            const btnCidadeAdmin = document.getElementById('btn-adicionar-cidade-admin');
            const btnAdicionarExpansao = document.getElementById('btn-adicionar-expansao');
            const btnSnapshot = document.getElementById('btn-snapshot-semanal');
            const btnDoc = document.getElementById('btn-modulo-documentacao');
            const btnAdmin = document.getElementById('btn-modulo-admin-obras');
            const btnExpansoes = document.getElementById('btn-modulo-expansoes');
            const search = document.getElementById('search-input');
            const sidebarObrasSection = document.getElementById('sidebar-obras-section');

            painelDoc?.classList.toggle('hidden', modoEspecial);
            painelAdmin?.classList.toggle('hidden', !admin);
            painelExpansoes?.classList.toggle('hidden', !expansoes);
            painelAuditoria?.classList.add('hidden');
            tabs?.classList.toggle('hidden', modoEspecial);
            if (tabs && modoEspecial) tabs.innerHTML = '';
            btnAtivo?.classList.toggle('hidden', modoEspecial);
            btnAtivo?.classList.toggle('flex', !modoEspecial);
            btnCidadeAdmin?.classList.toggle('hidden', !admin);
            btnCidadeAdmin?.classList.toggle('flex', admin);
            btnAdicionarExpansao?.classList.toggle('hidden', !expansoes);
            btnAdicionarExpansao?.classList.toggle('flex', expansoes);
            const painelAtivo = admin && (state.adminVisualizacao || 'status') === 'painel';
            btnSnapshot?.classList.toggle('hidden', !painelAtivo);
            btnSnapshot?.classList.toggle('flex', painelAtivo);
            if (btnCidadeAdmin) btnCidadeAdmin.innerHTML = '➕ Cadastrar Cidade';

            btnDoc?.classList.toggle('active', state.moduloAtivo === 'documentacao');
            btnAdmin?.classList.toggle('active', admin);
            btnExpansoes?.classList.toggle('active', expansoes);

            sidebarObrasSection?.classList.toggle('hidden', modoEspecial);

            if (search) {
                search.placeholder = admin ? ((state.adminVisualizacao || 'status') === 'painel' ? 'Pesquisar no painel...' : 'Pesquisar cidade...') : expansoes ? 'Pesquisar expansão...' : 'Pesquisar...';
            }
        }

        async function alternarModulo(modulo) {
            const modulosValidos = ['documentacao', 'admin_obras', 'expansoes'];
            state.moduloAtivo = modulosValidos.includes(modulo) ? modulo : 'documentacao';
            atualizarVisibilidadeModulos();

            if (state.moduloAtivo === 'admin_obras') {
                if (state.adminObras.length === 0 && !state.adminCarregando) await carregarAdminObras();
                else renderApp();
                return;
            }
            if (state.moduloAtivo === 'expansoes') {
                await carregarExpansoes();
                return;
            }
            renderApp();
        }

        function handleSearch(valor) {
            state.termoPesquisa = String(valor || '');
            if (state.moduloAtivo === 'expansoes') renderExpansoes();
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

            try {
                const { data, error } = await supabaseClient
                    .from(ADMIN_OBRAS_TABELA)
                    .select('*')
                    .order('created_at', { ascending: true });

                if (error) throw error;
                state.adminObras = data || [];
                state.adminErro = '';
            } catch (err) {
                console.error('Erro ao carregar documentação rede geral:', err);
                state.adminErro = err.message || String(err);
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
            const status = normalizarStatusAdminValor(novoStatus);
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
            state.adminDetalhesAbertos[id] = state.adminDetalhesAbertos[id] === false ? true : false;
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
                            <span>🏙️ ${escaparHtml(item.cidade || 'Cidade sem nome')}</span>
                            <span class="text-[10px] text-gray-500">${progresso.percentual}%</span>
                        </div>
                        <div class="atnx-admin-card-summary">${statusInfo.icone} ${escaparHtml(statusInfo.titulo)} · ${progresso.feito} itens documentados</div>
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
                            ${renderizarSelectStatusAdmin(statusCto, `alterarStatusCategoriaAdmin('${item.id}', 'cto', this.value)`, true)}
                        </div>
                        <div class="atnx-admin-item-status-row">
                            <span class="atnx-admin-item-status-label">CEO</span>
                            ${renderizarSelectStatusAdmin(statusCeo, `alterarStatusCategoriaAdmin('${item.id}', 'ceo', this.value)`, true)}
                        </div>
                        <div class="atnx-admin-item-status-row">
                            <span class="atnx-admin-item-status-label">POP</span>
                            ${renderizarSelectStatusAdmin(statusPop, `alterarStatusCategoriaAdmin('${item.id}', 'pop', this.value)`, true)}
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
                    Abra o SQL Editor do Supabase, execute o comando abaixo e recarregue o Atlas.
                </div>
                <pre>${escaparHtml(SQL_ADMIN_OBRAS)}</pre>
                <button class="bg-[#0073ea] hover:bg-[#0073ea] text-white px-4 py-2 rounded text-xs font-medium" onclick="navigator.clipboard?.writeText(SQL_ADMIN_OBRAS); exibirStatusTemporario('📋 SQL copiado.', 'bg-[#0073ea]')">Copiar SQL</button>
                <button class="ml-2 bg-[#2f314e] hover:bg-[#3d4066] text-white px-4 py-2 rounded text-xs font-medium" onclick="carregarAdminObras()">Tentar novamente</button>
                <div class="text-red-300 text-[10px] mt-3">Erro recebido: ${escaparHtml(state.adminErro)}</div>
            </div>`;
        }


        function definirVisualizacaoAdmin(tipo) {
            state.adminVisualizacao = ['status', 'gantt', 'painel'].includes(tipo) ? tipo : 'status';
            if (state.adminVisualizacao !== 'gantt') {
                state.adminGanttFullscreen = false;
            }
            atualizarVisibilidadeModulos();
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
            const ativo = state.adminVisualizacao || 'status';
            return `<div class="atnx-admin-view-tabs" aria-label="Visualização da Documentação Rede Geral">
                <button class="atnx-admin-view-tab ${ativo === 'status' ? 'active' : ''}" onclick="definirVisualizacaoAdmin('status')">▦ Status</button>
                <button class="atnx-admin-view-tab ${ativo === 'gantt' ? 'active' : ''}" onclick="definirVisualizacaoAdmin('gantt')">▰ Cronograma</button>
                <button class="atnx-admin-view-tab ${ativo === 'painel' ? 'active' : ''}" onclick="definirVisualizacaoAdmin('painel')">▤ Painel</button>
            </div>`;
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
                return `<div class="atnx-gantt-bar ${escaparHtml(statusId)}${classeFilha}" style="left:${left}px; width:${width}px" title="${escaparHtml(titulo || label)}"></div>
                    <div class="atnx-gantt-bar-label-outside ${filha ? 'child' : 'parent'}" style="left:${left + width + 8}px" title="${escaparHtml(label)}">${escaparHtml(label)}</div>`;
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
            { id: 'concluidos', titulo: 'Projetos Concluídos', cor: '#00c875', icone: '›' }
        ];

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
                    usuario: 'Atlas Web',
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
                return `<article class="atlas-auditoria-item">
                    <div class="atlas-auditoria-item-top">
                        <span class="atlas-auditoria-action">${acao}</span>
                        <time>${formatarDataHoraAtnx(item.created_at)}</time>
                    </div>
                    <div class="atlas-auditoria-entity">${nome}</div>
                    <div class="atlas-auditoria-meta"><span>${tipo}</span><span>${campo}</span></div>
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
            const seguro = escaparHtml(link);
            return `<a class="atlas-link atlas-exp-file-link" target="_blank" rel="noopener" href="${seguro}">${escaparHtml(rotulo)}</a>`;
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

        async function carregarExpansoes() {
            if (!supabaseClient) return;
            state.expansoesCarregando = true;
            state.expansoesErro = '';
            renderExpansoes();
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
            } catch (err) {
                state.expansoesErro = err.message || String(err);
                state.expansoes = [];
                state.expansoesSubitems = [];
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
        const ATLAS_EXP_NUMBER_FIELDS = new Set(['subelementos', 'duracao_lancamento', 'duracao_fusao', 'qtde_ctos', 'metragem_cabo', 'qtde_ceos', 'duracao_cto', 'duracao_ceo', 'equipes_lancamento', 'equipes_fusao', 'duracao']);
        const ATLAS_EXP_DATE_FIELDS = new Set(['data_conclusao', 'timeline_inicio', 'timeline_fim']);
        const ATLAS_EXP_INT_FIELDS = new Set(['subelementos', 'qtde_ctos', 'qtde_ceos']);

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
                    await excluirArquivoNoGoogleDrive(fileId);
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
            const thumbs = midias.map((midia, index) => {
                const imgUrl = escaparHtml(obterUrlImagemExpansao(midia));
                const linkUrl = escaparHtml(obterUrlAbrirImagemExpansao(midia));
                const nome = escaparHtml(midia.nome || `Imagem ${index + 1}`);
                if (!imgUrl) return '';
                return `<div class="atlas-exp-media-item" title="${nome}">
                    <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
                        <img src="${imgUrl}" alt="${nome}" loading="lazy" onerror="this.closest('.atlas-exp-media-item')?.classList.add('is-broken'); this.style.display='none';">
                        <span class="atlas-exp-media-fallback">IMG</span>
                    </a>
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
            if (!GOOGLE_DRIVE_UPLOAD_URL || GOOGLE_DRIVE_UPLOAD_URL.includes('COLE_AQUI')) {
                throw new Error('Configure a constante GOOGLE_DRIVE_UPLOAD_URL com a URL do Apps Script publicado como Web App.');
            }
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
            if (!GOOGLE_DRIVE_UPLOAD_URL || GOOGLE_DRIVE_UPLOAD_URL.includes('COLE_AQUI')) {
                throw new Error('Configure a constante GOOGLE_DRIVE_UPLOAD_URL com a URL do Apps Script publicado como Web App.');
            }
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
                            await excluirArquivosNoGoogleDrive(antigosFileIds);
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
                if (fileId) await excluirArquivoNoGoogleDrive(fileId);
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
            const conteudo = arquivos.length ? arquivos.map((arquivo, index) => {
                const nome = escaparHtml(arquivo.nome || cfg.label);
                const link = escaparHtml(arquivo.viewUrl || arquivo.url || '#');
                return `<div class="atlas-exp-file-pill" title="${nome}">
                    <a href="${link}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"><span>${escaparHtml(cfg.icon)}</span><strong>${nome}</strong></a>
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
            if (links.length > 0) window.open(links[0], '_blank', 'noopener,noreferrer');
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
                return renderSelectStatusExpansao(valor, `${comum} onchange="atualizarClasseSelectStatusExpansao(this);${salvar}"`);
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
            return `<input class="atlas-exp-cell-control" type="${inputType}" value="${escaparHtml(opcoes.value || '')}" ${step}${min} data-new-sub-campo="${escaparHtml(campo)}" placeholder="${escaparHtml(opcoes.placeholder || '')}">`;
        }

        function atualizarEstadoLocalExpansao(tipo, id, campo, valor) {
            const lista = tipo === 'subitem' ? state.expansoesSubitems : state.expansoes;
            const item = (lista || []).find(reg => reg.id === id);
            if (item) item[campo] = valor;
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
            if (tipo === 'subitem' && (campo === 'timeline_inicio' || campo === 'timeline_fim')) {
                const inicio = campo === 'timeline_inicio' ? normalizado : item?.timeline_inicio;
                const fim = campo === 'timeline_fim' ? normalizado : item?.timeline_fim;
                const duracaoAuto = calcularDiasUteisExpansao(inicio, fim);
                updatePayload.duracao = duracaoAuto;
                atualizarEstadoLocalExpansao(tipo, id, 'duracao', duracaoAuto);
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
            } catch (err) {
                await alertaVisualAtnx('Erro ao salvar campo', err.message || String(err));
                await carregarExpansoes();
            }
        }

        function renderSubitemExpansao(sub) {
            return `<tr class="atlas-exp-sub-row">
                <td class="atlas-exp-check"><input type="checkbox" aria-label="Selecionar subitem" /></td>
                <td class="atlas-exp-sub-name-cell">${renderCampoEditavelExpansao('subitem', sub.id, 'nome', sub.nome || '', { placeholder: 'Subelemento' })}</td>
                <td class="atlas-exp-comment-cell"><button type="button" title="Remover subitem" onclick="excluirSubitemExpansao('${sub.id}')">🗑</button></td>
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

        function renderProjetoExpansao(projeto) {
            const aberto = !!state.expansoesProjetosAbertos[projeto.id];
            const subs = (state.expansoesSubitems || []).filter(s => s.expansao_id === projeto.id);
            const subitemsHtml = aberto ? renderTabelaSubitemsExpansao(subs, projeto.id) : '';
            return `<tr class="atlas-exp-row atlas-exp-row-projeto">
                <td class="atlas-exp-check"><input type="checkbox" aria-label="Selecionar ${escaparHtml(projeto.nome || 'projeto')}" /></td>
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
                <td class="atlas-exp-row-remove"><button type="button" title="Remover projeto" onclick="excluirExpansao('${projeto.id}')">🗑</button></td>
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
            const linhaNova = state.expansaoLinhaNovaGrupo === grupo.id ? renderNovaLinhaProjetoExpansao(grupo.id) : renderLinhaAdicionarProjetoExpansao(grupo.id);
            const table = `<div class="atlas-exp-table-wrap">
                <table class="atlas-exp-table">
                    <thead><tr>
                        <th class="atlas-exp-check"><input type="checkbox" disabled /></th>
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
            return `<section class="atlas-exp-group">${header}${body}</section>`;
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
            state.expansoesVisualizacao = tipo === 'gantt' ? 'gantt' : 'tabela';
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

        function alternarTelaCheiaGanttExpansoes() {
            state.expansoesGanttFullscreen = !state.expansoesGanttFullscreen;
            renderExpansoes();
            setTimeout(() => centralizarHojeGanttExpansoes(), 80);
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
            const subsTodos = state.expansoesSubitems || [];
            const linhas = [];
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
                            grupo: grupo.titulo,
                            nome: projeto.nome || 'Projeto sem nome',
                            status: projeto.status || 'Em Progresso',
                            inicio: periodo.inicio,
                            fim: periodo.fim,
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
                            grupo: grupo.titulo,
                            nome: sub.nome || 'Subelemento sem nome',
                            status: sub.status || projeto.status || 'Em Progresso',
                            inicio,
                            fim,
                            meta: projeto.nome || 'Projeto sem nome',
                            projetoNome: projeto.nome || ''
                        });
                    });
                });
            });
            return linhas.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)) || (a.tipo === 'projeto' ? -1 : 1));
        }

        function renderExpansoesViewTabs() {
            const ativo = state.expansoesVisualizacao || 'tabela';
            return `<div class="atlas-exp-view-tabs" aria-label="Visualização de Expansões">
                <button type="button" class="${ativo !== 'gantt' ? 'active' : ''}" onclick="definirVisualizacaoExpansoes('tabela')">Tabela</button>
                <button type="button" class="${ativo === 'gantt' ? 'active' : ''}" onclick="definirVisualizacaoExpansoes('gantt')">Gantt</button>
            </div>`;
        }

        function renderGanttExpansoes(projetos, termo) {
            const linhas = montarLinhasGanttExpansoes(projetos, termo);
            const zoom = Number(state.expansoesGanttZoom || 1);
            const escala = state.expansoesGanttEscala || 'meses';
            const fullscreen = !!state.expansoesGanttFullscreen;
            const pxPorDia = obterPxPorDiaGantt(escala, zoom);
            const percentualZoom = Math.round(zoom * 100);
            const classeZoom = obterClasseZoomGantt(zoom);
            const agora = new Date();
            const agoraTexto = agora.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            const legenda = [
                { id: 'concluido', titulo: 'Concluído' },
                { id: 'em_progresso', titulo: 'Em Progresso' },
                { id: 'parado', titulo: 'Parado' },
                { id: 'inviavel', titulo: 'Inviável' }
            ].map(st => `<span><i class="atlas-exp-gantt-dot atlas-exp-gantt-${st.id}"></i>${escaparHtml(st.titulo)}</span>`).join('');

            const ferramentas = `<div class="atlas-exp-gantt-tools">
                <button type="button" onclick="ajustarAutomaticoGanttExpansoes()">Ajuste automático</button>
                <select onchange="definirEscalaGanttExpansoes(this.value)" title="Escala do Gantt">
                    <option value="meses" ${escala === 'meses' ? 'selected' : ''}>Meses</option>
                    <option value="semanas" ${escala === 'semanas' ? 'selected' : ''}>Semanas</option>
                    <option value="dias" ${escala === 'dias' ? 'selected' : ''}>Dias</option>
                </select>
                <div class="atlas-exp-gantt-zoom"><button type="button" onclick="ajustarZoomGanttExpansoes(-0.15)">−</button><span>${percentualZoom}%</span><button type="button" onclick="ajustarZoomGanttExpansoes(0.15)">+</button></div>
                <button type="button" onclick="alternarTelaCheiaGanttExpansoes()" title="Tela cheia / sair">${fullscreen ? 'Sair' : 'Tela cheia'}</button>
            </div>`;

            if (!linhas.length) {
                return `<div class="atlas-exp-gantt-shell ${fullscreen ? 'atlas-exp-gantt-fullscreen' : ''}">
                    <div class="atlas-exp-gantt-titlebar"><div><h2>RESUMO</h2><p>Cadastre Duração Completa no projeto ou Timeline nos subelementos para gerar o Gantt.</p></div>${ferramentas}</div>
                    <div class="atlas-v13-card atlas-v13-empty">Nenhum projeto de Expansões com datas suficientes para montar o Gantt.</div>
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
                return `<div class="atlas-exp-gantt-bar atlas-exp-gantt-bar-${status}" style="left:${pos.left}px;width:${pos.width}px" title="${escaparHtml(titulo)}"></div>
                    <div class="atlas-exp-gantt-bar-label ${linha.tipo === 'subitem' ? 'is-child' : ''}" style="left:${pos.left + pos.width + 8}px" title="${escaparHtml(label)}">${escaparHtml(label)}</div>`;
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
                <div class="atlas-exp-gantt-titlebar">
                    <div><h2>RESUMO</h2><p>Modelo visual de Gantt para Expansões · atualizado em ${escaparHtml(agoraTexto)}</p></div>
                    ${ferramentas}
                </div>
                <div class="atlas-exp-gantt-kpis"><span>${linhas.length} linha(s)</span><span>${emProgresso} em progresso</span><span>${concluidos} concluído(s)</span><span>${parados} parado(s)</span></div>
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

        function renderExpansoes() {
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
            const totais = { grupos: ATLAS_EXP_GRUPOS.length, elementos: projetos.length, subelementos: (state.expansoesSubitems || []).length };
            const toolbar = `<div class="atlas-exp-toolbar">
                <div><div class="atlas-exp-kicker">Atlas V1.3</div><h2>Expansões</h2><p>Textos e campos ficam no Supabase; imagens ficam organizadas no Google Drive de Expansões. Use o Gantt para acompanhar prazos por projeto e subelemento.</p></div>
                <div class="atlas-exp-toolbar-right">
                    ${renderExpansoesViewTabs()}
                    <div class="atlas-exp-summary"><span>${totais.grupos} grupos</span><span>${totais.elementos} projetos</span><span>${totais.subelementos} subelementos</span></div>
                    <div class="atlas-exp-drive-actions">
                        <button type="button" onclick="abrirDriveExpansoes(event)" title="Abrir pasta de Expansões no Google Drive">Drive de Expansões</button>
                        <button type="button" onclick="copiarLinkDriveExpansoes(event)" title="Copiar link do Drive de Expansões">Copiar link</button>
                    </div>
                </div>
            </div>`;
            const board = state.expansoesVisualizacao === 'gantt'
                ? renderGanttExpansoes(projetos, termo)
                : `<div class="atlas-exp-board">${ATLAS_EXP_GRUPOS.map(grupo => renderGrupoExpansao(grupo, projetos.filter(p => (p.grupo || 'em_progresso') === grupo.id), termo)).join('')}</div>`;
            painel.innerHTML = `${toolbar}${board}`;
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
            return {
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

                return `<div class="atnx-admin-column ${aberta ? '' : 'is-collapsed'}">
                    <div class="atnx-admin-column-header atnx-admin-column-header-clickable" onclick="toggleSecaoAdmin('${status.id}')" role="button" title="Abrir/fechar etapa">
                        <div class="atnx-admin-column-title"><span class="atnx-admin-caret">${aberta ? '▾' : '▸'}</span> ${status.icone} ${escaparHtml(status.titulo)}</div>
                        <div class="atnx-admin-count">${itens.length}</div>
                    </div>
                    <div class="atnx-admin-column-body ${aberta ? '' : 'hidden'}">${body}</div>
                </div>`;
            }).join('');

            painel.innerHTML = `${toolbar}<div class="atnx-admin-board atnx-admin-board-vertical">${colunas}</div>`;
        }

        function renderApp() {
            if (state.moduloAtivo === 'admin_obras') {
                renderAdminObras();
                return;
            }
            if (state.moduloAtivo === 'expansoes') {
                renderExpansoes();
                return;
            }
            atualizarVisibilidadeModulos();
            const obraObj = state.obras.find(o => o.id === state.obraAtiva);
            document.getElementById('txt-nome-obra').innerText = obraObj ? obraObj.nome : "Nenhuma Cidade Cadastrada";
            document.getElementById('txt-grupo-ativo').innerHTML = `<span>▼</span> Categoria Ativa: <span class="text-white">${state.abaAtiva}</span>`;

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

        window.onload = () => { inicializarBanco(); };
