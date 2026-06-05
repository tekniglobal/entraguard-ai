"use client";

import { useEffect, useState } from "react";
import { ReasoningStream } from "@/components/reasoning-stream";

// Reveals already-persisted markdown text gradually so the demo feels
// streamed, even though the AI call completed server-side. Skips the
// animation on revisit (when localStorage flags it as seen).
export function TypewriterReasoning({
  text,
  investigationId,
  speedCharsPerTick = 6,
  intervalMs = 12,
}: {
  text: string;
  investigationId: string;
  speedCharsPerTick?: number;
  intervalMs?: number;
}) {
  const [shown, setShown] = useState<string>(() => {
    if (typeof window === "undefined") return text;
    const key = `eg-seen-${investigationId}`;
    if (window.localStorage.getItem(key) === "1") return text;
    return "";
  });
  const [done, setDone] = useState(shown === text);

  useEffect(() => {
    if (done) return;
    const key = `eg-seen-${investigationId}`;
    if (typeof window !== "undefined") {
      if (window.localStorage.getItem(key) === "1") {
        setShown(text);
        setDone(true);
        return;
      }
    }
    let i = shown.length;
    const id = setInterval(() => {
      i = Math.min(text.length, i + speedCharsPerTick);
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, "1");
        }
      }
    }, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, investigationId]);

  return <ReasoningStream text={shown} streaming={!done} />;
}
