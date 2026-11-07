import { approvedTemplates, audience, prepareCampaign, startCampaign, campaignId } from './service.js';
import { getCampaign, listCampaigns, campaignState } from './store.js';
export function mountMarketing(app, auth) {
  const route = fn => async(req,res)=>{
    try { await fn(req,res); }
    catch(e) { res.status(400).json({error:e.message || 'Marketing request failed'}); }
  };
  app.get('/admin/api/marketing/templates',auth,route(async(_req,res)=>res.json({templates:await approvedTemplates()})));
  app.post('/admin/api/marketing/audience',auth,route(async(req,res)=>{
    const result=await audience(req.body || {});
    res.json({count:result.count,foodConfigured:result.foodConfigured});
  }));
  app.get('/admin/api/marketing/campaigns',auth,route(async(_req,res)=>res.json({campaigns:await listCampaigns()})));
  app.get('/admin/api/marketing/campaigns/:id',auth,route(async(req,res)=>{
    const result=await getCampaign(campaignId(req.params.id));
    if (!result) return res.status(404).json({error:'Campaign not found'});
    res.json(result);
  }));
  app.post('/admin/api/marketing/test-send',auth,route(async(req,res)=>res.status(202).json(await prepareCampaign({...req.body,mode:'test'}))));
  app.post('/admin/api/marketing/campaigns',auth,route(async(req,res)=>res.status(202).json(await prepareCampaign(req.body || {}))));
  app.post('/admin/api/marketing/campaigns/:id/pause',auth,route(async(req,res)=>{
    const id=campaignId(req.params.id);
    if (!await getCampaign(id)) return res.status(404).json({error:'Campaign not found'});
    await campaignState(id,'paused'); res.json({ok:true});
  }));
  app.post('/admin/api/marketing/campaigns/:id/resume',auth,route(async(req,res)=>{
    const id=campaignId(req.params.id);
    if (req.body?.confirmed !== true) throw new Error('Explicit confirmation required');
    if (!await getCampaign(id)) return res.status(404).json({error:'Campaign not found'});
    startCampaign(id); res.status(202).json({ok:true});
  }));
}
