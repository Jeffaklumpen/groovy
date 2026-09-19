import { withSupabase } from 'npm:@supabase/server@^1'
import webpush from 'npm:web-push@3.6.7'

type VapidConfig = {
  public_key?: string
  private_key?: string
  subject?: string
}

async function ensureConfig(db:any):Promise<string>{
  const current=await db.rpc('get_web_push_vapid_config')
  if(current.error)throw current.error
  const value=(current.data||{}) as VapidConfig
  if(value.public_key&&value.private_key&&value.subject)return value.public_key

  const keys=webpush.generateVAPIDKeys()
  const initialized=await db.rpc('initialize_web_push_vapid',{
    p_public_key:keys.publicKey,
    p_private_key:keys.privateKey,
    p_subject:'https://groovyshelves.com/'
  })
  if(initialized.error)throw initialized.error

  return String(initialized.data||keys.publicKey)
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (_req,ctx) => {
    try{
      const publicKey=await ensureConfig(ctx.supabaseAdmin)
      if(!publicKey)return Response.json({error:'Push notifications are not configured.'},{status:503})
      return Response.json(
        {publicKey},
        {headers:{'Cache-Control':'private, max-age=3600'}}
      )
    }catch(error){
      console.error('Could not load Web Push configuration',error)
      return Response.json({error:'Could not prepare mobile notifications.'},{status:500})
    }
  })
}
