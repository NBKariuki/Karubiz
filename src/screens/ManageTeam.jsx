import { useState, useEffect } from "react";
import { ROLES, authEmail, loadTeam, sb } from "../lib";

export function ManageTeam({user,onBack}){
  const [users,setUsers]=useState([]); const [loading,setLoading]=useState(true);
  const [adding,setAdding]=useState(false); const [f,setF]=useState({full_name:"",username:"",phone:"",role:"attendant"});
  const [saving,setSaving]=useState(false); const [err,setErr]=useState("");
  const load=async()=>{ setLoading(true); try{ { setUsers(await sb.get("karu_users","select=*&order=created_at.asc")); await loadTeam(user); } }catch(e){console.error(e);} setLoading(false); };
  useEffect(()=>{load();},[]);
  const addUser=async()=>{
    setErr(""); const un=f.username.trim().toLowerCase().replace(/\s+/g,"");
    if(!f.full_name.trim()){setErr("Full name required.");return;}
    if(!un){setErr("Username required.");return;}
    setSaving(true);
    try{
      const exists=await sb.get("karu_users",`select=id&username=eq.${un}`);
      if(exists.length){setErr("That username is taken.");setSaving(false);return;}
      await sb.post("karu_users",{username:un,full_name:f.full_name.trim(),phone:f.phone.trim(),role:f.role,must_set_pin:true,auth_type:f.role==="attendant"?"pin":"password",active:true,created_by:user.full_name});
      setAdding(false); setF({full_name:"",username:"",phone:"",role:"attendant"});
      await load();
      alert(`Profile created. Last step: in Supabase go to Authentication, Users, Add user. Email: ${authEmail(un)}  Password: a temporary ${f.role==="attendant"?"6-digit PIN":"password"} you give them. Tick Auto Confirm User. They set their own at first login.`);
    }catch(e){setErr("Failed: "+e.message);}
    setSaving(false);
  };
  const toggleActive=async(u)=>{ if(u.role==="owner"){alert("Owners cannot be deactivated here.");return;} await sb.patch("karu_users",u.id,{active:!u.active}); await load(); };
  const resetCred=async(u)=>{ const w=u.role==="attendant"?"PIN":"password"; if(!confirm(`Reset ${u.full_name.split(" ")[0]}'s ${w}? You will set a temporary one in Supabase.`))return; await sb.patch("karu_users",u.id,{must_set_pin:true}); await load(); alert(`Marked for reset. Now in Supabase go to Authentication, Users, open ${authEmail(u.username)} and set a new temporary ${w}. Give it to them; they choose their own at next login.`); };
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><button className="btn-g" onClick={onBack} style={{fontSize:13}}>Back</button><div style={{fontSize:15,fontWeight:600}}>Manage Team</div></div>
      {!adding&&<button className="btn-y" onClick={()=>setAdding(true)} style={{width:"100%",marginBottom:14,fontSize:13}}>+ Add team member</button>}
      {adding&&(
        <div className="qa" style={{marginBottom:14}}>
          <div className="qa-title">New team member</div>
          <div className="field"><label>Full name</label><input value={f.full_name} onChange={e=>setF(x=>({...x,full_name:e.target.value}))} placeholder="e.g. Jane Wanjiru"/></div>
          <div className="field"><label>Username (they log in with this)</label><input value={f.username} onChange={e=>setF(x=>({...x,username:e.target.value}))} placeholder="e.g. jane" autoCapitalize="none"/></div>
          <div className="field"><label>Phone (optional)</label><input value={f.phone} onChange={e=>setF(x=>({...x,phone:e.target.value}))} placeholder="07XX XXX XXX" type="tel"/></div>
          <div className="field"><label>Role</label><div className="tog"><button className={`tog-btn${f.role==="attendant"?" on":""}`} onClick={()=>setF(x=>({...x,role:"attendant"}))} style={{fontSize:12}}>Attendant</button><button className={`tog-btn${f.role==="manager"?" on":""}`} onClick={()=>setF(x=>({...x,role:"manager"}))} style={{fontSize:12}}>Manager</button><button className={`tog-btn${f.role==="owner"?" on":""}`} onClick={()=>setF(x=>({...x,role:"owner"}))} style={{fontSize:12}}>Owner</button></div></div>
          <div style={{fontSize:11,color:"#8899AA",marginBottom:10}}>{f.role==="attendant"?"They'll set a 6-digit PIN at first login.":"They'll set a password at first login (owners and managers use passwords)."}</div>
          {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:10}}>{err}</div>}
          <div style={{display:"flex",gap:8}}><button className="btn-y" onClick={addUser} disabled={saving} style={{flex:1,fontSize:13}}>{saving?"Saving...":"Add"}</button><button className="btn-g" onClick={()=>{setAdding(false);setErr("");}} style={{fontSize:13}}>Cancel</button></div>
        </div>
      )}
      {loading?<div style={{color:"#8899AA",textAlign:"center",padding:"20px 0"}}>Loading...</div>:users.map(u=>(
        <div key={u.id} className="card" style={{opacity:u.active?1:0.5}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><div style={{fontSize:14,fontWeight:600}}>{u.full_name} {u.id===user.id&&<span style={{color:"#8899AA",fontWeight:400,fontSize:12}}>(you)</span>}</div>
              <div style={{fontSize:12,color:"#8899AA",marginTop:2}}>@{u.username} · {ROLES[u.role]?.label||u.role}{u.must_set_pin?(u.role==="attendant"?" · PIN not set":" · password not set"):""}{!u.active?" · inactive":""}</div></div>
            <span className={`badge ${u.role==="owner"?"b-y":u.role==="manager"?"b-g":"b-muted"}`}>{ROLES[u.role]?.label}</span>
          </div>
          {u.id!==user.id&&<div style={{display:"flex",gap:6,marginTop:8}}>
            <button className="btn-g" onClick={()=>resetCred(u)} style={{fontSize:11,padding:"5px 10px"}}>Reset {u.role==="attendant"?"PIN":"password"}</button>
            {u.role!=="owner"&&<button className="btn-g" onClick={()=>toggleActive(u)} style={{fontSize:11,padding:"5px 10px"}}>{u.active?"Deactivate":"Reactivate"}</button>}
          </div>}
        </div>
      ))}
    </div>
  );
}

