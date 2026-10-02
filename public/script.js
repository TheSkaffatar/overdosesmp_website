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
  document.getElementById("profile-account-username").textContent=account.username;
  document.getElementById("profile-top-user").textContent=account.username;
  document.getElementById("profile-email").textContent=account.email;
  document.getElementById("profile-created").textContent=formatDate(account.createdAt);
  document.getElementById("delete-username-label").textContent=account.username;
  const mc=document.getElementById("minecraft-status"),sub=document.getElementById("profile-minecraft-sub"),linkTitle=document.getElementById("link-title"),linkDesc=document.getElementById("link-description"),linkBtn=document.getElementById("link-minecraft-button"),avatar=document.getElementById("mc-avatar"),avatarFallback=document.getElementById("mc-avatar-fallback"),avatarImage=document.getElementById("mc-avatar-image"),mcName=document.getElementById("profile-minecraft-name"),presence=document.getElementById("presence-dot"),presenceLabel=document.getElementById("presence-label");
  const linkForm=document.getElementById("minecraft-link-form"),codeInput=document.getElementById("minecraft-code");
  if(account.minecraft){
    mc.textContent="Linked ✓";sub.textContent="Minecraft account connected";mcName.textContent=account.minecraft.username;linkTitle.textContent="Minecraft connected";linkDesc.textContent=`${account.minecraft.username} is linked to this account.`;linkBtn.textContent="Minecraft Linked";linkBtn.disabled=true;if(codeInput)codeInput.disabled=true;if(linkForm)linkForm.classList.add("linked");
    if(avatarFallback){avatarFallback.textContent=account.minecraft.username.slice(0,2).toUpperCase();avatarFallback.hidden=true}
    if(avatarImage){const uuid=String(account.minecraft.minecraft_uuid||account.minecraft.uuid||"").replace(/-/g,"");if(uuid){avatarImage.src=`https://mc-heads.net/avatar/${encodeURIComponent(uuid)}/96`;avatarImage.hidden=false;avatarImage.onload=()=>{avatarImage.hidden=false;if(avatarFallback)avatarFallback.hidden=true};avatarImage.onerror=()=>{avatarImage.hidden=true;if(avatarFallback)avatarFallback.hidden=false}}else{avatarImage.hidden=true;if(avatarFallback)avatarFallback.hidden=false}}
    presence?.classList.remove("online","offline");presence?.classList.add("unknown");if(presenceLabel)presenceLabel.textContent="Status sync pending";
  }else{
    mc.textContent="Not linked";sub.textContent="Link your Minecraft account to unlock your player profile.";mcName.textContent="Not linked";linkTitle.textContent="Connect your player";linkDesc.innerHTML='Run <code>/verify</code> in-game, click the code to copy it, then paste it here. Codes expire after 5 minutes.';linkBtn.textContent="Link Minecraft Account";linkBtn.disabled=false;if(codeInput)codeInput.disabled=false;if(linkForm)linkForm.classList.remove("linked");if(avatarFallback){avatarFallback.textContent=account.username.slice(0,2).toUpperCase();avatarFallback.hidden=false}if(avatarImage)avatarImage.hidden=true;if(presenceLabel)presenceLabel.textContent="Status unavailable";
  }
}
function openAccount(){if(currentAccount){openProfile();return}accountLastFocus=document.activeElement;setAccountView("login");accountModal.classList.add("open");accountModal.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");setTimeout(()=>accountModal.querySelector("input")?.focus(),0)}
function closeAccount(){accountModal.classList.remove("open");accountModal.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");accountLastFocus?.focus()}
let statsPollTimer=null;
function formatInteger(v){return Number(v).toLocaleString()}
function formatPlaytime(ticks){const seconds=Math.floor(Number(ticks||0)/20),days=Math.floor(seconds/86400),hours=Math.floor((seconds%86400)/3600),minutes=Math.floor((seconds%3600)/60);if(days)return `${days}d ${hours}h`;if(hours)return `${hours}h ${minutes}m`;return `${minutes}m`}
function formatDistance(cm){const km=Number(cm||0)/100000;if(km>=100)return `${Math.round(km).toLocaleString()} km`;if(km>=1)return `${km.toFixed(1)} km`;return `${Math.round(Number(cm||0)/100)} m`}
function formatRelativeTime(ms){if(!ms)return "—";const d=Math.max(0,Date.now()-Number(ms)),m=Math.floor(d/60000);if(m<1)return "just now";if(m<60)return `${m}m ago`;const h=Math.floor(m/60);if(h<24)return `${h}h ago`;const days=Math.floor(h/24);return `${days}d ago`}
function renderMinecraftStats(data){const stats=data?.stats,mcName=document.getElementById("profile-minecraft-name"),presence=document.getElementById("presence-dot"),presenceLabel=document.getElementById("presence-label");if(!stats){["stat-kills","stat-deaths","stat-playtime","stat-distance","stat-blocks","stat-monsters","stat-champions"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent="—"});return}const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};set("stat-kills",formatInteger(stats.kills));set("stat-deaths",formatInteger(stats.deaths));set("stat-playtime",formatPlaytime(stats.playtimeTicks));set("stat-distance",formatDistance(stats.distanceCm));set("stat-blocks",formatInteger(stats.blocksMined));set("stat-monsters",formatInteger(stats.monstersKilled));set("stat-champions",formatInteger(stats.championKills));presence?.classList.remove("unknown","online","offline");presence?.classList.add(stats.online?"online":"offline");if(presenceLabel)presenceLabel.textContent=stats.online?"Online":"Offline";const first=document.getElementById("first-joined"),last=document.getElementById("last-seen");if(first)first.textContent=`First joined ${stats.firstJoined?formatDate(stats.firstJoined):"—"}`;if(last)last.textContent=stats.online?"Online now":`Last seen ${formatRelativeTime(stats.lastSeen)}`;if(mcName){mcName.classList.toggle("hostile-name",Boolean(stats.hostile)&&!Number(stats.bounty));mcName.classList.toggle("bounty-name",Number(stats.bounty)>0);mcName.title=Number(stats.bounty)>0?`Active bounty: ${Number(stats.bounty).toLocaleString()}`:stats.hostile?"Hostile":""}}
async function refreshMinecraftStats(){if(!currentAccount?.minecraft)return;try{renderMinecraftStats(await api("/api/minecraft/stats",{method:"GET",headers:{}}))}catch{}}
function startStatsPolling(){stopStatsPolling();refreshMinecraftStats();statsPollTimer=setInterval(refreshMinecraftStats,5000)}
function stopStatsPolling(){if(statsPollTimer){clearInterval(statsPollTimer);statsPollTimer=null}}
function openProfile(push=true){if(!currentAccount)return openAccount();closeAccount();renderAccount(currentAccount);profilePage.classList.add("open");profilePage.setAttribute("aria-hidden","false");document.body.classList.add("body-profile-open");profilePage.scrollTop=0;startStatsPolling();if(push&&location.pathname!=="/profile")history.pushState({profile:true},"","/profile")}
function closeProfile(push=true){stopStatsPolling();profilePage.classList.remove("open");profilePage.setAttribute("aria-hidden","true");document.body.classList.remove("body-profile-open");if(push&&location.pathname==="/profile")history.pushState({},"","/")}
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

