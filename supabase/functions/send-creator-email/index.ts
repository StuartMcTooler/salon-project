import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  staffId: string;
  appointmentId: string;
  notificationType: 'new_booking' | 'booking_cancelled' | 'booking_changed';
  originalAppointment?: {
    appointment_date?: string;
    service_name?: string;
    price?: number;
  };
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-creator-email] Request received");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { staffId, appointmentId, notificationType, originalAppointment }: EmailRequest = await req.json();

    console.log("[send-creator-email] Processing:", { staffId, appointmentId, notificationType });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch staff member's email
    const { data: staffMember, error: staffError } = await supabase
      .from('staff_members')
      .select('email, display_name, full_name')
      .eq('id', staffId)
      .single();

    if (staffError) {
      console.error("[send-creator-email] Error fetching staff:", staffError);
      throw new Error(`Failed to fetch staff member: ${staffError.message}`);
    }

    if (!staffMember?.email) {
      console.log("[send-creator-email] No email configured for staff member, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No email configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch appointment details
    const { data: appointment, error: apptError } = await supabase
      .from('salon_appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (apptError) {
      console.error("[send-creator-email] Error fetching appointment:", apptError);
      throw new Error(`Failed to fetch appointment: ${apptError.message}`);
    }

    const creatorName = staffMember.display_name || staffMember.full_name || 'Creator';
    let subject = '';
    let htmlBody = '';

    const baseStyles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: 600; color: #6b7280; width: 120px; }
        .detail-value { color: #111827; }
        .highlight { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .price { font-size: 24px; font-weight: bold; color: #059669; }
        .changed { background: #dbeafe; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .old-value { color: #dc2626; text-decoration: line-through; }
        .new-value { color: #059669; font-weight: 600; }
      </style>
    `;

    switch (notificationType) {
      case 'new_booking':
        subject = `📅 New Booking: ${appointment.customer_name} - ${appointment.service_name}`;
        htmlBody = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">New Booking Confirmed!</h1>
            </div>
            <div class="content">
              <p>Hi ${creatorName},</p>
              <p>You have a new booking! Here are the details:</p>
              
              <div class="highlight">
                <div class="detail-row">
                  <span class="detail-label">Customer</span>
                  <span class="detail-value">${appointment.customer_name}</span>
                </div>
                ${appointment.customer_phone ? `
                <div class="detail-row">
                  <span class="detail-label">Phone</span>
                  <span class="detail-value">${appointment.customer_phone}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Service</span>
                  <span class="detail-value">${appointment.service_name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date</span>
                  <span class="detail-value">${formatDate(appointment.appointment_date)}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time</span>
                  <span class="detail-value">${formatTime(appointment.appointment_date)}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Duration</span>
                  <span class="detail-value">${appointment.duration_minutes} minutes</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Price</span>
                  <span class="detail-value price">€${Number(appointment.price).toFixed(2)}</span>
                </div>
                ${appointment.notes ? `
                <div class="detail-row">
                  <span class="detail-label">Notes</span>
                  <span class="detail-value">${appointment.notes}</span>
                </div>
                ` : ''}
              </div>
            </div>
            <div class="footer">
              <p>This is an automated notification from your booking system.</p>
            </div>
          </div>
        `;
        break;

      case 'booking_cancelled':
        subject = `❌ Booking Cancelled: ${appointment.customer_name} - ${formatDate(appointment.appointment_date)}`;
        htmlBody = `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
              <h1 style="margin: 0; font-size: 24px;">Booking Cancelled</h1>
            </div>
            <div class="content">
              <p>Hi ${creatorName},</p>
              <p>A booking has been cancelled. Here were the details:</p>
              
              <div class="highlight" style="background: #fee2e2;">
                <div class="detail-row">
                  <span class="detail-label">Customer</span>
                  <span class="detail-value">${appointment.customer_name}</span>
                </div>
                ${appointment.customer_phone ? `
                <div class="detail-row">
                  <span class="detail-label">Phone</span>
                  <span class="detail-value">${appointment.customer_phone}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Service</span>
                  <span class="detail-value">${appointment.service_name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Was Scheduled</span>
                  <span class="detail-value">${formatDate(appointment.appointment_date)} at ${formatTime(appointment.appointment_date)}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Price</span>
                  <span class="detail-value">€${Number(appointment.price).toFixed(2)}</span>
                </div>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">This time slot is now available for new bookings.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from your booking system.</p>
            </div>
          </div>
        `;
        break;

      case 'booking_changed':
        const hasDateChange = originalAppointment?.appointment_date && 
          originalAppointment.appointment_date !== appointment.appointment_date;
        const hasServiceChange = originalAppointment?.service_name && 
          originalAppointment.service_name !== appointment.service_name;
        const hasPriceChange = originalAppointment?.price !== undefined && 
          originalAppointment.price !== appointment.price;

        subject = `🔄 Booking Updated: ${appointment.customer_name} - ${appointment.service_name}`;
        htmlBody = `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
              <h1 style="margin: 0; font-size: 24px;">Booking Updated</h1>
            </div>
            <div class="content">
              <p>Hi ${creatorName},</p>
              <p>A booking has been modified. Here's what changed:</p>
              
              <div class="highlight" style="background: #dbeafe;">
                <div class="detail-row">
                  <span class="detail-label">Customer</span>
                  <span class="detail-value">${appointment.customer_name}</span>
                </div>
                ${appointment.customer_phone ? `
                <div class="detail-row">
                  <span class="detail-label">Phone</span>
                  <span class="detail-value">${appointment.customer_phone}</span>
                </div>
                ` : ''}
                
                ${hasServiceChange ? `
                <div class="changed">
                  <span class="detail-label">Service Changed:</span><br/>
                  <span class="old-value">${originalAppointment?.service_name}</span> → 
                  <span class="new-value">${appointment.service_name}</span>
                </div>
                ` : `
                <div class="detail-row">
                  <span class="detail-label">Service</span>
                  <span class="detail-value">${appointment.service_name}</span>
                </div>
                `}
                
                ${hasDateChange ? `
                <div class="changed">
                  <span class="detail-label">Date/Time Changed:</span><br/>
                  <span class="old-value">${formatDate(originalAppointment!.appointment_date!)} at ${formatTime(originalAppointment!.appointment_date!)}</span><br/>
                  ↓<br/>
                  <span class="new-value">${formatDate(appointment.appointment_date)} at ${formatTime(appointment.appointment_date)}</span>
                </div>
                ` : `
                <div class="detail-row">
                  <span class="detail-label">Date</span>
                  <span class="detail-value">${formatDate(appointment.appointment_date)} at ${formatTime(appointment.appointment_date)}</span>
                </div>
                `}
                
                ${hasPriceChange ? `
                <div class="changed">
                  <span class="detail-label">Price Changed:</span><br/>
                  <span class="old-value">€${Number(originalAppointment!.price).toFixed(2)}</span> → 
                  <span class="new-value">€${Number(appointment.price).toFixed(2)}</span>
                </div>
                ` : `
                <div class="detail-row">
                  <span class="detail-label">Price</span>
                  <span class="detail-value price">€${Number(appointment.price).toFixed(2)}</span>
                </div>
                `}
                
                <div class="detail-row">
                  <span class="detail-label">Duration</span>
                  <span class="detail-value">${appointment.duration_minutes} minutes</span>
                </div>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated notification from your booking system.</p>
            </div>
          </div>
        `;
        break;

      default:
        throw new Error(`Unknown notification type: ${notificationType}`);
    }

    console.log("[send-creator-email] Sending email to:", staffMember.email);

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Bookd <bookings@bookd.ie>",
        to: [staffMember.email],
        subject,
        html: htmlBody,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("[send-creator-email] Resend API error:", emailData);
      throw new Error(emailData.message || "Failed to send email");
    }

    console.log("[send-creator-email] Email sent successfully:", emailData);

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-creator-email] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
