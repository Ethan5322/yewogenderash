import { describe, it, expect } from "vitest";
import {
  computeFeeSplit,
  computeWithdrawal,
  withholdingTotalFor,
  withdrawableMax,
  grossUpForWithholding,
  PLATFORM_FEE_RATE,
  WITHHOLDING_FEE_RATE,
} from "./fees";

describe("computeFeeSplit", () => {
  it("takes 3% by default and reconciles to gross exactly", () => {
    const { gross, fee, net, rate } = computeFeeSplit(100);
    expect(rate).toBe(PLATFORM_FEE_RATE);
    expect(gross).toBe(100);
    expect(fee).toBe(3);
    expect(net).toBe(97);
    expect(fee + net).toBe(gross);
  });

  it("rounds to 2 decimals without float drift", () => {
    const { fee, net } = computeFeeSplit(99.99);
    // 3% of 99.99 = 2.9997 -> 3.00; net = 96.99
    expect(fee).toBe(3);
    expect(net).toBe(96.99);
    expect(Number((fee + net).toFixed(2))).toBe(99.99);
  });

  it("handles small amounts", () => {
    const { fee, net } = computeFeeSplit(10);
    expect(fee).toBe(0.3);
    expect(net).toBe(9.7);
  });

  it("always reconciles: fee + net === gross for many values", () => {
    for (const g of [10, 33.33, 250, 1000.5, 7777.77, 1_000_000]) {
      const { gross, fee, net } = computeFeeSplit(g);
      expect(Number((fee + net).toFixed(2))).toBe(Number(gross.toFixed(2)));
    }
  });

  it("respects a custom rate", () => {
    const { fee, net } = computeFeeSplit(200, 0.05);
    expect(fee).toBe(10);
    expect(net).toBe(190);
  });
});

describe("safety & guarantee withholding (7%)", () => {
  it("is 7% of gross donated", () => {
    expect(WITHHOLDING_FEE_RATE).toBe(0.07);
    expect(withholdingTotalFor(1000)).toBe(70);
    expect(withholdingTotalFor(0)).toBe(0);
  });

  it("rounds to birr cents", () => {
    // 7% of 99.99 = 6.9993 -> 7.00
    expect(withholdingTotalFor(99.99)).toBe(7);
  });

  it("takes the whole outstanding withholding from one withdrawal", () => {
    const w = computeWithdrawal(500, 70);
    expect(w.withholding).toBe(70);
    expect(w.net).toBe(430);
    expect(w.withholding + w.net).toBe(w.requested);
  });

  it("charges nothing more once the 7% has been collected", () => {
    const second = computeWithdrawal(470, 0);
    expect(second.withholding).toBe(0);
    expect(second.net).toBe(470);
  });

  it("never withholds more than the amount being withdrawn", () => {
    // Asked for 50 while 70 is still outstanding: take 50 now, 20 rolls over.
    const w = computeWithdrawal(50, 70);
    expect(w.withholding).toBe(50);
    expect(w.net).toBe(0);
  });

  it("end to end, the fundraiser receives 90% of what donors gave", () => {
    const donated = 1000;
    const { fee, net: balance } = computeFeeSplit(donated);
    expect(fee).toBe(30);
    expect(balance).toBe(970); // what the fundraiser sees

    // Withdraw the whole balance; the one-off 7% of GROSS comes out of it.
    const w = computeWithdrawal(balance, withholdingTotalFor(donated));
    expect(w.withholding).toBe(70);
    expect(w.net).toBe(900);

    // Platform keeps 3% + 7% = 10%; nothing is unaccounted for.
    expect(fee + w.withholding + w.net).toBe(donated);
  });

  it("reconciles across instalment withdrawals", () => {
    const donated = 1000;
    const balance = computeFeeSplit(donated).net; // 970
    let due = withholdingTotalFor(donated); // 70
    let received = 0;

    const first = computeWithdrawal(500, due);
    due -= first.withholding;
    received += first.net;

    const second = computeWithdrawal(balance - first.requested, due);
    due -= second.withholding;
    received += second.net;

    expect(first.net).toBe(430);
    expect(second.net).toBe(470);
    expect(received).toBe(900);
    expect(due).toBe(0);
  });

  it("guards against negative or nonsense input", () => {
    expect(computeWithdrawal(-10, 70)).toEqual({ requested: 0, withholding: 0, net: 0 });
    expect(computeWithdrawal(100, -5)).toEqual({ requested: 100, withholding: 0, net: 100 });
  });
});

describe("withdrawal ceiling — the fundraiser types what they receive", () => {
  it("caps a fresh campaign at 90% of gross, not the 97% balance", () => {
    // Donors gave 1,000. Balance shows 970 after the 3%; 70 of withholding is
    // still owed, so only 900 can leave — exactly 90% of gross.
    const gross = 1000;
    const available = computeFeeSplit(gross).net; // 970
    const due = withholdingTotalFor(gross); // 70

    expect(available).toBe(970);
    expect(withdrawableMax(available, due)).toBe(900);
    expect(withdrawableMax(available, due)).toBe(gross * 0.9);
  });

  it("grossing up delivers exactly the amount asked for", () => {
    const due = 70;
    const wanted = 900;
    const requested = grossUpForWithholding(wanted, due); // 970
    const quote = computeWithdrawal(requested, due);

    expect(requested).toBe(970);
    expect(quote.withholding).toBe(70);
    expect(quote.net).toBe(wanted); // what they typed is what they get
  });

  it("charges no withholding twice, so later withdrawals cap at the balance", () => {
    // Withholding settled on the first withdrawal; the rest is withdrawable 1:1.
    const remainingBalance = 70;
    expect(withdrawableMax(remainingBalance, 0)).toBe(70);
    expect(grossUpForWithholding(70, 0)).toBe(70);
    expect(computeWithdrawal(70, 0).net).toBe(70);
  });

  it("a partial withdrawal still totals 90% across the campaign's life", () => {
    const gross = 1000;
    let balance = computeFeeSplit(gross).net; // 970
    let due = withholdingTotalFor(gross); // 70
    let received = 0;

    // First: asks for 400 in the bank.
    const firstRequested = grossUpForWithholding(400, due); // 470
    const first = computeWithdrawal(firstRequested, due);
    balance -= first.requested;
    due -= first.withholding;
    received += first.net;

    expect(first.net).toBe(400);
    expect(due).toBe(0);

    // Second: withholding is settled, so the whole remaining balance is his.
    const max = withdrawableMax(balance, due); // 500
    const second = computeWithdrawal(grossUpForWithholding(max, due), due);
    received += second.net;

    expect(max).toBe(500);
    expect(received).toBe(900);
    expect(received).toBe(gross * 0.9);
  });

  it("never returns a negative ceiling when withholding exceeds the balance", () => {
    expect(withdrawableMax(50, 70)).toBe(0);
    expect(withdrawableMax(0, 0)).toBe(0);
    expect(withdrawableMax(-10, 70)).toBe(0);
  });
});
