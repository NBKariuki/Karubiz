import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmtK, sb } from "../lib";

export function StoreCredit({user,onBack}){
  const [rows,setRows]=useState([]); const [loading,setLoading]=useState(true);
  const load=async()=>{ setLoading(true); try{ setRows(await sb.get("karu_credit","select=*&order=created_at.desc")); }catch(e){console.error(e);} setLoading(false); };
  useEffect(()=>{load();},[]);
  // Aggregate net credit per customer (phone as the key)
  const byCustomer={};
  rows.forEach(r=>{ const k=(r.customer_phone||"").trim()||r.customer_name; if(!byCustomer[k]) byCustomer[k]={name:r.customer_name,phone:r.customer_phone,balance:0,entries:[]}; byCustomer[k].balance+=Number(r.amount); byCustomer[k].entries.push(r); });
  const holders=Object.values(byCustomer).filter(c=>c.balance>0.5).sort((a,b)=>b.balance-a.balance);
  const totalOut=holders.reduce((s,c)=>s+c.balance,0);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><button className="btn-g" onClick={onBack} style={{fontSize:13}}>Back</button><div style={{fontSize:15,fontWeight:600}}>Store Credit</div></div>
      <div style={{fontSize:12,color:"#8899AA",marginBottom:12,lineHeight:1.5}}>Customers holding credit from over-payments. Tap one to start a sale — their credit is applied first, they pay only the difference.</div>
      <div className="stat" style={{marginBottom:14}}><div className="stat-n" style={{color:"#E8A45B"}}>{fmtK(totalOut)}</div><div className="stat-l">Total credit outstanding</div></div>
      {loading?<div style={{color:"#8A97A8",textAlign:"center",padding:"20px 0"}}>Loading...</div>:holders.length===0?<div style={{color:"#8A97A8",textAlign:"center",padding:"20px 0"}}>No outstanding credit.</div>:holders.map((c,i)=>(
        <div key={i} className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:14,fontWeight:600}}>{c.name}</div><div style={{fontSize:11,color:"#8899AA"}}>{c.phone||"no phone"}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:700,color:"#4CAF50"}}>{fmtK(c.balance)}</div></div>
          </div>
          <button className="btn-y" onClick={()=>{ window.__karuCredit={name:c.name,phone:c.phone,balance:c.balance}; alert(`Go to the Sale tab and start a new sale. ${c.name}'s credit of ${fmtK(c.balance)} will be offered to apply.`); onBack(); }} style={{width:"100%",marginTop:10,fontSize:13}}>Start sale with this credit</button>
        </div>
      ))}
    </div>
  );
}

