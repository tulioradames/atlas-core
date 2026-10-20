"""Store a NEW Groq key privately; never accept secrets as CLI arguments."""
import argparse
import getpass
import os
from pathlib import Path
import re
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('key_file', type=Path)
args = parser.parse_args()
print('Use uma chave NOVA. Revogue qualquer chave compartilhada em conversas.')
print('Mantenha sua conta Groq no plano gratuito, sem habilitar cobranca.')
key = getpass.getpass('Nova chave Groq (oculta): ').strip()
if not re.fullmatch(r'gsk_[A-Za-z0-9_-]{20,200}', key):
    raise SystemExit('Formato de chave invalido. Nada foi alterado.')
args.key_file.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(args.key_file.parent, 0o700)
fd, temporary = tempfile.mkstemp(dir=args.key_file.parent, prefix='.groq-')
try:
    with os.fdopen(fd, 'w') as output:
        output.write(key + '\n')
    os.chmod(temporary, 0o600)
    os.replace(temporary, args.key_file)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
print('Chave salva com permissao restrita. O assistente a le automaticamente, sem reiniciar.')
