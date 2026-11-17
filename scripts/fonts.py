#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = ["fonttools==4.65.0", "brotli==1.2.1"]
# ///
# (the block above lets `uv run scripts/fonts.py` install the two packages by itself; plain python ignores it)
"""Regenerate the self-hosted web fonts of 221 FOREVER (everything under assets/fonts/).

NOT part of the site build and NOT run in CI: the generated WOFF2 and CSS files are committed.
Run it by hand when you want to; the site works without ever running it again (see "New letters").

What it writes
    assets/fonts/<id>.css            one file per family, only @font-face rules
    assets/fonts/<id>/*.woff2        the subsets those rules point to
    assets/fonts/manifest.json       what was built: slices, sizes, characters the sources lack
  for the families
    serif-sc  "F221 Serif"     Noto Serif SC      variable 300-700
    sans-sc   "F221 Sans"      Noto Sans SC       variable 400-900
    sans-sc-400 "F221 Sans 400"  the same, regular weight only: half the bytes (files live in sans-sc/)
    fangsong  "F221 Fangsong"  Zhuque Fangsong    regular
    mono      "F221 Mono"      IBM Plex Mono      300, 400, 500
    garamond  "F221 Garamond"  EB Garamond        400 roman + italic
    grotesk   "F221 Grotesk"   Archivo            variable 400-900, width 62-100 %
    text      "F221 Text"      Source Serif 4     variable 300-700 roman, 400 italic
  The family names are the project's own: a subset is a modified font and several of these fonts
  have Reserved Font Names, so the name tables are rewritten as well (see assets/fonts/LICENSES.md).

How the Chinese families are cut (unicode-range slices; a page downloads only the slices it shows)
    a        everything a home page can show except the pull-quotes: letter titles, places, authors,
             song titles and artists, the interface strings, ASCII, punctuation, the marks a browser
             draws by itself (list bullets, emphasis dots), a margin of the 200 characters the
             letters use most
    q        the pull-quotes (front matter `quote:`) that are not already in a
    b01-b03  every other character that two or more letters use, the most shared first
    l01...   the characters only one letter uses, one slice per letter (l07 = the 7th letter,
             oldest first): reading a letter needs b01-b03 and its own l slice
    s1-s4    what nothing uses yet: accented Latin and Greek / symbols / CJK symbols and full-width
             forms / kana
    c001...  the rest of levels 1 and 2 of the 通用规范汉字表, most frequent first, in small slices
    t01...   common traditional characters (the letters quote Cantonese lyrics)
  a, q, b* and l* carry every weight of the family; the other slices are regular weight only.
  A c or t slice is a fixed window of the list in scripts/fonts-data/hanzi.txt (minus what the site
  already uses), so a character's slice never depends on the other characters: after a new letter,
  running this script again rewrites slices a and q, the three b slices, the new letter's l slice and
  the few small l, c and t slices that lose a character to it. Everything else stays byte for byte
  the same (less to commit, less for returning readers to download again).

New letters
    Nothing has to be done. A character no letter has used before is in a c or t slice, and the
    browser fetches that slice by itself: one small file (a few KB) per new character, about 100 to
    200 KB for a typical letter. Running this script afterwards moves the new characters into the
    letter's own l slice (and new titles into slice a), which saves readers those requests.

How to run
    python3 scripts/fonts.py --check     # coverage report; needs no packages and no sources
    python3 scripts/fonts.py --fetch     # download the pinned sources into .fonts-src/ (54 MB); no packages needed
    uv run scripts/fonts.py              # rebuild assets/fonts/ (about a minute on 6 cores)
  Building needs fontTools and brotli. `uv run` (https://docs.astral.sh/uv/) reads the versions from the top
  of this file and installs them into a throw-away environment. Without uv:
    python3 -m venv .venv-fonts && .venv-fonts/bin/pip install fonttools==4.65.0 brotli==1.2.1
    .venv-fonts/bin/python scripts/fonts.py
  (on Debian/Ubuntu `python3 -m venv` needs the python3-venv package).
  Options: --src DIR (where the source fonts are; default .fonts-src, git-ignored), --only id[,id],
  --jobs N. The source fonts are never committed. Run `node scripts/images.mjs` first if
  _data/media.json is missing (song titles and artists come from it).

Where the sources come from: see SOURCES below (URL and SHA-256 of every file).
"""
import argparse
import collections
import hashlib
import io
import json
import os
import re
import sys
import unicodedata
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'scripts', 'fonts-data')
OUT = os.path.join(ROOT, 'assets', 'fonts')

