"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, countryFlag, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  ActionType,
  RecommendedActionRow,
  SignInRow,
  Severity,
  UserRow,
  ApprovalRow,
} from "@/lib/db/types";

const ACTION_LABEL: Record<ActionType, string> = {
  force_password_reset: "Force password reset",
  require_mfa: "Require MFA on next sign-in",
  disable_account: "Disable account",
  revoke_sessions: "Revoke all active sessions",
  review_privileged_activity: "Review privileged activity",
  notify_user: "Notify user via email",
  no_action: "No action required",
};

const SEVERITY_STYLE: Record<Severity, string> = {
  critical:
    "bg-red-600/15 text-red-300 border border-red-700/40 ring-1 ring-red-700/20",
  high: "bg-orange-500/15 text-orange-300 border border-orange-700/40",
  medium: "bg-amber-500/15 text-amber-300 border border-amber-700/40",
  low: "bg-slate-500/15 text-slate-300 border border-slate-700/40",
};

type ActionRow = RecommendedActionRow & {
  approval: ApprovalRow | null;
};

export function TeamsAdaptiveCard({
  action,
  signIn,
  user,
  index,
}: {
  action: ActionRow;
  signIn: SignInRow;
  user: UserRow;
  index: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<{
    status: "idle" | "deciding" | "executed" | "rejected" | "error";
    note?: string;
  }>(() => {
    if (action.approval?.status === "executed") {
      return { status: "executed", note: "Approved and executed" };
    }
    if (action.approval?.status === "rejected") {
      return { status: "rejected", note: action.approval.decision_reason ?? undefined };
    }
    return { status: "idle" };
  });

  async function decide(decision: "approve" | "reject") {
    if (!action.approval) return;
    setState({ status: "deciding" });
    try {
      const res = await fetch(`/api/approvals/${action.approval.id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error(`Decision failed: ${res.status}`);
      if (decision === "approve") {
        setState({ status: "executed", note: "Executed via simulated Graph call" });
      } else {
        setState({ status: "rejected", note: "Marked as rejected" });
      }
      router.refresh();
    } catch (err) {
      setState({ status: "error", note: (err as Error).message });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.25 }}
      className="overflow-hidden rounded-lg border border-[#e1e1e1]/15 bg-white text-[#252423] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
    >
      {/* Teams chrome */}
      <div className="flex items-center gap-2 border-b border-[#edebe9] bg-[#f5f5f5] px-3 py-2 text-[11px] text-[#605e5c]">
        <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#6264a7] text-[9px] font-bold text-white">
          T
        </div>
        <span className="font-semibold text-[#252423]">EntraGuard AI</span>
        <span className="text-[#605e5c]">via Microsoft Teams · just now</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#605e5c]">
          Approval required
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-semibold leading-snug">
            {ACTION_LABEL[action.action_type]}
          </h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              SEVERITY_STYLE[action.severity]
            )}
          >
            {action.severity}
          </span>
        </div>

        <p className="text-[13px] leading-relaxed text-[#444]">
          {action.rationale}
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-[#fafafa] p-3 text-[12px]">
          <Fact label="User" value={user.display_name} />
          <Fact label="Role" value={user.privileged_role ?? user.job_title ?? "—"} />
          <Fact
            label="Sign-in"
            value={formatDateTime(signIn.created_at_event)}
          />
          <Fact
            label="Location"
            value={`${countryFlag(signIn.country)} ${signIn.city ?? signIn.country ?? "—"}`}
          />
          <Fact
            label="Device"
            value={`${signIn.device_os ?? "—"}${signIn.is_managed_device === false ? " · unmanaged" : ""}`}
          />
          <Fact label="MFA" value={signIn.mfa_detail ?? "—"} />
        </div>

        {/* Action area */}
        {state.status === "idle" ? (
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#d1d1d1] bg-white text-[#252423] hover:bg-[#f3f2f1]"
              onClick={() => decide("reject")}
            >
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              variant="teams"
              className="bg-[#6264a7] hover:bg-[#464775]"
              onClick={() => decide("approve")}
            >
              Approve
            </Button>
          </div>
        ) : state.status === "deciding" ? (
          <DecisionBanner
            icon={<Loader2 className="h-4 w-4 animate-spin text-[#6264a7]" />}
            tone="info"
          >
            Executing simulated Microsoft Graph call…
          </DecisionBanner>
        ) : state.status === "executed" ? (
          <DecisionBanner
            icon={<Check className="h-4 w-4 text-emerald-600" />}
            tone="ok"
          >
            Approved by you · executed at {formatDateTime(new Date())}.{" "}
            <Link
              href="/audit"
              className="font-semibold text-[#6264a7] hover:underline"
            >
              View audit entry →
            </Link>
          </DecisionBanner>
        ) : state.status === "rejected" ? (
          <DecisionBanner
            icon={<X className="h-4 w-4 text-red-600" />}
            tone="reject"
          >
            Rejected · no action taken.
          </DecisionBanner>
        ) : (
          <DecisionBanner
            icon={<X className="h-4 w-4 text-red-600" />}
            tone="reject"
          >
            {state.note ?? "Error"}
          </DecisionBanner>
        )}
      </div>
    </motion.div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-[#605e5c]">
        {label}
      </span>
      <span className="font-medium text-[#252423]">{value}</span>
    </div>
  );
}

function DecisionBanner({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: "info" | "ok" | "reject";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-[12px]",
        tone === "ok" && "border-emerald-300 bg-emerald-50 text-emerald-900",
        tone === "info" && "border-blue-200 bg-blue-50 text-blue-900",
        tone === "reject" && "border-red-200 bg-red-50 text-red-900"
      )}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}
