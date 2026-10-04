// 現場の計算帳：共通の計算スクリプト（ページの data-tool で動くものを決める）
(function () {
  "use strict";
  var D = window.GENBA_DATA || {};

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function num(id) {
    var el = document.getElementById(id);
    if (!el) return NaN;
    var v = String(el.value).replace(/,/g, "").replace(/[０-９．]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    });
    return v === "" ? NaN : parseFloat(v);
  }
  function fmt(x, d) {
    if (!isFinite(x)) return "—";
    return x.toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function show(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }
  function ok(v) { return isFinite(v) && v > 0; }
  function need(msg) { return '<p class="err">' + msg + "</p>"; }

  // タブ（形の切り替えなど）
  $all(".tabs").forEach(function (tabs) {
    var btns = $all("button", tabs);
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        $all("[data-pane]", tabs.parentNode).forEach(function (p) {
          p.hidden = p.getAttribute("data-pane") !== b.getAttribute("data-for");
        });
        recalc();
      });
    });
  });

  function activePane(root) {
    var b = $(".tabs button[aria-selected='true']", root || document);
    return b ? b.getAttribute("data-for") : null;
  }

  var tools = {};

  // コンクリート量（体積）
  tools.concrete = function () {
    var shape = activePane();
    var v = NaN, desc = "";
    if (shape === "box") {
      var L = num("c_l"), W = num("c_w"), H = num("c_h"), n = num("c_n") || 1;
      if (!(ok(L) && ok(W) && ok(H))) return show("c_out", need("長さ・幅・厚さ（高さ）を入れてください"));
      v = L * W * H * n;
      desc = fmt(L, 2) + "m × " + fmt(W, 2) + "m × " + fmt(H, 3) + "m" + (n > 1 ? " × " + n + "か所" : "");
    } else if (shape === "cyl") {
      var Dm = num("c_d"), Hc = num("c_ch"), nc = num("c_cn") || 1;
      if (!(ok(Dm) && ok(Hc))) return show("c_out", need("直径と高さ（深さ）を入れてください"));
      v = Math.PI * Math.pow(Dm / 2, 2) * Hc * nc;
      desc = "π × (" + fmt(Dm, 3) + "m ÷ 2)² × " + fmt(Hc, 2) + "m" + (nc > 1 ? " × " + nc + "本" : "");
    } else if (shape === "trap") {
      var a = num("c_ta"), b = num("c_tb"), h = num("c_th"), Lt = num("c_tl");
      if (!(ok(a) && ok(b) && ok(h) && ok(Lt))) return show("c_out", need("上幅・下幅・高さ・長さを入れてください"));
      v = (a + b) / 2 * h * Lt;
      desc = "(" + fmt(a, 2) + " + " + fmt(b, 2) + ") ÷ 2 × " + fmt(h, 2) + " × " + fmt(Lt, 2) + "m";
    }
    var loss = num("c_loss"); if (!isFinite(loss) || loss < 0) loss = 0;
    var order = v * (1 + loss / 100);
    var cap = num("c_cap");
    var trucks = ok(cap) ? Math.ceil(order / cap - 1e-9) : NaN;
    var unitW = D.concreteUnitWeight || 2.3;
    show("c_out",
      '<div class="big">' + fmt(v, 3) + ' <small>m³（設計数量）</small></div>' +
      "<ul>" +
      "<li>計算：" + desc + "</li>" +
      "<li>ロス " + fmt(loss, 0) + "% を見た注文量：<b>" + fmt(Math.ceil(order * 4 - 1e-9) / 4, 2) + " m³</b>（0.25m³単位で切り上げ）</li>" +
      (ok(cap) ? "<li>生コン車（1台 " + fmt(cap, 2) + "m³）：<b>" + trucks + " 台</b></li>" : "") +
      "<li>重さの目安（" + unitW + " t/m³）：約 " + fmt(v * unitW, 2) + " t</li>" +
      "</ul>");
  };

  // 勾配
  tools.slope = function () {
    var mode = activePane();
    var run, rise;
    if (mode === "len") {
      run = num("s_run"); rise = num("s_rise");
      if (!(ok(run) && isFinite(rise))) return show("s_out", need("水平距離と高低差を入れてください"));
    } else if (mode === "pct") {
      var p = num("s_pct"); run = num("s_run2");
      if (!isFinite(p)) return show("s_out", need("勾配（％）を入れてください"));
      if (!ok(run)) run = 1;
      rise = run * p / 100;
    } else if (mode === "deg") {
      var d = num("s_deg"); run = num("s_run3");
      if (!(isFinite(d) && d > -90 && d < 90)) return show("s_out", need("角度（度）を -90〜90 の間で入れてください"));
      if (!ok(run)) run = 1;
      rise = run * Math.tan(d * Math.PI / 180);
    } else if (mode === "sun") {
      var s = num("s_sun"); run = num("s_run4");
      if (!isFinite(s)) return show("s_out", need("寸勾配（何寸）を入れてください"));
      if (!ok(run)) run = 1;
      rise = run * s / 10;
    }
    var pct = rise / run * 100;
    var deg = Math.atan2(rise, run) * 180 / Math.PI;
    var ratio = rise !== 0 ? Math.abs(run / rise) : Infinity;
    var slopeLen = Math.sqrt(run * run + rise * rise);
    show("s_out",
      '<div class="big">' + fmt(pct, 2) + ' <small>％</small></div>' +
      "<ul>" +
      "<li>角度：<b>" + fmt(deg, 2) + "°</b></li>" +
      "<li>比（1：n）：<b>1：" + (isFinite(ratio) ? fmt(ratio, 2) : "∞") + "</b>（高さ1に対して水平 n）</li>" +
      "<li>寸勾配：<b>" + fmt(pct / 10, 2) + " 寸</b>（水平10に対する高さ）</li>" +
      "<li>水平 " + fmt(run, 3) + " ／ 高低差 " + fmt(rise, 3) + " ／ 斜辺 " + fmt(slopeLen, 3) + "（同じ単位）</li>" +
      "</ul>");
  };

  // 坪・㎡・畳
  tools.area = function () {
    var mode = activePane();
    var TSUBO = 400 / 121; // 1坪 = 400/121 ㎡
    var JO = D.joM2 || 1.62;
    var m2;
    if (mode === "m2") { m2 = num("a_m2"); }
    else if (mode === "tsubo") { m2 = num("a_tsubo") * TSUBO; }
    else if (mode === "jo") { m2 = num("a_jo") * JO; }
    else if (mode === "lw") {
      var L = num("a_l"), W = num("a_w");
      if (!(ok(L) && ok(W))) return show("a_out", need("縦と横を入れてください"));
      m2 = L * W;
    }
    if (!ok(m2)) return show("a_out", need("数値を入れてください"));
    show("a_out",
      '<div class="big">' + fmt(m2 / TSUBO, 2) + ' <small>坪</small></div>' +
      "<ul>" +
      "<li>平方メートル：<b>" + fmt(m2, 2) + " ㎡</b></li>" +
      "<li>畳（1畳＝" + JO + "㎡換算）：<b>" + fmt(m2 / JO, 1) + " 畳</b></li>" +
      "<li>平方フィート：" + fmt(m2 * 10.7639, 1) + " ft²</li>" +
      "</ul>");
  };

  // 鉄筋の重量
  tools.rebar = function () {
    var size = $("#r_size") && $("#r_size").value;
    var row = (D.rebar || []).filter(function (r) { return r.name === size; })[0];
    var L = num("r_len"), n = num("r_n");
    if (!row) return show("r_out", need("呼び名を選んでください"));
    if (!(ok(L) && ok(n))) return show("r_out", need("1本の長さと本数を入れてください"));
    var kg = row.kgm * L * n;
    show("r_out",
      '<div class="big">' + fmt(kg, 1) + ' <small>kg</small></div>' +
      "<ul>" +
      "<li>" + row.name + "（" + row.kgm + " kg/m） × " + fmt(L, 2) + "m × " + fmt(n, 0) + "本</li>" +
      "<li>トン：<b>" + fmt(kg / 1000, 3) + " t</b></li>" +
      "<li>総延長：" + fmt(L * n, 1) + " m</li>" +
      "</ul>");
  };

  // 比重（単位体積重量）× 体積 → 重さ
  tools.weight = function () {
    var key = $("#w_mat") && $("#w_mat").value;
    var row = (D.materials || []).filter(function (m) { return m.key === key; })[0];
    var custom = num("w_custom");
    var tPerM3 = ok(custom) ? custom : (row ? row.t : NaN);
    var mode = activePane();
    var v;
    if (mode === "vol") v = num("w_v");
    else { var L = num("w_l"), W = num("w_w"), H = num("w_h"); v = L * W * H; }
    if (!ok(tPerM3)) return show("w_out", need("材料を選ぶか、単位体積重量を入れてください"));
    if (!ok(v)) return show("w_out", need("体積（または寸法）を入れてください"));
    var t = v * tPerM3;
    show("w_out",
      '<div class="big">' + fmt(t, 3) + ' <small>t</small></div>' +
      "<ul>" +
      "<li>" + (ok(custom) ? "入力した値" : row.name) + "：" + tPerM3 + " t/m³（約 " + fmt(tPerM3 * 9.80665, 1) + " kN/m³）</li>" +
      "<li>体積：" + fmt(v, 3) + " m³</li>" +
      "<li>キログラム：" + fmt(t * 1000, 0) + " kg</li>" +
      "</ul>");
  };

  // 土量の変化率
  tools.soil = function () {
    var key = $("#so_type") && $("#so_type").value;
    var row = (D.soil || []).filter(function (s) { return s.key === key; })[0];
    var Lc = num("so_L"), Cc = num("so_C");
    var Lv = ok(Lc) ? Lc : (row ? row.L : NaN);
    var Cv = ok(Cc) ? Cc : (row ? row.C : NaN);
    var from = $("#so_from") && $("#so_from").value;
    var q = num("so_q");
    if (!(ok(Lv) && ok(Cv))) return show("so_out", need("土の種類を選ぶか、L・Cを入れてください"));
    if (!ok(q)) return show("so_out", need("土量を入れてください"));
    var ground = from === "loose" ? q / Lv : from === "comp" ? q / Cv : q;
    var loose = ground * Lv, comp = ground * Cv;
    var cap = num("so_cap");
    show("so_out",
      '<div class="big">' + fmt(loose, 2) + ' <small>m³（ほぐした土量）</small></div>' +
      "<ul>" +
      "<li>地山の土量：<b>" + fmt(ground, 2) + " m³</b></li>" +
      "<li>ほぐした土量（×L " + Lv + "）：<b>" + fmt(loose, 2) + " m³</b></li>" +
      "<li>締め固めた土量（×C " + Cv + "）：<b>" + fmt(comp, 2) + " m³</b></li>" +
      (ok(cap) ? "<li>ダンプ（1台 地山 " + fmt(cap, 1) + "m³ で）：<b>" + Math.ceil(ground / cap - 1e-9) + " 台</b></li>" : "") +
      "</ul>");
  };

  // ダンプの過積載チェック
  tools.dump = function () {
    var key = $("#d_mat") && $("#d_mat").value;
    var row = (D.materials || []).filter(function (m) { return m.key === key; })[0];
    var max = num("d_max"), q = num("d_q"), L = num("d_L");
    var state = $("#d_state") && $("#d_state").value;
    if (!row) return show("d_out", need("積む材料を選んでください"));
    if (!ok(max)) return show("d_out", need("最大積載量を入れてください（車検証の値）"));
    var ground;
    if (ok(q)) {
      if (state === "loose") { if (!ok(L)) L = 1.2; ground = q / L; } else ground = q;
    }
    var maxGround = max / row.t;
    var html = "";
    if (ok(q)) {
      var t = ground * row.t, pct = t / max * 100;
      var over = t > max;
      html += '<div class="big">' + fmt(t, 2) + ' <small>t（最大積載の ' + fmt(pct, 0) + '％）</small></div>' +
        '<p class="' + (over ? "err" : "") + '"><b>' + (over ? "過積載です。" + fmt(t - max, 2) + " t 多い" : "最大積載量の内側です") + "</b></p>";
    }
    html += "<ul>" +
      "<li>" + row.name + "：" + row.t + " t/m³ で計算</li>" +
      "<li>積める量の上限（地山の量）：<b>" + fmt(maxGround, 2) + " m³</b></li>" +
      "<li>積める量の上限（ほぐした量・L " + (ok(L) ? L : 1.2) + "）：<b>" + fmt(maxGround * (ok(L) ? L : 1.2), 2) + " m³</b></li>" +
      "</ul>";
    show("d_out", html);
  };

  // 鋼材の重さ（形から計算）
  tools.steel = function () {
    var shape = activePane();
    var rho = 7.85; // kg/(mm²・m)×1000 と同じ：鋼 7.85 t/m³
    var area = NaN, desc = ""; // 断面積 mm²
    if (shape === "plate") {
      var t = num("st_pt"), w = num("st_pw");
      area = t * w; desc = "鋼板 " + fmt(t, 1) + "mm × " + fmt(w, 0) + "mm";
    } else if (shape === "round") {
      var d = num("st_rd");
      area = Math.PI * d * d / 4; desc = "丸鋼 φ" + fmt(d, 1) + "mm";
    } else if (shape === "pipe") {
      var od = num("st_od"), tt = num("st_ot");
      if (ok(od) && ok(tt) && tt * 2 >= od) return show("st_out", need("厚さが外径の半分以上になっています"));
      area = Math.PI * (od - tt) * tt; desc = "丸パイプ φ" + fmt(od, 1) + " × " + fmt(tt, 1) + "mm";
    } else if (shape === "box") {
      var a = num("st_ba"), b = num("st_bb"), bt = num("st_bt");
      if (ok(a) && ok(b) && ok(bt) && (bt * 2 >= a || bt * 2 >= b)) return show("st_out", need("厚さが辺の半分以上になっています"));
      area = a * b - (a - 2 * bt) * (b - 2 * bt); desc = "角パイプ " + fmt(a, 0) + "×" + fmt(b, 0) + "×" + fmt(bt, 1) + "mm（角の丸みは無視）";
    }
    var len = num("st_len"), n = num("st_n") || 1;
    if (!ok(area)) return show("st_out", need("寸法を入れてください"));
    var kgm = area * rho / 1000;
    var html = '<div class="big">' + fmt(kgm, 2) + ' <small>kg/m</small></div><ul><li>' + desc + "</li>";
    if (ok(len)) {
      var kg = kgm * len * n;
      html += "<li>" + fmt(len, 2) + "m × " + fmt(n, 0) + "本：<b>" + fmt(kg, 1) + " kg</b>（" + fmt(kg / 1000, 3) + " t）</li>";
    }
    show("st_out", html + "<li>鋼の密度 7.85 t/m³ で計算</li></ul>");
  };

  // 本数（U字溝・縁石・ブロックなど）
  tools.count = function () {
    var L = num("n_len"), p = num("n_unit"), loss = num("n_loss");
    if (!(ok(L) && ok(p))) return show("n_out", need("延長と1個の長さを入れてください"));
    if (!isFinite(loss) || loss < 0) loss = 0;
    var exact = L / (p / 1000);
    var need1 = Math.ceil(exact - 1e-9);
    var order = Math.ceil(need1 * (1 + loss / 100) - 1e-9);
    var rest = need1 * p / 1000 - L;
    show("n_out",
      '<div class="big">' + need1 + ' <small>個（延長 ' + fmt(L, 2) + 'm）</small></div>' +
      "<ul>" +
      "<li>計算：" + fmt(L, 2) + "m ÷ " + fmt(p, 0) + "mm ＝ " + fmt(exact, 2) + " 個 → 切り上げ</li>" +
      "<li>最後の1個は約 " + fmt((p / 1000 - rest) * 1000, 0) + " mm 分だけ使う（" + fmt(rest * 1000, 0) + " mm 余る）</li>" +
      "<li>予備 " + fmt(loss, 0) + "% を見た注文数：<b>" + order + " 個</b></li>" +
      "</ul>");
  };

  function recalc() {
    var t = document.body.getAttribute("data-tool");
    if (tools[t]) { try { tools[t](); } catch (e) { /* 入力途中は無視 */ } }
  }

  // 選択肢の流し込み
  function fillSelect(id, rows, label, val, sel) {
    var el = document.getElementById(id);
    if (!el || !rows) return;
    el.innerHTML = rows.map(function (r) {
      var v = r[val];
      return '<option value="' + v + '"' + (v === sel ? " selected" : "") + ">" + label(r) + "</option>";
    }).join("");
  }
  fillSelect("r_size", D.rebar, function (r) { return r.name + "（" + r.kgm + " kg/m）"; }, "name", "D13");
  fillSelect("w_mat", D.materials, function (m) { return m.name + "（" + m.t + " t/m³）"; }, "key", D.materials && D.materials[0] && D.materials[0].key);
  fillSelect("d_mat", (D.materials || []).filter(function (m) { return ["soil", "softrock", "hardrock", "sand", "gravel", "c40", "m40", "asdense", "conc"].indexOf(m.key) >= 0; }),
    function (m) { return m.name + "（" + m.t + " t/m³）"; }, "key", "soil");
  fillSelect("so_type", D.soil, function (s) { return s.name + "（L " + s.L + "／C " + s.C + "）"; }, "key", D.soil && D.soil[0] && D.soil[0].key);

  document.addEventListener("input", recalc);
  document.addEventListener("change", recalc);
  recalc();
})();
