import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const SB_URL = "https://pdfadcnrxlojuxjqtzil.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZmFkY25yeGxvanV4anF0emlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMTQ0MzksImV4cCI6MjEwMjg5MDQzOX0.1gRq0MWGc6EFOtm5-rma4Fo1shVSWIW8kFDX-Np6CIM";
const APP_PW = "GwituMucii@22";

const C = { navy:"#050A1F",mid:"#0A1128",light:"#0F1A3A",yellow:"#F5C000",white:"#FFFFFF",bg:"#F5F5F5",muted:"#8899AA",dark:"#556677",green:"#4CAF50",red:"#E85B5B",orange:"#E8A45B" };
const STAFF = ["Burton Kariuki","Martin Ruguru"];
const EXP_CATS = ["Rent","Transport","Stock Purchase","Utilities","Marketing","Staff","Other"];
const CAT_OPTS = [{id:"living",label:"Living Room"},{id:"bedroom",label:"Bedroom"},{id:"decor",label:"Decor"},{id:"other",label:"Other"}];
const catLabel = id => ({living:"Living Room",bedroom:"Bedroom",decor:"Decor",other:"Other"}[id]||id);

const H = { "apikey":SB_KEY, "Authorization":`Bearer ${SB_KEY}`, "Content-Type":"application/json", "Prefer":"return=representation" };

const sb = {
  get: async (table, params="") => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, {headers:H});
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  },
  post: async (table, data) => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {method:"POST",headers:H,body:JSON.stringify(data)});
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  },
  patch: async (table, id, data) => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {method:"PATCH",headers:H,body:JSON.stringify(data)});
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  },
  del: async (table, id) => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {method:"DELETE",headers:H});
    if(!r.ok) throw new Error("Delete failed");
  }
};

function parseMpesa(sms) {
  const s = sms.trim();

  // Nawiri SACCO paybill deposit message
  // "KES 4,000.00 has been credited to your account No: ... Detail: M-Pesa Paybill Deposit > [254... > 505368 > 12091 | James]"
  if (/has been credited to your account/i.test(s)) {
    const amtM = s.match(/KES\s*([\d,]+\.?\d*)\s+has been credited/i);
    const nameM = s.match(/\|\s*([A-Za-z][A-Za-z ]+?)\s*\]/);
    const phoneM = s.match(/\[\s*(254\d+)/);
    const refM = s.match(/>\s*(\d+)\s*\|\s*[A-Za-z]/);
    let phone = "";
    if (phoneM) {
      // Convert 254XXXXXXXXX to 07XXXXXXXXX
      const intl = phoneM[1].replace(/X/gi, "0");
      phone = "0" + intl.slice(3);
    }
    return {
      code: refM ? refM[1] : "",
      amount: amtM ? Number(amtM[1].replace(/,/g,"")) : 0,
      name: nameM ? nameM[1].trim() : "",
      phone,
      type: "sacco"
    };
  }

  // Standard M-Pesa message
  // "QJK7X8Y9Z0 Confirmed. You have received Ksh1,000 from JOHN DOE 0712345678..."
  const codeM = s.match(/^([A-Z0-9]{8,12})\s/);
  const amtM = s.match(/(?:received|paid|send|sent)\s+Ksh\s*([\d,]+)/i) || s.match(/Ksh\s*([\d,]+)/i);
  const nameM = s.match(/from\s+([A-Z][A-Z ]+?)\s+(?:0[679]\d{8}|\d{4,})/i);
  const phoneM = s.match(/(0[679]\d{8})/);
  return {
    code: codeM ? codeM[1] : "",
    amount: amtM ? Number(amtM[1].replace(/,/g,"")) : 0,
    name: nameM ? nameM[1].trim() : "",
    phone: phoneM ? phoneM[1] : "",
    type: "mpesa"
  };
}

