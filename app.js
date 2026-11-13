import { loadSchedule, getScheduleForDate } from "./dailyChallenge/dailyChallenge.js";
import { initializeShlokasToday } from "./shlokasToday/shlokasToday.js";
import { menu } from "./games/shared/gamesList.js";

export { menu };

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

const featuredGameIds = [18, 50, 57, 61, 62];

// =====================================================
// SLIDER STATE
// =====================================================

let featuredSlideIndex = 0;
let featuredSlideTimer = null;
let featuredPaused = false;
let scheduledMenu = [];

// =====================================================
// PAGE LOAD
// =====================================================

window.addEventListener("DOMContentLoaded", async function () {
  // Only run homepage UI code when the homepage elements exist.
  if (!sectionCenter) {
    return;
  }

  try {
    const schedule = await loadSchedule();
    const today = getScheduleForDate(schedule);
    const gameIds = new Set((today?.gameIds || []).map(Number));
    scheduledMenu = menu.filter((game) => gameIds.has(Number(game.id)));
    diplayMenuItems(scheduledMenu);
    await initializeShlokasToday(today);
  } catch (error) {
    console.error("Unable to load today's schedule:", error);
    scheduledMenu = [];
    diplayMenuItems(scheduledMenu);
    await initializeShlokasToday(null);
  }
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
    diplayMenuItems(scheduledMenu);
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
