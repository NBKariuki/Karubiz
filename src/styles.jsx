export const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0} body{font-family:'DM Sans',sans-serif;background:#050A1F;color:#E8E2D4} input,select,textarea{outline:none;font-family:'DM Sans',sans-serif;color-scheme:dark}
    .field{margin-bottom:20px} .field label{display:block;font-size:13px;color:#A9B5C6;font-weight:500;margin-bottom:2px;letter-spacing:0;text-transform:none}
    .field input,.field select,.field textarea{width:100%;background:transparent;border:none;border-bottom:1px solid #5B73A3;border-radius:0;padding:10px 2px;min-height:44px;color:#FFFFFF;font-size:15px} .field input:focus,.field select:focus,.field textarea:focus{border-bottom-color:#F5C000;box-shadow:0 1px 0 0 #F5C000} .field textarea{resize:vertical;min-height:64px} .field input::placeholder,.field textarea::placeholder{color:#8A97A8;font-size:13px}
    .dtl>summary{list-style:none;cursor:pointer} .dtl>summary::-webkit-details-marker{display:none}
    .tog{display:flex;gap:0;border:1px solid #2E4472;border-radius:8px;overflow:hidden} .tog-btn{flex:1;padding:10px 6px;min-height:42px;font-size:14px;font-weight:500;border:none;border-right:1px solid #2E4472;border-radius:0;background:transparent;color:#C2CBD6;cursor:pointer;text-align:center;transition:all 0.15s;font-family:'DM Sans',sans-serif} .tog-btn:last-child{border-right:none}
    .tog-btn.on{background:rgba(245,192,0,0.16);color:#F5C000;font-weight:600}
    .card{background:#0A1128;border:1px solid #1A2A4A;border-radius:10px;padding:14px;margin-bottom:10px}
    .tbl{background:#0A1128;border:1px solid #1A2A4A;border-radius:10px;overflow:hidden;margin-bottom:12px}
    .tbl-h{display:grid;gap:8px;align-items:center;padding:9px 12px;background:#0E1733;border-bottom:1px solid #1A2A4A;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#8A97A8}
    .tbl-r{display:grid;gap:8px;align-items:center;padding:11px 12px;border-bottom:1px solid #101B36;cursor:pointer;min-height:52px;transition:background 0.12s}
    .tbl-r:hover{background:#0F1A3A} .tbl-r.tbl-static{cursor:default} .tbl-r.tbl-static:hover{background:transparent}
    .tbl-row.open>.tbl-r{background:#0F1A3A}
    .tbl-row:last-child>.tbl-r:last-child{border-bottom:none}
    .tbl-x{padding:6px 12px 12px;background:#070D22;border-bottom:1px solid #101B36}
    .tbl-sub{font-size:13px;color:#8A97A8;margin-top:2px;line-height:1.3;word-break:break-word}
    .num{text-align:right;font-variant-numeric:tabular-nums}
    .chev{display:inline-block;width:8px;height:8px;border-right:2px solid #8A97A8;border-bottom:2px solid #8A97A8;transform:rotate(-45deg);flex-shrink:0;transition:transform 0.15s} .open .chev{transform:rotate(45deg)}
    .act-row{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:transparent;border:none;border-bottom:1px solid #1A2A4A;padding:13px 4px;cursor:pointer;font-family:'DM Sans',sans-serif;color:#FFFFFF} .act-row:hover,.act-row:active{background:#0F1A3A}
    .act-ic{width:40px;height:40px;border-radius:10px;background:#101B3C;border:1px solid #24365C;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0}
    .pick-btn{display:flex;justify-content:space-between;align-items:center;width:100%;background:transparent;border:none;border-bottom:1px solid #5B73A3;border-radius:0;padding:11px 2px;color:#FFFFFF;font-size:16px;text-align:left;cursor:pointer;font-family:'DM Sans',sans-serif} .pick-btn .chev{transform:rotate(45deg);margin-right:4px} .pick-btn.open .chev{transform:rotate(-135deg)}
    .pick-panel{background:#0A1128;border:1px solid #1A2A4A;border-radius:10px;padding:2px 12px 14px;margin-top:8px}
    .grp-l{font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#8A97A8;margin:12px 0 7px}
    .chips{display:flex;flex-wrap:wrap;gap:8px}
    .chip{padding:8px 13px;border:1px solid #2E4472;border-radius:100px;background:transparent;color:#C2CBD6;font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif} .chip:active{background:#0F1A3A} .chip.on{border-color:#F5C000;color:#F5C000;background:rgba(245,192,0,0.12);font-weight:600}
    .seg{display:inline-flex;border:1px solid #2E4472;border-radius:8px;overflow:hidden} .seg button{padding:8px 16px;background:transparent;border:none;border-right:1px solid #2E4472;color:#C2CBD6;font-size:14px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif} .seg button:last-child{border-right:none} .seg button.on{background:rgba(245,192,0,0.16);color:#F5C000;font-weight:600}
    .btn-y{background:#F5C000;color:#050A1F;border:none;padding:11px 18px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif} .btn-y:disabled{background:#444;color:#888;cursor:not-allowed}
    .btn-g{background:transparent;color:#C2CBD6;border:1px solid #24365C;padding:10px 15px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif}
    .btn-r{background:rgba(232,91,91,0.12);color:#E85B5B;border:1px solid rgba(232,91,91,0.3);padding:6px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif}
    .badge{display:inline-block;font-size:13px;font-weight:600;padding:3px 9px;border-radius:100px} .b-y{background:rgba(245,192,0,0.12);color:#F5C000} .b-g{background:rgba(76,175,80,0.12);color:#4CAF50} .b-r{background:rgba(232,91,91,0.12);color:#E85B5B}
    .stat{background:#0A1128;border:1px solid #1A2A4A;border-radius:10px;padding:14px;text-align:center} .stat-n{font-size:22px;font-weight:600;margin-bottom:2px} .stat-l{font-size:12px;color:#AEB9C7;text-transform:uppercase;letter-spacing:0.06em}
    .shell{max-width:500px;margin:0 auto;padding-bottom:calc(72px + env(safe-area-inset-bottom,0px))}
    .nav{display:flex;background:#0A1128;border-top:1px solid #1A2A4A;position:fixed;bottom:0;left:0;right:0;z-index:50;padding-bottom:env(safe-area-inset-bottom,0px)}
    @media (min-width:600px) and (max-width:899px){ .shell{max-width:660px} }
    @media (min-width:900px){
      .shell{max-width:none;margin:0;padding:0 0 32px 88px}
      .shell>div{max-width:800px;margin-left:auto;margin-right:auto}
      .nav{top:0;right:auto;bottom:0;width:88px;flex-direction:column;justify-content:flex-start;gap:6px;padding:18px 0;border-top:none;border-right:1px solid #1A2A4A}
      .nav-btn{flex:none;padding:14px 4px;font-size:13px;border-left:3px solid transparent}
      .nav-btn.on{border-left-color:#F5C000;background:rgba(245,192,0,0.08)}
      .nav-btn:hover{color:#E8E2D4}
    }
    .nav-btn{flex:1;padding:10px 4px 8px;background:none;border:none;color:#8A97A8;cursor:pointer;font-size:12px;font-weight:500;letter-spacing:0.03em;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:'DM Sans',sans-serif} .nav-btn .ni{font-size:20px} .nav-btn.on{color:#F5C000}
    .ac-drop{position:absolute;top:100%;left:0;right:0;background:#0A1128;border:1px solid #F5C000;border-top:none;border-radius:0 0 6px 6px;z-index:200;max-height:200px;overflow-y:auto}
    .ac-item{padding:9px 12px;cursor:pointer;border-bottom:1px solid #1A2A4A} .ac-item:hover{background:#0F1A3A} .ac-item:last-child{border-bottom:none}
    .audit-entry{font-size:13px;color:#8A97A8;padding:6px 0;border-bottom:1px solid #0F1A3A;line-height:1.55} .audit-entry:last-child{border-bottom:none}
    .trip-hdr{display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0}
    .strip{display:flex;justify-content:center;gap:16px;padding:6px 16px;background:#0A1128;border-bottom:1px solid #1A2A4A;font-size:12px}
    .strip span{color:#8899AA} .strip b{color:#F5C000;font-weight:600}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100}
    .panel{position:fixed;top:0;right:0;bottom:0;width:300px;max-width:88vw;background:#0A1128;border-left:1px solid #1A2A4A;z-index:101;overflow-y:auto;padding:20px 18px 40px}
    .bal-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1A2A4A}
    .bal-row:last-child{border-bottom:none}
    .qa{background:transparent;border:none;border-bottom:1px solid #1A2A4A;border-radius:0;padding:6px 0 14px;margin-bottom:12px}
    .qa-title{font-size:13px;font-weight:600;color:#FFFFFF;margin-bottom:8px}
    .qa input{width:100%;background:transparent;border:none;border-bottom:1px solid #5B73A3;border-radius:0;padding:9px 2px;font-size:15px;margin-bottom:6px}
    :root{--surface:#0A1128;--fill:#A8D8FF;--ph:#7C8CA6}
    input,select,textarea{color:var(--fill) !important}
    input::placeholder,textarea::placeholder{color:var(--ph) !important;opacity:1}
    .subscreen{background:var(--surface);border:1px solid #1A2A4A;border-radius:12px;padding:16px;margin-bottom:12px}
    .subscreen>.subscreen-hd{display:flex;align-items:center;gap:10px;margin-bottom:16px}
    .subscreen>.subscreen-hd .title{font-size:18px;font-weight:600;color:#FFFFFF}
    .mv{font-size:11px;padding:6px 0;border-bottom:1px solid #0F1A3A;display:flex;justify-content:space-between}
    .mv:last-child{border-bottom:none}
    .wiz-overlay{position:fixed;inset:0;background:rgba(5,10,31,0.94);z-index:120;overflow-y:auto;padding:12px}
    .wiz{max-width:480px;margin:0 auto;background:#0A1128;border:1px solid #1A2A4A;border-radius:12px;display:flex;flex-direction:column}
    .wiz-hd{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #1A2A4A}
    .wiz-steps{display:flex;gap:6px;padding:12px 16px 4px}
    .wiz-dot{flex:1;height:4px;border-radius:2px;background:#1A2A4A} .wiz-dot.on{background:#F5C000}
    .wiz-body{padding:16px}
    .wiz-ft{padding:4px 16px 20px;display:flex;gap:8px}
    .lg-in{width:100%;background:#12203C;border:1px solid #2E4472;border-radius:8px;padding:11px 13px;color:#FFFFFF;font-size:14px;margin-bottom:8px;font-family:'DM Sans',sans-serif}
    .staff-btn{background:#0A1128;border:2px solid #1A2A4A;border-radius:12px;padding:22px 12px;color:#FFFFFF;font-size:17px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s}
    .staff-btn:hover{border-color:#F5C000;color:#F5C000}
    .rcpt{background:#fff;color:#111;border-radius:8px;padding:18px 16px;max-width:340px;margin:0 auto 14px;font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.5}
    .rcpt-hd{text-align:center;padding-bottom:10px;border-bottom:1px dashed #999;margin-bottom:10px}
    .rcpt-logo{font-size:20px;font-weight:700;letter-spacing:0.1em}
    .rcpt-sub{font-size:12px;color:#555;margin-top:2px}
    .rcpt-row{display:flex;justify-content:space-between;padding:3px 0;font-size:14px}
    .rcpt-row .l{color:#555} .rcpt-row .v{font-weight:600}
    .rcpt-items{border-top:1px dashed #999;border-bottom:1px dashed #999;padding:8px 0;margin:8px 0}
    .rcpt-it{display:flex;justify-content:space-between;padding:4px 0;font-size:14px}
    .rcpt-it .n{flex:1;padding-right:8px}
    .rcpt-tot{display:flex;justify-content:space-between;font-size:18px;font-weight:700;padding:8px 0}
    .rcpt-ft{text-align:center;font-size:12px;color:#555;margin-top:10px;padding-top:10px;border-top:1px dashed #999;line-height:1.6}
    @media print{.nav,.np,.strip{display:none!important} body{background:#fff} .rcpt{max-width:80mm;border-radius:0;padding:4mm;font-size:13px} .rcpt-logo{font-size:18px}} body.printing-statement *{visibility:hidden} body.printing-statement #karu-statement,body.printing-statement #karu-statement *{visibility:visible} body.printing-statement #karu-statement{position:absolute;left:0;top:0;width:100%}
  `}</style>
);
