/* Pure mobile gesture contract + artifact safety checks, no browser or production APIs. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'v2/mobile-navigation.js'),'utf8');
const world={URLSearchParams};
vm.runInNewContext(src,world,{filename:'mobile-navigation.js'});
const nav=world.CCMobileNav;
test('edge gesture requires clear horizontal movement, without vertical scroll, RTL or accidental tap',()=>{
 const a={x:42,y:300,time:1000};
 assert.equal(nav.swipeValid(a,{x:140,y:320},1100),true);
 assert.equal(nav.swipeValid(a,{x:110,y:300},1100),false,'short moves do not navigate');
 assert.equal(nav.swipeValid(a,{x:160,y:374},1100),false,'vertical scrolling is not back');
 assert.equal(nav.swipeValid(a,{x:0,y:300},1100),false,'right-to-left is never back');
 assert.equal(nav.swipeValid(a,{x:180,y:300},2300),false,'old gesture must expire');
 assert.equal(nav.swipeValid(a,{x:180,y:300},1020),false,'taps are not swipes');
 assert.equal(nav.swipeValid(null,{x:180,y:300},1100),false);
});
test('mobile navigation avoids extra browser history and database writes',()=>{
 assert.doesNotMatch(src,/history\.back\(|history\.pushState\(|location\.assign\(|localStorage\.clear\(|sessionStorage\.clear\(/);
 assert.doesNotMatch(src,/\bsb\.from\(|\.rpc\(|functions\.invoke\(/);
 assert.match(src,/preventDefault\(\);event\.stopImmediatePropagation\(\);back\(\)/);
 assert.match(src,/window|root\.navigator/);
 assert.match(src,/returning=true/);
});
test('new iOS back controls and sticky headers remain PWA cached',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'v2/mobile-navigation.css'),'utf8');
 for(const file of ['v2/mobile-navigation.js?v=20261016-iosnav1','v2/mobile-navigation.css?v=20261016-iosnav1']){
  assert.ok(html.includes(file),file+' missing in HTML');
  assert.ok(sw.includes(file),file+' missing in offline cache');
 }
 assert.match(css,/env\(safe-area-inset-top\)/);
 assert.match(css,/\.drawer-head/);
 assert.match(css,/\.palette-search/);
 assert.match(css,/\.client-manager-head-v9/);
 assert.match(css,/\.modal\.on \.dialog-head/);
 assert.match(css,/min-height:48px/);
 assert.match(css,/position:sticky/);
 assert.match(css,/#toast\.toast,#toast\.toast\.on/);
 assert.match(css,/pointer-events:none!important/);
 assert.match(src,/ccv2WizardBack/);
 assert.match(fs.readFileSync(path.join(root,'v2/client-wizard-ui.js'),'utf8'),/back\.id='ccv2WizardBack'/);
});
test('legacy V1 is untouched by mobile gesture installer',()=>{
 assert.match(src,/\['v1','legacy'\]\.includes/);
});
