// Shared AJAX helper for the PHP session / MariaDB backend.
window.CampusEco = {
 csrf: null, user: null,
 async request(path, options={}) {
  const config={credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}};
  if(config.method && config.method.toUpperCase()!=='GET' && this.csrf) config.headers['X-CSRF-Token']=this.csrf;
  const response=await fetch(path,config);
  let result;try{result=await response.json();}catch{throw Error('Server returned an invalid response');}
  if(!response.ok) throw Error(result.error||'Request failed');
  return result;
 },
 async session(role){
  const result=await this.request('api/auth.php?action=me');
  this.user=result.user;this.csrf=result.csrf;
  if(!result.user || (role && result.user.role!==role)) { location.replace('login.html'); throw Error('Login required'); }
  return result.user;
 },
 async post(path,body){return this.request(path,{method:'POST',body:JSON.stringify(body)});},
 message(id,txt,error=false){const el=document.getElementById(id);if(el){el.textContent=txt;el.className=error?'alert error':'alert success';}},
 async logout(){try{await this.post('api/auth.php?action=logout',{});}finally{location.href='login.html';}}
};
