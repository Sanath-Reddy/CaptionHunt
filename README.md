<div align="center">
  <h1>🎥 CaptionHunt</h1>
  <p><strong>A powerful, self-hosted semantic search engine for YouTube video transcripts.</strong></p>
  
  <p>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
    <a href="https://orm.drizzle.team/"><img src="https://img.shields.io/badge/Drizzle_ORM-PostgreSQL-green?style=flat-square" alt="Drizzle ORM" /></a>
    <a href="#"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT" /></a>
  </p>
</div>

<br />

CaptionHunt allows you to build a personal library of YouTube videos, channels, and playlists, automatically indexing their transcripts to enable lightning-fast, highly contextual semantic search. Find exactly what was said and jump straight to that moment in the video.

## ✨ Features

- 🔍 **Semantic Search:** Don't just search for exact keywords. Search by meaning, context, or question.
- 📺 **Bulk Imports:** Seamlessly import single videos, full playlists, or track entire channels.
- ⚡ **Auto-Indexing:** Background queueing system automatically fetches and processes transcripts for newly added content.
- 🔖 **Bookmarks:** Found an interesting moment? Bookmark the exact timestamp with personalized notes.
- 📊 **Analytics Dashboard:** Monitor your library's size, indexing status, and view your top search queries over time.
- 🔗 **Shareable Links:** Every search query updates the URL, allowing you to bookmark or share specific searches.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Styling:** Vanilla CSS (CSS Modules / Custom Properties for a beautiful, rich dark mode aesthetic)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL database
- YouTube Data API v3 Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Sanath-Reddy/CaptionHunt.git
   cd CaptionHunt
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env.local` file in the root directory and add the following variables:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/captionhunt"
   YOUTUBE_API_KEY="your_youtube_api_key_here"
   NEXTAUTH_SECRET="your_nextauth_secret_here"
   NEXTAUTH_URL="http://localhost:3000"
   # Add any other required embedding/LLM API keys here depending on the semantic search provider
   ```

4. **Initialize Database:**
   Push the schema to your PostgreSQL database:
   ```bash
   npm run db:push
   # or run migrations depending on your workflow
   ```

5. **Run the Development Server:**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure

```
src/
├── app/          # Next.js App Router (pages, api routes, layouts)
├── components/   # Reusable React components (Sidebar, Modals, Cards)
├── db/           # Drizzle ORM schema and configuration
├── lib/          # Utilities (YouTube API, Queue processing, Search, Embeddings)
└── ...
```

## 🤝 Contributing

Contributions are always welcome! Feel free to open an issue or submit a pull request if you have ideas for improvements, bug fixes, or new features.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
