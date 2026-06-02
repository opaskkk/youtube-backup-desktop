const ACTIVE_STATUSES = new Set(['queued', 'inspecting', 'downloading', 'merging', 'transcoding']);
const COMPLETED_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const SUPPORTED_THEME_MODES = new Set(['light', 'dark', 'system']);
const VIEW_IDS = ['create', 'queue', 'completed', 'settings'];
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

const state = {
  settings: null,
  jobs: [],
  language: 'en',
  themeMode: 'system',
  view: 'create'
};

const COPY = {
  en: {
    documentTitle: 'YouTube Backup Desktop',
    sidebarWork: 'Work',
    sidebarSettings: 'Settings',
    navNewBackup: 'New backup',
    navQueue: 'Queue',
    navCompleted: 'Completed',
    navPreferences: 'Preferences',
    createKicker: 'New backup',
    createTitle: 'New backup',
    createSubtitle: 'Save YouTube videos locally at the best quality available.',
    createSettingsHint: 'Theme, language, and backup options can be changed in Preferences.',
    queueKicker: 'Queue',
    queueTitle: 'Queue',
    queueSubtitle: 'Keep track of active downloads and encoding jobs.',
    queueListTitle: 'Active jobs',
    completedKicker: 'Completed',
    completedTitle: 'Completed',
    completedSubtitle: 'Review completed, failed, and cancelled jobs in one place.',
    completedListTitle: 'History',
    settingsKicker: 'Preferences',
    settingsTitle: 'Preferences',
    settingsSubtitle: 'Adjust theme, language, and backup defaults for new jobs.',
    languageLabel: 'Language',
    themeLabel: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    urlLabel: 'Video URL',
    urlPlaceholder: 'https://www.youtube.com/watch?v=...',
    customTitleLabel: 'Save as title (optional)',
    customTitlePlaceholder: 'Use the original title',
    outputDirLabel: 'Output folder',
    browseButton: 'Browse',
    openFolderButton: 'Open',
    queueButton: 'Queue backup',
    allowMkvFallbackLabel: 'Allow MKV fallback to preserve quality',
    writeMetadataLabel: 'Save metadata JSON',
    writeThumbnailLabel: 'Save thumbnail',
    writeSubsLabel: 'Save subtitles if available',
    encodingModeLabel: 'Encoding mode',
    encodingHelpTriggerLabel: 'Encoding mode help',
    encodingModeHint: 'Used only when MP4 re-encoding is needed.',
    encodingModeCpuQuality: 'CPU high quality',
    encodingModeGpuFast: 'GPU fast',
    encodingModeGpuQuality: 'GPU high quality',
    encodingHelpSummary: {
      cpu_quality: 'Best compatibility with CPU-based H.264 encoding.',
      gpu_fast: 'Fastest turnaround with a GPU-first H.264 path.',
      gpu_quality: 'Better visual quality while still preferring GPU acceleration.'
    },
    encodingHelpDetail: {
      cpu_quality: 'libx264 (H.264), CRF 18, preset medium. Audio is encoded as AAC 192k.',
      gpu_fast: 'Uses H.264 via NVENC, QSV, or AMF with a fast preset. Falls back to CPU when needed.',
      gpu_quality: 'Uses H.264 via NVENC, QSV, or AMF with quality-focused settings. Falls back to CPU when needed.'
    },
    emptyQueueState: 'No active jobs yet. Add a link to start your backup queue.',
    emptyCompletedState: 'No finished jobs yet.',
    queueSummary: '{total} jobs / {active} active',
    completedSummary: '{total} total / {completed} completed / {failed} failed / {cancelled} cancelled',
    resolutionLabel: 'Resolution',
    containerLabel: 'Container',
    finalFileLabel: 'Final file',
    outputFolderLabel: 'Output folder',
    encodingTimeLabel: 'Encoding time',
    pending: 'Pending',
    retryButton: 'Retry',
    cancelButton: 'Cancel',
    openButton: 'Open',
    logSummary: 'Logs',
    chooseOutputDir: 'Choose an output folder before creating a backup job.',
    openOutputDirError: 'Choose an output folder before opening it.',
    backupQueued: 'Backup job queued.',
    downloadProgressLabel: 'Downloading',
    downloadCompleteLabel: 'Download complete',
    encodingStartLabel: 'Encoding starting',
    mergingProgressLabel: 'Finalizing download',
    transcodingProgressLabel: 'Encoding',
    progressEtaSuffix: 'left',
    statusBadge: {
      queued: 'Queued',
      inspecting: 'Inspecting',
      downloading: 'Downloading',
      merging: 'Merging',
      transcoding: 'Encoding',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled'
    },
    statusDetail: {
      queued: 'Queued',
      inspecting: 'Inspecting',
      downloading: 'Downloading',
      merging: 'Merging',
      transcoding: 'Encoding',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled'
    }
  },
  ko: {
    documentTitle: '\uC720\uD29C\uBE0C \uBC31\uC5C5 \uB370\uC2A4\uD06C\uD0D1',
    sidebarWork: '\uC791\uC5C5',
    sidebarSettings: '\uC124\uC815',
    navNewBackup: '\uC0C8 \uBC31\uC5C5',
    navQueue: '\uB300\uAE30\uC5F4',
    navCompleted: '\uC644\uB8CC\uB428',
    navPreferences: '\uD658\uACBD\uC124\uC815',
    createKicker: '\uC0C8 \uBC31\uC5C5',
    createTitle: '\uC0C8 \uBC31\uC5C5',
    createSubtitle: '\uC720\uD29C\uBE0C \uC601\uC0C1\uC744 \uCD5C\uACE0 \uD488\uC9C8\uB85C \uB85C\uCEEC\uC5D0 \uC800\uC7A5\uD569\uB2C8\uB2E4.',
    createSettingsHint: '\uD14C\uB9C8, \uC5B8\uC5B4, \uBC31\uC5C5 \uC635\uC158\uC740 \uD658\uACBD\uC124\uC815\uC5D0\uC11C \uBC14\uAFC0 \uC218 \uC788\uC2B5\uB2C8\uB2E4.',
    queueKicker: '\uB300\uAE30\uC5F4',
    queueTitle: '\uB300\uAE30\uC5F4',
    queueSubtitle: '\uC9C4\uD589 \uC911\uC778 \uB2E4\uC6B4\uB85C\uB4DC\uC640 \uC778\uCF54\uB529 \uC791\uC5C5\uC744 \uD55C\uB208\uC5D0 \uBCF4\uC138\uC694.',
    queueListTitle: '\uC9C4\uD589 \uC911 \uC791\uC5C5',
    completedKicker: '\uC644\uB8CC\uB428',
    completedTitle: '\uC644\uB8CC\uB428',
    completedSubtitle: '\uC644\uB8CC, \uC2E4\uD328, \uCDE8\uC18C \uC774\uB825\uC744 \uD55C \uACF3\uC5D0\uC11C \uD655\uC778\uD558\uC138\uC694.',
    completedListTitle: '\uC791\uC5C5 \uC774\uB825',
    settingsKicker: '\uD658\uACBD\uC124\uC815',
    settingsTitle: '\uD658\uACBD\uC124\uC815',
    settingsSubtitle: '\uD14C\uB9C8, \uC5B8\uC5B4, \uAE30\uBCF8 \uBC31\uC5C5 \uC635\uC158\uC744 \uC870\uC815\uD569\uB2C8\uB2E4.',
    languageLabel: '\uC5B8\uC5B4',
    themeLabel: '\uD14C\uB9C8',
    themeLight: '\uC77C\uBC18',
    themeDark: '\uB2E4\uD06C',
    themeSystem: '\uC2DC\uC2A4\uD15C',
    urlLabel: '\uC601\uC0C1 URL',
    urlPlaceholder: 'https://www.youtube.com/watch?v=...',
    customTitleLabel: '\uC800\uC7A5 \uD30C\uC77C\uBA85 (\uC120\uD0DD)',
    customTitlePlaceholder: '\uC6D0\uBCF8 \uC81C\uBAA9 \uC0AC\uC6A9',
    outputDirLabel: '\uC800\uC7A5 \uD3F4\uB354',
    browseButton: '\uCC3E\uAE30',
    openFolderButton: '\uC5F4\uAE30',
    queueButton: '\uBC31\uC5C5 \uCD94\uAC00',
    allowMkvFallbackLabel: '\uD488\uC9C8 \uC720\uC9C0\uB97C \uC704\uD574 MKV fallback \uD5C8\uC6A9',
    writeMetadataLabel: '\uBA54\uD0C0\uB370\uC774\uD130 JSON \uC800\uC7A5',
    writeThumbnailLabel: '\uC378\uB124\uC77C \uC800\uC7A5',
    writeSubsLabel: '\uC790\uB9C9\uC774 \uC788\uC73C\uBA74 \uD568\uAED8 \uC800\uC7A5',
    encodingModeLabel: '\uC778\uCF54\uB529 \uBAA8\uB4DC',
    encodingHelpTriggerLabel: '\uC778\uCF54\uB529 \uBAA8\uB4DC \uB3C4\uC6C0\uB9D0',
    encodingModeHint: 'MP4 \uC7AC\uC778\uCF54\uB529\uC774 \uD544\uC694\uD560 \uB54C\uB9CC \uC0AC\uC6A9\uB429\uB2C8\uB2E4.',
    encodingModeCpuQuality: 'CPU \uACE0\uD488\uC9C8',
    encodingModeGpuFast: 'GPU \uBE60\uB984',
    encodingModeGpuQuality: 'GPU \uACE0\uD488\uC9C8',
    encodingHelpSummary: {
      cpu_quality: '\uD638\uD658\uC131\uC774 \uC88B\uC740 CPU \uAE30\uBC18 H.264 \uC778\uCF54\uB529\uC785\uB2C8\uB2E4.',
      gpu_fast: 'GPU \uC6B0\uC120 H.264 \uACBD\uB85C\uB85C \uAC00\uC7A5 \uBE60\uB978 \uCC98\uB9AC \uC18D\uB3C4\uB97C \uB0C5\uB2C8\uB2E4.',
      gpu_quality: 'GPU \uAC00\uC18D\uC744 \uC6B0\uC120\uD558\uBA74\uC11C \uD488\uC9C8\uC744 \uB354 \uC911\uC2DC\uD558\uB294 \uBAA8\uB4DC\uC785\uB2C8\uB2E4.'
    },
    encodingHelpDetail: {
      cpu_quality: 'libx264 (H.264), CRF 18, preset medium \uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uC624\uB514\uC624\uB294 AAC 192k\uB85C \uC778\uCF54\uB529\uB429\uB2C8\uB2E4.',
      gpu_fast: 'NVENC, QSV, AMF \uC911 \uAC00\uB2A5\uD55C H.264 \uC778\uCF54\uB354\uC640 \uBE60\uB978 preset\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uD544\uC694\uD558\uBA74 CPU\uB85C fallback\uB429\uB2C8\uB2E4.',
      gpu_quality: 'NVENC, QSV, AMF \uC911 \uAC00\uB2A5\uD55C H.264 \uC778\uCF54\uB354\uC640 \uD488\uC9C8 \uC6B0\uC120 \uC124\uC815\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uD544\uC694\uD558\uBA74 CPU\uB85C fallback\uB429\uB2C8\uB2E4.'
    },
    emptyQueueState: '\uC9C4\uD589 \uC911\uC778 \uC791\uC5C5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uB9C1\uD06C\uB97C \uCD94\uAC00\uD574 \uBC31\uC5C5\uC744 \uC2DC\uC791\uD558\uC138\uC694.',
    emptyCompletedState: '\uC644\uB8CC\uB41C \uC791\uC5C5 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.',
    queueSummary: '\uC804\uCCB4 {total}\uAC1C / \uC9C4\uD589 \uC911 {active}\uAC1C',
    completedSummary: '\uCD1D {total}\uAC1C / \uC644\uB8CC {completed}\uAC1C / \uC2E4\uD328 {failed}\uAC1C / \uCDE8\uC18C {cancelled}\uAC1C',
    resolutionLabel: '\uD574\uC0C1\uB3C4',
    containerLabel: '\uCEE8\uD14C\uC774\uB108',
    finalFileLabel: '\uCD5C\uC885 \uD30C\uC77C',
    outputFolderLabel: '\uC800\uC7A5 \uD3F4\uB354',
    encodingTimeLabel: '\uC778\uCF54\uB529 \uC2DC\uAC04',
    pending: '\uB300\uAE30 \uC911',
    retryButton: '\uB2E4\uC2DC \uC2DC\uB3C4',
    cancelButton: '\uCDE8\uC18C',
    openButton: '\uC5F4\uAE30',
    logSummary: '\uB85C\uADF8',
    chooseOutputDir: '\uBC31\uC5C5 \uC791\uC5C5\uC744 \uB9CC\uB4E4\uAE30 \uC804\uC5D0 \uC800\uC7A5 \uD3F4\uB354\uB97C \uC120\uD0DD\uD558\uC138\uC694.',
    openOutputDirError: '\uBA3C\uC800 \uC800\uC7A5 \uD3F4\uB354\uB97C \uC120\uD0DD\uD558\uC138\uC694.',
    backupQueued: '\uBC31\uC5C5 \uC791\uC5C5\uC744 \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4.',
    downloadProgressLabel: '\uB2E4\uC6B4\uB85C\uB4DC',
    downloadCompleteLabel: '\uB2E4\uC6B4\uB85C\uB4DC \uC644\uB8CC',
    encodingStartLabel: '\uC778\uCF54\uB529 \uC2DC\uC791',
    mergingProgressLabel: '\uB2E4\uC6B4\uB85C\uB4DC \uB9C8\uBB34\uB9AC \uC911',
    transcodingProgressLabel: '\uC778\uCF54\uB529',
    progressEtaSuffix: '\uB0A8\uC74C',
    statusBadge: {
      queued: '\uB300\uAE30 \uC911',
      inspecting: '\uD655\uC778 \uC911',
      downloading: '\uB2E4\uC6B4\uB85C\uB4DC \uC911',
      merging: '\uC815\uB9AC \uC911',
      transcoding: '\uC778\uCF54\uB529 \uC911',
      completed: '\uC644\uB8CC',
      failed: '\uC2E4\uD328',
      cancelled: '\uCDE8\uC18C\uB428'
    },
    statusDetail: {
      queued: '\uB300\uAE30 \uC911',
      inspecting: '\uD655\uC778 \uC911',
      downloading: '\uB2E4\uC6B4\uB85C\uB4DC \uC911',
      merging: '\uBCF4\uC815 \uC911',
      transcoding: '\uC778\uCF54\uB529 \uC911',
      completed: '\uC644\uB8CC',
      failed: '\uC2E4\uD328',
      cancelled: '\uCDE8\uC18C\uB428'
    }
  }
};

