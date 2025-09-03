-----

# Kasir Bot - A Telegram POS System

A simple yet effective Point-of-Sale (POS) bot built with **Deno** and **Grammy** for managing transactions at a Matcha cafe. It allows cashiers to quickly create orders, manage a shopping cart, calculate totals, and process payments directly within a Telegram chat.

-----

## ✨ Features

  * **Session-Based Transactions**: Each transaction flow starts with a customer's name and is tracked via a session.
  * **Authorization Control**: The bot is restricted to authorized users and has a separate privilege level for admins.
  * **Interactive Inline Menus**: Users interact with the bot using clean, responsive inline keyboards, minimizing the need for text commands.
  * **Dynamic Cart Management**: Easily add or remove items from the cart, with real-time updates to the subtotal.
  * **Multiple Payment Methods**: Supports both **Cash** and **QRIS** payment processing.
  * **Automated Calculations**: The bot handles total calculations, and for cash payments, it calculates the required change.
  * **Receipt Generation**: Generates a simple text-based receipt upon successful payment.
  * **Admin Panel**: A special section for admins to:
      * View a daily sales summary (total revenue, items sold, payment method breakdown).
      * Reset all transaction data for the day.
  * **State Management**: Uses a simple view-based state machine (`current_view`) to manage the user's journey through the transaction process.

-----

## 🛠️ Technology Stack

  * **Runtime**: [Deno](https://deno.land/)
  * **Telegram Bot Framework**: [Grammy](https://grammy.dev/)
  * **Language**: TypeScript
  * **Environment Variables**: `deno-dotenv`

-----

## 🚀 Getting Started

Follow these instructions to set up and run the bot on your own machine.

### Prerequisites

You must have [Deno](https://deno.land/manual/getting_started/installation) installed on your system.

### Installation & Setup

1.  **Clone the repository** (or save the code into a file, e.g., `main.ts`):

    ```bash
    # If it's a git repo
    git clone <your-repository-url>
    cd <your-repository-directory>
    ```

2.  **Create an environment file**:
    Create a file named `.env` in the root of your project directory. This file will store your secret credentials.

3.  **Configure Environment Variables**:
    Add the following variables to your `.env` file and replace the placeholder values.

    ```ini
    # .env.example

    # Get this from BotFather on Telegram
    BOT_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"

    # Comma-separated list of Telegram User IDs for Admins
    # Admins can see the admin panel and use the bot.
    ADMIN_IDS="555111222,999888777"

    # Comma-separated list of Telegram User IDs for regular cashiers
    # Users can use the bot but cannot see the admin panel.
    USER_IDS="112233445"
    ```

    **How to find your Telegram User ID?**
    You can send a message to a bot like `@userinfobot` on Telegram to get your numeric User ID.

### Running the Bot

Execute the following command in your terminal to start the bot. The flags are required to grant the necessary permissions for network access, environment variable reading, etc.

```bash
deno run --allow-net --allow-env --allow-read main.ts
```

The console will display `🚀 Starting Bot Kasir...` if it starts successfully. You can now interact with your bot on Telegram\!

-----

## 📖 How to Use

The bot is designed to be operated entirely through inline keyboard buttons.

### 1\. Start a Session

  * Open a chat with the bot and run the `/start` command.
  * This will display a welcome screen. Click **"✅ Start Transaction Session"**.

### 2\. Enter Customer Name

  * The bot will ask for the customer's name. Type the name in the chat and send it.

### 3\. Add Items to Cart

  * You will be presented with the main menu, which lists all available matcha drinks.
  * Click on an item to view its details.
  * Use the `➕` and `➖` buttons to add or remove units of that item from the cart. The subtotal will update automatically.
  * Click **"⬅️ Back to Menu"** to add other items. The main menu will now display a summary of the current cart and the running total.

### 4\. Checkout

  * Once all items are added, click the **"🛒 Checkout"** button from the main menu.
  * A final summary of the order will be displayed.

### 5\. Process Payment

  * Choose a payment method:
      * **💵 Cash**: The bot will ask for the amount of cash received from the customer. Type the number (e.g., `50000`) and send. The bot will calculate the change and generate a receipt.
      * **📱 QRIS**: The bot will show a confirmation screen. After the customer completes the payment via QRIS, click **"✅ Payment Complete"** to generate the receipt.

### 6\. Post-Transaction

  * After a receipt is generated, you have three options:
      * **👤 New Customer**: Clears the previous cart and customer name and starts a new transaction session.
      * **➕ Add Item (Same Customer)**: Returns to the menu screen to add more items for the *same customer*. This is useful if a customer forgot something.
      * **🚪 End Session (Close Shop)**: Returns to the main welcome screen.

-----

## 🔐 Admin Features

If your Telegram User ID is listed in the `ADMIN_IDS` environment variable, you will see an additional **"🔧 Admin Panel"** button on the welcome and main menu screens.

The Admin Panel provides access to:

  * **📊 Sales Report (`Rekap Penjualan`)**:

      * Shows a summary of all transactions since the bot was last started or reset.
      * Includes a breakdown of quantity sold for each item.
      * Shows total revenue, number of transactions, and a breakdown of income from Cash vs. QRIS.

  * **🗑️ Reset Daily Data (`Reset Data Harian`)**:

      * Clears all sales data from the bot's memory. This action is irreversible.
      * This is intended to be used at the end of a business day after recording the totals elsewhere.

-----

## ⚠️ Important Notes & Limitations

  * **Data Persistence**: This bot uses a simple in-memory array (`SALES`) to store transaction data. **This means all sales data will be lost if the bot script is stopped, crashes, or the server is restarted.** This implementation is designed for simplicity, assuming the daily report is checked before shutting down. For a production environment, you would want to replace the `SALES` array with a database (e.g., Supabase, SQLite, or a JSON file).