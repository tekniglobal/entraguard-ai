import Link from "next/link";
import {
  AlertTriangle,
  Globe2,
  Laptop,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { cn, countryFlag, formatDateTime } from "@/lib/utils";
import type { SignInRow, UserRow } from "@/lib/db/types";

export function SignInTable({
  rows,
}: {
  rows: Array<SignInRow & { user: UserRow }>;
}) {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Time</th>
            <th className="px-4 py-2 font-medium">User</th>
            <th className="px-4 py-2 font-medium">Location</th>
            <th className="px-4 py-2 font-medium">Device</th>
            <th className="px-4 py-2 font-medium">Application</th>
            <th className="px-4 py-2 font-medium">MFA</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Risk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                {formatDateTime(row.created_at_event)}
              </td>
              <td className="px-4 py-3 align-top">
                <Link
                  href={`/sign-ins/${row.id}`}
                  className="font-medium hover:text-primary"
                >
                  {row.user.display_name}
                </Link>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {row.user.is_privileged ? (
                    <span className="inline-flex items-center gap-1 rounded bg-orange-500/10 px-1 py-0.5 text-[10px] font-semibold text-orange-300">
                      <ShieldCheck className="h-3 w-3" />
                      {row.user.privileged_role ?? "Privileged"}
                    </span>
                  ) : null}
                  <span>{row.user.upn}</span>
                </div>
              </td>
              <td className="px-4 py-3 align-top text-xs">
                <div className="flex items-center gap-1.5">
                  <span>{countryFlag(row.country)}</span>
                  <span>{row.city ?? row.country ?? "Unknown"}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {row.ip_address}
                  {row.is_tor_or_anon ? (
                    <span className="ml-1 text-red-400">· Tor</span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 align-top text-xs">
                <div className="flex items-center gap-1.5">
                  {row.device_os?.toLowerCase().includes("ios") ||
                  row.device_os?.toLowerCase().includes("android") ? (
                    <Smartphone className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Laptop className="h-3 w-3 text-muted-foreground" />
                  )}
                  {row.device_os ?? "—"}
                </div>
                <div
                  className={cn(
                    "text-[11px]",
                    row.is_managed_device === false
                      ? "text-amber-300"
                      : "text-muted-foreground"
                  )}
                >
                  {row.is_managed_device === false
                    ? "unmanaged"
                    : row.is_managed_device === true
                      ? "managed"
                      : "—"}
                </div>
              </td>
              <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                {row.application_display_name ?? "—"}
                <div className="text-[11px]">{row.client_app ?? "—"}</div>
              </td>
              <td className="px-4 py-3 align-top text-xs">
                <span
                  className={cn(
                    row.mfa_detail === "mfaCompleted" &&
                      "text-emerald-400",
                    row.mfa_detail === "mfaFailed" && "text-red-400",
                    row.mfa_detail === "mfaNotRequired" && "text-amber-300"
                  )}
                >
                  {row.mfa_detail ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                {row.is_interactive ? (
                  <span className="inline-flex items-center gap-1">
                    <Globe2 className="h-3 w-3" />
                    Interactive
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Non-interactive
                  </span>
                )}
              </td>
              <td className="px-4 py-3 align-top">
                <RiskCell level={row.risk_level_aggregated} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No sign-ins yet.
        </div>
      ) : null}
    </div>
  );
}

function RiskCell({ level }: { level: string | null }) {
  const map: Record<string, string> = {
    high: "bg-red-600/15 text-red-300 border-red-700/40",
    medium: "bg-orange-500/15 text-orange-300 border-orange-700/40",
    low: "bg-amber-500/15 text-amber-300 border-amber-700/40",
    none: "bg-emerald-600/15 text-emerald-400 border-emerald-700/40",
  };
  const cls = level ? map[level] ?? map.none : map.none;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
        cls
      )}
    >
      {level ?? "none"}
    </span>
  );
}
