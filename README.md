# C&I Custom Pricing Calculators

A web-based application designed for the sales team to quickly and accurately generate price quotes for custom-sized filters. The application contains several distinct calculators and a central dashboard to build and manage a complete customer quote.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Features](#features)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Installation

1.  Clone the repository to your local machine:
    ```bash
    git clone <your-repository-url>
    cd pricing-calc
    ```

2.  Install the project dependencies:
    ```bash
    npm install
    ```

## Usage

This project uses Vite for a fast development experience.

1.  **Start the development server:**
    This command will start the app on a local port (usually `http://localhost:5173`) with hot module replacement.
    ```bash
    npm run dev
    ```

2.  **Build for production:**
    This command will lint the code, run the TypeScript compiler, and create a production-ready build in the `dist/` directory.
    ```bash
    npm run build
    ```

## Features

This application is built with React, TypeScript, and Tailwind CSS and includes the following features:

- **Multiple Calculators:** Separate, dedicated calculators for different product lines (Pleats, Panels, Pads, Sleeves).
- **Data-Driven Logic:** All pricing rules, product specifications, and validation are driven by CSV files located in the `src/data` directory, making updates easy without changing code.
- **Interactive Dashboard:** A central place to view all items in the current quote.
- **Quote Management:** Users can update quantities, remove individual items, or clear the entire quote.
- **Responsive Design:** A mobile-first interface that adapts from a card-based view on phones to a full table view on desktops.
- **Export to Excel:** The current quote can be exported to a `.xlsx` file with a single click.
- **User Feedback:** Toast notifications provide clear, non-intrusive feedback for actions like adding or removing items.

## Testing

The project includes a comprehensive testing suite that uses Python to validate the TypeScript logic against the original Excel spreadsheets. This ensures that the pricing calculations are accurate and reliable.

You can run the tests for each calculator using the `npm run test:all:<calculator>` scripts (e.g., `npm run test:all:pleats`).

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

This project is not currently licensed. Consider adding a license file (e.g., `LICENSE.md`) with a license like MIT or Apache 2.0.