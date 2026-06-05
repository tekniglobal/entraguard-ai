import type { SignInRow, UserRow } from "@/lib/db/types";

export interface UserBaseline {
  upn: string;
  display_name: string;
  is_privileged: boolean;
  privileged_role: string | null;
  typical_country: string | null;
  typical_city: string | null;
  typical_device_os: string | null;
  typical_hours_local: string;
  sign_ins_observed_last_30d: number;
  countries_last_30d: string[];
  cities_last_30d: string[];
  mfa_completion_rate: number;
}

export function buildBaseline(
  user: UserRow,
  history: SignInRow[]
): UserBaseline {
  const countries = Array.from(
    new Set(history.map((s) => s.country).filter((c): c is string => !!c))
  );
  const cities = Array.from(
    new Set(history.map((s) => s.city).filter((c): c is string => !!c))
  );
  const interactive = history.filter((s) => s.is_interactive);
  const mfaCompletionRate =
    interactive.length === 0
      ? 0
      : interactive.filter((s) => s.mfa_detail === "mfaCompleted").length /
        interactive.length;

  return {
    upn: user.upn,
    display_name: user.display_name,
    is_privileged: user.is_privileged,
    privileged_role: user.privileged_role,
    typical_country: user.usual_country,
    typical_city: user.usual_city,
    typical_device_os: user.usual_device_os,
    typical_hours_local: `${pad(user.usual_hours_start)}:00-${pad(
      user.usual_hours_end
    )}:00`,
    sign_ins_observed_last_30d: history.length,
    countries_last_30d: countries,
    cities_last_30d: cities,
    mfa_completion_rate: Number(mfaCompletionRate.toFixed(2)),
  };
}

function pad(n: number | null): string {
  if (n === null || n === undefined) return "--";
  return n.toString().padStart(2, "0");
}
