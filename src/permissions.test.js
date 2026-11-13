import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,ROLES,ACCESS} from './data.js';
import {applyAction,stockAt} from './domain.js';
import {canAccess,canAction,resolvePage,locationScope,workspaceState,refundLookup,requestTransitions,validDemoActor} from './permissions.js';
const actor=(role,store='central')=>({id:`demo-${role}`,name:'Demo user',role,store:role==='Warehouse Staff'?'warehouse':store});
const admin=actor('System Administrator'),office=actor('Head Office Manager');
const manager=actor('Store Manager','mongkok'),sales=actor('Sales Staff'),warehouse=actor('Warehouse Staff');

test('every role has a dashboard; unauthorised routes resolve to an accessible landing page',()=>{
  for(const role of ROLES) {
    const user=actor(role);
    assert.ok(canAccess(user,'dashboard'));
    for(const page of [...new Set(Object.values(ACCESS).flat()),'unknown']) {
      const resolved=resolvePage(user,page);
      assert.ok(canAccess(user,resolved));
      if(canAccess(user,page))assert.equal(resolved,page);
    }
  }
  assert.equal(resolvePage(sales,'users'),'pos');
  assert.equal(resolvePage(warehouse,'refunds'),'dashboard');
  assert.equal(canAccess(sales,'settings'),false);
  assert.equal(canAccess(warehouse,'pos'),false);
  assert.equal(canAccess(office,'users'),false);
  assert.equal(canAccess(office,'settings'),false);
});

test('local workspaces exclude other store records, users, warehouse stock, and unrelated activity',()=>{
  let state=initialState();
  state=applyAction(state,admin,'sale',{store:'mongkok',items:[{productId:'p4',quantity:1}],payment:'Cash'}).state;
  state=applyAction(state,admin,'sale',{store:'central',items:[{productId:'p4',quantity:1}],payment:'Card'}).state;
  state=applyAction(state,admin,'product',{...state.products[0],price:199}).state;
  for(const user of [manager,sales]) {
    const scoped=workspaceState(state,user);
    assert.ok(scoped.sales.length>0);
    assert.ok(scoped.sales.every(s=>s.store===user.store));
    assert.ok(scoped.inventory.every(i=>i.location===user.store));
    assert.ok(scoped.movements.every(m=>m.location===user.store));
    assert.ok(scoped.requests.every(r=>r.store===user.store));
    assert.ok(scoped.activity.every(a=>a.store===user.store));
    assert.deepEqual(scoped.users,[]);
    assert.equal(locationScope(user,'all'),user.store);
    assert.equal(locationScope(user,'tst'),user.store);
  }
  assert.equal(workspaceState(state,office).sales.length,state.sales.length);
  assert.equal(workspaceState(state,office).inventory.length,state.inventory.length);
  assert.deepEqual(workspaceState(state,office).users,[]);
  assert.equal(workspaceState(state,admin).users.length,state.users.length);
});

test('warehouse sees only warehouse data and approved transfer stages',()=>{
  const state=initialState(),scoped=workspaceState(state,warehouse);
  assert.deepEqual(scoped.sales,[]);assert.deepEqual(scoped.refunds,[]);assert.deepEqual(scoped.users,[]);
  assert.ok(scoped.inventory.every(i=>i.location==='warehouse'));
  assert.ok(scoped.requests.some(r=>r.status==='Approved'));
  assert.ok(!scoped.requests.some(r=>['Pending','Rejected','Cancelled'].includes(r.status)));
  assert.equal(locationScope(warehouse,'central'),'warehouse');
  assert.deepEqual(requestTransitions(warehouse,state.requests.find(r=>r.status==='Pending')),[]);
  assert.deepEqual(requestTransitions(warehouse,state.requests.find(r=>r.status==='Approved')),['Processing']);
});

test('direct handlers reject all forbidden writes without changing any business records',()=>{
  const state=initialState();
  const cases=[
    [sales,'product',state.products[0]], [sales,'adjustStock',{location:'central',productId:'p1',quantity:1,reason:'Count'}],
    [sales,'request',{store:'central',productId:'p4',quantity:1}], [sales,'refundStatus',{id:'missing',status:'Approved'}],
    [warehouse,'sale',{store:'central',items:[{productId:'p1',quantity:1}],payment:'Cash'}],
    [warehouse,'refund',{saleId:state.sales[0].id,returnStore:'central',items:[{productId:state.sales[0].items[0].productId,quantity:1,condition:'Resellable'}],reason:'Size'}],
    [warehouse,'request',{store:'central',productId:'p4',quantity:1}], [office,'user',state.users[0]],
    [manager,'settings',{...state.settings,businessName:'Changed'}], [office,'settings',state.settings],
    [manager,'requestStatus',{id:'REP-1001',status:'Approved'}],
    [warehouse,'requestStatus',{id:'REP-1001',status:'Approved'}],
    [warehouse,'requestStatus',{id:'REP-1003',status:'Received'}],
    [warehouse,'requestStatus',{id:'REP-1002',status:'Cancelled'}],
    [manager,'sale',{store:'central',items:[{productId:'p1',quantity:1}],payment:'Cash'}],
    [manager,'request',{store:'central',productId:'p4',quantity:1}],
    [manager,'adjustStock',{location:'central',productId:'p1',quantity:1,reason:'Count'}],
  ];
  for(const [user,type,payload] of cases) {
    const before=structuredClone(state);
    assert.throws(()=>applyAction(state,user,type,payload),undefined,`${user.role}: ${type}`);
    assert.deepEqual(state,before);
  }
});

