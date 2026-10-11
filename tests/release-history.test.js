import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReleaseHistory } from '../src/release-history.js';
import { RELEASE_NOTES } from '../src/releases.js';
test('published numbers survive sparse source notes and retries retain their number', () => {
  const initial = nextReleaseHistory('first', RELEASE_NOTES);
  assert.deepEqual(initial.releases, RELEASE_NOTES);
  assert.deepEqual(nextReleaseHistory('first', RELEASE_NOTES, initial), initial);
  const next = nextReleaseHistory('second', RELEASE_NOTES, initial);
  assert.equal(next.releases[0].number, String(Number(RELEASE_NOTES[0].number) + 1).padStart(2, '0'));
  assert.equal(next.releases[1].number, RELEASE_NOTES[0].number);
  // A failed build does not change the published history or consume a number.
  assert.equal(nextReleaseHistory('third', RELEASE_NOTES, initial).releases[0].number, String(Number(RELEASE_NOTES[0].number) + 1).padStart(2, '0'));
  assert.throws(() => nextReleaseHistory('next', RELEASE_NOTES, {schema:1,releases:[{number:'34'}]}));
});
test('release history rejects duplicate and ascending numbers without rewriting old records',()=>{
 const a={number:'02',title:'Two',changes:[]},b={number:'01',title:'One',changes:[]};
 for(const releases of [[a,a],[b,a]])assert.throws(()=>nextReleaseHistory('next',RELEASE_NOTES,{schema:1,build:'old',releases}));
 const prior={schema:1,build:'old',releases:[a,b]},next=nextReleaseHistory('next',RELEASE_NOTES,prior);
 assert.equal(next.releases[0].number,'03');assert.deepEqual(next.releases.slice(1),prior.releases);
});
