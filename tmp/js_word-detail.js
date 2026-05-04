// åèªã¢ã¼ãã«ã®å¶å¾¡ç¨ã¹ã¯ãªãã
// - ä¸è¦§ã§ã«ã¼ããã¯ãªãã¯ããéã«ã¢ã¼ãã«ãéã
// - åèªè©³ç´°æå ±ï¼CSVï¼JSONï¼ãèª­ã¿è¾¼ãã§ã¢ã¼ãã«åã«å±é
// - é³å£°åçãåå¾ããã²ã¼ã·ã§ã³ãã¹ã¯ã¤ãå¯¾å¿ãªã©


document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("wordModal");
  const titleEl = modal.querySelector(".word-modal__title-text");
  const pronEl = modal.querySelector(".word-modal__pronunciation-text");
  const meaningsEl = modal.querySelector(".word-modal__meanings");
  const imageEl = modal.querySelector(".word-modal__image");
  const exampleEnEl = modal.querySelector(".word-modal__example-en");
  const exampleJaEl = modal.querySelector(".word-modal__example-ja");
  const relatedEl = modal.querySelector(".word-modal__related");
  const usageEl = modal.querySelector(".word-modal__usage");
  const nuanceEl = modal.querySelector(".word-modal__nuance");
  const englishDefEl = modal.querySelector(".word-modal__english-def");
  const soundBtn = modal.querySelector(".word-modal__sound");
  const prevBtn = modal.querySelector(".word-modal__nav-btn");
  const nextBtn = modal.querySelector(".word-modal__nav-btn-right");

  // â¼ æ°è¦è¦ç´ 
  const conjugationEl = modal.querySelector(".word-modal__conjugation");
  const coreImageSection = modal.querySelector(".word-modal__core-image-section");
  const coreImageEl = modal.querySelector(".word-modal__core-image");
  const etymologySection = modal.querySelector(".word-modal__etymology-section");
  const etymologyEl = modal.querySelector(".word-modal__etymology");
  const tipsSection = modal.querySelector(".word-modal__tips-section");
  const tipsEl = modal.querySelector(".word-modal__tips");

  const dictionaryPath = 'data/dictionary_new/';

  const posMap = {
    verb: "å",
    transitive_verb:"å",
    intransitive_verb:"å",
    noun: "å",
    adjective: "å½¢",
    adverb: "å¯",
    preposition: "å",
    conjunction: "æ¥",
    interjection: "éæ",       
    pronoun: "ä»£",
    auxiliary: "å©",            
    auxiliary_verb: "å©å",     
    article: "å ",
    phrase: "å¥",
    idiom: "ç",
    number: "æ°",               
    ordinal_number: "åºæ°"      
  };
  const posOrder = { "å": 1, "å": 2, "å½¢": 3 };

  // â¼ è¿½å : ã¨ã¹ã±ã¼ãããã <a> ã¿ã°ãå¾©åãããã«ãã¼é¢æ°
function restoreLinks(text) {
  if (!text) return "";
  return text.replace(/&lt;a href=&quot;(.+?)&quot;&gt;(.+?)&lt;\/a&gt;/g, '<a href="$1">$2</a>');
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeJaQuery(text) {
  let value = String(text ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/gu, " ")
    .trim();

  if (!value) return "";

  value = value.replace(/[ï½~â¼]/gu, "ã");
  value = value.replace(/^[ï¼(][^)ï¼]+[)ï¼]\s*/u, "");
  value = value.replace(/^[ã]\s*(?:ã|ã«|ã¸|ã¨|ã|ã§|ãã|ã¾ã§|ãã|ã®)?\s*/u, "");

  return value.trim();
}

function jaWordUrlFromTranslation(translation) {
  const normalized = normalizeJaQuery(translation);
  const query = normalized || String(translation ?? "").trim();
  return `/vocabulary/ja/${encodeURIComponent(query)}`;
}

