const SB_URL = "https://oobwtogzkvjgaghwpzxs.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vYnd0b2d6a3ZqZ2FnaHdwenhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMDk4NTUsImV4cCI6MjEwNzc4NTg1NX0.pbmQ1K1_XnbLdvyZinH0PYQ-dXhtp5XCuDIwMNxApeQ";
const PAY_URL = "";
const SLUG = "gwinnett-sample";

const pinEl = document.getElementById("pin");
const btn = document.getElementById("go");
const msg = document.getElementById("msg");

function setMsg(text, ok) {
  msg.textContent = text;
  msg.style.color = ok ? "#7be0a5" : "#ff9a9a";
}

function saveCsv(text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "gwinnett_lead_sample.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function getSample() {
  const pin = pinEl.value.trim();
  if (!pin) { setMsg("Enter your PIN.", false); return; }
  if (!SB_URL || !SB_KEY) { setMsg("Download is not set up yet.", false); return; }
  btn.disabled = true;
  setMsg("Checking...", true);
  try {
    const res = await fetch(SB_URL + "/rest/v1/rpc/get_sample", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_KEY, Authorization: "Bearer " + SB_KEY },
      body: JSON.stringify({ p_slug: SLUG, p_pin: pin })
    });
    if (!res.ok) throw new Error("status " + res.status);
    const data = await res.json();
    if (data === "LOCKED") setMsg("Too many wrong tries. Try again in an hour.", false);
    else if (!data) setMsg("That PIN did not work.", false);
    else { saveCsv(data); setMsg("Downloaded. Check your files.", true); }
  } catch (e) {
    setMsg("Something went wrong. Try again.", false);
  }
  btn.disabled = false;
}

btn.addEventListener("click", getSample);
pinEl.addEventListener("keydown", (e) => { if (e.key === "Enter") getSample(); });

if (PAY_URL) {
  document.getElementById("pay").href = PAY_URL;
  document.getElementById("buy").hidden = false;
}

