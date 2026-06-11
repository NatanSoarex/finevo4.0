// Filtro de validação de nomes de usuário
// - Bloqueia palavrões (PT-BR)
// - Bloqueia nomes que tentam se passar por sistema
// - Bloqueia padrões repetitivos / spam

// Lista resumida de palavras bloqueadas (pode ser expandida)
const BLOCKED_WORDS = [
  // Palavrões mais comuns em PT-BR
  "merda", "porra", "caralho", "buceta", "cu", "cuzao", "cuzão", "viado",
  "bicha", "puta", "putinha", "vagabunda", "filhodaputa", "filhadaputa", "fdp",
  "arrombado", "arrombada", "babaca", "otario", "otária", "imbecil",
  "retardado", "retardada", "boceta", "punheta", "rola", "pinto",
  // Termos ofensivos
  "nazi", "nazista", "hitler", "racista", "pedofilo", "pedófilo",
  // Spam / sistema
  "admin", "administrator", "moderator", "moderador", "suporte", "support",
  "system", "sistema", "official", "oficial", "staff", "owner", "root",
  "finevo", "fineevo", "developer", "dev", "test", "teste",
  "bot", "robo", "robô",
];

/**
 * Verifica se uma string contém alguma palavra proibida.
 * Comparação case-insensitive, ignora acentos e separadores comuns.
 */
export function containsBlockedWord(text: string): string | null {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]/g, ""); // remove separadores e símbolos

  for (const word of BLOCKED_WORDS) {
    const wn = word
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (normalized.includes(wn)) return word;
  }
  return null;
}

/**
 * Detecta padrões claramente repetitivos (spam) tipo "aaaaaa", "123123123".
 */
export function isSpammy(text: string): boolean {
  // 4+ caracteres iguais seguidos
  if (/(.)\1{3,}/.test(text)) return true;
  // Padrão de 2-3 chars que se repete 3+ vezes consecutivas
  if (/(.{2,3})\1{2,}/.test(text)) return true;
  // Só dígitos
  if (/^\d+$/.test(text)) return true;
  return false;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Valida um nome de usuário (regras de formato + conteúdo).
 */
export function validateUsername(username: string): ValidationResult {
  const u = username.trim();
  if (u.length < 3) return { ok: false, error: "Mínimo 3 caracteres" };
  if (u.length > 20) return { ok: false, error: "Máximo 20 caracteres" };
  if (!/^[a-zA-Z0-9_.]+$/.test(u)) {
    return { ok: false, error: "Use só letras, números, ponto e underline" };
  }
  if (/^[._]/.test(u) || /[._]$/.test(u)) {
    return { ok: false, error: "Não pode começar ou terminar com . ou _" };
  }
  if (/[._]{2,}/.test(u)) {
    return { ok: false, error: "Não pode ter . ou _ repetidos" };
  }
  if (isSpammy(u)) {
    return { ok: false, error: "Esse nome parece spam, tente outro" };
  }
  const blocked = containsBlockedWord(u);
  if (blocked) {
    return { ok: false, error: "Esse nome não é permitido" };
  }
  return { ok: true };
}

// === LISTA DE DOMÍNIOS DE E-MAIL DESCARTÁVEIS / FAKE ===
// Bloqueia provedores conhecidos de e-mail temporário/descartável.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // Provedores de e-mail descartável mais conhecidos
  "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net",
  "10minutemail.com", "10minutemail.net", "10minemail.com",
  "mailinator.com", "mailinator.net", "mailinator.org",
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "guerrillamailblock.com",
  "sharklasers.com", "grr.la", "guerrillamail.info",
  "throwawaymail.com", "throwawaymail.net",
  "yopmail.com", "yopmail.fr", "yopmail.net",
  "trashmail.com", "trashmail.net", "trashmail.io", "trashmail.de",
  "getairmail.com", "airmail.cc",
  "fakeinbox.com", "fakemail.net", "fakemailgenerator.com",
  "maildrop.cc", "harakirimail.com",
  "dispostable.com", "discard.email",
  "mintemail.com", "mt2014.com", "mytemp.email",
  "spamgourmet.com", "spam4.me", "spambox.us",
  "mohmal.com", "mohmal.in",
  "tempinbox.com", "tempmailaddress.com",
  "burnermail.io", "emailondeck.com",
  "anonbox.net", "anonymbox.com",
  "wegwerfemail.de", "wegwerfmail.de",
  "tempr.email", "discardmail.com",
  "mailcatch.com", "mailnesia.com", "mailtemp.info",
  "mvrht.com", "nada.email", "nwldx.com",
  "incognitomail.com", "incognitomail.org",
  "tempemail.com", "tempemail.net", "tempemail.org",
  "tmpmail.org", "tmpeml.com", "tmpbox.net",
  "trbvm.com", "trash-mail.com",
  "yopmail.org", "spamfree24.org",
  "minuteinbox.com", "luxusmail.org",
  "byom.de", "deadaddress.com",
  "instant-mail.de", "kurzepost.de",
  "0wnd.org", "0wnd.net",
  // Domínios suspeitos / só para testes
  "example.com", "example.org", "example.net",
  "test.com", "test.test", "teste.com",
  "fake.com", "fake.fake",
  "invalid.com", "noemail.com", "none.com",
  "asdf.com", "asd.com", "abc.com", "qwerty.com",
  "mail.com", // genérico demais, comum em fakes
]);