# ── sources ───────────────────────────────────────────────────────────────────────────────────
GF = 'https://raw.githubusercontent.com/google/fonts/7af0d90b4d532ffa4b041937b560c6df4e7b1e95/ofl/'
SOURCES = {
    'NotoSerifSC': dict(name='Noto Serif SC', version='2.003', file='NotoSerifSC[wght].ttf',
                        url=GF + 'notoserifsc/NotoSerifSC%5Bwght%5D.ttf',
                        sha256='050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9'),
    'NotoSansSC': dict(name='Noto Sans SC', version='2.004', file='NotoSansSC[wght].ttf',
                       url=GF + 'notosanssc/NotoSansSC%5Bwght%5D.ttf', sha256='a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da'),
    'ZhuqueFangsong': dict(name='Zhuque Fangsong', version='0.212', file='ZhuqueFangsong-Regular.ttf',
                           url='https://github.com/TrionesType/zhuque/releases/download/v0.212/ZhuqueFangsong-v0.212.zip',
                           member='ZhuqueFangsong-Regular.ttf', sha256='558c62730844fe54ba220146ed62f859d4e2880188d92d985f8921c6e3743bc4'),
    'IBMPlexMono-Light': dict(name='IBM Plex Mono', version='2.3', file='IBMPlexMono-Light.ttf',
                              url=GF + 'ibmplexmono/IBMPlexMono-Light.ttf', sha256='780bcf65509d72a35ec114b57bcbe220dc6b77d8ea2e9b25e294be3c570c5025'),
    'IBMPlexMono-Regular': dict(name='IBM Plex Mono', version='2.3', file='IBMPlexMono-Regular.ttf',
                                url=GF + 'ibmplexmono/IBMPlexMono-Regular.ttf', sha256='6a3412f058c7d8dfd9170c41e85ade48e5156ecb89356110ca57a0a27734af46'),
    'IBMPlexMono-Medium': dict(name='IBM Plex Mono', version='2.3', file='IBMPlexMono-Medium.ttf',
                               url=GF + 'ibmplexmono/IBMPlexMono-Medium.ttf', sha256='a9b4c49bb299e05b5f6c481e7fb5e78943d2793249a0c8874ab574a2d1ea6755'),
    'EBGaramond': dict(name='EB Garamond', version='1.003', file='EBGaramond[wght].ttf',
                       url=GF + 'ebgaramond/EBGaramond%5Bwght%5D.ttf', sha256='ef9512f92f6d579e5dc75af59a5a4b1b8b47d2eda89e00b954d44520e5369027'),
    'EBGaramond-Italic': dict(name='EB Garamond', version='1.003', file='EBGaramond-Italic[wght].ttf',
                              url=GF + 'ebgaramond/EBGaramond-Italic%5Bwght%5D.ttf', sha256='bba2c4499c93c9612b90b9825d32b07da52fce2fe57562a1eb6b833553f93c4e'),
    'Archivo': dict(name='Archivo', version='2.001', file='Archivo[wdth,wght].ttf',
                    url=GF + 'archivo/Archivo%5Bwdth,wght%5D.ttf', sha256='0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053'),
    'SourceSerif4': dict(name='Source Serif 4', version='4.004', file='SourceSerif4[opsz,wght].ttf',
                         url=GF + 'sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf', sha256='97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b'),
    'SourceSerif4-Italic': dict(name='Source Serif 4', version='4.004', file='SourceSerif4-Italic[opsz,wght].ttf',
                                url=GF + 'sourceserif4/SourceSerif4-Italic%5Bopsz,wght%5D.ttf', sha256='15fbc7e4679489a501998c3669272637a6646388ef7e4bd77eebb5bf967a1f42'),
}

# ── families ──────────────────────────────────────────────────────────────────────────────────
# Chinese: `full` builds slices a, q, b*, l* (every weight); `rest` builds the other slices (regular only,
# declared with the same weight range so that no browser fakes a bold for them).
# `freeze`: bake the font's localised forms for that OpenType language into the character map and drop
# the `locl` feature (see freeze_locl below).
CJK = [
    dict(id='serif-sc', family='F221 Serif', source='NotoSerifSC', freeze='ZHS ',
         full=dict(tag='vf', instance={'wght': (300, 700)}, weight='300 700'),
         rest=dict(tag='400', instance={'wght': 400}, weight='300 700')),
    dict(id='sans-sc', family='F221 Sans', source='NotoSansSC', freeze='ZHS ',
         full=dict(tag='vf', instance={'wght': (400, 900)}, weight='400 900'),
         rest=dict(tag='400', instance={'wght': 400}, weight='400 900')),
    # the same typeface for a theme that only ever sets it at regular weight: a, q, b, l as static files
    # (half the bytes of the variable ones); the other slices are the very files of sans-sc
    dict(id='sans-sc-400', family='F221 Sans 400', internal='F221 Sans', source='NotoSansSC', folder='sans-sc', freeze='ZHS ',
         full=dict(tag='400', instance={'wght': 400}, weight='400'),
         rest=dict(tag='400', instance={'wght': 400}, weight='400')),
    dict(id='fangsong', family='F221 Fangsong', source='ZhuqueFangsong',
         full=dict(tag='400', instance=None, weight='400'),
         rest=dict(tag='400', instance=None, weight='400')),
]
LATIN = [
    dict(id='mono', family='F221 Mono', faces=[
        dict(source='IBMPlexMono-Light', file='300', weight='300', style='normal', instance=None),
        dict(source='IBMPlexMono-Regular', file='400', weight='400', style='normal', instance=None),
        dict(source='IBMPlexMono-Medium', file='500', weight='500', style='normal', instance=None)]),
    # size-adjust: EB Garamond is small on the body; 108 % sits it next to the Chinese faces (folio mockup)
    dict(id='garamond', family='F221 Garamond', extra='size-adjust:108%;', faces=[
        dict(source='EBGaramond', file='400', weight='400', style='normal', instance={'wght': 400}),
        dict(source='EBGaramond-Italic', file='400i', weight='400', style='italic', instance={'wght': 400})]),
    dict(id='grotesk', family='F221 Grotesk', faces=[
        dict(source='Archivo', file='vf', weight='400 900', style='normal', stretch='62% 100%',
             instance={'wght': (400, 900), 'wdth': (62, 100)})]),
    # no optical-size axis: with it the roman alone is 150 KB. Pinned at 18, the size of running text.
    dict(id='text', family='F221 Text', faces=[
        dict(source='SourceSerif4', file='vf', weight='300 700', style='normal',
             instance={'wght': (300, 700), 'opsz': 18}),
        dict(source='SourceSerif4-Italic', file='400i', weight='400', style='italic',
             instance={'wght': 400, 'opsz': 18})]),
]

