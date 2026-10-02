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
