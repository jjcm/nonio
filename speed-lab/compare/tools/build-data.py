#!/usr/bin/env python3
"""EXPERIMENTAL lab tool — emit the CSVs the comparison charts plot.

Sources, in order of authority:
  Fable  — speed-lab/results.json on cursor/speed-lab-nonio-feed (this branch).
  Qwen   — speed-lab/SPEED_LAB.md on cursor/speed-lab-qwen-nonio, transcribed
           into QWEN below (that log has no machine-readable results file).
  Slow 4G head-to-head — speed-lab/compare/video/measured.json, produced by
           tools/record.mjs in this recap's own run.

Nothing here is re-derived or smoothed: every number appears in one of those
three sources.
"""
import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
COMPARE = os.path.dirname(HERE)
DATA = os.path.join(COMPARE, 'data')

# Qwen track, Lighthouse 13.4.1 desktop preset, median of 3 cold + 3 warm,
# `python3 speed-lab/run_baseline.py`. iter13 (gate) and iter16 (aborted) never
# ran a measurement cycle and are absent by construction. iter12 changed no code
# — it is the calibration re-baseline the log anchors later verdicts against.
# (iter, verdict, cold FCP, cold LCP, warm FCP, warm LCP, change)
QWEN = [
    (0, 'baseline', 787.8, 1333.5, 790.3, 1257.8, 'vanilla seed'),
    (1, 'keep', 624.2, 1096.3, 623.8, 1056.4, 'split eager component barrel'),
    (2, 'revert', 622.9, 1055.6, 623.1, 1074.0, 'dedupe startup double /posts'),
    (3, 'revert', 562.8, 1208.2, 562.7, 1067.0, 'defer all eager classic scripts'),
    (4, 'revert', 549.5, 1154.3, 551.2, 1139.9, 'defer 6 per-route page scripts'),
    (5, 'revert', 623.4, 1088.8, 603.2, 1069.8, 'static LCP element markup'),
    (6, 'keep', 587.4, 1052.8, 584.4, 995.5, 'lazy sidebar voice/LiveKit module'),
    (7, 'revert', 598.2, 1091.2, 585.6, 1061.5, 'lazy grid-lanes polyfill'),
    (8, 'revert', 604.9, 998.0, 585.0, 1036.5, 'drop #items entrance fade'),
    (9, 'revert', 604.2, 1019.9, 605.2, 1000.6, 'batch idle createPosts appends'),
    (10, 'revert', 605.4, 1057.3, 605.0, 1037.6, '#items ::before veil'),
    (11, 'revert', 604.2, 1085.5, 604.7, 1067.5, 'drop translateY only'),
    (12, 'calibration', 604.8, 1054.3, 604.8, 998.8, 'pristine re-baseline, no code change'),
    (14, 'keep', 606.4, 961.4, 217.0, 470.1, 'immutable Cache-Control js/css/wasm/fonts/images'),
    (15, 'revert', 585.6, 1018.0, 217.0, 490.2, 'lazy 5 modal components'),
    (17, 'revert', 623.6, 994.8, 217.0, 450.2, 'eager head module for tags.js'),
    (18, 'revert', 585.0, 1053.2, 217.0, 529.9, 'static #tag-input in route markup'),
    (19, 'revert', 599.2, 1179.2, 237.4, 523.9, 'shorten #items ramp 0.35s to 0.12s'),
    (20, 'revert', 604.3, 1020.3, 217.2, 470.1, 'aspect-ratio box on first card media'),
    (21, 'revert', 604.3, 957.8, 217.0, 529.5, 'fetchpriority=high first thumbnail'),
    (22, 'revert', 605.2, 1015.9, 217.0, 529.7, 'loading=eager first thumbnail'),
    (23, 'revert', 623.4, 1056.4, 217.0, 449.6, 'head preload tags.js'),
    (24, 'revert', 605.3, 1038.3, 217.0, 529.9, 'preconnect image CDN :4203'),
    (25, 'revert', 604.4, 1018.6, 217.0, 489.6, 'content-visibility below-fold cards'),
    (26, 'revert', 605.4, 1057.5, 217.0, 469.7, 'idle-gate markdown.wasm instantiate'),
    (27, 'revert', 604.4, 1055.2, 217.0, 469.5, 'shrink #tag-input placeholder to 11px'),
    (28, 'keep', 427.8, 802.8, 177.0, 430.1, 'gzip js/css/html/svg'),
    (29, 'revert', 595.9, 1061.9, 177.0, 429.7, 'brotli q11 preferred over gzip'),
    (30, 'keep', 427.9, 783.0, 177.0, 429.9, 'gzip .wasm'),
    (31, 'keep', 423.1, 784.9, 177.0, 429.8, 'memoize per-file gzip buffers'),
]

