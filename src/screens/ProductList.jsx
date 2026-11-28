import { useState, useEffect } from "react";
import { CAT_OPTS, catLabel, fmtK, sb } from "../lib";

export function ProductList({user,onBack}){
  const [products,setProducts]=useState([]); const [loading,setLoading]=useState(true);
  const [q,setQ]=useState(""); const [onlyUntyped,setOnlyUntyped]=useState(false); const [editing,setEditing]=useState(null); const [saving,setSaving]=useState(false);
  const load=async()=>{ setLoading(true); try{ setProducts(await sb.get("karu_products","select=*&order=name.asc")); }catch(e){console.error(e);} setLoading(false); };
  useEffect(()=>{load();},[]);
  const save=async()=>{
    if(!editing.name.trim()){alert("Name required.");return;}
    setSaving(true);
    try{
      await sb.patch("karu_products",editing.id,{name:editing.name.trim(),category:editing.category,tags:(editing.tags||"").trim(),default_cost:Number(editing.default_cost)||0,default_price:Number(editing.default_price)||0,active:editing.active,...("product_type" in editing?{product_type:(editing.product_type||"").trim()||null}:{})});
      setEditing(null); await load();
    }catch(e){alert("Failed: "+e.message);}
    setSaving(false);
  };
  const ql=q.toLowerCase().trim();
  const hasType=products.some(p=>"product_type" in p);
  const types=[...new Set(products.map(p=>p.product_type).filter(Boolean))].sort();
  const untypedCount=products.filter(p=>p.active&&!p.product_type).length;
  const base=onlyUntyped?products.filter(p=>!p.product_type):products;
  const shown=ql?base.filter(p=>p.name.toLowerCase().includes(ql)||(p.tags||"").toLowerCase().includes(ql)):base;

  if(editing) return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><button className="btn-g" onClick={()=>setEditing(null)} style={{fontSize:13}}>Back</button><div style={{fontSize:15,fontWeight:600}}>Edit Product</div></div>
      <div className="field"><label>Name</label><input value={editing.name} onChange={e=>setEditing(x=>({...x,name:e.target.value}))}/></div>
      <div className="field"><label>Search tags (comma separated)</label><input value={editing.tags||""} onChange={e=>setEditing(x=>({...x,tags:e.target.value}))} placeholder="sofa, 3s, seater, living"/></div>
      {"product_type" in editing&&<div className="field"><label>Type (groups items for sales reports, for example Sofa or Table)</label><input list="karu-types" value={editing.product_type||""} onChange={e=>setEditing(x=>({...x,product_type:e.target.value}))} placeholder="Sofa, Table, Pillow, Flowers..."/><datalist id="karu-types">{types.map(t=><option key={t} value={t}/>)}</datalist></div>}
      <div className="field"><label>Category</label><select value={editing.category} onChange={e=>setEditing(x=>({...x,category:e.target.value}))}>{CAT_OPTS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div className="field"><label>Default cost</label><input type="number" value={editing.default_cost} onChange={e=>setEditing(x=>({...x,default_cost:e.target.value}))}/></div>
        <div className="field"><label>Default price</label><input type="number" value={editing.default_price} onChange={e=>setEditing(x=>({...x,default_price:e.target.value}))}/></div>
      </div>
      <div className="field"><label>Status</label><div className="tog"><button className={`tog-btn${editing.active?" on":""}`} onClick={()=>setEditing(x=>({...x,active:true}))}>Active</button><button className={`tog-btn${!editing.active?" on":""}`} onClick={()=>setEditing(x=>({...x,active:false}))}>Retired</button></div></div>
      <button className="btn-y" onClick={save} disabled={saving} style={{width:"100%",padding:13}}>{saving?"Saving...":"Save Product"}</button>
    </div>
  );
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><button className="btn-g" onClick={onBack} style={{fontSize:13}}>Back</button><div style={{fontSize:15,fontWeight:600}}>Product List</div><span style={{fontSize:12,color:"#8A97A8"}}>{products.length}</span></div>
      <div style={{fontSize:11,color:"#8899AA",marginBottom:12,lineHeight:1.5}}>Add tags so people find items fast — "sofa", "3s", "seater" all point to one product. New products are added while recording a sale or trip.</div>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products or tags..." style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"9px 2px",color:"#E8E2D4",fontSize:15,marginBottom:12}}/>
      {hasType&&untypedCount>0&&<button className={`chip${onlyUntyped?" on":""}`} onClick={()=>setOnlyUntyped(v=>!v)} style={{marginBottom:12}}>{onlyUntyped?"Showing products with no type":`${untypedCount} product${untypedCount===1?"":"s"} with no type`}</button>}
      {loading?<div style={{color:"#8A97A8",textAlign:"center",padding:"20px 0"}}>Loading...</div>:shown.length===0?<div style={{color:"#8A97A8",textAlign:"center",padding:"20px 0"}}>No products.</div>:shown.map(p=>(
        <div key={p.id} className="card" style={{opacity:p.active?1:0.5,padding:"10px 12px"}} onClick={()=>setEditing({...p})}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600}}>{p.name}{!p.active&&<span style={{color:"#8A97A8",fontWeight:400}}> · retired</span>}</div>
              <div style={{fontSize:11,color:"#8A97A8",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{catLabel(p.category)}{hasType?` · ${p.product_type||"no type"}`:""}{p.tags?` · ${p.tags}`:" · no tags yet"}</div>
            </div>
            <div style={{textAlign:"right",marginLeft:8}}><div style={{fontSize:13,color:"#F5C000",fontWeight:600}}>{p.default_price>0?fmtK(Number(p.default_price)):"—"}</div><div style={{fontSize:10,color:"#8A97A8"}}>edit</div></div>
          </div>
        </div>
      ))}
    </div>
  );
}

