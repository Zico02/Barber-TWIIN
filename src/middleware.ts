import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// 1) Refreshes the Supabase auth cookie on every request.
// 2) Fast redirect for unauthenticated dashboard visits (real authorisation
//    happens server-side in every page and server action).
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let authed = false;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    authed = !!data.user;
  } else {
    authed = req.cookies.has("bt_demo");
  }

  if (req.nextUrl.pathname.startsWith("/dashboard") && !authed) {
    const login = req.nextUrl.clone();
    login.pathname = "/connexion";
    login.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(login);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico|api/queue).*)"],
};
