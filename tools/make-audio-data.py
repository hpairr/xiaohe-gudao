# -*- coding: utf-8 -*-
"""把 assets/audio/*.mp3 生成成 file:// 专用的数据脚本 assets/audio/data/{key}.js。

为什么需要：双击 html（file://）打开时，浏览器禁止 fetch 读本地文件，也禁止
createMediaElementSource / captureStream 取本地音频（CORS 会把信号打成全 0），
Web Audio 就没有音源可用，波形只能静止。`<script>` 加载本地脚本不受这条限制，
所以把同一段 mp3 的 base64 放进数据脚本，解码后就能和线上一样做实时频谱。

线上（http/https）仍然 fetch mp3，这些数据脚本不会被下载。

改了 assets/audio/*.mp3 之后重新跑一次：
    python tools/make-audio-data.py
"""
import base64
import hashlib
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'assets' / 'audio'
OUT = AUDIO / 'data'
KEYS = ['nushu', 'butterfly', 'drum', 'bridge', 'panwang', 'brocade']

TEMPLATE = (
    "/* 由 tools/make-audio-data.py 生成，不要手改。\n"
    "   内容 = assets/audio/{key}.mp3 的 base64（md5 {md5}，{size} 字节）。\n"
    "   只在 file:// 打开时加载，见 assets/audio-player.js 的 loadData。 */\n"
    "window.XiaoheAudioData=window.XiaoheAudioData||{{}};"
    "window.XiaoheAudioData['{key}']='data:audio/mpeg;base64,{b64}';\n"
)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    missing = []
    total = 0
    for key in KEYS:
        mp3 = AUDIO / (key + '.mp3')
        if not mp3.exists():
            missing.append(key)
            continue
        raw = mp3.read_bytes()
        b64 = base64.b64encode(raw).decode('ascii')
        text = TEMPLATE.format(
            key=key,
            md5=hashlib.md5(raw).hexdigest(),
            size=len(raw),
            b64=b64,
        )
        target = OUT / (key + '.js')
        target.write_text(text, encoding='utf8', newline='\n')
        total += len(text.encode('utf8'))
        print('%-9s mp3 %7d B -> %s %7d B' % (key, len(raw), target.name, target.stat().st_size))

    if missing:
        print('缺 mp3：' + ', '.join(missing), file=sys.stderr)
        return 1
    print('合计 %.1f MB（只给 file:// 用，线上不下载）' % (total / 1024 / 1024))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