const els = {
  form: document.querySelector('#job-form'),
  url: document.querySelector('#url'),
  customTitle: document.querySelector('#customTitle'),
  outputDir: document.querySelector('#outputDir'),
  pickDir: document.querySelector('#pickDir'),
  openDir: document.querySelector('#openDir'),
  language: document.querySelector('#language'),
  allowMkvFallback: document.querySelector('#allowMkvFallback'),
  writeMetadata: document.querySelector('#writeMetadata'),
  writeThumbnail: document.querySelector('#writeThumbnail'),
  writeSubs: document.querySelector('#writeSubs'),
  encodingMode: document.querySelector('#encodingMode'),
  encodingHelpTrigger: document.querySelector('#encodingHelpTrigger'),
  encodingHelpSummary: document.querySelector('#encoding-help-summary'),
  encodingHelpDetail: document.querySelector('#encoding-help-detail'),
  formMessage: document.querySelector('#form-message'),
  queueCount: document.querySelector('#queue-count'),
  queueSummary: document.querySelector('#queue-summary'),
  queueJobs: document.querySelector('#queue-jobs'),
  queueEmptyState: document.querySelector('#queue-empty-state'),
  completedSummary: document.querySelector('#completed-summary'),
  completedJobs: document.querySelector('#completed-jobs'),
  completedEmptyState: document.querySelector('#completed-empty-state'),
  navButtons: Array.from(document.querySelectorAll('.nav-item[data-view]')),
  themeButtons: Array.from(document.querySelectorAll('[data-theme-mode]')),
  views: Object.fromEntries(
    VIEW_IDS.map((view) => [view, document.querySelector(`#view-${view}`)])
  ),
  jobTemplate: document.querySelector('#job-template')
};

