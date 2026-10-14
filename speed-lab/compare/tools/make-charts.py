#!/usr/bin/env python3
"""EXPERIMENTAL lab tool — render the comparison charts from data/*.csv.

Every chart states its harness, its throttling and its n, because the two
tracks did not share one. Fable measured Playwright Slow 4G first and only
added Lighthouse desktop from iteration 12; Qwen measured Lighthouse desktop
only, for all its iterations. Charts never mix the two on one axis.
"""
import csv
import os
import textwrap

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

HERE = os.path.dirname(os.path.abspath(__file__))
COMPARE = os.path.dirname(HERE)
DATA = os.path.join(COMPARE, 'data')
OUT = os.path.join(COMPARE, 'charts')

BG, PANEL, INK, DIM, GRID = '#14141a', '#1c1c24', '#f2f2f5', '#9a9aa8', '#2c2c38'
FABLE, QWEN, VANILLA, GOOD = '#4fa3f7', '#f2a93b', '#e05263', '#4ad991'
W, DPI = 1600, 100

plt.rcParams.update({
    'figure.facecolor': BG, 'axes.facecolor': PANEL, 'savefig.facecolor': BG,
    'text.color': INK, 'axes.labelcolor': INK, 'xtick.color': DIM, 'ytick.color': DIM,
    'axes.edgecolor': GRID, 'grid.color': GRID, 'font.size': 13,
    'font.family': 'DejaVu Sans', 'axes.titlecolor': INK,
})


def load(name):
    with open(os.path.join(DATA, name)) as fh:
        return list(csv.DictReader(fh))


def fig(h, title, sub):
    f = plt.figure(figsize=(W / DPI, h / DPI), dpi=DPI)
    f.text(0.035, 1 - 30 / h, title, fontsize=26, fontweight='bold', va='top')
    f.text(0.035, 1 - 74 / h, '\n'.join(textwrap.wrap(sub, 142)), fontsize=13.5, color=DIM,
           va='top', linespacing=1.5)
    return f


def footer(f, text):
    f.text(0.035, 0.018, '\n'.join(textwrap.wrap(text, 168)), fontsize=11, color=DIM,
           va='bottom', linespacing=1.5)


def style(ax):
    ax.grid(axis='y', lw=0.8, alpha=0.55)
    ax.set_axisbelow(True)
    for s in ('top', 'right'):
        ax.spines[s].set_visible(False)


def series(ax, rows, agent, field, color, label):
    """One track's line. Gaps wider than one iteration are drawn dotted: those
    iterations were never measured on this harness, so the segment is a bridge,
    not data."""
    pts = sorted((int(r['iter']), float(r[field]), r['verdict'])
                 for r in rows if r['agent'] == agent)
    for (x0, y0, _), (x1, y1, _) in zip(pts, pts[1:]):
        gap = x1 - x0 > 1
        ax.plot([x0, x1], [y0, y1], color=color, lw=1.6 if gap else 2.1,
                ls=':' if gap else '-', alpha=0.55 if gap else 0.85, zorder=2)
    ax.plot([], [], color=color, lw=2.1, label=label)
    for x, y, verdict in pts:
        kept = verdict.startswith('keep') or verdict == 'baseline'
        ax.scatter([x], [y], s=74 if kept else 58, zorder=3, color=color if kept else BG,
                   edgecolors=color, linewidths=2.0)


def lh_chart(lane, letter, path):
    rows = load('lighthouse-desktop.csv')
    f = fig(960, f'{letter}. Lighthouse desktop \u2014 {lane} FCP and LCP by iteration',
            'Nonio main feed, 21-post fixture (10 image / 10 text / 1 video), seed 4dc103a4. '
            'Lighthouse desktop preset: simulated 40 ms RTT / 10 Mbps / 1x CPU. '
            'Fable n=5 medians, recorded only from iteration 12 on. Qwen n=3 medians, every '
            'iteration it measured. Filled marker = kept, hollow = reverted, dotted segment = '
            'iterations with no Lighthouse number.')
    axes = [f.add_axes([0.055, 0.145, 0.42, 0.62]), f.add_axes([0.555, 0.145, 0.42, 0.62])]
    for ax, metric in zip(axes, ('fcp', 'lcp')):
        field = f'{lane}_{metric}_ms'
        series(ax, rows, 'fable', field, FABLE, 'Fable (Cursor cloud, Fable 5)')
        series(ax, rows, 'qwen', field, QWEN, 'Qwen 3.8 27B (local, OpenCode)')
        style(ax)
        ax.set_title(f'{lane} {metric.upper()} \u2014 ms, lower is better', fontsize=16, pad=12,
                     loc='left')
        ax.set_xlabel('iteration')
        ax.set_ylim(bottom=0)
        ax.set_xlim(-1, 32)
        ax.set_xticks(range(0, 32, 4))
    axes[0].legend(loc='upper right', frameon=False, fontsize=13)
    footer(f, 'Fable: speed-lab/results.json @ cursor/speed-lab-nonio-feed (iteration 0 backfilled '
              'on soci-frontend@75e4cab). Qwen: speed-lab/SPEED_LAB.md @ '
              'cursor/speed-lab-qwen-nonio. Qwen iterations 13 and 16 ran no measurement cycle; '
              'iteration 12 changed no code and is its calibration re-baseline.')
    f.savefig(path)
    plt.close(f)
    print(path)


