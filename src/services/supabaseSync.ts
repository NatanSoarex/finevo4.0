import { supabase } from "./supabaseClient";
import { safeStorage } from "./safeStorage";
import { getCachedQuotes } from "./marketApi";

// Keys used in local safeStorage
const PROFILE_KEY = "finevo:profile";
const PORTFOLIO_KEY = "finevo:portfolio";
const TRANSACTIONS_KEY = "finevo:transactions";
const CHALLENGES_KEY = "finevo:challenges";
const XP_KEY = "finevo:xp-events";

// Global listeners registry to notify services when database data is pulled
const syncListeners = new Set<() => void>();

export interface SyncStatus {
  lastPushSuccess: boolean | null;
  lastPullSuccess: boolean | null;
  lastPushError: string | null;
  lastPullError: string | null;
  lastSyncTime: number | null;
}

export let globalSyncStatus: SyncStatus = {
  lastPushSuccess: null,
  lastPullSuccess: null,
  lastPushError: null,
  lastPullError: null,
  lastSyncTime: null,
};

export function getGlobalSyncStatus(): SyncStatus {
  return globalSyncStatus;
}

export function registerSyncListener(fn: () => void) {
  syncListeners.add(fn);
  return () => {
    syncListeners.delete(fn);
  };
}

export function notifySyncListeners() {
  syncListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error("Error in sync listener:", e);
    }
  });
}

/**
 * Synchronous helper to get the current logged-in/bypassed user ID.
 */
export function getLocalUserId(): string | null {
  try {
    const raw = safeStorage.getItem("finevo:session");
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.userId || null;
  } catch {
    return null;
  }
}

/**
 * Saves a local backup archive for the current user to ensure zero data loss across logouts.
 */
export function archiveUserDataLocally(userId: string) {
  if (!userId) return;
  try {
    const archiveRaw = (typeof localStorage !== "undefined" ? localStorage.getItem("finevo:permanent_archives") : null) || "{}";
    const archives = JSON.parse(archiveRaw);

    const profile = safeStorage.getItem(PROFILE_KEY);
    const portfolio = safeStorage.getItem(PORTFOLIO_KEY);
    const transactions = safeStorage.getItem(TRANSACTIONS_KEY);
    const challenges = safeStorage.getItem(CHALLENGES_KEY);
    const xpEvents = safeStorage.getItem(XP_KEY);

    archives[userId] = {
      profile: profile ? JSON.parse(profile) : null,
      portfolio: portfolio ? JSON.parse(portfolio) : null,
      transactions: transactions ? JSON.parse(transactions) : null,
      challenges: challenges ? JSON.parse(challenges) : null,
      xpEvents: xpEvents ? JSON.parse(xpEvents) : null,
      updatedAt: Date.now()
    };

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("finevo:permanent_archives", JSON.stringify(archives));
    }
  } catch (e) {
    console.error("Failed to save local user archive:", e);
  }
}

/**
 * Restores user data from the local permanent archive for the given userId.
 * Run this on login or session activation before pulling from Supabase, or as a robust fallback.
 */
export function restoreUserDataFromLocalArchive(userId: string): boolean {
  if (!userId) return false;
  try {
    if (typeof localStorage === "undefined") return false;
    const archiveRaw = localStorage.getItem("finevo:permanent_archives");
    if (!archiveRaw) return false;

    const archives = JSON.parse(archiveRaw);
    const userArchive = archives[userId];
    if (!userArchive) return false;

    console.log(`[Archive] Restoring data from local permanent archive for user: ${userId}`);

    if (userArchive.profile) {
      safeStorage.setItem(PROFILE_KEY, JSON.stringify(userArchive.profile));
    }
    if (userArchive.portfolio) {
      safeStorage.setItem(PORTFOLIO_KEY, JSON.stringify(userArchive.portfolio));
    }
    if (userArchive.transactions) {
      safeStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(userArchive.transactions));
    }
    if (userArchive.challenges) {
      safeStorage.setItem(CHALLENGES_KEY, JSON.stringify(userArchive.challenges));
    }
    if (userArchive.xpEvents) {
      safeStorage.setItem(XP_KEY, JSON.stringify(userArchive.xpEvents));
    }

    notifySyncListeners();
    return true;
  } catch (e) {
    console.error("Failed to restore user data from local archive:", e);
    return false;
  }
}

/**
 * Migrates any unscoped offline data (anonymous progress) to the brand new user ID.
 */
