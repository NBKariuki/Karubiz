import { useState, useEffect } from "react";
import { EXP_CATS, STAFF, can, defStaff, fmtK, logAudit, recordMoney, sb, todayStr, withinWindow } from "../lib";

export function ExpensesTab({user,onMoney}){
  const [exp,setExp]=useState([]);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({date:new Date().toISOString().split("T")[0],category:"Rent",description:"",amount:"",recorded_by:defStaff(user),paid_from:"sacco"});
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [showPetty,setShowPetty]=useState(false); const [pcCat,setPcCat]=useState("Refreshments"); const [pcNote,setPcNote]=useState(""); const [pcAmt,setPcAmt]=useState(""); const [pcSaving,setPcSaving]=useState(false);
  const PETTY_CATS=["Refreshments","Transport","Airtime","Cleaning","Office","Other"];
  const doPettySpend=async()=>{
    const a=Number(pcAmt); if(!a||a<=0){alert("Enter an amount.");return;} if(!pcNote.trim()){alert("Add a note.");return;}
    setPcSaving(true);
    try{
      await recordMoney({account:"petty",amount:-a,type:"petty_spend",description:`${pcCat}: ${pcNote}`,date:todayStr(),recorded_by:user.full_name});
      await sb.post("karu_expenses",{date:todayStr(),category:"Petty cash",description:`${pcCat}: ${pcNote}`,amount:a,recorded_by:user.full_name,paid_from:"petty"});
      if(onMoney) onMoney();
      setShowPetty(false); setPcAmt(""); setPcNote("");
      await loadExp();
    }catch(e){alert("Failed: "+e.message);}
    setPcSaving(false);
  };
  const monthStart=new Date().toISOString().slice(0,7)+"-01";
  const [from,setFrom]=useState(monthStart); const [to,setTo]=useState(todayStr());
  const [showRange,setShowRange]=useState(false);
  const [editing,setEditing]=useState(null); const [editReason,setEditReason]=useState("");
  const [expOpen,setExpOpen]=useState({});

  const loadExp=async()=>{
    setLoading(true);
    try{ setExp(await sb.get("karu_expenses",`select=*&date=gte.${from}&date=lte.${to}&order=date.desc,created_at.desc`)); }
    catch(e){console.error(e);}
    setLoading(false);
  };
  useEffect(()=>{loadExp();},[from,to]);

  const save=async()=>{
    if(!form.amount||Number(form.amount)<=0){setErr("Enter a valid amount.");return;}
    setSaving(true); setErr("");
    try{
      await sb.post("karu_expenses",{...form,amount:Number(form.amount)});
      const a=Number(form.amount); const short=form.recorded_by.split(" ")[0]; const lbl=`${form.category}${form.description?" · "+form.description:""}`;
      if(form.paid_from==="personal") await recordMoney({account:"owed_"+short.toLowerCase(),amount:a,type:"expense_personal",partner:form.recorded_by,description:`${lbl} (paid by ${short})`,date:form.date,recorded_by:form.recorded_by});
      else await recordMoney({account:form.paid_from,amount:-a,type:"expense",description:lbl,date:form.date,recorded_by:form.recorded_by});
      if(onMoney) onMoney();
      setShowForm(false);
      setForm({date:new Date().toISOString().split("T")[0],category:"Rent",description:"",amount:"",recorded_by:defStaff(user),paid_from:"sacco"});
      await loadExp();
    }catch(e){setErr("Save failed: "+e.message);}
    setSaving(false);
  };

  const startEdit=(e)=>{ setEditing({...e}); setEditReason(""); setErr(""); setShowForm(false); };
  const saveEdit=async()=>{
    if(!editing.amount||Number(editing.amount)<=0){setErr("Enter a valid amount.");return;}
    if(!editReason.trim()){setErr("Reason for the change is required.");return;}
    setSaving(true); setErr("");
    try{
      const orig=exp.find(x=>x.id===editing.id);
      const oldAmt=Number(orig.amount); const newAmt=Number(editing.amount);
      const oShort=orig.recorded_by.split(" ")[0].toLowerCase(); const nShort=editing.recorded_by.split(" ")[0].toLowerCase();
      // Reverse original money effect
      if(orig.paid_from==="personal") await recordMoney({account:"owed_"+oShort,amount:-oldAmt,type:"expense_edit_reverse",description:`Reverse (edit) ${orig.category}`,date:orig.date,recorded_by:user.full_name});
      else await recordMoney({account:orig.paid_from||"sacco",amount:oldAmt,type:"expense_edit_reverse",description:`Reverse (edit) ${orig.category}`,date:orig.date,recorded_by:user.full_name});
      // Apply new money effect
      const lbl=`${editing.category}${editing.description?" · "+editing.description:""}`;
      if(editing.paid_from==="personal") await recordMoney({account:"owed_"+nShort,amount:newAmt,type:"expense_personal",partner:editing.recorded_by,description:`${lbl} (edited)`,date:editing.date,recorded_by:user.full_name});
      else await recordMoney({account:editing.paid_from||"sacco",amount:-newAmt,type:"expense",description:`${lbl} (edited)`,date:editing.date,recorded_by:user.full_name});
      // Update the expense row
      await sb.patch("karu_expenses",editing.id,{date:editing.date,category:editing.category,description:editing.description,amount:newAmt,recorded_by:editing.recorded_by,paid_from:editing.paid_from});
      await logAudit({trip_no:null,record_id:editing.id,action:"edit_expense",field_changed:editing.category,old_value:`${oldAmt} ${orig.paid_from}`,new_value:`${newAmt} ${editing.paid_from}`,reason:editReason,changed_by:user.full_name});
      if(onMoney) onMoney();
      setEditing(null); await loadExp();
    }catch(e){setErr("Save failed: "+e.message);}
    setSaving(false);
  };
  const delExpense=async(e)=>{
    if(!confirm(`Delete this expense of ${fmtK(Number(e.amount))}? This reverses its money effect.`))return;
    try{
      const short=e.recorded_by.split(" ")[0].toLowerCase(); const amt=Number(e.amount);
      if(e.paid_from==="personal") await recordMoney({account:"owed_"+short,amount:-amt,type:"expense_delete",description:`Deleted ${e.category}`,date:e.date,recorded_by:user.full_name});
      else await recordMoney({account:e.paid_from||"sacco",amount:amt,type:"expense_delete",description:`Deleted ${e.category}`,date:e.date,recorded_by:user.full_name});
      await sb.del("karu_expenses",e.id);
      await logAudit({trip_no:null,record_id:e.id,action:"delete_expense",field_changed:e.category,old_value:String(amt),new_value:"0",reason:"Expense deleted",changed_by:user.full_name});
      if(onMoney) onMoney();
      await loadExp();
    }catch(err){alert("Delete failed: "+err.message);}
  };

  const total=exp.reduce((s,e)=>s+Number(e.amount),0);
  const isThisMonth = from===monthStart && to===todayStr();
  const rangeLabel = isThisMonth ? "This month" : `${from.slice(5)} to ${to.slice(5)}`;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div className="stat"><div className="stat-n" style={{color:"#E85B5B"}}>{fmtK(total)}</div><div className="stat-l">{rangeLabel}</div></div>
        <div className="stat"><div className="stat-n" style={{color:"#8899AA"}}>{exp.length}</div><div className="stat-l">Entries</div></div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button className="btn-g" onClick={()=>{setFrom(monthStart);setTo(todayStr());setShowRange(false);}} style={{flex:1,fontSize:12,...(isThisMonth?{borderColor:"#F5C000",color:"#F5C000"}:{})}}>This month</button>
        <button className="btn-g" onClick={()=>setShowRange(x=>!x)} style={{flex:1,fontSize:12,...(!isThisMonth?{borderColor:"#F5C000",color:"#F5C000"}:{})}}>Date range</button>
      </div>
      {showRange&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div><div style={{fontSize:11,color:"#8899AA",marginBottom:3}}>FROM</div><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#FFFFFF",fontSize:15}}/></div>
          <div><div style={{fontSize:11,color:"#8899AA",marginBottom:3}}>TO</div><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#FFFFFF",fontSize:15}}/></div>
        </div>
      )}

      {!showForm&&!showPetty&&<div style={{display:"flex",gap:8,marginBottom:14}}>
        <button className="btn-y" onClick={()=>setShowForm(true)} style={{flex:1}}>+ Log Expense</button>
        {can(user,"users")&&<button className="btn-g" onClick={()=>setShowPetty(true)} style={{flex:1}}>+ Petty spend</button>}
      </div>}
      {showPetty&&(
        <div className="card" style={{marginBottom:14,border:"1px solid rgba(245,192,0,0.25)"}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Record Petty Cash Spend</div>
          <div style={{fontSize:11,color:"#8A97A8",marginBottom:12}}>Comes out of the petty cash pocket and logs here as an expense.</div>
          <div className="field"><label>Category</label><div className="tog" style={{flexWrap:"wrap"}}>{PETTY_CATS.map(c=><button key={c} className={`tog-btn${pcCat===c?" on":""}`} onClick={()=>setPcCat(c)} style={{flex:"1 0 30%",fontSize:12}}>{c}</button>)}</div></div>
          <div className="field"><label>Note (what for)</label><input value={pcNote} onChange={e=>setPcNote(e.target.value)} placeholder="e.g. Tea for the shop"/></div>
          <div className="field"><label>Amount (KSh)</label><input type="number" value={pcAmt} onChange={e=>setPcAmt(e.target.value)} placeholder="0"/></div>
          <div style={{display:"flex",gap:8}}><button className="btn-y" onClick={doPettySpend} disabled={pcSaving} style={{flex:1}}>{pcSaving?"Saving...":"Record Spend"}</button><button className="btn-g" onClick={()=>{setShowPetty(false);setPcAmt("");setPcNote("");}}>Cancel</button></div>
        </div>
      )}
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
          <div style={{display:"flex",gap:8}}><button className="btn-y" onClick={save} disabled={saving} style={{flex:1}}>{saving?"Saving...":"Save"}</button><button className="btn-g" onClick={()=>{setShowForm(false);setErr("");}}>Cancel</button></div>
        </div>
      )}
      {editing&&(
        <div className="card" style={{marginBottom:14,border:"1px solid rgba(232,164,91,0.4)"}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4,color:"#E8A45B"}}>Edit Expense</div>
          <div style={{fontSize:11,color:"#8899AA",marginBottom:12}}>The money effect will be corrected automatically.</div>
          <div className="field"><label>Date</label><input type="date" value={editing.date} onChange={e=>setEditing(x=>({...x,date:e.target.value}))}/></div>
          <div className="field"><label>Category</label><select value={editing.category} onChange={e=>setEditing(x=>({...x,category:e.target.value}))}>{EXP_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
          <div className="field"><label>Description</label><input value={editing.description||""} onChange={e=>setEditing(x=>({...x,description:e.target.value}))}/></div>
          <div className="field"><label>Amount (KSh)</label><input type="number" value={editing.amount} onChange={e=>setEditing(x=>({...x,amount:e.target.value}))}/></div>
          <div className="field"><label>Recorded by</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${editing.recorded_by===s?" on":""}`} onClick={()=>setEditing(x=>({...x,recorded_by:s}))}>{s.split(" ")[0]}</button>)}</div></div>
          <div className="field"><label>Paid from</label><div className="tog"><button className={`tog-btn${editing.paid_from==="cash"?" on":""}`} onClick={()=>setEditing(x=>({...x,paid_from:"cash"}))}>Cash</button><button className={`tog-btn${editing.paid_from==="sacco"?" on":""}`} onClick={()=>setEditing(x=>({...x,paid_from:"sacco"}))}>SACCO</button><button className={`tog-btn${editing.paid_from==="personal"?" on":""}`} onClick={()=>setEditing(x=>({...x,paid_from:"personal"}))}>Personal</button></div></div>
          <div className="field"><label>Reason for change (required)</label><textarea value={editReason} onChange={e=>setEditReason(e.target.value)} placeholder="e.g. Wrong amount entered, corrected"/></div>
          {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:10}}>{err}</div>}
          <div style={{display:"flex",gap:8}}><button className="btn-y" onClick={saveEdit} disabled={saving} style={{flex:1}}>{saving?"Saving...":"Save Changes"}</button><button className="btn-g" onClick={()=>{setEditing(null);setErr("");}}>Cancel</button></div>
        </div>
      )}
      {loading?<div style={{textAlign:"center",padding:"2rem",color:"#8A97A8"}}>Loading...</div>:exp.length===0?<div style={{textAlign:"center",padding:"2rem",color:"#8A97A8"}}>No expenses in this period.</div>:(()=>{
        const expRow=(e,last)=>(
          <div key={e.id} style={{padding:"9px 0",borderBottom:last?"none":"1px solid #101B36"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description||e.category}</div>
                <div style={{fontSize:11,color:"#8A97A8"}}>{e.category} · {e.recorded_by?.split(" ")[0]}{e.paid_from?" · "+e.paid_from:""}</div>
              </div>
              <span style={{fontSize:14,fontWeight:600,color:"#E85B5B",marginLeft:10,whiteSpace:"nowrap"}}>{fmtK(Number(e.amount))}</span>
            </div>
            {can(user,"edit_expense")&&(withinWindow(e.created_at)?<div style={{display:"flex",gap:6,marginTop:6}}>
              <button className="btn-g" onClick={()=>startEdit(e)} style={{fontSize:11,padding:"4px 10px"}}>Edit</button>
              {can(user,"void")&&<button className="btn-g" onClick={()=>delExpense(e)} style={{fontSize:11,padding:"4px 10px",borderColor:"rgba(232,91,91,0.3)",color:"#E85B5B"}}>Delete</button>}
            </div>:<div style={{fontSize:10,color:"#8A97A8",marginTop:6}}>🔒 Locked (over 24h)</div>)}
          </div>
        );
        const dayTotal=arr=>arr.reduce((n,e)=>n+Number(e.amount),0);
        const toggle=k=>setExpOpen(x=>({...x,[k]:!x[k]}));
        const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
        const now=new Date(); const curMonth=now.toISOString().slice(0,7); const curYear=String(now.getFullYear());
        const days={}; exp.forEach(e=>{ if(!days[e.date])days[e.date]=[]; days[e.date].push(e); });
        const currentMonthDays=[]; const monthGroups={}; const yearGroups={};
        Object.keys(days).sort((a,b)=>b.localeCompare(a)).forEach(date=>{
          const ym=date.slice(0,7); const y=date.slice(0,4);
          if(ym===curMonth) currentMonthDays.push(date);
          else if(y===curYear){ if(!monthGroups[ym])monthGroups[ym]=[]; monthGroups[ym].push(date); }
          else { if(!yearGroups[y])yearGroups[y]=[]; yearGroups[y].push(date); }
        });
        const fmtDay=d=>{ const dt=new Date(d+"T00:00:00"); return dt.toLocaleDateString("en-KE",{weekday:"short",day:"2-digit",month:"short"}); };
        return (
          <div>
            {currentMonthDays.map(date=>(
              <div key={date} style={{marginBottom:8}}>
                <div onClick={()=>toggle(date)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#E8E2D4"}}>{expOpen[date]?"▾":"▸"} {fmtDay(date)}</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#E85B5B"}}>{fmtK(dayTotal(days[date]))}</span>
                </div>
                {expOpen[date]&&<div style={{padding:"0 10px"}}>{days[date].map((e,i)=>expRow(e,i===days[date].length-1))}</div>}
              </div>
            ))}
            {Object.keys(monthGroups).sort((a,b)=>b.localeCompare(a)).map(ym=>{
              const dates=monthGroups[ym]; const mTotal=dates.reduce((n,d)=>n+dayTotal(days[d]),0);
              return (
                <div key={ym} style={{marginBottom:8}}>
                  <div onClick={()=>toggle(ym)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #24365C",borderRadius:8}}>
                    <span style={{fontSize:13,fontWeight:600,color:"#AEB9C7"}}>{expOpen[ym]?"▾":"▸"} {MONTHS[parseInt(ym.slice(5,7))-1]}</span>
                    <span style={{fontSize:13,fontWeight:600,color:"#E85B5B"}}>{fmtK(mTotal)}</span>
                  </div>
                  {expOpen[ym]&&<div style={{padding:"4px 10px 0"}}>{dates.map(date=>(
                    <div key={date} style={{marginBottom:6}}>
                      <div onClick={()=>toggle(date)} style={{display:"flex",justifyContent:"space-between",cursor:"pointer",padding:"6px 0",borderBottom:"1px solid #101B36"}}>
                        <span style={{fontSize:12,color:"#AEB9C7"}}>{expOpen[date]?"▾":"▸"} {fmtDay(date)}</span>
                        <span style={{fontSize:12,color:"#8A97A8"}}>{fmtK(dayTotal(days[date]))}</span>
                      </div>
                      {expOpen[date]&&<div>{days[date].map((e,i)=>expRow(e,i===days[date].length-1))}</div>}
                    </div>
                  ))}</div>}
                </div>
              );
            })}
            {Object.keys(yearGroups).sort((a,b)=>b.localeCompare(a)).map(y=>{
              const dates=yearGroups[y]; const yTotal=dates.reduce((n,d)=>n+dayTotal(days[d]),0);
              return (
                <div key={y} style={{marginBottom:8}}>
                  <div onClick={()=>toggle(y)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #2E4472",borderRadius:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#E8E2D4"}}>{expOpen[y]?"▾":"▸"} {y}</span>
                    <span style={{fontSize:13,fontWeight:700,color:"#E85B5B"}}>{fmtK(yTotal)}</span>
                  </div>
                  {expOpen[y]&&<div style={{padding:"4px 10px 0"}}>{dates.map(date=>(
                    <div key={date} style={{marginBottom:6}}>
                      <div onClick={()=>toggle(date)} style={{display:"flex",justifyContent:"space-between",cursor:"pointer",padding:"6px 0",borderBottom:"1px solid #101B36"}}>
                        <span style={{fontSize:12,color:"#AEB9C7"}}>{expOpen[date]?"▾":"▸"} {fmtDay(date)}</span>
                        <span style={{fontSize:12,color:"#8A97A8"}}>{fmtK(dayTotal(days[date]))}</span>
                      </div>
                      {expOpen[date]&&<div>{days[date].map((e,i)=>expRow(e,i===days[date].length-1))}</div>}
                    </div>
                  ))}</div>}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

