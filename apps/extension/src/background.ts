/**
 * Service worker (Chrome) / script de fundo (Firefox). Não processa áudio nem
 * conteúdo: a captura acontece na página do Ouve, aberta pelo usuário.
 */
chrome.runtime.onInstalled.addListener(() => {
  console.info("Ouve instalado. A captura só começa por ação explícita do usuário.");
});
