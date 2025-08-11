/* app.js — with book_cost.json import
 * - Loads characters.json & book_cost.json
 * - Level costs inline
 * - Day/Region → talent book series mapping (icon rules)
 * - Card: element + series badge + 3 tier icons (가르침/인도/철학)
 * - Totals: base rows (모라/경험치/보라책) + series-by-tier rows with icons
 */

// ------------------------------
// 0) Utils
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const fmt = n => (n||0).toLocaleString('ko-KR');

async function fetchJSON(url){
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

// ------------------------------
// 1) external data sources
const CHARACTERS_URL = 'characters.json';
const BOOK_COST_URL  = 'book_cost.json';
let CHARACTERS = [];   // normalized characters
let TALENT_COSTS = []; // steps: [{from,to,book_low,book_mid,book_high,mora,crown}]

// ------------------------------
// 2) Day/Region normalization & series mapping
const DAY_ALIAS = { mon:'mon', monday:'mon', m:'mon',
                    tue:'tue', tuesday:'tue', t:'tue',
                    wed:'wed', wednesday:'wed', wen:'wed', w:'wed',
                    thu:'thu', thursday:'thu', th:'thu',
                    fri:'fri', friday:'fri', f:'fri',
                    sat:'sat', saturday:'sat', s:'sat',
                    sun:'sun', sunday:'sun' };
const REGION_ALIAS = { mond:'mond', mondstadt:'mond',
                       liyue:'liyue',
                       inazma:'inazuma', inazuma:'inazuma',
                       sumeru:'sumeru',
                       fontaine:'fontaine',
                       natlan:'natlan' };

// Region × Day → Series key + label
const TALENT_BOOKS = {
  mond: {
    mon: { key:'freedom',    name_kr:'자유' },
    tue: { key:'resistance', name_kr:'투쟁' },
    wed: { key:'ballad',     name_kr:'시' }
  },
  liyue: {
    mon: { key:'prosperity', name_kr:'번영' },
    tue: { key:'diligence',  name_kr:'근면' },
    wed: { key:'gold',       name_kr:'황금' }
  },
  inazuma: {
    mon: { key:'transience', name_kr:'부세' },
    tue: { key:'elegance',   name_kr:'풍아' },
    wed: { key:'light',      name_kr:'천광' }
  },
  sumeru: {
    mon: { key:'admonition', name_kr:'훈계' },
    tue: { key:'ingenuity',  name_kr:'창의' },
    wed: { key:'praxis',     name_kr:'실천' }
  },
  fontaine: {
    mon: { key:'equity',     name_kr:'공정' },
    tue: { key:'judgment',   name_kr:'심판' },
    wed: { key:'order',      name_kr:'질서' }
  },
  natlan: {
    mon: { key:'conflict',   name_kr:'(예시1)' },
    tue: { key:'war',        name_kr:'(예시2)' },
    wed: { key:'rule',       name_kr:'(예시3)' }
  }
};

// Icon path rules
const IMAGE_SERIES       = (region, seriesKey) => `images/books/${region}_${seriesKey}.png`;
const IMAGE_SERIES_TIER  = (region, seriesKey, tierKey) => `images/books/${region}_${seriesKey}_${tierKey}.png`;
const ICON_MORA          = 'images/icons/mora.png';
const ICON_XP            = 'images/icons/xp.png';
const ICON_HEROWIT       = ['images/icons/herowit.png','images/icons/hero_wit.png','images/icons/exp_book_purple.png','images/icons/exp_book.png'];
const ICON_CROWN         = 'images/icons/crown.png';

// ------------------------------
// 3) Level cost (segment totals)
const LEVEL_COSTS = [
  { from_level:1,  to_level:20, total_xp:120175,  total_mora: 28000,  hero_wit:  7 },
  { from_level:20, to_level:40, total_xp:578325,  total_mora:112000,  hero_wit: 28 },
  { from_level:40, to_level:50, total_xp:573100,  total_mora:116000,  hero_wit: 29 },
  { from_level:50, to_level:60, total_xp:859525,  total_mora:172000,  hero_wit: 43 },
  { from_level:60, to_level:70, total_xp:1196525, total_mora:240000,  hero_wit: 60 },
  { from_level:70, to_level:80, total_xp:1611875, total_mora:320000,  hero_wit: 80 },
  { from_level:80, to_level:90, total_xp:3423125, total_mora:688000,  hero_wit:172 },
];
const LEVEL_ANCHORS = [1,20,40,50,60,70,80,90];

// ------------------------------
// 4) State & DOM
const appState = { list: [] };

const dl       = $('#char-list');
const search   = $('#search');
const btnAdd   = $('#btn-add');
const btnClear = $('#btn-clear');
const cards    = $('#cards');
const empty    = $('#empty');

const sumMoraEl  = $('#sum-mora');
const sumExpEl   = $('#sum-exp');
const sumBooksEl = $('#sum-talent-books');

// ------------------------------
// 5) Data load & normalize
async function loadData(){
  const [rawChars, bookCost] = await Promise.all([
    fetchJSON(CHARACTERS_URL),
    fetchJSON(BOOK_COST_URL)
  ]);

  // Normalize characters + attach series info
  CHARACTERS = rawChars.map(c => {
    const regionRaw = (c.region||'').toString().trim().toLowerCase();
    const dayRaw    = (c.day||'').toString().trim().toLowerCase();
    const region    = REGION_ALIAS[regionRaw] || regionRaw || '';
    const day       = DAY_ALIAS[dayRaw] || dayRaw || '';

    let book = null;
    if (region && day && TALENT_BOOKS[region] && TALENT_BOOKS[region][day]){
      const { key, name_kr } = TALENT_BOOKS[region][day];
      book = {
        key,
        name_kr,
        image: IMAGE_SERIES(region, key),
        tiers: {
          low:  { key: 'teachings',    label_kr:'가르침',       image: IMAGE_SERIES_TIER(region, key, 'teachings') },
          mid:  { key: 'guide',        label_kr:'인도',         image: IMAGE_SERIES_TIER(region, key, 'guide') },
          high: { key: 'philosophies', label_kr:'철학',         image: IMAGE_SERIES_TIER(region, key, 'philosophies') }
        }
      };
    }

    return {
      id: c.id,
      name: (c.name_kr && c.name_kr.trim()) ? c.name_kr : c.name_en,
      name_en: c.name_en || '',
      element: c.element || '',
      weapon:  c.weapon  || '',
      image:   c.image   || 'images/placeholder.png',
      region, day,
      talent_book: book
    };
  });

  // Talent step costs
  TALENT_COSTS = (bookCost||[]).map(r => ({
    from: +r.from, to: +r.to,
    book_low: +(r.book_low||0), book_mid: +(r.book_mid||0), book_high: +(r.book_high||0),
    mora: +(r.mora||0), crown: +(r.crown||0)
  }));
}

// ------------------------------
// 6) UI helpers
function initDatalist(){
  dl.innerHTML = CHARACTERS.map(c => `<option value="${c.name}"></option>`).join('');
}
function fillLevelSelect(sel){ sel.innerHTML = LEVEL_ANCHORS.map(l=>`<option value="${l}">${l}</option>`).join(''); }
function fillTalentSelect(sel){ sel.innerHTML = Array.from({length:10}, (_,i)=>i+1).map(l=>`<option value="${l}">${l}</option>`).join(''); }

// ------------------------------
// 7) Calculators
function calcLevelCost(curr, target){
  if (target <= curr) return { xp:0, mora:0, hero:0 };
  const c = LEVEL_ANCHORS.includes(curr)   ? curr : LEVEL_ANCHORS.reduce((a,b)=> (b<=curr ? b : a), 1);
  const t = LEVEL_ANCHORS.includes(target) ? target : LEVEL_ANCHORS.reduce((a,b)=> (b>=target? Math.min(a,b):a), 90);

  let xp=0, mora=0, hero=0;
  for (const row of LEVEL_COSTS){ if (row.to_level > c && row.from_level < t){ xp+=row.total_xp; mora+=row.total_mora; hero+=row.hero_wit; } }
  return { xp, mora, hero };
}

// Use book_cost.json; ignore weekly boss etc.
function calcTalentCost(from, to){
  if (to <= from) return { mora:0, crown:0, books:{low:0,mid:0,high:0} };
  let out = { mora:0, crown:0, books:{low:0,mid:0,high:0} };
  for (const step of TALENT_COSTS){
    if (step.from >= from && step.to <= to){
      out.mora += step.mora||0;
      out.crown += step.crown||0;
      out.books.low  += step.book_low  || 0;
      out.books.mid  += step.book_mid  || 0;
      out.books.high += step.book_high || 0;
    }
  }
  return out;
}

function calcCharacterCost(s){
  const lvl = calcLevelCost(s.levelCurrent, s.levelTarget);
  const tNA = calcTalentCost(s.naCurrent,    s.naTarget);
  const tSK = calcTalentCost(s.skillCurrent, s.skillTarget);
  const tBR = calcTalentCost(s.burstCurrent, s.burstTarget);

  const books = {
    low:  (tNA.books.low||0)  + (tSK.books.low||0)  + (tBR.books.low||0),
    mid:  (tNA.books.mid||0)  + (tSK.books.mid||0)  + (tBR.books.mid||0),
    high: (tNA.books.high||0) + (tSK.books.high||0) + (tBR.books.high||0)
  };
  const crown = (tNA.crown||0) + (tSK.crown||0) + (tBR.crown||0);

  return { mora: lvl.mora + tNA.mora + tSK.mora + tBR.mora, xp: lvl.xp, heroBooks: lvl.hero, books, crown };
}

// ------------------------------
// 8) Rendering
function render(){
  cards.innerHTML = '';
  if (appState.list.length === 0){ cards.appendChild(empty); empty.style.display = 'block'; }
  else { empty.style.display = 'none'; for (const item of appState.list){ cards.appendChild(createCardNode(item)); } }
  refreshTotals();
}

function createCardNode(item){
  const tpl = $('#tpl-card');
  const el  = tpl.content.firstElementChild.cloneNode(true);
  el.dataset.id = item.id;

  const img = $('img', el); img.src = item.image; img.alt = item.name;
  $('[data-field="name"]', el).textContent = item.name;

  // element + series badge inline
  const elemSpan = $('[data-field="element"]', el);
  elemSpan.textContent = item.element || '-';
  if (item.talent_book){
    const dot = document.createElement('span'); dot.textContent = ' · '; dot.className = 'char-sub';
    const sIcon = document.createElement('img'); sIcon.src = item.talent_book.image; sIcon.alt = item.talent_book.name_kr;
    Object.assign(sIcon.style,{width:'16px',height:'16px',borderRadius:'4px',objectFit:'cover',margin:'0 6px'});
    const sTxt  = document.createElement('span'); sTxt.className='char-sub'; sTxt.textContent = `${item.talent_book.name_kr}`;
    elemSpan.appendChild(dot); elemSpan.appendChild(sIcon); elemSpan.appendChild(sTxt);
  }

  // tiny tier icons (teachings/guide/philosophies)
  const infoRow = el.querySelector('.character-info .name-row');
  if (item.talent_book){
    const tiersWrap = document.createElement('div');
    Object.assign(tiersWrap.style,{display:'inline-flex',gap:'6px',marginLeft:'10px'});
    ['low','mid','high'].forEach(k=>{ const t=item.talent_book.tiers[k]; const i=document.createElement('img'); i.src=t.image; i.alt=t.label_kr; i.title=t.label_kr; Object.assign(i.style,{width:'16px',height:'16px',borderRadius:'4px',objectFit:'cover'}); tiersWrap.appendChild(i); });
    infoRow.appendChild(tiersWrap);
  }

  // selects
  const selLC=$('[data-field="level-current"]', el);
  const selLT=$('[data-field="level-target"]', el);
  const selNAC=$('[data-field="talent-na-current"]', el);
  const selNAT=$('[data-field="talent-na-target"]', el);
  const selSC =$('[data-field="talent-skill-current"]', el);
  const selST =$('[data-field="talent-skill-target"]', el);
  const selBC =$('[data-field="talent-burst-current"]', el);
  const selBT =$('[data-field="talent-burst-target"]', el);

  fillLevelSelect(selLC); fillLevelSelect(selLT);
  fillTalentSelect(selNAC); fillTalentSelect(selNAT);
  fillTalentSelect(selSC);  fillTalentSelect(selST);
  fillTalentSelect(selBC);  fillTalentSelect(selBT);

  selLC.value = item.levelCurrent; selLT.value = item.levelTarget;
  selNAC.value= item.naCurrent;    selNAT.value= item.naTarget;
  selSC.value = item.skillCurrent; selST.value = item.skillTarget;
  selBC.value = item.burstCurrent; selBT.value = item.burstTarget;

  const preview  = $('[data-field="preview"]', el);
  const removeBtn= $('[data-action="remove"]', el);

  function onChange(){
    item.levelCurrent = +selLC.value;  item.levelTarget  = +selLT.value;
    item.naCurrent    = +selNAC.value; item.naTarget     = +selNAT.value;
    item.skillCurrent = +selSC.value;  item.skillTarget  = +selST.value;
    item.burstCurrent = +selBC.value;  item.burstTarget  = +selBT.value;
    preview.textContent = fmt(calcCharacterCost(item).mora);
    refreshTotals();
  }
  [selLC, selLT, selNAC, selNAT, selSC, selST, selBC, selBT].forEach(s=> s.addEventListener('change', onChange));

  removeBtn.addEventListener('click', ()=>{ appState.list = appState.list.filter(x => x.uid !== item.uid); render(); });

  preview.textContent = fmt(calcCharacterCost(item).mora);
  return el;
}

// ------------------------------
// 9) Totals (overall + series-by-tier)
function applyIcon(img, pathOrArray){
  const list = Array.isArray(pathOrArray) ? pathOrArray : [pathOrArray];
  let i = 0;
  img.src = list[i];
  img.onerror = () => { i += 1; if (i < list.length) img.src = list[i]; };
}

function addIconToExistingRow(valueId, iconPath){
  const v = document.getElementById(valueId);
  if (!v) return;
  const row = v.closest('.total-row');
  if (!row) return;
  const label = row.firstElementChild; // left label span
  if (!label || label.querySelector('img')) return; // already has icon
  const img = document.createElement('img');
  applyIcon(img, iconPath); img.alt = label.textContent.trim();
  Object.assign(img.style,{width:'18px',height:'18px',borderRadius:'4px',objectFit:'cover',marginRight:'8px'});
  label.prepend(img);
}

function ensureValueRow(valueId, label, iconPath){
  const panel = document.querySelector('.total-panel');
  if (!panel) return null;
  let v = document.getElementById(valueId);
  if (!v){
    const row = document.createElement('div'); row.className='total-row';
    const left = document.createElement('span');
    if (iconPath){ const img=document.createElement('img'); applyIcon(img, iconPath); img.alt=label; Object.assign(img.style,{width:'18px',height:'18px',borderRadius:'4px',objectFit:'cover',marginRight:'8px'}); left.appendChild(img); }
    left.appendChild(document.createTextNode(label));
    v = document.createElement('span'); v.className='total-value'; v.id=valueId; v.textContent='0';
    row.appendChild(left); row.appendChild(v);
    panel.appendChild(row);
  }
  return v;
}

function initTotalsPanel(){
  // 기본 합계: 모라 + 보라책만 남기고 '경험치'는 제거
  addIconToExistingRow('sum-mora', ICON_MORA);
  const expRow = document.getElementById('sum-exp')?.closest('.total-row');
  if (expRow) expRow.remove();
  addIconToExistingRow('sum-talent-books', ICON_HEROWIT);
}

function renderSeriesTotals(seriesTotals){
  const panel = document.querySelector('.total-panel');
  if (!panel) return;
  // 이전 시리즈 섹션 제거
  const old = panel.querySelector('.series-rows');
  if (old) old.remove();
  // 새 컨테이너
  const wrap = document.createElement('div');
  wrap.className = 'series-rows';

  Object.values(seriesTotals).forEach(st => {
    const rows = [
      { label:`${st.nameKr}의 가르침`,     value: st.sums.teachings,    icon: st.icons.teachings },
      { label:`${st.nameKr}의 인도`,       value: st.sums.guide,        icon: st.icons.guide },
      { label:`${st.nameKr}의 철학`,       value: st.sums.philosophies, icon: st.icons.philosophies }
    ];
    rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'total-row';
      const left = document.createElement('span');
      const ic = document.createElement('img');
      applyIcon(ic, r.icon); ic.alt = r.label;
      Object.assign(ic.style,{width:'18px',height:'18px',borderRadius:'4px',objectFit:'cover',marginRight:'8px'});
      left.appendChild(ic);
      left.appendChild(document.createTextNode(r.label));
      const right = document.createElement('span'); right.className='total-value'; right.textContent = fmt(r.value || 0);
      row.appendChild(left); row.appendChild(right);
      wrap.appendChild(row);
    });
  });
  panel.appendChild(wrap);
}

