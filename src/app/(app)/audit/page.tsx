import { createClient } from "@/lib/supabase/server";
import { listAudit } from "@/lib/db/queries";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Cog } from "lucide-react";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const supabase = await createClient();
  const rows = await listAudit(supabase);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="Audit log"
        subtitle={`${rows.length} events · append-only`}
      />
      <div className="flex-1 p-6">
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Actor</th>
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTime(row.created_at)}
                    <div className="text-[10px]">
                      {relativeTime(row.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      {row.actor_kind === "agent" ? (
                        <Badge variant="info" className="gap-1">
                          <Bot className="h-3 w-3" />
                          AGENT
                        </Badge>
                      ) : row.actor_kind === "human" ? (
                        <Badge variant="warning" className="gap-1">
                          <User className="h-3 w-3" />
                          HUMAN
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Cog className="h-3 w-3" />
                          SYSTEM
                        </Badge>
                      )}
                    </span>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {row.actor}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {row.event_type
                      .split("_")
                      .map((w) => w[0].toUpperCase() + w.slice(1))
                      .join(" ")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {row.subject_kind ?? "—"}
                    {row.subject_id ? (
                      <div className="font-mono text-[10px]">
                        {row.subject_id.slice(0, 8)}…
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <details className="text-[11px]">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        view payload
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 text-emerald-300/80">
{JSON.stringify(row.details, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Audit log empty.
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
