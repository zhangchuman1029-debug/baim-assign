import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, TODAY} from './data.js';
import {applyAction,stockAt,refundable,dateKey} from './domain.js';

const admin={id:'u1',name:'Alex Chan',role:'System Administrator',store:'central'};
const sales={id:'u3',name:'Chris Lee',role:'Sales Staff',store:'central'};
const manager={id:'u2',name:'Jamie Wong',role:'Store Manager',store:'mongkok'};
const warehouse={id:'u4',name:'Sam Lam',role:'Warehouse Staff',store:'warehouse'};
const office={id:'head-office',name:'Taylor Ho',role:'Head Office Manager',store:'central'};
const checkout=(s,items=[{productId:'p1',quantity:2}])=>applyAction(s,admin,'sale',{store:'central',items,payment:'Card'});
const refund=(s,sale,items=[{productId:sale.items[0].productId,quantity:1,condition:'Resellable'}],actor=admin)=>applyAction(s,actor,'refund',{saleId:sale.id,returnStore:'mongkok',items,reason:'Size or fit'});

test('sale stores original prices, deducts exact inventory, adds revenue and a linked movement',()=>{
  const s=initialState(),before=stockAt(s,'p1','central'),sum=s.sales.reduce((n,x)=>n+x.total,0);
  const out=checkout(s),sale=out.result;
  assert.equal(sale.total,378);assert.equal(stockAt(out.state,'p1','central'),before-2);
  assert.equal(out.state.sales.reduce((n,x)=>n+x.total,0),sum+378);
  assert.equal(out.state.movements[0].reference,sale.id);assert.equal(out.state.movements[0].quantity,-2);
  const changed=applyAction(out.state,admin,'product',{...s.products[0],price:299}).state;
  assert.equal(changed.sales.find(x=>x.id===sale.id).items[0].price,189);
  assert.equal(changed.sales.find(x=>x.id===sale.id).total,378);
  assert.equal(stockAt(s,'p1','central'),before,'input state is immutable');
});

test('sale records the Other payment method',()=>{
  const out=applyAction(initialState(),admin,'sale',{store:'central',items:[{productId:'p1',quantity:1}],payment:'Other'});
  assert.equal(out.result.payment,'Other');
  assert.equal(out.state.sales[0].payment,'Other');
});

test('insufficient stock cannot partially deduct another item or create a sale',()=>{
  const s=initialState(),before=structuredClone(s);
  assert.throws(()=>checkout(s,[{productId:'p1',quantity:1},{productId:'p2',quantity:9999}]),/Insufficient stock/);
  assert.deepEqual(s,before);
});

test('checkout rejects duplicate lines, fractional quantities, inactive products, and incorrect store',()=>{
  const s=initialState();
  assert.throws(()=>checkout(s,[{productId:'p1',quantity:1},{productId:'p1',quantity:1}]),/Duplicate/);
  assert.throws(()=>checkout(s,[{productId:'p1',quantity:1.5}]),/whole/);
  s.products[0].active=false;assert.throws(()=>checkout(s),/no longer available/);
  assert.throws(()=>applyAction(s,sales,'sale',{store:'mongkok',items:[{productId:'p2',quantity:1}],payment:'Card'}),/assigned store/);
});

test('replenishment rejects duplicate active requests and conserves stock through each handoff',()=>{
  let s=initialState();const payload={store:'mongkok',productId:'p4',quantity:17,note:'Demo'};
  const storeBefore=stockAt(s,'p4','mongkok'),warehouseBefore=stockAt(s,'p4','warehouse');
  const req=applyAction(s,manager,'request',payload);s=req.state;
  assert.throws(()=>applyAction(s,manager,'request',payload),/active request already exists/);
  assert.equal(stockAt(s,'p4','warehouse'),warehouseBefore);
  assert.throws(()=>applyAction(s,manager,'requestStatus',{id:req.result.id,status:'Approved'}),/Head office/);
  s=applyAction(s,office,'requestStatus',{id:req.result.id,status:'Approved'}).state;
  s=applyAction(s,warehouse,'requestStatus',{id:req.result.id,status:'Processing'}).state;
  assert.equal(stockAt(s,'p4','warehouse'),warehouseBefore);
  s=applyAction(s,warehouse,'requestStatus',{id:req.result.id,status:'Dispatched'}).state;
  assert.equal(stockAt(s,'p4','warehouse'),warehouseBefore-17);assert.equal(stockAt(s,'p4','mongkok'),storeBefore);
  assert.throws(()=>applyAction(s,warehouse,'requestStatus',{id:req.result.id,status:'Received'}),/store manager/);
  s=applyAction(s,manager,'requestStatus',{id:req.result.id,status:'Received'}).state;
  assert.equal(stockAt(s,'p4','mongkok'),storeBefore+17);
  assert.equal(stockAt(s,'p4','warehouse')+stockAt(s,'p4','mongkok'),warehouseBefore+storeBefore);
  assert.throws(()=>applyAction(s,manager,'requestStatus',{id:req.result.id,status:'Received'}),/not available/);
  assert.doesNotThrow(()=>applyAction(s,manager,'request',payload));
});

