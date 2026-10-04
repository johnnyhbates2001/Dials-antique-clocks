// Homepage: live hero clock + featured clocks

(function tick() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const s = now.getSeconds(), m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
  const rotate = (id, deg) => document.getElementById(id)?.setAttribute('transform', `rotate(${deg} 200 200)`);
  rotate('hand-h', h * 30);
  rotate('hand-m', m * 6);
  rotate('hand-s', s * 6);
  setTimeout(tick, 1000 - (Date.now() % 1000));
})();

(async () => {
  const grid = document.getElementById('featured');
  try {
    let { clocks } = await (await fetch('/api/clocks?featured=1&limit=4')).json();
    if (clocks.length < 4) {
      // Top up with the newest stock if fewer than four are featured
      const latest = (await (await fetch('/api/clocks?limit=8')).json()).clocks;
      const ids = new Set(clocks.map((c) => c.id));
      clocks = clocks.concat(latest.filter((c) => !ids.has(c.id))).slice(0, 4);
    }
    grid.innerHTML = clocks.length
      ? clocks.map(Dials.card).join('')
      : '<p class="muted">New stock coming soon.</p>';
  } catch {
    grid.innerHTML = '<p class="muted">Unable to load clocks right now.</p>';
  }
})();
