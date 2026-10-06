import { writeFile } from 'node:fs/promises';
const colors = ['#002fa7','#dd8059','#77906d','#aa87ad','#d2a544','#598e99'];
let seq = 0;
const n = (midi,start,duration,velocity=.7)=>({id:`demo-note-${++seq}`,midi,start,duration,velocity});
const t = (id,name,instrumentId,notes,volume,pan=0)=>({id,name,instrumentId,color:colors.shift(),notes,volume,pan,muted:false,solo:false});
// Original eight-bar sketch, composed for this app: Cmaj7 · Am7 · Fmaj7 · G6.
const chords=[[48,55,59,64],[48,55,59,64],[45,52,55,60],[45,52,55,60],[41,48,52,57],[41,48,52,57],[43,50,55,59],[43,50,57,62]];
const piano=chords.flatMap((c,b)=>c.map((p,i)=>n(p,b*4+i*.04,3.6-i*.04,.46+i*.055)));
const melody=[[[76,0,.75],[79,1,1.5],[74,3,.75]],[[71,0,1.5],[72,2,.5],[74,2.75,.75]],[[72,0,.75],[76,1,1.25],[79,2.5,.5],[76,3.25,.5]],[[74,0,1],[72,1.5,1.75]],[[69,0,.75],[72,1,1],[76,2.5,1]],[[77,0,1.5],[76,2,.5],[72,3,.75]],[[74,0,.75],[79,1,1.25],[77,2.5,.5],[74,3.25,.5]],[[71,0,.75],[74,1,.75],[72,2,1.75]]].flatMap((bar,b)=>bar.map(([p,s,d],i)=>n(p,b*4+s,d,i===0?.8:.64)));
const bass=chords.flatMap((c,b)=>[n(c[0]-12,b*4,1.65,.76),n(c[0]-5,b*4+2,1.4,.63)]);
const bell=chords.flatMap((c,b)=>b%2===1?[n(c[3]+12,b*4+1.5,.45,.42),n(c[2]+12,b*4+3.5,.4,.32)]:[]);
const kick=Array.from({length:8},(_,b)=>[n(60,b*4,.25,.65),n(60,b*4+2,.25,.5)]).flat();
const hat=Array.from({length:32},(_,i)=>n(60,i+.5,.125,i%2?.32:.45));
const project={schemaVersion:1,id:'little-orbit',title:'小行星漫游',bpm:92,key:'C major',bars:8,timeSignature:[4,4],tracks:[t('keys','温暖和弦','piano',piano,.68),t('melody','漫游旋律','flute',melody,.7,.1),t('bass-line','低音引力','bass',bass,.78),t('sparkles','星光点缀','marimba',bell,.53,-.25),t('pulse','轻轻落地','kick',kick,.65),t('air','空气节拍','hihat',hat,.4,.22)],updatedAt:new Date().toISOString()};
await writeFile(new URL('../public/demo.json',import.meta.url),JSON.stringify(project,null,2));
