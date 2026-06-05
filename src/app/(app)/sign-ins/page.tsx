import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { SignInTable } from "@/components/sign-in-table";
import { listSignIns } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function SignInsPage() {
  const supabase = await createClient();
  const rows = await listSignIns(supabase);
  const interactive = rows.filter((r) => r.is_interactive).length;
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="Sign-ins"
        subtitle={`${rows.length} events · ${interactive} interactive`}
      />
      <div className="flex-1 p-6">
        <SignInTable rows={rows} />
      </div>
    </div>
  );
}
