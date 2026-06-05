"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const SIZE = 180;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUM = Math.PI * RADIUS; // half-circle arc length

function scoreColor(score: number): string {
  if (score >= 81) return "rgb(248,113,113)"; // red-400
  if (score >= 51) return "rgb(251,146,60)"; // orange-400
  if (score >= 21) return "rgb(251,191,36)"; // amber-400
  return "rgb(74,222,128)"; // green-400
}

export function RiskGauge({
  score,
  loading,
  className,
}: {
  score: number | null | undefined;
  loading?: boolean;
  className?: string;
}) {
  const target = typeof score === "number" ? Math.max(0, Math.min(100, score)) : 0;
  const value = useMotionValue(0);
  const animated = useSpring(value, { stiffness: 70, damping: 14 });
  const dash = useTransform(animated, (v) =>
    ((100 - v) / 100 * CIRCUM).toFixed(2)
  );
  const display = useTransform(animated, (v) => Math.round(v).toString());

  useEffect(() => {
    if (typeof score === "number") {
      value.set(target);
    }
  }, [score, target, value]);

  const color = scoreColor(target);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center",
        className
      )}
      style={{ width: SIZE, height: SIZE / 2 + 24 }}
    >
      <svg width={SIZE} height={SIZE / 2 + 10} viewBox={`0 0 ${SIZE} ${SIZE / 2 + 10}`}>
        <path
          d={`M ${STROKE / 2} ${SIZE / 2} A ${RADIUS} ${RADIUS} 0 0 1 ${
            SIZE - STROKE / 2
          } ${SIZE / 2}`}
          fill="none"
          stroke="rgb(51,65,85)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <motion.path
          d={`M ${STROKE / 2} ${SIZE / 2} A ${RADIUS} ${RADIUS} 0 0 1 ${
            SIZE - STROKE / 2
          } ${SIZE / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUM.toString()}
          strokeDashoffset={dash as unknown as string}
        />
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <motion.span
          className="font-mono text-5xl font-bold tabular-nums"
          style={{ color }}
        >
          {loading && score === null ? "··" : <motion.span>{display}</motion.span>}
        </motion.span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Risk score
        </span>
      </div>
    </div>
  );
}
