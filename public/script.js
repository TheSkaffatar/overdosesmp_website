const SERVER_IP="play.overdosesmp.online";
const LINKS={discord:"https://discord.gg/Wnt6RGzThf",vote:"",full:"https://github.com/TheSkaffatar/overdosesmp_website/releases/download/modpack-v1.0/OverdoseSMP-Modpack-26.2.FULL.-v1.0.0.mrpack",lite:"https://github.com/TheSkaffatar/overdosesmp_website/releases/download/modpack-v1.0/OverdoseSMP-Modpack-26.2.LITE.-v1.0.0.mrpack"};
const toast=document.getElementById("toast");let timer;
function showToast(msg){toast.textContent=msg;toast.classList.add("show");clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove("show"),1800)}
async function copyIP(){try{await navigator.clipboard.writeText(SERVER_IP);showToast("Server IP copied")}catch{showToast(SERVER_IP)}}
document.getElementById("copy-ip").addEventListener("click",copyIP);
document.querySelectorAll(".copy-inline").forEach(x=>x.addEventListener("click",copyIP));
const VOXY_FULL_URL="";
const fullDownload=document.getElementById("full-download");
const voxyCheckbox=document.getElementById("include-voxy");
if(fullDownload){fullDownload.href=LINKS.full;fullDownload.setAttribute("target","_blank");fullDownload.addEventListener("click",e=>{if(voxyCheckbox?.checked){e.preventDefault();if(VOXY_FULL_URL){window.open(VOXY_FULL_URL,"_blank","noopener")}else showToast("Full pack with Voxy data coming soon")}})}
document.querySelectorAll("[data-link]:not([data-link='full']):not([data-link='vote'])").forEach(a=>{const url=LINKS[a.dataset.link];if(url){a.href=url;if(a.dataset.link==="lite")a.setAttribute("target","_blank")}else a.addEventListener("click",e=>{e.preventDefault();showToast(a.dataset.link==="lite"?"Download coming soon":a.textContent.trim()+" link coming soon")})});
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");observer.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll(".reveal").forEach(x=>observer.observe(x));
// v9: voting modal
const voteModal=document.getElementById("vote-modal");
const voteTriggers=document.querySelectorAll('[data-link="vote"]');
let voteLastFocus=null;
function openVoteModal(e){if(e)e.preventDefault();if(!voteModal)return;voteLastFocus=document.activeElement;voteModal.classList.add("open");voteModal.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");voteModal.querySelector(".vote-close")?.focus()}
function closeVoteModal(){if(!voteModal)return;voteModal.classList.remove("open");voteModal.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");voteLastFocus?.focus()}
voteTriggers.forEach(a=>a.addEventListener("click",openVoteModal));
voteModal?.querySelectorAll("[data-close-vote]").forEach(x=>x.addEventListener("click",closeVoteModal));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&voteModal?.classList.contains("open"))closeVoteModal()});

