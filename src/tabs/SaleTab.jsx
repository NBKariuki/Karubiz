import { useState, useEffect } from "react";
import { BIZ, H, STAFF, bizPhones, can, defStaff, errMsg, fmtK, initials, lineSaved, parseMpesa, recordMoney, savedTotal, sb, stampCosts, todayStr, withinWindow } from "../lib";
import { ProductSearch } from "../screens/ProductSearch";

export function SaleTab({user,onMoney}){
  const [stockItems,setStockItems]=useState([]);
  const [wiz,setWiz]=useState(false); const [step,setStep]=useState(1);
  const [sms,setSms]=useState(""); const [parsed,setParsed]=useState(null);
  const [staff,setStaff]=useState(defStaff(user));
  const [cName,setCName]=useState(""); const [cPhone,setCPhone]=useState("");
  const [items,setItems]=useState([{id:1,name:"",qty:1,price:""}]);
  const [pay,setPay]=useState("mpesa"); const [mpesaCode,setMpesaCode]=useState("");
  const [cashPart,setCashPart]=useState(""); const [mpesaPart,setMpesaPart]=useState("");
  const [notes,setNotes]=useState(""); const [err,setErr]=useState("");
  const [saving,setSaving]=useState(false); const [receipt,setReceipt]=useState(null); const [saved,setSaved]=useState(null);
  const [payTrail,setPayTrail]=useState([]);
  useEffect(()=>{ (async()=>{
    if(receipt&&receipt.payment_type==="instalment"&&receipt.receipt_no){
      try{ const p=await sb.get("karu_payments",`select=*&receipt_no=eq.${encodeURIComponent(receipt.receipt_no)}&order=created_at.asc`); setPayTrail(p); }catch{ setPayTrail([]); }
    } else setPayTrail([]);
  })(); },[receipt?.receipt_no]);
  const [payType,setPayType]=useState("full"); const [initPay,setInitPay]=useState("");
  const [pendingSales,setPendingSales]=useState([]); const [addPaySale,setAddPaySale]=useState(null);
  const [addPayAmt,setAddPayAmt]=useState(""); const [addPayMethod,setAddPayMethod]=useState("mpesa");
  const [addPayCode,setAddPayCode]=useState(""); const [addPayNotes,setAddPayNotes]=useState("");
  const [addPayStaff,setAddPayStaff]=useState(defStaff(user)); const [addPaySaving,setAddPaySaving]=useState(false);
  const [addPayAdj,setAddPayAdj]=useState(""); const [showAdj,setShowAdj]=useState(false);
  const [showPending,setShowPending]=useState(false);
  const [todaySales,setTodaySales]=useState([]); const [showHistory,setShowHistory]=useState(false);
  const [histSales,setHistSales]=useState([]); const [voidSale,setVoidSale]=useState(null);
  const [histOpen,setHistOpen]=useState({}); // keys: day/month/year expansion
  const [voidReason,setVoidReason]=useState(""); const [voidStaff,setVoidStaff]=useState(defStaff(user)); const [voiding,setVoiding]=useState(false);
  const [custCredit,setCustCredit]=useState(0); const [useCredit,setUseCredit]=useState(false);
  const [exchSale,setExchSale]=useState(null); const [exchItems,setExchItems]=useState([]); const [exchStaff,setExchStaff]=useState(defStaff(user)); const [exchReason,setExchReason]=useState(""); const [exchSaving,setExchSaving]=useState(false); const [exchErr,setExchErr]=useState("");

  const loadPendingSales=async()=>{ try{ setPendingSales(await sb.get("karu_sales","select=*&balance_due=gt.0&voided=eq.false&order=created_at.desc")); }catch(e){console.error(e);} };
  const loadToday=async()=>{ try{ setTodaySales(await sb.get("karu_sales",`select=*&date=eq.${todayStr()}&order=created_at.desc`)); }catch(e){console.error(e);} };
  const loadHistory=async()=>{ try{ setHistSales(await sb.get("karu_sales","select=*&order=created_at.desc&limit=500")); }catch(e){console.error(e);} };
  const loadStock=async()=>{ try{ setStockItems(await sb.get("karu_stock","select=*&order=date_in.asc")); }catch(e){console.error(e);} };
  useEffect(()=>{ loadStock(); loadPendingSales(); loadToday(); },[]);

  const resetForm=()=>{ setCName("");setCPhone("");setMpesaCode("");setNotes("");setSms("");setParsed(null);setItems([{id:1,name:"",qty:1,price:""}]);setPayType("full");setInitPay("");setCashPart("");setMpesaPart("");setPay("mpesa");setErr("");setStep(1);setCustCredit(0);setUseCredit(false); };
  const openWiz=s=>{ setStaff(s); resetForm();
    if(window.__karuCredit){ const k=window.__karuCredit; setCName(k.name); setCPhone(k.phone||""); setCustCredit(Number(k.balance)||0); setUseCredit(true); window.__karuCredit=null; }
    else { setCustCredit(0); setUseCredit(false); }
    setWiz(true);
  };
  // Look up credit when customer phone changes
  const checkCredit=async(phone)=>{
    if(!phone||phone.trim().length<9){ setCustCredit(0); return; }
    try{ const rows=await sb.get("karu_credit",`select=amount&customer_phone=eq.${encodeURIComponent(phone.trim())}`); const bal=rows.reduce((s,r)=>s+Number(r.amount),0); setCustCredit(bal>0.5?bal:0); }catch{ setCustCredit(0); }
  };
  const closeWiz=()=>{ setWiz(false); resetForm(); };

  const handleSms=v=>{
    setSms(v);
    if(v.trim().length>20){
      const p=parseMpesa(v);
      if(p.amount>0||p.name||p.code){
        setParsed(p);
        if(p.name) setCName(p.name); if(p.phone) setCPhone(p.phone); if(p.code) setMpesaCode(p.code);
        if(p.amount>0) setItems(prev=>prev.some(i=>i.name||i.price)?prev:[{id:Date.now(),name:"",qty:1,price:String(p.amount)}]);
        setPay("mpesa");
      }
    }
  };
  const addItem=()=>setItems(x=>[...x,{id:Date.now(),name:"",qty:1,price:""}]);
  const rmItem=id=>setItems(x=>x.length>1?x.filter(i=>i.id!==id):x);
  const upItem=(id,f,v)=>setItems(x=>x.map(i=>i.id===id?{...i,[f]:v}:i));
  // Editing the quoted price drags the sold-at price along until the two differ (that gap is the discount).
  const upQuote=(id,v)=>setItems(x=>x.map(i=>{ if(i.id!==id) return i; const follow=i.price===""||String(i.price)===String(i.quote||""); return {...i,quote:v,price:follow?v:i.price}; }));
  const stockPriceFor=name=>{ const k=String(name||"").trim().toLowerCase(); const m=(stockItems||[]).filter(x=>String(x.name||"").trim().toLowerCase()===k&&Number(x.selling_price)>0).sort((a,b)=>String(b.date_in||"").localeCompare(String(a.date_in||""))); return m.length?Number(m[0].selling_price):0; };
  const listPriceOf=p=>Number(p.default_price)>0?Number(p.default_price):stockPriceFor(p.name);
  const lineSavedUI=i=>lineSaved({list_price:i.quote,price:i.price,qty:i.qty});
  const savedUI=arr=>arr.reduce((n,i)=>n+lineSavedUI(i),0);
  const selectStock=(id,s)=>setItems(x=>x.map(i=>i.id===id?{...i,name:s.name,price:String(s.selling_price)}:i));
  const total=items.reduce((s,i)=>s+(Number(i.qty||0)*Number(i.price||0)),0);
  const validItems=items.filter(i=>i.name&&Number(i.price)>0);

  const reduceStock=async(soldItems)=>{
    for(const sold of soldItems){
      let qtyLeft=Number(sold.qty||1);
      const matches=stockItems.filter(s=>s.name.toLowerCase()===sold.name.toLowerCase()&&(s.qty_in-s.qty_sold-(s.qty_adjusted||0))>0).sort((a,b)=>new Date(a.date_in)-new Date(b.date_in));
      for(const si of matches){ if(qtyLeft<=0)break; const avail=si.qty_in-si.qty_sold-(si.qty_adjusted||0); const r=Math.min(qtyLeft,avail); await sb.patch("karu_stock",si.id,{qty_sold:si.qty_sold+r}); qtyLeft-=r; }
    }
  };

  const nextStep=()=>{
    setErr("");
    if(step===1){ if(!cName.trim()){setErr("Customer name is required.");return;} setStep(2); }
    else if(step===2){ if(!validItems.length){setErr("Add at least one item with a price.");return;} setStep(3); }
  };

  const [confirmSale,setConfirmSale]=useState(false);
  const salePlan=()=>{
    const creditToUse=useCredit&&custCredit>0?Math.min(custCredit,total):0;
    const dueAfterCredit=total-creditToUse;
    const amtPaid=payType==="instalment"?Number(initPay||0):dueAfterCredit;
    const balDue=payType==="instalment"?dueAfterCredit-amtPaid:0;
    const cPart=pay==="split"?Number(cashPart||0):pay==="cash"?amtPaid:0;
    const mPart=pay==="split"?Number(mpesaPart||0):pay==="mpesa"?amtPaid:0;
    const methodLabel=pay==="split"?"Split":pay==="mpesa"?"M-Pesa":"Cash";
    return {creditToUse,dueAfterCredit,amtPaid,balDue,cPart,mPart,methodLabel};
  };
  const payError=()=>{
    const creditPreview=useCredit&&custCredit>0?Math.min(custCredit,total):0;
    const dueNow=payType==="instalment"?Number(initPay||0):(total-creditPreview);
    if(pay==="mpesa"&&!mpesaCode.trim()) return "M-Pesa code required.";
    if(pay==="split"){ const c=Number(cashPart||0),m=Number(mpesaPart||0); if(c+m!==dueNow) return "Split amounts must add up to "+fmtK(dueNow)+"."; if(m>0&&!mpesaCode.trim()) return "M-Pesa code required for the M-Pesa part."; }
    if(payType==="instalment"&&(!initPay||Number(initPay)<=0)) return "Enter the initial payment.";
    if(payType==="instalment"&&Number(initPay)>total) return "Initial payment cannot exceed total.";
    return "";
  };
  const completeSale=()=>{ const e=payError(); if(e){setErr(e);return;} setErr(""); setConfirmSale(true); };

  // Fallback used only if KARU_SALE_RPC_SETUP.sql has not been run yet.
  const legacySave=async(base)=>{
    const now=new Date();
    const last=await sb.get("karu_sales","select=receipt_no&order=created_at.desc&limit=1");
    const lastNo=last.length?parseInt(last[0].receipt_no.split("-").pop()||"0"):0;
    const receipt_no=`KARU-${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,"0")}-${String(lastNo+1).padStart(3,"0")}`;
    const data={receipt_no,...base,items:stampCosts(base.items,stockItems)};
    const [newSale]=await sb.post("karu_sales",data);
    if(base.credit_applied>0){ await sb.post("karu_credit",{customer_name:cName,customer_phone:cPhone,amount:-base.credit_applied,reason:`Applied to ${receipt_no}`,ref_receipt:receipt_no,recorded_by:staff,date:base.date}); }
    if(payType==="instalment"&&newSale?.id) await sb.post("karu_payments",{sale_id:newSale.id,receipt_no,customer_name:cName,amount:base.amount_paid,payment_method:base.payment_method,mpesa_code:base.mpesa_code,date:base.date,recorded_by:staff,notes:"Initial instalment payment"});
    await reduceStock(base.items);
    if(base.cash_part>0) await recordMoney({account:"cash",amount:base.cash_part,type:"sale",ref:receipt_no,description:`Sale ${receipt_no} · ${cName}${base.mpesa_part>0?" (cash part)":""}`,date:base.date,recorded_by:staff});
    if(base.mpesa_part>0) await recordMoney({account:"sacco",amount:base.mpesa_part,type:"sale",ref:receipt_no,description:`Sale ${receipt_no} · ${cName}${base.cash_part>0?" (mpesa part)":""}`,date:base.date,recorded_by:staff});
    return data;
  };

  const genReceipt=async(withReceipt=true)=>{
    setErr("");
    const pe=payError(); if(pe){setErr(pe);setConfirmSale(false);return;}
    setSaving(true);
    try{
      const now=new Date(); const date=todayStr();
      const time_str=now.toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit",hour12:true});
      const {creditToUse,amtPaid,balDue,cPart,mPart,methodLabel}=salePlan();
      const base={date,time_str,served_by:staff,customer_name:cName,customer_phone:cPhone,items:validItems.map(i=>({name:i.name,qty:Number(i.qty)||1,price:Number(i.price),...(Number(i.quote)>Number(i.price)?{list_price:Number(i.quote)}:{})})),payment_method:methodLabel,mpesa_code:mpesaCode.toUpperCase(),cash_part:cPart,mpesa_part:mPart,total,amount_paid:amtPaid,balance_due:balDue,payment_type:payType,notes,credit_applied:creditToUse};
      let data;
      try{
        const r=await sb.rpc("karu_create_sale",{p:base});
        data={receipt_no:r.receipt_no,...base};
        if(r.short&&r.short.length) alert("Sale recorded, but stock was short for: "+r.short.map(x=>`${x.name} (${x.missing})`).join(", ")+". Check the Stock tab.");
      }catch(e){
        if(!/PGRST202|Could not find the function/.test(e.message)) throw e;
        data=await legacySave(base);
      }
      if(onMoney) onMoney();
      await loadStock(); await loadToday(); await loadPendingSales();
      setConfirmSale(false);
      setWiz(false);
      if(withReceipt) setReceipt(data); else setSaved(data);
    }catch(e){setConfirmSale(false); setErr("Save failed: "+e.message);}
    setSaving(false);
  };

  const addPaymentToSale=async()=>{
    if(!addPayAmt||Number(addPayAmt)<=0){alert("Enter a valid amount.");return;}
    const adj=Number(addPayAdj||0); // price adjustment: negative reduces total (discount), positive raises it
    const newTotal=Number(addPaySale.total)+adj;
    const balNow=Math.max(0,newTotal-Number(addPaySale.amount_paid||0));
    if(Number(addPayAmt)>balNow+0.5){alert(`That's more than the balance owed (${fmtK(balNow)}).`);return;}
    if(addPayMethod==="mpesa"&&!addPayCode.trim()){alert("M-Pesa code required.");return;}
    setAddPaySaving(true);
    try{
      // One database call: payment, sale update, money entry and audit succeed or fail together.
      const r=await sb.rpc("karu_add_payment",{p:{id:addPaySale.id,amount:Number(addPayAmt),method:addPayMethod,code:addPayCode,by:addPayStaff,notes:addPayNotes,adj}});
      if(onMoney) onMoney();
      setAddPaySale(null);setAddPayAmt("");setAddPayCode("");setAddPayNotes("");setAddPayAdj("");setShowAdj(false);
      await loadPendingSales();
      alert(r&&r.cleared?"Fully paid. Account cleared.":"Payment recorded. Balance: "+fmtK(Number(r&&r.balance||0)));
    }catch(e){alert(/PGRST202|Could not find the function/.test(e.message)?"Update needed: run KARU_SALE_FLOW_V2.sql in Supabase.":"Failed: "+errMsg(e));}
    setAddPaySaving(false);
  };

  const doVoid=async()=>{
    if(!voidReason.trim()){alert("Reason required.");return;}
    setVoiding(true);
    try{
      // One database call: sale, stock, money, credit and audit all change together or not at all.
      await sb.rpc("karu_void_sale",{p:{id:voidSale.id,reason:voidReason,by:voidStaff}});
      if(onMoney) onMoney();
      setVoidSale(null); setVoidReason("");
      await loadStock(); await Promise.all([loadToday(),loadHistory(),loadPendingSales()]);
    }catch(e){alert(/PGRST202|Could not find the function/.test(e.message)?"Update needed: run KARU_SALE_FLOW_V2.sql in Supabase.":"Void failed: "+errMsg(e));}
    setVoiding(false);
  };

  // Determine if a sale can be exchanged/edited
  const canModify=(s)=>{
    if(s.voided) return false;
    const openInstalment = Number(s.balance_due||0)>0; // still owing -> editable until closed
    if(openInstalment) return true;
    return withinWindow(s.created_at); // closed -> 24h window
  };

  const startExchange=(s)=>{
    setExchSale(s);
    setExchItems((s.items||[]).map((it,i)=>({id:Date.now()+i,name:it.name,qty:Number(it.qty)||1,price:String(it.price),quote:String(it.list_price||"")})));
    setExchStaff(user.full_name); setExchReason(""); setExchErr(""); setShowHistory(false);
  };
  const exUp=(id,f,v)=>setExchItems(x=>x.map(i=>i.id===id?{...i,[f]:v}:i));
  const exRm=(id)=>setExchItems(x=>x.length>1?x.filter(i=>i.id!==id):x);
  const exAdd=()=>setExchItems(x=>[...x,{id:Date.now(),name:"",qty:1,price:""}]);
  const exSelect=(id,p)=>setExchItems(x=>x.map(i=>i.id===id?{...i,name:p.name,quote:listPriceOf(p)>0?String(listPriceOf(p)):"",price:listPriceOf(p)>0?String(listPriceOf(p)):i.price}:i));

  const saveExchange=async()=>{
    setExchErr("");
    const vi=exchItems.filter(i=>i.name&&Number(i.price)>0);
    if(!vi.length){setExchErr("Add at least one item.");return;}
    if(!exchReason.trim()){setExchErr("Reason for the change is required.");return;}
    setExchSaving(true);
    try{
      const s=exchSale;
      // One database call: old items back to stock, new items out, credit, sale update and audit succeed or fail together.
      const r=await sb.rpc("karu_exchange_sale",{p:{id:s.id,reason:exchReason,by:exchStaff,items:vi.map(i=>({name:i.name,qty:Number(i.qty)||1,price:Number(i.price),...(Number(i.quote)>Number(i.price)?{list_price:Number(i.quote)}:{})}))}});
      await loadStock(); await loadToday(); await loadPendingSales();
      setExchSale(null);
      if(r&&r.short&&r.short.length) alert("Stock was short for: "+r.short.map(x=>`${x.name} (${x.missing})`).join(", ")+". Check the Stock tab.");
      const credit=Number(r&&r.credit||0), newBal=Number(r&&r.balance||0);
      alert(credit>0?`Exchange done. Store credit of ${fmtK(credit)} recorded for ${s.customer_name}.`:newBal>0?`Exchange done. New balance: ${fmtK(newBal)}.`:"Exchange done. Fully settled.");
    }catch(e){setExchErr(/PGRST202|Could not find the function/.test(e.message)?"Update needed: run KARU_SALE_FLOW_V2.sql in Supabase.":"Failed: "+errMsg(e));}
    setExchSaving(false);
  };

  const rcptText=r=>{
    const il=r.items.map(i=>`${i.name} x${i.qty}  KSh ${(Number(i.qty)*Number(i.price)).toLocaleString()}`+(lineSaved(i)>0?`\n   Quoted KSh ${(Number(i.qty)*Number(i.list_price)).toLocaleString()}, you save KSh ${lineSaved(i).toLocaleString()}`:"")).join("\n"); const sd=savedTotal(r.items);
    return `${BIZ.name}\nReceipt ${r.receipt_no}\nDate: ${r.date} ${r.time_str}\nServed by: ${initials(r.served_by)}\n\nCustomer: ${r.customer_name}${r.customer_phone?"\nPhone: "+r.customer_phone:""}\n\n${il}${sd>0?`\n\nYou saved: KSh ${sd.toLocaleString()}`:""}\n\nTOTAL: KSh ${r.total.toLocaleString()}${r.payment_type==="instalment"?`\nPaid: KSh ${Number(r.amount_paid).toLocaleString()}\nBalance: KSh ${Number(r.balance_due).toLocaleString()}`:""}\nPayment: ${r.payment_method}${r.mpesa_code?"\nCode: "+r.mpesa_code:""}${r.notes?"\nNote: "+r.notes:""}\n\nThank you for shopping with us\n${BIZ.address}\n${bizPhones()}`;
  };
  const copyText=()=>navigator.clipboard.writeText(rcptText(receipt)).then(()=>alert("Receipt copied"));

  const makeReceiptCanvas=()=>{
    const r=receipt; const S=2;
    const c=document.createElement("canvas"); const W=380*S; const lines=r.items.length; const nd=r.items.filter(i=>lineSaved(i)>0).length; const H=(430+lines*30+nd*18+(nd?30:0)+(r.payment_type==="instalment"?50:0)+(r.notes?24:0))*S;
    c.width=W; c.height=H; const x=c.getContext("2d"); x.scale(S,S);
    x.fillStyle="#fff"; x.fillRect(0,0,380,H/S);
    x.fillStyle="#111"; x.textAlign="center"; x.font="bold 22px Arial"; x.fillText(BIZ.name,190,34);
    x.fillStyle="#555"; x.font="12px Arial"; x.fillText(BIZ.address,190,52); x.fillText(bizPhones(),190,68);
    const dash=y=>{x.strokeStyle="#999";x.setLineDash([3,3]);x.beginPath();x.moveTo(18,y);x.lineTo(362,y);x.stroke();x.setLineDash([]);};
    dash(82); let y=104; x.font="14px Arial";
    const row=(l,v)=>{x.textAlign="left";x.fillStyle="#555";x.fillText(l,18,y);x.textAlign="right";x.fillStyle="#111";x.font="bold 14px Arial";x.fillText(v,362,y);x.font="14px Arial";y+=22;};
    row("Receipt",r.receipt_no); row("Date",r.date+"  "+r.time_str); row("Served by",initials(r.served_by)); row("Customer",r.customer_name); if(r.customer_phone) row("Phone",r.customer_phone);
    y+=4; dash(y); y+=22;
    r.items.forEach(i=>{ x.textAlign="left";x.fillStyle="#111";x.font="14px Arial";x.fillText(`${i.name}  x${i.qty}`,18,y); x.textAlign="right";x.font="bold 14px Arial";x.fillText("KSh "+(Number(i.qty)*Number(i.price)).toLocaleString(),362,y); y+=26; if(lineSaved(i)>0){ x.textAlign="left";x.fillStyle="#777";x.font="12px Arial";x.fillText(`Quoted KSh ${(Number(i.qty)*Number(i.list_price)).toLocaleString()}  ·  you save KSh ${lineSaved(i).toLocaleString()}`,18,y-6); y+=12; } });
    const sd=savedTotal(r.items);
    if(sd>0){ y+=2; x.textAlign="left";x.fillStyle="#1B7F3B";x.font="bold 14px Arial";x.fillText("You saved",18,y); x.textAlign="right";x.fillText("KSh "+sd.toLocaleString(),362,y); y+=22; x.fillStyle="#111"; }
    y+=2; dash(y); y+=28;
    x.textAlign="left";x.fillStyle="#111";x.font="bold 20px Arial";x.fillText("TOTAL",18,y); x.textAlign="right";x.fillText("KSh "+r.total.toLocaleString(),362,y); y+=26;
    if(r.payment_type==="instalment"){ x.font="14px Arial"; row("Paid","KSh "+Number(r.amount_paid).toLocaleString()); row("Balance","KSh "+Number(r.balance_due).toLocaleString()); }
    x.font="14px Arial"; row("Payment",r.payment_method+(r.mpesa_code?"  "+r.mpesa_code:"")); if(r.notes) row("Note",r.notes);
    y+=6; dash(y); y+=22;
    x.textAlign="center";x.fillStyle="#555";x.font="12px Arial";x.fillText("Thank you for shopping with us",190,y); x.fillText("karufurniture.netlify.app",190,y+18);
    return c;
  };
  const downloadJPEG=()=>{ const c=makeReceiptCanvas(); const a=document.createElement("a"); a.download=`KARU-${receipt.receipt_no}.jpg`; a.href=c.toDataURL("image/jpeg",0.95); a.click(); };
  const shareReceipt=async()=>{
    const r=receipt;
    const c=makeReceiptCanvas();
    // Try native share with the image file (opens WhatsApp, Messages, etc.)
    try{
      const blob=await new Promise(res=>c.toBlob(res,"image/jpeg",0.95));
      const file=new File([blob],`KARU-${r.receipt_no}.jpg`,{type:"image/jpeg"});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:`Receipt ${r.receipt_no}`,text:`KARU Furniture receipt for ${r.customer_name}`});
        return;
      }
      // Fallback: share text if file share unsupported
      if(navigator.share){ await navigator.share({title:`Receipt ${r.receipt_no}`,text:rcptText(r)}); return; }
    }catch(e){ if(e&&e.name==="AbortError") return; }
    // Last resort: WhatsApp text link
    window.open("https://wa.me/?text="+encodeURIComponent(rcptText(r)),"_blank");
  };

  if(exchSale) return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <button className="btn-g" onClick={()=>setExchSale(null)} style={{fontSize:15}}>Back</button>
        <div style={{fontSize:17,fontWeight:600}}>{Number(exchSale.balance_due||0)>0?"Edit Sale":"Exchange"}</div>
      </div>
      <div style={{background:"#0A1128",border:"1px solid rgba(232,164,91,0.3)",borderRadius:8,padding:12,marginBottom:14,fontSize:14,color:"#8899AA"}}>
        <div style={{marginBottom:4}}><strong style={{color:"#E8E2D4"}}>{exchSale.customer_name}</strong> · {exchSale.receipt_no}</div>
        <div>Originally: {(exchSale.items||[]).map(i=>`${i.name} x${i.qty}`).join(", ")}</div>
        <div style={{marginTop:4}}>Paid so far: <span style={{color:"#4CAF50"}}>{fmtK(Number(exchSale.amount_paid!=null?exchSale.amount_paid:exchSale.total))}</span>. Money paid is not refunded — any excess becomes store credit.</div>
      </div>
      <div className="field"><label>New items</label>
        {exchItems.map(it=>(
          <div key={it.id} style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid #101B36"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 24px",gap:6,marginBottom:6,alignItems:"center"}}>
              <ProductSearch user={user} stockRows={stockItems} value={it.name} onChange={v=>exUp(it.id,"name",v)} onPick={p=>exSelect(it.id,p)} placeholder="Search product..."/>
              {exchItems.length>1&&<button onClick={()=>exRm(it.id)} style={{background:"none",border:"none",color:"#8A97A8",cursor:"pointer",fontSize:18}}>×</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <div><div style={{fontSize:13,color:"#A9B5C6",marginBottom:0}}>Qty</div><input type="number" value={it.qty} min={1} onChange={e=>exUp(it.id,"qty",e.target.value)} style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15,textAlign:"center"}}/></div>
              <div><div style={{fontSize:13,color:"#A9B5C6",marginBottom:0}}>Price (KSh)</div><input type="number" value={it.price} onChange={e=>exUp(it.id,"price",e.target.value)} placeholder="0" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#FFFFFF",fontSize:15}}/></div>
            </div>
          </div>
        ))}
        <button onClick={exAdd} style={{width:"100%",fontSize:14,background:"none",border:"1px dashed #1A2A4A",borderRadius:6,color:"#8899AA",padding:"8px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ Add item</button>
      </div>
      {(()=>{ const nt=exchItems.reduce((a,i)=>a+(Number(i.qty||0)*Number(i.price||0)),0); const paid=Number(exchSale.amount_paid!=null?exchSale.amount_paid:exchSale.total); const bal=Math.max(0,nt-paid); const cr=Math.max(0,paid-nt); return (
        <div style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:12,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,marginBottom:4}}><span style={{color:"#8899AA"}}>New total</span><span style={{color:"#F5C000",fontWeight:600}}>{fmtK(nt)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:4}}><span style={{color:"#8899AA"}}>Already paid</span><span style={{color:"#4CAF50"}}>{fmtK(paid)}</span></div>
          {bal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:15,paddingTop:4,borderTop:"1px solid #1A2A4A"}}><span style={{color:"#E8A45B",fontWeight:600}}>New balance owed</span><span style={{color:"#E8A45B",fontWeight:700}}>{fmtK(bal)}</span></div>}
          {cr>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:15,paddingTop:4,borderTop:"1px solid #1A2A4A"}}><span style={{color:"#4CAF50",fontWeight:600}}>Store credit created</span><span style={{color:"#4CAF50",fontWeight:700}}>{fmtK(cr)}</span></div>}
        </div>
      );})()}
      <div className="field"><label>Who is handling this</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${exchStaff===s?" on":""}`} onClick={()=>setExchStaff(s)}>{s.split(" ")[0]}</button>)}</div></div>
      <div className="field"><label>Reason (required)</label><textarea value={exchReason} onChange={e=>setExchReason(e.target.value)} placeholder="e.g. Customer swapped table for sofa"/></div>
      {exchErr&&<div style={{color:"#E85B5B",fontSize:15,marginBottom:10}}>{exchErr}</div>}
      <button className="btn-y" onClick={saveExchange} disabled={exchSaving} style={{width:"100%",padding:14}}>{exchSaving?"Saving...":Number(exchSale.balance_due||0)>0?"Save Changes":"Confirm Exchange"}</button>
    </div>
  );

  if(saved) return (
    <div style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{fontSize:48,marginBottom:16}}>✅</div>
      <div style={{fontSize:18,fontWeight:600,marginBottom:8}}>Sale Recorded</div>
      <div style={{color:"#8899AA",fontSize:16,marginBottom:4}}>{saved.customer_name}</div>
      <div style={{color:"#F5C000",fontSize:24,fontWeight:600,marginBottom:4}}>{fmtK(Number(saved.total))}</div>
      {saved.payment_type==="instalment"&&<div style={{color:"#E8A45B",fontSize:16,marginBottom:4}}>Paid: {fmtK(Number(saved.amount_paid))} · Balance: {fmtK(Number(saved.balance_due))}</div>}
      <div style={{color:"#8899AA",fontSize:15,marginBottom:24}}>{saved.payment_method} · {saved.receipt_no} · {initials(saved.served_by)}</div>
      <div style={{color:"#4CAF50",fontSize:15,marginBottom:32}}>Stock and money updated</div>
      <button className="btn-y" onClick={()=>setSaved(null)} style={{width:"100%",padding:14}}>Done</button>
    </div>
  );

  if(receipt) return (
    <div>
      <div className="rcpt">
        <div className="rcpt-hd"><div className="rcpt-logo">{BIZ.name}</div><div className="rcpt-sub">{BIZ.address}</div><div className="rcpt-sub">{bizPhones()}</div></div>
        <div className="rcpt-row"><span className="l">Receipt</span><span className="v">{receipt.receipt_no}</span></div>
        <div className="rcpt-row"><span className="l">Date</span><span className="v">{receipt.date} {receipt.time_str}</span></div>
        <div className="rcpt-row"><span className="l">Served by</span><span className="v">{initials(receipt.served_by)}</span></div>
        <div className="rcpt-row"><span className="l">Customer</span><span className="v">{receipt.customer_name}</span></div>
        {receipt.customer_phone&&<div className="rcpt-row"><span className="l">Phone</span><span className="v">{receipt.customer_phone}</span></div>}
        <div className="rcpt-items">{receipt.items.map((i,idx)=><div key={idx} className="rcpt-it"><span className="n">{i.name} <span style={{color:"#555"}}>x{i.qty}</span></span><span style={{fontWeight:600}}>{lineSaved(i)>0&&<span style={{textDecoration:"line-through",color:"#888",fontWeight:400,fontSize:12,marginRight:6}}>KSh {(Number(i.qty)*Number(i.list_price)).toLocaleString()}</span>}KSh {(Number(i.qty)*Number(i.price)).toLocaleString()}</span></div>)}</div>
        {savedTotal(receipt.items)>0&&<div className="rcpt-row"><span className="l" style={{color:"#1B7F3B",fontWeight:600}}>You saved</span><span className="v" style={{color:"#1B7F3B",fontWeight:700}}>KSh {savedTotal(receipt.items).toLocaleString()}</span></div>}
        <div className="rcpt-tot"><span>TOTAL</span><span>KSh {receipt.total.toLocaleString()}</span></div>{Number(receipt.credit_applied)>0&&<div className="rcpt-row"><span className="l">Store credit used</span><span className="v">- KSh {Number(receipt.credit_applied).toLocaleString()}</span></div>}
        {receipt.payment_type==="instalment"&&<><div className="rcpt-row"><span className="l">Paid</span><span className="v">KSh {Number(receipt.amount_paid).toLocaleString()}</span></div><div className="rcpt-row"><span className="l">Balance</span><span className="v" style={{color:"#B45309"}}>KSh {Number(receipt.balance_due).toLocaleString()}</span></div></>}
        {receipt.payment_type==="instalment"&&payTrail.length>0&&(
          <div style={{margin:"8px 0",padding:"8px 0",borderTop:"1px dashed #999",borderBottom:"1px dashed #999"}}>
            <div style={{fontSize:13,color:"#555",marginBottom:4,fontWeight:600}}>PAYMENT HISTORY</div>
            {payTrail.map((p,i)=>(
              <div key={i} className="rcpt-row"><span className="l">{p.date?.slice(5)} · {p.payment_method}</span><span className="v">KSh {Number(p.amount).toLocaleString()}</span></div>
            ))}
            {Number(receipt.price_adjustment)!==0&&receipt.price_adjustment!=null&&<div className="rcpt-row"><span className="l">Price adjustment</span><span className="v">{Number(receipt.price_adjustment)>0?"+":""}KSh {Number(receipt.price_adjustment).toLocaleString()}</span></div>}
            <div className="rcpt-row" style={{fontWeight:700}}><span className="l">Total paid</span><span className="v">KSh {payTrail.reduce((s,p)=>s+Number(p.amount),0).toLocaleString()}</span></div>
          </div>
        )}
        <div className="rcpt-row"><span className="l">Payment</span><span className="v">{receipt.payment_method}{receipt.mpesa_code?" · "+receipt.mpesa_code:""}</span></div>{receipt.payment_method==="Split"&&<div className="rcpt-row"><span className="l">Cash / M-Pesa</span><span className="v">KSh {Number(receipt.cash_part).toLocaleString()} / KSh {Number(receipt.mpesa_part).toLocaleString()}</span></div>}
        {receipt.notes&&<div className="rcpt-row"><span className="l">Note</span><span className="v">{receipt.notes}</span></div>}
        {Number(receipt.store_credit_note)>0&&<div style={{background:"rgba(76,175,80,0.1)",border:"1px dashed rgba(76,175,80,0.4)",borderRadius:6,padding:"8px 10px",margin:"10px 0",fontSize:14,color:"#1a7a2e",textAlign:"center"}}>Store credit: KSh {Number(receipt.store_credit_note).toLocaleString()} — redeemable on a future purchase. Payments made are not refundable.</div>}
        <div className="rcpt-ft">Thank you for shopping with us<br/>karufurniture.netlify.app</div>
      </div>
      <button className="btn-y np" onClick={shareReceipt} style={{width:"100%",fontSize:16,padding:13,marginBottom:8}}>Share Receipt</button>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}} className="np">
        <button className="btn-g" onClick={copyText} style={{fontSize:14}}>Copy text</button>
        <button className="btn-g" onClick={downloadJPEG} style={{fontSize:14}}>Save image</button>
        <button className="btn-g" onClick={()=>window.print()} style={{fontSize:14}}>Print</button>
      </div>
      <button className="btn-g np" onClick={()=>setReceipt(null)} style={{width:"100%",fontSize:15}}>Done</button>
    </div>
  );

  const liveToday=todaySales.filter(s=>!s.voided); const todayTot=liveToday.reduce((a,s)=>a+Number(s.amount_paid||s.total),0);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
        <div><div style={{fontSize:13,color:"#8899AA",textTransform:"uppercase",letterSpacing:"0.05em"}}>Today</div><div style={{fontSize:16,fontWeight:600,color:"#FFFFFF"}}>{liveToday.length} sale{liveToday.length!==1?"s":""} · <span style={{color:"#F5C000"}}>{fmtK(todayTot)}</span></div></div>
        <button className="btn-g" onClick={()=>{setShowHistory(x=>!x);if(!showHistory)loadHistory();}} style={{fontSize:14,padding:"6px 12px"}}>{showHistory?"Hide":"History"}</button>
      </div>
      {showHistory&&(
        <div style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:12,marginBottom:14}}>
          {voidSale?(
            <div>
              <div style={{fontSize:15,fontWeight:600,marginBottom:4,color:"#E85B5B"}}>Void {voidSale.receipt_no}</div>
              <div style={{fontSize:14,color:"#8899AA",marginBottom:10}}>{voidSale.customer_name} · {fmtK(Number(voidSale.total))}. Stock returned, money reversed.</div>
              <div className="field"><label>Reason (required)</label><textarea value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="e.g. Wrong item, customer returned"/></div>
              <div className="field"><label>Voided by</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${voidStaff===s?" on":""}`} onClick={()=>setVoidStaff(s)}>{s.split(" ")[0]}</button>)}</div></div>
              <div style={{display:"flex",gap:8}}><button className="btn-r" onClick={doVoid} disabled={voiding} style={{flex:1,padding:10}}>{voiding?"Voiding...":"Confirm Void"}</button><button className="btn-g" onClick={()=>{setVoidSale(null);setVoidReason("");}} style={{fontSize:15}}>Cancel</button></div>
            </div>
          ):(
            <div>
              <div style={{fontSize:13,color:"#8899AA",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Recent sales</div>
              {histSales.length===0?<div style={{color:"#8A97A8",fontSize:15}}>No sales yet.</div>:(()=>{
                // Row renderer for one sale (keeps all actions)
                const saleRow=(s)=>(
                  <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #101B36",opacity:s.voided?0.45:1}}>
                    <div style={{flex:1}}><div style={{fontSize:15,fontWeight:500,textDecoration:s.voided?"line-through":"none"}}>{s.customer_name}</div><div style={{fontSize:13,color:"#8A97A8"}}>{s.receipt_no} · {initials(s.served_by)} · {s.payment_method}{s.voided?` · VOID: ${s.void_reason}`:""}</div></div>
                    <div style={{textAlign:"right",marginLeft:8}}><div style={{fontSize:15,fontWeight:600,color:s.voided?"#556677":"#F5C000"}}>{fmtK(Number(s.total))}</div><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:2}}>{!s.voided&&<button onClick={()=>{setReceipt(s);setShowHistory(false);}} style={{background:"none",border:"none",color:"#AEB9C7",fontSize:13,cursor:"pointer",padding:0}}>Receipt</button>}{!s.voided&&can(user,"users")&&canModify(s)&&<button onClick={()=>startExchange(s)} style={{background:"none",border:"none",color:"#E8A45B",fontSize:13,cursor:"pointer",padding:0}}>{Number(s.balance_due||0)>0?"Edit":"Exchange"}</button>}{!s.voided&&can(user,"void")&&(withinWindow(s.created_at)?<button onClick={()=>setVoidSale(s)} style={{background:"none",border:"none",color:"#E85B5B",fontSize:13,cursor:"pointer",padding:0}}>Void</button>:<span style={{fontSize:12,color:"#8A97A8"}}>🔒</span>)}</div></div>
                  </div>
                );
                const dayTotal=arr=>arr.filter(s=>!s.voided).reduce((n,s)=>n+Number(s.total),0);
                const toggle=k=>setHistOpen(x=>({...x,[k]:!x[k]}));
                const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
                const now=new Date(); const curMonth=now.toISOString().slice(0,7); const curYear=String(now.getFullYear());
                // Group sales by day
                const days={};
                histSales.forEach(s=>{ if(!days[s.date])days[s.date]=[]; days[s.date].push(s); });
                // Classify each day into: current month (show as days), past month this year (fold into month), past year (fold into year)
                const currentMonthDays=[]; const monthGroups={}; const yearGroups={};
                Object.keys(days).sort((a,b)=>b.localeCompare(a)).forEach(date=>{
                  const ym=date.slice(0,7); const y=date.slice(0,4);
                  if(ym===curMonth){ currentMonthDays.push(date); }
                  else if(y===curYear){ if(!monthGroups[ym])monthGroups[ym]=[]; monthGroups[ym].push(date); }
                  else { if(!yearGroups[y])yearGroups[y]=[]; yearGroups[y].push(date); }
                });
                const fmtDay=d=>{ const dt=new Date(d+"T00:00:00"); return dt.toLocaleDateString("en-KE",{weekday:"short",day:"2-digit",month:"short"}); };
                return (
                  <div>
                    {/* Current month: expand by day */}
                    {currentMonthDays.map(date=>(
                      <div key={date} style={{marginBottom:8}}>
                        <div onClick={()=>toggle(date)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8}}>
                          <span style={{fontSize:15,fontWeight:600,color:"#E8E2D4"}}>{histOpen[date]?"▾":"▸"} {fmtDay(date)}</span>
                          <span style={{fontSize:15,fontWeight:600,color:"#F5C000"}}>{fmtK(dayTotal(days[date]))}</span>
                        </div>
                        {histOpen[date]&&<div style={{padding:"0 10px"}}>{days[date].map(saleRow)}</div>}
                      </div>
                    ))}
                    {/* Past months this year: fold into month */}
                    {Object.keys(monthGroups).sort((a,b)=>b.localeCompare(a)).map(ym=>{
                      const dates=monthGroups[ym]; const mTotal=dates.reduce((n,d)=>n+dayTotal(days[d]),0);
                      return (
                        <div key={ym} style={{marginBottom:8}}>
                          <div onClick={()=>toggle(ym)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #24365C",borderRadius:8}}>
                            <span style={{fontSize:15,fontWeight:600,color:"#AEB9C7"}}>{histOpen[ym]?"▾":"▸"} {MONTHS[parseInt(ym.slice(5,7))-1]}</span>
                            <span style={{fontSize:15,fontWeight:600,color:"#F5C000"}}>{fmtK(mTotal)}</span>
                          </div>
                          {histOpen[ym]&&<div style={{padding:"4px 10px 0"}}>{dates.map(date=>(
                            <div key={date} style={{marginBottom:6}}>
                              <div onClick={()=>toggle(date)} style={{display:"flex",justifyContent:"space-between",cursor:"pointer",padding:"6px 0",borderBottom:"1px solid #101B36"}}>
                                <span style={{fontSize:14,color:"#AEB9C7"}}>{histOpen[date]?"▾":"▸"} {fmtDay(date)}</span>
                                <span style={{fontSize:14,color:"#8A97A8"}}>{fmtK(dayTotal(days[date]))}</span>
                              </div>
                              {histOpen[date]&&<div>{days[date].map(saleRow)}</div>}
                            </div>
                          ))}</div>}
                        </div>
                      );
                    })}
                    {/* Past years: fold into year */}
                    {Object.keys(yearGroups).sort((a,b)=>b.localeCompare(a)).map(y=>{
                      const dates=yearGroups[y]; const yTotal=dates.reduce((n,d)=>n+dayTotal(days[d]),0);
                      return (
                        <div key={y} style={{marginBottom:8}}>
                          <div onClick={()=>toggle(y)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"8px 10px",background:"#0A1128",border:"1px solid #2E4472",borderRadius:8}}>
                            <span style={{fontSize:15,fontWeight:700,color:"#E8E2D4"}}>{histOpen[y]?"▾":"▸"} {y}</span>
                            <span style={{fontSize:15,fontWeight:700,color:"#F5C000"}}>{fmtK(yTotal)}</span>
                          </div>
                          {histOpen[y]&&<div style={{padding:"4px 10px 0"}}>{dates.map(date=>(
                            <div key={date} style={{marginBottom:6}}>
                              <div onClick={()=>toggle(date)} style={{display:"flex",justifyContent:"space-between",cursor:"pointer",padding:"6px 0",borderBottom:"1px solid #101B36"}}>
                                <span style={{fontSize:14,color:"#AEB9C7"}}>{histOpen[date]?"▾":"▸"} {fmtDay(date)}</span>
                                <span style={{fontSize:14,color:"#8A97A8"}}>{fmtK(dayTotal(days[date]))}</span>
                              </div>
                              {histOpen[date]&&<div>{days[date].map(saleRow)}</div>}
                            </div>
                          ))}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
      {pendingSales.length>0&&(
        <div style={{background:"rgba(232,164,91,0.08)",border:"1px solid rgba(232,164,91,0.4)",borderRadius:8,padding:12,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setShowPending(x=>!x)}>
            <div><span style={{color:"#E8A45B",fontWeight:600,fontSize:15}}>Pending Balances</span><span style={{background:"rgba(232,164,91,0.2)",color:"#E8A45B",fontSize:13,padding:"2px 8px",borderRadius:100,marginLeft:8}}>{pendingSales.length}</span></div>
            <span style={{color:"#E8A45B"}}>{showPending?"▲":"▼"}</span>
          </div>
          {showPending&&(
            <div style={{marginTop:10}}>
              {addPaySale?(
                <div>
                  <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>{addPaySale.customer_name}</div>
                  {(addPaySale.items||[]).length>0&&(
                    <div style={{background:"transparent",border:"1px solid #2E4472",borderRadius:8,padding:"8px 11px",marginBottom:8}}>
                      <div style={{fontSize:12,color:"#8A97A8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Paying for</div>
                      {(addPaySale.items||[]).map((it,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:15,padding:"3px 0",borderBottom:i<(addPaySale.items||[]).length-1?"1px solid #1A2A4A":"none"}}>
                          <span style={{color:"#E8E2D4"}}>{it.name} <span style={{color:"#8A97A8"}}>x{it.qty}</span></span>
                          <span style={{color:"#F5C000",fontWeight:600}}>{fmtK(Number(it.qty)*Number(it.price))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(()=>{ const adj=Number(addPayAdj||0); const effTotal=Number(addPaySale.total)+adj; const effBal=Math.max(0,effTotal-Number(addPaySale.amount_paid||0)); return (
                  <div style={{fontSize:14,color:"#8899AA",marginBottom:10}}>Total {fmtK(effTotal)}{adj!==0?` (adj ${adj>0?"+":""}${adj})`:""} · Paid {fmtK(Number(addPaySale.amount_paid||0))} · <span style={{color:"#E8A45B",fontWeight:600}}>Balance {fmtK(effBal)}</span></div>
                  );})()}
                  <div className="field"><label>Amount received now (KSh)</label><input type="number" value={addPayAmt} onChange={e=>setAddPayAmt(e.target.value)} placeholder="0"/><button onClick={()=>{const adj=Number(addPayAdj||0);const effBal=Math.max(0,Number(addPaySale.total)+adj-Number(addPaySale.amount_paid||0));setAddPayAmt(String(effBal));}} style={{marginTop:6,background:"none",border:"1px solid #1A2A4A",borderRadius:5,color:"#8899AA",fontSize:13,padding:"5px 10px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Pay full balance</button></div>
                  {!can(user,"adjust")?null:!showAdj?<button onClick={()=>setShowAdj(true)} style={{background:"none",border:"1px dashed #24365C",borderRadius:6,color:"#8A97A8",fontSize:14,padding:"7px 12px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginBottom:12,width:"100%"}}>+ Price adjustment</button>:(
                    <div className="field" style={{background:"rgba(232,164,91,0.06)",border:"1px solid rgba(232,164,91,0.25)",borderRadius:8,padding:10}}>
                      <label>Price adjustment (KSh)</label>
                      <div style={{fontSize:13,color:"#8A97A8",marginBottom:6}}>Negative to knock off (goodwill), positive to add. Changes the sale total so the balance settles correctly.</div>
                      <input type="number" value={addPayAdj} onChange={e=>setAddPayAdj(e.target.value)} placeholder="e.g. -100"/>
                    </div>
                  )}
                  <div className="field"><label>Method</label><div className="tog"><button className={`tog-btn${addPayMethod==="mpesa"?" on":""}`} onClick={()=>setAddPayMethod("mpesa")}>M-Pesa</button><button className={`tog-btn${addPayMethod==="cash"?" on":""}`} onClick={()=>setAddPayMethod("cash")}>Cash</button></div></div>
                  {addPayMethod==="mpesa"&&<div className="field"><label>M-Pesa code</label><input value={addPayCode} onChange={e=>setAddPayCode(e.target.value.toUpperCase())} placeholder="e.g. QJK7X8Y9Z0" style={{fontFamily:"monospace"}}/></div>}
                  <div className="field"><label>Recorded by</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${addPayStaff===s?" on":""}`} onClick={()=>setAddPayStaff(s)}>{s.split(" ")[0]}</button>)}</div></div>
                  <div className="field"><label>Notes (optional)</label><input value={addPayNotes} onChange={e=>setAddPayNotes(e.target.value)} placeholder="e.g. Second instalment"/></div>
                  <div style={{display:"flex",gap:8}}><button className="btn-y" onClick={addPaymentToSale} disabled={addPaySaving} style={{flex:1,fontSize:15}}>{addPaySaving?"Saving...":"Record Payment"}</button><button className="btn-g" onClick={()=>setAddPaySale(null)} style={{fontSize:15}}>Cancel</button></div>
                </div>
              ):pendingSales.map(s=>(
                <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1A2A4A"}}>
                  <div><div style={{fontSize:15,fontWeight:500}}>{s.customer_name}</div><div style={{fontSize:13,color:"#8899AA"}}>{s.receipt_no} · Total {fmtK(Number(s.total))} · Paid {fmtK(Number(s.amount_paid||0))}</div></div>
                  <div style={{textAlign:"right"}}><div style={{color:"#E8A45B",fontSize:15,fontWeight:600}}>{fmtK(Number(s.balance_due))}</div><button className="btn-g" onClick={()=>setAddPaySale(s)} style={{fontSize:13,padding:"4px 10px",marginTop:4}}>Add payment</button></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{marginTop:6}}>
        <button className="btn-y" onClick={()=>openWiz(user.full_name)} style={{width:"100%",padding:16,fontSize:18}}>+ New Sale</button>
      </div>

      {wiz&&(
        <div className="wiz-overlay">
          <div className="wiz">
            <div className="wiz-hd">
              <div><div style={{fontSize:16,fontWeight:600,color:"#FFFFFF"}}>New Sale</div><div style={{fontSize:14,color:"#8899AA"}}>{staff.split(" ")[0]} · Step {step} of 3</div></div>
              <button onClick={closeWiz} style={{background:"none",border:"none",color:"#8899AA",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
            </div>
            <div className="wiz-steps">{[1,2,3].map(n=><div key={n} className={`wiz-dot${step>=n?" on":""}`}/>)}</div>
            <div className="wiz-body">
              {step===1&&(<>
                <div style={{fontSize:18,fontWeight:600,color:"#FFFFFF",marginBottom:14}}>Customer</div>
                <div style={{background:"transparent",border:"1px dashed #2E4472",borderRadius:8,padding:10,marginBottom:14}}>
                  <div style={{fontSize:13,color:"#8899AA",marginBottom:6}}>Paste the M-Pesa or bank SMS to auto-fill (optional)</div>
                  <textarea value={sms} onChange={e=>handleSms(e.target.value)} placeholder="Paste SMS here..." style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15,resize:"none",minHeight:52,fontFamily:"'DM Sans',sans-serif"}}/>
                  {parsed&&(parsed.code||parsed.amount>0)&&<div style={{fontSize:14,color:"#4CAF50",marginTop:4}}>{parsed.type==="sacco"?"Bank":"M-Pesa"} · {parsed.code||"no ref"} · {fmtK(parsed.amount)} · {parsed.name||"no name"}</div>}
                </div>
                <div className="field"><label>Customer name</label><input value={cName} onChange={e=>setCName(e.target.value)} placeholder="Full name" autoFocus/></div>
                <div className="field"><label>Phone (optional)</label><input value={cPhone} onChange={e=>setCPhone(e.target.value)} onBlur={e=>checkCredit(e.target.value)} placeholder="07XX XXX XXX" type="tel"/></div>
                {custCredit>0&&<div style={{background:"rgba(76,175,80,0.08)",border:"1px solid rgba(76,175,80,0.3)",borderRadius:8,padding:10,fontSize:14,color:"#4CAF50"}}>This customer holds {fmtK(custCredit)} store credit. It will be offered at payment.</div>}
              </>)}
              {step===2&&(<>
                <div style={{fontSize:18,fontWeight:600,color:"#FFFFFF",marginBottom:4}}>Items</div>
                <div style={{fontSize:14,color:"#8899AA",marginBottom:14}}>Search for a product by name or keyword.</div>
                {items.map(i=>(
                  <div key={i.id} style={{borderBottom:"1px solid #1A2A4A",padding:"6px 0 14px",marginBottom:12}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 28px",gap:6,marginBottom:7}}>
                      <ProductSearch user={user} stockRows={stockItems} value={i.name} onChange={v=>upItem(i.id,"name",v)} onPick={p=>setItems(x=>x.map(it=>{ if(it.id!==i.id) return it; const lp=listPriceOf(p); return {...it,name:p.name,quote:lp>0?String(lp):"",price:lp>0?String(lp):it.price}; }))} placeholder="Search product..." noAdd/>
                      <button onClick={()=>rmItem(i.id)} style={{background:"none",border:"none",color:"#E85B5B",cursor:"pointer",fontSize:18,paddingTop:6}}>x</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"0.7fr 1fr 1fr",gap:8}}>
                      <div><div style={{fontSize:13,color:"#A9B5C6",marginBottom:0}}>Qty</div><input type="number" value={i.qty} min={1} onChange={e=>upItem(i.id,"qty",e.target.value)} style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",fontSize:15,color:"#E8E2D4",textAlign:"center"}}/></div>
                      <div><div style={{fontSize:13,color:"#A9B5C6",marginBottom:0}}>Quoted (KSh)</div><input type="number" value={i.quote||""} min={0} onChange={e=>upQuote(i.id,e.target.value)} placeholder="0" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",fontSize:15,color:"#C2CBD6"}}/></div>
                      <div><div style={{fontSize:13,color:"#A9B5C6",marginBottom:0}}>Sold at (KSh)</div><input type="number" value={i.price} min={0} onChange={e=>upItem(i.id,"price",e.target.value)} placeholder="0" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",fontSize:15,color:"#FFFFFF"}}/></div>
                    </div>
                    {i.name&&Number(i.price)>0&&Number(i.qty)>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,fontSize:13}}><span style={{color:"#4CAF50"}}>{lineSavedUI(i)>0?`Discount ${fmtK(lineSavedUI(i))}`:""}</span><span style={{color:"#F5C000"}}>{fmtK(Number(i.qty)*Number(i.price))}</span></div>}
                  </div>
                ))}
                <button className="btn-g" onClick={addItem} style={{width:"100%",fontSize:15}}>+ Add another item</button>
                {total>0&&<div style={{textAlign:"right",marginTop:12,fontSize:18,fontWeight:600,color:"#F5C000"}}>Total {fmtK(total)}</div>}
              </>)}
              {step===3&&(<>
                <div style={{fontSize:18,fontWeight:600,color:"#FFFFFF",marginBottom:12}}>Payment</div>
                {can(user,"users")&&(
                  <div className="field"><label>Serving as</label><div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${staff===s?" on":""}`} onClick={()=>setStaff(s)}>{s.split(" ")[0]}</button>)}</div></div>
                )}
                <div style={{background:"transparent",border:"1px solid #2E4472",borderRadius:8,padding:12,marginBottom:14}}>
                  <div style={{fontSize:15,fontWeight:600,marginBottom:2}}>{cName}{cPhone?<span style={{color:"#8899AA",fontWeight:400}}> · {cPhone}</span>:null}</div>
                  {validItems.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#8899AA",padding:"2px 0"}}><span>{i.name} x{i.qty}</span><span>{lineSavedUI(i)>0&&<span style={{textDecoration:"line-through",marginRight:6,color:"#5B6B85"}}>{fmtK(Number(i.qty)*Number(i.quote))}</span>}{fmtK(Number(i.qty)*Number(i.price))}</span></div>)}
                  {savedUI(validItems)>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#4CAF50",padding:"2px 0"}}><span>Client saves</span><span>{fmtK(savedUI(validItems))}</span></div>}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:600,color:"#F5C000",marginTop:6,paddingTop:6,borderTop:"1px solid #1A2A4A"}}><span>Total</span><span>{fmtK(total)}</span></div>
                </div>
                {custCredit>0&&(
                  <div style={{background:"rgba(76,175,80,0.08)",border:"1px solid rgba(76,175,80,0.3)",borderRadius:8,padding:12,marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontSize:15,fontWeight:600,color:"#4CAF50"}}>Store credit: {fmtK(custCredit)}</div><div style={{fontSize:13,color:"#8899AA"}}>Apply {fmtK(Math.min(custCredit,total))} to this sale</div></div>
                      <button onClick={()=>setUseCredit(u=>!u)} style={{background:useCredit?"#4CAF50":"transparent",border:"1px solid #4CAF50",color:useCredit?"#050A1F":"#4CAF50",borderRadius:6,padding:"7px 14px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{useCredit?"Applied":"Apply"}</button>
                    </div>
                  </div>
                )}
                <div className="field"><label>Payment type</label><div className="tog"><button className={`tog-btn${payType==="full"?" on":""}`} onClick={()=>setPayType("full")}>Full</button><button className={`tog-btn${payType==="instalment"?" on":""}`} onClick={()=>setPayType("instalment")}>Instalment</button></div></div>
                {payType==="instalment"&&<div className="field" style={{background:"rgba(232,164,91,0.08)",border:"1px solid rgba(232,164,91,0.3)",borderRadius:8,padding:12}}><label style={{color:"#E8A45B"}}>Paying now (KSh)</label><input type="number" value={initPay} onChange={e=>setInitPay(e.target.value)} placeholder="Amount"/>{initPay&&<div style={{fontSize:14,color:"#E8A45B",marginTop:6}}>Balance: {fmtK(Math.max(0,total-Number(initPay)))}</div>}</div>}
                <div className="field"><label>Method</label><div className="tog"><button className={`tog-btn${pay==="mpesa"?" on":""}`} onClick={()=>setPay("mpesa")}>M-Pesa</button><button className={`tog-btn${pay==="cash"?" on":""}`} onClick={()=>setPay("cash")}>Cash</button><button className={`tog-btn${pay==="split"?" on":""}`} onClick={()=>setPay("split")}>Split</button></div></div>
                {pay==="mpesa"&&<div className="field"><label>M-Pesa code</label><input value={mpesaCode} onChange={e=>setMpesaCode(e.target.value.toUpperCase())} placeholder="e.g. QJK7X8Y9Z0" style={{fontFamily:"monospace",letterSpacing:"0.05em"}}/></div>}
                {pay==="split"&&(()=>{ const due=payType==="instalment"?Number(initPay||0):total; const c=Number(cashPart||0),m=Number(mpesaPart||0),sum=c+m; return (
                  <div style={{background:"rgba(245,192,0,0.06)",border:"1px solid rgba(245,192,0,0.25)",borderRadius:8,padding:12,marginBottom:12}}>
                    <div style={{fontSize:14,color:"#8899AA",marginBottom:8}}>Paying {fmtK(due)} across both. Amounts must add up.</div>
                    <div className="field"><label>Cash part (KSh)</label><input type="number" value={cashPart} onChange={e=>setCashPart(e.target.value)} placeholder="0"/></div>
                    <div className="field"><label>M-Pesa part (KSh)</label><input type="number" value={mpesaPart} onChange={e=>setMpesaPart(e.target.value)} placeholder="0"/></div>
                    <div className="field"><label>M-Pesa code</label><input value={mpesaCode} onChange={e=>setMpesaCode(e.target.value.toUpperCase())} placeholder="e.g. QJK7X8Y9Z0" style={{fontFamily:"monospace"}}/></div>
                    <div style={{fontSize:14,fontWeight:600,color:sum===due?"#4CAF50":"#E85B5B"}}>{sum===due?"Balanced ✓":sum<due?`Short by ${fmtK(due-sum)}`:`Over by ${fmtK(sum-due)}`}</div>
                  </div>
                );})()}
                <div className="field"><label>Notes (optional)</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Deliver Saturday"/></div>
              </>)}
              {err&&<div style={{color:"#E85B5B",fontSize:15,marginTop:8}}>{err}</div>}
            </div>
            <div className="wiz-ft">
              {step>1&&<button className="btn-g" onClick={()=>{setErr("");setStep(step-1);}} style={{fontSize:15}}>Back</button>}
              {step<3&&<button className="btn-y" onClick={nextStep} style={{flex:1,fontSize:16}}>Next</button>}
              {step===3&&<button className="btn-y" onClick={completeSale} disabled={saving} style={{flex:1,fontSize:16}}>Complete</button>}
            </div>
            {confirmSale&&(()=>{ const pl=salePlan(); const row=(l,v,c)=><div style={{display:"flex",justifyContent:"space-between",fontSize:15,padding:"3px 0",color:c||"#E8E2D4"}}><span style={{color:"#8A97A8"}}>{l}</span><span>{v}</span></div>; return (
              <div onClick={()=>{ if(!saving) setConfirmSale(false); }} style={{position:"fixed",inset:0,background:"rgba(5,10,31,0.88)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
                <div onClick={e=>e.stopPropagation()} style={{background:"#0A1128",border:"1px solid #2E4472",borderTop:"3px solid #F5C000",borderRadius:12,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto",padding:18}}>
                  <div style={{fontSize:18,fontWeight:600,color:"#FFFFFF",marginBottom:2}}>Confirm sale</div>
                  <div style={{fontSize:14,color:"#8A97A8",marginBottom:12}}>Check everything before recording. Stock and money update when you confirm.</div>
                  <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>{cName}{cPhone?<span style={{color:"#8A97A8",fontWeight:400}}> · {cPhone}</span>:null}</div>
                  <div style={{borderTop:"1px solid #1A2A4A",borderBottom:"1px solid #1A2A4A",padding:"6px 0",marginBottom:8}}>
                    {validItems.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",fontSize:15,padding:"3px 0"}}><span>{i.name} x{i.qty}</span><span>{lineSavedUI(i)>0&&<span style={{textDecoration:"line-through",marginRight:6,color:"#5B6B85"}}>{fmtK(Number(i.qty)*Number(i.quote))}</span>}{fmtK(Number(i.qty)*Number(i.price))}</span></div>)}
                    {savedUI(validItems)>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:15,padding:"3px 0",color:"#4CAF50"}}><span>Client saves</span><span>{fmtK(savedUI(validItems))}</span></div>}
                  </div>
                  {row("Total",fmtK(total),"#F5C000")}
                  {pl.creditToUse>0&&row("Store credit applied","- "+fmtK(pl.creditToUse),"#4CAF50")}
                  {row(payType==="instalment"?"Paying now (instalment)":"Paying now",fmtK(pl.amtPaid))}
                  {pl.cPart>0&&row("Cash",fmtK(pl.cPart))}
                  {pl.mPart>0&&row("M-Pesa"+(mpesaCode?" · "+mpesaCode.toUpperCase():""),fmtK(pl.mPart))}
                  {pl.balDue>0&&row("Balance owed",fmtK(pl.balDue),"#E8A45B")}
                  {row("Served by",staff)}
                  {notes&&row("Notes",notes)}
                  <div style={{display:"flex",gap:8,marginTop:16}}>
                    <button className="btn-g" onClick={()=>setConfirmSale(false)} disabled={saving} style={{fontSize:15}}>Edit</button>
                    <button className="btn-g" onClick={()=>genReceipt(false)} disabled={saving} style={{flex:1,fontSize:15}}>{saving?"Saving...":"Record Sale"}</button>
                    <button className="btn-y" onClick={()=>genReceipt(true)} disabled={saving} style={{flex:1,fontSize:15}}>{saving?"Saving...":"Record + Receipt"}</button>
                  </div>
                </div>
              </div>
            );})()}
          </div>
        </div>
      )}
    </div>
  );
}

