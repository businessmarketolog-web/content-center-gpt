const {test}=require('node:test');
const assert=require('node:assert/strict');
const c=require('../v2/virale-core.js');
test('only accepted canonical HTTPS video URLs, no tracking',()=>{
 assert.equal(c.videoUrl('https://www.instagram.com/reel/DehKZ6HAkUN/?psln=token'),'https://www.instagram.com/reel/DehKZ6HAkUN/');
 assert.equal(c.videoUrl('https://evil.example/reel/DehKZ6HAkUN'),null);
 assert.equal(c.videoUrl('javascript:alert(1)'),null);
 assert.equal(c.videoUrl('https://instagram.com.evil.test/reel/DehKZ6HAkUN'),null);
 assert.equal(c.videoUrl('https://user:password@instagram.com/reel/foo'),null);
});
test('no fabricated virality estimate without measurements',()=>{
 const p=c.performance({views:'',likes:'',median:''});
 assert.equal(p.engagementRate,null);assert.equal(p.medianMultiple,null);
 assert.match(p.caveat,/не вероятность/);
});
test('numeric measures keep zero and no invalid denominators',()=>{
 const p=c.performance({views:'1000',likes:'10',comments:'2',median:'500',followers:'200'});
 assert.equal(p.engagementRate,1.4);assert.equal(p.medianMultiple,2);assert.equal(p.reachMultiple,5);
 assert.equal(c.number(''),null);assert.equal(c.number('-2'),null);
});
test('creative ideas scoped to only supplied subject; no fake facts',()=>{
 const brand={clientId:'a',name:'Travel Gallery',fields:{audience:'семьи',content_pillars:'отдых'}};
 const ideas=c.compose({topic:'пляжи Пхукета'},brand);
 assert.equal(ideas.length,3);
 assert.ok(ideas.every(x=>x.caption.includes('с')&&x.context.includes('семьи')));
 assert.throws(()=>c.compose({topic:''},brand));
 const prompt=c.aiPrompt({url:'https://www.instagram.com/reel/DehKZ6HAkUN/?xx=1',topic:'пляжи Пхукета'},brand,c.performance({}));
 assert.match(prompt,/client_name":"Travel Gallery"/);
 assert.doesNotMatch(prompt,/Max Way/);
 assert.match(prompt,/Не утверждай, что смотрел ролик/);
});
