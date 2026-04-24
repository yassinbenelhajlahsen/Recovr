import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fetchWithAuth } from "@/lib/fetch";
import { optimisticMutate } from "@/lib/optimistic";
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

    const optimisticProfile: UserProfile = { ...user, name: trimmedName };

    try {
      await Promise.all([
        optimisticMutate<UserProfile, UserProfile>({
          key: "/api/user/profile",
          optimisticData: optimisticProfile,
          request: async () => {
            const res = await fetchWithAuth("/api/user/profile", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: trimmedName,
                height_inches: user.height_inches,
                weight_lbs: user.weight_lbs,
                fitness_goals: user.fitness_goals ?? [],
              }),
            });
            if (!res.ok) throw new Error();
            return res.json();
          },
        }),
        supabase.auth.updateUser({ data: { full_name: trimmedName } }),
      ]);

      toast.success("Profile updated");
      onClose();
      // router.refresh() kept — the navbar server component reads user.name.
      router.refresh();
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return { name, setName, saving, isAccountDirty, handleSaveProfile };
}
