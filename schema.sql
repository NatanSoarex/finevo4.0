-- ==========================================
-- FINEVO - FULL DATABASE SCHEMA & RLS SETUP
-- Execute this script directly in the Supabase SQL Editor
-- to instantly provision all required tables and fix errors.
-- ==========================================

-- 1. CLEAN UP PRE-EXISTING TABLES (IF ANY) IN REVERSE DEPENDENCY ORDER
-- DROP TABLE IF EXISTS public.conquistas CASCADE;
-- DROP TABLE IF EXISTS public.desafios CASCADE;
-- DROP TABLE IF EXISTS public.aportes CASCADE;
-- DROP TABLE IF EXISTS public.carteira CASCADE;
-- DROP TABLE IF EXISTS public.historico_patrimonial CASCADE;
-- DROP TABLE IF EXISTS public.profile CASCADE;

-- 2. CREATE USER PROFILE TABLE
CREATE TABLE IF NOT EXISTS public.profile (
    id UUID PRIMARY KEY, -- Maps directly to auth.users.id
    email TEXT NOT NULL UNIQUE,
    nome TEXT,
    foto_perfil TEXT,
    banner_perfil TEXT,
    bio TEXT,
    nivel INT NOT NULL DEFAULT 1,
    xp INT NOT NULL DEFAULT 0,
    streak INT NOT NULL DEFAULT 0,
    xp_events_json TEXT, -- Master fallback envelope containing JSON backup
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CREATE CARTEIRA (PORTFOLIO CURRENT STATUS) TABLE
CREATE TABLE IF NOT EXISTS public.carteira (
    id TEXT PRIMARY KEY, -- Custom client-side unique string identifier (e.g. uuid-like or combination)
    user_id UUID NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    nome_ativo TEXT NOT NULL,
    quantidade_total NUMERIC NOT NULL DEFAULT 0,
    preco_medio NUMERIC NOT NULL DEFAULT 0,
    valor_investido_total NUMERIC NOT NULL DEFAULT 0,
    valor_atual NUMERIC NOT NULL DEFAULT 0,
    lucro_prejuizo NUMERIC NOT NULL DEFAULT 0,
    percentual NUMERIC NOT NULL DEFAULT 0,
    asset_type TEXT NOT NULL, -- e.g., 'fii', 'stock', 'crypto', etc.
    logo TEXT,
    purchase_date TEXT,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CREATE APORTES (TRANSACTIONS LEDGER LOGS) TABLE
CREATE TABLE IF NOT EXISTS public.aportes (
    id TEXT PRIMARY KEY, -- Custom client-side unique ID
    user_id UUID NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    nome_ativo TEXT NOT NULL,
    quantidade NUMERIC NOT NULL DEFAULT 0,
    preco_medio NUMERIC NOT NULL DEFAULT 0,
    valor_investido NUMERIC NOT NULL DEFAULT 0,
    data_compra TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'buy', -- e.g., 'buy', 'sell'
    asset_type TEXT NOT NULL,
    asset_logo TEXT,
    ts BIGINT NOT NULL, -- Epoch Unix timestamp for chronological sorting
    note TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CREATE DESAFIOS (CHALLENGES TRACKING) TABLE
CREATE TABLE IF NOT EXISTS public.desafios (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    desc_detalhada TEXT,
    reward_xp INT NOT NULL DEFAULT 0,
    frequency TEXT DEFAULT 'daily',
    target_val NUMERIC NOT NULL DEFAULT 0,
    current_val NUMERIC NOT NULL DEFAULT 0,
    last_checkin_date TEXT,
    last_checkin_ts BIGINT,
    evolution_stage INT NOT NULL DEFAULT 0,
    reset_on_miss BOOLEAN NOT NULL DEFAULT FALSE,
    icon_key TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    progresso NUMERIC NOT NULL DEFAULT 0,
    concluido BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. CREATE CONQUISTAS (ACHIEVEMENTS LEDGER) TABLE
CREATE TABLE IF NOT EXISTS public.conquistas (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    desbloqueada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
);

-- 7. CREATE HISTORICO_PATRIMONIAL (NET WORTH OVER-TIME EVOLUTION) TABLE
CREATE TABLE IF NOT EXISTS public.historico_patrimonial (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
    data TEXT NOT NULL, -- Date formatted string (YYYY-MM-DD)
    patrimonio_total NUMERIC NOT NULL DEFAULT 0,
    valor_investido NUMERIC NOT NULL DEFAULT 0,
    lucro_prejuizo NUMERIC NOT NULL DEFAULT 0
);

-- ========================================================
-- ENABLE ROW LEVEL SECURITY (RLS) FOR FULL DATA ISOLATION
-- ========================================================
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carteira ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desafios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conquistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_patrimonial ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- ROW LEVEL SECURITY DECLARED POLICIES (ISOLATE PER USER ID)
-- ========================================================

-- Profile Access Policies
CREATE POLICY "Users can read all profile details" ON public.profile
    FOR SELECT USING (true);

CREATE POLICY "Users can insert/update their own profile details" ON public.profile
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Carteira Access Policies
CREATE POLICY "Users can view their own carteira items" ON public.carteira
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own carteira items" ON public.carteira
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Aportes / Transactions Policies
CREATE POLICY "Users can view their own transaction history logs" ON public.aportes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own transaction history logs" ON public.aportes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Desafios Policies
CREATE POLICY "Users can read their own active challenges" ON public.desafios
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own active challenges status" ON public.desafios
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Conquistas Policies
CREATE POLICY "Users can inspect their unlocked achievements" ON public.conquistas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own achievements ledger" ON public.conquistas
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Historico Patrimonial Policies
CREATE POLICY "Users can view their net worth progress history points" ON public.historico_patrimonial
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their net worth progress history points" ON public.historico_patrimonial
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========================================================
-- HIGH-PERFORMANCE SECONDARY QUERY INDEXING DEFINITIONS
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_carteira_user_ticker ON public.carteira(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_aportes_user_ts ON public.aportes(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_desafios_user_active ON public.desafios(user_id, active);
CREATE INDEX IF NOT EXISTS idx_historico_user_data ON public.historico_patrimonial(user_id, data);

-- ========================================================
-- REAL-TIME SYNC UTILITIES: AUTOMATIC PROFILE HANDLERS
-- ON NEW AUTH USER REGISTRATION
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profile (id, email, nome, nivel, xp, streak, criado_em)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'username', 'Investidor'),
    1,
    0,
    0,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup existing trigger safely if rerunning
DROP TRIGGER IF EXISTS trigger_new_user_onboarding ON auth.users;

CREATE TRIGGER trigger_new_user_onboarding
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
