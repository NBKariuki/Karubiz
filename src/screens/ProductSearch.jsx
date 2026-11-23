import { useState, useEffect } from "react";
import { CAT_OPTS, can, catLabel, sb } from "../lib";

export function ProductSearch({user, value, onChange, onPick, placeholder, priceMode, noAdd, stockRows}){
  // stockRows (optional): raw stock rows. When given, anything in stock is searchable even if it is missing from the product list,
  // and each result shows how many are left.
  // priceMode: "price" fills default_price, "cost" fills default_cost, "none" fills nothing
  const [products,setProducts]=useState([]); const [open,setOpen]=useState(false);
  const [adding,setAdding]=useState(false); const [saving,setSaving]=useState(false);
  const [nf,setNf]=useState({name:"",category:"living",tags:"",default_cost:"",default_price:""});
  const load=async()=>{ try{ setProducts(await sb.get("karu_products","select=*&active=eq.true&order=name.asc")); }catch(e){console.error(e);} };
  useEffect(()=>{ load(); },[]);
  const q=(value||"").toLowerCase().trim();
  // Forgiving matching: ignores apostrophes and plural "s", and every word typed must appear in the name or tags.
  const toks=s=>String(s||"").toLowerCase().replace(/['\u2019`]/g,"").replace(/[^a-z0-9]+/g," ").trim().split(" ").filter(Boolean).map(w=>w.length>3&&w.endsWith("s")&&!w.endsWith("ss")?w.slice(0,-1):w);
  const qt=toks(q);
  const byName={};
  (stockRows||[]).forEach(s=>{ const k=String(s.name||"").trim().toLowerCase(); const av=Math.max(0,Number(s.qty_in||0)-Number(s.qty_sold||0)-Number(s.qty_adjusted||0)); const g=byName[k]=byName[k]||{name:s.name,category:s.category,avail:0,price:0,priceDate:"",cost:0}; g.avail+=av; g.cost+=av*Number(s.unit_cost||0); if(Number(s.selling_price)>0&&String(s.date_in||"")>=g.priceDate){ g.price=Number(s.selling_price); g.priceDate=String(s.date_in||""); } });
  const known=new Set(products.map(x=>String(x.name||"").trim().toLowerCase()));
  const all=[...products.map(x=>({...x,_avail:stockRows?(byName[String(x.name||"").trim().toLowerCase()]||{avail:0}).avail:undefined})),
    ...Object.entries(byName).filter(([k,g])=>g.avail>0&&!known.has(k)).map(([k,g])=>({id:"stock:"+k,name:g.name,category:g.category,default_price:g.price,default_cost:g.avail?g.cost/g.avail:0,tags:"",_avail:g.avail,_fromStock:true}))];
  const matches = qt.length>0 ? all.filter(x=>{ const hay=toks(x.name).join(" ")+" "+toks(x.tags).join(" "); return qt.every(t=>hay.includes(t)); })
      .sort((a,b)=>(stockRows?((b._avail>0)-(a._avail>0)):0)||String(a.name).localeCompare(String(b.name))).slice(0,10) : [];
  const exactExists = all.some(x=>String(x.name||"").trim().toLowerCase()===q);

  const saveNew=async()=>{
    if(!nf.name.trim()){alert("Name required.");return;}
    setSaving(true);
    try{
      const [p]=await sb.post("karu_products",{name:nf.name.trim(),category:nf.category,tags:nf.tags.trim(),default_cost:Number(nf.default_cost)||0,default_price:Number(nf.default_price)||0,created_by:user.full_name});
      await load();
      setAdding(false); setNf({name:"",category:"living",tags:"",default_cost:"",default_price:""});
      onPick(p); setOpen(false);
    }catch(e){alert("Failed: "+e.message);}
    setSaving(false);
  };

  return (
    <div style={{position:"relative"}}>
      <input value={value} onChange={e=>{onChange(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),200)}
        placeholder={placeholder||"Search product..."} style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"10px 2px",color:"#FFFFFF",fontSize:15}}/>
      {open&&q.length>0&&(
        <div className="ac-drop">
          {matches.map(p=>(
            <div key={p.id} className="ac-item" onMouseDown={()=>{onPick(p);setOpen(false);}}>
              <div style={{fontSize:13,fontWeight:500}}>{p.name}</div>
              <div style={{fontSize:11,color:"#8899AA"}}>{catLabel(p.category)}{p.default_price>0?` · KSh ${Number(p.default_price).toLocaleString()}`:""}{p.tags?` · ${p.tags}`:""}{stockRows&&<span style={{color:p._avail>0?"#4CAF50":"#8A97A8"}}>{p._avail>0?` · ${p._avail} left`:" · out of stock"}</span>}</div>
            </div>
          ))}
          {matches.length===0&&<div style={{padding:"9px 12px",fontSize:12,color:"#8A97A8"}}>No match for "{value}"</div>}
          {!exactExists&&can(user,"users")&&!noAdd&&(
            adding?(
              <div style={{padding:12,borderTop:"1px solid #1A2A4A"}} onMouseDown={e=>e.preventDefault()}>
                <div style={{fontSize:12,fontWeight:600,color:"#F5C000",marginBottom:8}}>New product</div>
                <input value={nf.name||value} onChange={e=>setNf(x=>({...x,name:e.target.value}))} placeholder="Product name" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15,marginBottom:6}}/>
                <input value={nf.tags} onChange={e=>setNf(x=>({...x,tags:e.target.value}))} placeholder="Search tags: sofa, 3s, seater" style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15,marginBottom:6}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
                  <select value={nf.category} onChange={e=>setNf(x=>({...x,category:e.target.value}))} style={{background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15}}>{CAT_OPTS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
                  <input type="number" value={nf.default_cost} onChange={e=>setNf(x=>({...x,default_cost:e.target.value}))} placeholder="Cost" style={{background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#FFFFFF",fontSize:15}}/>
                  <input type="number" value={nf.default_price} onChange={e=>setNf(x=>({...x,default_price:e.target.value}))} placeholder="Price" style={{background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#FFFFFF",fontSize:15}}/>
                </div>
                <div style={{display:"flex",gap:6}}><button onMouseDown={saveNew} disabled={saving} style={{flex:1,background:"#F5C000",color:"#050A1F",border:"none",borderRadius:6,padding:"7px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{saving?"...":"Add & use"}</button><button onMouseDown={()=>setAdding(false)} style={{background:"transparent",border:"1px solid #1A2A4A",color:"#8899AA",borderRadius:6,padding:"7px 12px",fontSize:12,cursor:"pointer"}}>Cancel</button></div>
              </div>
            ):(
              <div className="ac-item" style={{color:"#F5C000"}} onMouseDown={e=>{e.preventDefault();setNf(x=>({...x,name:value}));setAdding(true);}}>+ New product "{value}"</div>
            )
          )}
          {!exactExists&&!can(user,"users")&&matches.length===0&&<div style={{padding:"9px 12px",fontSize:11,color:"#8A97A8"}}>Not in the list — ask an owner to add it.</div>}
        </div>
      )}
    </div>
  );
}

