// â word-list-pagination.js
// åèªä¸è¦§ãã¼ã¸ã®ãã¼ã¿è¡¨ç¤ºã»ãã¼ã¸ãã¼ã·ã§ã³å¶å¾¡
// - book_idã«å¯¾å¿ããbook_X.csvã¨english_word_courses.csvãé£æº
// - è¡¨ç¤ºå¯¾è±¡ã®åèªãªã¹ããCSVï¼JSONããæ´å½¢
// - 100ä»¶åä½ã§ãã¼ã¸åå²ãã¦è¡¨ç¤º
// - Swiperããã£ã«ã¿ãè¡¨ç¤ºåæ¿ãé³å£°åçãçµ±åå¯¾å¿

let currentMode = "all";

// â applyDisplayModeé¢æ°ã¯ loadAndRenderWordList ã®å¤ã«ç½®ãã¦ãããã¨ï¼
function applyDisplayMode(mode) {
  const ja = document.querySelectorAll(".js-hide-ja");
  const en = document.querySelectorAll(".js-hide-en");
  if (mode === "ja") {
    ja.forEach(el => el.classList.add("is-hidden-ja"));
    en.forEach(el => el.classList.remove("is-hidden-en"));
  } else if (mode === "en") {
    en.forEach(el => el.classList.add("is-hidden-en"));
    ja.forEach(el => el.classList.remove("is-hidden-ja"));
  } else {
    ja.forEach(el => el.classList.remove("is-hidden-ja"));
    en.forEach(el => el.classList.remove("is-hidden-en"));
  }
}

