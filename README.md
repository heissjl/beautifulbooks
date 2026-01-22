# Beautiful Books

A visual-first book discovery website that showcases different covers and editions of books, helping you find where to buy them.

## Features

- **Visual Gallery**: Beautiful, responsive grid layout displaying book covers
- **Smart Search**: Search by book title or author
- **Multiple Data Sources**: Combines data from Google Books and Open Library APIs
- **Edition Details**: View comprehensive information about each edition including:
  - Publisher and publication date
  - ISBN and page count
  - Book description
  - Cover images
- **Purchase Links**: Direct links to buy books from multiple retailers:
  - Amazon
  - AbeBooks
  - Book Depository
  - Google Books

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **APIs**:
  - Google Books API
  - Open Library API

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd beautifulbooks
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
beautifulbooks/
├── app/
│   ├── book/[id]/
│   │   └── page.tsx          # Book detail page
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Home page
│   └── globals.css            # Global styles
├── components/
│   ├── BookCard.tsx           # Individual book card component
│   ├── BookGrid.tsx           # Grid of book cards
│   └── SearchBar.tsx          # Search input component
├── lib/
│   └── api.ts                 # API integration layer
└── types/
    └── book.ts                # TypeScript type definitions
```

## Usage

1. **Search for Books**: Enter a book title or author name in the search bar
2. **Browse Results**: View a grid of different editions with their cover images
3. **Click for Details**: Click on any book cover to see detailed information
4. **Find & Buy**: Use the purchase links to find where you can buy specific editions

## API Data Sources

### Google Books API
- Provides comprehensive book metadata
- High-quality cover images
- Purchase links for available books
- No API key required for basic usage

### Open Library API
- Additional editions and covers
- Historical publication data
- Free and open access

## Performance Features

- **Next.js Image Optimization**: Automatic image optimization and lazy loading
- **Server-Side Rendering**: Fast initial page loads
- **Responsive Design**: Works beautifully on all devices
- **TypeScript**: Type safety and better developer experience

## Future Enhancements

Potential features to add:
- User accounts and favorites
- Advanced filtering (by year, publisher, language)
- Book comparison view
- Price tracking across retailers
- Community ratings and reviews
- Web scraping for rare/collectible editions
- AI-powered cover art analysis

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

MIT License - feel free to use this project for your own purposes.