def chart_c(path):
    rows = load('champion-vs-vanilla.csv')
    groups = [('fable', 'lighthouse desktop', 'Fable iter20 \u00b7 Lighthouse desktop', FABLE, None),
              ('qwen', 'lighthouse desktop', 'Qwen iter31 \u00b7 Lighthouse desktop', QWEN, None),
              ('fable', 'slow 4g', 'Fable iter20 \u00b7 Slow 4G (Qwen ran no Slow 4G)', FABLE, '//')]
    metrics = ['cold FCP', 'cold LCP', 'warm FCP', 'warm LCP']
    f = fig(950, 'C. How much each champion cut off its own vanilla baseline',
            'Each track against its own iteration 0 on the same 21-post Nonio feed fixture, seed '
            '4dc103a4. Percent reduction, higher is better. The two Lighthouse groups are '
            'directly comparable to each other; the hatched Slow 4G group is Fable-only, because '
            'the Qwen track ran no throttled harness.')
    ax = f.add_axes([0.055, 0.13, 0.92, 0.545])
    width = 0.2
    for gi, (agent, harness, label, color, hatch) in enumerate(groups):
        vals, absolutes = [], []
        for m in metrics:
            r = next(r for r in rows if r['agent'] == agent and r['harness'] == harness
                     and r['metric'] == m)
            vals.append(float(r['reduction_pct']))
            absolutes.append((float(r['baseline_ms']), float(r['champion_ms'])))
        xs = [i + (gi - 1) * (width + 0.035) for i in range(len(metrics))]
        bars = ax.bar(xs, vals, width, color=color, alpha=0.55 if hatch else 1.0,
                      edgecolor=color, linewidth=1.4, label=label, hatch=hatch)
        for b, v, (a0, a1) in zip(bars, vals, absolutes):
            ax.text(b.get_x() + b.get_width() / 2, v + 1.6, f'\u2212{v:.0f}%', ha='center',
                    fontsize=13.5, fontweight='bold')
            ax.text(b.get_x() + b.get_width() / 2, v - 6.5, f'{a0:.0f}\u2192{a1:.0f}', ha='center',
                    fontsize=10.5, color=BG if not hatch else INK, fontweight='bold')
    ax.set_xticks(range(len(metrics)))
    ax.set_xticklabels(metrics, fontsize=15)
    ax.set_ylabel('reduction vs that track\u2019s own iteration 0 (%)')
    ax.set_ylim(0, 104)
    style(ax)
    f.legend(loc='lower center', bbox_to_anchor=(0.5, 0.70), frameon=False, fontsize=12.5, ncols=3)
    footer(f, 'Bar labels show absolute medians in ms (baseline \u2192 champion). Fable n=5, Qwen '
              'n=3. Fable Slow 4G warm uses the user-felt FCP/LCP pair, not loadEventEnd: at '
              'iteration 20 the warm load event is inflated to 517 ms by zero-byte avatar-CDN '
              'fetches joining the load window once the page renders earlier.')
    f.savefig(path)
    plt.close(f)
    print(path)


