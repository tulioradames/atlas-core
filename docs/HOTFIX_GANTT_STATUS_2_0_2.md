# Atlas 2.0.2 — Cores universais do Gantt

## Correção

O Gantt de **Expansões > Projetos** utilizava a cor do setor quando as opções da coluna Status estavam armazenadas apenas como texto.

A versão 2.0.2 centraliza a resolução das cores:

- cada barra usa o status do próprio elemento ou subelemento;
- a legenda usa exatamente as mesmas cores das barras;
- cores personalizadas configuradas no quadro têm prioridade;
- opções antigas sem cor recebem automaticamente a paleta padrão;
- quadros com mais de uma coluna do tipo Status priorizam a coluna chamada **Status** ou **Situação** que possua valor no item;
- qualquer Gantt criado futuramente herda a mesma regra sem código específico por módulo.

## Paleta padrão

- Não iniciado: cinza;
- Em análise: amarelo;
- Em andamento: azul;
- Concluído: verde;
- Bloqueado: vermelho.

Status adicionais recebem uma cor estável e podem ser personalizados nas configurações do quadro.

## Banco

As colunas de status existentes foram normalizadas diretamente no Supabase. As cores personalizadas já definidas foram preservadas.

Não é necessário executar SQL.