# OpenType features kept. Chinese: vertical forms, punctuation width, kerning, figures, and localised forms
# (`locl` is left out for the families that `freeze` them, see above).
CJK_FEATURES = ['vert', 'vrt2', 'halt', 'palt', 'vhal', 'vpal', 'chws', 'vchw', 'kern', 'vkrn', 'locl',
                'ccmp', 'mark', 'mkmk', 'fwid', 'hwid', 'pwid', 'lnum', 'onum', 'pnum', 'tnum']
LATIN_FEATURES = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk', 'rvrn',
                  'lnum', 'onum', 'pnum', 'tnum', 'zero', 'case']


def cps(*parts):
    out = set()
    for p in parts:
        if isinstance(p, tuple):
            out.update(range(p[0], p[1] + 1))
        elif isinstance(p, str):
            out.update(ord(c) for c in p)
        elif isinstance(p, (set, frozenset)):
            out.update(p)
        else:
            out.add(p)
    return out


ASCII = cps((0x20, 0x7E))
CJK_PUNCT = cps('\u00a0·—‘’“”…‰′″※', (0x3000, 0x3003), (0x3008, 0x3011), (0x3014, 0x3017), 0x301C, 0x30FB,
                '！（），－．／：；？［］｛｜｝～￥', '〇')
# Characters a browser draws without their being in the text: list bullets (WebKit takes • ◦ ■ from the
# font, Firefox ▪), the triangles of <details>, emphasis marks (text-emphasis: dot, circle, double-circle,
# triangle, sesame) and the hyphen of automatic hyphenation. They go into slice a; otherwise a <ul>
# fetches whichever slice happens to hold the bullet.
BROWSER_MARKS = cps(0x2010, 0x2022, 0x25A0, 0x25AA, 0x25B2, 0x25B3, 0x25B8, 0x25BE, 0x25C9, 0x25CB, 0x25CE, 0x25CF,
                    0x25E6, 0xFE45, 0xFE46)
# Latin faces: the glyphs they carry ...
LATIN_CHARS = cps(ASCII, (0xA0, 0xFF), 0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC, 'αβγδεθλμπσφωΔΩ',
                  (0x2010, 0x2015), (0x2018, 0x201E), (0x2020, 0x2022), 0x2026, 0x2030,
                  0x2032, 0x2033, 0x2039, 0x203A, 0x2044, 0x20AC, 0x2116, 0x2122, (0x2190, 0x2193), 0x2212, 0x2215,
                  0x221E, 0x2248, 0x2260, 0x2264, 0x2265)
# ... and the ones they must leave to the Chinese face when both are in one stack: the middle dot, dashes,
# curly quotes, daggers, bullet, ellipsis, per mille, guillemets. Chinese punctuation set in a Latin face is
# too narrow, sits too low and has no vertical form. The "<family> En" twin keeps them for lang="en" text.
LATIN_YIELD = cps(0xB7, 0x2014, 0x2015, (0x2018, 0x201F), (0x2020, 0x2022), 0x2026, 0x2030, 0x2039, 0x203A)
# What nothing uses yet but a letter might (only what a/q/b/l do not already hold): s1 accented Latin and
# Greek letters, s2 general punctuation and symbols, s3 CJK symbols and full-width forms, s4 kana
SYMBOLS = [
    cps((0xA0, 0x17F), (0x1CD, 0x1DC), (0x2C6, 0x2DC), (0x391, 0x3A9), (0x3B1, 0x3C9)),
    cps((0x2010, 0x2027), (0x2030, 0x203E), 0x2042, 0x2044, (0x2070, 0x208E), 0x20AC, 0x2103, 0x2109, 0x2116, 0x2121,
        0x2122, (0x2150, 0x217F), (0x2190, 0x21FF), (0x2200, 0x22FF), (0x2460, 0x24FF), (0x25A0, 0x25FF),
        (0x2600, 0x266F), (0x2700, 0x27BF)),
    cps((0x3000, 0x303F), (0x3220, 0x3229), (0x338E, 0x33A1), (0xFE10, 0xFE19), (0xFE30, 0xFE4F), (0xFF01, 0xFF5E),
        (0xFFE0, 0xFFE6)),
    cps((0x3041, 0x3096), (0x3099, 0x30FF)),
]
B_SHARED = [160, 280]           # characters two or more letters use: the 160 most shared, the next 280, the rest
# c slices: fixed windows over the [common] list of hanzi.txt (most frequent first). (up to this place in
# the list, window width). The list is 6,500 characters long; the site already uses most of its first
# 2,000, so the early windows are wide and still hold only a handful of characters each. Measured on the
# letters so far, half of a new letter's never-used characters come from the first 2,000 places and
# five in six from the first 3,250: those windows are kept small, because a reader downloads one whole
# slice per new character. Do not change the widths without a reason: it renames every c slice.
C_WINDOWS = [(1000, 125), (2000, 32), (3250, 32), (None, 64)]
T_WINDOW = 40                   # t slices: fixed windows over the [traditional] list
MARGIN = 200                    # the N characters the letters use most always go into slice a


# ── text ──────────────────────────────────────────────────────────────────────────────────────
def usable(cp):
    """A character a font could draw: no controls, no invisible format characters."""
    if cp < 0x20 or 0x7F <= cp < 0xA0 or cp == 0xAD:
        return False
    if 0x200B <= cp <= 0x200F or 0x2028 <= cp <= 0x202E or 0x2060 <= cp <= 0x206F:
        return False
    if 0xFE00 <= cp <= 0xFE0F or cp == 0xFEFF or 0xD800 <= cp <= 0xDFFF or 0xE0000 <= cp <= 0xE0FFF:
        return False
    return True


