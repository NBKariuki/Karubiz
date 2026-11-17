import { useState } from "react";
import { fmtK, logAudit, recordMoney, todayStr } from "../lib";

export function Reconcile({user,bal,onBack,onDone}){
  const [acc,setAcc]=useState("sacco"); const [actual,setActual]=useState(""); const [reason,setReason]=useState("");
  const [saving,setSaving]=useState(false); const [err,setErr]=useState("");
  const current = acc==="sacco"?bal.sacco:bal.cash;
  const diff = actual===""?0:Number(actual)-current;
  const doReconcile=async()=>{
    setErr("");
    if(actual===""){setErr("Enter the actual balance from your statement.");return;}
    if(diff===0){setErr("No difference — nothing to reconcile.");return;}
    if(!reason.trim()){setErr("A reason is required for the correction.");return;}
    setSaving(true);
    try{
      await recordMoney({account:acc,amount:diff,type:"reconciliation",description:`Reconciliation: ${reason}`,date:todayStr(),recorded_by:user.full_name});
      await logAudit({trip_no:null,record_id:null,action:"reconcile",field_changed:acc.toUpperCase(),old_value:String(Math.round(current)),new_value:String(Math.round(Number(actual))),reason,changed_by:user.full_name});
      onDone();
    }catch(e){setErr("Failed: "+e.message);}
    setSaving(false);
  };
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><button className="btn-g" onClick={onBack} style={{fontSize:13}}>Back</button><div style={{fontSize:15,fontWeight:600}}>Reconcile Balance</div></div>
      <div style={{fontSize:12,color:"#8899AA",marginBottom:14,lineHeight:1.5}}>Enter the true balance from your SACCO statement or a physical cash count. The app posts a logged correction for the difference. It cannot be undone quietly — every reconciliation is recorded.</div>
      <div className="field"><label>Account</label><div className="tog"><button className={`tog-btn${acc==="cash"?" on":""}`} onClick={()=>setAcc("cash")}>Cash</button><button className={`tog-btn${acc==="sacco"?" on":""}`} onClick={()=>setAcc("sacco")}>SACCO</button></div></div>
      <div className="qa"><div className="bal-row"><span style={{color:"#8899AA",fontSize:13}}>App shows</span><span style={{fontSize:15,fontWeight:600,color:"#FFFFFF"}}>{fmtK(current)}</span></div></div>
      <div className="field"><label>Actual balance (KSh)</label><input type="number" step="0.01" value={actual} onChange={e=>{setActual(e.target.value);setErr("");}} placeholder="From statement / count" autoFocus/></div>
      {actual!==""&&diff!==0&&(
        <div style={{background:diff>0?"rgba(76,175,80,0.1)":"rgba(232,91,91,0.1)",border:`1px solid ${diff>0?"rgba(76,175,80,0.3)":"rgba(232,91,91,0.3)"}`,borderRadius:8,padding:12,marginBottom:12,textAlign:"center"}}>
          <div style={{fontSize:13,color:diff>0?"#4CAF50":"#E85B5B",fontWeight:600}}>{diff>0?`App is short by ${fmtK(diff)} — will add`:`App is over by ${fmtK(Math.abs(diff))} — will deduct`}</div>
        </div>
      )}
      <div className="field"><label>Reason (required)</label><textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. SACCO interest earned, untracked bank charge, missed deposit"/></div>
      {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:10}}>{err}</div>}
      <button className="btn-y" onClick={doReconcile} disabled={saving} style={{width:"100%",padding:13}}>{saving?"Posting...":"Post Reconciliation"}</button>
    </div>
  );
}

