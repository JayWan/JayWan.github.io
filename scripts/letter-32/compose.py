#!/usr/bin/env python3
"""
《无限不循环》 —— 一首用 π 写的摇篮曲，给派派。

这个脚本既是乐谱，也是乐器：运行它就会把曲子合成出来。
    python compose.py out_dir          # 生成 无限不循环.wav / .mp3 和一份文字谱

写法（也就是全部的秘密）：

1. 旋律 = 把 π 当简谱唱。
   3.14159 26535 …… 每一位小数就是一个音：1 2 3 4 5 6 7 = do re mi fa sol la si，
   8 和 9 是高音的 do 和 re，0 是休止（简谱里 0 本来就是休止符）。
   π 无限不循环，所以这条旋律从头到尾没有一句是重复的。

2. 伴奏 = 一圈一圈地转。
   三拍子，每小节都是同一个摇晃的分解和弦型，像公转一样周而复始。
   不重复的是孩子，循环往复的是陪着他的人。
   和弦不是我凭感觉配的：对每一小节，在 D 大调的六个和弦里
   挑一个和旋律最合得来、和前后衔接最顺的（动态规划，见 harmonize()）。

3. 结尾 = 2 2 1。
   π 写不完，所以我在第 112 位停下，接上 re re do。
   在简谱里 2 → 1 正好是"回到主音"，也就是回家。

没有采样，没有现成的音色库：每个音都是几条正弦波加一个衰减包络，
听起来像八音盒；混响是一段指数衰减的噪声做的卷积。
"""
import sys, os, math, struct, wave
import numpy as np

SR = 44100
BPM = 84
BEAT = 60.0 / BPM
KEY_TONIC = 587.33          # 简谱的 1 = D5
MAJOR = [0, 2, 4, 5, 7, 9, 11]   # 大调音阶，单位：半音

PI_DIGITS = (
    "3"
    "1415926535" "8979323846" "2643383279" "5028841971" "6939937510"
    "5820974944" "5923078164" "0628620899" "8628034825" "3421170679"
    "8214808651" "3282306647" "0938446095"
)

# ---------------------------------------------------------------- 乐谱 ----

# 节奏型：每个乐句 4 小节，数字是每个音占几拍（一小节 3 拍）
PHRASE_A = [[1, 1, 1], [2, 1], [1, 1, 1], [3]]            # 9 个音
PHRASE_B = [[1, 1, 1], [1.5, 0.5, 1], [1, 1, 1], [3]]     # 10 个音
SECTIONS = [("A", PHRASE_A, 4), ("B", PHRASE_B, 4), ("A2", PHRASE_A, 4)]
INTRO_BARS = 2

CHORDS = {            # 和弦里的音级（1-7）与低音的频率
    "I":   ({1, 3, 5}, 146.83),   # D
    "ii":  ({2, 4, 6}, 164.81),   # Em
    "iii": ({3, 5, 7}, 185.00),   # F#m
    "IV":  ({4, 6, 1}, 196.00),   # G
    "V":   ({5, 7, 2}, 110.00),   # A
    "vi":  ({6, 1, 3}, 123.47),   # Bm
}
# 顺的进行给加分（功能和声里常见的走法）
GOOD_MOVES = {
    ("I", "IV"), ("I", "vi"), ("I", "V"), ("I", "ii"), ("I", "iii"),
    ("ii", "V"), ("iii", "vi"), ("iii", "IV"),
    ("IV", "V"), ("IV", "I"), ("IV", "ii"),
    ("V", "I"), ("V", "vi"),
    ("vi", "IV"), ("vi", "ii"), ("vi", "V"),
}


def degree(d):
    """简谱数字 -> (音级 1-7, 高几个八度)。8、9 是高音的 1、2。"""
    return (d, 0) if d <= 7 else (d - 7, 1)


def freq(d, octave_shift=0):
    deg, up = degree(d)
    semis = MAJOR[deg - 1] + 12 * (up + octave_shift)
    return KEY_TONIC * 2 ** (semis / 12)


def build_melody():
    """把 π 的数字按节奏型排进小节。返回 bars: [[(digit, start_beat, beats), ...], ...]"""
    digits = [int(c) for c in PI_DIGITS]
    bars, sections, k = [], [], 0
    for name, phrase, repeats in SECTIONS:
        first = len(bars)
        for _ in range(repeats):
            for rhythm in phrase:
                t, notes = 0.0, []
                for beats in rhythm:
                    notes.append((digits[k], t, beats))
                    k += 1
                    t += beats
                bars.append(notes)
        sections.append((name, first, len(bars)))
    return bars, sections, k


def fit(notes, chord):
    """这一小节的旋律和这个和弦有多合。"""
    tones, _ = CHORDS[chord]
    score = 0.0
    for d, start, beats in notes:
        if d == 0:
            continue
        deg, _ = degree(d)
        weight = beats * (1.4 if start == 0 else 1.0)     # 强拍和长音更要紧
        if deg in tones:
            score += 1.0 * weight
        elif (deg == 4 and 3 in tones) or (deg == 1 and 7 in tones):
            score -= 1.6 * weight                          # 压在和弦音上方半音：最刺耳
        else:
            score -= 0.25 * weight                         # 六度、七度、九度：有点悬着，但好听
    return score


