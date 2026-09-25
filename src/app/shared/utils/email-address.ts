const FREE_PROVIDERS = new Set(['gmail', 'googlemail', 'hotmail', 'outlook', 'live', 'yahoo', 'icloud', 'proton', 'protonmail']);

/** "Ana Torres <ana@novatech.com>" → "ana@novatech.com" */
export function senderEmail(from?: string | null): string {
  if (!from) {
    return '';
  }
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

/** "Ana Torres <ana@novatech.com>" → "Ana Torres" (o el email si no hay nombre). */
export function senderName(from?: string | null): string {
  if (!from) {
    return '';
  }
  const name = from.replace(/<[^>]*>/, '').replace(/"/g, '').trim();
  return name || senderEmail(from);
}

/** Respaldo cuando Gemini no informó empresa: dominio corporativo del remitente ("novatech.com" → "Novatech"). */
export function companyFromSender(from?: string | null): string | undefined {
  const domain = senderEmail(from).split('@')[1];
  const root = domain?.split('.')[0]?.toLowerCase();
  if (!root || FREE_PROVIDERS.has(root)) {
    return undefined;
  }
  return root.charAt(0).toUpperCase() + root.slice(1);
}