function refreshTotals(){
  let sum = { mora:0, xp:0, hero:0, books:{low:0, mid:0, high:0}, crown:0 };
  const seriesTotals = {}; // key: seriesKey@@nameKr@@region

  for (const it of appState.list){
    const c = calcCharacterCost(it);
    sum.mora += c.mora; sum.xp += c.xp; sum.hero += c.heroBooks; sum.crown += c.crown||0;
    sum.books.low  += c.books.low  || 0; sum.books.mid += c.books.mid || 0; sum.books.high += c.books.high || 0;

    if (it.talent_book){
      const sKey = `${it.talent_book.key}@@${it.talent_book.name_kr}@@${it.region||''}`;
      if (!seriesTotals[sKey]){
        seriesTotals[sKey] = { key: it.talent_book.key, nameKr: it.talent_book.name_kr, region: it.region||'',
          sums:{ teachings:0, guide:0, philosophies:0 },
          icons:{ teachings: it.talent_book.tiers.low.image, guide: it.talent_book.tiers.mid.image, philosophies: it.talent_book.tiers.high.image }
        };
      }
      seriesTotals[sKey].sums.teachings    += c.books.low  || 0;
      seriesTotals[sKey].sums.guide        += c.books.mid  || 0;
      seriesTotals[sKey].sums.philosophies += c.books.high || 0;
    }
  }

  // 기존 기본 행 업데이트
  if (sumMoraEl) sumMoraEl.textContent = fmt(sum.mora);
  if (sumExpEl)  sumExpEl.textContent  = fmt(sum.xp);
  if (sumBooksEl)sumBooksEl.textContent= fmt(sum.hero);

  // 왕관 행 추가/업데이트
  const crownEl = ensureValueRow('sum-crown', '왕관', ICON_CROWN);
  if (crownEl) crownEl.textContent = fmt(sum.crown);

  // 시리즈별 행 렌더
  renderSeriesTotals(seriesTotals);
}

