const state = {
  settings: null,
  jobs: [],
  language: 'en'
};

const COPY = {
  en: {
    documentTitle: 'YouTube Backup Desktop',
    heroEyebrow: 'Windows Backup Utility',
    heroTitle: 'Paste a video link and save the best version YouTube will still serve.',
    heroLede: 'Choose a destination folder, queue the link, and the app will pull the best available video and audio streams into a clean backup folder.',
    heroCardTitle: 'How it works',
    heroPoint1: 'Paste a link you can already open in your browser',
    heroPoint2: 'Save the best available video and audio combination',
    heroPoint3: 'Keep metadata, thumbnails, and subtitles when you want them',
    createKicker: 'Create backup job',
    createTitle: 'New video backup',
    languageLabel: 'Language',
    urlLabel: 'YouTube video URL',
    urlPlaceholder: 'https://www.youtube.com/watch?v=...',
    customTitleLabel: 'Save as title',
    customTitlePlaceholder: 'Leave blank to use the original YouTube title',
    outputDirLabel: 'Output folder',
    browseButton: 'Browse',
    openFolderButton: 'Open folder',
    advancedSummary: 'Advanced options',
    allowMkvFallbackLabel: 'Allow MKV fallback to preserve quality',
    encodingModeLabel: 'Encoding mode',
    encodingModeHint: 'Used only when MP4 re-encoding is needed.',
    encodingModeCpuQuality: 'CPU high quality',
    encodingModeGpuFast: 'GPU fast',
    encodingModeGpuQuality: 'GPU high quality',
    writeMetadataLabel: 'Save metadata JSON',
    writeThumbnailLabel: 'Save thumbnail',
    writeSubsLabel: 'Save subtitles if available',
    queueButton: 'Queue backup',
    queueKicker: 'Queue',
    jobsTitle: 'Backup jobs',
    emptyState: 'No jobs yet. Queue a link to start building your backup archive.',
    resolutionLabel: 'Resolution',
    containerLabel: 'Container',
    finalFileLabel: 'Final file',
    outputFolderLabel: 'Output folder',
    encodingTimeLabel: 'Encoding time',
    pending: 'Pending',
    retryButton: 'Retry',
    cancelButton: 'Cancel',
    chooseOutputDir: 'Choose an output folder before creating a backup job.',
    openOutputDirError: 'Choose an output folder before opening it.',
    backupQueued: 'Backup job queued.',
    downloadProgressLabel: 'Downloading',
    downloadCompleteLabel: 'Download complete',
    encodingStartLabel: 'Encoding starting',
    mergingProgressLabel: 'Finalizing download',
    transcodingProgressLabel: 'Encoding',
    progressEtaSuffix: 'left',
    status: {
      queued: 'Queued',
      inspecting: 'Inspecting',
      downloading: 'Downloading',
      merging: 'Merging',
      transcoding: 'Transcoding',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled'
    }
  },
  ko: {
    documentTitle: '유튜브 백업 데스크톱',
    heroEyebrow: '윈도우 백업 유틸리티',
    heroTitle: '영상 링크를 붙여 넣고 유튜브가 아직 제공하는 최고 품질로 저장하세요.',
    heroLede: '저장 폴더를 고른 뒤 작업을 추가하면, 앱이 가능한 최고 영상과 오디오 조합을 깔끔한 백업 파일로 저장합니다.',
    heroCardTitle: '사용 방법',
    heroPoint1: '브라우저에서 열 수 있는 영상 링크를 붙여 넣으세요',
    heroPoint2: '가능한 최고 영상과 오디오 조합으로 저장합니다',
    heroPoint3: '원할 때만 메타데이터, 썸네일, 자막을 함께 보관합니다',
    createKicker: '백업 작업 만들기',
    createTitle: '새 영상 백업',
    languageLabel: '언어',
    urlLabel: '유튜브 영상 URL',
    urlPlaceholder: 'https://www.youtube.com/watch?v=...',
    customTitleLabel: '저장 파일명',
    customTitlePlaceholder: '비워두면 원본 유튜브 제목을 사용합니다',
    outputDirLabel: '저장 폴더',
    browseButton: '찾아보기',
    openFolderButton: '폴더 열기',
    advancedSummary: '고급 옵션',
    allowMkvFallbackLabel: '화질 보존을 위해 MKV fallback 허용',
    encodingModeLabel: '인코딩 모드',
    encodingModeHint: 'MP4 재인코딩이 필요할 때만 적용됩니다.',
    encodingModeCpuQuality: 'CPU 고화질',
    encodingModeGpuFast: 'GPU 빠름',
    encodingModeGpuQuality: 'GPU 고화질',
    writeMetadataLabel: '메타데이터 JSON 저장',
    writeThumbnailLabel: '썸네일 저장',
    writeSubsLabel: '가능하면 자막 저장',
    queueButton: '백업 추가',
    queueKicker: '대기열',
    jobsTitle: '백업 작업',
    emptyState: '아직 작업이 없습니다. 링크를 추가해 백업을 시작하세요.',
    resolutionLabel: '해상도',
    containerLabel: '컨테이너',
    finalFileLabel: '최종 파일',
    outputFolderLabel: '저장 폴더',
    encodingTimeLabel: '인코딩 시간',
    pending: '대기 중',
    retryButton: '다시 시도',
    cancelButton: '취소',
    chooseOutputDir: '백업 작업을 만들기 전에 저장 폴더를 선택하세요.',
    openOutputDirError: '먼저 저장 폴더를 선택하세요.',
    backupQueued: '백업 작업이 추가되었습니다.',
    downloadProgressLabel: '다운로드',
    downloadCompleteLabel: '다운로드 완료',
    encodingStartLabel: '인코딩 시작',
    mergingProgressLabel: '다운로드 마무리 중',
    transcodingProgressLabel: '인코딩',
    progressEtaSuffix: '남음',
    status: {
      queued: '대기',
      inspecting: '확인 중',
      downloading: '다운로드 중',
      merging: '병합 중',
      transcoding: '인코딩 중',
      completed: '완료',
      failed: '실패',
      cancelled: '취소됨'
    }
  }
};

