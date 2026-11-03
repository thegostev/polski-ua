/* quiz.js - type-in drills and learner helpers for the UA→PL trap lessons.
 *
 * Drill markup:
 *   <ol class="drill" data-quiz data-step="3. Ціле слово">   <- data-step names the ladder step (used in the report)
 *     <li data-answer="czasu|czasu."      <- accepted answers, "a|b" for alternatives
 *         data-why="short reason"         <- shown once the item is resolved
 *         data-worked                     <- optional: fully shown example, no input, not scored
 *         data-prefill="cza"              <- optional: half-shown item, input starts with this text
 *         data-core="nie mam karty"       <- optional: also accept any answer containing this phrase ("a|b")
 *       <span class="stem">Mam czas. → Nie mam ___.</span>
 *       <span class="cue">у словнику: czas</span>   <- optional hint line
 *     </li>
 *     <li data-free data-model="Nie mam samochodu.">  <- free writing: textarea + model, not scored
 *       <span class="stem">...</span>
 *     </li>
 *   </ol>
 *
 * Other helpers:
 *   <div class="guess" data-guess><p class="prompt">..</p><div class="reveal">..</div></div>
 *       -> textarea + "Показати" button; .reveal opens after the guess.
 *   <p class="lost" data-lost="name of block"></p>      -> "Загубився тут" checkbox
 *   <textarea data-report-field="label"></textarea>      -> included in the report
 *   <div class="report" data-report></div>               -> builds a text report to paste back
 *
 * Free recall on purpose: no options to pick from, and the answer is never
 * shown until the learner either gets it or asks for it.
 */
