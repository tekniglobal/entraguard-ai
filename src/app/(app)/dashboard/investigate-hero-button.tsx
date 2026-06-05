"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function InvestigateHeroButton({ signInId }: { signInId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function go() {
    setPending(true);
    try {
      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signInId, mode: "create" }),
      });
      if (!res.ok) throw new Error(`Investigation failed: ${res.status}`);
      const data = (await res.json()) as { investigationId: string };
      router.push(`/investigations/${data.investigationId}`);
    } catch (err) {
      toast.error((err as Error).message);
      setPending(false);
    }
  }

  return (
    <Button onClick={go} disabled={pending} size="lg" className="gap-2">
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {pending ? "Starting agent…" : "Investigate with EntraGuard AI"}
    </Button>
  );
}
