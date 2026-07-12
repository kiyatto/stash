import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isAuthPath,
  isProtectedPath,
  safeRedirectPath,
} from "@/lib/auth/routes";
import type { Database } from "@/lib/supabase/database.types";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
  return to;
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session if expired — required for Server Components and auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (pathname === "/" || isAuthPath(pathname)) {
      const redirect = NextResponse.redirect(new URL("/stashes", request.url));
      return copyCookies(supabaseResponse, redirect);
    }
    return supabaseResponse;
  }

  if (isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", safeRedirectPath(pathname));
    const redirect = NextResponse.redirect(loginUrl);
    return copyCookies(supabaseResponse, redirect);
  }

  return supabaseResponse;
}
