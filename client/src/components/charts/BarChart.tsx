'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/*
 * Animated bar charts (SVG + Framer Motion), used by the school dashboard and the admin dashboard.
 *   <LineChart>  smooth lines over time with a soft fill under each line (several series)
 *   <BarChart>   vertical bars over time, optionally stacked (several series)
 *   <HBarChart>  horizontal ranked bars (top stories, top schools, classes)
 */

export interface Series { key: string; label: string; color: string }

// round step for 4 grid lines (60 → 0·60·120·180·240)
const niceStep = (max: number) => {
  const raw = Math.max(max, 1) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((v) => v >= raw) ?? raw);
};
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(Math.round(n)));
const dayLabel = (d: string) => { const dt = new Date(`${d}T12:00:00`); return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }); };

// Smooth curve through the points (monotone, so it never dips below 0 or overshoots a peak)
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  const n = pts.length, dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

export function LineChart({ data, series, xKey = 'day', height = 260, format = short, labelX = dayLabel }: {
  data: Record<string, number | string>[];
  series: Series[];
  xKey?: string;
  height?: number;
  format?: (n: number) => string;
  labelX?: (x: string) => string;
}) {
  const uid = useId().replace(/[^a-z0-9]/gi, '');
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = () => setW(Math.max(280, Math.round(el.clientWidth)));
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? Math.round(height * 0.8) : height, padL = 40, padR = 14, padB = 30, padT = 14;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const step = niceStep(max);
  const top = step * 4;
  const innerW = W - padL - padR, innerH = H - padB - padT;
  const xAt = (i: number) => padL + (data.length < 2 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - (v / top) * innerH;
  const ticks = [0, 1, 2, 3, 4].map((t) => t * step);
  const every = Math.ceil(data.length / Math.max(3, Math.floor(innerW / 70)));
  const base = padT + innerH;
  const totals = data.map((d) => series.reduce((n, s) => n + (Number(d[s.key]) || 0), 0));

  // nearest day to the pointer
  const pick = (clientX: number) => {
    const el = box.current;
    if (!el || !data.length) return;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    const i = data.length < 2 ? 0 : Math.round(((x - padL) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="chart">
      {series.length > 1 && (
        <div className="chart-legend">{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>
      )}
      <div className="chart-box" ref={box} onMouseMove={(e) => pick(e.clientX)} onMouseLeave={() => setHover(null)} onTouchStart={(e) => pick(e.touches[0].clientX)} onTouchMove={(e) => pick(e.touches[0].clientX)}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Line chart">
          <defs>
            {series.map((s, si) => (
              <linearGradient key={s.key} id={`lc${uid}${si}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={series.length > 2 ? 0.16 : 0.3} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => {
            const y = yAt(t);
            return <g key={t}><line x1={padL} x2={W - 6} y1={y} y2={y} className="grid" /><text x={padL - 8} y={y + 4} className="tick" textAnchor="end">{format(t)}</text></g>;
          })}
          {data.map((d, i) => i % every === 0 && <text key={i} x={xAt(i)} y={H - 12} className="tick" textAnchor={i === 0 && data.length > 1 ? 'start' : i === data.length - 1 && data.length > 1 ? 'end' : 'middle'}>{labelX(String(d[xKey]))}</text>)}
          {hover !== null && <line className="lc-guide" x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={base} />}
          {series.map((s, si) => {
            const pts = data.map((d, i) => [xAt(i), yAt(Number(d[s.key]) || 0)] as [number, number]);
            const line = smoothPath(pts);
            if (!line) return null;
            const area = `${line} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z`;
            return (
              <g key={s.key} className="lc-series" style={{ animationDelay: `${si * 120}ms` }}>
                <path d={area} fill={`url(#lc${uid}${si})`} className="lc-area" style={{ animationDelay: `${300 + si * 120}ms` }} />
                <path d={line} fill="none" stroke={s.color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="lc-line" style={{ animationDelay: `${si * 120}ms` }} />
                {hover !== null && <circle cx={pts[hover][0]} cy={pts[hover][1]} r={5} fill={s.color} className="lc-dot" />}
              </g>
            );
          })}
        </svg>
        {hover !== null && data[hover] && (
          <div className="chart-tip" style={{ left: `${(xAt(hover) / W) * 100}%` }}>
            <b>{labelX(String(data[hover][xKey]))}</b>
            {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}: {format(Number(data[hover][s.key]) || 0)}</span>)}
            {series.length > 1 && <span className="tot">Total: {format(totals[hover])}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function BarChart({ data, series, xKey = 'day', height = 260, format = short, labelX = dayLabel }: {
  data: Record<string, number | string>[];
  series: Series[];
  xKey?: string;
  height?: number;
  format?: (n: number) => string;
  labelX?: (x: string) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real width (1 unit = 1 pixel), so labels stay readable on phones
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = () => setW(Math.max(280, Math.round(el.clientWidth)));
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? Math.round(height * 0.8) : height, padL = 40, padB = 30, padT = 14;
  const totals = data.map((d) => series.reduce((n, s) => n + (Number(d[s.key]) || 0), 0));
  const step = niceStep(Math.max(1, ...totals));
  const top = step * 4;
  const innerW = W - padL - 10, innerH = H - padB - padT;
  const slot = innerW / Math.max(1, data.length);
  const bw = Math.max(4, Math.min(34, slot * 0.62));
  const ticks = [0, 1, 2, 3, 4].map((t) => t * step);
  const every = Math.ceil(data.length / Math.max(3, Math.floor(innerW / 70)));

  return (
    <div className="chart">
      {series.length > 1 && (
        <div className="chart-legend">{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>
      )}
      <div className="chart-box" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Bar chart">
          {ticks.map((t) => {
            const y = padT + innerH - (t / top) * innerH;
            return <g key={t}><line x1={padL} x2={W - 6} y1={y} y2={y} className="grid" /><text x={padL - 8} y={y + 4} className="tick" textAnchor="end">{format(t)}</text></g>;
          })}
          {data.map((d, i) => {
            const x = padL + i * slot + (slot - bw) / 2;
            let acc = 0;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}>
                <rect x={padL + i * slot} y={padT} width={slot} height={innerH} fill="transparent" />
                {series.map((s, si) => {
                  const v = Number(d[s.key]) || 0;
                  const h = (v / top) * innerH;
                  const y = padT + innerH - acc - h;
                  acc += h;
                  return (
                    // final size + place as SVG attributes; the grow-in is a CSS animation (globals.css .chart-box .cbar)
                    <rect
                      key={s.key}
                      x={x} y={y} width={bw} height={Math.max(0, h)} rx={si === series.length - 1 ? 4 : 0}
                      fill={s.color}
                      className={hover === i ? 'cbar on' : 'cbar'}
                      style={{ animationDelay: `${i * 30}ms` }}
                    />
                  );
                })}
                {i % every === 0 && <text x={x + bw / 2} y={H - 12} className="tick" textAnchor="middle">{labelX(String(d[xKey]))}</text>}
              </g>
            );
          })}
        </svg>
        {hover !== null && data[hover] && (
          <div className="chart-tip" style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%` }}>
            <b>{labelX(String(data[hover][xKey]))}</b>
            {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}: {format(Number(data[hover][s.key]) || 0)}</span>)}
            {series.length > 1 && <span className="tot">Total: {format(totals[hover])}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function HBarChart({ rows, format = short, color = 'var(--chart-1)' }: {
  rows: { label: string; value: number; sub?: string }[];
  format?: (n: number) => string;
  color?: string;
}) {
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.value)), [rows]);
  if (!rows.length) return <div className="chart-empty">Nothing here yet.</div>;
  return (
    <ol className="hbars">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`}>
          <span className="hb-label" title={r.label}><b>{i + 1}</b>{r.label}{r.sub && <small>{r.sub}</small>}</span>
          <span className="hb-track">
            <motion.i style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 18, delay: i * 0.06 }} />
          </span>
          <span className="hb-val">{format(r.value)}</span>
        </li>
      ))}
    </ol>
  );
}
