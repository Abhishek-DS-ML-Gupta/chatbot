import type { UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";

export type CloudConversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export async function getConversations() {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createConversation() {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Sign in to start a chat.");
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: authData.user.id })
    .select("id, title, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function loadConversationMessages(conversationId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const message = row.content as unknown as UIMessage;
    return message && typeof message.id === "string" && Array.isArray(message.parts) ? [message] : [];
  });
}

export async function deleteConversation(conversationId: string) {
  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  if (error) throw error;
}

export async function uploadChatFile(filePart: UIMessage["parts"][number], file: File, userId: string, conversationId: string) {
  if (filePart.type !== "file") return filePart;
  const path = `${userId}/${conversationId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("mortagi-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw error;
  return { ...filePart, providerMetadata: { mortagi: { storagePath: path } } };
}