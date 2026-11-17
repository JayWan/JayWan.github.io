# Font licences

本目录里的字体文件都是开源字体的**子集**，并且**改了名字**（F221 …）。原字体的作者、版本、来源和许可如下；许可全文见同目录的 [OFL.txt](OFL.txt)。

Every font file in this folder is a **modified version** of an open-source typeface: a subset
(only the characters this site needs, cut into `unicode-range` slices), converted to WOFF2,
variable axes narrowed or pinned, and — for the two Noto families — with the Simplified Chinese
localised forms (`locl`) made the default forms. Because a subset is a modification and several
of these typefaces declare Reserved Font Names, the files carry the project's own family names
("F221 …") in their name tables and in the CSS. The upstream copyright, author and licence
records in the name tables are kept as they were.

All seven typefaces are licensed under the **SIL Open Font License, Version 1.1**. The modified
files in this folder are distributed under the same licence. They are served as web fonts for
221forever.us only; they are not offered as installable fonts.

| Family in this folder | Upstream typeface | Version | Copyright notice (as in the upstream files) | Reserved Font Name |
|---|---|---|---|---|
| F221 Serif (`serif-sc`) | Noto Serif SC | 2.003 | (c) 2017-2024 Adobe (http://www.adobe.com/). | none declared |
| F221 Sans, F221 Sans 400 (`sans-sc`, `sans-sc-400`) | Noto Sans SC | 2.004 | (c) 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. | Source |
| F221 Fangsong (`fangsong`) | Zhuque Fangsong 朱雀仿宋 (technical preview) | 0.212 | Copyright (c) 2023, Zhejiang JadeFoci Techonology Co. LTD (https://www.jadefoci.com/) | none declared |
| F221 Mono (`mono`) | IBM Plex Mono (Light, Regular, Medium) | 2.3 | Copyright © 2017 IBM Corp. with Reserved Font Name "Plex" | Plex |
| F221 Garamond (`garamond`) | EB Garamond (roman and italic) | 1.003 | Copyright 2017 The EB Garamond Project Authors (https://github.com/octaviopardo/EBGaramond12) | none declared |
| F221 Grotesk (`grotesk`) | Archivo | 2.001 | Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo) | none declared |
| F221 Text (`text`) | Source Serif 4 (roman and italic) | 4.004 | © 2014 - 2021 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name ‘Source’. | Source |

## Where the source files came from

The exact files (URL and SHA-256 of each) are pinned in `scripts/fonts.py`, which is also the
tool that produced everything here.

- Noto Serif SC, Noto Sans SC, IBM Plex Mono, EB Garamond, Archivo, Source Serif 4:
  the `ofl/` folder of <https://github.com/google/fonts> at commit
  `7af0d90b4d532ffa4b041937b560c6df4e7b1e95` (`ofl/notoserifsc`, `ofl/notosanssc`,
  `ofl/ibmplexmono`, `ofl/ebgaramond`, `ofl/archivo`, `ofl/sourceserif4`). Each folder holds the
  font's `OFL.txt`. Upstream projects: <https://github.com/notofonts/noto-cjk>,
  <https://github.com/IBM/plex>, <https://github.com/octaviopardo/EBGaramond12>,
  <https://github.com/Omnibus-Type/Archivo>, <https://github.com/adobe-fonts/source-serif>.
- Zhuque Fangsong: release v0.212 of <https://github.com/TrionesType/zhuque>
  (`ZhuqueFangsong-v0.212.zip`), licence in the repository's `LICENSE.txt`. Its Latin letters and
  symbols are taken from Alegreya by Huerta Tipográfica, also under the OFL 1.1.

## Notes

- The copyright notice of Noto Serif SC above is the one inside the font file (name ID 0). The
  `OFL.txt` next to it in google/fonts starts with "Copyright 2012 Google Inc. All Rights
  Reserved." Both are reproduced here because they differ.
- Zhuque Fangsong is a pre-release. Its README asks, as a courtesy and not as a licence
  condition, that modified versions not be spread widely before the final release. What is here
  is a renamed subset used as a web font by this one site.
- "Noto" is a trademark of Google Inc.; "Source" is a trademark of Adobe; "IBM Plex" is a
  trademark of IBM Corp.; "Archivo" is a trademark of Omnibus-Type. The F221 names are used so
  that none of these names is applied to a modified font.
