import { useState, useEffect } from "react";
import { fmtK, makeAvgCost, saleCost, sb, todayStr } from "../lib";

export function ReportsTab({user,bal}){
  const [data,setData]=useState({sales:[],expenses:[],stock:[],losses:[]});
  const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState("month");
  const [drill,setDrill]=useState(null); // {title, rows:[{label,sub,amount}], total, color}

  useEffect(()=>{loadAll();},[]);
  const loadAll=async()=>{
    setLoading(true);
    try{
      const [sales,expenses,stock,losses]=await Promise.all([
        sb.get("karu_sales","select=*&voided=eq.false&order=date.desc"),
        sb.get("karu_expenses","select=*&order=date.desc"),
        sb.get("karu_stock","select=*"),
        sb.get("karu_losses","select=*&order=date.desc").catch(()=>[])
      ]);
      setData({sales,expenses,stock,losses});
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
      } else if(kind==="losses"){
        const all=await sb.get("karu_losses","select=*&order=date.desc");
        dl("losses",all.map(l=>({date:l.date,kind:l.kind,item:l.item_name,qty:l.qty,cost_value:l.cost_value,retail_value:l.retail_value,description:l.description,recorded_by:l.recorded_by})));
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
  const salesValue=fSales.reduce((s,x)=>s+Number(x.total),0);
  const collected=fSales.reduce((s,x)=>s+Number(x.amount_paid!=null?x.amount_paid:x.total),0);
  const receivables=fSales.reduce((s,x)=>s+Number(x.balance_due||0),0);
  const expenses=fExp.reduce((s,x)=>s+Number(x.amount),0);
  const stockValue=data.stock.reduce((s,i)=>s+((i.qty_in-i.qty_sold-(i.qty_adjusted||0))*i.unit_cost),0);
  const stockRetail=data.stock.reduce((s,i)=>s+((i.qty_in-i.qty_sold-(i.qty_adjusted||0))*(i.selling_price||0)),0);
  const stockPotentialProfit=stockRetail-stockValue;
  const avgCostR=makeAvgCost(data.stock);
  const cogs=fSales.reduce((s,x)=>s+saleCost(x,avgCostR),0);
  const fLosses=filterDate(data.losses||[]);
  const lossCost=fLosses.reduce((s,l)=>s+Number(l.cost_value||0),0);
  const grossProfit=salesValue-cogs;
  const netProfit=grossProfit-expenses-lossCost;
  // ── Capital health ──
  const liquid=(bal?.cash||0)+(bal?.sacco||0)+(bal?.petty||0);
  const totalCapital=liquid+stockValue;
  const liquidPct=totalCapital>0?Math.round(liquid/totalCapital*100):0;
  const SAFETY_FLOOR=(()=>{ try{ const v=localStorage.getItem("karu_safety_floor"); return v?Number(v):15000; }catch{ return 15000; } })();
  const inflow=collected;
  const outflow=expenses+lossCost;
  const netFlow=inflow-outflow;
  let capState="green", capMsg="Healthy — liquid money is strong and inflow covers costs.";
  if(liquid<SAFETY_FLOOR){ capState="red"; capMsg=`Below your safety floor of ${fmtK(SAFETY_FLOOR)}. Liquid cash is critically low — hold off on non-essential spend and prioritise collecting balances.`; }
  else if(netFlow<0){ capState="amber"; capMsg=`Draining — this period you spent ${fmtK(Math.abs(netFlow))} more than you collected. If this continues, capital erodes.`; }
  else if(liquid<SAFETY_FLOOR*1.5){ capState="amber"; capMsg="Thinning — liquid money is getting close to your safety floor. Watch spending."; }
  const capColor=capState==="green"?"#4CAF50":capState==="amber"?"#E8A45B":"#E85B5B";
  // ── Growth projection ──
  const monthsOfData=(()=>{ const ms=new Set(); data.sales.forEach(s=>ms.add(s.date.slice(0,7))); data.expenses.forEach(e=>ms.add(e.date.slice(0,7))); return Math.max(1,ms.size); })();
  const allNet=(()=>{ const sv=data.sales.reduce((s,x)=>s+Number(x.total),0); const cg=data.stock.reduce((s,i)=>s+(i.qty_sold*i.unit_cost),0); const ex=data.expenses.reduce((s,x)=>s+Number(x.amount),0); const lo=(data.losses||[]).reduce((s,l)=>s+Number(l.cost_value||0),0); return sv-cg-ex-lo; })();
  const avgMonthlyNet=allNet/monthsOfData;
  const proj=[3,6,12].map(m=>({months:m,value:Math.round(totalCapital+avgMonthlyNet*m)}));

  const dailyMap={};
  fSales.forEach(s=>{dailyMap[s.date]=(dailyMap[s.date]||0)+Number(s.total);});
  const chartData=Object.entries(dailyMap).sort(([a],[b])=>a.localeCompare(b)).slice(-14).map(([date,total])=>({date:date.slice(5),total}));
  // Profit vs Expenses, bucketed by period: day for week/month, month for year/all.
  const blendedMargin = salesValue>0 ? grossProfit/salesValue : 0;
  const byMonth = (period==="year"||period==="all");
  const monthSummary = (period==="month");
  const bucketKey = dateStr => byMonth ? dateStr.slice(0,7) : dateStr; // YYYY-MM or full date
  const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const bucketLabel = key => byMonth ? MONTHS[parseInt(key.slice(5,7))-1]+(period==="all"?" "+key.slice(2,4):"") : key.slice(5);
  const pvMap={};
  fSales.forEach(s=>{ const k=bucketKey(s.date); if(!pvMap[k])pvMap[k]={profit:0,expenses:0}; pvMap[k].profit += Number(s.total)*blendedMargin; });
  fExp.forEach(e=>{ const k=bucketKey(e.date); if(!pvMap[k])pvMap[k]={profit:0,expenses:0}; pvMap[k].expenses += Number(e.amount); });
  const pvCap = byMonth ? 12 : 31;
  let pvData;
  if(monthSummary){
    const tp=Object.values(pvMap).reduce((s,v)=>s+v.profit,0);
    const te=Object.values(pvMap).reduce((s,v)=>s+v.expenses,0);
    pvData=[{date:MONTHS[now.getMonth()],Profit:Math.round(tp),Expenses:Math.round(te)}];
  } else {
    pvData=Object.entries(pvMap).sort(([a],[b])=>a.localeCompare(b)).slice(-pvCap).map(([key,v])=>({date:bucketLabel(key),Profit:Math.round(v.profit),Expenses:Math.round(v.expenses)}));
  }
  // Period totals for the card
  const periodProfit = Math.round(salesValue*blendedMargin - 0); // gross margin portion earned on invoiced
  const pvTotalProfit = Object.values(pvMap).reduce((s,v)=>s+v.profit,0);
  const pvTotalExpenses = Object.values(pvMap).reduce((s,v)=>s+v.expenses,0);

  const itemMap={};
  fSales.forEach(s=>{ if(s.items) s.items.forEach(i=>{ if(!itemMap[i.name]) itemMap[i.name]={qty:0,revenue:0}; itemMap[i.name].qty+=Number(i.qty||1); itemMap[i.name].revenue+=Number(i.qty||1)*Number(i.price||0); }); });
  const topItems=Object.entries(itemMap).sort(([,a],[,b])=>b.revenue-a.revenue).slice(0,5);

  const expMap={};
  fExp.forEach(e=>{expMap[e.category]=(expMap[e.category]||0)+Number(e.amount);});
  const expBreakdown=Object.entries(expMap).sort(([,a],[,b])=>b-a);
  const mpesa=fSales.filter(s=>s.payment_method==="M-Pesa").reduce((s,x)=>s+Number(x.amount_paid!=null?x.amount_paid:x.total),0);
  const cash=fSales.filter(s=>s.payment_method==="Cash").reduce((s,x)=>s+Number(x.amount_paid!=null?x.amount_paid:x.total),0);

  // Drill-down builders: each returns {title,color,total,rows:[{label,sub,amount}]}
  const drillCollected=()=>({ title:"Collected", color:"#4CAF50", total:collected,
    rows:fSales.filter(s=>Number(s.amount_paid!=null?s.amount_paid:s.total)>0).map(s=>({label:s.customer_name,sub:`${s.receipt_no} · ${s.date.slice(5)} · ${s.payment_method}`,amount:Number(s.amount_paid!=null?s.amount_paid:s.total)})) });
  const drillExpenses=()=>({ title:"Expenses", color:"#E85B5B", total:expenses,
    rows:fExp.map(e=>({label:e.description||e.category,sub:`${e.category} · ${e.date.slice(5)} · ${e.recorded_by?.split(" ")[0]||""}`,amount:Number(e.amount)})) });
  const drillSalesValue=()=>({ title:"Sales value (invoiced)", color:"#8899AA", total:salesValue,
    rows:fSales.map(s=>({label:s.customer_name,sub:`${s.receipt_no} · ${s.date.slice(5)}`,amount:Number(s.total)})) });
  const drillOwed=()=>({ title:"Owed to us", color:"#E8A45B", total:receivables,
    rows:fSales.filter(s=>Number(s.balance_due||0)>0).map(s=>({label:s.customer_name,sub:`${s.receipt_no} · paid ${fmtK(Number(s.amount_paid||0))} of ${fmtK(Number(s.total))}`,amount:Number(s.balance_due)})) });
  const drillGross=()=>({ title:"Gross profit breakdown", color:"#F5C000", total:grossProfit,
    rows:[{label:"Sales value (invoiced)",sub:"what was billed",amount:salesValue},{label:"Less: cost of goods sold",sub:"COGS on items sold",amount:-cogs}] });
  const drillNet=()=>({ title:"Net profit breakdown", color:netProfit>=0?"#4CAF50":"#E85B5B", total:netProfit,
    rows:[{label:"Gross profit",sub:"sales value less COGS",amount:grossProfit},{label:"Less: expenses",sub:`${fExp.length} entries`,amount:-expenses},...(lossCost>0?[{label:"Less: losses",sub:`${fLosses.length} incidents`,amount:-lossCost}]:[])] });

  if(loading) return <div style={{textAlign:"center",padding:"2rem",color:"#8A97A8"}}>Loading reports...</div>;

  return (
    <div>
      {/* Month-on-month table */}
      {(()=>{
        // Per-item average cost for COGS
        const costLookup={}; data.stock.forEach(st=>{ const k=st.name.toLowerCase(); if(!costLookup[k])costLookup[k]=[]; costLookup[k].push(Number(st.unit_cost)); });
        const avgCost=n=>{ const a=costLookup[(n||"").toLowerCase()]; return a&&a.length?a.reduce((x,y)=>x+y,0)/a.length:0; };
        const mmap={};
        data.sales.forEach(s=>{const m=s.date.slice(0,7);if(!mmap[m])mmap[m]={collected:0,cogs:0,expenses:0};
          mmap[m].collected+=Number(s.amount_paid!=null?s.amount_paid:s.total);
          mmap[m].cogs+=saleCost(s,avgCost);
        });
        data.expenses.forEach(e=>{const m=e.date.slice(0,7);if(!mmap[m])mmap[m]={collected:0,cogs:0,expenses:0};mmap[m].expenses+=Number(e.amount);});
        const rows=Object.entries(mmap).sort(([a],[b])=>b.localeCompare(a)).map(([month,d])=>({month,collected:d.collected,cogs:d.cogs,expenses:d.expenses,profit:d.collected-d.cogs-d.expenses}));
        if(!rows.length) return null;
        const tots=rows.reduce((s,r)=>({collected:s.collected+r.collected,cogs:s.cogs+r.cogs,expenses:s.expenses+r.expenses,profit:s.profit+r.profit}),{collected:0,cogs:0,expenses:0,profit:0});
        const fmtM=m=>{const[y,mo]=m.split("-");return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(mo)-1]+" "+y;};
        const fmt=n=>Math.round(n).toLocaleString();
        return (
          <div className="card" style={{marginBottom:14}}>
            <div style={{fontSize:11,color:"#AEB9C7",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Month-on-month performance</div>
            <div style={{fontSize:10,color:"#8A97A8",marginBottom:12}}>Profit = Collected − COGS − Expenses. Amounts in KSh.</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:360}}>
                <thead>
                  <tr>{["Month","Collected","COGS","Expenses","Profit"].map(h=><th key={h} style={{textAlign:h==="Month"?"left":"right",padding:"4px 4px 8px",color:"#AEB9C7",fontWeight:600,borderBottom:"1px solid #1A2A4A",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map(r=>(
                    <tr key={r.month} style={{borderBottom:"1px solid #0F1A3A"}}>
                      <td style={{padding:"7px 4px",color:"#E8E2D4",whiteSpace:"nowrap"}}>{fmtM(r.month)}</td>
                      <td style={{textAlign:"right",padding:"7px 4px",color:"#4CAF50",whiteSpace:"nowrap"}}>{fmt(r.collected)}</td>
                      <td style={{textAlign:"right",padding:"7px 4px",color:"#E8A45B",whiteSpace:"nowrap"}}>{fmt(r.cogs)}</td>
                      <td style={{textAlign:"right",padding:"7px 4px",color:"#E85B5B",whiteSpace:"nowrap"}}>{fmt(r.expenses)}</td>
                      <td style={{textAlign:"right",padding:"7px 4px",color:r.profit>=0?"#F5C000":"#E85B5B",fontWeight:600,whiteSpace:"nowrap"}}>{r.profit<0?"-":""}{fmt(Math.abs(r.profit))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{borderTop:"2px solid #1A2A4A"}}>
                    <td style={{padding:"8px 4px",fontWeight:700,color:"#FFFFFF"}}>Total</td>
                    <td style={{textAlign:"right",padding:"8px 4px",color:"#4CAF50",fontWeight:700}}>{fmt(tots.collected)}</td>
                    <td style={{textAlign:"right",padding:"8px 4px",color:"#E8A45B",fontWeight:700}}>{fmt(tots.cogs)}</td>
                    <td style={{textAlign:"right",padding:"8px 4px",color:"#E85B5B",fontWeight:700}}>{fmt(tots.expenses)}</td>
                    <td style={{textAlign:"right",padding:"8px 4px",color:tots.profit>=0?"#F5C000":"#E85B5B",fontWeight:700}}>{tots.profit<0?"-":""}{fmt(Math.abs(tots.profit))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}
      <div className="card" style={{marginBottom:14}}>
        <div style={{fontSize:11,color:"#8899AA",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>Stock value on hand</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><div style={{fontSize:20,fontWeight:600,color:"#F5C000"}}>KSh {stockValue.toLocaleString()}</div><div style={{fontSize:10,color:"#8A97A8"}}>AT COST</div></div>
          <div><div style={{fontSize:20,fontWeight:600,color:"#4CAF50"}}>KSh {stockPotentialProfit.toLocaleString()}</div><div style={{fontSize:10,color:"#8A97A8"}}>EST. PROFIT IF ALL SELLS</div></div>
        </div>
        <div style={{fontSize:11,color:"#8A97A8",marginTop:8,paddingTop:8,borderTop:"1px solid #1A2A4A"}}>Retail value KSh {stockRetail.toLocaleString()}</div>
      </div>

      {/* GROWTH PROJECTION */}
      <div className="card" style={{marginBottom:14}}>
        <div style={{fontSize:12,color:"#AEB9C7",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600,marginBottom:4}}>Growth projection</div>
        <div style={{fontSize:12,color:"#8A97A8",marginBottom:12}}>If the current trend holds ({avgMonthlyNet>=0?"+":""}{fmtK(avgMonthlyNet)}/month average over {monthsOfData} month{monthsOfData!==1?"s":""} of data)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {proj.map(p=>(
            <div key={p.months} style={{textAlign:"center",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:"10px 6px"}}>
              <div style={{fontSize:15,fontWeight:700,color:p.value>=totalCapital?"#4CAF50":"#E85B5B"}}>{fmtK(p.value)}</div>
              <div style={{fontSize:11,color:"#8A97A8",marginTop:2}}>in {p.months} mo</div>
            </div>
          ))}
        </div>
        {monthsOfData<2&&<div style={{fontSize:11,color:"#E8A45B",marginTop:10,lineHeight:1.4}}>Only {monthsOfData} month of data — this projection will get meaningful after 2-3 months of trading.</div>}
        <div style={{fontSize:10,color:"#8A97A8",marginTop:8,lineHeight:1.4}}>A straight-line estimate, not a forecast. It assumes trading continues as it has. Real results depend on sales, sourcing and seasonality.</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div className="card">
          <div style={{fontSize:11,color:"#8899AA",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>Payment split</div>
          {collected>0?<>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:"#4CAF50"}}>M-Pesa</span><span>KSh {mpesa.toLocaleString()}</span></div>
            <div style={{height:4,background:"#1A2A4A",borderRadius:2,marginBottom:8}}><div style={{height:4,background:"#4CAF50",borderRadius:2,width:`${collected>0?Math.round(mpesa/collected*100):0}%`}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:"#F5C000"}}>Cash</span><span>KSh {cash.toLocaleString()}</span></div>
          </>:<div style={{color:"#8A97A8",fontSize:12}}>No sales yet</div>}
        </div>
        <div className="card">
          <div style={{fontSize:11,color:"#8899AA",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>Expenses</div>
          {expBreakdown.length>0?expBreakdown.slice(0,4).map(([cat,amt])=>(
            <div key={cat} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{color:"#E8E2D4"}}>{cat}</span><span style={{color:"#E85B5B"}}>{expenses>0?Math.round(amt/expenses*100):0}%</span></div>
              <div style={{height:3,background:"#1A2A4A",borderRadius:2}}><div style={{height:3,background:"#E85B5B",borderRadius:2,width:`${expenses>0?(amt/expenses*100):0}%`}}/></div>
            </div>
          )):<div style={{color:"#8A97A8",fontSize:12}}>No expenses yet</div>}
        </div>
      </div>
      {topItems.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div style={{fontSize:11,color:"#8899AA",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.05em"}}>Top selling items</div>
          {topItems.map(([name,{qty,revenue:rev}],i)=>(
            <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<topItems.length-1?"1px solid #1A2A4A":"none"}}>
              <div><div style={{fontSize:13,fontWeight:500}}>{name}</div><div style={{fontSize:11,color:"#8A97A8"}}>{qty} sold</div></div>
              <div style={{fontSize:13,fontWeight:600,color:"#4CAF50"}}>KSh {rev.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <button className="btn-g" onClick={()=>exportCSV("sales")} style={{fontSize:12}}>Export sales</button>
        <button className="btn-g" onClick={()=>exportCSV("expenses")} style={{fontSize:12}}>Export expenses</button>
        <button className="btn-g" onClick={()=>exportCSV("stock")} style={{fontSize:12}}>Export stock</button>
        <button className="btn-g" onClick={()=>exportCSV("money")} style={{fontSize:12}}>Export money</button>
        <button className="btn-g" onClick={()=>exportCSV("losses")} style={{fontSize:12}}>Export losses</button>
      </div>
      <button className="btn-g" onClick={loadAll} style={{width:"100%",fontSize:13}}>Refresh</button>

      {drill&&(
        <div onClick={()=>setDrill(null)} style={{position:"fixed",inset:0,background:"rgba(5,10,31,0.8)",zIndex:150,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0A1128",borderTop:`3px solid ${drill.color}`,borderRadius:"16px 16px 0 0",width:"100%",maxWidth:500,maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid #1A2A4A",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:15,fontWeight:600}}>{drill.title}</div><div style={{fontSize:18,fontWeight:700,color:drill.color,marginTop:2}}>{drill.total<0?"-":""}KSh {Math.abs(drill.total).toLocaleString()}</div></div>
              <button onClick={()=>setDrill(null)} style={{background:"none",border:"none",color:"#8899AA",fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"8px 18px 24px"}}>
              {drill.rows.length===0?<div style={{color:"#8A97A8",textAlign:"center",padding:"24px 0",fontSize:13}}>Nothing in this period.</div>:drill.rows.map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 0",borderBottom:i<drill.rows.length-1?"1px solid #101B36":"none"}}>
                  <div style={{flex:1,minWidth:0,paddingRight:10}}><div style={{fontSize:13,fontWeight:500}}>{r.label}</div>{r.sub&&<div style={{fontSize:11,color:"#8A97A8"}}>{r.sub}</div>}</div>
                  <div style={{fontSize:13,fontWeight:600,color:r.amount<0?"#E85B5B":"#E8E2D4",whiteSpace:"nowrap"}}>{r.amount<0?"-":""}KSh {Math.abs(r.amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

