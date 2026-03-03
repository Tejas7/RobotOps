import jwt from "jsonwebtoken";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { normalizePermissions, permissionsForRole, type Role } from "@robotops/shared";

interface SeedUser {
  id: string;
  email: string;
  name: string;
  password: string;
  tenantId: string;
  role: Role;
}

const seedUsers: SeedUser[] = [
  {
    id: "u1",
    email: "owner@demo.com",
    name: "Alice Owner",
    password: "password123",
    tenantId: "t1",
    role: "Owner"
  },
  {
    id: "u2",
    email: "ops@demo.com",
    name: "Omar Ops",
    password: "password123",
    tenantId: "t1",
    role: "OpsManager"
  },
  {
    id: "u3",
    email: "engineer@demo.com",
    name: "Erin Engineer",
    password: "password123",
    tenantId: "t1",
    role: "Engineer"
  }
];

function getJwtSecret() {
  return process.env.JWT_SECRET ?? "robotops-dev-secret";
}

const API_ACCESS_TOKEN_TTL_SECONDS = 30 * 60;
const API_ACCESS_TOKEN_REFRESH_LEEWAY_SECONDS = 60;

function issueApiAccessToken(input: {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: Role;
  permissions: string[];
  scopeVersion: number;
}) {
  return jwt.sign(
    {
      sub: input.id,
      email: input.email,
      name: input.name,
      tenantId: input.tenantId,
      role: input.role,
      permissions: input.permissions,
      scope_version: input.scopeVersion
    },
    getJwtSecret(),
    { expiresIn: `${API_ACCESS_TOKEN_TTL_SECONDS}s` }
  );
}

function shouldRefreshApiAccessToken(tokenValue: unknown) {
  if (typeof tokenValue !== "string" || !tokenValue) {
    return true;
  }
  const decoded = jwt.decode(tokenValue);
  if (!decoded || typeof decoded === "string") {
    return true;
  }
  if (typeof decoded.exp !== "number") {
    return true;
  }
  return decoded.exp * 1000 - Date.now() <= API_ACCESS_TOKEN_REFRESH_LEEWAY_SECONDS * 1000;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? "robotops-nextauth-secret",
  session: {
    strategy: "jwt"
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const matched = seedUsers.find(
          (user) => user.email === credentials.email && user.password === credentials.password
        );

        if (!matched) {
          return null;
        }

        const permissions = normalizePermissions(permissionsForRole(matched.role));
        const accessToken = issueApiAccessToken({
          id: matched.id,
          email: matched.email,
          name: matched.name,
          tenantId: matched.tenantId,
          role: matched.role,
          permissions,
          scopeVersion: 2
        });

        return {
          id: matched.id,
          email: matched.email,
          name: matched.name,
          tenantId: matched.tenantId,
          role: matched.role,
          permissions,
          scopeVersion: 2,
          accessToken
        } as any;
      }
    })
  ],
  pages: {
    signIn: "/login"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
        token.permissions = normalizePermissions((user as any).permissions ?? []);
        token.scopeVersion = (user as any).scopeVersion ?? 2;
        token.accessToken = (user as any).accessToken;
      }

      const role = ((token.role as Role | undefined) ?? "Viewer") as Role;
      const permissions = normalizePermissions((token.permissions as string[] | undefined) ?? permissionsForRole(role));
      token.permissions = permissions;
      token.scopeVersion = (token.scopeVersion as number | undefined) ?? 2;
      if (shouldRefreshApiAccessToken(token.accessToken) && typeof token.sub === "string" && typeof token.tenantId === "string") {
        token.accessToken = issueApiAccessToken({
          id: token.sub,
          email: typeof token.email === "string" ? token.email : `${token.sub}@robotops.local`,
          name: typeof token.name === "string" ? token.name : token.sub,
          tenantId: token.tenantId,
          role,
          permissions,
          scopeVersion: token.scopeVersion as number
        });
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.tenantId = (token.tenantId as string) ?? "";
      session.user.role = (token.role as Role) ?? "Viewer";
      session.user.permissions = normalizePermissions((token.permissions as string[]) ?? []);
      session.user.scopeVersion = (token.scopeVersion as number) ?? 2;
      session.accessToken = (token.accessToken as string) ?? "";
      return session;
    }
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