def is_han(cp):
    return 0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF or 0x20000 <= cp <= 0x3FFFF


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def data_list(name):
    """scripts/fonts-data/<name>: {section: [chars in order]}; '#' lines are comments."""
    out, cur = collections.OrderedDict(), ''
    for line in read(os.path.join(DATA, name)).split('\n'):
        if line.startswith('#'):
            continue
        m = re.match(r'^\[(\w+)\]\s*$', line)
        if m:
            cur = m.group(1)
            continue
        out.setdefault(cur, []).extend(c for c in line if not c.isspace())
    return out


def strip_comments(text, ext):
    if ext in ('.css', '.js', '.mjs', '.html', '.svg', '.scss'):
        text = re.sub(r'/\*.*?\*/', ' ', text, flags=re.S)
    if ext in ('.js', '.mjs', '.html', '.scss'):
        text = re.sub(r'(^|[^:"\'\\])//[^\n]*', r'\1 ', text)
    if ext in ('.html', '.svg'):
        text = re.sub(r'<!--.*?-->', ' ', text, flags=re.S)
    if ext in ('.yml', '.yaml'):
        text = re.sub(r'(^|\s)#[^\n]*', ' ', text)
    return text


def front_matter(raw):
    m = re.match(r'---\r?\n(.*?)\r?\n---\r?\n', raw, flags=re.S)
    out = {}
    if m:
        for line in m.group(1).split('\n'):
            mm = re.match(r'^(\w+):\s*(.*)$', line)
            if mm:
                out[mm.group(1)] = mm.group(2).strip()
    return out


def marked(text):
    """{(base, combining mark)} of a text, e.g. the • and its accent in the face (ง •̀_•́)ง.

    A browser shapes such a pair with one font file. If the two characters sit in different slices, the
    file chosen for the base has no glyph for the mark and the pair is drawn by a system font."""
    pairs, base = set(), None
    for c in text:
        if unicodedata.category(c)[0] == 'M':
            if base is not None and usable(ord(c)):
                pairs.add((ord(base), ord(c)))
        elif usable(ord(c)):
            base = c
        else:
            base = None
    return pairs


def collect():
    """The characters of the site, by where they can appear."""
    ui = set()
    for chars in data_list('ui.txt').values():
        ui.update(chars)
    # the real interface, once the themes exist
    places = ['assets/themes', 'assets/js/core', '_includes', '_layouts']
    files = ['_data/themes.yml', 'index.html', '404.html']
    for rel in places:
        for base, _dirs, names in os.walk(os.path.join(ROOT, rel)):
            files += [os.path.relpath(os.path.join(base, n), ROOT) for n in names]
    for rel in files:
        ext = os.path.splitext(rel)[1].lower()
        path = os.path.join(ROOT, rel)
        if ext in ('.css', '.js', '.mjs', '.html', '.svg', '.json', '.yml', '.yaml', '.txt') and os.path.isfile(path):
            ui.update(c for c in strip_comments(read(path), ext) if ord(c) > 0x7F)
    home, quotes, body, freq = set(), set(), set(), collections.Counter()
    pairs = set()
    letters, first = collections.Counter(), {}      # in how many letters a character occurs; the first of them
    posts_dir = os.path.join(ROOT, '_posts')
    by_date = lambda name: [int(x) for x in re.findall(r'\d+', name)[:3]] + [name]
    posts = sorted(os.listdir(posts_dir), key=by_date)
    for index, name in enumerate(posts):
        raw = read(os.path.join(posts_dir, name))
        fm = front_matter(raw)
        home.update(fm.get('title', '') + fm.get('author', '') + fm.get('place', '') + re.sub(r'\.mp3\b', '', fm.get('bgm', '')))
        quotes.update(fm.get('quote', ''))
        body.update(raw)
        pairs |= marked(raw)
        freq.update(c for c in raw if is_han(ord(c)))
        for c in set(raw):
            letters[ord(c)] += 1
            first.setdefault(ord(c), index)
    media = os.path.join(ROOT, '_data', 'media.json')
    if os.path.isfile(media):
        for key, track in json.load(open(media, encoding='utf-8')).get('tracks', {}).items():
            home.update(re.sub(r'\.mp3$', '', key) + (track.get('title') or '') + (track.get('artist') or ''))
    else:
        print('warning: _data/media.json is missing (run `node scripts/images.mjs`): song titles and artists '
              'from the audio files are not in slice a', file=sys.stderr)
    margin = {c for c, _n in freq.most_common(MARGIN)}
    conv = lambda s: {ord(c) for c in s if usable(ord(c))}
    a = conv(home) | conv(ui) | conv(margin) | ASCII | CJK_PUNCT | BROWSER_MARKS
    a |= {cp for pair in pairs for cp in pair}      # a base and its combining mark stay together, in slice a
    q = conv(quotes) - a
    b = conv(body) - a - q
    # marks no text contains: wanted in slice a when the font has them, not missed when it does not
    optional = BROWSER_MARKS - conv(home) - conv(ui) - conv(quotes) - conv(body)
    return dict(a=a, q=q, b=b, posts=len(posts), letters=letters, first=first, pairs=pairs, optional=optional)


def windows(table, length):
    """[(start, end)] over a list of `length` entries, cut as `table` says: [(up to this place, width), ...]."""
    out, start = [], 0
    for end, width in table:
        end = length if end is None else min(end, length)
        out += [(lo, min(lo + width, end)) for lo in range(start, end, width)]
        start = max(start, end)
    return out


