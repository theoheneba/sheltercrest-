import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPERATION_TIMEOUT = 30000; // 30 seconds timeout

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPERATION_TIMEOUT);

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing required environment variables");
      throw new Error("Missing required environment variables");
    }

    console.log("Environment variables loaded successfully");

    // Initialize Supabase admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log("Supabase client initialized");

    // Get request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      throw new Error("Invalid JSON in request body");
    }

    const { bucketName, isPublic = false, createPolicies = false } = body;

    if (!bucketName) {
      throw new Error("Bucket name is required");
    }

    console.log(`Processing request for bucket: ${bucketName}`);

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      throw listError;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      console.log(`Bucket ${bucketName} already exists`);
      
      if (createPolicies) {
        console.log("Setting up policies for existing bucket");
        try {
          await createBucketPolicies(supabase, bucketName);
          console.log("Policies created successfully for existing bucket");
        } catch (policyError) {
          console.error("Error creating policies for existing bucket:", policyError);
          // Continue even if policy creation fails
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Bucket ${bucketName} already exists`,
          exists: true
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`Creating new bucket: ${bucketName}`);
    
    // Create the bucket
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: isPublic,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    });

    if (error) {
      console.error("Error creating bucket:", error);
      throw error;
    }

    console.log(`Bucket ${bucketName} created successfully`);

    if (createPolicies) {
      console.log("Setting up policies for new bucket");
      try {
        await createBucketPolicies(supabase, bucketName);
        console.log("Policies created successfully for new bucket");
      } catch (policyError) {
        console.error("Error creating policies for new bucket:", policyError);
        // Continue even if policy creation fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bucket ${bucketName} created successfully`,
        exists: false
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error.status || 400,
      }
    );
  } finally {
    clearTimeout(timeoutId);
  }
});

async function createBucketPolicies(supabase, bucketName) {
  console.log(`Setting up policies for bucket: ${bucketName}`);
  
  try {
    // Create admin policy first
    console.log("Creating admin policy");
    await supabase.rpc('create_storage_policy', {
      bucket: bucketName,
      policy_name: "Admin can access all documents",
      definition: "(auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text])",
      operation: "ALL"
    });
    
    // Create user policies
    const userPolicies = [
      {
        name: "User can access own folder",
        definition: "auth.uid()::text = SPLIT_PART(name, '/', 1)",
        operation: "SELECT"
      },
      {
        name: "User can upload to own folder",
        definition: "auth.uid()::text = SPLIT_PART(name, '/', 1)",
        operation: "INSERT"
      },
      {
        name: "User can update own documents",
        definition: "auth.uid()::text = SPLIT_PART(name, '/', 1)",
        operation: "UPDATE"
      },
      {
        name: "User can delete own documents",
        definition: "auth.uid()::text = SPLIT_PART(name, '/', 1)",
        operation: "DELETE"
      }
    ];
    
    for (const policy of userPolicies) {
      console.log(`Creating policy: ${policy.name}`);
      await supabase.rpc('create_storage_policy', {
        bucket: bucketName,
        policy_name: policy.name,
        definition: policy.definition,
        operation: policy.operation
      });
    }
    
    console.log(`All policies for bucket ${bucketName} created successfully`);
  } catch (error) {
    console.error("Error creating bucket policies:", error);
    throw error;
  }
}