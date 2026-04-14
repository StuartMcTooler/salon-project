import { supabase } from "@/integrations/supabase/client";
import { normalizePhoneNumber } from "./utils";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;

interface FindOrCreateClientParams {
  phone: string;
  email?: string | null;
  name: string;
  creativeId: string;
}

interface ClientWithHistory extends Client {
  appointments: Tables<"salon_appointments">[];
  visualHistory: Array<{
    id: string;
    content: Tables<"client_content">;
    private_notes: string | null;
    added_at: string;
  }>;
  loyaltyPoints: Tables<"customer_loyalty_points"> | null;
}

/**
 * Find existing client by normalized phone number or create a new client record.
 * This ensures we have a permanent client_id to link all data to.
 */
export async function findOrCreateClient({
  phone,
  email,
  name,
  creativeId,
}: FindOrCreateClientParams): Promise<Client> {
  // Normalize the phone number to prevent duplicates
  const normalizedPhone = normalizePhoneNumber(phone);
  
  // Try to find existing client
  const { data: existingClients, error: findError } = await supabase
    .from("clients")
    .select("*")
    .eq("phone", normalizedPhone)
    .order("last_visit_date", { ascending: false })
    .limit(1);

  if (findError) {
    throw findError;
  }

  const existingClient = existingClients?.[0] ?? null;

  // If client exists, update last visit and return
  if (existingClient) {
    const { data: updatedClient, error: updateError } = await supabase
      .from("clients")
      .update({
        last_visit_date: new Date().toISOString(),
        total_visits: existingClient.total_visits + 1,
        // Update email and name if provided and different
        ...(email && email !== existingClient.email ? { email } : {}),
        ...(name && name !== existingClient.name ? { name } : {}),
      })
      .eq("id", existingClient.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return updatedClient;
  }

  // Create new client
  const newClient: TablesInsert<"clients"> = {
    phone: normalizedPhone,
    email: email || null,
    name,
    primary_creative_id: creativeId,
    first_visit_date: new Date().toISOString(),
    last_visit_date: new Date().toISOString(),
    total_visits: 1,
  };

  const { data: createdClient, error: createError } = await supabase
    .from("clients")
    .insert(newClient)
    .select()
    .single();

  if (createError) {
    // If another flow created the client first, reuse the existing client by phone.
    if ((createError as any).code === "23505") {
      const { data: recoveredClients, error: recoverError } = await supabase
        .from("clients")
        .select("*")
        .eq("phone", normalizedPhone)
        .order("last_visit_date", { ascending: false })
        .limit(1);

      const recoveredClient = recoveredClients?.[0] ?? null;
      if (!recoverError && recoveredClient) {
        return recoveredClient;
      }
    }
    throw createError;
  }

  return createdClient;
}

/**
 * Get client with full history including appointments, visual history, and loyalty points
 */
export async function getClientWithHistory(
  clientId: string
): Promise<ClientWithHistory | null> {
  // Fetch client
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return null;
  }

  // Fetch appointments
  const { data: appointments } = await supabase
    .from("salon_appointments")
    .select("*")
    .eq("client_id", clientId)
    .order("appointment_date", { ascending: false });

  // Fetch visual history (private lookbook items)
  const { data: visualHistory } = await supabase
    .from("creative_lookbooks")
    .select(`
      id,
      private_notes,
      added_at,
      content:client_content(*)
    `)
    .eq("client_id", clientId)
    .eq("visibility_type", "private")
    .order("added_at", { ascending: false });

  // Fetch loyalty points
  const { data: loyaltyPoints } = await supabase
    .from("customer_loyalty_points")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  return {
    ...client,
    appointments: appointments || [],
    visualHistory: (visualHistory || []) as any,
    loyaltyPoints: loyaltyPoints || null,
  };
}

/**
 * Search clients by name, phone, or email
 */
export async function searchClients(
  query: string,
  creativeId: string
): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("primary_creative_id", creativeId)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .order("last_visit_date", { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return data || [];
}
