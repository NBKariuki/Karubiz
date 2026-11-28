import { useState, useEffect } from "react";
import { errMsg, fmtK, isDirect, sb, todayStr } from "../lib";

// ---------- small helpers ----------
const fmt = n => Math.round(Number(n)||0).toLocaleString();
const num = v => Number(v)||0;
const pctChange = (cur,prev) => { cur=num(cur); prev=num(prev); if(prev===0) return cur===0?0:null; return (cur-prev)/Math.abs(prev)*100; };
// Returns {text,tone} for a change. tone: good, bad or flat. upGood says whether a rise is good news.
const pctDelta = (cur,prev,upGood=true) => {
  const p=pctChange(cur,prev);
  if(p===null) return {text:"New",tone:"flat"};
  if(Math.abs(p)<0.5) return {text:"No change",tone:"flat"};
  return {text:(p>0?"+":"")+p.toFixed(0)+"%",tone:(p>0)===upGood?"good":"bad"};
};
const ptsDelta = (cur,prev,upGood=true) => {
  const d=cur-prev; if(Math.abs(d)<0.05) return {text:"No change",tone:"flat"};
  return {text:(d>0?"+":"")+d.toFixed(1)+" pts",tone:(d>0)===upGood?"good":"bad"};
};
const TONE = {good:"#4CAF50",bad:"#E85B5B",flat:"#8A97A8"};
const trendOf = vals => { if(!vals||vals.length<2) return null; const last=vals[vals.length-1]; const prior=vals.slice(0,-1); const m=prior.reduce((a,b)=>a+b,0)/prior.length; const d=(last-m)/(Math.abs(m)||1); return d>0.1?"Rising":d<-0.1?"Falling":"Steady"; };

// Dates are plain YYYY-MM-DD strings, matching how the app stamps records.
const pd = s => { const [y,m,d]=s.split("-").map(Number); return new Date(Date.UTC(y,m-1,d)); };
const ds = dt => dt.toISOString().slice(0,10);
const addDays = (s,n) => { const d=pd(s); d.setUTCDate(d.getUTCDate()+n); return ds(d); };
const clampDay = (y,m,d) => { const last=new Date(Date.UTC(y,m,0)).getUTCDate(); return ds(new Date(Date.UTC(y,m-1,Math.min(d,last)))); };
function rangesFor(period,today){
  const [y,m,d]=today.split("-").map(Number);
  if(period==="week") return {from:addDays(today,-6),to:today,pFrom:addDays(today,-13),pTo:addDays(today,-7),label:"the last 7 days, against the 7 days before"};
  if(period==="month"){ const pm=m===1?12:m-1, py=m===1?y-1:y; return {from:clampDay(y,m,1),to:today,pFrom:clampDay(py,pm,1),pTo:clampDay(py,pm,d),label:`days 1 to ${d} of this month, against the same days last month`}; }
  if(period==="year") return {from:`${y}-01-01`,to:today,pFrom:`${y-1}-01-01`,pTo:clampDay(y-1,m,d),label:"this year so far, against the same days last year"};
  return {from:"2000-01-01",to:today,pFrom:null,pTo:null,label:"all time"};
}
const ewma = (vals,a=0.4) => { if(!vals.length) return 0; let e=vals[0]; for(let i=1;i<vals.length;i++) e=a*vals[i]+(1-a)*e; return e; };
const sdev = vals => { if(vals.length<2) return 0; const m=vals.reduce((x,y)=>x+y,0)/vals.length; return Math.sqrt(vals.reduce((t,v)=>t+(v-m)**2,0)/(vals.length-1)); };
const sumOf = a => a.reduce((x,y)=>x+y,0);
const weekStart = str => addDays(str,-((pd(str).getUTCDay()+6)%7)); // weeks start on Monday
const STATUS_COLOR = {Slow:"#E85B5B",Slowing:"#E8A45B",Rising:"#4CAF50",Normal:"#8A97A8"};
// Status from the last few weeks against the weeks before them (equal-sized windows) and from how long since the last sale
// against the usual gap between sales. Uses whatever history exists.
function statusFor(ov,series){
  const k=Math.min(4,Math.floor(series.length/2));
  const ch=k>=1&&sumOf(series.slice(-2*k,-k))>0?(sumOf(series.slice(-k))-sumOf(series.slice(-2*k,-k)))/sumOf(series.slice(-2*k,-k)):null;
  const gr=ov&&num(ov.usual_gap)>0&&ov.days_since!=null?num(ov.days_since)/num(ov.usual_gap):null;
  if((ch!==null&&ch<=-0.4)||(gr!==null&&gr>=3)) return "Slow";
  if((ch!==null&&ch<=-0.2)||(gr!==null&&gr>=2)) return "Slowing";
  if(ch!==null&&ch>=0.2) return "Rising";
  if(ch===null&&gr===null) return null;
  return "Normal";
}
function planNote(status,cover,stockUnits,selling){
  if(selling&&stockUnits<=0) return "Out of stock. Sales may be lost until the next order.";
  if((status==="Slow"||status==="Slowing")&&cover!==null&&cover>8) return "Selling slower and plenty in stock. Hold the next order, and promote it or bundle it with a strong type.";
  if(status==="Slow"||status==="Slowing") return "Selling slower than usual. Promote it and follow up open quotes before ordering more.";
  if(status==="Rising"&&cover!==null&&cover<4) return "Selling faster than usual and stock is getting low. Check the next order.";
  if(cover!==null&&cover<3) return "Stock is low against the sales pace. Plan the next order.";
  return "Steady. No action needed.";
}
const PERIODS = [["week","7 days"],["month","Month"],["year","Year"],["all","All"]];
const SECTIONS = [["business","Business"],["sales","Sales"],["stock","Stock"],["expenses","Expenses"]];

