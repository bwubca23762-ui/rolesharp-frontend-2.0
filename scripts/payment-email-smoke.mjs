// Real webhook/database/SMTP path, restricted to the disposable local fixture.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import pg from 'pg';
const pool=new pg.Pool({connectionString:'postgresql://rolesharp_qa@127.0.0.1:54381/rolesharp_admin_qa'});
const messages=[];
const smtp=createServer(socket=>{
  socket.setEncoding('utf8'); socket.write('220 localhost QA SMTP\r\n');
  let buffer='', data=false;
  socket.on('data',chunk=>{
    buffer+=chunk;
    while(true){
      if(data){const end=buffer.indexOf('\r\n.\r\n');if(end<0)return;messages.push(buffer.slice(0,end));buffer=buffer.slice(end+5);data=false;socket.write('250 accepted locally\r\n');continue;}
      const end=buffer.indexOf('\r\n');if(end<0)return;
      const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
      if(/^(EHLO|HELO)/i.test(line))socket.write('250 localhost\r\n');
      else if(/^DATA/i.test(line)){data=true;socket.write('354 end with dot\r\n');}
      else if(/^QUIT/i.test(line)){socket.end('221 bye\r\n');return;}
      else socket.write('250 OK\r\n');
    }
  });
});
await new Promise((resolve,reject)=>{smtp.once('error',reject);smtp.listen(25281,'127.0.0.1',resolve);});
const user=randomUUID(),order=`monthly_${user}_${randomUUID()}`;
const canonical=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));
const payload={order_id:order,payment_id:randomUUID(),payment_status:'finished',price_amount:12,price_currency:'usd',pay_currency:'usdt'};
async function callback(body,valid=true,status=200){
 const raw=JSON.stringify(body),signature=valid?createHmac('sha512','isolated-ipn-test-only').update(JSON.stringify(canonical(body))).digest('hex'):'invalid';
 const response=await fetch('http://127.0.0.1:34105/api/pay/crypto/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-nowpayments-sig':signature},body:raw,signal:AbortSignal.timeout(60000)});
 assert.equal(response.status,status,await response.text());
}
try {
 await pool.query('insert into users(id,email) values($1,$2)',[user,`payment-${user}@example.test`]);
 await pool.query("insert into crypto_payments(id,order_id,user_id_text,status,price_amount,plan,days) values($1,$2,$3,'waiting',12,'monthly',30)",[randomUUID(),order,user]);
 await callback(payload,false,400);
 await callback({...payload,price_amount:1},true,400);
 assert.equal((await pool.query('select premium_until from users where id=$1',[user])).rows[0].premium_until,null);
 await callback(payload);
 const first=(await pool.query('select premium_until,premium_source from users where id=$1',[user])).rows[0];
 assert.equal(first.premium_source,'paid');assert.ok(first.premium_until>new Date());
 await Promise.all([callback(payload),callback(payload)]);
 const last=(await pool.query('select premium_until from users where id=$1',[user])).rows[0];
 assert.equal(last.premium_until.toISOString(),first.premium_until.toISOString());
 await callback({...payload,payment_status:'waiting'});
 assert.equal((await pool.query('select status from crypto_payments where order_id=$1',[order])).rows[0].status,'finished','A delayed waiting callback must not downgrade a paid receipt');
 await callback({...payload,price_amount:1},true,400);
 assert.equal((await pool.query('select status from crypto_payments where order_id=$1',[order])).rows[0].status,'finished','A mismatched retry must not invalidate an already paid receipt');
 assert.equal(messages.length,1,'Only one receipt may be sent for repeated callbacks');
 assert.match(messages[0],/invoice/i);assert.match(messages[0],/payment-/);
 console.log(JSON.stringify({passed:true,invalidSignatureRejected:true,incorrectAmountRejected:true,premiumGrantedOnce:true,duplicateCallbacks:2,outOfOrderStatusPreserved:true,localInvoiceEmails:messages.length}));
} finally {await pool.end();await new Promise(resolve=>smtp.close(resolve));}