export function migrateUnscopedUserData(newUserId: string) {
  if (!newUserId) return;
  try {
    if (typeof localStorage === "undefined") return;

    // Unscoped keys
    const rawProfile = localStorage.getItem(PROFILE_KEY);
    const rawPortfolio = localStorage.getItem(PORTFOLIO_KEY);
    const rawTransactions = localStorage.getItem(TRANSACTIONS_KEY);
    const rawChallenges = localStorage.getItem(CHALLENGES_KEY);
    const rawXpEvents = localStorage.getItem(XP_KEY);

    // Scoped destinations - copy raw values directly using primitive localStorage
    if (rawProfile) {
      localStorage.setItem(`${PROFILE_KEY}:${newUserId}`, rawProfile);
    }
    if (rawPortfolio) {
      localStorage.setItem(`${PORTFOLIO_KEY}:${newUserId}`, rawPortfolio);
    }
    if (rawTransactions) {
      localStorage.setItem(`${TRANSACTIONS_KEY}:${newUserId}`, rawTransactions);
    }
    if (rawChallenges) {
      localStorage.setItem(`${CHALLENGES_KEY}:${newUserId}`, rawChallenges);
    }
    if (rawXpEvents) {
      localStorage.setItem(`${XP_KEY}:${newUserId}`, rawXpEvents);
    }

    console.log(`[Archive] Successfully migrated unscoped offline progress to user: ${newUserId}`);
    // Save to permanent archive right away so it is sealed securely
    archiveUserDataLocally(newUserId);
  } catch (e) {
    console.error("Failed to migrate unscoped offline progress:", e);
  }
}

/**
 * Pushes the complete local profile state to the Supabase "profile" table.
 */
export async function pushProfileToSupabase() {
  const localUserId = getLocalUserId();
  if (localUserId) {
    archiveUserDataLocally(localUserId);
  }

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) return;

  const userId = session.user.id;
  const email = session.user.email || "";

  // Get current local profile data
  let localProfile = { name: "Usuário", bio: "", photo: null, banner: "emerald" };
  try {
    const raw = safeStorage.getItem(PROFILE_KEY);
    if (raw) localProfile = { ...localProfile, ...JSON.parse(raw) };
  } catch (e) {
    console.error("Error loading local profile for sync:", e);
  }

  // Get level, xp, and streak calculated from local events
  let xpEvents: any[] = [];
  try {
    const raw = safeStorage.getItem(XP_KEY);
    if (raw) xpEvents = JSON.parse(raw);
  } catch (e) {
    console.error("Error loading xp-events for profile sync:", e);
  }

  const xpTotal = Array.isArray(xpEvents) ? xpEvents.reduce((s, e) => s + (e.amount || 0), 0) : 0;

  // Calculate Level dynamically from XP
  let level = 1;
  while (true) {
    const n = level; // next level - 1
    const reqXp = 45 * n * n + 100 * n;
    if (reqXp <= xpTotal) {
      level++;
      if (level > 100) break;
    } else {
      break;
    }
  }

  // Calculate Streak dynamically
  let streak = 0;
  if (Array.isArray(xpEvents) && xpEvents.length > 0) {
    const datesWithXp = new Set(xpEvents.map((e) => e.date));
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    const startISO = datesWithXp.has(todayISO) ? todayISO : yesterdayISO;
    const hasActiveStreak = datesWithXp.has(todayISO) || datesWithXp.has(yesterdayISO);

    if (hasActiveStreak) {
      const baseDate = datesWithXp.has(todayISO) ? new Date() : yesterday;
      for (let i = 0; i < 365; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (datesWithXp.has(key)) {
          streak++;
        } else {
          break;
        }
      }
    }
  }

  // Assemble full backup payload of all key tables in the master envelope!
  let backupPortfolio: any[] = [];
  let backupTransactions: any[] = [];
  let backupChallenges: any[] = [];
  try {
    const rawPort = safeStorage.getItem(PORTFOLIO_KEY);
    if (rawPort) backupPortfolio = JSON.parse(rawPort);
    const rawTxs = safeStorage.getItem(TRANSACTIONS_KEY);
    if (rawTxs) backupTransactions = JSON.parse(rawTxs);
    const rawCh = safeStorage.getItem(CHALLENGES_KEY);
    if (rawCh) backupChallenges = JSON.parse(rawCh);
  } catch (e) {
    console.error("Error gathering backup data for envelope:", e);
  }

  const envelope = {
    isEnvelope: true,
    xpEvents: xpEvents,
    backup: {
      profile: localProfile,
      portfolio: backupPortfolio,
      transactions: backupTransactions,
      challenges: backupChallenges
    }
  };

  // Remove o padrão [pw:...] do bio caso esteja guardado localmente para o login offline bypass do usuário (segurança)
  let cloudBio = localProfile.bio || "";
  if (cloudBio.includes("[pw:")) {
    cloudBio = cloudBio.replace(/\[pw:.*?\]/g, "").trim();
  }

  const payload = {
    id: userId,
    email,
    nome: (!localProfile.name || localProfile.name === "Usuário") ? (session.user.user_metadata?.username || "Usuário") : localProfile.name,
    foto_perfil: localProfile.photo,
    banner_perfil: localProfile.banner,
    bio: cloudBio,
    nivel: level,
    xp: xpTotal,
    streak: streak,
    xp_events_json: JSON.stringify(envelope),
    criado_em: new Date().toISOString(),
  };

  const { error } = await supabase.from("profile").upsert(payload);
  if (error) {
    console.error("Error upserting profile inside Supabase:", error);
    globalSyncStatus.lastPushSuccess = false;
    globalSyncStatus.lastPushError = error.message;
    notifySyncListeners();
    throw error;
  } else {
    globalSyncStatus.lastPushSuccess = true;
    globalSyncStatus.lastPushError = null;
    globalSyncStatus.lastSyncTime = Date.now();
    notifySyncListeners();
    // Sincroniza também as conquistas obtidas baseadas nos novos dados
    if (!isBulkSyncing) {
      await pushAchievementsToSupabase();
    }
  }
}

