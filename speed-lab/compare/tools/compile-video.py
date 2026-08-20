#!/usr/bin/env python3
"""EXPERIMENTAL lab tool — turn raw screencast frames into labelled clips.

Reads <label>.json written by record.mjs. Every frame carries a wall-clock
stamp and every lane carries its document's performance.timeOrigin, so a
frame's offset from navigation start is exact. Emits six 1280x800 clips
(3 variants x cold/warm), a 2x3 comparison grid, and tweet stills.
"""
import json
import os
import shutil
import subprocess
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/rec/out'
DST = sys.argv[2] if len(sys.argv) > 2 else '/tmp/rec/final'

CLIP_SEC = 6.0
FPS = 30
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
BAND = 96
INK, DIM, BG = '0xF2F2F5', '0x9A9AA8', '0x14141A'
TINT = {'vanilla': '0xE05263', 'fable': '0x4FA3F7', 'qwen': '0xF2A93B'}
TITLE = {'vanilla': 'VANILLA', 'fable': 'FABLE', 'qwen': 'QWEN 3.8'}
SUB = {
    'vanilla': 'seed 4dc103a4 - no cache headers, no compression',
    'fable': 'iter20 - cache + brotli + bundling + inlined /posts',
    'qwen': 'iter31 - immutable cache + gzip',
}
ORDER = ['vanilla', 'fable', 'qwen']


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def esc(s):
    return s.replace(':', '\\:').replace("'", "")


def build_sequence(frames, t0, frames_dir, seq_dir):
    """Resample the change-driven screencast onto a CFR grid anchored at nav start.

    Each output slot shows the newest frame captured at or before its timestamp,
    so slot i is what the screen looked like i/FPS seconds after navigation.
    """
    shutil.rmtree(seq_dir, ignore_errors=True)
    os.makedirs(seq_dir)
    stamped = sorted(((f['epochMs'] - t0) / 1000.0, f['name']) for f in frames)
    if not stamped or stamped[0][0] > 0:
        raise SystemExit('no pre-navigation frame to anchor on')
    cur, idx = stamped[0][1], 0
    for i in range(int(CLIP_SEC * FPS)):
        t = i / FPS
        while idx < len(stamped) and stamped[idx][0] <= t:
            cur = stamped[idx][1]
            idx += 1
        shutil.copyfile(os.path.join(frames_dir, cur), os.path.join(seq_dir, f'{i:05d}.jpg'))


def clip(variant, lane, meta, frames_dir, out):
    m = meta['runs'][lane]
    seq_dir = f'/tmp/seq-{variant}-{lane}'
    build_sequence(meta['frames'], m['timeOrigin'], frames_dir, seq_dir)
    stats = f"FCP {m['fcp']} ms   LCP {m['lcp']} ms   load {m['load']} ms"
    vf = ','.join([
        f'scale=1280:800',
        f'pad=1280:{800 + BAND}:0:{BAND}:color={BG}',
        f"drawtext=fontfile={FONT}:text='{TITLE[variant]}':fontcolor={TINT[variant]}:fontsize=40:x=28:y=14",
        f"drawtext=fontfile={FONT}:text='{lane.upper()}':fontcolor={INK}:fontsize=40:x=28+tw+180:y=14",
        f"drawtext=fontfile={FONT}:text='{esc(SUB[variant])}':fontcolor={DIM}:fontsize=21:x=28:y=60",
        f"drawtext=fontfile={MONO}:text='%{{eif\\:t\\:d}}.%{{eif\\:trunc(mod(t\\,1)*100)\\:d\\:2}}s':"
        f'fontcolor={INK}:fontsize=44:x=w-tw-28:y=12',
        f"drawtext=fontfile={MONO}:text='{esc(stats)}':fontcolor={DIM}:fontsize=20:x=w-tw-28:y=64",
        f'drawbox=x=0:y={BAND - 3}:w=iw:h=3:color={TINT[variant]}:t=fill',
    ])
    run(['ffmpeg', '-y', '-v', 'error', '-framerate', str(FPS), '-i', f'{seq_dir}/%05d.jpg',
         '-vf', vf, '-r', str(FPS), '-c:v', 'libx264',
         '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out])


def grid(clips, out):
    inputs = []
    for lane in ['cold', 'warm']:
        for v in ORDER:
            inputs += ['-i', clips[(v, lane)]]
    head = (
        'NONIO MAIN FEED - 21 POSTS - SLOW 4G (1.6 Mbps down / 750 kbps up / 150 ms RTT) - 1280x800 - '
        'timer starts at navigation'
    )
    fc = ''.join(f'[{i}:v]scale=640:448[c{i}];' for i in range(6))
    fc += '[c0][c1][c2][c3][c4][c5]xstack=inputs=6:layout=0_0|640_0|1280_0|0_448|640_448|1280_448[g];'
    fc += (f'[g]pad=1920:{896 + 72}:0:72:color={BG},'
           f"drawtext=fontfile={FONT}:text='{esc(head)}':fontcolor={INK}:fontsize=24:x=28:y=24[o]")
    run(['ffmpeg', '-y', '-v', 'error'] + inputs + ['-filter_complex', fc, '-map', '[o]',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', out])


def still(src, t, out):
    run(['ffmpeg', '-y', '-v', 'error', '-ss', str(t), '-i', src, '-frames:v', '1', out])


if __name__ == '__main__':
    os.makedirs(f'{DST}/clips', exist_ok=True)
    os.makedirs(f'{DST}/stills', exist_ok=True)
    clips, summary = {}, {}
    for v in ORDER:
        meta = json.load(open(f'{SRC}/{v}.json'))
        summary[v] = {k: {m: r[m] for m in ('firstPaint', 'fcp', 'lcp', 'load', 'requests', 'transferBytes', 'posts')}
                      for k, r in meta['runs'].items()}
        for lane in ('cold', 'warm'):
            out = f'{DST}/clips/{v}-{lane}-slow4g.mp4'
            clip(v, lane, meta, f'{SRC}/{v}-frames', out)
            clips[(v, lane)] = out
            print('clip', out)
    grid(clips, f'{DST}/nonio-slow4g-vanilla-fable-qwen.mp4')
    for v in ORDER:
        for lane in ('cold', 'warm'):
            for t in (1.0, 2.5, 5.0):
                still(clips[(v, lane)], t, f'{DST}/stills/{v}-{lane}-t{str(t).replace(".", "s")}.png')
    still(f'{DST}/nonio-slow4g-vanilla-fable-qwen.mp4', 1.0, f'{DST}/stills/grid-t1s0.png')
    still(f'{DST}/nonio-slow4g-vanilla-fable-qwen.mp4', 2.5, f'{DST}/stills/grid-t2s5.png')
    json.dump(summary, open(f'{DST}/measured.json', 'w'), indent=2)
    print(json.dumps(summary, indent=2))
