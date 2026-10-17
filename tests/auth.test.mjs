import worker from "../worker/index.js";
const b64u=s=>Buffer.from(s).toString("base64url");
const idt=email=>"x."+b64u(JSON.stringify({email,email_verified:true}))+".y";
let G={refresh:"rt_123",scope:"https://www.googleapis.com/auth/drive.file openid email",invalid:false,codeNoRT:false}, calls=[];
globalThis.fetch=async(url,opt={})=>{ calls.push(url+" "+(opt.body||"")); const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s});
  if(url==="https://oauth2.googleapis.com/token"){ const f=new URLSearchParams(opt.body);
    if(f.get("grant_type")==="authorization_code") return J({access_token:"at_code",expires_in:3599,scope:G.scope,id_token:idt("me@gmail.com"),...(G.codeNoRT?{}:{refresh_token:G.refresh})});
    if(f.get("grant_type")==="refresh_token"){ if(G.invalid) return J({error:"invalid_grant"},400); return J({access_token:"at_"+f.get("refresh_token"),expires_in:3599,scope:G.scope}); } }
  if(url.startsWith("https://oauth2.googleapis.com/revoke")) return J({});
  return J({},404); };
const ASSETS={fetch:async r=>new Response("asset")};
const ENV={GOOGLE_CLIENT_SECRET:"s3cret",ASSETS};
const go=(path,{method="GET",cookie="",env=ENV}={})=>worker.fetch(new Request("https://money.flowlytix.co"+path,{method,headers:cookie?{cookie}:{} ,redirect:"manual"}),env);
const sc=r=>{ const out={}; for(const [k,v] of r.headers) if(k==="set-cookie") v.split(/,(?=\s*__Host)/).forEach(c=>{ const [nv]=c.trim().split(";"); const i=nv.indexOf("="); out[nv.slice(0,i)]={v:nv.slice(i+1),raw:c.trim()}; }); return out; };
const out=[]; const t=(n,ok)=>out.push((ok?"PASS ":"FAIL ")+n);
// off
let r=await go("/api/auth/config",{env:{ASSETS}}); t("config off when no secret",(await r.json()).enabled===false);
r=await go("/api/auth/start",{env:{ASSETS}}); t("start redirects home when off",r.headers.get("location")==="/?auth=off");
r=await go("/api/auth/config"); t("config on with secret",(await r.json()).enabled===true);
// start
r=await go("/api/auth/start?hint=me%40gmail.com"); const loc=new URL(r.headers.get("location")); const st=sc(r)["__Host-flx_st"];
t("start goes to Google with offline access",loc.host==="accounts.google.com"&&loc.searchParams.get("access_type")==="offline"&&loc.searchParams.get("redirect_uri")==="https://money.flowlytix.co/api/auth/callback"&&loc.searchParams.get("login_hint")==="me@gmail.com"&&!loc.searchParams.get("prompt"));
t("state cookie is HttpOnly Secure Lax",/HttpOnly/.test(st.raw)&&/Secure/.test(st.raw)&&/SameSite=Lax/.test(st.raw));
const state=loc.searchParams.get("state");
// callback: bad state
r=await go("/api/auth/callback?code=c&state=wrong.0",{cookie:"__Host-flx_st="+st.v}); t("wrong state refused",r.headers.get("location")==="/?auth=fail");
r=await go("/api/auth/callback?error=access_denied&state="+state,{cookie:"__Host-flx_st="+st.v}); t("cancel goes home with auth=cancel",r.headers.get("location")==="/?auth=cancel");
// callback ok
r=await go("/api/auth/callback?code=c&state="+state,{cookie:"__Host-flx_st="+st.v}); let ck=sc(r); const rt=ck["__Host-flx_rt"];
t("callback sets encrypted refresh cookie and goes home",r.headers.get("location")==="/?signedin=1"&&rt&&!rt.v.includes("rt_123")&&/HttpOnly/.test(rt.raw)&&/SameSite=Strict/.test(rt.raw)&&/Max-Age=15552000/.test(rt.raw));
t("callback clears state cookie",ck["__Host-flx_st"]&&/Max-Age=0/.test(ck["__Host-flx_st"].raw));
// no refresh token -> force consent once
G.codeNoRT=true; r=await go("/api/auth/callback?code=c&state="+state.split(".")[0]+".0",{cookie:"__Host-flx_st="+st.v}); t("no long-lived key -> asks consent once",r.headers.get("location").startsWith("/api/auth/start?force=1&hint=me%40gmail.com"));
r=await go("/api/auth/callback?code=c&state="+state.split(".")[0]+".1",{cookie:"__Host-flx_st="+st.v}); t("still none after consent -> fail",r.headers.get("location")==="/?auth=fail"); G.codeNoRT=false;
r=await go("/api/auth/start?force=1&hint=me%40gmail.com"); t("force start uses consent screen",new URL(r.headers.get("location")).searchParams.get("prompt")==="consent");
G.scope="openid email"; r=await go("/api/auth/callback?code=c&state="+state,{cookie:"__Host-flx_st="+st.v}); t("Drive box not ticked -> noscope",r.headers.get("location")==="/?auth=noscope"); G.scope="https://www.googleapis.com/auth/drive.file openid email";
// token
r=await go("/api/auth/token",{method:"POST",cookie:"__Host-flx_rt="+rt.v}); let j=await r.json(); t("token returns fresh access token + email",r.status===200&&j.access_token==="at_rt_123"&&j.email==="me@gmail.com"&&j.expires_in===3599);
r=await go("/api/auth/token",{method:"GET",cookie:"__Host-flx_rt="+rt.v}); t("token GET refused",r.status===405);
r=await go("/api/auth/token",{method:"POST"}); t("no cookie -> 401",r.status===401);
r=await go("/api/auth/token",{method:"POST",cookie:"__Host-flx_rt="+rt.v.slice(0,-3)+"AAA"}); t("tampered cookie -> 401 and cleared",r.status===401&&/Max-Age=0/.test(r.headers.get("set-cookie")||""));
r=await go("/api/auth/token",{method:"POST",cookie:"__Host-flx_rt="+rt.v,env:{...ENV,GOOGLE_CLIENT_SECRET:"other"}}); t("cookie from another key can't be read",r.status===401);
G.invalid=true; r=await go("/api/auth/token",{method:"POST",cookie:"__Host-flx_rt="+rt.v}); t("Google revoked -> 401 and cookie cleared",r.status===401&&/Max-Age=0/.test(r.headers.get("set-cookie")||"")); G.invalid=false;
// logout
calls=[]; r=await go("/api/auth/logout",{method:"POST",cookie:"__Host-flx_rt="+rt.v}); t("logout revokes at Google and clears cookie",r.status===200&&calls.some(c=>c.startsWith("https://oauth2.googleapis.com/revoke?token=rt_123"))&&/Max-Age=0/.test(r.headers.get("set-cookie")||""));
// pages unaffected
r=await go("/"); t("pages still served",(await r.text())==="asset");
console.log(out.join("\n")); console.log(out.filter(x=>x.startsWith("PASS")).length+"/"+out.length);