// â¼ è¿½å : ã¨ã¹ã±ã¼ãããã <a> ã¿ã°ãå¾©åãããã«ãã¼é¢æ°
function restoreLinks(text) {
  if (!text) return "";
  // ãä¿®æ­£ãå¾©åãããªã³ã¯ãã onclick="event.stopPropagation()" ãåé¤ï¼word-modal.jså´ã§å¶å¾¡ããããï¼
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

// â DOMContentLoadedå¾ã«å¼ã³åºãï¼éåæã§åææç» â è¡¨ç¤ºãã£ã«ã¿é©ç¨ â ãªãµã¤ãºå¯¾å¿ï¼
document.addEventListener("DOMContentLoaded", async () => {
  await loadAndRenderWordList();            // å®äºãå¾ã£ã¦ããè¡¨ç¤º
  applyDisplayMode(currentMode);            // ç¾å¨ã®è¡¨ç¤ºã¢ã¼ããåæ 
});


// â URLãã©ã¡ã¼ã¿åå¾é¢æ°
function getBookIdFromURL() {
  const params = new URLSearchParams(location.search);
  return params.get('book') || window.BOOK_ID || null;
}

function getCourseFromURL() {
  const params = new URLSearchParams(window.location.search);
  let course = params.get('course');
  if (!course) {
    const m = location.pathname.match(/\/vocabulary\/([^\/]+)/);
    if (m) course = m[1];
  }
  return course;
}

// â åè©ãããã³ã°ï¼æ¥æ¬èªè¡¨è¨ç¨ï¼
const partOfSpeechMap = {
  verb: "å",
  transitive_verb: "å",
  intransitive_verb: "å",
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

// â titleã¿ã° ã¨ meta description ãæ´æ°ããé¢æ°
function updateMetaTags(bookName, bookDescription) {
  // <title> ãå¤æ´
  if (document.querySelector('meta[data-static="true"]')) return;
  document.title = `${bookName} `;

  // <meta name="description"> ããªããã°ä½æ
  let metaDescription = document.querySelector('meta[name="description"]');
  if (!metaDescription) {
    metaDescription = document.createElement('meta');
    metaDescription.name = "description";
    document.head.appendChild(metaDescription);
  }

  // åå®¹ãè¨­å®
  metaDescription.content = bookDescription || `${bookName}ã®è±åèªä¸è¦§ãã¼ã¸ã§ãã`;
}

// â ãã³ã¯ãº/ãã¼ã­ã¼ã»ã¯ã·ã§ã³ã®æ´æ°
function updateHeroSectionFromBookList(bookId) {
  if (!bookId) return;
  getBookList().then(books => {
    const match = books.find(item => item.ID === bookId);
    if (!match) return;

    // â ã¿ã¤ãã«æ´æ°
    document.querySelector(".hero__title").textContent = match.book_name || "";

    // â èª¬ææå¤æ°ã®æºå
    const heroText = document.querySelector(".hero__text");
    if (heroText) {
      heroText.textContent = (match.book_description || '').replace(/\s/g, '');
    }

    // â ã¡ã¿ã¿ã°æ´æ°
    updateMetaTags(match.book_name, match.book_description);

    // â ãã³ã¯ãºç¾å¨å°ãæ´æ°
    const breadcrumbList = document.querySelector(".breadcrumb__list");
    if (breadcrumbList && match.Tier1 && match.book_name) {
      breadcrumbList.innerHTML = `
        <li class="breadcrumb__item"><a href="index.html">åèªå¸³ ä¸è¦§</a></li>
        <li class="breadcrumb__item">
          <a href="${match.tier1_path ? '/vocabulary' + match.tier1_path.replace(/^\/?/, '/')
          : '/vocabulary/' + encodeURIComponent(match.Tier1)}/">
            ${match.Tier1}
          </a>
        </li>
        <li class="breadcrumb__item">
          <a href="${match.full_path}" class="breadcrumb__current" aria-current="page">${match.book_name}</a>
        </li>
      `;
    }

    /* â¼â¼â¼ è¿½å ï¼ã¢ããªã¤ã³ã¹ãã¼ã«ããã¼è¡¨ç¤ºå¦ç â¼â¼â¼ */
    try {
      // 1. æ¢å­ããã¼åé¤ï¼éè¤é²æ­¢ï¼
      const existingBanner = document.querySelector(".hero__banner");
      if (existingBanner) existingBanner.remove();

      // 2. ããã¼è¨­å®ï¼ã«ãã´ãªãã¨ã®ç»åIDã»URLå®ç¾©ï¼
      const BANNER_CONFIG = {
        junior: [
          { id: "1", url: "https://motitan.astran.jp/J4D82A" },
          { id: "2", url: "https://motitan.astran.jp/f8Vpso" },
          { id: "3", url: "https://motitan.astran.jp/Yj6wOc" },
          { id: "4", url: "https://motitan.astran.jp/gj4N6C" },
          { id: "5", url: "https://motitan.astran.jp/srRTkS" },
          { id: "6", url: "https://motitan.astran.jp/jvvHYX" }
        ],
        high: [
          { id: "1", url: "https://motitan.astran.jp/mppPw3" },
          { id: "2", url: "https://motitan.astran.jp/mrP5F4" },
          { id: "3", url: "https://motitan.astran.jp/zZsm0T" },
          { id: "4", url: "https://motitan.astran.jp/hahoEz" },
          { id: "5", url: "https://motitan.astran.jp/gU25Bb" },
          { id: "6", url: "https://motitan.astran.jp/M8upAV" }
        ],
        toeic: [
          { id: "1", url: "https://motitan.astran.jp/K1ecQR" },
          { id: "2", url: "https://motitan.astran.jp/GAa8hb" },
          { id: "3", url: "https://motitan.astran.jp/13iKHv" },
          { id: "4", url: "https://motitan.astran.jp/CK5HM1" },
          { id: "5", url: "https://motitan.astran.jp/39oNvU" },
          { id: "6", url: "https://motitan.astran.jp/Fp5DmZ" }
        ],
        eiken: [
          { id: "1", url: "https://motitan.astran.jp/O47Yfu" },
          { id: "2", url: "https://motitan.astran.jp/lQl7qh" },
          { id: "3", url: "https://motitan.astran.jp/9UQRSx" },
          { id: "4", url: "https://motitan.astran.jp/a1tubr" },
          { id: "5", url: "https://motitan.astran.jp/HQ2yNR" },
          { id: "6", url: "https://motitan.astran.jp/2PzEPo" }
        ],
        default: [
          { id: "1", url: "https://motitan.astran.jp/VoFYIQ" },
          { id: "2", url: "https://motitan.astran.jp/6GfMhm" },
          { id: "3", url: "https://motitan.astran.jp/q12rDv" },
          { id: "4", url: "https://motitan.astran.jp/6dqd8I" },
          { id: "5", url: "https://motitan.astran.jp/wjw1kt" },
          { id: "6", url: "https://motitan.astran.jp/i5lTiF" },
          { id: "7", url: "https://motitan.astran.jp/bnOqOW" }
        ]
      };

      // 3. ã«ãã´ãªå¤å®
      let categorySlug = "default";
      const t1 = match.Tier1 || "";
      if (t1.includes("ä¸­å­¦")) categorySlug = "junior";
      else if (t1.includes("é«æ ¡")) categorySlug = "high";
      else if (t1.includes("TOEIC")) categorySlug = "toeic";
      else if (t1.includes("è±æ¤")) categorySlug = "eiken";

      // 4. è¨­å®ãªã¹ãããã©ã³ãã ã«1ã¤é¸æ
      const configList = BANNER_CONFIG[categorySlug] || BANNER_CONFIG["default"];

      // âã¬ã¼ãå¦ç: è¨­å®ãè¦ã¤ãããªãå ´åã¯çµäºï¼ã¨ã©ã¼åé¿ï¼
      if (!configList || configList.length === 0) {
        console.warn("Banner config not found for:", categorySlug);
        return;
      }

      const selected = configList[Math.floor(Math.random() * configList.length)];
      if (!selected) return;

      // 5. ããã¼çæ
      const bannerLink = document.createElement("a");
      bannerLink.className = "hero__banner"; // CSSã¯ã©ã¹
      bannerLink.href = selected.url;        // åå¥URL
      bannerLink.target = "_blank";          // å¥ã¿ã

      const img = document.createElement("img");
      img.src = `image/banner/banner_app_${categorySlug}_${selected.id}.png`; // ç»åãã¹
      img.alt = "ã¢ãã¿ã³ã¢ããªã§å­¦ç¿å¹çã¢ããï¼";

      // ç»åã­ã¼ãã¨ã©ã¼æã¯ããã¼ãã¨éè¡¨ç¤ºã«ãã
      img.onerror = () => {
        bannerLink.style.display = "none";
      };

      bannerLink.appendChild(img);

      // 6. èª¬ææã®ç´åã«æ¿å¥
      if (heroText && heroText.parentNode) {
        heroText.parentNode.insertBefore(bannerLink, heroText);
      }
    } catch (e) {
      console.error("Banner display error:", e);
    }
  });
}


// â åèªä¸è¦§ï¼ãã¼ã¸ãã¼ã·ã§ã³ã®åæåï¼Swiperç¨recommendSwiperBooksãçæï¼
async function loadAndRenderWordList() {
  const wordListContainer = document.getElementById("js-word-list");

  // â¼ è¿½å : ãªã¹ãåã®ãªã³ã¯ã¯ãªãã¯æã¯ã¤ãã³ãä¼æ­ãæ­¢ãã
  // ããã«ãããè¦ªè¦ç´ ãdocumentã¸ã®ãããªã³ã°ãé²ããã¢ã¼ãã«å±éãç©ççã«é»æ­¢ãã¾ã
  // if (wordListContainer) {
  //   wordListContainer.addEventListener("click", (e) => {
  //     if (e.target.closest("a")) {
  //       e.stopPropagation();
  //     }
  //   });
  // }

  const paginationTop = document.getElementById("js-pagination-top");
  const paginationBottom = document.getElementById("js-pagination-bottom");
  const toggleButtons = document.querySelectorAll(".display-toggle__btn");
  const dictionaryPath = 'data/dictionary_new/';
  const jsonCache = new Map();

  const bookId = getBookIdFromURL();
  // â book ID ãæå®ããã¦ããªãå ´åã¯ã¹ã­ããï¼ä¾ï¼word.html ãªã©ã§æ­£å¸¸ï¼
  // ãã®è­¦åã¯ç¹å®ã®ãã¼ã¸ã§ã¯ä»æ§ä¸çºçãã¾ãï¼ã¨ã©ã¼ã§ã¯ããã¾ããï¼
  if (!bookId) {
    console.info("â ï¸ book ID ãæå®ããã¦ããªããããloadAndRenderWordList ãã¹ã­ãããã¾ãã");
    return;
  }

  // â¼ èª­ã¿è¾¼ã¿ãã¬ã¼ã¹ãã«ããè¡¨ç¤ºï¼KISS: ã¤ã³ã©ã¤ã³ã¹ã¿ã¤ã«ï¼
  if (wordListContainer) {
    wordListContainer.setAttribute('aria-busy', 'true');
    wordListContainer.innerHTML =
      '<div class="word-list__loading" ' +
      'style="padding:32px 16px;text-align:center;font-size:20px;font-weight:700;line-height:1.7;">èª­ã¿è¾¼ã¿ä¸­...</div>';
  }

  const courseParam = getCourseFromURL();
  updateHeroSectionFromBookList(bookId);
  generateRecommendSwiperBooks(bookId);

  // â½ è¿½å ï¼ã¬ã³ã¡ã³ãã»ã¯ã·ã§ã³ã®ä¸ã«ããã¼ãæ¿å¥
  renderRecommendBanner(bookId);

  let allWords = [];
  let currentPage = 1;
  const perPage = 100;
  const maxVisiblePages = 5;
  const bookCsvPath = `data/book_word_list/book_${bookId}.csv`;
  // â book_X.csv ãåã«èª­ã¿è¾¼ãã§IDä¸è¦§åå¾
  if (!bookId) {
    console.error("â book ID ãæå®ããã¦ãã¾ããã");
    return;
  }

  let bookWordIds = [];

  // â book_idã«ç´ã¥ãåèªIDä¸è¦§ãèª­ã¿è¾¼ã¿ï¼book_X.csvï¼
  bookWordIds = await new Promise((resolve) => {
    Papa.parse(bookCsvPath, {
      download: true,
      header: true,
      complete: (results) => {
        //Debug
        if (results.data.length > 0) {
          console.log("CSVã®ã­ã¼ä¸è¦§:", Object.keys(results.data[0]));
        }
        const ids = results.data.map(row => row.id).filter(Boolean);
        resolve(ids);
      }
    });
  });

  try {
    const apiUrl = `api/book_word.php?id=${encodeURIComponent(bookId)}`;
    const resp = await fetch(apiUrl, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const rows = await resp.json();

    const baseWords = rows.map(w => ({
      id: w.id,
      english: w.english,
      translation: w.translation,
      part_of_speech: w.part_of_speech,
      course: w.course || "",
      courseSlug: courseParam || "",
      importance: Number(w.importance) || 9999,
      example: w.example || "",
      example_translation: w.example_translation || "",
      sound: w.sound || ""
    })).sort((a, b) => a.importance - b.importance);

    // â Swiperè¡¨ç¤ºã«å¿è¦ï¼æ¢å­ï¼
    generateRecommendSwiperBooks(bookId);

    // â è¡¨ç¤ºç¨ã«ã»ããï¼goToPageãä½¿ãï¼
    window.wordDataArray = baseWords;
    allWords = baseWords;

    // â Heroã«ã¦ã³ãæ´æ°ï¼æ¢å­ï¼
    const heroCountEl = document.querySelector(".hero__count");
    if (heroCountEl) {
      heroCountEl.innerHTML =
        `<img src="/vocabulary/image/words_count_icon.png" class="hero__count-icon">${baseWords.length}åèª`;
    }

    // â è¡¨ç¤ºéå§ï¼éæ¬¡æç»ï¼
    await goToPage(currentPage);
  } catch (e) {
    console.error("â book words API error:", e);
  }

  // â Swiperç¨ã®æ¨è¦åèªå¸³ã¹ã©ã¤ããæºåãã¦windowã«æ ¼ç´
  function generateRecommendSwiperBooks(currentBookId) {
    getBookList().then(books => {
      const currentBook = books.find(book => book.ID === currentBookId);
      if (!currentBook) return;

      const currentTier1 = currentBook.Tier1;
      const sameCourseBooks = books.filter(b => b.Tier1 === currentTier1);
      // â è¦åºãï¼ããããã¹ã©ã¤ãã¼ã®ããããã¿ã¤ãã«ï¼ãæ¸ãæãï¼Tier1ãã¨ã«ã¡ãã»ã¼ã¸ãå¤æ´ï¼
      const heading = document.querySelector(".recommend-swiper__heading");
      if (heading && currentTier1) {
        let message = "";
        switch (currentTier1) {
          case "ä¸­å­¦":
            message = "ä¸­å­¦è±èªã®å­¦ç¿ã«ãã¡ããããããï¼";
            break;
          case "é«æ ¡":
            message = "å¤§å­¦åé¨ã«åãã¦ãã¡ããããããï¼";
            break;
          case "TOEIC":
            message = "TOEICå¯¾ç­ã«ãã¡ããããããï¼";
            break;
          case "è±æ¤":
            message = "è±æ¤å¯¾ç­ã«ãã¡ããããããï¼";
            break;
          default:
            message = `${currentTier1}ã®å­¦ç¿ã«ãã¡ããããããï¼`;
        }
        heading.textContent = message;
      }

      // â Tier2_orderâTier3_orderã®é ã«ã½ã¼ãï¼null/ç©ºæ¬ã¯999ã¨ãã¦æ±ãï¼
      const filteredBooks = sameCourseBooks
        .filter(book => book.ID && book.book_name)
        .map(book => ({
          id: book.ID,
          title: book.book_name,
          image: `data/book_image/book_${book.ID}.png`,
          tier1: book.Tier1,
          tier2_order: parseInt(book.Tier2_order || 999),
          tier3_order: parseInt(book.Tier3_order || 999),
          url: book.full_path
        }))
        .sort((a, b) => {
          if (a.tier2_order !== b.tier2_order) return a.tier2_order - b.tier2_order;
          return a.tier3_order - b.tier3_order;
        });

      // â Swiperè¡¨ç¤ºç¨ãã¼ã¿ãwindowã«æ ¼ç´
      window.recommendSwiperBooks = filteredBooks;
      document.dispatchEvent(new Event("recommendReady"));
    });
    // æ¢ã« DOMContentLoaded æã« resize â applyDisplayMode ãç»é²æ¸ã¿ã
    // ã¹ãã UI ã®ä¼¸ç¸®æã¯ãç¾å¨ãã¼ã¸ããã®ã¾ã¾åæç»ï¼ãã¹ã¯åé©ç¨ã
    window.addEventListener("resize", () => {
      const start = (currentPage - 1) * perPage;
      const pageWords = window.wordDataArray.slice(start, start + perPage);
      // â ãã¼ã¸åé ­ã®ãªãã¸ã§ã¯ãã« json ãã­ããã£ããããã§å¤å®
      const alreadyHasJson = pageWords.length && pageWords[0].json;
      goToPage(currentPage, {
        skipReload: alreadyHasJson
      }); // â åé¨ã§ applyDisplayMode ãå®è¡
    });
  }


  // æå®ãã¼ã¸ã«åãæ¿ã
  async function goToPage(page, options = {}) {
    currentPage = page;

    const start = (page - 1) * perPage;
    const pageWords = window.wordDataArray.slice(start, start + perPage);

    // â¼ ãã¼ã¸åæ¿ãã¼ã¯ã³ã§ç«¶åãææ­¢ï¼æ°ãããã¼ã¸é·ç§»ãæ¥ããå¤ãå¦çã¯é»ã£ã¦ä¸­æ­ï¼
    const token = ++currentPageToken;

    if (options.skipReload) {
      renderWordList(pageWords);
      const totalCount = window.wordDataArray?.length || allWords.length || 0;
      renderPagination(currentPage, Math.ceil(totalCount / perPage));
      applyDisplayMode(currentMode);
      return;
    }

    // â¼ åã«ã³ã³ãããç©ºã«ãã¦ããã¼ã¸ãã¼ã·ã§ã³ã ãåºãã¦ããï¼UIãåã«å®å®ãããï¼
    wordListContainer.innerHTML = '';
    renderPagination(currentPage, Math.ceil((window.wordDataArray?.length || 0) / perPage));

    // â¼ åææ°å¶éã§ JSON ãåå¾ããå°çé ã§1ä»¶ãã¤æç»
    const ids = pageWords.map(w => w.id);

    // â async ãè¿½å ãã¦ãä¸­ã§ await ãä½¿ããããã«ãã¾ã
    await fetchWithConcurrency(ids, MAX_CONCURRENCY, async (json, idx) => {
      if (token !== currentPageToken) return;

      const base = pageWords[idx];
      const merged = { ...base, json };

      const globalIdx = window.wordDataArray.findIndex(v => v.id === base.id);
      if (globalIdx !== -1) window.wordDataArray[globalIdx] = merged;

      // 1. ã¾ãåèªãæç»ããï¼å±ããé ã«æ­£ããä½ç½®ã¸ï¼
      renderWordList([merged], { append: true, offset: idx });

      // 2. âè¿½å ï¼1ãã¼ã¸ç®ã®10ä»¶ç®ï¼ã¤ã³ããã¯ã¹9ï¼ãæç»å®äºããããããã¼ãå¥ãã
      if (page === 1 && idx === 9) {
        const banner = await createAdBannerElement(bookId);
        if (banner) {
          // æç»ãããã°ããã®10ä»¶ç®ã®è¦ç´ ãåå¾
          const tenthCard = wordListContainer.children[9];
          if (tenthCard) {
            tenthCard.after(banner); // 10ä»¶ç®ã®ããå¾ãã«ããã¼ãè¨­ç½®
          }
        }
      }

      applyDisplayMode(currentMode);
    });

    // â¼ åå¾å®äºå¾ããã¾ã åããã¼ã¸ãªããã¼ã¸ãã¼ã·ã§ã³ãæçµæ´æ°
    if (token !== currentPageToken) return;
    renderPagination(currentPage, Math.ceil((window.wordDataArray?.length || 0) / perPage));
    applyDisplayMode(currentMode);

    // â¼ ååæç»å¾ã« aria-busy ãè§£é¤
    wordListContainer.removeAttribute('aria-busy');
  }

  // åèªãªã¹ããHTMLã«åºå
  function renderWordList(data, options = {}) {
    const { append = false, offset = 0 } = options;

    if (!append) {
      wordListContainer.innerHTML = '';
    }

    // â¼ è¿½å : course â slug åºå®ãããã³ã°ï¼ãã®é¢æ°ã­ã¼ã«ã«ã«éå®ï¼
    const COURSE_SLUG_MAP = {
      "ä¸­å­¦è±èª": "junior",
      "é«æ ¡è±èª": "high",
      "TOEICÂ®": "toeic",
      "è±æ¤Â®": "eiken"
    };

    data.forEach((word, index) => {
      // çºé³ï¼[xxx]ã®å½¢å¼ã«æ´å½¢
      let pronunciation = "";

      if (word.json?.pronunciation) {
        const mainPOS = word.part_of_speech || "";
        const posInJapanese = partOfSpeechMap[mainPOS] || "";
        const cleaned = word.json.pronunciation
          .replace(/\[.*?\]/g, "")
          .replace(/\([^)]*\)/g, "")
          .replace(/\|/g, "")
          .trim();
        const match = cleaned.match(/[^\s;|]+/);
        if (match) {
          pronunciation = `[${match[0]}]`;
        }
      }

      const meaningsByPOS = {};

      // mainè¨³ãæåã«åé¡
      if (word.translation) {
        const pos = partOfSpeechMap[word.part_of_speech] || word.part_of_speech;
        meaningsByPOS[pos] = meaningsByPOS[pos] || [];
        meaningsByPOS[pos].push(renderJaTranslationLink(word.translation, true));
      }

      // other_translationsãè¿½å 
      (word.json?.other_translations || []).forEach(item => {
        const pos = partOfSpeechMap[item.part_of_speech] || item.part_of_speech;
        if (item.translation) {
          meaningsByPOS[pos] = meaningsByPOS[pos] || [];
          meaningsByPOS[pos].push(renderJaTranslationLink(item.translation));
        }
      });

      // æå³HTMLãçæ
      const partOfSpeechAreaHTML = `
        <div class="part-of-speech__area">
          ${Object.entries(meaningsByPOS).map(([pos, list]) => `
            <div class="word-card__main-meaning">
              <span class="word-card__part-of-speech">${pos}</span>
              <span class="word-card__translation js-hide-ja">${restoreLinks(list.join("ã"))}</span>
            </div>
          `).join('')}
        </div>`;

      // ãã¬ã¼ãºï¼phrasesï¼
      const phrasesHTML = (word.json?.phrases || []).map(p => {
        const phraseText = p.english?.replace(new RegExp(`\\|${word.english}\\|`, 'g'), `<span class="highlight">${word.english}</span>`).replace(/\|/g, '') || p.english;
        return `
        <div class="word-card__phrase">
          <span><span class="word-card__icon">â</span><span class="word-card__phrase-text js-hide-en">${restoreLinks(phraseText)}</span></span>
          <span class="word-card__phrase-translation js-hide-ja">${restoreLinks(p.translation)}</span>
        </div>`;
      }).join('');

      // æ´¾çèªï¼derivativesï¼
      const derivativesHTML = (word.json?.derivatives || []).map(d => `
        <div class="word-card__derivative">
          <span><span class="word-card__icon">â</span><span class="word-card__derivative-word js-hide-en">${restoreLinks(d.english)}</span></span>
          <span><span class="word-card__derivative-pos">${partOfSpeechMap[d.part_of_speech] || d.part_of_speech}</span><span class="word-card__derivative-meaning js-hide-ja">${restoreLinks(d.translation)}</span></span>
        </div>`).join('');

      // å¯¾ç¾©èªï¼antonymsï¼
      const antonymsHTML = (word.json?.antonyms || []).map(a => `
        <div class="word-card__antonym">
          <span><span class="word-card__icon">âï¸</span><span class="word-card__antonym-word js-hide-en">${restoreLinks(a.english)}</span></span>
          <span><span class="word-card__antonym-pos">${partOfSpeechMap[a.part_of_speech] || a.part_of_speech}</span><span class="word-card__antonym-meaning js-hide-ja">${restoreLinks(a.translation)}</span></span>
        </div>`).join('');

      // ä¾æï¼ãã¤ã©ã¤ãä»ï¼
      let exampleHtml = "";
      const rawExample = word.example || "";

      if (rawExample.includes('|')) {
        // ãã¤ããããå ´åï¼ãã¤ãåã®æå­ããã¤ã©ã¤ããããã¤ããé¤å»ï¼HTMLã¿ã°ç ´å£é²æ­¢ï¼
        const highlighted = rawExample.replace(/\|(.+?)\|/g, '<span class="word-card__highlight js-hide-en">$1</span>');
        // æ®ã£ããã¤ããããã°åé¤ãã¦ãªã³ã¯å¾©å
        exampleHtml = restoreLinks(highlighted.replace(/\|/g, ''));
      } else {
        // ãã¤ãããªãå ´åï¼åèªãã®ãã®ãæ­£è¦è¡¨ç¾ã§ç½®æï¼æ¢å­ã­ã¸ãã¯ï¼
        const highlighted = rawExample.replace(new RegExp(`\\b(${word.english})\\b`, 'gi'), '<span class="word-card__highlight js-hide-en">$1</span>');
        exampleHtml = restoreLinks(highlighted);
      }

      // ç»åãã¹ï¼course â åºå®ããã â slugï¼ãæªè§£æ±ºæã¯æ¢å­ã® courseParam ããã©ã¼ã«ããã¯
      const mappedSlug = COURSE_SLUG_MAP[(word.course || '').trim()];
      const imagePath = `Img/${mappedSlug || courseParam}/${word.english}.jpg`;

      // â¼ ã³ã¢ã¤ã¡ã¼ã¸
      const coreImageLine = (word.json?.core_image || '').toString().trim();
      const coreImageHTML = coreImageLine
        ? `<p class="word-card__core-image js-hide-ja"><span class="word-card__example-prefix">(ã³ã¢)</span> ${restoreLinks(coreImageLine)}</p>`
        : '';

      // â¼ è¡¨ç¤ºç¨ã®éãçªå·ï¼ãã¼ã¸åé ­ããã® offset ãèæ®ï¼
      const displayIndex = (index + offset + 1) + (currentPage - 1) * perPage;

      const card = document.createElement("article");
      card.className = "word-card";
      card.dataset.id = word.id;
      card.dataset.importance = word.importance;
      card.innerHTML = `
        <div class="word-card__inner">
          <div class="word-card__info">
            <div class="word-card__index">${displayIndex}</div>
            <div class="word-area">
              <h3 class="word-card__english js-hide-en">
                <a href="word.php?slug=${encodeURIComponent(word.english)}" class="word-highlight" style="color: inherit; text-decoration: none;">${word.english}</a>
              </h3>
              <p class="word-card__pronunciation js-hide-en">${pronunciation}</p>
            </div>
            <button class="word-card__sound" data-audio="wordsound/${word.sound}_1.mp3">
              <img src="image/btn_sound.png" alt="çºé³åç">
            </button>
          </div>
          <div class="word-card__details" data-word-id="${word.id}">
            ${partOfSpeechAreaHTML}
            ${phrasesHTML}
            ${derivativesHTML}
            ${antonymsHTML}
            <div class="word-card__example">
              <p class="word-card__example-en"><span class="word-card__example-prefix">(ä¾)</span>${exampleHtml}</p>
              <p class="word-card__example-ja js-hide-ja">${restoreLinks(word.example_translation || '')}</p>
            </div>
            ${coreImageHTML}
          </div>
          <div class="word-card__image-area">
            <img src="${imagePath}" alt="${word.english}ã®ã¤ã©ã¹ã" class="word-card__image">
          </div>
        </div>`;
      // â¼ å¤æ´ç¹: appendæã¯ children[offset] ã®ç´åã«æ¿å¥ï¼ä¸¦ã³é ãå¸¸ã«å®å®ï¼
      if (append) {
        let targetIndex = offset;

        // â1ãã¼ã¸ç®ã§ããã§ã«ããã¼ãæ¿å¥ããã¦ããã
        // ãã¤æç»ãããã¨ãã¦ããåèªã11çªç®ä»¥é(offset 10ä»¥ä¸)ãªããä½ç½®ã1ã¤ããã
        const existingBanner = document.getElementById("js-list-banner");
        if (currentPage === 1 && existingBanner && offset >= 10) {
          targetIndex++;
        }

        const beforeNode = wordListContainer.children[targetIndex] || null;
        wordListContainer.insertBefore(card, beforeNode);
      } else {
        wordListContainer.appendChild(card);
      }
    });
  }

  window.renderWordList = renderWordList;
  window.goToPage = goToPage;
  window.applyDisplayMode = applyDisplayMode;

  // â ãã¼ã¸ãã¼ã·ã§ã³è¡¨ç¤º
  function renderPagination(current, total) {
    const isSP = window.innerWidth <= 742;
    const maxVisiblePages = isSP ? 3 : 5;
    const isFirstPage = current === 1;
    const isLastPage = current === total;

    [paginationTop, paginationBottom].forEach(container => {
      container.innerHTML = '';
      const ul = document.createElement("ul");
      ul.className = "pagination__list";

      // â åã¸ãã¿ã³
      const prev = document.createElement("li");
      const prevButton = document.createElement("button");
      prevButton.className = "pagination__arrow pagination__arrow--prev";
      prevButton.setAttribute("aria-label", "åã®ãã¼ã¸");
      prevButton.innerHTML = "&lt;";
      if (isFirstPage) prevButton.disabled = true;
      prevButton.addEventListener("click", () => {
        if (!isFirstPage) {
          goToPage(current - 1);
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        }
      });
      prev.appendChild(prevButton);
      ul.appendChild(prev);

      // ======== ãã¼ã¸ç¯å²ã®è¨ç® ========
      let startPage, endPage;

      if (total <= maxVisiblePages) {
        startPage = 1;
        endPage = total;
      } else {
        const half = Math.floor(maxVisiblePages / 2);
        if (current <= half + 1) {
          startPage = 1;
          endPage = maxVisiblePages;
        } else if (current >= total - half) {
          startPage = total - maxVisiblePages + 1;
          endPage = total;
        } else {
          startPage = current - half;
          endPage = current + half;
        }
      }

      // ... çç¥è¨å·ï¼åæ¹ï¼
      if (startPage > 1) {
        const dotsPrev = document.createElement("li");
        dotsPrev.textContent = "...";
        ul.appendChild(dotsPrev);
      }

      // ======== ãã¼ã¸çªå·ãªã³ã¯ ========
      for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#";
        a.className = "pagination__link";
        if (i === current) a.classList.add("is-current");
        a.textContent = `[${(i - 1) * perPage + 1}-${Math.min(i * perPage, window.wordDataArray.length)}]`;

        a.addEventListener("click", e => {
          e.preventDefault();
          goToPage(i);
          window.scrollTo({ top: 0, behavior: "smooth" });
        });

        li.appendChild(a);
        ul.appendChild(li);
      }

      // ... çç¥è¨å·ï¼å¾æ¹ï¼
      if (endPage < total) {
        const dotsNext = document.createElement("li");
        dotsNext.textContent = "...";
        ul.appendChild(dotsNext);
      }

      // â æ¬¡ã¸ãã¿ã³
      const next = document.createElement("li");
      const nextButton = document.createElement("button");
      nextButton.className = "pagination__arrow pagination__arrow--next";
      nextButton.setAttribute("aria-label", "æ¬¡ã®ãã¼ã¸");
      nextButton.innerHTML = "&gt;";
      if (isLastPage) nextButton.disabled = true;
      nextButton.addEventListener("click", () => {
        if (!isLastPage) {
          goToPage(current + 1);
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        }
      });
      next.appendChild(nextButton);
      ul.appendChild(next);

      container.appendChild(ul);
    });
  }


  // ãªãµã¤ãº
  currentPage = 1;

  // â é³å£°åçãã¿ã³
  document.addEventListener("click", e => {
    const btn = e.target.closest(".word-card__sound");
    if (!btn) return;
    const audioSrc = btn.dataset.audio;
    if (!audioSrc) return;
    const audio = new Audio(audioSrc);
    audio.play().catch(err => console.error("ð åçã¨ã©ã¼", err));
  });

  // â è¡¨ç¤ºåæ¿ãï¼å¨è¡¨ç¤ºã»æ¥æ¬èªã»è±èªã®ã¿ï¼
  // â ãã£ã«ã¿ãã¿ã³ã®åæè¨­å®ï¼ã¯ãªãã¯æã« currentMode ãæ´æ°ï¼
  toggleButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      toggleButtons.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentMode = btn.dataset.mode; // â ç¾å¨ã¢ã¼ããè¨é²
      applyDisplayMode(currentMode);
    });
  });


  // â ã¢ã¼ãã«è¡¨ç¤ºããªã¬ã¼
  document.addEventListener("click", e => {
    // â .word-card__details ãã¯ãªãã¯ããã¨ãã ãåå¿ãã
    const details = e.target.closest(".word-card__details");
    if (details) {
      const card = details.closest(".word-card");
      if (card) {
        const id = card.dataset.id;
        const word = window.wordDataArray.find(w => w.id === id);
        if (word) {
          openWordModal(word);
        }
      }
    }
  });
}