/**
 * Pushes portfolio positions to the Supabase "carteira" table.
 */
export async function pushPortfolioToSupabase() {
  const localUserId = getLocalUserId();
  if (localUserId) {
    archiveUserDataLocally(localUserId);
  }

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) return;

  const userId = session.user.id;
  let positions: any[] = [];
  try {
    const raw = safeStorage.getItem(PORTFOLIO_KEY);
    if (raw) positions = JSON.parse(raw);
  } catch (e) {
    console.error("Error loading portfolio for sync:", e);
  }

  try {
    const localIds = positions.map((p) => p.id);
    if (localIds.length > 0) {
      // Safe Delete only: prune orphaned entries, don't touch still-existing positions
      const { error: deleteError } = await supabase
        .from("carteira")
        .delete()
        .eq("user_id", userId)
        .not("id", "in", `(${localIds.join(",")})`);
      if (deleteError) {
        console.error("Error cleaning orphaned portfolio items on Supabase:", deleteError);
        throw deleteError;
      }
    } else {
      const { error: deleteError } = await supabase.from("carteira").delete().eq("user_id", userId);
      if (deleteError) {
        console.error("Error cleaning all portfolio items on Supabase:", deleteError);
        throw deleteError;
      }
    }

    if (positions.length > 0) {
      const quotes = getCachedQuotes();
      const payload = positions.map((p) => {
        const price = quotes[p.ticker]?.price ?? p.purchasePrice;
        const valor_atual = Math.round(price * p.quantity * 100) / 100;
        const lucro_prejuizo = Math.round((valor_atual - p.invested) * 100) / 100;
        const percentual = p.invested > 0 ? Math.round((lucro_prejuizo / p.invested) * 10000) / 100 : 0;

        return {
          id: p.id,
          user_id: userId,
          ticker: p.ticker,
          nome_ativo: p.name,
          quantidade_total: p.quantity,
          preco_medio: p.purchasePrice,
          valor_investido_total: p.invested,
          valor_atual,
          lucro_prejuizo,
          percentual,
          asset_type: p.type,
          logo: p.logo,
          purchase_date: p.purchaseDate,
          atualizado_em: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
        };
      });

      const { error: upsertError } = await supabase.from("carteira").upsert(payload, { onConflict: "id" });
      if (upsertError) {
        console.error("Error upserting portfolio on Supabase:", upsertError);
        throw upsertError;
      }
    }
  } catch (err: any) {
    console.warn("[Sync Warning] Falha ao sincronizar tabela 'carteira' de forma granular:", err);
    console.log("[Sync Info] Fallback ativo: Os dados de carteira estão salvos com segurança no envelope mestre do Profile.");
  }

  // Updates overall patrimonial snapshots after portfolio modifications
  try {
    await pushHistoricoPatrimonialToSupabase();
  } catch (e) {
    console.log("Error updating patrimonial snapshots", e);
  }

  // Sempre força atualização do master backup envelope no Profile
  if (!isBulkSyncing) {
    try {
      await pushProfileToSupabase();
    } catch (e) {
      console.warn("Erro ao registrar master envelope no carteira sync:", e);
    }
  }
}

/**
 * Pushes transaction logs/history to the Supabase "aportes" table.
 */
