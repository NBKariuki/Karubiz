import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { genSalt, hashWith, pwStrength, sb } from "../lib";
import { GS } from "../styles";

export function LoginScreen({onLogin,lapsed}){
  const [stage,setStage]=useState("user");
  const [username,setUsername]=useState(""); const [found,setFound]=useState(null);
  const [cred,setCred]=useState(""); const [cred2,setCred2]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);

  const isPassword = found?.auth_type==="password" || (found && found.role!=="attendant");
  const credLabel = isPassword?"Password":"PIN";

  const findUser=async()=>{
    setErr(""); const u=username.trim().toLowerCase(); if(!u){setErr("Enter your username.");return;}
    setBusy(true);
    try{
      const rows=await sb.get("karu_users",`select=*&username=eq.${u}&active=eq.true`);
      if(!rows.length){setErr("No active account with that username.");setBusy(false);return;}
      const usr=rows[0];
      setFound(usr);
      const needsSetup = !usr.pin_hash || usr.must_set_pin;
      setStage(needsSetup?"setcred":"cred");
      setCred(""); setCred2("");
    }catch(e){setErr("Login failed: "+e.message);}
    setBusy(false);
  };

  const doLogin=async()=>{
    setErr("");
    if(isPassword){ if(!cred){setErr("Enter your password.");return;} }
    else if(cred.length<4){setErr("Enter your 4-digit PIN.");return;}
    setBusy(true);
    try{
      const h=await hashWith(cred, found.salt); // found.salt null for legacy pin -> legacy salt
      if(h===found.pin_hash){ onLogin(found); }
      else { setErr(isPassword?"Wrong password.":"Wrong PIN."); }
    }catch(e){setErr("Error: "+e.message);}
    setBusy(false);
  };

  const doSetCred=async()=>{
    setErr("");
    if(isPassword){
      const w=pwStrength(cred); if(w){setErr(w);return;}
      if(cred!==cred2){setErr("Passwords do not match.");return;}
    } else {
      if(!/^\d{4}$/.test(cred)){setErr("PIN must be 4 digits.");return;}
      if(cred!==cred2){setErr("PINs do not match.");return;}
    }
    setBusy(true);
    try{
      const salt=genSalt();
      const h=await hashWith(cred, salt);
      await sb.patch("karu_users",found.id,{pin_hash:h,salt,must_set_pin:false,auth_type:isPassword?"password":"pin"});
      onLogin({...found,pin_hash:h,salt,must_set_pin:false});
    }catch(e){setErr("Could not save: "+e.message);}
    setBusy(false);
  };

  const credInput=(val,setVal,ph,auto)=> isPassword
    ? <input type="password" value={val} onChange={e=>{setVal(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&(stage==="cred"?doLogin():null)} placeholder={ph} autoFocus={auto}/>
    : <input type="password" inputMode="numeric" maxLength={4} value={val} onChange={e=>{setVal(e.target.value.replace(/\D/g,""));setErr("");}} onKeyDown={e=>e.key==="Enter"&&(stage==="cred"?doLogin():null)} placeholder="••••" autoFocus={auto} style={{letterSpacing:"0.4em",textAlign:"center",fontSize:20}}/>;

  return (<><GS/>
    <div style={{minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:"center",padding:24}}>
      <div style={{background:"#0A1128",border:"1px solid #1A2A4A",borderRadius:12,padding:"36px 28px",maxWidth:360,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:24,fontWeight:600,color:"#F5C000",letterSpacing:"0.1em"}}>KARU</div><div style={{fontSize:13,color:"#8899AA",marginTop:4}}>Accounts System</div></div>
        {lapsed&&<div style={{background:"rgba(232,164,91,0.1)",border:"1px solid rgba(232,164,91,0.3)",borderRadius:8,padding:"9px 12px",marginBottom:14,fontSize:12,color:"#E8A45B",textAlign:"center"}}>Logged out after 5 minutes of inactivity. Please sign in again.</div>}
        {stage==="user"&&(<>
          <div className="field"><label>Username</label><input value={username} onChange={e=>{setUsername(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&findUser()} placeholder="e.g. burton" autoFocus autoCapitalize="none"/></div>
          {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:12}}>{err}</div>}
          <button className="btn-y" onClick={findUser} disabled={busy} style={{width:"100%"}}>{busy?"...":"Continue"}</button>
        </>)}
        {stage==="cred"&&(<>
          <div style={{fontSize:13,color:"#8899AA",marginBottom:14}}>Welcome back, <span style={{color:"#FFFFFF",fontWeight:600}}>{found.full_name.split(" ")[0]}</span></div>
          <div className="field"><label>Your {credLabel}</label>{credInput(cred,setCred,"Enter "+credLabel.toLowerCase(),true)}</div>
          {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:12}}>{err}</div>}
          <button className="btn-y" onClick={doLogin} disabled={busy} style={{width:"100%"}}>{busy?"...":"Sign In"}</button>
          <button className="btn-g" onClick={()=>{setStage("user");setCred("");setErr("");setFound(null);}} style={{width:"100%",marginTop:8,fontSize:13}}>Not you?</button>
        </>)}
        {stage==="setcred"&&(<>
          <div style={{fontSize:13,color:"#8899AA",marginBottom:6}}>First login, <span style={{color:"#FFFFFF",fontWeight:600}}>{found.full_name.split(" ")[0]}</span>.</div>
          <div style={{fontSize:12,color:"#8899AA",marginBottom:14}}>{isPassword?"Set a password — at least 8 characters, with a letter and a number.":"Set a 4-digit PIN you'll remember."}</div>
          <div className="field"><label>New {credLabel}</label>{credInput(cred,setCred,"New "+credLabel.toLowerCase(),true)}</div>
          <div className="field"><label>Confirm {credLabel}</label>{credInput(cred2,setCred2,"Confirm "+credLabel.toLowerCase(),false)}</div>
          {err&&<div style={{color:"#E85B5B",fontSize:13,marginBottom:12}}>{err}</div>}
          <button className="btn-y" onClick={doSetCred} disabled={busy} style={{width:"100%"}}>{busy?"...":"Save & Continue"}</button>
        </>)}
      </div>
    </div></>);
}

