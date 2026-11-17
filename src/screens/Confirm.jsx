import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function Confirm({on,off,saving}){ return <div style={{display:"flex",gap:8,marginTop:4}}><button className="btn-y" onClick={on} disabled={saving} style={{flex:1,fontSize:13}}>{saving?"...":"Confirm"}</button><button className="btn-g" onClick={off} style={{fontSize:13}}>Cancel</button></div>; }