export async function pushTransactionsToSupabase() {
  const localUserId = getLocalUserId();
  if (localUserId) {
    archiveUserDataLocally(localUserId);
  }

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) return;

  const userId = session.user.id;
  let txs: any[] = [];
  try {
    const raw = safeStorage.getItem(TRANSACTIONS_KEY);
    if (raw) txs = JSON.parse(raw);
  } catch (e) {
    console.error("Error loading transactions for sync:", e);
  }

  try {
    const localIds = txs.map((t) => t.id);
    if (localIds.length > 0) {
      // Safe Delete only: prune orphaned entries, don't touch still-existing transactions
      const { error: deleteError } = await supabase
        .from("aportes")
        .delete()
        .eq("user_id", userId)
        .not("id", "in", `(${localIds.join(",")})`);
      if (deleteError) {
        console.error("Error cleaning orphaned transactions on Supabase:", deleteError);
        throw deleteError;
      }
    } else {
      const { error: deleteError } = await supabase.from("aportes").delete().eq("user_id", userId);
      if (deleteError) {
        console.error("Error cleaning all transactions on Supabase:", deleteError);
        throw deleteError;
      }
    }

    if (txs.length > 0) {
      const payload = txs.map((t) => ({
        id: t.id,
        user_id: userId,
        ticker: t.ticker,
        nome_ativo: t.assetName,
        quantidade: t.quantity,
        preco_medio: t.unitPrice,
        valor_investido: t.total,
        data_compra: t.date,
        kind: t.kind,
        asset_type: t.assetType,
        asset_logo: t.assetLogo,
        ts: t.ts,
        note: t.note || null,
        criado_em: new Date(t.ts).toISOString(),
      }));

      const { error: upsertError } = await supabase.from("aportes").upsert(payload, { onConflict: "id" });
      if (upsertError) {
        console.error("Error upserting transactions on Supabase:", upsertError);
        throw upsertError;
      }
    }
  } catch (err: any) {
    console.warn("[Sync Warning] Falha ao sincronizar tabela 'aportes' de forma granular:", err);
    console.log("[Sync Info] Fallback ativo: Transasções estão salvas com segurança no envelope mestre do Profile.");
  }

  // Sempre força atualização do master backup envelope no Profile
  try {
    await pushProfileToSupabase();
  } catch (e) {
    console.warn("Erro ao registrar master envelope no aportes sync:", e);
  }
}

/**
 * Pushes challenges progress to the Supabase "desafios" table.
 */
export async function pushChallengesToSupabase() {
  const localUserId = getLocalUserId();
  if (localUserId) {
    archiveUserDataLocally(localUserId);
  }

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) return;

  const userId = session.user.id;
  let challenges: any[] = [];
  try {
    const raw = safeStorage.getItem(CHALLENGES_KEY);
    if (raw) challenges = JSON.parse(raw);
  } catch (e) {
    console.error("Error loading challenges for sync:", e);
  }

  try {
    const localIds = challenges.map((ch) => ch.id);
    if (localIds.length > 0) {
      // Safe Delete only: prune orphaned entries, don't touch still-existing challenges
      const { error: deleteError } = await supabase
        .from("desafios")
        .delete()
        .eq("user_id", userId)
        .not("id", "in", `(${localIds.join(",")})`);
      if (deleteError) {
        console.error("Error cleaning orphaned challenges on Supabase:", deleteError);
        throw deleteError;
      }
    } else {
      const { error: deleteError } = await supabase.from("desafios").delete().eq("user_id", userId);
      if (deleteError) {
        console.error("Error cleaning all challenges on Supabase:", deleteError);
        throw deleteError;
      }
    }

    if (challenges.length > 0) {
      const payload = challenges.map((ch) => ({
        id: ch.id,
        user_id: userId,
        titulo: ch.title,
        desc_detalhada: ch.desc,
        reward_xp: ch.rewardXp,
        frequency: ch.frequency,
        target_val: ch.target,
        current_val: ch.current,
        last_checkin_date: ch.lastCheckinDate,
        last_checkin_ts: ch.lastCheckinTs,
        evolution_stage: ch.evolutionStage,
        reset_on_miss: ch.resetOnMiss,
        icon_key: ch.iconKey,
        active: ch.active,
        progresso: ch.current,
        concluido: ch.current >= ch.target,
        criado_em: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabase.from("desafios").upsert(payload, { onConflict: "id" });
      if (upsertError) {
        console.error("Error upserting challenges on Supabase:", upsertError);
        throw upsertError;
      }
    }
  } catch (err: any) {
    console.warn("[Sync Warning] Falha ao sincronizar tabela 'desafios' de forma granular:", err);
    console.log("[Sync Info] Fallback ativo: Progresso dos desafios está salvo com segurança no envelope mestre do Profile.");
  }

  // Sempre força atualização do master backup envelope no Profile
  if (!isBulkSyncing) {
    try {
      await pushProfileToSupabase();
    } catch (e) {
      console.warn("Erro ao registrar master envelope no desafios sync:", e);
    }
  }
}

/**
 * Sweeps current dynamic achievements and pushes newly acquired achievements to the Supabase "conquistas" table.
 */
export async function pushAchievementsToSupabase() {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) return;

  const userId = session.user.id;

  // Let's dynamically load and check ACHIEVEMENTS from achievements.ts (to avoid circular dependency, we compute it directly or import it)
  // To keep it simple, we check achievements.ts export or do a clean import
  try {
    const { ACHIEVEMENTS } = await import("./achievements");
    const unlockedList = ACHIEVEMENTS.filter((a) => {
      try {
        return a.check().done;
      } catch {
        return false;
      }
    });

    if (unlockedList.length > 0) {
      const payload = unlockedList.map((a) => ({
        id: a.id,
        user_id: userId,
        titulo: a.name,
        descricao: a.desc,
        desbloqueada_em: new Date().toISOString(),
      }));

      const { error } = await supabase.from("conquistas").upsert(payload, { onConflict: "id,user_id" });
      if (error) {
        console.error("Error upserting achievements on Supabase:", error);
      }
    }
  } catch (e) {
    console.error("Error computing dynamic achievements for sync:", e);
  }
}

/**
 * Pushes historical wealth snapshots for today to the Supabase "historico_patrimonial" table.
 */
export async function pushHistoricoPatrimonialToSupabase() {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) return;

  const userId = session.user.id;

  let positions: any[] = [];
  try {
    const raw = safeStorage.getItem(PORTFOLIO_KEY);
    if (raw) positions = JSON.parse(raw);
  } catch (e) {
    console.error("Error loading portfolio for history snapshot:", e);
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const quotes = getCachedQuotes();
  let patrimonioTotal = 0;
  for (const p of positions) {
    const q = quotes[p.ticker];
    const price = q?.price ?? p.purchasePrice;
    patrimonioTotal += price * p.quantity;
  }
  patrimonioTotal = Math.round(patrimonioTotal * 100) / 100;
  const valorInvestido = Math.round(positions.reduce((sum, p) => sum + (p.invested || 0), 0) * 100) / 100;
  const lucroPrejuizo = Math.round((patrimonioTotal - valorInvestido) * 100) / 100;

  const payload = {
    id: `hist_${userId}_${dateStr}`,
    user_id: userId,
    data: dateStr,
    patrimonio_total: patrimonioTotal,
    valor_investido: valorInvestido,
    lucro_prejuizo: lucroPrejuizo,
  };

  const { error } = await supabase.from("historico_patrimonial").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("Error upserting historico_patrimonial on Supabase:", error);
  }
}