/**
 * ã«ãã´ãªã«å¿ããããã¼è¦ç´ ãçæãã
 */
async function createAdBannerElement(bookId) {
  const books = await getBookList();
  const match = books.find(item => item.ID === bookId);
  if (!match) return null;

  // æ¢å­ã® BANNER_CONFIG ãããã«ç§»åãã¾ãã¯ã¹ã³ã¼ãåã§åç§ã§ããããã«ãã
  const BANNER_CONFIG = {
    junior: [
      { id: "1", url: "https://motitan.astran.jp/J4D82A" },
      { id: "2", url: "https://motitan.astran.jp/f8Vpso" },
      { id: "3", url: "https://motitan.astran.jp/Yj6wOc" },
      { id: "4", url: "https://motitan.astran.jp/gj4N6C" },
      { id: "5", url: "https://motitan.astran.jp/srRTkS" },
      { id: "6", url: "https://motitan.astran.jp/jvvHYX" }
    ],
    high: [
      { id: "1", url: "https://motitan.astran.jp/mppPw3" },
      { id: "2", url: "https://motitan.astran.jp/mrP5F4" },
      { id: "3", url: "https://motitan.astran.jp/zZsm0T" },
      { id: "4", url: "https://motitan.astran.jp/hahoEz" },
      { id: "5", url: "https://motitan.astran.jp/gU25Bb" },
      { id: "6", url: "https://motitan.astran.jp/M8upAV" }
    ],
    toeic: [
      { id: "1", url: "https://motitan.astran.jp/K1ecQR" },
      { id: "2", url: "https://motitan.astran.jp/GAa8hb" },
      { id: "3", url: "https://motitan.astran.jp/13iKHv" },
      { id: "4", url: "https://motitan.astran.jp/CK5HM1" },
      { id: "5", url: "https://motitan.astran.jp/39oNvU" },
      { id: "6", url: "https://motitan.astran.jp/Fp5DmZ" }
    ],
    eiken: [
      { id: "1", url: "https://motitan.astran.jp/O47Yfu" },
      { id: "2", url: "https://motitan.astran.jp/lQl7qh" },
      { id: "3", url: "https://motitan.astran.jp/9UQRSx" },
      { id: "4", url: "https://motitan.astran.jp/a1tubr" },
      { id: "5", url: "https://motitan.astran.jp/HQ2yNR" },
      { id: "6", url: "https://motitan.astran.jp/2PzEPo" }
    ],
    default: [
      { id: "1", url: "https://motitan.astran.jp/VoFYIQ" },
      { id: "2", url: "https://motitan.astran.jp/6GfMhm" },
      { id: "3", url: "https://motitan.astran.jp/q12rDv" },
      { id: "4", url: "https://motitan.astran.jp/6dqd8I" },
      { id: "5", url: "https://motitan.astran.jp/wjw1kt" },
      { id: "6", url: "https://motitan.astran.jp/i5lTiF" },
      { id: "7", url: "https://motitan.astran.jp/bnOqOW" }
    ]
  };

  let categorySlug = "default";
  const t1 = match.Tier1 || "";
  if (t1.includes("ä¸­å­¦")) categorySlug = "junior";
  else if (t1.includes("é«æ ¡")) categorySlug = "high";
  else if (t1.includes("TOEIC")) categorySlug = "toeic";
  else if (t1.includes("è±æ¤")) categorySlug = "eiken";

  const configList = BANNER_CONFIG[categorySlug] || BANNER_CONFIG["default"];
  const selected = configList[Math.floor(Math.random() * configList.length)];

  const bannerLink = document.createElement("a");
  bannerLink.id = "js-list-banner"; // âå¤å®ç¨ã«IDãä»ä¸
  bannerLink.className = "hero__banner list-ad-banner";
  bannerLink.href = selected.url;
  bannerLink.target = "_blank";

  const img = document.createElement("img");
  img.src = `image/banner/banner_app_${categorySlug}_${selected.id}.png`;
  img.alt = "ã¢ãã¿ã³ã¢ããªã§å­¦ç¿å¹çã¢ããï¼";
  img.onerror = () => bannerLink.style.display = "none";

  bannerLink.appendChild(img);
  return bannerLink;
}

