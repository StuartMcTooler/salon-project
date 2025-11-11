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
    const { to, message, businessId, messageType = 'general' } = await req.json();

    if (!to || !message) {
      throw new Error('to and message are required');
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const whatsappNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (!accountSid || !authToken || !whatsappNumber) {
      throw new Error('Twilio credentials not configured');
    }

    // Initialize Supabase client for logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get business notification preference if businessId provided
    let notificationMethod = 'hybrid';
    if (businessId) {
      const { data: business } = await supabase
        .from('business_accounts')
        .select('notification_method')
        .eq('id', businessId)
        .single();
      
      if (business?.notification_method) {
        notificationMethod = business.notification_method;
      }
    }

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
        formData.append('Body', message);

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
        formData.append('From', whatsappNumber);
        formData.append('Body', message);

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
        fallbackUsed: deliveryMethod === 'sms' && notificationMethod === 'hybrid'
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
