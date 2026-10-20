"""Configure Gmail SMTP without exposing its app password in shell history."""
import argparse
import getpass
import os
from pathlib import Path
import re
import shutil
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('env_file', type=Path)
parser.add_argument('--email', required=True)
args = parser.parse_args()
if not re.fullmatch(r'[A-Za-z0-9._%+\-]+@gmail\.com', args.email):
    raise SystemExit('Informe um endereco Gmail valido.')
if not args.env_file.is_file():
    raise SystemExit('Arquivo de configuracao nao encontrado.')
password = ''.join(getpass.getpass('Senha de app do Gmail (nao aparece na tela): ').split())
if not re.fullmatch(r'[A-Za-z]{16}', password):
    raise SystemExit('A senha de app deve conter 16 letras. Nada foi alterado.')
updates = {
    'ATLAS_SMTP_HOST': 'smtp.gmail.com',
    'ATLAS_SMTP_PORT': '465',
    'ATLAS_SMTP_SECURE': '1',
    'ATLAS_SMTP_USER': args.email,
    'ATLAS_SMTP_PASSWORD': password,
    'ATLAS_SMTP_FROM': 'Atlas <' + args.email + '>',
}
backup = args.env_file.with_suffix('.env.before-gmail')
if not backup.exists():
    shutil.copy2(args.env_file, backup)
    os.chmod(backup, 0o600)
lines = [line for line in args.env_file.read_text().splitlines() if line.split('=', 1)[0] not in updates]
fd, temporary = tempfile.mkstemp(dir=args.env_file.parent, prefix='.smtp-')
try:
    with os.fdopen(fd, 'w') as output:
        output.write('\n'.join(lines + [key + '=' + value for key, value in updates.items()]) + '\n')
    os.chmod(temporary, 0o600)
    os.replace(temporary, args.env_file)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
print('Configuracao salva com permissoes restritas. Nenhum servico foi reiniciado.')
