#!/usr/bin/env python3
"""
第 32 封信的封面：《四千零七天》。

    python cover.py out.svg            # 只依赖标准库；再用任何浏览器把 SVG 转成图片即可

画法：
  从你们认识的那天（2015-11-28）到我写这封信的那天（2026-11-17），一天一粒，一共 4008 粒。
  第 n 天放在  半径 = c·√n、角度 = n × 137.5°（黄金角） 的位置上——向日葵排种子的办法：
  每一粒都落在前面所有种子留出的空隙里，所以越排越满，却从不重叠。
  细圈是年轮：每满一年画一圈。因为每天占的面积一样大，年轮越往外越密，和真的树一样。
  琥珀色的是写了信的日子：实心是他写的，空心是她写的。最外面那一粒白的，是这一封。
  两道稍亮的圈：在一起（第 85 天）、结婚（第 2084 天）。
"""
import sys, os, re, math, glob
from datetime import date

W, H = 2400, 1600
CX, CY = W / 2, H / 2
R = 690                                   # 最外一粒的半径
MET, TOGETHER, MARRIED = date(2015, 11, 28), date(2016, 2, 21), date(2021, 8, 12)
TODAY = date(2026, 11, 17)
GOLDEN = math.pi * (3 - math.sqrt(5))     # 137.50776…°

BG = "#13120f"
SEED = "#e8e1d0"
AMBER = "#f0b45c"
GUEST = "#f7f5ee"


def letters(posts_dir):
    """从 _posts 的 front matter 里读出每封信的日期和作者。"""
    out = []
    for path in sorted(glob.glob(os.path.join(posts_dir, "*"))):
        head = open(path, encoding="utf-8").read().split("---")[1]
        d = re.search(r"^date:\s*(\d+)-(\d+)-(\d+)", head, re.M)
        a = re.search(r"^author:\s*(\S+)", head, re.M)
        day = date(*map(int, d.groups()))
        out.append((day, a.group(1) if a else "Pikajay"))
    return out


def pos(n, c):
    r = c * math.sqrt(n)
    t = n * GOLDEN - math.pi / 2
    return CX + r * math.cos(t), CY + r * math.sin(t)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "cover.svg"
    posts = sys.argv[2] if len(sys.argv) > 2 else "_posts"
    total = (TODAY - MET).days                       # 4007
    c = R / math.sqrt(total)
    written = {}
    for day, author in letters(posts):
        if author != "Claude":
            written[(day - MET).days] = author

    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
         f'<rect width="{W}" height="{H}" fill="{BG}"/>',
         '<defs><radialGradient id="g"><stop offset="0" stop-color="#f0b45c" stop-opacity=".55"/>'
         '<stop offset="1" stop-color="#f0b45c" stop-opacity="0"/></radialGradient></defs>']

    # 年轮
    for k in range(1, total // 365 + 1):
        n = (date(MET.year + k, MET.month, MET.day) - MET).days
        s.append(f'<circle cx="{CX}" cy="{CY}" r="{c * math.sqrt(n):.1f}" fill="none" stroke="{SEED}" stroke-opacity=".17" stroke-width="1.5"/>')
    for d in (TOGETHER, MARRIED):
        n = (d - MET).days
        s.append(f'<circle cx="{CX}" cy="{CY}" r="{c * math.sqrt(n):.1f}" fill="none" stroke="{AMBER}" stroke-opacity=".38" stroke-width="2"/>')

    # 每一天
    for n in range(total + 1):
        if n in written or n == total:
            continue
        x, y = pos(n, c)
        s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4.1" fill="{SEED}" fill-opacity=".34"/>')

    # 写信的日子
    for n, author in sorted(written.items()):
        x, y = pos(n, c)
        s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="30" fill="url(#g)"/>')
        if author == "Pikachi":
            s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="8" fill="{BG}" stroke="{AMBER}" stroke-width="4"/>')
        else:
            s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="9.5" fill="{AMBER}"/>')

    # 这一封
    x, y = pos(total, c)
    s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="15" fill="none" stroke="{GUEST}" stroke-opacity=".5" stroke-width="1.5"/>')
    s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="{GUEST}"/>')
    s.append("</svg>")
    open(out, "w", encoding="utf-8").write("\n".join(s))
    print(f"{total + 1} 粒，其中 {len(written)} 粒是信；c = {c:.2f}px；最后一粒在 ({x:.0f}, {y:.0f})")


if __name__ == "__main__":
    main()
