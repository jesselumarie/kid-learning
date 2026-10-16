import test from 'node:test';
import assert from 'node:assert/strict';
import { rulerMatchesSide } from '../site/third-grade/area/math.js';

test('either long ruler edge can measure a horizontal or vertical side', () => {
  for (const thickness of [44/28,80/28]) {
    const horizontal = {a:[2,5],axis:'w',length:4};
    const vertical = {a:[2,5],axis:'h',length:3};
    assert.equal(rulerMatchesSide(horizontal,{x:2,y:5,vertical:false,value:4},thickness),true);
    assert.equal(rulerMatchesSide(horizontal,{x:2,y:5-thickness,vertical:false,value:4},thickness),true);
    assert.equal(rulerMatchesSide(vertical,{x:2,y:5,vertical:true,value:3},thickness),true);
    assert.equal(rulerMatchesSide(vertical,{x:2-thickness,y:5,vertical:true,value:3},thickness),true);
  }
});

test('an inside placement still requires correct zero, marker, and orientation', () => {
  const side = {a:[2,5],axis:'w',length:4};
  const thickness = 44/28;
  const ruler = {x:2,y:5-thickness,vertical:false,value:4};
  assert.equal(rulerMatchesSide(side,{...ruler,x:3},thickness),false);
  assert.equal(rulerMatchesSide(side,{...ruler,value:3},thickness),false);
  assert.equal(rulerMatchesSide(side,{...ruler,vertical:true},thickness),false);
  assert.equal(rulerMatchesSide(side,{...ruler,y:5-thickness/2},thickness),false);
  assert.equal(rulerMatchesSide(side,{...ruler,y:5+thickness},thickness),false);
});
