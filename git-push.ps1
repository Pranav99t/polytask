# Initialize git repository
git init

# Configure git with your details
git config user.name "Pranav99t"
git config user.email "oppranav10@gmail.com"

# Add remote repository
git remote add origin https://github.com/Pranav99t/PolyTask.git

# Commit 1: Initial files
git add .gitignore README.md
git commit -m "Initial commit: Add README and gitignore"

# Commit 2: Package configuration
git add package.json package-lock.json
git commit -m "Add project dependencies and package configuration"

# Commit 3: TypeScript and build configs
git add tsconfig.json next.config.ts next-env.d.ts postcss.config.mjs eslint.config.mjs components.json
git commit -m "Configure TypeScript, Next.js, ESLint, and PostCSS"

# Commit 4: Middleware and Lingo config
git add middleware.ts lingo.config.json
git commit -m "Add middleware and i18n configuration"

# Commit 5: Lib utilities
git add lib/
git commit -m "Setup Supabase client and utility functions"

# Commit 6: UI Components
git add components/ui/
git commit -m "Add Shadcn UI components library"

# Commit 7: Providers
git add components/providers/
git commit -m "Implement i18n provider with multilingual support"

# Commit 8: Shared components
git add components/shared/
git commit -m "Create shared components (LanguageSelector, CommentSection)"

# Commit 9: Database schema
git add supabase/
git commit -m "Define database schema with RLS policies"

# Commit 10: App layout and globals
git add app/layout.tsx app/globals.css app/page.tsx
git commit -m "Setup root layout and global styles"

# Commit 11: Authentication
git add app/login/
git commit -m "Implement authentication with Supabase Auth"

# Commit 12: Dashboard
git add app/dashboard/
git commit -m "Build project dashboard with CRUD operations"

# Commit 13: Project pages
git add app/project/
git commit -m "Add project and task views with real-time updates"

# Commit 14: API routes
git add app/api/
git commit -m "Create API endpoint for comment translation"

# Commit 15: Public assets
git add public/
git commit -m "Add public assets and icons"

# Commit 16: Remaining files
git add .
git commit -m "Add remaining configuration files"

# Push to GitHub
git push -u origin main

Write-Host "Done! Check your GitHub repo now!" -ForegroundColor Green
