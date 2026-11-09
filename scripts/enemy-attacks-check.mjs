import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const folder = process.env.BROWSER_ARTIFACT_DIR || 'D:/tmp/ultraman-enemy-attacks/verified';
await mkdir(folder, {recursive: true});
const browser = await chromium.launch({
  ...(process.env.CHROME_EXECUTABLE ? {executablePath: process.env.CHROME_EXECUTABLE} : {channel: 'chrome'}),
  headless: true,
});
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 700}}),
    errors = [];
  page.setDefaultTimeout(90000);
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173', {waitUntil: 'networkidle'});
  await page.locator('#start-keyboard').click();await page.waitForFunction(()=>document.body.classList.contains('in-battle'));
  const act = (code) =>
    page.evaluate(async (code) => {
      const {battle: b} = await import(document.querySelector('script[type=module]').src);
      const T = await import('three');
      return new Function('b', 'T', code)(b, T);
    }, code);
  const advance = async (dt) => {
    await act(
      `for(let i=0;i<${dt}-1e-8;i+=1/120)b.advance(Math.min(1/120,${dt}-i));b.renderer.render(b.renderScene,b.camera);`,
    );
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  };
  const data = [];
  await act('b.renderer.setAnimationLoop(null);return b.prefetch;');
  for (const [wave, name, kinds] of [
    [1, 'redking', ['melee', 'bolt', 'slam', 'charge']],
    [2, 'baltan', ['melee', 'bolt', 'sweep', 'charge']],
    [3, 'ganq', ['bolt', 'sweep', 'melee', 'charge']],
  ])
    for (const kind of kinds) {
      const base = await act(
        `b.start();b.wave=${wave};b.selectMonster();b.monsterMax=b.monsterHealth=b.waveInfo.hp;b.emit();b.nextAttack=100;b.enemyDistance=${kind === 'melee' ? 16.5 : 35};b.monsterBaseZ=20-b.enemyDistance;b.currentMonster.position.z=b.monsterBaseZ;b.advance(.01);b.beginAttack('${kind}');b.__armLengths=()=>['L','R'].flatMap(side=>{const m=b.monsterMotion,p=n=>m.node(n+'.'+side).getWorldPosition(new T.Vector3());return[p('upperarm').distanceTo(p('forearm')),p('forearm').distanceTo(p('hand'))];});return{windup:b.attack.windup,flight:b.attack.flight,damage:b.attack.damage,lengths:'${name}'==='redking'?b.__armLengths():[]};`,
      );
      await advance(base.windup * 0.9);
      const gather = await act(
        `const m=b.monsterMotion;return {origin:m.root.worldToLocal(m.origin(m.castSide(b.attack))).toArray(),charge:b.chargeGroup.visible};`,
      );
      await page.screenshot({path: folder + '/' + name + '-' + kind + '-gather.png'});
      await advance(base.windup * 0.1 + base.flight * 0.55);
      const flight = await act(
        `const e=b.visualEffects.find(e=>e.kind==='enemy-${kind}');return e?{position:e.group.position.toArray(),start:e.start.toArray(),visible:e.group.visible,age:e.age}:null;`,
      );
      assert.equal(await act('return b.heroHealth'), 100, 'damage must wait for contact');
      if (kind === 'bolt')
        assert.ok(
          flight && flight.position[2] > flight.start[2] + 3,
          'projectile must actually travel from the monster',
        );
      if (kind === 'sweep')
        assert.ok(flight?.visible, 'claw/eye beam must be visible during its firing phase');
      await page.screenshot({path: folder + '/' + name + '-' + kind + '-flight.png'});
      await advance(base.flight * 0.43);
      const contact = await act(
        `const m=b.monsterMotion;return {origin:m.root.worldToLocal(m.origin(m.castSide(b.attack))).toArray(),lengths:'${name}'==='redking'?b.__armLengths():[],parents:'${name}'==='redking'?['L','R'].map(side=>[m.node('hand.'+side).parent===m.node('forearm.'+side),m.node('foot.'+side).parent===m.node('knee.'+side)]):[]};`,
      );
      if (name === 'redking') {
        assert.ok(contact.parents.flat().every(Boolean), 'hands and feet must follow their real limb chains');
        contact.lengths.forEach((length, i) =>
          assert.ok(Math.abs(length - base.lengths[i]) < 1e-4, 'limbs must stay rigid during attacks'),
        );
        if (kind === 'melee')
          assert.ok(contact.origin[2] - gather.origin[2] > 1.5, 'the attacking fist must extend forward');
      }
      await page.screenshot({path: folder + '/' + name + '-' + kind + '-contact.png'});
      await advance(base.flight * 0.02 + 0.03);
      assert.equal(await act('return b.heroHealth'), 100 - base.damage, 'damage must coincide with impact');
      await advance(0.4);
      data.push({name, kind, gather, flight, contact});
      console.log('PASS', name, kind, 'windup, visible attack, contact and recovery');
    }
  await act("b.start();b.nextAttack=100;b.enemyDistance=16.5;b.monsterBaseZ=3.5;b.currentMonster.position.z=3.5;b.meleeHits=2;b.beginAttack('bolt');");
  await advance(1.15);
  await act("b.punch('left');");
  await advance(.4);
  assert.equal(
    await act("return b.visualEffects.some(e=>e.kind.startsWith('enemy-'))||b.chargeGroup.visible;"),
    false,
    'knockback must stop outgoing enemy visuals',
  );
  assert.equal(await act('return b.heroHealth;'), 100, 'a canceled attack must not deal delayed damage');
  await act('b.start();b.nextAttack=100;');
  await advance(0.1);
  assert.ok(
    await act(
      'return b.currentMonster.position.y<.2&&b.knockbackAt===-Infinity&&b.monsterHitAt===-Infinity;',
    ),
    'restart must clear recoil from the previous fight',
  );
  assert.deepEqual(errors, []);
  await writeFile(folder + '/report.json', JSON.stringify(data, null, 2));
} finally {
  await browser.close();
}
