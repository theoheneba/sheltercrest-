import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const INFOLLY_API_URL = "https://sms.infolly.net/api/http/sms/send";
const INFOLLY_API_TOKEN = Deno.env.get("INFOLLY_API_TOKEN") || "2|DkTTVyIHXzoZqEiWWa3XpmTysFrZaMTVTvkaY11hdfa33851";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { recipient, message, sender_id = "ShelterCrest", notification_type = "general" } = await req.json();

    if (!recipient || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number if needed (remove spaces, ensure country code, etc.)
    const formattedPhone = formatPhoneNumber(recipient);

    console.log(`Sending ${notification_type} SMS to ${formattedPhone}: ${message}`);

    // Send SMS via Infolly API
    const response = await fetch(INFOLLY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        api_token: INFOLLY_API_TOKEN,
        recipient: formattedPhone,
        sender_id: sender_id,
        type: "plain",
        message: message
      })
    });

    const data = await response.json();
    console.log("SMS API response:", data);

    if (!response.ok) {
      throw new Error(data.message || "Failed to send SMS");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        notification_type,
        recipient: formattedPhone
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to format phone numbers
function formatPhoneNumber(phone: string): string {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Ensure Ghana country code
  if (!cleaned.startsWith('233')) {
    // If it starts with 0, replace it with 233
    if (cleaned.startsWith('0')) {
      cleaned = '233' + cleaned.substring(1);
    } else {
      // Otherwise, just add 233 prefix
      cleaned = '233' + cleaned;
    }
  }
  
  return cleaned;
}