function getCopy() {
  return COPY[state.language] || COPY.en;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatTemplate(template, replacements) {
  return Object.entries(replacements).reduce(
    (acc, [key, replacement]) => acc.replaceAll(`{${key}}`, String(replacement)),
    template
  );
}

function formatPercent(progress) {
  if (typeof progress !== 'number' || Number.isNaN(progress)) {
    return '0%';
  }

  return `${Math.max(0, Math.min(100, progress)).toFixed(0)}%`;
}

function formatDurationLabel(durationMs) {
  const totalSeconds = Math.round((Number(durationMs) || 0) / 1000);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getStatusBadgeLabel(status) {
  return getCopy().statusBadge[status] || status;
}

function getStatusDetailLabel(status) {
  return getCopy().statusDetail[status] || status;
}

function getCounts() {
  const active = state.jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length;
  const completed = state.jobs.filter((job) => job.status === 'completed').length;
  const failed = state.jobs.filter((job) => job.status === 'failed').length;
  const cancelled = state.jobs.filter((job) => job.status === 'cancelled').length;

  return {
    total: state.jobs.length,
    active,
    completed,
    failed,
    cancelled,
    history: completed + failed + cancelled
  };
}

function getQueueJobs() {
  return state.jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).slice().reverse();
}

function getCompletedJobs() {
  return state.jobs.filter((job) => COMPLETED_STATUSES.has(job.status)).slice().reverse();
}

function resolveTheme(themeMode) {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  return systemThemeQuery.matches ? 'dark' : 'light';
}

function updateThemeButtons() {
  els.themeButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.themeMode === state.themeMode);
  });
}