def plan_cjk(chars, have):
    """Slice name -> sorted code points, for one Chinese font whose cmap is `have`."""
    lists = data_list('hanzi.txt')
    slices = collections.OrderedDict()
    used = set()
    for name in ('a', 'q'):
        slices[name] = sorted((chars[name] & have) - used)
        used.update(slices[name])
    body = (chars['b'] & have) - used
    used.update(body)
    letters, first = chars['letters'], chars['first']
    shared = sorted((c for c in body if letters[c] >= 2), key=lambda c: (-letters[c], c))
    pos = 0
    for i, n in enumerate(B_SHARED + [len(shared)]):
        slices['b%02d' % (i + 1)] = sorted(shared[pos:pos + n])
        pos += n
    # one slice per letter for the characters nothing else uses: l07 belongs to the 7th letter (oldest first)
    for c in sorted(body):
        if letters[c] < 2:
            slices.setdefault('l%02d' % (first.get(c, 0) + 1), []).append(c)
    for name in sorted((n for n in slices if n[0] == 'l'), key=lambda n: int(n[1:])):
        slices.move_to_end(name)
    for i, pool in enumerate(SYMBOLS):
        slices['s%d' % (i + 1)] = sorted((pool & have) - used)
        used.update(slices['s%d' % (i + 1)])
    # c and t: a character's slice is the window its place in the list falls into, whatever else is in use
    for prefix, digits, entries, table in (('c', 3, lists['common'], C_WINDOWS), ('t', 2, lists['traditional'], [(None, T_WINDOW)])):
        entries = [ord(c) for c in entries]
        for i, (lo, hi) in enumerate(windows(table, len(entries))):
            part = sorted(set(c for c in entries[lo:hi] if c in have and c not in used))
            used.update(part)
            slices['%s%0*d' % (prefix, digits, i + 1)] = part
    missing = sorted((chars['a'] | chars['q'] | chars['b']) - chars['optional'] - have)
    return collections.OrderedDict((k, v) for k, v in slices.items() if v), missing


def unicode_range(codepoints):
    out, cs = [], sorted(codepoints)
    i = 0
    while i < len(cs):
        j = i
        while j + 1 < len(cs) and cs[j + 1] == cs[j] + 1:
            j += 1
        out.append('U+%X' % cs[i] if i == j else 'U+%X-%X' % (cs[i], cs[j]))
        i = j + 1
    return ','.join(out)


def parse_range(text):
    out = set()
    for part in text.split(','):
        part = part.strip()
        if not part:
            continue
        lo, _, hi = part[2:].partition('-')
        out.update(range(int(lo, 16), int(hi or lo, 16) + 1))
    return out


# ── building (needs fontTools and brotli) ─────────────────────────────────────────────────────
def rename(font, family, style, source, tag):
    """Project name in the name table; copyright, authors and licence stay as upstream wrote them."""
    name = font['name']
    ps = family.replace(' ', '')
    # named instances carry upstream PostScript names ("NotoSerifSC-Bold"); browsers do not need them
    used = set()
    if 'fvar' in font:
        font['fvar'].instances = []
        used.update(axis.axisNameID for axis in font['fvar'].axes)
    if 'STAT' in font:
        stat = font['STAT'].table
        used.add(getattr(stat, 'ElidedFallbackNameID', None))
        used.update(axis.AxisNameID for axis in (stat.DesignAxisRecord.Axis if stat.DesignAxisRecord else []))
        used.update(value.ValueNameID for value in (stat.AxisValueArray.AxisValue if stat.AxisValueArray else []))
    keep = []
    for rec in name.names:
        if rec.nameID in (1, 2, 3, 4, 6, 10, 16, 17, 18, 21, 22, 25) or (rec.nameID >= 256 and rec.nameID not in used):
            continue
        keep.append(rec)
    name.names = keep
    values = {
        1: family, 2: style, 3: '%s;F221;%s-%s;%s' % (source['version'], ps, style.replace(' ', ''), tag),
        4: family if style == 'Regular' else '%s %s' % (family, style), 6: '%s-%s' % (ps, style.replace(' ', '')),
        10: 'A renamed subset of %s %s, made for 221forever.us with fontTools. Not the original font.'
            % (source['name'], source['version']),
    }
    if 'fvar' in font:
        values[25] = ps
    for name_id, value in values.items():
        name.setName(value, name_id, 3, 1, 0x409)


def freeze_locl(font, lang):
    """Make the localised forms of one language the font's default forms.

    Noto Serif/Sans SC draw the Chinese dash (U+2014: full width, centred, and —— as one unbroken stroke)
    only through the `locl` feature for Simplified Chinese; without it the dash is a Latin one. That makes
    the result depend on the page's lang attribute, and WebKit (as tested with Playwright) measures such a
    line without the feature but paints it with it, so whatever follows the dash on the line is overprinted
    by a quarter of a character. Mapping the characters straight to their Chinese forms avoids both.
    """
    from fontTools.ttLib.tables import otTables
    gsub = font['GSUB'].table
    lookups = set()
    for script in gsub.ScriptList.ScriptRecord:
        for rec in script.Script.LangSysRecord:
            if rec.LangSysTag == lang:
                for i in rec.LangSys.FeatureIndex:
                    feature = gsub.FeatureList.FeatureRecord[i]
                    if feature.FeatureTag == 'locl':
                        lookups.update(feature.Feature.LookupListIndex)
    forms = {}
    for i in sorted(lookups):
        for sub in gsub.LookupList.Lookup[i].SubTable:
            sub = getattr(sub, 'ExtSubTable', sub)
            if type(sub).__name__ == 'SingleSubst':
                forms.update(sub.mapping)
    for table in font['cmap'].tables:
        for cp, glyph in list(table.cmap.items()):
            if glyph in forms:
                table.cmap[cp] = forms[glyph]
    # ligatures made of those glyphs (the two- and three-em dash) get twins made of the localised glyphs
    for lookup in gsub.LookupList.Lookup:
        for sub in lookup.SubTable:
            sub = getattr(sub, 'ExtSubTable', sub)
            if type(sub).__name__ != 'LigatureSubst':
                continue
            for first, ligatures in list(sub.ligatures.items()):
                if first not in forms:
                    continue
                for lig in ligatures:
                    if all(c in forms for c in lig.Component):
                        twin = otTables.Ligature()
                        twin.Component = [forms[c] for c in lig.Component]
                        twin.CompCount = len(twin.Component) + 1
                        twin.LigGlyph = forms.get(lig.LigGlyph, lig.LigGlyph)
                        there = sub.ligatures.setdefault(forms[first], [])
                        if not any(x.Component == twin.Component for x in there):
                            there.append(twin)
    return len(forms)