# Largest single KEEP deltas, each measured on the harness that gated it.
# Fable rows read off speed-lab/results.json (Slow 4G, n=5, medians); Fable's
# Lighthouse column only exists from iter12 on, so its early keeps have no LH
# delta and cannot be plotted on the Lighthouse panel.
KEEP_DELTAS = [
    ('fable', 1, 'slow4g', 'static ETag/304 + max-age=300', 'warm load', 4434.8, 314.7),
    ('fable', 1, 'slow4g', 'static ETag/304 + max-age=300', 'warm FCP', 3968, 328),
    ('fable', 2, 'slow4g', 'defer non-feed components', 'cold FCP', 3996, 2392),
    ('fable', 3, 'slow4g', 'defer markdown-wasm loader', 'cold FCP', 2392, 2184),
    ('fable', 5, 'slow4g', 'gzip dev-server responses', 'cold FCP', 2184, 1560),
    ('fable', 6, 'slow4g', 'embed /posts in shell HTML', 'cold LCP', 1980, 1788),
    ('fable', 7, 'slow4g', 'de-block 8 page scripts', 'cold FCP', 1564, 1444),
    ('fable', 8, 'slow4g', 'markdown-wasm on demand', 'cold FCP', 1444, 1376),
    ('fable', 9, 'slow4g', 'esbuild-bundle critical graphs', 'cold FCP', 1376, 968),
    ('fable', 10, 'slow4g', 'minify boot bundles', 'cold FCP', 968, 936),
    ('fable', 11, 'slow4g', 'modulepreload 2 shared chunks', 'cold FCP', 936, 776),
    ('fable', 12, 'slow4g', 'preload the LCP thumbnail', 'cold LCP', 1000, 828),
    ('fable', 19, 'slow4g', 'brotli over gzip', 'cold FCP', 784, 744),
    ('fable', 20, 'slow4g', 'shell document ETag/304', 'warm FCP', 236, 180),
    ('fable', 13, 'lighthouse', 'skip redundant boot /posts merge', 'warm LCP', 324.7, 267.2),
    ('fable', 15, 'lighthouse', 'dedupe boot /tags + /communities GETs', 'cold LCP', 607.1, 587.0),
    ('fable', 19, 'lighthouse', 'brotli over gzip', 'cold LCP', 585.6, 563.1),
    ('qwen', 1, 'lighthouse', 'split eager component barrel', 'cold LCP', 1333.5, 1096.3),
    ('qwen', 6, 'lighthouse', 'lazy sidebar voice/LiveKit module', 'cold LCP', 1096.3, 1052.8),
    ('qwen', 14, 'lighthouse', 'immutable Cache-Control', 'warm LCP', 995.5, 470.1),
    ('qwen', 14, 'lighthouse', 'immutable Cache-Control', 'warm FCP', 604.8, 217.0),
    ('qwen', 28, 'lighthouse', 'gzip js/css/html/svg', 'cold FCP', 606.4, 427.8),
    ('qwen', 28, 'lighthouse', 'gzip js/css/html/svg', 'cold LCP', 961.4, 802.8),
    ('qwen', 30, 'lighthouse', 'gzip .wasm', 'cold LCP', 802.8, 783.0),
    ('qwen', 31, 'lighthouse', 'memoize per-file gzip buffers', 'cold FCP', 427.9, 423.1),
]


def write(name, header, rows):
    path = os.path.join(DATA, name)
    with open(path, 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)
    print(f'{path} ({len(rows)} rows)')