function applyThemeMode(themeMode) {
  state.themeMode = SUPPORTED_THEME_MODES.has(themeMode) ? themeMode : 'system';
  document.documentElement.dataset.theme = resolveTheme(state.themeMode);
  updateThemeButtons();
}

function updateEncodingHelp() {
  const copy = getCopy();
  const mode = els.encodingMode.value || 'gpu_fast';
  els.encodingHelpSummary.textContent = copy.encodingHelpSummary[mode] || '';
  els.encodingHelpDetail.textContent = copy.encodingHelpDetail[mode] || '';
}

function updateNavigation() {
  const counts = getCounts();
  els.queueCount.textContent = String(counts.active);

  els.navButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === state.view);
  });
}

function updateViewVisibility() {
  VIEW_IDS.forEach((view) => {
    const isActive = state.view === view;
    const element = els.views[view];
    if (!element) {
      return;
    }

    element.hidden = !isActive;
    element.classList.toggle('is-active', isActive);
  });
}

function renderSummaries() {
  const copy = getCopy();
  const counts = getCounts();

  els.queueSummary.textContent = formatTemplate(copy.queueSummary, {
    total: counts.total,
    active: counts.active
  });

  els.completedSummary.textContent = formatTemplate(copy.completedSummary, {
    total: counts.history,
    completed: counts.completed,
    failed: counts.failed,
    cancelled: counts.cancelled
  });
}

