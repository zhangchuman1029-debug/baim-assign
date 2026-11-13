import {ACCESS, ROLES, STORES, isOffice} from './data.js';

export const canAccess = (actor, page) => ACCESS[actor?.role]?.includes(page) || false;
export const homePage = actor => actor.role === 'Sales Staff' ? 'pos' : 'dashboard';
export const resolvePage = (actor, page) => canAccess(actor, page) ? page : homePage(actor);
export const locationScope = (actor, selected = 'all') => isOffice(actor.role)
  ? (selected === 'all' || STORES.some(s => s.id === selected) ? selected : 'all')
  : actor.role === 'Warehouse Staff' ? 'warehouse' : actor.store;
export const ownsStore = (actor, store) => isOffice(actor.role) || actor.store === store;

export function canAction(actor, action, settings = {}) {
  const office = isOffice(actor.role), manager = actor.role === 'Store Manager';
  const rules = {
    sale: canAccess(actor, 'pos'), product: canAccess(actor, 'products') && office,
    request: canAccess(actor, 'replenishment') && (office || manager),
    approveReplenishment: office, dispatch: office || actor.role === 'Warehouse Staff',
    receive: office || manager, cancelRequest: office || manager,
    refund: canAccess(actor, 'refunds'),
    refundStatus: canAccess(actor, 'refunds') && (office || (manager && settings.managerRefundApproval !== false)),
    adjustStock: canAccess(actor, 'inventory') && (office || manager || actor.role === 'Warehouse Staff'),
    user: actor.role === 'System Administrator', settings: actor.role === 'System Administrator',
    configureRoles: actor.role === 'System Administrator',
  };
  return rules[action] === true;
}

export const warehouseStatuses = ['Approved', 'Processing', 'Dispatched', 'Received'];
export function visibleRequest(actor, request) {
  return canAccess(actor, 'replenishment') && (actor.role === 'Warehouse Staff'
    ? warehouseStatuses.includes(request.status) : ownsStore(actor, request.store));
}
export function requestTransitions(actor, request) {
  if (!visibleRequest(actor, request)) return [];
  const next = {Pending: ['Approved', 'Rejected', 'Cancelled'], Approved: ['Processing', 'Cancelled'], Processing: ['Dispatched', 'Cancelled'], Dispatched: ['Received']};
  const actions = {Approved: 'approveReplenishment', Rejected: 'approveReplenishment', Processing: 'dispatch', Dispatched: 'dispatch', Received: 'receive', Cancelled: 'cancelRequest'};
  return (next[request.status] || []).filter(status => canAction(actor, actions[status]));
}

export function validDemoActor(actor) {
  return !!actor?.name?.trim() && ROLES.includes(actor.role) &&
    (actor.role === 'Warehouse Staff' ? actor.store === 'warehouse' : STORES.some(s => s.id === actor.store));
}

// All writes use the complete persisted state. Components receive only this role's records.
export function workspaceState(state, actor) {
  const office = isOffice(actor.role), warehouse = actor.role === 'Warehouse Staff';
  const local = location => office || location === (warehouse ? 'warehouse' : actor.store);
  return {
    ...state,
    users: canAccess(actor, 'users') ? state.users : [],
    sales: canAccess(actor, 'sales') ? state.sales.filter(s => local(s.store)).map(s => ({...s,
      refundedTotal: state.refunds.filter(r => r.saleId === s.id && r.status === 'Approved').reduce((n, r) => n + r.total, 0),
    })) : [],
    inventory: state.inventory.filter(i => local(i.location)),
    movements: canAccess(actor, 'inventory') ? state.movements.filter(m => local(m.location)) : [],
    requests: state.requests.filter(r => visibleRequest(actor, r)),
    refunds: canAccess(actor, 'refunds') ? state.refunds.filter(r => local(r.returnStore)).map(r => ({...r,
      originalPayment: state.sales.find(s => s.id === r.saleId)?.payment,
    })) : [],
    activity: state.activity.filter(a => office || (warehouse
      ? a.type === 'adjustStock' && a.store === 'warehouse' || a.type === 'requestStatus' && state.requests.some(r => r.id === a.reference && visibleRequest(actor, r))
      : a.store === actor.store && !['user', 'product', 'settings'].includes(a.type))),
  };
}

// Cross-store receipts are an explicit refund lookup, never part of local sales history.
export function refundLookup(state, actor, {query = '', id} = {}) {
  if (!canAction(actor, 'refund')) throw new Error('Your role does not have permission to look up refunds.');
  const term = query.trim().toLowerCase();
  return state.sales.filter(s => id ? s.id === id : `${s.id} ${STORES.find(x => x.id === s.store)?.name} ${s.items.map(i => i.name).join(' ')}`.toLowerCase().includes(term))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, id ? 1 : 6)
    .map(s => ({id: s.id, store: s.store, total: s.total, payment: s.payment, createdAt: s.createdAt,
      items: s.items.map(i => ({productId: i.productId, name: i.name, code: i.code, price: i.price, quantity: i.quantity,
        refundableQuantity: i.quantity - state.refunds.filter(r => r.saleId === s.id && r.status !== 'Rejected')
          .reduce((n, r) => n + r.items.filter(x => x.productId === i.productId).reduce((sum, x) => sum + x.quantity, 0), 0),
      })),
    }));
}
