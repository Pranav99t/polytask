# PolyTask - Multilingual Task Management

A collaborative, multilingual task management web app for global teams built with Next.js, Supabase, and i18n support.

## 🌟 Features

- **Multilingual Support**: Seamless switching between English, Spanish, and Hindi
- **Real-time Collaboration**: Live updates using Supabase Realtime
- **Secure Authentication**: Email/password auth with Supabase
- **Project Management**: Create and manage multiple projects
- **Task Tracking**: Organize tasks with status tracking
- **Comment System**: Real-time comments with auto-translation
- **Responsive Design**: Works on desktop and mobile

## 🚀 Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI
- **i18n**: i18next & react-i18next
- **Language**: TypeScript

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/Pranav99t/PolyTask.git

# Navigate to project directory
cd PolyTask

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase credentials

# Run development server
npm run dev
```

## 🔧 Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🗄️ Database Setup

1. Create a new Supabase project
2. Run the SQL schema from `supabase/schema.sql`
3. Disable email confirmation in Auth settings (for testing)

## 🎯 Usage

1. Sign up with email and password
2. Create a new project
3. Add tasks to your project
4. Switch languages using the dropdown
5. Collaborate with real-time comments

## 🌍 Supported Languages

- 🇬🇧 English
- 🇪🇸 Spanish (Español)
- 🇮🇳 Hindi (हिंदी)

## 📝 License

MIT License

## 👨‍💻 Author

**Pranav** - [@Pranav99t](https://github.com/Pranav99t)

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
