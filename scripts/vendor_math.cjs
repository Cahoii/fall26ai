// Copy the pinned renderer locally so formulas also work without a CDN or internet.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.dirname(require.resolve('katex/package.json'));
const target=path.join(root,'vendor','katex');
fs.mkdirSync(path.join(target,'fonts'),{recursive:true});
for(const name of ['katex.min.js'])fs.copyFileSync(path.join(source,'dist',name),path.join(target,name));
// Modern target browsers support WOFF2; omit the heavier fallback font formats.
const css=fs.readFileSync(path.join(source,'dist','katex.min.css'),'utf8')
  .replaceAll('font-display:block','font-display:swap')
  .replace(/,url\(fonts\/[^)]+\.(?:woff|ttf)\) format\("(?:woff|truetype)"\)/g,'');
fs.writeFileSync(path.join(target,'katex.min.css'),css);
for(const name of fs.readdirSync(path.join(source,'dist','fonts')).filter(name=>name.endsWith('.woff2'))){
  fs.copyFileSync(path.join(source,'dist','fonts',name),path.join(target,'fonts',name));
}
fs.copyFileSync(path.join(source,'LICENSE'),path.join(target,'LICENSE'));
console.log('Vendored KaTeX '+require('katex/package.json').version+' with WOFF2 fonts');
