# Atlas V2.0.13 — Escala e quantidade no Gantt

## Alterações

- Seletor de escala com **Dias**, **Semanas** e **Meses**.
- A escala semanal mostra intervalos completos, como `07 – 13 jul`, evitando dúvida entre dias e semanas.
- A escala diária mostra dia do mês e dia da semana.
- A escala mensal agrupa os meses por ano.
- Cada linha mostra progresso e quantidade realizada.
- Nos quadros de Obras, o cálculo prioriza os pares `Total lançado / Total projetado` e `Lançado / Projetado`.
- Nos projetos sem par numérico, o cálculo usa subelementos concluídos / total de subelementos.
- Linhas sem subelementos usam o status da atividade como conclusão `0/1` ou `1/1`.
- Foi incluído resumo geral do Gantt.

## Banco de dados

Nenhuma migração ou SQL é necessário. A atualização é exclusivamente de frontend.
