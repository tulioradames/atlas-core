# Mapa visual do Atlas V2.5.0

## Direcao

Interface operacional, com superficies neutras, destaque verde-petroleo e cores
semanticas preservadas. Tipografia Segoe UI, sem brilho, grades decorativas ou
sombras de texto. A identidade deve facilitar uso repetido, nao competir com os dados.

## Estrutura revisada

| Familia | Superficies | Padrao aplicado |
| --- | --- | --- |
| Entrada | Login e recuperacao | Formulario em primeiro plano, contraste e tamanhos contidos |
| Navegacao | Menu lateral, busca, cabecalho e rodape | Hierarquia de nucleo, modulo e quadro; selecao discreta |
| Inicio | Saudacao, arquivos recentes e novidades | Reabertura de arquivos; atualizacoes agrupadas em segundo plano |
| Quadro | Identidade, abas, ferramentas e setores | Menor altura, espacamento regular, ferramentas com icones |
| Dados | Tabela, controles e campos | Cabecalhos discretos, bordas leves e cores de status mantidas |
| Vistas | Obras, Kanban, Gantt e campo | Mesmas superficies e linguagem de selecao |
| Edicao | Modais, gavetas, filtros e configuracoes | Campos coerentes, acoes e contraste por tema |
| Arquivos | Visualizador e historico | Superficie clara ou escura conforme preferencia |
| Administracao | Indicadores, listas e blocos | Escala tipografica menor, sem brilho decorativo |
| Formularios | Construtor interno | Herda controles e superficies do sistema |

## Implementacao

- `css/atlas-design.css` concentra a nova camada visual e e carregado por ultimo.
- Os contratos de estrutura da tabela, colunas fixas, permissoes e eventos foram preservados.
- A pagina inicial lista ate doze quadros e arquivos recentes do usuario neste navegador;
  armazena apenas identificadores, nome e horario, sem URLs ou credenciais.
- A reabertura verifica permissao e carrega o arquivo no quadro original.
- Marca vetorial e indicadores de carregamento seguem o verde-petroleo.
- Menu, entrada, carregamento e Gantt possuem verificacao de contraste claro/escuro
  em componentes reais, com cobertura desktop e celular.
- Temas claro e escuro compartilham as mesmas regras de layout.
- Celular conserva o fluxo de campo e reduz densidade sem esconder os dados.
- Formularios publicos e manual sao documentos independentes: esta rodada nao
  altera seu fluxo nem o servico que os publica.

## Validacao

Smoke de navegacao e interacoes em desktop e celular, auditoria estatica e suites
do projeto. Capturas adicionais de inicio e quadro nos dois temas verificam
contraste, tipografia, ausencia de overflow e preservacao das acoes.

Publicacao desta rodada restrita a homologacao. Sem alteracoes no banco.
