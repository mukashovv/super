"use strict";
const Finance = (() => {
  const config = window.SUPER_TABLE_CONFIG;
  const localKey = "super-table.preview.v1";
  let client, account, local;
  const pad = n => String(n).padStart(2, "0");
  function monthKey(date = new Date()) { return date.getFullYear() + "-" + pad(date.getMonth() + 1); }
  function dateKey(date = new Date()) { return monthKey(date) + "-" + pad(date.getDate()); }
  function dateOf(key) { const [y,m] = key.split("-").map(Number); return new Date(y,m-1,1,12); }
  function nextMonth(key, offset) { const d=dateOf(key); d.setMonth(d.getMonth()+offset); return monthKey(d); }
  function emptyMonth(goals) {
    return { entries: [], goals: goals || [{name:"Подушка", rate:20}] };
  }
  function totals(data) {
    const sums = {income:0,expense:0,net:0};
    for (const entry of data.entries) { sums.income += entry.income; sums.expense += entry.expense; }
    sums.net = sums.income - sums.expense;
    return sums;
  }
  function allocated(net,rate) { return Math.round(net * rate / 100); }
  function balance(debt) {
    return debt.principal + debt.interest - debt.payments.reduce((sum,p) => sum + (p.done ? p.amount : 0),0);
  }
  function readLocal() { const raw=localStorage.getItem(localKey); return raw ? JSON.parse(raw) : null; }
  function startLocal() {
    local = true; account = null;
    let book = readLocal();
    if (!book) {
      book = {paid:false,trial:monthKey(),months:{},debts:{}};
      book.months[book.trial]={rev:1,data:emptyMonth()};
      localStorage.setItem(localKey,JSON.stringify(book));
    }
    return book;
  }
  const configured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
  async function connect() {
    if (!client) {
      const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm");
      client=createClient(config.supabaseUrl, config.supabasePublishableKey, {auth:{storageKey:"super-table.auth.v1"}});
    }
    return client;
  }
  async function rpc(name, params) {
    const {data,error}=await client.rpc(name,params);
    if(error) throw new Error(error.message);
    return data;
  }
  async function load() { return local ? readLocal() : rpc("st_book",{p_month:monthKey()}); }
  async function openSession() {
    await connect();
    const {data,error}=await client.auth.getSession();
    if(error) throw error;
    account=data.session?.user || null;
    local=false;
    return account;
  }
  function observeSession(fn) { client.auth.onAuthStateChange((event,session)=>{
    const changed = account?.id !== session?.user?.id;
    account=session?.user || null;
    if(changed && !local) setTimeout(()=>fn(account),0);
  }); }
  async function authenticate(mode,email,password) {
    await connect();
    const result=mode==="login" ? await client.auth.signInWithPassword({email,password}) :
      await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
    if(result.error) throw result.error;
    account=result.data.session?.user || null; local=false;
    return Boolean(account);
  }
  async function leave() {
    if (!local && client) { const {error}=await client.auth.signOut({scope:"local"}); if(error) throw error; }
    local=false; account=null;
  }
  async function save(kind,key,rev,data) {
    if(!local) return rpc("st_save",{p_kind:kind,p_key:key,p_revision:rev,p_data:data});
    const write = () => {
      const b=readLocal();
      if(kind==="months" && !b.paid && key!==b.trial) throw new Error("MONTH_LIMIT");
      if((b[kind][key]?.rev || 0)!==rev) throw new Error("STALE_VERSION");
      const record={rev:rev+1,data};
      b[kind][key]=record;
      localStorage.setItem(localKey,JSON.stringify(b));
      return record;
    };
    return navigator.locks ? navigator.locks.request(localKey,write) : write();
  }
  async function members(offset){return rpc("st_members",{p_offset:offset});}
  async function grantMember(member,years){return rpc("st_grant_member",{p_member:member,p_years:years});}
  return {configured, members, grantMember, startLocal, load, openSession, observeSession, authenticate, leave, save,
    monthKey,dateKey,dateOf,nextMonth,emptyMonth,totals,allocated,balance,
    get local(){return local;},get email(){return account?.email || "";}};
})();
