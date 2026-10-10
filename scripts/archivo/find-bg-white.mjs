/** Muestra el contexto de cada `bg-white` opaco que queda en el HTML servido. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const html = await (await fetch("https://cordoba-digital.vercel.app/", { headers: { "user-agent": UA } })).text();
const re = /(^|[^\w/-])bg-white(?![\w/-])/g;
let m;
let i = 0;
while ((m = re.exec(html)) !== null) {
  i += 1;
  const start = Math.max(0, m.index - 170);
  console.log(`\n--- ${i} ---`);
  console.log(html.slice(start, m.index + 60).replace(/</g, "\n<"));
}