// v13: website accounts + full player portal
const accountModal=document.getElementById("account-modal");
const accountTrigger=document.getElementById("account-trigger");
const authView=document.getElementById("auth-view");
const registerView=document.getElementById("register-view");
const loginForm=document.getElementById("login-form");
const registerForm=document.getElementById("register-form");
const profilePage=document.getElementById("profile-page");
const deleteModal=document.getElementById("delete-modal");
let currentAccount=null,accountLastFocus=null;
function setAccountView(view){authView.hidden=view!=="login";registerView.hidden=view!=="register"}
function formatDate(ms){if(!ms)return "—";return new Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"numeric"}).format(new Date(ms))}
function renderAccount(account){
  currentAccount=account||null;accountTrigger.textContent=account?.username||"Log In";
  if(!account)return;
  document.getElementById("profile-username").textContent=account.username;
  document.getElementById("profile-account-username").textContent=account.username;
  document.getElementById("profile-top-user").textContent=account.username;
  document.getElementById("profile-email").textContent=account.email;
  document.getElementById("profile-created").textContent=formatDate(account.createdAt);
  document.getElementById("delete-username-label").textContent=account.username;
  const mc=document.getElementById("minecraft-status"),sub=document.getElementById("profile-minecraft-sub"),linkTitle=document.getElementById("link-title"),linkDesc=document.getElementById("link-description"),linkBtn=document.getElementById("link-minecraft-button"),avatar=document.getElementById("mc-avatar");
  const linkForm=document.getElementById("minecraft-link-form"),codeInput=document.getElementById("minecraft-code");
  if(account.minecraft){mc.textContent="Linked ✓";sub.textContent=account.minecraft.username;linkTitle.textContent="Minecraft connected";linkDesc.textContent=`${account.minecraft.username} is linked to this account.`;linkBtn.textContent="Minecraft Linked";linkBtn.disabled=true;if(codeInput)codeInput.disabled=true;if(linkForm)linkForm.classList.add("linked");avatar.textContent=account.minecraft.username.slice(0,2).toUpperCase()}else{mc.textContent="Not linked";sub.textContent="Minecraft account not linked";linkTitle.textContent="Connect your player";linkDesc.innerHTML='Run <code>/verify</code> in-game, click the code to copy it, then paste it here. Codes expire after 10 minutes.';linkBtn.textContent="Link Minecraft Account";linkBtn.disabled=false;if(codeInput)codeInput.disabled=false;if(linkForm)linkForm.classList.remove("linked");avatar.textContent=account.username.slice(0,2).toUpperCase()}
}
function openAccount(){if(currentAccount){openProfile();return}accountLastFocus=document.activeElement;setAccountView("login");accountModal.classList.add("open");accountModal.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");setTimeout(()=>accountModal.querySelector("input")?.focus(),0)}
function closeAccount(){accountModal.classList.remove("open");accountModal.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");accountLastFocus?.focus()}
function openProfile(push=true){if(!currentAccount)return openAccount();closeAccount();renderAccount(currentAccount);profilePage.classList.add("open");profilePage.setAttribute("aria-hidden","false");document.body.classList.add("body-profile-open");profilePage.scrollTop=0;if(push&&location.pathname!=="/profile")history.pushState({profile:true},"","/profile")}
function closeProfile(push=true){profilePage.classList.remove("open");profilePage.setAttribute("aria-hidden","true");document.body.classList.remove("body-profile-open");if(push&&location.pathname==="/profile")history.pushState({},"","/")}
async function api(path,options={}){const r=await fetch(path,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});let data={};try{data=await r.json()}catch{}if(!r.ok)throw new Error(data.error||"Something went wrong.");return data}
async function refreshAccount(){try{const data=await api("/api/me",{method:"GET",headers:{}});renderAccount(data.authenticated?data.account:null);if(location.pathname==="/profile"){if(currentAccount)openProfile(false);else history.replaceState({},"","/")}}catch{renderAccount(null);if(location.pathname==="/profile")history.replaceState({},"","/")}}
accountTrigger?.addEventListener("click",openAccount);accountModal?.querySelectorAll("[data-close-account]").forEach(x=>x.addEventListener("click",closeAccount));
document.getElementById("show-register")?.addEventListener("click",()=>setAccountView("register"));document.getElementById("show-login")?.addEventListener("click",()=>setAccountView("login"));
loginForm?.addEventListener("submit",async e=>{e.preventDefault();const err=document.getElementById("login-error");err.textContent="";const btn=loginForm.querySelector("button[type=submit]");btn.disabled=true;try{const f=new FormData(loginForm);const data=await api("/api/login",{method:"POST",body:JSON.stringify({login:f.get("login"),password:f.get("password")})});renderAccount(data.account);loginForm.reset();closeAccount();openProfile();showToast("Logged in")}catch(x){err.textContent=x.message}finally{btn.disabled=false}});
registerForm?.addEventListener("submit",async e=>{e.preventDefault();const err=document.getElementById("register-error");err.textContent="";const f=new FormData(registerForm),password=String(f.get("password")||"");if(password!==String(f.get("confirm")||"")){err.textContent="Passwords do not match.";return}const btn=registerForm.querySelector("button[type=submit]");btn.disabled=true;try{const data=await api("/api/register",{method:"POST",body:JSON.stringify({username:f.get("username"),email:f.get("email"),password})});renderAccount(data.account);registerForm.reset();closeAccount();openProfile();showToast("Account created")}catch(x){err.textContent=x.message}finally{btn.disabled=false}});
async function doLogout(){try{await api("/api/logout",{method:"POST",body:"{}"})}finally{renderAccount(null);closeProfile();showToast("Logged out")}}
document.getElementById("logout-button")?.addEventListener("click",doLogout);
document.getElementById("profile-back")?.addEventListener("click",()=>closeProfile());document.getElementById("profile-home")?.addEventListener("click",()=>closeProfile());
window.addEventListener("popstate",()=>{if(location.pathname==="/profile"&&currentAccount)openProfile(false);else closeProfile(false)});


document.getElementById("minecraft-link-form")?.addEventListener("submit",async e=>{e.preventDefault();if(currentAccount?.minecraft)return;const form=e.currentTarget,err=document.getElementById("minecraft-link-error"),btn=form.querySelector("button[type=submit]"),f=new FormData(form);err.textContent="";btn.disabled=true;try{await api("/api/minecraft/link",{method:"POST",body:JSON.stringify({code:f.get("code")})});form.reset();await refreshAccount();showToast("Minecraft account linked")}catch(x){err.textContent=x.message;btn.disabled=false}});
document.getElementById("username-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,err=document.getElementById("username-error");err.textContent="";const btn=form.querySelector("button");btn.disabled=true;try{const f=new FormData(form);await api("/api/account/username",{method:"POST",body:JSON.stringify({username:f.get("username"),password:f.get("password")})});await refreshAccount();form.reset();showToast("Username changed")}catch(x){err.textContent=x.message}finally{btn.disabled=false}});
document.getElementById("password-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,err=document.getElementById("password-error"),f=new FormData(form),next=String(f.get("newPassword")||"");err.textContent="";if(next!==String(f.get("confirmPassword")||"")){err.textContent="Passwords do not match.";return}const btn=form.querySelector("button");btn.disabled=true;try{await api("/api/account/password",{method:"POST",body:JSON.stringify({currentPassword:f.get("currentPassword"),newPassword:next})});form.reset();showToast("Password changed")}catch(x){err.textContent=x.message}finally{btn.disabled=false}});
function openDelete(){deleteModal.classList.add("open");deleteModal.setAttribute("aria-hidden","false");document.getElementById("delete-error").textContent=""}
function closeDelete(){deleteModal.classList.remove("open");deleteModal.setAttribute("aria-hidden","true");document.getElementById("delete-form")?.reset()}
document.getElementById("open-delete")?.addEventListener("click",openDelete);deleteModal?.querySelectorAll("[data-close-delete]").forEach(x=>x.addEventListener("click",closeDelete));
document.getElementById("delete-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,err=document.getElementById("delete-error"),btn=form.querySelector("button[type=submit]"),f=new FormData(form);err.textContent="";btn.disabled=true;try{await api("/api/account/delete",{method:"POST",body:JSON.stringify({password:f.get("password"),confirmation:f.get("confirmation")})});closeDelete();renderAccount(null);closeProfile();showToast("Account deleted")}catch(x){err.textContent=x.message}finally{btn.disabled=false}});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(deleteModal?.classList.contains("open"))closeDelete();else if(accountModal?.classList.contains("open"))closeAccount()});
refreshAccount();
