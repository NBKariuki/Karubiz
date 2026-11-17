import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function AutocompleteInput({value,onChange,onSelect,stockItems,placeholder}){
  const [open,setOpen]=useState(false);
  const matches=value.length>0?stockItems.filter(s=>s.name.toLowerCase().includes(value.toLowerCase())&&(s.qty_in-s.qty_sold-(s.qty_adjusted||0))>0):[];
  return (
    <div style={{position:"relative"}}>
      <input value={value} onChange={e=>{onChange(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),200)}
        placeholder={placeholder} style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid #5B73A3",borderRadius:0,padding:"10px 2px",color:"#FFFFFF",fontSize:15}}/>
      {open&&matches.length>0&&(
        <div className="ac-drop">
          {matches.map(s=>(
            <div key={s.id} className="ac-item" onMouseDown={()=>onSelect(s)}>
              <div style={{fontSize:13,fontWeight:500}}>{s.name}</div>
              <div style={{fontSize:11,color:"#8899AA"}}>{s.qty_in-s.qty_sold-(s.qty_adjusted||0)} available · KSh {Number(s.selling_price).toLocaleString()} · {s.trip_no}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

