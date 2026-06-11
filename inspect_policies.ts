import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qyvbichuvddbreuarvix.supabase.co";
const supabaseAnonKey = "sb_publishable_BPw04YTcGx0355CGcK-EZA_ZATXdli5";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectPolicies() {
  console.log("Inspecting RLS active policies...");
  
  // Querying pg_policies to see exactly what we have
  const { data: policies, error: polErr } = await supabase.rpc("inspect_policies_sql", {});
  if (polErr) {
    console.log("RPC inspect_policies_sql not defined, trying a direct SQL-injection-like inspect or general query:");
  }

  // Let's do a select from pg_policies if public exposed or try to query pg_catalog
  const { data: pData, error: pErr } = await supabase.from("profile").select("id").limit(1);
  console.log("Tested profile table access check:", pErr ? pErr.message : "Success!");

  // Let's run a test query on other tables
  const { error: cartErr } = await supabase.from("carteira").select("id").limit(1);
  console.log("Tested carteira table access check:", cartErr ? cartErr.message : "Success!");

  const { error: apErr } = await supabase.from("aportes").select("id").limit(1);
  console.log("Tested aportes table access check:", apErr ? apErr.message : "Success!");
}

inspectPolicies();
