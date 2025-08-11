/*
Genshin character JSON generator + sample data
- Purpose: Automatically produce a JSON file containing playable Genshin characters with fields:
  id, name_kr, name_en, element, weapon, region, talent_book_series, image
- Image filename rule: images/<id>.png  (e.g. images/ayaka.png)

USAGE (node.js):
1) npm install node-fetch@2 cheerio
2) node genshin_characters_generator.js

Notes:
- Scrapes Game8 list page for candidate names, then opens each Fandom page to:
  (a) FILTER: keep only Playable characters
  (b) EXTRACT: element/weapon/region/talent_book_series
- If a site blocks scraping or structure changes, consider manual CSV->JSON.
*/

const fs = require('fs');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Config: change sourceUrl to preferred authoritative list (Game8 / Fandom list page)
const sourceUrl = 'https://game8.co/games/Genshin-Impact/archives/296707'; // Game8 characters list (example)
const fandomBase = 'https://genshin-impact.fandom.com/wiki/';

// polite delay between requests
const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

async function fetchText(url){
  const res = await fetch(url, {
    headers: {
      'User-Agent':'genshin-json-generator/1.1 (+https://example.local)',
      'Accept-Language':'en-US,en;q=0.9'
    }
  });
  if(!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

// Utility to make id-safe slugs (lowercase, ascii, replace spaces with underscore)
function makeId(name){
  return name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g,'')
    .trim()
    .toLowerCase()
    .replace(/\s+/g,'_');
}

// Heuristic: English/Korean letters allowed; avoid garbage anchors
const NAME_REGEX = /^[A-Za-z\u00C0-\u017F\uAC00-\uD7A3'’\- ]{2,30}$/;

// Determine "Playable" by multiple signals on Fandom page
function isPlayable($$){
  // 1) Infobox title
  const title = $$('#mw-content-text .portable-infobox .pi-title').first().text().trim().toLowerCase();
  if (title.includes('playable character')) return true;

  // 2) Categories (bottom)
  let catPlayable = false;
  $$('#catlinks a').each((_,a)=>{
    const t = $$(a).text().trim().toLowerCase();
    if (t.includes('playable characters') || t.includes('upcoming playable characters')) {
      catPlayable = true;
    }
  });
  if (catPlayable) return true;

  // 3) Infobox "Type"/"Character Type"
  let typeVal = '';
  $$('#mw-content-text .portable-infobox .pi-data').each((_,el)=>{
    const label = $$(el).find('.pi-data-label').text().trim();
    const value = $$(el).find('.pi-data-value').text().trim();
    if (/^(type|character type)$/i.test(label)) {
      typeVal = value.toLowerCase();
    }
  });
  if (typeVal.includes('playable')) return true;

  return false;
}

(async ()=>{
  try{
    console.log('Fetching master list from', sourceUrl);
    const html = await fetchText(sourceUrl);
    const $ = cheerio.load(html);

    // Collect candidate names from the list page
    const nameSet = new Map();
    $('a').each((_,el)=>{
      const text = $(el).text().trim();
      if(text && NAME_REGEX.test(text) && text.length>2 && text.length<30){
        // Store lowercase key to dedup, but keep original casing
        const key = text.toLowerCase();
        // Heuristic: avoid obvious junk words that pass regex
        if (['all characters','characters','genshin impact','guide','tier list'].includes(key)) return;
        if (!nameSet.has(key)) nameSet.set(key, text);
      }
    });

    const unique = Array.from(nameSet.values());
    console.log('Found candidate names (pre-filter):', unique.length);

    const output = [];
    const limit = unique.length; // set a lower number while testing (e.g. 20)

    for(let i=0;i<limit;i++){
      const name = unique[i];
      const urlName = encodeURIComponent(name.replace(/ /g, '_'));
      const charUrl = fandomBase + urlName;

      try{
        // be polite to servers
        await sleep(250);

        const page = await fetchText(charUrl);
        const $$ = cheerio.load(page);

        // Skip if not a playable character (filters out NPCs)
        if (!isPlayable($$)) {
          console.log(`Skipping (not playable): ${name}`);
          continue;
        }

        const infobox = $$('#mw-content-text .portable-infobox');

        let element = '', weapon = '', region = '', talent_book_series = '';

        infobox.find('.pi-data').each((_,el)=>{
          const label = $$(el).find('.pi-data-label').text().trim();
          const value = $$(el).find('.pi-data-value').text().trim();

          // Element can appear as Vision or Element on Fandom
          if(/^(vision|element)$/i.test(label)) element = value.split('\n')[0];

          // Weapon can appear as Weapon or Weapon Type
          if(/^(weapon|weapon type)$/i.test(label)) weapon = value.split('\n')[0];

          // Region/Nation/Affiliation – pick first meaningful one
          if(/^(nation|region|affiliation)$/i.test(label) && !region) region = value.split('\n')[0];

          // Talent books – varies; keep first line
          if(/talent/i.test(label) && !talent_book_series) talent_book_series = value.split('\n')[0];
        });

        const id = makeId(name);
        output.push({
          id,
          name_en: name,
          name_kr: '', // fill via separate mapping if needed
          element: element || null,
          weapon: weapon || null,
          region: region || null,
          talent_book_series: talent_book_series || null,
          image: `images/${id}.png`
        });

        console.log(`Added playable: ${name} (${id})`);
      }catch(err){
        console.warn(`Failed "${name}": ${err.message}. Skipping.`);
        // Intentionally skip if page fails or is inaccessible (do not add NPC stubs)
      }
    }

    // write file
    fs.writeFileSync('./characters.json', JSON.stringify(output, null, 2), 'utf8');
    console.log('Wrote ./characters.json with', output.length, 'PLAYABLE entries.');
  }catch(e){
    console.error('Fatal:', e);
    process.exit(1);
  }
})();
