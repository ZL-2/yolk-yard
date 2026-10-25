import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournamentClock,tournamentClock} from '../src/tournament-clock.js';
import {createCompeteState,competeMarkup,bindCompete} from '../src/compete-ui.js';
import {parseTournamentTime,tournamentLocalTime} from '../src/tournament-schedule.js';
import {TOURNAMENTS,tournamentPhase} from '../src/tournament.js';

test('device clock jumps cannot shift the relay date, Today, or countdown',()=>{
 let elapsed=100;const c=createTournamentClock(()=>elapsed),realDateNow=Date.now;
 try{Date.now=()=>Date.UTC(2035,3,2);assert.equal(c.now(),null);const at=Date.parse('2026-10-26T03:59:59Z');assert.ok(c.sync(at));elapsed+=2000;Date.now=()=>0;assert.equal(c.now(),at+2000);assert.equal(tournamentLocalTime(c.now()),'2026-10-26T00:00');assert.equal(c.sync(at-1),false);assert.equal(c.now(),at+2000);
  const s=createCompeteState();tournamentClock.sync(at+2000);const html=competeMarkup({tournament:{events:TOURNAMENTS.map(e=>({...e,phase:'scheduled'})),serverNow:at+2000},online:true,now:at+2000},s);assert.equal(s.cursor,at+2000);assert.match(html,/data-compete-day="2026-10-26"[^>]*class="[^"]*today/);assert.match(html,/Oct 26, 2026/);
  const root={};bindCompete(root,s,()=>{},()=>{},()=>at+2000);root.onclick({target:{closest:()=>({dataset:{competeMove:'1'}})}});const browsed=s.cursor;assert.equal(s.followToday,false);competeMarkup({tournament:{events:[]},now:at+3600000},s);assert.equal(s.cursor,browsed);root.onclick({target:{closest:()=>({dataset:{competeToday:''}})}});assert.equal(s.cursor,at+2000);
 }finally{Date.now=realDateNow;}
});
test('sleep/disconnect marks entry stale until another server timestamp arrives',()=>{
 let elapsed=0;const c=createTournamentClock(()=>elapsed);c.sync(100000);assert.ok(c.fresh);elapsed=45000;assert.equal(c.fresh,false);c.sync(145000);assert.ok(c.fresh);c.invalidate();assert.equal(c.fresh,false);c.sync(145001);assert.ok(c.fresh);
});
test('New York calendar handles DST and tournament cutoffs without device timezone',()=>{
 assert.equal(new Date(parseTournamentTime('2026-10-26T12:00')).toISOString(),'2026-10-26T16:00:00.000Z');
 assert.equal(new Date(parseTournamentTime('2026-11-02T12:00')).toISOString(),'2026-11-02T17:00:00.000Z');
 assert.throws(()=>parseTournamentTime('2026-11-01T01:30'),/twice/);assert.throws(()=>parseTournamentTime('2026-03-08T02:30'),/does not exist/);
 const e=TOURNAMENTS[1];for(const [at,phase]of [[e.lockAt-1,'scheduled'],[e.lockAt,'preparing'],[e.opensAt,'entry'],[e.startsAt,'starting']])assert.equal(tournamentPhase(at,null,e),phase);
});

test('month navigation follows the New York month near UTC midnight',()=>{
 const s={...createCompeteState(),view:'month',cursor:Date.parse('2026-10-31T23:30:00-04:00')},root={};
 bindCompete(root,s,()=>{},()=>{});root.onclick({target:{closest:()=>({dataset:{competeMove:'1'}})}});
 assert.match(tournamentLocalTime(s.cursor),/^2026-11-/);
 root.onclick({target:{closest:()=>({dataset:{competeMove:'-1'}})}});assert.match(tournamentLocalTime(s.cursor),/^2026-10-/);
});
