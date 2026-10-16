// Homepage: live hero clock + featured clocks

(function tick() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const s = now.getSeconds(), m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
  const turn = (sel, deg) => document.querySelectorAll(sel).forEach((el) => (el.style.transform = `rotate(${deg}deg)`));
  turn('.h-hand', h * 30);
  turn('.m-hand', m * 6);
  turn('.s-hand', s * 6);
  setTimeout(tick, 1000 - (Date.now() % 1000));
})();

(async () => {
  const grid = document.getElementById('featured');
  try {
    let { clocks } = await (await fetch('/api/clocks?featured=1&limit=3')).json();
    if (clocks.length < 3) {
      // Top up with the newest stock if fewer than three are featured
      const latest = (await (await fetch('/api/clocks?limit=8')).json()).clocks;
      const ids = new Set(clocks.map((c) => c.id));
      clocks = clocks.concat(latest.filter((c) => !ids.has(c.id))).slice(0, 3);
    }
    grid.innerHTML = clocks.length
      ? clocks.map(Dials.card).join('')
      : '<p class="muted">New clocks are being added soon. Call 01590 673258 to ask what\'s coming in.</p>';
  } catch {
    grid.innerHTML = '<p class="muted">Unable to load clocks right now.</p>';
  }
})();
