import { describe, it, expect } from "vitest";
import {
  computeFeeSplit,
  computeWithdrawal,
  withholdingTotalFor,
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
