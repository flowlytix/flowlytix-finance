import worker from "../worker/index.js";
let TAKEN=0, META=null, CREATED=0, EMAIL="A@Gmail.com", SUBS=[], CUSTS=[{id:"cus_1"}], TOKEN_OK=true, AUD="963989611279-0u4vll2sfmqfrvio5c199ug0oo8sfu9h.apps.googleusercontent.com", posted=[];
globalThis.fetch=async(url,opt={})=>{ const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s});
  if(url.startsWith("https://oauth2.googleapis.com/tokeninfo")) return TOKEN_OK?J({aud:AUD,email:EMAIL,email_verified:"true",expires_in:"3000"}):J({error:"invalid"},400);
  if(url.includes("/v1/prices/")) return J({unit_amount:url.endsWith("price_r")?29900:19900,currency:"thb"});
  if(url.includes("/v1/subscriptions?limit=100&status=")) return J({data:url.includes("status=active")?Array(TAKEN).fill({}):[],has_more:false});
  if(url.includes("/v1/customers?")) return J({data:CUSTS});
  if(url.endsWith("/v1/customers")&&opt.method==="POST"){ CREATED++; return J({id:"cus_new"}); }
  if(url.includes("/v1/customers/")&&opt.method==="POST"){ META=opt.body; return J({}); }
  if(url.includes("/v1/subscriptions?")) return J({data:SUBS});
  if(url.includes("/v1/checkout/sessions")){ posted.push(opt.body); return J({url:"https://checkout.stripe.com/c/x"}); }
  if(url.includes("/v1/billing_portal/sessions")) return J({url:"https://billing.stripe.com/p/x"});
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
await t("new person: trial offered (7 days)",call("licence.js",{},ON),r=>r.body.plan==="free"&&r.body.trialEligible===true&&r.body.trialDays===7);
await t("checkout gives 7-day trial, no card needed, ends if no card",call("checkout.js",{method:"POST"},ON),r=>{const b=posted.at(-1); return r.body.url&&b.includes("subscription_data%5Btrial_period_days%5D=7")&&b.includes("payment_method_collection=if_required")&&b.includes("missing_payment_method%5D=cancel");});
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
await t("pricing: 63 of 100 founding places left, founding price now",call("pricing.js",{auth:""},R),r=>r.body.foundingLeft===63&&r.body.current==="founding"&&r.body.founding.amount===199&&r.body.regular.amount===299&&r.body.trialDays===7);
await t("checkout uses founding price while places are left",call("checkout.js",{method:"POST"},R),r=>posted.at(-1).includes("line_items%5B0%5D%5Bprice%5D=price_1")&&posted.at(-1).includes("tier%5D=founding"));
TAKEN=100;
await t("pricing: founding full -> regular price",call("pricing.js",{auth:""},R),r=>r.body.foundingLeft===0&&r.body.current==="regular");
await t("checkout uses regular ฿299 price once 100 are taken",call("checkout.js",{method:"POST"},R),r=>posted.at(-1).includes("line_items%5B0%5D%5Bprice%5D=price_r")&&posted.at(-1).includes("tier%5D=regular"));
CUSTS=[{id:"cus_1"}]; SUBS=[sub("canceled",undefined,1700000000)]; await t("paid checkout on regular price: return page told ฿299",call("checkout.js",{method:"POST"},R),r=>posted.at(-1).includes(encodeURIComponent("&px=299&cur=THB"))); CUSTS=[]; SUBS=[];
CUSTS=[{id:"cus_1"}]; SUBS=[sub("active","price_1")];
await t("founding member stays Pro on ฿199 after places run out",call("licence.js",{},R),r=>r.body.plan==="pro"&&r.body.tier==="founding");
SUBS=[sub("active","price_r")];
await t("regular-price member is Pro too",call("licence.js",{},R),r=>r.body.plan==="pro"&&r.body.tier==="regular");
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