test('role switching preserves a sale and conserves stock through the complete replenishment workflow',()=>{
  let state=initialState();
  state=applyAction(state,sales,'sale',{store:'central',items:[{productId:'p1',quantity:1}],payment:'Card'}).state;
  const persisted=JSON.stringify(state),count=state.sales.length;
  for(const role of ROLES)workspaceState(state,actor(role));
  assert.equal(JSON.stringify(state),persisted);
  const storeBefore=stockAt(state,'p4','mongkok'),warehouseBefore=stockAt(state,'p4','warehouse');
  const request=applyAction(state,manager,'request',{store:'mongkok',productId:'p4',quantity:5});state=request.state;
  assert.throws(()=>applyAction(state,manager,'request',{store:'mongkok',productId:'p4',quantity:5}),/active request/);
  for(const [user,status] of [[office,'Approved'],[warehouse,'Processing'],[warehouse,'Dispatched'],[manager,'Received']]) {
    assert.ok(requestTransitions(user,state.requests.find(r=>r.id===request.result.id)).includes(status));
    state=applyAction(state,user,'requestStatus',{id:request.result.id,status}).state;
  }
  assert.equal(stockAt(state,'p4','mongkok'),storeBefore+5);
  assert.equal(stockAt(state,'p4','warehouse'),warehouseBefore-5);
  assert.equal(state.sales.length,count);
  assert.equal(workspaceState(state,warehouse).requests.find(r=>r.id===request.result.id).status,'Received');
});

test('cross-store refund lookup works without exposing other stores in sales history',()=>{
  let state=initialState();
  const sale=applyAction(state,sales,'sale',{store:'central',items:[{productId:'p1',quantity:2}],payment:'Card'});state=sale.state;
  const localSales={...sales,store:'mongkok'};
  assert.ok(!workspaceState(state,localSales).sales.some(s=>s.id===sale.result.id));
  const found=refundLookup(state,localSales,{id:sale.result.id})[0];
  assert.equal(found.items[0].refundableQuantity,2);
  assert.equal(found.staff,undefined);assert.equal(found.items[0].cost,undefined);
  assert.throws(()=>refundLookup(state,warehouse,{id:sale.result.id}),/permission/);
  const before=stockAt(state,'p1','mongkok');
  const refund=applyAction(state,localSales,'refund',{saleId:found.id,returnStore:'mongkok',items:[{productId:'p1',quantity:1,condition:'Resellable'}],reason:'Size'});state=refund.state;
  assert.equal(refundLookup(state,manager,{id:found.id})[0].items[0].refundableQuantity,1);
  assert.throws(()=>applyAction(state,sales,'refundStatus',{id:refund.result.id,status:'Approved'}),/permission/);
  assert.throws(()=>applyAction(state,actor('Store Manager'),'refundStatus',{id:refund.result.id,status:'Approved'}),/receiving store/);
  state=applyAction(state,manager,'refundStatus',{id:refund.result.id,status:'Approved'}).state;
  assert.equal(stockAt(state,'p1','mongkok'),before+1);
  assert.equal(workspaceState(state,sales).sales.find(s=>s.id===found.id).refundedTotal,189);
  assert.equal(workspaceState(state,manager).refunds.find(r=>r.id===refund.result.id).originalPayment,'Card');
  assert.deepEqual(workspaceState(state,sales).refunds,[]);
});

test('administrator can configure manager refund approval; settings persist and head office can still approve',()=>{
  let state=initialState();const sale=state.sales.find(s=>s.store==='central');
  const refund=applyAction(state,manager,'refund',{saleId:sale.id,returnStore:'mongkok',items:[{productId:sale.items[0].productId,quantity:1,condition:'Resellable'}],reason:'Size'});state=refund.state;
  assert.equal(canAction(manager,'refundStatus',state.settings),true);
  state=applyAction(state,admin,'settings',{...state.settings,managerRefundApproval:false}).state;
  assert.equal(canAction(manager,'refundStatus',state.settings),false);
  assert.throws(()=>applyAction(state,manager,'refundStatus',{id:refund.result.id,status:'Approved'}),/permission/);
  assert.throws(()=>applyAction(state,manager,'settings',{...state.settings,managerRefundApproval:true}),/permission/);
  state=JSON.parse(JSON.stringify(state));
  assert.equal(state.settings.managerRefundApproval,false);
  state=applyAction(state,office,'refundStatus',{id:refund.result.id,status:'Approved'}).state;
  assert.equal(state.refunds[0].status,'Approved');
});

test('invalid saved demo identities are rejected and every supported role accepts a valid location',()=>{
  for(const role of ROLES)assert.ok(validDemoActor(actor(role)));
  for(const invalid of [null,{},actor('Unknown'),{...manager,store:'warehouse'},{...warehouse,store:'central'},{...sales,name:''}])assert.equal(validDemoActor(invalid),false);
});
