// Edge function for sending WhatsApp messages via Twilio with SMS fallback
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Message types that may be triggered by unauthenticated public booking flows
const PUBLIC_MESSAGE_TYPES = new Set(['booking_confirmation']);

// Meta-approved WhatsApp templates (Twilio Content SIDs) and their variable counts.
// Staff invites intentionally stay on SMS (template rejected by Meta).
const TEMPLATES: Record<string, { sid: string; count: number }> = {
  booking_confirmation: { sid: 'HX682f93fc55d2f7624bd4a61fb137a72c', count: 6 }, // name, barber, date, time, service, portal URL
  appointment_reminder_72h: { sid: 'HX1aad92683ef2cbdd87e8bf7e1115fc96', count: 5 }, // name, barber, date, time, service
  appointment_reminder_24h: { sid: 'HX1aad92683ef2cbdd87e8bf7e1115fc96', count: 5 },
  appointment_change: { sid: 'HXf562abd0bbdf2a1ab2f5da243b972181', count: 5 }, // name, barber, date, time, service
  booking_cancelled: { sid: 'HXf932b931cbb9d7e6baf7ce38692bd6c8', count: 4 }, // name, barber, date, time
  booking_link: { sid: 'HX17cf4ab5ebc022f093ee2ee0d165f005', count: 3 }, // name, barber, staff id
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_MESSAGES_PER_PHONE = 5;
const MAX_MESSAGES_PER_CALLER = 10;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to: rawTo, message, businessId, messageType = 'general', mediaUrl, templateVariables } = await req.json();

    // SECURITY: Validate required fields
    if (!rawTo || !message) {
      throw new Error('to and message are required');
    }

    // Normalize to E.164 (default Ireland +353 for local numbers like 087...)
    let to = String(rawTo).replace(/[\s\-().]/g, '');
    if (to.startsWith('00')) to = '+' + to.slice(2);
    else if (to.startsWith('0')) to = '+353' + to.slice(1);
    else if (!to.startsWith('+') && to.startsWith('353')) to = '+' + to;

    // SECURITY: Validate phone number format (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to)) {
      throw new Error('Invalid phone number format. Must be in E.164 format (e.g., +353851234567)');
    }

    // SECURITY: Validate message length
    const MAX_MESSAGE_LENGTH = 1600; // WhatsApp limit
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed`);
    }

    // SECURITY: Sanitize message content - remove control characters
    const sanitizedMessage = message.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: Authenticate the caller.
    // - Internal server-to-server callers present the service role key.
    // - App users present their own JWT.
    // - Unauthenticated callers may only trigger public booking confirmations.
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

    let callerId: string | null = null;

    if (bearer && bearer === supabaseKey) {
      callerId = 'service_role';
    } else if (bearer) {
      const { data: userData } = await supabase.auth.getUser(bearer);
      if (userData?.user) {
        callerId = `user:${userData.user.id}`;
      }
    }

    if (!callerId && !PUBLIC_MESSAGE_TYPES.has(messageType)) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // SECURITY: Rate limit per recipient AND per caller, in a dedicated table so it
    // cannot be bypassed by omitting businessId.
    if (callerId !== 'service_role') {
      const forwardedFor = req.headers.get('x-forwarded-for') || '';
      const callerKey = callerId ?? `ip:${forwardedFor.split(',')[0].trim() || 'unknown'}`;

      const buckets: Array<{ key: string; max: number }> = [
        { key: `phone:${to}`, max: MAX_MESSAGES_PER_PHONE },
        { key: `caller:${callerKey}`, max: MAX_MESSAGES_PER_CALLER },
      ];

      for (const bucket of buckets) {
        const { data: existing } = await supabase
          .from('notification_rate_limits')
          .select('id, message_count, window_start')
          .eq('bucket_key', bucket.key)
          .maybeSingle();

        const now = Date.now();
        const windowExpired =
          !existing || now - new Date(existing.window_start).getTime() > RATE_LIMIT_WINDOW_MS;

        if (windowExpired) {
          await supabase
            .from('notification_rate_limits')
            .upsert(
              { bucket_key: bucket.key, message_count: 1, window_start: new Date().toISOString() },
              { onConflict: 'bucket_key' }
            );
          continue;
        }

        if (existing.message_count >= bucket.max) {
          console.warn('Rate limit exceeded for bucket', bucket.key);
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
          );
        }

        await supabase
          .from('notification_rate_limits')
          .update({ message_count: existing.message_count + 1 })
          .eq('id', existing.id);
      }
    }


    // Check if recipient is a test user (client or staff)
    const { data: testClient } = await supabase
      .from('clients')
      .select('is_test_user')
      .eq('phone', to)
      .eq('is_test_user', true)
      .maybeSingle();

    const { data: testStaff } = await supabase
      .from('staff_members')
      .select('is_test_user')
      .eq('phone', to)
      .eq('is_test_user', true)
      .maybeSingle();

    const isTestUser = testClient?.is_test_user || testStaff?.is_test_user;

    // If test user, simulate the message instead of sending
    if (isTestUser) {
      console.log('TEST USER DETECTED - Simulating message instead of sending');
      console.log('Recipient:', to);
      console.log('Message:', sanitizedMessage);
      console.log('Message Type:', messageType);

      // Log the simulated message
      if (businessId) {
        await supabase.from('notification_logs').insert({
          business_id: businessId,
          recipient_phone: to,
          message_type: messageType,
          delivery_method: 'simulated',
          status: 'simulated',
          twilio_message_id: `SIM_${Date.now()}`,
          error_message: `SIMULATED MESSAGE CONTENT: ${sanitizedMessage}`,
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: `SIM_${Date.now()}`, 
          deliveryMethod: 'simulated',
          simulated: true,
          message: 'Test user - message simulated, not sent'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Continue with real message sending for non-test users
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const whatsappNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    const smsSenderId = Deno.env.get('TWILIO_SMS_SENDER_ID') || whatsappNumber;

    if (!accountSid || !authToken || (!whatsappNumber && !smsSenderId)) {
      throw new Error('Twilio credentials not configured');
    }

    // Rate limiting is enforced above via public.notification_rate_limits.



    // WhatsApp via Meta-approved templates, SMS fallback.
    // Only message types with an approved template AND a full set of variables go via WhatsApp.
    const template = TEMPLATES[messageType];
    const vars: string[] = Array.isArray(templateVariables)
      ? templateVariables.map((v: unknown) => String(v ?? '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim().slice(0, 200))
      : [];
    const useWhatsApp = !!template && !!whatsappNumber && !mediaUrl
      && vars.length === template.count && vars.every((v) => v.length > 0);
    const notificationMethod = useWhatsApp ? 'hybrid' : 'sms_only';

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    let deliveryMethod = 'whatsapp';
    let messageId = null;
    let errorMessage = null;

    if (useWhatsApp) {
      try {
        const contentVariables: Record<string, string> = {};
        vars.forEach((v, i) => { contentVariables[String(i + 1)] = v; });

        const formData = new URLSearchParams();
        formData.append('To', `whatsapp:${to}`);
        formData.append('From', `whatsapp:${whatsappNumber}`);
        formData.append('ContentSid', template!.sid);
        formData.append('ContentVariables', JSON.stringify(contentVariables));

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (response.ok) {
          const data = await response.json();
          messageId = data.sid;
          console.log('WhatsApp template sent:', messageType, messageId);
        } else {
          errorMessage = await response.text();
          console.log('WhatsApp failed, falling back to SMS:', errorMessage);
        }
      } catch (error) {
        console.error('WhatsApp error:', error);
        errorMessage = error instanceof Error ? error.message : 'WhatsApp failed';
      }
    }

    // Fallback to SMS if WhatsApp failed or SMS-only mode
    if (!messageId && (notificationMethod === 'sms_only' || notificationMethod === 'hybrid')) {
      try {
        deliveryMethod = 'sms';
        console.log('Attempting SMS delivery...');
        
        const formData = new URLSearchParams();
        formData.append('To', to);
        formData.append('From', smsSenderId!);
        formData.append('Body', sanitizedMessage);
        
        if (mediaUrl) {
          formData.append('MediaUrl', mediaUrl);
        }

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('SMS delivery failed:', errorText);
          throw new Error(`SMS delivery failed: ${errorText}`);
        }

        const data = await response.json();
        messageId = data.sid;
        console.log('SMS message sent successfully:', messageId);
        errorMessage = null;
      } catch (error) {
        console.error('SMS error:', error);
        errorMessage = error instanceof Error ? error.message : 'SMS failed';
        throw error;
      }
    }

    // Log the notification attempt
    if (businessId) {
      await supabase.from('notification_logs').insert({
        business_id: businessId,
        recipient_phone: to,
        message_type: messageType,
        delivery_method: deliveryMethod,
        status: messageId ? 'success' : 'failed',
        twilio_message_id: messageId,
        error_message: errorMessage,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId, 
        deliveryMethod,
        fallbackUsed: false // SMS-only mode, no fallback needed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-whatsapp function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
