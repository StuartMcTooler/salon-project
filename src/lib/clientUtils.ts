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
  const normalizedPhone = normalizePhoneNumber(phone);

  // Use SECURITY DEFINER RPC so unauthenticated public-booking flows
  // (and authenticated staff flows) both work through a single path.
  const { data: clientId, error: rpcError } = await supabase.rpc(
    "find_or_create_booking_client",
    {
      _phone: normalizedPhone,
      _email: email || null,
      _name: name,
      _creative_id: creativeId,
    }
  );

  if (rpcError || !clientId) {
    throw rpcError ?? new Error("Failed to create client");
  }

  const { data: client, error: fetchError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId as string)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (client) return client;

  // Anonymous booker cannot read the row back via RLS. Return a minimal
  // client object; downstream callers only need the id for FK linkage.
  return {
    id: clientId as string,
    phone: normalizedPhone,
    email: email || null,
    name,
    primary_creative_id: creativeId,
    first_visit_date: new Date().toISOString(),
    last_visit_date: new Date().toISOString(),
    total_visits: 1,
  } as Client;
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
