# Server Components

Default to Server Components for data fetching. Fetch data on the server with async/await, wrap with Suspense for loading states, and use "use client" only when necessary.

---

## Server Component Pattern

Default to Server Components. Always fetch data on the server with async/await, and wrap with Suspense for loading states.

```typescript
// entities/user/schema.ts - Define types with Zod
import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
})

export type User = z.infer<typeof userSchema>

// gateways/user.ts - Data fetching function
import { userSchema, type User } from '@/entities/user/schema'

export async function fetchUser(userId: string): Promise<User> {
  const response = await fetch(`/api/users/${userId}`)
  if (!response.ok) throw new Error('Failed to fetch user')

  const json = await response.json()
  return userSchema.parse(json)  // Validate with entity schema
}

// Server Component fetches data
async function UserProfilePage({ params }: { params: { id: string } }) {
  const user = await fetchUser(params.id)  // Call gateway function
  return <UserProfile user={user} />
}

// Wrap with Suspense
export default function Layout({ children }) {
  return (
    <Suspense fallback={<Spinner />}>
      {children}
    </Suspense>
  )
}
```

Only use "use client" when necessary: interactive operations, forms, or client-side state management.

---

## Promise Handling

Prefer `.then().catch()`. Use try-catch only when exceptional.

```typescript
// ✅ .then().catch() pattern
fetchUser(id)
  .then(user => setUser(user))
  .catch(error => setError(error))

// ❌ try-catch is verbose
try {
  const user = await fetchUser(id)
  setUser(user)
} catch (error) {
  setError(error)
}
```

In Server Components, use async/await.

```typescript
// Server Component uses async/await
async function UserPage({ params }: { params: { id: string } }) {
  const user = await fetchUser(params.id)
  return <UserProfile user={user} />
}
```

---

## Better Auth サーバーサイド API

Better Auth は `auth.api` でサーバーサイドからも呼べる。`headers()` を渡す必要がある。

```typescript
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

// ✅ Server Component で auth.api を使う
async function WorkspaceSettingsPage() {
  const reqHeaders = await headers();
  const orgData = await auth.api.getFullOrganization({
    headers: reqHeaders,
    query: { organizationId },
  });
  return <WorkspaceSettings members={orgData?.members ?? []} />;
}
```

- **サーバー**: `auth.api.*`（`src/lib/auth/auth.ts`）— データ取得
- **クライアント**: `authClient.*`（`src/lib/auth/auth-client.ts`）— mutation（招待送信・削除等）

`auth.api` で取得できるデータを Drizzle で二重実装しない。

---

## Client mutation 後のリフレッシュ

クライアントで mutation した後、Server Component のデータを再取得するには `router.refresh()` を使う。

```typescript
// ✅ mutation 後に router.refresh() で Server Component を再実行
const router = useRouter();
const handleInvite = async () => {
  await authClient.organization.inviteMember({ email, role, organizationId });
  router.refresh(); // page.tsx の Server Component が再実行される
};
```

`useEffect` + `refreshKey` や手動 state 管理ではなく、`router.refresh()` でサーバーから最新データを取り直す。

---

## Anti-Patterns (Never Do This)

### Data Fetching with useEffect

Fetching data with `useEffect` prevents using Server Components and Suspense. Use Server Component + Gateway pattern.

### Direct Data Fetching Without Gateway

Don't write fetch directly in Server Components. Go through gateway functions. Entity schema validation is important.

### Overusing "use client"

Don't add "use client" to every component. Limit to necessary places (interactive, forms, client-side state management).
