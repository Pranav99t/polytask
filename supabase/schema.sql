-- =============================================
-- PolyTask Database Schema
-- Organisation-Based Collaboration Model
-- =============================================

-- Enable Row Level Security on all tables

-- =============================================
-- 1. USERS TABLE
-- =============================================
create table if not exists public.users (
  id uuid references auth.users not null primary key,
  email text,
  username text unique,
  full_name text,
  preferred_locale text default 'en',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.users enable row level security;
create policy "Public profiles are viewable by everyone." on public.users for select using (true);
create policy "Users can update own profile." on public.users for update using (auth.uid() = id);
create policy "Users can insert own profile." on public.users for insert with check (auth.uid() = id);

-- Trigger to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email, username)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- 2. ORGANISATIONS TABLE
-- =============================================
create table if not exists public.organisations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  description text,
  leader_id uuid references public.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.organisations enable row level security;

-- Organisation members can view their organisations
create policy "Members can view their organisations" on public.organisations for select using (
  exists (
    select 1 from public.organisation_members 
    where organisation_id = organisations.id and user_id = auth.uid()
  )
);
-- Leaders can update their organisations
create policy "Leaders can update their organisations" on public.organisations for update using (leader_id = auth.uid());
-- Authenticated users can create organisations
create policy "Authenticated users can create organisations" on public.organisations for insert with check (auth.uid() = leader_id);
-- Leaders can delete their organisations
create policy "Leaders can delete their organisations" on public.organisations for delete using (leader_id = auth.uid());

