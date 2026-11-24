import { useState, useEffect } from "react";
import { CAT_OPTS, can, errMsg, fmtK, logAudit, recordMoney, sb, todayStr } from "../lib";
import { ProductSearch } from "../screens/ProductSearch";

export function OrdersTab({user,onMoney}){
  const [orders,setOrders]=useState([]); const [loading,setLoading]=useState(true);
  const [suppliers,setSuppliers]=useState([]);
  const [openOrder,setOpenOrder]=useState(null); // the order currently open/expanded (live)
  const [filter,setFilter]=useState("open");
  const [ordOpen,setOrdOpen]=useState({});
  const [busy,setBusy]=useState(false);

  const load=async(keepOpenId)=>{ setLoading(true);
    try{
      const [o,s]=await Promise.all([
        sb.get("karu_orders","select=*&order=created_at.desc"),
        sb.get("karu_suppliers","select=*&order=last_used.desc.nullslast").catch(()=>[])
      ]);
      setOrders(o); setSuppliers(s);
      if(keepOpenId){ const fresh=o.find(x=>x.id===keepOpenId); if(fresh) setOpenOrder(fresh); }
    }catch(e){console.error(e);}
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const subTotal=(sub)=>(sub.items||[]).reduce((t,i)=>t+(Number(i.qty||1)*Number(i.est_cost||0)),0);
  const orderTotal=(subs)=>(subs||[]).filter(s=>s.status!=="cancelled").reduce((t,s)=>t+subTotal(s),0);
  const orderDeposits=(subs)=>(subs||[]).filter(s=>s.status!=="cancelled").reduce((t,s)=>t+Number(s.deposit_paid||0),0);
  const badge=s=>({pending:"b-y",ordered:"b-muted",received:"b-g",cancelled:"b-r"}[s]||"b-muted");
  const supSuggest=(val)=>{ const q=(val||"").toLowerCase().trim(); return q?suppliers.filter(s=>s.name.toLowerCase().includes(q)).slice(0,5):[]; };

  // Persist the open order's suppliers array to Supabase (debounced-ish: called on explicit actions)
  const persist=async(subs,extra={})=>{
    if(!openOrder) return;
    const allDone=subs.length>0 && subs.every(s=>["ordered","received","cancelled"].includes(s.status));
    const patch={suppliers:subs,est_total:orderTotal(subs),status:allDone?"ordered":"pending",updated_at:new Date().toISOString(),...extra};
    await sb.patch("karu_orders",openOrder.id,patch);
    setOpenOrder(o=>({...o,...patch}));
  };

  const rememberSupplier=async(nm)=>{
    nm=(nm||"").trim(); if(!nm) return;
    try{ await sb.post("karu_suppliers",{name:nm,last_used:todayStr()}); }
    catch{ try{ const ex=await sb.get("karu_suppliers",`select=id&name=eq.${encodeURIComponent(nm)}`); if(ex[0]) await sb.patch("karu_suppliers",ex[0].id,{last_used:todayStr()}); }catch{} }
  };

  // An order that was started and never filled in: nothing named, nothing ordered, nothing paid.
  const orderIsEmpty=o=>!!o&&o.status==="pending"&&(o.suppliers||[]).every(s=>s.status==="pending"&&Number(s.deposit_paid||0)===0&&!(s.supplier||"").trim()&&(s.items||[]).every(i=>!(i.name||"").trim()));
  // Safe to delete: no supplier has been ordered, received, cancelled or paid a deposit.
  const subsDeletable=subs=>(subs||[]).every(s=>(s.status||"pending")==="pending"&&Number(s.deposit_paid||0)===0);
  const deleteOrder=async(o,ask)=>{
    if(ask&&!confirm(`Delete ${o.order_no}? It has not been ordered or paid. This cannot be undone.`)) return;
    try{ await sb.del("karu_orders",o.id); }catch(e){ alert("Could not delete: "+errMsg(e)); return; }
    setOpenOrder(null); await load();
  };
  const leaveOrder=async()=>{ const o=openOrder; if(o&&orderIsEmpty(o)){ try{ await sb.del("karu_orders",o.id); }catch(e){ console.error(e); } } setOpenOrder(null); load(); };
  // Create a brand-new order immediately (so everything after is live)
  const startNew=async()=>{
    setBusy(true);
    try{
      const nextNo=Math.max(0,...orders.map(x=>parseInt(String(x.order_no||"").replace(/\D/g,""),10)||0))+1;
      const orderNo=`KARU-ORD-${String(nextNo).padStart(3,"0")}`;
      const firstSub={supplier:"",status:"pending",deposit_paid:0,items:[{name:"",category:"living",qty:1,est_cost:0}]};
      const [created]=await sb.post("karu_orders",{order_no:orderNo,date:todayStr(),suppliers:[firstSub],est_total:0,status:"pending",notes:"",created_by:user.full_name});
      await load(created.id);
    }catch(e){alert("Could not start order: "+e.message);}
    setBusy(false);
  };

  // Local working copy of the open order's suppliers for editing text fields smoothly
  const [draft,setDraft]=useState(null);
  const savedSig = openOrder ? JSON.stringify((openOrder.suppliers||[]).map(s=>({d:s.deposit_paid,f:s.deposit_from,st:s.status}))) : "";
  // On order open: load fresh. On saved-data change (deposit/status): merge saved money+status into the working draft without losing in-progress typing.
  useEffect(()=>{ if(openOrder) setDraft(JSON.parse(JSON.stringify(openOrder.suppliers||[]))); else setDraft(null); },[openOrder?.id]);
  useEffect(()=>{
    if(!openOrder) return;
    setDraft(cur=>{
      if(!cur) return JSON.parse(JSON.stringify(openOrder.suppliers||[]));
      const saved=openOrder.suppliers||[];
      // Align by index; carry saved deposit/status/from onto current draft rows, keep current items/supplier text
      return cur.map((row,i)=> saved[i] ? {...row, deposit_paid:saved[i].deposit_paid, deposit_from:saved[i].deposit_from, status:saved[i].status} : row);
    });
  },[savedSig]);

  const upDraft=(si,patch)=>setDraft(d=>d.map((s,i)=>i===si?{...s,...patch}:s));
  const upDraftItem=(si,ii,f,v)=>setDraft(d=>d.map((s,i)=>i===si?{...s,items:s.items.map((it,j)=>j===ii?{...it,[f]:v}:it)}:s));
  const addDraftItem=(si)=>setDraft(d=>d.map((s,i)=>i===si?{...s,items:[...s.items,{name:"",category:"living",qty:1,est_cost:0}]}:s));
  const rmDraftItem=(si,ii)=>setDraft(d=>d.map((s,i)=>i===si?{...s,items:s.items.length>1?s.items.filter((_,j)=>j!==ii):s.items}:s));
  const addDraftSupplier=()=>setDraft(d=>[...d,{supplier:"",status:"pending",deposit_paid:0,items:[{name:"",category:"living",qty:1,est_cost:0}]}]);
  const rmDraftSupplier=(si)=>setDraft(d=>d.length>1?d.filter((_,i)=>i!==si):d);

  // Save a single supplier block (persists whole draft, remembers supplier name)
  const saveSupplier=async(si)=>{
    const sub=draft[si];
    if(!(sub.supplier||"").trim()){alert("Supplier name required.");return;}
    if(!sub.items.some(i=>(i.name||"").trim())){alert("Add at least one item.");return;}
    setBusy(true);
    try{
      const clean=draft.map(s=>({supplier:(s.supplier||"").trim(),status:s.status||"pending",deposit_paid:Number(s.deposit_paid||0),items:s.items.filter(i=>(i.name||"").trim()).map(i=>({name:i.name,category:i.category,qty:Number(i.qty)||1,est_cost:Number(i.est_cost)||0}))}));
      await persist(clean);
      await rememberSupplier(sub.supplier);
      await load(openOrder.id);
    }catch(e){alert("Save failed: "+e.message);}
    setBusy(false);
  };

  const markSupplier=async(si,status)=>{
    setBusy(true);
    try{
      const target=draft[si];
      const dep=Number(target.deposit_paid||0);
      // If cancelling a supplier that had a deposit, refund it to the account it came from
      if(status==="cancelled" && dep>0){
        const back=target.deposit_from||"sacco";
        await recordMoney({account:back,amount:dep,type:"order_deposit_refund",ref:openOrder.order_no,description:`Deposit refunded (cancelled) · ${openOrder.order_no} · ${target.supplier}`,date:todayStr(),recorded_by:user.full_name});
        await logAudit({trip_no:null,record_id:openOrder.id,action:"order_cancel_refund",field_changed:`${openOrder.order_no} · ${target.supplier}`,old_value:String(dep),new_value:"0",reason:`Supplier cancelled, deposit returned to ${back}`,changed_by:user.full_name});
        if(onMoney) onMoney();
      }
      const clean=draft.map((s,i)=>({supplier:(s.supplier||"").trim(),status:i===si?status:(s.status||"pending"),deposit_paid:(i===si&&status==="cancelled")?0:Number(s.deposit_paid||0),deposit_from:s.deposit_from||null,items:s.items.filter(it=>(it.name||"").trim()).map(it=>({name:it.name,category:it.category,qty:Number(it.qty)||1,est_cost:Number(it.est_cost)||0}))}));
      await persist(clean);
      if(status==="ordered") await rememberSupplier(draft[si].supplier);
      await load(openOrder.id);
    }catch(e){alert("Failed: "+e.message);}
    setBusy(false);
  };

  // Deposit against a supplier block
  const [depSi,setDepSi]=useState(null); const [depAmt,setDepAmt]=useState(""); const [depFrom,setDepFrom]=useState("sacco"); const [depSaving,setDepSaving]=useState(false);
  const payDeposit=async()=>{
    const a=Number(depAmt); if(!a||a<=0){alert("Enter an amount.");return;}
    const sub0=draft[depSi]; const bal0=Math.max(0,subTotal(sub0)-Number(sub0.deposit_paid||0));
    if(a>bal0){alert(`That's more than the balance owed (${fmtK(bal0)}). Enter ${fmtK(bal0)} or less.`);return;}
    setDepSaving(true);
    try{
      const clean=draft.map((s,i)=>({supplier:(s.supplier||"").trim(),status:s.status||"pending",deposit_paid:Number(s.deposit_paid||0)+(i===depSi?a:0),deposit_from:(i===depSi?depFrom:(s.deposit_from||null)),items:s.items.filter(it=>(it.name||"").trim()).map(it=>({name:it.name,category:it.category,qty:Number(it.qty)||1,est_cost:Number(it.est_cost)||0}))}));
      await persist(clean);
      await recordMoney({account:depFrom,amount:-a,type:"order_deposit",ref:openOrder.order_no,description:`Deposit · ${openOrder.order_no} · ${draft[depSi].supplier}`,date:todayStr(),recorded_by:user.full_name});
      await logAudit({trip_no:null,record_id:openOrder.id,action:"order_deposit",field_changed:`${openOrder.order_no} · ${draft[depSi].supplier}`,old_value:String(draft[depSi].deposit_paid||0),new_value:String(Number(draft[depSi].deposit_paid||0)+a),reason:`Deposit from ${depFrom}`,changed_by:user.full_name});
      if(onMoney) onMoney();
      setDepSi(null); setDepAmt(""); await load(openOrder.id);
    }catch(e){alert("Failed: "+e.message);}
    setDepSaving(false);
  };

  const saveNotes=async(notes)=>{ if(!openOrder) return; await sb.patch("karu_orders",openOrder.id,{notes}); setOpenOrder(o=>({...o,notes})); };

  const shown=orders.filter(o=>filter==="open"?["pending","ordered"].includes(o.status):filter==="done"?["received","cancelled"].includes(o.status):true);

  // ── OPEN ORDER (live editing, each supplier self-contained) ──
  if(openOrder && draft){
    return (
      <div>
        <div className="subscreen-hd" style={{margin:"0 0 14px",borderRadius:12,border:"1px solid #24365C"}}>
          <button className="btn-g" onClick={leaveOrder} style={{fontSize:15}}>Back</button>
          <div className="title" style={{color:"#F5C000"}}>{openOrder.order_no}</div>
          <span className={`badge ${badge(openOrder.status)}`} style={{marginLeft:"auto"}}>{openOrder.status}</span>
        </div>

        {draft.map((sub,si)=>{
          const locked=["ordered","received","cancelled"].includes(sub.status);
          const st=subTotal(sub); const dep=Number(sub.deposit_paid||0); const bal=Math.max(0,st-dep);
          return (
            <div key={si} style={{background:"transparent",border:`1px solid ${locked?"#1A2A4A":"rgba(245,192,0,0.35)"}`,borderRadius:10,padding:12,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:14,color:"#8899AA",fontWeight:600}}>Supplier {si+1}</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span className={`badge ${badge(sub.status)}`}>{sub.status}</span>
                  {draft.length>1&&!locked&&<button onClick={()=>rmDraftSupplier(si)} style={{background:"none",border:"none",color:"#E85B5B",cursor:"pointer",fontSize:18}}>×</button>}
                </div>
              </div>

              {!locked?(<>
                <div style={{position:"relative",marginBottom:8}}>
                  <input value={sub.supplier} onChange={e=>upDraft(si,{supplier:e.target.value,_sug:true})} onFocus={()=>upDraft(si,{_sug:true})} onBlur={()=>setTimeout(()=>upDraft(si,{_sug:false}),200)} placeholder="Supplier name" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#FFFFFF",fontSize:15}}/>
                  {sub._sug&&supSuggest(sub.supplier).length>0&&(
                    <div className="ac-drop">{supSuggest(sub.supplier).map(sg=><div key={sg.id} className="ac-item" onMouseDown={()=>upDraft(si,{supplier:sg.name,_sug:false})}>{sg.name}</div>)}</div>
                  )}
                </div>
                {sub.items.map((it,ii)=>(
                  <div key={ii} style={{marginBottom:10,paddingBottom:10,borderBottom:ii<sub.items.length-1?"1px solid #101B36":"none"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 24px",gap:6,marginBottom:6,alignItems:"center"}}>
                      <ProductSearch user={user} value={it.name} onChange={v=>upDraftItem(si,ii,"name",v)} onPick={p=>{upDraftItem(si,ii,"name",p.name);upDraftItem(si,ii,"category",p.category);if(p.default_cost>0)upDraftItem(si,ii,"est_cost",p.default_cost);}} placeholder="Search product..."/>
                      {sub.items.length>1&&<button onClick={()=>rmDraftItem(si,ii)} style={{background:"none",border:"none",color:"#8A97A8",cursor:"pointer",fontSize:18}}>×</button>}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr 1fr",gap:6}}>
                      <select value={it.category} onChange={e=>upDraftItem(si,ii,"category",e.target.value)} style={{background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#8899AA",fontSize:15}}>{CAT_OPTS.map(c=><option key={c.id} value={c.id} style={{background:"#0A1128"}}>{c.label}</option>)}</select>
                      <input type="number" value={it.qty} min={1} onChange={e=>upDraftItem(si,ii,"qty",e.target.value)} placeholder="Qty" style={{background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15,textAlign:"center",width:"100%"}}/>
                      <input type="number" value={it.est_cost} onChange={e=>upDraftItem(si,ii,"est_cost",e.target.value)} placeholder="Cost" style={{background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15,width:"100%"}}/>
                    </div>
                  </div>
                ))}
                <button onClick={()=>addDraftItem(si)} style={{width:"100%",fontSize:14,marginBottom:8,background:"none",border:"1px dashed #1A2A4A",borderRadius:6,color:"#8899AA",padding:"8px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ Add item</button>
              </>):(
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>{sub.supplier}</div>
                  <div style={{fontSize:14,color:"#8899AA"}}>{(sub.items||[]).map(i=>`${i.name} x${i.qty}`).join(", ")}</div>
                </div>
              )}

              {/* Sub-summary */}
              <div style={{borderTop:"1px solid #1A2A4A",paddingTop:10,marginTop:4}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:dep>0?6:8}}>
                  <span style={{color:"#8899AA"}}>Supplier total</span>
                  <span style={{color:"#E8E2D4",fontWeight:600}}>{fmtK(st)}</span>
                </div>
                {dep>0&&(
                  <div style={{background:"rgba(76,175,80,0.06)",border:"1px solid rgba(76,175,80,0.2)",borderRadius:6,padding:"8px 10px",marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:4}}><span style={{color:"#4CAF50"}}>Deposit paid</span><span style={{color:"#4CAF50",fontWeight:600}}>{fmtK(dep)}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:15,paddingTop:4,borderTop:"1px solid rgba(76,175,80,0.15)"}}><span style={{color:"#E8E2D4",fontWeight:600}}>{bal>0?"Balance owed":"Fully paid"}</span><span style={{color:bal>0?"#E8A45B":"#4CAF50",fontWeight:700}}>{fmtK(bal)}</span></div>
                  </div>
                )}

                {/* Deposit inline form */}
                {depSi===si?(
                  <div style={{background:"rgba(245,192,0,0.06)",border:"1px solid rgba(245,192,0,0.25)",borderRadius:8,padding:10,marginBottom:8}}>
                    <div style={{fontSize:14,color:"#8899AA",marginBottom:8}}>{dep>0?`Already paid ${fmtK(dep)} · `:""}Balance owed: <span style={{color:"#E8A45B",fontWeight:600}}>{fmtK(bal)}</span></div>
                    <div className="field"><label>Amount to pay now (KSh)</label><input type="number" value={depAmt} onChange={e=>setDepAmt(e.target.value)} placeholder="0" autoFocus/>{bal>0&&<button onClick={()=>setDepAmt(String(bal))} style={{marginTop:6,background:"none",border:"1px solid #1A2A4A",borderRadius:5,color:"#8899AA",fontSize:13,padding:"5px 10px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Pay full balance ({fmtK(bal)})</button>}</div>
                    <div className="field"><label>From</label><div className="tog"><button className={`tog-btn${depFrom==="cash"?" on":""}`} onClick={()=>setDepFrom("cash")}>Cash</button><button className={`tog-btn${depFrom==="sacco"?" on":""}`} onClick={()=>setDepFrom("sacco")}>Bank</button></div></div>
                    <div style={{display:"flex",gap:6}}><button className="btn-y" onClick={payDeposit} disabled={depSaving} style={{flex:1,fontSize:14}}>{depSaving?"...":"Confirm payment"}</button><button className="btn-g" onClick={()=>{setDepSi(null);setDepAmt("");}} style={{fontSize:14}}>Cancel</button></div>
                  </div>
                ):(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {!locked&&<button className="btn-y" onClick={()=>saveSupplier(si)} disabled={busy} style={{fontSize:13,padding:"6px 12px"}}>Save</button>}
                    {["pending","ordered","received"].includes(sub.status)&&can(user,"money")&&bal>0&&<button className="btn-g" onClick={()=>{setDepSi(si);setDepAmt("");}} style={{fontSize:13,padding:"6px 10px",borderColor:"rgba(245,192,0,0.3)",color:"#F5C000"}}>{dep>0?"Add payment":"Record payment"}</button>}
                    {sub.status==="pending"&&<button className="btn-g" onClick={()=>markSupplier(si,"ordered")} disabled={busy} style={{fontSize:13,padding:"6px 10px"}}>Mark ordered</button>}
                    {sub.status==="ordered"&&<button className="btn-g" onClick={()=>markSupplier(si,"received")} disabled={busy} style={{fontSize:13,padding:"6px 10px",borderColor:"rgba(76,175,80,0.3)",color:"#4CAF50"}}>Received</button>}
                    {["pending","ordered"].includes(sub.status)&&<button className="btn-g" onClick={()=>{if(confirm(`Cancel ${sub.supplier||"this supplier"}?`))markSupplier(si,"cancelled");}} style={{fontSize:13,padding:"6px 10px",borderColor:"rgba(232,91,91,0.3)",color:"#E85B5B"}}>Cancel</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <button className="btn-g" onClick={addDraftSupplier} style={{width:"100%",marginBottom:14,fontSize:15}}>+ Add another supplier</button>

        <div className="field"><label>Trip notes</label><input defaultValue={openOrder.notes||""} onBlur={e=>saveNotes(e.target.value)} placeholder="e.g. Kiambu market run"/></div>

        <div style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:10,padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:600}}><span>Order total</span><span style={{color:"#F5C000"}}>{fmtK(orderTotal(draft))}</span></div>
          {orderDeposits(draft)>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#8899AA",marginTop:4}}><span>Deposits paid</span><span>{fmtK(orderDeposits(draft))}</span></div>}
          {orderDeposits(draft)>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#E8A45B",marginTop:2}}><span>Balance to suppliers</span><span>{fmtK(Math.max(0,orderTotal(draft)-orderDeposits(draft)))}</span></div>}
        </div>
        {subsDeletable(draft)&&subsDeletable(openOrder.suppliers)&&<button className="btn-r" onClick={()=>deleteOrder(openOrder,true)} style={{width:"100%",marginTop:12,padding:"11px",fontSize:14}}>Delete this order</button>}
        {draft.some(s=>s.status==="received")&&(()=>{ const depOnReceived=draft.filter(s=>s.status==="received").reduce((t,s)=>t+Number(s.deposit_paid||0),0); return (
          <div style={{background:"rgba(76,175,80,0.08)",border:"1px solid rgba(76,175,80,0.3)",borderRadius:8,padding:10,marginTop:10,fontSize:14,color:"#8899AA"}}>
            <div style={{color:"#4CAF50",fontWeight:600,marginBottom:4}}>✓ Received items — log them as a sourcing trip in Stock</div>
            {depOnReceived>0&&<div>Deposits of {fmtK(depOnReceived)} were already paid and recorded as money out. When you create the sourcing trip, record it as paid from the same account for the <strong>balance only</strong> ({fmtK(depOnReceived)} is already accounted), so you don't double-count.</div>}
          </div>
        );})()}
      </div>
    );
  }

  // ── LIST ──
  return (
    <div>
      <div style={{fontSize:14,color:"#8899AA",marginBottom:12,lineHeight:1.5}}>Plan a buying trip. Open an order and add each supplier as its own block — items, deposit, and status handled right there. Each supplier acts on its own.</div>
      {orders.filter(orderIsEmpty).length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,background:"rgba(232,164,91,0.08)",border:"1px solid rgba(232,164,91,0.3)",borderRadius:8,padding:"9px 12px",marginBottom:12,fontSize:14,color:"#E8A45B"}}><span>{orders.filter(orderIsEmpty).length} empty order{orders.filter(orderIsEmpty).length!==1?"s":""}</span><button className="btn-r" onClick={async()=>{ const em=orders.filter(orderIsEmpty); if(!confirm(`Delete ${em.length} empty order${em.length!==1?"s":""}?`)) return; for(const e of em){ try{ await sb.del("karu_orders",e.id); }catch(x){ console.error(x); } } await load(); }}>Delete empty</button></div>}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><button className="btn-y" onClick={startNew} disabled={busy} style={{fontSize:15,padding:"9px 16px"}}>{busy?"...":"+ New Order"}</button></div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[["open","Open"],["done","Completed"],["all","All"]].map(([id,l])=><button key={id} onClick={()=>setFilter(id)} style={{padding:"5px 12px",borderRadius:100,border:`1px solid ${filter===id?"#F5C000":"#1A2A4A"}`,background:filter===id?"rgba(245,192,0,0.1)":"transparent",color:filter===id?"#F5C000":"#8899AA",fontSize:14,cursor:"pointer"}}>{l}</button>)}
      </div>
      {loading?<div style={{textAlign:"center",padding:"2rem",color:"#8A97A8"}}>Loading...</div>:shown.length===0?<div style={{textAlign:"center",padding:"2rem",color:"#8A97A8"}}>No orders here.</div>:(()=>{
        const ordCols="minmax(0,1fr) 92px 88px";
        const orderCard=(o)=>{
          const subs=o.suppliers||[]; const dep=orderDeposits(subs);
          return (
          <div key={o.id} className="tbl-r" onClick={()=>setOpenOrder(o)} style={{gridTemplateColumns:ordCols}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:15,fontWeight:600,color:"#F5C000"}}>{o.order_no}</div>
              <div className="tbl-sub">{o.date} · {o.created_by?.split(" ")[0]}</div>
              <div className="tbl-sub">{subs.map(s=>s.supplier).filter(Boolean).join(" · ")||"No suppliers yet"}</div>
              {dep>0&&<div className="tbl-sub" style={{color:"#4CAF50"}}>Paid {fmtK(dep)} · Balance {fmtK(Math.max(0,orderTotal(subs)-dep))}</div>}
            </div>
            <div className="num" style={{fontWeight:600,fontSize:15}}>{fmtK(orderTotal(subs))}</div>
            <div style={{textAlign:"right"}}><span className={`badge ${badge(o.status)}`}>{o.status}</span></div>
          </div>
          );
        };
        const ordTable=arr=>(<div className="tbl"><div className="tbl-h" style={{gridTemplateColumns:ordCols}}><span>Order</span><span className="num">Estimate</span><span className="num">Status</span></div>{arr.map(orderCard)}</div>);
        const toggle=k=>setOrdOpen(x=>({...x,[k]:!x[k]}));
        const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
        const now=new Date(); const curMonth=now.toISOString().slice(0,7); const curYear=String(now.getFullYear());
        const gTotal=arr=>arr.reduce((n,o)=>n+orderTotal(o.suppliers||[]),0);
        const current=[]; const monthGroups={}; const yearGroups={};
        shown.forEach(o=>{ const ym=(o.date||"").slice(0,7); const y=(o.date||"").slice(0,4);
          if(ym===curMonth) current.push(o);
          else if(y===curYear){ if(!monthGroups[ym])monthGroups[ym]=[]; monthGroups[ym].push(o); }
          else { if(!yearGroups[y])yearGroups[y]=[]; yearGroups[y].push(o); }
        });
        return (
          <div>
            {current.length>0&&ordTable(current)}
            {Object.keys(monthGroups).sort((a,b)=>b.localeCompare(a)).map(ym=>(
              <div key={ym} style={{marginBottom:8}}>
                <div onClick={()=>toggle(ym)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #24365C",borderRadius:8}}>
                  <span style={{fontSize:15,fontWeight:600,color:"#AEB9C7"}}>{ordOpen[ym]?"▾":"▸"} {MONTHS[parseInt(ym.slice(5,7))-1]} · {monthGroups[ym].length} order{monthGroups[ym].length!==1?"s":""}</span>
                  <span style={{fontSize:15,fontWeight:600,color:"#F5C000"}}>{fmtK(gTotal(monthGroups[ym]))}</span>
                </div>
                {ordOpen[ym]&&<div style={{padding:"8px 0 0"}}>{ordTable(monthGroups[ym])}</div>}
              </div>
            ))}
            {Object.keys(yearGroups).sort((a,b)=>b.localeCompare(a)).map(y=>(
              <div key={y} style={{marginBottom:8}}>
                <div onClick={()=>toggle(y)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #2E4472",borderRadius:8}}>
                  <span style={{fontSize:15,fontWeight:700,color:"#E8E2D4"}}>{ordOpen[y]?"▾":"▸"} {y} · {yearGroups[y].length} order{yearGroups[y].length!==1?"s":""}</span>
                  <span style={{fontSize:15,fontWeight:700,color:"#F5C000"}}>{fmtK(gTotal(yearGroups[y]))}</span>
                </div>
                {ordOpen[y]&&<div style={{padding:"8px 0 0"}}>{ordTable(yearGroups[y])}</div>}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

