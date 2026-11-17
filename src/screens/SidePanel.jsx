import { useState, useEffect } from "react";
import { PARTNERS, STAFF, can, firstName, fmtK, partnerKey, recordMoney, sb, todayStr } from "../lib";
import { CloseDay } from "../screens/CloseDay";
import { StoreCredit } from "../screens/StoreCredit";
import { BusinessSettings } from "../screens/BusinessSettings";
import { ProductList } from "../screens/ProductList";
import { Reconcile } from "../screens/Reconcile";
import { ManageTeam } from "../screens/ManageTeam";

export function SidePanel({user,bal,onClose,onChange,onLogout}){
  const [view,setView]=useState("home");
  const [act,setAct]=useState(null);
  const [amt,setAmt]=useState(""); const [who,setWho]=useState(user.full_name); const [dir,setDir]=useState("in"); const [acc,setAcc]=useState("sacco");
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
      {view==="close"?<CloseDay user={user} onBack={()=>setView("home")} onDone={()=>{onChange();setView("home");}}/>:view==="users"?<ManageTeam user={user} onBack={()=>setView("home")}/>:view==="reconcile"?<Reconcile user={user} bal={bal} onBack={()=>setView("home")} onDone={()=>{onChange();setView("home");}}/>:view==="products"?<ProductList user={user} onBack={()=>setView("home")}/>:view==="credit"?<StoreCredit user={user} onBack={()=>setView("home")}/>:view==="bizsettings"?<BusinessSettings user={user} onBack={()=>setView("home")}/>:!can(user,"money")?(
        <div style={{textAlign:"center",color:"#8899AA",fontSize:14,padding:"20px 0"}}>
          {can(user,"close")&&<button className="btn-g" onClick={()=>setView("close")} style={{width:"100%",marginBottom:10,fontSize:13}}>Daily cash close</button>}
          <div style={{fontSize:12,color:"#8A97A8",marginTop:8}}>Money controls are owner-only.</div>
        </div>
      ):!bal.hasData?(
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
          {PARTNERS.map(p=>{ const k="owed_"+partnerKey(p); return bal[k]>0&&<div key={k} className="bal-row"><span style={{color:"#E8A45B",fontSize:12}}>Business owes {firstName(p)}</span><span style={{color:"#E8A45B",fontSize:13,fontWeight:600}}>{fmtK(bal[k])}</span></div>; })}
          {bal.loans>0&&<div className="bal-row"><span style={{color:"#E8A45B",fontSize:12}}>Loans owed</span><span style={{color:"#E8A45B",fontSize:13,fontWeight:600}}>{fmtK(bal.loans)}</span></div>}
        </div>
        {!act&&<div style={{marginBottom:16}}>
          {can(user,"money")&&null}
          {(can(user,"close")||can(user,"users"))&&<>
            <div style={{fontSize:10,color:"#8A97A8",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Admin</div>
            <div style={{display:"grid",gap:8}}>
              {can(user,"close")&&<button className="btn-g" onClick={()=>setView("close")} style={{fontSize:13}}>Daily cash close</button>}
              {can(user,"users")&&<button className="btn-g" onClick={()=>setView("credit")} style={{fontSize:13}}>Store credit</button>}
              {can(user,"users")&&<button className="btn-g" onClick={()=>setView("products")} style={{fontSize:13}}>Product list</button>}
              {can(user,"users")&&<button className="btn-g" onClick={()=>setView("users")} style={{fontSize:13}}>Manage team</button>}
              {can(user,"users")&&<button className="btn-g" onClick={()=>setView("bizsettings")} style={{fontSize:13}}>Business settings</button>}
            </div>
          </>}
        </div>}
        {act==="bank"&&<div className="qa"><div className="qa-title">Bank cash</div><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)" autoFocus/><div className="tog" style={{marginBottom:8}}>{STAFF.map(s=><button key={s} className={`tog-btn${who===s?" on":""}`} onClick={()=>setWho(s)}>{s.split(" ")[0]}</button>)}</div><div style={{display:"flex",gap:6}}><button className="btn-y" onClick={doBank} disabled={saving} style={{flex:1,fontSize:13}}>{saving?"...":"Confirm"}</button><button className="btn-g" onClick={()=>{setAct(null);setAmt("");}} style={{fontSize:13}}>Cancel</button></div></div>}
        {act==="withdraw"&&<div className="qa"><div className="qa-title">Withdraw to cash</div><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)" autoFocus/><div className="tog" style={{marginBottom:8}}>{STAFF.map(s=><button key={s} className={`tog-btn${who===s?" on":""}`} onClick={()=>setWho(s)}>{s.split(" ")[0]}</button>)}</div><div style={{display:"flex",gap:6}}><button className="btn-y" onClick={doWithdraw} disabled={saving} style={{flex:1,fontSize:13}}>{saving?"...":"Confirm"}</button><button className="btn-g" onClick={()=>{setAct(null);setAmt("");}} style={{fontSize:13}}>Cancel</button></div></div>}
        {act==="partner"&&<div className="qa"><div className="qa-title">Partner money</div>
          <div className="tog" style={{marginBottom:8}}>{STAFF.map(s=><button key={s} className={`tog-btn${who===s?" on":""}`} onClick={()=>setWho(s)}>{s.split(" ")[0]}</button>)}</div>
          <div className="tog" style={{marginBottom:8}}><button className={`tog-btn${dir==="in"?" on":""}`} onClick={()=>setDir("in")}>Puts in</button><button className={`tog-btn${dir==="out"?" on":""}`} onClick={()=>setDir("out")}>Takes out</button><button className={`tog-btn${dir==="repay"?" on":""}`} onClick={()=>setDir("repay")}>Repay</button></div>
          <div className="tog" style={{marginBottom:8}}><button className={`tog-btn${acc==="cash"?" on":""}`} onClick={()=>setAcc("cash")}>Cash</button><button className={`tog-btn${acc==="sacco"?" on":""}`} onClick={()=>setAcc("sacco")}>SACCO</button></div>
          <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)"/>
          <div style={{display:"flex",gap:6}}><button className="btn-y" onClick={doPartner} disabled={saving} style={{flex:1,fontSize:13}}>{saving?"...":"Confirm"}</button><button className="btn-g" onClick={()=>{setAct(null);setAmt("");}} style={{fontSize:13}}>Cancel</button></div></div>}
        {moves.length>0&&<div><div style={{fontSize:11,color:"#8A97A8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Recent movements</div>
          {moves.map(m=><div key={m.id} className="mv"><span style={{color:"#8899AA"}}>{m.date.slice(5)} · {m.description||m.type}</span><span style={{color:m.amount>=0?"#4CAF50":"#E85B5B",fontWeight:600}}>{m.amount>=0?"+":""}{Math.round(m.amount).toLocaleString()}</span></div>)}
        </div>}
      </>)}
      {view==="home"&&<button className="btn-g" onClick={onLogout} style={{width:"100%",marginTop:20,fontSize:13,borderColor:"rgba(232,91,91,0.3)",color:"#E85B5B"}}>Log out</button>}
    </div>
  </>);
}

