// Run only against a disposable local database with the real schema/migrations.
// Start a local Next server pointing at the same database; no workers/providers.
import assert from 'node:assert/strict';
import { randomBytes, createHash, scryptSync } from 'node:crypto';
import pg from 'pg';
const base = new URL(process.env.ADMIN_QA_BASE ?? 'http://127.0.0.1:34105');
const database = new URL(process.env.ADMIN_QA_DATABASE ?? 'postgresql://rolesharp_qa@127.0.0.1:54381/rolesharp_admin_qa');
assert.equal(base.hostname, '127.0.0.1');
assert.equal(database.hostname, '127.0.0.1');
assert.match(database.pathname, /^\/rolesharp_(?:admin_qa|overhaul_qa_\d{8}_\d{2})$/);
const pool = new pg.Pool({ connectionString: database.href });
const run = randomBytes(6).toString('hex');
const email = `admin-smoke-${run}@example.test`;
const token = randomBytes(32).toString('base64url');
const hash = createHash('sha256').update(`rolesharp-staff-session-v1\0${token}`).digest('hex');
let calls = 0;
async function api(path, method = 'GET', data, status = 200, cookie = `rai_staff=${token}`) {
  const response = await fetch(new URL(path, base), { method, headers: {
    Cookie: cookie, Origin: base.origin, 'Content-Type': 'application/json',
  }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(60000) });
  const body = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(body)}`);
  calls++;
  return body;
}
const rows = async (sql, params = []) => (await pool.query(sql, params)).rows;
try {
  const staff = (await rows("insert into staff_accounts(email,status,display_name,google_subject,activated_at) values($1,'active','Local QA owner',$1,now()) returning id", [email]))[0];
  await rows("insert into staff_role_assignments(staff_account_id,role_key) values($1,'owner')", [staff.id]);
  await rows("insert into staff_sessions(staff_account_id,token_hash,auth_version,authentication_method,idle_expires_at,absolute_expires_at) values($1,$2,1,'google',now()+interval '1 hour',now()+interval '1 hour')", [staff.id, hash]);
  const user = (await rows('insert into users(email,credits) values($1,3) returning id', [email]))[0];
  // Prove the HTTP server is connected to this exact fixture before mutations.
  const found = await api(`/api/admin/users?list=1&q=${user.id}`);
  assert.equal(found.rows[0]?.id, user.id);
  const session = await api('/api/admin/session');
  assert.equal(session.principal.staffAccountId, staff.id);
  await api('/api/admin/users', 'POST', {email, action:'credits', delta:-10});
  assert.equal((await rows('select credits from users where id=$1', [user.id]))[0].credits, 0);
  assert.equal((await rows("select delta from credit_events where user_id=$1 and kind='admin_adjustment' order by created_at desc limit 1", [user.id]))[0].delta, -3, 'Credit ledger must record the applied decrement, not the requested decrement');
  await api('/api/admin/users', 'POST', {email, action:'credits', delta:5});
  assert.equal((await rows('select credits from users where id=$1', [user.id]))[0].credits, 5);
  console.log('PASS credit adjustment and ledger');
  await rows("insert into feature_access_grants(user_id,feature_key,state) values($1,'daily_matches','requested')", [user.id]);
  for (const state of ['approved','suspended','approved','revoked']) {
    await api('/api/admin/feature-access', 'POST', {userId:user.id, featureKey:'daily_matches', state, reason:'Local integration verification', dailyCap:3});
    assert.equal((await rows('select state from feature_access_grants where user_id=$1', [user.id]))[0].state, state);
  }
  assert.equal((await rows('select count(*)::int n from feature_access_events where user_id=$1', [user.id]))[0].n, 4);
  console.log('PASS feature approval, suspension, restoration, revocation and event ledger');
  const ticket = (await rows("insert into support_tickets(user_id_text,email,subject) values($1,$2,'Local QA') returning id", [user.id,email]))[0];
  for (const [action,status] of [['reply','answered'],['resolve','resolved'],['reopen','open']]) {
    await api(`/api/admin/support/${ticket.id}`, 'POST', {action,message:'Local integration reply'});
    assert.equal((await rows('select status from support_tickets where id=$1', [ticket.id]))[0].status,status);
  }
  console.log('PASS support reply, resolve and reopen');
  const report = (await rows("insert into internship_reports(reporter_user_id,company,location,risk,categories,description) values($1,'QA company','Remote','unconfirmed',array['other'],$2) returning id", [user.id,'Synthetic local test report. No real company or incident is described here.']))[0];
  for (const status of ['approved','rejected','pending']) {
    await api('/api/admin/internship-reports','PATCH',{id:report.id,status,moderationNote:'Local QA'});
    assert.equal((await rows('select status from internship_reports where id=$1',[report.id]))[0].status,status);
  }
  await api(`/api/admin/internship-reports?id=${report.id}`,'DELETE');
  assert.equal((await rows('select id from internship_reports where id=$1',[report.id])).length,0);
  const audits=await rows("select staff_account_id from admin_actions where action in ('internship_report_moderate','internship_report_delete') and details->>'id'=$1",[report.id]);
  assert.equal(audits.length,4);
  assert.ok(audits.every(row=>row.staff_account_id===staff.id));
  console.log('PASS internship moderation, deletion and attributed audit trail');
  const limits={freeMonthly:3,premiumMonthly:77,studentMonthly:12};
  await api('/api/admin/settings','PUT',{limits});
  assert.deepEqual((await api('/api/admin/settings')).limits,limits);
  await api('/api/admin/settings','PUT',{reset:true});
  assert.equal((await api('/api/admin/settings')).overridden,false);
  console.log('PASS usage settings save and reset');
  const flag=(await api('/api/admin/flags')).flags.find(row=>row.name==='telegram_rewards');
  assert.ok(flag);
  const beforeFlags=(await rows("select count(*)::int n from admin_actions where action in ('flags_update','feature_flag_update') and details->>'name'=$1",[flag.name]))[0].n;
  for(const enabled of [!flag.enabled,flag.enabled]) await api('/api/admin/flags','POST',{name:flag.name,enabled});
  const flagActions=await rows("select staff_account_id from admin_actions where action in ('flags_update','feature_flag_update') and details->>'name'=$1 order by created_at desc limit 2",[flag.name]);
  assert.ok(flagActions.every(row=>row.staff_account_id===staff.id));
  assert.equal((await rows("select count(*)::int n from admin_actions where action in ('flags_update','feature_flag_update') and details->>'name'=$1",[flag.name]))[0].n-beforeFlags,2);
  console.log('PASS feature toggle, restoration and single attributed audit per mutation');
  const workflowFlag=(await api('/api/admin/flags')).flags.find(row=>row.name==='jobs_daily_matches');
  await api('/api/admin/flags','POST',{name:workflowFlag.name,rolloutPercent:25});
  assert.equal((await rows('select rollout_percent from feature_flags where name=$1',[workflowFlag.name]))[0].rollout_percent,25);
  await api('/api/admin/flags','POST',{name:workflowFlag.name,rolloutPercent:workflowFlag.rollout_percent});
  await api('/api/admin/flags','POST',{name:'maintenance_mode',rolloutPercent:25},400);
  await api('/api/admin/flags','POST',{name:workflowFlag.name,rolloutPercent:101},400);
  console.log('PASS persisted workflow rollout and rejection of unsupported/invalid percentages');
  const effectiveAt = new Date(Date.now()+86400000).toISOString();
  const legalFields = {bodyMarkdown:'Local QA legal document. This text exists only in a disposable test database.', changeSummary:'Local verification', materialChange:false,effectiveAt};
  const legal = await api('/api/admin/legal','POST',{action:'create',documentKey:'terms',...legalFields});
  await api('/api/admin/legal','POST',{action:'update_draft',versionId:legal.version.id,...legalFields});
  await api('/api/admin/legal','POST',{action:'publish_now',versionId:legal.version.id});
  assert.equal((await rows('select status from legal_document_versions where id=$1',[legal.version.id]))[0].status,'published');
  await api('/api/admin/legal','POST',{action:'update_draft',versionId:legal.version.id,...legalFields},400);
  console.log('PASS legal draft, publication and immutability');
  const oldOffer = (await api('/api/admin/offers')).versions[0];
  const offerFields={publicName:'QA student offer',publicSummary:'Disposable verification offer',callToAction:'Verify',terms:oldOffer.terms_snapshot,effectiveAt,enrollmentEndsAt:null};
  const offer=await api('/api/admin/offers','POST',{action:'create',offerKey:oldOffer.offer_key,...offerFields});
  await api('/api/admin/offers','POST',{action:'update_draft',versionId:offer.version.id,...offerFields});
  await api('/api/admin/offers','POST',{action:'publish_now',versionId:offer.version.id,confirmation:'PUBLISH OFFER'});
  assert.equal((await rows('select status from offer_versions where id=$1',[offer.version.id]))[0].status,'published');
  console.log('PASS offer draft and publication');
  const studentEmail=`student-${run}@example.test`;
  const pin=(await rows('select * from offer_versions where id=$1',[offer.version.id]))[0];
  for(let claim=0;claim<2;claim++) {
    await rows(`insert into student_claims(student_email,user_id,offer_version_id,offer_key,offer_version_number,offer_content_digest_snapshot,offer_terms_snapshot)
      values($1,$2,$3,$4,$5,$6,$7)`,[studentEmail,user.id,pin.id,pin.offer_key,pin.version_number,pin.content_digest,pin.terms_snapshot]);
    await rows(`insert into student_grants(student_email,student_email_fingerprint,offer_version_id,offer_key,offer_version_number,offer_content_digest_snapshot,offer_terms_snapshot,premium_started_at,premium_until)
      values($1,$2,$3,$4,$5,$6,$7,now(),now()+interval '180 days')`,[studentEmail,createHash('sha256').update(studentEmail).digest('hex'),pin.id,pin.offer_key,pin.version_number,pin.content_digest,pin.terms_snapshot]);
    if(claim===0) {
      await rows("update users set premium_source='paid',premium_until=now()+interval '365 days' where id=$1",[user.id]);
      await api('/api/admin/students','POST',{studentEmail,action:'extend',days:7},409);
      assert.equal((await rows('select premium_source from users where id=$1',[user.id]))[0].premium_source,'paid');
    }
    await rows("update users set premium_source='student',premium_until=now()+interval '180 days' where id=$1",[user.id]);
    await api('/api/admin/students','POST',{studentEmail,action:'extend',days:7});
    await api('/api/admin/students','POST',{studentEmail,action:'revoke'});
    await api('/api/admin/students','POST',{studentEmail,action:'release'});
    assert.equal((await rows('select count(*)::int n from student_claims where student_email=$1',[studentEmail]))[0].n,0);
  }
  assert.equal((await rows('select count(*)::int n from student_grants where student_email=$1',[studentEmail]))[0].n,2);
  console.log('PASS student extension, revocation, release and repeat-claim ledger compatibility');
  await api('/api/admin/social-rewards','PUT',{active:true,creditsPerPlatform:1,dailyMatchesDays:15,reviewRequired:true});
  assert.equal((await api('/api/admin/social-rewards')).config.review_required,true);
  assert.equal((await rows("select count(*)::int n from admin_actions where action='social_rewards_config' and staff_account_id=$1",[staff.id]))[0].n,1);
  console.log('PASS reward configuration and attributed audit persist together');
  await rows('update users set email_verified_at=now() where id=$1',[user.id]);
  const balanceBefore=(await rows('select credits from users where id=$1',[user.id]))[0].credits;
  const reviewClaims=[];
  for(const platform of ['x','linkedin']) reviewClaims.push((await rows("insert into social_reward_claims(user_id,platform,handle,credits_awarded,requested_credits,review_status) values($1,$2,$3,0,2,'pending') returning id",[user.id,platform,`qa-${run}-${platform}`]))[0]);
  const approval=await Promise.all([api('/api/admin/social-rewards','POST',{id:Number(reviewClaims[0].id),action:'approve'}),api('/api/admin/social-rewards','POST',{id:Number(reviewClaims[0].id),action:'approve'})]);
  assert.equal(approval.reduce((sum,result)=>sum+result.creditsAwarded,0),2);
  assert.equal((await rows('select credits from users where id=$1',[user.id]))[0].credits,balanceBefore+2);
  await api('/api/admin/social-rewards','POST',{id:Number(reviewClaims[1].id),action:'reject',note:'Local QA rejection'});
  await api('/api/admin/social-rewards','POST',{id:Number(reviewClaims[1].id),action:'approve'});
  assert.equal((await rows('select credits from users where id=$1',[user.id]))[0].credits,balanceBefore+2);
  assert.equal((await rows("select count(*)::int n from credit_events where kind='social_reward' and details->>'claimId'=$1",[String(reviewClaims[0].id)]))[0].n,1);
  console.log('PASS concurrent approval credits once; rejection and replay never award credits');
  if(!session.environment.localDevMode) {
    const password=randomBytes(24).toString('hex'); const salt=randomBytes(16).toString('hex');
    const hash=`${salt}:${scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex')}`;
    const claimant=(await rows("insert into users(email,password_hash,email_verified_at,credits) values($1,$2,now(),0) returning id",[`claim-${run}@example.test`,hash]))[0];
    const login=await fetch(new URL('/api/auth/login',base),{method:'POST',headers:{Origin:base.origin,'Content-Type':'application/json'},body:JSON.stringify({email:`claim-${run}@example.test`,password})});
    assert.equal(login.status,200); calls++;
    const userCookie=login.headers.get('set-cookie').split(';')[0];
    for(const platform of ['x','linkedin','instagram']) {
      const result=await api('/api/social-rewards/claim','POST',{platform,handle:`claim-${run}-${platform}`,followed:true},200,userCookie);
      assert.equal(result.reviewStatus,'pending'); assert.equal(result.creditsAwarded,0);
    }
    assert.equal((await rows('select credits from users where id=$1',[claimant.id]))[0].credits,0);
    const rewardStatus=await api('/api/social-rewards/status','GET',undefined,200,userCookie);
    assert.equal(rewardStatus.allClaimed,false); assert.equal(rewardStatus.pending.x,true); assert.equal(rewardStatus.claimed.x,false);
    assert.equal((await rows('select count(*)::int n from social_reward_bonus where user_id=$1',[claimant.id]))[0].n,0);
    console.log('PASS signed-in claims enter review without credits or bonus eligibility');
  }
  for(const path of ['/api/admin/users','/api/admin/premium','/api/admin/verify-email','/api/admin/campaigns','/api/admin/blog']) await api(path,'POST',null,400);
  await api(`/api/admin/support/${ticket.id}`,'POST',null,400);
  await api('/api/admin/settings','PUT',null,400);
  await api('/api/admin/settings','PUT',{limits:{freeMonthly:1}},400);
  await api('/api/admin/premium','POST',{email,action:'unknown',days:30},400);
  await api('/api/admin/verify-email','POST',{email,action:'unknown'},400);
  await api('/api/admin/campaigns','POST',{campaignId:'bad-uuid',action:'pause'},400);
  await api('/api/admin/blog','POST',{topic:'Synthetic local topic',today:'2026-02-30'},400);
  console.log('PASS malformed-body and explicit-action validation without state changes');

  const noticeFields={internalName:'Local QA',category:'product',preferenceCategory:'product_updates',audience:'all_authenticated',surface:'inbox',severity:'info',material:false,title:'Local test',body:'Disposable test notice',ctaLabel:null,ctaUrl:null,effectiveAt,expiresAt:null};
  const notice=await api('/api/admin/notifications','POST',{action:'create',publicationKey:`qa_${run}`,...noticeFields});
  await api('/api/admin/notifications','POST',{action:'update_draft',versionId:notice.version.id,...noticeFields});
  await api('/api/admin/notifications','POST',{action:'publish_now',versionId:notice.version.id,confirmation:'PUBLISH NOTICE'});
  assert.equal((await rows('select status from notification_publication_versions where id=$1',[notice.version.id]))[0].status,'published');
  console.log('PASS notification draft and publication');
  const communicationFields={internalName:'Local QA',communicationClass:'marketing',preferenceCategory:'product_updates',audience:'all_verified',subject:'Local QA',preheader:null,textBody:'Local QA only',htmlBody:'<p>Local QA only</p>',replyTo:null};
  await api('/api/admin/communications','POST',{action:'preview',...communicationFields});
  const campaign=await api('/api/admin/communications','POST',{action:'create',campaignKey:`qa_${run}`,...communicationFields});
  await api('/api/admin/communications','POST',{action:'update_draft',versionId:campaign.version.id,...communicationFields});
  for(const [action,confirmation,status] of [['activate_now','ACTIVATE CAMPAIGN','active'],['pause','PAUSE CAMPAIGN','paused'],['resume','RESUME CAMPAIGN','active'],['cancel','CANCEL CAMPAIGN','canceled']]) {
    await api('/api/admin/communications','POST',{action,versionId:campaign.version.id,confirmation});
    assert.equal((await rows('select status from communication_campaign_versions where id=$1',[campaign.version.id]))[0].status,status);
  }
  assert.equal((await rows('select count(*)::int n from communication_recipients'))[0].n,0);
  console.log('PASS communication preview, draft, activation, pause, resume and cancel without recipients or sending');
  const invitation=await api('/api/admin/staff','POST',{action:'invite',email:`invite-${run}@example.test`,role:'support'});
  const invitedId=invitation.staffAccountId;
  assert.ok(invitedId);
  await api('/api/admin/staff','POST',{action:'assign_role',staffAccountId:invitedId,role:'analyst',reason:'Local QA'});
  await api('/api/admin/staff','POST',{action:'revoke_role',staffAccountId:invitedId,role:'analyst',reason:'Local QA'});
  await api('/api/admin/staff','POST',{action:'revoke',staffAccountId:invitedId,reason:'Local QA'});
  assert.equal((await rows('select status from staff_accounts where id=$1',[invitedId]))[0].status,'revoked');
  console.log('PASS staff invitation, role assignment/revocation and account revocation');
  console.log(JSON.stringify({passed:true,requests:calls,fixtureRun:run}));
} finally { await pool.end(); }
