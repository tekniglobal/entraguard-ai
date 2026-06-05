import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readFileSync } from "fs";
import { join } from "path";
import { appendAudit } from "@/lib/db/queries";

interface UserFixture {
  upn: string;
  display_name: string;
  job_title: string | null;
  department: string | null;
  is_privileged: boolean;
  privileged_role: string | null;
  usual_country: string | null;
  usual_city: string | null;
  usual_device_os: string | null;
  usual_hours_start: number | null;
  usual_hours_end: number | null;
}

interface SignInFixture {
  case: string;
  graph_id: string;
  upn: string;
  created_at_event: string;
  is_interactive: boolean;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  is_tor_or_anon: boolean;
  client_app: string | null;
  device_os: string | null;
  device_browser: string | null;
  is_compliant_device: boolean | null;
  is_managed_device: boolean | null;
  mfa_detail: string | null;
  conditional_access_status: string | null;
  risk_level_aggregated: string | null;
  risk_state: string | null;
  resource_display_name: string | null;
  application_display_name: string | null;
  status_code: number | null;
  status_failure_reason: string | null;
}

export async function POST() {
  const supabase = createAdminClient();

  // Wipe in FK order
  for (const table of [
    "audit_log",
    "approvals",
    "recommended_actions",
    "investigations",
    "sign_ins",
    "users",
  ]) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 });
    }
  }

  // Re-seed users
  const usersFixture: UserFixture[] = JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "users.json"), "utf-8")
  );
  const { data: insertedUsers, error: userErr } = await supabase
    .from("users")
    .insert(usersFixture)
    .select("*");
  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }
  const upnToId = new Map<string, string>();
  for (const u of insertedUsers ?? []) upnToId.set(u.upn, u.id);

  // Sign-ins
  const signInsFixture: SignInFixture[] = JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "sign_ins.json"), "utf-8")
  );
  const rows = signInsFixture.map((s) => {
    const userId = upnToId.get(s.upn);
    if (!userId) {
      throw new Error(`Unknown upn ${s.upn}`);
    }
    return {
      graph_id: s.graph_id,
      user_id: userId,
      created_at_event: s.created_at_event,
      is_interactive: s.is_interactive,
      ip_address: s.ip_address,
      country: s.country,
      city: s.city,
      is_tor_or_anon: s.is_tor_or_anon,
      client_app: s.client_app,
      device_os: s.device_os,
      device_browser: s.device_browser,
      is_compliant_device: s.is_compliant_device,
      is_managed_device: s.is_managed_device,
      mfa_detail: s.mfa_detail,
      conditional_access_status: s.conditional_access_status,
      risk_level_aggregated: s.risk_level_aggregated,
      risk_state: s.risk_state,
      resource_display_name: s.resource_display_name,
      application_display_name: s.application_display_name,
      status_code: s.status_code,
      status_failure_reason: s.status_failure_reason,
      raw_json: {
        id: s.graph_id,
        createdDateTime: s.created_at_event,
        userId,
        userPrincipalName: s.upn,
        isInteractive: s.is_interactive,
        ipAddress: s.ip_address,
        clientAppUsed: s.client_app,
        conditionalAccessStatus: s.conditional_access_status,
        riskLevelAggregated: s.risk_level_aggregated,
        riskState: s.risk_state,
        resourceDisplayName: s.resource_display_name,
        appDisplayName: s.application_display_name,
        status: {
          errorCode: s.status_code ?? 0,
          failureReason: s.status_failure_reason ?? null,
        },
        deviceDetail: {
          operatingSystem: s.device_os,
          browser: s.device_browser,
          isCompliant: s.is_compliant_device,
          isManaged: s.is_managed_device,
        },
        location: { city: s.city, countryOrRegion: s.country },
        mfaDetail: s.mfa_detail ? { authDetail: s.mfa_detail } : null,
      },
    };
  });
  const { data: insertedSignIns, error: siErr } = await supabase
    .from("sign_ins")
    .insert(rows)
    .select("id, graph_id, country, is_interactive");
  if (siErr) {
    return NextResponse.json({ error: siErr.message }, { status: 500 });
  }

  for (const s of insertedSignIns ?? []) {
    await appendAudit(supabase, {
      actor: "agent:entraguard",
      actor_kind: "agent",
      event_type: "sign_in_ingested",
      subject_kind: "sign_in",
      subject_id: s.id,
      details: {
        graph_id: s.graph_id,
        country: s.country,
        is_interactive: s.is_interactive,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    users: insertedUsers?.length ?? 0,
    sign_ins: insertedSignIns?.length ?? 0,
  });
}
