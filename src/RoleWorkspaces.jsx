import React from 'react';
import {Users,ShieldCheck,Database,Settings,ShoppingBag,ReceiptText,Wallet,RefreshCw,Boxes,Truck,Package,ArrowRight,CheckCircle2} from 'lucide-react';
import {useApp} from './store';
import {ROLES,TODAY,storeName} from './data';
import {money,number,dateKey,dateLabel,timeLabel} from './domain';
import {Button,PageHeading,StatCard,CardHeading,Badge,Empty,ProductIdentity} from './components';

export function AdminWorkspace({navigate}) {
  const {state}=useApp();
  return <>
    <PageHeading eyebrow="SYSTEM ADMINISTRATION" title="Administration overview" description="Manage your team, access permissions, and workspace health.">
      <Button variant="secondary" icon={Settings} onClick={()=>navigate('settings')}>System settings</Button>
      <Button icon={Users} onClick={()=>navigate('users')}>Manage team</Button>
    </PageHeading>
    <div className="stats-grid">
      <StatCard label="Team members" value={state.users.length} icon={Users} note="Across your retail team" onClick={()=>navigate('users')}/>
      <StatCard label="Active accounts" value={state.users.filter(u=>u.active).length} icon={CheckCircle2} tone="green" note="Ready to use the workspace"/>
      <StatCard label="Workspace roles" value={ROLES.length} icon={ShieldCheck} tone="purple" note="Permissions enforced on every action"/>
      <StatCard label="System status" value="Operational" icon={Database} tone="green" note="Shared data saved in this browser"/>
    </div>
    <div className="workspace-columns">
      <section className="card"><CardHeading title="Role overview" description="Every team has a workspace for its responsibilities."/>
        <div className="table-scroll"><table><thead><tr><th>Role</th><th>Active users</th><th>Workspace focus</th></tr></thead><tbody>{ROLES.map((role,i)=><tr key={role}><td className="cell-strong">{role}</td><td>{state.users.filter(u=>u.active&&u.role===role).length}</td><td>{['Users, access configuration, and all operations','All-store performance, pricing, and approvals','Assigned-store stock, sales, and returns','Checkout, local sales history, and refund requests','Warehouse inventory, picking, and dispatch'][i]}</td></tr>)}</tbody></table></div>
        <button className="card-bottom-link" onClick={()=>navigate('settings')}>Configure store manager refund approval <ArrowRight size={15}/></button>
      </section>
      <section className="card"><CardHeading title="Workspace health" description="Your connected retail prototype."/>
        <div className="workspace-list">
          <div><span><strong>Business records</strong><small>{number(state.sales.length)} sales · {state.requests.length} replenishments · {state.refunds.length} refunds</small></span><Badge status="Active"/></div>
          <div><span><strong>Shared catalogue</strong><small>{state.products.filter(p=>p.active).length} active products across 5 locations</small></span><Badge status="In stock">Unified</Badge></div>
          <div><span><strong>Manager refund approval</strong><small>Receiving store only; head office always retains access</small></span><Badge status={state.settings.managerRefundApproval===false?'Inactive':'Active'}/></div>
          <div><span><strong>Demo access</strong><small>Switch roles in your profile to preview each workspace.</small></span><ShieldCheck size={18}/></div>
        </div>
        <button className="card-bottom-link" onClick={()=>navigate('reports')}>Open business reports <ArrowRight size={15}/></button>
      </section>
    </div>
    <section className="card workspace-section"><CardHeading title="Operational workspaces" description="Full system access includes every retail workflow."/>
      <div className="workspace-shortcuts"><Button icon={ShoppingBag} onClick={()=>navigate('pos')}>Point of sale</Button><Button variant="secondary" icon={Truck} onClick={()=>navigate('replenishment')}>Replenishment</Button><Button variant="secondary" icon={RefreshCw} onClick={()=>navigate('refunds')}>Refunds</Button><Button variant="secondary" icon={Package} onClick={()=>navigate('products')}>Product & pricing</Button></div>
    </section>
  </>;
}

