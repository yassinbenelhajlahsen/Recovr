import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const displayName = dbUser?.name || user.email;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Welcome back{displayName ? `, ${displayName}` : ""}
      </h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Your workouts and recovery data will appear here.
      </p>
    </div>
  );
}
