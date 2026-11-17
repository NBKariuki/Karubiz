import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmtK, logAudit, sb, todayStr } from "../lib";

export function CloseDay({user,onBack,onDone}){
  const [loading,setLoading]=useState(true); const [data,setData]=useState({cash:0,mpesa:0,count:0});
  const [counted,setCounted]=useState(""); const [reason,setReason]=useState(""); const [notes,setNotes]=useState("");
  const [saving,setSaving]=useState(false); const [err,setErr]=useState(""); const [alreadyClosed,setAlreadyClosed]=useState(null);
  useEffect(()=>{(async()=>{
    try{
      const today=todayStr();
      const [sales,closes]=await Promise.all([
        sb.get("karu_sales",`select=*&date=eq.${today}&voided=eq.false`),
        sb.get("karu_closes",`select=*&date=eq.${today}`)
      ]);
      if(closes.length) setAlreadyClosed(closes[0]);
      let cash=0,mpesa=0;
      sales.forEach(s=>{ const paid=Number(s.amount_paid||s.total); if(s.payment_method==="Cash")cash+=paid; else mpesa+=paid; });
      setData({cash,mpesa,count:sales.length});
    }catch(e){setErr("Load failed: "+e.message);}
    setLoading(false);
  })();},[]);
  const variance = counted===""?0:Number(counted)-data.cash;
  const doClose=async()=>{
    setErr("");
    if(counted===""){setErr("Enter the counted cash.");return;}
    if(variance!==0&&!reason.trim()){setErr("Explain the difference before closing.");return;}
    setSaving(true);
    try{
      await sb.post("karu_closes",{date:todayStr(),cash_expected:data.cash,cash_counted:Number(counted),variance,variance_reason:reason||null,mpesa_total:data.mpesa,sales_count:data.count,closed_by:user.full_name,notes});
      await logAudit({trip_no:null,record_id:null,action:"daily_close",field_changed:todayStr(),old_value:"expected "+data.cash,new_value:"counted "+counted,reason:reason||"balanced",changed_by:user.full_name});
      onDone();
    }catch(e){setErr("Close failed: "+e.message);}
    setSaving(false);
  };
  if(loading) return <div style={{textAlign:"center",color:"#8899AA",padding:"30px 0"}}>Loading today...</div>;
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><button className="btn-g" onClick={onBack} style={{fontSize:13}}>Back</button><div style={{fontSize:15,fontWeight:600}}>Daily Cash Close</div></div>
      {alreadyClosed?(
        <div style={{background:"rgba(76,175,80,0.1)",border:"1px solid rgba(76,175,80,0.3)",borderRadius:8,padding:16,textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:600,color:"#4CAF50",marginBottom:6}}>Today is closed</div>
          <div style={{fontSize:13,color:"#8899AA"}}>Counted {fmtK(alreadyClosed.cash_counted)} · Variance {alreadyClosed.variance===0?"none":fmtK(alreadyClosed.variance)}</div>
          <div style={{fontSize:12,color:"#8A97A8",marginTop:4}}>Closed by {alreadyClosed.closed_by?.split(" ")[0]}</div>
        </div>
      ):(<>
        <div className="qa"><div className="bal-row"><span style={{color:"#8899AA",fontSize:13}}>Cash sales today</span><span style={{fontSize:15,fontWeight:600,color:"#FFFFFF"}}>{fmtK(data.cash)}</span></div>
          <div className="bal-row"><span style={{color:"#8899AA",fontSize:13}}>M-Pesa today</span><span style={{fontSize:14,color:"#8899AA"}}>{fmtK(data.mpesa)}</span></div>
          <div className="bal-row"><span style={{color:"#8899AA",fontSize:13}}>Sales count</span><span style={{fontSize:14,color:"#8899AA"}}>{data.count}</span></div></div>
        <div className="field"><label>Count the drawer — actual cash (KSh)</label><input type="number" value={counted} onChange={e=>{setCounted(e.target.value);setErr("");}} placeholder="0" autoFocus/></div>
        {counted!==""&&(
          <div style={{background:variance===0?"rgba(76,175,80,0.1)":"rgba(232,91,91,0.1)",border:`1px solid ${variance===0?"rgba(76,175,80,0.3)":"rgba(232,91,91,0.3)"}`,borderRadius:8,padding:12,marginBottom:12,textAlign:"center"}}>
            <div style={{fontSize:13,color:variance===0?"#4CAF50":"#E85B5B",fontWeight:600}}>{variance===0?"Balanced — drawer matches":variance>0?`Over by ${fmtK(variance)}`:`Short by ${fmtK(Math.abs(variance))}`}</div>
          </div>
        )}
        {counted!==""&&variance!==0&&<div className="field"><label>Explain the {variance<0?"shortfall":"surplus"} (required)</label><textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Gave 200 change short, float error..."/></div>}
        <div className="field"><label>Notes (optional)</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Anything worth noting"/></div>
        {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:10}}>{err}</div>}
        <button className="btn-y" onClick={doClose} disabled={saving} style={{width:"100%",padding:13}}>{saving?"Closing...":"Close the Day"}</button>
      </>)}
    </div>
  );
}