export function SalesWorkspace({navigate}) {
  const {state,actor}=useApp();
  const today=state.sales.filter(s=>dateKey(s.createdAt)===TODAY);
  const recent=[...state.sales].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6);
  return <>
    <PageHeading eyebrow="SALES WORKSPACE" title={`Ready for the next sale, ${actor.name.split(' ')[0]}?`} description={`${storeName(actor.store)} · Checkout and customer returns in one place.`}>
      <Button icon={ShoppingBag} onClick={()=>navigate('pos')}>Open POS / Search products</Button>
    </PageHeading>
    <div className="stats-grid">
      <StatCard label="Today's sales" value={money(today.reduce((n,s)=>n+s.total,0))} icon={Wallet} note={`${dateLabel(TODAY)} · ${storeName(actor.store)}`}/>
      <StatCard label="Today's transactions" value={today.length} icon={ReceiptText} tone="green" note="Sales at your assigned store"/>
      <StatCard label="Today's units sold" value={today.reduce((n,s)=>n+s.items.reduce((v,i)=>v+i.quantity,0),0)} icon={ShoppingBag} tone="purple" note="Completed checkouts"/>
      <StatCard label="Refund requests pending" value={state.refunds.filter(r=>r.status==='Pending').length} icon={RefreshCw} tone="amber" note="Awaiting authorised manager approval" onClick={()=>navigate('refunds')}/>
    </div>
    <div className="workspace-shortcuts card"><Button icon={ShoppingBag} onClick={()=>navigate('pos')}>Start a new sale</Button><Button variant="secondary" icon={ReceiptText} onClick={()=>navigate('sales')}>Local sales history</Button><Button variant="secondary" icon={RefreshCw} onClick={()=>navigate('refunds')}>Submit a refund request</Button></div>
    <section className="card workspace-section"><CardHeading title="Recent transactions" description={`Sales from ${storeName(actor.store)}. Cross-store receipts are available through refund lookup.`}/>
      <div className="table-scroll"><table><thead><tr><th>Transaction</th><th>Date & time</th><th>Payment</th><th>Total</th><th/></tr></thead><tbody>{recent.map(s=><tr key={s.id}><td className="mono">{s.id}</td><td>{dateLabel(s.createdAt)} · {timeLabel(s.createdAt)}</td><td>{s.payment}</td><td className="cell-strong">{money(s.total)}</td><td><button className="text-link" onClick={()=>navigate('sales',{search:s.id})}>View receipt <ArrowRight size={14}/></button></td></tr>)}</tbody></table>{!recent.length&&<Empty title="Your first sale starts here" description="Complete a checkout to see it here." action={<Button onClick={()=>navigate('pos')}>Open POS</Button>}/>}</div>
    </section>
  </>;
}

