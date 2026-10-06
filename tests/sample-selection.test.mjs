import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/sample-selection.ts', import.meta.url), 'utf8');
const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
const { selectSample, effectiveArticulation } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const samples=[];
for (const articulation of ['sustain','staccato']) for (const midi of [40,42]) for (const [velocityMin,velocityMax] of [[0,.6],[.6,1]]) for(let roundRobin=1;roundRobin<=3;roundRobin++) samples.push({midi,articulation,velocityMin,velocityMax,roundRobin,url:`${articulation}-${midi}-${velocityMin}-${roundRobin}`});
const instrument={name:'Test guitar',samples,defaultArticulation:'sustain'};
test('sampler uses real articulation, nearest root and recorded velocity layer',()=>{
  const result=selectSample(instrument,41,.85,'staccato',0);
  assert.equal(result.articulation,'staccato');assert.equal(result.midi,40);assert.equal(result.velocityMin,.6);
  assert.equal(effectiveArticulation(instrument,{articulation:'staccato'},{articulation:'sustain'}),'sustain');
  assert.throws(()=>selectSample(instrument,40,.8,'palm-mute',0),/没有/);
});
test('round robin cycles distinct recordings and preserves single-sample compatibility',()=>{
  const selected=[0,1,2,3].map(i=>selectSample(instrument,40,.4,'sustain',i).url);
  assert.equal(new Set(selected.slice(0,3)).size,3);assert.equal(selected[0],selected[3]);
  assert.equal(selectSample({name:'Old',samples:[{midi:60,url:'original.wav'}]},72,.8,undefined,32).url,'original.wav');
});