// ---- survey (survey.flowlytix.co) ----
const ROWS=[]; const FAKE_DB={prepare:sql=>({bind:(...v)=>({run:async()=>{ if(sql.startsWith("INSERT")) ROWS.push(v); return {}; }}),run:async()=>({}),all:async()=>({results:ROWS.map((v,i)=>({id:i+1,created_at:v[0],product:v[1],page:v[2],plan:v[3],lang:v[4],device:v[5],csat:v[6],nps:v[7],ease:v[8],helps:v[9],hard:v[10],improve:v[11],email:v[12]}))})})};
const SV={SURVEY_DB:FAKE_DB};
const svPost=(b,env=SV,host="survey.flowlytix.co")=>worker.fetch(new Request(`https://${host}/api/survey`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}),{...env,ASSETS}).then(async r=>({status:r.status,body:await r.json()}));
await t("survey answer saved",svPost({product:"money",page:"plan",plan:"trial",lang:"th",device:"phone",csat:4,nps:9,ease:3,helps:["bills","plan","Bad Key!",7],hard:"x",improve:"y",email:"me@x.co"}),r=>r.status===200&&ROWS.length===1&&ROWS[0][1]==="money"&&ROWS[0][9]==="bills,plan"&&ROWS[0][6]===4);
await t("survey: no rating at all refused",svPost({product:"money",hard:"spam"}),r=>r.status===400&&ROWS.length===1);
await t("survey: bot field refused",svPost({csat:5,website_url:"http://spam"}),r=>r.status===400&&ROWS.length===1);
await t("survey: out-of-range and unknown values cleaned",svPost({product:"evil",csat:9,nps:10,ease:0,email:"not-an-email",lang:"xx"}),r=>r.status===200&&ROWS[1][1]==="other"&&ROWS[1][6]===null&&ROWS[1][7]===10&&ROWS[1][8]===null&&ROWS[1][12]===""&&ROWS[1][4]==="en");
await t("survey: long text cut to 1,000",svPost({csat:3,hard:"a".repeat(5000)}),r=>r.status===200&&ROWS[2][10].length===1000);
await t("survey: no database -> 503",svPost({csat:3},{}),r=>r.status===503&&r.body.error==="survey_not_configured");
await t("survey: GET refused",worker.fetch(new Request("https://survey.flowlytix.co/api/survey"),{...SV,ASSETS}),r=>r.status===405);
globalThis.fetch=async(url)=>url.startsWith("https://oauth2.googleapis.com/tokeninfo")?new Response(JSON.stringify({aud:AUD,email:EMAIL,email_verified:"true",expires_in:"3000"})):new Response("{}",{status:404});
const res=(env=SV,q="")=>worker.fetch(new Request("https://money.flowlytix.co/api/survey/results"+q,{headers:{authorization:"Bearer t"}}),{...env,ASSETS});
EMAIL="someone@x.com"; await t("results: not the owner -> 401",res().then(r=>r.status),s=>s===401);
EMAIL="friend@x.com"; await t("results: PRO_EMAILS friend is not an owner -> 401",res({...SV,PRO_EMAILS:"friend@x.com"}).then(r=>r.status),s=>s===401);
EMAIL="flowlytix@gmail.com"; await t("results: owner sees answers",res().then(r=>r.json()),b=>b.rows.length===3);
await t("results: CSV download",res(SV,"?format=csv").then(async r=>[r.headers.get("content-type"),await r.text()]),([ct,tx])=>ct.startsWith("text/csv")&&tx.split("\n").length===4&&tx.includes("bills,plan"));
await t("survey host serves the survey page",worker.fetch(new Request("https://survey.flowlytix.co/?product=money"),{ASSETS}).then(r=>r.text()),tx=>tx==="asset:/survey");
await t("survey host: other paths go to the page",worker.fetch(new Request("https://survey.flowlytix.co/x?product=money"),{ASSETS}),r=>r.status===302&&r.headers.get("location")==="https://survey.flowlytix.co/?product=money");
await t("survey host /results -> owner page in the app",worker.fetch(new Request("https://survey.flowlytix.co/results"),{ASSETS}),r=>r.status===302&&r.headers.get("location")==="https://money.flowlytix.co/survey-results");
await t("money /survey-results -> Setup › Survey results",worker.fetch(new Request("https://money.flowlytix.co/survey-results"),{ASSETS}),r=>r.status===302&&r.headers.get("location")==="https://money.flowlytix.co/?survey=1");
globalThis.fetch=prevFetch;
console.log(out.join("\n")); console.log(out.filter(x=>x.startsWith("PASS")).length+"/"+out.length);
