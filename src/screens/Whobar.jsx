import { STAFF } from "../lib";

export function Whobar({who,setWho}){ return <div className="tog" style={{marginBottom:8}}>{STAFF.map(s=><button key={s} className={`tog-btn${who===s?" on":""}`} onClick={()=>setWho(s)}>{s.split(" ")[0]}</button>)}</div>; }
