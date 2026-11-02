// test.js
import { createLab } from './lab-engine.js';
let pass=0,fail=0;
const t=(n,c,d)=>{ if(c){pass++;console.log('PASS',n);}else{fail++;console.log('FAIL',n,JSON.stringify(d));} };

// 1. candidatesState: NG compatible both, PG distinguishes
let l=createLab({task:'restore_nominal',scenarioId:'A'});
l.predict({u2:3.33,iMa:1.67,pMw:8.33});
l.setObservation({mode:'visible',manualConfirmed:true});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'}); l.measure();
let s=l.getSnapshot();
t('NG both compatible', s.candidates[0].compatible && s.candidates[1].compatible, s.candidates);

l.setProbes({a:'R2_b',b:'E_pos',mode:'voltage'}); l.measure();
s=l.getSnapshot();
t('PG distinguishes A only', s.candidates[0].compatible && !s.candidates[1].compatible, s.candidates);

// 2. compareHypotheses current
l=createLab({task:'restore_nominal',scenarioId:'A'});
l.predict({u2:3.33,iMa:1.67,pMw:8.33});
l.setObservation({mode:'visible',manualConfirmed:true});
l.setProbes({a:'R1_b',b:'R2_a',mode:'current'}); l.measure(); l.compareHypotheses({measure:{a:'R1_b',b:'R2_a',mode:'current'},readings:{A:2.5,B:1.25},reasonCode:'check_current'});
let r=l.compareHypotheses({measure:{a:'R1_b',b:'R2_a',mode:'current'},readings:{A:2.5,B:1.25},reasonCode:'different_predictions'});
t('current discriminating', r.ok, r.error);
r=l.compareHypotheses({measure:{a:'R1_b',b:'R2_a',mode:'current'},readings:{A:999,B:-999},reasonCode:'different_predictions'});
t('current fake FAIL', !r.ok && r.error==='bad_prediction_values', r.error);

// 3. restore need causal exclusion valid ID
l=createLab({task:'restore_nominal',scenarioId:'A'});
l.predict({u2:3.33,iMa:1.67,pMw:8.33});
l.setObservation({mode:'visible',manualConfirmed:true});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'}); l.measure();
l.setProbes({a:'R1_b',b:'R2_a',mode:'current'}); l.measure(); l.compareHypotheses({measure:{a:'R1_b',b:'R2_a',mode:'current'},readings:{A:2.5,B:1.25},reasonCode:'check_current'});
l.setConfig({R1:1000,R2:2000});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'}); l.measure();
l.setProbes({a:'R1_b',b:'R2_a',mode:'current'}); l.measure(); l.compareHypotheses({measure:{a:'R1_b',b:'R2_a',mode:'current'},readings:{A:2.5,B:1.25},reasonCode:'check_current'});
r=l.submitClaim({goalType:'restore_nominal',claimCode:'cause_B',evidenceIds:[3,4],excludedCandidateIds:['nonsense'],comparison:{iBeforeMa:2.5,pBeforeMw:12.5,iAfterMa:1.667,pAfterMw:8.333},freeText:'x'});
t('exclude nonsense FAIL', !r.ok && r.error==='need_causal_exclusion', r.error);
r=l.submitClaim({goalType:'restore_nominal',claimCode:'cause_A',evidenceIds:[3,4],excludedCandidateIds:['B'],comparison:{iBeforeMa:2.5,pBeforeMw:12.5,iAfterMa:1.667,pAfterMw:8.333},freeText:'x'});
t('exclude B accepted', r.ok, r.error);

// 4. ratio baseline/prior
l=createLab({task:'ratio_design',scenarioId:'scaled'});
l.predict({u2:3.33,iMa:3.33,pMw:16.67});
l.setObservation({mode:'visible',manualConfirmed:true});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'}); l.measure();
l.setProbes({a:'R1_b',b:'R2_a',mode:'current'}); l.measure(); l.compareHypotheses({measure:{a:'R1_b',b:'R2_a',mode:'current'},readings:{A:2.5,B:1.25},reasonCode:'check_current'});
r=l.submitClaim({goalType:'ratio_design',claimCode:'ratio_2_3',evidenceIds:[1,2],comparison:{iAfterMa:3.33,pAfterMw:16.67},limitCode:'ok',freeText:'x'});
t('ratio need baseline', !r.ok && r.error==='bad_comparison_base', r.error);
r=l.submitClaim({goalType:'ratio_design',claimCode:'ratio_2_3',evidenceIds:[1,2],comparison:{iBeforeMa:1.67,pBeforeMw:8.33,iAfterMa:3.33,pAfterMw:16.67},limitCode:'ok',freeText:'x'});
t('ratio accepted', r.ok, r.error);

