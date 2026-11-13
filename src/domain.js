import { ACCESS, isOffice, STORES } from './data.js';
export const money = n => new Intl.NumberFormat('en-HK',{style:'currency',currency:'HKD',maximumFractionDigits:0}).format(n);
export const number = n => new Intl.NumberFormat('en-HK').format(n);
export const dateLabel = value => new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Hong_Kong'});
export const timeLabel = value => new Date(value).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'});
export const dateKey = value => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const stockAt = (state,productId,location) => state.inventory.find(x=>x.productId===productId&&x.location===location)?.quantity || 0;
export const canApprove = actor => isOffice(actor.role)||actor.role==='Store Manager';
export const inScope = (actor,store) => isOffice(actor.role)||actor.role==='Warehouse Staff'||actor.store===store;
export function refundable(state,saleId,productId) {
  const sale=state.sales.find(s=>s.id===saleId); const sold=sale?.items.find(i=>i.productId===productId)?.quantity||0;
  return sold-state.refunds.filter(r=>r.saleId===saleId&&r.status!=='Rejected').reduce((s,r)=>s+r.items.filter(i=>i.productId===productId).reduce((n,i)=>n+i.quantity,0),0);
}
const requireThat = (condition,message) => {if(!condition)throw new Error(message);};
const whole = n => Number.isSafeInteger(Number(n))&&Number(n)>0;
export function applyAction(state,actor,type,payload) {
  const s=structuredClone(state); const now=new Date().toISOString(); const id=prefix=>`${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
  const allow=page=>requireThat(ACCESS[actor.role]?.includes(page),'Your role does not have permission to perform this action.');
  const move=(productId,location,quantity,kind,reference)=>{
    const row=s.inventory.find(i=>i.productId===productId&&i.location===location);requireThat(row,'Inventory record not found.');requireThat(row.quantity+quantity>=0,'Insufficient stock at this location.');row.quantity+=quantity;
    s.movements.unshift({id:id('MOV'),productId,location,quantity,type:kind,reference,createdAt:now});
  };
  let result;
  if(type==='sale') {
    allow('pos');requireThat(inScope(actor,payload.store),'You can only sell at your assigned store.');requireThat(STORES.some(x=>x.id===payload.store),'Choose a valid store.');requireThat(payload.items?.length,'Add an item to the cart.');requireThat(['Card','Cash','Octopus'].includes(payload.payment),'Choose a payment method.');
    const ids=new Set();const items=payload.items.map(i=>{requireThat(!ids.has(i.productId),'Duplicate cart items.');ids.add(i.productId);const p=s.products.find(p=>p.id===i.productId);requireThat(p?.active,'A product is no longer available.');requireThat(whole(i.quantity),'Quantities must be positive whole numbers.');return {productId:p.id,name:p.name,code:p.code,price:p.price,cost:p.cost,quantity:Number(i.quantity)};});
    result={id:id('UKY'),store:payload.store,items,total:items.reduce((n,i)=>n+i.price*i.quantity,0),payment:payload.payment,createdAt:now,staff:actor.name};
    items.forEach(i=>move(i.productId,payload.store,-i.quantity,'Sale',result.id));s.sales.unshift(result);
  } else if(type==='product') {
    allow('products');requireThat(payload.name?.trim()&&payload.code?.trim(),'Product name and code are required.');requireThat(Number.isFinite(Number(payload.price))&&Number(payload.price)>0,'Enter a valid selling price.');requireThat(Number.isFinite(Number(payload.cost))&&Number(payload.cost)>=0,'Enter a valid unit cost.');requireThat(!s.products.some(p=>p.code.toLowerCase()===payload.code.trim().toLowerCase()&&p.id!==payload.id),'This product code already exists.');
    const existing=s.products.find(p=>p.id===payload.id);result={...existing,...payload,id:existing?.id||id('P'),name:payload.name.trim(),code:payload.code.trim().toUpperCase(),price:Number(payload.price),cost:Number(payload.cost),active:payload.active??true};
    if(existing)s.products=s.products.map(p=>p.id===result.id?result:p);else {s.products.unshift(result);['central','mongkok','causeway','tst','warehouse'].forEach(location=>s.inventory.push({location,productId:result.id,quantity:0,minimum:15}));}
  } else if(type==='request') {
    allow('replenishment');requireThat(actor.role!=='Warehouse Staff','Warehouse staff can process requests but cannot submit them.');requireThat(inScope(actor,payload.store),'Choose your assigned store.');requireThat(STORES.some(x=>x.id===payload.store),'Choose a valid store.');requireThat(s.products.some(p=>p.id===payload.productId&&p.active),'Choose an active product.');requireThat(whole(payload.quantity),'Enter a positive whole quantity.');
    requireThat(!s.requests.some(r=>r.store===payload.store&&r.productId===payload.productId&&!['Received','Rejected','Cancelled'].includes(r.status)),'An active request already exists for this store and product. Complete or cancel it before creating another.');
    result={...payload,id:id('REP'),quantity:Number(payload.quantity),status:'Pending',createdAt:now};s.requests.unshift(result);
  } else if(type==='requestStatus') {
    allow('replenishment');const r=s.requests.find(r=>r.id===payload.id);requireThat(r,'Request not found.');requireThat(inScope(actor,r.store),'This request belongs to another store.');
    const next={Pending:['Approved','Rejected','Cancelled'],Approved:['Processing','Cancelled'],Processing:['Dispatched','Cancelled'],Dispatched:['Received']};requireThat(next[r.status]?.includes(payload.status),'This status change is not available.');
    const office=isOffice(actor.role),warehouse=actor.role==='Warehouse Staff';
    if(['Approved','Rejected'].includes(payload.status))requireThat(office,'Head office approval is required.');
    if(['Processing','Dispatched'].includes(payload.status))requireThat(office||warehouse,'Warehouse permission is required.');
    if(payload.status==='Received'||payload.status==='Cancelled')requireThat(office||actor.role==='Store Manager','A store manager or head office must confirm this action.');
    if(payload.status==='Dispatched')move(r.productId,'warehouse',-r.quantity,'Replenishment dispatch',r.id);
    if(payload.status==='Received')move(r.productId,r.store,r.quantity,'Replenishment receipt',r.id);
    r.status=payload.status;r.updatedAt=now;result=r;
  } else if(type==='refund') {
    allow('refunds');const sale=s.sales.find(x=>x.id===payload.saleId);requireThat(sale,'Original transaction not found.');requireThat(STORES.some(x=>x.id===payload.returnStore),'Choose a return store.');requireThat(inScope(actor,payload.returnStore),'Choose your assigned return store.');requireThat(payload.items?.length,'Select at least one item.');requireThat(payload.reason?.trim(),'A refund reason is required.');
    const ids=new Set();const items=payload.items.map(i=>{requireThat(!ids.has(i.productId),'Duplicate refund items.');ids.add(i.productId);requireThat(whole(i.quantity),'Refund quantities must be positive whole numbers.');requireThat(Number(i.quantity)<=refundable(s,sale.id,i.productId),'The refund quantity exceeds the remaining refundable quantity. A pending refund may already reserve this item.');requireThat(['Resellable','Damaged'].includes(i.condition),'Choose the returned item condition.');const original=sale.items.find(x=>x.productId===i.productId);return {...original,quantity:Number(i.quantity),condition:i.condition};});
    result={id:id('REF'),saleId:sale.id,originalStore:sale.store,returnStore:payload.returnStore,reason:payload.reason,items,total:items.reduce((n,i)=>n+i.quantity*i.price,0),status:'Pending',createdAt:now,staff:actor.name};s.refunds.unshift(result);
  } else if(type==='refundStatus') {
    allow('refunds');requireThat(canApprove(actor),'Manager approval is required.');const r=s.refunds.find(r=>r.id===payload.id);requireThat(r?.status==='Pending','This refund has already been processed.');requireThat(inScope(actor,r.returnStore),'Only the receiving store manager or head office can approve.');requireThat(['Approved','Rejected'].includes(payload.status),'Invalid refund status.');
    r.status=payload.status;r.approvedBy=actor.name;r.updatedAt=now;if(r.status==='Approved')r.items.filter(i=>i.condition==='Resellable').forEach(i=>move(i.productId,r.returnStore,i.quantity,'Refund return',r.id));result=r;
  } else if(type==='adjustStock') {
    allow('inventory');requireThat(isOffice(actor.role)||actor.role==='Warehouse Staff'||actor.role==='Store Manager','Stock adjustment permission required.');requireThat(inScope(actor,payload.location),'Choose your assigned location.');requireThat(actor.role!=='Warehouse Staff'||payload.location==='warehouse','Warehouse staff can only adjust warehouse stock.');requireThat(Number.isSafeInteger(Number(payload.quantity))&&Number(payload.quantity)!==0,'Enter a non-zero whole number.');requireThat(payload.reason?.trim(),'Please give a reason for the adjustment.');move(payload.productId,payload.location,Number(payload.quantity),payload.reason.trim(),'Manual adjustment');result={id:'Stock adjustment'};
  } else if(type==='user') {
    allow('users');requireThat(payload.name?.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email),'Enter a name and a valid email.');requireThat(ACCESS[payload.role],'Choose a valid role.');requireThat(payload.role==='Warehouse Staff'?payload.store==='warehouse':STORES.some(s=>s.id===payload.store),'Choose a valid assigned location for this role.');requireThat(!s.users.some(u=>u.email.toLowerCase()===payload.email.toLowerCase()&&u.id!==payload.id),'A user with this email already exists.');requireThat(payload.id!==actor.id||payload.active!==false,'You cannot deactivate the current user.');requireThat(payload.id!==actor.id||payload.role===actor.role,'Change your active role from the profile menu.');result={...payload,id:payload.id||id('U'),active:payload.active??true};const exists=s.users.some(u=>u.id===result.id);s.users=exists?s.users.map(u=>u.id===result.id?result:u):[...s.users,result];
  } else if(type==='settings') {
    allow('settings');requireThat(isOffice(actor.role),'Only head office can change business settings.');requireThat(payload.businessName?.trim(),'Business name is required.');s.settings={...s.settings,...payload};result={id:'Settings'};
  } else throw new Error('Unknown action.');
  s.activity.unshift({id:id('ACT'),type,reference:result.id,label:{sale:'Sale completed',product:'Product catalogue updated',request:'Replenishment requested',requestStatus:`Request ${payload.status?.toLowerCase()}`,refund:'Refund submitted',refundStatus:`Refund ${payload.status?.toLowerCase()}`,adjustStock:'Stock adjusted',user:'Team member updated',settings:'Settings updated'}[type],createdAt:now,actor:actor.name,store:result.store||result.returnStore||payload.location});
  return {state:s,result};
}
