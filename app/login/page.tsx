"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {

  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleLogin() {

    try {

      setLoading(true);

      setError("");

      const result =
        await supabase.auth.signInWithPassword({

          email,

          password,

        });

      console.log(result);

      if (result.error) {

        alert(
          result.error.message
        );

        setError(
          result.error.message
        );

        setLoading(false);

        return;

      }

      router.push(
        "/dashboard"
      );

      router.refresh();

    } catch (err: any) {

      console.log(err);

      alert(
        err?.message ||
        "Login failed"
      );

      setError(
        err?.message ||
        "Login failed"
      );

    } finally {

      setLoading(false);

    }

  }

  return (

    <div className="min-h-screen bg-black text-white flex items-center justify-center p-10">

      <div className="w-full max-w-xl rounded-[40px] border border-white/10 bg-zinc-950 p-10">

        <h1 className="text-6xl font-bold">
          AVERON
        </h1>

        <p className="mt-4 text-xl text-zinc-500">
          AI Revenue Operating System
        </p>

        <div className="mt-10 space-y-6">

          <div>

            <label className="text-zinc-400">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-xl outline-none"
              placeholder="you@company.com"
            />

          </div>

          <div>

            <label className="text-zinc-400">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-xl outline-none"
              placeholder="••••••••"
            />

          </div>

          {error && (

            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">

              {error}

            </div>

          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-2xl bg-white py-5 text-2xl font-bold text-black disabled:opacity-50"
          >

            {loading
              ? "Loading..."
              : "Login"}

          </button>

        </div>

      </div>

    </div>

  );

}