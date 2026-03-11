import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchWithAuth } from "@/lib/fetch";
import type { UserProfile } from "@/types/user";

export function useProfileSave(
  user: UserProfile,
  onClose: () => void,
) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user.name ?? "");
  }, [user]);

  const isAccountDirty = name !== (user.name ?? "");

  async function handleSaveProfile() {
    setSaving(true);
    const trimmedName = name.trim() || null;
    const supabase = createClient();
    const [res] = await Promise.all([
      fetchWithAuth("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          height_inches: user.height_inches,
          weight_lbs: user.weight_lbs,
          fitness_goals: user.fitness_goals ?? [],
        }),
      }),
      supabase.auth.updateUser({
        data: { full_name: trimmedName },
      }),
    ]);
    setSaving(false);
    if (!res.ok) return;
    onClose();
    router.refresh();
  }

  return { name, setName, saving, isAccountDirty, handleSaveProfile };
}
