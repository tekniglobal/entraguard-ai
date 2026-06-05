import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listInvestigations } from "@/lib/db/queries";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import {
  countryFlag,
  formatDateTime,
  relativeTime,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvestigationsPage() {
  const supabase = await createClient();
  const investigations = await listInvestigations(supabase);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="Investigations"
        subtitle={`${investigations.length} cases analyzed`}
      />
      <div className="flex-1 p-6">
        {investigations.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            No investigations yet. Trigger one from the{" "}
            <Link href="/dashboard" className="text-primary hover:underline">
              dashboard
            </Link>
            .
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {investigations.map((inv) => (
              <Link key={inv.id} href={`/investigations/${inv.id}`}>
                <Card className="group h-full p-5 transition-colors hover:border-primary/40">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                        {inv.summary}
                      </h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {inv.sign_in.user.display_name} ·{" "}
                        {relativeTime(inv.created_at)}
                      </p>
                    </div>
                    <RiskBadge score={inv.risk_score} verdict={inv.verdict} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {countryFlag(inv.sign_in.country)}{" "}
                      {inv.sign_in.city ?? inv.sign_in.country}
                    </span>
                    <span>·</span>
                    <span>{inv.sign_in.device_os ?? "—"}</span>
                    <span>·</span>
                    <span>{formatDateTime(inv.sign_in.created_at_event)}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <Badge variant="secondary">{inv.model}</Badge>
                    <span className="inline-flex items-center text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
