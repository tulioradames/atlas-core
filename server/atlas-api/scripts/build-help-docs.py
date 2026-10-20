"""Build the public help corpus from the shipped manual (no operational data)."""
from html.parser import HTMLParser
from pathlib import Path
import json


class Manual(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.entries = []
        self.current = None
        self.depth = 0
        self.title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'section':
            if self.current:
                self.depth += 1
            elif 'section' in attrs.get('class', '').split() and attrs.get('id'):
                self.current = {'id': attrs['id'], 'title': '', 'text': ''}
                self.depth = 1
        if self.current and tag == 'h2':
            self.title = True
        if self.current and tag in ('p', 'li', 'h3', 'summary', 'div', 'br'):
            self.current['text'] += '\n'

    def handle_endtag(self, tag):
        if tag == 'h2':
            self.title = False
        if tag == 'section' and self.current:
            self.depth -= 1
            if not self.depth:
                self.current['text'] = ' '.join(self.current['text'].split())
                self.entries.append(self.current)
                self.current = None

    def handle_data(self, data):
        if self.current:
            self.current['text'] += data + ' '
            if self.title:
                self.current['title'] += data


root = Path(__file__).resolve().parents[3]
parser = Manual()
parser.feed((root / 'manual.html').read_text(encoding='utf-8'))
if not parser.entries:
    raise SystemExit('Manual sem secoes; corpus nao gerado.')
target = Path(__file__).resolve().parents[1] / 'src' / 'help-docs.json'
target.write_text(json.dumps(parser.entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Ajuda: {len(parser.entries)} secoes publicas indexadas.')
