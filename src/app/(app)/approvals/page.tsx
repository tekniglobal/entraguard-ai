import { createClient } from "@/lib/supabase/server";
import { listPendingApprovals } from "@/lib/db/queries";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { TeamsAdaptiveCard } from "@/components/teams-adaptive-card";
import { Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const pending = await listPendingApprovals(supabase);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="Approvals"
        subtitle={`${pending.length} pending in your queue`}
      />
      <div className="flex-1 p-6">
        {pending.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-sm text-muted-foreground">
            <Inbox className="h-10 w-10 text-muted-foreground/40" />
            <span>Inbox zero. Nice.</span>
          </Card>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-4">
            {pending.map((a, idx) => (
              <TeamsAdaptiveCard
                key={a.id}
                action={{ ...a.action, approval: a as any }}
                signIn={a.action.investigation.sign_in}
                user={a.action.investigation.sign_in.user}
                index={idx}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
