import { useState, useEffect } from "react";
import { CAT_OPTS, STAFF, can, catLabel, defStaff, errMsg, fmtK, logAudit, recordMoney, sb, todayStr, withinWindow } from "../lib";
import { ProductSearch } from "../screens/ProductSearch";
import { OrdersTab } from "../tabs/OrdersTab";

export function StockTab({user,onMoney}){
  const [section,setSection]=useState("stock"); // stock | orders | count
  const [priceDraft,setPriceDraft]=useState({}); const [priceSaving,setPriceSaving]=useState(false);
  const [stockView,setStockView]=useState("items"); const [stockQ,setStockQ]=useState(""); const [itemOpen,setItemOpen]=useState({}); const [noPriceOnly,setNoPriceOnly]=useState(false);
  const [takeCounts,setTakeCounts]=useState({}); const [takeReasons,setTakeReasons]=useState({}); const [takeNotes,setTakeNotes]=useState(""); const [takeSaving,setTakeSaving]=useState(false); const [takeStaff,setTakeStaff]=useState(defStaff(user));
  const [trips,setTrips]=useState([]); const [stock,setStock]=useState([]); const [audit,setAudit]=useState([]);
  const [loading,setLoading]=useState(true); const [view,setView]=useState("list");
  const [expanded,setExpanded]=useState({}); const [editItem,setEditItem]=useState(null);
  const [tripGrp,setTripGrp]=useState({});
  const [editVals,setEditVals]=useState({}); const [editReason,setEditReason]=useState("");
  const [editStaff,setEditStaff]=useState(defStaff(user)); const [lockStaff,setLockStaff]=useState(defStaff(user));
  const [saving,setSaving]=useState(false); const [err,setErr]=useState("");
  const [addingToTrip,setAddingToTrip]=useState(null);
  const [adjItem,setAdjItem]=useState(null); const [adjQty,setAdjQty]=useState(1); const [adjReason,setAdjReason]=useState("Damaged"); const [adjNotes,setAdjNotes]=useState(""); const [adjStaff,setAdjStaff]=useState(defStaff(user));
  const [addExtraItems,setAddExtraItems]=useState([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
  const [trip,setTrip]=useState({date:new Date().toISOString().split("T")[0],notes:"",created_by:defStaff(user),paid_from:"sacco"});
  const [tripItems,setTripItems]=useState([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
  const [pendingReceived,setPendingReceived]=useState([]); // orders with received items not yet imported

  useEffect(()=>{loadAll();},[]);
  const loadAll=async()=>{
    setLoading(true);
    try{
      const [t,s,a,ord]=await Promise.all([
        sb.get("karu_trips","select=*&order=created_at.desc"),
        sb.get("karu_stock","select=*&order=created_at.desc"),
        sb.get("karu_audit","select=*&order=changed_at.desc&limit=300"),
        sb.get("karu_orders","select=*&order=created_at.desc").catch(()=>[])
      ]);
      setTrips(t); setStock(s); setAudit(a);
      // Orders that have at least one received supplier and haven't been imported to a trip yet
      const awaiting=(ord||[]).filter(o=>!o.received_trip_no && (o.suppliers||[]).some(su=>su.status==="received"));
      setPendingReceived(awaiting);
    }catch(e){console.error(e);}
    setLoading(false);
  };

  const toggleExpand=id=>setExpanded(x=>({...x,[id]:!x[id]}));
  const stockForTrip=tripNo=>stock.filter(s=>s.trip_no===tripNo);
  const auditForTrip=tripNo=>audit.filter(a=>a.trip_no===tripNo);

  const lockTrip=async t=>{
    if(!confirm(`Lock ${t.trip_no}? No edits after this.`)) return;
    setSaving(true);
    try{
      await sb.patch("karu_trips",t.id,{status:"locked",locked_by:lockStaff,locked_at:new Date().toISOString()});
      await logAudit({trip_no:t.trip_no,record_id:t.id,action:"lock",reason:"Trip confirmed and locked",changed_by:lockStaff});
      await loadAll();
    }catch(e){alert("Lock failed: "+e.message);}
    setSaving(false);
  };

  const startEdit=(item,t)=>{
    if(t.status==="locked"){alert("This trip is locked.");return;}
    setEditItem(item);
    setEditVals({name:item.name,category:item.category,qty_in:item.qty_in,unit_cost:item.unit_cost,selling_price:item.selling_price});
    setEditReason(""); setErr("");
  };

  const saveEdit=async()=>{
    if(!editReason.trim()){setErr("Reason required.");return;}
    if(!(Number(editVals.selling_price)>0)){setErr("A selling price is required.");return;}
    setSaving(true); setErr("");
    try{
      const changes=Object.keys(editVals).filter(f=>String(editVals[f])!==String(editItem[f]));
      for(const f of changes){
        await logAudit({trip_no:editItem.trip_no,record_id:editItem.id,action:"edit",field_changed:f,old_value:String(editItem[f]),new_value:String(editVals[f]),reason:editReason,changed_by:editStaff});
      }
      await sb.patch("karu_stock",editItem.id,editVals);
      setEditItem(null);
      await loadAll();
    }catch(e){setErr("Save failed: "+e.message);}
    setSaving(false);
  };

  const doAdjust=async()=>{
    const q=Number(adjQty); const avail=adjItem.qty_in-adjItem.qty_sold-(adjItem.qty_adjusted||0);
    if(!q||q<1){alert("Enter quantity.");return;} if(q>avail){alert(`Only ${avail} available.`);return;}
    setSaving(true);
    try{
      await sb.post("karu_adjustments",{stock_id:adjItem.id,item_name:adjItem.name,trip_no:adjItem.trip_no,qty:q,reason:adjReason,notes:adjNotes,recorded_by:adjStaff,date:todayStr()});
      await sb.patch("karu_stock",adjItem.id,{qty_adjusted:(adjItem.qty_adjusted||0)+q});
      const lossKinds={Theft:"theft",Damaged:"damage"};
      if(lossKinds[adjReason]){
        const costVal=q*Number(adjItem.unit_cost||0); const retailVal=q*Number(adjItem.selling_price||0);
        await sb.post("karu_losses",{date:todayStr(),kind:lossKinds[adjReason],item_name:adjItem.name,stock_id:adjItem.id,qty:q,cost_value:costVal,retail_value:retailVal,description:adjNotes,recorded_by:adjStaff});
      }
      await logAudit({trip_no:adjItem.trip_no,record_id:adjItem.id,action:"adjust",field_changed:adjItem.name,old_value:String(avail),new_value:String(avail-q),reason:`${adjReason}${adjNotes?" · "+adjNotes:""}`,changed_by:adjStaff});
      setAdjItem(null); setAdjQty(1); setAdjNotes("");
      await loadAll();
    }catch(e){alert("Failed: "+e.message);}
    setSaving(false);
  };

  const saveAddItems=async(t)=>{
    const vi=addExtraItems.filter(i=>i.name&&Number(i.unit_cost)>0);
    if(!vi.length){alert("Add at least one item with name and cost.");return;}
    const noP=vi.find(i=>!(Number(i.selling_price)>0));
    if(noP){alert(`Set a selling price for ${noP.name}.`);return;}
    setSaving(true);
    try{
      await sb.post("karu_stock",vi.map(i=>({trip_id:t.id,trip_no:t.trip_no,name:i.name,category:i.category,qty_in:Number(i.qty_in),qty_sold:0,unit_cost:Number(i.unit_cost),selling_price:Number(i.selling_price||0),date_in:t.date})));
      const addedCost=vi.reduce((s,i)=>s+(Number(i.qty_in)*Number(i.unit_cost)),0);
      await sb.patch("karu_trips",t.id,{total_cost:Number(t.total_cost)+addedCost});
      const pf=t.paid_from||"sacco"; const ashort=lockStaff.split(" ")[0];
      if(pf==="personal") await recordMoney({account:"owed_"+ashort.toLowerCase(),amount:addedCost,type:"trip_personal",partner:lockStaff,description:`${t.trip_no} extra items (paid by ${ashort})`,date:t.date,recorded_by:lockStaff});
      else await recordMoney({account:pf,amount:-addedCost,type:"trip",ref:t.trip_no,description:`${t.trip_no} extra items`,date:t.date,recorded_by:lockStaff});
      if(onMoney) onMoney();
      await logAudit({trip_no:t.trip_no,record_id:t.id,action:"add_items",reason:`Added ${vi.length} item(s) to trip`,changed_by:lockStaff});
      setAddingToTrip(null);
      setAddExtraItems([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
      await loadAll();
    }catch(e){alert("Failed: "+e.message);}
    setSaving(false);
  };

  const [importingOrder,setImportingOrder]=useState(null);
  const receiveOrderIntoTrip=(o)=>{
    // Collect items only from RECEIVED suppliers; drop supplier names, keep items
    const items=[];
    (o.suppliers||[]).filter(su=>su.status==="received").forEach(su=>{
      (su.items||[]).forEach(it=>items.push({id:Date.now()+Math.random(),name:it.name,category:it.category||"living",qty_in:Number(it.qty)||1,unit_cost:it.est_cost?String(it.est_cost):"",selling_price:""}));
    });
    if(!items.length){alert("No received items to import.");return;}
    setTripItems(items);
    setTrip(t=>({...t,notes:`From order ${o.order_no}`}));
    setImportingOrder(o);
    setView("new");
  };

  // Live stock rows with computed available qty for counting
  const liveStock=stock.filter(s=>(s.qty_in-s.qty_sold-(s.qty_adjusted||0))>0 || Number(s.qty_in)>0).map(s=>({...s,available:s.qty_in-s.qty_sold-(s.qty_adjusted||0)})).filter(s=>s.available>0);
  // Set the selling price on one or more batches (any signed-in owner or manager, even on a locked trip) and log it.
  // Once a price is set on a locked trip it is final. Unpriced batches can still be priced, and open trips stay editable.
  const priceLocked=b=>{ const tr=trips.find(x=>x.trip_no===b.trip_no); const locked=tr?tr.status==="locked":true; return locked&&Number(b.selling_price)>0; };
  const setPrices=async(batches,raw,key)=>{
    const p=Number(raw);
    if(!(p>0)){alert("Enter a selling price above zero.");return;}
    const todo=batches.filter(b=>!priceLocked(b));
    if(!todo.length){alert("These prices are locked because the trip is locked.");return;}
    setPriceSaving(true);
    try{
      for(const b of todo){
        if(Number(b.selling_price)===p) continue;
        await sb.patch("karu_stock",b.id,{selling_price:p});
        await logAudit({trip_no:b.trip_no,record_id:b.id,action:"set_price",field_changed:"selling_price",old_value:String(b.selling_price||0),new_value:String(p),reason:"Selling price set",changed_by:user.full_name});
      }
      // Keep the product's default (quoted) price in step, but never overwrite one that is already set.
      try{
        const names=[...new Set(todo.map(b=>String(b.name||"").trim().toLowerCase()))];
        const prods=await sb.get("karu_products","select=id,name,default_price");
        for(const pr of prods){ if(names.includes(String(pr.name||"").trim().toLowerCase())&&!(Number(pr.default_price)>0)) await sb.patch("karu_products",pr.id,{default_price:p}); }
      }catch(e){ console.error("product price:",e); }
      setPriceDraft(x=>{ const n={...x}; delete n[key]; return n; });
      await loadAll();
    }catch(e){alert("Could not save the price: "+errMsg(e));}
    setPriceSaving(false);
  };
  const priceEditor=(batches,key,current,focus,label)=>(can(user,"adjust")&&<div style={{display:"flex",gap:10,alignItems:"flex-end",padding:"6px 0 10px"}}>
    <div className="field" style={{flex:1,marginBottom:0}}><label>{label}</label><input type="number" inputMode="decimal" autoFocus={focus} value={priceDraft[key]!==undefined?priceDraft[key]:(current>0?current:"")} onChange={e=>setPriceDraft(x=>({...x,[key]:e.target.value}))} placeholder="e.g. 1500"/></div>
    <button className="btn-y" disabled={priceSaving} onClick={()=>setPrices(batches,priceDraft[key]!==undefined?priceDraft[key]:current,key)} style={{padding:"10px 18px"}}>{priceSaving?"...":"Save"}</button>
  </div>);
  const renderItems=()=>{
    if(loading) return <div style={{textAlign:"center",padding:"2rem",color:"#8A97A8"}}>Loading...</div>;
    const groups={};
    liveStock.forEach(s=>{ const key=String(s.name||"").trim().toLowerCase(); (groups[key]=groups[key]||{key,name:s.name,cat:s.category,batches:[]}).batches.push(s); });
    let rows=Object.values(groups).map(g=>{
      const left=g.batches.reduce((n,b)=>n+b.available,0);
      const val=g.batches.reduce((n,b)=>n+b.available*Number(b.unit_cost||0),0);
      const priced=g.batches.filter(b=>Number(b.selling_price)>0).sort((a,b)=>String(b.date_in||"").localeCompare(String(a.date_in||"")));
      return {...g,left,val,cost:left?val/left:0,price:priced.length?Number(priced[0].selling_price):0,noPrice:g.batches.some(b=>!(Number(b.selling_price)>0)),allNoPrice:priced.length===0};
    }).sort((a,b)=>a.name.localeCompare(b.name));
    const nNo=rows.filter(r=>r.noPrice).length;
    const q=stockQ.trim().toLowerCase();
    if(q) rows=rows.filter(r=>r.name.toLowerCase().includes(q)||catLabel(r.cat).toLowerCase().includes(q));
    if(noPriceOnly) rows=rows.filter(r=>r.noPrice);
    const cols="minmax(0,1fr) 42px 66px 78px";
    return (<div>
      <div className="field" style={{marginBottom:10}}><input value={stockQ} onChange={e=>setStockQ(e.target.value)} placeholder="Search items or category"/></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,fontSize:14,color:"#8A97A8"}}>
        <span>{rows.length} item{rows.length!==1?"s":""}</span>
        {nNo>0&&<button onClick={()=>setNoPriceOnly(v=>!v)} style={{background:noPriceOnly?"rgba(232,164,91,0.16)":"transparent",border:"1px solid #E8A45B",borderRadius:100,color:"#E8A45B",fontSize:13,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{noPriceOnly?"Showing":"Show"} {nNo} without a price</button>}
      </div>
      {rows.length===0?<div style={{textAlign:"center",padding:"2rem",color:"#8A97A8"}}>{liveStock.length===0?"No stock yet. Add a trip to bring items in.":"No items match."}</div>:(
      <div className="tbl">
        <div className="tbl-h" style={{gridTemplateColumns:cols}}><span>Item</span><span className="num">Left</span><span className="num">Cost</span><span className="num">Price</span></div>
        {rows.map(r=>{
          const open=!!itemOpen[r.key];
          return (<div key={r.key} className={`tbl-row${open?" open":""}`}>
            <div className="tbl-r" onClick={()=>setItemOpen(x=>({...x,[r.key]:!x[r.key]}))} style={{gridTemplateColumns:cols}}>
              <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}><span className="chev"/><div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:600,lineHeight:1.25,wordBreak:"break-word"}}>{r.name}</div><div className="tbl-sub">{catLabel(r.cat)}{r.batches.length>1?` · ${r.batches.length} batches`:""}</div></div></div>
              <div className="num" style={{fontWeight:600,fontSize:15}}>{r.left}</div>
              <div className="num" style={{fontSize:14,color:"#C2CBD6"}}>{Math.round(r.cost).toLocaleString()}</div>
              <div className="num" style={{fontSize:14,fontWeight:600,color:r.allNoPrice?"#E8A45B":"#FFFFFF"}}>{r.allNoPrice?"No price":Number(r.price).toLocaleString()}{!r.allNoPrice&&r.noPrice&&<span style={{color:"#E8A45B"}}> *</span>}</div>
            </div>
            {open&&<div className="tbl-x">
              <div style={{fontSize:13,color:"#8A97A8",padding:"6px 0"}}>Stock value {fmtK(r.val)}{r.noPrice&&!r.allNoPrice?" · * some batches have no price":""}</div>
              {(()=>{ const ok=r.batches.filter(b=>!priceLocked(b)); return ok.length?priceEditor(ok,r.key,r.price,r.allNoPrice,ok.length<r.batches.length?"Selling price for open batches (KSh)":"Selling price for all batches (KSh)"):null; })()}
              {r.batches.slice().sort((a,b)=>(a.trip_no||"").localeCompare(b.trip_no||"")).map(b=>{
                const tr=trips.find(x=>x.trip_no===b.trip_no); const locked=tr?tr.status==="locked":true;
                return (<div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"8px 0",borderTop:"1px solid #101B36"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:14,color:"#C2CBD6"}}>{b.trip_no}<span style={{color:"#8A97A8"}}> · in {b.date_in?.slice(5)||""}</span></div>
                    <div style={{fontSize:13,color:"#8A97A8",marginTop:2}}>{b.available} left of {b.qty_in} · Cost {Number(b.unit_cost).toLocaleString()} · {Number(b.selling_price)>0?`Sell ${Number(b.selling_price).toLocaleString()}`:<span style={{color:"#E8A45B"}}>No price set</span>}</div>
                  </div>
                  <div style={{display:"flex",gap:2,flexShrink:0}}>
                    {can(user,"adjust")&&<button onClick={()=>{setAdjItem(b);setAdjQty(1);}} style={{background:"none",border:"none",color:"#C2CBD6",fontSize:14,padding:"8px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Adjust</button>}
                    {tr&&!locked&&can(user,"edit")&&withinWindow(b.created_at)&&<button onClick={()=>startEdit(b,tr)} style={{background:"none",border:"none",color:"#E85B5B",fontSize:14,padding:"8px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Edit</button>}
                  </div>
                </div>);
              })}
            </div>}
          </div>);
        })}
      </div>)}
    </div>);
  };
  const saveStockTake=async()=>{
    // Build lines; a discrepancy needs a reason
    const lines=[]; let sysVal=0, cntVal=0, varCount=0;
    for(const s of liveStock){
      const sys=s.available; const cntRaw=takeCounts[s.id]; const cnt=cntRaw===undefined||cntRaw===""?sys:Number(cntRaw);
      sysVal+=sys*s.unit_cost; cntVal+=cnt*s.unit_cost;
      if(cnt!==sys){ varCount++; if(!(takeReasons[s.id]||"").trim()){ alert(`Enter a reason for ${s.name} (system ${sys}, counted ${cnt}).`); return; } }
      lines.push({stock_id:s.id,name:s.name,system_qty:sys,counted_qty:cnt,unit_cost:s.unit_cost,reason:cnt!==sys?takeReasons[s.id]:""});
    }
    setTakeSaving(true);
    try{
      // Apply each discrepancy as a qty_adjusted change so available matches the count
      for(const ln of lines){
        if(ln.counted_qty!==ln.system_qty){
          const diff=ln.system_qty-ln.counted_qty; // positive = shrinkage (remove), negative = found more
          const s=stock.find(x=>x.id===ln.stock_id);
          const newAdj=(s.qty_adjusted||0)+diff;
          await sb.patch("karu_stock",ln.stock_id,{qty_adjusted:newAdj});
          await sb.post("karu_adjustments",{stock_id:ln.stock_id,item_name:ln.name,trip_no:s.trip_no,qty:Math.abs(diff),reason:`Stock take: ${ln.reason}`,notes:`Count ${ln.counted_qty} vs system ${ln.system_qty}`,recorded_by:takeStaff,date:todayStr()});
          // If it's a loss reason and shrinkage, record the loss value too
          if(diff>0 && /theft|damage|lost|broke/i.test(ln.reason)){
            await sb.post("karu_losses",{date:todayStr(),kind:"stocktake",item_name:ln.name,stock_id:ln.stock_id,qty:diff,cost_value:diff*ln.unit_cost,retail_value:diff*(s.selling_price||0),description:`Stock take: ${ln.reason}`,recorded_by:takeStaff});
          }
        }
      }
      await sb.post("karu_stocktakes",{date:todayStr(),system_value:Math.round(sysVal),counted_value:Math.round(cntVal),variance:Math.round(cntVal-sysVal),items_counted:lines.length,items_with_variance:varCount,lines,notes:takeNotes,done_by:takeStaff});
      await logAudit({trip_no:null,record_id:null,action:"stock_take",field_changed:"inventory",old_value:`system ${Math.round(sysVal)}`,new_value:`counted ${Math.round(cntVal)}`,reason:`${varCount} discrepancies · ${takeNotes||"routine count"}`,changed_by:takeStaff});
      setTakeCounts({}); setTakeReasons({}); setTakeNotes(""); setSection("stock");
      await loadAll();
      alert(`Stock take saved. ${varCount} discrepanc${varCount===1?"y":"ies"} reconciled. Stock now matches your count.`);
    }catch(e){alert("Failed: "+e.message);}
    setTakeSaving(false);
  };

  const addTI=()=>setTripItems(x=>[...x,{id:Date.now(),name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
  const rmTI=id=>setTripItems(x=>x.filter(i=>i.id!==id));
  const upTI=(id,f,v)=>setTripItems(x=>x.map(i=>i.id===id?{...i,[f]:v}:i));

  const saveTrip=async()=>{
    const vi=tripItems.filter(i=>i.name&&Number(i.unit_cost)>0);
    if(!vi.length){setErr("Add at least one item.");return;}
    const noP=vi.find(i=>!(Number(i.selling_price)>0));
    if(noP){setErr(`Set a selling price for ${noP.name}.`);return;}
    setSaving(true); setErr("");
    try{
      const tripNo=`KARU-TRIP-${String(trips.length+1).padStart(3,"0")}`;
      const totalCost=vi.reduce((s,i)=>s+(Number(i.qty_in)*Number(i.unit_cost)),0);
      // If this trip is importing a received order, any deposits already paid on that order
      // ALREADY left the account — so only deduct the remaining balance to avoid double-counting.
      let alreadyPaid=0;
      if(importingOrder){ alreadyPaid=(importingOrder.suppliers||[]).filter(s=>s.status!=="cancelled").reduce((t,s)=>t+Number(s.deposit_paid||0),0); }
      const cashToDeduct=Math.max(0,totalCost-alreadyPaid);
      const [newTrip]=await sb.post("karu_trips",{trip_no:tripNo,date:trip.date,notes:trip.notes,total_cost:totalCost,created_by:trip.created_by,status:"open",paid_from:trip.paid_from});
      const tshort=trip.created_by.split(" ")[0];
      if(trip.paid_from==="personal"){
        if(cashToDeduct>0) await recordMoney({account:"owed_"+tshort.toLowerCase(),amount:cashToDeduct,type:"trip_personal",partner:trip.created_by,description:`${tripNo} (paid by ${tshort})${alreadyPaid>0?` · ${fmtK(alreadyPaid)} deposit already paid`:""}`,date:trip.date,recorded_by:trip.created_by});
      } else {
        if(cashToDeduct>0) await recordMoney({account:trip.paid_from,amount:-cashToDeduct,type:"trip",ref:tripNo,description:`Sourcing ${tripNo}${alreadyPaid>0?` · balance after ${fmtK(alreadyPaid)} deposit`:""}`,date:trip.date,recorded_by:trip.created_by});
      }
      if(alreadyPaid>0) await logAudit({trip_no:tripNo,record_id:newTrip.id,action:"deposit_netted",field_changed:tripNo,old_value:String(totalCost),new_value:String(cashToDeduct),reason:`${fmtK(alreadyPaid)} deposit already paid on ${importingOrder?.order_no}, only balance deducted`,changed_by:trip.created_by});
      if(onMoney) onMoney();
      await sb.post("karu_stock",vi.map(i=>({trip_id:newTrip.id,trip_no:tripNo,name:i.name,category:i.category,qty_in:Number(i.qty_in),qty_sold:0,unit_cost:Number(i.unit_cost),selling_price:Number(i.selling_price||0),date_in:trip.date})));
      await logAudit({trip_no:tripNo,record_id:newTrip.id,action:"create",reason:"New sourcing trip",changed_by:trip.created_by});
      if(importingOrder){ await sb.patch("karu_orders",importingOrder.id,{received_trip_no:tripNo,status:"received",updated_at:new Date().toISOString()}); setImportingOrder(null); }
      await loadAll();
      setView("list");
      setTripItems([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
      setTrip({date:new Date().toISOString().split("T")[0],notes:"",created_by:defStaff(user),paid_from:"sacco"});
    }catch(e){setErr("Save failed: "+e.message);}
    setSaving(false);
  };

  const totalSV=stock.reduce((s,i)=>s+((i.qty_in-i.qty_sold-(i.qty_adjusted||0))*i.unit_cost),0);
  const totalU=stock.reduce((s,i)=>s+(i.qty_in-i.qty_sold-(i.qty_adjusted||0)),0);

  if(adjItem) return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button className="btn-g" onClick={()=>{setAdjItem(null);setAdjNotes("");}}>Cancel</button>
        <div style={{fontSize:17,fontWeight:600}}>Stock Adjustment</div>
      </div>
      <div style={{background:"#0A1128",border:"1px solid rgba(232,164,91,0.3)",borderRadius:8,padding:12,marginBottom:14,fontSize:14,color:"#8899AA"}}>
        <strong style={{color:"#E8E2D4"}}>{adjItem.name}</strong> · {adjItem.trip_no} · {adjItem.qty_in-adjItem.qty_sold-(adjItem.qty_adjusted||0)} available
      </div>
      <div className="field"><label>Reason</label><div className="tog">{["Damaged","Display","Personal use","Theft","Other"].map(r=><button key={r} className={`tog-btn${adjReason===r?" on":""}`} onClick={()=>setAdjReason(r)} style={{fontSize:14}}>{r}</button>)}</div></div>
      <div className="field"><label>Quantity</label><input type="number" value={adjQty} min={1} onChange={e=>setAdjQty(e.target.value)}/></div>
      {["Theft","Damaged"].includes(adjReason)&&<div style={{background:"rgba(232,91,91,0.08)",border:"1px solid rgba(232,91,91,0.3)",borderRadius:8,padding:10,marginBottom:12,fontSize:14,color:"#E85B5B"}}>Recorded as a loss · Cost: {fmtK(Number(adjQty||1)*Number(adjItem.unit_cost||0))} · Retail: {fmtK(Number(adjQty||1)*Number(adjItem.selling_price||0))}</div>}
      <div className="field"><label>Notes (optional)</label><input value={adjNotes} onChange={e=>setAdjNotes(e.target.value)} placeholder="e.g. Customer walked out, CCTV checked"/></div>
      <div className="field"><label>Recorded by</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${adjStaff===s?" on":""}`} onClick={()=>setAdjStaff(s)}>{s.split(" ")[0]}</button>)}</div></div>
      <button className="btn-y" onClick={doAdjust} disabled={saving} style={{width:"100%",padding:14}}>{saving?"Saving...":["Theft","Damaged"].includes(adjReason)?"Record Loss":"Remove from Stock"}</button>
    </div>
  );

  if(editItem) return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button className="btn-g" onClick={()=>{setEditItem(null);setErr("");}}>Cancel</button>
        <div style={{fontSize:17,fontWeight:600}}>Edit Item</div>
      </div>
      <div style={{background:"#0A1128",border:"1px solid rgba(245,192,0,0.25)",borderRadius:8,padding:12,marginBottom:14,fontSize:14,color:"#8899AA"}}>
        Editing <strong style={{color:"#E8E2D4"}}>{editItem.name}</strong> from {editItem.trip_no}. All changes are timestamped and logged.
      </div>
      <div className="field"><label>Name</label><input value={editVals.name} onChange={e=>setEditVals(x=>({...x,name:e.target.value}))}/></div>
      <div className="field"><label>Category</label><select value={editVals.category} onChange={e=>setEditVals(x=>({...x,category:e.target.value}))}>{CAT_OPTS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <div className="field"><label>Qty in</label><input type="number" value={editVals.qty_in} onChange={e=>setEditVals(x=>({...x,qty_in:Number(e.target.value)}))}/></div>
        <div className="field"><label>Cost (KSh)</label><input type="number" value={editVals.unit_cost} onChange={e=>setEditVals(x=>({...x,unit_cost:Number(e.target.value)}))}/></div>
        <div className="field"><label>Sell at (KSh)</label><input type="number" value={editVals.selling_price} onChange={e=>setEditVals(x=>({...x,selling_price:Number(e.target.value)}))}/></div>
      </div>
      <div className="field"><label>Who is editing</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${editStaff===s?" on":""}`} onClick={()=>setEditStaff(s)}>{s.split(" ")[0]}</button>)}</div></div>
      <div className="field"><label>Reason for edit (required)</label><textarea value={editReason} onChange={e=>setEditReason(e.target.value)} placeholder="Explain what is being corrected and why..."/></div>
      {err&&<div style={{color:"#E85B5B",fontSize:15,marginBottom:12}}>{err}</div>}
      <button className="btn-y" onClick={saveEdit} disabled={saving} style={{width:"100%",padding:14}}>{saving?"Saving...":"Save Changes"}</button>
    </div>
  );

  if(view==="new") return (
    <div className="subscreen">
      <div className="subscreen-hd">
        <button className="btn-g" onClick={()=>{setView("list");setImportingOrder(null);}}>Back</button>
        <div className="title">New Sourcing Trip</div>
        <div className="badge b-y" style={{marginLeft:"auto"}}>KARU-TRIP-{String(trips.length+1).padStart(3,"0")}</div>
      </div>
      {importingOrder&&<div style={{background:"rgba(245,192,0,0.08)",border:"1px solid rgba(245,192,0,0.3)",borderRadius:8,padding:10,marginBottom:14,fontSize:14,color:"#8899AA"}}>Imported from <strong style={{color:"#E8E2D4"}}>{importingOrder.order_no}</strong>. Confirm each item's actual cost and set selling prices before saving. Remember any deposit already paid.</div>}
      <div className="field"><label>Date</label><input type="date" value={trip.date} onChange={e=>setTrip(x=>({...x,date:e.target.value}))}/></div>
      {can(user,"users")?(
        <div className="field"><label>Recorded by</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${trip.created_by===s?" on":""}`} onClick={()=>setTrip(x=>({...x,created_by:s}))}>{s.split(" ")[0]}</button>)}</div></div>
      ):(
        <div className="field"><label>Recorded by</label><div style={{fontSize:16,color:"#E8E2D4",padding:"9px 0"}}>{trip.created_by}</div></div>
      )}
      <div className="field"><label>Notes</label><input value={trip.notes} onChange={e=>setTrip(x=>({...x,notes:e.target.value}))} placeholder="e.g. Gachie sourcing run"/></div>
      <div className="field"><label>Paid from</label><div className="tog"><button className={`tog-btn${trip.paid_from==="cash"?" on":""}`} onClick={()=>setTrip(x=>({...x,paid_from:"cash"}))}>Cash</button><button className={`tog-btn${trip.paid_from==="sacco"?" on":""}`} onClick={()=>setTrip(x=>({...x,paid_from:"sacco"}))}>Bank</button><button className={`tog-btn${trip.paid_from==="personal"?" on":""}`} onClick={()=>setTrip(x=>({...x,paid_from:"personal"}))}>Personal</button></div>
      {trip.paid_from==="personal"&&<div style={{fontSize:13,color:"#E8A45B",marginTop:5}}>Business will owe {trip.created_by.split(" ")[0]} this amount</div>}</div>
      <div className="field">
        <label>Items purchased</label>
        {tripItems.map(i=>(
          <div key={i.id} style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:10,marginBottom:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 28px",gap:6,marginBottom:7}}>
              <ProductSearch user={user} value={i.name} onChange={v=>upTI(i.id,"name",v)} onPick={p=>setTripItems(x=>x.map(it=>it.id===i.id?{...it,name:p.name,category:p.category,unit_cost:p.default_cost>0?String(p.default_cost):it.unit_cost,selling_price:p.default_price>0?String(p.default_price):it.selling_price}:it))} placeholder="Search product..."/>
              <button onClick={()=>rmTI(i.id)} style={{background:"none",border:"none",color:"#E85B5B",cursor:"pointer",fontSize:18}}>x</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
              <select value={i.category} onChange={e=>upTI(i.id,"category",e.target.value)} style={{background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15}}>{CAT_OPTS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <input type="number" value={i.qty_in} min={1} onChange={e=>upTI(i.id,"qty_in",e.target.value)} placeholder="Qty" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15,textAlign:"center"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <input required type="number" value={i.unit_cost} onChange={e=>upTI(i.id,"unit_cost",e.target.value)} placeholder="Cost each (KSh)" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#FFFFFF",fontSize:15}}/>
              <input required type="number" value={i.selling_price} onChange={e=>upTI(i.id,"selling_price",e.target.value)} placeholder="Sell at (KSh) - required" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#FFFFFF",fontSize:15}}/>
            </div>
            {i.unit_cost&&i.selling_price&&<div style={{fontSize:13,color:"#8899AA",marginTop:5}}>Margin: {Math.round((1-i.unit_cost/i.selling_price)*100)}% | Cost: KSh {(Number(i.qty_in||1)*Number(i.unit_cost)).toLocaleString()}</div>}
          </div>
        ))}
        <button className="btn-g" onClick={addTI} style={{width:"100%",marginTop:4}}>+ Add item</button>
        {tripItems.some(i=>i.unit_cost&&i.qty_in)&&<div style={{textAlign:"right",marginTop:8,fontSize:16,fontWeight:600,color:"#F5C000"}}>Total: KSh {tripItems.reduce((s,i)=>s+(Number(i.qty_in||0)*Number(i.unit_cost||0)),0).toLocaleString()}</div>}
      </div>
      {err&&<div style={{color:"#E85B5B",fontSize:15,marginBottom:12}}>{err}</div>}
      <button className="btn-y" onClick={saveTrip} disabled={saving} style={{width:"100%",padding:14}}>{saving?"Saving...":"Save Sourcing Trip"}</button>
    </div>
  );

  return (
    <div>
      {can(user,"orders")&&(
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          <button onClick={()=>setSection("stock")} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${section==="stock"?"#F5C000":"#1A2A4A"}`,background:section==="stock"?"rgba(245,192,0,0.1)":"transparent",color:section==="stock"?"#F5C000":"#8899AA",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Stock</button>
          <button onClick={()=>setSection("orders")} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${section==="orders"?"#F5C000":"#1A2A4A"}`,background:section==="orders"?"rgba(245,192,0,0.1)":"transparent",color:section==="orders"?"#F5C000":"#8899AA",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Orders</button>
          {can(user,"users")&&<button onClick={()=>setSection("count")} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${section==="count"?"#F5C000":"#1A2A4A"}`,background:section==="count"?"rgba(245,192,0,0.1)":"transparent",color:section==="count"?"#F5C000":"#8899AA",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Count</button>}
        </div>
      )}
      {section==="count"?(()=>{
        let sysVal=0,cntVal=0,varCount=0;
        liveStock.forEach(s=>{ const c=takeCounts[s.id]===undefined||takeCounts[s.id]===""?s.available:Number(takeCounts[s.id]); sysVal+=s.available*s.unit_cost; cntVal+=c*s.unit_cost; if(c!==s.available)varCount++; });
        return (
        <div className="subscreen">
          <div className="subscreen-hd"><div className="title">Stock Take</div></div>
          <div style={{fontSize:14,color:"#AEB9C7",marginBottom:14,lineHeight:1.5}}>Count what's physically on the shelf. Leave a row blank if it matches. Where your count differs, give a reason — the app adjusts stock to match reality and logs it.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
            <div className="stat"><div className="stat-n" style={{fontSize:18,color:"#8899AA"}}>{fmtK(sysVal)}</div><div className="stat-l">System</div></div>
            <div className="stat"><div className="stat-n" style={{fontSize:18,color:"#F5C000"}}>{fmtK(cntVal)}</div><div className="stat-l">Counted</div></div>
            <div className="stat" style={cntVal!==sysVal?{border:"1px solid rgba(232,91,91,0.4)"}:{}}><div className="stat-n" style={{fontSize:18,color:cntVal===sysVal?"#4CAF50":"#E85B5B"}}>{cntVal-sysVal<0?"-":""}{fmtK(Math.abs(cntVal-sysVal))}</div><div className="stat-l">Variance</div></div>
          </div>
          {liveStock.length===0?<div style={{textAlign:"center",color:"#8899AA",padding:"20px 0"}}>No stock to count.</div>:(()=>{
            // Group batches by item name, sort names alphabetically
            const groups={};
            liveStock.forEach(s=>{ const k=s.name.toLowerCase(); if(!groups[k])groups[k]={name:s.name,batches:[]}; groups[k].batches.push(s); });
            const names=Object.values(groups).sort((a,b)=>a.name.localeCompare(b.name));
            const cols="minmax(0,1fr) 50px 70px 44px";
            return (<div className="tbl">
              <div className="tbl-h" style={{gridTemplateColumns:cols}}><span>Item</span><span className="num">System</span><span className="num">Counted</span><span className="num">Diff</span></div>
              {names.flatMap(g=>g.batches.slice().sort((a,b)=>(a.trip_no||"").localeCompare(b.trip_no||"")).map(s=>{
                const c=takeCounts[s.id]===undefined||takeCounts[s.id]===""?s.available:Number(takeCounts[s.id]);
                const diff=c-s.available;
                return (<div key={s.id} className="tbl-row" style={diff!==0?{boxShadow:`inset 3px 0 0 ${diff<0?"#E85B5B":"#4CAF50"}`}:{}}>
                  <div className="tbl-r tbl-static" style={{gridTemplateColumns:cols}}>
                    <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:600,lineHeight:1.25,wordBreak:"break-word"}}>{g.name}</div><div className="tbl-sub">{s.trip_no} · KSh {Number(s.unit_cost).toLocaleString()}</div></div>
                    <div className="num" style={{fontSize:16,fontWeight:600}}>{s.available}</div>
                    <div><input className="plain" type="number" value={takeCounts[s.id]===undefined?"":takeCounts[s.id]} onChange={e=>setTakeCounts(x=>({...x,[s.id]:e.target.value}))} placeholder={String(s.available)} style={{width:"100%",background:"transparent",border:"none",borderBottom:`2px solid ${diff!==0?(diff<0?"#E85B5B":"#4CAF50"):"#5B73A3"}`,borderRadius:0,padding:"6px 2px",fontSize:16,textAlign:"center"}}/></div>
                    <div className="num" style={{fontSize:15,fontWeight:600,color:diff===0?"#5B6B85":diff<0?"#E85B5B":"#4CAF50"}}>{diff===0?"·":(diff>0?"+":"")+diff}</div>
                  </div>
                  {diff!==0&&<div className="tbl-x"><div style={{fontSize:13,color:diff<0?"#E85B5B":"#4CAF50",marginBottom:4}}>{diff<0?`Short by ${Math.abs(diff)} · loss ${fmtK(Math.abs(diff)*s.unit_cost)}`:`Found ${diff} more`}</div><input value={takeReasons[s.id]||""} onChange={e=>setTakeReasons(x=>({...x,[s.id]:e.target.value}))} placeholder="Reason (damaged, miscount, theft, unrecorded sale...)" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"8px 2px",fontSize:14,color:"#FFFFFF"}}/></div>}
                </div>);
              }))}
            </div>);
          })()}
          <div className="field" style={{marginTop:12}}><label>Notes (optional)</label><input value={takeNotes} onChange={e=>setTakeNotes(e.target.value)} placeholder="e.g. Month-end count"/></div>
          {can(user,"users")&&<div className="field"><label>Counted by</label><div className="tog">{STAFF.map(st=><button key={st} className={`tog-btn${takeStaff===st?" on":""}`} onClick={()=>setTakeStaff(st)}>{st.split(" ")[0]}</button>)}</div></div>}
          <button className="btn-y" onClick={saveStockTake} disabled={takeSaving} style={{width:"100%",padding:14,marginTop:8}}>{takeSaving?"Saving...":varCount>0?`Reconcile ${varCount} difference${varCount!==1?"s":""} & Save`:"Confirm Count (all match)"}</button>
        </div>
        );
      })():section==="orders"?<OrdersTab user={user} onMoney={onMoney}/>:(<>
      {pendingReceived.length>0&&(
        <div style={{marginBottom:14}}>
          {pendingReceived.map(o=>{
            const recvSuppliers=(o.suppliers||[]).filter(su=>su.status==="received");
            const itemCount=recvSuppliers.reduce((n,su)=>n+(su.items||[]).length,0);
            return (
              <div key={o.id} style={{background:"rgba(76,175,80,0.08)",border:"1px solid rgba(76,175,80,0.35)",borderRadius:10,padding:12,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:15,fontWeight:600,color:"#4CAF50"}}>{o.order_no} received</div>
                  <span className="badge b-g">{itemCount} item{itemCount!==1?"s":""}</span>
                </div>
                <div style={{fontSize:14,color:"#8899AA",marginBottom:10}}>{recvSuppliers.flatMap(su=>(su.items||[]).map(i=>`${i.name} x${i.qty}`)).join(", ")}</div>
                <button className="btn-y" onClick={()=>receiveOrderIntoTrip(o)} style={{width:"100%",fontSize:15}}>Receive into New Trip</button>
              </div>
            );
          })}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div className="stat"><div className="stat-n" style={{color:"#F5C000"}}>KSh {totalSV.toLocaleString()}</div><div className="stat-l">Stock value</div></div>
        <div className="stat"><div className="stat-n" style={{color:"#4CAF50"}}>{totalU}</div><div className="stat-l">Units available</div></div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:14}}>
        <div className="seg"><button className={stockView==="items"?"on":""} onClick={()=>setStockView("items")}>Items</button><button className={stockView==="trips"?"on":""} onClick={()=>setStockView("trips")}>Trips</button></div>
        <button className="btn-y" onClick={()=>setView("new")} style={{fontSize:15,padding:"9px 16px"}}>+ New Trip</button>
      </div>
      {stockView==="items"?renderItems():(<>
      {loading?<div style={{textAlign:"center",padding:"2rem",color:"#8A97A8"}}>Loading...</div>:trips.length===0?<div style={{textAlign:"center",padding:"2rem",color:"#8A97A8"}}>No trips yet.</div>:(()=>{
        const renderTrip=(t)=>{
        const isOpen=expanded[t.id];
        const tItems=stockForTrip(t.trip_no);
        const logs=auditForTrip(t.trip_no);
        const locked=t.status==="locked";
        return (
          <div key={t.id} className={`tbl-row${isOpen?" open":""}`}>
            <div className="tbl-r" onClick={()=>toggleExpand(t.id)} style={{gridTemplateColumns:"minmax(0,1fr) 92px 78px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                <span className="chev"/>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:600,color:"#F5C000"}}>{t.trip_no}</div>
                  <div className="tbl-sub">{t.date} · {t.created_by?.split(" ")[0]} · {tItems.length} item{tItems.length!==1?"s":""}</div>
                  {locked&&<div className="tbl-sub" style={{color:"#4CAF50"}}>Locked by {t.locked_by?.split(" ")[0]} on {t.locked_at?new Date(t.locked_at).toLocaleDateString("en-KE"):""}</div>}
                </div>
              </div>
              <div className="num" style={{fontWeight:600,fontSize:15}}>{Number(t.total_cost).toLocaleString()}</div>
              <div style={{textAlign:"right"}}><span className={`badge ${locked?"b-g":"b-y"}`}>{locked?"Locked":"Open"}</span></div>
            </div>
            {isOpen&&(
              <div className="tbl-x" style={{paddingTop:10}}>
                <div className="tbl" style={{margin:"0 0 8px"}}>
                  <div className="tbl-h" style={{gridTemplateColumns:"minmax(0,1fr) 42px 62px 78px"}}><span>Item</span><span className="num">Left</span><span className="num">Cost</span><span className="num">Price</span></div>
                  {tItems.map(s=>{
                    const adj=s.qty_adjusted||0; const avail=s.qty_in-s.qty_sold-adj; const op=!!itemOpen["t"+s.id]; const has=Number(s.selling_price)>0;
                    return (
                      <div key={s.id} className={`tbl-row${op?" open":""}`}>
                        <div className="tbl-r" onClick={()=>setItemOpen(x=>({...x,["t"+s.id]:!x["t"+s.id]}))} style={{gridTemplateColumns:"minmax(0,1fr) 42px 62px 78px"}}>
                          <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:600,lineHeight:1.25,wordBreak:"break-word"}}>{s.name}</div><div className="tbl-sub">{catLabel(s.category)} · In {s.qty_in}{Number(s.qty_sold)>0?` · Sold ${s.qty_sold}`:""}{adj>0?` · Adj ${adj}`:""}</div></div>
                          <div className="num" style={{fontSize:15,fontWeight:600,color:avail>0?"#4CAF50":"#E85B5B"}}>{avail}</div>
                          <div className="num" style={{fontSize:14,color:"#C2CBD6"}}>{Number(s.unit_cost).toLocaleString()}</div>
                          <div className="num" style={{fontSize:14,fontWeight:600,color:has?"#FFFFFF":"#E8A45B"}}>{has?Number(s.selling_price).toLocaleString():"No price"}</div>
                        </div>
                        {op&&<div className="tbl-x" style={{background:"#050A1F"}}>
                          {!priceLocked(s)&&priceEditor([s],"b"+s.id,Number(s.selling_price),!has,"Selling price (KSh)")}
                          <div style={{display:"flex",gap:2}}>
                            {avail>0&&can(user,"adjust")&&<button onClick={()=>{setAdjItem(s);setAdjQty(1);}} style={{background:"none",border:"none",color:"#C2CBD6",fontSize:14,padding:"8px 8px 8px 0",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Adjust stock</button>}
                            {!locked&&can(user,"edit")&&withinWindow(s.created_at)&&<button onClick={()=>startEdit(s,t)} style={{background:"none",border:"none",color:"#E85B5B",fontSize:14,padding:"8px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Edit item</button>}
                          </div>
                        </div>}
                      </div>
                    );
                  })}
                </div>
                {!locked&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #0F1A3A"}}>
                    {addingToTrip?.id===t.id?(
                      <div>
                        <div style={{fontSize:15,fontWeight:600,marginBottom:10,color:"#F5C000"}}>Add items to {t.trip_no}</div>
                        {addExtraItems.map(i=>(
                          <div key={i.id} style={{borderBottom:"1px solid #1A2A4A",padding:"6px 0 14px",marginBottom:12}}>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 28px",gap:5,marginBottom:5}}>
                              <ProductSearch user={user} value={i.name} onChange={v=>setAddExtraItems(x=>x.map(a=>a.id===i.id?{...a,name:v}:a))} onPick={p=>setAddExtraItems(x=>x.map(a=>a.id===i.id?{...a,name:p.name,category:p.category,unit_cost:p.default_cost>0?String(p.default_cost):a.unit_cost,selling_price:p.default_price>0?String(p.default_price):a.selling_price}:a))} placeholder="Search product..."/>
                              <button onClick={()=>setAddExtraItems(x=>x.filter(a=>a.id!==i.id))} style={{background:"none",border:"none",color:"#E85B5B",cursor:"pointer",fontSize:16}}>x</button>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
                              <select value={i.category} onChange={e=>setAddExtraItems(x=>x.map(a=>a.id===i.id?{...a,category:e.target.value}:a))} style={{background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15}}>{CAT_OPTS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
                              <input type="number" value={i.qty_in} min={1} onChange={e=>setAddExtraItems(x=>x.map(a=>a.id===i.id?{...a,qty_in:e.target.value}:a))} placeholder="Qty" style={{background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15,textAlign:"center",width:"100%"}}/>
                              <input required type="number" value={i.unit_cost} onChange={e=>setAddExtraItems(x=>x.map(a=>a.id===i.id?{...a,unit_cost:e.target.value}:a))} placeholder="Cost (KSh)" style={{background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15,width:"100%"}}/>
                            </div>
                            <input required type="number" value={i.selling_price} onChange={e=>setAddExtraItems(x=>x.map(a=>a.id===i.id?{...a,selling_price:e.target.value}:a))} placeholder="Sell at (KSh) - required" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"8px 2px",fontSize:15,color:"#FFFFFF",marginTop:8}}/>
                          </div>
                        ))}
                        <button className="btn-g" onClick={()=>setAddExtraItems(x=>[...x,{id:Date.now(),name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}])} style={{width:"100%",fontSize:14,marginBottom:8}}>+ Add another</button>
                        <div style={{display:"flex",gap:8}}>
                          <button className="btn-y" onClick={()=>saveAddItems(t)} disabled={saving} style={{flex:1,fontSize:14}}>{saving?"Saving...":"Save Items"}</button>
                          <button className="btn-g" onClick={()=>{setAddingToTrip(null);setAddExtraItems([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);}} style={{fontSize:14}}>Cancel</button>
                        </div>
                      </div>
                    ):(
                      <button onClick={()=>setAddingToTrip(t)} style={{background:"none",border:"none",color:"#F5C000",fontSize:15,padding:"8px 0",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ Add forgotten items</button>
                    )}
                  </div>
                )}
                {!locked&&can(user,"lock")&&(
                  <div style={{marginTop:12}}>
                    <details className="dtl">
                      <summary style={{textAlign:"center",background:"rgba(76,175,80,0.1)",border:"1px solid rgba(76,175,80,0.3)",color:"#4CAF50",padding:"11px",borderRadius:8,fontSize:16,fontWeight:600}}>Lock trip</summary>
                      <div style={{paddingTop:12}}>
                        <div style={{fontSize:14,color:"#A9B5C6",marginBottom:8}}>Who is confirming? No one can edit this trip after it is locked.</div>
                        <div className="tog" style={{marginBottom:10}}>{STAFF.map(s=><button key={s} className={`tog-btn${lockStaff===s?" on":""}`} onClick={()=>setLockStaff(s)}>{s.split(" ")[0]}</button>)}</div>
                        <button className="btn-y" onClick={()=>lockTrip(t)} disabled={saving} style={{width:"100%",fontSize:16}}>{saving?"Locking...":"Confirm lock"}</button>
                      </div>
                    </details>
                  </div>
                )}
                {logs.length>0&&(
                  <details className="dtl" style={{marginTop:12,paddingTop:10,borderTop:"1px solid #0F1A3A"}}>
                    <summary style={{fontSize:14,color:"#A9B5C6",padding:"4px 0"}}>History ({logs.length})</summary>
                    <div style={{marginTop:8}}>
                    {logs.map(a=>(
                      <div key={a.id} className="audit-entry">
                        <span style={{color:"#8899AA"}}>{new Date(a.changed_at).toLocaleDateString("en-KE",{day:"2-digit",month:"short"})} {new Date(a.changed_at).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit",hour12:true})}</span>
                        {" "}<span style={{color:"#E8E2D4"}}>{a.changed_by?.split(" ")[0]}</span>
                        {" "}<span style={{color:"#F5C000"}}>{a.action}</span>
                        {a.field_changed&&<span style={{color:"#8899AA"}}> · {a.field_changed}: {a.old_value} to {a.new_value}</span>}
                        {a.reason&&<div style={{color:"#8A97A8",paddingLeft:4}}>"{a.reason}"</div>}
                      </div>
                    ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        );
        };
        const tripTable=arr=>(<div className="tbl"><div className="tbl-h" style={{gridTemplateColumns:"minmax(0,1fr) 92px 78px"}}><span>Trip</span><span className="num">Cost</span><span className="num">Status</span></div>{arr.map(renderTrip)}</div>);
        // Group trips: current month as rows, older months/years collapsed
        const tg=k=>setTripGrp(x=>({...x,[k]:!x[k]}));
        const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
        const now=new Date(); const cm=now.toISOString().slice(0,7); const cy=String(now.getFullYear());
        const sorted=[...trips].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
        const cur=[]; const mg={}; const yg={};
        sorted.forEach(t=>{ const ym=(t.date||"").slice(0,7),y=(t.date||"").slice(0,4); if(ym===cm)cur.push(t); else if(y===cy){(mg[ym]=mg[ym]||[]).push(t);} else {(yg[y]=yg[y]||[]).push(t);} });
        const grpCost=arr=>arr.reduce((n,t)=>n+Number(t.total_cost||0),0);
        return (<div>
          {cur.length>0&&tripTable(cur)}
          {Object.keys(mg).sort((a,b)=>b.localeCompare(a)).map(ym=>(
            <div key={ym} style={{marginBottom:10}}>
              <div onClick={()=>tg(ym)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"9px 12px",background:"#0A1128",border:"1px solid #24365C",borderRadius:10}}>
                <span style={{fontSize:15,fontWeight:600,color:"#AEB9C7"}}>{tripGrp[ym]?"▾":"▸"} {MONTHS[parseInt(ym.slice(5,7))-1]} · {mg[ym].length} trip{mg[ym].length!==1?"s":""}</span>
                <span style={{fontSize:15,fontWeight:600,color:"#F5C000"}}>KSh {grpCost(mg[ym]).toLocaleString()}</span>
              </div>
              {tripGrp[ym]&&<div style={{marginTop:8}}>{tripTable(mg[ym])}</div>}
            </div>
          ))}
          {Object.keys(yg).sort((a,b)=>b.localeCompare(a)).map(y=>(
            <div key={y} style={{marginBottom:10}}>
              <div onClick={()=>tg(y)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"9px 12px",background:"#0A1128",border:"1px solid #2E4472",borderRadius:10}}>
                <span style={{fontSize:15,fontWeight:700,color:"#E8E2D4"}}>{tripGrp[y]?"▾":"▸"} {y} · {yg[y].length} trip{yg[y].length!==1?"s":""}</span>
                <span style={{fontSize:15,fontWeight:700,color:"#F5C000"}}>KSh {grpCost(yg[y]).toLocaleString()}</span>
              </div>
              {tripGrp[y]&&<div style={{marginTop:8}}>{tripTable(yg[y])}</div>}
            </div>
          ))}
        </div>);
      })()}
      </>)}
      </>)}
    </div>
  );
}

