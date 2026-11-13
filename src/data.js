export const TODAY = '2026-11-13';
export const STORES = [
  { id: 'central', name: 'Central', address: 'Queen’s Road Central', color: '#4d6deb' },
  { id: 'mongkok', name: 'Mong Kok', address: 'Langham Place', color: '#28a693' },
  { id: 'causeway', name: 'Causeway Bay', address: 'Times Square', color: '#9a7bda' },
  { id: 'tst', name: 'Tsim Sha Tsui', address: 'Harbour City', color: '#e6a84b' },
];
export const LOCATIONS = [...STORES, { id: 'warehouse', name: 'Main warehouse', address: 'Kwai Chung', color: '#7c8ca3' }];
export const ROLES = ['System Administrator', 'Head Office Manager', 'Store Manager', 'Sales Staff', 'Warehouse Staff'];
export const ACCESS = {
  'System Administrator': ['dashboard','products','pos','sales','inventory','replenishment','refunds','reports','users','settings'],
  'Head Office Manager': ['dashboard','products','pos','sales','inventory','replenishment','refunds','reports'],
  'Store Manager': ['dashboard','pos','sales','inventory','replenishment','refunds','reports'],
  'Sales Staff': ['dashboard','pos','sales','refunds'],
  'Warehouse Staff': ['dashboard','inventory','replenishment'],
};
export const isOffice = role => ['System Administrator','Head Office Manager'].includes(role);
export const storeName = id => LOCATIONS.find(s => s.id === id)?.name || id;
export function initialState() {
  const products = [
    { id:'p1', code:'UKY-TS-001', name:'Essential Cotton Tee', category:'T-shirts', price:189, cost:65, color:'Cloud white', size:'M', active:true, image:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100&h=110&fit=crop', tint:'#edece7' },
    { id:'p2', code:'UKY-JN-002', name:'Classic Straight Jeans', category:'Denim', price:459, cost:165, color:'Indigo', size:'32', active:true, image:'https://images.unsplash.com/photo-1542272604-787c3835535d?w=100&h=110&fit=crop', tint:'#e7edf5' },
    { id:'p3', code:'UKY-HD-003', name:'Everyday Zip Hoodie', category:'Sweatshirts', price:389, cost:140, color:'Stone grey', size:'L', active:true, image:'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=100&h=110&fit=crop', tint:'#e8e8e8' },
    { id:'p4', code:'UKY-SH-004', name:'Relaxed Linen Shirt', category:'Shirts', price:329, cost:115, color:'Sand', size:'M', active:true, image:'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=100&h=110&fit=crop', tint:'#f4eee5' },
    { id:'p5', code:'UKY-PT-005', name:'Everyday Chino Pants', category:'Trousers', price:359, cost:125, color:'Olive', size:'32', active:true, image:'', tint:'#e5e9e0' },
    { id:'p6', code:'UKY-TS-006', name:'Oversized Pocket Tee', category:'T-shirts', price:219, cost:75, color:'Midnight navy', size:'L', active:true, image:'', tint:'#dce4ef' },
    { id:'p7', code:'UKY-JK-007', name:'Lightweight Coach Jacket', category:'Outerwear', price:599, cost:220, color:'Black', size:'M', active:true, image:'', tint:'#e7e8ea' },
    { id:'p8', code:'UKY-SW-008', name:'Textured Knit Sweater', category:'Knitwear', price:429, cost:155, color:'Oatmeal', size:'M', active:true, image:'', tint:'#f0e9df' },
  ];
  const inventory = LOCATIONS.flatMap((s,si) => products.map((p,pi) => ({ location:s.id, productId:p.id, quantity:si===4 ? 110+pi*17 : ((pi*13+si*19+9)%65)+3, minimum:si===4?50:15 })));
  inventory.find(i=>i.location==='warehouse'&&i.productId==='p3').quantity-=25;
  const sales = [];
  for(let d=0;d<30;d++) {
    const date = new Date('2026-11-13T12:00:00+08:00'); date.setDate(date.getDate()-d);
    for(let j=0;j<(d<7 ? 31+(d*7)%15 : 22+(d*3)%12);j++) {
      const items = [0,1,...(j%3===0?[2]:[])].map((_,k) => { const p=products[(j+k*3+d)%products.length]; return { productId:p.id, name:p.name, code:p.code, price:p.price, cost:p.cost, quantity:k===0?(j%3)+1:1 }; });
      const time=new Date(date);time.setHours(2+j%12, j*7%60,0,0);
      sales.push({id:`UKY-${date.toISOString().slice(0,10).replaceAll('-','')}-${String(sales.length+1).padStart(4,'0')}`,store:STORES[(j+d)%4].id,items,total:items.reduce((s,i)=>s+i.price*i.quantity,0),payment:['Card','Cash','Octopus'][j%3],createdAt:time.toISOString(),staff:['Alex Chan','Jamie Wong','Chris Lee'][j%3]});
    }
  }
  return { version:1, products, inventory, sales, requests:[
    {id:'REP-1001',store:'central',productId:'p1',quantity:30,status:'Pending',createdAt:'2026-11-13T03:30:00.000Z',note:'Weekend stock top-up'},
    {id:'REP-1002',store:'mongkok',productId:'p2',quantity:20,status:'Approved',createdAt:'2026-11-12T06:15:00.000Z',note:'Fast-moving denim'},
    {id:'REP-1003',store:'causeway',productId:'p3',quantity:25,status:'Dispatched',createdAt:'2026-11-12T02:00:00.000Z',note:'Seasonal replenishment'},
  ], refunds:[], movements:[{id:'MOV-1001',location:'warehouse',productId:'p3',quantity:-25,type:'Replenishment dispatch',reference:'REP-1003',createdAt:'2026-11-12T08:00:00.000Z'}],
  users:[{id:'u1',name:'Alex Chan',email:'alex.chan@uky.com.hk',role:'System Administrator',store:'central',active:true},{id:'u2',name:'Jamie Wong',email:'jamie.wong@uky.com.hk',role:'Store Manager',store:'mongkok',active:true},{id:'u3',name:'Chris Lee',email:'chris.lee@uky.com.hk',role:'Sales Staff',store:'central',active:true},{id:'u4',name:'Sam Lam',email:'sam.lam@uky.com.hk',role:'Warehouse Staff',store:'warehouse',active:true}],
  settings:{businessName:'Uni Kwong Yuen',currency:'HKD',receiptNote:'Thank you for shopping with UKY.',lowStockAlerts:true},activity:[] };
}
