import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { sendMail } from "../lib/email";
import {
  activateScheduledCommunicationVersions,
  claimCommunicationBatch,
  communicationRuntimeControl,
  reserveCommunicationThrottle,
  completeCommunicationAttempt,
  communicationEmailFingerprint,
  createCommunicationUnsubscribeToken,
  releaseCommunicationClaim,
  startCommunicationAttempt,
  type ClaimedCommunication,
} from "../lib/communications";

const owner=`communications:${process.pid}:${randomUUID()}`;

function receipt(value:string){return createHash("sha256").update(value).digest("hex");}
function localSinkDirectory(){
  const directory=process.env.COMMUNICATIONS_LOCAL_SINK_DIR?.trim()??"";
  if(process.env.COMMUNICATIONS_LOCAL_SINK_ENABLED!=="true")throw new Error("communications_local_sink_not_enabled");
  if(!isAbsolute(directory))throw new Error("communications_local_sink_dir_must_be_absolute");
  return resolve(directory);
}
async function localSink(message:ClaimedCommunication){
  const directory=localSinkDirectory(); await mkdir(directory,{recursive:true,mode:0o750});
  const event={schema:"rolesharp-communications-sink-v1",recipientId:message.recipientId,recipientHash:receipt(message.to),subjectHash:receipt(message.subject),textHash:receipt(message.text),htmlHash:receipt(message.html),textBytes:Buffer.byteLength(message.text),htmlBytes:Buffer.byteLength(message.html)};
  await appendFile(resolve(directory,"events.jsonl"),`${JSON.stringify(event)}\n`,{encoding:"utf8",mode:0o640});
  return {status:"queued" as const,messageIdHash:receipt(`local:${message.recipientId}`)};
}
async function provider(message:ClaimedCommunication){
  const token=message.preferenceCategory==="essential"?null:createCommunicationUnsubscribeToken({fingerprint:communicationEmailFingerprint(message.to),category:message.preferenceCategory});
  const unsubscribe=token?`${process.env.SITE_URL??"https://rolesharp.com"}/api/communications/unsubscribe?token=${encodeURIComponent(token)}`:null;
  const text=unsubscribe?`${message.text}\n\nUnsubscribe: ${unsubscribe}`:message.text;
  const html=unsubscribe?`${message.html}<p><a href="${unsubscribe.replaceAll("&","&amp;").replaceAll('"',"&quot;")}">Unsubscribe</a></p>`:message.html;
  const status=await sendMail({to:message.to,subject:message.subject,text,html,replyTo:message.replyTo??undefined,type:"campaign"});
  return {status,messageIdHash:null};
}
async function deliver(message:ClaimedCommunication,transport:"local_sink"|"provider"){
  const attemptId=await startCommunicationAttempt(message.recipientId,owner,transport); if(!attemptId)return;
  try{
    const result=transport==="local_sink"?await localSink(message):await provider(message);
    await completeCommunicationAttempt({recipientId:message.recipientId,outcome:"provider_accepted",receiptHash:receipt(`rolesharp-communications-receipt-v1:${attemptId}:${result.status}`),providerMessageIdHash:result.messageIdHash,providerCategory:result.status});
  }catch(error){
    await completeCommunicationAttempt({recipientId:message.recipientId,outcome:"unknown",providerCategory:error instanceof Error?error.name:"unknown_error"});
  }
}
async function main(){
  await activateScheduledCommunicationVersions();
  const control=await communicationRuntimeControl();
  if(control.globallyPaused||control.transportMode==="disabled"){console.log("communications outbox disabled or globally paused");return;}
  if(control.transportMode==="local_sink")localSinkDirectory();
  const batch=await claimCommunicationBatch(owner,control.maxBatchSize);
  for(const message of batch){
    if(!(await reserveCommunicationThrottle())){await releaseCommunicationClaim(message.recipientId,owner);continue;}
    await deliver(message,control.transportMode);
  }
  console.log(`communications outbox complete; claimed=${batch.length}; transport=${control.transportMode}`);
}
main().catch((error)=>{console.error("[communications-outbox] failed",error instanceof Error?error.name:"unknown_error");process.exitCode=1;});
