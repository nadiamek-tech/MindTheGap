/* Mind the Gap · scientific calculator engine (no eval).
   Works like a Casio / TI in "line" mode: brackets first, then powers and roots,
   then × and ÷, then + and −. −3² = −9, exactly as on the real calculator. */
(function (root) {
  'use strict';
  const OPS = ['+', '−', '×', '÷'];

  /* ---------- turn a typed string into keys ---------- */
  function tokenize(str) {
    const s = String(str).replace(/\s+/g, '').replace(/-/g, '−').replace(/\*/g, '×').replace(/\//g, '÷').replace(/\^2/g, '²');
    const out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) { out.push(c); i++; continue; }
      if (s.startsWith('√(', i)) { out.push('√('); i += 2; continue; }
      if (c === '√') { out.push('√('); i++; continue; }
      if (s.startsWith('^(', i)) { out.push('^('); i += 2; continue; }
      if (s.startsWith('Ans', i)) { out.push('Ans'); i += 3; continue; }
      if ('+−×÷()²'.includes(c)) { out.push(c); i++; continue; }
      throw new Error('Unknown key: ' + c);
    }
    return out;
  }

  /* ---------- parser ---------- */
  function evaluate(tokens, ans) {
    let p = 0; let autoClosed = 0;
    const peek = () => tokens[p];
    const startsFactor = t => t !== undefined && (/[0-9.]/.test(t) || t === '(' || t === '√(' || t === 'Ans');
    function number() {
      let s = '';
      while (p < tokens.length && /[0-9.]/.test(tokens[p])) s += tokens[p++];
      if ((s.match(/\./g) || []).length > 1 || s === '.') throw new Error('Syntax ERROR');
      return parseFloat(s);
    }
    function closeBracket() {
      if (peek() === ')') { p++; } else if (p >= tokens.length) { autoClosed++; } else throw new Error('Syntax ERROR');
    }
    function primary() {
      const t = peek();
      if (t === undefined) throw new Error('Syntax ERROR');
      if (/[0-9.]/.test(t)) return number();
      if (t === 'Ans') { p++; return ans || 0; }
      if (t === '(') { p++; const v = expr(); closeBracket(); return v; }
      if (t === '√(') { p++; const v = expr(); closeBracket(); if (v < 0) throw new Error('Math ERROR'); return Math.sqrt(v); }
      throw new Error('Syntax ERROR');
    }
    function postfix() {
      let v = primary();
      while (peek() === '²' || peek() === '^(') {
        if (peek() === '²') { p++; v = v * v; }
        else { p++; const e = expr(); closeBracket(); v = Math.pow(v, e); }
      }
      return v;
    }
    function unary() {
      if (peek() === '−') { p++; return -unary(); }
      if (peek() === '+') { p++; return unary(); }
      return postfix();
    }
    function term() {
      let v = unary();
      for (;;) {
        const t = peek();
        if (t === '×') { p++; v *= unary(); }
        else if (t === '÷') { p++; const d = unary(); if (d === 0) throw new Error('Math ERROR'); v /= d; }
        else if (startsFactor(t)) { v *= unary(); } /* 2(3) or 2√(9) */
        else return v;
      }
    }
    function expr() {
      let v = term();
      for (;;) {
        const t = peek();
        if (t === '+') { p++; v += term(); }
        else if (t === '−') { p++; v -= term(); }
        else return v;
      }
    }
    if (!tokens.length) return { value: 0, autoClosed: 0 };
    const value = expr();
    if (p < tokens.length) throw new Error('Syntax ERROR');
    if (!isFinite(value)) throw new Error('Math ERROR');
    return { value, autoClosed };
  }

  /* ---------- formatting ---------- */
  function fmt(x) {
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e10 || a < 1e-9) return x.toExponential(9).replace(/\.?0+e/, '×10^').replace('^+', '^');
    let s = x.toPrecision(10);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('-', '−');
  }
  function fraction(x) {
    if (!isFinite(x) || Number.isInteger(x)) return null;
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for (let i = 0; i < 25; i++) {
      const a = Math.floor(b);
      [h1, h0] = [a * h1 + h0, h1]; [k1, k0] = [a * k1 + k0, k1];
      if (k1 > 9999) return null;
      if (Math.abs(x - h1 / k1) < 1e-10 * Math.max(1, Math.abs(x))) return [h1, k1];
      b = 1 / (b - a);
    }
    return null;
  }
  function round(x, dp) { return fmt(Math.round(x * Math.pow(10, dp)) / Math.pow(10, dp)); }

  /* ---------- show the keys the way the screen does ---------- */
  function html(tokens) {
    return tokens.map(t => {
      if (t === '(' || t === ')') return `<span class="k-b">${t}</span>`;
      if (t === '√(') return `<span class="k-f">√</span><span class="k-b">(</span>`;
      if (t === '^(') return `<span class="k-f">^</span><span class="k-b">(</span>`;
      if (t === '²') return `<span class="k-f">²</span>`;
      if (OPS.includes(t)) return `<span class="k-o">${t}</span><wbr>`;
      return t;
    }).join('');
  }
  function openBrackets(tokens) {
    let n = 0; tokens.forEach(t => { if (t === '(' || t === '√(' || t === '^(') n++; else if (t === ')') n--; });
    return n;
  }

  root.MTGCalc = { tokenize, evaluate, fmt, fraction, round, html, openBrackets };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.MTGCalc;
