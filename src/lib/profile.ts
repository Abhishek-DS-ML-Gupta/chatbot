import { supabase } from "@/integrations/supabase/client";

export type MortagiProfile = { display_name: string; avatar_url: string | null };

export async function loadProfile(userId: string, email?: string) {
  const { data, error } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const display_name = email?.split("@")[0] ?? "";
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name }, { onConflict: "id" })
    .select("display_name, avatar_url")
    .single();
  if (insertError) throw insertError;
  return created;
}