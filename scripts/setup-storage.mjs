// One-time setup: create the two storage buckets in the shared Supabase
// project (idempotent — existing buckets are left untouched).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Parse .env manually (no dotenv dependency needed)
const env = Object.fromEntries(
  readFileSync(process.argv[2], "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const wanted = [
  { name: "yd-kyc", public: false },
  { name: "yd-media", public: true },
];

const { data: existing, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("Cannot reach Supabase Storage:", listErr.message);
  process.exit(1);
}
console.log("Existing buckets:", existing.map((b) => `${b.name}(${b.public ? "public" : "private"})`).join(", ") || "(none)");

for (const b of wanted) {
  if (existing.some((e) => e.name === b.name)) {
    console.log(`OK      ${b.name} already exists`);
    continue;
  }
  const { error } = await supabase.storage.createBucket(b.name, {
    public: b.public,
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (error) console.error(`FAILED  ${b.name}: ${error.message}`);
  else console.log(`CREATED ${b.name} (${b.public ? "public" : "private"}, 5MB limit)`);
}
