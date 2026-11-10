/* Spa Motos 20IVI · ajustes de comportamiento para celular */
(function () {
  'use strict';
  const mob = () => window.innerWidth <= 720;
  if (mob() && window.S && S.ag) S.ag.v = 'd';          // agenda diaria por defecto en celular

  // Hoja con el resto de secciones del admin ("Más")
  window.mmore = function () {
    const m = document.createElement('div');
    m.id = 'md'; m.className = 'md';
    m.innerHTML = `<div class="mb"><div class="mgrid">${ADM.filter(Boolean).slice(4).map((t) =>
      `<button class="ni${S.tab === t[0] ? ' on' : ''}" onclick="S.tab='${t[0]}';document.getElementById('md').remove();render()"><i>${t[2]}</i><span>${t[1]}</span></button>`).join('')}
      <button class="ni" onclick="document.getElementById('md').remove();location.hash='';render()"><i>↩</i><span>Ver como cliente</span></button>
      <button class="ni" onclick="logout()"><i>⎋</i><span>Salir</span></button></div></div>`;
    document.body.appendChild(m);
  };

  const _r = render;
  render = function () {
    _r();
    // color de la barra del navegador según la vista
    const adm = document.body.classList.contains('adm');
    let t = document.querySelector('meta[name="theme-color"]');
    if (!t) { t = document.createElement('meta'); t.name = 'theme-color'; document.head.appendChild(t); }
    t.content = adm ? '#e9f2ff' : '#03195b';
    if (!mob()) return;
    const nav = document.querySelector('.sb nav');
    if (nav && !nav.querySelector('.mo')) {
      const first = ADM.filter(Boolean).slice(0, 4).map((x) => x[0]);
      const b = document.createElement('button');
      b.className = 'ni mo' + (first.includes(S.tab) ? '' : ' on');
      b.innerHTML = '<i>⋯</i><span>Más</span>';
      b.onclick = window.mmore;
      nav.appendChild(b);
    }
    if (S.tab === 'ag') {
      const c = document.querySelector('.agw .seg');
      if (c && !document.querySelector('.mdate')) {
        c.parentNode.insertAdjacentHTML('beforeend', `<input class="mdate" type="date" value="${S.ag.d}" onchange="agSet(this.value)">`);
      }
    }
  };
})();
