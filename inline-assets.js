// Inlines scripts/assets.json data URIs into index.html:
//  - replaces literal "pink-mascot-assets/<key>" strings (static <img src>)
//  - replaces the /*__ASSETS__*/{} placeholder with the full asset map
// Usage: node scripts/inline-assets.js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const assets = JSON.parse(fs.readFileSync(path.join(__dirname, "assets.json"), "utf8"));

let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
for (const k of Object.keys(assets)) {
  html = html.split("pink-mascot-assets/" + k).join(assets[k]);
}
if (!html.includes("/*__ASSETS__*/{}")) {
  console.error("placeholder const ASSETS=/*__ASSETS__*/{}; not found in index.html");
  process.exit(1);
}
html = html.replace("/*__ASSETS__*/{}", JSON.stringify(assets));
fs.writeFileSync(path.join(ROOT, "index.html"), html);
console.log("inlined " + Object.keys(assets).length + " assets, index.html now " + Math.round(html.length / 1024) + "KB");
