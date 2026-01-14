(function () {
  // main vars for config
  const TRANS_MS = 360;
  const DRAG_THRESHOLD_PX = 40;
  const MAX_STEPS = 1;

  //  main container
  const container = document.querySelector('.wheel-container');
  if (!container) return;

  // creating a track container > if not available
  let track = container.querySelector('.wheel-track');
  if (!track) {
    track = document.createElement('div');
    track.className = 'wheel-track';
    const existing = Array.from(container.querySelectorAll(':scope > .card'));
    existing.forEach(c => track.appendChild(c));
    container.appendChild(track);
  }

  function centerCards() {
    Array.from(track.querySelectorAll('.card')).forEach(c => {
      c.style.left = '50%';
      c.style.top = '50%';
    });
  }
  centerCards();

  // main seed for growing UI > joking
  function readSeed() {
    return Array.from(track.querySelectorAll('.card'))
      .slice(0, 7)
      .map(slot => {
        // attempt to extract poster-path if src comes from TMDB images
        const imgSrc = slot.querySelector('img')?.src || '';
        let poster_path = null;
        try {
          const m = imgSrc.match(/image\.tmdb\.org\/t\/p\/w\d+(\/.+)$/);
          if (m && m[1]) poster_path = m[1]; // includes leading slash
        } catch (e) {
          poster_path = null;
        }

        return {
          id: slot.dataset.movieId || null, // read data-movie-id if present
          title: slot.querySelector('.card-content h3')?.textContent?.trim() || '',
          date: slot.querySelector('.movie-data')?.textContent?.trim() || '',
          type: slot.querySelector('.what-type')?.textContent?.trim() || '',
          rating: slot.querySelector('.movie-rating h2')?.childNodes?.[0]?.nodeValue?.trim() || '',
          badgeLeft: slot.querySelector('.badge-top-left')?.textContent?.trim() || '',
          badgeRight: slot.querySelector('.badge-top-right')?.textContent?.trim() || '',
          imgSrc,
          imgAlt: slot.querySelector('img')?.alt || '',
          // poster_path, // this is still not in use
          overview: '', // this is for popup trailer
        };
      });
  }

  let feed = readSeed();
  let feedIndex = feed.length;

  //  movies fetching from tmdb ...
  let currentQuery = 'movie';
  let currentPage = 1;
  let totalResults = 0;
  let fetching = false;

  const cache = new Map();

  function showApiMessage(text) {
    const box = document.getElementById('api-status');
    if (!box) {
      // this is the alert
      console.warn('api-status element missing:', text);
      return;
    }

    box.textContent = text;
    box.style.display = 'block';

    setTimeout(() => {
      box.style.display = 'none';
    }, 3000);
  }

  //  filters
  const FILTER_MODES = {
    popular: 'popular',
    top_rated: 'top_rated',
    upcoming: 'upcoming',
  };

  async function fetchPage(query, page = 1) {
    query = query || 'popular';
    const key = `${query}::${page}`;
    if (cache.has(key)) return cache.get(key);

    let url;

    // some checkpoints
    if (FILTER_MODES[query]) {
      url = `/api/tmdb?mode=${FILTER_MODES[query]}&page=${page}`;
    } else {
      // normal text search
      url = `/api/tmdb?search=${encodeURIComponent(query)}&page=${page}`;
    }

    const res = await fetch(url);
    let data;
    try {
      data = await res.json();
    } catch (err) {
      console.error('Invalid JSON from TMDB', err);
      showApiMessage('TMDB fetch error');
      return { items: [], total: 0 };
    }

    if (!res.ok || !data || !data.results) {
      showApiMessage('TMDB fetch error');
      return { items: [], total: 0 };
    }

    const items = data.results.map(m => ({
      id: m.id,
      title: m.title || '',
      date: m.release_date ? m.release_date.slice(0, 4) : '',
      type: 'movie',
      rating: m.vote_average ? m.vote_average.toFixed(1) : '—',
      badgeLeft: 'MOVIE',
      badgeRight: m.original_language?.toUpperCase() || '',
      imgSrc: m.poster_path ? `https://image.tmdb.org/t/p/w400${m.poster_path}` : '',
      imgAlt: m.title || '',
      poster_path: m.poster_path || null,
      overview: m.overview || '',
    }));

    const total = parseInt(data.total_results || items.length) || 0;

    const result = { items, total };
    cache.set(key, result);
    return result;
  }

  //  loading infinite data
  async function loadMoreIntoFeed() {
    if (fetching) return;
    fetching = true;

    try {
      currentPage++;

      const pageData = await fetchPage(currentQuery, currentPage);

      if (pageData && pageData.items && pageData.items.length) {
        feed = feed.concat(pageData.items);
        totalResults = pageData.total;
      }
    } catch (e) {
      console.error(e);
    } finally {
      fetching = false;
    }
  }

  async function getNextItem() {
    if (!feed.length) return null;

    if (feedIndex + 5 >= feed.length) {
      loadMoreIntoFeed(); // async, non-blocking
    }

    const item = feed[feedIndex % feed.length];
    feedIndex++;
    return item;
  }

  // creating card and putting the fetched data
  function createCard(item) {
    if (!item) return null;

    const el = document.createElement('div');
    el.dataset.movieId = item.id;
    el.className = 'card';
    el.style.left = '50%';
    el.style.top = '50%';
    el.innerHTML = `
      <div class="movie-details">
        <div class="details-top">
          <div class="movie-type">
            <div class="badge-top-left">${item.badgeLeft || ''}</div>
            <div class="badge-top-right">${item.badgeRight || ''}</div>
          </div>
          <div class="movie-rating">
            <h2>${item.rating || '—'} <span><i class="fa-solid fa-star"></i></span></h2>
          </div>
        </div>
        <div class="details-bottom">
          <div class="card-content">
            <h3>${item.title || ''}</h3>
            <div class="movie-dateType">
              <span class="movie-data">${item.date || ''}</span> •
              <span class="what-type">${item.type || ''}</span>
            </div>
          </div>
        </div>
      </div>
      <img src="${item.imgSrc || ''}" alt="${item.imgAlt || ''}">
    `;
    return el;
  }

  function finalizeKeep7() {
    const all = Array.from(track.querySelectorAll('.card'));
    if (all.length > 7) {
      for (let i = all.length - 1; i >= 7; i--) all[i].remove();
    }

    const nodes = Array.from(track.querySelectorAll('.card')).slice(0, 7);
    nodes.forEach((n, i) => {
      n.className = `card card-${i}`;
      n.style.left = '50%';
      n.style.top = '50%';
    });

    if (nodes[3]) nodes[3].classList.add('active');
  }

  finalizeKeep7();

  function waitForAnimation() {
    return new Promise(resolve => setTimeout(resolve, TRANS_MS + 20));
  }

  // this helps to move left
  async function singleShiftLeft() {
    track.classList.add('animating');
    try {
      const next = await getNextItem();
      if (!next) return;

      const newCard = createCard(next);
      newCard.classList.add('card-6');
      track.appendChild(newCard);

      const nodes = Array.from(track.querySelectorAll('.card'));
      for (let i = 0; i < 7; i++) {
        const node = nodes[i + 1];
        if (!node) continue;
        node.className = `card card-${i}`;
      }

      await waitForAnimation();

      const first = track.querySelector('.card');
      if (first) first.remove();
      finalizeKeep7();
    } finally {
      track.classList.remove('animating');
    }
  }

  // this will move it right
  async function singleShiftRight() {
    track.classList.add('animating');
    try {
      const next = await getNextItem();
      if (!next) return;

      const newCard = createCard(next);
      newCard.classList.add('card-0');
      track.insertBefore(newCard, track.firstChild);

      const nodes = Array.from(track.querySelectorAll('.card'));
      for (let i = 0; i < 7; i++) {
        const node = nodes[i];
        if (!node) continue;
        node.className = `card card-${i}`;
      }

      await waitForAnimation();

      const all = Array.from(track.querySelectorAll('.card'));
      while (all.length > 7) {
        all[all.length - 1].remove();
        all.pop();
      }

      finalizeKeep7();
    } finally {
      track.classList.remove('animating');
    }
  }

  async function shiftLeft(steps = 1) {
    for (let i = 0; i < Math.min(MAX_STEPS, steps); i++) {
      await singleShiftLeft();
    }
  }

  async function shiftRight(steps = 1) {
    for (let i = 0; i < Math.min(MAX_STEPS, steps); i++) {
      await singleShiftRight();
    }
  }

  // drag & move logic
  let startX = 0;
  let dragging = false;
  let didDrag = false;

  track.addEventListener('pointerdown', e => {
    dragging = true;
    startX = e.clientX;
  });

  window.addEventListener('pointermove', e => {
    if (!dragging) return;

    const delta = e.clientX - startX;
    if (Math.abs(delta) > DRAG_THRESHOLD_PX) {
      dragging = false;
      didDrag = true;
      if (delta < 0) shiftLeft(1);
      else shiftRight(1);
    }
  });

  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  document.querySelector('.move-right')?.addEventListener('click', () => shiftRight(1));
  document.querySelector('.move-left')?.addEventListener('click', () => shiftLeft(1));

  //  search & filters
  let searchTimer = null;

  function debouncedSearch(value) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fetchMovies(value.trim()), 200);
  }

  async function fetchMovies(query) {
    if (!query || !query.trim()) query = 'popular';

    currentQuery = query;
    currentPage = 1;

    const first = await fetchPage(query, 1);

    feed = first.items || [];
    feedIndex = 0;
    totalResults = first.total;

    // also preload next
    loadMoreIntoFeed();

    // this will update
    Array.from(track.querySelectorAll('.card'))
      .slice(0, 7)
      .forEach((card, i) => {
        const item = feed[i];
        if (!item) return;

        //setting movie id here
        card.dataset.movieId = item.id;

        card.querySelector('h3').textContent = item.title;
        card.querySelector('.movie-data').textContent = item.date;
        card.querySelector('.what-type').textContent = item.type;

        const ratingNode = card.querySelector('.movie-rating h2')?.childNodes?.[0];
        if (ratingNode) ratingNode.nodeValue = item.rating + ' ';

        card.querySelector('.badge-top-left').textContent = item.badgeLeft;
        card.querySelector('.badge-top-right').textContent = item.badgeRight;

        const img = card.querySelector('img');
        if (img) {
          img.src = item.imgSrc;
          img.alt = item.imgAlt;
        }
      });

    finalizeKeep7();
  }

  // search keys
  const searchBox = document.getElementById('searchBox');
  const searchBtn = document.getElementById('searchBtn');

  searchBtn?.addEventListener('click', () => {
    const value = searchBox?.value?.trim() || '';
    debouncedSearch(value || '');
  });

  searchBox?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const value = e.target.value.trim();
      debouncedSearch(value || '');
    }
  });

  // filter btns
  const buttons = document.querySelectorAll('.filter-btn');
  const indicator = document.querySelector('.active-indicator');

  function moveIndicator(btn) {
    if (!indicator) return;
    const rect = btn.getBoundingClientRect();
    const parentRect = btn.parentElement.getBoundingClientRect();
    indicator.style.width = rect.width + 'px';
    indicator.style.left = rect.left - parentRect.left + 'px';
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.filter-btn.active')?.classList.remove('active');
      btn.classList.add('active');
      moveIndicator(btn);
      debouncedSearch(btn.getAttribute('data-attribute'));
    });

    if (btn.classList.contains('active')) moveIndicator(btn);
  });

  // this will load everything that has fetched
  fetchMovies('');
  // fetching movies details > this is popup
  const overlay = document.getElementById('trailer-overlay');
  const iframe = document.getElementById('trailerPlayer');
  const closeBtn = document.getElementById('closeTrailer');
  const posterEl = document.getElementById('trailerPoster');

  let trailerOpenBusy = false;
  let ytPlayer = null;

  //  loading YouTube iframe API once >> this idea is from chatgpt
  (function loadYTApi() {
    if (window.YT && window.YT.Player) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  })();

  // Called automatically by YouTube API
  window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('trailerPlayer', {
      events: {
        onReady: e => {
          // request best quality when ready
          try {
            e.target.setPlaybackQuality('hd2160');
          } catch {}
        },
        onStateChange: e => {
          // when video starts playing, try forcing HD again
          if (e.data === YT.PlayerState.PLAYING) {
            try {
              e.target.setPlaybackQuality('hd2160');
            } catch {}
          }
        },
      },
    });
  };

  // tmdb fetch
  async function fetchTrailer(movieId) {
    try {
      const res = await fetch(`/api/tmdb?trailer=${movieId}`);
      if (!res.ok) return null;

      const data = await res.json();
      if (!data.results || !data.results.length) return null;

      const pick =
        data.results.find(v => v.type === 'Trailer' && v.official && v.site === 'YouTube') ||
        data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') ||
        data.results.find(v => v.site === 'YouTube');

      return pick ? pick.key : null;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  // Close overlay
  function closeTrailerOverlay() {
    if (overlay) overlay.classList.add('hidden');

    // stop video correctly
    if (ytPlayer) {
      try {
        ytPlayer.stopVideo();
      } catch {}
    } else if (iframe) {
      iframe.src = '';
    }

    trailerOpenBusy = false;
  }

  if (closeBtn) closeBtn.addEventListener('click', closeTrailerOverlay);

  // Close when clicking dark area
  if (overlay)
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeTrailerOverlay();
    });

  // Card click to open trailer
  track.addEventListener('click', async e => {
    if (didDrag) {
      didDrag = false;
      return;
    }

    const card = e.target.closest('.card');
    if (!card) return;

    let movieId = card.dataset.movieId || null;
    let item = null;

    if (!movieId) {
      const title = card.querySelector('h3')?.textContent?.trim();
      if (title) {
        item = feed.find(m => String(m.title).trim() === String(title).trim());
        if (item) {
          movieId = item.id;
          card.dataset.movieId = movieId;
        }
      }
    } else {
      item = feed.find(m => String(m.id) === String(movieId));
    }

    if (!movieId) {
      showApiMessage('No movie ID for this card.');
      return;
    }

    if (!item) {
      item = feed.find(m => String(m.id) === String(movieId));
    }

    if (!item) {
      showApiMessage('Movie data missing.');
      return;
    }

    if (trailerOpenBusy) return;
    trailerOpenBusy = true;

    try {
      const key = await fetchTrailer(movieId);

      if (!key) {
        showApiMessage('Trailer not found for this movie.');
        return;
      }

      // fill title info
      const titleEl = document.getElementById('trailerTitle');
      const yearEl = document.getElementById('trailerYear');
      const ratingEl = document.getElementById('trailerRating');
      const overviewEl = document.getElementById('trailerOverview');

      if (titleEl) titleEl.textContent = item.title || '—';
      if (yearEl)
        yearEl.textContent = (item.release_date || item.date || '—').toString().slice(0, 4);
      if (ratingEl) ratingEl.textContent = item.vote_average || item.rating || '—';
      if (overviewEl) overviewEl.textContent = item.overview || 'No description available.';

      // set iframe src with API enabled
      if (iframe) {
        iframe.src =
          `https://www.youtube-nocookie.com/embed/${key}` +
          `?autoplay=1` +
          `&mute=1` +
          `&controls=0` +
          `&playsinline=1` +
          `&rel=0` +
          `&modestbranding=1` +
          `&loop=1` +
          `&playlist=${key}` +
          `&enablejsapi=1`;
      }

      // when player exists, command quality
      if (ytPlayer && ytPlayer.loadVideoById) {
        ytPlayer.loadVideoById(key);
        try {
          ytPlayer.setPlaybackQuality('hd1080');
        } catch {}
      }

      if (overlay) overlay.classList.remove('hidden');
    } catch (err) {
      console.error('Error opening trailer:', err);
      showApiMessage('Error opening trailer.');
    } finally {
      trailerOpenBusy = false;
    }
  });
})();
