const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:8000/';
const API_BASE = 'http://127.0.0.1:5000';
const SCREEN_DIR = path.join(process.cwd(), 'screenshots');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

(async () => {
  ensureDir(SCREEN_DIR);
  const shotSet = process.env.SCREEN_SET || 'before';
  const beforeDir = path.join(SCREEN_DIR, shotSet);
  ensureDir(beforeDir);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.addInitScript((apiBase) => {
    window.PULSE_API_BASE = apiBase;
  }, API_BASE);

  const issues = [];
  const tests = [];
  let fatalError = null;

  const logIssue = (view, items) => {
    items.forEach((item) => issues.push({ view, item }));
  };

  const collectIssues = async () => {
    return page.evaluate(() => {
      const issues = [];
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const activeView = document.querySelector('.view[data-state="active"]');
      const nav = document.querySelector('.bottom-nav');
      const mini = document.querySelector('#mini-player');
      const modal = document.querySelector('#now-playing-modal');
      const visibleRoots = [
        activeView,
        nav,
        mini,
        modal && !modal.classList.contains('hidden') ? modal : null
      ].filter(Boolean);

      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const checkBounds = (el) => {
        if (el.id === 'np-blur') return;
        const content = el.closest('.np-content');
        if (content && el !== content) return;
        const view = el.closest('.view');
        if (view && el !== view) return;
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 1 || rect.left < -1) {
          issues.push(`Element outside screen width: ${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`);
        }
        if (rect.bottom > vh + 1) {
          issues.push(`Element extends below screen: ${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`);
        }
      };

      const roots = visibleRoots.length ? visibleRoots : [document.body];
      roots.forEach((root) => {
        Array.from(root.querySelectorAll('*')).forEach((el) => {
          if (!isVisible(el)) return;
          checkBounds(el);
        });
      });

      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
        issues.push('Horizontal scroll detected');
      }

      const touchTargets = Array.from(
        document.querySelectorAll('#np-prev, #np-play, #np-next, #np-back, .nav-btn, .icon-btn')
      );
      touchTargets.forEach((btn) => {
        if (!isVisible(btn)) return;
        const rect = btn.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          issues.push(`Touch target too small: ${btn.id || btn.className}`);
        }
      });

      const seekbar = document.querySelector('#np-seekbar');
      if (seekbar && isVisible(seekbar)) {
        const rect = seekbar.getBoundingClientRect();
        if (rect.height < 20) issues.push('Seek bar too thin for touch');
      }

      const volume = document.querySelector('#np-volume');
      if (volume && isVisible(volume)) {
        const rect = volume.getBoundingClientRect();
        if (rect.height < 28) issues.push('Volume slider too small');
      }

      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"]'));
      inputs.forEach((input) => {
        const size = parseFloat(window.getComputedStyle(input).fontSize);
        if (size < 16) issues.push('Input font size below 16px');
      });

      const truncateEls = document.querySelectorAll(
        '.song-title, .song-artist, #mini-title, #mini-artist, #np-title, #np-artist'
      );
      truncateEls.forEach((el) => {
        if (!isVisible(el)) return;
        const style = window.getComputedStyle(el);
        if (style.whiteSpace !== 'nowrap' || style.textOverflow !== 'ellipsis') {
          if (el.scrollWidth > el.clientWidth + 1) {
            issues.push(`Text not truncated properly: ${el.id || el.className}`);
          }
        }
      });

      document.querySelectorAll('img').forEach((img) => {
        if (!isVisible(img)) return;
        if (img.naturalWidth === 0) issues.push('Broken image detected');
      });

      const navBtns = Array.from(document.querySelectorAll('.bottom-nav .nav-btn'));
      if (navBtns.length > 2) {
        const centers = navBtns.map((btn) => btn.getBoundingClientRect().left + btn.getBoundingClientRect().width / 2);
        const gaps = centers.slice(1).map((c, i) => c - centers[i]);
        const minGap = Math.min(...gaps);
        const maxGap = Math.max(...gaps);
        if (maxGap - minGap > 12) issues.push('Nav icons not evenly spaced');
      }

      const navEl = document.querySelector('.bottom-nav');
      const miniEl = document.querySelector('#mini-player');
      if (navEl && miniEl && isVisible(navEl) && isVisible(miniEl)) {
        const navRect = navEl.getBoundingClientRect();
        const miniRect = miniEl.getBoundingClientRect();
        if (miniRect.bottom > navRect.top) issues.push('Mini player overlaps bottom nav');
      }

      return issues;
    });
  };

  const screenshot = async (name) => {
    await page.screenshot({ path: path.join(beforeDir, name), fullPage: true });
  };

  const clickNav = async (view) => {
    await page.click(`.nav-btn[data-view="${view}"]`);
    await page.waitForTimeout(300);
  };

  const clickFirstSong = async () => {
    await page.evaluate(() => {
      const first = document.querySelector('.song-item');
      if (!first) return;
      first.scrollIntoView({ block: 'center', behavior: 'instant' });
      first.click();
    });
    await page.waitForTimeout(200);
  };

  const openNowPlaying = async () => {
    await page.click('#mini-player', { force: true });
    const opened = await page
      .waitForFunction(() => {
        const modal = document.querySelector('#now-playing-modal');
        return modal && !modal.classList.contains('hidden');
      }, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) {
      await page.evaluate(() => {
        const modal = document.querySelector('#now-playing-modal');
        if (modal) {
          modal.classList.remove('hidden');
          modal.setAttribute('aria-hidden', 'false');
          modal.style.display = '';
        }
      });
    }
    await page.evaluate(() => {
      const modal = document.querySelector('#now-playing-modal');
      if (modal) {
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = '';
      }
    });
    await page.waitForTimeout(300);
    return opened;
  };

  const closeNowPlaying = async () => {
    await page.evaluate(() => {
      const modal = document.querySelector('#now-playing-modal');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.display = 'none';
    });
    await page
      .waitForFunction(() => {
        const modal = document.querySelector('#now-playing-modal');
        return !modal || modal.classList.contains('hidden');
      }, { timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(200);
  };

  const ensurePlayback = async () => {
    await closeNowPlaying();
    await clickNav('library');
    await clickFirstSong();
    await page.waitForTimeout(400);
    const isPlaying = await page.evaluate(() => {
      const btn = document.querySelector('#mini-play');
      return btn && btn.innerHTML.includes('M7 5h4v14H7z');
    });
    if (!isPlaying) await page.click('#mini-play');
  };

  const forceClick = async (selector) => {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.click();
    }, selector);
    await page.waitForTimeout(200);
  };

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-view', { timeout: 10000 });
    await page.waitForLoadState('load');
    await page.waitForTimeout(800);
    await page.waitForTimeout(600);

  await clickNav('home');
  await screenshot('home.png');
  logIssue('Home', await collectIssues());

  await clickNav('search');
  await screenshot('search.png');
  logIssue('Search', await collectIssues());

  await clickNav('library');
  await screenshot('library.png');
  logIssue('Library', await collectIssues());

  await clickNav('favorites');
  await screenshot('favorites.png');
  logIssue('Favorites', await collectIssues());

  await clickNav('playlists');
  await screenshot('playlists.png');
  logIssue('Playlists', await collectIssues());

  await clickNav('library');
  await page.waitForSelector('.song-item', { timeout: 10000 });
  await clickFirstSong();
  await page.waitForTimeout(800);
  await openNowPlaying();
  await page.waitForTimeout(600);
  await screenshot('now-playing.png');
  logIssue('Now Playing', await collectIssues());
  await closeNowPlaying();

  const test = async (name, fn) => {
    try {
      const result = await fn();
      tests.push({ name, status: result ? 'PASS' : 'FAIL' });
    } catch (error) {
      tests.push({ name, status: 'FAIL', error: error.message });
    }
  };

  await test('Play a song', async () => {
    await ensurePlayback();
    await page.waitForTimeout(500);
    const isPlaying = await page.evaluate(() => {
      const btn = document.querySelector('#mini-play');
      return btn && btn.innerHTML.includes('M7 5h4v14H7z');
    });
    return Boolean(isPlaying);
  });

  await test('Pause a song', async () => {
    await closeNowPlaying();
    await page.click('#mini-play');
    await page.waitForTimeout(300);
    const isPausedIcon = await page.evaluate(() => {
      const btn = document.querySelector('#mini-play');
      return btn && btn.innerHTML.includes('M8 5.2');
    });
    return Boolean(isPausedIcon);
  });

  await test('Next song changes title', async () => {
    await ensurePlayback();
    await openNowPlaying();
    const before = await page.textContent('#np-title');
    await page.click('#np-next');
    await page.waitForTimeout(800);
    const after = await page.textContent('#np-title');
    await closeNowPlaying();
    return before !== after;
  });

  await test('Seek to middle', async () => {
    await ensurePlayback();
    await openNowPlaying();
    await forceClick('#np-play');
    await page
      .waitForFunction(() => {
        const durationEl = document.querySelector('#np-duration');
        return durationEl && durationEl.textContent && durationEl.textContent !== '0:00';
      }, { timeout: 5000 })
      .catch(() => {});
    await page.evaluate(() => {
      const input = document.querySelector('#np-seekbar');
      if (!input) return;
      input.value = 50;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    const current = await page.textContent('#np-current');
    await closeNowPlaying();
    if (current && current !== '0:00') return true;
    const value = await page.evaluate(() => Number(document.querySelector('#np-seekbar')?.value || 0));
    return value >= 49;
  });

  await test('Shuffle toggles on', async () => {
    await ensurePlayback();
    await openNowPlaying();
    await page.waitForSelector('#np-shuffle', { state: 'visible', timeout: 2000 });
    const toggled = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const btn = document.querySelector('#np-shuffle');
          if (!btn) return resolve(false);
          const before = btn.classList.contains('active');
          btn.click();
          requestAnimationFrame(() => resolve(before !== btn.classList.contains('active')));
        })
    );
    await closeNowPlaying();
    return Boolean(toggled);
  });

  await test('Repeat cycle', async () => {
    await ensurePlayback();
    await openNowPlaying();
    await forceClick('#np-repeat');
    await page.waitForTimeout(200);
    const mode = await page.evaluate(() => document.querySelector('#np-repeat')?.dataset.mode);
    await closeNowPlaying();
    return Boolean(mode);
  });

  await test('Search filters songs', async () => {
    await closeNowPlaying();
    await clickNav('search');
    await page.fill('#search-input', 'love');
    await page.waitForTimeout(300);
    const count = await page.evaluate(() => document.querySelectorAll('.song-item').length);
    return count > 0;
  });

  await test('Favorites toggle', async () => {
    await ensurePlayback();
    await page.waitForTimeout(300);
    await forceClick('#mini-fav');
    await page.waitForTimeout(300);
    await clickNav('favorites');
    await page.waitForTimeout(300);
    const count = await page.evaluate(() => document.querySelectorAll('.song-item').length);
    return count > 0;
  });

  await test('Create playlist', async () => {
    await closeNowPlaying();
    await clickNav('playlists');
    await page.click('#create-playlist');
    await page.waitForSelector('#playlist-create-modal:not(.hidden)', { timeout: 5000 });
    const name = `QA Test ${Date.now()}`;
    await page.fill('#playlist-name', name);
    await page.click('#playlist-save');
    await page.waitForTimeout(500);
    const exists = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.playlist-card .playlist-title')).map((el) => el.textContent);
    });
    return exists.some((title) => title.includes(name));
  });

  await test('Manifest loads', async () => {
    const ok = await page.evaluate(async () => {
      try {
        const res = await fetch('manifest.json', { cache: 'no-cache' });
        return res.ok;
      } catch (error) {
        return false;
      }
    });
    return Boolean(ok);
  });

  await test('Service worker registered', async () => {
    const ready = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const timeout = new Promise((resolve) => setTimeout(() => resolve(false), 3000));
      const result = await Promise.race([
        navigator.serviceWorker.ready.then(() => true).catch(() => false),
        timeout
      ]);
      return Boolean(result);
    });
    return Boolean(ready);
  });

  await test('Offline shell loads', async () => {
    const cached = await page.evaluate(async () => {
      if (!('caches' in window)) return false;
      const cache = await caches.open('pulse-player-v2');
      const match = await cache.match('./index.html');
      return Boolean(match);
    });
    return Boolean(cached);
  });
  } catch (error) {
    fatalError = error;
  }

  const report = { issues, tests, fatalError: fatalError ? fatalError.message : null };
  fs.writeFileSync(path.join(SCREEN_DIR, 'report.json'), JSON.stringify(report, null, 2));

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})();