function renderJaTranslationLink(translation, highlight = false) {
  const escaped = restoreLinks(escapeHtml(translation));
  if (/<a\s/i.test(escaped)) {
    return highlight ? `<span class="highlight">${escaped}</span>` : escaped;
  }

  const linked = `<a href="${jaWordUrlFromTranslation(translation)}">${escaped}</a>`;
  return highlight ? `<span class="highlight">${linked}</span>` : linked;
}

  // â¼ /vocabulary/{slug}/ ããã¹ã©ãã°åå¾
  function getCourseSlugFromPath() {
    const m = location.pathname.match(/\/vocabulary\/([^\/]+)/);
    return m ? m[1] : "";
  }

  // â¼ è¿½å : book_list.csv ãã Tier1âslug ãå°åºããword.course ã«åè´ãã slug ãè¿ãï¼ãã¼ã¿é§åï¼
  async function resolveCourseSlug(word) {
    // 1) URLã«ã¹ã©ãã°ãããã°ãããä½¿ç¨
    const fromPath = getCourseSlugFromPath();
    if (fromPath) return fromPath;

    // 2) book_list.csv ãã Tier1 åã¨ tier1_path ãéç´ããword.course ã¨çªãåããã
    if (typeof window.getBookList !== "function") return ""; // ä¿éº
    try {
      const books = await window.getBookList();
      // Tier1ï¼ä¾: ä¸­å­¦/é«æ ¡/TOEIC/è±æ¤/ãã®ä»ï¼â slugï¼ä¾: junior/high/toeic/eiken/othersï¼
      const pairs = [];
      books.forEach(b => {
        const tier1 = (b.Tier1 || "").trim();
        let path = (b.tier1_path || "").trim(); // ä¾: /junior/
        if (!tier1 || !path) return;
        const slug = path.replace(/^\/|\/$/g, ""); // ä¸¡ç«¯ã® / ãé¤å»
        pairs.push({ tier1, slug });
      });

      // word.course ãããè±èªãç­ã®æ¥å°¾ãåãé¤ãããã¼ã¹ã§çªãåããï¼ä¾: ä¸­å­¦è±èª â ä¸­å­¦ï¼
      const courseRaw = String(word?.course || "").trim();
      const base = courseRaw.replace(/è±èª$/u, ""); // ä¸­å­¦è±èª â ä¸­å­¦ãé«æ ¡è±èª â é«æ ¡

      // å®å¨ä¸è´åªå â å«æä¸è´ã®é ã«ããã
      let hit = pairs.find(p => p.tier1 === base) || pairs.find(p => base.includes(p.tier1));
      return hit ? hit.slug : "";
    } catch {
      return "";
    }
  }

  function stripTags(str) {
    if (!str) return "";
    return str.replace(/<[^>]*>?/gm, "");
  }

  /* ------------------------------------------------------------
     ð§ ä¾æå¨æããURL Safe ãª Base64ãã¸å¤æããé¢æ°
        - UTF-8 â Base64   : btoa(unescape(encodeURIComponent(str)))
        - URL Safe å¤æ    : '+'â'-' , '/'â'_' , '=' ãé¤å»
     ------------------------------------------------------------ */
  function toBase64Url(str) {
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64                     // éå¸¸ã® Base64
      .replace(/\+/g, "-")            // URL ä½¿ç¨ä¸å¯æå­ãç½®æ
      .replace(/\//g, "_")            //   ã
      .replace(/=+$/, "");            // æ«å°¾ã®ããã£ã³ã°ã¯ä¸è¦
  }

  function sortMeanings(meanings) {
    return meanings.sort((a, b) => {
      const orderA = posOrder[a.part_of_speech] || 99;
      const orderB = posOrder[b.part_of_speech] || 99;
      return orderA - orderB;
    });
  }

  window.openWordModal = async (word) => {
    const wordId = word.id;
    modal.dataset.currentId = wordId;

    // ð¹ã¹ã¯ã­ã¼ã«ä½ç½®ããªã»ãã
    setTimeout(() => {
      const scrollArea = document.querySelector(".word-modal__scroll-area");
      if (scrollArea) scrollArea.scrollTop = 0;
    }, 0);

    try {
      const res = await fetch(`${dictionaryPath}${wordId}.json`);
      if (!res.ok) throw new Error("404 Not Found");
      const json = await res.json();

      // ã¿ã¤ãã«ã¨çºé³
      titleEl.textContent = word.english;
      pronEl.textContent = word.pronunciation || json.pronunciation || "";

      // æå³ã»ã¯ã·ã§ã³
      const mainMeaning = word.translation
        ? [{ translation: renderJaTranslationLink(word.translation, true), part_of_speech: word.part_of_speech }]
        : [];
      const extra = (json.other_translations || []).map(m => ({
        translation: renderJaTranslationLink(m.translation),
        part_of_speech: m.part_of_speech
      }));
      const combined = [...mainMeaning, ...extra];
      // â ã¡ã¤ã³è¨³ã®åè©ãæä¸ä½ã«ãæ®ãã¯åè©åªåé ä½ã«å¾ã£ã¦ä¸¦ã¹ã
      // â åè©é ã®åªååº¦
      const posOrder = { "å": 1, "å": 2, "å½¢": 3 };
      const mainPOS = posMap[word.part_of_speech] || word.part_of_speech || ""; 
      // const mainPOS = word.part_of_speech || "";

      // â combinedãgroupedã«ã¾ã¨ãã
      const grouped = {};
      combined.forEach(m => {
        const pos = posMap[m.part_of_speech] || m.part_of_speech || "";
        if (!grouped[pos]) grouped[pos] = [];
        grouped[pos].push(m.translation);
        });

      // â åªåé ï¼ã¡ã¤ã³åè©ã§ä¸¦ã³æ¿ã
      const sortedGrouped = Object.entries(grouped).sort(([a], [b]) => {
        const aOrder = a === mainPOS ? -1 : (posOrder[a] || 999);
        const bOrder = b === mainPOS ? -1 : (posOrder[b] || 999);
        return aOrder - bOrder;
      });
      

      // â åºå
      meaningsEl.innerHTML = sortedGrouped
        .map(([pos, list]) => `<li><span class="word-card__part-of-speech">${pos}</span> ${restoreLinks(list.join("ã"))}</li>`)
        .join("");

      // ç»åï¼course åºå®ãããåªå â æ¢å­ã®æ¨å®ã­ã¸ãã¯ã«ãã©ã¼ã«ããã¯ï¼
      const COURSE_SLUG_MAP = {
        "ä¸­å­¦è±èª": "junior",
        "é«æ ¡è±èª": "high",
        "TOEICÂ®": "toeic",
        "è±æ¤Â®": "eiken"
      };
      const mappedSlug = COURSE_SLUG_MAP[(word.course || '').trim()];
      const courseSlug = mappedSlug || await resolveCourseSlug(word);
      imageEl.src = `Img/${courseSlug}/${word.english}.jpg`;
      imageEl.alt = `${word.english}ã®ã¤ã©ã¹ã`;

      // ä¾æ
      let example = word.example || '';
      let highlighted = '';

      if (example.includes('|')) {
        // |...|ã§å²ã¾ããèªãå¼·å¶ãã¤ã©ã¤ã
        highlighted = example.replace(/\|(.*?)\|/g, '<span class="highlight">$1</span>');
      } else {
        // ç¸¦ç·ããªãå ´åã¯ãè±åèªã¨ãã®æ´»ç¨å½¢ããã¤ã©ã¤ãï¼å¤§æå­å°æå­ãç¡è¦ï¼
        const base = word.english;
        const baseRegex = new RegExp(`\\b${base}(ed|ing|s)?\\b`, 'gi');
        highlighted = example.replace(baseRegex, '<span class="highlight">$&</span>');
      }

      example = example.replace(/\|/g, ''); // è¡¨ç¤ºãã | ãé¤å»
      
      // â¼ ä¿®æ­£: restoreLinks é©ç¨
      highlighted = restoreLinks(highlighted);

      const exampleClean = stripTags(example);

      // ð Base64 (URL Safe) ã¨ã³ã³ã¼ãããä¾æãä½¿ã£ã¦
      //     https://assetsvate77xqfrsuq.blob.core.windows.net/assets/Sentence/{ã¨ã³ã³ã¼ã}.ogg
      //    ãçæããdata-audio ã«æ ¼ç´
      const exampleAudioUrl =
        `https://assetsvate77xqfrsuq.blob.core.windows.net/assets/Sentence/${toBase64Url(exampleClean)}.ogg`;

      exampleEnEl.innerHTML = `
        ${highlighted}
        <button class="word-modal__example-sound word-modal__sound"
                data-audio="${exampleAudioUrl}"
                aria-label="ä¾æã®é³å£°åç">
          <img src="image/btn_sound.png" alt="çºé³åç">
        </button>`;
      
      exampleJaEl.innerHTML = restoreLinks(word.example_translation || '');


      // é¢é£èªï¼æ´¾çèªã»å¯¾ç¾©èªãçµ±åãã¦è¡¨ç¤ºï¼
      relatedEl.innerHTML = "";
      let hasRelated = false;

      // â æ´¾çèªï¼âï¼
      if ((json.derivatives || []).length > 0) {
        hasRelated = true;
        json.derivatives.forEach(d => {
          const jpPos = posMap[d.part_of_speech] || d.part_of_speech;
          relatedEl.innerHTML += `<p class="word-modal__related-item">(${jpPos}) ${restoreLinks(d.english)}ï¼${restoreLinks(d.translation)}</p>`;
        });
      }

      // â å¯¾ç¾©èªï¼âï¸ï¼
      if ((json.antonyms || []).length > 0) {
        hasRelated = true;
        json.antonyms.forEach(a => {
          const jpPos = posMap[a.part_of_speech] || a.part_of_speech;
          relatedEl.innerHTML += `<p class="word-modal__related-item">âï¸(${jpPos}) ${restoreLinks(a.english)}ï¼${restoreLinks(a.translation)}</p>`;
        });
      }

      // â ã»ã¯ã·ã§ã³ã®è¡¨ç¤ºå¶å¾¡
      if (hasRelated) {
        relatedEl.closest(".word-modal__section").style.display = "block";
      } else {
        relatedEl.closest(".word-modal__section").style.display = "none";
      }



      // ä½¿ãæ¹ï¼phrasesï¼
      usageEl.innerHTML = "";
      if ((json.phrases || []).length > 0) {
        usageEl.closest(".word-modal__section").style.display = "block";
        json.phrases.forEach(p => {
          const raw = p.english || "";
        
          // â |...|ã§å²ã¾ããé¨åãæ¤åº
          const replaced = raw.replace(/\|(.+?)\|/g, (match, inner) => {
            // è±åèªãå«ãå ´åã ããã¤ã©ã¤ãï¼æ´»ç¨å½¢ã§ãè¨±å®¹ï¼
            if (inner.toLowerCase().includes(word.english.toLowerCase())) {
              return `<span class="highlight">${inner}</span>`;
            }
            return inner; 
          });
        
          // â å¥èª­ç¹ã®ç´åã«ã¹ãã¼ã¹ãå¥ããªãããèª¿æ´
          const clean = replaced.replace(/\s+([.,!?;:])/g, "$1");
        
          usageEl.innerHTML += `
            <li>
              <p class="word-modal__usage-en">${restoreLinks(clean)}</p>
              <p class="word-modal__usage-ja">${restoreLinks(p.translation)}</p>
            </li>`;
        });
        // json.phrases.forEach(p => {
        //   const raw = p.english || "";
        //   const en = raw.includes(`|${word.english}|`)
        //     ? raw.replace(new RegExp(`\\|${word.english}\\|`, 'g'), `<span class="highlight">${word.english}</span>`).replace(/\|/g, '')
        //     : raw;

        //   usageEl.innerHTML += `
        //     <li>
        //       <p class="word-modal__usage-en">${en}</p>
        //       <p class="word-modal__usage-ja">${p.translation}</p>
        //     </li>`;
        // });
      } else {
        usageEl.closest(".word-modal__section").style.display = "none";
      }

      // ===== Conjugationï¼æ´»ç¨è¡¨ç¤ºï¼=====
      if (conjugationEl) {
        conjugationEl.innerHTML = "";
        conjugationEl.style.display = "none";

        const conj = json.conjugation || {};
        const hasPast = typeof conj.past_tense === "string" && conj.past_tense.trim() !== "";
        const hasPart = typeof conj.past_participle === "string" && conj.past_participle.trim() !== "";
        const hasPlural = typeof conj.plural === "string" && conj.plural.trim() !== "";

        if (hasPast && hasPart) {
          conjugationEl.innerHTML =
            `<span class="conjugation-badge">é</span><span>${conj.past_tense}</span>
             <span class="conjugation-badge">éå</span><span>${conj.past_participle}</span>`;
          conjugationEl.style.display = "flex";
        } else if (hasPlural) {
          conjugationEl.innerHTML =
            `<span class="conjugation-badge">è¤</span><span>${conj.plural}</span>`;
          conjugationEl.style.display = "flex";
        }
        // ç©ºè¾æ¸ï¼ãã¿ã¼ã³3ï¼ã¯ä½ãè¡¨ç¤ºããªã
      }

      // ===== Core Imageï¼ã³ã¢ã¤ã¡ã¼ã¸ï¼=====
      if (coreImageSection && coreImageEl) {
        const core = (json.core_image || "").trim();
        if (core) {
          // â¼ ä¿®æ­£: textContent -> innerHTML + restoreLinks
          coreImageEl.innerHTML = restoreLinks(core);
          coreImageSection.style.display = "block";
        } else {
          coreImageEl.innerHTML = "";
          coreImageSection.style.display = "none";
        }
      }

      // ===== é¡ç¾©èªã¨ã®éãï¼synonyms å¨åæï¼=====
      {
        const syns = json.synonyms || json.synonynms || [];
        if (Array.isArray(syns) && syns.length > 0) {
          const lines = syns.map((s, idx) => {
            const en = (s.english || "").trim();
            const desc = (s.description || "").trim();
            const enHtml = idx === 0 ? `<span class="highlight">${restoreLinks(en)}</span>` : restoreLinks(en);
            return `${enHtml}: ${restoreLinks(desc)}`;
          });
          nuanceEl.closest(".word-modal__section").style.display = "block";
          // æ¹è¡ã§ä¸¦ã¹ã
          nuanceEl.innerHTML = lines.join("<br>");
        } else {
          nuanceEl.closest(".word-modal__section").style.display = "none";
          nuanceEl.textContent = "";
        }
      }

      // ===== è±è± =====
      // â¼ ä¿®æ­£: textContent -> innerHTML + restoreLinks
      englishDefEl.innerHTML = restoreLinks(json.english_meaning || "");

      // ===== èªæº =====
      if (etymologySection && etymologyEl) {
        const ety = (json.etymology || "").trim();
        if (ety) {
          // â¼ ä¿®æ­£: textContent -> innerHTML + restoreLinks
          etymologyEl.innerHTML = restoreLinks(ety);
          etymologySection.style.display = "block";
        } else {
          etymologyEl.innerHTML = "";
          etymologySection.style.display = "none";
        }
      }

      // ===== ã³ã©ã ï¼tipsï¼=====
      if (tipsSection && tipsEl) {
        const tips = Array.isArray(json.tips) ? json.tips : [];
        if (tips.length > 0) {
          tipsEl.innerHTML = tips.map(t => `<li>${restoreLinks(t)}</li>`).join("");
          tipsSection.style.display = "block";
        } else {
          tipsEl.innerHTML = "";
          tipsSection.style.display = "none";
        }
      }

      // é³å£°ãã¿ã³
      soundBtn.setAttribute("data-audio", `wordsound/${word.sound}_1.mp3`);

      // åå¾ããã²ã¼ã·ã§ã³
      const cards = [...document.querySelectorAll(".word-card")];
      const ids = cards.map(c => c.dataset.id);
      const currentIndex = ids.indexOf(wordId);
      const prevWord = window.wordDataArray?.find(w => w.id === ids[currentIndex - 1]);
      const nextWord = window.wordDataArray?.find(w => w.id === ids[currentIndex + 1]);
      prevBtn.innerHTML = prevWord ? `&lt; ${prevWord.english}` : "";
      nextBtn.innerHTML = nextWord ? `${nextWord.english} &gt;` : "";

      // ã¢ã¼ãã«è¡¨ç¤º
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("is-open");
      // â æ¤ç´¢ã¢ã¼ãã®ãªã¼ãã¼ã¬ã¤ãããã°åé¤

    } catch (err) {
      console.error("â JSON èª­ã¿è¾¼ã¿å¤±æ:", err);
    }
  };

  // â åå¾åãæ¿ãï¼ã°ã¬ã¼ã¢ã¦ãæ¼åºä»ãï¼
function moveModal(direction) {

  const cards = [...document.querySelectorAll(".word-card")];
  const ids = cards.map(c => c.dataset.id);
  const currentId = modal.dataset.currentId;
  const currentIndex = ids.indexOf(currentId);
  const targetId = direction === "next" ? ids[currentIndex + 1] : ids[currentIndex - 1];
  if (!targetId) return;

  // ð¹ å­å¨ãã¦ããã°æè»¢å®è¡
  const fadeLayer = document.querySelector(".word-modal__fade-layer");
  if (fadeLayer) {
    fadeLayer.classList.add("is-active");
  }

  const targetWord = window.wordDataArray.find(w => w.id === targetId);
  if (targetWord) {
    setTimeout(() => {
      window.openWordModal(targetWord);

      // ð ã¨ãã§ã¯ãè§£é¤ï¼300mså¾ï¼
      if (fadeLayer) {
        fadeLayer.classList.remove("is-active");
      }
    }, 300);
  }
}

  prevBtn.addEventListener("click", () => moveModal("prev"));
  nextBtn.addEventListener("click", () => moveModal("next"));

  // ã¹ã¯ã¤ã
  let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

modal.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
});

modal.addEventListener("touchend", (e) => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;

  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;

  // â æ¨ªç§»åãå¤§ããããã¤ç¸¦ç§»åãå°ããã¨ãã®ã¿ã¹ã¯ã¤ãã¨å¤å®
  if (Math.abs(diffX) > 50 && Math.abs(diffY) < 30) {
    if (diffX > 0) moveModal("prev");
    else moveModal("next");
  }
});



  // é³å£°åç
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".word-modal__sound");
    if (!btn) return;
    e.stopPropagation();
    const audioSrc = btn.getAttribute("data-audio");
    if (!audioSrc) return;
    const audio = new Audio(audioSrc);
    audio.play().catch(err => console.error("ð åçã¨ã©ã¼:", err));
  });
});

