# Prismatic Cell Batch Data Processor

A single-page web application for processing and visualizing prismatic cell battery data from Excel (`.xlsx`) files. Built for DC Energy engineering labs.

## Features

- **Batch Upload**: Drag-and-drop support for multiple `.xlsx` files at once.
- **Data Extraction**: Automatically extracts Serial Number and Discharge Capacity from specific sheets.
- **Interactive Plot**: Overlays discharge curves (Voltage vs. Capacity) of all uploaded files on a single graph for easy visual comparison.
- **Batch Aggregation**: Combines extracted data into a summary table.
- **CSV Export**: Download the combined summary table as a `.csv` file.
- **Client-Side Processing**: All Excel parsing is done locally in the browser using SheetJS (no server-side API required).
- **Industrial Theme**: Clean, dark-mode UI optimized for engineering environments.

## Tech Stack

- **Framework**: React (Vite)
- **Styling**: Tailwind CSS
- **Excel Processing**: SheetJS (`xlsx`)
- **Visualization**: Recharts
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone <repository-url>
   cd prismatic-cell-processor
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Open your browser and navigate to `http://localhost:3000`.

### Building for Production

To build the application for production (e.g., Vercel deployment):

\`\`\`bash
npm run build
\`\`\`

The compiled assets will be available in the `dist` directory.

## Deployment on Vercel

This project is structured for immediate deployment on Vercel.

1. Push your code to a GitHub repository.
2. Log in to Vercel and click **New Project**.
3. Import your GitHub repository.
4. Vercel will automatically detect the Vite framework and configure the build settings (`npm run build` and `dist` output directory).
5. Click **Deploy**.

## Data Extraction Logic

The application expects `.xlsx` files with the following structure:

1. **Serial Number**: Extracted from the `Template information` sheet, cell `A1`. It looks for the numeric value following the string "Barcode:".
2. **Discharge Capacity**: Extracted from the `Loop level` sheet, cell `H2`.
3. **Curve Data**: Extracted from the `Record level` sheet. It maps Column I (Voltage) to the Y-axis and Column N (Capacity) to the X-axis. Only rows where the current (Column H) is negative (discharge) are included.

## License

MIT License
