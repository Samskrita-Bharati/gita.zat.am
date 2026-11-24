import { initializeShlokasToday } from "./shlokasToday/shlokasToday.js";

export const menu = [
  {
    id: 1,
    title: "Word Search",
    dir: "games/01-wordSearch/index.html",
    cover: "./games/01-wordSearch/cover.svg",
    desc: `Find Sanskrit words in the grid.`,
  },
  {
    id: 2,
    title: "Arrange सुभाषितम्  ",
    pickerLabel: "Arrange",
    dir: "games/02-arrange",
    cover: "./games/02-arrange/cover.svg",
    desc: ` Order the words of a सुभाषितम्  in correct sequence!`,
  },
  {
    id: 3,
    title: "Gita Typing Game",
    pickerLabel: "Typing",
    dir: "games/057-gita-typing",
    cover: "./games/057-gita-typing/cover.svg",
    desc: `Practice typing on English (Harvard-Kyoto) transliteration of the shlokas from Bhagavad Gita`,
  },
  {
    id: 4,
    title: "सूत्रम् suutram",
    pickerLabel: "Suutram",
    dir: "games/04-suutram",
    cover: "./games/04-suutram/cover.svg",
    desc: "Connect Sanskrit letters to discover hidden words from the shloka.",
  },
  {
    id: 5,
    title: "Fill in the Blank",
    dir: "games/05-fillBlank",
    cover: "./games/05-fillBlank/cover.svg",
    desc: `Complete the daily shloka by filling in the missing words.`,
  },
  {
    id: 6,
    title: "BodhaPlay: शब्दावली",
    pickerLabel: "Scramble",
    dir: "games/06-wordScramble",
    cover: "./games/06-wordScramble/cover.svg",
    desc: `Unscramble Sanskrit vocabulary.`,
  }
];

// =====================================================
// MAIN ELEMENTS
// =====================================================

const sectionCenter = document.querySelector(".section-center");

// =====================================================
// FEATURED GAMES FOR HERO SLIDER
//
// These IDs come directly from your existing menu array.
// Change this array anytime to change featured games.
// =====================================================

const featuredGameIds = [1, 3, 4];

// =====================================================
// SLIDER STATE
// =====================================================

let featuredSlideIndex = 0;
let featuredSlideTimer = null;
let featuredPaused = false;

// =====================================================
// PAGE LOAD
// =====================================================

window.addEventListener("DOMContentLoaded", function () {
  if (sectionCenter) diplayMenuItems(menu);
  initializeShlokasToday(menu);
  initInfoDialog();
});

// =====================================================
// BUILD GAME URL
// =====================================================

function buildGameHref(item) {
  // External links such as Telegram
  if (/^https?:\/\//i.test(item.dir)) {
    return item.dir;
  }

  let href = `./${item.dir}${item.dir.endsWith(".html") ? "" : "/"}`;

  return href;
}

// =====================================================
// COVER IMAGE
// =====================================================

function getGameCover(item) {
  // External Telegram games do not have a local cover folder.
  if (/^https?:\/\//i.test(item.dir)) {
    return "./assets/शत.म्.png";
  }

  return item.cover || `./${item.dir}/cover.jpg`;
}

// =====================================================
// DISPLAY GAME CARDS
// =====================================================

function diplayMenuItems(menuItems) {
  let displayMenu = menuItems.map(function (item) {
    const href = buildGameHref(item);
    const cover = getGameCover(item);

    return `
      <article
        class="menu-item"
        data-cy="game-${item.dir}"
      >

        <a
          href="${href}"
          target="zat.am"
          class="game-image-link"
          data-cy="game-link-${item.dir}"
        >
          <div class="game-image-wrapper">

            <img
              src="${cover}"
              alt="${item.title}"
              class="photo"
              onerror="
                this.onerror=null;
                this.src='./assets/शत.म्.png';
              "
            />

          </div>
        </a>


        <div class="item-info">

          <h3 class="game-title">
            <a
              href="${href}"
              target="zat.am"
            >
              ${item.title}
            </a>
          </h3>


          <div class="item-text">
            ${item.desc}
          </div>


          <div class="game-card-bottom">

            <a
              href="${href}"
              target="zat.am"
              class="play-btn"
              data-cy="play-${item.dir}"
            >
              Play Now ▶
            </a>

          </div>

        </div>

      </article>
    `;
  });

  sectionCenter.innerHTML = displayMenu.join("");
}

// =====================================================
// REFRESH HOOK FOR navbar-auth.js
// =====================================================

if (typeof window !== "undefined") {
  window.zatRefreshMenu = function () {
    diplayMenuItems(menu);
  };
}

// =====================================================
// FEATURED SLIDER
// =====================================================

function getFeaturedGames() {
  return featuredGameIds
    .map(function (id) {
      return menu.find(function (game) {
        return game.id === id;
      });
    })
    .filter(Boolean);
}

// =====================================================
// RENDER SLIDER
// =====================================================

function renderFeaturedSlider() {
  const slidesContainer = document.getElementById("featuredSlides");

  const dotsContainer = document.getElementById("featuredSlideDots");

  if (!slidesContainer || !dotsContainer) {
    return;
  }

  const featuredGames = getFeaturedGames();

  slidesContainer.innerHTML = featuredGames
    .map(function (item, index) {
      const href = buildGameHref(item);
      const cover = getGameCover(item);

      return `
        <article
          class="featured-slide ${index === 0 ? "active" : ""}"
          data-slide-index="${index}"
        >

          <a
            href="${href}"
            target="zat.am"
            class="featured-slide-link"
          >

            <div class="slide-preview">

              <img
                src="${cover}"
                alt="${item.title}"
                onerror="
                  this.onerror=null;
                  this.src='./assets/शत.म्.png';
                "
              />

            </div>


            <div class="slide-caption">

              ${item.title}

            </div>

          </a>

        </article>
      `;
    })
    .join("");

  dotsContainer.innerHTML = featuredGames
    .map(function (_, index) {
      return `
        <button
          type="button"
          class="slide-dot ${index === 0 ? "active" : ""}"
          data-slide-target="${index}"
          aria-label="Show slide ${index + 1}"
        ></button>
      `;
    })
    .join("");
}

