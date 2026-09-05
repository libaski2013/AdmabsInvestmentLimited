const BASE=import.meta.env.VITE_API_URL||'https://admabsinvestmentlimited-production.up.railway.app/api';
let token=localStorage.getItem('admabs_mobile_token');
export const setToken=value=>{token=value;if(value)localStorage.setItem('admabs_mobile_token',value);else localStorage.removeItem('admabs_mobile_token')};
async function call(path,{method='GET',body}={}){const r=await fetch(`${BASE}${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok){let message=`Request failed (${r.status})`;try{message=(await r.json()).error||message}catch{}throw new Error(message)}return r.status===204?null:r.json()}
const query=(path,p={})=>call(`${path}?${new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([,v])=>v!==''&&v!=null)))}`);
export const api={
 login:(username,password)=>call('/auth/login',{method:'POST',body:{username,password}}),me:()=>call('/auth/me'),logout:()=>call('/auth/logout',{method:'POST'}),heartbeat:()=>call('/sessions/heartbeat',{method:'POST'}),
 dashboard:()=>call('/dashboard'),products:p=>query('/products',p),scanProduct:c=>call(`/products/scan/${encodeURIComponent(c)}`),receiveStock:(id,body)=>call(`/products/${id}/stock`,{method:'POST',body}),createProduct:body=>call('/products',{method:'POST',body}),
 createSale:body=>call('/sales',{method:'POST',body}),customers:()=>call('/customers'),createCustomer:body=>call('/customers',{method:'POST',body}),expenses:()=>call('/expenses'),createExpense:body=>call('/expenses',{method:'POST',body}),
 fuel:()=>call('/fuel/overview'),openFuel:body=>call('/fuel/shifts/open',{method:'POST',body}),closeFuel:(id,body)=>call(`/fuel/shifts/${id}/close`,{method:'PATCH',body}),
 workShifts:()=>call('/work-shifts'),startWork:body=>call('/work-shifts/start',{method:'POST',body}),closeWork:(id,body)=>call(`/work-shifts/${id}/close`,{method:'PATCH',body}),
 reports:p=>query('/analytics/financial',p),approvals:()=>call('/approvals'),updateApproval:(id,body)=>call(`/approvals/${id}`,{method:'PATCH',body}),
 activeSessions:()=>call('/attendance/active'),attendanceHistory:()=>call('/attendance/history?days=7'),shiftSchedules:()=>call('/shift-schedules'),outlets:()=>call('/outlets'),
};
