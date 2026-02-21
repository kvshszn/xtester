import { useState, useRef, useEffect, useCallback } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Spectral:wght@300;400;500;600&family=Space+Mono:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --parchment:   #f5f0e8;
    --parchment2:  #ede7d9;
    --parchment3:  #e4dccb;
    --parchment4:  #d9d0bc;
    --ink:         #2c2416;
    --ink2:        #4a3f2f;
    --ink3:        #7a6a52;
    --ink4:        #a89880;
    --ink5:        #c8b89a;
    --gold:        #b8892a;
    --gold2:       #d4a843;
    --gold3:       #e8c870;
    --font-display: 'Cinzel', serif;
    --font-body:    'Spectral', serif;
    --font-mono:    'Space Mono', monospace;
    --radius:       8px;
  }

  html, body, #root { height: 100%; }
  body {
    background: var(--parchment);
    color: var(--ink);
    font-family: var(--font-body);
    overflow: hidden;
    background-image: 
      radial-gradient(ellipse at 20% 50%, rgba(184,137,42,0.04) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(139,69,19,0.03) 0%, transparent 50%);
  }

  /* ── ALL YOUR ORIGINAL CSS GOES HERE (unchanged) ── */
  /* Paste everything from your old style block starting from ".label {" down to the end of the style block */
`;
// ── DATA ──────────────────────────────────────────────────────────────────────
const ERA_OPTIONS      = ["Contemporary / Realist","Neo-Noir","Sci-Fi Futurist","Period Drama","Horror / Gothic","Action Blockbuster","Indie / Arthouse","Animated / Stylized","Western","Thriller / Espionage"];
const LIGHTING_OPTIONS = ["High Contrast Chiaroscuro","Soft Natural Light","Neon / Practical Lights","Overcast Flat Light","Magic Hour / Golden Hour","Hard Backlight / Silhouette","Candle / Fire Lit","Clinical / Fluorescent","Day Exterior Bright","Low Key Night"];
const CAMERA_OPTIONS   = ["Handheld Intimate","Wide Anamorphic","Tight Telephoto","Documentary Observational","Steadicam Fluid","Static Locked Off","Drone Aerial","POV Immersive","Rack Focus Close","Classic Studio 3-Point"];
const FORMAT_OPTIONS   = [
  {label:"Cinematic 2.39:1", sub:"Anamorphic widescreen", ar:"2.39/1"},
  {label:"16:9 Standard",    sub:"Film & streaming",      ar:"16/9"},
  {label:"4:3 Classic",      sub:"Vintage / square",      ar:"4/3"},
  {label:"1:1 Square",       sub:"Social / experimental", ar:"1/1"},
  {label:"9:16 Vertical",    sub:"Mobile / short form",   ar:"9/16"},
  {label:"1.85:1 Academy",   sub:"US standard widescreen",ar:"1.85/1"},
];
const PALETTE_SWATCHES = [
  {color:"#1a1a2e",label:"Midnight"},{color:"#2d1b4e",label:"Deep Purple"},
  {color:"#0d2137",label:"Navy Deep"},{color:"#1a0a0a",label:"Blood Dark"},
  {color:"#0a1a0a",label:"Forest Night"},{color:"#2a1a08",label:"Burnt Amber"},
  {color:"#e8e0d0",label:"Bleached"},{color:"#c8b8a0",label:"Warm Film"},
  {color:"#a0c4c8",label:"Teal Wash"},{color:"#d4a0c0",label:"Dusty Rose"},
  {color:"#202030",label:"Cool Shadow"},{color:"#302010",label:"Sepia Dark"},
];
const WIZARD_STEPS = [
  {id:"identity",  label:"Project Identity",   sub:"Name & premise"},
  {id:"format",    label:"Format & Delivery",  sub:"Aspect ratio & medium"},
  {id:"style",     label:"Visual Style",       sub:"Palette, era, camera"},
  {id:"locations", label:"Locations",          sub:"Key sets & environments"},
  {id:"characters",label:"Characters",         sub:"Cast & descriptions"},
  {id:"props",     label:"Props",              sub:"Key objects (optional)"},
  {id:"review",    label:"Review & Launch",    sub:"Confirm your bible"},
];
const SAMPLE_SCRIPT = `EXT. TOKYO BACK ALLEY - NIGHT

A cardboard box. Rain falling hard. Neon signs reflected in black puddles.

A tiny black paw pushes through the cardboard flap from inside. Two cyan eyes open in the darkness.

STAR (V.O.)
...Alive. Corporeal again. Interesting.

He tries to stand. Wobbles immediately. Sits back down.

STAR (V.O.)
I am a cat.

EXT. TOKYO RESIDENTIAL STREET - SAME MOMENT

ANA drops silently from a second-floor window into the street below. Fists at her sides. Eyes wet but jaw set.

From inside — muffled shouting. Her father's voice, wrong in a way we can't yet name. She doesn't look back. She runs.

EXT. FORESTED HILLTOP - LATER

The rain eases. Tokyo below: a carpet of light. Ana crests the rise. Stops. Chest heaving.

She turns. Under a tree — a small black cat. Soaking wet. Sitting completely still. Looking at her like it was waiting.

One finger. Her pinky. The smallest possible gesture.

The cat touches it with its nose. The moonlight breaks through — immediately, like something decided to turn it up.

STAR
...You have terrible timing.

