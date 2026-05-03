import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY tidak tersedia')
    }

    const authApiUrl = `${supabaseUrl}/auth/v1/admin/users`
    const restApiUrl = `${supabaseUrl}/rest/v1/profiles`

    // 1. Create auth user via direct REST API
    const authRes = await fetch(authApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey || '',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role },
      }),
    })

    const authData = await authRes.json()
    console.log('Auth API response:', authRes.status, authData)

    if (!authRes.ok) {
      throw new Error(authData?.msg || authData?.message || `Auth API error ${authRes.status}`)
    }

    const userId = authData?.id || authData?.user?.id
    if (!userId) throw new Error('No user ID returned from Auth API')

    // 2. Update profile via PostgREST
    const profileRes = await fetch(`${restApiUrl}?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey || '',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ full_name, role, whatsapp_number, jabatan }),
    })

    console.log('Profile API response:', profileRes.status)

    if (!profileRes.ok) {
      const profileErr = await profileRes.json().catch(() => ({}))
      console.error('Profile update error:', profileErr)
      // Don't fail if profile update fails — trigger will create it
    }

    return new Response(
      JSON.stringify({ success: true, user: authData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Edge function error:', err)
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
