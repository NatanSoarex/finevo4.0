import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qyvbichuvddbreuarvix.supabase.co";
const supabaseAnonKey = "sb_publishable_BPw04YTcGx0355CGcK-EZA_ZATXdli5";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  console.log("Trying insert into carteira...");
  const { data, error } = await supabase.from("carteira").insert([
    {
      id: "test_" + Date.now(),
      user_id: "ef85f243-1b4c-4499-84d7-6fe08d80692f", // existing profile ID from sample
      ticker: "PETR4",
      nome_ativo: "Petrobras",
      quantidade_total: 10,
      preco_medio: 35.5,
      valor_investido_total: 355.0,
      valor_atual: 360.0,
      lucro_prejuizo: 5.0,
      percentual: 1.4,
      asset_type: "acao",
    }
  ]);

  if (error) {
    console.error("Carteira Insert Error:", error);
  } else {
    console.log("Carteira Insert Success:", data);
  }

  console.log("Trying insert into profile...");
  const { data: pData, error: pErr } = await supabase.from("profile").upsert({
    id: "ef85f243-1b4c-4499-84d7-6fe08d80692f",
    email: "teste_84729@finevo.com.br",
    nome: "test_user_v3_84729",
    bio: "Test bio updated!",
  });
  if (pErr) {
    console.error("Profile Upsert Error:", pErr);
  } else {
    console.log("Profile Upsert Success:", pData);
  }
}

testInsert();
