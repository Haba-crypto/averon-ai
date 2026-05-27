"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const handleSignup = async () => {
    setLoading(true);

    const { error } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (!error) {
      router.push("/dashboard");
    }

    setLoading(false);
  };

  return (
    <div className="h-screen bg-black text-white flex items-center justify-center">
      <div className="w-[420px] bg-zinc-950 border border-zinc-800 rounded-3xl p-8">
        <h1 className="text-4xl font-bold mb-2">
          Create Account
        </h1>

        <p className="text-zinc-500 mb-8">
          Join AVERON AI
        </p>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="w-full h-[56px] rounded-2xl bg-black border border-zinc-800 px-4 outline-none"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            className="w-full h-[56px] rounded-2xl bg-black border border-zinc-800 px-4 outline-none"
          />

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full h-[56px] rounded-2xl bg-white text-black font-semibold"
          >
            {loading
              ? "Loading..."
              : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
