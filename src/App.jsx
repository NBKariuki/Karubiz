import { useState, useEffect, useCallback } from "react";
import { ROLES, can, fetchBalances, loadBiz, loadTeam } from "./lib";
import { GS } from "./styles";
import { LoginScreen } from "./screens/LoginScreen";
import { SidePanel } from "./screens/SidePanel";
import { SaleTab } from "./tabs/SaleTab";
import { StockTab } from "./tabs/StockTab";
import { LedgerTab } from "./tabs/LedgerTab";
import { ExpensesTab } from "./tabs/ExpensesTab";
import { ReportsTab } from "./tabs/ReportsTab";

export default function App() {
  const [user,setUser]=useState(null); const [tab,setTab]=useState("sale");
  const [bal,setBal]=useState({cash:0,sacco:0,hasData:false});
  const [panel,setPanel]=useState(false);
  const [lapsed,setLapsed]=useState(false);
  const [teamReady,setTeamReady]=useState(false);
  const IDLE_MS=5*60*1000; // 5 minutes
  useEffect(()=>{ loadBiz(); },[]);
  // Restore a saved session if it's still within the idle window
  useEffect(()=>{
    try{
      const raw=localStorage.getItem("karu_session");
      if(raw){ const s=JSON.parse(raw); if(s&&s.user&&s.last&&(Date.now()-s.last)<IDLE_MS){ setUser(s.user); } else { localStorage.removeItem("karu_session"); } }
    }catch{}
  },[]);
  // Persist session + reset idle timer on activity
  const touch=useCallback(()=>{ if(user){ try{ localStorage.setItem("karu_session",JSON.stringify({user,last:Date.now()})); }catch{} } },[user]);
  useEffect(()=>{
    if(!user) return;
    touch();
    const events=["click","keydown","touchstart","scroll"];
    const onAct=()=>touch();
    events.forEach(e=>window.addEventListener(e,onAct,{passive:true}));
    const iv=setInterval(()=>{
      try{ const raw=localStorage.getItem("karu_session"); if(raw){ const s=JSON.parse(raw); if(Date.now()-s.last>=IDLE_MS){ localStorage.removeItem("karu_session"); setUser(null); setPanel(false); setLapsed(true); } } }catch{}
    },15000);
    return ()=>{ events.forEach(e=>window.removeEventListener(e,onAct)); clearInterval(iv); };
  },[user,touch]);
  const doLogout=useCallback(()=>{ try{ localStorage.removeItem("karu_session"); }catch{} setUser(null); setPanel(false); },[]);
  const refreshBal=useCallback(async()=>{ setBal(await fetchBalances()); },[]);
  useEffect(()=>{ if(user) refreshBal(); },[user,refreshBal]);
  useEffect(()=>{ if(!user){ setTeamReady(false); return; } let live=true; loadTeam(user).then(()=>{ if(live) setTeamReady(true); }); return ()=>{ live=false; }; },[user]);
  if(!user) return <LoginScreen onLogin={u=>{setUser(u);setLapsed(false);}} lapsed={lapsed}/>;
  if(!teamReady) return <><GS/><div style={{padding:40,textAlign:"center",color:"#8A97A8",fontSize:14}}>Loading...</div></>;
  // Attendants only see the Sale tab; others see tabs they have perms for
  const tabs=[["sale","Sale","💰","sale"],["stock","Stock","📦","stock"],["expenses","Expenses","🧾","expenses"],["ledger","Ledger","📒","money"],["reports","Reports","📊","reports"]].filter(([,,,perm])=>can(user,perm));
  const activeTab = tabs.some(t=>t[0]===tab)?tab:tabs[0][0];
  return (<><GS/>
    <div style={{maxWidth:500,margin:"0 auto",paddingBottom:72}}>
      <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#050A1F",position:"sticky",top:0,zIndex:40,borderBottom:"1px solid #0A1128"}}>
        <span style={{fontSize:16,fontWeight:600,color:"#F5C000",letterSpacing:"0.08em"}}>KARU</span>
        <span style={{fontSize:12,color:"#8A97A8"}}>{user.full_name.split(" ")[0]} · {ROLES[user.role].label}</span>
        <button onClick={()=>setPanel(true)} style={{background:"none",border:"1px solid #1A2A4A",borderRadius:6,color:"#F5C000",padding:"5px 10px",fontSize:16,cursor:"pointer",lineHeight:1}}>☰</button>
      </div>
      <div style={{padding:16}}>
        {activeTab==="sale"&&<SaleTab user={user} onMoney={refreshBal}/>}
        {activeTab==="stock"&&<StockTab user={user} onMoney={refreshBal}/>}
        {activeTab==="ledger"&&<LedgerTab user={user} onMoney={refreshBal} bal={bal} onChange={refreshBal}/>}
        {activeTab==="expenses"&&<ExpensesTab user={user} onMoney={refreshBal}/>}
        {activeTab==="reports"&&<ReportsTab user={user} bal={bal}/>}
      </div>
    </div>
    {panel&&<SidePanel user={user} bal={bal} onClose={()=>setPanel(false)} onChange={refreshBal} onLogout={doLogout}/>}
    <nav className="nav">{tabs.map(([id,label,icon])=>(
      <button key={id} className={`nav-btn${activeTab===id?" on":""}`} onClick={()=>setTab(id)}><span className="ni">{icon}</span>{label}</button>
    ))}</nav></>);
}

