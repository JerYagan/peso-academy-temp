import { supabase } from "@/lib/supabase";

type TrainerIdentity = {
  id: string;
  email?: string | null;
};

export type TrainerOwnershipResolution = {
  ownerIds: string[];
  primaryOwnerId: string;
};

export async function resolveTrainerOwnership(user: TrainerIdentity | null | undefined): Promise<TrainerOwnershipResolution> {
  if (!user?.id) {
    return {
      ownerIds: [],
      primaryOwnerId: "",
    };
  }

  const ownerIds = new Set<string>([user.id]);
  let primaryOwnerId = user.id;

  if (!supabase) {
    return {
      ownerIds: Array.from(ownerIds),
      primaryOwnerId,
    };
  }

  try {
    const { data: resolvedProfileId } = await supabase.rpc("get_current_user_profile_id");

    if (typeof resolvedProfileId === "string" && resolvedProfileId.length > 0) {
      ownerIds.add(resolvedProfileId);
      primaryOwnerId = resolvedProfileId;
    }
  } catch {
    // Ignore and continue with the ids we already have.
  }

  if (user.email) {
    try {
      const { data: matchingProfiles } = await supabase
        .from("users")
        .select("id")
        .ilike("email", user.email)
        .order("created_at", { ascending: true });

      for (const profile of matchingProfiles || []) {
        if (profile?.id) {
          ownerIds.add(profile.id);
          if (!primaryOwnerId) {
            primaryOwnerId = profile.id;
          }
        }
      }
    } catch {
      // Ignore and continue with the ids we already have.
    }
  }

  return {
    ownerIds: Array.from(ownerIds),
    primaryOwnerId,
  };
}