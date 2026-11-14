/* Module budget : opérations, frais fixes, enveloppes, import de relevés, thème. Données dans S.b (stockage local). */
(function(){
'use strict';
var A = window.APP; if(!A) return;
var $ = function(id){ return document.getElementById(id); }, esc = A.esc;
var nfE = new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}), nf0 = new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0});
var eur = function(n){ return nfE.format(Math.round(n*100)/100)+' €'; }, eur0 = function(n){ return nf0.format(Math.round(n))+' €'; };
var sg = function(n){ return (n>0.004?'+':n<-0.004?'−':'')+nfE.format(Math.abs(n))+' €'; };
var MO = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var now = new Date(), pad = function(n){ return (n<10?'0':'')+n; };
var TODAY = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate()), CM = TODAY.slice(0,7);
var mi = function(m){ return +m.slice(0,4)*12 + (+m.slice(5,7)) - 1; }, im = function(i){ return Math.floor(i/12)+'-'+pad(i%12+1); };
var ml = function(m){ return MO[+m.slice(5,7)-1]+' '+m.slice(0,4); }, dim = function(m){ return new Date(+m.slice(0,4), +m.slice(5,7), 0).getDate(); };
var uid = function(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); };
var r2 = function(n){ return Math.round(n*100)/100; };
var PAL = ['#0d7a5c','#2f5fc4','#b4571a','#8a4fd0','#c2325a','#1a8fa8','#6b8e23','#d08a00','#5c6b64','#e0527a','#3a7bd5','#8d6e63'];
var FREQ = [[1,'Chaque mois'],[2,'Tous les 2 mois'],[3,'Chaque trimestre'],[6,'Chaque semestre'],[12,'Chaque année']];
var TYPES = [['d','Dépense'],['r','Revenu'],['e','Épargne'],['x','Virement interne']], NAT = [['b','Besoin'],['v','Envie'],['e','Épargne'],['','Sans objet']];
var NC = {id:'',n:'Non classé',t:'d',k:'v',c:'#9aa3a0',bud:0};
var B, ui = {m:CM,q:'',fc:'',ft:'',fa:'',fs:'',edit:null,imp:null,msg:''}, wired = false;

function defs(){
  var L = [['Salaires','r',''],['Allocations et aides','r',''],['Autres revenus','r',''],['Logement','d','b'],['Énergie et eau','d','b'],['Courses','d','b'],['Transports','d','b'],['Voiture','d','b'],['Santé','d','b'],['Enfants et école','d','b'],['Assurances','d','b'],['Téléphone, internet, abonnements','d','b'],['Impôts et taxes','d','b'],['Crédits','d','b'],['Loisirs et sorties','d','v'],['Restaurants','d','v'],['Vacances','d','v'],['Habillement','d','v'],['Maison et équipement','d','v'],['Cadeaux','d','v'],['Divers','d','v'],['Épargne','e','e'],['Virements internes','x','']];
  return {v:1, acc:[{id:'a1',n:'Compte courant',init:0}], cats:L.map(function(x,i){ return {id:'c'+i,n:x[0],t:x[1],k:x[2],c:PAL[i%PAL.length],bud:0}; }), rec:[], ops:[], rules:[], goals:[]};
}
function num(v){ var n = pAmt(v); return n===null ? 0 : n; }
function cat(id){ if(!id) return NC; for(var i=0;i<B.cats.length;i++) if(B.cats[i].id===id) return B.cats[i]; return NC; }
function typ(o){ return o.c && cat(o.c).id ? cat(o.c).t : (o.a>0 ? 'r' : 'd'); }
function accN(id){ for(var i=0;i<B.acc.length;i++) if(B.acc[i].id===id) return B.acc[i].n; return ''; }
function sel(opts, val, attr){ return '<select class="fi" '+(attr||'')+'>'+opts.map(function(o){ return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+esc(o[1])+'</option>'; }).join('')+'</select>'; }
function catOpts(first){ return [['',first||'Non classé']].concat(B.cats.map(function(c){ return [c.id,c.n]; })); }
function accOpts(){ return B.acc.map(function(a){ return [a.id,a.n]; }); }
function allTags(){ var s = {}; B.ops.forEach(function(o){ (o.t||[]).forEach(function(t){ s[t]=1; }); }); return Object.keys(s).sort(); }
function save(){ A.persist(); }

/* ---------- Calculs ---------- */
function recFor(m){ return B.rec.filter(function(r){ return r.a>0 && r.s && r.s<=m && (!r.e || r.e>=m) && (mi(m)-mi(r.s))%(r.f||1)===0; }); }
function calc(m){
  var o = {rev:0,dep:0,epar:0,revP:0,fixP:0,eparP:0,fixR:0,by:{},prev:{},vr:{},nc:0,np:0,pend:[],n:0}, done = {};
  B.ops.forEach(function(p){
    if(p.d.slice(0,7)!==m) return;
    o.n++; if(p.r) done[p.r] = 1; if(!p.c) o.nc++; if(!p.ok) o.np++;
    var t = typ(p); if(t==='x') return;
    if(t==='r') o.rev += p.a;
    else { if(t==='e') o.epar -= p.a; else { o.dep -= p.a; if(p.r) o.fixR -= p.a; } o.by[p.c||''] = (o.by[p.c||'']||0) - p.a; if(!p.r) o.vr[p.c||''] = (o.vr[p.c||'']||0) - p.a; }
  });
  recFor(m).forEach(function(r){
    var t = cat(r.c).t; if(t==='x') return;
    if(t!=='r') o.prev[r.c||''] = (o.prev[r.c||'']||0) + r.a;
    if(done[r.id]) return;
    o.pend.push(r);
    if(t==='r') o.revP += r.a; else if(t==='e') o.eparP += r.a; else o.fixP += r.a;
  });
  o.env = 0;
  B.cats.forEach(function(c){ if(c.t==='d' && c.bud>0){ o.prev[c.id] = (o.prev[c.id]||0) + c.bud; o.env += Math.max(0, c.bud-(o.vr[c.id]||0)); } });
  o.reste = o.rev + o.revP - o.dep - o.fixP - o.epar - o.eparP;
  return o;
}
function bal(id){ var a = 0, p = 0; B.acc.forEach(function(x){ if(!id || x.id===id){ a += +x.init||0; p += +x.init||0; } }); B.ops.forEach(function(o){ if(!id || o.acc===id){ a += o.a; if(o.ok) p += o.a; } }); return {all:a, ok:p}; }
function ruleCat(l){ l = String(l).toLowerCase(); for(var i=0;i<B.rules.length;i++){ var k = (B.rules[i].kw||'').toLowerCase(); if(k && l.indexOf(k)>=0) return B.rules[i].c; } return ''; }
function autoLink(o){
  if(o.r) return; var m = o.d.slice(0,7), used = {};
  B.ops.forEach(function(p){ if(p.r && p.d.slice(0,7)===m) used[p.r] = 1; });
  var c = recFor(m).filter(function(r){ if(used[r.id]) return false; var pos = cat(r.c).t==='r'; if(pos !== (o.a>0)) return false; if(o.c && r.c && o.c!==r.c) return false; return Math.abs(Math.abs(o.a)-r.a) <= Math.max(0.5, r.a*0.02); })[0];
  if(c){ o.r = c.id; if(!o.c) o.c = c.c; }
}

function relink(m){ B.ops.forEach(function(o){ if(!o.r && o.d.slice(0,7)===m) autoLink(o); }); }