// v16.5: mobile navigation
const mobileMenuToggle=document.getElementById("mobile-menu-toggle");
const mobileMenu=document.getElementById("mobile-menu");
const mobileAccountTrigger=document.getElementById("mobile-account-trigger");
const mobileVoteTrigger=document.querySelector("[data-mobile-vote]");
function setMobileMenu(open){if(!mobileMenu||!mobileMenuToggle)return;mobileMenu.classList.toggle("open",open);mobileMenuToggle.classList.toggle("open",open);mobileMenuToggle.setAttribute("aria-expanded",String(open));mobileMenuToggle.setAttribute("aria-label",open?"Close navigation":"Open navigation");mobileMenu.setAttribute("aria-hidden",String(!open))}
mobileMenuToggle?.addEventListener("click",e=>{e.stopPropagation();setMobileMenu(!mobileMenu.classList.contains("open"))});
mobileMenu?.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener("click",()=>setMobileMenu(false)));
mobileVoteTrigger?.addEventListener("click",e=>{setMobileMenu(false);openVoteModal(e)});
mobileAccountTrigger?.addEventListener("click",()=>{setMobileMenu(false);openAccount()});
document.addEventListener("click",e=>{if(mobileMenu?.classList.contains("open")&&!mobileMenu.contains(e.target)&&!mobileMenuToggle?.contains(e.target))setMobileMenu(false)});
window.addEventListener("resize",()=>{if(innerWidth>800)setMobileMenu(false)});
const syncMobileAccountLabel=()=>{if(mobileAccountTrigger)mobileAccountTrigger.textContent=currentAccount?.username||"Log In"};
const originalRenderAccount=renderAccount;
renderAccount=function(account){originalRenderAccount(account);syncMobileAccountLabel()};
syncMobileAccountLabel();
