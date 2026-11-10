/* Acceso con usuario y contraseña: el token de GitHub se guarda CIFRADO (AES-GCM, clave derivada con PBKDF2) en data/auth.json */
(function(w){
  'use strict';
  var enc=new TextEncoder(),dec=new TextDecoder();
  function b64(buf){var u=new Uint8Array(buf),s='';for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s)}
  function unb64(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
  function norm(u){return String(u||'').trim().toLowerCase()}
  function key(user,pass,salt,iter){
    return crypto.subtle.importKey('raw',enc.encode(norm(user)+':'+pass),'PBKDF2',false,['deriveKey']).then(function(km){
      return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:iter,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    });
  }
  w.PFAuth={
    available:!!(w.crypto&&w.crypto.subtle),
    load:function(){return fetch('data/auth.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){return j&&j.ct?j:null}).catch(function(){return null})},
    lock:function(token,user,pass,meta){
      var salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iter=600000;
      return key(user,pass,salt,iter).then(function(k){return crypto.subtle.encrypt({name:'AES-GCM',iv:iv},k,enc.encode(token))}).then(function(ct){
        return {v:1,owner:meta.owner,repo:meta.repo,branch:meta.branch,iter:iter,salt:b64(salt),iv:b64(iv),ct:b64(ct)};
      });
    },
    unlock:function(user,pass,a){
      return key(user,pass,unb64(a.salt),a.iter||600000).then(function(k){return crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(a.iv)},k,unb64(a.ct))}).then(function(pt){
        return {token:dec.decode(pt),owner:a.owner,repo:a.repo,branch:a.branch};
      }).catch(function(){throw new Error('bad')});
    }
  };
})(window);