// 1) åæå®è¡æ°ã®ä¸éï¼å¿è¦ãªãããã 8â12 ç­ã«èª¿æ´ï¼
const MAX_CONCURRENCY = 8;

// 2) åå¾çµæã®ã¡ã¢åï¼Promiseãã¨ä¿æãã¦éè¤ãªã¯ã¨ã¹ããåé¿ï¼
const wordJsonCache = new Map(); // key: id, value: Promise<json or data>

// 3) ãã¼ã¸æç»ã®ç«¶åãé²ãããã®ãã¼ã¯ã³
let currentPageToken = 0;

// 4) åèªJSONã1ä»¶åå¾ï¼ã­ã£ãã·ã¥å©ç¨ï¼
function fetchWordJson(id) {
  if (wordJsonCache.has(id)) return wordJsonCache.get(id);

  // â¼ ãã¹ä¿®æ­£: data/dictionary_new/{id}.jsonï¼404åé¿ï¼
  const p = fetch(`data/dictionary_new/${id}.json`, { cache: "force-cache" })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} for id=${id}`);
      return res.json();
    })
    .catch(err => {
      wordJsonCache.delete(id);
      throw err;
    });

  wordJsonCache.set(id, p);
  return p;
}

// 5) åæå®è¡æ°ãå¶éãã¦é æ¬¡å¦çï¼onEachã§æ®µéæç»ï¼
async function fetchWithConcurrency(ids, concurrency, onEach) {
  const results = new Array(ids.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= ids.length) break;

      const id = ids[idx];
      try {
        const data = await fetchWordJson(id);
        results[idx] = data;
        // å°çé ã«1ä»¶ãã¤æç»ï¼å¿è¦ãªãæ¢å­ã®1ä»¶æç»é¢æ°ãå¼ã¶ï¼
        if (typeof onEach === "function") onEach(data, idx);
      } catch (e) {
        // åå¾å¤±æã¯ã¹ã­ããï¼çµæã¯ undefined ã®ã¾ã¾ï¼
        // å¿è¦ãªãããã§ç°¡æãªãã©ã¤ï¼KISSã®ããä»åã¯æªå®è£ï¼
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker());
  await Promise.all(workers);
  return results.filter(Boolean);
}

/**
 * ã¬ã³ã¡ã³ãã¨ãªã¢å°ç¨ã®ããã¼æ¿å¥é¢æ°
 */
async function renderRecommendBanner(bookId) {
  const recommendSection = document.querySelector(".recommend-swiper"); //
  if (!recommendSection) return;

  // æ¢ã«å®ç¾©ããã¦ããããã¼çæã­ã¸ãã¯ãæ´»ç¨
  const banner = await createAdBannerElement(bookId); //
  if (banner) {
    // éè¤é²æ­¢ã¨è¦ãç®ã®èª¿æ´
    banner.id = "js-recommend-top-banner";
    banner.style.marginTop = "60px";
    banner.style.marginBottom = "20px";

    // ããã®ä»ã®å­¦ç¿ããã»ã¯ã·ã§ã³ã®ç´åã«æ¿å¥
    recommendSection.parentNode.insertBefore(banner, recommendSection);
  }
}

