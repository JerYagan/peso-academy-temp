# Deployment and Hosting Guide

## Purpose

This document outlines a practical deployment and hosting setup for the current PESO Academy application.

The project is currently a Vite + React + TypeScript frontend that uses Supabase for:

1. authentication
2. database access
3. storage and backend platform services

Because the app is a static frontend with client-side routing, the simplest production setup is:

1. host the frontend on Netlify
2. keep backend services on Supabase
3. manage environment variables in the hosting provider

## Current Deployment Facts From the Repo

The repository already contains deployment-ready settings:

1. build command: `npm run build`
2. output directory: `dist`
3. Netlify config file: `netlify.toml`
4. SPA redirect rule already configured for client-side routes

The app currently depends on these environment variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Recommended Hosting Architecture

## Frontend

Recommended host: Netlify

Why Netlify fits this repo well:

1. `netlify.toml` already exists
2. static Vite build output is straightforward to deploy
3. SPA redirects are already configured
4. preview deploys and branch deploys are easy to manage

## Backend

Recommended backend host: Supabase

Supabase should continue handling:

1. auth
2. Postgres database
3. storage
4. row level security
5. optional edge/backend extensions in the future

## Domains

Recommended production pattern:

1. frontend app: `https://your-domain.com`
2. optional staging app: `https://staging.your-domain.com`
3. Supabase project domain remains managed by Supabase

## Primary Deployment Option: Netlify

## Build Settings

Use the following values in Netlify:

```text
Base directory: /
Build command: npm run build
Publish directory: dist
Node version: 20
```

These match the repo's existing configuration.

## Environment Variables

Add the following in Netlify Site Settings -> Environment Variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Notes:

1. these are safe client-side variables for a Supabase frontend app
2. do not place service role keys in Netlify frontend environment variables
3. if you add other `VITE_` variables later, they must also be configured in Netlify

## Redirect Handling

The current `netlify.toml` includes:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This is required because the app uses client-side routing. Without it, deep links such as `/login`, `/dashboard`, or `/trainer/courses` may return a 404 on refresh.

## Netlify Deployment Steps

1. push the repository to GitHub, GitLab, or Bitbucket
2. create a new site in Netlify from the repository
3. confirm build command is `npm run build`
4. confirm publish directory is `dist`
5. add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
6. trigger the first deploy
7. open the deployed site and verify login, routing, and protected pages

## Supabase Configuration Required for Production

After the frontend is deployed, update Supabase settings so auth flows work correctly in production.

## Auth Site URL

In Supabase Dashboard -> Authentication -> URL Configuration:

1. set the Site URL to the production frontend domain
2. add any staging or preview domains as additional redirect URLs if needed

Example:

```text
Site URL: https://your-domain.com
Additional Redirect URLs:
https://staging.your-domain.com
https://your-netlify-site.netlify.app
```

This is important if the app uses sign-in redirects, password reset flows, or email confirmation links.

## Database and RLS Readiness

Before production launch, confirm that:

1. all required SQL migrations have been applied in Supabase
2. RLS policies allow the intended role-based access
3. seed or test data is removed or clearly separated from production data
4. storage buckets and policies are configured if the app uses uploads

## Deployment Checklist

Use this checklist before go-live:

1. `npm install` completes without dependency issues
2. `npm run build` succeeds locally
3. Netlify environment variables are set
4. Supabase production project is selected, not a local or test project
5. Supabase Site URL and redirect URLs match the deployed frontend
6. key routes load correctly on direct refresh
7. login, signup, logout, and protected route behavior work in production
8. certificate, course, admin, trainer, and validator pages are verified based on role
9. browser console is free from missing env var or network errors
10. custom domain and HTTPS are active if using a branded domain

## Release Workflow Recommendation

Recommended workflow:

1. `main` branch deploys to production
2. a staging branch or preview deploy is used for QA
3. production deploy happens only after auth, routing, and role-based access checks pass

For this project, a practical flow is:

1. develop locally with `.env`
2. open a pull request
3. test preview deployment on Netlify
4. merge to `main`
5. let Netlify deploy production automatically

## Alternative Hosting Options

## Vercel

Vercel can also host this app successfully.

Use:

```text
Framework preset: Vite
Build command: npm run build
Output directory: dist
```

It is a good option if your team prefers Vercel's preview workflow, but this repo is currently more directly aligned with Netlify because `netlify.toml` is already checked in.

## Cloudflare Pages

Cloudflare Pages is also viable for a static Vite build.

Use:

```text
Build command: npm run build
Build output directory: dist
```

If you choose Cloudflare Pages, you will need to recreate SPA routing behavior using its redirect or `_routes` configuration approach instead of relying on `netlify.toml`.

## Recommended Decision

For the current codebase, the recommended production setup is:

1. Netlify for frontend hosting
2. Supabase for backend services
3. Git-based automatic deployments
4. separate staging and production environments when possible

This is the lowest-friction deployment path because it matches the repo's current tooling and configuration.

## Suggested Future Improvements

As the platform grows, consider adding:

1. a dedicated staging Supabase project
2. deployment checklists in CI
3. automated lint and build validation before merge
4. environment-specific documentation for staging vs production
5. rollback and incident handling notes

## Quick Start Summary

If the goal is to launch quickly with minimal infrastructure work:

1. keep Supabase as the backend
2. deploy the frontend to Netlify
3. set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. update Supabase auth URLs to match the deployed domain
5. verify routing and role-based flows after deployment

That is the most practical hosting approach for the current PESO Academy repository.

Use this step-by-step flow for deploying the current app.
1. Create a production Supabase project.
2. In Supabase, copy the Project URL and anon key from Settings > API.
3. Make sure your database schema and required SQL migrations are already applied in that production Supabase project.
4. Verify the app builds locally with `npm run build`.
5. Push the repository to GitHub, GitLab, or Bitbucket.
6. In Netlify, create a new site from that repository.
7. Set the build command to `npm run build`.
8. Set the publish directory to dist.
9. Set Node.js version to `20` if Netlify asks for it. This matches netlify.toml.
10. In Netlify environment variables, add `VITE_SUPABASE_URL` with your Supabase Project URL.
11. Add `VITE_SUPABASE_ANON_KEY` with your Supabase anon key.
12. Start the first deploy in Netlify.
13. After deployment, copy your live site URL from Netlify.
14. In Supabase, open Authentication > URL Configuration.
15. Set Site URL to your live frontend URL.
16. Add your Netlify domain as an allowed redirect URL.
17. If you have a staging site or preview domain, add those redirect URLs too.
18. Open the deployed app and test the main pages directly in the browser, such as `/`, `/login`, `/dashboard`, and role-based pages.
19. Refresh those pages directly to confirm SPA routing works. The redirect rule in netlify.toml should prevent 404s.
20. Test signup, login, logout, and any protected routes.
21. Confirm that users with different roles can access only the correct sections.
22. If everything works, connect your custom domain in Netlify and enable HTTPS.
23. Update Supabase Site URL again if you switch from the Netlify subdomain to your custom domain.
24. Run one final smoke test on the custom domain.