(function () {
  "use strict";

  var FOLD = { "ą":"a","ć":"c","ę":"e","ł":"l","ń":"n","ó":"o","ś":"s","ź":"z","ż":"z" };
  var LOG = [];      // graded items
  var FREE = [];     // free-writing items
  var GUESSES = [];  // guess blocks

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[.,!?;:«»"„”“()]/g, " ")
      .replace(/[’']/g, "’")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fold(s) {
    return norm(s).replace(/[ąćęłńóśźż]/g, function (c) { return FOLD[c]; });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function textOf(node) {
    return node ? node.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function answersOf(li) {
    return (li.dataset.answer || "").split("|").map(function (a) { return a.trim(); });
  }

  function buildWorked(li) {
    var shown = answersOf(li)[0];
    li.classList.add("worked");
    li.insertBefore(el("span", "worked-tag", "Приклад - подивись, як це робиться"), li.firstChild);
    var v = el("div", "verdict show ok", "Відповідь: " + shown);
    if (li.dataset.why) v.appendChild(el("span", "why", li.dataset.why));
    li.appendChild(v);
  }

  function buildFree(li, step) {
    var area = el("textarea");
    area.rows = 2;
    area.spellcheck = false;
    area.setAttribute("aria-label", "Твоє речення");
    area.placeholder = "Напиши своє речення польською…";
    var btn = el("button", null, "Показати приклад");
    btn.type = "button";
    var model = el("div", "verdict");
    li.appendChild(area);
    var row = el("div", "answer-row");
    row.appendChild(btn);
    li.appendChild(row);
    li.appendChild(model);
    btn.addEventListener("click", function () {
      model.className = "verdict show ok";
      model.textContent = "Приклад: " + (li.dataset.model || "");
      model.appendChild(el("span", "why", "Порівняй зі своїм: слово після nie змінилось так, як у «немає …»?"));
    });
    FREE.push({ step: step, stem: textOf(li.querySelector(".stem")), get: function () { return area.value.trim(); } });
  }

  function buildItem(li, step, onResolve) {
    var answers = answersOf(li);
    var shown = answers[0];
    var why = li.dataset.why || "";
    var resolved = false;
    var missed = false;
    var entry = { step: step, stem: textOf(li.querySelector(".stem")), answer: shown, typed: [], result: null };
    LOG.push(entry);

    var row = el("div", "answer-row");
    var input = el("input");
    input.type = "text";
    input.autocapitalize = "off";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Відповідь");
    input.placeholder = "…";
    if (li.dataset.prefill) input.value = li.dataset.prefill;

    var check = el("button", null, "Перевірити");
    check.type = "button";
    var reveal = el("button", null, "Показати");
    reveal.type = "button";

    var verdict = el("div", "verdict");
    verdict.setAttribute("aria-live", "polite");

    row.appendChild(input);
    row.appendChild(check);
    row.appendChild(reveal);
    li.appendChild(row);
    li.appendChild(verdict);

    function setState(state) {
      li.classList.remove("state-ok", "state-near", "state-no");
      if (state) li.classList.add("state-" + state);
    }

    function say(state, msg, withWhy) {
      verdict.className = "verdict show " + state;
      verdict.textContent = "";
      verdict.appendChild(document.createTextNode(msg));
      if (why && withWhy) verdict.appendChild(el("span", "why", why));
      setState(state);
    }

    function finish(result) {
      if (resolved) return;
      resolved = true;
      entry.result = result;
      input.disabled = true;
      check.disabled = true;
      reveal.disabled = true;
      onResolve(result, missed);
    }

    function doCheck() {
      if (resolved) return;
      var v = input.value;
      if (!norm(v)) { input.focus(); return; }
      var cores = (li.dataset.core || "").split("|").map(function (c) { return norm(c); }).filter(Boolean);
      var exact = answers.some(function (a) { return norm(a) === norm(v); }) ||
                  cores.some(function (c) { return (" " + norm(v) + " ").indexOf(" " + c + " ") >= 0; });
      var loose = answers.some(function (a) { return fold(a) === fold(v); });

      if (exact) {
        say("ok", "Так. " + shown, true);
        finish("ok");
      } else if (loose) {
        entry.typed.push(v.trim());
        say("near", "Майже - слово правильне, але без польських літер: " + shown, true);
        finish("near");
      } else {
        missed = true;
        entry.typed.push(v.trim());
        say("no", "Ні. Спробуй ще раз - або натисни «Показати».", false);
      }
    }

    function doReveal() {
      if (resolved) return;
      say("no", "Відповідь: " + shown, true);
      finish("revealed");
    }

    check.addEventListener("click", doCheck);
    reveal.addEventListener("click", doReveal);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); doCheck(); }
    });
  }

  function buildDrill(ol) {
    var step = ol.dataset.step || "";
    var items = Array.prototype.slice.call(ol.querySelectorAll(":scope > li"));
    var graded = [];
    items.forEach(function (li) {
      if (li.hasAttribute("data-worked")) buildWorked(li);
      else if (li.hasAttribute("data-free")) buildFree(li, step);
      else graded.push(li);
    });
    if (!graded.length) return;

    var total = graded.length;
    var counts = { ok: 0, near: 0, revealed: 0, second: 0 };
    var done = 0;

    var bar = el("div", "scorebar");
    var line = el("span");
    var reset = el("button", null, "Почати спочатку");
    reset.type = "button";
    bar.appendChild(line);
    bar.appendChild(reset);
    ol.parentNode.insertBefore(bar, ol.nextSibling);

    function render() {
      line.textContent = "";
      line.appendChild(el("strong", null, counts.ok + " / " + total));
      var rest = " правильно";
      if (counts.second) rest += " · " + counts.second + " з другої спроби";
      if (counts.near) rest += " · " + counts.near + " без польських літер";
      if (counts.revealed) rest += " · " + counts.revealed + " підказано";
      if (done === total) rest += " · готово";
      line.appendChild(document.createTextNode(rest));
    }

    graded.forEach(function (li) {
      buildItem(li, step, function (result, missed) {
        counts[result] = (counts[result] || 0) + 1;
        if (missed && result === "ok") counts.second += 1;
        done += 1;
        render();
      });
    });

    reset.addEventListener("click", function () { window.location.reload(); });
    render();
  }

  function buildGuess(box) {
    var reveal = box.querySelector(".reveal");
    var area = el("textarea");
    area.rows = 2;
    area.setAttribute("aria-label", "Твоя здогадка");
    area.placeholder = "Як думаєш? Навіть «?» рахується.";
    var btn = el("button", null, "Показати");
    btn.type = "button";
    var row = el("div", "answer-row");
    row.appendChild(btn);
    box.insertBefore(area, reveal);
    box.insertBefore(row, reveal);
    btn.addEventListener("click", function () {
      if (!area.value.trim()) { area.focus(); area.placeholder = "Спочатку напиши хоч щось - навіть «?»"; return; }
      box.classList.add("open");
      btn.disabled = true;
    });
    GUESSES.push({ prompt: textOf(box.querySelector(".prompt")).slice(0, 60), get: function () { return area.value.trim(); } });
  }

  function buildLost(p) {
    var label = el("label");
    var box = el("input");
    box.type = "checkbox";
    box.dataset.lostName = p.dataset.lost || "";
    label.appendChild(box);
    label.appendChild(document.createTextNode(" Тут незрозуміло"));
    p.appendChild(label);
  }

  function buildReport(box) {
    var btn = el("button", null, "Зібрати звіт");
    btn.type = "button";
    var copy = el("button", null, "Скопіювати");
    copy.type = "button";
    copy.disabled = true;
    var out = el("textarea");
    out.rows = 10;
    out.readOnly = true;
    out.setAttribute("aria-label", "Звіт");
    var row = el("div", "answer-row");
    row.appendChild(btn);
    row.appendChild(copy);
    box.appendChild(row);
    box.appendChild(out);

    btn.addEventListener("click", function () {
      var L = [];
      L.push(document.title + " · " + new Date().toISOString().slice(0, 10));

      var steps = [];
      LOG.forEach(function (e) { if (steps.indexOf(e.step) < 0) steps.push(e.step); });
      L.push("");
      L.push("Тренування:");
      steps.forEach(function (s) {
        var es = LOG.filter(function (e) { return e.step === s; });
        var ok = es.filter(function (e) { return e.result === "ok"; }).length;
        var open = es.filter(function (e) { return !e.result; }).length;
        L.push("- " + (s || "вправа") + ": " + ok + "/" + es.length + (open ? " (" + open + " не зроблено)" : ""));
      });

      var miss = LOG.filter(function (e) { return e.result && (e.result !== "ok" || e.typed.length); });
      L.push("");
      L.push("Помилки:" + (miss.length ? "" : " немає"));
      miss.forEach(function (e) {
        var how = e.result === "revealed" ? "підказано" : (e.result === "near" ? "без польських літер" : "з другої спроби");
        L.push("- " + e.stem + " → " + e.answer + " | писав: " + (e.typed.join(" / ") || "-") + " | " + how);
      });

      var lost = Array.prototype.filter.call(document.querySelectorAll("[data-lost-name]"), function (c) { return c.checked; })
        .map(function (c) { return c.dataset.lostName; });
      L.push("");
      L.push("Незрозуміло: " + (lost.length ? lost.join("; ") : "ніде"));

      var g = GUESSES.filter(function (x) { return x.get(); });
      if (g.length) {
        L.push("");
        L.push("Здогадки:");
        g.forEach(function (x) { L.push("- " + x.get()); });
      }

      var f = FREE.filter(function (x) { return x.get(); });
      if (f.length) {
        L.push("");
        L.push("Свої речення:");
        f.forEach(function (x) { L.push("- " + x.get()); });
      }

      Array.prototype.forEach.call(document.querySelectorAll("[data-report-field]"), function (t) {
        L.push("");
        L.push(t.dataset.reportField + ": " + (t.value.trim() || "-"));
      });

      out.value = L.join("\n");
      copy.disabled = false;
    });

    copy.addEventListener("click", function () {
      out.select();
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(out.value);
        else document.execCommand("copy");
        copy.textContent = "Скопійовано";
      } catch (e) {
        copy.textContent = "Виділи текст і скопіюй вручну";
      }
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-quiz]"), buildDrill);
    Array.prototype.forEach.call(document.querySelectorAll("[data-guess]"), buildGuess);
    Array.prototype.forEach.call(document.querySelectorAll("[data-lost]"), buildLost);
    Array.prototype.forEach.call(document.querySelectorAll("[data-report]"), buildReport);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
