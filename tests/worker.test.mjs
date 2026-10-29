import worker from "../worker/index.js";
let GOLD_HTML=null; let TAKEN=0, META=null, CREATED=0, EMAIL="A@Gmail.com", SUBS=[], CUSTS=[{id:"cus_1"}], TOKEN_OK=true, AUD="963989611279-0u4vll2sfmqfrvio5c199ug0oo8sfu9h.apps.googleusercontent.com", posted=[];
globalThis.fetch=async(url,opt={})=>{ const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s});
  if(url.startsWith("https://oauth2.googleapis.com/tokeninfo")) return TOKEN_OK?J({aud:AUD,email:EMAIL,email_verified:"true",expires_in:"3000"}):J({error:"invalid"},400);
  if(url.includes("/v1/prices/")) return J({unit_amount:url.endsWith("price_r")?29900:url.endsWith("price_m")?9900:19900,currency:"thb"});
  if(url.includes("/v1/subscriptions?limit=100&status=")) return J({data:url.includes("status=active")?Array(TAKEN).fill({}):[],has_more:false});
  if(url.includes("/v1/customers?")) return J({data:CUSTS});
  if(url.endsWith("/v1/customers")&&opt.method==="POST"){ CREATED++; return J({id:"cus_new"}); }
  if(url.includes("/v1/customers/")&&opt.method==="POST"){ META=opt.body; return J({}); }
  if(url.includes("/v1/subscriptions?")) return J({data:SUBS});
  if(url.includes("/v1/checkout/sessions")){ posted.push(opt.body); return J({url:"https://checkout.stripe.com/c/x"}); }
  if(url.includes("/v1/billing_portal/sessions")) return J({url:"https://billing.stripe.com/p/x"});
  if(url.startsWith("https://classic.goldtraders.or.th/")) return GOLD_HTML===null?new Response("down",{status:500}):new Response(GOLD_HTML);
  return J({},404); };
const ASSETS={fetch:async r=>new Response("asset:"+new URL(r.url).pathname)};
async function call(name,{method="GET",auth="Bearer t",host="money.flowlytix.co",body}={},env={}){
  const r=await worker.fetch(new Request(`https://${host}/api/${name.replace(".js","")}`,{method,headers:auth?{authorization:auth}:{},body}),{...env,ASSETS});
  const t=await r.text(); return {status:r.status,body:JSON.parse(t)}; }
const ON={PAYWALL:"on",STRIPE_SECRET_KEY:"sk_test_x",STRIPE_PRICE_ID:"price_1"};
const sub=(status,price="price_1",end=1900000000,cancel=false)=>({status,cancel_at_period_end:cancel,items:{data:[{price:{id:price},current_period_end:end}]}});
const out=[]; const t=async(n,p,exp)=>{ const r=await p; out.push((exp(r)?"PASS ":"FAIL ")+n); };
await t("no token -> 401",call("licence.js",{auth:""},ON),r=>r.status===401);
TOKEN_OK=false; await t("bad token -> 401",call("licence.js",{},ON),r=>r.status===401); TOKEN_OK=true;
AUD="other-app"; await t("token for another app -> 401",call("licence.js",{},ON),r=>r.status===401); AUD="963989611279-0u4vll2sfmqfrvio5c199ug0oo8sfu9h.apps.googleusercontent.com";
await t("paywall off -> beta",call("licence.js",{},{}),r=>r.body.plan==="beta"&&r.body.paywall===false);
SUBS=[]; await t("no sub -> free",call("licence.js",{},ON),r=>r.body.plan==="free");
SUBS=[sub("active")]; await t("active -> pro",call("licence.js",{},ON),r=>r.body.plan==="pro"&&r.body.periodEnd===1900000000);
SUBS=[sub("active","price_other")]; await t("other product ignored -> free",call("licence.js",{},ON),r=>r.body.plan==="free");
SUBS=[sub("canceled",undefined,1700000000),sub("active",undefined,1900000000,true)]; await t("cancel at end still pro",call("licence.js",{},ON),r=>r.body.plan==="pro"&&r.body.cancelAtEnd===true);
SUBS=[Object.assign(sub("active",undefined,1900000000,false),{cancel_at:1880000000})]; await t("cancel_at -> pro until that date",call("licence.js",{},ON),r=>r.body.plan==="pro"&&r.body.cancelAtEnd===true&&r.body.periodEnd===1880000000);
SUBS=[sub("past_due")]; await t("past_due grace -> pro",call("licence.js",{},ON),r=>r.body.plan==="pro"&&r.body.status==="past_due");
SUBS=[sub("unpaid")]; await t("unpaid -> free",call("licence.js",{},ON),r=>r.body.plan==="free");
await t("missing stripe key -> 503",call("licence.js",{},{PAYWALL:"on"}),r=>r.status===503);
SUBS=[]; await t("checkout -> url",call("checkout.js",{method:"POST"},ON),r=>r.body.url&&posted.at(-1).includes("customer=cus_1")&&posted.at(-1).includes("mode=subscription")&&posted.at(-1).includes(encodeURIComponent("https://money.flowlytix.co/?upgraded=1")));
CUSTS=[]; await t("checkout new customer uses email",call("checkout.js",{method:"POST"},ON),r=>r.body.url&&posted.at(-1).includes("customer_email=a%40gmail.com")); CUSTS=[{id:"cus_1"}];
SUBS=[sub("active")]; await t("checkout when already pro -> 409",call("checkout.js",{method:"POST"},ON),r=>r.status===409);
await t("checkout paywall off -> billing_off",call("checkout.js",{method:"POST"},{}),r=>r.body.error==="billing_off");
await t("checkout GET -> 405",call("checkout.js",{},ON),r=>r.status===405);
await t("portal -> url",call("portal.js",{method:"POST"},ON),r=>r.body.url);
CUSTS=[]; await t("portal no customer -> 404",call("portal.js",{method:"POST"},ON),r=>r.status===404);
SUBS=[]; for(const e of ["Flowlytix@gmail.com","aronsodacan@gmail.com"]){ EMAIL=e; await t("owner "+e+" -> pro",call("licence.js",{},{PAYWALL:"on"}),r=>r.body.plan==="pro"&&r.body.status==="complimentary");
  await t("owner "+e+" checkout -> 409",call("checkout.js",{method:"POST"},ON),r=>r.status===409); }