// Provedores legítimos conhecidos (permite domínios menos comuns)
const TRUSTED_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "outlook.com.br", "hotmail.com", "hotmail.com.br", "live.com", "msn.com",
  "yahoo.com", "yahoo.com.br", "ymail.com",
  "icloud.com", "me.com", "mac.com",
  "uol.com.br", "bol.com.br",
  "terra.com.br",
  "globo.com",
  "ig.com.br",
  "protonmail.com", "proton.me", "pm.me",
  "zoho.com", "zohomail.com",
  "yandex.com", "yandex.ru",
  "fastmail.com",
  "tutanota.com", "tuta.io",
  "aol.com",
  "gmx.com", "gmx.net",
]);

/**
 * Detecta padrões "automáticos" típicos de geradores de e-mail fake.
 * Ex: "abcdef1234@", "asdjkl@", "user1234@", "xkcdjwe@"
 */
function looksLikeGenerated(local: string): boolean {
  // 10+ caracteres aleatórios sem nenhuma vogal — improvável em nome real
  if (local.length >= 10 && !/[aeiouAEIOU]/.test(local)) return true;
  // Sequências longas de consoantes (8+) — ex: "qwrtypsdfg"
  if (/[bcdfghjklmnpqrstvwxyz]{8,}/i.test(local)) return true;
  // 4+ caracteres iguais consecutivos
  if (/(.)\1{3,}/.test(local)) return true;
  // Padrão tipo "qwerty", "asdf", "1234" repetidos
  if (/(qwerty|asdf|zxcv|1234|abcd){2,}/i.test(local)) return true;
  return false;
}

/**
 * Valida e-mail (formato + detecção anti-fake).
 */
export function validateEmail(email: string): ValidationResult {
  const e = email.trim().toLowerCase();
  if (!e) return { ok: false, error: "E-mail obrigatório" };
  if (e.length > 100) return { ok: false, error: "E-mail muito longo" };

  // Formato RFC 5322 simplificada
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
    return { ok: false, error: "E-mail inválido" };
  }

  const [local, domain] = e.split("@");
  if (!local || !domain) {
    return { ok: false, error: "E-mail inválido" };
  }

  // Validação de parte local
  if (local.length < 3) {
    return { ok: false, error: "Parte do nome do e-mail muito curta" };
  }
  if (local.length > 64) {
    return { ok: false, error: "E-mail inválido" };
  }
  // Local não pode começar/terminar com ponto
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return { ok: false, error: "E-mail inválido" };
  }
  // Detecta nome local gerado automaticamente
  if (looksLikeGenerated(local)) {
    return { ok: false, error: "Use um e-mail real" };
  }

  // Validação de domínio
  if (domain.length < 4) {
    return { ok: false, error: "Domínio inválido" };
  }
  // Bloqueia descartáveis
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { ok: false, error: "E-mails temporários não são permitidos" };
  }
  // Bloqueia subdomínios de descartáveis (ex: foo.mailinator.com)
  for (const disposable of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith("." + disposable)) {
      return { ok: false, error: "E-mails temporários não são permitidos" };
    }
  }
  // Domínio precisa ter TLD válido (mínimo 2 chars depois do ponto)
  const parts = domain.split(".");
  const tld = parts[parts.length - 1];
  if (tld.length < 2 || tld.length > 10) {
    return { ok: false, error: "Domínio inválido" };
  }
  // Domínio não pode ter caracteres absurdos
  if (!/^[a-z0-9.-]+$/.test(domain)) {
    return { ok: false, error: "Domínio inválido" };
  }
  // Domínio não pode ser só números (ex: "123456.com")
  const domainName = parts.slice(0, -1).join(".");
  if (/^\d+$/.test(domainName)) {
    return { ok: false, error: "Domínio inválido" };
  }

  // Se é domínio confiável, libera direto
  if (TRUSTED_DOMAINS.has(domain)) {
    return { ok: true };
  }

  // Se não é confiável nem descartável, faz checagens extras:
  // - Domínio precisa ter pelo menos 2 letras antes do TLD (ex: "ab.com" ok)
  if (domainName.length < 2) {
    return { ok: false, error: "Domínio inválido" };
  }

  return { ok: true };
}

/**
 * Valida senha — mínimo 6 caracteres, pelo menos 1 letra e 1 número.
 */
export function validatePassword(password: string): ValidationResult {
  if (password.length < 6) return { ok: false, error: "Mínimo 6 caracteres" };
  if (password.length > 100) return { ok: false, error: "Senha muito longa" };
  if (!/[a-zA-Z]/.test(password)) return { ok: false, error: "Inclua pelo menos 1 letra" };
  if (!/\d/.test(password)) return { ok: false, error: "Inclua pelo menos 1 número" };
  return { ok: true };
}
