// åèªä¸è¦§ãã¼ã¸ã®ãã¼ã¿è¡¨ç¤ºã»ãã¼ã¸ãã¼ã·ã§ã³å¶å¾¡
// - book_idã«å¯¾å¿ããbook_X.csvã¨english_word_courses.csvãé£æº
// - è¡¨ç¤ºå¯¾è±¡ã®åèªãªã¹ããCSVï¼JSONããæ´å½¢
// - 100ä»¶åä½ã§ãã¼ã¸åå²ãã¦è¡¨ç¤º
// - Swiperããã£ã«ã¿ãè¡¨ç¤ºåæ¿ãé³å£°åçãçµ±åå¯¾å¿



document.addEventListener('DOMContentLoaded', () => {
  // ã½ã¼ããã­ãããã¦ã³éé
  // â .sort-dropdown ãå­å¨ããªãå ´åã¯ã¹ã­ããï¼ä¾ï¼ããããã¼ã¸ãªã©ï¼
  const sortDropdown = document.querySelector(".sort-dropdown");
  if (!sortDropdown) {
    console.info("â ï¸ .sort-dropdown ãè¦ã¤ããã¾ãããword-list-controls.js ã®å¦çãã¹ã­ãããã¾ãã");
    return;
    }
  const sortButton = sortDropdown.querySelector('.sort-dropdown__button');
  const sortIcon = sortDropdown.querySelector('.sort-icon');
  const sortMenu = sortDropdown.querySelector('.sort-dropdown__menu');
  const sortItems = sortDropdown.querySelectorAll('.sort-dropdown__item');

  const toggleMenu = () => {
    sortDropdown.classList.toggle('is-open');
  };

  sortButton.addEventListener('click', toggleMenu);
  sortIcon.addEventListener('click', toggleMenu);

  sortItems.forEach(item => {
    item.addEventListener('click', () => {
      sortItems.forEach(i => i.classList.remove('is-active'));
      item.classList.add('is-active');
      sortButton.textContent = item.textContent;

      sortDropdown.classList.remove('is-open');

      const selectedSort = item.dataset.sort;
      sortWordList(selectedSort); 
    });
  });

  // ãã­ãããã¦ã³ä»¥å¤ãã¯ãªãã¯ãããéãã
  document.addEventListener('click', (e) => {
    if (!sortDropdown.contains(e.target)) {
      sortDropdown.classList.remove('is-open');
    }
  });

  

});

// â ã½ã¼ãé¢æ°ï¼ãã­ãããã¦ã³ã§é¸æãããé ç®ã«å¿ãã¦ä¸¦ã³æ¿ãï¼
function sortWordList(sortType) {
  // ã½ã¼ãå¦çï¼æ°ããéåã«ãããã¨ã§åã®éåã¯ç ´å£ããªãï¼
  let sorted = [...window.wordDataArray];

  switch (sortType) {
    case "az":
      sorted.sort((a, b) => a.english.localeCompare(b.english));
      break;

    case "za":
      sorted.sort((a, b) => b.english.localeCompare(a.english));
      break;

    case "importance":
      // éè¦åº¦ãé«ãé ï¼1ãé«ãï¼
      sorted.sort((a, b) => Number(a.importance) - Number(b.importance));
      break;

    case "random":
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
      break;

    default:
      console.warn("â ï¸ æªå®ç¾©ã®ã½ã¼ãæ¹æ³:", sortType);
      return;
  }

  // ä¸¦ã³æ¿ããéåãåãã¼ã¿ã«ä¸æ¸ã
  window.wordDataArray = sorted;

    // â ãã¼ã¸1ã«æ»ã£ã¦åæç»ï¼goToPageãä½¿ãï¼
  if (typeof window.goToPage === "function") {
  
    // ï¼â ä¸¦ã³æ¿ãçµæãã®ã¾ã¾ã§åæç»ï¼
    window.goToPage(1);
  } else {
    console.error("â goToPageé¢æ°ãæªå®ç¾©ã§ã");
  }

}

// è¡¨ç¤ºåæ¿ï¼å°å·ã¢ã¼ã
document.addEventListener("DOMContentLoaded", () => {
  const toggleButtons = document.querySelectorAll('.display-toggle__btn');

  // â è¡¨ç¤ºåæ¿ã­ã¸ãã¯ãé¢æ°åï¼ãã¨ãããå¼ã¹ãããã«ï¼
  function toggleView(mode) {
    const jaTargets = document.querySelectorAll('.js-hide-ja');
    const enTargets = document.querySelectorAll('.js-hide-en');

    switch (mode) {
      case 'all':
        jaTargets.forEach(el => el.classList.remove('is-hidden-ja'));
        enTargets.forEach(el => el.classList.remove('is-hidden-en'));
        break;
      case 'ja':
        jaTargets.forEach(el => el.classList.add('is-hidden-ja'));
        enTargets.forEach(el => el.classList.remove('is-hidden-en'));
        break;
      case 'en':
        enTargets.forEach(el => el.classList.add('is-hidden-en'));
        jaTargets.forEach(el => el.classList.remove('is-hidden-ja'));
        break;
    }
  }

  // â ãã¿ã³ã¯ãªãã¯ã¤ãã³ãã§åãæ¿ã
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const mode = btn.dataset.mode;
      toggleView(mode);
    });
  });

  // â å°å·ãã¿ã³ â ?print=true ã§å¥ã¿ããéã
  document.querySelector('.print-button__btn')?.addEventListener('click', () => {
    let retries = 0;
  
    const tryPrint = async () => {
      // â ãã¼ã¿èª­ã¿è¾¼ã¿ãã§ãã¯ï¼book_id å¯¾å¿ã®åèªéåï¼
      if (!window.wordDataArray || window.wordDataArray.length === 0) {
        if (retries++ < 20) {
          setTimeout(tryPrint, 300);
        } else {
          alert("ãã¼ã¿ãã¾ã èª­ã¿è¾¼ã¾ãã¦ãã¾ãããå°ãå¾ã£ã¦ããååº¦ãè©¦ããã ããã");
        }
        return;
      }
  
      // â å°å·ç¨ã¢ã¼ãON
      document.body.setAttribute('data-print-mode', 'true');
  
      // â å¨åèªãæç»ãã¦ãã£ã«ã¿ã¼åæ 
      renderWordList(window.wordDataArray);
      applyDisplayMode(currentMode);
  
      // â å°å·å®è¡
      window.print();
  
      // â å°å·çµäºå¾ã«åã«æ»ã
      window.onafterprint = () => {
        goToPage(window.currentPage, { skipReload: true });
        document.body.removeAttribute('data-print-mode');
      };
    };
  
    tryPrint();
  });


  // â åæç¶æã§ãå¨è¡¨ç¤ºããé©ç¨ï¼ã¾ãã¯URLãã©ã¡ã¼ã¿ã«å¿ãã¦åãæ¿ãï¼
  toggleView('all');
});