// ------------------------------
// 10) Events
btnAdd.addEventListener('click', ()=>{
  const keyword = (search.value || '').trim(); if (!keyword) return;
  const found = CHARACTERS.find(c => (c.name && c.name.toLowerCase()===keyword.toLowerCase()) || (c.name_en && c.name_en.toLowerCase()===keyword.toLowerCase()));
  if (!found){ alert('목록에 없는 캐릭터입니다. (characters.json을 확인하세요)'); return; }
  if (appState.list.some(x=>x.id===found.id)){ alert('이미 목록에 있는 캐릭터입니다.'); return; }
  const uid = `${found.id}-${Date.now()}`;
  appState.list.push({ uid, id:found.id, name:found.name, element:found.element, image:found.image,
    levelCurrent:1, levelTarget:90, naCurrent:1, naTarget:6, skillCurrent:1, skillTarget:6, burstCurrent:1, burstTarget:6,
    talent_book: found.talent_book, region: found.region });
  search.value=''; render();
});

btnClear.addEventListener('click', ()=>{ if (!confirm('모든 캐릭터를 삭제할까요?')) return; appState.list = []; render(); });

// ------------------------------
// 11) Init
async function init(){
  try { await loadData(); }
  catch (e) { console.error(e); alert('데이터 로딩 실패: 로컬 서버에서 실행 중인지 확인해주세요.'); CHARACTERS=[]; TALENT_COSTS=[]; }
  initDatalist();
  render();
  initTotalsPanel();
}

document.addEventListener('DOMContentLoaded', init);
