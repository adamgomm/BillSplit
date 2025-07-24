# BillSplit App

A React Native mobile application for splitting bills and expenses with friends during travel and dining.

## Features

- User authentication (login/logout)
- Add and track expenses
- Split bills in multiple ways (equal, percentage, exact amounts)
- Dashboard with expense summaries and balances
- Friends management
- Expense categories and reporting

## Screens

- **Login**: User authentication
- **Home**: Recent expenses and quick actions
- **Dashboard**: Financial overview with balances and statistics
- **Profile**: User settings and preferences
- **New Expense**: Add and split expenses

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/bill-split-app.git
cd bill-split-app
```

2. Install dependencies:
```bash
npm install
# or 
yarn install
```

3. Start the development server:
```bash
npm start
# or
yarn start
# or
npx expo start
```

4. Run on a device or emulator:
   - Press `a` for Android
   - Press `i` for iOS (requires a Mac)
   - Scan the QR code with the Expo Go app on your phone

## Usage

1. **Login**: Use any email and password (authentication is simulated in this demo)
2. **Add Expenses**: Tap the "Add Expense" button on the Home screen
3. **View Balances**: Check the Dashboard to see who owes whom
4. **Settle Up**: Tap "Settle Up" to clear balances

## Technology Stack

- React Native
- Expo
- React Navigation
- AsyncStorage for local data persistence
- React Hooks for state management

## Project Structure

```
bill-split-app/
├── app/                  # Main application screens
│   ├── (tabs)/           # Tab-based screens
│   ├── login.tsx         # Login screen
│   ├── new-expense.tsx   # Add expense screen
│   └── _layout.tsx       # Root layout with navigation
├── components/           # Reusable UI components
├── constants/            # App constants and theme
├── assets/               # Images and fonts
└── node_modules/         # Dependencies
```

## Future Enhancements

- Backend integration with a server
- User registration
- Push notifications
- Cloud sync
- Receipt scanning
- Payment integration

## License

This project is licensed under the MIT License - see the LICENSE file for details.