def build_one(job):
    """Subset one source into one WOFF2. Runs in a worker process."""
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    import logging
    logging.getLogger('fontTools').setLevel(logging.ERROR)
    font = TTFont(job['src'], recalcTimestamp=False)   # keep upstream's timestamp: the same input gives the same bytes
    if job.get('freeze'):
        freeze_locl(font, job['freeze'])
    opts = subset.Options()
    opts.layout_features = job['features']
    opts.hinting = False
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.name_IDs = ['*']
    opts.drop_tables += ['DSIG', 'meta']
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=job['codepoints'])
    sub.subset(font)
    if job['instance'] and 'fvar' in font:
        buf = io.BytesIO()
        font.save(buf)
        buf.seek(0)
        limits = {k: (tuple(v) if isinstance(v, (list, tuple)) else v) for k, v in job['instance'].items()}
        font = instancer.instantiateVariableFont(TTFont(buf, recalcTimestamp=False), limits, updateFontNames=False)
    rename(font, job['family'], job['style'], job['source'], job['tag'])
    font.flavor = 'woff2'
    buf = io.BytesIO()
    font.save(buf)
    data = buf.getvalue()
    os.makedirs(os.path.dirname(job['out']), exist_ok=True)
    with open(job['out'], 'wb') as f:
        f.write(data)
    cmap = sorted(TTFont(io.BytesIO(data)).getBestCmap().keys())
    return job['key'], len(data), cmap


def face_rule(family, weight, style, url, codepoints, extra=''):
    return ('@font-face{font-family:"%s";font-style:%s;font-weight:%s;%sfont-display:swap;'
            'src:url("%s") format("woff2");unicode-range:%s}' % (family, style, weight, extra, url, unicode_range(codepoints)))


