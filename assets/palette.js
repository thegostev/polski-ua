/* palette.js - Зошит colour picker (top right). Load in <head> without defer,
   so the colour is set before the page paints. Keys 1-4 switch too.
   Default: gray paper. Choice is remembered per browser. */
(function () {
  "use strict";
  var P = [
    { id: "board",    theme: "dark",  sw: "#1f2a26", name: "Дошка · темно-зелена" },
    { id: "graphite", theme: "dark",  sw: "#22211f", name: "Графіт · темна" },
    { id: "cream",    theme: "light", sw: "#f5eedb", name: "Крем · папір" },
    { id: "gray",     theme: "light", sw: "#ebebe8", name: "Сірий · папір" }
  ];
  var DEF = "gray", KEY = "zoshyt-palette", root = document.documentElement;
  function find(id) { for (var i = 0; i < P.length; i++) if (P[i].id === id) return P[i]; return null; }
  var cur = null;
  try { cur = find(localStorage.getItem(KEY)); } catch (e) {}
  cur = cur || find(DEF);
  root.setAttribute("data-palette", cur.id);
  root.setAttribute("data-theme", cur.theme);

  function build() {
    var wrap = document.createElement("div"); wrap.className = "pal";
    var tog = document.createElement("button"); tog.type = "button"; tog.className = "pal-toggle";
    tog.setAttribute("aria-label", "Кольори зошита"); tog.setAttribute("aria-expanded", "false");
    var dot = document.createElement("span"); dot.className = "sw"; tog.appendChild(dot);
    var menu = document.createElement("div"); menu.className = "pal-menu"; menu.setAttribute("role", "menu");
    var btns = P.map(function (p, i) {
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitemradio"); b.dataset.p = p.id;
      b.innerHTML = '<span class="sw" style="background:' + p.sw + '"></span>' + p.name + '<span class="k">' + (i + 1) + "</span>";
      b.addEventListener("click", function () { set(p.id); close(); tog.focus(); });
      menu.appendChild(b); return b;
    });
    wrap.appendChild(tog); wrap.appendChild(menu); document.body.appendChild(wrap);

    function set(id) {
      var p = find(id) || find(DEF);
      root.setAttribute("data-palette", p.id); root.setAttribute("data-theme", p.theme);
      dot.style.background = p.sw; tog.title = p.name;
      btns.forEach(function (b) { b.setAttribute("aria-checked", b.dataset.p === p.id ? "true" : "false"); });
      try { localStorage.setItem(KEY, p.id); } catch (e) {}
    }
    function close() { wrap.classList.remove("open"); tog.setAttribute("aria-expanded", "false"); }
    tog.addEventListener("click", function (e) {
      e.stopPropagation();
      var o = wrap.classList.toggle("open"); tog.setAttribute("aria-expanded", o ? "true" : "false");
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { close(); return; }
      var t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var i = "1234".indexOf(e.key); if (i >= 0) set(P[i].id);
    });
    set(root.getAttribute("data-palette"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