TITLE CARD: HOSHI  星`;

// ── HELPERS ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,8);

function generatePlaceholderImage(heading, index) {
  const canvas = document.createElement("canvas");
  canvas.width = 960; canvas.height = 540;
  const ctx = canvas.getContext("2d");
  const palettes = [
    ["#1a1228","#3d2060","#c084fc"],["#0c1520","#1a3a5c","#60a5fa"],
    ["#1a120a","#4a2c0a","#f59e0b"],["#0a1410","#1a3a20","#4ade80"],
    ["#1a0a0c","#3a1018","#f87171"],["#0e0e1a","#1e1e4a","#a5b4fc"],
  ];
  const p = palettes[index % palettes.length];
  const g = ctx.createLinearGradient(0,0,960,540);
  g.addColorStop(0,p[0]); g.addColorStop(0.6,p[1]); g.addColorStop(1,p[0]);
  ctx.fillStyle = g; ctx.fillRect(0,0,960,540);
  // Soft vignette
  const vig = ctx.createRadialGradient(480,270,100,480,270,480);
  vig.addColorStop(0,"transparent"); vig.addColorStop(1,"rgba(0,0,0,0.5)");
  ctx.fillStyle = vig; ctx.fillRect(0,0,960,540);
  // Glow
  const glow = ctx.createRadialGradient(480,270,0,480,270,260);
  glow.addColorStop(0,p[2]+"40"); glow.addColorStop(1,"transparent");
  ctx.fillStyle = glow; ctx.fillRect(0,0,960,540);
  // Text
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "500 22px 'Georgia'"; ctx.textAlign = "center";
  ctx.fillText(heading.toUpperCase().substring(0,38), 480, 258);
  ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.font = "12px 'Courier New'";
  ctx.fillText("SCENE "+(index+1)+" · STORYBOARD FRAME", 480, 290);
  return canvas.toDataURL("image/png");
}

async function callClaude(messages, system="") {
  const body = {model:ANTHROPIC_MODEL, max_tokens:1000, messages};
  if (system) body.system = system;
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if (!res.ok) throw new Error("API error "+res.status);
  const data = await res.json();
  return data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
}

function buildBibleContext(bible) {
  const p = [];
  if (bible.styleGuide.era)      p.push("ERA: "+bible.styleGuide.era);
  if (bible.styleGuide.lighting) p.push("LIGHTING: "+bible.styleGuide.lighting);
  if (bible.styleGuide.camera)   p.push("CAMERA: "+bible.styleGuide.camera);
  if (bible.styleGuide.palette)  p.push("PALETTE: "+bible.styleGuide.palette);
  if (bible.locations.length)    p.push("LOCATIONS: "+bible.locations.map(l=>l.name+(l.description?` (${l.description})`:"")).join("; "));
  if (bible.characters.length)   p.push("CHARACTERS: "+bible.characters.map(c=>c.name+(c.appearance?` — ${c.appearance}`:"")).join("; "));
  if (bible.props.length)        p.push("PROPS: "+bible.props.map(x=>x.name).join(", "));
  return p.length ? "\n\nPROJECT BIBLE:\n"+p.join("\n") : "";
}

function getMissing(bible) {
  const m = [];
  if (!bible.styleGuide.era)      m.push({key:"era",      label:"Film Era / Genre",    detail:"Defines the visual language"});
  if (!bible.styleGuide.lighting) m.push({key:"lighting", label:"Lighting Style",       detail:"Controls mood and atmosphere"});
  if (!bible.styleGuide.camera)   m.push({key:"camera",   label:"Camera & Lens Style",  detail:"Focal length and shot language"});
  if (!bible.characters.length)   m.push({key:"chars",    label:"No Characters Defined",detail:"Descriptions ensure visual consistency"});
  if (!bible.locations.length)    m.push({key:"locs",     label:"No Locations Defined", detail:"References guide environment generation"});
  return m;
}

// ── ENTITY CARD ───────────────────────────────────────────────────────────────
function EntityCard({entity, index, fields, onChange, onRemove}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="entity-card">
      <div className="entity-card-header" onClick={()=>setOpen(o=>!o)}>
        <div className="entity-card-title">
          <span className="entity-num">{String(index+1).padStart(2,"0")}</span>
          <span>{entity.name || <span style={{color:"var(--ink5)",fontStyle:"italic"}}>Unnamed</span>}</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button className="btn btn-xs btn-danger" onClick={e=>{e.stopPropagation();onRemove();}}>Remove</button>
          <span style={{color:"var(--ink5)",fontSize:10}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      <div className={`entity-card-body${open?"":" collapsed"}`}>
        {fields.map(f=>(
          <div className="field" key={f.key}>
            <label className="label">{f.label}</label>
            {f.type==="textarea"
              ? <textarea className="textarea-el" rows={3} placeholder={f.placeholder||""} value={entity[f.key]||""} onChange={e=>onChange(f.key,e.target.value)}/>
              : <input className="input" placeholder={f.placeholder||""} value={entity[f.key]||""} onChange={e=>onChange(f.key,e.target.value)}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WIZARD ────────────────────────────────────────────────────────────────────
function Wizard({onComplete}) {
  const [step, setStep] = useState(0);
  const [bible, setBible] = useState({
    projectName:"", logline:"", genre:"",
    styleGuide:{era:"",lighting:"",camera:"",palette:"",format:""},
    locations:[], characters:[], props:[],
  });

  const update = (path, value) => {
    setBible(prev=>{
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let cur = next;
      for (let i=0;i<keys.length-1;i++) cur=cur[keys[i]];
      cur[keys[keys.length-1]] = value;
      return next;
    });
  };
  const updateList = (key,id,f,v) => update(key, bible[key].map(x=>x.id===id?{...x,[f]:v}:x));
  const removeFrom = (key,id) => update(key, bible[key].filter(x=>x.id!==id));

  const canProceed = () => {
    if (step===0) return bible.projectName.trim().length>0;
    if (step===1) return !!bible.styleGuide.format;
    if (step===2) return !!(bible.styleGuide.era&&bible.styleGuide.lighting&&bible.styleGuide.camera);
    return true;
  };
  const isRequired = step<=2;
  const sid = WIZARD_STEPS[step].id;

  return (
    <div className="wizard-shell">
      <style>{style}</style>
      <aside className="wiz-sidebar">
        <div className="wiz-brand">
          <div className="wiz-brand-name">
            KANTOKU <span className="wiz-brand-kanji">監督</span>
          </div>
          <div className="wiz-brand-sub">Project Setup</div>
        </div>
        <div className="wiz-steps">
          {WIZARD_STEPS.map((s,i)=>(
            <div key={s.id} className={`wiz-step${i===step?" active":""}${i<step?" done":""}`} onClick={()=>{if(i<step)setStep(i);}}>
              <div className="step-orb">{i<step?"✓":i+1}</div>
              <div className="step-text">
                <div className="step-label">{s.label}</div>
                <div className="step-sub">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="wiz-sidebar-footer">
          <p>"This is your project bible. The effort you put in here shows in every frame."</p>
        </div>
      </aside>

      <div className="wiz-content">
        <div className="wiz-body">

          {sid==="identity"&&(
            <>
              <div className="wiz-step-title">Your Project</div>
              <div className="wiz-step-sub">Name it. Own it. Know what it is.</div>
              <div className="wiz-divider"/>
              <div style={{display:"flex",flexDirection:"column",gap:20,maxWidth:520}}>
                <div className="field"><label className="label">Project Name *</label>
                  <input className="input" style={{fontSize:18,fontFamily:"var(--font-display)",letterSpacing:2,fontWeight:300}} placeholder="e.g. The Hollow Coast" value={bible.projectName} onChange={e=>update("projectName",e.target.value)}/>
                </div>
                <div className="field"><label className="label">Logline</label>
                  <textarea className="textarea-el" rows={3} placeholder="One or two sentences. What happens and why does it matter?" value={bible.logline} onChange={e=>update("logline",e.target.value)}/>
                </div>
                <div className="field"><label className="label">Genre Tags</label>
                  <input className="input" placeholder="e.g. Neo-noir, Psychological Thriller, Sci-fi" value={bible.genre} onChange={e=>update("genre",e.target.value)}/>
                </div>
              </div>
            </>
          )}

          {sid==="format"&&(
            <>
              <div className="wiz-step-title">Format</div>
              <div className="wiz-step-sub">How will this be seen? *</div>
              <div className="wiz-divider"/>
              <div className="card-grid card-grid-3">
                {FORMAT_OPTIONS.map(f=>(
                  <div key={f.ar} className={`select-card${bible.styleGuide.format===f.ar?" selected":""}`} onClick={()=>update("styleGuide.format",f.ar)}>
                    <div className="format-visual" style={{aspectRatio:f.ar}}/>
                    <div className="select-card-label">{f.label}</div>
                    <div className="select-card-sub">{f.sub}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {sid==="style"&&(
            <>
              <div className="wiz-step-title">Visual Style</div>
              <div className="wiz-step-sub">Your camera. Your palette. Your light. *</div>
              <div className="wiz-divider"/>
              <div style={{display:"flex",flexDirection:"column",gap:28,maxWidth:640}}>
                <div className="field"><label className="label">Film Era / Genre *</label>
                  <div className="card-grid card-grid-2">
                    {ERA_OPTIONS.map(o=><div key={o} className={`select-card${bible.styleGuide.era===o?" selected":""}`} onClick={()=>update("styleGuide.era",o)}><div className="select-card-label">{o}</div></div>)}
                  </div>
                </div>
                <div className="field"><label className="label">Lighting Style *</label>
                  <div className="card-grid card-grid-2">
                    {LIGHTING_OPTIONS.map(o=><div key={o} className={`select-card${bible.styleGuide.lighting===o?" selected":""}`} onClick={()=>update("styleGuide.lighting",o)}><div className="select-card-label">{o}</div></div>)}
                  </div>
                </div>
                <div className="field"><label className="label">Camera & Lens Language *</label>
                  <div className="card-grid card-grid-2">
                    {CAMERA_OPTIONS.map(o=><div key={o} className={`select-card${bible.styleGuide.camera===o?" selected":""}`} onClick={()=>update("styleGuide.camera",o)}><div className="select-card-label">{o}</div></div>)}
                  </div>
                </div>
                <div className="field"><label className="label">Dominant Colour Palette</label>
                  <div className="swatch-row" style={{marginTop:4}}>
                    {PALETTE_SWATCHES.map(s=><div key={s.color} className={`swatch${bible.styleGuide.palette===s.color?" selected":""}`} style={{background:s.color}} title={s.label} onClick={()=>update("styleGuide.palette",s.color)}/>)}
                  </div>
                </div>
              </div>
            </>
          )}

          {sid==="locations"&&(
            <>
              <div className="wiz-step-title">Locations</div>
              <div className="wiz-step-sub">Where does this world exist?</div>
              <div className="wiz-divider"/>
              <div style={{maxWidth:540}}>
                <div className="entity-list">
                  {bible.locations.map((loc,i)=>(
                    <EntityCard key={loc.id} entity={loc} index={i}
                      fields={[{key:"name",label:"Location Name",placeholder:"e.g. Rooftop Helipad"},{key:"description",label:"Visual Description",placeholder:"What does it look, feel, smell like?",type:"textarea"},{key:"time",label:"Typical Time of Day",placeholder:"Night, Dawn, Variable..."}]}
                      onChange={(f,v)=>updateList("locations",loc.id,f,v)} onRemove={()=>removeFrom("locations",loc.id)}/>
                  ))}
                </div>
                <button className="add-entity-btn" onClick={()=>update("locations",[...bible.locations,{id:uid(),name:"",description:"",time:""}])}>+ Add Location</button>
                <p style={{fontSize:12,color:"var(--ink4)",marginTop:12,fontStyle:"italic",lineHeight:1.7}}>Optional — location context is injected when generating frames for matching scenes.</p>
              </div>
            </>
          )}

          {sid==="characters"&&(
            <>
              <div className="wiz-step-title">Characters</div>
              <div className="wiz-step-sub">Who lives in this world?</div>
              <div className="wiz-divider"/>
              <div style={{maxWidth:540}}>
                <div className="entity-list">
                  {bible.characters.map((c,i)=>(
                    <EntityCard key={c.id} entity={c} index={i}
                      fields={[{key:"name",label:"Character Name",placeholder:"e.g. Detective Reyes"},{key:"role",label:"Role",placeholder:"Protagonist, Antagonist, Supporting"},{key:"appearance",label:"Physical Appearance",placeholder:"Age, build, defining features...",type:"textarea"},{key:"description",label:"Costume / Style",placeholder:"What do they typically wear?",type:"textarea"}]}
                      onChange={(f,v)=>updateList("characters",c.id,f,v)} onRemove={()=>removeFrom("characters",c.id)}/>
                  ))}
                </div>
                <button className="add-entity-btn" onClick={()=>update("characters",[...bible.characters,{id:uid(),name:"",role:"",description:"",appearance:""}])}>+ Add Character</button>
                <p style={{fontSize:12,color:"var(--ink4)",marginTop:12,fontStyle:"italic",lineHeight:1.7}}>Optional — character descriptions are injected into image prompts whenever they appear in a scene.</p>
              </div>
            </>
          )}

          {sid==="props"&&(
            <>
              <div className="wiz-step-title">Key Props</div>
              <div className="wiz-step-sub">Objects that need to stay consistent</div>
              <div className="wiz-divider"/>
              <div style={{maxWidth:540}}>
                <div className="entity-list">
                  {bible.props.map((p,i)=>(
                    <EntityCard key={p.id} entity={p} index={i}
                      fields={[{key:"name",label:"Prop Name",placeholder:"e.g. The Briefcase"},{key:"description",label:"Description",placeholder:"Material, colour, condition, distinguishing marks...",type:"textarea"}]}
                      onChange={(f,v)=>updateList("props",p.id,f,v)} onRemove={()=>removeFrom("props",p.id)}/>
                  ))}
                </div>
                <button className="add-entity-btn" onClick={()=>update("props",[...bible.props,{id:uid(),name:"",description:""}])}>+ Add Prop</button>
                <p style={{fontSize:12,color:"var(--ink4)",marginTop:12,fontStyle:"italic",lineHeight:1.7}}>Optional — for hero objects that appear repeatedly and need a consistent look.</p>
              </div>
            </>
          )}

          {sid==="review"&&(
            <>
              <div className="wiz-step-title">Your Bible</div>
              <div className="wiz-step-sub">Review before you shoot</div>
              <div className="wiz-divider"/>
              <div style={{maxWidth:560}}>
                <div className="bible-block">
                  <div className="bible-block-header"><span className="label">Project Identity</span><button className="btn btn-xs btn-ghost" onClick={()=>setStep(0)}>Edit</button></div>
                  <div className="bible-block-body">
                    <div className="bible-row"><span className="bible-key">Name</span><span style={{fontFamily:"var(--font-display)",fontSize:16,fontWeight:300}}>{bible.projectName}</span></div>
                    {bible.logline&&<div className="bible-row"><span className="bible-key">Logline</span><span style={{fontStyle:"italic"}}>{bible.logline}</span></div>}
                    {bible.genre&&<div className="bible-row"><span className="bible-key">Genre</span><span>{bible.genre}</span></div>}
                  </div>
                </div>
                <div className="bible-block">
                  <div className="bible-block-header"><span className="label">Visual Style</span><div style={{display:"flex",gap:5}}><button className="btn btn-xs btn-ghost" onClick={()=>setStep(1)}>Format</button><button className="btn btn-xs btn-ghost" onClick={()=>setStep(2)}>Style</button></div></div>
                  <div className="bible-block-body">
                    <div className="bible-row"><span className="bible-key">Format</span><span>{bible.styleGuide.format||"—"}</span></div>
                    <div className="bible-row"><span className="bible-key">Era</span><span>{bible.styleGuide.era||"—"}</span></div>
                    <div className="bible-row"><span className="bible-key">Lighting</span><span>{bible.styleGuide.lighting||"—"}</span></div>
                    <div className="bible-row"><span className="bible-key">Camera</span><span>{bible.styleGuide.camera||"—"}</span></div>
                    {bible.styleGuide.palette&&<div className="bible-row"><span className="bible-key">Palette</span><span style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:14,height:14,borderRadius:3,background:bible.styleGuide.palette,display:"inline-block",border:"1px solid var(--parchment4)"}}/>{PALETTE_SWATCHES.find(s=>s.color===bible.styleGuide.palette)?.label}</span></div>}
                  </div>
                </div>
                {bible.locations.length>0&&<div className="bible-block"><div className="bible-block-header"><span className="label">Locations ({bible.locations.length})</span><button className="btn btn-xs btn-ghost" onClick={()=>setStep(3)}>Edit</button></div><div className="bible-block-body">{bible.locations.map(l=><div key={l.id} className="bible-row"><span className="bible-key">{l.name}</span><span style={{fontStyle:"italic"}}>{l.description}</span></div>)}</div></div>}
                {bible.characters.length>0&&<div className="bible-block"><div className="bible-block-header"><span className="label">Characters ({bible.characters.length})</span><button className="btn btn-xs btn-ghost" onClick={()=>setStep(4)}>Edit</button></div><div className="bible-block-body">{bible.characters.map(c=><div key={c.id} className="bible-row"><span className="bible-key">{c.name}</span><span style={{fontStyle:"italic"}}>{c.role}{c.appearance?` — ${c.appearance.substring(0,60)}...`:""}</span></div>)}</div></div>}
                {bible.props.length>0&&<div className="bible-block"><div className="bible-block-header"><span className="label">Props ({bible.props.length})</span><button className="btn btn-xs btn-ghost" onClick={()=>setStep(5)}>Edit</button></div><div className="bible-block-body">{bible.props.map(p=><div key={p.id} className="bible-row"><span className="bible-key">{p.name}</span><span style={{fontStyle:"italic"}}>{p.description}</span></div>)}</div></div>}
                <div style={{marginTop:12,padding:"12px 16px",background:"rgba(184,137,42,0.05)",border:"1px solid rgba(184,137,42,0.2)",borderRadius:"var(--radius)",borderLeft:"3px solid var(--gold)"}}>
                  <p style={{fontFamily:"var(--font-display)",fontSize:14,color:"var(--gold)",fontStyle:"italic",fontWeight:300,lineHeight:1.6}}>This context will be silently woven into every generation call. Your vision, preserved across every frame.</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="wiz-footer">
          <div style={{display:"flex",gap:8}}>
            {step>0&&<button className="btn btn-ghost" onClick={()=>setStep(s=>s-1)}>← Back</button>}
            {!isRequired&&step<WIZARD_STEPS.length-1&&<button className="btn btn-ghost" style={{color:"var(--ink4)"}} onClick={()=>setStep(s=>s+1)}>Skip for now</button>}
          </div>
          <div className="wiz-progress-text">{step+1} of {WIZARD_STEPS.length}</div>
          <div>
            {step<WIZARD_STEPS.length-1
              ? <button className="btn btn-primary" onClick={()=>setStep(s=>s+1)} disabled={!canProceed()}>{isRequired?"Continue →":"Next →"}</button>
              : <button className="btn btn-primary" onClick={()=>onComplete(bible)} style={{padding:"11px 28px",letterSpacing:2}}>Open Workspace →</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CHECKLIST POPUP ───────────────────────────────────────────────────────────
function ConsistencyChecklist({bible, onDismiss, onProceed, onGoToSettings}) {
  const missing = getMissing(bible);
  const allGood = missing.length===0;
  const allItems = [
    {key:"era",      label:"Film Era / Genre",   ok:!!bible.styleGuide.era},
    {key:"lighting", label:"Lighting Style",      ok:!!bible.styleGuide.lighting},
    {key:"camera",   label:"Camera & Lens Style", ok:!!bible.styleGuide.camera},
    {key:"chars",    label:"Characters Defined",  ok:bible.characters.length>0},
    {key:"locs",     label:"Locations Defined",   ok:bible.locations.length>0},
  ];
  return (
    <div className="overlay-backdrop" onClick={onDismiss}>
      <div className="checklist-popup" onClick={e=>e.stopPropagation()}>
        <div className="checklist-header">
          <div>
            <div className="checklist-title">{allGood?"Bible Complete":"Consistency Check"}</div>
            <div className="checklist-sub">{allGood?"All reference fields set — full bible will be injected":"Some fields are missing — generation quality may be inconsistent"}</div>
          </div>
          <button className="btn btn-xs btn-ghost" onClick={onDismiss}>✕</button>
        </div>
        <div className="checklist-body">
          {allItems.map(item=>(
            <div key={item.key} className={`check-item ${item.ok?"ok":"missing"}`} onClick={()=>{if(!item.ok){onGoToSettings();onDismiss();}}}>
              <div className="check-icon">{item.ok?"✓":"!"}</div>
              <div style={{flex:1}}>
                <div className="check-label">{item.label}</div>
                {!item.ok&&<div className="check-detail">Click to add in Settings →</div>}
              </div>
              {item.ok?<span className="badge badge-vid">Set</span>:<span className="badge badge-warn">Missing</span>}
            </div>
          ))}
        </div>
        <div className="checklist-footer">
          <p>{allGood?"Generation will reference your full project bible.":"Missing fields reduce visual consistency across frames."}</p>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            {!allGood&&<button className="btn btn-ghost btn-sm" onClick={()=>{onGoToSettings();onDismiss();}}>Open Settings</button>}
            <button className="btn btn-primary btn-sm" onClick={onProceed}>{allGood?"Generate":"Proceed Anyway"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS PANEL ────────────────────────────────────────────────────────────
function SettingsPanel({bible, onUpdate}) {
  const update = (path, value) => {
    const next = JSON.parse(JSON.stringify(bible));
    const keys = path.split(".");
    let cur = next;
    for (let i=0;i<keys.length-1;i++) cur=cur[keys[i]];
    cur[keys[keys.length-1]] = value;
    onUpdate(next);
  };
  const updateList = (key,id,f,v) => update(key, bible[key].map(x=>x.id===id?{...x,[f]:v}:x));
  const removeFrom = (key,id) => update(key, bible[key].filter(x=>x.id!==id));

  return (
    <div className="settings-body">
      <div className="settings-section">
        <div className="settings-section-header"><span className="label">Project Identity</span></div>
        <div className="settings-section-body">
          <div className="field"><label className="label">Project Name</label><input className="input" value={bible.projectName} onChange={e=>update("projectName",e.target.value)}/></div>
          <div className="field"><label className="label">Logline</label><textarea className="textarea-el" rows={2} value={bible.logline} onChange={e=>update("logline",e.target.value)}/></div>
          <div className="field"><label className="label">Genre</label><input className="input" value={bible.genre} onChange={e=>update("genre",e.target.value)}/></div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-header"><span className="label">Visual Style Guide</span></div>
        <div className="settings-section-body">
          {[{key:"era",label:"Film Era / Genre",opts:ERA_OPTIONS},{key:"lighting",label:"Lighting Style",opts:LIGHTING_OPTIONS},{key:"camera",label:"Camera & Lens Style",opts:CAMERA_OPTIONS}].map(f=>(
            <div className="field" key={f.key}><label className="label">{f.label}</label>
              <select className="select-el" value={bible.styleGuide[f.key]} onChange={e=>update("styleGuide."+f.key,e.target.value)}>
                <option value="">— Not set</option>
                {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="field"><label className="label">Dominant Palette</label>
            <div className="swatch-row" style={{marginTop:4}}>
              {PALETTE_SWATCHES.map(s=><div key={s.color} className={`swatch${bible.styleGuide.palette===s.color?" selected":""}`} style={{background:s.color}} title={s.label} onClick={()=>update("styleGuide.palette",s.color)}/>)}
            </div>
          </div>
          <div className="field"><label className="label">Format</label>
            <select className="select-el" value={bible.styleGuide.format} onChange={e=>update("styleGuide.format",e.target.value)}>
              <option value="">— Not set</option>
              {FORMAT_OPTIONS.map(f=><option key={f.ar} value={f.ar}>{f.label}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-header"><span className="label">Locations ({bible.locations.length})</span></div>
        <div className="settings-section-body">
          {bible.locations.map((loc,i)=><EntityCard key={loc.id} entity={loc} index={i} fields={[{key:"name",label:"Name",placeholder:"e.g. Rooftop Helipad"},{key:"description",label:"Description",placeholder:"Visual feel of this space",type:"textarea"},{key:"time",label:"Time of Day",placeholder:"Night, Dawn, Variable..."}]} onChange={(f,v)=>updateList("locations",loc.id,f,v)} onRemove={()=>removeFrom("locations",loc.id)}/>)}
          <button className="add-entity-btn" onClick={()=>update("locations",[...bible.locations,{id:uid(),name:"",description:"",time:""}])}>+ Add Location</button>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-header"><span className="label">Characters ({bible.characters.length})</span></div>
        <div className="settings-section-body">
          {bible.characters.map((c,i)=><EntityCard key={c.id} entity={c} index={i} fields={[{key:"name",label:"Name",placeholder:"e.g. Detective Reyes"},{key:"role",label:"Role",placeholder:"Protagonist, Antagonist..."},{key:"appearance",label:"Appearance",placeholder:"Physical description",type:"textarea"},{key:"description",label:"Costume / Style",placeholder:"What they wear",type:"textarea"}]} onChange={(f,v)=>updateList("characters",c.id,f,v)} onRemove={()=>removeFrom("characters",c.id)}/>)}
          <button className="add-entity-btn" onClick={()=>update("characters",[...bible.characters,{id:uid(),name:"",role:"",description:"",appearance:""}])}>+ Add Character</button>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-header"><span className="label">Props ({bible.props.length})</span></div>
        <div className="settings-section-body">
          {bible.props.map((p,i)=><EntityCard key={p.id} entity={p} index={i} fields={[{key:"name",label:"Prop Name",placeholder:"e.g. The Briefcase"},{key:"description",label:"Description",placeholder:"Material, colour, condition...",type:"textarea"}]} onChange={(f,v)=>updateList("props",p.id,f,v)} onRemove={()=>removeFrom("props",p.id)}/>)}
          <button className="add-entity-btn" onClick={()=>update("props",[...bible.props,{id:uid(),name:"",description:""}])}>+ Add Prop</button>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-header"><span className="label">Model Training</span><span className="badge badge-soon">Coming Soon</span></div>
        <div className="settings-section-body">
          <p style={{fontSize:13,color:"var(--ink4)",fontStyle:"italic",lineHeight:1.7}}>LoRA training pipeline — train a custom model on your character and location references for maximum visual consistency. Available in the desktop release.</p>
          <button className="btn btn-ghost btn-sm" disabled style={{width:"100%",opacity:0.35}}>Train Character Model</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
function MainApp({bible: initBible}) {
  const [bible, setBible]             = useState(initBible);
  const [script, setScript]           = useState(SAMPLE_SCRIPT);
  const [scenes, setScenes]           = useState([]);
  const [activeScene, setActiveScene] = useState(null);
  const [parsing, setParsing]         = useState(false);
  const [tab, setTab]                 = useState("script");
  const [notification, setNotification] = useState(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [collapsed, setCollapsed]     = useState(false);
  const [panelWidth, setPanelWidth]   = useState(320);
  const [draggingDiv, setDraggingDiv] = useState(false);
  const [dragScene, setDragScene]     = useState(null);
  const [dragOver, setDragOver]       = useState(null);

  const notifTimer  = useRef(null);
  const dividerRef  = useRef(null);
  const startXRef   = useRef(0);
  const startWRef   = useRef(0);
  const sceneListRef = useRef(null);

  const notify = (msg, type="info") => {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotification({msg,type});
    notifTimer.current = setTimeout(()=>setNotification(null), 3500);
  };

  // ── Resizable panel ──
  const onDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    setDraggingDiv(true);
    startXRef.current = e.clientX;
    startWRef.current = panelWidth;
    const onMove = (e) => {
      const delta = e.clientX - startXRef.current;
      const newW = Math.max(220, Math.min(500, startWRef.current + delta));
      setPanelWidth(newW);
    };
    const onUp = () => {
      setDraggingDiv(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [panelWidth]);

  // ── Drag-and-drop scene reorder ──
  const onDragStart = (e, id) => { setDragScene(id); e.dataTransfer.effectAllowed = "move"; };
  const onDragOver  = (e, id) => { e.preventDefault(); setDragOver(id); };
  const onDrop      = (e, id) => {
    e.preventDefault();
    if (dragScene===null || dragScene===id) { setDragScene(null); setDragOver(null); return; }
    setScenes(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(s=>s.id===dragScene);
      const toIdx   = arr.findIndex(s=>s.id===id);
      const [moved] = arr.splice(fromIdx,1);
      arr.splice(toIdx,0,moved);
      return arr;
    });
    setDragScene(null); setDragOver(null);
  };
  const onDragEnd = () => { setDragScene(null); setDragOver(null); };

  // ── Gated generation ──
  const gated = (fn) => {
    const m = getMissing(bible);
    if (m.length>0) { setPendingAction(()=>fn); setChecklistOpen(true); }
    else fn();
  };

  const parseScript = () => gated(_parseScript);
  const _parseScript = async () => {
    if (!script.trim()) return notify("Paste a script first.", "error");
    setParsing(true); setScenes([]); setActiveScene(null);
    try {
      const raw = await callClaude(
        [{role:"user",content:`Parse this screenplay into scenes. Return ONLY a JSON array. Each element: {"heading":"scene heading","location":"place","time":"day/night/etc","description":"2-3 sentence visual description","characters":["name1"],"action":"key action beat","mood":"emotional tone","imagePrompt":"vivid cinematic image prompt"}\n\nScript:\n${script}${buildBibleContext(bible)}`}],
        "You are a professional screenplay analyst. Return ONLY valid JSON, no markdown, no explanation."
      );
      let parsed;
      try { parsed = JSON.parse(raw.replace(/```json|```/g,"").trim()); }
      catch { throw new Error("Could not parse scene data"); }
      const s = parsed.map((x,i)=>({...x,id:i,imageUrl:null,videoUrl:null,generating:false}));
      setScenes(s); setActiveScene(0);
      notify(`Parsed ${s.length} scenes`, "success");
      setTab("scenes");
    } catch(e) { notify("Parse failed: "+e.message, "error"); }
    setParsing(false);
  };

  const generateImage = (id) => gated(()=>_generateImage(id));
  const _generateImage = async (id) => {
    setScenes(prev=>prev.map(s=>s.id===id?{...s,generating:"image"}:s));
    await new Promise(r=>setTimeout(r,1000+Math.random()*700));
    const scene = scenes.find(s=>s.id===id);
    const img = generatePlaceholderImage(scene?.heading||"",id);
    setScenes(prev=>prev.map(s=>s.id===id?{...s,imageUrl:img,generating:false}:s));
    notify("Frame generated for scene "+(id+1),"success");
  };

  const generateAllImages = () => gated(_generateAllImages);
  const _generateAllImages = async () => {
    const pending = scenes.filter(s=>!s.imageUrl);
    if (!pending.length) return notify("All frames generated","info");
    for (const s of pending) await _generateImage(s.id);
    notify("All frames generated","success");
  };

  const generateVideo = (id) => {
    if (!scenes.find(s=>s.id===id)?.imageUrl) return notify("Generate frame first","error");
    gated(()=>_generateVideo(id));
  };
  const _generateVideo = async (id) => {
    setScenes(prev=>prev.map(s=>s.id===id?{...s,generating:"video"}:s));
    await new Promise(r=>setTimeout(r,2000+Math.random()*1000));
    setScenes(prev=>prev.map(s=>s.id===id?{...s,videoUrl:"generated",generating:false}:s));
    notify("Clip ready for scene "+(id+1),"success");
  };

  const asd = scenes.find(s=>s.id===activeScene);
  const missingCount = getMissing(bible).length;
  const imagesGenerated = scenes.filter(s=>s.imageUrl).length;
  const videosGenerated = scenes.filter(s=>s.videoUrl).length;

  return (
    <>
      <style>{style}</style>
      <div className="app">
        {/* HEADER */}
        <header className="header">
          <div className="header-left">
            <div className="logo">
              <div className="logo-dot"/>
              KANTOKU
              <span className="logo-kanji">監督</span>
            </div>
            {bible.projectName&&(
              <div className="header-project">
                <span>{bible.projectName}</span>
                {bible.styleGuide.era&&<><span style={{color:"var(--parchment4)"}}>·</span><span style={{color:"var(--gold)"}}>{bible.styleGuide.era}</span></>}
              </div>
            )}
          </div>
          <div className="header-right">
            <span>{scenes.length} scenes</span>
            <span style={{color:"var(--parchment4)"}}>·</span>
            <span>{imagesGenerated} frames</span>
            <span style={{color:"var(--parchment4)"}}>·</span>
            <span>{videosGenerated} clips</span>
            {missingCount>0&&(
              <span className="badge badge-warn" style={{cursor:"pointer"}} onClick={()=>setChecklistOpen(true)}>
                {missingCount} missing
              </span>
            )}
            <div className={`status-pill${parsing?" active":""}`}>
              <div className="sdot"/>
              {parsing?"Processing":"Ready"}
            </div>
          </div>
        </header>

        <div className="main">
          {/* LEFT PANEL */}
          <div
            className={`left-panel${collapsed?" collapsed":""}`}
            style={collapsed ? {} : {width:panelWidth}}
          >
            <div className="tab-bar">
              <div className={`tab${tab==="script"?" active":""}`} onClick={()=>setTab("script")}>Script</div>
              <div className={`tab${tab==="scenes"?" active":""}`} onClick={()=>setTab("scenes")}>
                Scenes <span className="tab-count">{scenes.length}</span>
              </div>
              <div className={`tab${tab==="settings"?" active":""}`} onClick={()=>setTab("settings")}>
                Settings
                {missingCount>0&&<span className="tab-count" style={{background:"rgba(139,69,19,0.1)",color:"var(--rust)"}}>{missingCount}</span>}
              </div>
            </div>

            {tab==="script"&&(
              <div className="script-area">
                <div className="textarea-wrap">
                  <div className="textarea-inner-label">Screenplay Input</div>
                  <textarea value={script} onChange={e=>setScript(e.target.value)} placeholder="Paste your screenplay or story here..."/>
                </div>
                <button className="btn btn-primary" onClick={parseScript} disabled={parsing}>
                  {parsing?<><span className="spinner"/>Analysing…</>:"Parse Script →"}
                </button>
                {scenes.length>0&&<button className="btn btn-ghost" onClick={()=>setTab("scenes")}>View {scenes.length} scenes →</button>}
              </div>
            )}

            {tab==="scenes"&&(
              <>
                <div className="panel-header">
                  <span className="label">Scene List</span>
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn btn-soft btn-sm" onClick={generateAllImages} disabled={!scenes.length||parsing}>⚡ All Frames</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setTab("script")}>+ Script</button>
                  </div>
                </div>
                {scenes.length===0
                  ? <div style={{padding:20,textAlign:"center",color:"var(--ink4)",fontFamily:"var(--font-mono)",fontSize:11,lineHeight:2}}>
                      No scenes yet.<br/>
                      <button className="btn btn-primary btn-sm" style={{marginTop:10,width:"100%"}} onClick={()=>setTab("script")}>Go to Script</button>
                    </div>
                  : <div className="scene-list-wrap" ref={sceneListRef}>
                      {parsing&&<div className="loading-bar" style={{marginBottom:10}}/>}
                      {scenes.map((sc,i)=>(
                        <div
                          key={sc.id}
                          className={`scene-item${activeScene===sc.id?" active":""}${dragScene===sc.id?" dragging":""}${dragOver===sc.id?" drag-over":""}`}
                          onClick={()=>setActiveScene(sc.id)}
                          draggable
                          onDragStart={e=>onDragStart(e,sc.id)}
                          onDragOver={e=>onDragOver(e,sc.id)}
                          onDrop={e=>onDrop(e,sc.id)}
                          onDragEnd={onDragEnd}
                        >
                          <span className="scene-drag-handle" title="Drag to reorder">⠿</span>
                          <div className="scene-num">{String(i+1).padStart(2,"0")}</div>
                          <div className="scene-info">
                            <div className="scene-heading">{sc.heading||"Untitled"}</div>
                            <div className="scene-desc">{sc.description}</div>
                          </div>
                          <div className="scene-badges">
                            {sc.videoUrl?<span className="badge badge-vid">Clip</span>
                              :sc.imageUrl?<span className="badge badge-img">Frame</span>
                              :<span className="badge badge-raw">Raw</span>}
                            {sc.generating&&<span className="spinner" style={{width:10,height:10}}/>}
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </>
            )}

            {tab==="settings"&&(
              <>
                <div className="panel-header">
                  <span className="label">Project Bible</span>
                  {missingCount>0&&<span className="badge badge-warn">{missingCount} missing</span>}
                </div>
                <SettingsPanel bible={bible} onUpdate={setBible}/>
              </>
            )}
          </div>

          {/* PANEL DIVIDER */}
          {!collapsed&&(
            <div
              className={`panel-divider${draggingDiv?" dragging":""}`}
              onMouseDown={onDividerMouseDown}
              ref={dividerRef}
            />
          )}

          {/* COLLAPSE BUTTON */}
          <button
            className="collapse-btn"
            style={collapsed?{left:0}:{left:panelWidth+4}}
            onClick={()=>setCollapsed(c=>!c)}
            title={collapsed?"Expand panel":"Collapse panel"}
          >
            {collapsed?"›":"‹"}
          </button>

          {/* RIGHT PANEL */}
          <div className="right-panel">
            {!asd?(
              <div className="empty-state">
                <div className="empty-ornament">監</div>
                <div className="empty-title">{bible.projectName||"Kantoku"}</div>
                <div className="empty-sub">
                  {[bible.styleGuide.era,bible.styleGuide.lighting,bible.styleGuide.camera].filter(Boolean).join("  ·  ")}
                  {(bible.styleGuide.era||bible.styleGuide.lighting)&&<br/>}
                  Paste script → Parse → Generate
                </div>
                {missingCount>0&&(
                  <div
                    style={{padding:"10px 18px",background:"rgba(139,69,19,0.06)",border:"1px solid rgba(139,69,19,0.2)",borderRadius:"var(--radius)",cursor:"pointer",fontFamily:"var(--font-mono)",fontSize:10,color:"var(--rust)",letterSpacing:1}}
                    onClick={()=>setTab("settings")}
                  >
                    {missingCount} consistency fields missing — open settings
                  </div>
                )}
              </div>
            ):(
              <>
                <div className="scene-detail">
                  <div className="detail-header">
                    <div>
                      <div className="detail-title">Scene {activeScene+1} — {asd.heading||"Untitled"}</div>
                      <div className="detail-meta">
                        {[asd.location, asd.time, ...(asd.characters||[])].filter(Boolean).join("  ·  ")}
                      </div>
                    </div>
                    <div className="detail-actions">
                      <div className="bible-notice">✦ Bible active</div>
                      <button className="btn btn-soft btn-sm" onClick={()=>generateImage(asd.id)} disabled={!!asd.generating}>
                        {asd.generating==="image"?<><span className="spinner"/>Generating…</>:"Generate Frame"}
                      </button>
                      <button className="btn btn-soft btn-sm" onClick={()=>generateVideo(asd.id)} disabled={!!asd.generating||!asd.imageUrl}>
                        {asd.generating==="video"?<><span className="spinner"/>Rendering…</>:"▶ Generate Clip"}
                      </button>
                      {activeScene>0&&<button className="btn btn-ghost btn-sm" onClick={()=>setActiveScene(a=>a-1)}>← Prev</button>}
                      {activeScene<scenes.length-1&&<button className="btn btn-ghost btn-sm" onClick={()=>setActiveScene(a=>a+1)}>Next →</button>}
                    </div>
                  </div>

                  <div className="detail-body">
                    <div className="media-section">
                      <div className="section-label">Storyboard Frame</div>
                      <div className="media-wrap">
                        {asd.imageUrl
                          ? <img src={asd.imageUrl} className="media-img" alt="Scene frame"/>
                          : <div className="media-placeholder">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                              <span>No frame yet</span>
                            </div>}
                        {asd.generating==="image"&&(
                          <div className="generating-overlay">
                            <div className="spinner" style={{width:26,height:26,borderWidth:2}}/>
                            <div className="gen-label">Rendering frame…</div>
                          </div>
                        )}
                      </div>
                      {asd.imageUrl&&<p style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--ink5)",lineHeight:1.7}}><span style={{color:"var(--ink4)"}}>Prompt — </span>{asd.imagePrompt}</p>}
                    </div>

                    <div className="media-section">
                      <div className="section-label">Video Clip</div>
                      <div className="media-wrap">
                        {asd.videoUrl?(
                          <div style={{aspectRatio:"16/9",borderRadius:"var(--radius)",border:"1px solid var(--parchment4)",position:"relative",overflow:"hidden",background:asd.imageUrl?"#000":"var(--parchment2)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px var(--shadow2)"}}>
                            {asd.imageUrl&&<img src={asd.imageUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.6}} alt=""/>}
                            <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
                              <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(184,137,42,0.15)",border:"1px solid rgba(184,137,42,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,margin:"0 auto 8px",backdropFilter:"blur(8px)",color:"var(--gold-light)"}}>▶</div>
                              <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--gold-light)",letterSpacing:2}}>Clip Ready</div>
                              <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"rgba(245,228,176,0.5)",marginTop:4}}>4.2s · 24fps · 1080p</div>
                            </div>
                          </div>
                        ):(
                          <div className="media-placeholder">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                            <span>{asd.imageUrl?"Click Generate Clip above":"Generate a frame first"}</span>
                          </div>
                        )}
                        {asd.generating==="video"&&(
                          <div className="generating-overlay">
                            <div className="spinner" style={{width:26,height:26,borderWidth:2,borderTopColor:"var(--sage)"}}/>
                            <div className="gen-label" style={{color:"var(--sage)"}}>Rendering clip…</div>
                          </div>
                        )}
                      </div>
                      {asd.videoUrl&&(
                        <div style={{display:"flex",gap:8}}>
                          <button className="btn btn-ghost btn-sm" style={{flex:1}}>⬇ Export MP4</button>
                          <button className="btn btn-ghost btn-sm" style={{flex:1}}>+ Add to Timeline</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="scene-notes">
                  <div className="note-block">
                    <div className="label">Description</div>
                    <div className="note-value">{asd.description}</div>
                  </div>
                  <div className="note-block">
                    <div className="label">Action Beat</div>
                    <div className="note-value">{asd.action}</div>
                  </div>
                  <div className="note-block">
                    <div className="label">Mood · Cast</div>
                    <div className="note-value">
                      <span style={{color:"var(--gold)",fontStyle:"normal",fontFamily:"var(--font-body)"}}>{asd.mood}</span>
                      <br/>
                      {(asd.characters||[]).map(c=><span key={c} className="note-tag">{c}</span>)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* CHECKLIST */}
        {checklistOpen&&(
          <ConsistencyChecklist
            bible={bible}
            onDismiss={()=>{setChecklistOpen(false);setPendingAction(null);}}
            onProceed={()=>{setChecklistOpen(false);if(pendingAction){pendingAction();setPendingAction(null);}}}
            onGoToSettings={()=>setTab("settings")}
          />
        )}

        {/* NOTIFICATION */}
        {notification&&(
          <div className={`notification ${notification.type}`}>
            {notification.type==="success"?"✦":notification.type==="error"?"✕":"·"} {notification.msg}
          </div>
        )}
      </div>
    </>
  );
}

export default function App() {
  const [bible, setBible] = useState(null);
  return bible ? <MainApp bible={bible}/> : <Wizard onComplete={setBible}/>;
}
