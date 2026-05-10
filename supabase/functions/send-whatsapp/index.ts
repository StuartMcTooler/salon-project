// Edge function for sending WhatsApp messages via Twilio with SMS fallback
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message, businessId, messageType = 'general', mediaUrl } = await req.json();

    // SECURITY: Validate required fields
    if (!to || !message) {
      throw new Error('to and message are required');
    }

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

    // SECURITY: Rate limiting check - max messages per hour to same number
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentMessages } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('recipient_phone', to)
      .neq('status', 'simulated') // Don't count simulated messages
      .gte('created_at', oneHourAgo);
    
    const MAX_MESSAGES_PER_HOUR = 5;
    if (recentMessages && recentMessages.length >= MAX_MESSAGES_PER_HOUR) {
      throw new Error(`Rate limit exceeded. Maximum ${MAX_MESSAGES_PER_HOUR} messages per hour to this number`);
    }

    // Resolve notification method: business-level setting (defaults to 'sms_only')
    // Set business_accounts.notification_method to 'hybrid' or 'whatsapp_only' to enable WhatsApp.
    let notificationMethod: 'sms_only' | 'hybrid' | 'whatsapp_only' = 'sms_only';
    if (businessId) {
      const { data: biz } = await supabase
        .from('business_accounts')
        .select('notification_method')
        .eq('id', businessId)
        .maybeSingle();
      if (biz?.notification_method) {
        notificationMethod = biz.notification_method as typeof notificationMethod;
      }
    }

    // For WhatsApp paths, also require client opt-in. If not opted in, downgrade to SMS.
    if (notificationMethod !== 'sms_only') {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('whatsapp_opted_in, last_inbound_message_at')
        .eq('phone', to)
        .maybeSingle();

      if (!clientRow?.whatsapp_opted_in) {
        console.log('Recipient not opted in to WhatsApp, downgrading to SMS');
        notificationMethod = 'sms_only';
      } else {
        // 24-hour session window check — outside the window, WhatsApp requires an approved template.
        const lastInbound = clientRow.last_inbound_message_at
          ? new Date(clientRow.last_inbound_message_at).getTime()
          : 0;
        const withinSession = Date.now() - lastInbound < 24 * 60 * 60 * 1000;

        if (!withinSession) {
          // Look up a template ContentSid for this messageType, e.g. TWILIO_TEMPLATE_BOOKING_LINK
          const templateEnvKey = `TWILIO_TEMPLATE_${messageType.toUpperCase()}`;
          const templateSid = Deno.env.get(templateEnvKey);
          if (!templateSid) {
            console.log(`No approved template for messageType="${messageType}" (${templateEnvKey} unset). Falling back to SMS.`);
            notificationMethod = notificationMethod === 'whatsapp_only' ? 'whatsapp_only' : 'sms_only';
            // For whatsapp_only with no template, we'll still try WhatsApp free-form and likely fail; safer to SMS.
            if (notificationMethod === 'whatsapp_only') notificationMethod = 'sms_only';
          } else {
            // Stash for use in the WhatsApp send block below
            (globalThis as any).__twilioContentSid = templateSid;
          }
        }
      }
    }
    console.log(`Notification method resolved: ${notificationMethod}`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    let deliveryMethod = 'whatsapp';
    let messageId = null;
    let errorMessage = null;

    // Try WhatsApp first (unless SMS-only mode)
    if (notificationMethod !== 'sms_only') {
      try {
        const formattedTo = `whatsapp:${to}`;
        const formattedFrom = `whatsapp:${whatsappNumber}`;
        
        const formData = new URLSearchParams();
        formData.append('To', formattedTo);
        formData.append('From', formattedFrom);

        const contentSid = (globalThis as any).__twilioContentSid;
        if (contentSid) {
          // Outside 24h window — send approved template with the message body as variable {{1}}
          formData.append('ContentSid', contentSid);
          formData.append('ContentVariables', JSON.stringify({ '1': sanitizedMessage }));
          (globalThis as any).__twilioContentSid = undefined;
        } else {
          formData.append('Body', sanitizedMessage);
        }

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

        if (response.ok) {
          const data = await response.json();
          messageId = data.sid;
          console.log('WhatsApp message sent successfully:', messageId);
        } else {
          const errorText = await response.text();
          console.log('WhatsApp failed, will try SMS:', errorText);
          errorMessage = errorText;
          
          // Only fallback to SMS if hybrid mode
          if (notificationMethod !== 'hybrid') {
            throw new Error(`WhatsApp delivery failed: ${errorText}`);
          }
        }
      } catch (error) {
        console.error('WhatsApp error:', error);
        errorMessage = error instanceof Error ? error.message : 'WhatsApp failed';
        
        // Only fallback to SMS if hybrid mode
        if (notificationMethod !== 'hybrid') {
          throw error;
        }
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
