(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector('[data-theme-toggle]');
  const savedTheme = localStorage.getItem('adbf-theme') || 'system';
  const applyTheme = value => {
    if (value === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = value;
    if (themeButton) {
      themeButton.dataset.value = value;
      themeButton.setAttribute('aria-label', `Color theme: ${value}. Activate to change.`);
      themeButton.textContent = value === 'dark' ? '☾' : value === 'light' ? '☀' : '◐';
    }
  };
  applyTheme(savedTheme);
  themeButton?.addEventListener('click', () => {
    const current = themeButton.dataset.value;
    const next = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
    localStorage.setItem('adbf-theme', next);
    applyTheme(next);
  });

  const sessionKey = 'adbf-open-briefs';
  const openBriefs = new Set(JSON.parse(sessionStorage.getItem(sessionKey) || '[]'));
  document.querySelectorAll('details[data-entry-id][data-brief-section]').forEach(detail => {
    const stateId = `${detail.dataset.entryId}:${detail.dataset.briefSection}`;
    if (openBriefs.has(stateId)) detail.open = true;
    detail.addEventListener('toggle', () => {
      if (detail.open) openBriefs.add(stateId);
      else openBriefs.delete(stateId);
      sessionStorage.setItem(sessionKey, JSON.stringify([...openBriefs]));
    });
  });

  const previousVisit = localStorage.getItem('adbf-last-visit');
  if (previousVisit) {
    document.querySelectorAll('[data-date-added]').forEach(card => {
      if (card.dataset.dateAdded > previousVisit.slice(0, 10)) card.classList.add('is-new');
    });
  }
  localStorage.setItem('adbf-last-visit', new Date().toISOString());

  document.addEventListener('click', async event => {
    const copy = event.target.closest('[data-copy]');
    if (copy) {
      const value = copy.dataset.copy === 'link' ? copy.dataset.url || location.href : copy.dataset.citation;
      try {
        await navigator.clipboard.writeText(value);
        const old = copy.textContent;
        copy.textContent = 'Copied';
        setTimeout(() => { copy.textContent = old; }, 1500);
      } catch {
        window.prompt('Copy this text:', value);
      }
    }
  });

  const more = document.querySelector('[data-show-more]');
  const fewer = document.querySelector('[data-show-fewer]');
  if (more && fewer) {
    more.addEventListener('click', () => {
      document.querySelectorAll('[data-recent-extra]').forEach(el => el.hidden = false);
      more.hidden = true;
      fewer.hidden = false;
    });
    fewer.addEventListener('click', () => {
      document.querySelectorAll('[data-recent-extra]').forEach(el => el.hidden = true);
      fewer.hidden = true;
      more.hidden = false;
      document.querySelector('#latest')?.scrollIntoView();
    });
  }

  const archive = document.querySelector('[data-archive]');
  if (archive) {
    const cards = [...archive.querySelectorAll('[data-archive-card]')];
    const controls = [...document.querySelectorAll('[data-filter]')];
    const count = document.querySelector('[data-result-count]');
    const chips = document.querySelector('[data-active-filters]');
    const none = document.querySelector('[data-no-results]');
    const params = new URLSearchParams(location.search);
    controls.forEach(control => {
      if (params.has(control.name)) control.value = params.get(control.name);
    });

    const labelFor = control => control.closest('.field')?.querySelector('span')?.textContent || control.name;
    const run = (push = true) => {
      const query = (document.querySelector('[name="q"]')?.value || '').trim().toLowerCase();
      const active = controls.filter(c => c.name !== 'q' && c.name !== 'sort' && c.value);
      let visible = 0;
      cards.forEach(card => {
        const searchOK = !query || card.dataset.search.includes(query);
        const filterOK = active.every(c => (card.dataset[c.name] || '').toLowerCase().split('|').includes(c.value.toLowerCase()));
        card.hidden = !(searchOK && filterOK);
        if (!card.hidden) visible++;
      });
      const sort = document.querySelector('[name="sort"]')?.value || 'added-desc';
      const direction = sort === 'source-asc' ? 1 : -1;
      const field = sort.startsWith('source') ? 'sourceDate' : 'dateAdded';
      cards.sort((a, b) => direction * a.dataset[field].localeCompare(b.dataset[field]) || b.dataset.sourceDate.localeCompare(a.dataset.sourceDate)).forEach(card => archive.append(card));
      count.textContent = `${visible} ${visible === 1 ? 'brief' : 'briefs'} shown`;
      none.hidden = visible !== 0;
      chips.innerHTML = '';
      const chipValues = [];
      if (query) chipValues.push({name:'q', label:`Search: ${query}`});
      active.forEach(c => chipValues.push({name:c.name, label:`${labelFor(c)}: ${c.options[c.selectedIndex].text}`}));
      chipValues.forEach(item => {
        const button = document.createElement('button');
        button.className = 'filter-chip';
        button.type = 'button';
        button.textContent = `${item.label} ×`;
        button.addEventListener('click', () => {
          const control = document.querySelector(`[name="${item.name}"]`);
          if (control) control.value = '';
          run();
        });
        chips.append(button);
      });
      const next = new URLSearchParams();
      controls.forEach(c => { if (c.value && !(c.name === 'sort' && c.value === 'added-desc')) next.set(c.name, c.value); });
      if (push) history.replaceState(null, '', `${location.pathname}${next.size ? `?${next}` : ''}`);
    };
    controls.forEach(control => control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', () => run()));
    document.querySelector('[data-clear-all]')?.addEventListener('click', () => { controls.forEach(c => c.value = c.name === 'sort' ? 'added-desc' : ''); run(); });
    run(false);
  }

  const drawer = document.querySelector('[data-filter-drawer]');
  document.querySelector('[data-open-filters]')?.addEventListener('click', () => { drawer?.classList.add('open'); drawer?.querySelector('button, input, select')?.focus(); });
  document.querySelector('[data-close-filters]')?.addEventListener('click', () => { drawer?.classList.remove('open'); document.querySelector('[data-open-filters]')?.focus(); });

  const landscapeSearch = document.querySelector('[data-landscape-search]');
  const landscapeFilter = document.querySelector('[data-landscape-filter]');
  const filterLandscape = () => {
    const q = (landscapeSearch?.value || '').toLowerCase();
    const modality = (landscapeFilter?.value || '').toLowerCase();
    document.querySelectorAll('[data-landscape-row]').forEach(row => {
      row.hidden = !(row.dataset.search.includes(q) && (!modality || row.dataset.modality.includes(modality)));
    });
  };
  landscapeSearch?.addEventListener('input', filterLandscape);
  landscapeFilter?.addEventListener('change', filterLandscape);
})();
