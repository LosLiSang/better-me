import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * 服务端 Supabase 客户端（用户作用域）。
 *
 * 纪律（见 doc/架构设计.md §0/§5）：
 * - 一律用带用户 cookie 的客户端，RLS 生效——这是主链路。
 * - 不引入 service_role；/pay 等操作同样走用户客户端 + RLS。
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component 里 set 会被 Next 忽略，可安全吞掉
          }
        },
      },
    }
  );
}
