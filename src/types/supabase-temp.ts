// Temporary type definitions until auto-generated types update
// These match the database schema for the new tables

// Type extension for booking_type_enum with 'block' (Time Blocking feature)
// Once enum is added to database, this will match the auto-generated types
export type BookingTypeWithBlock = 'direct' | 'cover' | 'referral_network' | 'block';

export interface ContentRequest {
  id: string;
  appointment_id: string;
  creative_id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  token: string;
  token_expires_at: string;
  status: string;
  request_type: string;
  created_at: string;
  updated_at: string;
}

export interface ClientContent {
  id: string;
  request_id: string;
  creative_id: string;
  media_type: string;
  raw_file_path: string;
  enhanced_file_path: string | null;
  file_size_bytes: number | null;
  client_approved: boolean;
  approved_at: string | null;
  points_awarded: boolean;
  ai_metadata: any;
  created_at: string;
}

export interface CreativeLookbook {
  id: string;
  creative_id: string;
  content_id: string;
  display_order: number;
  is_featured: boolean;
  tags: string[] | null;
  added_at: string;
}
