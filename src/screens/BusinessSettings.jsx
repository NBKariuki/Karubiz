import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BIZ, sb } from "../lib";

export function BusinessSettings({user,onBack}){
  const [f,setF]=useState({name:BIZ.name,address:BIZ.address,phone1:BIZ.phone1,phone2:BIZ.phone2});
  const [saving,setSaving]=useState(false); const [msg,setMsg]=useState("");
  const save=async()=>{
    if(!f.name.trim()){setMsg("Business name is required.");return;}
    setSaving(true); setMsg("");
    try{
      const payload={name:f.name.trim(),address:f.address.trim(),phone1:f.phone1.trim(),phone2:f.phone2.trim(),updated_by:user.full_name,updated_at:new Date().toISOString()};
      const existing=await sb.get("karu_settings","id=eq.business&select=id").catch(()=>[]);
      if(existing&&existing.length){ await sb.patch("karu_settings","business",payload); }
      else { await sb.post("karu_settings",[{id:"business",...payload}]); }
      BIZ.name=f.name.trim(); BIZ.address=f.address.trim(); BIZ.phone1=f.phone1.trim(); BIZ.phone2=f.phone2.trim();
      setMsg("Saved. Receipts and statements now use these details.");
    }catch(e){ setMsg("Save failed: "+e.message); }
    setSaving(false);
  };
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><button className="btn-g" onClick={onBack} style={{fontSize:13}}>Back</button><div style={{fontSize:15,fontWeight:600}}>Business Settings</div></div>
      <div style={{fontSize:12,color:"#8A97A8",marginBottom:14,lineHeight:1.5}}>These appear on every receipt and the financial statement. Change them anytime.</div>
      <div className="field"><label>Business name</label><input value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))} placeholder="e.g. KARU FURNITURE"/></div>
      <div className="field"><label>Address</label><input value={f.address} onChange={e=>setF(x=>({...x,address:e.target.value}))} placeholder="Street / area, town"/></div>
      <div className="field"><label>Phone 1</label><input value={f.phone1} onChange={e=>setF(x=>({...x,phone1:e.target.value}))} placeholder="07XX XXX XXX"/></div>
      <div className="field"><label>Phone 2 (optional)</label><input value={f.phone2} onChange={e=>setF(x=>({...x,phone2:e.target.value}))} placeholder="07XX XXX XXX"/></div>
      {msg&&<div style={{fontSize:12,color:msg.startsWith("Save failed")?"#E85B5B":"#4CAF50",marginBottom:12}}>{msg}</div>}
      <button className="btn-y" onClick={save} disabled={saving} style={{width:"100%",padding:13}}>{saving?"Saving...":"Save Business Settings"}</button>
    </div>
  );
}

