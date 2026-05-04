// book-list-cache.js
// CSV â Promise ã1åã ãä½ããçµæã¯ã¡ã¢ãªã«ã­ã£ãã·ã¥ï¼KISSï¼
(() => {
  const csvPromiseCache = {};

  function toAbsoluteUrl(path) {
    try {
      return new URL(path, location.origin).href;
    } catch {
      return path;
    }
  }

  function papaParse(url, opts = {}) {
    return new Promise((resolve, reject) => {
      if (typeof Papa === "undefined") return reject(new Error("Papa.parse not found"));
      Papa.parse(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        ...opts,
        complete: (res) => resolve(res.data || []),
        error: (err) => reject(err),
      });
    });
  }

  function parseCsvOnce(url, opts = {}) {
    const key = JSON.stringify({ url, opts });
    if (csvPromiseCache[key]) return csvPromiseCache[key];
    const p = papaParse(url, opts);
    csvPromiseCache[key] = p;
    return p;
  }

  function withTimeout(promise, ms = 5000) {
    return new Promise((resolve, reject) => {
      const id = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(v => { clearTimeout(id); resolve(v); })
             .catch(e => { clearTimeout(id); reject(e); });
    });
  }

  async function parseWithWorkerFallback(urlPath) {
    const abs = toAbsoluteUrl(urlPath);
    try {
      // ã¾ã worker:trueï¼çµ¶å¯¾URLï¼ã§è©¦ããä¸å®æéã§ã¿ã¤ã ã¢ã¦ãã
      return await withTimeout(papaParse(abs, { worker: true }), 5000);
    } catch (_) {
      // ãã©ã¼ã«ããã¯ï¼ã¡ã¤ã³ã¹ã¬ããã§ç¢ºå®ã«åå¾
      return await papaParse(abs, { worker: false });
    }
  }

  // å±æã­ã¼ã
  window.getBookList = () => parseCsvOnce("data/book_list.csv");

  // åèªæ¤ç´¢ç¨CSVï¼çµ¶å¯¾URLï¼ãã©ã¼ã«ããã¯ï¼ãå¤±ææã¯ã­ã£ãã·ã¥ç ´æ£ãã¦æ¬¡ååè©¦è¡å¯ã
  window.getWordCourses = () => {
    const key = "__word_courses__";
    if (csvPromiseCache[key]) return csvPromiseCache[key];
    const p = parseWithWorkerFallback("/vocabulary/data/english_word_courses.csv")
      .catch(err => {
        delete csvPromiseCache[key];
        throw err;
      });
    csvPromiseCache[key] = p;
    return p;
  };
})();