def build(args):
    try:
        from fontTools.ttLib import TTFont
        import brotli  # noqa: F401  (WOFF2 needs it)
    except ImportError:
        sys.exit('fontTools and brotli are needed to build. Either `uv run scripts/fonts.py`, or '
                 '`pip install fonttools==4.65.0 brotli==1.2.1` into a virtual environment (see the top of this file).')
    from concurrent.futures import ProcessPoolExecutor
    only = set(args.only.split(',')) if args.only else None
    if only:  # families that share a folder are always rebuilt together
        folders = {f.get('folder', f['id']) for f in CJK if f['id'] in only}
        only.update(f['id'] for f in CJK if f.get('folder', f['id']) in folders)
    src = lambda key: os.path.join(args.src, SOURCES[key]['file'])
    for fam in CJK + LATIN:
        for key in ([fam['source']] if 'source' in fam else [f['source'] for f in fam['faces']]):
            if (not only or fam['id'] in only) and not os.path.isfile(src(key)):
                sys.exit('missing source font %s — run with --fetch first' % src(key))
    chars = collect()
    jobs, rules, manifest = [], collections.OrderedDict(), collections.OrderedDict()
    if os.path.isfile(os.path.join(OUT, 'manifest.json')):
        manifest = json.load(open(os.path.join(OUT, 'manifest.json'), encoding='utf-8'), object_pairs_hook=collections.OrderedDict)['families']
    for fam in CJK:
        if only and fam['id'] not in only:
            continue
        source = SOURCES[fam['source']]
        have = set(TTFont(src(fam['source']), lazy=True).getBestCmap().keys())
        slices, missing = plan_cjk(chars, have)
        rules[fam['id']] = []
        manifest[fam['id']] = dict(family=fam['family'], source='%s %s' % (source['name'], source['version']), files=[],
                                   missing=''.join(chr(c) for c in missing))
        for name, codepoints in slices.items():
            v = fam['full'] if name[0] in 'aqbl' else fam['rest']
            rel = '%s/%s-%s.woff2' % (fam.get('folder', fam['id']), name, v['tag'])
            if not any(j['key'] == rel for j in jobs):
                jobs.append(dict(key=rel, src=src(fam['source']), out=os.path.join(OUT, rel), codepoints=codepoints,
                                 features=[f for f in CJK_FEATURES if not (f == 'locl' and fam.get('freeze'))],
                                 freeze=fam.get('freeze'), instance=v['instance'],
                                 family=fam.get('internal', fam['family']), style='Regular', source=source, tag=name, cjk=True))
            rules[fam['id']].append((fam['family'], v['weight'], 'normal', rel, ''))
    for fam in LATIN:
        if only and fam['id'] not in only:
            continue
        rules[fam['id']] = []
        first = SOURCES[fam['faces'][0]['source']]
        manifest[fam['id']] = dict(family=fam['family'], source='%s %s' % (first['name'], first['version']), files=[], missing='')
        for face in fam['faces']:
            rel = '%s/%s.woff2' % (fam['id'], face['file'])
            jobs.append(dict(key=rel, src=src(face['source']), out=os.path.join(OUT, rel), codepoints=sorted(LATIN_CHARS),
                             features=LATIN_FEATURES, instance=face['instance'], family=fam['family'],
                             style='Italic' if face['style'] == 'italic' else {'300': 'Light', '500': 'Medium'}.get(face['weight'], 'Regular'),
                             source=SOURCES[face['source']],
                             tag=face['file'], cjk=False))
            extra = fam.get('extra', '') + ('font-stretch:%s;' % face['stretch'] if 'stretch' in face else '')
            rules[fam['id']].append((fam['family'], face['weight'], face['style'], rel, extra))
    print('building %d files with %d workers ...' % (len(jobs), args.jobs))
    built = {}
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        for n, (key, size, cmap) in enumerate(pool.map(build_one, jobs, chunksize=1), 1):
            built[key] = (size, cmap)
            job = next(j for j in jobs if j['key'] == key)
            if job['cjk'] and cmap != job['codepoints']:
                sys.exit('%s: the file maps %d characters, the plan asked for %d' % (key, len(cmap), len(job['codepoints'])))
            print('  [%3d/%d] %-26s %7.1f KB  %5d chars' % (n, len(jobs), key, size / 1024, len(cmap)))
    listed = set()
    for fam in CJK + LATIN:
        fam_id = fam['id']
        if fam_id not in rules:
            continue
        source = manifest[fam_id]['source']
        lines = ['/* %s — a renamed subset of %s, SIL Open Font License 1.1 (see LICENSES.md).' % (fam['family'], source),
                 '   Generated by scripts/fonts.py. Do not edit: run the script again instead. */']
        for family, weight, style, rel, extra in rules[fam_id]:
            size, cmap = built[rel]
            if fam in LATIN:
                lines.append(face_rule(family, weight, style, rel, set(cmap) - LATIN_YIELD, extra))
                lines.append(face_rule(family + ' En', weight, style, rel, cmap, extra))
            else:
                lines.append(face_rule(family, weight, style, rel, cmap, extra))
            if rel not in listed:   # a file two families share is counted once, under the first
                listed.add(rel)
                manifest[fam_id]['files'].append(dict(file=rel, bytes=size, chars=len(cmap)))
        with open(os.path.join(OUT, fam_id + '.css'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines) + '\n')
        total = sum(x['bytes'] for x in manifest[fam_id]['files'])
        print('%-11s %-15s %3d files %8.1f KB   css %5.1f KB%s' % (
            fam_id, fam['family'], len(manifest[fam_id]['files']), total / 1024,
            os.path.getsize(os.path.join(OUT, fam_id + '.css')) / 1024,
            '   source lacks: ' + manifest[fam_id]['missing'] if manifest[fam_id]['missing'] else ''))
    order = [f['id'] for f in CJK + LATIN]
    manifest = collections.OrderedDict((k, manifest[k]) for k in order if k in manifest)
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(note='Written by scripts/fonts.py. bytes = size of the WOFF2; missing = characters of the site '
                            'that the upstream font does not contain. A file shared by two families is listed once.',
                       families=manifest), f, ensure_ascii=False, indent=1)
        f.write('\n')
    # files an earlier run left behind and no stylesheet points to any more
    wanted = set()
    for name in os.listdir(OUT):
        if name.endswith('.css'):
            wanted.update(face['url'] for face in parse_css(os.path.join(OUT, name)))
    for folder in sorted({os.path.dirname(rel) for rel in built}):
        for name in sorted(os.listdir(os.path.join(OUT, folder))):
            if name.endswith('.woff2') and '%s/%s' % (folder, name) not in wanted:
                os.remove(os.path.join(OUT, folder, name))
                print('removed stale %s/%s' % (folder, name))
    return check(args)


# ── checking (standard library only) ──────────────────────────────────────────────────────────
def parse_css(path):
    faces = []
    for block in re.findall(r'@font-face\s*\{([^}]*)\}', read(path)):
        d = {}
        for decl in block.split(';'):
            k, _, v = decl.partition(':')
            if v:
                d[k.strip()] = v.strip()
        url = re.search(r'url\("?([^")]+)"?\)', d.get('src', ''))
        faces.append(dict(family=d.get('font-family', '').strip('"'), weight=d.get('font-weight', '400'),
                          style=d.get('font-style', 'normal'), url=url.group(1) if url else '',
                          range=parse_range(d['unicode-range']) if 'unicode-range' in d else None, display=d.get('font-display')))
    return faces