test('dispatch cannot overdraw the warehouse and cannot skip processing',()=>{
  let s=initialState();const req=applyAction(s,admin,'request',{store:'central',productId:'p5',quantity:9999});s=req.state;
  s=applyAction(s,admin,'requestStatus',{id:req.result.id,status:'Approved'}).state;
  assert.throws(()=>applyAction(s,admin,'requestStatus',{id:req.result.id,status:'Dispatched'}),/not available/);
  s=applyAction(s,admin,'requestStatus',{id:req.result.id,status:'Processing'}).state;
  const before=structuredClone(s);assert.throws(()=>applyAction(s,admin,'requestStatus',{id:req.result.id,status:'Dispatched'}),/Insufficient stock/);assert.deepEqual(s,before);
});

test('pending refunds reserve quantity and manager-approved cross-store returns update only the return store',()=>{
  let s=initialState();const completed=checkout(s);s=completed.state;const sale=completed.result;
  const soldStore=stockAt(s,'p1','central'),receiving=stockAt(s,'p1','mongkok');
  const submitted=refund(s,sale,[{productId:'p1',quantity:2,condition:'Resellable'}],manager);s=submitted.state;
  assert.equal(submitted.result.originalStore,'central');assert.equal(submitted.result.returnStore,'mongkok');
  assert.equal(refundable(s,sale.id,'p1'),0);assert.equal(stockAt(s,'p1','mongkok'),receiving);
  assert.throws(()=>refund(s,sale),/exceeds/);
  assert.throws(()=>applyAction(s,sales,'refundStatus',{id:submitted.result.id,status:'Approved'}),/permission|Manager approval/);
  s=applyAction(s,manager,'refundStatus',{id:submitted.result.id,status:'Approved'}).state;
  assert.equal(stockAt(s,'p1','mongkok'),receiving+2);assert.equal(stockAt(s,'p1','central'),soldStore);
  assert.equal(s.refunds[0].saleId,sale.id);assert.equal(s.refunds[0].total,378);
  assert.throws(()=>applyAction(s,manager,'refundStatus',{id:submitted.result.id,status:'Approved'}),/already been processed/);
});

test('damaged returned items do not increase sellable stock; refund uses original price after catalogue edit',()=>{
  let s=initialState();const completed=checkout(s);s=completed.state;
  s=applyAction(s,admin,'product',{...s.products[0],price:999}).state;
  const before=stockAt(s,'p1','mongkok');const submitted=refund(s,completed.result,[{productId:'p1',quantity:1,condition:'Damaged'}]);s=submitted.state;
  assert.equal(submitted.result.total,189);
  s=applyAction(s,manager,'refundStatus',{id:submitted.result.id,status:'Approved'}).state;
  assert.equal(stockAt(s,'p1','mongkok'),before);
});

test('rejected refunds release reserved quantities; duplicates and excessive quantities are prevented',()=>{
  let s=initialState();const completed=checkout(s);s=completed.state;
  assert.throws(()=>refund(s,completed.result,[{productId:'p1',quantity:3,condition:'Resellable'}]),/exceeds/);
  assert.throws(()=>refund(s,completed.result,[{productId:'p1',quantity:1,condition:'Resellable'},{productId:'p1',quantity:1,condition:'Resellable'}]),/Duplicate refund/);
  const r=refund(s,completed.result);s=r.state;assert.equal(refundable(s,completed.result.id,'p1'),1);
  s=applyAction(s,manager,'refundStatus',{id:r.result.id,status:'Rejected'}).state;
  assert.equal(refundable(s,completed.result.id,'p1'),2);
});

test('role boundaries are enforced for catalogue, user administration, settings and adjustments',()=>{
  const s=initialState();
  assert.throws(()=>applyAction(s,sales,'product',s.products[0]),/permission/);
  assert.throws(()=>applyAction(s,office,'user',s.users[0]),/permission/);
  assert.throws(()=>applyAction(s,manager,'settings',{businessName:'Updated'}),/permission/);
  assert.throws(()=>applyAction(s,warehouse,'adjustStock',{location:'central',productId:'p1',quantity:1,reason:'Count'}),/only adjust warehouse/);
  assert.throws(()=>applyAction(s,manager,'adjustStock',{location:'central',productId:'p1',quantity:1,reason:'Count'}),/assigned location/);
  assert.throws(()=>applyAction(s,admin,'user',{...s.users[0],active:false}),/cannot deactivate/);
});

test('new products have unique codes and inventory records at every location',()=>{
  const s=initialState();
  assert.throws(()=>applyAction(s,admin,'product',{name:'Duplicate',code:'uky-ts-001',price:10,cost:2}),/already exists/);
  const added=applyAction(s,admin,'product',{name:'New tee',code:'UKY-TS-009',price:189,cost:65,category:'T-shirts',active:true});
  const rows=added.state.inventory.filter(i=>i.productId===added.result.id);assert.equal(rows.length,5);assert.ok(rows.every(i=>i.quantity===0));
});

test('local persistence round-trip preserves the sale, transfer, refund and movement links',()=>{
  let s=initialState();const completed=checkout(s);s=completed.state;const ref=refund(s,completed.result);s=ref.state;
  const restored=JSON.parse(JSON.stringify(s));assert.deepEqual(restored,s);
  assert.ok(restored.sales.find(x=>x.id===restored.refunds[0].saleId));
  assert.ok(restored.movements.find(x=>x.reference===completed.result.id));
});

test('Hong Kong reporting day handles UTC date boundaries correctly',()=>{
  assert.equal(dateKey('2026-11-12T16:30:00.000Z'),TODAY);
  assert.equal(dateKey('2026-11-13T15:59:00.000Z'),TODAY);
  assert.equal(dateKey('2026-11-13T16:00:00.000Z'),'2026-11-14');
});