let activePullPromise: Promise<boolean> | null = null;
let activePullUserId: string | null = null;
let isBulkSyncing = false;

/**
 * PULLS all user data (profile, portfolio, transactions, challenges, history) from Supabase and overwrites localStorage.
 * Triggers re-render for all re-active hooks/tabs in the system.
 */
export async function pullAllDataFromSupabase(userId: string): Promise<boolean> {
  if (activePullPromise && activePullUserId === userId) {
    console.log("[Sync] Pull already in progress for this user, reusing active pull promise.");
    return activePullPromise;
  }

  activePullUserId = userId;
  activePullPromise = (async () => {
    try {
      // Read current local state (from permanent local archive restored right before this call)
      let localProfile: any = null;
      let localPositions: any[] = [];
      let localTxs: any[] = [];
      let localChallenges: any[] = [];
      let localXp: any[] = [];

      try {
        const rawProf = safeStorage.getItem(PROFILE_KEY);
        if (rawProf) localProfile = JSON.parse(rawProf);

        const rawPort = safeStorage.getItem(PORTFOLIO_KEY);
        if (rawPort) localPositions = JSON.parse(rawPort);

        const rawTxs = safeStorage.getItem(TRANSACTIONS_KEY);
        if (rawTxs) localTxs = JSON.parse(rawTxs);

        const rawCh = safeStorage.getItem(CHALLENGES_KEY);
        if (rawCh) localChallenges = JSON.parse(rawCh);

        const rawXp = safeStorage.getItem(XP_KEY);
        if (rawXp) localXp = JSON.parse(rawXp);
      } catch (e) {
        console.warn("[Sync Merger] Erro ao carregar cache local para merge offline-first:", e);
      }

      // Fetch all tables concurrently to minimize network latency and improve rendering performance!
      const [profileRes, portfolioRes, transactionsRes, desafiosRes] = await Promise.all([
        supabase.from("profile").select("*").eq("id", userId).maybeSingle(),
        supabase.from("carteira").select("*").eq("user_id", userId),
        supabase.from("aportes").select("*").eq("user_id", userId),
        supabase.from("desafios").select("*").eq("user_id", userId)
      ]);

      const { data: profileData, error: profileErr } = profileRes;
      const { data: portfolioData, error: portfolioErr } = portfolioRes;
      const { data: transactionsData, error: transactionsErr } = transactionsRes;
      const { data: desafiosData, error: desafiosErr } = desafiosRes;

      // Log the actual table errors in the console but do NOT let them flag a failure if we have a successful profile pull!
      if (portfolioErr) console.warn("[Sync] Portfolio select omitted or blocked (RLS active):", portfolioErr);
      if (transactionsErr) console.warn("[Sync] Transactions select omitted or blocked (RLS active):", transactionsErr);
      if (desafiosErr) console.warn("[Sync] Challenges select omitted or blocked (RLS active):", desafiosErr);

      if (profileErr) {
        globalSyncStatus.lastPullSuccess = false;
        globalSyncStatus.lastPullError = profileErr.message;
        console.error("[Sync Merger] Erro crítico ao buscar perfil na nuvem:", profileErr);
      } else {
        globalSyncStatus.lastPullSuccess = true;
        globalSyncStatus.lastPullError = null;
        globalSyncStatus.lastSyncTime = Date.now();
      }

      let shouldPushSyncBack = false;

      // Parse backup master envelope from profile column if it exists!
      let cloudXpList: any[] = [];
      let envelopeBackup: any = null;

      if (profileData?.xp_events_json) {
        try {
          const parsed = JSON.parse(profileData.xp_events_json);
          if (parsed && typeof parsed === "object" && parsed.isEnvelope) {
            cloudXpList = parsed.xpEvents || [];
            envelopeBackup = parsed.backup || null;
            console.log("[Sync-Envelope] Master fallback cloud backup located under profile!", envelopeBackup);
          } else if (Array.isArray(parsed)) {
            cloudXpList = parsed;
          }
        } catch (e) {
          console.error("[Sync-Envelope] Failed to parse xp_events_json:", e);
        }
      }

      // 1. Restore/Merge Profile Table
      if (profileErr) {
        console.error("Error downloading profile from Supabase:", profileErr);
      } else {
        let dbProfileLastUpdate = 0;
        if (profileData?.xp_events_json) {
          try {
            const envelope = JSON.parse(profileData.xp_events_json);
            dbProfileLastUpdate = envelope?.backup?.profile?.updatedAt || 0;
          } catch {
            /* noop */
          }
        }

        const dbProfile = profileData ? {
          name: profileData.nome || "Novo usuário",
          bio: profileData.bio || "",
          photo: profileData.foto_perfil || null,
          banner: profileData.banner_perfil || "emerald",
          updatedAt: dbProfileLastUpdate,
        } : (envelopeBackup?.profile || null);

        // Last-Write-Wins (LWW) merge for profile details
        if (dbProfile) {
          const localTime = localProfile?.updatedAt || 0;
          const cloudTime = dbProfile.updatedAt || 0;

          if (cloudTime >= localTime) {
            const mergedProfile = {
              name: dbProfile.name || localProfile?.name || "Novo usuário",
              bio: dbProfile.bio || localProfile?.bio || "",
              photo: dbProfile.photo || localProfile?.photo || null,
              banner: dbProfile.banner || localProfile?.banner || "emerald",
              updatedAt: dbProfile.updatedAt || Date.now(),
            };
            safeStorage.setItem(PROFILE_KEY, JSON.stringify(mergedProfile));
          } else {
            // Local is newer, keep local and mark to push back to cloud
            safeStorage.setItem(PROFILE_KEY, JSON.stringify(localProfile));
            shouldPushSyncBack = true;
          }
        } else if (localProfile) {
          safeStorage.setItem(PROFILE_KEY, JSON.stringify(localProfile));
          shouldPushSyncBack = true;
        }

        // Restore/Merge XP Events logs
        if (cloudXpList.length > 0 || localXp.length > 0) {
          const mergedXpSet = new Set<string>();
          const finalXp: any[] = [];
          const addXpItem = (item: any) => {
            if (!item) return;
            const key = `${item.date || ""}_${item.amount || 0}_${item.activity || item.descricao || ""}`;
            if (!mergedXpSet.has(key)) {
              mergedXpSet.add(key);
              finalXp.push(item);
            }
          };

          cloudXpList.forEach(addXpItem);
          localXp.forEach(addXpItem);

          safeStorage.setItem(XP_KEY, JSON.stringify(finalXp));
          if (finalXp.length > cloudXpList.length) {
            shouldPushSyncBack = true;
          }
        }
      }

      // 2. Restore/Merge Portfolio Table (carteira)
      let processedPositions = false;
      if (!portfolioErr && portfolioData && portfolioData.length > 0) {
        const cloudPositions = portfolioData.map((row) => ({
          id: row.id,
          ticker: row.ticker,
          name: row.nome_ativo,
          type: row.asset_type || "fii",
          logo: row.logo || "",
          purchaseDate: row.purchase_date || new Date().toISOString().split("T")[0],
          purchasePrice: Number(row.preco_medio) || 0,
          quantity: Number(row.quantidade_total) || 0,
          invested: Number(row.valor_investido_total) || 0,
          createdAt: Date.now(),
          updatedAt: row.atualizado_em ? new Date(row.atualizado_em).getTime() : Date.now(),
        }));

        const mergedPositionsMap = new Map<string, any>();
        cloudPositions.forEach(p => mergedPositionsMap.set(p.ticker, p));

        localPositions.forEach(p => {
          const existing = mergedPositionsMap.get(p.ticker);
          if (existing) {
            const localTime = p.updatedAt || p.createdAt || 0;
            const cloudTime = existing.updatedAt || existing.createdAt || 0;
            // Last-Write-Wins (LWW) resolution
            if (localTime > cloudTime) {
              mergedPositionsMap.set(p.ticker, p);
              shouldPushSyncBack = true;
            }
          } else {
            mergedPositionsMap.set(p.ticker, p);
            shouldPushSyncBack = true;
          }
        });

        const finalPositions = Array.from(mergedPositionsMap.values());
        safeStorage.setItem(PORTFOLIO_KEY, JSON.stringify(finalPositions));
        processedPositions = true;
      } else if (envelopeBackup && Array.isArray(envelopeBackup.portfolio) && envelopeBackup.portfolio.length > 0) {
        // Fallback robusto do envelope se a tabela retornou vazia ou com problema de RLS!
        const cloudPositions = envelopeBackup.portfolio;
        const mergedPositionsMap = new Map<string, any>();
        cloudPositions.forEach(p => mergedPositionsMap.set(p.ticker, p));

        localPositions.forEach(p => {
          const existing = mergedPositionsMap.get(p.ticker);
          if (existing) {
            const localTime = p.updatedAt || p.createdAt || 0;
            const cloudTime = existing.updatedAt || existing.createdAt || 0;
            // Last-Write-Wins (LWW) resolution
            if (localTime > cloudTime) {
              mergedPositionsMap.set(p.ticker, p);
              shouldPushSyncBack = true;
            }
          } else {
            mergedPositionsMap.set(p.ticker, p);
            shouldPushSyncBack = true;
          }
        });

        const finalPositions = Array.from(mergedPositionsMap.values());
        safeStorage.setItem(PORTFOLIO_KEY, JSON.stringify(finalPositions));
        processedPositions = true;
      }

      if (!processedPositions && localPositions.length > 0) {
        safeStorage.setItem(PORTFOLIO_KEY, JSON.stringify(localPositions));
        shouldPushSyncBack = true;
      }

      // 3. Restore/Merge Transactions Table (aportes)
      let processedTxs = false;
      if (!transactionsErr && transactionsData && transactionsData.length > 0) {
        const cloudTxs = transactionsData.map((row) => ({
          id: row.id,
          kind: row.kind || "buy",
          ticker: row.ticker,
          assetName: row.nome_ativo || "",
          assetType: row.asset_type || "fii",
          assetLogo: row.asset_logo || "",
          quantity: Number(row.quantidade) || 0,
          unitPrice: Number(row.preco_medio) || 0,
          total: Number(row.valor_investido) || 0,
          date: row.data_compra,
          ts: row.ts ? Number(row.ts) : Date.now(),
          note: row.note || "",
        }));

        const mergedTxsMap = new Map<string, any>();
        cloudTxs.forEach(t => mergedTxsMap.set(t.id, t));
        localTxs.forEach(t => {
          if (!mergedTxsMap.has(t.id)) {
            mergedTxsMap.set(t.id, t);
            shouldPushSyncBack = true;
          }
        });

        const finalTxs = Array.from(mergedTxsMap.values());
        finalTxs.sort((a, b) => b.ts - a.ts);
        safeStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(finalTxs));
        processedTxs = true;
      } else if (envelopeBackup && Array.isArray(envelopeBackup.transactions) && envelopeBackup.transactions.length > 0) {
        // Fallback robusto do envelope se a tabela retornou vazia ou com problema de RLS!
        const cloudTxs = envelopeBackup.transactions;
        const mergedTxsMap = new Map<string, any>();
        cloudTxs.forEach(t => mergedTxsMap.set(t.id, t));
        localTxs.forEach(t => {
          if (!mergedTxsMap.has(t.id)) {
            mergedTxsMap.set(t.id, t);
            shouldPushSyncBack = true;
          }
        });

        const finalTxs = Array.from(mergedTxsMap.values());
        finalTxs.sort((a, b) => b.ts - a.ts);
        safeStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(finalTxs));
        processedTxs = true;
      }

      if (!processedTxs && localTxs.length > 0) {
        safeStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(localTxs));
        shouldPushSyncBack = true;
      }

      // 4. Restore/Merge Challenges Table (desafios)
      let processedChallenges = false;
      if (!desafiosErr && desafiosData && desafiosData.length > 0) {
        const cloudChallenges = desafiosData.map((row) => ({
          id: row.id,
          title: row.titulo,
          desc: row.desc_detalhada || "",
          rewardXp: row.reward_xp || 10,
          frequency: row.frequency || "daily",
          target: row.target_val || 30,
          current: row.current_val || 0,
          lastCheckinDate: row.last_checkin_date || null,
          lastCheckinTs: row.last_checkin_ts ? Number(row.last_checkin_ts) : null,
          evolutionStage: row.evolution_stage || 0,
          resetOnMiss: row.reset_on_miss === true,
          iconKey: row.icon_key || "target",
          gradient: "from-emerald-50 to-teal-50 border-emerald-100",
          participants: 0,
          active: row.active !== false,
        }));

        const mergedChallengesMap = new Map<string, any>();
        cloudChallenges.forEach(ch => mergedChallengesMap.set(ch.id, ch));
        localChallenges.forEach(ch => {
          const existing = mergedChallengesMap.get(ch.id);
          if (existing) {
            const localTs = ch.lastCheckinTs || 0;
            const cloudTs = existing.lastCheckinTs || 0;
            // Last-Write-Wins (LWW) resolution based on lastCheckinTs
            if (localTs > cloudTs) {
              mergedChallengesMap.set(ch.id, ch);
              shouldPushSyncBack = true;
            }
          } else {
            mergedChallengesMap.set(ch.id, ch);
            shouldPushSyncBack = true;
          }
        });

        const finalChallenges = Array.from(mergedChallengesMap.values());
        safeStorage.setItem(CHALLENGES_KEY, JSON.stringify(finalChallenges));
        processedChallenges = true;
      } else if (envelopeBackup && Array.isArray(envelopeBackup.challenges) && envelopeBackup.challenges.length > 0) {
        // Fallback robusto do envelope se a tabela retornou vazia ou com problema de RLS!
        const cloudChallenges = envelopeBackup.challenges;
        const mergedChallengesMap = new Map<string, any>();
        cloudChallenges.forEach(ch => mergedChallengesMap.set(ch.id, ch));
        localChallenges.forEach(ch => {
          const existing = mergedChallengesMap.get(ch.id);
          if (existing) {
            const localTs = ch.lastCheckinTs || 0;
            const cloudTs = existing.lastCheckinTs || 0;
            // Last-Write-Wins (LWW) resolution based on lastCheckinTs
            if (localTs > cloudTs) {
              mergedChallengesMap.set(ch.id, ch);
              shouldPushSyncBack = true;
            }
          } else {
            mergedChallengesMap.set(ch.id, ch);
            shouldPushSyncBack = true;
          }
        });

        const finalChallenges = Array.from(mergedChallengesMap.values());
        safeStorage.setItem(CHALLENGES_KEY, JSON.stringify(finalChallenges));
        processedChallenges = true;
      }

      if (!processedChallenges && localChallenges.length > 0) {
        safeStorage.setItem(CHALLENGES_KEY, JSON.stringify(localChallenges));
        shouldPushSyncBack = true;
      }

      console.log(`[Sync Merger] Sincronização concluída. Ofline/Cloud unificados com sucesso. Transferir mudanças de volta pro Supabase: ${shouldPushSyncBack}`);
      
      // Automatically trigger push of full merged state if we had offline changes to save in the cloud!
      if (shouldPushSyncBack) {
        console.log("[Sync Merger] Enviando dados mesclados de volta para o Supabase...");
        pushAllDataToSupabase().catch((err) => {
          console.error("Erro em background ao sincronizar dados offline de volta pro banco:", err);
        });
      }

      notifySyncListeners();
      return true;
    } catch (err: any) {
      globalSyncStatus.lastPullSuccess = false;
      globalSyncStatus.lastPullError = err.message || String(err);
      notifySyncListeners();
      console.error("Exception occurred dry-fetching all Supabase data points:", err);
      return false;
    }
  })();

  try {
    return await activePullPromise;
  } finally {
    activePullPromise = null;
    activePullUserId = null;
  }
}