export function WarehouseWorkspace({navigate}) {
  const {state}=useApp();
  const ready=state.requests.filter(r=>['Approved','Processing'].includes(r.status));
  const completed=state.requests.filter(r=>['Dispatched','Received'].includes(r.status));
  const low=state.inventory.filter(i=>i.quantity<i.minimum&&state.products.find(p=>p.id===i.productId)?.active);
  return <>
    <PageHeading eyebrow="WAREHOUSE WORKSPACE" title="Keep stock moving" description="Main warehouse · Pick approved requests and confirm dispatch.">
      <Button variant="secondary" icon={Boxes} onClick={()=>navigate('inventory')}>Warehouse inventory</Button><Button icon={Truck} onClick={()=>navigate('replenishment')}>Process dispatches</Button>
    </PageHeading>
    <div className="stats-grid">
      <StatCard label="Warehouse units" value={number(state.inventory.reduce((n,i)=>n+i.quantity,0))} icon={Boxes} note="Available in the main warehouse" onClick={()=>navigate('inventory')}/>
      <StatCard label="Pending dispatches" value={ready.length} icon={Package} tone="amber" note="Approved or being picked"/>
      <StatCard label="Completed dispatches" value={completed.length} icon={Truck} tone="green" note="Dispatched or received by a store"/>
      <StatCard label="Low stock lines" value={low.length} icon={Boxes} tone="purple" note="Below warehouse minimum levels" onClick={()=>navigate('inventory',{lowOnly:true})}/>
    </div>
    <section className="card"><CardHeading title="Picking & dispatch queue" description="Only approved requests can enter your warehouse workflow."/>
      <div className="table-scroll"><table><thead><tr><th>Request</th><th>Product</th><th>Destination</th><th>Units</th><th>Status</th><th/></tr></thead><tbody>{ready.map(r=><tr key={r.id}><td className="mono">{r.id}</td><td><ProductIdentity product={state.products.find(p=>p.id===r.productId)}/></td><td>{storeName(r.store)}</td><td>{r.quantity}</td><td><Badge status={r.status}/></td><td><button className="text-link" onClick={()=>navigate('replenishment',{requestId:r.id})}>{r.status==='Approved'?'Start picking':'Confirm dispatch'} <ArrowRight size={14}/></button></td></tr>)}</tbody></table>{!ready.length&&<Empty title="Dispatch queue is clear" description="Requests appear here after head office approval."/>}</div>
    </section>
    <section className="card workspace-section"><CardHeading title="Completed dispatches" description="Stock already deducted from the warehouse. Stores confirm receipt."/>
      <div className="table-scroll"><table><thead><tr><th>Reference</th><th>Destination</th><th>Units</th><th>Status</th><th/></tr></thead><tbody>{completed.map(r=><tr key={r.id}><td className="mono">{r.id}</td><td>{storeName(r.store)}</td><td>{r.quantity}</td><td><Badge status={r.status}/></td><td><button className="text-link" onClick={()=>navigate('replenishment',{requestId:r.id})}>View transfer <ArrowRight size={14}/></button></td></tr>)}</tbody></table>{!completed.length&&<Empty title="No dispatches yet" description="Completed warehouse handoffs will appear here."/>}</div>
    </section>
  </>;
}

export function OperationalPriorities({navigate}) {
  const {state,actor,scope}=useApp();
  const store=actor.role==='Store Manager';
  const requests=state.requests.filter(r=>scope==='all'||r.store===scope);
  const refunds=state.refunds.filter(r=>(scope==='all'||r.returnStore===scope)&&r.status==='Pending');
  const priorities=[
    {label:store?'Active replenishments':'Replenishment approvals',count:requests.filter(r=>store?!['Received','Rejected','Cancelled'].includes(r.status):r.status==='Pending').length,description:store?`${requests.filter(r=>r.status==='Dispatched').length} in transit · confirm receipt on arrival`:'Approve or reject requests before warehouse picking',page:'replenishment',icon:Truck},
    {label:store?'Local pending refunds':'Refund approvals',count:refunds.length,description:store&&state.settings.managerRefundApproval===false?'Head office approval required by current permissions':'Review returned items before updating stock',page:'refunds',icon:RefreshCw},
    {label:store?'Local units on hand':'Low stock alerts',count:state.inventory.filter(i=>scope==='all'||i.location===scope).reduce((n,i)=>n+(store?i.quantity:i.quantity<i.minimum&&state.products.find(p=>p.id===i.productId)?.active?1:0),0),description:store?'Manage your assigned store inventory':'Review stock and prepare replenishments',page:'inventory',icon:Boxes},
  ];
  return <div className="workspace-priorities">{priorities.map(p=><button className="card workspace-priority" key={p.page} onClick={()=>navigate(p.page,p.page==='inventory'&&!store?{lowOnly:true}:{})}><p.icon size={19}/><span><strong>{p.count} {p.label.toLowerCase()}</strong><small>{p.description}</small></span><ArrowRight size={16}/></button>)}</div>;
}