function getProgressNote(job) {
  const progress = job.progress || null;
  if (!progress) {
    return '';
  }

  const copy = getCopy();

  if (progress.phase === 'downloading') {
    const parts = [`${copy.downloadProgressLabel} ${formatPercent(progress.percent)}`];
    if (progress.eta) {
      parts.push(`${progress.eta} ${copy.progressEtaSuffix}`);
    }
    return parts.join(' / ');
  }

  if (progress.phase === 'merging') {
    return `${copy.downloadCompleteLabel} / ${copy.mergingProgressLabel}`;
  }

  if (progress.phase === 'transcoding') {
    if ((progress.percent || 0) <= 0) {
      return `${copy.downloadCompleteLabel} / ${copy.encodingStartLabel}`;
    }

    const parts = [`${copy.transcodingProgressLabel} ${formatPercent(progress.percent)}`];
    if (progress.eta) {
      parts.push(`${progress.eta} ${copy.progressEtaSuffix}`);
    }
    return parts.join(' / ');
  }

  return '';
}

function getProgressStats(job) {
  const progress = job.progress || null;
  if (!progress) {
    return '';
  }

  const parts = [];
  if (typeof progress.percent === 'number') {
    parts.push(formatPercent(progress.percent));
  }
  if (progress.speed) {
    parts.push(progress.speed);
  }
  return parts.join(' / ');
}