/**
 * Pushes all localized state to Supabase in a bulk operation.
 */
export async function pushAllDataToSupabase() {
  if (isBulkSyncing) return;
  isBulkSyncing = true;
  try {
    // 1. Sempre garanta que o Profile (que contém o envelope com TUDO) seja enviado com prioridade máxima.
    // Como RLS está desativado na tabela de perfis de usuário, essa operação sempre tem sucesso completo!
    await pushProfileToSupabase();

    // 2. Tente enviar de forma secundária os outros dados granulares se as regras de RLS do usuário permitirem
    try {
      await Promise.allSettled([
        pushPortfolioToSupabase(),
        pushTransactionsToSupabase(),
        pushChallengesToSupabase(),
        pushAchievementsToSupabase()
      ]);
    } catch (e) {
      console.warn("Erro ao processar tabelas auxiliares adicionais:", e);
    }

    globalSyncStatus.lastPushSuccess = true;
    globalSyncStatus.lastPushError = null;
    globalSyncStatus.lastSyncTime = Date.now();
  } catch (e: any) {
    console.error("Erro crítico na sincronização do profile:", e);
    globalSyncStatus.lastPushSuccess = false;
    globalSyncStatus.lastPushError = e.message || String(e);
  } finally {
    isBulkSyncing = false;
    notifySyncListeners();
  }
}

/**
 * Uploads a compressed base64 image data URL to Supabase Storage.
 */
export async function uploadDataUrlToSupabase(bucketName: string, dataUrl: string, fileName: string): Promise<string> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) throw new Error("Não autenticado");

  const userId = session.user.id;

  // Convert base64 dataUrl to a Blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const path = `${userId}/${fileName}`;

  // Try creating the bucket dynamically in case it doesn't exist on initial launch
  try {
    await supabase.storage.createBucket(bucketName, { public: true });
  } catch {
    // Ignore if already exists or blocked by policy
  }

  // Upload to Supabase Storage overriding the old ones
  const { error } = await supabase.storage.from(bucketName).upload(path, blob, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    console.error(`Error uploading to Supabase Storage in bucket ${bucketName}:`, error);
    throw error;
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return data.publicUrl;
}