EMAIL="friend@x.com"; await t("PRO_EMAILS adds more",call("licence.js",{},{...ON,PRO_EMAILS:" Friend@x.com ,b@y.com"}),r=>r.body.status==="complimentary");
EMAIL="someone@x.com"; await t("other email still free",call("licence.js",{},ON),r=>r.body.plan==="free");

// ---- free trial, founding places, pricing, feedback ----
EMAIL="new@x.com"; CUSTS=[]; SUBS=[]; TAKEN=0;
await t("new person: trial offered (30 days by default)",call("licence.js",{},ON),r=>r.body.plan==="free"&&r.body.trialEligible===true&&r.body.trialDays===30);
await t("checkout gives 30-day trial, no card needed, ends if no card",call("checkout.js",{method:"POST"},ON),r=>{const b=posted.at(-1); return r.body.url&&b.includes("subscription_data%5Btrial_period_days%5D=30")&&b.includes("payment_method_collection=if_required")&&b.includes("missing_payment_method%5D=cancel");});
await t("trial checkout: return page told it was a trial",call("checkout.js",{method:"POST"},ON),r=>posted.at(-1).includes(encodeURIComponent("&px=trial&cur=THB")));
await t("TRIAL_DAYS=0 switches trial off",call("checkout.js",{method:"POST"},{...ON,TRIAL_DAYS:"0"}),r=>!posted.at(-1).includes("trial_period_days"));
CUSTS=[{id:"cus_1"}]; SUBS=[sub("canceled",undefined,1700000000)];
await t("had a subscription before: no second trial",call("licence.js",{},ON),r=>r.body.plan==="free"&&r.body.trialEligible===false);
await t("checkout for returning person has no trial",call("checkout.js",{method:"POST"},ON),r=>r.body.url&&!posted.at(-1).includes("trial_period_days"));
await t("paid checkout: return page told the ฿199 price",call("checkout.js",{method:"POST"},ON),r=>posted.at(-1).includes(encodeURIComponent("&px=199&cur=THB")));
SUBS=[Object.assign(sub("trialing",undefined,1900000000),{trial_end:1900000000,default_payment_method:null})];
await t("in trial: Pro, shows trial end and that a card is needed",call("licence.js",{},ON),r=>r.body.plan==="pro"&&r.body.status==="trialing"&&r.body.trialEnd===1900000000&&r.body.needsCard===true);
SUBS=[Object.assign(sub("trialing",undefined,1900000000),{trial_end:1900000000,default_payment_method:"pm_1"})];
await t("in trial with card added: no card warning",call("licence.js",{},ON),r=>r.body.needsCard===false);
const R={...ON,STRIPE_PRICE_REGULAR:"price_r"};
CUSTS=[]; SUBS=[]; TAKEN=37;
await t("pricing: 63 of 100 founding places left, founding price now",call("pricing.js",{auth:""},R),r=>r.body.foundingLeft===63&&r.body.current==="founding"&&r.body.founding.amount===199&&r.body.regular.amount===299&&r.body.trialDays===30&&r.body.monthly===null);
await t("checkout uses founding price while places are left",call("checkout.js",{method:"POST"},R),r=>posted.at(-1).includes("line_items%5B0%5D%5Bprice%5D=price_1")&&posted.at(-1).includes("tier%5D=founding"));
TAKEN=100;
await t("pricing: founding full -> regular price",call("pricing.js",{auth:""},R),r=>r.body.foundingLeft===0&&r.body.current==="regular");
await t("checkout uses regular ฿299 price once 100 are taken",call("checkout.js",{method:"POST"},R),r=>posted.at(-1).includes("line_items%5B0%5D%5Bprice%5D=price_r")&&posted.at(-1).includes("tier%5D=regular"));
CUSTS=[{id:"cus_1"}]; SUBS=[sub("canceled",undefined,1700000000)]; await t("paid checkout on regular price: return page told ฿299",call("checkout.js",{method:"POST"},R),r=>posted.at(-1).includes(encodeURIComponent("&px=299&cur=THB"))); CUSTS=[]; SUBS=[];
CUSTS=[{id:"cus_1"}]; SUBS=[sub("active","price_1")];
await t("founding member stays Pro on ฿199 after places run out",call("licence.js",{},R),r=>r.body.plan==="pro"&&r.body.tier==="founding");
SUBS=[sub("active","price_r")];
await t("regular-price member is Pro too",call("licence.js",{},R),r=>r.body.plan==="pro"&&r.body.tier==="regular");
// pay by the month, and old prices kept
const RM={...R,STRIPE_PRICE_MONTHLY:"price_m"}; CUSTS=[]; SUBS=[]; TAKEN=100;
await t("pricing shows the monthly price",call("pricing.js",{auth:""},RM),r=>r.body.monthly.amount===99&&r.body.current==="regular");
await t("checkout billing=month uses the monthly price",call("checkout.js",{method:"POST",body:JSON.stringify({billing:"month"})},RM),r=>posted.at(-1).includes("line_items%5B0%5D%5Bprice%5D=price_m")&&posted.at(-1).includes("tier%5D=monthly"));
await t("checkout billing=year uses the yearly price",call("checkout.js",{method:"POST",body:JSON.stringify({billing:"year"})},RM),r=>posted.at(-1).includes("line_items%5B0%5D%5Bprice%5D=price_r"));
await t("billing=month without a monthly price falls back to yearly",call("checkout.js",{method:"POST",body:JSON.stringify({billing:"month"})},R),r=>posted.at(-1).includes("line_items%5B0%5D%5Bprice%5D=price_r"));
CUSTS=[{id:"cus_1"}]; SUBS=[sub("active","price_m")];
await t("monthly member is Pro",call("licence.js",{},RM),r=>r.body.plan==="pro"&&r.body.tier==="monthly");
SUBS=[sub("active","price_old")];
await t("old ฿199 price is ignored unless listed",call("licence.js",{},RM),r=>r.body.plan==="free");
await t("old price listed in STRIPE_PRICE_LEGACY stays Pro (founding)",call("licence.js",{},{...RM,STRIPE_PRICE_LEGACY:"price_old, price_x"}),r=>r.body.plan==="pro"&&r.body.tier==="founding");
CUSTS=[]; SUBS=[]; TAKEN=20;
await t("old-price members count towards founding places",call("pricing.js",{auth:""},{...R,STRIPE_PRICE_LEGACY:"price_old"}),r=>r.body.foundingLeft===60);
TAKEN=0;
await t("no regular price set: founding forever, no counter",call("pricing.js",{auth:""},ON),r=>r.body.current==="founding"&&r.body.foundingLeft===null);
await t("pricing works without sign-in, not when Stripe missing",call("pricing.js",{auth:""},{PAYWALL:"on"}),r=>r.body.configured===false);
// feedback
CUSTS=[{id:"cus_1"}]; META=null;
await t("feedback saved on the Stripe customer",call("feedback.js",{method:"POST",body:JSON.stringify({rating:4,comment:"  Love the  overview ",context:"trial-day5"})},ON),r=>r.body.ok&&META.includes("feedback_rating%5D=4")&&META.includes("feedback_comment%5D=Love+the+overview"));
await t("feedback needs a 1-5 rating",call("feedback.js",{method:"POST",body:JSON.stringify({rating:9})},ON),r=>r.status===400);
await t("feedback needs sign-in",call("feedback.js",{method:"POST",auth:"",body:"{}"},ON),r=>r.status===401);
CUSTS=[]; CREATED=0;
await t("feedback from someone with no Stripe record creates one",call("feedback.js",{method:"POST",body:JSON.stringify({rating:5})},ON),r=>r.body.ok&&CREATED===1);
const red=await worker.fetch(new Request("https://finance.flowlytix.co/pro?x=1"),{ASSETS}); out.push((red.status===308&&red.headers.get("location")==="https://money.flowlytix.co/pro?x=1"?"PASS ":"FAIL ")+"old domain redirects");
const as=await worker.fetch(new Request("https://money.flowlytix.co/pro"),{ASSETS}); out.push(((await as.text())==="asset:/pro"?"PASS ":"FAIL ")+"pages go to static files");
// Google Analytics tag: added to HTML pages only. HTMLRewriter is Cloudflare-only, so a small stand-in appends before </head>.
globalThis.HTMLRewriter=class{ on(s,h){ this.h=h; return this; } transform(r){ let add=""; this.h.element({append:x=>{add+=x;}}); return new Response(new ReadableStream({ async start(c){ c.enqueue(new TextEncoder().encode((await r.text()).replace("</head>",add+"</head>"))); c.close(); } }),r); } };
const HTML={fetch:async r=>new URL(r.url).pathname.endsWith(".css")?new Response("</head>",{headers:{"content-type":"text/css"}}):new URL(r.url).pathname==="/old"?new Response(null,{status:304,headers:{"content-type":"text/html"}}):new Response("<html><head><title>x</title></head><body></body></html>",{headers:{"content-type":"text/html; charset=utf-8"}})};
for(const p of ["/","/pro"]){ const g=await worker.fetch(new Request("https://money.flowlytix.co"+p),{ASSETS:HTML}); const h=await g.text();
  out.push((h.split("googletagmanager.com/gtag/js?id=G-NLH48XC1WE").length===2&&h.includes("gtag('config','G-NLH48XC1WE')")&&h.indexOf("gtag/js")<h.indexOf("</head>")&&g.headers.get("content-security-policy").includes("https://*.google-analytics.com")?"PASS ":"FAIL ")+"GA4 tag in <head> of "+p+", CSP allows it"); }
