import test from 'node:test';
import assert from 'node:assert/strict';
import {goalStats,goalBarMarkup,communityGoal} from '../src/community-goal.js';
test('community totals preserve donations and cap the progress indicator',()=>{
 assert.deepEqual(goalStats(25.5),{amount:25.5,remaining:74.5,percent:25.5,complete:false});
 assert.deepEqual(goalStats(125),{amount:125,remaining:0,percent:100,complete:true});
 assert.equal(goalStats(-20).amount,0);assert.equal(goalStats('invalid').amount,0);
});
test('newly rendered top bars reflect the current manual total',()=>{
 const old=communityGoal.raised;try{communityGoal.raised=35;assert.match(goalBarMarkup(),/\$35 \/ \$100/);assert.match(goalBarMarkup(),/value="35"/);}finally{communityGoal.raised=old;}
});
