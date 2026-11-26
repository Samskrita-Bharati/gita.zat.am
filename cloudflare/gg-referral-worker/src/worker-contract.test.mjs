import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import worker from './index.js';

/** HTTP-level contract test with mocked Google Auth, OAuth and Firestore REST.
 * No production credentials or Firebase project operations are used. */
test('new verified referral credits once and does not change game scores', async () => {
  const originalFetch = globalThis.fetch;
  const originalCrypto = globalThis.crypto;
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const env = {
    FIREBASE_PROJECT_ID: 'gg-zatam', FIREBASE_WEB_API_KEY: 'fake-test-key',
    ALLOWED_ORIGIN: 'https://gg.zat.am',
    SERVICE_ACCOUNT_JSON: JSON.stringify({
      project_id: 'gg-zatam',client_email: 'referral-test@gg-zatam.iam.gserviceaccount.com',
      private_key: privateKey.export({ type:'pkcs8', format:'pem' }),
    }),
  };
  const records = new Map();
  let sequence = 1;
  const created = String(Date.now()-3000);
  const accounts = {
    inviter: {localId:'inviter',emailVerified:true,createdAt:String(Date.now()-86400000),displayName:'Inviter'},
    newcomer: {localId:'newcomer',emailVerified:false,createdAt:created,displayName:'Newcomer'},
    old: {localId:'old',emailVerified:true,createdAt:String(Date.now()-86400000),displayName:'Existing'},
  };
  const response = (payload, status=200) => new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json'}});
  function docResult(path) { const doc = records.get(path);return doc ? response(doc):response({error:{message:'not found'}},404); }
  function fromDocumentFields(data) { return data.fields || {}; }
  globalThis.fetch = async (address, options={}) => {
    const url = new URL(address);
    if (url.hostname === 'oauth2.googleapis.com') return response({access_token:'fake-oauth-token',expires_in:3600});
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      const {idToken} = JSON.parse(options.body);
      const account = accounts[idToken];
      return account ? response({users:[account]}) : response({error:'invalid token'},400);
    }
    if (url.hostname !== 'firestore.googleapis.com') throw new Error(`unexpected URL: ${url}`);
    if (url.pathname.endsWith(':beginTransaction')) return response({transaction:'fake-transaction'});
    if (url.pathname.endsWith(':runQuery')) {
      const docs = [...records.values()].filter((d) => d.name.includes('/referralStats/') && Number(d.fields.referralCount.integerValue)>0);
      docs.sort((a,b)=>Number(b.fields.referralCount.integerValue)-Number(a.fields.referralCount.integerValue));
      return response(docs.slice(0,10).map((document)=>({document})));
    }
    if (url.pathname.endsWith(':commit')) {
      const {writes} = JSON.parse(options.body);
      for (const write of writes) {
        const prior = records.get(write.update.name);
        if (write.currentDocument?.exists === false && prior) return response({error:{message:'already exists'}},409);
        if (write.currentDocument?.updateTime !== undefined && prior?.updateTime !== write.currentDocument.updateTime) return response({error:{message:'stale version'}},409);
      }
      for (const write of writes) {
        const update = write.update;
        const prior = records.get(update.name);
        const originalFields = prior?.fields || {};
        const nextFields = write.updateMask ? {...originalFields,...update.fields} : fromDocumentFields(update);
        records.set(update.name,{name:update.name,fields:nextFields,updateTime:new Date(Date.now()+sequence++*1000).toISOString()});
      }
      return response({writeResults:writes.map(()=>({}))});
    }
    if (url.pathname.includes('/documents/')) {
      const documentId = decodeURIComponent(url.pathname.slice(url.pathname.indexOf('/documents/')+'/documents/'.length));
      return docResult(`projects/gg-zatam/databases/(default)/documents/${documentId}`);
    }
    throw new Error(`unexpected firestore operation: ${url.pathname}`);
  };
  async function request(path, token, data) {
    const method = data === undefined ? 'GET':'POST';
    const req = new Request(`https://referrals.example/api/${path}`, {
      method,
      headers:{Origin:'https://gg.zat.am',Authorization:`Bearer ${token}`, ...(data ? {'content-type':'application/json'}:{})},
      ...(data ? {body:JSON.stringify(data)}:{}),
    });
    const reply = await worker.fetch(req,env,{});
    return {status:reply.status,data:await reply.json()};
  }
  try {
    const initial = await request('code','inviter',{});
    assert.equal(initial.status,200);
    const code = initial.data.referralCode;
    assert.equal(code.length,8);
    assert.equal((await request('code','inviter',{})).data.referralCode,code);
    assert.equal((await request('claim','old',{code})).status,403,'old accounts cannot claim');
    assert.equal((await request('claim','newcomer',{code})).data.status,'pending');
    assert.equal((await request('confirm','newcomer',{})).data.status,'not-verified');
    assert.equal((await request('me','inviter')).data.referralCount,0);
    accounts.newcomer.emailVerified = true;
    assert.equal((await request('confirm','newcomer',{})).data.status,'confirmed');
    assert.equal((await request('confirm','newcomer',{})).data.status,'confirmed');
    assert.equal((await request('me','inviter')).data.referralCount,1,'retries must not double-credit');
    const leaderboard = await request('leaderboard','inviter');
    assert.deepEqual(leaderboard.data.players.map((p)=>p.referralCount),[1]);
    assert.equal([...records.keys()].filter((key)=>key.includes('/leaderboards/')).length,0,'game score data must not change');
    const bad = await request('claim','newcomer',{code:'INVALID1'});
    assert.equal(bad.status,400);
    const wrongOrigin = await worker.fetch(new Request('https://referrals.example/api/me',{headers:{Origin:'https://bad.example', Authorization:'Bearer inviter'}}),env,{});
    assert.equal(wrongOrigin.status,403);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