def main():
    os.makedirs(DATA, exist_ok=True)
    fable = json.load(open(os.path.join(COMPARE, os.pardir, 'results.json')))

    lh = []
    for it in fable['iterations']:
        m = it.get('lighthouse')
        if m:
            lh.append(['fable', it['iter'], it['verdict'], m['coldFcp'], m['coldLcp'],
                       m['warmFcp'], m['warmLcp'], m['n'], it['change']])
    for it, verdict, cf, cl, wf, wl, change in QWEN:
        lh.append(['qwen', it, verdict, cf, cl, wf, wl, 3, change])
    write('lighthouse-desktop.csv',
          ['agent', 'iter', 'verdict', 'cold_fcp_ms', 'cold_lcp_ms', 'warm_fcp_ms', 'warm_lcp_ms',
           'n', 'change'], lh)

    s4g = []
    for it in fable['iterations']:
        m = it.get('slow4g')
        if m:
            s4g.append([it['iter'], it['verdict'], m['coldLoad'], m['coldFcp'], m['coldLcp'],
                        m['coldFeedPaint'], m['warmLoad'], m['warmFcp'], m['warmLcp'],
                        m['warmFeedPaint'], m['n'], it['change']])
    write('fable-slow4g.csv',
          ['iter', 'verdict', 'cold_load_ms', 'cold_fcp_ms', 'cold_lcp_ms', 'cold_feedpaint_ms',
           'warm_load_ms', 'warm_fcp_ms', 'warm_lcp_ms', 'warm_feedpaint_ms', 'n', 'change'], s4g)

    f0 = next(i for i in fable['iterations'] if i['iter'] == 0)
    f20 = next(i for i in fable['iterations'] if i['iter'] == 20)
    q0 = QWEN[0]
    q31 = QWEN[-1]
    champ = []
    for agent, harness, base, champion, keys in [
        ('fable', 'lighthouse desktop', f0['lighthouse'], f20['lighthouse'],
         [('cold FCP', 'coldFcp'), ('cold LCP', 'coldLcp'), ('warm FCP', 'warmFcp'), ('warm LCP', 'warmLcp')]),
        ('fable', 'slow 4g', f0['slow4g'], f20['slow4g'],
         [('cold FCP', 'coldFcp'), ('cold LCP', 'coldLcp'), ('warm FCP', 'warmFcp'), ('warm LCP', 'warmLcp')]),
    ]:
        for label, key in keys:
            a, b = base[key], champion[key]
            champ.append([agent, harness, 'iter0', 'iter20', label, a, b, round(100 * (a - b) / a, 1)])
    for label, i in [('cold FCP', 2), ('cold LCP', 3), ('warm FCP', 4), ('warm LCP', 5)]:
        a, b = q0[i], q31[i]
        champ.append(['qwen', 'lighthouse desktop', 'iter0', 'iter31', label, a, b,
                      round(100 * (a - b) / a, 1)])
    write('champion-vs-vanilla.csv',
          ['agent', 'harness', 'baseline', 'champion', 'metric', 'baseline_ms', 'champion_ms',
           'reduction_pct'], champ)

    write('keep-deltas.csv',
          ['agent', 'iter', 'harness', 'change', 'metric', 'before_ms', 'after_ms', 'saved_ms'],
          [[a, i, h, c, m, b, af, round(b - af, 1)] for a, i, h, c, m, b, af in KEEP_DELTAS])

    measured_path = os.path.join(COMPARE, 'video', 'measured.json')
    if os.path.exists(measured_path):
        measured = json.load(open(measured_path))
        rows = [[v, lane, r['firstPaint'], r['fcp'], r['lcp'], r['load'], r['requests'],
                 r['transferBytes'], r['posts']]
                for v in ('vanilla', 'fable', 'qwen') for lane, r in measured[v].items()]
        write('slow4g-head-to-head.csv',
              ['variant', 'lane', 'first_paint_ms', 'fcp_ms', 'lcp_ms', 'load_ms', 'requests',
               'transfer_bytes', 'posts'], rows)
    else:
        print(f'skip slow4g-head-to-head.csv (no {measured_path})', file=sys.stderr)


if __name__ == '__main__':
    main()
