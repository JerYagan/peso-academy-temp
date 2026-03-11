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
  let primaryOwnerId = "";
  let resolvedFromProfileLookup = false;

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
      resolvedFromProfileLookup = true;
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

      const matchingProfileIds = (matchingProfiles || []).map((profile) => profile?.id).filter(Boolean) as string[];

      for (const profileId of matchingProfileIds) {
        ownerIds.add(profileId);
      }

      if (
        matchingProfileIds.length > 0 &&
        (!resolvedFromProfileLookup || !matchingProfileIds.includes(primaryOwnerId))
      ) {
        primaryOwnerId = matchingProfileIds[0];
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