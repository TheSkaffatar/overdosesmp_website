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

// v12: website accounts
const accountModal=document.getElementById("account-modal");
const accountTrigger=document.getElementById("account-trigger");
const authView=document.getElementById("auth-view");
const registerView=document.getElementById("register-view");
const profileView=document.getElementById("profile-view");
const loginForm=document.getElementById("login-form");
const registerForm=document.getElementById("register-form");
let currentAccount=null,accountLastFocus=null;
function setAccountView(view){authView.hidden=view!=="login";registerView.hidden=view!=="register";profileView.hidden=view!=="profile"}
function renderAccount(account){currentAccount=account||null;accountTrigger.textContent=account?.username||"Log In";if(account){document.getElementById("profile-username").textContent=account.username;document.getElementById("profile-email").textContent=account.email;const mc=document.getElementById("minecraft-status");mc.textContent=account.minecraft?account.minecraft.username:"Not linked"}}
function openAccount(){accountLastFocus=document.activeElement;setAccountView(currentAccount?"profile":"login");accountModal.classList.add("open");accountModal.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");setTimeout(()=>accountModal.querySelector(currentAccount?"#logout-button":"input")?.focus(),0)}
function closeAccount(){accountModal.classList.remove("open");accountModal.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");accountLastFocus?.focus()}
async function api(path,options={}){const r=await fetch(path,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});let data={};try{data=await r.json()}catch{}if(!r.ok)throw new Error(data.error||"Something went wrong.");return data}
async function refreshAccount(){try{const data=await api("/api/me",{method:"GET",headers:{}});renderAccount(data.authenticated?data.account:null)}catch{renderAccount(null)}}
accountTrigger?.addEventListener("click",openAccount);accountModal?.querySelectorAll("[data-close-account]").forEach(x=>x.addEventListener("click",closeAccount));
document.getElementById("show-register")?.addEventListener("click",()=>setAccountView("register"));document.getElementById("show-login")?.addEventListener("click",()=>setAccountView("login"));
loginForm?.addEventListener("submit",async e=>{e.preventDefault();const err=document.getElementById("login-error");err.textContent="";const btn=loginForm.querySelector("button[type=submit]");btn.disabled=true;try{const f=new FormData(loginForm);const data=await api("/api/login",{method:"POST",body:JSON.stringify({login:f.get("login"),password:f.get("password")})});renderAccount(data.account);loginForm.reset();setAccountView("profile");showToast("Logged in")}catch(x){err.textContent=x.message}finally{btn.disabled=false}});
registerForm?.addEventListener("submit",async e=>{e.preventDefault();const err=document.getElementById("register-error");err.textContent="";const f=new FormData(registerForm),password=String(f.get("password")||"");if(password!==String(f.get("confirm")||"")){err.textContent="Passwords do not match.";return}const btn=registerForm.querySelector("button[type=submit]");btn.disabled=true;try{const data=await api("/api/register",{method:"POST",body:JSON.stringify({username:f.get("username"),email:f.get("email"),password})});renderAccount(data.account);registerForm.reset();setAccountView("profile");showToast("Account created")}catch(x){err.textContent=x.message}finally{btn.disabled=false}});
document.getElementById("logout-button")?.addEventListener("click",async()=>{try{await api("/api/logout",{method:"POST",body:"{}"})}finally{renderAccount(null);setAccountView("login");showToast("Logged out")}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&accountModal?.classList.contains("open"))closeAccount()});
refreshAccount();
