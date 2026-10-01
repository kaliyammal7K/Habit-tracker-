// Zero-dependency asset compressor:
// serves a build page + the workspace assets, receives downscaled WebP data URIs,
// and writes them to scripts/assets.json.
// Usage: node scripts/asset-builder.js   then open http://127.0.0.1:41777/
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = 41777;
const OUT_FILE = path.join(__dirname, "assets.json");

// [asset path, max dimension px]
const ASSETS = [
  ["objects/calendar.png", 96],
  ["icons/flame.png", 96],
  ["icons/medal.png", 96],
  ["icons/stopwatch.png", 96],
  ["icons/community.png", 96],
  ["icons/laptop.png", 96],
  ["icons/pencil.png", 96],
  ["icons/lotus.png", 96],
  ["icons/chart.png", 96],
  ["icons/sprout.png", 96],
  ["icons/target.png", 96],
  ["mascots/laptop.png", 380],
  ["mascots/love.png", 200],
  ["mascots/sleep.png", 260],
  ["mascots/celebration.png", 260],
  ["mascots/achievement.png", 260],
  ["objects/rocket.png", 128],
  ["objects/plant.png", 128],
];

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>asset build</title>
<style>body{font-family:system-ui;padding:20px}li{font-size:13px;font-family:monospace}</style></head><body>
<h3>Compressing assets…</h3><ul id="log"></ul>
<script>
const ASSETS=${JSON.stringify(ASSETS)};
const log=(m)=>{const li=document.createElement("li");li.textContent=m;document.getElementById("log").appendChild(li)};
(async()=>{
  const out={};let total=0;
  for(const [p,size] of ASSETS){
    try{
      const img=new Image();
      img.src="/file/pink-mascot-assets/"+p;
      await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error("load failed"))});
      const s=Math.min(1,size/Math.max(img.naturalWidth,img.naturalHeight));
      const w=Math.max(1,Math.round(img.naturalWidth*s)),h=Math.max(1,Math.round(img.naturalHeight*s));
      const cv=document.createElement("canvas");cv.width=w;cv.height=h;
      const ctx=cv.getContext("2d");ctx.imageSmoothingQuality="high";
      ctx.drawImage(img,0,0,w,h);
      let d=cv.toDataURL("image/webp",0.86);
      if(!d.startsWith("data:image/webp"))d=cv.toDataURL("image/png");
      out[p]=d;total+=d.length;
      log(p+"  "+w+"x"+h+"  "+Math.round(d.length/1024)+"KB");
    }catch(e){log("FAIL "+p+": "+e.message)}
  }
  document.title="saving";
  const r=await fetch("/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(out)});
  log("saved: "+(await r.text())+"  total "+Math.round(total/1024)+"KB");
  document.title="DONE";
})();
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(PAGE);
    return;
  }
  if (url.pathname.startsWith("/file/")) {
    const rel = decodeURIComponent(url.pathname.slice("/file/".length));
    const abs = path.resolve(ROOT, rel);
    if (!abs.startsWith(ROOT)) { res.writeHead(403); res.end("no"); return; }
    fs.readFile(abs, (err, buf) => {
      if (err) { res.writeHead(404); res.end("404"); return; }
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(buf);
    });
    return;
  }
  if (url.pathname === "/save" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        fs.writeFileSync(OUT_FILE, JSON.stringify(data));
        res.writeHead(200); res.end("ok (" + Object.keys(data).length + " assets)");
      } catch (e) { res.writeHead(500); res.end("bad json"); }
    });
    return;
  }
  res.writeHead(404); res.end("404");
});
server.listen(PORT, "127.0.0.1", () => console.log("asset builder on http://127.0.0.1:" + PORT + "/"));
