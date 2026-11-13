import React,{useMemo,useState} from 'react';
import {AreaChart,Area,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
import {ArrowUpRight,ArrowRight,CalendarDays,Download,Plus,ShoppingBag,ReceiptText,Boxes,TriangleAlert,ChevronRight,Store,RefreshCw,Check,Package,Wallet,SlidersHorizontal} from 'lucide-react';
import {useApp,downloadCSV} from './store';
import {STORES,TODAY,storeName,ACCESS} from './data';
import {money,number,dateKey,timeLabel} from './domain';
import {Button,PageHeading,CardHeading,StatCard,ProductIdentity,Badge,Select,Empty} from './components';
import {AdminWorkspace,SalesWorkspace,WarehouseWorkspace,OperationalPriorities} from './RoleWorkspaces';
export function useMetrics(days=7) {
  const {state,scope}=useApp();
  return useMemo(()=>{
    const anchor=new Date(TODAY+'T00:00:00Z');const start=new Date(anchor);start.setUTCDate(start.getUTCDate()-days+1);const previous=new Date(start);previous.setUTCDate(previous.getUTCDate()-days);
    const startKey=start.toISOString().slice(0,10),prevKey=previous.toISOString().slice(0,10);
    const scoped=state.sales.filter(s=>scope==='all'||s.store===scope);
    const sales=scoped.filter(s=>dateKey(s.createdAt)>=startKey&&dateKey(s.createdAt)<=TODAY),prior=scoped.filter(s=>dateKey(s.createdAt)>=prevKey&&dateKey(s.createdAt)<startKey);
    const revenue=sales.reduce((s,x)=>s+x.total,0),previousRevenue=prior.reduce((s,x)=>s+x.total,0),units=sales.reduce((s,x)=>s+x.items.reduce((n,i)=>n+i.quantity,0),0),previousUnits=prior.reduce((s,x)=>s+x.items.reduce((n,i)=>n+i.quantity,0),0);
    const trend=(a,b)=>b?(a-b)/b*100:0;
    const daily=Array.from({length:days},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);const k=d.toISOString().slice(0,10);const p=new Date(previous);p.setUTCDate(p.getUTCDate()+i);return {date:d.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}),revenue:sales.filter(s=>dateKey(s.createdAt)===k).reduce((n,s)=>n+s.total,0),previous:prior.filter(s=>dateKey(s.createdAt)===p.toISOString().slice(0,10)).reduce((n,s)=>n+s.total,0)};});
    const performance=STORES.filter(s=>scope==='all'||s.id===scope).map(store=>({...store,revenue:sales.filter(s=>s.store===store.id).reduce((n,s)=>n+s.total,0),transactions:sales.filter(s=>s.store===store.id).length})).sort((a,b)=>b.revenue-a.revenue);
    const topProducts=state.products.map(p=>{const items=sales.flatMap(s=>s.items).filter(i=>i.productId===p.id);return {...p,units:items.reduce((n,i)=>n+i.quantity,0),revenue:items.reduce((n,i)=>n+i.quantity*i.price,0),stock:state.inventory.filter(i=>i.productId===p.id&&(scope==='all'||i.location===scope)).reduce((n,i)=>n+i.quantity,0)};}).sort((a,b)=>b.revenue-a.revenue);
    const lowStock=state.inventory.filter(i=>(scope==='all'||i.location===scope)&&i.quantity<i.minimum&&state.products.find(p=>p.id===i.productId)?.active);
    const refunds=state.refunds.filter(r=>(scope==='all'||r.returnStore===scope)&&dateKey(r.createdAt)>=startKey&&dateKey(r.createdAt)<=TODAY);
    return {sales,revenue,units,trendRevenue:trend(revenue,previousRevenue),trendSales:trend(sales.length,prior.length),trendUnits:trend(units,previousUnits),daily,performance,topProducts,lowStock,refunds,startKey};
  },[state,scope,days]);
}
export default function Dashboard({navigate}) {
  const {state,actor,scope,notify}=useApp();const [days,setDays]=useState(7);const [chartMode,setChartMode]=useState('Revenue');const m=useMetrics(days);
  const pending=state.requests.filter(r=>r.status==='Pending'&&(scope==='all'||r.store===scope)).length;
  const activity=[...state.activity.filter(a=>!a.store||scope==='all'||a.store===scope),...m.sales.slice(0,5).map(s=>({id:s.id,type:'sale',label:'Sale completed',reference:s.id,createdAt:s.createdAt,store:s.store,total:s.total}))].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,4);
  const exportReport=()=>{downloadCSV('UKY-business-overview',m.performance.map(s=>({Store:s.name,Revenue:s.revenue,Transactions:s.transactions,Period:`${m.startKey} to ${TODAY}`})));notify('Business overview exported.');};
  if(actor.role==='System Administrator')return <AdminWorkspace navigate={navigate}/>;
  if(actor.role==='Sales Staff')return <SalesWorkspace navigate={navigate}/>;
  if(actor.role==='Warehouse Staff')return <WarehouseWorkspace navigate={navigate}/>;
  return <>
    <PageHeading eyebrow="YOUR RETAIL WORKSPACE" title={actor.role==='Store Manager'?`${storeName(actor.store)} store overview`:'Business overview'} description={actor.role==='Store Manager'?'Your store sales, inventory, replenishments, and customer returns.':'All-store performance, centralised inventory, and approvals.'}>
      <Button variant="secondary" icon={Download} onClick={exportReport}>Export report</Button>{ACCESS[actor.role].includes('pos')&&<Button icon={Plus} onClick={()=>navigate('pos')}>New sale</Button>}
    </PageHeading>
    <div className="overview-toolbar"><div className="live-label"><span className="live-dot"/>Live overview <span className="toolbar-divider"/> <span>{scope==='all'?'All 4 stores connected':storeName(scope)}</span></div><div className="date-control"><CalendarDays size={15}/><Select aria-label="Reporting period" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>Nov 7 – Nov 13, 2026</option><option value={14}>Oct 31 – Nov 13, 2026</option><option value={30}>Oct 15 – Nov 13, 2026</option></Select></div></div>
    <div className="stats-grid">
      <StatCard label="Total revenue" value={money(m.revenue)} icon={Wallet} change={m.trendRevenue}/>
      <StatCard label="Transactions" value={number(m.sales.length)} icon={ReceiptText} change={m.trendSales} tone="green"/>
      <StatCard label="Units sold" value={number(m.units)} icon={ShoppingBag} change={m.trendUnits} tone="purple"/>
      <StatCard label="Low stock items" value={number(m.lowStock.length)} icon={TriangleAlert} tone="amber" note={<><span className="amber-text">Needs your attention</span>{ACCESS[actor.role].includes('inventory')&&<ArrowRight size={13}/>}</>} onClick={ACCESS[actor.role].includes('inventory')?()=>navigate('inventory',{lowOnly:true}):undefined}/>
    </div>
    <OperationalPriorities navigate={navigate}/>
    <div className="dashboard-middle">
      <section className="card revenue-card"><CardHeading title="Revenue overview" description="Your sales performance over time"><div className="segmented">{['Revenue','Comparison'].map(x=><button key={x} className={chartMode===x?'active':''} onClick={()=>setChartMode(x)}>{x}</button>)}</div></CardHeading>
        <div className="chart-summary"><strong>{money(m.revenue)}</strong><span className={`trend ${m.trendRevenue<0?'negative':''}`}><ArrowUpRight size={14}/>{Math.abs(m.trendRevenue).toFixed(1)}%</span><span className="muted">vs. previous {days} days</span></div>
        <div className="revenue-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={m.daily} margin={{left:-18,right:12,top:14,bottom:0}}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f74e9" stopOpacity={0.16}/><stop offset="95%" stopColor="#4f74e9" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9edf3"/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill:'#8a94a5',fontSize:11}} tickMargin={12} minTickGap={30}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8a94a5',fontSize:11}} tickFormatter={v=>v===0?'0':`${Math.round(v/1000)}k`} tickCount={5}/><Tooltip formatter={(v,name)=>[money(v),name==='revenue'?'Revenue':'Previous period']} contentStyle={{border:'1px solid #e7ebf0',borderRadius:10,fontSize:12,boxShadow:'0 6px 20px #172b4d12'}}/>{chartMode==='Comparison'&&<Area type="monotone" dataKey="previous" stroke="#b6c2d7" fill="none" strokeDasharray="4 4" strokeWidth={2}/>}<Area type="monotone" dataKey="revenue" stroke="#5275e9" fill="url(#revenueFill)" strokeWidth={2.5} activeDot={{r:5,strokeWidth:4,stroke:'#fff'}}/></AreaChart></ResponsiveContainer></div>
        <div className="chart-legend"><span><i style={{background:'#5275e9'}}/>Current period</span>{chartMode==='Comparison'&&<span><i style={{background:'#b6c2d7'}}/>Previous period</span>}<span className="chart-currency">All amounts in HKD</span></div>
      </section>
      <section className="card store-card"><CardHeading title="Store performance" description="Revenue contribution by store"><span className="subtle-icon"><Store size={17}/></span></CardHeading>
        <div className="store-bars">{m.performance.map((s,i)=><div className="store-row" key={s.id}><div className="store-row-top"><span><i style={{background:s.color}}/>{s.name}</span><strong>{money(s.revenue)}</strong></div><div className="bar-track"><div style={{width:`${m.revenue?s.revenue/m.revenue*100:0}%`,background:s.color}}/></div><div className="store-row-foot"><span>{s.transactions} transactions</span><span>{m.revenue?(s.revenue/m.revenue*100).toFixed(1):0}% of revenue</span></div></div>)}</div>
        {ACCESS[actor.role].includes('reports')&&<button className="card-bottom-link" onClick={()=>navigate('reports')}>View store report <ArrowRight size={15}/></button>}
      </section>
    </div>
    <div className="dashboard-bottom"><section className="card top-products"><CardHeading title="Top-selling products" description="The pieces your customers love most">{ACCESS[actor.role].includes('products')&&<button className="text-link" onClick={()=>navigate('products')}>View all products <ArrowUpRight size={14}/></button>}</CardHeading><div className="table-scroll"><table><thead><tr><th className="rank-col">#</th><th>Product</th><th>Units sold</th><th>Revenue</th><th>Availability</th></tr></thead><tbody>{m.topProducts.slice(0,4).map((p,i)=><tr key={p.id}><td className="rank-col">{String(i+1).padStart(2,'0')}</td><td><ProductIdentity product={p}/></td><td>{p.units}</td><td className="cell-strong">{money(p.revenue)}</td><td><Badge status={p.stock===0?'Out of stock':p.stock<30?'Low stock':'In stock'}/></td></tr>)}</tbody></table></div><div className="product-table-note"><span className="live-dot"/>Ranked by revenue in the selected period</div></section>
      <section className="card activity-card"><CardHeading title="Recent activity" description="The latest across your workspace"><span className="activity-live">Live</span></CardHeading><div className="activity-list">{activity.length?activity.map((a,i)=><div className="activity-item" key={a.id}><div className={`activity-icon ${a.type==='sale'?'green':a.type.includes('refund')?'amber':'blue'}`}>{a.type==='sale'?<ShoppingBag size={15}/>:a.type.includes('refund')?<RefreshCw size={15}/>:<Package size={15}/>}</div><div><strong>{a.label}</strong><p>{a.store?storeName(a.store):'Head office'}{a.total?` · ${money(a.total)}`:''}</p><small>{timeLabel(a.createdAt)}{a.actor?` · ${a.actor}`:''}</small></div><span className="activity-check"><Check size={13}/></span></div>):<Empty title="All caught up" description="New activity will appear here."/>}</div>
        {ACCESS[actor.role].includes('replenishment')&&<button className="pending-strip" onClick={()=>navigate('replenishment')}><span><span className="pending-icon"><Boxes size={16}/></span><span><strong>{pending} pending request{pending!==1?'s':''}</strong><small>Replenishment awaiting approval</small></span></span><ChevronRight size={16}/></button>}
      </section></div>
    <footer className="workspace-footer"><span>UKY Centralised Retail Management</span><span><span className="live-dot"/>All changes saved locally <span className="footer-separator">·</span> Prototype workspace</span></footer>
  </>;
}
