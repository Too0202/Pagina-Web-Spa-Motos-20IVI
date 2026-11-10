/* Configuración editable del sitio (textos, colores, letras y listas).
   Lo usan index.html (para mostrarla) y admin.html (para editarla).
   Lo que cambies en el panel se guarda en data/site.json. */
(function(){
  var DEF={
    name:'Giovanny Buitrago',
    title:'Portafolio Giovanny Buitrago',
    whatsapp:'573142372305',
    photo:'',
    skills:[
      {n:'Catálogos',d:'Diseño de catálogos de producto.'},
      {n:'Video',d:'Grabación y edición de video.'},
      {n:'3D en Blender',d:'Modelado, texturizado y animación en Blender.'},
      {n:'Fotografía',d:'Fotografía para marca y producto.'},
      {n:'Animación y GIF',d:'Animaciones 2D, motion graphics y GIF.'},
      {n:'Redes sociales',d:'Piezas y contenido para redes.'}
    ],
    tools:{
      main:[{n:'After Effects',v:75},{n:'Premiere Pro',v:70},{n:'Illustrator',v:70},{n:'Photoshop',v:60},{n:'Blender',v:80}],
      second:[{n:'CapCut',v:70},{n:'Canva',v:80}]
    },
    socials:[
      {n:'Instagram',h:'giobm15',u:'https://www.instagram.com/giobm15/'}
    ],
    testimonials:[],
    features:{greet:true,cursor:true,hero3d:true,typing:true,bgreact:true,winmem:true},
    typing:[{n:'diseño gráfico'},{n:'edición de video'},{n:'modelado 3D'},{n:'fotografía de producto'},{n:'animación y GIF'},{n:'contenido para redes'}],
    states:{
      busco:{label:'Contratación inmediata',card:'Contratación inmediata'},
      freelance:{label:'Disponible freelance',card:'Disponible para freelance'},
      ocupado:{label:'Ocupado por ahora',card:'Ocupado por ahora'}
    },
    theme:{
      accent:'#8ecdf5',accent2:'#3a9be0',ink:'#0d1824',card:'#f3f7fb',card2:'#e4edf5',
      hero:'#0d1824',dock:'#ffffff',loaderbg:'#05090e',
      bgLightTop:'#c4e1f5',bgLightBottom:'#99c6e6',bgDarkTop:'#121c26',bgDarkBottom:'#0a1017',
      texLight:'#3a9be0',texDark:'#8ecdf5',texOn:true,texStrength:1,radius:30,
      fDisplay:'Bricolage Grotesque',fSans:'Manrope',fMono:'DM Mono'
    }
  };
  var FONTS={
    display:[['Bricolage Grotesque',''],['Space Grotesk','500;700'],['Syne','500;700;800'],['Unbounded','500;700'],['Playfair Display','500;700;800'],['Poppins','500;700;800'],['Montserrat','500;700;800'],['Outfit','500;700;800'],['Sora','500;700;800'],['DM Serif Display','400'],['Archivo','500;700;800']],
    sans:[['Manrope',''],['Inter','400;500;600;700'],['DM Sans','400;500;700'],['Poppins','400;500;600;700'],['Nunito','400;500;600;700'],['Work Sans','400;500;600;700'],['Lora','400;500;600;700']],
    mono:[['DM Mono',''],['JetBrains Mono','400;500'],['IBM Plex Mono','400;500'],['Space Mono','400;700']]
  };
  var user={};
  function clone(o){return JSON.parse(JSON.stringify(o))}
  function eff(k){
    if(k==='theme'){var t=clone(DEF.theme),u=user.theme||{};Object.keys(u).forEach(function(x){if(u[x]!==''&&u[x]!=null)t[x]=u[x]});return t}
    if(k==='features'){var ft=clone(DEF.features),uf=user.features||{};Object.keys(uf).forEach(function(x){if(typeof uf[x]==='boolean')ft[x]=uf[x]});return ft}
    if(k==='states'){var s=clone(DEF.states),us=user.states||{};Object.keys(us).forEach(function(x){if(s[x]){['label','card'].forEach(function(f){if(us[x]&&us[x][f])s[x][f]=us[x][f]})}});return s}
    if(user[k]!==undefined&&user[k]!==null&&user[k]!=='')return user[k];
    return clone(DEF[k]);
  }
  function setUser(u){user=(u&&typeof u==='object')?u:{}}
  function readCache(){try{return JSON.parse(localStorage.getItem('pf_site')||'null')}catch(e){return null}}
  function writeCache(u){try{localStorage.setItem('pf_site',JSON.stringify(u||{}))}catch(e){}}

  /* ---- textos: cada trozo de texto de la página tiene una clave estable ---- */
  var IGNORE='[data-nt],#results,#liveMenu,#chips,#plist,#carDots,.progs,#loaderName,#count,#stH,#liveTx,#pcount,[data-msg],.copy,kbd,.toast,[data-slot],.pct,[data-title],[data-desc],[data-count],[data-hint]';
  var GROUPS=[['.loader','Pantalla de carga'],['#login','Ventana de acceso'],['.side','Barra de abajo'],['.topbar','Encabezado'],['.hero','Portada'],['.projects','Tarjeta Proyectos'],['.skills','Tarjeta Habilidades'],['.edu','Tarjeta Experiencia'],['.status','Tarjeta Estado']];
  var TPL={'tpl-about':'Ventana Sobre mí','tpl-models':'Ventana 3D','tpl-projects':'Ventana Proyectos','tpl-tools':'Ventana Programas','tpl-contact':'Ventana Contacto','tpl-legal':'Ventana Legal'};
  function slug(t){return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)}
  function groupOf(el,tplId){
    if(tplId)return TPL[tplId]||tplId;
    for(var i=0;i<GROUPS.length;i++){if(el.closest&&el.closest(GROUPS[i][0]))return GROUPS[i][1]}
    return 'Otros';
  }
  function collect(root,tplId,counts,out){
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),n;
    while((n=w.nextNode())){
      var raw=n.nodeValue,t=raw.trim();
      if(!t)continue;
      var p=n.parentElement;if(!p)continue;
      var tag=p.tagName;
      if(/^(SCRIPT|STYLE|NOSCRIPT|TITLE|TEMPLATE)$/i.test(tag))continue;
      if(p.closest&&p.closest('svg'))continue;
      if(p.closest&&p.closest(IGNORE))continue;
      var g=groupOf(p,tplId),base=g+'|'+slug(t),c=counts[base]=(counts[base]||0)+1;
      out.push({node:n,raw:raw,text:t,key:c>1?base+'#'+c:base,group:g});
    }
  }
  function collectAll(doc){
    var out=[],counts={};
    collect(doc.body,null,counts,out);
    [].slice.call(doc.querySelectorAll('template')).forEach(function(t){collect(t.content,t.id,counts,out)});
    return out;
  }
  function applyTexts(entries){
    var tx=user.texts||{};
    entries.forEach(function(e){
      var v=tx[e.key];
      if(v!==undefined&&v!==null&&String(v).trim()!==''){
        var lead=e.raw.match(/^\s*/)[0],trail=e.raw.match(/\s*$/)[0];
        e.node.nodeValue=lead+String(v).trim()+trail;
      }else e.node.nodeValue=e.raw;
    });
  }

  /* ---- tema: colores, fondo con textura y letras ---- */
  function hex(c){return String(c||'#000000').replace('#','%23')}
  function circ(c,o){return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='640' viewBox='0 0 640 640' fill='none' stroke='"+hex(c)+"' stroke-width='1.4' stroke-opacity='"+o+"'%3E%3Ccircle cx='320' cy='320' r='40'/%3E%3Ccircle cx='320' cy='320' r='90'/%3E%3Ccircle cx='320' cy='320' r='140' stroke-dasharray='3 9'/%3E%3Ccircle cx='320' cy='320' r='190'/%3E%3Ccircle cx='320' cy='320' r='240' stroke-dasharray='14 10'/%3E%3Ccircle cx='320' cy='320' r='290'/%3E%3Ccircle cx='320' cy='320' r='315' stroke-dasharray='2 6'/%3E%3C/svg%3E\")"}
  function dots(c,o){return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Ccircle cx='2' cy='2' r='1.4' fill='"+hex(c)+"' fill-opacity='"+o+"'/%3E%3C/svg%3E\")"}
  function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
  function tex(t,dark){
    var top=dark?t.bgDarkTop:t.bgLightTop,bot=dark?t.bgDarkBottom:t.bgLightBottom;
    var base='linear-gradient(165deg,'+top+','+bot+')';
    if(t.texOn===false||t.texOn==='false')return base;
    var glow=dark?'rgba(58,155,224,.22)':'rgba(255,255,255,.55)';
    return 'radial-gradient(1000px 640px at 15% 0%,'+glow+',transparent 70%),'+base;
  }
  function fx(t,dark){
    if(t.texOn===false||t.texOn==='false')return '--circ:none;--dots:none;--lines:none;';
    var k=clamp(+t.texStrength||0,0,2.5),c=dark?t.texDark:t.texLight,so=clamp((dark?.16:.32)*k,0,1).toFixed(2),fo=clamp((dark?.16:.35)*k,0,1).toFixed(2);
    var line=dark?'rgba(142,205,245,'+clamp(.05*k,0,1).toFixed(2)+')':'rgba(255,255,255,'+clamp(.28*k,0,1).toFixed(2)+')';
    return '--circ:'+circ(c,so)+';--dots:'+dots(c,fo)+';--lines:repeating-linear-gradient(118deg,'+line+' 0 1px,transparent 1px 54px);';
  }
  function fam(n){return '"'+n+'","Helvetica Neue",Arial,sans-serif'}
  function fontLink(t){
    var want=[];
    [['display','fDisplay'],['sans','fSans'],['mono','fMono']].forEach(function(p){
      FONTS[p[0]].forEach(function(f){if(f[0]===t[p[1]]&&f[1])want.push('family='+f[0].replace(/ /g,'+')+':wght@'+f[1])});
    });
    return want.length?'https://fonts.googleapis.com/css2?'+want.join('&')+'&display=swap':'';
  }
  function themeCss(){
    var t=eff('theme'),r=clamp(+t.radius||0,0,48);
    return ':root{--sky:'+t.accent+';--sky-deep:'+t.accent2+';--ink:'+t.ink+';--card:'+t.card+';--card-2:'+t.card2+';--hero:'+t.hero+';--dock:'+t.dock+';--loaderbg:'+t.loaderbg+';--rad:'+r+'px;--display:'+fam(t.fDisplay)+';--sans:'+fam(t.fSans)+';--mono:'+fam(t.fMono)+';--tex:'+tex(t,false)+';'+fx(t,false)+'}\n'
      +'@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--tex:'+tex(t,true)+';'+fx(t,true)+'}}\n'
      +':root[data-theme="dark"]{--tex:'+tex(t,true)+';'+fx(t,true)+'}\n'
      +':root[data-theme="light"]{--tex:'+tex(t,false)+';'+fx(t,false)+'}\n';
  }
  function applyTheme(){
    var st=document.getElementById('pfTheme');
    if(!st){st=document.createElement('style');st.id='pfTheme';document.head.appendChild(st)}
    st.textContent=themeCss();
    var href=fontLink(eff('theme')),lk=document.getElementById('pfFonts');
    if(href){
      if(!lk){lk=document.createElement('link');lk.id='pfFonts';lk.rel='stylesheet';document.head.appendChild(lk)}
      if(lk.getAttribute('href')!==href)lk.setAttribute('href',href);
    }else if(lk)lk.remove();
  }
  window.PFSite={DEF:DEF,FONTS:FONTS,eff:eff,setUser:setUser,getUser:function(){return user},readCache:readCache,writeCache:writeCache,collectAll:collectAll,applyTexts:applyTexts,applyTheme:applyTheme,clone:clone};
})();