// =====================================================
// SHOW SLIDE
// =====================================================

function showFeaturedSlide(index) {
  const slides = document.querySelectorAll(".featured-slide");

  const dots = document.querySelectorAll(".slide-dot");

  if (!slides.length) {
    return;
  }

  featuredSlideIndex = (index + slides.length) % slides.length;

  slides.forEach(function (slide, index) {
    slide.classList.toggle("active", index === featuredSlideIndex);
  });

  dots.forEach(function (dot, index) {
    dot.classList.toggle("active", index === featuredSlideIndex);
  });
}

// =====================================================
// SLIDER TIMER
// =====================================================

function stopFeaturedSlider() {
  window.clearInterval(featuredSlideTimer);

  featuredSlideTimer = null;
}

function startFeaturedSlider() {
  if (featuredPaused) {
    return;
  }

  stopFeaturedSlider();

  featuredSlideTimer = window.setInterval(function () {
    showFeaturedSlide(featuredSlideIndex + 1);
  }, 3600);
}

// =====================================================
// MOVE SLIDER
// =====================================================

function moveFeaturedSlide(direction) {
  showFeaturedSlide(featuredSlideIndex + direction);

  startFeaturedSlider();
}

// =====================================================
// INITIALIZE SLIDER
// =====================================================

function initFeaturedSlider() {
  renderFeaturedSlider();

  const prevButton = document.getElementById("featuredSlidePrev");

  const nextButton = document.getElementById("featuredSlideNext");

  const toggleButton = document.getElementById("featuredSlideToggle");

  const dotsContainer = document.getElementById("featuredSlideDots");

  if (prevButton) {
    prevButton.addEventListener("click", function () {
      moveFeaturedSlide(-1);
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", function () {
      moveFeaturedSlide(1);
    });
  }

  if (dotsContainer) {
    dotsContainer.addEventListener("click", function (event) {
      const dot = event.target.closest(".slide-dot");

      if (!dot) {
        return;
      }

      showFeaturedSlide(Number(dot.dataset.slideTarget));

      startFeaturedSlider();
    });
  }

  if (toggleButton) {
    toggleButton.addEventListener("click", function () {
      featuredPaused = !featuredPaused;

      toggleButton.textContent = featuredPaused ? "Play" : "Pause";

      toggleButton.setAttribute(
        "aria-label",
        featuredPaused ? "Play slideshow" : "Pause slideshow",
      );

      if (featuredPaused) {
        stopFeaturedSlider();
      } else {
        startFeaturedSlider();
      }
    });
  }

  showFeaturedSlide(0);

  startFeaturedSlider();
}

// =====================================================
// HERO BUTTONS
// =====================================================

function initHeroButtons() {
  const startPlayingBtn = document.getElementById("startPlayingBtn");

  if (!startPlayingBtn) {
    return;
  }

  startPlayingBtn.addEventListener("click", function () {
    document.getElementById("gamesSection")?.scrollIntoView({
      behavior: "smooth",
    });
  });
}

// =====================================================
// HOW IT WORKS MODAL
// =====================================================

function initHowItWorksModal() {
  const button = document.getElementById("howItWorksBtn");

  const overlay = document.getElementById("zatamOverlay");

  const okButton = document.getElementById("zatamModalOk");

  if (!button || !overlay || !okButton) {
    return;
  }

  function openModal() {
    overlay.classList.add("visible");

    okButton.focus();
  }

  function closeModal() {
    overlay.classList.remove("visible");
  }

  button.addEventListener("click", openModal);

  okButton.addEventListener("click", closeModal);

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && overlay.classList.contains("visible")) {
      closeModal();
    }
  });
}

function initInfoDialog() {
  const dialog = document.getElementById("infoDialog");
  const title = document.getElementById("infoDialogTitle");
  const introContent = document.getElementById("infoDialogIntro");
  const content = document.getElementById("infoDialogContent");
  const aboutButton = document.getElementById("aboutBtn");
  const howToPlayButton = document.getElementById("howToPlayBtn");

  if (!dialog || !title || !introContent || !content || !aboutButton || !howToPlayButton) return;

  function openDialog(label, intro, body) {
    title.textContent = label;
    introContent.replaceChildren(intro);
    content.replaceChildren(body);
    dialog.showModal();
    content.scrollTop = 0;
  }

  aboutButton.addEventListener("click", function () {
    const placeholder = document.createElement("p");
    placeholder.className = "info-game-intro";
    placeholder.textContent = "TBD";
    openDialog("About", placeholder, document.createElement("div"));
  });

  howToPlayButton.addEventListener("click", function () {
    const gameList = document.createElement("div");
    gameList.className = "info-game-list";

    const intro = document.createElement("p");
    intro.className = "info-game-intro";
    intro.lang = "en";
    intro.textContent = "Two shlokas are featured each day. Explore and practice them through the games below.";

    menu.forEach(function (game) {
      const item = document.createElement("article");
      item.className = "info-game";
      item.innerHTML = `
        <div class="info-game-header">
          <img src="${getGameCover(game)}" alt="${game.title} cover" />
          <div class="info-game-copy">
            <h3>${game.title.trim()}</h3>
            <div class="info-game-description">${game.desc}</div>
          </div>
        </div>
      `;
      gameList.append(item);
    });

    openDialog("How to Play", intro, gameList);
  });
}
