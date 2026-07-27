# Atlas V2.0.4 — Correção dos campos de data

## Problema

Durante a digitação manual, o navegador podia disparar o evento de alteração antes de o ano estar completo. A V2 salvava o valor e reconstruía a tabela nesse momento, interrompendo a digitação após o primeiro algarismo do ano.

## Correção

- O campo de data não é mais enviado ao Supabase a cada etapa da digitação.
- A data é confirmada quando o usuário sai do campo.
- O Atlas exige uma data completa e válida, incluindo quatro dígitos no ano.
- Em caso de data incompleta, o valor anterior é restaurado e uma orientação é exibida.
- O seletor de calendário do navegador continua disponível.

## Banco de dados

Nenhuma alteração SQL é necessária.