for(const p of ["/","/pro"]){ const g=await worker.fetch(new Request("https://money.flowlytix.co"+p),{ASSETS:HTML}); const h=await g.text(), csp=g.headers.get("content-security-policy");
  out.push((h.split("gtm.js?id='+i+dl").length===2&&h.includes("'dataLayer','GTM-T26BBPLW'")&&h.indexOf("gtm.js")<h.indexOf("</head>")&&h.indexOf("gtag/js")<h.indexOf("gtm.js")&&csp.includes("https://tagmanager.google.com")?"PASS ":"FAIL ")+"GTM container in <head> of "+p+", after GA4, CSP allows preview"); }
const css=await worker.fetch(new Request("https://money.flowlytix.co/a.css"),{ASSETS:HTML}); out.push(((await css.text())==="</head>"?"PASS ":"FAIL ")+"GA4 tag not added to non-HTML files");
const nm=await worker.fetch(new Request("https://money.flowlytix.co/old"),{ASSETS:HTML}); out.push((nm.status===304?"PASS ":"FAIL ")+"GA4: 304 Not Modified passes through");
// fund prices (worker/funds.js): signed-in only, fund codes in, latest NAV out; the SEC key never leaves the server
const secCalls=[]; const prevFetch=globalThis.fetch;
globalThis.fetch=async(url,opt={})=>{ url=String(url); if(!url.startsWith("https://api.sec.or.th/")) return prevFetch(url,opt);
  const u=new URL(url), proj=u.searchParams.get("proj_id"); secCalls.push({u,key:opt.headers&&opt.headers["Ocp-Apim-Subscription-Key"]});
  const J=o=>new Response(JSON.stringify(o),{status:200});
  if(proj==="M0002_2560") return new Response("down",{status:500});
  if(proj==="M0003_2561") return new Response(null,{status:204});
  if(proj==="M0004_2562"&&!u.searchParams.get("next_cursor")) return J({items:[{fund_class_name:"main",nav_date:"2026-10-01",last_val:10}],next_cursor:"p2"});
  if(proj==="M0004_2562") return J({items:[{fund_class_name:"main",nav_date:"2026-10-09",last_val:11}]});
  return J({items:[{fund_class_name:"HIDIV-D",nav_date:"2026-10-14",last_val:7.5},{fund_class_name:"HIDIV-D",nav_date:"2026-10-15",last_val:7.6},{fund_class_name:"HIDIV-AR",nav_date:"2026-10-16",last_val:9.9},{fund_class_name:"main",nav_date:"2026-10-15",last_val:27.92}]}); };
