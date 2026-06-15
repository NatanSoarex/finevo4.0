import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qyvbichuvddbreuarvix.supabase.co";
const supabaseAnonKey = "sb_publishable_BPw04YTcGx0355CGcK-EZA_ZATXdli5";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const email = "contatonatansoarex@gmail.com";
  console.log(`Updating password for ${email} to "10021949n" in the bio fallback...`);

  const { data, error } = await supabase
    .from("profile")
    .update({ bio: "[pw:10021949n]" })
    .ilike("email", email)
    .select();

  if (error) {
    console.error("Error updating profile:", error);
    return;
  }

  console.log("Updated profile successfully:", data);
}

main().catch(console.error);
