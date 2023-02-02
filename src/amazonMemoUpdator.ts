import * as ynab from "ynab";
import moment from "moment";
import { AmazonOrderFetcher } from "./support/amazonOrderFetcher";
import { IAmazonItemsByAmount } from "./support/amazonOrderInfo";
import config from "../config.json";

export class amazonMemoUpdator {
  readonly amazonOrdersSinceDaysAgo = 30;

  ynabAPI: ynab.api;

  constructor() {
    this.ynabAPI = new ynab.api(config.personal_access_token);
  }

  public async run() {
    let fromISODate = moment().subtract(Math.abs(this.amazonOrdersSinceDaysAgo), "days").toISOString();
    let toISODate = moment().toISOString();

    const unapprovedAmazonTransactions = await this.fetchUnapprovedAmazonTransactions(config.budget_id);
    if (unapprovedAmazonTransactions.length) {
      console.log(`${unapprovedAmazonTransactions.length} unapproved Amazon transactions were found!`);
      const amazonOrderFetcher = new AmazonOrderFetcher(config.amazon_email, config.amazon_password);
      const amazonOrders = await amazonOrderFetcher.getOrders(fromISODate, toISODate);
      await this.updateAmazonTransactionMemos(config.budget_id, unapprovedAmazonTransactions, amazonOrders);
    } else {
      console.log("No unapproved Amazon transactions found.");
    }
  }

  private async fetchUnapprovedAmazonTransactions(budgetId: string) {
    console.log(`Fetching unapproved Amazon transactions from YNAB...`);
    const unapprovedAmazonTransactions = await this.getTransactionsToUpdate(budgetId);
    return unapprovedAmazonTransactions;
  }

  private async updateAmazonTransactionMemos(
    budgetId: string,
    unapprovedAmazonTransactions: ynab.TransactionDetail[],
    amazonOrders: IAmazonItemsByAmount
  ) {
    console.log(`Updating transaction memos in YNAB...`);
    for (let order of amazonOrders.entries()) {
      console.log(`Found order: ${order}`);
    }
    // It's also possible that it can't find the order if it's shipped via two different carriers
    for (let transaction of unapprovedAmazonTransactions) {
      let txnAmount = Math.abs(transaction.amount * 0.001).toFixed(2);
      let amazonOrderByAmount = amazonOrders.get(txnAmount);
      if (amazonOrderByAmount) {
        //const originalMemo = transaction.memo;

        const itemsPortion = `#Items: ${amazonOrderByAmount.substring(0, 100)}`;
        const updatedMemo = transaction.memo ? `${transaction.memo} / ${itemsPortion}` : `${itemsPortion}`;

        console.log(
          `Updating transaction: ${transaction.date} ${transaction.payee_name} ${txnAmount} ${transaction.memo} -> ${updatedMemo}`
        );

        transaction.payee_name = null!;
        transaction.memo = updatedMemo;

        //console.log(`Skipping update.`);
        await this.ynabAPI.transactions.updateTransaction(budgetId, transaction.id, {
          transaction,
        });
        console.log(`Done.`);
      } else {
        console.log(
          `Could not find a matching Amazon transaction for: ${transaction.date} ${transaction.payee_name} ${txnAmount} ${transaction.memo}`
        );
      }
    }
  }

  private async getTransactionsToUpdate(budgetId: string) {
    const transactions = await this.ynabAPI.transactions.getTransactions(budgetId, undefined, "unapproved");
    // TODO: Make this take the date from the command line
    //const transactions = await this.ynabAPI.transactions.getTransactions(budgetId, "2020-03-01");
    // TODO: Make it only work on approved/unapproved as a CLI option
    // TODO: Ask for confirmation of the change - make it detect whether it's been updated or not already
    const unapprovedAmazonTransactions = transactions.data.transactions.filter((t) => {
      if (!t.payee_name) {
        return false;
      }

      return t.payee_name.toLowerCase().includes("amazon");
    });

    return unapprovedAmazonTransactions;
  }
}