const F={SEC_API_KEY:"sec-secret-1"};
const nav=(q,o={},env=F)=>call("funds/nav?"+q,o,env);
await t("fund prices need sign-in",nav("f=M0000_2552:HIDIV-D",{auth:""}),r=>r.status===401);
await t("fund prices off until the SEC key is set",nav("f=M0000_2552:HIDIV-D",{},{}),r=>r.status===503&&r.body.error==="funds_not_configured");
await t("newest NAV for that share class only",nav("f=M0000_2552:HIDIV-D"),r=>r.status===200&&r.body.prices["M0000_2552:HIDIV-D"].nav===7.6&&r.body.prices["M0000_2552:HIDIV-D"].date==="2026-10-15");
await t("single-class funds (main)",nav("f=M0001_2540:main"),r=>r.body.prices["M0001_2540:main"].nav===27.92);
await t("class name sent to the SEC, not for main",Promise.resolve(),()=>secCalls.some(c=>c.u.searchParams.get("fund_class_name")==="HIDIV-D")&&!secCalls.some(c=>c.u.searchParams.get("proj_id")==="M0001_2540"&&c.u.searchParams.has("fund_class_name")));
secCalls.length=0;
await t("price on a past date (month end)",nav("f=M0000_2552:HIDIV-D&on=2026-09-30"),r=>r.body.on==="2026-09-30"&&secCalls[0].u.searchParams.get("end_nav_date")==="2026-09-30"&&secCalls[0].u.searchParams.get("start_nav_date")==="2026-09-16");
await t("SEC key goes to the SEC only, never back",nav("f=M0000_2552:HIDIV-D"),async r=>secCalls.every(c=>c.key==="sec-secret-1")&&!JSON.stringify(r.body).includes("sec-secret"));
await t("one fund failing doesn't break the others",nav("f=M0002_2560:main,M0000_2552:HIDIV-D"),r=>r.status===200&&r.body.prices["M0002_2560:main"]===null&&r.body.prices["M0000_2552:HIDIV-D"].nav===7.6);
await t("no recent price -> null",nav("f=M0003_2561:main"),r=>r.body.prices["M0003_2561:main"]===null);
await t("follows the SEC's next page",nav("f=M0004_2562:main"),r=>r.body.prices["M0004_2562:main"].nav===11&&r.body.prices["M0004_2562:main"].date==="2026-10-09");
await t("bad fund id refused",nav("f=../../x"),r=>r.status===400&&r.body.error==="fund_id");
await t("too many funds refused",nav("f="+Array.from({length:13},(_,i)=>"M"+String(1000+i)+"_2560:main").join(",")),r=>r.status===400);
await t("future date refused",nav("f=M0000_2552:HIDIV-D&on=2999-01-01"),r=>r.status===400&&r.body.error==="date");
await t("only GET",nav("f=M0000_2552:HIDIV-D",{method:"POST"}),r=>r.status===405);
globalThis.fetch=prevFetch;

// ---- survey (survey.flowlytix.co): a real SQLite database standing in for Cloudflare D1 ----
const { DatabaseSync } = await import("node:sqlite");
const SQL = new DatabaseSync(":memory:");
const FAKE_DB = { prepare: sql => { const mk = v => ({ run: async () => { SQL.prepare(sql).run(...v); return {}; }, all: async () => ({ results: SQL.prepare(sql).all(...v) }), first: async () => SQL.prepare(sql).get(...v) ?? null });
  return { bind: (...v) => mk(v), ...mk([]) }; } };
