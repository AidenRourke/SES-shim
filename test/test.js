var test = require('tape');
var Realm = require('../proposal-realms/shim/src/realm.js').default;
var SES = require('../index.js');

test('hello', function(t) {
  t.plan(2); // need t.plan or t.end, but both is ok too
  t.equal(1, 1);
  t.equal(1+1, 2);
  t.end();
});

test('realm smoketest', function(t) {
  const r = new Realm();
  let o = r.evaluate('123+4');
  t.equal(o, 127);

  var captured = 0;
  r.global.other = function(a, b) { captured = a; return a+b; };
  o = r.evaluate('other(1,2)');
  t.equal(o, 3);
  t.equal(captured, 1);

  t.end();
});

/*
test('compileExpr', function(t) {
  let f = SES.compileExpr("a = b+1; a+2");
  let env = {a: 10, b: 20};
  t.equal(f(env), 23);
  t.equal(env.a, 21);
  t.end();
});
*/

/*
test('eval', function(t) {
  const r = new SES.SESRealm();
  t.equal(r.eval('1+2'), 3);

  let hidden = 1;
  t.equal(r.eval('hidden+1'), new Error("something something"));

  r.eval('a = 10;');
  t.equal(r.global.a, 10);

  t.end();
});
*/

test('prepareSESRealm_js', function(t) {
  const source = SES.source;
  t.equal(source.includes("hello i am source"), true);
  t.end();
});

test('root is frozen', function(t) {
  const r = SES.makeRootSESRealm();
  t.ok(r instanceof Realm);
  t.throws(() => r.evaluate('this.a = 10;'));
  try {
    r.evaluate('this.a = 10;');
  } catch (e) {
    t.notOk(e instanceof TypeError);
    t.ok(e instanceof r.global.TypeError);
  }

  t.end();
});

test('spawn from outside', function(t) {
  const r = SES.makeRootSESRealm();
  const c = r.spawn({});
  t.notOk(c instanceof Realm);
  t.ok(c instanceof r.global.Realm);
  //c.evaluate('var a = 10;'); // TODO: does not work yet, same problem as caja
  // difference between shim and proposal. for the shim to solve this, it
  // must do a source-to-source rewrite
  // https://github.com/google/caja/wiki/SES#source-ses-vs-target-ses
  // https://github.com/google/caja/wiki/SES#top-level-declarations
  c.evaluate('this.a = 10;');
  t.equal(c.global.a, 10);

  t.end();
});

test('spawn with endowments from outside', function(t) {
  const r = SES.makeRootSESRealm();
  let b = new Array();
  const c = r.spawn({a: 10, b});
  t.equal(c.evaluate('(a+10)'), 20);
  c.evaluate('b.push(4);');
  t.equal(b[0], 4);
  t.end();
});

test('spawn without endowments from outside', function(t) {
  const r = SES.makeRootSESRealm();
  let b = new Array();
  const c = r.spawn();
  t.equal(c.evaluate('(10+10)'), 20);
  t.end();
});

test('confine with endowments from outside', function(t) {
  const r = SES.makeRootSESRealm();
  t.equal(r.confine('x+y', {x: 1, y: 2}), 3);

  t.end();
});

test('confine without endowments from outside', function(t) {
  const r = SES.makeRootSESRealm();
  t.equal(r.confine('1+2'), 3);

  t.end();
});
