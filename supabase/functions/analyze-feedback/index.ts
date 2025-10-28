import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feedbackId } = await req.json();

    if (!feedbackId) {
      throw new Error('feedbackId is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get feedback
    const { data: feedback, error: fetchError } = await supabase
      .from('feedback')
      .select('*')
      .eq('id', feedbackId)
      .single();

    if (fetchError) throw fetchError;

    // Analyze sentiment with OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Analyze the sentiment of the following customer feedback. Respond with a JSON object containing: sentiment (positive/neutral/negative) and score (0-1 where 0 is very negative and 1 is very positive).'
          },
          {
            role: 'user',
            content: feedback.feedback_text
          }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const sentimentData = JSON.parse(aiData.choices[0].message.content);

    // Update feedback with sentiment
    const { error: updateError } = await supabase
      .from('feedback')
      .update({
        text_sentiment: sentimentData.sentiment,
        text_sentiment_score: sentimentData.score,
        sentiment: sentimentData.sentiment,
        sentiment_score: sentimentData.score,
      })
      .eq('id', feedbackId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, sentiment: sentimentData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-feedback function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
