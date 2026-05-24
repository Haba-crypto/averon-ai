import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";

export default async function Home() {
  const { data, error } = await supabase
    .from("organizations")
    .select("*");

  return (
    <main className="p-10">
      <h1 className="text-4xl font-bold mb-6">
        AVERON AI
      </h1>

      <div className="mb-6">
        <p>Supabase connection test:</p>
      </div>

      <pre className="bg-black text-green-400 p-4 rounded-xl overflow-auto">
        {JSON.stringify({ data, error }, null, 2)}
      </pre>
    </main>
  );
}