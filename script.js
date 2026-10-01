const SERVER_IP = "play.overdosesmp.online";

// Add your permanent Discord invite here later.
const DISCORD_URL = "";

async function copyServerIp() {
  try {
    await navigator.clipboard.writeText(SERVER_IP);
  } catch {
    const input = document.createElement("textarea");
    input.value = SERVER_IP;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  const toast = document.getElementById("toast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

document.getElementById("copyIp").addEventListener("click", copyServerIp);
document.getElementById("copyIpBottom").addEventListener("click", copyServerIp);

document.querySelectorAll(".discord-link").forEach(link => {
  link.addEventListener("click", event => {
    if (!DISCORD_URL) {
      event.preventDefault();
      alert("Discord invite will be added soon.");
    }
  });

  if (DISCORD_URL) link.href = DISCORD_URL;
});
