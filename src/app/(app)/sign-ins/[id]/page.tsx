import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSignIn, getInvestigationBySignIn } from "@/lib/db/queries";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  countryFlag,
  formatDateTime,
} from "@/lib/utils";
import { Sparkles, ShieldCheck } from "lucide-react";
import { InvestigateButton } from "./investigate-button";

export const dynamic = "force-dynamic";

export default async function SignInDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const signIn = await getSignIn(supabase, id);
  if (!signIn) notFound();
  const existing = await getInvestigationBySignIn(supabase, id);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title={`Sign-in · ${signIn.user.display_name}`}
        subtitle={`${signIn.application_display_name ?? "—"} · ${formatDateTime(signIn.created_at_event)}`}
      />
      <div className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {signIn.user.is_privileged ? (
              <Badge variant="warning" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                {signIn.user.privileged_role}
              </Badge>
            ) : null}
            <Badge variant={signIn.is_interactive ? "info" : "secondary"}>
              {signIn.is_interactive ? "Interactive" : "Non-interactive"}
            </Badge>
            {signIn.is_tor_or_anon ? (
              <Badge variant="danger">Anonymized IP</Badge>
            ) : null}
            {signIn.is_managed_device === false ? (
              <Badge variant="warning">Unmanaged device</Badge>
            ) : null}
          </div>
          {existing ? (
            <Link href={`/investigations/${existing.id}`}>
              <Button variant="default" className="gap-2">
                <Sparkles className="h-4 w-4" />
                View existing investigation
              </Button>
            </Link>
          ) : (
            <InvestigateButton signInId={signIn.id} />
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Decoded view</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="User" value={signIn.user.display_name} />
              <Field label="UPN" value={signIn.user.upn} />
              <Field
                label="Role"
                value={signIn.user.privileged_role ?? signIn.user.job_title ?? "—"}
              />
              <Field
                label="Department"
                value={signIn.user.department ?? "—"}
              />
              <Field
                label="When"
                value={formatDateTime(signIn.created_at_event)}
              />
              <Field
                label="Country / city"
                value={`${countryFlag(signIn.country)} ${signIn.city ?? signIn.country ?? "—"}`}
              />
              <Field label="IP" value={signIn.ip_address ?? "—"} />
              <Field
                label="Tor / anonymizer"
                value={signIn.is_tor_or_anon ? "Yes" : "No"}
              />
              <Field label="Client app" value={signIn.client_app ?? "—"} />
              <Field
                label="Application"
                value={signIn.application_display_name ?? "—"}
              />
              <Field
                label="Device"
                value={`${signIn.device_os ?? "—"} ${
                  signIn.device_browser ? "· " + signIn.device_browser : ""
                }`}
              />
              <Field
                label="Managed"
                value={
                  signIn.is_managed_device === null
                    ? "—"
                    : signIn.is_managed_device
                      ? "Yes"
                      : "No"
                }
              />
              <Field label="MFA" value={signIn.mfa_detail ?? "—"} />
              <Field
                label="Conditional access"
                value={signIn.conditional_access_status ?? "—"}
              />
              <Field
                label="Risk (Entra)"
                value={signIn.risk_level_aggregated ?? "—"}
              />
              <Field
                label="Status"
                value={
                  signIn.status_code === 0
                    ? "Success"
                    : `${signIn.status_code} · ${signIn.status_failure_reason ?? "—"}`
                }
              />
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-sm font-semibold">Raw Microsoft Graph response</h3>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                signIns/{signIn.graph_id.slice(0, 8)}…
              </span>
            </div>
            <pre className="scrollbar-thin max-h-[520px] overflow-auto whitespace-pre p-4 text-[11px] leading-relaxed text-emerald-300/90">
{JSON.stringify(signIn.raw_json, null, 2)}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right text-foreground">{value}</dd>
    </>
  );
}
