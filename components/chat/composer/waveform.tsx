"use client";

import { cn } from "@/lib/utils";
import { memo, useEffect, useRef } from "react";

const BAR = 3; // px, and the gap between bars
const STEP = 50; // ms between bars: the waveform scrolls left one bar per step
const SENSITIVITY = 4; // a speaking voice's level is ~0.05-0.2 of full scale

/**
 * The microphone's level over the last few seconds as a row of bars that
 * scrolls in from the right, as in ChatGPT's dictation. It only listens to
 * the stream; whoever opened it records and closes it. Without a stream
 * (being transcribed) the last bars stay, pulsing.
 */
export const Waveform = memo(function Waveform({
  stream,
  className,
}: {
  stream: MediaStream | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levels = useRef<number[]>([]); // newest last, 0-1

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stream) return;
    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 512;
    audio.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let frame = 0;
    let last = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < STEP) return;
      last = now;
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);

      const { width, height } = canvas.getBoundingClientRect();
      const fit = Math.floor(width / (BAR * 2));
      levels.current = [...levels.current, Math.min(1, rms * SENSITIVITY)].slice(-fit);

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = getComputedStyle(canvas).color;
      levels.current.forEach((level, i) => {
        const h = Math.max(BAR, level * height);
        const x = width - (levels.current.length - i) * BAR * 2;
        ctx.beginPath();
        ctx.roundRect(x, (height - h) / 2, BAR, h, BAR / 2);
        ctx.fill();
      });
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      void audio.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} aria-hidden className={cn("size-full", !stream && "animate-pulse", className)} />;
});
