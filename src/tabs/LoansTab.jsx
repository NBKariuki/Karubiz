import { useState, useEffect } from "react";
import { PARTNERS, defStaff, firstName, fmtK, sb, todayStr } from "../lib";

export function LoansTab({user,onChange}){
  const [loans,setLoans]=useState(null); const [pays,setPays]=useState([]);
  const [missing,setMissing]=useState(false); const [err,setErr]=useState("");
  const [open,setOpen]=useState(null); const [saving,setSaving]=useState(false);
  const [nf,setNf]=useState(null); const [pf,setPf]=useState(null);
  const blank=()=>({kind:"external",lender:"",partner:firstName(defStaff(user)),principal:"",received_into:"cash",interest_pct:"",start_date:todayStr(),due_date:"",notes:""});
  const msg=e=>{ try{ const j=JSON.parse(e.message); return j.message||e.message; }catch{ return e.message; } };
  const load=async()=>{
    try{ const l=await sb.get("karu_loans","select=*&order=start_date.desc,id.desc"); const p=await sb.get("karu_loan_payments","select=*&order=date.desc,id.desc"); setLoans(l); setPays(p); setMissing(false); }
    catch(e){ if(/PGRST205|karu_loans|does not exist|relation/i.test(e.message)) setMissing(true); else setErr(msg(e)); setLoans([]); }
  };
  useEffect(()=>{ load(); },[]);
  const fmtD=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"numeric"}):"";
  const daysTo=d=>d?Math.round((new Date(d+"T00:00:00")-new Date(todayStr()+"T00:00:00"))/86400000):null;
  const calc=l=>{ const lp=pays.filter(p=>p.loan_id===l.id); const paid=lp.reduce((n,p)=>n+Number(p.amount),0); const intPaid=lp.reduce((n,p)=>n+Number(p.interest_part),0);
    const totalInt=Number(l.principal)*Number(l.interest_pct||0)/100; const totalDue=Number(l.principal)+totalInt;
    return {lp,paid,intPaid,totalInt,totalDue,balance:Math.max(0,totalDue-paid),intLeft:Math.max(0,totalInt-intPaid)}; };
  const tag=(l,c)=>{ if(c.balance<1) return {t:"Cleared",c:"#4CAF50"}; const d=daysTo(l.due_date);
    if(d==null) return {t:"No due date",c:"#A9B5C6"}; if(d<0) return {t:`Overdue by ${-d} day${-d===1?"":"s"}`,c:"#E85B5B"};
    if(d===0) return {t:"Due today",c:"#E8A45B"}; if(d<=7) return {t:`Due in ${d} day${d===1?"":"s"}`,c:"#E8A45B"}; return {t:`Due ${fmtD(l.due_date)}`,c:"#A9B5C6"}; };
  const saveLoan=async()=>{
    setErr(""); const lender=nf.kind==="partner"?nf.partner:nf.lender.trim();
    if(!lender){setErr("Enter the lender's name.");return;}
    if(!(Number(nf.principal)>0)){setErr("Enter the loan amount.");return;}
    setSaving(true);
    try{ await sb.rpc("karu_create_loan",{p:{kind:nf.kind,lender,partner:nf.kind==="partner"?nf.partner:null,principal:Number(nf.principal),interest_pct:Number(nf.interest_pct||0),received_into:nf.received_into,start_date:nf.start_date,due_date:nf.due_date||"",notes:nf.notes,recorded_by:user.full_name}}); setNf(null); await load(); if(onChange) onChange(); }
    catch(e){ setErr(msg(e)); }
    setSaving(false);
  };
  const savePay=async()=>{
    setErr(""); const a=Number(pf.amount), i=Number(pf.interest||0);
    if(!(a>0)){setErr("Enter the amount paid.");return;} if(i<0||i>a){setErr("Interest part cannot be more than the amount paid.");return;}
    setSaving(true);
    try{ await sb.rpc("karu_loan_payment",{p:{loan_id:pf.loan,amount:a,interest_part:i,paid_from:pf.from,date:pf.date,note:pf.note,recorded_by:user.full_name}}); setPf(null); await load(); if(onChange) onChange(); }
    catch(e){ setErr(msg(e)); }
    setSaving(false);
  };
  if(missing) return (<div className="card"><div style={{fontSize:16,fontWeight:600,marginBottom:6}}>Loans need a one-time setup</div><div style={{fontSize:14,color:"#A9B5C6",lineHeight:1.5}}>Run the file KARU_LOANS_SETUP.sql in the Supabase SQL editor, then open this tab again.</div></div>);
  if(!loans) return <div style={{color:"#A9B5C6",fontSize:14,padding:20,textAlign:"center"}}>Loading...</div>;
  const withCalc=loans.map(l=>({l,c:calc(l)}));
  const active=withCalc.filter(x=>x.c.balance>=1); const done=withCalc.filter(x=>x.c.balance<1);
  const totalOut=active.reduce((n,x)=>n+x.c.balance,0);
  const nextDue=[...active].filter(x=>x.l.due_date).sort((a,b)=>a.l.due_date.localeCompare(b.l.due_date))[0];
  const overdue=active.filter(x=>x.l.due_date&&daysTo(x.l.due_date)<0).length;
  const prev=nf?(()=>{ const p=Number(nf.principal||0), i=p*Number(nf.interest_pct||0)/100; return {i,t:p+i}; })():null;
  const Row=(l,v,col)=><div style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"4px 0"}}><span style={{color:"#A9B5C6"}}>{l}</span><span style={{color:col||"#E8E2D4"}}>{v}</span></div>;
  const renderLoan=({l,c})=>{ const t=tag(l,c); const isOpen=open===l.id;
    return (
      <div key={l.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${t.c}`}}>
        <div onClick={()=>setOpen(isOpen?null:l.id)} style={{cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:600}}>{l.lender}</div>
            <div style={{fontSize:14,color:"#A9B5C6",marginTop:2}}>{l.kind==="partner"?"Partner loan":"Outside lender"} · borrowed {fmtD(l.start_date)}</div>
            <div style={{fontSize:14,color:t.c,marginTop:4,fontWeight:500}}>{t.t}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:17,fontWeight:700,color:c.balance>=1?"#E8A45B":"#4CAF50"}}>{fmtK(c.balance)}</div>
            <div style={{fontSize:14,color:"#8A97A8"}}>{c.balance>=1?"still to repay":"fully repaid"}</div>
          </div>
        </div>
        {isOpen&&(
          <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid #1A2A4A"}}>
            {Row("Amount borrowed",fmtK(l.principal))}
            {Row(`Interest (${Number(l.interest_pct||0)}% flat)`,fmtK(c.totalInt))}
            {Row("Total to repay",fmtK(c.totalDue),"#F5C000")}
            {Row("Paid so far",fmtK(c.paid),"#4CAF50")}
            {l.due_date&&Row("Due date",fmtD(l.due_date))}
            {l.notes&&<div style={{fontSize:14,color:"#A9B5C6",marginTop:6}}>{l.notes}</div>}
            {c.lp.length>0&&(<div style={{marginTop:10}}>
              <div style={{fontSize:14,color:"#A9B5C6",marginBottom:4}}>Repayments</div>
              {c.lp.map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"5px 0",borderBottom:"1px solid #0F1A3A"}}><span>{fmtD(p.date)} · from {p.paid_from==="sacco"?"Bank":"cash"}{Number(p.interest_part)>0?` (interest ${fmtK(p.interest_part)})`:""}</span><span style={{color:"#4CAF50"}}>{fmtK(p.amount)}</span></div>)}
            </div>)}
            {c.balance>=1&&!pf&&<button className="btn-y" onClick={()=>{setErr("");setPf({loan:l.id,amount:"",interest:"",from:"cash",date:todayStr(),note:""});}} style={{width:"100%",marginTop:12,fontSize:14}}>Record repayment</button>}
            {pf&&pf.loan===l.id&&(
              <div style={{marginTop:14}}>
                <div style={{fontSize:15,fontWeight:600,marginBottom:10,color:"#F5C000"}}>Record repayment</div>
                <div className="field"><label>Amount paid (KSh)</label><input type="number" value={pf.amount} onChange={e=>setPf(x=>({...x,amount:e.target.value}))} placeholder={String(Math.round(c.balance))}/></div>
                {c.intLeft>0&&<div className="field"><label>Of which interest (KSh)</label><input type="number" value={pf.interest} onChange={e=>setPf(x=>({...x,interest:e.target.value}))} placeholder={`0 (up to ${Math.round(c.intLeft).toLocaleString()})`}/></div>}
                <div className="field"><label>Paid from</label><div className="tog"><button className={`tog-btn${pf.from==="cash"?" on":""}`} onClick={()=>setPf(x=>({...x,from:"cash"}))}>Cash</button><button className={`tog-btn${pf.from==="sacco"?" on":""}`} onClick={()=>setPf(x=>({...x,from:"sacco"}))}>Bank</button></div></div>
                <div className="field"><label>Date</label><input type="date" value={pf.date} onChange={e=>setPf(x=>({...x,date:e.target.value}))}/></div>
                <div className="field"><label>Note (optional)</label><input value={pf.note} onChange={e=>setPf(x=>({...x,note:e.target.value}))} placeholder="e.g. Part payment"/></div>
                {err&&<div style={{color:"#E85B5B",fontSize:14,marginBottom:10}}>{err}</div>}
                <div style={{display:"flex",gap:8}}><button className="btn-y" onClick={savePay} disabled={saving} style={{flex:1,fontSize:14}}>{saving?"Saving...":"Save repayment"}</button><button className="btn-g" onClick={()=>{setPf(null);setErr("");}}>Cancel</button></div>
              </div>
            )}
          </div>
        )}
      </div>
    ); };
  return (
    <div>
      <div className="card" style={{marginBottom:14}}>
        <div style={{fontSize:14,color:"#A9B5C6"}}>Total still to repay</div>
        <div style={{fontSize:26,fontWeight:700,color:totalOut>0?"#E8A45B":"#4CAF50",margin:"2px 0 4px"}}>{fmtK(totalOut)}</div>
        <div style={{fontSize:14,color:"#A9B5C6"}}>{active.length} active loan{active.length===1?"":"s"}{nextDue?` · next due ${fmtD(nextDue.l.due_date)} (${nextDue.l.lender})`:""}</div>
        {overdue>0&&<div style={{fontSize:14,color:"#E85B5B",marginTop:6,fontWeight:600}}>{overdue} overdue</div>}
      </div>
      {!nf&&<button className="btn-y" onClick={()=>{setErr("");setNf(blank());}} style={{width:"100%",marginBottom:14,fontSize:14}}>+ New loan</button>}
      {nf&&(
        <div className="card" style={{marginBottom:14,border:"1px solid rgba(245,192,0,0.25)"}}>
          <div style={{fontSize:16,fontWeight:600,marginBottom:14}}>New loan</div>
          <div className="field"><label>Who lent the money</label><div className="tog"><button className={`tog-btn${nf.kind==="partner"?" on":""}`} onClick={()=>setNf(x=>({...x,kind:"partner"}))}>A partner</button><button className={`tog-btn${nf.kind==="external"?" on":""}`} onClick={()=>setNf(x=>({...x,kind:"external"}))}>Outside lender</button></div></div>
          {nf.kind==="partner"
            ?<div className="field"><label>Partner</label><div className="tog">{PARTNERS.map(s=>{ const n=s.split(" ")[0]; return <button key={s} className={`tog-btn${nf.partner===n?" on":""}`} onClick={()=>setNf(x=>({...x,partner:n}))}>{n}</button>; })}</div></div>
            :<div className="field"><label>Lender name</label><input value={nf.lender} onChange={e=>setNf(x=>({...x,lender:e.target.value}))} placeholder="e.g. Bank, SACCO, chama"/></div>}
          <div className="field"><label>Amount borrowed (KSh)</label><input type="number" value={nf.principal} onChange={e=>setNf(x=>({...x,principal:e.target.value}))} placeholder="0"/></div>
          <div className="field"><label>Money received into</label><div className="tog"><button className={`tog-btn${nf.received_into==="cash"?" on":""}`} onClick={()=>setNf(x=>({...x,received_into:"cash"}))}>Cash</button><button className={`tog-btn${nf.received_into==="sacco"?" on":""}`} onClick={()=>setNf(x=>({...x,received_into:"sacco"}))}>Bank</button></div></div>
          <div className="field"><label>Interest, % of the amount over the whole loan</label><input type="number" value={nf.interest_pct} onChange={e=>setNf(x=>({...x,interest_pct:e.target.value}))} placeholder="0 if none"/></div>
          {Number(nf.principal)>0&&<div style={{fontSize:14,color:"#F5C000",marginBottom:16}}>To repay in total: {fmtK(prev.t)}{prev.i>0?` (interest ${fmtK(prev.i)})`:""}</div>}
          <div className="field"><label>Date received</label><input type="date" value={nf.start_date} onChange={e=>setNf(x=>({...x,start_date:e.target.value}))}/></div>
          <div className="field"><label>Due date (optional)</label><input type="date" value={nf.due_date} onChange={e=>setNf(x=>({...x,due_date:e.target.value}))}/></div>
          <div className="field"><label>Notes (optional)</label><input value={nf.notes} onChange={e=>setNf(x=>({...x,notes:e.target.value}))} placeholder="e.g. Pay monthly"/></div>
          {err&&<div style={{color:"#E85B5B",fontSize:14,marginBottom:10}}>{err}</div>}
          <div style={{display:"flex",gap:8}}><button className="btn-y" onClick={saveLoan} disabled={saving} style={{flex:1,fontSize:14}}>{saving?"Saving...":"Save loan"}</button><button className="btn-g" onClick={()=>{setNf(null);setErr("");}}>Cancel</button></div>
        </div>
      )}
      {err&&!nf&&!pf&&<div style={{color:"#E85B5B",fontSize:14,marginBottom:10}}>{err}</div>}
      {active.map(renderLoan)}
      {done.length>0&&<div style={{fontSize:14,color:"#A9B5C6",margin:"14px 0 8px"}}>Repaid</div>}
      {done.map(renderLoan)}
      {loans.length===0&&!nf&&<div style={{textAlign:"center",color:"#A9B5C6",fontSize:14,padding:"24px 10px"}}>No loans recorded yet.</div>}
      <div style={{fontSize:14,color:"#8A97A8",lineHeight:1.5,marginTop:14}}>Borrowing adds money to Cash or Bank and records what is owed. Repayments reduce what is owed. The interest part of a repayment is saved as a "Loan interest" expense.</div>
    </div>
  );
}

