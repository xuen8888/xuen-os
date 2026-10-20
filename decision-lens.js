(() => {
  'use strict';

  const STORAGE_KEY = 'xuen.decisionLens.simulator.v3';
  const V2_STORAGE_KEY = 'xuen.decisionLens.simulator.v2';
  const EPSILON = 0.005;
  const SERIES_COLORS = ['#71e7ff', '#8a74ff'];

  const TEMPLATE_DEFINITIONS = {
    buyRent: {
      mode: 'cost',
      context: 'Cumulative cost across the selected usage period.',
      groups: [
        {
          id: 'optionA',
          title: 'Option A',
          fields: [
            { key: 'buyName', label: 'Option name', type: 'text', maxlength: 40 },
            { key: 'buyInitial', label: 'Initial purchase cost', type: 'number', prefix: 'RM', min: 0, max: 100000000, step: 100 },
            { key: 'buyMonthly', label: 'Recurring ownership costs', type: 'number', prefix: 'RM', min: 0, max: 10000000, step: 10, help: 'Maintenance, storage, insurance, or subscriptions per month.' }
          ]
        },
        {
          id: 'optionB',
          title: 'Option B',
          fields: [
            { key: 'rentName', label: 'Option name', type: 'text', maxlength: 40 },
            { key: 'rentInitial', label: 'Initial rental cost', type: 'number', prefix: 'RM', min: 0, max: 100000000, step: 100, help: 'Any setup fee or non-refundable initial payment.' },
            { key: 'rentMonthly', label: 'Monthly rental cost', type: 'number', prefix: 'RM', min: 0, max: 10000000, step: 10 }
          ]
        },
        {
          id: 'timeline',
          title: 'Timeline',
          fields: [
            { key: 'horizon', label: 'Usage duration', type: 'number', suffix: 'months', min: 1, max: 240, step: 1 },
            { key: 'thresholdMonth', label: 'Reverse-calculator month', type: 'number', suffix: 'month', min: 1, max: 240, step: 1, help: 'Find the monthly rent that makes both options equal by this month.' }
          ]
        }
      ]
    },
    career: {
      mode: 'outcome',
      context: 'Cumulative income minus upfront and recurring costs.',
      groups: [
        {
          id: 'optionA',
          title: 'Option A',
          fields: [
            { key: 'currentName', label: 'Option name', type: 'text', maxlength: 40 },
            { key: 'currentUpfront', label: 'Upfront costs', type: 'number', prefix: 'RM', min: 0, max: 100000000, step: 100 },
            { key: 'currentIncome', label: 'Monthly income', type: 'number', prefix: 'RM', min: 0, max: 10000000, step: 100 },
            { key: 'currentCosts', label: 'Monthly recurring costs', type: 'number', prefix: 'RM', min: 0, max: 10000000, step: 10 }
          ]
        },
        {
          id: 'optionB',
          title: 'Option B',
          fields: [
            { key: 'educationName', label: 'Option name', type: 'text', maxlength: 40 },
            { key: 'educationUpfront', label: 'Upfront education costs', type: 'number', prefix: 'RM', min: 0, max: 100000000, step: 100 },
            { key: 'educationIncomeBefore', label: 'Income before transition', type: 'number', prefix: 'RM', min: 0, max: 10000000, step: 100 },
            { key: 'educationIncomeAfter', label: 'Income after transition', type: 'number', prefix: 'RM', min: 0, max: 10000000, step: 100 },
            { key: 'educationCosts', label: 'Monthly recurring costs', type: 'number', prefix: 'RM', min: 0, max: 10000000, step: 10 },
            { key: 'transitionMonth', label: 'Transition month', type: 'number', suffix: 'month', min: 1, max: 240, step: 1, help: 'The new monthly income begins in this month.' }
          ]
        },
        {
          id: 'timeline',
          title: 'Timeline',
          fields: [
            { key: 'horizon', label: 'Comparison horizon', type: 'number', suffix: 'months', min: 1, max: 240, step: 1 },
            { key: 'thresholdMonth', label: 'Income target month', type: 'number', suffix: 'month', min: 1, max: 240, step: 1, help: 'Find the post-transition income needed to match Option A by this month.' }
          ]
        }
      ]
    }
  };

  const createTemplateMeta = () => ({
    activeScenario: 'base',
    sensitivityRange: 20,
    scenarioOverrides: { pessimistic: {}, optimistic: {} },
    snapshots: [],
    compareLeft: '',
    compareRight: ''
  });

  const defaultState = () => ({
    version: 3,
    activeTemplate: 'buyRent',
    buyRent: {
      title: 'Should I buy this equipment or rent it?',
      buyName: 'Buy',
      buyInitial: 18000,
      buyMonthly: 120,
      rentName: 'Rent',
      rentInitial: 0,
      rentMonthly: 650,
      horizon: 48,
      thresholdMonth: 24,
      ...createTemplateMeta()
    },
    career: {
      title: 'Stay in my current role or study for a career transition?',
      currentName: 'Current path',
      currentUpfront: 0,
      currentIncome: 5200,
      currentCosts: 700,
      educationName: 'Education path',
      educationUpfront: 12000,
      educationIncomeBefore: 2500,
      educationIncomeAfter: 7000,
      educationCosts: 800,
      transitionMonth: 13,
      horizon: 60,
      thresholdMonth: 36,
      ...createTemplateMeta()
    }
  });

  const fieldDefinitions = Object.fromEntries(Object.entries(TEMPLATE_DEFINITIONS).map(([template, definition]) => [
    template,
    Object.fromEntries(definition.groups.flatMap((group) => group.fields).map((field) => [field.key, field]))
  ]));

  const formatCurrency = (value) => new Intl.NumberFormat('en-MY', {
    style: 'currency', currency: 'MYR', maximumFractionDigits: 0
  }).format(value);

  const formatCompactCurrency = (value) => {
    const sign = value < 0 ? '−' : '';
    const absolute = Math.abs(value);
    const formatted = new Intl.NumberFormat('en-MY', {
      notation: absolute >= 1000 ? 'compact' : 'standard',
      maximumFractionDigits: 1
    }).format(absolute);
    return `${sign}RM${formatted}`;
  };

  const cleanName = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim() : fallback;
  const signOf = (value) => Math.abs(value) < EPSILON ? 0 : Math.sign(value);
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  function simulateScenario(config) {
    const horizon = Number(config.horizon);
    if (!Number.isInteger(horizon) || horizon < 1 || !Array.isArray(config.alternatives) || config.alternatives.length !== 2) return null;

    const alternatives = config.alternatives.map((alternative) => {
      const values = [Number(alternative.startingValue)];
      for (let month = 1; month <= horizon; month += 1) {
        values.push(values[month - 1] + Number(alternative.monthlyDelta(month)));
      }
      return { id: alternative.id, name: alternative.name, values };
    });

    const finalValues = alternatives.map((alternative) => alternative.values[horizon]);
    const difference = Math.abs(finalValues[0] - finalValues[1]);
    let leaderIndex = null;
    if (difference >= EPSILON) {
      leaderIndex = config.mode === 'cost'
        ? (finalValues[0] < finalValues[1] ? 0 : 1)
        : (finalValues[0] > finalValues[1] ? 0 : 1);
    }

    const simulation = { mode: config.mode, horizon, alternatives, finalValues, difference, leaderIndex };
    simulation.crossover = findCrossover(simulation);
    return simulation;
  }

  function findCrossover(simulation) {
    const first = simulation.alternatives[0].values;
    const second = simulation.alternatives[1].values;
    const differences = first.map((value, index) => value - second[index]);

    for (let index = 1; index < differences.length; index += 1) {
      const leftSign = signOf(differences[index - 1]);
      const rightSign = signOf(differences[index]);

      if (leftSign !== 0 && rightSign !== 0 && leftSign !== rightSign) {
        const leftMagnitude = Math.abs(differences[index - 1]);
        const fraction = leftMagnitude / (leftMagnitude + Math.abs(differences[index]));
        const month = (index - 1) + fraction;
        const value = first[index - 1] + (first[index] - first[index - 1]) * fraction;
        return { month, value };
      }

      if (rightSign === 0 && leftSign !== 0) {
        const nextNonZero = differences.slice(index + 1).map(signOf).find((sign) => sign !== 0);
        if (nextNonZero == null || nextNonZero !== leftSign) return { month: index, value: first[index] };
      }

      if (leftSign === 0 && rightSign !== 0 && index > 1) {
        const priorNonZero = differences.slice(0, index - 1).reverse().map(signOf).find((sign) => sign !== 0);
        if (priorNonZero != null && priorNonZero !== rightSign) return { month: index - 1, value: first[index - 1] };
      }
    }

    return null;
  }

  function calculateBuyRentThreshold(values, targetMonth) {
    if (!Number.isInteger(targetMonth) || targetMonth < 1) return { status: 'unreachable', reason: 'Choose a target month of 1 or later.' };
    const buyAtTarget = values.buyInitial + (values.buyMonthly * targetMonth);
    const threshold = (buyAtTarget - values.rentInitial) / targetMonth;
    if (threshold <= 0) return { status: 'already', value: 0, buyAtTarget };
    return { status: 'ok', value: threshold, buyAtTarget };
  }

  function calculateCareerThreshold(values, targetMonth) {
    if (!Number.isInteger(targetMonth) || targetMonth < 1) return { status: 'unreachable', reason: 'Choose a target month of 1 or later.' };
    const postTransitionMonths = Math.max(0, targetMonth - values.transitionMonth + 1);
    if (postTransitionMonths === 0) {
      return { status: 'unreachable', reason: `Post-transition income has not started by month ${targetMonth}.` };
    }

    const preTransitionMonths = targetMonth - postTransitionMonths;
    const currentOutcome = -values.currentUpfront + targetMonth * (values.currentIncome - values.currentCosts);
    const educationWithZeroPostIncome = -values.educationUpfront
      + preTransitionMonths * (values.educationIncomeBefore - values.educationCosts)
      + postTransitionMonths * (0 - values.educationCosts);
    const threshold = (currentOutcome - educationWithZeroPostIncome) / postTransitionMonths;
    if (threshold <= 0) return { status: 'already', value: 0, currentOutcome, postTransitionMonths };
    return { status: 'ok', value: threshold, currentOutcome, postTransitionMonths };
  }

  function buildScenario(template, values) {
    if (template === 'buyRent') {
      return simulateScenario({
        mode: 'cost',
        horizon: values.horizon,
        alternatives: [
          { id: 'buy', name: cleanName(values.buyName, 'Option A'), startingValue: values.buyInitial, monthlyDelta: () => values.buyMonthly },
          { id: 'rent', name: cleanName(values.rentName, 'Option B'), startingValue: values.rentInitial, monthlyDelta: () => values.rentMonthly }
        ]
      });
    }

    return simulateScenario({
      mode: 'outcome',
      horizon: values.horizon,
      alternatives: [
        {
          id: 'current',
          name: cleanName(values.currentName, 'Option A'),
          startingValue: -values.currentUpfront,
          monthlyDelta: () => values.currentIncome - values.currentCosts
        },
        {
          id: 'education',
          name: cleanName(values.educationName, 'Option B'),
          startingValue: -values.educationUpfront,
          monthlyDelta: (month) => (month < values.transitionMonth ? values.educationIncomeBefore : values.educationIncomeAfter) - values.educationCosts
        }
      ]
    });
  }

  const resultMargin = (simulation) => {
    if (!simulation) return null;
    const [first, second] = simulation.finalValues;
    return simulation.mode === 'cost' ? first - second : second - first;
  };

  const eligibleSensitivityFields = (template) => TEMPLATE_DEFINITIONS[template].groups
    .flatMap((group) => group.fields)
    .filter((field) => field.type === 'number' && field.key !== 'thresholdMonth');

  const variationBounds = (field, rawValue, rangePercent) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return null;
    const ratio = rangePercent / 100;
    let lower = Math.min(value * (1 - ratio), value * (1 + ratio));
    let upper = Math.max(value * (1 - ratio), value * (1 + ratio));
    lower = clamp(lower, field.min, field.max);
    upper = clamp(upper, field.min, field.max);
    if (field.step === 1) {
      lower = Math.round(lower);
      upper = Math.round(upper);
    }
    return { lower, upper };
  };

  const valuesAreSimulatable = (template, values) => {
    const fields = fieldDefinitions[template];
    return Object.values(fields).every((field) => {
      if (field.type !== 'number') return true;
      const value = values[field.key];
      return value !== '' && value != null && Number.isFinite(Number(value))
        && Number(value) >= field.min && Number(value) <= field.max
        && (field.step !== 1 || Number.isInteger(Number(value)));
    }) && Number(values.thresholdMonth) <= Number(values.horizon);
  };

  function generateScenarioValues(template, baseValues, scenario, rangePercent) {
    const generated = { ...baseValues };
    if (scenario === 'base' || !valuesAreSimulatable(template, baseValues)) return generated;

    eligibleSensitivityFields(template).forEach((field) => {
      const bounds = variationBounds(field, baseValues[field.key], rangePercent);
      if (!bounds || bounds.lower === bounds.upper) return;
      const lowerValues = { ...baseValues, [field.key]: bounds.lower };
      const upperValues = { ...baseValues, [field.key]: bounds.upper };
      if (field.key === 'horizon') {
        lowerValues.thresholdMonth = Math.min(Number(lowerValues.thresholdMonth), Number(lowerValues.horizon));
        upperValues.thresholdMonth = Math.min(Number(upperValues.thresholdMonth), Number(upperValues.horizon));
      }
      const lowerMargin = resultMargin(buildScenario(template, lowerValues));
      const upperMargin = resultMargin(buildScenario(template, upperValues));
      if (lowerMargin == null || upperMargin == null) return;
      const chooseUpper = scenario === 'optimistic' ? upperMargin >= lowerMargin : upperMargin <= lowerMargin;
      generated[field.key] = chooseUpper ? bounds.upper : bounds.lower;
    });

    generated.thresholdMonth = Math.min(Number(generated.thresholdMonth), Number(generated.horizon));
    return generated;
  }

  const scenarioValues = (template, scenario, templateState) => {
    const base = Object.fromEntries([
      ['title', templateState.title],
      ...Object.keys(fieldDefinitions[template]).map((key) => [key, templateState[key]])
    ]);
    if (scenario === 'base') return base;
    const generated = generateScenarioValues(template, base, scenario, templateState.sensitivityRange);
    return { ...generated, ...(templateState.scenarioOverrides?.[scenario] || {}) };
  };

  const leaderName = (simulation) => simulation?.leaderIndex == null ? null : simulation.alternatives[simulation.leaderIndex].name;

  function findReversalThreshold(template, values, field, endpoint, baseMargin) {
    const endpointValues = { ...values, [field.key]: endpoint };
    if (field.key === 'horizon') endpointValues.thresholdMonth = Math.min(Number(endpointValues.thresholdMonth), Number(endpointValues.horizon));
    const endpointSimulation = buildScenario(template, endpointValues);
    const endpointMargin = resultMargin(endpointSimulation);
    if (endpointMargin == null || signOf(endpointMargin) === signOf(baseMargin)) return null;
    const reversedLeader = leaderName(endpointSimulation);

    const start = Number(values[field.key]);
    if (field.step === 1) {
      const direction = endpoint > start ? 1 : -1;
      for (let tested = start + direction; direction > 0 ? tested <= endpoint : tested >= endpoint; tested += direction) {
        const candidate = { ...values, [field.key]: tested };
        if (field.key === 'horizon') candidate.thresholdMonth = Math.min(Number(candidate.thresholdMonth), Number(candidate.horizon));
        const simulation = buildScenario(template, candidate);
        if (signOf(resultMargin(simulation)) !== signOf(baseMargin)) {
          return { value: tested, direction: direction > 0 ? 'increase' : 'decrease', leader: leaderName(simulation) || reversedLeader };
        }
      }
      return null;
    }

    let safe = start;
    let reversed = endpoint;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const midpoint = (safe + reversed) / 2;
      const simulation = buildScenario(template, { ...values, [field.key]: midpoint });
      if (signOf(resultMargin(simulation)) === signOf(baseMargin)) safe = midpoint;
      else reversed = midpoint;
    }
    return { value: reversed, direction: endpoint > start ? 'increase' : 'decrease', leader: reversedLeader };
  }

  function calculateSensitivity(template, values, rangePercent) {
    if (!valuesAreSimulatable(template, values)) return { baseSimulation: null, baseMargin: null, items: [] };
    const baseSimulation = buildScenario(template, values);
    const baseMargin = resultMargin(baseSimulation);
    const baseSign = signOf(baseMargin);
    const items = eligibleSensitivityFields(template).map((field) => {
      const bounds = variationBounds(field, values[field.key], rangePercent);
      if (!bounds) return null;
      const lowerValues = { ...values, [field.key]: bounds.lower };
      const upperValues = { ...values, [field.key]: bounds.upper };
      if (field.key === 'horizon') {
        lowerValues.thresholdMonth = Math.min(Number(lowerValues.thresholdMonth), Number(lowerValues.horizon));
        upperValues.thresholdMonth = Math.min(Number(upperValues.thresholdMonth), Number(upperValues.horizon));
      }
      const lowerSimulation = buildScenario(template, lowerValues);
      const upperSimulation = buildScenario(template, upperValues);
      const lowerMargin = resultMargin(lowerSimulation);
      const upperMargin = resultMargin(upperSimulation);
      const lowerSign = signOf(lowerMargin);
      const upperSign = signOf(upperMargin);
      const reversal = lowerSign !== baseSign || upperSign !== baseSign;
      let reversalThreshold = null;
      if (reversal) {
        const endpoint = lowerSign !== baseSign ? bounds.lower : bounds.upper;
        reversalThreshold = findReversalThreshold(template, values, field, endpoint, baseMargin);
      }
      return {
        key: field.key,
        label: field.label,
        field,
        baseValue: Number(values[field.key]),
        lowerValue: bounds.lower,
        upperValue: bounds.upper,
        lowerMargin,
        upperMargin,
        impact: Math.abs(upperMargin - lowerMargin),
        reversal,
        reversalThreshold
      };
    }).filter(Boolean).sort((a, b) => b.impact - a.impact);
    return { baseSimulation, baseMargin, items };
  }

  const makeId = () => globalThis.crypto?.randomUUID?.() || `snapshot-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const normalizeValues = (template, source, fallback) => {
    const normalized = { title: typeof source?.title === 'string' ? source.title.slice(0, 100) : fallback.title };
    Object.entries(fieldDefinitions[template]).forEach(([key, field]) => {
      const incoming = source?.[key];
      if (field.type === 'text') normalized[key] = typeof incoming === 'string' ? incoming.slice(0, 40) : fallback[key];
      else normalized[key] = incoming === '' || (typeof incoming === 'number' && Number.isFinite(incoming)) ? incoming : fallback[key];
    });
    return normalized;
  };

  function validateState(candidate) {
    if (!candidate || typeof candidate !== 'object' || ![2, 3].includes(candidate.version)) return null;
    const defaults = defaultState();
    const validated = { version: 3, activeTemplate: candidate.activeTemplate === 'career' ? 'career' : 'buyRent' };

    for (const template of ['buyRent', 'career']) {
      const source = candidate[template];
      if (!source || typeof source !== 'object') return null;
      const base = normalizeValues(template, source, defaults[template]);
      validated[template] = { ...base, ...createTemplateMeta() };
      if (candidate.version !== 3) continue;

      validated[template].activeScenario = ['pessimistic', 'base', 'optimistic'].includes(source.activeScenario) ? source.activeScenario : 'base';
      validated[template].sensitivityRange = Number.isFinite(source.sensitivityRange)
        ? clamp(Math.round(source.sensitivityRange / 5) * 5, 5, 50)
        : 20;
      for (const scenario of ['pessimistic', 'optimistic']) {
        const incomingOverrides = source.scenarioOverrides?.[scenario];
        if (!incomingOverrides || typeof incomingOverrides !== 'object') continue;
        Object.entries(incomingOverrides).forEach(([key, value]) => {
          const field = fieldDefinitions[template][key];
          if (!field) return;
          if (field.type === 'text' && typeof value === 'string') validated[template].scenarioOverrides[scenario][key] = value.slice(0, 40);
          if (field.type === 'number' && (value === '' || (typeof value === 'number' && Number.isFinite(value)))) validated[template].scenarioOverrides[scenario][key] = value;
        });
      }

      const seenIds = new Set();
      if (Array.isArray(source.snapshots)) {
        validated[template].snapshots = source.snapshots.slice(0, 50).map((snapshot, index) => {
          if (!snapshot || typeof snapshot !== 'object' || !snapshot.values) return null;
          let id = typeof snapshot.id === 'string' && snapshot.id ? snapshot.id.slice(0, 100) : `snapshot-${index + 1}`;
          if (seenIds.has(id)) id = makeId();
          seenIds.add(id);
          return {
            id,
            name: typeof snapshot.name === 'string' && snapshot.name.trim() ? snapshot.name.slice(0, 50) : `Snapshot ${index + 1}`,
            createdAt: Number.isFinite(snapshot.createdAt) ? snapshot.createdAt : Date.now(),
            values: normalizeValues(template, snapshot.values, base)
          };
        }).filter(Boolean);
      }
      const snapshotIds = new Set(validated[template].snapshots.map((snapshot) => snapshot.id));
      validated[template].compareLeft = snapshotIds.has(source.compareLeft) ? source.compareLeft : '';
      validated[template].compareRight = snapshotIds.has(source.compareRight) ? source.compareRight : '';
    }
    return validated;
  }

  const elements = {
    templateSwitch: document.querySelector('.decision-template-switch'),
    reset: document.querySelector('#reset-scenario'),
    title: document.querySelector('#decision-title'),
    form: document.querySelector('#assumption-form'),
    saveStatus: document.querySelector('#save-status'),
    context: document.querySelector('#simulation-context'),
    result: document.querySelector('#simulation-result'),
    legend: document.querySelector('#chart-legend'),
    chart: document.querySelector('#timeline-chart'),
    chartFrame: document.querySelector('#chart-frame'),
    tooltip: document.querySelector('#chart-tooltip'),
    inspector: document.querySelector('#chart-inspector'),
    scrubber: document.querySelector('#inspection-month'),
    inspectionOutput: document.querySelector('#inspection-output'),
    analysis: document.querySelector('#analysis-cards'),
    scenarioEditorTabs: document.querySelector('#scenario-editor-tabs'),
    activeScenarioLabel: document.querySelector('#active-scenario-label'),
    scenarioEditorNote: document.querySelector('#scenario-editor-note'),
    sensitivityRange: document.querySelector('#sensitivity-range'),
    sensitivityRangeOutput: document.querySelector('#sensitivity-range-output'),
    sensitivityInsight: document.querySelector('#sensitivity-insight'),
    sensitivityChart: document.querySelector('#sensitivity-chart'),
    scenarioPerspectiveNote: document.querySelector('#scenario-perspective-note'),
    scenarioConsistency: document.querySelector('#scenario-consistency'),
    scenarioGrid: document.querySelector('#scenario-result-grid'),
    snapshotForm: document.querySelector('#snapshot-save-form'),
    snapshotName: document.querySelector('#snapshot-name'),
    snapshotList: document.querySelector('#snapshot-list'),
    compareLeft: document.querySelector('#snapshot-compare-left'),
    compareRight: document.querySelector('#snapshot-compare-right'),
    snapshotComparison: document.querySelector('#snapshot-comparison-result'),
    methodCopy: document.querySelector('#method-copy'),
    methodFormula: document.querySelector('#method-formula'),
    toast: document.querySelector('#decision-toast')
  };
  if (Object.values(elements).some((element) => !element)) return;

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const createSvgElement = (tag, attributes = {}, text) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== undefined) element.textContent = text;
    return element;
  };

  let storageWarning = '';
  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(V2_STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const validated = validateState(parsed);
      if (!validated) throw new Error('Invalid saved scenario.');
      if (parsed.version === 2) storageWarning = 'Your V2 assumptions were upgraded to Decision Lens V3.';
      return validated;
    } catch (_) {
      storageWarning = 'The saved scenario could not be restored. Illustrative examples were loaded safely.';
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* Storage may be unavailable. */ }
      return defaultState();
    }
  };

  let state = loadState();
  let inspectionMonth = null;
  let currentSimulation = null;
  let toastTimer;
  let saveStatusTimer;
  let renamingSnapshotId = null;
  let pendingDeleteSnapshotId = null;

  const activeTemplateState = () => state[state.activeTemplate];
  const activeValues = () => scenarioValues(state.activeTemplate, activeTemplateState().activeScenario, activeTemplateState());
  const activeDefinition = () => TEMPLATE_DEFINITIONS[state.activeTemplate];

  const showToast = (message) => {
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 3200);
  };

  const saveState = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      elements.saveStatus.textContent = 'Saved locally just now';
      window.clearTimeout(saveStatusTimer);
      saveStatusTimer = window.setTimeout(() => { elements.saveStatus.textContent = 'Saved locally'; }, 1800);
    } catch (_) {
      elements.saveStatus.textContent = 'Local save unavailable';
    }
  };

  const resizeTitle = () => {
    elements.title.style.height = 'auto';
    elements.title.style.height = `${elements.title.scrollHeight}px`;
  };

  const validateValues = () => {
    const values = activeValues();
    const fields = fieldDefinitions[state.activeTemplate];
    const errors = {};
    Object.values(fields).forEach((field) => {
      if (field.type !== 'number') return;
      const value = values[field.key];
      if (value === '' || value == null || !Number.isFinite(Number(value))) {
        errors[field.key] = 'Enter a number. Zero is allowed.';
      } else if (Number(value) < field.min || Number(value) > field.max) {
        errors[field.key] = `Use a value from ${field.min} to ${field.max}.`;
      } else if (field.step === 1 && !Number.isInteger(Number(value))) {
        errors[field.key] = 'Use a whole month.';
      }
    });
    if (!errors.thresholdMonth && !errors.horizon && Number(values.thresholdMonth) > Number(values.horizon)) {
      errors.thresholdMonth = 'Choose a month within the comparison horizon.';
    }
    return errors;
  };

  const syncFieldErrors = (errors) => {
    elements.form.querySelectorAll('[data-field]').forEach((input) => {
      const message = errors[input.dataset.field] || '';
      input.setAttribute('aria-invalid', String(Boolean(message)));
      const error = document.querySelector(`#error-${input.dataset.field}`);
      if (error) error.textContent = message;
    });
  };

  const renderForm = () => {
    const definition = activeDefinition();
    const values = activeValues();
    elements.form.replaceChildren();

    definition.groups.forEach((group) => {
      const section = createElement('section', 'decision-field-group');
      section.dataset.group = group.id;
      const heading = createElement('div', 'decision-field-group__head');
      heading.append(createElement('h3', '', group.title), createElement('span', '', group.id === 'timeline' ? 'MODEL RANGE' : 'ILLUSTRATIVE INPUTS'));
      const list = createElement('div', 'decision-field-list');

      group.fields.forEach((field) => {
        const wrapper = createElement('label', 'decision-field');
        const label = createElement('span', 'decision-field__label');
        label.append(document.createTextNode(field.label));
        if (field.type === 'number') label.append(createElement('small', '', field.prefix ? 'AMOUNT' : 'TIMING'));

        const controlClasses = ['decision-field__control'];
        if (field.prefix) controlClasses.push('has-prefix');
        if (field.suffix) controlClasses.push('has-suffix');
        const control = createElement('span', controlClasses.join(' '));
        const input = createElement('input');
        input.type = field.type;
        input.value = values[field.key];
        input.dataset.field = field.key;
        input.id = `field-${field.key}`;
        input.autocomplete = 'off';
        input.setAttribute('aria-describedby', `error-${field.key}${field.help ? ` help-${field.key}` : ''}`);
        if (field.type === 'number') {
          input.inputMode = 'decimal';
          input.min = String(field.min);
          input.max = String(field.max);
          input.step = String(field.step);
        } else {
          input.maxLength = field.maxlength;
          input.classList.add('decision-name-input');
        }
        if (field.prefix || field.suffix) control.append(createElement('span', '', field.prefix || field.suffix));
        control.append(input);
        const error = createElement('span', 'decision-field__error');
        error.id = `error-${field.key}`;
        wrapper.append(label, control, error);
        if (field.help) {
          const help = createElement('p', 'decision-field-help', field.help);
          help.id = `help-${field.key}`;
          wrapper.append(help);
        }
        list.append(wrapper);
      });
      section.append(heading, list);
      elements.form.append(section);
    });
  };

  const leaderAt = (simulation, month) => {
    const first = simulation.alternatives[0].values[month];
    const second = simulation.alternatives[1].values[month];
    if (Math.abs(first - second) < EPSILON) return null;
    if (simulation.mode === 'cost') return first < second ? 0 : 1;
    return first > second ? 0 : 1;
  };

  const renderVerdict = (simulation) => {
    elements.result.replaceChildren();
    if (!simulation) {
      const incomplete = createElement('div', 'decision-incomplete');
      incomplete.append(createElement('h3', '', 'Complete the highlighted assumptions to run the model.'));
      incomplete.append(createElement('p', '', 'Blank or invalid values are not treated as zero. Enter each missing amount or month to restore the timeline.'));
      elements.result.append(incomplete);
      return;
    }

    const verdict = createElement('div', 'decision-verdict');
    const summary = createElement('div');
    summary.append(createElement('p', 'decision-verdict__label', 'RESULT AT THE END OF THIS HORIZON'));
    const heading = simulation.leaderIndex == null
      ? `${simulation.alternatives[0].name} and ${simulation.alternatives[1].name} are level.`
      : `${simulation.alternatives[simulation.leaderIndex].name} leads at month ${simulation.horizon}.`;
    summary.append(createElement('h3', '', heading));
    const note = simulation.leaderIndex == null
      ? `Both paths finish at ${formatCurrency(simulation.finalValues[0])} under the current assumptions.`
      : simulation.mode === 'cost'
        ? `${simulation.alternatives[simulation.leaderIndex].name} has the lower cumulative cost under these assumptions—not a universal recommendation.`
        : `${simulation.alternatives[simulation.leaderIndex].name} has the higher cumulative financial outcome under these assumptions—not a universal recommendation.`;
    summary.append(createElement('p', 'decision-verdict__note', note));

    const difference = createElement('div', 'decision-verdict__difference');
    difference.append(createElement('strong', '', formatCurrency(simulation.difference)));
    difference.append(createElement('span', '', simulation.leaderIndex == null ? 'DIFFERENCE / TIE' : 'DIFFERENCE AT HORIZON'));
    verdict.append(summary, difference);
    elements.result.append(verdict);
  };

  const renderLegend = (simulation) => {
    elements.legend.replaceChildren();
    if (!simulation) return;
    simulation.alternatives.forEach((alternative, index) => {
      const item = createElement('span');
      const swatch = createElement('i');
      swatch.style.setProperty('--series-color', SERIES_COLORS[index]);
      item.append(swatch, document.createTextNode(alternative.name));
      elements.legend.append(item);
    });
  };

  const renderInspector = (simulation, month) => {
    elements.inspector.replaceChildren();
    if (!simulation) return;
    elements.inspector.append(createElement('strong', '', `Month ${month}`));
    simulation.alternatives.forEach((alternative, index) => {
      const item = createElement('span');
      const dot = createElement('i');
      dot.style.setProperty('--series-color', SERIES_COLORS[index]);
      item.append(dot, document.createTextNode(`${alternative.name}: ${formatCurrency(alternative.values[month])}`));
      elements.inspector.append(item);
    });
  };

  const pathFromValues = (values, xScale, yScale) => values.map((value, index) => `${index === 0 ? 'M' : 'L'}${xScale(index).toFixed(2)} ${yScale(value).toFixed(2)}`).join(' ');

  const getChartGeometry = () => {
    const compact = window.matchMedia('(max-width: 720px)').matches;
    return compact
      ? { width: 620, height: 460, margin: { top: 52, right: 26, bottom: 82, left: 118 }, xTickCount: 4 }
      : { width: 900, height: 450, margin: { top: 46, right: 38, bottom: 72, left: 110 }, xTickCount: 5 };
  };

  const renderChart = (simulation) => {
    const { width, height, margin, xTickCount } = getChartGeometry();
    elements.chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
    elements.chart.replaceChildren();
    elements.tooltip.replaceChildren();
    if (!simulation) {
      elements.chart.append(createSvgElement('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'chart-axis-label' }, 'Complete the assumptions to draw the timeline.'));
      elements.inspector.replaceChildren();
      elements.tooltip.hidden = true;
      return;
    }

    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const allValues = simulation.alternatives.flatMap((alternative) => alternative.values).concat(0);
    let minimum = Math.min(...allValues);
    let maximum = Math.max(...allValues);
    if (Math.abs(maximum - minimum) < EPSILON) { minimum -= 1; maximum += 1; }
    const padding = (maximum - minimum) * .1;
    minimum -= padding;
    maximum += padding;
    const xScale = (month) => margin.left + (month / simulation.horizon) * plotWidth;
    const yScale = (value) => margin.top + ((maximum - value) / (maximum - minimum)) * plotHeight;

    const title = createSvgElement('title', { id: 'chart-title' }, 'Financial scenario timeline');
    const description = createSvgElement('desc', { id: 'chart-description' }, `${simulation.alternatives[0].name} and ${simulation.alternatives[1].name} plotted over ${simulation.horizon} months.`);
    elements.chart.append(title, description);

    const defs = createSvgElement('defs');
    const gradient = createSvgElement('linearGradient', { id: 'chart-area-gradient', x1: 0, y1: 0, x2: 0, y2: 1 });
    gradient.append(createSvgElement('stop', { offset: '0%', 'stop-color': SERIES_COLORS[0], 'stop-opacity': .8 }));
    gradient.append(createSvgElement('stop', { offset: '100%', 'stop-color': SERIES_COLORS[0], 'stop-opacity': 0 }));
    defs.append(gradient);
    elements.chart.append(defs);

    for (let tick = 0; tick <= 4; tick += 1) {
      const ratio = tick / 4;
      const value = maximum - ratio * (maximum - minimum);
      const y = margin.top + ratio * plotHeight;
      const grid = createSvgElement('line', { x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: `chart-grid-line${Math.abs(value) < (maximum - minimum) / 80 ? ' chart-zero-line' : ''}` });
      const label = createSvgElement('text', { x: margin.left - 16, y: y + 4, 'text-anchor': 'end', class: 'chart-axis-label' }, formatCompactCurrency(value));
      elements.chart.append(grid, label);
    }

    const xTicks = new Set();
    for (let tick = 0; tick <= xTickCount; tick += 1) xTicks.add(Math.round((tick / xTickCount) * simulation.horizon));
    [...xTicks].forEach((month) => {
      const x = xScale(month);
      elements.chart.append(createSvgElement('line', { x1: x, x2: x, y1: margin.top, y2: height - margin.bottom, class: 'chart-grid-line' }));
      elements.chart.append(createSvgElement('text', { x, y: height - margin.bottom + 31, 'text-anchor': 'middle', class: 'chart-axis-label' }, String(month)));
    });
    elements.chart.append(createSvgElement('text', { x: width - margin.right, y: height - 19, 'text-anchor': 'end', class: 'chart-axis-title' }, 'Month'));
    const axisTitleX = 25;
    const axisTitle = createSvgElement('text', { x: axisTitleX, y: margin.top, class: 'chart-axis-title', transform: `rotate(-90 ${axisTitleX} ${margin.top})`, 'text-anchor': 'end' }, simulation.mode === 'cost' ? 'Cumulative cost (MYR)' : 'Cumulative net outcome (MYR)');
    elements.chart.append(axisTitle);

    simulation.alternatives.forEach((alternative, index) => {
      const path = createSvgElement('path', { d: pathFromValues(alternative.values, xScale, yScale), class: 'chart-line' });
      path.style.setProperty('--series-color', SERIES_COLORS[index]);
      elements.chart.append(path);
    });

    if (simulation.crossover) {
      const x = xScale(simulation.crossover.month);
      const y = yScale(simulation.crossover.value);
      const labelNearRightEdge = x > width - margin.right - (width <= 620 ? 245 : 190);
      elements.chart.append(createSvgElement('line', { x1: x, x2: x, y1: margin.top, y2: height - margin.bottom, class: 'chart-crossover-line' }));
      elements.chart.append(createSvgElement('circle', { cx: x, cy: y, r: 5, class: 'chart-crossover-dot' }));
      elements.chart.append(createSvgElement('text', {
        x: x + (labelNearRightEdge ? -11 : 11),
        y: height - margin.bottom - 14,
        'text-anchor': labelNearRightEdge ? 'end' : 'start',
        class: 'chart-crossover-label'
      }, `CROSSOVER / ${formatMonth(simulation.crossover.month)}`));
    }

    const selectedMonth = clamp(inspectionMonth ?? simulation.horizon, 0, simulation.horizon);
    inspectionMonth = selectedMonth;
    const inspectionX = xScale(selectedMonth);
    elements.chart.append(createSvgElement('line', { x1: inspectionX, x2: inspectionX, y1: margin.top, y2: height - margin.bottom, class: 'chart-inspection-line' }));
    simulation.alternatives.forEach((alternative, index) => {
      const dot = createSvgElement('circle', { cx: inspectionX, cy: yScale(alternative.values[selectedMonth]), r: 5, class: 'chart-inspection-dot' });
      dot.style.setProperty('--series-color', SERIES_COLORS[index]);
      elements.chart.append(dot);
    });

    const tooltipX = (inspectionX / width) * 100;
    elements.tooltip.style.setProperty('--tooltip-x', `${tooltipX}%`);
    elements.tooltip.style.setProperty('--tooltip-shift', tooltipX > 78 ? '-100%' : tooltipX < 22 ? '0%' : '-50%');
    elements.tooltip.hidden = false;
    elements.tooltip.append(createElement('strong', '', `Month ${selectedMonth}`));
    simulation.alternatives.forEach((alternative) => {
      const row = createElement('span');
      row.append(document.createTextNode(alternative.name), createElement('b', '', formatCompactCurrency(alternative.values[selectedMonth])));
      elements.tooltip.append(row);
    });

    elements.scrubber.max = String(simulation.horizon);
    elements.scrubber.value = String(selectedMonth);
    elements.inspectionOutput.value = String(selectedMonth);
    elements.inspectionOutput.textContent = String(selectedMonth);
    renderInspector(simulation, selectedMonth);
  };

  function formatMonth(month) {
    const rounded = Math.round(month);
    return Math.abs(month - rounded) < .05 ? `month ${rounded}` : `month ${month.toFixed(1)}`;
  }

  const renderAnalysis = (simulation) => {
    elements.analysis.replaceChildren();
    if (!simulation) return;
    const values = activeValues();

    const crossoverCard = createElement('article', 'decision-analysis-card');
    crossoverCard.append(createElement('span', '', 'CROSSOVER'));
    if (simulation.crossover) {
      crossoverCard.append(createElement('h3', '', `The paths meet around ${formatMonth(simulation.crossover.month)}.`));
      const horizonLeader = simulation.leaderIndex == null ? null : simulation.alternatives[simulation.leaderIndex].name;
      const text = horizonLeader
        ? `They are both approximately ${formatCurrency(simulation.crossover.value)} at that point. After the crossover, ${horizonLeader} leads by the end of the selected horizon.`
        : `They are both approximately ${formatCurrency(simulation.crossover.value)} at that point and finish level at the horizon.`;
      crossoverCard.append(createElement('p', '', text));
    } else {
      const firstMeaningfulMonth = simulation.horizon >= 1 ? 1 : 0;
      const leaderIndex = leaderAt(simulation, firstMeaningfulMonth) ?? simulation.leaderIndex;
      crossoverCard.append(createElement('h3', '', `No crossover within ${simulation.horizon} months.`));
      crossoverCard.append(createElement('p', '', leaderIndex == null
        ? 'The paths remain equal across the displayed timeline.'
        : `${simulation.alternatives[leaderIndex].name} remains financially preferable throughout the displayed range under these assumptions.`));
    }

    const reverseCard = createElement('article', 'decision-analysis-card');
    reverseCard.append(createElement('span', '', 'REVERSE CALCULATOR'));
    const targetMonth = Number(values.thresholdMonth);
    if (state.activeTemplate === 'buyRent') {
      const threshold = calculateBuyRentThreshold(values, targetMonth);
      if (threshold.status === 'ok') {
        reverseCard.append(createElement('h3', '', `${formatCurrency(threshold.value)} monthly rent at month ${targetMonth}.`));
        reverseCard.append(createElement('p', '', `${simulation.alternatives[1].name} reaches the same cumulative cost as ${simulation.alternatives[0].name} at that monthly rent. Above it, ${simulation.alternatives[0].name} is lower cost; below it, ${simulation.alternatives[1].name} is lower cost.`));
      } else if (threshold.status === 'already') {
        reverseCard.append(createElement('h3', '', `${simulation.alternatives[0].name} is already lower cost by month ${targetMonth}.`));
        reverseCard.append(createElement('p', '', `It remains lower cost even if ${simulation.alternatives[1].name} has a monthly cost of ${formatCurrency(0)}.`));
      } else {
        reverseCard.append(createElement('h3', '', 'A threshold cannot be calculated.'));
        reverseCard.append(createElement('p', '', threshold.reason));
      }
    } else {
      const threshold = calculateCareerThreshold(values, targetMonth);
      if (threshold.status === 'ok') {
        reverseCard.append(createElement('h3', '', `${formatCurrency(threshold.value)} post-transition income.`));
        reverseCard.append(createElement('p', '', `${simulation.alternatives[1].name} needs at least this monthly income after transition to match ${simulation.alternatives[0].name} by month ${targetMonth}, holding every other assumption constant.`));
      } else if (threshold.status === 'already') {
        reverseCard.append(createElement('h3', '', `No post-transition income is required to match by month ${targetMonth}.`));
        reverseCard.append(createElement('p', '', `${simulation.alternatives[1].name} already matches or exceeds ${simulation.alternatives[0].name} by then, even with post-transition income set to ${formatCurrency(0)}.`));
      } else {
        reverseCard.append(createElement('h3', '', 'The threshold is unreachable by this month.'));
        reverseCard.append(createElement('p', '', threshold.reason));
      }
    }
    elements.analysis.append(crossoverCard, reverseCard);
  };

  const renderMethod = () => {
    elements.methodFormula.replaceChildren();
    if (state.activeTemplate === 'buyRent') {
      elements.methodCopy.textContent = 'Decision Lens adds each option’s starting cost and monthly cost across the selected usage period. The lower cumulative cost leads under those assumptions.';
      elements.methodFormula.append(createElement('strong', '', 'Cumulative cost at month m'));
      elements.methodFormula.append(createElement('span', '', 'initial cost + (monthly cost × m)'));
      elements.methodFormula.append(createElement('span', '', 'Reverse: solve the rental equation for monthly rent at the selected month.'));
    } else {
      elements.methodCopy.textContent = 'Decision Lens subtracts upfront and recurring costs from cumulative income. The education path changes income at the stated transition month. The higher cumulative net outcome leads under those assumptions.';
      elements.methodFormula.append(createElement('strong', '', 'Cumulative net outcome'));
      elements.methodFormula.append(createElement('span', '', '− upfront costs + Σ (monthly income − monthly costs)'));
      elements.methodFormula.append(createElement('span', '', 'Reverse: solve post-transition income so both paths are equal at the selected month.'));
    }
  };

  const scenarioLabel = (scenario) => ({
    pessimistic: 'Pessimistic case',
    base: 'Base case',
    optimistic: 'Optimistic case'
  }[scenario] || 'Base case');

  const formatFieldValue = (field, value) => {
    if (field.type === 'text') return String(value || '—');
    if (!Number.isFinite(Number(value))) return '—';
    if (field.prefix) return formatCurrency(Number(value));
    if (field.suffix) return `${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 1 }).format(Number(value))} ${field.suffix}`;
    return new Intl.NumberFormat('en-MY', { maximumFractionDigits: 1 }).format(Number(value));
  };

  const describeMargin = (simulation, margin = resultMargin(simulation)) => {
    if (!simulation || margin == null) return 'Incomplete result';
    if (signOf(margin) === 0) return 'The options are level';
    const leader = margin > 0 ? simulation.alternatives[1].name : simulation.alternatives[0].name;
    return `${leader} leads by ${formatCurrency(Math.abs(margin))}`;
  };

  const renderScenarioEditor = () => {
    const templateState = activeTemplateState();
    const activeScenario = templateState.activeScenario;
    elements.activeScenarioLabel.textContent = scenarioLabel(activeScenario);
    elements.scenarioEditorTabs.querySelectorAll('[data-scenario]').forEach((button) => {
      const selected = button.dataset.scenario === activeScenario;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    elements.scenarioEditorNote.textContent = activeScenario === 'base'
      ? 'Your primary assumptions. Generated scenarios update from this base.'
      : `This case began as a directional ±${templateState.sensitivityRange}% stress test for Option B. Numeric edits become case-specific overrides.`;
    elements.sensitivityRange.value = String(templateState.sensitivityRange);
    elements.sensitivityRangeOutput.value = `±${templateState.sensitivityRange}%`;
    elements.sensitivityRangeOutput.textContent = `±${templateState.sensitivityRange}%`;
  };

  const renderSensitivity = () => {
    elements.sensitivityInsight.replaceChildren();
    elements.sensitivityChart.replaceChildren();
    const values = activeValues();
    const range = activeTemplateState().sensitivityRange;
    const analysis = calculateSensitivity(state.activeTemplate, values, range);
    if (!analysis.baseSimulation || !analysis.items.length) {
      elements.sensitivityChart.append(createElement('div', 'sensitivity-empty', 'Complete the highlighted assumptions to calculate sensitivity. Missing values are never treated as zero.'));
      return;
    }

    const top = analysis.items[0];
    elements.sensitivityInsight.append(createElement('span', '', 'MOST INFLUENTIAL ASSUMPTION'));
    const insight = createElement('p');
    if (top.impact < EPSILON) {
      insight.textContent = `${top.label} has no effect across the tested ±${range}% range under these assumptions.`;
    } else if (top.reversalThreshold) {
      const fieldValue = formatFieldValue(top.field, top.reversalThreshold.value);
      const nextLeader = top.reversalThreshold.leader;
      insight.textContent = nextLeader
        ? `${top.label} moves the result most. A ${top.reversalThreshold.direction} to approximately ${fieldValue} reaches the tested decision boundary; beyond it, ${nextLeader} becomes financially preferable under these assumptions.`
        : `${top.label} moves the result most. A ${top.reversalThreshold.direction} to approximately ${fieldValue} brings the options to the tested decision boundary under these assumptions.`;
    } else {
      const low = Math.min(top.lowerMargin, top.upperMargin);
      const high = Math.max(top.lowerMargin, top.upperMargin);
      insight.textContent = `${top.label} moves the result most. Across the tested range, Option B’s relative result spans ${formatCurrency(low)} to ${formatCurrency(high)} without reversing the current conclusion.`;
    }
    elements.sensitivityInsight.append(insight);

    const domainValues = analysis.items.flatMap((item) => [item.lowerMargin, item.upperMargin]).concat(analysis.baseMargin, 0);
    let domainMin = Math.min(...domainValues);
    let domainMax = Math.max(...domainValues);
    if (Math.abs(domainMax - domainMin) < EPSILON) { domainMin -= 1; domainMax += 1; }
    const position = (value) => `${clamp(((value - domainMin) / (domainMax - domainMin)) * 100, 0, 100).toFixed(3)}%`;

    const scale = createElement('div', 'sensitivity-scale');
    scale.append(createElement('span', '', 'ASSUMPTION'));
    const axis = createElement('div');
    axis.append(createElement('span', '', `${formatCompactCurrency(domainMin)} · Option A advantage`), createElement('span', '', `${formatCompactCurrency(domainMax)} · Option B advantage`));
    scale.append(axis, createElement('span', '', 'TESTED RANGE'));
    elements.sensitivityChart.append(scale);

    analysis.items.forEach((item, index) => {
      const row = createElement('div', `sensitivity-row${item.reversal ? ' is-reversal' : ''}`);
      const name = createElement('div', 'sensitivity-row__name');
      name.append(createElement('strong', '', `${index + 1}. ${item.label}`));
      name.append(createElement('span', '', `Base ${formatFieldValue(item.field, item.baseValue)}`));
      const track = createElement('div', 'sensitivity-track');
      track.style.setProperty('--start', position(Math.min(item.lowerMargin, item.upperMargin)));
      track.style.setProperty('--end', position(Math.max(item.lowerMargin, item.upperMargin)));
      track.style.setProperty('--base', position(analysis.baseMargin));
      track.style.setProperty('--zero', position(0));
      track.append(createElement('span'));
      const detail = createElement('div', 'sensitivity-row__detail');
      detail.append(createElement('strong', '', `${formatFieldValue(item.field, item.lowerValue)} → ${formatFieldValue(item.field, item.upperValue)}`));
      const detailCopy = item.reversalThreshold
        ? `Reversal near ${formatFieldValue(item.field, item.reversalThreshold.value)}`
        : `Result swing ${formatCurrency(item.impact)}`;
      detail.append(createElement(item.reversalThreshold ? 'em' : 'span', '', detailCopy));
      row.append(name, track, detail);
      elements.sensitivityChart.append(row);
    });
  };

  const scenarioSimulation = (scenario) => {
    const values = scenarioValues(state.activeTemplate, scenario, activeTemplateState());
    return valuesAreSimulatable(state.activeTemplate, values) ? buildScenario(state.activeTemplate, values) : null;
  };

  const renderScenarioComparison = () => {
    elements.scenarioGrid.replaceChildren();
    const templateState = activeTemplateState();
    const base = scenarioValues(state.activeTemplate, 'base', templateState);
    const optionBName = state.activeTemplate === 'buyRent' ? base.rentName : base.educationName;
    elements.scenarioPerspectiveNote.textContent = `Optimistic means assumptions that improve ${cleanName(optionBName, 'Option B')}’s relative result; pessimistic means the opposite. Values are stress tests, not forecasts.`;

    const cases = ['pessimistic', 'base', 'optimistic'].map((scenario) => ({
      scenario,
      simulation: scenarioSimulation(scenario)
    }));
    const leaders = cases.map(({ simulation }) => simulation ? (leaderName(simulation) || 'Tie') : 'Incomplete');
    const uniqueLeaders = new Set(leaders.filter((leader) => leader !== 'Incomplete'));
    if (leaders.includes('Incomplete')) {
      elements.scenarioConsistency.textContent = 'Complete the assumptions to compare all three cases.';
    } else if (uniqueLeaders.size === 1) {
      elements.scenarioConsistency.textContent = `The conclusion is consistent across all three cases: ${leaders[0]} leads${leaders[0] === 'Tie' ? '' : ' at the horizon'}.`;
    } else {
      elements.scenarioConsistency.textContent = `The conclusion changes across scenarios: ${leaders.join(' · ')}. Review the assumptions with the greatest sensitivity.`;
    }

    cases.forEach(({ scenario, simulation }) => {
      const card = createElement('article', `scenario-result-card${templateState.activeScenario === scenario ? ' is-active' : ''}`);
      card.append(createElement('span', '', scenarioLabel(scenario).toUpperCase()));
      if (!simulation) {
        card.append(createElement('h3', '', 'Incomplete assumptions'));
        card.append(createElement('strong', '', '—'));
        card.append(createElement('p', '', 'Enter valid values to calculate this case.'));
      } else {
        const leader = leaderName(simulation);
        card.append(createElement('h3', '', leader ? `${leader} leads` : 'The options are level'));
        card.append(createElement('strong', '', formatCurrency(simulation.difference)));
        const crossover = simulation.crossover ? `Crossover around ${formatMonth(simulation.crossover.month)}.` : `No crossover within ${simulation.horizon} months.`;
        card.append(createElement('p', '', `${crossover} Result shown at month ${simulation.horizon}.`));
      }
      const edit = createElement('button', '', templateState.activeScenario === scenario ? 'Editing this case' : 'Edit this case');
      edit.type = 'button';
      edit.dataset.editScenario = scenario;
      card.append(edit);
      elements.scenarioGrid.append(card);
    });
  };

  const populateSnapshotSelect = (select, selectedId, placeholder) => {
    select.replaceChildren();
    const blank = createElement('option', '', placeholder);
    blank.value = '';
    select.append(blank);
    activeTemplateState().snapshots.forEach((snapshot) => {
      const option = createElement('option', '', snapshot.name);
      option.value = snapshot.id;
      select.append(option);
    });
    select.value = selectedId;
  };

  const renderSnapshotComparison = () => {
    elements.snapshotComparison.replaceChildren();
    const templateState = activeTemplateState();
    const left = templateState.snapshots.find((snapshot) => snapshot.id === templateState.compareLeft);
    const right = templateState.snapshots.find((snapshot) => snapshot.id === templateState.compareRight);
    if (!left || !right) {
      elements.snapshotComparison.append(createElement('div', 'sensitivity-empty', 'Choose two saved snapshots to compare their assumptions and results.'));
      return;
    }
    if (left.id === right.id) {
      elements.snapshotComparison.append(createElement('div', 'sensitivity-empty', 'Choose two different snapshots.'));
      return;
    }

    const leftSimulation = valuesAreSimulatable(state.activeTemplate, left.values) ? buildScenario(state.activeTemplate, left.values) : null;
    const rightSimulation = valuesAreSimulatable(state.activeTemplate, right.values) ? buildScenario(state.activeTemplate, right.values) : null;
    const comparison = createElement('div', 'snapshot-comparison');
    const summary = createElement('div');
    summary.append(createElement('h3', '', `${left.name} → ${right.name}`));
    if (leftSimulation && rightSimulation) {
      const leftLeader = leaderName(leftSimulation) || 'Tie';
      const rightLeader = leaderName(rightSimulation) || 'Tie';
      const marginDelta = resultMargin(rightSimulation) - resultMargin(leftSimulation);
      summary.append(createElement('p', '', `${leftLeader} → ${rightLeader}. Option B’s relative result changes by ${formatCurrency(marginDelta)} at each snapshot’s horizon.`));
    } else {
      summary.append(createElement('p', '', 'One snapshot has incomplete assumptions, so only input changes are shown.'));
    }

    const changes = createElement('div', 'snapshot-change-list');
    const allFields = [{ key: 'title', label: 'Question', type: 'text' }, ...Object.values(fieldDefinitions[state.activeTemplate])];
    const changed = allFields.filter((field) => left.values[field.key] !== right.values[field.key]);
    if (!changed.length) {
      changes.append(createElement('p', '', 'These snapshots contain the same assumptions.'));
    } else {
      changed.forEach((field) => {
        const row = createElement('div', 'snapshot-change');
        row.append(createElement('strong', '', field.label), createElement('span', '', formatFieldValue(field, left.values[field.key])), createElement('span', '', formatFieldValue(field, right.values[field.key])));
        changes.append(row);
      });
    }
    comparison.append(summary, changes);
    elements.snapshotComparison.append(comparison);
  };

  const renderSnapshots = () => {
    const templateState = activeTemplateState();
    elements.snapshotList.replaceChildren();
    if (!templateState.snapshots.length) {
      elements.snapshotList.append(createElement('div', 'sensitivity-empty', 'No snapshots yet. Save the assumptions currently shown to create one.'));
    } else {
      templateState.snapshots.forEach((snapshot) => {
        const simulation = valuesAreSimulatable(state.activeTemplate, snapshot.values) ? buildScenario(state.activeTemplate, snapshot.values) : null;
        const row = createElement('article', 'snapshot-row');
        const name = createElement('div', 'snapshot-row__name');
        if (renamingSnapshotId === snapshot.id) {
          const input = createElement('input', 'snapshot-rename-input');
          input.type = 'text';
          input.value = snapshot.name;
          input.maxLength = 50;
          input.dataset.snapshotRenameInput = snapshot.id;
          input.setAttribute('aria-label', `Rename ${snapshot.name}`);
          name.append(input);
        } else {
          name.append(createElement('strong', '', snapshot.name));
        }
        const savedDate = new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(snapshot.createdAt));
        name.append(createElement('span', '', savedDate));
        const result = createElement('div', 'snapshot-row__result', simulation ? describeMargin(simulation) : 'Incomplete assumptions');
        const actions = createElement('div', 'snapshot-row__actions');
        const actionSet = renamingSnapshotId === snapshot.id
          ? [['renameSave', 'Save name'], ['renameCancel', 'Cancel']]
          : pendingDeleteSnapshotId === snapshot.id
            ? [['deleteConfirm', 'Confirm delete'], ['deleteCancel', 'Cancel']]
            : [['restore', 'Restore'], ['rename', 'Rename'], ['delete', 'Delete']];
        actionSet.forEach(([action, label]) => {
          const button = createElement('button', '', label);
          button.type = 'button';
          button.dataset[`snapshot${action[0].toUpperCase()}${action.slice(1)}`] = snapshot.id;
          actions.append(button);
        });
        row.append(name, result, actions);
        elements.snapshotList.append(row);
      });
    }
    populateSnapshotSelect(elements.compareLeft, templateState.compareLeft, 'Choose first snapshot');
    populateSnapshotSelect(elements.compareRight, templateState.compareRight, 'Choose second snapshot');
    renderSnapshotComparison();
  };

  const renderSimulation = () => {
    const errors = validateValues();
    syncFieldErrors(errors);
    const valid = Object.keys(errors).length === 0;
    currentSimulation = valid ? buildScenario(state.activeTemplate, activeValues()) : null;
    elements.context.textContent = activeDefinition().context;
    renderVerdict(currentSimulation);
    renderLegend(currentSimulation);
    renderChart(currentSimulation);
    renderAnalysis(currentSimulation);
    renderMethod();
    renderSensitivity();
    renderScenarioComparison();
    renderSnapshots();
  };

  const renderAll = () => {
    const values = activeValues();
    elements.title.value = values.title;
    resizeTitle();
    elements.templateSwitch.querySelectorAll('[data-template]').forEach((button) => {
      const selected = button.dataset.template === state.activeTemplate;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    renderScenarioEditor();
    inspectionMonth = Number.isFinite(Number(values.horizon)) ? Number(values.horizon) : 0;
    renderForm();
    renderSimulation();
  };

  elements.title.addEventListener('input', (event) => {
    activeTemplateState().title = event.target.value;
    resizeTitle();
    saveState();
  });

  elements.form.addEventListener('input', (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    const definition = fieldDefinitions[state.activeTemplate][field];
    const nextValue = definition.type === 'number'
      ? (event.target.value === '' ? '' : Number(event.target.value))
      : event.target.value;
    const templateState = activeTemplateState();
    if (definition.type === 'text' || templateState.activeScenario === 'base') {
      templateState[field] = nextValue;
    } else {
      templateState.scenarioOverrides[templateState.activeScenario][field] = nextValue;
    }
    if (field === 'horizon') inspectionMonth = Number(event.target.value) || 0;
    saveState();
    renderSimulation();
  });

  elements.templateSwitch.addEventListener('click', (event) => {
    const template = event.target.closest('[data-template]')?.dataset.template;
    if (!template || template === state.activeTemplate || !TEMPLATE_DEFINITIONS[template]) return;
    state.activeTemplate = template;
    inspectionMonth = null;
    saveState();
    renderAll();
  });

  elements.templateSwitch.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const nextTemplate = state.activeTemplate === 'buyRent' ? 'career' : 'buyRent';
    const button = elements.templateSwitch.querySelector(`[data-template="${nextTemplate}"]`);
    button.click();
    button.focus();
  });

  elements.reset.addEventListener('click', () => {
    if (!window.confirm('Reset this template to its illustrative example? Current assumptions and scenario overrides will be replaced; saved snapshots will stay available.')) return;
    const defaults = defaultState();
    const existing = activeTemplateState();
    state[state.activeTemplate] = {
      ...defaults[state.activeTemplate],
      snapshots: existing.snapshots,
      compareLeft: existing.compareLeft,
      compareRight: existing.compareRight
    };
    inspectionMonth = null;
    saveState();
    renderAll();
    showToast('Illustrative example restored.');
  });

  elements.scenarioEditorTabs.addEventListener('click', (event) => {
    const scenario = event.target.closest('[data-scenario]')?.dataset.scenario;
    if (!['pessimistic', 'base', 'optimistic'].includes(scenario) || scenario === activeTemplateState().activeScenario) return;
    activeTemplateState().activeScenario = scenario;
    inspectionMonth = null;
    saveState();
    renderAll();
  });

  elements.scenarioEditorTabs.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const scenarios = ['pessimistic', 'base', 'optimistic'];
    const current = scenarios.indexOf(activeTemplateState().activeScenario);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = scenarios[(current + direction + scenarios.length) % scenarios.length];
    const button = elements.scenarioEditorTabs.querySelector(`[data-scenario="${next}"]`);
    button.click();
    button.focus();
  });

  elements.scenarioGrid.addEventListener('click', (event) => {
    const scenario = event.target.closest('[data-edit-scenario]')?.dataset.editScenario;
    if (!scenario) return;
    const button = elements.scenarioEditorTabs.querySelector(`[data-scenario="${scenario}"]`);
    button?.click();
    document.querySelector('#decision-setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  elements.sensitivityRange.addEventListener('input', (event) => {
    activeTemplateState().sensitivityRange = Number(event.target.value);
    saveState();
    renderAll();
  });

  elements.snapshotForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = elements.snapshotName.value.trim();
    if (!name) return;
    const templateState = activeTemplateState();
    templateState.snapshots.unshift({ id: makeId(), name: name.slice(0, 50), createdAt: Date.now(), values: { ...activeValues() } });
    templateState.snapshots = templateState.snapshots.slice(0, 50);
    elements.snapshotName.value = '';
    saveState();
    renderSnapshots();
    showToast('Snapshot saved locally.');
  });

  elements.snapshotList.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const templateState = activeTemplateState();
    const restoreId = button.dataset.snapshotRestore;
    const renameId = button.dataset.snapshotRename;
    const deleteId = button.dataset.snapshotDelete;
    const renameSaveId = button.dataset.snapshotRenameSave;
    const renameCancelId = button.dataset.snapshotRenameCancel;
    const deleteConfirmId = button.dataset.snapshotDeleteConfirm;
    const deleteCancelId = button.dataset.snapshotDeleteCancel;
    const id = restoreId || renameId || deleteId || renameSaveId || renameCancelId || deleteConfirmId || deleteCancelId;
    const snapshot = templateState.snapshots.find((item) => item.id === id);
    if (!snapshot) return;

    if (restoreId) {
      Object.assign(templateState, snapshot.values);
      templateState.activeScenario = 'base';
      templateState.scenarioOverrides = { pessimistic: {}, optimistic: {} };
      inspectionMonth = null;
      saveState();
      renderAll();
      showToast(`Restored “${snapshot.name}”.`);
      return;
    }
    if (renameId) {
      renamingSnapshotId = snapshot.id;
      pendingDeleteSnapshotId = null;
      renderSnapshots();
      elements.snapshotList.querySelector(`[data-snapshot-rename-input="${CSS.escape(snapshot.id)}"]`)?.focus();
      return;
    }
    if (renameSaveId) {
      const input = elements.snapshotList.querySelector(`[data-snapshot-rename-input="${CSS.escape(snapshot.id)}"]`);
      const nextName = input?.value.trim();
      if (!nextName) { input?.focus(); return; }
      snapshot.name = nextName.slice(0, 50);
      renamingSnapshotId = null;
      saveState();
      renderSnapshots();
      showToast('Snapshot renamed.');
      return;
    }
    if (renameCancelId) {
      renamingSnapshotId = null;
      renderSnapshots();
      return;
    }
    if (deleteId) {
      pendingDeleteSnapshotId = snapshot.id;
      renamingSnapshotId = null;
      renderSnapshots();
      return;
    }
    if (deleteCancelId) {
      pendingDeleteSnapshotId = null;
      renderSnapshots();
      return;
    }
    if (deleteConfirmId) {
      templateState.snapshots = templateState.snapshots.filter((item) => item.id !== snapshot.id);
      if (templateState.compareLeft === snapshot.id) templateState.compareLeft = '';
      if (templateState.compareRight === snapshot.id) templateState.compareRight = '';
      pendingDeleteSnapshotId = null;
      saveState();
      renderSnapshots();
      showToast('Snapshot deleted.');
    }
  });

  elements.snapshotList.addEventListener('keydown', (event) => {
    const input = event.target.closest('[data-snapshot-rename-input]');
    if (!input || !['Enter', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    const id = input.dataset.snapshotRenameInput;
    const action = event.key === 'Enter' ? 'renameSave' : 'renameCancel';
    elements.snapshotList.querySelector(`[data-snapshot-${action.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${CSS.escape(id)}"]`)?.click();
  });

  elements.compareLeft.addEventListener('change', (event) => {
    activeTemplateState().compareLeft = event.target.value;
    saveState();
    renderSnapshotComparison();
  });

  elements.compareRight.addEventListener('change', (event) => {
    activeTemplateState().compareRight = event.target.value;
    saveState();
    renderSnapshotComparison();
  });

  elements.scrubber.addEventListener('input', (event) => {
    inspectionMonth = Number(event.target.value);
    renderChart(currentSimulation);
  });

  elements.chart.addEventListener('pointermove', (event) => {
    if (!currentSimulation) return;
    const bounds = elements.chart.getBoundingClientRect();
    const { width, margin } = getChartGeometry();
    const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * width;
    const ratio = clamp((viewBoxX - margin.left) / (width - margin.left - margin.right), 0, 1);
    const month = Math.round(ratio * currentSimulation.horizon);
    if (month === inspectionMonth) return;
    inspectionMonth = month;
    renderChart(currentSimulation);
  });

  elements.chart.addEventListener('pointerdown', (event) => {
    if (!currentSimulation) return;
    elements.chart.setPointerCapture?.(event.pointerId);
  });

  window.matchMedia('(max-width: 720px)').addEventListener('change', () => {
    renderChart(currentSimulation);
  });

  renderAll();
  saveState();
  if (storageWarning) window.setTimeout(() => showToast(storageWarning), 500);

  window.DecisionLens = Object.freeze({
    simulateScenario,
    findCrossover,
    calculateBuyRentThreshold,
    calculateCareerThreshold,
    buildScenario,
    validateState,
    resultMargin,
    generateScenarioValues,
    calculateSensitivity
  });
})();
