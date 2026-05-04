// æ¤ç´¢ãã¼ã¨æ¤ç´¢çµæã®å¶å¾¡
// - è±åèªé¨åä¸è´ã«ããæ¤ç´¢å¦çï¼CSVããï¼
// - çµæãä¸è¦§ã¨ãã¦è¡¨ç¤ºãã¯ãªãã¯ã§ã¢ã¼ãã«è¡¨ç¤º
// - å¥åã¤ãã³ãã«ããæ¤ç´¢åè£ã®è¡¨ç¤ºãå¯¾å¿äºå®
// - ã¢ã¼ãã«ãå±éã§ä½¿ããããã« word-detail.js ã«ä¾å­


// æ¤ç´¢çµæãªãã¢ã¼ãã«å¶å¾¡
function showNoResultModal(keyword) {
  const modal = document.getElementById("js-no-result-modal");
  const keywordSpan = document.getElementById("js-no-result-keyword");
  keywordSpan.textContent = keyword;
  modal.classList.add("is-open");

  // éãããã¿ã³
  document.getElementById("js-close-no-result").addEventListener("click", () => {
    modal.classList.remove("is-open");
    document.getElementById("search-input").value = ""; // â ããã§ãªã»ãã
  });

  // æ¤ç´¢æ¡ä»¶ãªã»ãã
  document.getElementById("js-clear-search").addEventListener("click", () => {
    document.getElementById("search-input").value = "";
    modal.classList.remove("is-open");
  });
}


// â ã°ã­ã¼ãã«å¤æ°ï¼CSVãã¼ã¿ç¨ï¼
var searchWords = searchWords || [];
let selectedIndex = -1;

