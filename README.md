# PolyTask 🌍
### **Collaborative Multilingual Task Management Platform for Global Teams**

![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-blue?style=for-the-badge&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=for-the-badge&logo=typescript&logoColor=white)

PolyTask is a real-time collaborative task management platform designed to break down language barriers. It automatically translates tasks, comments, and project details into each team member's preferred language, enabling seamless collaboration regardless of geographic or linguistic boundaries.

---

## 🚀 Key Features

### 🌍 **Automatic Information Translation**
- **Instant Translation**: Every comment and task description is automatically translated into the viewer's native language.
- **AI-Powered**: Powered by Lingo.dev for accurate, context-aware translations.
- **Language Detection**: Automatically detects the source language of any message.


### 📋 **Comprehensive Task Management**
- **Kanban Board**: Drag-and-drop tasks between "To Do", "In Progress", and "Done".
- **Rich Details**: Add descriptions, assignees, and detailed metadata to every task.
- **Organization Support**: Create organizations, manage multiple projects, and invite team members.

### 💬 **Multilingual Chat & Comments**
- **Contextual Discussion**: Comment directly on tasks to keep conversations focused.
- **Global Understanding**: User A types in English, User B reads in Hindi, User C reads in Spanish all instantly.

### 🔐 **Enterprise-Grade Security**
- **Role-Based Access**: Granular permissions for Leaders, Admins, and Members.
- **Secure Auth**: Powered by Supabase Auth with Row Level Security (RLS) policies.

---

## 🛠️ Technology Stack

- **Frontend**: [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Auth, Storage)
- **AI & Translation**: [Lingo.dev](https://lingo.dev/) SDK
- **Language**: TypeScript
- **State Management**: React Query (Server State) & React Hooks

---

## 🗄️ Database Schema

The core database structure consists of the following key tables:

- **users**: Stores user profiles and authentication links.
- **organisations**: Top-level grouping for teams.
- **projects**: Workspaces within an organization.
- **tasks**: Individual work items with status, assignee, and description.
- **comments**: Discussion threads on tasks.
- **comment_translations**: Real-time store for translated versions of every comment.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

**Built with ❤️ by [Pranav](https://github.com/Pranav99t) for the Hackathon**