// ---------- small pieces ----------
function Spark({vals,color}){
  if(!vals||vals.length<2) return null;
  const w=64,h=22,mn=Math.min(...vals),mx=Math.max(...vals),rg=mx-mn||1;
  const pts=vals.map((v,i)=>`${(i/(vals.length-1)*w).toFixed(1)},${(h-2-((v-mn)/rg)*(h-4)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} style={{display:"block"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/></svg>;
}
function Kpi({label,value,sub,delta,spark,onClick,color="#F5C000"}){
  const tr=trendOf(spark);
  return (
    <div className="card" onClick={onClick} style={{marginBottom:0,cursor:onClick?"pointer":"default",minWidth:0}}>
      <div style={{fontSize:12,color:"#8899AA",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>{label}</div>
      <div style={{fontSize:19,fontWeight:700,color,wordBreak:"break-word"}}>{value}</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,minHeight:22}}>
        <div style={{fontSize:13,fontWeight:600,color:delta?TONE[delta.tone]:"#8A97A8"}}>{delta?delta.text:""}</div>
        <Spark vals={spark} color={color}/>
      </div>
      {tr&&<div style={{fontSize:12,color:"#8A97A8",marginTop:2}}>{tr} over {spark.length} months</div>}
      {sub&&<div style={{fontSize:12,color:"#8A97A8",marginTop:4,lineHeight:1.35}}>{sub}</div>}
    </div>
  );
}
function More({title,children}){
  const [open,setOpen]=useState(false);
  return (
    <div className="card" style={{marginBottom:10}}>
      <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",color:"#AEB9C7",fontSize:13,textTransform:"uppercase",letterSpacing:"0.05em",cursor:"pointer",padding:0,fontFamily:"inherit"}}>
        <span>{title}</span><span style={{color:"#F5C000",textTransform:"none",letterSpacing:0}}>{open?"Hide":"Show"}</span>
      </button>
      {open&&<div style={{marginTop:12}}>{children}</div>}
    </div>
  );
}
const Row = ({label,sub,value,color,bold}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"7px 0",borderBottom:"1px solid #101B36"}}>
    <div style={{paddingRight:10}}><div style={{fontSize:14,fontWeight:bold?700:500,color:"#E8E2D4"}}>{label}</div>{sub&&<div style={{fontSize:12,color:"#8A97A8"}}>{sub}</div>}</div>
    <div style={{fontSize:14,fontWeight:bold?700:600,color:color||"#E8E2D4",whiteSpace:"nowrap"}}>{value}</div>
  </div>
);

export function ReportsTab({user,bal}){
  const [data,setData]=useState({sales:[],expenses:[],stock:[],losses:[]});
  const [loading,setLoading]=useState(true);
  const [section,setSection]=useState("business");
  const [period,setPeriod]=useState("month");
  const [drill,setDrill]=useState(null);
  const [an,setAn]=useState(null);      // {cur,prev,snap,snapPrev,monthly,R}
  const [anErr,setAnErr]=useState("");
  const [tick,setTick]=useState(0);
  const [ty,setTy]=useState(null);       // {cur,prev,overview,weekly}
  const [tyErr,setTyErr]=useState("");
  const [sheet,setSheet]=useState(null);  // product type opened from the Sales section
  const [showAllTypes,setShowAllTypes]=useState(false);

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
    setTick(t=>t+1);
  };

  // Headline numbers come from the database (KARU_ANALYTICS_V1.sql), so every screen uses the same profit definition.
  useEffect(()=>{
    let live=true;
    (async()=>{
      try{
        const R=rangesFor(period,todayStr());
        const [cur,prev,snap,snapPrev,monthly]=await Promise.all([
          sb.rpc("karu_biz_period",{p_from:R.from,p_to:R.to}),
          R.pFrom?sb.rpc("karu_biz_period",{p_from:R.pFrom,p_to:R.pTo}):Promise.resolve(null),
          sb.rpc("karu_biz_snapshot",{p_asof:R.to}),
          R.pTo?sb.rpc("karu_biz_snapshot",{p_asof:R.pTo}):Promise.resolve(null),
          sb.get("karu_v_biz_monthly","select=*&order=month.asc"),
        ]);
        if(live){ setAn({cur,prev,snap,snapPrev,monthly:monthly||[],R}); setAnErr(""); }
      }catch(e){
        if(live){ const m=errMsg(e); setAnErr(/could not find|does not exist|karu_biz|karu_v_/i.test(m)?"Analytics are not installed yet. Run KARU_ANALYTICS_V1.sql in the Supabase SQL editor, then refresh.":m); }
      }
    })();
    return ()=>{live=false;};
  },[period,tick]);

  // Per product type numbers (KARU_PRODUCT_TYPES_V1.sql). Kept separate so the Business section works without it.
  useEffect(()=>{
    let live=true;
    (async()=>{
      try{
        const t=todayStr(), R=rangesFor(period,t);
        const [cur,prev,overview,weekly]=await Promise.all([
          sb.rpc("karu_type_period",{p_from:R.from,p_to:R.to}),
          R.pFrom?sb.rpc("karu_type_period",{p_from:R.pFrom,p_to:R.pTo}):Promise.resolve(null),
          sb.rpc("karu_type_overview",{p_today:t}),
          sb.get("karu_v_type_weekly",`select=*&week=gte.${addDays(weekStart(t),-7*13)}&order=week.asc`),
        ]);
        if(live){ setTy({cur:cur||[],prev:prev||[],overview:overview||[],weekly:weekly||[]}); setTyErr(""); }
      }catch(e){
        if(live){ setTy(null); const m=errMsg(e); setTyErr(/could not find|does not exist|karu_type|karu_v_/i.test(m)?"missing":m); }
      }
    })();
    return ()=>{live=false;};
  },[period,tick]);

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

  if(loading) return <div style={{textAlign:"center",padding:"2rem",color:"#8A97A8"}}>Loading reports...</div>;

  // ---------- derived values ----------
  const R=an?an.R:rangesFor(period,todayStr());
  const inR=(x,a,b)=>a&&x.date>=a&&x.date<=b;
  const cur=an?an.cur:null, prev=an?an.prev:null, snap=an?an.snap:null, snapPrev=an?an.snapPrev:null;
  const nowM=todayStr().slice(0,7);
  const done=(an?an.monthly:[]).filter(r=>String(r.month).slice(0,7)<nowM).slice(-6); // complete months only, so a half month never looks like a dip
  const ser=f=>done.map(f);
  const margin=o=>o&&num(o.invoiced)>0?num(o.gross_profit)/num(o.invoiced)*100:0;
  const aov=o=>o&&num(o.orders)>0?num(o.invoiced)/num(o.orders):0;
  const liquidOf=s=>s?num(s.cash)+num(s.bank)+num(s.petty):0;
  const liquid=liquidOf(snap), liquidPrev=liquidOf(snapPrev);
  const stockCost=snap?num(snap.stock_cost):0, stockRetail=snap?num(snap.stock_retail):0;
  const SAFETY_FLOOR=(()=>{ try{ const v=localStorage.getItem("karu_safety_floor"); return v?Number(v):15000; }catch{ return 15000; } })();

  const fSales=data.sales.filter(s=>inR(s,R.from,R.to));
  const fExp=data.expenses.filter(e=>inR(e,R.from,R.to));
  const pExp=data.expenses.filter(e=>inR(e,R.pFrom,R.pTo));
  const fLosses=(data.losses||[]).filter(l=>inR(l,R.from,R.to));
  const owedSales=data.sales.filter(s=>num(s.balance_due)>0);

  // Largest expense category (goods transport is a cost of goods, so it is left out here)
  const catTotals=list=>{ const m={}; list.filter(e=>!isDirect(e.category)).forEach(e=>{m[e.category]=(m[e.category]||0)+num(e.amount);}); return m; };
  const curCats=catTotals(fExp), prevCats=catTotals(pExp);
  const topCat=Object.entries(curCats).sort(([,a],[,b])=>b-a)[0];

  const itemMap={};
  fSales.forEach(s=>{ (s.items||[]).forEach(i=>{ if(!itemMap[i.name]) itemMap[i.name]={qty:0,revenue:0}; itemMap[i.name].qty+=num(i.qty||1); itemMap[i.name].revenue+=num(i.qty||1)*num(i.price); }); });
  const topItems=Object.entries(itemMap).sort(([,a],[,b])=>b.revenue-a.revenue).slice(0,5);

  // ---------- per product type ----------
  const curWk=weekStart(todayStr());
  const wkRows=ty?ty.weekly:[];
  const firstWk=wkRows.reduce((m,r)=>{const w=String(r.week).slice(0,10);return !m||w<m?w:m;},null);
  const weeks=[]; for(let w=addDays(curWk,-7);weeks.length<12&&firstWk&&w>=firstWk;w=addDays(w,-7)) weeks.unshift(w); // complete weeks only
  const wmap=new Map(wkRows.map(r=>[String(r.week).slice(0,10)+"|"+r.product_type,r]));
  const typeSeries=(name,f)=>weeks.map(w=>{const r=wmap.get(w+"|"+name);return r?num(r[f]):0;});
  const allTypeSeries=f=>weeks.map(w=>sumOf(wkRows.filter(r=>String(r.week).slice(0,10)===w).map(r=>num(r[f]))));
  const curBy=Object.fromEntries((ty?ty.cur:[]).map(t=>[t.type,t]));
  const prevBy=Object.fromEntries((ty?ty.prev:[]).map(t=>[t.type,t]));
  const ovBy=Object.fromEntries((ty?ty.overview:[]).map(t=>[t.type,t]));
  const typeNames=ty?[...new Set([...Object.keys(curBy),...wkRows.map(r=>r.product_type)])]:[];
  const typeRows=typeNames.map(name=>{
    const series=typeSeries(name,"units"), ov=ovBy[name]||null, c=curBy[name]||null;
    const status=statusFor(ov,series);
    const recent=series.slice(-4), rate=recent.length?sumOf(recent)/recent.length:0; // units per week
    const stockUnits=ov?num(ov.stock_units):0;
    const cover=rate>0?stockUnits/rate:null;
    return {name,series,ov,c,p:prevBy[name]||null,status,cover,stockUnits,rate,selling:rate>0||!!c};
  }).sort((a,b)=>num(b.c&&b.c.revenue)-num(a.c&&a.c.revenue)||a.name.localeCompare(b.name));
  const slowTypes=typeRows.filter(r=>r.status==="Slow"||r.status==="Slowing");

  // ---------- drill-downs ----------
  const drillNet=()=>({title:"Net profit breakdown",color:num(cur.net_profit)>=0?"#4CAF50":"#E85B5B",total:num(cur.net_profit),rows:[
    {label:"Sales (invoiced)",sub:"what was billed",amount:num(cur.invoiced)},
    {label:"Less: cost of goods sold",sub:"cost of the items sold",amount:-(num(cur.cogs)-num(cur.direct))},
    ...(num(cur.direct)>0?[{label:"Less: goods transport",sub:"hauling goods you bought",amount:-num(cur.direct)}]:[]),
    {label:"Less: expenses",sub:`${fExp.filter(e=>!isDirect(e.category)).length} entries`,amount:-num(cur.expenses)},
    ...(num(cur.losses)>0?[{label:"Less: losses",sub:`${fLosses.length} incidents`,amount:-num(cur.losses)}]:[])]});
  const drillOwed=()=>({title:"Owed to us",color:"#E8A45B",total:num(snap.receivables),rows:owedSales.map(s=>({label:s.customer_name,sub:`${s.receipt_no} · paid ${fmtK(num(s.amount_paid))} of ${fmtK(num(s.total))}`,amount:num(s.balance_due)}))});
  const drillSales=()=>({title:"Sales (invoiced)",color:"#8899AA",total:num(cur.invoiced),rows:fSales.map(s=>({label:s.customer_name,sub:`${s.receipt_no} · ${s.date.slice(5)}`,amount:num(s.total)}))});
  const drillExpenses=()=>({title:"Expenses",color:"#E85B5B",total:num(cur.expenses),rows:fExp.filter(e=>!isDirect(e.category)).map(e=>({label:e.description||e.category,sub:`${e.category} · ${e.date.slice(5)} · ${e.recorded_by?.split(" ")[0]||""}`,amount:num(e.amount)}))});

  // ---------- one plain sentence per section ----------
  const soWhat=()=>{
    if(!cur) return "";
    if(section==="business"){
      if(liquid<SAFETY_FLOOR) return `Liquid money is below your safety floor of ${fmtK(SAFETY_FLOOR)}. Hold non-essential spending and collect balances.`;
      if(num(cur.net_profit)<0) return "Profit is negative for this period. Check margin on what sold and whether expenses are running ahead of sales.";
      if(prev&&num(prev.net_profit)>0&&num(cur.net_profit)<num(prev.net_profit)*0.8) return `Profit is down ${Math.abs(pctChange(cur.net_profit,prev.net_profit)).toFixed(0)}% on the comparison period. Look at margin and expenses.`;
      if(num(snap.receivables)>liquid&&num(snap.receivables)>0) return `Customers owe you ${fmtK(num(snap.receivables))}, more than the liquid money you hold. Collecting balances is the quickest cash.`;
      return prev?"Profit and cash are holding up against the comparison period.":"Profit and cash are in order for this period.";
    }
    if(section==="sales"){
      if(slowTypes.length) return `${slowTypes.map(r=>r.name).slice(0,3).join(", ")} ${slowTypes.length===1?"is":"are"} selling slower than usual. See By product type below.`;
      if(prev&&num(prev.invoiced)>0&&num(cur.invoiced)<num(prev.invoiced)*0.8) return `Sales are down ${Math.abs(pctChange(cur.invoiced,prev.invoiced)).toFixed(0)}% on the comparison period. Follow up open quotes and push what is in stock.`;
      if(prev&&margin(cur)<margin(prev)-3) return "Margin has slipped by more than 3 points. Check discounts and the cost of what is selling.";
      return "Sales and margin are steady against the comparison period.";
    }
    if(section==="stock"){
      if(num(cur.losses)>0) return `Losses of ${fmtK(num(cur.losses))} were written off in this period. Check what caused them.`;
      return `Stock at cost is ${fmtK(stockCost)}, which is ${liquid+stockCost>0?Math.round(stockCost/(liquid+stockCost)*100):0}% of your money tied up in stock and cash.`;
    }
    if(prev&&num(prev.expenses)>0&&num(cur.expenses)>num(prev.expenses)*1.2) return `Expenses are up ${Math.abs(pctChange(cur.expenses,prev.expenses)).toFixed(0)}% on the comparison period. See which category moved.`;
    return "Expenses are in line with the comparison period.";
  };

  // ---------- sections ----------
  const businessView=()=>{
    const avgNet=(done.length?done:an.monthly).reduce((s,r)=>s+num(r.net_profit),0)/Math.max(1,(done.length?done:an.monthly).length);
    const capital=liquid+stockCost;
    const proj=[3,6,12].map(m=>({m,v:Math.round(capital+avgNet*m)}));
    const rows=[...an.monthly].reverse().slice(0,12);
    const fmtM=m=>{const [y,mo]=String(m).slice(0,7).split("-"); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(mo)-1]+" "+y;};
    return <>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <Kpi label="Net profit" value={`${num(cur.net_profit)<0?"-":""}${fmtK(Math.abs(num(cur.net_profit)))}`} color={num(cur.net_profit)>=0?"#F5C000":"#E85B5B"} delta={prev?pctDelta(cur.net_profit,prev.net_profit):null} spark={ser(r=>num(r.net_profit))} onClick={()=>setDrill(drillNet())}/>
        <Kpi label="Cash on hand" value={fmtK(liquid)} color="#4CAF50" delta={snapPrev?pctDelta(liquid,liquidPrev):null} sub={`Cash ${fmtK(num(snap.cash))} · Bank ${fmtK(num(snap.bank))}`}/>
        <Kpi label="Owed by customers" value={fmtK(num(snap.receivables))} color="#E8A45B" sub={`${num(snap.open_balances)} open balance${num(snap.open_balances)===1?"":"s"}`} onClick={()=>setDrill(drillOwed())}/>
        <Kpi label="Stock at cost" value={fmtK(stockCost)} color="#8899AA" sub={`Retail ${fmtK(stockRetail)}`}/>
      </div>
      <More title="Profit breakdown">
        <Row label="Sales (invoiced)" value={fmtK(num(cur.invoiced))}/>
        <Row label="Cost of goods sold" sub="includes goods transport" value={"-"+fmtK(num(cur.cogs))} color="#E8A45B"/>
        <Row label="Gross profit" value={fmtK(num(cur.gross_profit))} bold/>
        <Row label="Expenses" value={"-"+fmtK(num(cur.expenses))} color="#E85B5B"/>
        {num(cur.losses)>0&&<Row label="Losses" value={"-"+fmtK(num(cur.losses))} color="#E85B5B"/>}
        <Row label="Net profit" value={`${num(cur.net_profit)<0?"-":""}${fmtK(Math.abs(num(cur.net_profit)))}`} bold color={num(cur.net_profit)>=0?"#F5C000":"#E85B5B"}/>
        <Row label="Collected in cash" sub="money actually received for these sales" value={fmtK(num(cur.collected))} color="#4CAF50"/>
        <Row label="Still owed from these sales" sub="the gap between invoiced and collected" value={fmtK(num(cur.owed))} color="#E8A45B"/>
      </More>
      <More title="Month by month">
        <div style={{fontSize:12,color:"#8A97A8",marginBottom:8}}>Profit = sales invoiced less cost of goods (with goods transport), expenses and losses. Amounts in KSh.</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:14,minWidth:360}}>
            <thead><tr>{["Month","Sales","COGS","Expenses","Profit"].map(h=><th key={h} style={{textAlign:h==="Month"?"left":"right",padding:"4px 4px 8px",color:"#AEB9C7",fontWeight:600,borderBottom:"1px solid #1A2A4A",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>{rows.map(r=>(
              <tr key={r.month} style={{borderBottom:"1px solid #0F1A3A"}}>
                <td style={{padding:"7px 4px",color:"#E8E2D4",whiteSpace:"nowrap"}}>{fmtM(r.month)}</td>
                <td style={{textAlign:"right",padding:"7px 4px",color:"#4CAF50"}}>{fmt(r.invoiced)}</td>
                <td style={{textAlign:"right",padding:"7px 4px",color:"#E8A45B"}}>{fmt(r.cogs)}</td>
                <td style={{textAlign:"right",padding:"7px 4px",color:"#E85B5B"}}>{fmt(num(r.expenses)+num(r.losses))}</td>
                <td style={{textAlign:"right",padding:"7px 4px",color:num(r.net_profit)>=0?"#F5C000":"#E85B5B",fontWeight:600}}>{num(r.net_profit)<0?"-":""}{fmt(Math.abs(num(r.net_profit)))}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </More>
      <More title="Growth projection">
        <div style={{fontSize:14,color:"#8A97A8",marginBottom:10}}>If the current trend holds ({avgNet>=0?"+":""}{fmtK(avgNet)} a month on average, from {(done.length?done:an.monthly).length} month{(done.length?done:an.monthly).length===1?"":"s"} of trading)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {proj.map(p=>(
            <div key={p.m} style={{textAlign:"center",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:"10px 6px"}}>
              <div style={{fontSize:15,fontWeight:700,color:p.v>=capital?"#4CAF50":"#E85B5B"}}>{fmtK(p.v)}</div>
              <div style={{fontSize:13,color:"#8A97A8",marginTop:2}}>in {p.m} mo</div>
            </div>))}
        </div>
        <div style={{fontSize:12,color:"#8A97A8",marginTop:8,lineHeight:1.4}}>Starts from cash plus stock at cost. A straight-line estimate, not a forecast. Real results depend on sales, sourcing and seasonality.</div>
      </More>
      {snap.owed&&Object.keys(snap.owed).length>0&&(
        <More title="Partner balances">
          {Object.entries(snap.owed).map(([k,v])=><Row key={k} label={k.slice(5).replace(/^./,c=>c.toUpperCase())} sub={num(v)>=0?"the business owes":"owes the business"} value={fmtK(Math.abs(num(v)))}/>)}
        </More>)}
    </>;
  };

  const salesView=()=>(<>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
      <Kpi label="Sales" value={fmtK(num(cur.invoiced))} color="#4CAF50" delta={prev?pctDelta(cur.invoiced,prev.invoiced):null} spark={ser(r=>num(r.invoiced))} onClick={()=>setDrill(drillSales())}/>
      <Kpi label="Orders" value={fmt(cur.orders)} color="#F5C000" delta={prev?pctDelta(cur.orders,prev.orders):null} spark={ser(r=>num(r.orders))}/>
      <Kpi label="Average order" value={fmtK(aov(cur))} color="#8899AA" delta={prev?pctDelta(aov(cur),aov(prev)):null} spark={ser(aov)}/>
      <Kpi label="Gross margin" value={margin(cur).toFixed(1)+"%"} color="#F5C000" delta={prev?ptsDelta(margin(cur),margin(prev)):null} spark={ser(margin)}/>
    </div>
    {tyErr==="missing"&&<div className="card" style={{color:"#E8A45B",fontSize:14,lineHeight:1.45}}>Product type reports are not installed yet. Run KARU_PRODUCT_TYPES_V1.sql in the Supabase SQL editor, then refresh.</div>}
    {tyErr&&tyErr!=="missing"&&<div className="card" style={{color:"#E8A45B",fontSize:14}}>{tyErr}</div>}
    {ty&&typeRows.length>0&&(
      <div className="card" style={{marginBottom:10}}>
        <div style={{fontSize:13,color:"#AEB9C7",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:2}}>By product type</div>
        <div style={{fontSize:12,color:"#8A97A8",marginBottom:6}}>Trend line shows weekly units. Tap a type for its items and outlook.</div>
        {(showAllTypes?typeRows:typeRows.slice(0,6)).map((r,i,arr)=>{
          const col=STATUS_COLOR[r.status]||"#8A97A8";
          const d=r.c&&R.pFrom?pctDelta(num(r.c.units),num(r.p&&r.p.units)):null;
          const pace=[r.ov&&r.ov.last_sale?`Last sale ${r.ov.days_since} day${r.ov.days_since===1?"":"s"} ago${num(r.ov.usual_gap)>0?`, usually every ${num(r.ov.usual_gap)===1?"day":num(r.ov.usual_gap)+" days"}`:""}`:null,
            r.selling&&r.stockUnits<=0?"Out of stock":(r.cover!==null?(r.cover<1?"under 1 week of stock":`${Math.round(r.cover)} week${Math.round(r.cover)===1?"":"s"} of stock`):null)].filter(Boolean).join(" · ");
          return (
            <div key={r.name} onClick={()=>setSheet(r.name)} style={{padding:"10px 0",borderBottom:i<arr.length-1?"1px solid #101B36":"none",cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:15,fontWeight:600,color:"#E8E2D4"}}>{r.name}{r.status&&<span style={{marginLeft:8,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:100,border:`1px solid ${col}`,color:col}}>{r.status}</span>}</div>
                  <div style={{fontSize:12,color:"#8A97A8",marginTop:2}}>{r.c?`${fmt(r.c.units)} unit${num(r.c.units)===1?"":"s"} · KSh ${fmt(r.c.revenue)}`:"No sales in this period"}{d&&<span style={{color:TONE[d.tone],fontWeight:600}}> · {d.text}</span>}</div>
                </div>
                <Spark vals={r.series.slice(-8)} color={col}/>
              </div>
              {pace&&<div style={{fontSize:12,color:"#8A97A8",marginTop:3}}>{pace}</div>}
              {r.name==="Untyped"&&<div style={{fontSize:12,color:"#E8A45B",marginTop:3}}>Set a type in Product List to group these.</div>}
            </div>);
        })}
        {typeRows.length>6&&<button className="btn-g" onClick={()=>setShowAllTypes(v=>!v)} style={{width:"100%",fontSize:13,marginTop:8}}>{showAllTypes?"Show fewer":`Show all ${typeRows.length}`}</button>}
      </div>)}
    {ty&&weeks.length>0&&(()=>{
      const ur=allTypeSeries("units"), rv=allTypeSeries("revenue");
      const eU=ewma(ur), eR=ewma(rv), sU=sdev(ur)*2, sR=sdev(rv)*2;
      const lowStock=typeRows.filter(r=>r.cover!==null&&r.cover<3&&r.status!=="Slow");
      return (
        <More title="Next 4 weeks outlook">
          <Row label="Expected units" sub={weeks.length>1?`range ${fmt(Math.max(0,4*eU-sU))} to ${fmt(4*eU+sU)}`:""} value={fmt(4*eU)}/>
          <Row label="Expected sales" sub={weeks.length>1?`range KSh ${fmt(Math.max(0,4*eR-sR))} to ${fmt(4*eR+sR)}`:""} value={"KSh "+fmt(4*eR)} color="#4CAF50"/>
          {slowTypes.length>0&&<Row label="Likely slow" sub="selling slower than usual" value={slowTypes.map(r=>r.name).slice(0,4).join(", ")} color="#E8A45B"/>}
          {lowStock.length>0&&<Row label="Check stock" sub="under 3 weeks of cover" value={lowStock.map(r=>r.name).slice(0,4).join(", ")}/>}
          <div style={{fontSize:12,color:"#8A97A8",marginTop:8,lineHeight:1.4}}>Based on {weeks.length} complete week{weeks.length===1?"":"s"} of sales, weighted towards the recent ones. The range is the normal ups and downs, so one big sale does not move it much. This improves as more weeks are recorded.</div>
        </More>);
    })()}
    {topItems.length>0&&(
      <More title="Top selling items">
        {topItems.map(([name,{qty,revenue}])=><Row key={name} label={name} sub={`${qty} sold`} value={"KSh "+fmt(revenue)} color="#4CAF50"/>)}
      </More>)}
  </>);

  const stockView=()=>(<>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
      <Kpi label="Stock at cost" value={fmtK(stockCost)} color="#F5C000"/>
      <Kpi label="Stock at retail" value={fmtK(stockRetail)} color="#8899AA"/>
      <Kpi label="Profit if all sells" value={fmtK(stockRetail-stockCost)} color="#4CAF50"/>
      <Kpi label="Losses" value={fmtK(num(cur.losses))} color="#E85B5B" delta={prev?pctDelta(cur.losses,prev.losses,false):null} spark={ser(r=>num(r.losses))}/>
    </div>
  </>);

  const expensesView=()=>(<>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
      <Kpi label="Expenses" value={fmtK(num(cur.expenses))} color="#E85B5B" delta={prev?pctDelta(cur.expenses,prev.expenses,false):null} spark={ser(r=>num(r.expenses))} onClick={()=>setDrill(drillExpenses())}/>
      <Kpi label="Share of sales" value={(num(cur.invoiced)>0?num(cur.expenses)/num(cur.invoiced)*100:0).toFixed(1)+"%"} color="#F5C000" delta={prev?ptsDelta(num(cur.invoiced)>0?num(cur.expenses)/num(cur.invoiced)*100:0,num(prev.invoiced)>0?num(prev.expenses)/num(prev.invoiced)*100:0,false):null} spark={ser(r=>num(r.invoiced)>0?num(r.expenses)/num(r.invoiced)*100:0)}/>
      <Kpi label="Goods transport" value={fmtK(num(cur.direct))} color="#E8A45B" delta={prev?pctDelta(cur.direct,prev.direct,false):null} sub="counted with cost of goods"/>
      <Kpi label="Largest category" value={topCat?fmtK(topCat[1]):"None yet"} color="#8899AA" delta={topCat&&R.pFrom?pctDelta(topCat[1],prevCats[topCat[0]]||0,false):null} sub={topCat?topCat[0]:""}/>
    </div>
  </>);

  return (
    <div>
      <div className="chips" style={{marginBottom:10}}>
        {SECTIONS.map(([id,label])=><button key={id} className={`chip${section===id?" on":""}`} onClick={()=>setSection(id)}>{label}</button>)}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {PERIODS.map(([id,label])=><button key={id} onClick={()=>setPeriod(id)} style={{flex:1,padding:"6px 4px",fontSize:13,borderRadius:8,border:"1px solid #1A2A4A",background:period===id?"#1A2A4A":"transparent",color:period===id?"#F5C000":"#8A97A8",fontWeight:period===id?700:500,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>)}
      </div>
      {anErr&&<div className="card" style={{color:"#E8A45B",fontSize:14,lineHeight:1.45}}>{anErr}</div>}
      {!an&&!anErr&&<div style={{textAlign:"center",padding:"1.5rem",color:"#8A97A8"}}>Loading...</div>}
      {an&&cur&&snap&&<>
        <div style={{fontSize:12,color:"#8A97A8",marginBottom:10}}>Showing {R.label}.</div>
        <div className="card" style={{borderLeft:"3px solid #F5C000",fontSize:14,lineHeight:1.5,color:"#E8E2D4"}}>{soWhat()}</div>
        {section==="business"&&businessView()}
        {section==="sales"&&salesView()}
        {section==="stock"&&stockView()}
        {section==="expenses"&&expensesView()}
      </>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"14px 0 8px"}}>
        <button className="btn-g" onClick={()=>exportCSV("sales")} style={{fontSize:14}}>Export sales</button>
        <button className="btn-g" onClick={()=>exportCSV("expenses")} style={{fontSize:14}}>Export expenses</button>
        <button className="btn-g" onClick={()=>exportCSV("stock")} style={{fontSize:14}}>Export stock</button>
        <button className="btn-g" onClick={()=>exportCSV("money")} style={{fontSize:14}}>Export money</button>
        <button className="btn-g" onClick={()=>exportCSV("losses")} style={{fontSize:14}}>Export losses</button>
      </div>
      <button className="btn-g" onClick={loadAll} style={{width:"100%",fontSize:14}}>Refresh</button>

      {sheet&&(()=>{
        const r=typeRows.find(x=>x.name===sheet); if(!r) return null;
        const c=r.c, items=c&&c.items?c.items:[];
        const eU=ewma(r.series), sU=sdev(r.series)*2;
        const col=STATUS_COLOR[r.status]||"#8A97A8";
        return (
          <div onClick={()=>setSheet(null)} style={{position:"fixed",inset:0,background:"rgba(5,10,31,0.8)",zIndex:150,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:"#0A1128",borderTop:`3px solid ${col}`,borderRadius:"16px 16px 0 0",width:"100%",maxWidth:500,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
              <div style={{padding:"16px 18px",borderBottom:"1px solid #1A2A4A",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontSize:17,fontWeight:700}}>{r.name}{r.status&&<span style={{marginLeft:8,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:100,border:`1px solid ${col}`,color:col}}>{r.status}</span>}</div><div style={{fontSize:12,color:"#8A97A8",marginTop:2}}>{R.label}</div></div>
                <button onClick={()=>setSheet(null)} style={{background:"none",border:"none",color:"#8899AA",fontSize:22,cursor:"pointer"}}>×</button>
              </div>
              <div style={{overflowY:"auto",padding:"10px 18px 24px"}}>
                <div style={{fontSize:14,lineHeight:1.5,color:"#E8E2D4",marginBottom:10}}>{planNote(r.status,r.cover,r.stockUnits,r.selling)}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:12,color:"#8A97A8"}}>Weekly units, last {Math.min(12,r.series.length)} weeks</div><Spark vals={r.series} color={col}/></div>
                {c?<>
                  <Row label="Units sold" value={fmt(c.units)}/>
                  <Row label="Sales" value={"KSh "+fmt(c.revenue)} color="#4CAF50"/>
                  <Row label="Margin" sub="before goods transport and expenses" value={(num(c.revenue)>0?num(c.margin)/num(c.revenue)*100:0).toFixed(1)+"%"}/>
                  <Row label="Discount given" sub="quoted price against price sold" value={(num(c.revenue)+num(c.discount)>0?num(c.discount)/(num(c.revenue)+num(c.discount))*100:0).toFixed(1)+"%"}/>
                </>:<div style={{fontSize:14,color:"#8A97A8",padding:"6px 0"}}>No sales of this type in this period.</div>}
                {r.series.length>0&&<Row label="Expected next 4 weeks" sub={r.series.length>1?`range ${fmt(Math.max(0,4*eU-sU))} to ${fmt(4*eU+sU)} units`:""} value={fmt(4*eU)+" units"}/>}
                <Row label="Stock on hand" value={`${fmt(r.stockUnits)} unit${r.stockUnits===1?"":"s"}`} sub={r.ov?`worth ${fmtK(num(r.ov.stock_cost))} at cost`:""}/>
                {items.length>0&&<>
                  <div style={{fontSize:13,color:"#AEB9C7",textTransform:"uppercase",letterSpacing:"0.05em",margin:"16px 0 6px"}}>Items in this type</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:340}}>
                      <thead><tr>{["Item","Units","Share","Margin","Disc."].map(h=><th key={h} style={{textAlign:h==="Item"?"left":"right",padding:"4px 4px 6px",color:"#AEB9C7",fontWeight:600,borderBottom:"1px solid #1A2A4A"}}>{h}</th>)}</tr></thead>
                      <tbody>{items.map(it=>(
                        <tr key={it.item} style={{borderBottom:"1px solid #0F1A3A"}}>
                          <td style={{padding:"7px 4px",color:"#E8E2D4"}}>{it.item}</td>
                          <td style={{textAlign:"right",padding:"7px 4px"}}>{fmt(it.units)}</td>
                          <td style={{textAlign:"right",padding:"7px 4px"}}>{num(c.revenue)>0?Math.round(num(it.revenue)/num(c.revenue)*100):0}%</td>
                          <td style={{textAlign:"right",padding:"7px 4px",color:"#F5C000"}}>{num(it.revenue)>0?(num(it.margin)/num(it.revenue)*100).toFixed(0):0}%</td>
                          <td style={{textAlign:"right",padding:"7px 4px"}}>{num(it.revenue)+num(it.discount)>0?(num(it.discount)/(num(it.revenue)+num(it.discount))*100).toFixed(0):0}%</td>
                        </tr>))}</tbody>
                    </table>
                  </div>
                  <div style={{fontSize:12,color:"#8A97A8",marginTop:6}}>Share is of this type's sales. Disc. is the average discount off the quoted price.</div>
                </>}
              </div>
            </div>
          </div>);
      })()}
      {drill&&(
        <div onClick={()=>setDrill(null)} style={{position:"fixed",inset:0,background:"rgba(5,10,31,0.8)",zIndex:150,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0A1128",borderTop:`3px solid ${drill.color}`,borderRadius:"16px 16px 0 0",width:"100%",maxWidth:500,maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid #1A2A4A",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:15,fontWeight:600}}>{drill.title}</div><div style={{fontSize:18,fontWeight:700,color:drill.color,marginTop:2}}>{drill.total<0?"-":""}KSh {Math.abs(drill.total).toLocaleString()}</div></div>
              <button onClick={()=>setDrill(null)} style={{background:"none",border:"none",color:"#8899AA",fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"8px 18px 24px"}}>
              {drill.rows.length===0?<div style={{color:"#8A97A8",textAlign:"center",padding:"24px 0",fontSize:14}}>Nothing in this period.</div>:drill.rows.map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 0",borderBottom:i<drill.rows.length-1?"1px solid #101B36":"none"}}>
                  <div style={{flex:1,minWidth:0,paddingRight:10}}><div style={{fontSize:14,fontWeight:500}}>{r.label}</div>{r.sub&&<div style={{fontSize:13,color:"#8A97A8"}}>{r.sub}</div>}</div>
                  <div style={{fontSize:14,fontWeight:600,color:r.amount<0?"#E85B5B":"#E8E2D4",whiteSpace:"nowrap"}}>{r.amount<0?"-":""}KSh {Math.abs(r.amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