// 5. 12V not revised blocks
l=createLab({task:'restore_nominal',scenarioId:'A'});
l.predict({u2:12,iMa:4,pMw:20});
l.setObservation({mode:'visible',manualConfirmed:true});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'}); l.measure();
l.setProbes({a:'R1_b',b:'R2_a',mode:'current'}); l.measure(); l.compareHypotheses({measure:{a:'R1_b',b:'R2_a',mode:'current'},readings:{A:2.5,B:1.25},reasonCode:'check_current'});
l.setConfig({R1:1000,R2:2000});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'}); l.measure();
l.setProbes({a:'R1_b',b:'R2_a',mode:'current'}); l.measure(); l.compareHypotheses({measure:{a:'R1_b',b:'R2_a',mode:'current'},readings:{A:2.5,B:1.25},reasonCode:'check_current'});
r=l.submitClaim({goalType:'restore_nominal',claimCode:'cause_A',evidenceIds:[3,4],excludedCandidateIds:['B'],comparison:{iBeforeMa:2.5,pBeforeMw:12.5,iAfterMa:1.667,pAfterMw:8.333},freeText:'x'});
t('12V not revised FAIL', !r.ok && r.error==='prediction_not_revised', r.error);

// 6. observation unknown
l=createLab({task:'restore_nominal',scenarioId:'A'});
l.predict({u2:3.33,iMa:1.67,pMw:8.33});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'});
r=l.measure();
t('observation unknown blocks', !r.ok && r.error==='observation_unknown', r.error);

// 7. A scenario: exclude B valid, exclude A invalid
l=createLab({task:'restore_nominal',scenarioId:'A'});
l.predict({u2:3.33,iMa:1.67,pMw:8.33});
l.setObservation({mode:'visible',manualConfirmed:true});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'}); l.measure();
l.setProbes({a:"R2_b",b:"E_pos",mode:"voltage"}); l.measure(); l.compareHypotheses({measure:{a:"R2_b",b:"E_pos",mode:"voltage"},readings:{A:-5,B:-3.75},reasonCode:"check_source"});
l.setConfig({R1:1000,R2:2000});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'}); l.measure();
l.setProbes({a:'R1_b',b:'R2_a',mode:'current'}); l.measure(); l.compareHypotheses({measure:{a:'R1_b',b:'R2_a',mode:'current'},readings:{A:2.5,B:1.25},reasonCode:'check_current'});
r=l.submitClaim({goalType:'restore_nominal',claimCode:'cause_B',evidenceIds:[3,4],excludedCandidateIds:['A'],comparison:{iBeforeMa:2.5,pBeforeMw:12.5,iAfterMa:1.667,pAfterMw:8.333},freeText:'x'});
t('A scenario exclude A invalid', !r.ok && r.error==='exclusion_relation_invalid', r.error);
r=l.submitClaim({goalType:'restore_nominal',claimCode:'cause_A',evidenceIds:[3,4],excludedCandidateIds:['B'],comparison:{iBeforeMa:2.5,pBeforeMw:12.5,iAfterMa:1.667,pAfterMw:8.333},freeText:'x'});
t('A scenario exclude B valid', r.ok, r.error);

// 8. ratio scaled correct prediction no false feedback
l=createLab({task:'ratio_design',scenarioId:'scaled'});
r=l.predict({u2:3.333,iMa:3.333,pMw:16.667});
t('ratio scaled no false feedback', !r.snapshot.predictionFeedback, r.snapshot.predictionFeedback);

// 9. restore nominal correct prediction
l=createLab({task:'restore_nominal',scenarioId:'A'});
r=l.predict({u2:3.333,iMa:1.667,pMw:8.333});
t('restore nominal no false feedback', !r.snapshot.predictionFeedback, r.snapshot.predictionFeedback);


// 10. restore without hypothesisComparison rejected
l=createLab({task:'restore_nominal',scenarioId:'A'});
l.predict({u2:3.333,iMa:1.667,pMw:8.333});
l.setObservation({mode:'visible',manualConfirmed:true});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'}); l.measure();
l.setProbes({a:'R1_b',b:'R2_a',mode:'current'}); l.measure();
l.setConfig({R1:1000,R2:2000});
l.setProbes({a:'R1_b',b:'E_neg',mode:'voltage'}); l.measure();
l.setProbes({a:'R1_b',b:'R2_a',mode:'current'}); l.measure();
r=l.submitClaim({goalType:'restore_nominal',claimCode:'cause_A',evidenceIds:[3,4],excludedCandidateIds:['B'],comparison:{iBeforeMa:2.5,pBeforeMw:12.5,iAfterMa:1.667,pAfterMw:8.333},freeText:'x'});
t('restore no compare rejected', !r.ok && r.error==='need_hypothesis_comparison', r.error);
