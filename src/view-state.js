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
