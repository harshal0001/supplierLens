"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Bars drawn from a live AnalyserNode (the microphone or the spoken answer), mirrored from the centre.
 * Without an analyser it shows a flat line, or a slow travelling wave while `busy`. Bar colour = CSS `color`.
 */
export function Waveform({
  analyser,
  busy = false,
  bars: BARS = 36,
  className,
}: {
  analyser: AnalyserNode | null;
  busy?: boolean;
  bars?: number;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const levels = new Float32Array(BARS);
    const color = getComputedStyle(el).color;
    let frame = 0;
    let last = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (reduce && now - last < 250) return; // reduced motion: a few calm updates per second
      last = now;
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      if (analyser && bins) analyser.getByteFrequencyData(bins);
      const gap = 3;
      const bw = Math.max(2, (w - gap * (BARS - 1)) / BARS);
      for (let i = 0; i < BARS; i++) {
        const edge = Math.abs(i - (BARS - 1) / 2) / (BARS / 2); // 0 = centre, 1 = edge
        let target = 0;
        if (bins) {
          // Speech energy sits in the low bins: low frequencies in the centre, higher ones towards the edges.
          target = Math.min(1, (bins[Math.floor(1 + edge * bins.length * 0.4)] / 255) * 1.25);
        } else if (busy) {
          target = reduce ? 0.18 : 0.22 + 0.16 * Math.sin(now / 240 - i * 0.45);
        }
        levels[i] += (target - levels[i]) * (reduce ? 1 : 0.3);
        const bh = Math.max(3, levels[i] * h);
        ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, levels[i] * 1.6);
        ctx.beginPath();
        ctx.roundRect(i * (bw + gap), (h - bh) / 2, bw, bh, bw / 2);
        ctx.fill();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser, busy, BARS]);

  return <canvas ref={canvas} aria-hidden className={cn("block h-16 w-full", className)} />;
}
