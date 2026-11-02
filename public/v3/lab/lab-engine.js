// lab-engine.js v3 — contract 1.0, complete implementation.
export const UNITS = { V:'V', mA:'mA', mW:'mW' };
export const TOL = 0.05;
export const TERMINALS = ['E_pos','E_neg','R1_a','R1_b','R2_a','R2_b'];
export const FIXTURES = {
  A: { E:5, R1:1000, R2:1000 },
  B: { E:3.75, R1:1000, R2:2000 },
  scaled: { E:5, R1:500, R2:1000 },
  nominal: { E:5, R1:1000, R2:2000 },
};
const clone=o=>JSON.parse(JSON.stringify(o));
const isNum=x=>typeof x==='number'&&Number.isFinite(x);

function uf(edges){
  const p={}; TERMINALS.forEach(t=>p[t]=t);
  const find=x=>p[x]===x?x:(p[x]=find(p[x]));
  edges.forEach(([a,b])=>{ if(p[a]!==undefined&&p[b]!==undefined) p[find(a)]=find(b); });
  return find;
}
function deriveTopo(wires){
  const f=uf(wires);
  const c=(a,b)=>f(a)===f(b);
  if(c('E_pos','E_neg')) return 'source_short';
  if(c('R1_a','R1_b')) return 'R1_short';
  if(c('R2_a','R2_b')) return 'R2_short';
  if(!c('E_pos','R1_a')||!c('R1_b','R2_a')||!c('R2_b','E_neg')) return 'open';
  return 'series';
}
function netAt(terminal,f){
  const r=f(terminal);
  if(r===f('E_pos')) return 'P';
  if(r===f('E_neg')) return 'G';
  if(r===f('R1_b')) return 'N';
  return 'X';
}
function expectedReading(candId, a, b, mode){
  const c=FIXTURES[candId];
  const f=uf([['E_pos','R1_a'],['R1_b','R2_a'],['R2_b','E_neg']]);
  const net=t=>netAt(t,f);
  if(mode==='current') return c.E/(c.R1+c.R2)*1000;
  const v=t=> t==='P'?c.E : t==='G'?0 : c.E*c.R2/(c.R1+c.R2);
  return v(net(a))-v(net(b));
}