def check(args):
    """Coverage and consistency of what is in assets/fonts/ against the text of the site."""
    chars = collect()
    site = (chars['a'] | chars['q'] | chars['b']) - chars['optional']
    manifest = json.load(open(os.path.join(OUT, 'manifest.json'), encoding='utf-8'))['families']
    problems, notes = [], []
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        TTFont = None
        notes.append('fontTools is not installed: the character maps inside the WOFF2 files were not compared with the CSS')
    for fam in CJK + LATIN:
        fam_id = fam['id']
        path = os.path.join(OUT, fam_id + '.css')
        if not os.path.isfile(path):
            problems.append('%s.css is missing' % fam_id)
            continue
        faces = parse_css(path)
        groups = collections.defaultdict(list)
        for face in faces:
            groups[(face['family'], face['style'], face['weight'])].append(face)
            file = os.path.join(OUT, face['url'])
            if face['display'] != 'swap':
                problems.append('%s: %s is not font-display: swap' % (fam_id, face['url']))
            if not face['range']:
                problems.append('%s: %s has an empty unicode-range' % (fam_id, face['url']))
            if not os.path.isfile(file) or os.path.getsize(file) < 500:
                problems.append('%s: %s is missing or empty' % (fam_id, face['url']))
            elif TTFont and face['range'] is not None:
                cmap = set(TTFont(file, lazy=True).getBestCmap().keys())
                if not face['range'] <= cmap:
                    problems.append('%s: %s declares %d characters the file does not contain' % (fam_id, face['url'], len(face['range'] - cmap)))
                if fam in CJK and cmap != face['range']:
                    problems.append('%s: %s contains %d characters its unicode-range does not declare' % (fam_id, face['url'], len(cmap - face['range'])))
        families = collections.defaultdict(list)
        for (family, style, weight), members in groups.items():
            families[(family, style)].append((weight, members))
            seen = {}
            for face in members:
                for cp in face['range'] or ():
                    if cp in seen:
                        problems.append('%s: U+%04X is in both %s and %s (%s %s)' % (fam_id, cp, seen[cp], face['url'], family, weight))
                        break
                    seen[cp] = face['url']
        if fam in LATIN:
            for (family, style, weight), members in groups.items():
                if family.endswith(' En'):
                    continue
                bad = set().union(*[m['range'] for m in members]) & LATIN_YIELD
                if bad:
                    problems.append('%s: "%s" claims Chinese punctuation %s' % (fam_id, family, unicode_range(bad)))
            continue
        lacking = {ord(c) for c in manifest[fam_id]['missing']}
        for (family, style), weights in families.items():
            if len({w for w, _m in weights}) != 1:
                problems.append('%s: "%s" has slices with different weight descriptors %s' % (fam_id, family, sorted({w for w, _m in weights})))
            members = [m for _w, ms in weights for m in ms]
            covered = set().union(*[m['range'] for m in members])
            gap = site - covered - lacking
            text = {c for c in gap if is_han(c) or 0x3000 <= c <= 0x30FF or 0xFF00 <= c <= 0xFFEF}
            if text:   # Chinese text must never fall back to a system font
                problems.append('%s: "%s" does not cover %d characters of the site: %s' % (fam_id, family, len(text), ''.join(chr(c) for c in sorted(text))[:80]))
            if gap - text:
                notes.append('%s: %d symbols of the site are in no slice (the system font draws them): %s'
                             % (family, len(gap - text), ' '.join(chr(c) for c in sorted(gap - text))[:80]))
            by_slice = {re.sub(r'^.*/([a-z]+\d*)-.*$', r'\1', m['url']): m['range'] for m in members}
            where = {cp: n for n, r in by_slice.items() for cp in r}
            split = sorted((b, m) for b, m in chars['pairs'] if b in where and m in where and where[b] != where[m])
            if split:
                problems.append('%s: "%s" has a character and its combining mark in different slices (%s): a system font draws them — run scripts/fonts.py'
                                % (fam_id, family, ', '.join('U+%04X in %s + U+%04X in %s' % (b, where[b], m, where[m]) for b, m in split[:4])))
            first = by_slice.get('a', set())
            late = (chars['a'] & covered) - first
            if late:
                where = collections.Counter(n for cp in late for n, r in by_slice.items() if cp in r)
                notes.append('%s: %d first-view characters are outside slice a (in %s): %s — run scripts/fonts.py to move them'
                             % (family, len(late), ', '.join('%s×%d' % kv for kv in sorted(where.items())), ''.join(chr(c) for c in sorted(late))[:60]))
            early = set().union(*[r for n, r in by_slice.items() if n[0] in 'aqbl'])
            new = ((chars['q'] | chars['b']) & covered) - early
            if new:
                where = collections.Counter(n for cp in new for n, r in by_slice.items() if cp in r)
                notes.append('%s: %d characters of the letters are in later slices (%s): %s — fine, optional: run scripts/fonts.py'
                             % (family, len(new), ', '.join('%s×%d' % kv for kv in sorted(where.items())), ''.join(chr(c) for c in sorted(new))[:60]))
        if lacking & site:
            notes.append('%s: the upstream font has no glyph for %s (the system font draws them)' % (fam['family'], ' '.join(chr(c) for c in sorted(lacking & site))))
    print('\ncheck: %d letters, %d distinct characters (%d Han)' % (chars['posts'], len(site), sum(1 for c in site if is_han(c))))
    for line in notes:
        print('  note: ' + line)
    for line in problems:
        print('  PROBLEM: ' + line)
    print('check: ' + ('FAILED' if problems else 'ok'))
    return 1 if problems else 0


# ── fetching ──────────────────────────────────────────────────────────────────────────────────
def fetch(args):
    os.makedirs(args.src, exist_ok=True)
    for key, s in SOURCES.items():
        path = os.path.join(args.src, s['file'])
        if not os.path.isfile(path):
            print('downloading %s ...' % s['url'])
            data = urllib.request.urlopen(s['url'], timeout=300).read()
            if 'member' in s:
                data = zipfile.ZipFile(io.BytesIO(data)).read(s['member'])
            with open(path, 'wb') as f:
                f.write(data)
        digest = hashlib.sha256(open(path, 'rb').read()).hexdigest()
        if digest != s['sha256']:
            sys.exit('%s: SHA-256 is %s, expected %s — delete the file and fetch again, or review the change upstream' % (path, digest, s['sha256']))
        print('ok  %s' % s['file'])
    return 0


def main():
    ap = argparse.ArgumentParser(description='Regenerate assets/fonts/ (see the top of this file).')
    ap.add_argument('--src', default=os.path.join(ROOT, '.fonts-src'), help='folder with the source fonts (default: .fonts-src)')
    ap.add_argument('--fetch', action='store_true', help='download the pinned source fonts into --src and verify them')
    ap.add_argument('--check', action='store_true', help='only check coverage of what is already in assets/fonts/')
    ap.add_argument('--only', default='', help='comma-separated family ids to rebuild (default: all)')
    ap.add_argument('--jobs', type=int, default=min(6, os.cpu_count() or 2))
    args = ap.parse_args()
    if args.fetch:
        return fetch(args)
    if args.check:
        return check(args)
    return build(args)


if __name__ == '__main__':
    sys.exit(main())
