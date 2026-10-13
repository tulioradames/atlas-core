#!/bin/bash
# Atlas V2.5.0 - roda o teste de acesso contra um Postgres de verdade.
#
#   bash tests/acesso-v250/executar.sh
#
# Usa o Postgres apontado por PGHOST/PGPORT/PGUSER, ou sobe um descartavel se
# nenhum estiver disponivel. SEMPRE remonta o esquema do zero: um teste de
# acesso que depende do estado deixado pela rodada anterior nao prova nada.
set -uo pipefail
cd "$(dirname "$0")"

if ! psql -At -c 'select 1' >/dev/null 2>&1; then
  echo "Nenhum Postgres alcancavel. Defina PGHOST/PGPORT/PGUSER." >&2
  echo "Para subir um descartavel:" >&2
  echo "  initdb -D /tmp/pgatlas -A trust -U postgres && \\" >&2
  echo "  pg_ctl -D /tmp/pgatlas -o '-k /tmp -p 5444' start && \\" >&2
  echo "  export PGHOST=/tmp PGPORT=5444 PGUSER=postgres" >&2
  exit 2
fi

falhou=0
for arquivo in 01-esquema.sql 02-funcoes.sql 03-policies.sql; do
  if ! saida=$(psql -q -v ON_ERROR_STOP=1 -f "$arquivo" 2>&1); then
    echo "ERRO ao aplicar $arquivo:"; echo "$saida" | tail -5; exit 1
  fi
done

saida=$(psql -q -v ON_ERROR_STOP=1 -f 04-teste.sql 2>&1)
estado=$?
echo "$saida" | grep -E 'ok  |FALHOU|ERROR|^---' | sed 's/^psql:[^ ]* //; s/NOTICE:  //'

total=$(echo "$saida" | grep -c 'ok  ')
echo
if [ "$estado" -ne 0 ] || echo "$saida" | grep -q 'FALHOU\|ERROR'; then
  echo "ACESSO: REPROVADO"
  falhou=1
else
  echo "ACESSO: $total asserções, todas passaram."
fi
# Um teste que "passa" com zero asserções é o pior resultado possível: parece
# aprovado e não olhou nada. Já aconteceu nesta sessão.
if [ "$total" -lt 25 ]; then
  echo "ALERTA: só $total asserções rodaram; o esperado é 25 ou mais."
  echo "        Alguma coisa impediu os casos de executar."
  falhou=1
fi
exit "$falhou"