const els = {
  form: document.querySelector('#job-form'),
  pickDir: document.querySelector('#pickDir'),
  openDir: document.querySelector('#openDir'),
  language: document.querySelector('#language'),
  customTitle: document.querySelector('#customTitle'),
  outputDir: document.querySelector('#outputDir'),
  allowMkvFallback: document.querySelector('#allowMkvFallback'),
  encodingMode: document.querySelector('#encodingMode'),
  writeMetadata: document.querySelector('#writeMetadata'),
  writeThumbnail: document.querySelector('#writeThumbnail'),
  writeSubs: document.querySelector('#writeSubs'),
  formMessage: document.querySelector('#form-message'),
  jobs: document.querySelector('#jobs'),
  emptyState: document.querySelector('#empty-state'),
  jobTemplate: document.querySelector('#job-template')
};

function getCopy() {
  return COPY[state.language] || COPY.en;
}

function translateStatusLabel(value) {
  return getCopy().status[value] || value;
}

function applyLanguage(language) {
  state.language = language === 'ko' ? 'ko' : 'en';
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

  renderJobs();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatPercent(progress) {
  if (typeof progress !== 'number' || Number.isNaN(progress)) {
    return '0%';
  }

  return `${Math.max(0, Math.min(100, progress)).toFixed(1)}%`;
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

function formatProgressNote(job) {
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

    if (progress.speed) {
      parts.push(progress.speed);
    }

    return parts.join(' · ');
  }

  if (progress.phase === 'merging') {
    return `${copy.downloadCompleteLabel} · ${copy.mergingProgressLabel}`;
  }

  if (progress.phase !== 'transcoding') {
    return '';
  }

  const parts = [];
  if ((progress.percent || 0) <= 0) {
    parts.push(`${copy.downloadCompleteLabel} · ${copy.encodingStartLabel}`);
  } else {
    parts.push(`${copy.transcodingProgressLabel} ${formatPercent(progress.percent)}`);
  }

  if (progress.eta) {
    parts.push(`${progress.eta} ${copy.progressEtaSuffix}`);
  }

  if (progress.speed) {
    parts.push(progress.speed);
  }

  return parts.join(' · ');
}

function renderJobs() {
  els.jobs.innerHTML = '';
  els.emptyState.hidden = state.jobs.length > 0;

  state.jobs
    .slice()
    .reverse()
    .forEach((job) => {
      const fragment = els.jobTemplate.content.cloneNode(true);
      const status = fragment.querySelector('.job-status');
      const title = fragment.querySelector('.job-title');
      const progressBar = fragment.querySelector('.progress-bar');
      const progressNote = fragment.querySelector('.job-progress-note');
      const meta = fragment.querySelector('.job-meta');
      const warnings = fragment.querySelector('.warnings');
      const log = fragment.querySelector('.job-log');
      const actions = fragment.querySelector('.job-header-actions');
      const copy = getCopy();

      const statusLabel = translateStatusLabel(job.status);
      const phaseLabel = job.progress?.phase ? translateStatusLabel(job.progress.phase) : '';
      status.textContent = phaseLabel && phaseLabel !== statusLabel
        ? `${statusLabel} - ${phaseLabel}`
        : statusLabel;
      title.textContent = job.title || job.url;
      progressBar.style.inlineSize = formatPercent(job.progress?.percent);
      progressNote.textContent = formatProgressNote(job);
      progressNote.hidden = !progressNote.textContent;

      const metaRows = [
        [copy.resolutionLabel, job.result?.resolution || job.inspect?.bestResolution || copy.pending],
        [copy.containerLabel, job.result?.container || copy.pending],
        [copy.finalFileLabel, job.result?.finalPath || copy.pending],
        [copy.outputFolderLabel, job.outputDir]
      ];

      if (job.result?.wasTranscodedToMp4 && job.result?.transcodeDurationMs > 0) {
        metaRows.push([copy.encodingTimeLabel, formatDurationLabel(job.result.transcodeDurationMs)]);
      }

      meta.innerHTML = metaRows
        .map(([term, description]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(description)}</dd></div>`)
        .join('');

      warnings.innerHTML = (job.result?.warnings || job.error ? [job.error].filter(Boolean).concat(job.result?.warnings || []) : [])
        .map((warning) => `<li>${escapeHtml(warning)}</li>`)
        .join('');
      warnings.hidden = warnings.innerHTML.length === 0;

      log.textContent = (job.logs || []).slice(-14).join('\n');

      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'ghost';
        retryButton.textContent = copy.retryButton;
        retryButton.addEventListener('click', async () => {
          await window.youtubeBackupApp.retryJob(job.id);
        });
        actions.appendChild(retryButton);
      }

      if (job.status === 'queued' || job.status === 'inspecting' || job.status === 'downloading' || job.status === 'merging' || job.status === 'transcoding') {
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'ghost';
        cancelButton.textContent = copy.cancelButton;
        cancelButton.addEventListener('click', async () => {
          await window.youtubeBackupApp.cancelJob(job.id);
        });
        actions.appendChild(cancelButton);
      }

      els.jobs.appendChild(fragment);
    });
}

function applySettings(settings) {
  state.settings = settings;
  els.language.value = settings.language || 'en';
  applyLanguage(settings.language || 'en');
  els.outputDir.value = settings.outputDir || '';
  els.openDir.disabled = !els.outputDir.value.trim();
  els.allowMkvFallback.checked = settings.allowMkvFallback !== false;
  els.encodingMode.value = settings.encodingMode || 'gpu_fast';
  els.writeMetadata.checked = settings.writeMetadata !== false;
  els.writeThumbnail.checked = settings.writeThumbnail !== false;
  els.writeSubs.checked = settings.writeSubs !== false;
}

async function persistSettings() {
  const nextSettings = {
    language: els.language.value,
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

['change', 'input'].forEach((eventName) => {
  els.allowMkvFallback.addEventListener(eventName, persistSettings);
  els.encodingMode.addEventListener(eventName, persistSettings);
  els.writeMetadata.addEventListener(eventName, persistSettings);
  els.writeThumbnail.addEventListener(eventName, persistSettings);
  els.writeSubs.addEventListener(eventName, persistSettings);
});

els.language.addEventListener('change', async () => {
  applyLanguage(els.language.value);
  await window.youtubeBackupApp.setLanguage(els.language.value);
  await persistSettings();
});

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.formMessage.textContent = '';

  const payload = {
    url: els.form.url.value.trim(),
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
    els.outputDir.value = state.settings.outputDir || '';
    els.openDir.disabled = !els.outputDir.value.trim();
    els.allowMkvFallback.checked = state.settings.allowMkvFallback !== false;
    els.encodingMode.value = state.settings.encodingMode || 'gpu_fast';
    els.writeMetadata.checked = state.settings.writeMetadata !== false;
    els.writeThumbnail.checked = state.settings.writeThumbnail !== false;
    els.writeSubs.checked = state.settings.writeSubs !== false;
    els.formMessage.textContent = getCopy().backupQueued;
  } catch (error) {
    els.formMessage.textContent = error.message;
  }
});

window.youtubeBackupApp.onJobsUpdated((jobs) => {
  state.jobs = jobs;
  renderJobs();
});

async function boot() {
  const { settings, jobs } = await window.youtubeBackupApp.getInitialState();
  applySettings(settings);
  state.jobs = jobs;
  renderJobs();
}

boot().catch((error) => {
  els.formMessage.textContent = error.message;
});
