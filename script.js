const SERVER_IP="play.overdosesmp.online";
const LINKS={discord:"https://discord.gg/Wnt6RGzThf",vote:"",full:"https://github.com/TheSkaffatar/overdosesmp_website/releases/tag/modpack-v1.0",lite:"https://github.com/TheSkaffatar/overdosesmp_website/releases/tag/modpack-v1.0"};
const toast=document.getElementById("toast");let timer;
function showToast(msg){toast.textContent=msg;toast.classList.add("show");clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove("show"),1800)}
async function copyIP(){try{await navigator.clipboard.writeText(SERVER_IP);showToast("Server IP copied")}catch{showToast(SERVER_IP)}}
document.getElementById("copy-ip").addEventListener("click",copyIP);
document.querySelectorAll(".copy-inline").forEach(x=>x.addEventListener("click",copyIP));
document.querySelectorAll("[data-link]").forEach(a=>{const url=LINKS[a.dataset.link];if(url){a.href=url;if(["full","lite"].includes(a.dataset.link))a.setAttribute("target","_blank")}else a.addEventListener("click",e=>{e.preventDefault();showToast(["full","lite"].includes(a.dataset.link)?"Download coming soon":a.textContent.trim()+" link coming soon")})});
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");observer.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll(".reveal").forEach(x=>observer.observe(x));