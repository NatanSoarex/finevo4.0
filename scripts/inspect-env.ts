console.log("Inspecting env keys...");
const keys = Object.keys(process.env).filter(k => k.toLowerCase().includes("supabase") || k.toLowerCase().includes("secret") || k.toLowerCase().includes("service") || k.toLowerCase().includes("key"));
console.log("Matching Env Keys:", keys);
// Let's print their lengths/presence safely:
for (const k of keys) {
  console.log(`${k}: ${process.env[k] ? "PRESENT (length: " + process.env[k]?.length + ")" : "ABSENT"}`);
}