def chart_d(path):
    rows = sorted(load('fable-slow4g.csv'), key=lambda r: int(r['iter']))
    f = fig(960, 'D. Fable track on Slow 4G \u2014 the harness the Qwen track never ran',
            'Nonio main feed, 21-post fixture, seed 4dc103a4. Playwright + CDP throttling: '
            '1.6 Mbps down / 750 kbps up / 150 ms RTT. n=5 medians, log scale. Filled marker = '
            'kept, hollow = reverted. The Qwen track measured Lighthouse desktop only, so it has '
            'no line here \u2014 chart F and the recorded videos are the Slow 4G comparison.')
    axes = [f.add_axes([0.055, 0.145, 0.42, 0.62]), f.add_axes([0.555, 0.145, 0.42, 0.62])]
    for ax, lane in zip(axes, ('cold', 'warm')):
        for metric, color, label in (('load', VANILLA, 'loadEventEnd'), ('fcp', FABLE, 'FCP'),
                                     ('lcp', GOOD, 'LCP')):
            pts = [(int(r['iter']), float(r[f'{lane}_{metric}_ms']), r['verdict']) for r in rows]
            ax.plot([p[0] for p in pts], [p[1] for p in pts], color=color, lw=2.1, alpha=0.85,
                    label=label, zorder=2)
            for x, y, verdict in pts:
                kept = verdict.startswith('kept') or verdict == 'baseline'
                ax.scatter([x], [y], s=64, zorder=3, color=color if kept else BG,
                           edgecolors=color, linewidths=1.9)
        style(ax)
        ax.set_yscale('log')
        ax.set_ylim(100, 7000)
        ax.set_yticks([100, 200, 500, 1000, 2000, 5000])
        ax.set_yticklabels(['100', '200', '500', '1000', '2000', '5000'])
        ax.set_title(f'{lane} \u2014 ms, log scale, lower is better', fontsize=16, pad=12,
                     loc='left')
        ax.set_xlabel('iteration')
        ax.set_xlim(-1, 21)
        ax.set_xticks(range(0, 21, 2))
    axes[0].legend(loc='lower left', frameon=False, fontsize=13)
    axes[0].annotate('iter5 gzip\ncold FCP 2184 \u2192 1560', xy=(5, 1560), xytext=(0.2, 500),
                     color=INK, fontsize=11.5,
                     arrowprops=dict(arrowstyle='->', color=DIM, lw=1.3))
    axes[0].annotate('iter9 esbuild bundle\ncold FCP 1376 \u2192 968', xy=(9, 968),
                     xytext=(10.6, 2600), color=INK, fontsize=11.5,
                     arrowprops=dict(arrowstyle='->', color=DIM, lw=1.3))
    axes[1].annotate('iter1 cache headers\nwarm load 4435 \u2192 315', xy=(1, 315), xytext=(2.6, 1100),
                     color=INK, fontsize=11.5,
                     arrowprops=dict(arrowstyle='->', color=DIM, lw=1.3))
    axes[1].annotate('iter17 inline CSS rejected\nwarm load 207 \u2192 583', xy=(17, 583),
                     xytext=(8.2, 2200), color=INK, fontsize=11.5,
                     arrowprops=dict(arrowstyle='->', color=DIM, lw=1.3))
    footer(f, 'Source: speed-lab/results.json @ cursor/speed-lab-nonio-feed. Iteration 18 was '
              'skipped after profiling showed no pre-LCP contention left to remove, so it has no '
              'point. Iteration 20\u2019s warm loadEventEnd spike (517 ms) is zero-byte avatar-CDN '
              'fetches joining the load window; its user-felt warm FCP/LCP are 180/204 ms.')
    f.savefig(path)
    plt.close(f)
    print(path)


def chart_e(path):
    rows = load('keep-deltas.csv')
    f = fig(1040, 'E. The single changes that actually moved the needle',
            'Kept changes only, ranked by the milliseconds one change removed. Colour is the '
            'agent that found it. Left panel is Slow 4G, the Fable harness; right panel is '
            'Lighthouse desktop, the Qwen harness plus Fable\u2019s iterations 12+ where it also '
            'ran Lighthouse. The two panels are different harnesses and are not comparable across.')
    panels = [
        (f.add_axes([0.305, 0.115, 0.165, 0.615]), 'slow4g',
         'Slow 4G \u00b7 1.6 Mbps \u00b7 150 ms RTT \u00b7 n=5'),
        (f.add_axes([0.795, 0.115, 0.165, 0.615]), 'lighthouse',
         'Lighthouse desktop \u00b7 10 Mbps \u00b7 40 ms RTT'),
    ]
    for ax, harness, subtitle in panels:
        sel = sorted((r for r in rows if r['harness'] == harness),
                     key=lambda r: float(r['saved_ms']))
        labels = [f"{r['agent'].upper()} iter{r['iter']} \u00b7 {r['change']}\n"
                  f"{r['metric']} {float(r['before_ms']):.0f} \u2192 {float(r['after_ms']):.0f} ms"
                  for r in sel]
        vals = [float(r['saved_ms']) for r in sel]
        colors = [FABLE if r['agent'] == 'fable' else QWEN for r in sel]
        ys = list(range(len(sel)))
        ax.barh(ys, vals, color=colors, height=0.66)
        ax.set_yticks(ys)
        ax.set_yticklabels(labels, fontsize=10.5, color=INK)
        ax.set_xscale('log')
        ax.set_xlim(1, 9000)
        ax.set_xticks([1, 10, 100, 1000])
        ax.set_xticklabels(['1', '10', '100', '1000'])
        ax.set_xlabel('ms removed by that one change (log scale)')
        ax.set_title(subtitle, fontsize=12.5, pad=12, loc='left')
        ax.grid(axis='x', lw=0.8, alpha=0.55)
        ax.set_axisbelow(True)
        for s in ('top', 'right'):
            ax.spines[s].set_visible(False)
        for y, v in zip(ys, vals):
            ax.text(v * 1.14, y, f'{v:,.0f}', va='center', fontsize=10.5, color=INK)
    f.legend(handles=[Patch(color=FABLE, label='Fable (Cursor cloud, Fable 5)'),
                      Patch(color=QWEN, label='Qwen 3.8 27B (local, OpenCode)')],
             loc='center', bbox_to_anchor=(0.5, 0.795), frameon=False, fontsize=12.5, ncols=2)
    footer(f, 'A change appears once per lane it moved. Fable\u2019s Lighthouse column only starts '
              'at iteration 12, so its early transport and bundling wins have no Lighthouse bar '
              '\u2014 that is a hole in the record, not a claim that they did nothing there.')
    f.savefig(path)
    plt.close(f)
    print(path)