def harmonize(bars):
    """维特比：给每小节选一个和弦，让"与旋律相合 + 进行顺畅"的总分最高。"""
    names = list(CHORDS)
    n = len(bars)
    best = [{c: -1e9 for c in names} for _ in range(n)]
    back = [{} for _ in range(n)]
    for i in range(n):
        for c in names:
            s = fit(bars[i], c)
            pos = i % 4
            if pos == 0 and c in ("I", "vi", "IV"):
                s += 0.5                                   # 乐句从稳的和弦开始
            if pos == 3 and c in ("V", "I"):
                s += 0.6                                   # 乐句末尾要么半终止要么回家
            if i == 0:
                best[i][c] = s + (1.5 if c == "I" else 0)
                continue
            for p in names:
                t = best[i - 1][p] + s
                if p == c:
                    t -= 0.9                               # 不要原地不动
                elif (p, c) in GOOD_MOVES:
                    t += 0.7
                if t > best[i][c]:
                    best[i][c], back[i][c] = t, p
    c = max(best[-1], key=best[-1].get)
    out = [c]
    for i in range(n - 1, 0, -1):
        c = back[i][c]
        out.append(c)
    return out[::-1]


# ---------------------------------------------------------------- 声音 ----

def tone(f, dur, partials, attack=0.004):
    """几条正弦波 + 各自的指数衰减。partials: [(倍频, 音量, 衰减时间秒), ...]"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, amp, tau in partials:
        if f * ratio < SR * 0.45:
            y += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
    a = int(attack * SR)
    y[:a] *= np.linspace(0, 1, a) ** 2
    tail = int(0.02 * SR)
    y[-tail:] *= np.linspace(1, 0, tail)
    return y


def music_box(f, vel=1.0):
    # 八音盒的簧片：基音之外有一个不成倍数的高泛音（约 6.27 倍），就是那一声"叮"
    return vel * tone(f, 3.2, [(1, 1.0, 1.15), (2, 0.30, 0.60), (3, 0.11, 0.40), (6.27, 0.15, 0.16)])


def soft_pluck(f, vel=1.0):
    return vel * tone(f, 2.6, [(1, 1.0, 1.1), (2, 0.16, 0.6), (3, 0.04, 0.3)], attack=0.007)


def bass(f, vel=1.0):
    return vel * tone(f, 2.8, [(1, 1.0, 1.15), (2, 0.30, 0.8), (3, 0.08, 0.45)], attack=0.012)   # 衰减短一点，换和弦时两个低音不打架


class Mix:
    def __init__(self, seconds):
        self.buf = np.zeros((int(seconds * SR) + SR * 6, 2))

    def add(self, y, at, pan=0.0, gain=1.0):
        i = int(at * SR)
        l = math.cos((pan + 1) * math.pi / 4)
        r = math.sin((pan + 1) * math.pi / 4)
        self.buf[i:i + len(y), 0] += y * gain * l
        self.buf[i:i + len(y), 1] += y * gain * r


def reverb(x, seconds=2.6, decay=0.55, wet=0.2, seed=221):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / decay)
        ir = np.convolve(ir, np.ones(24) / 24, mode="same")      # 把高频磨掉一点，暖一些
        ir[: int(0.018 * SR)] = 0                                  # 预延迟
        ir /= np.sqrt(np.sum(ir ** 2))
        size = 1 << (len(x) + n).bit_length()
        y = np.fft.irfft(np.fft.rfft(x[:, ch], size) * np.fft.rfft(ir, size), size)[: len(x)]
        out[:, ch] = x[:, ch] * (1 - wet * 0.3) + y * wet
    return out


def render():
    bars, sections, used = build_melody()
    chords = harmonize(bars)
    rng = np.random.default_rng(314159)

    # 小节时间表：引子 + 正文 + 尾声（渐慢）
    coda_chords = ["V", "I", "I", "I"]
    coda_stretch = [1.06, 1.2, 1.38, 1.5]
    plan = [("I", [], 1.0)] * INTRO_BARS
    plan += [(chords[i], bars[i], 1.0) for i in range(len(bars))]
    plan += [("V", [(2, 0, 2), (2, 2, 1)], coda_stretch[0]),       # 2 2
             ("I", [(1, 0, 3)], coda_stretch[1]),                  # 1
             ("I", [(8, 1, 2)], coda_stretch[2]),                  # 高八度再答一声
             ("I", [], coda_stretch[3])]
    total = sum(3 * BEAT * s for _, _, s in plan)
    mix = Mix(total)

    section_of = {}
    for name, a, b in sections:
        for i in range(a, b):
            section_of[i + INTRO_BARS] = name
    t0, text_score = 0.6, []
    for bi, (chord, notes, stretch) in enumerate(plan):
        beat = BEAT * stretch
        sec = section_of.get(bi, "intro" if bi < INTRO_BARS else "coda")
        tones, root = CHORDS[chord]
        third = root * 2 ** ((4 if chord in ("I", "IV", "V") else 3) / 12)
        fifth = root * 2 ** (7 / 12)

        # 伴奏：每小节同一个摇晃的型，六个八分音符
        last_bar = bi == len(plan) - 1
        if not last_bar:
            mix.add(bass(root, 0.40), t0, 0.0)
            if sec == "B":
                pattern = [None, fifth, root * 2, third * 2, root * 2, fifth]
            else:
                pattern = [None, fifth, third * 2, fifth, third * 2, fifth]
            level = 0.20 if sec in ("intro", "coda") else 0.24
            for k, f in enumerate(pattern):
                if f is None:
                    continue
                jitter = rng.uniform(-0.004, 0.004)
                mix.add(soft_pluck(f, level * (0.9 if k % 2 else 1.0)), t0 + k * beat / 2 + jitter, 0.28 if k % 2 else -0.28)
        else:
            # 最后一小节：主和弦从下往上慢慢拨开
            for k, f in enumerate([root, fifth, root * 2, third * 2, fifth * 2]):
                mix.add(soft_pluck(f, 0.22), t0 + k * 0.16, -0.3 + 0.15 * k)

        # 旋律：八音盒
        cell = []
        for d, start, beats in notes:
            cell.append("0" if d == 0 else str(d))
            cell += ["-"] * (int(round(beats)) - 1)
            if d == 0:
                continue
            vel = {0: 1.0, 1: 0.84, 2: 0.9}.get(int(start), 0.86)
            if sec == "B":
                vel *= 1.06
            if sec == "coda":
                vel *= 0.92
            jitter = rng.uniform(-0.005, 0.005)
            f = freq(d)
            pan = float(np.clip((math.log2(f / KEY_TONIC) - 0.5) * 0.5, -0.3, 0.3))
            mix.add(music_box(f, 0.62 * vel), t0 + start * beat + jitter, pan)
            if sec == "A2":                                        # 第三段：高八度轻轻叠一层
                mix.add(music_box(f * 2, 0.11 * vel), t0 + start * beat + jitter + 0.012, -pan)
        text_score.append((sec, chord, " ".join(cell) if cell else "· · ·"))
        t0 += 3 * beat

    end = t0 + 4.5
    x = mix.buf[: int(end * SR)]
    x = reverb(x)
    fade = int(3.0 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
    x -= x.mean(axis=0)
    x = np.tanh(x * 1.1) / np.tanh(1.1)                            # 很轻的软限幅
    x *= 10 ** (-1.5 / 20) / np.max(np.abs(x))
    return x, text_score, chords, used


# ---------------------------------------------------------------- 输出 ----

def id3(title, artist, album):
    def frame(fid, text):
        body = b"\x01" + text.encode("utf-16")
        return fid.encode() + struct.pack(">I", len(body)) + b"\x00\x00" + body
    frames = frame("TIT2", title) + frame("TPE1", artist) + frame("TALB", album)
    n = len(frames)
    size = bytes([(n >> 21) & 0x7F, (n >> 14) & 0x7F, (n >> 7) & 0x7F, n & 0x7F])
    return b"ID3\x03\x00\x00" + size + frames


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out, exist_ok=True)
    x, score, chords, used = render()
    pcm = (x * 32767).astype("<i2")

    with wave.open(os.path.join(out, "无限不循环.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

    try:
        import lameenc
        enc = lameenc.Encoder()
        enc.set_bit_rate(160); enc.set_in_sample_rate(SR); enc.set_channels(2); enc.set_quality(2)
        mp3 = bytes(enc.encode(pcm.tobytes())) + bytes(enc.flush())
        with open(os.path.join(out, "无限不循环.mp3"), "wb") as f:
            f.write(id3("无限不循环", "Claude", "221 FOREVER") + mp3)
    except ImportError:
        print("（没装 lameenc，只生成了 wav）")

    with open(os.path.join(out, "无限不循环.谱.txt"), "w", encoding="utf-8") as f:
        f.write("《无限不循环》  1 = D   3/4   ♩ = %d\n旋律取 π 的前 %d 位，尾声是 2 2 1\n\n" % (BPM, used))
        prev = None
        for i, (sec, chord, cell) in enumerate(score):
            if sec != prev:
                f.write("\n[%s]\n" % sec); prev = sec; col = 0
            f.write("| %-9s %-4s" % (cell, chord)); col += 1
            if col % 4 == 0:
                f.write("|\n")
        f.write("|\n")
    print("时长 %.1f 秒，用了 π 的前 %d 位，%d 小节" % (len(x) / SR, used, len(score)))


if __name__ == "__main__":
    main()
