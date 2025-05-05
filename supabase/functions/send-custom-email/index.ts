import { SmtpClient } from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Parse request body
    const payload: EmailPayload = await req.json();
    
    if (!payload.to || !payload.subject || !payload.html) {
      throw new Error("Missing required fields: to, subject, or html");
    }

    // Create transporter
    const transporter = SmtpClient.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true, // use SSL
      auth: {
        user: "no-reply@sheltercrest.org",
        pass: "@sheltercrest.orG3",
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: payload.from || '"ShelterCrest" <no-reply@sheltercrest.org>',
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});