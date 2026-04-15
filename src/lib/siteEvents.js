export const CS_DIGEST_RELOAD = 'cs-digest-reload'

export function dispatchDigestReload() {
  window.dispatchEvent(new CustomEvent(CS_DIGEST_RELOAD))
}
