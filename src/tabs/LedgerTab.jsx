import { useState, useEffect } from "react";
import { BIZ, PARTNERS, bizPhones, can, firstName, fmtK, logAudit, makeAvgCost, partnerKey, recordMoney, saleCost, sb, shareOf, todayStr } from "../lib";
import { LoansTab } from "../tabs/LoansTab";
import { ActBox } from "../screens/ActBox";
import { Whobar } from "../screens/Whobar";
import { Confirm } from "../screens/Confirm";

export function LedgerTab({user,onMoney,bal,onChange}){
  const [rows,setRows]=useState([]); const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("overview"); // overview | register | statement | petty | owed
  const [acctFilter,setAcctFilter]=useState("all");
  const [regOpen,setRegOpen]=useState({}); const [pcOpen,setPcOpen]=useState({});
  const [typeFilter,setTypeFilter]=useState("all");
  const monthStart=new Date().toISOString().slice(0,7)+"-01";
  const [from,setFrom]=useState(monthStart); const [to,setTo]=useState(todayStr());
  const [stmtAcct,setStmtAcct]=useState("sacco");
  const lastMonthStart=(()=>{ const d=new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7)+"-01"; })();
  const lastMonthEnd=(()=>{ const d=new Date(); d.setDate(0); return d.toISOString().split("T")[0]; })();
  const [periods,setPeriods]=useState([{from:monthStart,to:todayStr()}]);
  const [act,setAct]=useState(null); const [saving,setSaving]=useState(false);
  // action fields
  const [amt,setAmt]=useState(""); const [who,setWho]=useState(user.full_name); const [dir,setDir]=useState("in"); const [acc,setAcc]=useState("sacco");
  const [inKind,setInKind]=useState("loan");
  const [pcNote,setPcNote]=useState(""); const [pcCat,setPcCat]=useState("Transport"); const [pcFrom,setPcFrom]=useState("cash");
  const [recAcct,setRecAcct]=useState("sacco"); const [recActual,setRecActual]=useState(""); const [recReason,setRecReason]=useState("");

  const [pl,setPl]=useState({sales:[],stock:[],expenses:[],losses:[]});
  const load=async()=>{ setLoading(true); try{
    const [m,sales,stock,expenses,losses]=await Promise.all([
      sb.get("karu_money","select=*&order=created_at.desc"),
      sb.get("karu_sales","select=*&voided=eq.false"),
      sb.get("karu_stock","select=*"),
      sb.get("karu_expenses","select=*"),
      sb.get("karu_losses","select=*").catch(()=>[])
    ]);
    setRows(m); setPl({sales,stock,expenses,losses});
  }catch(e){console.error(e);} setLoading(false); };
  useEffect(()=>{load();},[]);
  const refreshAll=async()=>{ await load(); if(onChange) onChange(); };

  const ACCTS=[["cash","Cash"],["sacco","SACCO"],["petty","Petty Cash"]];
  const acctLabel=a=>({cash:"Cash",sacco:"SACCO",petty:"Petty Cash",loans:"Loans"}[a]||(String(a).startsWith("owed_")?"Owed "+String(a).slice(5).replace(/^./,c=>c.toUpperCase()):a));
  const total=(bal.cash||0)+(bal.sacco||0)+(bal.petty||0);

  // ── Capital vs Profit (live) ──
  const stockAtCost=pl.stock.reduce((s,i)=>s+((i.qty_in-i.qty_sold-(i.qty_adjusted||0))*i.unit_cost),0);
  const avgCostFn=makeAvgCost(pl.stock);
  const cogsAll=pl.sales.reduce((s,x)=>s+saleCost(x,avgCostFn),0);
  const salesAll=pl.sales.reduce((s,x)=>s+Number(x.total),0);
  const expAll=pl.expenses.reduce((s,x)=>s+Number(x.amount),0);
  const lossAll=(pl.losses||[]).reduce((s,l)=>s+Number(l.cost_value||0),0);
  const grossProfitAll=salesAll-cogsAll;
  const netProfitAll=grossProfitAll-expAll-lossAll;
  const liquidAll=(bal?.cash||0)+(bal?.sacco||0)+(bal?.petty||0);
  // Capital float = total liquid + stock, minus profit already earned = the working capital still circulating
  const totalWorth=liquidAll+stockAtCost;
  const capitalFloat=totalWorth-netProfitAll;
  // Split the LIQUID total into capital vs realised profit sitting in cash.
  // netProfitAll is realised earnings (sales less COGS, expenses, losses). The profit you can actually
  // take now is that realised profit, capped at how much liquid cash exists; the rest of liquid is capital.
  const liquidProfitPortion=Math.max(0,Math.min(netProfitAll,liquidAll));
  const liquidCapitalPortion=liquidAll-liquidProfitPortion;

  // Balance check: sum of all money rows for real accounts should equal displayed balances
  const sumFor=a=>rows.filter(r=>r.account===a).reduce((s,r)=>s+Number(r.amount),0);
  const checkOK = Math.abs(sumFor("cash")-(bal.cash||0))<1 && Math.abs(sumFor("sacco")-(bal.sacco||0))<1 && Math.abs(sumFor("petty")-(bal.petty||0))<1;

  const PETTY_CATS=["Transport","Airtime","Refreshments","Cleaning","Supplies","Other"];

  // ── Actions ──
  const rb=()=>{setAmt("");setAct(null);setPcNote("");setRecActual("");setRecReason("");};
  const doBank=async()=>{ const a=Number(amt); if(!a)return; setSaving(true);
    await recordMoney([{account:"cash",amount:-a,type:"bank",description:"Banked cash",date:todayStr(),recorded_by:who},{account:"sacco",amount:a,type:"bank",description:"Banked cash",date:todayStr(),recorded_by:who}]);
    setSaving(false); rb(); refreshAll(); };
  const doWithdraw=async()=>{ const a=Number(amt); if(!a)return; setSaving(true);
    await recordMoney([{account:"sacco",amount:-a,type:"withdraw",description:"Withdrew to cash",date:todayStr(),recorded_by:who},{account:"cash",amount:a,type:"withdraw",description:"Withdrew to cash",date:todayStr(),recorded_by:who}]);
    setSaving(false); rb(); refreshAll(); };
  const doPartner=async()=>{ const a=Number(amt); if(!a||a<=0)return;
    const short=who.split(" ")[0]; const sk=short.toLowerCase();
    const owedNow=Number(bal["owed_"+sk]||0);
    if(dir==="in"){
      setSaving(true);
      if(inKind==="loan"){
        // Partner lends the business: cash in, business owes them more
        await recordMoney([
          {account:acc,amount:a,type:"partner_loan_in",partner:who,description:`${short} lent the business`,date:todayStr(),recorded_by:user.full_name},
          {account:"owed_"+sk,amount:a,type:"partner_loan_in",partner:who,description:`${short} lent the business`,date:todayStr(),recorded_by:user.full_name}
        ]);
      } else {
        // Capital / gift: cash in, tracked as their capital, NOT a repayable debt
        await recordMoney([
          {account:acc,amount:a,type:"partner_capital_in",partner:who,description:`${short} added capital`,date:todayStr(),recorded_by:user.full_name},
          {account:"capital_"+sk,amount:a,type:"partner_capital_in",partner:who,description:`${short} added capital`,date:todayStr(),recorded_by:user.full_name}
        ]);
      }
      setSaving(false); rb(); refreshAll();
    } else {
      // Takes out: reduce what's owed first, remainder is a drawing against their share.
      const fromOwed=Math.min(a,owedNow);
      const drawing=a-fromOwed;
      // Warn if drawing into capital beyond their profit share
      if(drawing>0){
        const share=shareOf(netProfitAll); // equal split between active owners
        const alreadyDrawn=Number(bal["drawn_"+sk]||0);
        if(alreadyDrawn+drawing>share){
          const over=alreadyDrawn+drawing-share;
          if(!confirm(`Heads up: this drawing of ${fmtK(drawing)} takes ${short}'s total drawings to ${fmtK(alreadyDrawn+drawing)}, which is ${fmtK(over)} MORE than their profit share of ${fmtK(share)}. That means drawing into capital. Continue?`)) return;
        }
      }
      setSaving(true);
      const rows=[{account:acc,amount:-a,type:"partner_out",partner:who,description:`${short} took out`,date:todayStr(),recorded_by:user.full_name}];
      if(fromOwed>0) rows.push({account:"owed_"+sk,amount:-fromOwed,type:"partner_repay",partner:who,description:`Repaid ${short} (from drawing)`,date:todayStr(),recorded_by:user.full_name});
      if(drawing>0) rows.push({account:"drawn_"+sk,amount:drawing,type:"partner_drawing",partner:who,description:`${short} drawing against share`,date:todayStr(),recorded_by:user.full_name});
      await recordMoney(rows);
      await logAudit({trip_no:null,record_id:null,action:"partner_out",field_changed:short,old_value:`owed ${Math.round(owedNow)}`,new_value:`drew ${Math.round(a)} (${Math.round(fromOwed)} repaid, ${Math.round(drawing)} drawing)`,reason:"Partner took money out",changed_by:user.full_name});
      setSaving(false); rb(); refreshAll();
    }
  };
  const doAllocatePetty=async()=>{ const a=Number(amt); if(!a)return; setSaving(true);
    // Just move money into the petty pocket. It is NOT an expense yet — the actual spends are the expenses.
    await recordMoney([{account:pcFrom,amount:-a,type:"petty_allocate",description:"Petty cash top-up",date:todayStr(),recorded_by:who},{account:"petty",amount:a,type:"petty_allocate",description:"Petty cash top-up",date:todayStr(),recorded_by:who}]);
    setSaving(false); rb(); refreshAll(); };
  const doPettySpend=async()=>{ const a=Number(amt); if(!a)return; if(!pcNote.trim()){alert("Add a note.");return;} setSaving(true);
    await recordMoney({account:"petty",amount:-a,type:"petty_spend",description:`${pcCat}: ${pcNote}`,date:todayStr(),recorded_by:who});
    // The spend is the real expense — record it so it appears in the Expenses tab, tagged as petty.
    await sb.post("karu_expenses",{date:todayStr(),category:"Petty cash",description:`${pcCat}: ${pcNote}`,amount:a,recorded_by:who,paid_from:"petty"});
    setSaving(false); rb(); refreshAll(); };
  const doReconcile=async()=>{ const cur=recAcct==="cash"?bal.cash:recAcct==="petty"?bal.petty:bal.sacco; const diff=Number(recActual)-cur;
    if(recActual===""){alert("Enter actual balance.");return;} if(diff===0){alert("No difference.");return;} if(!recReason.trim()){alert("Reason required.");return;}
    setSaving(true);
    await recordMoney({account:recAcct,amount:diff,type:"reconciliation",description:`Reconciliation: ${recReason}`,date:todayStr(),recorded_by:user.full_name});
    await logAudit({trip_no:null,record_id:null,action:"reconcile",field_changed:recAcct.toUpperCase(),old_value:String(Math.round(cur)),new_value:String(Math.round(Number(recActual))),reason:recReason,changed_by:user.full_name});
    setSaving(false); rb(); refreshAll(); };

  // ── Per-sale cost lookup (for splitting sale rows into capital + profit) ──
  const stockCostByName={};
  pl.stock.forEach(s=>{ const k=s.name.toLowerCase(); if(!stockCostByName[k])stockCostByName[k]=[]; stockCostByName[k].push({cost:Number(s.unit_cost),date:s.date_in}); });
  const avgCost=name=>{ const arr=stockCostByName[(name||"").toLowerCase()]; if(!arr||!arr.length)return 0; return arr.reduce((s,x)=>s+x.cost,0)/arr.length; };
  const saleSplit=ref=>{ const sale=pl.sales.find(x=>x.receipt_no===ref); if(!sale||!sale.items)return null; const cost=saleCost(sale,avgCostFn); return {cost:Math.round(cost),total:Number(sale.total)}; };

  // ── Filtered register with running balance ──
  const inRange=r=>r.date>=from&&r.date<=to;
  const registerRows=rows.filter(r=>inRange(r)&&(acctFilter==="all"||r.account===acctFilter)&&(typeFilter==="all"||r.type===typeFilter));
  const allTypes=[...new Set(rows.map(r=>r.type))].sort();

  // Statement: opening + movements + closing for one account
  const stmtAll=rows.filter(r=>r.account===stmtAcct).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const opening=stmtAll.filter(r=>r.date<from).reduce((s,r)=>s+Number(r.amount),0);
  const stmtRows=stmtAll.filter(r=>r.date>=from&&r.date<=to);
  let run=opening; const stmtWithRun=stmtRows.map(r=>{ run+=Number(r.amount); return {...r,running:run}; });
  const closing=run;

  const pettyRows=rows.filter(r=>r.account==="petty").sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const pettySpent=rows.filter(r=>r.account==="petty"&&r.type==="petty_spend").reduce((s,r)=>s+Math.abs(Number(r.amount)),0);

  const exportLedger=()=>{
    const esc=v=>{const s=v==null?"":String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
    const cols=["date","account","type","amount","description","partner","recorded_by"];
    const csv=[cols.join(","),...rows.map(r=>cols.map(c=>esc(r[c])).join(","))].join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`karu-ledger-${todayStr()}.csv`; a.click();
  };

  return (
    <div>
      {/* Balances header */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
        <div className="stat" style={{padding:"10px 8px"}}><div style={{fontSize:15,fontWeight:700,color:"#FFFFFF"}}>{fmtK(bal.cash||0)}</div><div className="stat-l">Cash</div></div>
        <div className="stat" style={{padding:"10px 8px"}}><div style={{fontSize:15,fontWeight:700,color:"#FFFFFF"}}>{fmtK(bal.sacco||0)}</div><div className="stat-l">SACCO</div></div>
        <div className="stat" style={{padding:"10px 8px"}}><div style={{fontSize:15,fontWeight:700,color:"#FFFFFF"}}>{fmtK(bal.petty||0)}</div><div className="stat-l">Petty</div></div>
      </div>
      <div style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:"12px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:14,color:"#AEB9C7"}}>Total on hand</span>
          <span style={{fontSize:18,fontWeight:700,color:"#F5C000"}}>{fmtK(total)}</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1,background:"transparent",border:"1px solid #24365C",borderRadius:7,padding:"8px 10px"}}>
            <div style={{fontSize:13,color:"#8A97A8"}}>CAPITAL (keep)</div>
            <div style={{fontSize:15,fontWeight:700,color:"#E8E2D4"}}>{fmtK(liquidCapitalPortion)}</div>
          </div>
          <div style={{flex:1,background:liquidProfitPortion>0?"rgba(76,175,80,0.08)":"#12203C",border:`1px solid ${liquidProfitPortion>0?"rgba(76,175,80,0.35)":"#24365C"}`,borderRadius:7,padding:"8px 10px"}}>
            <div style={{fontSize:13,color:"#8A97A8"}}>PROFIT (spendable)</div>
            <div style={{fontSize:15,fontWeight:700,color:liquidProfitPortion>0?"#4CAF50":"#8A97A8"}}>{fmtK(liquidProfitPortion)}</div>
          </div>
        </div>
        <div style={{fontSize:13,color:"#8A97A8",marginTop:8,lineHeight:1.4}}>{liquidProfitPortion>0?`You can take up to ${fmtK(liquidProfitPortion)} without touching capital.`:"All liquid money is capital right now — spending eats into the float."}</div>
      </div>
      {!checkOK&&<div style={{fontSize:14,marginBottom:12,color:"#E85B5B"}}>⚠ Balance mismatch. Review the register.</div>}

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {[["overview","Move money"],["register","Register"],["statement","Financials"],["loans","Loans"],["petty","Petty cash"]].map(([id,l])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 14px",borderRadius:100,border:`1px solid ${tab===id?"#F5C000":"#24365C"}`,background:tab===id?"rgba(245,192,0,0.1)":"transparent",color:tab===id?"#F5C000":"#C2CBD6",fontSize:14,fontWeight:tab===id?600:500,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif"}}>{l}</button>
        ))}
      </div>

      {tab==="overview"&&(
        <div>
          {!act&&<div>
            <div>
              <button onClick={()=>setAct("bank")} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",borderBottom:"1px solid #1A2A4A",padding:"14px 2px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}><div style={{fontSize:15,fontWeight:600,color:"#FFFFFF"}}>Bank cash into SACCO</div><div style={{fontSize:14,color:"#A9B5C6",marginTop:2}}>Move cash from the till into the SACCO account</div></button>
              <button onClick={()=>setAct("withdraw")} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",borderBottom:"1px solid #1A2A4A",padding:"14px 2px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}><div style={{fontSize:15,fontWeight:600,color:"#FFFFFF"}}>Withdraw SACCO to cash</div><div style={{fontSize:14,color:"#A9B5C6",marginTop:2}}>Take money out of SACCO into cash</div></button>
              <button onClick={()=>setAct("partner")} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",borderBottom:"1px solid #1A2A4A",padding:"14px 2px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}><div style={{fontSize:15,fontWeight:600,color:"#FFFFFF"}}>Partner money in or out</div><div style={{fontSize:14,color:"#A9B5C6",marginTop:2}}>Loans, capital and withdrawals by a partner</div></button>
              <button onClick={()=>setAct("allocate")} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",borderBottom:"1px solid #1A2A4A",padding:"14px 2px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}><div style={{fontSize:15,fontWeight:600,color:"#FFFFFF"}}>Top up petty cash</div><div style={{fontSize:14,color:"#A9B5C6",marginTop:2}}>Move money into the petty cash pocket</div></button>
              <button onClick={()=>setAct("reconcile")} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",borderBottom:"1px solid #1A2A4A",padding:"14px 2px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}><div style={{fontSize:15,fontWeight:600,color:"#FFFFFF"}}>Reconcile a balance</div><div style={{fontSize:14,color:"#A9B5C6",marginTop:2}}>Fix a balance after counting what is really there</div></button>
            </div>
          </div>}
          {act==="bank"&&<ActBox title="Bank cash into SACCO"><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)" autoFocus className="lg-in"/><Whobar who={who} setWho={setWho}/><Confirm on={doBank} off={rb} saving={saving}/></ActBox>}
          {act==="withdraw"&&<ActBox title="Withdraw SACCO to cash"><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)" autoFocus className="lg-in"/><Whobar who={who} setWho={setWho}/><Confirm on={doWithdraw} off={rb} saving={saving}/></ActBox>}
          {act==="partner"&&(()=>{ const sk=who.split(" ")[0].toLowerCase(); const owedNow=Number(bal["owed_"+sk]||0); const drawnNow=Number(bal["drawn_"+sk]||0); const share=shareOf(netProfitAll); const a=Number(amt||0);
            return (<ActBox title="Partner money"><Whobar who={who} setWho={setWho}/>
            <div className="tog" style={{marginBottom:8}}><button className={`tog-btn${dir==="in"?" on":""}`} onClick={()=>setDir("in")}>Puts in</button><button className={`tog-btn${dir==="out"?" on":""}`} onClick={()=>setDir("out")}>Takes out</button></div>
            {dir==="in"&&<div style={{marginBottom:8}}>
              <div className="tog" style={{marginBottom:6}}><button className={`tog-btn${inKind==="loan"?" on":""}`} onClick={()=>setInKind("loan")}>Loan (repayable)</button><button className={`tog-btn${inKind==="capital"?" on":""}`} onClick={()=>setInKind("capital")}>Capital / gift</button></div>
              <div style={{fontSize:13,color:"#8A97A8"}}>{inKind==="loan"?"Business will owe this back to "+who.split(" ")[0]+".":"Added to "+who.split(" ")[0]+"'s capital. Not repayable."}</div>
            </div>}
            {dir==="out"&&<div style={{fontSize:13,color:"#8A97A8",marginBottom:8,background:"transparent",border:"1px solid #2E4472",borderRadius:8,padding:"8px 10px",lineHeight:1.5}}>
              {who.split(" ")[0]} is owed {fmtK(owedNow)}, has drawn {fmtK(drawnNow)} so far. Profit share ~{fmtK(share)}.
              {a>0&&<div style={{marginTop:4,color:a>owedNow&&(drawnNow+(a-owedNow))>share?"#E8A45B":"#4CAF50"}}>{a<=owedNow?`All ${fmtK(a)} comes off what's owed.`:`${fmtK(owedNow)} off what's owed, ${fmtK(a-owedNow)} as a drawing.${(drawnNow+(a-owedNow))>share?" ⚠ exceeds profit share — into capital.":""}`}</div>}
            </div>}
            <div className="tog" style={{marginBottom:8}}>{ACCTS.map(([id,l])=><button key={id} className={`tog-btn${acc===id?" on":""}`} onClick={()=>setAcc(id)}>{l}</button>)}</div>
            <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)" className="lg-in"/><Confirm on={doPartner} off={rb} saving={saving}/></ActBox>);
          })()}
          {act==="allocate"&&<ActBox title="Top up petty cash"><div style={{fontSize:13,color:"#8899AA",marginBottom:8}}>Moves money into petty cash and records it as a Petty cash expense in reports.</div>
            <div className="tog" style={{marginBottom:8}}><button className={`tog-btn${pcFrom==="cash"?" on":""}`} onClick={()=>setPcFrom("cash")}>From Cash</button><button className={`tog-btn${pcFrom==="sacco"?" on":""}`} onClick={()=>setPcFrom("sacco")}>From SACCO</button></div>
            <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)" autoFocus className="lg-in"/><Whobar who={who} setWho={setWho}/><Confirm on={doAllocatePetty} off={rb} saving={saving}/></ActBox>}
          {act==="spend"&&<ActBox title="Record petty spend"><div style={{fontSize:13,color:"#8899AA",marginBottom:8}}>Petty cash balance: {fmtK(bal.petty||0)}</div>
            <div className="tog" style={{marginBottom:8,flexWrap:"wrap"}}>{PETTY_CATS.map(c=><button key={c} className={`tog-btn${pcCat===c?" on":""}`} onClick={()=>setPcCat(c)} style={{fontSize:13,flex:"none",padding:"6px 10px"}}>{c}</button>)}</div>
            <input value={pcNote} onChange={e=>setPcNote(e.target.value)} placeholder="What for? e.g. matatu to Kiambu" className="lg-in"/>
            <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (KSh)" className="lg-in"/><Whobar who={who} setWho={setWho}/><Confirm on={doPettySpend} off={rb} saving={saving}/></ActBox>}
          {act==="reconcile"&&<ActBox title="Reconcile a balance"><div className="tog" style={{marginBottom:8}}>{ACCTS.map(([id,l])=><button key={id} className={`tog-btn${recAcct===id?" on":""}`} onClick={()=>setRecAcct(id)}>{l}</button>)}</div>
            <div style={{fontSize:14,color:"#8899AA",marginBottom:8}}>App shows: {fmtK(recAcct==="cash"?bal.cash:recAcct==="petty"?bal.petty:bal.sacco)}</div>
            <input type="number" step="0.01" value={recActual} onChange={e=>setRecActual(e.target.value)} placeholder="Actual balance (KSh)" autoFocus className="lg-in"/>
            <input value={recReason} onChange={e=>setRecReason(e.target.value)} placeholder="Reason (e.g. SACCO interest)" className="lg-in"/><Confirm on={doReconcile} off={rb} saving={saving}/></ActBox>}
        </div>
      )}

      {tab==="register"&&(
        <div>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            {(()=>{ const y=new Date(); const m3=new Date(); m3.setMonth(m3.getMonth()-3); const yStart=y.getFullYear()+"-01-01";
              const ranges=[["This month",monthStart,todayStr()],["Last 3 months",m3.toISOString().split("T")[0],todayStr()],["This year",yStart,todayStr()],["All",(rows.length?rows.map(r=>r.date).sort()[0]:yStart),todayStr()]];
              return ranges.map(([lbl,f,t])=><button key={lbl} onClick={()=>{setFrom(f);setTo(t);}} style={{...pill(from===f&&to===t),fontSize:13,padding:"5px 10px"}}>{lbl}</button>);
            })()}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><div style={{fontSize:13,color:"#8899AA",marginBottom:3}}>FROM</div><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="lg-in" style={{margin:0}}/></div>
            <div><div style={{fontSize:13,color:"#8899AA",marginBottom:3}}>TO</div><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="lg-in" style={{margin:0}}/></div>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:8,overflowX:"auto"}}>
            <button onClick={()=>setAcctFilter("all")} style={pill(acctFilter==="all")}>All accounts</button>
            {ACCTS.map(([id,l])=><button key={id} onClick={()=>setAcctFilter(id)} style={pill(acctFilter===id)}>{l}</button>)}
          </div>
          <div style={{fontSize:13,color:"#8A97A8",marginBottom:8}}>{registerRows.length} movements · <button onClick={exportLedger} style={{background:"none",border:"none",color:"#AEB9C7",fontSize:13,cursor:"pointer",textDecoration:"underline"}}>Export CSV</button></div>
          {registerRows.length===0?<div style={{color:"#8A97A8",textAlign:"center",padding:"20px 0",fontSize:14}}>No movements in range.</div>:(()=>{
            const regRow=(r)=>{ const isSale=r.type==="sale"&&r.ref; const sp=isSale?saleSplit(r.ref):null; return (
              <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #101B36"}}>
                <div style={{flex:1,minWidth:0,paddingRight:8}}>
                  <div style={{fontSize:14,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.description||r.type}</div>
                  <div style={{fontSize:12,color:"#8A97A8"}}>{acctLabel(r.account)} · {r.recorded_by?.split(" ")[0]||""}</div>
                  {sp&&sp.cost>0&&<div style={{fontSize:12,color:"#8A97A8",marginTop:1}}>capital {fmtK(sp.cost)} · profit <span style={{color:"#4CAF50"}}>{fmtK(Math.max(0,Number(r.amount)-sp.cost))}</span></div>}
                </div>
                <div style={{fontSize:14,fontWeight:600,color:Number(r.amount)>=0?"#4CAF50":"#E85B5B",whiteSpace:"nowrap"}}>{Number(r.amount)>=0?"+":""}{Math.round(Number(r.amount)).toLocaleString()}</div>
              </div>
            );};
            const dayNet=arr=>arr.reduce((n,r)=>n+Number(r.amount),0);
            const tg=k=>setRegOpen(x=>({...x,[k]:!x[k]}));
            const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
            const now=new Date(); const cm=now.toISOString().slice(0,7); const cy=String(now.getFullYear());
            const days={}; registerRows.forEach(r=>{ if(!days[r.date])days[r.date]=[]; days[r.date].push(r); });
            const cmd=[]; const mg={}; const yg={};
            Object.keys(days).sort((a,b)=>b.localeCompare(a)).forEach(d=>{ const ym=d.slice(0,7),y=d.slice(0,4); if(ym===cm)cmd.push(d); else if(y===cy){(mg[ym]=mg[ym]||[]).push(d);} else {(yg[y]=yg[y]||[]).push(d);} });
            const fmtD=d=>new Date(d+"T00:00:00").toLocaleDateString("en-KE",{weekday:"short",day:"2-digit",month:"short"});
            const net=n=>`${n>=0?"+":""}${Math.round(n).toLocaleString()}`;
            const dayBlock=(d,sub)=>(<div key={d} style={{marginBottom:sub?6:8}}>
              <div onClick={()=>tg(d)} style={{display:"flex",justifyContent:"space-between",cursor:"pointer",padding:sub?"6px 0":"8px 10px",background:sub?"none":"#0A1128",border:sub?"none":"1px solid #1A2A4A",borderRadius:8,borderBottom:sub?"1px solid #101B36":undefined}}>
                <span style={{fontSize:sub?12:13,fontWeight:600,color:"#E8E2D4"}}>{regOpen[d]?"▾":"▸"} {fmtD(d)}</span>
                <span style={{fontSize:sub?12:13,fontWeight:600,color:dayNet(days[d])>=0?"#4CAF50":"#E85B5B"}}>{net(dayNet(days[d]))}</span>
              </div>
              {regOpen[d]&&<div style={{padding:sub?0:"0 10px"}}>{days[d].map(regRow)}</div>}
            </div>);
            return (<div>
              {cmd.map(d=>dayBlock(d,false))}
              {Object.keys(mg).sort((a,b)=>b.localeCompare(a)).map(ym=>{ const t=mg[ym].reduce((n,d)=>n+dayNet(days[d]),0); return (
                <div key={ym} style={{marginBottom:8}}>
                  <div onClick={()=>tg(ym)} style={{display:"flex",justifyContent:"space-between",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #24365C",borderRadius:8}}>
                    <span style={{fontSize:14,fontWeight:600,color:"#AEB9C7"}}>{regOpen[ym]?"▾":"▸"} {MONTHS[parseInt(ym.slice(5,7))-1]}</span>
                    <span style={{fontSize:14,fontWeight:600,color:t>=0?"#4CAF50":"#E85B5B"}}>{net(t)}</span>
                  </div>
                  {regOpen[ym]&&<div style={{padding:"4px 10px 0"}}>{mg[ym].map(d=>dayBlock(d,true))}</div>}
                </div>);})}
              {Object.keys(yg).sort((a,b)=>b.localeCompare(a)).map(y=>{ const t=yg[y].reduce((n,d)=>n+dayNet(days[d]),0); return (
                <div key={y} style={{marginBottom:8}}>
                  <div onClick={()=>tg(y)} style={{display:"flex",justifyContent:"space-between",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #2E4472",borderRadius:8}}>
                    <span style={{fontSize:14,fontWeight:700,color:"#E8E2D4"}}>{regOpen[y]?"▾":"▸"} {y}</span>
                    <span style={{fontSize:14,fontWeight:700,color:t>=0?"#4CAF50":"#E85B5B"}}>{net(t)}</span>
                  </div>
                  {regOpen[y]&&<div style={{padding:"4px 10px 0"}}>{yg[y].map(d=>dayBlock(d,true))}</div>}
                </div>);})}
            </div>);
          })()}
        </div>
      )}

      {tab==="statement"&&(()=>{
        const EXP_CATS_LIST=["Rent","Transport","Utilities","Marketing","Staff","Loan interest","Petty cash","Other"];
        const costLookup={}; pl.stock.forEach(st=>{ const k=st.name.toLowerCase(); if(!costLookup[k])costLookup[k]=[]; costLookup[k].push(Number(st.unit_cost)); });
        const avgC=n=>{ const a=costLookup[(n||"").toLowerCase()]; return a&&a.length?a.reduce((x,y)=>x+y,0)/a.length:0; };
        const computePL=(f,t)=>{
          const inR=d=>d>=f&&d<=t;
          const s=pl.sales.filter(x=>inR(x.date)); const e=pl.expenses.filter(x=>inR(x.date)); const lo=(pl.losses||[]).filter(x=>inR(x.date));
          const revenue=s.reduce((a,x)=>a+Number(x.total),0);
          const cogs=s.reduce((a,x)=>a+saleCost(x,avgC),0);
          const byCat={}; EXP_CATS_LIST.forEach(c=>byCat[c]=0);
          e.forEach(x=>{ const c=EXP_CATS_LIST.includes(x.category)?x.category:"Other"; byCat[c]+=Number(x.amount); });
          const expTotal=e.reduce((a,x)=>a+Number(x.amount),0);
          const lossTotal=lo.reduce((a,x)=>a+Number(x.cost_value||0),0);
          const gross=revenue-cogs; const net=gross-expTotal-lossTotal;
          return {revenue,cogs,byCat,expTotal,lossTotal,gross,net};
        };
        const results=periods.map(p=>({...p,pl:computePL(p.from,p.to)}));
        const nCol=results.length;
        const cashA=bal.cash||0, saccoA=bal.sacco||0, pettyA=bal.petty||0, stockA=stockAtCost;
        const totalAssets=cashA+saccoA+pettyA+stockA;
        const owedRows=PARTNERS.map(p=>({name:firstName(p),amt:bal["owed_"+partnerKey(p)]||0})); const owesTotal=owedRows.reduce((s,r)=>s+r.amt,0), loansOwed=bal.loans||0; const totalLiab=owesTotal+loansOwed;
        const netWorth=totalAssets-totalLiab;
        const genDate=new Date().toLocaleDateString("en-KE",{day:"2-digit",month:"long",year:"numeric"});
        const fmtP=n=>Math.round(n).toLocaleString();
        const _MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const _fd=d=>`${parseInt(d.slice(8,10))} ${_MN[parseInt(d.slice(5,7))-1]}`;
        const perLabel=(f,t)=>f.slice(0,4)===t.slice(0,4)?`${_fd(f)} to ${_fd(t)} ${t.slice(0,4)}`:`${_fd(f)} ${f.slice(0,4)} to ${_fd(t)} ${t.slice(0,4)}`;
        const setP=(i,k,v)=>setPeriods(ps=>ps.map((p,j)=>j===i?{...p,[k]:v}:p));
        const addP=()=>setPeriods(ps=>ps.length<3?[...ps,{from:monthStart,to:todayStr()}]:ps);
        const rmP=i=>setPeriods(ps=>ps.length>1?ps.filter((_,j)=>j!==i):ps);
        const Row=({label,vals,bold,neg,total})=>(
          <tr>
            <td style={{padding:total||bold?"7px 6px":"3px 6px",fontSize:bold?12:11.5,fontWeight:bold?700:400,color:"#111",paddingLeft:bold?6:16,borderTop:total?"1.5px solid #050A1F":"none"}}>{label}</td>
            {vals.map((v,i)=><td key={i} style={{padding:total||bold?"7px 6px":"3px 6px",fontSize:bold?12:11.5,fontWeight:bold?700:500,textAlign:"right",color:neg?"#b00":"#111",borderTop:total?"1.5px solid #050A1F":"none",whiteSpace:"nowrap"}}>{v==null?"":(neg?`(${fmtP(v)})`:fmtP(v))}</td>)}
          </tr>
        );
        const Band=({label})=>(<tr><td colSpan={nCol+1} style={{background:"#2E4472",color:"#fff",fontSize:11.5,fontWeight:700,padding:"6px 8px",letterSpacing:"0.04em"}}>{label}</td></tr>);
        return (
        <div>
          {results.map((p,i)=>(
            <div key={i} style={{marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:13,color:"#8A97A8",minWidth:64}}>PERIOD {String.fromCharCode(65+i)}</span>
                {periods.length>1&&<button onClick={()=>rmP(i)} style={{background:"none",border:"none",color:"#E85B5B",fontSize:14,cursor:"pointer",marginLeft:"auto"}}>×</button>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <input type="date" value={p.from} onChange={e=>setP(i,"from",e.target.value)} className="lg-in" style={{margin:0}}/>
                <input type="date" value={p.to} onChange={e=>setP(i,"to",e.target.value)} className="lg-in" style={{margin:0}}/>
              </div>
            </div>
          ))}
          {periods.length<3&&<button onClick={addP} style={{background:"none",border:"1px dashed #24365C",borderRadius:6,color:"#8A97A8",fontSize:14,padding:"7px 12px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginBottom:12,width:"100%"}}>+ Add a period to compare (up to 3)</button>}
          <div id="karu-statement" style={{background:"#fff",color:"#111",borderRadius:10,padding:"18px 12px"}}>
            <div style={{textAlign:"center",borderBottom:"2px solid #050A1F",paddingBottom:10,marginBottom:12}}>
              <div style={{fontSize:19,fontWeight:800,letterSpacing:"0.06em",color:"#050A1F"}}>{BIZ.name}</div>
              <div style={{fontSize:13,color:"#555",marginTop:2}}>Income Statement &amp; Financial Position</div>
              <div style={{fontSize:10.5,color:"#888",marginTop:2}}>Snapshot as of {genDate}</div>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={{textAlign:"left",fontSize:10,color:"#888",padding:"2px 6px",fontWeight:600}}></th>
                {results.map((p,i)=><th key={i} style={{textAlign:"right",fontSize:10,color:"#050A1F",padding:"2px 6px",fontWeight:700,whiteSpace:"nowrap"}}>{perLabel(p.from,p.to)}</th>)}
              </tr></thead>
              <tbody>
                <Band label="REVENUE"/>
                <Row label="Sales revenue" vals={results.map(r=>r.pl.revenue)}/>
                <Row label="Total Revenue" vals={results.map(r=>r.pl.revenue)} bold total/>
                <Band label="COST OF GOODS SOLD"/>
                <Row label="Cost of goods sold" vals={results.map(r=>r.pl.cogs)} neg/>
                <Row label="Gross Profit" vals={results.map(r=>r.pl.gross)} bold total/>
                <Band label="EXPENSES"/>
                {EXP_CATS_LIST.map(c=>(results.some(r=>r.pl.byCat[c]>0)?<Row key={c} label={c} vals={results.map(r=>r.pl.byCat[c])} neg/>:null))}
                {results.some(r=>r.pl.lossTotal>0)&&<Row label="Losses (theft/damage)" vals={results.map(r=>r.pl.lossTotal)} neg/>}
                <Row label="Total Expenses" vals={results.map(r=>r.pl.expTotal+r.pl.lossTotal)} bold total/>
                <tr><td colSpan={nCol+1} style={{padding:"4px 0"}}></td></tr>
                <Row label="NET PROFIT" vals={results.map(r=>r.pl.net)} bold total/>
              </tbody>
            </table></div>
            <div style={{marginTop:16}}>
              <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
                <tbody>
                  <Band label="FINANCIAL POSITION (AS OF TODAY)"/>
                  <Row label="Cash at hand" vals={[cashA,...Array(nCol-1).fill(null)]}/>
                  <Row label="SACCO" vals={[saccoA,...Array(nCol-1).fill(null)]}/>
                  <Row label="Petty cash" vals={[pettyA,...Array(nCol-1).fill(null)]}/>
                  <Row label="Stock (at cost)" vals={[stockA,...Array(nCol-1).fill(null)]}/>
                  <Row label="Total Assets" vals={[totalAssets,...Array(nCol-1).fill(null)]} bold total/>
                  {totalLiab>0&&<>
                    {owedRows.map(r=>r.amt>0&&<Row key={r.name} label={"Owed to "+r.name} vals={[r.amt,...Array(nCol-1).fill(null)]} neg/>)}
                    {loansOwed>0&&<Row label="Loans payable" vals={[loansOwed,...Array(nCol-1).fill(null)]} neg/>}
                    <Row label="Total Liabilities" vals={[totalLiab,...Array(nCol-1).fill(null)]} bold total/>
                  </>}
                  <Row label="NET WORTH" vals={[netWorth,...Array(nCol-1).fill(null)]} bold total/>
                </tbody>
              </table></div>
              {nCol>1&&<div style={{fontSize:9.5,color:"#999",marginTop:6}}>Financial position is a single snapshot as of today; only performance figures compare across periods.</div>}
            </div>
            <div style={{textAlign:"center",fontSize:9.5,color:"#999",marginTop:16,paddingTop:10,borderTop:"1px solid #ddd"}}>{BIZ.name} · {BIZ.address} · {bizPhones()}<br/>Generated {genDate} from KARU Accounts. Figures management-prepared, unaudited.</div>
          </div>
          <button className="btn-y" onClick={()=>{document.body.classList.add("printing-statement");window.print();setTimeout(()=>document.body.classList.remove("printing-statement"),500);}} style={{width:"100%",marginTop:12}}>Print / Save as PDF</button>
          <div style={{fontSize:13,color:"#8A97A8",marginTop:8,textAlign:"center"}}>Screenshot, or Print to save as PDF for a bank or partner.</div>
        </div>
        );
      })()}

      {tab==="loans"&&<LoansTab user={user} onChange={onChange}/>}

      {tab==="petty"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div className="stat"><div className="stat-n" style={{color:"#F5C000"}}>{fmtK(bal.petty||0)}</div><div className="stat-l">In petty cash</div></div>
            <div className="stat"><div className="stat-n" style={{color:"#E85B5B"}}>{fmtK(pettySpent)}</div><div className="stat-l">Spent all time</div></div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button className="btn-y" onClick={()=>{setTab("overview");setAct("allocate");}} style={{flex:1,fontSize:14}}>Top up petty cash</button>
          </div>
          <div style={{fontSize:13,color:"#8A97A8",marginBottom:12}}>Record petty spends on the Expenses tab (+ Petty spend). They appear here and in your expenses.</div>
          {pettyRows.length===0?<div style={{color:"#8A97A8",textAlign:"center",padding:"20px 0",fontSize:14}}>No petty cash activity yet.</div>:(()=>{
            const pcRow=(r)=>(
              <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #101B36"}}>
                <div style={{flex:1,minWidth:0,paddingRight:8}}><div style={{fontSize:14,fontWeight:500}}>{r.description||r.type}</div><div style={{fontSize:12,color:"#8A97A8"}}>{r.recorded_by?.split(" ")[0]||""}</div></div>
                <div style={{fontSize:14,fontWeight:600,color:Number(r.amount)>=0?"#4CAF50":"#E85B5B"}}>{Number(r.amount)>=0?"+":""}{Math.round(Number(r.amount)).toLocaleString()}</div>
              </div>
            );
            const dayNet=arr=>arr.reduce((n,r)=>n+Number(r.amount),0);
            const tg=k=>setPcOpen(x=>({...x,[k]:!x[k]}));
            const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
            const now=new Date(); const cm=now.toISOString().slice(0,7); const cy=String(now.getFullYear());
            const days={}; pettyRows.forEach(r=>{ if(!days[r.date])days[r.date]=[]; days[r.date].push(r); });
            const cmd=[]; const mg={}; const yg={};
            Object.keys(days).sort((a,b)=>b.localeCompare(a)).forEach(d=>{ const ym=d.slice(0,7),y=d.slice(0,4); if(ym===cm)cmd.push(d); else if(y===cy){(mg[ym]=mg[ym]||[]).push(d);} else {(yg[y]=yg[y]||[]).push(d);} });
            const fmtD=d=>new Date(d+"T00:00:00").toLocaleDateString("en-KE",{weekday:"short",day:"2-digit",month:"short"});
            const net=n=>`${n>=0?"+":""}${Math.round(n).toLocaleString()}`;
            const dayBlock=(d,sub)=>(<div key={d} style={{marginBottom:sub?6:8}}>
              <div onClick={()=>tg(d)} style={{display:"flex",justifyContent:"space-between",cursor:"pointer",padding:sub?"6px 0":"8px 10px",background:sub?"none":"#0A1128",border:sub?"none":"1px solid #1A2A4A",borderRadius:8,borderBottom:sub?"1px solid #101B36":undefined}}>
                <span style={{fontSize:sub?12:13,fontWeight:600,color:"#E8E2D4"}}>{pcOpen[d]?"▾":"▸"} {fmtD(d)}</span>
                <span style={{fontSize:sub?12:13,fontWeight:600,color:dayNet(days[d])>=0?"#4CAF50":"#E85B5B"}}>{net(dayNet(days[d]))}</span>
              </div>
              {pcOpen[d]&&<div style={{padding:sub?0:"0 10px"}}>{days[d].map(pcRow)}</div>}
            </div>);
            return (<div>
              {cmd.map(d=>dayBlock(d,false))}
              {Object.keys(mg).sort((a,b)=>b.localeCompare(a)).map(ym=>{ const t=mg[ym].reduce((n,d)=>n+dayNet(days[d]),0); return (
                <div key={ym} style={{marginBottom:8}}>
                  <div onClick={()=>tg(ym)} style={{display:"flex",justifyContent:"space-between",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #24365C",borderRadius:8}}>
                    <span style={{fontSize:14,fontWeight:600,color:"#AEB9C7"}}>{pcOpen[ym]?"▾":"▸"} {MONTHS[parseInt(ym.slice(5,7))-1]}</span>
                    <span style={{fontSize:14,fontWeight:600,color:t>=0?"#4CAF50":"#E85B5B"}}>{net(t)}</span>
                  </div>
                  {pcOpen[ym]&&<div style={{padding:"4px 10px 0"}}>{mg[ym].map(d=>dayBlock(d,true))}</div>}
                </div>);})}
              {Object.keys(yg).sort((a,b)=>b.localeCompare(a)).map(y=>{ const t=yg[y].reduce((n,d)=>n+dayNet(days[d]),0); return (
                <div key={y} style={{marginBottom:8}}>
                  <div onClick={()=>tg(y)} style={{display:"flex",justifyContent:"space-between",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #2E4472",borderRadius:8}}>
                    <span style={{fontSize:14,fontWeight:700,color:"#E8E2D4"}}>{pcOpen[y]?"▾":"▸"} {y}</span>
                    <span style={{fontSize:14,fontWeight:700,color:t>=0?"#4CAF50":"#E85B5B"}}>{net(t)}</span>
                  </div>
                  {pcOpen[y]&&<div style={{padding:"4px 10px 0"}}>{yg[y].map(d=>dayBlock(d,true))}</div>}
                </div>);})}
            </div>);
          })()}
        </div>
      )}
    </div>
  );
}

const pill=(on)=>({padding:"5px 12px",borderRadius:100,border:`1px solid ${on?"#F5C000":"#1A2A4A"}`,background:on?"rgba(245,192,0,0.1)":"transparent",color:on?"#F5C000":"#8899AA",fontSize:14,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif"});
