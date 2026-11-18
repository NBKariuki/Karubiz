import { useState } from "react";
export const SB_URL = "https://pdfadcnrxlojuxjqtzil.supabase.co";
export const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZmFkY25yeGxvanV4anF0emlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMTQ0MzksImV4cCI6MjEwMjg5MDQzOX0.1gRq0MWGc6EFOtm5-rma4Fo1shVSWIW8kFDX-Np6CIM";
export const C = { navy:"#050A1F",mid:"#0A1128",light:"#0F1A3A",yellow:"#F5C000",white:"#FFFFFF",muted:"#8899AA",dark:"#8A97A8",green:"#4CAF50",red:"#E85B5B" };
// Team is loaded from karu_users after login (see loadTeam). STAFF = active owners + managers (used for "recorded by" toggles).
// PARTNERS = active owners (used for owed balances and profit share). Both are mutated in place, like BIZ.
export const STAFF = [];
export const PARTNERS = [];
export const firstName = n => String(n||"").split(" ")[0];
export const partnerKey = n => firstName(n).toLowerCase();
export const defStaff = u => (u&&u.full_name)||STAFF[0]||"";
export const shareOf = profit => Math.max(0,profit)/Math.max(1,PARTNERS.length);
export const loadTeam = async (user) => {
  try{
    const rows = (await sb.rpc("karu_staff",{}))||[];
    const staff = rows.map(r=>r.full_name).filter(Boolean);
    const owners = rows.filter(r=>r.role==="owner").map(r=>r.full_name).filter(Boolean);
    if(user&&user.full_name&&(user.role==="owner"||user.role==="manager")&&!staff.includes(user.full_name)) staff.push(user.full_name);
    if(user&&user.full_name&&user.role==="owner"&&!owners.includes(user.full_name)) owners.push(user.full_name);
    STAFF.length=0; staff.forEach(s=>STAFF.push(s));
    PARTNERS.length=0; (owners.length?owners:staff).forEach(s=>PARTNERS.push(s));
  }catch(e){
    console.error("team:",e);
    if(!STAFF.length&&user&&user.full_name){ STAFF.push(user.full_name); PARTNERS.push(user.full_name); }
  }
};
// Business identity — defaults; overridden at app start from karu_settings
export const BIZ = { name:"KARU FURNITURE", address:"Off Kihara-Gachie-Karura Rd, Nairobi", phone1:"0720 772 866", phone2:"0792 933 413" };
export const loadBiz = async () => {
  try{
    const r = await fetch(`${SB_URL}/rest/v1/karu_settings?id=eq.business&select=*`, {headers:H});
    if(r.ok){ const rows=await r.json(); if(rows&&rows[0]){ const s=rows[0]; BIZ.name=s.name||BIZ.name; BIZ.address=s.address||BIZ.address; BIZ.phone1=s.phone1||BIZ.phone1; BIZ.phone2=s.phone2!=null?s.phone2:BIZ.phone2; } }
  }catch(e){ /* keep defaults */ }
};
export const bizPhones = () => [BIZ.phone1,BIZ.phone2].filter(Boolean).join(" · ");
export const EXP_CATS = ["Rent","Transport","Utilities","Marketing","Staff","Loan interest","Other"];
export const CAT_OPTS = [{id:"living",label:"Living Room"},{id:"bedroom",label:"Bedroom"},{id:"decor",label:"Decor"},{id:"other",label:"Other"}];
export const catLabel = id => ({living:"Living Room",bedroom:"Bedroom",decor:"Decor",other:"Other"}[id]||id);
export const H = {"apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`,"Content-Type":"application/json","Prefer":"return=representation"};
// ---- Supabase Auth (email+password; the email is username@AUTH_DOMAIN, never used for real mail) ----
export const AUTH_DOMAIN = "karu.app";
const AUTH_KEY = "karu_auth";
const AH = {"apikey":SB_KEY,"Content-Type":"application/json"};
let authSess = null; // {access, refresh, exp}
export const authEmail = u => String(u||"").trim().toLowerCase()+"@"+AUTH_DOMAIN;
const applySession = j => {
  authSess = {access:j.access_token, refresh:j.refresh_token, exp:Date.now()+(Number(j.expires_in)||3600)*1000};
  H.Authorization = "Bearer "+authSess.access;
  try{ localStorage.setItem(AUTH_KEY,JSON.stringify(authSess)); }catch{}
};
export const authSignIn = async (username, secret) => {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:AH,body:JSON.stringify({email:authEmail(username),password:secret})});
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(/invalid login/i.test(j.msg||j.error_description||"")?"Wrong username or password.":(j.msg||j.error_description||"Sign in failed."));
  applySession(j); return j;
};
export const authRefresh = async () => {
  if(!authSess||!authSess.refresh) return false;
  try{
    const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`,{method:"POST",headers:AH,body:JSON.stringify({refresh_token:authSess.refresh})});
    if(!r.ok) return false;
    applySession(await r.json()); return true;
  }catch{ return false; }
};
export const authRestore = async () => {
  try{
    const s = JSON.parse(localStorage.getItem(AUTH_KEY)||"null");
    if(!s||!s.refresh) return false;
    authSess = s;
    if(Date.now()>s.exp-60000) return await authRefresh();
    H.Authorization = "Bearer "+s.access; return true;
  }catch{ return false; }
};
export const authIfNeeded = async () => { if(authSess&&Date.now()>authSess.exp-120000) await authRefresh(); };
export const authSetPassword = async pw => {
  if(!authSess) throw new Error("Not signed in.");
  const r = await fetch(`${SB_URL}/auth/v1/user`,{method:"PUT",headers:{...AH,Authorization:"Bearer "+authSess.access},body:JSON.stringify({password:pw})});
  if(!r.ok){ const j=await r.json().catch(()=>({})); throw new Error(j.msg||j.error_description||"Could not change password."); }
};
export const authSignOut = async () => {
  try{ if(authSess) await fetch(`${SB_URL}/auth/v1/logout`,{method:"POST",headers:{...AH,Authorization:"Bearer "+authSess.access}}); }catch{}
  authSess = null; H.Authorization = `Bearer ${SB_KEY}`;
  try{ localStorage.removeItem(AUTH_KEY); }catch{}
};
// One request helper: retries once after refreshing an expired token.
const call = async (url, opt) => {
  let r = await fetch(url,{...opt,headers:{...H,...(opt.headers||{})}});
  if(r.status===401 && await authRefresh()) r = await fetch(url,{...opt,headers:{...H,...(opt.headers||{})}});
  return r;
};
export const sb = {
  get: async (t,p="") => { const r=await call(`${SB_URL}/rest/v1/${t}?${p}`,{}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  post: async (t,d) => { const r=await call(`${SB_URL}/rest/v1/${t}`,{method:"POST",body:JSON.stringify(d)}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  // Insert without reading the row back (for tables a role may write but not read, e.g. attendants and the money log).
  postQuiet: async (t,d) => { const r=await call(`${SB_URL}/rest/v1/${t}`,{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify(d)}); if(!r.ok) throw new Error(await r.text()); },
  patch: async (t,id,d) => { const r=await call(`${SB_URL}/rest/v1/${t}?id=eq.${id}`,{method:"PATCH",body:JSON.stringify(d)}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  rpc: async (fn,args) => { const r=await call(`${SB_URL}/rest/v1/rpc/${fn}`,{method:"POST",body:JSON.stringify(args||{})}); if(!r.ok) throw new Error(await r.text()); const x=await r.text(); return x?JSON.parse(x):null; },
  del: async (t,id) => { const r=await call(`${SB_URL}/rest/v1/${t}?id=eq.${id}`,{method:"DELETE"}); if(!r.ok) throw new Error("Delete failed"); },
};
export const logAudit = async d => { try { await sb.postQuiet("karu_audit",d); } catch(e){ console.error(e); } };
export const recordMoney = async rows => { try { await sb.postQuiet("karu_money", Array.isArray(rows)?rows:[rows]); } catch(e){ console.error("money:",e); } };
export const fetchBalances = async () => {
  try {
    const rows = await sb.get("karu_money","select=account,amount");
    const b = {cash:0,sacco:0,petty:0};
    rows.forEach(r=>{ b[r.account]=(b[r.account]||0)+Number(r.amount); });
    return {...b, hasData: rows.length>0};
  } catch { return {cash:0,sacco:0,petty:0,hasData:false}; }
};
export function pwStrength(pw){
  if(pw.length<8) return "At least 8 characters.";
  if(!/[a-zA-Z]/.test(pw)) return "Include at least one letter.";
  if(!/[0-9]/.test(pw)) return "Include at least one number.";
  return "";
}
export const ROLES = {
  owner:   { label:"Owner",     can:["sale","stock","expenses","reports","money","void","lock","edit","adjust","close","users","edit_expense","orders","loss"] },
  manager: { label:"Manager",   can:["sale","stock","expenses","reports","close","adjust","edit_expense","orders","loss"] },
  attendant:{ label:"Attendant", can:["sale"] },
};
export const can = (user, perm) => !!user && (ROLES[user.role]?.can.includes(perm));
export const fmtK = n => "KSh "+Math.round(n).toLocaleString();
// Cost of goods: every sale line carries the real unit cost ("cost") saved when it was sold.
// Old lines without it fall back to the average cost for that product name.
export const makeAvgCost = stock => { const m={}; (stock||[]).forEach(st=>{ const k=String(st.name||"").toLowerCase(); (m[k]=m[k]||[]).push(Number(st.unit_cost)||0); }); return n=>{ const a=m[String(n||"").toLowerCase()]; return a&&a.length?a.reduce((x,y)=>x+y,0)/a.length:0; }; };
export const saleCost = (sale,avgFn) => (sale.items||[]).reduce((t,it)=>{ const q=Number(it.qty||1); const c=(it.cost!=null&&it.cost!=="")?Number(it.cost):(avgFn?avgFn(it.name):0); return t+c*q; },0);
// Used only when the database function is not installed or for exchanges: oldest stock first.
export const stampCosts = (items,stockRows) => { const pool={}; const all=makeAvgCost(stockRows);
  (stockRows||[]).forEach(s=>{ const avail=s.qty_in-s.qty_sold-(s.qty_adjusted||0); if(avail>0){ const k=String(s.name||"").toLowerCase(); (pool[k]=pool[k]||[]).push({avail,cost:Number(s.unit_cost)||0,date:s.date_in}); } });
  Object.values(pool).forEach(a=>a.sort((x,y)=>new Date(x.date)-new Date(y.date)));
  return items.map(it=>{ const q=Number(it.qty||1); let left=q, tot=0; for(const b of (pool[String(it.name||"").toLowerCase()]||[])){ if(left<=0)break; const t=Math.min(left,b.avail); tot+=t*b.cost; b.avail-=t; left-=t; } if(left>0) tot+=left*all(it.name); return (q>0&&tot>0)?{...it,cost:Math.round(tot/q*10000)/10000}:it; }); };
export const todayStr = () => new Date().toISOString().split("T")[0];
export const initials = n => (n||"").split(" ").map(w=>w[0]||"").join("").toUpperCase();
export const EDIT_WINDOW_MS = 24*60*60*1000;
export const withinWindow = createdAt => { if(!createdAt) return true; return (Date.now()-new Date(createdAt).getTime()) < EDIT_WINDOW_MS; };
export const windowNote = "Locked — records can only be changed within 24 hours. Use reconciliation for later corrections.";

export function parseMpesa(sms) {
  const s = sms.trim();
  if (/has been credited to your account/i.test(s)) {
    const amtM=s.match(/KES\s*([\d,]+\.?\d*)\s+has been credited/i);
    const nameM=s.match(/\|\s*([A-Za-z][A-Za-z ]+?)\s*\]/);
    const phoneM=s.match(/\[\s*(254\d+)/);
    const refM=s.match(/>\s*(\d+)\s*\|\s*[A-Za-z]/);
    let phone="";
    if(phoneM){const intl=phoneM[1].replace(/X/gi,"0");phone="0"+intl.slice(3);}
    return {code:refM?refM[1]:"",amount:amtM?Number(amtM[1].replace(/,/g,"")):0,name:nameM?nameM[1].trim():"",phone,type:"sacco"};
  }
  const codeM=s.match(/^([A-Z0-9]{8,12})\s/);
  const amtM=s.match(/(?:received|paid|send|sent)\s+Ksh\s*([\d,]+)/i)||s.match(/Ksh\s*([\d,]+)/i);
  const nameM=s.match(/from\s+([A-Z][A-Z ]+?)\s+(?:0[679]\d{8}|\d{4,})/i);
  const phoneM=s.match(/(0[679]\d{8})/);
  return {code:codeM?codeM[1]:"",amount:amtM?Number(amtM[1].replace(/,/g,"")):0,name:nameM?nameM[1].trim():"",phone:phoneM?phoneM[1]:"",type:"mpesa"};
}

