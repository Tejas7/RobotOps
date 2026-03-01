import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login"
  }
});

export const config = {
  matcher: [
    "/overview/:path*",
    "/fleet/:path*",
    "/missions/:path*",
    "/facility/:path*",
    "/incidents/:path*",
    "/teleoperation/:path*",
    "/analytics/:path*",
    "/integrations/:path*",
    "/developer/:path*",
    "/settings/:path*",
    "/copilot/:path*"
  ]
};
