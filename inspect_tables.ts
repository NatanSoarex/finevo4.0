import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qyvbichuvddbreuarvix.supabase.co";
const supabaseAnonKey = "sb_publishable_BPw04YTcGx0355CGcK-EZA_ZATXdli5";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log("Inspecting public.profile columns...");
  const { data: profileData, error: profileErr } = await supabase.from("profile").select("*").limit(1);
  if (profileErr) {
    console.error("Profile error:", profileErr);
  } else {
    console.log("Profile row sample:", profileData);
  }

  console.log("Inspecting public.carteira columns...");
  const { data: carteiraData, error: carteiraErr } = await supabase.from("carteira").select("*").limit(1);
  if (carteiraErr) {
    console.error("Carteira error:", carteiraErr);
  } else {
    console.log("Carteira row sample:", carteiraData);
  }

  console.log("Inspecting public.aportes columns...");
  const { data: aportesData, error: aportesErr } = await supabase.from("aportes").select("*").limit(1);
  if (aportesErr) {
    console.error("Aportes error:", aportesErr);
  } else {
    console.log("Aportes row sample:", aportesData);
  }

  console.log("Inspecting public.historico_patrimonial columns...");
  const { data: histData, error: histErr } = await supabase.from("historico_patrimonial").select("*").limit(1);
  if (histErr) {
    console.error("Historico error:", histErr);
  } else {
    console.log("Historico row sample:", histData);
  }
}

inspect();
