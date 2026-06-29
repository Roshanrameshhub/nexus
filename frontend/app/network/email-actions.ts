export function buildGmailComposeUrl(email: string): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: email,
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}

export function openGmailCompose(email: string): void {
  const url = buildGmailComposeUrl(email)
  window.open(url, '_blank', 'noopener,noreferrer')
}
