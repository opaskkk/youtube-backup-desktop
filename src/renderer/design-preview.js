const root = document.documentElement;
const themeButtons = Array.from(document.querySelectorAll('[data-theme-mode]'));
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

let currentThemeMode = 'system';

function resolveTheme(themeMode) {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  return systemThemeQuery.matches ? 'dark' : 'light';
}

function applyTheme(themeMode) {
  currentThemeMode = ['light', 'dark', 'system'].includes(themeMode) ? themeMode : 'system';
  root.dataset.theme = resolveTheme(currentThemeMode);

  themeButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.themeMode === currentThemeMode);
  });
}

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyTheme(button.dataset.themeMode);
  });
});

if (typeof systemThemeQuery.addEventListener === 'function') {
  systemThemeQuery.addEventListener('change', () => {
    if (currentThemeMode === 'system') {
      applyTheme('system');
    }
  });
}

applyTheme('system');