def chart_f(path):
    rows = load('slow4g-head-to-head.csv')
    f = fig(920, 'F. All three variants on Slow 4G, same fixture, same run',
            'One Playwright run per variant against the identical backend, fixture and viewport '
            '(1280x800), n=1, recorded for the videos in this PR. Slow 4G: 1.6 Mbps down / '
            '750 kbps up / 150 ms RTT. This is the only apples-to-apples Slow 4G measurement of '
            'the Qwen build that exists.')
    axes = [f.add_axes([0.055, 0.135, 0.265, 0.60]), f.add_axes([0.385, 0.135, 0.265, 0.60]),
            f.add_axes([0.715, 0.135, 0.26, 0.60])]
    order = ['vanilla', 'fable', 'qwen']
    names = {'vanilla': 'VANILLA', 'fable': 'FABLE', 'qwen': 'QWEN 3.8'}
    colors = {'vanilla': VANILLA, 'fable': FABLE, 'qwen': QWEN}
    get = {(r['variant'], r['lane']): r for r in rows}

    for ax, title in zip(axes, ['cold FCP / LCP (ms)', 'warm FCP / LCP (ms)',
                                'bytes over the wire (KB)']):
        if title.endswith('(ms)'):
            lane = title.split()[0]
            for i, v in enumerate(order):
                r = get[(v, lane)]
                for j, key in enumerate(('fcp_ms', 'lcp_ms')):
                    ax.bar(i + (j - 0.5) * 0.36, float(r[key]), 0.34, color=colors[v],
                           alpha=1.0 if j == 0 else 0.5)
                    ax.text(i + (j - 0.5) * 0.36, float(r[key]) + 70, f'{float(r[key]):.0f}',
                            ha='center', fontsize=12, fontweight='bold')
            ax.set_ylim(0, 5400)
            ax.set_ylabel('ms \u2014 left bar FCP, right bar LCP')
        else:
            for i, v in enumerate(order):
                for j, lane in enumerate(('cold', 'warm')):
                    kb = float(get[(v, lane)]['transfer_bytes']) / 1024
                    ax.bar(i + (j - 0.5) * 0.36, kb, 0.34, color=colors[v],
                           alpha=1.0 if j == 0 else 0.5)
                    ax.text(i + (j - 0.5) * 0.36, kb + 10, f'{kb:.0f}', ha='center', fontsize=12,
                            fontweight='bold')
            ax.set_ylim(0, 790)
            ax.set_ylabel('KB \u2014 left bar cold, right bar warm')
        ax.set_xticks(range(3))
        ax.set_xticklabels([names[v] for v in order], fontsize=14)
        ax.set_title(title, fontsize=16, pad=12, loc='left')
        style(ax)
    footer(f, 'Requests on the cold load: vanilla 108, Fable 40, Qwen 86. Warm bytes: vanilla '
              '690 KB because it sends no cache headers at all, Qwen 8.4 KB for its uncacheable '
              'HTML document, Fable 0.3 KB because the document answers 304. Source: '
              'speed-lab/compare/data/slow4g-head-to-head.csv.')
    f.savefig(path)
    plt.close(f)
    print(path)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    lh_chart('cold', 'A', os.path.join(OUT, 'a-lighthouse-cold.png'))
    lh_chart('warm', 'B', os.path.join(OUT, 'b-lighthouse-warm.png'))
    chart_c(os.path.join(OUT, 'c-reduction-vs-vanilla.png'))
    chart_d(os.path.join(OUT, 'd-fable-slow4g.png'))
    chart_e(os.path.join(OUT, 'e-keep-deltas-ranked.png'))
    chart_f(os.path.join(OUT, 'f-slow4g-head-to-head.png'))
