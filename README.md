# HGL Tools

HGL Tools is a Next.js app for listing Human Genetics Laboratory tools with Google sign-in, role-based private tool access, personalized recent tools, admin CRUD, and Supabase storage for tool logos.

## Local setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. In Supabase Auth, enable Google OAuth. In Google Cloud, use the Supabase callback:
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   In Supabase Auth URL configuration, add `http://localhost:3000` as a local redirect URL.
4. Copy `.env.example` to `.env.local` and fill:
   `NEXT_PUBLIC_SUPABASE_URL`
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Run:
   ```bash
   npm.cmd run dev
   ```

## Roles

- Admin: `huuluannt@gmail.com`
- HGLmem: managed from the footer `Manage` button by the admin.
- Public users and signed-out users see only public tools.
- HGLmem users and admin see public and private tools.

## Vercel deploy

Create or link the Vercel project with the name `hgltools`, add the two environment variables above, then deploy.

```bash
npm.cmd install -g vercel
vercel link --project hgltools
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel deploy --prod
```

In Supabase Auth, add the production Vercel URL as the Site URL and as an allowed redirect URL.

## Supabase fix for existing projects

If an existing Supabase project still has the old admin email or is missing the logo bucket, run:

```sql
-- Paste and run the full contents of supabase/fix-admin-storage.sql
```

This updates admin access to `huuluannt@gmail.com`, removes `liamnicolas9x@gmail.com` from HGLmem, and creates the public `tool-logos` Storage bucket with upload policies.
