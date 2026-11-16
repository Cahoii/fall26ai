/* Mixed prose + LaTeX: only explicit \(...\) and \[...\] delimiters are typeset. */
(function(root){
  const cache=new Map();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function formatContent(value){
    const text=String(value??'');
    if(!root.katex)return escape(text);
    if(cache.has(text))return cache.get(text);
    const expression=/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g;
    let html='',start=0,found=false;
    for(const match of text.matchAll(expression)){
      found=true;
      html+=escape(text.slice(start,match.index));
      const tex=match[0].slice(2,-2),displayMode=match[0].startsWith('\\[');
      try{
        if(tex.length>10000)throw new Error('Expression too large');
        html+=`<span class="${displayMode?'math-block':'math-inline'}">${root.katex.renderToString(tex,{
          displayMode,throwOnError:false,trust:false,strict:'ignore',maxExpand:200,maxSize:10,output:'htmlAndMathml',macros:{}
        })}</span>`;
      }catch(error){html+=escape(match[0]);}
      start=match.index+match[0].length;
    }
    html+=escape(text.slice(start));
    if(found){if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(text,html);}
    return html;
  }
  root.formatContent=formatContent;
  if(typeof module!=='undefined')module.exports={formatContent};
})(globalThis);
