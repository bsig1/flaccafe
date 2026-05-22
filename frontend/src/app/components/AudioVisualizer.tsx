import {
  useEffect,
  useRef,
} from "react";

import type {
  NowPlayingVisualizerStyle,
  VisualizerFrame,
} from "../shared";

function cssRgb(name: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function syntheticBins(count: number, time: number, seed: number) {
  return Array.from({ length: count }, (_, index) => {
    const phase = time / 420 + index * 0.37 + seed * 0.11;
    const slow = Math.sin(phase) * 0.28 + 0.42;
    const pulse = Math.sin(time / 1100 + index * 0.13) * 0.18;
    const taper = 1 - Math.abs(index / Math.max(1, count - 1) - 0.5) * 0.35;
    return Math.max(0.08, Math.min(0.86, (slow + pulse) * taper));
  });
}

function syntheticWave(count: number, time: number, seed: number) {
  return Array.from({ length: count }, (_, index) => {
    const x = index / Math.max(1, count - 1);
    return Math.sin(x * Math.PI * 4 + time / 350 + seed) * 0.45 + Math.sin(x * Math.PI * 9 + time / 780) * 0.16;
  });
}

function drawBars(context: CanvasRenderingContext2D, width: number, height: number, bins: number[], level: number) {
  const ember = cssRgb("--color-primary", "214 154 95");
  const moss = cssRgb("--color-moss", "140 166 122");
  const barGap = Math.max(2, width / 180);
  const barWidth = Math.max(3, (width - barGap * (bins.length - 1)) / bins.length);
  const gradient = context.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, `rgba(${moss} / 0.35)`);
  gradient.addColorStop(0.55, `rgba(${ember} / 0.88)`);
  gradient.addColorStop(1, "rgba(255 255 255 / 0.92)");
  context.fillStyle = gradient;

  bins.forEach((value, index) => {
    const eased = Math.pow(Math.max(0, value), 0.72);
    const barHeight = Math.max(4, eased * height * 0.86 + level * height * 0.08);
    const x = index * (barWidth + barGap);
    const y = height - barHeight;
    context.beginPath();
    context.roundRect(x, y, barWidth, barHeight, Math.min(8, barWidth / 2));
    context.fill();
  });
}

function drawWave(context: CanvasRenderingContext2D, width: number, height: number, waveform: number[], level: number) {
  const ember = cssRgb("--color-primary", "214 154 95");
  const moss = cssRgb("--color-moss", "140 166 122");
  const mid = height / 2;
  context.lineWidth = Math.max(2, width / 260);
  context.strokeStyle = `rgba(${moss} / 0.45)`;
  context.beginPath();
  waveform.forEach((value, index) => {
    const x = (index / Math.max(1, waveform.length - 1)) * width;
    const y = mid + value * height * (0.22 + level * 0.12);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();

  context.lineWidth = Math.max(3, width / 190);
  context.strokeStyle = `rgba(${ember} / 0.88)`;
  context.beginPath();
  waveform.forEach((value, index) => {
    const x = (index / Math.max(1, waveform.length - 1)) * width;
    const y = mid + value * height * (0.13 + level * 0.18);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
}

function drawRadial(context: CanvasRenderingContext2D, width: number, height: number, bins: number[], level: number) {
  const ember = cssRgb("--color-primary", "214 154 95");
  const moss = cssRgb("--color-moss", "140 166 122");
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * (0.18 + level * 0.06);
  const maxLength = Math.min(width, height) * 0.31;

  context.strokeStyle = `rgba(${moss} / 0.28)`;
  context.lineWidth = Math.max(1, Math.min(width, height) / 180);
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.stroke();

  bins.forEach((value, index) => {
    const angle = (index / bins.length) * Math.PI * 2 - Math.PI / 2;
    const length = Math.max(6, Math.pow(value, 0.72) * maxLength);
    const inner = radius;
    const outer = radius + length;
    context.strokeStyle = `rgba(${index % 2 ? moss : ember} / ${0.42 + value * 0.5})`;
    context.lineWidth = Math.max(2, Math.min(width, height) / 150);
    context.beginPath();
    context.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    context.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    context.stroke();
  });
}

export function AudioVisualizer({
  active,
  className = "",
  frame,
  seed = 0,
  style,
}: {
  active: boolean;
  className?: string;
  frame: VisualizerFrame | null;
  seed?: number;
  style: NowPlayingVisualizerStyle;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestFrameRef = useRef<VisualizerFrame | null>(frame);

  useEffect(() => {
    latestFrameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || style === "off") {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let canceled = false;
    let width = 0;
    let height = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      width = Math.max(1, Math.floor(rect.width * ratio));
      height = Math.max(1, Math.floor(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const render = (time: number) => {
      if (canceled) {
        return;
      }
      resize();
      const panel = cssRgb("--color-panel", "31 24 21");
      const line = cssRgb("--color-line", "79 68 60");
      context.clearRect(0, 0, width, height);
      context.fillStyle = `rgba(${panel} / 0.42)`;
      context.fillRect(0, 0, width, height);
      context.strokeStyle = `rgba(${line} / 0.42)`;
      context.strokeRect(0.5, 0.5, width - 1, height - 1);

      const liveFrame = latestFrameRef.current?.isLive ? latestFrameRef.current : null;
      const level = active ? Math.max(liveFrame?.level ?? 0.18, 0.08) : 0.04;
      const rawBins = liveFrame?.frequencyBins?.length ? liveFrame.frequencyBins : syntheticBins(48, time, seed);
      const rawWaveform = liveFrame?.waveform?.length ? liveFrame.waveform : syntheticWave(96, time, seed);
      const bins = active ? rawBins : rawBins.map((value) => value * 0.16);
      const waveform = active ? rawWaveform : rawWaveform.map((value) => value * 0.18);

      if (style === "wave") {
        drawWave(context, width, height, waveform, level);
      } else if (style === "radial") {
        drawRadial(context, width, height, bins, level);
      } else {
        drawBars(context, width, height, bins, level);
      }

      window.requestAnimationFrame(render);
    };

    window.requestAnimationFrame(render);
    return () => {
      canceled = true;
      observer.disconnect();
    };
  }, [active, seed, style]);

  if (style === "off") {
    return null;
  }

  return <canvas ref={canvasRef} aria-hidden="true" className={`h-full w-full rounded ${className}`} />;
}