/* ---------- Lecture des relevés ---------- */
function pDate(s){
  s = String(s==null?'':s).trim(); var m;
  if((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s))) return ok(+m[1],+m[2],+m[3]);
  if((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-'](\d{2,4})/.exec(s))) return ok(+m[3]<100?2000+ +m[3]:+m[3], +m[2], +m[1]);
  if((m = /^(\d{4})(\d{2})(\d{2})/.exec(s))) return ok(+m[1],+m[2],+m[3]);
  return null;
  function ok(y,mo,d){ return (y>1990&&y<2100&&mo>=1&&mo<=12&&d>=1&&d<=31) ? y+'-'+pad(mo)+'-'+pad(d) : null; }
}
function pAmt(s){
  s = String(s==null?'':s).replace(/[\s  €$£"]/g,''); if(!s || !/\d/.test(s)) return null;
  var neg = /^\(.*\)$/.test(s) || /^[-−]/.test(s) || /[-−]$/.test(s);
  s = s.replace(/[()+\-−]/g,'');
  if(s.indexOf(',')>=0 && s.indexOf('.')>=0) s = s.lastIndexOf(',')>s.lastIndexOf('.') ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,'');
  else s = s.replace(',','.');
  var n = parseFloat(s); return isNaN(n) ? null : (neg ? -n : n);
}
function splitLine(l, d){ var out = [], cur = '', q = false; for(var i=0;i<l.length;i++){ var ch = l[i]; if(ch==='"'){ if(q && l[i+1]==='"'){ cur += '"'; i++; } else q = !q; } else if(ch===d && !q){ out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(function(x){ return x.trim(); }); }
function parseCSV(txt){
  var lines = txt.replace(/^﻿/,'').replace(/\r\n?/g,'\n').split('\n').filter(function(x){ return x.trim(); });
  var smp = lines.slice(0,20).join('\n'), del = [';','\t',',','|'].map(function(d){ return [d, smp.split(d).length]; }).sort(function(a,b){ return b[1]-a[1]; })[0][0];
  var rows = lines.map(function(l){ return splitLine(l, del); }), H = /date|libell|label|montant|amount|d[ée]bit|cr[ée]dit|description|intitul|op[ée]ration/i, hi = -1;
  for(var i=0;i<Math.min(rows.length,25);i++){ if(rows[i].filter(function(c){ return H.test(c) && pDate(c)===null; }).length>=2){ hi = i; break; } }
  var w = 0; rows.forEach(function(r){ w = Math.max(w, r.length); });
  var head = hi>=0 ? rows[hi] : [], data = rows.slice(hi+1).filter(function(r){ return r.some(function(c){ return pDate(c); }); });
  for(i=0;i<w;i++) if(!head[i]) head[i] = 'Colonne '+(i+1);
  var f = function(re, not){ for(var j=0;j<head.length;j++) if(re.test(head[j]) && !(not && not.test(head[j]))) return j; return -1; };
  var map = {d:f(/date/i,/valeur/i), l:f(/libell|label|description|intitul|d[ée]tail|motif|communication/i), a:f(/montant|amount/i), db:f(/d[ée]bit/i), cr:f(/cr[ée]dit/i)}, r0 = data[0]||[];
  if(map.d<0) map.d = f(/date/i);
  if(map.d<0) for(i=0;i<w;i++) if(pDate(r0[i])){ map.d = i; break; }
  if(map.a<0 && map.db<0 && map.cr<0) for(i=w-1;i>=0;i--) if(i!==map.d && pAmt(r0[i])!==null && !pDate(r0[i])){ map.a = i; break; }
  if(map.l<0){ var best = -1, bl = 0; for(i=0;i<w;i++){ var c = r0[i]||''; if(i!==map.d && pAmt(c)===null && c.length>bl){ bl = c.length; best = i; } } map.l = best; }
  return {kind:'csv', head:head, rows:data, map:map};
}
function parseOFX(txt){ var out = [], re = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/STMTTRN>|<\/BANKTRANLIST>|$)/gi, m, g = function(b,t){ var x = new RegExp('<'+t+'>([^<\\r\\n]*)','i').exec(b); return x ? x[1].trim() : ''; };
  while((m = re.exec(txt))){ var d = pDate(g(m[1],'DTPOSTED')), a = pAmt(g(m[1],'TRNAMT')); if(d && a!==null) out.push({d:d, a:a, l:(g(m[1],'NAME')+' '+g(m[1],'MEMO')).trim()}); }
  return {kind:'list', list:out}; }
function parseQIF(txt){ var out = []; txt.split(/^\^/m).forEach(function(b){ var o = {l:''}; b.split(/\r?\n/).forEach(function(x){ var k = x[0], v = x.slice(1).trim(); if(k==='D') o.d = pDate(v); else if(k==='T'||k==='U') o.a = pAmt(v); else if(k==='P') o.l = v+(o.l?' '+o.l:''); else if(k==='M') o.l += (o.l?' ':'')+v; }); if(o.d && o.a!=null) out.push(o); }); return {kind:'list', list:out}; }
function parseFile(name, txt){ if(/<OFX|<STMTTRN/i.test(txt)) return parseOFX(txt); if(/\.qif$/i.test(name) || /^!Type:/m.test(txt)) return parseQIF(txt); return parseCSV(txt); }
function impOps(I){
  var out = [];
  if(I.kind==='list') out = I.list.slice();
  else I.rows.forEach(function(r){
    var d = pDate(r[I.map.d]), a = null;
    if(I.map.a>=0) a = pAmt(r[I.map.a]);
    if(a===null && (I.map.db>=0 || I.map.cr>=0)){ var db = I.map.db>=0 ? pAmt(r[I.map.db]) : null, cr = I.map.cr>=0 ? pAmt(r[I.map.cr]) : null; if(db!==null || cr!==null) a = (cr||0) - Math.abs(db||0); }
    if(d && a!==null && a!==0) out.push({d:d, a:a, l:String(r[I.map.l]||'').replace(/\s+/g,' ').trim()});
  });
  if(I.inv) out.forEach(function(o){ o.a = -o.a; });
  return out;
}
function keyOf(o){ return o.d+'|'+r2(o.a)+'|'+String(o.l).toLowerCase().replace(/\s+/g,' ').trim(); }
function doImport(I){
  var seen = {}, n = 0, dup = 0, last = '';
  B.ops.forEach(function(o){ seen[keyOf(o)] = 1; });
  impOps(I).forEach(function(x){
    var k = keyOf(x); if(seen[k]){ dup++; return; } seen[k] = 1;
    var o = {id:uid(), d:x.d, l:x.l||'Opération', a:r2(x.a), c:ruleCat(x.l), acc:I.acc||B.acc[0].id, ok:!!I.ok, t:[]};
    autoLink(o); B.ops.push(o); n++; if(x.d>last) last = x.d;
  });
  return {n:n, dup:dup, last:last};
}

/* ---------- Thème ---------- */
function applyTheme(){
  var th = A.S.theme || {}, root = document.documentElement, st = $('thm');
  if(th.mode==='light' || th.mode==='dark'){ root.setAttribute('data-theme', th.mode); root._t = 1; } else if(root._t){ root.removeAttribute('data-theme'); root._t = 0; }
  if(!st){ st = document.createElement('style'); st.id = 'thm'; document.head.appendChild(st); }
  var a = /^#[0-9a-f]{6}$/i.test(th.accent||'') ? th.accent : '';
  if(!a){ st.textContent = ''; return; }
  var lum = (parseInt(a.slice(1,3),16)*299 + parseInt(a.slice(3,5),16)*587 + parseInt(a.slice(5,7),16)*114)/255000;
  var L = '--accent:'+a+';--accent-soft:color-mix(in srgb,'+a+' 16%,var(--surface));--hero-a:'+a+';--hero-b:color-mix(in srgb,'+a+' 62%,#000);--accent-ink:'+(lum>0.62?'#10201a':'#fff')+';';
  var D = '--accent:color-mix(in srgb,'+a+' 70%,#fff);--accent-soft:color-mix(in srgb,'+a+' 26%,var(--surface));--hero-a:color-mix(in srgb,'+a+' 80%,#000);--hero-b:color-mix(in srgb,'+a+' 45%,#000);--accent-ink:#0b1512;';
  st.textContent = ':root{'+L+'}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){'+D+'}}:root[data-theme="dark"]{'+D+'}:root[data-theme="light"]{'+L+'}';
}

/* ---------- Éléments communs ---------- */
function head(t){ var m = ui.msg; ui.msg = ''; return '<div class="bhead"><h2 class="bt">'+t+'</h2><div class="mnav"><button type="button" data-a="m-" aria-label="Mois précédent">‹</button><b>'+ml(ui.m)+'</b><button type="button" data-a="m+" aria-label="Mois suivant">›</button></div></div>'+(m?'<div class="banner">'+esc(m)+'</div>':''); }
function chip(c){ return '<span class="chip"><i style="background:'+esc(c.c)+'"></i>'+esc(c.n)+'</span>'; }
function bar(v, max, over){ var p = max>0 ? Math.min(100, v/max*100) : (v>0?100:0); return '<div class="prog"><i class="'+(over?'over':'')+'" style="width:'+p.toFixed(1)+'%"></i></div>'; }

/* ---------- Synthèse ---------- */
function rSynth(){
  var P = $('p-synthese'), c = calc(ui.m), isC = ui.m===CM, left = isC ? dim(ui.m)-now.getDate()+1 : 0, h = head('Synthèse');
  var revT = c.rev+c.revP, eparT = c.epar+c.eparP, depT = c.dep+c.fixP;
  if(!B.ops.length && !B.rec.length) h += '<div class="banner">Pour démarrer : saisis tes revenus et tes frais fixes dans « Prévisions », puis ajoute ou importe tes opérations dans « Opérations ».</div>';
  h += '<div class="card"><div class="tiles t4 num">'
    + '<div class="tile main"><small>Reste à dépenser</small><strong>'+eur0(c.reste)+'</strong><span>'+(isC && left>0 ? eur0(c.reste/left)+' par jour sur '+left+' j' : 'revenus − dépenses − épargne')+'</span></div>'
    + '<div class="tile"><small>Revenus</small><strong>'+eur0(revT)+'</strong><span>'+(c.revP>0 ? 'dont '+eur0(c.revP)+' à venir' : 'encaissés')+'</span></div>'
    + '<div class="tile"><small>Dépenses</small><strong>'+eur0(depT)+'</strong><span>'+(c.fixP>0 ? 'dont '+eur0(c.fixP)+' de fixes à venir' : eur0(c.fixR)+' de frais fixes')+'</span></div>'
    + '<div class="tile"><small>Épargne</small><strong>'+eur0(eparT)+'</strong><span>'+(revT>0 ? nf0.format(eparT/revT*100)+' % des revenus' : 'du mois')+'</span></div></div>'
    + (c.env>0 ? '<p class="hint num" style="margin:12px 0 0">Après tes enveloppes encore disponibles ('+eur0(c.env)+'), il reste <b>'+eur0(c.reste-c.env)+'</b> non affectés.</p>' : '')+'</div>';
  // Alertes
  var al = [];
  B.cats.forEach(function(k){ var pv = c.prev[k.id]||0, sp = c.by[k.id]||0; if(k.t==='d' && pv>0 && sp-pv>Math.max(1,pv*0.02)) al.push('<b>'+esc(k.n)+'</b> dépasse le prévu de '+eur0(sp-pv)); });
  if(c.reste<0) al.push('Le mois finit <b>à découvert de '+eur0(-c.reste)+'</b> si rien ne change');
  if(isC) c.pend.forEach(function(r){ var d = Math.min(r.d||1, dim(ui.m)), dd = d-now.getDate(); if(dd>=0 && dd<=7 && cat(r.c).t!=='r') al.push('<b>'+esc(r.l)+'</b> ('+eur0(r.a)+') '+(dd===0?'aujourd\'hui':'dans '+dd+' j')); });
  if(c.np) al.push(c.np+' opération'+(c.np>1?'s':'')+' à pointer');
  if(c.nc) al.push(c.nc+' opération'+(c.nc>1?'s':'')+' non classée'+(c.nc>1?'s':''));
  if(al.length) h += '<div class="card"><h2>À surveiller</h2><ul class="alist">'+al.map(function(x){ return '<li>'+x+'</li>'; }).join('')+'</ul></div>';
  h += '<div class="bcols"><div class="col">';
  // Catégories
  var rows = B.cats.filter(function(k){ return (k.t==='d'||k.t==='e') && ((c.by[k.id]||0)>0 || (c.prev[k.id]||0)>0); }).map(function(k){ return [k, c.by[k.id]||0, c.prev[k.id]||0]; });
  if(c.by['']) rows.push([NC, c.by[''], 0]);
  rows.sort(function(a,b){ return b[1]-a[1]; });
  h += '<div class="card"><h2>Par catégorie</h2>'+(rows.length ? rows.map(function(r){ var over = r[2]>0 && r[1]-r[2]>Math.max(1,r[2]*0.02); return '<div class="crow" data-a="cat" data-id="'+esc(r[0].id)+'"><div class="top"><span><i class="dot r" style="background:'+esc(r[0].c)+'"></i>'+esc(r[0].n)+'</span><span class="num"><b>'+eur0(r[1])+'</b>'+(r[2]>0?' / '+eur0(r[2]):'')+'</span></div>'+bar(r[1], r[2]||r[1], over)+'</div>'; }).join('') : '<p class="hint">Aucune dépense ce mois-ci.</p>')+'<p class="hint" style="margin:10px 0 0">Dépensé / prévu (frais fixes + enveloppe). Touche une ligne pour voir ses opérations.</p></div>';
  // 50/30/20
  if(revT>0){
    var nb = {b:0,v:0}; B.cats.forEach(function(k){ if(k.t==='d') nb[k.k==='b'?'b':'v'] += (c.by[k.id]||0); }); nb.v += c.by['']||0;
    c.pend.forEach(function(r){ var k = cat(r.c); if(k.t==='d') nb[k.k==='b'?'b':'v'] += r.a; });
    var R = [['Besoins',nb.b,50,true],['Envies',nb.v,30,true],['Épargne',eparT,20,false]];
    h += '<div class="card"><h2>Règle 50 / 30 / 20</h2>'+R.map(function(x){ var p = x[1]/revT*100, bad = x[3] ? p>x[2]+0.5 : p<x[2]-0.5; return '<div class="crow" style="cursor:default"><div class="top"><span>'+x[0]+' <span class="hint">repère '+x[2]+' %</span></span><span class="num"><b>'+nf0.format(p)+' %</b> · '+eur0(x[1])+'</span></div>'+bar(p, 100, bad)+'</div>'; }).join('')+'<p class="hint" style="margin:10px 0 0">Part de tes revenus du mois. Repère courant : 50 % pour les besoins, 30 % pour les envies, 20 % pour l\'épargne. La nature de chaque catégorie se règle dans Réglages.</p></div>';
  }
  h += '</div><div class="col">';
  // 12 mois
  var S12 = [], mx = 1, tot = {r:0,d:0,e:0};
  for(var i=11;i>=0;i--){ var m = im(mi(ui.m)-i), x = calc(m); S12.push([m, x.rev, x.dep, x.epar]); mx = Math.max(mx, x.rev, x.dep+x.epar); tot.r += x.rev; tot.d += x.dep; tot.e += x.epar; }
  var W = 600, H = 190, bw = W/12, sv = '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block" role="img" aria-label="Revenus et dépenses sur 12 mois">';
  S12.forEach(function(s,j){ var x0 = j*bw+6, w = (bw-14)/2, y = function(v){ return (H-22)*(1-v/mx); };
    sv += '<rect x="'+x0+'" y="'+y(s[1])+'" width="'+w+'" height="'+((H-22)-y(s[1]))+'" rx="3" fill="var(--accent)"/>'
       + '<rect x="'+(x0+w+2)+'" y="'+y(s[2])+'" width="'+w+'" height="'+((H-22)-y(s[2]))+'" rx="3" fill="var(--tax)"/>'
       + (s[3]>0 ? '<rect x="'+(x0+w+2)+'" y="'+y(s[2]+s[3])+'" width="'+w+'" height="'+(y(s[2])-y(s[2]+s[3]))+'" rx="3" fill="var(--senior)"/>' : '')
       + '<text x="'+(x0+w)+'" y="'+(H-6)+'" text-anchor="middle" style="font-size:11px;fill:var(--muted);font-family:var(--font-body)'+(s[0]===ui.m?';font-weight:700;fill:var(--ink)':'')+'">'+MO[+s[0].slice(5,7)-1].slice(0,3)+'</text>'; });
  h += '<div class="card"><h2>Sur 12 mois</h2>'+sv+'</svg><div class="legend" style="margin-top:8px"><span><i class="dot" style="background:var(--accent)"></i>Revenus <b>'+eur0(tot.r)+'</b></span><span><i class="dot" style="background:var(--tax)"></i>Dépenses <b>'+eur0(tot.d)+'</b></span><span><i class="dot" style="background:var(--senior)"></i>Épargne <b>'+eur0(tot.e)+'</b></span></div><p class="hint num" style="margin:8px 0 0">Solde des 12 mois : <b>'+sg(tot.r-tot.d-tot.e)+'</b>, d\'après les opérations saisies.</p></div>';
  // Comptes
  h += '<div class="card"><h2>Comptes</h2><div class="scroll"><table class="tbl"><thead><tr><th>Compte</th><th>Solde</th><th>Solde pointé</th></tr></thead><tbody>'+B.acc.map(function(a){ var b = bal(a.id); return '<tr><td class="k">'+esc(a.n)+'</td><td class="after">'+eur(b.all)+'</td><td>'+eur(b.ok)+'</td></tr>'; }).join('')+'</tbody></table></div><p class="hint" style="margin:8px 0 0">Le solde pointé doit correspondre à celui affiché par ta banque.</p></div>';
  // Objectifs
  if(B.goals.length) h += '<div class="card"><h2>Objectifs d\'épargne</h2>'+B.goals.map(function(g){ return '<div class="crow" style="cursor:default"><div class="top"><span>'+esc(g.n||'Objectif')+'</span><span class="num"><b>'+eur0(g.saved||0)+'</b> / '+eur0(g.target||0)+'</span></div>'+bar(g.saved||0, g.target||0)+'</div>'; }).join('')+'</div>';
  // Tags
  var tg = {}; B.ops.forEach(function(o){ if(o.d.slice(0,7)===ui.m && typ(o)!=='x') (o.t||[]).forEach(function(t){ tg[t] = (tg[t]||0) + o.a; }); });
  var tk = Object.keys(tg).sort(function(a,b){ return tg[a]-tg[b]; });
  if(tk.length) h += '<div class="card"><h2>Par tag</h2>'+tk.map(function(t){ return '<div class="brow" data-a="tag" data-id="'+esc(t)+'" style="cursor:pointer"><span class="chip">#'+esc(t)+'</span><span style="flex:1"></span><span class="am num'+(tg[t]>0?' pos':'')+'">'+sg(tg[t])+'</span></div>'; }).join('')+'</div>';
  P.innerHTML = h+'</div></div>';
}

/* ---------- Opérations ---------- */
function filt(){
  var q = ui.q.toLowerCase();
  return B.ops.filter(function(o){
    if(o.d.slice(0,7)!==ui.m) return false;
    if(ui.fc==='-' ? o.c : (ui.fc && o.c!==ui.fc)) return false;
    if(ui.ft && (o.t||[]).indexOf(ui.ft)<0) return false;
    if(ui.fa && o.acc!==ui.fa) return false;
    if(ui.fs==='np' && o.ok) return false; if(ui.fs==='ok' && !o.ok) return false;
    if(q && (o.l+' '+(o.t||[]).join(' ')+' '+(o.n||'')+' '+cat(o.c).n).toLowerCase().indexOf(q)<0) return false;
    return true;
  }).sort(function(a,b){ return a.d<b.d ? 1 : a.d>b.d ? -1 : 0; });
}
function rOps(){
  var tags = allTags();
  $('p-operations').innerHTML = head('Opérations')
    + '<div class="card"><div class="row tb"><input class="fi" data-f="q" type="search" placeholder="Rechercher un libellé, un tag, une note" value="'+esc(ui.q)+'" aria-label="Rechercher">'
    + sel([['','Toutes les catégories'],['-','Non classées']].concat(B.cats.map(function(c){ return [c.id,c.n]; })), ui.fc, 'data-f="fc" aria-label="Catégorie"')
    + (tags.length ? sel([['','Tous les tags']].concat(tags.map(function(t){ return [t,'#'+t]; })), ui.ft, 'data-f="ft" aria-label="Tag"') : '')
    + (B.acc.length>1 ? sel([['','Tous les comptes']].concat(accOpts()), ui.fa, 'data-f="fa" aria-label="Compte"') : '')
    + sel([['','Pointées ou non'],['np','À pointer'],['ok','Pointées']], ui.fs, 'data-f="fs" aria-label="État"')
    + '</div><div class="row" style="margin-top:10px"><button type="button" class="btn primary" data-a="new">+ Opération</button><button type="button" class="btn" data-a="imp">Importer un relevé</button><button type="button" class="btn" data-a="allpt">Tout pointer</button></div>'
    + '<input type="file" id="bFile" hidden accept=".csv,.tsv,.txt,.ofx,.qfx,.qif,.pdf"></div><div id="bEd"></div><div id="bImp"></div><div class="card"><p class="hint num" id="bSum" style="margin:0 0 6px"></p><div id="bList"></div></div>';
  rEd(); rImp(); rList();
}
function rList(){
  var L = filt(), tot = 0, np = 0, h = '', noF = !ui.q && !ui.fc && !ui.ft && !ui.fs;
  if(noF) calc(ui.m).pend.filter(function(r){ return !ui.fa || r.acc===ui.fa; }).forEach(function(r){ var k = cat(r.c), pos = k.t==='r';
    h += '<div class="brow pend"><span class="chk"></span><div class="bl" style="cursor:default"><b>'+esc(r.l||'Sans libellé')+'</b><small>prévu le '+Math.min(r.d||1,dim(ui.m))+' '+chip(k)+'</small></div><span class="am num'+(pos?' pos':'')+'">'+sg(pos?r.a:-r.a)+'</span><button type="button" class="btn" data-a="val" data-id="'+esc(r.id)+'">Valider</button></div>'; });
  L.forEach(function(o){ tot += o.a; if(!o.ok) np++;
    h += '<div class="brow'+(o.ok?' ok':'')+'" data-id="'+esc(o.id)+'"><input type="checkbox" data-a="pt"'+(o.ok?' checked':'')+' aria-label="Pointer"><div class="bl" data-a="ed"><b>'+esc(o.l)+'</b><small>'+o.d.slice(8)+'/'+o.d.slice(5,7)+' '+chip(cat(o.c))+(o.r?'<span class="chip">fixe</span>':'')+(o.t||[]).map(function(t){ return '<span class="chip">#'+esc(t)+'</span>'; }).join('')+(B.acc.length>1?' '+esc(accN(o.acc)):'')+(o.n?' · '+esc(o.n):'')+'</small></div><span class="am num'+(o.a>0?' pos':'')+'">'+sg(o.a)+'</span></div>'; });
  $('bList').innerHTML = h || '<p class="hint">Aucune opération pour ce mois avec ces filtres.</p>';
  var b = bal(ui.fa||'');
  $('bSum').innerHTML = L.length+' opération'+(L.length>1?'s':'')+' · total <b>'+sg(tot)+'</b> · '+np+' à pointer · solde '+(ui.fa?esc(accN(ui.fa)):'tous comptes')+' <b>'+eur(b.all)+'</b>, pointé <b>'+eur(b.ok)+'</b>';
}
function rEd(){
  var e = ui.edit, el = $('bEd'); if(!el) return; if(!e){ el.innerHTML = ''; return; }
  el.innerHTML = '<div class="card"><h2>'+(e.id?'Modifier l\'opération':'Nouvelle opération')+'</h2><div class="bform">'
    + '<label>Date<input type="date" class="fi" id="e_d" value="'+esc(e.d)+'"></label><label>Libellé<input class="fi" id="e_l" value="'+esc(e.l)+'" autocomplete="off"></label>'
    + '<label>Montant<input class="fi" id="e_a" inputmode="decimal" value="'+(e.a?nfE.format(Math.abs(e.a)).replace(/[  ]/g,''):'')+'" autocomplete="off"></label><label>Sens'+sel([['d','Dépense (sortie)'],['r','Revenu (entrée)']], e.a>0?'r':'d', 'id="e_s"')+'</label>'
    + '<label>Catégorie'+sel(catOpts(), e.c, 'id="e_c"')+'</label><label>Compte'+sel(accOpts(), e.acc, 'id="e_acc"')+'</label>'
    + '<label>Tags, séparés par des virgules<input class="fi" id="e_t" value="'+esc((e.t||[]).join(', '))+'" placeholder="vacances, noël" autocomplete="off"></label><label>Note<input class="fi" id="e_n" value="'+esc(e.n||'')+'" autocomplete="off"></label></div>'
    + '<label class="ck"><input type="checkbox" id="e_ok"'+(e.ok?' checked':'')+'> Opération pointée (vue sur le relevé de la banque)</label>'
    + '<label class="ck"><input type="checkbox" id="e_rule"> Classer toujours ainsi les libellés contenant <input class="fi" id="e_kw" style="width:170px" value="'+esc(String(e.l||'').split(/\s+/).slice(0,2).join(' ').toLowerCase())+'" aria-label="Mot-clé"></label>'
    + '<div class="row" style="margin-top:8px"><button type="button" class="btn primary" data-a="save">Enregistrer</button><button type="button" class="btn" data-a="cancel">Annuler</button>'+(e.id?'<button type="button" class="btn" data-a="del">Supprimer</button>':'')+'</div></div>';
  if(el.scrollIntoView) el.scrollIntoView({block:'nearest'});
}
function rImp(){
  var I = ui.imp, el = $('bImp'); if(!el) return; if(!I){ el.innerHTML = ''; return; }
  var L = impOps(I), seen = {}, dup = 0; B.ops.forEach(function(o){ seen[keyOf(o)] = 1; }); L.forEach(function(o){ if(seen[keyOf(o)]) dup++; });
  var h = '<div class="card"><h2>Importer « '+esc(I.name)+' »</h2>';
  if(I.kind==='csv'){ var cols = [[-1,'Aucune']].concat(I.head.map(function(x,i){ return [i,x]; })), F = function(k,t){ return '<label>'+t+sel(cols, I.map[k], 'data-i="'+k+'"')+'</label>'; };
    h += '<p class="lead">Vérifie que chaque rôle pointe sur la bonne colonne du fichier.</p><div class="bform">'+F('d','Date')+F('l','Libellé')+F('a','Montant (une seule colonne)')+F('db','Débit')+F('cr','Crédit')+'</div>'; }
  h += '<div class="bform"><label>Compte'+sel(accOpts(), I.acc, 'data-i="acc"')+'</label></div><label class="ck"><input type="checkbox" data-i="ok"'+(I.ok?' checked':'')+'> Marquer ces opérations comme pointées (elles viennent de la banque)</label><label class="ck"><input type="checkbox" data-i="inv"'+(I.inv?' checked':'')+'> Inverser le signe (si les dépenses apparaissent en positif)</label>';
  h += '<p class="num"><b>'+(L.length-dup)+'</b> opération'+(L.length-dup>1?'s':'')+' à importer'+(dup?', '+dup+' déjà présente'+(dup>1?'s':'')+' ignorée'+(dup>1?'s':''):'')+'.</p>';
  if(L.length) h += '<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th style="text-align:left">Libellé</th><th>Montant</th></tr></thead><tbody>'+L.slice(0,5).map(function(o){ return '<tr><td class="k">'+o.d.split('-').reverse().join('/')+'</td><td class="l" style="white-space:normal">'+esc(o.l)+'</td><td class="after">'+sg(o.a)+'</td></tr>'; }).join('')+'</tbody></table></div><p class="hint">Aperçu des 5 premières lignes.</p>';
  else h += '<div class="banner">Aucune opération lisible avec ce réglage. Change les colonnes ci-dessus.</div>';
  el.innerHTML = h+'<div class="row" style="margin-top:8px"><button type="button" class="btn primary" data-a="doimp"'+(L.length-dup>0?'':' disabled')+'>Importer</button><button type="button" class="btn" data-a="noimp">Annuler</button></div></div>';
}
function readFile(f){
  if(/\.pdf$/i.test(f.name)){ ui.msg = 'Les relevés PDF ne sont pas pris en charge : leur mise en page change d\'une banque à l\'autre. Télécharge le relevé au format CSV, OFX ou QIF depuis le site de ta banque.'; rOps(); return; }
  var rd = new FileReader();
  rd.onload = function(){ var txt; try{ txt = new TextDecoder('utf-8').decode(rd.result); if(txt.indexOf('�')>=0) txt = new TextDecoder('windows-1252').decode(rd.result); }catch(e){ txt = ''; }
    var I = parseFile(f.name, txt); I.name = f.name; I.acc = ui.fa || B.acc[0].id; I.ok = true; I.inv = false; ui.imp = I; ui.edit = null; rEd(); rImp(); var el = $('bImp'); if(el.scrollIntoView) el.scrollIntoView({block:'nearest'}); };
  rd.readAsArrayBuffer(f);
}

/* ---------- Prévisions ---------- */
function recRow(r){ return '<div class="erow" data-arr="rec" data-id="'+esc(r.id)+'"><input class="fi" style="flex:3 1 160px" data-k="l" value="'+esc(r.l||'')+'" placeholder="Libellé" aria-label="Libellé"><input class="fi num" style="flex:1 1 90px" data-k="a" inputmode="decimal" value="'+(r.a?nfE.format(r.a).replace(/[  ]/g,''):'')+'" placeholder="Montant" aria-label="Montant">'
  + sel(catOpts('Catégorie'), r.c, 'data-k="c" style="flex:2 1 150px" aria-label="Catégorie"')+sel(FREQ, r.f||1, 'data-k="f" style="flex:2 1 140px" aria-label="Fréquence"')
  + '<input class="fi" style="flex:0 1 70px" data-k="d" inputmode="numeric" value="'+esc(r.d||1)+'" aria-label="Jour du mois" title="Jour du mois"><input class="fi" type="month" style="flex:1 1 130px" data-k="s" value="'+esc(r.s||'')+'" aria-label="Premier mois" title="Premier mois"><input class="fi" type="month" style="flex:1 1 130px" data-k="e" value="'+esc(r.e||'')+'" aria-label="Dernier mois (facultatif)" title="Dernier mois (facultatif)">'
  + (B.acc.length>1 ? sel(accOpts(), r.acc, 'data-k="acc" style="flex:1 1 130px" aria-label="Compte"') : '')+'<button type="button" class="del" data-a="rm" aria-label="Supprimer">×</button></div>'; }
function prevSum(){
  var rv = 0, fx = 0, ep = 0, prov = 0, env = 0;
  recFor(ui.m).forEach(function(r){ var t = cat(r.c).t; if(t==='r') rv += r.a; else if(t==='e') ep += r.a; else if(t==='d') fx += r.a; });
  B.rec.forEach(function(r){ if(r.a>0 && (r.f||1)>1 && r.s && r.s<=ui.m && (!r.e||r.e>=ui.m) && cat(r.c).t==='d') prov += r.a/r.f; });
  B.cats.forEach(function(c){ if(c.t==='d') env += +c.bud||0; });
  var rav = rv-fx-ep, L = function(a,b,c){ return '<tr'+(c?' class="final"':'')+'><td class="k">'+a+'</td><td class="after">'+b+'</td></tr>'; };
  $('bPSum').innerHTML = '<div class="scroll"><table class="tbl">'+L('Revenus récurrents', eur0(rv))+L('Frais fixes', '−'+eur0(fx))+L('Épargne programmée', '−'+eur0(ep))+L('Reste à vivre', eur0(rav), 1)+L('Enveloppes de dépenses', '−'+eur0(env))+L('Non affecté', eur0(rav-env), 1)+'</table></div>'
    + (prov>0 ? '<p class="hint num" style="margin:10px 0 0">Tes charges non mensuelles représentent <b>'+eur0(prov)+' par mois</b> en moyenne : mets cette somme de côté chaque mois pour les absorber sans à-coup.</p>' : '')
    + (rav-env<0 ? '<div class="banner" style="margin:12px 0 0">Tes enveloppes dépassent ton reste à vivre de '+eur0(env-rav)+'.</div>' : '');
}
function rPrev(){
  var G = {r:[],d:[],e:[]}; B.rec.forEach(function(r){ var t = cat(r.c).t; (G[t==='r'?'r':t==='e'?'e':'d']).push(r); });
  var sal = A.salary(), blk = function(t, list, a, lbl){ return '<div class="card"><h2>'+t+'</h2><div class="list">'+(list.length ? list.map(recRow).join('') : '<p class="hint">Rien pour l\'instant.</p>')+'</div><button type="button" class="btn primary" data-a="'+a+'" style="margin-top:12px">'+lbl+'</button></div>'; };
  var avg = {}; for(var i=1;i<=3;i++){ var x = calc(im(mi(CM)-i)); Object.keys(x.vr).forEach(function(k){ avg[k] = (avg[k]||0) + x.vr[k]/3; }); }
  $('p-previsions').innerHTML = head('Prévisions')
    + '<div class="bcols"><div class="col"><div class="card"><h2>Reste pour '+ml(ui.m)+'</h2><div id="bPSum"></div></div>'
    + (sal && sal.net>0 ? '<div class="card"><h2>Depuis l\'onglet Salaire</h2><p class="lead num">Net après impôt calculé : <b>'+eur0(sal.net)+'</b> par mois'+(sal.prime>0?', prime de Noël nette : <b>'+eur0(sal.prime)+'</b> en décembre':'')+'.</p><button type="button" class="btn" data-a="sal">Créer ou mettre à jour le revenu « Salaire »</button></div>' : '')
    + '<div class="card"><h2>Enveloppes de dépenses</h2><p class="lead">Le montant que tu t\'autorises chaque mois pour les dépenses variables de chaque catégorie, en plus des frais fixes.</p><div class="list">'
    + B.cats.filter(function(c){ return c.t==='d'; }).map(function(c){ return '<div class="erow" data-arr="cats" data-id="'+esc(c.id)+'"><span style="flex:3 1 150px"><i class="dot r" style="background:'+esc(c.c)+'"></i>'+esc(c.n)+(avg[c.id]>0.5?'<small class="hint num" style="display:block">moyenne des 3 derniers mois : '+eur0(avg[c.id])+'</small>':'')+'</span><input class="fi num" style="flex:1 1 100px" data-k="bud" inputmode="decimal" value="'+(c.bud?nf0.format(c.bud).replace(/[  ]/g,''):'')+'" placeholder="0" aria-label="Enveloppe pour '+esc(c.n)+'"></div>'; }).join('')+'</div></div></div>'
    + '<div class="col">'+blk('Revenus récurrents', G.r, 'addr', '+ Ajouter un revenu')+blk('Frais fixes', G.d, 'addd', '+ Ajouter un frais fixe')+blk('Épargne programmée', G.e, 'adde', '+ Ajouter un versement')
    + '<div class="card"><h2>Objectifs d\'épargne</h2><div class="list">'+(B.goals.length ? B.goals.map(function(g){ var left = Math.max(0,(g.target||0)-(g.saved||0)), n = g.due ? mi(g.due)-mi(CM) : 0;
        return '<div class="erow" data-arr="goals" data-id="'+esc(g.id)+'"><input class="fi" style="flex:3 1 150px" data-k="n" value="'+esc(g.n||'')+'" placeholder="Objectif" aria-label="Objectif"><input class="fi num" style="flex:1 1 90px" data-k="target" inputmode="decimal" value="'+esc(g.target||'')+'" placeholder="Cible" aria-label="Montant cible"><input class="fi num" style="flex:1 1 90px" data-k="saved" inputmode="decimal" value="'+esc(g.saved||'')+'" placeholder="Déjà épargné" aria-label="Déjà épargné"><input class="fi" type="month" style="flex:1 1 130px" data-k="due" value="'+esc(g.due||'')+'" aria-label="Échéance" title="Échéance"><button type="button" class="del" data-a="rm" aria-label="Supprimer">×</button>'+(left>0 && n>0 ? '<span class="hint num eq">'+eur0(left/n)+' par mois pendant '+n+' mois pour y arriver</span>' : '')+'</div>'; }).join('') : '<p class="hint">Aucun objectif.</p>')+'</div><button type="button" class="btn primary" data-a="addg" style="margin-top:12px">+ Ajouter un objectif</button></div></div></div>';
  prevSum();
}

/* ---------- Réglages du budget ---------- */
function rSet(){
  var el = $('bSettings'); if(!el) return; var th = A.S.theme || {};
  el.innerHTML = '<div class="grid" style="margin-top:20px"><div class="col">'
    + '<div class="card"><h2>Couleurs du thème</h2><div class="fields"><div class="sw">'+['','#0d7a5c','#2f5fc4','#8a4fd0','#c2325a','#b4571a','#1a8fa8','#3c4a57'].map(function(c){ return '<button type="button" data-a="acc" data-id="'+c+'" aria-pressed="'+((th.accent||'')===c)+'" style="background:'+(c||'conic-gradient(#0d7a5c,#2f5fc4,#c2325a,#d08a00,#0d7a5c)')+'" aria-label="'+(c?'Couleur '+c:'Couleur d\'origine')+'" title="'+(c||'Couleur d\'origine')+'"></button>'; }).join('')+'<input type="color" class="fi" data-t="accent" value="'+esc(th.accent||'#0d7a5c')+'" aria-label="Couleur personnalisée"></div>'
    + '<div class="seg" role="group" aria-label="Mode d\'affichage">'+[['auto','Automatique'],['light','Clair'],['dark','Sombre']].map(function(m){ return '<button type="button" data-a="mode" data-id="'+m[0]+'" aria-pressed="'+((th.mode||'auto')===m[0])+'">'+m[1]+'</button>'; }).join('')+'</div></div></div>'
    + '<div class="card"><h2>Comptes</h2><div class="list">'+B.acc.map(function(a){ return '<div class="erow" data-arr="acc" data-id="'+esc(a.id)+'"><input class="fi" style="flex:3 1 150px" data-k="n" value="'+esc(a.n)+'" aria-label="Nom du compte"><input class="fi num" style="flex:1 1 110px" data-k="init" inputmode="decimal" value="'+esc(a.init||'')+'" placeholder="Solde de départ" aria-label="Solde de départ" title="Solde avant la première opération saisie"><button type="button" class="del" data-a="rm" aria-label="Supprimer">×</button></div>'; }).join('')+'</div><p class="hint">Solde de départ : celui du compte juste avant ta première opération saisie.</p><button type="button" class="btn primary" data-a="adda" style="margin-top:6px">+ Ajouter un compte</button></div>'
    + '<div class="card"><h2>Classement automatique</h2><p class="lead">Quand un libellé contient le mot-clé, l\'opération prend la catégorie indiquée, à la saisie comme à l\'import.</p><div class="list">'+(B.rules.length ? B.rules.map(function(r){ return '<div class="erow" data-arr="rules" data-id="'+esc(r.id)+'"><input class="fi" style="flex:2 1 140px" data-k="kw" value="'+esc(r.kw||'')+'" placeholder="Mot-clé" aria-label="Mot-clé">'+sel(catOpts('Catégorie'), r.c, 'data-k="c" style="flex:2 1 150px" aria-label="Catégorie"')+'<button type="button" class="del" data-a="rm" aria-label="Supprimer">×</button></div>'; }).join('') : '<p class="hint">Aucune règle.</p>')+'</div><div class="row" style="margin-top:12px"><button type="button" class="btn primary" data-a="addrule">+ Ajouter une règle</button><button type="button" class="btn" data-a="rerule">Appliquer aux opérations non classées</button></div></div>'
    + '<div class="card"><h2>Données</h2><p class="lead">Tout est enregistré sur cet appareil. L\'export contient le salaire et le budget.</p><div class="row"><button type="button" class="btn primary" data-a="xjson">Exporter tout en .json</button><button type="button" class="btn" data-a="ijson">Importer un .json</button><button type="button" class="btn" data-a="xcsv">Exporter les opérations en .csv</button></div><input type="file" id="bJson" hidden accept=".json,application/json"><p class="hint" id="bXMsg"></p><button type="button" class="link" data-a="wipe">Effacer tout le budget</button></div>'
    + '</div><div class="col"><div class="card"><h2>Catégories</h2><p class="lead">Nom, type et nature (pour la règle 50 / 30 / 20). Supprimer une catégorie remet ses opérations en « Non classé ».</p><div class="list">'
    + B.cats.map(function(c){ return '<div class="erow" data-arr="cats" data-id="'+esc(c.id)+'"><input type="color" class="fi" data-k="c" value="'+esc(c.c)+'" aria-label="Couleur"><input class="fi" style="flex:3 1 140px" data-k="n" value="'+esc(c.n)+'" aria-label="Nom">'+sel(TYPES, c.t, 'data-k="t" style="flex:1 1 120px" aria-label="Type"')+sel(NAT, c.k||'', 'data-k="k" style="flex:1 1 110px" aria-label="Nature"')+'<button type="button" class="del" data-a="rm" aria-label="Supprimer">×</button></div>'; }).join('')
    + '</div><button type="button" class="btn primary" data-a="addc" style="margin-top:12px">+ Ajouter une catégorie</button></div></div></div>';
}
function download(name, txt, mime){
  try{ var u = URL.createObjectURL(new Blob([txt],{type:mime})), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(u); }, 4000); return true; }catch(e){ return false; }
}

/* ---------- Événements ---------- */
var NUMK = {a:1,bud:1,init:1,target:1,saved:1}, cur = 'synthese';
function render(){ if(cur==='synthese') rSynth(); else if(cur==='operations') rOps(); else if(cur==='previsions') rPrev(); else if(cur==='reglages') rSet(); }
function addRec(t){ var c = B.cats.filter(function(k){ return k.t===t; })[0]; B.rec.push({id:uid(), l:'', a:0, c:c?c.id:'', d:1, f:1, s:ui.m, e:'', acc:B.acc[0].id}); save(); rPrev(); }
function onClick(e){
  var b = e.target.closest('[data-a]'); if(!b) return; var a = b.dataset.a, id = b.dataset.id, row = b.closest('[data-id]'), rid = row ? row.dataset.id : id, o;
  if(a==='m-' || a==='m+'){ ui.m = im(mi(ui.m)+(a==='m+'?1:-1)); render(); }
  else if(a==='cat'){ ui.fc = id || '-'; ui.ft = ''; ui.q = ''; A.go('operations'); }
  else if(a==='tag'){ ui.ft = id; ui.fc = ''; ui.q = ''; A.go('operations'); }
  else if(a==='new'){ ui.imp = null; ui.edit = {id:'', d:ui.m===CM?TODAY:ui.m+'-01', l:'', a:0, c:ui.fc&&ui.fc!=='-'?ui.fc:'', acc:ui.fa||B.acc[0].id, t:[], ok:false}; rImp(); rEd(); }
  else if(a==='ed'){ o = B.ops.filter(function(x){ return x.id===rid; })[0]; if(o){ ui.imp = null; ui.edit = JSON.parse(JSON.stringify(o)); rImp(); rEd(); } }
  else if(a==='cancel'){ ui.edit = null; rEd(); }
  else if(a==='del'){ B.ops = B.ops.filter(function(x){ return x.id!==ui.edit.id; }); ui.edit = null; save(); rOps(); }
  else if(a==='save'){
    var amt = Math.abs(num($('e_a').value)), d = $('e_d').value;
    if(!amt || !pDate(d)){ ui.msg = 'Indique une date et un montant.'; rOps(); return; }
    o = {id:ui.edit.id||uid(), d:d, l:$('e_l').value.trim()||'Opération', a:r2($('e_s').value==='r'?amt:-amt), c:$('e_c').value, acc:$('e_acc').value, ok:$('e_ok').checked, n:$('e_n').value.trim(), t:$('e_t').value.split(',').map(function(x){ return x.trim().replace(/^#/,'').toLowerCase(); }).filter(Boolean), r:ui.edit.r||''};
    var kw = $('e_kw').value.trim().toLowerCase();
    if($('e_rule').checked && kw && o.c){ B.rules.push({id:uid(), kw:kw, c:o.c}); B.ops.forEach(function(x){ if(!x.c && x.l.toLowerCase().indexOf(kw)>=0) x.c = o.c; }); }
    if(!o.c) o.c = ruleCat(o.l);
    var ix = -1; B.ops.forEach(function(x,i){ if(x.id===o.id) ix = i; }); if(ix>=0) B.ops[ix] = o; else { autoLink(o); B.ops.push(o); }
    ui.edit = null; ui.m = o.d.slice(0,7); save(); rOps();
  }
  else if(a==='val'){ var r = B.rec.filter(function(x){ return x.id===id; })[0]; if(r){ B.ops.push({id:uid(), d:ui.m+'-'+pad(Math.min(r.d||1, dim(ui.m))), l:r.l||'Opération', a:r2(cat(r.c).t==='r'?r.a:-r.a), c:r.c, acc:r.acc||B.acc[0].id, ok:false, t:[], r:r.id}); save(); rList(); } }
  else if(a==='allpt'){ filt().forEach(function(x){ x.ok = true; }); save(); rList(); }
  else if(a==='imp'){ $('bFile').value = ''; $('bFile').click(); }
  else if(a==='noimp'){ ui.imp = null; rImp(); }
  else if(a==='doimp'){ var res = doImport(ui.imp); ui.imp = null; if(res.last) ui.m = res.last.slice(0,7); ui.msg = res.n+' opération'+(res.n>1?'s':'')+' importée'+(res.n>1?'s':'')+(res.dup?', '+res.dup+' doublon'+(res.dup>1?'s':'')+' ignoré'+(res.dup>1?'s':''):'')+'.'; save(); rOps(); }
  else if(a==='addr') addRec('r'); else if(a==='addd') addRec('d'); else if(a==='adde') addRec('e');
  else if(a==='addg'){ B.goals.push({id:uid(), n:'', target:0, saved:0, due:''}); save(); rPrev(); }
  else if(a==='sal'){ var s = A.salary(), sc = B.cats.filter(function(k){ return k.t==='r'; })[0], up = function(i, l, v, f, st){ var x = B.rec.filter(function(q){ return q.id===i; })[0]; if(!x){ x = {id:i, l:l, c:sc?sc.id:'', d:28, f:f, s:st, e:'', acc:B.acc[0].id}; B.rec.push(x); } x.a = r2(v); };
    up('sal', 'Salaire', s.net, 1, ui.m); if(s.prime>0) up('prime', 'Prime de Noël', s.prime, 12, (CM.slice(5)<='12'?CM.slice(0,4):+CM.slice(0,4)+1)+'-12'); relink(ui.m); ui.msg = 'Revenu « Salaire » mis à jour : '+eur0(s.net)+' par mois.'; save(); rPrev(); }
  else if(a==='rm'){ var arr = row.dataset.arr;
    if(arr==='acc'){ if(B.acc.length<2 || B.ops.some(function(x){ return x.acc===rid; })){ $('bXMsg').textContent = 'Ce compte ne peut pas être supprimé : c\'est le seul, ou il contient des opérations.'; return; } }
    if(arr==='cats'){ B.ops.forEach(function(x){ if(x.c===rid) x.c = ''; }); B.rec.forEach(function(x){ if(x.c===rid) x.c = ''; }); B.rules = B.rules.filter(function(x){ return x.c!==rid; }); }
    if(arr==='rec') B.ops.forEach(function(x){ if(x.r===rid) x.r = ''; });
    B[arr] = B[arr].filter(function(x){ return x.id!==rid; }); save(); render(); }
  else if(a==='addc'){ B.cats.push({id:uid(), n:'Nouvelle catégorie', t:'d', k:'v', c:PAL[B.cats.length%PAL.length], bud:0}); save(); rSet(); }
  else if(a==='adda'){ B.acc.push({id:uid(), n:'Nouveau compte', init:0}); save(); rSet(); }
  else if(a==='addrule'){ B.rules.push({id:uid(), kw:'', c:''}); save(); rSet(); }
  else if(a==='rerule'){ var n = 0; B.ops.forEach(function(x){ if(!x.c){ x.c = ruleCat(x.l); if(x.c) n++; } }); save(); $('bXMsg').textContent = n+' opération'+(n>1?'s':'')+' classée'+(n>1?'s':'')+'.'; }
  else if(a==='acc' || a==='mode'){ A.S.theme = A.S.theme || {}; if(a==='acc') A.S.theme.accent = id; else A.S.theme.mode = id; applyTheme(); save(); rSet(); }
  else if(a==='xjson'){ $('bXMsg').textContent = download('salaire-budget-'+TODAY+'.json', JSON.stringify(A.S, null, 1), 'application/json') ? 'Fichier généré. S\'il n\'apparaît pas dans tes téléchargements, utilise « Copier mes données ».' : 'Téléchargement impossible ici : utilise « Copier mes données ».'; }
  else if(a==='xcsv'){ var q = function(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; };
    download('operations-'+TODAY+'.csv', '﻿'+['Date;Libellé;Montant;Catégorie;Tags;Compte;Pointée;Note'].concat(B.ops.slice().sort(function(x,y){ return x.d<y.d?-1:1; }).map(function(x){ return [x.d, q(x.l), String(x.a).replace('.',','), q(cat(x.c).n), q((x.t||[]).join(' ')), q(accN(x.acc)), x.ok?'oui':'non', q(x.n||'')].join(';'); })).join('\r\n'), 'text/csv'); }
  else if(a==='ijson'){ $('bJson').value = ''; $('bJson').click(); }
  else if(a==='wipe'){ if(b.dataset.sure){ A.S.b = null; init(); save(); render(); } else { b.dataset.sure = 1; b.textContent = 'Confirmer : effacer toutes les opérations, frais fixes et catégories'; } }
}
function onChange(e){
  var t = e.target, f = t.dataset.f, k = t.dataset.k, i = t.dataset.i;
  if(t.id==='bFile'){ if(t.files && t.files[0]) readFile(t.files[0]); return; }
  if(t.id==='bJson'){ if(t.files && t.files[0]){ var rd = new FileReader(); rd.onload = function(){ try{ var o = JSON.parse(rd.result); if(!o || typeof o!=='object') throw 0; A.restore(o); $('bXMsg').textContent = 'Données importées.'; }catch(x){ $('bXMsg').textContent = 'Ce fichier n\'est pas un export valide.'; } }; rd.readAsText(t.files[0]); } return; }
  if(t.dataset.a==='pt'){ var o = B.ops.filter(function(x){ return x.id===t.closest('[data-id]').dataset.id; })[0]; if(o){ o.ok = t.checked; save(); rList(); } return; }
  if(t.dataset.t==='accent'){ A.S.theme = A.S.theme || {}; A.S.theme.accent = t.value; applyTheme(); save(); return; }
  if(f && f!=='q'){ ui[f] = t.value; rList(); return; }
  if(i){ var I = ui.imp; if(!I) return; if(i==='ok' || i==='inv') I[i] = t.checked; else if(i==='acc') I.acc = t.value; else I.map[i] = +t.value; rImp(); return; }
  if(k){ var row = t.closest('[data-id]'), arr = row.dataset.arr, x = B[arr].filter(function(y){ return y.id===row.dataset.id; })[0]; if(!x) return;
    x[k] = NUMK[k] ? (k==='init' ? num(t.value) : Math.abs(num(t.value))) : (k==='f' ? +t.value : k==='d' ? Math.min(31, Math.max(1, Math.round(num(t.value))||1)) : t.value);
    if(arr==='rec') relink(ui.m);
    save();
    if(arr==='rec' || (arr==='cats' && k==='bud')){ if(k==='c') rPrev(); else if($('bPSum')) prevSum(); }
    else if(arr==='goals' || (arr==='cats' && (k==='t'||k==='c'))) render();
  }
}
function onInput(e){ if(e.target.dataset.f==='q'){ ui.q = e.target.value; rList(); } }
function init(){
  B = A.S.b; if(!B || !Array.isArray(B.cats) || !B.cats.length) B = A.S.b = defs();
  ['acc','cats','rec','ops','rules','goals'].forEach(function(k){ if(!Array.isArray(B[k])) B[k] = []; });
  if(!B.acc.length) B.acc.push({id:'a1',n:'Compte courant',init:0});
  ui.edit = null; ui.imp = null; applyTheme();
  if(!wired){ wired = true; ['p-synthese','p-operations','p-previsions','bSettings'].forEach(function(id){ var el = $(id); if(!el) return; el.addEventListener('click', onClick); el.addEventListener('change', onChange); el.addEventListener('input', onInput); }); }
  render();
}
window.BUDGET = {init:init, show:function(t){ cur = t; if(B) render(); }, _t:{pDate:pDate, pAmt:pAmt, parseFile:parseFile, impOps:impOps, doImport:doImport, calc:calc, get B(){ return B; }, ui:ui}};
cur = A.tab(); init();
})();