// â¼ è¿½å : ã«ã¿ã«ããã²ãããªã«å¤æãããã«ãã¼é¢æ°
function toHiragana(str) {
  return str.replace(/[\u30a1-\u30f6]/g, function(match) {
    var chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

// â¼ è¿½å : ãã¤ã©ã¤ãç¨ã«ãã²ãããªã»ã«ã¿ã«ãåºå¥ãªãã®æ­£è¦è¡¨ç¾ãä½ãé¢æ°
function createKanaInsensitiveRegex(keyword) {
  // ç¹æ®æå­ã¨ã¹ã±ã¼ã
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // ããªæå­ã [ãã¢] ã®ãããªã¯ã©ã¹ã«ç½®æ
  const pattern = escaped.replace(/[\u3041-\u3096\u30a1-\u30f6]/g, function(ch) {
    const code = ch.charCodeAt(0);
    let hira, kata;
    if (code >= 0x30a1 && code <= 0x30f6) { // ã«ã¿ã«ã
       kata = ch;
       hira = String.fromCharCode(code - 0x60);
    } else { // ã²ãããª
       hira = ch;
       kata = String.fromCharCode(code + 0x60);
    }
    return `[${hira}${kata}]`;
  });
  return new RegExp(`(${pattern})`, 'gi');
}

// â¼ è¿½å : éå»¶ã­ã¼ãå¶å¾¡
let __searchLoadStarted = false;
let __searchLoadPromise = null;

function ensureSearchIndexLoad() {
  if (__searchLoadPromise) return __searchLoadPromise;
  if (!window.getWordCourses) return Promise.resolve([]); // ã¬ã¼ã

  __searchLoadStarted = true;
  __searchLoadPromise = window.getWordCourses()
    .then(rows => {
      searchWords = rows || [];
      return searchWords;
    })
    .catch(() => {
      // å¤±ææã¯æ¬¡ååè©¦è¡ã§ããããã«ãã©ã°ããªã»ãã
      __searchLoadStarted = false;
      __searchLoadPromise = null;
      return [];
    });

  return __searchLoadPromise;
}

// â¼ ãã¼ã¸è¡¨ç¤ºå¾ã®ããã¯ã°ã©ã¦ã³ãèª­è¾¼ï¼UXåªåï¼
window.addEventListener('load', () => {
  // åææç»ãä»ã®fetchã¨ç«¶åãã«ããããå°ãéããã
  setTimeout(() => { ensureSearchIndexLoad(); }, 2500);
});

// â ã¹ã¯ã­ã¼ã«ã«å¿ããæ¤ç´¢ãã¼è¡¨ç¤ºå¶å¾¡ï¼TP-04ï¼TP-37ï¼
document.addEventListener("DOMContentLoaded", () => {
  const searchBar = document.querySelector(".search-bar");
  if (!searchBar) return;
  searchBar.classList.add("is-visible");

  let lastScroll = window.pageYOffset;
  let scrollBuffer = 0;

  window.addEventListener("scroll", () => {
    const currentScroll = window.pageYOffset;
    const scrollDelta = currentScroll - lastScroll;
    scrollBuffer += scrollDelta;
    
    const suggestionOpen = document.querySelector("#js-search-results")?.children.length > 0;

    // ð¹ ãã¼ã¸åé ­ãªãå¿ãè¡¨ç¤ºï¼è¿½å _14å¯¾å¿ï¼
    if (currentScroll <= 0) {
      searchBar.classList.add("is-visible");
      scrollBuffer = 0;
      lastScroll = currentScroll;
      return;
    }

    // â TP-04: æ¤ç´¢åè£ãåºã¦ãããå¸¸ã«è¡¨ç¤º
    if (suggestionOpen) {
      searchBar.classList.add("is-visible");
      scrollBuffer = 0;
      lastScroll = currentScroll;
      return;
    }


    // ããç¨åº¦ã¹ã¯ã­ã¼ã«ããã¨ãã ãéè¡¨ç¤ºï¼TP-37å¯¾å¿ï¼
    if (scrollDelta > 0) {
      // â ä¸ã¹ã¯ã­ã¼ã«ï¼ç´¯ç©ã«ã¦ã³ã
      scrollBuffer += scrollDelta;
  
      if (scrollBuffer > 150) {
        searchBar.classList.remove("is-visible");
        scrollBuffer = 0;
      }
    } else if (scrollDelta < 0) {
      // â ä¸ã¹ã¯ã­ã¼ã«ï¼å³è¡¨ç¤ºã»ãªã»ãã
      searchBar.classList.add("is-visible");
      scrollBuffer = 0;
    }

    lastScroll = currentScroll;
  });
});

// â æ¤ç´¢å¦çã®ã»ããã¢ãã
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("search-input");
  const resultsBox = document.getElementById("js-search-results");
  const form = document.querySelector(".search-bar__form");
  if (!input || !resultsBox || !form) return;

  // â æ¤ç´¢çµææç»é¢æ°ï¼ãã¤ã©ã¤ãã»åè©è¡¨ç¤ºå¯¾å¿ï¼
  const renderResults = (value) => {
    const keyword = (value || "").trim();
    if (!keyword) {
      resultsBox.innerHTML = "";
      toggleOverlay(false);
      return;
    }

    // â¼ ã¤ã³ããã¯ã¹æªèª­è¾¼æã¯ãèª­ã¿è¾¼ã¿ä¸­â¦ããè¡¨ç¤ºãã¤ã¤ããã¯ã°ã©ã¦ã³ãèµ·å
    if (!searchWords || searchWords.length === 0) {
      resultsBox.innerHTML = `<div class="search-bar__loading">èª­ã¿è¾¼ã¿ä¸­â¦</div>`;
      toggleOverlay(true);
      ensureSearchIndexLoad().then(() => {
        // èª­ã¿è¾¼ã¿å®äºæã«åãå¥åã§åæç»ï¼ã¾ã å¥åæ¬ã«å¤ãããå ´åï¼
        if (document.activeElement === input || input.value.trim() === keyword) {
          renderResults(input.value);
        }
      });
      return;
    }

    const lowerKeyword = keyword.toLowerCase();
    const hiraKeyword = toHiragana(keyword); // æ¥æ¬èªæ¤ç´¢ç¨ï¼ã²ãããªåï¼

    // â ãã£ã«ã¿ãªã³ã°ï¼è±èªåæ¹ä¸è´ OR æ¥æ¬èªé¨åä¸è´ï¼
    const matchedWords = searchWords.filter(w => {
      if (!w) return false;

      // 1. è±åèªï¼åæ¹ä¸è´ï¼- é«éãªã®ã§åã«å¤å®
      const en = w.english ? String(w.english) : "";
      if (en && en.toLowerCase().startsWith(lowerKeyword)) return true;

      // 2. æ¥æ¬èªè¨³ï¼é¨åä¸è´ã»ããªã«ãç¡è¦ï¼
      const ja = w.translation ? String(w.translation) : "";
      if (ja) {
        const hiraJa = toHiragana(ja);
        if (hiraJa.includes(hiraKeyword)) return true;
      }

      return false;
    });

    // â éè¤è±åèªãé¤å¤ï¼IDãæå°ã®1ä»¶ã ãæ®ãï¼
    const uniqueWords = Object.values(
      matchedWords.reduce((acc, word) => {
        const key = (word.english || "").toLowerCase();
        if (!key) return acc;
        if (!acc[key] || Number(word.id) < Number(acc[key].id)) {
          acc[key] = word;
        }
        return acc;
      }, {})
    );

    // â æ¤ç´¢çµæã®ä¸¦ã³æ¿ãã­ã¸ãã¯ãå¤æ´
    // 1. è±åèªã®å®å¨ä¸è´
    // 2. æ¥æ¬èªè¨³ã®åæ¹ä¸è´
    // 3. æ¥æ¬èªè¨³ã®æå­æ°é ï¼ç­ãé ï¼
    const filtered = uniqueWords.sort((a, b) => {
      const aEn = (a.english || "").toLowerCase();
      const bEn = (b.english || "").toLowerCase();

      // 1. è±åèªã®å®å¨ä¸è´ï¼æåªåï¼
      const aIsEnExact = aEn === lowerKeyword;
      const bIsEnExact = bEn === lowerKeyword;
      if (aIsEnExact && !bIsEnExact) return -1;
      if (!aIsEnExact && bIsEnExact) return 1;

      // æ¥æ¬èªæ¤ç´¢ç¨ã®å¤ï¼ã²ãããªåãã¦æ¯è¼ï¼
      const aJa = a.translation || "";
      const bJa = b.translation || "";
      const aJaHira = toHiragana(aJa);
      const bJaHira = toHiragana(bJa);

      // 2. æ¥æ¬èªè¨³ã®åæ¹ä¸è´ï¼åªåï¼
      const aIsJaPrefix = aJaHira.startsWith(hiraKeyword);
      const bIsJaPrefix = bJaHira.startsWith(hiraKeyword);

      if (aIsJaPrefix && !bIsJaPrefix) return -1;
      if (!aIsJaPrefix && bIsJaPrefix) return 1;

      // 3. æ¥æ¬èªè¨³ã®æå­æ°é ï¼ç­ãæ¹ãä¸è´åº¦ãé«ãã¨ã¿ãªãï¼
      // åæ¹ä¸è´åå£«ããããã¯é¨åä¸è´åå£«ã®å ´åã«é©ç¨
      return aJa.length - bJa.length;
    });


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
  
    // â¼ ãã¤ã©ã¤ãç¨æ­£è¦è¡¨ç¾ã®æºå
    const enRegex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const jaRegex = createKanaInsensitiveRegex(keyword);

    resultsBox.innerHTML = filtered.map(w => {
      // è±èªãã¤ã©ã¤ã
      const highlightedEn = w.english.replace(enRegex, '<span class="search-bar__highlight">$1</span>');
      
      // æ¥æ¬èªãã¤ã©ã¤ã
      const highlightedJa = (w.translation || "").replace(jaRegex, '<span class="search-bar__highlight">$1</span>');

      const part = posMap[w.part_of_speech] || "";
      return `
        <div class="search-bar__result-item" data-id="${w.id}">
          <div class="search-bar__english-line">
            <strong class="search-bar__english">${highlightedEn}</strong>
          </div>
          <div class="search-bar__translation-line">
            ${part ? `<span class="search-bar__part">${part}</span>` : ""}
            <span class="search-bar__translation">${highlightedJa}</span>
          </div>
        </div>
      `;
    }).join("");
    toggleOverlay(filtered.length > 0); 
  };

  // â å¥åæã«æ¤ç´¢åè£ãè¡¨ç¤ºï¼æªèª­è¾¼ãªãèª­ã¿è¾¼ã¿éå§ï¼
  input.addEventListener("input", (e) => {
    renderResults(e.target.value);
    selectedIndex = -1;
  });

  // â ãã©ã¼ã«ã¹æã«ãç¾å¨ã®å¤ã§åè£ãåè¡¨ç¤ºï¼æªèª­è¾¼ãªãèµ·åï¼
  input.addEventListener("focus", () => {
    if (!__searchLoadStarted) ensureSearchIndexLoad();
    renderResults(input.value);
  });

  // â ç¢å°ã­ã¼ï¼Enterã­ã¼å¯¾å¿ï¼å¥åæ¬ã«ãã©ã¼ã«ã¹ä¸­ï¼
  input.addEventListener("keydown", (e) => {
    setTimeout(() => {
      const items = [...resultsBox.querySelectorAll(".search-bar__result-item")];
      if (items.length === 0) return;
  
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          items[selectedIndex].click();
          return;
        }
      }
  
      // é¸æç¶ææ´æ°
      items.forEach((item, idx) => {
        item.classList.toggle("is-active", idx === selectedIndex);
      });
    }, 0);
  });

  // â æ¤ç´¢çµæã¯ãªãã¯æï¼åèªãã¼ã¸ã¸é·ç§»
  resultsBox.addEventListener("click", (e) => {
    const item = e.target.closest(".search-bar__result-item");
    if (item) {
      const id = item.dataset.id;
      const word = searchWords.find(w => String(w.id) === String(id));
      if (word) {
        // â¼ å¤æ´: + (%2B) ã $ ã«ç½®æãã¦éä¿¡ï¼ãµã¼ãã¼å´ã§ + ã«æ»ãï¼
        const slug = encodeURIComponent(word.english).replace(/%20/g, "+").replace(/%2B/g, "$").replace(/%2F/g, "/");
        location.href = `/vocabulary/word/${slug}`;
        return;
      }
    }
  });

  // â æ¤ç´¢ãã©ã¼ã éä¿¡ï¼Enter or ãã¿ã³ï¼
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const keywordRaw = input.value.trim();
    if (!keywordRaw) return;

    // â¼ æªèª­è¾¼ãªãã­ã¼ãå®äºå¾ã«åè©ä¾¡ãã¦é·ç§» or 0ä»¶ã¢ã¼ãã«
    if (!searchWords || searchWords.length === 0) {
      resultsBox.innerHTML = `<div class="search-bar__loading">èª­ã¿è¾¼ã¿ä¸­â¦</div>`;
      toggleOverlay(true);
      ensureSearchIndexLoad().then(() => {
        const match = searchWords.find(w => w.english === keywordRaw);
        if (match) {
          // â¼ å¤æ´: + (%2B) ã $ ã«ç½®æ
          const slug = encodeURIComponent(match.english).replace(/%20/g, "+").replace(/%2B/g, "$");
          location.href = `/vocabulary/word/${slug}`;
        } else {
          toggleOverlay(false);
          resultsBox.innerHTML = "";
          showNoResultModal(keywordRaw);
        }
      });
      return;
    }

    // å®å¨ä¸è´ã§åèªãã¼ã¸ã¸é·ç§»
    const match = searchWords.find(w => w.english === keywordRaw);
    if (match) {
      // â¼ å¤æ´: + (%2B) ã $ ã«ç½®æ
      const slug = encodeURIComponent(match.english).replace(/%20/g, "+").replace(/%2B/g, "$");
      location.href = `/vocabulary/word/${slug}`;
      return;
    }
    showNoResultModal(keywordRaw);
    resultsBox.innerHTML = "";
  });
});

