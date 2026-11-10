/* Genera una miniatura (JPG) de un modelo 3D .glb. Se usa desde el panel (admin.html). */
(function(){
  var libsP=null;
  function loadScript(u){return new Promise(function(ok,no){var x=document.createElement('script');x.src=u;x.onload=ok;x.onerror=function(){no(new Error('No pude cargar '+u))};document.head.appendChild(x)})}
  function loadLibs(){
    if(window.THREE&&THREE.GLTFLoader&&window.__pfLibs)return Promise.resolve();
    if(libsP)return libsP;
    var b='https://cdn.jsdelivr.net/npm/three@0.128.0/';
    libsP=(window.THREE?Promise.resolve():loadScript(b+'build/three.min.js')).then(function(){return THREE.GLTFLoader?null:loadScript(b+'examples/js/loaders/GLTFLoader.js')}).then(function(){window.__pfLibs=1}).catch(function(e){libsP=null;throw e});
    return libsP;
  }
  function getBuffer(src){
    if(src&&src.arrayBuffer)return src.arrayBuffer();
    return fetch(src,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('No pude leer el modelo');return r.arrayBuffer()});
  }
  function render(src){
    return Promise.all([loadLibs(),getBuffer(src)]).then(function(r){
      var buf=r[1];
      return new Promise(function(ok,no){
        var W=1600,H=1000,cv=document.createElement('canvas');cv.width=W;cv.height=H;
        var renderer;
        try{renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,preserveDrawingBuffer:true})}catch(e){no(new Error('Este navegador no puede dibujar 3D'));return}
        renderer.setPixelRatio(1);renderer.setSize(W,H,false);
        renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
        var scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,W/H,.01,100);
        var envScene=new THREE.Scene();
        envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.MeshBasicMaterial({color:0x9ea3b0,side:THREE.BackSide})));
        function panel(w,h,x,y,z,i){var p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(i,i,i),side:THREE.DoubleSide}));p.position.set(x,y,z);p.lookAt(0,0,0);envScene.add(p)}
        panel(36,20,0,32,12,7);panel(14,34,-32,6,12,5);panel(14,34,32,6,-10,4);panel(44,12,0,-6,-36,3);panel(30,10,0,-28,20,1.5);
        var pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(envScene,.03).texture;pm.dispose();
        scene.add(new THREE.HemisphereLight(0xffffff,0x9094a2,.4));
        var key=new THREE.DirectionalLight(0xffffff,.9);key.position.set(3,5,4);scene.add(key);
        var fill=new THREE.DirectionalLight(0xffffff,.35);fill.position.set(-4,1,-3);scene.add(fill);
        new THREE.GLTFLoader().parse(buf,'',function(g){
          try{
            window.PFFix(g);var root=g.scene,box=new THREE.Box3().setFromObject(root),c=box.getCenter(new THREE.Vector3()),sp=box.getBoundingSphere(new THREE.Sphere());
            root.position.sub(c);scene.add(root);
            var r0=sp.radius||1,dist=r0/Math.sin(THREE.MathUtils.degToRad(15))*1.02;
            camera.near=r0/100;camera.far=dist*20;camera.updateProjectionMatrix();
            camera.position.set(.55,.32,.8).normalize().multiplyScalar(dist);camera.lookAt(0,0,0);
            renderer.render(scene,camera);
            /* recorta alrededor del objeto para que llene la miniatura */
            var tmp=document.createElement('canvas');tmp.width=W;tmp.height=H;var tg=tmp.getContext('2d');tg.drawImage(cv,0,0);
            var px=tg.getImageData(0,0,W,H).data,C=8,gw=Math.ceil(W/C),gh=Math.ceil(H/C),grid=new Uint8Array(gw*gh);
            for(var y=0;y<H;y+=2){for(var x=0;x<W;x+=2){if(px[(y*W+x)*4+3]>12)grid[((y/C)|0)*gw+((x/C)|0)]=1}}
            /* ignora motas sueltas: se queda con las piezas grandes del modelo */
            var comps=[],seen=new Uint8Array(gw*gh);
            for(var s0=0;s0<grid.length;s0++){
              if(!grid[s0]||seen[s0])continue;
              var q=[s0],cm={n:0,x0:gw,y0:gh,x1:0,y1:0};seen[s0]=1;
              while(q.length){
                var cur=q.pop(),cx=cur%gw,cy=(cur/gw)|0;cm.n++;
                if(cx<cm.x0)cm.x0=cx;if(cx>cm.x1)cm.x1=cx;if(cy<cm.y0)cm.y0=cy;if(cy>cm.y1)cm.y1=cy;
                for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++){
                  var nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=gw||ny>=gh)continue;
                  var ni=ny*gw+nx;if(grid[ni]&&!seen[ni]){seen[ni]=1;q.push(ni)}
                }
              }
              comps.push(cm);
            }
            var big=0;comps.forEach(function(m){if(m.n>big)big=m.n});
            var x0=W,y0=H,x1=0,y1=0;
            comps.forEach(function(m){if(m.n>=big*.08){x0=Math.min(x0,m.x0*C);y0=Math.min(y0,m.y0*C);x1=Math.max(x1,(m.x1+1)*C);y1=Math.max(y1,(m.y1+1)*C)}});
            if(x1<=x0||y1<=y0){x0=0;y0=0;x1=W;y1=H}
            var OW=800,OH=500,bw=x1-x0,bh=y1-y0,k=Math.min(OW*.78/bw,OH*.78/bh);
            var out=document.createElement('canvas');out.width=OW;out.height=OH;var g2=out.getContext('2d');
            var gr=g2.createRadialGradient(OW*.5,OH*.3,10,OW*.5,OH*.5,OW*.7);gr.addColorStop(0,'#2d5a7a');gr.addColorStop(1,'#10202e');
            g2.fillStyle=gr;g2.fillRect(0,0,OW,OH);
            g2.imageSmoothingQuality='high';
            g2.drawImage(cv,x0,y0,bw,bh,(OW-bw*k)/2,(OH-bh*k)/2,bw*k,bh*k);
            out.toBlob(function(b){try{renderer.dispose();renderer.forceContextLoss()}catch(e){}b?ok(b):no(new Error('No pude crear la miniatura'))},'image/jpeg',.86);
          }catch(e){no(e)}
        },function(){no(new Error('No pude leer el modelo 3D'))});
      });
    });
  }
  /* Compensa lo que Three r128 no soporta: vidrio (transmission), UV 2 de etiquetas, reflejo de tapas */
  window.PFFix=function(g){
    try{
      var js=(g.parser&&g.parser.json)||{},tr={},uv1={},cc={};
      (js.materials||[]).forEach(function(m){var e=m.extensions||{},bt=m.pbrMetallicRoughness&&m.pbrMetallicRoughness.baseColorTexture;
        if(e.KHR_materials_transmission)tr[m.name]=1;if(e.KHR_materials_clearcoat)cc[m.name]=1;if(bt&&bt.texCoord===1)uv1[m.name]=1});
      g.scene.traverse(function(o){
        if(!o.isMesh)return;
        var ms=Array.isArray(o.material)?o.material:[o.material];
        ms.forEach(function(m){
          if(tr[m.name]){m.transparent=true;m.opacity=.2;m.roughness=.04;m.metalness=0;m.envMapIntensity=1.8;m.depthWrite=false;m.color.setRGB(1,1,1)}
          if(uv1[m.name]&&o.geometry.attributes.uv2&&!o.geometry.userData.uvFix){o.geometry.userData.uvFix=1;o.geometry.setAttribute('uv',o.geometry.attributes.uv2)}
          if(uv1[m.name]){m.transparent=true;m.depthWrite=false;m.needsUpdate=true}
          if(cc[m.name]){m.envMapIntensity=1.6;if(m.metalness<.8)m.metalness=.85;m.roughness=Math.min(m.roughness,.28)}
        });
      });
    }catch(e){}
    return g;
  };
  window.PFThumb={render:render};
})();
