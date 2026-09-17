import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...corsHeaders,'Content-Type':'application/json'}
  });
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);

  try{
    const supabaseUrl=Deno.env.get('SUPABASE_URL');
    const anonKey=Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader=req.headers.get('Authorization');

    if(!supabaseUrl||!anonKey||!serviceRoleKey)return json({error:'Server configuration is incomplete.'},500);
    if(!authHeader)return json({error:'Not authenticated.'},401);

    const userClient=createClient(supabaseUrl,anonKey,{
      global:{headers:{Authorization:authHeader}},
      auth:{persistSession:false,autoRefreshToken:false}
    });

    const {data:userData,error:userError}=await userClient.auth.getUser();
    const user=userData.user;
    if(userError||!user)return json({error:'Not authenticated.'},401);

    let body:{confirm?:boolean}={};
    try{body=await req.json();}catch(_error){}
    if(body.confirm!==true)return json({error:'Deletion was not confirmed.'},400);

    const admin=createClient(supabaseUrl,serviceRoleKey,{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    // Supabase cannot remove an Auth user while they still own Storage objects.
    // Profile images live in a user-id folder, so remove those before deleting
    // the Auth user. Database rows are removed by existing ON DELETE CASCADE FKs.
    const {data:files,error:listError}=await admin.storage
      .from('profile-images')
      .list(user.id,{limit:1000});

    if(listError)throw new Error(`Could not inspect profile images: ${listError.message}`);

    if(files?.length){
      const paths=files.map((file)=>`${user.id}/${file.name}`);
      const {error:removeError}=await admin.storage.from('profile-images').remove(paths);
      if(removeError)throw new Error(`Could not remove profile images: ${removeError.message}`);
    }

    const {error:deleteUserError}=await admin.auth.admin.deleteUser(user.id);
    if(deleteUserError)throw new Error(`Could not delete auth user: ${deleteUserError.message}`);

    return json({ok:true});
  }catch(error){
    console.error('delete-account failed:',error);
    return json({error:error instanceof Error?error.message:'Could not delete account.'},500);
  }
});