const SV = { SURVEY_DB: FAKE_DB, GOOGLE_CLIENT_SECRET: "gcs-test" };
const ROW = () => SQL.prepare("SELECT * FROM responses ORDER BY id DESC LIMIT 1").get();
const COUNT = () => SQL.prepare("SELECT COUNT(*) n FROM responses").get().n;
const svPost=(b,env=SV,host="survey.flowlytix.co")=>worker.fetch(new Request(`https://${host}/api/survey`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}),{...env,ASSETS}).then(async r=>({status:r.status,body:await r.json()}));
await t("survey answer saved",svPost({product:"money",page:"plan",plan:"trial",lang:"th",device:"phone",csat:4,nps:9,ease:3,helps:["bills","plan","Bad Key!",7],hard:"x",improve:"y",email:"me@x.co"}),r=>{ const x=ROW(); return r.status===200&&x.product==="money"&&x.helps==="bills,plan"&&x.csat===4&&x.verified===0; });
await t("survey: no rating at all refused",svPost({product:"money",hard:"spam"}),r=>r.status===400&&COUNT()===1);
await t("survey: bot field refused",svPost({csat:5,website_url:"http://spam"}),r=>r.status===400&&COUNT()===1);
await t("survey: out-of-range and unknown values cleaned",svPost({product:"evil",csat:9,nps:10,ease:0,email:"not-an-email",lang:"xx"}),r=>{ const x=ROW(); return r.status===200&&x.product==="other"&&x.csat===null&&x.nps===10&&x.ease===null&&x.email===""&&x.lang==="en"; });
await t("survey: long text cut to 1,000",svPost({csat:3,hard:"a".repeat(5000)}),r=>r.status===200&&ROW().hard.length===1000);
await t("survey: no database -> 503",svPost({csat:3},{}),r=>r.status===503&&r.body.error==="survey_not_configured");
await t("survey: GET refused",worker.fetch(new Request("https://survey.flowlytix.co/api/survey"),{...SV,ASSETS}),r=>r.status===405);
// tickets, reviews, public rating
globalThis.fetch=async(url)=>url.startsWith("https://oauth2.googleapis.com/tokeninfo")?new Response(JSON.stringify({aud:AUD,email:EMAIL,email_verified:"true",expires_in:"3000"})):new Response("{}",{status:404});
const api=(path,{method="GET",body,auth="Bearer t",env=SV}={})=>worker.fetch(new Request("https://money.flowlytix.co"+path,{method,headers:{...(auth?{authorization:auth}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined}),{...env,ASSETS});
const ticketFor=async e=>{ EMAIL=e; return (await (await api("/api/survey/ticket")).json()).ticket; };
await t("ticket needs sign-in",api("/api/survey/ticket",{auth:""}).then(r=>r.status),s=>s===401);
const tk1=await ticketFor("user1@x.com");
await t("signed-in answer is verified",svPost({product:"money",csat:2,ticket:tk1}),r=>r.status===200&&ROW().verified===1&&ROW().uid.length>10&&!JSON.stringify(ROW()).includes("user1"));
await t("forged ticket is not verified",svPost({product:"money",csat:5,ticket:tk1.slice(0,-3)+"abc"}),r=>r.status===200&&ROW().verified===0);
await t("owner's own answer never counts",ticketFor("flowlytix@gmail.com").then(tk=>svPost({product:"money",csat:5,ticket:tk})),r=>r.status===200&&ROW().verified===0);
await t("same person again: only the latest counts",svPost({product:"money",csat:4,ticket:tk1}),()=>true);
const pub=()=>api("/api/survey/public?product=money",{auth:""}).then(async r=>({status:r.status,cors:r.headers.get("access-control-allow-origin"),body:await r.json()}));
await t("public: rating hidden under 10 verified people",pub(),r=>r.status===200&&r.cors==="*"&&r.body.rating===null&&r.body.reviews.length===0);
for(let i=2;i<=10;i++){ const tk=await ticketFor(`user${i}@x.com`); await svPost({product:"money",csat:i%2?5:4,ticket:tk}); }
await t("public: rating shows from 10 verified people (latest per person)",pub(),r=>r.body.rating&&r.body.rating.count===10&&r.body.rating.average===4.4);
// reviews
await svPost({product:"money",csat:5,review:"Finally I know if my bills are covered.",review_name:"Ploy, Bangkok",review_ok:true,email:"ploy@x.co"});
const revId=ROW().id;
await svPost({product:"money",csat:5,review:"No consent given",review_name:"Ann",review_ok:false}); const noConsentId=ROW().id;
await t("review waits as pending",Promise.resolve(SQL.prepare("SELECT review_status FROM responses WHERE id=?").get(revId).review_status),s=>s==="pending");
await t("public: pending review not shown",pub(),r=>r.body.reviews.length===0);
EMAIL="someone@x.com"; await t("approve: not the owner -> 401",api("/api/survey/review",{method:"POST",body:{id:revId,status:"approved"}}).then(r=>r.status),s=>s===401);
EMAIL="flowlytix@gmail.com"; await t("owner approves a review",api("/api/survey/review",{method:"POST",body:{id:revId,status:"approved"}}).then(r=>r.status),s=>s===200);
await t("review without consent can't be approved",api("/api/survey/review",{method:"POST",body:{id:noConsentId,status:"approved"}}).then(async r=>[r.status,(await r.json()).error]),([s,e])=>s===400&&e==="no_consent");
await t("public: approved review shown with name, never email",pub(),r=>r.body.reviews.length===1&&r.body.reviews[0].name==="Ploy, Bangkok"&&r.body.reviews[0].stars===5&&!JSON.stringify(r.body).includes("ploy@x.co"));
const pubAll=()=>api("/api/survey/public?product=all",{auth:""}).then(r=>r.json());
await svPost({product:"website",csat:4,review:"Clear and friendly site.",review_name:"Nok",review_ok:true}); const webId=ROW().id;
EMAIL="flowlytix@gmail.com"; await api("/api/survey/review",{method:"POST",body:{id:webId,status:"approved"}});
await t("public all: reviews from every product, each with its product",pubAll(),b=>b.reviews.length===2&&b.reviews.some(v=>v.product==="website")&&b.reviews.some(v=>v.product==="money"));
await t("public money: only Money's reviews",pub(),r=>r.body.reviews.length===1&&r.body.reviews[0].product==="money");
const tkW=await ticketFor("user1@x.com"); await svPost({product:"website",csat:1,ticket:tkW});
await t("public all: rating counts each person once per product",pubAll(),b=>b.rating&&b.rating.count===11&&b.rating.average===Math.round(45/11*10)/10);
EMAIL="flowlytix@gmail.com"; await api("/api/survey/review",{method:"POST",body:{id:webId,status:"hidden"}});
await t("owner hides it again",api("/api/survey/review",{method:"POST",body:{id:revId,status:"hidden"}}).then(()=>pub()),r=>r.body.reviews.length===0);
EMAIL="someone@x.com"; await t("results: not the owner -> 401",api("/api/survey/results").then(r=>r.status),s=>s===401);
EMAIL="friend@x.com"; await t("results: PRO_EMAILS friend is not an owner -> 401",api("/api/survey/results",{env:{...SV,PRO_EMAILS:"friend@x.com"}}).then(r=>r.status),s=>s===401);
EMAIL="flowlytix@gmail.com"; await t("results: owner sees answers and the rating",api("/api/survey/results").then(r=>r.json()),b=>b.rows.length===COUNT()&&b.rating.money.count===10&&b.minRatings===10);
await t("results: CSV download",api("/api/survey/results?format=csv").then(async r=>[r.headers.get("content-type"),await r.text()]),([ct,tx])=>ct.startsWith("text/csv")&&tx.split("\n").length===COUNT()+1&&tx.includes("bills,plan")&&tx.includes("review_status"));
await t("/work serves the app page",worker.fetch(new Request("https://money.flowlytix.co/work"),{ASSETS}).then(r=>r.text()),tx=>tx==="asset:/");
await t("/work/ serves the app page too",worker.fetch(new Request("https://money.flowlytix.co/work/?x=1"),{ASSETS}).then(r=>r.text()),tx=>tx==="asset:/");
await t("survey host serves the survey page",worker.fetch(new Request("https://survey.flowlytix.co/?product=money"),{ASSETS}).then(r=>r.text()),tx=>tx==="asset:/survey");
await t("survey host: other paths go to the page",worker.fetch(new Request("https://survey.flowlytix.co/x?product=money"),{ASSETS}),r=>r.status===302&&r.headers.get("location")==="https://survey.flowlytix.co/?product=money");
await t("survey host /results -> owner page in the app",worker.fetch(new Request("https://survey.flowlytix.co/results"),{ASSETS}),r=>r.status===302&&r.headers.get("location")==="https://money.flowlytix.co/survey-results");
await t("money /survey-results -> Setup › Survey results",worker.fetch(new Request("https://money.flowlytix.co/survey-results"),{ASSETS}),r=>r.status===302&&r.headers.get("location")==="https://money.flowlytix.co/?survey=1");
await svPost({product:"support",page:"ticket:FLX-20261020-AB12C",csat:5,helps:["fast","solved"]});
await t("survey: support product kept, with the ticket it was about",Promise.resolve(ROW()),r=>r.product==="support"&&r.page==="ticket:FLX-20261020-AB12C"&&r.helps==="fast,solved");

// ---- free template sign-ups (worker/leads.js), same SQLite stand-in for D1 ----
const LROW = e => SQL.prepare("SELECT * FROM template_leads WHERE email = ?").get(e), LCOUNT = () => SQL.prepare("SELECT COUNT(*) n FROM template_leads").get().n;
const lead=(b,{env=SV,ip="1.1.1.1"}={})=>worker.fetch(new Request("https://money.flowlytix.co/api/template/lead",{method:"POST",headers:{"Content-Type":"application/json","CF-Connecting-IP":ip},body:JSON.stringify(b)}),{...env,ASSETS}).then(async r=>({status:r.status,body:await r.json()}));
await t("template: sign-up saved, file address back",lead({email:" Ann@Example.com ",news:false,lang:"th",utm_source:"facebook",utm_campaign:"bills-oct"}),r=>{ const x=LROW("ann@example.com");
  return r.status===200&&r.body.url==="/templates/flowlytix-yearly-bills.xlsx"&&x&&x.news===0&&x.news_text===""&&x.lang==="th"&&x.utm_source==="facebook"&&x.utm_campaign==="bills-oct"&&x.downloads===1; });
await t("template: news only when ticked (true), with the wording version",lead({email:"bob@example.com",news:"yes"}).then(()=>lead({email:"cat@example.com",news:true})),()=>LROW("bob@example.com").news===0&&LROW("cat@example.com").news===1&&LROW("cat@example.com").news_text==="news-tips-v1");
const firstAt=LROW("ann@example.com").created_at;
await t("template: same email again = one row, latest tick wins, first source kept",lead({email:"ann@example.com",news:true,utm_source:"google"}),()=>{ const x=LROW("ann@example.com");
  return LCOUNT()===3&&x.news===1&&x.downloads===2&&x.utm_source==="facebook"&&x.created_at===firstAt; });
await t("template: bad email refused",lead({email:"not-an-email"}),r=>r.status===400&&LCOUNT()===3);
await t("template: hidden bot field -> looks fine, nothing saved",lead({email:"bot@spam.com",website_url:"http://x"}),r=>r.status===200&&r.body.url&&!LROW("bot@spam.com"));
await t("template: GET refused",worker.fetch(new Request("https://money.flowlytix.co/api/template/lead"),{...SV,ASSETS}),r=>r.status===405);
await t("template: utm cleaned",lead({email:"dan@example.com",utm_source:"<script>fb",utm_campaign:"x".repeat(200)}),()=>LROW("dan@example.com").utm_source==="scriptfb"&&LROW("dan@example.com").utm_campaign.length===60);
{ const hits={}; const LIM={LEAD_LIMIT:{limit:async({key})=>({success:(hits[key]=(hits[key]||0)+1)<=5})}};
  for(let i=0;i<5;i++) await lead({email:`r${i}@example.com`},{env:{...SV,...LIM},ip:"9.9.9.9"});
  await t("template: 6th sign-up in a minute from one connection -> 429",lead({email:"r9@example.com"},{env:{...SV,...LIM},ip:"9.9.9.9"}),r=>r.status===429&&r.body.error==="slow_down"&&!LROW("r9@example.com"));
  await t("template: other connections still fine",lead({email:"r9@example.com"},{env:{...SV,...LIM},ip:"8.8.8.8"}),r=>r.status===200); }
await t("template: no database -> 503",lead({email:"eve@example.com"},{env:{}}),r=>r.status===503);
EMAIL="someone@x.com"; await t("template list: not an owner -> 401",api("/api/template/leads").then(r=>r.status),s=>s===401);
await t("template list: no sign-in -> 401",api("/api/template/leads",{auth:""}).then(r=>r.status),s=>s===401);
await t("template delete: not an owner -> 401",api("/api/template/leads/delete",{method:"POST",body:{id:1}}).then(r=>r.status),s=>s===401&&LCOUNT()>0);
EMAIL="flowlytix@gmail.com";
await t("template list: owner sees every sign-up, newest first",api("/api/template/leads").then(r=>r.json()),b=>b.rows.length===LCOUNT()&&b.rows[0].id>b.rows.at(-1).id&&"news" in b.rows[0]);
SQL.prepare("INSERT INTO template_leads (email,news,lang,created_at,last_at,utm_campaign) VALUES (?,?,?,?,?,?)").run("=cmd@x.com",0,"en","2026-10-28","2026-10-28","=HYPERLINK(1)");
await t("template list: CSV with a yes/no news column, formulas made harmless",api("/api/template/leads?format=csv").then(async r=>[r.headers.get("content-type"),r.headers.get("content-disposition"),await r.text()]),([ct,cd,tx])=>
  ct.startsWith("text/csv")&&cd.includes("flowlytix-template-signups-")&&tx.split("\n").length===LCOUNT()+1&&tx.split("\n")[0].includes("news_ok")&&/,ann@example\.com,yes,/.test(tx)&&/,bob@example\.com,no,/.test(tx)&&tx.includes("'=HYPERLINK(1)")&&!/,=/.test(tx));
const delId=LROW("bob@example.com").id;
await t("template delete: owner deletes one row (PDPA request)",api("/api/template/leads/delete",{method:"POST",body:{id:delId}}).then(r=>r.json()),b=>b.ok&&!LROW("bob@example.com")&&LROW("ann@example.com"));
await t("template delete: already gone -> 404",api("/api/template/leads/delete",{method:"POST",body:{id:delId}}).then(r=>r.status),s=>s===404);
await t("template delete: bad id -> 400",api("/api/template/leads/delete",{method:"POST",body:{id:"1 OR 1=1"}}).then(r=>r.status),s=>s===400);

// ---- anonymous sign-up log (worker/signups.js): who came from where, never who they are ----
const SU = () => SQL.prepare("SELECT * FROM signups ORDER BY id DESC LIMIT 1").get(), SUN = () => { try { return SQL.prepare("SELECT COUNT(*) n FROM signups").get().n; } catch { return 0; } };
const suPost=(b,o={})=>api("/api/signup-log",{method:"POST",body:b,...o});
EMAIL="New.Person@Gmail.com";
await t("signup log: not signed in -> 401, nothing saved",suPost({utm_source:"facebook"},{auth:""}).then(r=>r.status),s=>s===401&&SUN()===0);
{ const f=globalThis.fetch; globalThis.fetch=prevFetch; TOKEN_OK=false; await t("signup log: bad Google token -> 401",suPost({utm_source:"facebook"}).then(r=>r.status),s=>s===401&&SUN()===0); TOKEN_OK=true; globalThis.fetch=f; }
await t("signup log: GET refused",api("/api/signup-log").then(r=>r.status),s=>s===405);
await t("signup log: saved with source fields, not the owner",suPost({utm_source:"facebook",utm_medium:"paid_social",utm_campaign:"oct-launch",utm_content:"video A",referrer_domain:"https://m.facebook.com/x?fbclid=123",has_fbclid:true,lang:"th",device:"mobile"}).then(r=>r.status),s=>{ const x=SU();
  return s===200&&x.utm_source==="facebook"&&x.utm_medium==="paid_social"&&x.utm_campaign==="oct-launch"&&x.utm_content==="video_A"&&x.referrer_domain==="m.facebook.com"&&x.has_fbclid===1&&x.lang==="th"&&x.device==="mobile"&&x.owner===0&&x.product==="money"&&/^\d{4}-\d\d-\d\dT/.test(x.created_at); });
await t("signup log: the email (or any part of it) is never stored",Promise.resolve(),()=>{ const all=JSON.stringify(SQL.prepare("SELECT * FROM signups").all()).toLowerCase(); const cols=SQL.prepare("PRAGMA table_info(signups)").all().map(c=>c.name);
  return !all.includes("new.person")&&!all.includes("gmail")&&!cols.some(c=>/email|name|google|sheet|ip|agent/.test(c)); });
await t("signup log: fields cleaned and cut to 64",suPost({utm_source:"<script>alert(1)</script>",utm_campaign:"x".repeat(300),referrer_domain:"javascript:alert(1)",has_fbclid:"yes",lang:"fr",device:"tv",fbclid:"SECRET",email:"leak@x.com",amount:5000}).then(r=>r.status),s=>{ const x=SU();
  return s===200&&x.utm_source==="scriptalert1script"&&x.utm_campaign.length===64&&x.referrer_domain===""&&x.has_fbclid===0&&x.lang==="en"&&x.device==="desktop"&&!JSON.stringify(x).includes("SECRET")&&!JSON.stringify(x).includes("leak")&&!JSON.stringify(x).includes("5000"); });
EMAIL="flowlytix@gmail.com"; await t("signup log: owner account -> owner flag 1",suPost({}).then(r=>r.status),s=>s===200&&SU().owner===1&&SU().utm_source==="");
EMAIL="friend@x.com"; await t("signup log: PRO_EMAILS (friends, tests) -> owner flag 1",suPost({},{env:{...SV,PRO_EMAILS:"Friend@x.com"}}).then(r=>r.status),s=>s===200&&SU().owner===1);
await t("signup log: too big -> 413",api("/api/signup-log",{method:"POST",body:{utm_source:"a".repeat(3000)}}).then(r=>r.status),s=>s===413);
{ const hits={}; const LIM={LEAD_LIMIT:{limit:async({key})=>({success:(hits[key]=(hits[key]||0)+1)<=5})}}; EMAIL="spam@x.com"; const n0=SUN();
  for(let i=0;i<5;i++) await suPost({},{env:{...SV,...LIM}});
  await t("signup log: 6th in a minute -> 429, not saved",suPost({},{env:{...SV,...LIM}}).then(r=>r.status),s=>s===429&&SUN()===n0+5);
  await t("signup log: rate-limit keys are hashed (no email or IP)",Promise.resolve(),()=>Object.keys(hits).every(k=>/^su:[0-9a-f]{24}$/.test(k))); }
await t("signup log: no database -> 503",suPost({},{env:{}}).then(r=>r.status),s=>s===503);
EMAIL="someone@x.com"; await t("signup stats: not an owner -> 401",api("/api/signup-log/stats").then(r=>r.status),s=>s===401);
await t("signup stats: not signed in -> 401",api("/api/signup-log/stats",{auth:""}).then(r=>r.status),s=>s===401);
EMAIL="friend@x.com"; await t("signup stats: PRO_EMAILS friend is not an owner -> 401",api("/api/signup-log/stats",{env:{...SV,PRO_EMAILS:"friend@x.com"}}).then(r=>r.status),s=>s===401);
EMAIL="aronsodacan@gmail.com";
await t("signup stats: owner sees totals without owner/test rows",api("/api/signup-log/stats").then(r=>r.json()),b=>{ const owners=SQL.prepare("SELECT COUNT(*) n FROM signups WHERE owner=1").get().n;
  return b.total===SUN()-owners&&b.ownerRowsHidden===owners&&b.perDay.length===30&&b.perDay.at(-1).n===b.total&&b.bySource.some(x=>x.k==="facebook"&&x.n===1)&&b.bySource.some(x=>x.k==="direct")&&b.byContent.some(x=>x.k==="video_A")&&b.latest.length<=20&&b.latest.every(x=>x.owner===0&&Object.keys(x).join()==="created_at,source,utm_medium,device,owner"); });
await t("signup stats: ?owners=1 shows them too",api("/api/signup-log/stats?owners=1").then(r=>r.json()),b=>b.total===SUN()&&b.withOwners===true&&b.latest.some(x=>x.owner===1));
await t("/admin/signups -> the owner view in the app",worker.fetch(new Request("https://money.flowlytix.co/admin/signups"),{ASSETS}),r=>r.status===302&&r.headers.get("location")==="https://money.flowlytix.co/?signups=1");
globalThis.fetch=prevFetch;
console.log(out.join("\n")); // Thai gold price (worker/gold.js): Gold Traders Association page, public prices only
{ const span=(n,v)=>`<span id="DetailPlace_uc_goldprices1_lbl${n}"><b><font color="#000">${v}</font></b></span>`;
  GOLD_HTML="<table>"+span("AsTime","26/10/2569 เวลา 09:31 น. (ครั้งที่ 3)")+span("BLBuy","63,800.00")+span("BLSell","64,000.00")+span("OMBuy","62,519.36")+span("OMSell","64,800.00")+"</table>";
  await t("gold price parsed",call("gold",{auth:""}),r=>r.status===200&&r.body.barBuy===63800&&r.body.barSell===64000&&r.body.ornBuy===62519.36&&r.body.date==="2026-10-26");
  GOLD_HTML="<html>new layout</html>"; await t("gold page changed -> 502, no number",call("gold",{auth:""}),r=>r.status===502&&r.body.barBuy===undefined);
  GOLD_HTML=null; await t("gold source down -> 502",call("gold",{auth:""}),r=>r.status===502);
  await t("gold POST -> 405",call("gold",{method:"POST",auth:""}),r=>r.status===405); }
console.log(out.filter(x=>x.startsWith("PASS")).length+"/"+out.length);
