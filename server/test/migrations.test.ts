import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
const root=fileURLToPath(new URL('../../',import.meta.url));
const url=process.env.TEST_DATABASE_URL;
for(const source of ['empty','main','audit','phase-1'])test(`additive migration preserves ${source} database`,{skip:!url},async()=>{
  // A fresh, isolated schema in the explicitly selected test database; never reset/drop a schema.
  const schema='release_'+source.replaceAll('-','_')+'_'+randomBytes(5).toString('hex');
  const admin=new pg.Client({connectionString:url});await admin.connect();await admin.query(`CREATE SCHEMA "${schema}"`);await admin.end();
  const client=new pg.Client({connectionString:url,options:`-c search_path=${schema}`});await client.connect();
  const target=new URL(url!);target.searchParams.set('schema',schema);
  const cli=(mode:string)=>{
    const result=spawnSync(process.execPath,[path.join(root,'scripts/database.mjs'),mode],{cwd:root,env:{...process.env,DATABASE_URL:target.href,DIRECT_URL:target.href},encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  };
  try{
    if(source!=='empty'){
      const fixture=source==='main'?path.join(root,'server/prisma/migrations/0001_legacy/migration.sql'):path.join(root,`server/test/fixtures/${source}.sql`);
      await client.query(await readFile(fixture,'utf8'));
      await client.query(`INSERT INTO "User" (id,phone,password_hash,full_name,role,region,tin_or_passport,wallet_available) VALUES ('farmer','test-farmer','test-only','Legacy farmer','FARMER','Toshkent','test',45678),('buyer','test-buyer','test-only','Legacy buyer','BUYER_B2C','Toshkent','test',12345)`);
      await client.query(`INSERT INTO "Product" (id,farmer_id,title,category,price_per_kg,available_quantity_kg,min_order_kg,harvest_date,image_url,region) VALUES ('listing','farmer','Legacy listing','MEVALAR',18000,12.5,1,NOW(),'https://example.com/test.jpg','Toshkent')`);
      if(source==='phase-1')await client.query(`UPDATE "Product" SET unit='LITR',image_urls=ARRAY['https://example.com/test.jpg'],pickup_district='Parkent' WHERE id='listing'`);
      await client.query(`INSERT INTO "Order" (id,buyer_id,farmer_id,product_id,quantity_kg,product_total_amount,total_paid,platform_commission,farmer_payout,payment_method,status,delivery_address) VALUES ('order','buyer','farmer','listing',2.5,50000,65000,5000,45000,'INVOICE_B2B','PENDING_PAYMENT','Legacy address')`);
      if(source==='phase-1')await client.query(`UPDATE "Order" SET delivery_pin='0123',delivery_pin_attempts=2 WHERE id='order'`);
      if(source==='audit'){
        await client.query(`INSERT INTO "Conversation" (id,product_id,buyer_id,seller_id) VALUES ('chat','listing','buyer','farmer')`);
        await client.query(`INSERT INTO "Message" (id,client_id,conversation_id,sender_id,body) VALUES ('message','test-message','chat','buyer','Keep this conversation')`);
      }
      cli('baseline');
    }
    cli('migrate');cli('migrate'); // Re-running deployment must be safe.
    const columns=await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='Order'`,[schema]);
    for(const name of ['unit','product_title','unit_price_per_kg','delivery_pin','pickup_address'])assert.ok(columns.rows.some(r=>r.column_name===name));
    if(source!=='empty'){
      assert.equal((await client.query(`SELECT wallet_available FROM "User" WHERE id='farmer'`)).rows[0].wallet_available,45678);
      const order=(await client.query(`SELECT * FROM "Order" WHERE id='order'`)).rows[0];
      assert.equal(order.total_paid,65000);assert.equal(order.quantity_kg,2.5);assert.equal(order.product_title,'Legacy listing');assert.equal(order.unit_price_per_kg,20000);
      assert.equal(order.unit,source==='phase-1'?'LITR':'KG');
      if(source==='phase-1'){assert.equal(order.delivery_pin,'0123');assert.equal(order.delivery_pin_attempts,2);}
      if(source==='audit')assert.equal((await client.query(`SELECT body FROM "Message" WHERE id='message'`)).rows[0].body,'Keep this conversation');
      assert.equal((await client.query(`SELECT available_quantity_kg FROM "Product" WHERE id='listing'`)).rows[0].available_quantity_kg,12.5);
    }
    assert.equal((await client.query(`SELECT COUNT(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL`)).rows[0].count,2);
  }finally{await client.end();}
});
