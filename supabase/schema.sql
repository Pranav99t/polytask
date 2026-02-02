-- Enable Row Level Security
-- alter table auth.users enable row level security; -- Managed by Supabase, generally not needed to run manually and causes permission errors.


-- Create public users table to sync with auth
create table if not exists public.users (
  id uuid references auth.users not null primary key,
  email text,
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
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Projects Table
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  owner_id uuid references public.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.projects enable row level security;
create policy "Users can view projects they own." on public.projects for select using (auth.uid() = owner_id);
create policy "Users can create projects." on public.projects for insert with check (auth.uid() = owner_id);
create policy "Users can update projects they own." on public.projects for update using (auth.uid() = owner_id);
create policy "Users can delete projects they own." on public.projects for delete using (auth.uid() = owner_id);

-- Tasks Table
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  status text default 'todo', -- todo, in-progress, done
  assigned_to uuid references public.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.tasks enable row level security;
create policy "Users can view tasks in their projects." on public.tasks for select using (
  exists (select 1 from public.projects where id = tasks.project_id and owner_id = auth.uid())
);
create policy "Users can create tasks in their projects." on public.tasks for insert with check (
  exists (select 1 from public.projects where id = project_id and owner_id = auth.uid())
);
create policy "Users can update tasks in their projects." on public.tasks for update using (
  exists (select 1 from public.projects where id = tasks.project_id and owner_id = auth.uid())
);
create policy "Users can delete tasks in their projects." on public.tasks for delete using (
  exists (select 1 from public.projects where id = tasks.project_id and owner_id = auth.uid())
);

-- Task Translations Table
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
create policy "Users can view task translations." on public.task_translations for select using (true);
create policy "Enable insert for authenticated users" on public.task_translations for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.task_translations for update using (auth.role() = 'authenticated');
create policy "Enable delete for authenticated users" on public.task_translations for delete using (auth.role() = 'authenticated');


-- Comments Table
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  author_id uuid references public.users(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.comments enable row level security;
create policy "View comments" on public.comments for select using (
   exists (select 1 from public.tasks t join public.projects p on t.project_id = p.id where t.id = comments.task_id and p.owner_id = auth.uid())
);
create policy "Create comments" on public.comments for insert with check (auth.uid() = author_id);
create policy "Delete own comments" on public.comments for delete using (auth.uid() = author_id);

-- Comment Translations Table
create table if not exists public.comment_translations (
  id uuid default gen_random_uuid() primary key,
  comment_id uuid references public.comments(id) on delete cascade not null,
  locale text not null,
  translated_content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(comment_id, locale)
);
alter table public.comment_translations enable row level security;
create policy "View comment translations" on public.comment_translations for select using (true);
create policy "Insert comment translations" on public.comment_translations for insert with check (auth.role() = 'authenticated');
create policy "Update comment translations" on public.comment_translations for update using (auth.role() = 'authenticated');
create policy "Delete comment translations" on public.comment_translations for delete using (auth.role() = 'authenticated');

-- Realtime publication
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.task_translations;
alter publication supabase_realtime add table public.comment_translations;