// â æ¤ç´¢çµæãªãã¢ã¼ãã«å¶å¾¡
function showNoResultModal(keyword) {
  const modal = document.getElementById("js-no-result-modal");
  const keywordSpan = document.getElementById("js-no-result-keyword");
  keywordSpan.textContent = keyword;
  modal.classList.add("is-open");

  document.getElementById("js-close-no-result").addEventListener("click", () => {
    modal.classList.remove("is-open");
  });

  document.getElementById("js-clear-search").addEventListener("click", () => {
    document.getElementById("search-input").value = "";
    modal.classList.remove("is-open");
  });
  // èæ¯ã¯ãªãã¯ã§éãã
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.remove("is-open");
    document.getElementById("search-input").value = "";
  }
});
}

// ð æ¤ç´¢åè£ã®è¡¨ç¤ºæã«ãªã¼ãã¼ã¬ã¤è¡¨ç¤ºåæ¿
function toggleOverlay(show) {
  const overlay = document.getElementById("search-overlay");
  if (!overlay) return;
  overlay.classList.toggle("is-visible", !!show);
}
// â TP-05: ãªã¼ãã¼ã¬ã¤ã¯ãªãã¯ã§æ¤ç´¢åè£ãéãã
const overlay = document.getElementById("search-overlay");
if (overlay) {
  overlay.addEventListener("click", () => {
    const resultsBox = document.getElementById("js-search-results");
    resultsBox.innerHTML = "";
    toggleOverlay(false); 
  });
}
