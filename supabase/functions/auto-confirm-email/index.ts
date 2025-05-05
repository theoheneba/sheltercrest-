import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailConfirmPayload {
  email: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      throw new Error("Missing environment variables");
    }

    console.log("Environment variables loaded successfully");

    // Initialize Supabase admin client with proper configuration
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    });

    console.log("Supabase client initialized");

    // Get the email from the request body
    const { email }: EmailConfirmPayload = await req.json();

    if (!email) {
      console.error("Email is required but was not provided");
      throw new Error("Email is required");
    }

    console.log(`Attempting to confirm email for: ${email}`);

    // Get the user by email with error handling
    const { data: { users }, error: getUserError } = await supabase.auth.admin.listUsers({
      filter: {
        email: email
      }
    });

    if (getUserError) {
      console.error("Error getting user:", getUserError);
      throw getUserError;
    }

    if (!users || users.length === 0) {
      console.error("User not found for email:", email);
      throw new Error("User not found");
    }

    const user = users[0];
    console.log(`Found user: ${user.id} for email: ${email}`);

    // Check if email is already confirmed
    if (user.email_confirmed_at) {
      console.log(`Email already confirmed for user: ${user.id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email already confirmed",
          alreadyConfirmed: true
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Update the user to confirm their email
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { 
        email_confirmed_at: new Date().toISOString(),
        user_metadata: {
          ...user.user_metadata,
          email_confirmed: true
        }
      }
    );

    if (updateError) {
      console.error("Error updating user:", updateError);
      throw updateError;
    }

    console.log(`Email confirmed successfully for: ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email confirmed successfully"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});