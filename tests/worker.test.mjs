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
await t("TRIAL_DAYS=0 switches trial off",call("checkout.js",{method:"POST"},{...ON,TRIAL_DAYS:"0"}),r=>!posted.at(-1).includes("trial_period_days"));
CUSTS=[{id:"cus_1"}]; SUBS=[sub("canceled",undefined,1700000000)];
await t("had a subscription before: no second trial",call("licence.js",{},ON),r=>r.body.plan==="free"&&r.body.trialEligible===false);
await t("checkout for returning person has no trial",call("checkout.js",{method:"POST"},ON),r=>r.body.url&&!posted.at(-1).includes("trial_period_days"));
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
console.log(out.join("\n")); console.log(out.filter(x=>x.startsWith("PASS")).length+"/"+out.length);
