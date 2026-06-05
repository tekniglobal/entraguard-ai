"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export function ReasoningStream({
  text,
  streaming,
  className,
}: {
  text: string;
  streaming?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("prose-stream", className)}>
      <ReactMarkdown>{text || ""}</ReactMarkdown>
      {streaming ? (
        <span className="inline-block h-4 w-[2px] translate-y-0.5 animate-blink bg-primary" />
      ) : null}
    </div>
  );
}
