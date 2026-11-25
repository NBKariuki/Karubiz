import { useState } from "react";
import { EXP_CATS, EXP_GROUPS, EXP_HINTS, GROUP_COLORS, catColor } from "../lib";

// Compact category picker: one tap field that opens a panel of grouped chips, and closes when you choose.
// "extra" lets an older category (for example Transport) stay selectable while editing an old entry.
export function CategoryPicker({ value, onChange, extra }) {
  const [open, setOpen] = useState(false);
  const pick = c => { onChange(c); setOpen(false); };
  const legacy = extra && !EXP_CATS.includes(extra) ? extra : null;
  return (
    <div>
      <button type="button" className={`pick-btn${open ? " open" : ""}`} onClick={() => setOpen(o => !o)}>
        <span style={{display:"flex",alignItems:"center",gap:10}}><span style={{width:11,height:11,borderRadius:"50%",background:catColor(value),flexShrink:0}}/>{value}</span><span className="chev" />
      </button>
      {!open && <div style={{ fontSize: 13, color: "#8A97A8", marginTop: 5 }}>{EXP_HINTS[value]}</div>}
      {open && (
        <div className="pick-panel">
          {legacy && (<div style={{"--g":catColor(legacy)}}><div className="grp-l">Existing</div><div className="chips"><button type="button" className={`chip${value === legacy ? " on" : ""}`} onClick={() => pick(legacy)}>{legacy}</button></div></div>)}
          {EXP_GROUPS.map(([g, cs]) => (
            <div key={g} style={{"--g":GROUP_COLORS[g]}}>
              <div className="grp-l">{g}</div>
              <div className="chips">{cs.map(c => <button type="button" key={c} className={`chip${value === c ? " on" : ""}`} onClick={() => pick(c)}>{c}</button>)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
