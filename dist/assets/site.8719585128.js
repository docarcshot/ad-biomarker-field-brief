/* Shared, dependency-free state rules used by the site and regression tests. */
globalThis.ADBFViewState = (() => {
  const uniqueStrings = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string'))] : [];
  const selection = (value, allowed, limit = Infinity) => uniqueStrings(value).filter(id => allowed.includes(id)).slice(0, limit);
  const visit = (catalog, known, baseline) => {
    const current = uniqueStrings(catalog);
    const previous = Array.isArray(baseline) ? baseline : Array.isArray(known) ? known : current;
    return {baseline:uniqueStrings(previous), known:current, newIds:current.filter(id => !previous.includes(id))};
  };
  const delayed = (status, today) => status.workflowState === 'delayed' ||
    (today > status.nextScheduledReview && status.reviewedThrough < status.nextScheduledReview);
  return {selection, visit, delayed};
})();

(() => {
  const readStore = (kind, key) => { try { return window[kind].getItem(key); } catch { return null; } };
  const writeStore = (kind, key, value) => { try { window[kind].setItem(key, value); } catch { /* Other controls remain usable when storage is blocked. */ } };
  const parse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
  const viewState = parse(document.querySelector('#adbf-view-state')?.textContent, {ids:[],status:{}});
  const catalog = viewState.ids;
  const state = globalThis.ADBFViewState;
  const root = document.documentElement;
  const themeButton = document.querySelector('[data-theme-toggle]');
  const savedTheme = readStore('localStorage', 'adbf-theme') || 'system';
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
    writeStore('localStorage', 'adbf-theme', next);
    applyTheme(next);
  });

  const quickReferences = document.querySelector('[data-quick-references]');
  if (quickReferences) {
    quickReferences.open = window.matchMedia('(min-width: 1641px)').matches;
  }

  const sessionKey = 'adbf-open-briefs';
  const storedBriefs = parse(readStore('sessionStorage', sessionKey), []);
  const openBriefs = new Set(Array.isArray(storedBriefs) ? storedBriefs : []);
  document.querySelectorAll('details[data-entry-id][data-brief-section]').forEach(detail => {
    const stateId = `${detail.dataset.entryId}:${detail.dataset.briefSection}`;
    if (openBriefs.has(stateId)) detail.open = true;
    detail.addEventListener('toggle', () => {
      if (detail.open) openBriefs.add(stateId);
      else openBriefs.delete(stateId);
      writeStore('sessionStorage', sessionKey, JSON.stringify([...openBriefs]));
    });
  });

  const visit = state.visit(catalog, parse(readStore('localStorage','adbf-known-entries'), null), parse(readStore('sessionStorage','adbf-visit-baseline'), null));
  writeStore('sessionStorage','adbf-visit-baseline',JSON.stringify(visit.baseline));
  writeStore('localStorage','adbf-known-entries',JSON.stringify(visit.known));
  document.querySelectorAll('[data-date-added]').forEach(card => card.classList.toggle('is-new', visit.newIds.includes(card.dataset.entryId)));

  const refreshStatus = () => {
    const delayed = state.delayed(viewState.status, new Date().toISOString().slice(0,10));
    document.querySelectorAll('[data-review-warning]').forEach(warning => warning.hidden = !delayed);
    document.querySelectorAll('[data-review-message]').forEach(message => {
      message.classList.toggle('delayed', delayed);
      message.textContent = delayed ? 'Review delayed' : message.dataset.normalMessage;
    });
  };
  refreshStatus();
  window.setInterval(refreshStatus, 60000);
  document.addEventListener('visibilitychange', refreshStatus);

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
    const clearAll = document.querySelector('[data-clear-all]');
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
      clearAll.disabled = !query && active.length === 0;
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
    clearAll?.addEventListener('click', () => { controls.forEach(c => c.value = c.name === 'sort' ? 'added-desc' : ''); run(); });
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

  const meetingKey = 'adbf-meeting-briefs';
  const packet = document.querySelector('[data-meeting-packet]');
  const meetingLink = document.querySelector('.site-nav a[href$="/meeting/"]');
  const meetingParams = new URLSearchParams(location.search);
  const linkedSelection = packet && meetingParams.has('brief');
  let selected = state.selection(linkedSelection ? meetingParams.getAll('brief') : parse(readStore('localStorage',meetingKey), []), catalog);
  const packetCards = new Map([...document.querySelectorAll('[data-packet-id]')].map(card=>[card.dataset.packetId,card]));
  const meetingNotice = document.querySelector('[data-meeting-notice]');
  if (linkedSelection && selected.length !== meetingParams.getAll('brief').length && meetingNotice) meetingNotice.textContent = 'Some linked briefs are unavailable or duplicated. Available briefs are shown below.';
  const saveMeeting = () => writeStore('localStorage',meetingKey,JSON.stringify(selected));
  const renderMeeting = (updateURL = true) => {
    document.querySelectorAll('[data-meeting-toggle]').forEach(button => {
      const added = selected.includes(button.dataset.meetingToggle);
      button.setAttribute('aria-pressed', String(added));
      button.textContent = added ? 'Added to meeting' : 'Add to meeting';
      button.setAttribute('aria-label', `${added?'Remove':'Add'} ${button.dataset.briefTitle} ${added?'from':'to'} meeting`);
    });
    if (meetingLink) meetingLink.textContent = `Meeting prep${selected.length?` (${selected.length})`:''}`;
    if (!packet) return;
    document.querySelector('[data-meeting-count]').textContent = `${selected.length} ${selected.length===1?'brief':'briefs'} selected`;
    document.querySelector('[data-meeting-empty]').hidden = selected.length > 0;
    packet.hidden = selected.length === 0;
    document.querySelectorAll('[data-print-meeting], [data-copy-meeting], [data-clear-meeting]').forEach(button=>button.disabled = selected.length === 0);
    packetCards.forEach((card,id)=>card.hidden = !selected.includes(id));
    selected.forEach(id=>packet.insertBefore(packetCards.get(id),packet.querySelector('.packet-disclosure')));
    document.querySelector('[data-packet-date]').textContent = new Intl.DateTimeFormat('en-US',{dateStyle:'long'}).format(new Date());
    if (updateURL) {
      const params = new URLSearchParams(location.search);
      params.delete('brief');
      selected.forEach(id=>params.append('brief',id));
      history.replaceState(null,'',`${location.pathname}${params.size?`?${params}`:''}${location.hash}`);
    }
  };
  renderMeeting(false);
  if (linkedSelection) saveMeeting();
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-meeting-toggle]');
    const remove = event.target.closest('[data-remove-meeting]');
    if (!toggle && !remove) return;
    const id = toggle?.dataset.meetingToggle || remove.dataset.removeMeeting;
    if (!catalog.includes(id)) return;
    selected = selected.includes(id) ? selected.filter(value=>value!==id) : [...selected,id];
    saveMeeting(); renderMeeting();
    if (remove) document.querySelector('[data-clear-meeting]')?.focus();
  });
  document.querySelector('[data-clear-meeting]')?.addEventListener('click',()=>{ selected=[]; saveMeeting(); renderMeeting(); });
  document.querySelector('[data-print-meeting]')?.addEventListener('click',()=>{ if (selected.length) window.print(); });
  document.querySelector('[data-copy-meeting]')?.addEventListener('click',async()=>{
    if (!selected.length) return;
    const url = new URL(meetingLink.href,location.href);
    selected.forEach(id=>url.searchParams.append('brief',id));
    try { await navigator.clipboard.writeText(url.href); meetingNotice.textContent='Packet link copied.'; }
    catch { window.prompt('Copy this packet link:',url.href); }
  });
  window.addEventListener('storage',event=>{
    if (event.key!==meetingKey) return;
    selected=state.selection(parse(event.newValue,[]),catalog);
    renderMeeting();
  });

  const comparisonControls = [...document.querySelectorAll('[data-comparison-select]')];
  if (comparisonControls.length) {
    const allowed = [...comparisonControls[0].options].map(option=>option.value).filter(Boolean);
    const params = new URLSearchParams(location.search);
    const initial = state.selection(params.getAll('compare'),allowed,3);
    comparisonControls.forEach((control,index)=>control.value=initial[index] || '');
    const renderComparison = (updateURL = true) => {
      const ids = state.selection(comparisonControls.map(control=>control.value),allowed,3);
      comparisonControls.forEach(control=>[...control.options].forEach(option=>option.disabled = !!option.value && option.value!==control.value && ids.includes(option.value)));
      const ready = ids.length >= 2;
      document.querySelector('[data-comparison-result]').hidden = !ready;
      document.querySelector('[data-comparison-evidence]').hidden = !ready;
      document.querySelector('[data-comparison-message]').textContent = ready ? `${ids.length} tests selected. Comparison shown below.` : ids.length ? 'Choose one more test to compare.' : 'Choose at least two tests to compare.';
      document.querySelector('[data-clear-comparison]').disabled = ids.length===0;
      document.querySelectorAll('.comparison-table tr').forEach(row=>{
        const cells = [...row.querySelectorAll('[data-compare-id]')];
        cells.forEach(cell=>cell.hidden = !ids.includes(cell.dataset.compareId));
        ids.forEach(id=>{ const cell=cells.find(cell=>cell.dataset.compareId===id); if(cell) row.append(cell); });
      });
      let evidenceCount = 0;
      document.querySelectorAll('[data-evidence-for]').forEach(record=>{
        record.hidden = !record.dataset.evidenceFor.split('|').some(id=>ids.includes(id));
        if (!record.hidden) evidenceCount++;
      });
      document.querySelectorAll('[data-evidence-assay]').forEach(label=>label.hidden = !ids.includes(label.dataset.evidenceAssay));
      document.querySelector('[data-no-comparison-evidence]').hidden = evidenceCount > 0;
      if (updateURL) {
        const next = new URLSearchParams(location.search);
        next.delete('compare'); ids.forEach(id=>next.append('compare',id));
        history.replaceState(null,'',`${location.pathname}${next.size?`?${next}`:''}${location.hash}`);
      }
    };
    comparisonControls.forEach(control=>control.addEventListener('change',()=>renderComparison()));
    document.querySelector('[data-clear-comparison]').addEventListener('click',()=>{comparisonControls.forEach(control=>control.value='');renderComparison();});
    renderComparison(false);
  }
})();
