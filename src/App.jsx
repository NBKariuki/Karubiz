import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const SB_URL = "https://pdfadcnrxlojuxjqtzil.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZmFkY25yeGxvanV4anF0emlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMTQ0MzksImV4cCI6MjEwMjg5MDQzOX0.1gRq0MWGc6EFOtm5-rma4Fo1shVSWIW8kFDX-Np6CIM";
const APP_PW = "GwituMucii@22";
const C = { navy:"#050A1F",mid:"#0A1128",light:"#0F1A3A",yellow:"#F5C000",white:"#FFFFFF",muted:"#8899AA",dark:"#556677",green:"#4CAF50",red:"#E85B5B" };
const STAFF = ["Burton Kariuki","Martin Ruguru"];
const EXP_CATS = ["Rent","Transport","Utilities","Marketing","Staff","Other"];
const CAT_OPTS = [{id:"living",label:"Living Room"},{id:"bedroom",label:"Bedroom"},{id:"decor",label:"Decor"},{id:"other",label:"Other"}];
const catLabel = id => ({living:"Living Room",bedroom:"Bedroom",decor:"Decor",other:"Other"}[id]||id);
const H = {"apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`,"Content-Type":"application/json","Prefer":"return=representation"};
const sb = {
  get: async (t,p="") => { const r=await fetch(`${SB_URL}/rest/v1/${t}?${p}`,{headers:H}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  post: async (t,d) => { const r=await fetch(`${SB_URL}/rest/v1/${t}`,{method:"POST",headers:H,body:JSON.stringify(d)}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  patch: async (t,id,d) => { const r=await fetch(`${SB_URL}/rest/v1/${t}?id=eq.${id}`,{method:"PATCH",headers:H,body:JSON.stringify(d)}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
};
const logAudit = async d => { try { await sb.post("karu_audit",d); } catch(e){ console.error(e); } };
const recordMoney = async rows => { try { await sb.post("karu_money", Array.isArray(rows)?rows:[rows]); } catch(e){ console.error("money:",e); } };
const fetchBalances = async () => {
  try {
    const rows = await sb.get("karu_money","select=account,amount");
    const b = {cash:0,sacco:0,owed_burton:0,owed_martin:0};
    rows.forEach(r=>{ b[r.account]=(b[r.account]||0)+Number(r.amount); });
    return {...b, hasData: rows.length>0};
  } catch { return {cash:0,sacco:0,owed_burton:0,owed_martin:0,hasData:false}; }
};
const fmtK = n => "KSh "+Math.round(n).toLocaleString();
const todayStr = () => new Date().toISOString().split("T")[0];
const initials = n => (n||"").split(" ").map(w=>w[0]||"").join("").toUpperCase();

function parseMpesa(sms) {
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

const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0} body{font-family:'DM Sans',sans-serif;background:#050A1F;color:#E8E2D4} input,select,textarea{outline:none;font-family:'DM Sans',sans-serif}
    .field{margin-bottom:13px} .field label{display:block;font-size:12px;color:#FFFFFF;font-weight:600;margin-bottom:5px;letter-spacing:0.04em;text-transform:uppercase}
    .field input,.field select,.field textarea{width:100%;background:#0A1128;border:1px solid #1A2A4A;border-radius:6px;padding:10px 12px;color:#E8E2D4;font-size:14px} .field textarea{resize:vertical;min-height:56px}
    .tog{display:flex;gap:6px} .tog-btn{flex:1;padding:8px 4px;font-size:13px;border:1px solid #1A2A4A;border-radius:6px;background:#0A1128;color:#8899AA;cursor:pointer;text-align:center;transition:all 0.15s}
    .tog-btn.on{background:rgba(245,192,0,0.12);border-color:#F5C000;color:#F5C000;font-weight:600}
    .card{background:#0A1128;border:1px solid #1A2A4A;border-radius:10px;padding:14px;margin-bottom:10px}
    .btn-y{background:#F5C000;color:#050A1F;border:none;padding:11px 18px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif} .btn-y:disabled{background:#444;color:#888;cursor:not-allowed}
    .btn-g{background:transparent;color:#8899AA;border:1px solid #1A2A4A;padding:9px 14px;border-radius:6px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif}
    .btn-r{background:rgba(232,91,91,0.12);color:#E85B5B;border:1px solid rgba(232,91,91,0.3);padding:6px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif}
    .badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:100px} .b-y{background:rgba(245,192,0,0.12);color:#F5C000} .b-g{background:rgba(76,175,80,0.12);color:#4CAF50} .b-r{background:rgba(232,91,91,0.12);color:#E85B5B}
    .stat{background:#0A1128;border:1px solid #1A2A4A;border-radius:10px;padding:14px;text-align:center} .stat-n{font-size:22px;font-weight:600;margin-bottom:2px} .stat-l{font-size:10px;color:#8899AA;text-transform:uppercase;letter-spacing:0.08em}
    .nav{display:flex;background:#0A1128;border-top:1px solid #1A2A4A;position:fixed;bottom:0;left:0;right:0;z-index:50}
    .nav-btn{flex:1;padding:10px 4px 8px;background:none;border:none;color:#556677;cursor:pointer;font-size:10px;letter-spacing:0.05em;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:'DM Sans',sans-serif} .nav-btn .ni{font-size:20px} .nav-btn.on{color:#F5C000}
    .ac-drop{position:absolute;top:100%;left:0;right:0;background:#0A1128;border:1px solid #F5C000;border-top:none;border-radius:0 0 6px 6px;z-index:200;max-height:200px;overflow-y:auto}
    .ac-item{padding:9px 12px;cursor:pointer;border-bottom:1px solid #1A2A4A} .ac-item:hover{background:#0F1A3A} .ac-item:last-child{border-bottom:none}
    .audit-entry{font-size:11px;color:#556677;padding:5px 0;border-bottom:1px solid #0F1A3A;line-height:1.5} .audit-entry:last-child{border-bottom:none}
    .trip-hdr{display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0}
    .strip{display:flex;justify-content:center;gap:16px;padding:6px 16px;background:#0A1128;border-bottom:1px solid #1A2A4A;font-size:12px}
    .strip span{color:#8899AA} .strip b{color:#F5C000;font-weight:600}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100}
    .panel{position:fixed;top:0;right:0;bottom:0;width:300px;max-width:88vw;background:#0A1128;border-left:1px solid #1A2A4A;z-index:101;overflow-y:auto;padding:20px 18px 40px}
    .bal-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1A2A4A}
    .bal-row:last-child{border-bottom:none}
    .qa{background:#050A1F;border:1px solid #1A2A4A;border-radius:8px;padding:12px;margin-bottom:10px}
    .qa-title{font-size:13px;font-weight:600;color:#FFFFFF;margin-bottom:8px}
    .qa input{width:100%;background:#0A1128;border:1px solid #1A2A4A;border-radius:6px;padding:9px 11px;color:#E8E2D4;font-size:14px;margin-bottom:8px}
    .mv{font-size:11px;padding:6px 0;border-bottom:1px solid #0F1A3A;display:flex;justify-content:space-between}
    .mv:last-child{border-bottom:none}
    .wiz-overlay{position:fixed;inset:0;background:rgba(5,10,31,0.94);z-index:120;overflow-y:auto;padding:12px}
    .wiz{max-width:480px;margin:0 auto;background:#0A1128;border:1px solid #1A2A4A;border-radius:12px;min-height:calc(100vh - 24px);display:flex;flex-direction:column}
    .wiz-hd{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #1A2A4A}
    .wiz-steps{display:flex;gap:6px;padding:12px 16px 4px}
    .wiz-dot{flex:1;height:4px;border-radius:2px;background:#1A2A4A} .wiz-dot.on{background:#F5C000}
    .wiz-body{padding:16px;flex:1}
    .wiz-ft{padding:12px 16px 16px;border-top:1px solid #1A2A4A;display:flex;gap:8px}
    .staff-btn{background:#0A1128;border:2px solid #1A2A4A;border-radius:12px;padding:22px 12px;color:#FFFFFF;font-size:17px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s}
    .staff-btn:hover{border-color:#F5C000;color:#F5C000}
    .rcpt{background:#fff;color:#111;border-radius:8px;padding:18px 16px;max-width:340px;margin:0 auto 14px;font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.5}
    .rcpt-hd{text-align:center;padding-bottom:10px;border-bottom:1px dashed #999;margin-bottom:10px}
    .rcpt-logo{font-size:20px;font-weight:700;letter-spacing:0.1em}
    .rcpt-sub{font-size:12px;color:#555;margin-top:2px}
    .rcpt-row{display:flex;justify-content:space-between;padding:3px 0;font-size:14px}
    .rcpt-row .l{color:#555} .rcpt-row .v{font-weight:600}
    .rcpt-items{border-top:1px dashed #999;border-bottom:1px dashed #999;padding:8px 0;margin:8px 0}
    .rcpt-it{display:flex;justify-content:space-between;padding:4px 0;font-size:14px}
    .rcpt-it .n{flex:1;padding-right:8px}
    .rcpt-tot{display:flex;justify-content:space-between;font-size:18px;font-weight:700;padding:8px 0}
    .rcpt-ft{text-align:center;font-size:12px;color:#555;margin-top:10px;padding-top:10px;border-top:1px dashed #999;line-height:1.6}
    @media print{.nav,.np,.strip{display:none!important} body{background:#fff} .rcpt{max-width:80mm;border-radius:0;padding:4mm;font-size:13px} .rcpt-logo{font-size:18px}}
  `}</style>
);

export default function App() {
  const [authed,setAuthed]=useState(false);
  const [pw,setPw]=useState(""); const [pwErr,setPwErr]=useState(""); const [tab,setTab]=useState("sale");
  const [bal,setBal]=useState({cash:0,sacco:0,owed_burton:0,owed_martin:0,hasData:false});
  const [panel,setPanel]=useState(false);
  const refreshBal=useCallback(async()=>{ setBal(await fetchBalances()); },[]);
  useEffect(()=>{ if(authed) refreshBal(); },[authed,refreshBal]);
  const tryLogin=()=>{ if(pw.trim()===APP_PW.trim()){setAuthed(true);}else{setPwErr("Wrong password.");} };
  if(!authed) return (<><GS/>
    <div style={{minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:"center",padding:24}}>
      <div style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:12,padding:"36px 28px",maxWidth:360,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:24,fontWeight:600,color:"#F5C000",letterSpacing:"0.1em"}}>KARU</div><div style={{fontSize:13,color:"#8899AA",marginTop:4}}>Accounts System</div></div>
        <div className="field"><label>Password</label><input type="password" value={pw} onChange={e=>{setPw(e.target.value);setPwErr("");}} onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="Enter password"/></div>
        {pwErr&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:12}}>{pwErr}</div>}
        <button className="btn-y" onClick={tryLogin} style={{width:"100%"}}>Sign In</button>
      </div>
    </div></>);
  return (<><GS/>
    <div style={{maxWidth:500,margin:"0 auto",paddingBottom:72}}>
      <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#050A1F",position:"sticky",top:0,zIndex:40,borderBottom:"1px solid #0A1128"}}>
        <span style={{fontSize:16,fontWeight:600,color:"#F5C000",letterSpacing:"0.08em"}}>KARU</span>
        <span style={{fontSize:12,color:"#556677"}}>{new Date().toLocaleDateString("en-KE",{day:"2-digit",month:"short"})}</span>
        <button onClick={()=>setPanel(true)} style={{background:"none",border:"1px solid #1A2A4A",borderRadius:6,color:"#F5C000",padding:"5px 10px",fontSize:16,cursor:"pointer",lineHeight:1}}>☰</button>
      </div>
      <div style={{padding:16}}>
        {tab==="sale"&&<SaleTab onMoney={refreshBal}/>}{tab==="stock"&&<StockTab onMoney={refreshBal}/>}{tab==="expenses"&&<ExpensesTab onMoney={refreshBal}/>}{tab==="reports"&&<ReportsTab/>}
      </div>
    </div>
    {panel&&<MoneyPanel bal={bal} onClose={()=>setPanel(false)} onChange={refreshBal}/>}
    <nav className="nav">{[["sale","Sale","💰"],["stock","Stock","📦"],["expenses","Expenses","🧾"],["reports","Reports","📊"]].map(([id,label,icon])=>(
      <button key={id} className={`nav-btn${tab===id?" on":""}`} onClick={()=>setTab(id)}><span className="ni">{icon}</span>{label}</button>
    ))}</nav></>);
}

function MoneyPanel({bal,onClose,onChange}){
  const [act,setAct]=useState(null);
  const [amt,setAmt]=useState(""); const [who,setWho]=useState("Burton Kariuki"); const [dir,setDir]=useState("in"); const [acc,setAcc]=useState("sacco");
  const [openCash,setOpenCash]=useState(""); const [openSacco,setOpenSacco]=useState("");
  const [moves,setMoves]=useState([]); const [saving,setSaving]=useState(false);
  useEffect(()=>{ sb.get("karu_money","select=*&order=created_at.desc&limit=12").then(setMoves).catch(()=>{}); },[bal]);
  const rb=()=>{setAmt("");setAct(null);onChange();};
  const doOpening=async()=>{
    if(!openCash&&!openSacco) return;
    setSaving(true);
    const rows=[];
    if(Number(openCash)>0) rows.push({account:"cash",amount:Number(openCash),type:"opening",description:"Opening balance",date:todayStr(),recorded_by:who});
    if(Number(openSacco)>0) rows.push({account:"sacco",amount:Number(openSacco),type:"opening",description:"Opening balance",date:todayStr(),recorded_by:who});
    await recordMoney(rows); setSaving(false); rb();
  };
  const doBank=async()=>{ const a=Number(amt); if(!a) return; setSaving(true);
    await recordMoney([{account:"cash",amount:-a,type:"bank",description:"Banked cash",date:todayStr(),recorded_by:who},{account:"sacco",amount:a,type:"bank",description:"Banked cash",date:todayStr(),recorded_by:who}]);
    setSaving(false); rb(); };
  const doWithdraw=async()=>{ const a=Number(amt); if(!a) return; setSaving(true);
    await recordMoney([{account:"sacco",amount:-a,type:"withdraw",description:"Withdrew to cash",date:todayStr(),recorded_by:who},{account:"cash",amount:a,type:"withdraw",description:"Withdrew to cash",date:todayStr(),recorded_by:who}]);
    setSaving(false); rb(); };
  const doPartner=async()=>{ const a=Number(amt); if(!a) return; setSaving(true);
    const short=who.split(" ")[0].toLowerCase(); const owedKey="owed_"+short;
    if(dir==="in") await recordMoney([{account:acc,amount:a,type:"partner_in",partner:who,description:`${who.split(" ")[0]} put in`,date:todayStr(),recorded_by:who}]);
    else if(dir==="out") await recordMoney([{account:acc,amount:-a,type:"partner_out",partner:who,description:`${who.split(" ")[0]} took out`,date:todayStr(),recorded_by:who}]);
    else await recordMoney([{account:acc,amount:-a,type:"partner_repay",partner:who,description:`Repaid ${who.split(" ")[0]}`,date:todayStr(),recorded_by:who},{account:owedKey,amount:-a,type:"partner_repay",partner:who,description:`Repaid ${who.split(" ")[0]}`,date:todayStr(),recorded_by:who}]);
    setSaving(false); rb(); };
  const total=bal.cash+bal.sacco;
  return (<>
    <div className="overlay" onClick={onClose}/>
    <div className="panel">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{fontSize:15,fontWeight:600,color:"#FFFFFF"}}>Money</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#8899AA",fontSize:20,cursor:"pointer"}}>×</button>
      </div>
      {!bal.hasData?(
        <div className="qa">
          <div className="qa-title">Set opening balances</div>
          <div style={{fontSize:11,color:"#8899AA",marginBottom:8}}>One time only. What do you have right now?</div>
          <input type="number" value={openCash} onChange={e=>setOpenCash(e.target.value)} placeholder="Cash at hand (KSh)"/>
          <input type="number" value={openSacco} onChange={e=>setOpenSacco(e.target.value)} placeholder="SACCO balance (KSh)"/>
          <button className="btn-y" onClick={doOpening} disabled={saving} style={{width:"100%"}}>{saving?"Saving...":"Save"}</button>
        </div>
      ):(<>
        <div style={{marginBottom:16}}>
          <div className="bal-row"><span style={{color:"#8899AA",fontSize:13}}>Cash at hand</span><span style={{fontSize:15,fontWeight:600,color:"#FFFFFF"}}>{fmtK(bal.cash)}</span></div>
          <div className="bal-row"><span style={{color:"#8899AA",fontSize:13}}>SACCO</span><span style={{fontSize:15,fontWeight:600,color:"#FFFFFF"}}>{fmtK(bal.sacco)}</span></div>
          <div className="bal-row"><span style={{color:"#FFFFFF",fontSize:13,fontWeight:600}}>Total</span><span style={{fontSize:17,fontWeight:700,color:"#F5C000"}}>{fmtK(total)}</span></div>
          {bal.owed_burton>0&&<div className="bal-row"><span style={{color:"#E8A45B",fontSize:12}}>Business owes Burton</span><span style={{color:"#E8A45B",fontSize:13,fontWeight:600}}>{fmtK(bal.owed_burton)}</span></div>}
          {bal.owed_martin>0&&<div className="bal-row"><span style={{color:"#E8A45B",fontSize:12}}>Business owes Martin</span><span style={{color:"#E8A45B",fontSize:13,fontWeight:600}}>{fmtK(bal.owed_martin)}</span></div>}
        </div>
        {!act&&<div style={{display:"grid",gap:8,marginBottom:16}}>
          <button className="btn-y" onClick={()=>setAct("bank")} style={{fontSize:13}}>Bank cash</button>
          <button className="btn-g" onClick={()=>setAct("withdraw")} style={{fontSize:13}}>Withdraw from SACCO</button>
          <button className="btn-g" onClick={()=>setAct("partner")} style={{fontSize:13}}>Partner money in / out</button>
        </div>}
        {act==="bank"&&<div className="qa"><div className="qa-title">Bank cash</div><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)" autoFocus/><div className="tog" style={{marginBottom:8}}>{STAFF.map(s=><button key={s} className={`tog-btn${who===s?" on":""}`} onClick={()=>setWho(s)}>{s.split(" ")[0]}</button>)}</div><div style={{display:"flex",gap:6}}><button className="btn-y" onClick={doBank} disabled={saving} style={{flex:1,fontSize:13}}>{saving?"...":"Confirm"}</button><button className="btn-g" onClick={()=>{setAct(null);setAmt("");}} style={{fontSize:13}}>Cancel</button></div></div>}
        {act==="withdraw"&&<div className="qa"><div className="qa-title">Withdraw to cash</div><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)" autoFocus/><div className="tog" style={{marginBottom:8}}>{STAFF.map(s=><button key={s} className={`tog-btn${who===s?" on":""}`} onClick={()=>setWho(s)}>{s.split(" ")[0]}</button>)}</div><div style={{display:"flex",gap:6}}><button className="btn-y" onClick={doWithdraw} disabled={saving} style={{flex:1,fontSize:13}}>{saving?"...":"Confirm"}</button><button className="btn-g" onClick={()=>{setAct(null);setAmt("");}} style={{fontSize:13}}>Cancel</button></div></div>}
        {act==="partner"&&<div className="qa"><div className="qa-title">Partner money</div>
          <div className="tog" style={{marginBottom:8}}>{STAFF.map(s=><button key={s} className={`tog-btn${who===s?" on":""}`} onClick={()=>setWho(s)}>{s.split(" ")[0]}</button>)}</div>
          <div className="tog" style={{marginBottom:8}}><button className={`tog-btn${dir==="in"?" on":""}`} onClick={()=>setDir("in")}>Puts in</button><button className={`tog-btn${dir==="out"?" on":""}`} onClick={()=>setDir("out")}>Takes out</button><button className={`tog-btn${dir==="repay"?" on":""}`} onClick={()=>setDir("repay")}>Repay</button></div>
          <div className="tog" style={{marginBottom:8}}><button className={`tog-btn${acc==="cash"?" on":""}`} onClick={()=>setAcc("cash")}>Cash</button><button className={`tog-btn${acc==="sacco"?" on":""}`} onClick={()=>setAcc("sacco")}>SACCO</button></div>
          <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)"/>
          <div style={{display:"flex",gap:6}}><button className="btn-y" onClick={doPartner} disabled={saving} style={{flex:1,fontSize:13}}>{saving?"...":"Confirm"}</button><button className="btn-g" onClick={()=>{setAct(null);setAmt("");}} style={{fontSize:13}}>Cancel</button></div></div>}
        {moves.length>0&&<div><div style={{fontSize:11,color:"#556677",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Recent movements</div>
          {moves.map(m=><div key={m.id} className="mv"><span style={{color:"#8899AA"}}>{m.date.slice(5)} · {m.description||m.type}</span><span style={{color:m.amount>=0?"#4CAF50":"#E85B5B",fontWeight:600}}>{m.amount>=0?"+":""}{Math.round(m.amount).toLocaleString()}</span></div>)}
        </div>}
      </>)}
    </div>
  </>);
}

function AutocompleteInput({value,onChange,onSelect,stockItems,placeholder}){
  const [open,setOpen]=useState(false);
  const matches=value.length>0?stockItems.filter(s=>s.name.toLowerCase().includes(value.toLowerCase())&&(s.qty_in-s.qty_sold-(s.qty_adjusted||0))>0):[];
  return (
    <div style={{position:"relative"}}>
      <input value={value} onChange={e=>{onChange(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),200)}
        placeholder={placeholder} style={{width:"100%",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:open&&matches.length>0?"6px 6px 0 0":"6px",padding:"9px 10px",color:"#E8E2D4",fontSize:13}}/>
      {open&&matches.length>0&&(
        <div className="ac-drop">
          {matches.map(s=>(
            <div key={s.id} className="ac-item" onMouseDown={()=>onSelect(s)}>
              <div style={{fontSize:13,fontWeight:500}}>{s.name}</div>
              <div style={{fontSize:11,color:"#8899AA"}}>{s.qty_in-s.qty_sold-(s.qty_adjusted||0)} available · KSh {Number(s.selling_price).toLocaleString()} · {s.trip_no}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SaleTab({onMoney}){
  const [stockItems,setStockItems]=useState([]);
  const [wiz,setWiz]=useState(false); const [step,setStep]=useState(1);
  const [sms,setSms]=useState(""); const [parsed,setParsed]=useState(null);
  const [staff,setStaff]=useState("Burton Kariuki");
  const [cName,setCName]=useState(""); const [cPhone,setCPhone]=useState("");
  const [items,setItems]=useState([{id:1,name:"",qty:1,price:""}]);
  const [pay,setPay]=useState("mpesa"); const [mpesaCode,setMpesaCode]=useState("");
  const [notes,setNotes]=useState(""); const [err,setErr]=useState("");
  const [saving,setSaving]=useState(false); const [receipt,setReceipt]=useState(null); const [saved,setSaved]=useState(null);
  const [payType,setPayType]=useState("full"); const [initPay,setInitPay]=useState("");
  const [pendingSales,setPendingSales]=useState([]); const [addPaySale,setAddPaySale]=useState(null);
  const [addPayAmt,setAddPayAmt]=useState(""); const [addPayMethod,setAddPayMethod]=useState("mpesa");
  const [addPayCode,setAddPayCode]=useState(""); const [addPayNotes,setAddPayNotes]=useState("");
  const [addPayStaff,setAddPayStaff]=useState("Burton Kariuki"); const [addPaySaving,setAddPaySaving]=useState(false);
  const [showPending,setShowPending]=useState(false);
  const [todaySales,setTodaySales]=useState([]); const [showHistory,setShowHistory]=useState(false);
  const [histSales,setHistSales]=useState([]); const [voidSale,setVoidSale]=useState(null);
  const [voidReason,setVoidReason]=useState(""); const [voidStaff,setVoidStaff]=useState("Burton Kariuki"); const [voiding,setVoiding]=useState(false);

  const loadPendingSales=async()=>{ try{ setPendingSales(await sb.get("karu_sales","select=*&balance_due=gt.0&voided=eq.false&order=created_at.desc")); }catch(e){console.error(e);} };
  const loadToday=async()=>{ try{ setTodaySales(await sb.get("karu_sales",`select=*&date=eq.${todayStr()}&order=created_at.desc`)); }catch(e){console.error(e);} };
  const loadHistory=async()=>{ try{ setHistSales(await sb.get("karu_sales","select=*&order=created_at.desc&limit=60")); }catch(e){console.error(e);} };
  const loadStock=async()=>{ try{ setStockItems(await sb.get("karu_stock","select=*&order=date_in.asc")); }catch(e){console.error(e);} };
  useEffect(()=>{ loadStock(); loadPendingSales(); loadToday(); },[]);

  const resetForm=()=>{ setCName("");setCPhone("");setMpesaCode("");setNotes("");setSms("");setParsed(null);setItems([{id:1,name:"",qty:1,price:""}]);setPayType("full");setInitPay("");setErr("");setStep(1); };
  const openWiz=s=>{ setStaff(s); resetForm(); setWiz(true); };
  const closeWiz=()=>{ setWiz(false); resetForm(); };

  const handleSms=v=>{
    setSms(v);
    if(v.trim().length>20){
      const p=parseMpesa(v);
      if(p.amount>0||p.name||p.code){
        setParsed(p);
        if(p.name) setCName(p.name); if(p.phone) setCPhone(p.phone); if(p.code) setMpesaCode(p.code);
        if(p.amount>0) setItems(prev=>prev.some(i=>i.name||i.price)?prev:[{id:Date.now(),name:"",qty:1,price:String(p.amount)}]);
        setPay("mpesa");
      }
    }
  };
  const addItem=()=>setItems(x=>[...x,{id:Date.now(),name:"",qty:1,price:""}]);
  const rmItem=id=>setItems(x=>x.length>1?x.filter(i=>i.id!==id):x);
  const upItem=(id,f,v)=>setItems(x=>x.map(i=>i.id===id?{...i,[f]:v}:i));
  const selectStock=(id,s)=>setItems(x=>x.map(i=>i.id===id?{...i,name:s.name,price:String(s.selling_price)}:i));
  const total=items.reduce((s,i)=>s+(Number(i.qty||0)*Number(i.price||0)),0);
  const validItems=items.filter(i=>i.name&&Number(i.price)>0);

  const reduceStock=async(soldItems)=>{
    for(const sold of soldItems){
      let qtyLeft=Number(sold.qty||1);
      const matches=stockItems.filter(s=>s.name.toLowerCase()===sold.name.toLowerCase()&&(s.qty_in-s.qty_sold-(s.qty_adjusted||0))>0).sort((a,b)=>new Date(a.date_in)-new Date(b.date_in));
      for(const si of matches){ if(qtyLeft<=0)break; const avail=si.qty_in-si.qty_sold-(si.qty_adjusted||0); const r=Math.min(qtyLeft,avail); await sb.patch("karu_stock",si.id,{qty_sold:si.qty_sold+r}); qtyLeft-=r; }
    }
  };

  const nextStep=()=>{
    setErr("");
    if(step===1){ if(!cName.trim()){setErr("Customer name is required.");return;} setStep(2); }
    else if(step===2){ if(!validItems.length){setErr("Add at least one item with a price.");return;} setStep(3); }
  };

  const genReceipt=async(withReceipt=true)=>{
    setErr("");
    if(pay==="mpesa"&&!mpesaCode.trim()){setErr("M-Pesa code required.");return;}
    if(payType==="instalment"&&(!initPay||Number(initPay)<=0)){setErr("Enter the initial payment.");return;}
    if(payType==="instalment"&&Number(initPay)>total){setErr("Initial payment cannot exceed total.");return;}
    setSaving(true);
    try{
      const now=new Date(); const date=todayStr();
      const time_str=now.toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit",hour12:true});
      const last=await sb.get("karu_sales","select=receipt_no&order=created_at.desc&limit=1");
      const lastNo=last.length?parseInt(last[0].receipt_no.split("-").pop()||"0"):0;
      const receipt_no=`KARU-${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,"0")}-${String(lastNo+1).padStart(3,"0")}`;
      const amtPaid=payType==="instalment"?Number(initPay):total; const balDue=payType==="instalment"?total-amtPaid:0;
      const data={receipt_no,date,time_str,served_by:staff,customer_name:cName,customer_phone:cPhone,items:validItems,payment_method:pay==="mpesa"?"M-Pesa":"Cash",mpesa_code:mpesaCode.toUpperCase(),total,amount_paid:amtPaid,balance_due:balDue,payment_type:payType,notes};
      const [newSale]=await sb.post("karu_sales",data);
      if(payType==="instalment"&&newSale?.id) await sb.post("karu_payments",{sale_id:newSale.id,receipt_no,customer_name:cName,amount:amtPaid,payment_method:data.payment_method,mpesa_code:data.mpesa_code,date,recorded_by:staff,notes:"Initial instalment payment"});
      await reduceStock(validItems);
      await recordMoney({account:pay==="mpesa"?"sacco":"cash",amount:amtPaid,type:"sale",ref:receipt_no,description:`Sale ${receipt_no} · ${cName}`,date,recorded_by:staff});
      if(onMoney) onMoney();
      await loadStock(); await loadToday(); await loadPendingSales();
      setWiz(false);
      if(withReceipt) setReceipt(data); else setSaved(data);
    }catch(e){setErr("Save failed: "+e.message);}
    setSaving(false);
  };

  const addPaymentToSale=async()=>{
    if(!addPayAmt||Number(addPayAmt)<=0){alert("Enter a valid amount.");return;}
    if(addPayMethod==="mpesa"&&!addPayCode.trim()){alert("M-Pesa code required.");return;}
    setAddPaySaving(true);
    try{
      const date=todayStr(); const newPaid=Number(addPaySale.amount_paid||0)+Number(addPayAmt); const newBal=Math.max(0,Number(addPaySale.total)-newPaid);
      await sb.post("karu_payments",{sale_id:addPaySale.id,receipt_no:addPaySale.receipt_no,customer_name:addPaySale.customer_name,amount:Number(addPayAmt),payment_method:addPayMethod==="mpesa"?"M-Pesa":"Cash",mpesa_code:addPayCode.toUpperCase(),date,recorded_by:addPayStaff,notes:addPayNotes||"Instalment payment"});
      await sb.patch("karu_sales",addPaySale.id,{amount_paid:newPaid,balance_due:newBal,payment_type:newBal<=0?"full":"instalment"});
      await recordMoney({account:addPayMethod==="mpesa"?"sacco":"cash",amount:Number(addPayAmt),type:"sale",ref:addPaySale.receipt_no,description:`Instalment ${addPaySale.receipt_no} · ${addPaySale.customer_name}`,date,recorded_by:addPayStaff});
      if(onMoney) onMoney();
      setAddPaySale(null);setAddPayAmt("");setAddPayCode("");setAddPayNotes("");
      await loadPendingSales();
      alert(newBal<=0?"Fully paid. Account cleared.":"Payment recorded. Balance: "+fmtK(newBal));
    }catch(e){alert("Failed: "+e.message);}
    setAddPaySaving(false);
  };

  const doVoid=async()=>{
    if(!voidReason.trim()){alert("Reason required.");return;}
    setVoiding(true);
    try{
      const s=voidSale;
      await sb.patch("karu_sales",s.id,{voided:true,void_reason:voidReason,voided_by:voidStaff,voided_at:new Date().toISOString()});
      if(s.items){ for(const it of s.items){
        const matches=stockItems.filter(x=>x.name.toLowerCase()===String(it.name).toLowerCase()&&x.qty_sold>0).sort((a,b)=>new Date(b.date_in)-new Date(a.date_in));
        let q=Number(it.qty||1); for(const m of matches){ if(q<=0)break; const r=Math.min(q,m.qty_sold); await sb.patch("karu_stock",m.id,{qty_sold:m.qty_sold-r}); q-=r; }
      }}
      const paid=Number(s.amount_paid||s.total);
      await recordMoney({account:s.payment_method==="M-Pesa"?"sacco":"cash",amount:-paid,type:"void",ref:s.receipt_no,description:`Voided ${s.receipt_no} · ${s.customer_name}`,date:todayStr(),recorded_by:voidStaff});
      await logAudit({trip_no:null,record_id:s.id,action:"void_sale",field_changed:s.receipt_no,old_value:String(s.total),new_value:"0",reason:voidReason,changed_by:voidStaff});
      if(onMoney) onMoney();
      setVoidSale(null); setVoidReason("");
      await loadStock(); await Promise.all([loadToday(),loadHistory(),loadPendingSales()]);
    }catch(e){alert("Void failed: "+e.message);}
    setVoiding(false);
  };

  const rcptText=r=>{
    const il=r.items.map(i=>`${i.name} x${i.qty}  KSh ${(Number(i.qty)*Number(i.price)).toLocaleString()}`).join("\n");
    return `KARU FURNITURE\nReceipt ${r.receipt_no}\nDate: ${r.date} ${r.time_str}\nServed by: ${initials(r.served_by)}\n\nCustomer: ${r.customer_name}${r.customer_phone?"\nPhone: "+r.customer_phone:""}\n\n${il}\n\nTOTAL: KSh ${r.total.toLocaleString()}${r.payment_type==="instalment"?`\nPaid: KSh ${Number(r.amount_paid).toLocaleString()}\nBalance: KSh ${Number(r.balance_due).toLocaleString()}`:""}\nPayment: ${r.payment_method}${r.mpesa_code?"\nCode: "+r.mpesa_code:""}${r.notes?"\nNote: "+r.notes:""}\n\nThank you for shopping with us\nOff Kihara-Gachie-Karura Rd\n0720 772 866`;
  };
  const shareWA=()=>window.open("https://wa.me/?text="+encodeURIComponent("*KARU FURNITURE*\n"+rcptText(receipt).replace("KARU FURNITURE\n","")),"_blank");
  const copyText=()=>navigator.clipboard.writeText(rcptText(receipt)).then(()=>alert("Receipt copied"));

  const downloadJPEG=()=>{
    const r=receipt; const S=2;
    const c=document.createElement("canvas"); const W=380*S; const lines=r.items.length; const H=(430+lines*30+(r.payment_type==="instalment"?50:0)+(r.notes?24:0))*S;
    c.width=W; c.height=H; const x=c.getContext("2d"); x.scale(S,S);
    x.fillStyle="#fff"; x.fillRect(0,0,380,H/S);
    x.fillStyle="#111"; x.textAlign="center"; x.font="bold 22px Arial"; x.fillText("KARU FURNITURE",190,34);
    x.fillStyle="#555"; x.font="12px Arial"; x.fillText("Off Kihara-Gachie-Karura Rd, Nairobi",190,52); x.fillText("0720 772 866",190,68);
    const dash=y=>{x.strokeStyle="#999";x.setLineDash([3,3]);x.beginPath();x.moveTo(18,y);x.lineTo(362,y);x.stroke();x.setLineDash([]);};
    dash(82); let y=104; x.font="14px Arial";
    const row=(l,v)=>{x.textAlign="left";x.fillStyle="#555";x.fillText(l,18,y);x.textAlign="right";x.fillStyle="#111";x.font="bold 14px Arial";x.fillText(v,362,y);x.font="14px Arial";y+=22;};
    row("Receipt",r.receipt_no); row("Date",r.date+"  "+r.time_str); row("Served by",initials(r.served_by)); row("Customer",r.customer_name); if(r.customer_phone) row("Phone",r.customer_phone);
    y+=4; dash(y); y+=22;
    r.items.forEach(i=>{ x.textAlign="left";x.fillStyle="#111";x.font="14px Arial";x.fillText(`${i.name}  x${i.qty}`,18,y); x.textAlign="right";x.font="bold 14px Arial";x.fillText("KSh "+(Number(i.qty)*Number(i.price)).toLocaleString(),362,y); y+=26; });
    y+=2; dash(y); y+=28;
    x.textAlign="left";x.fillStyle="#111";x.font="bold 20px Arial";x.fillText("TOTAL",18,y); x.textAlign="right";x.fillText("KSh "+r.total.toLocaleString(),362,y); y+=26;
    if(r.payment_type==="instalment"){ x.font="14px Arial"; row("Paid","KSh "+Number(r.amount_paid).toLocaleString()); row("Balance","KSh "+Number(r.balance_due).toLocaleString()); }
    x.font="14px Arial"; row("Payment",r.payment_method+(r.mpesa_code?"  "+r.mpesa_code:"")); if(r.notes) row("Note",r.notes);
    y+=6; dash(y); y+=22;
    x.textAlign="center";x.fillStyle="#555";x.font="12px Arial";x.fillText("Thank you for shopping with us",190,y); x.fillText("karufurniture.netlify.app",190,y+18);
    const a=document.createElement("a"); a.download=`KARU-${r.receipt_no}.jpg`; a.href=c.toDataURL("image/jpeg",0.95); a.click();
  };

  if(saved) return (
    <div style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{fontSize:48,marginBottom:16}}>✅</div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:8}}>Sale Recorded</div>
      <div style={{color:"#8899AA",fontSize:14,marginBottom:4}}>{saved.customer_name}</div>
      <div style={{color:"#F5C000",fontSize:24,fontWeight:600,marginBottom:4}}>{fmtK(Number(saved.total))}</div>
      {saved.payment_type==="instalment"&&<div style={{color:"#E8A45B",fontSize:14,marginBottom:4}}>Paid: {fmtK(Number(saved.amount_paid))} · Balance: {fmtK(Number(saved.balance_due))}</div>}
      <div style={{color:"#8899AA",fontSize:13,marginBottom:24}}>{saved.payment_method} · {saved.receipt_no} · {initials(saved.served_by)}</div>
      <div style={{color:"#4CAF50",fontSize:13,marginBottom:32}}>Stock and money updated</div>
      <button className="btn-y" onClick={()=>setSaved(null)} style={{width:"100%",padding:14}}>Done</button>
    </div>
  );

  if(receipt) return (
    <div>
      <div className="rcpt">
        <div className="rcpt-hd"><div className="rcpt-logo">KARU FURNITURE</div><div className="rcpt-sub">Off Kihara-Gachie-Karura Rd, Nairobi</div><div className="rcpt-sub">0720 772 866</div></div>
        <div className="rcpt-row"><span className="l">Receipt</span><span className="v">{receipt.receipt_no}</span></div>
        <div className="rcpt-row"><span className="l">Date</span><span className="v">{receipt.date} {receipt.time_str}</span></div>
        <div className="rcpt-row"><span className="l">Served by</span><span className="v">{initials(receipt.served_by)}</span></div>
        <div className="rcpt-row"><span className="l">Customer</span><span className="v">{receipt.customer_name}</span></div>
        {receipt.customer_phone&&<div className="rcpt-row"><span className="l">Phone</span><span className="v">{receipt.customer_phone}</span></div>}
        <div className="rcpt-items">{receipt.items.map((i,idx)=><div key={idx} className="rcpt-it"><span className="n">{i.name} <span style={{color:"#555"}}>x{i.qty}</span></span><span style={{fontWeight:600}}>KSh {(Number(i.qty)*Number(i.price)).toLocaleString()}</span></div>)}</div>
        <div className="rcpt-tot"><span>TOTAL</span><span>KSh {receipt.total.toLocaleString()}</span></div>
        {receipt.payment_type==="instalment"&&<><div className="rcpt-row"><span className="l">Paid</span><span className="v">KSh {Number(receipt.amount_paid).toLocaleString()}</span></div><div className="rcpt-row"><span className="l">Balance</span><span className="v" style={{color:"#B45309"}}>KSh {Number(receipt.balance_due).toLocaleString()}</span></div></>}
        <div className="rcpt-row"><span className="l">Payment</span><span className="v">{receipt.payment_method}{receipt.mpesa_code?" · "+receipt.mpesa_code:""}</span></div>
        {receipt.notes&&<div className="rcpt-row"><span className="l">Note</span><span className="v">{receipt.notes}</span></div>}
        <div className="rcpt-ft">Thank you for shopping with us<br/>karufurniture.netlify.app</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}} className="np">
        <button className="btn-y" onClick={shareWA} style={{fontSize:13}}>WhatsApp</button>
        <button className="btn-g" onClick={copyText} style={{fontSize:13}}>Copy text</button>
        <button className="btn-g" onClick={downloadJPEG} style={{fontSize:13}}>Download image</button>
        <button className="btn-g" onClick={()=>window.print()} style={{fontSize:13}}>Print / PDF</button>
      </div>
      <button className="btn-g np" onClick={()=>setReceipt(null)} style={{width:"100%",fontSize:13}}>Done</button>
    </div>
  );

  const liveToday=todaySales.filter(s=>!s.voided); const todayTot=liveToday.reduce((a,s)=>a+Number(s.amount_paid||s.total),0);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
        <div><div style={{fontSize:11,color:"#8899AA",textTransform:"uppercase",letterSpacing:"0.05em"}}>Today</div><div style={{fontSize:14,fontWeight:600,color:"#FFFFFF"}}>{liveToday.length} sale{liveToday.length!==1?"s":""} · <span style={{color:"#F5C000"}}>{fmtK(todayTot)}</span></div></div>
        <button className="btn-g" onClick={()=>{setShowHistory(x=>!x);if(!showHistory)loadHistory();}} style={{fontSize:12,padding:"6px 12px"}}>{showHistory?"Hide":"History"}</button>
      </div>
      {showHistory&&(
        <div style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:12,marginBottom:14}}>
          {voidSale?(
            <div>
              <div style={{fontSize:13,fontWeight:600,marginBottom:4,color:"#E85B5B"}}>Void {voidSale.receipt_no}</div>
              <div style={{fontSize:12,color:"#8899AA",marginBottom:10}}>{voidSale.customer_name} · {fmtK(Number(voidSale.total))}. Stock returned, money reversed.</div>
              <div className="field"><label>Reason (required)</label><textarea value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="e.g. Wrong item, customer returned"/></div>
              <div className="field"><label>Voided by</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${voidStaff===s?" on":""}`} onClick={()=>setVoidStaff(s)}>{s.split(" ")[0]}</button>)}</div></div>
              <div style={{display:"flex",gap:8}}><button className="btn-r" onClick={doVoid} disabled={voiding} style={{flex:1,padding:10}}>{voiding?"Voiding...":"Confirm Void"}</button><button className="btn-g" onClick={()=>{setVoidSale(null);setVoidReason("");}} style={{fontSize:13}}>Cancel</button></div>
            </div>
          ):(
            <div>
              <div style={{fontSize:11,color:"#8899AA",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Recent sales</div>
              {histSales.length===0?<div style={{color:"#556677",fontSize:13}}>No sales yet.</div>:histSales.map(s=>(
                <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1A2A4A",opacity:s.voided?0.45:1}}>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,textDecoration:s.voided?"line-through":"none"}}>{s.customer_name}</div><div style={{fontSize:11,color:"#8899AA"}}>{s.receipt_no} · {s.date} · {initials(s.served_by)} · {s.payment_method}{s.voided?` · VOID: ${s.void_reason}`:""}</div></div>
                  <div style={{textAlign:"right",marginLeft:8}}><div style={{fontSize:13,fontWeight:600,color:s.voided?"#556677":"#F5C000"}}>{fmtK(Number(s.total))}</div>{!s.voided&&<button onClick={()=>setVoidSale(s)} style={{background:"none",border:"none",color:"#E85B5B",fontSize:11,cursor:"pointer",padding:"2px 0"}}>Void</button>}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {pendingSales.length>0&&(
        <div style={{background:"rgba(232,164,91,0.08)",border:"1px solid rgba(232,164,91,0.4)",borderRadius:8,padding:12,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setShowPending(x=>!x)}>
            <div><span style={{color:"#E8A45B",fontWeight:600,fontSize:13}}>Pending Balances</span><span style={{background:"rgba(232,164,91,0.2)",color:"#E8A45B",fontSize:11,padding:"2px 8px",borderRadius:100,marginLeft:8}}>{pendingSales.length}</span></div>
            <span style={{color:"#E8A45B"}}>{showPending?"▲":"▼"}</span>
          </div>
          {showPending&&(
            <div style={{marginTop:10}}>
              {addPaySale?(
                <div>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{addPaySale.customer_name} · Balance {fmtK(Number(addPaySale.balance_due))}</div>
                  <div className="field"><label>Amount received (KSh)</label><input type="number" value={addPayAmt} onChange={e=>setAddPayAmt(e.target.value)} placeholder="0"/></div>
                  <div className="field"><label>Method</label><div className="tog"><button className={`tog-btn${addPayMethod==="mpesa"?" on":""}`} onClick={()=>setAddPayMethod("mpesa")}>M-Pesa</button><button className={`tog-btn${addPayMethod==="cash"?" on":""}`} onClick={()=>setAddPayMethod("cash")}>Cash</button></div></div>
                  {addPayMethod==="mpesa"&&<div className="field"><label>M-Pesa code</label><input value={addPayCode} onChange={e=>setAddPayCode(e.target.value.toUpperCase())} placeholder="e.g. QJK7X8Y9Z0" style={{fontFamily:"monospace"}}/></div>}
                  <div className="field"><label>Recorded by</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${addPayStaff===s?" on":""}`} onClick={()=>setAddPayStaff(s)}>{s.split(" ")[0]}</button>)}</div></div>
                  <div className="field"><label>Notes (optional)</label><input value={addPayNotes} onChange={e=>setAddPayNotes(e.target.value)} placeholder="e.g. Second instalment"/></div>
                  <div style={{display:"flex",gap:8}}><button className="btn-y" onClick={addPaymentToSale} disabled={addPaySaving} style={{flex:1,fontSize:13}}>{addPaySaving?"Saving...":"Record Payment"}</button><button className="btn-g" onClick={()=>setAddPaySale(null)} style={{fontSize:13}}>Cancel</button></div>
                </div>
              ):pendingSales.map(s=>(
                <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1A2A4A"}}>
                  <div><div style={{fontSize:13,fontWeight:500}}>{s.customer_name}</div><div style={{fontSize:11,color:"#8899AA"}}>{s.receipt_no} · Total {fmtK(Number(s.total))} · Paid {fmtK(Number(s.amount_paid||0))}</div></div>
                  <div style={{textAlign:"right"}}><div style={{color:"#E8A45B",fontSize:13,fontWeight:600}}>{fmtK(Number(s.balance_due))}</div><button className="btn-g" onClick={()=>setAddPaySale(s)} style={{fontSize:11,padding:"4px 10px",marginTop:4}}>Add payment</button></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{marginTop:6}}>
        <div style={{fontSize:12,color:"#FFFFFF",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:10}}>New sale · who is serving?</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {STAFF.map(s=><button key={s} className="staff-btn" onClick={()=>openWiz(s)}>{s.split(" ")[0]}</button>)}
        </div>
      </div>

      {wiz&&(
        <div className="wiz-overlay">
          <div className="wiz">
            <div className="wiz-hd">
              <div><div style={{fontSize:14,fontWeight:600,color:"#FFFFFF"}}>New Sale</div><div style={{fontSize:12,color:"#8899AA"}}>{staff.split(" ")[0]} · Step {step} of 3</div></div>
              <button onClick={closeWiz} style={{background:"none",border:"none",color:"#8899AA",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
            </div>
            <div className="wiz-steps">{[1,2,3].map(n=><div key={n} className={`wiz-dot${step>=n?" on":""}`}/>)}</div>
            <div className="wiz-body">
              {step===1&&(<>
                <div style={{fontSize:16,fontWeight:600,color:"#FFFFFF",marginBottom:14}}>Customer</div>
                <div style={{background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:8,padding:10,marginBottom:14}}>
                  <div style={{fontSize:11,color:"#8899AA",marginBottom:6}}>Paste M-Pesa or SACCO SMS to auto-fill (optional)</div>
                  <textarea value={sms} onChange={e=>handleSms(e.target.value)} placeholder="Paste SMS here..." style={{width:"100%",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:6,padding:"8px 10px",color:"#E8E2D4",fontSize:13,resize:"none",minHeight:52,fontFamily:"'DM Sans',sans-serif"}}/>
                  {parsed&&(parsed.code||parsed.amount>0)&&<div style={{fontSize:12,color:"#4CAF50",marginTop:4}}>{parsed.type==="sacco"?"SACCO":"M-Pesa"} · {parsed.code||"no ref"} · {fmtK(parsed.amount)} · {parsed.name||"no name"}</div>}
                </div>
                <div className="field"><label>Customer name</label><input value={cName} onChange={e=>setCName(e.target.value)} placeholder="Full name" autoFocus/></div>
                <div className="field"><label>Phone (optional)</label><input value={cPhone} onChange={e=>setCPhone(e.target.value)} placeholder="07XX XXX XXX" type="tel"/></div>
              </>)}
              {step===2&&(<>
                <div style={{fontSize:16,fontWeight:600,color:"#FFFFFF",marginBottom:4}}>Items</div>
                <div style={{fontSize:12,color:"#8899AA",marginBottom:14}}>Type to search stock. Price fills automatically.</div>
                {items.map(i=>(
                  <div key={i.id} style={{background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:8,padding:10,marginBottom:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 28px",gap:6,marginBottom:7}}>
                      <AutocompleteInput value={i.name} onChange={v=>upItem(i.id,"name",v)} onSelect={s=>selectStock(i.id,s)} stockItems={stockItems} placeholder="Search stock..."/>
                      <button onClick={()=>rmItem(i.id)} style={{background:"none",border:"none",color:"#E85B5B",cursor:"pointer",fontSize:16,paddingTop:6}}>x</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      <div><div style={{fontSize:11,color:"#8899AA",marginBottom:3}}>QTY</div><input type="number" value={i.qty} min={1} onChange={e=>upItem(i.id,"qty",e.target.value)} style={{width:"100%",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:6,padding:"8px 10px",color:"#E8E2D4",fontSize:13,textAlign:"center"}}/></div>
                      <div><div style={{fontSize:11,color:"#8899AA",marginBottom:3}}>UNIT PRICE (KSh)</div><input type="number" value={i.price} min={0} onChange={e=>upItem(i.id,"price",e.target.value)} placeholder="0" style={{width:"100%",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:6,padding:"8px 10px",color:"#E8E2D4",fontSize:13}}/></div>
                    </div>
                    {i.name&&i.price&&i.qty&&<div style={{fontSize:11,color:"#F5C000",marginTop:5,textAlign:"right"}}>{fmtK(Number(i.qty)*Number(i.price))}</div>}
                  </div>
                ))}
                <button className="btn-g" onClick={addItem} style={{width:"100%",fontSize:13}}>+ Add another item</button>
                {total>0&&<div style={{textAlign:"right",marginTop:12,fontSize:16,fontWeight:600,color:"#F5C000"}}>Total {fmtK(total)}</div>}
              </>)}
              {step===3&&(<>
                <div style={{fontSize:16,fontWeight:600,color:"#FFFFFF",marginBottom:12}}>Payment</div>
                <div style={{background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:8,padding:12,marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{cName}{cPhone?<span style={{color:"#8899AA",fontWeight:400}}> · {cPhone}</span>:null}</div>
                  {validItems.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#8899AA",padding:"2px 0"}}><span>{i.name} x{i.qty}</span><span>{fmtK(Number(i.qty)*Number(i.price))}</span></div>)}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:600,color:"#F5C000",marginTop:6,paddingTop:6,borderTop:"1px solid #1A2A4A"}}><span>Total</span><span>{fmtK(total)}</span></div>
                </div>
                <div className="field"><label>Payment type</label><div className="tog"><button className={`tog-btn${payType==="full"?" on":""}`} onClick={()=>setPayType("full")}>Full</button><button className={`tog-btn${payType==="instalment"?" on":""}`} onClick={()=>setPayType("instalment")}>Instalment</button></div></div>
                {payType==="instalment"&&<div className="field" style={{background:"rgba(232,164,91,0.08)",border:"1px solid rgba(232,164,91,0.3)",borderRadius:8,padding:12}}><label style={{color:"#E8A45B"}}>Paying now (KSh)</label><input type="number" value={initPay} onChange={e=>setInitPay(e.target.value)} placeholder="Amount"/>{initPay&&<div style={{fontSize:12,color:"#E8A45B",marginTop:6}}>Balance: {fmtK(Math.max(0,total-Number(initPay)))}</div>}</div>}
                <div className="field"><label>Method</label><div className="tog"><button className={`tog-btn${pay==="mpesa"?" on":""}`} onClick={()=>setPay("mpesa")}>M-Pesa</button><button className={`tog-btn${pay==="cash"?" on":""}`} onClick={()=>setPay("cash")}>Cash</button></div></div>
                {pay==="mpesa"&&<div className="field"><label>M-Pesa code</label><input value={mpesaCode} onChange={e=>setMpesaCode(e.target.value.toUpperCase())} placeholder="e.g. QJK7X8Y9Z0" style={{fontFamily:"monospace",letterSpacing:"0.05em"}}/></div>}
                <div className="field"><label>Notes (optional)</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Deliver Saturday"/></div>
              </>)}
              {err&&<div style={{color:"#E85B5B",fontSize:13,marginTop:8}}>{err}</div>}
            </div>
            <div className="wiz-ft">
              {step>1&&<button className="btn-g" onClick={()=>{setErr("");setStep(step-1);}} style={{fontSize:13}}>Back</button>}
              {step<3&&<button className="btn-y" onClick={nextStep} style={{flex:1,fontSize:14}}>Next</button>}
              {step===3&&<><button className="btn-g" onClick={()=>genReceipt(false)} disabled={saving} style={{flex:1,fontSize:13}}>{saving?"Saving...":"Record Sale"}</button><button className="btn-y" onClick={()=>genReceipt(true)} disabled={saving} style={{flex:1,fontSize:13}}>{saving?"Saving...":"Record + Receipt"}</button></>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StockTab({onMoney}){
  const [trips,setTrips]=useState([]); const [stock,setStock]=useState([]); const [audit,setAudit]=useState([]);
  const [loading,setLoading]=useState(true); const [view,setView]=useState("list");
  const [expanded,setExpanded]=useState({}); const [editItem,setEditItem]=useState(null);
  const [editVals,setEditVals]=useState({}); const [editReason,setEditReason]=useState("");
  const [editStaff,setEditStaff]=useState("Burton Kariuki"); const [lockStaff,setLockStaff]=useState("Burton Kariuki");
  const [saving,setSaving]=useState(false); const [err,setErr]=useState("");
  const [addingToTrip,setAddingToTrip]=useState(null);
  const [adjItem,setAdjItem]=useState(null); const [adjQty,setAdjQty]=useState(1); const [adjReason,setAdjReason]=useState("Damaged"); const [adjNotes,setAdjNotes]=useState(""); const [adjStaff,setAdjStaff]=useState("Burton Kariuki");
  const [addExtraItems,setAddExtraItems]=useState([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
  const [trip,setTrip]=useState({date:new Date().toISOString().split("T")[0],notes:"",created_by:"Burton Kariuki",paid_from:"sacco"});
  const [tripItems,setTripItems]=useState([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);

  useEffect(()=>{loadAll();},[]);
  const loadAll=async()=>{
    setLoading(true);
    try{
      const [t,s,a]=await Promise.all([
        sb.get("karu_trips","select=*&order=created_at.desc"),
        sb.get("karu_stock","select=*&order=created_at.desc"),
        sb.get("karu_audit","select=*&order=changed_at.desc&limit=300")
      ]);
      setTrips(t); setStock(s); setAudit(a);
    }catch(e){console.error(e);}
    setLoading(false);
  };

  const toggleExpand=id=>setExpanded(x=>({...x,[id]:!x[id]}));
  const stockForTrip=tripNo=>stock.filter(s=>s.trip_no===tripNo);
  const auditForTrip=tripNo=>audit.filter(a=>a.trip_no===tripNo);

  const lockTrip=async t=>{
    if(!confirm(`Lock ${t.trip_no}? No edits after this.`)) return;
    setSaving(true);
    try{
      await sb.patch("karu_trips",t.id,{status:"locked",locked_by:lockStaff,locked_at:new Date().toISOString()});
      await logAudit({trip_no:t.trip_no,record_id:t.id,action:"lock",reason:"Trip confirmed and locked",changed_by:lockStaff});
      await loadAll();
    }catch(e){alert("Lock failed: "+e.message);}
    setSaving(false);
  };

  const startEdit=(item,t)=>{
    if(t.status==="locked"){alert("This trip is locked.");return;}
    setEditItem(item);
    setEditVals({name:item.name,category:item.category,qty_in:item.qty_in,unit_cost:item.unit_cost,selling_price:item.selling_price});
    setEditReason(""); setErr("");
  };

  const saveEdit=async()=>{
    if(!editReason.trim()){setErr("Reason required.");return;}
    setSaving(true); setErr("");
    try{
      const changes=Object.keys(editVals).filter(f=>String(editVals[f])!==String(editItem[f]));
      for(const f of changes){
        await logAudit({trip_no:editItem.trip_no,record_id:editItem.id,action:"edit",field_changed:f,old_value:String(editItem[f]),new_value:String(editVals[f]),reason:editReason,changed_by:editStaff});
      }
      await sb.patch("karu_stock",editItem.id,editVals);
      setEditItem(null);
      await loadAll();
    }catch(e){setErr("Save failed: "+e.message);}
    setSaving(false);
  };

  const doAdjust=async()=>{
    const q=Number(adjQty); const avail=adjItem.qty_in-adjItem.qty_sold-(adjItem.qty_adjusted||0);
    if(!q||q<1){alert("Enter quantity.");return;} if(q>avail){alert(`Only ${avail} available.`);return;}
    setSaving(true);
    try{
      await sb.post("karu_adjustments",{stock_id:adjItem.id,item_name:adjItem.name,trip_no:adjItem.trip_no,qty:q,reason:adjReason,notes:adjNotes,recorded_by:adjStaff,date:todayStr()});
      await sb.patch("karu_stock",adjItem.id,{qty_adjusted:(adjItem.qty_adjusted||0)+q});
      await logAudit({trip_no:adjItem.trip_no,record_id:adjItem.id,action:"adjust",field_changed:adjItem.name,old_value:String(avail),new_value:String(avail-q),reason:`${adjReason}${adjNotes?" · "+adjNotes:""}`,changed_by:adjStaff});
      setAdjItem(null); setAdjQty(1); setAdjNotes("");
      await loadAll();
    }catch(e){alert("Failed: "+e.message);}
    setSaving(false);
  };

  const saveAddItems=async(t)=>{
    const vi=addExtraItems.filter(i=>i.name&&Number(i.unit_cost)>0);
    if(!vi.length){alert("Add at least one item with name and cost.");return;}
    setSaving(true);
    try{
      await sb.post("karu_stock",vi.map(i=>({trip_id:t.id,trip_no:t.trip_no,name:i.name,category:i.category,qty_in:Number(i.qty_in),qty_sold:0,unit_cost:Number(i.unit_cost),selling_price:Number(i.selling_price||0),date_in:t.date})));
      const addedCost=vi.reduce((s,i)=>s+(Number(i.qty_in)*Number(i.unit_cost)),0);
      await sb.patch("karu_trips",t.id,{total_cost:Number(t.total_cost)+addedCost});
      const pf=t.paid_from||"sacco"; const ashort=lockStaff.split(" ")[0];
      if(pf==="personal") await recordMoney({account:"owed_"+ashort.toLowerCase(),amount:addedCost,type:"trip_personal",partner:lockStaff,description:`${t.trip_no} extra items (paid by ${ashort})`,date:t.date,recorded_by:lockStaff});
      else await recordMoney({account:pf,amount:-addedCost,type:"trip",ref:t.trip_no,description:`${t.trip_no} extra items`,date:t.date,recorded_by:lockStaff});
      if(onMoney) onMoney();
      await logAudit({trip_no:t.trip_no,record_id:t.id,action:"add_items",reason:`Added ${vi.length} item(s) to trip`,changed_by:lockStaff});
      setAddingToTrip(null);
      setAddExtraItems([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
      await loadAll();
    }catch(e){alert("Failed: "+e.message);}
    setSaving(false);
  };

  const addTI=()=>setTripItems(x=>[...x,{id:Date.now(),name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
  const rmTI=id=>setTripItems(x=>x.filter(i=>i.id!==id));
  const upTI=(id,f,v)=>setTripItems(x=>x.map(i=>i.id===id?{...i,[f]:v}:i));

  const saveTrip=async()=>{
    const vi=tripItems.filter(i=>i.name&&Number(i.unit_cost)>0);
    if(!vi.length){setErr("Add at least one item.");return;}
    setSaving(true); setErr("");
    try{
      const tripNo=`KARU-TRIP-${String(trips.length+1).padStart(3,"0")}`;
      const totalCost=vi.reduce((s,i)=>s+(Number(i.qty_in)*Number(i.unit_cost)),0);
      const [newTrip]=await sb.post("karu_trips",{trip_no:tripNo,date:trip.date,notes:trip.notes,total_cost:totalCost,created_by:trip.created_by,status:"open",paid_from:trip.paid_from});
      const tshort=trip.created_by.split(" ")[0];
      if(trip.paid_from==="personal"){
        await recordMoney({account:"owed_"+tshort.toLowerCase(),amount:totalCost,type:"trip_personal",partner:trip.created_by,description:`${tripNo} (paid by ${tshort})`,date:trip.date,recorded_by:trip.created_by});
      } else {
        await recordMoney({account:trip.paid_from,amount:-totalCost,type:"trip",ref:tripNo,description:`Sourcing ${tripNo}`,date:trip.date,recorded_by:trip.created_by});
      }
      if(onMoney) onMoney();
      await sb.post("karu_stock",vi.map(i=>({trip_id:newTrip.id,trip_no:tripNo,name:i.name,category:i.category,qty_in:Number(i.qty_in),qty_sold:0,unit_cost:Number(i.unit_cost),selling_price:Number(i.selling_price||0),date_in:trip.date})));
      await logAudit({trip_no:tripNo,record_id:newTrip.id,action:"create",reason:"New sourcing trip",changed_by:trip.created_by});
      await loadAll();
      setView("list");
      setTripItems([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
      setTrip({date:new Date().toISOString().split("T")[0],notes:"",created_by:"Burton Kariuki",paid_from:"sacco"});
    }catch(e){setErr("Save failed: "+e.message);}
    setSaving(false);
  };

  const totalSV=stock.reduce((s,i)=>s+((i.qty_in-i.qty_sold-(i.qty_adjusted||0))*i.unit_cost),0);
  const totalU=stock.reduce((s,i)=>s+(i.qty_in-i.qty_sold-(i.qty_adjusted||0)),0);

  if(adjItem) return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button className="btn-g" onClick={()=>{setAdjItem(null);setAdjNotes("");}}>Cancel</button>
        <div style={{fontSize:15,fontWeight:600}}>Stock Adjustment</div>
      </div>
      <div style={{background:"#0A1128",border:"1px solid rgba(232,164,91,0.3)",borderRadius:8,padding:12,marginBottom:14,fontSize:12,color:"#8899AA"}}>
        <strong style={{color:"#E8E2D4"}}>{adjItem.name}</strong> · {adjItem.trip_no} · {adjItem.qty_in-adjItem.qty_sold-(adjItem.qty_adjusted||0)} available
      </div>
      <div className="field"><label>Reason</label><div className="tog">{["Damaged","Display","Personal use","Other"].map(r=><button key={r} className={`tog-btn${adjReason===r?" on":""}`} onClick={()=>setAdjReason(r)} style={{fontSize:12}}>{r}</button>)}</div></div>
      <div className="field"><label>Quantity</label><input type="number" value={adjQty} min={1} onChange={e=>setAdjQty(e.target.value)}/></div>
      <div className="field"><label>Notes (optional)</label><input value={adjNotes} onChange={e=>setAdjNotes(e.target.value)} placeholder="e.g. Leg broke during delivery"/></div>
      <div className="field"><label>Recorded by</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${adjStaff===s?" on":""}`} onClick={()=>setAdjStaff(s)}>{s.split(" ")[0]}</button>)}</div></div>
      <button className="btn-y" onClick={doAdjust} disabled={saving} style={{width:"100%",padding:14}}>{saving?"Saving...":"Remove from Stock"}</button>
    </div>
  );

  if(editItem) return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button className="btn-g" onClick={()=>{setEditItem(null);setErr("");}}>Cancel</button>
        <div style={{fontSize:15,fontWeight:600}}>Edit Item</div>
      </div>
      <div style={{background:"#0A1128",border:"1px solid rgba(245,192,0,0.25)",borderRadius:8,padding:12,marginBottom:14,fontSize:12,color:"#8899AA"}}>
        Editing <strong style={{color:"#E8E2D4"}}>{editItem.name}</strong> from {editItem.trip_no}. All changes are timestamped and logged.
      </div>
      <div className="field"><label>Name</label><input value={editVals.name} onChange={e=>setEditVals(x=>({...x,name:e.target.value}))}/></div>
      <div className="field"><label>Category</label><select value={editVals.category} onChange={e=>setEditVals(x=>({...x,category:e.target.value}))}>{CAT_OPTS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <div className="field"><label>Qty in</label><input type="number" value={editVals.qty_in} onChange={e=>setEditVals(x=>({...x,qty_in:Number(e.target.value)}))}/></div>
        <div className="field"><label>Cost (KSh)</label><input type="number" value={editVals.unit_cost} onChange={e=>setEditVals(x=>({...x,unit_cost:Number(e.target.value)}))}/></div>
        <div className="field"><label>Sell at (KSh)</label><input type="number" value={editVals.selling_price} onChange={e=>setEditVals(x=>({...x,selling_price:Number(e.target.value)}))}/></div>
      </div>
      <div className="field"><label>Who is editing</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${editStaff===s?" on":""}`} onClick={()=>setEditStaff(s)}>{s.split(" ")[0]}</button>)}</div></div>
      <div className="field"><label>Reason for edit (required)</label><textarea value={editReason} onChange={e=>setEditReason(e.target.value)} placeholder="Explain what is being corrected and why..."/></div>
      {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:12}}>{err}</div>}
      <button className="btn-y" onClick={saveEdit} disabled={saving} style={{width:"100%",padding:14}}>{saving?"Saving...":"Save Changes"}</button>
    </div>
  );

  if(view==="new") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button className="btn-g" onClick={()=>setView("list")}>Back</button>
        <div style={{fontSize:15,fontWeight:600}}>New Sourcing Trip</div>
        <div className="badge b-y">KARU-TRIP-{String(trips.length+1).padStart(3,"0")}</div>
      </div>
      <div className="field"><label>Date</label><input type="date" value={trip.date} onChange={e=>setTrip(x=>({...x,date:e.target.value}))}/></div>
      <div className="field"><label>Recorded by</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${trip.created_by===s?" on":""}`} onClick={()=>setTrip(x=>({...x,created_by:s}))}>{s.split(" ")[0]}</button>)}</div></div>
      <div className="field"><label>Notes</label><input value={trip.notes} onChange={e=>setTrip(x=>({...x,notes:e.target.value}))} placeholder="e.g. Gachie sourcing run"/></div>
      <div className="field"><label>Paid from</label><div className="tog"><button className={`tog-btn${trip.paid_from==="cash"?" on":""}`} onClick={()=>setTrip(x=>({...x,paid_from:"cash"}))}>Cash</button><button className={`tog-btn${trip.paid_from==="sacco"?" on":""}`} onClick={()=>setTrip(x=>({...x,paid_from:"sacco"}))}>SACCO</button><button className={`tog-btn${trip.paid_from==="personal"?" on":""}`} onClick={()=>setTrip(x=>({...x,paid_from:"personal"}))}>Personal</button></div>
      {trip.paid_from==="personal"&&<div style={{fontSize:11,color:"#E8A45B",marginTop:5}}>Business will owe {trip.created_by.split(" ")[0]} this amount</div>}</div>
      <div className="field">
        <label>Items purchased</label>
        {tripItems.map(i=>(
          <div key={i.id} style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:10,marginBottom:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 28px",gap:6,marginBottom:7}}>
              <input value={i.name} onChange={e=>upTI(i.id,"name",e.target.value)} placeholder="Item name" style={{width:"100%",background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"9px 10px",color:"#E8E2D4",fontSize:13}}/>
              <button onClick={()=>rmTI(i.id)} style={{background:"none",border:"none",color:"#E85B5B",cursor:"pointer",fontSize:16}}>x</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
              <select value={i.category} onChange={e=>upTI(i.id,"category",e.target.value)} style={{background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"9px 10px",color:"#E8E2D4",fontSize:12}}>{CAT_OPTS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <input type="number" value={i.qty_in} min={1} onChange={e=>upTI(i.id,"qty_in",e.target.value)} placeholder="Qty" style={{width:"100%",background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"9px 10px",color:"#E8E2D4",fontSize:13,textAlign:"center"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <input type="number" value={i.unit_cost} onChange={e=>upTI(i.id,"unit_cost",e.target.value)} placeholder="Cost each (KSh)" style={{width:"100%",background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"9px 10px",color:"#E8E2D4",fontSize:12}}/>
              <input type="number" value={i.selling_price} onChange={e=>upTI(i.id,"selling_price",e.target.value)} placeholder="Sell at (KSh)" style={{width:"100%",background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"9px 10px",color:"#E8E2D4",fontSize:12}}/>
            </div>
            {i.unit_cost&&i.selling_price&&<div style={{fontSize:11,color:"#8899AA",marginTop:5}}>Margin: {Math.round((1-i.unit_cost/i.selling_price)*100)}% | Cost: KSh {(Number(i.qty_in||1)*Number(i.unit_cost)).toLocaleString()}</div>}
          </div>
        ))}
        <button className="btn-g" onClick={addTI} style={{width:"100%",marginTop:4}}>+ Add item</button>
        {tripItems.some(i=>i.unit_cost&&i.qty_in)&&<div style={{textAlign:"right",marginTop:8,fontSize:14,fontWeight:600,color:"#F5C000"}}>Total: KSh {tripItems.reduce((s,i)=>s+(Number(i.qty_in||0)*Number(i.unit_cost||0)),0).toLocaleString()}</div>}
      </div>
      {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:12}}>{err}</div>}
      <button className="btn-y" onClick={saveTrip} disabled={saving} style={{width:"100%",padding:14}}>{saving?"Saving...":"Save Sourcing Trip"}</button>
    </div>
  );

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div className="stat"><div className="stat-n" style={{color:"#F5C000"}}>KSh {totalSV.toLocaleString()}</div><div className="stat-l">Stock value</div></div>
        <div className="stat"><div className="stat-n" style={{color:"#4CAF50"}}>{totalU}</div><div className="stat-l">Units available</div></div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
        <button className="btn-y" onClick={()=>setView("new")} style={{fontSize:13,padding:"9px 16px"}}>+ New Trip</button>
      </div>
      {loading?<div style={{textAlign:"center",padding:"2rem",color:"#556677"}}>Loading...</div>:trips.length===0?<div style={{textAlign:"center",padding:"2rem",color:"#556677"}}>No trips yet.</div>:trips.map(t=>{
        const isOpen=expanded[t.id];
        const tItems=stockForTrip(t.trip_no);
        const logs=auditForTrip(t.trip_no);
        const locked=t.status==="locked";
        return (
          <div key={t.id} className="card" style={{borderLeft:`3px solid ${locked?"#4CAF50":"#F5C000"}`}}>
            <div className="trip-hdr" onClick={()=>toggleExpand(t.id)}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:14,fontWeight:600,color:"#F5C000"}}>{t.trip_no}</span>
                  <span className={`badge ${locked?"b-g":"b-y"}`}>{locked?"Locked":"Open"}</span>
                </div>
                <div style={{fontSize:12,color:"#8899AA"}}>{t.date} · {t.created_by?.split(" ")[0]} · KSh {Number(t.total_cost).toLocaleString()} · {tItems.length} item{tItems.length!==1?"s":""}</div>
                {locked&&<div style={{fontSize:11,color:"#4CAF50",marginTop:2}}>Locked by {t.locked_by?.split(" ")[0]} on {t.locked_at?new Date(t.locked_at).toLocaleDateString("en-KE"):""}</div>}
              </div>
              <span style={{color:"#556677",fontSize:18}}>{isOpen?"▲":"▼"}</span>
            </div>
            {isOpen&&(
              <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #1A2A4A"}}>
                {tItems.map(s=>{
                  const adj=s.qty_adjusted||0; const avail=s.qty_in-s.qty_sold-adj;
                  return (
                    <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:"1px solid #0F1A3A"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500}}>{s.name}</div>
                        <div style={{fontSize:11,color:"#8899AA",marginTop:2}}>{catLabel(s.category)} · Cost: KSh {Number(s.unit_cost).toLocaleString()} · Sell: KSh {Number(s.selling_price).toLocaleString()}</div>
                        <div style={{fontSize:11,color:"#556677",marginTop:1}}>In: {s.qty_in} · Sold: {s.qty_sold}{adj>0?` · Adjusted: ${adj}`:""} · Left: {avail}</div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                        <span className={`badge ${avail>0?"b-g":"b-r"}`}>{avail>0?`${avail} left`:"None left"}</span>
                        <div style={{display:"flex",gap:4}}>
                          {avail>0&&<button className="btn-g" onClick={()=>{setAdjItem(s);setAdjQty(1);}} style={{fontSize:11,padding:"4px 8px"}}>Adjust</button>}
                          {!locked&&<button className="btn-r" onClick={()=>startEdit(s,t)} style={{fontSize:11,padding:"4px 8px"}}>Edit</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!locked&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #0F1A3A"}}>
                    {addingToTrip?.id===t.id?(
                      <div>
                        <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:"#F5C000"}}>Add items to {t.trip_no}</div>
                        {addExtraItems.map(i=>(
                          <div key={i.id} style={{background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:8,padding:8,marginBottom:7}}>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 28px",gap:5,marginBottom:5}}>
                              <input value={i.name} onChange={e=>setAddExtraItems(x=>x.map(a=>a.id===i.id?{...a,name:e.target.value}:a))} placeholder="Item name" style={{width:"100%",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:5,padding:"7px 9px",color:"#E8E2D4",fontSize:12}}/>
                              <button onClick={()=>setAddExtraItems(x=>x.filter(a=>a.id!==i.id))} style={{background:"none",border:"none",color:"#E85B5B",cursor:"pointer",fontSize:14}}>x</button>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
                              <select value={i.category} onChange={e=>setAddExtraItems(x=>x.map(a=>a.id===i.id?{...a,category:e.target.value}:a))} style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:5,padding:"7px 8px",color:"#E8E2D4",fontSize:11}}>{CAT_OPTS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
                              <input type="number" value={i.qty_in} min={1} onChange={e=>setAddExtraItems(x=>x.map(a=>a.id===i.id?{...a,qty_in:e.target.value}:a))} placeholder="Qty" style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:5,padding:"7px 8px",color:"#E8E2D4",fontSize:11,textAlign:"center",width:"100%"}}/>
                              <input type="number" value={i.unit_cost} onChange={e=>setAddExtraItems(x=>x.map(a=>a.id===i.id?{...a,unit_cost:e.target.value}:a))} placeholder="Cost (KSh)" style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:5,padding:"7px 8px",color:"#E8E2D4",fontSize:11,width:"100%"}}/>
                            </div>
                          </div>
                        ))}
                        <button className="btn-g" onClick={()=>setAddExtraItems(x=>[...x,{id:Date.now(),name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}])} style={{width:"100%",fontSize:12,marginBottom:8}}>+ Add another</button>
                        <div style={{display:"flex",gap:8}}>
                          <button className="btn-y" onClick={()=>saveAddItems(t)} disabled={saving} style={{flex:1,fontSize:12}}>{saving?"Saving...":"Save Items"}</button>
                          <button className="btn-g" onClick={()=>{setAddingToTrip(null);setAddExtraItems([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);}} style={{fontSize:12}}>Cancel</button>
                        </div>
                      </div>
                    ):(
                      <button className="btn-g" onClick={()=>setAddingToTrip(t)} style={{width:"100%",fontSize:12,marginBottom:10}}>+ Add forgotten items to this trip</button>
                    )}
                  </div>
                )}
                {!locked&&(
                  <div style={{marginTop:12}}>
                    <div style={{fontSize:11,color:"#8899AA",marginBottom:6}}>Lock confirmed by</div>
                    <div className="tog" style={{marginBottom:8}}>{STAFF.map(s=><button key={s} className={`tog-btn${lockStaff===s?" on":""}`} onClick={()=>setLockStaff(s)}>{s.split(" ")[0]}</button>)}</div>
                    <button onClick={()=>lockTrip(t)} disabled={saving} style={{width:"100%",background:"rgba(76,175,80,0.1)",border:"1px solid rgba(76,175,80,0.3)",color:"#4CAF50",padding:"9px",borderRadius:6,cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Lock Trip — No further edits</button>
                  </div>
                )}
                {logs.length>0&&(
                  <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #0F1A3A"}}>
                    <div style={{fontSize:11,color:"#556677",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Audit trail</div>
                    {logs.map(a=>(
                      <div key={a.id} className="audit-entry">
                        <span style={{color:"#8899AA"}}>{new Date(a.changed_at).toLocaleDateString("en-KE",{day:"2-digit",month:"short"})} {new Date(a.changed_at).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit",hour12:true})}</span>
                        {" "}<span style={{color:"#E8E2D4"}}>{a.changed_by?.split(" ")[0]}</span>
                        {" "}<span style={{color:"#F5C000"}}>{a.action}</span>
                        {a.field_changed&&<span style={{color:"#8899AA"}}> · {a.field_changed}: {a.old_value} to {a.new_value}</span>}
                        {a.reason&&<div style={{color:"#556677",paddingLeft:4}}>"{a.reason}"</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExpensesTab({onMoney}){
  const [exp,setExp]=useState([]);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({date:new Date().toISOString().split("T")[0],category:"Rent",description:"",amount:"",recorded_by:"Burton Kariuki",paid_from:"sacco"});
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const [showForm,setShowForm]=useState(false);

  useEffect(()=>{loadExp();},[]);
  const loadExp=async()=>{
    setLoading(true);
    try{ const e=await sb.get("karu_expenses","select=*&order=date.desc,created_at.desc&limit=60"); setExp(e); }
    catch(e){console.error(e);}
    setLoading(false);
  };

  const save=async()=>{
    if(!form.amount||Number(form.amount)<=0){setErr("Enter a valid amount.");return;}
    setSaving(true); setErr("");
    try{
      await sb.post("karu_expenses",{...form,amount:Number(form.amount)});
      const a=Number(form.amount); const short=form.recorded_by.split(" ")[0]; const lbl=`${form.category}${form.description?" · "+form.description:""}`;
      if(form.paid_from==="personal"){
        await recordMoney({account:"owed_"+short.toLowerCase(),amount:a,type:"expense_personal",partner:form.recorded_by,description:`${lbl} (paid by ${short})`,date:form.date,recorded_by:form.recorded_by});
      } else {
        await recordMoney({account:form.paid_from,amount:-a,type:"expense",description:lbl,date:form.date,recorded_by:form.recorded_by});
      }
      if(onMoney) onMoney();
      await loadExp();
      setShowForm(false);
      setForm({date:new Date().toISOString().split("T")[0],category:"Rent",description:"",amount:"",recorded_by:"Burton Kariuki",paid_from:"sacco"});
    }catch(e){setErr("Save failed: "+e.message);}
    setSaving(false);
  };

  const thisMonth=exp.filter(e=>e.date.startsWith(new Date().toISOString().slice(0,7)));
  const monthTotal=thisMonth.reduce((s,e)=>s+Number(e.amount),0);

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div className="stat"><div className="stat-n" style={{color:"#E85B5B"}}>KSh {monthTotal.toLocaleString()}</div><div className="stat-l">This month</div></div>
        <div className="stat"><div className="stat-n" style={{color:"#8899AA"}}>{thisMonth.length}</div><div className="stat-l">Entries</div></div>
      </div>
      {!showForm&&<button className="btn-y" onClick={()=>setShowForm(true)} style={{width:"100%",marginBottom:14}}>+ Log Expense</button>}
      {showForm&&(
        <div className="card" style={{marginBottom:14,border:"1px solid rgba(245,192,0,0.25)"}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Log Expense</div>
          <div className="field"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm(x=>({...x,date:e.target.value}))}/></div>
          <div className="field"><label>Category</label><select value={form.category} onChange={e=>setForm(x=>({...x,category:e.target.value}))}>{EXP_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
          <div className="field"><label>Description</label><input value={form.description} onChange={e=>setForm(x=>({...x,description:e.target.value}))} placeholder="e.g. October rent payment"/></div>
          <div className="field"><label>Amount (KSh)</label><input type="number" value={form.amount} onChange={e=>setForm(x=>({...x,amount:e.target.value}))} placeholder="0"/></div>
          <div className="field"><label>Recorded by</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${form.recorded_by===s?" on":""}`} onClick={()=>setForm(x=>({...x,recorded_by:s}))}>{s.split(" ")[0]}</button>)}</div></div>
          <div className="field"><label>Paid from</label><div className="tog"><button className={`tog-btn${form.paid_from==="cash"?" on":""}`} onClick={()=>setForm(x=>({...x,paid_from:"cash"}))}>Cash</button><button className={`tog-btn${form.paid_from==="sacco"?" on":""}`} onClick={()=>setForm(x=>({...x,paid_from:"sacco"}))}>SACCO</button><button className={`tog-btn${form.paid_from==="personal"?" on":""}`} onClick={()=>setForm(x=>({...x,paid_from:"personal"}))}>Personal</button></div>
          {form.paid_from==="personal"&&<div style={{fontSize:11,color:"#E8A45B",marginTop:5}}>Business will owe {form.recorded_by.split(" ")[0]} this amount</div>}</div>
          {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:10}}>{err}</div>}
          <div style={{display:"flex",gap:8}}>
            <button className="btn-y" onClick={save} disabled={saving} style={{flex:1}}>{saving?"Saving...":"Save"}</button>
            <button className="btn-g" onClick={()=>{setShowForm(false);setErr("");}}>Cancel</button>
          </div>
        </div>
      )}
      {loading?<div style={{textAlign:"center",padding:"2rem",color:"#556677"}}>Loading...</div>:exp.length===0?<div style={{textAlign:"center",padding:"2rem",color:"#556677"}}>No expenses logged yet.</div>:(
        <div>
          <div style={{fontSize:12,color:"#556677",marginBottom:10}}>Recent expenses</div>
          {exp.map(e=>(
            <div key={e.id} className="card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div><span className="badge b-r" style={{marginRight:8}}>{e.category}</span><span style={{fontSize:13,fontWeight:500}}>{e.description||e.category}</span></div>
                <span style={{fontSize:14,fontWeight:600,color:"#E85B5B"}}>KSh {Number(e.amount).toLocaleString()}</span>
              </div>
              <div style={{fontSize:11,color:"#556677"}}>{e.date} · {e.recorded_by?.split(" ")[0]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportsTab(){
  const [data,setData]=useState({sales:[],expenses:[],stock:[]});
  const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState("month");

  useEffect(()=>{loadAll();},[]);
  const loadAll=async()=>{
    setLoading(true);
    try{
      const [sales,expenses,stock]=await Promise.all([
        sb.get("karu_sales","select=*&voided=eq.false&order=date.desc"),
        sb.get("karu_expenses","select=*&order=date.desc"),
        sb.get("karu_stock","select=*")
      ]);
      setData({sales,expenses,stock});
    }catch(e){console.error(e);}
    setLoading(false);
  };

  const exportCSV=async(kind)=>{
    const esc=v=>{const s=v==null?"":String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
    const dl=(name,rows)=>{
      if(!rows.length){alert("Nothing to export.");return;}
      const cols=Object.keys(rows[0]);
      const csv=[cols.join(","),...rows.map(r=>cols.map(c=>esc(r[c])).join(","))].join("\n");
      const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`karu-${name}-${todayStr()}.csv`; a.click();
    };
    try{
      if(kind==="sales"){
        const all=await sb.get("karu_sales","select=*&order=date.desc");
        dl("sales",all.map(s=>({receipt_no:s.receipt_no,date:s.date,time:s.time_str,served_by:s.served_by,customer:s.customer_name,phone:s.customer_phone,items:(s.items||[]).map(i=>`${i.name} x${i.qty} @${i.price}`).join("; "),total:s.total,amount_paid:s.amount_paid??s.total,balance_due:s.balance_due||0,payment:s.payment_method,mpesa_code:s.mpesa_code,notes:s.notes,voided:s.voided?"YES":"",void_reason:s.void_reason})));
      } else if(kind==="expenses"){
        const all=await sb.get("karu_expenses","select=*&order=date.desc");
        dl("expenses",all.map(e=>({date:e.date,category:e.category,description:e.description,amount:e.amount,paid_from:e.paid_from,recorded_by:e.recorded_by})));
      } else if(kind==="stock"){
        const all=await sb.get("karu_stock","select=*&order=trip_no.asc");
        dl("stock",all.map(s=>({trip_no:s.trip_no,date_in:s.date_in,item:s.name,category:s.category,qty_in:s.qty_in,qty_sold:s.qty_sold,qty_adjusted:s.qty_adjusted||0,qty_available:s.qty_in-s.qty_sold-(s.qty_adjusted||0),unit_cost:s.unit_cost,selling_price:s.selling_price,stock_value:(s.qty_in-s.qty_sold-(s.qty_adjusted||0))*s.unit_cost})));
      } else if(kind==="money"){
        const all=await sb.get("karu_money","select=*&order=date.desc,created_at.desc");
        dl("money",all.map(m=>({date:m.date,account:m.account,type:m.type,amount:m.amount,description:m.description,ref:m.ref,partner:m.partner,recorded_by:m.recorded_by})));
      }
    }catch(e){alert("Export failed: "+e.message);}
  };

  const now=new Date();
  const filterDate=arr=>{
    if(period==="week"){const w=new Date(now);w.setDate(now.getDate()-7);return arr.filter(x=>new Date(x.date)>=w);}
    if(period==="month") return arr.filter(x=>x.date.startsWith(now.toISOString().slice(0,7)));
    if(period==="year") return arr.filter(x=>x.date.startsWith(now.getFullYear().toString()));
    return arr;
  };

  const fSales=filterDate(data.sales);
  const fExp=filterDate(data.expenses);
  const revenue=fSales.reduce((s,x)=>s+Number(x.total),0);
  const expenses=fExp.reduce((s,x)=>s+Number(x.amount),0);
  const stockValue=data.stock.reduce((s,i)=>s+((i.qty_in-i.qty_sold-(i.qty_adjusted||0))*i.unit_cost),0);
  const cogs=data.stock.reduce((s,i)=>s+(i.qty_sold*i.unit_cost),0);
  const grossProfit=revenue-cogs;
  const netProfit=grossProfit-expenses;

  const dailyMap={};
  fSales.forEach(s=>{dailyMap[s.date]=(dailyMap[s.date]||0)+Number(s.total);});
  const chartData=Object.entries(dailyMap).sort(([a],[b])=>a.localeCompare(b)).slice(-14).map(([date,total])=>({date:date.slice(5),total}));

  const itemMap={};
  fSales.forEach(s=>{ if(s.items) s.items.forEach(i=>{ if(!itemMap[i.name]) itemMap[i.name]={qty:0,revenue:0}; itemMap[i.name].qty+=Number(i.qty||1); itemMap[i.name].revenue+=Number(i.qty||1)*Number(i.price||0); }); });
  const topItems=Object.entries(itemMap).sort(([,a],[,b])=>b.revenue-a.revenue).slice(0,5);

  const expMap={};
  fExp.forEach(e=>{expMap[e.category]=(expMap[e.category]||0)+Number(e.amount);});
  const expBreakdown=Object.entries(expMap).sort(([,a],[,b])=>b-a);
  const mpesa=fSales.filter(s=>s.payment_method==="M-Pesa").reduce((s,x)=>s+Number(x.total),0);
  const cash=fSales.filter(s=>s.payment_method==="Cash").reduce((s,x)=>s+Number(x.total),0);

  if(loading) return <div style={{textAlign:"center",padding:"2rem",color:"#556677"}}>Loading reports...</div>;

  return (
    <div>
      <div className="field" style={{marginBottom:14}}>
        <div className="tog">{[["week","Week"],["month","Month"],["year","Year"],["all","All"]].map(([id,label])=>(
          <button key={id} className={`tog-btn${period===id?" on":""}`} onClick={()=>setPeriod(id)} style={{fontSize:12}}>{label}</button>
        ))}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div className="stat"><div className="stat-n" style={{color:"#4CAF50"}}>KSh {revenue.toLocaleString()}</div><div className="stat-l">Revenue</div></div>
        <div className="stat"><div className="stat-n" style={{color:"#E85B5B"}}>KSh {expenses.toLocaleString()}</div><div className="stat-l">Expenses</div></div>
        <div className="stat"><div className="stat-n" style={{color:"#F5C000"}}>KSh {grossProfit.toLocaleString()}</div><div className="stat-l">Gross profit</div></div>
        <div className="stat" style={{border:`1px solid ${netProfit>=0?"rgba(76,175,80,0.4)":"rgba(232,91,91,0.4)"}`}}>
          <div className="stat-n" style={{color:netProfit>=0?"#4CAF50":"#E85B5B"}}>KSh {Math.abs(netProfit).toLocaleString()}</div>
          <div className="stat-l">Net {netProfit>=0?"profit":"loss"}</div>
        </div>
      </div>
      <div className="card" style={{marginBottom:14}}>
        <div style={{fontSize:11,color:"#8899AA",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Stock value on hand</div>
        <div style={{fontSize:20,fontWeight:600,color:"#F5C000"}}>KSh {stockValue.toLocaleString()}</div>
        <div style={{fontSize:11,color:"#556677",marginTop:2}}>COGS this period: KSh {cogs.toLocaleString()}</div>
      </div>
      {chartData.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div style={{fontSize:11,color:"#8899AA",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.05em"}}>Daily sales</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} margin={{left:-20}}>
              <XAxis dataKey="date" tick={{fill:"#556677",fontSize:9}}/>
              <YAxis tick={{fill:"#556677",fontSize:9}}/>
              <Tooltip contentStyle={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:6,fontSize:12}}/>
              <Bar dataKey="total" fill="#F5C000" radius={[3,3,0,0]} name="Revenue"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div className="card">
          <div style={{fontSize:11,color:"#8899AA",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>Payment split</div>
          {revenue>0?<>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:"#4CAF50"}}>M-Pesa</span><span>KSh {mpesa.toLocaleString()}</span></div>
            <div style={{height:4,background:"#1A2A4A",borderRadius:2,marginBottom:8}}><div style={{height:4,background:"#4CAF50",borderRadius:2,width:`${revenue>0?Math.round(mpesa/revenue*100):0}%`}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:"#F5C000"}}>Cash</span><span>KSh {cash.toLocaleString()}</span></div>
          </>:<div style={{color:"#556677",fontSize:12}}>No sales yet</div>}
        </div>
        <div className="card">
          <div style={{fontSize:11,color:"#8899AA",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>Expenses</div>
          {expBreakdown.length>0?expBreakdown.slice(0,4).map(([cat,amt])=>(
            <div key={cat} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{color:"#E8E2D4"}}>{cat}</span><span style={{color:"#E85B5B"}}>{expenses>0?Math.round(amt/expenses*100):0}%</span></div>
              <div style={{height:3,background:"#1A2A4A",borderRadius:2}}><div style={{height:3,background:"#E85B5B",borderRadius:2,width:`${expenses>0?(amt/expenses*100):0}%`}}/></div>
            </div>
          )):<div style={{color:"#556677",fontSize:12}}>No expenses yet</div>}
        </div>
      </div>
      {topItems.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div style={{fontSize:11,color:"#8899AA",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.05em"}}>Top selling items</div>
          {topItems.map(([name,{qty,revenue:rev}],i)=>(
            <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<topItems.length-1?"1px solid #1A2A4A":"none"}}>
              <div><div style={{fontSize:13,fontWeight:500}}>{name}</div><div style={{fontSize:11,color:"#556677"}}>{qty} sold</div></div>
              <div style={{fontSize:13,fontWeight:600,color:"#4CAF50"}}>KSh {rev.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
      {/* Month-on-month table */}
      {(()=>{
        const mmap={};
        data.sales.forEach(s=>{const m=s.date.slice(0,7);if(!mmap[m])mmap[m]={sales:0,expenses:0};mmap[m].sales+=Number(s.total);});
        data.expenses.forEach(e=>{const m=e.date.slice(0,7);if(!mmap[m])mmap[m]={sales:0,expenses:0};mmap[m].expenses+=Number(e.amount);});
        const rows=Object.entries(mmap).sort(([a],[b])=>b.localeCompare(a)).map(([month,d])=>({month,sales:d.sales,expenses:d.expenses,profit:d.sales-d.expenses}));
        if(!rows.length) return null;
        const tots=rows.reduce((s,r)=>({sales:s.sales+r.sales,expenses:s.expenses+r.expenses,profit:s.profit+r.profit}),{sales:0,expenses:0,profit:0});
        const fmtM=m=>{const[y,mo]=m.split("-");return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(mo)-1]+" "+y;};
        const fmt=n=>"KSh "+n.toLocaleString();
        return (
          <div className="card" style={{marginBottom:14}}>
            <div style={{fontSize:11,color:"#8899AA",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.05em"}}>Month-on-month performance</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:320}}>
                <thead>
                  <tr>{["Month","Sales","Expenses","Profit"].map(h=><th key={h} style={{textAlign:h==="Month"?"left":"right",padding:"4px 4px 8px",color:"#8899AA",fontWeight:500,borderBottom:"1px solid #1A2A4A",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map(r=>(
                    <tr key={r.month} style={{borderBottom:"1px solid #0F1A3A"}}>
                      <td style={{padding:"7px 4px",color:"#E8E2D4",whiteSpace:"nowrap"}}>{fmtM(r.month)}</td>
                      <td style={{textAlign:"right",padding:"7px 4px",color:"#4CAF50",whiteSpace:"nowrap"}}>{fmt(r.sales)}</td>
                      <td style={{textAlign:"right",padding:"7px 4px",color:"#E85B5B",whiteSpace:"nowrap"}}>{fmt(r.expenses)}</td>
                      <td style={{textAlign:"right",padding:"7px 4px",color:r.profit>=0?"#F5C000":"#E85B5B",fontWeight:600,whiteSpace:"nowrap"}}>{r.profit<0?"-":""}{fmt(Math.abs(r.profit))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{borderTop:"2px solid #1A2A4A"}}>
                    <td style={{padding:"8px 4px",fontWeight:700,color:"#FFFFFF"}}>Total</td>
                    <td style={{textAlign:"right",padding:"8px 4px",color:"#4CAF50",fontWeight:700}}>{fmt(tots.sales)}</td>
                    <td style={{textAlign:"right",padding:"8px 4px",color:"#E85B5B",fontWeight:700}}>{fmt(tots.expenses)}</td>
                    <td style={{textAlign:"right",padding:"8px 4px",color:tots.profit>=0?"#F5C000":"#E85B5B",fontWeight:700}}>{tots.profit<0?"-":""}{fmt(Math.abs(tots.profit))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <button className="btn-g" onClick={()=>exportCSV("sales")} style={{fontSize:12}}>Export sales</button>
        <button className="btn-g" onClick={()=>exportCSV("expenses")} style={{fontSize:12}}>Export expenses</button>
        <button className="btn-g" onClick={()=>exportCSV("stock")} style={{fontSize:12}}>Export stock</button>
        <button className="btn-g" onClick={()=>exportCSV("money")} style={{fontSize:12}}>Export money</button>
      </div>
      <button className="btn-g" onClick={loadAll} style={{width:"100%",fontSize:13}}>Refresh</button>
    </div>
  );
}
