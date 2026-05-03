import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  try {
    const { email, password, full_name, role, whatsapp_number, jabatan } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'SERVICE_ROLE_KEY tidak di-set. Jalankan: npx supabase secrets set SERVICE_ROLE_KEY=<service_role_key> --project-ref entwkvvexvwyngwzxmdc'
      )
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (authError) throw authError
    if (!authData?.user?.id) throw new Error('No user ID returned')

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name, role, whatsapp_number, jabatan })
      .eq('id', authData.user.id)

    if (profileError) throw profileError

    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Supabase Edge Function deploy:
// npx supabase functions deploy create-user
// npx supabase secrets set --env-file ./supabase/.env.local
// Grant execute permission: npx supabase db push (or run SQL)
// SQL: grant execute on function public.create-user to anon, authenticated;
// Actually for Edge Functions, use: npx supabase functions deploy create-user
// Then in app call: supabase.functions.invoke('create-user', { body: {...} })
// Or via fetch: POST https://<project>.supabase.co/functions/v1/create-user
// with Authorization: Bearer <anon-key>

// Deno deploy CORS headers if needed:
/*
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders })
}
*/
// @ts-ignore
// const _cors = corsHeaders