const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0} body{font-family:'DM Sans',sans-serif;background:#050A1F;color:#E8E2D4} input,select,textarea{outline:none;font-family:'DM Sans',sans-serif}
    .field{margin-bottom:14px} .field label{display:block;font-size:12px;color:#8899AA;margin-bottom:4px;letter-spacing:0.05em;text-transform:uppercase}
    .field input,.field select,.field textarea{width:100%;background:#0A1128;border:1px solid #1A2A4A;border-radius:6px;padding:10px 12px;color:#E8E2D4;font-size:14px}
    .field textarea{resize:vertical;min-height:60px}
    .tog{display:flex;gap:6px} .tog-btn{flex:1;padding:8px 4px;font-size:13px;border:1px solid #1A2A4A;border-radius:6px;background:#0A1128;color:#8899AA;cursor:pointer;transition:all 0.15s;text-align:center}
    .tog-btn.on{background:rgba(245,192,0,0.15);border-color:#F5C000;color:#F5C000;font-weight:600}
    .card{background:#0A1128;border:1px solid #1A2A4A;border-radius:10px;padding:16px;margin-bottom:12px}
    .btn-y{background:#F5C000;color:#050A1F;border:none;padding:12px 20px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background 0.15s}
    .btn-y:hover{background:#E6B400} .btn-y:disabled{background:#555;color:#999;cursor:not-allowed}
    .btn-g{background:transparent;color:#8899AA;border:1px solid #1A2A4A;padding:10px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif}
    .btn-g:hover{border-color:#8899AA;color:#E8E2D4}
    .badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:100px} .b-y{background:rgba(245,192,0,0.15);color:#F5C000} .b-g{background:rgba(76,175,80,0.15);color:#4CAF50} .b-r{background:rgba(232,91,91,0.15);color:#E85B5B}
    .stat{background:#0A1128;border:1px solid #1A2A4A;border-radius:10px;padding:14px;text-align:center}
    .stat-n{font-size:24px;font-weight:600;margin-bottom:2px} .stat-l{font-size:11px;color:#8899AA;text-transform:uppercase;letter-spacing:0.08em}
    .nav{display:flex;background:#0A1128;border-top:1px solid #1A2A4A;position:fixed;bottom:0;left:0;right:0;z-index:50}
    .nav-btn{flex:1;padding:10px 4px 8px;background:none;border:none;color:#556677;cursor:pointer;font-size:10px;letter-spacing:0.05em;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:'DM Sans',sans-serif;transition:color 0.15s}
    .nav-btn .ni{font-size:20px} .nav-btn.on{color:#F5C000}
    .ir{display:grid;grid-template-columns:1fr 50px 80px 80px 28px;gap:5px;align-items:center;margin-bottom:7px}
    .ir input{font-size:12px;padding:7px 8px} .es{text-align:center;padding:3rem 1rem;color:#556677;font-size:14px}
    .rc-logo{font-size:16px;font-weight:600;letter-spacing:0.1em;color:#050A1F} .rc-sub{font-size:10px;color:#888;margin-top:1px}
    .rc-row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0} .rc-lb{color:#666} .rc-vl{color:#111;font-weight:500}
    .itbl{width:100%;font-size:11px;border-collapse:collapse;margin:6px 0} .itbl th{color:#888;font-weight:500;text-align:left;padding:3px 0;border-bottom:0.5px solid #ddd}
    .itbl td{padding:3px 0;vertical-align:top} .itbl td:last-child{text-align:right;white-space:nowrap}
    .rc-ttl{display:flex;justify-content:space-between;font-size:14px;font-weight:600;padding:6px 0;border-top:0.5px solid #ddd;margin-top:3px}
    .rc-ftr{text-align:center;font-size:10px;color:#888;margin-top:10px;padding-top:10px;border-top:0.5px solid #ddd;line-height:1.7}
    @media print{.nav,.np{display:none!important} .rc-wrap{background:#fff;color:#111;border:none;border-radius:0;padding:0}}
  `}</style>
);

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [tab, setTab] = useState("sale");

  const tryLogin = () => {
    if(pw.trim() === APP_PW.trim()) { setAuthed(true); setPwErr(""); }
    else { setPwErr("Wrong password. Try again."); }
  };

  if(!authed) return (
    <>
    <GS/>
    <div style={{minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:"center",padding:24}}>
      <div style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:12,padding:"36px 28px",maxWidth:360,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:24,fontWeight:600,color:"#F5C000",letterSpacing:"0.1em"}}>KARU</div>
          <div style={{fontSize:13,color:"#8899AA",marginTop:4}}>Accounts System</div>
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setPwErr("");}} onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="Enter password"/>
        </div>
        {pwErr && <div style={{color:"#E85B5B",fontSize:13,marginBottom:12}}>{pwErr}</div>}
        <button className="btn-y" onClick={tryLogin} style={{width:"100%"}}>Sign In</button>
      </div>
    </div>
    </>
  );

  return (
    <>
    <GS/>
    <div style={{maxWidth:500,margin:"0 auto",paddingBottom:72}}>
      <div style={{padding:"16px 16px 0",borderBottom:"1px solid #0A1128",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#050A1F",position:"sticky",top:0,zIndex:40}}>
        <span style={{fontSize:16,fontWeight:600,color:"#F5C000",letterSpacing:"0.08em"}}>KARU</span>
        <span style={{fontSize:12,color:"#556677"}}>Accounts</span>
        <span style={{fontSize:12,color:"#556677"}}>{new Date().toLocaleDateString("en-KE",{day:"2-digit",month:"short"})}</span>
      </div>
      <div style={{padding:16}}>
        {tab==="sale" && <SaleTab/>}
        {tab==="stock" && <StockTab/>}
        {tab==="expenses" && <ExpensesTab/>}
        {tab==="reports" && <ReportsTab/>}
      </div>
    </div>
    <nav className="nav">
      {[["sale","Sale","💰"],["stock","Stock","📦"],["expenses","Expenses","🧾"],["reports","Reports","📊"]].map(([id,label,icon])=>(
        <button key={id} className={`nav-btn${tab===id?" on":""}`} onClick={()=>setTab(id)}>
          <span className="ni">{icon}</span>{label}
        </button>
      ))}
    </nav>
    </>
  );
}


function SaleTab() {
  const [sms, setSms] = useState("");
  const [parsed, setParsed] = useState(null);
  const [staff, setStaff] = useState("Burton Kariuki");
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [items, setItems] = useState([{id:1,name:"",qty:1,price:""}]);
  const [pay, setPay] = useState("mpesa");
  const [mpesaCode, setMpesaCode] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const handleSms = (v) => {
    setSms(v);
    if(v.trim().length > 20) {
      const p = parseMpesa(v);
      if(p.amount > 0 || p.name || p.code) {
        setParsed(p);
        if(p.name) setCName(p.name);
        if(p.phone) setCPhone(p.phone);
        if(p.code) setMpesaCode(p.code);
        if(p.amount > 0) {
          // Auto-add a single item row with the amount if items are empty
          setItems(prev => {
            const hasContent = prev.some(i => i.name || i.price);
            if(!hasContent) return [{id:Date.now(),name:"",qty:1,price:String(p.amount)}];
            return prev;
          });
        }
        setPay("mpesa");
      }
    }
  };

  const addItem = () => setItems(x=>[...x,{id:Date.now(),name:"",qty:1,price:""}]);
  const rmItem = (id) => setItems(x=>x.filter(i=>i.id!==id));
  const upItem = (id,f,v) => setItems(x=>x.map(i=>i.id===id?{...i,[f]:v}:i));

  const genReceipt = async () => {
    if(!cName.trim()){setErr("Customer name required.");return;}
    const vi = items.filter(i=>i.name&&Number(i.price)>0);
    if(!vi.length){setErr("Add at least one item.");return;}
    if(pay==="mpesa"&&!mpesaCode.trim()){setErr("M-Pesa code required.");return;}
    setSaving(true); setErr("");
    try {
      const now = new Date();
      const date = now.toISOString().split("T")[0];
      const time_str = now.toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit",hour12:true});
      const trips = await sb.get("karu_sales","select=receipt_no&order=created_at.desc&limit=1");
      const lastNo = trips.length ? parseInt(trips[0].receipt_no.split("-").pop()||"0") : 0;
      const receipt_no = `KARU-${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,"0")}-${String(lastNo+1).padStart(3,"0")}`;
      const total = vi.reduce((s,i)=>s+(Number(i.qty)*Number(i.price)),0);
      const data = { receipt_no, date, time_str, served_by:staff, customer_name:cName, customer_phone:cPhone, items:vi, payment_method:pay==="mpesa"?"M-Pesa":"Cash", mpesa_code:mpesaCode.toUpperCase(), total, notes };
      await sb.post("karu_sales", data);
      setReceipt(data);
    } catch(e) { setErr("Save failed: "+e.message); }
    setSaving(false);
  };

  const shareWA = () => {
    const r = receipt;
    const il = r.items.map(i=>`  ${i.name} x${i.qty} - KSh ${(Number(i.qty)*Number(i.price)).toLocaleString()}`).join("\n");
    const m = `*KARU FURNITURE*\n*Receipt ${r.receipt_no}*\n\nDate: ${r.date}  ${r.time_str}\nServed by: ${r.served_by}\n\nCustomer: ${r.customer_name}${r.customer_phone?"\nPhone: "+r.customer_phone:""}\n\n*ITEMS*\n${il}\n\n*TOTAL: KSh ${r.total.toLocaleString()}*\nPayment: ${r.payment_method}${r.mpesa_code?"\nM-Pesa Code: "+r.mpesa_code:""}${r.notes?"\nNote: "+r.notes:""}\n\nThank you - KARU Furniture\nOff Kihara-Gachie-Karura Rd\n0720 772 866`;
    window.open("https://wa.me/?text="+encodeURIComponent(m),"_blank");
  };

  if(receipt) return (
    <div>
      <div className="rc-wrap" style={{background:"#fff",color:"#111",borderRadius:10,padding:20,marginBottom:16}}>
        <div style={{textAlign:"center",marginBottom:14,paddingBottom:14,borderBottom:"0.5px solid #ddd"}}>
          <div className="rc-logo">KARU FURNITURE</div>
          <div className="rc-sub">Off Kihara-Gachie-Karura Rd, Nairobi</div>
          <div className="rc-sub">0720 772 866</div>
        </div>
        <div style={{marginBottom:10}}>
          <div className="rc-row"><span className="rc-lb">Receipt</span><span className="rc-vl" style={{fontFamily:"monospace",fontSize:11}}>{receipt.receipt_no}</span></div>
          <div className="rc-row"><span className="rc-lb">Date</span><span className="rc-vl">{receipt.date}</span></div>
          <div className="rc-row"><span className="rc-lb">Time</span><span className="rc-vl">{receipt.time_str}</span></div>
          <div className="rc-row"><span className="rc-lb">Served by</span><span className="rc-vl">{receipt.served_by}</span></div>
        </div>
        <div style={{padding:"8px 0",borderTop:"0.5px solid #ddd",marginBottom:8}}>
          <div className="rc-row"><span className="rc-lb">Customer</span><span className="rc-vl">{receipt.customer_name}</span></div>
          {receipt.customer_phone&&<div className="rc-row"><span className="rc-lb">Phone</span><span className="rc-vl">{receipt.customer_phone}</span></div>}
        </div>
        <table className="itbl">
          <thead><tr><th>Item</th><th style={{textAlign:"center"}}>Qty</th><th style={{textAlign:"right"}}>Unit</th><th style={{textAlign:"right"}}>Total</th></tr></thead>
          <tbody>{receipt.items.map((i,idx)=><tr key={idx}><td style={{paddingRight:4}}>{i.name}</td><td style={{textAlign:"center"}}>{i.qty}</td><td style={{textAlign:"right"}}>KSh {Number(i.price).toLocaleString()}</td><td style={{textAlign:"right"}}>KSh {(Number(i.qty)*Number(i.price)).toLocaleString()}</td></tr>)}</tbody>
        </table>
        <div className="rc-ttl"><span>Total</span><span>KSh {receipt.total.toLocaleString()}</span></div>
        <div style={{marginTop:8}}>
          <div className="rc-row"><span className="rc-lb">Payment</span><span className="rc-vl">{receipt.payment_method}</span></div>
          {receipt.mpesa_code&&<div className="rc-row"><span className="rc-lb">M-Pesa Code</span><span className="rc-vl" style={{fontFamily:"monospace"}}>{receipt.mpesa_code}</span></div>}
          {receipt.notes&&<div className="rc-row"><span className="rc-lb">Notes</span><span className="rc-vl">{receipt.notes}</span></div>}
        </div>
        <div className="rc-ftr">Thank you for shopping at KARU Furniture<br/>karufurniture.netlify.app</div>
      </div>
      <div style={{display:"flex",gap:8}} className="np">
        <button className="btn-y" onClick={shareWA} style={{flex:1}}>Share on WhatsApp</button>
        <button className="btn-g" onClick={()=>window.print()}>Print</button>
        <button className="btn-g" onClick={()=>{setReceipt(null);setCName("");setCPhone("");setMpesaCode("");setNotes("");setSms("");setParsed(null);setItems([{id:1,name:"",qty:1,price:""}]);}}>New</button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:12,marginBottom:16}}>
        <div style={{fontSize:12,color:"#8899AA",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Paste M-Pesa SMS to auto-fill</div>
        <textarea value={sms} onChange={e=>handleSms(e.target.value)} placeholder="Paste the M-Pesa confirmation SMS here..." style={{width:"100%",background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"8px 10px",color:"#E8E2D4",fontSize:13,resize:"none",minHeight:60,fontFamily:"'DM Sans',sans-serif"}}/>
        {parsed&&(parsed.code||parsed.amount>0)&&<div style={{fontSize:12,color:"#4CAF50",marginTop:4}}>
          {parsed.type==="sacco"?"Nawiri SACCO":"M-Pesa"} — Ref: {parsed.code||"n/a"} | KSh {parsed.amount.toLocaleString()} | {parsed.name||"Name not detected"}{parsed.phone?" | "+parsed.phone:""}
        </div>}
      </div>
      <div className="field">
        <label>Served by</label>
        <div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${staff===s?" on":""}`} onClick={()=>setStaff(s)}>{s.split(" ")[0]}</button>)}</div>
      </div>
      <div className="field"><label>Customer name</label><input value={cName} onChange={e=>setCName(e.target.value)} placeholder="Full name"/></div>
      <div className="field"><label>Phone (optional)</label><input value={cPhone} onChange={e=>setCPhone(e.target.value)} placeholder="07XX XXX XXX" type="tel"/></div>
      <div className="field">
        <label>Items</label>
        <div style={{fontSize:11,color:"#556677",marginBottom:6,display:"grid",gridTemplateColumns:"1fr 50px 80px 80px 28px",gap:5,paddingBottom:4,borderBottom:"1px solid #1A2A4A"}}>
          <span>Name</span><span style={{textAlign:"center"}}>Qty</span><span style={{textAlign:"right"}}>Unit KSh</span><span style={{textAlign:"right"}}>Total</span><span/>
        </div>
        {items.map(i=>(
          <div key={i.id} className="ir">
            <input value={i.name} onChange={e=>upItem(i.id,"name",e.target.value)} placeholder="Item"/>
            <input type="number" value={i.qty} min={1} onChange={e=>upItem(i.id,"qty",e.target.value)} style={{textAlign:"center"}}/>
            <input type="number" value={i.price} min={0} onChange={e=>upItem(i.id,"price",e.target.value)} placeholder="0" style={{textAlign:"right"}}/>
            <div style={{textAlign:"right",fontSize:12,color:"#F5C000",padding:"7px 0"}}>{i.price&&i.qty?(Number(i.qty)*Number(i.price)).toLocaleString():""}</div>
            <button onClick={()=>rmItem(i.id)} style={{background:"none",border:"none",color:"#E85B5B",cursor:"pointer",fontSize:16,lineHeight:1}}>x</button>
          </div>
        ))}
        <button className="btn-g" onClick={addItem} style={{width:"100%",marginTop:4,fontSize:13}}>+ Add item</button>
        {items.filter(i=>i.price&&i.qty).length>0&&<div style={{textAlign:"right",marginTop:8,fontSize:14,fontWeight:600,color:"#F5C000"}}>Total: KSh {items.reduce((s,i)=>s+(Number(i.qty||0)*Number(i.price||0)),0).toLocaleString()}</div>}
      </div>
      <div className="field">
        <label>Payment</label>
        <div className="tog">
          <button className={`tog-btn${pay==="mpesa"?" on":""}`} onClick={()=>setPay("mpesa")}>M-Pesa</button>
          <button className={`tog-btn${pay==="cash"?" on":""}`} onClick={()=>setPay("cash")}>Cash</button>
        </div>
      </div>
      {pay==="mpesa"&&<div className="field"><label>M-Pesa code</label><input value={mpesaCode} onChange={e=>setMpesaCode(e.target.value.toUpperCase())} placeholder="e.g. QJK7X8Y9Z0" style={{fontFamily:"monospace",letterSpacing:"0.05em"}}/></div>}
      <div className="field"><label>Notes (optional)</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Balance pending"/></div>
      {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:12}}>{err}</div>}
      <button className="btn-y" onClick={genReceipt} disabled={saving} style={{width:"100%",padding:14}}>{saving?"Saving...":"Generate Receipt"}</button>
    </div>
  );
}


function StockTab() {
  const [view, setView] = useState("list");
  const [trips, setTrips] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState({date:new Date().toISOString().split("T")[0],notes:"",created_by:"Burton Kariuki"});
  const [tripItems, setTripItems] = useState([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  useEffect(()=>{ loadData(); },[]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [t,s] = await Promise.all([
        sb.get("karu_trips","select=*&order=created_at.desc"),
        sb.get("karu_stock","select=*&order=created_at.desc")
      ]);
      setTrips(t); setStock(s);
    } catch(e){ console.error(e); }
    setLoading(false);
  };

  const addTripItem = () => setTripItems(x=>[...x,{id:Date.now(),name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
  const rmTripItem = (id) => setTripItems(x=>x.filter(i=>i.id!==id));
  const upTripItem = (id,f,v) => setTripItems(x=>x.map(i=>i.id===id?{...i,[f]:v}:i));

  const saveTrip = async () => {
    const vi = tripItems.filter(i=>i.name&&Number(i.unit_cost)>0);
    if(!vi.length){setErr("Add at least one item with name and cost.");return;}
    setSaving(true); setErr("");
    try {
      const tripNo = `KARU-TRIP-${String(trips.length+1).padStart(3,"0")}`;
      const totalCost = vi.reduce((s,i)=>s+(Number(i.qty_in)*Number(i.unit_cost)),0);
      const [newTrip] = await sb.post("karu_trips",{trip_no:tripNo,date:trip.date,notes:trip.notes,total_cost:totalCost,created_by:trip.created_by});
      const stockItems = vi.map(i=>({
        trip_id:newTrip.id, trip_no:tripNo, name:i.name, category:i.category,
        qty_in:Number(i.qty_in), qty_sold:0, unit_cost:Number(i.unit_cost),
        selling_price:Number(i.selling_price||0), date_in:trip.date
      }));
      await sb.post("karu_stock", stockItems);
      await loadData();
      setView("list");
      setTripItems([{id:1,name:"",category:"living",qty_in:1,unit_cost:"",selling_price:""}]);
      setTrip({date:new Date().toISOString().split("T")[0],notes:"",created_by:"Burton Kariuki"});
    } catch(e){ setErr("Save failed: "+e.message); }
    setSaving(false);
  };

  const filteredStock = filterCat==="all"?stock:stock.filter(s=>s.category===filterCat);
  const totalStockValue = stock.reduce((s,i)=>s+((i.qty_in-i.qty_sold)*i.unit_cost),0);
  const totalItems = stock.reduce((s,i)=>s+(i.qty_in-i.qty_sold),0);

  if(view==="new") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button className="btn-g" onClick={()=>setView("list")}>Back</button>
        <div style={{fontSize:16,fontWeight:600}}>New Sourcing Trip</div>
        <div className="badge b-y">KARU-TRIP-{String(trips.length+1).padStart(3,"0")}</div>
      </div>
      <div className="field"><label>Date</label><input type="date" value={trip.date} onChange={e=>setTrip(x=>({...x,date:e.target.value}))}/></div>
      <div className="field">
        <label>Recorded by</label>
        <div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${trip.created_by===s?" on":""}`} onClick={()=>setTrip(x=>({...x,created_by:s}))}>{s.split(" ")[0]}</button>)}</div>
      </div>
      <div className="field"><label>Notes (optional)</label><input value={trip.notes} onChange={e=>setTrip(x=>({...x,notes:e.target.value}))} placeholder="e.g. Gachie sourcing run"/></div>
      <div className="field">
        <label>Items purchased</label>
        <div style={{fontSize:11,color:"#556677",marginBottom:6,display:"grid",gridTemplateColumns:"1fr 50px 80px 80px 28px",gap:5,paddingBottom:4,borderBottom:"1px solid #1A2A4A"}}>
          <span>Name</span><span style={{textAlign:"center"}}>Qty</span><span>Cost ea.</span><span>Sell at</span><span/>
        </div>
        {tripItems.map(i=>(
          <div key={i.id} style={{marginBottom:10,background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:8,padding:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 28px",gap:6,marginBottom:6}}>
              <input value={i.name} onChange={e=>upTripItem(i.id,"name",e.target.value)} placeholder="Item name (e.g. 3+1+1 Sofa Set)" style={{background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"8px 10px",color:"#E8E2D4",fontSize:13}}/>
              <button onClick={()=>rmTripItem(i.id)} style={{background:"none",border:"none",color:"#E85B5B",cursor:"pointer",fontSize:16}}>x</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
              <select value={i.category} onChange={e=>upTripItem(i.id,"category",e.target.value)} style={{background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"8px 10px",color:"#E8E2D4",fontSize:12}}>
                {CAT_OPTS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <input type="number" value={i.qty_in} min={1} onChange={e=>upTripItem(i.id,"qty_in",e.target.value)} placeholder="Qty" style={{background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"8px 10px",color:"#E8E2D4",fontSize:12,textAlign:"center"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <input type="number" value={i.unit_cost} onChange={e=>upTripItem(i.id,"unit_cost",e.target.value)} placeholder="Cost per unit (KSh)" style={{background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"8px 10px",color:"#E8E2D4",fontSize:12}}/>
              <input type="number" value={i.selling_price} onChange={e=>upTripItem(i.id,"selling_price",e.target.value)} placeholder="Selling price (KSh)" style={{background:"#050A1F",border:"1px solid #1A2A4A",borderRadius:6,padding:"8px 10px",color:"#E8E2D4",fontSize:12}}/>
            </div>
            {i.unit_cost&&i.qty_in&&<div style={{fontSize:11,color:"#8899AA",marginTop:6}}>Subtotal: KSh {(Number(i.qty_in)*Number(i.unit_cost)).toLocaleString()}{i.selling_price&&i.unit_cost?` | Margin: ${Math.round((1-i.unit_cost/i.selling_price)*100)}%`:""}</div>}
          </div>
        ))}
        <button className="btn-g" onClick={addTripItem} style={{width:"100%",marginTop:4}}>+ Add item</button>
        {tripItems.filter(i=>i.unit_cost&&i.qty_in).length>0&&<div style={{textAlign:"right",marginTop:10,fontSize:14,fontWeight:600,color:"#F5C000"}}>Trip total: KSh {tripItems.reduce((s,i)=>s+(Number(i.qty_in||0)*Number(i.unit_cost||0)),0).toLocaleString()}</div>}
      </div>
      {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:12}}>{err}</div>}
      <button className="btn-y" onClick={saveTrip} disabled={saving} style={{width:"100%",padding:14}}>{saving?"Saving trip...":"Save Sourcing Trip"}</button>
    </div>
  );

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div className="stat"><div className="stat-n" style={{color:"#F5C000"}}>KSh {totalStockValue.toLocaleString()}</div><div className="stat-l">Stock value</div></div>
        <div className="stat"><div className="stat-n" style={{color:"#4CAF50"}}>{totalItems}</div><div className="stat-l">Units available</div></div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:600}}>Current Stock</div>
        <button className="btn-y" onClick={()=>setView("new")} style={{fontSize:13,padding:"8px 14px"}}>+ New Trip</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[{id:"all",label:"All"},...CAT_OPTS].map(c=><button key={c.id} onClick={()=>setFilterCat(c.id)} style={{padding:"5px 12px",borderRadius:100,border:`1px solid ${filterCat===c.id?"#F5C000":"#1A2A4A"}`,background:filterCat===c.id?"rgba(245,192,0,0.1)":"transparent",color:filterCat===c.id?"#F5C000":"#8899AA",fontSize:12,cursor:"pointer"}}>{c.label}</button>)}
      </div>
      {loading?<div className="es">Loading...</div>:filteredStock.length===0?<div className="es">No stock items yet. Add a sourcing trip.</div>:filteredStock.map(s=>{
        const avail=s.qty_in-s.qty_sold;
        return (
          <div key={s.id} className="card" style={{borderLeft:`3px solid ${avail>0?"#4CAF50":"#E85B5B"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{fontSize:14,fontWeight:600}}>{s.name}</div>
              <span className={`badge ${avail>0?"b-g":"b-r"}`}>{avail>0?`${avail} left`:"Sold out"}</span>
            </div>
            <div style={{display:"flex",gap:16,fontSize:12,color:"#8899AA"}}>
              <span>{catLabel(s.category)}</span>
              <span>Cost: KSh {Number(s.unit_cost).toLocaleString()}</span>
              {s.selling_price>0&&<span>Sell: KSh {Number(s.selling_price).toLocaleString()}</span>}
              <span className="badge b-y" style={{fontSize:10}}>{s.trip_no}</span>
            </div>
            <div style={{fontSize:11,color:"#556677",marginTop:4}}>In: {s.qty_in} | Sold: {s.qty_sold} | Value left: KSh {(avail*s.unit_cost).toLocaleString()}</div>
          </div>
        );
      })}
      {trips.length>0&&<div style={{marginTop:20}}>
        <div style={{fontSize:13,color:"#8899AA",marginBottom:10}}>Sourcing Trips</div>
        {trips.map(t=><div key={t.id} className="card">
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:600,color:"#F5C000"}}>{t.trip_no}</span>
            <span style={{fontSize:13}}>KSh {Number(t.total_cost).toLocaleString()}</span>
          </div>
          <div style={{fontSize:12,color:"#8899AA"}}>{t.date} · {t.created_by?.split(" ")[0]} · {t.notes||"No notes"}</div>
        </div>)}
      </div>}
    </div>
  );
}


function ExpensesTab() {
  const [exp, setExp] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({date:new Date().toISOString().split("T")[0],category:"Rent",description:"",amount:"",recorded_by:"Burton Kariuki"});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(()=>{loadExp();},[]);

  const loadExp = async () => {
    setLoading(true);
    try { const e = await sb.get("karu_expenses","select=*&order=date.desc,created_at.desc&limit=50"); setExp(e); }
    catch(e){ console.error(e); }
    setLoading(false);
  };

  const save = async () => {
    if(!form.amount||Number(form.amount)<=0){setErr("Enter a valid amount.");return;}
    setSaving(true); setErr("");
    try {
      await sb.post("karu_expenses",{...form,amount:Number(form.amount)});
      await loadExp();
      setShowForm(false);
      setForm({date:new Date().toISOString().split("T")[0],category:"Rent",description:"",amount:"",recorded_by:"Burton Kariuki"});
    } catch(e){ setErr("Save failed: "+e.message); }
    setSaving(false);
  };

  const thisMonth = exp.filter(e=>e.date.startsWith(new Date().toISOString().slice(0,7)));
  const monthTotal = thisMonth.reduce((s,e)=>s+Number(e.amount),0);

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div className="stat"><div className="stat-n" style={{color:"#E85B5B"}}>KSh {monthTotal.toLocaleString()}</div><div className="stat-l">This month</div></div>
        <div className="stat"><div className="stat-n" style={{color:"#8899AA"}}>{thisMonth.length}</div><div className="stat-l">Entries</div></div>
      </div>
      {!showForm&&<button className="btn-y" onClick={()=>setShowForm(true)} style={{width:"100%",marginBottom:16}}>+ Log Expense</button>}
      {showForm&&(
        <div className="card" style={{marginBottom:16,border:"1px solid rgba(245,192,0,0.3)"}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Log Expense</div>
          <div className="field"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm(x=>({...x,date:e.target.value}))}/></div>
          <div className="field">
            <label>Category</label>
            <select value={form.category} onChange={e=>setForm(x=>({...x,category:e.target.value}))}>
              {EXP_CATS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Description</label><input value={form.description} onChange={e=>setForm(x=>({...x,description:e.target.value}))} placeholder="e.g. October rent, matatu fare..."/></div>
          <div className="field"><label>Amount (KSh)</label><input type="number" value={form.amount} onChange={e=>setForm(x=>({...x,amount:e.target.value}))} placeholder="0"/></div>
          <div className="field">
            <label>Recorded by</label>
            <div className="tog">{STAFF.map(s=><button key={s} className={`tog-btn${form.recorded_by===s?" on":""}`} onClick={()=>setForm(x=>({...x,recorded_by:s}))}>{s.split(" ")[0]}</button>)}</div>
          </div>
          {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:10}}>{err}</div>}
          <div style={{display:"flex",gap:8}}>
            <button className="btn-y" onClick={save} disabled={saving} style={{flex:1}}>{saving?"Saving...":"Save"}</button>
            <button className="btn-g" onClick={()=>{setShowForm(false);setErr("");}}>Cancel</button>
          </div>
        </div>
      )}
      {loading?<div className="es">Loading...</div>:exp.length===0?<div className="es">No expenses logged yet.</div>:(
        <div>
          <div style={{fontSize:13,color:"#8899AA",marginBottom:10}}>Recent expenses</div>
          {exp.map(e=>(
            <div key={e.id} className="card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div>
                  <span className="badge b-r" style={{marginRight:8,fontSize:11}}>{e.category}</span>
                  <span style={{fontSize:13,fontWeight:500}}>{e.description||e.category}</span>
                </div>
                <span style={{fontSize:14,fontWeight:600,color:"#E85B5B"}}>KSh {Number(e.amount).toLocaleString()}</span>
              </div>
              <div style={{fontSize:12,color:"#556677"}}>{e.date} · {e.recorded_by?.split(" ")[0]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportsTab() {
  const [data, setData] = useState({sales:[],expenses:[],stock:[]});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  useEffect(()=>{loadAll();},[]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sales, expenses, stock] = await Promise.all([
        sb.get("karu_sales","select=*&order=date.desc"),
        sb.get("karu_expenses","select=*&order=date.desc"),
        sb.get("karu_stock","select=*")
      ]);
      setData({sales,expenses,stock});
    } catch(e){ console.error(e); }
    setLoading(false);
  };

  const now = new Date();
  const filterDate = (arr) => {
    if(period==="week") {
      const w = new Date(now); w.setDate(now.getDate()-7);
      return arr.filter(x=>new Date(x.date)>=w);
    }
    if(period==="month") return arr.filter(x=>x.date.startsWith(now.toISOString().slice(0,7)));
    if(period==="year") return arr.filter(x=>x.date.startsWith(now.getFullYear().toString()));
    return arr;
  };

  const fSales = filterDate(data.sales);
  const fExp = filterDate(data.expenses);
  const revenue = fSales.reduce((s,x)=>s+Number(x.total),0);
  const expenses = fExp.reduce((s,x)=>s+Number(x.amount),0);
  const stockValue = data.stock.reduce((s,i)=>s+((i.qty_in-i.qty_sold)*i.unit_cost),0);
  const cogs = data.stock.reduce((s,i)=>s+(i.qty_sold*i.unit_cost),0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenses;

  // Daily chart data
  const dailyMap = {};
  fSales.forEach(s=>{ dailyMap[s.date]=(dailyMap[s.date]||0)+Number(s.total); });
  const chartData = Object.entries(dailyMap).sort(([a],[b])=>a.localeCompare(b)).slice(-14).map(([date,total])=>({date:date.slice(5),total}));

  // Top items
  const itemMap = {};
  fSales.forEach(s=>{ if(s.items) s.items.forEach(i=>{ if(!itemMap[i.name]) itemMap[i.name]={qty:0,revenue:0}; itemMap[i.name].qty+=Number(i.qty||1); itemMap[i.name].revenue+=Number(i.qty||1)*Number(i.price||0); }); });
  const topItems = Object.entries(itemMap).sort(([,a],[,b])=>b.revenue-a.revenue).slice(0,5);

  // Expense breakdown
  const expMap = {};
  fExp.forEach(e=>{ expMap[e.category]=(expMap[e.category]||0)+Number(e.amount); });
  const expBreakdown = Object.entries(expMap).sort(([,a],[,b])=>b-a);

  // Payment split
  const mpesa = fSales.filter(s=>s.payment_method==="M-Pesa").reduce((s,x)=>s+Number(x.total),0);
  const cash = fSales.filter(s=>s.payment_method==="Cash").reduce((s,x)=>s+Number(x.total),0);

  if(loading) return <div className="es">Loading reports...</div>;

  return (
    <div>
      <div className="field" style={{marginBottom:14}}>
        <div className="tog">
          {[["week","This week"],["month","This month"],["year","This year"],["all","All time"]].map(([id,label])=>(
            <button key={id} className={`tog-btn${period===id?" on":""}`} onClick={()=>setPeriod(id)} style={{fontSize:12}}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div className="stat"><div className="stat-n" style={{color:"#4CAF50"}}>KSh {revenue.toLocaleString()}</div><div className="stat-l">Revenue</div></div>
        <div className="stat"><div className="stat-n" style={{color:"#E85B5B"}}>KSh {expenses.toLocaleString()}</div><div className="stat-l">Expenses</div></div>
        <div className="stat"><div className="stat-n" style={{color:"#F5C000"}}>KSh {grossProfit.toLocaleString()}</div><div className="stat-l">Gross profit</div></div>
        <div className="stat" style={{border:`1px solid ${netProfit>=0?"rgba(76,175,80,0.4)":"rgba(232,91,91,0.4)"}`}}>
          <div className="stat-n" style={{color:netProfit>=0?"#4CAF50":"#E85B5B"}}>KSh {Math.abs(netProfit).toLocaleString()}</div>
          <div className="stat-l">Net {netProfit>=0?"profit":"loss"}</div>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div style={{fontSize:12,color:"#8899AA",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Stock value on hand</div>
        <div style={{fontSize:20,fontWeight:600,color:"#F5C000"}}>KSh {stockValue.toLocaleString()}</div>
        <div style={{fontSize:12,color:"#556677",marginTop:2}}>COGS this period: KSh {cogs.toLocaleString()}</div>
      </div>

      {chartData.length>0&&(
        <div className="card" style={{marginBottom:16}}>
          <div style={{fontSize:12,color:"#8899AA",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.05em"}}>Daily sales</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{left:-20}}>
              <XAxis dataKey="date" tick={{fill:"#556677",fontSize:10}}/>
              <YAxis tick={{fill:"#556677",fontSize:9}}/>
              <Tooltip contentStyle={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:6,fontSize:12}}/>
              <Bar dataKey="total" fill="#F5C000" radius={[3,3,0,0]} name="Revenue"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div className="card">
          <div style={{fontSize:11,color:"#8899AA",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>Payment split</div>
          {revenue>0?<>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:"#4CAF50"}}>M-Pesa</span><span>KSh {mpesa.toLocaleString()}</span></div>
            <div style={{height:4,background:"#1A2A4A",borderRadius:2,marginBottom:8}}><div style={{height:4,background:"#4CAF50",borderRadius:2,width:`${revenue>0?Math.round(mpesa/revenue*100):0}%`}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:"#F5C000"}}>Cash</span><span>KSh {cash.toLocaleString()}</span></div>
          </>:<div style={{color:"#556677",fontSize:12}}>No sales yet</div>}
        </div>
        <div className="card">
          <div style={{fontSize:11,color:"#8899AA",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>Expense split</div>
          {expBreakdown.length>0?expBreakdown.slice(0,4).map(([cat,amt])=>(
            <div key={cat} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{color:"#E8E2D4"}}>{cat}</span><span style={{color:"#E85B5B"}}>{expenses>0?Math.round(amt/expenses*100):0}%</span></div>
              <div style={{height:3,background:"#1A2A4A",borderRadius:2}}><div style={{height:3,background:"#E85B5B",borderRadius:2,width:`${expenses>0?(amt/expenses*100):0}%`}}/></div>
            </div>
          )):<div style={{color:"#556677",fontSize:12}}>No expenses yet</div>}
        </div>
      </div>

      {topItems.length>0&&(
        <div className="card">
          <div style={{fontSize:11,color:"#8899AA",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.05em"}}>Top selling items</div>
          {topItems.map(([name,{qty,revenue:rev}],i)=>(
            <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<topItems.length-1?"1px solid #1A2A4A":"none"}}>
              <div><div style={{fontSize:13,fontWeight:500}}>{name}</div><div style={{fontSize:11,color:"#556677"}}>{qty} sold</div></div>
              <div style={{fontSize:13,fontWeight:600,color:"#4CAF50"}}>KSh {rev.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{marginTop:16,textAlign:"center"}}>
        <button className="btn-g" onClick={loadAll} style={{fontSize:13}}>Refresh reports</button>
      </div>
    </div>
  );
}