function getStatusBadgeClass(status) {
  if (status === 'completed') {
    return 'is-completed';
  }

  if (status === 'failed') {
    return 'is-failed';
  }

  if (status === 'cancelled') {
    return 'is-cancelled';
  }

  return 'is-active';
}

function fillJobMeta(meta, job) {
  const copy = getCopy();
  const rows = [
    [copy.resolutionLabel, job.result?.resolution || job.inspect?.bestResolution || copy.pending],
    [copy.containerLabel, job.result?.container || copy.pending],
    [copy.outputFolderLabel, job.outputDir || copy.pending]
  ];

  if (job.result?.finalPath) {
    rows.push([copy.finalFileLabel, job.result.finalPath]);
  }

  if (job.result?.wasTranscodedToMp4 && job.result?.transcodeDurationMs > 0) {
    rows.push([copy.encodingTimeLabel, formatDurationLabel(job.result.transcodeDurationMs)]);
  }

  meta.innerHTML = rows
    .map(([term, description]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(description)}</dd></div>`)
    .join('');
}

function fillWarnings(warningsElement, job) {
  const warningItems = [job.error, ...(job.result?.warnings || [])].filter(Boolean);
  warningsElement.innerHTML = warningItems.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('');
  warningsElement.hidden = warningItems.length === 0;
}

function fillLogs(logWrap, logSummary, logOutput, job) {
  const logs = Array.isArray(job.logs) ? job.logs.slice(-14) : [];
  logSummary.textContent = getCopy().logSummary;
  logOutput.textContent = logs.join('\n');
  logWrap.hidden = logs.length === 0;
}

function addJobActions(actions, job) {
  const copy = getCopy();

  if (job.status === 'completed' && job.outputDir) {
    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'secondary';
    openButton.textContent = copy.openButton;
    openButton.addEventListener('click', async () => {
      await window.youtubeBackupApp.openDirectory(job.outputDir);
    });
    actions.appendChild(openButton);
  }

  if (COMPLETED_STATUSES.has(job.status)) {
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'secondary';
    retryButton.textContent = copy.retryButton;
    retryButton.addEventListener('click', async () => {
      await window.youtubeBackupApp.retryJob(job.id);
    });
    actions.appendChild(retryButton);
  }

  if (ACTIVE_STATUSES.has(job.status)) {
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'secondary';
    cancelButton.textContent = copy.cancelButton;
    cancelButton.addEventListener('click', async () => {
      await window.youtubeBackupApp.cancelJob(job.id);
    });
    actions.appendChild(cancelButton);
  }
}

function createJobCard(job) {
  const fragment = els.jobTemplate.content.cloneNode(true);
  const badge = fragment.querySelector('.status-badge');
  const subtitle = fragment.querySelector('.job-subtitle');
  const title = fragment.querySelector('.job-title');
  const progressBar = fragment.querySelector('.progress-bar');
  const progressNote = fragment.querySelector('.job-progress-note');
  const progressStats = fragment.querySelector('.job-progress-stats');
  const meta = fragment.querySelector('.job-meta');
  const warnings = fragment.querySelector('.warnings');
  const logWrap = fragment.querySelector('.job-log-wrap');
  const logSummary = fragment.querySelector('.job-log-summary');
  const logOutput = fragment.querySelector('.job-log');
  const actions = fragment.querySelector('.job-header-actions');

  badge.textContent = getStatusBadgeLabel(job.status);
  badge.classList.add(getStatusBadgeClass(job.status));

  const subtitleParts = [getStatusDetailLabel(job.status)];
  if (job.progress?.phase && job.progress.phase !== job.status) {
    subtitleParts.push(getStatusDetailLabel(job.progress.phase));
  }
  if (job.result?.container) {
    subtitleParts.push(String(job.result.container).toUpperCase());
  }
  if (job.result?.resolution || job.inspect?.bestResolution) {
    subtitleParts.push(job.result?.resolution || job.inspect?.bestResolution);
  }
  subtitle.textContent = subtitleParts.filter(Boolean).join(' / ');

  title.textContent = job.title || job.url;

  progressBar.style.width = formatPercent(job.progress?.percent);
  progressNote.textContent = getProgressNote(job);
  progressNote.hidden = !progressNote.textContent;
  progressStats.textContent = getProgressStats(job);
  progressStats.hidden = !progressStats.textContent;

  fillJobMeta(meta, job);
  fillWarnings(warnings, job);
  fillLogs(logWrap, logSummary, logOutput, job);
  addJobActions(actions, job);

  return fragment;
}

function renderJobList(container, emptyState, jobs) {
  container.innerHTML = '';
  emptyState.hidden = jobs.length > 0;

  jobs.forEach((job) => {
    container.appendChild(createJobCard(job));
  });
}

function renderJobs() {
  renderSummaries();
  renderJobList(els.queueJobs, els.queueEmptyState, getQueueJobs());
  renderJobList(els.completedJobs, els.completedEmptyState, getCompletedJobs());
  updateNavigation();
  updateViewVisibility();
}

function translatePage() {
  const copy = getCopy();
  document.documentElement.lang = state.language;
  document.title = copy.documentTitle;

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (copy[key]) {
      element.textContent = copy[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (copy[key]) {
      element.placeholder = copy[key];
    }
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    if (copy[key]) {
      element.setAttribute('aria-label', copy[key]);
    }
  });

  const languageOptions = els.language?.querySelectorAll('option');
  if (languageOptions?.length) {
    languageOptions.forEach((option) => {
      option.textContent = option.value === 'ko' ? '\uD55C\uAD6D\uC5B4' : 'English';
    });
  }
}

function applyLanguage(language) {
  state.language = language === 'ko' ? 'ko' : 'en';
  translatePage();
  renderJobs();
}

function applySettings(settings) {
  state.settings = settings;
  els.language.value = settings.language || 'en';
  applyLanguage(settings.language || 'en');
  applyThemeMode(settings.themeMode || 'system');
  els.outputDir.value = settings.outputDir || '';
  els.openDir.disabled = !els.outputDir.value.trim();
  els.allowMkvFallback.checked = settings.allowMkvFallback !== false;
  els.writeMetadata.checked = settings.writeMetadata !== false;
  els.writeThumbnail.checked = settings.writeThumbnail !== false;
  els.writeSubs.checked = settings.writeSubs !== false;
  els.encodingMode.value = settings.encodingMode || 'gpu_fast';
  updateEncodingHelp();
}

async function persistSettings() {
  const nextSettings = {
    language: els.language.value,
    themeMode: state.themeMode,
    outputDir: els.outputDir.value.trim(),
    preferContainer: 'mp4',
    allowMkvFallback: els.allowMkvFallback.checked,
    encodingMode: els.encodingMode.value,
    writeMetadata: els.writeMetadata.checked,
    writeThumbnail: els.writeThumbnail.checked,
    writeSubs: els.writeSubs.checked
  };

  state.settings = await window.youtubeBackupApp.saveSettings(nextSettings);
  els.openDir.disabled = !nextSettings.outputDir;
}

function syncFormWithSavedSettings() {
  els.outputDir.value = state.settings?.outputDir || '';
  els.openDir.disabled = !els.outputDir.value.trim();
  els.allowMkvFallback.checked = state.settings?.allowMkvFallback !== false;
  els.writeMetadata.checked = state.settings?.writeMetadata !== false;
  els.writeThumbnail.checked = state.settings?.writeThumbnail !== false;
  els.writeSubs.checked = state.settings?.writeSubs !== false;
  els.encodingMode.value = state.settings?.encodingMode || 'gpu_fast';
  updateEncodingHelp();
}

function setView(view) {
  state.view = VIEW_IDS.includes(view) ? view : 'create';
  updateNavigation();
  updateViewVisibility();

  if (state.view === 'create') {
    els.url?.focus();
  }
}

function bindNavigation() {
  els.navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setView(button.dataset.view);
    });
  });
}

function bindThemePicker() {
  els.themeButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      applyThemeMode(button.dataset.themeMode);
      await persistSettings();
    });
  });

  if (typeof systemThemeQuery.addEventListener === 'function') {
    systemThemeQuery.addEventListener('change', () => {
      if (state.themeMode === 'system') {
        applyThemeMode('system');
      }
    });
  }
}

function bindDirectoryActions() {
  els.pickDir.addEventListener('click', async () => {
    const selectedDir = await window.youtubeBackupApp.pickOutputDirectory(state.language);
    if (!selectedDir) {
      return;
    }

    els.outputDir.value = selectedDir;
    els.openDir.disabled = false;
    await persistSettings();
  });

  els.openDir.addEventListener('click', async () => {
    const outputDir = els.outputDir.value.trim();
    if (!outputDir) {
      els.formMessage.textContent = getCopy().openOutputDirError;
      return;
    }

    const result = await window.youtubeBackupApp.openDirectory(outputDir);
    if (!result?.ok) {
      els.formMessage.textContent = result?.message || getCopy().openOutputDirError;
    }
  });
}

function bindSettingsControls() {
  els.allowMkvFallback.addEventListener('change', persistSettings);
  els.writeMetadata.addEventListener('change', persistSettings);
  els.writeThumbnail.addEventListener('change', persistSettings);
  els.writeSubs.addEventListener('change', persistSettings);

  els.encodingMode.addEventListener('change', async () => {
    updateEncodingHelp();
    await persistSettings();
  });

  els.language.addEventListener('change', async () => {
    applyLanguage(els.language.value);
    updateEncodingHelp();
    await window.youtubeBackupApp.setLanguage(els.language.value);
    await persistSettings();
  });
}

function bindForm() {
  els.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.formMessage.textContent = '';

    const payload = {
      url: els.url.value.trim(),
      customTitle: els.customTitle.value.trim(),
      outputDir: els.outputDir.value.trim(),
      preferContainer: 'mp4',
      allowMkvFallback: els.allowMkvFallback.checked,
      encodingMode: els.encodingMode.value,
      writeMetadata: els.writeMetadata.checked,
      writeThumbnail: els.writeThumbnail.checked,
      writeSubs: els.writeSubs.checked
    };

    if (!payload.outputDir) {
      els.formMessage.textContent = getCopy().chooseOutputDir;
      return;
    }

    try {
      await persistSettings();
      await window.youtubeBackupApp.createJob(payload);
      els.form.reset();
      syncFormWithSavedSettings();
      els.formMessage.textContent = getCopy().backupQueued;
      setView('queue');
    } catch (error) {
      els.formMessage.textContent = error.message;
    }
  });
}

window.youtubeBackupApp.onJobsUpdated((jobs) => {
  state.jobs = jobs;
  renderJobs();
});

async function boot() {
  bindNavigation();
  bindThemePicker();
  bindDirectoryActions();
  bindSettingsControls();
  bindForm();

  const { settings, jobs } = await window.youtubeBackupApp.getInitialState();
  applySettings(settings);
  state.jobs = jobs;
  renderJobs();
  setView(state.view);
}

boot().catch((error) => {
  els.formMessage.textContent = error.message;
});
