import React, {createContext, useContext, useRef, useState, useMemo} from 'react';
import {initialState} from './data';
import {applyAction} from './domain';
import {locationScope, validDemoActor, workspaceState, refundLookup} from './permissions';
const Context=createContext(null);
export function Provider({children}) {
  const [state,setState]=useState(()=>{try{const s=JSON.parse(localStorage.getItem('uky-workspace-v1'));return s?.version===1?s:initialState();}catch{return initialState();}});
  const stateRef=useRef(state);stateRef.current=state;
  const [actor,setActorState]=useState(()=>{try{const saved=JSON.parse(sessionStorage.getItem('uky-session'));return validDemoActor(saved)?saved:{id:'u1',name:'Alex Chan',role:'System Administrator',store:'central'};}catch{return {id:'u1',name:'Alex Chan',role:'System Administrator',store:'central'};}});
  const actorRef=useRef(actor);actorRef.current=actor;
  const [scope,setScope]=useState('all');
  const [toast,setToast]=useState(null);
  const toastTimer=useRef();
  const notify=(message,type='success')=>{clearTimeout(toastTimer.current);setToast({message,type});toastTimer.current=setTimeout(()=>setToast(null),5500);};
  const act=(type,payload)=>{try{if(actorRef.current!==actor)throw new Error('Your workspace changed. Open this action again in your current role.');const out=applyAction(stateRef.current,actor,type,payload);localStorage.setItem('uky-workspace-v1',JSON.stringify(out.state));stateRef.current=out.state;setState(out.state);return out.result;}catch(e){notify(e.message,'error');throw e;}};
  const switchActor=user=>{if(!validDemoActor(user)){notify('Choose a valid role and assigned location.','error');return;}actorRef.current=user;sessionStorage.setItem('uky-session',JSON.stringify(user));setActorState(user);setScope('all');notify(`Workspace switched to ${user.role}.`);};
  const scopedState=useMemo(()=>workspaceState(state,actor),[state,actor]);
  const lookupRefunds=options=>refundLookup(stateRef.current,actorRef.current,options);
  const demoUsers=state.users.filter(u=>u.active).map(({id,name,role,store})=>({id,name,role,store}));
  return <Context.Provider value={{state:scopedState,actor,scope:locationScope(actor,scope),setScope,act,notify,toast,setToast,switchActor,demoUsers,lookupRefunds}}>{children}</Context.Provider>;
}
export const useApp=()=>useContext(Context);
export function downloadCSV(filename,rows) {
  if(!rows.length)return;
  const safe=v=>{let str=String(v??'');if(/^[=+@-]/.test(str))str="'"+str;return '"'+str.replaceAll('"','""')+'"';};
  const content=[Object.keys(rows[0]),...rows.map(Object.values)].map(r=>r.map(safe).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=filename+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