export function createLab({task,scenarioId}={}){
  if(!task||!['restore_nominal','ratio_design'].includes(task)) throw new Error('bad task');
  const initActual = FIXTURES[scenarioId] ? {...FIXTURES[scenarioId]} : {...FIXTURES.nominal};
  let role='student';
  let actual={...initActual};
  let wires=[['E_pos','R1_a'],['R1_b','R2_a'],['R2_b','E_neg']];
  let phase='orientation', paused=false, revision=0, evId=0;
  let prediction=null, predictionHistory=[], predictionFeedback=null;
  let probes=null, lastMeasurement=null;
  let evidence=[], staleEvidence=[], mappingResponses=[], hypothesisComparison=null;
  let hints=[], interventions=[], studentResponses=[];
  let claim=null, claimValidation=null, teacherReview=null;
  let observation={mode:'unknown',occludedTerminals:[],confidence:0,manualConfirmed:false};

  const topo=()=>deriveTopo(wires);
  const f=()=>uf(wires);
  const netOf=t=>netAt(t,f());
  const invalidate=()=>{ staleEvidence.push(...evidence); evidence=[]; lastMeasurement=null; claim=null; claimValidation=null; teacherReview=null; if(phase!=='orientation') phase='exploration'; revision++; };

  const displayConfig=()=> task==='restore_nominal'
    ? {E:5,R1:'待测',R2:'待测'}
    : {E:actual.E,R1:actual.R1,R2:actual.R2};

  // candidate compatibility: each evidence must match candidate prediction for that pair/mode
  const candidatesState=()=>{
    if(task!=='restore_nominal') return [];
    return ['A','B'].map(id=>{
      const compatible = evidence.length>0 && evidence.every(e=>{
        const exp=expectedReading(id,e.a,e.b,e.mode);
        return Math.abs(e.value-exp)<0.05;
      });
      return {id,desc:id==='A'?'R2误装1kΩ':'电源3.75V',compatible};
    });
  };

  const canStudent=()=>role==='student'&&!paused;
  const canTeacher=()=>role==='teacher'&&!paused;
  const inExp=()=>phase==='exploration'||phase==='evidence_submitted';

  const permittedActions=()=>{
    const p=[];
    if(canStudent()){
      if(phase==='orientation'||inExp()) p.push('predict');
      if(inExp()) p.push('setProbes','measure','setConfig','setWire','submitMapping','compareHypotheses','requestHint','submitClaim','respondToIntervention','setObservation');
    }
    if(canTeacher()&&inExp()) p.push('teacherIntervention','teacherReview');
    p.push('reset','setPaused');
    return p;
  };

  const getSnapshot=()=>{
    const cands=candidatesState();
    const ambiguous = cands.filter(c=>c.compatible).length>1;
    return clone({
      task:{id:task,nominal:FIXTURES.nominal,targetRatio:2/3},
      role,phase,revision,paused,
      displayConfig:displayConfig(),
      prediction,predictionHistory,predictionFeedback,probes,lastMeasurement,
      wires, terminalNetMap:Object.fromEntries(TERMINALS.map(t=>[t,netOf(t)])),
      mappingResponses,evidence,staleEvidence,hypothesisComparison,
      candidates:cands, candidatesOpenCount:cands.filter(c=>c.compatible).length,
      hints,interventions,studentResponses,claim,claimValidation,teacherReview,
      observation,
      permittedActions:permittedActions(),
      sceneState:{status:phase,probes,wires,netMap:Object.fromEntries(TERMINALS.map(t=>[t,netOf(t)])),
        displayConfig:displayConfig(),lastMeasurement,
        candidatesOpen:cands.filter(c=>c.compatible).length,
        teacherPrompt:interventions[interventions.length-1]||null,
        observation,ambiguous}
    });
  };

  const ret=(ok,error,extra)=>Object.assign({ok,error,snapshot:getSnapshot()},extra||{});

  return {
    getSnapshot,
    setRole(r){ if(!['student','teacher'].includes(r)) return ret(false,'bad_role'); role=r; return ret(true); },

    predict({u2,iMa,pMw}={}){
      if(!(canStudent()&&(phase==='orientation'||phase==='exploration'))) return ret(false,'wrong_phase');
      if(!isNum(u2)||!isNum(iMa)||!isNum(pMw)) return ret(false,'bad_prediction');
      const idealU=FIXTURES.nominal.E*FIXTURES.nominal.R2/(FIXTURES.nominal.R1+FIXTURES.nominal.R2);
      const idealI=FIXTURES.nominal.E/(FIXTURES.nominal.R1+FIXTURES.nominal.R2)*1000;
      let fb=[];
      if(Math.abs(u2-idealU)>0.5) fb.push(`u2偏离理想${idealU.toFixed(2)}V`);
      if(Math.abs(iMa-idealI)>0.3) fb.push(`iMa偏离理想${idealI.toFixed(2)}mA`);
      prediction={u2,iMa,pMw,revision}; predictionHistory.push(prediction); predictionFeedback=fb.join(';')||null;
      phase='exploration'; return ret(true);
    },

    setProbes({a,b,mode}={}){
      if(!(canStudent()&&inExp())) return ret(false,'forbidden');
      if(!TERMINALS.includes(a)||!TERMINALS.includes(b)) return ret(false,'bad_terminal');
      if(!['voltage','current'].includes(mode)) return ret(false,'bad_mode');
      probes={a,b,mode}; return ret(true);
    },

    setObservation({mode,occludedTerminals,manualConfirmed}={}){
      if(!canStudent()) return ret(false,'forbidden');
      if(mode && !['unknown','visible','occluded'].includes(mode)) return ret(false,'bad_mode');
      if(mode) observation.mode=mode;
      if(Array.isArray(occludedTerminals)) observation.occludedTerminals=occludedTerminals.filter(t=>TERMINALS.includes(t));
      if(manualConfirmed!==undefined) observation.manualConfirmed=manualConfirmed;
      return ret(true);
    },

    measure(){
      if(!(canStudent()&&inExp())) return ret(false,'forbidden');
      if(!probes) return ret(false,'no_probes');
      if(observation.mode==='unknown'&&!observation.manualConfirmed) return ret(false,'observation_unknown');
      const t=topo();
      if(t!=='series') return ret(false,'topo_'+t);
      let value,unit;
      if(probes.mode==='current'){
        if(!(probes.a==='R1_b'&&probes.b==='R2_a'||probes.a==='R2_a'&&probes.b==='R1_b'))
          return ret(false,'current_only_series_gap');
        value=actual.E/(actual.R1+actual.R2)*1000; unit='mA';
      } else {
        const na=netOf(probes.a), nb=netOf(probes.b);
        const va=na==='P'?actual.E:na==='G'?0:actual.E*actual.R2/(actual.R1+actual.R2);
        const vb=nb==='P'?actual.E:nb==='G'?0:actual.E*actual.R2/(actual.R1+actual.R2);
        value=va-vb; unit='V';
      }
      const e={id:++evId,a:probes.a,b:probes.b,mode:probes.mode,value,unit,revision,usable:true};
      evidence.push(e); lastMeasurement=e; return ret(true,null,{evidence:e});
    },

    setConfig({E,R1,R2}={}){
      if(!(canStudent()&&inExp())) return ret(false,'forbidden');
      const cur={...actual};
      if(E!==undefined){ if(!isNum(E)||E<=0) return ret(false,'bad_E'); cur.E=E; }
      if(R1!==undefined){ if(!isNum(R1)||R1<=0) return ret(false,'bad_R1'); cur.R1=R1; }
      if(R2!==undefined){ if(!isNum(R2)||R2<=0) return ret(false,'bad_R2'); cur.R2=R2; }
      actual=cur; invalidate(); return ret(true);
    },

    setWire({a,b,connected}={}){
      if(!(canStudent()&&inExp())) return ret(false,'forbidden');
      if(!TERMINALS.includes(a)||!TERMINALS.includes(b)) return ret(false,'bad_terminal');
      wires = connected
        ? [...wires.filter(w=>!(w.includes(a)&&w.includes(b))),[a,b]]
        : wires.filter(w=>!(w[0]===a&&w[1]===b||w[0]===b&&w[1]===a));
      invalidate(); return ret(true);
    },

    submitMapping({terminal,net}={}){
      if(!canStudent()) return ret(false,'forbidden');
      if(!TERMINALS.includes(terminal)) return ret(false,'bad_terminal');
      const ok=net===netOf(terminal); mappingResponses.push({terminal,net,correct:ok}); return ret(true);
    },

    compareHypotheses({measure:m,readings,reasonCode}={}){
      if(!(canStudent()&&inExp())) return ret(false,'forbidden');
      if(!m||!readings) return ret(false,'bad_compare');
      if(!TERMINALS.includes(m.a)||!TERMINALS.includes(m.b)) return ret(false,'bad_terminal');
      if(!['voltage','current'].includes(m.mode)) return ret(false,'bad_mode');
      const aReal=expectedReading('A',m.a,m.b,m.mode);
      const bReal=expectedReading('B',m.a,m.b,m.mode);
      if(!isNum(readings.A)||!isNum(readings.B)) return ret(false,'bad_readings');
      if(Math.abs(readings.A-aReal)>0.05||Math.abs(readings.B-bReal)>0.05) return ret(false,'bad_prediction_values');
      if(Math.abs(aReal-bReal)<0.01) return ret(false,'not_discriminating');
      hypothesisComparison={m,readings,reasonCode}; return ret(true);
    },

    requestHint(){
      if(!(canStudent()&&inExp())) return ret(false,'forbidden');
      const lv=Math.min(hints.length+1,3);
      hints.push({level:lv,text:['先选测点','比较候选读数','用欧姆定律推算'][lv-1]});
      return ret(true);
    },

    submitClaim({goalType,claimCode,evidenceIds,excludedCandidateIds,comparison,limitCode,freeText}={}){
      if(!(canStudent()&&inExp())) return ret(false,'forbidden');
      if(goalType!==task) return ret(false,'goal_mismatch');
      if(!claimCode||!evidenceIds||!comparison) return ret(false,'missing_structure');
      const evs=evidence.filter(e=>evidenceIds.includes(e.id));
      if(evs.length!==evidenceIds.length) return ret(false,'bad_evidence_id');
      if(!evs.some(e=>e.mode==='voltage'&&((e.a==='R1_b'&&e.b==='E_neg')||(e.a==='E_neg'&&e.b==='R1_b')))) return ret(false,'need_NG_voltage');
      if(!evs.some(e=>e.mode==='current'&&((e.a==='R1_b'&&e.b==='R2_a')||(e.a==='R2_a'&&e.b==='R1_b')))) return ret(false,'need_series_current');
      // prediction revision check: must have revised after wrong prediction
      if(predictionHistory.length>0 && predictionFeedback){
        const last=predictionHistory[predictionHistory.length-1];
        if(Math.abs(last.u2 - 3.333)>0.3) return ret(false,'prediction_not_revised');
      }
      if(task==='restore_nominal'){
        const okR1=Math.abs(actual.R1-FIXTURES.nominal.R1)/FIXTURES.nominal.R1<=TOL;
        const okR2=Math.abs(actual.R2-FIXTURES.nominal.R2)/FIXTURES.nominal.R2<=TOL;
        const okE=Math.abs(actual.E-FIXTURES.nominal.E)/FIXTURES.nominal.E<=TOL;
        if(!(okR1&&okR2&&okE&&topo()==='series')) return ret(false,'goal_not_restored');
        if(!excludedCandidateIds||excludedCandidateIds.length!==1||!['A','B'].includes(excludedCandidateIds[0]))
          return ret(false,'need_causal_exclusion');
        const excl=excludedCandidateIds[0];
        const diagEvs = staleEvidence.filter(e=>e.revision<evidence[0]?.revision ?? revision);
        if(diagEvs.length===0) return ret(false,'need_diagnostic_evidence');
        const diagCompat = ['A','B'].map(id=>({id,ok:diagEvs.every(e=>Math.abs(e.value-expectedReading(id,e.a,e.b,e.mode))<0.05)}));
        const survivor = diagCompat.find(c=>c.ok && c.id!==excl);
        const exclOk = diagCompat.find(c=>c.id===excl && !c.ok);
        if(!survivor||!exclOk) return ret(false,'exclusion_relation_invalid');
      }
      if(task==='ratio_design'){
        const k=actual.R2/(actual.R1+actual.R2);
        if(Math.abs(k-2/3)>0.01) return ret(false,'bad_ratio');
        const iReal=actual.E/(actual.R1+actual.R2)*1000;
        const pReal=actual.E*iReal;
        if(!isNum(comparison.iAfterMa)||Math.abs(comparison.iAfterMa-iReal)>0.01) return ret(false,'bad_comparison');
        if(!isNum(comparison.pAfterMw)||Math.abs(comparison.pAfterMw-pReal)>0.1) return ret(false,'bad_comparison_p');
        if(!isNum(comparison.iBeforeMa)||Math.abs(comparison.iBeforeMa-1.6667)>0.1) return ret(false,'bad_comparison_base');
        if(!isNum(comparison.pBeforeMw)||Math.abs(comparison.pBeforeMw-8.3333)>0.2) return ret(false,'bad_comparison_base');
        if(!limitCode||!['ok','exceeds'].includes(limitCode)) return ret(false,'bad_limit');
      }
      claim={goalType,claimCode,evidenceIds,excludedCandidateIds,comparison,limitCode,freeText};
      claimValidation={ok:true,checked:['structure','evidence','goal','comparison','prediction_revised']};
      phase='evidence_submitted'; return ret(true);
    },

    teacherIntervention({confusionClass,promptLevel,comment}={}){
      if(!canTeacher()) return ret(false,'forbidden');
      if(!['node_mapping','hypothesis_test','ratio_vs_absolute','evidence_reasoning'].includes(confusionClass)) return ret(false,'bad_class');
      if(!comment) return ret(false,'missing_comment');
      const q={node_mapping:'P/N/G各对应哪个端子？',hypothesis_test:'两候选在PG读数差多少？',
        ratio_vs_absolute:'同电压比时电流为何不同？',evidence_reasoning:'哪条证据排除了哪个候选？'}[confusionClass];
      interventions.push({id:interventions.length+1,confusionClass,promptLevel,comment,question:q,focus:confusionClass});
      return ret(true);
    },

    respondToIntervention({interventionId,mapping,comparison,freeText}={}){
      if(!canStudent()) return ret(false,'forbidden');
      if(!interventions.some(i=>i.id===interventionId)) return ret(false,'bad_intervention');
      studentResponses.push({interventionId,mapping,comparison,freeText}); return ret(true);
    },

    teacherReview({classification,comment,nextStep}={}){
      if(!canTeacher()) return ret(false,'forbidden');
      if(!claim) return ret(false,'no_claim');
      if(!['needs_mapping','needs_causal_link','needs_absolute_comparison','reasoned_with_limits'].includes(classification)) return ret(false,'bad_class');
      if(!['reexplain','transfer','record_review'].includes(nextStep)) return ret(false,'bad_next_step');
      if(!comment) return ret(false,'missing_comment');
      teacherReview={classification,comment,nextStep};
      phase = nextStep==='reexplain' ? 'exploration' : 'teacher_reviewed';
      return ret(true);
    },

    reset(){
      actual={...initActual}; wires=[['E_pos','R1_a'],['R1_b','R2_a'],['R2_b','E_neg']];
      phase='orientation'; paused=false; prediction=null; predictionHistory=[]; predictionFeedback=null;
      probes=null; lastMeasurement=null; evidence=[]; staleEvidence=[];
      mappingResponses=[]; hypothesisComparison=null; hints=[]; interventions=[];
      studentResponses=[]; claim=null; claimValidation=null; teacherReview=null;
      observation={mode:'unknown',occludedTerminals:[],confidence:0,manualConfirmed:false};
      revision=0; evId=0; return ret(true);
    },
    setPaused(b){ paused=!!b; return ret(true); }
  };
}