-- =============================================
-- 3. ORGANISATION MEMBERS TABLE
-- =============================================
create table if not exists public.organisation_members (
  id uuid default gen_random_uuid() primary key,
  organisation_id uuid references public.organisations(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  role text default 'member' check (role in ('leader', 'admin', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(organisation_id, user_id)
);
alter table public.organisation_members enable row level security;

-- Members can view other members in their organisations
create policy "Members can view organisation members" on public.organisation_members for select using (
  exists (
    select 1 from public.organisation_members om
    where om.organisation_id = organisation_members.organisation_id and om.user_id = auth.uid()
  )
);
-- Leaders/admins can add members
create policy "Leaders can add members" on public.organisation_members for insert with check (
  exists (
    select 1 from public.organisation_members om
    where om.organisation_id = organisation_id 
    and om.user_id = auth.uid() 
    and om.role in ('leader', 'admin')
  ) OR auth.uid() = user_id -- Allow self-insert when creating org
);
-- Leaders can remove members
create policy "Leaders can remove members" on public.organisation_members for delete using (
  exists (
    select 1 from public.organisation_members om
    where om.organisation_id = organisation_members.organisation_id 
    and om.user_id = auth.uid() 
    and om.role in ('leader', 'admin')
  ) OR auth.uid() = user_id -- Allow self-leave
);

-- =============================================
-- 4. ORGANISATION INVITES TABLE
-- =============================================
create table if not exists public.organisation_invites (
  id uuid default gen_random_uuid() primary key,
  organisation_id uuid references public.organisations(id) on delete cascade not null,
  email text not null,
  invited_by uuid references public.users(id) not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  token text unique default gen_random_uuid()::text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone default (timezone('utc'::text, now()) + interval '7 days') not null
);
alter table public.organisation_invites enable row level security;

-- Invitees can view their invites
create policy "Users can view invites to their email" on public.organisation_invites for select using (
  email = (select email from public.users where id = auth.uid())
  OR invited_by = auth.uid()
  OR exists (
    select 1 from public.organisation_members om
    where om.organisation_id = organisation_invites.organisation_id 
    and om.user_id = auth.uid() 
    and om.role in ('leader', 'admin')
  )
);
-- Leaders/admins can create invites
create policy "Leaders can create invites" on public.organisation_invites for insert with check (
  exists (
    select 1 from public.organisation_members om
    where om.organisation_id = organisation_id 
    and om.user_id = auth.uid() 
    and om.role in ('leader', 'admin')
  )
);
-- Invitees can update their invites (accept/decline)
create policy "Users can update their invites" on public.organisation_invites for update using (
  email = (select email from public.users where id = auth.uid())
);

-- =============================================
-- 5. PROJECTS TABLE (Now belongs to Organisations)
-- =============================================
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  organisation_id uuid references public.organisations(id) on delete cascade not null,
  name text not null,
  description text,
  created_by uuid references public.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.projects enable row level security;

-- Organisation members can view projects
create policy "Organisation members can view projects" on public.projects for select using (
  exists (
    select 1 from public.organisation_members om
    where om.organisation_id = projects.organisation_id and om.user_id = auth.uid()
  )
);
-- Organisation members can create projects
create policy "Organisation members can create projects" on public.projects for insert with check (
  exists (
    select 1 from public.organisation_members om
    where om.organisation_id = organisation_id and om.user_id = auth.uid()
  )
);
-- Organisation members can update projects
create policy "Organisation members can update projects" on public.projects for update using (
  exists (
    select 1 from public.organisation_members om
    where om.organisation_id = projects.organisation_id and om.user_id = auth.uid()
  )
);
-- Leaders/admins can delete projects
create policy "Leaders can delete projects" on public.projects for delete using (
  exists (
    select 1 from public.organisation_members om
    where om.organisation_id = projects.organisation_id 
    and om.user_id = auth.uid() 
    and om.role in ('leader', 'admin')
  ) OR created_by = auth.uid()
);

-- =============================================
-- 6. TASKS TABLE
-- =============================================
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  status text default 'todo' check (status in ('todo', 'in-progress', 'done')),
  assigned_to uuid references public.users(id),
  created_by uuid references public.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.tasks enable row level security;

-- Organisation members can view all tasks in their projects
create policy "Organisation members can view tasks" on public.tasks for select using (
  exists (
    select 1 from public.projects p
    join public.organisation_members om on om.organisation_id = p.organisation_id
    where p.id = tasks.project_id and om.user_id = auth.uid()
  )
);
-- Organisation members can create tasks
create policy "Organisation members can create tasks" on public.tasks for insert with check (
  exists (
    select 1 from public.projects p
    join public.organisation_members om on om.organisation_id = p.organisation_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);
-- Organisation members can update tasks
create policy "Organisation members can update tasks" on public.tasks for update using (
  exists (
    select 1 from public.projects p
    join public.organisation_members om on om.organisation_id = p.organisation_id
    where p.id = tasks.project_id and om.user_id = auth.uid()
  )
);
-- Task creators or leaders can delete tasks
create policy "Task creators can delete tasks" on public.tasks for delete using (
  created_by = auth.uid() OR exists (
    select 1 from public.projects p
    join public.organisation_members om on om.organisation_id = p.organisation_id
    where p.id = tasks.project_id and om.user_id = auth.uid() and om.role in ('leader', 'admin')
  )
);

-- =============================================
-- 7. TASK TRANSLATIONS TABLE
-- =============================================
create table if not exists public.task_translations (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  locale text not null,
  translated_title text,
  translated_description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(task_id, locale)
);
alter table public.task_translations enable row level security;
create policy "Anyone can view task translations" on public.task_translations for select using (true);
create policy "Service can insert translations" on public.task_translations for insert with check (true);
create policy "Service can update translations" on public.task_translations for update using (true);

-- =============================================
-- 8. COMMENTS TABLE
-- =============================================
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  author_id uuid references public.users(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.comments enable row level security;

-- Organisation members can view comments on their tasks
create policy "Organisation members can view comments" on public.comments for select using (
  exists (
    select 1 from public.tasks t
    join public.projects p on p.id = t.project_id
    join public.organisation_members om on om.organisation_id = p.organisation_id
    where t.id = comments.task_id and om.user_id = auth.uid()
  )
);
-- Organisation members can create comments
create policy "Organisation members can create comments" on public.comments for insert with check (
  auth.uid() = author_id AND exists (
    select 1 from public.tasks t
    join public.projects p on p.id = t.project_id
    join public.organisation_members om on om.organisation_id = p.organisation_id
    where t.id = task_id and om.user_id = auth.uid()
  )
);
-- Authors can delete their comments
create policy "Authors can delete comments" on public.comments for delete using (author_id = auth.uid());

-- =============================================
-- 9. COMMENT TRANSLATIONS TABLE
-- =============================================
create table if not exists public.comment_translations (
  id uuid default gen_random_uuid() primary key,
  comment_id uuid references public.comments(id) on delete cascade not null,
  locale text not null,
  translated_content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(comment_id, locale)
);
alter table public.comment_translations enable row level security;
create policy "Anyone can view comment translations" on public.comment_translations for select using (true);
create policy "Service can insert comment translations" on public.comment_translations for insert with check (true);
create policy "Service can update comment translations" on public.comment_translations for update using (true);

-- =============================================
-- 10. REALTIME PUBLICATION
-- =============================================
-- Enable realtime for collaborative features
alter publication supabase_realtime add table public.organisations;
alter publication supabase_realtime add table public.organisation_members;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.task_translations;
alter publication supabase_realtime add table public.comment_translations;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to check if user is member of an organisation
create or replace function public.is_org_member(org_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.organisation_members 
    where organisation_id = org_id and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Function to get user's organisations
create or replace function public.get_user_organisations()
returns setof public.organisations as $$
begin
  return query
    select o.* from public.organisations o
    join public.organisation_members om on om.organisation_id = o.id
    where om.user_id = auth.uid();
end;
$$ language plpgsql security definer;

-- Function to generate unique slug from name
create or replace function public.generate_org_slug(org_name text)
returns text as $$
declare
  base_slug text;
  final_slug text;
  counter integer := 0;
begin
  base_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  
  while exists (select 1 from public.organisations where slug = final_slug) loop
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
  end loop;
  
  return final_slug;
end;
$$ language plpgsql;
